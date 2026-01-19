/**
 * FINK Namespace Preprocessor - STRAWMAN IMPLEMENTATION
 * ======================================================
 *
 * STATUS: Experimental - will be revisited
 *
 * PURPOSE:
 * Auto-namespace variables so writers don't need globally unique names.
 * Writers just write normal Ink; the preprocessor handles collisions.
 *
 * NAMESPACE DERIVATION:
 * Uses SHA-256 hash of context URL for deterministic, collision-resistant prefixes.
 * Example: "https://example.com/stories/dragon.fink.js" → "f7a3b2c1_"
 *
 * WRITER EXPERIENCE:
 * ```ink
 * # IMPORT: player_gold           // "I need this from the world"
 * # EXPORT: dragon_slain          // "I contribute this to the world"
 *
 * VAR scales = 0                  // Just a normal variable
 * {scales > 5: You have scales!}  // Just normal Ink
 * ```
 *
 * WHAT THE PREPROCESSOR DOES:
 * 1. Derives namespace from SHA-256(url) → 8-char hex prefix
 * 2. Prefixes all VAR declarations (except IMPORTs)
 * 3. Transforms all variable references to match
 * 4. EXPORT vars get canonical aliases
 *
 * FUTURE: PUSH/POP CONTEXT MODEL
 * For nested contexts (plays within dreams within worlds):
 * - PUSH: Enter nested FINK, stack current context
 * - POP: Return to parent context
 * - INJECT: Pass vars down to child context
 * - YOINK: Pull vars up from child context
 *
 * This enables: story → minigame → dream sequence → back to story
 * Each level maintains its own namespace, explicit bridges only.
 *
 * @module fink-namespace-preprocessor
 * @version STRAWMAN-0.2
 */

const FinkNamespacePreprocessor = (function() {
    'use strict';

    /**
     * Compute SHA-256 hash of a string (async, uses SubtleCrypto)
     * @param {string} str - Input string
     * @returns {Promise<string>} - Hex-encoded hash
     */
    async function sha256(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Synchronous fallback hash (djb2 variant) for environments without SubtleCrypto
     * @param {string} str - Input string
     * @returns {string} - 8-char hex hash
     */
    function syncHash(str) {
        let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
        for (let i = 0; i < str.length; i++) {
            const ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
        h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
        h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        const hash = (h2 >>> 0).toString(16).padStart(8, '0') +
                     (h1 >>> 0).toString(16).padStart(8, '0');
        return hash;
    }

    /**
     * Derive namespace from SHA-256 of context URL
     * @param {string} url - Full URL of FINK file
     * @param {boolean} async - Use async SHA-256 (default: false for sync fallback)
     * @returns {string|Promise<string>} - 8-char namespace prefix
     */
    function deriveNamespace(url, useAsync = false) {
        if (useAsync && typeof crypto !== 'undefined' && crypto.subtle) {
            return sha256(url).then(hash => hash.slice(0, 8));
        }
        // Synchronous fallback
        return syncHash(url).slice(0, 8);
    }

    /**
     * Async version of deriveNamespace
     */
    async function deriveNamespaceAsync(url) {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const hash = await sha256(url);
            return hash.slice(0, 8);
        }
        return syncHash(url).slice(0, 8);
    }

    /**
     * Parse IMPORT/EXPORT/NAMESPACE tags from FINK content
     */
    function parseTags(content) {
        const tags = {
            namespace: null,
            imports: [],
            exports: []
        };

        // # NAMESPACE: custom_ns
        const nsMatch = content.match(/^#\s*NAMESPACE:\s*(\w+)/m);
        if (nsMatch) {
            tags.namespace = nsMatch[1];
        }

        // # IMPORT: var1, var2, var3
        const importMatch = content.match(/^#\s*IMPORT:\s*(.+)$/m);
        if (importMatch) {
            tags.imports = importMatch[1].split(',').map(v => v.trim()).filter(Boolean);
        }

        // # EXPORT: var1, var2
        const exportMatch = content.match(/^#\s*EXPORT:\s*(.+)$/m);
        if (exportMatch) {
            tags.exports = exportMatch[1].split(',').map(v => v.trim()).filter(Boolean);
        }

        return tags;
    }

    /**
     * Find all VAR declarations in content
     * Returns array of { name, fullMatch, index }
     */
    function findVarDeclarations(content) {
        const vars = [];
        const regex = /^(\s*VAR\s+)(\w+)(\s*=)/gm;
        let match;

        while ((match = regex.exec(content)) !== null) {
            vars.push({
                name: match[2],
                fullMatch: match[0],
                prefix: match[1],
                suffix: match[3],
                index: match.index
            });
        }

        return vars;
    }

    /**
     * Find all variable references in content (excluding declarations)
     * Looks for: {var}, {var > 0:, ~ var =, etc.
     */
    function findVarReferences(content, varNames) {
        const refs = [];

        for (const varName of varNames) {
            // Match variable references in various Ink contexts:
            // {varname} - inline display
            // {varname > - conditions
            // {varname < - conditions
            // {varname == - conditions
            // {varname != - conditions
            // {varname: - truthiness check
            // ~ varname = - assignment
            // ~ varname += - compound assignment
            // -> knot(varname) - parameters (simplified)

            const patterns = [
                // {varname} or {varname: or {varname > etc (but not VAR varname)
                new RegExp(`(\\{\\s*)(${varName})(\\s*[}:><=!])`, 'g'),
                // ~ varname = or ~ varname +=
                new RegExp(`(~\\s*)(${varName})(\\s*[+\\-*\\/]?=)`, 'g'),
                // {expression with varname}
                new RegExp(`(\\{[^}]*\\b)(${varName})(\\b[^}]*\\})`, 'g'),
            ];

            for (const pattern of patterns) {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    refs.push({
                        name: varName,
                        fullMatch: match[0],
                        index: match.index
                    });
                }
            }
        }

        return refs;
    }

    /**
     * Transform FINK content with namespace prefixing
     *
     * @param {string} content - Raw FINK/Ink content
     * @param {string} filenameOrUrl - Source filename for namespace derivation
     * @param {object} options - { debug: boolean }
     * @returns {object} { content, namespace, imports, exports, transformedVars }
     */
    function transform(content, filenameOrUrl, options = {}) {
        const debug = options.debug || false;
        const log = debug ? console.log.bind(console, '[NS]') : () => {};

        // Parse tags
        const tags = parseTags(content);

        // Determine namespace
        const namespace = tags.namespace || deriveNamespace(filenameOrUrl);
        const prefix = namespace + '_';

        log(`Namespace: ${namespace}`);
        log(`Imports: ${tags.imports.join(', ') || '(none)'}`);
        log(`Exports: ${tags.exports.join(', ') || '(none)'}`);

        // Find all VAR declarations
        const declarations = findVarDeclarations(content);
        log(`Found ${declarations.length} VAR declarations`);

        // Determine which vars to prefix (all except imports)
        const varsToPrefix = declarations
            .map(d => d.name)
            .filter(name => !tags.imports.includes(name));

        log(`Vars to prefix: ${varsToPrefix.join(', ') || '(none)'}`);

        // Transform content
        let transformed = content;
        const transformedVars = {};

        // Replace VAR declarations (in reverse order to preserve indices)
        const sortedDecls = [...declarations].sort((a, b) => b.index - a.index);
        for (const decl of sortedDecls) {
            if (varsToPrefix.includes(decl.name)) {
                const newName = prefix + decl.name;
                const replacement = decl.prefix + newName + decl.suffix;
                transformed =
                    transformed.slice(0, decl.index) +
                    replacement +
                    transformed.slice(decl.index + decl.fullMatch.length);
                transformedVars[decl.name] = newName;
                log(`  VAR ${decl.name} → ${newName}`);
            }
        }

        // Replace variable references
        for (const varName of varsToPrefix) {
            const newName = prefix + varName;
            // Word boundary replacement for the variable name
            // Be careful not to replace inside strings or comments
            const refPattern = new RegExp(`\\b${varName}\\b`, 'g');

            // Count replacements for logging
            const beforeLen = transformed.length;
            transformed = transformed.replace(refPattern, (match, offset) => {
                // Skip if this is inside a VAR declaration (already handled)
                const before = transformed.slice(Math.max(0, offset - 10), offset);
                if (/VAR\s*$/.test(before)) {
                    return match;
                }
                return newName;
            });

            if (debug && transformed.length !== beforeLen) {
                log(`  refs ${varName} → ${newName}`);
            }
        }

        // Add comment documenting the transformation
        const header = `// [FINK-NS] Namespace: ${namespace}, Imports: [${tags.imports.join(', ')}], Exports: [${tags.exports.join(', ')}]\n`;
        transformed = header + transformed;

        return {
            content: transformed,
            namespace,
            imports: tags.imports,
            exports: tags.exports,
            transformedVars,
            prefix
        };
    }

    /**
     * Create export mappings for exposing prefixed vars with canonical names
     * Used after story compilation to allow other chapters to access exports
     */
    function createExportMappings(story, exports, prefix) {
        const mappings = {};
        for (const exportName of exports) {
            const prefixedName = prefix + exportName;
            if (story.variablesState[prefixedName] !== undefined) {
                mappings[exportName] = prefixedName;
            }
        }
        return mappings;
    }

    /**
     * Inject imported values into compiled story
     */
    function injectImports(story, imports, sourceState) {
        for (const importName of imports) {
            if (sourceState[importName] !== undefined) {
                story.variablesState[importName] = sourceState[importName];
            }
        }
    }

    // Public API
    return {
        transform,
        parseTags,
        deriveNamespace,
        deriveNamespaceAsync,
        sha256,
        syncHash,
        createExportMappings,
        injectImports,
        VERSION: 'STRAWMAN-0.2'
    };

})();

// Export for ES modules if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FinkNamespacePreprocessor;
}
