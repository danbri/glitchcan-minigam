# FINK Link System: Cache-Aware Navigation

## Overview

A "fink link" is a deep link into a FINK browser UI (like finkapp) that references both a FINK episode and a specific location within it. This document describes a two-part hash system for fink links that enables navigation across the FINK graph without requiring a large pre-built cache.

## Current System

The existing `fink-navigation.js` generates knot IDs by hashing:
```
sha256(salt + ":" + finkUri + ":" + knotName).slice(0, 8)
```

This produces single hashes like `#6cb67994` that combine both the FINK file and knot identity into one opaque string.

**Limitation**: Without knowing all knot hashes in advance, we can only resolve links for the currently loaded FINK file.

## Proposed: Two-Part Hash Structure

Split the linkref ID into two separate hashes:

```
#<finkUrlHash>-<knotIdHash>
```

Example: `#6cb67994-9bca71910`

### Part 1: FINK URL Hash
- Hash of the FINK file URL (e.g., `/glitchcan-minigam/inklet/bagend.fink.js`)
- 8 hex characters
- Identifies which FINK episode the link points to

### Part 2: Knot ID Hash
- Hash of the knot name **including the initial `#`** (e.g., `#pantry`)
- 8-10 hex characters
- Identifies the specific location within that episode

### Hash Generation

```javascript
async function generateFinkLinkId(finkUrl, knotName) {
    const salt = 'glitchcan-fink-v2';

    // Part 1: FINK URL hash
    const urlData = `${salt}:url:${finkUrl}`;
    const urlHash = await sha256hex(urlData).slice(0, 8);

    // Part 2: Knot hash (include # prefix)
    const knotData = `${salt}:knot:#${knotName}`;
    const knotHash = await sha256hex(knotData).slice(0, 9);

    return `${urlHash}-${knotHash}`;
}
```

## Navigation Resolution Algorithm

When finkapp encounters a fink link like `#6cb67994-9bca71910`:

### Step 1: Check Currently Loaded FINK
If a FINK file is already loaded, check if its URL hashes to `6cb67994`. If yes, look up the knot directly.

### Step 2: Scan Known FINK URLs
Extract all `# FINK:` references from the initial/current FINK file (e.g., `toc.fink.js`):
```javascript
const finkRefs = extractFinkTags(currentContent);
// ["/glitchcan-minigam/inklet/bagend.fink.js",
//  "/glitchcan-minigam/inklet/hampstead.fink.js", ...]
```

Hash each URL and compare to the first part (`6cb67994`). If a match is found:
1. Fetch and parse that FINK file
2. Build knot map for that file
3. Look up second part (`9bca71910`) to find target knot

### Step 3: Graph Traversal (Future Enhancement)
If no direct match, recursively scan FINK files we know about:
```
toc.fink.js -> bagend.fink.js -> bagend-chapter2.fink.js -> ...
```

This creates a discovery graph. For now, with user confirmation to avoid automation errors.

### Step 4: Fallback - Link Not Found
If no path through the known FINK graph reaches the target:
- Display clear error message: "Bookmark destination not found in known stories"
- Future: Use directories, search indexes, or discovery services
- Consider: Allow user to manually specify FINK URL if they know it

## Variable State Encoding

Many bookmarked positions require associated variable data to make sense (inventory, flags, achievements, etc.).

### URL Parameter Format
```
?d=<encoded_state>
```

Where `<encoded_state>` is:
1. Simple key-value pairs: `foo=bar&xyz=abc`
2. ROT13 encoded (light obfuscation, not security)
3. Base64/uuencoded for URL safety

### Example
```
Original state: {score: 5, hasKey: true, location: "pantry"}
Serialized:     score=5&hasKey=true&location=pantry
ROT13:          fpber=5&unfXrl=gehr&ybpngvba=cnagel
URL-encoded:    fpber%3D5%26unfXrl%3Dgehr%26ybpngvba%3Dpnagel
Final URL:      finkapp.html#6cb67994-9bca71910?d=fpber%3D5%26unfXrl%3Dgehr%26ybpngvba%3Dpnagel
```

### State Handling Requirements

Any finkapp-style browser that generates these links MUST also:

1. **Accept state on load**: Parse `?d=` parameter, decode, and pass to INK engine setup
2. **Purge state from URL**: After extracting state, clean the URL to prevent:
   - Accidental re-sharing of state
   - State leaking into browser history
   - Copy-paste spreading stale state

```javascript
// After extracting state
const cleanUrl = new URL(window.location.href);
cleanUrl.searchParams.delete('d');
history.replaceState(null, '', cleanUrl.toString());
```

## PUBLIC Entry Points

FINK files can declare "public" entry points - knots that make sense for cold starts without any prior state or history.

### Syntax
```ink
# PUBLIC: plaza pub library garden
```

A space-separated list of knot names that serve as valid entry points.

### Respawn Detection

When the INK engine is restarted fresh (not continuing from saved state):

```javascript
// Set on fresh start
story.variablesState["fink_respawn"] = true;

// Clear after first choice is taken
onChoiceSelected(() => {
    story.variablesState["fink_respawn"] = false;
});
```

### Usage in INK Content

Public knots can detect and handle "arriving from nowhere":

```ink
=== plaza ===
{fink_respawn:
    You materialize in the village plaza, disoriented but unharmed. The locals barely glance your way - they've seen stranger things.
- else:
    You return to the familiar plaza, the fountain's gentle splash welcoming you back.
}

* [Look around] -> plaza_describe
* [Check inventory] -> inventory
```

### Benefits
- Bookmarks to public knots work without state
- Share links that "just work" for new players
- Natural respawn points for broken/corrupted saves
- Tutorial/help knots accessible from anywhere

## Implementation Notes

### Minimal Cache Requirements
The two-part hash system deliberately avoids requiring a large pre-built cache:

- Only need to cache FINK URLs as encountered
- Knot hashes computed on-demand when FINK is loaded
- Graph edges (FINK -> FINK references) cached as discovered

### Cache Structure (Suggested)
```javascript
const finkCache = {
    // URL hash -> full URL
    urlIndex: {
        "6cb67994": "/glitchcan-minigam/inklet/bagend.fink.js"
    },

    // URL hash -> [child URL hashes]
    graph: {
        "a1b2c3d4": ["6cb67994", "e5f6g7h8"]  // toc -> bagend, hampstead
    },

    // URL hash -> {knotHash -> knotName}
    knotMaps: {
        "6cb67994": {
            "9bca71910": "pantry",
            "abc123def": "kitchen"
        }
    }
};
```

### Error Messages

Clear communication when navigation fails:

```
"Cannot find bookmark destination"

The link points to a story position we can't reach from here.

Story hash: 6cb67994 (not found in known episodes)
Position hash: 9bca71910

Possible causes:
- The story has been moved or renamed
- The story is not linked from the main menu
- The link is from a different FINK universe

[Return to Main Menu] [Try entering story URL manually]
```

## Future Enhancements

1. **FINK Discovery Service**: Central registry mapping URL hashes to actual URLs
2. **Peer-to-Peer Resolution**: Ask connected peers if they know a hash
3. **Search Integration**: Full-text search across known FINK content
4. **QR Code Links**: Fink links encoded as QR for mobile sharing
5. **History Compression**: Efficient encoding of navigation paths for sharing entire play sessions
