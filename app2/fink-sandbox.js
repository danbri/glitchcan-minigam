// FINK Sandbox Loader - Handles loading .fink.js files via secure iframe
window.FinkSandbox = {
    activeSandbox: null,
    sandboxTimeout: null,
    
    // Load FINK file via sandbox iframe
    loadViaSandbox(url) {
        FinkUtils.debugLog('loadViaSandbox called for: ' + url);
        return new Promise((resolve, reject) => {
            this.cleanupSandbox();
            
            const iframe = document.createElement('iframe');
            // Safari requires allow-same-origin to load external scripts
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
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
                        FinkUtils.debugLog('Sandbox ready, sending load command');
                        this.startSandboxTimeout(reject);
                        iframe.contentWindow.postMessage({ type: 'load-script', url: url }, '*');
                        break;
                        
                    case 'fink-loaded':
                        FinkUtils.debugLog('FINK loaded - data blocks: ' + (data.data ? data.data.length : 0));
                        clearTimeout(this.sandboxTimeout);
                        if (data.data && data.data.length > 0) {
                            // Remove duplicates and join
                            const uniqueData = [...new Set(data.data)];
                            const finkContent = uniqueData.join('\\n');
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
            
            const sandboxHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>FINK Sandbox</title></head>
<body>
<script>
window.finkData = [];

function oooOO(strings) {
    try {
        const content = (typeof strings === 'object' && strings && strings.raw && Array.isArray(strings.raw))
            ? strings.raw.join('')
            : String(strings);
        window.finkData.push(content);
        return content;
    } catch (e) {
        return '';
    }
}

setTimeout(function() {
    console.log('Sandbox iframe ready, sending message to parent');
    parent.postMessage({ type: 'sandbox-ready' }, '*');
}, 100);

window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'load-script') {
        console.log('Loading script:', event.data.url);
        const scriptUrl = event.data.url;
        const script = document.createElement('script');
        
        script.onload = function() {
            console.log('Script loaded, finkData length:', window.finkData.length);
            const dataStrings = window.finkData.map(function(item) {
                return typeof item === 'string' ? item : String(item);
            }).filter(function(item) {
                return item && item.trim().length > 0;
            });
            parent.postMessage({ type: 'fink-loaded', data: dataStrings, url: scriptUrl }, '*');
        };
        
        script.onerror = function() {
            parent.postMessage({ type: 'fink-error', error: 'Failed to load script', url: scriptUrl }, '*');
        };
        
        script.src = scriptUrl;
        document.body.appendChild(script);
    }
});
</script>
</body>
</html>`;
            
            // Use srcdoc instead of data URL (following hamfinkdemo pattern)
            FinkUtils.debugLog('Creating sandbox iframe with srcdoc');
            
            // Add message listener BEFORE setting srcdoc
            window.addEventListener('message', messageHandler);
            
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