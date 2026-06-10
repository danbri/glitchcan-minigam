# Fable Audit — Claims Register & Verification Protocol

## Why this exists

During review, two claims in this audit were refuted by the owner: trees/ was badly
under-characterized, and the Finkiverse ring-viz was called "unlinked from anywhere"
when it is linked from the generated crawl report. Both failures share a shape:
**negative or universal claims** ("X doesn't exist", "nothing references Y") asserted
from absence of evidence during a sampled read, rather than from a recorded check.

## Protocol (mirrors the repo's ABCD Parliament showstopper rule)

1. Every negative/universal claim in the audit gets a row here.
2. Each row records the **check actually run** (command/file read) and a verdict:
   **CONFIRMED** / **REFUTED** / **PARTIAL** / **UNVERIFIABLE-HERE**.
3. Verification is done by adversarial agents whose *only* goal is falsification —
   they are instructed not to investigate anything beyond the listed claims.
4. REFUTED claims must be corrected in the audit reports in the same commit.

## Register

Verdicts filled by the falsification pass of 2026-06-10. Claims marked ✅ were
verified mechanically in-session before first publication.

| # | Claim (as published) | Where | Verdict | Evidence / check |
|---|---|---|---|---|
| A1 | `toc-simple.fink.js`, `hampstead1.fink.js`, `bagend1.fink.js`, `jungle2.fink.js` exist nowhere in the repo | 01 §1,§4 | pending | |
| A2 | `checkfink.mjs` has no `--report` flag implemented | 01 §5 | pending | |
| A3 | No INK runtime `onError` handler wired in either player (Step 5 never done) | 01 §3 | pending | |
| A4 | No pre-optimized JPG versions of Shane Manor images exist on disk | 01 §6 | pending | |
| A5 | The vendored ink-full.js version is not recorded anywhere | 01 §8 | pending | |
| A6 | No regex INK parsing ("hackparsing") in the active players (app/, finkapp/) | 01 §3 | pending | |
| A7 | Jan-2026 worknotes review findings have no follow-up fix commits | 05 §1 | pending | |
| A8 | `datasets/imagesnippets-*` are referenced by no code, only docs | 05 §3 | pending | |
| A9 | `data/kgx/finkg.nq` is consumed by no pipeline | 05 §3 | pending | |
| A10 | Maple Hollow's referenced media is missing on disk (404 claim) | 01 §6 | pending | |
| A11 | No save/load system in finkapp; namespace preprocessor exists but is not imported by the player | 01/05 | pending | |
| A12 | No DEM/LIDAR/elevation data file existed in the repo before 2026-06-10 | 06 §1 | pending | |
| A13 | The 11-pen CodePen list is complete (no other danbri pens referenced repo-wide) | 06 §4 | pending | |
| A14 | INK_INTEGRATION_STATUS.md claims inklet6 is production (doc-contradiction claim) | 01 §1 | pending | |
| B1 | No git pre-commit hook installed; no tracked hooks dir; core.hooksPath unset | 02 §2 | pending | |
| B2 | Lucid scene-picker has no filter bar | 02 §4 | pending | |
| B3 | No catalog→editor linkage in scene-catalog.html | 02 §4 | pending | |
| B4 | Node-editor timeline is not wired to node-graph params / rig uniforms | 02 §4 | pending | |
| B5 | Lucid main viewer contains no physics initialization | 02 §5 | pending | |
| B6 | `<lucid-param-editor>`, `<lucid-timeline>`, `<lucid-node-graph>` are defined nowhere | 02 §4 | pending | |
| B7 | Exactly 119 scene files; 79 in toc.json; ~40 unindexed (list them) | 02 §2 ✅ | pending (list) | |
| B8 | No peer/WebRTC/WebSocket networking code anywhere (excl. narrative text) | 04 §4 | pending | |
| B9 | No tracked junk (node_modules, .DS_Store, Thumbs.db) in git index | 04 §6 | pending | |
| B10 | `tools/` contains exactly one file | 04 §6 | pending | |
| B11 | Elliott 4130 "133 passing tests" is substantiated (and runnable headless?) | 03 magpie | pending | |
| B12 | Spectro has ~42 rooms (vs CLAUDE.md's stale "4 rooms") | 03 | pending | |
| B13 | GridLuck shows v1.2.0 in HTML; no other version strings contradict | 03 ✅ | pending (JS files) | |
| B14 | yeti/ has zero code imports from lucid/ | 02 §7 / 03 | pending | |
| B15 | Every play-button href on the landing page resolves to an existing file | 03 | pending | |
