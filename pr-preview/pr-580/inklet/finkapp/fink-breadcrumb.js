// FINK Breadcrumb Widget - Tracks and displays knot navigation path
// Integrated with FinkNavigation for deep link generation
window.FinkBreadcrumb = {
    // Configuration
    maxVisibleKnots: 6,
    maxUrlLength: 25,

    // State
    knotPath: [],
    currentFinkUrl: null,
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
    setFinkUrl(url) {
        this.currentFinkUrl = url;
        this.knotPath = []; // Reset knot path when loading new story
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
        // Use FinkNavigation's two-part hash format if available
        if (window.FinkNavigation && this.currentFinkUrl) {
            const shareLink = await FinkNavigation.generateShareLink(knotName, false);
            if (shareLink) return shareLink;
        }

        // Fallback to simple URL params
        const baseUrl = new URL(window.location.href);
        baseUrl.hash = '';
        baseUrl.searchParams.set('story', this.currentFinkUrl || '');
        baseUrl.searchParams.set('knot', knotName);
        return baseUrl.toString();
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

    // Render the knot list
    renderKnots() {
        const container = this.elements.knotList;
        container.innerHTML = '';

        if (this.knotPath.length === 0) {
            container.innerHTML = '<span class="breadcrumb-empty">Start navigating...</span>';
            return;
        }

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
            ellipsis.textContent = '[...]';
            ellipsis.title = `${this.knotPath.length - this.maxVisibleKnots} earlier knots`;
            container.appendChild(ellipsis);
        }

        // Add knot items
        visibleKnots.forEach((knot, index) => {
            if (index > 0 || truncated) {
                const separator = document.createElement('span');
                separator.className = 'breadcrumb-separator';
                separator.textContent = ' | ';
                container.appendChild(separator);
            }

            const knotItem = document.createElement('span');
            knotItem.className = 'breadcrumb-knot';

            // Knot name (clickable to navigate)
            const knotName = document.createElement('span');
            knotName.className = 'breadcrumb-knot-name';
            knotName.textContent = knot.name;
            knotName.title = `Navigate to ${knot.name}`;
            knotName.addEventListener('click', (e) => {
                e.stopPropagation();
                this.navigateToKnot(knot.name);
            });
            knotItem.appendChild(knotName);

            // Link icon (clickable to copy URL)
            const linkIcon = document.createElement('span');
            linkIcon.className = 'breadcrumb-link-icon';
            linkIcon.textContent = '🔗';
            linkIcon.title = `Copy link to ${knot.name}`;
            linkIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.copyKnotUrl(knot.name);
            });
            knotItem.appendChild(linkIcon);

            container.appendChild(knotItem);
        });
    }
};
