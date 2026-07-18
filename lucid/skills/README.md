# Lucid Skills

Agent skills for working on the Lucid SDF/CSG graphics system, following the
[agentskills.io](https://agentskills.io) `SKILL.md` convention: each skill is a
directory with a `SKILL.md` (YAML frontmatter — `name` + `description` — plus a
Markdown body) and optional `references/` files loaded on demand.

These skills encode hard-won, code-verified knowledge about this system so an
agent (or a person) can make correct changes without re-deriving the architecture
each time. They are scoped to `lucid/` only.

## Skills in this folder

| Skill | Use it when you are… |
|-------|----------------------|
| **lucid-scene-authoring** | creating/editing scene JSON — primitives, CSG, transforms, modifiers, `defs`/`ref`, params, driven-value expressions |
| **lucid-renderer-interop** | working across the Mayfly (WebGL/GLSL) and Stinkyfish (WebGPU/WGSL) backends — the codegen pipeline, the `<lucid-renderer>` component, and where the two backends still diverge |
| **lucid-rigging-and-physics** | working with the rig/constraint layer (`rig-evaluator.js`) or the XPBD physics stacks, and the param uniforms that connect them to the renderer |
| **lucid-animation-and-interaction** | working on time/animation, looping, the timeline scrubber, or camera/gesture interaction |

## How skills load

Point your agent runtime at this folder (or symlink individual skills into your
skills path). The `description` field is the trigger — it says both what the
skill does and when to reach for it. The body loads when the skill triggers;
`references/*` load only when the body points to them, keeping context lean.

## Ground truth

When a skill and a doc disagree, **the code is ground truth** — every claim here
was checked against the source in `lucid/core`, `lucid/mayfly`, `lucid/stinkyfish`,
and `lucid/components`. Where a backend feature is known-incomplete or visually
unverified, the skill says so rather than implying parity. See also
`../CLAUDE.md` and `../../docs/fable-audit/` for the repo-wide accuracy ledger.
