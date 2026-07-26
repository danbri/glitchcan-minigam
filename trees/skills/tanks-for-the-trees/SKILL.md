---
name: tanks-for-the-trees
description: >-
  Work on trees/ — "Tanks for the Trees" and the Bristol scene it runs on: the
  real open-data pipeline (35,893 Bristol City Council trees, a 13MB OSM PBF
  extract, EU-DEM elevation), the BNG↔world coordinate transform, the
  phosphor-vector renderer over vendored three.js, the drive/strategic-map
  modes and AI fleet, and the scripted `host.api` / `window.__tftt` control
  surfaces. Use this when editing trees/*.js or trees/tools/*.mjs, regenerating
  a data layer, placing anything at a real Bristol location, writing a headless
  playtest, or touching the tree dataset. READ THE DATA ETHICS SECTION FIRST —
  this game runs on records about real people's memorial trees, and most of the
  source fields are off-limits by rule.
---

# Tanks for the Trees (`trees/`)

`trees/tanks-for-the-trees.html` + `trees/bristol-scene.js` (~2900 lines) —
a mobile-first phosphor-vector tank defence over real Bristol data. The
`trees/` folder also holds the lineage it came from (Tesla/MUSK dragon games,
`bigtrak-mock-ui.html`, `3dtanky.html`, `fly-bristol.html`,
`bristol-fps.html`, two tree explorers).

**Every claim in this file was checked against the code on 2026-07-26.** Where
a number is stated, the source is named so you can re-check rather than trust.

## 🚨 DATA ETHICS — read before touching the dataset 🚨

This is the highest-stakes rule in the repository and it is not a style
preference. It is also in the root `CLAUDE.md`; it is repeated here because
this is the folder where someone would break it.

The Bristol City Council tree inventory contains `NOTES`, `SPECIES_NOTES`,
`PLANTING_NOTES`, `SPONSORSHIP*` and `PLANTING_FUNDER` fields. **Sponsored
trees are frequently memorial trees planted for people who died.** Those
fields are **OFF-LIMITS for game content** — not as flavour, not as
"weirdness to mine", not as atmosphere.

An assistant once proposed in-game "death notices"/"obituaries" built from
per-tree records. The owner rejected it. That is why the rule is written down.

**What the game payload actually ships**, and it must stay this way —
verified in `trees/data/trees-bristol.json` and `tools/build-tree-data.mjs`:

```
fields: ["easting", "northing", "speciesIndex", "crownWidth_m", "crownHeight_m"]
species: 115 names        trees: 35893        crs: BNG (EPSG:27700)
```

Five numbers and a species name. **Any new field in a game payload needs
explicit owner approval.** If you are unsure whether a dataset field is
usable: ask, do not ship. Note that `build-tree-data.mjs` has a state-machine
CSV parser specifically because `NOTES` fields contain quoted commas and
newlines — the parser must read those columns to skip them correctly, which
is not permission to export them.

## Coordinates — get this right or nothing lands where you think

British National Grid (EPSG:27700) in, world metres out. From
`bristol-scene.js:232-234`:

```js
const WORLD = 9000, E0 = 358500, N0 = 173500, EXAG = 2.4;
// BNG -> world:  x = easting - E0        z = -(northing - N0)
// world -> BNG:  easting = x + E0        northing = -z + N0
```

- **`z` is NEGATED.** Forgetting the minus puts you a mirrored distance north
  of where you meant.
- **World units are metres**, so distances are directly meaningful.
- **`EXAG = 2.4`** is vertical exaggeration, applied in `heightAt()` when
  sampling the elevation grid. **The code is ground truth**: an earlier "1.6×"
  was stale in both this repo's notes *and* a code comment, and it is the kind
  of error that reads as authoritative from two places at once.
- Real landmarks are already tabulated in `bristol-scene.js` around line 1207
  (Clifton Suspension Bridge, Cabot Tower, Christmas Steps, Cabot Circus…) in
  raw BNG — copy the pattern rather than converting by hand.

## The data pipeline — cached in-repo, reproducible offline

`trees/data/` (all gzipped alongside the plain JSON, ~13MB PBF + ~14MB JSON):

| file | source | tool |
|---|---|---|
| `bristol.osm.pbf` | Geofabrik Bristol extract, ODbL, **complete** | — (cached, canonical) |
| `roads/water/greens/fabric/pubs/shops-bristol.json` | derived from the PBF | `tools/derive-layers.mjs` |
| `elevation-bristol.json` | EU-DEM 128×128 grid | `tools/fetch-elevation.mjs` |
| `trees-bristol.json` | Bristol City Council inventory | `tools/build-tree-data.mjs` |

- **`derive-layers.mjs` needs no network** — it reads the cached PBF. The
  older `fetch-roads/water/greens/fabric.mjs` Overpass tools are
  **superseded**; they are kept for provenance and `overpass-api.de` requires
  a real User-Agent if you ever do run one.
- **THE THINNING LESSON, and it recurs:** `ring(coords, thin)` in
  `derive-layers.mjs` drops points closer together than `thin` metres.
  Aggressive thinning *silently deletes small features* — Berkeley Square
  disappears at 45m, terraced houses at 12m. There is no error; the feature is
  simply not in the output. After changing a tolerance, count the features you
  expect to still be there.
- Areas are filtered too (`area(r) > 1200` for greens), which is the same trap
  in a different variable.
- Attribution strings are generated with the derivation date — ODbL requires
  the credit, so do not strip `SRC(...)`.

## Rendering and aesthetic — this is a deliberate look, not a placeholder

- **Vendored `trees/vendor/three.module.min.js` (r169).** No CDN. Do not add
  one; do not "upgrade" it without being asked.
- Hidden-line meshes, wireframe canopies, a scanline overlay, monospace glow
  HUD. **Keep it. No pastel regressions.** If a change makes it look like a
  modern web game, that is a bug.

## Modes, fleet, and the two control surfaces

Two modes: **drive** (virtual joystick, auto-aiming turret) and **strategic
map** (tap-select a fleet of three AI tanks — BRUNEL, CABOT, BANKSY — give
waypoint orders, tap again to jack in).

Two ways in from outside, both real and both easy to miss:

```js
// 1. the headless playtest hook (bristol-scene.js, last line of the IIFE)
window.__tftt = { scene, camera, renderer, composer, state, dragons, tanks,
                  plantSapling, heightAt, waterLevel, inBuilding, inBuildingIdx,
                  treeState, rGrid, roadAssist, get aliveTrees() {…} };

// 2. the scripted public API — host.api, plus a postMessage bridge
host.api.start() / jackIn() / setView(v) / setMode(m) / setAuto(...)
host.api.goto(easting, northing)        // teleport, raw BNG
host.api.driveTo(easting, northing)     // route there; returns false if unroutable
host.api.lookAtMap(easting, northing, h = 1200)
host.api.honk() / radio()
host.api.state()  // { running, view, score, wave, trees, mode, auto, position:{easting,northing} }
```

`host.api` takes and returns **raw BNG**, not world coordinates — it does the
transform for you. It also emits `CustomEvent`s on the host element and
`postMessage({type:'bristol-scene', event, data})` to a parent frame, so the
scene can be driven from an embedding page. Prefer `host.api` for scripted
scenes; use `window.__tftt` when a test needs to reach inside.

## `?lite` — and the gotcha

`?lite` renders **every 4th tree** (`TREES.trees.filter((_,i) => i%4===0)`)
for low-end devices and CI. But it also sets `persistOk = !lite`, so **lite
mode does not persist the forest**: deaths do not scar and plantings do not
heal across reloads, because the indices no longer line up with the full set.
A playtest that checks persistence must not use `?lite`.

## Working on this offline

- No test suite of its own. Headless playtests go through Playwright + the
  hooks above; see the fink skill's "Testing discipline" section for the
  server and CORS rules, which apply here too.
- WebGL renders under SwiftShader at roughly 2 FPS on a scene this heavy —
  fine for screenshots and functional checks, useless for judging feel. Never
  report performance from a headless run.
- The whole thing is static files; `python3 -m http.server` from the repo root
  is enough (there are no sandboxed app frames here, so the CORS caveat that
  bites `inklet/` does not apply).
