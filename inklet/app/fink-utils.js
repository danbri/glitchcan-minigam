// FINK Utilities - Common helper functions
window.FinkUtils = {
    debugMessages: [],
    debugConsole: null,
    
    // Debug logging
    debugLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        this.debugMessages.push(logEntry);
        
        if (this.debugMessages.length > FinkConfig.MAX_DEBUG_MESSAGES) {
            this.debugMessages = this.debugMessages.slice(-FinkConfig.KEEP_DEBUG_MESSAGES);
        }
        
        if (this.debugConsole && this.debugConsole.classList.contains('active')) {
            this.updateDebugDisplay();
        }
        
        console.log(logEntry);
    },
    
    updateDebugDisplay() {
        if (this.debugConsole) {
            this.debugConsole.innerHTML = this.debugMessages.join('<br>');
            this.debugConsole.scrollTop = this.debugConsole.scrollHeight;
        }
    },
    
    toggleDebugConsole() {
        if (!this.debugConsole) {
            this.debugConsole = document.getElementById('debug-console');
        }
        
        if (this.debugConsole) {
            this.debugConsole.classList.toggle('active');
            if (this.debugConsole.classList.contains('active')) {
                this.updateDebugDisplay();
            }
        }
    },
    
    // HTML escaping
    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return "";
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                     .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    },
    
    // URL helpers
    resolveLayeredMediaUrl(basePath, relativePath, globalMediaBase) {
        try {
            FinkUtils.debugLog(`resolveLayeredMediaUrl: basePath="${basePath}", relativePath="${relativePath}", globalMediaBase="${globalMediaBase}"`);
            
            // If relativePath is absolute URL, return as-is
            if (this.isAbsoluteUrl(relativePath)) {
                FinkUtils.debugLog(`relativePath is absolute: ${relativePath}`);
                return relativePath;
            }
            
            // Layer 1: Global media base (if configured and valid)
            if (globalMediaBase && globalMediaBase.trim()) {
                try {
                    let resolvedGlobalBase;
                    if (this.isAbsoluteUrl(globalMediaBase)) {
                        resolvedGlobalBase = globalMediaBase;
                    } else {
                        // Resolve relative to current page
                        resolvedGlobalBase = new URL(globalMediaBase, window.location.href).href;
                    }
                    
                    // Ensure trailing slash
                    if (!resolvedGlobalBase.endsWith('/')) {
                        resolvedGlobalBase += '/';
                    }
                    
                    const result = new URL(relativePath, resolvedGlobalBase).href;
                    FinkUtils.debugLog(`Using global media base: ${result}`);
                    return result;
                } catch (e) {
                    FinkUtils.debugLog(`Global media base failed: ${e.message}, falling back`);
                }
            }
            
            // Layer 2: Story BASEHREF (relative to current story location or global base)
            if (basePath && basePath.trim()) {
                try {
                    // If we have a current story URL, resolve relative to it
                    if (window.currentStoryUrl) {
                        const storyDir = window.currentStoryUrl.substring(0, window.currentStoryUrl.lastIndexOf('/') + 1);
                        
                        let resolvedBasePath;
                        if (this.isAbsoluteUrl(basePath)) {
                            resolvedBasePath = basePath;
                        } else {
                            // Ensure basePath ends with / for proper URL resolution
                            const normalizedBasePath = basePath.endsWith('/') ? basePath : basePath + '/';
                            resolvedBasePath = new URL(normalizedBasePath, storyDir).href;
                        }
                        
                        const result = new URL(relativePath, resolvedBasePath).href;
                        FinkUtils.debugLog(`Using story BASEHREF: ${result}`);
                        return result;
                    }
                } catch (e) {
                    FinkUtils.debugLog(`Story BASEHREF failed: ${e.message}, falling back`);
                }
            }
            
            // Layer 3: Fallback - resolve relative to FINK file location
            if (window.currentStoryUrl) {
                try {
                    const storyDir = window.currentStoryUrl.substring(0, window.currentStoryUrl.lastIndexOf('/') + 1);
                    const result = new URL(relativePath, storyDir).href;
                    FinkUtils.debugLog(`Using story directory fallback: ${result}`);
                    return result;
                } catch (e) {
                    FinkUtils.debugLog(`Story directory fallback failed: ${e.message}`);
                }
            }
            
            // Final fallback: relative to current page
            const result = new URL(relativePath, window.location.href).href;
            FinkUtils.debugLog(`Using page-relative fallback: ${result}`);
            return result;
            
        } catch (error) {
            FinkUtils.debugLog(`resolveLayeredMediaUrl failed: ${error.message}`);
            // Return original path as last resort
            return relativePath;
        }
    },

    // Minigame processing functionality
    loadMinigameScript(scriptPath) {
        return new Promise((resolve, reject) => {
            FinkUtils.debugLog(`Loading minigame script: ${scriptPath}`);
            
            // Check if script already loaded
            const existingScript = document.querySelector(`script[src*="${scriptPath}"]`);
            if (existingScript) {
                FinkUtils.debugLog(`Minigame script already loaded: ${scriptPath}`);
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = this.resolveLayeredMediaUrl('', scriptPath, FinkConfig.GLOBAL_MEDIA_BASE);
            script.onload = () => {
                FinkUtils.debugLog(`Minigame script loaded successfully: ${scriptPath}`);
                resolve();
            };
            script.onerror = (error) => {
                FinkUtils.debugLog(`Failed to load minigame script: ${scriptPath} - ${error}`);
                reject(new Error(`Failed to load minigame script: ${scriptPath}`));
            };
            
            document.head.appendChild(script);
        });
    },
    
    processMinigameDirective(inkText, minigameType, scriptPath, config) {
        FinkUtils.debugLog(`Processing minigame directive: type=${minigameType}, script=${scriptPath}`);
        
        // Create unique container ID
        const containerId = `minigame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Parse config if provided
        let parsedConfig = {};
        if (config) {
            try {
                parsedConfig = JSON.parse(config);
            } catch (e) {
                FinkUtils.debugLog(`Failed to parse minigame config: ${e.message}`);
            }
        }
        
        // Create minigame placeholder
        const placeholder = `<div id="${containerId}" class="minigame-container" data-type="${minigameType}"></div>`;
        
        // Load script and initialize minigame
        this.loadMinigameScript(scriptPath).then(() => {
            this.initializeMinigame(containerId, minigameType, parsedConfig);
        }).catch(error => {
            FinkUtils.debugLog(`Minigame initialization failed: ${error.message}`);
            document.getElementById(containerId).innerHTML = `<div class="minigame-error">Minigame failed to load: ${minigameType}</div>`;
        });
        
        return placeholder;
    },
    
    initializeMinigame(containerId, type, config) {
        FinkUtils.debugLog(`Initializing minigame: ${type} in container ${containerId}`);
        
        switch (type) {
            case 'chess':
                if (window.MamikonMiniChess) {
                    // Add story completion callback
                    const gameConfig = {
                        ...config,
                        onGameEnd: (performance, queenSacrifice, moveHistory) => {
                            FinkUtils.debugLog(`Chess game completed: ${performance}`);
                            
                            // Update story variables
                            let chess_skill = 0;
                            if (performance === 'Brilliant') chess_skill = 85;
                            else if (performance === 'Good') chess_skill = 65; 
                            else if (performance === 'Decent') chess_skill = 45;
                            else chess_skill = 25;
                            
                            // Set variables in INK story if available
                            if (window.currentStory) {
                                try {
                                    window.currentStory.variablesState.$('chess_skill', chess_skill);
                                    FinkUtils.debugLog(`Set chess_skill variable to: ${chess_skill}`);
                                } catch (e) {
                                    FinkUtils.debugLog(`Failed to set chess_skill variable: ${e.message}`);
                                }
                            }
                            
                            // Trigger story continuation if callback specified
                            if (config.onComplete) {
                                FinkUtils.debugLog(`Triggering story continuation: ${config.onComplete}`);
                                // Could implement story knot navigation here
                            }
                        }
                    };
                    
                    new MamikonMiniChess(containerId, gameConfig);
                } else {
                    throw new Error('MamikonMiniChess class not available');
                }
                break;
                
            default:
                throw new Error(`Unknown minigame type: ${type}`);
        }
    },
    resolveUrl(url, base = window.location.href) {
        try {
            return new URL(url, base).href;
        } catch (e) {
            this.debugLog('Error resolving URL: ' + url + ' (base: ' + base + ')');
            return url;
        }
    },
    
    // Layered media URL resolution - environment-flexible approach
    resolveLayeredMediaUrl(storyBasehref, imagePath) {
        this.debugLog('=== Layered Media Resolution ===');
        this.debugLog('Story BASEHREF: "' + (storyBasehref || '(none)') + '"');
        this.debugLog('Image path: "' + imagePath + '"');
        
        // Step 1: Determine the effective media base
        const globalMediaBase = FinkPlayer.globalMediaBase; // From config or form
        const currentStoryUrl = FinkPlayer.currentStoryUrl;
        
        let effectiveBase;
        if (globalMediaBase) {
            // Resolve global media base relative to current page if it's relative
            try {
                effectiveBase = new URL(globalMediaBase, window.location.href).href;
                this.debugLog('Resolved global media base: ' + effectiveBase);
            } catch (e) {
                this.debugLog('Error resolving global media base, falling back to story location');
                effectiveBase = currentStoryUrl ? new URL('.', currentStoryUrl).href : window.location.href;
            }
        } else if (currentStoryUrl) {
            effectiveBase = new URL('.', currentStoryUrl).href; // Directory of story file
            this.debugLog('Using story directory as base: ' + effectiveBase);
        } else {
            effectiveBase = window.location.href;
            this.debugLog('Fallback to current page base: ' + effectiveBase);
        }
        
        // Step 2: Handle absolute vs relative BASEHREF
        let storyMediaBase = storyBasehref || 'media/';
        // Ensure trailing slash for directory URLs
        if (!storyMediaBase.endsWith('/')) {
            storyMediaBase += '/';
        }
        this.debugLog('Processing storyMediaBase: "' + storyMediaBase + '"');
        this.debugLog('Is absolute path: ' + (storyMediaBase.startsWith('/') || storyMediaBase.includes('://')));
        
        let mediaBaseUrl;
        try {
            if (storyMediaBase.startsWith('http://') || storyMediaBase.startsWith('https://')) {
                // Full URL - use as-is
                mediaBaseUrl = storyMediaBase;
                this.debugLog('Using full URL as-is: ' + mediaBaseUrl);
            } else if (storyMediaBase.startsWith('/')) {
                // Absolute path - construct with current origin
                mediaBaseUrl = new URL(storyMediaBase, window.location.origin).href;
                this.debugLog('Absolute path resolved: ' + mediaBaseUrl);
            } else {
                // Relative path - resolve against effective base
                mediaBaseUrl = new URL(storyMediaBase, effectiveBase).href;
                this.debugLog('Relative path resolved: ' + mediaBaseUrl);
            }
        } catch (e) {
            this.debugLog('Error resolving media base, using fallback: ' + e.message);
            mediaBaseUrl = effectiveBase + storyMediaBase;
        }
        
        // Step 3: Resolve image path relative to media base
        try {
            const finalUrl = new URL(imagePath, mediaBaseUrl).href;
            this.debugLog('Final image URL: ' + finalUrl);
            this.debugLog('=== End Resolution ===');
            return finalUrl;
        } catch (e) {
            this.debugLog('Error resolving final image URL: ' + e.message);
            return mediaBaseUrl + imagePath; // Simple concatenation fallback
        }
    }
};