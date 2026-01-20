// FINK Sandbox Loader - Handles loading .fink.js files via secure iframe
// Security: Fetches content in parent, sends to sandbox for execution (no allow-same-origin needed)
window.FinkSandbox = {
    activeSandbox: null,
    sandboxTimeout: null,

    // Load FINK file via sandbox iframe
    async loadViaSandbox(url) {
        FinkUtils.debugLog('loadViaSandbox called for: ' + url);

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

            const messageHandler = (event) => {
                // Filter out React DevTools and other extension messages
                if (event.data && event.data.source === 'react-devtools-content-script') {
                    return;
                }

                FinkUtils.debugLog('Sandbox message received: ' + JSON.stringify(event.data));
                if (event.source !== iframe.contentWindow) {
                    FinkUtils.debugLog('Message not from our sandbox iframe');
                    return;
                }

                const data = event.data;
                if (!data || !data.type) {
                    FinkUtils.debugLog('Message missing data or type');
                    return;
                }

                switch (data.type) {
                    case 'sandbox-ready':
                        FinkUtils.debugLog('Sandbox ready, sending script content');
                        this.startSandboxTimeout(reject);
                        // Send content instead of URL
                        iframe.contentWindow.postMessage({ type: 'exec-script', content: scriptContent }, '*');
                        break;

                    case 'fink-loaded':
                        FinkUtils.debugLog('FINK loaded - data blocks: ' + (data.data ? data.data.length : 0));
                        clearTimeout(this.sandboxTimeout);
                        if (data.data && data.data.length > 0) {
                            // Remove duplicates and join with actual newline
                            const uniqueData = [...new Set(data.data)];
                            const finkContent = uniqueData.join('\n');
                            FinkUtils.debugLog('FINK story loaded: ' + finkContent.length + ' characters');
                            FinkUtils.debugLog('Original data blocks: ' + data.data.length + ', unique blocks: ' + uniqueData.length);
                            resolve(finkContent);
                        } else {
                            reject(new Error('No FINK content found in file'));
                        }
                        this.cleanupSandbox();
                        window.removeEventListener('message', messageHandler);
                        break;

                    case 'fink-error':
                        clearTimeout(this.sandboxTimeout);
                        const errorMsg = data.error || 'Unknown error in sandbox';
                        FinkUtils.debugLog('Sandbox error: ' + errorMsg);
                        this.cleanupSandbox();
                        window.removeEventListener('message', messageHandler);
                        reject(new Error(errorMsg));
                        break;
                }
            };

            window.addEventListener('message', messageHandler);

            // Sandbox executes content sent via postMessage (no script.src needed)
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

            FinkUtils.debugLog('Creating sandbox iframe with srcdoc');

            try {
                iframe.srcdoc = sandboxHtml;
                FinkUtils.debugLog('Iframe srcdoc attribute set');

                document.body.appendChild(iframe);
                FinkUtils.debugLog('Sandbox iframe appended to document body');

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
            FinkUI.showStatus('Error: Timeout loading story');
            this.cleanupSandbox();
            rejectFn(new Error('Sandbox timeout'));
        }, FinkConfig.SANDBOX_TIMEOUT_MS);
    },
    
    cleanupSandbox() {
        if (this.sandboxTimeout) {
            clearTimeout(this.sandboxTimeout);
            this.sandboxTimeout = null;
        }
        if (this.activeSandbox) {
            this.activeSandbox.remove();
            this.activeSandbox = null;
        }
    }
};