# CLAUDE.md - Lucid SDF/CSG System

## Overview
WebGL raymarching SDF (Signed Distance Function) system with JSON scene description.
Mobile-first, webkit/iOS compatible. Future WebGPU support planned.

## Key Files

### Core
- `core/json-loader.js` - Parses JSON scene, resolves defs/refs, builds IR
- `core/json-codegen.js` - Generates GLSL from IR nodes
- `ui/raymarcher.js` - WebGL raymarcher with orbit camera

### Demos
- `demos_json.html` - Main demo app with 8 built-in templates
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
