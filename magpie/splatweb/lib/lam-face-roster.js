// Shared face roster + path resolver for the LAM "treatment" demos
// (demo-lam-arch-*.html). Lets any treatment shell accept a `face` id and
// load ANY of the 54 synthetic LAM avatars, instead of one hardcoded face
// per demo — treatment and face are independent choices.
//
// Three folder shapes exist on disk:
//   third_party/lam-sample/                       — 1 face, own skin.glb
//   third_party/lam-synth-faces/<id>/              — 4 faces, own skin.glb each
//   third_party/lam-synth-faces-tpdne/<id>/         — 50 faces, offset.ply ONLY
//     (share the one skin.glb in lam-sample/ via loadLamAvatar's meshBase —
//     added this session specifically so 50 offset.ply files don't each
//     duplicate a 3.6MB mesh)
//
// EXCLUDED (owner: this is a "timeless" game, skip visibly modern styling —
// glasses and ballcaps read as 2020s-photographed, not a period/timeless
// look; ethnic/skin-tone diversity across the remaining set is unaffected
// and explicitly wanted). Screened from a contact sheet of the source
// photos, NOT re-rendered per-face — a spot check, not exhaustive proof for
// every one of the 54.
const EXCLUDED_TPDNE = new Set([3, 11, 12, 13, 15, 18, 19, 22, 25, 33, 38, 49]);

export const FACES = [
  { id: 'sample', label: 'sample (bundled)' },
  { id: 'boy1', label: 'boy1' },
  { id: 'man2', label: 'man2' },
  { id: 'woman1', label: 'woman1' },
  { id: 'lightbrownhairwoman', label: 'light brown hair woman' },
  ...Array.from({ length: 50 }, (_, i) => i + 1)
    .filter((n) => !EXCLUDED_TPDNE.has(n))
    .map((n) => ({ id: `tpdne-${String(n).padStart(2, '0')}`, label: `tpdne-${String(n).padStart(2, '0')}` })),
];

// {base, meshBase} for loadLamAvatar(base, {meshBase, ...}).
export function resolveFace(id) {
  if (id === 'sample') return { base: 'third_party/lam-sample/', meshBase: 'third_party/lam-sample/' };
  if (['boy1', 'man2', 'woman1', 'lightbrownhairwoman'].includes(id)) {
    return { base: `third_party/lam-synth-faces/${id}/`, meshBase: `third_party/lam-synth-faces/${id}/` };
  }
  if (id.startsWith('tpdne-')) {
    return { base: `third_party/lam-synth-faces-tpdne/${id}/`, meshBase: 'third_party/lam-sample/' };
  }
  throw new Error(`unknown face id: ${id}`);
}
