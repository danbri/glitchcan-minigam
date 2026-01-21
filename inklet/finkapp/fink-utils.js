// FINK Utilities - Common helper functions (finkapp version)
window.FinkUtils = {
    // HTML escaping
    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return "";
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                     .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    },

    // URL resolution
    resolveUrl(url, base = window.location.href) {
        try {
            return new URL(url, base).href;
        } catch (e) {
            this.debugLog('Error resolving URL: ' + url + ' (base: ' + base + ')');
            return url;
        }
    },

    // Layered media URL resolution - environment-flexible approach
    resolveLayeredMediaUrl(storyBasehref, imagePath) {
        this.debugLog('=== Layered Media Resolution ===');
        this.debugLog('Story BASEHREF: "' + (storyBasehref || '(none)') + '"');
        this.debugLog('Image path: "' + imagePath + '"');

        // Step 1: Determine the effective media base
        const globalMediaBase = window.FinkPlayer?.globalMediaBase;
        const currentStoryUrl = window.FinkPlayer?.currentStoryUrl;

        let effectiveBase;
        if (globalMediaBase) {
            try {
                effectiveBase = new URL(globalMediaBase, window.location.href).href;
                this.debugLog('Resolved global media base: ' + effectiveBase);
            } catch (e) {
                this.debugLog('Error resolving global media base, falling back to story location');
                effectiveBase = currentStoryUrl ? new URL('.', currentStoryUrl).href : window.location.href;
            }
        } else if (currentStoryUrl) {
            effectiveBase = new URL('.', currentStoryUrl).href;
            this.debugLog('Using story directory as base: ' + effectiveBase);
        } else {
            effectiveBase = window.location.href;
            this.debugLog('Fallback to current page base: ' + effectiveBase);
        }

        // Step 2: Handle absolute vs relative BASEHREF
        let storyMediaBase = storyBasehref || 'media/';
        if (!storyMediaBase.endsWith('/')) {
            storyMediaBase += '/';
        }
        this.debugLog('Processing storyMediaBase: "' + storyMediaBase + '"');

        let mediaBaseUrl;
        try {
            if (storyMediaBase.startsWith('http://') || storyMediaBase.startsWith('https://')) {
                mediaBaseUrl = storyMediaBase;
            } else if (storyMediaBase.startsWith('/')) {
                mediaBaseUrl = new URL(storyMediaBase, window.location.origin).href;
            } else {
                mediaBaseUrl = new URL(storyMediaBase, effectiveBase).href;
            }
        } catch (e) {
            this.debugLog('Error resolving media base, using fallback: ' + e.message);
            mediaBaseUrl = effectiveBase + storyMediaBase;
        }

        // Step 3: Resolve image path relative to media base
        try {
            const finalUrl = new URL(imagePath, mediaBaseUrl).href;
            this.debugLog('Final image URL: ' + finalUrl);
            return finalUrl;
        } catch (e) {
            this.debugLog('Error resolving final image URL: ' + e.message);
            return mediaBaseUrl + imagePath;
        }
    },

    // Debug logging - console-based
    debugLog(message) {
        console.log(`[FINK] ${message}`);
    }
};

// Global convenience logging function
window.log = (msg, type = 'info') => {
    console.log(`[${type}] ${msg}`);
};
