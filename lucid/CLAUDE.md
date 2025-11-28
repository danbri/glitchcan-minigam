# CLAUDE.md - Lucid SDF/CSG System

## Related Documentation

**In this folder:**
- [README.html](README.html) - Full documentation with examples
- [ASSESSMENT.md](ASSESSMENT.md) - Architecture deep-dive
- [COMPONENTS.md](COMPONENTS.md) - Web component API
- [TESTING-STRATEGY.md](TESTING-STRATEGY.md) - Testing approach
- [SCOPE-AND-GAMES.md](SCOPE-AND-GAMES.md) - Project scope and game designs

**Project root:**
- [../CLAUDE.md](../CLAUDE.md) - Main project instructions
- [../README.md](../README.md) - Project overview

## Purpose

This project defines a node-based CSG/SDF scene language and a minimal ray-marched WebGL implementation capable of rendering scenes described in that language.

The language must:
1. Be simple enough to parse, transform, and statically analyse.
2. Compile deterministically to WebGL fragment-shader code.
3. Avoid pathological shader expansion (e.g. deeply nested min chains).
4. Support reusable definitions, transforms, materials, and animation expressions.
5. Render correctly on mobile-class WebGL implementations (no WebGPU required).

A small animated Space Invaders scene is required as a provocation test for the language: multiple instantiations of a reusable invader node, each animated via time-based expressions, rendered with CSG/SDF operations.

## Requirements Summary

### Node Language
- Tree-structured JSON representation
- Nodes: `box`, `sphere`, `cylinder`, `torus`, `union`, `subtract`, `intersection`, `transform`, `material`, `ref`
- Expressions: `sin`, `add`, `mul`, etc., evaluated per-frame
- Reusable definitions under `defs`

### Compiler Constraints
- Stateless SDF evaluation via raymarching
- Each node compiles to a pure function or inline expression
- Limit child count in union/subtract to avoid GLSL blow-ups
- Predictable shader size and rendering cost per pixel

### Execution Model
- Single WebGL fragment program (WebGL 1 or 2)
- Per-pixel raymarcher with configurable max steps and epsilon
- Mobile-friendly: must run on iOS Safari, avoid GPU watchdog resets

### Best-Practice Guidelines
- Use small, shallow SDF trees
- Avoid union nodes with >8 children
- Avoid subtract nodes applied to large unions
- Prefer few large primitives over many micro-voxels

### Space Invader Test Requirements
- Reusable invader definition
- At least 6 simultaneous invader instances
- Time-based animation transforms
- Two material variants (green and magenta)
- Must run >30 FPS on mobile Safari

## Key Files

### Core
- `core/json-loader.js` - Parses JSON scene, resolves defs/refs, builds IR
- `core/json-codegen.js` - Generates GLSL from IR nodes
- `ui/raymarcher.js` - WebGL raymarcher with orbit camera

### Demos
- `demos_json.html` - Main demo app with 8 built-in templates (v0.2.0)
- `README.html` - Documentation and architecture overview

## Version Management

**VERSION is a hardcoded constant** in `demos_json.html`:

```javascript
const VERSION = '0.2.0';
const BUILD_DATE = '2025-11-28';
```

### To Update Version:
1. Edit `demos_json.html`, find the VERSION constant (~line 637)
2. Bump version number following semver (MAJOR.MINOR.PATCH)
3. Update BUILD_DATE to current date
4. Commit with message like "Bump version to v0.3.0"
5. Optionally tag: `git tag v0.3.0 && git push origin v0.3.0`

### Why Manual?
- No build process (static HTML/JS)
- Simple and transparent
- GitHub releases can reference tags

## JSON Scene Format

```json
{
  "version": "1.0",
  "defs": {
    "myShape": { "type": "sphere", "params": { "r": 1.0 } }
  },
  "root": {
    "type": "union",
    "children": [
      { "type": "ref", "id": "myShape", "transform": { "translate": [1, 0, 0] } }
    ]
  }
}
```

### Node Types
- **Primitives**: `sphere`, `box`, `torus`, `cylinder`
- **CSG ops**: `union`, `subtract`, `intersect`, `smoothUnion`
- **Modifiers**: `transform`, `material`, `group`
- **References**: `ref` (uses `defs`)

### Expressions (for animation)
```json
{ "expr": "sin", "args": [{ "var": "time" }] }
```
Supported: `add`, `sub`, `mul`, `div`, `sin`, `cos`, `min`, `max`, `clamp`, `smoothstep`

## CSG Color Handling

- **Union**: Uses color from closest child (smallest distance)
- **Intersect**: Uses color from farthest child (largest distance)
- **SmoothUnion**: Blends colors proportionally to blend factor
- **Subtract**: Uses base shape's color

## Camera Controls

- **Orbit**: Drag anywhere (except edges) to orbit
- **Zoom**: Mouse wheel or pinch gesture
- **Navigation**: Swipe from 5% edge zones, or arrow keys

## Debug Panel

Press 'D' or click Debug button:
- Volume render mode toggle
- Ground plane toggle
- Camera distance slider
- Version display

## Adding New Primitives

1. Add case in `json-codegen.js` `walkNode()` switch
2. Create `generateMyPrimitive(node, ctx)` function
3. Add GLSL SDF function in `generatePrimitiveFunctions()`
4. Add to `json-loader.js` if special param processing needed

## Common Issues

### GLSL Errors
- **Type mismatch**: Ensure floats have decimal (1.0 not 1)
- **min/max >2 args**: Use chainedMin/chainedMax helpers
- **u_time redefined**: Skip builtin uniforms in codegen

### Colors Not Working
- Check CSG op is using correct color selection (not always c0)
- Material wrapper must be outside transform

### Refs Not Transforming
- Transforms must propagate through combineTransforms()
- Translations ADD, don't overwrite

## Development

```bash
# Serve locally
python -m http.server 8080
# or
npx serve -p 8080

# Open
http://localhost:8080/lucid/demos_json.html
```

## Architecture

```
JSON Scene
    ↓ (json-loader.js)
IR Nodes (with resolved refs, processed params)
    ↓ (json-codegen.js)
GLSL Fragment Shader
    ↓ (raymarcher.js)
WebGL Render
```

## Future Directions

- Optional WebGPU compute shader backend
- Automatic SDF tree optimisation (node hoisting, union flattening)
- Visual node graph editor generating the JSON schema
- Templates for common shapes (characters, terrain, volumetric assets)
