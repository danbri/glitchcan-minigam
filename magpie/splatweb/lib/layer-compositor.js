// layer-compositor.js — a minimal node-edge dataflow graph for combining
// heterogeneous visual layers (a splat renderer, a webcam feed, a
// raymarched SDF pass, a three.js scene, a video/image file) into one
// image per frame.
//
// The graph doesn't know what any node IS. Every node — source or
// combinator — exposes exactly one method:
//
//   render(time, inputs) -> CanvasImageSource
//
// `time` is seconds. `inputs` is a {portName: CanvasImageSource} map built
// from this node's incoming edges (empty for source nodes). A
// CanvasImageSource is anything drawImage() accepts: a <canvas>, <video>,
// <img>, or ImageBitmap — that's the "wire format" every layer speaks,
// regardless of whether it's WebGPU, WebGL2, Canvas2D, or a plain media
// element underneath. That's what makes this genuinely reusable: a future
// layer type (a mesh baked by PlayCanvas, a Lucid SDF scene, a recorded
// clip) only needs to satisfy that one contract to slot into the graph
// next to everything already here — see lib/layers.js and
// lib/three-layer.js for the concrete node types.
//
// This module only supplies the GRAPH (CompositorGraph) and one generic
// combinator (BlendNode). It has zero knowledge of splats, WebGPU, or
// three.js.

export class CompositorGraph {
  constructor() {
    this.nodes = new Map();       // id -> node
    this.incoming = new Map();    // id -> [{from, port}]
    this.outputId = null;
  }

  addNode(id, node) {
    this.nodes.set(id, node);
    this.incoming.set(id, []);
    return this;
  }

  removeNode(id) {
    this.nodes.delete(id);
    this.incoming.delete(id);
    for (const edges of this.incoming.values()) {
      for (let i = edges.length - 1; i >= 0; i--) if (edges[i].from === id) edges.splice(i, 1);
    }
    if (this.outputId === id) this.outputId = null;
    return this;
  }

  // toId's `inputs[port]` will be fromId's output for this tick.
  connect(fromId, toId, port = 'a') {
    this.incoming.get(toId).push({ from: fromId, port });
    return this;
  }

  setOutput(id) { this.outputId = id; return this; }

  // Depth-first topological order. Recomputed every run() — the graphs
  // this is built for have a handful of nodes, so re-deriving the order
  // each frame (rather than caching + invalidating on every edit) is both
  // simpler and cheap enough not to matter.
  _order() {
    const visited = new Set(), order = [];
    const visit = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      for (const e of this.incoming.get(id) || []) visit(e.from);
      order.push(id);
    };
    for (const id of this.nodes.keys()) visit(id);
    return order;
  }

  // Renders every node once, in dependency order, and returns the output
  // node's frame. A node feeding two downstream consumers is still only
  // rendered once per tick (its frame is cached in `frames` for the tick).
  run(time) {
    const frames = new Map();
    for (const id of this._order()) {
      const node = this.nodes.get(id);
      const inputs = {};
      for (const e of this.incoming.get(id)) inputs[e.port] = frames.get(e.from);
      frames.set(id, node.render(time, inputs));
    }
    return this.outputId ? frames.get(this.outputId) : null;
  }
}

// 2D-canvas blend modes, keyed by the same short names used elsewhere in
// this project's UI. `globalCompositeOperation` is the browser's own
// blending, so this works regardless of whether input 'a'/'b' came from
// WebGPU, WebGL2, a <video>, or a still image — drawImage() erases that
// distinction. A node that needed GPU-side blending (e.g. to avoid the
// readback-to-2D-canvas cost at very large resolutions) could implement
// the same render(time, inputs) contract with a WebGL pass instead; this
// one is the simple, always-available baseline.
export const BLEND_MODES = { over: 'source-over', add: 'lighter', multiply: 'multiply', screen: 'screen' };

// Composites input 'b' over input 'a' using the given blend mode/opacity.
// Two inputs is deliberately the whole contract — chain BlendNodes for
// more than two layers (see demo-compositor.html) rather than growing
// this into an N-input node; the graph is where fan-in belongs.
export class BlendNode {
  constructor({ width, height, mode = 'over', opacity = 1 } = {}) {
    this.mode = mode;
    this.opacity = opacity;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { alpha: true });
  }

  render(time, inputs) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (inputs.a) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(inputs.a, 0, 0, canvas.width, canvas.height);
    }
    if (inputs.b) {
      ctx.globalCompositeOperation = BLEND_MODES[this.mode] || 'source-over';
      ctx.globalAlpha = this.opacity;
      ctx.drawImage(inputs.b, 0, 0, canvas.width, canvas.height);
    }
    return canvas;
  }
}

// Draws a frame onto a visible on-screen canvas — the terminal step after
// graph.run(time). Not itself a graph node (it has no output), just the
// one line every demo would otherwise repeat.
export function present(canvas, frame) {
  if (!frame) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
}
