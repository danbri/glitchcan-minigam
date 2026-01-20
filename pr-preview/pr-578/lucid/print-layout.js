/**
 * PrintLayoutEngine - A4 SVG export with Sugiyama layered layout
 *
 * Usage:
 *   import { PrintLayoutEngine } from './print-layout.js';
 *   const engine = new PrintLayoutEngine(graph, NODE_SCHEMAS);
 *   engine.print();
 */

export class PrintLayoutEngine {
  constructor(graph, nodeSchemas) {
    this.graph = graph;
    this.nodeSchemas = nodeSchemas;
    this.A4_WIDTH = 794;
    this.A4_HEIGHT = 1123;
    this.MARGIN = 40;
    this.NODE_WIDTH = 140;
    this.NODE_HEIGHT = 60;
    this.LAYER_SPACING = 180;
    this.NODE_SPACING = 20;
  }

  computeLayout() {
    if (this.graph.nodes.length === 0) {
      return { layers: [], edges: [] };
    }
    const layers = this.assignLayers();
    this.minimizeCrossings(layers);
    const positioned = this.calculatePositions(layers);
    const edges = this.prepareEdges(positioned);
    return { layers: positioned, edges };
  }

  assignLayers() {
    const nodeMap = new Map(this.graph.nodes.map(n => [n.id, n]));
    const layerMap = new Map();
    const visited = new Set();

    const incoming = new Map();
    for (const n of this.graph.nodes) {
      incoming.set(n.id, []);
    }
    for (const conn of this.graph.connections) {
      if (!incoming.has(conn.to)) incoming.set(conn.to, []);
      incoming.get(conn.to).push(conn.from);
    }

    const assignLayer = (nodeId) => {
      if (visited.has(nodeId)) return layerMap.get(nodeId);
      visited.add(nodeId);
      const deps = incoming.get(nodeId) || [];
      let maxDepth = 0;
      for (const depId of deps) {
        maxDepth = Math.max(maxDepth, assignLayer(depId) + 1);
      }
      layerMap.set(nodeId, maxDepth);
      return maxDepth;
    };

    for (const node of this.graph.nodes) {
      assignLayer(node.id);
    }

    const maxLayer = Math.max(...Array.from(layerMap.values()), 0);
    const layers = Array.from({ length: maxLayer + 1 }, () => []);
    for (const [nodeId, layer] of layerMap) {
      const node = nodeMap.get(nodeId);
      if (node) layers[layer].push(node);
    }
    return layers;
  }

  minimizeCrossings(layers, iterations = 4) {
    const getConnections = (nodeId, direction) => {
      if (direction === 'in') {
        return this.graph.connections.filter(c => c.to === nodeId).map(c => c.from);
      } else {
        return this.graph.connections.filter(c => c.from === nodeId).map(c => c.to);
      }
    };

    const getBarycenter = (node, refLayer, direction) => {
      const conns = getConnections(node.id, direction);
      if (conns.length === 0) return refLayer.indexOf(node);
      let sum = 0;
      for (const connId of conns) {
        const idx = refLayer.findIndex(n => n.id === connId);
        if (idx !== -1) sum += idx;
      }
      return sum / conns.length;
    };

    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 1; i < layers.length; i++) {
        const prevLayer = layers[i - 1];
        layers[i].sort((a, b) => getBarycenter(a, prevLayer, 'in') - getBarycenter(b, prevLayer, 'in'));
      }
      for (let i = layers.length - 2; i >= 0; i--) {
        const nextLayer = layers[i + 1];
        layers[i].sort((a, b) => getBarycenter(a, nextLayer, 'out') - getBarycenter(b, nextLayer, 'out'));
      }
    }
    return layers;
  }

  calculatePositions(layers) {
    const positioned = [];
    const contentWidth = this.A4_WIDTH - 2 * this.MARGIN;
    layers.forEach((layer, layerIdx) => {
      const layerNodes = [];
      const totalWidth = layer.length * this.NODE_WIDTH + (layer.length - 1) * this.NODE_SPACING;
      const startX = this.MARGIN + (contentWidth - totalWidth) / 2;
      const y = this.MARGIN + 80 + layerIdx * this.LAYER_SPACING;
      layer.forEach((node, nodeIdx) => {
        const x = startX + nodeIdx * (this.NODE_WIDTH + this.NODE_SPACING);
        layerNodes.push({ ...node, px: x, py: y });
      });
      positioned.push(layerNodes);
    });
    return positioned;
  }

  prepareEdges(layers) {
    const nodeMap = new Map();
    layers.flat().forEach(n => nodeMap.set(n.id, n));
    const edges = [];
    for (const conn of this.graph.connections) {
      const from = nodeMap.get(conn.from);
      const to = nodeMap.get(conn.to);
      if (!from || !to) continue;
      const fromX = from.px + this.NODE_WIDTH;
      const fromY = from.py + this.NODE_HEIGHT / 2;
      const toX = to.px;
      const toY = to.py + this.NODE_HEIGHT / 2;
      const dx = (toX - fromX) * 0.5;
      edges.push({
        from: conn.from,
        to: conn.to,
        path: `M ${fromX} ${fromY} C ${fromX + dx} ${fromY}, ${toX - dx} ${toY}, ${toX} ${toY}`,
      });
    }
    return edges;
  }

  generateSVG(layout) {
    const { layers, edges } = layout;
    const allNodes = layers.flat();
    if (allNodes.length === 0) return this.generateEmptySVG();

    const title = 'Lucid Node Graph';
    const date = new Date().toISOString().split('T')[0];

    const styles = `
    .bg { fill: white; }
    .grid-line { stroke: #e0e0e0; stroke-width: 0.5; }
    .node-shadow { fill: rgba(0,0,0,0.1); }
    .node-body { fill: #f8f9fa; stroke: #333; stroke-width: 1.5; }
    .node-title { fill: white; font-family: system-ui, sans-serif; font-size: 12px; font-weight: 600; }
    .node-params { fill: #666; font-family: system-ui, sans-serif; font-size: 9px; }
    .socket { fill: white; stroke: #58a6ff; stroke-width: 2; }
    .edge { stroke: #58a6ff; stroke-width: 2; fill: none; }
    .header-title { font-family: system-ui, sans-serif; font-size: 20px; font-weight: 700; fill: #333; }
    .header-date { font-family: system-ui, sans-serif; font-size: 11px; fill: #666; }
    .layer-label { font-family: system-ui, sans-serif; font-size: 10px; fill: #999; }
    .legend-title { font-family: system-ui, sans-serif; font-size: 10px; font-weight: 600; fill: #333; }
    .legend-text { font-family: system-ui, sans-serif; font-size: 9px; fill: #666; }`;

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${this.A4_WIDTH}" height="${this.A4_HEIGHT}" viewBox="0 0 ${this.A4_WIDTH} ${this.A4_HEIGHT}">
  <defs><style>${styles}</style></defs>
  <rect class="bg" width="${this.A4_WIDTH}" height="${this.A4_HEIGHT}"/>
  ${this.generateGrid()}
  <text class="header-title" x="${this.A4_WIDTH / 2}" y="35" text-anchor="middle">${title}</text>
  <text class="header-date" x="${this.A4_WIDTH / 2}" y="52" text-anchor="middle">${date}</text>
  ${layers.map((layer, idx) => layer.length ? `<text class="layer-label" x="${this.MARGIN}" y="${layer[0].py - 15}">Layer ${idx}</text>` : '').join('\n  ')}
  ${edges.map(e => `<path class="edge" d="${e.path}"/>`).join('\n  ')}
  ${allNodes.map(n => this.generateNodeSVG(n)).join('\n  ')}
  ${this.generateLegend()}
</svg>`;
    return svg;
  }

  generateGrid() {
    const lines = [];
    for (let x = this.MARGIN; x <= this.A4_WIDTH - this.MARGIN; x += 40) {
      lines.push(`<line class="grid-line" x1="${x}" y1="${this.MARGIN}" x2="${x}" y2="${this.A4_HEIGHT - this.MARGIN}"/>`);
    }
    for (let y = this.MARGIN; y <= this.A4_HEIGHT - this.MARGIN; y += 40) {
      lines.push(`<line class="grid-line" x1="${this.MARGIN}" y1="${y}" x2="${this.A4_WIDTH - this.MARGIN}" y2="${y}"/>`);
    }
    return lines.join('\n  ');
  }

  generateNodeSVG(node) {
    const schema = this.nodeSchemas[node.type];
    if (!schema) return '';
    const { px: x, py: y } = node;
    const w = this.NODE_WIDTH, h = this.NODE_HEIGHT;
    const colorMap = { '#58a6ff': '#4A90E2', '#f0883e': '#E67E22', '#a371f7': '#9B59B6', '#6e7681': '#95a5a6' };
    const headerColor = colorMap[schema.color] || schema.color;
    const params = Object.entries(node.params || {}).map(([k, v]) => `${k}=${Array.isArray(v) ? '[...]' : v}`).join(' ').slice(0, 30);

    let svg = `<g class="node" data-id="${node.id}">
    <rect class="node-shadow" x="${x + 3}" y="${y + 3}" width="${w}" height="${h}" rx="6"/>
    <rect class="node-body" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>
    <rect x="${x}" y="${y}" width="${w}" height="22" rx="6" fill="${headerColor}"/>
    <text class="node-title" x="${x + 8}" y="${y + 15}">${node.type}</text>
    <text class="node-params" x="${x + 8}" y="${y + 40}">${params}</text>`;

    for (let i = 0; i < (schema.ins || 0); i++) {
      svg += `\n    <circle class="socket" cx="${x}" cy="${y + 30 + i * 15}" r="4"/>`;
    }
    if (schema.outs) {
      svg += `\n    <circle class="socket" cx="${x + w}" cy="${y + 30}" r="4"/>`;
    }
    return svg + '\n  </g>';
  }

  generateLegend() {
    const x = this.A4_WIDTH - this.MARGIN - 150;
    const y = this.A4_HEIGHT - this.MARGIN - 100;
    return `<g class="legend">
    <text class="legend-title" x="${x}" y="${y}">Node Types:</text>
    <circle cx="${x + 5}" cy="${y + 15}" r="4" fill="#4A90E2"/><text class="legend-text" x="${x + 15}" y="${y + 18}">Primitives</text>
    <circle cx="${x + 5}" cy="${y + 30}" r="4" fill="#E67E22"/><text class="legend-text" x="${x + 15}" y="${y + 33}">CSG Operations</text>
    <circle cx="${x + 5}" cy="${y + 45}" r="4" fill="#9B59B6"/><text class="legend-text" x="${x + 15}" y="${y + 48}">Modifiers</text>
    <text class="legend-title" x="${x}" y="${y + 70}">Layout Info:</text>
    <text class="legend-text" x="${x}" y="${y + 83}">Nodes: ${this.graph.nodes.length}</text>
    <text class="legend-text" x="${x}" y="${y + 95}">Connections: ${this.graph.connections.length}</text>
  </g>`;
  }

  generateEmptySVG() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${this.A4_WIDTH}" height="${this.A4_HEIGHT}">
  <rect fill="white" width="${this.A4_WIDTH}" height="${this.A4_HEIGHT}"/>
  <text x="${this.A4_WIDTH / 2}" y="${this.A4_HEIGHT / 2}" text-anchor="middle" font-family="system-ui" font-size="16" fill="#666">No nodes to print</text>
</svg>`;
  }

  print() {
    console.log('Computing print layout...');
    const layout = this.computeLayout();
    console.log(`Layout: ${layout.layers.length} layers, ${layout.edges.length} edges`);
    const svg = this.generateSVG(layout);
    this.openPrintWindow(svg);
  }

  openPrintWindow(svgContent) {
    const w = window.open('', '_blank', 'width=900,height=1200');
    if (!w) {
      alert('Please allow popups');
      return;
    }

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Lucid Node Graph</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui; background: #f0f0f0; display: flex; flex-direction: column; align-items: center; padding: 20px; }
.toolbar { position: fixed; top: 20px; right: 20px; display: flex; gap: 10px; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
button { padding: 8px 16px; background: #4A90E2; color: white; border: none; border-radius: 4px; cursor: pointer; }
button:hover { background: #357ABD; }
button.secondary { background: #95a5a6; }
.container { background: white; box-shadow: 0 2px 16px rgba(0,0,0,0.1); margin-top: 70px; }
svg { display: block; max-width: 100%; height: auto; }
@media print { body { background: white; padding: 0; } .toolbar { display: none; } .container { box-shadow: none; margin: 0; } }
</style></head><body>
<div class="toolbar">
  <button onclick="window.print()">Print</button>
  <button class="secondary" onclick="saveSVG()">Save SVG</button>
  <button class="secondary" onclick="window.close()">Close</button>
</div>
<div class="container">${svgContent}</div>
<script>
function saveSVG() {
  var svg = document.querySelector('svg').outerHTML;
  var blob = new Blob([svg], {type: 'image/svg+xml'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'node-graph.svg';
  a.click();
}
</script>
</body></html>`;

    w.document.write(html);
    w.document.close();
  }
}
