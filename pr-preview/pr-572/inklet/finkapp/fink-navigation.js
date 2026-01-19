// FINK Navigation - Modern Navigation API for deep linking
// Uses the Navigation API (2022+) with fallback to hash-based navigation

window.FinkNavigation = {
    // Configuration
    config: {
        salt: 'glitchcan-fink-v1',
        hashLength: 8
    },

    // State
    initialized: false,
    currentFinkUri: null,
    knotIdMap: new Map(), // fragmentId -> knotName
    usingNavigationAPI: false,

    // Initialize the navigation system
    init() {
        if (this.initialized) return;

        // Check for modern Navigation API support
        this.usingNavigationAPI = 'navigation' in window;

        if (this.usingNavigationAPI) {
            this.log('Using modern Navigation API');
            this.setupNavigationAPI();
        } else {
            this.log('Falling back to hash-based navigation');
            this.setupHashNavigation();
        }

        this.initialized = true;
    },

    // Setup modern Navigation API
    setupNavigationAPI() {
        navigation.addEventListener('navigate', (event) => {
            // Only handle same-origin navigations
            if (!event.canIntercept || event.hashChange) {
                // Let hash changes through to our handler
                return;
            }

            const url = new URL(event.destination.url);
            const fragmentId = url.hash.slice(1);

            if (fragmentId && this.knotIdMap.has(fragmentId)) {
                event.intercept({
                    handler: async () => {
                        await this.navigateToKnotById(fragmentId);
                    }
                });
            }
        });

        // Also handle hash changes for backwards compatibility
        this.setupHashNavigation();
    },

    // Setup hash-based navigation (fallback)
    setupHashNavigation() {
        window.addEventListener('hashchange', async (event) => {
            const fragmentId = window.location.hash.slice(1);
            if (fragmentId && this.knotIdMap.has(fragmentId)) {
                await this.navigateToKnotById(fragmentId);
            }
        });
    },

    // Generate a unique knot ID using SHA-256
    async generateKnotId(finkUri, knotName) {
        const data = `${this.config.salt}:${finkUri}:${knotName}`;
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex.slice(0, this.config.hashLength);
    },

    // Check if a knot is public (doesn't start with underscore)
    isPublicKnot(knotName) {
        return !knotName.startsWith('_');
    },

    // Get all public knots from a story
    getPublicKnots(story) {
        if (!story || !story.mainContentContainer || !story.mainContentContainer.namedContent) {
            return [];
        }

        const namedContent = story.mainContentContainer.namedContent;
        let knotNames;

        // inkjs 2.x uses Map for namedContent, older versions use plain object
        if (namedContent instanceof Map) {
            knotNames = Array.from(namedContent.keys());
        } else if (typeof namedContent === 'object') {
            knotNames = Object.keys(namedContent);
        } else {
            return [];
        }

        return knotNames.filter(name => this.isPublicKnot(name));
    },

    // Build the knot ID map for a loaded story
    async buildKnotIdMap(story, finkUri) {
        this.currentFinkUri = finkUri;
        this.knotIdMap.clear();

        const publicKnots = this.getPublicKnots(story);
        this.log(`Building knot map for ${publicKnots.length} public knots`);

        for (const knotName of publicKnots) {
            const knotId = await this.generateKnotId(finkUri, knotName);
            this.knotIdMap.set(knotId, knotName);
        }

        return this.knotIdMap;
    },

    // Navigate to a knot by its fragment ID
    async navigateToKnotById(fragmentId) {
        const knotName = this.knotIdMap.get(fragmentId);
        if (!knotName) {
            this.log(`No knot found for fragment: ${fragmentId}`);
            return false;
        }

        this.log(`Navigating to knot: ${knotName}`);

        // Use FinkInkEngine to navigate if available
        if (window.FinkInkEngine && FinkInkEngine.story) {
            try {
                FinkInkEngine.story.ChoosePathString(knotName);
                if (window.FinkUI) {
                    FinkUI.clearStory();
                    FinkUI.clearChoices();
                }
                FinkInkEngine.continueStory();
                return true;
            } catch (e) {
                this.log(`Navigation error: ${e.message}`);
                return false;
            }
        }

        return false;
    },

    // Update URL fragment when entering a knot
    async updateFragment(knotName) {
        if (!this.isPublicKnot(knotName) || !this.currentFinkUri) {
            return;
        }

        const knotId = await this.generateKnotId(this.currentFinkUri, knotName);

        if (this.usingNavigationAPI) {
            // Use Navigation API for cleaner updates
            try {
                const url = new URL(window.location.href);
                url.hash = knotId;
                navigation.navigate(url.toString(), { history: 'replace' });
            } catch (e) {
                // Fallback if navigation fails
                history.replaceState(null, '', `#${knotId}`);
            }
        } else {
            // Use history.replaceState to avoid polluting history
            history.replaceState(null, '', `#${knotId}`);
        }

        this.log(`Updated fragment to: #${knotId} (${knotName})`);
    },

    // Generate a shareable link for a knot
    async generateShareLink(knotName) {
        if (!this.currentFinkUri) {
            this.log('No current FINK URI set');
            return null;
        }

        const knotId = await this.generateKnotId(this.currentFinkUri, knotName);
        const url = new URL(window.location.href);
        url.hash = knotId;

        return url.toString();
    },

    // Check for deep link on initial load
    async checkDeepLink(story, finkUri) {
        const fragmentId = window.location.hash.slice(1);
        if (!fragmentId) return false;

        // Build knot map first
        await this.buildKnotIdMap(story, finkUri);

        if (this.knotIdMap.has(fragmentId)) {
            this.log(`Deep link detected: #${fragmentId}`);
            return await this.navigateToKnotById(fragmentId);
        }

        return false;
    },

    // Get current knot from URL (if any)
    getCurrentKnotFromUrl() {
        const fragmentId = window.location.hash.slice(1);
        return this.knotIdMap.get(fragmentId) || null;
    },

    // Get FINK file path from URL hash (for direct linking to .fink.js files)
    // Supports: #story=bagend.fink.js or #bagend.fink.js patterns
    getFinkFromHash() {
        const hash = window.location.hash.slice(1);
        if (!hash) return null;

        // Check for explicit story= parameter
        const storyMatch = hash.match(/story=([^&]+)/);
        if (storyMatch) {
            return decodeURIComponent(storyMatch[1]);
        }

        // Check if hash is directly a .fink.js path
        if (hash.endsWith('.fink.js')) {
            return decodeURIComponent(hash);
        }

        return null;
    },

    // Get navigation entries (modern Navigation API)
    getNavigationEntries() {
        if (this.usingNavigationAPI && navigation.entries) {
            return navigation.entries();
        }
        return [];
    },

    // Can go back?
    canGoBack() {
        if (this.usingNavigationAPI) {
            return navigation.canGoBack;
        }
        return window.history.length > 1;
    },

    // Can go forward?
    canGoForward() {
        if (this.usingNavigationAPI) {
            return navigation.canGoForward;
        }
        return false; // Can't detect with hash-based navigation
    },

    // Go back
    goBack() {
        if (this.usingNavigationAPI) {
            navigation.back();
        } else {
            window.history.back();
        }
    },

    // Go forward
    goForward() {
        if (this.usingNavigationAPI) {
            navigation.forward();
        } else {
            window.history.forward();
        }
    },

    log(msg) {
        if (window.FinkDevPanel) {
            window.FinkDevPanel.log(`Navigation: ${msg}`, 'info');
        } else {
            console.log(`[FinkNavigation] ${msg}`);
        }
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FinkNavigation.init());
} else {
    FinkNavigation.init();
}
