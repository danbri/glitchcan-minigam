// FINK Player - Main coordination module
window.FinkPlayer = {
    mediaBasePath: FinkConfig.DEFAULT_MEDIA_PATH,
    currentStoryUrl: null, // Track currently loaded story URL for layered resolution
    globalMediaBase: null, // Global media base for environment-specific deployment
    
    // Initialize the player
    init() {
        FinkUtils.debugLog('Initializing FINK Player v5 with modular architecture...');

        // Initialize all modules
        FinkUI.init();

        // Initialize knot navigation system if available
        if (typeof FinkKnotNav !== 'undefined') {
            FinkKnotNav.init();
            FinkUtils.debugLog('Knot navigation system initialized');
        }

        FinkUtils.debugLog('FINK Player v5 initialized');
        
        // Auto-load default story from config
        if (FinkConfig.DEFAULT_FINK_FILE) {
            FinkUtils.debugLog('Auto-loading default FINK from config: ' + FinkConfig.DEFAULT_FINK_FILE);
            setTimeout(() => {
                this.loadFinkStory(FinkConfig.DEFAULT_FINK_FILE);
            }, 100);
        } else {
            FinkUI.showStatus('No default story configured');
        }
    },
    
    // Load FINK story
    async loadFinkStory(finkUrl) {
        FinkUtils.debugLog('loadFinkStory called with: ' + (finkUrl || 'no URL'));
        
        // Use parameter or fall back to config
        finkUrl = finkUrl || FinkConfig.DEFAULT_FINK_FILE;
        if (!finkUrl) {
            FinkUI.showStatus('No FINK file specified');
            return;
        }
        
        // Set global media base from config
        this.globalMediaBase = FinkConfig.DEFAULT_MEDIA_PATH;
        if (this.globalMediaBase) {
            FinkUtils.debugLog('Using global media base from config: ' + this.globalMediaBase);
        } else {
            FinkUtils.debugLog('No global media base set, will use story-relative paths');
        }
        
        FinkUI.showStatus('Loading story...', true);
        
        try {
            let resolvedUrl = FinkUtils.resolveUrl(finkUrl);
            // Clean up multiple consecutive slashes in URL (except after protocol)
            resolvedUrl = resolvedUrl.replace(/([^:]\/)\/+/g, '$1');
            this.currentStoryUrl = resolvedUrl; // Store for content-centric resolution
            FinkUtils.debugLog('Loading story from: ' + resolvedUrl);
            const content = await FinkSandbox.loadViaSandbox(resolvedUrl);
            FinkInkEngine.compileAndRunStory(content);
        } catch (error) {
            FinkUtils.debugLog('Error loading story: ' + error.message);
            FinkUI.showStatus(`Error: ${error.message}`);
        }
    },
    
    // Return to main menu (reload TOC)
    returnToMainMenu() {
        FinkUtils.debugLog('Returning to main menu...');
        FinkUI.showStatus('Loading main menu...', true);
        this.loadFinkStory(FinkConfig.DEFAULT_FINK_FILE);
    },
    
    // Restart current story (placeholder - needs implementation)
    restartStory() {
        FinkUtils.debugLog('Restart story not yet implemented');
        FinkUI.showStatus('Restart feature coming soon!');
    },
    
    // Bookmark functionality (placeholder - needs implementation)  
    bookmarkCurrentKnot() {
        FinkUtils.debugLog('Bookmark feature not yet implemented');
        FinkUI.showStatus('Bookmark feature coming soon!');
    },
    
    gotoBookmarkedKnot() {
        FinkUtils.debugLog('Go to bookmark not yet implemented');
        FinkUI.showStatus('Bookmark feature coming soon!');
    }
};

// Initialize when page loads
window.addEventListener('DOMContentLoaded', () => {
    FinkPlayer.init();
});

// Global utilities for debugging
window.fink = {
    player: FinkPlayer,
    ui: FinkUI,
    engine: FinkInkEngine,
    sandbox: FinkSandbox,
    utils: FinkUtils,
    config: FinkConfig,
    knotNav: typeof FinkKnotNav !== 'undefined' ? FinkKnotNav : null
};