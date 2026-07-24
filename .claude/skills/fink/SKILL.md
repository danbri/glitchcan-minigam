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
  and MUST hide their own touch controls — an in-iframe pad can't see
  the visible viewport or safe-area insets (env() is 0 in an iframe), so
  it ends up under browser chrome. Use `100dvh`, never `100vh`, for
  window/app height. Pad shows only when: game active + controls≠none +
  not pip + no gamepad + pointer:coarse (tests need `hasTouch: true`).
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
  bar. Never reintroduce a second geometry owner.
- Layout trap: `#minigame-view` is a `.view` flex child with
  `min-height:0` — a bare `height:` on it gets crushed to a sliver.
  Split uses `flex: 0 0 52%` + `min-height` instead.
- Buttons `#minigame-pause` and `#returnToStory` live IN the chrome but
  are wired by FinkMinigames — keep those ids stable.
- E2E: `node inklet/finkapp/test/e2e-wm.mjs`. Grip taps TOGGLE collapse
  and the toolbar auto-collapses after 4.5s — tests must set collapse
  state explicitly (`FinkWM._setCollapsed(false)`) before clicking
  toolbar buttons.

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
