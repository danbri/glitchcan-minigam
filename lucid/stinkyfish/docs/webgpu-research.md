# WebGPU SDF Raymarching Research

## Apple Silicon Advantage

**Unified Memory Architecture (UMA)**:
- M1/M2/A-series share RAM between CPU and GPU
- No explicit copy needed for uniform updates
- Physics positions update CPU-side, shader reads them - zero copy

**Metal backend**:
- WebGPU compiles to Metal on iOS/macOS
- Automatic UMA benefit

**SIMD capabilities**:
- CPU: NEON (128-bit, 4 floats)
- GPU: Massive parallelism (thousands of threads)
- AMX: Matrix coprocessor

## Discrete GPU Strategy

For NVIDIA/AMD with separate VRAM:

```
GPU Compute Shader (prediction):
  - Simple verlet integration
  - Sphere-sphere collisions
  - Runs every frame, full framerate

CPU Physics (authoritative):
  - Complex constraints
  - Accurate collisions
  - Streams updates async (1-2 frames behind)

Interpolation:
  pos = mix(gpuPredicted, cpuAuthoritative, blendFactor)
```

## WGSL vs GLSL

Key translation points:

```glsl
// GLSL
uniform vec3 u_position;
void main() { ... }
```

```wgsl
// WGSL
@group(0) @binding(0) var<uniform> u_position: vec3<f32>;
@fragment fn main() -> @location(0) vec4<f32> { ... }
```

**Differences**:
- Explicit type annotations required
- `@group` and `@binding` decorators
- No implicit conversions (e.g., `int` to `float`)
- Different built-in names (`length()` → `length()`, same)

## Analyzed Projects

**wgpu-raymarcher** (~845 lines):
- Fullscreen quad + fragment shader
- Standard raymarching loop
- Shows WGSL SDF patterns

## Implementation Plan

1. **wgsl-codegen.js**: Parallel to json-codegen.js, emits WGSL
2. **Uniform bind groups**: Map scene params to WGSL bindings
3. **Compute physics**: Optional compute pass for prediction
4. **BVH in WGSL**: Same AABB checks, WGSL syntax

## iOS WebGPU Status

- Safari 17+: WebGPU enabled by default
- Older: Behind flag or unavailable
- Feature detect: `if ('gpu' in navigator)`
