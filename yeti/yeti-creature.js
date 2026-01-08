/**
 * <yeti-creature> Web Component
 *
 * Usage:
 *   <yeti-creature src="animals/dog.json"></yeti-creature>
 *   <yeti-creature src="animals/cat.json" width="400" height="300"></yeti-creature>
 *
 * Attributes:
 *   src     - Path to animal JSON file (relative to component location)
 *   width   - Canvas width (default: 400)
 *   height  - Canvas height (default: 300)
 *   spin    - Auto-rotate speed (default: 0, set to e.g. "0.5" for slow spin)
 */

import { loadJsonScene } from '../lucid/core/json-loader.js';
import { generateGlslFromJson } from '../lucid/core/json-codegen.js';
import { SimpleRaymarcher } from '../lucid/ui/raymarcher.js';

class YetiCreature extends HTMLElement {
  static get observedAttributes() {
    return ['src', 'width', 'height', 'spin'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.raymarcher = null;
    this.quadrupedDef = null;
    this.animationId = null;
  }

  connectedCallback() {
    this.render();
    this.init();
  }

  disconnectedCallback() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal !== newVal && this.shadowRoot.querySelector('canvas')) {
      if (name === 'src') {
        this.loadCreature(newVal);
      } else if (name === 'width' || name === 'height') {
        this.updateSize();
      }
    }
  }

  render() {
    const width = this.getAttribute('width') || 400;
    const height = this.getAttribute('height') || 300;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          position: relative;
        }
        canvas {
          display: block;
          border-radius: 8px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        }
        .status {
          position: absolute;
          bottom: 8px;
          left: 8px;
          font-family: system-ui, sans-serif;
          font-size: 11px;
          color: rgba(255,255,255,0.7);
          background: rgba(0,0,0,0.5);
          padding: 2px 6px;
          border-radius: 4px;
        }
        .status.error {
          color: #ff6b6b;
        }
      </style>
      <canvas width="${width}" height="${height}"></canvas>
      <div class="status">Loading...</div>
    `;
  }

  async init() {
    const canvas = this.shadowRoot.querySelector('canvas');
    const status = this.shadowRoot.querySelector('.status');

    try {
      // Determine base path for loading files
      this.basePath = this.getBasePath();

      // Load shared quadruped definition
      const defUrl = new URL('defs/quadruped.json', this.basePath).href;
      const defResponse = await fetch(defUrl);
      if (!defResponse.ok) throw new Error('Failed to load quadruped.json');
      this.quadrupedDef = await defResponse.json();

      // Initialize raymarcher
      this.raymarcher = new SimpleRaymarcher(canvas);
      this.raymarcher.resize();

      // Setup controls
      this.setupControls(canvas);

      // Load creature if src specified
      const src = this.getAttribute('src');
      if (src) {
        await this.loadCreature(src);
      } else {
        status.textContent = 'No src specified';
      }

      // Start render loop
      this.startRenderLoop();

    } catch (err) {
      status.textContent = err.message;
      status.classList.add('error');
      console.error('[yeti-creature]', err);
    }
  }

  getBasePath() {
    // Get the base path relative to where the component is used
    // This allows the component to work from different locations
    const scriptUrl = import.meta.url;
    return scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1);
  }

  async loadCreature(src) {
    const status = this.shadowRoot.querySelector('.status');

    try {
      status.textContent = 'Loading...';
      status.classList.remove('error');

      // Load animal JSON
      const animalUrl = new URL(src, this.basePath).href;
      const response = await fetch(animalUrl);
      if (!response.ok) throw new Error(`Failed to load ${src}`);
      const animalJson = await response.json();

      // Build scene
      const sceneJson = {
        version: "1.0",
        defs: animalJson.defs || {},
        root: animalJson.root,
        camera: animalJson.camera || { distance: 6, phi: 0.3, theta: 0.25, target: [0, 0, 0] }
      };

      // Merge quadruped def if needed
      if (animalJson.root?.id === 'quadruped' && !sceneJson.defs.quadruped && this.quadrupedDef) {
        sceneJson.defs.quadruped = this.quadrupedDef.quadruped;
      }

      // Process through Lucid
      const scene = loadJsonScene(sceneJson);
      const glsl = generateGlslFromJson(scene);

      // Update raymarcher
      this.raymarcher.updateScene(glsl, {}, null, sceneJson);

      // Apply camera
      if (animalJson.camera) {
        Object.assign(this.raymarcher.camera, {
          distance: animalJson.camera.distance || 6,
          phi: animalJson.camera.phi || 0.3,
          theta: animalJson.camera.theta || 0.25,
          target: animalJson.camera.target || [0, 0, 0]
        });
      }

      status.textContent = `${animalJson.emoji || ''} ${animalJson.name || src}`.trim();

    } catch (err) {
      status.textContent = err.message;
      status.classList.add('error');
      console.error('[yeti-creature]', err);
    }
  }

  setupControls(canvas) {
    let dragging = false;
    let lastX = 0, lastY = 0;

    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!dragging || !this.raymarcher) return;
      const dx = (e.clientX - lastX) * 0.01;
      const dy = (e.clientY - lastY) * 0.01;
      this.raymarcher.camera.theta += dx;
      this.raymarcher.camera.phi = Math.max(0.1, Math.min(Math.PI/2 - 0.1, this.raymarcher.camera.phi - dy));
      lastX = e.clientX;
      lastY = e.clientY;
    });

    canvas.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('pointercancel', () => { dragging = false; });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.raymarcher) return;
      this.raymarcher.camera.distance = Math.max(2, Math.min(20,
        this.raymarcher.camera.distance + e.deltaY * 0.01));
    }, { passive: false });
  }

  updateSize() {
    const canvas = this.shadowRoot.querySelector('canvas');
    if (canvas && this.raymarcher) {
      canvas.width = this.getAttribute('width') || 400;
      canvas.height = this.getAttribute('height') || 300;
      this.raymarcher.resize();
    }
  }

  startRenderLoop() {
    const spin = parseFloat(this.getAttribute('spin')) || 0;

    const render = () => {
      if (this.raymarcher) {
        if (spin) {
          this.raymarcher.camera.theta += spin * 0.01;
        }
        this.raymarcher.render();
      }
      this.animationId = requestAnimationFrame(render);
    };
    render();
  }
}

customElements.define('yeti-creature', YetiCreature);

export { YetiCreature };
