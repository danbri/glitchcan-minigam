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
- Peephole occlusion: a dithered window is discarded through any geometry
  between camera and hero (screen-space + view-depth test) — replaces the
  rev-1 x-ray silhouette, which read as "hero everywhere".
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
  impression. Title: Moonlight Sonata; in-game: In the Hall of the Mountain
  King (both public domain). SFX for jump/pickup/death/splash/fanfare.

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
