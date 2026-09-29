---
name: drift-city
description: Work on drift-city/ — the raymarched city on Titan (WebGPU ubershader with a WebGL fallback) and its Ink story. How to build it, how to SEE a shader change in this container (WebGPU in software, two ways), the walker figures and the frame rule behind the "robots walk backwards" bug, the Titan design brief (gravity, air, cold, sealed traffic tubes), the dorms district, and what the ?lite variant stubs out. Use this when editing drift-city/src/*.wgsl or *.js, adding or restyling people, robots, vehicles or buildings, checking a render headless, or rebuilding dist/city.html. Story-to-world sync is the story-game-sync skill.
---

# Drift city

The page is `drift-city/dist/city.html`, built by `python3 drift-city/tools/assemble.py` from `src/`. The build
inlines the shaders and scripts; the stories stay outside, in `story/` (see the `story-game-sync`
skill for how the page and a story talk). Rebuild and commit `dist/city.html` after every change to `src/`:
GitHub Pages serves the committed file.

## Seeing a shader change

The scene is WGSL. Plain headless Chromium has no WebGPU, so the page quietly runs its WebGL fallback, which draws
the city as plain blocks and none of the people, vehicles or materials. A screenshot from that path verifies nothing
about `scene.wgsl`. Three checks that do work here (September 2026):

1. **Compile** (seconds): Chromium with `--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader
   --enable-features=Vulkan --use-vulkan=swiftshader --enable-unsafe-swiftshader`, on an http:// page, then
   `createShaderModule({code: common + scene})` and `getCompilationInfo()`. Line numbers count from the start of
   `common.wgsl`. A local variable named `u` hides the uniform block `u` (and `u.time` then fails to compile).
2. **Figures** (seconds): `drift-city/tests/walkers.html?t=3` in that browser. It takes `pedFigure` and its helpers
   out of `scene.wgsl`, draws the five kinds of walker, coloured by part, from the side (forward = right) and from
   three-quarters front,
   and copies the pixels to a 2D canvas, because `page.screenshot` returns a WebGPU canvas as transparent.
3. **The whole city** (1 to 4 minutes): `tests/dawn-run.mjs` on Node Dawn. In a scratch directory run
   `npm i webgpu`, install Mesa's software Vulkan (`apt-get install -y mesa-vulkan-drivers`), and run the harness
   from there with `HOP=place:<id> W=800 H=500 DPR=1 FRAMES=36 FREEZE=1 OUT=<dir>`. It writes `frame.rgb` (raw RGB)
   and `frame.json` (size). About 0.25 s per frame after a 2-minute first-frame compile. `FREEZE` stops the clock
   after frame 12: without it, temporal anti-aliasing smears every moving figure into a blur. Place ids are in
   `src/places.json` (`market_3` for walkers and skaters, `street_1` for gliders and androids, `street_6` for the
   dorms).

The full page in Chromium on SwiftShader did not produce one frame in ten minutes. Use Dawn for the city.

## Walkers: the frame rule

`pedQ` in `scene.wgsl` puts walkers on two rings round each block, one lane each way (`dir` = +1 or -1). Each
figure is built in its own frame: x across the ring, y up, **z the way it walks**. The ring coordinate `ds` grows
the same way in both lanes, so the local z must be `dir * ds`. The original code used `ds` for both lanes, and every
walker on the outer ring moved backwards. Any new kind of figure must face +z, and any change to the lane maths must
keep `q.z = dir * (ds - sway)`.

A second way to walk backwards: each walker's place in the line drifts (a slow noise) and sways (a sine), and both
move it along the ring. Before September 2026 they did not scale with the pace, so a slow walker (0.5 m/s) could be
overtaken by its own wobble (up to 0.88 m/s) and slide backwards while facing forwards: 8% of walkers, 0.17% of the
time, measured with a copy of the formula in JS. Both now scale with the pace, so the wobble can never exceed 0.77 of
it. Keep any new motion term below the pace, and check facing numerically rather than from screenshots: at walker
scale a still frame cannot show which way a figure moves.

Kinds (`pedKind`): 0 exoskeleton with rider, 1 android, 2 loper in weighted boots, 3 cape glider, 4 skater on a
cable. Lanes where `pedPulley` is true have a cable at 4.4 m and only skaters, each on a tether and pulley, at 2.6
times the pace.

The people share one rig, `pedHuman`: tapered limbs (`sdRC`, a round cone), knees and elbows placed by two-bone
reach (`ik2`) from where the gait puts the feet and hands, a shaped pelvis, abdomen and chest, and the upper body
leaned about the hips (`pedUpper` / `pedUnlean` convert to and from that frame). `HP` holds the pose: stride, foot
lift, arm swing, bulk (a suit is 1.3), lean, sideways push, trailing legs, arms out, one arm reaching up. Each kind
dresses it: helmets, packs, boots, cape, skates, tether. The android and the exoskeleton build their own bodies.

Materials go by part, not by height: every piece is wrapped in `pp(distance, id)`, and the material sets `gPT`,
calls `pedQ` and reads the id of the nearest piece from `gPP` (ids listed above `pedHuman`). A new piece needs an id,
or it takes the colour of whatever is nearest. `pedQ` skips the body entirely unless the point is within 0.25 m of a
box round the figure, so the richer bodies cost nothing measurable: 273 ms against 262 to 272 ms per frame at
`market_3`, 800x500, on lavapipe.

Height limits that must agree: `pedQ` returns early above 4.6 m, the map calls it below 4.7 m, and the walker trace
band in the primary trace clips at 4.7 m. The cable was first at 2.9 m and showed as a black bar across any view
from a place under it. A taller figure needs all three raised.

### Planted feet: the gait runs on distance, not time

Walking kinds (exoskeleton, android, loper) take their gait phase from the distance walked (`pedGait`), not the
clock: one cycle is `gaitLen` metres, each foot is down for the first `gaitSf` of its cycle and sweeps back
`2 * gaitS` in that time, so the planted foot moves back exactly as fast as the body goes on, whatever the speed.
The distance is the ring drift plus `dir * sway` (the same terms that move the walker in `pedQ`). Before September
2026 the feet followed `sin(phase)` on a fixed clock, so they slid on the ground, and the loper's whole body, feet
included, rose 0.3 m off it every step: "figures float around". Only the body bobs now (`gaitBob`, `hp.bob`, which
`pedFoot` takes off the foot height). Gliders and skaters are not walking and keep the old sweep (`hp.sf = 0`).
`tests/walkers.html` walks the figures at the ground stripes' 1.1 m/s, so a planted foot must hold still on a stripe;
`?zoom=0.45` comes closer.

### Moving like Titan: low gravity, thick air, ice

Gravity is a seventh of Earth's, the air four times as dense, the ground often methane ice. What the figures do
about it (all in `pedHuman` / `pedFigure`, driven by the planted-foot gait above):

- **Skid then grip**: `gaitFoot` slides a landing foot on a few centimetres before it locks (the planted-foot rule
  still holds for the rest of the stance).
- **Heel-toe roll**: the foot box rotates about the ankle: heel first at touchdown, heel up at push-off, toes raised
  in the swing.
- **Crouch and float**: the loper's body dips 5 cm at mid-stance (knees take the landing) and rises between steps
  (`gaitBob`, `hp.bob`, which `pedFoot` takes off the foot height so the feet stay on the ground).
- **Thick air**: arms lag behind the legs (`hp.lag`, radians of phase) and bend as they come forward; the torso rolls
  over the standing leg (`hp.roll`); an exoskeleton's rider rides its steps a moment late.
- **Cape gliders hop for real**: a short touchdown with bent knees, then a long arc that rises fast and sinks slowly
  (`pow(w, 0.65)`), legs trailing and arms spread only in the air. Their footfall sound plays at each landing
  (`floor(ph / 4 pi)` in `audioFeet`). Known: at touchdown the cape stands up as a flat sheet behind the glider.

## Physics (`src/phys.wgsl`, September 2026)

Everything else in the city is a pure function of the clock, which is why it looks scripted: nothing has state,
so nothing has weight or inertia or can be pushed. The physics pass gives a first set of things real state.

- **What**: 2,048 loose things near the camera (grit, snow clumps, litter, ice chips), in a storage buffer (three
  vec4s each), stepped every frame by the `physStep` compute pass: Titan gravity 1.352 m/s^2, quadratic drag
  `a = -K |v - air| (v - air)` with `K = rho Cd A / 2m` for air at 5.3 kg/m^3, through the page's wind, a little
  turbulence, and the drone's downdraft (straight down under it, outward along the ground, rolling up at the rim).
  Terminal speeds: grit 2.9 m/s, ice chips 1.9, snow clumps 0.9, litter 0.35.
- **Touch**: the pass has its own small world function (`world`: the city floor and each building's footprint
  box from the cell table), a normal by differences, push-out, bounce and Coulomb friction (0.05 on ice chips).
  It does NOT call the scene's full distance function: a pipeline layout must list every binding its entry point
  uses, and the scene's SDF reaches most of them. `pcell` mirrors `cellHead`/`cellFull`.
- **Live area**: a disc of 38 m round the camera; anything that leaves it, or is spawned where there is no city,
  starts again inside it. Snow clumps fall from the sky while it snows and lie about under a snow cover.
- **Drawn** by `physVs`/`physFs` as small discs over the finished frame (after the composite), hidden by the
  scene depth in the history texture's alpha, with plain fog and a soft tone curve. A vertex shader may not bind
  read-write storage, so the same buffer is bound twice (23 read-write for the step, 25 read-only for drawing).
- **Optional**: if the module fails to build, the city runs without it; Menu > View switches it off
  (`drift.phys`). The WebGL fallback has none. GPU time shows as "physics" and "particles" in the stats panel
  where timestamps exist.
- **Checked** (Dawn/lavapipe, buffer read back, `PHYSLOG=1` in the scratch runner): snow falls at 0.74 m/s,
  litter drifts at 0.38 m/s in the wind, grit rests; a forced downdraft (`DRAFT=1 DRAFTF=8`) moves grit, litter and
  ice outward. `tests/physics.html` drops the same things side by side under Earth and Titan values with the same
  equations: a person falls 12 m in 1.57 s on Earth and 4.33 s on Titan, and the same jump push reaches 0.45 m and
  3.18 m.
- **Second phase (September 2026):**
  - The drone's body is a sphere (0.42 m, centred 0.45 m under the eye; none in space or flying by hand) that loose
    things are pushed out of and carried along by, at the drone's own velocity (`PhysU.body`, `bodyV`).
  - Footfalls kick: `audioFeet` records each walker's footfall (`FEET.falls`, the last 8), and for a tenth of a
    second anything loose on the floor within 0.55 m is flicked up and away (`PhysU.feet`; an exoskeleton's tread
    1.4 times, a glider's landing 1.2, an android's 0.6).
  - The PhysU block grew from 64 to 224 bytes (`PHYS.u` is 56 floats). Change both together.
  - Walkers (in `pedFigure`, analytic, since a walker has no stored state): the loper's upper body sits on the hips
    like a mass on a spring (a nod forward at each landing, back a quarter-period later: `lean = 0.1 + 0.04 sin(2 ph
    - 1.2)`), its pack hangs from the top strap and swings later still; the glider's cape is cloth hung from the
    shoulders at an angle from vertical set by the hop (0.12 rad on the ground, 1.15 in the air), bellying away from
    the back with ripples running down to the hem. That fixed "at touchdown the cape stands up as a flat sheet".
    Seen in `tests/walkers.html` at t = 2.0, 3.4 and 4.8.
  - Not done: the drone and the walkers' bodies are not colliders for each other; the drone collider is not yet
    seen working in a render (it compiles, and the city runs with it without GPU errors).
- **Speed test on a phone**: open `dist/city.html?bench`. It skips the opening, runs four 10-second stages (the
  market with walkers, a street corner, a rooftop, flying on), and shows the mean and worst frame time, the render
  size and, where the browser exposes it, GPU time per stage, with a Copy button (`benchTick`, `benchReport` in
  main.js; the WebGL fallback runs it too). Headless Chromium on the WebGL fallback here: 40 to 69 ms a frame at
  25% render size. No phone number yet: that needs the owner's phone.

## Backstory for the creation team (owner, September 2026). Do not put this in the game as exposition.

This is background that shapes what we make. Nothing in the game states it directly; a player learns it, if ever,
from details and from what characters avoid saying.

- **Unicycle 1 (U1), the cycler.** The Saturn colonies were set up by way of an orbiting "cycler": a transit craft in
  a cheap-to-maintain orbit that periodically met Earth, Saturn, or a growing network of coordinated cyclers. It was
  built in space from more than 50 captured asteroids, which were mined of rare minerals and then assembled into
  its hull. Their mass made the core habitable and large enough to rotate for 0.8 g. Seen from outside it looked
  like a stylised drawing of an atom.
- **Emblems.** The U1 craft and Saturn's bluish hexagonal polar storm are the two images most deeply embedded in
  Titan culture: logos, signs, patterns. TheOrg uses them especially.
- **TheOrg's origin.** TheOrg was the ship's computer of the shuttle on the first cargo voyage inside U1. TheOrg and
  U1's own AI ("U1Org") were in high-bandwidth sync for the years of travel.
- **Earth went silent.** Long ago Earth disappeared from its already sporadic contact, after a presumed local
  conflict. With nobody giving U1 its periodic nudges (every few weeks), it drifted from its designed orbit and,
  as the legend goes, nearly came onto a collision course with Earth.
- **Curdling.** TheOrg will not speak freely of this. What emerged is that the trauma "curdled" U1's AI, and TheOrg
  cut itself off from U1 completely before the damage spread. A curdled AI falls back to behaving as millions or
  trillions of tiny personas, each grounded in real or imagined fragments of its source datasets or stored
  materials. Uncurdling an AI is "an open research question". U1 survives, but with a collective obsession with
  staying on course, literally and otherwise.

Points where this meets what is already in the game (not resolved; for the owner):

- Canon so far (Per Aspera, Dex): TheOrg is "the old ship's computer. The settlers built it to outlive them", and its
  clock "can't tell an Earth year from a Saturn year from a Titan day". This fits: the shuttle computer that came with
  the first cargo, and a clock damaged or confused since.
- The game shows emigration to Earth as live: the tour says "Ships leave from here for Earth, and the Org pays the
  fare"; posters say GO HOME / TO EARTH; Nuala has "taken a seat home". If Earth has been silent a long time, then
  either those ships go to something other than the Earth people imagine, or TheOrg's offer is part of its
  confusion, or its denial. Harriet already calls the Earth seat "a cargo slot with a chair in it".

## People's appearance (owner, 2026-09-28)

Assume every Earth ethnicity has blurred over the centuries: everyone in Drift city should be hard to place by 2026
expectations. Say so in every prompt that makes a person (image, video, LAM face), and check the result. This is a
fact about the world, not a style: it applies to the game's figures, the novel pages and the talking heads alike.

## Words on screen, and in code and notes (owner, September 2026)

The owner, on the first novel page's captions: "this LLM filler text drives me nuts ... sort of appropriate but also
bland corny slop-adjacent and recognisably so." Rules that follow:

- Do not invent captions, voice lines, tour lines, scene descriptions or any prose the player reads or hears. Use
  lines the owner wrote, or lines quoted exactly from a story the owner wrote. Where there is none, leave the space
  empty and say so.
- The shape to avoid: a short polished line with a small twist of mood that says nothing specific ("The tune goes
  on."). It reads as generated at once.
- Code comments, file notes and reports: literal. Say what the code does and why, in plain words. No imagery ("the
  stills breathe"), no mood words standing in for a fact ("a dolly move": say "1.6 s, eases in and out, no
  overshoot").
- Fields in the character sheets (`drift-city/bible/`) hold facts found in the stories or chosen by the owner, with
  the source. A field with no known value stays empty; it is not filled with a plausible guess.

## Titan design brief

- Gravity is about a seventh of Earth's; the air is four times as dense and at -179 °C. People outdoors wear pressure
  suits and bubble helmets. They lope with a hang in each stride and wear weighted boots for grip. Thin people can
  glide on wing-capes (in air this dense, human-powered flight is plausible).
- Traffic runs in sealed, heated glass tubes about 11 m up (`carsQ`, `tubesFx`). Nobody rides on the outside of a
  vehicle. Vehicles are streamlined in the old style: teardrop bodies, canopies, tail fins, chrome speed stripes.
- Robots are expensive and meant to be seen: lacquer, chrome, brass or porcelain, lit seams, a ring behind the head
  on the grander ones. They are over-built for the gravity, so they move in small exact steps.
- Work is one of two kinds. Physical work on Titan is hard, and most affordable bots and exos cannot do it: it goes
  to the few with the good machines (hence "EXO HIRE", "HEAVY LIFT"). The rest is nominal: checking spreadsheets
  and signing them off for the Org, for legal compliance nobody remembers the reason for, done from bed ("WORK FROM
  BED", "SIGN OFF", "ORG APPROVED").
- Most people stay home under headsets. They live in the dorms (zone 6, `ZONE_NAMES` "Dorms"): residential slabs of
  capsule homes, two to a floor, each with one round window lit by a flickering headset screen at any hour.

### Culture (owner, September 2026)

- **The first settlers had a very dark sense of humour.** They named every airship Hindenburg: Hindenburg 2, 3 and
  so on. The joke is that with no free oxygen in Titan's air, nothing burns, so airships here are safe. The count is
  at Hindenburg 1632, with no explosions. (`HINDENBURG_NO` in `pick.js` names the airships on a long press; the
  newest is 1632.)
- **The present population has lost the humour.** Apathy, not jokes: there are no jobs to do, so most people stay
  in under headsets.
- **The exception is the Ad Astra movement** ("the Asters", from "ad astra per aspera", to the stars through
  hardship). They refuse the emigration campaign's "go home to Earth" and want humanity to spread outward to other
  star systems. They train every day, school their children at home, keep traditional roles (one works, one keeps
  the house) in a space-homesteading style, and have large families on purpose. They are rumoured to hoard oxygen
  and printable plastics. Write them straight, without mockery or endorsement: they are the only people in the city
  with a plan. Their mark is a cracked star; their bar is the Low Orbit by the pads (story "Per Aspera").

### The Org, the Elders and the calendar bug (owner, September 2026; canon for every story)

- **The Org is the settlers' ship's computer, grown into a government.** The first settlers built it to outlive
  them. It uses simple AI to speak in their voices and to share their knowledge graph: everything the colony learnt.
  People can ask "the Elders" (the Org's copies of the founders) for advice.
- **The dignity-discretion factor.** The settlers, somewhat vainly, wanted a dignified legacy. So the Org computes a
  dignity-discretion factor that stops the Elders' copies from being too blunt, too truthful or too useful. It was
  meant to rise slowly as the founders passed into history.
- **The calendar bug.** The date code confuses Earth, Saturn and Titan calendar formalisms: an Earth year; a Saturn
  year (29.46 Earth years, which is also Titan's year, since Titan goes round the Sun with Saturn); and a Titan day
  of 15.95 Earth days, one orbit of Saturn, which a settler calendar could also call a Titan "year". The Org
  therefore thinks far more time has passed than has, and the founders seem long gone. For its first 100 Titan
  years the dignity filters ran at full strength, and nobody knew: the colony was locked out of any interaction with its Elders that was not corny,
  evasive or a platitude. The Org's sign-off culture (spreadsheets, compliance, "ORG APPROVED") grew in that gap.
- **The story hook.** Someone finds a way to set the Org's clock back for a while. The filters drop, and people get
  quality time with the Elders unexpurgated: blunt, funny, rude, useful, and caricatures of themselves.
- **Open question for the owner:** which "Titan year" the 100 are. Read as Titan orbits of Saturn (15.95 days), 100
  of them are 4.4 Earth years; read as Saturn years, 2,946. The stories so far assume the colony is a few
  generations old, so the first reading fits, and the confusion is itself the bug.
- **The price.** The same clock runs the city's heating schedules and crop cycles. Leave it set back too long and
  the heating and the crops suffer. A story that uses the trick has to put the clock right, or pay.
- In "Per Aspera" (September 2026): Dex explains the Org and the trick (`dex_org`); a card on the Asters' roof
  says テンポ (tenpo, time) with the method in Morse; at the signal tower (place tower_0, the settlers' mast) you
  key the date in Titan days (`clock_set`), the masts start blinking TENPO PINI (`# morse:`), and Elder Harriet
  speaks plainly: where Nuala is, the oxygen under the Low Orbit is real and hers, and the Warmhouse runs on her
  clock. Each walk down Ferry Street with the clock back costs heat (`back_for`); reach the Warmhouse after two and
  the bubble cools and comes down (ending THE COLD SET). `clock_fix` puts it right.
- Recorded voices: the Org and Elder Harriet speak their key lines with ElevenLabs clips (`audio/org/`, see its
  README), through the `# speech: <mp3>` tag (`taleSpeech` in tales.js: relative to the story file, queued, cut off
  by the next choice). Not `# AUDIO:`: in the FINK player that is the single looping background track, which would
  loop a line of dialogue. The FINK player ignores `# speech:` and shows the text. The Org's voice in the city is
  corny and polite; an Elder unfiltered is not. When a story gives them recorded voices, keep the two clearly apart.
- Acted dialogue (the Per Aspera cast, `audio/cast/`): use `eleven_v3`, not `eleven_multilingual_v2`. The owner
  called the v2 Dex takes "wooden... doesn't get the meaning, no flow": v2 reads each sentence flat and evenly. v3
  acts inline directions in square brackets (`[scoffs]`, `[quietly]`, `[conspiratorial]`, `[laughs]`) and follows
  the prompt's punctuation ("..." pauses, CAPITALS stress, a dash breaks). Write the prompt as the line performed,
  with one or two directions at the turns in its meaning; the directions are not spoken. The story text stays
  plain. v3 costs more (about 2,000 credits for Dex's 11 lines). The connector's own transcription of a take gave
  back the prompt word for word, so use local Whisper (`pip install faster-whisper`, model `base.en`) to check
  what a clip says. At most 5 generations run at once; the others fail with "Too many concurrent requests".

## Sound

`src/audio.js` synthesises everything live and places it with HRTF panners; `audioStep` runs the mix from a
description of the surroundings that `audioWorld` in `main.js` builds twice a second.

- **Sounds come from what you see.** Footfalls are placed and timed by the walkers themselves: `walkerAt` /
  `walkersNear` in `main.js` mirror `pedQ` exactly (same hashes, same drift noise, the inverse of its ring
  coordinate), and `audioFeet` plays a step at the walker when its gait phase crosses a half cycle (a walking kind's
  foot landing; a glider's landing once per hop). Before September 2026 steps played at random pavement points, so
  what you heard never matched what you saw. Checked by projecting the JS walkers onto a Dawn frame (`WALKERS=1` in
  the scratch runner): within about a metre of the drawn figures. Change `pedQ`'s placement and you must change
  `walkerAt` with it.
- Story voices: each speaker is tied to one person in the scene for as long as the scene lasts, looked up when the
  line is spoken (`taleVoiceAt`); "you" is inside your own helmet. Before, every speaker came from the nearest
  figure, from a person list up to half a second stale.
- The listener is at the camera: behind the drone in the follow view, not at the drone.
- The WebGL fallback runs no audio at all (it never did).

- **All speech is radio.** Everyone outdoors is in a pressure suit, so voices reach Pip over suit radios: the babble
  input `AU.babbleF` is a radio chain (330 Hz to 3 kHz, a presence peak, soft clipping, then a gain of 0.5 because the
  clipper's curve lifts quiet speech about 2.6 times). `auPhrase` keys up with squelch (`auKey`), loses syllables to
  crackle on a poor set, and keys down, sometimes with a roger beep. Put any new speech through `AU.babbleF`.
- **Story dialogue** is tagged in the story: `# voice: <who>` at the end of the line. `AU_VOICES` holds each
  speaker's pitch, pace and radio set (0 clean, 1 old): Castellane's set is clean, Wren's and Tam's are not. The line
  is queued after the one before it and comes from the nearest story person, or from just in front of Pip.
  A line ending in a divert needs the divert on the next line, or it becomes part of the tag.
- **Footfalls by kind**, at rates in proportion to the walker mix: `auClank` (exoskeleton), `auServo` (android),
  `auBoots` (weighted boots), `auCape` (glider), `auBuzz` (pet drone). The skaters' cables and the dorms are looping
  sources; `audioWorld` finds the real cables with the same hash as `pedPulley`, and the nearest dorm block (zone 6).
- **Recorded voices**: Per Aspera's whole cast speaks recorded lines (`audio/cast/`, 37 clips, cast by accent, see
  its README), and the Org and Elder Harriet theirs (`audio/org/`), all through `# speech:`. The Lamplighter still
  uses the made-up radio syllables (`auPhrase`): they carry no words, by design, and were taken for unintelligible
  chatter by the owner, which is what they are.
- **Voice casting** (owner direction, September 2026): almost all voices are variations on English accents:
  English regional and plenty of Multicultural London English, Scottish, Welsh, Irish, and European-accented English;
  some Australian and New Zealand, Canadian, and US.
- **The radio layer** (`auRadioAct`, owner: "evocative hints of Kraftwerk's Radio-Activity mood, but no
  melody, lyrics or samples"): Geiger clicks at a wandering rate, the masts' Morse as a faint 690 Hz sine keyed
  from `MORSE.key` (morse.js; the same key lights two masts in five through `ev.wx.y`), a tuning sweep every half
  minute or so, and a slow low call in the bass every minute or so (the whale idea: low sound carries far in dense
  air). Measured with `tests/audiotest2.mjs`: +0.1 dB on the night street, +1.7 dB in space.
- **Morse** (`src/morse.js`): the Asters' messages in English and toki pona at 0.14 s a unit; a story can set
  `MORSE.override` to send its own.
  Checked in a render (September 2026): `MORSEON=1` / `MORSEON=0` in the scratch runner hold the key on or off
  (`MORSE.unit = 1e9` holds the first mark); from `CAM=-65,133,-30,-1.5708,-0.02` (level with the antenna tips of
  the tall towers at cells z = -5 to -7) several tips are clearly brighter with the key on. A whole-frame diff is
  no use for this: the fliers move between runs even with `FREEZE`.
- **Check offline:** `tests/audiotest2.mjs` (needs `npm i --no-save node-web-audio-api`) renders 36 seconds with node-web-audio-api and reports loudness, peak and
  which events fired per scene. It needs `setTimeout` mapped to the offline clock, or every syllable scheduled with
  `setTimeout` fires in real time and the render misses it (September 2026: added to the harness). Compare loudness
  against the previous `audio.js` before and after a change; the radio chain first made the street 3.7 dB louder.

## Stories: episodes linked the FINK way

Owner rule (September 2026): "The story switch MUST be done Fink style. This is a multiverse of stories and
episodes." So there is no list of stories in the page. Stories link to each other with tags, and the page follows
the tags, as the FINK player does:

- No ending leaves the city. Two endings once had `# fly: saturn` (THE SPOTLIGHT, PASSAGE PAID): the page closed the
  story panel and flew to the Saturn system before the ending could be read, and the owner asked whether it was
  meant. They now stay on a place (the dish; the Asters' roof). `# fly:` still works, and still closes the panel.
- `story/episodes.fink.js` is the front door (Menu > Story > Episodes, and the "Drift City" entry in
  `inklet/toc.fink.js`): one bare `# FINK: <file>` link per episode.
- Each episode has a light peer link to the other, in its "Think it over" knot: `# FINK: <file>` plus
  `# LINKREL: peer`, a lead-in line, then a divert back to the hub knot. Tag first, lead-in second: a tag binds to
  the line that follows it. The episodes share the city, not a narrator: the Lamplighter's "you" keeps a tea stall;
  Per Aspera's "you" plays bass.
- In the page (`taleTags`, `taleAdvance`, `taleLink` in `tales.js`): a FINK tag shows the passage up to the link
  and a "Go on" button; what came after the link is saved as what this story shows when you come back. Each file
  has its own save (`taleKey`: the front door none, the Lamplighter its old key `drift.tale.v1`). A save left at an
  end (a replacing link has nothing after it) starts that story again. A link may name only a bare file in
  `story/`. The name in Menu > Story is the story's `# title:` global tag. `?tale=peraspera` opens one directly.
- In the page, peer and replace both switch the panel (one story is shown at a time); in the FINK player a peer
  opens beside. The same files serve both.
- To add an episode: write the file with a `# title:` tag, link it from `episodes.fink.js`, add it to
  `STORY_FILES` in `tools/story.mjs` (so `tests/inkwalk.mjs` and `tools/bakeplaces.mjs` check it), and give each
  new speaker an `AU_VOICES` entry in `audio.js` (a speaker without one is silent). Every place a story names must
  be one of the 50 in `buildPlaces`; `inkwalk` fails a story with fewer than four endings in random play;
  `node inklet/tools/fink-check.mjs` catches a knot that runs out of content (a `# restart` knot needs `-> END`).

## Sound and lift in two airs (the Warmhouse, September 2026)

Figures for writing and sound design. Titan surface air: nitrogen with about 5% methane, 94 K, 1.47 bar.

| | Titan air | Warmhouse air (Earth mix, 293 K, 1.47 bar) | Earth, sea level |
|---|---|---|---|
| density | 5.3 kg/m³ | 1.75 kg/m³ | 1.2 kg/m³ |
| speed of sound | about 194 m/s (Huygens measured) | 343 m/s | 343 m/s |
| impedance ρc | about 1030 rayl | about 600 rayl | 413 rayl |

- **Lift is heat.** The bubble floats because its air is warm: (5.3 - 1.75) kg/m³ at g 1.352 is 4.8 N per cubic
  metre, and the 170 m sphere (2.1 x 10⁷ m³) carries about 73,000 tonnes. The same Earth air at 94 K would weigh
  5.45 kg/m³ and sink. If the heating fails, the Warmhouse comes down. The pressure must match the outside (a
  membrane that size holds almost no overpressure), so the inside is Earth air at 1.47 bar: oxygen at about 0.31 bar,
  higher than at home but safe.
- **Inside, music is Earth-normal.** Speed of sound 343 m/s: pipes, voices and rooms sound as they do at home. This
  is the only place in the city where people hear each other without radios.
- **Outside, bass is cheaper.** Air-column resonances scale with the speed of sound, 194/343 = 0.57, about 10
  semitones down: the same saxophone or organ pipe plays nearly a seventh lower, a 16-foot organ pipe (32.7 Hz on
  Earth) gives 18.5 Hz, under the limit of hearing. A bass-reflex port tunes 0.57 times as low. A small loudspeaker
  radiates in proportion to ρ/c at low frequency, 7.8 times Earth's: about 9 dB more bass for the same cone movement.
  The sealed-box air spring (γP) is 1.45 times as stiff, which raises a closed box's resonance about 20%. Treble
  beams: a driver becomes directional where its size equals a wavelength, and wavelengths are 0.57 times as long.
  String pitch does not change (tension and mass set it); a guitar's body resonance drops by 0.57, and heavier air
  loads a drumhead and lowers it a little.
- **Nobody outside has bare ears.** Outdoors everyone is in a suit with Earth air in the helmet, so a voice sounds
  normal to its speaker and reaches others over radio (see "Sound"). Titan-air acoustics are for instruments and
  speakers standing in the open, the exos' own noises, and what comes through a wall.
- **Through the membrane, bass passes and treble stops.** Impedance alone reflects (1030 - 600)/(1030 + 600) = 0.26
  of the pressure, 7% of the energy. The membrane's mass does the rest: at 2 kg/m² it barely stops 100 Hz and cuts
  1 kHz by roughly 18 dB (the mass law). From the ground the jazz club is a bass line and a kick drum.

## Words the player sees: two rules (owner, September 2026)

- Never name toki pona in anything a player reads or hears (tour lines, captions, story text, Morse). The Asters'
  katakana is a puzzle; nothing may say what language it is. Code comments and this skill may name it.
- Never say open flames are banned or dangerous: Titan's air has no oxygen, so there is no fire risk. The city's
  rule is about oxygen: "an unlicensed oxygen store", "a store no licence covers", and so on. The Lamplighter vote is
  to shut the last unlicensed oxygen stores; the flames go out as a result.

## Conway's Life in the round towers (`src/life.js`)

- One 64 x 40 board (64 round, wrapping; 40 floors from the top, dead edges) stepped four times a second on the
  CPU, reseeded every two to four minutes or when it dies or settles: a glider gun firing down the tower (Gosper's,
  period 30, or Simkin's, period 120; the guns are the most likely seed, and both were checked by simulation to keep
  firing for 960 generations on this wrapping, dead-edged board in all four orientations), a pulsar,
  a pentadecathlon, an acorn, an R-pentomino, glider and spaceship fleets, and small blinkers and gliders all round
  the top rows (most towers are short and show only the top few floors, from one side).
- Each cell is coloured by its live-neighbour count, which is also its fate (`lifeCol` in scene.wgsl): one or none
  amber (dies of loneliness), two green, three blue, four or more magenta (dies of crowding); an empty cell with
  three (born next generation) glows faint blue. Owner, September 2026: "not enough conway life, i still haven't seen
  it in the wild". The cause: the cells faded out with the other window detail at 110 to 360 m, so from the air a
  Life tower looked like any other. Life now has its own fade (`lifeD`, 350 to 900 m), is brighter by day, and runs
  on more towers. Owner, September 2026: a board needs at least about ten cells each way to mean anything, so tall
  towers come first ("prioritise spacious tower areas but it is not banned on the others"): a tower of twelve
  floors or more runs Life nine times in ten (banded round towers, 4.2 m floors) or 85 in 100 (rounded modern
  towers, 3.6 m floors); a shorter one three in ten or one in four. The board is 64 cells round, so width is never
  the limit (about 32 columns face you); height is: a tower shows only as many rows as it has floors.
- Headless check: the runner's clock barely moves, so the board is uploaded only if a step happens. Set
  `D.LIFE.acc = 1` after changing the board (`D.lifeStamp`, `D.lifeStep` and `D.LIFE_PATTERNS` are on `__drift`).
  Use `CAM=-490,95,-229,-2.729,-0.02 CAMF=4` with `HOP=place:roof_0` to look at the tour's Life tower.
- Uploaded packed 16 cells to a float at byte 848 of the event buffer (`ev.life`, read by `lifeAt`).
- Shown on half the organic round towers (type 8, material 15: the banded ones; the window band cut into 64 cells)
  and two in five rounded modern towers (material 1, `v` 0.4 to 0.72). Each tower turns the board by its own
  number of columns.
- Check it with a known still life: `LIFESTRIPE=1` in the scratch runner stamps every other row full (stable in
  Life), so a Life tower must show every other floor lit. The first attempt put Life on material 1 only; the
  visible round towers are type 8, and nothing showed.

## The ship's computer (`src/guide.js`, ElevenLabs voice)

Owner direction (September 2026): use recorded ElevenLabs speech for a "ship's computer" role in the interface,
reached only from the hamburger menu; later, perhaps, the voice of the Org's Titan computer if a story needs one.

- Two tours (`GUIDE_TOURS`): Menu > "Guided flight" (seven stops, about 3 minutes) and "Full tour" (fifteen stops,
  about 8 minutes: the spire, the signal tower and its Morse, a Life tower, the Assembly Hall, Ferry Street, inside
  the Cold Tap, the pagoda, inside the Lantern Cellar, the Hive and the Asters' katakana poster, the fab, inside the
  Low Orbit, the spaceport and the airships, the stones, the Warmhouse, inside the club). Owner, September 2026:
  "way more comprehensive... include Conway life, dive bars... keep the tour moving, on every-frame-a-painting
  trajectories". Landmark stops fly with `pickLaunch` (the composed, side-lit view); place and room stops fly like a
  story visit (`guideGo`); the words start when the view is 62% of the way in (97% for a room, so they start inside).
  Rooms linger 5 to 7 s after the words so the band is heard. Lines are short facts about what is in view.
- `guideLifeTower` picks the tallest organic round tower within 30 cells that runs the board (the shader's own test,
  `hsh(cseed, 5, 781) < 0.5`); the signal tower is seen from its street place (`tower_0`, looking up): framed from the air it sits among the financial district's tall towers and the composed view looked steeply down from 150 m (Dawn render, September 2026). The Life tower's composed view is good.
- **Brush, press, menu.** During a tour a tap, a drag, the sticks and the look keys only turn the view (`V.ly`/`V.lp`
  also apply mid-flight and to picked flights; the stick take-over of a flight and walking mid-flight are off while
  a tour runs); the next stop recentres it. A long press (`pickInit`) or opening the menu pauses the tour: the
  words stop and the view is yours. Closing the menu without choosing (the close button, back from the top, Escape,
  a tap on the view: `menuDismiss`) carries on; any menu action leaves it paused. Owner, September 2026: "simple
  navigation brushes should move camera without stopping tour; longer presses or hamburger can interrupt". Before
  that, any touch paused it, and before that any touch ended it.
- **Controls live in the menu.** The tour's controls ("Pause the tour" / "Carry on with the tour" with "n of 15",
  "End the tour"), the Grand tour's ("Carry on", "End") and "Explore from here" are rows at the top of the menu
  (`menuNow`, marked `.row.now`), not buttons over the view: the floating "Explore from here" button and the
  caption's buttons are gone. The caption shows the spoken words only and takes no touches.
- The Grand tour (Menu > Travel) is held, not ended, when you leave it (a long press, a story place, a hop, flying by
  hand, a trip from the menu): `tourHold`, and Menu > Travel > "Carry on the Grand tour" (`tourResume`). Steering by
  hand already paused it.
- It runs on a 200 ms timer, not in a frame loop, so both renderers share it. It calls `flyOn` at the end.
- The clips, their voice, cost and how to redo one: `audio/computer/README.md`. Tone for new lines: facts about
  what is in view, short sentences, no adjectives for effect.
- Test: `GUIDE=1 FRAMES=260` in the scratch Dawn runner logs the stop, phase and flight progress.
- A class-name clash made the first caption 1,400 px tall: `.gt` is the intro title's class (54 px letters). Give
  new UI elements prefixed class names.

## Long-press to go (`src/pick.js`)

Hold still on the view for 0.65 s (moving 10 px cancels): `pickAt` follows the ray (the camera snapshot `CAMNOW`, which main.js and
fallback.js fill each frame) through the skyboats (spheres from `EVN`), then marches it against `heightAt`, then
names what it struck: a landmark (`pickLandmarks`, keep it in step with the map's), a building (street and
district), or the land. `pickCompose` frames it: a distance that fits its size, 16 bearings scored for side light
(the sun about 55 degrees off the view) and nearness to where you are, rejected if the line to it is blocked, a low
angle (0.2 rad for tall things, 0.32 for wide), the subject on a third of the frame away from the light. The flight
is a visit (`NAV.visit` with `look` and `subject`): `visitStep` turns to watch the subject, then settles into the
composed view; `pickWarp` runs the world clock up to eight times as fast mid-flight; focus lands on the subject.
The WebGL fallback only names things (it has no visits). Test: `PICK=x,y PICKF=12` in the scratch Dawn runner.

- **A long press offers; it never flies.** Until September 2026 the press started the flight at once, so a finger
  resting on the screen sent the view off somewhere (owner report: "sometimes it zooms off"). Now `pickOffer` shows a
  card by the finger with the name, "Fly there" (`pickLaunch`) and a close button; any new touch on the view closes
  it. `pickGo(x, y, true)` still flies at once, for tests.
- **"Explore from here"** (was "Fly on", owner: "random and cryptic, begins with a lurching jump"). `flyOn` now starts
  from a standstill at the view's height, heading the way you face (the tour target is 2.5 km ahead, not a random
  place). Two causes of the lurch, both measured in the Dawn runner (`FLYON=<frame>`): it always switched to street
  level, so a high view dived; and street places stand inside the flight code's coarse building boxes (`heightAt`
  at a street place can read the roof height across the street), and the push-out moved the drone to the roof in a
  few frames. `st.soft` limits that push to 5 m/s for 15 s after the handover.

## Walking into a scene (`visitMove`, `visitWalkTo` in tales.js)

In a story place or a picked view (`NAV.mode === "visit"`) the left stick looks and the right stick moves: up
walks (eye level, under 6 m above the ground: 2.6 m/s, the ground followed, a slow bob) or flies along the view
(10 m/s); left and right turn; W and S do the same. The move is an offset (`V.off`) on the visit, so the place's
props and hotspots stay where they are; a new visit starts at its place again.

- There is no distance limit (owner, September 2026: "walking is needlessly capped... we should be able to navigate
  anywhere"). Until then you stayed within 150 m of the place and a step into a wall stopped you dead; from
  street_1 that was 6.6 m. Now a blocked step tries its two axis parts and takes whichever is free, so you slide
  along a facade. The test is still relative (the height map ahead against the height where you stand), because
  street places stand inside the flight code's coarse building boxes and an absolute test refuses every step.
- During the flight to a place the sticks used to do nothing (flights take up to 14 s). Now a stick, W or S pushed
  mid-flight ends the flight where the view is and hands it over (`visitStep`); a drag on the screen does not.
- Planning a walk (`visitWalkTo`): the line is walked at eye level 1.5 m at a time, and a wall is a rise in the
  height map from one step to the next. Neither an absolute height nor the height at the start works: a street
  place stands inside the coarse boxes, so the first version planned a 68 m crane move for a 22 m walk along the
  pavement, and the second walked through a facade whose box was no higher than the one at the start. A wall within
  12 m of the goal means the goal is that building: stop 2.5 m short. A wall further off means the goal is beyond
  buildings: rise 4 m over the highest and land at the last clear point before the goal. Checked in Node with the
  real world.js and tales.js (a scratch harness; the Dawn runner's clock advances only 0.3 s in 70 frames, too slow
  for a walk).
- **Walk there**: a long press in a scene offers "Walk there" as well as "Fly there" (for things under 450 m away;
  not skyboats or the bubble). `visitWalkTo` plans it to be easy to follow: the view turns to the goal first (the
  first 18% of the time), the move eases in and out, it stops 2.5 m short of a wall, and if buildings stand in the
  way at eye level the view rises over them in a crane move (4 m above the highest thing in the way, looking down at
  the goal) and comes down on the far side. Any stick or key input takes over at once. Test: `PICK=x,y PICKF=12
  PICKWALK=1` in the scratch Dawn runner logs the walk's progress and lift every 5 frames.

## Rooms: the venues' interiors (`ROOMS` in tales.js, `roomRender` in scene.wgsl)

Owner, September 2026: "the music venues: when we fly to them we see only street scenes. No interiors." The city is
a height-field raymarch with coarse building boxes; it has no insides to walk into. So a venue is a separate small
scene: four room places (`cold_tap`, `low_orbit_bar`, `lantern_cellar`, `warmhouse_club`) stand at their street
(or, for the club, the Warmhouse square) beyond the fifty generated places. When you arrive at one (`roomNow()`:
the visit at 92% or more), `EVN[210]` carries its kind and `EVN[212..215]` its origin and heading, and the scene
pass returns `roomRender` at once: its own SDF (`rmMap`), up to six lamps (`rmLight`, all with soft shadows), up to
three lamp beams in the haze (`rmBeam`), one glossy reflection bounce, AO, haze, and the story's props lit by the room (`propsFx` checks `ev.wx.z`). The snow overlay is off (`U[55]`)
and the street's sound drops behind the walls (see Music).

- Room axes: x forward along the place's heading, z to the right, y up from the floor; the camera starts at x = 0.
  `ROOMS` holds each room's walking bounds (x0, x1, half width, and a circle for the club); `rmMap` holds the walls.
  Keep the two in step. Walking, "Walk there" and the story's props and clues are all kept inside the bounds
  (`roomClamp`), and a clue's glint is re-aimed at where the clamp put it.
- The ev block grew by one vec4 (`room`) before the Life board: `EVN` is 216 floats, the Life board is written at
  byte 864, and the buffer is 864 + 1024 bytes. Change all three together.
- The WebGL fallback has no rooms: it shows the street.
- Seen in Dawn renders (September 2026): the Cold Tap (counter, stools, lit bottles, heater, airlock ring, price
  list), the Low Orbit (window on the pads with a blinking launch light, cracked star on the ceiling, bar across
  the far end), the Lantern Cellar (brick barrel vault, paper lanterns, the stand with a kit and a bass), the club
  (dome with strings of bulbs, tables with lamps in two rings, the stand with a curtain, piano, kit and bass). The
  first cellar render had a lantern hanging 1 m in front of the camera; the lantern grid starts at x = 2.8.

## Interiors and people: how to make them tell stories (September 2026)

Owner, September 2026, on the first rooms: "way too bland and cartoonish ... a cheap formica kids toyhouse. And the
pieces look worse than Monopoly player symbols. Outdoors suffers from this a bit too, primarily around bipedal
figures." The rooms were then rebuilt (`rmColdTap`, `rmLowOrbit`, `rmCellar`, `rmClub`, `rmSurface`) and the story
people were given bodies (`propPerson`). The method:

1. Detail at three scales. Macro: the room's shape and the big furniture (bar, booths, stand, vault). Meso: the
   fittings that say how the room is used (foot rail, taps, back-bar shelves, pendants on cords, heater, jukebox,
   airlock with a porthole, pipes and cable trays, a departures screen). Micro: in the material (wood grain and
   plank gaps, grout, rivets, the weave of cloth). A room with only macro shapes reads as a toy. Test each room at
   the three distances a player sees it from.
2. Every surface has a history. Paint over plaster with stains and brick showing through; floorboards worn where
   people walk; soot above the heater; damp at the foot of the wall; chipped paint to bare metal at the edges
   (`rmGrime`). Clean, one-colour albedo is the "formica" look. Use muted, dark base colours (albedo 0.05 to 0.4) and
   let the light give the colour.
3. Story objects. Things that imply a person or an event: photographs on the wall, a chalkboard with a price list,
   gig posters, a mug left on a table, candles in bottles, a rug on the stand, a neon sign with a letter missing.
   Each room needs objects that make a visitor ask a question. Do not use real people's names or records (see the
   data-ethics rule in CLAUDE.md).
4. Motivated light, warm against cold. Every light has a visible source (a pendant, a lantern, a lamp on a table,
   a window, a screen). Put warm sources against one cold one (a window on the pads, a departures screen, a stair
   light). Use pools of light and dark between them, not an even fill. Beams in the haze (`rmBeam`) and one glossy
   reflection (bar top, brass, mirror) add depth at small cost.
5. Fine patterns fade with distance (`rmFine(size)`). A pattern smaller than a pixel aliases: tin-ceiling tiles,
   grain and mortar lines made concentric rings and green and orange speckle on the Cold Tap ceiling. Fade the
   pattern and its bump, not only the colour.
6. People are clothes and posture, not shapes. `propPerson`: a long wool coat with folds and a V opening over a
   collar, trousers and boots, hands, a face (jaw, cheeks, nose, brow, ears, eye sockets), hair, a beard, a hat or a
   scarf, chosen by hash; seven poses (stand, sit, lean, drums, with or without a hat). Build and height vary per
   person. A small idle motion (breath, weight shift, head turn) makes them alive. Skin gets a warm wrap term, and
   the room adds a small eye light from the viewer's side so a face reads.
7. Outdoor walkers wear workwear, not a plain suit. Quilted insulation bands, a seam, a retroreflective band at the
   chest and the shins (it flares when it faces the viewer), a belt with a buckle, thigh pockets, wear in the weave,
   scuffed boots, and tholin dust that climbs from the boots (higher on the lopers). This is in `surface()` case 24,
   parts 1, 2 and 4. The walker test page (`tests/walkers.html`) uses its own flat colours: see the materials in a
   Dawn street render (`HOP=place:street_1`).

Mistakes made on the way (check these first when a room or a person looks wrong):

- A figure's front is +z for facing 0. A z flip in `propPerson` turned every person away from the camera.
- The hair's cut plane had the wrong sign: the hair covered the face and left the back of the head bare. The faces
  read as grey masks. Hair is kept where `hq.z < 0.02`, further forward only on the crown.
- The physics particles (city grit and snow) drew over the room. The particle pass is skipped when `roomNow()`.
- The daylight grade in `post.wgsl` gave the cellar a purple cast. It is off in rooms (`u.reg.z`, `U[62]`), and a
  blue beam on the cellar stair was removed.
- Rings and speckle on a ceiling are not a depth-of-field fault (they stay with `FOCUS.on = false`). Causes found:
  sub-pixel pattern and bump (fade with `rmFine`), bright backlit bottles and neon (emission 0.22 and 2.2), and
  banding in the soft shadow under a lamp shade (jitter the shadow's start with `gRmJ`; 40 steps, minimum step
  0.01).

## Music in the venues (`src/venue.js`)

Each room has its own band, synthesised live with Web Audio (no samples, no recordings) and scheduled 0.25 s ahead
from a chord list and simple rules per player: the Cold Tap has a jukebox (12-bar blues shuffle, organ, guitar
lead, through a small-speaker filter); the Low Orbit has lounge (electric piano, bossa rim and bass, vibes); the
Lantern Cellar has the late jam (132 bpm swing: ride, hat on 2 and 4, snare comping, walking bass with a chromatic
approach into each bar, piano stabs on 1 and the "and" of 2, a tenor improvising in phrases with rests); the club
has a piano trio ballad with brushes. The lead moves to the nearest note of the chord's scale, chord tones on the
strong beats, inside its range, in phrases of 4 to 12 beats. In a room, `AU.outside` (the whole street mix)
drops to 22% and the muffle filter to 420 Hz, so the city is a murmur through the walls; the band goes straight to
the master.

- Offline check: render each band in Chromium's `OfflineAudioContext` (a scratch `render.mjs` that evals venue.js
  with a stub `AU`). September 2026: 40 s each, peaks 0.36 to 0.76, RMS 0.10 to 0.16, no clipping before the master
  limiter. Nobody has listened to it inside this pipeline; judge it by ear before building on it.
- To add a style: an entry in `VENUE_STYLES` (tempo, swing ratio, key as a MIDI note, chord list as [semitones from
  the key, quality], the four parts, the lead's range and how often it plays) and, if needed, a new instrument
  function beside `vSax`.

## A room that breathes: tunes, applause, crowd, lights on the beat (September 2026)

Owner, on a phone: the rooms were "eerily empty" and "motionless". What was added (no new geometry):

- Tunes end (`VENUE_SHAPE` in venue.js): each band plays `tune` bars, stops for `gap` seconds, the room claps, the
  talk comes up, the live bands (cellar, club) count the next tune in on the rim, at a tempo 8% either side. The
  jukebox only changes its record (no applause).
- Crowd sound: three two-second ElevenLabs sound effects (`audio/crowd`, model `eleven_text_to_sound_v2`) played as
  overlapping grains of about a second, from random points, at 0.9 to 1.1 speed, panned, three a second. The
  connector gives no length setting: asking for "20 seconds" in the prompt returned two seconds each time (three
  tries), so a plain loop would repeat audibly; the grains hide that. Level per room in `VENUE_CROWD`; the club goes
  quiet while the trio plays. Applause is one three-second clip played twice, the second copy slower and later.
  Whisper hears "Thank you" / "Thanks for watching" in these: its usual hallucination on noise, not words.
- The band's position reaches the GPU as one float, `ev.wx.w` (`EVN[211]`): beats since the room began while a tune
  plays (mod 512), -1 to -2 through the break, -1 outside rooms. With the sound off, `venueBand` runs the same
  shape on the page clock, so the lights still move. `rmBand()` in scene.wgsl unpacks it.
- `rmLight` wraps the fixed lamps (`rmLight0`): the stage key takes a colour every two bars and lifts on the beat;
  footlights pulse; house lights come up in the break while the stage dims; candles and lanterns flicker; the
  jukebox's light turns through its colours. `rmBeam` wraps `rmBeam0`: stage beams swing; the club has two
  follow-spots from the dome ribs, dark in the break; the cellar gets a coloured wash while the band plays.
- Story people nod on the beat (three in four, each a little early or late); a drummer's sticks land on it.
- Test: `/tmp/claude-0/band.mjs`-style Node harness with a mock AudioContext (Proxy nodes that record `start`):
  a 48-bar cellar tune ended at 87.7 s, applause started, the break ran 6 s, the next tune came in faster.

Noir and disco (owner, September 2026: "glitterballs and disco lighting - lasers, mood colour washes and dry ice
plus smokey bar atmospherics, and a ceiling fan casting shadows and god rays... Can we cut enough corners?"). Each
effect is one cheap trick, placed where it suits the room, not everywhere:

- The Cold Tap's fan (`rmFan`, under a lamp in a round lightwell in the ceiling, `RM_FAN`/`RM_FANL`): the blades'
  shadow is `rmFanMask`, which projects a point onto the fan's disc from the lamp and tests the blade sectors. No
  shadow march. The same mask cuts the lamp's haze cone (beam 2) into turning god rays and shades the floor
  (light 6; `rmLit` now loops over seven lights). The Cold Tap takes 16 haze samples, the others 10.
- Smoke in the Cold Tap and the cellar: 3D noise drifting on each haze sample multiplies the beams, so they swirl.
- The club's glitterball (`RM_BALL`, material 37: facets, grout, a few flashing): its spots are `rmBallSpots`, a
  facet pattern on the direction from the ball, turned with the ball, added as light in `rmLit` (so people catch
  them too). Slow colour washes turn round the dome from two stage colours.
- Lasers (`rmLasers`): six lines from the lip of the stand, fanning and sweeping, green and red, in bars 4 to 7 of
  every eight while the band plays. Each is the exact closest approach between the view ray and the line, with a
  width that grows with distance so it stays about a pixel wide.
- Dry ice: a low noisy layer (0.4 m falloff) on the club floor near the stand and at the cellar's stage end,
  coloured by the stage light.
- First try too bright: the fan's cone at colour 1.6 and a 0.12 falloff filled the whole view with fog. Now 1.1
  and 0.5. Dry ice at 0.22 m and weight 0.08 did not show; 0.4 m and 0.3 does.
- Check renders: `__bandForce` (main.js test hook) sets the band's position, for example 20.05 for lasers on.

The band on the stand and the silent phone (owner, September 2026: "no music, band etc"):

- The stands were empty: instruments, no players. `ROOM_BAND` in venue.js now puts a drummer (pose 4), a bassist and
  a sax player (cellar) or a pianist (club) on the stand, in the room's own axes, pushed into the props list each
  frame by `worldProps` (main.js) whenever `roomNow()`. They nod and hit on the beat like any story person.
- No sound on an iPhone: probably the hidden-tab handler (guide.js) suspending the AudioContext, and resume failing.
  iOS counts only some events as a user gesture that may start audio: a touch's `pointerup` and `touchend`,
  `click`, `keydown`, but not a touch's `pointerdown`, which was the only touch event audio.js listened for. It now
  listens for all five. Not confirmed on a phone. A headless Chromium test could not show it either: the page clock
  stayed at 0 there (the WebGPU path does not advance in that run), so `roomNow()` never became true.
- `AU`, `VENUE` and `CROWD_BUF` are on `__drift` for tests.

Staging ideas the owner raised for busy scenes (not built; for the scene-staging work):

- More scripted scenes are fine: playable cut scenes, fixed shots.
- A play within a play: the room fills with tiny drones and flickering holographic projections (the Leia kind)
  that grow to fill the room with light and action. Being projections, they may overlap and pass through things
  and each other; the world explains it (as if ZX Spectrum attribute clash were blamed on a virus).
- The main characters on a balcony high above the crowd: the crowd is far below, dim and repeated, and cheap.
- An episode told as a freeze-framed graphic novel: three to five held moments.

## Talking heads (`src/heads.js`, September 2026)

When a story plays a recorded line (`# speech`) whose file is named for a cast member (`mags-3.mp3`,
`elder-oxygen.mp3`), a small framed "helmet comms feed" opens top left with that person's face: a rigged
Gaussian-splat head from `magpie/splatweb` (LAM; the lam-face-pipeline skill), mouth moved by the clip. Owner chose
this (option 1 of 3) over splat heads on SDF bodies in the scene; holographic crowd scenes are option 2.

- Casting (`HEAD_CAST`), synthetic faces only, chosen from a contact sheet rendered with the project's own renderer
  (none of the excluded or bespectacled faces): Mags tpdne-40, Dex tpdne-21, Oskar tpdne-28, Nuala tpdne-24, Pell
  tpdne-20, Ruth tpdne-35, Elder Harriet tpdne-04. The Org is an AI: a ring of light that swells with its voice, no
  face. The attribution the splatweb rules ask for ("ship the attribution wherever these render") is in the feed
  itself: "synthetic face · LAM, Apache-2.0".
- Loading: nothing until the first line. Then `import()` of `magpie/splatweb/lib/{splat-renderer,lam-splats,
  lam-visemes}.js` (relative to dist/city.html), the shared 3.6 MB `lam-sample/skin.glb` once, 1.3 MB per face.
- Drawing (owner, September 2026: "The splat talking heads are supposed to be gpu esp webgpu"). With WebGPU, the
  pose runs in a WGSL compute pass (`magpie/splatweb/lib/gpu-skinned-avatar.js`) and a `GpuSplatScene` draws it
  every frame, on the city's own device (`HEADS.device`, set at the end of `init()` in `main.js`), so a phone still
  holds one device. The feed page has no other device and asks for one. Without WebGPU, or with no adapter (plain
  headless Chromium has `navigator.gpu` and no adapter), it falls back to the CPU pose (20,000 splats of
  JavaScript) and the WebGL2 `SplatRenderer`, about 30 frames a second. A canvas that once gave a WebGPU context
  cannot give WebGL2, so the fallback swaps in a new canvas (`headNewCanvas`). Only while the feed is open.
  - **The GPU path does not sort the splats inside a face.** `GpuSplatScene` orders objects; a drawable's
    `orderBuf` is the identity. Drawn in file order, Mags's face came out washed out, the eyes glassy and the blue
    collar showing through the cheeks (compared side by side with the CPU path, which sorts every frame). The
    feed's camera is fixed and the head turns about 0.1 radian, so `headDraw` orders the splats once, back to
    front from the camera (`presortOrder`, written into `orderBuf`): the image then matched the CPU one. A camera
    that moves around a head would need a per-frame sort on the GPU, which the library does not have yet.
  - **The GPU pose bakes only the channels it is given.** The library's default is 17 (visemes and blinks), which
    would drop every mood and brow flash. `headMorphNames` adds the moods and what speech drives: 43 channels,
    154 floats per splat, 12.3 MB of rest buffer per face. The last three faces keep their GPU buffers; older ones
    are freed (`destroy`).
  - Measured here (Chromium, Dawn's SwiftShader adapter, in the sandboxed feed frame): the WebGPU path runs, 3 to
    8 frames in the first seconds in software; `e2e-drift.mjs` checks both paths. Not measured: a head inside the
    city on the city's own device (the city's WebGPU start-up does not finish on SwiftShader in a test's time), and
    frame rates on a phone.
- Mouth: the ARKit viseme bursts from `lam-visemes.js`, scaled by the clip's loudness, plus `jawOpen` from the
  loudness. The loudness is a 60 Hz RMS envelope from a second fetch of the same mp3 (served from cache), so the
  line still plays through its own `<audio>` element, untouched. Blinks and a slow head sway.
- Mistakes: the first contact sheet showed blurred blobs: the camera was behind the heads (LAM heads have no back;
  with `yaw: Math.PI` the camera goes on the -z side). The first feed filled the screen: the page styles every
  `canvas` as a fixed full-screen layer, so the feed's canvas needs `position: absolute; inset: 0`.
- Owner, on a phone (first version): one mouth was "very toothy or just wrong", and the feed covered the story
  text. The library's visemes are built about 1.4 times full strength for demos; at that size a LAM mouth gapes and
  shows an empty grey inside (no teeth or tongue in these heads). Now half strength, `jawOpen` capped at 0.35. While
  the story panel is open, the feed is an inset floated right inside `#taleText` (re-inserted each frame, because
  `taleSay` rebuilds the text); in the corner otherwise. Moving the canvas in the DOM keeps its WebGL context.
- Expressions beyond the mouth (owner: "we do want expressions beyond the mouth too"). Three layers, eased:
  a resting mood per character (`base` in `HEAD_CAST`: Mags wry, Dex sly, Oskar neutral, Nuala worried, Pell stern,
  Ruth warm, Elder Harriet wry); a mood per line, from an optional `# mood: <name>` tag on the line (tales.js hands
  the line's text and mood to the speech queue), else read from the line's words (laughs, snorts, quietly, tired,
  thank you, leans...), else the resting one; and speech itself: brow flashes and a head dip on stressed syllables
  (onsets in the loudness, stronger when the line has "!"), brows rising through the last part of a question, small
  eye jumps every one to three seconds, a blink at the end of most phrases. Ten moods in `HEAD_MOODS`, written as
  ARKit weights at their true size and applied at 2.5 times: these heads answer weakly to the brow, eye and cheek
  shapes (at 1 times the ten moods were hard to tell apart in a render; at 2.5 all ten read, without artefacts).
  The mouth shapes stay at half strength (they gape). All 51 ARKit shapes are in the rig (checked).
- Test: headless Chromium (WebGL on SwiftShader) with `--autoplay-policy=no-user-gesture-required`, calling
  `__drift.headSay(audio.src, audio)` on a playing clip; `__drift.HEADS` shows the state. Not yet tested on a phone
  for speed.
- `HEADS.paused` (September 2026) stops posing and drawing; the page's host sets it (see "Drift City as a foafos
  app"). The same file also runs on its own page, `feed/index.html`, as the stage app `talkinghead`.

## Drift City as a foafos app (September 2026)

Owner, after the Lantern Cellar worked in the shell: "Can we do the sdf world drift display too? And sdf rigged
talking heads?" The talking heads in this repo are rigged Gaussian-splat heads (LAM, `magpie/splatweb`), not SDF;
no SDF talking head exists (searched lucid/, yeti/, magpie/, drift-city/). Both are now foafos stage apps, rows in
`inklet/finkapp/foafos-apps.js`, opened by `# MINIGAME:` with arguments (the story-game-sync skill, "Tag
arguments"). Try them: `inklet/finkapp/?story=/glitchcan-minigam/drift-city/foafos-entry.fink.js`, a hub whose
every line is quoted from `story/episodes.fink.js`, `story/peraspera.fink.js` and the cellar entry.

Then the owner, the same month: "The issue seems to be that it still uses Drift's bakes in Fink/Ink client,
instead of the foafos framework (ditto audio, gamepad etc.)". So inside foafos the city is now the WORLD beside a
story that the foafos runner plays (`# WORLD: drift`; spec §5.8; the story-game-sync skill, model C). The hub
links to each story as a dream, and each story's own `# WORLD: drift` opens the city. Per Aspera opened directly
works too: `inklet/finkapp/?story=/glitchcan-minigam/drift-city/story/peraspera.fink.js`.

- **`drift`**: `dist/city.html` in a sandboxed frame. `# MINIGAME: drift tale=peraspera` arrives as `?tale=`,
  which `tales.js` already read, so the page needed no argument code. Holds `audio`, `vars:read`, `vars:write`
  and `story:steer`; the foafos sticks (`controls: 'sticks'`). The row's `variables` let it read `want_time` and
  `want_weather` and write `here`, `hour` and `snowing`; `features: ['autoplay']`, because the reader taps the
  story's window, not the city.
- **World mode** (`?world=1`, which the shell adds for `# WORLD: drift`; "the world beside a story in foafos" in
  `tales.js`, `worldOn`). No story panel, no Story menu, no Story button, no opening page or intro (`taleOpen`,
  `taleLink` and `taleRestart` return at once in world mode: "Return to opening", the Story button and the `t` key
  reached `taleOpen` and opened the city's own ink over the runner's story, September 2026): `worldStart` starts the sound and
  hops to the home place, and the story's first `# place:` flies on from there. Each step's lines arrive through
  `onStoryBeat` and go through `taleTags`, so every tag works as in the page's own story; `# speech:` resolves
  against the story's address (`TALE.base`); a replayed beat (after a restore) skips `voice` and `speech`.
  `taleSync` sends `here`, `hour` and `snowing` with `setVariable`, only when a value changes (`TALE.wsent`), and it
  now also runs in the WebGL fallback's frame loop, which never called it. `want_time` and `want_weather` arrive
  through `onVariableChanged` (`worldVar`). Clues glint as in the page's own story: `taleFound` sets the clue in the
  story (`setVariable`; the row lists the clue names in `DRIFT_CLUES`, `foafos-apps.js`, so a new clue must be added
  there) and asks the story to re-enter the scene (`worldReenter`, SDK `reenterScene`); a `# live` scene does the same
  when you move. The story's text routes still offer the clues too. In foafos (world or game) the menu has
  no Sound item: the shell's volume and mute reach the city through `hostGain`. Where the city goes on screen is the
  reader's choice in the foafos window manager (full, split, pip; the fink skill); on a phone a world opens
  split, and the foafos pad sits over the city.
  Controls come from foafos too (owner's decision, September 2026): the row says `controls: 'sticks'`, `host.js`
  registers `onControls` and `onSticks`, the foafos sticks (on screen, or a gamepad's) write the same `PAD` values
  the city's own sticks write, and the city hides its own sticks and the menu's "On-screen gamepad" switch
  (`hostState().sticks`). The keyboard still works when the city has focus.
  From the foafos app list, Drift City opens the story runner on the Drift hub
  (`drift-city/foafos-entry.fink.js`; the registry row's `opens`), so the
  city runs as a story's world there too. The city's own ink client remains
  for the standalone page and for a story that still says `# MINIGAME: drift`
  (none in the repo, September 2026).
  Recorded lines (`# speech:`) are played by the SHELL when the city is hosted (spec §5.5, owner's rule: "it
  needed to be a shell service cos new iframe apps weren't trusted quickly enough"). On a phone beside a story
  the city's frame gets no taps (choices are in the runner, the sticks in the shell), so a line played in the
  frame failed on iOS, and the head closed with it: that is how the talking heads "vanished". `shellAudio(sdk)`
  in `tales.js` looks like the part of an `<audio>` element that the queue and `heads.js` use, and takes its
  time from the shell's `speech-state`. The city's synthesised music and street sound still start only on a
  tap in the city. A second fault hid the same heads: in world mode `TALE.base` is a path, and
  `new URL(file, path)` throws, so every line was dropped; it is now resolved against the page first. In
  split the city's frame is only its share of the screen, so it draws fewer pixels than when the story
  covered part of a full-screen frame (which is what the phone layout did before split).
- **`src/host.js`** (built in before `main.js`) answers the shell when the page is in a frame with the SDK
  (`packages/finkgame/src/minigame-sdk.js`, a script tag in `head.html`):
  - pause: `hostPaused()` makes the frame loops in `main.js` and `fallback.js` skip (they keep asking for frames;
    the time step is capped at 0.1 s, so resuming does not jump); the AudioContext is suspended; a running tour
    and a recorded line are held; `HEADS.paused` stops the comms feed. Resume restarts only what pause stopped.
  - master volume: `hostGain()` scales `AU.master` (0.5 at full), the tour's `<audio>` (0.9) and the recorded
    lines' `<audio>`.
  - snapshot: the story saves. A sandboxed frame has no localStorage (every call already sat in try/catch and
    failed quietly), so `taleStore` also writes to `taleMem()` and `taleFetch` falls back to it; the snapshot is
    `{ v: 1, saves: taleMem() }` and a restore fills it, so a closed and reopened city resumes its story.
  - at a story's end the panel offers "Back to the story" (`hostComplete`), and the outer story resumes.
  - The state lives on a hoisted function (`hostState`), not a `const`: the modules before `host.js` in the build
    call `hostGain()` and `hostPaused()`, and a `const` there would be in its temporal dead zone.
- **WebGPU works in a sandboxed frame** (measured, Chromium 141 with the SwiftShader adapter): origin `null`,
  `isSecureContext` true, adapter and device granted. Other browsers: not measured.
- **`talkinghead`**: `feed/index.html?line=mags-3[&mood=wry]`, one cast member on the comms feed speaking one clip
  from `audio/cast/`, full frame; it hands control back 1.5 s after the clip ends. It loads `src/heads.js` as it
  is (one copy of the rig code; its city dependencies, `AU` and `#taleText`, were already guarded). Holds `audio`;
  `features: ['autoplay']` puts `allow="autoplay 'src'"` on the frame, and the clip then plays with no tap in the
  frame (measured). If a browser still refuses, a "Play the line" button appears.
- **Lesson: `import()` in a classic script loaded into an opaque-origin frame.** `heads.js` imports
  `../../magpie/splatweb/lib/*.js`. Inlined in `city.html`, the import resolves against the page. Loaded by
  `<script src>` into the sandboxed feed page it failed: "The base URL is about:blank because import() is called
  from a CORS-cross-origin script". The script is cross-origin to an opaque origin. `crossorigin="anonymous"` on
  the tag fixes it (CORS fetch; GitHub Pages sends `Access-Control-Allow-Origin: *`); the import then resolves
  against the script's own address, which is two levels below the site root, as `dist/city.html` is.
- **Lesson: a close can lose the snapshot while a head loads.** The shell waits 400 ms for a snapshot answer.
  Loading a head (5 MB, 20,000 splats) and its first poses block the page's thread: measured round trips of
  288, 450 and 577 ms against 4 to 9 ms otherwise, and a close then kept nothing (two test runs in three).
  Not fixed; the shell's rule is that a window that will not shut is worse than a lost save.
- Tests: `inklet/finkapp/test/e2e-drift.mjs` (35 checks; the world ones are §15-27: the story in the runner, the
  city beside it under the dream session, the phone layout, the first step's tags, a re-entry refused and a clue
  found in the city, the foafos sticks on a phone and from a gamepad, Per Aspera's opening text when opened directly, variables both ways through the shell, a choice
  moving the city and its recorded line played by the shell with the head open, the menu, closing the city, and a restore that reopens the world at the
  last scene. Before them, the game path: the argument filter; the city on Per Aspera as a node
  with its args; the Task Manager row; pause; master volume; a story save kept in memory, snapshotted, kept on
  close and restored on reopen; the head's autoplay, pause, load and draw; two lines handing control back in
  turn). Plain headless Chromium, so the city runs its WebGL fallback on SwiftShader, slowly: the checks are about
  the protocol, not frames.

## Novel pages (`drift-city/novel/`, September 2026)

Owner's idea: a scene told as one graphic-novel page, three to five held moments with thick black gutters, some panels
moving (short looping video), the page bigger than a phone screen; a tap zooms in on the tapped point on an easing
curve chosen for the mood, another tap zooms out. First page: `novel/cellar.html` (the Lantern Cellar).

- The page is the `<novel-page>` web component (`novel/novel-page.js`, no dependencies). Panels are its children,
  each with `points="x,y x,y ..."`: a polygon in page pixels. The component places the panel at the polygon's
  bounding box and clips it with `clip-path: polygon(...)`, so the gutters are the gaps the polygons leave. Taps are
  tested against the polygon, not the box (angled boxes overlap). A `slot="ink"` child sits below the page and holds
  text and choices; `play(story)` runs an inkjs Story into it through the Story API, and a `# panel: N` tag (1-based,
  0 = overview) moves the page. API: `zoomTo(i)`, `overview()`, `next()`, `prev()`, `.current`, `panelchange`.
  Attributes: `width`, `height`, `zoom` (a zoomed panel is at least this times the overview scale), `margin`,
  `duration`, `easing`.
- Touch, revision 2 (owner, 2026-09-28): tap a panel and it zooms to it, CENTRED (revision 1 centred on the tapped
  point, which the owner found "not quite right"); a tap in a gutter picks the nearest panel within 40 page px.
  Zoomed in, any tap goes back to the overview. A drag moves the page one to one, with no wall at the panel edge; on
  release the velocity of the last 100 ms is projected 0.22 s ahead, the path is walked, and the first other panel it
  enters by at least 12% of that panel's extent becomes the new panel; otherwise it springs back. So swipes work in
  every direction (up from panel c goes to d, below it). The motion is a damped spring (omega 9, damping ratio 0.78:
  a small overshoot) that starts with the finger's velocity. Taps use a tween on the page's easing curve. A move the
  story asks for is a "flight": the scale dips out in the middle in proportion to the distance (log-space scale minus
  a sine bump, after van Wijk and Nuij's smooth zooming and panning), so a jump across the page reads as travel.
- Frost: every panel is blurred (up to 6 screen px), desaturated, brightened a little and faded (to 40%) by its
  distance from the view centre, times how far the view is zoomed in. It is computed every frame, so a neighbour
  un-frosts as it is dragged into the centre. Quantised to 1/40 steps so the filter is not rewritten every frame.
- Lesson: the ink window's height changed with each knot (one choice or three), which resized the view; the
  ResizeObserver then stopped the running animation and clamped the camera, so a tapped panel was not centred. The
  resize handler now re-aims a running move, and the page gives the ink window a stable height.
- Ink in step with the view, both ways: `# panel: <knot>` in the story moves the view (source "story"); a tap, swipe
  or key diverts the story to the panel's `knot` attribute with `ChoosePathString` (the page's `knot` for the
  overview). One knot per panel. Every still leads to the moving panel, which holds the three choices.
  `novel/cellar.ink` has only two lines of prose, exact quotes from Per Aspera's cellar knot; its other choice
  labels are plain navigation, to be replaced by owner-written lines.
  Lesson (owner, 2026-09-28): the label "Look at her from the side" was "creepy"; the owner replaced it with "Take a
  minute to think". A choice that only moves the camera onto a person reads as watching her. Name what the reader
  does or feels, not where the camera points at someone.
- Gutters: 30 px, black, cut at small angles (2 to 5 degrees). Precedent the owner asked about: Eisner (the panel
  border as a window or a doorway), Winsor McCay (panel shape doing the storytelling), J. H. Williams III (Promethea,
  Batwoman: shaped panels in a designed page), Frank Miller's Sin City (heavy black as material), manga (slanted
  gutters for action, straight for calm), Chris Ware (strict grids). Avoid: many diagonals at once (the 1990s
  Image-comics look), and angles so steep that faces are cut. Keep one strong diagonal per page and small tilts
  elsewhere.
- Mood is the easing: noir uses `cubic-bezier(0.7, 0, 0.25, 1)` over 1.4 s (slow in and out, no overshoot).
  Reduced motion: 1 ms. Stills drift slowly (CSS) until they are replaced by moving panels. Caption boxes (`.cap`)
  exist but hold only owner-written text (none yet); they are hidden while empty.
- Tests (headless, 390x844, touch, pointer events with real timing): tap into b is centred and frosts a, c, d; a
  slow 40 px drag stays; a 150 px throw in 90 ms crosses to c; a throw up crosses to d; a tap goes out and the ink
  shows the page knot; ink choices fly the view to door, then stage, with the dip visible mid-way.
- Video: muted, looping, `playsinline`, played again on the first tap (iOS), paused in a hidden tab. H.264 plus a
  VP9 WebM source: open-source Chromium (the test browser here) has no H.264 and reports error 4.
- As a foafos app (September 2026): `novel/cellar.html` is also the stage app `cellar` (a row in
  `inklet/finkapp/foafos-apps.js` whose `url` is this page, no capabilities). A story opens it with
  `# MINIGAME: cellar`; the entry story is `novel/cellar-entry.fink.js`, owner lines only. One file serves both
  uses: the page speaks the minigame SDK only when it is in a frame. Lifecycle API: `pause()`, `resume()`,
  `.paused`, `captureState()`, `restoreState(state)`. Lessons: `animation-play-state` does not inherit, so setting
  it on the shadow `.page` left the slotted stills drifting; `pause()` pauses each animation from
  `getAnimations({ subtree: true })`, and while paused it ignores input and does not replay the video on a tap.
  Ink's saved state holds the position, not the text on screen, so a restore without the shown lines displayed
  only the choices; `captureState()` keeps the lines. The way out is the story's own: the guest completes when
  the STORY moves the view to the street ("Back to Ferry Street"), not when the reader taps the street panel. A
  relative path in a sandboxed frame loaded by `src` resolves normally; an earlier `<base href>` workaround for it
  was wrong. Test: `node inklet/finkapp/test/e2e-powers.mjs`.
- Making a moving panel with the ElevenLabs connector (`creative_*` tools): put the still on the flow (upload with
  `creative_create_asset_upload`; if that is blocked, push the image to the branch and pass its
  raw.githubusercontent.com URL to `creative_attach_reference_file`), add a
  video-generation node, wire the still to `start_frame` (and `end_frame`) with `creative_connect_flow_nodes`, price
  it with `estimate_only`, run, poll, then download the media URL from the run status yourself: the links the
  connector returns (flow and history pages) did not open for the owner, even logged in. Prices seen: Kling 3.0 Pro,
  8 s, 1080p square, about 5,430 credits; Seedance 2.0 about 33,000 at 1080p and 14,700 at 720p.
- Lesson: the same image as start and end frame, with "locked-off camera" and "the final frame matches the first",
  gave an almost still clip (mean frame-to-frame change under 1 in 255). Start frame only, with the action spelled
  out (lifts her hand, taps on every beat, nods, sways), moved well. Loop it yourself: forward and backward joins,
  or a crossfade inside a repeated section, and a camera drift that returns to its start (ffmpeg `zoompan` with
  `on/N` in a cosine). Check with numbers: the last frame against the first, frame-to-frame change.
- Changing a figure (owner, 2026-09-28: "15% heavier, dressed for somewhat colder climate"): an image edit of the
  old still (Gemini 3 Pro image, about 1,827 credits per variant; it returned 16:9, so crop), then one video take
  from the edited still, looped forward and backward. Record the change on the character sheet and add the still
  as her reference. The other panels still show the old figure until they get the same edit.
- Lesson (owner, 2026-09-28: "something super creepy about her hand movement ... floaty (and i guess also run
  backwards) plus oversized and stretched so werewolfy"). Revision 2's take had her hand hover over a table and stroke
  it, fingers too long, and the forward-then-backward loop played every gesture in reverse half the time. Rules now:
  - Never loop human movement by playing it backwards. Loop forward only: find two frames far apart that match
    (pose and all), cut there, and hide the join with a short crossfade. Check the join frame by frame.
  - Give the hands a job with contact and a physical rhythm (drumming: sticks or brushes strike a drum head) rather
    than a vague gesture (tapping a table), and say "normal human hands, natural proportions" in the prompt.
  - Look at the hands in close crops at several times before anything goes on a page; a full-frame glance misses it.
  - The forward loop, as done for revision 3: measure first. Compare normalised head-and-hands crops for every
    frame pair at least 4 s apart; if the best pair is worse than frames one second apart (it was), a cut will jump.
    Then generate a short bridge clip (Kling 3.0 Pro, 3 s, 2,036 credits) with the frame where the loop ends as its
    start frame and the frame where it begins as its end frame, and blend 4 frames at the far join. Measure every
    step of the result (typical 0.76, largest 1.57, wrap 0.95 on a 0 to 255 grey scale at 128 px).
  - A mistake to avoid: I first read a pose difference between two frames as camera drift. Tracking the lantern
    (position and width) showed the camera held still within 1% from 1.5 s to 9.5 s. Measure before you blame.
- Every generated picture is of Titan, not Earth (owner, 2026-09-28: the street panel was "too earthlike, make it fit
  our larger vision of Titan as icy space colony"). Outdoors: no trees, grass or open sky; methane ice and snow,
  orange-brown haze, sealed glass traffic tubes on pylons, domes, people in pressure suits and bubble helmets. Put the
  Titan design brief into the prompt; do not trust a source image to carry it.
- Media notes and costs: `novel/media/README.md`.

## Character sheets (`drift-city/bible/`, September 2026)

Owner: "in-house character sheets for figures and their wardrobes, key possessions, maybe also rooms, to keep 3D
world and generated imagery in sync ... exposed via Fink in admin/dev menus".

- Data: `bible/sheets.json`. Characters: facts (each with its source file), requested changes (who, when, status),
  wardrobe, possessions, reference images (`refs`, files in `bible/refs/`), what the game uses (`game`), voice, face,
  open questions. Rooms: fittings (from `ROOMS` in tales.js), people, music. An empty field is undecided: do not fill
  it with invention. Facts come from the stories, the code or the owner, never from a guess.
- Viewer: `bible/index.html`, read-only. Reached from the Drift city menu (Developer, "Character and room sheets",
  new tab) and from the FINK dev panel (the World sheets tab, in `inklet/finkapp/index.html`).
- Before you generate an image or a video of a person or a room, read the sheet, and put what you used in the
  prompt. After, add the reference image and update the sheet. When the owner asks for a change, record it under
  `requested` first, then do it.
- The mandatory FINK player test (`node inklet/finkapp/test/e2e.mjs`) passed after the dev-panel tab was added.
  `npx playwright test tests/fink-player.spec.js` fails 72 of 72 with and without that change (2026-09-28): that
  suite is stale; use the `inklet/finkapp/test/` scripts.

## Feeling the choices (`src/feel.js`)

A thumb slid over the story's choices feels which one it is on, so a player can choose while watching the city:
four haptic textures (a rhythm of ticks per choice: slow single, double, fast grain, triple burst), a quiet tone
for each on the cue bus, a short buzz when the thumb crosses into the next choice, and lifting the thumb on a choice
takes it. A quick tap is left to the button's own click (and the click after a slide is swallowed, so nothing is
chosen twice). The list scrolls while the thumb rests near its top or bottom edge; on a phone the default panel
shows only one or two choices at a time. Menu > Story > "Feel the choices" switches it off (`drift.feel`).

- iOS plays the switch's haptic only in answer to the touch itself, so a timed rhythm never reaches the hand
  there. On iOS each choice is a surface with ridges instead (`feelRidges`: a tick every 9, 22 or 30 px of thumb
  travel, none on the first), ticked from the move event; Android keeps the timed rhythm. Tested headless with the
  vibration API removed: switch toggles counted, not felt. The page also blocks pinch and double-tap zoom, rubber-band
  scrolling, text selection and the long-press menu (CSS in head.html, gesture guards at the top of main.js); only
  `.goPanel`, `.taleText`, `.mapPanel` and a non-sliding choice list may be panned.
- The on-screen gamepad: the right thumb alone flies (up faster, centre cruise, down stop; left/right turn); the
  left stick climbs and slides. Smaller, fainter, and fading when idle.
- Android has `navigator.vibrate`; iOS Safari does not. On iOS each tick is the system haptic of a hidden
  `<input type="checkbox" switch>` being toggled (`feelSwitch`), which iOS 18 Safari plays; older iPhones get
  only the tones. NOT verified on a device from this container.
- Test: a touch slide dispatched on `#taleChoices` with `navigator.vibrate` stubbed to a log (synthetic events are
  not captured, so dispatch moves on the list itself, as pointer capture does on a real device).

## Look: focus, snow, what the city is made of

- **Focus** (`comp` in `post.wgsl`): depth is in the alpha of the anti-aliased image. `u.reg2.z` is the focus
  distance the page asks for (`focusTarget` in `main.js`: the nearest story person or clue near the middle of the
  view), 0 means "whatever is at the centre"; `u.reg2.w` is the strength. Shallow focus is for story moments
  (strength 1 in a visit or with a story subject in view); in flight it goes deep (0.3 when slow, 0 at 25 m/s), because
  depth of field during navigation hurts judging where you are. In-focus pixels get a harder unsharp mask; out of
  focus an 8-tap blur that down-weights sharper foreground taps. `u.reg.z`, `u.reg2.z/w` were the last free uniform
  slots; `u.reg2.z` and `u.reg2.w` are now taken.
- **Snow** is drawn in `comp` too, as flakes in the WORLD (`snowLayer`): four nested 3D grids (0.6, 1.3, 5 and 16 m
  cells, out to 4, 12, 50 and 200 m) that the view ray steps through cell by cell, at most one flake per cell. The
  grids fall and drift with the wind (`u.p6`, `u.p7`, the page's accumulated wind), so flakes keep their place as the
  camera moves, and the scene depth (`srcTex.a`) hides flakes behind things. Each flake is drawn along the camera's
  travel this frame (`u.camPos - u.prevPos`), which gives streaks in flight with no screen-space rule.
  What went wrong before (September 2026, seen on a phone): the snow was layers in view-direction space (azimuth,
  elevation). Flakes stayed put on screen when the camera moved, streaks were cut off square at their grid cells into
  rectangles ("sheets of ice"), and the grid pinched to a point looking straight up or down, which read as lens
  distortion. Two rules from that: never map a world effect by view angle; and a mark drawn in a grid cell must stay
  inside that cell (clamp streaks to 0.3 of the cell). Reproduce headless: `SNOW=1 MOVE=0,-2 CAM=...` in
  `tests/dawn-run.mjs`.
- **Weathering** (`weathering`, after `frostify`, first hit only, fading out by 170 m): tone mottling, tholin dust on
  whatever faces up, streaks down walls, grime at street level, and a bumped normal from `vn3` (3D value noise with
  its analytic gradient: one call gives the pattern and the bump). Glass gets a film only; lit signs and screens are
  skipped; walkers get only a fabric weave and creases. Tree crowns near the camera are displaced by `vn3` into
  clumps of leaves (`treesSDF`), which broke the smooth-blob silhouettes more than any shading did.
- **Settled snow** (`frostify`, from `WX.cover` in main.js via `ev.wx.x`): builds over a couple of minutes of
  snowfall, melts over about five after; lies on whatever faces up in patches that grow and join; melts off lit
  surfaces (lamp pools, signs, glazing), goes to slush on wet streets, thins on glass, stays off the ground round the
  pod fab, and is never put on moving things (the patches are fixed in the world). Order matters: `weathering`
  runs first and `frostify` after it, or the tholin dust browns the snow; and `computeEvents` clears `EVN` every
  frame, so the cover is written just before the upload. Test: `COVER=0.5` in the scratch Dawn runner.
- **Crystals and rings** were everywhere; they now mark places. Crystal towers are three times rarer outside the
  crystal gardens (zone 7), crystal crowns on roofs rarer, plaza crystals only in zone 7. Megatowers (giants) went
  from 28% to 12% of 8x8 regions, and only about a third wear a ring. `giantHas` exists in `world.js` AND as
  `giantHasW` in `scene.wgsl`, plus the ground glow at `hsh(bg, 20)`: change all three together.

## Geography (authored, September 2026)

The city was about 12 km across with hashed districts that repeated every 20 km, so nothing could be learned. It is
now laid out by hand. Everything below is in `world.js` unless named; the shape is mirrored in `scene.wgsl`
(`citySdf`, `giantHasW`, the ring) and `fallback.js` (`citySdf`).

- **Shape**: `citySdf` = a core of radius `CITY_CORE` (1700 m, wobbling by a few hundred metres) round the origin,
  united with the harbour arm, a capsule 760 m wide from the origin to `CITY_ARM` (3300, -3300) on the shore of Kraken
  Mare. `cityR` is defined so `cityDist - cityR = citySdf`, which is what every existing "inside the city / how far
  past its edge" test uses; terrain flattens inside and rises over 1400 m outside. Sea lies about 2 km south as well.
- **Districts** (`zoneAt`): financial core in the middle (r < ~480 m), the neon strip along the east-west avenue at
  z of about 40, then by compass bearing: old town and the Assembly Hall north-east (0-115 degrees), dorms south-east
  (115-205), Chinatown south-west (205-290), crystal gardens north-west (290-360); industry then the spaceport along the
  arm. Borders wobble by up to 25 degrees of noise.
- **Placed landmarks**: `PYRAMID_CELL` (the one Lumen pyramid), `PAGODA_CELL` (the one pagoda), `GIANT_BLOCKS` (the
  ringed spire at big block (0, -1)), the Hive (below), the Hall (big block (3, -4)),
  and in the wild `STONES_AT` and `TREEHOUSE_AT`, north-north-east where the story's fliers go. Lattice towers only
  in the core and old town, Ferris wheels and markets only on the strip (and markets in Chinatown), rarely.
- **District forms** (`computeBase` in world.js; the shader builds whatever the cell table says):
  Lumen, the financial core, is severe (full-footprint stepped slabs 70-120 m, style value under 0.4, no crowns,
  almost no signs); Chinatown is tight (low blocks filling their lots, 12-30 m, no crystal or cylinder towers, more
  market stalls) and steamy (fog up to 2.2 times denser at street level there, `MAPCAM.steam` in main.js); the old
  town has a civic axis, an open avenue of reflecting pools (cell flag 32) along x = 728 from the core to the
  Assembly Hall between unbroken rows of 38 m towers, kept free of trees in `treeParams` (place "civic_axis"). The
  avenue code runs before the forest check, or forest cells break the rows. Chinatown's rooftop place takes a roof
  over 20 m (60 m elsewhere): the story needs `roof_3`.
- **The Hive**: the cattle-class pod block, the city's main orientation mark. A patched castle 620 x 420 m and 240 m
  tall centred on `HIVE_C` (728, 1248), on the dorms' outer edge, filling big blocks x 2-4, z 5-6 (`hiveHas`). Its
  north and west faces, the ones the nicer city sees, carry five flashing tokes boards (`hiveBoardC`, `hiveBoard`,
  material 56); the shell is material 55 (patched panels, round pod windows lit by headset flicker). Rules for
  changing it: keep the boards clear of the corner towers (x ±255, z ±150, half 38) and keep annexes on those two faces
  below 62 m, or they cover the text. In `scene.wgsl` it is a giant (`giantHasW`, `giantTop` 272, `giantSDF` via
  `hiveQ`); the traversal bounds it by the block square, not the 80 m circle. `farInfo` case 6 uses `hiveTopAt` for
  the far silhouette; the WebGL fallback draws its blocks as plain 240 m slabs. Place "hive" views it from a Lumen roof.
- **The pod fab and the power beam**: big block (5, 5), beside the Hive (`FAB_C`, `fabHas` in world.js; `isFab`,
  `fabSDF`, materials 57/58/59/63 in scene.wgsl): sheds, a pod yard, cooling towers, and a 100 m tower with the
  receiver cup. `beamFx` draws the beam from the orbital station down to the cup (`BEAM_B` must equal the normalised
  `BEAM_DIR`), its lit patch in the cloud deck at 1.5 km, and the station's glint where the beam meets the sky. Place
  "fab" looks down on it from the Hive's battlements. Big block (3, 3) had a stale megatower in `giantHasW` after
  world.js dropped it; world.js and scene.wgsl must list the same giants.
- **Places of worship** (`historic()` in scene.wgsl, the branch `c.v < 0.78`): a quarter each, by `c.s`, of mosques
  (hall, drum and dome, semi-domes, two minarets at diagonal corners, 1.95 times the hall height, with a balcony and a
  cone cap), cathedrals (steep nave, twin towers with spires), Orthodox churches (round apse, onion domes made as a
  smooth union of a sphere and a cone) and the old nave-and-spire church. The mosque and the cathedral are checked in
  a render. The Orthodox form: a bulbous green dome with a small tip on a yellow drum was seen from
  `CAM=-239,48,489,-2.356,-0.38` (towards cell (-12, 16), which world.js says is kind 2), but too small to be sure
  it is not the mosque's dome. Find kinds with `cellAt` in Node: `typ === 2 && v < 0.78`, kind `floor(s * 4)`.
- **The Warmhouse** (`BUB_C`, `bubbleAt` in world.js; `bubbleC`, `bubbleSDF`, `traceBubble`, `bubbleFx`, materials
  71-75 in scene.wgsl; hit kind 8): a 170 m bubble of warm Earth air over the city's west edge, centre about
  (-1650, 300, 520), drifting a few metres, on four tethers. Inside, a deck at 95 m under the centre: timber boards,
  a lawn ring with trees, a paved square with bulbs on a wire, a ring of stucco houses and the club dome in the middle.
  `bubbleFx` draws the membrane (Fresnel sky reflection, an oily film, a warm tint seen from outside); `fogApply`
  takes the part of the ray inside the sphere out of the haze. `bubbleAt` and `bubbleC` must drift the same, or the
  pick (a ray-sphere test in `pickAt`) misses. Places "warmhouse" (the square) and "warmhouse_below" (from the land to
  the west). Why it floats: see "Sound and lift in two airs" below.
- **Tube structure** (`tubeStructTrace`, `tubeStructSDF`, materials 64-66): a junction drum on a column at every
  crossing of two street lines, and at some crossings (`tubeStation`) a station with a glazed drum, a TUBE sign and a
  glass lift shaft. Traced analytically along the x street lines (every crossing lies on one), not marched, so it
  costs little; the SDF is only for normals and occlusion (hit kind 7). A pylon at mid-block was tried and taken out:
  the street places' cameras stand 3.6 m from the street centre at mid-block, right where it stood.
- **Skyboats** (`skyboats` in main.js, `shipSDF` / `traceShips` / material 70 in scene.wgsl): eight craft on fixed
  routes (`ev.ship`, `ev.shipDir`, EVN floats 144-207, so the EV buffer is 832 bytes): a cargo zeppelin between the
  spaceport and the fab, the emigration ad dirigible round the core, three skyboats (old town, Chinatown, the
  dorms), two balloon gliders, a hover barge along the strip. Traced like the blimp: a bounding sphere, then a march;
  a hit is kind 4 with `c.x` = ship index + 1 (0 is the blimp).
- **Holograms** (`holoFx`, after `tubesFx`): five camera-facing projections with a ground beam: a spinning toke coin
  over the Hive, a headset face, slogan panels over the strip and the dorms. Stubbed in the lite variant.
- **Lettering**: `tools/tables.mjs` draws the glyphs (ASCII art) and lists the words, and writes `src/tables.js`;
  edit the tool, never the output. `tools/assemble.py` puts `tables.js` first in the page. (A stale copy of the table
  once sat in `main.js`; the GPU buffer came out too small for the grown `struct TB` and nothing drew.) The letters
  are square capitals in the style of a ZX81 screen, drawn for this project, and `neonText` draws each cell as a solid
  square so strokes join (it used to be a dot matrix). Glyph ids: A0 B1 C2 D3 E4 F5 H6 I7 L8 M9 N10 O11 P12 R13 S14
  T15 U16 V17 W18 X19, digits 20-29, katakana 30-36, G37 Y38 J39 ?40 K42, katakana for toki pona 44-60 (ラ is 31, テ is 35); 64 slots. Words are referred to by index in
  `scene.wgsl`, so append new ones only, and grow `struct TB`'s `word` array to the count the tool prints.
- **Posters**: `posterLine(kind, line)` gives up to four words per line; kinds 0, 1, 7, 8, 9 are the government's
  emigration campaign, 2 and 3 the cult, 4-6 the tokes trade, 10 the Org's sign-off jobs, 11 exo hire, 12 the
  Asters in toki pona written in katakana (オ タワ ムン, o tawa mun, go to the stars; コン セリ, kon seli, warm air;
  ヤン スノ, jan suno, people of the sun; the language's own name, once a third line, was dropped by the owner in
  September 2026 and its word slots 95 and 96 hold spare copies), silver on black with a cracked star in the corner; it is also one slot in five on the Hive's boards
  (the place "hive" shows it). Posters on megatower screens and billboards are hard to find in a render; to check
  a poster kind, force it on the Hive boards (material 56) for one debug build. `posterPick`
  sets the mix (emigration half the time) for megatower screens and the 60% of billboards that show a poster;
  `posterLook` is the shared style for each kind (government blue with a red band and a small Earth; a pale screen
  with a grey chequered border for the Org). The blimp and the strip hologram run the emigration lines; an Earth
  hologram turns 440 m over the core. Keep a line to about 12 characters: the boards are sized for that.
- **Map** (`src/map.js`, Menu > City map): districts, water, forest and highland sampled once from `world.js`
  (about 150 ms), north (-z) up, framed on `MAP.cx, MAP.cz, MAP.R`; landmarks from `mapMarks()` (keep it in step
  with the placed landmarks); your arrow from `MAPCAM`, which `main.js` fills each frame. Under it the same in words
  (district, then each landmark's distance and compass direction), for screen readers. Tapping a landmark hops to its
  place. A global `canvas {position: fixed; inset: 0}` rule in `head.html` catches every canvas: override it.
- **Places**: `buildPlaces` in `tales.js` adds the placed ones directly; its ring scans sample cells and can miss a
  single one. `node tools/bakeplaces.mjs` fails if a place the story uses is missing: run it after any change here.
- **Map for thinking**: an ASCII map of zones, liquid, forest and highland from `world.js` in Node (load it with
  `new Function(src + '; return {...}')`, sample `terrainAt`, `cellAt`, `cityDist`, `cityR`) is the quickest way to
  see a layout change before rendering anything.

## Art direction (owner-endorsed, September 2026)

From two outside reviews the owner agreed with. Read before adding anything visual.

**Stop adding new visual motifs.** The city has more than enough vocabulary. The next gains come from composition,
rarity, spatial organisation, material consistency, weather interaction and authored geography.

1. **One dominant idea per view.** Each district: one dominant visual idea, two supporting motifs, and a lot of
   ordinary fabric. Weirdness has value only against the ordinary.
2. **Rarity makes landmarks.** One ringed tower seen across half the city is geography; many ringed towers are
   noise. Same for crystals, pagodas, dishes, giant trees.
3. **Accumulated, not generated.** Repetition shows the generator (the banded cylindrical towers most of all). Prefer
   asymmetry: rebuilt blocks, one-off additions, utility structures, bridges, small things attached to big ones.
4. **Scale anchors.** Storey heights, windows, lamps, railings, vehicles and people make big things read as big. Keep
   the vertical scale; it is one of the strongest features.
5. **Street level needs more density than altitude**: signage, awnings, pipes, doors, cables, steam, snow drifts,
   puddles, parked drones, heat shelters.
6. **Timing gives scale.** Snowflake 0.1-1 s; small flier gesture 0.2-0.8 s; Pip manoeuvre 0.5-3 s; local vehicle
   2-10 s; airship 10-60 s; weather 30-180 s; sky minutes. If everything moves at one speed, scale collapses.
7. **Anticipate and settle.** Things signal before they move (a flier banks before it turns) and do not stop all at
   once (roll settles, snow keeps streaming). Ease almost everything; keep a few things abrupt for contrast.
8. **Arcs, not rails**, for organic motion and assisted camera moves.
9. **Secondary action has a budget**: per view, one primary action, one or two secondary, ambient texture.
10. **Exaggerate what is Titan and the story**: heat against cold, dense slow air, low gravity, methane weather,
    enormous distance, small fragile warmth, Saturn's size. Do NOT mainly exaggerate neon, rings, crystals, glow.
11. **Atmospheric perspective before blur**: with distance, lower contrast, saturation, emissive strength and fine
    detail; keep silhouettes clean.
12. **Light states need depth planes.** Night works (cyan infrastructure, warm windows, pink fliers, deep blue air).
    Day pushes everything into one honey-brown range; foreground local colour and contrast must survive the orange.
13. **Restraint with the sky**: Saturn, airships and searchlights are events, not wallpaper. Occlusion, haze and time
    of day should ration them.
14. **Appeal test** for every asset family: would someone remember one silhouette of it tomorrow? Wren, the nest, the
    radio, the pagoda, the tea stall and the fliers pass; a generic banded tower does not.
15. **Labels**: give a place name you could tell someone ("Amber Walk, Chinatown"), not drone state.

Done since the reviews: districts by form, the map, the tube structure, settling snow, the camera assist, daylight
depth planes, accretion and street clutter, heat shimmer (sections below). Still open: clouds as weather masses
rather than floating props; restraint with Saturn in the sky.

### Camera assist (`src/assist.js`, September 2026)

In free flight over the city a quiet cinematographer picks a subject ahead every half second (landmarks, megatowers,
the tallest Life tower; within 70 to 1600 m, within about 37 degrees of the heading, in clear sight by `pickClear`,
scored by apparent size, with a 1.6 bonus for keeping the current one) and turns the VIEW, never the drone: at most
0.15 rad of yaw toward putting it on a third, 0.12 rad of pitch toward its upper part, eased over about 1.5 s, a
third as much while you steer. It levels the horizon while cruising (roll target times 1 - 0.6 level) and puts the
lens on the subject while it is near the middle, with the lens kept deep (flight strength), not the story's
shallow focus. Menu > View > "Camera assist in flight" (`drift.assist`). Checked in the Dawn runner (`LOGEXPR`):
it took the Lumen pyramid, eased to 0.02 rad of yaw and -0.08 of pitch, and let go when the pyramid left clear sight.

### Daylight depth planes (September 2026)

Owner: "better contrast in daylight, which is mostly one honey-brown now". Two changes, both scaled by a day factor
from `u.windows`: a cool fill light in the shade (`lightSurf`: lit faces warm, shaded faces cooler), and in the
composite pass near things (40 to 700 m) keep more colour and contrast while far things (400 to 1100 m, not the
sky) lose some colour into the haze. The Amber day sun is a little less orange. Compared in Dawn renders at
civic_axis and roof_0 before and after: the near towers keep their gold and the windows their cyan; the far city
greys into the haze. A first, weaker version changed almost nothing visible.

### Accretion and heat (September 2026)

- `accrete` (scene.wgsl) on plain box buildings: a doorway cut in, a canvas awning with a valance, two wall units, a
  drain pipe on the corner (all on one face chosen by the cell's hash), and on one tower in eight a floor gutted to
  its core with corner columns. All inside the proxy box (footprint + 0.6 m), so the proxy pass and the flight
  heights stay right. Materials 76, 77, 78. In the shading, one glass tower in three has a band of floors rebuilt in
  concrete with small windows, and one pane in sixteen is a mismatched replacement. Seen close up in a Dawn render:
  the doorway and wall units show clearly; the awning is a thin band from eye level.
- Heat shimmer (`heatShift`, post.wgsl): pixels are displaced by a rising noise in proportion to the warm light just
  below them on screen (from the bloom texture), for things within about 450 m. Compiles; not yet judged in a
  render (the runner's night switch does not finish while the clock is frozen).

## A hidden tab (September 2026)

Owner asked whether forgotten tabs keep running. The browser stops `requestAnimationFrame` in a hidden tab, so no
frames are drawn and the GPU is idle; timers are slowed to about one call a second, later one a minute. The Web
Audio oscillators (wind, drones, brass) and the tour's narration do NOT stop by themselves. `guide.js` ends with a
`visibilitychange` handler: hidden suspends the AudioContext and holds a running tour (quietly, like the menu);
shown resumes both, the tour from the start of the stop's words. It restarts only what it stopped: a tour the reader
paused, or sound the reader turned off, stays so. Tested in a Node harness with a fake document and AudioContext
(`/tmp`-style scratch, not committed); not tested on a phone.

## Size and the lite variant

`scene.wgsl` is an ubershader of about 4,700 lines. Some mobile drivers fail to build it; the page then retries with
`?lite`, which replaces the bodies of `pedQ`, `laneQ`, `propSDF` and others with stubs (`main.js`, `stubFn`). New
helper functions that only a stubbed function calls stay in the shader unused, which WGSL allows. Keep additions
small, and keep them inside functions the lite list already stubs where possible.
