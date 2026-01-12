# CLAUDE.md - Lucid SDF/CSG System

## Quick Reference

**Main Entry Points:**
- `index.html` - Full-featured scene viewer with params, debug, backend switching
- `node-editor.html` - Visual SDF composition + timeline scrubber
- `scene-catalog.html` - Grid comparison Mayfly vs Stinkyfish
- `compare.html` - Side-by-side renderer comparison
- `stinkyfish/demo.html` - Standalone WebGPU demo with dedicated components

**Backends:**
- **Mayfly** (`mayfly/`) - WebGL raymarcher, works everywhere
- **Stinkyfish** (`stinkyfish/`) - WebGPU raymarcher, auto-selected when available

## Architecture

```
JSON Scene
    ↓ (core/json-loader.js)
IR Nodes (resolved refs, processed params)
    ↓ (core/json-codegen.js OR core/wgsl-codegen.js)
GLSL/WGSL Fragment Shader
    ↓ (mayfly/raymarcher.js OR stinkyfish/raymarcher.js)
WebGL/WebGPU Render
```

## Key Directories

```
lucid/
├── core/           # Shared: json-loader, json-codegen, wgsl-codegen, rig-evaluator
├── mayfly/         # WebGL backend (SimpleRaymarcher)
├── stinkyfish/     # WebGPU backend (StinkyfishRenderer)
├── components/     # Web components: lucid-renderer, scene-picker, scene-params
├── scenes/         # JSON scene library organized by category
│   ├── toc.json    # Master table of contents
│   ├── creatures/  # Animals and characters
│   ├── physics/    # Physics-enabled scenes
│   └── ...
├── automodel/      # ABCD Parliament evaluation system for 3D models
└── scripts/        # Build/utility scripts
```

## Scene Management

**TOC is the master index**: `scenes/toc.json`
- When adding/removing scenes, ALWAYS update toc.json
- Scenes can appear in multiple categories
- Recent Changes category auto-updates via pre-commit hook

## Backend API Compatibility

Both backends expose:
- `setParam(name, value)` - Update scene parameter
- `setSceneParams(params)` - Set all params at once
- Camera controls: `cameraDistance`, `cameraTheta`, `cameraPhi`, `cameraTarget`

Mayfly-specific:
- `updateScene(glsl, params, rig, sceneJson)` - Compile and render

Stinkyfish-specific:
- `compileScene(wgsl, uniformLayout)` - Compile WGSL shader
- `setSceneParam(name, value)` - Original method (setParam is alias)

## Param Panel Features

The params panel in index.html shows:
- **Scalar sliders** with live value display
- **Color3 pickers** with native color input + hue slider
- **Vec3 inputs** for position/radii/direction params
- **Binding state badges**:
  - ⚛️ phys (green) - Physics-driven
  - ⚙️ constrained (purple) - Rig constraint follower
  - ⚙️ driver (purple) - Drives other params
  - ƒ expr (yellow) - Expression-driven

## Node Editor Features

`node-editor.html` provides:
- Visual node graph for SDF composition
- Live preview via `<lucid-renderer>` component
- Property editing with color picker + hue slider
- Timeline scrubber with play/pause/loop
- Print layout for documentation (uses `print-layout.js`)
- Touch-friendly with pinch-zoom and haptic feedback

## Common Issues

### Backend Switching
When switching Mayfly ↔ Stinkyfish, canvas is replaced (context type can't change).
New canvas copies dimensions and styles from old canvas.

### Param Sync
Both backends use `setParam()` for individual param updates.
Stinkyfish's `setParam()` is an alias for `setSceneParam()`.

### GLSL/WGSL Errors
- Type mismatches: Ensure floats have decimal (1.0 not 1)
- WGSL differences: Use `vec3f` not `vec3`, etc.

## Development

```bash
# Serve locally
python -m http.server 8080

# Open main viewer
http://localhost:8080/lucid/index.html

# Open node editor
http://localhost:8080/lucid/node-editor.html
```

## Related Documentation

**In this folder:**
- `README.html` - Full documentation with examples
- `TESTING-STRATEGY.md` - Testing approach
- `SCOPE-AND-GAMES.md` - Project scope and game designs
- `automodel/parliament-rules.md` - ABCD evaluation rules

**Project root:**
- `../CLAUDE.md` - Main project instructions with detailed Lucid sections
