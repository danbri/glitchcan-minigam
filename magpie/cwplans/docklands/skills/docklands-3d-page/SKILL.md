---
name: docklands-3d-page
description: >-
  Work on the Docklands 3D page, magpie/cwplans/docklands/index.html: one WebGL1 file with seven shader programs.
  Covers the vertex formats (Mesh, MeshF, the u coordinate, the alpha byte that is NOT opacity, the g attribute
  that carries building use and roof top), picking, the drawer, record card, search, press-and-hold routes,
  gestures (labels must still join a pinch), music and the phone audio rules, the styles (map, isometric pixel art
  with materials, photo facades with mip LOD, Gaussian splats including the trained set, glow chips), Night mode
  (lit windows by use, the Air Navigation Order aviation-light rule, riverside lamps, glitter-path reflections,
  bloom, the photo views ?view=rotherhithe|greenland|pier|greenlandday|plane and their calibration against the owner's photos; a view may carry a roll), the
  fp16 / highp fault that left phones dark, and how to test a visual change headless (SwiftShader, renderNow and
  toDataURL, two sizes x two pixel ratios x the photo views, numbers not one look). Reach for it before you edit
  docklands/index.html, add a layer or a style, change a shader, judge a render, or push a page change. The sky,
  clock, weather and tide have their own skill (pending). Also the crown halo by date and the overlays (live state,
  London Datastore: OV), and the locate button (blue dot, follow, compass heading, look through the phone; locate.js). Append to the curation skill's ACTIVITY-LOG.md.
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
index from the remote (`git fetch origin master`, `GIT_INDEX_FILE=... git read-tree origin/master`), add your blobs,
`git commit-tree -p origin/master`, and push that commit (`git push origin <commit>:refs/heads/master`; it is refused if
the remote moved, then start again). For a shared file (data-register.json, pipeline.json, ACTIVITY-LOG.md) apply your
insertion to `git show origin/master:<file>` at commit time (the coordinator's rule), never to a copy read earlier: on 2026-10-04 a copy read a few minutes before the commit undid another agent's register entries (repaired
in the next commit).

**Give your worktree a name no other agent will use.** The scratchpad directory is shared by every agent of the session:
on 2026-10-04 a worktree at `scratchpad/wt` was deleted by another agent mid-task (uncommitted edits lost; the server then
answered 404 and the tests timed out, which looked like a page fault). Use `scratchpad/<your-task>/wt`, keep each step's edits
as a re-runnable apply script (it also re-applies cleanly after `git rebase origin/master`), and commit each step at once.

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

URL switches: `?view=<name>` (any key of `VIEWS`: area, cw, under, plan, rotherhithe, greenland, pier, greenlandday), `?night`,
`?pixel`, `?capture` (no overlays, photo colours: drone frames), `#music`, `#at=`.
Test hooks: `window.__docklands` (`cam`, `draw`, `renderNow`, `setView`, `setNight`, `setStyle`, `setSplatMode`,
`setGround`, `captureMode`, `pickAt`, `selectBuilding`, `searchItems`, `route`, `setEye`/`clearEye`, `screenOf`,
`NIGHT`, `AVL`, `BL`, `PIX`, `VIZ`, `SPL`, `AT`, `AUDst`, and `setTidal`, `relight` for sky.js).

## Interface (owner, 2026-10-03: "The city is the star not our endless word buttons")

- The screen holds the model, two round buttons at the top left (Menu, Search) and the OSM credit, which folds to an (i)
  button (see "Credits and the window lock"). Every other credit is in Menu > About > Credits.
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

## Crown halo by date and overlays (2026-10-04)

Live: https://danbri.github.io/glitchcan-minigam/magpie/cwplans/docklands/?t=photo (red halo, pyramid faces dark) and
https://danbri.github.io/glitchcan-minigam/magpie/cwplans/docklands/?t=2022-05-26T22:00&night (purple, Elizabeth line week).

- **Crown halo** (`CROWN`, `crownFor(day)`, `crownNow()`; Layers > "Crown halo colour by date", on): for the page clock's
  *evening* (London date of the clock minus 6 h, so 01:00 belongs to the night before) take a One Canada Square campaign
  whose dates include it (month-only dates cover the month; `days` limits it to those days), else an observation of that
  date (one with a hex first; "pyramid faces" in `what_lit` lights the faces, "faces dark" or "not lit" does not), else a
  neutral warm white and "not known". Data: `registry/sources/lighting/crown-lighting.json` (skill
  `cwplans-crown-lighting`), loaded when Night is on or when the record card or Sky panel asks. The text goes to
  `#crownNote` (Layers, with Night), the record card of cwb-0413 and the Sky panel row "One Canada Square halo"
  (`__docklands.crownText()`). The white apex light is not touched.
- **No new uniform row.** The facade program's `night` became a `vec4`: x = 0 day, 1 night with dark pyramid faces, 2 with
  lit faces; yzw = the halo colour. `check-fp16-shaders.mjs` after the change: prF still 25 fragment uniform rows and 8 of 8
  varyings. A new `uniform vec3` would have been row 26; there is no varying left for anything.
- The halo's sprites (and their reflections) are in their own buffers `NIGHT.ocs`, `NIGHT.ocsR`, rebuilt by `ocsHalo()` only
  when the colour key changes; `buildNightLights()` keeps their positions in `NIGHT.ocsPts` (the counts in `NIGHT.n` are
  unchanged: 1,769 reflections).
- **Overlays** (`OV`, `OVL`, `buildOverlays()`; Layers > "Live state (snapshot)" and "London Datastore (GLA)", all off): one
  build for all ticked layers into four buffers: `OV.solid` (opaque, drawn with the pins, full brightness), `OV.glass`
  (see-through, blended, no depth write, dimmed to 0.5 at night), `OV.flat` (ground outlines, lit like the ground:
  max(night dim, 0.35)) and `OV.tips` (crane tip lights, through `drawLights` in `drawNight`). Heights are m OD as
  everywhere; feet above mean sea level x 0.3048 (`FT2M`), Newlyn datum within about 0.1 m of mean sea level.
- **Taps**: `ovTapPoint` (anchors within 22 CSS px on screen, nearest) runs before the building pick; `ovTapGround` (the
  ray from the tap meets the ground: `groundUnder`, three passes against `groundAt`; then point in ring, holes out, smaller
  layers first, EGR159 last) runs only when the pick finds no building. Each card gives the snapshot time in London time
  and the source's own credit line (`meta.attribution`): "Powered by TfL Open Data", "Source: UK AIS (NATS)", the GLA's
  OGL line with "The GLA cannot warrant the quality or accuracy of the data".
- Measured 2026-10-04 (all layers on): 135 docks, 3 lift outages, 10 cranes (5 lit tips), H4 110 centreline points,
  EGR159 80 ring points, 10 wharves, 623 open-space and 118 conservation-area polygons, 662 venues; 832 tap anchors and
  752 outlines; solid 113,870 triangles, glass 538; `buildOverlays` about 0.3 s with the files cached (SwiftShader host).
  Test matrix (map, `?night`, `?t=photo`, `?view=rotherhithe` x 1600 x 900 DPR 1 and 390 x 844 DPR 3) with every layer on:
  no console error; `?t=photo` mean luma 0.116 and 0.086 (0.094 and 0.066 with the layers off), red 0.086% and 0.061%.

What went wrong first (and the rule):
- **See-through fences round planning outlines** (12 m, alpha 0.45) washed the whole skyline green in `?t=photo`: the photo
  eye stands next to a designated open space outline on the Rotherhithe promenade. Outlines lie on the ground now
  (2.5 m ribbons, 0.7 m up). Check every new layer from the photo views, not only from above.
- **A lid on EGR159** (alpha 0.07 over 7 km2) tinted the whole Isle of Dogs and the sky behind it pink once the camera was
  inside the prism. No lid; walls fade from 0.09 at the top to 0 at the ground.
- **Outlines outside the model floated in the black sky**: `groundAt` clamps to the edge of the terrain grid, so a ring
  that leaves the model box gets walls hanging past the edge. Draw only segments with both ends inside the model.
- **Arc centres among the vertices** (F26): `feeds/live/helicopters.json` lists EGR159's two arc centres as vertices. The
  page draws, in their place, the arc clockwise (bearing from grid north increasing) from the vertex before to the vertex
  after, radius from `arcs` (0.3 NM, 0.55 NM), as UK AIP ENR 5.1 words it ("thence clockwise by the arc of a circle").
- H4 is drawn along `data/river.json`'s centreline from the model's west edge to the point nearest the Isle-of-Dogs
  reporting point; the AIP's precise line is on the 1:50 000 chart (not copied), and the card says so.
- Cultural venue positions are drawn as published; F25 (a constant offset in 10 venue layers) is not corrected here.

## River layer (2026-10-04)

Live: https://danbri.github.io/glitchcan-minigam/magpie/cwplans/docklands/ (Menu > Layers > River). Data and methods:
skill `cwplans-river-and-water`, "On the 3D page and the atlas".

- **Its own file**, `docklands/river-layer.js` (like `sky.js`), so that agents working in parallel on `index.html` meet
  only seven one-line hooks: the script tag; `DocklandsRiver.load()` after the overlay files load and
  `DocklandsRiver.build({ S, G, F, tips, hits, polys, n })` before the upload in `buildOverlays()`; one draw line for
  `OV.rclock`; `DocklandsRiver.extendCard(l)` in `showInfo()`; `DocklandsRiver.init({...helpers})` before
  `window.__docklands`. The file adds the Layers section (after `#ovLdsNote`), the Credits block "River and water", a
  row in the Sky panel and its CSS itself. The main script binds `input[id^="ov_"]` before `init`, so the file binds its
  own six inputs.
- **Clock parts in their own buffer.** Boats and lock badges change with the page clock: `OV.rclock` (opaque, full
  brightness), rebuilt once a minute of page clock while either layer is on; their tap entries carry `rclk` and are
  swapped in `OV.hits` without rebuilding the other overlays. A new clock day rebuilds everything (PLA notices are by day).
- Static parts go to the shared overlay buffers: piers and badges in `S`, route lines and notice outlines in `F` (on the
  water: max(ground, tide level) + 0.5 to 0.6 m), notice areas in `polys` for the ground tap.
- Labels: Wikidata and OSM named ships and the two swim-water chips are `labels` entries with `river: true`, removed and
  added on each build. A null name broke `placeLabels` (it reads `name.length`): every label needs a string name.
- Measured 2026-10-04 (all six on, clock 12:45 BST Sunday): 8 piers, 11 route legs, 3 to 4 boats, 7 locks, 7 notice
  outlines (3 port-wide in the list), 2 swim markers, 134 moorings, 51 houseboats, 7 PLA visitor moorings, 19 ships,
  21 labels; 237 tap anchors, solid 2,464 triangles; build 6 to 20 s on SwiftShader including the first file loads.
  Test results of the photo views: README-style numbers in the ACTIVITY-LOG entry of that day.
- Tower Bridge's card (Wikidata Q83125) links the lift times page and says why they are not copied (terms).

## Credits and the window lock (2026-10-04)

Owner, 2026-10-04: "Move credits into main menus. Ensure user actions cant resize zoom dragdrop etc the containing os/app
window". Commits 6064852 (3D page) and 4405c42 (atlas, What's on).

### Credits

- **Where they are.** Menu > About > "Credits and data licences" (`#credits`), grouped: map data; ground, heights and river;
  buildings, occupants and registers; trees and facade photos; sky, weather and tide; live state and live data; London
  Datastore; music and software. Each source has its licence and link. The spans that say what is shown now
  (`#attribImg`, `#attribTrees`, `#attribFac`, `#attribSky`) live in its first line; `sky.js` finds `#attribSky` there and
  does not append to the corner. `#facCredit` and `#attrib` (the `A.meta.sources` line) are in the section too.
  A new layer or source adds its line here, not on the city. Record cards keep the credit of the record shown.
- **The corner.** `#attribLine` holds only `© OpenStreetMap contributors` (linked to https://www.openstreetmap.org/copyright)
  and "credits". `ATTR.start()` runs when the hud clears (the model is drawn); the line folds after 5 s, or at once on a
  pointer down on the canvas or a label or a wheel, to the round (i) button `#attribI` in the same corner, which opens the
  Credits section. Measured: shown from about 3 to 4 s after load to 7.5 to 9.5 s (headless, both sizes).
- **The rule followed:** OSMF Licence/Attribution Guidelines, "Interactive maps"
  (https://osmfoundation.org/wiki/Licence/Attribution_Guidelines, revision 14786 of 2026-09-10; adopted by the OSMF board
  2021-06-25): "You may use a mechanism to fade/collapse the attribution under certain conditions: [...] automatically on
  map interaction such as panning, clicking, or zooming; automatically after five seconds." and "If the attribution has
  been collapsed, the user must still be able to find the licence information if they look for it, for example from an
  '(i)' button in the corner of the map or an 'About' option in a menu." Text must be legible: the line is 11 px, #e8eaec
  on #0d1013d9. Keep the OSM link in the page source: `check-data-register.mjs` looks for it.
- **Other licences.** OGL v3.0 and CC BY ask for an attribution statement, not a place on the map: the Credits section is
  enough. Toasts are over the city, so they carry no credit text (ground image, trees, crime: the credit stays in the
  drawer note).
- **Atlas** (https://danbri.github.io/glitchcan-minigam/magpie/cwplans/atlas/#map): Leaflet's attribution shows the OSM
  credit only (`setPrefix(false)`); it folds the same way to `#attrI` (map `movestart zoomstart click`, or 5 s); the (i)
  shows it again. EA, UKHO, ONS, HMLR, FSA, Historic England, Wikidata and Leaflet are listed in "Data and licences".

### Window lock

The page's own gestures are pointer events on the canvas and the labels. Everything else must leave the window alone:

- Viewport `width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover`.
- `html`, `body` fixed at `100dvh`, overflow hidden, `overscroll-behavior: none` (no rubber-band, no pull-to-refresh, no
  trackpad swipe-back in Chrome); `body` `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`;
  inputs, selects and text areas get `user-select: text` back.
- `touch-action: pan-y` on `#drawer`, `#drawerBody`, `#sheetBody`, `#qres` (native scroll; no pinch, no double-tap zoom).
  A scroll container resets the ancestors' touch-action, so the list scrolls although `body` is `none` (measured: a touch
  drag scrolled `#drawerBody` 467 px). Buttons and labels: `manipulation`.
- Listeners: `wheel` with ctrl or meta, capture, `{passive: false}` prevented (the canvas's own wheel zoom still runs);
  ctrl/meta + `+ = - _ 0` prevented; `gesturestart/change/end` prevented (Safari); `touchmove` with two fingers, or outside
  the three scroll lists, prevented; `contextmenu`, `selectstart`, `dblclick`, `dragstart` prevented outside fields; images
  and links `draggable=false`. `dragover` + `drop` on window always prevented; a dropped audio file goes to `vizStartFile`
  like "Play your own file" (a drop is not a user activation, so a phone may need the mini player's ▶ tap).
- A two-finger pinch on the open drawer closed it (the first finger's move read as a swipe left). The swipe now ignores a
  non-primary pointer.
- Atlas and What's on are documents: they keep page scroll (`touch-action: pan-x pan-y` on `html`, which forbids pinch and
  double-tap zoom) and selectable text; the same listeners otherwise; the atlas map area is `touch-action: none` and
  Leaflet keeps its own pinch zoom.

Test (CDP `Input.dispatchTouchEvent`; `synthesizePinchGesture` and `synthesizeScrollGesture` do nothing in this headless
Chromium, on the old page too, so they prove nothing): two fingers moving apart over the top bar, the corner credit and the
drawer gave `visualViewport.scale` 5 on the old page and 1 on the new. On the canvas: drag yaw -0.72 rad, pinch distance x
0.29, pinch with a finger starting on a label x 0.19, twist +0.50 rad, scale 1, `scrollY` 0. Ctrl+wheel over the city and
the drawer: scale 1, `devicePixelRatio` and `innerWidth` unchanged. Desktop 1600 x 900 and phone 390 x 844 DPR 3: no
console error.

Only a real phone can confirm: iOS Safari ignores `user-scalable=no` (since iOS 10); the lock there rests on `touch-action`
and the `gesture*` and `touchmove` listeners. The edge swipe back (iOS Safari, Android gesture navigation) is the operating
system's and a page cannot stop it. Pull-to-refresh, the long-press callout, text selection loupes and the drop of a file
from another app need a real device to see. The headless test shows the events are prevented, not what each OS does.

## Works in progress and the day view from Greenland Pier (2026-10-04)

Live: https://danbri.github.io/glitchcan-minigam/magpie/cwplans/docklands/?view=greenlandday&t=2026-10-04T11:30 (then Menu >
Layers > Works in progress > Construction sites). Data and rules: skill `cwplans-construction`.

- **Layer** (`ov_works`, off; `OVL.works` = `../registry/sources/construction/sites.json`, 1.75 MB, loaded on first tick):
  `worksBuild()` inside `buildOverlays()`. Per site in the model box: the footprint as a ground ribbon (`ovRibbon`, `OV.flat`)
  coloured by status (orange on site, yellow approved, green completed in 2 years, blue proposed, grey commenced long ago);
  on site with a height: a frame of thin edges (outline at the top, four uprights at the outline's extreme points) when the
  footprint is 6,000 m² or less, else a thin mast at the centre; NOTAM cranes matched to the site; the height built so far
  (`current.top_m_od` from `facts.json`) as a grey prism, a core at 45% of the outline. Heights m OD: PLD `max_height` as
  entered, else storeys x 3.2 m above the ground, else the developer's height above the ground (`worksTop`).
  Measured (all on, 2026-10-04): 386 sites drawn, 74 frames, 10 cranes, 2 built prisms; no console error at 1600 x 900 DPR 1
  and 390 x 844 DPR 3 from `?view=rotherhithe`, `greenland`, `pier`, `greenlandday` and the default view.
- **What failed first:** see-through walls (`ovFence`, alpha 0.07) for the approved height: from the photo views the walls of
  74 sites stacked into orange blocks over the skyline. Edges only now. The built prism in `OV.solid` was full-bright white at
  night: it is in `OV.flat` (lit like the ground). A comment put at the end of a `prism(...)` call commented out the rest of
  its one-line block (`node --check` caught it): the rule at the top of this skill again.
- **Taps**: a hit point at the frame top (`OV.hits`) and the footprint as a ground polygon (`OV.polys`, priority 0, before the
  London Datastore outlines). The card (`worksCard`): status with rule and confidence, dates with their source record,
  approved figures (planning register and developer or press, with links), the frame height and where it came from, the built
  height with its photo method, developer and contractor with sources, NOTAM cranes, Street Manager, OSM ids, Wikidata items
  (not "low"), brownfield references, planning references linked to the borough register, the description, the footprint
  source and a one-line source note; the full credits are in Menu > About > Credits ("Works in progress").
- **`?view=greenlandday`** (no button): the owner's wide day photo `docklands/reference/day-2026-10-04/pier-wide-skyline.jpg`.
  Eye (-830, 4.5 m OD, 1158), heading 51.9° from grid north, tilt 6.45°, horizontal field 99.9°, `night: false`. The camera of
  `tools/solve-photo-sun.mjs` has a roll of +0.65° that `eyeView` cannot take; refitted with no roll over the same four tower
  tops: rms 2.7 px. Add `&t=2026-10-04T11:30` for the day sky at the photo time (11:30 BST from the bitt shadows).
- **Calibration against the photo** (render 1288 x 966 at DPR 2 = 2576 x 1932, the photo's size; landmark points projected
  with `__docklands.CAM`; photo pixels read by eye):

  | landmark | photo (px) | render (px) | dx, dy |
  |---|---|---|---|
  | Newfoundland crown top (cwb-0451) | 692, 856 | 688.5, 857.7 | -3.5, +1.7 |
  | Landmark Pinnacle roof (cwb-0577) | 751, 807 | 752.9, 807.3 | +1.9, +0.3 |
  | One Canada Square apex (cwb-0413) | 970, 903 | 974.0, 899.9 | +4.0, -3.1 |
  | Citigroup Centre roof sign, x only (cwb-0520) | 1100 | 1097.4 | -2.6 |
  | 22 Marsh Wall roof (cwb-0641, not in the fit) | 857, 917 | 856.9, 921.2 | -0.1, +4.2 |

  Before the refit (tilt 6.8 from the camera with roll): dy +3.4 to +10.7 px. Tones (frames 1000 px wide): mean luma photo
  0.466, render 0.462 (with `&t=` day sky); skyline band (rows 240 to 330) 0.558 and 0.540; sky top colour photo (49, 76, 128),
  render (68, 115, 198): the drawn sky is lighter and more saturated than the photo's polarised blue.
- **`?view=greenland` by day**: it is the night bollard photo's framing (heading 39.7°, field 44°), from an eye 5 m from the
  wide photo's. The bearings agree: the four landmarks' bearings from the two eyes differ by at most 0.3°. Not changed.
- **`?view=plane`** (no button; 2026-10-05): the owner's evening photo from an aircraft window,
  `docklands/reference/plane-2026-10/evening-thames-from-plane.jpg` (1195 x 689). Eye (211, 802 m OD, -845) over Poplar,
  heading 223.84° from grid north, pitch -13.56°, **roll +9.18°** (the first view with a roll: `cam.roll`, applied by
  `rolledUp` to the look-at up vector; `setView` and `setEye` clear it), horizontal field 56.9°, `night: false`. Add
  `&t=2026-10-05T17:40` for the evening sky. Solved with `tools/view-mcp/solve.mjs` (skill `photo-view-reconstruction`):

  | evidence | photo (px) | camera / page (px) | error |
  |---|---|---|---|
  | Newfoundland crown (cwb-0451) | 363, 600 | 356.3, 596.0 / 356.2, 595.7 | 7.8 |
  | Landmark Pinnacle roof (cwb-0577) | 301, 506 | 302.3, 517.0 | 11.1 |
  | Greenland Pier pontoon (weight 0.5) | 280, 421 | 274.9, 423.5 | 5.7 |
  | 32 shoreline pixels (Thames, Greenland Dock) | | distance to the OSM outline | 0.1 to 11.6 |
  | hold-out: Rotherhithe north shore, 7 pixels | | fitted without them | rms 7.7 |
  | hold-out: Greenland Dock west end | 578, 383 | 560.9, 382.8 | 16 |
  | hold-out: Sir John McDougall Gardens (fails: misidentified) | 107, 497 | 147.5, 493.3 | 41 |

  rms 4.8 px over 43 observations. The page's own MVP agrees with the solver to 0.2 px. Tones (1195 x 689, DPR 1, map style,
  `&t=` evening sky): mean luma photo 0.507, render 0.555; top third 0.651 and 0.850 (south London beyond the model box,
  4.5 km south of the eye, is the page's sky colour); lower two thirds 0.434 and 0.408. Side by side:
  `reference/plane-2026-10/compare-photo-render.jpg`. No console errors at 1600 x 900 DPR 1, 390 x 844 DPR 3, 1195 x 689.
- What the model lacks in this view: buildings finished after the LiDAR (the red-brick tower in front of One Canada Square and
  others) and every crane; the 30 Marsh Wall core and 25 Cuba Street are drawn only through this layer.

## Location and heading: the locate button (2026-10-04)

Owner, 2026-10-04: "Add a geopositioning position that takes permissioned device location/orientation via webplatform
APi and positions map/view accordingly, following conventions familiar from mainstream apps." Commits cc1ebabc (3D page)
and e78a8671 (atlas, and the hold fix on both).

- **Code**: `docklands/locate.js`, loaded after the inline script. It reaches the page only through `__docklands`
  (`geo`, `groundAt`, `toast`, `cam`, `draw`, `PIX`) and `DocklandsLocate.after(ctx)`, one line at the end of `render()`
  beside `DocklandsSky.after`. Its CSS and DOM are injected (`#locBtns`, `#locSvg`, `#locMsg`), hidden in `?capture`.
  Test hook: `DocklandsLocate.state` (mode, smoothed fix in model metres, grid heading, source, pitch, watching, orient,
  outside, message, last error code, grid convergence), `DocklandsLocate.off()`, `showEdge()`.
- **The button cycle** (Google Maps / Apple Maps): `off` (grey crosshair) -> tap: permission asked now, never on load ->
  `waiting` (pulsing) -> `centred` (blue crosshair, filled centre) -> tap: `heading` (filled arrow; the view turns with the
  compass) -> tap: `centred`. A drag, twist, view button, search or anything else that moves `cam.tx/tz/yaw` drops to
  `located` (blue outline; the dot stays); a tap centres again. Zoom (wheel, pinch without pan) and tilt keep following.
  Hold 0.8 s: off. The follow loop notices another mover by comparing the camera with what it last set (`S.set`): no
  hook in the gesture code was needed.
- **The eye button** (shown in `heading` and `eye`): "look through the phone". `cam.eye` at the fix, ground (`groundAt`,
  the LiDAR DTM, so the deck or the water on a pier) + 1.6 m; yaw from the heading, pitch from the elevation of the
  back camera, clamped to +/-63 degrees; vertical field 1.05 rad; no roll. Tap it again (or the locate button) to leave;
  a drag leaves it to `located`. Chosen over a long press because a long press is not discoverable.
- **Position**: `watchPosition` with `enableHighAccuracy`, timeout 20 s, `maximumAge` 5 s; stopped on `visibilitychange`
  hidden and restarted on visible. `geo(lon, lat)` is the page's own transform (`A.meta.geo`, a quadratic fit, max error
  0.03 m against its own source): checked against proj4 BNG (7-parameter Helmert): Canary Wharf DLR 51.5051,-0.0209 ->
  (-97.9, -19.4), proj4 (-96.0, -19.5); 51.4953,-0.0329 -> (-901.3, 1092.9), proj4 (-899.5, 1092.7). Note: 51.4953,-0.0329
  is the Greenland lock entrance; the pier pontoon is 51.4947,-0.0319 -> (-830.1, 1157.7), the places list's pier.
  Jitter: a jump over max(30 m, 2 x accuracy + current accuracy) or a fix older than 15 s snaps; else the dot moves by a
  share k = 0.25..0.8 that grows when the new fix is more accurate. A later timeout while a fix exists is ignored.
- **Heading**: grid bearing = true heading + grid convergence (`trueToGrid`: the grid bearing of true north from `geo` at
  the fix; -1.55 degrees at Canary Wharf). Magnetic declination (about 1 degree in London) is not applied: below compass
  error. Android/Chrome: `deviceorientationabsolute`, full W3C rotation R = Rz(alpha) Rx(beta) Ry(gamma); heading of the
  horizontal part of (screen-up + back-camera direction): the first serves a flat phone, the second an upright one, and
  for a tilt about the device x axis they agree, so the sum never vanishes. Screen-up in device axes is
  (sin a, cos a) for `screen.orientation.angle` a. iOS: `webkitCompassHeading` + screen angle, and
  `DeviceOrientationEvent.requestPermission()` called inside the tap (tap 2 or the eye button) before any await; Android
  needs no prompt, so the compass starts with tap 1 and the beam shows at once. No absolute heading: GPS `coords.heading`
  when `speed` > 1 m/s; else no beam, and a toast says so after 2.5 s.
- **Smoothing that failed first**: averaging unit vectors (v += (v' - v) k) stalls when a reading is opposite the mean:
  v(1 - 2k) keeps the old direction for ever (the headless test turned 270 -> 90 degrees and stayed at 62). Now: step
  along the shorter arc, r = c + angDiff(r, c) k. Camera easing is by time (k = 1 - exp(-dt / 0.25 s)), not per frame:
  SwiftShader draws a frame in about 2 s and per-frame easing took 20 s to settle.
- **A tap after the hold was swallowed**: the hold replaces the button's icon, so the pointerup lands on a removed node and
  no click follows; the "this click ends a hold" flag stayed set and ate the next tap. The flag is cleared on pointerdown.
- **Drawing**: an SVG overlay under the labels, from `MVP` each frame: the accuracy circle as 48 ground points projected
  (perspective-correct), the dot 8 px, the beam a 60-degree 56 px gradient wedge along the projected heading. Always on
  top of the buildings (as the apps). No shader code, so `check-fp16-shaders.mjs` is not affected.
- **Outside the model box** (`A.meta.extent`): `#locMsg` "You are outside the model area: 2.4 km west of it" (distance to
  the box, direction by grid bearing less convergence) and "Show where I am": camera at the nearest edge (60 m in),
  yaw towards the person, pitch 0.3, distance 900 m; mode `located`.
- **Errors**: code 1 -> how to allow it in the site settings (and iOS Location Services); 3 -> "took too long" with Try
  again; 2 -> "not available, check location is on" with Try again; `!isSecureContext` -> needs https; no
  `navigator.geolocation` -> said. Without permission the page works as before.
- **Privacy**: no request carries the position, nothing is stored, the URL does not change (About > "Your location"; the
  atlas says the same under the map and adds that map tiles around any place viewed come from tile.openstreetmap.org).
- **Atlas** (https://danbri.github.io/glitchcan-minigam/magpie/cwplans/atlas/#map): a Leaflet control at the bottom right
  (38 px above the corner so the (i) stays clear), `map.locate({ watch: true, enableHighAccuracy: true })`, `L.circle` with
  the accuracy and an `L.circleMarker` dot; tap = ask and centre (zoom 17 or closer), `dragstart` -> located, tap = centre,
  hold = off; no heading (the map does not rotate). Hook `__atlasLocate.state`.

Test (headless Chromium, SwiftShader WebGL; Playwright `permissions: ['geolocation']`, `setGeolocation`, compass by
`dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha, beta, gamma, absolute: true }))`): 3D page
29 checks at 1600 x 900 DPR 1 and 28 at 390 x 844 DPR 3 touch (no wheel there), all pass on 2026-10-04 (after the Works in progress
layer landed): no geolocation call on load; denied message (the denial is stubbed: headless Chromium leaves the prompt
open and the mode stays `waiting`; CDP `Browser.setPermission` from a page session did not deny); first fix in under
60 ms and view centred in 3.3 to 7.7 s (SwiftShader frames); alpha 0/270/180/45 -> heading 358.45/88.38/178.38/313.35
grid, camera yaw error under 0.6 degrees once settled; tap 3 stops turning; touch drag (CDP touch events) and mouse drag
-> `located` with the dot; wheel keeps `centred`; eye mode east at 88.3 degrees grid with a level horizon, beta 120 ->
pitch 30; visibility hidden stops the watch and the compass; outside (Trafalgar Square) "2.4 km west" and the edge view at
x -5090 looking west; hold -> off and the next tap works; no request with the position; URL unchanged; no console error.
Atlas: 9 checks x 2 sizes pass. Wait for convergence by polling in tests, never a fixed sleep: SwiftShader frame times
change whenever another layer lands.

Only a real phone can confirm: the iOS motion permission prompt and the location prompt; that `webkitCompassHeading` is
right when the phone is upright (Apple documents it for the device top); compass calibration and magnetic interference
near steel towers; GPS accuracy among the towers (multipath often gives 30 to 100 m) and under the DLR; how the beam and
the eye mode feel with real sensor noise; that `deviceorientationabsolute` fires on the owner's Android browser; that the
watch restarts after the phone sleeps; battery use with high accuracy on.

## Ships (AIS) (2026-10-04)

Live: https://danbri.github.io/glitchcan-minigam/magpie/cwplans/docklands/#at=-4330,-90,500 (the Pool of London: HANSEATIC
SPIRIT alongside HMS Belfast on 4 October 2026). Data, licences and the review flag: skill `cwplans-river-and-water`, "AIS:
Open Waters" and "Review before scaling" (AISHub and aisstream.io shown for scoping by the owner's decision of 2026-10-04).

- **File** `docklands/ships-layer.js` (like `river-layer.js`): `DocklandsShips.init(ctx)` gets the same helpers as the river
  layer; index.html draws `OV.ships` right after `OV.rclock` at full brightness. Layers > River > "Ships (AIS), live", **on by
  default** (owner: "Add to live by default now").
- **Data path.** On load: the committed `../feeds/river/ais.json` at once, then `GET https://ais.openwaters.io/v1/vessels?bbox=
  51.474,-0.095,51.528,0.085` from the browser (anonymous, `access-control-allow-origin: *`, no key), again every 60 s while
  the tab is visible and the layer is on; `visibilitychange` stops and restarts it; an error or 429 doubles the pause up to
  16 min. One request a minute is far under the 120-a-minute limit.
- **Private craft** are filtered in the page with the tool's rule (`DocklandsShips.isPrivate`): ITU 36/37, class B (from
  `msg_type`) without a commercial type, or no class and no commercial type. The live snapshot has no `class` field: class A
  is inferred from `PositionReport`/`ShipStaticData`. Counted in the note under the checkbox, never drawn.
- **Marker**: a white hull along the heading (else the course), length and beam from AIS (minimum 14 m x 4 m so small
  boats stay visible), a plate and a mast coloured by type (passenger orange, high-speed cyan, tug yellow, cargo green,
  tanker red, aids to navigation violet), and an arrow ahead of the bow, longer with speed, only when under way (not moored,
  at anchor or aground, and over 0.5 kn). Ships of 60 m or more get a label. Heading 0 = north = -z, east = +x.
- **Taps**: `OV.hits` entries with `ais: true`. `buildOverlays()` replaces `OV.hits`, so a 1 s timer puts the ship hits
  back when they are missing (the river layer's clock does the same through `rebuildClock`). The card: name, type, length,
  speed, course, heading, status, destination, last heard (London time), MMSI, IMO, call sign, flag, the event's source and
  its attribution, a scoping/review line for AISHub and aisstream.io, the Open Waters record link, "not for navigation".
- **Credits**: Menu > About > Credits, "Ships (AIS)" (Open Waters AIS; AISHub; aisstream.io; private craft not shown).
- **Measured** (2026-10-04, mocked live snapshot of 108 features): 87 in the list after the filter, 21 private craft not
  shown, 27 outside the model box (Royal Docks margin), 60 drawn; HANSEATIC SPIRIT 71 m from HMS Belfast's OSM point,
  moored, source aishub. Matrix and the real-fetch run: see the activity log of 2026-10-04.
- **Positions are now**, not the page clock (`?t=`): the card and the note say so. A track replay for the clock would need
  `/v1/vessels/{mmsi}/track` (48 h anonymous) per vessel: not built.

## London Datastore facts on the building card (2026-10-04)

`feeds/london-datastore/lds-building.js` (shared with the atlas dossier) and two lines in `selectBuilding`: a
`<div id="ldsB">` in the card and, after the card is written, `LdsBuilding.load('../')` then
`LdsBuilding.html(ab.id, esc)` (heat demand, solar potential, the LSOA and its 2021 Census figures, venues and other
records placed in the building, each with key and confidence; data `registry/sources/lds/`, made by
`tools/join-lds.mjs`, skill `cwplans-london-datastore`). Nothing is drawn in the city. Credit in Menu > About >
Credits, "London Datastore". Tested headless (SwiftShader): rotherhithe, greenland, pier x 1600x900 DPR 1 and 390x844
DPR 3, no console error; the card of cwb-0413 shows heat, solar and the LSOA context.

## Navigation: momentum, ground limit, share (2026-10-05)

Owner, 2026-10-05: "Also pls add momentum to visual navigation". Code: `docklands/nav.js`, loaded after `locate.js`. It
reaches the page through `__docklands` only, plus listeners added after the page's own (window capture to take a camera
snapshot before a move, `cv` and `#labels` bubble listeners to read the result after it). Test hook: `DocklandsNav`
(`state`, `fling(v, t)`, `tick(now)`, `stop()`; `state.manual = true` stops the rAF loop so a test can step time).

- **Momentum** (drag, pinch, twist; map and pixel art): the release velocity is the camera's own motion (tx, tz, yaw,
  pitch, ln dist) over the last 80 ms of moves, from `event.timeStamp`. No momentum when the finger was still for more than
  60 ms before it lifted, or when a part is slow (pan under 0.25 view distances a second, turn or tilt under 0.3 rad/s, zoom
  under 0.4 ln/s); caps 3 distances/s, 5 rad/s, 2 rad/s, 3 ln/s. Decay is by time: each part follows s0 + v TAU (1 - e^(-t/TAU)),
  TAU 0.35 s, ended 3.2 s after the release, so a frame rate of 2 (SwiftShader) and 120 (a phone) end in the same place.
  Stopped by any pointerdown (anywhere), a wheel, Escape, a hidden tab, `prefers-reduced-motion: reduce` (no momentum at
  all), the locate button's follow modes (centred, heading, eye: `fling` refuses), a free camera (`cam.eye`), and anything
  else that moves the camera (a view, a search, a flight, the locate follow loop): each step compares the camera with what
  it last set, the same rule `locate.js` uses. Two fingers that lift within 80 ms of each other keep the pinch's velocity.
- **Measured** (headless, SwiftShader; CDP input with explicit `timestamp`s, because at 2 frames a second each
  un-timed `page.mouse.move` waits about 3 s for a frame and every gesture reads as slow): one fling stepped at 2, 60 and
  120 steps a second ends within 2e-12 of the closed form; a fast drag flings (yaw -5 rad/s, capped) and a press stops it
  dead; hold 200 ms before release and a slow drag: no fling; a two-finger twist plus spread flings yaw and zoom (touch);
  `setView` during a fling stops it; in locate `centred` mode `fling` returns false and the follow still reaches the fix;
  reduced motion: no fling. 1600 x 900 DPR 1 (mouse) 7/7 and 390 x 844 DPR 3 (touch) 8/8, no console error.

## KML (2026-10-05)

Owner, 2026-10-05: "Also look into basic KML support". Live: https://danbri.github.io/glitchcan-minigam/magpie/cwplans/docklands/
(Menu > Layers > My KML) and https://danbri.github.io/glitchcan-minigam/magpie/cwplans/atlas/#map (Layers box, "KML").

- **Files.** `docklands/kml.js`: an ES module with no dependencies, shared by both pages (`readKml`, `parseKml`, `writeKml`,
  `toGeoJSON`, `placemarksFromGeoJSON`, `kmlColor`, `download`). `docklands/kml-layer.js`: the 3D page's layer, a module.
  `atlas/kml-atlas.js`: the atlas side. index.html has three hooks only: the module tag after `locate.js`; the line
  `globalThis.DocklandsKMLctx = {...helpers}` before `window.__docklands` (the page script is an IIFE, so a module can reach
  its helpers only this way; modules run after it, so the object exists when the layer starts); one draw line after
  `OV.glass` that draws `OV.kml` with the depth mask on and `OV.kmlA` (see-through) with it off. The atlas has one module tag.
- **Supported** (KML 2.2, any namespace, by local name): Placemark with Point, LineString, LinearRing, Polygon (outer and
  every inner boundary), MultiGeometry, gx:Track and gx:MultiTrack (as lines); name; description and Snippet as plain text;
  ExtendedData (Data with displayName, SchemaData/SimpleData with the Schema's displayName); Style and StyleMap by id (the
  "normal" pair), inline Style, LineStyle colour and width, PolyStyle colour, fill and outline, IconStyle colour and scale;
  colours are `aabbggrr`; Document and Folder nesting (the path shows on the card); `visibility` 0 on a feature or an ancestor
  (counted, not drawn); altitudeMode clampToGround, relativeToGround, absolute (gx: seafloor modes as ground); extrude for
  polygons and lines above the ground (walls); Camera and LookAt on the Document or a feature, with gx:horizFov; KMZ.
- **Not supported** (counted in the file's note): NetworkLink (listed with its href, never fetched), GroundOverlay,
  ScreenOverlay, PhotoOverlay, Tour, Model, Region and LOD, BalloonStyle templates, styles in another file
  (`other.kml#id`), icons from the file (a pin in the icon colour instead), time (TimeSpan, gx:Track `when`), ListStyle.
- **Parsing.** `DOMParser` with `application/xml`; a `parsererror` element means the file is refused with its first line in
  the toast. Only the coordinates text is split (white space between tuples, commas inside; a space after a comma is
  allowed). **Descriptions:** KML allows HTML, often in CDATA. `plainText()` parses it in a `text/html` document from
  `DOMParser`, which is inert (scripts do not run, images do not load), removes script, style, iframe, object, keeps line
  breaks for `br` and block elements and adds a link's URL in brackets; every card and popup puts text in with `textContent`.
  Tested: `<script>`, `<img onerror>` and escaped `&lt;script&gt;` in descriptions, names and data values: nothing ran, no
  element was made, the text shows. A description with no `<` is already plain (the XML parser decoded the entities): do not
  run it through the HTML parser, or its line breaks collapse (they did in the first round trip).
- **KMZ** without a library: the zip's end-of-central-directory record, the central directory, the local header, then
  `DecompressionStream('deflate-raw')` (Chrome 80, Safari 16.4, Firefox 113 and later; older browsers get "unzip it and
  open doc.kml"). The document is the `.kml` at the shallowest depth, `doc.kml` first. A file is a KMZ by its `PK\3\4`
  signature, not by its name. Encrypted entries and methods other than stored and deflate are refused.
- **3D drawing** (`featureMesh`): positions only through the page's `geo()`; heights in m OD: clampToGround = `groundAt` (+1 m
  for lines and outlines, +0.8 m for fills), relativeToGround = ground + altitude, absolute = altitude (KML "absolute" is
  above sea level; ODN is within about a metre of it here). Points: a white stick 22 m (x IconStyle scale) with a head in
  the icon colour, and a bar at the altitude when it is not on the ground. Lines: `beam` segments, width 2 m per KML pixel
  (2.5 to 30 m), clamped lines re-sampled every 15 m along the ground. A clamped polygon fill is **draped**: one quad per
  20 m terrain cell whose centre is inside the outer ring and outside the holes (an earcut fill at ground height crossed the
  ground on slopes and banks); a shape smaller than a cell falls back to earcut. Polygons in the air: earcut at their
  altitudes, extrude = walls to the ground. Fills take the PolyStyle alpha (vertex alpha, the `pr` program multiplies it);
  a file with no style is drawn yellow, as in Google Earth.
- **The model box.** Segments are clipped to `A.meta.extent` (Liang-Barsky); a point outside, or a shape with nothing
  inside, is not drawn. The file note and the toast say "n outside the model box (not drawn), n partly outside (cut at the
  edge)". Do not draw past the box: `groundAt` clamps to the grid edge, so outside shapes float (the overlay lesson above).
- **Taps.** One anchor per feature in `OV.hits` (`kml: true`) and each polygon in `OV.polys` (in front, so your own shape
  answers a ground tap first). `buildOverlays()` replaces both arrays: a 1 s timer (`sync`) puts them back, as the ships
  layer does. Names become `.lb.kml` labels (pri 3).
- **Camera.** KML Camera to the page: eye = `geo(lon, lat)` at the altitude, heading = -yaw, tilt 90 = level, so the page's
  orbit point is 1.2 km along the line of sight (as `eyeView`); `ty` takes the vertical exaggeration into account. A Camera
  with no gx:horizFov gets 60° horizontal (Google Earth's default); without it a portrait phone showed 22°. LookAt: target,
  `dist = range` (80 to 16,000 m), pitch = 90 - tilt. Roll is not used (the page has no roll in this mode). Back: the drawn
  camera `CAM` (eye and target; y / VZ), lon and lat from the **inverse of `geo()`** by Newton steps (`lonLatOf`; no second
  transform), heading from north, tilt from straight down, gx:horizFov from `fovY` and the aspect.
- **Export** ("Export view as KML", a Blob download, no network): the camera as a KML Camera (absolute); the selected
  building (each model part's OSM outline at its LiDAR roof, absolute, extruded); works-in-progress sites in the box when
  that layer is on (status colour, dates and rule as ExtendedData; footprints from OSM marked ODbL); river items of the
  river layers that are on (points; OSM-derived positions marked ODbL); your own KML. The Document description holds the
  credits and licences of what is in the file (from the data's own `meta.sources` / `meta.attribution`). AIS ships are not
  exported (licence under review). Atlas: "Export <layer> as KML" writes the layer's features in the map window (Leaflet
  `toGeoJSON`, names from the tooltip, colours from the path options, `#333` short hex read too) with a LookAt of the map;
  the buildings layer is marked OSM. Leaflet `bindTooltip(string)` is HTML: the atlas gives KML names as text nodes.
- **Drop.** The window lock's `dragover` sets `dropEffect = 'none'` for anything but audio, and a drop with that effect never
  fires. The KML modules add their own `dragover` and `drop` listeners after the lock's (registration order: theirs set
  `copy` for a file item that is KML, has no type, or is XML or zip) and take `.kml`/`.kmz` drops; audio still goes to the
  player. `?kml=<url>` (http or https; the server must allow CORS) loads on open; a document view is taken, else the
  camera frames the drawn features.
- **Measured** (2026-10-05, SwiftShader; fixtures in the scratchpad, not committed: 11 placemarks in 4 folders, 1 hidden, 1
  outside, 1 half outside, a polygon with a hole, an extruded polygon at 120 m, a StyleMap, Data and SchemaData, a Camera, a
  LookAt, a NetworkLink, a GroundOverlay; the same file as a KMZ): picker and drop both 9 drawn, 1 cut at the edge, 1
  outside, 1 hidden, NetworkLink and GroundOverlay reported; colours read as red ff0000ff -> (1, 0, 0, 1), blue 7fff0000 ->
  (0, 0, 1, 0.498); the document Camera came back from the page camera exactly (lon, lat, alt, heading, tilt); export ->
  import of the Rotherhithe view: lon and lat within 4e-8°, alt, heading, tilt and field equal; a broken file gives a toast;
  `?kml=` from another origin (CORS) and a KMZ by URL work; a tap on a pin's top opens its card; no console error at
  1600 x 900 DPR 1 and 390 x 844 DPR 3. Atlas, both sizes: 10 layers (the hidden one filtered), drop of the KMZ, popups
  text only, export of the buildings layer (141 features at zoom 17 at 1600 px, OSM licence on each) and of a KML layer
  (11), no console error.

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
