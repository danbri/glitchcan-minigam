# Clipmap — Lucid's third engine (explorable SDF worlds)

A peer to `mayfly/` (WebGL) and `stinkyfish/` (WebGPU), but solving a different
problem. Mayfly and Stinkyfish **raymarch an analytic SDF per fragment** — exact,
cheap, param-animatable, ideal for viewing a single modeled object. Clipmap is a
**sparse SDF engine for large, high-detail, walkable worlds** — the SOTA direction
where per-fragment analytic raymarchers fall over (detail, scene size, WebXR,
multiplayer).

**Entry point:** `index.html` (standalone WebGPU app, first-person controls).
**Needs a real WebGPU device** — it cannot run in the headless CI browser here.

## How it works (why it scales)

```
JS scene SDF ─▶ [classify] which bricks are empty / solid / on-surface
             ─▶ [release]  free bricks that left the surface   ┐ sparse
             ─▶ [generate] bake surface bricks' distance+albedo │ residency
                            into a 3-level clipmap atlas         │ (atomics,
             ─▶ [macro]    build empty-space-skip hierarchy     ┘ free lists)
             ─▶ [render]   fragment shader walks the sparse clipmap,
                            samples the BAKED field, LOD by distance,
                            refines hits by bisection
```

Three levels (`page0/1/2` page tables + `atlas0/1/2` distance/albedo) give
distance-based LOD; the macro hierarchy skips empty space. Scenes today are
hardcoded WGSL demos (`sceneMonument`, `scenePrimitives`, `cacheSnowman`,
`cacheDragon`, …) selected by `demoId`.

**The animation seam already exists.** The `classify → release → generate` passes
are an *incremental dirty-brick re-bake*: when the field changes, only affected
bricks are reclassified and regenerated. So param animation / physics / transforms
aren't blocked — they map onto "mark region dirty, re-bake it," which is what this
pipeline is built for.

## The two pillars, and how this fits

Lucid is pursuing two things at once:

1. **An interop standard** — one common input (scene + settings, plus the harder
   layers: constraints, animation, physics, `defs`/`ref`) rendered to common
   output, *drop-in* across engines. (The Mayfly↔Stinkyfish parity work, the
   shared codegen, and the `verify/` deviation lab.)
2. **A SOTA engine** — this. High detail, large scenes, WebXR- and
   multiplayer-ready, where every other open-source SDF renderer is too slow.

These engines are **peers**, not interchangeable backends: they render different
*kinds* of experience (object viewer vs. explorable world). What should be common
is the **standard at the input**, not the pixels.

## Roadmap: reach this engine from the Lucid scene standard

The one scene-specific input clipmap needs is a WGSL distance field plus an
albedo, in this engine's exact contract:

```wgsl
struct Scene { params: vec4f };            // .x cut flag, .y time (seconds), .z demoId
struct CacheSample { distance: f32, albedo: vec3f };
fn sceneSDF(p: vec3f, scene: Scene) -> f32;
fn cacheSceneSample(p: vec3f, s: Scene) -> CacheSample;
fn cacheSceneSDF(p: vec3f, s: Scene) -> f32;
fn cacheSceneAlbedo(p: vec3f, s: Scene) -> vec3f;
```

Lucid's codegen already turns JSON scenes (primitives, CSG, `defs`/`ref`, params,
transforms) into WGSL. So the bridge is a **codegen target** —
`generateWgslSceneSDF(scene, options)` in `core/wgsl-codegen.js` — that emits
exactly that set from a Lucid scene, reusing the same `walkNode`/primitive/helper
machinery Mayfly and Stinkyfish already share. The output is **uniform-free**
(params baked as constants, so no bind group to collide with the engine's), `time`
is wired to `scene.params.y`, and inputs the engine has no source for
(frame/mouse) are zeroed. It returns `{ wgsl, unresolvedVars }`.

```js
import { loadJsonScene } from '../core/json-loader.js';
import { generateWgslSceneSDF } from '../core/wgsl-codegen.js';
const { wgsl } = generateWgslSceneSDF(loadJsonScene(sceneJson));
// → drop-in replacement for the engine's hardcoded demo scene block
```

- [x] `core/` codegen target: JSON scene → `fn sceneSDF(p, scene)->f32` (+ albedo). **Node-verifiable** — all 119 scenes emit valid, contract-matching WGSL; locked in by `tests/lucid-codegen-parity.test.js` (`clipmap bridge` block).
- [ ] Feed it into a fork of this engine's scene block (replace the hardcoded `sceneMonument`/`cache*` demos). Full self-contained replacement — the engine's own `sd*` primitives use different signatures (e.g. `sdCapsule` takes two endpoints), so the bridge must own the primitive set (`emitPrimitives: true`, the default). Requires a real WebGPU device to render-verify.
- [ ] Animation path: re-derive `sceneSDF` constants per frame → dirty region → re-bake.
- [ ] Provenance: engine authored externally (WebGPU sparse-clipmap design from YouTube notes); landed verbatim, kept precious. Modify with care.
