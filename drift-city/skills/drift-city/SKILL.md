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
   `common.wgsl`. A local variable named `u` hides the uniform block `u` (and `u.time` then fails to compile).
2. **Figures** (seconds): `drift-city/tests/walkers.html?t=3` in that browser. It takes `pedFigure` and its helpers
   out of `scene.wgsl`, draws the five kinds of walker, coloured by part, from the side (forward = right) and from
   three-quarters front,
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

A second way to walk backwards: each walker's place in the line drifts (a slow noise) and sways (a sine), and both
move it along the ring. Before September 2026 they did not scale with the pace, so a slow walker (0.5 m/s) could be
overtaken by its own wobble (up to 0.88 m/s) and slide backwards while facing forwards: 8% of walkers, 0.17% of the
time, measured with a copy of the formula in JS. Both now scale with the pace, so the wobble can never exceed 0.77 of
it. Keep any new motion term below the pace, and check facing numerically rather than from screenshots: at walker
scale a still frame cannot show which way a figure moves.

Kinds (`pedKind`): 0 exoskeleton with rider, 1 android, 2 loper in weighted boots, 3 cape glider, 4 skater on a
cable. Lanes where `pedPulley` is true have a cable at 4.4 m and only skaters, each on a tether and pulley, at 2.6
times the pace.

The people share one rig, `pedHuman`: tapered limbs (`sdRC`, a round cone), knees and elbows placed by two-bone
reach (`ik2`) from where the gait puts the feet and hands, a shaped pelvis, abdomen and chest, and the upper body
leaned about the hips (`pedUpper` / `pedUnlean` convert to and from that frame). `HP` holds the pose: stride, foot
lift, arm swing, bulk (a suit is 1.3), lean, sideways push, trailing legs, arms out, one arm reaching up. Each kind
dresses it: helmets, packs, boots, cape, skates, tether. The android and the exoskeleton build their own bodies.

Materials go by part, not by height: every piece is wrapped in `pp(distance, id)`, and the material sets `gPT`,
calls `pedQ` and reads the id of the nearest piece from `gPP` (ids listed above `pedHuman`). A new piece needs an id,
or it takes the colour of whatever is nearest. `pedQ` skips the body entirely unless the point is within 0.25 m of a
box round the figure, so the richer bodies cost nothing measurable: 273 ms against 262 to 272 ms per frame at
`market_3`, 800x500, on lavapipe.

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

## Sound

`src/audio.js` synthesises everything live and places it with HRTF panners; `audioStep` runs the mix from a
description of the surroundings that `audioWorld` in `main.js` builds twice a second.

- **All speech is radio.** Everyone outdoors is in a pressure suit, so voices reach Pip over suit radios: the babble
  input `AU.babbleF` is a radio chain (330 Hz to 3 kHz, a presence peak, soft clipping, then a gain of 0.5 because the
  clipper's curve lifts quiet speech about 2.6 times). `auPhrase` keys up with squelch (`auKey`), loses syllables to
  crackle on a poor set, and keys down, sometimes with a roger beep. Put any new speech through `AU.babbleF`.
- **Story dialogue** is tagged in the story: `# voice: <who>` at the end of the line. `AU_VOICES` holds each
  speaker's pitch, pace and radio set (0 clean, 1 old): Castellane's set is clean, Wren's and Tam's are not. The line
  is queued after the one before it and comes from the nearest story person, or from just in front of Pip.
  A line ending in a divert needs the divert on the next line, or it becomes part of the tag.
- **Footfalls by kind**, at rates in proportion to the walker mix: `auClank` (exoskeleton), `auServo` (android),
  `auBoots` (weighted boots), `auCape` (glider), `auBuzz` (pet drone). The skaters' cables and the dorms are looping
  sources; `audioWorld` finds the real cables with the same hash as `pedPulley`, and the nearest dorm block (zone 6).
- **Check offline:** `tests/audiotest2.mjs` renders 36 seconds with node-web-audio-api and reports loudness, peak and
  which events fired per scene. It needs `setTimeout` mapped to the offline clock, or every syllable scheduled with
  `setTimeout` fires in real time and the render misses it (September 2026: added to the harness). Compare loudness
  against the previous `audio.js` before and after a change; the radio chain first made the street 3.7 dB louder.

## Look: focus, snow, what the city is made of

- **Focus** (`comp` in `post.wgsl`): depth is in the alpha of the anti-aliased image. `u.reg2.z` is the focus
  distance the page asks for (`focusTarget` in `main.js`: the nearest story person or clue near the middle of the
  view), 0 means "whatever is at the centre"; `u.reg2.w` is the strength. Shallow focus is for story moments
  (strength 1 in a visit or with a story subject in view); in flight it goes deep (0.3 when slow, 0 at 25 m/s), because
  depth of field during navigation hurts judging where you are. In-focus pixels get a harder unsharp mask; out of
  focus an 8-tap blur that down-weights sharper foreground taps. `u.reg.z`, `u.reg2.z/w` were the last free uniform
  slots; `u.reg2.z` and `u.reg2.w` are now taken.
- **Snow** is drawn in `comp` too: six layers from big out-of-focus flakes at the lens to far specks, each flake a
  tumbling ellipse, some in clumps of two or three. At speed the near layers streak along the camera's own motion
  (sideways travel, and outward from the centre with forward travel), from `u.camPos - u.prevPos`.
- **Crystals and rings** were everywhere; they now mark places. Crystal towers are three times rarer outside the
  crystal gardens (zone 7), crystal crowns on roofs rarer, plaza crystals only in zone 7. Megatowers (giants) went
  from 28% to 12% of 8x8 regions, and only about a third wear a ring. `giantHas` exists in `world.js` AND as
  `giantHasW` in `scene.wgsl`, plus the ground glow at `hsh(bg, 20)`: change all three together.

## Art direction (owner-endorsed, September 2026)

From two outside reviews the owner agreed with. Read before adding anything visual.

**Stop adding new visual motifs.** The city has more than enough vocabulary. The next gains come from composition,
rarity, spatial organisation, material consistency, weather interaction and authored geography.

1. **One dominant idea per view.** Each district: one dominant visual idea, two supporting motifs, and a lot of
   ordinary fabric. Weirdness has value only against the ordinary.
2. **Rarity makes landmarks.** One ringed tower seen across half the city is geography; many ringed towers are
   noise. Same for crystals, pagodas, dishes, giant trees.
3. **Accumulated, not generated.** Repetition shows the generator (the banded cylindrical towers most of all). Prefer
   asymmetry: rebuilt blocks, one-off additions, utility structures, bridges, small things attached to big ones.
4. **Scale anchors.** Storey heights, windows, lamps, railings, vehicles and people make big things read as big. Keep
   the vertical scale; it is one of the strongest features.
5. **Street level needs more density than altitude**: signage, awnings, pipes, doors, cables, steam, snow drifts,
   puddles, parked drones, heat shelters.
6. **Timing gives scale.** Snowflake 0.1-1 s; small flier gesture 0.2-0.8 s; Pip manoeuvre 0.5-3 s; local vehicle
   2-10 s; airship 10-60 s; weather 30-180 s; sky minutes. If everything moves at one speed, scale collapses.
7. **Anticipate and settle.** Things signal before they move (a flier banks before it turns) and do not stop all at
   once (roll settles, snow keeps streaming). Ease almost everything; keep a few things abrupt for contrast.
8. **Arcs, not rails**, for organic motion and assisted camera moves.
9. **Secondary action has a budget**: per view, one primary action, one or two secondary, ambient texture.
10. **Exaggerate what is Titan and the story**: heat against cold, dense slow air, low gravity, methane weather,
    enormous distance, small fragile warmth, Saturn's size. Do NOT mainly exaggerate neon, rings, crystals, glow.
11. **Atmospheric perspective before blur**: with distance, lower contrast, saturation, emissive strength and fine
    detail; keep silhouettes clean.
12. **Light states need depth planes.** Night works (cyan infrastructure, warm windows, pink fliers, deep blue air).
    Day pushes everything into one honey-brown range; foreground local colour and contrast must survive the orange.
13. **Restraint with the sky**: Saturn, airships and searchlights are events, not wallpaper. Occlusion, haze and time
    of day should ration them.
14. **Appeal test** for every asset family: would someone remember one silhouette of it tomorrow? Wren, the nest, the
    radio, the pagoda, the tea stall and the fliers pass; a generic banded tower does not.
15. **Labels**: give a place name you could tell someone ("Amber Walk, Chinatown"), not drone state.

Open work the reviews name, not done yet: the smaller authored city on Kraken Mare's shore (districts told apart by
form, not palette: market tight and steamy, civic centre axial, Lumen severe, forest edge overgrown, dish district
sparse and windy); the tube network's structure (supports, junctions, stations); snow settling on ledges and melting
round warm things (heat as a visual language); clouds as weather masses rather than floating props; day-light tonal
separation; a weak composition assist (candidate subjects ahead, gentle bias of pitch and focus, never a lock-on).

## Size and the lite variant

`scene.wgsl` is an ubershader of about 4,700 lines. Some mobile drivers fail to build it; the page then retries with
`?lite`, which replaces the bodies of `pedQ`, `laneQ`, `propSDF` and others with stubs (`main.js`, `stubFn`). New
helper functions that only a stubbed function calls stay in the shader unused, which WGSL allows. Keep additions
small, and keep them inside functions the lite list already stubs where possible.
