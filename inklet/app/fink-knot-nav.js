// FINK Knot Navigation - Deep linking and public knot identification
window.FinkKnotNav = {
    // Secret salt for ID generation (in production, this could be environment-specific)
    SALT: 'glitchcan-fink-v1',

    // Convention: knots are public UNLESS they start with underscore
    // This provides backwards compatibility with existing FINK files
    isPublicKnot(knotName) {
        if (!knotName || typeof knotName !== 'string') return false;

        // Leading underscore = private/internal knot
        // Everything else is public (backwards compatible)
        return !knotName.startsWith('_');
    },

    // Generate hash ID for a knot
    // Format: first 8 chars of SHA-256(SALT + finkURI + knotName)
    async generateKnotId(finkUri, knotName) {
        const dataString = this.SALT + finkUri + knotName;
        const encoder = new TextEncoder();
        const data = encoder.encode(dataString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex.substring(0, 8);
    },

    // Parse current URL fragment
    getCurrentFragment() {
        const hash = window.location.hash;
        if (!hash || hash.length <= 1) return null;

        // Remove leading # and get the ID
        return hash.substring(1);
    },

    // Get all public knots from current story
    getPublicKnots(story) {
        if (!story || !story.mainContentContainer) {
            FinkUtils.debugLog('Cannot extract knots - no story or mainContentContainer');
            return [];
        }

        const publicKnots = [];

        try {
            // INK Story exposes knots through the mainContentContainer.namedContent
            const content = story.mainContentContainer;

            // Access named content (knots and stitches)
            if (content.namedContent) {
                FinkUtils.debugLog('Scanning namedContent for public knots...');

                // Iterate through named content
                const namedContentMap = content.namedContent;
                for (const key in namedContentMap) {
                    if (namedContentMap.hasOwnProperty(key)) {
                        // Filter out function knots and only include public knots
                        // Functions in INK are also stored as named content but shouldn't be entry points
                        if (this.isPublicKnot(key) && !key.startsWith('function ')) {
                            publicKnots.push(key);
                            FinkUtils.debugLog(`Found public knot: ${key}`);
                        }
                    }
                }
            }
        } catch (error) {
            FinkUtils.debugLog('Error extracting knots: ' + error.message);
            console.error('Knot extraction error:', error);
        }

        return publicKnots;
    },

    // Navigate to knot by ID
    async navigateToKnotById(fragmentId, story, finkUri) {
        if (!fragmentId || !story || !finkUri) {
            FinkUtils.debugLog('Cannot navigate - missing parameters');
            return false;
        }

        FinkUtils.debugLog(`Attempting to navigate to knot with ID: ${fragmentId}`);

        // Get all public knots and find matching ID
        const publicKnots = this.getPublicKnots(story);

        for (const knotName of publicKnots) {
            const knotId = await this.generateKnotId(finkUri, knotName);

            if (knotId === fragmentId) {
                FinkUtils.debugLog(`Found matching knot: ${knotName}`);
                this.navigateToKnot(story, knotName);
                return true;
            }
        }

        FinkUtils.debugLog(`No matching knot found for ID: ${fragmentId}`);
        return false;
    },

    // Navigate to specific knot
    navigateToKnot(story, knotName) {
        if (!story) {
            FinkUtils.debugLog('Cannot navigate - no story instance');
            return false;
        }

        try {
            // Use INK's ChoosePathString to navigate to specific knot
            FinkUtils.debugLog(`Navigating to knot: ${knotName}`);
            story.ChoosePathString(knotName);
            FinkUtils.debugLog(`Successfully navigated to: ${knotName}`);
            return true;
        } catch (error) {
            FinkUtils.debugLog(`Error navigating to knot ${knotName}: ${error.message}`);
            return false;
        }
    },

    // Set URL fragment for current knot
    async setFragmentForKnot(finkUri, knotName) {
        if (!this.isPublicKnot(knotName)) {
            // Don't set fragment for non-public knots
            return;
        }

        const knotId = await this.generateKnotId(finkUri, knotName);
        const newUrl = window.location.pathname + window.location.search + '#' + knotId;

        // Use replaceState to avoid adding to browser history on every knot
        window.history.replaceState(null, '', newUrl);
        FinkUtils.debugLog(`Updated URL fragment to: #${knotId} for knot: ${knotName}`);
    },

    // Initialize knot navigation system
    init() {
        FinkUtils.debugLog('Initializing Knot Navigation system...');

        // Listen for hash changes
        window.addEventListener('hashchange', () => {
            FinkUtils.debugLog('Hash changed, checking for knot navigation...');
            this.handleHashChange();
        });

        // Check for initial hash on load
        const initialHash = this.getCurrentFragment();
        if (initialHash) {
            FinkUtils.debugLog(`Initial hash detected: ${initialHash}`);
            // Will be processed after story loads
        }
    },

    // Handle hash change events
    handleHashChange() {
        const fragmentId = this.getCurrentFragment();
        if (!fragmentId) return;

        FinkUtils.debugLog(`Processing hash change: ${fragmentId}`);

        // Check if we have a loaded story
        if (FinkInkEngine.story && FinkPlayer.currentStoryUrl) {
            this.navigateToKnotById(fragmentId, FinkInkEngine.story, FinkPlayer.currentStoryUrl);

            // Continue story after navigation
            FinkInkEngine.continueStory();
        } else {
            FinkUtils.debugLog('No story loaded yet, hash will be processed after load');
        }
    },

    // Generate shareable link for current knot
    async generateShareLink(knotName) {
        if (!FinkPlayer.currentStoryUrl) {
            FinkUtils.debugLog('Cannot generate share link - no story loaded');
            return null;
        }

        if (!this.isPublicKnot(knotName)) {
            FinkUtils.debugLog(`Knot ${knotName} is not public - cannot generate share link`);
            return null;
        }

        const knotId = await this.generateKnotId(FinkPlayer.currentStoryUrl, knotName);
        const baseUrl = window.location.origin + window.location.pathname;

        // Include FINK file URL as query param for context
        const finkParam = encodeURIComponent(FinkPlayer.currentStoryUrl);
        return `${baseUrl}?fink=${finkParam}#${knotId}`;
    }
};
