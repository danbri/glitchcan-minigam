---
name: story-game-sync
description: How an Ink story and a game engine share one playthrough in this repo ("gamgam", the dual game engines idea) — the platform's pause/play/resume model for `# MINIGAME:` guests, the live two-way model Drift city runs in its own page (tags drive the world, the world writes VARs, a discovery re-enters the scene), what each can and cannot do today, and the fallback rule that every world-only affordance needs a text route for readers with no GPU or no sight. Use this when designing a story that depends on an attached game, wiring a game to read or write story variables, deciding where the Ink runtime should live, adding a text or screen-reader route to game-only content, or when a story "works in the game but gets stuck in the FINK player".
---

# Story and game in sync

The owner's framing (`glitchcanary.md:23-30`): Ink works well when paired with
a second game engine. The story holds the plot and the state; the game holds
space, time and the senses. This skill covers how the two talk. The protocol
details are in the `fink` skill (Minigame SDK section) and in
`docs/fink-spec-v1.md` §5; tag placement in stories is in the `glitchcanary`
skill. This file says which model to use and where the gaps are.

Facts below were checked against the code in September 2026. Line numbers
drift; search for the names.

## Two models exist

### A. Platform guest: pause, play, resume

A story in the FINK player (production: the boxed runner,
`inklet/apps/storyrunner/storyrunner.js`) meets `# MINIGAME: <name>`:

1. The runner breaks the beat and pauses (`case 'MINIGAME'`, sets
   `_pendingGame`), then sends the `story.launch` verb.
2. The shell (`foafos-shell.js`, `story.launch` handler) snapshots
   `FoafOS.storyVars`, gives the economy to the launching story, and calls
   `FinkMinigames.startMinigame(game)`.
3. The guest gets `init` with variables (`_getStoryVariables` in
   `fink-minigames.js`), the last story paragraphs (`story.recent`), controls,
   and bus grants.
4. While it plays, the guest may write: `set-variable`, `progress`. Writes go
   through the `FoafVars` broker: the guest's tree node must hold `vars:write`
   (reads need `vars:read`), and then the manifest read/write lists apply
   (shared economy `diamonds mega_diamonds keys score minigame_played`).
5. On `complete`, the shell sends `story.event minigame.complete` with the
   variables that changed; the runner's `resumeAfterGame()` writes them into
   its ink and calls `advance()` from where the tag broke.

What this model does NOT do, today:

- **No live push from story to game.** The SDK handles `variable-changed`
  (`packages/finkgame/src/minigame-sdk.js`), but no host code sends it. A game
  sees story state once, at `init`.
- **A game cannot move the story.** Spec §5: "Games cannot divert the story."
  No verb re-enters a knot or chooses a path. Reactions live behind a choice in
  the return knot (spec §3.2).
- **`init` variables come from the legacy engine.** `_getStoryVariables` reads
  `FinkInkEngine.story`, not the boxed runner's story or `FoafOS.storyVars`.
  Under the boxed runner, check what a guest actually receives before relying
  on it.
- `# MINIGAME_MODE:` and `# MINIGAME_CONFIG:` (in `inklet/minigames/README.md`)
  are not parsed anywhere.

**Tag arguments (September 2026).** `# MINIGAME: <name> key=value ...`. The
boxed runner sends the name and the pairs (`gameTag` in `storyrunner.js`; it
splits the tag value the ink runtime produced and reads no story source). The
shell's `launchArgs` keeps `mode` and `controls` (dpad, lite, none) for the
stage host, and any other key only if the app's registry row lists it in
`args`. A value must be a plain token, `[A-Za-z0-9][A-Za-z0-9._:-]{0,79}`, and
at most 12 pairs are read. Everything else is dropped and reported on
`app.launch.args.dropped`. The guest gets its keys in its page address
(`?tale=peraspera`), so a page that already reads its address needs no change,
and in `init.config.args`. The node records them (`scopes.args`), and the Task
Manager shows them in the State column. Until September 2026 the runner kept
only the first word, so `# MINIGAME: robbin mode=hampstead` arrived as mode
normal in production; it now reaches the game. The legacy player passes `mode`
and `controls` as before and no other keys.

Good fit: a self-contained episode inside a story — a heist, a battle, a
puzzle — whose result the story reads afterwards. It also carries a narrative
moment: `cellar` (Drift city's novel page, `drift-city/novel/cellar.html`) is
a stage app with no capabilities. Pause freezes it, a close keeps its place
(snapshot), a reopen restores it, and its own story's exit completes it, so
the outer story resumes after the tag (`drift-city/novel/cellar-entry.fink.js`;
the drift-city skill, Novel pages, has the lessons). The city itself is the
stage app `drift` (`# MINIGAME: drift tale=peraspera` opens it on that story)
and a cast member speaking a recorded line is `talkinghead`
(`# MINIGAME: talkinghead line=mags-3 [mood=wry]`); both are played by
`drift-city/foafos-entry.fink.js` (the drift-city skill, "Drift City as a
foafos app"). Examples:
`inklet/hampstead.fink.js` (robbin, reads `robbin_birds` after),
`inklet/skydock.fink.js` (debrief branches on `skydock_trades`, replay loop
`+ + [Clock on again] -> shift`), `inklet/apps/storyrunner/peer.fink.js`
(waterworld, the parity fixture).

### B. In-page engine: live, both ways (Drift city)

`drift-city/` runs its own Ink (`src/tales.js`) inside the game page, so both
engines share one frame loop:

| direction | mechanism |
|---|---|
| story to world, per beat | tags read from `story.currentTags` after each `Continue()`: `scene`, `place`, `time`, `weather`, `prop`, `hotspot`, `fly`, `live` |
| world to story, continuous | every 0.5 s `taleSync()` writes `here`, `hour`, `snowing` into `variablesState` (only if declared) |
| story to world, on change | `ObserveVariable('want_time' / 'want_weather')` |
| world moves the story | a discovery sets the clue VAR and calls `ChoosePathString(scene)`; a scene tagged `# live` is re-entered when `here` changes |
| always | `in_world` is set true before every `Continue()` (see Fallbacks) |

This is the thing model A cannot do: the world moves the story while it runs.
The price is that the game page owns the Ink runtime, so none of the shell's
services apply (no variable governance, no dream stack, no status line, no
announcer). The story file is still a normal `.fink.js`
(`drift-city/story/lamplighter.fink.js`), extracted with the frozen
`packages/backticks` capture in a sandboxed frame, and the TOC also links it
into the FINK player — so the same file must play in both places.

### Choosing

- The game is an episode with a result: model A.
- The game is the place where the story happens, and discoveries, position or
  time should change the text as you play: model B today. To bring it under the
  platform, the missing pieces are a live story-to-guest push (send
  `variable-changed`, or a `story.vars` bus topic), and a governed verb that
  lets a guest ask the story to re-enter the current scene. The second one
  changes spec §5's "games cannot divert"; that is the owner's decision, not an
  implementation detail.

## Fallbacks: every world-only affordance needs a text route

A story that depends on its game must still be finishable without it: in the
FINK player, with a screen reader, and on a device with no WebGPU or WebGL.
"The game has a WebGL fallback" does not cover a blind reader.

The pattern Drift city uses:

```ink
VAR in_world = false          // the game page sets this true before every Continue()

=== stall ===
# hotspot: ticket @ a ferry ticket frozen in a puddle @ 38 @ -18
...
+ {not in_world and not ticket} [Look around] -> look_ticket
* {not heard_bo} [Ask Auntie Bo what she saw] -> bo

=== look_ticket ===
~ ticket = true
You find a ferry ticket frozen in a puddle.
-> stall
```

Rules:

- The text route does exactly what the world does: set the same VAR, re-enter
  the same scene. Do not write a second plot. Its line reuses the hotspot label
  (the page shows "You notice <label>."), so the two routes read the same.
- Guard it with the flag, so players in the world are not offered a shortcut.
  Set the flag in the page before every `Continue()`, because `ResetState()`
  resets it.
- **"The world is rendering" is not "the player can use it".** A screen-reader
  user can have WebGPU, and no browser reports that a screen reader is running.
  So the flag must also be switchable by the player: Drift city has Menu > Story
  > "Clues as choices", stored per device, which leaves `in_world` false with the
  city on (outside review, September 2026). The spatial route stays open too.
- Test BOTH modes by playing, not by reading. `drift-city/tests/inkwalk.mjs`
  plays 400 random runs with `in_world = true` (clues found by simulated
  looking) and 400 with `in_world = false` (clues only from the story's own
  choices), and fails if either mode misses an ending or gets stuck. Before the
  text route existed, the TOC-linked story could not reach the river without
  the city.
- `npm run fink:check` plays the story breadth-first with the default VAR
  values, which is text mode. A story that is clean there but has
  world-only clues is only clean because fink-check never tries to finish it.
- In a platform guest, `inklet/minigames/guest-a11y.js` gives a live region and
  canvas labels. That is narration, not a way to play. There is no text-mode
  convention for guests yet; the text route belongs in the story.

## Wiring a platform guest (model A) — checklist

1. The page: `inklet/minigames/<type>/index.html` and `manifest.json`
   (variables read/write, features). Self-contained guests include
   `../guest-a11y.js`, `../debug-clock.js` and
   `../../../packages/finkgame/src/minigame-sdk.js`; nested wrappers also
   `host-keys.js`. A guest that lives beside its own content (the cellar)
   names its page with `url` in its registry row instead, relative to
   `inklet/finkapp/`, and puts `variables` in the row (or a `manifest` URL).
2. ONE row in `inklet/finkapp/foafos-apps.js`: `surface: 'stage',
   game: '<type>'`, capabilities, `desc`, `controls`, `silent` if it makes no
   sound, `args` for the tag keys a story may pass, and `features` for the
   frame's permissions policy (`autoplay` for a guest that must play sound
   without a tap in its own frame, as `talkinghead` does). That row is the only
   list of games: the stage host reads it at boot.
   An unregistered name is refused (`minigame.refused`; a boxed story's
   `story.launch` gets `unregistered`). Before September 2026 there were two
   lists, and a name missing from the host's list started gems.
3. Capabilities are what the node HOLDS: a guest without `vars:write` writes
   nothing, whatever its manifest lists.
4. In the story: tag inline on a text line, `-> return_knot`, reactions behind
   a choice (see the `glitchcanary` skill).
5. A text route for anything the story needs from the game (above).

Fixed September 2026: `canarywharf` (TOC entry `# MINIGAME: canarywharf
mode=firstlight`) had a guest folder and no registration, so it played gems. It
has a registry row now, and since the tag arguments work, `mode=firstlight`
reaches it.

## Verify

```
node drift-city/tests/inkwalk.mjs                         # both modes, all endings
node inklet/tools/fink-check.mjs drift-city/story/lamplighter.fink.js
node inklet/finkapp/test/e2e-storyrunner.mjs              # pause on MINIGAME, resume with variables
node inklet/finkapp/test/e2e-powers.mjs                   # one node per stage app, the cellar end to end
node inklet/finkapp/test/e2e-drift.mjs                    # tag arguments; the city and the talking head end to end
```

To check what a guest receives under the boxed runner, log `init` inside the
guest frame; do not infer it from `_getStoryVariables`.
