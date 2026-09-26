---
name: drift-city
description: Work on drift-city/ — the raymarched city on Titan (WebGPU ubershader with a WebGL fallback) and its Ink story. How to build it, how to SEE a shader change in this container (WebGPU in software, two ways), the walker figures and the frame rule behind the "robots walk backwards" bug, the Titan design brief (gravity, air, cold, sealed traffic tubes), the dorms district, and what the ?lite variant stubs out. Use this when editing drift-city/src/*.wgsl or *.js, adding or restyling people, robots, vehicles or buildings, checking a render headless, or rebuilding dist/city.html. Story-to-world sync is the story-game-sync skill.
---

# Drift city

The page is `drift-city/dist/city.html`, built by `python3 drift-city/tools/assemble.py` from `src/`. The build
inlines the shaders and scripts; the story stays outside, in `story/lamplighter.fink.js` (see the `story-game-sync`
skill for how the page and the story talk). Rebuild and commit `dist/city.html` after every change to `src/`:
GitHub Pages serves the committed file.

## Seeing a shader change

The scene is WGSL. Plain headless Chromium has no WebGPU, so the page quietly runs its WebGL fallback, which draws
the city as plain blocks and none of the people, vehicles or materials. A screenshot from that path verifies nothing
about `scene.wgsl`. Three checks that do work here (September 2026):

1. **Compile** (seconds): Chromium with `--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader
   --enable-features=Vulkan --use-vulkan=swiftshader --enable-unsafe-swiftshader`, on an http:// page, then
   `createShaderModule({code: common + scene})` and `getCompilationInfo()`. Line numbers count from the start of
   `common.wgsl`.
2. **Figures** (seconds): `drift-city/tests/walkers.html?t=3` in that browser. It takes `pedFigure` and its helpers
   out of `scene.wgsl`, draws the five kinds of walker from the side (forward = right) and from three-quarters front,
   and copies the pixels to a 2D canvas, because `page.screenshot` returns a WebGPU canvas as transparent.
3. **The whole city** (1 to 4 minutes): `tests/dawn-run.mjs` on Node Dawn. In a scratch directory run
   `npm i webgpu`, install Mesa's software Vulkan (`apt-get install -y mesa-vulkan-drivers`), and run the harness
   from there with `HOP=place:<id> W=800 H=500 DPR=1 FRAMES=36 FREEZE=1 OUT=<dir>`. It writes `frame.rgb` (raw RGB)
   and `frame.json` (size). About 0.25 s per frame after a 2-minute first-frame compile. `FREEZE` stops the clock
   after frame 12: without it, temporal anti-aliasing smears every moving figure into a blur. Place ids are in
   `src/places.json` (`market_3` for walkers and skaters, `street_1` for gliders and androids, `street_6` for the
   dorms).

The full page in Chromium on SwiftShader did not produce one frame in ten minutes. Use Dawn for the city.

## Walkers: the frame rule

`pedQ` in `scene.wgsl` puts walkers on two rings round each block, one lane each way (`dir` = +1 or -1). Each
figure is built in its own frame: x across the ring, y up, **z the way it walks**. The ring coordinate `ds` grows
the same way in both lanes, so the local z must be `dir * ds`. The original code used `ds` for both lanes, and every
walker on the outer ring moved backwards. Any new kind of figure must face +z, and any change to the lane maths must
keep `q.z = dir * (ds - sway)`.

Kinds (`pedKind`): 0 exoskeleton with rider, 1 android, 2 loper in weighted boots, 3 cape glider, 4 skater on a
cable. Lanes where `pedPulley` is true have a cable at 4.4 m and only skaters, each on a tether and pulley, at 2.6 times the pace. The material
(`case 24` in the surface switch) recomputes kind, phase and lift from the same functions, and keys colours on height
above the pavement minus `pedLift`. If a figure's proportions change, change the material's height bands with it.
The android is built at 1.12 scale, so its bands divide by 1.12.

Height limits that must agree: `pedQ` returns early above 4.6 m, the map calls it below 4.7 m, and the walker trace
band in the primary trace clips at 4.7 m. The cable was first at 2.9 m and showed as a black bar across any view
from a place under it. A taller figure needs all three raised.

## Titan design brief

- Gravity is about a seventh of Earth's; the air is four times as dense and at -179 °C. People outdoors wear pressure
  suits and bubble helmets. They lope with a hang in each stride and wear weighted boots for grip. Thin people can
  glide on wing-capes (in air this dense, human-powered flight is plausible).
- Traffic runs in sealed, heated glass tubes about 11 m up (`carsQ`, `tubesFx`). Nobody rides on the outside of a
  vehicle. Vehicles are streamlined in the old style: teardrop bodies, canopies, tail fins, chrome speed stripes.
- Robots are expensive and meant to be seen: lacquer, chrome, brass or porcelain, lit seams, a ring behind the head
  on the grander ones. They are over-built for the gravity, so they move in small exact steps.
- Most people stay home under headsets. They live in the dorms (zone 6, `ZONE_NAMES` "Dorms"): residential slabs of
  capsule homes, two to a floor, each with one round window lit by a flickering headset screen at any hour.

## Size and the lite variant

`scene.wgsl` is an ubershader of about 4,700 lines. Some mobile drivers fail to build it; the page then retries with
`?lite`, which replaces the bodies of `pedQ`, `laneQ`, `propSDF` and others with stubs (`main.js`, `stubFn`). New
helper functions that only a stubbed function calls stay in the shader unused, which WGSL allows. Keep additions
small, and keep them inside functions the lite list already stubs where possible.
