// FINK UI Manager - Handles all user interface interactions

window.FinkUI = {
    // DOM elements
    elements: {},

    // State
    animationInProgress: false,
    decisionCount: 0,

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
            dynamicMenuSection: document.getElementById('dynamic-menu-section'),
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

        if (settingsBtn && window.FinkDevPanel) {
            settingsBtn.addEventListener('click', () => FinkDevPanel.toggle());
        }

        // Unlock audio on first interaction
        ['click', 'touchstart'].forEach(event => {
            document.addEventListener(event, () => {
                if (window.FinkAudio) FinkAudio.unlock();
            }, { once: true, passive: true });
        });
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
    },

    handleChoiceClick(index) {
        if (this.animationInProgress) return;
        this.animationInProgress = true;

        // Add player decision marker
        const decision = document.createElement('div');
        decision.className = 'player-decision';
        decision.textContent = this.storedChoices[index].text;
        this.elements.storyOutput.appendChild(decision);

        this.decisionCount++;

        // Brief animation then continue
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
        }
    },

    replaceStoryContent(fragment) {
        if (this.elements.storyOutput) {
            this.elements.storyOutput.innerHTML = '';
            this.elements.storyOutput.appendChild(fragment);
            this.scrollToBottom();
        }
    },

    appendStoryContent(fragment) {
        if (this.elements.storyOutput) {
            this.elements.storyOutput.appendChild(fragment);
            this.scrollToBottom();
        }
    },

    scrollToBottom() {
        if (this.elements.storyOutput) {
            this.elements.storyOutput.scrollTop = this.elements.storyOutput.scrollHeight;
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

    // Dynamic menu from MENU: tags
    populateDynamicMenu(menuItems) {
        const section = this.elements.dynamicMenuSection;
        if (!section) return;

        section.innerHTML = '<div class="dropdown-header">Navigation</div>';

        if (!menuItems || menuItems.length === 0) {
            section.style.display = 'none';
            return;
        }

        menuItems.forEach(item => {
            const button = document.createElement('button');
            button.className = 'dropdown-item';
            button.textContent = item.label;
            button.addEventListener('click', () => {
                if (window.FinkInkEngine?.story) {
                    try {
                        FinkInkEngine.story.ChoosePathString(item.target);
                        this.clearStory();
                        this.clearChoices();
                        FinkInkEngine.continueStory();
                    } catch (error) {
                        FinkUtils.debugLog('Menu navigation error: ' + error.message);
                    }
                }
            });
            section.appendChild(button);
        });

        section.style.display = 'block';
    },

    // Image and media handling
    updateImageFromINKTags(story) {
        if (!story) return;

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
    },

    updateImage(imagePath, rawBasehref) {
        if (!imagePath || !this.elements.storyImage) return;

        const actualImagePath = FinkUtils.resolveLayeredMediaUrl(rawBasehref, imagePath);

        const img = new Image();
        img.onload = () => {
            this.elements.storyImage.src = actualImagePath;
            this.elements.storyImage.alt = imagePath.replace(/\.\w+$/, '').replace(/_/g, ' ');
            this.elements.storyImage.classList.remove('hidden');
            if (this.elements.imageContainer) {
                this.elements.imageContainer.classList.remove('hidden');
            }
        };

        img.onerror = () => {
            FinkUtils.debugLog('Image failed to load: ' + actualImagePath);
            if (this.elements.imageContainer) {
                this.elements.imageContainer.classList.add('hidden');
            }
        };

        img.src = actualImagePath;
    },

    updateVideo(videoPath, rawBasehref) {
        if (!videoPath) return;

        const isLocalFile = videoPath.endsWith('.mp4') || videoPath.endsWith('.webm') || videoPath.endsWith('.mov');
        const isYouTube = !isLocalFile && (videoPath.length === 11 || videoPath.includes('youtube'));

        // Create or get video container
        let videoContainer = document.getElementById('video-container');
        if (!videoContainer) {
            videoContainer = document.createElement('div');
            videoContainer.id = 'video-container';
            videoContainer.style.cssText = 'position:relative;width:100%;max-width:640px;background:#000;margin:1rem auto;border-radius:8px;overflow:hidden;';
            if (this.elements.imageContainer?.parentNode) {
                this.elements.imageContainer.parentNode.insertBefore(videoContainer, this.elements.imageContainer);
            }
        }

        videoContainer.innerHTML = '';

        if (isLocalFile) {
            const storyBase = FinkPlayer.currentStoryUrl ? new URL('.', FinkPlayer.currentStoryUrl).href : window.location.href;
            const actualVideoPath = new URL(videoPath, storyBase).href;

            const video = document.createElement('video');
            video.controls = true;
            video.preload = 'metadata';
            video.playsInline = true;
            video.style.cssText = 'width:100%;display:block;border-radius:8px;';
            video.src = actualVideoPath;

            video.onerror = () => {
                videoContainer.innerHTML = '<p style="color:#f66;padding:1rem;text-align:center;">Video failed to load</p>';
            };

            videoContainer.appendChild(video);
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
            const spinner = this.elements.statusOverlay.querySelector('.status-spinner');
            if (spinner) {
                spinner.style.display = showLoader ? 'inline-block' : 'none';
            }
        }
    },

    hideStatus() {
        if (this.elements.statusOverlay) {
            this.elements.statusOverlay.classList.remove('active');
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
