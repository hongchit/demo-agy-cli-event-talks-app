import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Cache structure
cache = {
    'data': None,
    'last_updated': None
}

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def clean_html_for_tweet(html_content):
    """
    Helper to extract text from HTML content and strip tags for Tweet sharing.
    """
    # Replace links with text (e.g., <a href="url">text</a> -> text)
    text = re.sub(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', r'\2 (\1)', html_content)
    # Remove all other HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Decode common HTML entities
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    # Normalize spacing
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_release_notes():
    req = urllib.request.Request(
        FEED_URL, 
        headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        xml_data = response.read()
    
    root = ET.fromstring(xml_data)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    items = []
    
    # Extract overall feed details
    feed_title = root.find('atom:title', ns)
    feed_title_text = feed_title.text if feed_title is not None else "BigQuery Release Notes"
    
    for entry in root.findall('atom:entry', ns):
        date_str = entry.find('atom:title', ns).text  # e.g., "June 17, 2026"
        updated_str = entry.find('atom:updated', ns).text  # e.g., "2026-06-17T00:00:00-07:00"
        
        # Extract ID and link
        id_el = entry.find('atom:id', ns)
        id_val = id_el.text if id_el is not None else ''
        
        link_el = entry.find('atom:link[@rel="alternate"]', ns)
        if link_el is None:
            link_el = entry.find('atom:link', ns)
        link = link_el.attrib.get('href') if link_el is not None else ''
        
        content_el = entry.find('atom:content', ns)
        content_html = content_el.text if content_el is not None else ''
        
        # Separate multiple updates in the same entry if split by h3
        parts = re.split(r'<h3>(.*?)</h3>', content_html)
        if len(parts) <= 1:
            clean_text = clean_html_for_tweet(content_html)
            items.append({
                'id': id_val or f"note_{hash(content_html)}",
                'date': date_str,
                'updated': updated_str,
                'link': link,
                'category': 'General',
                'content': content_html,
                'clean_text': clean_text
            })
        else:
            # parts looks like: [prefix_before_h3, category1, content1, category2, content2, ...]
            # Iterate through categories and contents
            for i in range(1, len(parts), 2):
                cat = parts[i].strip()
                content = parts[i+1].strip()
                clean_text = clean_html_for_tweet(content)
                
                # Create a specific anchor link if possible
                sub_link = link
                if '#' in link:
                    base_link = link.split('#')[0]
                    sub_link = f"{base_link}#{date_str.replace(' ', '_').replace(',', '')}"
                
                sub_id = f"{id_val}_{cat.lower()}_{i}"
                
                items.append({
                    'id': sub_id,
                    'date': date_str,
                    'updated': updated_str,
                    'link': sub_link,
                    'category': cat,
                    'content': content,
                    'clean_text': clean_text
                })
                
    return {
        'title': feed_title_text,
        'entries': items,
        'fetched_at': datetime.now().isoformat()
    }

def get_notes(force_refresh=False):
    global cache
    now = datetime.now()
    
    # If cache is valid and not force_refresh, return it (cache lifetime 10 minutes)
    if cache['data'] and cache['last_updated'] and not force_refresh:
        time_diff = (now - cache['last_updated']).total_seconds()
        if time_diff < 600:  # 10 minutes
            return cache['data'], False
            
    try:
        data = parse_release_notes()
        cache['data'] = data
        cache['last_updated'] = now
        return data, True
    except Exception as e:
        # Fallback to cache if request fails
        if cache['data']:
            return cache['data'], False
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def api_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        notes, fetched_new = get_notes(force_refresh)
        return jsonify({
            'success': True,
            'fetched_new': fetched_new,
            'data': notes
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Bind to port 5000 by default
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
