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
            this.currentStoryTags = { menu: [], images: [], basehref: null };
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

            // Populate dynamic menu
            if (this.currentStoryTags.menu && this.currentStoryTags.menu.length > 0) {
                FinkUI.populateDynamicMenu(this.currentStoryTags.menu);
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

            while (this.story.canContinue) {
                const p = document.createElement('p');
                let rawText = this.story.Continue();
                FinkUtils.debugLog('Story.Continue() output: "' + rawText.trim() + '"');

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

            // Update navigation fragment and breadcrumb
            if (this.story.state) {
                const currentPath = this.story.state.currentPathString;
                if (currentPath) {
                    const knotName = currentPath.split('.')[0];

                    // Update URL hash
                    if (window.FinkNavigation) {
                        FinkNavigation.updateFragment(knotName);
                    }

                    // Record in breadcrumb trail
                    if (window.FinkBreadcrumb) {
                        FinkBreadcrumb.recordKnot(knotName);
                    }
                }
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

        // 500ms delay before loading (matches working hamfink2026 timing)
        // NOTE: This delay was added to match hamfink2026 behavior during initial port.
        // It may be vestigial - investigate if removal causes issues.
        // See: https://github.com/danbri/glitchcan-minigam/issues/579
        setTimeout(() => {
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
        const tags = { menu: [], images: [], basehref: null };

        if (!this.story) return tags;

        const globalTags = this.story.globalTags || [];
        const currentTags = this.story.currentTags || [];
        const allTags = [...globalTags, ...currentTags];

        FinkUtils.debugLog('Extracting story-level tags: [' + allTags.join(', ') + ']');

        allTags.forEach(tag => {
            if (tag.includes('MENU:')) {
                const menuMatch = tag.match(/MENU:\s*(.+?)\s*->\s*(.+)/);
                if (menuMatch) {
                    tags.menu.push({ label: menuMatch[1], target: menuMatch[2] });
                }
            } else if (tag.includes('BASEHREF:')) {
                const basehrefMatch = tag.match(/BASEHREF:\s*(.*)/);
                if (basehrefMatch) {
                    tags.basehref = basehrefMatch[1].trim();
                    tags.basehref = tags.basehref.endsWith('/') ? tags.basehref : tags.basehref + '/';
                }
            }
        });

        return tags;
    }
};
