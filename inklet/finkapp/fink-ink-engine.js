// FINK INK Engine - Handles INK compilation and story execution
// Extended for minigame and foley tag support

window.FinkInkEngine = {
    story: null,
    finkStoryContent: '',
    currentStoryTags: {},
    lastSeenFinkTag: null,
    pendingMinigame: null,

    // Compile and run FINK story content
    async compileAndRunStory(finkContent) {
        FinkUtils.debugLog('Processing FINK content with INK engine');
        FinkUtils.debugLog('Raw FINK content length: ' + finkContent.length);

        try {
            this.finkStoryContent = finkContent;
            this.currentStoryTags = { images: [], basehref: null };
            this.pendingMinigame = null;

            const inkSuccess = await this.tryInkCompilation(finkContent);

            if (!inkSuccess) {
                FinkUtils.debugLog('INK compilation failed');
                FinkUI.showStatus('INK compilation failed. Check story syntax.');
                return;
            }

        } catch (error) {
            FinkUtils.debugLog('FATAL error processing FINK: ' + error.message);
            FinkUI.showStatus('Fatal Error: ' + error.message);
            console.error('FINK processing error:', error);
        }
    },

    // Try INK compilation
    async tryInkCompilation(finkContent) {
        // Verify INK library loaded from CDN
        if (typeof inkjs === 'undefined') {
            FinkUtils.debugLog('ERROR: inkjs library not available');
            FinkUtils.debugLog('CDN script may have failed to load from jsdelivr');
            console.error('[FINK] inkjs library not found. Check network tab for CDN errors.');
            return false;
        }

        if (!inkjs.Compiler) {
            FinkUtils.debugLog('ERROR: inkjs.Compiler class missing');
            console.error('[FINK] inkjs loaded but Compiler unavailable - wrong version?');
            return false;
        }

        FinkUtils.debugLog('inkjs library verified, attempting compilation...');

        try {
            const compiler = new inkjs.Compiler(finkContent);

            if (compiler.errors && compiler.errors.length > 0) {
                compiler.errors.forEach((error, i) => {
                    FinkUtils.debugLog(`Constructor Error ${i+1}: ${error}`);
                });
                return false;
            }

            let compiledStory = null;

            try {
                compiledStory = compiler.Compile();
            } catch (compileException) {
                FinkUtils.debugLog('Compile() threw exception: ' + compileException.message);
                return false;
            }

            if (compiler.errors && compiler.errors.length > 0) {
                compiler.errors.forEach((error, i) => {
                    FinkUtils.debugLog(`Compile Error ${i+1}: ${error}`);
                });
                return false;
            }

            if (!compiledStory) {
                FinkUtils.debugLog('Compilation succeeded but returned null story');
                return false;
            }

            this.story = compiledStory;
            FinkUtils.debugLog('INK compilation successful!');

            // Set up error handler
            if (this.story.onError) {
                this.story.onError = (msg, type) => {
                    FinkUtils.debugLog(`INK Runtime ${type}: ${msg}`);
                    if (window.swimEvent) swimEvent('ink', '⚠️', 'Runtime ' + type, msg);
                };
            }

            // Extract and apply story-level tags
            this.currentStoryTags = this.extractStoryTagsFromINK();

            // Fallback: extract BASEHREF from raw content
            if (!this.currentStoryTags.basehref && this.finkStoryContent) {
                const basehrefMatch = this.finkStoryContent.match(/# BASEHREF:\s*(.+)/);
                if (basehrefMatch) {
                    this.currentStoryTags.basehref = basehrefMatch[1].trim();
                    FinkUtils.debugLog('Found BASEHREF in raw content: ' + this.currentStoryTags.basehref);
                }
            }

            if (this.currentStoryTags.basehref) {
                FinkPlayer.mediaBasePath = this.currentStoryTags.basehref.endsWith('/') ?
                                           this.currentStoryTags.basehref :
                                           this.currentStoryTags.basehref + '/';
            }

            // Build navigation map and check for deep links
            if (window.FinkNavigation) {
                // Check for deep link - this may navigate to a different knot or load a different FINK
                const hasDeepLink = await FinkNavigation.checkDeepLink(
                    this.story,
                    FinkPlayer.currentStoryUrl,
                    finkContent
                );

                // If deep link handled navigation, don't continue from beginning
                if (hasDeepLink) {
                    FinkUtils.debugLog('Deep link handled navigation');
                    return true;
                }
            }

            FinkUI.clearStory();
            FinkUI.hideStatus();
            this.continueStory();

            return true;

        } catch (outerError) {
            FinkUtils.debugLog('Outer compilation error: ' + outerError.message);
            return false;
        }
    },

    // Continue story progression
    continueStory(choiceIndex = null) {
        if (!this.story) {
            FinkUtils.debugLog('ERROR: Cannot continue - no story instance');
            FinkUI.showStatus('Error: No story loaded');
            return;
        }

        FinkUtils.debugLog('continueStory called with choiceIndex: ' + choiceIndex);

        try {
            if (choiceIndex !== null && typeof choiceIndex === 'number') {
                FinkUtils.debugLog('Making choice: ' + choiceIndex);
                this.story.ChooseChoiceIndex(choiceIndex);
                if (window.swimEvent) swimEvent('ink', '👆', 'Choice', `Index: ${choiceIndex}`);

                // Clear fink_respawn flag after first choice
                if (window.FinkNavigation) {
                    FinkNavigation.clearRespawnFlag();
                }
            }

            FinkUI.clearChoices();
            let storyFragment = document.createDocumentFragment();
            let shouldLoadExternal = false;
            let shouldStartMinigame = false;
            let minigameType = 'normal';
            let detectedKnot = null;  // Track knot during this continue cycle

            while (this.story.canContinue) {
                const p = document.createElement('p');
                let rawText = this.story.Continue();
                FinkUtils.debugLog('Story.Continue() output: "' + rawText.trim() + '"');

                // Track current knot from path (detect knot changes during flow)
                // Try multiple methods for inkjs 2.x compatibility
                let pathStr = this.story.state.currentPathString;

                // Fallback 1: currentPointer.path (some inkjs versions)
                if (!pathStr && this.story.state.currentPointer?.path) {
                    pathStr = this.story.state.currentPointer.path.toString();
                    FinkUtils.debugLog('Using fallback currentPointer.path: ' + pathStr);
                }

                // Fallback 2: callStack current element
                if (!pathStr && this.story.state.callStack?.currentElement?.currentPointer?.path) {
                    pathStr = this.story.state.callStack.currentElement.currentPointer.path.toString();
                    FinkUtils.debugLog('Using fallback callStack path: ' + pathStr);
                }

                FinkUtils.debugLog('Path string: ' + (pathStr || '(null/empty)'));

                if (pathStr) {
                    // Extract knot name from path like "Bag_End.0" or "Bag_End.subknot.0"
                    const knotPart = pathStr.split('.')[0];
                    FinkUtils.debugLog('Knot part extracted: "' + knotPart + '" (isNumeric: ' + /^\d+$/.test(knotPart) + ')');
                    if (knotPart && !/^\d+$/.test(knotPart)) {
                        if (knotPart !== detectedKnot) {
                            detectedKnot = knotPart;
                            FinkUtils.debugLog('Detected knot: ' + detectedKnot);
                        }
                    }
                } else {
                    FinkUtils.debugLog('WARNING: No path string available from story state');
                }

                let currentTags = this.story.currentTags || [];
                FinkUtils.debugLog('Current tags: [' + currentTags.join(', ') + ']');

                let escapedText = FinkUtils.escapeHtml(rawText.trim());
                let formattedText = escapedText
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                    .replace(/\*(.*?)\*/g, '<i>$1</i>')
                    .replace(/(https?:\/\/[^\s\)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

                p.innerHTML = formattedText;

                // Process INK tags
                currentTags.forEach(tag => {
                    const parts = tag.split(':');
                    const key = parts[0]?.trim().toUpperCase();
                    const value = parts.slice(1).join(':').trim();

                    switch (key) {
                        case 'BG':
                            if (value) document.body.style.background = value;
                            break;
                        case 'CLASS':
                            if (value) p.classList.add(value);
                            break;
                        case 'FINK':
                            this.lastSeenFinkTag = value;
                            shouldLoadExternal = true;
                            FinkUtils.debugLog('FINK tag detected: ' + value);
                            break;
                        case 'MINIGAME':
                            const type = value.toLowerCase();
                            if (type === 'chess') minigameType = 'chess';
                            else if (type === 'mega') minigameType = 'mega';
                            else minigameType = 'normal';
                            shouldStartMinigame = true;
                            FinkUtils.debugLog('MINIGAME tag detected: ' + minigameType);
                            break;
                        case 'FOLEY':
                            FinkUtils.debugLog('FOLEY tag: ' + value);
                            if (window.FinkFoley) {
                                FinkFoley.playFoley(value);
                            }
                            break;
                        case 'AUDIO':
                            FinkUtils.debugLog('AUDIO tag: ' + value);
                            if (window.FinkAudio) {
                                const audioUrl = FinkUtils.resolveLayeredMediaUrl(
                                    FinkPlayer.mediaBasePath, value
                                );
                                FinkAudio.play(audioUrl, value);
                            }
                            break;
                        case 'STOP_AUDIO':
                            if (window.FinkAudio) FinkAudio.stop();
                            if (window.FinkFoley) FinkFoley.stop();
                            break;
                    }
                });

                storyFragment.appendChild(p);

                // Break immediately when MINIGAME or FINK tag detected
                if (shouldStartMinigame || shouldLoadExternal) {
                    FinkUtils.debugLog(`Breaking story loop for ${shouldStartMinigame ? 'minigame' : 'FINK load'}`);
                    break;
                }
            }

            FinkUI.replaceStoryContent(storyFragment);
            FinkUI.updateImageFromINKTags(this.story);

            // Update navigation fragment and breadcrumb with detected knot
            if (detectedKnot) {
                // Store for reference
                this._currentKnotName = detectedKnot;
                FinkUtils.debugLog('Current knot for nav: ' + detectedKnot);

                // Update URL hash - but NOT if we're about to load external FINK
                // (updating hash during FINK transition triggers hash change listener,
                // which navigates back to this knot, causing an infinite loop)
                if (window.FinkNavigation && !shouldLoadExternal) {
                    FinkNavigation.updateFragment(detectedKnot);
                }

                // Record in breadcrumb trail
                if (window.FinkBreadcrumb) {
                    FinkBreadcrumb.recordKnot(detectedKnot);
                }
            } else {
                FinkUtils.debugLog('Could not determine current knot name from path');
            }

            // Handle external loading or minigame start
            if (shouldLoadExternal && this.lastSeenFinkTag) {
                this.handleExternalFinkLoading();
                return;
            }

            if (shouldStartMinigame && window.FinkMinigames) {
                setTimeout(() => FinkMinigames.startMinigame('gems', minigameType), 800);
                return;
            }

            // Generate choices
            if (this.story.currentChoices.length > 0) {
                FinkUtils.debugLog('Displaying ' + this.story.currentChoices.length + ' choices');
                FinkUI.displayChoices(this.story.currentChoices, (index) => {
                    this.continueStory(index);
                });
                FinkUI.hideStatus();
            } else {
                FinkUtils.debugLog('Reached end of story');
                FinkUI.showEndOfStory();
                FinkUI.hideStatus();
            }

        } catch (e) {
            FinkUtils.debugLog('ERROR during story continuation: ' + e.message);
            FinkUI.showStatus('Runtime Error: ' + e.message);
        }
    },

    // Handle external FINK loading
    handleExternalFinkLoading() {
        if (!this.lastSeenFinkTag) {
            FinkUtils.debugLog('No FINK tag found for external loading');
            FinkUI.showStatus('Error: No external story specified');
            return;
        }

        FinkUtils.debugLog('Loading external FINK file: ' + this.lastSeenFinkTag);
        FinkUI.showStatus('Loading ' + this.lastSeenFinkTag + '...', true);

        const baseUrl = FinkPlayer.currentStoryUrl || window.location.href;
        const resolvedUrl = new URL(this.lastSeenFinkTag, baseUrl).href;
        FinkUtils.debugLog('Resolved URL: ' + resolvedUrl);

        if (window.swimEvent) swimEvent('net', '📥', 'Loading FINK', this.lastSeenFinkTag);

        // CRITICAL: Clear URL hash before loading new FINK to prevent navigation loop.
        // Without this, checkDeepLink() sees the old FINK's hash and tries to navigate
        // back to it, causing a toc → bagend → toc → bagend loop.
        // The new FINK's hash will be set by updateFragment() after it loads.
        if (window.location.hash) {
            FinkUtils.debugLog('Clearing URL hash before FINK load to prevent navigation loop');
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }

        // 500ms delay before loading (matches working hamfink2026 timing)
        // NOTE: This delay was added to match hamfink2026 behavior during initial port.
        // It may be vestigial - investigate if removal causes issues.
        // See: https://github.com/danbri/glitchcan-minigam/issues/579
        setTimeout(() => {
            // Notify breadcrumb of FINK transition BEFORE loading
            // This ensures the stack always reflects navigation intent, even if load is skipped
            if (window.FinkBreadcrumb) {
                FinkBreadcrumb.setFinkUrl(resolvedUrl);
            }

            // Clear any duplicate detection for this URL - this is intentional user navigation
            // (e.g., clicking a menu item), so we should always honor it even if the URL
            // was recently loaded by deep link resolution or other automatic processes.
            FinkSandbox.clearLoadRecord(resolvedUrl);

            FinkSandbox.loadViaSandbox(resolvedUrl)
            .then(async (content) => {
                // Handle duplicate load skip (loadViaSandbox returns null if skipped)
                if (content === null) {
                    FinkUtils.debugLog('External FINK load skipped (duplicate)');
                    FinkUI.hideStatus();
                    return;
                }
                FinkUtils.debugLog('External FINK loaded successfully');
                FinkPlayer.currentStoryUrl = resolvedUrl;

                await this.compileAndRunStory(content);
                if (window.swimEvent) swimEvent('fink', '✅', 'FINK Loaded', resolvedUrl.split('/').pop());
            })
            .catch(error => {
                FinkUtils.debugLog('Error loading external FINK: ' + error.message);
                FinkUI.showStatus('Error loading external story: ' + error.message);
                if (window.swimEvent) swimEvent('net', '❌', 'Load Failed', error.message);
            });
        }, 500);
    },

    // Extract story-level tags from compiled INK Story
    extractStoryTagsFromINK() {
        const tags = { images: [], basehref: null };

        if (!this.story) return tags;

        const globalTags = this.story.globalTags || [];
        const currentTags = this.story.currentTags || [];
        const allTags = [...globalTags, ...currentTags];

        FinkUtils.debugLog('Extracting story-level tags: [' + allTags.join(', ') + ']');

        allTags.forEach(tag => {
            if (tag.includes('BASEHREF:')) {
                const basehrefMatch = tag.match(/BASEHREF:\s*(.*)/);
                if (basehrefMatch) {
                    tags.basehref = basehrefMatch[1].trim();
                    tags.basehref = tags.basehref.endsWith('/') ? tags.basehref : tags.basehref + '/';
                }
            }
        });

        return tags;
    },

    // Track current knot name explicitly
    // This is more reliable than parsing story.state.currentPathString
    _currentKnotName: null,

    // Get current knot name - use tracked value or fallback to state parsing
    getCurrentKnotName() {
        // Return tracked knot if available
        if (this._currentKnotName) {
            return this._currentKnotName;
        }

        // Fallback: try to parse from story state
        if (!this.story || !this.story.state) {
            return null;
        }

        try {
            // Try currentPathString (inkjs 2.x)
            let pathString = this.story.state.currentPathString;

            // Fallback to currentPointer.path
            if (!pathString && this.story.state.currentPointer?.path) {
                pathString = this.story.state.currentPointer.path.toString();
            }

            if (!pathString) {
                return null;
            }

            // Extract knot name (first component before any dot)
            const knotName = pathString.split('.')[0];

            // Filter out empty strings and numeric-only paths
            if (!knotName || /^\d+$/.test(knotName)) {
                return null;
            }

            return knotName;
        } catch (e) {
            FinkUtils.debugLog('Error getting current knot name: ' + e.message);
            return null;
        }
    },

    // Set current knot when navigating (called from external navigation)
    setCurrentKnot(knotName) {
        this._currentKnotName = knotName;
        FinkUtils.debugLog('Set current knot: ' + knotName);
    }
};
