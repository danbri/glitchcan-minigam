# GLSL ↔ WGSL Codegen Parity Matrix

Authoritative, code-verified comparison of `core/json-codegen.js` (GLSL, Mayfly)
and `core/wgsl-codegen.js` (WGSL, Stinkyfish). Reflects the state **after the
July 2026 interop pass**. Mayfly/GLSL is the reference backend.

Legend: ✅ parity · ⚠️ present but divergent behaviour · ❌ missing/stub on that side.

## Node types

Both codegens dispatch the same 25 node types (`walkNode`). Behavioural
differences:

| Node | GLSL | WGSL | Note |
|------|------|------|------|
| primitives (sphere…plane) | ✅ | ✅ | aligned |
| CSG (union…smoothIntersect) | ✅ | ✅ | aligned |
| `transform`, `group`, `material` | ✅ | ✅ | aligned |
| `ref` / `defs` (+ overrides) | ✅ | ✅ | `applyOverrides`/`substituteVars`, json-loader.js |
| `round`, `shell` | ✅ | ✅ | aligned |
| `select` | ✅ | ✅ | **fixed July 2026** — WGSL was a sphere-returning stub; now branchless `mix(a,b,step(0.5,cond))` in both |
| `radial` | ✅ | ✅ | WGSL now applies `node.transform` (fixed July 2026) |
| `mirror` | ✅ | ⚠️ | WGSL now applies `node.transform` (fixed July 2026); still lacks LCD-003 ancestor-rotation fix (json-codegen.js ~1238) |
| `repeat` | ✅ | ⚠️ | WGSL now applies `node.transform` (fixed July 2026); still ignores `exposeId` per-instance variation |
| `displace` | ✅ | ✅ | WGSL now honours `noiseType`/`octaves`/`animate`/`transform` (fixed July 2026), matching GLSL |
| `customExpr` | ⚠️ | ⚠️ | GLSL reads `node.glsl` (base64 → `atob`); WGSL reads `node.expr` (raw). Backend-specific shader text — not shareable |

## Expression operators (`expr`)

After the July 2026 pass GLSL and WGSL share the full **scalar** vocabulary:

`add sub mul div mod neg abs floor ceil fract round sin cos tan asin acos atan
pow sqrt exp log min max clamp step smoothstep mix lerp noise fbm turbulence hash`

Details / caveats:

| Op(s) | Status | Note |
|-------|--------|------|
| `pow sqrt exp log asin acos atan round lerp` | ✅ | **added to GLSL July 2026** — previously emitted `0.0` + a warning in GLSL |
| `mod` | ✅ | **WGSL changed July 2026** to floored `a - b*floor(a/b)` to match GLSL's `mod()`; WGSL `%` had diverged for negative operands |
| `atan` | ✅ | 1-arg and 2-arg (atan2) both handled in both |
| `noise fbm turbulence hash` | ✅ | both; octaves must be integer |
| `vec2 vec3 vec4 length normalize dot cross` | ❌ GLSL | WGSL-only. GLSL codegen's value model is scalar-oriented — **avoid these unless targeting WebGPU only** |

The GLSL `default` case still emits `0.0` + `console.warn("Unknown expression
op")` — so an unknown op degrades silently. Always run the Node harness after
adding an op.

## Transforms

| Field | GLSL | WGSL | Note |
|-------|------|------|------|
| `translate`, `scale`, `rotate` (Euler °) | ✅ | ✅ | |
| `mat4` | ✅ | ⚠️ | verify on WGSL |
| `rotateQ`, `rotateAxis` | ⚠️ | ⚠️ | incomplete in GLSL codegen (json-codegen.js ~2209); verify before relying on either |

## Renderer / component

| Concern | Status | Note |
|---------|--------|------|
| `<lucid-renderer>.updateParam()` | ✅ | **fixed July 2026** — routed to `setParam` (was calling non-existent methods) |
| `getCameraPos()` / `getCameraPosition()` | ✅ | **aliased July 2026** on both renderers |
| `<lucid-renderer>.setTime()` | ✅ | **added July 2026** — drives each backend's `overrideTime` |
| Rig passed to compile | ⚠️ | component's Mayfly path passes `rig`; Stinkyfish path only feeds rig param names into the uniform layout |
| `auto` fallback | ⚠️ | capability-presence only — an async WebGPU `init()` failure fires `render-error` rather than falling back to Mayfly |
| Node-graph/DSL codegen | ❌ WGSL | `core/glsl-codegen.js` `generateGlslFromSceneGraph` has no WGSL counterpart; the node-editor authoring path is Mayfly-only |

## Rendering features

| Feature | GLSL/Mayfly | WGSL/Stinkyfish |
|---------|-------------|-----------------|
| Surface raymarch | ✅ | ✅ (visually unverified headless) |
| Silhouette edge darkening | ✅ (default on) | ✅ (added July 2026 to match — Stinkyfish previously read brighter/flatter) |
| Volume render (jelly/xray/heatmap) | ✅ | ❌ |
| Physics integration in renderer | ✅ (Stack A) | ❌ |
| Ground plane default | on | off |

## When you touch codegen

1. Implement the change in **both** `json-codegen.js` and `wgsl-codegen.js`.
2. Run the Node harness (see SKILL.md) — confirm the op/helper appears in both,
   no `Unknown` warning, output non-empty.
3. For WGSL param changes, update `_buildUniformLayout` (lucid-renderer.js), the
   generated `SceneUniforms` struct, and the buffer writer together.
4. Update this matrix and, if it changes a documented divergence, `stinkyfish/BUGS.md`.
