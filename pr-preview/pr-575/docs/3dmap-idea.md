# 3D Map Visualization for Glitchiverse

**Status**: Design Document (Alpha)
**Location**: `/inklet/3map/index.html`
**Tech Stack**: Three.js + TSL (Three.js Shading Language), Graphviz.js/WASM

## Overview

A multilevel 3D visualization showing the structure of the FINK story universe. Primarily for the core gamedev team to track growth and understand inter-episode relationships.

## Core Concepts

### Chunks

A **Chunk** is a loaded FINK file, or a set of peered, bidirectionally-referencing FINK multiparts. Chunks are the atomic units of story content.

### Episodes

Each Chunk (or peer-set) forms a **plane** in 3D space - a rectangle representing an Episode. Episodes can:
- Live on the same Level as other Episodes in the same Series
- Exist as standalone oneoffs
- Connect to other Episodes via various link relations

### Levels

Vertical positioning in 3D represents depth/reality-distance:

| Level | Name | Description |
|-------|------|-------------|
| **0** | Founders | Never spoken of in-world except euphemistically, in legend, myth, gossip. Inaccessible. |
| **1** | Baseline | Conventional entry point. Most Chunks are `sameWorld` linked reciprocally. State sharing enabled. |
| **2+** | Depths | "Play within a play", "dream within a dream". Higher numbers = lower in viewer = deeper unreality. |

**The Depth Principle**: Things true above are true below, but we may not be able to access or change those truths. The further from baseline reality:
- The glitchier and weirder things get
- Sometimes sloppier, less coherent
- Evil and unknown may lurk in the depths

## Link Relations

Where a knot uses FINK markup to reference another Episode, annotations describe the relationship:

```ink
# FINK: other-episode.fink.js
# LINKREL: sameWorld
```

### Initial Link Relation Types

| Relation | Meaning |
|----------|---------|
| `sameWorld` | Reciprocal peer link, same Level, state sharing |
| `goDeeper` | Descend to higher-numbered Level |
| `goShallower` | Ascend to lower-numbered Level (rare, requires special conditions) |
| `unstable` | Bidirectional but risky - may have side effects |
| `oneWay` | No return path exists |

*Full set of relations and rules will evolve during Alpha dev phase.*

## Level 2 Layout (Current)

```
Level 2
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ┌─────────┐     ┌─────────┐     ┌─────────────────┐   │
│   │ Diamond │◄───►│ Diamond │     │ World Between   │   │
│   │ Zone A  │     │ Zone B  │     │ Worlds (WbW)    │   │
│   └─────────┘     └─────────┘     └─────────────────┘   │
│        │ unstable bidi │                  │             │
│        └───────────────┘                  │             │
│                                           │             │
│   ┌───────────────┐  ┌─────────┐  ┌───────────────┐     │
│   │   Hampstead   │  │ Mansion │  │   Mudslide    │     │
│   │  (inc demon)  │  │         │  │    Mines      │     │
│   └───────────────┘  └─────────┘  └───────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## The Diamond Zone Weirdness

Two linked (but not fully peered) Diamond Zones at Lv2 demonstrate instability:

1. If you explore them with **too many diamonds**
2. And use the **unstable bidi portal** between them
3. **Risk**: Getting mugged and catapulted near-penniless into a random slice of unreality

### Hampstead Entry Paths

| Entry Route | Experience |
|-------------|------------|
| Via WbW (World Between Worlds) | Standard Hampstead experience |
| Via Diamond Zone portal (risky) | Deeper slice of unreality, may exit with MORE megadiamonds |

The pathway affects what you see and what you can gain.

## Visualization Design

### Per-Plane Rendering

Each Episode plane displays:
- **Nodes**: Knots from the FINK file
- **Labeled Arcs**: Connections between knots (choices, diverts)
- **FINK Links**: Highlighted edges to other Episodes with linkRel annotations

Use Graphviz.js (WASM port) or similar for automatic node/arc layout.

### 3D Structure

```
        Level 0 (Founders - invisible, legendary)
        ════════════════════════════════════════
                         ▲
                         │ (never directly accessed)
                         │
        Level 1 (Baseline Reality)
        ┌────────────────────────────────────┐
        │  Main Entry Points                 │
        │  sameWorld reciprocal links        │
        │  State sharing enabled             │
        └────────────────────────────────────┘
                         │
                         │ goDeeper
                         ▼
        Level 2 (First Depth)
        ┌────────────────────────────────────┐
        │  WbW, Hampstead, Mansion, etc.     │
        │  Diamond Zones (unstable links)    │
        │  Glitchier, weirder                │
        └────────────────────────────────────┘
                         │
                         │ goDeeper
                         ▼
        Level 3+ (Deep Unreality)
        ┌────────────────────────────────────┐
        │  Unknown territories               │
        │  Evil may lurk                     │
        │  Sloppy reality fabric             │
        └────────────────────────────────────┘
```

### Camera Controls

- Orbit around the structure
- Zoom to specific Levels
- Click Episode plane to expand/focus
- Highlight link paths between Episodes

## Implementation Notes

### Tech Requirements

1. **Three.js** - 3D rendering
2. **TSL** (Three.js Shading Language) - Custom shaders for glitch effects at deeper levels
3. **Graphviz.js/WASM** - Automatic graph layout (e.g., `@viz-js/viz` or `hpcc-js/wasm`)
4. **FINK Parser** - Extract knots, choices, FINK tags from .fink.js files

### Data Flow

```
.fink.js files
     │
     ▼
Parse FINK content ──► Extract knots, links, tags
     │
     ▼
Build graph structure ──► Graphviz layout
     │
     ▼
Generate 3D planes ──► Three.js scene
     │
     ▼
Apply TSL shaders ──► Glitch effects by Level
```

### Glitch Shader Ideas (TSL)

- Level 1: Clean, stable rendering
- Level 2: Subtle chromatic aberration, slight wobble
- Level 3+: Noise displacement, color bleeding, reality tears

## Future Considerations

- Real-time updates as FINK files change
- Search/filter by Episode name, tag, variable
- "Play mode" - trace a path through the structure
- Export static images for documentation
- VR mode for immersive exploration

## File Structure

```
inklet/3map/
├── index.html          # Main viewer
├── js/
│   ├── fink-parser.js  # FINK content extraction
│   ├── graph-layout.js # Graphviz integration
│   ├── scene.js        # Three.js scene setup
│   └── shaders/        # TSL shader definitions
├── data/
│   └── universe.json   # Cached structure (optional)
└── styles.css          # UI styling
```

## References

- Three.js TSL: https://threejs.org/docs/#api/en/tsl/TSL
- Viz.js (Graphviz WASM): https://github.com/nicknisi/viz.js or @viz-js/viz
- FINK format: See `/glitchcanary.md`

---

*This document will evolve during Alpha development. Link relations, Level rules, and visualization features are subject to change based on gameplay and narrative needs.*
