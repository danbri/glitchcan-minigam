// FINK Minigames - Orchestrator for managing minigames
// Coordinates view switching and minigame lifecycle
// Supports both inline minigames (gems, chess) and iframe-sandboxed minigames (mudslider)

window.FinkMinigames = {
    // State
    active: false,
    currentType: null,
    currentMode: null,
    iframeMinigame: null,  // Current iframe element
    messageHandler: null,   // Bound message handler
    // Delta-based sync: track last update to preserve parallel activity changes
    lastSync: {
        gameGems: 0,        // gems reported by game at last sync
        storyDiamonds: 0    // diamonds we set in story at last sync
    },
    // Window state (pause, pin, minimize, maximize)
    windowState: {
        paused: false,
        pinned: false,
        minimized: false,
        maximized: false
    },

    // Known iframe-based minigames
    iframeMinigames: ['mudslider', 'battleboids', 'gridluck'],

    // Minigame metadata for splash screens
    minigameInfo: {
        gems: { icon: '💎', title: 'Gem Hunt', subtitle: 'Collect sparkling gems!' },
        mega: { icon: '👑', title: 'Mega Gems', subtitle: 'Legendary treasures await!' },
        mudslider: { icon: '⛏️', title: 'Mudslider', subtitle: 'Boulder Dash-style puzzle' },
        battleboids: { icon: '🧙', title: 'BoidWars', subtitle: 'Command your wizard flock' },
        gridluck: { icon: '👻', title: 'GridLuck', subtitle: 'Pac-Man style maze chase' },
        chess: { icon: '♟️', title: 'Chess', subtitle: 'Classic strategy game' }
    },

    // Active inline minigames (keyed by container ID)
    inlineMinigames: {},

    // DOM elements
    elements: {
        narrativeView: null,
        minigameView: null,
        minigameContent: null,
        gameContainer: null,
        chessContainer: null,
        iframeContainer: null,
        returnBtn: null,
        // Control buttons
        pauseBtn: null,
        pinBtn: null,
        minimizeBtn: null,
        maximizeBtn: null,
        frostOverlay: null
    },

    // Initialize the minigame system
    init() {
        this.elements = {
            narrativeView: document.getElementById('narrative-view'),
            minigameView: document.getElementById('minigame-view'),
            minigameContent: document.getElementById('minigame-content'),
            gameContainer: document.getElementById('game-container'),
            chessContainer: document.getElementById('chess-container'),
            iframeContainer: document.getElementById('iframe-minigame-container'),
            returnBtn: document.getElementById('returnToStory'),
            // Control buttons
            pauseBtn: document.getElementById('minigame-pause'),
            pinBtn: document.getElementById('minigame-pin'),
            minimizeBtn: document.getElementById('minigame-minimize'),
            maximizeBtn: document.getElementById('minigame-maximize'),
            frostOverlay: document.getElementById('minigame-frost-overlay')
        };

        // Initialize inline minigame modules
        if (window.GemsMinigame && this.elements.gameContainer) {
            GemsMinigame.init(this.elements.gameContainer, null);
        }

        if (window.ChessMinigame && this.elements.chessContainer) {
            ChessMinigame.init(this.elements.chessContainer);
        }

        // Return button handler
        if (this.elements.returnBtn) {
            this.elements.returnBtn.addEventListener('click', () => this.endMinigame());
        }

        // Control button handlers
        this._initControlButtons();

        // Bind message handler for iframe communication
        this.messageHandler = this._handleIframeMessage.bind(this);

        this.log('Minigames system initialized');
    },

    // Initialize control button event handlers
    _initControlButtons() {
        const { pauseBtn, pinBtn, minimizeBtn, maximizeBtn } = this.elements;

        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.togglePause());
        }
        if (pinBtn) {
            pinBtn.addEventListener('click', () => this.togglePin());
        }
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => this.toggleMinimize());
        }
        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', () => this.toggleMaximize());
        }

        // Click frost overlay to unpause
        if (this.elements.frostOverlay) {
            this.elements.frostOverlay.addEventListener('click', () => {
                if (this.windowState.paused) {
                    this.togglePause();
                }
            });
        }

        // Double-click minimized pip to restore
        if (this.elements.minigameView) {
            this.elements.minigameView.addEventListener('dblclick', (e) => {
                if (this.windowState.minimized) {
                    e.preventDefault();
                    this.toggleMinimize(); // Restore from pip
                }
            });

            // Make pip draggable when minimized or pinned
            this._initDragging();
        }
    },

    // Dragging state
    _dragState: {
        isDragging: false,
        startX: 0,
        startY: 0,
        startLeft: 0,
        startBottom: 0
    },

    // Initialize dragging for minimized/pinned states
    _initDragging() {
        const view = this.elements.minigameView;
        const controls = document.getElementById('minigame-controls');
        if (!view || !controls) return;

        const startDrag = (e) => {
            // Only drag when minimized or pinned
            if (!this.windowState.minimized && !this.windowState.pinned) return;
            // Don't drag when clicking buttons
            if (e.target.tagName === 'BUTTON') return;

            e.preventDefault();
            const touch = e.touches ? e.touches[0] : e;

            this._dragState.isDragging = true;
            this._dragState.startX = touch.clientX;
            this._dragState.startY = touch.clientY;

            // Get current position
            const rect = view.getBoundingClientRect();
            this._dragState.startLeft = rect.left;
            this._dragState.startBottom = window.innerHeight - rect.bottom;

            view.style.transition = 'none';
        };

        const doDrag = (e) => {
            if (!this._dragState.isDragging) return;

            const touch = e.touches ? e.touches[0] : e;
            const deltaX = touch.clientX - this._dragState.startX;
            const deltaY = touch.clientY - this._dragState.startY;

            const newLeft = this._dragState.startLeft + deltaX;
            const newBottom = this._dragState.startBottom - deltaY;

            // Clamp to viewport
            const rect = view.getBoundingClientRect();
            const maxLeft = window.innerWidth - rect.width;
            const maxBottom = window.innerHeight - rect.height;

            view.style.left = Math.max(0, Math.min(maxLeft, newLeft)) + 'px';
            view.style.bottom = Math.max(0, Math.min(maxBottom, newBottom)) + 'px';
            view.style.right = 'auto';
        };

        const endDrag = () => {
            if (this._dragState.isDragging) {
                this._dragState.isDragging = false;
                view.style.transition = '';
            }
        };

        // Mouse events
        controls.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', endDrag);

        // Touch events
        controls.addEventListener('touchstart', startDrag, { passive: false });
        document.addEventListener('touchmove', doDrag, { passive: false });
        document.addEventListener('touchend', endDrag);
    },

    // Toggle pause state
    togglePause() {
        this.windowState.paused = !this.windowState.paused;
        this._updateWindowState();

        if (this.windowState.paused) {
            this.pauseMinigame();
            this.elements.pauseBtn?.classList.add('active');
            if (this.elements.pauseBtn) this.elements.pauseBtn.textContent = '▶';
        } else {
            this.resumeMinigame();
            this.elements.pauseBtn?.classList.remove('active');
            if (this.elements.pauseBtn) this.elements.pauseBtn.textContent = '⏸';
        }

        this.log(`Minigame ${this.windowState.paused ? 'paused' : 'resumed'}`);
    },

    // Toggle pin state (keep visible while reading story)
    togglePin() {
        // Can't pin if minimized
        if (this.windowState.minimized) {
            this.toggleMinimize();
        }

        this.windowState.pinned = !this.windowState.pinned;

        if (this.windowState.pinned) {
            // Show narrative view alongside pinned minigame
            this.elements.narrativeView?.classList.add('active');
            this.elements.pinBtn?.classList.add('active');
        } else {
            // Hide narrative view when unpinned (unless exiting)
            if (this.active) {
                this.elements.narrativeView?.classList.remove('active');
            }
            this.elements.pinBtn?.classList.remove('active');
        }

        this._updateWindowState();
        this.log(`Minigame ${this.windowState.pinned ? 'pinned' : 'unpinned'}`);
    },

    // Toggle minimize state (pip mode)
    toggleMinimize() {
        const view = this.elements.minigameView;

        // Add transition class for smooth animation
        view?.classList.add('transitioning');
        setTimeout(() => view?.classList.remove('transitioning'), 350);

        // If maximized, first restore then minimize
        if (this.windowState.maximized) {
            this.windowState.maximized = false;
            this.elements.maximizeBtn?.classList.remove('active');
        }

        this.windowState.minimized = !this.windowState.minimized;

        if (this.windowState.minimized) {
            // Reset position to default corner when minimizing
            if (view) {
                view.style.left = '';
                view.style.right = '20px';
                view.style.bottom = '80px';
            }

            // Show narrative view when minimized
            this.elements.narrativeView?.classList.add('active');
            this.elements.minimizeBtn?.classList.add('active');

            // Update button icon
            if (this.elements.minimizeBtn) {
                this.elements.minimizeBtn.textContent = '▢'; // Restore icon
                this.elements.minimizeBtn.title = 'Restore';
            }
        } else {
            // Restore from pip
            if (view) {
                view.style.left = '';
                view.style.right = '';
                view.style.bottom = '';
            }

            // Hide narrative if not pinned
            if (!this.windowState.pinned) {
                this.elements.narrativeView?.classList.remove('active');
            }
            this.elements.minimizeBtn?.classList.remove('active');

            // Update button icon
            if (this.elements.minimizeBtn) {
                this.elements.minimizeBtn.textContent = '−';
                this.elements.minimizeBtn.title = 'Minimize';
            }
        }

        this._updateWindowState();
        this.log(`Minigame ${this.windowState.minimized ? 'minimized to pip' : 'restored from pip'}`);
    },

    // Toggle maximize state (true fullscreen)
    toggleMaximize() {
        const view = this.elements.minigameView;

        // Add transition class for smooth animation
        view?.classList.add('transitioning');
        setTimeout(() => view?.classList.remove('transitioning'), 350);

        // If minimized, restore first
        if (this.windowState.minimized) {
            this.windowState.minimized = false;
            this.elements.minimizeBtn?.classList.remove('active');
            if (this.elements.minimizeBtn) {
                this.elements.minimizeBtn.textContent = '−';
            }
        }

        this.windowState.maximized = !this.windowState.maximized;

        if (this.windowState.maximized) {
            // Reset any custom positioning
            if (view) {
                view.style.left = '';
                view.style.right = '';
                view.style.bottom = '';
            }

            // Hide pinned state when maximized
            if (this.windowState.pinned) {
                this.windowState.pinned = false;
                this.elements.pinBtn?.classList.remove('active');
            }

            this.elements.maximizeBtn?.classList.add('active');
            this.elements.narrativeView?.classList.remove('active');

            // Update button icon
            if (this.elements.maximizeBtn) {
                this.elements.maximizeBtn.textContent = '▢'; // Restore icon
                this.elements.maximizeBtn.title = 'Restore';
            }
        } else {
            this.elements.maximizeBtn?.classList.remove('active');

            // Update button icon
            if (this.elements.maximizeBtn) {
                this.elements.maximizeBtn.textContent = '□';
                this.elements.maximizeBtn.title = 'Maximize';
            }
        }

        this._updateWindowState();
        this.log(`Minigame ${this.windowState.maximized ? 'maximized' : 'restored'}`);
    },

    // Update CSS classes based on window state
    _updateWindowState() {
        const view = this.elements.minigameView;
        if (!view) return;

        view.classList.toggle('paused', this.windowState.paused);
        view.classList.toggle('pinned', this.windowState.pinned);
        view.classList.toggle('minimized', this.windowState.minimized);
        view.classList.toggle('maximized', this.windowState.maximized);
    },

    // Reset window state when minigame ends
    _resetWindowState() {
        const view = this.elements.minigameView;

        this.windowState = {
            paused: false,
            pinned: false,
            minimized: false,
            maximized: false
        };
        this._updateWindowState();

        // Reset any custom positioning
        if (view) {
            view.style.left = '';
            view.style.right = '';
            view.style.bottom = '';
        }

        // Reset button states and icons
        this.elements.pauseBtn?.classList.remove('active');
        if (this.elements.pauseBtn) this.elements.pauseBtn.textContent = '⏸';

        this.elements.pinBtn?.classList.remove('active');

        this.elements.minimizeBtn?.classList.remove('active');
        if (this.elements.minimizeBtn) {
            this.elements.minimizeBtn.textContent = '−';
            this.elements.minimizeBtn.title = 'Minimize';
        }

        this.elements.maximizeBtn?.classList.remove('active');
        if (this.elements.maximizeBtn) {
            this.elements.maximizeBtn.textContent = '□';
            this.elements.maximizeBtn.title = 'Maximize';
        }
    },

    // Start a minigame by type
    startMinigame(type = 'gems', mode = 'normal') {
        this.log(`Starting minigame: ${type} (${mode})`);

        this.active = true;
        this.currentType = type;
        this.currentMode = mode;

        // Switch to minigame view
        this.switchView('minigame');

        // Show slider and set to full state
        if (window.FinkWindowSlider) {
            FinkWindowSlider.setState('full', false);
            FinkWindowSlider.show();
        }

        // Check if this is an iframe-based minigame
        if (this.iframeMinigames.includes(type)) {
            this.startIframeMinigame(type, mode);
            return;
        }

        // Start appropriate inline minigame
        switch (type) {
            case 'chess':
                this.startChess();
                break;
            case 'gems':
            case 'mega':
            default:
                this.startGems(mode);
                break;
        }
    },

    // Start an iframe-sandboxed minigame
    startIframeMinigame(type, mode = 'full') {
        this.log(`Starting iframe minigame: ${type} (${mode})`);

        // Initialize delta-based sync tracking (preserves parallel activity changes)
        const currentDiamonds = window.FinkInkEngine?.story?.variablesState?.['diamonds'] || 0;
        this.lastSync = { gameGems: 0, storyDiamonds: currentDiamonds };
        this.log(`Starting sync: diamonds=${currentDiamonds}`);

        // Hide other containers
        if (this.elements.gameContainer) {
            this.elements.gameContainer.style.display = 'none';
        }
        if (this.elements.chessContainer) {
            this.elements.chessContainer.style.display = 'none';
        }

        // Show iframe container
        if (this.elements.iframeContainer) {
            this.elements.iframeContainer.style.display = 'flex';
            this.elements.iframeContainer.innerHTML = ''; // Clear previous

            // Create sandboxed iframe
            const iframe = document.createElement('iframe');
            iframe.src = `../minigames/${type}/index.html`;
            iframe.sandbox = 'allow-scripts';
            iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
            iframe.id = `minigame-iframe-${type}`;

            this.elements.iframeContainer.appendChild(iframe);
            this.iframeMinigame = iframe;

            // Setup message listener
            window.addEventListener('message', this.messageHandler);

            // Wait for iframe to load, then send init
            iframe.onload = () => {
                this.log('Iframe loaded, sending init');
                this._sendToIframe({
                    type: 'init',
                    config: { mode },
                    variables: this._getStoryVariables()
                });
            };
        }
    },

    // Handle messages from iframe minigame
    _handleIframeMessage(event) {
        const data = event.data;
        if (!data || typeof data.type !== 'string') return;

        this.log(`Iframe message: ${data.type}`);

        switch (data.type) {
            case 'ready':
                this.log('Minigame ready, capabilities: ' + JSON.stringify(data.capabilities));
                break;

            case 'progress':
                // Delta-based sync: preserves changes from parallel activities
                if (data.data && data.data.gems !== undefined) {
                    const currentGems = data.data.gems;
                    const gameDelta = currentGems - this.lastSync.gameGems;
                    const currentStoryDiamonds = FinkInkEngine?.story?.variablesState?.['diamonds'] || 0;
                    const newDiamonds = currentStoryDiamonds + gameDelta;

                    this._setStoryVariable('diamonds', newDiamonds);
                    this.lastSync = { gameGems: currentGems, storyDiamonds: newDiamonds };
                    this.log(`Progress: game=${currentGems} delta=+${gameDelta} diamonds=${newDiamonds}`);
                }
                if (data.data?.score !== undefined) {
                    this._setStoryVariable('score', data.data.score);
                }
                break;

            case 'set-variable':
                this._setStoryVariable(data.name, data.value);
                break;

            case 'complete':
                this.log('Minigame complete: ' + JSON.stringify(data.result));
                this._handleIframeComplete(data.result);
                break;

            case 'error':
                this.log(`Minigame error: ${data.code} - ${data.message}`);
                break;

            case 'log':
                // Route minigame log to dev panel
                if (window.FinkDevPanel) {
                    FinkDevPanel.log(`[Minigame] ${data.message}`, data.level === 'error' ? 'error' : 'game');
                }
                break;

            case 'log-batch':
                // Route batched minigame logs to dev panel
                if (window.FinkDevPanel && data.logs) {
                    data.logs.forEach(log => {
                        FinkDevPanel.log(`[Minigame] ${log.message}`, log.level === 'error' ? 'error' : 'game');
                    });
                }
                break;
        }
    },

    // Send message to iframe
    _sendToIframe(data) {
        if (this.iframeMinigame && this.iframeMinigame.contentWindow) {
            this.iframeMinigame.contentWindow.postMessage(data, '*');
        }
    },

    // Handle iframe minigame completion
    _handleIframeComplete(result) {
        // Update story variables from result
        if (result.variables) {
            for (const [name, value] of Object.entries(result.variables)) {
                this._setStoryVariable(name, value);
            }
        }

        // Clean up iframe
        this._cleanupIframe();

        // Complete the minigame
        this.handleMinigameComplete({
            type: this.currentType,
            success: result.success,
            score: result.score
        });
    },

    // Clean up iframe minigame
    _cleanupIframe() {
        window.removeEventListener('message', this.messageHandler);

        if (this.iframeMinigame) {
            this.iframeMinigame.remove();
            this.iframeMinigame = null;
        }

        if (this.elements.iframeContainer) {
            this.elements.iframeContainer.style.display = 'none';
            this.elements.iframeContainer.innerHTML = '';
        }
    },

    // Get story variables for minigame
    _getStoryVariables() {
        if (!window.FinkInkEngine || !FinkInkEngine.story) return {};

        const vars = {};
        const story = FinkInkEngine.story;

        // Get common variables
        const varNames = ['diamonds', 'mega_diamonds', 'keys', 'score', 'player_level', 'difficulty'];
        varNames.forEach(name => {
            if (story.variablesState[name] !== undefined) {
                vars[name] = story.variablesState[name];
            }
        });

        return vars;
    },

    // Set a story variable
    _setStoryVariable(name, value) {
        if (!window.FinkInkEngine || !FinkInkEngine.story) return;

        const story = FinkInkEngine.story;
        try {
            story.variablesState[name] = value;
            this.log(`Set variable ${name} = ${value}`);

            // Update stats display
            if (window.FinkUI && FinkUI.updateStatsDisplay) {
                FinkUI.updateStatsDisplay();
            }
        } catch (e) {
            this.log(`Error setting variable ${name}: ${e.message}`);
        }
    },

    // Start gems minigame
    startGems(mode = 'normal') {
        // Show gem elements, hide others
        if (this.elements.gameContainer) {
            this.elements.gameContainer.style.display = '';
        }
        if (this.elements.chessContainer) {
            this.elements.chessContainer.style.display = 'none';
        }
        if (this.elements.iframeContainer) {
            this.elements.iframeContainer.style.display = 'none';
        }

        // Start the minigame
        if (window.GemsMinigame) {
            GemsMinigame.start(mode, (result) => {
                // Result will be passed when game ends via return button
            });
        }
    },

    // Start chess minigame
    startChess() {
        // Hide gem elements, show chess
        if (this.elements.gameContainer) {
            this.elements.gameContainer.style.display = 'none';
        }
        if (this.elements.chessContainer) {
            this.elements.chessContainer.style.display = 'flex';
        }
        if (this.elements.iframeContainer) {
            this.elements.iframeContainer.style.display = 'none';
        }

        // Start the chess game
        if (window.ChessMinigame) {
            ChessMinigame.start((result) => {
                this.handleMinigameComplete(result);
            });
        }
    },

    // Pause current minigame (for iframe minigames)
    pauseMinigame() {
        if (this.iframeMinigame) {
            this._sendToIframe({ type: 'pause' });
        }
    },

    // Resume current minigame
    resumeMinigame() {
        if (this.iframeMinigame) {
            this._sendToIframe({ type: 'resume' });
        }
    },

    // End the current minigame
    endMinigame() {
        this.log('Ending minigame');

        // Handle iframe minigame
        if (this.iframeMinigame) {
            this._sendToIframe({ type: 'terminate', reason: 'user_exit' });
            this._cleanupIframe();
            this.handleMinigameComplete({ type: this.currentType, success: false });
            return;
        }

        // Handle inline minigames
        let result = null;

        switch (this.currentType) {
            case 'chess':
                if (window.ChessMinigame) {
                    result = ChessMinigame.end();
                }
                break;
            case 'gems':
            default:
                if (window.GemsMinigame) {
                    result = GemsMinigame.end();
                }
                break;
        }

        this.handleMinigameComplete(result);
    },

    // Handle minigame completion
    handleMinigameComplete(result) {
        this.log(`Minigame complete: ${JSON.stringify(result)}`);
        this.log(`Window state before reset: ${JSON.stringify(this.windowState)}`);

        this.active = false;

        // Reset window state (paused, pinned, minimized, maximized)
        this._resetWindowState();
        this.log(`Window state after reset: ${JSON.stringify(this.windowState)}`);

        // Hide slider
        if (window.FinkWindowSlider) {
            FinkWindowSlider.hide();
        }

        // Reset UI
        if (this.elements.gameContainer) {
            this.elements.gameContainer.classList.remove('mega-mode');
            this.elements.gameContainer.style.display = '';
        }
        if (this.elements.chessContainer) {
            this.elements.chessContainer.style.display = 'none';
        }
        if (this.elements.iframeContainer) {
            this.elements.iframeContainer.style.display = 'none';
        }

        // Update story variables if available
        this.updateStoryVariables(result);

        // Switch back to narrative view
        this.switchView('narrative');
        this.log(`Minigame view classes: ${this.elements.minigameView?.className}`);
        this.log(`Narrative view classes: ${this.elements.narrativeView?.className}`);

        // Explicitly hide minigame view to ensure it's not blocking
        if (this.elements.minigameView) {
            this.elements.minigameView.style.display = 'none';
            this.log('Minigame view hidden with display:none');
        }

        // Reset UI state to ensure choices work
        if (window.FinkUI) {
            FinkUI.animationInProgress = false;
            FinkUI.hideStatus();
            this.log(`FinkUI.animationInProgress set to false`);
        }

        // Continue story after a brief delay to ensure DOM updates
        setTimeout(() => {
            this.log('Timeout fired - calling continueStory');
            if (window.FinkInkEngine && FinkInkEngine.continueStory) {
                FinkInkEngine.continueStory();
            }
            // Re-enable minigame view CSS (remove inline style) for next minigame
            if (this.elements.minigameView) {
                this.elements.minigameView.style.display = '';
                this.log(`Minigame view display reset, classes: ${this.elements.minigameView.className}`);
            }
        }, 100);
    },

    // Update story variables based on minigame results
    updateStoryVariables(result) {
        if (!result || !window.FinkInkEngine || !FinkInkEngine.story) return;

        const story = FinkInkEngine.story;

        try {
            if (result.type === 'chess') {
                // Chess variables
                if (story.variablesState['chess_won'] !== undefined) {
                    story.variablesState['chess_won'] = result.won;
                }
                if (story.variablesState['chess_game_completed'] !== undefined) {
                    story.variablesState['chess_game_completed'] = true;
                }
            } else if (result.type === 'mudslider') {
                // Mudslider: add collected gems to diamonds (same pattern as gems minigame)
                if (result.score !== undefined && result.score > 0) {
                    const oldDiamonds = story.variablesState['diamonds'] || 0;
                    story.variablesState['diamonds'] = oldDiamonds + result.score;
                    this.log(`Updated diamonds: ${oldDiamonds} + ${result.score} = ${story.variablesState['diamonds']}`);
                }
                if (story.variablesState['minigame_played'] !== undefined) {
                    story.variablesState['minigame_played'] = true;
                }
            } else {
                // Gems variables
                if (result.isMega) {
                    const oldMega = story.variablesState['mega_diamonds'] || 0;
                    story.variablesState['mega_diamonds'] = oldMega + result.collected;
                    this.log(`Updated mega_diamonds: ${oldMega} -> ${story.variablesState['mega_diamonds']}`);
                } else if (result.collected !== undefined) {
                    const oldDiamonds = story.variablesState['diamonds'] || 0;
                    story.variablesState['diamonds'] = oldDiamonds + result.collected;
                    this.log(`Updated diamonds: ${oldDiamonds} -> ${story.variablesState['diamonds']}`);
                }

                if (story.variablesState['minigame_played'] !== undefined) {
                    story.variablesState['minigame_played'] = true;
                }
            }

            // Update stats display if available
            if (window.FinkUI && FinkUI.updateStatsDisplay) {
                FinkUI.updateStatsDisplay();
            }
        } catch (e) {
            this.log(`Error updating variables: ${e.message}`);
        }
    },

    // Switch between views
    switchView(viewName) {
        if (this.elements.narrativeView) {
            this.elements.narrativeView.classList.toggle('active', viewName === 'narrative');
        }
        if (this.elements.minigameView) {
            this.elements.minigameView.classList.toggle('active', viewName === 'minigame');
        }
        this.log(`Switched to ${viewName} view`);
    },

    // Check if any minigame is active
    isActive() {
        return this.active;
    },

    // Get current minigame type
    getCurrentType() {
        return this.currentType;
    },

    log(msg) {
        if (window.FinkDevPanel) {
            FinkDevPanel.log(`Minigames: ${msg}`, 'game');
        } else {
            console.log(`[FinkMinigames] ${msg}`);
        }
    },

    // ========== INLINE MINIGAME SYSTEM ==========

    /**
     * Create an inline minigame container that embeds in story flow
     * @param {string} type - Minigame type (gems, mudslider, etc.)
     * @param {string} display - Display mode: 'inline', 'medium', 'full'
     * @param {object} options - Additional options (preview image, etc.)
     * @returns {HTMLElement} The container element to insert into story
     */
    createInlineContainer(type, display = 'medium', options = {}) {
        const containerId = `inline-minigame-${Date.now()}`;
        const info = this.minigameInfo[type] || { icon: '🎮', title: type, subtitle: '' };

        this.log(`Creating inline container: ${type} (${display})`);

        // Create main container
        const container = document.createElement('div');
        container.className = `inline-minigame size-${display}`;
        container.id = containerId;
        container.dataset.type = type;
        container.dataset.display = display;

        // Content area
        const content = document.createElement('div');
        content.className = 'inline-minigame-content';
        container.appendChild(content);

        // Controls bar (minimize/expand/close)
        const controls = document.createElement('div');
        controls.className = 'inline-minigame-controls';
        controls.innerHTML = `
            <button class="inline-expand" title="Expand to fullscreen">⛶</button>
            <button class="inline-close" title="Close">✕</button>
        `;
        container.appendChild(controls);

        // For medium mode, show splash first
        if (display === 'medium') {
            const splash = this._createSplashOverlay(type, info, options);
            container.appendChild(splash);

            // Click splash to start
            splash.addEventListener('click', (e) => {
                if (e.target.classList.contains('inline-close')) return;
                splash.classList.add('hidden');
                this._startInlineMinigame(containerId, type, content);
            });
        } else if (display === 'inline') {
            // For inline mode, start immediately (no splash)
            setTimeout(() => {
                this._startInlineMinigame(containerId, type, content);
            }, 100);
        }

        // Wire up control buttons
        controls.querySelector('.inline-expand')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._expandInlineToFullscreen(containerId, type);
        });

        controls.querySelector('.inline-close')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._closeInlineMinigame(containerId);
        });

        // Store reference
        this.inlineMinigames[containerId] = {
            type,
            display,
            container,
            content,
            active: false
        };

        return container;
    },

    /**
     * Create splash overlay for medium mode
     */
    _createSplashOverlay(type, info, options) {
        const splash = document.createElement('div');
        splash.className = 'inline-minigame-splash';

        // Use preview image if provided, otherwise use icon
        const visual = options.previewImage
            ? `<img src="${options.previewImage}" style="max-width:80%;max-height:50%;object-fit:contain;border-radius:4px;" alt="${info.title}">`
            : `<div class="inline-minigame-splash-icon">${info.icon}</div>`;

        splash.innerHTML = `
            ${visual}
            <div class="inline-minigame-splash-title">${info.title}</div>
            <div class="inline-minigame-splash-subtitle">${info.subtitle}</div>
            <button class="inline-minigame-splash-play">▶ Play</button>
        `;

        return splash;
    },

    /**
     * Start a minigame inside an inline container
     */
    _startInlineMinigame(containerId, type, contentEl) {
        const entry = this.inlineMinigames[containerId];
        if (!entry) return;

        this.log(`Starting inline minigame: ${type} in ${containerId}`);
        entry.active = true;

        // Check if this is an iframe-based minigame
        if (this.iframeMinigames.includes(type)) {
            this._startInlineIframeMinigame(containerId, type, contentEl);
            return;
        }

        // For gems/inline games, create a mini game container
        if (type === 'gems' || type === 'mega') {
            this._startInlineGemsMinigame(containerId, type, contentEl);
            return;
        }

        // Fallback: show placeholder
        contentEl.innerHTML = `<div style="color:#888;text-align:center;padding:1em;">
            ${type} minigame (inline mode coming soon)
        </div>`;
    },

    /**
     * Start gems minigame in inline container
     */
    _startInlineGemsMinigame(containerId, type, contentEl) {
        const entry = this.inlineMinigames[containerId];

        // Create inline gem container
        const gemContainer = document.createElement('div');
        gemContainer.className = 'inline-gem-container';
        gemContainer.style.cssText = 'width:100%;height:100%;position:relative;overflow:hidden;';
        contentEl.appendChild(gemContainer);

        // Score display
        const scoreEl = document.createElement('div');
        scoreEl.style.cssText = 'position:absolute;top:4px;left:4px;color:var(--zx-yellow);font-size:0.9em;z-index:5;';
        scoreEl.innerHTML = '💎 <span class="gem-count">0</span>';
        gemContainer.appendChild(scoreEl);

        // Start mini gems game
        entry.gemsState = {
            collected: 0,
            container: gemContainer,
            scoreEl: scoreEl.querySelector('.gem-count'),
            mode: type === 'mega' ? 'mega' : 'normal'
        };

        this._spawnInlineGems(containerId);
    },

    /**
     * Spawn gems in inline container
     */
    _spawnInlineGems(containerId) {
        const entry = this.inlineMinigames[containerId];
        if (!entry || !entry.active || !entry.gemsState) return;

        const state = entry.gemsState;
        const cfg = {
            normal: { emojis: ['💎', '💠', '🔷'], count: 5, timeout: 4000 },
            mega: { emojis: ['👑', '💛', '🌟'], count: 3, timeout: 3000 }
        }[state.mode] || { emojis: ['💎'], count: 5, timeout: 4000 };

        // Spawn a few gems
        for (let i = 0; i < cfg.count; i++) {
            setTimeout(() => {
                if (!entry.active) return;
                this._createInlineGem(containerId, cfg);
            }, i * 300);
        }

        // Continue spawning
        setTimeout(() => {
            if (entry.active) this._spawnInlineGems(containerId);
        }, 3000);
    },

    /**
     * Create single gem in inline container
     */
    _createInlineGem(containerId, cfg) {
        const entry = this.inlineMinigames[containerId];
        if (!entry || !entry.gemsState) return;

        const state = entry.gemsState;
        const gem = document.createElement('div');
        gem.className = 'gem';
        gem.textContent = cfg.emojis[Math.floor(Math.random() * cfg.emojis.length)];
        gem.style.cssText = `
            position: absolute;
            font-size: 1.5em;
            cursor: pointer;
            left: ${10 + Math.random() * 70}%;
            top: ${10 + Math.random() * 70}%;
            transition: transform 0.2s;
        `;

        gem.addEventListener('click', () => {
            if (gem.classList.contains('collected')) return;
            gem.classList.add('collected');
            state.collected++;
            state.scoreEl.textContent = state.collected;

            // Update story diamonds
            this._setStoryVariable('diamonds', (FinkInkEngine?.story?.variablesState?.['diamonds'] || 0) + 1);

            // Play sound
            this._playGemSound();

            setTimeout(() => gem.remove(), 300);
        });

        state.container.appendChild(gem);

        // Auto-remove after timeout
        setTimeout(() => {
            if (gem.parentNode && !gem.classList.contains('collected')) {
                gem.style.opacity = '0';
                setTimeout(() => gem.remove(), 300);
            }
        }, cfg.timeout);
    },

    /**
     * Play gem collection sound
     */
    _playGemSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 800 + Math.random() * 400;
            gain.gain.value = 0.1;
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) { /* ignore */ }
    },

    /**
     * Start iframe-based minigame in inline container
     */
    _startInlineIframeMinigame(containerId, type, contentEl) {
        const entry = this.inlineMinigames[containerId];
        if (!entry) return;

        // Initialize delta-based sync
        const currentDiamonds = window.FinkInkEngine?.story?.variablesState?.['diamonds'] || 0;
        entry.lastSync = { gameGems: 0, storyDiamonds: currentDiamonds };

        // Create sandboxed iframe
        const iframe = document.createElement('iframe');
        iframe.src = `../minigames/${type}/index.html`;
        iframe.sandbox = 'allow-scripts';
        iframe.style.cssText = 'width:100%;height:100%;border:none;';
        contentEl.appendChild(iframe);

        entry.iframe = iframe;

        // Setup message listener
        entry.messageHandler = (event) => this._handleInlineMessage(containerId, event);
        window.addEventListener('message', entry.messageHandler);

        // Send init when loaded
        iframe.onload = () => {
            this.log(`Inline iframe loaded for ${containerId}`);
            iframe.contentWindow?.postMessage({
                type: 'init',
                config: { mode: 'inline', display: entry.display },
                variables: this._getStoryVariables()
            }, '*');
        };
    },

    /**
     * Handle messages from inline iframe minigames
     */
    _handleInlineMessage(containerId, event) {
        const entry = this.inlineMinigames[containerId];
        if (!entry) return;

        const data = event.data;
        if (!data || typeof data.type !== 'string') return;

        switch (data.type) {
            case 'progress':
                // Delta-based sync for inline games
                if (data.data?.gems !== undefined && entry.lastSync) {
                    const currentGems = data.data.gems;
                    const gameDelta = currentGems - entry.lastSync.gameGems;
                    const currentStoryDiamonds = FinkInkEngine?.story?.variablesState?.['diamonds'] || 0;
                    const newDiamonds = currentStoryDiamonds + gameDelta;
                    this._setStoryVariable('diamonds', newDiamonds);
                    entry.lastSync = { gameGems: currentGems, storyDiamonds: newDiamonds };
                }
                break;

            case 'complete':
                this.log(`Inline minigame complete: ${containerId}`);
                // Handle completion - could auto-close or show score
                break;
        }
    },

    /**
     * Expand inline minigame to fullscreen view
     */
    _expandInlineToFullscreen(containerId, type) {
        this.log(`Expanding ${containerId} to fullscreen`);

        // Close inline version
        this._closeInlineMinigame(containerId, false);

        // Start fullscreen version
        this.startMinigame(type, 'normal');
    },

    /**
     * Close an inline minigame
     */
    _closeInlineMinigame(containerId, continueStory = true) {
        const entry = this.inlineMinigames[containerId];
        if (!entry) return;

        this.log(`Closing inline minigame: ${containerId}`);
        entry.active = false;

        // Clean up iframe listener if present
        if (entry.messageHandler) {
            window.removeEventListener('message', entry.messageHandler);
        }

        // Remove container from DOM
        entry.container?.remove();

        // Remove from tracking
        delete this.inlineMinigames[containerId];

        // Continue story if requested
        if (continueStory && window.FinkInkEngine) {
            FinkInkEngine.continueStory();
        }
    }
};
