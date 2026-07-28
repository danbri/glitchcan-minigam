/**
 * MinigameSDK - Client-side SDK for FINK minigames
 *
 * Runs inside the sandboxed iframe. Provides a clean API for minigames
 * to communicate with the FINK host via postMessage.
 *
 * Usage:
 *   const sdk = new MinigameSDK();
 *   sdk.onInit((config, variables) => startGame(config, variables));
 *   sdk.onPause(() => pauseGame());
 *   sdk.onResume(() => resumeGame());
 *   sdk.setVariable('diamonds', 5);
 *   sdk.complete({ success: true, score: 100 });
 */

class MinigameSDK {
    constructor() {
        this._config = null;
        this._variables = {};
        this._callbacks = {
            init: null,
            pause: null,
            resume: null,
            terminate: null,
            variableChanged: null,
            controls: null,
            audio: null
        };
        this._ready = false;
        this._paused = false;
        this._contracts = new Set();
        this._busSubs = [];

        /**
         * The guest's scoped view of the shell bus. A stage guest is a
         * full foafos app: it may publish in its granted namespace
         * (default `guest.<type>.*`) and hears the granted shell
         * surfaces (default wm.mode, audio.volume, story.state). The
         * HOST enforces the grants; a denied publish is dropped and
         * announced shell-side (sys.guest.denied), never silent.
         * Grants arrive in init as `config.bus`. Standalone (no host)
         * these are honest no-ops.
         *
         *   sdk.bus.publish('guest.mygame.beat', { kind: 'win' });
         *   sdk.bus.subscribe('wm.mode', (e) => layout(e.data.mode));
         */
        this.bus = {
            publish: (topic, data = {}) => {
                this._declareOnce('bus');
                this._sendMessage({ type: 'bus-publish', topic, data });
            },
            subscribe: (pattern, callback) => {
                this._declareOnce('bus');
                const sub = { pattern, callback };
                this._busSubs.push(sub);
                return () => {
                    const i = this._busSubs.indexOf(sub);
                    if (i >= 0) this._busSubs.splice(i, 1);
                };
            },
        };

        // Setup message listener
        window.addEventListener('message', (event) => this._handleMessage(event));

        // Signal ready to host
        this._sendMessage({ type: 'ready', capabilities: ['pause', 'resume', 'debug-clock'] });
        this._log('SDK initialized, sent ready signal');
    }

    /**
     * Register callback for initialization
     * @param {Function} callback - (config, variables) => void
     */
    onInit(callback) {
        this._callbacks.init = callback;
        // If already initialized, call immediately
        if (this._config !== null) {
            callback(this._config, this._variables);
        }
        return this;
    }

    /**
     * Register callback for pause event
     * @param {Function} callback - () => void
     */
    onPause(callback) {
        this._callbacks.pause = callback;
        return this;
    }

    /**
     * Register callback for resume event
     * @param {Function} callback - () => void
     */
    onResume(callback) {
        this._callbacks.resume = callback;
        return this;
    }

    /**
     * Register callback for terminate event
     * @param {Function} callback - (reason) => void
     */
    onTerminate(callback) {
        this._callbacks.terminate = callback;
        return this;
    }

    /**
     * Register a controls handler — and, by doing so, TELL THE SHELL you
     * speak the controls contract.
     *
     * The shell cannot see inside this iframe, so "does this widget know
     * its duties?" is answered by asking and seeing who answers.
     * Registering here is the answer. A guest that never calls this is
     * assumed to predate the contract, and the shell RETRACTS its own
     * d-pad rather than stacking one on top of the guest's — which is
     * exactly the bug this replaces (mudslider drew its arrows under the
     * shell's joystick).
     *
     * So: silence costs a legacy widget nothing. Adaptation costs one
     * line.
     *
     *   sdk.onControls(({ provider }) => {
     *     myPad.hidden = (provider === 'host');
     *   });
     *
     * The callback fires on init and again whenever the shell changes
     * its mind (e.g. after retracting or restoring the service).
     *
     * @param {Function} callback - ({provider, scheme}) => void
     */
    onControls(callback) {
        this._callbacks.controls = callback;
        this._declare('controls');
        // if init already landed, honour it immediately
        if (this._config?.controls) callback(this._config.controls);
        return this;
    }

    /**
     * Register an audio handler — and, by doing so, let the shell's
     * volume and mute actually reach you.
     *
     * This one matters more than it looks. The shell CANNOT turn a guest
     * down: an iframe has its own AudioContext and there is no
     * `iframe.volume`. So a master volume is only real for guests that
     * answer. A guest that stays silent keeps playing through a mute,
     * and the shell reports it as ungovernable rather than showing a
     * slider that quietly lies.
     *
     *   sdk.onAudio(({ level }) => { myGain.gain.value = level; });
     *
     * @param {Function} callback - ({level, volume, muted}) => void
     */
    onAudio(callback) {
        this._callbacks.audio = callback;
        this._declare('audio');
        if (this._audioState) callback(this._audioState);
        return this;
    }

    /**
     * Hand the shell something that can bring this game back.
     *
     * Registering declares the `snapshot` contract, which is what lets
     * the shell tell the truth in the switcher: a guest that never
     * registers is honestly reported as one that will not survive being
     * closed, rather than being closed with a shrug.
     *
     * The callback returns anything structured-cloneable. Keep it small
     * — it crosses postMessage and the shell DOES persist it (JSON, in
     * its own store namespace, so it outlives a reload). Return `null`
     * to decline: state that would restore to something incoherent
     * (mid-animation, mid-deal) is better refused than saved.
     *
     * @param {Function} callback - () => state
     */
    onSnapshot(callback) {
        this._callbacks.snapshot = callback;
        this._declare('snapshot');
        return this;
    }

    /**
     * Take back what onSnapshot handed over. Called BEFORE onInit's
     * callback returns is not guaranteed — treat it as "at some point
     * early", and make it idempotent.
     * @param {Function} callback - (state) => void
     */
    onRestore(callback) {
        this._callbacks.restore = callback;
        this._declare('snapshot');
        // A restore may have arrived while this guest was still wiring
        // itself up; replay it rather than dropping it on the floor.
        if (this._pendingRestore !== undefined) {
            const s = this._pendingRestore;
            this._pendingRestore = undefined;
            try { callback(s); } catch (e) { this._log('restore failed: ' + e.message); }
        }
        return this;
    }

    /** Tell the shell which contracts this guest speaks. */
    _declare(contract) {
        this._contracts.add(contract);
        this._sendMessage({ type: 'conformance', contracts: [...this._contracts] });
    }

    /** _declare, but quiet on repeats — bus calls happen per-frame. */
    _declareOnce(contract) {
        if (!this._contracts.has(contract)) this._declare(contract);
    }

    /** Topic matching, same semantics as FoafBus: '*', exact, 'prefix.*'. */
    _busMatch(pattern, topic) {
        if (pattern === '*' || pattern === topic) return true;
        return pattern.endsWith('.*') && topic.startsWith(pattern.slice(0, -1));
    }

    /**
     * Register callback for variable changes from story
     * @param {Function} callback - (name, value) => void
     */
    onVariableChanged(callback) {
        this._callbacks.variableChanged = callback;
        return this;
    }

    /**
     * Set an INK variable (must be in manifest's write allowlist)
     * @param {string} name - Variable name
     * @param {*} value - Variable value
     */
    setVariable(name, value) {
        this._sendMessage({
            type: 'set-variable',
            name,
            value
        });
        // Also update local copy
        this._variables[name] = value;
    }

    /**
     * Get current value of a variable
     * @param {string} name - Variable name
     * @returns {*} Variable value
     */
    getVariable(name) {
        return this._variables[name];
    }

    /**
     * Get all variables
     * @returns {Object} All variables
     */
    getVariables() {
        return { ...this._variables };
    }

    /**
     * Get configuration
     * @returns {Object} Config object
     */
    getConfig() {
        return this._config ? { ...this._config } : null;
    }

    /**
     * Check if game is currently paused
     * @returns {boolean}
     */
    isPaused() {
        return this._paused;
    }

    /**
     * Signal progress update to host
     * @param {Object} data - Progress data (e.g., { score: 50, level: 3 })
     */
    progress(data) {
        this._sendMessage({
            type: 'progress',
            data
        });
    }

    /**
     * Signal game completion
     * @param {Object} result - Result object
     * @param {boolean} result.success - Whether player succeeded
     * @param {number} [result.score] - Final score
     * @param {Object} [result.variables] - Variables to update in INK story
     */
    complete(result) {
        this._sendMessage({
            type: 'complete',
            result: {
                success: result.success,
                score: result.score,
                variables: result.variables || {}
            }
        });
        this._log(`Game complete: success=${result.success}, score=${result.score}`);
    }

    /**
     * Report an error to the host
     * @param {string} code - Error code
     * @param {string} message - Human-readable message
     */
    error(code, message) {
        this._sendMessage({
            type: 'error',
            code,
            message
        });
        this._log(`Error reported: ${code} - ${message}`);
    }

    /**
     * Handle incoming messages from host
     */
    _handleMessage(event) {
        const data = event.data;
        if (!data || typeof data.type !== 'string') return;

        // Don't log key events (too noisy)
        if (data.type !== 'key') {
            this._log(`Received message: ${data.type}`);
        }

        switch (data.type) {
            case 'init':
                this._config = data.config || {};
                this._variables = data.variables || {};
                this._ready = true;
                if (this._callbacks.init) {
                    this._callbacks.init(this._config, this._variables);
                }
                // Answer the probe with whatever we speak. Sent AFTER the
                // init callback so a guest that registers onControls from
                // inside onInit is still counted.
                if (this._contracts.size) {
                    this._sendMessage({ type: 'conformance', contracts: [...this._contracts] });
                }
                if (this._callbacks.controls && this._config.controls) {
                    this._callbacks.controls(this._config.controls);
                }
                if (this._callbacks.audio && this._config.audio) {
                    this._audioState = this._config.audio;
                    this._callbacks.audio(this._config.audio);
                }
                break;

            case 'controls':
                // the shell changed its mind (retracted or restored)
                this._config = { ...(this._config || {}), controls: data.controls };
                if (this._callbacks.controls) this._callbacks.controls(data.controls || {});
                break;

            case 'audio-level':
                this._audioState = { level: data.level, volume: data.volume, muted: data.muted };
                if (this._callbacks.audio) this._callbacks.audio(this._audioState);
                break;

            case 'pause':
                this._paused = true;
                if (this._callbacks.pause) {
                    this._callbacks.pause();
                }
                break;

            case 'resume':
                this._paused = false;
                if (this._callbacks.resume) {
                    this._callbacks.resume();
                }
                break;

            case 'terminate':
                if (this._callbacks.terminate) {
                    this._callbacks.terminate(data.reason);
                }
                break;

            case 'variable-changed':
                this._variables[data.name] = data.value;
                if (this._callbacks.variableChanged) {
                    this._callbacks.variableChanged(data.name, data.value);
                }
                break;

            case 'key':
                // Handle keyboard events from parent d-pad
                this._dispatchKeyEvent(data.event, data.key, data.code, data.repeat);
                break;

            case 'snapshot':
                // The shell is about to lose us and is asking what to keep.
                this._sendMessage({
                    type: 'snapshot-data',
                    state: this._callbacks.snapshot ? this._callbacks.snapshot() : null,
                });
                break;

            case 'restore':
                if (this._callbacks.restore) {
                    try { this._callbacks.restore(data.state); }
                    catch (e) { this._log('restore failed: ' + e.message); }
                } else {
                    // arrived before onRestore was registered
                    this._pendingRestore = data.state;
                }
                break;

            case 'bus-event': {
                // A granted shell bus event. Dispatch to local subscribers
                // whose pattern matches; the host already filtered by grant.
                const ev = data.event;
                if (!ev || typeof ev.topic !== 'string') break;
                for (const sub of [...this._busSubs]) {
                    if (this._busMatch(sub.pattern, ev.topic)) {
                        try { sub.callback(ev); }
                        catch (e) { this._log('bus subscriber failed: ' + e.message); }
                    }
                }
                break;
            }

            case 'debug':
                // debug-clock.js has its own listener for this; the SDK
                // only needs to not call it "unknown".
                break;

            default:
                this._log(`Unknown message type: ${data.type}`);
        }
    }

    // ---- Debug clock ----------------------------------------------------
    // Implemented once, in debug-clock.js, so guests that speak the
    // protocol natively (robbin) get it too. The SDK only forwards.
    // If debug-clock.js was not included, these are honest no-ops.

    /** @param {number} scale 1 = real time, 0.02 = 50x slow, 0 = frozen */
    setTimeScale(scale) {
        if (window.__mgDebug) {
            const s = window.__mgDebug.setTimeScale(scale);
            this._log(`time scale ${s}`);
        } else {
            this._log('setTimeScale ignored: debug-clock.js not loaded');
        }
        return this;
    }

    /** Advance exactly n frames while frozen — deterministic stepping. */
    stepFrames(n = 1) {
        window.__mgDebug?.stepFrames(n);
        return this;
    }

    get timeScale() { return window.__mgDebug?.state.scale ?? 1; }

    /**
     * Dispatch a synthetic keyboard event
     * Used for mobile d-pad controls sent from parent
     */
    _dispatchKeyEvent(eventType, key, code, repeat = false) {
        const event = new KeyboardEvent(eventType, {
            key: key,
            code: code || key,
            keyCode: this._getKeyCode(key),
            which: this._getKeyCode(key),
            // a held pad button autorepeats in the host's input service;
            // games read e.repeat to tell a hold from a fresh tap
            repeat: !!repeat,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(event);
    }

    /**
     * Get legacy keyCode for a key
     */
    _getKeyCode(key) {
        const codes = {
            'ArrowUp': 38,
            'ArrowDown': 40,
            'ArrowLeft': 37,
            'ArrowRight': 39,
            ' ': 32,
            'Space': 32,
            'Enter': 13,
            'Escape': 27
        };
        return codes[key] || 0;
    }

    /**
     * Send message to host
     */
    _sendMessage(data) {
        if (window.parent !== window) {
            window.parent.postMessage(data, '*');
        } else {
            // Running standalone (no parent iframe)
            this._log(`[Standalone] Would send: ${JSON.stringify(data)}`);
        }
    }

    /**
     * Internal logging
     */
    _log(msg) {
        console.log(`[MinigameSDK] ${msg}`);
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MinigameSDK };
}

// Also make available globally for script tag usage
window.MinigameSDK = MinigameSDK;
