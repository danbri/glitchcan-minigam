# Audit 06 — Second-Pass Corrections & Headless Verification

A deeper, code-level re-read (June 2026, same session) corrected several findings from
the first pass, which had characterized some directories from filenames and READMEs
rather than source. The owner flagged two specific misses — `trees/` and the 3D
Finkiverse map — and both flags were justified. This report records all corrections,
plus results from headless test runs performed in this environment.

## 1. trees/ — not a "data viewer": a five-iteration Bristol game lab

The first audit called trees/ a "Bristol open-data tree inventory viewer; sketch."
Wrong. The 8 files are five distinct builds over a shared dataset:

**The data:** `Trees.csv` — 29 MB, **53,904 trees** from Bristol City Council's
arboriculture open data (62 columns: species, crown dimensions, DBH, risk zones,
planting funder…), in British National Grid coordinates (EPSG:27700, never named),
loaded into **in-browser SQL.js** with hand-rolled BNG→WGS84 conversion.

**Two playable games** (Leaflet + MarkerCluster + Web Audio):
- `index.html` — "**Tesla Dragon: ULTIMATE EDITION**": mobile-first; an emoji dragon
  eats real trees for health (which decays at −0.25 HP/s), earns money, and buys
  autonomous **swarm cars** that wander the map eating trees passively. Procedural
  roar/chomp synthesis, haptics, off-screen dragon pointer, death screen with stats.
- `tree-explorer.html` / `tree-explorer-enhanced.html` — "**MUSK THE DRAGON: Bristol
  Tree Quest**": two-panel layout with a live SQL query editor over the tree database;
  enhanced variant adds cluster-feast mechanics (eat up to 25 trees per click),
  four synthesized sound effects, and explosion animations. A "tree learning" panel
  (click a tree, learn the species) is stubbed.

**Three 3D tank-interface attempts** (Three.js r128, green vector-wireframe aesthetic):
- `bigtrak-mock-ui.html` — "Bristol BigTrak Explorer": drivable tank (body, turret,
  cannon, tracks) over **procedural Bristol terrain** (Clifton ~60 m, Brandon Hill
  ~50 m, harbour valley), 11 hardcoded landmarks, three camera modes
  (follow/FPV/top-down map), HUD with compass/elevation/minimap, touch controls.
- `bristol-fps.html` — minified/code-golfed rework that adds **live OpenStreetMap
  data via the Overpass API** (roads, railways, parks, water, stations) with 24-hour
  localStorage caching and hardcoded M32/A4/Park Street fallback.
- `3dtanky.html` — "Bristol Vector Hunt": the most advanced — **THREE.LOD
  distance culling** (buildings 600 u, major roads 1200 u, minor 400 u), building
  heights inferred from OSM `building:levels` tags with per-type fallbacks, dev panel
  with cache export/import, FPS counter, multi-touch orbit/pinch controls.

**Corrections to the owner's recollection, recorded honestly:** no DEM/LIDAR file is
in the repo — elevation in the tank demos is procedural sine-based topography keyed
to real Bristol locations. If sourced elevation exists, it lives in the **Tankoff**
CodePen (`raVaWBm`, indexed in `codepen-backups/`) or unpushed work. The two game
lineages also use *different* BNG→WGS84 reference points (Queen Square vs city
centre), a latent geo-mismatch bug. No collision detection in any tank build.

## 2. 3D Finkiverse map — "idea only" was wrong

`docs/fink-ring-viz.html` (2,154 lines, committed 2026-01-27 in the same commit as
`3dmap-idea.md`) is a **working Finkiverse map prototype**. It pivots architecturally
from the spec — CSS-3D + SVG instead of Three.js, concentric **rings** per episode
instead of planes, hand-rolled radial layout instead of Graphviz WASM, single layer
instead of Founders/Baseline/Depths tiers — but delivers the substance:

- Episodes as rings; knots as arc segments classified Hub/Entry/Exit/Normal
- Quadratic-Bézier flow paths; cross-episode link beams; real-time knot search
- Stack (3D-perspective carousel with momentum), Flat, and Focus view modes
- **Immersive mode embedding a playable inkjs story player** per selected knot
- Mobile-first: touch gestures, pinch, safe-area insets

Data pipeline the first audit missed entirely: `inklet/tools/fink-graph.mjs` (11 KB
CLI) crawls `.fink.js` files → emits `docs/fink-crawl-report.json` (95 KB) and
`fink-universe-snapshot.json` → ring-viz consumes them. Estimated **60–70%
feature-complete** against the 3dmap spec, production-quality interaction code.

*Correction to this correction (owner feedback):* the prototype is **not unlinked** —
`docs/fink-crawl-report.md` links it as "Episode Ring Visualization", and that link is
emitted by the crawl tool itself (`inklet/tools/fink-crawl.cjs:426`), so it's a
deliberate part of the crawl-report pipeline. The narrower true claim: it isn't
reachable from the landing page, CLAUDE.md, or the FINK player UI.

## 3. Other directories the first pass under-read

| Dir | First-pass call | Corrected reading |
|---|---|---|
| `follyfx/` | "data analysis, research output" | A complete **acoustics research project**: `paper.md` is a full study — PCA of 115 real-world impulse responses (EchoThief), showing raw-waveform SVD spreads variance (31%/10 PCs) while feature-based PCA yields 3 interpretable axes (clarity, brightness, bass) at 85% — with eigen-IR WAVs and analysis plots. Publishable-adjacent; not game-related. |
| `mudslide/` | "single-file isometric crawler" | A ~90%-complete **Three.js isometric adventure**: 10 themed rooms (Overgrown Entrance → Treasure Vault), 4 collectible types with values, 7 enemy movement archetypes (slither/swoop/crawl/float/patrol/bounce), lives + invincibility frames, tap-raycast movement, 200-sprite particle ambience, room portals. Distinct from the `inklet/minigames/mudslider` wrapper. |
| `palace/` | "CRT text adventure sketch" | A ~95%-complete **MOO-style spatial model of Westminster Palace**: 42 rooms / 80+ named exits embedded as JSON, geography after Barry's 1836–68 Principal Floor plan, with genuinely literary room prose ("marble polished by anxiety", "tidal water, the colour of strong tea"). The strongest narrative writing in the repo outside FINK stories. |
| `hat/` | "canvas 2D attractor toy" | Hadley attractor (a=0.25, b=4, F=8, G=1) with **WebGPU compute-shader RK4 integration** (64-particle workgroups, storage buffers) and WebGL fallback; up to 10k particles, per-particle trails, 6 themes, FPS meter. One of only two WebGPU compute users in the repo (with lucid's xpbd-gpu). |
| `fatnet/` | "stub, TF.js implied" | A real **CTRNN in TensorFlow.js**: weight/bias/gain/tau tensors, sigmoid + matMul forward pass, Euler integration in tf.tidy, sparse intra-agent connectivity; agents with sensors/energy/hostiles. Forward-sim only; no training loop. |
| `furbacca/` | "novelty code generator" | A **reverse-engineered Furby protocol tool**: 10-bit commands split into dual 12-quaternary-digit packets with checksums; a 100+ command library (food/event/song/handshake ranges); audio waveform encoder playable at a real Furby; plus an analyzer tab to *decode* captured Furby audio. |
| `plenia/` | "ALife particle sketch" | Faithful **particle Lenia**: Gaussian neighborhood kernel U, growth function G peaked at optimal density, quadratic close-range repulsion R, gradient descent on E=R−G via central differences, spatial-hash O(n) neighbors, all in a Web Worker. Parameters match the published particle-Lenia formulation. |
| `blipblop/` | "sequencer variants" | The standout is `srt-mp3-webaudio.html`: MP3 + SRT subtitle player with a **beat-detection worker** (tempo library inlined as a Blob worker), BPM+offset estimation driving on-beat particle bursts, hue-cycled waveform visualization, and a careful pause/seek state machine. |
| `twinearth/` | "3D earth viewer" | The "twin" is the point: full NASA texture stack (color, 21600×10800 bump, specular mask, night lights, clouds) with a **mirror-world mode** flipping geography east-west for a "familiar yet alien" planet; built as a `TwinEarthComponent` custom element intended as a front-page/game backdrop. |
| `demo/wubwubwub.js` | "audio toy" | A **Lisp-to-Web-Audio DSL**: recursive-descent s-expression reader; evaluator compiling `(sound (osc …) (filter …) (noise :type pink …))` trees into connected AudioNode graphs; white/pink (Voss-McCartney)/brown/perlin noise buffers. ~70% complete. |
| `inklet/minigames/` | listed, not characterized | A real **minigame SDK** (`minigame-sdk.js`): lifecycle contract (onInit with story variables, onPause/onResume, onTerminate, complete(result)) over postMessage; battleboids wrapper reuses `thumbwar/battleboids.html` and auto-detects game end. This SDK is the concrete realization of the variable-sync design in `doc/minigame-variable-sync.md`. |
| `magpie/junk/` | not examined | Honest graveyard, self-documented: fake/broken LISP attempts (JS cross-compiler, assembly with broken subroutine linkage) explicitly superseded by the authentic `elliott4130/lisp4130.asm`. |

## 4. CodePen as a first-class prototyping tier (new finding)

11 pens are indexed in-repo (`inklet/media/shane/minigames.md`; mirrored as an index
in `codepen-backups/`), and the FINK TOC's Experiments menu (`inklet/toc.fink.js:230-263`)
links players to them directly, stating "Most experiments are hosted on CodePen for
rapid prototyping." Several repo features trace to pens (mini-chess, boids, INK+video,
bagend SVGs, ED-209, Tankoff→trees tanks, a mock OAuth login that prefigures the
peer-architecture Auth service). **Content mirroring is currently blocked from this
execution environment** (Cloudflare 403 on all CodePen endpoints incl. `share/zip`;
egress policy blocks archive.org) — `codepen-backups/mirror-codepens.sh` is ready to
run from an unrestricted machine.

## 5. Headless verification results (run in this session)

What could be tested without a browser was tested:

| Check | Result |
|---|---|
| GLSL codegen over **all 119** Lucid scenes (Node, json-loader → json-codegen) | **119/119 pass** (2 scenes contain an unimplemented `customExpr` node that passes through with a warning) |
| WGSL codegen over all 119 scenes (wgsl-codegen) | **119/119 pass** — first systematic exercise of the WGSL path; codegen doesn't crash on any scene (browser shader-compile/render still unverified, per stinkyfish/BUGS.md) |
| Vitest unit suites (lucid-core, xpbd-physics, rig-evaluator, splat-physics, sdf-physics-scene, splat-demo-physics, webgpu-availability) | **160 tests pass**, 1 expected-fail |
| `tests/glsl-codegen.test.js`, `tests/dsl-parser.test.js` under vitest | **Cannot run** — they're written with `@playwright/test` syntax; running vitest across `tests/` collects them and fails 2 files. Framework mixing in one directory; npm scripts route around it, but `npx vitest run tests/` misleads. |
| Playwright browser suites | Blocked in this environment (CDN 403, no local Chromium) — unchanged from Audit 04. |

These results upgrade two Audit 02 findings: the scene corpus is healthy at codegen
level on **both** backends, and the physics/rig math has genuine passing coverage.

## 6. Addendum: trees/ endeavour completed (June 2026, this session)

Following the owner's direction, the missing pieces were built:
- **Real elevation cached in-repo**: `trees/data/elevation-bristol.json(.gz)` — a
  128×128 EU-DEM 25m grid (OpenTopoData) over the 9×9 km BNG box 354000–363000 E /
  169000–178000 N; min 3.1 m (Avon) to 155.8 m. Reproducible via
  `trees/tools/fetch-elevation.mjs`. Verified against known landmarks (Queen Square
  13.6 m, Clifton 86 m, Durdham Down 90.9 m, harbour 9.2 m).
- **Compact tree payload**: `trees/data/trees-bristol.json(.gz)` — 35,893 living
  in-bbox trees, 115 species, built by `trees/tools/build-tree-data.mjs`.
- **Final game**: `trees/tanks-for-the-trees.html` — mobile-first 3D tank defence
  ("Tanks for the Trees — Bristol's Last Stand") over the real DEM with all 35,893
  instanced real trees, the dragon antagonists from the earlier 2D games, virtual
  joystick + auto-aiming turret, synthesized audio, and landmark beacons. Linked from
  the root landing page. The tank-game thread that began with the Tankoff pen and
  three prototype interfaces now has a finished entry.

## 7. Revised cross-cutting picture

The second pass strengthens the first audit's central thesis while softening its
inventory: the repo is even *deeper* than first reported — several "sketches" are
80–95% complete artifacts (palace, mudslide, hat, ring-viz, trees' game loop) — and
the recurring failure mode is not abandonment but **invisibility**: finished work
that nothing links to, documents, or indexes. Given the project's stated origin
(proof-of-concepts pasted from AI chat sessions, each bounded by what one
"improve this whole app" cycle could do), the pattern makes sense: each cycle
produced a working artifact and no surrounding connective tissue. The highest-value
cheap move remains an index that routes readers to what already exists — which the
landing page, the FINK TOC, and CLAUDE.md currently fail to do for roughly a third
of the repo's substance.
