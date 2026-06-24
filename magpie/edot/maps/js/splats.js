// splats.js — Gaussian splatting integration point (STUB, intentionally inert).
//
// STATUS: NOT IMPLEMENTED. This is a clearly-labelled placeholder, not a demo.
// A real 3D Gaussian splat renderer (sorting splats by depth every frame,
// rendering oriented gaussians via a custom WebGL/WebGPU pass) is a large
// dependency we will not pull from a CDN (CLAUDE.md: static files, no CDN, prefer
// zero deps). Faking it would be dishonest. So this module documents exactly what
// a future integration needs and provides a single, safe hook that no-ops today.
//
// WHAT A REAL INTEGRATION NEEDS (the TODO, also in README-3D.md):
//   1. A vendored splat renderer (e.g. a self-contained WebGL gsplat renderer),
//      placed under maps/vendor/ with its licence — NO CDN, NO build step.
//   2. A loader for `.splat` (packed) and/or `.ply` (Gaussian) point clouds:
//      parse position, scale, rotation (quat), colour (SH0) and opacity per
//      splat. These are binary formats — use a DataView, never string parsing.
//   3. A MapLibre CustomLayerInterface (type:'custom', renderingMode:'3d') that
//      shares the map's WebGL context + the map's view/projection matrix so the
//      splats sit in the same space as the terrain/buildings, georeferenced by an
//      anchor lng/lat + a local ENU frame.
//   4. Depth-sorting the splats against the camera each frame (the expensive bit)
//      and respecting the map's depth buffer so terrain occludes splats correctly.
//
// Until then, `addSplatLayer` returns false and surfaces an honest message.

export const SPLATS_SUPPORTED = false;

// Hook a maps-app instance might call. Returns false (not added) and explains.
// Kept here so the rest of the app has a stable, documented seam to fill later.
export function addSplatLayer(/* map, { url, anchor } */) {
  return {
    added: false,
    reason: 'Gaussian splats are not yet implemented — see maps/js/splats.js and maps/README-3D.md for what a future integration requires.',
  };
}
