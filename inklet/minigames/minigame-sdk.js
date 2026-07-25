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

    /** Tell the shell which contracts this guest speaks. */
    _declare(contract) {
        this._contracts.add(contract);
        this._sendMessage({ type: 'conformance', contracts: [...this._contracts] });
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
