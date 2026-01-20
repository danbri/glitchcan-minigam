// FINK Breadcrumb Widget - Tracks and displays knot navigation path
// Integrated with FinkNavigation for deep link generation
// Tracks hierarchy across FINK file transitions
window.FinkBreadcrumb = {
    // Configuration
    maxVisibleKnots: 6,
    maxUrlLength: 25,

    // State - ENHANCED for cross-FINK tracking
    knotPath: [],           // Current FINK's knot path
    currentFinkUrl: null,   // Current FINK URL
    finkHistory: [],        // Stack of {url, knots, lastKnot} for visited FINKs
    isExpanded: false,

    // DOM elements
    elements: {},

    // Initialize the breadcrumb widget
    init() {
        this.elements = {
            container: document.getElementById('breadcrumb-container'),
            toggle: document.getElementById('breadcrumb-toggle'),
            content: document.getElementById('breadcrumb-content'),
            urlDisplay: document.getElementById('breadcrumb-url'),
            knotList: document.getElementById('breadcrumb-knots')
        };

        if (!this.elements.container) {
            FinkUtils.debugLog('Breadcrumb: No container found, skipping init');
            return;
        }

        this.setupEventListeners();
        FinkUtils.debugLog('Breadcrumb: Initialized');
    },

    // Set up event listeners
    setupEventListeners() {
        if (this.elements.toggle) {
            this.elements.toggle.addEventListener('click', () => this.toggleExpanded());
        }

        // Click outside to collapse
        document.addEventListener('click', (e) => {
            if (this.isExpanded &&
                this.elements.container &&
                !this.elements.container.contains(e.target)) {
                this.collapse();
            }
        });
    },

    // Toggle expanded state
    toggleExpanded() {
        this.isExpanded = !this.isExpanded;
        this.render();
    },

    // Expand the breadcrumb
    expand() {
        this.isExpanded = true;
        this.render();
    },

    // Collapse the breadcrumb
    collapse() {
        this.isExpanded = false;
        this.render();
    },

    // Record a new FINK file being loaded
    // ENHANCED: Saves previous FINK context to history stack
    setFinkUrl(url) {
        // Save current FINK context to history before switching
        if (this.currentFinkUrl && this.knotPath.length > 0) {
            // Only save if we have actual navigation history
            const lastKnot = this.knotPath[this.knotPath.length - 1];
            this.finkHistory.push({
                url: this.currentFinkUrl,
                knots: [...this.knotPath],  // Clone the array
                lastKnot: lastKnot ? lastKnot.name : null,
                timestamp: Date.now()
            });
            FinkUtils.debugLog('Breadcrumb: Saved to history: ' + this.formatUrl(this.currentFinkUrl) +
                              ' (' + this.knotPath.length + ' knots)');

            // Limit history stack to prevent unbounded growth
            if (this.finkHistory.length > 10) {
                this.finkHistory.shift();
            }
        }

        this.currentFinkUrl = url;
        this.knotPath = []; // Reset knot path for new story
        FinkUtils.debugLog('Breadcrumb: New FINK URL: ' + url);
        this.render();
    },

    // Record navigation to a knot
    recordKnot(knotName) {
        if (!knotName || knotName.startsWith('_')) return; // Skip internal knots

        // Avoid duplicate consecutive knots
        const lastKnot = this.knotPath[this.knotPath.length - 1];
        if (lastKnot && lastKnot.name === knotName) return;

        const timestamp = Date.now();
        this.knotPath.push({
            name: knotName,
            timestamp: timestamp
        });

        // Keep path manageable (last 20 knots)
        if (this.knotPath.length > 20) {
            this.knotPath.shift();
        }

        FinkUtils.debugLog('Breadcrumb: Recorded knot: ' + knotName);
        this.render();
    },

    // Clear the knot path (used when restarting)
    clearPath() {
        this.knotPath = [];
        this.render();
    },

    // Clear entire history (used when returning to main menu)
    clearHistory() {
        this.knotPath = [];
        this.finkHistory = [];
        this.currentFinkUrl = null;
        FinkUtils.debugLog('Breadcrumb: History cleared');
        this.render();
    },

    // Navigate back to a previous FINK in history
    async navigateBackToFink(historyIndex) {
        if (historyIndex < 0 || historyIndex >= this.finkHistory.length) return;

        const target = this.finkHistory[historyIndex];
        FinkUtils.debugLog('Breadcrumb: Navigating back to: ' + target.url);

        // Remove this and all subsequent entries from history
        this.finkHistory = this.finkHistory.slice(0, historyIndex);

        // Load the target FINK file
        if (window.FinkPlayer) {
            // Don't call setFinkUrl - it will be called when story loads
            this.currentFinkUrl = null;  // Clear to prevent double-save
            this.knotPath = [];
            await FinkPlayer.loadFinkStory(target.url);

            // After loading, try to navigate to the last knot
            if (target.lastKnot && window.FinkInkEngine && FinkInkEngine.story) {
                setTimeout(() => {
                    try {
                        FinkInkEngine.story.ChoosePathString(target.lastKnot);
                        FinkUI.clearStory();
                        FinkUI.clearChoices();
                        FinkInkEngine.continueStory();
                        FinkUtils.debugLog('Breadcrumb: Restored to knot: ' + target.lastKnot);
                    } catch (e) {
                        FinkUtils.debugLog('Breadcrumb: Could not restore knot: ' + e.message);
                    }
                }, 100);
            }
        }

        this.collapse();
    },

    // Generate abbreviated URL display
    formatUrl(url) {
        if (!url) return '';

        try {
            // Extract filename from URL
            const urlObj = new URL(url, window.location.href);
            let filename = urlObj.pathname.split('/').pop() || url;

            // Remove .fink.js extension for cleaner display
            filename = filename.replace(/\.fink\.js$/, '').replace(/\.js$/, '');

            // Truncate if too long
            if (filename.length > this.maxUrlLength) {
                return '[...]' + filename.slice(-this.maxUrlLength);
            }

            return filename;
        } catch (e) {
            // Fallback for malformed URLs
            const filename = url.split('/').pop() || url;
            return filename.length > this.maxUrlLength
                ? '[...]' + filename.slice(-this.maxUrlLength)
                : filename;
        }
    },

    // Generate deep link URL for a knot using FinkNavigation
    async generateKnotUrl(knotName) {
        // Use FinkNavigation's two-part hash format (preferred)
        if (window.FinkNavigation) {
            // Ensure FinkNavigation has the current FINK URI
            if (!FinkNavigation.currentFinkUri && this.currentFinkUrl) {
                FinkUtils.debugLog('Breadcrumb: FinkNavigation.currentFinkUri not set, using breadcrumb URL');
            }

            const shareLink = await FinkNavigation.generateShareLink(knotName, false);
            if (shareLink) {
                FinkUtils.debugLog('Breadcrumb: Generated share link: ' + shareLink);
                return shareLink;
            } else {
                FinkUtils.debugLog('Breadcrumb: generateShareLink returned null');
            }
        }

        // Fallback: generate two-part hash manually if we have the FINK URL
        if (this.currentFinkUrl && window.FinkNavigation) {
            try {
                const urlHash = await FinkNavigation.generateUrlHash(this.currentFinkUrl);
                const knotHash = await FinkNavigation.generateKnotHash(knotName);
                const baseUrl = new URL(window.location.href);
                baseUrl.hash = `${urlHash}-${knotHash}`;
                baseUrl.search = '';  // Clear any query params
                FinkUtils.debugLog('Breadcrumb: Fallback link: ' + baseUrl.toString());
                return baseUrl.toString();
            } catch (e) {
                FinkUtils.debugLog('Breadcrumb: Fallback hash generation failed: ' + e.message);
            }
        }

        // Last resort: just return current page URL (link won't deep link properly)
        FinkUtils.debugLog('Breadcrumb: Using current URL as fallback (no deep linking)');
        return window.location.href;
    },

    // Navigate to a specific knot
    navigateToKnot(knotName) {
        if (!window.FinkInkEngine || !FinkInkEngine.story) {
            FinkUtils.debugLog('Breadcrumb: Cannot navigate - no story loaded');
            return;
        }

        try {
            FinkUtils.debugLog('Breadcrumb: Navigating to knot: ' + knotName);
            FinkInkEngine.story.ChoosePathString(knotName);

            if (window.FinkUI) {
                FinkUI.clearStory();
                FinkUI.clearChoices();
            }

            FinkInkEngine.continueStory();

            // Update path to this point
            const knotIndex = this.knotPath.findIndex(k => k.name === knotName);
            if (knotIndex >= 0) {
                // Trim path to the clicked knot
                this.knotPath = this.knotPath.slice(0, knotIndex + 1);
            }

            this.collapse();
        } catch (error) {
            FinkUtils.debugLog('Breadcrumb: Navigation error: ' + error.message);
            if (window.FinkUI) {
                FinkUI.showStatus('Cannot navigate to ' + knotName);
            }
        }
    },

    // Copy knot URL to clipboard
    async copyKnotUrl(knotName) {
        const url = await this.generateKnotUrl(knotName);
        try {
            await navigator.clipboard.writeText(url);
            this.showToast('🔗 Link copied!');
        } catch (err) {
            FinkUtils.debugLog('Breadcrumb: Copy failed: ' + err.message);
            this.showToast('Copy failed');
        }
    },

    // Show a brief toast notification
    showToast(message) {
        // Remove any existing toast
        const existingToast = document.querySelector('.breadcrumb-toast');
        if (existingToast) {
            existingToast.remove();
        }

        // Create new toast
        const toast = document.createElement('div');
        toast.className = 'breadcrumb-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        // Auto-remove after animation
        setTimeout(() => toast.remove(), 1500);
    },

    // Render the breadcrumb widget
    render() {
        if (!this.elements.container) return;

        // Update container class
        this.elements.container.classList.toggle('expanded', this.isExpanded);

        // Update toggle arrow
        if (this.elements.toggle) {
            this.elements.toggle.textContent = this.isExpanded ? '▼' : '▶';
            this.elements.toggle.title = this.isExpanded ? 'Collapse' : 'Show navigation path';
        }

        // Update URL display
        if (this.elements.urlDisplay) {
            const displayUrl = this.formatUrl(this.currentFinkUrl);
            this.elements.urlDisplay.textContent = displayUrl || 'No story loaded';
            this.elements.urlDisplay.title = this.currentFinkUrl || '';
        }

        // Update knot list
        if (this.elements.knotList) {
            this.renderKnots();
        }
    },

    // Render the knot list - ENHANCED for cross-FINK hierarchy
    renderKnots() {
        const container = this.elements.knotList;
        container.innerHTML = '';

        // Check if we have any navigation history
        const hasHistory = this.finkHistory.length > 0;
        const hasCurrentKnots = this.knotPath.length > 0;

        if (!hasHistory && !hasCurrentKnots) {
            container.innerHTML = '<span class="breadcrumb-empty">Start navigating...</span>';
            return;
        }

        // Render FINK history entries first (shows path to current story)
        this.finkHistory.forEach((entry, index) => {
            const finkEntry = document.createElement('div');
            finkEntry.className = 'breadcrumb-fink-entry breadcrumb-history';

            // FINK name with click to go back
            const finkName = document.createElement('span');
            finkName.className = 'breadcrumb-fink-name';
            finkName.textContent = '📁 ' + this.formatUrl(entry.url);
            finkName.title = `Return to ${this.formatUrl(entry.url)}`;
            finkName.addEventListener('click', (e) => {
                e.stopPropagation();
                this.navigateBackToFink(index);
            });
            finkEntry.appendChild(finkName);

            // Show last knot visited in this FINK
            if (entry.lastKnot) {
                const lastKnotSpan = document.createElement('span');
                lastKnotSpan.className = 'breadcrumb-last-knot';
                lastKnotSpan.textContent = ' → ' + entry.lastKnot;
                finkEntry.appendChild(lastKnotSpan);
            }

            container.appendChild(finkEntry);

            // Arrow separator between history entries
            const arrow = document.createElement('div');
            arrow.className = 'breadcrumb-arrow';
            arrow.textContent = '↓';
            container.appendChild(arrow);
        });

        // Render current FINK and its knots
        if (this.currentFinkUrl) {
            const currentEntry = document.createElement('div');
            currentEntry.className = 'breadcrumb-fink-entry breadcrumb-current';

            // Current FINK name (highlighted)
            const finkName = document.createElement('span');
            finkName.className = 'breadcrumb-fink-name breadcrumb-fink-current';
            finkName.textContent = '📖 ' + this.formatUrl(this.currentFinkUrl);
            finkName.title = 'Current story: ' + this.currentFinkUrl;
            currentEntry.appendChild(finkName);
            container.appendChild(currentEntry);
        }

        // Render knots in current FINK
        if (hasCurrentKnots) {
            const knotContainer = document.createElement('div');
            knotContainer.className = 'breadcrumb-knot-list';

            // Determine which knots to show
            let visibleKnots = this.knotPath;
            let truncated = false;

            if (this.knotPath.length > this.maxVisibleKnots) {
                truncated = true;
                visibleKnots = this.knotPath.slice(-this.maxVisibleKnots);
            }

            // Add truncation indicator
            if (truncated) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'breadcrumb-ellipsis';
                ellipsis.textContent = `[${this.knotPath.length - this.maxVisibleKnots} earlier]`;
                ellipsis.title = `${this.knotPath.length - this.maxVisibleKnots} earlier knots`;
                knotContainer.appendChild(ellipsis);
            }

            // Add knot items with tree-like structure
            visibleKnots.forEach((knot, index) => {
                const knotRow = document.createElement('div');
                knotRow.className = 'breadcrumb-knot-row';

                // Indentation/tree marker
                const marker = document.createElement('span');
                marker.className = 'breadcrumb-tree-marker';
                marker.textContent = index === visibleKnots.length - 1 ? '└─ ' : '├─ ';
                knotRow.appendChild(marker);

                // Knot name (clickable to navigate)
                const knotNameSpan = document.createElement('span');
                knotNameSpan.className = 'breadcrumb-knot-name';
                knotNameSpan.textContent = knot.name;
                knotNameSpan.title = `Navigate to ${knot.name}`;
                knotNameSpan.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.navigateToKnot(knot.name);
                });
                knotRow.appendChild(knotNameSpan);

                // Link icon (clickable to copy URL)
                const linkIcon = document.createElement('span');
                linkIcon.className = 'breadcrumb-link-icon';
                linkIcon.textContent = '🔗';
                linkIcon.title = `Copy link to ${knot.name}`;
                linkIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.copyKnotUrl(knot.name);
                });
                knotRow.appendChild(linkIcon);

                knotContainer.appendChild(knotRow);
            });

            container.appendChild(knotContainer);
        }
    }
};
