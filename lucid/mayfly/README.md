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

- `mayfly/raymarcher.js` - SimpleRaymarcher class
- `ui/scene-panel.js` - Parameter sliders
- `ui/tree-view.js` - Scene graph inspector

## Limitations

- No compute shaders (WebGL 2.0)
- Explicit uniform uploads each frame
- Single-threaded raymarching
- No persistent GPU state

## See Also

- `stinkyfish/` - WebGPU successor (planned)

---

# DRAFT: Lucid Multi-Backend Architecture

## Goal

Disentangle **data** (scenes, models, BVH, physics) from **code** (renderers) so content outlives any particular renderer implementation.

```
┌────────────────────────────────────────────────────────────┐
│                    DURABLE LAYER                           │
│  scenes/*.json   bvh-builder.js   physics-scene.js         │
│  Scene JSON is the artifact. Renderers are disposable.     │
└────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
┌──────────────────────┐    ┌──────────────────────┐
│       mayfly/        │    │     stinkyfish/      │
│   WebGL + GLSL       │    │   WebGPU + WGSL      │
│   ~20 line frag      │    │   Compute shaders    │
│   Shadertoy-esque    │    │   Efficient BVH      │
│   Zero dependencies  │    │   GPU physics        │
└──────────────────────┘    └──────────────────────┘
```

## Proposed Structure

```
lucid/
├── core/                    # SHARED (renderer-agnostic)
│   ├── json-loader.js       # Scene JSON → internal repr
│   ├── bvh-builder.js       # Spatial partitioning
│   ├── physics-scene.js     # Physics simulation
│   ├── rig-evaluator.js     # Parametric constraints
│   └── scene-schema.json    # (new) JSON schema for validation
│
├── mayfly/                  # WEBGL BACKEND
│   ├── glsl-codegen.js      # Internal repr → GLSL
│   ├── raymarcher.js        # WebGL renderer
│   └── README.md
│
├── stinkyfish/              # WEBGPU BACKEND
│   ├── wgsl-codegen.js      # Internal repr → WGSL
│   ├── renderer.js          # WebGPU renderer
│   ├── compute-physics.js   # GPU-side physics prediction
│   └── README.md
│
├── ui/                      # SHARED UI (renderer-agnostic)
│   ├── scene-panel.js       # Parameter sliders
│   ├── tree-view.js         # Scene inspector
│   └── renderer-picker.js   # (new) Switch backends
│
└── scenes/                  # CONTENT (completely renderer-agnostic)
    ├── creatures/
    ├── ablation/
    └── toc.json
```

## Shared Interfaces

### Renderer Interface (both backends implement)

```javascript
interface LucidRenderer {
  // Lifecycle
  constructor(canvas: HTMLCanvasElement)
  destroy(): void

  // Scene
  loadScene(json: object): void

  // Parameters
  setParam(name: string, value: any): void
  getParam(name: string): any

  // Camera
  camera: { distance, phi, theta, target }

  // Render
  render(): void

  // Optional
  setQuality?(level: 'low' | 'medium' | 'high'): void
}
```

### Codegen Interface

```javascript
interface ShaderCodegen {
  // Take processed scene, emit shader code
  generate(scene: ProcessedScene): string

  // Uniform declarations
  getUniformDeclarations(): string

  // Entry point name
  getEntryPoint(): string
}
```

## Migration Path

### Phase 1: Extract (current → shared core)
- [x] bvh-builder.js already renderer-agnostic
- [x] physics-scene.js already renderer-agnostic
- [ ] Move json-codegen.js GLSL parts → mayfly/glsl-codegen.js
- [ ] Keep scene processing in core/

### Phase 2: Duplicate (create stinkyfish backend)
- [ ] wgsl-codegen.js parallel to glsl-codegen.js
- [ ] WebGPU renderer with same interface as SimpleRaymarcher
- [ ] Feature-detect and pick backend

### Phase 3: Enhance (stinkyfish-only features)
- [ ] Compute shader physics prediction
- [ ] Persistent GPU state
- [ ] Multi-bounce GI (someday)

## Content Longevity Principles

1. **Scene JSON is king** - The .json files are the durable artifacts
2. **No renderer-specific scene data** - Scenes don't know about GLSL/WGSL
3. **Backends are disposable** - Can rewrite renderer without touching content
4. **Forward compatibility** - New backends can read old scenes
5. **Graceful degradation** - Mayfly fallback when WebGPU unavailable

## Open Questions

- Should BVH be baked into scene JSON or computed at load time?
- How to handle renderer-specific optimizations (e.g., GPU physics)?
- Shared test suite that runs against both backends?
- How to handle feature gaps (e.g., compute shaders in stinkyfish only)?

## Why "Mayfly"?

Ephemeral. Lives for a day. The simplest possible raymarcher - a single fragment shader, no compute, no persistent state. When WebGPU is ready, mayfly can retire gracefully, having served its purpose.

## Why "Stinkyfish"?

"Data ages like wine, software ages like fish." The ironic name reminds us that even stinkyfish will someday smell. But the scene JSON - that's the wine.
