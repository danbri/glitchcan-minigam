# Yeti Bestiary

A bestiary for Lucid/Holoplasm experiments and interop.

## Philosophy

Yeti is a **data-first** creature laboratory with **zero code dependencies** on `lucid/*`. It shares Lucid's data formats (JSON scene descriptions, SDF primitives) but maintains complete independence in implementation.

This separation allows:
- Rapid experimentation without breaking production code
- Freedom to explore weird creature representations
- A sandbox for mathematical approaches to creature design

## What Lives Here

This directory is for experimenting with:

### Creature Representations as Data
- Parametric quadruped models (ellipsoids, capsules, smooth unions)
- Body plan schemas that capture morphological variation
- JSON formats compatible with Lucid's SDF renderer

### Vector Space Explorations
- Projecting animals into continuous parameter spaces
- Interpolating between species (elephant → dog morphs)
- Finding the "centroid" of quadruped morphospace

### SVD Decompositions
- Decomposing creature parameter matrices
- Finding principal axes of morphological variation
- Low-rank approximations of body plans

### Design Space Navigation
- High-level sliders that traverse meaningful dimensions
- "Fatness", "legginess", "ear prominence" as semantic axes
- Constraint-aware parameter exploration

## Data Format

Creature definitions follow this schema:

```json
{
  "name": "Elephant",
  "emoji": "🐘",
  "params": {
    "color": [0.55, 0.52, 0.5],
    "bodyRadii": [1.4, 1.1, 1.6],
    "headRadii": [0.6, 0.55, 0.55],
    "headPos": [0, 0.5, 1.8],
    "legThighR": 0.28,
    "legAnkleR": 0.22,
    ...
  }
}
```

This format is designed for:
- Direct consumption by WebGL SDF shaders
- Easy serialization/deserialization
- Human readability and manual tweaking
- Mathematical operations (interpolation, PCA, clustering)

## Demos

### 4legs/
Parametric quadruped engine with 53 parameters across 6 species. Features:
- Real-time SDF rendering
- Carousel-based species selection
- Full parameter panel with semantic groupings
- Export/import JSON parameter sets
- Helicopter orbit and parameter wiggle modes

## Relationship to Lucid

| Aspect | Yeti | Lucid |
|--------|------|-------|
| Purpose | Experimentation | Production |
| Dependencies | None | Complex |
| Data format | Shared | Shared |
| Code sharing | Zero | N/A |
| Stability | Wild | Stable |

Yeti can **export** JSON that Lucid can **import**, but the codebases are completely separate.

## Future Directions

- [ ] SVD-based morph slider (vary along principal components)
- [ ] Creature clustering visualization
- [ ] Parameter space random walk / genetic algorithm
- [ ] Import from Lucid scene JSON
- [ ] Export to Lucid-compatible format
- [ ] Multi-creature scene composition
