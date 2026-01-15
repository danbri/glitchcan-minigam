/**
 * <lucid-orbit-controls> - Unified orbit camera controls
 *
 * Provides standardized mouse and touch orbit controls for 3D renderers.
 * Wraps any element with camera controls, dispatching events for camera updates.
 *
 * Usage:
 *   <lucid-orbit-controls target="#my-renderer">
 *     <canvas id="my-renderer"></canvas>
 *   </lucid-orbit-controls>
 *
 * Attributes:
 *   - target: Selector or element reference for the renderer
 *   - distance: Initial camera distance (default: 4)
 *   - min-distance: Minimum zoom distance (default: 1)
 *   - max-distance: Maximum zoom distance (default: 15)
 *   - orbit-speed: Rotation sensitivity (default: 0.01)
 *   - zoom-speed: Zoom sensitivity (default: 0.001)
 *   - enable-ground-fade: Fade ground during drag (default: false)
 *
 * Events:
 *   - camera-change: Fired when camera position changes
 *   - drag-start: Fired when dragging begins
 *   - drag-end: Fired when dragging ends
 *
 * Camera API:
 *   - getCamera(): Returns { theta, phi, distance, target }
 *   - setCamera(options): Sets camera position { theta?, phi?, distance?, target? }
 */

export class LucidOrbitControls extends HTMLElement {
  static get observedAttributes() {
    return ['distance', 'min-distance', 'max-distance', 'orbit-speed', 'zoom-speed'];
  }

  constructor() {
    super();

    // Camera state
    this._camera = {
      theta: 0,           // Horizontal angle
      phi: Math.PI / 4,   // Vertical angle (45 degrees)
      distance: 4,
      target: [0, 0, 0]
    };

    // Configuration
    this._config = {
      minDistance: 1,
      maxDistance: 15,
      orbitSpeed: 0.01,
      zoomSpeed: 0.001,
      enableGroundFade: false
    };

    // Interaction state
    this._isDragging = false;
    this._lastMouse = { x: 0, y: 0 };
    this._activeTouches = 0;
    this._pinchStartDist = 0;
    this._pinchCenterX = 0;
    this._pinchCenterY = 0;
    this._touchStartPos = { x: 0, y: 0 };
  }

  connectedCallback() {
    this._setupListeners();
  }

  disconnectedCallback() {
    this._removeListeners();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'distance':
        this._camera.distance = parseFloat(newValue) || 4;
        break;
      case 'min-distance':
        this._config.minDistance = parseFloat(newValue) || 1;
        break;
      case 'max-distance':
        this._config.maxDistance = parseFloat(newValue) || 15;
        break;
      case 'orbit-speed':
        this._config.orbitSpeed = parseFloat(newValue) || 0.01;
        break;
      case 'zoom-speed':
        this._config.zoomSpeed = parseFloat(newValue) || 0.001;
        break;
    }
  }

  // Public API

  getCamera() {
    return { ...this._camera };
  }

  setCamera(options) {
    if (options.theta !== undefined) this._camera.theta = options.theta;
    if (options.phi !== undefined) this._camera.phi = options.phi;
    if (options.distance !== undefined) this._camera.distance = options.distance;
    if (options.target !== undefined) this._camera.target = [...options.target];
    this._emitCameraChange();
  }

  get isDragging() {
    return this._isDragging;
  }

  // Internal methods

  _setupListeners() {
    // Bind handlers for removal later
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onWheel = this._handleWheel.bind(this);
    this._onTouchStart = this._handleTouchStart.bind(this);
    this._onTouchMove = this._handleTouchMove.bind(this);
    this._onTouchEnd = this._handleTouchEnd.bind(this);
    this._onContextMenu = (e) => e.preventDefault();

    // Add listeners to this element (wrapper)
    this.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
    this.addEventListener('wheel', this._onWheel, { passive: false });
    this.addEventListener('touchstart', this._onTouchStart, { passive: false });
    this.addEventListener('touchmove', this._onTouchMove, { passive: false });
    this.addEventListener('touchend', this._onTouchEnd);
    this.addEventListener('contextmenu', this._onContextMenu);

    // Set cursor
    this.style.cursor = 'grab';
    this.style.touchAction = 'none';
  }

  _removeListeners() {
    this.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    this.removeEventListener('wheel', this._onWheel);
    this.removeEventListener('touchstart', this._onTouchStart);
    this.removeEventListener('touchmove', this._onTouchMove);
    this.removeEventListener('touchend', this._onTouchEnd);
    this.removeEventListener('contextmenu', this._onContextMenu);
  }

  // Mouse handlers

  _handleMouseDown(e) {
    e.preventDefault();
    this._isDragging = true;
    this._lastMouse = { x: e.clientX, y: e.clientY };
    this.style.cursor = 'grabbing';
    this._emitDragStart();
  }

  _handleMouseMove(e) {
    if (!this._isDragging) return;
    e.preventDefault();

    const dx = e.clientX - this._lastMouse.x;
    const dy = e.clientY - this._lastMouse.y;
    this._lastMouse = { x: e.clientX, y: e.clientY };

    this._camera.theta += dx * this._config.orbitSpeed;
    this._camera.phi = Math.max(0.1, Math.min(Math.PI - 0.1,
      this._camera.phi - dy * this._config.orbitSpeed));

    this._emitCameraChange();
  }

  _handleMouseUp(e) {
    if (!this._isDragging) return;
    this._isDragging = false;
    this.style.cursor = 'grab';
    this._emitDragEnd();
  }

  _handleWheel(e) {
    e.preventDefault();

    const delta = e.deltaY * this._config.zoomSpeed * this._camera.distance;
    this._camera.distance = Math.max(this._config.minDistance,
      Math.min(this._config.maxDistance, this._camera.distance + delta));

    this._emitCameraChange();
  }

  // Touch handlers

  _handleTouchStart(e) {
    e.preventDefault();
    this._activeTouches = e.touches.length;

    const touch = e.touches[0];
    this._touchStartPos = { x: touch.clientX, y: touch.clientY };
    this._lastMouse = { x: touch.clientX, y: touch.clientY };

    if (e.touches.length === 2) {
      // Pinch zoom setup
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this._pinchStartDist = Math.sqrt(dx * dx + dy * dy);
      this._pinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      this._pinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    } else {
      this._isDragging = true;
      this._emitDragStart();
    }
  }

  _handleTouchMove(e) {
    e.preventDefault();

    if (e.touches.length === 2) {
      // Two-finger: pinch zoom + pan
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Calculate center movement for panning
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const panDx = centerX - this._pinchCenterX;
      const panDy = centerY - this._pinchCenterY;

      // Pan camera target
      const panScale = 0.003 * this._camera.distance;
      const cosTheta = Math.cos(this._camera.theta);
      const sinTheta = Math.sin(this._camera.theta);

      this._camera.target[0] -= (panDx * cosTheta) * panScale;
      this._camera.target[2] -= (panDx * sinTheta) * panScale;
      this._camera.target[1] += panDy * panScale;

      // Update tracking
      this._pinchCenterX = centerX;
      this._pinchCenterY = centerY;

      // Zoom based on pinch distance change
      const scale = this._pinchStartDist / dist;
      this._camera.distance = Math.max(this._config.minDistance,
        Math.min(this._config.maxDistance, this._camera.distance * scale));
      this._pinchStartDist = dist;

      this._emitCameraChange();
      return;
    }

    // Single touch - orbit
    if (e.touches.length === 1 && this._isDragging) {
      const touch = e.touches[0];
      const dx = touch.clientX - this._lastMouse.x;
      const dy = touch.clientY - this._lastMouse.y;

      this._camera.theta += dx * this._config.orbitSpeed * 0.5;
      this._camera.phi = Math.max(0.1, Math.min(Math.PI - 0.1,
        this._camera.phi - dy * this._config.orbitSpeed * 0.5));

      this._lastMouse = { x: touch.clientX, y: touch.clientY };
      this._emitCameraChange();
    }
  }

  _handleTouchEnd(e) {
    this._activeTouches = e.touches.length;

    if (this._activeTouches === 0 && this._isDragging) {
      this._isDragging = false;
      this._emitDragEnd();
    }
  }

  // Event emitters

  _emitCameraChange() {
    this.dispatchEvent(new CustomEvent('camera-change', {
      detail: this.getCamera(),
      bubbles: true
    }));
  }

  _emitDragStart() {
    this.dispatchEvent(new CustomEvent('drag-start', {
      bubbles: true
    }));
  }

  _emitDragEnd() {
    this.dispatchEvent(new CustomEvent('drag-end', {
      bubbles: true
    }));
  }

  /**
   * Calculate camera position from spherical coordinates
   * @returns {number[]} [x, y, z] camera position
   */
  getCameraPosition() {
    const { distance, theta, phi, target } = this._camera;
    return [
      target[0] + distance * Math.sin(phi) * Math.sin(theta),
      target[1] + distance * Math.cos(phi),
      target[2] + distance * Math.sin(phi) * Math.cos(theta)
    ];
  }
}

customElements.define('lucid-orbit-controls', LucidOrbitControls);
