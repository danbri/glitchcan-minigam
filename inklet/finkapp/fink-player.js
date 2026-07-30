// FINK Player - Main coordination module for finkapp
// Coordinates UI, INK engine, minigames, foley, audio, and navigation
//
// ⚠️ PENDING DELETE — this is the HOST-PAGE story player: it runs stories
// with the shell's own authority (direct globals, unmediated host DOM).
// It is SUPERSEDED by the boxed runner (inklet/apps/storyrunner/), which
// runs a story in an opaque-origin frame reaching the shell only through
// story:* verbs. This module is kept ONLY until the boxed runner reaches
// parity — the blockers are tracked in issue #779 (minigame pause/resume,
// variable governance, dream stack, navigation). When #779 is green, the
// bundled-story boot flips to boxed and this file is removed. Do not add
// features here; add them to the boxed runner.

window.FinkPlayer = {
    // Deprecation flag — read by the shell/roots and surfaced in the
    // service inventory so "which player am I on" is never a guess.
    PENDING_DELETE: true,
    supersededBy: 'inklet/apps/storyrunner',
    trackingIssue: 779,

    mediaBasePath: '',
    currentStoryUrl: null,
    globalMediaBase: null,

    // Initialize the player
    init() {
        FinkUtils.debugLog('Initializing FINK Player (finkapp) with modular architecture...');
        console.warn('[FinkPlayer] PENDING DELETE: the host-page player is superseded by the '
            + 'boxed runner (inklet/apps/storyrunner). Kept until parity — see issue #779.');

        // Initialize all modules
        FinkUI.init();

        // Initialize dev panel
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
        if (window.FinkNavigation && (window.location.hash || window.location.search)) {
            targetFink = FinkNavigation.getFinkFromHash();   // handles ?story= too
        }

        // The ROOT MANIFEST decides what this installation boots.
        //
        // This used to be "a story, or nothing" — which is why foafos
        // could not be instantiated as an office or TV installation
        // without a fork. A manifest that says `boot.story === false`
        // means the story engine simply idles: FINK is not part of that
        // installation at all. An explicit ?story= still wins, because
        // asking for a specific thing should beat a default.
        const rootBoot = window.FoafOS?.root?.boot;
        if (!targetFink && rootBoot && rootBoot.story === false) {
            FinkUtils.debugLog(`Root "${window.FoafOS.root.id}" boots without a story`);
            setTimeout(() => {
                for (const appId of (rootBoot.apps || [])) window.FoafOS.launchApp(appId);
            }, 100);
            return;
        }

        // #779's flip lever, opt-in early. The root manifest declares
        // storyPlayer.default 'boxed' but autoBoot stays 'legacy' until
        // the parity blockers close — and until now NOTHING read either
        // field, so there was no way to boot the boxed runner at all.
        // `?player=boxed` (or a manifest autoBoot of 'boxed', when #779
        // flips it) boots the BOXED runner as the story surface and lets
        // this pending-delete player idle. An explicit ?story=/deep link
        // still wins and loads legacy, which is the only player that can
        // be handed an arbitrary story today.
        // `?player=legacy` is the way BACK, and it wins over everything:
        // the manifest now boots boxed, so the escape hatch has to be
        // reachable without a deploy if anything about the box misbehaves
        // in the field.
        const askedPlayer = new URLSearchParams(window.location.search).get('player');
        // `?player=none` boots NO story surface. It exists because a test that
        // drives the runner itself must be able to say "this page starts
        // empty" — otherwise the flip below hands it a second, auto-booted
        // runner and the suite reads the wrong frame. It is also the honest
        // answer for a shell someone wants to open with nothing playing.
        if (askedPlayer === 'none' || askedPlayer === 'off') {
            FinkUtils.debugLog('Boot: ?player=none — no story surface starts');
            return;
        }
        // A one-tap app deep link (?app=<id>) makes THAT app the surface, and
        // it is decided BEFORE the player choice. The shell launches the named
        // app; if the story surface also booted, a story would run behind the
        // window the person asked for. That was the "behind the demo window
        // the general fink stuff is running" defect, and once the boxed runner
        // became the default it came back in a worse form: `?app=storyrunner`
        // opened the runner twice. An explicit ?story= still wins, because
        // asking for a specific story is asking for the story surface.
        const wantApp = new URLSearchParams(window.location.search).get('app');
        if (!targetFink && wantApp) {
            FinkUtils.debugLog(`Boot: app deep link ?app=${wantApp} — no story surface starts`);
            return;
        }

        const wantBoxed = askedPlayer !== 'legacy'
            && (askedPlayer === 'boxed'
                || window.FoafOS?.root?.storyPlayer?.autoBoot === 'boxed');
        // `?story=` USED to force the legacy player, because the boxed
        // runner could only play its own demo. It can now be handed any
        // FINK (the shell passes `?story=` through in the init config), so
        // asking for the box means the box — including for an arbitrary
        // story, which is the whole point of the sandbox (#779).
        if (wantBoxed) {
            // Hand the boxed engine the story this INSTALLATION boots —
            // a deep link, else the root manifest's, else the config
            // default. One-shot, so a later manual launch of the engine
            // still opens its own demo.
            const bootStory = targetFink || (rootBoot && rootBoot.story)
                || FinkConfig.DEFAULT_FINK_FILE || null;
            FinkUtils.debugLog('Boot: boxed story engine (Finkosphere) → ' + (bootStory || 'its own demo'));
            setTimeout(() => {
                window.FoafOS?.setBootStory?.(bootStory);
                window.FoafOS?.launchApp?.('storyrunner');
            }, 150);
            return;
        }

        // Auto-load story from hash or config
        if (targetFink) {
            FinkUtils.debugLog('Loading FINK from hash: ' + targetFink);
            setTimeout(() => {
                this.loadFinkStory(targetFink);
            }, 100);
        } else if (rootBoot && rootBoot.story) {
            FinkUtils.debugLog('Loading story named by the root manifest: ' + rootBoot.story);
            setTimeout(() => this.loadFinkStory(rootBoot.story), 100);
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

            window.FoafOS?.bus.publish('fetch.start', {
                summary: `Loading FINK — ${finkUrl.split('/').pop()}`, url: finkUrl,
            });

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

            window.FoafOS?.bus.publish('fink.ready', {
                summary: finkUrl.split('/').pop(), url: finkUrl,
            });
        } catch (error) {
            FinkUtils.debugLog('Error loading story: ' + error.message);
            FinkUI.showStatus(`Error: ${error.message}`);
            window.FoafOS?.bus.publish('fetch.fail', {
                summary: `Load failed — ${error.message}`, error: error.message, highlight: true,
            });
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

// window.swimEvent is retired: the dev panel lanes observe the bus
// (nav.*, ink.*, fink.*, fetch.*, net.*, game.*) — publish a fact there
// instead of writing into a lane.
