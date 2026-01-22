// FINK Sandbox Loader - Handles loading .fink.js files via secure iframe
// Security: Fetches content in parent, sends to sandbox for execution
window.FinkSandbox = {
    activeSandbox: null,
    sandboxTimeout: null,
    initialTimeout: null,  // Track initial setup timeout for proper cleanup
    activeMessageHandler: null,
    loadedCount: 0,  // Track successful FINK loads for stats

    // Duplicate load prevention: track recently loaded URLs with timestamps
    recentLoads: new Map(),
    DUPLICATE_LOAD_WINDOW_MS: 5000,  // 5 second window for duplicate detection

    // Check if URL was loaded recently (within duplicate window)
    checkDuplicateLoad(url) {
        const now = Date.now();
        const lastLoad = this.recentLoads.get(url);

        if (lastLoad) {
            const elapsed = now - lastLoad;
            if (elapsed < this.DUPLICATE_LOAD_WINDOW_MS) {
                const secondsAgo = (elapsed / 1000).toFixed(1);
                const warnMsg = `⚠️ DUPLICATE FINK LOAD DETECTED: "${url}" was loaded ${secondsAgo}s ago (within ${this.DUPLICATE_LOAD_WINDOW_MS/1000}s window)`;

                // Log to finkdev console
                FinkUtils.debugLog(warnMsg);
                // Log to browser console (always visible)
                console.warn('[FinkSandbox]', warnMsg);
                console.warn('[FinkSandbox] This may indicate a bug causing multiple loads. Stack trace:', new Error().stack);

                return { isDuplicate: true, elapsed, lastLoad };
            }
        }

        // Clean up old entries (older than window) to prevent memory leak
        for (const [cachedUrl, timestamp] of this.recentLoads) {
            if (now - timestamp > this.DUPLICATE_LOAD_WINDOW_MS * 2) {
                this.recentLoads.delete(cachedUrl);
            }
        }

        return { isDuplicate: false };
    },

    // Record that a URL was loaded
    recordLoad(url) {
        this.recentLoads.set(url, Date.now());
    },

    // Clear recent load record for a specific URL (allows intentional retry)
    clearLoadRecord(url) {
        if (url) {
            this.recentLoads.delete(url);
            FinkUtils.debugLog('Cleared load record for: ' + url);
        } else {
            this.recentLoads.clear();
            FinkUtils.debugLog('Cleared all load records');
        }
    },

    // Load FINK file via sandbox iframe
    async loadViaSandbox(url) {
        FinkUtils.debugLog('loadViaSandbox called for: ' + url);

        // Check for duplicate load within time window
        const duplicateCheck = this.checkDuplicateLoad(url);
        if (duplicateCheck.isDuplicate) {
            const warnMsg = `Skipping duplicate load of "${url}" - loaded ${(duplicateCheck.elapsed/1000).toFixed(1)}s ago`;
            FinkUtils.debugLog('⏭️ ' + warnMsg);
            console.warn('[FinkSandbox]', warnMsg);
            // Return null to indicate skip (caller should handle gracefully)
            // This is gentler than throwing - allows code flow to continue
            return null;
        }

        // Record this load attempt
        this.recordLoad(url);

        // Step 1: Fetch script content in parent (has same-origin access)
        let scriptContent;
        try {
            FinkUtils.debugLog('Fetching FINK content from: ' + url);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            scriptContent = await response.text();
            FinkUtils.debugLog('Fetched ' + scriptContent.length + ' chars');
        } catch (fetchError) {
            FinkUtils.debugLog('Fetch failed: ' + fetchError.message);
            throw new Error('Failed to fetch FINK file: ' + fetchError.message);
        }

        // Step 2: Send content to sandbox for safe execution
        return new Promise((resolve, reject) => {
            this.cleanupSandbox();

            const iframe = document.createElement('iframe');
            iframe.setAttribute('sandbox', 'allow-scripts');
            iframe.style.display = 'none';

            this.activeSandbox = iframe;

            // Start initial timeout for sandbox setup (in case sandbox-ready never arrives)
            // Store as instance property so cleanupSandbox() can clear stale timeouts
            this.initialTimeout = setTimeout(() => {
                FinkUtils.debugLog('Sandbox setup timeout - sandbox-ready never received');
                this.cleanupSandbox();  // Also removes message handler
                reject(new Error('Sandbox setup timeout - iframe may have failed to initialize'));
            }, 5000);

            const messageHandler = (event) => {
                // Filter out extension messages
                if (event.data && event.data.source === 'react-devtools-content-script') {
                    return;
                }

                // NOTE: Removed strict event.source check - sandboxed iframes have
                // restricted contentWindow comparison. Use type-based filtering instead.
                const data = event.data;
                if (!data || !data.type) {
                    return;
                }

                // Only process our known message types
                if (!['sandbox-ready', 'fink-loaded', 'fink-error'].includes(data.type)) {
                    return;
                }

                switch (data.type) {
                    case 'sandbox-ready':
                        FinkUtils.debugLog('Sandbox ready, sending script content');
                        clearTimeout(this.initialTimeout);  // Clear initial timeout
                        this.initialTimeout = null;
                        this.startSandboxTimeout(reject);
                        iframe.contentWindow.postMessage({ type: 'exec-script', content: scriptContent }, '*');
                        break;

                    case 'fink-loaded':
                        FinkUtils.debugLog('FINK loaded - data blocks: ' + (data.data ? data.data.length : 0));
                        clearTimeout(this.sandboxTimeout);
                        if (data.data && data.data.length > 0) {
                            // Use only the first oooOO block (matches working hamfink2026 behavior)
                            const finkContent = data.data[0];
                            this.loadedCount++;  // Track successful loads
                            FinkUtils.debugLog('FINK story loaded: ' + finkContent.length + ' characters (total: ' + this.loadedCount + ')');
                            resolve(finkContent);
                        } else {
                            reject(new Error('No FINK content found in file'));
                        }
                        this.cleanupSandbox();
                        break;

                    case 'fink-error':
                        clearTimeout(this.sandboxTimeout);
                        const errorMsg = data.error || 'Unknown error in sandbox';
                        FinkUtils.debugLog('Sandbox error: ' + errorMsg);
                        this.cleanupSandbox();
                        reject(new Error(errorMsg));
                        break;
                }
            };

            // Store handler reference for cleanup
            this.activeMessageHandler = messageHandler;
            window.addEventListener('message', messageHandler);

            // Sandbox HTML with oooOO template literal handler
            const sandboxHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>FINK Sandbox</title></head>
<body>
<script>
window.finkData = [];

function oooOO(strings) {
    const content = (typeof strings === 'object' && strings.raw)
        ? strings.raw.join('')
        : String(strings);
    window.finkData.push(content);
    return content;
}

// Set up message listener FIRST (before posting sandbox-ready)
window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'exec-script') {
        try {
            (new Function(e.data.content))();
            parent.postMessage({ type: 'fink-loaded', data: window.finkData }, '*');
        } catch (err) {
            parent.postMessage({ type: 'fink-error', error: 'Execution error: ' + err.message }, '*');
        }
    }
});

// Post sandbox-ready AFTER listener is set up (matches working hamfink2026)
parent.postMessage({ type: 'sandbox-ready' }, '*');
</script>
</body>
</html>`;

            try {
                iframe.srcdoc = sandboxHtml;
                document.body.appendChild(iframe);
            } catch (error) {
                FinkUtils.debugLog('Error setting up sandbox: ' + error.message);
                reject(new Error('Failed to setup sandbox: ' + error.message));
            }
        });
    },

    startSandboxTimeout(rejectFn) {
        if (this.sandboxTimeout) clearTimeout(this.sandboxTimeout);
        this.sandboxTimeout = setTimeout(() => {
            FinkUtils.debugLog('Sandbox timeout');
            if (window.FinkUI) FinkUI.showStatus('Error: Timeout loading story');
            this.cleanupSandbox();
            rejectFn(new Error('Sandbox timeout'));
        }, FinkConfig.SANDBOX_TIMEOUT_MS);
    },

    cleanupSandbox() {
        // Clear initial setup timeout (prevents stale timeouts from previous loads)
        if (this.initialTimeout) {
            clearTimeout(this.initialTimeout);
            this.initialTimeout = null;
        }
        if (this.sandboxTimeout) {
            clearTimeout(this.sandboxTimeout);
            this.sandboxTimeout = null;
        }
        if (this.activeMessageHandler) {
            window.removeEventListener('message', this.activeMessageHandler);
            this.activeMessageHandler = null;
        }
        if (this.activeSandbox) {
            this.activeSandbox.remove();
            this.activeSandbox = null;
        }
    }
};
