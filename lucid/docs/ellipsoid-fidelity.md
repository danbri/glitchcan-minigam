# Ellipsoid Distance Fidelity

> Exact where distortion would bite, cheap where it's safe, chosen per task.

## Background: why the ellipsoid needs this

A signed distance function for a **sphere** is trivial and exact:
`length(p) - r`. A general **triaxial ellipsoid** has no such luck. The exact
Euclidean distance from a point to an ellipsoid requires finding the nearest
surface point, which reduces to solving a **degree-6 polynomial** in the
Lagrange multiplier `μ`:

```
G(μ) = Σ  r_i² p_i² / (r_i² + μ)²  =  1      (i = x, y, z)
```

By the **Abel–Ruffini theorem**, a general polynomial of degree ≥ 5 has no
solution in radicals — so there is provably **no closed-form exact ellipsoid
SDF** built from `+ − × ÷ √`. (The 2D ellipse is a quartic, which *is* solvable
by radicals but still nasty; the 3D jump to a sextic is where exactness becomes
formally impossible.)

So raymarchers use an approximation. Lucid's default is Inigo Quilez's
first-order estimate (`core/json-codegen.js`, `sdEllipsoid`):

```glsl
float k0 = length(p / r);
float k1 = length(p / (r * r));
return k0 * (k0 - 1.0) / k1;
```

This is **exact for a sphere** and degrades as the ellipsoid gets more
eccentric. Measured against a brute-force reference:

| eccentricity (max/min radius) | fast-approx max error |
|---|---|
| 1 (sphere) | ~0 |
| 2 | ~2% of a unit |
| 3.3 | ~9% |
| 6.7 | ~17% |
| 10 | ~18% |

Because sphere-tracing assumes a (near) true distance, this error can cause the
ray to **overshoot** the surface (frayed silhouettes) and, under CSG
composition (`min`/`max`, `smoothUnion`), the errors **compound**.

## The fix: optional Newton refinement

When fidelity is requested, codegen emits a helper that seeds from the fast
estimate and runs **N Newton steps** on `G(μ)`, then measures the distance to
the resulting closest point. The seed `μ = min(r)·dFast` is exact for spheres.
Error falls ~quadratically with N:

| steps | error at ecc = 10 |
|---|---|
| 0 (fast) | 1.8e-1 |
| 2 | 6.4e-2 |
| 4 | 2.6e-3 |
| 6 | 8.3e-6 |

Interior points keep the fast estimate (overshoot risk is on approach from
outside). The GLSL helper is verified to compile and render in WebGL; the WGSL
helper is a faithful transcription — confirm it visually on a WebGPU device via
`lucid/verify/`.

## Choosing fidelity (the policy)

Fidelity is resolved per ellipsoid, precedence **per-node > codegen option**:

| value | meaning |
|---|---|
| `'fast'` (default) | 0 steps — the first-order approximation. Byte-identical to before. |
| `'exact'` | 6 steps — machine-ish precision. |
| `'auto'` | steps chosen from eccentricity (see below) — spends cost only where distortion risk is real. |
| a number | that many Newton steps (0–8). |

`'auto'` reads the ellipsoid's **constant** radii at compile time and maps
eccentricity → steps: `≤1.15 → 0`, `≤2.5 → 2`, `≤5 → 3`, `≤8 → 4`, else `6`.
(Radii driven by params/expressions can't be judged statically, so `'auto'`
uses a safe middle of 3 steps.)

## How to set it

**Per node** (task-relative — be exact only where it matters):

```json
{ "type": "ellipsoid", "params": { "radii": [1, 0.25, 0.15] }, "fidelity": "exact" }
```

**Per scene** (JSON top level):

```json
{ "name": "…", "ellipsoidFidelity": "auto", "root": { … } }
```

**Per renderer / env hint** — the `<lucid-renderer>` attribute is the entry point
for device- or task-driven policy (e.g. an app can pick `'fast'` on low-end
hardware, `'auto'` or `'exact'` on capable devices):

```html
<lucid-renderer backend="auto" ellipsoid-fidelity="auto"></lucid-renderer>
```

**In code** — pass `ellipsoidFidelity` in the codegen options:

```js
generateGlslFromJson(scene, { ellipsoidFidelity: 'exact' });
generateWgslFromJson(scene, { ellipsoidFidelity: 'auto' });
```

## Cost

Each Newton step is a handful of vector ops per ray step, so `exact` on a
close-up eccentric ellipsoid is real cost; `auto` keeps it near-free for
near-spherical shapes (0 steps) and only pays where the silhouette would
otherwise fray. Prefer `'auto'` as a global default when you want correctness
without hand-tuning; reserve `'exact'` for hero shapes and `'fast'` for
backgrounds or low-end targets. Where a shape only needs squashing on one axis,
a **spheroid** (two equal radii) is cheaper and less error-prone than a triaxial
ellipsoid.

## Verification

- `lucid/core` — numerical core verified against a brute-force nearest-point
  reference (quadratic error falloff; exact for spheres).
- GLSL — emitted Newton helper compiles and renders in WebGL (headless).
- WGSL — transcription verified structurally; confirm visually via `lucid/verify/`.
- All 119 library scenes still codegen on both backends at the default `'fast'`.
