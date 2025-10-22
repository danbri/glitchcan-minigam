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
                
                FinkUI.clearStory();
                FinkUI.hideStatus();

                // Build knot ID cache for deep linking
                if (typeof FinkKnotNav !== 'undefined' && FinkPlayer.currentStoryUrl) {
                    FinkKnotNav.buildKnotIdCache(this.story, FinkPlayer.currentStoryUrl)
                        .then(() => {
                            FinkUtils.debugLog('Knot ID cache ready, checking for fragment navigation...');
                            // Check for URL fragment navigation after cache is ready
                            this.checkInitialFragment();
                            // Start story
                            this.continueStory();
                        })
                        .catch(error => {
                            FinkUtils.debugLog('Error building knot cache: ' + error.message);
                            // Start story anyway
                            this.continueStory();
                        });
                } else {
                    // No knot nav available, start story directly
                    this.checkInitialFragment();
                    this.continueStory();
                }

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

    // Check for initial URL fragment and navigate if needed
    checkInitialFragment() {
        if (typeof FinkKnotNav === 'undefined') {
            FinkUtils.debugLog('FinkKnotNav not available, skipping fragment check');
            return;
        }

        const fragmentId = FinkKnotNav.getCurrentFragment();
        if (fragmentId && FinkPlayer.currentStoryUrl) {
            FinkUtils.debugLog(`Found initial fragment: ${fragmentId}, attempting navigation...`);

            // Try to navigate to the knot (now synchronous using cache)
            const success = FinkKnotNav.navigateToKnotById(fragmentId, this.story, FinkPlayer.currentStoryUrl);
            if (success) {
                FinkUtils.debugLog('Successfully navigated to fragment knot');
            } else {
                FinkUtils.debugLog('Fragment knot not found, starting from beginning');
            }
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
            }

            FinkUI.clearChoices();
            let storyFragment = document.createDocumentFragment();
            // Track last seen media-related tags during this continuation burst
            let lastImageTag = null;
            let lastBasehrefTag = null;

            // Note: Knot tracking moved to after choices display (uses currentChoices[0].sourcePath)

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
                
                // Handle INK tags (like BG:#0050e0, CLASS:info, FINK:, IMAGE:, BASEHREF:)
                currentTags.forEach(tag => {
                    const parts = tag.split(':');
                    const key = parts[0]?.trim().toUpperCase();
                    const value = parts[1]?.trim();
                    
                    if (key === 'BG' && value) {
                        document.body.style.background = value;
                    } else if (key === 'CLASS' && value) {
                        p.classList.add(value);
                    } else if (key === 'FINK' && value) {
                        this.lastSeenFinkTag = value;
                        FinkUtils.debugLog('Stored FINK tag for later loading: ' + value);
                    } else if (key === 'IMAGE' && value) {
                        lastImageTag = value;
                        FinkUtils.debugLog('Captured IMAGE tag this turn: ' + lastImageTag);
                    } else if (key === 'BASEHREF' && value) {
                        lastBasehrefTag = value.replace(/^\s*["']?|["']?\s*$/g, '');
                        FinkUtils.debugLog('Captured BASEHREF tag this turn: ' + lastBasehrefTag);
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
            // Prefer media tags seen during this continuation burst; fallback to live currentTags
            if (lastImageTag) {
                const base = lastBasehrefTag || (FinkPlayer.mediaBasePath ? FinkPlayer.mediaBasePath.replace(/\/$/, '') : null);
                FinkUI.updateImage(lastImageTag, base);
            } else {
                FinkUI.updateImageFromINKTags(this.story);
            }

            // Generate choices
            if (this.story.currentChoices.length > 0) {
                FinkUtils.debugLog('Displaying ' + this.story.currentChoices.length + ' choices');
                FinkUI.displayChoices(this.story.currentChoices, (index) => {
                    this.continueStory(index);
                });
                FinkUI.hideStatus();

                // Track current knot for URL fragment updates
                // Use sourcePath from first choice (format: "knotName.stitch.index")
                if (typeof FinkKnotNav !== 'undefined' && this.story.currentChoices[0] && this.story.currentChoices[0].sourcePath) {
                    const sourcePath = this.story.currentChoices[0].sourcePath;
                    const knotName = sourcePath.split('.')[0]; // Extract knot name before first dot
                    FinkUtils.debugLog(`Tracking knot from sourcePath: ${sourcePath} -> knot: ${knotName}`);
                    FinkKnotNav.setFragmentForKnot(FinkPlayer.currentStoryUrl || '', knotName);
                }
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
        
        FinkSandbox.loadViaSandbox(new URL(this.lastSeenFinkTag, window.location.href).href)
            .then((content) => {
                FinkUtils.debugLog('External FINK loaded successfully');
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
    }
};
