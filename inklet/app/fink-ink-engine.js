// FINK INK Engine - Handles INK compilation and story execution
window.FinkInkEngine = {
    story: null,
    finkStoryContent: '',
    currentStoryTags: {},
    lastSeenFinkTag: null,
    
    // Compile and run FINK story content
    compileAndRunStory(finkContent) {
        FinkUtils.debugLog('Processing FINK content with INK engine');
        FinkUtils.debugLog('Raw FINK content length: ' + finkContent.length);
        
        try {
            this.finkStoryContent = finkContent;
            this.currentStoryTags = { menu: [], images: [], basehref: null };
            
            const inkSuccess = this.tryInkCompilation(finkContent);
            
            if (!inkSuccess) {
                FinkUtils.debugLog('INK compilation failed');
                FinkUI.showStatus('INK compilation failed. Please check story syntax.');
                return;
            }
            
        } catch (error) {
            FinkUtils.debugLog('FATAL error processing FINK: ' + error.message);
            FinkUI.showStatus('Fatal Error: ' + error.message);
            console.error('FINK processing error:', error);
        }
    },
    
    // Try INK compilation
    tryInkCompilation(finkContent) {
        if (typeof inkjs === 'undefined') {
            FinkUtils.debugLog('INK library not available, skipping compilation');
            return false;
        }
        
        FinkUtils.debugLog('Attempting INK compilation...');
        FinkUtils.debugLog('Content preview (first 300 chars): ' + finkContent.substring(0, 300));
        
        try {
            const compiler = new inkjs.Compiler(finkContent);
            
            if (compiler.errors && compiler.errors.length > 0) {
                FinkUtils.debugLog('Constructor errors detected:');
                compiler.errors.forEach((error, i) => {
                    FinkUtils.debugLog(`  Constructor Error ${i+1}: ${error}`);
                });
                return false;
            }
            
            let compiledStory = null;
            
            try {
                FinkUtils.debugLog('Calling compiler.Compile()...');
                compiledStory = compiler.Compile();
                FinkUtils.debugLog('Compile() returned: ' + (compiledStory ? 'Story object' : 'null'));
                
            } catch (compileException) {
                FinkUtils.debugLog('Compile() threw exception: ' + compileException.message);
                
                if (compiler.errors && compiler.errors.length > 0) {
                    FinkUtils.debugLog('Compiler errors after exception:');
                    compiler.errors.forEach((error, i) => {
                        FinkUtils.debugLog(`  Compile Error ${i+1}: ${error}`);
                    });
                }
                
                return false;
            }
            
            if (compiler.errors && compiler.errors.length > 0) {
                FinkUtils.debugLog('Post-compilation errors detected:');
                compiler.errors.forEach((error, i) => {
                    FinkUtils.debugLog(`  Post-Compile Error ${i+1}: ${error}`);
                });
                return false;
            }
            
            if (!compiledStory) {
                FinkUtils.debugLog('Compilation succeeded but returned null story');
                return false;
            }
            
            try {
                this.story = compiledStory;
                FinkUtils.debugLog('Testing story instance...');
                
                const canContinue = this.story.canContinue;
                const currentChoices = this.story.currentChoices ? this.story.currentChoices.length : 0;
                
                FinkUtils.debugLog(`Story state: canContinue=${canContinue}, choices=${currentChoices}`);
                
                FinkUtils.debugLog('✅ INK compilation successful! Starting with real engine...');
                
                this.currentStoryTags = this.extractStoryTagsFromINK();
                FinkUtils.debugLog('Extracted story tags from INK: ' + JSON.stringify(this.currentStoryTags));
                
                // Fallback: extract BASEHREF from raw content if not found in tags
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
                    FinkUtils.debugLog('Using BASEHREF from story: ' + FinkPlayer.mediaBasePath);
                }

                // Populate dynamic menu from MENU: tags
                if (this.currentStoryTags.menu && this.currentStoryTags.menu.length > 0) {
                    FinkUI.populateDynamicMenu(this.currentStoryTags.menu);
                }

                FinkUI.clearStory();
                FinkUI.hideStatus();
                this.continueStory();

                // Record initial knot in breadcrumb
                this.recordCurrentKnotToBreadcrumb();

                return true;
                
            } catch (storyError) {
                FinkUtils.debugLog('Story instance test failed: ' + storyError.message);
                return false;
            }
            
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

                // Record the knot we're now in after making a choice
                this.recordCurrentKnotToBreadcrumb();
            }

            FinkUI.clearChoices();
            let storyFragment = document.createDocumentFragment();

            // Collect IMAGE, VIDEO, BASEHREF tags from ALL Continue() calls
            let collectedImageTag = null;
            let collectedVideoTag = null;
            let collectedBasehref = null;

            while (this.story.canContinue) {
                const p = document.createElement('p');
                let rawText = this.story.Continue();
                FinkUtils.debugLog('Story.Continue() output: "' + rawText + '"');

                let currentTags = this.story.currentTags || [];
                FinkUtils.debugLog('Current tags: [' + currentTags.join(', ') + ']');

                let escapedText = FinkUtils.escapeHtml(rawText.trim());
                let formattedText = escapedText
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                    .replace(/\*(.*?)\*/g, '<i>$1</i>')
                    .replace(/(https?:\/\/[^\s\)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

                p.innerHTML = formattedText;

                // Handle INK tags (like #BG:#0050e0, #CLASS:info, FINK:, IMAGE:, VIDEO:, BASEHREF:)
                currentTags.forEach(tag => {
                    const parts = tag.split(':');
                    const key = parts[0]?.trim().toUpperCase();
                    const value = parts.slice(1).join(':').trim(); // Allow colons in value

                    if (key === 'BG' && value) {
                        document.body.style.background = value;
                    } else if (key === 'CLASS' && value) {
                        p.classList.add(value);
                    } else if (key === 'FINK' && value) {
                        this.lastSeenFinkTag = value;
                        FinkUtils.debugLog('Stored FINK tag for later loading: ' + value);
                    } else if (tag.includes('IMAGE:')) {
                        collectedImageTag = tag.replace(/^IMAGE:\s*/, '').trim();
                        FinkUtils.debugLog('Collected IMAGE tag: ' + collectedImageTag);
                    } else if (tag.includes('VIDEO:')) {
                        collectedVideoTag = tag.replace(/^VIDEO:\s*/, '').trim();
                        FinkUtils.debugLog('Collected VIDEO tag: ' + collectedVideoTag);
                    } else if (tag.includes('BASEHREF:')) {
                        collectedBasehref = tag.replace(/.*BASEHREF:\s*/, '').trim();
                        // Remove quotes if present
                        if ((collectedBasehref.startsWith('"') && collectedBasehref.endsWith('"')) ||
                            (collectedBasehref.startsWith("'") && collectedBasehref.endsWith("'"))) {
                            collectedBasehref = collectedBasehref.slice(1, -1);
                        }
                        FinkUtils.debugLog('Collected BASEHREF tag: ' + collectedBasehref);
                    }
                });

                storyFragment.appendChild(p);
            }

            // Check for external FINK loading BEFORE appending content
            const storyText = storyFragment.textContent || '';
            FinkUtils.debugLog('Fragment text: "' + storyText + '"');
            FinkUtils.debugLog('Has FINK tag: ' + !!this.lastSeenFinkTag);
            if (storyText.includes('Loading external story') && this.lastSeenFinkTag) {
                FinkUtils.debugLog('At external_story knot, checking for FINK tags to load');
                this.handleExternalFinkLoading();
                return; // Don't generate choices yet, we're loading external content
            }

            FinkUI.replaceStoryContent(storyFragment);
            // Use collected tags from ALL Continue() calls (not just the last one)
            FinkUI.updateMediaFromCollectedTags(collectedImageTag, collectedVideoTag, collectedBasehref);

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

        // Resolve relative to CURRENT story URL, not app location
        const baseUrl = FinkPlayer.currentStoryUrl || window.location.href;
        const resolvedUrl = new URL(this.lastSeenFinkTag, baseUrl).href;
        FinkUtils.debugLog('Resolving FINK URL relative to: ' + baseUrl);
        FinkUtils.debugLog('Resolved URL: ' + resolvedUrl);

        FinkSandbox.loadViaSandbox(resolvedUrl)
            .then((content) => {
                FinkUtils.debugLog('External FINK loaded successfully');
                // Update currentStoryUrl so BASEHREF resolves correctly
                FinkPlayer.currentStoryUrl = resolvedUrl;
                FinkUtils.debugLog('Updated currentStoryUrl to: ' + resolvedUrl);
                // Update breadcrumb with new external story URL
                FinkBreadcrumb.setFinkUrl(resolvedUrl);
                this.compileAndRunStory(content);
            })
            .catch(error => {
                FinkUtils.debugLog('Error loading external FINK: ' + error.message);
                FinkUI.showStatus('Error loading external story: ' + error.message);
            });
    },
    
    // Extract story-level tags from compiled INK Story
    extractStoryTagsFromINK() {
        const tags = {
            menu: [],
            images: [],
            basehref: null
        };
        
        if (!this.story) return tags;
        
        // Try to get global tags first, then current tags
        const globalTags = this.story.globalTags || [];
        const currentTags = this.story.currentTags || [];
        const allTags = [...globalTags, ...currentTags];
        
        FinkUtils.debugLog('Extracting story-level tags from INK: [' + allTags.join(', ') + ']');
        
        allTags.forEach(tag => {
            FinkUtils.debugLog('Processing story tag: "' + tag + '"');
            if (tag.includes('MENU:')) {
                const menuMatch = tag.match(/MENU:\\s*(.+?)\\s*->\\s*(.+)/);
                if (menuMatch) {
                    tags.menu.push({ label: menuMatch[1], target: menuMatch[2] });
                    FinkUtils.debugLog('Found MENU tag: ' + menuMatch[1] + ' -> ' + menuMatch[2]);
                }
            } else if (tag.includes('BASEHREF:')) {
                const basehrefMatch = tag.match(/BASEHREF:\\s*(.*)/);
                if (basehrefMatch) {
                    tags.basehref = basehrefMatch[1].trim();
                    tags.basehref = tags.basehref.endsWith('/') ? tags.basehref : tags.basehref + '/';
                    FinkUtils.debugLog('Found BASEHREF tag: ' + tags.basehref);
                }
            }
        });
        
        return tags;
    },

    // Record current knot position to breadcrumb
    recordCurrentKnotToBreadcrumb() {
        if (!this.story) return;

        try {
            // Try to extract current knot from story state
            const state = this.story.state;
            if (state && state.currentPathString) {
                const pathString = state.currentPathString;
                // Extract knot name from path like "knot_name.stitch_name.0"
                const knotName = pathString.split('.')[0];
                if (knotName && !knotName.startsWith('_')) {
                    FinkBreadcrumb.recordKnot(knotName);
                    return;
                }
            }

            // Alternative: try callStack approach
            if (state && state.callStack && state.callStack.currentThread) {
                const thread = state.callStack.currentThread;
                if (thread.elements && thread.elements.length > 0) {
                    const currentElement = thread.elements[thread.elements.length - 1];
                    if (currentElement && currentElement.currentPointer && currentElement.currentPointer.path) {
                        const pathStr = currentElement.currentPointer.path.toString();
                        const knotName = pathStr.split('.')[0];
                        if (knotName && !knotName.startsWith('_')) {
                            FinkBreadcrumb.recordKnot(knotName);
                        }
                    }
                }
            }
        } catch (e) {
            FinkUtils.debugLog('Could not extract current knot for breadcrumb: ' + e.message);
        }
    }
};