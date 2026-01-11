# Parliamentary Multi-Agent Chat (PMAC) Maker Skill

## Overview

PMAC is a multi-perspective evaluation methodology for 3D model quality assessment using four specialized AI agents. It prevents bias, catches showstoppers, and ensures models meet target identification goals before commit.

**Purpose**: Evaluate whether a 3D model can be correctly identified as its target without prompting, while catching any issues that undermine credibility.

---

## The Four Agents

| Agent | Role | Knows Goal? | Key Output |
|-------|------|-------------|------------|
| **A** | Blanked Evaluator | ❌ NO | Primary identification + confidence % |
| **B** | Informed Evaluator | ✅ YES | Score + strengths/weaknesses |
| **C** | Skeptical Slop Detector | ✅ YES | P0-P3 issues + domain expert test |
| **D** | Parliament Moderator | ✅ YES | Final verdict + aggregated showstoppers |

### Agent A - Blanked Evaluator
- **Purpose**: Unbiased blind identification test
- **Receives**: Clean images + blanked geometry + generic SDF skill
- **Does NOT receive**: Goal, species names, descriptive hints
- **Returns**: What they think the model IS (not what it should be)
- **Key metric**: Confidence % in primary identification

### Agent B - Informed Evaluator
- **Purpose**: Goal-oriented quality assessment
- **Receives**: Everything including goal and real geometry
- **Returns**: Numerical score + specific strengths and weaknesses
- **Key metric**: Score 0-100 against target

### Agent C - Skeptical Slop Detector
- **Purpose**: Catch halfbaked work and anatomical errors
- **Persona**: "Visual models editor who HATES AI slop"
- **Receives**: Everything including goal
- **Returns**: Issue severity breakdown (P0-P3) + domain expert test
- **Key metric**: Would an expert immediately recognize this?

### Agent D - Parliament Moderator
- **Purpose**: Synthesize reports and make final decision
- **Receives**: All three agent reports
- **Returns**: COMMIT or DO NOT COMMIT verdict
- **Key responsibility**: Aggregate ALL showstoppers

---

## Information Access Matrix

| Information | Agent A | Agent B | Agent C | Agent D |
|-------------|---------|---------|---------|---------|
| Rendered Images | ✅ | ✅ | ✅ | ❌ |
| SDF Skill Reference | ✅ | ✅ | ✅ | ✅ |
| Blanked Geometry | ✅ | ✅ | ✅ | ✅ |
| Real Geometry | ❌ | ✅ | ✅ | ✅ |
| Goal/Target | ❌ | ✅ | ✅ | ✅ |
| Other Agent Reports | ❌ | ❌ | ❌ | ✅ |

---

## Critical Rules

### Rule 1: SHOWSTOPPER REQUIREMENT

**Every agent MUST return a `showstoppers` array.**

```json
{
  "showstoppers": ["ISSUE - specific description"]
}
```

- Empty array = no showstoppers found
- Non-empty array = blocking issues exist
- **Agent D aggregates ALL showstoppers from A+B+C**

**COMMIT RULE**: If `all_showstoppers.length > 0` → verdict MUST be **DO NOT COMMIT**

**NO EXCEPTIONS**: Even if Agent A gives 95% confidence, showstoppers block commit.

### Rule 2: NO AGENT A PROMPT CONTAMINATION

**Agent A's prompt must contain ZERO species-specific hints.**

#### FORBIDDEN in Agent A prompts:
- ❌ Species-specific terms (e.g., "tubercles", "flukes", "rostrum")
- ❌ Descriptive geometry hints (e.g., "bumpy texture on head")
- ❌ Terminology implying what the model is
- ❌ Color descriptions matching target (e.g., "counter-shading")
- ❌ Proportion hints (e.g., "7:1 ratio", "31% body length")

#### ALLOWED in Agent A prompts:
- ✅ Generic SDF skill reference
- ✅ Blanked geometry file path (comments scrubbed)
- ✅ Image file paths (generic names like view-01.png)
- ✅ Simple instruction: "What creature/object is this?"

#### Validation Check:
> "Could someone guess the target from this prompt alone?"
> If YES → prompt is contaminated → evaluation is INVALID

### Rule 3: NO VIEW SHOPPING

**NEVER try different camera angles hoping for better results.**

When results are unfavorable:
- ✅ FIX THE GEOMETRY
- ❌ NEVER seek "more flattering angle"

The model must read correctly from a neutral canonical view.

### Rule 4: CLEAN IMAGERY

Rendered images must NOT contain:
- ❌ Leaky filenames (e.g., "whale.png")
- ❌ Page headers/titles
- ❌ Webapp UI elements
- ❌ Any text overlays

Images should be:
- ✅ Canvas-only screenshots
- ✅ Named generically (view-01.png, view-02.png)
- ✅ Multiple angles (minimum 6)

### Rule 5: BLANKED GEOMETRY

Agent A receives geometry with identifying info removed:

```bash
jq '.title = "Model Under Evaluation" |
    .subtitle = "Geometry " + .version |
    del(.description) | del(.notes) |
    walk(if type == "object" and .comment then
      .comment = "structural element" else . end)' \
    real.json > blanked.json
```

---

## Execution Workflow

```
Phase 1: CAPTURE (sequential)
├── Generate clean renders to /tmp/eval/
├── Name: view-01.png through view-06.png
└── Save to: captures/v{VERSION}-{TIMESTAMP}/

Phase 2: PREPARE (sequential)
├── Create blanked geometry copy
├── Remove ALL species-specific comments
└── Prepare SDF skill reference

Phase 3: ANALYZE (PARALLEL)
├── Launch Agent A ──┐
├── Launch Agent B ──┼── Run simultaneously
└── Launch Agent C ──┘
    Each returns JSON with showstoppers array

Phase 4: SYNTHESIZE (sequential)
└── Launch Agent D with A+B+C reports
    Aggregates showstoppers → Final verdict
```

---

## Return Formats

### Agent A Response
```json
{
  "agent": "A",
  "primary_identification": "creature/object name",
  "confidence": 0-100,
  "alternative_identifications": ["other possibilities"],
  "showstoppers": ["issues undermining identification"],
  "visual_evidence": ["features leading to ID"],
  "concerns": ["unclear aspects"]
}
```

### Agent B Response
```json
{
  "agent": "B",
  "goal": "TARGET NAME",
  "score": 0-100,
  "showstoppers": ["issues making model fail as target"],
  "strengths": ["what works well"],
  "remaining_issues": ["what needs work"],
  "geometry_recommendations": ["specific SDF fixes"]
}
```

### Agent C Response
```json
{
  "agent": "C",
  "goal": "TARGET NAME",
  "showstoppers": ["P0 issues that BLOCK commit"],
  "issues": [
    {"name": "ISSUE_NAME", "severity": "P0-P3", "evidence": "what's wrong", "fix": "how to fix"}
  ],
  "domain_expert_test": "Would expert recognize this? Why/why not?",
  "verdict": "X/10 with explanation"
}
```

### Agent D Response
```json
{
  "agent": "D",
  "model_version": "X.X",
  "all_showstoppers": ["COMBINED from A+B+C - if non-empty, must DO NOT COMMIT"],
  "consensus": {
    "a_confidence": 0,
    "a_identification": "",
    "b_score": 0,
    "c_verdict": ""
  },
  "verdict": "COMMIT or DO NOT COMMIT",
  "rationale": "explanation",
  "next_iteration_focus": "single most important fix"
}
```

---

## Issue Severity Levels

| Level | Name | Definition | Action |
|-------|------|------------|--------|
| **P0** | SHOWSTOPPER | Model fails to read as target | BLOCKS COMMIT |
| **P1** | Critical | Significant anatomical errors | Must fix before release |
| **P2** | Important | Reduces credibility/quality | Should fix |
| **P3** | Polish | Nice-to-have improvements | Can defer |

---

## Review Storage

### File Structure
```
lucid/automodel/
├── captures/
│   ├── v6.5-2026-01-01T21-15-00Z/
│   │   ├── 1.png through 6.png
│   └── ...
├── reviews/
│   ├── index.json
│   ├── 2026-01-01T21-00-00Z.json
│   └── ...
├── parliament-maker-skill.md (this file)
├── parliament-rules.md
├── sdf-skill.md
└── index.html (log viewer)
```

### Review JSON Structure
```json
{
  "session_id": "ISO8601 timestamp",
  "model_version": "X.X",
  "timestamp": "ISO8601",
  "captures_folder": "vX.X-TIMESTAMP",
  "agents": {
    "A": { "primary": "", "confidence": 0, "showstoppers": [] },
    "B": { "score": 0, "showstoppers": [] },
    "C": { "verdict": "", "showstoppers": [] },
    "D": { "verdict": "", "all_showstoppers": [], "next_fix": "" }
  },
  "status": "COMMITTED / ITERATE"
}
```

---

## Prompt Templates

### Agent A Prompt (MINIMAL - no hints!)
```
You are Agent A - Blanked Evaluator.

View the images at: /tmp/eval/view-01.png through view-06.png
Geometry reference: /tmp/eval/blanked.json

You have NO context about what this model is supposed to be.
Identify the creature or object you see.
Give your confidence percentage.

Return JSON with: primary_identification, confidence, showstoppers array.
```

### Agent B/C Prompt
```
You are Agent [B/C] - [Role Name].

GOAL: This model should be [TARGET].

Images: /tmp/eval/view-01.png through view-06.png
Geometry: /tmp/eval/real.json

Evaluate how well this achieves the goal.
Return showstoppers array with any P0 issues.

[Role-specific instructions]
```

### Agent D Prompt
```
You are Agent D - Parliament Moderator.

GOAL: [TARGET]

Agent A Report: [full JSON]
Agent B Report: [full JSON]
Agent C Report: [full JSON]

Aggregate ALL showstoppers from A, B, C into all_showstoppers.
If all_showstoppers is non-empty, verdict MUST be DO NOT COMMIT.

Return final verdict and next iteration focus.
```

---

## Anti-Patterns to Avoid

### 1. Contaminating Agent A
❌ "The model has tubercles on the head like a humpback"
✅ "What creature/object is this?"

### 2. Ignoring Showstoppers
❌ "Agent A got 95%, let's commit despite Agent C's P0"
✅ "Agent C found P0 showstopper → DO NOT COMMIT"

### 3. View Shopping
❌ "Let's try a different angle where flippers look smaller"
✅ "Flippers read too large → fix the geometry"

### 4. Incomplete Returns
❌ Agent returns text without showstoppers array
✅ Every agent returns JSON with explicit showstoppers: []

### 5. Skipping Capture Logging
❌ Evaluate without saving renders
✅ Always save to captures/vX.X-TIMESTAMP/

---

## Success Criteria

A model is ready to commit when:
1. ✅ Agent A correctly identifies target (>80% confidence)
2. ✅ Agent B scores >75/100
3. ✅ Agent C passes domain expert test
4. ✅ **ALL showstoppers arrays are EMPTY**
5. ✅ Agent D verdict is COMMIT

---

## References

- `lucid/automodel/parliament-rules.md` - Detailed rules
- `lucid/automodel/sdf-skill.md` - SDF primitives reference
- `lucid/automodel/index.html` - Review log viewer
- `CLAUDE.md` - Project integration documentation
