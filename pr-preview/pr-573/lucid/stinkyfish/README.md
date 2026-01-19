# Stinkfish - WebGPU SDF Engine

> "Data ages like wine, software ages like fish"

Interop and content longevity are prime. Scene JSON is the durable artifact; renderers come and go.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Scene JSON (durable)               │
│  - SDF primitives, BVH, physics, params         │
└─────────────────────┬───────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐  ┌──────────┐  ┌──────────┐
   │  Lucid  │  │Stinkfish │  │ Future   │
   │ (WebGL) │  │ (WebGPU) │  │ (Native) │
   └─────────┘  └──────────┘  └──────────┘
```

## Key Differences from WebGL (Lucid)

| Aspect | WebGL/Lucid | WebGPU/Stinkfish |
|--------|-------------|------------------|
| Shader lang | GLSL ES 3.0 | WGSL |
| Uniform binding | `gl.uniform*` | Bind groups |
| Compute | Not available | Full compute shaders |
| Memory | Explicit upload | Can map buffers |
| Apple Silicon | Copy to VRAM | Unified memory (free) |

## Compute Shader Physics

On discrete GPUs, use compute shaders for physics prediction:

```
Frame N:
  1. Compute pass: predict positions (GPU-side verlet)
  2. Copy pass: upload CPU corrections (async)
  3. Render pass: interpolate and raymarch
```

This hides CPU→GPU latency on non-Apple hardware.

## Status

- [ ] WGSL codegen from scene JSON
- [ ] Basic raymarcher port
- [ ] Compute shader physics prediction
- [ ] BVH traversal in WGSL

## Files

- `docs/` - Documentation and skills
- `wgsl-codegen.js` - (planned) WGSL generator
- `stinkfish.js` - (planned) WebGPU renderer
