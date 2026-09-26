# Drift city

A raymarched city on Titan in a single self-contained web page (WebGPU, with a WebGL fallback), with a story told in
Ink, procedural spatial audio, and the Saturn system around it.

## Build

    python3 tools/assemble.py        # bakes the story places, then writes dist/city.html

Requires Python 3 and Node. The page loads inkjs 2.4.0 from jsDelivr at run time; everything else is inlined.
Building from this tree reproduces the published page exactly.

## Layout

- `src/` everything that goes into the page
  - `common.wgsl` shared uniforms and helpers; `scene.wgsl` the city (tracing, shapes, materials, effects);
    `space.wgsl` Titan from orbit, Saturn, the rings and moons; `post.wgsl` anti-aliasing, bloom and grade
  - `world.js` the procedural world: city blocks (`cellAt`), megatowers, terrain on the sphere (mirrored in WGSL)
  - `titan.js` navigation (trips, orbit, free flight, visits), the menu, quick hops, the opening page and sequence
  - `tales.js` the 50 story places, the Ink story panel, props, hotspots, the live bridge to the story
  - `tales.ink` the story, "The Lamplighter's Last Round"
  - `audio.js` synthesised, placed (HRTF) sound; `main.js` WebGPU setup, the frame loop, the events director
  - `fallback.js` the WebGL fallback; `head.html` markup and styles; `tables.js` glyphs and words for lettering
  - `geo_*.json` anchor frames for regions of Titan
- `tools/` the build (`assemble.py`, `bakeplaces.js`)
- `tests/` harnesses used during development; their paths to Dawn, wgpu-py and node modules need adjusting
  - `dawn-run.mjs` runs the page headless on Dawn (Node WebGPU) with a fake DOM; environment variables choose the
    scenario (TALE, INTRO, GATEONLY, HOP, GO, LITE, FAILFULL, FOLLOW, MENU)
  - `render3.py` renders single views of the scene shader with wgpu-py (with `gencells.js`, `ffgen.js`, `presets.py`)
  - `inkwalk.js` plays the story 400 times with random choices and discoveries, checking endings and dead ends
  - `audiotest2.mjs` renders the sound engine offline (node-web-audio-api) and measures levels
  - `smooth.js` measures per-frame camera jolts on trips
- `docs/` design notes by development wave
- `dist/city.html` the current built page (ignored by git; rebuild with the command above)

## How things are represented

- Layout is procedural data. `cellAt(x, z)` is a pure function of hashes giving a record per 26 m block (type,
  height, district, flags, landmark, trees), packed into a texture window. Megatowers use a coarser hash grid.
  Terrain is a pure function of position on the sphere, written in both JS and WGSL, evaluated on the GPU into a
  height pyramid.
- Small tables go to the GPU as uniform buffers: Titan's surface features, time-of-day palettes, glyphs and words,
  fliers, up to 32 props, event parameters. The 50 story places are baked to JSON at build time.
- Shapes and materials are code. Each building type, landmark, set piece, tree, vehicle, walker and prop is an SDF
  function; materials are one large switch in `surface()`.
- The scene shader is therefore an ubershader (about 4,450 lines). Some mobile drivers fail to build it; the page
  then retries with a lighter variant (optional effects stubbed out; force it with `?lite`), then falls back to WebGL.

## Planned refactor

1. Split tracing from shading: a trace pass writes a G-buffer (depth, normal, material id, object id, local
   coordinates on the object), a shading pass runs the materials, an overlay pass adds tubes, fliers, props and
   effects. Keep the G-buffer contract generic, so shapes can later come from data (for example Lucid SDF
   definitions), baked distance-field textures, or splats.
2. Bin materials by class and shade each class with its own small kernel.
3. Materials as a data table plus a small parametric pattern library.
4. Static shapes (landmarks, set pieces, props) as data, baked into a distance-field atlas at load.
5. Assemble shaders from modules with feature flags (quality tiers), replacing the stubbing used by `?lite`.
6. One source for terrain, generating both the JS and the WGSL.

Before starting, render a reference set of views with `tests/render3.py` and keep them, so each step can be compared
against the current output.
