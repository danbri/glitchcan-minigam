/**
 * FinkNet - Secure JSONP-like loader for tagged template literal content
 *
 * Loads JavaScript files that use a tagged template literal pattern:
 *   oooOO`content here`
 *
 * Content is extracted safely via iframe sandbox execution.
 * Similar to JSONP, but uses template literals instead of callbacks.
 *
 * @example
 * // my-content.fink.js
 * oooOO`
 * This is the content that will be extracted.
 * It can contain any text, including special characters.
 * `
 *
 * // loader.js
 * import { FinkNet } from 'finknet';
 * const content = await FinkNet.load('./my-content.fink.js');
 * console.log(content); // "This is the content..."
 */

const FinkNet = {
    /**
     * Default options for loading
     */
    defaults: {
        timeout: 10000,           // Sandbox execution timeout (ms)
        tagFunction: 'oooOO',     // Name of the tagged template literal function
        messagePrefix: 'finknet'  // Prefix for postMessage types
    },

    /**
     * Load content from a .fink.js (or similar) file
     *
     * @param {string} url - URL to the JavaScript file containing tagged template content
     * @param {Object} options - Optional configuration
     * @param {number} options.timeout - Execution timeout in ms (default: 10000)
     * @param {string} options.tagFunction - Name of the capturing function (default: 'oooOO')
     * @returns {Promise<string>} - Extracted content
     */
    async load(url, options = {}) {
        const opts = { ...this.defaults, ...options };

        // Step 1: Fetch the script content
        // Parent has same-origin access; sandbox doesn't need it
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const scriptContent = await response.text();

        // Step 2: Execute in sandbox and extract content
        return new Promise((resolve, reject) => {
            const iframe = document.createElement('iframe');
            // Security: only allow-scripts, no same-origin access
            iframe.setAttribute('sandbox', 'allow-scripts');
            iframe.style.cssText = 'display:none;position:absolute;width:0;height:0;';

            const cleanup = () => {
                clearTimeout(timeoutId);
                window.removeEventListener('message', handler);
                iframe.remove();
            };

            const timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error(`Sandbox timeout after ${opts.timeout}ms`));
            }, opts.timeout);

            const handler = (event) => {
                const data = event.data;
                if (!data || typeof data.type !== 'string') return;
                if (!data.type.startsWith(opts.messagePrefix + '-')) return;

                const msgType = data.type.substring(opts.messagePrefix.length + 1);

                switch (msgType) {
                    case 'ready':
                        // Sandbox is ready, send script for execution
                        iframe.contentWindow.postMessage({
                            type: opts.messagePrefix + '-exec',
                            content: scriptContent
                        }, '*');
                        break;

                    case 'loaded':
                        cleanup();
                        if (data.data && data.data.length > 0) {
                            // Return first block, or all blocks joined with newline
                            resolve(data.data.length === 1 ? data.data[0] : data.data.join('\n'));
                        } else {
                            reject(new Error('No content extracted from script'));
                        }
                        break;

                    case 'error':
                        cleanup();
                        reject(new Error(data.error || 'Unknown sandbox error'));
                        break;
                }
            };

            window.addEventListener('message', handler);

            // Create sandbox HTML with the tag function
            const sandboxHtml = this._createSandboxHtml(opts);
            iframe.srcdoc = sandboxHtml;
            document.body.appendChild(iframe);
        });
    },

    /**
     * Create the sandbox iframe HTML
     * @private
     */
    _createSandboxHtml(opts) {
        const { tagFunction, messagePrefix } = opts;

        return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body>
<script>
// Collected content blocks
window._finkData = [];

// Tagged template literal function - captures content
function ${tagFunction}(strings) {
    var content;
    if (typeof strings === 'object' && strings && strings.raw && Array.isArray(strings.raw)) {
        content = strings.raw.join('');
    } else {
        content = String(strings);
    }
    window._finkData.push(content);
    return content;
}

// Handle execution request from parent
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === '${messagePrefix}-exec') {
        try {
            (new Function(event.data.content))();
            parent.postMessage({
                type: '${messagePrefix}-loaded',
                data: window._finkData
            }, '*');
        } catch (e) {
            parent.postMessage({
                type: '${messagePrefix}-error',
                error: e.message
            }, '*');
        }
    }
});

// Signal ready to parent
parent.postMessage({ type: '${messagePrefix}-ready' }, '*');
<\/script>
</body>
</html>`;
    },

    /**
     * Load multiple files in parallel
     *
     * @param {string[]} urls - Array of URLs to load
     * @param {Object} options - Options passed to each load() call
     * @returns {Promise<string[]>} - Array of extracted contents
     */
    async loadAll(urls, options = {}) {
        return Promise.all(urls.map(url => this.load(url, options)));
    },

    /**
     * Create a content file (helper for authoring)
     * Returns the JavaScript wrapper for content.
     *
     * @param {string} content - The content to wrap
     * @param {string} tagFunction - Function name (default: 'oooOO')
     * @returns {string} - JavaScript file content
     */
    createFile(content, tagFunction = 'oooOO') {
        // Escape backticks and ${} in content
        const escaped = content
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$\{/g, '\\${');
        return `${tagFunction}\`${escaped}\`\n`;
    }
};

// Export for various environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FinkNet };
}
if (typeof window !== 'undefined') {
    window.FinkNet = FinkNet;
}

export { FinkNet };
