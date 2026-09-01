// models-manifest.js — the vendored third_party models (see
// third_party/ATTRIBUTION.md; licences MUST ship wherever these render).
export const MODELS = [
  {
    id: 'lps',
    name: 'Lee Perry-Smith — head scan',
    url: 'third_party/leeperrysmith/LeePerrySmith.glb',
    attribution: '3D Head Scan by Lee Perry-Smith (Infinite Realities / triplegangers.com) — CC BY 3.0',
    targetHeight: 0.42, defaultCount: 26000, yaw: 0,
    tint: [1.0, 0.8, 0.68],   // the glb ships untextured; tint the sculpture toward skin
  },
  {
    id: 'oldmoustache',
    name: '100Avatars — Old Moustache',
    url: 'third_party/100avatars/100Avatars_004_OldMoustache.vrm',
    attribution: '100Avatars by Polygonal Mind — CC BY 4.0',
    targetHeight: 1.55, defaultCount: 24000, yaw: Math.PI,
  },
  {
    id: 'froggy',
    name: '100Avatars — Froggy',
    url: 'third_party/100avatars/100Avatars_010_Froggy.vrm',
    attribution: '100Avatars by Polygonal Mind — CC BY 4.0',
    targetHeight: 1.45, defaultCount: 24000, yaw: Math.PI,
  },
  {
    id: 'scarecrow',
    name: '100Avatars — Scarecrow',
    url: 'third_party/100avatars/100Avatars_042_Scarecrow.vrm',
    attribution: '100Avatars by Polygonal Mind — CC BY 4.0',
    targetHeight: 1.6, defaultCount: 24000, yaw: Math.PI,
  },
];
