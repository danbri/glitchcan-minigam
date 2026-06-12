# Fable Audit — Claims Register & Verification Protocol

## Why this exists

During review, two claims in this audit were refuted by the owner: trees/ was badly
under-characterized, and the Finkiverse ring-viz was called "unlinked from anywhere"
when it is linked from the generated crawl report. Both failures share a shape:
**negative or universal claims** ("X doesn't exist", "nothing references Y") asserted
from absence of evidence during a sampled read, rather than from a recorded check.

## Protocol (mirrors the repo's ABCD Parliament showstopper rule)

1. Every negative/universal claim in the audit gets a row here.
2. Each row records the **check actually run** and a verdict:
   **CONFIRMED** / **REFUTED** / **PARTIAL** / **UNVERIFIABLE-HERE**.
3. Verification is done by adversarial agents whose *only* goal is falsification —
   no exploration license beyond the listed claims.
4. REFUTED claims must be corrected in the audit reports in the same commit.

## Results (falsification pass, 2026-06-10)

**Score: 14 confirmed, 9 refuted, 4 partial, 1 unverifiable, 1 moot.** Every refuted
claim has been corrected in the report files in the commit that filled this table.
Two agent verdicts (A12, A14) were re-scored by the coordinator: the agents' evidence
actually *confirmed* the audit claims but they labelled the claim-direction backwards.

| # | Claim (as published) | Verdict | Evidence / check run |
|---|---|---|---|
| A1 | The four phantom story files exist nowhere | **CONFIRMED** | `find` + `git log --all --diff-filter=A`: never existed in history either |
| A2 | checkfink.mjs has no `--report` flag | **CONFIRMED** | Arg parsing read (lines ~200-248): only `--scan`. Note: `story-analyzer.mjs` has report generation but is not called by checkfink |
| A3 | No INK runtime onError handler wired (Step 5 never done) | **REFUTED** | `finkapp/fink-ink-engine.js` sets `this.story.onError = (msg, type) => {…}`. Corrected in 01 §3 |
| A4 | No pre-optimized Shane Manor JPGs on disk | **REFUTED** | `inklet/media/shane/{mobile,tablet,desktop}/*.jpg` exist. Corrected in 01 §6 and 04 §6 |
| A5 | ink-full.js version recorded nowhere | **PARTIAL** | Vendored copy has no version header; but package.json pins `inkjs ^2.3.2` for tooling |
| A6 | No regex INK parsing in active players | **REFUTED** (narrowed) | BASEHREF tag-extraction regexes in `fink-ui.js`, `fink-navigation.js`, `fink-ink-engine.js` (`.match(/# BASEHREF:\s*(.+)/)`). True narrower claim: no regex parsing of INK *story structure*; tag extraction uses documented regex fallbacks (CLAUDE.md Fix 4). Corrected in 01 |
| A7 | Jan-2026 reviews have no follow-up commits | **REFUTED** (narrowed) | `cfe87c0` 2026-01-29 "fix(BUG-007): FINK loading failures and breadcrumb flat hierarchy" + same-day revert `3be4af5`. True narrower claim: no *surviving* fixes. Corrected in 05 §1 |
| A8 | imagesnippets datasets referenced by no code | **REFUTED** | `kgx/public/index.html` and `kgx/public/testbed/index.html` load `../../../datasets/upstream/imagesnippets-*.ttl/.nq`. Corrected in 05 §3 |
| A9 | finkg.nq consumed by no pipeline | **CONFIRMED** | repo-wide grep "finkg": only the data file itself |
| A10 | Maple Hollow's referenced media missing on disk | **MOOT** (claim mis-aimed) | maple-hollow.fink.js references only YouTube `# VIDEO:` tags — no local media to 404. The Jan-2026 404 presumably concerned the story/video load itself. Corrected in 01 §4 table note |
| A11 | No save/load in finkapp; preprocessor not imported | **PARTIAL** | localStorage bookmark storage exists in `fink-player.js` + nav cache in `fink-navigation.js` (so "no save/load" too strong); `demos/fink-namespace-preprocessor.js` indeed not imported by player. Corrected in 05 §4 |
| A12 | No DEM/elevation file existed before 2026-06-10 | **CONFIRMED** (re-scored) | Only elevation files in history are `trees/data/elevation-bristol.*` added 2026-06-10 by this session |
| A13 | The 11-pen CodePen index is complete | **CONFIRMED** | repo-wide grep; only extra slug is in node_modules README (untracked) |
| A14 | INK_INTEGRATION_STATUS.md calls inklet6 production | **CONFIRMED** (re-scored) | Line 15: "**Status:** Production-ready, deployed at…" — doc-contradiction stands |
| B1 | No pre-commit hook installed; no tracked hooks dir | **CONFIRMED** | `.git/hooks/` samples only; `core.hooksPath` unset; no install script found |
| B2 | Scene-picker has no filter bar | **REFUTED** | `lucid-scene-picker.js` lines ~298-309: filter buttons (All/Static/Working/Recent/Broken) + search input. Corrected in 02 §4 |
| B3 | No catalog→editor linkage | **CONFIRMED** | No cross-references between scene-catalog.html and node-editor.html |
| B4 | Timeline not wired to node-graph/rig | **CONFIRMED** | `updatePreview()` (node-editor.html ~line 1375) never reads timeline time; scrubber is UI-only |
| B5 | Main viewer has no physics initialization | **REFUTED** | lucid/index.html imports PhysicsScene, instantiates on `json.physics.enabled`, steps it in the render loop, syncs body positions to params. Corrected in 02 §5 |
| B6 | lucid-param-editor / -timeline / -node-graph defined nowhere | **CONFIRMED** | `customElements.define` enumerated: 6 elements, none of the three promised ones |
| B7 | 119 files vs 79 in toc; ~40 orphaned | **CONFIRMED** (count refined) | Exactly **47 orphaned** scene files (e.g. creatures/subag1/*, ablation/old/*); zero toc entries point at missing files. Corrected number in 02 |
| B8 | No peer/WebRTC/WebSocket code anywhere | **CONFIRMED** | repo-wide grep excluding node_modules: zero hits |
| B9 | No tracked junk in git index | **CONFIRMED** | `git ls-files` greps for junk patterns: zero hits |
| B10 | tools/ contains exactly one file | **CONFIRMED** | `llm_check.py` only |
| B11 | Elliott 4130 "133 passing tests" substantiated | **REFUTED** (number) | `elliott4130-tests.js` contains **122** `runTest(` invocations; "133" not found in the test file; pass count not reproducible headlessly here. Corrected in 03 and README |
| B12 | Spectro has ~42 rooms (CLAUDE.md's "4" is stale) | **CONFIRMED** | 42 room ids in `spectro/src/rooms.js` |
| B13 | GridLuck v1.3.0 absent from code (HTML v1.2.0) | **REFUTED** (narrowed) | `gridluck-game.js:8` declares v1.3.0 — the v1.3.0 work IS committed; only the HTML title is stale. Corrected in 03 |
| B14 | yeti/ has zero imports from lucid/ | **REFUTED** | `yeti/yeti-creature.js:18-22` imports json-loader, json-codegen + 3 more from `../lucid/`. yeti/CLAUDE.md's "zero dependencies" claim is false in code. Corrected in 02 §7, 03, README |
| B15 | All landing-page local hrefs resolve | **CONFIRMED** | 37 local hrefs extracted and stat-checked: all exist |

| C1 | "World Labs has no public API" (stated in FLY BRISTOL work, 2026-06-12) | **REFUTED** (self-caught on owner's question) | World API launched 2026-01-21, after knowledge cutoff: docs.worldlabs.ai/api — WLT-Api-Key auth, SPZ splat output, paid accounts only. Correction: integration script added (`trees/tools/generate-marble-world.mjs`); blocked only on owner's API key, not on existence |

## Lessons encoded

- Negative claims sourced from *repo documentation* (yeti's "zero deps", magpie's
  "133 tests") are as dangerous as ones from sampled reading — docs lie in both
  directions. Verify doc-sourced numbers against code before repeating them.
- Time-sensitive negative claims ("X doesn't exist") rot fast when the knowledge
  cutoff predates today: World Labs' API launched 21 days after cutoff (row C1).
  Search before asserting absence of anything newer than the cutoff.
- Falsifier agents themselves err on claim *direction* (A12, A14): the coordinator
  must re-read evidence, not just accept verdict labels.
- The audit's central theses survived falsification (phantom files, missing
  dashboard, no hooks, orphaned scenes, no networking code), but roughly **a third
  of its specific negative claims needed correction or narrowing** — a measured
  error rate worth remembering when reading any "comprehensive" audit.
