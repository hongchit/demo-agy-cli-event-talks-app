# =============================================================================
# app.py — BigQuery Release Notes Explorer (Flask Backend)
# =============================================================================
# Responsibilities:
#   1. Fetch the official BigQuery Atom/RSS XML feed from Google Cloud
#   2. Parse the XML tree and split grouped daily entries into individual items
#   3. Sanitize HTML content into plain text for tweet composing
#   4. Cache parsed results in-memory (10-minute TTL) to prevent rate-limiting
#   5. Serve two routes: the HTML page (/) and a JSON data API (/api/notes)
# =============================================================================

# --- Standard Library Imports ------------------------------------------------
# os           : Reads the PORT environment variable at startup
# re           : Regex for splitting HTML content blocks and stripping tags
# urllib       : Makes the HTTP GET request to fetch the remote XML feed
#                (no third-party requests library needed)
# xml.etree    : Parses the raw XML bytes into a navigable element tree
# datetime     : Timestamps cache entries for TTL comparisons
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

# --- Flask Imports -----------------------------------------------------------
# Flask          : Core WSGI application factory
# jsonify        : Serializes Python dicts into JSON HTTP responses
# render_template: Renders Jinja2 HTML templates from the /templates folder
# request        : Provides access to query string args (e.g. ?refresh=true)
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# =============================================================================
# In-Memory Cache
# =============================================================================
# A simple module-level dictionary that stores the last successful parse result.
# Using module-level state is acceptable for a single-process development server.
# Fields:
#   'data'         : The last fully parsed JSON-serialisable result dict
#   'last_updated' : A datetime object recording when the data was last fetched
#
# Cache lifetime is 10 minutes (600 seconds). Requests within that window
# return the cached payload without hitting the external feed URL.
# The cache is bypassed entirely when the client sends ?refresh=true.
cache = {
    'data': None,
    'last_updated': None
}

# The official Google Cloud BigQuery Atom feed URL.
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"


# =============================================================================
# clean_html_for_tweet(html_content)
# =============================================================================
# Converts a rich HTML content string into sanitized plain text suitable for
# composing inside a 280-character X/Twitter tweet.
#
# Processing pipeline (3 passes):
#   Pass 1 — Link preservation:
#       <a href="url">label</a>  →  label (url)
#       Keeps the link destination visible as plain text rather than losing it.
#
#   Pass 2 — Tag stripping:
#       Removes all remaining HTML tags via the pattern <[^>]+>.
#
#   Pass 3 — Entity decoding & whitespace normalization:
#       Converts &nbsp; &amp; &lt; &gt; to their human-readable equivalents.
#       Collapses multiple consecutive spaces/newlines into a single space.
#
# Returns a clean, readable string ready for the tweet draft composer.
def clean_html_for_tweet(html_content):
    """
    Helper to extract text from HTML content and strip tags for Tweet sharing.
    """
    # Pass 1: Replace <a href="url">text</a> with "text (url)" to preserve links as readable text
    text = re.sub(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', r'\2 (\1)', html_content)
    # Pass 2: Strip all remaining HTML tags (e.g. <p>, <code>, <strong>)
    text = re.sub(r'<[^>]+>', '', text)
    # Pass 3: Decode common HTML character entities to their plaintext equivalents
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    # Normalize whitespace: collapse runs of spaces/newlines into a single space
    text = re.sub(r'\s+', ' ', text).strip()
    return text


# =============================================================================
# parse_release_notes()
# =============================================================================
# Core parsing engine. Runs in 4 stages:
#
# Stage 1 — Fetch:
#   Sends an HTTP GET request with a browser-like User-Agent header so the
#   Google CDN does not block the request. Applies a 15-second timeout.
#
# Stage 2 — Parse XML:
#   Converts the raw bytes into an ElementTree. The `ns` namespace dict is
#   REQUIRED because Google's feed declares a default Atom XML namespace
#   (xmlns="http://www.w3.org/2005/Atom"). Without the prefix, ET cannot
#   match any tag by name.
#
# Stage 3 — Split grouped entries:
#   Google bundles multiple updates into one daily <entry> block, separated
#   by <h3> headings. For example a single June 17 entry might contain:
#       <h3>Feature</h3><p>...</p><h3>Announcement</h3><p>...</p>
#   re.split() on the <h3> pattern yields alternating [category, content] pairs:
#       ["", "Feature", "<p>...</p>", "Announcement", "<p>...</p>"]
#   Each pair becomes a distinct, individually filterable and tweetable entry.
#
# Stage 4 — Build output objects:
#   Each sub-entry dict contains:
#     id         — Unique string identifier per sub-entry
#     date       — Human-readable date string from the <title> element
#     updated    — ISO 8601 timestamp (used for date-range filtering in JS)
#     link       — Anchor URL pointing directly to the docs section
#     category   — Derived from the <h3> heading (e.g. "Feature", "Deprecation")
#     content    — Full HTML string rendered inside the detail modal
#     clean_text — Sanitized plain text used to pre-populate tweet drafts
#
# Returns a dict: { 'title': str, 'entries': [list of dicts], 'fetched_at': ISO str }
def parse_release_notes():
    # Stage 1: Fetch — HTTP GET with a browser User-Agent to avoid CDN blocks
    req = urllib.request.Request(
        FEED_URL,
        headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        xml_data = response.read()

    # Stage 2: Parse XML — build element tree with Atom namespace prefix
    root = ET.fromstring(xml_data)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}  # Required: feed uses a default XML namespace

    items = []

    # Extract the feed-level title (e.g. "BigQuery - Release notes")
    feed_title = root.find('atom:title', ns)
    feed_title_text = feed_title.text if feed_title is not None else "BigQuery Release Notes"

    # Iterate over every <entry> element in the feed
    for entry in root.findall('atom:entry', ns):
        date_str    = entry.find('atom:title', ns).text    # e.g. "June 17, 2026"
        updated_str = entry.find('atom:updated', ns).text  # e.g. "2026-06-17T00:00:00-07:00"

        # Extract entry ID (used as the base for sub-entry IDs)
        id_el  = entry.find('atom:id', ns)
        id_val = id_el.text if id_el is not None else ''

        # Extract the alternate link (direct URL to the docs anchor)
        link_el = entry.find('atom:link[@rel="alternate"]', ns)
        if link_el is None:
            link_el = entry.find('atom:link', ns)  # Fallback: take any <link>
        link = link_el.attrib.get('href') if link_el is not None else ''

        # Extract the HTML content block (wrapped in CDATA in the raw XML)
        content_el   = entry.find('atom:content', ns)
        content_html = content_el.text if content_el is not None else ''

        # Stage 3: Split grouped entries by <h3> headings
        # re.split with a capturing group produces: [pre, cat, body, cat, body, ...]
        parts = re.split(r'<h3>(.*?)</h3>', content_html)

        if len(parts) <= 1:
            # No <h3> found — treat the whole content as a single "General" entry
            clean_text = clean_html_for_tweet(content_html)
            items.append({
                'id':         id_val or f"note_{hash(content_html)}",
                'date':       date_str,
                'updated':    updated_str,
                'link':       link,
                'category':   'General',
                'content':    content_html,
                'clean_text': clean_text
            })
        else:
            # Stage 4: Build one output object per [category, content] pair
            # Indices: odd = category name, even (after 0) = content body
            for i in range(1, len(parts), 2):
                cat     = parts[i].strip()       # e.g. "Feature", "Announcement"
                content = parts[i+1].strip()     # HTML body for this sub-entry
                clean_text = clean_html_for_tweet(content)

                # Build an anchor URL pointing to the specific date section
                sub_link = link
                if '#' in link:
                    base_link = link.split('#')[0]
                    sub_link  = f"{base_link}#{date_str.replace(' ', '_').replace(',', '')}"

                # Unique sub-entry ID: base ID + category slug + list index
                sub_id = f"{id_val}_{cat.lower()}_{i}"

                items.append({
                    'id':         sub_id,
                    'date':       date_str,
                    'updated':    updated_str,
                    'link':       sub_link,
                    'category':   cat,
                    'content':    content,
                    'clean_text': clean_text
                })

    return {
        'title':      feed_title_text,
        'entries':    items,
        'fetched_at': datetime.now().isoformat()
    }


# =============================================================================
# get_notes(force_refresh=False)
# =============================================================================
# Cache gatekeeper. Decides whether to serve a cached response or trigger a
# fresh network fetch. Decision logic:
#
#   force_refresh=False AND cache is fresh (age < 10 min)
#       → Return cached payload immediately. No network call made.
#
#   force_refresh=True OR cache has expired (age >= 10 min)
#       → Call parse_release_notes(), store result in cache, return fresh data.
#
#   Network fetch fails BUT stale cache exists
#       → Silently fall back to the stale cache (graceful degradation).
#         The second return value will be False to signal "not newly fetched".
#
#   Network fetch fails AND no cache at all
#       → Re-raise the exception. The API route will catch it and return HTTP 500.
#
# Returns: (data_dict, fetched_new: bool)
#   fetched_new=True  means data was just fetched from the live feed
#   fetched_new=False means data came from cache (fresh or stale fallback)
def get_notes(force_refresh=False):
    global cache
    now = datetime.now()

    # Serve from cache if it is still within the 10-minute TTL and no forced refresh
    if cache['data'] and cache['last_updated'] and not force_refresh:
        time_diff = (now - cache['last_updated']).total_seconds()
        if time_diff < 600:  # 600 seconds = 10 minutes
            return cache['data'], False  # Cache hit — return early

    try:
        # Cache miss or force refresh — fetch and parse the live feed
        data = parse_release_notes()
        cache['data']         = data   # Update cached payload
        cache['last_updated'] = now    # Reset TTL timestamp
        return data, True              # Signal: freshly fetched
    except Exception as e:
        # Graceful degradation: return stale cache rather than an error page
        if cache['data']:
            return cache['data'], False
        raise e  # No cache to fall back on — propagate error to caller


# =============================================================================
# Routes
# =============================================================================

# GET /
# Renders and returns the single-page HTML application shell.
# Flask automatically locates 'index.html' inside the /templates directory.
@app.route('/')
def index():
    return render_template('index.html')


# GET /api/notes[?refresh=true]
# JSON data endpoint consumed by the frontend JavaScript (app.js).
#
# Query parameters:
#   refresh=true  — Force bypass of the cache and fetch fresh data from the feed.
#                   Any other value (or absent) uses the cached result if available.
#
# Response envelope (always JSON):
#   Success → HTTP 200
#     { "success": true, "fetched_new": bool, "data": { title, entries, fetched_at } }
#   Failure → HTTP 500
#     { "success": false, "error": "<exception message>" }
@app.route('/api/notes')
def api_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        notes, fetched_new = get_notes(force_refresh)
        return jsonify({
            'success':     True,
            'fetched_new': fetched_new,
            'data':        notes
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error':   str(e)
        }), 500


# =============================================================================
# Server Startup
# =============================================================================
# Only executed when running the file directly (not when imported by a WSGI server).
#
# host='0.0.0.0'  — Binds to all network interfaces, not just localhost.
#                   Allows access from other devices on the same LAN.
# PORT env var    — Override the default port cleanly from the shell:
#                       PORT=5001 python app.py
#                   Useful on macOS where port 5000 is occupied by AirPlay Receiver.
# debug=True      — Enables Flask's auto-reloader (restarts on file save) and
#                   the interactive in-browser debugger during development.
#                   IMPORTANT: disable debug mode before any production deployment.
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
