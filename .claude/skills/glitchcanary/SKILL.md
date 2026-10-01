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

Test on a phone-sized screen: `inklet/finkapp/test/e2e-larkspur.mjs` (390 x 844, touch) plays the solving
path and checks media, 44 px tap targets, posters and sideways scroll; `SHOTS=dir` saves a screenshot per step.

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
