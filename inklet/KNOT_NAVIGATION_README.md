# FINK Knot Navigation & Deep Linking

This document describes the dynamic knot ID system for deep linking to specific story entry points.

## Overview

The knot navigation system allows users to share and bookmark specific entry points in FINK stories using URL fragments (hash IDs). Each public knot gets a unique, stable ID generated from the FINK file URI and knot name.

## Public vs Private Knots

**Convention**: Knots are **PUBLIC** by default, UNLESS they start with an **underscore** (`_`).

This provides backwards compatibility with existing FINK files while allowing authors to mark internal/helper knots as private.

### Examples:
- `splash` - **PUBLIC** (no underscore)
- `intro` - **PUBLIC** (no underscore)
- `bedsit` - **PUBLIC** (no underscore)
- `chapter1` - **PUBLIC** (no underscore)
- `_internal_state` - PRIVATE (starts with underscore)
- `_calculate_score` - PRIVATE (starts with underscore)
- `_helper_function` - PRIVATE (starts with underscore)

## URL Format

Deep links use URL fragments with 8-character hash IDs:

```
https://danbri.github.io/glitchcan-minigam/inklet/app/#a1b2c3d4
```

The hash ID is generated from:
- A secret salt (`glitchcan-fink-v1`)
- The FINK file URI
- The knot name

Using SHA-256, the first 8 characters create a unique, stable ID.

## How It Works

### 1. Story Load
When a FINK story loads:
- System scans all knots in the compiled story
- Identifies public knots (underscore prefix convention: knots starting with `_` are private)
- Checks URL fragment for deep link
- If fragment matches a public knot, navigates there automatically

### 2. Story Navigation
As users navigate through the story:
- When entering a **public** knot, the URL fragment updates automatically
- When entering a **private** knot, the URL fragment remains unchanged
- Uses `history.replaceState()` to avoid polluting browser history

### 3. Hash Change Events
The system listens for hash changes:
- If user clicks back/forward, system attempts to navigate to that knot
- If knot exists and is public, navigation succeeds
- If knot doesn't exist, user stays at current location

## Technical Implementation

### Files Modified:
- `inklet/app/fink-knot-nav.js` - NEW module for knot navigation
- `inklet/app/fink-ink-engine.js` - Integrated fragment detection and tracking
- `inklet/app/fink-player.js` - Initialize navigation system
- `inklet/app/index.html` - Load knot-nav module

### Key Functions:

#### `FinkKnotNav.generateKnotId(finkUri, knotName)`
Generates a unique 8-character hash ID for a knot.

```javascript
const knotId = await FinkKnotNav.generateKnotId(
    'https://example.com/story.fink.js',
    'Splash'
);
// Returns: "a1b2c3d4"
```

#### `FinkKnotNav.isPublicKnot(knotName)`
Checks if a knot is public based on naming convention.

```javascript
FinkKnotNav.isPublicKnot('Splash'); // true
FinkKnotNav.isPublicKnot('bedsit'); // false
```

#### `FinkKnotNav.getPublicKnots(story)`
Extracts all public knots from a compiled INK story.

```javascript
const publicKnots = FinkKnotNav.getPublicKnots(story);
// Returns: ['Splash', 'Intro', 'Chapter1']
```

#### `FinkKnotNav.navigateToKnotById(fragmentId, story, finkUri)`
Navigates to a knot by its hash ID.

```javascript
const success = await FinkKnotNav.navigateToKnotById(
    'a1b2c3d4',
    story,
    'https://example.com/story.fink.js'
);
```

#### `FinkKnotNav.generateShareLink(knotName)`
Generates a shareable URL for a specific knot.

```javascript
const shareUrl = await FinkKnotNav.generateShareLink('Intro');
// Returns: "https://example.com/app/?fink=...#b2c3d4e5"
```

## Usage Examples

### Example 1: Marking Public and Private Knots in INK

```ink
# BASEHREF: media/

-> splash

// PUBLIC knot (default - no underscore)
=== splash ===
# BG: #0050e0
Welcome to the story!
+ [Begin] -> intro

// PUBLIC knot (default - no underscore)
=== intro ===
The adventure begins...
~ _setup_chapter()
+ [Continue] -> chapter_one

// PUBLIC knot (default - no underscore)
=== chapter_one ===
You start your journey...
-> END

// PRIVATE helper function (starts with underscore)
=== function _setup_chapter() ===
~ score = 0
~ health = 100
```

### Example 2: Testing Deep Links

1. Open: `http://localhost:8080/inklet/app/`
2. Story loads, navigate to "Intro" knot
3. URL automatically updates: `http://localhost:8080/inklet/app/#b2c3d4e5`
4. Copy this URL and open in new tab
5. Story loads directly to "Intro" knot

### Example 3: Browser History Integration

```javascript
// User navigates through story: Splash → Intro → Chapter1
// Browser history shows three different hash fragments
// User clicks back button twice
// Story returns to Splash knot automatically
```

## API Reference

### Browser APIs Used

- **`window.location.hash`** - Read/write URL fragment
- **`window.history.replaceState()`** - Update URL without adding to history
- **`window.addEventListener('hashchange')`** - Listen for hash changes
- **`crypto.subtle.digest()`** - Generate SHA-256 hashes

### INK Story API Used

- **`story.mainContentContainer.namedContent`** - Access knot map
- **`story.ChoosePathString(knotName)`** - Navigate to specific knot
- **`story.state.currentPathString()`** - Get current knot path

## Limitations

1. **Only Public Knots**: Deep linking only works for public (capitalized) knots
2. **No State Transfer**: Deep links jump to knot start, don't restore story state
3. **Must Be Entry Point**: Linked knot must be a valid starting point
4. **Catchall Knots**: Some FINK files may have only a single public "Menu" knot

## Future Enhancements

- **State Serialization**: Save/restore full story state in URL
- **Stitch Navigation**: Support linking to specific stitches within knots
- **Bookmark System**: Save named bookmarks with full state
- **Share UI**: Add "Share" button to generate shareable links
- **Analytics**: Track which knots are most commonly linked/shared

## Testing

To test the implementation:

1. Start local server: `python -m http.server 8080`
2. Open: `http://localhost:8080/inklet/app/`
3. Open browser console and check debug messages
4. Navigate through story and observe URL fragment changes
5. Test deep linking by copying and opening URLs in new tabs

## Convention Recommendations

For FINK authors:

1. **Default is Public**: Most story knots (splash, intro, bedsit, etc.) are automatically public
2. **Use Leading Underscore for Private**: Mark internal helpers as `_calculate_score`, `_setup_state`, `_transition`
3. **Consider User Experience**: Not every knot makes sense as an entry point - users arriving mid-story may be confused
4. **Document Entry Points**: Consider which knots are good starting points for sharing

### Recommended Private Knots:
- Helper functions: `_calculate_score()`, `_update_inventory()`
- Internal transitions: `_transition_scene`, `_process_choice`
- State management: `_save_state`, `_restore_state`
- Setup/cleanup: `_init_chapter`, `_reset_variables`

This convention provides backwards compatibility with existing FINK files while allowing fine-grained control over which knots are linkable.
