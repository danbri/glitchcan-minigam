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
    this._syncCamera = true; // Default: synced
    this._activePane = null; // Track which pane is being interacted with

    // Camera state (unified for both views)
    this._camera = {
      theta: 0.3,
      phi: 0.4,
      distance: 8,
      target: [0, 0.5, 0]
    };

    // Interaction state
    this._isDragging = false;
    this._lastPointer = { x: 0, y: 0 };
    this._pinchStartDistance = 0;
    this._pinchStartZoom = 0;

    // Sync timer state
    this._syncTimeout = null;
    this._syncDelay = 200; // 1/5 second = 200ms

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
          position: relative;
        }

        .pane-header {
          padding: 4px 10px;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 11px;
          font-weight: 600;
          color: var(--text);
          background: rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .pane-header .fps {
          margin-left: auto;
          font-size: 10px;
          font-weight: 400;
          opacity: 0.6;
          font-family: monospace;
        }

        lucid-renderer {
          flex: 1;
          min-width: 0;
          min-height: 0;
        }

        /* Fade overlay for sync transitions */
        .fade-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #0d1117;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease-out;
          z-index: 5;
        }

        .fade-overlay.active {
          opacity: 1;
        }

        /* Active pane indicator */
        .pane.active {
          outline: 2px solid rgba(34, 211, 238, 0.5);
          outline-offset: -2px;
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

        /* Cross-eye stereoscopic view - both panes overlap in center */
        :host([layout="crossview"]) .comparison {
          position: relative;
        }

        :host([layout="crossview"]) .pane {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 70%;
          max-width: 500px;
          aspect-ratio: 1;
        }

        :host([layout="crossview"]) .pane.stinkyfish {
          opacity: 0.5;
        }

        :host([layout="crossview"]) .pane-header {
          display: none;
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

        /* Display mode button - bottom left */
        .display-btn {
          position: absolute;
          bottom: 8px;
          left: 8px;
          padding: 6px 10px;
          border: 1px solid var(--border);
          border-radius: 4px;
          background: rgba(30,30,40,0.9);
          color: #ccc;
          font-size: 12px;
          cursor: pointer;
          z-index: 20;
        }

        .display-btn:hover {
          background: rgba(50,50,60,0.9);
        }

        .display-btn.active {
          background: rgba(34, 211, 238, 0.3);
          border-color: #22d3ee;
        }

        /* Touch-friendly styling */
        @media (pointer: coarse) {
          .pane-header {
            padding: 8px 12px;
            font-size: 12px;
          }
          .controls button {
            padding: 8px 14px;
            font-size: 14px;
          }
          .display-btn {
            padding: 10px 14px;
            font-size: 14px;
          }
        }
      </style>

      <div class="comparison">
        <div class="pane mayfly" id="pane-mayfly">
          <div class="pane-header">
            <span>Mayfly</span>
            <span class="fps" id="mayfly-fps"></span>
          </div>
          <lucid-renderer id="mayfly" backend="mayfly" disable-controls></lucid-renderer>
          <div class="fade-overlay" id="fade-mayfly"></div>
        </div>
        <div class="pane stinkyfish" id="pane-stinkyfish">
          <div class="pane-header">
            <span>Stinkyfish</span>
            <span class="fps" id="stinkyfish-fps"></span>
          </div>
          <lucid-renderer id="stinkyfish" backend="stinkyfish" disable-controls></lucid-renderer>
          <div class="fade-overlay" id="fade-stinkyfish"></div>
        </div>
      </div>
      <div class="controls">
        <button id="layout-h" class="active" title="Horizontal split">◫</button>
        <button id="layout-v" title="Vertical split">⬒</button>
        <button id="layout-o" title="Overlay diff">◉</button>
        <button id="layout-x" title="Cross-eyed stereo">👀</button>
        <button id="sync-cam" class="active" title="Sync cameras">🔗</button>
      </div>
      <button class="display-btn" id="display-mode" title="Toggle ground/axes">⬚</button>
    `;

    this._mayflyRenderer = this.shadowRoot.querySelector('#mayfly');
    this._stinkyfishRenderer = this.shadowRoot.querySelector('#stinkyfish');
    this._mayflyFps = this.shadowRoot.querySelector('#mayfly-fps');
    this._stinkyfishFps = this.shadowRoot.querySelector('#stinkyfish-fps');
    this._mayflyPane = this.shadowRoot.querySelector('#pane-mayfly');
    this._stinkyfishPane = this.shadowRoot.querySelector('#pane-stinkyfish');
    this._fadeMayfly = this.shadowRoot.querySelector('#fade-mayfly');
    this._fadeStinkyfish = this.shadowRoot.querySelector('#fade-stinkyfish');

    this._setupEventListeners();
    this._setupControls();
    this._setupUnifiedInput();
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
      this._checkBothReady();
    });

    this._mayflyRenderer.addEventListener('scene-loaded', () => {
      // Apply unified camera after scene load
      this._applyCameraToRenderer(this._mayflyRenderer);
    });

    this._mayflyRenderer.addEventListener('render-error', (e) => {
      console.error('Mayfly error:', e.detail.error);
    });

    // Stinkyfish events
    this._stinkyfishRenderer.addEventListener('renderer-ready', () => {
      this._checkBothReady();
    });

    this._stinkyfishRenderer.addEventListener('scene-loaded', () => {
      // Apply unified camera after scene load
      this._applyCameraToRenderer(this._stinkyfishRenderer);
    });

    this._stinkyfishRenderer.addEventListener('render-error', (e) => {
      console.error('Stinkyfish error:', e.detail.error);
    });
  }

  _setupControls() {
    const layoutH = this.shadowRoot.querySelector('#layout-h');
    const layoutV = this.shadowRoot.querySelector('#layout-v');
    const layoutO = this.shadowRoot.querySelector('#layout-o');
    const layoutX = this.shadowRoot.querySelector('#layout-x');
    const syncCam = this.shadowRoot.querySelector('#sync-cam');
    const displayMode = this.shadowRoot.querySelector('#display-mode');

    // Display mode: 0=none, 1=axes, 2=axes+ground, 3=ground
    this._displayMode = 0; // Default: nothing
    const displayModeIcons = ['⬚', '╋', '⊞', '⬓'];
    const displayModeTitles = ['Nothing', 'Axes', 'Axes + Ground', 'Ground'];

    const updateLayoutButtons = () => {
      layoutH.classList.toggle('active', this.layout === 'horizontal');
      layoutV.classList.toggle('active', this.layout === 'vertical');
      layoutO.classList.toggle('active', this.layout === 'overlay');
      layoutX.classList.toggle('active', this.layout === 'crossview');
    };

    const updateDisplayMode = () => {
      // 0=none, 1=axes, 2=axes+ground, 3=ground
      const showAxes = this._displayMode === 1 || this._displayMode === 2;
      const showGround = this._displayMode === 2 || this._displayMode === 3;

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

    layoutX.addEventListener('click', () => {
      this.layout = 'crossview';
      updateLayoutButtons();
    });

    syncCam.addEventListener('click', () => {
      this._syncCamera = !this._syncCamera;
      syncCam.classList.toggle('active', this._syncCamera);
    });

    displayMode.addEventListener('click', () => {
      this._displayMode = (this._displayMode + 1) % 4;
      updateDisplayMode();
    });

    // Keyboard shortcut for display mode
    this.shadowRoot.host.addEventListener('keydown', (e) => {
      if (e.key === 'g' || e.key === 'G') {
        this._displayMode = (this._displayMode + 1) % 4;
        updateDisplayMode();
      }
    });

    // Set initial state
    if (this._syncCamera) {
      syncCam.classList.add('active');
    }
    updateDisplayMode();
  }

  /**
   * Setup unified mouse/touch input handling for both panes
   */
  _setupUnifiedInput() {
    // Helper to determine which pane an event originated from
    const getPaneFromEvent = (e) => {
      const target = e.target;
      if (this._mayflyPane.contains(target)) return 'mayfly';
      if (this._stinkyfishPane.contains(target)) return 'stinkyfish';
      return null;
    };

    // Mouse handlers
    const handleMouseDown = (e) => {
      const pane = getPaneFromEvent(e);
      if (!pane) return;

      e.preventDefault();
      this._isDragging = true;
      this._activePane = pane;
      this._lastPointer = { x: e.clientX, y: e.clientY };

      // Highlight active pane
      this._mayflyPane.classList.toggle('active', pane === 'mayfly');
      this._stinkyfishPane.classList.toggle('active', pane === 'stinkyfish');
    };

    const handleMouseMove = (e) => {
      if (!this._isDragging) return;

      const dx = e.clientX - this._lastPointer.x;
      const dy = e.clientY - this._lastPointer.y;
      this._lastPointer = { x: e.clientX, y: e.clientY };

      // Update camera rotation
      this._camera.theta += dx * 0.01;
      this._camera.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this._camera.phi + dy * 0.01));

      // Apply to active renderer immediately
      this._applyCameraToActiveRenderer();

      // Schedule sync to other renderer with fade effect
      this._scheduleSyncWithFade();
    };

    const handleMouseUp = () => {
      if (this._isDragging) {
        this._isDragging = false;
        this._mayflyPane.classList.remove('active');
        this._stinkyfishPane.classList.remove('active');
      }
    };

    const handleWheel = (e) => {
      const pane = getPaneFromEvent(e);
      if (!pane) return;

      e.preventDefault();
      this._activePane = pane;

      // Zoom
      this._camera.distance *= 1 + e.deltaY * 0.001;
      this._camera.distance = Math.max(1, Math.min(100, this._camera.distance));

      // Apply to active renderer immediately
      this._applyCameraToActiveRenderer();

      // Schedule sync to other renderer
      this._scheduleSyncWithFade();
    };

    // Touch handlers
    const handleTouchStart = (e) => {
      const pane = getPaneFromEvent(e);
      if (!pane) return;

      e.preventDefault();
      this._activePane = pane;

      if (e.touches.length === 1) {
        // Single touch - drag
        this._isDragging = true;
        this._lastPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        // Two finger - pinch zoom
        this._isDragging = false;
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        this._pinchStartDistance = Math.sqrt(dx * dx + dy * dy);
        this._pinchStartZoom = this._camera.distance;
      }

      // Highlight active pane
      this._mayflyPane.classList.toggle('active', pane === 'mayfly');
      this._stinkyfishPane.classList.toggle('active', pane === 'stinkyfish');
    };

    const handleTouchMove = (e) => {
      if (!this._activePane) return;
      e.preventDefault();

      if (e.touches.length === 1 && this._isDragging) {
        // Single touch drag - rotate
        const dx = e.touches[0].clientX - this._lastPointer.x;
        const dy = e.touches[0].clientY - this._lastPointer.y;
        this._lastPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };

        this._camera.theta += dx * 0.01;
        this._camera.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this._camera.phi + dy * 0.01));
      } else if (e.touches.length === 2) {
        // Pinch zoom
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (this._pinchStartDistance > 0) {
          const scale = this._pinchStartDistance / dist;
          this._camera.distance = Math.max(1, Math.min(100, this._pinchStartZoom * scale));
        }
      }

      // Apply to active renderer immediately
      this._applyCameraToActiveRenderer();

      // Schedule sync to other renderer
      this._scheduleSyncWithFade();
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length === 0) {
        this._isDragging = false;
        this._mayflyPane.classList.remove('active');
        this._stinkyfishPane.classList.remove('active');
      }
    };

    // Attach listeners to both panes
    [this._mayflyPane, this._stinkyfishPane].forEach(pane => {
      pane.addEventListener('mousedown', handleMouseDown);
      pane.addEventListener('wheel', handleWheel, { passive: false });
      pane.addEventListener('touchstart', handleTouchStart, { passive: false });
      pane.addEventListener('touchmove', handleTouchMove, { passive: false });
      pane.addEventListener('touchend', handleTouchEnd);
    });

    // Global mouse events for drag continuation outside panes
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Prevent context menu on panes
    this.shadowRoot.querySelector('.comparison').addEventListener('contextmenu', e => e.preventDefault());
  }

  /**
   * Apply camera state to a specific renderer
   * Both backends use flat properties: cameraTheta, cameraPhi, cameraDistance, cameraTarget
   */
  _applyCameraToRenderer(rendererEl) {
    const renderer = rendererEl?.renderer;
    if (!renderer) return;

    renderer.cameraTheta = this._camera.theta;
    renderer.cameraPhi = this._camera.phi;
    renderer.cameraDistance = this._camera.distance;
    if (this._camera.target) {
      renderer.cameraTarget = [...this._camera.target];
    }
  }

  /**
   * Apply camera to the currently active renderer (no fade)
   */
  _applyCameraToActiveRenderer() {
    if (!this._activePane) return;

    const activeRenderer = this._activePane === 'mayfly'
      ? this._mayflyRenderer
      : this._stinkyfishRenderer;

    this._applyCameraToRenderer(activeRenderer);
  }

  /**
   * Schedule sync to the inactive renderer with fade transition
   */
  _scheduleSyncWithFade() {
    if (!this._syncCamera || !this._activePane) return;

    // Clear existing timeout
    if (this._syncTimeout) {
      clearTimeout(this._syncTimeout);
    }

    // Schedule sync after delay
    this._syncTimeout = setTimeout(() => {
      this._syncOtherRendererWithFade();
    }, this._syncDelay);
  }

  /**
   * Sync the other renderer with fade-out/update/fade-in effect
   */
  async _syncOtherRendererWithFade() {
    if (!this._activePane) return;

    const isActiveStinkyfish = this._activePane === 'stinkyfish';
    const otherRenderer = isActiveStinkyfish ? this._mayflyRenderer : this._stinkyfishRenderer;
    const fadeOverlay = isActiveStinkyfish ? this._fadeMayfly : this._fadeStinkyfish;

    // Fade out (fast)
    fadeOverlay.classList.add('active');

    // Wait for fade out
    await new Promise(r => setTimeout(r, 150));

    // Update camera
    this._applyCameraToRenderer(otherRenderer);

    // Small delay for render to complete
    await new Promise(r => setTimeout(r, 50));

    // Fade in (fast)
    fadeOverlay.classList.remove('active');
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

    // Load scene JSON to extract camera settings
    try {
      const resp = await fetch(`./scenes/${path}`);
      const json = await resp.json();

      // Extract camera from scene JSON
      if (json.camera) {
        this._camera.distance = json.camera.distance || 8;
        this._camera.theta = json.camera.theta || 0.3;
        this._camera.phi = json.camera.phi || 0.4;
        if (json.camera.target) {
          this._camera.target = [...json.camera.target];
        }
      }
    } catch (e) {
      console.warn('Could not pre-load camera from scene:', e);
    }

    // Load in both renderers
    this._mayflyRenderer.scene = path;
    this._stinkyfishRenderer.scene = path;
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

  /**
   * Programmatically set camera for both views
   */
  setCamera(options) {
    if (options.theta !== undefined) this._camera.theta = options.theta;
    if (options.phi !== undefined) this._camera.phi = options.phi;
    if (options.distance !== undefined) this._camera.distance = options.distance;
    if (options.target !== undefined) this._camera.target = [...options.target];

    // Apply to both renderers immediately
    this._applyCameraToRenderer(this._mayflyRenderer);
    this._applyCameraToRenderer(this._stinkyfishRenderer);
  }
}

customElements.define('lucid-comparison', LucidComparison);
