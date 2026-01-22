// FINK Window Slider - Smooth window size control with 4 snap states
// States: full (100%) → embed (66%) → mini-live (33%) → mini-paused (0%)

window.FinkWindowSlider = {
    // State
    state: 'full',
    value: 100,
    isDragging: false,
    isVisible: false,

    // Snap points: value → state mapping
    snapPoints: [
        { value: 100, state: 'full', label: 'FULL' },
        { value: 66, state: 'embed', label: 'EMBED' },
        { value: 33, state: 'mini-live', label: 'MINI' },
        { value: 0, state: 'mini-paused', label: '⏸' }
    ],

    // DOM elements
    elements: {
        slider: null,
        track: null,
        thumb: null,
        snaps: null,
        minigameView: null
    },

    // Callbacks
    onStateChange: null,

    // Initialize
    init() {
        this.elements = {
            slider: document.getElementById('game-slider'),
            thumb: document.getElementById('game-slider-thumb'),
            minigameView: document.getElementById('minigame-view')
        };

        if (!this.elements.slider || !this.elements.thumb) {
            this.log('Slider elements not found');
            return;
        }

        this.elements.track = this.elements.slider.querySelector('.game-slider-track');
        this.elements.snaps = this.elements.slider.querySelectorAll('.game-slider-snap');

        // Wire up events
        this._initDragEvents();
        this._initSnapClickEvents();

        this.log('Slider initialized');
    },

    // Show slider
    show() {
        if (this.elements.slider) {
            this.elements.slider.classList.remove('hidden');
            this.isVisible = true;
        }
    },

    // Hide slider
    hide() {
        if (this.elements.slider) {
            this.elements.slider.classList.add('hidden');
            this.isVisible = false;
        }
    },

    // Set state directly
    setState(newState, animate = true) {
        const snap = this.snapPoints.find(s => s.state === newState);
        if (!snap) return;

        const oldState = this.state;
        this.state = newState;
        this.value = snap.value;

        this._updateThumbPosition(animate);
        this._updateSnapHighlight();
        this._applyStateToView(animate);

        // Audio feedback
        this._playSnapSound();
        this._triggerHaptic();

        if (this.onStateChange && oldState !== newState) {
            this.onStateChange(oldState, newState);
        }

        this.log(`State: ${oldState} → ${newState}`);
    },

    // Set value (0-100) and snap to nearest state
    setValue(newValue, animate = true) {
        this.value = Math.max(0, Math.min(100, newValue));
        this._updateThumbPosition(animate);

        // Find nearest snap point
        const nearest = this._findNearestSnap(this.value);
        if (Math.abs(this.value - nearest.value) < 10) {
            // Close enough to snap
            this.setState(nearest.state, animate);
        }
    },

    // Find nearest snap point
    _findNearestSnap(value) {
        let nearest = this.snapPoints[0];
        let minDist = Math.abs(value - nearest.value);

        for (const snap of this.snapPoints) {
            const dist = Math.abs(value - snap.value);
            if (dist < minDist) {
                minDist = dist;
                nearest = snap;
            }
        }
        return nearest;
    },

    // Update thumb position
    _updateThumbPosition(animate = true) {
        if (!this.elements.thumb) return;

        // Value 100 = left 0%, Value 0 = left 100%
        const left = 100 - this.value;

        if (animate && !this.isDragging) {
            this.elements.thumb.classList.remove('dragging');
        } else {
            this.elements.thumb.classList.add('dragging');
        }

        this.elements.thumb.style.left = `${left}%`;
    },

    // Update snap point highlight
    _updateSnapHighlight() {
        if (!this.elements.snaps) return;

        this.elements.snaps.forEach(snap => {
            snap.classList.toggle('active', snap.dataset.state === this.state);
        });
    },

    // Apply state class to minigame view
    _applyStateToView(animate = true) {
        const view = this.elements.minigameView;
        if (!view) return;

        // Add transition class if animating
        if (animate) {
            view.classList.add('slider-transitioning');
            setTimeout(() => view.classList.remove('slider-transitioning'), 350);
        }

        // Remove old state classes
        view.classList.remove('state-full', 'state-embed', 'state-mini-live', 'state-mini-paused');

        // Add new state class
        view.classList.add(`state-${this.state}`);

        // Show narrative view if not full
        const narrativeView = document.getElementById('narrative-view');
        if (narrativeView) {
            if (this.state === 'full') {
                narrativeView.classList.remove('active');
            } else {
                narrativeView.classList.add('active');
            }
        }

        // Pause game if mini-paused
        if (this.state === 'mini-paused') {
            if (window.FinkMinigames && !FinkMinigames.windowState.paused) {
                FinkMinigames.togglePause();
            }
        } else if (this.state === 'mini-live') {
            // Resume if was paused
            if (window.FinkMinigames && FinkMinigames.windowState.paused) {
                FinkMinigames.togglePause();
            }
        }
    },

    // Initialize drag events
    _initDragEvents() {
        const thumb = this.elements.thumb;
        const track = this.elements.track;
        if (!thumb || !track) return;

        const startDrag = (e) => {
            e.preventDefault();
            this.isDragging = true;
            thumb.classList.add('dragging');
            document.addEventListener('mousemove', doDrag);
            document.addEventListener('mouseup', endDrag);
            document.addEventListener('touchmove', doDrag, { passive: false });
            document.addEventListener('touchend', endDrag);
        };

        const doDrag = (e) => {
            if (!this.isDragging) return;
            e.preventDefault();

            const touch = e.touches ? e.touches[0] : e;
            const rect = track.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const percent = (x / rect.width) * 100;

            // Invert: left = 100%, right = 0%
            const value = 100 - Math.max(0, Math.min(100, percent));
            this.value = value;
            this._updateThumbPosition(false);

            // Haptic tick every 25%
            const nearestSnap = this._findNearestSnap(value);
            if (Math.abs(value - nearestSnap.value) < 5) {
                this._triggerHaptic('tick');
            }
        };

        const endDrag = () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            thumb.classList.remove('dragging');

            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', endDrag);
            document.removeEventListener('touchmove', doDrag);
            document.removeEventListener('touchend', endDrag);

            // Snap to nearest
            const nearest = this._findNearestSnap(this.value);
            this.setState(nearest.state, true);
        };

        thumb.addEventListener('mousedown', startDrag);
        thumb.addEventListener('touchstart', startDrag, { passive: false });
    },

    // Initialize snap point click events
    _initSnapClickEvents() {
        if (!this.elements.snaps) return;

        this.elements.snaps.forEach(snap => {
            snap.addEventListener('click', () => {
                const state = snap.dataset.state;
                if (state) {
                    this.setState(state, true);
                }
            });
        });
    },

    // Play snap sound via FinkFoley
    _playSnapSound() {
        if (!window.FinkFoley) return;

        try {
            // Quick snap sound
            const ctx = FinkFoley.ctx;
            if (!ctx) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            // Different pitch per state
            const pitches = {
                'full': 880,
                'embed': 660,
                'mini-live': 440,
                'mini-paused': 330
            };

            osc.frequency.value = pitches[this.state] || 440;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.08);
        } catch (e) {
            // Ignore audio errors
        }
    },

    // Trigger haptic feedback
    _triggerHaptic(type = 'snap') {
        if (!navigator.vibrate) return;

        const patterns = {
            snap: [12],
            tick: [5],
            bounce: [5, 20, 8]
        };

        navigator.vibrate(patterns[type] || patterns.snap);
    },

    // Logging
    log(msg) {
        if (window.FinkDevPanel) {
            FinkDevPanel.log(`Slider: ${msg}`, 'game');
        } else {
            console.log(`[FinkWindowSlider] ${msg}`);
        }
    }
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    FinkWindowSlider.init();
});
