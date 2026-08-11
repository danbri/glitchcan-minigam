# Gaussian splat assets

- `christmas-tree-150k.splat`, `christmas-tree-400k.splat`
  - Source: **ChristmasTree.splat** from
    https://huggingface.co/keijiro-tk/splat-data (Keijiro Takahashi),
    captured via Polycam, published "for testing purposes".
  - License: **The Unlicense** (public-domain equivalent), as declared on
    the repository. Attribution not required; recorded here as provenance.
  - Processing: the antimatter15-format `.splat` file is sorted by splat
    significance, so these are simple prefix truncations of the 1.77M-splat
    original (LOD cuts at 150k and 400k) made with a 6-line Node script.

## compressed.ply variants (Aug 2026)
`christmas-tree-{150k,400k}.compressed.ply` are the same LOD cuts converted
with `npx @playcanvas/splat-transform` for the PlayCanvas gsplat renderer
(`dream.html`). Coordinates verified byte-identical to the .splat sources
(no axis change). Smaller than the .splat originals (2.3MB / 6.2MB).

## More ports (Aug 2026, all CC-permissive)
- `guitar.compressed.ply`, `biker.compressed.ply`, `skull-120k.compressed.ply`
  — from the PlayCanvas engine examples (github.com/playcanvas/engine,
  MIT). The skull was subsampled 247k→123k gaussians for mobile weight.
  Wired as dream destinations in `dream.html` (SCENES table: per-scene
  up-axis, centre, radius, palette); each candy PET dials a different port.
