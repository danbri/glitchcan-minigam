// Gems Minigame - Collectible gem clicking game
// Can run in 'normal' or 'mega' mode

window.GemsMinigame = {
    // Configuration
    config: {
        normal: {
            spawnCount: 8,
            spawnInterval: 1500,
            maxGems: 15,
            timeout: 5000,
            emojis: ['💎', '💠', '🔷', '🔹']
        },
        mega: {
            spawnCount: 4,
            spawnInterval: 2000,
            maxGems: 10,
            timeout: 3000,
            emojis: ['👑', '💛', '🌟', '✨']
        }
    },

    // State
    active: false,
    mode: 'normal',
    collected: 0,
    totalSpawned: 0,
    activeGems: 0,  // Track gems currently on screen
    spawnTimer: null,
    container: null,
    scoreDisplay: null,
    onComplete: null,

    // Initialize the minigame
    init(container, scoreDisplay) {
        this.container = container;
        this.scoreDisplay = scoreDisplay;
        this.log('Gems minigame initialized');
    },

    // Start the game
    start(mode = 'normal', onComplete = null) {
        const cfg = this.config[mode] || this.config.normal;

        this.active = true;
        this.mode = mode;
        this.collected = 0;
        this.totalSpawned = 0;
        this.activeGems = 0;
        this.onComplete = onComplete;

        // Clear container
        this.container.innerHTML = '';
        this.container.classList.toggle('mega-mode', mode === 'mega');

        // Update score display
        if (this.scoreDisplay) {
            this.scoreDisplay.textContent = '0';
        }

        this.log(`Starting ${mode} mode`);

        // Spawn initial gems
        for (let i = 0; i < cfg.spawnCount; i++) {
            this.spawnGem();
        }

        // Continue spawning (a paused game spawns nothing)
        this.spawnTimer = setInterval(() => {
            if (this.paused) return;
            if (this.totalSpawned < cfg.maxGems) {
                this.spawnGem();
            } else {
                clearInterval(this.spawnTimer);
            }
        }, cfg.spawnInterval);
    },

    // Spawn a single gem
    spawnGem() {
        if (!this.active) return;

        const cfg = this.config[this.mode];
        this.totalSpawned++;

        // A BUTTON, not a decorated div: tab-reachable, named, and
        // Enter/Space collect it with no extra code. (Audit 2026-07: the
        // shipped minigames had no keyboard path to anything at all.)
        const gem = document.createElement('button');
        gem.type = 'button';
        gem.className = this.mode === 'mega' ? 'gem mega-gem' : 'gem';
        gem.textContent = cfg.emojis[Math.floor(Math.random() * cfg.emojis.length)];
        gem.setAttribute('aria-label', this.mode === 'mega' ? 'Mega gem' : 'Gem');

        // Random position (with padding)
        const padding = 10;
        const size = this.mode === 'mega' ? 60 : 40;
        const maxX = this.container.clientWidth - size;
        const maxY = this.container.clientHeight - size;
        gem.style.left = (padding + Math.random() * (maxX - padding)) + 'px';
        gem.style.top = (padding + Math.random() * (maxY - padding)) + 'px';

        gem.addEventListener('click', () => this.collectGem(gem));

        this.container.appendChild(gem);
        this.activeGems++;

        // Auto-remove after timeout if not collected. Time stands still
        // while paused: an expiry that fires during pause re-arms instead
        // of removing (pause used to let every gem quietly expire and the
        // game complete itself out of the window list).
        const expire = () => {
            if (this.paused) { setTimeout(expire, 500); return; }
            if (gem.parentNode && !gem.classList.contains('collected')) {
                gem.remove();
                this.activeGems--;
                this.checkAutoComplete();
            }
        };
        setTimeout(expire, cfg.timeout);
    },

    // Collect a gem
    collectGem(gem) {
        if (!this.active || gem.classList.contains('collected')) return;
        const gemElement = gem;

        gemElement.classList.add('collected');
        this.collected++;
        this.activeGems--;

        if (this.scoreDisplay) {
            this.scoreDisplay.textContent = this.collected;
        }
        gem.disabled = true;
        // A score that only exists as a changing number on screen is
        // invisible to a screen reader. Say it, through the shell's
        // pooled announcer.
        window.FoafOS?.bus.publish('guest.announce', {
            summary: `${this.mode === 'mega' ? 'Mega gem' : 'Gem'} collected, ${this.collected} total`,
            type: 'gems', text: `${this.collected} collected`,
        });

        // Play collection sound
        this.playCollectSound();

        setTimeout(() => gemElement.remove(), 300);

        this.log(`Collected ${this.mode === 'mega' ? 'MEGA ' : ''}gem! Total: ${this.collected}`);

        // Check if game should auto-complete
        this.checkAutoComplete();
    },

    // Play collection sound
    playCollectSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (this.mode === 'mega') {
                osc.frequency.value = 1200 + Math.random() * 400;
                gain.gain.value = 0.15;
                osc.start();
                osc.stop(ctx.currentTime + 0.2);
            } else {
                osc.frequency.value = 800 + Math.random() * 400;
                gain.gain.value = 0.1;
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
            }
        } catch (e) { /* Audio not available */ }
    },

    // End the game
    end() {
        this.log(`Game ended. Mode: ${this.mode}, Collected: ${this.collected}`);

        this.active = false;
        clearInterval(this.spawnTimer);
        this.container.classList.remove('mega-mode');

        const result = {
            mode: this.mode,
            collected: this.collected,
            isMega: this.mode === 'mega'
        };

        if (this.onComplete) {
            this.onComplete(result);
        }

        return result;
    },

    // Host pause hook (builtin games have no iframe to message)
    setPaused(on) {
        this.paused = !!on;
        if (!on) this.checkAutoComplete();
    },

    // Check if game should auto-complete
    checkAutoComplete() {
        if (this.paused) return;
        const cfg = this.config[this.mode];
        // Auto-complete when all gems spawned AND none left on screen
        if (this.totalSpawned >= cfg.maxGems && this.activeGems <= 0 && this.active) {
            this.log('All gems done - auto-completing');
            // Brief delay to show final state
            setTimeout(() => {
                if (this.active && window.FinkMinigames) {
                    FinkMinigames.endMinigame();
                }
            }, 800);
        }
    },

    // Get current results without ending
    getResults() {
        return {
            mode: this.mode,
            collected: this.collected,
            isMega: this.mode === 'mega',
            active: this.active
        };
    },

    log(msg) {
        console.log(`[GemsMinigame] ${msg}`);
    }
};
