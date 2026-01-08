/**
 * Yeti Creature Web Components
 *
 * Base component + species-specific components with defaults
 *
 * Usage:
 *   <yeti-creature body-radii="0.5,0.4,0.8" color="#8B4513"></yeti-creature>
 *   <yeti-dog></yeti-dog>
 *   <yeti-dog color="white" tail-len="0.3"></yeti-dog>
 *   <yeti-elephant color="pink"></yeti-elephant>
 */

import { loadJsonScene } from '../lucid/core/json-loader.js';
import { generateGlslFromJson } from '../lucid/core/json-codegen.js';
import { SimpleRaymarcher } from '../lucid/ui/raymarcher.js';

// ============================================================
// Species defaults - override quadruped params per species
// ============================================================

const SPECIES_DEFAULTS = {
  dog: {
    name: 'Dog', emoji: '🐕',
    color: [0.65, 0.55, 0.4],
    bodyRadii: [0.5, 0.45, 0.9],
    rumpRadii: [0.45, 0.4, 0.5],
    rumpPos: [0, 0.05, -0.9],
    headRadii: [0.28, 0.26, 0.32],
    headPos: [0, 0.35, 1.1],
    snoutRadii: [0.12, 0.1, 0.28],
    snoutPos: [0, 0.22, 1.45],
    noseSize: 0.06,
    nosePos: [0, 0.22, 1.72],
    earRadii: [0.08, 0.18, 0.06],
    earPos: [0.18, 0.58, 0.95],
    earPosR: [-0.18, 0.58, 0.95],
    earRotate: [0.3, 0, 0.2],
    legThighR: 0.12,
    legAnkleR: 0.06,
    frontLegH: 0.55,
    frontLegPos: [0.22, -0.55, 0.4],
    frontLegPosR: [-0.22, -0.55, 0.4],
    frontLegRot: [0, 0, 0],
    backLegH: 0.6,
    backLegPos: [0.22, -0.55, -0.8],
    backLegPosR: [-0.22, -0.55, -0.8],
    backLegRot: [0.15, 0, 0],
    tailLen: 0.4,
    tailR: 0.05,
    tailPos: [0, 0.3, -1.25],
    tailRot: [-0.6, 0, 0],
    smooth: 0.15
  },

  cat: {
    name: 'Cat', emoji: '🐱',
    color: [0.4, 0.35, 0.3],
    bodyRadii: [0.35, 0.32, 0.7],
    rumpRadii: [0.32, 0.28, 0.4],
    rumpPos: [0, 0.02, -0.7],
    headRadii: [0.22, 0.2, 0.24],
    headPos: [0, 0.28, 0.85],
    snoutRadii: [0.08, 0.06, 0.12],
    snoutPos: [0, 0.2, 1.05],
    noseSize: 0.035,
    nosePos: [0, 0.2, 1.15],
    earRadii: [0.06, 0.12, 0.03],
    earPos: [0.12, 0.48, 0.78],
    earPosR: [-0.12, 0.48, 0.78],
    earRotate: [0.2, 0, 0.4],
    legThighR: 0.08,
    legAnkleR: 0.04,
    frontLegH: 0.45,
    frontLegPos: [0.15, -0.42, 0.3],
    frontLegPosR: [-0.15, -0.42, 0.3],
    frontLegRot: [0, 0, 0],
    backLegH: 0.5,
    backLegPos: [0.15, -0.42, -0.6],
    backLegPosR: [-0.15, -0.42, -0.6],
    backLegRot: [0.1, 0, 0],
    tailLen: 0.6,
    tailR: 0.035,
    tailPos: [0, 0.2, -1.0],
    tailRot: [-0.8, 0, 0],
    smooth: 0.12
  },

  elephant: {
    name: 'Elephant', emoji: '🐘',
    color: [0.55, 0.52, 0.5],
    bodyRadii: [0.9, 0.85, 1.2],
    rumpRadii: [0.85, 0.8, 0.7],
    rumpPos: [0, 0, -1.1],
    headRadii: [0.5, 0.48, 0.45],
    headPos: [0, 0.3, 1.4],
    snoutRadii: [0.12, 0.1, 0.5],  // trunk base
    snoutPos: [0, -0.1, 1.9],
    noseSize: 0.08,
    nosePos: [0, -0.3, 2.3],
    earRadii: [0.5, 0.6, 0.08],   // big flat ears
    earPos: [0.55, 0.35, 1.2],
    earPosR: [-0.55, 0.35, 1.2],
    earRotate: [0, 0.3, 0],
    legThighR: 0.25,
    legAnkleR: 0.2,
    frontLegH: 0.9,
    frontLegPos: [0.45, -1.0, 0.5],
    frontLegPosR: [-0.45, -1.0, 0.5],
    frontLegRot: [0, 0, 0],
    backLegH: 0.85,
    backLegPos: [0.45, -0.95, -0.9],
    backLegPosR: [-0.45, -0.95, -0.9],
    backLegRot: [0.05, 0, 0],
    tailLen: 0.5,
    tailR: 0.06,
    tailPos: [0, 0.1, -1.7],
    tailRot: [-0.2, 0, 0],
    smooth: 0.25
  },

  horse: {
    name: 'Horse', emoji: '🐴',
    color: [0.45, 0.3, 0.2],
    bodyRadii: [0.55, 0.5, 1.1],
    rumpRadii: [0.5, 0.55, 0.6],
    rumpPos: [0, 0.05, -1.0],
    headRadii: [0.2, 0.22, 0.4],
    headPos: [0, 0.6, 1.3],
    snoutRadii: [0.12, 0.1, 0.25],
    snoutPos: [0, 0.45, 1.7],
    noseSize: 0.06,
    nosePos: [0, 0.42, 1.92],
    earRadii: [0.05, 0.12, 0.04],
    earPos: [0.1, 0.85, 1.15],
    earPosR: [-0.1, 0.85, 1.15],
    earRotate: [0.3, 0, 0.1],
    legThighR: 0.12,
    legAnkleR: 0.08,
    frontLegH: 0.85,
    frontLegPos: [0.25, -0.9, 0.5],
    frontLegPosR: [-0.25, -0.9, 0.5],
    frontLegRot: [0, 0, 0],
    backLegH: 0.9,
    backLegPos: [0.25, -0.95, -0.85],
    backLegPosR: [-0.25, -0.95, -0.85],
    backLegRot: [0.1, 0, 0],
    tailLen: 0.7,
    tailR: 0.08,
    tailPos: [0, 0.35, -1.5],
    tailRot: [-0.4, 0, 0],
    smooth: 0.18
  }
};

// ============================================================
// Param parsing utilities
// ============================================================

function parseColor(value) {
  if (!value) return null;

  // Handle hex colors
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    return [r, g, b];
  }

  // Handle named colors
  const named = {
    pink: [1.0, 0.75, 0.8],
    white: [0.95, 0.95, 0.95],
    black: [0.1, 0.1, 0.1],
    brown: [0.55, 0.35, 0.2],
    grey: [0.5, 0.5, 0.5],
    gray: [0.5, 0.5, 0.5],
    golden: [0.85, 0.65, 0.3],
    cream: [0.95, 0.9, 0.8],
    orange: [0.9, 0.5, 0.2],
    spotted: [0.9, 0.85, 0.8]  // base for spotted pattern
  };
  if (named[value.toLowerCase()]) {
    return named[value.toLowerCase()];
  }

  // Handle "r,g,b" format (0-1 range)
  if (value.includes(',')) {
    return value.split(',').map(v => parseFloat(v.trim()));
  }

  return null;
}

function parseVec3(value) {
  if (!value) return null;
  return value.split(',').map(v => parseFloat(v.trim()));
}

function parseNumber(value) {
  if (!value) return null;
  return parseFloat(value);
}

// Convert kebab-case attribute to camelCase param name
function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// ============================================================
// Base YetiCreature class
// ============================================================

class YetiCreature extends HTMLElement {
  static get observedAttributes() {
    return [
      'width', 'height', 'spin',
      // Quadruped params (kebab-case)
      'color', 'smooth',
      'body-radii', 'rump-radii', 'rump-pos',
      'head-radii', 'head-pos',
      'snout-radii', 'snout-pos',
      'nose-size', 'nose-pos',
      'ear-radii', 'ear-pos', 'ear-pos-r', 'ear-rotate',
      'leg-thigh-r', 'leg-ankle-r',
      'front-leg-h', 'front-leg-pos', 'front-leg-pos-r', 'front-leg-rot',
      'back-leg-h', 'back-leg-pos', 'back-leg-pos-r', 'back-leg-rot',
      'tail-len', 'tail-r', 'tail-pos', 'tail-rot'
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.raymarcher = null;
    this.quadrupedDef = null;
    this.animationId = null;
    this._species = null;  // Set by subclasses
  }

  // Override in subclasses to set species
  get species() {
    return this._species || 'dog';
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
    if (oldVal !== newVal && this.raymarcher) {
      this.updateCreature();
    }
  }

  render() {
    const width = this.getAttribute('width') || 400;
    const height = this.getAttribute('height') || 300;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-block; position: relative; }
        canvas {
          display: block;
          border-radius: 8px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        }
        .label {
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
      </style>
      <canvas width="${width}" height="${height}"></canvas>
      <div class="label"></div>
    `;
  }

  async init() {
    const canvas = this.shadowRoot.querySelector('canvas');
    const label = this.shadowRoot.querySelector('.label');

    try {
      // Load quadruped definition
      const basePath = import.meta.url.substring(0, import.meta.url.lastIndexOf('/') + 1);
      const defUrl = new URL('defs/quadruped.json', basePath).href;
      const response = await fetch(defUrl);
      if (!response.ok) throw new Error('Failed to load quadruped.json');
      this.quadrupedDef = await response.json();

      // Initialize raymarcher
      this.raymarcher = new SimpleRaymarcher(canvas);
      this.raymarcher.resize();
      this.setupControls(canvas);

      // Build and render creature
      await this.updateCreature();

      // Update label
      const defaults = SPECIES_DEFAULTS[this.species] || SPECIES_DEFAULTS.dog;
      label.textContent = `${defaults.emoji} ${defaults.name}`;

      // Start render loop
      this.startRenderLoop();

    } catch (err) {
      label.textContent = err.message;
      console.error('[yeti-creature]', err);
    }
  }

  // Build params from species defaults + attribute overrides
  buildParams() {
    const defaults = SPECIES_DEFAULTS[this.species] || SPECIES_DEFAULTS.dog;
    const params = { ...defaults };

    // Override with attributes
    for (const attr of this.getAttributeNames()) {
      const value = this.getAttribute(attr);
      if (!value) continue;

      const paramName = kebabToCamel(attr);

      // Special handling for color
      if (attr === 'color') {
        const parsed = parseColor(value);
        if (parsed) params.color = parsed;
        continue;
      }

      // Vec3 params
      if (paramName.endsWith('Radii') || paramName.endsWith('Pos') ||
          paramName.endsWith('PosR') || paramName.endsWith('Rot') ||
          paramName === 'earRotate' || paramName === 'frontLegRot' ||
          paramName === 'backLegRot' || paramName === 'tailRot') {
        const parsed = parseVec3(value);
        if (parsed) params[paramName] = parsed;
        continue;
      }

      // Number params
      const numParams = ['smooth', 'noseSize', 'legThighR', 'legAnkleR',
                         'frontLegH', 'backLegH', 'tailLen', 'tailR'];
      if (numParams.includes(paramName)) {
        const parsed = parseNumber(value);
        if (parsed !== null) params[paramName] = parsed;
      }
    }

    return params;
  }

  async updateCreature() {
    if (!this.raymarcher || !this.quadrupedDef) return;

    const params = this.buildParams();

    const sceneJson = {
      version: "1.0",
      defs: { quadruped: this.quadrupedDef.quadruped },
      root: { type: "ref", id: "quadruped", params },
      camera: { distance: 6, phi: 0.3, theta: 0.25, target: [0, 0, 0] }
    };

    // Adjust camera for larger animals
    if (this.species === 'elephant') {
      sceneJson.camera.distance = 10;
    } else if (this.species === 'horse') {
      sceneJson.camera.distance = 8;
    }

    const scene = loadJsonScene(sceneJson);
    const glsl = generateGlslFromJson(scene);
    this.raymarcher.updateScene(glsl, {}, null, sceneJson);

    Object.assign(this.raymarcher.camera, sceneJson.camera);
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

  startRenderLoop() {
    const spin = parseFloat(this.getAttribute('spin')) || 0;

    const render = () => {
      if (this.raymarcher) {
        if (spin) this.raymarcher.camera.theta += spin * 0.01;
        this.raymarcher.render();
      }
      this.animationId = requestAnimationFrame(render);
    };
    render();
  }
}

// ============================================================
// Species-specific components
// ============================================================

class YetiDog extends YetiCreature {
  get species() { return 'dog'; }
}

class YetiCat extends YetiCreature {
  get species() { return 'cat'; }
}

class YetiElephant extends YetiCreature {
  get species() { return 'elephant'; }
}

class YetiHorse extends YetiCreature {
  get species() { return 'horse'; }
}

// ============================================================
// Register all components
// ============================================================

customElements.define('yeti-creature', YetiCreature);
customElements.define('yeti-dog', YetiDog);
customElements.define('yeti-cat', YetiCat);
customElements.define('yeti-elephant', YetiElephant);
customElements.define('yeti-horse', YetiHorse);

export { YetiCreature, YetiDog, YetiCat, YetiElephant, YetiHorse, SPECIES_DEFAULTS };
