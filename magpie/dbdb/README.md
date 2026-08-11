# 🐥 Jet Set Ducky — a 3D Maisonette Misadventure

Single-page, self-contained isometric platformer. Part *Jet Set Willy* (named
rooms, patrol guardians, collect-then-bed goal, fixed lives), part *Ant
Attack* / filmation (one continuous scrolling isometric world), part *Prince
of Persia* (a bedtime deadline, and a rotoscope-style articulated human hero
— deliberately hyper-real and off-palette against the C64-coloured blocky
manor, with Ducky riding the shoulder; `?hero=duck` restores the original
duck). World palette is the Commodore 64's 16 (Pepto values). Mobile first.

Play: `dbdb2.html` (rev 2, "The Moonlight Shift") or `dbdb.html`
(original rev). No build step.

## Rev 2 — The Moonlight Shift
- Chunked engine: 16x16-column merged chunks, per-vertex baked voxel AO +
  cool moon key + warm lamp glow; distance fog to a night sky; stars and
  a dithered moon composited in the post pass.
- Veil occlusion (was: peephole): geometry between camera and hero goes
  mostly-translucent via per-pixel screen-door discard, and the surviving
  pixels shimmer — a frosted, wibbling, rapidly colour-cycling curtain
  (wobbled radius, radial hue rings, hash sparkle). You see the hero AND
  you unmistakably see the wall is still there. Replaces both the rev-1
  x-ray ("hero everywhere") and the plain cut-out ("mistaken for absence").
  Retuned in 2.1: a 2.2-unit depth margin keeps floor/bushes at the hero's
  own depth solid (was: dirt-speckle), survivors keep ~45% density and go
  bright pastel (never muddy), and a breathing rim marks the curtain edge.
- Full-360 camera: drag anywhere (right half on touch) to spin freely;
  Q/E or the buttons snap to the nearest diagonal station.
- THE PUZZLE CITY: 200 generated courts south of the manor, 5 puzzle
  instances each = a literal 1000 per set (`?set=1..1000`, default =
  today's; `?mini` builds a 4x3 city). Templates add real game objects:
  pushable crates (they fall, they stack, they make stepping stones),
  keys + locks, latching levers, spring pads — plus the rev-1 plates,
  bridges, gates, fires, crumbles and guardian lanes.
- Goal unchanged: tidy the manor's items and reach the bed by midnight.
  City puzzles feed the PUZ counter — bragging rights and spare lives.

## Rev 2.1 — Moonfall Parade (the west district)
Not a puzzle: a PLACE, and it is inhabited. The residents run on the
hero's own rotoscope rig — hyper-real people, deliberately off-palette
against the C64 blocks, each with procedural behavioural loops:
- **THE JOVIAL NEWT** — a pub. A huge jovial barkeep couple (aprons,
  moustache, hair up) works the counter: pouring, wandering the aisle,
  and every so often meeting mid-bar for a mighty back-slap and a roar
  (both stagger, both laugh). Five regulars jostle shoulder-to-shoulder
  at the counter — tip-toe bouncing, craning, waving notes — swap places
  in the queue, get served a mug (sometimes with a back-slap that
  staggers them), carry it to a table, drink with periodic tip-backs,
  and rejoin the scrum.
- **The maglev** — an elevated beam down the parade. A hover carriage
  glides in, dwells at the platform, and lets shoppers off; they descend
  the station stairs, walk to the greengrocer or the bakery, squeeze the
  tomatoes (browse-and-reach animation), receive a veg box or a loaf
  (carried two-handed), walk to the kerb, HAIL (arm straight up) — and a
  low glowing car slides in, collects them, and zooms off with a
  motion-stretch. Riders recycle onto the next carriage.
- **THE DREAM DOORS** — five Commodore-PET-shaped terminals in early-iMac
  candy plastic (bondi in the Newt's booth, grape in the Library,
  strawberry in the Attic, lime in the Conservatory, tangerine on the
  maglev platform), screens rolling with TSL static. Each tints the
  dream shell its own phosphor (`dream.html?tint=`). Stand at any and
  jump to JACK IN: the screen swallows the view (CSS bezel zoom) and boots
  `dream.html` in an iframe — a NESTED ink scene (real inkjs compile)
  set INSIDE a real Gaussian splat (the SPLATPORT tree scan), rendered
  by the **PlayCanvas engine** ('gsplat' + compressed.ply, vendored at
  `third_party/playcanvas/`) — REAL splatting on iOS too, where
  GaussianSplats3D drew a black screen. You drift
  in the scan hunting three glowing clues; each tap advances the ink
  story; WAKE posts back over postMessage and the manor grants an extra
  Ducky. The ink-as-bus doctrine, one layer down: game → terminal →
  dream → back.

## Tech
- **three.js r180 WebGPU build**, loaded from the jsDelivr CDN first, with a
  5-second timeout falling back to the vendored copy in
  `third_party/three/` (`three.webgpu.min.js` + `three.core.min.js`; TSL
  functions come from the build's `TSL` export, so no import map is needed).
  `WebGPURenderer` falls back to WebGL2 automatically, so TSL runs everywhere.
- **TSL node materials:** world-space dither ("attribute clash") on the merged
  block mesh, banded shimmer water, animated chevron conveyors, crack-pattern
  crumble blocks with a per-block damage uniform, palette-snapping item flash,
  candle flicker, pulsing ghost opacity.
- **TSL post chain:** barrel distortion, chromatic aberration, scanlines,
  shadow-mask, vignette, flicker. Disable with `?crt=0`.
- The static world is one merged `BufferGeometry` (hidden faces culled, face
  shading + ZX palette baked into vertex colors). Renders at a chunky internal
  resolution (~430 px tall) for the pixel look.
- **Audio:** 3 square-wave channels + noise over WebAudio — an AY-chip
  impression. In-game (rev 2): THE WIRELESS — a 50-tune tagged playlist
  of public-domain arrangements (Bach to Joplin, Grieg to Satie; the
  Moonlight title theme makes 51). Each tune carries tags
  (danger/victory/somber/spooky/chase/gentle/night/garden/manor/city/…);
  game events cut in matching tunes (final two minutes → danger, win →
  victory, midnight → somber) and between events the rotation is 65%
  biased toward the current zone's tag, else round-robin. Every tune's
  tracks are length-equalized by construction (`tile()` pads the bass to
  the melody), which is the anti-out-of-tune invariant, checked at boot.
  Now-playing toast on every change. SFX for
  jump/pickup/death/splash/fanfare.

## World
Ten zones on a terraced cutaway manor: Duck Pond → Grand Hall / Kitchen /
Conservatory (ground), First Landing / Bathroom / Library (terrace 1),
Master Bedroom / Attic (terrace 2), Rooftops (parapet catwalk + chimneys).
~50 items across the manor AND the Puzzle Gardens — six procedurally
generated walled courtyards east of the house, built from six puzzle
templates (plank bridge, hearth, portcullis gate, crumble hopscotch,
guardian lane, bonk columns) by a seeded generator: `?set=1..1000` picks
one of 1000 puzzle sets (default: today's). Collect all, then reach the
bed before the 20-minute bedtime clock strikes midnight. 6 lives; deadly water, guardians, a lit hearth,
long falls. Auto-step climbs 1-block stairs; jump clears ~2.3 blocks.
Pressure plates run timed mechanisms (pond bridge, hearth douse). Jumping
and clonking an item's supporting block claims the item (Mario-style).
Camera rotates through the four diagonals (Q/E or the ⟲⟳ buttons),
interpolating then snapping; controls are screen-relative and rotate too.
Rev 2.1 walk assist: input within ~17° of a world cardinal snaps to it,
and a soft lane-centering nudge (capped at 1.3 u/s) pulls you onto the
cell centre — so walking a wall-top no longer needs a perfect thumb.

## Headless testing
`window.__jsd` hook: `.start()`, `.press(name,down)`, `.teleport(x,y,z)`,
`.mute()`, `.player`, `.state`. Playwright + SwiftShader works (WebGL2
fallback path — the WebGPU path needs a real browser, per repo CLAUDE.md).

## Design doctrine (owner, Aug 2026)
When games can be wished into existence, nobody will invest in mastering a
one-off's obscure physics. The scarce resource is player patience, not
content. Therefore: **controls must be nearly free at entry — instant
competence — and fun must arrive through level escalation, not control
mastery.** A level-1 player touching nothing should still make progress;
assists (guides, magnets, auto-recovery) are stripped away level by level
until mastery is optional flavor at the top. Applied first to CANARY WHARF
(`canarywharf.html`): guide beam + beacon magnet + water auto-pullup at
level 1, four levels ending in "Peregrine Nights" with no net. Verified by
a hands-off headless run that lit a beacon with zero input.

## Also in this folder: CANARY WHARF
`canarywharf.html` — a one-thumb dusk flight over a stylised Docklands
(TSL curtain-wall towers, sky dome, murmuration, DLR loop, peregrine;
Satie on triangle waves). Four levels from full-assist to no-net.

### Ink as the bus (Aug 2026)
- The game is a FINK minigame: `inklet/minigames/canarywharf/` (manifest +
  redirect wrapper, waterworld pattern); reachable from the TOC
  (`# MINIGAME: canarywharf mode=firstlight`). Speaks the finkgame SDK
  natively — ready/init/setVariable/complete with wharf_* variables.
- The story ("The Lamplighters' Dispute") is compiled at boot with the
  REAL inkjs compiler from `third_party/ink/` and plays on an IN-WORLD
  screen: live, tappable DOM perspective-matched onto One Canada Square's
  face via a hand-rolled CSS3DRenderer composition (camera-div row-flip +
  object column-flip matrix3d). Choices grant flight boons (ink drives
  the game); beacons feed ink variables (the game drives ink).
- Splat-look layer: ~4200 procedural gaussian points sampled on the tower
  skins; a swirl uniform scatters/reforms them as the transition into and
  out of story mode. (True 3DGS needs scan assets; this ships the
  aesthetic self-contained. No browser API exists yet for interactive DOM
  surfaces inside WebGL/WebXR — CSS matrix3d compositing is the honest
  working equivalent.)
- The floor is no longer an afterthought: flag-stone paving with joints
  and tone variation, warm promenade edge strips on every quay lip, and a
  pocket park of lime trees.

## Also: SPLATPORT (`splatport.html`)
Prototype of "infinite evocative locations": a REAL Gaussian splat asset —
"ChristmasTree" by Keijiro Takahashi (huggingface.co/keijiro-tk/splat-data,
The Unlicense), prefix-truncated to 150k/400k-splat LODs in `splats/` —
rendered with the vendored GaussianSplats3D library (MIT,
`third_party/gaussian-splats-3d/`, CDN-first with local fallback;
`sharedMemoryForWorkers:false` because GitHub Pages sends no COOP/COEP).
An ink story (The Portkeeper, real inkjs compile) stands inside the scan
on the same perspective-matched DOM screen technique as Canary Wharf;
choices summon snow and Carol-of-the-Bells triangles. Camera framing was
derived from the data (bbox, densest-cell PCA for the scan's tilted
vertical, an 8-view orbit probe). `?hq` for the 400k cut.
