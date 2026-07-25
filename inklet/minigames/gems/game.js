/**
 * Gem Collector Game
 * A simple click-to-collect minigame demonstrating the MinigameSDK
 */

const GemCollector = {
    // State
    sdk: null,
    config: null,
    variables: {},
    gemsCollected: 0,
    megaGemsCollected: 0,
    timeLeft: 30,
    timerId: null,
    paused: false,
    gameOver: false,

    // DOM elements
    playArea: null,
    gemCountEl: null,
    timeLeftEl: null,
    messageEl: null,

    // Gem types with their properties
    gemTypes: [
        { emoji: '💎', value: 1, size: 40, className: 'gem-diamond', name: 'diamond' },
        { emoji: '💠', value: 2, size: 35, className: 'gem-blue', name: 'blue gem' },
        { emoji: '🔶', value: 3, size: 30, className: 'gem-orange', name: 'orange gem' },
        { emoji: '🔷', value: 2, size: 32, className: 'gem-rhombus', name: 'blue rhombus' },
        { emoji: '⚜️', value: 5, size: 45, className: 'gem-fleur', rare: true, name: 'rare fleur' }
    ],

    init() {
        // Get DOM elements
        this.playArea = document.getElementById('play-area');
        this.gemCountEl = document.getElementById('gem-count');
        this.timeLeftEl = document.getElementById('time-left');
        this.messageEl = document.getElementById('message');

        // Initialize SDK
        this.sdk = new MinigameSDK();

        this.sdk.onInit((config, variables) => {
            this.config = config;
            this.variables = variables;
            this.startGame();
        });

        this.sdk.onPause(() => {
            this.pause();
        });

        this.sdk.onResume(() => {
            this.resume();
        });

        this.sdk.onTerminate((reason) => {
            this.endGame(false, reason);
        });
    },

    startGame() {
        console.log('[GemCollector] Starting game with config:', this.config);

        // Get settings from mode or use defaults
        const mode = this.config.mode || 'normal';
        const modeSettings = {
            normal: { timeLimit: 30, gemCount: 15 },
            mega: { timeLimit: 60, gemCount: 10, megaMultiplier: 10 },
            timed: { timeLimit: 15, gemCount: 20 }
        };

        const settings = modeSettings[mode] || modeSettings.normal;
        this.timeLeft = settings.timeLimit;
        this.megaMultiplier = settings.megaMultiplier || 1;

        // Reset state
        this.gemsCollected = 0;
        this.megaGemsCollected = 0;
        this.gameOver = false;
        this.paused = false;

        // Update display
        this.updateDisplay();

        // Spawn initial gems
        for (let i = 0; i < settings.gemCount; i++) {
            setTimeout(() => this.spawnGem(), i * 200);
        }

        // Start timer
        this.startTimer();

        // Show start message
        this.showMessage('Collect the gems!', 1500);
    },

    spawnGem() {
        if (this.gameOver || this.paused) return;

        // Pick a random gem type (rare gems less frequent)
        const roll = Math.random();
        let gemType;
        if (roll > 0.9) {
            gemType = this.gemTypes.find(g => g.rare) || this.gemTypes[0];
        } else {
            const commonGems = this.gemTypes.filter(g => !g.rare);
            gemType = commonGems[Math.floor(Math.random() * commonGems.length)];
        }

        // A gem is a BUTTON, not a decorated div. That single change is
        // most of this game's accessibility: it becomes tab-reachable,
        // it has a name, and Enter/Space collect it with no extra code.
        // (Audited 2026-07: every packaged guest had zero aria and no
        // keyboard path at all.)
        const gem = document.createElement('button');
        gem.type = 'button';
        gem.className = `gem ${gemType.className}`;
        gem.textContent = gemType.emoji;
        gem.style.fontSize = `${gemType.size}px`;
        gem.dataset.value = gemType.value;
        gem.setAttribute('aria-label',
            `${gemType.name}, worth ${gemType.value}${gemType.value === 1 ? ' gem' : ' gems'}`);

        // Random position
        const areaRect = this.playArea.getBoundingClientRect();
        const maxX = areaRect.width - gemType.size;
        const maxY = areaRect.height - gemType.size;
        gem.style.left = `${Math.random() * maxX}px`;
        gem.style.top = `${Math.random() * maxY}px`;

        // Click handler
        gem.addEventListener('click', (e) => {
            e.preventDefault();
            this.collectGem(gem, gemType);
        });

        // Touch handler for mobile
        gem.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.collectGem(gem, gemType);
        });

        this.playArea.appendChild(gem);

        // Remove after some time if not collected
        setTimeout(() => {
            if (gem.parentNode && !this.gameOver) {
                gem.classList.add('fading');
                setTimeout(() => {
                    if (gem.parentNode) gem.remove();
                    if (!this.gameOver) this.spawnGem();
                }, 500);
            }
        }, 5000);
    },

    collectGem(gem, gemType) {
        if (this.gameOver || this.paused) return;

        // Calculate value (apply mega multiplier)
        let value = gemType.value;
        if (this.megaMultiplier > 1) {
            value *= this.megaMultiplier;
            this.megaGemsCollected += value;
        }

        this.gemsCollected += value;

        // Say it. A score that only exists as a moving number on screen
        // is invisible to a screen reader.
        window.__mgA11y?.announce(`${gemType.name} collected, ${this.gemsCollected} total`);

        // Visual feedback
        gem.classList.add('collected');
        gem.disabled = true;

        // Create floating score indicator
        const scorePopup = document.createElement('div');
        scorePopup.className = 'score-popup';
        scorePopup.textContent = `+${value}`;
        scorePopup.style.left = gem.style.left;
        scorePopup.style.top = gem.style.top;
        this.playArea.appendChild(scorePopup);

        // Remove elements after animation
        setTimeout(() => {
            if (gem.parentNode) gem.remove();
            if (scorePopup.parentNode) scorePopup.remove();
            // Spawn new gem
            if (!this.gameOver) this.spawnGem();
        }, 300);

        // Update display and notify host
        this.updateDisplay();
        this.sdk.progress({ gems: this.gemsCollected, timeLeft: this.timeLeft });
    },

    startTimer() {
        if (this.timerId) clearInterval(this.timerId);

        this.timerId = setInterval(() => {
            if (this.paused || this.gameOver) return;

            this.timeLeft--;
            this.updateDisplay();

            if (this.timeLeft <= 0) {
                this.endGame(true);
            }
        }, 1000);
    },

    pause() {
        this.paused = true;
        this.showMessage('PAUSED', 0);
        console.log('[GemCollector] Game paused');
    },

    resume() {
        this.paused = false;
        this.messageEl.classList.add('hidden');
        console.log('[GemCollector] Game resumed');
    },

    endGame(completed, reason) {
        this.gameOver = true;
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }

        // Clear remaining gems
        this.playArea.innerHTML = '';

        // Determine success based on score
        const success = this.gemsCollected >= 10;

        // Show end message
        if (completed) {
            this.showMessage(
                success
                    ? `You collected ${this.gemsCollected} gems!`
                    : `Only ${this.gemsCollected} gems. Try harder!`,
                0
            );
        } else {
            this.showMessage(`Game ended: ${reason}`, 0);
        }

        // Report completion to host
        setTimeout(() => {
            this.sdk.complete({
                success,
                score: this.gemsCollected,
                variables: {
                    diamonds: this.gemsCollected,
                    mega_diamonds: this.megaGemsCollected,
                    minigame_played: true
                }
            });
        }, 2000);
    },

    updateDisplay() {
        this.gemCountEl.textContent = this.gemsCollected;
        this.timeLeftEl.textContent = this.timeLeft;
    },

    showMessage(text, duration = 2000) {
        this.messageEl.textContent = text;
        this.messageEl.classList.remove('hidden');

        if (duration > 0) {
            setTimeout(() => {
                this.messageEl.classList.add('hidden');
            }, duration);
        }
    }
};

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GemCollector.init());
} else {
    GemCollector.init();
}
