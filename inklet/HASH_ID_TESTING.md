# Hash ID Deep Linking - Testing Guide

## Overview
The hash ID system allows direct linking to specific story knots using URL fragments.

## Test Setup

1. Start a local web server:
   ```bash
   cd /home/user/glitchcan-minigam
   python -m http.server 8080
   ```

2. Open browser to: `http://localhost:8080/inklet/app/`

## Test Cases

### Test 1: Automatic URL Updates
**Goal**: Verify URL fragment updates as you navigate through story

**Steps**:
1. Open `http://localhost:8080/inklet/app/`
2. Navigate through the Table of Contents to "Hampstead" story
3. Choose "Begin Urban Adventure"
4. Observe URL in address bar - it should update with hash fragments like `#a1b2c3d4`
5. As you make choices, watch the URL fragment change

**Expected Result**:
- URL updates automatically as you navigate to each knot
- Each public knot gets a unique 8-character hash
- Private knots (starting with `_`) don't update the URL

### Test 2: Direct Deep Linking
**Goal**: Test that hash URLs work as bookmarks

**Steps**:
1. Navigate to Hampstead story → "bedsit" knot
2. Copy the URL from address bar (should include `#xxxxxxxx`)
3. Open a new browser tab
4. Paste the copied URL
5. Page should load directly to "bedsit" knot, not the beginning

**Expected Result**:
- Story loads and immediately jumps to the bookmarked knot
- You see "Grotty bedsit. 3-2-1 blares on TV."
- You don't have to replay earlier choices

### Test 3: Browser Back/Forward Buttons
**Goal**: Verify browser history integration

**Steps**:
1. Navigate through several knots: splash → intro → bedsit → wardrobe → bedsit → street
2. Click browser back button several times
3. Click browser forward button

**Expected Result**:
- Back button returns you to previously visited knots
- Forward button advances through history
- Story state matches each knot location

### Test 4: Public vs Private Knots
**Goal**: Confirm only public knots are linkable

**Steps**:
1. Open browser console (F12)
2. Navigate to Hampstead story
3. In console, type: `window.fink.knotNav.knotIdCache`
4. Inspect the cache object

**Expected Result**:
- Cache contains public knots: splash, intro, bedsit, wardrobe, street, etc.
- Cache does NOT contain knots starting with underscore
- Each cached knot has an 8-character hash ID

### Test 5: Share Link Generation
**Goal**: Test programmatic share link creation

**Steps**:
1. Navigate to any knot in Hampstead
2. Open browser console
3. Run: `await window.fink.knotNav.generateShareLink('bedsit')`
4. Copy the generated URL
5. Open in new tab

**Expected Result**:
- Function returns a full URL with query param and hash
- Opening the URL in new tab loads directly to that knot

### Test 6: Invalid Hash Handling
**Goal**: Verify graceful handling of bad hash IDs

**Steps**:
1. Navigate to: `http://localhost:8080/inklet/app/#invalidhash99`
2. Observe what happens

**Expected Result**:
- Story loads normally from the beginning
- Console shows debug message about invalid fragment
- No JavaScript errors occur

## Debug Console Commands

Open browser console (F12) and try these commands:

```javascript
// View current knot ID cache
window.fink.knotNav.knotIdCache

// Get list of public knots
window.fink.knotNav.getPublicKnots(window.fink.engine.story)

// Check if a knot is public
window.fink.knotNav.isPublicKnot('bedsit')      // true
window.fink.knotNav.isPublicKnot('_helper')     // false

// Generate hash ID for a knot
await window.fink.knotNav.generateKnotId(
    'http://localhost:8080/inklet/hampstead.fink.js',
    'bedsit'
)

// Get current fragment
window.fink.knotNav.getCurrentFragment()

// Generate shareable link
await window.fink.knotNav.generateShareLink('street')
```

## Known Limitations

1. **No State Preservation**: Deep links jump to the knot start, but don't restore variable state or score
2. **Entry Point Validation**: Linked knot must be a valid starting point (some knots may expect prior state)
3. **TOC Navigation**: Table of contents uses FINK: tags, which reload the story and clear the hash

## Success Criteria

All tests pass if:
- ✅ URLs update automatically with hash fragments
- ✅ Hash fragments can be bookmarked and shared
- ✅ Browser back/forward buttons navigate between knots
- ✅ Only public knots appear in cache
- ✅ Invalid hashes fail gracefully
- ✅ Console shows clear debug messages
