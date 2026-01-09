/**
 * Yeti Creature Web Components
 *
 * Separate canvases (default):
 *   <yeti-scene>
 *     <yeti-dog></yeti-dog>
 *     <yeti-cat></yeti-cat>
 *   </yeti-scene>
 *
 * Shared 3D scene:
 *   <yeti-scene mode="shared" width="800" height="400">
 *     <yeti-dog pos="-3,0,0"></yeti-dog>
 *     <yeti-cat pos="0,0,0"></yeti-cat>
 *     <yeti-elephant pos="4,0,0" color="pink"></yeti-elephant>
 *   </yeti-scene>
 */

import { loadJsonScene } from '../lucid/core/json-loader.js';
import { generateGlslFromJson } from '../lucid/core/json-codegen.js';
import { SimpleRaymarcher } from '../lucid/ui/raymarcher.js';
import { PhysicsScene } from '../lucid/core/physics/physics-scene.js';

// ============================================================
// Species defaults
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
    snoutRadii: [0.12, 0.1, 0.5],
    snoutPos: [0, -0.1, 1.9],
    noseSize: 0.08,
    nosePos: [0, -0.3, 2.3],
    earRadii: [0.5, 0.6, 0.08],
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
// Utilities
// ============================================================

function parseColor(value) {
  if (!value) return null;
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255
    ];
  }
  const named = {
    pink: [1.0, 0.75, 0.8], white: [0.95, 0.95, 0.95], black: [0.1, 0.1, 0.1],
    brown: [0.55, 0.35, 0.2], grey: [0.5, 0.5, 0.5], gray: [0.5, 0.5, 0.5],
    golden: [0.85, 0.65, 0.3], cream: [0.95, 0.9, 0.8], orange: [0.9, 0.5, 0.2],
    // Candy colors
    lime: [0.5, 1.0, 0.3], cyan: [0.3, 0.9, 1.0], yellow: [1.0, 0.95, 0.3],
    magenta: [1.0, 0.3, 0.8], red: [1.0, 0.3, 0.3], green: [0.3, 0.8, 0.4],
    blue: [0.3, 0.5, 1.0], purple: [0.7, 0.3, 0.9], teal: [0.3, 0.8, 0.8]
  };
  if (named[value.toLowerCase()]) return named[value.toLowerCase()];
  if (value.includes(',')) return value.split(',').map(v => parseFloat(v.trim()));
  return null;
}

function parseVec3(value) {
  if (!value) return null;
  return value.split(',').map(v => parseFloat(v.trim()));
}

function parseNumber(value) {
  return value ? parseFloat(value) : null;
}

function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function getBasePath() {
  return import.meta.url.substring(0, import.meta.url.lastIndexOf('/') + 1);
}

// ============================================================
// YetiScene - Container (shared or separate mode)
// ============================================================

class YetiScene extends HTMLElement {
  static get observedAttributes() {
    return ['mode', 'width', 'height', 'spin', 'arena-size', 'ball-colors'];
  }

  constructor() {
    super();
    this.quadrupedDef = null;
    this._ready = null;
    this.raymarcher = null;
    this.animationId = null;
    this.balls = []; // For physics mode
    this.lastPhysicsTime = 0;
    this.physicsScene = null; // PhysicsScene for physics mode (not PhysicsBridge)
  }

  get isShared() {
    return this.getAttribute('mode') === 'shared';
  }

  get isPhysics() {
    return this.getAttribute('mode') === 'physics';
  }

  connectedCallback() {
    this._ready = this.loadDef();
    if (this.isPhysics) {
      this.initPhysicsMode();
    } else if (this.isShared) {
      this.initSharedMode();
    }
  }

  disconnectedCallback() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this._resizeObserver) this._resizeObserver.disconnect();
  }

  async loadDef() {
    try {
      const defUrl = new URL('defs/quadruped.json', getBasePath()).href;
      const response = await fetch(defUrl);
      if (!response.ok) throw new Error('Failed to load quadruped.json');
      this.quadrupedDef = await response.json();
      this.dispatchEvent(new CustomEvent('yeti-def-ready', { bubbles: false }));

      // If shared mode, build combined scene after def loads
      if (this.isShared && this.raymarcher) {
        this.updateSharedScene();
      }
    } catch (err) {
      console.error('[yeti-scene]', err);
    }
  }

  async ready() {
    await this._ready;
    return this.quadrupedDef;
  }

  initSharedMode() {
    const attrWidth = this.getAttribute('width');
    const attrHeight = this.getAttribute('height');

    // Create shadow DOM with canvas
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; position: relative; width: 100%; }
        canvas {
          display: block;
          width: 100%;
          max-width: 100%;
          border-radius: 8px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          touch-action: none;
        }
        .label { position: absolute; bottom: 8px; left: 8px; font-family: system-ui, sans-serif; font-size: 12px; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 4px; }
        ::slotted(*) { display: none; }
      </style>
      <canvas></canvas>
      <div class="label"></div>
      <slot></slot>
    `;

    // Size canvas to container, maintaining aspect ratio
    const canvas = this.shadowRoot.querySelector('canvas');
    const containerWidth = this.clientWidth || parseInt(attrWidth) || 800;
    const aspectRatio = (parseInt(attrHeight) || 400) / (parseInt(attrWidth) || 800);
    canvas.width = containerWidth;
    canvas.height = Math.round(containerWidth * aspectRatio);

    try {
      this.raymarcher = new SimpleRaymarcher(canvas);
    } catch (err) {
      console.error('[yeti-scene] Raymarcher creation failed:', err?.message);
      return;
    }
    this.raymarcher.resize();
    this.setupControls(canvas);

    // Handle resize (orientation change, window resize)
    this._resizeObserver = new ResizeObserver(() => {
      const newWidth = this.clientWidth;
      if (newWidth > 0 && newWidth !== canvas.width) {
        canvas.width = newWidth;
        canvas.height = Math.round(newWidth * aspectRatio);
        this.raymarcher.resize();
      }
    });
    this._resizeObserver.observe(this);

    // Wait for def to load, then build scene
    this._ready.then(() => {
      if (this.quadrupedDef) this.updateSharedScene();
    });

    this.startRenderLoop();
  }

  // Physics mode - creatures slide around in an arena with bouncing balls
  initPhysicsMode() {
    const attrWidth = this.getAttribute('width');
    const attrHeight = this.getAttribute('height');

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; position: relative; width: 100%; }
        canvas {
          display: block;
          width: 100%;
          max-width: 100%;
          border-radius: 8px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          touch-action: none;
        }
        .controls { position: absolute; top: 8px; right: 8px; display: flex; gap: 8px; align-items: center; }
        .controls button {
          background: rgba(255,255,255,0.2);
          border: none;
          border-radius: 50%;
          width: 44px;
          height: 44px;
          font-size: 20px;
          cursor: pointer;
          touch-action: manipulation;
        }
        .controls button:active { background: rgba(255,255,255,0.4); }
        .throw-panel {
          display: flex;
          gap: 4px;
          align-items: center;
          background: rgba(0,0,0,0.5);
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 16px;
        }
        .throw-panel select {
          font-size: 16px;
          background: rgba(255,255,255,0.2);
          border: none;
          border-radius: 4px;
          padding: 4px;
          color: white;
          cursor: pointer;
        }
        .throw-panel button {
          width: auto;
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 14px;
        }
        .label { position: absolute; bottom: 8px; left: 8px; font-family: system-ui, sans-serif; font-size: 12px; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 4px; }
        ::slotted(*) { display: none; }
      </style>
      <canvas></canvas>
      <div class="controls">
        <div class="throw-panel">
          <select class="from-select" title="Thrower"></select>
          <span>➡️</span>
          <select class="to-select" title="Target"></select>
          <button class="throw-btn" title="Throw!">🚀</button>
        </div>
        <button class="shoot-btn" title="Shoot ball">🎾</button>
      </div>
      <div class="label"></div>
      <slot></slot>
    `;

    const canvas = this.shadowRoot.querySelector('canvas');
    const containerWidth = this.clientWidth || parseInt(attrWidth) || 800;
    const aspectRatio = (parseInt(attrHeight) || 500) / (parseInt(attrWidth) || 800);
    canvas.width = containerWidth;
    canvas.height = Math.round(containerWidth * aspectRatio);

    try {
      this.raymarcher = new SimpleRaymarcher(canvas);
      // Use low quality for physics mode - complex quadruped SDFs are heavy
      this.raymarcher.setQuality('low');
    } catch (err) {
      console.error('[yeti-scene physics] Raymarcher creation failed:', err?.message);
      return;
    }
    this.raymarcher.resize();
    this.setupControls(canvas);

    // Ball shooting button
    const shootBtn = this.shadowRoot.querySelector('.shoot-btn');
    shootBtn.addEventListener('click', () => this.shootBall());

    // Throw button
    const throwBtn = this.shadowRoot.querySelector('.throw-btn');
    throwBtn.addEventListener('click', () => {
      const fromSelect = this.shadowRoot.querySelector('.from-select');
      const toSelect = this.shadowRoot.querySelector('.to-select');
      const fromIdx = parseInt(fromSelect.value);
      const toIdx = parseInt(toSelect.value);
      if (fromIdx !== toIdx) {
        this.throwCreatureAt(fromIdx, toIdx);
      }
    });

    // ResizeObserver for orientation changes
    this._resizeObserver = new ResizeObserver(() => {
      const newWidth = this.clientWidth;
      if (newWidth > 0 && newWidth !== canvas.width) {
        canvas.width = newWidth;
        canvas.height = Math.round(newWidth * aspectRatio);
        this.raymarcher.resize();
      }
    });
    this._resizeObserver.observe(this);

    // Build physics scene after def loads
    this._ready.then(() => {
      if (this.quadrupedDef) {
        this.buildPhysicsScene();
        this.populateThrowSelects();
      }
    });

    this.startPhysicsRenderLoop();
  }

  // Build scene with physics bodies for creatures and balls
  buildPhysicsScene() {
    if (!this.quadrupedDef || !this.raymarcher) return;

    const creatures = this.querySelectorAll('yeti-dog, yeti-cat, yeti-horse, yeti-elephant, yeti-creature');
    const arenaSize = parseNumber(this.getAttribute('arena-size')) || 8;
    const wallHeight = 1.5;
    const groundY = -1.5;

    // Candy ball colors - filter out any nulls from unrecognized color names
    const ballColorStr = this.getAttribute('ball-colors') || 'pink,lime,cyan,yellow,orange';
    this.ballColors = ballColorStr.split(',')
      .map(c => parseColor(c.trim()))
      .filter(c => c !== null);

    // Fallback if all colors failed
    if (this.ballColors.length === 0) {
      this.ballColors = [[1, 0.75, 0.8], [0.5, 1, 0.3], [0.3, 0.9, 1]];
    }

    // Physics bodies: creatures + initial balls
    const bodies = [];
    const children = [];
    const labels = [];

    // Add creatures as physics bodies
    creatures.forEach((el, i) => {
      const species = el.species || 'dog';
      const defaults = SPECIES_DEFAULTS[species] || SPECIES_DEFAULTS.dog;
      // Filter name/emoji from defaults if buildParams isn't available
      const { name, emoji, ...sdfDefaults } = defaults;
      const params = el.buildParams ? el.buildParams() : { ...sdfDefaults };
      const pos = parseVec3(el.getAttribute('pos')) || [i * 3 - (creatures.length - 1) * 1.5, 0, 0];
      const mass = species === 'elephant' ? 5 : (species === 'horse' ? 3 : 1.5);

      labels.push(defaults.emoji);

      // Physics body for this creature
      bodies.push({
        name: `creature${i}`,
        pos: [pos[0], pos[1] + 0.5, pos[2]],
        mass,
        radius: species === 'elephant' ? 1.2 : 0.8,
        restitution: 0.5
      });

      // SDF node with physics-driven position + bounding sphere for perf
      const varName = `phys_creature${i}`;
      const boundingRadius = species === 'elephant' ? 3.0 : 2.0;
      children.push({
        type: "ref",
        id: "quadruped",
        params,
        boundingRadius,  // LCD-049: skip expensive 12-primitive SDF when ray is far
        transform: { translate: { "var": varName } }
      });
    });

    // Add some initial balls
    for (let i = 0; i < 3; i++) {
      const ballId = `ball${i}`;
      const color = this.ballColors[i % this.ballColors.length];
      bodies.push({
        name: ballId,
        pos: [(Math.random() - 0.5) * 4, 3 + i, (Math.random() - 0.5) * 4],
        mass: 0.3,
        radius: 0.3,
        restitution: 0.9
      });
      children.push({
        type: "sphere",
        params: { r: 0.3, color },
        transform: { translate: { "var": `phys_${ballId}` } }
      });
      this.balls.push({ id: ballId, color });
    }

    // Arena walls (static geometry - not physics bodies)
    const wallColor = [0.3, 0.3, 0.35];
    const groundColor = [0.25, 0.35, 0.25];
    const half = arenaSize / 2;

    // Ground
    children.push({
      type: "box",
      params: { size: [arenaSize, 0.3, arenaSize], color: groundColor },
      transform: { translate: [0, groundY - 0.15, 0] }
    });

    // Walls
    children.push({ type: "box", params: { size: [0.2, wallHeight, arenaSize], color: wallColor }, transform: { translate: [-half - 0.1, groundY + wallHeight/2, 0] } });
    children.push({ type: "box", params: { size: [0.2, wallHeight, arenaSize], color: wallColor }, transform: { translate: [half + 0.1, groundY + wallHeight/2, 0] } });
    children.push({ type: "box", params: { size: [arenaSize, wallHeight, 0.2], color: wallColor }, transform: { translate: [0, groundY + wallHeight/2, -half - 0.1] } });
    children.push({ type: "box", params: { size: [arenaSize, wallHeight, 0.2], color: wallColor }, transform: { translate: [0, groundY + wallHeight/2, half + 0.1] } });

    // Build complete scene JSON with physics
    // Using PhysicsScene (same as Lucid's main app and bouncing-balls demo)
    const sceneJson = {
      version: "1.0",
      defs: { quadruped: this.quadrupedDef.quadruped },
      root: { type: "union", children },
      camera: { distance: 10, phi: 0.4, theta: 0.3, target: [0, -0.5, 0] },
      physics: {
        enabled: true,
        gravity: [0, -12, 0],
        groundY,
        damping: 0.98,
        bounds: { minX: -half, maxX: half, minZ: -half, maxZ: half },
        bodies
      }
    };

    this.sceneJson = sceneJson;
    this.arenaSize = arenaSize;

    try {
      const scene = loadJsonScene(sceneJson);
      const glsl = generateGlslFromJson(scene);

      // Update scene WITHOUT physics enabled in raymarcher (we handle physics ourselves)
      // Pass sceneJson with physics.enabled = false to prevent raymarcher from using PhysicsBridge
      const sceneJsonNoPhysics = { ...sceneJson, physics: { enabled: false } };
      this.raymarcher.updateScene(glsl, {}, null, sceneJsonNoPhysics);
      Object.assign(this.raymarcher.camera, sceneJson.camera);

      // Create PhysicsScene for proper bounds/collision handling
      // (same approach as Lucid's main app and bouncing-balls demo)
      this.physicsScene = new PhysicsScene(sceneJson);
      console.log(`[yeti-scene] PhysicsScene: ${this.physicsScene.bodies.length} bodies, bounds: ${JSON.stringify(this.physicsScene.bounds)}`);

      const label = this.shadowRoot.querySelector('.label');
      label.textContent = `${labels.join(' ')} 🎾×${this.balls.length}`;
    } catch (err) {
      console.error('[yeti-scene physics] Error:', err?.message || err);
      console.error('[yeti-scene physics] Stack:', err?.stack);
    }
  }

  // Shoot a ball - recycles existing balls by repositioning them
  shootBall() {
    if (!this.physicsScene) {
      console.log('[yeti-scene] Physics not ready yet');
      return;
    }

    const half = this.arenaSize / 2;
    // Random position above arena
    const pos = [(Math.random() - 0.5) * half, 5, (Math.random() - 0.5) * half];
    // Random downward velocity with some horizontal component
    const vel = [(Math.random() - 0.5) * 3, -2, (Math.random() - 0.5) * 3];

    // Recycle: pick a ball to reposition (round-robin)
    this.nextBallIndex = (this.nextBallIndex || 0) % 3;
    const ballId = `ball${this.nextBallIndex}`;
    this.nextBallIndex++;

    // Find the ball body and reset its position/velocity
    const body = this.physicsScene.bodies.find(b => b.id === ballId);
    if (body) {
      body.position[0] = pos[0];
      body.position[1] = pos[1];
      body.position[2] = pos[2];
      body.velocity[0] = vel[0];
      body.velocity[1] = vel[1];
      body.velocity[2] = vel[2];
      console.log(`[yeti-scene] Recycled ${ballId} to [${pos.map(v => v.toFixed(1)).join(',')}]`);
    }
  }

  // Throw one creature at another - applies impulse toward target
  throwCreatureAt(fromIndex, toIndex) {
    if (!this.physicsScene) return;

    const fromBody = this.physicsScene.bodies.find(b => b.id === `creature${fromIndex}`);
    const toBody = this.physicsScene.bodies.find(b => b.id === `creature${toIndex}`);

    if (!fromBody || !toBody) {
      console.log('[yeti-scene] Invalid creature indices');
      return;
    }

    // Direction from thrower to target
    const dx = toBody.position[0] - fromBody.position[0];
    const dz = toBody.position[2] - fromBody.position[2];
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;

    // Impulse strength based on mass (heavier = slower throw)
    const strength = 15 / fromBody.mass;
    const impulse = [
      (dx / dist) * strength,
      3, // Some upward lift
      (dz / dist) * strength
    ];

    this.physicsScene.applyImpulse(fromBody.id, impulse);
    console.log(`[yeti-scene] Threw creature${fromIndex} at creature${toIndex}, impulse: [${impulse.map(v => v.toFixed(1)).join(',')}]`);
  }

  // Populate the throw selects with creature emojis
  populateThrowSelects() {
    const fromSelect = this.shadowRoot.querySelector('.from-select');
    const toSelect = this.shadowRoot.querySelector('.to-select');
    if (!fromSelect || !toSelect) return;

    const creatures = this.querySelectorAll('yeti-dog, yeti-cat, yeti-horse, yeti-elephant, yeti-creature');

    creatures.forEach((el, i) => {
      const species = el.species || 'dog';
      const defaults = SPECIES_DEFAULTS[species] || SPECIES_DEFAULTS.dog;
      const emoji = defaults.emoji;

      const opt1 = document.createElement('option');
      opt1.value = i;
      opt1.textContent = emoji;
      fromSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = i;
      opt2.textContent = emoji;
      toSelect.appendChild(opt2);
    });

    // Default: first creature throws at second
    if (creatures.length >= 2) {
      fromSelect.value = '0';
      toSelect.value = '1';
    }
  }

  // Render loop with physics stepping
  // Uses PhysicsScene (same approach as Lucid's main app)
  startPhysicsRenderLoop() {
    let frameCount = 0;
    let lastTime = performance.now();

    const render = (now) => {
      if (this.raymarcher) {
        // Step physics simulation (if enabled)
        if (this.physicsScene && this.physicsScene.enabled) {
          const deltaTime = (now - lastTime) / 1000;
          lastTime = now;

          // Step physics (capped to avoid instability)
          this.physicsScene.step(Math.min(deltaTime, 1/30));

          // Sync physics body positions to shader uniforms via setParam
          // This is the key pattern from Lucid's main app (lucid/index.html)
          for (const body of this.physicsScene.bodies) {
            const paramName = `phys_${body.id}`;
            this.raymarcher.setParam(paramName, [...body.position]);
          }
        }

        this.raymarcher.render();
        frameCount++;
      }
      this.animationId = requestAnimationFrame(render);
    };

    lastTime = performance.now();
    render(lastTime);
  }

  // Collect all yeti-* children and build combined scene
  updateSharedScene() {
    if (!this.quadrupedDef || !this.raymarcher) return;

    const creatures = this.querySelectorAll('yeti-dog, yeti-cat, yeti-horse, yeti-elephant, yeti-creature');
    if (creatures.length === 0) return;

    // Build children array with transforms
    const children = [];
    const labels = [];

    creatures.forEach((el, i) => {
      const species = el.species || 'dog';
      const params = el.buildParams ? el.buildParams() : { ...SPECIES_DEFAULTS[species] };
      const pos = parseVec3(el.getAttribute('pos')) || [0, 0, 0];

      const defaults = SPECIES_DEFAULTS[species];
      labels.push(defaults.emoji);

      // Wrap quadruped ref in transform for positioning
      children.push({
        type: "ref",
        id: "quadruped",
        params,
        transform: { translate: pos }
      });
    });

    // Build combined scene with union of all creatures
    const sceneJson = {
      version: "1.0",
      defs: { quadruped: this.quadrupedDef.quadruped },
      root: children.length === 1
        ? children[0]
        : { type: "union", children },
      camera: { distance: 12, phi: 0.35, theta: 0.3, target: [0, 0, 0] }
    };

    // Adjust camera based on creature count
    const spread = creatures.length * 2;
    sceneJson.camera.distance = Math.max(8, spread + 4);

    try {
      const scene = loadJsonScene(sceneJson);
      const glsl = generateGlslFromJson(scene);
      this.raymarcher.updateScene(glsl, {}, null, sceneJson);
      Object.assign(this.raymarcher.camera, sceneJson.camera);

      const label = this.shadowRoot.querySelector('.label');
      label.textContent = labels.join(' ');
    } catch (err) {
      console.error('[yeti-scene]', err?.message || err);
    }
  }

  setupControls(canvas) {
    let dragging = false;
    let lastX = 0, lastY = 0;
    let lastPinchDist = 0;
    const pointers = new Map();

    // Get distance between two touch points
    const getPinchDist = () => {
      const pts = Array.from(pointers.values());
      if (pts.length < 2) return 0;
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      return Math.sqrt(dx * dx + dy * dy);
    };

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);

      if (pointers.size === 1) {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      } else if (pointers.size === 2) {
        dragging = false;
        lastPinchDist = getPinchDist();
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.raymarcher) return;

      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2) {
        // Pinch to zoom
        const dist = getPinchDist();
        if (lastPinchDist > 0) {
          const delta = (lastPinchDist - dist) * 0.05;
          this.raymarcher.camera.distance = Math.max(3, Math.min(50, this.raymarcher.camera.distance + delta));
        }
        lastPinchDist = dist;
      } else if (dragging && pointers.size === 1) {
        // Single finger drag = rotate
        const dx = (e.clientX - lastX) * 0.008;
        const dy = (e.clientY - lastY) * 0.008;
        this.raymarcher.camera.theta += dx;
        this.raymarcher.camera.phi = Math.max(0.1, Math.min(Math.PI/2 - 0.1, this.raymarcher.camera.phi - dy));
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });

    const endPointer = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        dragging = false;
      } else if (pointers.size === 1) {
        // Switch back to drag mode with remaining pointer
        const remaining = Array.from(pointers.values())[0];
        dragging = true;
        lastX = remaining.x;
        lastY = remaining.y;
      }
      lastPinchDist = 0;
    };

    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    // Mouse wheel zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.raymarcher) {
        this.raymarcher.camera.distance = Math.max(3, Math.min(50, this.raymarcher.camera.distance + e.deltaY * 0.02));
      }
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
// YetiCreature - Base creature component
// ============================================================

class YetiCreature extends HTMLElement {
  static get observedAttributes() {
    return [
      'width', 'height', 'spin', 'color', 'smooth', 'pos',
      'body-radii', 'rump-radii', 'rump-pos', 'head-radii', 'head-pos',
      'snout-radii', 'snout-pos', 'nose-size', 'nose-pos',
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
  }

  get species() { return 'dog'; }

  connectedCallback() {
    // Check if in shared scene - if so, don't render own canvas
    const scene = this.closest('yeti-scene');
    if (scene && scene.isShared) {
      // Hide self, scene will render us
      this.shadowRoot.innerHTML = '';
      return;
    }

    this.render();
    this.init();
  }

  disconnectedCallback() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal !== newVal) {
      // If in shared scene, tell scene to update
      const scene = this.closest('yeti-scene');
      if (scene && scene.isShared) {
        scene.updateSharedScene();
      } else if (this.raymarcher) {
        this.updateCreature();
      }
    }
  }

  render() {
    const width = this.getAttribute('width') || 400;
    const height = this.getAttribute('height') || 300;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-block; position: relative; }
        canvas { display: block; border-radius: 8px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); touch-action: none; }
        .label { position: absolute; bottom: 8px; left: 8px; font-family: system-ui, sans-serif; font-size: 11px; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 4px; }
      </style>
      <canvas width="${width}" height="${height}"></canvas>
      <div class="label"></div>
    `;
  }

  async init() {
    const canvas = this.shadowRoot.querySelector('canvas');
    const label = this.shadowRoot.querySelector('.label');

    try {
      const scene = this.closest('yeti-scene');
      if (scene) {
        this.quadrupedDef = await scene.ready();
      } else {
        const defUrl = new URL('defs/quadruped.json', getBasePath()).href;
        const response = await fetch(defUrl);
        if (!response.ok) throw new Error('Failed to load quadruped.json');
        this.quadrupedDef = await response.json();
      }

      this.raymarcher = new SimpleRaymarcher(canvas);
      this.raymarcher.resize();
      this.setupControls(canvas);
      await this.updateCreature();

      const defaults = SPECIES_DEFAULTS[this.species] || SPECIES_DEFAULTS.dog;
      label.textContent = `${defaults.emoji} ${defaults.name}`;

      this.startRenderLoop();

    } catch (err) {
      console.error('[yeti-creature]', err?.message || err);
      if (label) label.textContent = err?.message || 'Error';
    }
  }

  buildParams() {
    const defaults = SPECIES_DEFAULTS[this.species] || SPECIES_DEFAULTS.dog;
    // Filter out non-SDF params (name, emoji are for display only)
    const { name, emoji, ...sdfParams } = defaults;
    const params = { ...sdfParams };

    for (const attr of this.getAttributeNames()) {
      const value = this.getAttribute(attr);
      if (!value || attr === 'pos') continue;
      const paramName = kebabToCamel(attr);

      if (attr === 'color') {
        const parsed = parseColor(value);
        if (parsed) params.color = parsed;
      } else if (paramName.endsWith('Radii') || paramName.endsWith('Pos') ||
                 paramName.endsWith('PosR') || paramName.endsWith('Rot') ||
                 paramName === 'earRotate') {
        const parsed = parseVec3(value);
        if (parsed) params[paramName] = parsed;
      } else if (['smooth', 'noseSize', 'legThighR', 'legAnkleR', 'frontLegH', 'backLegH', 'tailLen', 'tailR'].includes(paramName)) {
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

    if (this.species === 'elephant') sceneJson.camera.distance = 10;
    else if (this.species === 'horse') sceneJson.camera.distance = 8;

    const scene = loadJsonScene(sceneJson);
    const glsl = generateGlslFromJson(scene);
    this.raymarcher.updateScene(glsl, {}, null, sceneJson);
    Object.assign(this.raymarcher.camera, sceneJson.camera);
  }

  setupControls(canvas) {
    let dragging = false, lastX = 0, lastY = 0;

    canvas.addEventListener('pointerdown', (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging || !this.raymarcher) return;
      this.raymarcher.camera.theta += (e.clientX - lastX) * 0.01;
      this.raymarcher.camera.phi = Math.max(0.1, Math.min(Math.PI/2 - 0.1, this.raymarcher.camera.phi - (e.clientY - lastY) * 0.01));
      lastX = e.clientX; lastY = e.clientY;
    });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('pointercancel', () => { dragging = false; });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.raymarcher) this.raymarcher.camera.distance = Math.max(2, Math.min(20, this.raymarcher.camera.distance + e.deltaY * 0.01));
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

class YetiDog extends YetiCreature { get species() { return 'dog'; } }
class YetiCat extends YetiCreature { get species() { return 'cat'; } }
class YetiElephant extends YetiCreature { get species() { return 'elephant'; } }
class YetiHorse extends YetiCreature { get species() { return 'horse'; } }

// ============================================================
// Register components
// ============================================================

customElements.define('yeti-scene', YetiScene);
customElements.define('yeti-creature', YetiCreature);
customElements.define('yeti-dog', YetiDog);
customElements.define('yeti-cat', YetiCat);
customElements.define('yeti-elephant', YetiElephant);
customElements.define('yeti-horse', YetiHorse);

export { YetiScene, YetiCreature, YetiDog, YetiCat, YetiElephant, YetiHorse, SPECIES_DEFAULTS };
