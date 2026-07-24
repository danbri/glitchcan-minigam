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
  gameplay change.
- Owner rules: NEVER edit credits or owner-personal content without
  being asked (standing incident); Bristol tree memorial fields are
  off-limits repo-wide; no TfL branding (roundel) in game art.

## Wiring a minigame into a story (current live path)

1. Package under `inklet/minigames/<name>/` with `index.html` (+
   `manifest.json` for the designed SDK path).
2. Register: add name to `iframeMinigames` and `minigameInfo` in
   `inklet/finkapp/fink-minigames.js` (until MinigameHost routing lands).
3. Invoke from Ink: `# MINIGAME: <name> mode=<m> controls=<dpad|lite|none>`
   then divert to a return knot; read the variables the game wrote.
4. Remember: guest iframes have opaque origins — ES modules/fetches need
   CORS (fine on GitHub Pages, needs a CORS server locally), and
   localStorage THROWS there — shim it (robbin.html head shows how).
5. Reactions to minigame results go BEHIND a choice in the return knot,
   and the MINIGAME tag goes INLINE on a text line — a bare tag line
   attaches forward through the divert and the destination's first line
   (with any conditionals) evaluates before the game runs. INK-GOTCHAS §8.
6. Worked example: hampstead_tube/tube_return in hampstead.fink.js;
   full-loop test: node inklet/finkapp/test/e2e-robbin.mjs.
