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

### Planted feet: the gait runs on distance, not time

Walking kinds (exoskeleton, android, loper) take their gait phase from the distance walked (`pedGait`), not the
clock: one cycle is `gaitLen` metres, each foot is down for the first `gaitSf` of its cycle and sweeps back
`2 * gaitS` in that time, so the planted foot moves back exactly as fast as the body goes on, whatever the speed.
The distance is the ring drift plus `dir * sway` (the same terms that move the walker in `pedQ`). Before September
2026 the feet followed `sin(phase)` on a fixed clock, so they slid on the ground, and the loper's whole body, feet
included, rose 0.3 m off it every step: "figures float around". Only the body bobs now (`gaitBob`, `hp.bob`, which
`pedFoot` takes off the foot height). Gliders and skaters are not walking and keep the old sweep (`hp.sf = 0`).
`tests/walkers.html` walks the figures at the ground stripes' 1.1 m/s, so a planted foot must hold still on a stripe;
`?zoom=0.45` comes closer.

## Titan design brief

- Gravity is about a seventh of Earth's; the air is four times as dense and at -179 °C. People outdoors wear pressure
  suits and bubble helmets. They lope with a hang in each stride and wear weighted boots for grip. Thin people can
  glide on wing-capes (in air this dense, human-powered flight is plausible).
- Traffic runs in sealed, heated glass tubes about 11 m up (`carsQ`, `tubesFx`). Nobody rides on the outside of a
  vehicle. Vehicles are streamlined in the old style: teardrop bodies, canopies, tail fins, chrome speed stripes.
- Robots are expensive and meant to be seen: lacquer, chrome, brass or porcelain, lit seams, a ring behind the head
  on the grander ones. They are over-built for the gravity, so they move in small exact steps.
- Work is one of two kinds. Physical work on Titan is hard, and most affordable bots and exos cannot do it: it goes
  to the few with the good machines (hence "EXO HIRE", "HEAVY LIFT"). The rest is nominal: checking spreadsheets
  and signing them off for the Org, for legal compliance nobody remembers the reason for, done from bed ("WORK FROM
  BED", "SIGN OFF", "ORG APPROVED").
- Most people stay home under headsets. They live in the dorms (zone 6, `ZONE_NAMES` "Dorms"): residential slabs of
  capsule homes, two to a floor, each with one round window lit by a flickering headset screen at any hour.

## Sound

`src/audio.js` synthesises everything live and places it with HRTF panners; `audioStep` runs the mix from a
description of the surroundings that `audioWorld` in `main.js` builds twice a second.

- **Sounds come from what you see.** Footfalls are placed and timed by the walkers themselves: `walkerAt` /
  `walkersNear` in `main.js` mirror `pedQ` exactly (same hashes, same drift noise, the inverse of its ring
  coordinate), and `audioFeet` plays a step at the walker when its gait phase crosses a half cycle (a walking kind's
  foot landing; a glider's landing once per hop). Before September 2026 steps played at random pavement points, so
  what you heard never matched what you saw. Checked by projecting the JS walkers onto a Dawn frame (`WALKERS=1` in
  the scratch runner): within about a metre of the drawn figures. Change `pedQ`'s placement and you must change
  `walkerAt` with it.
- Story voices: each speaker is tied to one person in the scene for as long as the scene lasts, looked up when the
  line is spoken (`taleVoiceAt`); "you" is inside your own helmet. Before, every speaker came from the nearest
  figure, from a person list up to half a second stale.
- The listener is at the camera: behind the drone in the follow view, not at the drone.
- The WebGL fallback runs no audio at all (it never did).

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

## Feeling the choices (`src/feel.js`)

A thumb slid over the story's choices feels which one it is on, so a player can choose while watching the city:
four haptic textures (a rhythm of ticks per choice: slow single, double, fast grain, triple burst), a quiet tone
for each on the cue bus, a short buzz when the thumb crosses into the next choice, and lifting the thumb on a choice
takes it. A quick tap is left to the button's own click (and the click after a slide is swallowed, so nothing is
chosen twice). The list scrolls while the thumb rests near its top or bottom edge; on a phone the default panel
shows only one or two choices at a time. Menu > Story > "Feel the choices" switches it off (`drift.feel`).

- Android has `navigator.vibrate`; iOS Safari does not. On iOS each tick is the system haptic of a hidden
  `<input type="checkbox" switch>` being toggled (`feelSwitch`), which iOS 18 Safari plays; older iPhones get
  only the tones. NOT verified on a device from this container.
- Test: a touch slide dispatched on `#taleChoices` with `navigator.vibrate` stubbed to a log (synthetic events are
  not captured, so dispatch moves on the list itself, as pointer capture does on a real device).

## Look: focus, snow, what the city is made of

- **Focus** (`comp` in `post.wgsl`): depth is in the alpha of the anti-aliased image. `u.reg2.z` is the focus
  distance the page asks for (`focusTarget` in `main.js`: the nearest story person or clue near the middle of the
  view), 0 means "whatever is at the centre"; `u.reg2.w` is the strength. Shallow focus is for story moments
  (strength 1 in a visit or with a story subject in view); in flight it goes deep (0.3 when slow, 0 at 25 m/s), because
  depth of field during navigation hurts judging where you are. In-focus pixels get a harder unsharp mask; out of
  focus an 8-tap blur that down-weights sharper foreground taps. `u.reg.z`, `u.reg2.z/w` were the last free uniform
  slots; `u.reg2.z` and `u.reg2.w` are now taken.
- **Snow** is drawn in `comp` too, as flakes in the WORLD (`snowLayer`): four nested 3D grids (0.6, 1.3, 5 and 16 m
  cells, out to 4, 12, 50 and 200 m) that the view ray steps through cell by cell, at most one flake per cell. The
  grids fall and drift with the wind (`u.p6`, `u.p7`, the page's accumulated wind), so flakes keep their place as the
  camera moves, and the scene depth (`srcTex.a`) hides flakes behind things. Each flake is drawn along the camera's
  travel this frame (`u.camPos - u.prevPos`), which gives streaks in flight with no screen-space rule.
  What went wrong before (September 2026, seen on a phone): the snow was layers in view-direction space (azimuth,
  elevation). Flakes stayed put on screen when the camera moved, streaks were cut off square at their grid cells into
  rectangles ("sheets of ice"), and the grid pinched to a point looking straight up or down, which read as lens
  distortion. Two rules from that: never map a world effect by view angle; and a mark drawn in a grid cell must stay
  inside that cell (clamp streaks to 0.3 of the cell). Reproduce headless: `SNOW=1 MOVE=0,-2 CAM=...` in
  `tests/dawn-run.mjs`.
- **Weathering** (`weathering`, after `frostify`, first hit only, fading out by 170 m): tone mottling, tholin dust on
  whatever faces up, streaks down walls, grime at street level, and a bumped normal from `vn3` (3D value noise with
  its analytic gradient: one call gives the pattern and the bump). Glass gets a film only; lit signs and screens are
  skipped; walkers get only a fabric weave and creases. Tree crowns near the camera are displaced by `vn3` into
  clumps of leaves (`treesSDF`), which broke the smooth-blob silhouettes more than any shading did.
- **Crystals and rings** were everywhere; they now mark places. Crystal towers are three times rarer outside the
  crystal gardens (zone 7), crystal crowns on roofs rarer, plaza crystals only in zone 7. Megatowers (giants) went
  from 28% to 12% of 8x8 regions, and only about a third wear a ring. `giantHas` exists in `world.js` AND as
  `giantHasW` in `scene.wgsl`, plus the ground glow at `hsh(bg, 20)`: change all three together.

## Geography (authored, September 2026)

The city was about 12 km across with hashed districts that repeated every 20 km, so nothing could be learned. It is
now laid out by hand. Everything below is in `world.js` unless named; the shape is mirrored in `scene.wgsl`
(`citySdf`, `giantHasW`, the ring) and `fallback.js` (`citySdf`).

- **Shape**: `citySdf` = a core of radius `CITY_CORE` (1700 m, wobbling by a few hundred metres) round the origin,
  united with the harbour arm, a capsule 760 m wide from the origin to `CITY_ARM` (3300, -3300) on the shore of Kraken
  Mare. `cityR` is defined so `cityDist - cityR = citySdf`, which is what every existing "inside the city / how far
  past its edge" test uses; terrain flattens inside and rises over 1400 m outside. Sea lies about 2 km south as well.
- **Districts** (`zoneAt`): financial core in the middle (r < ~480 m), the neon strip along the east-west avenue at
  z of about 40, then by compass bearing: old town and the Assembly Hall north-east (0-115 degrees), dorms south-east
  (115-205), Chinatown south-west (205-290), crystal gardens north-west (290-360); industry then the spaceport along the
  arm. Borders wobble by up to 25 degrees of noise.
- **Placed landmarks**: `PYRAMID_CELL` (the one Lumen pyramid), `PAGODA_CELL` (the one pagoda), `GIANT_BLOCKS` (the
  ringed spire at big block (0, -1)), the Hive (below), the Hall (big block (3, -4)),
  and in the wild `STONES_AT` and `TREEHOUSE_AT`, north-north-east where the story's fliers go. Lattice towers only
  in the core and old town, Ferris wheels and markets only on the strip (and markets in Chinatown), rarely.
- **The Hive**: the cattle-class pod block, the city's main orientation mark. A patched castle 620 x 420 m and 240 m
  tall centred on `HIVE_C` (728, 1248), on the dorms' outer edge, filling big blocks x 2-4, z 5-6 (`hiveHas`). Its
  north and west faces, the ones the nicer city sees, carry five flashing tokes boards (`hiveBoardC`, `hiveBoard`,
  material 56); the shell is material 55 (patched panels, round pod windows lit by headset flicker). Rules for
  changing it: keep the boards clear of the corner towers (x ±255, z ±150, half 38) and keep annexes on those two faces
  below 62 m, or they cover the text. In `scene.wgsl` it is a giant (`giantHasW`, `giantTop` 272, `giantSDF` via
  `hiveQ`); the traversal bounds it by the block square, not the 80 m circle. `farInfo` case 6 uses `hiveTopAt` for
  the far silhouette; the WebGL fallback draws its blocks as plain 240 m slabs. Place "hive" views it from a Lumen roof.
- **Holograms** (`holoFx`, after `tubesFx`): five camera-facing projections with a ground beam: a spinning toke coin
  over the Hive, a headset face, slogan panels over the strip and the dorms. Stubbed in the lite variant.
- **Lettering**: `tools/tables.mjs` draws the glyphs (ASCII art) and lists the words, and writes `src/tables.js`;
  edit the tool, never the output. `tools/assemble.py` puts `tables.js` first in the page. (A stale copy of the table
  once sat in `main.js`; the GPU buffer came out too small for the grown `struct TB` and nothing drew.) The letters
  are square capitals in the style of a ZX81 screen, drawn for this project, and `neonText` draws each cell as a solid
  square so strokes join (it used to be a dot matrix). Glyph ids: A0 B1 C2 D3 E4 F5 H6 I7 L8 M9 N10 O11 P12 R13 S14
  T15 U16 V17 W18 X19, digits 20-29, katakana 30-36, G37 Y38 J39 ?40 K42. Words are referred to by index in
  `scene.wgsl`, so append new ones only, and grow `struct TB`'s `word` array to the count the tool prints.
- **Posters**: `posterLine(kind, line)` gives up to four words per line; kinds 0, 1, 7, 8, 9 are the government's
  emigration campaign, 2 and 3 the cult, 4-6 the tokes trade, 10 the Org's sign-off jobs, 11 exo hire. `posterPick`
  sets the mix (emigration half the time) for megatower screens and the 60% of billboards that show a poster;
  `posterLook` is the shared style for each kind (government blue with a red band and a small Earth; a pale screen
  with a grey chequered border for the Org). The blimp and the strip hologram run the emigration lines; an Earth
  hologram turns 440 m over the core. Keep a line to about 12 characters: the boards are sized for that.
- **Map** (`src/map.js`, Menu > City map): districts, water, forest and highland sampled once from `world.js`
  (about 150 ms), north (-z) up, framed on `MAP.cx, MAP.cz, MAP.R`; landmarks from `mapMarks()` (keep it in step
  with the placed landmarks); your arrow from `MAPCAM`, which `main.js` fills each frame. Under it the same in words
  (district, then each landmark's distance and compass direction), for screen readers. Tapping a landmark hops to its
  place. A global `canvas {position: fixed; inset: 0}` rule in `head.html` catches every canvas: override it.
- **Places**: `buildPlaces` in `tales.js` adds the placed ones directly; its ring scans sample cells and can miss a
  single one. `node tools/bakeplaces.mjs` fails if a place the story uses is missing: run it after any change here.
- **Map for thinking**: an ASCII map of zones, liquid, forest and highland from `world.js` in Node (load it with
  `new Function(src + '; return {...}')`, sample `terrainAt`, `cellAt`, `cityDist`, `cityR`) is the quickest way to
  see a layout change before rendering anything.

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

Open work the reviews name, not done yet: districts told apart by form, not only by building mix (market tight and
steamy, civic centre axial, Lumen severe, forest edge overgrown, dish district sparse and windy); a map in the menu; the tube network's structure (supports, junctions, stations); snow settling on ledges and melting
round warm things (heat as a visual language); clouds as weather masses rather than floating props; day-light tonal
separation; a weak composition assist (candidate subjects ahead, gentle bias of pitch and focus, never a lock-on).

## Size and the lite variant

`scene.wgsl` is an ubershader of about 4,700 lines. Some mobile drivers fail to build it; the page then retries with
`?lite`, which replaces the bodies of `pedQ`, `laneQ`, `propSDF` and others with stubs (`main.js`, `stubFn`). New
helper functions that only a stubbed function calls stay in the shader unused, which WGSL allows. Keep additions
small, and keep them inside functions the lite list already stubs where possible.
