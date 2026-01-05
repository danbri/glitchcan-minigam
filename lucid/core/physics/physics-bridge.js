/**
 * Physics Bridge - connects XPBD physics with Lucid raymarcher
 *
 * LCD-045: Bridges WebGPU physics simulation with SDF rendering
 *
 * This bridge:
 * - Initializes physics from scene JSON "physics" section
 * - Updates position constraint targets from rig phase animations
 * - Returns particle positions as uniform values for the shader
 *
 * Integration flow:
 * 1. Scene JSON defines physics bodies and constraints
 * 2. Rig system computes walk cycle foot positions
 * 3. Physics solver maintains constraint satisfaction
 * 4. Particle positions feed back to shader as uniforms
 */

import { XPBDPhysicsGPU, createQuadrupedRig } from './xpbd-gpu.js';
import { evaluateRig } from '../rig-evaluator.js';

/**
 * Physics Bridge class - connects physics to rendering
 */
export class PhysicsBridge {
  constructor() {
    this.physics = null;
    this.enabled = false;
    this.initialized = false;

    // Map of physics body names to their constraint indices
    this.positionConstraintMap = new Map();

    // Map of body names to rig param names they track
    this.rigBindings = new Map();

    // Config from scene JSON
    this.config = null;
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

    // Try GPU, fall back to CPU
    const gpuOk = await this.physics.initGPU();
    console.log(`Physics: ${gpuOk ? 'WebGPU' : 'CPU fallback'}`);

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

    // Create physics bodies from config
    if (physicsConfig.preset === 'quadruped') {
      // Use quadruped helper
      const quadConfig = physicsConfig.quadruped || {};
      const rig = createQuadrupedRig(this.physics, {
        bodyPos: quadConfig.bodyPos || [0, 0.5, 0],
        bodyMass: quadConfig.bodyMass || 5.0,
        footMass: quadConfig.footMass || 0.5,
        legLength: quadConfig.legLength || 0.8,
        bodyWidth: quadConfig.bodyWidth || 0.4,
        bodyLength: quadConfig.bodyLength || 0.5,
        compliance: quadConfig.compliance || 0.0001
      });

      // Store constraint indices for position updates
      this.positionConstraintMap.set('footFL', rig.footConstraints[0]);
      this.positionConstraintMap.set('footFR', rig.footConstraints[1]);
      this.positionConstraintMap.set('footRL', rig.footConstraints[2]);
      this.positionConstraintMap.set('footRR', rig.footConstraints[3]);

      // Map rig phase params to foot constraints
      if (physicsConfig.rigBindings) {
        for (const [foot, rigParam] of Object.entries(physicsConfig.rigBindings)) {
          this.rigBindings.set(foot, rigParam);
        }
      }
    } else if (physicsConfig.bodies) {
      // Manual body definition
      for (const body of physicsConfig.bodies) {
        this.physics.addParticle({
          pos: body.pos || [0, 0, 0],
          mass: body.mass ?? 1.0,
          radius: body.radius ?? 0.1,
          name: body.name
        });
      }

      // Add constraints
      if (physicsConfig.distanceConstraints) {
        for (const c of physicsConfig.distanceConstraints) {
          const idxA = this.physics.paramBindings.get(c.bodyA);
          const idxB = this.physics.paramBindings.get(c.bodyB);
          if (idxA !== undefined && idxB !== undefined) {
            this.physics.addDistanceConstraint(idxA, idxB, c.length, c.compliance || 0);
          }
        }
      }

      if (physicsConfig.positionConstraints) {
        for (const c of physicsConfig.positionConstraints) {
          const idx = this.physics.paramBindings.get(c.body);
          if (idx !== undefined) {
            this.physics.addPositionConstraint(idx, c.target || [0, 0, 0], c.compliance || 0.01);
            this.positionConstraintMap.set(c.body, this.physics.posConstraints.length - 1);

            if (c.rigBinding) {
              this.rigBindings.set(c.body, c.rigBinding);
            }
          }
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
   * Update position constraint targets from rig evaluation
   * @param {Object} sceneParams - Scene parameters
   * @param {Object} rig - Rig definition
   * @param {number} time - Current time
   */
  updateFromRig(sceneParams, rig, time) {
    if (!this.enabled || !this.initialized) return;

    // Evaluate rig to get current animation values
    const rigResult = evaluateRig(sceneParams, rig, time);

    // Update position constraint targets based on rig bindings
    for (const [bodyName, rigParam] of this.rigBindings) {
      const constraintIdx = this.positionConstraintMap.get(bodyName);
      if (constraintIdx === undefined) continue;

      // Get target position from rig values
      // For walk cycle: rigParam might be a position3 or computed from phase values
      let target;

      if (rigResult.values[rigParam]) {
        // Direct param reference (position3 type)
        target = rigResult.values[rigParam];
      } else {
        // Compute from phase values - assume footFL tracks gait_legFL etc.
        // This computes foot position from body position + leg rotation
        const basePos = this.config.quadruped?.bodyPos || [0, 0.5, 0];
        const legLength = this.config.quadruped?.legLength || 0.8;

        // Get leg swing angle from phase (e.g., gait_legFL)
        const phaseParam = this.getPhaseParamForFoot(bodyName);
        const swing = rigResult.phaseValues[phaseParam] || 0;
        const swingRad = (swing * Math.PI) / 180;

        // Compute foot position based on which leg
        const footOffset = this.getFootOffset(bodyName);
        target = [
          basePos[0] + footOffset[0],
          basePos[1] - legLength * Math.cos(swingRad) + footOffset[1],
          basePos[2] + legLength * Math.sin(swingRad) + footOffset[2]
        ];
      }

      if (Array.isArray(target) && target.length >= 3) {
        this.physics.updatePositionTarget(constraintIdx, target);
      }
    }
  }

  /**
   * Get the rig phase param name for a foot
   */
  getPhaseParamForFoot(footName) {
    const map = {
      'footFL': 'gait_legFL',
      'footFR': 'gait_legFR',
      'footRL': 'gait_legRL',
      'footRR': 'gait_legRR'
    };
    return map[footName] || footName;
  }

  /**
   * Get foot offset from body center
   */
  getFootOffset(footName) {
    const bodyWidth = this.config?.quadruped?.bodyWidth || 0.4;
    const bodyLength = this.config?.quadruped?.bodyLength || 0.5;

    const offsets = {
      'footFL': [bodyWidth, 0, bodyLength],
      'footFR': [-bodyWidth, 0, bodyLength],
      'footRL': [bodyWidth, 0, -bodyLength],
      'footRR': [-bodyWidth, 0, -bodyLength]
    };
    return offsets[footName] || [0, 0, 0];
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
   * @returns {Object} Map of paramName -> value for shader binding
   */
  getParamValues() {
    if (!this.enabled || !this.initialized) return {};

    const values = this.physics.getParamValues();

    // Convert position arrays to position3 format
    const result = {};
    for (const [name, pos] of Object.entries(values)) {
      if (name.endsWith('_vel')) {
        // Velocity - skip or include based on scene needs
        continue;
      }
      // Position param
      result[`phys_${name}`] = {
        value: pos,
        type: 'position3'
      };
    }

    return result;
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

/**
 * Create enhanced param object that merges physics values
 * @param {Object} sceneParams - Original scene params
 * @param {Object} physicsParams - Physics-derived params
 * @returns {Object} Merged params for shader binding
 */
export function mergePhysicsParams(sceneParams, physicsParams) {
  const merged = { ...sceneParams };

  for (const [name, param] of Object.entries(physicsParams)) {
    merged[name] = param;
  }

  return merged;
}
