---
name: lucid-scene-authoring
description: >-
  Author, edit, and debug Lucid SDF/CSG scene JSON files (lucid/scenes/**/*.json).
  Use this whenever you are creating a new scene, adding or modifying primitives,
  CSG boolean operations, transforms, modifiers (round/shell/displace), reusable
  definitions (defs/ref), scene parameters, or driven-value expressions for the
  Lucid renderer. Also use it when a scene renders as an empty frame, a param has
  no visible effect, or you need to know which node types, transform modes, or
  expression operators are supported. Covers the shared scene format consumed by
  BOTH the Mayfly (WebGL/GLSL) and Stinkyfish (WebGPU/WGSL) backends.
---

# Lucid Scene Authoring

Lucid scenes are backend-neutral JSON. One scene file is compiled to GLSL (Mayfly)
or WGSL (Stinkyfish) by `core/json-codegen.js` / `core/wgsl-codegen.js` after being
parsed by `core/json-loader.js`. Author to the JSON contract and both backends work.

**Units:** 1 unit = 1 meter. All positions, radii, and distances are metres; all
rotation angles are **degrees**. See `references/node-reference.md` and
`lucid/docs/sdf-units-convention.md`. Keep human-scale objects near 1–2 units.

## Minimal scene

```json
{
  "name": "Hello Sphere",
  "root": {
    "type": "sphere",
    "params": { "r": 1.0 },
    "transform": { "translate": [0, 1, 0] }
  }
}
```

Every scene needs a `root` node. `defs`, `params`, `rig`, `physics`, `camera`, and
`quality` (`"low"|"medium"|"high"`) are optional top-level fields.

## Node model at a glance

- **Primitives** — `sphere`, `box`, `torus`, `cylinder`, `capsule`, `ellipsoid`,
  `cone`, `roundCone`, `plane`. Carry a `params` object.
- **CSG** — `union`, `subtract`, `intersect` and their smooth variants
  `smoothUnion`, `smoothSubtract`, `smoothIntersect` (take `children[]` and an
  optional blend radius `k`, in metres).
- **Structure** — `transform` (single `child`), `group` (`children[]` + optional
  transform), `material` (wraps a `child`, sets surface `params`), `ref`
  (instantiate a `defs` entry, with `params` overrides).
- **Symmetry / repetition** — `mirror` (`axis`), `radial` (`count`, `axis`),
  `repeat` (`period`, optional `exposeId`).
- **Modifiers** — `round` (`r`), `shell` (`thickness`), `displace`
  (`amount`, `scale`, `octaves`, `noiseType`), `select` (`cond`, `a`, `b`).

Full parameter tables for every node, transform mode, and value type are in
**`references/node-reference.md`** — read it before authoring an unfamiliar node.

## Reusable modules: `defs` + `ref`

Define a sub-tree once, instantiate it many times, override its variables:

```json
{
  "defs": {
    "leg": { "type": "capsule", "params": { "r": { "var": "thickness" }, "h": 0.8 } }
  },
  "root": {
    "type": "union",
    "children": [
      { "type": "ref", "id": "leg", "params": { "thickness": 0.12 },
        "transform": { "translate": [-0.4, 0, 0] } },
      { "type": "ref", "id": "leg", "params": { "thickness": 0.12 },
        "transform": { "translate": [ 0.4, 0, 0] } }
    ]
  }
}
```

A `ref`'s `params` substitute `{ "var": "name" }` placeholders inside the def. This
is how one template yields many variants (see `scenes/csg/chunky-parametric.json`).

## Driven values: constants, variables, expressions

Any numeric field accepts three forms:

| Form | JSON | Meaning |
|------|------|---------|
| Constant | `1.5` | Fixed number |
| Variable | `{ "var": "radius" }` | Read a scene `param` (or def override) |
| Expression | `{ "expr": "mul", "args": [ … ] }` | Compute from other values / `time` |

Expressions let one slider drive many features and enable animation via the
built-in `time` variable (seconds). Example — a radius that pulses:

```json
{ "r": { "expr": "add", "args": [ 1.0,
        { "expr": "mul", "args": [ 0.2, { "expr": "sin", "args": [ { "var": "time" } ] } ] } ] } }
```

**Supported operators are backend-dependent — check parity before shipping.**
The full operator table and the GLSL/WGSL parity matrix live in
`../lucid-renderer-interop/references/codegen-parity.md`. Core arithmetic
(`add sub mul div mod neg abs floor ceil fract`), trig (`sin cos tan`),
`min max clamp step smoothstep mix`, and noise (`noise fbm turbulence hash`) work
on both backends. Prefer these unless you have verified a wider op renders in the
backend you target.

## Scene parameters (the UI sliders)

`params` declares the controls shown in the viewer's parameter panel:

```json
"params": {
  "bodyRadius": { "value": 0.5, "min": 0.2, "max": 1.0, "step": 0.01,
                  "type": "scalar", "unit": "m", "label": "Body radius" },
  "skinColor":  { "value": [0.8, 0.5, 0.3], "type": "color3", "label": "Skin" }
}
```

Types: `scalar`, `color3`, `position3`, `radii3`, `direction3`. Shorthands: a bare
number becomes a `scalar`; a bare array becomes a `position3`. Add `unit`
(`"m"`, `"°"`, `"x"`, `"%"`, `"rad"`) and `label` so the panel reads
professionally — the panel renders the unit next to the value and the label in
place of the raw key.

## Authoring checklist

1. Start from the closest existing scene in `scenes/` rather than a blank file.
2. Keep sizes in metres, angles in degrees, human-scale near 1–2 units.
3. Give every `params` entry `min`/`max`/`step`, a `label`, and a `unit`.
4. Use `{ "var": "…" }`/expressions instead of hardcoded numbers when a value
   should be tunable or animated.
5. Restrict expression operators to the cross-backend-safe set unless you have
   verified the target backend.
6. **Register the scene in `scenes/toc.json`** (see `references/node-reference.md`
   for the entry shape) — unlisted scenes never appear in the catalog.
7. Validate: `node -e` loading `loadJsonScene` + `generateGlslFromJson` should
   produce non-empty GLSL. An empty render usually means a missing `camera`, a
   param using `"default"` instead of `"value"`, or a `ref` to an absent `def`.

## Common failure modes

- **Blank frame, valid shader** — no `camera` block, or the root resolves to
  nothing. Add a camera; confirm the `ref` targets an existing `def`.
- **Param does nothing** — the value is hardcoded in the tree instead of
  `{ "var": "paramName" }`. Replace the literal with a variable reference.
- **`fbm`/`turbulence` look wrong** — octaves must be an integer; pass
  `Math.floor(octaves)`.
- **Works in WebGPU, breaks in WebGL (or vice-versa)** — an expression operator
  or node exists on one backend only. See the interop skill's parity matrix.
