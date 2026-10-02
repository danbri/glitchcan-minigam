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

Live: https://danbri.github.io/glitchcan-minigam/cozyverse/steeplewyke/v2/ (v1 kept at `cozyverse/steeplewyke/`).

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
- Spending without a ceiling: the account quota is 300,000 credits a period and ran out mid-recording. Price runs
  with `estimate_only`; Kling was refused while v4 still worked.

## A chapter, measured

Steeple Wyke chapter one (ten pages): about 166,000 credits for v1 (40 panels, 30 event loops, 50 sounds, 260 v3
takes) plus about 20,000 for v2 (nine short-loop clips); the v2 voices were free on v4. A second chapter that
reuses the sheets, makes 40 panels, about 10 short loops and 50 sounds, and records v4 voices: about 100,000
credits. The ink for a chapter is about 900 lines.
