---
name: fink
description: FINK platform AND the foafos shell it grew into — the .fink.js polyglot file format, sigil extraction (oooOO/OO), ink compilation, tag grammar, sandbox loading, navigation links, minigame SDK; plus root manifests, the app tree and capability attenuation, the storage/secrets/vars/audio/input brokers, brokered actions (git.commit), shell chrome as apps, the window manager, and the testing discipline for all of it. Use when writing or changing platform or shell code (packages/finkcore — formerly gcfink, packages/finkgame, packages/foafos, inklet/finkapp, inklet/apps, inklet/minigames), validating story files, debugging loading/compilation, or reasoning about what an app is allowed to do. NOT for story/game content authoring — that is the glitchcanary skill.
---

# FINK platform skill

The normative spec is `docs/fink-spec-v1.md` — consult it first; this
skill is the working commentary.

**This file is arguably two skills now.** Roughly a third of it is the
foafos shell — roots, the app tree, capabilities, brokers, chrome — which is
not what "the .fink.js file format" describes. It is one file because the
shell IS the player and splitting them invites a future reader to load half
of a coupled story. Kept together deliberately; the description above was
widened (July 2026) so the shell half is at least discoverable. If it grows
much past ~1200 lines, split it and cross-link both ways.

**The kernels (July 2026):** `packages/finkcore` (story/data — formerly
`gcfink`; a `packages/gcfink` symlink keeps every old path and doc reference
resolving, so do not "fix" stale-looking mentions in historical docs or in
`fink-sandbox.js`'s comment), `packages/finkgame` (the guest SDK, formerly
`inklet/minigames/minigame-sdk.js` — the six guest pages load it from the
package; it is require()-able in Node and `packages/finkgame/test/run.js`
pins the protocol shapes offline), `packages/foafos` (the shell). The live
site imports from `packages/` — it is a served path, proven on Pages.

The platform is mechanisms only. Story names, track titles, station names,
splash copy: none of it belongs in platform code (destined for NPM). If a
change needs a story fact, it goes through config, a manifest, or a typed
content block.

## The file format (load-bearing facts)

- `.fink.js` files are **JavaScript, not text**. Content is captured by
  tagged template literals ("sigils") executed in a sandbox. NEVER parse
  them with regex/string ops (CLAUDE.md: NO HACKPARSING).
- `oooOO` is the default sigil → `text/x-ink`. The typed model and the
  curried escape hatch `OO('media/type')` are the **frozen
  `@foafos/backticks` kernel** (`packages/backticks/`) — the ONE
  definition of capture. `finkcore/src/lib/sigils.js` is now a thin
  re-export of it; `packages/backticks/FROZEN.md` is the contract.
- **backticks is the capture kernel, NOT a sandbox.** It runs inside an
  isolate the caller supplies (opaque iframe in the browser, `node:vm`
  in Node); "given isolation, capture is deterministic and
  raw-preserving." The story-sandbox threat model
  (`docs/fink-story-sandbox-threatmodel-20260728.md`) owns the isolation
  boundary; this owns correctness. Two extraction views, both named:
  `inkOf` (unique, newline-joined) and `firstInkOf` (first ink block —
  the live browser player's contract). Tests:
  `npm run test:backticks` (kernel contract + browser-source
  equivalence). Still a **gated follow-up**: rewiring the live
  `fink-sandbox.js` srcdoc to inject `INSTALL_CAPTURE_SOURCE` instead of
  its hand-copied capture — do it behind the mandatory Hampstead journey.
- **Capture is RAW** (`strings.raw`) everywhere — browser sandbox
  (`inklet/finkapp/fink-sandbox.js:176-178`) and the backticks kernel
  alike. This is load-bearing: tag URLs escape `//` as `\/\/`, and only
  raw capture preserves the backslashes.

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
- Composition without a frame (2026-07-30): `# FINK: url` + `# LINKREL: merge`
  + `# ENTRY: knot` APPENDS that file to the ordered set the session has
  parsed, recompiles the UNION with the real compiler and `LoadJson`s the
  reader's place into it. No frame, no session, no depth change — an episodal
  game must not become a tree of sandboxed widget frames. Merge is for content
  with no front door (a room of one city); `# LINKREL: peer` is for content
  that HAS one. **`# ENTRY:` is a tag and NOT a URL fragment**: `#` starts a tag
  in ink, so `file.fink.js#knot` is two tags and the fragment never arrives.
  Collisions (same `VAR`, same knot name in two files) are a COMPILE ERROR —
  the union is compiled into a local, so a refusal leaves the reader reading,
  and the message comes from `compiler.errors`, not the thrown exception (which
  says only "Compilation failed."). Offline: `inklet/tools/fink-unions.json`
  tells `fink:check` which fragments belong to which host, since a fragment
  cannot compile alone. Do NOT auto-rename ink identifiers to dodge collisions
  — that is hackparsing; `inklet/demos/fink-namespace-preprocessor.js` is a
  strawman, not the tool. E2E: e2e-storyrunner.mjs §13.
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

### Story typography: four dead rules and an inverted hierarchy (July 2026)

Field report with screenshots: *"unreadable short sentence in a sea of
whitespace"* and *"verbose tiny text pushes visuals off screen"*. All four
causes were rules that looked right and did nothing, or did the opposite.

- **`--sk-size` only ever reached `.choice-btn`.** The prose kept the
  platform base size, and a `@media (max-width: 600px)` rule knocked
  `#story-output` down to `--font-size-small` — **12px** — while the skins
  load after fink-player.css and so kept the choices at 18px, bold. Measured:
  prose 12px/400 under choices 18px/600. On the smallest screen, where the
  prose most needs to be readable, it was smallest. Type size now lives in
  ONE place (the skin) and reaches the prose; choices are
  `calc(var(--sk-size) * 0.95)` with the tap target coming from
  `min-height`, not from type size.
- **`.choices-container` matched nothing.** The player builds `#choices`.
  So the `flex-direction: column` had never applied and the buttons, being
  `inline-block`, flowed onto ONE LINE — three options crammed side by side
  under a single shared rule, reading as one element rather than three
  targets. Visible in both screenshots; nobody had looked.
- **~70vh of deliberate void.** `padding-bottom: 50vh` plus a `::after`
  static tail of `30vh`. Right under a long scene, absurd under a two-line
  beat. CSS cannot ask "am I taller than my container", so `FinkUI.markFit()`
  measures after each render and sets `data-fits` on `#narrative-view`;
  `yes` drops the affordance that has nothing to afford and centres the
  scene. **Measure with the zone suppressed** — otherwise the padding you
  are deciding about is what makes the content overflow and the answer is
  always "no". Re-run on resize/orientationchange, debounced.
- **Lead media scrolled away.** `.section-media` is now `position: sticky;
  top: 0` — but it must also be `width: 100%`, because a picture narrower
  than the column left the prose visible either side of it while scrolling,
  and half-sentences flanking a floating image are worse than losing the
  image. Full-width box + `object-fit: contain` + opaque background +
  a shadow seam, so the overlap reads as a pinned header.

Verify by MEASURING computed sizes and screenshotting at 430×860, not by
reading the CSS: every one of these was invisible in source.

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

## Guests on the bus (spec §5.7) — stage games and window apps are apps

Owner's ruling (July 2026): "stage games under stories ARE SUPPOSED TO BE
FULLY APPS TOO … with comms via the current foafos bus. Similarly tv
widgets are Apps." The tree half was already true (game nodes spawn under
`FoafOS.storyNode`); the bus half is now implemented.

- ONE wire protocol for all three guest kinds (`<foafos-guest>`, stage
  minigames, window apps): guest→host `{type:'bus-publish', topic, data}`,
  host→guest `{type:'bus-event', event}`. Reused from guest.mjs — do not
  invent a second vocabulary.
- The SHELL builds the scoped view and owns policy (`busGrantsFor` next to
  the registry in foafos-shell.js; `governAppFrame` for window apps);
  `FinkMinigames.attachBus` only routes. Registry entries may declare
  `bus: {publish, subscribe}`; defaults are `guest.<type>.*` /
  `app.<id>.*` publish plus wm.mode + audio.volume (+ story.state for
  stage, ui.skin for windows).
- Source stamp `guest:<type>#<instance>` — provenance survives the bridge
  because routing is by `event.source` BEFORE any grant check. Denials go
  to `sys.guest.denied`, never silence.
- SDK surface: `sdk.bus.publish` / `sdk.bus.subscribe` (using either
  declares the `bus` contract; standalone they are honest no-ops). Grants
  arrive in `init.config.bus`.
- Proof of life: waterworld sheds its HUD chrome in pip because it HEARD
  `wm.mode`, and publishes `guest.waterworld.{win,loss,story-won,lore}`.
- E2E `e2e-bus.mjs` (in the chain) posts attacks from INSIDE real guest
  frames; SDK shapes pinned in `packages/finkgame/test/run.js`.

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

## Snapshot and restore: closing without losing (spec §5.5.4)

- Same shape as every other service: `sdk.onSnapshot(cb)` /
  `sdk.onRestore(cb)` declare the `snapshot` contract by being
  registered. On close the shell asks; on next open it hands the state
  back, right after `init`. Keyed by guest type and written through to
  FoafStore under `FoafOS.snapshotNs` — a shell-owned namespace, so it
  survives a reload and no guest can read another's save. A root without
  `storage` (tellyclub) never gets the grant, so it never persists:
  attenuation applies to the shell's conveniences too.
- **Completing clears the save.** Otherwise every reopen drops the player
  back into a game already won or lost, with no way to start fresh.
- **The trap, and it is a good one.** The first implementation posted
  `{type:'snapshot'}` and then tore the frame down in the same tick. No
  error, no warning, a code path that reads correctly — and every
  round-trip came back empty. Two separate causes, both invisible:
  `_cleanupIframe()` ran synchronously after the request, and once that
  was fixed, `_hideIframeContainer()` blanked `innerHTML` (which destroys
  the browsing context) because the guard it used had already been
  nulled. **Only measurement found either.** Never accept "the code
  sends the message" as evidence; compare state *through* a close.
- The wait is bounded (400ms) and the window closes immediately from the
  player's point of view — pointers cleared, container hidden, story
  resumed. Only the frame's removal is deferred, instance-scoped so a
  deferred teardown cannot reach a game that started meanwhile.
- Guests may answer `null` to decline. Chess does, mid-animation: a
  half-slid piece would restore to a board that disagrees with itself.
- **Disclosure is part of the feature.** The switcher says *keeps its
  place* / *closing loses it* before ✕ is pressed, on the row and in the
  close button's `aria-label`. GridLuck predates the SDK and is reported
  honestly rather than losing the player's game quietly.
- E2E: `node inklet/finkapp/test/e2e-snapshot.mjs` — two unrelated
  adopters (mudslider, chess), the disclosure, a real close (container
  emptied, no live frame), and proof a silent guest cannot hang it.

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

## Headless QA deep-dive (July 2026) — `docs/qa-headless-20260725.md`

`npm run test:fink:qa` = `qa-journey.mjs` + `qa-games.mjs`. Read the doc
before writing another harness; these traps each cost a wrong conclusion.

- **qa-journey**: a 21-step OS session (story → drawer → home → office
  app → TV → switcher → volume → maker → game → split → pip → pause →
  quit → skins) at phone/tablet/desktop, re-checking the SAME invariants
  after every step — overflow, offscreen-but-focusable, unnamed control,
  target < 24px, dialog focus/aria-modal, pad occlusion, errors. It plants
  known faults first and fails loudly if it cannot see them; **an audit
  that silently stops working reports clean forever.**
- **qa-games**: differential responsiveness. Measure idle, measure driven,
  compare. "The pixels changed" proves nothing when a game self-animates.
  7/7 respond. Also reports per game whether the master volume reaches it.
- **Audio is a host service and a guest must OPT IN.** A guest that never
  calls `sdk.onAudio` has no `audio-level` message to act on, and one that
  connects effects straight to `audioContext.destination` has nothing to
  turn down even if it did. Both were true of mudslider ("muting
  mudslider does nothing" — correct). Fix is a single master gain plus
  `sdk.onAudio`. Only robbin is still un-mutable, and says so.
- **Audio must not outlive the thing that started it.** `# FOLEY:
  water(...)` is a LOOPING noise bed with a 60s tail, and opening a game
  window did not stop it — riverbend's river played on under gridluck.
  Mute HID the leak rather than causing it (mute is a level, not a stop),
  which is why it went unnoticed. `fink-player.js` stopped foley on story
  change; `fink-minigames.js` now does the same when a game WINDOW opens
  (inline minigames are part of the story surface, so they don't).
  Locked by `e2e-audio-leak.mjs`.
- The shell registers an `uncontrollable` placeholder for every guest so
  mute over-reports rather than over-promises — but `silent: true` in
  `minigameInfo` suppresses it. A SILENT game in the "cannot be turned
  down" list is a lie in the other direction and dilutes the real
  entries. gridluck opens an AudioContext and connects nothing; chess has
  no audio code at all.
- Found and fixed: closed drawer kept 20 controls in the tab order (hidden
  by `transform` alone — now `inert` + `aria-hidden`); app windows opened
  26–98px off a 390px screen taking the ✕ and SET with them (`makeWindow`
  now clamps to the viewport); drawer targets 19–23px (now ≥24, WCAG
  2.5.8).
- **Traps that made a harness lie** (all recorded in the doc): `scrollWidth`
  cannot see overflow under `overflow:hidden` — measure geometry;
  `querySelectorAll` does not cross a shadow boundary; a 32×32 canvas
  downsample cannot see a one-tile move, so `inconclusive` is a verdict,
  not a pass; probe each game the way it is PLAYED (arrow keys made
  pointer-aimed battleboids look broken); a splash screen is not an
  unresponsive game; `robbin.tube.cam` is an array, so `cam.x` is
  undefined and pins the sample to a constant.

## One class of thing: apps, surfaces, capabilities (July 2026)

foafos used to run TWO kinds of thing, and only one boundary was real:
office/media windows got `allow-scripts allow-same-origin`, which on a
same-site URL means the frame keeps the shell's origin — `parent.document`,
`parent.FoafOS` and the shell's localStorage all reachable. The sandbox
attribute there was doing no security work at all. Minigames were
properly isolated (opaque origin). Two postures, one enforced, and
confusing to reason about.

Now everything is an app. `surface` (stage/window/story/panel) says where
it is drawn and confers NO authority; `capabilities` say what it may do.
`sandboxFor(app)` derives the sandbox from capabilities only.

- `packages/foafos/src/store.mjs` — **FoafStore**, the state broker.
  Per-app namespace, quota, audit, refusals on the bus. Backend-pluggable
  (`localBackend` now, cloud later behind `read(ns)`/`write(ns,obj)`).
  A denied snapshot returns **null, not `{}`** — empty reads as "no data
  yet" and an app will overwrite on that basis.
- `inklet/apps/app-sdk.js` — the guest side. In an opaque origin
  `localStorage` **throws SecurityError** (verified). The SDK installs a
  shim via `Object.defineProperty(window,'localStorage',…)` — an own
  property, since the native one is a throwing prototype getter — seeded
  from the `app.init` snapshot so **reads stay synchronous** and existing
  code works unchanged. Writes hit memory immediately and post to the
  broker. Honest limit: NOT multi-writer localStorage; two instances of
  one app will not see each other's writes live.
- Without the capability the shim throws a named `FoafCapabilityError`
  saying which capability is missing — a debuggable message beats a bare
  SecurityError.
- **`same-origin` is a declared capability**, not a default: the escape
  hatch for apps not yet migrated (edot/sheets/calendar/files/robbamp use
  localStorage+indexedDB ~120×). Announced on `sys.app.ambient` and
  listed in the drawer's CAPABILITIES section. `ambientApps()` counts
  them. Target: zero.
- Set `sandbox` and `allow` BEFORE `src`, or the first script runs under
  the wrong rules.
- `e2e-caps.mjs` asserts the boundary by trying to cross it, and drives
  the whole storage path through a real app (channels), not a fixture.

## The status line is the story's (spec §5.5.2)

`# STATUS: <var> [icon=] [label=] [format=number|bar|percent|time|text]
[max=] [always]`, one tag per item. `# STATUS: none` = no bar. A story
that declares nothing gets the old hardcoded three
(diamonds/mega/score), so nothing existing changed.

- Items are keyed by VAR, not appended — a looping knot re-declares its
  tags every visit and appending turned 3 items into 6 then 9. The test
  caught that immediately; it is the obvious bug and easy to miss.
- Cleared on compile, or one story's HUD follows the reader into the
  next (same shape as the foley leak).
- `#stats-bar` is now EMPTY in index.html and built by
  `FinkUI._buildStatusBar()`; CSS colours address `[data-status-var=…]`,
  not fixed ids. Demo: `inklet/demos/status-demo.fink.js` (flock + fuel
  gauge, no treasure economy).
- Still declarative-only. Real per-story JS widgets should be apps with a
  `status` surface and `vars:read` — sandboxed like everything else —
  NOT story JS evaluated in the host page, which would hand story files
  the ambient authority we just took off the Office apps.

## Roots and the app tree (July 2026)

`?root=<id>` selects a **root manifest** (`inklet/finkapp/foafos-root.js`):
`glitchcanary` (default, boots a story — unchanged), `office` (edot, no
story engine at all), `webtv` (channels, no same-origin). Unknown ids fall
back to the default and say `fellBack` on `root.ready`.

- Before this the shell booted **a story or nothing** — `DEFAULT_FINK_FILE`
  auto-loaded by `fink-player.js` — so "foafos as an office suite" needed
  a fork. `?root=office` now comes up with **0 stories compiled**
  (asserted). An explicit `?story=` still wins over the manifest.
- `AppTree` (`packages/foafos/src/apptree.mjs`) holds running instances as
  a tree. `FoafOS.apps`, root node at `FoafOS.rootNode`.
- **ATTENUATION is the point:** `grant(child) ⊆ grant(parent)`, enforced in
  `spawn()`, refusal published on `app.spawn.refused` with the excess
  named. Root is everyone's ancestor, so trimming a manifest's
  capabilities really locks an installation down — webtv holds no
  `same-origin`, therefore nothing beneath it can be granted it. Verified
  in the running page, not just in the data.
- **Close cascades**, deepest first, so an `onClose` that inspects the
  tree sees a consistent one. An `onClose` that throws does not strand the
  rest of the subtree. Suspend/resume take a whole subtree.
- Spawning under a closed parent is **refused**, never silently reparented.
- `rootOffers()` gates `launchApp` — an app outside the installation is
  refused with `app.launch.refused`, not quietly opened.
- **Shell chrome is apps** (July 2026). FIVE pieces: breadcrumb, story status
  line, FINK load meter, the bottom-left story menu (`radial-menu`) and the
  dev panel (`dev-panel`). Each has `surface: 'chrome'` and a `mount` id, and
  the root manifest's `apps` list decides whether it exists. Not yet
  converted: `#narrative-view` (present and full-screen even on a storyless
  root) and `.fink-header` (`display:none` on every root — its three buttons
  are dead everywhere). Offered → spawned
  into the tree and the element stays; not offered → the element is
  PARKED (removed from the DOM, kept in memory with its parent/next
  sibling so it can come back with its listeners intact — the breadcrumb
  caches its DOM and binds once, so destroy/rebuild would return it
  inert). `:root[data-root-storyless]` still gets set, but it no longer
  hides anything: the old `display:none !important` rule was the mistake,
  because the chrome still existed, still had ids the ink engine wrote
  into, and still sat in the a11y tree.
  - **Assert absence on `getElementById`, never computed style** — the
    whole difference between this and the CSS version is invisible to a
    style check.
  - Launching a chrome app TOGGLES it; the picker renders those tiles with
    `aria-pressed` and an on/off marker, because a toggle that looks like
    a launcher is a small lie.
  - The switcher counts them separately ("Running 1 + N chrome") and sorts
    them last: they are genuinely running apps, but "Running 4" for one
    story and three status bars is a true number that reads as a wrong one.
  - **CONVERT THE FURNITURE, NOT THREE PIECES OF IT.** The first pass did
    breadcrumb + status line + load meter and stopped, leaving the radial ☰
    hard-coded in `index.html` — so Web TV and Tellyclub, with no story
    engine running at all, still showed NavPath, "Reload story", the
    player's Settings and a `FINK App` link that was an ABSOLUTE URL with no
    `?root=`: a one-tap exit from the installation, which also broke on a
    local server. danbri found it on a phone; no test could, because
    `e2e-chrome` hard-coded the same three ids the conversion did.
    Now: `CHROME_IDS` is derived from `chromeApps()`, and a separate
    `STORY_FURNITURE` id list in the test is the backstop for chrome that
    was never registered at all. When adding narrative furniture to
    `index.html`, give it a registry entry in the same commit.
  - Furniture is also a NAVIGATION surface. An item that leaves the
    installation is worse than a useless one, so check every link in chrome
    for a hard-coded origin and a dropped `?root=`.
- **A CAPABILITY NOTHING GRANTS IS A DEAD APP.** Found twice in one day.
  First: Maker and Logger declare `['shell']`, no root held `shell`, so
  `launchApp` refused them — every press of those picker tiles was a no-op,
  masked because the drawer button called `openLogger()` directly. Then,
  hours later, adding `secrets` to edot without adding it to the roots
  killed edot outright ("edot frame never appeared" — caught by e2e-caps,
  which is the only reason it did not ship). **When you add a capability to
  an app, add it to every root that offers that app**, and check the app
  still launches rather than assuming.
- **The tree has real branches:** the loaded story becomes a node under
  root (`FoafOS.storyNode`) and games open UNDER it, so closing the story
  tears down its games for real (guest frame gone, WM inactive). Done by
  OBSERVING `story.state` and `minigame.instance` in the shell — the ink
  engine and minigame host stay unaware, so if the wiring is wrong it is
  wrong in one file.
- The real teardown is `FinkMinigames.endMinigame()`. There is no
  `closeMinigame` — an `onClose` calling it is a silent no-op that leaves
  the guest running while the tree reports it gone. (Caught here by
  checking; `FinkWM.close?.() ?? FinkMinigames.closeMinigame?.()` in older
  tests only ever worked because of the `??`.)
- Locked by `e2e-root.mjs` (16) + `apptree.test.js` (8 unit).

## alpha1 surfaces: picker, switcher, suspension, logger

- **Picker** (`openHome`) lists only what the ROOT offers (`rootOffers`).
  It used to list the whole registry, so an office install showed games it
  would then refuse to launch — an icon you can press that does nothing is
  worse than no icon.
- **Switcher** (`openSwitcher`) renders the APP TREE, indented, built by
  walking `FoafOS.apps` rather than polling each subsystem's idea of a
  window. Per-row ⏸ and ✕ act on the SUBTREE and say so in their
  aria-label ("and 1 beneath it") — a grouped-window UI that takes three
  things by surprise is the classic failure.
- **Suspension**: `FoafOS.setSubtreeSuspended(id, bool)` sets the tree
  flag AND reaches the things in it (guest pause, `app.suspend` postMessage
  to window apps, a `.suspended` class). A flag nobody acts on is the same
  bug as a capability nobody enforces.
- **Logger** (`openLogger`, Apps → Make → 📜) is the bus as a filterable
  console with refusals coloured — distinct from the drawer feed, which is
  curated topics as friendly cards. **Subscribe with `'*'`, NOT `'**'`:**
  `FoafBus.match` handles `'*'`, an exact topic, or `'prefix.*'` and
  nothing else, so `'**'` silently matches nothing. Event timestamps are
  `e.ts`, not `e.at`.
- **Tellyclub** (`?root=tellyclub`) is danbri's Archive.org TV browser from
  the isle_of_glitch repo, referenced at its deployed URL. It knows nothing
  about foafos, gets an opaque origin, and SURVIVES because its author
  wrapped every `localStorage` call in try/catch — adaptation from the
  guest side. It does not declare `storage` (without app-sdk it cannot use
  the broker), so its prefs do not persist here, and the registry says so.
  Content cannot be verified headlessly in this environment:
  `net::ERR_ABORTED`, no browser egress.

## Secrets are not storage (July 2026)

Answering "is login the next big puzzle?" — no. `magpie/edot/auth/` is PKCE
S256, 16+ providers, an honest SECURITY.md and **34 passing assertions**.
What was broken is where the token LIVES.

**Measured** under `?root=office`, edot de-privileged, "stay signed in" on:
the bearer token was in `FoafStore.snapshot('edot')` in plaintext AND in
`foafos.store.edot` in plaintext **on disk in the shell's origin**. Nothing
was broken to cause that — reading back what you wrote is what a storage
broker is FOR, which is exactly why a credential cannot live in one.
(`sessionStorage`-scoped tokens are fine: that shim is memory-only, so the
default is *safer* under foafos than standalone. The bus/audit never carried
the value.)

`FoafSecrets` (packages/foafos/src/secrets.mjs) is the same shape as
FoafStore with a deliberately worse interface: **put, names, use — and no
get.** `secrets.get()` exists only to refuse with an explanation, because a
documented refusal is a design and a missing method is an omission. A
separate capability from `storage`, so an app that may keep preferences does
not thereby get to keep tokens.

- Sealed at rest via `session.mjs` (AES-GCM + PBKDF2). **No passphrase means
  no sealing** — it holds them for the run and SAYS `sealed: false`, rather
  than silently writing them out in the clear, which is the bug it exists to
  stop. The drawer's passphrase (`#foafos-pass`, SAVE/UNLOCK/FORGET) seals
  secrets alongside the session — one prompt, not two.
- `hasSealed()` exists because **"you have no key" and "your key is sealed
  here and nobody unlocked it" are different situations**, and reporting the
  first for the second sends a user off to mint a token they already have.
- Unsealing restores VALUES, not GRANTS — grants are made at launch, so right
  after a reload `names(app)` is still `null`. Correct, and asserted.
  UNLOCK also re-runs `aimVerbsFor` for every live node, or the key comes back
  and the verb that uses it stays refused.
- `clearSealed()` on FORGET takes the blob and everything held. Leaving a
  sealed token behind after someone pressed FORGET is the worst reading of
  the word.
- `use(appId, name, fn)` runs `fn` shell-side. It must NEVER accept a
  guest-supplied function — that is reading the secret with extra steps. The
  transport exposes named OPERATIONS.
- A failed `use` reports the error TYPE, never its message: a fetch failure's
  message and URL routinely contain the credential.
- Testing an ABSENCE means grepping the whole observable surface — audit,
  bus, report, sealed blob — for the secret itself. That is what
  `secrets.test.js` does (12 assertions).
## Brokered actions — what "use a secret" MEANS (July 2026)

`packages/foafos/src/ops.mjs`. Taking `get` away leaves the obvious question,
and the wrong answer is "run this function I'm handing you" — a
guest-supplied `fn` receiving the value is `get` with extra steps. So the
wire carries a verb NAME plus data and the shell owns the dictionary:

```
app:   foaf.invoke('git.commit', { path, content, message })  → promise
shell: ops.invoke('edot','git.commit',…) → secrets.use('edot','git.token', t => fetch(…))
```

**THE RULE, and it is load-bearing: THE SCOPE SUPPLIES THE DESTINATION, THE
APP SUPPLIES THE DATA.** An op taking its repo or host from the caller is a
signed-request-to-anywhere primitive with a live credential attached — an app
could aim a working GitHub token at any repo that token can reach. So:

- the OP declares which secret it uses; the caller never names one
- the GRANT names the repo/bucket/pod, validated when set (`ops.grant`
  throws), so a manifest typo fails at boot not at someone's first Save
- `api.github.com` is hard-coded in `gitCommitOp`; scope URLs must be https
- the app brings a path — `cleanPath` returns null on any `..` (refuse, never
  resolve) and `withinPrefix` is a boundary check, not `startsWith`
- **no scope configured → refused.** A verb aimed nowhere must not write to
  someone's repo. `FoafOS.aimOp(appId, cap, scope)` sets it; the caller is the
  **Publishing** panel (`foafos-shell.js`, `openPublishing`, app id
  `publishing`, `surface: 'panel'`). Add `publishing` to any root that grants
  a verb capability, or the grant is unusable — the dead-capability shape
  again, arriving from the UI side.
- **THE SHELL COLLECTS THE CREDENTIAL, NOT THE APP.** A token the app collects
  is a token the app has held, however briefly. Publishing types it straight
  into `secrets.put` shell-side and clears the field, so the value never
  enters the guest frame even on the way in.
- TWO conditions for a verb grant: the app tree granted the capability
  (attenuation still applies) AND a scope exists. `aimVerbsFor` intersects
  them on every launch — a saved scope must not resurrect a denied capability.
- report a `status`, never a response body: GitHub's own 403 quotes the token
  back at you. A thrown fetch reports `e.name` only (its message has the URL).
- throttled per app per verb per minute, and a throttle is announced.

Caller: `BrokeredGitSource` (`magpie/edot/js/resource-source.js`) — a repo
mount with no token in it. Reads come from its local mirror (reading a private
repo needs the credential it deliberately lacks), so the semantics are
*publish*, not sync, and it says so. A refused publish keeps the edit locally
and reports the status. `remove` is local-only and says there is no
`git.delete` verb; binary is refused rather than mangled through a text verb.

`s3.put`/`solid.put` ship and are tested but have **no callers**, so no app
declares those capabilities — a vocabulary with unused names starts lying.

Tests: `ops.test.js` (19 — about half are attempts to escape the grant),
`sigv4.test.js` (5, incl. AWS's published vector),
`test-brokered-git.mjs` (18, two of which read the class's own source back to
check it never mentions `api.github.com`), and the e2e-caps leg where a real
sandboxed app commits a file it has no credential for while every request
goes to the granted repo — `page.route()` intercepts, so the shell's own
`fetch` runs (remember the CORS preflight: fulfil `OPTIONS` too).

## Migrating an app off `same-origin` (the Calendar pattern)

Calendar is the first Office app off the escape hatch, and the pattern
generalises. Ambient holders: 5 → 4 (edot, sheets, files, robbamp left).

- Load `inklet/apps/app-sdk.js` FIRST in the app's HTML, before anything
  else, so `localStorage` is the brokered shim before app code runs.
  Harmless standalone: nothing sends `app.init`, so the native APIs are
  left alone.
- **IndexedDB is the hard part** — the shim only covers
  localStorage/sessionStorage, and an opaque origin refuses `idb.open()`
  outright. Calendar's `store.js` now has `openBest()`: try IDB, and on
  failure use a `KvDb` with the same private API backed by two JSON
  arrays in (brokered) `localStorage`. Chosen ONLY on failure, so the
  standalone app keeps its indexes and cursor deletes.
- A refused write must be noticed. `KvDb._write` warns rather than
  swallowing — a save that silently did nothing is worse than an error.
- Then drop `same-origin` from the registry entry and keep `storage`.
- Prove it de-privileged: `e2e-caps` asserts `parent.document` throws,
  `store.usingBroker === true`, a real round-trip (calendar + event, Dates
  rehydrated), that the shell holds the bytes, and that the ambient count
  dropped. Standalone `test-calendar.mjs` must still pass — it does, still
  on IDB.

**Files (July 2026), the second one, and a different wall.** Files stored
nothing of its own — it held the hatch for **OPFS**, and OPFS needs an
origin to hang a storage bucket on, so `navigator.storage.getDirectory()`
rejects in a sandboxed frame no matter who constructs the source. The
fallback is therefore a whole `ResourceSource`, not a key/value store:
`BrokeredResourceSource` in `magpie/edot/js/resource-source.js` extends
`MemoryResourceSource` and writes the tree through `localStorage` (base64
bytes in JSON), which under foafos is app-sdk's shim over the broker.

- **PROBE, don't feature-test.** `openDeviceMount()` calls `list('/')` on
  the candidate and only falls back when that actually throws. And it
  probes whatever the kernel handed back too — the kernel's device source
  is an OPFS one as well.
- `getKernel()` reads `typeof localStorage`, and on an opaque origin that
  THROWS rather than returning undefined. app-sdk must be loaded before the
  module, as in calendar.html.
- **A registry URL pointing at a directory is a broken app.** Files was
  registered as `.../edot/files/`, which has no `index.html`: locally the
  frame showed a python directory listing, and on GitHub Pages it would
  404. The app had never once loaded inside the shell. e2e-caps now asserts
  the custom element is present, not merely that a frame appeared.

**edot (July 2026), the cheap one — check before you assume.** edot's own
`same-origin` was cargo cult. The page has no iframes to reach into, every
`localStorage` call was already `try`-wrapped, and `Library.create()`
already tried IndexedDB and fell back to a `localStorage` backend. All it
needed was for that fallback to land somewhere: one `<script src=app-sdk>`
before the module, and the capability dropped. Worth measuring rather than
assuming in BOTH directions — "it looks like it needs the hatch" is how
these get granted, and "it looks like it doesn't" is how a migration ships
broken. e2e-caps asserts the boundary, the shim, the UI coming up, and
`edot.library.v1` reaching the broker.

**Data (July 2026), and the bug the migrations nearly shipped.** Data keeps
one SQLite blob in IndexedDB, refused the same way Calendar's was; the
engine now picks a backend by trying, falls back to the same blob base64'd
through the broker, reports `storageKind`, and ANNOUNCES a refused write
(`storage-error` event + console.warn) instead of swallowing it. Also:
`indexedDB.open()` on an opaque origin can simply never answer, so idbOpen
has a 3s reject — a bare await there hangs the whole boot instead of
failing over.

- **Per-app quotas.** An almost-empty SQLite database is ~43KB base64
  against a 256KB default, so FoafStore grew `quotas`/`quotaFor`/`setQuota`
  and the shell names `sheets: 4MB`. Raising the DEFAULT would have
  dissolved the limit for exactly the apps it exists to bound.
- **app-sdk must probe, not install.** It replaced `localStorage`
  UNCONDITIONALLY, so every page that loaded it for the sake of foafos lost
  its real storage when opened STANDALONE — swapped for a shim that throws
  `FoafCapabilityError` because nothing had granted it anything. edot's
  calls are all try-wrapped, so it just quietly stopped remembering things.
  Now it probes (`localStorage.getItem` in a try) and installs only where
  the native one is unusable. **Data's own standalone suite caught this and
  nothing in e2e-caps would have** — run an app's own tests after migrating
  it, not just the shell's.
- Office root now holds **no `same-origin` at all**: every app it offers is
  migrated, so by attenuation nothing it opens can have one either.

## Stories are privileged over apps — know this

Asked directly ("does foafos privilege stories over office docs?") and
the answer is yes, enormously. The story is not an app; it is part of the
kernel.

- `FinkInkEngine` / `FinkPlayer` / `FinkUI` are **host-page globals**. A
  story runs in the shell's own document.
- Its tags reach `FinkAudio`, `FinkFoley`, `FinkMinigames`,
  `FinkNavigation`, `FinkBreadcrumb`, `FinkUI` and `FoafOS` directly.
  Nine tag verbs (`AUDIO FOLEY STOP_AUDIO FINK LINKREL MINIGAME STATUS BG
  CLASS`) and **not one is capability-checked** — grep the engine, player
  and ui for "capabilit" and you get nothing.
- So a story can launch an app, navigate the whole shell, restyle the
  host document, drive audio directly, write any variable ungoverned, and
  be snapshotted into the dream stack. No app can do any of those.
  `FoafVars` governs guests writing to the story; nothing governs the
  story.
- `capabilities` on a `surface: 'story'` row therefore **describes,
  it does not constrain** — flagged with `enforced: false`, reported by
  `unenforcedApps()`, printed in the drawer, and asserted in
  `e2e-caps.mjs`. They previously said `[]`, which read as *less*
  privileged than a spreadsheet when the truth is the reverse.
- Why it matters beyond tidiness: the Finkiverse links to FINK documents
  we did not write. Gating `launch`/`navigate`/`chrome` for an untrusted
  story is the open work. Some privilege is legitimate — the story IS the
  session — but that argues for splitting the narrative RUNTIME from the
  story DOCUMENT.

**The boxed runner exists now (Phase 2 Slab 1, 2026-07-28).**
`inklet/apps/storyrunner/` is a FinkStoryRunner that runs the whole thing
sandboxed: it compiles (backticks browser kernel) and plays a real ink
story INSIDE an opaque-origin app frame, renders prose+choices in its own
document, styles itself (`# BG:` hits the frame, not the host), and reaches
the shell only via `foaf.storyRequest` → capability-checked `story:*` verbs
(`story.request` handler in `governAppFrame`) + the scoped bus. `# MINIGAME:`
becomes a governed `story.launch` that opens a separately-boxed guest — up
AND down. `e2e-storyrunner.mjs` proves containment: `parent.FoafOS` /
`parent.FinkInkEngine` / `parent.document` all throw from inside.
- This runs PARALLEL to the live host-side player (unchanged, still
  privileged). It is NOT yet a replacement — no media (C8), no
  link/navigate wiring. Threat model + phases:
  `docs/fink-story-sandbox-threatmodel-20260728.md`.
- **Boxes within boxes (Slab 2):** the runner does NOT run the story's JS
  in its own frame — `extractInBox()` runs it in a nested throwaway
  `sandbox="allow-scripts"` iframe using the frozen backticks
  `INSTALL_CAPTURE_SOURCE`, and gets back only harvested strings. So a
  hostile `.fink.js` can't touch the runner's own foaf, let alone the
  host. Recursion end to end: shell → runner → compile box; shell →
  runner → governed guest.
- **Media roles (Slab 3):** a beat's central media has a prominence role —
  `hero` (media owns the screen, prose is a bottom caption), `feature`
  (default: pinned media, prose below), `accent` (small top-right thumb,
  text leads; tap to enlarge). SHORT authoring form
  (`# VIDEO: <id> hero`, `# IMAGE: pic.svg accent`), MAPPED to render-hint
  spec tokens (`X-MEDIA-HERO/FEATURE/ACCENT`) so it shares the paged-beats
  render-hint namespace. `MEDIA_ROLES` in storyrunner.js is the one map;
  CSS keys off `#stage[data-media-role]`. A bare 11-char `# VIDEO:` value
  → youtube-nocookie embed, in-frame. Doc:
  `docs/fink-media-roles-20260728.md`; layouts asserted (geometry + spec
  token) in `e2e-storyrunner.mjs`. Still boxed — media renders in the
  runner's own frame. Remaining for parity: local audio, and the
  link/navigate verbs.
- `app-sdk.js` grew `foaf.storyRequest` and `foaf.bus`, and now replays
  `onInit` to a late (module) listener — app.init can land before a
  `type=module` app registers its handler; without the replay the app
  never boots (this cost a debugging pass).

## Service inventory (spec §5.5.3)

`FoafOS.services()` names every privileged thing and its honest state:
`brokered` (storage, vars, audio, input — a real broker, per app),
`shell` (wm, announce — the shell owns it, apps ask via verbs), and
`unimplemented` (geolocation, capture, gpu, cast — in the vocabulary,
nothing behind them). The drawer prints the unimplemented ones. A
vocabulary containing names nothing implements is how you end up
believing a boundary exists.

## Media in stories

- `# VIDEO:` accepts a local `.mp4/.webm/.mov` OR a bare 11-character
  YouTube id (`fink-ui.js` sniffs on length). Maple Hollow
  (`cozyverse/maple-hollow.fink.js`) is 13 embeds / 11 distinct ids, none
  of them in the repo.
- The video container is inserted ABOVE the story text, so it used to
  scroll off the top as passages accumulated with nothing to say it was
  up there. It is now `position: sticky; top: 0` inside `#narrative-view`
  (the scroller), plus a collapse control to hand the screen back.
- Collapsing has to zero `padding-bottom` as well as set `height`: the
  YouTube branch builds its 16:9 box with `padding-bottom: 56.25%`, and
  **an element can never be shorter than its own padding** — the same
  lesson as the split-pane layout. Setting height alone did nothing.
- Repo video weight (July 2026): 7 mp4s, ~122 MiB, largest 66 MB;
  `.git` is 624 MB. `media/d94a6357-….mp4` and
  `inklet/media/d94a6357-….mp4` are byte-identical duplicates (16.5 MB
  each) — flagged, NOT deleted (owner's call, CLAUDE.md).
- GitHub Pages will serve mp4 with byte-range seeking, but **Pages does
  not resolve Git LFS pointers**, so LFS is not a way out. Git keeps every
  binary forever, which is why re-encoding in place still grows the repo.

## Story checking: `npm run fink:check` (July 2026)

`inklet/tools/fink-check.mjs` — offline, no browser, whole corpus in
seconds. Extracts with gcfink, compiles with real inkjs, then PLAYS every
story breadth-first over the choice tree, using `state.ToJson()` /
`LoadJson()` to revisit a point and take a different option. It
complements `inklet/validation/checkfink.mjs`, which drives a real
browser and answers "does the player load this"; this answers "does it
hold up when someone wanders around in it".

**Markdown is not ink, and the corpus was full of the confusion:**

- `*** HAMPSTEAD ACHIEVED ***` at column 0 is not emphasis, it is THREE
  nested one-time choices. Hampstead's victory screen rendered no text at
  all — the "Final Score" line was swallowed inside the phantom choice —
  and offered a bogus option labelled `HAMPSTEAD ACHIEVED ***`. **Nothing
  errored.** The E2E played that story every run and never looked at it.
- `- **Nominative** (subject)` is a gather whose content starts with `*`,
  so the Ukrainian tutorial's grammar list became two spurious choices.
- Escape with `\*`. Scan: `grep -rn '^\s*-\?\s*\*' --include=*.fink.js`
- fink-check flags this directly (LEAKED EMPHASIS) by reading the RUNTIME
  choice text — labels here never legitimately contain an asterisk.

**Other faults it found, all months old:**

- A final knot with no `-> END` — the Ukrainian tutorial died the moment
  you declined the intro.
- Knots reachable from a hub whose options are all one-time or all
  conditional: come back once too often and "ran out of content". The fix
  is a fallback choice — `*` or `+` with only a divert and no text, taken
  only when nothing else qualifies.

**Gotchas earned the hard way while fixing them:**

- A `//` comment line INSIDE a choice block makes this compiler lose every
  knot defined after it. Put the note above the knot header.
- A backtick anywhere in a `.fink.js` comment closes the template literal
  and the file extracts as empty ink. The tool reports that case by name.
- `world-between-worlds` diverts to `_inventory`, which the PLAYER injects
  (`getPrivateInventoryInk`). fink-check injects a stub, so a story is not
  failed for depending on shell furniture — and does not drift when that
  furniture changes.

## A ROOT IS NOT A SECURITY BOUNDARY

`?root=office` is a query parameter on one origin. Anyone can type a different
one. So **per-root storage scoping buys nothing against a hostile user**, and
describing it as security would be a false impression of separation — worse
than visible sharing. The real boundaries: the origin, the app sandbox (opaque
origin per frame), and the app tree's attenuation within a run.

What IS worth scoping per root, and the only thing that was: **verb
destinations** (`foafos.op-scopes`). Measured — a repo aimed under
`?root=office` (four capabilities, six apps) came back armed under `?root=`
(holds `launch`, offers every app, runs Finkiverse documents with their
capability list unenforced). A destination is half an authority: "commit to
THIS repo". The credential half was already gated — secrets are memory-only
unless sealed, so a token cannot cross the navigation a root switch requires.
Now keyed `{rootId: {appId: {cap: scope}}}`, legacy blobs dropped rather than
migrated. Defence in depth, not a wall, and the comment says so.

Sharing that is CORRECT and should not be "fixed": `foafos.store.<appId>` (the
app is the unit — your last-tuned station should not reset because you opened
the app from a different installation), `foafos.session.v1`/`foafos.secrets`
(an identity is a person), `shell:game-snapshots`, and `foafos.skin` (a device
preference — though per-appliance skins are a coherent alternative and the
owner's call, not ours). Full reasoning:
`docs/foafos-state-scoping-20260726.md`.

## Your tool listing is a VIEW of the repo, not the repo

Recorded because a fresh session failed it on the first question asked, and
because the session writing this had made the same mistake twice in the
preceding twenty minutes.

Asked "what skills have we got here", a new instance described both
`.claude/skills/` entries accurately and finished with **"nothing else
repo-specific."** Four more `SKILL.md` files had been sitting in
`lucid/skills/`, tracked in git for nine days. `find . -name SKILL.md` would
have returned six. It had answered a question about the repository by reading
the list of tools it had been handed.

The same shape, three places this repo has been bitten:

| the view | what it is not |
|---|---|
| the skills listing | every skill in the tree |
| `getComputedStyle` says the background is `rgba(0,20,0,.6)` | how the panel looks over an app — that value was *correct per the skin* and wrong in situ |
| the suite is green | the suite covers it (`e2e-desktop` was green by not running) |
| the code path is right there | it ran (the snapshot request was posted into a destroyed frame) |

**So: for any question of the form "what/how many/is there any X in this
repo", run the search before answering, and if you did not, say you did
not.** A negative claim is the expensive kind — `docs/fable-audit/` found
about a third of them wrong on the first pass. Two of mine were wrong in one
turn: "edot has ~0 lines of documentation anywhere" (it has a README and
eight sibling docs) and "the lucid scene ledger is stale" (it reconciles
exactly; I had counted toc ENTRIES against distinct scenes).

## Testing discipline — what this suite gets wrong when it gets it wrong

Every item here is a real failure from this repo, not general advice. They
share one shape: **a test that encodes what the author remembered can only
check what the author remembered.**

- **DERIVE THE ENUMERATION, NEVER WRITE IT.** `e2e-chrome` hard-coded
  `['breadcrumb','statusline','loadmeter']` — the same three ids the
  conversion had done — so when two more pieces of story furniture turned out
  to be hard-coded in `index.html`, the suite had nothing to say. It was found
  on a phone instead. Now `CHROME_IDS` comes from `chromeApps()`. The same bug
  hid in two COUNTS in the same file (the picker's toggle tally and the
  switcher's `+ 3 chrome`), so check for magic numbers that shadow a list.
  - And where the thing you must check is *unregistered* — the case a derived
    list structurally cannot see — keep an explicit list IN THE TEST as a
    backstop (`STORY_FURNITURE`), so new markup without a registry entry
    fails rather than ships.
- **A DISPLAY STRING IS NOT AN IDENTITY.** `e2e-desktop` matched
  `/data|channels/i` against switcher card TEXT, so renaming an app broke a
  test about window management. Assert on app **ids**; if you must check that
  a label is shown, import the registry and take the expected string from it.
- **CHECK THE SKILLS ARE DISCOVERABLE.** `npm run skills:check` — a skill in
  the tree that nothing in `.claude/skills/` points at is invisible, and that
  is how four Lucid skills went unoffered for nine days. It also catches a
  DANGLING index entry, which is worse: the runtime advertises a skill that
  cannot load. `--fix` creates the symlinks.
- **CHECK THE SUITE IS IN THE CHAIN.** `e2e-desktop` was not in
  `test:fink:e2e` at all, so it sat broken while every regression came back
  green. Run this after adding any suite, and occasionally anyway:
  `ls inklet/finkapp/test/e2e-*.mjs | while read f; do grep -q "$f" package.json || echo "ORPHAN $f"; done`
  Writing that line down immediately found two MORE orphans
  (`e2e-conformance`, `e2e-instances`) — both passing, both unrun for who
  knows how long. The chain is 18 suites as of July 2026; if that number and
  the file count disagree, one of them is lying.
- **ESTABLISH WHOSE FAILURE IT IS BEFORE FIXING IT.** `git stash` → re-run →
  `git stash pop`. Two failures in one day were pre-existing (edot's 404s, an
  html-validate finding); one was mine. Fixing a pre-existing failure is
  fine — silently taking the blame, or silently assigning it, is not.
- **A FAILING ASSERTION IS A HYPOTHESIS TOO.** After a reload I asserted
  `secrets.names('edot')` would return the unsealed names. It returns `null`,
  and the CODE was right: grants are made when an app launches, so a restored
  secret is deliberately not yet grantable. The test was wrong. Check which of
  the two is the claim before changing either.
- **PLAYWRIGHT ACTIONABILITY FAILURES ARE USUALLY REAL.** "waiting for
  locator … 2 × waiting" on a button that clearly exists meant Maker and two
  widget windows were sitting on top of the drawer. Clearing the desk was the
  fix; `force: true` would have buried a genuine "control under another
  window" defect. Never force to make a red test green.
- **COMPUTED STYLE CANNOT SEE A CSS REGRESSION IN CONTEXT.** A shell panel
  opened over an app showed the app's document through it. The computed
  background was `rgba(0,20,0,.6)` — *correct*, per the skin. Only a
  screenshot showed it was wrong for a form you type a token into. Screenshot
  anything you have restyled, and LOOK at it.
  - Skins load after the shell CSS, so a skin's `.foafos-window` beats
    `foafos-shell.css`. Win it with a second class (`.foafos-window.foafos-panel`),
    not `!important`.
  - **AND FIX EVERY SURFACE OF THAT KIND, not the one in the screenshot.** The
    panel fix left `#foafos-drawer` translucent — same skin variable, same
    unreadability, reported from a phone hours later. Translucency is fine for
    chrome over prose; it is not fine for a surface carrying a passphrase
    field. Assert on the computed **alpha**, not on appearance.
- **OPTIONAL CHAINING HIDES TYPE ERRORS.** `apps.nodes?.find?.(…)` on a
  **Map** is `undefined`, which made a whole re-grant loop a silent no-op that
  read as working code. `?.` on a collection you have not checked the type of
  buys nothing but silence.
- **`pgrep -f` AND `pkill -f` MATCH THEIR OWN COMMAND LINE.** A `pkill -f
  e2e` killed its own shell (exit 144); an `until ! pgrep -f "npm run test"`
  loop never terminated because the loop's own command line contained the
  pattern; and one of those kills took out a regression mid-flight and
  produced a spurious ROOT E2E failure I briefly believed. To wait for a
  long suite, redirect it to a log file and poll for a sentinel you wrote
  yourself (`echo "EXIT=$?"` at the end), not for a process name.
- **AFTER ANY "WHICH PARTS OF THE UI EXIST" CHANGE, OPEN EVERY ROOT AND
  LOOK.** The two most visible defects of July 2026 — a story menu on a Web
  TV, and the dev panel it could open — were found by danbri on a phone, and
  neither was findable by the suite as written. A four-line probe that loads
  `''`, `?root=webtv`, `?root=tellyclub`, `?root=office` and reports
  `getComputedStyle` + `getBoundingClientRect` for each piece of furniture
  takes two minutes and would have caught both. Do that before claiming a
  conversion is finished.
- **CHECK THE LINKS IN CHROME.** Furniture is a navigation surface too. The
  story menu's `FINK App` item was an absolute `https://danbri.github.io/…`
  with no `?root=`: a one-tap exit from the chosen installation, and broken on
  any local server. Grep new chrome for hard-coded origins and dropped query
  params.

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
- **BUT `python3 -m http.server` IS NOT ENOUGH THE MOMENT AN APP FRAME IS
  INVOLVED, and the failure looks like a broken app rather than a broken
  server.** A sandboxed app frame has an opaque origin, so its `type="module"`
  scripts are fetched with `Origin: null` and need
  `Access-Control-Allow-Origin`. Without it the frame renders its static
  markup and none of its JS-built content: the Soundtrack app showed its
  header, its transport buttons and an EMPTY station list, and I nearly
  reported a data bug (July 2026). Copy the `CORS_SERVER` snippet out of
  `inklet/finkapp/test/e2e-foafos.mjs` for any probe that opens an app.
  GitHub Pages sends `access-control-allow-origin: *`, so production is fine
  — which is exactly why this only ever bites locally.
- **Serve the layout the page actually ships in.** `test-edot.mjs` served
  from `magpie/edot/`, so `edot.html`'s legitimate
  `../../inklet/apps/app-sdk.js` clamped to `/inklet/…` and 404'd — two
  unexplained console errors in that suite for who knows how long. Root the
  server at the repo root and put the path in the URL instead.
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
