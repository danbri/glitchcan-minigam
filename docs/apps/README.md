# edot — App Documentation & Coverage Baseline

A full, recorded baseline of every app/layer in the edot suite: **features, the side-effecting actions each exposes, user journeys, and how each maps to actual unit-test assertions**. This exists so the planned **command-registry migration across all 11 apps** can proceed without silently dropping behavior — every action that mutates state is enumerated here with a proposed command id.

**How this was produced:** the test-coverage facts are generated from the suites themselves by `magpie/edot/tools/test-inventory.mjs` (708 assertions across 36 suites → `docs/edot/test-coverage.{md,json}`). The per-app docs were written by reading the real source + tests against that coverage; each maps features → assertion labels and flags untested gaps.

## Per-app / per-layer docs

| Area | Doc | Features | Side-effecting actions | Tests cited |
|------|-----|---------:|-----------------------:|-------------|
| Shell & Navigation | [shell.md](shell.md) | 9 | 3 mechanisms (capabilities/bus/menus) | 35 |
| Editor (docs) | [editor.md](editor.md) | 36 | 47 | 185 (editor area) |
| Data | [data.md](data.md) | 30 | 23 | 49 |
| Slides | [slides.md](slides.md) | 13 | 37 | 76 |
| Calendar | [calendar.md](calendar.md) | 14 | 17 | 35 |
| Mail | [mail.md](mail.md) | — | — | 51 |
| Maps | [maps.md](maps.md) | 17 | 18 | 70 |
| Backup | [backup.md](backup.md) | — | 5 | 27 |
| Automations | [automations.md](automations.md) | — | 6 | 10 |
| Projects | [projects.md](projects.md) | 13 | 5 | 15 |
| Groups (XMPP/MIX) | [groups.md](groups.md) | 11 | 8 | 37 |
| Places & Geo (layer) | [places-geo.md](places-geo.md) | — | integration | 42 |
| Feeds & Calendars (layer) | [feeds.md](feeds.md) | — | integration | 32 |

> Counts are approximate (some areas overlap suites); the per-app docs are authoritative.

## Command-registry migration — source of truth

The shell doc identifies **three** current ways a side effect happens; the registry must subsume all three:

1. **Kernel capabilities** (`getKernel().capabilities`) — already string-id'd and the cleanest to promote: `data.addTable`, `slides.addData`, `editor.addData`, `groups.share`, `project.snapshot`, `project.open`.
2. **Bus topics** (`getKernel().bus`) — implicit commands with payloads but no ids: `data:share`, `project:open`.
3. **Menu/toolbar action closures** (`buildMenus` + per-app toolbars) — **the largest surface, and the main migration target**: ~150+ mutating actions across the apps (Editor ~47, Slides ~37, Data ~23, Maps ~18, Calendar ~17, Groups ~8, Automations ~6, Backup ~5, Projects ~5…). These currently have *no stable id, no audit hook, and no programmatic invocation path* — which is exactly why Automations can't invoke them and there's no command palette.

Each app doc's **"Side-effecting actions (command-registry inventory)"** table already assigns a `Proposed command id` to every such action. That set is the migration's work-list.

**Recommended Phase 1** (unchanged): a thin `CommandRegistry` over the kernel; migrate the shell menu bar + one pilot app (Slides has the richest action set at 37); expose `registry.invoke(id)` to Automations; add a ⌘K palette. Then convert app-by-app using these tables.

## Consolidated highest-priority untested gaps

Recorded so the migration (and general hardening) can close them deliberately. Full lists are per-doc under each `### Gaps (untested)`.

- **Editor**: toolbar buttons with no DOM-outcome test — outdent/indent, strike, blockquote, code, removeFormat, RDFa-via-click; **link insertion** DOM outcome (only the module is mocked); component API events (`edot-ready`, `edot-selectionchange`) and methods (`focusEnd`, `markClean`).
- **Slides**: deck title edit, theme change, per-slide background, layout change, bold/italic/bullet/indent buttons, shape colour pickers, several resize handles, export PNG/PDF, mobile rail toggle.
- **Data**: `addColumn`/`rename` (no UI), file-upload import paths, `#CIRC!` detection, new-folder/delete UI (blocked by `window.prompt` in headless).
- **Mail**: reply/forward pre-fill, saveDraft (all adapters), archive/delete/star/move UI, keyboard shortcuts, empty-inbox zero-state, attachments.
- **Maps**: rendered tile pixels, 3D terrain/building render, XR session, drop-marker contextmenu, geolocation, named-endpoint routing, KMZ inflate (unverifiable headless — flagged, not silently skipped).
- **Calendar**: desktop Title focus + Day-view button (UX-flagged), live CORS subscribe, multi-alarm, OS notifications, "+N more" overflow.
- **Backup**: restore/delete/select-backend UI, missing-passphrase guard, validation strings; **no local export exists at all**.
- **Automations**: interval trigger, data-share reactive fire, localStorage survival across navigation (the UX-flagged run-log loss), enabled toggle.
- **Projects**: DEFLATE read path, multi-table snapshot (only the active table is captured), `places[]`/`calendar[]` manifest hydration (declared, not wired), open-from-file UI.
- **Groups**: live federated MIX session (no server/credentials — handshake logic itself is unit-tested), `leaveChannel` UI, real-server stanza shapes, channel-binding SCRAM-PLUS.
- **Places/Geo**: GeoNames provider entirely, progressive `onUpdate` paint, `.value` setter pre-upgrade, derive-places CLI flags.
- **Feeds**: live CORS fetch, RRULE expansion via the feeds surface, malformed-XML/unknown-format error branches.

---
_Generated baseline — re-run `node magpie/edot/tools/test-inventory.mjs` after adding tests to refresh `docs/edot/test-coverage.*`, and update the relevant app doc's coverage table._
