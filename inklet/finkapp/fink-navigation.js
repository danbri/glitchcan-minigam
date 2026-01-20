// FINK Navigation - Cache-Aware Deep Linking System
// Supports Navigation API (2022+) with fallback to hash-based navigation
//
// ===== FINK LINK SPEC =====
// Format: #<urlHash>-<knotHash>
//   - urlHash: 8 hex chars from SHA-256 of FINK file URL
//   - knotHash: 9 hex chars from SHA-256 of knot name (with # prefix)
//   - Total: 18 characters (8 + 1 hyphen + 9)
//
// Hash Generation:
//   - urlHash = SHA256("glitchcan-fink-v2:url:<trimmed_fink_url>").slice(0,8)
//   - knotHash = SHA256("glitchcan-fink-v2:knot:#<trimmed_knot_name>").slice(0,9)
//
// IMPORTANT: All inputs are trimmed of leading/trailing whitespace before hashing!
// This ensures consistent hash generation regardless of input formatting.
//
// Examples:
//   Valid:   #a1b2c3d4-e5f6g7h8i (18 chars, has hyphen)
//   Invalid: #b6104110 (8 chars, no hyphen - legacy or malformed)
// ===========================

window.FinkNavigation = {
    // Configuration
    // SPEC: urlHashLength + 1 (hyphen) + knotHashLength = total link ID length
    config: {
        salt: 'glitchcan-fink-v2',
        urlHashLength: 8,    // First part of link ID
        knotHashLength: 9    // Second part of link ID (after hyphen)
    },

    // State
    initialized: false,
    currentFinkUri: null,
    knotIdMap: new Map(), // knotHash -> knotName (for current FINK)
    usingNavigationAPI: false,
    publicEntryPoints: [], // PUBLIC knots for current FINK

    // Cache structure for cross-FINK navigation
    cache: {
        // URL hash -> full URL
        urlIndex: {},

        // URL hash -> [child URL hashes] (FINK graph edges)
        graph: {},

        // URL hash -> {knotHash -> knotName}
        knotMaps: {}
    },

    // LocalStorage key for persisting cache
    CACHE_STORAGE_KEY: 'fink-nav-cache-v1',

    // Initialize the navigation system
    init() {
        if (this.initialized) return;

        // Load persisted cache from localStorage
        this.loadCacheFromStorage();

        // Check for modern Navigation API support
        this.usingNavigationAPI = 'navigation' in window;

        const initialHash = window.location.hash;
        this.log(`Init: hash="${initialHash}", navAPI=${this.usingNavigationAPI}`);

        // Log initial hash analysis
        if (initialHash && initialHash.length > 1) {
            const fragmentId = initialHash.slice(1);
            const parsed = this.parseFinkLinkId(fragmentId);
            if (parsed) {
                this.swimLog('🚀', 'Deep Link Detected',
                    `Two-part: ${parsed.urlHash}-${parsed.knotHash}`);
            } else if (fragmentId.endsWith('.fink.js')) {
                this.swimLog('🚀', 'Direct FINK Link', fragmentId);
            } else {
                this.swimLog('⚠️', 'Legacy/Unknown Hash',
                    `"${fragmentId}" (${fragmentId.length} chars, no hyphen)`);
            }
        } else {
            this.swimLog('🏠', 'Fresh Start', 'No deep link in URL');
        }

        if (this.usingNavigationAPI) {
            this.log('Using modern Navigation API');
            this.setupNavigationAPI();
        } else {
            this.log('Falling back to hash-based navigation');
            this.setupHashNavigation();
        }

        this.initialized = true;
    },

    // Swimlane logging helper
    swimLog(icon, title, detail, highlight = false) {
        if (window.swimEvent) {
            swimEvent('nav', icon, title, detail, highlight);
        }
    },

    // Setup modern Navigation API
    setupNavigationAPI() {
        navigation.addEventListener('navigate', (event) => {
            // Only handle same-origin navigations
            if (!event.canIntercept || event.hashChange) {
                // Let hash changes through to our handler
                return;
            }

            const url = new URL(event.destination.url);
            const fragmentId = url.hash.slice(1);

            if (fragmentId && this.knotIdMap.has(fragmentId)) {
                event.intercept({
                    handler: async () => {
                        await this.navigateToKnotById(fragmentId);
                    }
                });
            }
        });

        // Also handle hash changes for backwards compatibility
        this.setupHashNavigation();
    },

    // Setup hash-based navigation (fallback)
    setupHashNavigation() {
        window.addEventListener('hashchange', async (event) => {
            const fragmentId = window.location.hash.slice(1);
            if (!fragmentId) return;

            this.log(`Hash changed to: ${fragmentId}`);
            this.swimLog('🔙', 'Hash Change', fragmentId.slice(0, 20) + '...');

            // Check if it's a two-part hash (urlHash-knotHash) - handles cross-FINK navigation
            const parsed = this.parseFinkLinkId(fragmentId);
            if (parsed) {
                this.log(`Two-part hash detected, navigating: ${parsed.urlHash}-${parsed.knotHash}`);
                await this.navigateToTwoPartLink(parsed.urlHash, parsed.knotHash);
                return;
            }

            // Legacy single hash - check current story's knot map
            if (this.knotIdMap.has(fragmentId)) {
                await this.navigateToKnotById(fragmentId);
            }
        });
    },

    // Generate SHA-256 hex hash
    async sha256hex(data) {
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // Generate URL hash (first part of fink link)
    // SPEC: Input URL is trimmed of leading/trailing whitespace before hashing
    async generateUrlHash(finkUrl) {
        const trimmedUrl = (finkUrl || '').trim();
        const data = `${this.config.salt}:url:${trimmedUrl}`;
        const hash = await this.sha256hex(data);
        return hash.slice(0, this.config.urlHashLength);
    },

    // Generate knot hash (second part of fink link)
    // SPEC: Input knot name is trimmed of leading/trailing whitespace before hashing
    // SPEC: Hash input includes # prefix: "salt:knot:#knotName"
    async generateKnotHash(knotName) {
        const trimmedKnot = (knotName || '').trim();
        const data = `${this.config.salt}:knot:#${trimmedKnot}`;
        const hash = await this.sha256hex(data);
        return hash.slice(0, this.config.knotHashLength);
    },

    // Generate full two-part fink link ID
    // SPEC: Format is "urlHash-knotHash" where:
    //   - urlHash: 8 hex chars from SHA-256 of trimmed FINK URL
    //   - knotHash: 9 hex chars from SHA-256 of trimmed knot name (with # prefix)
    //   - Both inputs trimmed of leading/trailing whitespace
    async generateFinkLinkId(finkUrl, knotName) {
        const urlHash = await this.generateUrlHash(finkUrl);
        const knotHash = await this.generateKnotHash(knotName);
        const linkId = `${urlHash}-${knotHash}`;

        // Debug: Log the full link generation
        this.swimLog('🔗', 'Generated Link ID',
            `${urlHash}-${knotHash?.slice(0,5)}... for "${(knotName||'').trim()}"`);

        return linkId;
    },

    // Parse a two-part fink link ID
    // SPEC: Expected format "urlHash-knotHash" (8 chars + hyphen + 9 chars = 18 total)
    // SPEC: Input is trimmed of leading/trailing whitespace before parsing
    parseFinkLinkId(fragmentId) {
        const trimmed = (fragmentId || '').trim();
        if (!trimmed || !trimmed.includes('-')) {
            return null;
        }
        const [urlHash, knotHash] = trimmed.split('-', 2);
        if (!urlHash || !knotHash) return null;

        // Validate expected lengths (warn but don't reject if different)
        if (urlHash.length !== this.config.urlHashLength) {
            this.log(`Warning: urlHash "${urlHash}" is ${urlHash.length} chars, expected ${this.config.urlHashLength}`);
        }
        if (knotHash.length !== this.config.knotHashLength) {
            this.log(`Warning: knotHash "${knotHash}" is ${knotHash.length} chars, expected ${this.config.knotHashLength}`);
        }

        return { urlHash: urlHash.trim(), knotHash: knotHash.trim() };
    },

    // Legacy: Generate old-style single hash (for backwards compat)
    async generateLegacyKnotId(finkUri, knotName) {
        const data = `glitchcan-fink-v1:${finkUri}:${knotName}`;
        const hash = await this.sha256hex(data);
        return hash.slice(0, 8);
    },

    // Check if a knot is public (doesn't start with underscore)
    isPublicKnot(knotName) {
        return !knotName.startsWith('_');
    },

    // Get all public knots from a story
    getPublicKnots(story) {
        if (!story || !story.mainContentContainer || !story.mainContentContainer.namedContent) {
            return [];
        }

        const namedContent = story.mainContentContainer.namedContent;
        let knotNames;

        // inkjs 2.x uses Map for namedContent, older versions use plain object
        if (namedContent instanceof Map) {
            knotNames = Array.from(namedContent.keys());
        } else if (typeof namedContent === 'object') {
            knotNames = Object.keys(namedContent);
        } else {
            return [];
        }

        return knotNames.filter(name => this.isPublicKnot(name));
    },

    // Build the knot ID map for a loaded story and cache it
    async buildKnotIdMap(story, finkUri, finkContent = null) {
        this.currentFinkUri = finkUri;
        this.knotIdMap.clear();
        this.publicEntryPoints = [];

        const urlHash = await this.generateUrlHash(finkUri);

        // Add to URL index cache
        this.cache.urlIndex[urlHash] = finkUri;

        const publicKnots = this.getPublicKnots(story);
        this.log(`Building knot map for ${publicKnots.length} public knots (urlHash: ${urlHash})`);
        this.swimLog('📝', 'Building Knot Map',
            `${finkUri?.split('/').pop()}: ${publicKnots.length} public knots`);

        // Build knotHash -> knotName map
        const knotMap = {};
        for (const knotName of publicKnots) {
            const knotHash = await this.generateKnotHash(knotName);
            this.knotIdMap.set(knotHash, knotName);
            knotMap[knotHash] = knotName;
        }

        // Cache the knot map
        this.cache.knotMaps[urlHash] = knotMap;

        // Log sample mappings for debugging
        const sampleKnots = publicKnots.slice(0, 3);
        for (const knotName of sampleKnots) {
            const knotHash = await this.generateKnotHash(knotName);
            this.swimLog('🔑', `Hash: ${knotHash.slice(0, 6)}...`, `→ ${knotName}`);
        }
        if (publicKnots.length > 3) {
            this.swimLog('📊', 'Total Knots', `${publicKnots.length} mapped`);
        }

        // Extract FINK references for graph edges (if content provided)
        if (finkContent) {
            await this.extractFinkGraphEdges(urlHash, finkContent);
            this.extractPublicEntryPoints(finkContent);
        }

        // Persist cache to localStorage for cross-session deep linking
        this.saveCacheToStorage();

        return this.knotIdMap;
    },

    // Extract FINK: tag references to build graph edges
    async extractFinkGraphEdges(parentUrlHash, finkContent) {
        const finkRefs = [];
        const finkTagRegex = /# FINK:\s*(.+)/g;
        let match;

        while ((match = finkTagRegex.exec(finkContent)) !== null) {
            const finkRef = match[1].trim();
            finkRefs.push(finkRef);
        }

        if (finkRefs.length > 0) {
            this.log(`Found ${finkRefs.length} FINK references in content`);

            const childHashes = [];
            for (const ref of finkRefs) {
                // Resolve relative to current FINK URL
                const resolvedUrl = new URL(ref, this.currentFinkUri).href;
                const childHash = await this.generateUrlHash(resolvedUrl);
                childHashes.push(childHash);

                // Pre-cache the URL mapping
                this.cache.urlIndex[childHash] = resolvedUrl;
            }

            this.cache.graph[parentUrlHash] = childHashes;
        }
    },

    // Extract PUBLIC entry points from FINK content
    extractPublicEntryPoints(finkContent) {
        const publicMatch = finkContent.match(/# PUBLIC:\s*(.+)/);
        if (publicMatch) {
            this.publicEntryPoints = publicMatch[1].trim().split(/\s+/);
            this.log(`Found PUBLIC entry points: ${this.publicEntryPoints.join(', ')}`);
        } else {
            this.publicEntryPoints = [];
        }
    },

    // Check if a knot is a public entry point
    isPublicEntryPoint(knotName) {
        return this.publicEntryPoints.includes(knotName);
    },

    // Navigate to a knot by its fragment ID (supports both legacy and two-part format)
    async navigateToKnotById(fragmentId) {
        // Try parsing as two-part hash first
        const parsed = this.parseFinkLinkId(fragmentId);

        if (parsed) {
            // Two-part hash: #urlHash-knotHash
            return await this.navigateToTwoPartLink(parsed.urlHash, parsed.knotHash);
        }

        // Legacy single hash - check current story's knot map
        const knotName = this.knotIdMap.get(fragmentId);
        if (knotName) {
            this.log(`Legacy navigation to knot: ${knotName}`);
            return await this.navigateToKnotInCurrentStory(knotName);
        }

        this.log(`No knot found for fragment: ${fragmentId}`);
        return false;
    },

    // Navigate using two-part hash (urlHash-knotHash)
    async navigateToTwoPartLink(urlHash, knotHash) {
        this.log(`Resolving two-part link: ${urlHash}-${knotHash}`);
        this.swimLog('🧭', 'Resolving Two-Part', `${urlHash}-${knotHash}`);

        // Step 1: Check if current FINK matches urlHash
        if (this.currentFinkUri) {
            const currentUrlHash = await this.generateUrlHash(this.currentFinkUri);
            this.swimLog('1️⃣', 'Check Current FINK',
                `Current: ${currentUrlHash}, Need: ${urlHash}`);

            if (currentUrlHash === urlHash) {
                const knotName = this.knotIdMap.get(knotHash);
                if (knotName) {
                    this.log(`Found knot in current FINK: ${knotName}`);
                    this.swimLog('✅', 'Knot Found!', `${knotHash} → ${knotName}`);
                    return await this.navigateToKnotInCurrentStory(knotName);
                } else {
                    // urlHash matches but knotHash not found - this is an invalid link
                    // within the current story. Do NOT fall through to re-load the same FINK!
                    this.swimLog('⚠️', 'Knot Hash Unknown',
                        `${knotHash} not in current story's map - cannot navigate`);
                    this.log(`Knot hash ${knotHash} not found in current FINK - ignoring deep link`);
                    return false;
                }
            }
        }

        // Step 2: Check cached URL index
        this.swimLog('2️⃣', 'Check URL Cache',
            `Looking for ${urlHash} in ${Object.keys(this.cache.urlIndex).length} cached URLs`);

        const targetUrl = this.cache.urlIndex[urlHash];
        if (targetUrl) {
            this.log(`Found URL in cache: ${targetUrl}`);
            this.swimLog('✅', 'URL in Cache', targetUrl.split('/').pop());
            return await this.loadAndNavigateToKnot(targetUrl, knotHash);
        }

        // Step 3: Scan known FINK URLs from graph
        this.swimLog('3️⃣', 'Scan FINK Graph',
            `${Object.keys(this.cache.graph).length} graph edges`);

        const foundUrl = await this.scanGraphForUrlHash(urlHash);
        if (foundUrl) {
            this.log(`Found URL via graph scan: ${foundUrl}`);
            this.swimLog('✅', 'Found via Graph', foundUrl.split('/').pop());
            return await this.loadAndNavigateToKnot(foundUrl, knotHash);
        }

        // Step 4: Link not found - show error
        this.swimLog('❌', 'Link Resolution FAILED',
            `No FINK found for urlHash: ${urlHash}`, true);
        this.showLinkNotFoundError(urlHash, knotHash);
        return false;
    },

    // Scan the FINK graph for a URL hash
    async scanGraphForUrlHash(targetUrlHash) {
        // Check all cached URLs
        for (const [hash, url] of Object.entries(this.cache.urlIndex)) {
            if (hash === targetUrlHash) {
                return url;
            }
        }

        // Could extend to fetch and scan child FINKs here
        // For now, just check immediate cache
        return null;
    },

    // Load a FINK file and navigate to a knot within it
    async loadAndNavigateToKnot(finkUrl, knotHash) {
        this.log(`Loading FINK to navigate: ${finkUrl}`);

        if (!window.FinkSandbox || !window.FinkPlayer) {
            this.log('ERROR: FinkSandbox or FinkPlayer not available');
            return false;
        }

        try {
            if (window.FinkUI) {
                FinkUI.showStatus('Loading story...', true);
            }

            // CRITICAL: Temporarily clear the URL hash to prevent navigation loop.
            // We'll restore/update it after the story loads via checkDeepLink's knot navigation.
            // Without this, the newly loaded FINK's checkDeepLink sees the old hash and
            // tries to load yet another FINK, causing an infinite loop.
            const savedHash = window.location.hash;
            if (savedHash) {
                this.log('Temporarily clearing hash to prevent loop');
                history.replaceState(null, '', window.location.pathname + window.location.search);
            }

            // Load the FINK content
            const content = await FinkSandbox.loadViaSandbox(finkUrl);

            // Handle duplicate load skip (loadViaSandbox returns null if skipped)
            if (content === null) {
                this.log(`FINK load skipped (duplicate): ${finkUrl}`);
                FinkUI.hideStatus();
                return false;
            }

            FinkPlayer.currentStoryUrl = finkUrl;

            // Update breadcrumb with new FINK URL (was missing - caused levels to be skipped!)
            if (window.FinkBreadcrumb) {
                FinkBreadcrumb.setFinkUrl(finkUrl);
            }

            // Compile and run - this will:
            // 1. Build the knot map via buildKnotIdMap
            // 2. Check for deep link via checkDeepLink (which reads URL hash)
            // 3. If deep link matches this FINK, navigate to the target knot
            //
            // IMPORTANT: We don't navigate again after this call!
            // checkDeepLink will see the URL hash (same one that caused us to load
            // this FINK) and handle navigation. Navigating again would cause:
            // - UI flicker (clear and redisplay content)
            // - Potential server spam if it somehow triggers reloads
            await FinkInkEngine.compileAndRunStory(content);

            // Navigation was handled by checkDeepLink inside compileAndRunStory
            this.log(`FINK loaded and deep link handled: ${finkUrl}`);
            return true;
        } catch (error) {
            this.log(`Error loading FINK: ${error.message}`);
            if (window.FinkUI) {
                FinkUI.showStatus(`Error: ${error.message}`);
            }
            return false;
        }
    },

    // Navigate to a knot within the current story
    async navigateToKnotInCurrentStory(knotName, isRespawn = false) {
        if (!window.FinkInkEngine || !FinkInkEngine.story) {
            this.log('ERROR: No story instance available');
            return false;
        }

        try {
            // Set fink_respawn variable if this is a cold start to a public knot
            if (isRespawn && this.isPublicEntryPoint(knotName)) {
                try {
                    FinkInkEngine.story.variablesState['fink_respawn'] = true;
                    this.log(`Set fink_respawn=true for public entry: ${knotName}`);
                } catch (e) {
                    // Variable may not exist in story, that's OK
                }
            }

            FinkInkEngine.story.ChoosePathString(knotName);

            if (window.FinkUI) {
                FinkUI.clearStory();
                FinkUI.clearChoices();
            }

            FinkInkEngine.continueStory();
            this.log(`Navigated to knot: ${knotName}`);
            return true;
        } catch (e) {
            this.log(`Navigation error: ${e.message}`);
            return false;
        }
    },

    // Show error when link cannot be resolved - uses inline INK for interactive recovery
    showLinkNotFoundError(urlHash, knotHash) {
        this.log(`Link not found: ${urlHash}-${knotHash}`);

        const cacheStats = this.getCacheStats();
        this.swimLog('🚫', 'DEEP LINK FAILED',
            `URL: ${urlHash}, Knot: ${knotHash}, Cache: ${cacheStats.urlsIndexed} URLs`, true);

        // Build list of known FINKs for the recovery menu
        const knownFinks = Object.entries(this.cache.urlIndex);
        let recentChoices = '';
        if (knownFinks.length > 0) {
            // Show up to 5 recent FINKs as choices
            const recentFinks = knownFinks.slice(-5).reverse();
            recentChoices = recentFinks.map(([hash, url]) => {
                const name = url.split('/').pop().replace('.fink.js', '');
                return `+ [${name}] -> load_recent_${hash}`;
            }).join('\n');

            // Add knots for each recent FINK
            recentChoices += '\n\n' + recentFinks.map(([hash, url]) => {
                return `=== load_recent_${hash} ===\n# FINK: ${url}\n-> END`;
            }).join('\n\n');
        }

        // Generate inline INK story for error recovery
        const recoveryInk = `
=== link_not_found ===
# BG: #1a1a2e
**Bookmark Not Found** 🔍

The link you followed points to a story we can't locate.

*Link ID: ${urlHash}-${knotHash.slice(0, 5)}...*

This can happen if:
- You haven't visited that story yet on this device
- The story was moved or renamed
- The link is from a different FINK collection

What would you like to do?

+ [🏠 Go to Main Menu] -> go_home
${knownFinks.length > 0 ? '+ [📚 Browse Recent Stories] -> recent_stories' : ''}
+ [ℹ️ Technical Details] -> tech_details

=== go_home ===
~ temp placeholder = true
-> END

=== recent_stories ===
**Recently Visited Stories**

Choose a story to continue:

${recentChoices || '(No recent stories found)'}

+ [🏠 Back to Main Menu] -> go_home

=== tech_details ===
**Technical Details**

Story hash: \`${urlHash}\`
Position hash: \`${knotHash}\`
Cached stories: ${cacheStats.urlsIndexed}
${knownFinks.length > 0 ? `\nKnown story hashes:\n${knownFinks.slice(-5).map(([h, u]) => `- ${h} = ${u.split('/').pop()}`).join('\n')}` : ''}

+ [🔙 Back] -> link_not_found
+ [🏠 Go to Main Menu] -> go_home
`.trim();

        // Compile and run the recovery story
        if (window.FinkInkEngine && window.inkjs) {
            try {
                FinkUI.hideStatus();
                FinkUI.clearStory();
                FinkUI.clearChoices();

                const compiler = new inkjs.Compiler(recoveryInk);
                const story = compiler.Compile();

                // Set up special handler for go_home choice
                const originalContinue = FinkInkEngine.continueStory.bind(FinkInkEngine);

                FinkInkEngine.story = story;
                FinkInkEngine._currentKnotName = 'link_not_found';

                // Custom continue that detects go_home
                const recoveryContinue = (choiceIndex) => {
                    if (choiceIndex !== null) {
                        story.ChooseChoiceIndex(choiceIndex);
                    }

                    // Check if we're at go_home or a load_recent knot
                    const pathStr = story.state.currentPathString || '';
                    if (pathStr.startsWith('go_home')) {
                        // Return to main menu
                        if (window.FinkPlayer) {
                            FinkPlayer.returnToMainMenu();
                        }
                        return;
                    }

                    // Continue normally
                    FinkUI.clearChoices();
                    const fragment = document.createDocumentFragment();

                    while (story.canContinue) {
                        const text = story.Continue().trim();
                        if (text) {
                            const p = document.createElement('p');
                            p.innerHTML = text
                                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                                .replace(/\*(.*?)\*/g, '<i>$1</i>')
                                .replace(/`(.*?)`/g, '<code>$1</code>');
                            fragment.appendChild(p);
                        }

                        // Check for FINK tag (loading recent story)
                        const tags = story.currentTags || [];
                        for (const tag of tags) {
                            if (tag.startsWith('FINK:')) {
                                const finkUrl = tag.slice(5).trim();
                                this.log(`Recovery: Loading FINK ${finkUrl}`);
                                if (window.FinkPlayer) {
                                    FinkPlayer.loadFinkStory(finkUrl);
                                }
                                return;
                            }
                        }
                    }

                    FinkUI.replaceStoryContent(fragment);

                    if (story.currentChoices.length > 0) {
                        FinkUI.displayChoices(story.currentChoices, recoveryContinue);
                    }
                };

                // Start the recovery flow
                recoveryContinue(null);

            } catch (e) {
                this.log(`Recovery INK error: ${e.message}`);
                // Fallback to simple status message
                FinkUI.showStatus(`Bookmark not found. The story "${urlHash}" isn't in your history.`);
            }
        } else {
            // Fallback if INK engine not available
            FinkUI.showStatus(`Bookmark not found. The story "${urlHash}" isn't in your history.`);
        }
    },

    // Update URL fragment when entering a knot (uses two-part hash)
    // SPEC: Fragment format is "#urlHash-knotHash" (8 + 1 + 9 = 18 chars)
    // SPEC: Both knot name and FINK URL are trimmed before hashing
    async updateFragment(knotName) {
        const trimmedKnot = (knotName || '').trim();

        if (!this.isPublicKnot(trimmedKnot) || !this.currentFinkUri) {
            this.log(`updateFragment skipped: knot="${trimmedKnot}", uri=${!!this.currentFinkUri}`);
            return;
        }

        const finkLinkId = await this.generateFinkLinkId(this.currentFinkUri, trimmedKnot);

        // Validate the generated link ID format
        if (!finkLinkId || !finkLinkId.includes('-')) {
            this.log(`ERROR: Invalid finkLinkId generated: "${finkLinkId}"`);
            this.swimLog('🚨', 'Invalid Link ID', `"${finkLinkId}" missing hyphen!`, true);
            return;
        }

        const [urlHash, knotHash] = finkLinkId.split('-', 2);

        // Sanity check - should always have both parts
        if (!urlHash || !knotHash) {
            this.log(`ERROR: Link ID missing parts: url="${urlHash}", knot="${knotHash}"`);
            this.swimLog('🚨', 'Malformed Link ID', `Missing ${!urlHash ? 'urlHash' : 'knotHash'}`, true);
            return;
        }

        if (this.usingNavigationAPI) {
            // Use Navigation API for cleaner updates
            try {
                const url = new URL(window.location.href);
                url.hash = finkLinkId;
                navigation.navigate(url.toString(), { history: 'replace' });
            } catch (e) {
                // Fallback if navigation fails
                history.replaceState(null, '', `#${finkLinkId}`);
            }
        } else {
            // Use history.replaceState to avoid polluting history
            history.replaceState(null, '', `#${finkLinkId}`);
        }

        this.log(`Updated fragment to: #${finkLinkId} (${trimmedKnot})`);
        this.swimLog('📍', 'URL Updated',
            `#${urlHash}-${knotHash.slice(0,5)}... = ${trimmedKnot}`);
    },

    // Generate a shareable link for a knot (uses two-part hash)
    async generateShareLink(knotName, includeState = false) {
        if (!this.currentFinkUri) {
            this.log('No current FINK URI set');
            return null;
        }

        const finkLinkId = await this.generateFinkLinkId(this.currentFinkUri, knotName);
        const url = new URL(window.location.href);
        url.hash = finkLinkId;

        // Optionally include encoded state
        if (includeState && window.FinkInkEngine?.story) {
            const stateData = this.encodeVariableState();
            if (stateData) {
                url.searchParams.set('d', stateData);
            }
        }

        return url.toString();
    },

    // ROT13 encoding (light obfuscation, not security)
    rot13(str) {
        return str.replace(/[a-zA-Z]/g, (c) => {
            const base = c <= 'Z' ? 65 : 97;
            return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
        });
    },

    // Encode current story variables into URL-safe format
    encodeVariableState() {
        if (!window.FinkInkEngine?.story) return null;

        try {
            const vars = FinkInkEngine.story.variablesState;
            const stateObj = {};
            let hasState = false;

            // Enumerate observable variables
            for (const [key, value] of vars) {
                // Skip internal variables
                if (key.startsWith('_')) continue;

                stateObj[key] = value;
                hasState = true;
            }

            if (!hasState) return null;

            // Serialize to key=value pairs
            const pairs = Object.entries(stateObj)
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                .join('&');

            // ROT13 for light obfuscation
            const rotated = this.rot13(pairs);

            // Base64 encode for URL safety
            return btoa(rotated);
        } catch (e) {
            this.log(`Error encoding state: ${e.message}`);
            return null;
        }
    },

    // Decode variable state from URL parameter
    decodeVariableState(encoded) {
        try {
            // Base64 decode
            const rotated = atob(encoded);

            // ROT13 decode
            const pairs = this.rot13(rotated);

            // Parse key=value pairs
            const state = {};
            for (const pair of pairs.split('&')) {
                const [key, value] = pair.split('=').map(decodeURIComponent);
                if (key) {
                    // Try to parse numbers and booleans
                    if (value === 'true') state[key] = true;
                    else if (value === 'false') state[key] = false;
                    else if (!isNaN(value) && value !== '') state[key] = Number(value);
                    else state[key] = value;
                }
            }

            return state;
        } catch (e) {
            this.log(`Error decoding state: ${e.message}`);
            return null;
        }
    },

    // Apply decoded state to story
    applyVariableState(state) {
        if (!state || !window.FinkInkEngine?.story) return;

        try {
            for (const [key, value] of Object.entries(state)) {
                try {
                    FinkInkEngine.story.variablesState[key] = value;
                    this.log(`Applied state: ${key}=${value}`);
                } catch (e) {
                    // Variable may not exist in story
                    this.log(`Could not set variable ${key}: ${e.message}`);
                }
            }
        } catch (e) {
            this.log(`Error applying state: ${e.message}`);
        }
    },

    // Check for and extract state from URL, then purge it
    extractAndPurgeUrlState() {
        const url = new URL(window.location.href);
        const encodedState = url.searchParams.get('d');

        if (encodedState) {
            // Decode the state
            const state = this.decodeVariableState(encodedState);

            // Purge from URL to prevent accidental re-sharing
            url.searchParams.delete('d');
            history.replaceState(null, '', url.toString());

            this.log('Extracted and purged state from URL');
            return state;
        }

        return null;
    },

    // Pending state to apply after story loads
    pendingState: null,

    // Check for deep link on initial load
    async checkDeepLink(story, finkUri, finkContent = null) {
        const fragmentId = window.location.hash.slice(1);
        this.swimLog('🔍', 'checkDeepLink Called',
            `FINK: ${finkUri?.split('/').pop() || '?'}, hash: "${fragmentId || '(none)'}"`);

        // First, check for state parameter
        const urlState = this.extractAndPurgeUrlState();
        if (urlState) {
            this.pendingState = urlState;
            this.log('Found pending state to apply');
            this.swimLog('📦', 'State Param Found', JSON.stringify(urlState).slice(0, 50));
        }

        // ALWAYS build knot map - needed for updateFragment to work
        // This sets currentFinkUri which is required for URL hash updates
        await this.buildKnotIdMap(story, finkUri, finkContent);

        if (!fragmentId) {
            // No deep link, but might have state to apply
            if (this.pendingState) {
                this.applyVariableState(this.pendingState);
                this.pendingState = null;
            }
            this.swimLog('✅', 'No Deep Link', 'Starting at story beginning');
            return false;
        }

        // Generate current FINK's URL hash for comparison
        const currentUrlHash = await this.generateUrlHash(finkUri);
        this.swimLog('📊', 'Current FINK Hash',
            `${currentUrlHash} = ${finkUri?.split('/').pop()}`);

        // Check if it's a two-part hash
        const parsed = this.parseFinkLinkId(fragmentId);
        if (parsed) {
            this.log(`Two-part deep link detected: #${fragmentId}`);
            this.swimLog('🔗', 'Two-Part Hash',
                `URL: ${parsed.urlHash}, Knot: ${parsed.knotHash}`);

            // Check if URL hash matches current FINK
            if (parsed.urlHash === currentUrlHash) {
                this.swimLog('✅', 'URL Hash Match', 'Deep link is for THIS story');
            } else {
                this.swimLog('❌', 'URL Hash Mismatch',
                    `Need: ${parsed.urlHash}, Have: ${currentUrlHash}`, true);
                // Log what FINK URLs we know about
                const knownUrls = Object.entries(this.cache.urlIndex);
                if (knownUrls.length > 0) {
                    this.swimLog('📚', 'Known FINKs', knownUrls.map(([h, u]) =>
                        `${h}=${u.split('/').pop()}`).join(', '));
                } else {
                    this.swimLog('📭', 'Cache Empty', 'No FINKs indexed yet');
                }
            }

            // Apply pending state before navigation
            if (this.pendingState) {
                this.applyVariableState(this.pendingState);
                this.pendingState = null;
            }

            return await this.navigateToTwoPartLink(parsed.urlHash, parsed.knotHash);
        }

        // Try legacy single hash
        this.swimLog('🏚️', 'Legacy Hash Format',
            `"${fragmentId}" - checking ${this.knotIdMap.size} knots`);

        if (this.knotIdMap.has(fragmentId)) {
            const knotName = this.knotIdMap.get(fragmentId);
            this.log(`Legacy deep link detected: #${fragmentId} → ${knotName}`);
            this.swimLog('✅', 'Legacy Match Found', `${fragmentId} → ${knotName}`);

            if (this.pendingState) {
                this.applyVariableState(this.pendingState);
                this.pendingState = null;
            }

            return await this.navigateToKnotInCurrentStory(knotName, true);
        }

        // Log available knot hashes for debugging
        if (this.knotIdMap.size > 0) {
            const sampleHashes = Array.from(this.knotIdMap.entries())
                .slice(0, 5)
                .map(([h, k]) => `${h.slice(0, 6)}...→${k}`);
            this.swimLog('📋', 'Available Hashes', sampleHashes.join(', '));
        }

        // Check if it's a direct FINK path reference
        if (fragmentId.endsWith('.fink.js')) {
            this.log(`Direct FINK reference: ${fragmentId}`);
            this.swimLog('📄', 'Direct FINK Path', fragmentId);
            return false; // Let FinkPlayer handle this
        }

        this.log(`Unknown fragment format: ${fragmentId}`);
        this.swimLog('❓', 'Hash Not Found',
            `"${fragmentId}" not in current story's knot map`, true);
        return false;
    },

    // Clear fink_respawn after first choice (called by INK engine)
    clearRespawnFlag() {
        if (window.FinkInkEngine?.story) {
            try {
                FinkInkEngine.story.variablesState['fink_respawn'] = false;
                this.log('Cleared fink_respawn flag');
            } catch (e) {
                // Variable may not exist
            }
        }
    },

    // Get current knot from URL (if any)
    getCurrentKnotFromUrl() {
        const fragmentId = window.location.hash.slice(1);
        return this.knotIdMap.get(fragmentId) || null;
    },

    // Get FINK file path from URL hash (for direct linking to .fink.js files)
    // Supports: #story=bagend.fink.js or #bagend.fink.js patterns
    getFinkFromHash() {
        const hash = window.location.hash.slice(1);
        if (!hash) return null;

        // Check for explicit story= parameter
        const storyMatch = hash.match(/story=([^&]+)/);
        if (storyMatch) {
            return decodeURIComponent(storyMatch[1]);
        }

        // Check if hash is directly a .fink.js path
        if (hash.endsWith('.fink.js')) {
            return decodeURIComponent(hash);
        }

        return null;
    },

    // Get navigation entries (modern Navigation API)
    getNavigationEntries() {
        if (this.usingNavigationAPI && navigation.entries) {
            return navigation.entries();
        }
        return [];
    },

    // Can go back?
    canGoBack() {
        if (this.usingNavigationAPI) {
            return navigation.canGoBack;
        }
        return window.history.length > 1;
    },

    // Can go forward?
    canGoForward() {
        if (this.usingNavigationAPI) {
            return navigation.canGoForward;
        }
        return false; // Can't detect with hash-based navigation
    },

    // Go back
    goBack() {
        if (this.usingNavigationAPI) {
            navigation.back();
        } else {
            window.history.back();
        }
    },

    // Go forward
    goForward() {
        if (this.usingNavigationAPI) {
            navigation.forward();
        } else {
            window.history.forward();
        }
    },

    // Get current FINK's URL hash
    async getCurrentUrlHash() {
        if (!this.currentFinkUri) return null;
        return await this.generateUrlHash(this.currentFinkUri);
    },

    // Get cache status for debugging
    getCacheStats() {
        return {
            urlsIndexed: Object.keys(this.cache.urlIndex).length,
            graphEdges: Object.keys(this.cache.graph).length,
            knotMapsLoaded: Object.keys(this.cache.knotMaps).length,
            currentKnots: this.knotIdMap.size,
            publicEntryPoints: this.publicEntryPoints.length
        };
    },

    // Clear the cache (useful for debugging)
    clearCache() {
        this.cache = {
            urlIndex: {},
            graph: {},
            knotMaps: {}
        };
        this.saveCacheToStorage();
        this.log('Cache cleared');
    },

    // Load cache from localStorage
    loadCacheFromStorage() {
        try {
            const stored = localStorage.getItem(this.CACHE_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Only restore urlIndex - graph and knotMaps can be rebuilt
                if (parsed.urlIndex) {
                    this.cache.urlIndex = parsed.urlIndex;
                    this.log(`Loaded ${Object.keys(this.cache.urlIndex).length} cached FINK URLs from storage`);
                    this.swimLog('💾', 'Cache Loaded',
                        `${Object.keys(this.cache.urlIndex).length} FINK URLs`);
                }
            }
        } catch (e) {
            this.log('Failed to load cache from storage: ' + e.message);
        }
    },

    // Save cache to localStorage
    saveCacheToStorage() {
        try {
            // Only persist urlIndex - it's the critical mapping
            const toStore = {
                urlIndex: this.cache.urlIndex,
                savedAt: new Date().toISOString()
            };
            localStorage.setItem(this.CACHE_STORAGE_KEY, JSON.stringify(toStore));
            this.log(`Saved ${Object.keys(this.cache.urlIndex).length} FINK URLs to storage`);
        } catch (e) {
            this.log('Failed to save cache to storage: ' + e.message);
        }
    },

    log(msg) {
        if (window.FinkDevPanel) {
            window.FinkDevPanel.log(`Navigation: ${msg}`, 'info');
        } else {
            console.log(`[FinkNavigation] ${msg}`);
        }
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FinkNavigation.init());
} else {
    FinkNavigation.init();
}
