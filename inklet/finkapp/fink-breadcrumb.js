// FINK Breadcrumb Widget - Tracks and displays knot navigation path
// Integrated with FinkNavigation for deep link generation
// Tracks HIERARCHICAL nesting across FINK file transitions
// Each FINK is a "level" - supports nested multipart stories
window.FinkBreadcrumb = {
    // Configuration
    maxVisibleKnots: 6,
    maxUrlLength: 25,

    // State - HIERARCHICAL structure for nested FINK levels
    // finkStack is an array where each entry represents a level in the hierarchy:
    // [
    //   { url: 'toc.fink.js', knots: [{name: 'main_menu'}, ...] },      // Level 0
    //   { url: 'bagend.fink.js', knots: [{name: 'Kitchen'}, ...] },     // Level 1
    //   { url: 'diamonds.fink.js', knots: [{name: 'cave'}, ...] }       // Level 2 (current)
    // ]
    finkStack: [],          // Stack of {url, knots[]} representing hierarchy
    isExpanded: false,

    // Computed properties for backwards compatibility
    get currentFinkUrl() {
        const current = this.finkStack[this.finkStack.length - 1];
        return current ? current.url : null;
    },
    get knotPath() {
        const current = this.finkStack[this.finkStack.length - 1];
        return current ? current.knots : [];
    },
    get finkHistory() {
        // Return all but the last entry (for backwards compatibility)
        return this.finkStack.slice(0, -1);
    },

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
    // HIERARCHICAL: Pushes a new level onto the finkStack
    setFinkUrl(url) {
        FinkUtils.debugLog('Breadcrumb setFinkUrl called with: ' + url);
        FinkUtils.debugLog('Breadcrumb current stack: [' + this.finkStack.map(l => this.formatUrl(l.url)).join(', ') + ']');

        // Check if this URL is already the current level (avoid duplicates)
        const currentLevel = this.finkStack[this.finkStack.length - 1];
        if (currentLevel && currentLevel.url === url) {
            FinkUtils.debugLog('Breadcrumb: URL already current level, skipping: ' + url);
            return;
        }

        // Push a new level onto the stack
        this.finkStack.push({
            url: url,
            knots: [],
            timestamp: Date.now()
        });

        FinkUtils.debugLog('Breadcrumb: New FINK level ' + (this.finkStack.length - 1) + ': ' + this.formatUrl(url));
        FinkUtils.debugLog('Breadcrumb: Stack is now: [' + this.finkStack.map(l => this.formatUrl(l.url)).join(', ') + ']');

        // Limit stack depth to prevent unbounded growth (10 levels deep should be plenty)
        if (this.finkStack.length > 10) {
            this.finkStack.shift();
            FinkUtils.debugLog('Breadcrumb: Trimmed oldest level to maintain max depth');
        }

        this.render();
    },

    // Record navigation to a knot within the current FINK level
    recordKnot(knotName) {
        if (!knotName || knotName.startsWith('_')) return; // Skip internal knots

        // Ensure we have a current level
        if (this.finkStack.length === 0) {
            FinkUtils.debugLog('Breadcrumb: No current level to record knot: ' + knotName);
            return;
        }

        const currentLevel = this.finkStack[this.finkStack.length - 1];

        // Avoid duplicate consecutive knots
        const lastKnot = currentLevel.knots[currentLevel.knots.length - 1];
        if (lastKnot && lastKnot.name === knotName) return;

        currentLevel.knots.push({
            name: knotName,
            timestamp: Date.now()
        });

        // Keep path manageable (last 20 knots per level)
        if (currentLevel.knots.length > 20) {
            currentLevel.knots.shift();
        }

        FinkUtils.debugLog('Breadcrumb: Recorded knot at level ' + (this.finkStack.length - 1) + ': ' + knotName);
        this.render();
    },

    // Clear the knot path of current level (used when restarting)
    clearPath() {
        if (this.finkStack.length > 0) {
            this.finkStack[this.finkStack.length - 1].knots = [];
        }
        this.render();
    },

    // Clear entire stack (used when returning to main menu)
    clearHistory() {
        this.finkStack = [];
        FinkUtils.debugLog('Breadcrumb: Stack cleared');
        this.render();
    },

    // Navigate back to a previous FINK level in the hierarchy
    // levelIndex is the index in the finkStack (0 = root, 1 = first child, etc.)
    async navigateBackToFink(levelIndex) {
        if (levelIndex < 0 || levelIndex >= this.finkStack.length) return;

        const target = this.finkStack[levelIndex];
        FinkUtils.debugLog('Breadcrumb: Navigating back to level ' + levelIndex + ': ' + target.url);

        // Get the last knot from that level for restoration
        const lastKnot = target.knots.length > 0 ? target.knots[target.knots.length - 1].name : null;

        // Pop all levels above the target (keep target and below)
        this.finkStack = this.finkStack.slice(0, levelIndex + 1);

        // Clear sandbox duplicate load prevention to allow reload
        if (window.FinkSandbox) {
            FinkSandbox.clearLoadRecord(target.url);
        }

        // Load the target FINK file
        if (window.FinkPlayer) {
            await FinkPlayer.loadFinkStory(target.url);

            // After loading, try to navigate to the last knot
            if (lastKnot && window.FinkInkEngine && FinkInkEngine.story) {
                setTimeout(() => {
                    try {
                        FinkInkEngine.story.ChoosePathString(lastKnot);
                        FinkUI.clearStory();
                        FinkUI.clearChoices();
                        FinkInkEngine.continueStory();
                        FinkUtils.debugLog('Breadcrumb: Restored to knot: ' + lastKnot);
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

    // Navigate to a specific knot in the current level
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

            // Update path to this point in current level
            if (this.finkStack.length > 0) {
                const currentLevel = this.finkStack[this.finkStack.length - 1];
                const knotIndex = currentLevel.knots.findIndex(k => k.name === knotName);
                if (knotIndex >= 0) {
                    // Trim path to the clicked knot
                    currentLevel.knots = currentLevel.knots.slice(0, knotIndex + 1);
                }
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
        FinkUtils.debugLog('Breadcrumb: Copying URL: ' + url);

        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(url);
                this.showToast('🔗 Link copied!');
                return;
            } catch (err) {
                FinkUtils.debugLog('Breadcrumb: Clipboard API failed: ' + err.message);
                // Fall through to fallback
            }
        }

        // Fallback: use execCommand (works in more contexts)
        try {
            const textarea = document.createElement('textarea');
            textarea.value = url;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);

            if (success) {
                this.showToast('🔗 Link copied!');
            } else {
                throw new Error('execCommand failed');
            }
        } catch (err) {
            FinkUtils.debugLog('Breadcrumb: Copy fallback failed: ' + err.message);
            // Last resort: show URL for manual copy
            this.showToast('Copy manually: ' + url.slice(-30));
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

        // Update URL display - show hierarchy trail when collapsed
        if (this.elements.urlDisplay) {
            if (this.finkStack.length === 0) {
                this.elements.urlDisplay.textContent = 'No story loaded';
                this.elements.urlDisplay.title = '';
                FinkUtils.debugLog('Breadcrumb render: No story loaded');
            } else if (this.finkStack.length === 1) {
                // Single level - just show the name
                const displayUrl = this.formatUrl(this.currentFinkUrl);
                this.elements.urlDisplay.textContent = displayUrl;
                this.elements.urlDisplay.title = this.currentFinkUrl || '';
                FinkUtils.debugLog('Breadcrumb render: Single level - ' + displayUrl);
            } else {
                // Multiple levels - show breadcrumb trail
                const trail = this.finkStack.map(level => this.formatUrl(level.url)).join(' › ');
                this.elements.urlDisplay.textContent = trail;
                this.elements.urlDisplay.title = this.finkStack.map(l => l.url).join(' → ');
                FinkUtils.debugLog('Breadcrumb render: Multi-level trail - ' + trail);
                FinkUtils.debugLog('Breadcrumb render: Stack URLs - ' + this.finkStack.map(l => l.url).join(' | '));
            }
        }

        // Update knot list
        if (this.elements.knotList) {
            this.renderKnots();
        }
    },

    // Render the knot list - HIERARCHICAL nested display
    // Shows each FINK as a level with its knots indented beneath it
    renderKnots() {
        const container = this.elements.knotList;
        container.innerHTML = '';

        if (this.finkStack.length === 0) {
            container.innerHTML = '<span class="breadcrumb-empty">Start navigating...</span>';
            return;
        }

        // Render each level in the hierarchy
        this.finkStack.forEach((level, levelIndex) => {
            const isCurrentLevel = levelIndex === this.finkStack.length - 1;
            const indentPx = levelIndex * 12;  // 12px indent per level

            // Create level container with indentation
            const levelDiv = document.createElement('div');
            levelDiv.className = 'breadcrumb-level';
            levelDiv.style.marginLeft = indentPx + 'px';

            // FINK name row
            const finkRow = document.createElement('div');
            finkRow.className = 'breadcrumb-fink-entry' + (isCurrentLevel ? ' breadcrumb-current' : ' breadcrumb-history');

            // FINK name with icon
            const finkName = document.createElement('span');
            finkName.className = 'breadcrumb-fink-name' + (isCurrentLevel ? ' breadcrumb-fink-current' : '');
            const formattedName = this.formatUrl(level.url);
            finkName.textContent = (isCurrentLevel ? '📖 ' : '📁 ') + formattedName;
            finkName.title = isCurrentLevel ? 'Current story: ' + level.url : `Return to ${formattedName}`;
            FinkUtils.debugLog(`Breadcrumb renderKnots: Level ${levelIndex} - URL: ${level.url} → Display: "${formattedName}" (current: ${isCurrentLevel})`);

            // Make parent levels clickable
            if (!isCurrentLevel) {
                // Capture URL at render time for comparison
                const urlAtRenderTime = level.url;
                finkName.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const urlAtClickTime = this.finkStack[levelIndex]?.url;
                    FinkUtils.debugLog(`Breadcrumb CLICK: levelIndex=${levelIndex}`);
                    FinkUtils.debugLog(`Breadcrumb CLICK: URL at render time: ${urlAtRenderTime}`);
                    FinkUtils.debugLog(`Breadcrumb CLICK: URL at click time: ${urlAtClickTime}`);
                    FinkUtils.debugLog(`Breadcrumb CLICK: Current stack: [${this.finkStack.map(l => this.formatUrl(l.url)).join(', ')}]`);
                    if (urlAtRenderTime !== urlAtClickTime) {
                        FinkUtils.debugLog(`Breadcrumb CLICK: ⚠️ URL MISMATCH! Stack changed since render.`);
                    }
                    this.navigateBackToFink(levelIndex);
                });
            }
            finkRow.appendChild(finkName);
            levelDiv.appendChild(finkRow);

            // Render knots for this level
            if (level.knots.length > 0) {
                const knotContainer = document.createElement('div');
                knotContainer.className = 'breadcrumb-knot-list';
                knotContainer.style.marginLeft = '8px';  // Additional indent for knots

                // Determine which knots to show
                let visibleKnots = level.knots;
                let truncated = false;

                if (level.knots.length > this.maxVisibleKnots) {
                    truncated = true;
                    visibleKnots = level.knots.slice(-this.maxVisibleKnots);
                }

                // Add truncation indicator
                if (truncated) {
                    const ellipsis = document.createElement('span');
                    ellipsis.className = 'breadcrumb-ellipsis';
                    ellipsis.textContent = `[${level.knots.length - this.maxVisibleKnots} earlier]`;
                    ellipsis.title = `${level.knots.length - this.maxVisibleKnots} earlier knots`;
                    knotContainer.appendChild(ellipsis);
                }

                // Add knot items with tree-like structure
                visibleKnots.forEach((knot, knotIndex) => {
                    const knotRow = document.createElement('div');
                    knotRow.className = 'breadcrumb-knot-row';

                    // Determine tree marker
                    const isLastKnot = knotIndex === visibleKnots.length - 1;
                    const hasChildLevel = levelIndex < this.finkStack.length - 1;

                    const marker = document.createElement('span');
                    marker.className = 'breadcrumb-tree-marker';
                    // If this is the last knot and there's a child level, show connector
                    if (isLastKnot && hasChildLevel) {
                        marker.textContent = '├─ ';
                    } else {
                        marker.textContent = isLastKnot ? '└─ ' : '├─ ';
                    }
                    knotRow.appendChild(marker);

                    // Knot name (clickable to navigate, but only for current level)
                    const knotNameSpan = document.createElement('span');
                    knotNameSpan.className = 'breadcrumb-knot-name';
                    knotNameSpan.textContent = knot.name;

                    if (isCurrentLevel) {
                        knotNameSpan.title = `Navigate to ${knot.name}`;
                        knotNameSpan.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.navigateToKnot(knot.name);
                        });
                    } else {
                        knotNameSpan.title = `Was at: ${knot.name}`;
                        knotNameSpan.style.opacity = '0.7';
                    }
                    knotRow.appendChild(knotNameSpan);

                    // Link icon (only for current level)
                    if (isCurrentLevel) {
                        const linkIcon = document.createElement('span');
                        linkIcon.className = 'breadcrumb-link-icon';
                        linkIcon.textContent = '🔗';
                        linkIcon.title = `Copy link to ${knot.name}`;
                        linkIcon.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.copyKnotUrl(knot.name);
                        });
                        knotRow.appendChild(linkIcon);
                    }

                    knotContainer.appendChild(knotRow);
                });

                levelDiv.appendChild(knotContainer);
            }

            // Add arrow connector to next level (if not last level)
            if (!isCurrentLevel) {
                const arrow = document.createElement('div');
                arrow.className = 'breadcrumb-arrow';
                arrow.style.marginLeft = (indentPx + 8) + 'px';
                arrow.textContent = '↓';
                levelDiv.appendChild(arrow);
            }

            container.appendChild(levelDiv);
        });
    }
};
