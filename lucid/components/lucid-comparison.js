/**
 * <lucid-comparison> - Side-by-side backend comparison view
 *
 * Renders the same scene with both Mayfly and Stinkyfish for visual comparison.
 * Useful for catching regressions between backends.
 *
 * Usage:
 *   <lucid-comparison scene="creatures/wolf.json"></lucid-comparison>
 *
 * Attributes:
 *   - scene: path to scene JSON file
 *   - layout: "horizontal" | "vertical" | "overlay" (default: "horizontal")
 *   - sync-camera: if present, syncs camera between both views
 *
 * Events:
 *   - comparison-ready: Both renderers initialized
 *   - comparison-error: One or both renderers failed
 */

import './lucid-renderer.js';

export class LucidComparison extends HTMLElement {
  static get observedAttributes() {
    return ['scene', 'layout'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this._scene = null;
    this._syncCamera = false;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
          --bg: #0d1117;
          --border: #30363d;
          --text: #c9d1d9;
        }

        .comparison {
          display: flex;
          width: 100%;
          height: 100%;
          gap: 2px;
          background: var(--border);
        }

        :host([layout="vertical"]) .comparison {
          flex-direction: column;
        }

        .pane {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 0;
          background: var(--bg);
        }

        .pane-header {
          padding: 6px 12px;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 12px;
          font-weight: 600;
          color: var(--text);
          background: rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pane-header .backend {
          font-weight: 400;
          opacity: 0.7;
        }

        .pane-header .status {
          margin-left: auto;
          font-size: 11px;
          font-weight: 400;
        }

        .pane-header .status.ok { color: #3fb950; }
        .pane-header .status.error { color: #f85149; }
        .pane-header .status.loading { color: #f0a020; }

        lucid-renderer {
          flex: 1;
          min-height: 0;
        }

        /* Overlay mode */
        :host([layout="overlay"]) .comparison {
          position: relative;
        }

        :host([layout="overlay"]) .pane {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
        }

        :host([layout="overlay"]) .pane.mayfly {
          opacity: 0.5;
        }

        :host([layout="overlay"]) .pane.stinkyfish {
          mix-blend-mode: difference;
        }

        /* Diff highlights */
        .diff-badge {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          padding: 6px 12px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
          background: rgba(0,0,0,0.8);
          color: #fff;
          pointer-events: none;
          z-index: 10;
        }

        .diff-badge.match { background: rgba(50,150,50,0.9); }
        .diff-badge.diff { background: rgba(200,50,50,0.9); }

        /* Controls */
        .controls {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          z-index: 20;
        }

        .controls button {
          padding: 4px 10px;
          border: 1px solid var(--border);
          border-radius: 4px;
          background: rgba(30,30,40,0.9);
          color: #ccc;
          font-size: 11px;
          cursor: pointer;
        }

        .controls button:hover {
          background: rgba(50,50,60,0.9);
        }

        .controls button.active {
          background: rgba(34, 211, 238, 0.3);
          border-color: #22d3ee;
        }
      </style>

      <div class="comparison">
        <div class="pane mayfly">
          <div class="pane-header">
            <span>Mayfly</span>
            <span class="backend">WebGL</span>
            <span class="status" id="mayfly-status">...</span>
          </div>
          <lucid-renderer id="mayfly" backend="mayfly"></lucid-renderer>
        </div>
        <div class="pane stinkyfish">
          <div class="pane-header">
            <span>Stinkyfish</span>
            <span class="backend">WebGPU</span>
            <span class="status" id="stinkyfish-status">...</span>
          </div>
          <lucid-renderer id="stinkyfish" backend="stinkyfish"></lucid-renderer>
        </div>
      </div>
      <div class="controls">
        <button id="layout-h" class="active" title="Horizontal split">◫</button>
        <button id="layout-v" title="Vertical split">⬒</button>
        <button id="layout-o" title="Overlay diff">◉</button>
        <button id="sync-cam" title="Sync cameras">🔗</button>
        <button id="display-mode" title="Toggle ground/axes (G)">⬓</button>
      </div>
    `;

    this._mayflyRenderer = this.shadowRoot.querySelector('#mayfly');
    this._stinkyfishRenderer = this.shadowRoot.querySelector('#stinkyfish');
    this._mayflyStatus = this.shadowRoot.querySelector('#mayfly-status');
    this._stinkyfishStatus = this.shadowRoot.querySelector('#stinkyfish-status');

    this._setupEventListeners();
    this._setupControls();
  }

  connectedCallback() {
    // Check for sync-camera attribute
    this._syncCamera = this.hasAttribute('sync-camera');
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'scene') {
      this._loadScene(newValue);
    }
  }

  get scene() {
    return this.getAttribute('scene');
  }

  set scene(value) {
    this.setAttribute('scene', value);
  }

  get layout() {
    return this.getAttribute('layout') || 'horizontal';
  }

  set layout(value) {
    this.setAttribute('layout', value);
  }

  _setupEventListeners() {
    // Mayfly events
    this._mayflyRenderer.addEventListener('renderer-ready', () => {
      this._mayflyStatus.textContent = 'Ready';
      this._mayflyStatus.className = 'status ok';
      this._checkBothReady();
    });

    this._mayflyRenderer.addEventListener('scene-loaded', () => {
      this._mayflyStatus.textContent = 'Loaded';
      this._mayflyStatus.className = 'status ok';
    });

    this._mayflyRenderer.addEventListener('render-error', (e) => {
      this._mayflyStatus.textContent = 'Error';
      this._mayflyStatus.className = 'status error';
      console.error('Mayfly error:', e.detail.error);
    });

    // Stinkyfish events
    this._stinkyfishRenderer.addEventListener('renderer-ready', () => {
      this._stinkyfishStatus.textContent = 'Ready';
      this._stinkyfishStatus.className = 'status ok';
      this._checkBothReady();
    });

    this._stinkyfishRenderer.addEventListener('scene-loaded', () => {
      this._stinkyfishStatus.textContent = 'Loaded';
      this._stinkyfishStatus.className = 'status ok';
    });

    this._stinkyfishRenderer.addEventListener('render-error', (e) => {
      this._stinkyfishStatus.textContent = 'Error';
      this._stinkyfishStatus.className = 'status error';
      console.error('Stinkyfish error:', e.detail.error);
    });
  }

  _setupControls() {
    const layoutH = this.shadowRoot.querySelector('#layout-h');
    const layoutV = this.shadowRoot.querySelector('#layout-v');
    const layoutO = this.shadowRoot.querySelector('#layout-o');
    const syncCam = this.shadowRoot.querySelector('#sync-cam');
    const displayMode = this.shadowRoot.querySelector('#display-mode');

    // Display mode: 0=none, 1=ground, 2=ground+axes
    this._displayMode = 1; // Default: ground visible
    const displayModeIcons = ['⬚', '⬓', '⊞'];
    const displayModeTitles = ['Display: None (G)', 'Display: Ground (G)', 'Display: Ground+Axes (G)'];

    const updateLayoutButtons = () => {
      layoutH.classList.toggle('active', this.layout === 'horizontal');
      layoutV.classList.toggle('active', this.layout === 'vertical');
      layoutO.classList.toggle('active', this.layout === 'overlay');
    };

    const updateDisplayMode = () => {
      const showGround = this._displayMode >= 1;
      const showAxes = this._displayMode >= 2;

      displayMode.textContent = displayModeIcons[this._displayMode];
      displayMode.title = displayModeTitles[this._displayMode];
      displayMode.classList.toggle('active', this._displayMode > 0);

      // Apply to both renderers
      const applyToRenderer = (renderer) => {
        if (renderer?.renderer) {
          renderer.renderer.showGroundPlane = showGround;
          renderer.renderer.showAxes = showAxes;
        }
      };
      applyToRenderer(this._mayflyRenderer);
      applyToRenderer(this._stinkyfishRenderer);
    };

    layoutH.addEventListener('click', () => {
      this.layout = 'horizontal';
      updateLayoutButtons();
    });

    layoutV.addEventListener('click', () => {
      this.layout = 'vertical';
      updateLayoutButtons();
    });

    layoutO.addEventListener('click', () => {
      this.layout = 'overlay';
      updateLayoutButtons();
    });

    syncCam.addEventListener('click', () => {
      this._syncCamera = !this._syncCamera;
      syncCam.classList.toggle('active', this._syncCamera);
      if (this._syncCamera) {
        this._setupCameraSync();
      }
    });

    displayMode.addEventListener('click', () => {
      this._displayMode = (this._displayMode + 1) % 3;
      updateDisplayMode();
    });

    // Keyboard shortcut for display mode
    this.shadowRoot.host.addEventListener('keydown', (e) => {
      if (e.key === 'g' || e.key === 'G') {
        this._displayMode = (this._displayMode + 1) % 3;
        updateDisplayMode();
      }
    });

    // Set initial state
    if (this._syncCamera) {
      syncCam.classList.add('active');
    }
    updateDisplayMode();
  }

  _checkBothReady() {
    const mayflyReady = this._mayflyStatus.textContent === 'Ready' ||
                        this._mayflyStatus.textContent === 'Loaded';
    const stinkyfishReady = this._stinkyfishStatus.textContent === 'Ready' ||
                            this._stinkyfishStatus.textContent === 'Loaded';

    if (mayflyReady && stinkyfishReady) {
      this.dispatchEvent(new CustomEvent('comparison-ready'));

      // Load scene if specified
      const scenePath = this.scene;
      if (scenePath) {
        this._loadScene(scenePath);
      }
    }
  }

  async _loadScene(path) {
    if (!path) return;

    this._mayflyStatus.textContent = 'Loading...';
    this._mayflyStatus.className = 'status loading';
    this._stinkyfishStatus.textContent = 'Loading...';
    this._stinkyfishStatus.className = 'status loading';

    // Load in both renderers
    this._mayflyRenderer.scene = path;
    this._stinkyfishRenderer.scene = path;
  }

  _setupCameraSync() {
    // TODO: Implement camera sync between renderers
    // This would involve listening to camera changes on one renderer
    // and applying them to the other
    console.log('Camera sync enabled - implementation pending');
  }

  // API for programmatic scene loading
  async loadSceneJson(json) {
    try {
      await Promise.all([
        this._mayflyRenderer.loadSceneJson(json),
        this._stinkyfishRenderer.loadSceneJson(json)
      ]);
    } catch (error) {
      this.dispatchEvent(new CustomEvent('comparison-error', {
        detail: { error }
      }));
    }
  }
}

customElements.define('lucid-comparison', LucidComparison);
