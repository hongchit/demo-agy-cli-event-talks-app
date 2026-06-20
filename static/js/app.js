// State Management
let allReleaseNotes = [];
let filteredNotes = [];
let categoriesSet = new Set();
let currentCategoryFilter = 'all';
let currentTimeFilter = 'all';
let searchQuery = '';

// DOM Elements
const notesGrid = document.getElementById('notes-grid');
const emptyState = document.getElementById('empty-state');
const refreshBtn = document.getElementById('refresh-btn');
const themeToggle = document.getElementById('theme-toggle');
const searchInput = document.getElementById('search-input');
const searchClearBtn = document.getElementById('search-clear-btn');
const categoryFilter = document.getElementById('category-filter');
const timeFilter = document.getElementById('time-filter');
const filterSummary = document.getElementById('filter-summary');
const resetFiltersBtn = document.getElementById('reset-filters-btn');
const clearAllFiltersBtn = document.getElementById('clear-all-filters-btn');

// Stats DOM
const statTotal = document.getElementById('stat-total');
const statFeatures = document.getElementById('stat-features');
const statAnnouncements = document.getElementById('stat-announcements');
const statDeprecations = document.getElementById('stat-deprecations');
const statCards = document.querySelectorAll('.stat-card');

// Modals DOM
const detailModal = document.getElementById('detail-modal');
const tweetModal = document.getElementById('tweet-modal');
const modalCategory = document.getElementById('modal-category');
const modalTitle = document.getElementById('modal-title');
const modalDate = document.getElementById('modal-date');
const modalSourceLink = document.getElementById('modal-source-link');
const modalHtmlContent = document.getElementById('modal-html-content');
const modalTweetBtn = document.getElementById('modal-tweet-btn');
const tweetTextArea = document.getElementById('tweet-text-area');
const charCounter = document.getElementById('char-counter');
const postTweetBtn = document.getElementById('post-tweet-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');

// Active note being viewed/shared
let activeNote = null;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchReleaseNotes();
    setupEventListeners();
});

// Theme Management (Light/Dark Mode)
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeCheckbox = document.getElementById('theme-toggle');
    if (themeCheckbox) {
        themeCheckbox.checked = (savedTheme === 'light');
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    const themeCheckbox = document.getElementById('theme-toggle');
    if (themeCheckbox) {
        themeCheckbox.checked = (newTheme === 'light');
    }
}

// Fetch data from API
async function fetchReleaseNotes(forceRefresh = false) {
    showLoading();
    
    const refreshIcon = refreshBtn.querySelector('.icon-refresh');
    refreshIcon.classList.add('spin');
    refreshBtn.disabled = true;
    
    try {
        const response = await fetch(`/api/notes?refresh=${forceRefresh}`);
        const result = await response.json();
        
        if (result.success && result.data && result.data.entries) {
            allReleaseNotes = result.data.entries;
            
            // Collect categories
            categoriesSet.clear();
            allReleaseNotes.forEach(note => {
                if (note.category) categoriesSet.add(note.category);
            });
            
            populateCategoriesDropdown();
            updateStatsDashboard();
            applyFilters();
        } else {
            showErrorState("Failed to retrieve notes. Please try again.");
        }
    } catch (error) {
        console.error("Error fetching release notes:", error);
        showErrorState("Network error. Check connection and retry.");
    } finally {
        refreshIcon.classList.remove('spin');
        refreshBtn.disabled = false;
    }
}

// UI State Management
function showLoading() {
    notesGrid.innerHTML = `
        <div class="card skeleton-card">
            <div class="skeleton skeleton-tag"></div>
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-date"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton-footer">
                <div class="skeleton skeleton-btn"></div>
                <div class="skeleton skeleton-btn"></div>
            </div>
        </div>
        <div class="card skeleton-card">
            <div class="skeleton skeleton-tag"></div>
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-date"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton-footer">
                <div class="skeleton skeleton-btn"></div>
                <div class="skeleton skeleton-btn"></div>
            </div>
        </div>
        <div class="card skeleton-card">
            <div class="skeleton skeleton-tag"></div>
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-date"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton-footer">
                <div class="skeleton skeleton-btn"></div>
                <div class="skeleton skeleton-btn"></div>
            </div>
        </div>
    `;
    emptyState.hidden = true;
    notesGrid.hidden = false;
}

function showErrorState(message) {
    notesGrid.hidden = true;
    emptyState.hidden = false;
    emptyState.querySelector('h3').textContent = "Something went wrong";
    emptyState.querySelector('p').textContent = message;
}

// Populate Category Filter Dropdown
function populateCategoriesDropdown() {
    // Keep first option "All Categories"
    categoryFilter.innerHTML = '<option value="all">All Categories</option>';
    
    // Sort categories alphabetically
    const sortedCategories = Array.from(categoriesSet).sort();
    sortedCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
    
    // Reset selection to current filter
    categoryFilter.value = currentCategoryFilter;
}

// Update Dashboard Statistics Card Values
function updateStatsDashboard() {
    statTotal.textContent = allReleaseNotes.length;
    
    const featuresCount = allReleaseNotes.filter(n => n.category.toLowerCase() === 'feature').length;
    statFeatures.textContent = featuresCount;
    
    const announcementsCount = allReleaseNotes.filter(n => n.category.toLowerCase() === 'announcement').length;
    statAnnouncements.textContent = announcementsCount;
    
    const deprecationsCount = allReleaseNotes.filter(n => n.category.toLowerCase() === 'deprecation').length;
    statDeprecations.textContent = deprecationsCount;
}

// Filter and Search notes
function applyFilters() {
    filteredNotes = allReleaseNotes.filter(note => {
        // Category Filter
        const matchesCategory = currentCategoryFilter === 'all' || 
                                note.category.toLowerCase() === currentCategoryFilter.toLowerCase();
                                
        // Search Filter
        const matchesSearch = !searchQuery || 
                              note.date.toLowerCase().includes(searchQuery) ||
                              note.category.toLowerCase().includes(searchQuery) ||
                              note.content.toLowerCase().includes(searchQuery);
                              
        // Time Filter (using JS Date calculation)
        let matchesTime = true;
        if (currentTimeFilter !== 'all') {
            const noteDate = new Date(note.updated);
            const today = new Date();
            const timeDiff = Math.abs(today.getTime() - noteDate.getTime());
            const diffDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            matchesTime = diffDays <= parseInt(currentTimeFilter);
        }
        
        return matchesCategory && matchesSearch && matchesTime;
    });
    
    // Manage filter tag banners
    const hasActiveFilters = currentCategoryFilter !== 'all' || currentTimeFilter !== 'all' || searchQuery !== '';
    if (hasActiveFilters) {
        filterSummary.hidden = false;
        filterSummary.querySelector('.summary-text').textContent = 
            `Showing ${filteredNotes.length} of ${allReleaseNotes.length} updates matching filters`;
    } else {
        filterSummary.hidden = true;
    }
    
    renderNotesGrid();
}

// Render Release Notes cards onto DOM
function renderNotesGrid() {
    if (filteredNotes.length === 0) {
        notesGrid.hidden = true;
        emptyState.hidden = false;
        emptyState.querySelector('h3').textContent = "No release notes match your search";
        emptyState.querySelector('p').textContent = "Try clearing your filters or searching for a different keyword.";
        return;
    }
    
    emptyState.hidden = true;
    notesGrid.hidden = false;
    
    notesGrid.innerHTML = '';
    
    filteredNotes.forEach(note => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.setProperty('--badge-color', getCategoryColor(note.category));
        
        // Excerpt generation (removes html and trims)
        let excerpt = note.clean_text;
        if (excerpt.length > 220) {
            excerpt = excerpt.substring(0, 215) + '...';
        }
        
        card.innerHTML = `
            <div class="card-header">
                <span class="badge ${note.category.toLowerCase()}">${note.category}</span>
                <span class="card-date">${note.date}</span>
            </div>
            <h3 class="card-title">${note.date} Update</h3>
            <p class="card-excerpt">${excerpt}</p>
            <div class="card-footer">
                <button class="btn-card-action btn-read-card">Read Details →</button>
                <div class="card-actions-right">
                    <button class="btn-card-action btn-copy-card" title="Copy to clipboard" aria-label="Copy note to clipboard">
                        <!-- Clipboard icon (default state) -->
                        <svg class="icon-copy" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        <!-- Checkmark icon (copied state) -->
                        <svg class="icon-check" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span class="copy-label">Copy</span>
                    </button>
                    <button class="btn-card-action btn-tweet-card" title="Share on Twitter" aria-label="Share on Twitter">
                        <svg class="icon-twitter" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Tweet</span>
                    </button>
                </div>
            </div>
        `;
        
        // Route card clicks: copy → tweet → read details
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-copy-card')) {
                e.stopPropagation();
                const btn = e.target.closest('.btn-copy-card');
                copyToClipboard(note.clean_text, btn);
            } else if (e.target.closest('.btn-tweet-card')) {
                e.stopPropagation();
                openTweetModal(note);
            } else {
                openDetailModal(note);
            }
        });
        
        notesGrid.appendChild(card);
    });
}

// =============================================================================
// copyToClipboard(text, btn)
// =============================================================================
// Uses the modern Clipboard API (navigator.clipboard.writeText) to copy the
// note's clean_text to the user's clipboard.
// Provides visual feedback by toggling the .copied CSS class on the button
// for 2 seconds, swapping the clipboard icon for a green checkmark.
// Falls back gracefully (no-op) on browsers that deny clipboard permission.
async function copyToClipboard(text, btn) {
    try {
        await navigator.clipboard.writeText(text);

        // Visual feedback: swap icon and label to confirmed state
        btn.classList.add('copied');
        const label = btn.querySelector('.copy-label');
        if (label) label.textContent = 'Copied!';

        // Revert after 2 seconds
        setTimeout(() => {
            btn.classList.remove('copied');
            if (label) label.textContent = 'Copy';
        }, 2000);
    } catch (err) {
        console.warn('Clipboard write failed:', err);
    }
}

// =============================================================================
// exportToCSV()
// =============================================================================
// Converts the currently visible (filtered) release notes into a CSV file
// and triggers a browser download.
//
// CSV format:
//   Columns : Date, Category, Summary, Source Link
//   Encoding: UTF-8 with BOM (\uFEFF) so Excel opens it correctly
//   Quoting : All fields are double-quoted; internal quotes are escaped by doubling
//
// The filename includes a timestamp so repeated exports don't overwrite each other.
function exportToCSV() {
    if (filteredNotes.length === 0) return;

    // Helper: wrap a field value in double-quotes and escape internal quotes
    const escapeField = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const headers = ['Date', 'Category', 'Summary', 'Source Link'];
    const rows = filteredNotes.map(note => [
        escapeField(note.date),
        escapeField(note.category),
        escapeField(note.clean_text),
        escapeField(note.link)
    ].join(','));

    // Prepend UTF-8 BOM so Excel auto-detects encoding correctly
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

    // Build a timestamped filename: bq-release-notes-2026-06-19.csv
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename  = `bq-release-notes-${dateStamp}.csv`;

    // Create a temporary object URL and click it programmatically
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    // Clean up: revoke the object URL and remove the temporary anchor
    setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }, 100);
}

// Get CSS color value for categories
function getCategoryColor(category) {
    const cat = category.toLowerCase();
    if (cat === 'feature') return 'var(--color-feature)';
    if (cat === 'announcement') return 'var(--color-announcement)';
    if (cat === 'deprecation') return 'var(--color-deprecation)';
    if (cat === 'changed') return 'var(--color-changed)';
    if (cat === 'fixed') return 'var(--color-fixed)';
    return 'var(--color-general)';
}

// Populate and Open Details Modal
function openDetailModal(note) {
    activeNote = note;
    
    modalCategory.className = `badge ${note.category.toLowerCase()}`;
    modalCategory.textContent = note.category;
    modalTitle.textContent = `${note.date} Update`;
    modalDate.textContent = `Published on ${note.date}`;
    modalSourceLink.href = note.link;
    modalHtmlContent.innerHTML = note.content;
    
    detailModal.showModal();
}

// Populate and Open Tweet Modal
function openTweetModal(note) {
    activeNote = note;
    
    const draftText = composeTweetDraft(note);
    tweetTextArea.value = draftText;
    updateCharCounter();
    
    tweetModal.showModal();
}

// Compose Twitter Draft safely with length constraints
function composeTweetDraft(note) {
    const prefix = `BigQuery ${note.category} (${note.date}): `;
    const hashtags = `\n\n#BigQuery #GoogleCloud`;
    const link = `\n${note.link}`;
    
    // Twitter Web Intent counts any URL as 23 characters
    const urlLength = 23;
    
    // Compute total character limit budget for the description excerpt
    // 280 limit minus static text elements length
    const staticLength = prefix.length + urlLength + hashtags.length;
    const maxExcerpt = 280 - staticLength - 4; // quotes and spacing
    
    let excerpt = note.clean_text;
    if (excerpt.length > maxExcerpt) {
        excerpt = excerpt.substring(0, maxExcerpt - 3) + '...';
    }
    
    return `${prefix}"${excerpt}"${link}${hashtags}`;
}

// Update Character count indicator
function updateCharCounter() {
    const text = tweetTextArea.value;
    
    // Simulate X/Twitter's URL counting behavior: 
    // It shortens any URL starting with http/https to 23 characters.
    const urlRegex = /https?:\/\/[^\s]+/g;
    let computedLength = text.length;
    
    const urls = text.match(urlRegex) || [];
    urls.forEach(url => {
        computedLength = computedLength - url.length + 23;
    });
    
    const charsLeft = 280 - computedLength;
    charCounter.textContent = charsLeft;
    
    // Manage styling classes
    charCounter.className = 'char-counter';
    if (charsLeft < 0) {
        charCounter.classList.add('error');
        postTweetBtn.disabled = true;
    } else {
        postTweetBtn.disabled = false;
        if (charsLeft <= 20) {
            charCounter.classList.add('warning');
        }
    }
}

// Reset filter UI and State
function resetFilters() {
    searchInput.value = '';
    searchClearBtn.hidden = true;
    searchQuery = '';
    
    currentCategoryFilter = 'all';
    categoryFilter.value = 'all';
    
    currentTimeFilter = 'all';
    timeFilter.value = 'all';
    
    // Reset stat cards active style
    statCards.forEach(c => c.classList.remove('active'));
    
    applyFilters();
}

// Set up event listeners
function setupEventListeners() {
    // Refresh, export & theme toggle
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    exportCsvBtn.addEventListener('click', exportToCSV);
    themeToggle.addEventListener('change', toggleTheme);
    
    // Search event
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        searchClearBtn.hidden = searchQuery === '';
        applyFilters();
    });
    
    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchClearBtn.hidden = true;
        searchQuery = '';
        applyFilters();
    });
    
    // Filters select
    categoryFilter.addEventListener('change', (e) => {
        currentCategoryFilter = e.target.value;
        
        // Highlight active stat card if clicked
        statCards.forEach(card => {
            if (card.getAttribute('data-filter').toLowerCase() === currentCategoryFilter.toLowerCase()) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
        
        applyFilters();
    });
    
    timeFilter.addEventListener('change', (e) => {
        currentTimeFilter = e.target.value;
        applyFilters();
    });
    
    // Reset filters buttons
    resetFiltersBtn.addEventListener('click', resetFilters);
    clearAllFiltersBtn.addEventListener('click', resetFilters);
    
    // Stat cards clicks
    statCards.forEach(card => {
        card.addEventListener('click', () => {
            const filterVal = card.getAttribute('data-filter');
            
            // Toggle active state
            statCards.forEach(c => c.classList.remove('active'));
            
            if (currentCategoryFilter === filterVal) {
                // If clicking active, reset to all
                currentCategoryFilter = 'all';
                categoryFilter.value = 'all';
            } else {
                currentCategoryFilter = filterVal;
                categoryFilter.value = filterVal;
                card.classList.add('active');
            }
            
            applyFilters();
        });
    });
    
    // Modal buttons close triggers
    document.querySelectorAll('.modal-dialog').forEach(modal => {
        // Native Close
        modal.querySelectorAll('.close-modal-btn, .btn-close-modal').forEach(btn => {
            btn.addEventListener('click', () => modal.close());
        });
        
        // Light Dismiss (click outside content closes dialog)
        modal.addEventListener('click', (e) => {
            const rect = modal.getBoundingClientRect();
            const isInDialog = (
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom
            );
            if (!isInDialog) {
                modal.close();
            }
        });
    });
    
    // Trigger Tweet Modal from Detail Modal
    modalTweetBtn.addEventListener('click', () => {
        if (activeNote) {
            detailModal.close();
            openTweetModal(activeNote);
        }
    });
    
    // Tweet text area typing monitor
    tweetTextArea.addEventListener('input', updateCharCounter);
    
    // Post to Twitter Web Intent trigger
    postTweetBtn.addEventListener('click', () => {
        const text = tweetTextArea.value;
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
        tweetModal.close();
    });
}
