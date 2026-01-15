# ABCD Parliament Timing Spec

## Parallel vs Sequential

```
┌─────────────────────────────────────────────────────┐
│  Capture Phase (sequential)                         │
│  └─ 12 viewpoints, ~10s each = ~120s                │
├─────────────────────────────────────────────────────┤
│  Analysis Phase                                      │
│  ┌─────────┬─────────┬─────────┐                    │
│  │ Agent A │ Agent B │ Agent C │  ← PARALLEL        │
│  │ (blind) │(informed│(skeptic)│                    │
│  │         │+SDFSkill│         │                    │
│  └─────────┴─────────┴─────────┘                    │
│  Time = MAX(A, B, C), not SUM                       │
├─────────────────────────────────────────────────────┤
│  Synthesis Phase (sequential)                        │
│  └─ Agent D receives A+B+C reports                  │
└─────────────────────────────────────────────────────┘
```

## Timing Breakdown Required

Each session log must capture:
```json
{
  "timings": {
    "capture_ms": 118000,
    "agent_a_ms": null,      // TODO: track individually
    "agent_b_ms": null,      // TODO: track individually
    "agent_c_ms": null,      // TODO: track individually
    "agent_d_ms": null,      // TODO: track individually
    "abc_parallel_ms": null, // wall-clock for parallel A+B+C
    "total_analysis_ms": 197000,
    "total_loop_ms": 316000
  }
}
```

## Agent Capabilities

| Agent | Role | SDF Skill | Vision | Geometry JSON |
|-------|------|-----------|--------|---------------|
| A | Blind evaluator | NO | YES | NO |
| B | Informed evaluator | **YES** | YES | YES |
| C | Skeptical slop detector | **TODO: ADD** | YES | NO |
| D | Parliament moderator | NO | NO | NO |

## Bottleneck Analysis

**Likely slowest:** Agent B (reads JSON + SDF skill + vision)
**Second slowest:** Agent C (detailed structured critique)
**Fastest:** Agent A (simple identification task)

## Improvement: Give Agent C the SDF Skill

Agent C should have SDF Skill access to provide **actionable geometry fixes**
instead of vague "fix the tail" instructions.

Current C prompt lacks: line numbers, specific radii, transform values
With SDF Skill: C can specify exact JSON changes needed
