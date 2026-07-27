only report to me in ASD-STE100 Simplified Technical English.

# CLAUDE.md - Yeti Bestiary

## Core Principle: Zero Code Dependencies

**CRITICAL**: Yeti has **zero code dependencies** with `lucid/*`.

- Do NOT import from `../lucid/`
- Do NOT share JavaScript modules
- Do NOT reference Lucid's core libraries

The ONLY shared element is **data format compatibility** - Yeti's JSON creature definitions should be structured so they could theoretically be imported into Lucid, but the code that processes them is completely independent.

## Purpose

Yeti is for **weird experiments** with creature representations:

1. **Parametric morphology** - Body plans as parameter vectors
2. **Vector space projection** - Animals as points in continuous spaces
3. **SVD/PCA decomposition** - Finding principal axes of variation
4. **Design space exploration** - Semantic navigation of morphospace

## Data Format

Creature parameters use this structure (shared with Lucid):

```json
{
  "name": "Species Name",
  "emoji": "🦁",
  "params": {
    "color": [r, g, b],           // RGB 0-1
    "bodyRadii": [x, y, z],       // Ellipsoid radii
    "headPos": [x, y, z],         // Position offset
    "legThighR": 0.15,            // Scalar radius
    ...
  }
}
```

## Development Guidelines

### Self-Contained HTML
Each demo should be a single HTML file with embedded:
- CSS styles
- JavaScript logic
- GLSL shaders
- Creature data (JSON in `<script type="application/json">`)

This keeps experiments isolated and portable.

### SDF Rendering
Use standard raymarching SDF techniques:
- `sdEllipsoid`, `sdCapsule`, `sdRoundCone` primitives
- `smin()` for smooth blending
- Rotation matrices for positioning body parts

### Parameter Organization
Group parameters semantically:
- **Global modifiers**: smoothness, scale, fatness
- **Body parts**: body, rump, head, snout, ears, legs, tail
- **Each part**: radii (shape) + position + rotation

### Export Format
JSON exports should include:
- Species name
- Global modifiers at time of export
- Full parameter set
- Timestamp (optional)

## Experimentation Ideas

### Vector Space Operations
```javascript
// Interpolate between two creatures
function lerp(a, b, t) {
  return Object.fromEntries(
    Object.keys(a).map(k => [k, lerpValue(a[k], b[k], t)])
  );
}

// Find centroid of multiple creatures
function centroid(creatures) {
  return creatures.reduce((acc, c) => lerp(acc, c, 1/creatures.length), creatures[0]);
}
```

### SVD Decomposition
```javascript
// Stack creature params into matrix
// Each row = one creature, each column = one parameter
// SVD gives: principal components of morphological variation
// First PC might be "size", second might be "legginess", etc.
```

### Random Walks
```javascript
// Generate novel creatures by random walk in param space
function mutate(params, stepSize) {
  return Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, perturb(v, stepSize)])
  );
}
```

## File Organization

```
yeti/
├── README.md          # Project overview
├── CLAUDE.md          # This file
├── 4legs/             # Parametric quadruped demo
│   └── index.html     # Self-contained demo
├── morphspace/        # Future: PCA visualization
├── genetics/          # Future: evolutionary algorithms
└── data/              # Future: creature JSON library
```

## What NOT To Do

- Don't create complex build systems
- Don't add npm dependencies
- Don't share code with lucid/
- Don't worry about production quality
- Don't over-engineer - this is a playground

## What TO Do

- Keep experiments self-contained
- Document interesting findings
- Export promising creatures as JSON
- Try weird mathematical operations on parameters
- Break things and learn from it
