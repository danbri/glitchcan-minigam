# FINK URL Truncation Investigation

## Problem
`# FINK: https://danbri.github.io/isle_of_glitch/awakening.fink.js` gets truncated to `FINK: https:` during INK compilation.

## Code Trace

### Step 1: FINK Content Loading
File: `inklet/finkapp/fink-sandbox.js` (or similar)
- Raw FINK content loaded from .fink.js file
- Content at this point: `# FINK: https://danbri.github.io/isle_of_glitch/awakening.fink.js` (COMPLETE)

### Step 2: INK Compilation
File: `inklet/finkapp/fink-ink-engine.js` lines 97-117
```javascript
FinkUtils.debugLog('inkjs library verified, attempting compilation...');

const privateInk = this.getPrivateInventoryInk(finkContent);
const augmentedContent = finkContent + privateInk;

const compiler = new inkjs.Compiler(augmentedContent);  // LINE 105
compiledStory = compiler.Compile();                      // LINE 117
```
- `augmentedContent` still contains the complete URL
- **TRUNCATION HAPPENS HERE** - inside `inkjs.Compiler`

### Step 3: Tag Extraction at Runtime
File: `inklet/finkapp/fink-ink-engine.js` lines 285-300
```javascript
let currentTags = this.story.currentTags || [];
FinkUtils.debugLog('Current tags: [' + currentTags.join(', ') + ']');
// Debug output: "Current tags: [FINK: https:, IMAGE: glitchcan-grey-portrait-web.jpg]"

currentTags.forEach(tag => {
    const parts = tag.split(':');
    const key = parts[0]?.trim().toUpperCase();
    const value = parts.slice(1).join(':').trim();
    // value = "https:" (TRUNCATED - everything after // is gone)
```
- `this.story.currentTags` already contains truncated tag
- Tag value is `https:` instead of `https://danbri.github.io/isle_of_glitch/awakening.fink.js`

### Step 4: URL Resolution Fails
File: `inklet/finkapp/fink-ink-engine.js` lines 488-492
```javascript
FinkUtils.debugLog('Loading external FINK file: ' + this.lastSeenFinkTag);
// Debug: "Loading external FINK file: https:"

const baseUrl = FinkPlayer.currentStoryUrl || window.location.href;
const resolvedUrl = new URL(this.lastSeenFinkTag, baseUrl).href;
// new URL('https:', baseUrl) falls back to baseUrl since 'https:' alone is invalid
// Result: resolves to toc.fink.js (the current story) instead of awakening.fink.js
```

## Root Cause

INK uses `//` as comment syntax. From INK documentation:

```ink
// Something unprintable...  <- single line comment

*   {greet} 'Having a nice day?' // only if you greeted him
```

When the INK compiler parses:
```
# FINK: https://danbri.github.io/isle_of_glitch/awakening.fink.js
```

It interprets this as:
- Tag: `FINK: https:`
- Comment (discarded): `//danbri.github.io/isle_of_glitch/awakening.fink.js`

## Verification

Debug log output confirms:
```
Current tags: [FINK: https:, IMAGE: glitchcan-grey-portrait-web.jpg]
FINK tag detected: https:
Loading external FINK file: https:
Resolved URL: https://danbri.github.io/glitchcan-minigam/inklet/toc.fink.js  <- WRONG
```

## Evidence This Is First Occurrence

Git history search for `# FINK:` tags with HTTP URLs:
```bash
git log --all -p | grep "FINK: http"
```
Only result: the new awakening entry. No previous `# FINK:` tags used full URLs.

Cross-domain loading (e.g., Netlify bagend) was tested via JavaScript `loadViaSandbox()` directly, bypassing INK compilation.

## Solution Options

1. **Preprocess before compilation**: Escape `://` in tag lines before passing to INK compiler, unescape after tag extraction

2. **Alternative URL format**: Use a format that doesn't contain `//`:
   - URL-encode the slashes: `https:%2F%2Fdanbri.github.io/...`
   - Use a placeholder: `EXTERNAL:isle_of_glitch:awakening.fink.js` with lookup table

3. **Store URLs externally**: Reference URLs by ID, store actual URLs in JavaScript config
