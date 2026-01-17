// FINK DevPanel - Developer tools and debugging panel

window.FinkDevPanel = {
    // State
    visible: false,
    activeTab: 'logs',
    logFilters: {
        error: true, warn: true, info: true,
        fink: true, ink: true, game: true, net: true, debug: false
    },
    logs: [],
    swimlanes: { ink: [], fink: [], game: [], net: [] },

    // DOM elements
    elements: {},

    // Initialize the dev panel
    init() {
        this.elements = {
            panel: document.getElementById('dev-panel'),
            tabs: document.getElementById('dev-tabs'),
            logsContent: document.getElementById('logs-content'),
            logOutput: document.getElementById('log-output'),
            logFilters: document.getElementById('log-filters'),
            swimlanesContent: document.getElementById('swimlanes-content'),
            stateContent: document.getElementById('state-content'),
            stateDisplay: document.getElementById('state-display'),
            finksContent: document.getElementById('finks-content'),
            audioContent: document.getElementById('audio-content'),
            copyLogsBtn: document.getElementById('copyLogsBtn'),
            closeBtn: document.getElementById('closeDevPanel'),
            stopSynthBtn: document.getElementById('stopSynthBtn'),
            // Swimlane bodies
            swimInk: document.getElementById('swim-ink'),
            swimFink: document.getElementById('swim-fink'),
            swimGame: document.getElementById('swim-game'),
            swimNet: document.getElementById('swim-net')
        };

        this.setupEventListeners();
        this.log('DevPanel initialized', 'debug');
    },

    setupEventListeners() {
        // Settings button toggle
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.toggle());
        }

        // Close button
        if (this.elements.closeBtn) {
            this.elements.closeBtn.addEventListener('click', () => this.hide());
        }

        // Tab switching
        if (this.elements.tabs) {
            this.elements.tabs.querySelectorAll('button[data-tab]').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.switchTab(btn.dataset.tab);
                });
            });
        }

        // Copy logs button
        if (this.elements.copyLogsBtn) {
            this.elements.copyLogsBtn.addEventListener('click', () => this.copyLogs());
        }

        // Log filter checkboxes
        if (this.elements.logFilters) {
            this.elements.logFilters.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    const filterType = checkbox.dataset.filter;
                    this.logFilters[filterType] = checkbox.checked;
                    this.updateLogVisibility(filterType);
                });
            });
        }

        // Stop synth button
        if (this.elements.stopSynthBtn) {
            this.elements.stopSynthBtn.addEventListener('click', () => {
                if (window.FinkFoley) FinkFoley.stop();
            });
        }

        // Synth buttons
        document.querySelectorAll('.synth-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const sound = btn.dataset.sound;
                if (window.FinkFoley && FinkFoley[sound]) {
                    FinkFoley[sound]();
                }
            });
        });

        // FINK quick-load links
        document.querySelectorAll('#local-finks a[data-fink]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const finkPath = link.dataset.fink;
                this.log(`Quick-loading FINK: ${finkPath}`, 'fink');
                if (window.FinkPlayer) {
                    FinkPlayer.loadFinkStory(finkPath);
                }
                this.hide();
            });
        });

        // External FINK loader
        const externalBtn = document.getElementById('load-external-fink');
        const externalInput = document.getElementById('external-fink-url');
        if (externalBtn && externalInput) {
            externalBtn.addEventListener('click', () => {
                const url = externalInput.value.trim();
                if (url && window.FinkPlayer) {
                    this.log(`Loading external FINK: ${url}`, 'net');
                    FinkPlayer.loadFinkStory(url);
                    this.hide();
                }
            });
        }
    },

    // Toggle visibility
    toggle() {
        this.visible ? this.hide() : this.show();
    },

    show() {
        this.visible = true;
        if (this.elements.panel) {
            this.elements.panel.classList.add('visible');
        }
        this.updateStateDisplay();
    },

    hide() {
        this.visible = false;
        if (this.elements.panel) {
            this.elements.panel.classList.remove('visible');
        }
    },

    // Tab switching
    switchTab(tabName) {
        this.activeTab = tabName;

        // Update tab buttons
        if (this.elements.tabs) {
            this.elements.tabs.querySelectorAll('button[data-tab]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tabName);
            });
        }

        // Update tab content
        document.querySelectorAll('.dev-tab-content').forEach(content => {
            const contentId = content.id.replace('-content', '');
            content.classList.toggle('active', contentId === tabName);
        });

        // Special updates for specific tabs
        if (tabName === 'state') {
            this.updateStateDisplay();
        }
    },

    // Logging
    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = { timestamp, message, type };
        this.logs.push(logEntry);

        // Add to DOM
        if (this.elements.logOutput) {
            const div = document.createElement('div');
            div.className = `log-${type}`;
            div.dataset.logType = type;
            div.textContent = `[${timestamp}] ${message}`;
            div.style.display = this.logFilters[type] ? 'block' : 'none';
            this.elements.logOutput.appendChild(div);

            // Auto-scroll
            this.elements.logOutput.scrollTop = this.elements.logOutput.scrollHeight;
        }

        // Also log to console
        const consoleFn = type === 'error' ? console.error : type === 'warn' ? console.warn : console.log;
        consoleFn(`[FINK:${type}] ${message}`);
    },

    updateLogVisibility(type) {
        if (!this.elements.logOutput) return;
        this.elements.logOutput.querySelectorAll(`div[data-log-type="${type}"]`).forEach(entry => {
            entry.style.display = this.logFilters[type] ? 'block' : 'none';
        });
    },

    copyLogs() {
        const logText = this.logs
            .filter(log => this.logFilters[log.type])
            .map(log => `[${log.timestamp}] [${log.type}] ${log.message}`)
            .join('\n');

        navigator.clipboard.writeText(logText).then(() => {
            if (this.elements.copyLogsBtn) {
                const original = this.elements.copyLogsBtn.textContent;
                this.elements.copyLogsBtn.textContent = '✓ Copied!';
                setTimeout(() => {
                    this.elements.copyLogsBtn.textContent = original;
                }, 1500);
            }
        }).catch(err => {
            this.log(`Failed to copy: ${err}`, 'error');
        });
    },

    // Swimlane events
    swimEvent(lane, icon, title, detail, highlight = false) {
        const timestamp = new Date().toLocaleTimeString();
        const event = { timestamp, icon, title, detail, highlight };

        if (this.swimlanes[lane]) {
            this.swimlanes[lane].push(event);
        }

        // Add to DOM
        const laneBody = this.elements[`swim${lane.charAt(0).toUpperCase() + lane.slice(1)}`];
        if (laneBody) {
            const div = document.createElement('div');
            div.className = `swimlane-event${highlight ? ' highlight' : ''}`;
            div.innerHTML = `<span>${icon}</span> <strong>${title}</strong><br><small>${detail}</small>`;
            laneBody.appendChild(div);
            laneBody.scrollTop = laneBody.scrollHeight;
        }
    },

    // State display
    updateStateDisplay() {
        if (!this.elements.stateDisplay) return;

        const state = {
            // Navigation
            currentFinkUrl: window.FinkPlayer?.currentStoryUrl,
            navigationAPI: window.FinkNavigation?.usingNavigationAPI,

            // Story state
            storyLoaded: !!(window.FinkInkEngine?.story),
            currentKnot: this.getCurrentKnot(),

            // Minigame state
            minigameActive: window.FinkMinigames?.active,
            minigameType: window.FinkMinigames?.currentType,

            // Audio
            foleyLayers: Object.keys(window.FinkFoley?.layers || {}),

            // Variables (if story loaded)
            variables: this.getStoryVariables()
        };

        this.elements.stateDisplay.textContent = JSON.stringify(state, null, 2);
    },

    getCurrentKnot() {
        try {
            if (window.FinkInkEngine?.story) {
                return FinkInkEngine.story.state.currentPathString;
            }
        } catch (e) {}
        return null;
    },

    getStoryVariables() {
        try {
            if (window.FinkInkEngine?.story?.variablesState) {
                const vars = {};
                const knownVars = ['diamonds', 'mega_diamonds', 'keys', 'score', 'minigame_played'];
                knownVars.forEach(name => {
                    const val = FinkInkEngine.story.variablesState[name];
                    if (val !== undefined) vars[name] = val;
                });
                return vars;
            }
        } catch (e) {}
        return {};
    },

    // Clear logs
    clearLogs() {
        this.logs = [];
        if (this.elements.logOutput) {
            this.elements.logOutput.innerHTML = '';
        }
        this.log('Logs cleared', 'info');
    },

    // Clear swimlanes
    clearSwimlanes() {
        Object.keys(this.swimlanes).forEach(lane => {
            this.swimlanes[lane] = [];
        });
        ['swimInk', 'swimFink', 'swimGame', 'swimNet'].forEach(id => {
            if (this.elements[id]) this.elements[id].innerHTML = '';
        });
    }
};

// Global convenience function
window.log = (msg, type = 'info') => FinkDevPanel.log(msg, type);
window.swimEvent = (lane, icon, title, detail, highlight) => FinkDevPanel.swimEvent(lane, icon, title, detail, highlight);
