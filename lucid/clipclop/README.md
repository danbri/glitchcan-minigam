# Clipclop — Lucid's third engine (explorable SDF worlds)

A peer to `mayfly/` (WebGL) and `stinkyfish/` (WebGPU), but solving a different
problem. Mayfly and Stinkyfish **raymarch an analytic SDF per fragment** — exact,
cheap, param-animatable, ideal for viewing a single modeled object. Clipclop is a
**sparse SDF engine for large, high-detail, walkable worlds** — the SOTA direction
where per-fragment analytic raymarchers fall over (detail, scene size, WebXR,
multiplayer).

**Why "clipclop", not "clipmap".** The name is deliberately *not* the technique.
Today the engine bakes into a three-level clipmap, but that is one implementation
choice — brick maps, sparse voxel octrees, hash grids are all on the table. Naming
the engine after its current data structure would bake that choice into its
identity. So it gets a menagerie name (like mayfly / stinkyfish), and "clipmap"
stays what it is: the technique it happens to use right now.

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

- [x] `core/` codegen target: JSON scene → `fn sceneSDF(p, scene)->f32` (+ albedo). **Node-verifiable** — all 119 scenes emit valid, contract-matching WGSL; locked in by `tests/lucid-codegen-parity.test.js` (`clipclop bridge` block).
- [x] Feed it into the engine — done **without editing the engine**, via a runtime DOM splice: `splice.html` fetches `index.html` as text, injects the bridge WGSL (namespaced `lx_*` to dodge the primitive-signature collisions — the engine's `sdCapsule` takes two endpoints, `sdTorus` two floats), rewrites the one bake seam (`cacheSceneSample`) to sample the Lucid field, and boots the result in an iframe. `splice-lib.js` holds the transform. Assembly is Node-checked (no duplicate `fn` defs, no undefined `lx_*` calls, seam anchors present) and locked in by the parity suite (`clipclop splice` block). **The WGSL compile + render still need a real WebGPU device** — headless boots to the engine's own "no adapter" screen.
- [x] Second path — the **edit list** (`core/sdf-editlist.js`): flatten the scene tree into a flat edit buffer and fold it with a data-driven loop (the Dreams form, below). The splice offers both: `spliceEngine(html, scene, { mode: 'codegen' | 'editlist' })`, toggled live in `splice.html`. Flatten is Node-verified exact against a reference tree evaluator on the additive subset (`sdf edit list` block).
- [ ] Animation path: for codegen, re-derive constants per frame; for the edit list, rewrite the buffer → dirty region → re-bake.
- [ ] Provenance: engine authored externally (WebGPU sparse-clipmap design from YouTube notes); landed verbatim, kept precious. Modify with care.

## Beyond codegen: runtime-parameterized templates (the Dreams direction)

Codegen — JSON → WGSL string → compile — is the *first* bridge, and the right one
for a fixed catalogue of scenes. But it has a cost the SOTA goal eventually can't
pay: **every parameter change that touches structure needs a recompile.** For a
static monument that is fine. For *live* content it is the wrong shape.

Media Molecule's **Dreams** is the touchstone here: players sculpt and animate a
whole world out of SDF primitives in real time, with no shader recompile per edit.
The field is *data the GPU reads*, not *code the CPU regenerates*.

That points at a second bridge, sitting beside codegen rather than replacing it:

**Templates evaluated in a compute shader, parameterized by a uniform/storage
buffer.** One quadruped template — spine, four legs, neck, head — with a parameter
vector (leg length, body girth, snout length, ear shape, hoof vs. paw, tail).
`pig`, `sheep`, `cow`, `dog` are then *points in that parameter space*, not four
compiled shaders. Morph between them by animating the buffer; the clipclop bake
already re-generates only the dirty bricks, so a slowly-morphing animal costs only
the bricks it actually moves through.

The same logic extends to the harder layers:

- **Physics / constraints in GPU compute.** Lucid already has WGSL XPBD
  (`core/physics/xpbd-gpu.js`, real but currently unused — see the rigging skill).
  A rig/constraint solver that runs as a compute pass writes joint transforms into
  the same parameter buffer the template reads — so "evaluate rig → drive geometry"
  becomes one GPU round-trip, not a CPU per-frame loop feeding uniforms.
  **Step 1&2 landed** (`core/gpu-physics.js`, demo `../physics.html`): a writable
  body buffer and a single-dispatch integrator (gravity, damping, ground bounce,
  wall reflect) emitted as a WGSL `@compute` shader over `var<storage,
  read_write> bodies` — state stays on the GPU, no readback. Verified in Node by
  a CPU twin that mirrors the shader math line-for-line (bodies fall, settle, stay
  bounded, deterministic, never sink through the floor); the twin also drives the
  Mayfly demo so you can watch it. **Step 3** adds pairwise separation (bodies
  pile instead of overlap; `../physics.html`). **Step 4** adds XPBD distance
  constraints (`stepXPBD`, `buildChain`, demo `../rope.html`) — bodies gain an
  inverse mass, a constraint holds two of them a fixed distance apart, and a
  chain sags into a catenary with ends pinned (Node-verified: constraints
  satisfied to <1e-2, ends held exactly, middle sags, deterministic).
  **Step 5** maps constraints onto a quadruped skeleton (`buildQuadrupedRig`,
  demo `../puppet.html`): 10 joints, 12 rigid bones — drop it and it flops and
  settles as a physical ragdoll (Node-verified: bones rigid to <1e-3, settles on
  the ground, deterministic). Next: the GPU constraint pass needs graph colouring
  to avoid write races; then drive the FULL template geometry from the rig joints
  (not just beads) so a morphable pig/cow is also a physical body — geometry and
  simulation both on the GPU at once.
- **The rig `chains`/`conserved` work** (CPU today, in `rig-evaluator.js`) is the
  CPU reference for exactly such a solver. Its expression AST is the thing to port.

This does **not** retire the codegen bridge. The split is by *lifetime*:

| | Codegen bridge (done) | Runtime template (proposed) |
|---|---|---|
| Field is | compiled WGSL | data in a buffer |
| Param change | recompile | write a buffer, mark dirty |
| Good for | fixed scene catalogue, exact per-object parity | live sculpting, morphable families, physics-driven geometry |
| Verifiable without GPU | ✅ (string codegen) | partly (template math in Node; bake needs a device) |

**First step of the runtime path is landed: the edit list** (`core/sdf-editlist.js`).
It flattens a scene tree into a flat edit buffer and folds it with a data-driven
loop — `field = 1e9; for each edit: field = blend(field, primitive(edit))`. That
is the "data the GPU reads" form: to change the scene you rewrite the buffer, not
recompile. `flattenToEdits` / `evalEdits` / `evalTree` / `generateEditListWgsl`;
the splice runs it via `mode: 'editlist'`. Faithful on the additive subset
(unions, one smoothUnion of primitives, running-field subtracts) — verified exact
in Node against the reference tree evaluator; an approximation for nested smooth
blends with different radii, which is the genuine tree-vs-list difference. The
quadruped *template* below is the next step on the same path: a template is an
edit list whose numbers come from a parameter vector.

**And that step is landed too** (`core/sdf-template.js`, demo `../quadruped.html`).
`quadruped(params)` builds a scene from a parameter vector — body, four legs,
neck, head, snout, ears, tail. `pig`/`sheep`/`cow`/`dog` are four points in that
vector; `lerpQuadruped(a, b, t)` walks between them and every in-between is a
valid animal. It returns a normal Lucid scene, so it flattens to the edit list
and bakes in clipclop like anything else. Morph = re-flatten the lerped vector →
rewrite the buffer. Node-verified: all four species codegen and flatten;
midpoints are true blends.

Open question to settle before building: does a template's parameter set live in
the **same JSON scene standard** (a new node type, e.g. `template: "quadruped"`
with a `params` block that both bridges understand), or as a sibling format? The
interop pillar says: same standard at the input, if we can make one node type mean
"compile me" to Mayfly/Stinkyfish and "hand my params to the compute template" to
clipclop.
