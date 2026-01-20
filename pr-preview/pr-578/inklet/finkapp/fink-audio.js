// FINK Audio Manager - Background music and audio file playback
// Separate from FinkFoley which handles procedural synthesis

window.FinkAudio = {
    context: null,
    currentSource: null,
    currentGain: null,
    currentTrack: null,
    fadeDuration: 2.0, // seconds
    unlocked: false,

    // Pre-init: create context early (will be suspended until user interaction)
    preInit() {
        if (!this.context) {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.log(`Context created (state: ${this.context.state})`);
        }
    },

    // Unlock on user interaction
    async unlock() {
        if (this.unlocked) return;
        this.preInit();
        if (this.context.state === 'suspended') {
            await this.context.resume();
            this.log(`Context unlocked (state: ${this.context.state})`);
        }
        this.unlocked = true;
    },

    async init() {
        this.preInit();
        if (this.context.state === 'suspended') {
            await this.context.resume();
        }
        return this.context.state === 'running';
    },

    // Play a background music track with crossfade
    async play(url, trackName = '') {
        try {
            await this.init();
            this.log(`Loading ${url}`);

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

            // Crossfade from current to new
            if (this.currentSource) {
                this.fadeOut(this.currentGain);
            }

            // Create new source
            const source = this.context.createBufferSource();
            const gain = this.context.createGain();
            source.buffer = audioBuffer;
            source.loop = true;
            source.connect(gain);
            gain.connect(this.context.destination);

            // Fade in
            gain.gain.setValueAtTime(0, this.context.currentTime);
            gain.gain.linearRampToValueAtTime(1, this.context.currentTime + this.fadeDuration);

            source.start();
            this.currentSource = source;
            this.currentGain = gain;
            this.currentTrack = trackName || url.split('/').pop();

            // Update indicator
            const indicator = document.getElementById('audio-indicator');
            const trackNameEl = document.getElementById('audio-track-name');
            if (indicator && trackNameEl) {
                trackNameEl.textContent = this.currentTrack;
                indicator.classList.add('playing');
            }

            this.log(`Playing ${this.currentTrack}`);
            if (window.swimEvent) swimEvent('game', '🎵', 'Audio', this.currentTrack);
        } catch (e) {
            this.log(`Error: ${e.message}`, 'error');
        }
    },

    fadeOut(gainNode) {
        if (gainNode) {
            gainNode.gain.linearRampToValueAtTime(0, this.context.currentTime + this.fadeDuration);
            setTimeout(() => {
                try { this.currentSource?.stop(); } catch(e) {}
            }, this.fadeDuration * 1000);
        }
    },

    stop() {
        if (this.currentSource) {
            this.fadeOut(this.currentGain);
            this.currentSource = null;
            this.currentGain = null;
            this.currentTrack = null;
            const indicator = document.getElementById('audio-indicator');
            if (indicator) indicator.classList.remove('playing');
        }
    },

    // Play a one-shot sound effect
    async playEffect(url, volume = 1) {
        try {
            await this.init();

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

            const source = this.context.createBufferSource();
            const gain = this.context.createGain();
            source.buffer = audioBuffer;
            source.loop = false;
            gain.gain.value = volume;
            source.connect(gain);
            gain.connect(this.context.destination);
            source.start();

            return source;
        } catch (e) {
            this.log(`Effect error: ${e.message}`, 'error');
            return null;
        }
    },

    // Get current playback info
    getInfo() {
        return {
            contextState: this.context?.state,
            currentTrack: this.currentTrack,
            unlocked: this.unlocked
        };
    },

    log(msg, type = 'info') {
        if (window.FinkDevPanel) {
            FinkDevPanel.log(`Audio: ${msg}`, type);
        } else {
            console.log(`[FinkAudio] ${msg}`);
        }
    }
};

// Auto-unlock on first user interaction
['click', 'touchstart', 'keydown'].forEach(event => {
    document.addEventListener(event, () => FinkAudio.unlock(), { once: true, passive: true });
});
