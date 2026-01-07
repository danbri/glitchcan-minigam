// FINK UI Manager - Handles all user interface interactions
window.FinkUI = {
    // DOM elements
    elements: {},
    
    // State
    isFullscreen: false,
    choicesVisible: true,
    isImageFullscreen: false,
    animationInProgress: false,
    expandingElement: null,
    
    // Initialize UI elements
    init() {
        this.elements = {
            appContainer: document.getElementById('app-container'),
            menuTrigger: document.getElementById('menu-trigger'),
            titleBar: document.getElementById('title-bar'),
            storyElement: document.getElementById('story'),
            choicesContainer: document.getElementById('choices-container'),
            statusOverlay: document.getElementById('status-overlay'),
            statusText: document.getElementById('status-text'),
            // Form inputs removed - using config-based loading
            storyImage: document.getElementById('story-image'),
            storyVideo: document.getElementById('story-video'),
            imageContainer: document.getElementById('image-container'),
            storyContentContainer: document.getElementById('story-content-container'),
            choiceToggle: document.getElementById('choice-toggle'),
            fullscreenToggle: document.getElementById('fullscreen-toggle'),
            menuButton: document.getElementById('menu-button'),
            fullscreenButton: document.getElementById('fullscreen-button'),
            // urlForm removed - using config-based loading
            storyTitle: document.getElementById('story-title')
        };
        
        this.setupEventListeners();
        FinkUtils.debugLog('UI initialized');
    },
    
    setupEventListeners() {
        // Menu controls (form removed) - with null checks
        if (this.elements.fullscreenButton) {
            this.elements.fullscreenButton.addEventListener('click', () => this.toggleFullscreen());
        }
        if (this.elements.choiceToggle) {
            this.elements.choiceToggle.addEventListener('click', () => this.toggleChoices());
        }
        if (this.elements.fullscreenToggle) {
            this.elements.fullscreenToggle.addEventListener('click', () => this.toggleImageFullscreen());
        }
        
        // Menu trigger - with null checks
        if (this.elements.menuTrigger) {
            this.elements.menuTrigger.addEventListener('mouseenter', () => {
                this.elements.appContainer.classList.add('show-menu');
            });
            this.elements.menuTrigger.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.elements.titleBar) {
                    this.elements.titleBar.classList.toggle('visible');
                }
            });
        }
        
        if (this.elements.titleBar) {
            this.elements.titleBar.addEventListener('mouseleave', () => {
                this.elements.appContainer.classList.remove('show-menu');
            });
        }
        // Touch handling
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        // Choice click handling - both mouse and touch
        document.addEventListener('click', (e) => {
            const choiceEl = e.target.closest('.choice');
            if (choiceEl && !this.animationInProgress) {
                const index = parseInt(choiceEl.dataset.index);
                const actualCallback = choiceEl._callback;
                if (actualCallback) {
                    this.handleChoiceClick({currentTarget: choiceEl}, index, actualCallback);
                }
            }
        });
        
        // Story menu controls
        const storyRestart = document.getElementById('story-restart');
        const returnToMain = document.getElementById('return-to-main');
        const storyBookmark = document.getElementById('story-bookmark');
        const storyGotoBookmark = document.getElementById('story-goto-bookmark');
        const openDevtools = document.getElementById('open-devtools');
        
        if (storyRestart) storyRestart.addEventListener('click', () => FinkPlayer.restartStory());
        if (returnToMain) returnToMain.addEventListener('click', () => FinkPlayer.returnToMainMenu());
        if (storyBookmark) storyBookmark.addEventListener('click', () => FinkPlayer.bookmarkCurrentKnot());
        if (storyGotoBookmark) storyGotoBookmark.addEventListener('click', () => FinkPlayer.gotoBookmarkedKnot());
        if (openDevtools) openDevtools.addEventListener('click', () => FinkUtils.toggleDebugConsole());
        
        // Debug console
        const debugToggle = document.getElementById('debug-toggle');
        if (debugToggle) {
            debugToggle.addEventListener('click', () => FinkUtils.toggleDebugConsole());
        }
    },
    
    // Choice generation and display
    displayChoices(choices, onChoiceCallback) {
        this.clearChoices();
        
        choices.forEach((choice, i) => {
            FinkUtils.debugLog('Choice ' + i + ' raw text: "' + choice.text + '"');
            const emoji = this.chooseEmoji(choice.text);
            FinkUtils.debugLog('Choice ' + i + ' emoji: "' + emoji + '"');
            const cleanText = choice.text.trim();
            FinkUtils.debugLog('Choice ' + i + ' clean text: "' + cleanText + '"');
            
            const choiceEl = document.createElement('div');
            const choiceNumber = Math.min(i + 1, 3);
            choiceEl.className = `choice choice-${choiceNumber}`;
            choiceEl.dataset.index = i;
            choiceEl.dataset.callback = 'tempChoiceCallback'; // Will be replaced with actual callback
            
            choiceEl.innerHTML = `
                <div class="choice-emoji">${emoji}</div>
                <svg class="choice-label-svg" width="100%" height="40">
                    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
                          class="choice-label-text" stroke="black" stroke-width="3" fill="black">${FinkUtils.escapeHtml(cleanText)}</text>
                    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
                          class="choice-label-text" fill="white">${FinkUtils.escapeHtml(cleanText)}</text>
                </svg>`;
            
            // Store the callback for this choice
            choiceEl._callback = onChoiceCallback;
            
            FinkUtils.debugLog('Choice ' + i + ' HTML: ' + choiceEl.innerHTML.substring(0, 200));
            
            this.elements.choicesContainer.appendChild(choiceEl);
        });
        
        setTimeout(() => {
            this.elements.choicesContainer.classList.remove('hidden');
        }, 500);
    },
    
    chooseEmoji(choiceText) {
        // Extract emoji from choice text if present
        const emojiMatch = choiceText.match(/[🎮📚❓🚀📖🌿🇺🇦🎭🔧📱⚙️🎨]/u);
        if (emojiMatch) {
            return emojiMatch[0];
        }
        
        // Fallback to keyword mapping
        const text = choiceText.toLowerCase();
        for (const [keyword, emoji] of Object.entries(FinkConfig.emojiMap)) {
            if (text.includes(keyword)) {
                return emoji;
            }
        }
        
        const index = Math.floor(Math.random() * FinkConfig.defaultEmojis.length);
        return FinkConfig.defaultEmojis[index];
    },
    
    handleChoiceClick(event, index, callback) {
        if (this.animationInProgress) return;
        this.animationInProgress = true;
        
        const choiceElement = event.currentTarget;
        
        // Get the actual callback from the element
        const actualCallback = choiceElement._callback || callback;
        
        // Create expanding animation
        this.expandingElement = document.createElement('div');
        this.expandingElement.className = 'expanding-choice';
        this.expandingElement.style.backgroundColor = getComputedStyle(choiceElement).backgroundColor;
        const rect = choiceElement.getBoundingClientRect();
        this.expandingElement.style.left = `${rect.left}px`;
        this.expandingElement.style.width = `${rect.width}px`;
        this.expandingElement.innerHTML = choiceElement.innerHTML;
        document.body.appendChild(this.expandingElement);
        
        requestAnimationFrame(() => {
            this.expandingElement.style.height = '100%';
            this.expandingElement.style.left = '0';
            this.expandingElement.style.width = '100%';
            
            this.elements.choicesContainer.style.opacity = '0';
            
            setTimeout(() => {
                this.expandingElement.style.backgroundColor = 'rgba(0,0,0,0)';
                this.elements.storyElement.classList.add('fading');
            }, 500);
            
            setTimeout(() => {
                this.expandingElement.remove();
                this.expandingElement = null;
                this.elements.storyElement.classList.remove('fading');
                if (actualCallback) {
                    actualCallback(index);
                }
                this.elements.choicesContainer.style.opacity = '1';
                this.animationInProgress = false;
            }, 1000);
        });
    },
    
    // Story content management
    clearStory() {
        this.elements.storyElement.innerHTML = '';
    },
    
    replaceStoryContent(fragment) {
        this.elements.storyElement.innerHTML = '';
        this.elements.storyElement.appendChild(fragment);
    },
    
    showEndOfStory() {
        const pEnd = document.createElement('p');
        pEnd.style.opacity = 0.6;
        pEnd.textContent = '— THE END —';
        this.elements.storyElement.appendChild(pEnd);
    },
    
    clearChoices() {
        this.elements.choicesContainer.innerHTML = '';
    },
    
    // Image and media handling
    updateImageFromINKTags(story) {
        if (!story) return;
        
        const currentTags = story.currentTags || [];
        FinkUtils.debugLog('Current INK tags: [' + currentTags.join(', ') + ']');
        
        let imageToShow = null;
        let newBasePath = null;
        
        currentTags.forEach(tag => {
            FinkUtils.debugLog('Processing tag: "' + tag + '"');
            if (tag.includes('IMAGE:')) {
                imageToShow = tag.replace(/^IMAGE:\s*/, '').trim();
                FinkUtils.debugLog('Found IMAGE tag: ' + imageToShow);
            } else if (tag.includes('BASEHREF:')) {
                newBasePath = tag.replace(/.*BASEHREF:\s*/, '').trim();
                // Remove quotes if present
                if ((newBasePath.startsWith('"') && newBasePath.endsWith('"')) || 
                    (newBasePath.startsWith("'") && newBasePath.endsWith("'"))) {
                    newBasePath = newBasePath.slice(1, -1);
                }
                FinkUtils.debugLog('BASEHREF extracted raw: "' + newBasePath + '"');
                if (!newBasePath.endsWith('/')) newBasePath += '/';
                FinkUtils.debugLog('BASEHREF final: "' + newBasePath + '"');
            }
        });
        
        // Store both processed (for backwards compatibility) and raw BASEHREF
        if (newBasePath) {
            FinkPlayer.mediaBasePath = newBasePath; // Processed (with trailing slash)
            FinkPlayer.rawBasehref = newBasePath.replace(/\/$/, ''); // Raw (no trailing slash)
            FinkUtils.debugLog('Updated mediaBasePath to: ' + FinkPlayer.mediaBasePath);
            FinkUtils.debugLog('Raw BASEHREF stored: ' + FinkPlayer.rawBasehref);
        }
        
        if (imageToShow) {
            FinkUtils.debugLog('Showing image from INK tags: ' + imageToShow);
            // Use the newBasePath from current processing, or fall back to stored mediaBasePath
            const currentRawBasehref = newBasePath ? newBasePath.replace(/\/$/, '') : 
                                     (FinkPlayer.mediaBasePath ? FinkPlayer.mediaBasePath.replace(/\/$/, '') : null);
            FinkUtils.debugLog('Using BASEHREF for image: "' + (currentRawBasehref || 'none') + '"');
            this.updateImage(imageToShow, currentRawBasehref);
        } else {
            FinkUtils.debugLog('No IMAGE tag found in current position');
        }
    },
    
    updateImage(imagePath, rawBasehref) {
        if (!imagePath) return;
        
        FinkUtils.debugLog('updateImage called with: "' + imagePath + '", rawBasehref: "' + (rawBasehref || 'none') + '"');
        
        this.elements.storyImage.classList.add('hidden');
        this.elements.imageContainer.classList.remove('hidden');
        
        // Use layered media resolution: global base → story BASEHREF → image path
        const actualImagePath = FinkUtils.resolveLayeredMediaUrl(rawBasehref, imagePath);
        
        const img = new Image();
        img.onload = () => {
            this.elements.storyImage.src = actualImagePath;
            this.elements.storyImage.alt = imagePath.replace(/\\.\\w+$/, '').replace(/_/g, ' ');
            this.elements.storyImage.classList.remove('hidden');
        };
        
        img.onerror = () => {
            FinkUtils.debugLog('Image failed to load: ' + actualImagePath);
            this.elements.imageContainer.classList.add('hidden');
        };
        
        img.src = actualImagePath;
    },
    
    // Status and messaging
    showStatus(message, showLoader = false) {
        this.elements.statusText.textContent = message;
        this.elements.statusOverlay.classList.add('active');
        
        const loader = this.elements.statusOverlay.querySelector('.status-spinner');
        if (showLoader) {
            loader.style.display = 'inline-block';
        } else {
            loader.style.display = 'none';
        }
    },
    
    hideStatus() {
        this.elements.statusOverlay.classList.remove('active');
    },
    
    // UI toggles
    toggleFullscreen() {
        if (!this.isFullscreen) {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            }
            this.elements.fullscreenButton.textContent = '❌';
            this.isFullscreen = true;
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
            this.elements.fullscreenButton.textContent = '📺';
            this.isFullscreen = false;
        }
    },
    
    toggleChoices() {
        this.choicesVisible = !this.choicesVisible;
        
        if (this.choicesVisible) {
            this.elements.choicesContainer.style.transform = 'translateY(0)';
            this.elements.storyContentContainer.classList.remove('choices-hidden');
            this.elements.choiceToggle.textContent = '👁️';
        } else {
            this.elements.choicesContainer.style.transform = 'translateY(100%)';
            this.elements.storyContentContainer.classList.add('choices-hidden');
            this.elements.choiceToggle.textContent = '🙈';
        }
    },
    
    toggleImageFullscreen() {
        this.isImageFullscreen = !this.isImageFullscreen;
        
        if (this.isImageFullscreen) {
            this.elements.imageContainer.classList.add('fullscreen');
            this.elements.choiceToggle.style.display = 'none';
            this.elements.fullscreenToggle.textContent = '❌';
            this.elements.choicesContainer.style.transform = 'translateY(100%)';
            this.elements.storyContentContainer.style.display = 'none';
        } else {
            this.elements.imageContainer.classList.remove('fullscreen');
            this.elements.choiceToggle.style.display = 'block';
            this.elements.fullscreenToggle.textContent = '⛶';
            if (this.choicesVisible) {
                this.elements.choicesContainer.style.transform = 'translateY(0)';
            }
            this.elements.storyContentContainer.style.display = 'block';
        }
    },
    
    // toggleUrlForm removed - no longer needed without form
    
    // Touch handling
    touchStartY: 0,
    touchStartX: 0,
    choiceIndex: -1,
    touchStartTime: 0,
    
    handleTouchStart(event) {
        if (this.animationInProgress || !event.touches[0]) return;
        
        this.touchStartY = event.touches[0].clientY;
        this.touchStartX = event.touches[0].clientX;
        this.touchStartTime = Date.now();
        
        const choice = document.elementFromPoint(this.touchStartX, this.touchStartY);
        const choiceEl = choice ? choice.closest('.choice') : null;
        
        if (choiceEl) {
            this.choiceIndex = parseInt(choiceEl.dataset.index);
        }
    },
    
    handleTouchMove(event) {
        if (this.choiceIndex === -1 || !event.touches[0]) return;
        
        const touchY = event.touches[0].clientY;
        const deltaY = this.touchStartY - touchY;
        
        if (deltaY > 50) {
            if (!this.expandingElement && !this.animationInProgress) {
                const choiceEl = document.querySelector(`.choice[data-index="${this.choiceIndex}"]`);
                if (choiceEl) {
                    this.handleChoiceClick({currentTarget: choiceEl}, this.choiceIndex, choiceEl._callback);
                }
            }
        }
    },
    
    handleTouchEnd(event) {
        const touchDuration = Date.now() - this.touchStartTime;
        
        if (touchDuration < 300 && this.choiceIndex !== -1 && !this.animationInProgress) {
            const choiceEl = document.querySelector(`.choice[data-index="${this.choiceIndex}"]`);
            if (choiceEl) {
                this.handleChoiceClick({currentTarget: choiceEl}, this.choiceIndex, choiceEl._callback);
            }
        }
        
        this.choiceIndex = -1;
    }
};