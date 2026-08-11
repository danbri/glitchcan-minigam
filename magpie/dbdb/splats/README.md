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

## garden-sog/ — Botanical Garden Kiel, Victoria House (Aug 2026)
"Botanical Garden - Victoria House (VR Ready)" by **Simon Bethke**
(superspl.at/scene/6f697c4d), **CC BY 4.0** (license link on the scene
page). This is the COARSEST LOD tile of the scene's streaming-SOG form
(200k gaussians, ~2.3MB: meta.json + 5 webp planes) — the whole
glasshouse in one budget-friendly bundle. The shN (higher-order SH)
entry was stripped from meta.json since we render degree 0; that also
avoids shipping two more webp files. Attribution is rendered on the
in-dream terminal itself and recorded here. PlayCanvas loads the
unbundled meta.json directly as a 'gsplat' asset.

## forest.sog + carshop.sog — SuperSplat gallery finds (Aug 2026)
Discovered by driving a headless browser at the superspl.at gallery
(via the session proxy) and cataloguing every scene page's rel=license
link. Both **CC BY 4.0**:
- `forest.sog` — "Forest path" by **Pavel Tanhäuser**
  (superspl.at/scene/2be1a75a). Tile 0_0 of the streamed scene (624k),
  converted with splat-transform and random-subsampled to 208k → one
  2.4MB .sog bundle.
- `carshop.sog` — "Nelson Ghost Town, Car Shop" by **Paolo Tosolini**
  (superspl.at/scene/dd8d9c8b). The coarsest LOD tile (290k of 18.6M!)
  repacked as one 3.3MB .sog bundle.
Attribution renders on each in-dream terminal crest. Note: the earlier
"splat-transform cannot read LOD tiles" claim was wrong — it failed
only because the shN files had not been downloaded yet.
