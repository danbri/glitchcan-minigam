# SDF Engine Project Specification

## 1. Project Purpose
You are building a fully programmable SDF engine supporting:
- Text DSL → IR → GLSL codegen
- Interactive rendering
- Composable render layers
- Procedural modeling (dragons, characters, environments)
- Future node-graph editor
- WebGPU-ready pipeline
- Mobile-friendly editing & rendering
- Integration with other media (Gaussian splats, video layers)

## 2. Current Capabilities
### 2.1 Renderer
- Unified raymarcher with multiple modes
- Compositing layer
- Orbit camera
- Edge detection
- Pause/offscreen auto-pause
- DSL args reflected in UI

### 2.2 DSL
- Supports spheres, boxes, capsules, etc.
- union, subtract, smoothUnion
- offset, rot, rotq transforms
- color, animated parameters
- param aliasing
- compositing
- example library

### 2.3 Shadow Parser
- AST-only
- Defensive, reversible
- Logs to Debug tab
- Safe migration path

## 3. Future Goals
- Rigged SDF dragons
- Reusable parts (limb, wing, claw)
- Symmetry operators
- Hierarchy (joints)
- Procedural motion
- Parameter inheritance
- Compositing with external media

## 4. Next Steps
### 4.1 Stabilise foundation
- Improve DSL parsing
- Better error reporting
- FPS control

### 4.2 DSL Features
- DSL functions
- Grouping transforms
- Mirroring
- Attach-to-parent

### 4.3 Rendering Improvements
- Material model
- Multiple raymarch modes

### 4.4 External Integration
- Depth compositing
- Gaussian splats

### 4.5 Node Graph Editor
- Read-only first
- Then round-trip

## 5. Design Choices
- DSL is source of truth
- Node graph secondary
- Renderer WebGPU-ready
- Defensive migration

## 6. Use Cases
- Procedural toys
- Visual debugging
- Creature building
- Media compositing
- Full procedural dragon

## 7. Recommended Next Steps
1. Shadow parser Phase 2
2. DSL functions
3. IR group nodes
4. Material model
5. Composite layers
6. Dragon prototype
