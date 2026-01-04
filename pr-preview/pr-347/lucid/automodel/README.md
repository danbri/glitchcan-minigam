# Lucid Automodel - ABCD Parliament Workflow

Automated model evaluation and iteration system using multi-agent review.

## Folder Structure

```
lucid/automodel/
├── README.md           # This file
├── sdf-skill.md        # SDF primitive reference for Agent B
├── capture-timed.mjs   # Multi-angle capture with timing
├── captures/           # Timestamped capture sessions
│   └── <session-id>/   # ISO8601-based folder names
│       ├── 01-front-side.png
│       ├── 02-quarter-right.png
│       └── ... (12 viewpoints)
├── logs/               # Session timing and metadata
│   └── <session-id>.json
└── reviews/            # ABCD Parliament results
    └── <session-id>.json
```

## Workflow

### 1. Pre-Loop Commit
```bash
git add -A && git commit -m "Pre-loop: <version> ready for ABCD"
```

### 2. Capture (12 viewpoints, timed)
```bash
node lucid/automodel/capture-timed.mjs <scene.model> [session-id]
```

### 3. Run ABCD Parliament
- Agent A: Blind evaluation
- Agent B: Informed evaluation (uses sdf-skill.md)
- Agent C: Skeptical slop detector (structured P0/P1/P2 critique)
- Agent D: Parliament synthesis

### 4. Save Review
Reviews saved to `reviews/<session-id>.json` with:
- Agent reports
- Timings
- P0/P1/P2 action items
- Commit recommendation

### 5. Post-Loop Commit
```bash
git add -A && git commit -m "Post-loop: <version> ABCD results"
```

## Timing Metrics

Each session logs:
- `browser_launch`: Puppeteer startup time
- `page_load`: Scene loading time
- `captures[]`: Per-viewpoint capture times
- `agent_*`: Per-agent analysis times (when recorded)
- `total`: End-to-end session time

## Session ID Format

ISO8601-based: `YYYY-MM-DDTHH-MM-SS-sssZ`

Example: `2026-01-01T14-30-45-123Z`

## SDF Skill Reference

See `sdf-skill.md` for:
- Primitive types (ellipsoid, union, subtract, etc.)
- Common patterns (flippers, tubercles, flukes)
- Humpback whale proportions
- Debugging tips
