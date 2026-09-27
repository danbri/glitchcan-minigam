# Drift city

A raymarched city on Titan in a single self-contained web page (WebGPU, with a WebGL fallback), with a story told in
Ink, procedural spatial audio, and the Saturn system around it.

## Build

    python3 tools/assemble.py        # bakes the story places, then writes dist/city.html

Requires Python 3 and Node, with the repo's `npm ci` done (the tools use `inkjs` and `packages/backticks`).

The stories are not inlined. When the story panel opens, the page fetches the chosen story from `story/`, runs it in a
sandboxed iframe with the frozen capture from `packages/backticks` (the same capture the Finkosphere story runner
uses), and compiles the ink it gets back. The ink runtime comes from `third_party/ink/ink-full.js`, with jsDelivr
(inkjs 2.4.0) as a fallback. So the page needs the repo around it and an HTTP server; the story does not work from
`file://`. Everything else is inlined.
Building from this tree reproduces the published page exactly.

## Layout

- `src/` everything that goes into the page
  - `common.wgsl` shared uniforms and helpers; `scene.wgsl` the city (tracing, shapes, materials, effects);
    `space.wgsl` Titan from orbit, Saturn, the rings and moons; `post.wgsl` anti-aliasing, bloom and grade
  - `world.js` the procedural world: city blocks (`cellAt`), megatowers, terrain on the sphere (mirrored in WGSL)
  - `titan.js` navigation (trips, orbit, free flight, visits), the menu, quick hops, the opening page and sequence
  - `tales.js` the 50 story places, the Ink story panel, props, hotspots, the live bridge to the story
  - `audio.js` synthesised, placed (HRTF) sound; `main.js` WebGPU setup, the frame loop, the events director
  - `fallback.js` the WebGL fallback; `head.html` markup and styles; `tables.js` glyphs and words for lettering
  - `geo_*.json` anchor frames for regions of Titan
- `story/lamplighter.fink.js` the first story, "The Lamplighter's Last Round", as a FINK file (Ink inside an `oooOO` block)
- `story/episodes.fink.js` the front door: links to each episode (`# FINK:` tags; the page follows them)
- `story/peraspera.fink.js` the second story, "Per Aspera": dive bars, the Asters, and a jazz club in the Warmhouse
- `tools/` the build (`assemble.py`, `bakeplaces.mjs`) and `story.mjs`, which captures the story's ink with
  `packages/backticks` and compiles it with inkjs for the Node tools
- `tests/` harnesses used during development; their paths to Dawn, wgpu-py and node modules need adjusting
  - `dawn-run.mjs` runs the page headless on Dawn (Node WebGPU) with a fake DOM; environment variables choose the
    scenario (TALE, INTRO, GATEONLY, HOP, GO, LITE, FAILFULL, FOLLOW, MENU), the size (W, H, DPR), FREEZE (stop the
    clock after frame 12 so anti-aliasing settles on a still scene) and OUT (where the raw frame goes)
  - `walkers.html` draws the five kinds of walker from `scene.wgsl`, side and three-quarter views (WebGPU)
  - `render3.py` renders single views of the scene shader with wgpu-py (with `gencells.js`, `ffgen.js`, `presets.py`)
  - `inkwalk.mjs` plays the story 400 times with random choices and discoveries, checking endings and dead ends
  - `audiotest2.mjs` renders the sound engine offline (node-web-audio-api) and measures levels; AUDIO= another
    audio.js to compare against, WAV= a file to write the render to
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
