# Dreams SDF Implementation Notes

## Overview
Dreams recorded a series of add & subtraction using platonic shapes with simple distance field functions.

## Primitives (R to L order)
- **Cubic strokes**
- **Cylinders**
- **Cones**
- **Cuboids**
- **Ellipsoids**
- **Triangular prisms**
- **Donuts** (torus)
- **Biscuits**
- **Markoids*** (super ellipsoids with variable power for x,y,z)
- **Pyramids**

Each primitive was called an "edit".

## Architecture

### CSG Operations
- Simple **list** structure, NOT tree
- Models: 1 to 100,000 edits
- Operations:
  - **Add**
  - **Subtract**
  - **Color only**
  - **Soft blend** (soft-max and soft-min functions)

### Storage & Meshing
- **Compound SDF function** stored in 83³ fp16 volume texture blocks
- **Incrementally updated** as new edits arrived
- Each block **independently meshed** using marching cubes on compute shader

### Technical Implementation
- **Advanced compute shader usage** for the time
- Frequent compiler bugs/driver crashes encountered
- Main challenges: generating index buffers dynamically on GPU

### Histopyramids Technique
Stream compaction technique:
1. Count number of verts/indices each cell needs
2. Iteratively halve resolution building cumulative summed area tables
3. Push totals back up to full resolution
4. Gives each cell a lookup for where in target VB/IB its verts should go

**Reference:** Search online for "histopyramids" for more material

## Key Insights
- SDF list structure (not tree) with 100K+ edits
- Volume texture block storage
- Incremental updates
- GPU-driven mesh generation
- Stream compaction for efficient index buffer generation

---
*Excerpts from Dreams technical slides*
