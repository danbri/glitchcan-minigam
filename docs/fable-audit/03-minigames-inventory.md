# Audit 03 — Minigames & Experiments Inventory

31 directories, from production-grade games to single-file stubs and serious research
infrastructure. 17 are showcased on the root `index.html` landing page; 14 are
unlisted. Everything is static/client-side — no servers, no databases, no auth.

## Full inventory

| Directory | Files | Landing page | What it is | Maturity | Tech / deps |
|---|---|---|---|---|---|
| biomorphs | 25 | no | Dawkins biomorph breeder, faithful JS port of 1993 Pascal (archived in-tree) | Production sketch | ES6, canvas; no deps |
| blipblop | 18 | yes | Audio sequencer/synth, several grid variants | Playable sketches | Web Audio |
| cozyverse | 4 | no | Cozy INK narrative pilots (Maple Hollow) | Early pilots | ink-full.js; ties into inklet TOC |
| credo | 4 | no | iOS 26 Digital Credentials API tests — not a game | Stubs | Web Credentials API, needs iOS beta |
| evogame | 3 | no | LLM-driven game-breeding framework — spec only (`BRIEF.md`) | **Specification, no implementation** | IndexedDB, Playwright MCP (planned) |
| fatnet | 1 | yes | CTRNN agent simulation | Stub | Canvas, TensorFlow.js |
| follyfx | 43 | no | Data-analysis/research output (HTML reports + markdown) | Research output | static HTML |
| furbacca | 6 | no | Furby audio/control-code generator | Playable sketch | DOM UI |
| gencity | 2 | yes | Procedural 3D city; `ed209-parkbot.html` spinoff | Playable | Three.js, Web Components |
| growcircle | 1 | yes | Circle radius/area visual toy | Toy | Canvas 2D |
| hat | 1 | no | Hadley attractor chaos visualization | Playable sketch | Canvas 2D |
| kgx | 10 | no | Oxigraph WASM SPARQL demo over ImageSnippets LIO data | Demo | self-hosted WASM (web_bg.wasm) |
| lightshow | 2 | yes | LED-strip animation simulators | Playable sketches | Canvas 2D |
| magpie | 454 | no | Research archive — see below | Mixed, some production-grade | JS, WASM, image corpus |
| mudslide | 1 | no | Isometric manor crawler with inventory/lives | Playable | Canvas 2D, single file |
| palace | 1 | no | "Forget-Me-Not Palace" CRT text adventure | Playable sketch | Canvas CRT simulation |
| plenia | 2 | no | Particle Lenia ALife sim | Playable sketch | Canvas + Web Worker |
| plotgraph | 1 | yes | Strange & Norrell character graph | Demo | vis-network CDN |
| puppy | 1 | no | ML hand-tracking finger-puppet toy | Playable sketch | webcam + hand-pose ML |
| pups | 1 | no | "Puppy Pop!" particle drag/split toy | Playable | Canvas 2D |
| sandpit | 1 | yes | Pyodide Python sandbox ("Insecure Slop") | Dev tool | Pyodide WASM |
| schemoids | 1 | yes | Asteroids with Schema.org types as enemies | Playable | Canvas 2D |
| speccy | 2 | yes | Early ZX Spectrum experiments (self-described as not working out) | Sketch | Canvas 2D |
| spectro | 11 | yes | Jet Set Willy-style Spectrum platformer, ~42 rooms, ES6 modules, Jest tests | **Production-ish** | Canvas; color-clash emulation |
| thoughtgraph | 1 | yes | Idea/relationship mapper (Falklands example) | Playable sketch | vanilla JS |
| thumbwar | 12 | yes | Touch-physics hub + **GridLuck** + battleboids + minichess | Mixed | Canvas, modular ES6 |
| tokitokipona | 2 | yes | Toki Pona flashcards with emoji hints | Playable | vanilla JS |
| trees | 8 | no | Bristol open-data tree inventory viewer; `bigtrak-mock-ui.html` side-experiment | Sketch | canvas/static |
| tritone | 1 | no | "Diabolus in Musica" tritone synth toy | Playable sketch | Tone.js CDN |
| twinearth | 24 | yes | 3D Earth viewer with texture variants | Playable | Three.js; **54 MB** of textures |
| yeti | 13 | no | Parametric creature lab: 53-param quadrupeds, 6 species, SDF rendering, JSON export/import | Production sketch | ES6; **zero lucid/ deps by design** |

Shared assets: `media/` (**277 MB** — photos, MP4s, `3dgs/` gaussian-splat assets,
`gallery.html` — linked from the landing page). `demo/` holds the standalone
`wubwubwub` Web Audio toy.

## CLAUDE.md claims vs code

| Claim | Verdict |
|---|---|
| GridLuck "v1.3.0" with treasure/keys/synergies/progression complete | **Mismatch**: `thumbwar/gridluck.html` displays **v1.2.0**. Either the HTML version string was never bumped or CLAUDE.md describes uncommitted work. Needs reconciliation. |
| Spectro known issues (guardian collisions, jumping, ESC menus) | ✅ Confirmed in `spectro/README.md`; still open. |
| Spectro "4 rooms" | **Stale** — the implementation has ~42 rooms; the doc was never updated. |
| TokiTokiPona priority "emoji for all dictionary entries" | Largely achieved — working emoji-hint system with embedded dictionary. |

## magpie/ — the hidden research archive (61 MB, 454 files)

Not a game; not on the landing page; barely referenced from top-level docs:

- **elliott4130/** — Elliott 4130 mainframe emulator: 24-bit CPU, NEAT assembly, a
  LISP 1.5 implementation (CAR/CDR/CONS, McCarthy EVAL/APPLY, 3-bit GC with leak
  demo), **133 passing validation tests**, mobile-friendly UI. The most rigorous
  single artifact in the repo.
- **foafng/** — FOAF/RDF + Kanren logic programming workbench (`kanren-rdf.html`),
  PRD spec, SPARQL test subset.
- **parisconf/** — 391 files: 128-page digitization of a 1951 Paris conference with
  French transcriptions, English translations, RDF metadata (`photos.ttl`), concept
  indices. Cultural-heritage preservation work.
- **junk/** — misc.
- `magpie/toc.html` documents all of it well — locally, but invisibly from the root.

## Spinoff relationships

- **speccy → spectro**: failed early experiments kept for reference → full rewrite.
- **thumbwar ⊃ GridLuck**: a substantial modular game (game/renderer/entities/audio
  modules + `gridluck-original.html` backup) living inside the touch-physics
  collection.
- **puppy ↔ pups**: ML hand-tracking vs pure-touch takes on the same toy.
- **gencity → ed209-parkbot**: same wireframe aesthetic, new subject.
- **yeti ← lucid**: data-format sibling, code-independent by explicit design.
- **cozyverse ↔ inklet**: maple-hollow.fink.js is referenced from the inklet TOC and
  currently 404s media at runtime (see Audit 01).

## Landing-page gap

14 directories with working content are not reachable from `index.html`, including
several arguably more polished than listed entries (mudslide, palace, plenia,
biomorphs, yeti, magpie). Conversely no landing-page entry points at a missing
directory. The CLAUDE.md "vapourware in menus" concern applies to the FINK TOC, not
the root page.
