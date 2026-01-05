/**
 * Physics Scene Integration for Lucid SDF Renderer
 * Bridges XPBD physics simulation with SDF scene rendering
 *
 * LCD-048: Enables physics-enabled SDF scenes with real-time simulation
 */

import { vec3 } from './xpbd.js';

// ============================================================================
// Scene node extraction
// ============================================================================

/**
 * Extract all nodes with physics properties from scene tree
 * @param {Object} node - Scene node to traverse
 * @param {Array} result - Accumulator array
 * @returns {Array} Array of nodes with physics property
 */
export function extractPhysicsNodes(node, result = []) {
  if (!node) return result;

  if (node.physics) {
    result.push(node);
  }

  if (node.children) {
    for (const child of node.children) {
      extractPhysicsNodes(child, result);
    }
  }

  if (node.child) {
    extractPhysicsNodes(node.child, result);
  }

  return result;
}

/**
 * Extract numeric value from processed or raw value
 */
function extractValue(val, params = {}) {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  if (val.type === 'const') return val.value;
  if (val.type === 'array') return val.values.map(v => extractValue(v, params));
  if (Array.isArray(val)) return val.map(v => extractValue(v, params));
  if (val.var && params[val.var]) {
    return params[val.var].value ?? params[val.var];
  }
  return 0;
}

/**
 * Extract position vector from node transform
 */
function extractPosition(node, params = {}) {
  if (!node.transform || !node.transform.translate) {
    return vec3.zero();
  }

  const t = node.transform.translate;

  if (Array.isArray(t)) {
    return t.map(v => extractValue(v, params));
  }
  if (t.type === 'array') {
    return t.values.map(v => extractValue(v, params));
  }
  if (t.var && params[t.var]) {
    const val = params[t.var].value ?? params[t.var];
    if (Array.isArray(val)) {
      return vec3.clone(val);
    }
  }

  return vec3.zero();
}

/**
 * Extract radius from sphere node
 */
function extractRadius(node, params = {}) {
  if (node.type !== 'sphere') return 0.5;
  const r = node.params?.r;
  if (!r) return 0.5;
  return extractValue(r, params) || 0.5;
}

/**
 * Create a physics body from a scene node
 */
export function createPhysicsBodyFromNode(node, params = {}) {
  const physics = node.physics || {};
  const isStatic = physics.type === 'static';

  return {
    id: node.id || `body_${Math.random().toString(36).substr(2, 9)}`,
    position: extractPosition(node, params),
    velocity: vec3.zero(),
    mass: isStatic ? 0 : (physics.mass ?? 1.0),
    restitution: physics.restitution ?? 0.7,
    isStatic,
    radius: extractRadius(node, params),
    nodeType: node.type
  };
}

// ============================================================================
// Physics Scene class
// ============================================================================

/**
 * Physics Scene - manages physics simulation for SDF scenes
 */
export class PhysicsScene {
  constructor(sceneJson) {
    this.sceneJson = sceneJson;
    this.physics = sceneJson.physics || {};
    this.enabled = this.physics.enabled ?? false;
    this.gravity = this.physics.gravity || vec3.create(0, -9.8, 0);
    this.groundY = this.physics.groundY ?? -2;
    this.bounds = this.physics.bounds || null;

    this.bodies = [];
    if (this.enabled) {
      // New format: physics.bodies array at top level
      if (Array.isArray(this.physics.bodies)) {
        for (const bodyDef of this.physics.bodies) {
          this.bodies.push({
            id: bodyDef.name || `body_${this.bodies.length}`,
            position: bodyDef.pos ? vec3.clone(bodyDef.pos) : vec3.zero(),
            velocity: vec3.zero(),
            mass: bodyDef.mass ?? 1.0,
            restitution: bodyDef.restitution ?? 0.7,
            isStatic: bodyDef.mass === 0,
            radius: bodyDef.radius ?? 0.3,
            nodeType: 'sphere'
          });
        }
      }
      // Legacy format: physics on scene nodes
      else if (sceneJson.root) {
        const physicsNodes = extractPhysicsNodes(sceneJson.root);
        const params = sceneJson.params || {};
        this.bodies = physicsNodes.map(node => createPhysicsBodyFromNode(node, params));
      }
    }

    // Distance constraints (new format)
    this.distanceConstraints = [];
    if (this.physics.distanceConstraints) {
      for (const c of this.physics.distanceConstraints) {
        const bodyA = this.bodies.find(b => b.id === c.bodyA);
        const bodyB = this.bodies.find(b => b.id === c.bodyB);
        if (bodyA && bodyB) {
          const dist = c.length ?? vec3.length(vec3.sub(bodyB.position, bodyA.position));
          this.distanceConstraints.push({
            bodyA,
            bodyB,
            restLength: dist,
            compliance: c.compliance ?? 0
          });
        }
      }
    }

    // Position constraints (rig-driven targets)
    this.positionConstraints = [];
    if (this.physics.positionConstraints) {
      for (const c of this.physics.positionConstraints) {
        const body = this.bodies.find(b => b.id === c.body);
        if (body) {
          this.positionConstraints.push({
            body,
            basePosition: vec3.clone(body.position),
            target: vec3.clone(body.position),
            compliance: c.compliance ?? 0.01,
            rigTarget: c.rigTarget || null,
            baseY: c.baseY ?? body.position[1]
          });
        }
      }
    }

    this.damping = this.physics.damping ?? 0.99;
    this.iterations = this.physics.iterations ?? 4;
  }

  /**
   * Update position constraint targets from rig values
   * @param {Object} rigValues - Current rig output values
   */
  updateFromRig(rigValues) {
    if (!rigValues) return;

    for (const c of this.positionConstraints) {
      if (c.rigTarget && rigValues[c.rigTarget] !== undefined) {
        // Apply rig value as Y offset from base position
        const liftAmount = rigValues[c.rigTarget];
        c.target[0] = c.basePosition[0];
        c.target[1] = c.baseY + liftAmount;
        c.target[2] = c.basePosition[2];
      }
    }
  }

  /**
   * Step the physics simulation
   * @param {number} dt - Delta time in seconds
   */
  step(dt) {
    if (!this.enabled || this.bodies.length === 0) return;

    const g = this.gravity;

    // Update velocities and positions
    for (const body of this.bodies) {
      if (body.isStatic) continue;

      // Apply gravity: velocity += gravity * dt
      vec3.scaleAddTo(body.velocity, g, dt);

      // Update position: position += velocity * dt
      vec3.scaleAddTo(body.position, body.velocity, dt);

      // Apply damping
      vec3.scaleTo(body.velocity, this.damping);
    }

    // Constraint solving iterations
    for (let iter = 0; iter < this.iterations; iter++) {
      // Distance constraints (XPBD style)
      for (const c of this.distanceConstraints) {
        const a = c.bodyA;
        const b = c.bodyB;

        const wA = a.isStatic ? 0 : 1 / a.mass;
        const wB = b.isStatic ? 0 : 1 / b.mass;
        const wSum = wA + wB;
        if (wSum === 0) continue;

        const diff = vec3.sub(b.position, a.position);
        const dist = vec3.length(diff);
        if (dist < 0.0001) continue;

        const C = dist - c.restLength;
        const alpha = c.compliance / (dt * dt);
        const lambda = C / (wSum + alpha);

        const n = vec3.scale(diff, 1 / dist);

        if (wA > 0) {
          vec3.scaleAddTo(a.position, n, lambda * wA);
        }
        if (wB > 0) {
          vec3.scaleAddTo(b.position, n, -lambda * wB);
        }
      }

      // Position constraints (pull toward target)
      for (const c of this.positionConstraints) {
        const body = c.body;
        if (body.isStatic) continue;

        const w = 1 / body.mass;
        const diff = vec3.sub(c.target, body.position);
        const dist = vec3.length(diff);
        if (dist < 0.0001) continue;

        const alpha = c.compliance / (dt * dt);
        const lambda = dist / (w + alpha);

        const n = vec3.scale(diff, 1 / dist);
        vec3.scaleAddTo(body.position, n, lambda * w);
      }

      for (const body of this.bodies) {
        if (body.isStatic) continue;

        // Ground collision
        const groundContact = this.groundY + body.radius;
        if (body.position[1] < groundContact) {
          body.position[1] = groundContact;

          if (body.velocity[1] < 0) {
            body.velocity[1] = -body.velocity[1] * body.restitution;

            // Stop micro-bounces
            if (Math.abs(body.velocity[1]) < 0.1) {
              body.velocity[1] = 0;
            }
          }
        }

        // Wall collisions
        if (this.bounds) {
          this.constrainToBounds(body);
        }
      }

      // Body-body collisions
      for (let i = 0; i < this.bodies.length; i++) {
        for (let j = i + 1; j < this.bodies.length; j++) {
          this.resolveCollision(this.bodies[i], this.bodies[j]);
        }
      }
    }
  }

  /**
   * Constrain body position to bounds with bounce response
   */
  constrainToBounds(body) {
    const b = this.bounds;
    const r = body.radius;
    const pos = body.position;
    const vel = body.velocity;
    const rest = body.restitution;

    // X bounds
    if (b.minX !== undefined && pos[0] - r < b.minX) {
      pos[0] = b.minX + r;
      if (vel[0] < 0) vel[0] = -vel[0] * rest;
    }
    if (b.maxX !== undefined && pos[0] + r > b.maxX) {
      pos[0] = b.maxX - r;
      if (vel[0] > 0) vel[0] = -vel[0] * rest;
    }

    // Z bounds
    if (b.minZ !== undefined && pos[2] - r < b.minZ) {
      pos[2] = b.minZ + r;
      if (vel[2] < 0) vel[2] = -vel[2] * rest;
    }
    if (b.maxZ !== undefined && pos[2] + r > b.maxZ) {
      pos[2] = b.maxZ - r;
      if (vel[2] > 0) vel[2] = -vel[2] * rest;
    }
  }

  /**
   * Resolve collision between two bodies
   */
  resolveCollision(a, b) {
    if (a.isStatic && b.isStatic) return;

    const delta = vec3.sub(b.position, a.position);
    const dist = vec3.length(delta);
    const minDist = a.radius + b.radius;

    if (dist < minDist && dist > 0.0001) {
      // Collision normal
      const normal = vec3.scale(delta, 1 / dist);
      const overlap = minDist - dist;

      // Separate bodies (inverse mass weighting)
      const totalMass = (a.isStatic ? 0 : a.mass) + (b.isStatic ? 0 : b.mass);
      if (totalMass > 0) {
        const aRatio = a.isStatic ? 0 : (b.isStatic ? 1 : b.mass / totalMass);
        const bRatio = b.isStatic ? 0 : (a.isStatic ? 1 : a.mass / totalMass);

        vec3.scaleAddTo(a.position, normal, -overlap * aRatio);
        vec3.scaleAddTo(b.position, normal, overlap * bRatio);
      }

      // Velocity response
      const relVel = vec3.sub(a.velocity, b.velocity);
      const velAlongNormal = vec3.dot(relVel, normal);

      // Only resolve if approaching
      if (velAlongNormal > 0) {
        const restitution = Math.min(a.restitution, b.restitution);
        const impulse = velAlongNormal * (1 + restitution);

        if (!a.isStatic) {
          const aImpulse = impulse * (b.isStatic ? 1 : b.mass / totalMass);
          vec3.scaleAddTo(a.velocity, normal, -aImpulse);
        }

        if (!b.isStatic) {
          const bImpulse = impulse * (a.isStatic ? 1 : a.mass / totalMass);
          vec3.scaleAddTo(b.velocity, normal, bImpulse);
        }
      }
    }
  }

  /**
   * Get transform updates for renderer
   */
  getTransformUpdates() {
    const updates = {};

    for (const body of this.bodies) {
      updates[body.id] = {
        translate: vec3.clone(body.position),
        velocity: vec3.clone(body.velocity)
      };
    }

    return updates;
  }

  /**
   * Apply an impulse to a body
   * @param {string} bodyId - Body ID
   * @param {Array} impulse - Impulse vector [x, y, z]
   */
  applyImpulse(bodyId, impulse) {
    const body = this.bodies.find(b => b.id === bodyId);
    if (body && !body.isStatic) {
      vec3.scaleAddTo(body.velocity, impulse, 1 / body.mass);
    }
  }

  /**
   * Add a new dynamic body at runtime
   */
  addBody(config) {
    const body = {
      id: config.id || `body_${this.bodies.length}`,
      position: config.position ? vec3.clone(config.position) : vec3.zero(),
      velocity: config.velocity ? vec3.clone(config.velocity) : vec3.zero(),
      mass: config.mass ?? 1.0,
      restitution: config.restitution ?? 0.7,
      isStatic: config.isStatic ?? false,
      radius: config.radius ?? 0.3,
      nodeType: config.nodeType || 'sphere'
    };

    this.bodies.push(body);
    return body;
  }
}
