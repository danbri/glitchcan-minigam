---
name: photo-novel
description: Make and extend the photographic graphic-novel stories in cozyverse/ (Steeple Wyke, the Larkspur festival page) — pages of panels on <novel-page> with an ink story, layered sound and voices. Covers the ink patterns that keep a tap-driven story honest (hub of inquiries, causal guards, briefs on return, loop noticing, the village memory, endings), the media pipeline that worked (photographic character sheets, panels with references, gpt-image-2 fixes, Kling loops and short forward-and-back loops, sound beds, directed eleven_v4 voices), what each costs, the tools that check it all, and the list of things that failed. Use this when writing a new chapter or page, changing marrow.ink or a page host, generating or fixing pictures, loops or voices for these stories, or estimating the cost of a chapter. Prose rules are the nocliches-fink-authoring skill; the component itself is the drift-city skill's "Novel pages".
---

# Photographic novel pages (cozyverse)

Owner's brief, October 2026: "Every panel must be photorealistic, hyper photorealistic. Drawn art styles induce
anti-AI rage. Every panel needs audio blended into the page bg audio ... aim for brit cosy mystery cf Midsomer
Murders." Then, after playing it: "very linear"; "voices sometimes v flat"; "tiny loops ... better than a
ridiculously animated scarecrow at a bar"; "some scenes flicker visibly as it loops"; a still in a vivid pose makes
a reader "squint and wait to see if it is a looper"; and the standard: "hit all the cosy archetypes while still
having moments of genuine curiosity, creativity, humour and humanity. Showing we know the clichés is not enough."

Live: chapter 1 https://danbri.github.io/glitchcan-minigam/cozyverse/steeplewyke/v2/ (v1 kept at `cozyverse/steeplewyke/`);
chapter 2 https://danbri.github.io/glitchcan-minigam/cozyverse/steeplewyke/ch2/ (tools take `STORY=ch2`).

## The format

- One page = one `<novel-page>` of four polygon panels on a 1080x1520 page (three layouts in `pages.json`). One
  HTML host plays all pages of a chapter; one ink file holds the whole chapter.
- `# page: N` swaps the panels (build them from `pages.json`, put `# panel: page` on the same step so the view goes
  to the overview, which needs no panel of the old page). `# panel: knot` moves the view; a tap on a panel diverts
  the story to that panel's ink knot. Name knots `p<page>_<panel>`; panel ids in the DOM need only be unique per
  page.
- `# voice: id` plays one of two takes (`media/vo/<id>-<k>.mp3`); a line starting `Name:` is spoken by that
  person (the host shows the name as a small label; the voice list strips it).
- Sound is three Web Audio buses: a 22 s looping bed per page, a 10 s looping sound per panel that fades in over
  the bed while that panel is in view (`panelchange`), and voices that duck both to 35 %. One AudioContext, made on
  the "Begin, with sound" tap (phones need a tap); keep the Begin buttons disabled until the story has compiled
  (on the live site a tap before that did nothing).
- A version gets its own folder and shares media up a level (`v2/` uses `../media/`); one folder deeper means one
  more `../` on the script paths (v2 first loaded neither ink nor novel-page).

## Ink patterns (each one fixed a real defect)

- **Not a corridor.** Measure before calling it branching: v1 had 40 of 56 stops with ONE choice, every clue on the
  main path and one ending. v2: a hub of inquiries after the body (four visits of five places, any order, each
  place a page), the order changes what is found, each interview allows ONE question, `evidence()` decides whether
  an accusation holds, four endings change the last page.
- **Taps break order.** A tap can reach a panel before the scene it depends on (Margaret talking about Gerald's
  flask before anyone has told her he is dead). Every dependent knot starts with a guard to the scene it needs:
  `{p3_margaret == 0: -> p3_margaret}`. The guard's `# panel:` wins, so the view goes there too.
- **Briefer on return.** A page's overview read again gets one short line (`{p3 > 1: ...}`); a third return makes
  Quaile say "We've been here, Sam." A conversation revisited gets one line and its choices
  (`-> p3_margaret_choices`, a stitch). The host also skips a voice line that played in one of the last two STEPS (a reader tapping in and out). A
  time window (two minutes) and then "the last three lines" both silenced a genuine "Where next?"; the test caught
  both.
- **Events once per reading.** A memory or clue that a tap can re-enter must be guarded by the knot's first visit
  (`{p4_syringe == 1: ~ rel_dilys += 1 ...}`); the random reader found Dilys warming up on every tap.
- **The village remembers.** `rel_<who>` is a standing kept by the host in localStorage
  (`cozyverse.steeplewyke.village`, one key for every Steeple Wyke chapter); `was_<who>` is its value when the
  reading began, so a person reacts to an EARLIER reading, not to the choice a minute ago. `# memory: <who> <+n>
  <sentence>` shows the sentence as a notice and saves. Small choices matter (waiting for Toby to end his call,
  counting Margaret's foxgloves in front of her); a wrong accusation costs two.
- **The wrong note** (nocliches rule F7) is kept and never explained: the scarecrows move between pages, and the
  last one wears Sam's clothes.

## Media pipeline that worked

| step | how | cost (Oct 2026) |
|---|---|---|
| character sheets | gemini-3-pro-image, four views on grey, "a real photograph ... not a painting, not an illustration, not CGI" | 1,218 credits each |
| panels | gemini-3-pro-image with the cast's sheets wired in cast order, each name in the prompt replaced by "the person in reference photograph N (look)" (`tools/prompts.mjs`); 1K is enough on a phone | 1,218 + 609 per sheet |
| fixes | gpt-image-2 edit for a wrong detail; it RETURNS 16:9 whatever the original, so set a crop point (`focus` in pages.json) | ~420 |
| event loops | kling-2.5-turbo 5 s, the still on start_frame AND end_frame, ONE small event each (a wasp, a rook lands) | 2,121 |
| short loops | kling-2.5-turbo from the still, start frame only; keep the first 0.8 to 1.6 s and play it forward then back (`tools/tiny-loop.sh`), so it starts and ends on the still; 50 to 230 kB | 2,121 |
| sound | eleven_text_to_sound_v2 with `loop: true`: 22 s beds, 10 s panel sounds | ~10 per second |
| voices | eleven_v4 with audio tags, two takes per line; directions in `tools/directions.py` | 0 credits while it was enabled; v3 is ~1 per character |

Encode loops VP9 WebM first and H.264 MP4 second (the Playwright Chromium has no H.264). Voices: mono 96 kbit/s.

## Translations and subtitles

Owner, October 2026: "We need to make translations and subtitles for audio possible", and then, firmly: the voices
stay the English recording in every language ("leave voice english audio! We can't afford 100x the token bill ...
I said SUBTITLES"). An Italian voice sample was made and removed. So a translation is TEXT ONLY:

- `?lang=it` shows the story and the page in Italian (`plainhunt.it.ink`, `lang/it.json`: title, buttons, page
  titles, panel descriptions, the village line) over the English voices; the text is the subtitles. The start screen
  offers "Subtitles: English / Italiano" (`pages.json` `languages`) and reloads with the choice.
- A translation is the story file copied line for line with only the words translated: the same knots, tags, voice
  ids, variables and conditions. `tools/lang-check.mjs it` plays both with the Story API through the same random
  choices and taps and compares tags, choice counts and variables at every step (600 readings, about 30,000 steps);
  it also checks `lang/it.json` has every key. A copy with one voice id changed fails at step 1.
- Take care with the story's own unconventional words. Sam calls serifs "feet" because he does not know the trade
  word; the Italian must not "correct" that to "grazie" (the typographer's term) or render it literally ("piccoli
  piedi", which reads as translated). It is "piedini", the same word in every place it occurs (four lines).
- Other terms (the translator's choices): the treble "la campana più acuta", bells "la uno ... la cinque", the tenor
  "il tenore", rounds "l'ordine di partenza", peal board "la tavola del concerto", "move up one" "scalare di un
  posto"; "plain hunt", "Look to" and "Stand" stay in English. "Not your best" became "Non la vostra serata migliore"
  (the literal "Non al vostro meglio" is a calque).
- Tests: `e2e-steeplewyke-ch2-lang.mjs` (Italian start screen and story, English voice under it).

## Peek panels: one second of material on a longer cycle

Owner, October 2026, about the fly on the marrows: "an enigmatic and slightly sparkly, slightly glitching cheery
yellow canary which is largely in background, just peeps above the marrow every 8 seconds for a second. Use js to
stretch out shorter material to cover that period." A loop cannot do this: a 5 s Kling clip with an event in it
either repeats every 5 s or needs 8 s of footage. The peek holds the still and plays the event on a timer.

1. **Generate** one kling-2.5-turbo clip from the panel's still (start frame only, 2,121 credits) with ONE small
   event in the background. The canary's prompt: "Locked-off close shot of marrows on a white cloth in a marquee.
   For the first second nothing moves. Then a small bright canary-yellow canary pops its head and shoulders up from
   behind the far marrow in the background, looks straight at the camera for about one second with a tiny tilt of
   the head, and ducks back down out of sight. For the rest of the clip nothing moves. The last frame is identical
   to the first frame." (It did not duck back down; step 3 fixes that.)
2. **Measure** with `tools/peek-window.py clip.mp4`. It compares each frame with the first, per cell of an 8x5
   grid, and uses the cell that changes most. The first version averaged the whole frame and found nothing: a
   canary is 1 % of the picture, so its change (5.4 in its cell) was 1.2 over the whole frame, under any threshold.
   It prints `from` (the event starts), `peak` (largest), `to` (back near rest, or null) and `at` (the centre, in %).
3. **Cut** with `tools/peek-clip.sh clip.mp4 v2/media/<panel>-<name> <from> <peak>`: from..peak forward, then
   backward. Kling's canary came up at 0.6 s, was highest at 1.3 s and never fully went down (its head still showed
   at 2.3 s); playing the rise backward makes it go down, and the clip starts and ends on frames that match the
   still. 1.5 s, 54 kB.
4. **Wire** it in `pages.json`: `"peek": {"src", "every": 8, "first": 3, "at": [x, y]}`, with optional `from`, `to`
   (seconds in the clip; default all of it) and `rate`. The host's `peekPlayer` keeps one `<video>` paused on its
   first frame (the poster is the still, so nothing shows), and a `setTimeout` every `every` seconds seeks to
   `from`, plays, and watches each animation frame (not `timeupdate`, about four a second) until `to` or the end,
   then pauses and seeks to 0. It skips a beat when the page is hidden, paused or the clip is not loaded, rather
   than stutter. novel-page plays every video in a panel after a tap, so a `play` outside the moment is undone.
5. **Dress** it: while it plays the panel has the class `peeking`. The CSS gives the video a slight stepped glitch
   (small translate, hue-rotate, brightness) and five small yellow sparks at `at`. Reduced motion: neither.

**Rare, not regular.** Owner, October 2026, after chapter 2 put the canary on three panels every 8 s: "Canary should
be occasional. Rare. Special." Chapter 2's `pages.json` has `"canary": {"mode": "rare", "after": [20, 45]}`: for
each reading the host picks ONE panel that has a peek clip, and the canary shows there ONCE, 20 to 45 s after that
page is shown (the wait starts again if the page turns first); every other canary panel is a plain still that
reading. `?canary=<panel id>` picks the panel and waits 2 s (the test uses it). Chapter 1's marrows keep the
owner's own spec, every 8 s.

Check: `e2e-steeplewyke-v2.mjs` waits for `peeking` on the marrows panel within one cycle, then for it to end with
the video paused at 0. `SHOTS=dir` saves `peek.png`. Look at a crop at the peak frame before using a clip.

## Checking it

- `tools/walk.mjs` — 2,000 random readings with the Story API, a quarter of the moves being taps: dead ends, endings,
  page orders, distinct texts. Run it after every ink change.
- `tools/lines.mjs --check v2/voices.json` — every voiced line found (each knot visited twice under many mixes of
  state, then three times bare), and every voice tag in the compiled story reached; it fails if a tag is never
  reached or none are found (a check that finds nothing passes for no reason; it did, once).
- Before using a clip, measure its change from the first frame (`ImageChops.difference` on frames at 0.4 to 1.6 s)
  and look at a frame sheet: a "still" clip can walk a man into the frame.
- Voice takes you cannot hear: compare each take's seconds per character with the median; a long outlier may be a
  tag read aloud (all four outliers so far were laughs).
- `inklet/finkapp/test/e2e-steeplewyke-v2.mjs` (390x844, touch): the hub route, voices, beds, memory saved and
  reloaded, double tap, briefs, still marks, the loop hand-over.

## Do not

- Drawn or painted styles. Photographs only.
- A hard switch between loop videos at `ended`: it flashes poster or black. Start the next 0.3 s early and
  cross-fade (v2 host).
- Animated people in loops: every bar clip moved the scarecrow's head and arm. Loops move leaves, grass, mist,
  water, a wasp; people stay still.
- A slow CSS zoom on stills: readers wait for it to move. Stills get a soft vignette and no motion.
- Audio tags that are stage directions (`[grinning]`, `[cupping an ear]`) or `[beat]`: v4 does not perform them;
  use `[short pause]` and words for how the line is spoken.
- Trusting small exact things in pictures: marrows came out as watermelons, a notebook page as scribble, a
  thermometer scale in the wrong order twice. Crop and look; change the text to match a picture when that is cheaper.
- Recording voices before the text is final: two roof lines changed after a run and had to be done again.
- Everyone speaking in polished one-liners. Owner, October 2026, on chapter 2's first draft: "I don't think this
  writing will survive critical review." The draft gave every person the same wit (aphorisms, closing quips, a narrator
  who summarises with a joke: "The bells took most of her hearing. A notepad ... does the rest."), and Dr Achebe's
  percentages came back six times. The rewrite: say plainly what a person does or sees, let a character's jokes come
  from what they want in the scene, keep a running gag to two uses, and end a scene on what happens, not on a line.
- Spending without a ceiling: the account quota is 300,000 credits a period and ran out mid-recording. Price runs
  with `estimate_only`; Kling was refused while v4 still worked.
- Calls that are administration, not making things. Owner, October 2026: "be parsimonious with API call discipline
  (do not waste tokens ie money on administrivia; but do not skimp on quality or advanced models)." So: no repeated
  voice or model listings (keep the ids in `voices.json` and this skill), no status polls faster than the
  `poll_after_seconds` the tool gives, one `estimate_only` per batch rather than per item, and no test generations
  of lines whose text is not final. Do use the best model for the job (eleven_v4 voices, Kling for loops,
  gemini-3-pro-image for text fixes); the saving is in the calls around the work, not in the work.

## A chapter, measured

Steeple Wyke chapter one (ten pages): about 166,000 credits for v1 (40 panels, 30 event loops, 50 sounds, 260 v3
takes) plus about 20,000 for v2 (nine short-loop clips); the v2 voices were free on v4. The ink for a chapter is about
900 to 1,100 lines.

Chapter two (Plain Hunt, `steeplewyke/ch2/`, October 2026), measured: 3 sheets 3,654; 40 panels 64,500 (a panel
with N reference sheets costs 1,218 + 609 N, so the group shots are the expensive ones); 7 text fixes 12,790; 50
sounds 6,200; 12 Kling clips 25,452. About 112,600 credits before voices, against an estimate of 106,000 with voices.
**eleven_v4 is no longer free**: 1 credit per character per take, audio tags included. 230 lines are 21,446
characters, so two takes cost about 43,000 credits and one take about 21,000. Price voices with `estimate_only`
before promising a total. Until they are recorded, `voices.json` says `"recorded": false` and the host plays the
sounds without asking for any voice file.

Voices, as done (owner: "Why choose up front?"): record ONE take of every line (230 lines, about 21,300 credits),
check them, and record a second take only where the first is weak; `voices.json` `"takes": 1` plus a `"secondTake"`
list of ids, and the host plays what exists. Check with `tools/takes-check.py <dir> ch2/voices.json --words`: pace
outliers per speaker, then a local transcript of every take (faster-whisper base.en, about 8 minutes for 230 takes,
no credits) compared with the page text. In chapter two no take read a tag aloud or dropped a sentence; the 38
"differences" were the recogniser's spelling of names and numbers (Quail, Gil Sans, 814), so no second takes.

What chapter two taught:

- **Text in pictures is wrong first time, every time** it is more than a word or two: the ringing list came out as
  ARTHUR, MAISIE, GEORGE; the door card said FRESH EGGS; the half-lettered board said THE CROWN; a crisp packet
  carried a real brand. Fix it with a gemini-3-pro-image node wired to the panel's node (`creative_add_flow_node`
  with `aspect_ratio` and `resolution` set: `creative_edit_image` has no aspect field, and gpt-image-2 returns 16:9).
  All seven fixes were right first time. Then change the ink if the picture is closer to the truth than the text.
- **Kling ignores the asked aspect** and keeps the still's shape (2208x936 for a strip, 1292x1604 for 4:5).
- **Kling does not always do the event.** Of five canary prompts, one produced no bird at all (the tower: the bird
  would have been 1 % of the frame); one put the bird in the frame from the first second. Measure every clip
  (`tools/peek-window.py`) and look at a crop at the peak before using it. Of eight "almost still" clips, two broke
  the rule: a bell came down through the ringing-chamber ceiling, and a strip light switched on. Those panels are
  stills now (pages.json `note` says why).
- **Long loops (5 s, still on start and end frame) often move nothing.** Chapter 2, eight takes for four panels
  (16,968 credits): the seams were all clean (first against last frame, mean difference under 1 of 255), but both
  cottage takes and one barn take had no visible motion, and the other barn take moved the man the prompt said to
  keep still (small and natural, so it was kept). Five of eight were used. Run `tools/loop-motion.py` on every take
  and look at the map before encoding; a frame sheet at 2 frames a second is too coarse to show small motion.
  Second round (owner: "not noticing much animation"; fire, rooks and bell were the standard, 0.24 to 0.34 change
  per frame): prompts that say "almost a still photograph" or "very slightly" get exactly that. Name one clear
  primary motion and one or two secondary ones, with sizes ("about forty degrees each way, one swing every two and a
  half seconds"). For a swing, put the seat at its lowest point on the first and last frame, so the start and end
  frame match while it moves. Three cottage takes with the still as start AND end frame moved only the puddles,
  whatever the prompt asked; with the start frame only it moved hard but changed the far end of the lane after
  1.25 s. Measure each region against frame 0 over time to find where the change starts, keep the part before it
  and play it forward then back (`tools/tiny-loop.sh <clip> <out> 1.2`). For a secondary motion that needs a
  source (steam needs a kettle), edit the still first (gemini-3-pro-image node from the panel's node, 16:9, 1,827
  credits; check that only that area changed), then make the clip from the edited still and replace the panel's
  picture and its alt text in every language. Round two: 7 clips and one edit, 16,674 credits, three panels fixed.
- **A guard counts as a visit.** `{p3_band > 1: brief}` with a guard `{p3_quaile == 0: -> p3_quaile}` showed the brief
  on the first real visit after a tap had gone through the guard. Decide "revisited" by a variable set in the scenes
  that matter (`asked_band`), not by the knot's read count.
- **The line finder must try mixes of clues**, not only all true or all false: a line that needs one clue and not
  another (Dilys asked, but no email yet) was never reached. `tools/lines.mjs` now adds 300 fixed random mixes and
  reads the clue names from the story's own variables.
- **A puzzle gets a checker.** `tools/rows.mjs` makes the plain hunt rows from the rule, checks every row the story
  shows against it, and proves the answer is unique (only one silent bell fits Glenys's rows at any place in the hunt).
- Random readers (`tools/walk.mjs`) with an evidence bar of four solved too easily (clues found on the way are
  nearly free); five makes either route (the ringing, or the board) need its puzzle.
