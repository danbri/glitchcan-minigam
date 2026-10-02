---
name: glitchcanary
description: Glitch Canary story and game content — authoring .fink.js stories (Hampstead, Bagend, TOC, world-between-worlds), episode linking, minigame placement (# MINIGAME:), the Robbin game and its tube data, and content-side conventions. Use when writing or editing story content, wiring episodes/minigames into the TOC or stories, or working on magpie/robbin gameplay/content. NOT for platform mechanics — that is the fink skill.
---

# Glitch Canary content skill

Content owns all the names: stories, stations, songs, splash copy. The
platform (fink skill) owns none of them. When a feature needs both, the
platform grows a slot and the content fills it.

## Authoring stories

- Choice presentation (spec §4): a beat offers a HAND of ~3 verb
  choices; nuances fold under verbs via `# CHOICE: nuance # GROUP: x`;
  big enumerations declare `# VIEW: list` on the knot; `# NEEDS:` shows
  a gate instead of hiding it. Hints optional, flat list is the truth.

- Read `inklet/INK-GOTCHAS.md` before writing Ink. The big one: `//` in a
  tag value truncates — escape absolute URLs as `https:\/\/...` (only two
  exist, both in toc.fink.js:269,283).
- File shape: `oooOO`...`` tagged template, knots as `=== name ===`,
  `_`-prefixed knots are private (not deep-linkable). `# PUBLIC:` marks
  cold-entry respawn points.
- Tags in use: `# IMAGE:`, `# VIDEO:`, `# BASEHREF:`, `# FINK:` (loads
  another story — breaks the Continue loop), `# MINIGAME:`, `# AUDIO:`,
  `# FOLEY:`, `# STOP_AUDIO`, `#BG:#hex`, `#CLASS:info|danger|...`,
  `# IMPORT:` (variables), `# RESTART`.
- Media: BASEHREF + relative paths (the Bagend pattern); static files
  only, no responsive-image JS.
- The platform injects `_inventory` (with diamonds/mega_diamonds/keys/
  score) into every story — you may divert to `-> _inventory`, but then
  your story only compiles inside the player (validators stub it).
- Validate: `cd packages/gcfink && npm test` runs the whole corpus;
  `node inklet/validation/checkfink.mjs` for individual files.
- Interpolation is `{var}`, NOT `${var}` — a `${...}` inside `oooOO` is
  evaluated as JavaScript at capture time and throws ReferenceError
  (this silently broke test-variables.fink.js for months).

## Generated pictures and video with the same people in every shot (October 2026)

Larkspur Falls (`cozyverse/larkspur.fink.js`) was made this way, through the ElevenLabs creative tools.
Its record is `cozyverse/larkspur/bible/`: `characters.json` (each person's look and wardrobe, as strings),
`prompts.json` (model, flow node, references and credits for every file), `sheets/` (the character sheets).

The method that held faces steady across 12 stills and 3 clips:
1. Write each person as two fixed strings (look, wardrobe) and paste them word for word into every prompt.
2. Make one character sheet per person first (gemini-3-pro-image, four views on a plain background).
3. Make every still on the same flow with the sheets of the people in it wired in as references
   (`connect_from`). Describe each person again in the prompt by hair, coat and so on, so the model can match
   prompt to sheet.
4. Make video from a still as the start frame (kling-3-pro, 5 s). The clip keeps the faces of the still.

Measured prices (October 2026; ask with `estimate_only` first, prices move):
- a sheet or a still with no reference: about 1,218 credits ($0.27); each reference sheet adds about 609
- a 5 s Kling 3.0 Pro clip at 1080p with sound: about 5,090 credits ($1.12), so about $0.22 a second
- the whole six-scene pilot: about 56,300 credits ($12.40) for 7 sheets, 12 stills, 3 edits and 3 clips

What the models do not do, and the fix:
- Small exact details in a picture (a 7 with a bar through it, a clock at a given time) come out wrong, and an
  edit pass (gpt-image-2) often does not fix them. Check every detail that a clue depends on by cropping at
  full size. The barred sevens in Larkspur Falls were drawn on by hand with Pillow, at measured pixel
  positions; the clock came right on one edit.
- Each clip's master is about 10 MB at 1924 x 1076. Scale it to 960 px wide (H.264, CRF 26, `+faststart`):
  about 0.5 MB.
- Give every local `# VIDEO:` a `poster=` picture (the start frame does well). Phones do not load video ahead,
  and without a poster the beat opens on a black box.
- Brand marks can appear on clothes (a work-jacket logo appeared on Wes). Look for them before publishing.

Owner's verdict on the result (October 2026): the TV-style clips were "bland and inconsequential and barely worth
hitting play. Nothing happens in it", and $200 for 15 minutes of that is too much. A clip of ambient motion (snow,
a turn of the head, steam) is not an event. The direction since: the graphic-novel page.

### The graphic-novel page with voices (October 2026)

Sample: `cozyverse/larkspur/novel/festival.html`, the accusation as one `<novel-page>` (the drift-city skill, "Novel
pages"), four inked panels, two of them loops, eight voiced lines with two takes each. About 13,400 credits ($2.94).
- Panels: gemini-3-pro-image with the character sheets as references and the inked style string in
  `bible/prompts.json` (`novel_page.style`). The faces held. The model sometimes draws its own panel border or splits
  a panel in two; crop the border off.
- Loops: kling-2.5-turbo ($0.47 for 5 s, less than half the price of Kling 3.0 Pro per second) with the SAME picture
  wired to `start_frame` and `end_frame` (`creative_add_flow_node`, then `creative_connect_flow_nodes` with
  `target_port: "end_frame"`, then `creative_run_flow_nodes`): the loop closes without a jump. One event per loop
  (he turns to look at the reader and blinks; the light in the box goes out and comes back), not ambient drift.
- Encode each loop twice: VP9 WebM first and H.264 MP4 second. The Playwright Chromium here has no H.264 decoder,
  so an MP4-only `<video>` stays at readyState 0 in tests.
- Voices: eleven_v3 (audio tags such as [whispers], [drily]) at about 1 credit per character, so one line costs one
  to three US cents. `# voice: <id>` tags in the page's ink; the page plays one take of `media/vo/<id>-N.mp3` at
  random, queues the lines of a step, and cuts them when the reader moves on. Phones play sound only after a tap,
  so the page opens on "Begin, with sound / Begin, no sound". The ink text is the spoken text (subtitles, screen
  readers).
- Prices measured for cheaper video (5 to 6 s, image to video): LTX 2 Fast $0.32 (1080p, sound), Runway Gen-4 Turbo
  $0.33 (720p, silent, needs a start frame), Kling 2.5 Turbo $0.47, Veo 3.1 Lite $0.53, Wan 2.6 $0.67.
- Test: `inklet/finkapp/test/e2e-larkspur-novel.mjs` (390 x 844, touch).

Test on a phone-sized screen: `inklet/finkapp/test/e2e-larkspur.mjs` (390 x 844, touch) plays the solving
path and checks media, 44 px tap targets, posters and sideways scroll; `SHOTS=dir` saves a screenshot per step.

### Photographic pages with layered sound, ten pages (October 2026)

Owner, October 2026: "Every panel must be photorealistic, hyper photorealistic. Drawn art styles induce anti-AI
rage. Every panel needs audio blended into the page bg audio." Sample: `cozyverse/steeplewyke/` (The Marrow Show,
a village murder after Midsomer Murders): ten pages of four panels on ONE `<novel-page>`, one ink story.
- One story, many pages: `marrow.ink` holds all ten; `# page: N` makes `index.html` swap the panels (built from
  `pages.json`: layouts as polygons, panels with their ink knot, picture, sound, loops). Put `# panel: page` on the
  same step, so the view goes to the overview, which needs no panel of the old page. Clue VARs then carry across
  pages with nothing passed in the URL.
- Sound is three Web Audio buses: a 22 s looping bed per page, a 10 s looping sound per panel that fades in over
  the bed while that panel is in view (`panelchange`), and the voices, which duck both to 35 %. All from
  eleven_text_to_sound_v2 with `loop: true` (about 10 credits per second). One AudioContext, made on the
  "Begin, with sound" tap.
- Several loops per panel: every loop of a panel starts and ends on the panel's still (kling-2.5-turbo, the still
  on `start_frame` AND `end_frame`), so the page can go from any loop to any other without a jump. Two `<video>`
  elements take turns; the waiting one must stay at frame 0, because novel-page plays every video in a panel
  after a tap.
- Photographic people: gemini-3-pro-image character sheets first (four views, plain background, "not a painting,
  not an illustration, not CGI"), then each panel with the sheets of its cast wired in, in cast order, and each
  name in the prompt replaced by "the person in reference photograph N (<look>)" (`tools/prompts.mjs`). 1,218
  credits a panel plus 609 per sheet. The faces held across all 40.
- Small exact things still fail and must be looked at, not assumed: "green-striped marrows" came out as
  watermelons; a notebook page came out as two lines of scribble; a painted thermometer scale came out in the
  wrong order twice. gpt-image-2 edits fixed the first two (about 420 credits each) but RETURN 16:9 whatever the
  original shape, so the panel needs a crop point (`focus` in pages.json); the scale needed a fresh gpt-image-2
  picture, and then the story text was changed to say what the picture shows.
- Voices: `voices.json` lists every voiced line; `tools/lines.mjs` walks the compiled story with the Story API (each
  knot with every clue on and off) and `--check` fails when the file and the ink differ. A line that starts
  "Name:" is spoken by that person; the page shows the name as a small label.
- Revision 2, after the owner played it twice: "very linear ... almost identical routes". Measured: 40 of 56 stops
  offered ONE choice, the clues were on the main path, and every accusation led to the same ending. The fix was ink
  only, on the same pictures: after the body, a hub of inquiries (four visits of five places, any order, the page
  of each place reused); the ORDER changes what is found (the vicar has been in the study if you go to the
  vicarage first); each interview allows one question; an `evidence()` function decides whether an accusation
  holds, and four endings change page 10's lines. `tools/walk.mjs` plays 2,000 random readings with the Story API:
  no dead ends, 400 page orders and 1,998 different texts, where before there was one page order. Measure it this
  way before calling a story branching.
- Voices revision 2: the first recording had no audio tags ("flat", the owner said). `tools/directions.py` gives
  every line eleven_v3 tags (a default per speaker, 118 lines their own); voices.json keeps the shown "text" and the
  spoken "say" apart, and the check compares only "text". Narration voices sound flat in character parts: Toby and
  the vicar moved to character voices. Gerald's tannoy lines get an ffmpeg loudspeaker filter
  (`tools/voices-post.sh`). Takes are mono at 96 kbit/s (the first set was 64, chosen for size alone).
- Version 2 lives at `cozyverse/steeplewyke/v2/` (owner: "save it at new v2 url"); version 1 is left exactly as
  merged, and v2 shares its pictures, sounds and longer loops through `../media/`. A page one folder deeper needs one
  more `../` on its script paths: the first v2 run loaded neither the ink engine nor novel-page and showed nothing.
- Short ambient loops (owner: "tiny loops like one or two seconds ... leaves waving slightly ... better than a
  ridiculously animated scarecrow at a bar"): a Kling clip from the still with NO end frame, then the first 0.8 to
  1.6 s played forward and back (`tools/tiny-loop.sh`), so it starts and ends on the still. About 100 to 230 kB each.
  Kling keeps the still's own shape (2208x936 for a strip), so keep it on encoding. Measure each clip's change from
  its first frame before using it: the bar clip walked a man into the frame and was dropped.
- The village memory: `rel_<who>` in the story, kept by the page in localStorage under
  `cozyverse.steeplewyke.village` (one key for every Steeple Wyke episode); `was_<who>` is the value when a reading
  began, so reactions answer an earlier reading, not a choice made a minute ago. `# memory: <who> <+n> <sentence>`
  shows the sentence as a notice and saves.
- ElevenLabs, October 2026: the account quota is 300,000 credits a period, and it ran out mid-recording. eleven_v4
  takes the same tags as v3 (not `[beat]`: use `[short pause]`; stage directions such as `[grinning]` are not
  performed) and was priced at 0 credits while v3 and Kling were refused. Check a price with `estimate_only` before a
  long run.
- Tests: `e2e-steeplewyke-v2.mjs` (v2, with the hub, memory and double tap) and `e2e-steeplewyke.mjs` (v1). (390 x 844, touch): the solving path through all ten pages, a
  voice after every choice, each page's bed, a tap bringing in a panel's sound, a loop going on to another loop.

## The story map

- `inklet/toc.fink.js` — main menu; episode knots carry `# FINK: <path>`
  then a choice. External episodes use escaped absolute URLs.
- `inklet/hampstead.fink.js` — 627 lines; hub knot `street` (~82-99) with
  compass exits (jobcentre/oxfam/pub/gallery); endgame `victory`;
  multiverse hub `world_between_worlds` (~501-521, also standalone file)
  with pools diverting to other stories. Islands (postoffice, estate,
  pool_*) are intentional cross-episode seams.
- Minigame invocations live in: toc (battleboids, gridluck),
  world-between-worlds (gems/mudslider/battleboids/gridluck arcade),
  shane-manor (chess), mudslidemines (mudslider mode=cave), demos.
- Convention after a minigame: divert to a return knot and react to the
  variables it wrote (`{diamonds >= 5: ...}`).

## Robbin (magpie/robbin) — the flagship widget game

- Two episodes: PILOT (arcade) and UP THE JUNCTION (cosy tube flock).
  Title: "kulupu waso tawa". Real TfL data: 336 stations, 14 lines
  (incl. full Windrush, Elizabeth core, DLR) in `tube-network.js`; real
  FOI depths in `tube-levels.js` — Hampstead is the deepest (58.5 m),
  which is the thematic bridge to the Hampstead story.
- Audio: `<robbin-jukebox>` element owns everything; ROBBAMP (27 viz
  modes) and the map's gold discs are views. 24-track tape library via
  `tools/ingest-audio.mjs` (sha256 dedup; per-station files named
  `<station-slug>-<track-slug>.mp3`; no git-LFS ever).
- Konami: credits reel + unlocks 🛸 TELEPORT (triple-tap hop, free
  slide). Finale ("UNFLOCKABLE…") fires from ANY station exit at 7+
  birds via `maybeFinale` — never regress this to one exit path.
- Headless playtest hook: `window.__robbin.game`; scratchpad test suites
  cover map, jukebox, amp, finale, teleport. Run affected ones after any
  gameplay change. KNOWN FLAKE (verified 2026-07): test-robbin2's `.lift`
  riding check fails ~2/3 under heavy machine load on the UNCHANGED
  baseline — before blaming a change, stash and re-run the baseline.
- Owner rules: NEVER edit credits or owner-personal content without
  being asked (standing incident); Bristol tree memorial fields are
  off-limits repo-wide; no TfL branding (roundel) in game art.

## Wiring a minigame into a story (current live path)

1. Package under `inklet/minigames/<name>/` with `index.html` (+
   `manifest.json`: variables read/write, features). A guest that lives
   beside its own content instead names its page with `url` in step 2.
2. Register: ONE row in `inklet/finkapp/foafos-apps.js`,
   `surface: 'stage', game: '<name>'`, with capabilities, `desc`,
   `controls`, and `silent` if it makes no sound. The stage host reads
   that row; there is no second list. An unregistered name is refused.
3. Invoke from Ink: `# MINIGAME: <name> mode=<m> controls=<dpad|lite|none>`
   then divert to a return knot; read the variables the game wrote. An app
   may take more keys, listed in its registry row's `args`:
   `# MINIGAME: drift tale=peraspera` (Drift City on that story),
   `# MINIGAME: talkinghead line=mags-3 mood=wry` (a recorded line spoken by
   that cast member's face). Values are plain tokens (letters, digits,
   `. _ : -`); an unlisted key is dropped and reported, not passed on. The
   story-game-sync skill has the rules; `drift-city/foafos-entry.fink.js` is
   an example quoting only the owner's lines.
4. Remember: guest iframes have opaque origins — ES modules/fetches need
   CORS (fine on GitHub Pages, needs a CORS server locally), and
   localStorage THROWS there — shim it (robbin.html head shows how).
5. **GIVE THE GAME A WAY OUT THAT IS INSIDE THE GAME.** The shell can
   always stop a guest, but a reader who wants to leave should be able
   to WALK out. Skydock's car rank is the pattern: the world already
   showed NPCs hailing cars away all shift, so the exit needed no
   explaining — stand at the kerb, jump, ride up, and the game posts
   `complete` with its variables. Two rules learned building it:
   - **An exit nobody is told about is not an exit.** The story names
     it in the beat before the `# MINIGAME:` tag ("the car rank down by
     the bakery runs a shuttle back up here").
   - **The way out must work in BOTH lives.** The same game runs
     standalone; there the car returns the player to the title card it
     came in from. Whatever the guest came from is where it goes back.
6. Reactions to minigame results go BEHIND a choice in the return knot,
   and the MINIGAME tag goes INLINE on a text line — a bare tag line
   attaches forward through the divert and the destination's first line
   (with any conditionals) evaluates before the game runs. INK-GOTCHAS §8.
7. Worked example: hampstead_tube/tube_return in hampstead.fink.js;
   full-loop test: node inklet/finkapp/test/e2e-robbin.mjs.
8. **A WORLD IS NOT A MINIGAME.** When the game is the place where the
   story happens and should follow it as you read, put
   `# WORLD: <name>` near the top of the story (after `# title:`), not a
   `# MINIGAME:` in a knot. The story does not pause; after every step the
   foafos runner sends the world the tags it does not handle itself
   (`scene`, `place`, `time`, `voice`, `speech`...). The world writes back only
   the VARs its registry row lists, so declare them (`VAR here = ""`), and
   keep a text route for anything found only in the world
   (`{not in_world and not voucher} [Look around]`). The world may move the
   story in one way: after setting a clue VAR it may ask the story to
   re-enter the scene your last `# scene: <knot>` named, so give each scene
   knot its `# scene:` tag with the knot's own name. Spec §5.8; the
   story-game-sync skill, model C; example
   `drift-city/story/peraspera.fink.js`, opened from the hub as a dream
   (`# FINK: story/peraspera.fink.js # LINKREL: goDeeper`) so its end comes
   back to the hub.
