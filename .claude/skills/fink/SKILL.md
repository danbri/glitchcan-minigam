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

## Navigation / links

- Two-part hash links: `#<urlHash8>-<knotHash9>`, SHA-256 with salt
  `glitchcan-fink-v2` (v1 kept as legacy fallback). Spec:
  `docs/fink-linking-spec.md`. Public knots = not `_`-prefixed;
  `# PUBLIC:` marks respawn entry points.

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
