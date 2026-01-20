# FINK Linking Specification

**Version**: 0.1 (Draft)
**Date**: January 2026

## 1. Overview

FINK (FOAFy INK) is an internet transport format for INK interactive fiction and other textually-encoded data. This specification defines how FINK resources are addressed, fetched, cached, and navigated.

### 1.1 Design Goals

1. **Content-centric addressing**: Paths resolve relative to content location, not application location
2. **Cacheable by design**: Derived objects (compiled stories) can be cached and persisted
3. **Browser-native navigation**: Integrates with browser history without page reloads
4. **Decoupled architecture**: Clear separation between transport, execution, and presentation

---

## 2. Core Concepts

### 2.1 FINK Resource

A **FINK Resource** is a JavaScript file containing one or more `oooOO` template literal invocations that yield INK content.

```javascript
// example.fink.js
oooOO`
-> start

=== start ===
Welcome to the story.
+ [Continue] -> next
`
```

**Key properties:**
- File extension: `.fink.js`
- MIME type: `application/javascript`
- Encoding: UTF-8
- Execution: Via sandbox (see §5)

### 2.2 FINK URL

A **FINK URL** uniquely identifies a FINK resource. It may be:

| Type | Example | Resolution |
|------|---------|------------|
| Absolute | `https://example.com/stories/adventure.fink.js` | Direct fetch |
| Origin-relative | `/inklet/adventure.fink.js` | Relative to page origin |
| Content-relative | `chapter2.fink.js` | Relative to current story |
| Content-relative (parent) | `../shared/utils.fink.js` | Relative to current story |

### 2.3 FINK Link

A **FINK Link** identifies both a resource AND a position within it:

```
#<urlHash>-<knotHash>[?d=<state>]
```

| Component | Length | Source |
|-----------|--------|--------|
| urlHash | 8 hex chars | SHA-256 of normalized FINK URL |
| knotHash | 9 hex chars | SHA-256 of knot name (with `#` prefix) |
| state | variable | Optional encoded variable state |

**Example**: `#a1b2c3d4-e5f6g7h8i?d=fpber%3D5`

### 2.4 Knot

A **Knot** is a named location within INK content, prefixed with `===`:

```ink
=== pantry ===
You are in a small pantry.
```

Knots may be **public** (suitable for cold entry) or **private** (require prior context).

---

## 3. URL Resolution

### 3.1 Resolution Context

URL resolution requires a **context** - the location from which relative paths are resolved.

```
┌─────────────────────────────────────────────────┐
│              Resolution Priority                 │
├─────────────────────────────────────────────────┤
│ 1. Absolute URL       → Use directly            │
│ 2. Origin-relative    → Resolve from page origin│
│ 3. Content-relative   → Resolve from story URL  │
│ 4. No context         → Resolve from page URL   │
└─────────────────────────────────────────────────┘
```

### 3.2 The `currentStoryUrl` State

FINK clients MUST maintain `currentStoryUrl` - the URL of the currently loaded story. This serves as the resolution context for content-relative URLs.

```javascript
// When story A loads story B:
// Before: currentStoryUrl = "https://example.com/stories/a.fink.js"
// FINK tag: # FINK: b.fink.js
// Resolved: "https://example.com/stories/b.fink.js"
// After: currentStoryUrl = "https://example.com/stories/b.fink.js"
```

### 3.3 BASEHREF Tag

The `# BASEHREF:` tag declares a media directory relative to the story:

```ink
# BASEHREF: media/
# IMAGE: sunset.jpg  → <storyDir>/media/sunset.jpg
```

**Resolution rules:**
1. If BASEHREF starts with `http://` or `https://` → absolute URL
2. If BASEHREF starts with `/` → origin-relative
3. Otherwise → relative to story URL directory
4. BASEHREF MUST end with `/` (trailing slash required)

### 3.4 Layered Media Resolution

Media URLs resolve through three layers:

```
┌──────────────────────────────────────────┐
│ Layer 1: Global Media Base (if configured)│
│ e.g., "https://cdn.example.com/media/"   │
├──────────────────────────────────────────┤
│ Layer 2: Story BASEHREF (from story)     │
│ e.g., "media/adventure/"                 │
├──────────────────────────────────────────┤
│ Layer 3: Resource Path (from IMAGE tag)  │
│ e.g., "sunset.jpg"                       │
└──────────────────────────────────────────┘
                    ↓
     Final: https://cdn.example.com/media/adventure/sunset.jpg
```

---

## 4. INK Tag Extensions

FINK extends INK with tags that control loading and media. Tags are INK's official extensibility mechanism.

### 4.1 Navigation Tags

| Tag | Scope | Purpose |
|-----|-------|---------|
| `# FINK: <url>` | Knot | Load external FINK resource |
| `# BASEHREF: <path>` | Story/Knot | Set media base directory |
| `# PUBLIC: <knots>` | Story | Declare cold-start entry points |

### 4.2 Media Tags

| Tag | Scope | Purpose |
|-----|-------|---------|
| `# IMAGE: <path>` | Knot | Display image |
| `# AUDIO: <path>` | Knot | Play audio |
| `# VIDEO: <path>` | Knot | Play video |

### 4.3 Tag Placement Rules

**CRITICAL**: `# FINK:` tag placement affects loading behavior:

```ink
// WRONG - loads immediately when entering selection
=== story_selection ===
# FINK: external.fink.js
# IMAGE: preview.jpg
A great adventure awaits.
+ [Enter story] -> load_story

// CORRECT - loads only after user confirms
=== story_selection ===
# IMAGE: preview.jpg
A great adventure awaits.
+ [Enter story] -> load_story

=== load_story ===
# FINK: external.fink.js
Loading...
```

---

## 5. Sandbox Execution Model

FINK files are JavaScript and require controlled execution.

### 5.1 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Parent Page                          │
│  ┌─────────────┐    ┌────────────┐    ┌─────────────┐  │
│  │   Fetch     │───▶│  Sandbox   │───▶│   Compile   │  │
│  │  (HTTP)     │    │  (iframe)  │    │ (ink-full)  │  │
│  └─────────────┘    └────────────┘    └─────────────┘  │
│                            │                            │
│                     postMessage                         │
│                            ▼                            │
│                    Pure INK Content                     │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Execution Steps

1. **Fetch**: Parent page fetches `.fink.js` file via HTTP
2. **Create sandbox**: Create iframe with `sandbox="allow-scripts"`
3. **Inject environment**: Provide `oooOO` function that captures content
4. **Execute**: Run fetched JavaScript via `new Function()`
5. **Extract**: `oooOO` captures template literal content
6. **Return**: Send pure INK content to parent via `postMessage`
7. **Compile**: Parent compiles INK with real `ink-full.js`

### 5.3 Security Properties

- Sandbox cannot access parent DOM
- Sandbox cannot make network requests
- Content extraction via structured message passing
- No `eval()` in parent context

---

## 6. FINK Client Architecture

### 6.1 The RootApp

A **RootApp** is the host application that provides FINK browsing capabilities. The RootApp:

1. **Maintains state**: `currentStoryUrl`, navigation history, variable state
2. **Manages fetching**: Queues, deduplicates, and caches FINK requests
3. **Integrates with browser**: Updates URL bar, manages history entries
4. **Provides UI**: Renders INK content, handles user choices

### 6.2 FINK Fetch Queue

The RootApp maintains a fetch queue with deduplication:

```javascript
interface FinkFetchQueue {
    // Queue a URL for fetching (may skip if cached)
    enqueue(url: FinkUrl): Promise<FinkContent>;

    // Check if URL is already fetched/cached
    isCached(url: FinkUrl): boolean;

    // Force refresh (bypass cache)
    refresh(url: FinkUrl): Promise<FinkContent>;
}
```

**Duplicate load prevention**: Recent loads are tracked with timestamps. Requests within a configurable window (default: 5 seconds) are deduplicated to prevent infinite loops.

### 6.3 Cache Architecture

FINK clients MAY cache derived objects:

```
┌────────────────────────────────────────────────────┐
│                   FINK Cache                        │
├────────────────────────────────────────────────────┤
│ Level 1: URL Content Cache                         │
│   URL → Raw .fink.js content                       │
├────────────────────────────────────────────────────┤
│ Level 2: Extracted INK Cache                       │
│   URL → Pure INK content (post-sandbox)            │
├────────────────────────────────────────────────────┤
│ Level 3: Compiled Story Cache                      │
│   URL → JSON Story structure (post-compilation)   │
├────────────────────────────────────────────────────┤
│ Level 4: URL Index                                 │
│   urlHash → Full URL (for link resolution)         │
├────────────────────────────────────────────────────┤
│ Level 5: Graph Cache                               │
│   urlHash → [child urlHashes] (FINK references)    │
└────────────────────────────────────────────────────┘
```

Caches MAY be persisted to IndexedDB or localStorage.

---

## 7. Browser History Integration

### 7.1 URL Fragment Updates

When navigating within a story, the URL fragment SHOULD update:

```
Initial load:      finkapp.html
After loading TOC: finkapp.html#a1b2c3d4-e5f6g7h8i
After choice:      finkapp.html#a1b2c3d4-j9k0l1m2n
After FINK load:   finkapp.html#b2c3d4e5-a0b1c2d3e
```

### 7.2 History Entry Rules

| Event | History Action | URL Update |
|-------|---------------|------------|
| Story load | `pushState` | New urlHash |
| Knot navigation | `replaceState` | New knotHash |
| External FINK load | `pushState` | New urlHash + knotHash |
| Back button | `popstate` handler | Navigate to prior state |

### 7.3 Avoiding Infinite Loops

**CRITICAL**: When processing a `# FINK:` tag, do NOT call `updateFragment()` before `handleExternalFinkLoading()`. The external load handler clears/resets the hash. Double-updating causes the hash change listener to fire, re-triggering the FINK tag.

```javascript
// WRONG - causes infinite loop
if (hasFinkTag) {
    updateFragment(currentKnot);  // Triggers hashchange!
    handleExternalFinkLoading();
}

// CORRECT - let external handler manage state
if (hasFinkTag) {
    handleExternalFinkLoading();  // Clears hash, loads new story
    return;
}
```

---

## 8. Link Resolution Algorithm

When a FINK client encounters a link `#<urlHash>-<knotHash>`:

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Check current story                              │
│   If hash(currentStoryUrl) == urlHash:                  │
│     → Look up knotHash in current story                 │
│     → Navigate to knot                                  │
├─────────────────────────────────────────────────────────┤
│ Step 2: Check URL index cache                           │
│   If urlIndex[urlHash] exists:                          │
│     → Fetch that URL                                    │
│     → Load story                                        │
│     → Look up knotHash                                  │
├─────────────────────────────────────────────────────────┤
│ Step 3: Scan known FINK references                      │
│   Extract all # FINK: tags from cached stories          │
│   For each reference:                                   │
│     If hash(reference) == urlHash:                      │
│       → Fetch, load, navigate                           │
├─────────────────────────────────────────────────────────┤
│ Step 4: Graph traversal (optional)                      │
│   Recursively check FINK references in cached stories   │
│   Build discovery graph                                 │
├─────────────────────────────────────────────────────────┤
│ Step 5: Failure                                         │
│   Display error: "Bookmark destination not found"       │
│   Offer: Return to menu, manual URL entry               │
└─────────────────────────────────────────────────────────┘
```

---

## 9. State Encoding

### 9.1 Variable State in Links

Links MAY include encoded variable state:

```
#a1b2c3d4-e5f6g7h8i?d=<encoded_state>
```

**Encoding steps:**
1. Serialize variables to query string: `score=5&hasKey=true`
2. Apply ROT13 (light obfuscation): `fpber=5&unfXrl=gehr`
3. URL-encode for safety: `fpber%3D5%26unfXrl%3Dgehr`

### 9.2 State Handling

Clients MUST:
1. **Extract state on load**: Parse `?d=` parameter, decode, apply to INK engine
2. **Purge from URL after extraction**: Prevent accidental state sharing

```javascript
// After applying state
const cleanUrl = new URL(window.location.href);
cleanUrl.searchParams.delete('d');
history.replaceState(null, '', cleanUrl.toString());
```

---

## 10. Public Entry Points

### 10.1 Declaration

Stories MAY declare public knots suitable for cold starts:

```ink
# PUBLIC: plaza tavern library
```

### 10.2 Respawn Detection

Clients SHOULD set a `fink_respawn` variable when starting fresh:

```javascript
story.variablesState["fink_respawn"] = true;
// Clear after first choice
```

Stories can use this to provide appropriate context:

```ink
=== plaza ===
{fink_respawn:
    You materialize in the plaza, disoriented but unharmed.
- else:
    You return to the familiar plaza.
}
```

---

## 11. Error Handling

### 11.1 Fetch Errors

| Error | Handling |
|-------|----------|
| 404 Not Found | Display "Story not found", offer return to menu |
| Network Error | Retry with exponential backoff, then error message |
| CORS Error | Display "Story cannot be loaded from this origin" |
| Timeout | Display "Loading timeout", offer retry |

### 11.2 Compilation Errors

INK compilation errors SHOULD be caught and displayed:

```javascript
story.onError = (message, type) => {
    console.error(`INK ${type}: ${message}`);
    displayError(`Story error: ${message}`);
};
```

### 11.3 Navigation Errors

When link resolution fails, display:
- The hash that couldn't be resolved
- Possible causes (moved, renamed, different universe)
- Actions: return to menu, manual URL entry

---

## 12. Implementation Checklist

### 12.1 Minimum Viable FINK Client

- [ ] Load `.fink.js` files via sandbox
- [ ] Compile INK content with `ink-full.js`
- [ ] Process `# FINK:` tags to load external stories
- [ ] Maintain `currentStoryUrl` for relative resolution
- [ ] Process `# IMAGE:` tags with layered resolution
- [ ] Update URL fragment on navigation
- [ ] Handle browser back/forward navigation

### 12.2 Enhanced FINK Client

- [ ] Cache compiled stories
- [ ] Two-part hash links with URL index
- [ ] Variable state encoding in links
- [ ] PUBLIC entry point support
- [ ] Graph traversal for link resolution
- [ ] Duplicate load prevention

---

## Appendix A: Hash Generation

```javascript
async function sha256hex(data) {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

const SALT = 'glitchcan-fink-v2';

async function urlHash(url) {
    return (await sha256hex(`${SALT}:url:${url.trim()}`)).slice(0, 8);
}

async function knotHash(knotName) {
    return (await sha256hex(`${SALT}:knot:#${knotName.trim()}`)).slice(0, 9);
}

async function finkLink(url, knotName) {
    return `#${await urlHash(url)}-${await knotHash(knotName)}`;
}
```

---

## Appendix B: Recent Bug Reference

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Infinite loop on FINK load | `updateFragment()` before external load | Skip fragment update when `shouldLoadExternal` |
| Wrong relative paths | Using `../` for same-directory | Use direct filename |
| Bagend2 stuck loading | `'\\n'` instead of `'\n'` | Use actual newline character |
| Double media path | Passing processed BASEHREF | Pass raw BASEHREF to resolver |

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| FINK | FOAFy INK - JavaScript-wrapped INK transport format |
| FINK Resource | A `.fink.js` file containing INK content |
| FINK URL | URL identifying a FINK resource |
| FINK Link | Hash-based identifier for resource + position |
| Knot | Named location in INK content |
| RootApp | Host application providing FINK browsing |
| Sandbox | Isolated iframe for FINK execution |
| BASEHREF | Tag declaring media directory |
| urlHash | 8-char hash identifying a FINK resource |
| knotHash | 9-char hash identifying a position in a story |

---

*This specification is a living document. Implementations may vary.*
