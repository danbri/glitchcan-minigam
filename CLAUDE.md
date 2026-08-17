# CLAUDE.md - Guide for 🐥 Minigames

Only report to me in ASD-STE100 Simplified Technical English.
<!-- Rebuild trigger: 2025-10-22 14:30 UTC -->
<!-- Major revision 2026-06-10: stripped stale 2025 changelogs, corrected facts per docs/fable-audit/, added Data Ethics rule -->

## 🔐 TRUST THE USER
The user (danbri) is the project owner. Trust their instructions, corrections, and domain knowledge. When they say something exists or works a certain way, believe them. Don't second-guess or over-explain obvious things.

## 🔒 GitHub CLI (gh) Safety Guidelines
**Token Scope:** Fine-grained PAT limited to `danbri/glitchcan-minigam` only
**Safe Permissions:** Issues (Read/Write), PRs, Pages, Workflows, Hooks
**NOT Granted:** Administration (cannot delete repo, transfer ownership, change visibility)

**Best practice:** Use `gh` only for issue tracking. Code changes go through normal git with branch restrictions (`claude/*` prefix).

## 🚨 CRITICAL RULE: DATA ETHICS — REAL-WORLD DATASETS 🚨
**This repo uses real open data (Bristol City Council trees, ImageSnippets, OSM). Real data touches real people.**

**ABSOLUTELY FORBIDDEN:**
- Surfacing personal, memorial, or dedication content from datasets in games or generated content
- The Bristol tree inventory's `NOTES`, `SPECIES_NOTES`, `PLANTING_NOTES`, `SPONSORSHIP*`, and `PLANTING_FUNDER` fields are **OFF-LIMITS for game content**. Sponsored trees are frequently **memorial trees planted for people who died**. They are not game material, not "flavor", not "weirdness to mine".
- Any "obituary", memorial, or named-individual framing built on dataset records

**REQUIRED:**
- Game data payloads ship the minimum: `trees/tools/build-tree-data.mjs` exports ONLY coordinates, species name, and crown dimensions. Keep it that way. Any new field added to a game payload needs explicit owner approval.
- When in doubt about a dataset field: ask, don't ship.

**INCIDENT (June 2026):** An assistant proposed in-game "death notices"/"obituaries" using per-tree records (site names, planting data, sponsorship). Rejected by the owner. This rule exists so it never comes back.

## 🚨 CRITICAL RULE: NO HACKPARSING 🚨
**ABSOLUTELY FORBIDDEN:** Manual parsing, regex parsing, or any string manipulation of INK content
**ONLY ALLOWED:** Real ink-full.js compiler and Story API
**VIOLATION COST:** Real money wasted, development time lost, 2am debugging sessions
**ENFORCEMENT:** Any hackparsing implementation must be immediately deleted and rebuilt with real INK engine
**EXCEPTION:** Only if User explicitly demands hackparsing for specific use case
**SCOPE NOTE (verified June 2026):** This rule is about INK *story structure*. Narrow regex extraction of FINK tags (e.g. the BASEHREF fallback in `fink-ink-engine.js` / `fink-ui.js` / `fink-navigation.js`) is an existing documented exception — do not extend it.
**REMINDER:** We spent an entire evening until 2am purging hackparsing - NEVER AGAIN

## 🚨 CRITICAL RULE: DO NOT CASUALLY MODIFY SANDBOX CODE 🚨
**THE FINK SANDBOX IS SECURITY-CRITICAL INFRASTRUCTURE**

**INCIDENT REPORT (January 2026):**
Bagend2 loading got stuck at "Loading..." because sandbox code was "casually" modified:
- **The bug:** `fink-sandbox.js` line ~49: `uniqueData.join('\\n')` instead of `uniqueData.join('\n')`
- **The effect:** INK content blocks joined with literal "\n" text instead of newlines, breaking INK syntax structure
- **The symptom:** Stories stuck on "Loading..." - silent failure, no error message

**THE ACTUAL CORRECT CODE:**
```javascript
// CORRECT - actual newline character
const finkContent = uniqueData.join('\n');

// WRONG - literal backslash-n string, breaks INK parsing
const finkContent = uniqueData.join('\\n');
```

**RULES FOR SANDBOX CODE:**
1. **NEVER modify sandbox/iframe code without explicit user request**
2. **NEVER "clean up" or "improve" string handling in content extraction**
3. **TEST LOADING after ANY change** - even "harmless" refactors can break everything
4. **Character literals matter:** `'\n'` is NOT the same as `'\\n'`
5. **When in doubt, DON'T TOUCH IT**

## Project Overview
Browser-based minigames collection with WebGL fluid dynamics, interactive fiction (FINK), SDF rendering (Lucid), and research artifacts. Mobile/touch-focused interfaces. GitHub Pages deployment at https://danbri.github.io/glitchcan-minigam/

**Splat performance (Aug 2026, measured):** PlayCanvas's splat budget/LOD
system is driven by an octree that only the LOD format carries — with
`.compressed.ply` assets every knob of it is inert. `magpie/dbdb/splats/pack/lod/`
holds four-level pyramids; `npm run pack:lod` rebuilds. See the
`splat-discovery` skill before touching splat assets or blaming a scene for
being slow.

**THE FOCUS (owner's direction, July 2026):** the FINK game platform, the
minigames (drafts and sketches included), and the office suite — wrapped
behind **foafos** and the kernels in `packages/`: **`finkcore`** (story/data —
formerly `gcfink`, compat symlink kept), **`finkgame`** (the guest/minigame
SDK), **`foafos`** (the shell). `packages/` is a *served runtime location* —
the live site imports from it — not a build convention. Everything else in
the repo is a sibling project or a kept sketch, not the venture; when work
trades off, the platform wins. Map: `docs/foafos-core-map-20260726.md`.

**Accuracy ledger:** `docs/fable-audit/` contains a repo-wide audit (June 2026) of plans vs implementation, including `claims-register.md` — an adversarially-verified claims table. When this file and the audit disagree, check the register. When making confident *negative* claims ("X doesn't exist", "nothing links Y"), verify them with a recorded check first — roughly a third of such claims in the first audit pass were wrong.

**Skills — the convention, and how to keep it honest.** A skill nobody is
offered is a comment in a file: four Lucid skills sat in `lucid/skills/` for
nine days while every session was told this project had two, both about FINK.
So:

> **Skills live next to the code they describe, at `<area>/skills/<name>/`,
> and are symlinked into `.claude/skills/` so the runtime offers them.**

Co-located because a skill belongs to its subproject (extract `trees/` and its
skill goes too) and because the person editing the code is looking at the
right file. Symlinked rather than copied because two copies of a hard-won
lesson diverge and you will read the stale one. `.claude/skills/` is a pure
index: real directories for repo-wide skills, symlinks for co-located ones.
Claude Code picks up a new symlink **mid-session, without a restart** —
verified July 2026.

    npm run skills:check          # every SKILL.md discoverable? malformed? dangling?
    node tools/check-skills.mjs --fix    # create the missing symlinks

| skill | home | reach for it when… |
|---|---|---|
| `fink` | `.claude/skills/` | FINK platform + the foafos shell: file format, ink compilation, sandbox, capabilities, brokers, chrome, testing discipline |
| `glitchcanary` | `.claude/skills/` | story/game CONTENT — authoring `.fink.js`, episode linking, `# MINIGAME:` |
| `edot-suite` | `magpie/edot/skills/` | the office suite at suite level — kernel capabilities, the 13 apps, 9 storage backends, auth, the 53-suite harness |
| `tanks-for-the-trees` | `trees/skills/` | `trees/` — the Bristol data pipeline, BNG↔world coordinates, `host.api`/`__tftt`. **Read its data-ethics section first** |
| `splat-discovery` | `magpie/dbdb/skills/` | Gaussian splats for `magpie/dbdb`: licence-checking source scans, cutting pack elements, LOD pyramids, honest cost measurement. **Read its licence section first** |
| `splat-style` | `magpie/dbdb/skills/` | how a splat LOOKS: runtime grades/stylisation, floater cull, crisping via `setWorkBufferModifier`; and what is offline-only (style transfer, upscaling, gap fill, densification). **Read its silent-failure section first** |
| `lucid-scene-authoring` | `lucid/skills/` | scene JSON — primitives, CSG, transforms, `defs`/`ref`, params |
| `lucid-renderer-interop` | `lucid/skills/` | across Mayfly (WebGL/GLSL) and Stinkyfish (WebGPU/WGSL) |
| `lucid-rigging-and-physics` | `lucid/skills/` | `rig-evaluator.js`, the XPBD stacks, param uniforms |
| `lucid-animation-and-interaction` | `lucid/skills/` | time, looping, the timeline scrubber, camera/gesture |

**Edit the file at its HOME, never through the symlink's path in the index.**

Still with no skill, and deliberately not given a thin one: `magpie/edot`'s
editor internals (`magpie/edot/README.md` is thorough — the skill points at it
rather than duplicating), `magpie/elliott4130` (19 files, has eight docs of its
own), `spectro`, `palace`, `mudslide`, `thumbwar`, `hat`, `plenia`, `furbacca`,
`follyfx`. A skill written without verifying the code against it is worse than
none: it reads as authoritative.

**New model? Start here:** `docs/fable-audit/fable-notes-handoff-20260706.md` — a handoff written for models continuing this collaboration: how danbri works, the engineering norms, the edot architecture + current frontier, hard-won honesty/verification lessons, and a ranked roadmap. Read it once before your first change.

## FINK Player — Current Production Reality (player flipped 2026-07-30)
**The production PAGE is `inklet/finkapp/index.html`. The production STORY
ENGINE is no longer on that page — it is the boxed runner at
`inklet/apps/storyrunner/` ("Finkosphere"), and an ordinary visit boots it.**

That is the layer model in `docs/foafos-story-layering-20260730.md`: the shell
is level 0 and plays nothing; the story runs at level 1, in a frame at an
opaque origin, reaching the shell only through capability-checked `story:*`
verbs. The host-page engine (`fink-ink-engine.js`, `fink-ui.js`,
`fink-player.js` and the modules around them) is **superseded and pending
delete** (issue #779). It still loads, and `?player=legacy` still boots it —
that escape hatch is deliberate, so a field problem with the box does not need
a deploy. `?player=none` opens the shell with no story at all.

**Working on the story engine? Work on the boxed runner.** Change the host
player only to keep the escape hatch alive, or to delete part of it.

- `inklet/app/` is the **older parallel implementation** (8 modules) — kept for reference; finkapp is the canonical page. Do not mirror changes into app/ unless asked.
- `inklet5.html` does not exist and never shipped under that name. `inklet6.html` is a 118-byte redirect to `app/`. Historic references to `toc-simple.fink.js`, `hampstead1.fink.js`, `bagend1.fink.js`, `jungle2.fink.js` are phantoms — the real files are the unsuffixed versions.
- INK runtime `onError` IS wired in `finkapp/fink-ink-engine.js`.
- Layered media path resolution (global base → story BASEHREF → file-relative fallback) is implemented in FinkUtils; config via `fink-config.js` only (no form fields).
- Save/load: partial (localStorage bookmarks in `fink-player.js`, nav cache in `fink-navigation.js`). `inklet/demos/fink-namespace-preprocessor.js` exists but is NOT wired into the player.
- Known-broken content (re-verified 2026-07-26, headless through the PLAYER, not just compile): the Ukrainian story and Maple Hollow are **fixed** — both load and present choices, Maple Hollow via the TOC route too. Still true: Shane Manor compiles and links chess but full gameplay has never been played through (`shane_todo.md`).
- Worknotes: a six-review January 2026 campaign (`worknotes/`) is the best statement of open UX/a11y defects (breadcrumb visibility, loading progress, CSP, ARIA). Largely unaddressed.

### FINK engine architecture (DO NOT BREAK)
- `.fink.js` files contain `oooOO`...`` tagged template literal calls — **JavaScript, not text**. Loaded via script injection into a sandboxed iframe; content captured by the `oooOO` function and returned via postMessage. **Never parse them as text.**
- Real compiler only: `new inkjs.Compiler(finkContent).Compile()` then `new inkjs.Story(...)`. Vendored at `third_party/ink/ink-full.js` (version unrecorded in-file; tooling pins `inkjs ^2.3.2` in package.json).
- INK tags (`# IMAGE:`, `# FINK:`, `# BASEHREF:`, `# MENU:`, `# VIDEO:`, `# MINIGAME:`, `# LINKREL:`, `# ENTRY:`) are legitimate INK extensions used at story or knot level. See `glitchcanary.md` and `docs/glossary.md`.
- **`#` starts a tag in ink**, so a URL in a tag CANNOT carry a fragment: `# FINK: x.fink.js#knot` is two tags and the fragment never reaches the runner. That is why the merged-content entry point is its own `# ENTRY:` tag.
- Reference implementation: `inklet/demos/hamfinkdemo.html`.
- Mandatory test after ANY player change: TOC loads → Episodes → Hampstead plays through, choice text labels visible, no console errors.

### FINK validation
- `npm run fink:check` (`inklet/tools/fink-check.mjs`) — offline story checker, no browser: real inkjs compile plus a breadth-first playthrough of the choice tree. Found (July 2026) that Hampstead's victory screen rendered NO text and a phantom choice, because `*** HAMPSTEAD ACHIEVED ***` at column 0 is three ink choices, not emphasis. Escape prose asterisks with `\*`.
- `inklet/validation/checkfink.mjs` — unified validator (.ink/.json/.fink.js), Puppeteer-based, `--scan` flag, CI exit codes. There is NO `--report` flag.
- Supporting: `validate-fink-puppeteer.mjs`, `validate-fink.html`, `unreachable_knots_tester.html`, `play-fink-cli.mjs`.
- The "fink-audit dashboard" (fink-audit/ folder, GitHub Action, rich metrics) was planned but **never built**. Treat it as an open proposal, not work-in-progress.
- Legacy problem: some FINK files contain AI-generated "Pseudo-Ink" that doesn't compile with real ink-full.js. Validate before trusting any story file.
- Finkiverse map: `docs/fink-ring-viz.html` is a working prototype fed by `inklet/tools/fink-graph.mjs` → `docs/fink-crawl-report.json`; linked from the generated crawl report.

## IMAGE DEPLOYMENT STRATEGY - STATIC FILES ONLY
GitHub Pages serves static files; no dynamic image selection.
- ✅ Create optimized images on disk; reference them directly in IMAGE tags; simple BASEHREF + relative paths (the Bagend pattern).
- ❌ No responsive-image JavaScript, client-side optimization, or device-conditional loading.
- Shane Manor: optimized JPGs **exist** in `inklet/media/shane/{mobile,tablet,desktop}/`. If touching Shane content, reference the optimized variants, not the large originals.
- **NEVER DELETE USER FILES WITHOUT EXPLICIT PERMISSION** — even apparent duplicates. User work has value and history that must be preserved.

## Tanks for the Trees (trees/) — June 2026
`trees/tanks-for-the-trees.html` — mobile-first phosphor-vector tank defence over real Bristol data. Completes the trees/ lineage (Tesla Dragon & MUSK dragon games, bigtrak/3dtanky tank prototypes, Tankoff CodePen).
- **Data (cached in-repo, reproducible):** `trees/data/bristol.osm.pbf` — the COMPLETE OSM Bristol extract (13MB, Geofabrik, ODbL) is the canonical source; `trees/tools/derive-layers.mjs` derives ALL OSM game layers from it offline (roads/water/greens/fabric-with-104k-buildings/pubs). The older `fetch-*.mjs` Overpass tools are superseded (kept for provenance; overpass-api.de needs a real User-Agent). Plus `elevation-bristol.json(.gz)` — 128×128 EU-DEM grid via `fetch-elevation.mjs`; `trees-bristol.json(.gz)` — 35,893 living trees / 115 species via `build-tree-data.mjs` (geometry + species ONLY — see Data Ethics rule above). Lesson (recurring): aggressive point-thinning silently deletes small features — Berkeley Square at 45m, terraced houses at 12m.
- Coordinates: BNG (EPSG:27700) → world x=E−358500, z=−(N−173500); vertical exaggeration 2.4× (`EXAG = 2.4` in `bristol-scene.js` — code is ground truth; an earlier "1.6×" here and in a code comment was stale).
- Vendored `trees/vendor/three.module.min.js` (r169) — no CDN dependency.
- Modes: drive (virtual joystick, auto-aiming turret) and strategic map (tap-select fleet of 3 AI tanks — BRUNEL/CABOT/BANKSY — waypoint orders, tap-again to jack in). `?lite` renders every 4th tree for low-end devices/CI. `window.__tftt` is the headless-playtest hook.
- Aesthetic is deliberately vector/CRT (hidden-line meshes, wireframe canopies, scanline overlay, monospace glow HUD). Keep it; no pastel regressions.

## Development Commands
- **Local server:** `python -m http.server 8080` — the user usually arranges their own server; don't start servers for them unprompted.
- **Validate HTML:** `npx html-validate **/*.html` · **Lint:** `npx eslint`
- **Tests:** `npm test` (Playwright), `npm run test:core` (Vitest). Note: `tests/glsl-codegen.test.js` and `tests/dsl-parser.test.js` are @playwright/test files — don't point vitest at the whole tests/ dir.
- Image tooling: **the remote container has NO imagemagick, ffmpeg or Python
  PIL** (verified Aug 2026) — do not plan a pipeline around them. Crop with
  Playwright's `screenshot({clip})` and re-encode on a `<canvas>` via
  `toDataURL('image/jpeg', q)`; that took 34 render sheets from 35MB to 5MB
  with no native binary. `libimage-exiftool-perl` and `webp` may still be
  present locally; check before relying on any of them.

### Headless browser in the remote execution environment (verified June 2026)
A Chromium exists at `/opt/pw-browsers/`. Playwright works with:
```javascript
chromium.launch({ headless: true,
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
```
WebGL renders via SwiftShader at ~2 FPS on heavy scenes — fine for screenshots and functional playtests, useless for performance feel. **WebGPU is NOT available headless** — headless "visual verification" of WGSL/Stinkyfish silently tests the WebGL path instead. Never claim WGSL fixes are verified from headless captures.

## Code Style
- **HTML:** semantic elements, accessibility attributes, responsive viewport meta
- **CSS:** mobile-first, clean transitions, em/rem units preferred
- **JS:** ES6+, classes for encapsulation, no global variables
- **Shaders:** well-commented GLSL with parameters clearly defined
- **Error handling:** graceful fallbacks for unsupported features
- **Naming:** camelCase for variables/functions, descriptive names, consistent prefixes

## Project Structure
- Each minigame in its own subdirectory with self-contained assets
- Common assets/styles shared between games go in root directory (`media/`)

## GitHub Workflow
- Pages deploys on push to master (`pages.yml`, modern v4 actions); workflow does not modify content
- All changes to index.html and game descriptions are made manually
- PR previews DISABLED (`pr-preview.yml.disabled` preserved for later)
- E2E workflow exists as root `e2e-tests.yml.template` — needs a manual move into `.github/workflows/` (App lacks `workflows` permission; see WORKFLOW-SETUP.md). Until then the Playwright suite has never run in CI.
- Action versions: checkout@v4, setup-node@v4/Node 20+, configure-pages@v4, upload-pages-artifact@v3, deploy-pages@v4

## Adding New Games
- Create directory `newgame/` with `newgame/newgame.html`
- Manually edit root `index.html`: copy an existing game container div; update title, description, device info, links, GitHub source links

## Special Effects (landing page)
- Duck emoji 🐥: continuous heartbeat pulse (2.5s cycle) + random glitch every 10s — CSS animations in index.html header

## Minigame status notes (corrected June 2026)
- **GridLuck:** v1.3.0 is real and committed (`thumbwar/gridluck-game.js:8`); only the HTML `<title>` still says v1.2.0. Features: treasure tiers, key-lock system, synergies, progression, 5×5 zone grid, TV zone.
- **Spectro:** 42 rooms (`spectro/src/rooms.js`), ES6 modules, Jest tests. Known issues: guardian collision detection, jumping reliability, ESC handling in menus. Debug via console output (`Player transition:`, `Deadly collision with:`, `PLAYER DEATH:`, `Jump key pressed:`).
- **TokiTokiPona:** emoji-hint flashcards working; future (low priority): filtering by part of speech, learning modes, progress tracking, pronunciation.
- **magpie/elliott4130:** Elliott 4130 emulator with LISP 1.5; `elliott4130-tests.js` has **133** test invocations (121 `.runTest(` + 12 `.runDirectTest(`, none commented out — verified 2026-07-06). The modern `tests/` suite passes 355/1-intentional-fail + a 43/43 LISP smoke. The hand-written `lisp4130.asm` EVAL genuinely handles CAR/CDR/CONS/ATOM/EQ/NULL/COND today (verified via `node cli.mjs --repl`); the still-broken cases are LAMBDA/LABEL application (hangs) and `;`-comment skipping in the reader.
- Underdocumented but substantial: `palace/` (42-room Westminster MOO), `mudslide/` (10-room isometric adventure), `hat/` (WebGPU Hadley attractor), `plenia/` (particle Lenia), `furbacca/` (real Furby protocol tool), `follyfx/` (acoustics research paper + data). See `docs/fable-audit/06-deep-dive-corrections.md`.

## CodePen prototyping tier
Eleven pens are part of this project's pipeline (mini-chess, boids, INK+video tests, Rockall mocks, Tankoff, emoji particles, bagend SVGs, mock login). Index + mirror script: `codepen-backups/` (mirroring requires an unrestricted network). The FINK TOC Experiments menu links to them.

## ABCD Subagent Parliament - Model Evaluation Methodology
Multi-perspective evaluation for 3D model quality. **Full rules: `lucid/automodel/parliament-rules.md` (authoritative).** The non-negotiables:

- **Showstoppers:** every agent returns a `showstoppers` array; ANY non-empty array → DO NOT COMMIT, no exceptions. Agent D aggregates into `all_showstoppers`. (Exists because a P0 "airplane wings" finding was once ignored and committed anyway.)
- **No view shopping:** never hunt for flattering camera angles; when vision results are unfavorable, FIX THE GEOMETRY.
- **No Agent A contamination:** Agent A's prompt must contain zero species-specific terminology or hints. Validation check: "could someone guess the target from this prompt alone?"
- Agents: A blanked-blind identifier · B informed evaluator · C skeptical slop detector · D moderator aggregating verdicts. Run A/B/C in parallel, then D.
- Reviews: `lucid/automodel/reviews/*.json` + `index.json` (commit both); captures: `lucid/automodel/captures/v{VERSION}-{TIMESTAMP}/` — minimum 6 angles, **never delete captures**; viewer: `lucid/automodel/index.html`.
- Capture: `node lucid/capture-silhouette.mjs <scene.model> <outdir>` (6 angles; uses explicit chromium executablePath — see headless notes; update path on version mismatch).
- Iteration loop: capture canonical view → ABCD → fix P1s → re-run blind test → commit only when showstoppers empty.

## Lucid — current state (corrected June 2026)
Backend-neutral SDF rendering: **Mayfly** (WebGL, `lucid/mayfly/`) and **Stinkyfish** (WebGPU, `lucid/stinkyfish/`), shared JSON scene format, `<lucid-renderer backend="auto">` web component (auto falls back to Mayfly without WebGPU).

**Facts that supersede older claims (see docs/fable-audit/02 + claims-register):**
- Scene corpus: **119 scene JSON files; 79 indexed in `lucid/scenes/toc.json`; 47 orphaned** (e.g. creatures/subag1/*, ablation/old/*). When adding scenes, update toc.json; consider triaging orphans.
- All 119 scenes pass GLSL **and** WGSL codegen headless (June 2026). Codegen success ≠ browser render: Stinkyfish WGSL output remains **visually unverified** (`lucid/stinkyfish/BUGS.md`); verify in a real WebGPU browser via `compare.html`, `scene-catalog.html`, or `index.html?backend=stinkyfish`.
- "Recent Changes" TOC category: `node lucid/scripts/update-recent-changes.mjs --days=14 --max=8` is a **manual script — no pre-commit hook is installed**. Run it after scene changes (or actually install a hook).
- Components defined: lucid-renderer, lucid-scene-picker (has filter bar + search), lucid-scene-params, lucid-orbit-controls, lucid-render-controls, lucid-comparison. `<lucid-timeline>`, `<lucid-node-graph>`, `<lucid-param-editor>` are NOT components — that functionality lives inline in `node-editor.html`.
- Physics: XPBD (`lucid/core/physics/`) IS integrated in the main viewer (index.html instantiates PhysicsScene when `json.physics.enabled` and steps it in the render loop); also in dedicated demos. Node editor has no physics preview.
- `yeti/` aspires to independence from lucid, but `yeti/yeti-creature.js` imports 5 lucid/core modules — yeti/CLAUDE.md's "zero dependencies" claim is currently false in code.
- Entry points: `lucid/index.html` (main viewer), `node-editor.html`, `scene-catalog.html`, `compare.html`. Open integration TODOs: catalog→editor linkage, timeline→rig wiring, node-graph→timeline connections.
- Scenes may appear in multiple toc categories — intentional. Category ids: recent, prim, csg, transform, creatures, physics, archive.

### Lucid debugging — key insight: "Compiling is not enough — what is RENDERED?"
- Quick GLSL check (Node): `loadJsonScene` + `generateGlslFromJson`, inspect output length/uniforms.
- Browser render test: Playwright with the executablePath above; screenshot and actually LOOK at it.
- Compare against known-good commits: `git worktree add /tmp/lucid-yesterday <sha>`, diff generated GLSL, `git worktree remove` when done.
- Common bugs: empty scene with valid shader → missing camera settings, or params using `"default"` instead of `"value"`; fbm/turbulence need integer octaves (`String(Math.floor(octaves))`); params not affecting model → replace hardcoded values with `{ "var": "paramName" }`; ref not rendering → check `defs` has the id.

## FINK JavaScript Structure — READ glitchcanary.md FOR DETAILS
- `.fink.js` files are NOT standard JS modules; `oooOO`...`` template literal calls execute via sandbox script injection (JSONP-like)
- Content extraction is JavaScript execution, NOT text parsing — never wrap oooOO in function calls, never regex it
- INK tags (`# IMAGE:`, `# FINK:`, `# BASEHREF:`) are legitimate extensions used by Inkle and the community
