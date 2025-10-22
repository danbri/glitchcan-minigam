# Hash ID Deep Linking - Bug Fixes

## Problems Identified

### Problem 1: Only Single Hash Showing
**Symptom**: URL only updated with one hash, not changing as you navigate through story

**Root Cause**: Knot tracking relied on `choice.sourcePath` which:
- Only exists when there are choices (not at story end)
- Represents where the choice came FROM, not where you currently ARE
- May not accurately reflect current knot location

**Location**: `/app2/fink-ink-engine.js` lines 266-273 (old code)

### Problem 2: "(no hash)" Messages
**Symptom**: Console shows errors about missing hash IDs for knots

**Root Cause 1**: Current knot name not being extracted correctly
- No method existed to get current knot from story.state
- Relied on unreliable choice.sourcePath extraction

**Root Cause 2**: External FINK loading didn't update currentStoryUrl
- When loading external stories (like from TOC), the story URL wasn't updated
- Cache was built with wrong URL, so hash IDs didn't match
- Fragment updates failed because knot cache was for different story

**Location**:
- Missing methods in `fink-ink-engine.js`
- `handleExternalFinkLoading()` at line 282

## Fixes Applied

### Fix 1: Add Proper Current Knot Detection ✅

**File**: `/app2/fink-ink-engine.js`

Added two new methods:

```javascript
getCurrentKnotName() {
    // Extracts knot name from story.state.currentPathString
    // Handles both method and property access
    // Fallback to story.state.currentPath.toString()
    // Returns just knot name (before any dots/stitches)
}

updateKnotFragment() {
    // Gets current knot name
    // Updates URL fragment via FinkKnotNav.setFragmentForKnot()
    // Called after each story continuation
}
```

**Lines**: 309-363

### Fix 2: Use Story State Instead of Choice Path ✅

**File**: `/app2/fink-ink-engine.js`

**Old Code** (lines 266-273):
```javascript
// Track current knot for URL fragment updates
// Use sourcePath from first choice (format: "knotName.stitch.index")
if (typeof FinkKnotNav !== 'undefined' && this.story.currentChoices[0] && this.story.currentChoices[0].sourcePath) {
    const sourcePath = this.story.currentChoices[0].sourcePath;
    const knotName = sourcePath.split('.')[0];
    FinkKnotNav.setFragmentForKnot(FinkPlayer.currentStoryUrl || '', knotName);
}
```

**New Code** (line 260):
```javascript
// Update URL fragment with current knot
// This should happen BEFORE displaying choices, as we want to track where we ARE
this.updateKnotFragment();
```

**Benefits**:
- Works even when there are no choices (story end)
- Always reflects actual current location
- More reliable path extraction from story state
- Simpler, cleaner code

### Fix 3: Update Story URL for External FINK ✅

**File**: `/app2/fink-ink-engine.js`

**Added** (lines 292-300):
```javascript
// Resolve the external FINK URL
const externalUrl = new URL(this.lastSeenFinkTag, window.location.href).href;
FinkUtils.debugLog('Resolved external FINK URL: ' + externalUrl);

FinkSandbox.loadViaSandbox(externalUrl)
    .then((content) => {
        FinkUtils.debugLog('External FINK loaded successfully');
        // Update currentStoryUrl BEFORE compiling so cache uses correct URL
        FinkPlayer.currentStoryUrl = externalUrl;
        this.compileAndRunStory(content);
    })
```

**Benefits**:
- Knot ID cache built with correct story URL
- Hash fragments match the actual loaded story
- Navigation from TOC to stories works correctly

## Testing Checklist

### Manual Testing Steps

1. **Start local server**:
   ```bash
   cd /home/user/glitchcan-minigam
   python -m http.server 8080
   ```

2. **Open app**: `http://localhost:8080/app2/`

3. **Test TOC → Story Navigation**:
   - Load app (should show TOC)
   - Navigate to "Hampstead" or another story
   - Verify URL updates with hash fragment
   - Check console for "Knot ID cache built with X entries"

4. **Test Story Navigation**:
   - Make choices in the story
   - Verify URL fragment changes with each knot
   - Check console for "Extracted knot name: X"
   - Check console for "Updated URL fragment to: #xxx"

5. **Test Deep Linking**:
   - Navigate to middle of story
   - Copy URL with hash fragment
   - Open in new tab
   - Should jump directly to that knot

6. **Test Browser Back/Forward**:
   - Navigate through several knots
   - Click browser back button
   - Should return to previous knots
   - URL should update correctly

7. **Test Story End**:
   - Play through to story end
   - Verify final knot has hash in URL
   - Should not show "(no hash)" errors

### Console Commands for Debugging

Open browser console (F12) and try:

```javascript
// Check cache
window.fink.knotNav.knotIdCache

// Get current knot
window.fink.engine.getCurrentKnotName()

// Check story URL
window.fink.player.currentStoryUrl

// Check if knot nav is loaded
typeof FinkKnotNav

// Manual fragment update test
window.fink.engine.updateKnotFragment()
```

## Expected Behavior After Fixes

✅ **URL updates on every knot change** - Not just when there are choices
✅ **Hash fragments persist through story** - Every public knot gets a unique hash
✅ **External stories work** - TOC → Story navigation updates cache correctly
✅ **Deep links work** - Bookmarked URLs jump to correct knot
✅ **No "(no hash)" errors** - All public knots have cached IDs
✅ **Story end tracked** - Final knot shows in URL even with no choices

## Debug Log Examples

**Good logs you should see**:
```
Knot ID cache built with 8 entries
Cached: splash -> #abc12345
Cached: intro -> #def67890
...
Raw path string from story state: "bedsit"
Extracted knot name: "bedsit"
Updated URL fragment to: #xyz99999 for knot: bedsit
```

**Bad logs (should NOT see)**:
```
❌ No cached ID for knot: bedsit
Cannot get current knot - no story or state
Cannot update fragment - missing knot name or story URL
```

## Files Modified

- `/app2/fink-ink-engine.js` - Main fixes for knot tracking
  - Added `getCurrentKnotName()` method
  - Added `updateKnotFragment()` method
  - Updated `continueStory()` to use new tracking
  - Fixed `handleExternalFinkLoading()` to update story URL

## Related Documentation

- `/inklet/KNOT_NAVIGATION_README.md` - Design documentation
- `/inklet/HASH_ID_TESTING.md` - Testing guide
- `/app2/FOLDER_STRUCTURE_NOTE.md` - Development folder info
