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
    return ['backend', 'scene', 'quality'];
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
    this._initBackend();
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

    if (this._backend === BACKENDS.STINKYFISH) {
      this._renderer.updateSceneParam?.(name, value);
    } else {
      this._renderer.updateUniform?.(`u_${name}`, value);
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
    const { SimpleRaymarcher } = await import(`${basePath}/ui/raymarcher.js`);

    this._renderer = new SimpleRaymarcher(this._canvas);
    this._setStatus('Mayfly ready', 'ok');
  }

  async _initStinkyfish() {
    const basePath = this._getBasePath();
    const { StinkyfishRaymarcher } = await import(`${basePath}/stinkyfish/raymarcher.js`);

    this._renderer = new StinkyfishRaymarcher(this._canvas);
    await this._renderer.init();
    this._setStatus('Stinkyfish ready', 'ok');
  }

  async _loadSceneMayfly(json) {
    const basePath = this._getBasePath();
    const { loadJsonScene } = await import(`${basePath}/core/json-loader.js`);
    const { generateGlslFromJson } = await import(`${basePath}/core/json-codegen.js`);

    const scene = loadJsonScene(json);
    const glsl = generateGlslFromJson(scene, {});

    this._renderer.setSceneGlsl(glsl);

    // Apply camera settings
    if (json.camera) {
      this.setCamera(json.camera);
    }
  }

  async _loadSceneStinkyfish(json) {
    const basePath = this._getBasePath();
    const { loadJsonScene } = await import(`${basePath}/core/json-loader.js`);
    const { generateWgslFromJson } = await import(`${basePath}/core/wgsl-codegen.js`);

    const scene = loadJsonScene(json);
    const wgsl = generateWgslFromJson(scene, {});

    await this._renderer.setSceneWgsl(wgsl, scene);

    // Apply camera settings
    if (json.camera) {
      const cam = json.camera;
      this._renderer.cameraDistance = cam.distance || 4;
      this._renderer.cameraTheta = cam.theta || 0;
      this._renderer.cameraPhi = cam.phi || Math.PI / 4;
      if (cam.target) {
        this._renderer.cameraTarget = cam.target;
      }
    }
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

  _startRenderLoop() {
    if (this._isRendering) return;
    this._isRendering = true;

    const render = () => {
      if (!this._isRendering) return;

      if (this._renderer?.render) {
        this._renderer.render();
      }

      this._animationFrame = requestAnimationFrame(render);
    };

    render();
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
