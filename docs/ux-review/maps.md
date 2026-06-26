# UX Review — Maps
_First-time user, no prior knowledge. Headless Chromium, desktop (1280×800) + mobile (390×844). Map tiles did NOT load in this sandbox environment (OpenFreeMap network requests returned empty canvas throughout all sessions). All judgements about tile rendering are therefore unverifiable from here — I can only confirm the map chrome, controls, and layout._

---

## Top findings

- **[major]** Map canvas is blank on load with zero feedback — no "Loading…" spinner, no "tiles unavailable" message, no placeholder. A first-time user has no idea whether the map is broken, loading slowly, or just needs to zoom somewhere. This is the most pressing usability gap.
- **[major]** The `.toast` element exists in the DOM and registers as `visible: true` (offsetWidth > 0) at all times, even with empty text content. This is the stuck-notice bug: the element never hides, but because its text is empty it shows as a zero-height invisible strip rather than a visible blocker on desktop. On mobile it caused a Playwright tap timeout (element reported visible, zero dimensions, uninteractable). Unclear whether a real notice message would also be stuck.
- **[minor]** The `⛰ 3D` and `🏙 3D buildings` buttons have no affordance explaining the difference between them, nor any prerequisite hint. A normal user would click "3D buildings" expecting visible 3D buildings and receive no confirmation of success or failure (tiles didn't load so this was unverifiable, but no tooltip, no status change beyond button highlight, no guidance text is present).
- **[minor]** The `🥽 XR` button is in the DOM but hidden (`offsetWidth: null`, `visible: false`). It is never reachable. This is either intentional (hidden until conditions are met) or a dead control — either way there is no hint to the user.
- **[minor]** On mobile, the toolbar wraps to three rows: row 1 (hamburger, search, compass, directions), row 2 (basemap dropdown, Pins, 3D), row 3 (3D buildings alone). Import/Export/KML buttons are off-screen to the left (x: -329 to -146) and completely unreachable by scrolling or swiping in the toolbar — they appear to be clipped by overflow:hidden. On mobile these features are effectively inaccessible.
- **[none]** Navigation to Maps is excellent: the 🗺️ Maps icon in the left rail is immediately recognisable, correctly labelled, and the active state highlights clearly. The mobile bottom tab bar follows standard patterns and works well.

---

## Task 1 — Basemap styles

**What I tried:** Opened Maps, looked at the basemap control, then switched between all three options (OSM (raster), Carto Light (raster), Streets (vector · 3D buildings)) using the dropdown.

**What I observed:** The basemap control is a `<select>` dropdown in the top toolbar, positioned clearly. The three option labels are:
- "OSM (raster)" — default
- "Carto Light (raster)"
- "Streets (vector · 3D buildings)"

Switching visually updates the dropdown label and — where verifiable — updates the attribution footer (switching to Carto shows "© OpenStreetMap contributors © CARTO"; switching to Streets showed no tile change since tiles were unavailable). The dropdown label itself changes immediately. No toast or confirmation message fired when switching styles. Nothing says "demo" anywhere; that is not a problem here.

**Friction:** The labels include technical renderer suffixes in parentheses — "(raster)" and "(vector · 3D buildings)" — that will be opaque to most office-tool users. "OSM" is meaningless to a non-mapper. A naive user cannot tell what visual difference to expect before clicking. There is no preview thumbnail, no tooltip, and no hover state on the options. After switching to a new basemap, the blank canvas gives no confirmation the switch worked.

**Severity:** minor

**Suggestions:** Replace or supplement "OSM (raster)" with something like "Standard map", "Carto Light (raster)" with "Light/minimal". Keep the technical names as secondary text or a tooltip for power users. Consider a brief "Switched to [name]" toast on selection.

---

## Task 2 — 3D buildings

**What I tried:** Clicked the `⛰ 3D` button (terrain tilt), then clicked `🏙 3D buildings`. Observed state changes and waited up to 10 seconds for any visible notice or toast.

**What I observed:** Both buttons exist and are not disabled. Clicking `⛰ 3D` turns it highlighted (dark background, confirmed from screenshot `maps-04-after-3d-click.png`). The scale bar updates from "1 km" to "500 m" indicating a zoom/tilt change occurred, and the attribution footer gains "Elevation: Mapzen/AWS Terrain Tiles" confirming the terrain layer activated. So the tilt feature does fire. Clicking `🏙 3D buildings` similarly highlights that button. The `.toast` element's `visible` flag was `true` throughout but contained no text — so either no notice fired, or the notice fired with empty text. After 10 seconds the state was unchanged: no auto-dismiss occurred and no text appeared in the toast. This is consistent with the toast being stuck in a permanently-visible zero-height state rather than carrying a real message.

Tile rendering of actual 3D buildings was not verifiable (tiles never loaded in the sandbox).

**Friction:** No prerequisite warning is shown if 3D buildings requires a specific basemap first (the "Streets (vector · 3D buildings)" label implies a dependency but clicking the button on "OSM (raster)" produces no feedback at all). The two separate controls — `⛰ 3D` (terrain tilt) and `🏙 3D buildings` (extruded buildings) — are not explained. A user expecting "3D buildings" from either button gets silence.

**Severity:** major (the toast/notice plumbing appears broken: it is always-present in DOM, never carries text, never dismisses — so any notice the app tries to show would silently fail)

**Suggestions:** Fix the toast element so it is `display:none` when empty and actually shows text when fired. Add a tooltip or inline note on `🏙 3D buildings`: "Requires Streets (vector) basemap." Consider merging or reordering the two 3D controls to imply a natural sequence.

---

## Task 3 — Pins/Places on desktop and mobile

**What I tried (desktop):** Clicked `📍 Pins`. Observed left panel. Then checked whether "Places" and "Pins" are the same concept or two different things, and looked for an events overlay. Examined mobile layout for the same controls.

**What I observed:**

- Desktop: Clicking `📍 Pins` opens/reveals the left sidebar showing "SAVED PLACES" with Import / Export / KML buttons and the message "No saved places yet. Search, or long-press the map, then 'Save place'." This is the only visible "Places" concept — the sidebar and the Pins button are the same feature. The instruction text is clear and friendly. Import/Export/KML are accessible in the sidebar and make the feature scope obvious.
- There is no "events overlay" visible anywhere in the UI. The task prompt mentioned it but no such control exists in the visible interface.
- The `🥽 XR` button is present in the DOM but hidden; it cannot be found or interacted with by a user.

**Mobile:** The basemap dropdown and Pins / 3D / 3D buildings buttons all render in the mobile layout and are within viewport bounds. However, Import / Export / KML buttons are positioned at x: -329 to -146, entirely off the left edge of the 390px viewport, and appear to be clipped by overflow — they cannot be scrolled to. On mobile, if a user wanted to import a KML file or export their saved places, they have no accessible path to these controls. The bottom tab nav (Editor / Data / Slides / Calendar / Mail / Maps / Backup / Automations) is clean and well-spaced at mobile scale; Maps icon is reachable.

**Friction:** "Pins" and "Saved Places" refer to the same thing but use different words — the button says "Pins", the panel header says "SAVED PLACES". Minor consistency issue. The instruction to "long-press the map" is correct gesture language for mobile but may not be obvious on desktop (where right-click or long-click is less conventional). The Import/Export/KML control overflow on mobile is a hard blocker for those features on phones.

**Severity:** major (Import/Export/KML inaccessible on mobile); minor (Pins/Places naming inconsistency); none (desktop Pins flow is clear)

**Suggestions:** Fix mobile toolbar overflow so Import/Export/KML scroll into view or move them into the hamburger menu on small screens. Align "Pins" button label with "Places" panel header — pick one term. Clarify "long-press" on desktop as "right-click or click-and-hold."

---

## Overall impression

Maps opens instantly, navigates cleanly from the rail, and has a well-structured control bar. The bones are good: basemap switching, terrain, 3D buildings, saved places, routing inputs, and KML import/export are all present and the layout is sensible on desktop. However the blank canvas with zero loading feedback is a jarring first impression — it looks broken even when it might not be. The toast/notice mechanism appears silently non-functional (always in DOM, never dismisses, never shows text), which means the app has no reliable way to communicate errors or confirmations to the user. On mobile the Import/Export/KML controls are clipped off-screen and unreachable, which cuts off a meaningful part of the feature set. These two issues — blank-canvas silence and broken toast plumbing — need attention before the Maps module reads as polished.
