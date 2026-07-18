# Lucid Scene JSON — Node Reference

Complete node/parameter reference for the JSON scene format. Source of truth:
`core/json-loader.js` (parsing) and `core/json-codegen.js` (GLSL generation).
Units: **1 unit = 1 metre; all rotation angles are degrees** (see
`lucid/docs/sdf-units-convention.md`).

## Contents

1. Top-level scene fields
2. Primitives
3. CSG operations
4. Structure & instancing nodes
5. Modifiers
6. Transforms
7. Value types (const / var / expr)
8. Scene params
9. TOC registration

---

## 1. Top-level scene fields

```json
{
  "name": "…",            // display name
  "version": "1.0",        // optional
  "defs": { },             // reusable named sub-trees (see §4 ref)
  "params": { },           // UI-exposed parameters (see §8)
  "rig": { },              // constraint/animation layer (see lucid-rigging-and-physics)
  "physics": { },          // physics config (see lucid-rigging-and-physics)
  "camera": { },           // camera settings — omit and scenes often render blank
  "quality": "medium",     // "low" | "medium" | "high"
  "root": { }              // REQUIRED root node
}
```

## 2. Primitives

Each primitive is `{ "type": …, "params": { … }, "transform": { … } }`. Defaults
below are what codegen uses when a param is omitted. All carry an optional
`color` (`[r,g,b]`, 0–1). Sizes are metres.

| type | params (default) | notes |
|------|------------------|-------|
| `sphere` | `r` (1.0) | radius |
| `box` | `size` ([1,1,1]) | **half-extents** — box spans −size…+size per axis |
| `torus` | `major` (1.0), `minor` (0.3) | ring & tube radii |
| `cylinder` | `h` (1.0), `r` (0.5) | half-height, radius |
| `capsule` | `h` (1.0), `r` (0.25) | cylinder with hemispherical caps |
| `ellipsoid` | `radii` ([1,0.5,0.5]) | per-axis radii; optional `fidelity` (`"fast"`/`"auto"`/`"exact"`/N) picks distance accuracy — see `lucid/docs/ellipsoid-fidelity.md` |
| `cone` | `h` (1.0), `r` (0.5) | simple cone (tip up) |
| `cone`/`roundCone` | `h`, `r1` (0.5, bottom), `r2` (0.0, top) | truncated/rounded cone when `r1`/`r2` present |
| `plane` | `normal` ([0,1,0]), `h` (0) | infinite plane, `h` = offset along normal |

## 3. CSG operations

Take `children[]`. Smooth variants take a blend radius `k` (metres).

| type | fields | effect |
|------|--------|--------|
| `union` | `children[]` | min of children |
| `subtract` | `children[]` | first minus the rest |
| `intersect` | `children[]` | overlap only |
| `smoothUnion` | `children[]`, `k` | blended union |
| `smoothSubtract` | `children[]`, `k` | blended subtraction |
| `smoothIntersect` | `children[]`, `k` | blended intersection |

CSG nodes may carry an optional `boundingBox` (`{center, halfSize}`) used for BVH
spatial optimisation — preserve it if present.

## 4. Structure & instancing nodes

| type | fields | purpose |
|------|--------|---------|
| `transform` | `transform`, `child` | wrap a single child in a transform (§6) |
| `group` | `children[]`, `transform?` | group with an optional shared transform |
| `material` | `params`, `child` | set surface material (`color`, `metallic`, `roughness`, `emit`) on a sub-tree |
| `ref` | `id`, `params?` | instantiate a `defs` entry; `params` override `{var:…}` placeholders inside it |
| `mirror` | `axis` ('x'), `child` | bilateral symmetry via `abs()` domain fold |
| `radial` | `count` (6), `axis` ('y'), `child` | N-fold radial symmetry |
| `repeat` | `period` ([2,0,2]), `exposeId?`, `child` | infinite tiling; `exposeId` exposes a per-instance id for variation |
| `select` | `cond`, `a`, `b` | branchless pick: `cond < 0.5` → a, else b |

**Prefer `mirror`/`radial`/`repeat` over duplicating geometry with `ref`** — they
are O(1) domain folds in the shader, not N copies.

`defs` + `ref` is the reusable-module mechanism:

```json
"defs": { "wheel": { "type": "torus", "params": { "major": { "var": "size" }, "minor": 0.1 } } },
"root": { "type": "ref", "id": "wheel", "params": { "size": 0.5 } }
```

## 5. Modifiers

| type | fields (default) | effect |
|------|------------------|--------|
| `round` | `r` (0.05), `child` | inflate/soften edges by `r` |
| `shell` | `thickness` (0.05), `child` | hollow out to a shell |
| `displace` | `amount` (0.1), `scale` (3.0), `octaves` (4), `noiseType` ('fbm'), `animate` (false), `child` | noise surface displacement |

## 6. Transforms

A `transform` object supports (priority high→low): `mat4` > `rotateQ` >
`rotateAxis` > `rotate`. Plus `translate` and `scale`.

| field | shape | notes |
|-------|-------|-------|
| `translate` | `[x,y,z]` | metres |
| `rotate` | `[rx,ry,rz]` | Euler **degrees**, XYZ order |
| `rotateQ` | `[x,y,z,w]` | quaternion (glTF convention) |
| `rotateAxis` | `{ axis:[x,y,z], angle }` | axis-angle, **degrees** |
| `scale` | number or `[x,y,z]` | uniform or per-axis |
| `mat4` | 16 numbers | column-major; overrides all rotation fields |

⚠️ Backend note: `rotateQ`/`rotateAxis` handling is incomplete in GLSL codegen,
and domain-modifier nodes (`radial`/`mirror`/`repeat`) drop their own `transform`
in WGSL. See `../../lucid-renderer-interop/references/codegen-parity.md`.

## 7. Value types

Any numeric field can be a constant, a variable, or an expression:

- **const** — a number: `1.5`
- **array** — `[a, b, c]` (each element may itself be a value)
- **var** — `{ "var": "name" }` — reads a scene `param`, a `ref` override, or the
  built-in `time` (seconds)
- **expr** — `{ "expr": "op", "args": [ … ] }`

Cross-backend-safe operators (work in GLSL **and** WGSL): `add sub mul div mod
neg abs floor ceil fract round sin cos tan asin acos atan pow sqrt exp log min
max clamp step smoothstep mix lerp noise fbm turbulence hash`. WGSL additionally
offers vector ops (`vec2/3/4 length normalize dot cross`) that GLSL codegen does
not — avoid those unless you target WebGPU only. For the authoritative matrix see
the interop skill's `codegen-parity.md`.

`fbm`/`turbulence` need an **integer** octave count.

## 8. Scene params

```json
"params": {
  "radius": { "value": 0.5, "min": 0.2, "max": 1.0, "step": 0.01,
              "type": "scalar", "unit": "m", "label": "Radius" }
}
```

- `type`: `scalar` | `color3` | `position3` | `radii3` | `direction3`
- Shorthand: a bare number → `scalar`; a bare `[a,b,c]` → `position3`
- `min`/`max`/`step` shape the slider; `unit` (`"m"`, `"°"`, `"x"`, `"%"`,
  `"rad"`) and `label` drive professional panel display (both preserved by the
  loader as of the July 2026 UX pass).

Reference a param anywhere via `{ "var": "radius" }`. Params with no `{var}`
reference anywhere in the tree render a slider that does nothing.

## 9. TOC registration

Add every new scene to `scenes/toc.json` or it won't appear in the catalog. Entry
shape (inside a category's `scenes[]`):

```json
{ "path": "csg/my-scene.json", "title": "My Scene",
  "subtitle": "One-line description", "isAnimated": false }
```

Categories: `recent`, `prim`, `csg`, `transform`, `creatures`, `physics`,
`archive`. A scene may appear in more than one category. After scene changes run
`node scripts/update-recent-changes.mjs --days=14 --max=8` to refresh the Recent
category (manual — there is no pre-commit hook).
