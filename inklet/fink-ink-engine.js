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
                
                if (this.currentStoryTags.basehref) {
                    FinkPlayer.mediaBasePath = this.currentStoryTags.basehref;
                    FinkUtils.debugLog('Using BASEHREF from INK: ' + FinkPlayer.mediaBasePath);
                }
                
                FinkUI.clearStory();
                FinkUI.hideStatus();
                this.continueStory();
                
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
            }

            FinkUI.clearChoices();
            let storyFragment = document.createDocumentFragment();

            while (this.story.canContinue) {
                const p = document.createElement('p');
                let rawText = this.story.Continue();
                FinkUtils.debugLog('Story.Continue() output: "' + rawText + '"');
                
                let currentTags = this.story.currentTags || [];
                FinkUtils.debugLog('Current tags: [' + currentTags.join(', ') + ']');

                let escapedText = FinkUtils.escapeHtml(rawText.trim());
                let formattedText = escapedText
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                    .replace(/\*(.*?)\*/g, '<i>$1</i>');

                p.innerHTML = formattedText;
                
                // Handle INK tags (like #BG:#0050e0, #CLASS:info, FINK:)
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
            FinkUI.updateImageFromINKTags(this.story);

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
        
        const allTags = this.story.currentTags || [];
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