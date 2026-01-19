// FINK Minigames - Orchestrator for managing minigames
// Coordinates view switching and minigame lifecycle

window.FinkMinigames = {
    // State
    active: false,
    currentType: null,
    currentMode: null,

    // DOM elements
    elements: {
        narrativeView: null,
        minigameView: null,
        gameContainer: null,
        chessContainer: null,
        instructions: null,
        scoreDisplay: null,
        returnBtn: null
    },

    // Initialize the minigame system
    init() {
        this.elements = {
            narrativeView: document.getElementById('narrative-view'),
            minigameView: document.getElementById('minigame-view'),
            gameContainer: document.getElementById('game-container'),
            chessContainer: document.getElementById('chess-container'),
            instructions: document.getElementById('minigame-instructions'),
            scoreDisplay: document.getElementById('gems-collected'),
            returnBtn: document.getElementById('returnToStory')
        };

        // Initialize minigame modules
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

        this.log('Minigames system initialized');
    },

    // Start a minigame by type
    startMinigame(type = 'gems', mode = 'normal') {
        this.log(`Starting minigame: ${type} (${mode})`);

        this.active = true;
        this.currentType = type;
        this.currentMode = mode;

        // Switch to minigame view
        this.switchView('minigame');

        // Start appropriate minigame
        switch (type) {
            case 'chess':
                this.startChess();
                break;
            case 'gems':
            default:
                this.startGems(mode);
                break;
        }
    },

    // Start gems minigame
    startGems(mode = 'normal') {
        // Show gem elements, hide chess
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

        // Start the chess game
        if (window.ChessMinigame) {
            ChessMinigame.start((result) => {
                this.handleMinigameComplete(result);
            });
        }
    },

    // End the current minigame
    endMinigame() {
        this.log('Ending minigame');

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

        // Reset UI
        if (this.elements.gameContainer) {
            this.elements.gameContainer.classList.remove('mega-mode');
        }
        if (this.elements.chessContainer) {
            this.elements.chessContainer.style.display = 'none';
        }
        if (this.elements.gameContainer) {
            this.elements.gameContainer.style.display = '';
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

        // Continue story if available
        if (window.FinkInkEngine && FinkInkEngine.continueStory) {
            FinkInkEngine.continueStory();
        }
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
            } else {
                // Gems variables
                if (result.isMega) {
                    const oldMega = story.variablesState['mega_diamonds'] || 0;
                    story.variablesState['mega_diamonds'] = oldMega + result.collected;
                    this.log(`Updated mega_diamonds: ${oldMega} -> ${story.variablesState['mega_diamonds']}`);
                } else {
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
