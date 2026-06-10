# Fable Audit — Repository-Wide Review (June 2026)

A line-by-line audit of the glitchcan-minigam repository: every substantive endeavour,
its documented plans versus what was actually coded, plus dependencies and spinoffs.
**No code was changed as part of this audit** — these reports describe the state of the
repo as found on branch point `59a2eb3` (master, June 2026).

## Reports

| Report | Endeavour | Scope |
|--------|-----------|-------|
| [01-fink-inklet.md](01-fink-inklet.md) | FINK / Inklet interactive fiction | `inklet/` (249 files), validation tooling, story files, FINK docs |
| [02-lucid-sdf.md](02-lucid-sdf.md) | Lucid SDF rendering | `lucid/` (386 files), Mayfly/Stinkyfish backends, scenes, ABCD Parliament, `yeti/` |
| [03-minigames-inventory.md](03-minigames-inventory.md) | Minigames & experiments | All 31 game/experiment directories, landing-page cross-reference |
| [04-infrastructure-ci-testing.md](04-infrastructure-ci-testing.md) | Infra, CI/CD, testing | `.github/workflows/`, `tests/`, Playwright, governance docs, repo hygiene |
| [05-docs-worknotes-data.md](05-docs-worknotes-data.md) | Docs, worknotes, data corpora | `worknotes/` (113 files), `docs/`, `doc/`, `data/`, `datasets/`, idea docs |
| [06-deep-dive-corrections.md](06-deep-dive-corrections.md) | **Second-pass corrections** | Code-level re-read: trees/ Bristol game lab, Finkiverse map prototype, 12 directory re-gradings, headless test results, CodePen tier |

## Headline Findings

### Documentation drift is the single biggest problem
The repo's flagship doc, `CLAUDE.md`, describes a FINK production player
(`inklet/inklet5.html`) **that does not exist on disk**. The actual production player is
`inklet/finkapp/index.html` — a substantially larger, more capable system (15+ modules
including minigames, audio, foley, dev panel) than anything CLAUDE.md describes. Several
story files referenced across docs (`hampstead1.fink.js`, `bagend1.fink.js`,
`toc-simple.fink.js`, `jungle2.fink.js`) also do not exist; their unsuffixed
counterparts do. The code is generally *ahead* of the documentation, not behind it.

### Promised-but-never-built (plans with zero implementation)
- **fink-audit dashboard** (`fink-audit/` folder, `--report` flag, GitHub Action) —
  marked "Phase 2 IN PROGRESS" in CLAUDE.md; 0% implemented.
- **Peer architecture** (`PEER_ARCHITECTURE_DESIGN.md`, 27 KB) — design only; no
  peer/networking code anywhere in the repo.
- ~~3D Finkverse map — idea only~~ **CORRECTED in Audit 06**: `docs/fink-ring-viz.html`
  is a working 2,154-line prototype (architectural pivot to CSS-3D/SVG rings, with an
  embedded playable story player), fed by a crawl pipeline
  (`inklet/tools/fink-graph.mjs` → `fink-crawl-report.json`) and linked from the
  generated crawl report (`fink-crawl.cjs:426`).
- **Save/load, achievements, IMPORT/EXPORT enforcement** — recommended in
  `worknotes/gamedev-review.md`; not implemented (a namespace preprocessor exists but
  is not wired into the pipeline).

### Built-but-undocumented (code with no plans)
- `inklet/finkapp/` itself — the real production player.
- `yeti/` — a parametric creature lab (53-parameter quadrupeds, SDF rendering,
  deliberately zero dependencies on `lucid/`).
- `magpie/` (454 files, 61 MB) — Elliott 4130 mainframe emulator with LISP 1.5 and 133
  passing tests, FOAF/Kanren RDF logic, and a 128-page digitization of a 1951 Paris
  conference. Serious research work, invisible from the landing page and main docs.
- Roughly 14 playable-but-unlisted experiments (mudslide, palace, plenia, hat, pups…).

### Count/version mismatches between docs and code
- Lucid: docs claim "117 scenes"; **119 scene JSON files** exist but only **79 are
  indexed in `lucid/scenes/toc.json`** — ~40 scenes are orphaned from the TOC.
- GridLuck: HTML says **v1.2.0**; CLAUDE.md describes completed **v1.3.0** features.
- FINK modules: docs say 6; `finkapp/` has 15+.

### Verification gaps (claimed-working but untested)
- **Stinkyfish (WebGPU)**: its own `lucid/stinkyfish/BUGS.md` states WGSL fixes were
  never visually verified — headless Chromium has no WebGPU, so all "visual
  verification" only ever exercised the WebGL (Mayfly) path.
- **Shane Manor**: compilation fixed, gameplay never tested (`shane_todo.md`).
- **Ukrainian story / Help menu**: known runtime errors, still open.
- The January 2026 review campaign in `worknotes/` (6 structured reviews, 79
  screenshots) identified issues with no traceable follow-up commits.

### Infra is in good shape, with one pending step
GitHub Pages deploy uses modern v4 actions; 5 active workflows including a tiered Lucid
test pipeline and an LLM-CI bot. A complete Playwright E2E suite (150+ assertions, 4
device profiles) exists, but its workflow lives at root as `e2e-tests.yml.template`
and was never moved into `.github/workflows/` (blocked by App `workflows` permission;
documented in `WORKFLOW-SETUP.md`). The Lucid "pre-commit hook" for Recent Changes is a
manual script — no hook is installed.

## Method

Audit performed by five parallel exploration passes (FINK, Lucid, minigames, infra,
docs/data), each reading code and docs directly. Load-bearing claims (missing files,
scene counts, workflow inventory, version strings) were independently re-verified
against disk before being recorded here. Where a subsidiary doc contradicts CLAUDE.md,
both are cited.

A **second, code-level pass** (Audit 06) was run after the owner flagged that the
first pass under-read several directories. It read main source files in full,
corrected ~12 characterizations (notably `trees/` and the Finkiverse map), indexed
the CodePen prototyping tier into `codepen-backups/`, and ran every headless-runnable
check: 119/119 scenes pass GLSL **and** WGSL codegen; 160 unit tests pass. Where 06
contradicts reports 01–05, **06 is authoritative**.
