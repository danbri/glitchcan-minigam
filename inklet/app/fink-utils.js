// FINK Utilities - Common helper functions
window.FinkUtils = {
    debugMessages: [],
    debugConsole: null,
    
    // Debug logging
    debugLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        this.debugMessages.push(logEntry);
        
        if (this.debugMessages.length > FinkConfig.MAX_DEBUG_MESSAGES) {
            this.debugMessages = this.debugMessages.slice(-FinkConfig.KEEP_DEBUG_MESSAGES);
        }
        
        if (this.debugConsole && this.debugConsole.classList.contains('active')) {
            this.updateDebugDisplay();
        }
        
        console.log(logEntry);
    },
    
    updateDebugDisplay() {
        if (this.debugConsole) {
            this.debugConsole.innerHTML = this.debugMessages.join('<br>');
            this.debugConsole.scrollTop = this.debugConsole.scrollHeight;
        }
    },
    
    toggleDebugConsole() {
        if (!this.debugConsole) {
            this.debugConsole = document.getElementById('debug-console');
        }
        
        if (this.debugConsole) {
            this.debugConsole.classList.toggle('active');
            if (this.debugConsole.classList.contains('active')) {
                this.updateDebugDisplay();
            }
        }
    },
    
    // HTML escaping
    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return "";
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                     .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    },
    
    // URL helpers
    resolveUrl(url, base = window.location.href) {
        try {
            return new URL(url, base).href;
        } catch (e) {
            this.debugLog('Error resolving URL: ' + url + ' (base: ' + base + ')');
            return url;
        }
    },
    
    // Layered media URL resolution - environment-flexible approach with responsive images
    resolveLayeredMediaUrl(storyBasehref, imagePath) {
        this.debugLog('=== Layered Media Resolution ===');
        this.debugLog('Story BASEHREF: "' + (storyBasehref || '(none)') + '"');
        this.debugLog('Image path: "' + imagePath + '"');
        
        // Check if this is a Shane Manor image that needs responsive handling
        if (storyBasehref && storyBasehref.includes('shane') && window.shaneManorImages) {
            const responsivePath = window.shaneManorImages.getOptimalImagePath(imagePath);
            this.debugLog('Using responsive image: ' + responsivePath);
            return responsivePath;
        }
        
        // Step 1: Determine the effective media base
        const globalMediaBase = FinkPlayer.globalMediaBase; // From config or form
        const currentStoryUrl = FinkPlayer.currentStoryUrl;
        
        let effectiveBase;
        if (globalMediaBase) {
            // Resolve global media base relative to current page if it's relative
            try {
                effectiveBase = new URL(globalMediaBase, window.location.href).href;
                this.debugLog('Resolved global media base: ' + effectiveBase);
            } catch (e) {
                this.debugLog('Error resolving global media base, falling back to story location');
                effectiveBase = currentStoryUrl ? new URL('.', currentStoryUrl).href : window.location.href;
            }
        } else if (currentStoryUrl) {
            effectiveBase = new URL('.', currentStoryUrl).href; // Directory of story file
            this.debugLog('Using story directory as base: ' + effectiveBase);
        } else {
            effectiveBase = window.location.href;
            this.debugLog('Fallback to current page base: ' + effectiveBase);
        }
        
        // Step 2: Handle absolute vs relative BASEHREF
        let storyMediaBase = storyBasehref || 'media/';
        // Ensure trailing slash for directory URLs
        if (!storyMediaBase.endsWith('/')) {
            storyMediaBase += '/';
        }
        this.debugLog('Processing storyMediaBase: "' + storyMediaBase + '"');
        this.debugLog('Is absolute path: ' + (storyMediaBase.startsWith('/') || storyMediaBase.includes('://')));
        
        let mediaBaseUrl;
        try {
            if (storyMediaBase.startsWith('http://') || storyMediaBase.startsWith('https://')) {
                // Full URL - use as-is
                mediaBaseUrl = storyMediaBase;
                this.debugLog('Using full URL as-is: ' + mediaBaseUrl);
            } else if (storyMediaBase.startsWith('/')) {
                // Absolute path - construct with current origin
                mediaBaseUrl = new URL(storyMediaBase, window.location.origin).href;
                this.debugLog('Absolute path resolved: ' + mediaBaseUrl);
            } else {
                // Relative path - resolve against effective base
                mediaBaseUrl = new URL(storyMediaBase, effectiveBase).href;
                this.debugLog('Relative path resolved: ' + mediaBaseUrl);
            }
        } catch (e) {
            this.debugLog('Error resolving media base, using fallback: ' + e.message);
            mediaBaseUrl = effectiveBase + storyMediaBase;
        }
        
        // Step 3: Resolve image path relative to media base
        try {
            const finalUrl = new URL(imagePath, mediaBaseUrl).href;
            this.debugLog('Final image URL: ' + finalUrl);
            this.debugLog('=== End Resolution ===');
            return finalUrl;
        } catch (e) {
            this.debugLog('Error resolving final image URL: ' + e.message);
            return mediaBaseUrl + imagePath; // Simple concatenation fallback
        }
    }
};