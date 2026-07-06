# Fable Notes — Collaboration Handoff (2026-07-06)

*Written for the AI models who will continue this collaboration with **danbri** during and after the coming Claude&nbsp;Fable&nbsp;5 access gap. This is orientation and strategy, not a replacement for the primary docs — read it **alongside** `CLAUDE.md`, `glitchcanary.md`, and `docs/fable-audit/`, not instead of them.*

Repo: `danbri/glitchcan-minigam` · deployed to GitHub Pages at <https://danbri.github.io/glitchcan-minigam/> · default branch **master** (Pages deploys on push to master). All paths below are relative to the repo root.

---

## 0. How to use this document

This was assembled from a fresh, adversarial, whole-repo pass (five parallel deep reads, each verifying claims by reading source and *running code*, not trusting docs). Where a deep read contradicted an existing doc, the contradiction is recorded here as a **correction** — because the biggest recurring hazard in this repo is **documentation drift**, and even the correction docs have themselves drifted (see §2).

**Read-first order for a new model:**
1. `docs/fable-audit/` — the accuracy ledger. Start `README.md` → `claims-register.md` → `06-deep-dive-corrections.md`.
2. `CLAUDE.md` — non-negotiable rules and incident lore.
3. `glitchcanary.md` — the project's soul + the FINK technical model.
4. This file — a 2026-07-06 snapshot with focus-area depth and fresh corrections.
5. `worknotes/` — the frozen Jan-2026 FINK UX/a11y review campaign (still the best statement of open FINK defects).

**The one habit that matters most here:** *never assert a negative ("X doesn't exist", "nothing uses Y") without a recorded check (grep/find/git-log/run-it), and web-search anything newer than your knowledge cutoff before claiming it's absent.* The first audit made confident negatives from sampled reading and ~1/3 were wrong. This document itself found several more (§2).

---

## 1. The character of this repo

`glitchcan-minigam` looks, from its landing page, like a grab-bag of browser minigames. It is actually a **deep, under-indexed archive of serious artifacts** produced across many "improve this whole app" AI sessions — each proof-of-concept bounded by one session, then rarely linked back into the whole. The dominant failure mode is **invisibility, not abandonment**: many directories are 80–95% complete and nothing on the landing page points to them.

Concretely, the "minigames collection" also contains: a faithful 1960s British-mainframe emulator running hand-written assembly LISP; a full bilingual scholarly edition of a 1951 Paris AI colloquium; a working client-side office/PIM/decentralised-social suite with 49 test files; a Kanren/RDF logic engine; a WebGL/WebGPU SDF renderer with an ABCD "parliament" model-review process; and a phosphor-vector tank game over real Bristol geospatial data. Treat the repo with more respect than its front page invites.

**Philosophy that recurs (honor it):** static-files-only (GitHub Pages, no server/build step); vendored-not-CDN for load-bearing deps; each game self-contained in its own directory; real open data used honestly and reproducibly; accessibility and "your data never leaves your device" treated as load-bearing, not decorative.

---

## 2. The accuracy ledger, and fresh corrections (READ THIS)

`docs/fable-audit/` is an adversarially-verified June-2026 audit of *documented plans vs. actual code*. Its meta-lesson: the code is generally **ahead** of the docs; and confident **negative** claims are unreliable — of 29 audited negatives, ~14 confirmed, ~9 refuted, the rest partial/moot. **When docs disagree, the claims-register wins; when audit passes 01–05 disagree with 06, 06 wins.**

The 2026-07-06 pass confirmed the drift continues — including inside the correction docs themselves. **New corrections a successor should trust (and ideally fix at source):**

| Claim in a doc | Reality (verified by running/reading) | Where |
|---|---|---|
| `CLAUDE.md`: Elliott `elliott4130-tests.js` has "122 test invocations (not 133)" | It really is **133** (121 `.runTest(` + 12 `.runDirectTest(`, none commented out). The "122" correction is itself wrong. | `magpie/elliott4130/elliott4130-tests.js` |
| Elliott `BUGS.md`/`README`: "EVAL still returns NIL for any list expression" | **False/stale.** `CAR/CDR/CONS/ATOM/EQ/NULL/COND` all evaluate correctly via `node cli.mjs`. README's "End-to-end working today" table is the accurate one. | `magpie/elliott4130/` |
| Elliott README: LISP smoke test "30/30" | Actually **43/43**. | `magpie/elliott4130/tests/test-lisp-smoke.mjs` |
| `trees` `CLAUDE.md` + code comment: vertical exaggeration "1.6×" | Live constant is **`EXAG = 2.4`**. Docs and comment are stale. | `trees/bristol-scene.js:234` |
| parisconf `README.md`: "1953 Paris conference on machine translation" | The digitized document is the **1951** colloquium *"Les Machines à Calculer et la Pensée Humaine"* — different conference, topic, and year. Every other artifact agrees on 1951. README is simply wrong. | `magpie/parisconf/` |
| `docs/glossary.md`: FINK loads inkjs from CDN (jsdelivr 2.2.3) | Production loads **vendored** `third_party/ink/ink-full.js`. `CLAUDE.md` is right; glossary is stale (engine error strings still say "jsdelivr" — vestigial). | `inklet/finkapp/index.html:12` |
| glossary: "FINK = Fun Ink" | `glitchcanary.md` (authoritative) says **FOAFy Ink**. Cosmetic, but pick one. | — |
| `magpie/toc.html`: edot "39/39 checks" | There are **49** `test-*.mjs`; README cites 74+31+14 sub-checks. toc badge is stale. | `magpie/edot/` |

None of these are urgent bugs, but a successor who "trusts the docs" will be misled by every row. **Update — all rows above were fixed at source on 2026-07-06** (CLAUDE.md, the trees code comment, `docs/glossary.md`, `magpie/parisconf/README.md`, and the Elliott `README.md`/`BUGS.md`), each re-verified firsthand by running the code first. The table is retained as a record of what *was* wrong and how the drift is caught. This is exactly "fable's work": audit → verify → correct at source.

---

## 3. Non-negotiable rules (incident-derived; treat as hard constraints)

These exist because violating them cost real money, real 2am sessions, or real ethical harm. Full text in `CLAUDE.md`.

1. **DATA ETHICS — memorial trees.** The Bristol tree inventory's `NOTES`, `SPECIES_NOTES`, `PLANTING_NOTES`, `SPONSORSHIP*`, `PLANTING_FUNDER`, and site/customer fields are **OFF-LIMITS for game content** — sponsored trees are frequently memorials for people who died. An assistant once proposed in-game "obituaries/death notices" from these records; the owner rejected it. `trees/tools/build-tree-data.mjs` must export **only** geometry + species (it currently does — verified: it reads six columns by index and never touches a memorial field). Any new payload field needs explicit owner approval. When in doubt, ask; don't ship.
2. **NO HACKPARSING of Ink.** Ink *story structure* is handled **only** by the real `ink-full.js` Compiler/Story API — never regex/string parsing. The *only* sanctioned exception is narrow regex extraction of a couple of FINK *tags* (the `# BASEHREF:` fallback in `fink-ink-engine.js`/`fink-ui.js`/`fink-navigation.js`). Do not extend it.
3. **Don't casually modify sandbox code.** The FINK `sandbox="allow-scripts"` iframe is security-critical. The **newline-join incident**: `join('\\n')` (literal backslash-n) instead of `join('\n')` silently broke Ink structure → stories stuck on "Loading…" with no error. Never "clean up" string handling in extraction; test loading after any change; `'\n' ≠ '\\n'`; when in doubt, don't touch it.
4. **Static-files-only images.** No responsive/device-conditional/JS image selection (GitHub Pages is static). Optimized files on disk + BASEHREF + relative paths (the "Bagend pattern"). Shane Manor's optimized JPGs are in `inklet/media/shane/{mobile,tablet,desktop}/` — reference those.
5. **Never delete user files** without explicit permission — even apparent duplicates. Never delete ABCD captures.
6. **ABCD Parliament showstopper rule** (`lucid/automodel/parliament-rules.md`): any non-empty `showstoppers` array → DO NOT COMMIT. Agent A must be blind (zero species hints). No view-shopping — fix the geometry.
7. **Trust the user** (danbri is owner). Code goes via git on `claude/*` branches; `gh`/GitHub tools for issues/PRs only.

---

## 4. Focus areas (your named priorities)

### 4.1 Glitch Canary & the FINK / inkle-ink tooling

**What it is.** Glitch Canary is danbri's umbrella for **telling stories across the web through many small, ad-hoc web "minigames" stitched together** — "Minecraft spirit + classic text/graphic adventures + LambdaMOO," a low-stakes venue to explore AI-assisted authoring "without being tedious slop" (`glitchcanary.md`). The narrative spine is **Inkle's Ink**. **FINK = "FOAFy Ink"**: a thin JS wrapper around Ink source so stories can be served/loaded cross-site as plain `.js` (script tags dodge the CORS that `fetch`-ing `.ink` would hit). The long-range vision is a decentralised **"Finkiverse"** where stories link to each other via `# FINK:` tags (canon-vs-fanfic / multiverse framing).

**The pipeline (canonical player = `inklet/finkapp/index.html`, 20+ modules):** a `.fink.js` file is **executable JS**, not text — a single `` oooOO`…` `` tagged-template call. `fink-sandbox.js` runs it inside a hidden `sandbox="allow-scripts"` iframe; the `oooOO` function captures the raw Ink into a known global and posts it back (JSONP-like). Only the **first** `oooOO` block is used. `fink-ink-engine.js` then does the real compile: `new inkjs.Compiler(content).Compile()` → `inkjs.Story`, injects a private inventory knot (`diamonds/keys/score`), and drives `Continue()`/choices while dispatching FINK tags (`IMAGE/VIDEO/BASEHREF/BG/CLASS/FINK/MINIGAME/FOLEY/AUDIO/…`).

**State.** Canonical = `inklet/finkapp/` (rich: ink engine, sandbox, deep-link navigation with SHA-256 hashes, breadcrumbs, procedural foley/audio, dev panel, embedded gems/chess minigames). `inklet/app/` is the **frozen 8-module legacy** — reference only, do **not** mirror changes. Reference impl: `inklet/demos/hamfinkdemo.html`. Working: TOC → Episodes → Hampstead (ZX-Spectrum "48K" loading gag) and Diamond Cave play cleanly. **Known-broken:** Ukrainian `tml-2025-langlearn.fink.js` (runtime error), Maple Hollow (404 on `../cozyverse/maple-hollow.fink.js`), Shane Manor (compiles, gameplay never tested — `shane_todo.md`).

**Traps that will burn you:**
- `story.state.currentPathString` is **null immediately after a divert** — the engine deliberately snapshots the knot *before* `Continue()`. Don't "simplify" it away (that's BUG-009).
- The engine **breaks out of the `while(canContinue)` loop the instant it sees a `MINIGAME`/`FINK` tag** — deliberate (BUG-005 fix), so a returning minigame result isn't overwritten by story text running past the return point. Don't let the loop finish.
- **Two parallel minigame systems.** Production uses `FinkMinigames` (`fink-minigames.js`), which spins up iframes itself. The cleaner manifest-driven `minigame-host.js`/`minigame-sdk.js` (loaded by `index.html`) is **dormant — nothing calls `MinigameHost.start()`**, and its `basePath` even omits the `/glitchcan-minigam/` Pages prefix. Don't assume the manifest allowlist is enforced at runtime; in the live path it isn't.
- **"Won't reload" is usually infrastructure, not the compiler:** suspect the 5-second duplicate-load guard (`recentLoads`, cleared via `clearLoadRecord()` before deliberate loads) or the `fink-nav-cache-v1` localStorage cache before blaming inkjs.
- **Compiling ≠ playable.** The crawler/validator check *structure*; the mandated smoke test (TOC → Episodes → **Hampstead plays through, choice labels visible, no console errors**) checks reality. Always drive the UI.

**Validation/mapping.** `inklet/validation/checkfink.mjs` (unified `.ink`/`.json`/`.fink.js` validator, `--scan`, CI exit codes; **no `--report` flag**). `inklet/tools/fink-graph.mjs` (knot/tag graph via Node `vm`, no hackparsing). `inklet/tools/fink-crawl.cjs` → `docs/fink-crawl-report.{json,md}` + N-Quads. `docs/fink-ring-viz.html` is a working ~60–70% Finkiverse ring viz, reachable only from the crawl report. The planned **"fink-audit dashboard" was never built** — it's a proposal, not WIP.

**Prioritized open work:** (1) BUG-007 (P0): recover gracefully when an external `# FINK:` load fails (currently leaves stale content + an orphan breadcrumb). (2) Fix the two broken stories. (3) Playtest Shane Manor end-to-end. (4) Land the `worknotes/` Jan-2026 review items (breadcrumb visibility, loading feedback, ARIA/CSP). (5) Decide the minigame architecture (migrate onto the manifest-driven host with enforced var allowlists, or delete the dormant SDK). (6) Reconcile the glossary/CDN + acronym docs.

### 4.2 Elliott 4130 emulator + LISP 1.5 (`magpie/elliott4130/`)

**What it is.** A faithful, well-sourced emulator of a real mid-1960s British 24-bit minicomputer (Elliott 4100 series; primary sources — CCS manuals `ccs-e6x1..5.pdf`, `4100_Facts_1967.pdf`, the LISP 1.5 manual — are committed in `docs/`). `elliott4130-core.js` (class `E4130`, ~1635 lines) emulates: 24-bit two's-complement words; registers M/R/S/K/C/Q; a ~93-case opcode decoder with short/long half-word packing; **two-word floating point** (39-bit stored mantissa, 9-bit excess-256 exponent, matching E6X3); the **extracode trap** mechanism; JFL/JIR subroutine linkage preserving condition bits; 3-level interrupts; protected mode; and paper-tape I/O over 14 `IOChannel`s.

**The LISP is real and the project's prime directive is "NO JavaScript LISP".** `lisp4130.asm` (~2101 lines of Elliott NEAT assembly, ~1150 words assembled) is a hand-written READ/EVAL/APPLY/PRINT with QUOTE/COND/LAMBDA/LABEL, CAR/CDR/CONS/ATOM/EQ/NULL/LIST, and a full integer-arithmetic block. Cons cells pack two 12-bit pointers per 24-bit word; HEAP starts at address 2000 (deliberately above the code — a prior bug corrupted memory when code grew past 1000). `cli.mjs` plays "the OS": it supplies the TR/CH extracode trap handlers and detects the `J HALT` idiom to exit — it must **never** parse or evaluate LISP itself (that's why `magpie/junk/` was exiled).

**Verified reality (correcting the docs):** `CAR/CDR/CONS/ATOM/EQ/NULL/COND` and integer literals **work today** via `node cli.mjs`. The genuinely broken cases are **LAMBDA/LABEL application (infinite loop → max-steps)** and `(QUOTE n)` for numeric n. The reader **cannot skip `;` comments**, so the comment-laden `tapes/*.lisp` files produce garbage as-is (bare forms work). User atom names **truncate to the first letter** (only built-in keywords are recognised) — that's why the working `COND` demo prints `Y` not `YES`. Test counts: modern `tests/` suite = **355 passing / 1 intentional fail** (7-bit vs 6-bit tape policy) + **43/43** LISP smoke; legacy browser suite = **133** invocations.

**`magpie/junk/`** is an explicitly-labeled graveyard: earlier assembly-LISP attempts (`lisp-eval.asm`, `lisp-interpreter.asm`) whose every path dead-ends in `J HALT` (they predate the JFL/JIR-linkage insight), plus Node runners that are now **hard-broken** (`ENOENT` — they reference core files that were moved to `../elliott4130/`). Historical reference; don't resurrect without rewrite.

**Highest-leverage next tasks:** make **LAMBDA/LABEL terminate** and **teach the reader to skip `;` comments** — together these unlock `advanced-tests.lisp` and `meta-circular.lisp` end-to-end, which is the stated ambition (McCarthy's eval/apply running natively on the 4130). Also open: 64K→256K memory (BUG-011; current size is actually 4120-scale), missing registers/extracodes (BUG-012/013). Run tools: `node cli.mjs --repl`, `node tests/test-lisp-smoke.mjs`, `node tests/test-instructions-e6x3.js`; UIs `elliott4130.html` and `notebook.html` (Observable-style). **Prime directive stands: all S-expression logic stays in `lisp4130.asm`.**

### 4.3 The Paris AI conference (`magpie/parisconf/`)

**What it is.** A complete bilingual scholarly digitization of a **real** primary source: the International Colloquium **"Les Machines à Calculer et la Pensée Humaine"** (*Calculating Machines and Human Thought*), Institut Blaise Pascal / CNRS, **Paris, 8–13 January 1951** — from the Computer History Museum's scan (barcode `102805935`, matching the PDF). Historiographically pivotal: *before* "ordinateur" (1955) and *before* Dartmouth (1956); attendees/topics span Turing, Wiener, McCulloch, Couffignal, Aiken, Booth, van Wijngaarden — cybernetics and "can machines think?" in period vocabulary.

**State: essentially complete.** 128 pages French transcription (`original-fr-p-001..128.md`), 128 pages English translation (`translated-en-p-001..128.md`), 128 page-image JPGs, bilingual concept indexes (`concepts-fr.md`/`concepts-en.md`), and `translation-skill.md` guidelines. `index.html` is a self-contained bilingual reader web-app: FR/EN toggle, page nav with URL-hash deep-links + keyboard arrows, text/image/side-by-side, lightbox, and a concept tag-cloud that filters to the mentioning pages. It uses `fetch()`, so it must be **served over HTTP** (not `file://`).

**Gotchas:** `README.md` is **wrong** (describes a *1953 machine-translation* conference — do not propagate that). The concept→page arrays in `index.html` are **hand-maintained** and can silently drift from the transcriptions. **Open work:** fix the README; consider auto-generating the concept index from the transcriptions; enrich by linking `photos.ttl` and cross-referencing speakers. Capture the intent: this is a serious history-of-AI primary-source edition, not a demo.

### 4.4 Tanks for the Trees (`trees/`) — the tank game

**What it is.** "Tanks for the Trees — Bristol's Last Stand": a mobile-first phosphor-vector/CRT tank-defence game in Three.js over **real Bristol geography** — defend all **35,893 real council trees** from tree-eating dragons with the council's "BigTrak" fleet. Entry point `trees/tanks-for-the-trees.html` is a 17-line shell; **all ~2,889 lines of logic live in `trees/bristol-scene.js`** as a `<bristol-scene>` Web Component.

**Coordinate system (verify — docs drift):** source CRS is British National Grid EPSG:27700; world transform `x = E − 358500`, `z = −(N − 173500)` (`WORLD=9000, E0=358500, N0=173500`); **vertical exaggeration is `EXAG = 2.4` in code** (docs say 1.6× — stale). `heightAt()` returns EXAG-scaled metres; code divides back by EXAG where it needs real metres — mixing the two is an easy bug.

**Data (cached in-repo, reproducible, no runtime network).** Canonical source is `trees/data/bristol.osm.pbf` (13 MB Geofabrik, ODbL); `trees/tools/derive-layers.mjs` does a 3-pass streaming parse → roads/water/greens/fabric(~104k buildings)/pubs/shops. Plus `elevation-bristol.json(.gz)` (128×128 EU-DEM via `fetch-elevation.mjs`) and `trees-bristol.json(.gz)` (35,893 trees / 115 species via `build-tree-data.mjs` — **geometry + species ONLY**; see §3 rule 1). The old `fetch-*.mjs` Overpass tools are superseded (kept for provenance). **Recurring gotcha:** aggressive point-thinning silently deletes small features (Berkeley Square vanished at 45 m, terraces at 12 m) — buildings use `thin=4` for a reason; re-check small features after any retune.

**Gameplay.** Fleet of three AI tanks **BRUNEL / CABOT / BANKSY**. Two modes: **drive** (virtual joystick, WASD, auto-aiming turret; tank/heli/boat sub-modes; road/air/river autopilots; misses plant persistent horse-chestnut saplings; tidal cycle floods low ground) and **strategic map** (tap tank = select, tap ground = waypoint, tap selected tank = jack in; A* over an OSM road graph). `?lite` renders every 4th tree (low-end/CI; disables index-based forest persistence). `window.__tftt` is the headless-playtest hook; the element API (`host.api.start/jackIn/setView/goto/driveTo/state…`) and CustomEvents (`scene-ready`, `tree-lost`, `dragon-conkered`, `wave`) mirror to the parent via `postMessage`. **No committed harness drives `__tftt`** — writing a headless smoke test (`?lite` → start → assert trees decrease, no console errors) is the highest-value first contribution here.

**Aesthetic contract (keep it):** deliberate vector/CRT — hidden-line meshes (`vectorize()`), wireframe canopies, DEM contours, `EffectComposer` (bloom + film grain), CSS scanline overlay, monospace green-glow HUD. Palette in `:root` vars / `PHOS/AMBER/ENEMY/CYAN`. **No pastel regressions, no lit PBR.** Bump the `?v=NNNN` cache-buster when shipping `bristol-scene.js` changes.

### 4.5 (Bonus, same neighbourhood) edot & foafng

- **`magpie/edot/`** — a genuinely working, heavily-tested (**49** `test-*.mjs`, booted headless) **client-side office/PIM/decentralised-social suite**: no server, no build step, data never leaves the device. Vanilla ES modules over a capability-bus kernel (`edot-kernel.js`) + shared command registry (⌘K palette). Production-grade editor with **native OOXML docx and multi-page PDF I/O** (no renderer), RDFa authoring, SQLite-WASM data app, calendar/mail(pluggable adapters)/maps(MapLibre)/feeds/groups(XMPP-MIX)/connections(OPFS)/automations/auth(OIDC-PKCE). The architecture is the crown jewel (sanitized-HTML canonical model; single-`execCommand` confinement; native-primitive I/O; pluggable adapters). Soft edges are the networked features and `ENCRYPTED-BACKUP.md` (design-only). Next step per `docs/research/`: a *thin trusted backend / capability model* that lights up OIDC/mail/groups/encrypted-backup Tier 2 without betraying the client-side ethos.
- **`magpie/foafng/`** — "FOAF NG" realised as **Kanren-RDF**: microKanren-style logic over a claim-centric RDF model (claims = named graphs with provenance), graph algebra (`+`/`−`/`∩`), annotated datatypes, and serializers (TriG/N-Quads/RDF-star/RDF 1.2/JSON-LD). Tests pass (16/16 core, 10/10 SPARQL subset). **Canonical-file ambiguity to resolve first:** top-level `kanren-rdf.html` lacks the SPARQL/Bloom work that `demos/mock1/index.html` and the `.mjs` test files have; the core data model is copy-pasted across ≥4 files. Fold the proven SPARQL parser + Bloom index into one shared module before building the v3 visual node compositor (the big greenfield piece in `PRD.md`).

---

## 5. Subsystem map (the rest, briefly, with maturity)

- **Lucid (`lucid/`)** — *mature core, half-built integration.* Backend-neutral SDF raymarcher: **Mayfly** (WebGL, production) + **Stinkyfish** (WebGPU, **codegen-passing but visually UNVERIFIED** — `stinkyfish/BUGS.md`). Shared JSON scene → GLSL/WGSL. **119 scenes, 79 in `lucid/scenes/toc.json`, 47 orphaned.** XPBD physics integrated in the main viewer. ABCD "Parliament" model-review (`automodel/`, `parliament-rules.md`) is operational. Entry points: `index.html`, `node-editor.html`, `scene-catalog.html`, `compare.html`. "Recent Changes" updater is a manual script (no hook installed).
- **palace/** (~95% MOO-style 42-room Westminster Palace) · **mudslide/** (~90% Three.js isometric adventure) · **hat/** (Hadley attractor, WebGPU compute RK4 + WebGL fallback) · **plenia/** (particle Lenia in a Worker) · **furbacca/** (reverse-engineered Furby protocol, encode+decode) · **follyfx/** (a real acoustics research paper — PCA of 115 impulse responses) · **spectro/** (~42-room Spectrum platformer, Jest tests; open collision/jump bugs) · **thumbwar/** (GridLuck, **v1.3.0 in code**, only the `<title>` says 1.2.0) · **tokitokipona/** (working emoji flashcards) · **yeti/** (creature lab; imports 5 `lucid/core` modules despite a "zero deps" doc claim) · plus `kgx/`, `twinearth/`, `biomorphs/`, `fatnet/`, and a dozen smaller toys.
- **magpie/skyport-webgpu-pwa/** and **magpie/ua17/** — see §6.

**Highest-value *cheap* work across the repo is connective tissue, not new features:** index the ~14 invisible-but-substantial directories into the landing `index.html`; triage the 47 orphaned Lucid scenes into `toc.json`; land the frozen `worknotes/` FINK fixes; and activate the E2E workflow (§7).

---

## 6. Where the current work stream stands (ua17 + skyport)

Active branch **`claude/ua17-3d-flight-sim-760w8h`**; everything merged to master via PRs #740–#744.

- **`magpie/ua17/`** — a Three.js (r169, vendored) 3D toy-scale simulation of United **UA17 LHR→EWR**, built for "a toddler on a mobile phone," installable PWA, works fully offline. Real data: OSM buildings (London + NYC), DEM elevation (real coastlines), Open-Meteo weather-driven clouds, an OpenSky other-flights snapshot. Modular `js/` (scene, aircraft, buildings, terrain, sky, clouds, airport, flights, particles, route, app). Recent polish: ACES tone-mapping, **tilt-shift depth-of-field** ("toytown" look), contact shadows, camera that only auto-frames a city while it's *ahead* of the plane (fixed a climb-out shot that read as a crash), roof-cap silhouette variety, min building height (no pancake slabs). SW is at `ua17-v14`. **Debug hook:** `window.__ua17` (`.jumpTo(t)`, `.setOrbit`, `.scene`, `.elev(x,z)`). **Open next:** the user's standing ask is a **real Boeing 767-300ER 3D model** (GLTF, PWA-cacheable) to replace the procedural aircraft — blocked on sourcing a licensed GLB. Also queued: cheap post (vignette/dither in the existing tilt-shift pass), water shader, building value discipline.
- **`magpie/skyport-webgpu-pwa/`** — a **WebGPU** reference build (saved for comparison; not wired into ua17). Recently debugged from iOS: the "black-on-black except overlay" was a **missing depth-state on the sky pipeline** (Chrome/Dawn tolerates it, Safari rejects the draw → whole command buffer invalid → black); then a **post-process vertical flip** (WebGPU framebuffer origin is top-left while clip-space Y is up), heavy fog, and sub-visible planes. All fixed; on-screen GPU-error surfacing left in as a safety net. **Key limitation:** this environment has **no headless WebGPU**, so skyport fixes are static-analysis only and must be verified on a real WebGPU browser/device.

---

## 7. Deployment, testing, and their limits

- **`pages.yml`** deploys on push to **master** (checkout@v4, configure-pages@v4, upload-pages-artifact@v3, deploy-pages@v4). Landing-page game entries are edited **manually**. Deploy has a real lag — verify a live file with `curl` before assuming a fix reached the site (and remember the per-app service workers serve stale content until a second reload).
- **`e2e-tests.yml.template`** at the repo root is a complete Playwright E2E workflow that was **never moved into `.github/workflows/`** (the GitHub App lacks `workflows` permission — `WORKFLOW-SETUP.md`). **The Playwright suite has never run in CI.** Activating it is a one-move, high-value fix. `pr-preview.yml.disabled` is intentionally off. `lucid-tests.yml` is the one plan that became real CI.
- **Test split:** `npm test` = Playwright; `npm run test:core` = Vitest. Gotcha: `tests/glsl-codegen.test.js` and `tests/dsl-parser.test.js` are `@playwright/test` files — don't point Vitest at the whole `tests/` dir.
- **Headless browser — critical limitation.** Pinned Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, launched `--no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`. **WebGL renders via SwiftShader at ~2 FPS** — fine for screenshots/functional playtests, useless for perf feel. **WebGPU is NOT available headless** — a headless "visual check" of any WGSL/WebGPU code silently exercises the WebGL path instead. **Never claim WGSL/WebGPU fixes are verified from headless captures** (applies to Stinkyfish, `hat/`, and skyport).

---

## 8. Strategy & plan for the models who continue

**Working principles (the ones that keep you out of trouble here):**
1. **Consult `docs/fable-audit/` before believing any doc — including `CLAUDE.md` and this file.** Verify negatives with a recorded check; web-search anything post-cutoff.
2. **The three red-line rules are load-bearing** (data ethics, no-hackparsing, don't-touch-sandbox). They're incident-derived, not stylistic.
3. **Compiling/codegen ≠ working.** Drive the actual UI; for WebGPU, use a real device — you cannot trust headless renders.
4. **Prefer connective tissue over new toys.** The repo is deeper than it looks and under-indexed; surfacing what exists beats adding more that no one can find.
5. **Vendored-not-CDN, static-only, self-contained-per-directory** — respect these when adding anything.
6. **danbri is the owner;** trust his domain knowledge, ask before shipping anything touching dataset ethics or a payload schema.

**Concrete near-term plan (roughly ordered by value/effort):**
- **Hygiene (cheap, high-trust):** ✅ *done 2026-07-06* — the §2 doc corrections were fixed at source (Elliott 133 + "EVAL works"; trees `EXAG=2.4`; parisconf README → 1951; glossary CDN/acronym). Remaining minor: the `magpie/toc.html` edot "39/39" badge (→ 49 test files) is still stale.
- **Wire up CI:** move `e2e-tests.yml.template` into `.github/workflows/` once the `workflows` permission exists; add a `trees` `?lite` headless smoke test via `window.__tftt`; add a FINK TOC→Hampstead smoke test.
- **FINK:** BUG-007 external-load recovery (P0); fix the two broken stories; playtest Shane Manor; land the `worknotes/` a11y items; resolve the two-minigame-systems ambiguity.
- **Elliott/LISP:** make LAMBDA/LABEL terminate; add `;`-comment skipping to the reader — unlocks the meta-circular evaluator end-to-end.
- **ua17:** vendor a real 767-300ER GLB (the owner's standing ask); then cheap post polish + water.
- **Discoverability:** index palace/mudslide/plenia/hat/magpie/edot/parisconf/foafng into the landing `index.html`; triage the 47 orphaned Lucid scenes.

**Two ambiguities to resolve before extending, not after:** foafng's canonical HTML (top-level vs `demos/mock1/`), and edot's suite (`index.html`) vs standalone (`edot.html`).

---

*Prepared 2026-07-06 during the collaboration, ahead of the Fable 5 access gap, as a durable orientation for whichever model picks up next. If you improve on any finding here, update this file (and, better, fix the drift at its source) rather than starting a new note — one moving handoff beats many stale ones.*
