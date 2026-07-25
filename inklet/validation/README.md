Inklet Validation Tools — Ink Standards Compliance

Purpose
- Provide structure and quality analysis for stories written in Inkle’s Ink, embedded via FINK wrappers.

Standards Rule (Prominent)
- This tooling is standard-based. Do NOT fork the Ink language.
- Interpret constructs per Ink documentation: knots (`==`), stitches (`===`), choices (`*`, `+`), diverts (`->`), variables (`VAR`, `TEMP`, `~`), and tags (`#`).
- Any simplifications (e.g., treating stitches as nodes for graphing) are purely analytical and must not change or imply different language semantics.
- When in doubt, defer to the official Ink specification and examples (Inkle/Ink).

Analyzer Notes
- Choice parsing supports `*` (standard) and `+` (sticky), optional conditions, bracketed or plain labels, and same-line diverts.
- Variables: counts `~ var = ...` assignments and list ops `~ L += x` / `~ L -= x`.
- Start detection: uses the first top-level `-> target` divert if present, otherwise the first header.
- End detection: considers nodes with no outgoing edges as terminal for path calculations.
- FINK tags like `# IMAGE:` and `# BASEHREF:` are treated as metadata (not part of Ink’s core).

Scope & Limitations
- This is a static analyzer, not a full parser/interpreter. It focuses on topology, not narrative runtime.
- It should never introduce non-standard syntax or behaviors.


Variable Governance (`inklet/tools/fink-vars.mjs`)
- Joins what every story DECLARES against what every minigame manifest is
  ALLOWED to write, and reports the disagreements.
- Declared variables are read from the COMPILED story
  (`variablesState._globalVariables`) after real ink-full.js compilation —
  never regexed out of the source. Content is captured by executing the
  `.fink.js` in a vm, as everywhere else in this repo.
- Three findings it produces:
  - **collision** — the same private name declared by two independent
    works. They run as separate Story objects, so they are NOT wired
    together; a guest granted that name writes into whichever one is
    hosting it. Rename, or promote the name to the shared economy.
  - **dead write** — a guest may write a name no story declares. Ink
    refuses assignment to an undeclared variable, so the value silently
    vanishes. A story opts in by declaring the `VAR`.
  - **unmanifested** — a minigame with no `manifest.json`. Since the
    June 2026 enforcement that means all its writes are denied.
- `--json` for machine output (written to `docs/fink-vars.json`, which the
  finkiverse map reads), `--strict` to fail CI on errors.
- It collapses `_tmp_x.fink.js` into `x.fink.js` before counting, or a
  single temp copy of a 24-variable story reads as 24 collisions.
- The runtime counterpart is `FoafVars` (`packages/foafos/src/vars.mjs`),
  enforced in `FinkMinigames._setStoryVariable`. Spec §5.3.
