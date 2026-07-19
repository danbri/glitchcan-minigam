# ROBBIN 🐦 — an egg-and-ladders platformer

A single-page platformer in the grand 8-bit egg-and-ladders tradition.
Robbin the robin
raids the garden for eggs while a blackbird, blue tits and wrens patrol the
platforms (and eat the grain if you don't get there first).

**Play:** `robbin.html` · **Sprite proofs (dev):** `sprites.html`

## The graphics

The four birds — robin, blackbird, blue tit, wren — are hand-vectorized from a
set of lino-print bird cards (photographed, then traced by eye as layered flat
ink shapes). Sprites live in `robbin-sprites.js` as SVG path data in a 100×100
box, drawn to canvas via `Path2D`, with procedurally animated twig legs so the
same artwork covers stand / walk / air / climb / peck poses and both facings.
`birdSVG()` emits the same shapes as inline SVG for the title screen. No image
assets: everything is vector.

## The game

Classic egg-run rules:

- 12 eggs per level (100 pts each); collect them all to advance.
- Grain is worth 50 pts — but patrolling birds peck it away.
- Birds walk platforms and make random choices at ladders. Touch = death.
- Countdown timer; remaining time becomes bonus points on completion,
  and running out costs a life.
- 5 lives, extra life every 10,000 pts, hi-score in localStorage.
- 4 levels: The Garden, The Rooftops, The Wren House, and The Lift —
  with an up-only lift (ride past the top and you're done for).
  Levels then loop, faster each time.

## Controls

- **Keyboard:** ←→ / AD run · ↑↓ / WS ladders · Space / Z jump ·
  P pause · Enter start
- **Touch:** on-screen d-pad + jump button (shown on coarse-pointer devices).

## Implementation notes

- Plain ES modules, no dependencies: `robbin.html` + `robbin-game.js`
  (engine, levels, foley) + `robbin-sprites.js` (vector art).
- Levels are 20×15 ASCII tile maps: `#` platform, `H` ladder, `+` platform
  pierced by ladder, `E` egg, `G` grain, `P` spawn, `L` lift shaft.
- Fixed-feel physics tuned to 8-bit platformer conventions: fixed jump arc with head-bump,
  no fall damage, ladder-snap climbing, enemies never jump.
- Procedural WebAudio foley (chirps — they're birds).
- `window.__robbin` is the headless-playtest hook (same convention as
  tanks-for-the-trees' `__tftt`).
