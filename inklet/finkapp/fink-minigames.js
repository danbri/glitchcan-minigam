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
    iframeMinigames: ['mudslider'],

    // DOM elements
    elements: {
        narrativeView: null,
        minigameView: null,
        minigameContent: null,
        gameContainer: null,
        chessContainer: null,
        iframeContainer: null,
        instructions: null,
        scoreDisplay: null,
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
            instructions: document.getElementById('minigame-instructions'),
            scoreDisplay: document.getElementById('gems-collected'),
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
            GemsMinigame.init(this.elements.gameContainer, this.elements.scoreDisplay);
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
    },

    // Toggle pause state
    togglePause() {
        this.windowState.paused = !this.windowState.paused;
        this._updateWindowState();

        if (this.windowState.paused) {
            this.pauseMinigame();
            this.elements.pauseBtn?.classList.add('active');
            if (this.elements.pauseBtn) this.elements.pauseBtn.textContent = '▶️';
        } else {
            this.resumeMinigame();
            this.elements.pauseBtn?.classList.remove('active');
            if (this.elements.pauseBtn) this.elements.pauseBtn.textContent = '⏸️';
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

    // Toggle minimize state
    toggleMinimize() {
        // Can't minimize if maximized
        if (this.windowState.maximized) {
            this.windowState.maximized = false;
            this.elements.maximizeBtn?.classList.remove('active');
        }

        this.windowState.minimized = !this.windowState.minimized;

        if (this.windowState.minimized) {
            // Auto-pin when minimizing
            if (!this.windowState.pinned) {
                this.windowState.pinned = true;
                this.elements.narrativeView?.classList.add('active');
                this.elements.pinBtn?.classList.add('active');
            }
            this.elements.minimizeBtn?.classList.add('active');
        } else {
            this.elements.minimizeBtn?.classList.remove('active');
        }

        this._updateWindowState();
        this.log(`Minigame ${this.windowState.minimized ? 'minimized' : 'restored'}`);
    },

    // Toggle maximize state
    toggleMaximize() {
        // Can't maximize if minimized
        if (this.windowState.minimized) {
            this.windowState.minimized = false;
            this.elements.minimizeBtn?.classList.remove('active');
        }

        this.windowState.maximized = !this.windowState.maximized;

        if (this.windowState.maximized) {
            this.elements.maximizeBtn?.classList.add('active');
        } else {
            this.elements.maximizeBtn?.classList.remove('active');
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
        this.windowState = {
            paused: false,
            pinned: false,
            minimized: false,
            maximized: false
        };
        this._updateWindowState();

        // Reset button states
        this.elements.pauseBtn?.classList.remove('active');
        if (this.elements.pauseBtn) this.elements.pauseBtn.textContent = '⏸️';
        this.elements.pinBtn?.classList.remove('active');
        this.elements.minimizeBtn?.classList.remove('active');
        this.elements.maximizeBtn?.classList.remove('active');
    },

    // Start a minigame by type
    startMinigame(type = 'gems', mode = 'normal') {
        this.log(`Starting minigame: ${type} (${mode})`);

        this.active = true;
        this.currentType = type;
        this.currentMode = mode;

        // Switch to minigame view
        this.switchView('minigame');

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
        if (this.elements.instructions) {
            this.elements.instructions.style.display = 'none';
        }
        if (this.elements.scoreDisplay) {
            this.elements.scoreDisplay.parentElement.style.display = 'none';
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
                // Route single minigame log to finkapp dev console
                if (window.FinkDevPanel) {
                    FinkDevPanel.log(`[Minigame] ${data.message}`, data.level === 'error' ? 'error' : 'game');
                }
                break;

            case 'log-batch':
                // Route batched minigame logs to finkapp dev console
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
        if (this.elements.instructions) {
            this.elements.instructions.style.display = '';
            this.elements.instructions.textContent = mode === 'mega'
                ? 'Catch the MEGA GEMS! Each worth 1000x!'
                : 'Click the gems to collect them!';
        }
        if (this.elements.scoreDisplay) {
            this.elements.scoreDisplay.parentElement.style.display = '';
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
        if (this.elements.instructions) {
            this.elements.instructions.style.display = 'none';
        }
        if (this.elements.scoreDisplay) {
            this.elements.scoreDisplay.parentElement.style.display = 'none';
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

        this.active = false;

        // Reset window state (paused, pinned, minimized, maximized)
        this._resetWindowState();

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
        if (this.elements.instructions) {
            this.elements.instructions.style.display = '';
        }
        if (this.elements.scoreDisplay) {
            this.elements.scoreDisplay.parentElement.style.display = '';
        }

        // Update story variables if available
        this.updateStoryVariables(result);

        // Switch back to narrative view
        this.switchView('narrative');

        // Explicitly hide minigame view to ensure it's not blocking
        if (this.elements.minigameView) {
            this.elements.minigameView.style.display = 'none';
        }

        // Reset UI state to ensure choices work
        if (window.FinkUI) {
            FinkUI.animationInProgress = false;
            FinkUI.hideStatus();
        }

        // Continue story after a brief delay to ensure DOM updates
        setTimeout(() => {
            if (window.FinkInkEngine && FinkInkEngine.continueStory) {
                FinkInkEngine.continueStory();
            }
            // Re-enable minigame view CSS (remove inline style) for next minigame
            if (this.elements.minigameView) {
                this.elements.minigameView.style.display = '';
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
            window.FinkDevPanel.log(`Minigames: ${msg}`, 'game');
        } else {
            console.log(`[FinkMinigames] ${msg}`);
        }
    }
};
