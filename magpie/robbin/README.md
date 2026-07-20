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
  clear every screen to ride on — pulsing edge chevrons show how much
  grain remains next door, and shout in red once your screen is done.
  Between stations a schematic line map shows the journey — stations
  done, next stop pulsing, lifts marked.
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

A cosy, heartwarming journey — no clock, no lives, no fail state. The
main dynamic is **growing the flock**: twenty-two lost libbirds —
robins, blackbirds, blue tits and wrens, everything the four
lino-print drawings can be — are scattered across the **entire London
Underground**: all eleven lines and 271 stations, baked from TfL's
open data by `tools/fetch-tube.mjs` into `tube-network.js` (real
geography drawn in the schematic lino style, no TfL branding), plus
the hollow-striped Windrush segment. The map is drawn as a proper
**transit diagram**: at bake time the real geography relaxes onto the
45° grid (near-uniform stop spacing, straightened runs — the design
language of a schematic map, in our own lino ink, no TfL artwork);
parallel lines sharing a corridor ride offset side by side, ordinary
stops wear tick marks, interchanges wear rings. A camera glides along
with the flock; station names appear where they matter — where you
are, where you can fly next, and who you're looking for — and when
the lost bird is halfway across the city a pulsing arrow at the
screen edge points the way. Fly line-to-line on the map toward the
current lost bird; on arrival the flock gathers at the station mouth,
then a little cutscene plays: the train slides in, doors open, and the
whole flock hops out onto the platform. Boarding is its mirror — the
birds file into the open door, doors close, and the carriage whisks
them away. Arriving at a lost bird's station — or changing lines at an
interchange — puts you **inside the station**: a full-screen
platformer cut **generated from the station's real cross-section**.
Deep-tube lines put platforms at −2, the cut-and-cover lines at −1
(King's Cross gets both; at Bank the Central and Northern really do
run at different depths, so each gets its own level, labelled with
its line); outer-zone stations are open-air platforms with a
footbridge. Lift shafts and escalator banks follow **TfL's own
per-station counts** — Hampstead is lift-only with zero escalators,
Holborn has no lifts at all, Bank runs six escalator banks and a
chained pair of lettered lifts — and one honest staircase always runs
the whole way down. You enter on foot at street level; trains arrive
and depart at the platform their line really uses; the WAY OUT is
back up at the street. Each interior you play a randomly chosen flock
member while the rest flutter along as AI buddies — the more you
rescue, the fuller the screens get. Rescued birds join for +400 and
+150 time; reach the waiting train (line changes) or the WAY OUT
(rescues, locked until the bird is found) to move on.

Each station's lifts form a little graph: shafts are **lettered A/B/C
left-to-right** with coloured plates at the shaft head, and each one
serves only its own span of levels — Bank runs a short Lift A
(street ↔ ticket hall) beside the full-depth Lift B; the modern
step-free boxes pair a full-height lift with a short street ↔
concourse one. When a lift fails it is always **one lift, never the
bank** — the rest, and the stairs, still serve. Stations are dressed
with real Underground furniture: procedural
**Lift guide** boards drawn from each station's own layout — floor
lines, escalator diagonals, each lettered lift column drawn over just
the levels it serves and crossed red when out, and
a live "you are here" dot that follows you; a dated, hand-scrawled
**Service information** whiteboard on A-frame legs whenever something
is broken (naming the out lift by letter); level tags at the left
edge of every depth (street · 0 ·
−1 · −2); blue Help Points; plus name boards with line-colour bars,
framed lino adverts, WAY OUT signage, a waiting carriage with open
doors at the departure platform, and idle bystanders. Press down
mid-air for a harmless dropping (a struck commuter stops, mystified).
The network includes the hollow-striped **Windrush line** (Rotherhithe
· Canada Water · Surrey Quays). The adversaries are ordinary
**commuters** — bland blobby coat-people, deliberately faceless and
background, but as varied as a real London platform: every age, build
and skin tone, headscarves and turbans and flat caps and silver hair,
phones, totes, coffees, canes and school backpacks. They trudge about,
ride escalators standing, and never fly.
Brushing one just flutters you gently aside — no harm done. Quest
cards read like little stories ("lonely down at the platforms",
"lost on level −2"), rescues bloom with hearts and a musical swell,
and the flock swirls boids-fashion around you, fuller every reunion.
The soundtrack builds with the flock: warm detuned pad washes and a
heartbeat at first, hats, arpeggio shimmer and finally the lead
melody fading in as intensity rises (a master lowpass opens with it;
`Chiptune.setIntensity(0..1)` / `swell()`).

Step-free access is real-ish: a curated list of genuinely step-free
stations (Canada Water to Amersham, some eighty of them) keeps all
their escalators running your way; elsewhere one escalator runs
against you — climb it at half speed, ride the right way at 1.6×,
stairs never fail. Lift outages are a **playability dial, not a news
feed**: each run sprinkles a few broken lifts (crossed box on the
map) across stations that really have lifts — never at step-free
stations, never more than one lift of a bank, purely for routing
texture. Separate hi-score.

## Implementation notes

- Plain ES modules, no dependencies: `robbin.html` + `robbin-game.js`
  (engine, levels, foley) + `robbin-sprites.js` (vector art) +
  `robbin-tube.js` (TUBE FLOCK) + `robbin-music.js` (chiptune).
- `tube-network.js` is GENERATED from the TfL Unified API by
  `tools/fetch-tube.mjs` (station chains incl. branches, projected
  coords, curated step-free list, lift-outage snapshot). Re-run the
  tool to refresh; commit the output. Cached in-repo, reproducible —
  the same pattern as `trees/`.
- Levels are 20×15 ASCII tile maps: `#` platform, `H` ladder, `+` platform
  pierced by ladder, `E` egg, `G` grain, `P` spawn, `L` lift shaft.
- Fixed-feel physics tuned to 8-bit platformer conventions: fixed jump arc with head-bump,
  no fall damage, ladder-snap climbing, enemies never jump.
- Procedural WebAudio foley (chirps — they're birds).
- `window.__robbin` is the headless-playtest hook (same convention as
  tanks-for-the-trees' `__tftt`).
