# ROBBIN 🐦 — an egg-and-ladders platformer

A single-page platformer in the grand 8-bit egg-and-ladders tradition.
Robbin the robin
raids the garden for eggs while a blackbird, blue tits and wrens patrol the
platforms (and eat the grain if you don't get there first).

**Play:** `robbin.html` · **Sprite proofs (dev):** `sprites.html`

Two episodes from the title screen: **ROBBIN: PILOT EPISODE** — the
Flight Line arcade below — and **ROBBIN: TUBULAR SMELLS** — the
flock-growing Underground journey (the most developed of the two).
The mood Tubular Smells aims for is distilled from the reception of
*Gathering Sky* — see **`MOOD.md`** for the north star and the
standing tuning principles (no fail state, music first, sparse
surface, the flock is the protagonist, the ending must land).

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

The same cutout idea steps off the page in **`robbin3d.html`** — the
robin and blue tit paths mounted as hinged paper layers in three.js
(ported from a CodePen prototype, mirrored in
`codepen-backups/pens/QwdBKbE/`): each part drawn to a transparent
canvas texture on a slightly bowed plane under its own pivot, so a
deliberately flat lino cutout catches real light, flaps, and casts
shadows. Deliberately NOT a rounded 3D bird — a toy-theatre prop.
Drag to orbit, pinch or wheel to zoom, toggle each bird / flying /
spread; an ENTER VR button appears when a headset offers immersive
VR. Self-contained: three r169 is vendored at `vendor/` (same build
as trees/), and the CDN-only OrbitControls/VRButton addons are
replaced by a pocket orbit class and a pocket XR button inline.
Linked from ⚙ SETTINGS (✂️ ROBBIN IN 3D).

The same 3D birds ARE the scene change: pressing an episode (or
replaying from PLUCKED!) sends **up to fifty cut-paper birds
sweeping across the screen, huge and close and flapping — a flock
screen-wipe** — and the new screen is swapped in under peak cover.
The bird builder is shared (`robbin-birds3d.js` feeds both
`robbin3d.html` and `robbin-wipe3d.js`), textures/materials/geometry
are cached so fifty birds cost the same GPU memory as two, three.js
is dynamically imported in the background after boot (pressing PLAY
before it lands just skips the wipe), the choreography is wall-clock
based so slow GPUs still keep the beat, the flock alternates
direction each time, and `prefers-reduced-motion` skips it entirely.
The title menu itself now holds only the two episodes and
**⚙ SETTINGS**, which gathers CONTROLS, SCORE, HAPTICS and the 3D
gallery in one place (ESC or ← BACK returns).

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
    A pure up/down tap mid-corridor is a **programmed turn**: keep
    flying, take the climb at the next stairs — and gliding into a
    lift's open doors boards it (the ride clears your heading; tap a
    direction when the doors open elsewhere to step off). Stopping is
    easy: **tap your opposite to brake dead** (tap again to set off the
    other way), or tap the **■ centre of the pad**.

## ROBBIN: TUBULAR SMELLS (TUBE FLOCK)

**The loop, in one breath:** the map names a lost bird and its
station; fly your line stop by stop toward it; **GO is the only way
inside** — swiping toward another line at an interchange *arms* the
change (the header says so in the line's colour) and GO carries it in;
arriving at the bird's station gathers the flock at the mouth and GO
drops in with the train-arrival scene. Nothing ever pulls you inside
by surprise — and if you wander in anyway, **ESC or the ⌂ MAP button
pops the flock straight back out**, no trek to the exit, nothing
lost. When the postcard is up at the lost bird's own station, **one
GO does both jobs** — it puts the card away and drops in — no double
press. The map screen carries a **⏏ QUIT chip in the same top-right
corner as the interior's ⌂ MAP chip** — one learned place for "leave
this screen". Quitting can't be undone (the journey has no save), so
it never quits outright: a LEAVE THE JOURNEY? dialog warns that the
flock, stops flown and lost things found will be gone (only the high
score stays). KEEP FLYING is the big warm default; GO and ESC also
answer "keep flying", Enter or tapping QUIT leaves. ESC on the map
goes through the same question. Station interiors rebuild fresh each
visit but the crumbs do not: grain already eaten there this journey
stays eaten, so popping out and back in farms nothing.
Inside, changes cross the station underground to the new
line's own directional door; rescues end by **surfacing** — the WAY
OUT — or by riding on from any platform. Lines that share a platform
swap trains without the trek — a real cross-platform change. Riding
straight through interchanges on your own line never drops you
inside. A short primer sits on the map until the first rescue.

**The journey has a shape:** the header always says how far along
you are (FLOCK 4/7), and **six lost birds are enough** — ROBBIN plus
six makes a family, and surfacing with the sixth wheels everyone
home to Liverpool Street in a long murmuration. A HOME TO ROOST
postcard closes the story with your own numbers (stops flown,
stations seen, lost things found, score), and then London is yours
to fly for as long as you like — twenty-two lost birds are out there
for completists, and a late rescue still earns the flight home.

A cosy, heartwarming journey — no clock, no lives, no fail state. The
main dynamic is **growing the flock**: twenty-two lost libbirds —
robins, blackbirds, blue tits and wrens, everything the four
lino-print drawings can be — are scattered across the **entire London
Underground**: all eleven lines and 271 stations, baked from TfL's
open data by `tools/fetch-tube.mjs` into `tube-network.js` (real
geography drawn in the schematic lino style, no TfL branding), plus
the hollow-striped Windrush segment. The map is a deliberate
**HYBRID of London's two famous self-portraits** — the octolinear
transit diagram and the real geography — rebuilt by
`tools/relayout-map.mjs`: stations start from their true coordinates
(cached in `data/station-geo.json`), take the classic tube-map radial
zoom (centre enlarged, suburbs gently compressed), then relax toward
the 45° grid while a geographic anchor keeps every station honest
about where it really is — relative distances survive, so Chesham
stays far and Leicester Square–Covent Garden stays a hop. **The
Thames runs through it**, a soft blue ribbon warped along with the
city and bank-checked against thirty riverside stations (Waterloo
south, Embankment north, Canary Wharf inside the Isle of Dogs
meander). Parallel lines sharing a corridor ride offset side by
side, ordinary stops wear tick marks, interchanges wear rings — the
design language of a transit map in our own lino ink, no TfL artwork. A camera glides along
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
platformer cut **generated from the station's real cross-section**,
with **TfL's own storey numbers and measured depths** on the level
tags: street is level 0 and the storeys count down exactly as TfL's
station topology feed numbers them — Hampstead's platforms at
**−4 · 59 m**, Bank's W&C & Central at −3 with the Northern at
**−5 · 30 m**, Covent Garden's lift-only depths at −6, Westminster's
Jubilee box at −5 under the District at −2; outer-zone stations are
open-air platforms clearly at ground level 0 with a +1 footbridge —
unless TfL's figures say the platforms ride a viaduct, in which case
the whole station honestly steps up (+1 · 10 m up at Greenford). Lift shafts and escalator banks follow **TfL's own
per-station counts** — Hampstead is lift-only with zero escalators,
Holborn has no lifts at all, Bank runs escalator banks over three
real lettered lifts — and one honest staircase always runs
the whole way down. **The platforms are a model of London, not of
your errand**: every platform level carries a door at each end, and
each door holds that track's real departures — the west end of the
Central platform at Liverpool Street is the westbound to Bank, the
east end the eastbound to Bethnal Green, always, whatever bird you
happen to be chasing. Board a door and you go where its track goes;
direction boards over each door name the bound (NORTHBOUND ·
LONDON BRIDGE) so learning the game map is learning London, and
vice versa. Termini keep one door; shared sub-surface platforms
share their end doors like real shared platforms, your own line's
train winning the tie. The header's NEXT line still *advises* (it
points at the door a route-planner would pick), but the doors never
bend to the quest. A change starts mid-platform on your own line's
level and crosses the station to the new line's door; the WAY OUT
is how you surface. Each interior you play a randomly chosen flock
member while the rest flutter along as AI buddies — the more you
rescue, the fuller the screens get. Rescued birds join for +400 and
+150 time; leave by any platform door (ride on by tube) or the WAY
OUT (locked until the bird is found) to move on.

Each station's lifts are **TfL's real lift graph** where the
step-free feed knows it (88 stations): `Lifts.csv` routes joined to
the feed's storey numbers give every lift its true stops, and
letters follow the on-site boards' street-first order — at Canada
Water the game generates exactly the wall's Lift guide: **A** street
↔ ticket hall, **B** the through-lift calling at the Windrush level
on its way to the Jubilee, **C** the short hop to the Windrush level
only. Every shaft runs **one glass box of a car** that cycles its
stops — doors slide at each landing, and you always know who's
aboard because riders show as **colour-cycling X-ray skeletons
through the glass** (your bird included). The landing floor runs in
front of the doors, so you can always walk PAST a lift — boarding
is deliberate: stand at the open doors and press **up** (the game
coaches you: "↑ board"); step off with a direction when the doors
open where you want.
**Escalators are sloped now**, 45° (steeper where the hall is tight,
as real ones are), zigzagging down the section with gliding treads —
step onto **either end** and it takes you to the other (with the
treads is a glide, against them a determined trudge); hop off with a
jump. And lifts **come when called**: stand by any closed doors a
beat and the car cuts its loitering short and comes straight to you,
amber call light lit — open doors are even held a moment while you
stand at them.
When a lift fails it is always **one lift, never the bank** — its
car parks dead and dark mid-shaft — and the stairs still serve.
A **station clock** ticks ten times faster than reality, always
daytime (past nine at night it snaps to half six the next morning):
the rat race spins, commuters hurry visibly at rush hour, and the
HUD wears the clock face. Stations are dressed
with real Underground furniture: procedural
a **Lift guide** board drawn from the station's own layout (one per
station, on a circulation floor — never over a platform) — floor
lines, escalator diagonals, each lettered lift column drawn over just
the levels it serves and crossed red when out, and
a live "you are here" dot that follows you; a dated, hand-scrawled
**Service information** whiteboard on A-frame legs whenever something
is broken (naming the out lift by letter); level tags at the left
edge of every depth (0 · street, −1, −2, −3); blue Help Points; plus name boards with line-colour bars,
**and the world visibly ends**: the camera leans a little past each
wall to show a slab of London clay (open-air stations get a stout
brick wall), seeded per station with one cosily-drawn, resolutely
unplayable buried wonder — great bones, a mammoth skull with a
dent-nosed saucer lodged in it, a longship, a curious chevroned ring
that never lights, a lost underground river, an ammonite —
framed lino adverts, WAY OUT signage, a waiting carriage with open
doors at the departure platform, and idle bystanders. Press down
mid-air for a harmless dropping (a struck commuter stops, mystified).
The network includes the hollow-striped **Windrush line** (Rotherhithe
· Canada Water · Surrey Quays). And not every line is a pair of
tracks running in opposite directions: one-way stretches — the
Heathrow Terminal 4 loop only ever runs one way round — are one-way
in the game too, marked with a little arrow on the map. The adversaries are ordinary
**commuters** — bland blobby coat-people, deliberately faceless and
background, but as varied as a real London platform: every age, build
and skin tone, headscarves and turbans and flat caps and silver hair,
phones, totes, coffees, canes and school backpacks. They trudge
about, ride escalators standing, and never fly. And some of the
crowd moves through a harder station than the rest: commuters **with
walking sticks, wheeled cases, prams and wheelchairs** walk slower,
steady themselves before stepping onto an escalator — and the prams
and wheelchairs can't do steps or escalators at all, so they make
for the lift, stand patiently by the doors, and ride; you'll see
their skeletons glide past behind the glass. The station serves
everyone or it doesn't really serve anyone.
Brushing one just flutters you gently aside — no harm done. Quest
cards read like little stories ("lonely down at the platforms",
"lost on level −2"). Arriving at a storied station raises a
**full-screen DID YOU KNOW postcard** — the station name unmissable,
every line's exact colour swatch and hex code beside it, and one true
thing about the place in big readable type; the world holds still
until you dismiss it (tap, JUMP, Enter or Esc). Rescues bloom with
hearts and a musical swell,
and the flock swirls boids-fashion around you, fuller every reunion.
**Some stations hide a lost thing** — a glove, an umbrella, a teddy
bear, a scarf, a library book, a toy train — roughly one station in
three, seeded like everything else, glinting quietly on some floor
with a soft twinkle (static under reduced motion). Brush it and it's
found: +250, a word from the announcer, and the HOME TO ROOST card
counts your lost-property record. The station narration tips you off
("Lost property: somebody dropped a teddy bear on −1 · ticket
hall"). Never required, always worth the detour.
Tubular Smells' score comes in two forms, toggled from the menu
(SCORE: TAPE / MIDI). **TAPE (the default) is the recordings
themselves**, decoded into buffers, looped and crossfaded by mood.
The files are lean 64 kbps MP3s (~6.8 MB the set) and each is only
fetched when its mood first plays — but decoded PCM is ~0.38 MB/s,
so at most TWO tracks stay decoded at once (LRU; the compressed
bytes are kept and simply re-decoded after an eviction — never
re-downloaded). A `MONO_DOWNMIX` switch in `robbin-music.js` can
halve that again; it ships OFF to keep the recordings as made.
The tapes RESUME: each track remembers where it stood when it faded
out and fades back up from there — returning to the map never rewinds
THE QUIET ENGINES to the top, and every reel loops.
The library grows: `audio/per-station/` holds a station's OWN song
(played inside it two visits in three — the third takes a generic
turn, against monotony) and `audio/generic/` the interior rotation
for everywhere else — GEARS AND BIRDCALLS lives there too, one of
the crowd. Drop files in and run
`tools/ingest-audio.mjs` — it hashes against `audio/HASHES.sha256`
(duplicates reported and skipped, never deleted), maps filenames to
real stations (area-name aliases live in the tool), and regenerates
`robbin-tracks.js`. A broken library track just falls out of
rotation with another generic covering; only a broken CORE track
(map / finale) hands tape mode to the MIDI band. See
`audio/README.md`.
And — quietly, in the corner of ⚙ SETTINGS, behind a small 🐣 —
**ROBBAMP · BURIED FREQUENCIES** (`robbin-amp.js`), a Winamp-classic
tribute jukebox for every track in the library: striped title bar, green LCD
marquee, transport + seek + volume, playlist, lock-screen metadata.
It streams through an `<audio>` element (no decoded-PCM cost) into
the Soundtrack's bus so the master mute rules it, and its visualizer
is an archaeology dig: the earth-edge buried wonders — bones,
mammoth-and-saucer, longship, ring, ammonite, the ptero-cyclist,
the lost river — reused straight off the game's own drawing code,
pulsing with the bass and flashing Jet-Set-Willy colours on the hot
hits, under a spectrum fence of little bones, with a skeleton bird
keeping time and a live one flitting across on treble peaks
(reduced motion: static ivory, no flights). ESC buries it again.
**MIDI is a live, parameterized performance**: `tools/analyze-tracks.mjs` listened to the three
recordings with WebAudio (onset autocorrelation for tempo, per-bar
chroma vs triad templates for harmony, chroma self-similarity for
loop length, RMS for the energy arc) and baked what it heard into
`robbin-score.js` — THE QUIET ENGINES as an 83 BPM E-minor wash
with engine-chuff breaths, GEARS AND BIRDCALLS as 102 BPM G-minor
clockwork arps with offbeat birdcalls, THE INEXORABLE PASSACAGLIA
as a 140 BPM D-minor **twelve-bar ground bass that stacks a new
layer every time it comes round**. Because it's performed live it
loops to the bar, movements swap at bar lines, intensity layers
grow with the flock, rescue swells bloom it, and it leans ~12%
faster in rush hour. Either way the mute
button rules everything, and if the tape can't load the MIDI score
takes the stage (offline never silences the game). The Flight Line
arcade stays the original chiptune's own show: warm detuned pad washes
and a heartbeat at first, hats, arpeggio shimmer and finally the
lead melody fading in as intensity rises (a master lowpass opens
with it; `Chiptune.setIntensity(0..1)` / `swell()`).

Outages are a **playability dial, not a news feed**: each run, one
facility in ten — per lift shaft, per escalator run, rolled once per
run — is out of order (step-free stations keep their lifts honest;
stations with a dead lift wear a crossed box on the map, shown near
you). A broken thing doesn't just sit there: every four to eight
seconds it **glitches** for a third of a second — flipping upside
down, or rolling through every colour it owns like a Jet Set Willy
treasure — and it rebuffs all touch: brush it and it yanks the whole
flock in, holds them while the jiggle and the feather-flap ramp up,
then hurls everybody back out into the station. Harmless, indignant,
memorable. Stairs never fail, so every station stays climbable.
Separate hi-score.

## Accessibility

- **Screen-reader narration** via a polite `aria-live` region: the
  map narrates every station on arrival (each line's direction and
  next stop by compass, how many stops to the waiting bird, lift
  outages); interiors announce their levels, broken facilities and
  exits on entry, then each level as you land on it, plus rescues,
  boardings, surfacings and glitch-grabs. The Pilot announces
  screens, deaths, clears and game over. TUBULAR SMELLS — turn-based
  map navigation, no clock, no fail state — is genuinely playable
  this way; the interiors are navigable with patience; the arcade
  Pilot remains reflex-driven and is narrated but not equivalent.
- **Keyboard-complete**: everything is reachable and playable with
  arrows, space, Enter, Escape, P and M; controls are native buttons
  with labels.
- **`prefers-reduced-motion`** swaps the glitch strobe for a calm
  static cross and the flock-grab shake for a firm set-down.
- **Haptics** (per XAG 110 and the Game Accessibility Guidelines:
  always toggleable, never the sole channel): accepted map hops,
  heading changes and pad taps tick; station entries, boardings and
  deaths thud; reunions and the finale play a little chord; the
  glitch-grab buzzes. Standard Vibration API where it exists
  (Android); on iOS — which has no vibration API — a rendered-but-
  imperceptible `switch` checkbox provides the system tick from
  Safari 18 (created at boot, never sr-only-clipped: WebKit stays
  silent for both). Device detection keys off Apple + touchscreen,
  because modern iPads claim to be "Macintosh" with no Mobile token
  — the original detection missed them entirely, which is why
  haptics "never worked" for a long while. Honest limits: WebKit
  only grants the tick during a real user gesture, so input-time
  buzzes (taps, swipes, GO) work on iOS but event-time ones
  (rescues mid-flight) stay silent there; and in-app browsers
  (WKWebView — e.g. links opened inside chat apps) provide no
  haptics at all — open the game in Safari proper. HAPTICS ON/OFF
  on the title screen (shown only on capable devices; toggling ON
  fires a confirmation tick you should FEEL — if you don't, your
  browser can't), default off under `prefers-reduced-motion`, and
  every haptic moment also has audio and visuals.
- The credits keep a visually-hidden text list behind the canvas
  roll; touch targets are ≥44px; colour is never the only signal
  (lift letters, crossed boxes, text labels throughout).

## Implementation notes

- Plain ES modules, no dependencies: `robbin.html` + `robbin-game.js`
  (engine, levels, foley) + `robbin-sprites.js` (vector art) +
  `robbin-tube.js` (TUBE FLOCK) + `robbin-music.js` (chiptune).
- `tube-network.js` is GENERATED from the TfL Unified API by
  `tools/fetch-tube.mjs` (station chains incl. branches, projected
  coords, curated step-free list, lift-outage snapshot). Re-run the
  tool to refresh; commit the output. Cached in-repo, reproducible —
  the same pattern as `trees/`.
- What the open data says (all of it now ingested): **per-direction
  service is real** — the platform doors' departures come from TfL's
  per-direction route sequences (also how the one-way Heathrow T4 loop
  is known), and lift/escalator counts are TfL's own. **Per-platform
  depth and storey numbers are real too**, from two further sources
  baked by `tools/ingest-levels.mjs` into `tube-levels.js`:
  - `data/station-depths-foi-0493-2223.csv` — TfL FOI-0493-2223, per
    station and line, ground level and platform levels referred to
    London Underground Datum (100 m below Ordnance Datum, per the
    file's own notes): Hampstead 58.5 m down, Bank's Northern 29.6 m,
    Greenford 10 m **up** on its viaduct.
  - `data/tfl-stationdata/` — TfL's step-free station topology feed
    (`tfl-stationdata-detailed.zip`): every area of every station
    carries TfL's own storey number (street 0, down negative), with
    lines decodable from area names (CenEB −3, NorSB −5 at Bank;
    Epping's footbridge is literally +1 in the feed).
  Where both sources are silent (a handful of stations), the level
  assignment falls back to a principled synthesis from line types and
  fare zone; measured depths also override the line-type guess, so
  embankment stations like East Acton read +2, not −2.
- Levels are 20×15 ASCII tile maps: `#` platform, `H` ladder, `+` platform
  pierced by ladder, `E` egg, `G` grain, `P` spawn, `L` lift shaft.
- Fixed-feel physics tuned to 8-bit platformer conventions: fixed jump arc with head-bump,
  no fall damage, ladder-snap climbing, enemies never jump.
- Procedural WebAudio foley (chirps — they're birds).
- `window.__robbin` is the headless-playtest hook (same convention as
  tanks-for-the-trees' `__tftt`).
