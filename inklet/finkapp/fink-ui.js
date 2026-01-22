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
            // Stats
            statDiamonds: document.getElementById('stat-diamonds'),
            statMega: document.getElementById('stat-mega'),
            statKeys: document.getElementById('stat-keys'),
            statScore: document.getElementById('stat-score')
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

    // Scroll status bar setup
    scrollTimeout: null,
    setupScrollStatusBar() {
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
            choiceBtn.innerHTML = `${emoji} ${FinkUtils.escapeHtml(choice.text.trim())}`;

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
        const index = Math.floor(Math.random() * FinkConfig.defaultEmojis.length);
        return FinkConfig.defaultEmojis[index];
    },

    // Story content management
    clearStory() {
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
            }, 50);
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
            videoContainer.style.cssText = 'position:relative;width:100%;max-width:640px;min-height:180px;background:#111;margin:1rem auto;border-radius:8px;overflow:hidden;border:2px solid #f0f;';
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
            iframe.src = `https://youtube.com/embed/${videoPath}?autoplay=1`;
            videoContainer.appendChild(iframe);
        }

        if (this.elements.storyImage) {
            this.elements.storyImage.classList.add('hidden');
        }
        videoContainer.style.display = 'block';
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

    // Stats display update
    updateStatsDisplay() {
        if (!window.FinkInkEngine?.story?.variablesState) return;

        const vars = FinkInkEngine.story.variablesState;

        if (this.elements.statDiamonds && vars['diamonds'] !== undefined) {
            this.elements.statDiamonds.textContent = vars['diamonds'];
        }
        if (this.elements.statMega && vars['mega_diamonds'] !== undefined) {
            this.elements.statMega.textContent = vars['mega_diamonds'];
        }
        if (this.elements.statKeys && vars['keys'] !== undefined) {
            this.elements.statKeys.textContent = vars['keys'];
        }
        if (this.elements.statScore && vars['score'] !== undefined) {
            this.elements.statScore.textContent = vars['score'];
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
