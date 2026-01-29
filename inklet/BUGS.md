# FINK/Inklet Bug Tracker

## Active Bugs

### BUG-007: Breadcrumb nav shows flat knots, story loading fails (Bagend, Diamond Ch2)
**Severity:** P0 - Critical
**File:** `inklet/demos/hamfink2026.html`, breadcrumb/navigation system
**Reported:** 2026-01-20
**Status:** OPEN
**Merged to main:** PR #585

**Symptoms:**
1. **Nav bar panel shows all knots as if part of "toc"** - should be nested bullet points showing path within a given FINK, and transitions between FINKs
2. **Bagend loading fails** - glitch canary image continues from TOC, then green box with blank line then "Bag End", nothing more
3. **Diamond Ch2 fails on entry** - green box containing "You step through the portal into a realm of pure crystalline energy…" and nothing more

**Context:** Recent commits attempted to fix FINK loading and breadcrumb hierarchy:
- `a20abed` revert: Restore absolute FINK paths in toc.fink.js
- `f780011` fix: FINK loading and breadcrumb hierarchy
- `2444f82` feat: Interactive INK-based recovery for failed deep links
- `d606e20` fix: Improve FINK breadcrumb navigation and deep linking

**Root cause:** TBD - needs investigation

---

### BUG-001: Raw HTML links displayed in "How It Works" section
**Severity:** Medium
**File:** `inklet/demos/hamfink2026.html`
**Reported:** 2026-01-15
**Status:** FIXED

The "View source on GitHub" section in the `how_it_works` / `github_links` knots displays raw HTML markup instead of rendered links:
```
href="https://github.com/danbri/glitchcan-minigam/blob/main/inklet/demos/hamfink2026.html" target="_blank">hamfink2026.html (this demo)
```

**Root cause found:** The `displayTextWithAnimation` function:
1. Auto-linkifies filenames like `hamfink2026.html` by wrapping in `<a>` tags
2. Then splits by whitespace for word-by-word animation
3. This breaks the HTML structure: `<a href="...">` becomes `<a`, `href="..."`, etc.
4. Browser renders broken HTML as literal text

**Fix:** Check if text contains linkifiable content; if so, skip word animation and render links directly. Word animation only applied to plain text.

---

### BUG-002: Chapter 2 re-entry ends game confusingly
**Severity:** High
**File:** `inklet/demos/hamfink2026.html`, `hamfink2026-ch2.fink.js`
**Reported:** 2026-01-15
**Status:** FIXED

Crossing into Chapter 2, returning, then re-entering Chapter 2 ends the game in a confusing state.

**Root cause found:** Chapter 2's `back_to_chapter1` knot had:
```ink
# FINK: hamfink2026.html
```
This tried to load the full HTML page as a FINK file, but the sandbox expects `.fink.js` files with `oooOO` template literals. The HTML file doesn't have that format, causing failure.

**Fix:**
1. Added `# RESTART` tag handling in engine - triggers page reload
2. Changed Chapter 2 to use `# RESTART` instead of trying to load HTML as FINK

---

### BUG-003: Lozenge highlight and slow scroll needs improvement
**Severity:** Medium (UX)
**File:** `inklet/demos/hamfink2026.html`
**Reported:** 2026-01-15
**Status:** FIXED

The current lozenge highlight implementation is improving but:
- Need slow/smooth scroll to new content
- More prominent highlighting needed
- Incremental display of new sentences (one at a time?)
- Keep current lozenge highlighted longer

**Improvements made:**
1. Smooth scroll via `scrollIntoView({ behavior: 'smooth' })` and CSS `scroll-behavior: smooth`
2. More prominent lozenge: brighter colors, stronger glow, thicker border
3. Pulsing cyan dot indicator on left side of latest content
4. Extended highlight duration from 3s to 5s
5. Enhanced glow animation cycles between cyan and green

---

### BUG-004: Add datetime sort widget to logs
**Severity:** Low (UX enhancement)
**File:** `inklet/demos/hamfink2026.html`
**Reported:** 2026-01-15

The dev panel logs tab should have a sort-by widget at top/bottom to sort by datetime column (ascending/descending).

---

### BUG-005: Mega minigame doesn't return to narrative or credit diamonds
**Severity:** Critical
**File:** `inklet/demos/hamfink2026.html`
**Reported:** 2026-01-15
**Status:** FIXED

Playing the second (mega) minigame, collecting 7 gems, then leaving does not:
- Return to narrative view automatically
- Credit the mega_diamonds variable

When manually switching to story mode, the mega_diamonds count is 0.

**Root cause found:** The `while (story.canContinue)` loop in `continueStory()` kept processing AFTER detecting the MINIGAME tag. By the time the minigame started, the story had already:
1. Advanced through `-> mega_minigame_return` divert
2. Evaluated `{mega_diamonds > 0:` with mega_diamonds=0
3. Output "The Mega Diamonds were too fast!" text
4. Moved to `explore_mega`

When minigame ended and updated `mega_diamonds` to 7, the story was already past the return point.

**Fix:** Break out of the story loop immediately when MINIGAME or FINK tag is detected, preserving story position for when the external action completes.

**Additional fix (Chapter 2 specific):** The `endMinigame()` function tried to set `minigame_played = true` unconditionally, but this variable doesn't exist in Chapter 2 (which only IMPORTs diamonds, mega_diamonds, keys, score). This caused an uncaught error that stopped execution before `switchView('narrative')` ran. Fixed by:
1. Wrapping variable updates in try-catch
2. Only setting `minigame_played` if it exists in current story
3. Ensuring view switch always runs even if variable update fails

---

### BUG-006: External links need warning UI before leaving game
**Severity:** Medium
**File:** `inklet/demos/hamfink2026.html`
**Reported:** 2026-01-15

Outgoing links (to GitHub, external sites) should display a dedicated warning UI that informs the user they will be leaving the game before navigation.

**Requirement:** This should be implemented as an isolated/separate PR.

---

### BUG-008: Investigate 500ms delay in handleExternalFinkLoading
**Severity:** Low (Technical debt / Performance)
**File:** `inklet/finkapp/fink-ink-engine.js` (lines 330-334)
**Reported:** 2026-01-20
**Status:** OPEN - Needs investigation
**Related:** GitHub issue #579

**Current code:**
```javascript
// 500ms delay before loading (matches working hamfink2026 timing)
setTimeout(() => {
    FinkSandbox.clearLoadRecord(resolvedUrl);
    FinkSandbox.loadViaSandbox(resolvedUrl)
    ...
}, 500);
```

**Code trace - What happens BEFORE the delay (lines 261-285):**
1. `FinkUI.replaceStoryContent(storyFragment)` - DOM update with text
2. `FinkUI.updateImageFromINKTags(this.story)` - DOM update for image
3. `FinkNavigation.updateFragment(detectedKnot)` - **ASYNC**: calls `generateFinkLinkId()` which uses `crypto.subtle.digest()` (SHA-256)
4. `FinkBreadcrumb.recordKnot(detectedKnot)` - Breadcrumb state update
5. `FinkUI.showStatus('Loading...')` - Shows loading indicator

**Code trace - What happens INSIDE the setTimeout:**
1. `FinkSandbox.clearLoadRecord(resolvedUrl)` - Clears duplicate detection
2. `FinkSandbox.loadViaSandbox(resolvedUrl)`:
   - `fetch()` the .fink.js file content (async network I/O)
   - `cleanupSandbox()` - Removes any existing iframe
   - Creates new iframe with `sandbox="allow-scripts"`
   - Sets up postMessage handlers
   - Waits for `sandbox-ready` message
   - Sends script content to sandbox
   - Waits for `fink-loaded` response

**Risk analysis for REMOVING the delay:**

| Risk | Severity | Details |
|------|----------|---------|
| SHA-256 hash race | MEDIUM | `updateFragment()` uses async `crypto.subtle.digest()`. If new FINK loads before hash completes, URL might show stale/wrong hash during transition. |
| DOM render race | LOW | Browser may not have rendered the "Loading..." status before new content replaces it. Perceived as instant transition (could be good or bad UX). |
| Sandbox cleanup | LOW | `cleanupSandbox()` called at start of `loadViaSandbox()`. Existing sandbox is removed synchronously; unlikely to cause issues. |
| Event loop pressure | LOW | 500ms gives microtasks/macrotasks breathing room. Without delay, rapid clicking could queue multiple loads. (Mitigated by duplicate detection.) |
| User feedback | LOW | Users might not see "Loading..." flash. Could feel too abrupt on slow connections. |

**Likely safe to remove because:**
- SHA-256 hash is for deep-linking/bookmarking only, not critical path
- Sandbox has its own 5s setup timeout + 15s execution timeout
- Duplicate detection prevents accidental double-loads
- All async operations have error handling

**Recommendation:**
Try removing the delay on a test branch and verify:
1. Fast story transitions still work (TOC → Bagend → Chapter navigation)
2. Deep links still work after removing delay
3. No console errors during rapid navigation
4. "Loading..." status still visible on slow connections (add artificial 1s delay to fetch for testing)

**Test cases needed:**
```javascript
// Test 1: Rapid navigation
// Click Bagend, immediately click back, immediately click Diamond Cave
// Expected: No errors, no stuck states

// Test 2: Deep link during transition
// Navigate to Bagend, copy URL hash, refresh page
// Expected: Deep link resolves correctly

// Test 3: Network latency simulation
// DevTools → Network → Slow 3G
// Navigate to external FINK
// Expected: "Loading..." visible, then content appears
```

---

### BUG-009: Knot detection fails in Bagend, breadcrumb shows stale/missing knots
**Severity:** P1 - High
**File:** [`inklet/finkapp/fink-ink-engine.js`](../inklet/finkapp/fink-ink-engine.js), [`fink-navigation.js`](../inklet/finkapp/fink-navigation.js)
**Reported:** 2026-01-21
**Status:** MOSTLY FIXED - Double-click bug resolved, minor URL hash inaccuracy remains

**User report (verbatim):**
> Playing bagend, navpanel shows this:
> - Talk_To_Gandalf
> - Talk_To_Thorin
> - Kitchen
>
> But these are stale, I'm at Trolls at Dawn clearing (not in the breadcrumb)
> Trying nav to Thorin puts me in a random place talking to Thorin about elves
>
> [Logs showed]: "Could not determine current knot name from path"

**Later report:**
> Something is working wrong - I started with Bagend then to pools then to misty pool Mansion
> All thru Bagend it felt like little bugs plus no IDs appended to url in browser
> Whereas in Mansion it seems functional
> I try copying nav panel from mansion: toc → shane-manor
> Weird missing Bagend entirely

**Symptoms:**
1. Breadcrumb shows stale knots (Talk_To_Gandalf, Talk_To_Thorin, Kitchen) instead of current location
2. URL hash not updated during Bagend playthrough (no deep link IDs)
3. FINK stack loses intermediate levels (toc → bagend → pools → shane-manor shows as toc → shane-manor)
4. Console shows "Could not determine current knot name from path" for outdoor locations

**Current knot detection code:**
```javascript
// fink-ink-engine.js:176-193
const pathStr = this.story.state.currentPathString;
FinkUtils.debugLog('Path string: ' + (pathStr || '(null/empty)'));
if (pathStr) {
    const knotPart = pathStr.split('.')[0];
    // Skip if purely numeric (not a knot name)
    if (knotPart && !/^\d+$/.test(knotPart)) {
        detectedKnot = knotPart;
    }
}
```

**Theories:**

#### Theory A: `currentPathString` returns unexpected format for some knots
The detection logic assumes `currentPathString` is like `"Bag_End.0"` or `"Kitchen.greeting.3"`.
If Bagend's outdoor knots return a different format (empty string, purely numeric, or structured differently),
detection would fail silently.

**To verify:** Need console logs from Bagend playthrough showing actual `pathStr` values.

#### Theory B: Bagend.fink.js and Bagend2.fink.js collision (user theory)
Both files exist in the codebase and share identical knot names:
- `Bag_End`, `Outside_Bag_End`, `Kitchen`, `Talk_To_Gandalf`, `Talk_To_Thorin`, etc.

**Evidence from codebase:**
- TOC has both: `+ [Bagend] -> load_bagend` and `+ [Bagend v2 (enhanced)] -> bagend2_selected`
- [`toc.fink.js:70-75`](../inklet/toc.fink.js) shows bagend2_selected loads `/glitchcan-minigam/inklet/bagend2.fink.js`
- Both files' knots would generate **identical knotHashes** (since knotHash is based on knot name alone)

**Potential collision scenarios:**
1. `FinkNavigation.knotIdMap` is cleared on each new story load, BUT...
2. `FinkNavigation.cache.knotMaps[urlHash]` persists across loads
3. If URL resolution differs slightly (trailing slashes, absolute vs relative), same file could get different urlHashes
4. Deep link resolution might look up knotHash in wrong file's cache entry

**Relevant code paths:**
- [`FinkNavigation.buildKnotIdMap()`](../inklet/finkapp/fink-navigation.js:250) - clears knotIdMap, but populates cache
- [`FinkNavigation.cache.knotMaps`](../inklet/finkapp/fink-navigation.js:47) - keyed by urlHash
- [`navigateToTwoPartLink()`](../inklet/finkapp/fink-navigation.js:365) - resolves urlHash then knotHash

**To verify:**
1. Load bagend from TOC, note console output for urlHash
2. Load bagend2 from TOC, note console output for urlHash
3. Check if `FinkNavigation.cache.urlIndex` has entries for both
4. Try deep linking after loading bagend2 - does it accidentally navigate to bagend's knot?

#### Theory C: setFinkUrl timing issue
`setFinkUrl` was being called AFTER `loadViaSandbox` success in [`handleExternalFinkLoading`](../inklet/finkapp/fink-ink-engine.js:361).
If load was skipped (duplicate detection), setFinkUrl was never called, losing that FINK from the breadcrumb stack.

**Partial fix applied:** Moved setFinkUrl BEFORE load (commit 48e2978). But this alone may not fix the knot detection issue.

**Debugging steps needed:**
1. Play through Bagend with console open
2. Capture actual `pathStr` values logged for outdoor knots (Outside_Bag_End, Trollshaws, Troll_Clearing)
3. Check if pathStr is null/empty or has unexpected format
4. Check if bagend2.fink.js is being loaded anywhere during the flow

**Files to investigate:**
- [`inklet/bagend.fink.js`](../inklet/bagend.fink.js) - primary Bagend story
- [`inklet/bagend2.fink.js`](../inklet/bagend2.fink.js) - alternate version (why does this exist?)
- [`inklet/finkapp/fink-navigation.js`](../inklet/finkapp/fink-navigation.js) - knotIdMap and cache management
- [`inklet/finkapp/fink-breadcrumb.js`](../inklet/finkapp/fink-breadcrumb.js) - FINK stack management

**Root cause confirmed (2026-01-21):**
User debugging session proved Theory A correct:
- `currentPathString` is **null** after initial divert (`-> Bag_End`)
- `currentPathString` is **valid** after choice click (`Talk_To_Gandalf.0.5`)

**Fixes applied:**

1. **Pre-Continue pathString check** (commit 48e2978):
   - Check `currentPathString` BEFORE the first `story.Continue()` call
   - When story starts with a divert, path is valid before Continue() but null after

2. **Navigation loop fix** (commit pending):
   - Changed `navigation.navigate()` to `history.replaceState()` in `updateFragment()`
   - **Root cause of double-click bug:** `navigation.navigate()` fires hashchange events
   - This caused: choice click → updateFragment → hashchange → continueStory replay → user must click again
   - `history.replaceState()` updates URL silently without firing events

**Remaining limitation (P3):**
After choice click, `currentPathString` detects SOURCE knot not DESTINATION:
- User clicks "Leave through front door" (at Bag_End)
- Pre-Continue path: `Bag_End.0.c-1.0` → detects `Bag_End` (source)
- Continue() outputs "You stand on the path outside..." (destination text)
- Post-Continue path: **null** → can't detect `Outside_Bag_End`
- URL hash shows source knot instead of destination

This is an INK runtime behavior: `currentPathString` becomes null after Continue() processes a divert.
Deep linking to this URL would navigate to wrong knot (source instead of destination).
**Impact:** Cosmetic - navigation works correctly, only URL hash accuracy affected.

---

### BUG-010: Dev panel cannot scroll on touch devices
**Severity:** P2 - Medium (UX)
**File:** [`inklet/finkapp/fink-devpanel.css`](../inklet/finkapp/fink-devpanel.css)
**Reported:** 2026-01-21
**Status:** FIXED

**Symptom:** Cannot scroll within the top (dev console) half of screen on iOS/touch devices.

**Root cause:** Missing touch scroll CSS properties on scrollable elements.

**Fix applied:**
- Added `-webkit-overflow-scrolling: touch` for smooth iOS momentum scrolling
- Added `touch-action: pan-y` to allow vertical touch scrolling
- Applied to: `.dev-tab-content.active`, `.log-output`, `.swimlane-body`, `.state-content`, `.finks-content`, `.audio-content`, `.var-list`

---

## Resolved Bugs

(none yet)
