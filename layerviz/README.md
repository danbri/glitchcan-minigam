# LayerViz

A 3D view of a multi-layer knowledge graph. Graphs stack as horizontal
planes. Green vertical links connect entities that occur in more than one
layer.

## Files

- `prototype1.html` — the original prototype, kept as-is. It uses a CDN
  copy of three.js r128. It is a reference, not the maintained version.
- `index.html` — the maintained page. It uses only local code.
- `layerviz.js` — the core library. It holds the graph spec format, the
  model builder, and the `LayerViz` controller (input, camera, labels,
  tooltip, main loop). It imports no rendering library.
- `layerviz-three.js` — the three.js renderer adapter. It imports `three`
  as a bare specifier. The page maps `three` to the repo's vendored module
  at `../trees/vendor/three.module.min.js` with an import map. No CDN.

## Architecture: made for a later port

All rendering goes through the RendererAdapter contract, documented at the
top of `layerviz.js`:

    createRenderer({ container, model, config }) => {
      resize, setView, animate, render,
      projectNode, pick, setHighlight, dispose
    }

The core passes only plain data across this boundary: model node records,
`{x,y,z}` positions, and CSS pixel coordinates. No three.js type crosses
it. To port to a different backend (Z*), write one new adapter module that
satisfies the contract and pass its factory to `new LayerViz({...})`.
`layerviz.js` and the graph data do not change.

## Use with your own data

```js
import { LayerViz } from './layerviz.js';
import { createThreeRenderer } from './layerviz-three.js';

const viz = new LayerViz({
  container: document.getElementById('canvas-container'),
  createRenderer: createThreeRenderer,
  spec: {
    layers: [
      { id: 'a', label: 'Layer A', color: 0xffd700, height: 0,
        nodes: [{ id: 'n1', label: 'Node 1', x: 0, z: 0, type: 'thing' }],
        edges: [] }
    ],
    sharedEntities: []
  }
});
```

`viz.toggleAnimation()`, `viz.toggleLabels()`, `viz.resetCamera()`, and
`viz.dispose()` are the public controls.

## Backends

- three.js/WebGL: `layerviz-three.js` (here), used by `index.html`.
- WebGPU: `magpie/layerviz/layerviz-webgpu.js` (raw WGSL, instanced),
  used by `magpie/layerviz/index.html` with automatic WebGL fallback.
  Both implement the same RendererAdapter contract against this core.
