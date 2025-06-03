// FINK Player - Main coordination module
window.FinkPlayer = {
    mediaBasePath: FinkConfig.DEFAULT_MEDIA_PATH,
    
    // Initialize the player
    init() {
        FinkUtils.debugLog('Initializing FINK Player v5 with modular architecture...');
        
        // Initialize all modules
        FinkUI.init();
        
        FinkUtils.debugLog('FINK Player v5 initialized');
        
        // Auto-load default story if specified
        const urlInput = document.getElementById('fink-url-input');
        if (urlInput && urlInput.value) {
            FinkUtils.debugLog('Auto-loading default FINK URL: ' + urlInput.value);
            setTimeout(() => {
                this.loadFinkStory();
            }, 100);
        } else {
            FinkUI.showStatus('Enter a URL to load a FINK story');
        }
    },
    
    // Load FINK story
    async loadFinkStory() {
        FinkUtils.debugLog('loadFinkStory called');
        FinkUI.elements.urlForm.classList.remove('active');
        
        setTimeout(() => {
            FinkUI.elements.appContainer.classList.remove('show-menu');
            FinkUI.elements.titleBar.classList.remove('visible');
        }, 1000);
        
        const finkUrl = FinkUI.elements.finkUrlInput.value.trim();
        if (!finkUrl) {
            FinkUI.showStatus('Please enter a URL to a FINK file');
            return;
        }
        
        // Update media path
        const newMediaPath = FinkUI.elements.mediaPathInput.value.trim();
        if (newMediaPath) {
            this.mediaBasePath = newMediaPath.endsWith('/') ? newMediaPath : newMediaPath + '/';
        }
        
        FinkUI.showStatus('Loading story...', true);
        
        try {
            const content = await FinkSandbox.loadViaSandbox(FinkUtils.resolveUrl(finkUrl));
            FinkInkEngine.compileAndRunStory(content);
        } catch (error) {
            FinkUtils.debugLog('Error loading story: ' + error.message);
            FinkUI.showStatus(`Error: ${error.message}`);
        }
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
    config: FinkConfig
};