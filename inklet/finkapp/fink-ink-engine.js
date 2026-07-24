// FINK INK Engine - Handles INK compilation and story execution
// Extended for minigame and foley tag support

window.FinkInkEngine = {
    story: null,
    finkStoryContent: '',
    currentStoryTags: {},
    lastSeenFinkTag: null,
    lastSeenLinkRel: null,   // # LINKREL: annotation on the pending FINK link
    pendingMinigame: null,
    compiledCount: 0,  // Track successful INK compilations

    // The dream stack (docs/3dmap-idea.md): LINKREL goDeeper pushes the
    // current frame (url + full Ink state incl. position) and descends;
    // END at depth > 0 pops — the outer story resumes mid-breath.
    storyStack: [],
    _pendingRestoreState: null,
    get depth() { return this.storyStack.length; },

    // One retained truth for shell/shelf/assistive tech:
    // phase ∈ loading | play | end | fault, plus dream depth.
    publishStoryState(phase, extra = {}) {
        document.body.dataset.finkDepth = String(this.depth);
        window.FoafOS?.bus.publish('story.state',
            { phase, depth: this.depth, summary: `story ${phase}` + (this.depth ? ` · depth ${this.depth}` : ''), ...extra },
            { retain: true });
    },

    // Private inventory INK - gets injected into all stories
    // Variables are only declared if not already present in story
    getPrivateInventoryInk(storyContent) {
        // Check which variables the story already declares
        const hasDiamonds = /VAR\s+diamonds\s*=/.test(storyContent);
        const hasMegaDiamonds = /VAR\s+mega_diamonds\s*=/.test(storyContent);
        const hasKeys = /VAR\s+keys\s*=/.test(storyContent);
        const hasScore = /VAR\s+score\s*=/.test(storyContent);

        let varDeclarations = '\n// === FINK Private Variables (auto-injected) ===\n';
        if (!hasDiamonds) varDeclarations += 'VAR diamonds = 0\n';
        if (!hasMegaDiamonds) varDeclarations += 'VAR mega_diamonds = 0\n';
        if (!hasKeys) varDeclarations += 'VAR keys = 0\n';
        if (!hasScore) varDeclarations += 'VAR score = 0\n';

        const inventoryKnot = `
// === FINK Private Inventory (auto-injected) ===
=== _inventory ===
#BG:#113
— INVENTORY —

{diamonds > 0:
    💎 Diamonds: {diamonds}
}
{mega_diamonds > 0:
    💠 Mega Diamonds: {mega_diamonds}
}
{keys > 0:
    🔑 Keys: {keys}
}
{score > 0:
    ⭐ Score: {score}
}
{diamonds == 0 && mega_diamonds == 0 && keys == 0 && score == 0:
    Your pockets are empty. Adventures await!
}

+ [World Between Worlds]
    # FINK: world-between-worlds.fink.js
    -> END
`;
        return varDeclarations + inventoryKnot;
    },

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

        // Inject private inventory system
        const privateInk = this.getPrivateInventoryInk(finkContent);
        const augmentedContent = finkContent + privateInk;
        FinkUtils.debugLog('Injected private inventory INK (' + privateInk.length + ' chars)');

        try {
            const compiler = new inkjs.Compiler(augmentedContent);

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
            this.compiledCount++;  // Track successful compilations
            FinkUtils.debugLog('INK compilation successful! (total: ' + this.compiledCount + ')');

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

            // Returning from a dream: restore the saved frame state and
            // resume — deep links don't apply to a pop.
            if (this._pendingRestoreState) {
                const saved = this._pendingRestoreState;
                this._pendingRestoreState = null;
                this.story.state.LoadJson(saved);
                FinkUtils.debugLog('Dream frame restored; resuming outer story');
                FinkUI.clearStory();
                FinkUI.hideStatus();
                this.continueStory();
                return true;
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
            let minigameMode = 'normal';
            let minigameControls = null;
            let detectedKnot = null;  // Track knot during this continue cycle

            // CRITICAL: Check currentPathString BEFORE first Continue() call
            // After initial divert (-> Knot), the path is valid here but becomes null after Continue()
            const initialPathStr = this.story.state.currentPathString;
            FinkUtils.debugLog('Initial path string (before Continue): ' + (initialPathStr || '(null/empty)'));
            if (initialPathStr) {
                const knotPart = initialPathStr.split('.')[0];
                if (knotPart && !/^\d+$/.test(knotPart)) {
                    detectedKnot = knotPart;
                    FinkUtils.debugLog('Initial knot detected: ' + detectedKnot);
                }
            }

            let paragraphIndex = 0;
            let collectedImageTag = null;  // Track IMAGE tag across all Continue() calls
            let collectedBasehref = null;  // Track BASEHREF across all Continue() calls
            let collectedVideoTag = null;  // Track VIDEO tag across all Continue() calls
            while (this.story.canContinue) {
                const p = document.createElement('p');
                p.className = 'text-chunk';
                // Stagger animation with delay based on paragraph index
                p.style.animationDelay = `${paragraphIndex * 0.15}s`;
                paragraphIndex++;
                let rawText = this.story.Continue();
                FinkUtils.debugLog('Story.Continue() output: "' + rawText.trim() + '"');

                // Collect IMAGE/BASEHREF tags from EVERY Continue() call
                // Use LAST image found (not first) so redirects show destination's image
                const iterTags = this.story.currentTags || [];
                iterTags.forEach(tag => {
                    if (tag.includes('IMAGE:')) {
                        collectedImageTag = tag.replace(/^IMAGE:\s*/, '').trim();
                        FinkUtils.debugLog('Collected IMAGE tag: ' + collectedImageTag);
                    }
                    if (tag.includes('VIDEO:')) {
                        collectedVideoTag = tag.replace(/^VIDEO:\s*/, '').trim();
                        FinkUtils.debugLog('Collected VIDEO tag: ' + collectedVideoTag);
                    }
                    if (tag.includes('BASEHREF:')) {
                        collectedBasehref = tag.replace(/.*BASEHREF:\s*/, '').trim();
                        if ((collectedBasehref.startsWith('"') && collectedBasehref.endsWith('"')) ||
                            (collectedBasehref.startsWith("'") && collectedBasehref.endsWith("'"))) {
                            collectedBasehref = collectedBasehref.slice(1, -1);
                        }
                        FinkUtils.debugLog('Collected BASEHREF tag: ' + collectedBasehref);
                    }
                });

                // Track current knot from path (detect knot changes during flow)
                const pathStr = this.story.state.currentPathString;
                FinkUtils.debugLog('Path string: ' + (pathStr || '(null/empty)'));
                if (pathStr) {
                    const knotPart = pathStr.split('.')[0];
                    FinkUtils.debugLog('Knot part extracted: "' + knotPart + '" (isNumeric: ' + /^\d+$/.test(knotPart) + ')');
                    if (knotPart && !/^\d+$/.test(knotPart)) {
                        if (knotPart !== detectedKnot) {
                            detectedKnot = knotPart;
                            FinkUtils.debugLog('Detected knot: ' + detectedKnot);
                        }
                    }
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
                        case 'LINKREL':
                            this.lastSeenLinkRel = value.trim();
                            FinkUtils.debugLog('LINKREL: ' + this.lastSeenLinkRel);
                            break;
                        case 'MINIGAME':
                            // Parse: "gridluck mode=cave controls=dpad" or just "chess"
                            // controls: dpad (full), lite (simple), none (tap only)
                            const mgParts = value.toLowerCase().split(/\s+/);
                            const mgName = mgParts[0];
                            let mgMode = 'normal';
                            let mgControls = null; // null = use default from minigameInfo
                            // Look for mode=xxx and controls=xxx parameters
                            mgParts.slice(1).forEach(p => {
                                if (p.startsWith('mode=')) mgMode = p.replace('mode=', '');
                                if (p.startsWith('controls=')) mgControls = p.replace('controls=', '');
                            });
                            if (mgName === 'chess') minigameType = 'chess';
                            else if (mgName === 'mega') minigameType = 'mega';
                            else if (mgName === 'mudslider') minigameType = 'mudslider';
                            else minigameType = mgName || 'normal';
                            minigameMode = mgMode;
                            minigameControls = mgControls;
                            shouldStartMinigame = true;
                            FinkUtils.debugLog('MINIGAME tag detected: ' + minigameType + ' (mode: ' + mgMode + ', controls: ' + mgControls + ')');
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

            // Story beats are shell events too (read textContent BEFORE the
            // fragment is consumed by the DOM append below).
            const beatText = storyFragment.textContent?.trim();
            FinkUI.replaceStoryContent(storyFragment);
            if (beatText) {
                window.FoafOS?.bus.publish('story.beat',
                    { summary: beatText.slice(0, 140) + (beatText.length > 140 ? '…' : '') });
            }
            this.publishStoryState('play');

            // Apply collected BASEHREF first (affects image path resolution)
            if (collectedBasehref) {
                if (!collectedBasehref.endsWith('/')) collectedBasehref += '/';
                FinkPlayer.mediaBasePath = collectedBasehref;
                FinkUtils.debugLog('Applied collected BASEHREF: ' + collectedBasehref);
            }

            // Show collected IMAGE (gathered from ALL Continue() calls in the loop)
            // This fixes tags on empty lines that would be lost if we only checked final currentTags
            if (collectedImageTag) {
                FinkUtils.debugLog('Showing collected IMAGE: ' + collectedImageTag);
                FinkUI.updateImage(collectedImageTag, FinkPlayer.mediaBasePath?.replace(/\/$/, ''));
            }

            // Show collected VIDEO (gathered from ALL Continue() calls in the loop)
            if (collectedVideoTag) {
                FinkUtils.debugLog('Showing collected VIDEO: ' + collectedVideoTag);
                try {
                    if (typeof FinkUI.updateVideo === 'function') {
                        FinkUI.updateVideo(collectedVideoTag, FinkPlayer.mediaBasePath?.replace(/\/$/, ''));
                    } else {
                        console.error('[FINK] FinkUI.updateVideo is not a function:', typeof FinkUI.updateVideo);
                    }
                } catch (videoError) {
                    console.error('[FINK] Error calling updateVideo:', videoError);
                }
            }

            // Also check knot-level tags as fallback (for edge cases)
            // Skip if we already showed an image from the collected tags
            if (!collectedImageTag && detectedKnot && this.story.TagsForContentAtPath) {
                try {
                    const knotTags = this.story.TagsForContentAtPath(detectedKnot) || [];
                    FinkUtils.debugLog('Knot-level tags for ' + detectedKnot + ': [' + knotTags.join(', ') + ']');
                    knotTags.forEach(tag => {
                        if (tag.includes('IMAGE:')) {
                            const imagePath = tag.replace(/^IMAGE:\s*/, '').trim();
                            FinkUtils.debugLog('Knot-level IMAGE (fallback): ' + imagePath);
                            FinkUI.updateImage(imagePath, FinkPlayer.mediaBasePath?.replace(/\/$/, ''));
                        } else if (tag.includes('BASEHREF:') && !collectedBasehref) {
                            let basePath = tag.replace(/.*BASEHREF:\s*/, '').trim();
                            if ((basePath.startsWith('"') && basePath.endsWith('"')) ||
                                (basePath.startsWith("'") && basePath.endsWith("'"))) {
                                basePath = basePath.slice(1, -1);
                            }
                            if (!basePath.endsWith('/')) basePath += '/';
                            FinkPlayer.mediaBasePath = basePath;
                            FinkUtils.debugLog('Knot-level BASEHREF (fallback): ' + basePath);
                        }
                    });
                } catch (e) {
                    FinkUtils.debugLog('Error getting knot tags: ' + e.message);
                }
            }

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
                // Start minigame - user can use window controls to minimize/maximize
                setTimeout(() => FinkMinigames.startMinigame(minigameType, minigameMode, minigameControls), 800);
                return;
            }

            // Generate choices
            if (this.story.currentChoices.length > 0) {
                FinkUtils.debugLog('Displaying ' + this.story.currentChoices.length + ' choices');
                FinkUI.displayChoices(this.story.currentChoices, (index) => {
                    this.continueStory(index);
                });
                FinkUI.hideStatus();
            } else if (this.storyStack.length > 0) {
                // END at depth is not the end — it is the pop edge:
                // the dream thins and the outer story resumes.
                FinkUtils.debugLog('End of dream — popping stack');
                this.popStoryFrame();
                return;
            } else {
                FinkUtils.debugLog('Reached end of story');
                FinkUI.showEndOfStory();
                FinkUI.hideStatus();
                this.publishStoryState('end');
            }

            // Update stats display
            if (FinkUI.updateStatsDisplay) {
                FinkUI.updateStatsDisplay();
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

        // Document composition by LINKREL (spec §3.4 / docs/3dmap-idea.md):
        // bare FINK = replace (back-compat); goDeeper = push this frame and
        // descend; goShallower = pop (the URL is documentation); oneWay =
        // replace with the way back burned (stack cleared).
        const rel = (this.lastSeenLinkRel || '').toLowerCase();
        this.lastSeenLinkRel = null;
        if (rel === 'goshallower' && this.storyStack.length > 0) {
            this.popStoryFrame();
            return;
        }
        if (rel === 'godeeper') {
            if (this.storyStack.length >= 8) {
                FinkUI.showStatus('The dream refuses: too deep.');
                this.publishStoryState('fault', { reason: 'depth-cap' });
                return;
            }
            this.storyStack.push({
                url: FinkPlayer.currentStoryUrl,
                state: this.story.state.ToJson(),
            });
            FinkUtils.debugLog(`goDeeper: pushed frame, depth now ${this.depth}`);
        } else if (rel === 'oneway') {
            this.storyStack = [];
        }

        FinkUtils.debugLog('Loading external FINK file: ' + this.lastSeenFinkTag);
        FinkUI.showStatus('Loading ' + this.lastSeenFinkTag + '...', true);
        this.publishStoryState('loading', { to: this.lastSeenFinkTag });

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

    // Pop the dream stack: reload the outer document and restore its full
    // Ink state (position included) — the outer story resumes mid-breath.
    popStoryFrame() {
        const frame = this.storyStack.pop();
        if (!frame?.url) return;
        FinkUtils.debugLog(`Popping to ${frame.url} (depth now ${this.depth})`);
        FinkUI.showStatus('Surfacing…', true);
        this.publishStoryState('loading', { to: frame.url, pop: true });
        this._pendingRestoreState = frame.state;
        FinkSandbox.clearLoadRecord(frame.url);
        FinkSandbox.loadViaSandbox(frame.url)
            .then(async (content) => {
                if (content === null) { this._pendingRestoreState = null; return; }
                FinkPlayer.currentStoryUrl = frame.url;
                await this.compileAndRunStory(content);
            })
            .catch((error) => {
                this._pendingRestoreState = null;
                FinkUI.showStatus('Error surfacing from the dream: ' + error.message);
                this.publishStoryState('fault', { reason: 'pop-load' });
            });
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
