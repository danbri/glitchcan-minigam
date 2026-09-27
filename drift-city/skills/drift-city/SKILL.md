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
- **Next**: physical parts for the walkers (torso and head on springs, swinging packs, cloth capes, feet on the
  real ground), the drone as a collider, and a phone measurement of the cost.

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

## Conway's Life in the round towers (`src/life.js`)

- One 64 x 40 board (64 round, wrapping; 40 floors from the top, dead edges) stepped four times a second on the
  CPU, reseeded every two to four minutes or when it dies or settles: a Gosper gun firing down the tower, a pulsar,
  a pentadecathlon, an acorn, an R-pentomino, glider and spaceship fleets, and small blinkers and gliders all round
  the top rows (most towers are short and show only the top few floors, from one side).
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

- Menu > "Guided flight": the computer flies to seven stops (the ringed spire, the Assembly Hall, the Hive, the pod
  fab, the Chinatown pagoda, the Warmhouse, the spaceport), framing each with `pickLaunch` (the long-press flight,
  clock sped up in mid-flight), and speaks a short plain description as the view comes in (at 62% of the flight).
  The same words are shown as a caption with a Stop button. A touch on the view, a key or the pad stops it and gives
  control back. The WebGL fallback hops to each stop's place instead of flying.
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

## Walking into a scene (`visitMove` in tales.js)

In a story place or a picked view (`NAV.mode === "visit"`) the left stick looks and the right stick moves: up
walks (eye level, under 6 m above the ground: 2.6 m/s, the ground followed, a slow bob) or flies along the view
(10 m/s); left and right turn; W and S do the same. The move is an offset (`V.off`) on the visit, so the place's
props and hotspots stay where they are; a new visit starts at its place again. A step is refused when the height
map rises ahead compared with where you stand (street places stand inside the coarse boxes, so an absolute test
refuses everything), and you stay within 150 m. The pad's labels follow the mode ("Look" / "Walk · turn").
Test: `PADRY=1` in the scratch runner holds the right stick forward; from street_1 the walk stops at the facade
6.6 m ahead.

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
  トキ ポナ), silver on black with a cracked star in the corner; it is also one slot in five on the Hive's boards
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

Open work the reviews name, not done yet: districts told apart by form, not only by building mix (market tight and
steamy, civic centre axial, Lumen severe, forest edge overgrown, dish district sparse and windy); a map in the menu; the tube network's structure (supports, junctions, stations); snow settling on ledges and melting
round warm things (heat as a visual language); clouds as weather masses rather than floating props; day-light tonal
separation; a weak composition assist (candidate subjects ahead, gentle bias of pitch and focus, never a lock-on).

## Size and the lite variant

`scene.wgsl` is an ubershader of about 4,700 lines. Some mobile drivers fail to build it; the page then retries with
`?lite`, which replaces the bodies of `pedQ`, `laneQ`, `propSDF` and others with stubs (`main.js`, `stubFn`). New
helper functions that only a stubbed function calls stay in the shader unused, which WGSL allows. Keep additions
small, and keep them inside functions the lite list already stubs where possible.
