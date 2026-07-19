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
with feet off the floor, and ladder climbs are fluttered too.

Flight is staged by the classic animation principles: wing smear-frames
for the fast beats (timing), a second far wing over the back so a flying
silhouette reads instantly (staging), wings spread wide when falling and
buzzing tight when rising (exaggeration), a lagged tail and a stabilised
counter-bobbing head (follow-through and overlap), an eased lift into
the flit (slow-in, arcs), per-beat body squash, and ink air-ticks plus
landing feather-puffs (secondary action). The rival birds properly fly
too: they glide off platform edges and pull the odd flutter-hop
mid-patrol. Sprites live in
`robbin-sprites.js` as SVG path data in a 100×100 box, drawn to canvas via
`Path2D`; `birdSVG()` emits the same rig as static inline SVG for the title
screen. No image assets: everything is vector.

## The game

Classic collect-em-up rules (no egg thieving — these are honest birds):

- The game runs along **the Flight Line** — stations loosely modelled on
  step-free tube navigation. Each station is a set of flip-screens joined
  by edge tunnels (walk off the side of one screen into the next; arched
  tunnel mouths mark the way). Grain is pooled across the whole station:
  clear every screen to ride on. Between stations a schematic line map
  shows the journey — stations done, next stop pulsing, lifts marked.
- Grain piles are worth 100 pts each; gobble the station's lot to advance.
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
- 2 stations of 2 screens each: GARDEN GREEN (The Garden · The Rooftops)
  and WRENWICH PARK (The Wren House · The Lift — an up-only lift; ride
  past the top and you're done for). The line then loops, faster each
  round.

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
- **Touch:** a symmetric 3×3 eight-way pad — one joystick surface, so
  tap a cell, drag around it, or swipe across it — plus a jump button,
  floating translucently over the game.
- **Two movement modes** (toggle on the title screen, persisted):
  - **HOLD** — classic: move while a direction is held.
  - **GLIDE** — a swipe/tap sets a persistent heading, Pac-Man style.
    Diagonals keep both intents live: SE runs east and boards the first
    southbound ladder it passes (or, if already climbing, steps off at
    the first junction where floor continues east) — "downstream" moves.

## TUBE FLOCK (second game, from the title menu)

The libbirds — the four animated vector birds — flit around a curated,
real-geography slice of the Underground (Central / Northern / Jubilee
around Bank and London Bridge, drawn schematically in the lino style;
no TfL branding). The flock roosts at a station with a journey in mind
— the opening trip is Liverpool Street → Bermondsey — and you swipe or
arrow along lines to travel, changing lines at interchanges. Hazard:
stations with their **lift out** (crossed-box glyph) force you onto the
ESCALATOR when changing lines — it carries you down while you mash jump
to flutter up. Journeys score 500 + remaining time and top the clock
up; the service terminates when time runs out. Separate hi-score.

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
