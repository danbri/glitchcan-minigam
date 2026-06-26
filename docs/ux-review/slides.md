# UX Review — Slides
_First-time user, no prior knowledge. Headless Chromium, desktop (1280×800) + mobile (390×844 touch)._

## Top findings
- [minor] Typing into the title text field **appends to existing placeholder text** ("Untitled deck") instead of replacing it — the user must manually select-all before typing, which is not obvious.
- [major] **No resize/move by dragging on the canvas.** Selection shows corner handles and a move crosshair icon above the element, but dragging is unverifiable headlessly; the inspector shows pixel-percentage coordinates but there is no visible numeric input field for manually setting position or size.
- [major] **Present mode has no presenter controls at all** — no slide counter, no timer, no next-slide preview, no notes panel, no on-screen exit hint. The slide fills the viewport and Escape is the only visible exit path; nothing tells the user that Escape works. _(Maintainer note: a presenter-view toggle was added in a prior change; this agent exercised the plain `▶ Present` path and did not surface a presenter toggle — discoverability of that toggle is itself the finding.)_
- [minor] The single color swatch in the toolbar applies immediately to the **slide background**, not to a selected shape's fill — the swatch sits next to the Shape button and changes the background when no shape is selected, which is confusing. No separate fill/stroke controls appear in the inspector when a shape is selected.
- [minor] **Mobile present mode has no exit affordance**: tapping the screen does not advance the slide, keyboard Escape is not reachable on a phone, and there is no on-screen "×" or swipe-down gesture. The only observed exit was navigating the browser back (which blanked the page entirely).
- [none] Navigation to Slides is clear: the left sidebar has a labeled "▤ Slides" button that takes the user straight in with a two-slide starter deck already loaded.

## Task 1 — Build slides, add/edit text and a shape
**What I tried:** Clicked the "+ Slide" toolbar button to add a new slide. Clicked the "Untitled deck" title text on the canvas, then typed new text. Then opened the "◇ Shape ▾" dropdown and chose Rectangle.

**What I observed:** "+ Slide" worked immediately; the slide appeared in the thumbnail rail and the count went from 2 to 3. Clicking the title element selected it (blue selection border with square corner handles appeared, inspector panel opened on the right showing "Text · title"). Typing appended to the existing placeholder text — I ended up with "Untitled deckMy Presentation Title" because the field was not cleared. The Shape dropdown presented three clean options: ▭ Rectangle, ◯ Ellipse, ╲ Line. Choosing Rectangle inserted a filled rectangle on the slide immediately.

**Friction:** (a) No select-all-on-focus for the title field means first-time users will accidentally concatenate with the placeholder. (b) After a shape is inserted, the inspector still says "Text · title" — it does not switch context to show the newly added shape's properties. This means a user who wants to change the shape's color has no obvious place to look. (c) The move crosshair icon appears above the selected element but it is tiny and unlabeled; a new user may not recognise it as a drag target.

**Severity:** minor (text issue), minor (inspector context bug)

**Suggestions:** Clear title/body fields on first focus (standard behavior). After inserting a shape, auto-select it and update the inspector to show shape properties. Enlarge the move handle or add a tooltip "Drag to move."

## Task 2 — Reorder objects; change a shape's fill color
**What I tried:** With the title text element selected, used the inspector's ARRANGE section — buttons "⤒ Front", "↑", "↓", "⤓ Back". Also tried to change the shape/background color via the color swatch in the toolbar.

**What I observed:** The ARRANGE section appeared reliably in the right-hand inspector panel whenever any slide element was clicked. It showed four buttons (Bring to Front, Bring Forward, Send Backward, Send to Back) plus a position readout "x 10% · y 34% · 80×18" (percentage-based, read-only). "⤒ Front" and "⤓ Back" were both clickable and appeared to execute without error. The color swatch (a small square input next to the Shape button in the toolbar) changed the slide's **background color** — setting it to red turned the entire slide background red, which was dramatic and visible. No separate fill or stroke controls appeared in the inspector panel for a shape; the inspector only showed ARRANGE and Delete.

**Friction:** (a) There is no fill-color control for individual shapes — only the global slide background color picker. A user who draws a rectangle and wants to color it will not find a way to do so from the inspector. (b) The position readout is read-only; users cannot type a number to precisely position an element. (c) "⤒ Front" renders as a Unicode arrow that may be ambiguous — tooltip text "Bring to front" only appears on hover and is not read by a first-time user scanning the panel.

**Severity:** major (no per-shape fill color)

**Suggestions:** Add fill/stroke color pickers to the inspector when a shape element is selected (distinct from the background color). Make the x/y/w/h values editable inputs. Add text labels alongside the ⤒/⤓ icons or at least persist the tooltip-equivalent as visible micro-labels.

## Task 3 — Present the deck; then try on mobile
**What I tried (desktop):** Clicked "▶ Present" (also labeled F5 in tooltip). Observed the result. Pressed ArrowRight to advance. Pressed Escape to exit.

**What I observed:** Clicking Present replaced the entire viewport with the slide content — full-bleed, no chrome, white background, clean type. ArrowRight advanced to Slide 2 successfully. Escape returned to the editor and correctly landed on Slide 2 as the active slide. That part worked well. However: there was no slide counter (e.g. "1 / 2"), no timer, no speaker-notes panel, no "next slide" preview, and no visible instruction that Escape exits. The entire present-mode UI is invisible — it is functional but a first-time presenter will not know how to exit or navigate without prior knowledge.

**What I tried (mobile, 390×844):** Tapped "▶ Present." Observed the result. Tapped the screen center. Attempted Escape via keyboard event and history.back().

**What I observed (mobile):** Present mode loaded the slide full-screen correctly, filling the 390×844 viewport. The slide title rendered legibly. Tapping the screen center did **not** advance the slide (no click-to-advance on mobile). No on-screen controls appeared — no "next" button, no exit button, no swipe hint. Keyboard Escape is unreachable on a mobile keyboard. `history.back()` navigated the browser away entirely, leaving a blank white page. There is effectively no discoverable exit from mobile present mode.

**Friction:** Desktop: no presenter-view aids (notes, timer, counter); no on-screen exit hint. Mobile: no tap-to-advance; no exit affordance whatsoever; accidental back-gesture kills the page.

**Severity:** major (mobile exit), minor (desktop — functional but bare)

**Suggestions:** Desktop: add a minimal HUD — slide counter "1/2", Esc hint in a corner, speaker notes panel beneath or alongside the slide. Mobile: add tap-right-half/tap-left-half navigation, a persistent "×" exit button, and prevent the browser back button from blanking the app (use a history entry for present mode so back() exits present rather than unloading the SPA).

**Mobile slide rail (hamburger):** The ☰ button (aria-label "Toggle slide list") opened an overlay slide-thumbnail drawer correctly. Tapping slide 2 in the drawer selected it (active class applied, canvas updated to show Slide 2 content, toolbar updated to show "Slide 2" label). Tapping ☰ again closed the drawer. This flow worked without friction. The aside element slides in from off-screen (x: -192 when closed) — the animation was not visually verified in headless, but the state changes were correct.

## Overall impression
The core editing loop — navigate to Slides, add slides, click to select a text element, type, insert a shape, reorder layers, hit Present — is coherent and mostly works. The inspector panel (ARRANGE, position readout, Delete) appears reliably on selection and is a good foundation. The main gaps are: no per-shape fill/stroke color (only a global background picker), a bare-bones present mode that leaves users guessing how to navigate or exit (especially on mobile), and a title-field first-focus behavior that will trip up most new users. The mobile editing view is surprisingly complete; the mobile present mode is the most urgent fix.
