---
name: lucid-renderer-interop
description: >-
  Work across Lucid's two rendering backends — Mayfly (WebGL/GLSL,
  lucid/mayfly/) and Stinkyfish (WebGPU/WGSL, lucid/stinkyfish/) — and the code
  that unifies them: the shared JSON→shader codegen (core/json-codegen.js,
  core/wgsl-codegen.js), the <lucid-renderer backend="auto"> web component, and
  the uniform/param plumbing. Use this when a scene looks right in one backend
  but wrong/blank in the other, when adding a node type or expression operator
  (it must be implemented in BOTH codegens), when touching the renderer public
  API or backend switching, or when deciding which backend a feature can rely
  on. Includes the GLSL↔WGSL capability parity matrix.
---

# Lucid Multi-Renderer Interop

Lucid renders one backend-neutral JSON scene through two backends:

```
JSON scene ─ core/json-loader.js ─▶ shared IR
                                     ├─ core/json-codegen.js  ─▶ GLSL ─▶ Mayfly (WebGL)   mayfly/raymarcher.js
                                     └─ core/wgsl-codegen.js  ─▶ WGSL ─▶ Stinkyfish (WebGPU) stinkyfish/raymarcher.js
```

`<lucid-renderer backend="auto">` (`components/lucid-renderer.js`) picks
Stinkyfish when `navigator.gpu` exists, else Mayfly. **Mayfly is the reference
backend** — more complete and the only one verifiable headless (WebGPU is not
available in headless Chromium, so Stinkyfish output is visually unverified; see
`stinkyfish/BUGS.md`). Treat Mayfly as ground truth when they disagree.

## The golden rule

**Anything that reads the IR must be implemented in BOTH codegens, or the two
backends diverge silently.** `json-codegen.js` and `wgsl-codegen.js` have
matching node-type switches but historically drifted on expression operators and
domain modifiers. When you add or change a node type or an `expr` op, update
both files and verify with the Node harness below.

## Verify codegen without a browser

Both codegens run in Node — this is the fast, reliable check (no WebGPU needed):

```js
import { loadJsonScene } from '../core/json-loader.js';
import { generateGlslFromJson } from '../core/json-codegen.js';
import { generateWgslFromJson } from '../core/wgsl-codegen.js';
const scene = loadJsonScene(myJson);
const glsl = generateGlslFromJson(scene);   // inspect length, uniforms, ops
const wgsl = generateWgslFromJson(scene);
```

Check: non-empty output, no `Unknown expression op` warning, the operator/helper
you expect is present in **both** strings. "Compiles" ≠ "renders correctly" for
WGSL — confirm anything visual in a real WebGPU browser via `compare.html`,
`scene-catalog.html`, or `index.html?backend=stinkyfish`.

**Can't see WGSL headless?** That's the whole point of `lucid/verify/` — a public
page that has a human on a real GPU device compare both backends and file the
result as a `visual-verification` GitHub issue you can read back. Reach for it
whenever a WGSL change needs human eyes; see `lucid/verify/README.md`.

## Renderer public API (what both expose)

Shared: `setParam(name, value)`, camera props (`cameraDistance/Theta/Phi/Target`)
+ a `camera` proxy, `setQuality`, `setLighting`, `pause/resume`,
`getCameraPos()`/`getCameraPosition()` (both names work on both since the July
2026 parity pass).

Divergent — know these when writing backend-agnostic code:

| Concern | Mayfly | Stinkyfish |
|---|---|---|
| Compile a scene | `updateScene(glsl, params, rig, json)` — sync | `await compileScene(wgsl, layout)` — async, needs a uniform layout |
| Init | ready in constructor | `await init()` required |
| Bulk params | via `updateScene` | separate `setSceneParams(params)` after compile |
| Unknown param name | `setParam` creates it | `setParam` silently drops it (updates existing only) |
| `render()` | no args; internal clock | `render(physicsParams?)` — arg is a physics-param object, not time |
| Physics | first-class (Stack A, see rigging skill) | none; only accepts precomputed `physicsParams` |
| Volume rendering | jelly/xray/heatmap modes | surface mode only |
| Ground plane default | on | off |

Prefer the `<lucid-renderer>` component over talking to a renderer class
directly — it abstracts init/compile/camera. Its `setParam`-based `updateParam`,
`setCamera({…})`, and `setTime(seconds)` work on both backends.

## Where the backends still diverge (as of July 2026)

The July 2026 interop pass fixed: GLSL expression-op parity
(pow/sqrt/exp/log/asin/acos/atan/round/lerp), WGSL floored `mod`, WGSL `select`,
the component's dead `updateParam`, and camera-accessor naming. **Still
divergent** (design around these, or fix in both codegens + verify):

- **WGSL vector `expr` ops** (`vec2/3/4`, `length`, `normalize`, `dot`, `cross`)
  have no GLSL equivalent — GLSL-targeted scenes must avoid them.
- **`repeat` `exposeId`** per-instance variation: GLSL only; WGSL ignores it.
- **`displace`**: WGSL hardcodes `fbm(…,4)`, ignoring `noiseType`/`octaves`/`animate`.
- **`customExpr`**: GLSL reads `node.glsl` (base64); WGSL reads `node.expr` (raw).
  Inherently backend-specific shader text — cannot be shared.
- **`mirror` under a rotated ancestor**: GLSL has the LCD-003 fix; WGSL does not.
- **Domain modifiers drop `node.transform`** in WGSL (`radial`/`mirror`/`repeat`).
- **Node-graph/DSL path** (`core/glsl-codegen.js`, used by node-editor) is
  **GLSL-only** — there is no `generateWgslFromSceneGraph`.

The full, current matrix with file:line anchors is in
**`references/codegen-parity.md`** — consult it before assuming a feature is
cross-backend.

## Uniform layout: the fragile part

- **GLSL** binds params by name (`u_<name>`) at draw time — order-independent and
  robust to a param-set mismatch (missing params are skipped).
- **WGSL** packs params into a `SceneUniforms` struct with std140-style 16-byte
  `vec3f` alignment; the JS-side layout (`_buildUniformLayout`), the generated
  struct, and the buffer writer must agree exactly. A param-order or type
  mismatch corrupts every field after it. When adding a param type to WGSL,
  update all three in lockstep.
