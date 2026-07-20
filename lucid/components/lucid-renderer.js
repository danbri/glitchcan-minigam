/**
 * <lucid-renderer> - Backend-neutral SDF renderer component
 *
 * Wraps either Mayfly (WebGL) or Stinkyfish (WebGPU) raymarcher.
 * Provides a consistent API regardless of backend.
 *
 * Usage:
 *   <lucid-renderer backend="mayfly" scene="creatures/wolf.json"></lucid-renderer>
 *   <lucid-renderer backend="stinkyfish"></lucid-renderer>
 *
 * Attributes:
 *   - backend: "mayfly" | "stinkyfish" | "auto" (default: "auto")
 *   - scene: path to scene JSON file (relative to scenes/)
 *   - quality: "low" | "medium" | "high" (default: "medium")
 *
 * Events:
 *   - renderer-ready: Fired when renderer is initialized
 *   - scene-loaded: Fired when scene is loaded successfully
 *   - render-error: Fired on shader compilation or render errors
 */

const BACKENDS = {
  MAYFLY: 'mayfly',
  STINKYFISH: 'stinkyfish',
  AUTO: 'auto'
};

export class LucidRenderer extends HTMLElement {
  static get observedAttributes() {
    return ['backend', 'scene', 'quality', 'disable-controls', 'ground-plane', 'axes', 'ellipsoid-fidelity'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this._backend = null;
    this._renderer = null;
    this._scene = null;
    this._animationFrame = null;
    this._isRendering = false;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
          position: relative;
          background: #000;
        }
        canvas {
          width: 100%;
          height: 100%;
          display: block;
          touch-action: none;
        }
        .status {
          position: absolute;
          bottom: 8px;
          left: 8px;
          font-family: monospace;
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 4px;
          pointer-events: none;
        }
        .status.info { background: rgba(0,100,200,0.8); color: #fff; }
        .status.error { background: rgba(200,50,50,0.9); color: #fff; }
        .status.ok { background: rgba(50,150,50,0.8); color: #fff; }
        .status:empty { display: none; }
        .backend-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          font-family: monospace;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 3px;
          background: rgba(0,0,0,0.6);
          color: #888;
          pointer-events: none;
        }
        .backend-badge.mayfly { color: #4af; }
        .backend-badge.stinkyfish { color: #f4a; }
      </style>
      <canvas></canvas>
      <div class="backend-badge"></div>
      <div class="status"></div>
    `;

    this._canvas = this.shadowRoot.querySelector('canvas');
    this._statusEl = this.shadowRoot.querySelector('.status');
    this._badgeEl = this.shadowRoot.querySelector('.backend-badge');
  }

  connectedCallback() {
    this._setupResizeObserver();
    // Delay init slightly to ensure element is attached and sized
    // This prevents WebGL context failures on hidden elements
    requestAnimationFrame(() => {
      this._initBackend();
    });
  }

  disconnectedCallback() {
    this._stopRenderLoop();
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'backend':
        this._initBackend();
        break;
      case 'scene':
        this.loadScene(newValue);
        break;
      case 'quality':
        this._applyQuality(newValue);
        break;
      case 'ground-plane':
        this.setGroundPlane(newValue !== 'false');
        break;
      case 'axes':
        this.setAxes(newValue !== 'false');
        break;
      case 'ellipsoid-fidelity':
        // Fidelity is baked into the shader, so recompile the current scene.
        if (this._scene && this._renderer) this.loadSceneJson(this._scene);
        break;
    }
  }

  // Public API

  get backend() {
    return this.getAttribute('backend') || 'auto';
  }

  set backend(value) {
    this.setAttribute('backend', value);
  }

  get scene() {
    return this.getAttribute('scene');
  }

  set scene(value) {
    this.setAttribute('scene', value);
  }

  get quality() {
    return this.getAttribute('quality') || 'medium';
  }

  set quality(value) {
    this.setAttribute('quality', value);
  }

  get renderer() {
    return this._renderer;
  }

  get activeBackend() {
    return this._backend;
  }

  async loadScene(scenePath) {
    if (!scenePath || !this._renderer) return;

    try {
      this._setStatus('Loading...', 'info');

      const basePath = this._getBasePath();
      const fullPath = `${basePath}/scenes/${scenePath}`;

      const response = await fetch(fullPath);
      if (!response.ok) throw new Error(`Failed to load ${scenePath}`);

      const json = await response.json();
      await this.loadSceneJson(json);

      this._setStatus('', 'ok');
      this.dispatchEvent(new CustomEvent('scene-loaded', {
        detail: { path: scenePath, json }
      }));

    } catch (error) {
      this._setStatus(error.message, 'error');
      this.dispatchEvent(new CustomEvent('render-error', {
        detail: { error, scene: scenePath }
      }));
    }
  }

  async loadSceneJson(json) {
    if (!this._renderer) {
      throw new Error('Renderer not initialized');
    }

    this._scene = json;

    // Load scene using appropriate backend
    if (this._backend === BACKENDS.STINKYFISH) {
      await this._loadSceneStinkyfish(json);
    } else {
      await this._loadSceneMayfly(json);
    }

    this._startRenderLoop();
  }

  // Camera control API
  setCamera(options) {
    if (!this._renderer) return;

    if (options.distance !== undefined) {
      this._renderer.cameraDistance = options.distance;
    }
    if (options.theta !== undefined) {
      this._renderer.cameraTheta = options.theta;
    }
    if (options.phi !== undefined) {
      this._renderer.cameraPhi = options.phi;
    }
    if (options.target !== undefined) {
      this._renderer.cameraTarget = options.target;
    }
  }

  // Parameter update API
  updateParam(name, value) {
    if (!this._renderer) return;

    // Both backends expose setParam(name, value) (Stinkyfish's is an alias for
    // setSceneParam). This previously called updateSceneParam/updateUniform,
    // which exist on neither renderer, so the component's public param-update
    // API silently did nothing. Route to the real, shared method instead.
    if (typeof this._renderer.setParam === 'function') {
      this._renderer.setParam(name, value);
    }
  }

  // Animation time API.
  // Pin the render clock to an explicit time in seconds (e.g. a timeline
  // scrubber). Both backends read `overrideTime` in their render loop, so this
  // works identically on Mayfly and Stinkyfish. Pass null to resume the
  // renderer's own wall clock.
  setTime(seconds) {
    if (!this._renderer) return;
    this._renderer.overrideTime = (seconds === null || seconds === undefined)
      ? null
      : seconds;
  }

  clearTime() {
    this.setTime(null);
  }

  // --- Unified display-helper API (forwards to whichever backend is active) ---
  // Both renderers expose setGroundPlane/setAxes/setDisplayOptions, so these work
  // identically regardless of backend. Also driven declaratively by the
  // `ground-plane` / `axes` attributes (e.g. <lucid-renderer ground-plane="false">).
  setGroundPlane(visible) { this._renderer?.setGroundPlane?.(visible); }
  setAxes(visible) { this._renderer?.setAxes?.(visible); }
  setEdges(visible) { this._renderer?.setEdges?.(visible); }
  setDisplayOptions(opts) { this._renderer?.setDisplayOptions?.(opts); }

  _applyDisplayAttributes() {
    if (!this._renderer) return;
    if (this.hasAttribute('ground-plane')) {
      this.setGroundPlane(this.getAttribute('ground-plane') !== 'false');
    }
    if (this.hasAttribute('axes')) {
      this.setAxes(this.getAttribute('axes') !== 'false');
    }
  }

  // Private methods

  _getBasePath() {
    // Get path relative to this component
    const scriptUrl = import.meta.url;
    return scriptUrl.substring(0, scriptUrl.lastIndexOf('/components'));
  }

  async _initBackend() {
    const requestedBackend = this.backend;

    // Determine which backend to use
    let selectedBackend = requestedBackend;

    if (requestedBackend === 'auto') {
      // Prefer WebGPU if available
      if (navigator.gpu) {
        selectedBackend = BACKENDS.STINKYFISH;
      } else {
        selectedBackend = BACKENDS.MAYFLY;
      }
    }

    // Check WebGPU support for stinkyfish
    if (selectedBackend === BACKENDS.STINKYFISH && !navigator.gpu) {
      console.warn('WebGPU not available, falling back to Mayfly');
      selectedBackend = BACKENDS.MAYFLY;
    }

    this._backend = selectedBackend;
    this._badgeEl.textContent = selectedBackend;
    this._badgeEl.className = `backend-badge ${selectedBackend}`;

    try {
      if (selectedBackend === BACKENDS.STINKYFISH) {
        await this._initStinkyfish();
      } else {
        await this._initMayfly();
      }

      this.dispatchEvent(new CustomEvent('renderer-ready', {
        detail: { backend: selectedBackend }
      }));

      // Apply declarative display attributes now the renderer exists
      // (they may have been set in HTML before init).
      this._applyDisplayAttributes();

      // Load scene if specified
      const scenePath = this.scene;
      if (scenePath) {
        await this.loadScene(scenePath);
      }

    } catch (error) {
      this._setStatus(`Init failed: ${error.message}`, 'error');
      this.dispatchEvent(new CustomEvent('render-error', {
        detail: { error, phase: 'init' }
      }));
    }
  }

  async _initMayfly() {
    const basePath = this._getBasePath();
    const { SimpleRaymarcher } = await import(`${basePath}/mayfly/raymarcher.js`);

    // Ensure canvas has valid dimensions before WebGL init
    if (this._canvas.width === 0 || this._canvas.height === 0) {
      // Set minimum dimensions for initial context creation
      const rect = this.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this._canvas.width = Math.max(1, Math.floor((rect.width || 100) * dpr));
      this._canvas.height = Math.max(1, Math.floor((rect.height || 100) * dpr));
    }

    this._renderer = new SimpleRaymarcher(this._canvas);
    this._setStatus('Mayfly ready', 'ok');
  }

  async _initStinkyfish() {
    const basePath = this._getBasePath();
    const { StinkyfishRenderer } = await import(`${basePath}/stinkyfish/raymarcher.js`);

    // Ensure canvas has valid dimensions before WebGPU init
    if (this._canvas.width === 0 || this._canvas.height === 0) {
      const rect = this.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this._canvas.width = Math.max(1, Math.floor((rect.width || 100) * dpr));
      this._canvas.height = Math.max(1, Math.floor((rect.height || 100) * dpr));
    }

    // Pass disableControls option if attribute is set
    const disableControls = this.hasAttribute('disable-controls');
    this._renderer = new StinkyfishRenderer(this._canvas, { disableControls });
    await this._renderer.init();
    this._setStatus('Stinkyfish ready', 'ok');
  }

  // Codegen options assembled from (in priority order) the `ellipsoid-fidelity`
  // attribute, then the scene JSON's own `ellipsoidFidelity`. This is the entry
  // point for env/task hints — e.g. an app can set the attribute to 'fast' on
  // low-end devices and 'auto'/'exact' on capable ones. Omitted => 'fast'.
  _codegenOptions(json) {
    const attr = this.getAttribute('ellipsoid-fidelity');
    const fidelity = attr != null ? attr : (json && json.ellipsoidFidelity);
    const opts = {};
    if (fidelity != null && fidelity !== '') {
      opts.ellipsoidFidelity = /^\d+$/.test(fidelity) ? parseInt(fidelity, 10) : fidelity;
    }
    return opts;
  }

  async _loadSceneMayfly(json) {
    const basePath = this._getBasePath();
    const { loadJsonScene } = await import(`${basePath}/core/json-loader.js`);
    const { generateGlslFromJson } = await import(`${basePath}/core/json-codegen.js`);

    const scene = loadJsonScene(json);
    const glsl = generateGlslFromJson(scene, this._codegenOptions(json));

    // Shared per-frame simulation for both backends (rig + physics).
    const { SimulationDriver } = await import(`${basePath}/core/simulation-driver.js`);
    this._sim = new SimulationDriver(scene);
    // The driver owns rig AND physics, so tell Mayfly to skip its internal
    // versions — one simulation feeds both engines (set before updateScene,
    // which would otherwise spin up Mayfly's own physics stack).
    this._renderer.externalRig = true;
    this._renderer.externalPhysics = true;
    await this._sim.initPhysics(basePath, json);

    // Mayfly uses updateScene(glsl, params, rig, json)
    this._renderer.updateScene(glsl, scene.params || {}, scene.rig || null, json);

    // Apply camera settings
    if (json.camera) {
      const cam = json.camera;
      this._renderer.cameraDistance = cam.distance || 8;
      this._renderer.cameraTheta = cam.theta || 0.3;
      this._renderer.cameraPhi = cam.phi || 0.4;
      if (cam.target) {
        this._renderer.cameraTarget = cam.target;
      }
    }
  }

  async _loadSceneStinkyfish(json) {
    const basePath = this._getBasePath();
    const { loadJsonScene } = await import(`${basePath}/core/json-loader.js`);
    const { generateWgslFromJson } = await import(`${basePath}/core/wgsl-codegen.js`);
    const { getAllParamNames } = await import(`${basePath}/core/rig-evaluator.js`);
    const { SimulationDriver } = await import(`${basePath}/core/simulation-driver.js`);

    const scene = loadJsonScene(json);
    const wgsl = generateWgslFromJson(scene, this._codegenOptions(json));

    // Build uniform layout from all params (including rig-derived + physics
    // body positions, so the driver's setParam('phys_<name>') lands in the
    // SceneUniforms struct — the WGSL renderer only writes params it knows).
    const allParams = getAllParamNames(scene.params || {}, scene.rig);
    if (scene.physics?.enabled && Array.isArray(scene.physics.bodies)) {
      for (const body of scene.physics.bodies) {
        if (body.name) allParams[`phys_${body.name}`] = { type: 'position3' };
      }
    }
    const uniformLayout = this._buildUniformLayout(allParams);

    // Stinkyfish uses compileScene(wgsl, uniformLayout)
    await this._renderer.compileScene(wgsl, uniformLayout);

    // Initialize scene parameters (must be called after compileScene).
    // Include rig-derived/phase names as stubs so the per-frame rig evaluation
    // (below) can push their values via setParam — the WGSL renderer only
    // updates params it already knows about.
    const initParams = { ...(scene.params || {}) };
    for (const [name, info] of Object.entries(allParams)) {
      if (!initParams[name]) initParams[name] = { type: info.type || 'scalar', value: 0 };
    }
    this._renderer.setSceneParams(initParams);

    // Shared per-frame simulation (rig + physics). The WGSL renderer never
    // evaluated the rig or stepped physics itself, so without this its
    // derived/phase params and physics bodies would be frozen — the driver
    // closes that gap the same way it drives Mayfly, from one code path.
    this._sim = new SimulationDriver(scene);
    await this._sim.initPhysics(basePath, json);

    // Apply camera settings - use same defaults as Mayfly for consistency
    if (json.camera) {
      const cam = json.camera;
      this._renderer.cameraDistance = cam.distance || 8;
      this._renderer.cameraTheta = cam.theta || 0.3;
      this._renderer.cameraPhi = cam.phi || 0.4;
      if (cam.target) {
        this._renderer.cameraTarget = cam.target;
      }
    }
  }

  _buildUniformLayout(allParams) {
    if (!allParams || Object.keys(allParams).length === 0) return null;

    const layout = {};
    for (const [name, paramInfo] of Object.entries(allParams)) {
      const uniformName = `u_${name}`;
      // Map param types to WGSL types
      const type = paramInfo.type || 'scalar';
      if (type === 'color3' || type === 'position3' || type === 'radii3' || type === 'direction3' || type === 'vec3') {
        layout[uniformName] = 'vec3f';
      } else {
        layout[uniformName] = 'f32';
      }
    }
    return layout;
  }

  _applyQuality(quality) {
    if (!this._renderer) return;

    const presets = {
      low: { maxSteps: 100, hitThreshold: 0.005 },
      medium: { maxSteps: 150, hitThreshold: 0.003 },
      high: { maxSteps: 200, hitThreshold: 0.002 }
    };

    const preset = presets[quality] || presets.medium;

    if (this._renderer.setQuality) {
      this._renderer.setQuality(preset);
    }
  }

  // Backend-neutral per-frame simulation: the shared SimulationDriver evaluates
  // the rig (and, later, steps physics) and pushes results into whichever
  // renderer via setParam. Used for BOTH backends — Mayfly runs with
  // externalRig=true so this is its single source of animation.
  _stepSimulation() {
    const r = this._renderer;
    if (!this._sim || !r || typeof r.setParam !== 'function') return;
    const t = r.overrideTime != null
      ? r.overrideTime
      : (performance.now() - (r.startTime || performance.now())) / 1000;
    const dt = Math.min(r.timeDelta || 0.016, 0.05);
    this._sim.step(t, dt, r);
  }

  _startRenderLoop() {
    if (this._isRendering) return;
    this._isRendering = true;
    this._startTime = performance.now();

    const render = (timestamp) => {
      if (!this._isRendering) return;

      if (this._renderer?.render) {
        const time = (timestamp - this._startTime) * 0.001; // Convert to seconds
        this._stepSimulation();
        this._renderer.render(time);
      }

      this._animationFrame = requestAnimationFrame(render);
    };

    this._animationFrame = requestAnimationFrame(render);
  }

  _stopRenderLoop() {
    this._isRendering = false;
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
  }

  _setupResizeObserver() {
    this._resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        this._canvas.width = Math.floor(width * dpr);
        this._canvas.height = Math.floor(height * dpr);

        if (this._renderer?.resize) {
          this._renderer.resize(this._canvas.width, this._canvas.height);
        }
      }
    });

    this._resizeObserver.observe(this);
  }

  _setStatus(message, type = 'info') {
    this._statusEl.textContent = message;
    this._statusEl.className = `status ${type}`;

    if (message && type === 'ok') {
      // Auto-hide success messages after 2s
      setTimeout(() => {
        if (this._statusEl.textContent === message) {
          this._statusEl.textContent = '';
        }
      }, 2000);
    }
  }
}

customElements.define('lucid-renderer', LucidRenderer);
