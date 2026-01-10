# Mayfly - WebGL SDF Raymarcher

The current naive GLSL raymarcher. Named for its ephemeral nature - will eventually be superseded by stinkyfish (WebGPU).

## Architecture

```
Scene JSON → json-loader.js → json-codegen.js → GLSL → WebGL
```

## Core Files

- `json-loader.js` - Parse and validate scene JSON
- `json-codegen.js` - Generate GLSL from scene graph
- `glsl-codegen.js` - Legacy DSL-based codegen
- `dsl-parser.js` - S-expression parser

## Renderer

- `ui/raymarcher.js` - SimpleRaymarcher class
- `ui/scene-panel.js` - Parameter sliders
- `ui/tree-view.js` - Scene graph inspector

## Limitations

- No compute shaders (WebGL 2.0)
- Explicit uniform uploads each frame
- Single-threaded raymarching
- No persistent GPU state

## See Also

- `stinkyfish/` - WebGPU successor (planned)
