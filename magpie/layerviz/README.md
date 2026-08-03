# LayerViz

A 3D view of multi-layer knowledge graphs. Graphs stack as horizontal
planes; green vertical links connect entities that occur in more than
one layer; tap a legend entry to spotlight a layer. **WebGPU-first**:
both pages boot the raw-WGSL backend and fall back to three.js/WebGL
when no adapter is available (a badge/status line names the active
backend). Everything lives here — the old root `layerviz/` folder holds
only redirect stubs.

## Pages

- `index.html` — the demo graph (semantic-web stack, hardcoded spec).
- `rdf.html` — layers built at runtime from REAL RDF: timbl's FOAF card
  plus a FOAF vocabulary excerpt (`data/`), parsed and SPARQL-queried
  in-browser by [factoidal](https://github.com/danbri/factoidal)
  (vendored at `third_party/data/`, see its PROVENANCE.md). Each visual
  layer is a named graph (`urn:layer:*`); the panel has a SPARQL box
  over those graphs (Ctrl+Enter runs), and a "Compute closure" button
  (RDFS / OWL-RL) that mounts implied-triples ghost sublayers and adds
  graph `urn:layer:implied`.
- `prototype1.html` — the original prototype, kept verbatim (CDN three
  r128). Reference only.

## Architecture

- `layerviz.js` — renderer-neutral core: graph spec format, model
  builder, controller (orbit camera with 1:1 drag + pinch/wheel zoom +
  inertia, labels with overlap culling, tooltip, tap-to-inspect,
  `focusLayer` spotlight). Imports no rendering library; talks to
  renderers only through the RendererAdapter contract documented at the
  top of the file. Optional adapter methods: `setLayerFocus(layerId)`,
  `setProjection({mode, fovDeg|halfHeight})`.
- **Plan-view snap**: tilt near top-down and the camera eases to
  straight down while the projection cross-fades to ORTHOGRAPHIC
  (dolly-zoom, then a true ortho switch), so distance no longer changes
  size — a map view. Tilt away to release; hysteresis prevents
  flicker (`config.planSnap`). In plan view a pick returns the TOPMOST
  node of a stack — combine with the layer spotlight for per-layer
  maps. Fog scales with camera distance so the dolly recession never
  fogs the scene out.
- `layerviz-webgpu.js` — the PRIMARY backend. Raw WGSL, instanced (6
  draw calls/frame), CPU picking/projection, 4x MSAA, dpr-capped
  surface, per-instance-opacity layer spotlight. Sync factory over
  async GPU setup; `ready` promise for fallback decisions;
  `debugReadPixels()` test hook. Headless caveat: pipelines validate
  and frames submit under swiftshader flags, but headless Dawn never
  presents pixels — visual verification needs a real WebGPU browser.
- `layerviz-three.js` — the fallback backend (three.js r169 via import
  map to `../../trees/vendor/three.module.min.js`, no CDN).
- `panel.js` — draggable overlay panels (drag header to move, tap to
  minimise), shared by both pages.
- `notes/` — engine findings, including a retraction worth re-reading
  before reporting "unsound inference" bugs (full-IRI lesson).

## Using factoidal here

```js
const { query } = await import('./third_party/data/browser.js');
const r = await query(turtleText, sparql, {
  dataFormat: 'turtle',
  baseIRI: 'https://…'   // REQUIRED if data has relative IRIs — without
                         // it those statements are dropped silently
});
r.results.bindings       // SPARQL-JSON
```

Known engine quirks (build 2026-07-21, `e3f9e2f8`): `FILTER [NOT]
EXISTS` returns empty results (use `MINUS` or JS filtering); OWL-RL
bindings surface internal `__rl_*` comprehension-witness classes —
filter them on FULL IRIs before any display shortening; the npm
README's sync quickstart is stale (API is async). When the fresh npm
build lands, re-vendor `third_party/data/` and re-test these.

## Use with your own data

```js
import { LayerViz } from './layerviz.js';
import { createWebGPURenderer } from './layerviz-webgpu.js';

const viz = new LayerViz({
  container: document.getElementById('canvas-container'),
  createRenderer: createWebGPURenderer,
  spec: { layers: [...], sharedEntities: [...] }   // see layerviz.js
});
```

Public controls: `toggleAnimation()`, `toggleLabels()`,
`resetCamera()`, `focusLayer(id)`, `dispose()`.
