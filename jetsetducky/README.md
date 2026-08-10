# 🐥 Jet Set Ducky — a 3D Maisonette Misadventure

Single-page, self-contained isometric platformer. Part *Jet Set Willy* (named
rooms, patrol guardians, collect-then-bed goal, fixed lives), part *Ant
Attack* / filmation (one continuous scrolling isometric world). Mobile first.

Play: `jetsetducky.html`. No build step, no CDN, no network at runtime.

## Tech
- **three.js r180 WebGPU build**, vendored in `vendor/` (`three.webgpu.min.js`
  + `three.core.min.js` + `three.tsl.min.js`). `WebGPURenderer` falls back to
  WebGL2 automatically, so TSL runs everywhere.
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
25 items; collect all, then touch the bed. 4 lives; deadly water, guardians,
long falls. Auto-step climbs 1-block stairs; jump clears ~2.3 blocks.

## Headless testing
`window.__jsd` hook: `.start()`, `.press(name,down)`, `.teleport(x,y,z)`,
`.mute()`, `.player`, `.state`. Playwright + SwiftShader works (WebGL2
fallback path — the WebGPU path needs a real browser, per repo CLAUDE.md).
