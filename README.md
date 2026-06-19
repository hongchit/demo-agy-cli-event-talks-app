# BigQuery Release Notes Explorer

A high-fidelity, interactive dashboard and RSS/Atom feed reader built using Python Flask and plain vanilla web technologies (HTML, CSS, JavaScript).

This application fetches official BigQuery Release Notes, structures the feed, and provides features to search, filter, and share updates on X (Twitter).

---

## 🌟 Key Features

*   **Granular Update Splitting:** Automatically parses Google Cloud's daily grouped release logs into distinct records (Features, Announcements, Deprecations, Fixes, etc.), allowing you to search, view, and share specific items.
*   **Deep Filtering & Instant Search:** Filter updates by date range, release categories, or search content instantly. The statistics dashboard counters act as interactive filter pills.
*   **Premium Visual Experience:** Fully supports Light & Dark themes, glassmorphism cards, dynamic visual glow spheres, smooth transitions, and animated skeleton loading indicators.
*   **Top-Layer Modals:** Uses native HTML `<dialog>` modals styled with CSS transition variables and `@starting-style` entries.
*   **Draft Tweet Generator:** Pre-composes a tweet containing the update excerpt, hashtags, and release note link. Includes a live character counter that simulates Twitter/X's 23-character URL limit and truncates text safely.
*   **Server-Side Cache:** Implements a 10-minute in-memory caching system to prevent throttling, with a force-refresh trigger.

---

## 📂 Project Structure

```text
bq-releases-notes/
├── docs/
│   ├── implementation_plan.md  # Architecture, data flow & decisions
│   └── tasks.md                # Completed items, active status & backlog
├── static/
│   ├── css/
│   │   └── style.css           # Grid layouts, glassmorphism, themes & animations
│   └── js/
│       └── app.js              # State controls, search logic & Twitter composers
├── templates/
│   └── index.html              # Core HTML structure, templates & modals
├── venv/                       # Local Python virtual environment
├── .gitignore                  # Git exclude configurations
├── app.py                      # Flask backend feed fetcher, parser & server
└── README.md                   # Project overview & running instructions
```

---

## 📖 Project Documentation

Detailed system planning and roadmap files are saved locally:
*   📄 **[Implementation & Architecture Plan](docs/implementation_plan.md)**: Outlines details about backend XML parsing, CSS layouts, modal dialog transition rules, and character safety calculations.
*   📄 **[Project Tasks & Roadmap Tracker](docs/tasks.md)**: Lists completed milestones, running server PIDs, and future enhancement backlogs (Slack integrations, SQLite historical archive, OS notifications).

---

## 🚀 Quick Start Guide

### 1. Prerequisites
Ensure you have **Python 3.10+** installed on your machine.

### 2. Installation & Run
Run the following commands in your terminal:

```bash
# Clone or navigate to the project directory
cd bq-releases-notes

# Activate python virtual environment
source venv/bin/activate

# Install Flask if not already installed (venv should already have it)
pip install Flask

# Run the server on port 5001 (Port 5000 is occupied by AirPlay on macOS)
PORT=5001 python app.py
```

### 3. Open in Browser
Open your browser and navigate to:
👉 **[http://localhost:5001](http://localhost:5001)**
