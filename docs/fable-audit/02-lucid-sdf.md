# Audit 02 — Lucid SDF Rendering Ecosystem

A JSON-scene-graph → raymarcher pipeline with two backends, a scene library, a visual
node editor, an XPBD physics layer, and a multi-agent model-evaluation methodology
(ABCD Parliament). Core rendering is solid; the integration/componentization layer
promised in the plans is roughly half-real.

## 1. Core pipeline: implemented and substantial

- `lucid/core/json-loader.js` — JSON scenes → IR, expression support with `time`
- `lucid/core/json-codegen.js` (85 KB) — IR → GLSL; mirror/radial/repeat instancing
  implemented (json-codegen.js:792–986)
- `lucid/core/wgsl-codegen.js` (53 KB) — IR → WGSL
- `lucid/mayfly/raymarcher.js` (31 KB) — WebGL backend, production-grade
- `lucid/stinkyfish/raymarcher.js` (37 KB) — WebGPU backend, **unverified** (see §3)
- `lucid/core/rig-evaluator.js` + tests — rig constraint solver

Known open codegen bug: nested repeat+radial distortion
(`sunflower-field-diagnosis.md`; workaround scenes exist, GLSL fix pending).
Known TODO in loader: param override in refs (json-loader.js:305–307).

## 2. Scene library: 119 files on disk, 79 in the TOC

- Scene JSON files (excluding toc.json): **119** across 15 categories
  (creatures 18, physics 6, csg, prim, math, nature, patterns, fx, ships, archive…)
- `lucid/scenes/toc.json` indexes only **79** entries
- Docs claim "117 scenes" (CLAUDE.md, ZERO_ANNOYANCES_PLAN.md "All (117)")

So the "117" claim roughly matches *files on disk*, but **47 scenes are orphaned from
the TOC** (verified by falsification pass; zero toc entries point at missing files) and thus invisible to the viewer's scene picker. This also contradicts the
lucid/CLAUDE.md rule "when adding scenes ALWAYS update toc.json".

**Pre-commit hook claim is false:** `lucid/scripts/update-recent-changes.mjs` (182
lines) exists and works *manually*, but no pre-commit hook is installed
(`.git/hooks/` has only samples; no tracked hooks dir).

## 3. Stinkyfish/WebGPU: coded, never verified

`lucid/stinkyfish/BUGS.md` is candid: WGSL fixes (repeat, radial, merge) made in
January 2026 "have NOT been visually verified — WebGPU is NOT available in headless
Chromium." All Playwright/Puppeteer capture runs silently fall back to Mayfly/WebGL.
Therefore the claim "all scenes loadable via either backend" is untested for the
WebGPU half, and any past "visual verification" of WGSL changes was illusory (a
failure mode CLAUDE.md itself warns about). Verification requires a manual session in
a real WebGPU browser via `compare.html`, `scene-catalog.html`, or
`index.html?backend=stinkyfish`.

## 4. Viewers, components, and the ZERO_ANNOYANCES plan

**Viewers (all exist):** `index.html` (219 KB main viewer), `node-editor.html` (53 KB,
node canvas + timeline scrubber), `scene-catalog.html`, `compare.html`,
`stinkyfish/demo.html`, `perf-test.html`.

**Web components — promised vs delivered:**

| Component | Plan | Reality |
|---|---|---|
| `<lucid-renderer>` | Phase 1 | ✅ Defined & registered |
| `<lucid-scene-picker>` | Phase 1, with filter bar | ✅ Exists **with** filter bar (All/Static/Working/Recent/Broken + search — falsification pass corrected the earlier "missing" claim) |
| `<lucid-orbit-controls>`, `<lucid-comparison>`, `<lucid-render-controls>`, `<lucid-scene-params>` | — | ✅ Exist |
| `<lucid-param-editor>` | ZERO_ANNOYANCES_PLAN | ❌ Inline only (scene-params.js), never extracted |
| `<lucid-timeline>` | CLAUDE.md + plan | ❌ Functional but inline in node-editor.html |
| `<lucid-node-graph>` | plan | ❌ Functional but inline in node-editor.html |

**Integration TODOs (CLAUDE.md "Integration TODO" list) — status:**

| TODO | Status |
|---|---|
| Catalog → Node Editor (click card to edit) | ❌ No linkage found |
| Timeline → Rig (wiggler outputs to uniforms) | ⚠️ Timeline exists; wiring not found |
| Node graph → Timeline param connections | ❌ Not found |
| Physics bridge | ✅ `core/physics/physics-bridge.js` (39 KB) exists |

`index.html` still uses inline code rather than the components (Phase 2 of the plan,
not done). Node editor has no scene import/export to JSON.

## 5. XPBD physics: real, and integrated into the main viewer

*(Corrected by falsification pass — originally published as "demo-only".)*
`core/physics/`: `xpbd.js`, `xpbd-gpu.js` (compute-shader variant),
`physics-scene.js`, `physics-bridge.js`, `splat-physics.js`; tests for xpbd, splat,
physics scenes in `tests/`. Six physics scenes in `scenes/physics/` consume
`"physics": {...}` JSON config. **lucid/index.html does initialize physics**: it
imports PhysicsScene, instantiates it when `json.physics.enabled` is set, steps the
simulation in the render loop, and syncs body positions back to shader params. The
node editor has no physics preview; dedicated demo pages also exist.

## 6. ABCD Parliament (automodel): genuinely operational

- `lucid/automodel/`: parliament-rules.md, parliament-maker-skill.md, sdf-skill.md,
  whale-skills.md, `capture-timed.mjs` (Puppeteer, 12 viewpoints, timing logs)
- **15 capture sessions** on disk (v5.9 → v6.66), **7 review JSONs** + index.json,
  `index.html` log viewer
- Review JSONs follow the documented schema (agents A–D, showstoppers arrays, timings)

This methodology section of CLAUDE.md is one of the few that matches reality closely.
Caveat: captures use Puppeteer (CLAUDE.md examples cite Playwright and a hardcoded
chromium path) — browser provisioning is environment-fragile either way (see Audit 04).

## 7. Spinoffs, archives, and the independent sibling

- `lucid/archive/` — 7 retired prototypes (demos.html, initial_test.html, vader_*,
  webgpu_*) properly quarantined
- `lucid/ux/`, `lucid/splats/`, `xr-sculptor.html` — parallel experiments, unintegrated
- **`yeti/`** (13 files, audited in report 03) — a parametric creature lab.
  yeti/CLAUDE.md claims "zero code dependencies on lucid/", **but the code disagrees**:
  `yeti/yeti-creature.js:18-22` imports five modules from `../lucid/` (json-loader,
  json-codegen and others). The separation is aspiration, not fact — a repo-doc error
  the falsification pass caught after this audit initially repeated it

## 8. Plans corpus inside lucid/

`lucid/CLAUDE.md`, `ZERO_ANNOYANCES_PLAN.md` (4 phases; implementation ~mid-Phase 2),
`PARAMETRIC-RIGGING-PLAN.md` (expression AST done, param-override TODO open),
`TESTING-STRATEGY.md` (tiered tests — these DID get a real workflow,
`.github/workflows/lucid-tests.yml`), `REVIEW-2025-11-29.md`, `SCOPE-AND-GAMES.md`.
Root specs: `sdf-vrml-strawslop2.md`, `sdf_draft_spec_alt_nodes.md`,
`vader-sdf-sample.md`.

## 9. Headless verification (added by Audit 06)

Run in this session via Node (no browser): **all 119 scene files pass GLSL codegen
and all 119 pass WGSL codegen** (two scenes contain an unimplemented `customExpr`
node that passes through with a warning), and **160 unit tests pass** across
lucid-core, xpbd-physics, rig-evaluator, and the splat/physics suites (1
expected-fail). This upgrades the scene-corpus health finding; the WebGPU
*render-path* verification gap (§3) still stands, since codegen success ≠ shader
compilation in a real browser. Also noted: `tests/glsl-codegen.test.js` and
`tests/dsl-parser.test.js` use `@playwright/test` syntax and fail collection if
vitest is pointed at the whole `tests/` directory.

## 10. Verdict

Rendering core, scene format, physics solver, and the Parliament evaluation loop are
real and tested. The gaps are (a) the WebGPU backend's unverified status, (b) ~40
scenes missing from the TOC, (c) the componentization/integration layer that the plans
describe in detail but that stalled mid-phase, and (d) a "pre-commit hook" that is
actually a manual script.
