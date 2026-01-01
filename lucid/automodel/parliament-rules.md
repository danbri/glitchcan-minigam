# ABCD Parliament Rules - MANDATORY

## Agent Information Access Matrix

| Agent | SDF Skill | Blanked Geometry | Real Geometry | Goal/Target | Imagery |
|-------|-----------|------------------|---------------|-------------|---------|
| A (Blind) | ✅ YES | ✅ YES | ❌ NO | ❌ NO | ✅ Clean |
| B (Informed) | ✅ YES | ✅ YES | ✅ YES | ✅ YES | ✅ Clean |
| C (Skeptic) | ✅ YES | ✅ YES | ✅ YES | ✅ YES | ✅ Clean |
| D (Moderator) | ✅ YES | ✅ YES | ✅ YES | ✅ YES | ❌ N/A |

## Rule 1: SDF Skill for ALL Agents

ALL agents (A, B, C, D) receive the SDF skill reference.
- Enables actionable geometry feedback
- Agent A uses it to describe what they see in SDF terms
- Agents B, C use it to specify exact fixes
- Agent D uses it to validate proposed changes

## Rule 2: Blanked Geometry for Agent A

Agent A receives geometry with ALL identifying information removed:
- Title: "Model Under Evaluation"
- No species/creature names in any field
- No comments revealing intent
- Generic node names only

Example blanking:
```json
// REAL (leaky)
{ "title": "Humpback Whale", "subtitle": "Form study v5.9" }

// BLANKED (safe for Agent A)
{ "title": "Model Under Evaluation", "subtitle": "Geometry v5.9" }
```

## Rule 3: Both Geometries for B, C, D

Agents B, C, D receive:
1. **Blanked geometry** - for unbiased structural analysis
2. **Real geometry** - for goal-oriented evaluation
3. **Explicit goal/target** - e.g., "HUMPBACK WHALE"

## Rule 4: Clean Imagery - NO LEAKY CLUES

Rendered images must NOT contain:
- ❌ Filenames revealing subject (e.g., "whale.png")
- ❌ Page headers/titles
- ❌ Webapp UI elements
- ❌ Browser chrome
- ❌ Any text overlays

Images should be:
- ✅ Canvas-only screenshots
- ✅ Named generically (e.g., "view-01.png", "view-02.png")
- ✅ Presented via neutral paths (e.g., "/tmp/eval/view-01.png")

## Rule 5: Individual Agent Timings - REQUIRED

Every ABCD session MUST track:
```json
{
  "timings": {
    "capture_total_ms": 0,
    "agent_a_start": "ISO8601",
    "agent_a_end": "ISO8601",
    "agent_a_ms": 0,
    "agent_b_start": "ISO8601",
    "agent_b_end": "ISO8601",
    "agent_b_ms": 0,
    "agent_c_start": "ISO8601",
    "agent_c_end": "ISO8601",
    "agent_c_ms": 0,
    "agent_d_start": "ISO8601",
    "agent_d_end": "ISO8601",
    "agent_d_ms": 0,
    "abc_parallel_wall_ms": 0,
    "total_ms": 0
  }
}
```

## Execution Model

```
Phase 1: Capture (sequential)
├── Generate clean renders to /tmp/eval/view-NN.png
└── Time: capture_total_ms

Phase 2: Prepare (sequential)
├── Create blanked geometry copy
└── Copy SDF skill to accessible path

Phase 3: Analysis (PARALLEL for A, B, C)
├── Launch Agent A ──┐
├── Launch Agent B ──┼── wall_clock = MAX(A, B, C)
└── Launch Agent C ──┘
    Record individual start/end times

Phase 4: Synthesis (sequential)
└── Launch Agent D with A+B+C reports
    Record D timing separately
```

## Prompt Templates

### Agent A Prompt Structure
```
You are Agent A - Blind Evaluator.

SDF SKILL: [path to sdf-skill.md]
GEOMETRY: [path to BLANKED geometry]
IMAGERY: /tmp/eval/view-01.png through view-12.png

You have NO context about what this model is supposed to be.
Identify the creature/object using SDF terminology where helpful.
```

### Agent B/C Prompt Structure
```
You are Agent [B/C] - [Role].

SDF SKILL: [path to sdf-skill.md]
BLANKED GEOMETRY: [path to blanked geometry]
REAL GEOMETRY: [path to real geometry]
GOAL: [e.g., HUMPBACK WHALE]
IMAGERY: /tmp/eval/view-01.png through view-12.png

[Role-specific instructions...]
```

### Agent D Prompt Structure
```
You are Agent D - Parliament Moderator.

SDF SKILL: [path to sdf-skill.md]
BLANKED GEOMETRY: [path to blanked geometry]
REAL GEOMETRY: [path to real geometry]
GOAL: [e.g., HUMPBACK WHALE]

Agent A Report: [full report]
Agent B Report: [full report]
Agent C Report: [full report, MUST BE SURFACED PROMINENTLY]

[Synthesis instructions...]
```

## Blanking Script

To create blanked geometry:
```bash
# Remove identifying info from JSON
jq '.title = "Model Under Evaluation" |
    .subtitle = "Geometry " + .version |
    del(.description) |
    del(.notes)' real.json > blanked.json
```

## Enforcement

These rules are NON-NEGOTIABLE for valid ABCD Parliament sessions.
Violations invalidate the evaluation and require re-run.
