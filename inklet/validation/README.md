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

