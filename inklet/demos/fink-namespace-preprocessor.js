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
 * 1. Derives namespace from filename: "dragon-story.fink.js" → "dragon_story_"
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
 * @version STRAWMAN-0.1
 */

const FinkNamespacePreprocessor = (function() {
    'use strict';

    /**
     * Derive namespace from FINK filename or URL
     * "dragon-story.fink.js" → "dragon_story"
     * "../chapters/ch2-castle.fink.js" → "ch2_castle"
     */
    function deriveNamespace(filenameOrUrl) {
        // Extract filename from path/URL
        const filename = filenameOrUrl.split('/').pop();

        // Remove .fink.js or .js extension
        const base = filename.replace(/\.fink\.js$|\.js$/, '');

        // Convert to valid identifier: kebab-case → snake_case, remove invalid chars
        const namespace = base
            .replace(/-/g, '_')
            .replace(/[^a-zA-Z0-9_]/g, '')
            .toLowerCase();

        return namespace;
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
        createExportMappings,
        injectImports,
        VERSION: 'STRAWMAN-0.1'
    };

})();

// Export for ES modules if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FinkNamespacePreprocessor;
}
