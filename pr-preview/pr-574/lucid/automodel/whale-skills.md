# Whale Skills - Humpback Whale Anatomy Reference

## Species: Megaptera novaeangliae (Humpback Whale)

This skill document provides anatomical proportions and SDF construction patterns specific to humpback whale modeling.

## Defining Characteristics

Humpback whales are identifiable by:
1. **Extremely long pectoral flippers** - longest of any cetacean
2. **Head tubercles** - prominent bumps on rostrum
3. **Ventral throat grooves** - expandable pleats
4. **Small dorsal fin** - positioned 2/3 back on body
5. **Distinctive tail flukes** - wide, with serrated trailing edge and center notch

## Critical Proportions

| Feature | Proportion | Notes |
|---------|-----------|-------|
| **Flipper length** | 30-33% body length | THE defining feature - longest of any whale |
| **Flipper width** | 25-33% of flipper length | Paddle-shaped, not stick-like |
| **Tail fluke span** | 40% body length | Wide horizontal paddles |
| **Tail fluke thickness** | <5% of span | Very flat |
| **Body length:width** | 7:1 to 8:1 | Chunky, robust - NOT sleek |
| **Head tubercles** | Radius 0.3-0.5 | Prominent, visible bumps |
| **Dorsal fin position** | 2/3 back from head | Small, variable shape |

## Common Proportion Errors

### Flipper Length
- **Wrong**: 60-100% body length (looks like airplane)
- **Correct**: 30-33% body length
- **Test**: Flipper tips should reach approximately 1/3 down body, NOT to tail

### Body Shape
- **Wrong**: 10:1+ ratio (torpedo, sleek)
- **Correct**: 7:1-8:1 ratio (chunky, barrel-bodied)
- **Test**: Should look robust, heavy - humpbacks are 30-40 ton animals

### Tail Flukes
- **Wrong**: >50% body span (airplane wings)
- **Correct**: ~40% body span
- **Test**: Should look proportional, not dominating silhouette

## SDF Construction Patterns

### Pectoral Flipper (3-section compound)
```json
{
  "type": "smoothUnion", "k": 0.25,
  "children": [
    {
      "type": "ellipsoid",
      "params": { "radii": [1.8, 0.25, 0.5] },
      "transform": { "translate": [0.8, -0.3, 0.8], "rotate": [15, 25, -10] }
    },
    {
      "type": "ellipsoid",
      "params": { "radii": [1.4, 0.20, 0.45] },
      "transform": { "translate": [2.0, -0.5, 0.3], "rotate": [20, 32, -15] }
    },
    {
      "type": "ellipsoid",
      "params": { "radii": [1.0, 0.15, 0.35] },
      "transform": { "translate": [3.0, -0.8, -0.2], "rotate": [28, 38, -20] }
    }
  ]
}
```
**Key proportions**:
- Total length ~4 units for 12-unit body = 33%
- z-radii (width) = 25-30% of x-radii (length)
- Swept-back angle: 25-40 degrees on Y rotation
- Taper from base to tip

### Head Tubercles (10-15 bumps)
```json
{
  "type": "union",
  "children": [
    { "type": "ellipsoid", "params": { "radii": [0.35, 0.28, 0.28] }, "transform": { "translate": [0.2, 0.5, 5.5] } },
    { "type": "ellipsoid", "params": { "radii": [0.42, 0.35, 0.35] }, "transform": { "translate": [-0.3, 0.55, 6.0] } },
    { "type": "ellipsoid", "params": { "radii": [0.38, 0.30, 0.30] }, "transform": { "translate": [0.4, 0.48, 6.5] } }
    // ... more bumps with VARIED sizes and positions
  ]
}
```
**Key traits**:
- Distribute across entire rostrum, not just tip
- Vary sizes (0.25-0.50 radii)
- Slightly irregular positioning
- Each tubercle contains a hair follicle (sensory)

### Tail Flukes (mirrored with notch)
```json
{
  "type": "subtract",
  "children": [
    {
      "type": "mirror", "axis": "x",
      "child": {
        "type": "ellipsoid",
        "params": { "radii": [2.4, 0.18, 0.7] },
        "transform": { "translate": [1.3, 0, -5.0], "rotate": [0, 10, 0] }
      }
    },
    {
      "type": "ellipsoid",
      "params": { "radii": [0.35, 0.22, 0.5] },
      "transform": { "translate": [0, 0, -5.0] }
    }
  ]
}
```
**Key proportions**:
- Span ~4.8 units for 12-unit body = 40%
- y-radius (thickness) <5% of x-radius
- Center notch creates distinctive silhouette

### Ventral Grooves (6-8 visible)
```json
{
  "type": "material",
  "params": { "color": [0.75, 0.78, 0.82] },
  "child": {
    "type": "union",
    "children": [
      { "type": "ellipsoid", "params": { "radii": [0.08, 0.12, 2.5] }, "transform": { "translate": [0.3, -0.6, 1.0] } },
      { "type": "ellipsoid", "params": { "radii": [0.10, 0.14, 2.8] }, "transform": { "translate": [0.5, -0.55, 0.8] } }
      // ... more grooves with VARIED spacing and depth
    ]
  }
}
```
**Key traits**:
- 12-36 grooves in reality, model 6-8 for visibility
- Vary thickness and spacing slightly
- Run from chin to navel area
- Lighter color than dorsal surface

### Dorsal Fin (small, triangular)
```json
{
  "type": "ellipsoid",
  "params": { "radii": [0.25, 0.50, 0.30] },
  "transform": { "translate": [0, 0.75, -1.0] }
}
```
**Key traits**:
- Much smaller than other whale species
- Variable shape (can be hooked, triangular, or stubby)
- Located 2/3 back on body
- Must be VISIBLE - increase size if not rendering

## Coloration Pattern

- **Dorsal**: Dark gray-black [0.18-0.25, 0.20-0.26, 0.24-0.30]
- **Ventral**: White to mottled [0.85-0.95, 0.87-0.96, 0.90-0.98]
- **Flipper underside**: White patches
- **Fluke underside**: Unique pattern per individual (like fingerprints)

## Marine Biologist Test

Ask: "Would a marine biologist be embarrassed to have this model in educational materials?"

Check:
- [ ] Flippers reach only 1/3 down body, not to tail
- [ ] Body is chunky (7:1-8:1), not torpedo-like
- [ ] Tubercles visible on head
- [ ] Small dorsal fin visible
- [ ] Tail flukes proportional (~40% body), not airplane wings
- [ ] Overall silhouette reads as "robust baleen whale"

## References

- Megaptera novaeangliae typical adult: 12-16m length, 25-40 tons
- Longest recorded pectoral fin: 5m (on 15m whale = 33%)
- Fluke span typically 3-4m (on 12m whale = 25-33%)
