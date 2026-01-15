# SDF game engine: architecture and implementation

*Cleaned transcript from Mike's YouTube video on his signed distance field game engine*

-----

## Introduction

I'm Mike, and I've been working on a game engine based on signed distance fields (SDFs). This video demonstrates what the engine can do and explains how it works. I've also started building a game with this engine.

My motivation was to build an engine that enables high-fidelity modifications to world geometry during gameplay. In most games, the world is relatively static. In games where geometry is dynamic, like Minecraft or No Man's Sky, modifications are usually crude and low-fidelity.

My engine supports detailed changes to world geometry–adding and removing matter, both smoothly or with sharp edges. It also supports non-destructive changes, like moving a hole around, creating a tunnel and walking through it, then watching it disappear behind you. These non-destructive changes enable interesting gameplay mechanics.

## Why SDFs?

SDFs are useful for many reasons, but a key advantage is that they enable very simple geometric boolean operations between shapes: union, subtraction, and intersection. These operations can also be smoothed, which creates nice-looking blends between shapes and removes hard edges.

The best sources for SDF techniques are Shader Toy and Inigo Quilez's website. SDFs on Shader Toy are typically rendered via ray marching. While ray marching is quick to start with and very powerful, brute-force ray marching degrades performance quickly because it evaluates a complex mathematical function many times per pixel.

This is how the rabbit hole started. I wanted to fully represent the game world using SDFs, have that world be dynamically modifiable, and maintain high performance. Achieving this goal is far more complex than typical ray marching methods.

## Inspiration: Dreams

My first inspiration was Dreams for PlayStation 4. The game world and all 3D objects in Dreams are represented via SDFs that can be sculpted in Dreams itself. Dreams is a phenomenal achievement in technology and design.

My aim isn't to rebuild Dreams–that would be impossible for a solo developer. Instead, I set out to build an engine based on SDFs where all world geometry is dynamically modifiable, which isn't possible in Dreams. This requires different technical constraints but provides different gameplay possibilities.

## Rendering architecture

### SDF edits

A scene in my engine is represented as an ordered list of "SDF edits"–a term borrowed from Dreams. An SDF edit is a shape with position, rotation, and scale that's applied to the world via a boolean operation like union or subtraction. For example: a sphere that cuts a chunk out of the world at a particular position.

### The basic problem

The distance function for a complex scene is expensive to evaluate, and standard SDF ray marching evaluates this function many times per pixel. Culling can reduce the number of SDF edits evaluated at a specific point, but this still hits a performance wall for complex scenes. It's easy to end up with dozens or more edits influencing a particular point in space.

### Distance caching on a grid

When repeatedly evaluating an expensive function, a typical optimization is caching. Rather than evaluating the scene's distance function from scratch repeatedly, I evaluate the function for all points on a grid once and reuse those cached values when rendering.

Consider a simple 2D scene where I'm smoothly blending the SDFs of a circle and a square. Regions with positive distance (outside the curve) are shaded orange; regions with negative distance (inside) are shaded blue. The curve itself is the white line where distance is zero.

By overlaying a grid on the scene and evaluating the distance function at each grid point, we can cache these values. The number of grid points is far lower than the number of screen pixels.

### Bilinear interpolation

To approximate the distance at any point:

1. Determine which cell the point is in
1. Gather the four distances at the grid points of that cell
1. Use bilinear interpolation between these distances

This calculation can be done with a single GPU texture fetch.

The reconstructed curve doesn't exactly match the original–it's relatively accurate when the curve is straight at grid-cell granularity, but inaccurate near corners. Increasing grid resolution improves accuracy.

This technique has been used in games for font glyph rendering for two decades, documented in a Valve paper from 2007. For text rendering, the SDF for each glyph is calculated and cached once since fonts don't change during gameplay.

### Why not triangle meshes?

One benefit of rendering from cached distances is that the reconstructed surface can be quite complex, allowing for lower grid resolution. An NVIDIA paper shows the types of 3D surfaces that can be reconstructed from trilinear interpolation of cached distances–these surfaces are curved and can have complex topology.

### Sparse distance caching with brick maps

Evaluating and storing a grid of cached distances is expensive for larger scenes. Even at coarse resolution, memory runs out quickly. Cached distances can be stored compactly as single bytes (limited to half the diagonal length of a grid cell). Even at one byte per value, a 3D grid of 1024^3 uses a gigabyte of memory.

The solution is caching distances sparsely. Since we're rendering the SDF surface, we only need distances in cells that contain the surface–specifically cells with grid points evaluating to both positive and negative distances.

For sparse grids, I chose brick maps over octrees because they work particularly well on the GPU. A brick map is a dense grid of pointers to bricks–small cubic regions of the original cached distance grid. Bricks are allocated from a large texture atlas. I use 8x8x8 bricks, inspired by Dreams.

With this brick size, the brick map pointer grid uses trivial space compared to the brick atlas.

### Level of detail with clip maps

Sparse brick allocation helps with memory but isn't sufficient for large scenes or open worlds. The solution is level of detail (LOD): geometry further from the player is represented at lower fidelity, making it cheaper to load and render.

I use an approach inspired by geometry clip maps. Instead of a single grid of brick pointers, a set of grids are nested where each successive grid is double the size in all dimensions. All clip map levels are centered on the player and follow their movement.

This naturally leads to evaluating the SDF at coarser resolution further from the player, ensuring on-screen brick size remains relatively constant regardless of distance.

In a scene with 2.5 km draw distance, at the resolution used near the player, over 200 trillion brick map cells would be needed for the full range. With the clip map, only 20 million cells are needed–a 10 million-fold reduction.

## Incremental updates

A main goal was enabling fast updates to world geometry during gameplay. The only way to achieve this with my architecture is to incrementally regenerate just the regions that change.

### Spatial tracking with BVH

All SDF edits are tracked spatially via a bounding volume hierarchy (BVH)–specifically a tree of axis-aligned bounding boxes. This data structure is shared between CPU and GPU.

The AABB tree is useful for raycasts, where only the SDF edits tested for exact intersections are highlighted as the ray sweeps across the scene. Querying the tree also identifies which SDF edits can affect a region of space, used both for evaluating the SDF efficiently and determining which distance bricks need re-evaluation when an edit changes.

The vast majority of the world is reused frame to frame even when things are changing. This approach isn't technically mathematically correct for reasons I won't detail here, but it works well enough for the types of interactions possible in my engine.

## Physics integration

I chose Jolt for physics, which is used in Horizon Forbidden West and Death Stranding 2. It's possible to do collision detection using the SDF directly, but it's not trivial and Jolt doesn't offer built-in support.

Instead, I generate a triangle mesh from the SDF that's fed into Jolt in chunks. I don't use this for rendering, but a mesh works well for physics at low resolution. I use marching cubes to generate the collision mesh because it's simple and easily parallelized.

While all SDF evaluation for rendering is done on the GPU, the collision mesh is generated across multiple CPU threads for low-latency updates to the physics system.

Any SDF edit can be made a dynamic physics body that collides realistically with the rest of the scene.

## Terrain generation

The terrain is generated using a sequence of SDF edits but is special-cased for efficiency. It's not a height field like many games use–it's fully 3D, generated progressively using octaves of noise with a technique inspired by Inigo Quilez.

All SDF edits interact properly with the terrain. The same algorithm with different parameters can generate substantially wilder landscapes.

## Capabilities demonstration

### Unbounded edits

Because the engine incrementally recomputes just the changed spatial region, it supports effectively unbounded SDF edits. Combined with the LOD system, this enables things like digging kilometers below the terrain surface.

### Non-destructive operations

All SDF edits are dynamic, meaning any change can be non-destructive. The "tunnel gun" is a capsule subtraction locked to the player's viewpoint–not just a visual effect, as the physics collision mesh also updates dynamically.

You can create a tunnel, walk through it, then remove it. Moving a hole around to capture objects or enemies is possible (inspired by Donut County).

### Material stamping

SDF edits can volumetrically stamp their material underground, allowing digging into ore deposits.

### Additive edits

Edits can be additive as well as subtractive–building walls out of cubes or drawing on surfaces.

### Modeling

While I didn't build the engine as an SDF modeling tool, the fidelity makes it possible.

## Debug visualizations

Debug visualizations are extremely useful for both debugging and building intuition about how systems work.

## Future work

I'm building a game with this engine. I have a fairly detailed plan but still a lot to figure out.
