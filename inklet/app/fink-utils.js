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
    resolveUrl(url, base = window.location.href) {
        try {
            return new URL(url, base).href;
        } catch (e) {
            this.debugLog('Error resolving URL: ' + url + ' (base: ' + base + ')');
            return url;
        }
    }
};