# FINK/Inklet Bug Tracker

## Active Bugs

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

The current lozenge highlight implementation is improving but:
- Need slow/smooth scroll to new content
- More prominent highlighting needed
- Incremental display of new sentences (one at a time?)
- Keep current lozenge highlighted longer

**Current behavior:** Word-by-word animation exists but scroll is instant and highlight fades too quickly.

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

---

### BUG-006: External links need warning UI before leaving game
**Severity:** Medium
**File:** `inklet/demos/hamfink2026.html`
**Reported:** 2026-01-15

Outgoing links (to GitHub, external sites) should display a dedicated warning UI that informs the user they will be leaving the game before navigation.

**Requirement:** This should be implemented as an isolated/separate PR.

---

## Resolved Bugs

(none yet)
