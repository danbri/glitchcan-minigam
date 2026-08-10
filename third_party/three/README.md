# three.js (WebGPU build)

- **Version:** 0.180.0 (r180)
- **Source:** https://cdn.jsdelivr.net/npm/three@0.180.0/build/
- **License:** MIT (Copyright 2010-2025 Three.js Authors) — see the license
  header in each file.
- **Files:** `three.webgpu.min.js` (imports `./three.core.min.js` relatively;
  exports the core API, `WebGPURenderer`, node materials, and the `TSL`
  namespace), plus `three.tsl.min.js` (bare-specifier re-export shim, only
  needed with an import map).

Used by `magpie/dbdb/` (Jet Set Ducky) as the offline fallback behind the
jsDelivr CDN. Note: `trees/vendor/` carries its own, older three.js (r169,
classic WebGL build) — they are deliberately separate.
