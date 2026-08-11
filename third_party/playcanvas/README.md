# PlayCanvas Engine (vendored)

- `playcanvas.min.mjs` — PlayCanvas engine **2.21.3**, ESM build, MIT license.
- Source: https://cdn.jsdelivr.net/npm/playcanvas@2.21.3/build/playcanvas.min.mjs
- Used by `magpie/dbdb/dream.html` for Gaussian-splat rendering ('gsplat'
  component + compressed.ply assets) because it renders splats correctly on
  iOS Safari, where GaussianSplats3D (third_party/gaussian-splats-3d/) drew
  a black screen in the field (Aug 2026). Pages load the CDN copy first and
  fall back to this file (same pattern as third_party/three/).
- The `.compressed.ply` assets in `magpie/dbdb/splats/` were produced from
  the sibling `.splat` files with `npx @playcanvas/splat-transform`.
