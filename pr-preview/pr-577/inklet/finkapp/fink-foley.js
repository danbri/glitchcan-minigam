// FINK Foley - WebAudio procedural sound synthesizer
// Supports multiple simultaneous layered sounds with Perlin noise modulation

window.FinkFoley = {
    context: null,
    masterGain: null,
    layers: {},  // Named layers for concurrent sounds: { layerId: { nodes, intervals, gainNode } }

    // Classic 1D Perlin noise implementation
    perlinGrad: null,
    perlinPerm: null,

    initPerlin() {
        if (this.perlinPerm) return;
        const perm = [];
        for (let i = 0; i < 256; i++) perm[i] = i;
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [perm[i], perm[j]] = [perm[j], perm[i]];
        }
        this.perlinPerm = [...perm, ...perm];
        this.perlinGrad = perm.map(() => Math.random() * 2 - 1);
    },

    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); },
    lerp(a, b, t) { return a + t * (b - a); },

    perlin(x) {
        this.initPerlin();
        const xi = Math.floor(x) & 255;
        const xf = x - Math.floor(x);
        const u = this.fade(xf);
        return this.lerp(
            this.perlinGrad[this.perlinPerm[xi]] * xf,
            this.perlinGrad[this.perlinPerm[xi + 1]] * (xf - 1),
            u
        );
    },

    fbm(x, octaves = 4, lacunarity = 2, persistence = 0.5) {
        let value = 0, amplitude = 1, frequency = 1, maxValue = 0;
        for (let i = 0; i < octaves; i++) {
            value += this.perlin(x * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        return value / maxValue;
    },

    perlinModulate(param, baseValue, depth, rate, duration) {
        const ctx = this.context;
        const startTime = ctx.currentTime;
        const steps = Math.ceil(duration * 20);
        const offset = Math.random() * 1000;
        for (let i = 0; i <= steps; i++) {
            const t = i / 20;
            const noise = this.fbm((offset + t) * rate, 4);
            param.setValueAtTime(Math.max(0.001, baseValue + noise * depth), startTime + t);
        }
    },

    async init() {
        if (!this.context) {
            this.context = window.FinkAudio?.context || new (window.AudioContext || window.webkitAudioContext)();
            if (window.FinkAudio) window.FinkAudio.context = this.context;
            this.masterGain = this.context.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.context.destination);
        }
        if (this.context.state === 'suspended') await this.context.resume();
        return true;
    },

    // Stop a specific layer or all layers
    stop(layerId = null) {
        const stopLayer = (id) => {
            const layer = this.layers[id];
            if (!layer) return;
            layer.nodes.forEach(node => {
                try { if (node.stop) node.stop(); if (node.disconnect) node.disconnect(); } catch(e) {}
            });
            layer.intervals.forEach(id => clearInterval(id));
            delete this.layers[id];
        };
        if (layerId) {
            stopLayer(layerId);
            this.log(`Stopped layer '${layerId}'`);
        } else {
            Object.keys(this.layers).forEach(stopLayer);
            this.log('Stopped all layers');
        }
    },

    // Create a new layer with its own gain/panner
    createLayer(layerId, params = {}) {
        this.stop(layerId); // Stop existing layer with same ID
        const ctx = this.context;
        const panner = ctx.createStereoPanner();
        panner.pan.value = params.pan ?? 0;
        const gain = ctx.createGain();
        gain.gain.value = params.vol ?? 1;
        gain.connect(panner);
        panner.connect(this.masterGain);
        this.layers[layerId] = { nodes: [gain, panner], intervals: [], gainNode: gain, pannerNode: panner };
        return { gain, panner, output: gain };
    },

    // Create noise buffer helper
    createNoise(ctx, seconds = 2) {
        const bufferSize = ctx.sampleRate * seconds;
        const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = buffer.getChannelData(ch);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    },

    // Default params helper
    defaults(params, defs) {
        return { ...defs, ...params };
    },

    log(msg) {
        if (window.FinkDevPanel) {
            window.FinkDevPanel.log(`Foley: ${msg}`, 'info');
        } else {
            console.log(`[Foley] ${msg}`);
        }
    },

    // ===== FOLEY SOUND TYPES =====

    // WATER: drips + stream with Perlin timing
    async water(params = {}, layerId = 'water') {
        await this.init();
        const p = this.defaults(params, { pan: 0, vol: 1, pitch: 1, rate: 1, depth: 0.5, drip: 0.5, dur: 60 });
        const ctx = this.context;
        const layer = this.createLayer(layerId, p);
        this.log(`water(pan:${p.pan}, vol:${p.vol}, drip:${p.drip})`);

        // Base stream - filtered noise
        const stream = ctx.createBufferSource();
        stream.buffer = this.createNoise(ctx, 3);
        stream.loop = true;
        const streamFilter = ctx.createBiquadFilter();
        streamFilter.type = 'bandpass';
        streamFilter.frequency.value = 800 * p.pitch;
        streamFilter.Q.value = 0.8;
        const streamGain = ctx.createGain();
        streamGain.gain.value = 0.12 * p.vol * (1 - p.drip * 0.5);
        stream.connect(streamFilter);
        streamFilter.connect(streamGain);
        streamGain.connect(layer.output);
        stream.start();
        stream.stop(ctx.currentTime + p.dur);
        this.layers[layerId].nodes.push(stream, streamFilter, streamGain);

        // Drip generator
        const playDrip = () => {
            const dripPan = (Math.random() * 2 - 1) * 0.8;
            const freq = (1200 + Math.random() * 2000) * p.pitch;
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.3, ctx.currentTime + 0.15);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.08 * p.vol, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            const pan = ctx.createStereoPanner();
            pan.pan.value = p.pan + dripPan * 0.3;
            osc.connect(g); g.connect(pan); pan.connect(this.masterGain);
            osc.start(); osc.stop(ctx.currentTime + 0.25);
        };

        let t = 0;
        const dripInt = setInterval(() => {
            t += 0.1;
            const chance = (0.2 + p.drip * 0.5) + this.fbm(t * p.rate * 2, 3) * p.depth * 0.4;
            if (Math.random() < chance) playDrip();
        }, 150);
        this.layers[layerId].intervals.push(dripInt);
        setTimeout(() => this.stop(layerId), p.dur * 1000);
    },

    // WIND: multi-layer noise with gusts
    async wind(params = {}, layerId = 'wind') {
        await this.init();
        const p = this.defaults(params, { pan: 0, vol: 1, pitch: 1, rate: 1, depth: 0.5, gust: 0.5, dur: 60 });
        const ctx = this.context;
        const layer = this.createLayer(layerId, p);
        this.log(`wind(pan:${p.pan}, vol:${p.vol}, gust:${p.gust})`);

        // Frequency layers
        const bands = [
            { freq: 150 * p.pitch, q: 0.3, g: 0.25, r: 0.15 },
            { freq: 400 * p.pitch, q: 0.5, g: 0.15, r: 0.25 },
            { freq: 1200 * p.pitch, q: 0.8, g: 0.08, r: 0.4 }
        ];
        bands.forEach(b => {
            const n = ctx.createBufferSource();
            n.buffer = this.createNoise(ctx, 3);
            n.loop = true;
            const f = ctx.createBiquadFilter();
            f.type = 'lowpass'; f.frequency.value = b.freq; f.Q.value = b.q;
            const g = ctx.createGain();
            g.gain.value = b.g * p.vol;
            this.perlinModulate(f.frequency, b.freq, b.freq * 0.6 * p.depth, b.r * p.rate, p.dur);
            this.perlinModulate(g.gain, b.g * p.vol, b.g * p.vol * 0.4 * p.depth, b.r * p.rate * 0.7, p.dur);
            n.connect(f); f.connect(g); g.connect(layer.output);
            n.start(); n.stop(ctx.currentTime + p.dur);
            this.layers[layerId].nodes.push(n, f, g);
        });

        // Perlin pan drift
        this.perlinModulate(layer.panner.pan, p.pan, 0.4 * p.depth, 0.1 * p.rate, p.dur);

        // Gusts
        if (p.gust > 0) {
            const gustInt = setInterval(() => {
                const gustVal = this.fbm(Date.now() / 5000, 3);
                if (gustVal > (1 - p.gust) * 0.6) {
                    const intensity = (gustVal - (1 - p.gust) * 0.6) * p.gust * p.vol;
                    const gGain = ctx.createGain();
                    gGain.gain.setValueAtTime(0, ctx.currentTime);
                    gGain.gain.linearRampToValueAtTime(intensity, ctx.currentTime + 0.5);
                    gGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
                    const gNoise = ctx.createBufferSource();
                    gNoise.buffer = this.createNoise(ctx, 2);
                    const gFilter = ctx.createBiquadFilter();
                    gFilter.type = 'lowpass';
                    gFilter.frequency.value = (300 + this.fbm(Date.now() / 3000) * 200) * p.pitch;
                    gNoise.connect(gFilter); gFilter.connect(gGain); gGain.connect(layer.output);
                    gNoise.start(); gNoise.stop(ctx.currentTime + 2.5);
                }
            }, 2000);
            this.layers[layerId].intervals.push(gustInt);
        }
        setTimeout(() => this.stop(layerId), p.dur * 1000);
    },

    // FIRE: crackling with pops and roar
    async fire(params = {}, layerId = 'fire') {
        await this.init();
        const p = this.defaults(params, { pan: 0, vol: 1, pitch: 1, rate: 1, depth: 0.5, crackle: 0.6, dur: 60 });
        const ctx = this.context;
        const layer = this.createLayer(layerId, p);
        this.log(`fire(pan:${p.pan}, vol:${p.vol}, crackle:${p.crackle})`);

        // Base roar - filtered noise
        const roar = ctx.createBufferSource();
        roar.buffer = this.createNoise(ctx, 3);
        roar.loop = true;
        const roarFilter = ctx.createBiquadFilter();
        roarFilter.type = 'lowpass';
        roarFilter.frequency.value = 400 * p.pitch;
        roarFilter.Q.value = 1;
        const roarGain = ctx.createGain();
        roarGain.gain.value = 0.15 * p.vol;
        this.perlinModulate(roarFilter.frequency, 400 * p.pitch, 200 * p.depth, 0.3 * p.rate, p.dur);
        this.perlinModulate(roarGain.gain, 0.15 * p.vol, 0.08 * p.vol * p.depth, 0.2 * p.rate, p.dur);
        roar.connect(roarFilter); roarFilter.connect(roarGain); roarGain.connect(layer.output);
        roar.start(); roar.stop(ctx.currentTime + p.dur);
        this.layers[layerId].nodes.push(roar, roarFilter, roarGain);

        // Crackle/pop generator
        const playCrackle = () => {
            const n = ctx.createBufferSource();
            n.buffer = this.createNoise(ctx, 0.1);
            const f = ctx.createBiquadFilter();
            f.type = 'highpass';
            f.frequency.value = (1500 + Math.random() * 3000) * p.pitch;
            const g = ctx.createGain();
            const vol = (0.1 + Math.random() * 0.2) * p.vol * p.crackle;
            g.gain.setValueAtTime(vol, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05 + Math.random() * 0.1);
            const pan = ctx.createStereoPanner();
            pan.pan.value = p.pan + (Math.random() - 0.5) * 0.6;
            n.connect(f); f.connect(g); g.connect(pan); pan.connect(this.masterGain);
            n.start(); n.stop(ctx.currentTime + 0.15);
        };

        const playPop = () => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            const freq = (80 + Math.random() * 120) * p.pitch;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.2, ctx.currentTime + 0.08);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.3 * p.vol * p.crackle, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
            const pan = ctx.createStereoPanner();
            pan.pan.value = p.pan + (Math.random() - 0.5) * 0.4;
            osc.connect(g); g.connect(pan); pan.connect(this.masterGain);
            osc.start(); osc.stop(ctx.currentTime + 0.12);
        };

        let t = 0;
        const crackleInt = setInterval(() => {
            t += 0.05;
            const intensity = 0.3 + this.fbm(t * p.rate * 3, 3) * p.depth * 0.5;
            if (Math.random() < intensity * p.crackle) playCrackle();
            if (Math.random() < intensity * p.crackle * 0.3) playPop();
        }, 50);
        this.layers[layerId].intervals.push(crackleInt);
        setTimeout(() => this.stop(layerId), p.dur * 1000);
    },

    // MACHINERY: throbbing, pulsing industrial sound
    async machinery(params = {}, layerId = 'machinery') {
        await this.init();
        const p = this.defaults(params, { pan: 0, vol: 1, pitch: 1, rate: 1, depth: 0.5, throb: 2, dur: 60 });
        const ctx = this.context;
        const layer = this.createLayer(layerId, p);
        this.log(`machinery(pan:${p.pan}, vol:${p.vol}, throb:${p.throb}Hz)`);

        // Base drone - detuned oscillators
        const baseFreq = 55 * p.pitch;
        const osc1 = ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.value = baseFreq;
        const osc2 = ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.value = baseFreq * 1.005;
        const osc3 = ctx.createOscillator();
        osc3.type = 'square';
        osc3.frequency.value = baseFreq * 2;

        // Throb LFO - amplitude modulation
        const throbLfo = ctx.createOscillator();
        throbLfo.type = 'sine';
        throbLfo.frequency.value = p.throb;
        const throbGain = ctx.createGain();
        throbGain.gain.value = 0.3 * p.depth;
        throbLfo.connect(throbGain);

        // Mixer for oscillators
        const oscMix = ctx.createGain();
        oscMix.gain.value = 0.2 * p.vol;
        throbGain.connect(oscMix.gain);
        osc1.connect(oscMix);
        osc2.connect(oscMix);
        const osc3Gain = ctx.createGain();
        osc3Gain.gain.value = 0.3;
        osc3.connect(osc3Gain);
        osc3Gain.connect(oscMix);

        // Low-pass filter for warmth
        const lpf = ctx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.value = 800 * p.pitch;
        lpf.Q.value = 2;
        this.perlinModulate(lpf.frequency, 800 * p.pitch, 400 * p.depth, 0.2 * p.rate, p.dur);

        // Mechanical noise layer
        const mechNoise = ctx.createBufferSource();
        mechNoise.buffer = this.createNoise(ctx, 2);
        mechNoise.loop = true;
        const noiseBpf = ctx.createBiquadFilter();
        noiseBpf.type = 'bandpass';
        noiseBpf.frequency.value = 2000 * p.pitch;
        noiseBpf.Q.value = 5;
        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0.05 * p.vol;
        const noiseThrobGain = ctx.createGain();
        noiseThrobGain.gain.value = 0.03 * p.depth;
        throbLfo.connect(noiseThrobGain);
        noiseThrobGain.connect(noiseGain.gain);

        mechNoise.connect(noiseBpf);
        noiseBpf.connect(noiseGain);
        noiseGain.connect(layer.output);

        oscMix.connect(lpf);
        lpf.connect(layer.output);

        // Fade in
        layer.gainNode.gain.setValueAtTime(0, ctx.currentTime);
        layer.gainNode.gain.linearRampToValueAtTime(p.vol, ctx.currentTime + 2);

        throbLfo.start();
        osc1.start(); osc2.start(); osc3.start();
        mechNoise.start();
        throbLfo.stop(ctx.currentTime + p.dur);
        osc1.stop(ctx.currentTime + p.dur);
        osc2.stop(ctx.currentTime + p.dur);
        osc3.stop(ctx.currentTime + p.dur);
        mechNoise.stop(ctx.currentTime + p.dur);

        this.layers[layerId].nodes.push(osc1, osc2, osc3, throbLfo, mechNoise, lpf, oscMix);
        setTimeout(() => this.stop(layerId), p.dur * 1000);
    },

    // RUMBLE: low ominous bass
    async rumble(params = {}, layerId = 'rumble') {
        await this.init();
        const p = this.defaults(params, { pan: 0, vol: 1, pitch: 1, rate: 1, depth: 0.5, dur: 60 });
        const ctx = this.context;
        const layer = this.createLayer(layerId, p);
        this.log(`rumble(pan:${p.pan}, vol:${p.vol})`);

        // Very low frequency oscillators
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = 30 * p.pitch;
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 35 * p.pitch;

        // Filtered noise layer
        const noise = ctx.createBufferSource();
        noise.buffer = this.createNoise(ctx, 3);
        noise.loop = true;
        const lpf = ctx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.value = 100 * p.pitch;
        lpf.Q.value = 0.7;
        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0.15 * p.vol;

        // Mix oscillators
        const oscGain = ctx.createGain();
        oscGain.gain.value = 0.25 * p.vol;
        this.perlinModulate(oscGain.gain, 0.25 * p.vol, 0.15 * p.vol * p.depth, 0.1 * p.rate, p.dur);

        osc1.connect(oscGain);
        osc2.connect(oscGain);
        oscGain.connect(layer.output);

        noise.connect(lpf);
        lpf.connect(noiseGain);
        noiseGain.connect(layer.output);

        // Fade in
        layer.gainNode.gain.setValueAtTime(0, ctx.currentTime);
        layer.gainNode.gain.linearRampToValueAtTime(p.vol, ctx.currentTime + 3);

        osc1.start(); osc2.start(); noise.start();
        osc1.stop(ctx.currentTime + p.dur);
        osc2.stop(ctx.currentTime + p.dur);
        noise.stop(ctx.currentTime + p.dur);

        this.layers[layerId].nodes.push(osc1, osc2, noise, lpf, oscGain, noiseGain);
        setTimeout(() => this.stop(layerId), p.dur * 1000);
    },

    // Parse FOLEY tag format: type(params)
    // e.g., "water(drip:0.8, vol:0.5)" or just "water"
    parseFoleyTag(tagValue) {
        const match = tagValue.match(/^(\w+)(?:\(([^)]*)\))?$/);
        if (!match) return null;
        const type = match[1].toLowerCase();
        const params = {};
        if (match[2]) {
            match[2].split(',').forEach(part => {
                const [key, val] = part.split(':').map(s => s.trim());
                if (key && val) params[key] = parseFloat(val) || val;
            });
        }
        return { type, params };
    },

    // Play foley from parsed tag
    async playFoley(tagValue, layerPrefix = 'foley') {
        const parsed = this.parseFoleyTag(tagValue);
        if (!parsed) {
            this.log(`Invalid tag format: ${tagValue}`);
            return;
        }
        const { type, params } = parsed;
        const layerId = `${layerPrefix}_${type}_${Date.now()}`;
        switch (type) {
            case 'water': await this.water(params, layerId); break;
            case 'wind': await this.wind(params, layerId); break;
            case 'fire': await this.fire(params, layerId); break;
            case 'machinery': await this.machinery(params, layerId); break;
            case 'rumble': await this.rumble(params, layerId); break;
            default: this.log(`Unknown type '${type}'`);
        }
    }
};
