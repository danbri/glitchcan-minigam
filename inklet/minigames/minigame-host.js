/**
 * MinigameHost - Secure minigame integration for FINK Player
 *
 * Runs in the finkapp context. Manages iframe lifecycle, postMessage
 * communication, and bridges INK variables to/from minigames.
 *
 * Security: Minigames run in sandboxed iframes with restricted permissions.
 * They can only read/write variables declared in their manifest.
 */

window.MinigameHost = {
    // State
    active: false,
    currentMinigame: null,
    iframe: null,
    manifest: null,
    messageHandler: null,
    timeoutId: null,

    // Callbacks
    _onComplete: null,
    _onError: null,
    _onProgress: null,

    // Config
    config: {
        basePath: '/inklet/minigames/',
        defaultTimeout: 300000, // 5 minutes
        messageOrigin: '*' // In production, restrict to known origins
    },

    /**
     * Load and start a minigame
     * @param {string} name - Minigame name (e.g., 'gems', 'chess', 'slovib')
     * @param {Object} options - Configuration options
     * @param {string} options.mode - Game mode (from manifest.modes)
     * @param {Object} options.variables - Initial variable values to pass
     * @param {Object} options.config - Additional config to pass
     * @param {Function} options.onComplete - Called when minigame completes
     * @param {Function} options.onError - Called on error
     * @param {Function} options.onProgress - Called on progress updates
     */
    async start(name, options = {}) {
        if (this.active) {
            this.log('Cannot start minigame - another is active');
            return false;
        }

        try {
            // Load manifest
            const manifestUrl = `${this.config.basePath}${name}/manifest.json`;
            const response = await fetch(manifestUrl);
            if (!response.ok) {
                throw new Error(`Failed to load manifest: ${response.status}`);
            }
            this.manifest = await response.json();
            this.log(`Loaded manifest for "${name}": ${this.manifest.title}`);

            // Validate options against manifest
            if (options.mode && !this.manifest.modes?.[options.mode]) {
                this.log(`Warning: Unknown mode "${options.mode}", using default`);
            }

            // Store callbacks
            this._onComplete = options.onComplete;
            this._onError = options.onError;
            this._onProgress = options.onProgress;

            // Create sandboxed iframe
            this._createIframe(name);

            // Setup message listener
            this._setupMessageHandler();

            // Set timeout
            const timeout = this.manifest.sandbox?.timeout || this.config.defaultTimeout;
            this.timeoutId = setTimeout(() => {
                this.log('Minigame timed out');
                this.terminate('TIMEOUT');
            }, timeout);

            // Mark as active
            this.active = true;
            this.currentMinigame = name;

            // Switch UI view
            this._switchToMinigameView();

            // Wait for ready signal, then send init
            // (init is sent in _handleMessage when we receive 'ready')
            this._pendingInit = {
                config: {
                    mode: options.mode || 'normal',
                    ...options.config
                },
                variables: this._getReadableVariables(options.variables)
            };

            this.log(`Started minigame "${name}" in mode "${options.mode || 'normal'}"`);
            return true;

        } catch (error) {
            this.log(`Error starting minigame: ${error.message}`);
            if (this._onError) this._onError({ code: 'LOAD_FAILED', message: error.message });
            return false;
        }
    },

    /**
     * Create sandboxed iframe for minigame
     */
    _createIframe(name) {
        // Get or create container
        let container = document.getElementById('minigame-iframe-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'minigame-iframe-container';
            container.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:1000;display:none;';
            document.body.appendChild(container);
        }

        // Clear any existing iframe
        container.innerHTML = '';

        // Create iframe with sandbox
        this.iframe = document.createElement('iframe');

        // Sandbox permissions - ONLY allow scripts, nothing else
        const permissions = this.manifest.sandbox?.permissions || ['allow-scripts'];
        this.iframe.sandbox = permissions.join(' ');

        // Set source
        this.iframe.src = `${this.config.basePath}${name}/${this.manifest.entry || 'index.html'}`;

        // Styling
        const ui = this.manifest.ui || {};
        this.iframe.style.cssText = `
            width: ${ui.width || '100%'};
            height: ${ui.height || '100%'};
            border: none;
            background: ${ui.background || '#1a1a2e'};
        `;

        // Block certain features
        this.iframe.allow = 'autoplay'; // Allow autoplay for game sounds
        this.iframe.referrerPolicy = 'no-referrer';

        container.appendChild(this.iframe);
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.background = 'rgba(0,0,0,0.9)';
    },

    /**
     * Setup postMessage handler
     */
    _setupMessageHandler() {
        // Remove old handler if exists
        if (this.messageHandler) {
            window.removeEventListener('message', this.messageHandler);
        }

        this.messageHandler = (event) => {
            // In production, validate origin
            // if (event.origin !== expectedOrigin) return;

            // Validate source is our iframe
            if (this.iframe && event.source !== this.iframe.contentWindow) {
                return;
            }

            this._handleMessage(event.data);
        };

        window.addEventListener('message', this.messageHandler);
    },

    /**
     * Handle incoming messages from minigame
     */
    _handleMessage(data) {
        if (!data || typeof data.type !== 'string') return;

        this.log(`Received message: ${data.type}`);

        switch (data.type) {
            case 'ready':
                // Minigame is ready, send init
                if (this._pendingInit) {
                    this._sendMessage({
                        type: 'init',
                        ...this._pendingInit
                    });
                    this._pendingInit = null;
                }
                break;

            case 'set-variable':
                this._handleVariableSet(data.name, data.value);
                break;

            case 'complete':
                this._handleComplete(data.result);
                break;

            case 'error':
                this.log(`Minigame error: ${data.message}`);
                if (this._onError) {
                    this._onError({ code: data.code, message: data.message });
                }
                break;

            case 'progress':
                if (this._onProgress) {
                    this._onProgress(data.data);
                }
                break;

            default:
                this.log(`Unknown message type: ${data.type}`);
        }
    },

    /**
     * Send message to minigame iframe
     */
    _sendMessage(data) {
        if (this.iframe && this.iframe.contentWindow) {
            this.iframe.contentWindow.postMessage(data, '*');
        }
    },

    /**
     * Handle variable set request from minigame
     */
    _handleVariableSet(name, value) {
        // Check if variable is in write allowlist
        const writeVars = this.manifest?.variables?.write || [];
        if (!writeVars.includes(name)) {
            this.log(`Blocked write to undeclared variable: ${name}`);
            return;
        }

        // Update INK story variable
        if (window.FinkInkEngine && FinkInkEngine.story) {
            try {
                FinkInkEngine.story.variablesState[name] = value;
                this.log(`Updated variable ${name} = ${value}`);

                // Update UI if available
                if (window.FinkUI && FinkUI.updateStatsDisplay) {
                    FinkUI.updateStatsDisplay();
                }
            } catch (e) {
                this.log(`Failed to set variable ${name}: ${e.message}`);
            }
        }
    },

    /**
     * Handle minigame completion
     */
    _handleComplete(result) {
        this.log(`Minigame complete: ${JSON.stringify(result)}`);

        // Apply all result variables
        if (result && result.variables) {
            for (const [name, value] of Object.entries(result.variables)) {
                this._handleVariableSet(name, value);
            }
        }

        // Clear timeout
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        // Callback
        if (this._onComplete) {
            this._onComplete(result);
        }

        // Cleanup
        this._cleanup();
    },

    /**
     * Get readable variables for minigame (filtered by manifest)
     */
    _getReadableVariables(overrides = {}) {
        const readVars = this.manifest?.variables?.read || [];
        const variables = { ...overrides };

        if (window.FinkInkEngine && FinkInkEngine.story) {
            for (const name of readVars) {
                if (!(name in variables)) {
                    try {
                        variables[name] = FinkInkEngine.story.variablesState[name];
                    } catch (e) {
                        // Variable may not exist
                    }
                }
            }
        }

        return variables;
    },

    /**
     * Pause the minigame
     */
    pause() {
        if (this.active) {
            this._sendMessage({ type: 'pause' });
            this.log('Paused minigame');
        }
    },

    /**
     * Resume the minigame
     */
    resume() {
        if (this.active) {
            this._sendMessage({ type: 'resume' });
            this.log('Resumed minigame');
        }
    },

    /**
     * Terminate the minigame (force end)
     */
    terminate(reason = 'USER_CANCELLED') {
        if (!this.active) return;

        this.log(`Terminating minigame: ${reason}`);
        this._sendMessage({ type: 'terminate', reason });

        // Force cleanup after short delay
        setTimeout(() => this._cleanup(), 100);

        if (this._onError && reason !== 'USER_CANCELLED') {
            this._onError({ code: reason, message: `Minigame terminated: ${reason}` });
        }
    },

    /**
     * Cleanup after minigame ends
     */
    _cleanup() {
        // Remove message handler
        if (this.messageHandler) {
            window.removeEventListener('message', this.messageHandler);
            this.messageHandler = null;
        }

        // Clear timeout
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        // Hide/remove iframe container
        const container = document.getElementById('minigame-iframe-container');
        if (container) {
            container.style.display = 'none';
            container.innerHTML = '';
        }

        // Reset state
        this.active = false;
        this.currentMinigame = null;
        this.manifest = null;
        this.iframe = null;
        this._onComplete = null;
        this._onError = null;
        this._onProgress = null;
        this._pendingInit = null;

        // Switch back to narrative view
        this._switchToNarrativeView();

        this.log('Minigame cleanup complete');
    },

    /**
     * Switch UI to minigame view
     */
    _switchToMinigameView() {
        // Hide narrative view
        const narrativeView = document.getElementById('narrative-view');
        if (narrativeView) narrativeView.classList.remove('active');

        // Show minigame view (iframe container handles display)
        const minigameView = document.getElementById('minigame-view');
        if (minigameView) minigameView.classList.add('active');
    },

    /**
     * Switch UI to narrative view
     */
    _switchToNarrativeView() {
        const narrativeView = document.getElementById('narrative-view');
        if (narrativeView) narrativeView.classList.add('active');

        const minigameView = document.getElementById('minigame-view');
        if (minigameView) minigameView.classList.remove('active');

        // Continue story if available
        if (window.FinkInkEngine && FinkInkEngine.continueStory) {
            setTimeout(() => FinkInkEngine.continueStory(), 100);
        }
    },

    /**
     * Check if a minigame is currently active
     */
    isActive() {
        return this.active;
    },

    /**
     * Get current minigame name
     */
    getCurrent() {
        return this.currentMinigame;
    },

    /**
     * List available minigames
     */
    async listAvailable() {
        // In a real implementation, this would scan the minigames directory
        // For now, return hardcoded list
        return ['gems', 'chess', 'slovib'];
    },

    log(msg) {
        const fullMsg = `[MinigameHost] ${msg}`;
        if (window.FinkDevPanel) {
            window.FinkDevPanel.log(fullMsg, 'game');
        }
        console.log(fullMsg);
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[MinigameHost] Ready');
    });
} else {
    console.log('[MinigameHost] Ready');
}
