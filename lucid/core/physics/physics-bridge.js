/**
 * Physics Bridge - connects XPBD physics with Lucid raymarcher
 *
 * LCD-045: Bridges WebGPU physics simulation with SDF rendering
 *
 * Generic physics system - scene JSON defines bodies and constraints explicitly.
 * No creature-specific knowledge in the core.
 */

import { XPBDPhysicsGPU } from './xpbd-gpu.js';

/**
 * Physics Bridge class - connects physics to rendering
 */
export class PhysicsBridge {
  /**
   * Create physics bridge, optionally pre-parsing config for initial positions
   * @param {Object} sceneJson - Optional scene JSON to pre-parse
   */
  constructor(sceneJson = null) {
    this.physics = null;
    this.enabled = false;
    this.initialized = false;

    // Map of body names to their position constraint indices
    this.positionConstraintMap = new Map();

    // Initial positions for each body (for uniform defaults)
    this.initialPositions = new Map();

    // Config from scene JSON
    this.config = null;

    // Pre-parse initial positions synchronously (before async GPU init)
    if (sceneJson?.physics?.bodies) {
      for (const body of sceneJson.physics.bodies) {
        if (body.name && body.pos) {
          this.initialPositions.set(body.name, [...body.pos]);
        }
      }
    }
  }

  /**
   * Initialize physics from scene JSON
   * @param {Object} sceneJson - Full scene JSON with physics section
   * @returns {Promise<boolean>} True if initialization succeeded
   */
  async init(sceneJson) {
    const physicsConfig = sceneJson.physics;
    if (!physicsConfig || !physicsConfig.enabled) {
      this.enabled = false;
      return false;
    }

    this.config = physicsConfig;
    this.physics = new XPBDPhysicsGPU();

    // Try GPU, fall back to CPU (set forceCPU: true in physics config to skip GPU)
    const forceCPU = physicsConfig.forceCPU || false;
    const gpuOk = forceCPU ? false : await this.physics.initGPU();
    console.log(`Physics: ${gpuOk ? 'WebGPU' : 'CPU fallback'}${forceCPU ? ' (forced CPU)' : ''}`);

    // Configure simulation params
    if (physicsConfig.gravity) {
      this.physics.params.gravity = [...physicsConfig.gravity];
    }
    if (physicsConfig.groundY !== undefined) {
      this.physics.params.groundY = physicsConfig.groundY;
    }
    if (physicsConfig.damping !== undefined) {
      this.physics.params.damping = physicsConfig.damping;
    }
    if (physicsConfig.iterations !== undefined) {
      this.physics.params.iterations = physicsConfig.iterations;
    }
    if (physicsConfig.dt !== undefined) {
      this.physics.params.dt = physicsConfig.dt;
    }
    // Store bounds for wall collisions
    if (physicsConfig.bounds) {
      this.physics.params.bounds = { ...physicsConfig.bounds };
    }

    // Create physics bodies from explicit list
    if (physicsConfig.bodies && Array.isArray(physicsConfig.bodies)) {
      for (const body of physicsConfig.bodies) {
        const pos = body.pos || [0, 0, 0];
        this.physics.addParticle({
          pos: [...pos],
          mass: body.mass ?? 1.0,
          radius: body.radius ?? 0.1,
          name: body.name
        });

        // Store initial position for defaults
        if (body.name) {
          this.initialPositions.set(body.name, [...pos]);
        }
      }
    }

    // Add distance constraints
    if (physicsConfig.distanceConstraints && Array.isArray(physicsConfig.distanceConstraints)) {
      for (const c of physicsConfig.distanceConstraints) {
        const idxA = this.physics.paramBindings.get(c.bodyA);
        const idxB = this.physics.paramBindings.get(c.bodyB);
        if (idxA !== undefined && idxB !== undefined) {
          this.physics.addDistanceConstraint(idxA, idxB, c.length ?? null, c.compliance || 0);
        }
      }
    }

    // Add position constraints (anchors, targets)
    if (physicsConfig.positionConstraints && Array.isArray(physicsConfig.positionConstraints)) {
      for (const c of physicsConfig.positionConstraints) {
        const idx = this.physics.paramBindings.get(c.body);
        if (idx !== undefined) {
          const target = c.target || this.initialPositions.get(c.body) || [0, 0, 0];
          this.physics.addPositionConstraint(idx, target, c.compliance || 0.01);
          this.positionConstraintMap.set(c.body, this.physics.posConstraints.length - 1);
        }
      }
    }

    // Build GPU buffers
    this.physics.buildBuffers();
    this.enabled = true;
    this.initialized = true;

    return true;
  }

  /**
   * Update position constraint target for a body
   * @param {string} bodyName - Body name
   * @param {number[]} target - Target position [x, y, z]
   */
  updateTarget(bodyName, target) {
    const constraintIdx = this.positionConstraintMap.get(bodyName);
    if (constraintIdx !== undefined && Array.isArray(target)) {
      this.physics.updatePositionTarget(constraintIdx, target);
    }
  }

  /**
   * Step the physics simulation
   * @param {number} dt - Delta time (optional, uses internal dt if not provided)
   */
  async step(dt = null) {
    if (!this.enabled || !this.initialized) return;

    if (dt !== null) {
      this.physics.params.dt = dt;
    }

    await this.physics.step();
  }

  /**
   * Get physics-derived param values for shader uniforms
   * Returns positions with phys_ prefix
   * @returns {Object} Map of paramName -> { value, type }
   */
  getParamValues() {
    if (!this.enabled || !this.initialized) {
      // Return initial positions as defaults
      const result = {};
      for (const [name, pos] of this.initialPositions) {
        result[`phys_${name}`] = {
          value: pos,
          type: 'position3'
        };
      }
      return result;
    }

    const values = this.physics.getParamValues();

    // Convert position arrays to position3 format with phys_ prefix
    const result = {};
    for (const [name, pos] of Object.entries(values)) {
      if (name.endsWith('_vel')) continue; // Skip velocities
      result[`phys_${name}`] = {
        value: pos,
        type: 'position3'
      };
    }

    return result;
  }

  /**
   * Get initial position for a body (for default uniform values)
   */
  getInitialPosition(bodyName) {
    return this.initialPositions.get(bodyName) || [0, 0, 0];
  }

  /**
   * Apply impulse to a named body
   * @param {string} bodyName - Body name
   * @param {number[]} impulse - Impulse vector [x, y, z]
   */
  applyImpulse(bodyName, impulse) {
    if (!this.enabled || !this.initialized) return;
    this.physics.applyImpulse(bodyName, impulse);
  }

  /**
   * Get raw particle positions (for debugging)
   */
  getParticlePositions() {
    if (!this.physics) return [];
    return this.physics.particles.map(p => ({
      name: p.name,
      pos: [...p.pos],
      vel: [...p.velocity]
    }));
  }

  /**
   * Check if physics is running on GPU
   */
  isGPU() {
    return this.physics?.isGPU ?? false;
  }
}
