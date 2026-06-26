# UX Review — Data
_First-time user, no prior knowledge. Headless Chromium, desktop (1280x800) + mobile (390x844 isMobile/hasTouch)._

## Top findings
- [major] **Welcome-screen cards are dead on a fresh load.** Clicking "Sample database", "New spreadsheet", or "New table" from the landing cards does nothing until the in-browser SQLite engine finishes initialising. There is a persistent `Loading…` indicator during this window, but it lives in an unrelated part of the UI (above the left sidebar) and does not explain why the cards are unresponsive. Users click a big inviting button and nothing happens — a classic silent-failure blocker.
- [major] **"+ Sheet" / "New spreadsheet" navigates nowhere once the DB is loaded.** After Chinook was loaded, clicking "+ Sheet" (toolbar) or the "New spreadsheet" card found no `+ Sheet` button visible in the toolbar (the button was hidden behind overflow scroll that is not scrollable without a mouse). The "+ Table" button was also inaccessible by the same mechanism. New objects cannot be created from the keyboard or touch without discovering the hidden scroll.
- [major] **The SQL editor is the default landing point for Sample, not a table.** A naive user who clicks "Sample database" is immediately dropped into a 4-table SQL JOIN query pre-populated in a code editor. This is impressive but deeply wrong as a first experience for a non-SQL user — "explore" implies browsing, not reading a query.
- [minor] **"Loading…" is never explained.** The spinner is a bare `div.loading` with text "Loading…" parked above the left nav. There is no tooltip, no progress bar, no indication of what is loading or how long it will take. In testing, initialisation took 3–8 seconds.
- [minor] **Toolbar overflow on mobile.** The `dw-toolbar` div has `scrollWidth: 847px` on a 390px viewport. The rightmost items (SQLite, CSVs, N-Quads download buttons) are off-screen with no visible scroll affordance or overflow indicator on mobile.
- [none] **Mobile table data and results grid render correctly once loaded.** Column widths are readable, rows are legible, the bottom nav tab bar works cleanly. SQL visible on mobile, but it is the pre-written demo query — not raw DDL thrown at the user.

---

## Task 1 — Start working with data
**What I tried:** Landed on `index.html`, clicked the "▦ Data" sidebar button, then clicked the "Sample database" card (large, icon, two-line description). Also tried "New spreadsheet" and "New table" cards.

**What I observed:** On a first load with no prior state, all three large welcome-screen cards are completely unresponsive to click/tap for 3–8 seconds while `initSqlJs` (the in-browser SQLite WASM engine) initialises. During this window the cards give no visual feedback at all — no spinner, no disabled state, no "loading…" overlay on the card itself. After the DB initialised (detected by waiting for the `TABLES` list to appear), Sample database loaded a left sidebar listing 11 Chinook tables and a centre pane showing an SQL query editor pre-filled with a 4-table JOIN. That is functional but deeply confusing for a first-time user who expected to see rows, not code. The "New spreadsheet" card, after the DB was ready, navigated to the Artist datasheet instead (state was remembered from a prior click) — the "New spreadsheet" path itself was never exercised cleanly in a blank state on desktop because the toolbar "+ Sheet" button was outside the visible scroll area.

**Friction:** Silent failure on card click (no feedback during WASM load); SQL-first landing for "Sample database"; welcome screen does not disable cards or show load progress.

**Severity:** major

**Suggestions:** Visually disable welcome cards (grey out + spinner) while the DB engine initialises. Add a brief "Setting up your in-browser database…" status line. Make "Sample database" open the Artist or Album table in Datasheet mode, not the SQL workbench — let users find SQL via a clearly labelled "Write SQL" path they chose deliberately.

---

## Task 2 — Enter numbers and use a formula
**What I tried:** After Chinook was loaded, clicked the "Artist" table in the left sidebar (desktop), then clicked a cell in the resulting datasheet view, typed `10`, pressed Enter, typed `20`, Enter, `30`, Enter, then typed `=SUM(A1:A3)`.

**What I observed:** Clicking "Artist" opened a polished Datasheet view with column headers (ArtistId, Name), sortable, with a "double-tap to edit" instruction. There is no formula bar visible at any point — not before clicking, not after. When I clicked on cell row 1 / ArtistId and typed, the keystrokes landed in the cell and updated the underlying database record (ArtistId 1 became "110"). There is no blank spreadsheet canvas — you are editing live database records by default. The "=SUM(A1:A3)" text was similarly entered into a cell as literal text with no formula evaluation (no Spreadsheet mode was active). To get formula mode you must click the "▦ƒ Spreadsheet" tab button at the top of the table view — this tab is not labelled as formula-capable until you hover it, and its icon (▦ƒ) is cryptic.

Formula discoverability is poor: there is no formula bar, no `=` prompt, no tooltip suggesting formulas exist. The mode-switching tabs (Datasheet / Spreadsheet / RDF) appear only once a table is selected, so a user starting from the welcome screen has no indication the tool has formula support until they click into a table.

**Friction:** No formula bar; no visual cue that `=` starts a formula; confusing that typing into cells edits live DB records without a clear "edit mode" indicator; mode tab labels are icon-heavy and low on text.

**Severity:** major

**Suggestions:** Show a formula bar above the grid (even a simple `=` input) that is permanently visible in Spreadsheet mode. Add a tooltip to the mode tabs. Add an explicit warning or confirmation when direct cell edits will modify database records (the "Datasheet — click a column header to sort; double-tap a cell to edit" hint is the only warning, in grey 12px text).

---

## Task 3 — On a phone
**What I tried:** Mobile (390x844, isMobile/hasTouch). Tapped "▦ Data" in the bottom tab bar, then tapped "Sample database" card, waited for load, then attempted to tap a cell and type.

**What I observed:** Mobile navigation is cleaner than desktop — a bottom tab bar (Editor / Data / Slides / Calendar / Mail / Maps / Backup / Automations) is the primary nav. On the Data welcome screen the five cards stack vertically and fill the width nicely. After tapping "Sample database" and waiting ~6 seconds, the view loaded correctly: left sidebar with TABLES list (collapsed behind a ☰ hamburger), centre pane showing the SQL query + results. The SQL shown on first load is a multi-line 4-table JOIN — the reported "half a page of SQL" problem is real and confirmed. A naïve user on a phone who wanted to "explore" music data is greeted by `SELECT ar.Name AS artist, ROUND(SUM(il.UnitPrice * il.Quantity), 2) AS revenue…` with no explanation of what SQL is or why it is shown.

Tapping a cell (the results table) did trigger an input element — but the input appeared to land in the SQL editor text area rather than in the data cell (the SQL gained `;42` appended to it). The `dw-main` content area had `scrollWidth: 438px` on a 390px viewport, meaning the results grid columns were clipped — the `lines_sold` column was partially off-screen with no hint to scroll right.

The toolbar on mobile has `scrollWidth: 847px` on a 390px screen — only "Open…" and "Sample (Chinook)" and the start of "+ Sheet" were visible. Scrolling the toolbar is possible but there is no visual affordance (no fade-out, no scroll indicator, no "more >" button).

**Friction:** SQL-first landing on mobile is hostile to non-technical users; tap-to-edit routes input into the SQL box; grid columns clip off-screen silently; toolbar overflow hidden.

**Severity:** major (SQL landing + tap routing); minor (toolbar overflow, grid clipping)

**Suggestions:** On mobile, default to Datasheet view on Sample load, not the SQL workbench. Add a right-fade affordance on the toolbar to indicate scrollability. Ensure tap targets in the results grid open a cell-editor overlay, not the SQL textarea.

---

## Overall impression
The Data tool has serious architectural ambition — in-browser SQLite, multiple view modes (Datasheet, Spreadsheet, SQL, RDF), formula support, and a well-designed Chinook demo — but the first-time experience is marred by a silent loading failure that leaves welcome-screen cards unresponsive without explanation, and by an SQL-first landing that assumes SQL literacy. The mobile layout delivers the same full-featured interface on a small screen (no dumbing-down, which is admirable), but the SQL editor as the default view and the clipped grid columns make mobile data work frustrating. A "Loading…" status with a progress indication and a table-browser default landing would move this from "confusing for new users" to "impressive for what it is."
