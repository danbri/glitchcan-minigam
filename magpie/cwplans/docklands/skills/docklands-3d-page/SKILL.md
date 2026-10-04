---
name: docklands-3d-page
description: >-
  Work on the Docklands 3D page, magpie/cwplans/docklands/index.html: one WebGL1 file with seven shader programs.
  Covers the vertex formats (Mesh, MeshF, the u coordinate, the alpha byte that is NOT opacity, the g attribute
  that carries building use and roof top), picking, the drawer, record card, search, press-and-hold routes,
  gestures (labels must still join a pinch), music and the phone audio rules, the styles (map, isometric pixel art
  with materials, photo facades with mip LOD, Gaussian splats including the trained set, glow chips), Night mode
  (lit windows by use, the Air Navigation Order aviation-light rule, riverside lamps, glitter-path reflections,
  bloom, the photo views ?view=rotherhithe|greenland|pier and their calibration against the owner's photos), the
  fp16 / highp fault that left phones dark, and how to test a visual change headless (SwiftShader, renderNow and
  toDataURL, two sizes x two pixel ratios x the photo views, numbers not one look). Reach for it before you edit
  docklands/index.html, add a layer or a style, change a shader, judge a render, or push a page change. The sky,
  clock, weather and tide have their own skill (pending). Append to the curation skill's ACTIVITY-LOG.md.
---

# The Docklands 3D page

Live: https://danbri.github.io/glitchcan-minigam/magpie/cwplans/docklands/
(night from the river: https://danbri.github.io/glitchcan-minigam/magpie/cwplans/docklands/?view=rotherhithe).
Data and method notes: https://github.com/danbri/glitchcan-minigam/blob/master/magpie/cwplans/docklands/README.md.
Data policy, the fault register and the activity log are in the hub skill `docklands-data-curation`
(`magpie/cwplans/skills/docklands-data-curation/`). Append what you did to its `ACTIVITY-LOG.md`.

Everything below was read from the code on 2026-10-04 (HEAD 2cf7d2a plus another agent's uncommitted sky work).
Counts marked "measured" were run that day with the recipe in "Testing".

## Ship at once, and re-read the whole line

Owner, 2026-10-03: "shipping immediately to live site is fine and urgent. Don't batch things up, as live site is my
only way to see progress." Commit and push each working change to master as soon as it passes the load test below,
then confirm that the live file is the commit:

    curl -s https://danbri.github.io/glitchcan-minigam/magpie/cwplans/docklands/index.html | sha1sum
    git show HEAD:magpie/cwplans/docklands/index.html | sha1sum      # equal once Pages has deployed

Other agents commit in the same working tree, often with files staged. Commit only your own content: build a temporary
index from HEAD (`GIT_INDEX_FILE=... git read-tree HEAD`), add your blobs, `git commit-tree`, move HEAD with
`git update-ref HEAD <new> <old>` (it refuses if HEAD moved), then `git reset -q HEAD -- <your paths>`. For a shared file
(data-register.json, pipeline.json, ACTIVITY-LOG.md) apply your insertion to HEAD's copy at commit time, never to a copy
read earlier: on 2026-10-04 a copy read a few minutes before the commit undid another agent's register entries (repaired
in the next commit).

Most of the page is long one-line statements. On 2026-10-03 a comment inserted in the middle of a line commented out
`gl.colorMask(true, ...)` and left the page black after "Splats only". `render()` now resets blend, depth mask,
colour mask and polygon offset at the start of every frame. After you edit a long line, read the whole line again.

## Architecture

- **One file.** `docklands/index.html` (about 1,840 lines, 218 KB) holds the CSS, the HTML and one inline script
  (about 189 KB). It loads `data/area.js`, `data/under.js`, `opening-hours.js` and `vendor/earcut.min.js` as
  scripts and fetches the rest on demand (`data/indoor.js`, `data/splats/`, `data/tex/`, `data/towers.json`,
  `data/trees.json`, `../atlas/data/atlas.json`, `data/music.json`, `data/pixel-palette.json`, `data/river.json`).
- **WebGL1.** `getContext('webgl', { antialias: true, alpha: false, stencil: true })` (the stencil marks night
  water). Required: `OES_element_index_uint` (32-bit indices; without it the page shows only the text tables).
  Optional: `EXT_shader_texture_lod` + `OES_standard_derivatives` (`FLOD`: facade mip levels),
  `ANGLE_instanced_arrays` (splats).
- **Programs.**

  | variable | draws | precision |
  |---|---|---|
  | `pr` | terrain (with the ground image), water, greens, lines, tunnels, under-ground detail, outlines, the pick pass | mediump |
  | `prF` | buildings: walls, roofs, window grid, night windows, photo facades, pixel-art materials, music deformation | `HIP` (highp where the GPU has it) |
  | `prS` | Gaussian splats, instanced quads | mediump |
  | `lpr` | light sprites: aviation lights, lamps, crowns, signs, and their reflections | `HIP` |
  | `BP.bright`, `BP.blur`, `BP.add` | night bloom | mediump |
  | `ppr` | pixel-art post pass: palette and outlines | mediump |
  | sky | moving from `skyPr` in the page to `sky.js` (another agent, October 2026; see the sky skill when it exists) | |

- **Vertex formats.** `Mesh`: `[x y z]` float + `[r g b a]` bytes, 16 bytes a vertex. `MeshF` (buildings): `[x y z u]`
  float + rgba, 20 bytes, plus a second buffer `g` of 4 floats bound at attribute location 3. `u` is metres along the
  outline ring on walls and `-(1 + height)` on roofs, so the shader tells walls (`u >= 0`) from roofs and roofs of
  buildings under 40 m (`u > -41`) take the ground image.
- **The alpha byte of a building vertex is not opacity** (`alOf`): 255 plain; `100 + slot` a photo facade tile (slots
  0 to 15); `200 + 8 x material` in pixel art (0 brick, 1 render, 2 glass, 3 ribbon windows, 4 metal, 5 glass with a
  measured facade colour). Opacity is the uniform `a` only.
- **`g` = [centre x, centre z, base m OD, night kind]** per vertex. The music deformation uses x, z and base. Night
  kind `g.w` = use x 1000 + roof top in m OD; use 0 unknown, 1 homes, 2 offices, 3 hotel, 4 Newfoundland (cwb-0451),
  5 One Canada Square (cwb-0413). Building use reaches the shader only through `g.w`, never through the alpha byte.
- **Picking.** `buildPick()` draws every building off screen in a colour that encodes its registry ordinal + 1;
  `pickAt(x, y)` reads the pixel. The cut-away applies, so a tap can reach underground. 28 model buildings belong to
  two registry records, and the pick answers with the later one (README "Drone flight").
- **Coordinates.** Local metres x = E - 537550, z = -(N - 180300), y = m OD (README "Area and coordinates"). The page
  accepts `#at=x,z[,dist]`; the atlas links here that way.
- **Pixel-art frame buffer.** `pixBegin()` unbinds the frame's own texture before drawing into it: a texture that is
  bound while it is the render target is a feedback loop, and every draw fails.

URL switches: `?view=<name>` (any key of `VIEWS`: area, cw, under, plan, rotherhithe, greenland, pier), `?night`,
`?pixel`, `?capture` (no overlays, photo colours: drone frames), `#music`, `#at=`.
Test hooks: `window.__docklands` (`cam`, `draw`, `renderNow`, `setView`, `setNight`, `setStyle`, `setSplatMode`,
`setGround`, `captureMode`, `pickAt`, `selectBuilding`, `searchItems`, `route`, `setEye`/`clearEye`, `screenOf`,
`NIGHT`, `AVL`, `BL`, `PIX`, `VIZ`, `SPL`, `AT`, `AUDst`, and `setTidal`, `relight` for sky.js).

## Interface (owner, 2026-10-03: "The city is the star not our endless word buttons")

- The screen holds the model, two round buttons at the top left (Menu, Search) and the attribution line.
- **Drawer** (Menu): views, then tabs Layers, Route, About (the sky work adds a Sky tab). It closes with its cross, a
  tap on the dimmed map, Escape, or a swipe left of more than 70 px. On a phone (under 900 px) a view button closes it
  so the result shows; at 900 px and wider the map is not dimmed.
- **Record card** (`#sheet`): a tap on a building, a label or a pin opens it. Heights: 0, 38% and 80% of the screen on
  a phone; docked bottom right on a wide screen. Drag the grip to resize; a tap on the grip (moved under 6 px) steps to
  the next size; the cross closes it.
- **Search**: two characters or more; buildings with registry records, labelled places, and every routable place of the
  walking network (`data/indoor.js`, loaded when the box gets focus); prefix matches first; at most 14; Enter takes the
  first. A place below ground also cuts the model away above its level.
- **Press and hold** 550 ms on the model (cancelled by a move of 8 px or a second finger): "Route from here" /
  "Route to here" at the nearest mapped walkway or platform on screen.
- **Gestures** (pointer events). Map style: one finger turns and tilts, right or Shift drag pans, two fingers pinch to
  zoom, twist to turn and move to pan. Pixel art: one finger pans, two fingers up or down tilt. Wheel zooms; distance
  80 to 16,000 m. **A finger that lands on a label must still join a pinch or twist**: the label layer feeds the same
  pointer map, and a pointer that moved more than 8 px cancels the label's click (capture phase).
- **Below ground** shows the depth gauge: drag down to cut the model away above that level (60 to -40 m OD); arrow and
  Page keys move it.

### Music and phone audio

- 24 frequency bands, west (bass) to east (treble). Map style: the splat towers follow the bands (the page switches
  splats to "only"; a set with no `groups.bin.gz` cannot animate). Pixel art: the buildings themselves, in the facade
  vertex shader (stretch, swirl, noise about each building's centre and base).
- Sources: three CC BY 3.0 tracks streamed from Wikimedia Commons (`data/music.json`, credit shown while playing), the
  visitor's own file (plays only in the browser), or the microphone (nothing recorded or sent).
- **Phones play sound only as the direct result of a tap.** Create and resume the AudioContext and call `play()` in the
  tap handler, before any `await`. A file chosen in the picker arrives outside the tap, so a tap on the file button
  creates the context and plays a silent data URL on the audio element first. iOS: set
  `navigator.audioSession.type = 'playback'`, or the silent switch mutes Web Audio. The mini player retries a
  `blocked` start on its own tap.

## Styles

- **Map** (default): the facade program draws a window grid (3.6 m storeys, 1.8 m bays) that fades with distance;
  colour modes (`Colour buildings by`) use a square-root ramp.
- **Isometric pixel art** (`?pixel`): orthographic camera 30 degrees down at 45 degrees, quarter turns by the arrow
  buttons; the scene is drawn at one art pixel per 2 CSS px (1 when the camera is over 700 m away) into a frame
  buffer, then mapped to 33 palette colours (`data/pixel-palette.json`) with dark outlines (off when zoomed out, or
  small buildings become speckle). Colours come from **materials**, not height: a height ramp read as a heat map
  (owner, 2026-10-03). Measured facade colours snap to the palette's building colours, never to a tree green. Night
  is off in pixel art.
- **Photo facades**: `data/tex/facades.jpg` is 2048 x 1024, 8 x 4 tiles of 256 px, 16 towers today;
  `data/tex/facades.json` gives each building its slot and the tile size on the wall in metres (`w_m`, `h_m`). Built by
  `tools/build-facade-atlas.py`, which cuts whole floors by whole bays so the tile repeats (photos and measurement:
  hub skill, "Trees and facades"). Without mipmaps the far towers speckle. `fract()` on the tile coordinate makes the
  implicit mip level jump at every seam, so the level comes from `dFdx`/`dFdy` of the unwrapped coordinate
  (`texture2DLodEXT`); 256 px tiles in a power-of-two atlas keep every mip level inside its tile (level 8 is the tile's
  mean colour); the lookup is inset by half a texel of the level. Without `FLOD` the page falls back to plain
  `texture2D`.
- **Ground images** (aerial 2008, night 2012, LiDAR intensity 2020, Sentinel-2): drawn through the terrain's own x, z
  with the box in `data/tex/textures.json`, resampled to at most 2048 x 2048 on a canvas so the GPU can mipmap it.
  Sources and the ECW decoder: hub skill, "Imagery".
- **Gaussian splats** (Layers, "Gaussian splats"; off, with the model, or only). Sets: `data/splats/index.json`:
  `cw-synth` 669,306 splats synthesised by `tools/build-splats.mjs`; `cw-trained` 167,073 trained from drone frames.
  Standard 32-byte `.splat` records in model metres and axes (x east, y up, z south), gzipped, decoded with
  `DecompressionStream`. Instanced quads; a worker sorts them far to near (15 words a splat: centre, covariance,
  rgba, band, base, top, axis). Dimmed at night (splats have no lit windows).
  - "Splats only" draws the model into the depth buffer with the colour mask off and `polygonOffset(2, 8)` (splats lie
    on the walls and the ground), then the splats with the depth test and no depth write, then the glow. Without the
    offset, wall splats flicker against their own wall.
  - Synthesis (seconds, exact geometry): discs sampled straight from the model surfaces, colours from the aerial photo
    and the facade rule: ground and roof discs every 4 m, one wall disc per 3.6 m storey and 7.2 m of wall with a glass
    band in front: 669,306 splats, 20 MB, 4.5 MB gzipped. The first version (3 m ground, a disc per window) made 1.6
    million splats, 49 MB. A rotation built from three axis vectors must have determinant +1: the frame (t, up, n) with
    n = t x up flipped is a reflection and gives a wrong quaternion. Pick the normal sign for the frame and the outward
    side separately. Training on renders of our own model can only learn what the renders show: it gives a standard
    splat scene, not new information.
  - Drone frames: `tools/drone-flight.mjs` plans the flight, `tools/drone-capture.mjs` renders it with `?capture` and
    `setEye()`, about 3 s a frame on SwiftShader (README "Drone flight").
  - Training (measured 2026-10-03): OpenSplat 1.2.2 on libtorch CPU (`tools/train-splat.sh`). Poses go in as the
    nerfstudio camera-to-world matrices with no change; a wrong convention fails loudly ("No cameras see any sparse
    points"). Do not pass `--center`: without it the output stays in model metres. 480 frames at 480 x 270, 3,000
    steps: 33 min on a shared 4-core machine, 1.1 GB. With 2,000 steps or fewer set `--refine-every 250` or nothing
    densifies. `--val-render` leaks about 40 MB a render (the OOM killer stopped one run). Do not edit
    `train-splat.sh` while a run is going: bash reads the file as it runs, and the first run's conversion step died
    with a syntax error that the finished file does not have.
  - Trained output has floaters out to 2 km (OpenSplat trains on a black background, so sky becomes splats at random
    depths). `tools/publish-trained-splat.mjs` keeps the flown box plus 150 m, -30 to 260 m OD and axes up to 25 m
    (21,222 of 188,295 removed), gives each splat its building (so the music works on it) and adds the set to
    `index.json`.
- **Glow chips** (Layers, "Glow: who is inside"): 11 categories (finance, shop, catering, leisure, entertainment, bar,
  education, health, sport, arts, charity) from `registry/categories.json` through the atlas index. Categories come
  only from stated classes (`tools/build-categories.mjs`), never from names. Drawn with the depth test, then once
  faintly without it, so a hidden building still shows.
- **Trees** load only when shown (pixel art or the Trees switch): 18,516 within 900 m of the estate; trees over 35 m
  are left out (cranes or structures). The whole file as boxes would be about 30 MB of vertices on a phone.

## Night (`?night`, Layers > Style > Night)

Method and every number: README "Night" (https://github.com/danbri/glitchcan-minigam/blob/master/magpie/cwplans/docklands/README.md#night-added-2026-10-04).
The reference is the owner's six photos of 3 October 2026 in `docklands/reference/night-2026-10-03/` (owner,
2026-10-04: "Keep my photos"; the owner's copyright, not an open licence; no EXIF survived).

- **Lit windows** (`nightCol` in the facade shader): walls dark, window cells lit by use. Homes warm (tinted to the
  photos' #c1a573), lit by flats of three windows with low-frequency noise so flats cluster, about 5% blue-white;
  offices cool white by whole floors (about a third) and bands along a floor; hotels warm and more lit; no registry
  record: a warm mix, fewer lit; under 30 m fewer. A window under one pixel shows the mean light (lit share x
  brightness), first along a floor so lit office floors stay bands, then over all floors: not a dark average.
  Crowns: Newfoundland's diagrid in its top 13 m, One Canada Square's pink-red band and lit pyramid, a soft top band
  on other towers over 90 m.
- **Red aviation lights: a rule, not a survey.** UK Air Navigation Order 2016 art. 222: medium-intensity steady red
  lights on structures of 150 m or more, at the top and at intermediate levels no more than 52 m apart (CAA CAP 1210 /
  CAP 168 practice); the owner's photos show 2 to 4 lights per roof from about 100 m (aerodrome safeguarding near
  London City Airport). Code: `AVL = { min: 100, mid: 150, step: 52 }`. Roof corners (outline turns over 35 degrees,
  at most 4) of every building 100 m or more above its ground, one roof per tower, lights within 5 m merged; from
  150 m also `ceil(h / 52) - 1` intermediate levels with two opposite corners. Measured: 587 lights on 84 roofs (an
  earlier rule gave 4,418 on 950 buildings). Core radius clamped to 0.8 to 1.4 CSS px with a halo of 3.2 times; the
  clamp is in CSS pixels, so a 3x phone shows the size a 1x desktop shows.
- **Riverside lamps** (measured 1,449): every 16 to 26 m, at least 13 m apart, along the EA flood walls within 20 m of
  tidal water (3 m inland) and footpaths within 15 m of the tidal Thames or its creeks; none on inland roads or dock
  quays (they made rows of white and yellow balls). 65% low-pressure sodium orange, the rest warm white LED. Trees
  within 10 m of a lamp are drawn again, up-lit.
- **Reflections**: water marks its pixels in the stencil buffer; at night the LiDAR ground is pushed back in depth so
  ground at the water level does not hide the water. Reflected: lamps, roof lights within 150 m of water
  (exp(-d / 80 m)), the two crowns, and one column of window light per building of 40 m or more within 15 m of the
  water plus its radius (measured 160 columns, 1,769 reflection sprites in all). Each follows the glitter path: from the
  water under the light towards the viewer, to where the depression below the horizon is 0.16 (tangent) more than
  that of the mirror image (water slopes up to about 5 degrees); brightest at the mirror image, fading towards the
  viewer, rippled at about 20 frames a second. The old rule (every streak stretched to 85% of the way down the view)
  made confetti over the docks and a smeared band at the foot of the skyline.
- **Lit signs**: a short cool-white bar on the two longest faces of each office tower of 150 m or more (measured 12).
  No names or logos: the real signs are trademarks, and which face carries one is not in our data.
- **Moonlight** (`MOON`, `moonNow(nm)` once per frame before the sky): Night only and only while the sun is below the
  horizon (full at -6 degrees). Strength k = relative brightness (10^(-0.4 (mag + 12.7))) x extinction (0.25 mag per
  airmass) x altitude ramp x sun-down ramp x (1 - 0.7 low - 0.25 mid cloud). The ground program gets `ml` = tint x K x k x
  sin(altitude) added to `dim` (0 in the pick pass); the facade program gets `mlc` and `md` and adds base x `mlc` x
  max(N . moon, 0) inside `nightCol`, N from `cross(dFdx(wq), dFdy(wq))` (two new varyings `wq`, `ev`). K = 0.16 is a
  drawn choice. `__docklands.MOON` exposes the numbers.
- **The moon's glitter path** (`moonGlitter`): one sprite through the lights' reflection shader (refl = 1), placed along the
  moon's azimuth at D = min(5 km, he / (tan alt - 0.32)) and height so that the mirror image falls at the moon's altitude;
  width 0.03 rad; cached by position. `MOON.noGlitter = true` turns it off (A/B tests); `NIGHT.n.moonGlitter` is its
  intensity. Measured: +8 to +11 mean luma in the column under the moon at the photo time.
- **The river at a measured tide** (`terrainSink`, `tidalMask`): see the sky skill, second pass. `buildTerrain` remembers
  its argument (`terrainLast`) so the tide can rebuild it the same way.
- **Pick buffer was never cleared** (found 2026-10-04): the `gl.clear` of `pickAt` sat inside a `//` comment in the middle
  of its line, so every pick read a buffer holding the previous pick's colours and depth. Fixed; the lesson is the one at
  the top: re-read the whole line.
- **Bloom**: `copyTexSubImage2D` of the frame, a bright pass to a quarter of the width and height, a 9-tap Gaussian
  across then down, added back at 1.2 x. `__docklands.BL.on = false` turns it off (cost in the README: about 9% of a
  SwiftShader frame).
- **Views where the photos were taken** (`?view=rotherhithe|greenland|pier`; each turns Night on). `eyeView(eye, bearing
  from grid north, tilt, horizontal field)` puts the orbit centre 1.2 km along the line of sight. rotherhithe: eye
  (-896, 6.9 m OD, 1150), 43.3, -1, 42 degrees (`promenade-skyline-railing.jpg`); greenland: (-825, 5.3, 1160), 39.7,
  +3.5, 44 (`promenade-skyline-bollard.jpg`); pier: (-740, 6, 140), 83.6, +11, 69 (`clipper-canary-wharf-pier.jpg`).
  Fitted by reading the x positions of landmarks in each photo by eye and a grid search over eye, heading and field
  (RMS 3.5 px of 2000 for the railing photo); side-by-side renders fixed the tilt. The field is horizontal, so a
  portrait phone sees the whole photo frame and more.
- **Calibration**: compare render and photo by numbers (the README table: luma histogram, sky top colour, red points
  above the bank, warm and cool bright pixels, skyline band, water). The measuring script was a session scratchpad
  file, not committed; its definitions are in the README (frames 1000 px wide, luma = 0.2126 R + 0.7152 G + 0.0722 B,
  red = R > 0.45 and R > 2G and R > 2B). Commit the script next time you calibrate. The two Greenland photos bracket the
  model's red-point count (36 and 72 against 39 to 44): the count a photo shows depends on its exposure.

## fp16: why the towers were black on the owner's phone (2026-10-04)

Phone GPUs (Apple's at least) run `mediump` as 16-bit floats. The window hash
`fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453)` collapses there: almost every cell hashes to 0, so no window
lit and the towers showed only red dots. SwiftShader runs `mediump` as 32-bit, so **the headless renderer cannot
show this fault**. Rules: a shader that hashes world positions or large products uses `HIP` (highp where
`GL_FRAGMENT_PRECISION_HIGH`); test the maths with fp16 rounding in Node. Node 22 here has no `Math.f16round`;
round the float32 mantissa to 10 bits instead (exponent range not modelled; enough for this hash):

    node -e "const r=x=>{const b=new Float32Array([x]),u=new Uint32Array(b.buffer),m=u[0]&0x1fff;u[0]=(u[0]&~0x1fff)+((m>0x1000||(m===0x1000&&(u[0]&0x2000)))?0x2000:0);return b[0]},
      fr=x=>x-Math.floor(x),h=(x,y)=>r(fr(r(r(Math.sin(r(r(r(x)*r(12.9898))+r(r(y)*r(78.233)))))*r(43758.5453))));
      let z=0;for(let i=0;i<60;i++)for(let j=0;j<60;j++)if(h(i+7.3,j+7.3)===0)z++;console.log(z,'of 3600 cells hash to 0')"

Measured 2026-10-04: 3,554 of 3,600 cells hash to 0 in fp16 (README: 3,550 on its own grid), 0 in fp32.

### fp16 and WebGL 1 limits, checked without a phone (2026-10-04)

`node magpie/cwplans/tools/check-fp16-shaders.mjs` (about 40 s; `--no-browser` for the maths only) captures every shader
the page compiles in headless Chromium, prints per program its precision and its uniform rows, varyings, samplers and
attributes (counted without packing) against the WebGL 1 minimums, and re-runs the risky maths with every intermediate
rounded to binary16 (with exponent range, subnormals and overflow). It fails on a `mediump` case that goes wrong and on a
stale case (the quoted shader text is gone). SwiftShader reports `mediump` as 10 bits but computes in 32: its numbers say
nothing about phones.

Results 2026-10-04: the ground program's glow pulse (`mediump`, `time` unbounded) was off by 0.19 after 10 minutes and
0.37 after an hour: fixed by wrapping `time` to 10 periods of sin(3.3 t). Under the `HIP`/`PRE` fallback (a GPU with no
highp in fragment shaders) the window hash, the sky cloud noise (37 distinct values of 4,096), the ripples, far cloud
coordinates and the moonlight face normal (positions near 5 km step by 4 m) would all fail: every OpenGL ES 3 GPU has
highp, so this matters only for old GPUs. Fragment uniform rows above the WebGL 1 minimum of 16: buildings (prF) 25,
pixel-art pass (ppr) 35, sky 20; varyings: buildings 8 of 8 (the moonlight added 2 vec3).

Only a real phone can confirm: the frame time and the bloom cost on a phone GPU; that the derivative normal
(`OES_standard_derivatives`) gives clean moonlit faces; that `MAX_FRAGMENT_UNIFORM_VECTORS` and `MAX_VARYING_VECTORS` are
above what the programs use (read them with `gl.getParameter` on the phone); that `highp` is really used where `HIP`
asks for it (`getShaderPrecisionFormat`); the look of the glitter paths and the bloom on a small bright screen; memory
with the splats, trees and facade atlas loaded; audio and touch (separate rules above).

## Testing

Headless Chromium with SwiftShader (repo `CLAUDE.md`, "Headless browser"), from a local server (fetch needs http):

    python3 -m http.server 8791 --bind 127.0.0.1      # from the repo root, in the background; stop it afterwards

```js
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const page = await ctx.newPage(), errors = [];
page.on('pageerror', e => errors.push(String(e))); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://127.0.0.1:8791/magpie/cwplans/docklands/index.html?view=rotherhithe');
await page.waitForFunction(() => window.__docklands?.AT && window.__docklands.NIGHT.built, null, { timeout: 240000 });
const png = await page.evaluate(() => { window.__docklands.renderNow(); return document.getElementById('c').toDataURL('image/png'); });
```

- **Load test before every push**: the page loads with no `pageerror` and no console error. The inline script can be
  syntax-checked alone: extract the one inline `<script>` block to a file and run `node --check` on it.
- **renderNow + toDataURL in one `evaluate`.** The canvas has no `preserveDrawingBuffer`, so read it in the same task
  as the render. `page.screenshot` re-renders and times out on heavy frames (a splat frame takes about 30 s).
- **`renderNow()` returns before SwiftShader has drawn**: measured 2 ms, then about 2.2 s in the next
  `readPixels`/`toDataURL` (1600 x 900, Rotherhithe view, 2026-10-04). Time a frame as renderNow plus a 1-pixel
  `readPixels`.
- **Two sizes x two pixel ratios x the photo views** for any visual change: 1600 x 900 at DPR 1 and 390 x 844 at
  DPR 3, from `?view=rotherhithe`, `greenland` and `pier`. The page draws at most 2 device px per CSS px, so 390 x 844 at
  DPR 3 is a 780 x 1688 canvas. The first night build passed one 800 x 600 low view by eye and failed on the owner's
  phone.
- **Compare numbers, not one look**: mean luma, the share of red pixels, counts of light points, and the counts in
  `__docklands.NIGHT.n` (tall, red, lamps, columns, reflections, signs). Measured 2026-10-04, Rotherhithe view:
  mean luma 0.100 and red pixels 0.077% at 1600 x 900 DPR 1; 0.073 and 0.064% at 390 x 844 DPR 3; `NIGHT.n` = 84 tall,
  587 red, 1,449 lamps, 160 columns, 1,769 reflections, 12 signs.
- Then look at the pictures as well, and say which renderer made them (SwiftShader WebGL here; fp16 faults do not show).

## Known limits (from the README and the code)

Window light is drawn, not known; the window grid is 1.8 m x 3.6 m everywhere; red lights still outnumber the photos
(the model lights every 100 m roof); the LiDAR foreshore at Greenland Pier is one tide state; reflections are of point
lights and columns, not a mirror image of the facades; a level is a floor index, not a measured height; the splat order
is sorted for the still model, so strong music stretch shows small sorting errors. Not yet measured on a phone GPU.
