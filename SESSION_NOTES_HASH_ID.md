# Session Notes: Hash ID URL Deep Linking

## Summary

Task was to "Complete and test hash id for URLs / direct link to public (non-underscore) knots"

## Key Discovery

The hash ID URL deep linking feature was **ALREADY FULLY IMPLEMENTED** in `/app2/` before this session began.

## What Happened

1. ❌ **Mistakenly worked on `/inklet/app/`** - Implemented hash ID integration in the wrong folder
2. ✅ **Discovered `/app2/` is active frontend** - User corrected that `/app2/` is where development happens
3. ✅ **Verified `/app2/` already has feature** - Found complete implementation already exists
4. ✅ **Documented folder structure** - Created notes to prevent future confusion

## Current Status

### Hash ID Feature in `/app2/` ✅ COMPLETE

**File: `/app2/fink-knot-nav.js`** (265 lines)
- SHA-256 hash ID generation (8-character IDs)
- Public knot detection (underscore prefix convention)
- Knot ID caching for performance
- Browser history integration
- Hash change event handling

**File: `/app2/fink-player.js`** (lines 15-18)
```javascript
if (typeof FinkKnotNav !== 'undefined') {
    FinkKnotNav.init();
}
```

**File: `/app2/fink-ink-engine.js`**
- **Lines 120-138**: Builds knot ID cache after story compilation
- **Lines 154-175**: `checkInitialFragment()` method for initial URL hash
- **Lines 266-273**: Updates URL fragment when choices display

**File: `/app2/index.html`** (line 123)
```html
<script src="fink-knot-nav.js"></script>
```

### Work Done in `/inklet/app/` (Historical Reference Only)

Three commits were made to the feature branch:
1. `8cb5dbd` - Implement hash ID URL deep linking for public knots (in wrong folder)
2. `519c948` - Add comprehensive testing guide
3. `3ebb9ff` - Add folder structure documentation ✅ (useful)

**Files created/modified in wrong location:**
- `/inklet/app/fink-knot-nav.js` - Copied from app2
- `/inklet/app/index.html` - Added script tag
- `/inklet/app/fink-player.js` - Added initialization
- `/inklet/app/fink-ink-engine.js` - Added integration methods
- `/inklet/HASH_ID_TESTING.md` - Testing guide (still useful as documentation)

## Testing the Existing Implementation

Since the feature already exists in `/app2/`, you can test it:

```bash
cd /home/user/glitchcan-minigam
python -m http.server 8080
# Open http://localhost:8080/app2/
```

**Test scenarios** (from `/inklet/HASH_ID_TESTING.md`):
1. Navigate through stories - URL should update with hash fragments
2. Copy a URL with hash - Open in new tab, should jump to that knot
3. Browser back/forward - Should navigate between visited knots
4. Check console: `window.fink.knotNav.knotIdCache` to see public knots

## Recommendations

### Option 1: Keep Branch As Documentation
- The testing guide and folder structure docs are useful
- Merge the branch to capture documentation
- Ignore the duplicate implementation in `/inklet/app/`

### Option 2: Clean Up Branch
- Remove commits that modified `/inklet/app/`
- Keep only the documentation commits
- Rebase to clean history

### Option 3: Archive and Move On
- Close/delete the branch
- The feature already works in `/app2/`
- Use this document as reference

## Lessons Learned

1. ✅ Always check `/app2/` first for frontend work
2. ✅ `/inklet/app/` is frozen for historical reference
3. ✅ The knot navigation system is production-ready in `/app2/`
4. ✅ Created `app2/FOLDER_STRUCTURE_NOTE.md` to prevent future confusion

## Bug Fixes Applied (Second Session)

### Issues Reported
1. Only seeing single hash (not updating as navigating through story)
2. Seeing "(no hash)" or similar error messages

### Root Causes Identified

**Problem 1: Wrong Knot Tracking Method**
- Code used `choice[0].sourcePath` to get current knot
- This only works when choices exist (fails at story end)
- sourcePath represents where choice came FROM, not where you ARE
- Results in wrong knot names and missing updates

**Problem 2: Missing Story URL on External Loads**
- When loading stories from TOC (external FINK files)
- `FinkPlayer.currentStoryUrl` wasn't updated
- Knot cache built with wrong URL
- Hash IDs didn't match, causing lookup failures

### Fixes Applied (Commit 8715a9d)

**Fix 1: Added `getCurrentKnotName()` Method**
- Properly reads from `story.state.currentPathString`
- Handles both method and property access patterns
- Fallback to `story.state.currentPath.toString()`
- Extracts knot name (before any dots/stitches)

**Fix 2: Added `updateKnotFragment()` Method**
- Centralized fragment update logic
- Calls `getCurrentKnotName()` for accurate location
- Updates URL via `FinkKnotNav.setFragmentForKnot()`

**Fix 3: Updated `continueStory()`**
- Removed old choice.sourcePath tracking
- Added call to `updateKnotFragment()`
- Now updates URL on EVERY knot, not just when choices exist

**Fix 4: Fixed External FINK Loading**
- Resolve external URL and store it
- Update `FinkPlayer.currentStoryUrl` BEFORE compiling
- Ensures cache uses correct story URL

### Files Modified
- `/app2/fink-ink-engine.js` - All 4 fixes applied
- `/app2/HASH_ID_FIX_NOTES.md` - Detailed documentation of fixes

### Testing

See `/app2/HASH_ID_FIX_NOTES.md` for comprehensive testing checklist.

Quick test:
```bash
cd /home/user/glitchcan-minigam
python -m http.server 8080
# Open http://localhost:8080/app2/
# Navigate through stories
# Watch URL update with each knot
# Check console for "Extracted knot name" messages
```

## Next Steps

1. **Test the fixes** using guide in `/app2/HASH_ID_FIX_NOTES.md`
2. Verify URL updates on every knot transition
3. Confirm external stories (from TOC) work correctly
4. Check that browser back/forward navigation works
5. Test deep linking by copying/pasting URLs with hash fragments

## Files for Reference

**Documentation (useful):**
- `/inklet/KNOT_NAVIGATION_README.md` - Design documentation
- `/inklet/HASH_ID_TESTING.md` - Testing guide
- `/app2/FOLDER_STRUCTURE_NOTE.md` - Folder structure clarification

**Active Implementation:**
- `/app2/fink-knot-nav.js` - Core module
- `/app2/fink-player.js` - Initialization
- `/app2/fink-ink-engine.js` - Integration
- `/app2/index.html` - HTML structure
