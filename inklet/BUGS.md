# FINK/Inklet Bug Tracker

## Active Bugs

### BUG-001: Raw HTML links displayed in "How It Works" section
**Severity:** Medium
**File:** `inklet/demos/hamfink2026.html`
**Reported:** 2026-01-15

The "View source on GitHub" section in the `how_it_works` / `github_links` knots displays raw HTML markup instead of rendered links:
```
href="https://github.com/danbri/glitchcan-minigam/blob/main/inklet/demos/hamfink2026.html" target="_blank">hamfink2026.html (this demo)
```

**Root cause:** The `displayTextWithAnimation` function processes URLs but the Ink content contains raw HTML anchor tags which aren't being rendered as HTML.

**Fix needed:** Either:
- Strip HTML from Ink output and use plain URLs (let the display function linkify them)
- Or render Ink output as HTML (security implications)

**Additional requirement:** External links should show a warning UI before leaving the game. This should be a separate PR.

---

### BUG-002: Chapter 2 re-entry ends game confusingly
**Severity:** High
**File:** `inklet/demos/hamfink2026.html`
**Reported:** 2026-01-15

Crossing into Chapter 2, returning, then re-entering Chapter 2 ends the game in a confusing state.

**Steps to reproduce:**
1. Play through to Chapter 2 portal
2. Enter Chapter 2
3. Return to main story
4. Re-enter Chapter 2
5. Game ends or becomes stuck

**Likely cause:** State not properly reset between chapter transitions, or story stack not correctly managed.

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

Playing the second (mega) minigame, collecting 7 gems, then leaving does not:
- Return to narrative view automatically
- Credit the mega_diamonds variable

When manually switching to story mode, the mega_diamonds count is 0.

**Steps to reproduce:**
1. Play through to Chapter 2 mega dimension
2. Play the mega minigame
3. Collect gems (e.g., 7)
4. Return to story (or wait for game to end)
5. Observe: stuck in minigame view, no mega diamonds credited

**Likely cause:** The `endMinigame()` function may not be triggering correctly in the mega dimension context, or the story variable update is failing when story context has changed.

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
