// FINK UI Manager - Handles all user interface interactions

window.FinkUI = {
    // DOM elements
    elements: {},

    // State
    animationInProgress: false,
    decisionCount: 0,
    currentSection: null,  // Current story-section element for content block model

    // Initialize UI elements
    init() {
        this.elements = {
            storyOutput: document.getElementById('story-output'),
            choicesContainer: document.getElementById('choices'),
            statusOverlay: document.getElementById('status-overlay'),
            statusText: document.getElementById('status-text'),
            storyImage: document.getElementById('story-image'),
            storyVideo: document.getElementById('story-video'),
            imageContainer: document.getElementById('image-container'),
            // The status bar's contents are built from the story's own
            // `# STATUS:` declaration, so there are no fixed stat ids to
            // cache here any more.
            statsBar: document.getElementById('stats-bar'),
        };

        this.setupEventListeners();
        FinkUtils.debugLog('UI initialized');
    },

    setupEventListeners() {
        // Header buttons
        const homeBtn = document.getElementById('homeBtn');
        const restartBtn = document.getElementById('restartBtn');
        const settingsBtn = document.getElementById('settingsBtn');

        if (homeBtn) {
            homeBtn.addEventListener('click', () => this.handleHomeClick());
        }

        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                if (window.FinkPlayer) FinkPlayer.restartStory();
            });
        }

        // Note: Settings button handler is in fink-devpanel.js to avoid duplication

        // Click-to-dismiss on status overlay (for error messages)
        if (this.elements.statusOverlay) {
            this.elements.statusOverlay.addEventListener('click', () => {
                // Only dismiss if dismissable (showing an error, not loading)
                if (this.elements.statusOverlay.classList.contains('dismissable')) {
                    this.hideStatus();
                }
            });
        }

        // Unlock audio on first interaction
        ['click', 'touchstart'].forEach(event => {
            document.addEventListener(event, () => {
                if (window.FinkAudio) FinkAudio.unlock();
            }, { once: true, passive: true });
        });

        // Radial menu
        this.setupRadialMenu();

        // Scroll status bar
        this.setupScrollStatusBar();
    },

    // Radial menu setup
    setupRadialMenu() {
        const menu = document.getElementById('radial-menu');
        const trigger = document.getElementById('radial-menu-trigger');

        if (trigger && menu) {
            trigger.addEventListener('click', () => {
                menu.classList.toggle('open');
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!menu.contains(e.target)) {
                    menu.classList.remove('open');
                }
            });

            // Menu item handlers
            const menuHome = document.getElementById('menu-home');
            const menuReload = document.getElementById('menu-reload');
            const menuSettings = document.getElementById('menu-settings');
            const menuNavToggle = document.getElementById('menu-nav-toggle');

            if (menuHome) {
                menuHome.addEventListener('click', () => {
                    menu.classList.remove('open');
                    this.handleHomeClick();
                });
            }

            if (menuReload) {
                menuReload.addEventListener('click', () => {
                    menu.classList.remove('open');
                    if (window.FinkPlayer) FinkPlayer.restartStory();
                });
            }

            if (menuSettings) {
                menuSettings.addEventListener('click', () => {
                    menu.classList.remove('open');
                    if (window.FinkDevPanel) FinkDevPanel.toggle();
                });
            }

            if (menuNavToggle) {
                menuNavToggle.addEventListener('click', () => {
                    menu.classList.remove('open');
                    const breadcrumbToggle = document.getElementById('breadcrumb-toggle');
                    if (breadcrumbToggle) breadcrumbToggle.click();
                });
            }
        }
    },

    // Whether a scene fits is a function of the VIEWPORT, so it has to be
    // re-asked when the viewport changes — rotate a phone and a scene that
    // fitted in portrait may not in landscape, and vice versa. Debounced,
    // because a rotation fires a burst of these.
    _fitTimer: null,
    watchFit() {
        const again = () => {
            clearTimeout(this._fitTimer);
            this._fitTimer = setTimeout(() => this.markFit(), 120);
        };
        window.addEventListener('resize', again);
        window.addEventListener('orientationchange', again);
    },

    // Scroll status bar setup
    scrollTimeout: null,
    setupScrollStatusBar() {
        this.watchFit();
        const narrativeView = document.getElementById('narrative-view');
        const statusBar = document.getElementById('scroll-status-bar');

        if (narrativeView && statusBar) {
            let lastScrollTop = 0;
            let scrollTimer = null;

            narrativeView.addEventListener('scroll', () => {
                // Show status bar while scrolling
                statusBar.classList.add('visible');

                // Update stats
                this.updateFinkStats();

                // Clear existing timer
                if (scrollTimer) clearTimeout(scrollTimer);

                // Hide after 1.5s of no scrolling
                scrollTimer = setTimeout(() => {
                    statusBar.classList.remove('visible');
                }, 1500);

                lastScrollTop = narrativeView.scrollTop;
            }, { passive: true });
        }
    },

    // Update FINK stats in the status bar
    updateFinkStats() {
        const encounterEl = document.getElementById('stat-finks-encountered');
        const loadedEl = document.getElementById('stat-finks-loaded');
        const compiledEl = document.getElementById('stat-finks-compiled');

        if (window.FinkNavigation) {
            if (encounterEl) encounterEl.textContent = FinkNavigation.finkHistory?.length || 0;
        }
        if (window.FinkSandbox) {
            if (loadedEl) loadedEl.textContent = FinkSandbox.loadedCount || 0;
        }
        if (window.FinkInkEngine) {
            if (compiledEl) compiledEl.textContent = FinkInkEngine.compiledCount || 0;
        }
    },

    handleHomeClick() {
        FinkUtils.debugLog('Home button pressed');

        // Show confirmation
        const confirmDiv = document.createElement('div');
        confirmDiv.className = 'text-chunk visible';
        confirmDiv.innerHTML = '<span style="color:var(--zx-yellow)">Go home? This will lose current progress.</span>';
        this.elements.storyOutput.appendChild(confirmDiv);
        this.scrollToBottom();

        this.clearChoices();

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'choice-btn';
        confirmBtn.textContent = 'Yes, return to main menu';
        setTimeout(() => confirmBtn.classList.add('ready'), 500);
        confirmBtn.addEventListener('click', () => {
            if (!confirmBtn.classList.contains('ready')) return;
            if (window.FinkFoley) FinkFoley.stop();
            if (window.FinkAudio) FinkAudio.stop();
            this.clearStory();
            this.clearChoices();
            this.decisionCount = 0;
            if (window.FinkMinigames) FinkMinigames.active = false;
            if (window.FinkPlayer) FinkPlayer.returnToMainMenu();
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'choice-btn';
        cancelBtn.textContent = 'No, continue playing';
        setTimeout(() => cancelBtn.classList.add('ready'), 600);
        cancelBtn.addEventListener('click', () => {
            if (!cancelBtn.classList.contains('ready')) return;
            confirmDiv.remove();
            this.clearChoices();
            this.displayStoredChoices();
        });

        this.elements.choicesContainer.appendChild(confirmBtn);
        this.elements.choicesContainer.appendChild(cancelBtn);
    },

    // Choice display
    storedChoices: null,
    storedCallback: null,

    displayChoices(choices, onChoiceCallback) {
        this.storedChoices = choices;
        this.storedCallback = onChoiceCallback;
        this.displayStoredChoices();
    },

    displayStoredChoices() {
        if (!this.storedChoices) return;
        this.clearChoices();

        this.storedChoices.forEach((choice, i) => {
            const choiceBtn = document.createElement('button');
            choiceBtn.className = 'choice-btn';
            choiceBtn.dataset.index = i;

            const emoji = this.chooseEmoji(choice.text);
            choiceBtn.innerHTML = emoji
                ? `${emoji} ${FinkUtils.escapeHtml(choice.text.trim())}`
                : FinkUtils.escapeHtml(choice.text.trim());

            setTimeout(() => choiceBtn.classList.add('ready'), 100 * (i + 1) + 400);

            choiceBtn.addEventListener('click', () => {
                if (!choiceBtn.classList.contains('ready') || this.animationInProgress) return;
                this.handleChoiceClick(i);
            });

            this.elements.choicesContainer.appendChild(choiceBtn);
        });

        // Scroll to ensure choices are visible after they're added
        // Use a delay to allow for choice animation to start
        setTimeout(() => this.scrollToBottom(), 200);
    },

    handleChoiceClick(index) {
        if (this.animationInProgress) return;
        this.animationInProgress = true;

        // Add player decision marker to the CURRENT section before transitioning
        const decision = document.createElement('div');
        decision.className = 'player-decision';
        decision.textContent = this.storedChoices[index].text;

        // Add to current section if it exists, otherwise directly to story output
        if (this.currentSection) {
            this.currentSection.appendChild(decision);
        } else if (this.elements.storyOutput) {
            this.elements.storyOutput.appendChild(decision);
        }

        this.decisionCount++;

        // Brief animation then continue - the callback will start a new section
        setTimeout(() => {
            this.animationInProgress = false;
            if (this.storedCallback) {
                this.storedCallback(index);
            }
        }, 300);
    },

    chooseEmoji(choiceText) {
        const text = choiceText.toLowerCase();
        for (const [keyword, emoji] of Object.entries(FinkConfig.emojiMap)) {
            if (text.includes(keyword)) {
                return emoji;
            }
        }
        // No decorative fallback. Keyword-matched emojis above are
        // SEMANTIC — 🚶 on "go", 💎 on "gems" — and earn their place. The
        // old fallback drew a random 🚀/✨/🌟 per RENDER, so the same menu
        // wore different ornaments on every load, stacked on top of the
        // skin's own choice marker (--sk-choice-marker). One decoration
        // owner: the skin marks choices; emojis appear only when they
        // mean something.
        return '';
    },

    // Story content management
    clearStory() {
        // A new story starts on the classic layout; its first video scene
        // re-enters theatre, and a ✕ in the OLD story shouldn't veto it.
        this._theatreOff = false;
        this._exitTheatre();
        if (this.elements.storyOutput) {
            this.elements.storyOutput.innerHTML = '';
            this.elements.storyOutput.classList.remove('history-expanded');
        }
        this.currentSection = null;
        this.historyToggle = null;
    },

    // Ensure history toggle button exists
    ensureHistoryToggle() {
        if (this.historyToggle) return this.historyToggle;

        const toggle = document.createElement('button');
        toggle.className = 'history-toggle';
        toggle.textContent = '[+] History';
        toggle.addEventListener('click', () => {
            const expanded = this.elements.storyOutput.classList.toggle('history-expanded');
            toggle.textContent = expanded ? '[-] History' : '[+] History';
            toggle.classList.toggle('expanded', expanded);

            // Update inline styles to match expanded state
            const pastSections = this.elements.storyOutput.querySelectorAll('.story-section.past');
            pastSections.forEach(section => {
                section.style.display = expanded ? 'block' : 'none';
            });
        });

        if (this.elements.storyOutput) {
            this.elements.storyOutput.insertBefore(toggle, this.elements.storyOutput.firstChild);
        }
        this.historyToggle = toggle;
        return toggle;
    },

    // Start a new content section, marking old ones as past
    startNewSection() {
        // Mark all existing sections as past
        if (this.elements.storyOutput) {
            const existingSections = this.elements.storyOutput.querySelectorAll('.story-section.current');
            const hasPastContent = existingSections.length > 0;

            FinkUtils.debugLog(`startNewSection: Found ${existingSections.length} current sections to mark as past`);

            existingSections.forEach((section, i) => {
                section.classList.remove('current');
                section.classList.add('past');
                // Force hide with inline style as backup
                section.style.display = 'none';
                FinkUtils.debugLog(`Marked section ${i} as past (display:none)`);
            });

            // Show history toggle if there's past content
            if (hasPastContent) {
                this.ensureHistoryToggle();
                this.historyToggle.classList.add('has-history');
            }
        }

        // Create new current section
        const section = document.createElement('div');
        section.className = 'story-section current';
        this.currentSection = section;
        this.decisionCount++;

        FinkUtils.debugLog(`Created new section (decisionCount: ${this.decisionCount})`);

        if (this.elements.storyOutput) {
            this.elements.storyOutput.appendChild(section);
        }

        return section;
    },

    replaceStoryContent(fragment) {
        if (this.elements.storyOutput) {
            const section = this.startNewSection();
            section.appendChild(fragment);
            this.scrollToCurrentSection();
        }
    },

    appendStoryContent(fragment) {
        if (this.elements.storyOutput) {
            if (!this.currentSection) {
                this.startNewSection();
            }
            this.currentSection.appendChild(fragment);
        }
    },

    // Scroll to top to see current section
    scrollToCurrentSection() {
        const narrativeView = document.getElementById('narrative-view');
        if (narrativeView && this.currentSection) {
            setTimeout(() => {
                // Scroll to show the current section with a small offset from top
                // This ensures the image (if any) is visible along with content
                const sectionTop = this.currentSection.offsetTop;
                const historyToggle = narrativeView.querySelector('.history-toggle');
                const toggleHeight = historyToggle ? historyToggle.offsetHeight : 0;
                // Scroll to section top, accounting for history toggle
                const scrollTarget = Math.max(0, sectionTop - toggleHeight - 10);
                narrativeView.scrollTo({ top: scrollTarget, behavior: 'smooth' });
            }, 100); // Slightly longer delay to ensure images start loading
        }
    },

    scrollToBottom() {
        // Scroll the narrative view container, not just story output
        const narrativeView = document.getElementById('narrative-view');
        if (narrativeView) {
            // Use smooth scroll with a small delay to ensure content is rendered
            setTimeout(() => {
                narrativeView.scrollTo({
                    top: narrativeView.scrollHeight,
                    behavior: 'smooth'
                });
                this.markFit();
            }, 50);
        }
    },

    /**
     * Does this scene already fit the screen?
     *
     * The narrative view carries a deliberate scroll-past-the-end zone —
     * bottom padding plus a tail of TV static — so the last line can rest
     * mid-screen instead of against the bottom edge. Under a long scene
     * that is right. Under a two-line beat it is ~70% of a phone screen of
     * void, with one whisper of text adrift at the top; reported from the
     * field, and it looked broken because it WAS broken.
     *
     * CSS cannot ask "is my content taller than me", so measure it here and
     * say so in an attribute. `data-fits="yes"` drops the affordance that
     * has nothing to afford and centres the scene instead.
     *
     * Measured with the zone temporarily suppressed — otherwise the padding
     * we are deciding about is itself what makes the content overflow, and
     * the answer is always "no".
     */
    markFit() {
        const nv = document.getElementById('narrative-view');
        if (!nv) return;
        const prev = nv.getAttribute('data-fits');
        nv.setAttribute('data-fits', 'yes');          // suppress, then measure
        // +2px of slack: sub-pixel layout should not flip this back and forth.
        const fits = nv.scrollHeight <= nv.clientHeight + 2;
        if (!fits) nv.setAttribute('data-fits', 'no');
        if (nv.getAttribute('data-fits') !== prev) {
            FinkUtils.debugLog(`Layout: scene ${fits ? 'fits' : 'overflows'} the viewport`);
        }
    },

    showEndOfStory() {
        const pEnd = document.createElement('p');
        pEnd.className = 'mega';
        pEnd.textContent = '— THE END —';
        if (this.elements.storyOutput) {
            this.elements.storyOutput.appendChild(pEnd);
        }
    },

    clearChoices() {
        if (this.elements.choicesContainer) {
            this.elements.choicesContainer.innerHTML = '';
        }
    },

    // Image and media handling - returns the image path shown (for de-duplication)
    updateImageFromINKTags(story) {
        if (!story) return null;

        const currentTags = story.currentTags || [];
        let imageToShow = null;
        let videoToShow = null;
        let newBasePath = null;

        currentTags.forEach(tag => {
            if (tag.includes('IMAGE:')) {
                imageToShow = tag.replace(/^IMAGE:\s*/, '').trim();
            } else if (tag.includes('VIDEO:')) {
                videoToShow = tag.replace(/^VIDEO:\s*/, '').trim();
            } else if (tag.includes('BASEHREF:')) {
                newBasePath = tag.replace(/.*BASEHREF:\s*/, '').trim();
                if ((newBasePath.startsWith('"') && newBasePath.endsWith('"')) ||
                    (newBasePath.startsWith("'") && newBasePath.endsWith("'"))) {
                    newBasePath = newBasePath.slice(1, -1);
                }
                if (!newBasePath.endsWith('/')) newBasePath += '/';
            }
        });

        if (newBasePath) {
            FinkPlayer.mediaBasePath = newBasePath;
        }

        const currentRawBasehref = newBasePath ? newBasePath.replace(/\/$/, '') :
                             (FinkPlayer.mediaBasePath ? FinkPlayer.mediaBasePath.replace(/\/$/, '') : null);

        if (videoToShow) {
            this.updateVideo(videoToShow, currentRawBasehref);
        }

        if (imageToShow) {
            this.updateImage(imageToShow, currentRawBasehref);
        }

        return imageToShow; // Return for de-duplication
    },

    // Add image to current section (images live inside content chunks now)
    updateImage(imagePath, rawBasehref) {
        if (!imagePath || !this.currentSection) {
            FinkUtils.debugLog(`updateImage SKIPPED: path=${imagePath}, hasSection=${!!this.currentSection}`);
            return;
        }

        FinkUtils.debugLog(`updateImage CALLED: ${imagePath} (decision #${this.decisionCount})`);
        const actualImagePath = FinkUtils.resolveLayeredMediaUrl(rawBasehref, imagePath);

        // CRITICAL: Capture the target section NOW, not when onload fires
        // Otherwise, if user navigates before image loads, it goes to wrong section
        const targetSection = this.currentSection;
        const capturedDecisionCount = this.decisionCount; // For debugging

        // Remove any existing media from target section
        const existingMedia = targetSection.querySelector('.section-media');
        if (existingMedia) {
            existingMedia.remove();
        }

        // Create image element inside target section
        const img = document.createElement('img');
        img.className = 'section-media';
        img.alt = imagePath.replace(/\.\w+$/, '').replace(/_/g, ' ');

        img.onload = () => {
            // CRITICAL: Only insert if:
            // 1. Section is still in DOM (hasn't been cleared)
            // 2. Section is still CURRENT (not marked as past)
            // This prevents old images from appearing in past sections that are briefly visible
            const nowDecisionCount = this.decisionCount;
            if (targetSection.parentNode && targetSection.classList.contains('current')) {
                targetSection.insertBefore(img, targetSection.firstChild);
                FinkUtils.debugLog(`Image INSERTED: ${imagePath} (was decision #${capturedDecisionCount}, now #${nowDecisionCount})`);
            } else {
                FinkUtils.debugLog(`Image BLOCKED: ${imagePath} (was decision #${capturedDecisionCount}, now #${nowDecisionCount}) - section is ${targetSection.parentNode ? 'past' : 'removed'}`);
            }
        };

        img.onerror = () => {
            FinkUtils.debugLog('Image failed to load: ' + actualImagePath);
        };

        img.src = actualImagePath;
    },

    updateVideo(videoPath, rawBasehref) {
        console.log('[VIDEO-TRACE] updateVideo CALLED, path:', videoPath);
        FinkUtils.debugLog('updateVideo CALLED with path: ' + videoPath);
        if (!videoPath) {
            console.log('[VIDEO-TRACE] no videoPath, returning');
            return;
        }

        const isLocalFile = videoPath.endsWith('.mp4') || videoPath.endsWith('.webm') || videoPath.endsWith('.mov');
        const isYouTube = !isLocalFile && (videoPath.length === 11 || videoPath.includes('youtube'));
        console.log('[VIDEO-TRACE] isLocalFile=' + isLocalFile + ', isYouTube=' + isYouTube);

        // Create or get video container
        let videoContainer = document.getElementById('video-container');
        console.log('[VIDEO-TRACE] existing container:', videoContainer);
        if (!videoContainer) {
            videoContainer = document.createElement('div');
            videoContainer.id = 'video-container';
            // STICKY, not static. The container is inserted above the
            // story text, so as passages accumulate the reader scrolls
            // down and the video leaves the top of the screen with
            // nothing to say it is up there. Reported from the field:
            // "often excess text scrolls us past the video and it is not
            // obvious we must scroll up." #narrative-view is the
            // scroller, and this is inside it, so sticky pins it while
            // the prose moves underneath — the phone-video idiom.
            videoContainer.style.cssText = 'position:sticky;top:0;z-index:5;width:100%;max-width:640px;min-height:180px;background:#111;margin:1rem auto;border-radius:8px;overflow:hidden;border:2px solid #f0f;';
            // Insert before story output for better visibility
            console.log('[VIDEO-TRACE] this.elements:', this.elements);
            if (this.elements.storyOutput) {
                this.elements.storyOutput.parentNode.insertBefore(videoContainer, this.elements.storyOutput);
                console.log('[VIDEO-TRACE] inserted before storyOutput');
            } else {
                // Fallback: append to narrative view or main
                const narrativeView = document.getElementById('narrative-view') || document.querySelector('main') || document.body;
                narrativeView.insertBefore(videoContainer, narrativeView.firstChild);
                console.log('[VIDEO-TRACE] inserted into narrative-view/main');
            }
            FinkUtils.debugLog('Video container created and inserted into DOM');
        }

        // Show loading state
        videoContainer.innerHTML = '<p style="color:#f0f;padding:1rem;text-align:center;">Loading video...</p>';
        console.log('[VIDEO-TRACE] cleared container, isLocalFile:', isLocalFile);

        if (isLocalFile) {
            const storyBase = FinkPlayer.currentStoryUrl ? new URL('.', FinkPlayer.currentStoryUrl).href : window.location.href;
            console.log('[VIDEO-TRACE] storyBase:', storyBase);
            const actualVideoPath = new URL(videoPath, storyBase).href;
            console.log('[VIDEO-TRACE] actualVideoPath:', actualVideoPath);

            const video = document.createElement('video');
            video.controls = true;
            video.preload = 'auto';
            video.playsInline = true;
            video.setAttribute('webkit-playsinline', 'true');
            video.style.cssText = 'width:100%;min-height:180px;display:block;border-radius:8px;background:#000;';
            video.src = actualVideoPath;

            video.onloadeddata = () => {
                console.log('[VIDEO-TRACE] video loaded successfully');
                // Clear loading message, keep only the video
                const loadingMsg = videoContainer.querySelector('p');
                if (loadingMsg) loadingMsg.remove();
            };

            video.onerror = (e) => {
                console.log('[VIDEO-TRACE] video error event', e);
                videoContainer.innerHTML = '<p style="color:#f66;padding:1rem;text-align:center;">Video failed to load<br><small style="opacity:0.7;">' + actualVideoPath + '</small></p>';
            };

            // Clear loading message and add video
            videoContainer.innerHTML = '';
            videoContainer.appendChild(video);
            console.log('[VIDEO-TRACE] video element appended, src:', actualVideoPath);
            FinkUtils.debugLog('updateVideo: video element appended, src=' + actualVideoPath);
        } else if (isYouTube) {
            videoContainer.style.paddingBottom = '56.25%';

            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:none;';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            // enablejsapi so the player reports state: theatre mode reveals
            // the docked text panel the moment the video ENDS.
            iframe.src = `https://youtube.com/embed/${videoPath}?autoplay=1&enablejsapi=1`;
            iframe.addEventListener('load', () => {
                // YT only emits events after a client says it is listening.
                try {
                    iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'fink-theatre', channel: 'widget' }), '*');
                } catch (e) { /* cross-origin hiccup: no end signal, panel stays manual */ }
            });
            videoContainer.appendChild(iframe);
        }

        if (this.elements.storyImage) {
            this.elements.storyImage.classList.add('hidden');
        }
        videoContainer.style.display = 'block';
        // A pinned video costs ~200px of a phone screen, so hand it back
        // on request. Collapsing beats un-pinning: the reader chooses
        // between the picture and the prose instead of losing the video
        // off the top and having to work out that it went up there.
        this._addVideoCollapse(videoContainer);
        // Video scenes invert the hierarchy: the video IS the scene, so it
        // takes the screen and the prose rides on top in a dockable panel.
        this._enterTheatre(videoContainer, isLocalFile ? videoContainer.querySelector('video') : null);
    },

    // ── THEATRE MODE ────────────────────────────────────────────────────
    // A scene led by video maximizes it: the video becomes a full-viewport
    // stage and #story-output + #choices move into a floating panel overlaid
    // on it. The panel minimizes to a slim tab on the right edge (the video
    // is the point; the text waits in the wings) and auto-reveals when the
    // video finishes — "the text after it plays". Its ✕ exits theatre back
    // to the classic sticky-video-above-prose layout for the rest of the
    // story. Everything MOVES (same nodes, same ids) rather than clones, so
    // every other module's getElementById keeps working.
    _theatreOff: false,       // reader closed theatre; respect that for this story

    _enterTheatre(videoContainer, localVideoEl) {
        if (this._theatreOff) return;
        const main = document.querySelector('main') || document.body;

        let panel = document.getElementById('theatre-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'theatre-panel';
            panel.setAttribute('role', 'region');
            panel.setAttribute('aria-label', 'Story text');
            panel.innerHTML = `
              <div class="theatre-panel-bar">
                <span class="theatre-panel-title">STORY</span>
                <span class="theatre-panel-controls">
                  <button type="button" class="theatre-dock" aria-label="Tuck story text to the side" title="Tuck to the side">⇥</button>
                  <button type="button" class="theatre-exit" aria-label="Exit video theatre" title="Exit theatre">✕</button>
                </span>
              </div>
              <div class="theatre-panel-body"></div>`;
            panel.querySelector('.theatre-dock').addEventListener('click', () => this._dockTheatrePanel(true));
            panel.querySelector('.theatre-exit').addEventListener('click', () => { this._theatreOff = true; this._exitTheatre(); });
            // The docked tab IS the panel, collapsed: clicking it restores.
            panel.addEventListener('click', (e) => {
                if (panel.classList.contains('docked') && !e.target.closest('button')) this._dockTheatrePanel(false);
            });
            main.appendChild(panel);
        }

        const body = panel.querySelector('.theatre-panel-body');
        if (this.elements.storyOutput && this.elements.storyOutput.parentNode !== body) {
            body.appendChild(this.elements.storyOutput);
        }
        if (this.elements.choicesContainer && this.elements.choicesContainer.parentNode !== body) {
            body.appendChild(this.elements.choicesContainer);
        }
        document.body.dataset.theatre = 'on';
        panel.classList.remove('docked');

        // Reveal-on-end. Local <video>: the ended event. YouTube: state 0
        // via the iframe API messages requested in updateVideo.
        if (localVideoEl) {
            localVideoEl.addEventListener('ended', () => this._dockTheatrePanel(false), { once: true });
        }
        if (!this._theatreYtListener) {
            this._theatreYtListener = (e) => {
                if (typeof e.origin !== 'string' || !/(^https?:\/\/)([^/]*\.)?(youtube\.com|youtube-nocookie\.com)$/.test(e.origin)) return;
                let d = e.data;
                if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return; } }
                if (d && d.event === 'onStateChange' && d.info === 0) this._dockTheatrePanel(false);
            };
            window.addEventListener('message', this._theatreYtListener);
        }
    },

    _dockTheatrePanel(docked) {
        const panel = document.getElementById('theatre-panel');
        if (!panel || document.body.dataset.theatre !== 'on') return;
        panel.classList.toggle('docked', docked);
        const dockBtn = panel.querySelector('.theatre-dock');
        if (dockBtn) dockBtn.setAttribute('aria-expanded', String(!docked));
        if (docked) panel.setAttribute('aria-label', 'Story text (tucked aside — activate to reopen)');
        else panel.setAttribute('aria-label', 'Story text');
    },

    _exitTheatre() {
        const panel = document.getElementById('theatre-panel');
        const nv = document.getElementById('narrative-view');
        if (nv) {
            // Original order: media, then prose, then choices.
            if (this.elements.storyOutput) nv.appendChild(this.elements.storyOutput);
            if (this.elements.choicesContainer) nv.appendChild(this.elements.choicesContainer);
        }
        if (panel) panel.remove();
        delete document.body.dataset.theatre;
    },

    // Collapse/expand control for the sticky video. Re-added after every
    // load because the container's innerHTML is replaced each time.
    _addVideoCollapse(container) {
        // a new video should arrive open, whatever the last one was left as
        container.dataset.collapsed = '0';
        // remember the aspect box the media type set, so expanding restores
        // the right one (YouTube uses 56.25%; a local <video> uses none)
        container.dataset.padBottom = container.style.paddingBottom || '';
        container.style.minHeight = '180px';
        container.style.height = '';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'video-collapse';
        btn.setAttribute('aria-expanded', 'true');
        btn.setAttribute('aria-controls', 'video-container');
        btn.setAttribute('aria-label', 'Collapse video');
        btn.textContent = '▾';
        btn.style.cssText = 'position:absolute;top:4px;right:4px;z-index:6;' +
            'min-width:32px;min-height:32px;border-radius:6px;border:1px solid #f0f;' +
            'background:rgba(0,0,0,0.65);color:#f0f;font:inherit;line-height:1;cursor:pointer;';
        btn.addEventListener('click', () => {
            const wasOpen = container.dataset.collapsed !== '1';
            container.dataset.collapsed = wasOpen ? '1' : '0';
            container.style.minHeight = wasOpen ? '0' : '180px';
            container.style.height = wasOpen ? '34px' : '';
            // The YouTube branch makes its 16:9 box with
            // `padding-bottom: 56.25%`, and an element can never be
            // shorter than its own padding — setting height alone left it
            // exactly as tall as before. Same lesson this repo already
            // learned in the split-pane layout.
            container.style.paddingBottom = wasOpen ? '0' : (container.dataset.padBottom || '');
            btn.textContent = wasOpen ? '▴' : '▾';
            btn.setAttribute('aria-expanded', String(!wasOpen));
            btn.setAttribute('aria-label', wasOpen ? 'Expand video' : 'Collapse video');
        });
        container.appendChild(btn);
    },

    // Status and messaging
    showStatus(message, showLoader = false) {
        if (this.elements.statusText) {
            this.elements.statusText.textContent = message;
        }
        if (this.elements.statusOverlay) {
            this.elements.statusOverlay.classList.add('active');
            // Add dismissable class when showing error (no loader)
            this.elements.statusOverlay.classList.toggle('dismissable', !showLoader);
            const spinner = this.elements.statusOverlay.querySelector('.status-spinner');
            if (spinner) {
                spinner.style.display = showLoader ? 'inline-block' : 'none';
            }
        }
    },

    hideStatus() {
        if (this.elements.statusOverlay) {
            this.elements.statusOverlay.classList.remove('active');
            this.elements.statusOverlay.classList.remove('dismissable');
        }
    },

    // ── the status line is the STORY's, not the player's ───────────────
    //
    // It used to be three hardcoded ids in the markup and three hardcoded
    // lines here: diamonds, mega, score. Every story got the treasure
    // economy's status bar whether or not it had a treasure economy, and
    // a story with a flock size or a fuel gauge had nowhere to put it.
    //
    // Now a story declares its own with `# STATUS:` (see the ink engine),
    // and this renders whatever it asked for. Stories that declare
    // nothing keep the old three, so nothing that exists today changes.

    // The default, which is simply what was hardcoded before.
    DEFAULT_STATUS: [
        { var: 'diamonds', icon: '💎', hideWhenZero: true },
        { var: 'mega_diamonds', icon: '👑', hideWhenZero: true },
        { var: 'score', icon: '⭐', hideWhenZero: true },
    ],
    statusItems: null,          // null = story said nothing, use the default

    /** Called by the ink engine for each `# STATUS:` tag. */
    setStatusItems(items) {
        this.statusItems = Array.isArray(items) ? items : null;
        this._statusBuilt = false;
        this.updateStatsDisplay();
    },

    _statusSpec() { return this.statusItems || this.DEFAULT_STATUS; },

    _buildStatusBar() {
        const bar = document.getElementById('stats-bar');
        if (!bar) return;
        bar.textContent = '';
        for (const item of this._statusSpec()) {
            const span = document.createElement('span');
            span.className = 'stat-item';
            span.dataset.statusVar = item.var || '';
            // A status item is read out as "12 diamonds", not "12" — the
            // emoji alone is silence to a screen reader.
            span.setAttribute('role', 'status');
            const icon = document.createElement('span');
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = (item.icon || '') + ' ';
            const val = document.createElement('span');
            val.className = 'stat-value';
            span.append(icon, val);
            bar.appendChild(span);
        }
        this._statusBuilt = true;
    },

    updateStatsDisplay() {
        if (!window.FinkInkEngine?.story?.variablesState) return;
        const vars = FinkInkEngine.story.variablesState;
        if (!this._statusBuilt) this._buildStatusBar();
        const bar = document.getElementById('stats-bar');
        if (!bar) return;

        const spec = this._statusSpec();
        [...bar.children].forEach((span, i) => {
            const item = spec[i];
            if (!item) return;
            let raw;
            try { raw = vars[item.var]; } catch (e) { raw = undefined; }
            const n = Number(raw) || 0;
            const text = this._formatStat(item, raw, n);
            span.querySelector('.stat-value').textContent = text;
            span.setAttribute('aria-label', `${text} ${item.label || item.var || ''}`.trim());
            // hideWhenZero is the old behavior; a gauge usually wants to
            // stay put at zero, so it is opt-in rather than automatic.
            const show = item.hideWhenZero === false ? true : (item.hideWhenZero ? n > 0 : n > 0);
            span.classList.toggle('visible', show);
        });
    },

    _formatStat(item, raw, n) {
        switch (item.format) {
            case 'bar': {
                const max = Number(item.max) || 10;
                const filled = Math.max(0, Math.min(max, Math.round(n)));
                return '▮'.repeat(filled) + '▯'.repeat(Math.max(0, max - filled));
            }
            case 'percent': {
                const max = Number(item.max) || 100;
                return `${Math.round((n / max) * 100)}%`;
            }
            case 'time': {
                const m = Math.floor(n / 60), sec = Math.floor(n % 60);
                return `${m}:${String(sec).padStart(2, '0')}`;
            }
            case 'text':
                return String(raw ?? '');
            default:
                return String(n);
        }
    },

    // View switching (narrative/minigame)
    switchView(viewName) {
        const narrativeView = document.getElementById('narrative-view');
        const minigameView = document.getElementById('minigame-view');

        if (narrativeView) narrativeView.classList.toggle('active', viewName === 'narrative');
        if (minigameView) minigameView.classList.toggle('active', viewName === 'minigame');
    }
};
