# Audit 05 — Documentation, Worknotes, and Data Corpora

## 1. worknotes/ (113 files): a January 2026 review campaign, frozen in amber

The directory is not a design journal — it is the artifact dump of a systematic,
multi-perspective review of FINK Player (finkapp) conducted around 2026-01-22:

**Six structured review reports:**

| Review | Verdict | Key findings |
|---|---|---|
| `connections-review.md` (627 lines) | Validating | Diamond→mugging→Hampstead path, fraud easter egg, world-between-worlds hub, minigame state transfer — all deliberate and working |
| `fun-review.md` | 6.5/10 | Strong Hampstead writing, working gems minigame; Maple Hollow 404, Shane Manor WIP, navigation loops |
| `playability-review.md` | 7.5/10 | All major paths pass; sparse breadcrumb, confusing ZX splash, hidden minigame exit |
| `usability-review.md` | 12 issues | Critical resource 404s; invisible breadcrumb; no loading progress |
| `webdev-review.md` (351 lines) | Tech debt | No CSP, `user-scalable=no` (a11y violation), 15 unminified JS files, missing ARIA |
| `gamedev-review.md` (279 lines) | Architectural | Praises delta-sync + FinkFoley; flags app/-vs-finkapp duplication; missing save/load, IMPORT/EXPORT enforcement, achievements |

**Supporting assets:** 79 dated screenshots (fraud sequence, fun, playability-v2,
usability at 320/375/768 px), 6 Playwright test scripts (`fink-diamond-explore.mjs`,
`playability-test*.mjs`, …), 2 JSON findings exports, raw console logs, and an
`index.html` artifact viewer.

**The gap:** the reviews are high-quality audits with **no traceable follow-up** — no
issues filed, no fix commits linked, test scripts never folded into the CI suite. They
function as a regression baseline, not a development driver. Their findings remain the
best current statement of FINK Player's open defects.

## 2. doc/ and docs/ (non-FINK-spec content)

| File | Status |
|---|---|
| `doc/minigame-variable-sync.md` | ✅ Implemented (delta-based minigame↔story sync, lives in `fink-minigames.js`) |
| `docs/glossary.md` | ✅ Current, authoritative FINK terminology |
| `docs/fink_link_cache_nav.md` | ✅ Implemented (two-part hash deep links, localStorage) |
| `docs/fink-linking-spec.md` (19 KB) | ⚠️ Partially implemented (cross-domain loading underspecified vs reality; URL truncation bug still open) |
| `docs/fink-crawl-report.md/.json`, `fink-universe-snapshot.json` | ✅ Current generated inventories |
| `docs/finkapp-ideas.md` | Archival — catalogs the *old* elegant app/ UI vs new retro finkapp UI; proposes a hybrid that wasn't pursued |
| `docs/3dmap-idea.md` | ⚠️ **Prototyped with an architectural pivot** (corrected by Audit 06): `fink-ring-viz.html` implements the substance as CSS-3D/SVG rings with embedded story player; the Three.js/Graphviz/multi-tier spec itself unbuilt |
| `docs/gpt_notes_on_ui_from_screenshots_only.md` | Design philosophy ("playable document"); influence visible but no direct artifact |
| `docs/hampstead-story-graph-analysis.md`, `shane-manor-infographic.html` | One-off analysis/visualization artifacts |
| `docs/fink-ring-viz.html` | **Working Finkiverse map prototype** (2,154 lines — see Audit 06 §2), fed by `inklet/tools/fink-graph.mjs` → `fink-crawl-report.json`; unlinked from any index |
| `docs/skills/selfplaytest_browser.md` | Playwright self-playtest guide — matches the worknotes scripts |
| `docs/wc/yeti-wc-demo.html` | Web-component demo tied to yeti/ |

## 3. Data corpora: present but orphaned

| Corpus | Contents | Connected to code? |
|---|---|---|
| `data/kgx/finkg.nq` | N-Quads RDF export of FINK story structure | Loosely — kgx/ demos SPARQL but doesn't consume this file in any pipeline |
| `datasets/imagesnippets-*.ttl/.nq` (~17 MB) | ImageSnippets SPARQL dump (Dec 2024), LIO/Schema.org/Getty/Wikidata vocabularies, attribution README | **No** — kgx/ uses its own 10-image sample; these dumps are unreferenced |
| `image_metadata.json` (root) | Schema.org ImageCollection for ~50 inklet/villaged story images | Metadata only; no consumer |
| `demo/wubwubwub.*` | Standalone Web Audio toy | Standalone |

There's an evident semantic-web thread (kgx, foafng, finkg.nq, ImageSnippets,
schemoids' theme) that has never been pulled into a single documented endeavour.

## 4. Idea docs vs implementation — the ledger

**Documented, never coded:**
- ~~3D Finkverse map~~ — moved to "documented AND coded" per Audit 06 (`fink-ring-viz.html`)
- Peer/multi-agent collaborative editing (`PEER_ARCHITECTURE_DESIGN.md`, 27 KB)
- Save/load, achievements (gamedev-review recommendations)
- evogame LLM game-breeding loop (`evogame/BRIEF.md` — spec only)
- fink-audit dashboard (CLAUDE.md Phase 2)
- finkurls.md URL-truncation fixes (three options proposed, none chosen)

**Coded, never documented (top-level):**
- `inklet/finkapp/` as the real player (see Audit 01)
- `magpie/` research archive — 61 MB incl. Elliott 4130 emulator with 133 tests
- `yeti/` creature lab
- ~15 minigame directories with no README or glossary entry
- `follyfx/` (43 files of research/report output)

**Documented AND coded (healthy):**
- minigame variable sync; hash deep-linking; FINK glossary/spec (glitchcanary.md);
  ABCD Parliament; Lucid tiered testing; sandbox security model

## 5. Cross-cutting observation

The repo's documentation culture is strong at two ends — *policy/incident lore*
(CLAUDE.md's hackparsing and sandbox rules) and *post-hoc review* (worknotes) — but
weak in the middle: no living index that says what each endeavour is, where its
canonical code lives, and what state it's in. That's the niche this fable-audit set
of reports is meant to fill.
