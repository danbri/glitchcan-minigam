/**
 * layerviz.js — multi-layer knowledge-graph visualisation: core library.
 *
 * This module is renderer-neutral. It holds:
 *   - the graph specification format and the default demo graph
 *   - buildModel(): spec -> resolved geometry model (positions, edges, links)
 *   - LayerViz: the controller (view state, input, labels, tooltip, main loop)
 *
 * It never imports a rendering library. All drawing goes through the
 * RendererAdapter contract below. layerviz-three.js implements that contract
 * with three.js. To port to a different backend (Z*), implement the same
 * contract in a new module and pass its factory as `createRenderer` — this
 * file must not change.
 *
 * RendererAdapter contract
 * ------------------------
 * createRenderer({ container, model, config }) => adapter with:
 *   resize(width, height)             size the drawing surface in CSS pixels
 *   setView(view)                     view = { position:{x,y,z}, target:{x,y,z} }
 *   animate(timeMs, animating)        advance node bob + link pulse
 *   render()                          draw one frame with the current view
 *   projectNode(node) =>              current screen position of a node's
 *     { x, y, distance, inFront }     label anchor, in CSS pixels
 *   pick(clientX, clientY) => node    topmost node under the pointer, or null
 *   setHighlight(node | null)         emphasise one node, clear the rest
 *   dispose()                         release GPU resources, detach surface
 *
 * `node` values passed across the contract are always the model's node
 * records (plain objects), never renderer objects.
 */

/** Default demo graph: the semantic-web stack as four stacked graphs. */
export const DEFAULT_GRAPH = {
  layers: [
    {
      id: 'social',
      label: 'Social Graph - People & Organizations',
      color: 0xFFD700,
      height: 0,
      nodes: [
        { id: 'danbri', label: 'Dan Brickley', x: 0, z: 0, type: 'person' },
        { id: 'timbl', label: 'Tim Berners-Lee', x: -5, z: -3, type: 'person' },
        { id: 'w3c', label: 'W3C', x: 5, z: -3, type: 'organization' },
        { id: 'google', label: 'Google', x: 5, z: 3, type: 'organization' },
        { id: 'schema_org', label: 'Schema.org', x: 0, z: 5, type: 'organization' },
        { id: 'mozilla', label: 'Mozilla', x: -5, z: 3, type: 'organization' }
      ],
      edges: [
        ['danbri', 'w3c'],
        ['danbri', 'google'],
        ['danbri', 'schema_org'],
        ['timbl', 'w3c'],
        ['w3c', 'schema_org']
      ]
    },
    {
      id: 'technology',
      label: 'Technology Graph - Software & Standards',
      color: 0xFF6B6B,
      height: 5,
      nodes: [
        { id: 'rdf', label: 'RDF', x: -5, z: -3, type: 'standard' },
        { id: 'sparql', label: 'SPARQL', x: 5, z: -3, type: 'language' },
        { id: 'json_ld', label: 'JSON-LD', x: 0, z: 0, type: 'format' },
        { id: 'schema_org', label: 'Schema.org', x: 0, z: 5, type: 'vocabulary' },
        { id: 'foaf', label: 'FOAF', x: -5, z: 3, type: 'vocabulary' },
        { id: 'owl', label: 'OWL', x: 5, z: 3, type: 'language' },
        { id: 'turtle', label: 'Turtle', x: -3, z: 0, type: 'format' }
      ],
      edges: [
        ['rdf', 'sparql'],
        ['rdf', 'json_ld'],
        ['rdf', 'turtle'],
        ['json_ld', 'schema_org'],
        ['rdf', 'foaf'],
        ['rdf', 'owl'],
        ['foaf', 'schema_org']
      ]
    },
    {
      id: 'document',
      label: 'Document Graph - Papers & Blogs',
      color: 0x4ECDC4,
      height: 10,
      nodes: [
        { id: 'danbri_blog', label: "Dan's Blog", x: 0, z: 0, type: 'blog' },
        { id: 'schema_docs', label: 'Schema.org Docs', x: 0, z: 5, type: 'documentation' },
        { id: 'rdf_primer', label: 'RDF Primer', x: -5, z: -3, type: 'specification' },
        { id: 'foaf_spec', label: 'FOAF Spec', x: -5, z: 3, type: 'specification' },
        { id: 'kg_paper', label: 'Knowledge Graphs', x: 5, z: 0, type: 'paper' },
        { id: 'semantic_web', label: 'Semantic Web', x: 3, z: -4, type: 'paper' }
      ],
      edges: [
        ['danbri_blog', 'schema_docs'],
        ['danbri_blog', 'foaf_spec'],
        ['rdf_primer', 'foaf_spec'],
        ['schema_docs', 'kg_paper'],
        ['semantic_web', 'kg_paper'],
        ['rdf_primer', 'semantic_web']
      ]
    },
    {
      id: 'concept',
      label: 'Concept Graph - Ideas & Topics',
      color: 0x95E1D3,
      height: 15,
      nodes: [
        { id: 'linked_data', label: 'Linked Data', x: 0, z: 0, type: 'concept' },
        { id: 'semantic_web', label: 'Semantic Web', x: 3, z: -4, type: 'concept' },
        { id: 'knowledge_graph', label: 'Knowledge Graph', x: 5, z: 0, type: 'concept' },
        { id: 'ontology', label: 'Ontology', x: -5, z: -3, type: 'concept' },
        { id: 'metadata', label: 'Metadata', x: -5, z: 3, type: 'concept' },
        { id: 'open_data', label: 'Open Data', x: 0, z: 5, type: 'concept' }
      ],
      edges: [
        ['linked_data', 'semantic_web'],
        ['linked_data', 'knowledge_graph'],
        ['semantic_web', 'ontology'],
        ['linked_data', 'metadata'],
        ['linked_data', 'open_data'],
        ['knowledge_graph', 'ontology']
      ]
    }
  ],
  // Entities that appear in more than one layer; `connectTo` names a node in
  // another layer that stands for the same entity under a different id.
  sharedEntities: [
    { id: 'schema_org', layers: ['social', 'technology'] },
    { id: 'danbri', layers: ['social'], connectTo: 'danbri_blog' },
    { id: 'semantic_web', layers: ['document', 'concept'] },
    { id: 'foaf', layers: ['technology'], connectTo: 'foaf_spec' },
    { id: 'rdf', layers: ['technology'], connectTo: 'rdf_primer' }
  ]
};

export const DEFAULTS = {
  frameSize: 14,
  frameThickness: 0.2,
  nodeRadius: 0.4,
  linkRadius: 0.1,
  linkColor: 0x00ff00,
  labelYOffset: 0.7,
  labelFadeNear: 30,
  labelFadeRange: 20,
  bobAmplitude: 0.05,
  bobSpeed: 0.001,
  pulseBase: 0.4,
  pulseAmplitude: 0.2,
  pulseSpeed: 0.002,
  emissiveIdle: 0.3,
  emissiveHover: 0.6,
  hoverScale: 1.2,
  zoomMin: 10,
  zoomMax: 50,
  cameraStart: { x: 20, y: 15, z: 20 }
};

/**
 * Resolve a graph spec into a geometry model. Pure data in, pure data out.
 * Node records gain pos {x,y,z}; edges become {a, b, color} position pairs;
 * shared entities become vertical links {x, z, minY, maxY}.
 */
export function buildModel(spec, config = DEFAULTS) {
  const layers = spec.layers.map(layerSpec => {
    const nodes = layerSpec.nodes.map(n => ({
      id: n.id,
      label: n.label,
      type: n.type,
      layerId: layerSpec.id,
      pos: { x: n.x, y: layerSpec.height, z: n.z }
    }));
    const byId = new Map(nodes.map(n => [n.id, n]));
    const edges = layerSpec.edges
      .filter(([from, to]) => byId.has(from) && byId.has(to))
      .map(([from, to]) => ({
        a: byId.get(from).pos,
        b: byId.get(to).pos,
        color: layerSpec.color
      }));
    return {
      id: layerSpec.id,
      label: layerSpec.label || layerSpec.id,
      color: layerSpec.color,
      height: layerSpec.height,
      nodes,
      edges
    };
  });

  const links = [];
  for (const entity of spec.sharedEntities || []) {
    const positions = [];
    for (const layer of spec.layers) {
      const node = layer.nodes.find(
        n => n.id === entity.id || n.id === entity.connectTo
      );
      if (node && ((entity.layers || []).includes(layer.id) || entity.connectTo === node.id)) {
        positions.push({ x: node.x, y: layer.height, z: node.z });
      }
    }
    if (positions.length > 1) {
      links.push({
        entityId: entity.id,
        x: positions[0].x,
        z: positions[0].z,
        minY: Math.min(...positions.map(p => p.y)),
        maxY: Math.max(...positions.map(p => p.y))
      });
    }
  }

  const heights = layers.map(l => l.height);
  const midY = heights.length
    ? (Math.min(...heights) + Math.max(...heights)) / 2
    : 0;

  return {
    layers,
    nodes: layers.flatMap(l => l.nodes),
    links,
    focus: { x: 0, y: midY, z: 0 },
    config
  };
}

/**
 * The controller. Owns view state and input; delegates drawing to the
 * renderer adapter and keeps HTML labels/tooltip in sync each frame.
 */
export class LayerViz {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container   host element for the drawing surface
   * @param {Function} options.createRenderer RendererAdapter factory (see contract)
   * @param {Object} [options.spec]           graph spec; DEFAULT_GRAPH if absent
   * @param {HTMLElement} [options.tooltip]   tooltip element; created if absent
   * @param {Object} [options.config]         overrides merged over DEFAULTS
   */
  constructor({ container, createRenderer, spec = DEFAULT_GRAPH, tooltip, config = {} }) {
    this.container = container;
    this.config = { ...DEFAULTS, ...config };
    this.model = buildModel(spec, this.config);
    this.renderer = createRenderer({
      container,
      model: this.model,
      config: this.config
    });

    this.animating = true;
    this.showLabels = true;
    this.hovered = null;
    this.disposed = false;

    // Orbit camera state: yaw/pitch/distance around the focus target.
    // Drag gestures write to this directly, so the camera answers within
    // the same frame — no easing lag.
    this.orbit = this._orbitFrom(this.config.cameraStart, this.model.focus);
    this.inertia = { yaw: 0, pitch: 0 };
    this._pointers = new Map();
    this._pinchDist = 0;
    this._lastRotate = { yaw: 0, pitch: 0 };
    this.view = {
      position: this._orbitPosition(),
      target: { ...this.model.focus }
    };

    // Labels and tooltip live in a clipped overlay INSIDE the container.
    // On document.body, an off-screen label widens the mobile layout
    // viewport, which shoves fixed-position UI off the visible screen.
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    this.overlay = document.createElement('div');
    this.overlay.style.cssText =
      'position:absolute;inset:0;overflow:hidden;pointer-events:none';
    container.appendChild(this.overlay);

    this.tooltip = tooltip || this._createTooltip();
    this.labels = this.model.nodes.map(node => this._createLabel(node));

    this._bindEvents();
    this._onResize();
    this._frame = this._frame.bind(this);
    this._raf = requestAnimationFrame(this._frame);
  }

  toggleAnimation() {
    this.animating = !this.animating;
    return this.animating;
  }

  toggleLabels() {
    this.showLabels = !this.showLabels;
    if (!this.showLabels) {
      for (const l of this.labels) l.el.style.display = 'none';
    }
    return this.showLabels;
  }

  resetCamera() {
    this.orbit = this._orbitFrom(this.config.cameraStart, this.view.target);
    this.inertia.yaw = 0;
    this.inertia.pitch = 0;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this._raf);
    clearTimeout(this._tapHide);
    for (const [target, type, fn, opts] of this._listeners) {
      target.removeEventListener(type, fn, opts);
    }
    for (const l of this.labels) l.el.remove();
    if (this._ownTooltip) this.tooltip.remove();
    this.overlay.remove();
    this.renderer.dispose();
  }

  // ---- internals -------------------------------------------------------

  _createTooltip() {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;padding:8px 12px;background:rgba(0,0,0,0.9);' +
      'color:#fff;border-radius:5px;font-size:12px;pointer-events:none;' +
      'display:none;z-index:1000;box-shadow:0 2px 10px rgba(0,0,0,0.3)';
    this.overlay.appendChild(el);
    this._ownTooltip = true;
    return el;
  }

  _createLabel(node) {
    const el = document.createElement('div');
    el.className = 'label3d';
    el.style.cssText =
      'position:absolute;color:#fff;font-size:12px;font-weight:500;' +
      'text-shadow:0 0 4px rgba(0,0,0,0.8),0 0 8px rgba(0,0,0,0.6);' +
      'pointer-events:none;user-select:none;white-space:nowrap;display:none';
    el.textContent = node.label;
    this.overlay.appendChild(el);
    return { node, el };
  }

  _bindEvents() {
    this._listeners = [];
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      this._listeners.push([target, type, fn, opts]);
    };

    // Everything binds to the container only, so overlay UI (the info
    // panel) keeps its own taps, clicks, and scrolling. Pointer Events
    // unify mouse, touch, and pen; the container's CSS touch-action:none
    // hands us the raw gestures.
    on(this.container, 'pointerdown', e => this._onPointerDown(e));
    on(this.container, 'pointermove', e => this._onPointerMove(e));
    on(this.container, 'pointerup', e => this._onPointerEnd(e));
    on(this.container, 'pointercancel', e => this._onPointerEnd(e));
    on(this.container, 'pointerleave', e => {
      // Touch pointers always "leave" on lift — that must not erase the
      // tap tooltip; its own timer clears it.
      if (e.pointerType !== 'touch' && this._pointers.size === 0) {
        this._clearHover();
      }
    });
    on(this.container, 'wheel', e => this._onWheel(e), { passive: false });
    on(window, 'resize', () => this._onResize());
  }

  // ---- orbit camera ----------------------------------------------------

  _orbitFrom(pos, target) {
    const dx = pos.x - target.x;
    const dy = pos.y - target.y;
    const dz = pos.z - target.z;
    const distance = Math.hypot(dx, dy, dz) || 1;
    return {
      yaw: Math.atan2(dx, dz),
      pitch: Math.asin(Math.max(-1, Math.min(1, dy / distance))),
      distance
    };
  }

  _orbitPosition() {
    const { yaw, pitch, distance } = this.orbit;
    const t = this.view ? this.view.target : this.model.focus;
    const c = Math.cos(pitch);
    return {
      x: t.x + distance * Math.sin(yaw) * c,
      y: t.y + distance * Math.sin(pitch),
      z: t.z + distance * Math.cos(yaw) * c
    };
  }

  /** Rotate like OrbitControls: a full-height drag is a full revolution. */
  _rotate(dx, dy) {
    const s = (2 * Math.PI) / Math.max(200, this.container.clientHeight || 600);
    const dYaw = -dx * s;
    const dPitch = dy * s;
    this.orbit.yaw += dYaw;
    this.orbit.pitch = Math.max(-1.35, Math.min(1.35, this.orbit.pitch + dPitch));
    this._lastRotate = { yaw: dYaw, pitch: dPitch, at: performance.now() };
  }

  /** Multiply the orbit distance, clamped to config limits. Immediate. */
  _zoomBy(factor) {
    this.orbit.distance = Math.max(
      this.config.zoomMin,
      Math.min(this.config.zoomMax, this.orbit.distance * factor)
    );
  }

  // ---- pointer gestures ------------------------------------------------

  _onPointerDown(e) {
    // Best-effort: synthetic events have no active pointer to capture,
    // and a throw here would kill gesture tracking entirely.
    try { this.container.setPointerCapture(e.pointerId); } catch { /* ok */ }
    this._pointers.set(e.pointerId, {
      x: e.clientX, y: e.clientY,
      startX: e.clientX, startY: e.clientY,
      moved: 0, type: e.pointerType
    });
    this.inertia.yaw = 0;
    this.inertia.pitch = 0;
    this._lastRotate = { yaw: 0, pitch: 0 };
    if (this._pointers.size === 2) this._pinchDist = this._pointerDistance();
    this._clearHover();
  }

  _onPointerMove(e) {
    const p = this._pointers.get(e.pointerId);
    if (!p) {
      // Not dragging: mouse/pen hover picks nodes.
      if (e.pointerType !== 'touch') this._hoverPick(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    p.moved += Math.abs(dx) + Math.abs(dy);
    if (this._pointers.size === 1) {
      this._rotate(dx, dy);
    } else if (this._pointers.size === 2 && this._pinchDist > 0) {
      const d = this._pointerDistance();
      if (d > 0) this._zoomBy(this._pinchDist / d);
      this._pinchDist = d;
    }
  }

  _onPointerEnd(e) {
    const p = this._pointers.get(e.pointerId);
    this._pointers.delete(e.pointerId);
    if (this._pointers.size < 2) this._pinchDist = 0;
    if (this._pointers.size === 0 && p) {
      if (p.moved < 8) {
        // A tap: show what was tapped (touch has no hover), briefly.
        this._hoverPick(e.clientX, e.clientY);
        if (p.type === 'touch' && this.hovered) {
          clearTimeout(this._tapHide);
          this._tapHide = setTimeout(() => this._clearHover(), 3000);
        }
      } else if (performance.now() - (this._lastRotate.at || 0) < 120) {
        // A flick: glide with the release velocity, capped. A drag that
        // stopped before release gets no glide — that reads as intended.
        const cap = v => Math.max(-0.06, Math.min(0.06, v));
        this.inertia.yaw = cap(this._lastRotate.yaw);
        this.inertia.pitch = cap(this._lastRotate.pitch);
      }
    }
  }

  _pointerDistance() {
    const [a, b] = [...this._pointers.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  _onWheel(event) {
    event.preventDefault();
    // Trackpad pinches arrive as ctrl+wheel: give them a stronger response
    // so the gesture feels one-to-one.
    const speed = event.ctrlKey ? 0.01 : 0.0015;
    this._zoomBy(Math.exp(event.deltaY * speed));
  }

  // ---- hover + tooltip -------------------------------------------------

  _hoverPick(clientX, clientY) {
    const node = this.renderer.pick(clientX, clientY);
    if (node !== this.hovered) {
      this.hovered = node;
      this.renderer.setHighlight(node);
    }
    if (node) {
      this.tooltip.textContent = '';
      const strong = document.createElement('strong');
      strong.textContent = node.label;
      this.tooltip.append(
        strong,
        document.createElement('br'),
        `Type: ${node.type}`,
        document.createElement('br'),
        `ID: ${node.id}`
      );
      const rect = this.container.getBoundingClientRect();
      this.tooltip.style.display = 'block';
      this.tooltip.style.left = `${clientX - rect.left + 10}px`;
      this.tooltip.style.top = `${clientY - rect.top - 30}px`;
    } else {
      this.tooltip.style.display = 'none';
    }
  }

  _clearHover() {
    if (this.hovered) {
      this.hovered = null;
      this.renderer.setHighlight(null);
    }
    this.tooltip.style.display = 'none';
  }

  _onResize() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  }

  _updateLabels() {
    if (!this.showLabels) return;
    for (const { node, el } of this.labels) {
      const p = this.renderer.projectNode(node);
      if (!p || !p.inFront) {
        el.style.display = 'none';
        continue;
      }
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      el.style.display = 'block';
      const { labelFadeNear, labelFadeRange } = this.config;
      el.style.opacity = Math.max(
        0,
        Math.min(1, (labelFadeNear - p.distance) / labelFadeRange)
      );
    }
  }

  _frame(timeMs) {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(this._frame);

    // Flicked drags glide to a stop; active drags already moved the orbit.
    if (this._pointers.size === 0) {
      if (Math.abs(this.inertia.yaw) > 1e-5 || Math.abs(this.inertia.pitch) > 1e-5) {
        this.orbit.yaw += this.inertia.yaw;
        this.orbit.pitch = Math.max(-1.35,
          Math.min(1.35, this.orbit.pitch + this.inertia.pitch));
        this.inertia.yaw *= 0.92;
        this.inertia.pitch *= 0.92;
      } else {
        this.inertia.yaw = 0;
        this.inertia.pitch = 0;
      }
    }
    this.view.position = this._orbitPosition();

    this.renderer.animate(timeMs, this.animating);
    this.renderer.setView(this.view);
    this.renderer.render();
    this._updateLabels();
  }
}
