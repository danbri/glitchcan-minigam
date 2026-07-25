---
name: fink
description: FINK base data platform — the .fink.js polyglot file format, sigil extraction (oooOO/OO), ink compilation, tag grammar, sandbox loading, navigation links, minigame SDK, and validation/QA recipes. Use when writing or changing platform code (packages/gcfink, inklet/finkapp, inklet/minigames), validating story files, or debugging loading/compilation. NOT for story/game content authoring — that is the glitchcanary skill.
---

# FINK platform skill

The normative spec is `docs/fink-spec-v1.md` — consult it first; this
skill is the working commentary.

The platform is mechanisms only. Story names, track titles, station names,
splash copy: none of it belongs in platform code (destined for NPM). If a
change needs a story fact, it goes through config, a manifest, or a typed
content block.

## The file format (load-bearing facts)

- `.fink.js` files are **JavaScript, not text**. Content is captured by
  tagged template literals ("sigils") executed in a sandbox. NEVER parse
  them with regex/string ops (CLAUDE.md: NO HACKPARSING).
- `oooOO` is the default sigil → `text/x-ink`. The typed model and the
  curried escape hatch `OO('media/type')` live in
  `packages/gcfink/src/lib/sigils.js`.
- **Capture is RAW** (`strings.raw`) everywhere — browser sandbox
  (`inklet/finkapp/fink-sandbox.js:176-178`) and gcfink alike. This is
  load-bearing: tag URLs escape `//` as `\/\/`, and only raw capture
  preserves the backslashes.

## The `//` tag truncation bug (verified empirically)

The ink compiler treats `//` as a comment even inside `# TAG: value`:
- `# FINK: https://x` compiles to tag `FINK: https:` — and then
  `new URL('https:', currentStoryUrl)` resolves to the CURRENT story, so
  the failure mode is a silent self-reload.
- Escaped `# FINK: https:\/\/x` compiles to the full URL. Relative paths
  are always safe.
- Regression-locked in `packages/gcfink/test/inkCompile.real.test.js`;
  lint via `lintTagUrls` in gcfink. Author guidance: `inklet/INK-GOTCHAS.md`.

## Sandbox rules (SECURITY-CRITICAL — CLAUDE.md)

- Do not casually modify `fink-sandbox.js`. `'\n'` vs `'\\n'` broke story
  loading once (silent "Loading..." hang). After ANY sandbox/player change
  run the mandatory test: TOC loads → Episodes → Hampstead plays, no
  console errors.
- Loader flow: fetch text in parent → execute in throwaway
  `<iframe sandbox="allow-scripts">` srcdoc defining `oooOO` → postMessage
  back → currently uses data[0] (first block only).

## Platform contract warts (v1 reality, documented for v2 cleanup)

- `fink-ink-engine.js:100` unconditionally appends a private
  `=== _inventory ===` knot (declaring diamonds/mega_diamonds/keys/score
  if absent) to EVERY story. Stories divert to it
  (world-between-worlds.fink.js), so standalone validators must stub it:
  append `\n=== _inventory ===\nstub.\n-> END\n` when `-> _inventory`
  appears. The injected knot also contains a story link
  (world-between-worlds) — a known content leak.
- Other known leaks: `fink-config.js` (DEFAULT_FINK_FILE, LOCAL_FINKS,
  absolute /glitchcan-minigam/ paths), minigame registry + splash copy in
  `fink-minigames.js:26-37`, chess's `../../thumbwar/minichess.html`.

## Minigame SDK

- Two systems: the LIVE path is `fink-minigames.js` (ad-hoc, hardcoded
  registry `iframeMinigames`, loads `../minigames/<type>/index.html` into
  a sandboxed iframe). The DESIGNED path is `inklet/minigames/`
  (`MinigameHost` + guest `minigame-sdk.js` + per-game manifest.json with
  variables.read/write allowlists) — loaded but not yet routed.
- postMessage protocol (both): host→guest `init {config,variables}`,
  `pause`, `resume`, `terminate`, `key`; guest→host `ready`, `progress`,
  `set-variable`, `complete {result}`, `error`. Minigames cannot divert
  Ink; they mutate variables and the host resumes via
  `FinkInkEngine.continueStory()`.
- Story↔minigame linkage that ALREADY exists (use before building new):
  init carries diamonds/mega_diamonds/keys/score/player_level/difficulty
  (`_getStoryVariables`); guests spend live via `set-variable`; robbin
  stashes them as `game.embedVars`. Manifest `features: ["geolocation"]`
  → host sets iframe.allow before src. Maker window (drawer → WIDGETS →
  🔧 Maker, or `FoafOS.openMaker()`): live editable variables table,
  dream-stack line, SDK tap feed (sys.sdk.tx/rx).
- INPUT IS A HOST SERVICE (spec §5.1.1): `FoafInput`
  (packages/foafos/src/input.mjs) owns touch pad + keyboard + Gamepad
  API, normalized to up/down/left/right/a/b/start, translated to legacy
  SDK `key` messages. Guests get `init.config.controls.provider='host'`
  and should hide their own touch controls (a guest that never answers
  the conformance probe gets the service RETRACTED instead — §5.1.2,
  below) — an in-iframe pad can't see
  the visible viewport or safe-area insets (env() is 0 in an iframe), so
  it ends up under browser chrome. Use `100dvh`, never `100vh`, for
  window/app height. Pad shows only when: game active + controls≠none +
  not pip + no gamepad + pointer:coarse (tests need `hasTouch: true`).
- **Accepting the service means handling `key`.** Field report, July
  2026: *"for Minigam & Robbin, the A B buttons weren't working as go"* —
  true, and worse. Robbin answered the probe and hid its own pad, but had
  no `key` case in its message handler, so inside the shell it had NO
  touch input at all. Verified by measurement, not by reading. If a guest
  hides its controls, prove a press arrives.
- **A game one frame deeper than the SDK never sees the SDK's event.**
  The SDK dispatches its synthetic KeyboardEvent on ITS document; for a
  wrapper (gridluck, battleboids) that is not where the game is. The
  wrapper forwards the raw message and `inklet/minigames/host-keys.js`
  replays it in the game's own frame. Include it in the nested document.
- **`repeat` rides along.** A held button autorepeats in the service;
  games read `e.repeat` to tell a hold from a fresh tap (robbin's jumpTap
  and its Konami reader both do), so it must survive the postMessage.
- Careful reading the pad's absence: `controls: "none"` in the manifest
  (gridluck, battleboids — they swipe the canvas) means never offered,
  which is NOT the same as retracted by the conformance probe. Check
  `FinkMinigames.currentControls` before concluding.
- Testing the pad: `dispatchEvent('pointerdown')` in Playwright makes an
  event with a pointerId the browser is not tracking, so
  `setPointerCapture` throws and the press is skipped. Drive it with
  `page.mouse` instead. (The service now guards the capture, so one odd
  pointer event no longer eats the press.) Directions are NOT four
  buttons — `.foaf-pad-dir` is one joystick surface, so a direction is a
  pointer landing off-centre.
- `e2e-input.mjs` plays the Konami code once per controller: keyboard
  (guest focused), keyboard (shell focused), on-screen pad, gamepad. Ten
  ordered presses that reset on any wrong token — the strictest proof
  that a controller is wired and not merely present. Assert on
  `unlockTeleport`, NOT `creditsOpen()`: `showCredits()` opens ROBBAMP
  these days and never touches the `#credits` element.
- Verb protocol (spec §5.2): guests declare natively-handled shell verbs
  in `ready` (`capabilities.verbs: ['quit','audio']`). Declared → shell
  delegates (no frost over native pause; ✕ sends `quit` and the game's
  own dialog decides — double-✕ within 10s force-terminates). Undeclared
  → generic fallback. Standalone-first: verbs map onto handlers the game
  already has; robbin deliberately omits 'pause' (tube has none).
- Dream stack (spec §3.4, from docs/3dmap-idea.md): `# FINK: url` +
  `# LINKREL: goDeeper` pushes {url, state.ToJson()} and descends;
  END at depth>0 POPS and the outer story resumes mid-breath (LoadJson
  restores position — no knot bookkeeping); goShallower pops early;
  oneWay clears the stack; depth cap 8. Inner stories start fresh, no
  write-up (Depth Principle v1). Retained `story.state` topic carries
  {phase, depth}; body[data-fink-depth] drives the deepening-surface
  CSS. E2E: e2e-dream.mjs (assert position via OFFERED CHOICES, not
  page text — scrollback keeps history). Demo: demos/dream-outer/-inner.
- Tag grammar: `# MINIGAME: <name> [mode=x] [controls=dpad|lite|none]`
  parsed at `fink-ink-engine.js:314-333`; the Continue loop BREAKS on
  MINIGAME/FINK tags.
- Sandboxed iframes have an OPAQUE ORIGIN: guest ES-module imports and
  fetches need CORS. GitHub Pages sends `Access-Control-Allow-Origin: *`;
  plain `python3 -m http.server` does NOT — local harnesses need a
  CORS-enabled server.

## Window manager (FinkWM)

- `fink-wm.js` is the single owner of game-window geometry (spec §5.1):
  modes full/split/pip, pause orthogonal. The chrome (`#wm-chrome`) is
  draggable, edge-docking (persisted at `fink.wm.dock`), collapsible to
  its grip. Pip: tap restores, drag moves, guest input suspended via
  `pointer-events: none` on iframe/canvas.
- It REPLACED two rival systems: the FULL/EMBED/MINI slider
  (`fink-slider.js`, kept on disk but unloaded — EMBED rendered a 4px
  sliver, MINI had no way back) and the hidden pause/pin/min/max button
  bar. Never reintroduce a second geometry owner — and note the button
  bar's full-screen-black CSS survived the replacement for months (see
  "Flipping modes" below).
- Layout trap: `#minigame-view` is a `.view` flex child with
  `min-height:0` — a bare `height:` on it gets crushed to a sliver.
  Split uses `flex: 0 0 52%` + `min-height` instead.
- Buttons `#minigame-pause` and `#returnToStory` live IN the chrome but
  are wired by FinkMinigames — keep those ids stable.
- E2E: `node inklet/finkapp/test/e2e-wm.mjs`. Grip taps TOGGLE collapse
  and the toolbar auto-collapses after 4.5s — tests must set collapse
  state explicitly (`FinkWM._setCollapsed(false)`) before clicking
  toolbar buttons.

## Split mode: whose controls are these? (field report, July 2026)

"When splitscreen it can be v confusing which part of screen the window
manager controls" — correct: a toolbar floating over two panes claims
neither. The tiling-WM answer, three cues cheapest first:

1. **name both panes** — `.wm-pane-label`, one per pane, straddling the
   seam. Story bottom-LEFT of its pane, game top-RIGHT of its own.
2. **the toolbar names its target** — `#wm-target` chip, plus an
   aria-label that says which pane and where ("lower half"), because an
   accent edge is invisible to a screen reader.
3. **touching the toolbar accents the governed pane** — on
   pointerenter/focusin, plus a 1.4s flash on pointerdown, since a tap
   never hovers.

Three traps, all found by looking at a screenshot:
- The labels are `position:absolute` INSIDE each pane, never in the flow —
  split geometry is measured in pixels and a label in the box would
  reintroduce the clipping that layout was rebuilt to fix. **But
  `#narrative-view` was `position:static`**, so `bottom:0` resolved
  against the viewport and the story's label fled to the bottom of the
  screen. Both panes need `position:relative`.
- The story label first sat at the screen top, **under the draggable
  chrome**. Moving both to the seam fixes it and reads better.
- A PERMANENT strip covers the guest's own readout (robbin's FLOCK/SCORE
  was hidden by it). So the names behave like a TV naming its input:
  shown on layout change and when you reach for the toolbar
  (`_flashLabels()`), gone after ~2.6s. Same window under reduced-motion —
  that is timing, not decoration.
- Game labels go on the RIGHT because guests put HUDs top-left by
  convention. Same reason the safe-area contract is still worth doing.

Locked by 6 assertions in `e2e-wm.mjs`, including that the names stand
down again.

## Flipping modes: the resize storm and the guest-fit rule (July 2026)

Field report: *"display gets all messed up or mostly black after flipping
a few times"*. **The black screen did NOT reproduce headlessly** — ten
flips at 90ms (inside the 350ms transition), on robbin and gridluck,
desktop Chromium: geometry stayed correct, no page errors, screenshots
non-trivial. What follows are the mechanisms that were verified to exist,
not a proven diagnosis. If it recurs, say so — this is unfinished.

**1. There was still a second geometry owner.** `fink-minigames.css` held
`#minigame-view.maximized { position:fixed; 100vw/100vh !important;
background:#000; z-index:2000 }` and a rival `.minimized` fixed box, left
over from the pause/pin/min/max bar FinkWM replaced — and
`_updateWindowState()` (called on every *pause*) reapplied those classes.
The buttons are long gone from index.html, so it was latent, not live. Both
CSS blocks are deleted; `_updateWindowState()` is pause-only and actively
`remove()`s the classes; `toggleMaximize/Minimize/Pin` are now thin
delegates to `FinkWM.setMode`. "Never reintroduce a second geometry owner"
also means *finish deleting the old one*.

**2. A burst of flips is a burst of canvas reallocations.** Each mode
change rewrites the panes' inline heights, the guest reflows and a canvas
game reallocates its backing store. Ten flips = ten reallocations — cheap
on desktop, and on a phone a plausible way to run out of canvas memory and
get a black rectangle. So: `FinkWM._scheduleSettle()` debounces 220ms, then
does ONE authoritative `_layoutSplit()`, sends `{type:'resized', mode}` to
the guest and publishes retained `wm.settled`. Guests coalesce too —
battleboids' relay is debounced 180ms and also listens for `resized`.

**3. Guests must fit inside their own frame.** Measured: every guest was
4–20px taller than its frame. Invisible full-screen under
`overflow:hidden`; in a short split pane it is that many pixels of clipped
game board. Three distinct causes, all now fixed:
- `min-height:100vh` + `padding-top:20px` with default **content-box** —
  the padding sits OUTSIDE the 100vh (chess, 20px). Add `box-sizing`.
- An `<iframe>` or `<canvas>` is **inline-replaced**: it sits on the text
  baseline and the line box reserves descender space below it, so a
  100%-tall one overflows by ~4px (gridluck's wrapper AND
  `thumbwar/gridluck.html`'s canvas). `display:block`.
- A visually-hidden live region at `position:absolute` with **no offsets**
  keeps its static position — after all content. `guest-a11y.js` now pins
  it `top:0;left:0`. One file, every guest.

Assert on `document.body.scrollHeight === window.innerHeight` inside the
guest, and on `canvas.width` vs its CSS box — a stale backing store is
what "messed up or mostly black" actually looks like. Both are in the
flip-storm test in `e2e-wm.mjs` (now 23 assertions).

## foafos shell (working name — owner decides terminology)

- `packages/foafos/` = NPM-bound shell core (bus, sealed sessions,
  widget/feed contract, transports); `inklet/finkapp/foafos-shell.js` =
  the reference shell instance (`window.FoafOS`). Design doc:
  `docs/foafos-notes.md`.
- Platform modules publish with GUARDED one-liners
  (`window.FoafOS?.bus.publish(...)`) — never a hard dependency; the
  shell is a module script so it loads after the classic scripts.
- Topics in use: story.beat, minigame.start/complete, wm.open/close/mode,
  audio.focus, session.*, net.<transport>.*. Retained topics carry
  current state (wm.mode, audio.focus, session.current).
- Sessions: ephemeral unless sealed with a passphrase (AES-GCM; no
  unencrypted persistence path — that's deliberate, don't add one).
- Audio-focus protocol: pip ⇒ host sends `audio-blur` SDK message,
  un-pip ⇒ `audio-focus`; robbin ducks its buses and refuses to un-duck
  while blurred. Guest flag for tests: `game._audioFocus`.
- Cluster (`packages/foafos/src/cluster.mjs`): same-origin shell windows
  bridge buses, elect a coordinator, arbitrate named resources (one
  holder, last claim wins, holder yields; 'audio' is wired — second
  window claiming audio blurs the first window's game). Courtesy
  protocol, NOT a security boundary. Race lesson: track desired vs HELD
  separately — a stale cross-tab state event must not clobber an
  in-flight claim. Playwright: BroadcastChannel needs pages in the SAME
  context (`browser.newContext()` then `context.newPage()` twice).
- OS-cases analysis + scorecard: `docs/foafos-os-cases.md` (edot office
  suite, foaf.tv/tvp, zero-trust).
- `<foafos-guest>` + `scopeBus` (src/guest.mjs): sandboxed widget
  processes with grant-filtered bus views; denied publishes dropped AND
  announced ('sys.guest.denied'). Two-same-widget isolation locked by
  `node packages/foafos/test/e2e-guest.mjs` (run from repo root); demo
  at packages/foafos/demo/guests.html.
- A11y GATES (run both; they fail honestly):
  `node inklet/finkapp/test/aria-audit.mjs [--fail]` — walks the live app
  with a game + widget + drawer open: unnamed controls, landmarks, live
  regions, dangling aria refs, iframe titles, duplicate ids, invalid
  roles, heading order, guest-iframe internals, AND that platform events
  actually reach the announcer.
  `node inklet/finkapp/test/skins-a11y.mjs` — per-skin contrast/focus.
- EVENTS are announced by `#foafos-announcer` (sr-only role=status) in
  foafos-shell.js, fed from bus topics (wm.mode, minigame.*, audio.focus,
  session.*, ui.skin, sys.guest.denied, story.state). Add a topic there
  when you add a platform event, or it is silent to screen readers.
- Story prose lives in `#story-output` as `role="log" aria-live="polite"
  aria-relevant="additions"` — without it new beats are never announced,
  which was true for the whole project until 2026-07.
- A11y contract (verified live 2026-07): every iframe gets a `title`;
  toggles expose aria-pressed (wm modes, pause); dock has
  aria-expanded/controls synced via setDrawer(); feed = role=feed with
  role=article cards (aria-label topic+time+summary); widget windows
  role=group + label; Escape closes drawer. Keyboard path for pip/drag
  is the chrome buttons. Keep this contract when adding shell UI.
- E2E: `node inklet/finkapp/test/e2e-foafos.mjs`; unit:
  `cd packages/foafos && npm test`.

## Navigation / links

- Two-part hash links: `#<urlHash8>-<knotHash9>`, SHA-256 with salt
  `glitchcan-fink-v2` (v1 kept as legacy fallback). Spec:
  `docs/fink-linking-spec.md`. Public knots = not `_`-prefixed;
  `# PUBLIC:` marks respawn entry points.

## Skins (fink-skins.css)

- Six identities over ONE DOM: spectrum (original), paper, terminal,
  aurora, broadsheet, calm. Chosen via drawer → SKIN, `?skin=`, or
  `FoafOS.setSkin()`; persisted at `foafos.skin`; applied pre-paint by an
  inline script so there's no flash.
- Every surface reads the token contract (`--sk-bg/-figure --sk-ink/-dim
  --sk-accent/-ink --sk-line --sk-choice-* --sk-font-* --sk-radius
  --sk-choice-marker --sk-shadow --sk-info/-mega/-code-*`). Adding a skin
  = define the contract; never hardcode a colour in player CSS again.
- GATE: `node inklet/finkapp/test/skins-a11y.mjs` — AA contrast for body
  text, resting choice AND hover, visible focus ring, 44px targets, no
  overflow. A skin that fails is a bug, not a taste.
- Two traps that bit here: `getComputedStyle` is LIVE (snapshot before
  `focus()` or you measure focus styles), and translucent surfaces must
  be composited as a STACK (page → scene → choice), not treated as
  opaque backdrops.

## Finkiverse map (stories AND widgets)

- `node inklet/tools/fink-universe.mjs` → `docs/fink-universe.json`;
  view `docs/fink-universe.html` (zero-dep SVG force map, click a node
  for its in/out links). `--print` for a text dump.
- Edges: `fink` (typed by `LINKREL`, goDeeper drawn purple), `minigame`
  (dashed, to widget diamonds). Widgets are classified against the REAL
  registry (fink-minigames.js executed in a vm, not parsed): registered?
  iframe vs inline? packaged on disk? Anything unlaunchable is flagged.
- Older `inklet/tools/fink-graph.mjs` + `docs/fink-ring-viz.html` cover
  story→story links only, and their report predates widgets.
- Gotcha it exposed: **`#` mid-line is a TAG in ink**, so prose like
  "loaded via the # FINK: tag" compiles into a live FINK load. Two demo
  files shipped that bug for months.

## Variable governance (spec §5.3)

- A guest's `manifest.json` `variables` block is a CAPABILITY, enforced
  by `FoafVars` (`packages/foafos/src/vars.mjs`). Before June 2026 it was
  decoration: `case 'set-variable'` wrote any name, so any minigame could
  set `diamonds` or reach into another story's plot flags.
- Enforcement point: `FinkMinigames._setStoryVariable(name, value, actor)`.
  `actor = _guestActor()` for everything a guest can reach —
  `set-variable`, `progress` (the gems→diamonds and score bridges), and
  `complete.variables`. Host-driven writes pass no actor and get
  `{kind:'host'}`. The manifest is fetched BEFORE `iframe.src` is set, and
  a guest with no manifest gets `{read:[],write:[]}` — fail closed.
- Two classes: **shared economy** (`diamonds`, `mega_diamonds`, `keys`,
  `score`, `minigame_played`) is cross-work on purpose; everything else
  is private to the work that declared it. `minigame_played` had to MOVE
  into the shared set — the analyzer correctly flagged it as a cross-work
  collision while it was private.
- Dreams are strict: at depth > 0 the shared economy is read-only. A
  dream keeps its own counters but cannot spend the waking world.
- `node inklet/tools/fink-vars.mjs [--json] [--strict]` — declared VARs
  read from the COMPILED story (`variablesState._globalVariables`), never
  regexed; manifests joined against them. Reports collisions, dead writes
  (a guest writing a name no story declares — Ink refuses the assignment
  and the host's `try` swallows it), and unmanifested guests. It collapses
  `_tmp_x.fink.js` into `x.fink.js` first, or one temp copy of a 24-VAR
  story reads as 24 collisions.
- Denials are EVENTS (`vars.denied` / `vars.unbound` / `vars.failed`), not
  silence — an honest bug and a cheat are indistinguishable at the host,
  so both surface in the Maker window's governance table.
- E2E: `node inklet/finkapp/test/e2e-vars.mjs`. It posts the attacks FROM
  INSIDE the guest frame (`parent.postMessage`), the way a cheating game
  would — not by calling host functions.

## Debug clock: run a guest 50× slow (spec §5.4)

- `inklet/minigames/debug-clock.js` — ONE implementation, included by
  every guest (SDK-based and native-protocol alike). It virtualises rAF,
  setTimeout, setInterval, `performance.now` and `Date.now`: deliver every
  k-th real frame (k = 1/scale) with a normally-advanced timestamp, so
  fixed-step AND dt-integrating games both slow correctly, unmodified.
  Nothing is patched at scale 1.
- Host: `__finkDebug.slow(50) / .freeze() / .step(n) / .normal() /
  .state()`. `.state()` returns guest + window geometry + granted
  capability + governance ledger in one call — the thing to poll from a
  headless driver. Shell URL: `?slow` or `?timescale=0.02`.
  Guest URL standalone: `?timescale=0.02`. Guest surface: `__mgDebug`.
- It patches ONE document: a guest wrapping another game in a nested
  iframe must forward the `debug` message inward.

## Guest instances: provenance is the capability model

- Every running guest gets a record in `FinkMinigames.instances` and ONE
  module-level listener routes by `event.source`. Before July 2026 both
  message paths were bare `window.addEventListener('message', …)` with no
  provenance check: two copies of a widget each ran both handlers, they
  shared one `lastSync`, closing one removed the listener the other was
  using, and ANY frame on the page could post `set-variable` and have it
  applied with the focused guest's grants. **A manifest attached to a
  TYPE means nothing if the host cannot tell which frame is speaking.**
- `_guestActor(inst)` takes the instance. The no-arg form is host reads
  only — never use it for anything a guest can trigger.
- `WindowProxy` identity survives navigation inside a browsing context,
  so `event.source === iframe.contentWindow` still matches after a
  wrapper page redirects (robbin does exactly that).
- Unrouted SDK vocabulary publishes `sys.guest.unrouted` and is dropped.
  Often innocent (a nested wrapper relaying its own chatter), but a
  spoof looks identical and silence would hide both.
- Ids must come from a COUNTER. `inline-minigame-${Date.now()}` gave two
  widgets opened in the same millisecond the same id, so the second
  overwrote the first's record.
- The shelf lists embedded guests under "In the story", one row per
  instance. E2E: `node inklet/finkapp/test/e2e-instances.mjs` — it posts
  its attacks from INSIDE a real guest frame.
- Still one window-mode game at a time: that is FinkWM's model. Multiple
  simultaneous game *windows* is unblocked, not done.

## Audio as an OS service (spec §5.5)

- `FoafAudio` (`packages/foafos/src/audio.mjs`): master volume + mute,
  persisted at `foafos.audio`, announced on retained `audio.volume`.
  `level = muted ? 0 : volume` — mute must never destroy the chosen level,
  or unmuting feels broken. Nudging the slider up from silence unmutes.
- Sinks register with `apply(level)`; it is called on registration too, so
  a source that starts while muted starts silent.
- **The honest limit**: there is no `iframe.volume`. Only same-document
  sources (FinkAudio/FinkFoley, whose gain the shell owns) and guests that
  answered the `audio` probe can be turned down. `coverage().uncovered`
  names the rest and the drawer SAYS SO — a mute button that silences
  three of four sources and pretends otherwise is worse than one that
  admits it. Mark noisy apps `audio: true` in the registry so the
  disclosure isn't padded with silent spreadsheets.
- FinkAudio/FinkFoley now carry `masterLevel` applied at source creation
  AND live; without the former, a mute only silenced whatever happened to
  be playing when the button was pressed.
- Launcher windows are NOT minigames, so FinkMinigames' guest plumbing
  does not reach them — `governAppFrame()` in the shell offers the same
  contract to app iframes. The first version shipped a channel player the
  master volume could not touch.
- `# AUDIO: <file>` was always able to load an mp3; no story had ever
  done it. `# AUDIO: synth:<layer>` routes to FinkFoley — before July 2026
  it went to FinkAudio.play(), which fetched a "synth:" URL and failed
  silently. Demo: `inklet/demos/audio-demo.fink.js`.

## Home and switcher (spec §5.6)

- `FoafOS.openHome()` (Alt+H) — grouped app grid; `FoafOS.openSwitcher()`
  (Alt+Tab) — what is running, gathered from story + WM game + inline
  instances + shell windows; Alt+M toggles mute. Shortcuts skip
  INPUT/TEXTAREA/SELECT/contenteditable.
- The installed set is CONTENT: `inklet/finkapp/foafos-apps.js`, never
  `packages/foafos`. `kind` ∈ window | game | story | panel decides how
  the shell opens it; nothing else distinguishes an office app from a maze.
- CSS trap that bit here: `--sk-bg-figure` is TRANSLUCENT in two skins
  (terminal 0.6, aurora 0.055). Fine for a floating panel, wrong for a
  full-screen overlay — story text showed through the app grid. Composite
  the figure over `--sk-bg` instead of trusting one token to be opaque.
- One-installation test: `node inklet/finkapp/test/e2e-desktop.mjs
  [--shots]` runs an office app, a game and the TV app at once and checks
  ONE launcher, ONE switcher and ONE volume see all of them.

## The conformance probe: adaptation, not compliance (spec §5.1.2)

- The shell cannot inspect a guest (opaque origin), so "does this widget
  know its duties?" is answered by ASKING and seeing who answers.
  `init.config.contracts` offers them; the guest replies
  `{type:'conformance', contracts:[…]}`; silence past 2.5s means it
  predates the contract.
- **On non-conformance the shell RETRACTS the equivalent OS service**
  rather than stacking on top of it. Silence therefore costs a legacy
  widget nothing — it keeps working exactly as standalone. This replaced
  "guests MUST hide their own controls", which mudslider simply didn't,
  giving the player two overlapping pads.
- Adaptation costs one line: `sdk.onControls(cb)` both applies the policy
  and answers the probe, because **registering a handler IS the answer**.
  Native-protocol guests post `conformance` themselves (robbin).
- **Retraction must never produce a dead game.** A guest that already
  hid its controls has to be told to put them back, so retraction sends
  `{type:'controls', controls:{provider:'guest'}}` rather than just
  hiding the pad — and a LATE conformance restores the service (a
  flicker beats an unplayable game). Both directions are asserted.
- The real on-screen pad is the shell's `#foaf-pad` (FoafInput);
  `#game-dpad` is legacy. `refreshPad()` gates on `inputRetracted`, so
  retraction must call `FoafOS.refreshPad()`, not just `_showDPad`.
- E2E: `node inklet/finkapp/test/e2e-conformance.mjs`. It fakes an
  ignorant guest by deafening the host to that guest's answer — the rest
  of the guest is untouched, which is the property under test.
- Test lesson: the announcer is a TRANSIENT live region that clears
  itself between messages, so asserting on its instantaneous text is
  flaky by construction. Record the bus topic and separately prove the
  announcer is wired to it.

## Guest accessibility (spec §5.1.1 + the July 2026 audit)

- Audited baseline: six packaged guests, ZERO `aria-*` attributes
  between them, no live regions, no headings, and no keyboard-reachable
  element in the three canvas games. Shell-level ARIA was already fine —
  the entire gap was inside the guests.
- `inklet/minigames/guest-a11y.js` is the pooled service, included by
  every guest: sr-only `role=status` region, sr-only `<h1>`, `role="img"`
  + a LIVE `aria-label` on the canvas via a per-game describer, and
  `__mgA11y.announce()` (deduped — a loop that announces every frame is
  worse than silence, a reader never finishes a sentence).
- Announcements are POOLED: they reach the guest's own live region AND,
  via `guest.announce` on the bus, the shell's `#foafos-announcer` —
  which survives the guest closing and is the only place that can say
  WHICH of two copies spoke.
- The cheapest big win is turning clickable divs into `<button>`s: tab
  order, name, Enter/Space and a focus ring, all for free. That single
  change is most of gems' accessibility. Remember to strip the UA button
  chrome in CSS and add `:focus-visible`.
- A canvas game cannot be made playable by roles alone — it needs a text
  mode. Narration is commentary, not an interface. Say so rather than
  claiming a canvas game is accessible.
- Guests MUST hide their own touch controls when
  `init.config.controls.provider === 'host'`. Mudslider didn't, and drew
  its arrows underneath the shell's joystick — visible only in a
  screenshot.
- Sweep: `node inklet/finkapp/test/sweep-minigames.mjs --shots` boots
  every widget any story invokes and reports boot/ready/drew/grants plus
  a11y counts. Measure across ALL frames a guest owns — four of seven are
  wrappers around a nested game, and measuring only the outer frame
  reports the wrapper's empty document and flatters the result.
- Full findings + rankings: `docs/minigame-review-20260725.md`.

## Actually playing a guest headless

`node inklet/finkapp/test/play-boidwars.mjs [--turns N] [--slow N] [--shots]`
is a PLAYTEST, not an assertion suite: it drives a real battle and prints
a turn-by-turn account. Loading is not playing, and the difference is
where the bugs live — the e2e passed on every geometry assertion while
the game was mathematically unwinnable.

- Give every guest a headless hook (`__robbin`, `__tftt`, `__boidwars`):
  read-only state plus the verbs a player actually has. A driver that
  reaches into internals rots.
- **The game ending is a legitimate outcome.** When a guest completes,
  the shell closes the window and the frame DETACHES — every
  `frame.evaluate` after that throws. Catch it and read the verdict from
  the host (`battleboids_won`, or `FoafOS.vars.scratch` when no story
  declares the VAR) instead of crashing one turn before the interesting
  part.
- Don't attribute effects to the action that preceded them until you
  know the latency. Boidwars' flocks cross the map slower than a turn
  lasts, so damage from turn N lands during turn N+1; per-turn deltas
  read as "every shot missed". Report the health CURVE.
- Screenshots earn their keep here. "0 damage in 6 turns" looked like a
  broken aim helper; the PNG showed two impassable rock needles between
  the wizards and told the real story in one glance.
- Budget wall-clock by the debug clock (`ms * SLOW`), or a slowed run
  times out before the game has done anything.

## Aspect ratio is game logic, not styling

A guest that derives its world from the raw viewport gets a different
GAME in each window shape. Boidwars computed a correct aspect-fit box
and then discarded it, so a 430×860 phone produced a 71×143 world — 1:2
for a game designed 1.5:1. Because `maxHeight = GRID_HEIGHT * 0.7` and
`baseWidth = GRID_WIDTH * 0.25`, the mountains became needles twice as
tall as they were wide, sitting between the wizards; an attacking boid
dies the instant it touches rock, so every flock just mined. Six turns,
zero hits, 1678 blocks of rubble, both wizards at full health.

Two rules that came out of it:
- **Clamp the world's aspect** to a playable range (boidwars: 1.0–2.4)
  and letterbox what falls outside. Pinning it exactly wastes half a
  phone screen; leaving it free breaks the game.
- **Tie a feature's size to its own extent, not the grid's.** A mountain
  height derived from `GRID_HEIGHT` changes shape with the window;
  `min(GRID_HEIGHT * 0.7, baseWidth * 1.6)` keeps a hill a hill.

After both: purple 7→5→3 and blue 7→6 in the first three turns. Same
code, same window, playable.

## Validation & QA recipes

- Player E2E (the mandatory journey, automated):
  `node inklet/finkapp/test/e2e.mjs` — self-serving, asserts boot → TOC
  compiled → Episodes → Hampstead loads (compiledCount 2) → two story
  beats → zero page errors. UI buttons render BEFORE their listeners
  attach: always settle ~700ms before clicking, and prefer
  waitForFunction over sleeps.
- Unit + corpus: `cd packages/gcfink && npm test` (zero-dep runner; corpus
  test extracts + real-compiles every `inklet/**/*.fink.js`).
- Story validator: `node inklet/validation/checkfink.mjs` (`--scan`; no
  `--report` flag exists). In environments without full puppeteer (only
  puppeteer-core is a repo dep) set
  `PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
  It stubs `_inventory` (spec §2) and only treats `.json` as ink when
  `inkVersion` is present (Lucid scenes also have a `root` key — do not
  loosen that filter again). Sweep result 2026-07: 17/17 pass.
- Headless browser: Playwright with
  `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`,
  args `['--no-sandbox']`. Serve the PARENT of the repo dir so absolute
  `/glitchcan-minigam/...` paths resolve:
  `python3 -m http.server 8091 --directory /home/user` →
  `http://127.0.0.1:8091/glitchcan-minigam/inklet/finkapp/`.
  Boot check: all of FinkPlayer/FinkInkEngine/FinkSandbox/FinkNavigation/
  FinkMinigames/FinkAudio/FinkFoley/MinigameHost on window, and
  `FinkInkEngine.compiledCount >= 1`.
- Local servers die on worker restarts — always curl-check and restart
  with `(setsid nohup python3 -m http.server ... &)`.

## Audio (current state)

- `FinkAudio`: single looping bg track, crossfade, no playlist, no mute
  UI. `FinkFoley`: procedural layers; shares FinkAudio's context when
  present. Known bugs: `fink-slider.js` references `FinkFoley.ctx` (real
  name `.context`) so snap sounds are dead; gems spawns a throwaway
  AudioContext per sound. The richer architecture to migrate toward is
  magpie/robbin's jukebox model (single owner element + bus + views).
