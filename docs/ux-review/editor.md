# UX Review — Editor
_First-time user, no prior knowledge. Headless Chromium, desktop + mobile._

## Top findings
- [major] **Link insertion is broken**: clicking the toolbar's "Insert link" button with text selected produces no dialog, no input, no visible response — the action silently fails. The Insert menu lists "Link…" as an option (the ellipsis implies a dialog) but the same silence follows. A user wanting to hyperlink text has no working path.
- [major] **No word or character count anywhere**: exhaustive search of the UI — status bar, View menu, Insert menu, Edit menu, Aa panel, all visible elements — found nothing. This is a baseline expectation for any writing tool; its absence is a gap, not an oversight.
- [minor] **Style selector is a native `<select>` element**: works functionally, and the label "Paragraph style" is present (albeit visually redundant), but the control looks inconsistent with the rest of the toolbar (custom buttons everywhere, one native dropdown). On mobile it invokes the OS picker, which works but feels mismatched.
- [minor] **Bold active-state indicator is subtle on desktop**: the active state uses a brown/rust background (`rgb(139,69,19)` with white text). This does communicate state, but the color is low-contrast and identical to the app's decorative brand color — a user cannot be certain "is this active or is this just how bold buttons look?"
- [minor] **Mobile toolbar wraps across four rows with no grouping affordance**: all toolbar buttons are visible (no overflow scroll needed), but four unlabeled rows of icon-only buttons at 35×35 px with no row separators are cognitively dense. The "Aa" button (which turns on text labels) exists but is itself unlabeled and at the far end of the fourth row — a user would never find it first.
- [none] **Navigation, heading application, and bullet lists all work correctly** on both desktop and mobile.

---

## Task 1 — Write a note with bold, heading, and bullet list

**What I tried:** Clicked the "✍️ Editor" rail button, landed in a blank document with placeholder "Start writing…". Typed a title, used the "Paragraph style" dropdown to change it to Heading 1, placed the cursor on a new line, clicked the **B** button to toggle bold on, typed bold text, toggled bold off, then clicked the bullet-list button (•—) and typed three items.

**What I observed:** Everything worked. The heading rendered visually distinct (larger, bold). The **B** button changed background color to brown when active (`aria-pressed="true"` is set — good for accessibility). The bullet list produced a proper `<ul>` with three `<li>` elements. The dropdown showed the current block style correctly in both directions (caret position updates the dropdown value; dropdown changes apply to the caret block). A status strip at the very bottom of the page shows "Body text applied" / "Heading 1 applied" as a confirmation — easy to miss but present.

**Friction:** The "Paragraph style" label to the left of the dropdown adds visual clutter without adding clarity — the dropdown's own value (e.g. "Heading 1") already communicates what it does. The alignment buttons (left/center/right/justify) have no visible label on desktop and only tooltip text on hover; a new user looking at a row of ruler-line glyphs has to hover each one to understand what they do.

**Severity:** none — core formatting works.

**Suggestions:** Surface the "Aa" label toggle more prominently, or default to showing labels until the user hides them. Consider adding a thin visual separator between toolbar groups (inline style vs. block style vs. alignment vs. list) to reduce scanning effort.

---

## Task 2 — Insert a link and find word/character count

**What I tried:** Selected the word "website" in the document, then clicked the 🔗 toolbar button (title: "Insert link"). Then opened the Insert menu and clicked "Link…". Also tried the Aa panel. Searched every visible element for any word-count or character-count display.

**What I observed:** Both link-insertion paths produced no visible response — no dialog, no tooltip, no inline prompt, nothing. The button's title says "Insert link" and the Insert menu entry ends in "…" (strongly implying a dialog will appear), but nothing appears. The word "website" remained selected, unchanged. The Aa button toggled button labels on but opened no separate panel. There is no word count, character count, or reading-time estimate anywhere in the UI — not in any menu, not in a status bar, not in the document footer.

**Friction:** Link insertion being silently inoperative is a complete blocker for this task. A user would repeat the click, wonder if they misunderstood the flow, and then give up. No error message is shown, no console warning is surfaced to the user, and no alternative path (e.g. keyboard shortcut hint) is visible. The absence of word count is a separate gap — not blocked, just missing.

**Severity:** blocker (link insertion); major (word count absent).

**Suggestions:** Fix the link dialog to actually appear. As a stopgap, graying out the button when it has no handler is far better than a silent no-op. For word count, a live counter in the status strip ("42 words") would be the lowest-effort addition with the highest user benefit.

---

## Task 3 — Repeat basic formatting on mobile (390×844, touch)

**What I tried:** Loaded the Editor on a mobile viewport. Tapped the document area, typed text, tapped the B button (bold), typed "bold", tapped B again, then changed the style to Heading 2 via the native `<select>`, then tapped the bullet list button.

**What I observed:** The mobile layout is a genuine responsive adaptation, not a scaled-down desktop. The app rail moves to the bottom of the screen (a bottom tab bar), freeing vertical space — this is correct mobile UX. The toolbar reflows into four horizontal rows of icon buttons fitting the 390 px width; no horizontal scroll is needed. Bold worked, heading worked, bullet list worked. The `<select>` for paragraph style invokes the OS picker on mobile, which is functional. The active state on the "Align left" button was highlighted in the same brown, visible at mobile size.

**Friction:** Tap targets are 35×35 px throughout. Apple HIG recommends 44×44 px minimum; Google Material recommends 48×48 dp. At 35 px, small-fingered or motor-impaired users will struggle, and the buttons are close-packed with no padding gap between them. The four toolbar rows have no visible grouping — inline formatting (B/I/U/S), alignment, lists/indent/quote/code, and undo/redo all run together. A user who wants undo has to scan all four rows to find the ↶ symbol. The "Aa" label-reveal button is the very last button in row four and is labeled only "Aa" in the DOM — on a glance it reads as a font-size control, not a "show labels" toggle.

**Severity:** minor (tap target size, layout density) — nothing blocks the core tasks, but small-finger accuracy is a real concern.

**Suggestions:** Increase toolbar button touch targets to at least 44×44 px. Add a thin horizontal rule or 4 px gap between toolbar row groups. Consider labeling the "Aa" button with "Labels" or placing a tooltip/long-press hint. Alternatively, on mobile, default to labels-on since space is already used across four rows.

---

## Overall impression

The Editor's core functionality — typing, headings, bold/italic, lists — is solid and the mobile adaptation is thoughtfully done (bottom rail, reflowed toolbar). State communication for active buttons uses `aria-pressed` correctly, which is a good foundation. However, link insertion is silently broken (the most requested writing-tool feature after text formatting), and there is no word count anywhere, which together make the tool feel incomplete for real document work. The toolbar icon vocabulary is compact and efficient on desktop but becomes dense and unlabeled on mobile; the "Aa" labels toggle is a good idea that is itself undiscoverable.
