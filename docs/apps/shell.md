# Shell & Navigation

`magpie/edot/index.html` is the single-page host for the entire edot office suite. It owns the top bar (brand + menu bar + login chip), the navigation rail, and the central stage where app views are mounted on demand. Eleven apps are registered in a static `APPS` array; the shell lazy-loads each one the first time it is navigated to and re-uses the mounted element thereafter. The same file wires the kernel (bus + capabilities), handles deep-link hash routing, registers the Service Worker, and manages the special Workspace tri-pane view.

---

## Features

- **Single-DOM app mount** `[stable]` — `ensureView(id)` creates one `<section class="view">` per app, lazy-loads the ES module and custom element, injects scoped CSS, and hides/shows sections as the user navigates. A `switching` flag plus a `pending` queue prevent concurrent mounts (relevant for heavy loads like SQLite-WASM).

- **CSSOM CSS scoper** `[stable]` — `injectScoped(href, scope, key)` fetches each app's stylesheet, parses it into a throwaway `<style>` tag, rewrites every selector through `scopeRule`/`scopeSelector` to be prefixed by `[data-app="<key>"]`, and injects the result. Handles `@media` and `@supports` blocks recursively. Global selectors (`:root`, `html`, `body`, `html, body`) are collapsed to the scope root instead.

- **Navigation rail** `[stable]` — a vertical `<nav class="rail">` rendered from `APPS` at startup; each button sets `aria-current="true"` on the active app and calls `go(id)` on click. On mobile (`max-width: 700px`) the rail reflows to a horizontal bottom bar via CSS (`order: 2`, `flex-direction: row`).

- **Mobile bottom-nav** `[stable]` — the rail's mobile reflow is pure CSS; no JS changes. All eleven app buttons remain reachable; `test-shell.mjs` verifies `workspace` and `editor` are visible on a 390px viewport.

- **Context menu bar** `[stable]` — a `<nav class="menubar">` in the top bar is rebuilt on every app switch by `renderMenubar(id)`. The menu structure is returned by `buildMenus(id, el)` and rendered into dropdown `<div class="menu">` elements by `renderItems`. Submenus are fly-out panels positioned at `btn.getBoundingClientRect().right`. Keyboard: `Escape` closes the open menu; click-outside closes via a document-level listener.

- **Workspace tri-pane + subtabs** `[stable]` — when `id === 'workspace'`, `ensureView` builds a special `.wsview` section containing three `.ws-pane` divs (Data / Slides / Editor) side by side. On mobile (`max-width: 700px`) `.ws-subtabs` become visible (CSS `display: flex`) and `setWsPane` shows only the `.active` pane. The workspace is the default landing on desktop; on mobile the shell opens `editor` instead.

- **Deep-link hash routing** `[stable]` — `go(id)` calls `history.replaceState(null, '', '#' + id)` after mounting; a `hashchange` event listener calls `go(location.hash.slice(1))`. Entry hash is honoured at startup: `go(location.hash.slice(1) || (mobile ? 'editor' : 'workspace'))`.

- **Service Worker registration** `[stable]` — registered against `sw.js` on `window load`; silently swallowed on failure. No SW behaviour is tested in the shell suite.

- **Project hydration** `[partial]` — `hydrateProject({ manifest, files })` routes document HTML into `edot-editor`, deck JSON into `edot-slides`, and CSV into `edot-data` inside the Workspace view. It also provides the `project.snapshot` capability so Backup can serialise the live workspace. Hydration depends on component-level APIs (`setContent`, `applyDeckData`, `addCsvTable`) which may be absent if the Workspace has not yet mounted. `test-projects-shell.mjs` covers the happy path (7 assertions) but error-recovery paths (missing component APIs, partial manifests) are untested.

---

## The command surface today (registry migration source-of-truth)

The shell currently exposes app actions through **three distinct side-effect mechanisms**. A command registry must subsume all three.

### Mechanism table

| Mechanism | Examples | Where defined | Migration note |
|-----------|----------|----------------|----------------|
| **Kernel capabilities** — typed named functions `provide`/`invoke` | `project.snapshot` (shell → backup); `slides.addData` (slides); `editor.addData` (editor); `editor.insert` (test stub) | `edot-kernel.js` `Capabilities` class; providers registered via `kernel.capabilities.provide(id, fn)` at module scope in `index.html` and in each app component | Direct in-process call when co-located; cross-tab via `cap:invoke` bus topic. Each capability is already identified by a stable string id — these are natural command-registry entries. |
| **Bus topics** — typed pub/sub events | `data:share` (payload: `{columns, rows, title}`) — shell subscribes and fans out to both `slides.addData` and `editor.addData`; `project:open` (payload: `{manifest, files}`) — shell subscribes and calls `hydrateProject`; `cap:invoke` / `cap:registered` (internal capability bus plumbing) | `edot-kernel.js` `Bus` class; subscriptions set up at module scope in `index.html` (`kernel.bus.subscribe(…)`) | Bus topics are implicit commands with a payload schema but no registry entry. Migration should either lift them into named commands or document them as internal events that commands emit. |
| **Menu action closures** — ad-hoc `action: () => …` closures built fresh by `buildMenus(id, el)` on every `renderMenubar` call | Editor: New, Open file, Export (submenu), Undo, Redo, Bold, Italic, Underline, Clear formatting, Find & replace, Link, Bulleted list, Numbered list, Block quote, Code block, Body text, Heading 1/2, Align left/centre/right; Data: Import file, Export SQLite/CSVs/N-Quads, SQL workbench, New spreadsheet, New table, Load Chinook; Slides: New deck, Open library, Sample decks, Import, Export (edeck/PPTX/ODP/PDF/HTML/PNG); all apps: Open app (submenu switching to any of 11 apps) | `buildMenus` in `index.html` lines 290–376 | Each closure captures `el` (the live custom element) and calls a method directly on it. There is no stable id, no undo record, no audit hook, and no way to invoke the action programmatically (e.g. from a command palette). This is the primary migration target: every closure needs a stable id and should be reachable through a `registry.run(id)` call so the palette, keyboard shortcuts, and tests can all exercise the same path. `test-e2e.mjs` already probes this direction: `"File-menu action flows through run() (audit fired)"` and `"palette runs the command (new doc)"` are in the editor's own suite. |

### Known capability providers (at shell startup)

| Capability id | Provider | Consumer(s) |
|---------------|----------|-------------|
| `project.snapshot` | shell (`index.html`) | `edot-backup` |
| `slides.addData` | `edot-slides` component | shell `data:share` handler; automations |
| `editor.addData` | `edot-editor` component | shell `data:share` handler |

Additional capabilities (`editor.insert`, `editor.insertTable`, etc.) are provided by app components after they mount; the shell does not enumerate them at startup.

---

## User journeys

1. **Land and orient** — User opens `index.html` (no hash). On desktop, `go('workspace')` fires: the shell mounts the tri-pane Workspace (Data + Slides + Editor), updates the rail highlight, sets `document.title` to `edot — Workspace`, and renders the generic menu bar (View + Help only). On mobile, `go('editor')` fires instead and the rail appears at the bottom.

2. **Switch apps via the rail** — User clicks a rail button (e.g. Calendar). `go('calendar')` is called; if Calendar has never been opened, `ensureView('calendar')` lazy-loads `calendar-app.js`, creates `<edot-calendar>`, calls `el.init()`, and injects scoped CSS. All other views are hidden; the Calendar rail button gets `aria-current="true"`; `renderMenubar('calendar')` replaces the menu bar with View + Help (generic, since Calendar has no `buildMenus` branch).

3. **Use a menu action** — User switches to Editor, opens the View menu, and selects "Heading 1". `openTop('View', btn)` calls `buildMenus('editor', primaryEl('editor'))` to get fresh items, renders the dropdown, and attaches `action: () => el.setBlock('h1')`. Clicking the item calls `closeMenu()` then `it.action()` — a direct method call on the mounted `edot-editor` element.

4. **Use the Open app submenu** — From any app's View menu the "Open app" item has a submenu listing all 11 APPS with a checkmark on the current one. Selecting any entry calls `go(a.id)`.

5. **Open a project** — User navigates to the Projects app, selects a project template. `edot-projects` publishes `project:open` on the bus with `{ manifest, files }`. The shell's `kernel.bus.subscribe('project:open', …)` handler calls `hydrateProject`, which ensures the Workspace is mounted, then distributes document/deck/CSV content into the three panes and calls `go('workspace')`.

6. **Share data across panes** — Any app (or an automation) publishes `data:share` with `{ columns, rows, title }`. The shell's bus subscriber immediately calls `kernel.capabilities.invoke('slides.addData', p)` and `kernel.capabilities.invoke('editor.addData', p)`, fan-outing to both panes in a single synchronous call (errors are swallowed individually so one failing consumer does not block the other).

---

## Test coverage

### test-shell.mjs (Playwright, 9 assertions)

| Feature | Covered by (suite::assertion label) | Status |
|---------|--------------------------------------|--------|
| Rail + menu bar present | `test-shell.mjs :: single shell: app rail + menu bar present` | Pass |
| Editor menu bar has all 5 tops | `test-shell.mjs :: Editor shows File / Edit / Insert / View / Help` | Pass |
| Menu action executes (View → Heading 1) | `test-shell.mjs :: Editor menu action works (View → Heading 1)` | Pass |
| Data View menu has access/datasheet views | `test-shell.mjs :: Data View menu offers data views (query / spreadsheet / datasheet)` | Pass |
| Data menu action executes (Load Chinook) | `test-shell.mjs :: Data menu action works (load sample DB populates objects)` | Pass |
| Open app submenu switches app + hash | `test-shell.mjs :: View → Open app switches the active app` | Pass |
| Mobile rail includes Workspace | `test-shell.mjs :: mobile: Workspace is reachable in the rail (core surface, not hidden)` | Pass |
| Mobile Workspace shows one pane via subtabs | `test-shell.mjs :: mobile: Workspace opens with sub-tabs and shows one pane at a time` | Pass |
| No page errors (desktop session) | `test-shell.mjs :: no page errors` | Pass |

### test-workspace.mjs (Playwright, 8 assertions)

| Feature | Covered by (suite::assertion label) | Status |
|---------|--------------------------------------|--------|
| Three panes mount | `test-workspace.mjs :: three panes mount: data, slides, editor` | Pass |
| Editor toolbar present in pane | `test-workspace.mjs :: editor pane built its formatting toolbar` | Pass |
| data:share fans out to editor | `test-workspace.mjs :: data share lands in the editor pane as one titled table` | Pass |
| data:share fans out to slides | `test-workspace.mjs :: the SAME share also reached the slides pane` | Pass |
| Geo formula =QID works in data pane | `test-workspace.mjs :: data pane has geo functions (=QID -> Q84)` | Pass |
| Geo formula =GEODISTANCE works | `test-workspace.mjs :: data pane =GEODISTANCE computes (~534 km)` | Pass |
| editor.getContent() returns content | `test-workspace.mjs :: editor.getContent() returns the inserted document` | Pass |
| No page errors | `test-workspace.mjs :: no page errors` | Pass |

### test-kernel.mjs (Node, 18 assertions)

| Feature | Covered by (suite::assertion label) | Status |
|---------|--------------------------------------|--------|
| Bus local pub/sub | `test-kernel.mjs :: bus delivers to a local subscriber` | Pass |
| Bus type isolation | `test-kernel.mjs :: bus does not deliver across types` | Pass |
| Bus unsubscribe | `test-kernel.mjs :: unsubscribe stops delivery` | Pass |
| Bus wildcard `*` | `test-kernel.mjs :: wildcard subscriber sees every type` | Pass |
| Bus cross-tab via transport | `test-kernel.mjs :: cross-tab: sibling receives the message` | Pass |
| Bus no-echo guarantee | `test-kernel.mjs :: no echo: publisher delivers to itself exactly once` | Pass |
| Bus crossTab:false flag | `test-kernel.mjs :: crossTab:false does not cross the transport` | Pass |
| Capabilities has() | `test-kernel.mjs :: has() reports a provided capability` | Pass |
| Capabilities list() / meta | `test-kernel.mjs :: list() includes meta` | Pass |
| Local invoke calls provider | `test-kernel.mjs :: local invoke calls the provider directly` | Pass |
| Local invoke returns result | `test-kernel.mjs :: local invoke returns the provider result` | Pass |
| Unprovide removes capability | `test-kernel.mjs :: unprovide removes the capability` | Pass |
| Invoke with no provider throws | `test-kernel.mjs :: invoke with no provider and no bus throws` | Pass |
| Remote invoke over bus | `test-kernel.mjs :: remote invoke runs the provider on the sibling tab` | Pass |
| Remote invoke returns undefined | `test-kernel.mjs :: remote invoke returns undefined (fire-and-forget)` | Pass |
| Kernel.index works | `test-kernel.mjs :: kernel.index works` | Pass |
| Kernel.bus works | `test-kernel.mjs :: kernel.bus works` | Pass |
| Kernel.capabilities works | `test-kernel.mjs :: kernel.capabilities works` | Pass |

### projects-shell integration (test-projects-shell.mjs, 7 assertions)

| Feature | Covered by (suite::assertion label) | Status |
|---------|--------------------------------------|--------|
| Projects app reachable from shell | `test-projects-shell.mjs :: Projects is reachable from the shell and shows templates` | Pass |
| Project hydrates editor pane | `test-projects-shell.mjs :: template doc hydrated into the Editor pane` | Pass |
| Project hydrates slides pane | `test-projects-shell.mjs :: template deck hydrated into the Slides pane` | Pass |
| Project hydrates data pane | `test-projects-shell.mjs :: template table hydrated into the Data pane` | Pass |
| project.snapshot produces manifest | `test-projects-shell.mjs :: snapshot produces a manifest with a document and a deck` | Pass |
| project.snapshot bundles files | `test-projects-shell.mjs :: snapshot bundles the document and deck files` | Pass |
| No page errors | `test-projects-shell.mjs :: no page errors` | Pass |

### Gaps (untested)

- **Service Worker** — registration path exercised but no test verifies caching behaviour, offline load, or SW update lifecycle.
- **Deep-link hash on entry** — `go(location.hash.slice(1))` at startup is not tested with a pre-set hash; tests always start from bare URL.
- **hashchange event** — navigating by manually changing the URL fragment is not covered.
- **CSSOM scoper edge cases** — `@keyframes`, custom properties, `:root` variable declarations, and selector-less at-rules pass through the `cssText` fallback branch; no test exercises these.
- **Pending/queue mechanism** — the `switching`/`pending` guard in `go()` (drops concurrent mount requests, honours the latest) is not tested.
- **Mobile menu bar** — `test-shell.mjs` checks the rail on mobile but does not open or interact with the menu bar at 390px width.
- **Slides-app menu actions** — `buildMenus('slides', el)` branch is not exercised by any shell test (no assertion for New deck, Open library, Export submenu, etc.).
- **Calendar / Mail / Maps / Backup / Automations / Groups menu bars** — all fall through to the generic branch (`{ View: [sw(id)], Help: help }`); no test opens their View menu.
- **Error recovery in hydrateProject** — try/catch branches for missing `setContent`, `applyDeckData`, `addCsvTable` are not covered.
- **Login chip integration** — `<edot-login-button>` is rendered in the top bar but the shell suite does not assert on auth state changes affecting the shell UI.
- **`workspace.html` standalone entry point** — tested separately in `test-workspace.mjs` (which targets `workspace.html`, not `index.html`); the in-shell Workspace pane is tested only at the mount level (three panes, subtabs on mobile).

---

## Known issues

- **View menu label is misleading for Editor** — the Editor's "View" menu contains block format commands (Body text, Heading 1/2) and alignment (Align left/centre/right). These are formatting/paragraph-level actions, not view-mode toggles. The label would more accurately be "Format". This is the same pattern as the Data app's "View" menu offering "SQL query workbench" and "New spreadsheet" — in both cases the menu is named "View" but acts as an application-mode switcher or format picker.

- **Workspace orientation (desktop vs. mobile split point)** — the tri-pane side-by-side layout collapses to single-pane subtabs at `max-width: 700px` in `index.html` (the shell's embedded Workspace), but `workspace.html` (the standalone page) uses `max-width: 900px`. The two entry points have different breakpoints for the same conceptual layout.

- **`buildMenus` reconstructed on every `openTop` call** — each time the user opens a top-level menu, `buildMenus(currentApp, primaryEl(currentApp))` is called again and closures are recreated. `primaryEl` returns `null` if the view hasn't mounted yet, so menus opened before a view is ready silently produce no-op actions (the `el && el.method?.()` optional-chain pattern in most items handles this, but the Data `Export SQLite database` item uses `el.exportDb?.()` which passes silently with a null `el`).

- **Slides menu bar is minimal** — the Slides `buildMenus` branch has no Edit menu (undo/redo is exposed only through the Slides component's own toolbar, not the shell menu bar). Insert, Format, and Arrange actions are also absent from the shell menu bar for Slides.

- **`sw.js` registration is unconditional** — the shell registers the Service Worker on every page load. There is no cache-busting or version-checking mechanism visible in `index.html`; stale SW behaviour on deployment is a potential issue.
