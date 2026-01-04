# Instanced Gaussian Splat Rendering Spec

**Version:** 0.1 (Draft)
**Status:** Proposal
**Author:** Claude + danbri
**Date:** 2025-12-04

## 1. Overview

### 1.1 Problem

Traditional Gaussian splatting bakes entire scenes into flat splat arrays. For procedural scenes with repeated elements (flower meadows, invader formations), this is wasteful:

- Baking time scales with instance count
- File sizes grow linearly with repetition
- No support for animated transforms without re-baking

### 1.2 Solution

**Instanced Splat Rendering**: Bake unique objects once as "splat templates", then render multiple instances with per-instance transforms at runtime.

```
Scene: 50 poppies + 30 sunflowers + 9 invaders + 1 cobra

Traditional:  ~50,000 splats baked, ~10MB file, no animation
Instanced:    ~4,300 template splats, ~1MB file, full transform animation
```

### 1.3 Goals

- 10x reduction in bake time for repeated content
- 10x reduction in file size
- Support animated instance transforms without re-baking
- Compatible with existing splat viewers (via export/flatten)
- Integrate with Lucid SDF scene format

---

## 2. Architecture

### 2.1 Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Lucid SDF Scene                          │
│  (JSON with defs, refs, repeat nodes)                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Template Extractor                          │
│  - Identifies unique objects from defs                       │
│  - Extracts instance transforms from scene graph             │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────┐     ┌─────────────────────────────────────┐
│  SDF Sampler    │     │     Instance Manifest               │
│  (per template) │     │  - Template ID → transform list     │
│                 │     │  - Per-instance color/scale/etc     │
└────────┬────────┘     └─────────────────┬───────────────────┘
         │                                │
         ▼                                │
┌─────────────────┐                       │
│  3DGS Trainer   │                       │
│  (per template) │                       │
└────────┬────────┘                       │
         │                                │
         ▼                                ▼
┌─────────────────────────────────────────────────────────────┐
│                 Instanced Splat Bundle                       │
│  - templates/*.ply (one per unique object)                   │
│  - manifest.json (instance transforms + metadata)            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Instanced Splat Renderer                        │
│  - WebGL2 / WebGPU                                          │
│  - Per-frame transform updates for animation                │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

1. **Extract**: Parse Lucid scene, identify `defs` as templates, collect instance transforms
2. **Sample**: For each template, sample SDF to point cloud
3. **Train**: Run 3DGS optimization on each template point cloud
4. **Bundle**: Package template splats + instance manifest
5. **Render**: Load bundle, render instances with transforms

---

## 3. File Formats

### 3.1 Instanced Splat Bundle (`.isplat`)

ZIP archive containing:

```
my-scene.isplat/
├── manifest.json
├── templates/
│   ├── poppy.ply
│   ├── sunflower.ply
│   ├── invader.ply
│   └── cobra.ply
└── textures/           # Optional, for textured splats
    └── ...
```

### 3.2 Manifest Schema

```json
{
  "version": "1.0",
  "scene": {
    "title": "Cobra vs Invaders",
    "bounds": { "min": [-5, -2, -5], "max": [5, 3, 5] }
  },
  "templates": {
    "poppy": {
      "file": "templates/poppy.ply",
      "splatCount": 487,
      "bounds": { "min": [-0.1, 0, -0.1], "max": [0.1, 0.4, 0.1] },
      "origin": [0, 0, 0]
    },
    "sunflower": {
      "file": "templates/sunflower.ply",
      "splatCount": 823,
      "bounds": { "min": [-0.15, 0, -0.15], "max": [0.15, 0.5, 0.15] },
      "origin": [0, 0, 0]
    },
    "invader": {
      "file": "templates/invader.ply",
      "splatCount": 1024,
      "bounds": { "min": [-0.5, -0.4, -0.1], "max": [0.5, 0.4, 0.1] },
      "origin": [0, 0, 0]
    },
    "cobra": {
      "file": "templates/cobra.ply",
      "splatCount": 2048,
      "bounds": { "min": [-0.8, -0.3, -0.8], "max": [0.8, 0.3, 0.8] },
      "origin": [0, 0, 0]
    }
  },
  "instances": [
    {
      "template": "poppy",
      "id": "poppy_0",
      "transform": {
        "translate": [0.3, -1.0, 0.2],
        "rotate": [0, 45, 0],
        "scale": [0.8, 0.8, 0.8]
      },
      "color": [1, 1, 1, 1],
      "visible": true
    },
    {
      "template": "poppy",
      "id": "poppy_1",
      "transform": {
        "translate": [-0.5, -1.0, 0.7],
        "rotate": [0, 120, 0],
        "scale": [1.1, 1.1, 1.1]
      }
    },
    {
      "template": "invader",
      "id": "invader_0",
      "transform": { "translate": [-1.5, 2.0, 0] },
      "animation": {
        "type": "expression",
        "translate": [
          { "expr": "add", "args": [-1.5, { "expr": "mul", "args": [0.1, { "expr": "sin", "args": ["time"] }] }] },
          2.0,
          0
        ],
        "color": [
          { "expr": "mix", "args": [0, 1, { "expr": "smoothstep", "args": [3, 3.5, "time"] }] },
          { "expr": "mix", "args": [1, 0, { "expr": "smoothstep", "args": [3, 4, "time"] }] },
          { "expr": "mix", "args": [0.5, 0, { "expr": "smoothstep", "args": [3, 4, "time"] }] },
          1
        ],
        "scale": { "expr": "mix", "args": [1, 0, { "expr": "smoothstep", "args": [3.5, 4.5, "time"] }] }
      }
    },
    {
      "template": "cobra",
      "id": "cobra_0",
      "animation": {
        "type": "expression",
        "translate": [
          { "expr": "mul", "args": [3, { "expr": "sin", "args": [{ "expr": "mul", "args": ["time", 0.4] }] }] },
          { "expr": "add", "args": [0.5, { "expr": "mul", "args": [1.8, { "expr": "sin", "args": [{ "expr": "mul", "args": ["time", 0.3] }] }] }] },
          { "expr": "add", "args": [2.5, { "expr": "mul", "args": [1.5, { "expr": "cos", "args": [{ "expr": "mul", "args": ["time", 0.25] }] }] }] }
        ],
        "rotate": [
          { "expr": "mul", "args": [-20, { "expr": "cos", "args": [{ "expr": "mul", "args": ["time", 0.3] }] }] },
          { "expr": "add", "args": [180, { "expr": "mul", "args": [30, { "expr": "sin", "args": [{ "expr": "mul", "args": ["time", 0.4] }] }] }] },
          { "expr": "mul", "args": [25, { "expr": "sin", "args": [{ "expr": "mul", "args": ["time", 0.4] }] }] }
        ]
      }
    }
  ],
  "dynamicObjects": [
    {
      "type": "sdf",
      "id": "laser",
      "description": "Laser beam - kept as SDF for real-time animation",
      "sdfRef": "laserBeam"
    }
  ]
}
```

### 3.3 Template PLY Format

Standard 3DGS PLY with additional properties:

```ply
ply
format binary_little_endian 1.0
element vertex 487
property float x
property float y
property float z
property float nx
property float ny
property float nz
property float f_dc_0        # Spherical harmonics (color)
property float f_dc_1
property float f_dc_2
property float opacity
property float scale_0       # Anisotropic scale
property float scale_1
property float scale_2
property float rot_0         # Rotation quaternion
property float rot_1
property float rot_2
property float rot_3
end_header
<binary data>
```

---

## 4. Rendering Pipeline

### 4.1 WebGL2 Implementation

```
Per Frame:
┌────────────────────────────────────────────────────────────┐
│ 1. Update Instance Transforms                               │
│    - Evaluate animation expressions with current time       │
│    - Build instance transform matrices                      │
│    - Upload to GPU uniform buffer / texture                 │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│ 2. Sort Splats (view-dependent)                            │
│    - For each template: transform splat centers by         │
│      instance transforms                                    │
│    - Global depth sort across all instances                 │
│    - Output: sorted index buffer                            │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│ 3. Render Splats                                            │
│    - Vertex shader: apply instance transform to splat       │
│    - Fragment shader: Gaussian falloff + color blending     │
│    - Back-to-front alpha blending                           │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│ 4. Render Dynamic SDF Objects (optional)                    │
│    - Ray march laser beam, hit effects, etc.                │
│    - Composite with splat render                            │
└────────────────────────────────────────────────────────────┘
```

### 4.2 Vertex Shader (Instanced)

```glsl
#version 300 es

// Per-splat attributes (from template PLY)
in vec3 a_position;
in vec3 a_scale;
in vec4 a_rotation;  // quaternion
in vec3 a_color;
in float a_opacity;

// Per-instance (from uniform buffer or texture)
uniform sampler2D u_instanceTransforms;  // 4x4 matrices packed
uniform int u_instanceCount;

// Instance ID passed via instanced rendering
flat out int v_instanceId;
out vec3 v_color;
out float v_opacity;
out vec2 v_uv;

uniform mat4 u_viewProj;
uniform vec2 u_viewport;

// Decode instance transform from texture
mat4 getInstanceTransform(int instanceId) {
    int texWidth = textureSize(u_instanceTransforms, 0).x;
    int row = instanceId * 4;  // 4 texels per matrix
    vec4 r0 = texelFetch(u_instanceTransforms, ivec2(row % texWidth, row / texWidth), 0);
    vec4 r1 = texelFetch(u_instanceTransforms, ivec2((row+1) % texWidth, (row+1) / texWidth), 0);
    vec4 r2 = texelFetch(u_instanceTransforms, ivec2((row+2) % texWidth, (row+2) / texWidth), 0);
    vec4 r3 = texelFetch(u_instanceTransforms, ivec2((row+3) % texWidth, (row+3) / texWidth), 0);
    return mat4(r0, r1, r2, r3);
}

void main() {
    v_instanceId = gl_InstanceID;
    mat4 instanceTransform = getInstanceTransform(gl_InstanceID);

    // Transform splat position by instance matrix
    vec4 worldPos = instanceTransform * vec4(a_position, 1.0);

    // Project to screen and compute splat quad size
    vec4 clipPos = u_viewProj * worldPos;

    // Scale splat based on distance and covariance
    // ... (standard 3DGS projection math)

    v_color = a_color;
    v_opacity = a_opacity;
    gl_Position = clipPos;
}
```

### 4.3 Sorting Strategy

For instanced splats, sorting is more complex:

**Option A: Per-instance sorting** (simpler, may have artifacts at instance boundaries)
- Sort splats within each template
- Sort instances by centroid depth
- Render instances back-to-front

**Option B: Global sorting** (correct, more expensive)
- Expand all instance transforms
- Sort all splats globally by transformed depth
- Use indirect draw calls

**Option C: OIT (Order-Independent Transparency)**
- Use weighted blended OIT
- No sorting required
- May have quality tradeoffs

**Recommendation**: Start with Option A, upgrade to B if artifacts are visible.

---

## 5. API

### 5.1 JavaScript API

```javascript
// Loading
const bundle = await InstancedSplats.load('scene.isplat');

// Renderer setup
const renderer = new InstancedSplatRenderer(canvas, {
  quality: 'high',      // 'low', 'medium', 'high'
  sortMode: 'perInstance',  // 'perInstance', 'global', 'oit'
  maxInstances: 1000
});

renderer.setBundle(bundle);

// Animation loop
function animate(time) {
  renderer.setTime(time);  // Updates animated transforms
  renderer.render(camera);
  requestAnimationFrame(animate);
}

// Dynamic instance manipulation
renderer.setInstanceTransform('invader_0', {
  translate: [x, y, z],
  rotate: [rx, ry, rz],
  scale: [s, s, s]
});

renderer.setInstanceVisible('invader_0', false);  // Hide (hit/destroyed)
renderer.setInstanceColor('invader_0', [1, 0, 0, 1]);  // Tint red

// Export flattened splats (for standard viewers)
const flattenedPly = bundle.flatten();
```

### 5.2 Integration with Lucid

```javascript
// In lucid/index.html - add export button
async function exportToSplats(scene) {
  const extractor = new SplatTemplateExtractor(scene);
  const templates = extractor.extractTemplates();
  const instances = extractor.extractInstances();

  // Sample each template SDF to point cloud
  for (const [id, templateScene] of templates) {
    const pointCloud = await sampleSDF(templateScene, {
      resolution: 128,
      threshold: 0.001
    });

    // Train 3DGS (could use external tool or WebGPU implementation)
    const splats = await train3DGS(pointCloud, {
      iterations: 7000,
      splatCount: 2000
    });

    templates.set(id, splats);
  }

  // Build and download bundle
  const bundle = new InstancedSplatBundle(templates, instances);
  bundle.download('scene.isplat');
}
```

---

## 6. Implementation Phases

### Phase 1: Proof of Concept
- [ ] Manual template baking (external tool)
- [ ] Simple manifest format (no animation)
- [ ] Basic instanced renderer (per-instance sorting)
- [ ] Static flower meadow demo

### Phase 2: Animation Support
- [ ] Expression evaluation in manifest
- [ ] Per-frame transform updates
- [ ] Animated cobra demo

### Phase 3: Full Integration
- [ ] Automatic template extraction from Lucid scenes
- [ ] SDF sampling pipeline
- [ ] In-browser 3DGS training (WebGPU)
- [ ] Hybrid SDF/splat rendering for dynamic objects

### Phase 4: Optimization
- [ ] Global sorting with indirect draw
- [ ] LOD based on instance distance
- [ ] Streaming for large scenes
- [ ] Compression (quantized splats)

---

## 7. Open Questions

1. **Training**: In-browser 3DGS training feasible? Or require external tool?
2. **Hybrid rendering**: Best approach for mixing splats + live SDF?
3. **Color modulation**: Per-instance color tinting - multiply or replace?
4. **Scale limits**: Max practical instance count for 60fps?
5. **Sorting**: Is per-instance sorting visually acceptable?

---

## 8. References

- [3D Gaussian Splatting Paper](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)
- [WebGL Gaussian Splat Viewer](https://github.com/antimatter15/splat)
- [gsplat.js](https://github.com/huggingface/gsplat.js)
- [Lucid SDF System](../README.html)
