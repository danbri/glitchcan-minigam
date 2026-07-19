# ROBBIN 🐦 — an egg-and-ladders platformer

A single-page platformer in the grand 8-bit egg-and-ladders tradition.
Robbin the robin
raids the garden for eggs while a blackbird, blue tits and wrens patrol the
platforms (and eat the grain if you don't get there first).

**Play:** `robbin.html` · **Sprite proofs (dev):** `sprites.html`

## The graphics

The four birds — robin, blackbird, blue tit, wren — are hand-vectorized from a
set of lino-print bird cards (photographed, then traced by eye as layered flat
ink shapes). Each bird is a **cutout rig**, South Park paper-doll style: tail,
body, wing and head are separate masks that rotate around their own pivots,
with the lower beak hinged inside the head so the birds chirp and peck. One
tiny skeleton (`partRot`) drives all poses — stand / walk / flit / air /
climb / peck — plus procedurally animated twig legs and both facings.
Birds don't trudge: sustained walking lifts into a low wing-flutter flit
with feet off the floor, and ladder climbs are fluttered too. Sprites live in
`robbin-sprites.js` as SVG path data in a 100×100 box, drawn to canvas via
`Path2D`; `birdSVG()` emits the same rig as static inline SVG for the title
screen. No image assets: everything is vector.

## The game

Classic collect-em-up rules (no egg thieving — these are honest birds):

- 12 grain piles per level (100 pts each); gobble them all to advance.
- Doorstep milk bottles are the bonus: peck the yellower creamy top off
  for 250 pts — real blue-tit behaviour — but the rival birds pinch the
  cream in passing if they reach a bottle first, leaving the empty
  bottle behind.
- Birds flow through the level Pac-Man style: constant speed, always moving,
  picking randomly among the ways onward at each junction and reversing only
  at true dead ends. Touch = death.
- Countdown timer; remaining time becomes bonus points on completion,
  and running out costs a life.
- 5 lives, extra life every 10,000 pts, hi-score in localStorage.
- 4 levels: The Garden, The Rooftops, The Wren House, and The Lift —
  with an up-only lift (ride past the top and you're done for).
  Levels then loop, faster each time.

## Mobile-first presentation

The canvas fills the whole viewport and a camera follows Robbin, zoomed so
characters stay big and cartoony (~8.5 tiles across the short screen edge,
clamped between fit-whole-level and full-bleed). On phones that means huge
birds and a panning view; on wide desktops most of the level fits. The HUD
floats as a translucent band, touch controls float over the play area, and
cartoon touches — eye glints, squash-and-stretch on jumps and landings —
keep it lively.

## Soundtrack

`robbin-music.js` is a procedural chiptune: an 8-bar C–Am–F–G loop at
112 BPM with square lead (detuned double, vibrato, dotted-eighth echo),
16th-note arpeggio shimmer, triangle bass over a sine sub-octave, noise
hats and a sine kick. Pure WebAudio, no samples. It ducks when you die,
stops on game over, and toggles with **M** or the speaker button
(persisted in localStorage).

## Controls

- **Keyboard:** ←→ / AD run · ↑↓ / WS ladders · Space / Z jump ·
  P pause · M music · Enter start
- **Touch:** translucent d-pad + jump button floating over the game
  (shown on coarse-pointer devices).

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
