# UX Review — Shell & Navigation
_First-time user, no prior knowledge. Headless Chromium, desktop (1280×800) + mobile (390×844 iPhone UA)._

---

## Top findings

- **[major] Workspace is not a dashboard — it renders three apps side-by-side with no explanation.** On first load, the screen shows Data, Slides, and Editor panels simultaneously. A new user has no frame of reference for what they are looking at. Clicking the "Workspace" rail button later produces the same tri-panel view, with no welcome text, no "pick an app to start" prompt, and no empty-state explanation.
- **[major] Desktop menus are context-sensitive but there is no visible indication of which app is "active."** On first load the top bar shows only "View" and "Help." The full File/Edit/Insert menu bar appears only after clicking an individual app in the rail — and only for apps that have one (Editor, Slides). There is nothing in the UI that tells a first-timer they need to navigate to an app first to see its menus.
- **[minor] The "View" menu in Editor context is misleadingly labelled — it contains paragraph styles and alignment options, not view/zoom controls.** Items shown: Body text, Heading 1, Heading 2, Align left, Align centre, Align right, Open app. Calling this "View" is a naming mismatch with the user's expectation (hide/show panels, zoom level, etc.).
- **[minor] Maps loads blank (no tiles) in the headless environment, though the shell and controls render correctly.** The console logs tile-fetch failures from openstreetmap.org. A real user on a live network would not see this, but the empty grey canvas gives no feedback or error message that would help a user understand what happened. The "No saved places yet. Search, or long-press the map, then 'Save place'." sidebar text is the only orientation aid.
- **[minor] Mobile: the bottom nav bar is small (icon-only, ~32px wide per item) and "Workspace" is hidden off the left edge at 0px left — effectively unreachable by tap.** All other items (Editor through Automations) fit within 390px width, but Workspace appears at left=0, right=0, which means it has zero rendered width on mobile and cannot be tapped.
- **[none] Sign-in flow is clear and complete.** Clicking "Sign in" opens a dedicated "edot accounts" page listing all OAuth providers (Google, Microsoft, Okta, Auth0, Keycloak, GitLab, Amazon Cognito, Salesforce, Apple, Yahoo, PayPal) with a "← Back to editor" escape link. Clean and usable. Some providers show a warning triangle (Apple, Yahoo, PayPal) with no tooltip or explanation visible on screen.

---

## Task 1 — "I just landed. Where am I, what is this, and what do I do first?"

**What I tried:** Navigated to the URL and observed the initial screen without clicking anything.

**What I observed:** The page title in the browser tab reads "edot — Workspace." The top-left corner shows a brown square emoji (🟫) and the text "edot" — this is the entire logo. The top bar lists "Workspace · View · Help" and a "Sign in" link. The main content area is split into three columns: the left column shows the **Data** app start screen (orange "Data" heading, five action tiles — Open a file, Sample database, New spreadsheet, New table, Write SQL); the middle column shows a **Slides** panel with slide thumbnails, a "Untitled deck" name field, and editing controls; the right column shows the **Editor** app with a formatting toolbar and a "Start writing…" empty canvas. A narrow vertical rail on the far left has icon-buttons for Workspace, Editor, Data, Slides, Calendar, Mail, Maps, Backup, and Automations.

The tri-panel layout is immediately disorienting. There is no onboarding text, no "welcome to edot," no explanation of what edot is. A first-timer sees three different toolbars from three different applications simultaneously and has no obvious entry point. The Data column is widest and has the most explanatory prose, so the eye is drawn there first — but the Slides editing UI in the middle and the text editor on the right add clutter with no context.

**Friction:** Moderate-to-high. There is nothing to tell me this is an office suite, what apps are available, or which one to try first. The simultaneous display of three apps reads as a broken layout rather than intentional multi-pane design.

**Severity:** major

**Suggestions:**
- Make "Workspace" a real start page: a dashboard of app tiles with short descriptions (like the Data empty-state cards, but for every app), or at minimum a "pick an app" landing view.
- Show only one panel at a time unless the user has explicitly opened multiple. The multi-panel default is Workspace's current behaviour but it reads as a layout bug.
- Add a tagline below "edot" in the header — something like "Your private office suite, no cloud required" — so visitors know what they are looking at before clicking anything.

---

## Task 2 — "I want to move between the different tools and find the menus."

**What I tried:** Clicked each rail button in turn (Workspace → Editor → Data → Slides → Calendar → Mail → Maps → back to Workspace); opened File, View, and Help menus from within Editor; tried clicking "Sign in."

**What I observed:**

**App switching works well once discovered.** Each rail button instantly and cleanly replaces the main content area with that app's UI. The active app is highlighted in the rail with a brown background and white icon. The top bar app name updates ("edot · Editor", "edot · Calendar", etc.) to confirm the switch. Each app has a sensible empty-state or default view:
- **Editor:** blank canvas, "Start writing…" placeholder, full formatting toolbar — clean and immediately usable.
- **Data:** welcoming tile grid with five labelled options — the clearest empty-state in the suite.
- **Slides:** pre-loaded with "Untitled deck" (2 slides already present) — slightly confusing because it looks like someone else's work.
- **Calendar:** full monthly calendar for June 2026, sidebar with "My Calendar" and subscribe/import options — polished and functional-looking.
- **Mail:** "edot mail" header with Compose button, empty inbox ("Select a message to read.") — clear but bare.
- **Maps:** search bar and routing fields render correctly; map tiles failed to load (console errors: OSM tile 403s in the sandboxed environment), leaving a blank grey canvas with "No saved places yet" sidebar text.

**Menus:** The File/Edit/Insert/View/Help bar appears only in Editor and Slides — it is absent in the top-bar of Data, Calendar, Mail, and Maps (those show only "View" and "Help," or in Mail's case just "View · Help"). In Editor, the menus work:
- **File:** New (Ctrl+N), Open file… (.docx/.md/.html/.odt/.rtf), Export ▶ (submenu). Short and clear.
- **View:** Contains Body text / Heading 1 / Heading 2 / Align left / Align centre / Align right / Open app ▶. This is a paragraph-formatting menu, not a view menu — the name is wrong.
- **Help:** "About edot" and "Source on GitHub." Minimal but honest.

**Returning to Workspace:** The Workspace rail button always works, but returns to the confusing tri-panel state rather than a dashboard.

**Friction:**
- The rail is the right pattern but is never explained — a user must discover by trial that clicking icons switches apps.
- App-specific menus (File/Edit/Insert) disappear when not in an app that has them; this contextual hiding is not signalled anywhere.
- "View" menu naming inconsistency (paragraph styles ≠ view controls) will confuse anyone who reads menus before clicking.

**Severity:** minor (switching itself works; friction is in discoverability and naming)

**Suggestions:**
- Add a tooltip or short label to the rail on first visit (or at least ensure `title` attributes are set — they are, which is good, but hover tooltips are invisible to mobile users).
- Rename the "View" menu to "Format" or "Paragraph" in Editor context.
- Consider keeping the File menu bar visible even when an app doesn't use it (greyed out) so users know the pattern exists.

---

## Task 3 — "Same thing on my phone."

**What I tried:** Loaded the page on a 390×844 mobile viewport with touch enabled; tapped Calendar, Data, Slides, and Mail in the bottom nav; observed layout and usability.

**What I observed:**

On mobile the layout is completely different — and better. The app auto-opens to Editor on load, showing a clean single-pane writing surface: menu bar (File / Edit / Insert / View / Help) at the top, formatting toolbar row below it, then the "Start writing…" canvas, then a bottom navigation bar with small icon+label pairs for all apps. There is no confusing tri-panel layout. The single-app view on mobile is actually more user-friendly than the desktop Workspace.

**Bottom nav:** All apps are visible and reachable within the 390px width. The Workspace button measured at left=0 / right=0 in the DOM — it has no rendered width on mobile — meaning it is invisible and untappable. Users cannot return to "Workspace" from a phone. This is likely a layout bug where Workspace is collapsed or hidden in the mobile nav.

**Calendar on mobile:** Full month view renders beautifully in a single column. Month/Week/Day/Agenda tabs and "+ Event" button are all reachable. The sidebar (calendar list, subscribe/import) is hidden — appropriate for mobile.

**Data on mobile:** The start-screen tiles stack cleanly in a single column. The action bar at the top (Open… / Sample (Chinook) / + Sheet) overflows the viewport at 390px — the "+ Sheet" button is visible but items further right (+ Table, SQL) are cut off, accessible only by horizontal scrolling. No scroll indicator is visible.

**Slides on mobile:** Slide list panel is hidden (☰ hamburger to show it). Single slide visible, with formatting controls clipped at the right edge ("→ Inde" for "→ Indent" is cut off in the toolbar). The slide canvas itself renders correctly.

**Mail on mobile:** Inbox shows but "Sign in / alpha" label in the top bar collides with the Compose button — they overlap on narrow screens.

**Menus on mobile (Data context):** File / View / Help are visible in the top menubar at 390px width. File menu tapped and rendered correctly — three items (New, Open file…, Export ▶) fit and are reachable.

**Friction:**
- Workspace is unreachable on mobile (zero-width button).
- Horizontal overflow in Data toolbar with no scroll hint.
- Slides toolbar clips at right edge (minor but looks broken).
- Mail header collision ("Sign in alpha" text overlaps Compose button).

**Severity:** major (Workspace unreachable); minor (toolbar overflow, collision)

**Suggestions:**
- Fix the Workspace button CSS for mobile — likely needs `min-width` or explicit flex sizing in the bottom nav.
- For the Data toolbar overflow: either wrap to a second row, add a scroll indicator, or reduce items. An arrow "›" at the right edge would signal scrollability.
- Mail header: move "alpha" badge below or inside "Sign in" rather than adjacent, to avoid collision.

---

## Overall impression

edot has strong bones: individual apps are clean and functional, app-switching via the rail/bottom-bar is fast, and the Calendar and Editor make an immediately good impression. The main shell-level problem is that "Workspace" — the thing the URL says you're on — does not orient a new user at all; the tri-panel default layout reads as a glitch rather than a feature, and there is no welcome text, tagline, or guided first step anywhere on screen. On mobile the experience is actually more coherent because only one app shows at a time, but the Workspace button being unreachable (zero width) is a functional regression that blocks users from ever reaching the home view on a phone. A first-timer on desktop is likely to be confused for several minutes before discovering the left rail; a first-timer on mobile will never know Workspace exists.
