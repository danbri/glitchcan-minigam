// FINK Player - Main coordination module for finkapp
// Coordinates UI, INK engine, minigames, foley, audio, and navigation

window.FinkPlayer = {
    mediaBasePath: '',
    currentStoryUrl: null,
    globalMediaBase: null,

    // Initialize the player
    init() {
        FinkUtils.debugLog('Initializing FINK Player (finkapp) with modular architecture...');

        // Initialize all modules
        FinkUI.init();

        // Initialize dev panel if present
        if (window.FinkDevPanel) {
            FinkDevPanel.init();
        }

        // Initialize minigames
        if (window.FinkMinigames) {
            FinkMinigames.init();
        }

        // Initialize navigation
        if (window.FinkNavigation) {
            FinkNavigation.init();
        }

        // Initialize breadcrumb widget
        if (window.FinkBreadcrumb) {
            FinkBreadcrumb.init();
        }

        // Initialize audio systems
        if (window.FinkAudio) {
            FinkAudio.init();
        }
        if (window.FinkFoley) {
            FinkFoley.init();
        }

        FinkUtils.debugLog('FINK Player (finkapp) initialized');

        // Check for hash navigation first
        let targetFink = null;
        if (window.FinkNavigation && window.location.hash) {
            targetFink = FinkNavigation.getFinkFromHash();
        }

        // Auto-load story from hash or config
        if (targetFink) {
            FinkUtils.debugLog('Loading FINK from hash: ' + targetFink);
            setTimeout(() => {
                this.loadFinkStory(targetFink);
            }, 100);
        } else if (FinkConfig.DEFAULT_FINK_FILE) {
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

        finkUrl = finkUrl || FinkConfig.DEFAULT_FINK_FILE;
        if (!finkUrl) {
            FinkUI.showStatus('No FINK file specified');
            return;
        }

        // Reset minigame state
        if (window.FinkMinigames) {
            FinkMinigames.active = false;
        }

        // Stop any playing audio/foley
        if (window.FinkAudio) FinkAudio.stop();
        if (window.FinkFoley) FinkFoley.stop();

        // Set global media base from config
        this.globalMediaBase = FinkConfig.DEFAULT_MEDIA_PATH;
        if (this.globalMediaBase) {
            FinkUtils.debugLog('Using global media base from config: ' + this.globalMediaBase);
        }

        FinkUI.showStatus('Loading story...', true);

        try {
            const resolvedUrl = FinkUtils.resolveUrl(finkUrl);
            this.currentStoryUrl = resolvedUrl;
            FinkUtils.debugLog('Loading story from: ' + resolvedUrl);

            // Update breadcrumb with new FINK URL
            if (window.FinkBreadcrumb) {
                FinkBreadcrumb.setFinkUrl(resolvedUrl);
            }

            if (window.swimEvent) swimEvent('net', '📥', 'Loading FINK', finkUrl);

            // Clear any duplicate detection for this URL - this is intentional user action
            FinkSandbox.clearLoadRecord(resolvedUrl);

            const content = await FinkSandbox.loadViaSandbox(resolvedUrl);

            // Handle duplicate load skip (loadViaSandbox returns null if skipped)
            if (content === null) {
                FinkUtils.debugLog('FINK load skipped (duplicate): ' + resolvedUrl);
                FinkUI.hideStatus();
                return;
            }

            await FinkInkEngine.compileAndRunStory(content);

            if (window.swimEvent) swimEvent('fink', '✅', 'FINK Loaded', finkUrl.split('/').pop());
        } catch (error) {
            FinkUtils.debugLog('Error loading story: ' + error.message);
            FinkUI.showStatus(`Error: ${error.message}`);
            if (window.swimEvent) swimEvent('net', '❌', 'Load Failed', error.message);
        }
    },

    // Return to main menu (reload TOC)
    returnToMainMenu() {
        FinkUtils.debugLog('Returning to main menu...');

        // Reset UI state
        FinkUI.clearStory();
        FinkUI.clearChoices();
        FinkUI.decisionCount = 0;

        // Stop audio/foley
        if (window.FinkFoley) FinkFoley.stop();
        if (window.FinkAudio) FinkAudio.stop();

        // Reset minigames
        if (window.FinkMinigames) FinkMinigames.active = false;

        // Switch to narrative view
        FinkUI.switchView('narrative');

        // Clear navigation hash
        if (window.FinkNavigation) {
            history.replaceState(null, '', window.location.pathname);
        }

        // Clear breadcrumb history (full reset for main menu)
        if (window.FinkBreadcrumb) {
            FinkBreadcrumb.clearHistory();
        }

        FinkUI.showStatus('Loading main menu...', true);
        this.loadFinkStory(FinkConfig.DEFAULT_FINK_FILE);
    },

    // Restart current story by resetting INK state
    restartStory() {
        FinkUtils.debugLog('Restarting current story...');

        // Stop audio/foley
        if (window.FinkFoley) FinkFoley.stop();
        if (window.FinkAudio) FinkAudio.stop();

        // Reset minigames
        if (window.FinkMinigames) FinkMinigames.active = false;

        // Reset UI
        FinkUI.decisionCount = 0;

        if (FinkInkEngine.story) {
            try {
                FinkInkEngine.story.ResetState();
                FinkUI.clearStory();
                FinkUI.clearChoices();
                FinkUI.switchView('narrative');

                // Clear breadcrumb navigation history
                if (window.FinkBreadcrumb) {
                    FinkBreadcrumb.clearPath();
                }

                FinkInkEngine.continueStory();
                FinkUtils.debugLog('Story restarted successfully');
            } catch (error) {
                FinkUtils.debugLog('Error restarting story: ' + error.message);
                FinkUI.showStatus('Error restarting story');
            }
        } else if (this.currentStoryUrl) {
            FinkUtils.debugLog('No story instance, reloading from URL');
            this.loadFinkStory(this.currentStoryUrl);
        } else {
            FinkUI.showStatus('No story to restart');
        }
    },

    // Bookmark functionality
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

            if (bookmark.storyUrl !== this.currentStoryUrl) {
                FinkUtils.debugLog('Loading bookmarked story: ' + bookmark.storyUrl);
                FinkUI.showStatus('Loading bookmark...', true);

                FinkSandbox.loadViaSandbox(bookmark.storyUrl).then(async (content) => {
                    // Handle duplicate load skip
                    if (content === null) {
                        FinkUtils.debugLog('Bookmark story load skipped (duplicate)');
                        FinkUI.hideStatus();
                        return;
                    }

                    this.currentStoryUrl = bookmark.storyUrl;
                    await FinkInkEngine.compileAndRunStory(content);

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
    config: FinkConfig,
    minigames: window.FinkMinigames,
    foley: window.FinkFoley,
    audio: window.FinkAudio,
    devpanel: window.FinkDevPanel,
    nav: window.FinkNavigation,
    breadcrumb: window.FinkBreadcrumb
};

// Global swimEvent function for logging to swimlanes
window.swimEvent = (lane, emoji, title, detail) => {
    if (window.FinkDevPanel) {
        FinkDevPanel.swimEvent(lane, emoji, title, detail);
    }
};
