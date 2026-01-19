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
            const resolvedUrl = FinkUtils.resolveUrl(finkUrl);
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
    
    // Restart current story by resetting INK state
    restartStory() {
        FinkUtils.debugLog('Restarting current story...');

        if (FinkInkEngine.story) {
            try {
                // Use inkjs ResetState to restart without recompiling
                FinkInkEngine.story.ResetState();
                FinkUI.clearStory();
                FinkUI.clearChoices();
                FinkInkEngine.continueStory();
                FinkUtils.debugLog('Story restarted successfully');
            } catch (error) {
                FinkUtils.debugLog('Error restarting story: ' + error.message);
                FinkUI.showStatus('Error restarting story');
            }
        } else if (this.currentStoryUrl) {
            // No story instance, try reloading from URL
            FinkUtils.debugLog('No story instance, reloading from URL');
            this.loadFinkStory(this.currentStoryUrl);
        } else {
            FinkUI.showStatus('No story to restart');
        }
    },
    
    // Bookmark functionality - saves story state to localStorage
    bookmarkCurrentKnot() {
        FinkUtils.debugLog('Saving bookmark...');

        if (!FinkInkEngine.story) {
            FinkUI.showStatus('No story to bookmark');
            return;
        }

        try {
            const bookmark = {
                storyUrl: this.currentStoryUrl,
                storyState: FinkInkEngine.story.state.ToJson(),
                savedAt: new Date().toISOString()
            };
            localStorage.setItem('fink-bookmark', JSON.stringify(bookmark));
            FinkUtils.debugLog('Bookmark saved for: ' + this.currentStoryUrl);
            FinkUI.showStatus('Bookmark saved!');
            setTimeout(() => FinkUI.hideStatus(), 1500);
        } catch (error) {
            FinkUtils.debugLog('Error saving bookmark: ' + error.message);
            FinkUI.showStatus('Error saving bookmark');
        }
    },

    gotoBookmarkedKnot() {
        FinkUtils.debugLog('Restoring bookmark...');

        const savedBookmark = localStorage.getItem('fink-bookmark');
        if (!savedBookmark) {
            FinkUI.showStatus('No bookmark found');
            return;
        }

        try {
            const bookmark = JSON.parse(savedBookmark);

            // Check if we need to load a different story first
            if (bookmark.storyUrl !== this.currentStoryUrl) {
                FinkUtils.debugLog('Loading bookmarked story: ' + bookmark.storyUrl);
                FinkUI.showStatus('Loading bookmark...', true);

                // Load the story first, then restore state
                FinkSandbox.loadViaSandbox(bookmark.storyUrl).then(content => {
                    this.currentStoryUrl = bookmark.storyUrl;
                    FinkInkEngine.compileAndRunStory(content);

                    // Wait for story to compile, then restore state
                    setTimeout(() => {
                        if (FinkInkEngine.story) {
                            FinkInkEngine.story.state.LoadJson(bookmark.storyState);
                            FinkUI.clearStory();
                            FinkUI.clearChoices();
                            FinkInkEngine.continueStory();
                            FinkUtils.debugLog('Bookmark restored');
                        }
                    }, 100);
                }).catch(error => {
                    FinkUtils.debugLog('Error loading bookmark story: ' + error.message);
                    FinkUI.showStatus('Error restoring bookmark');
                });
            } else if (FinkInkEngine.story) {
                // Same story, just restore state
                FinkInkEngine.story.state.LoadJson(bookmark.storyState);
                FinkUI.clearStory();
                FinkUI.clearChoices();
                FinkInkEngine.continueStory();
                FinkUtils.debugLog('Bookmark restored (same story)');
            }
        } catch (error) {
            FinkUtils.debugLog('Error restoring bookmark: ' + error.message);
            FinkUI.showStatus('Error restoring bookmark');
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