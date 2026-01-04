/**
 * Physics Scene Integration for Lucid SDF Renderer
 * Bridges XPBD physics simulation with SDF scene rendering
 *
 * LCD-048: Enables physics-enabled SDF scenes with real-time simulation
 */

/**
 * Extract all nodes with physics properties from scene tree
 * @param {Object} node - Scene node to traverse
 * @param {Array} result - Accumulator array
 * @returns {Array} Array of nodes with physics property
 */
export function extractPhysicsNodes(node, result = []) {
  if (!node) return result;

  // Check if this node has physics
  if (node.physics) {
    result.push(node);
  }

  // Recurse into children
  if (node.children) {
    for (const child of node.children) {
      extractPhysicsNodes(child, result);
    }
  }

  // Single child (transform, material, etc.)
  if (node.child) {
    extractPhysicsNodes(node.child, result);
  }

  return result;
}

/**
 * Extract numeric value from processed or raw value
 * @param {*} val - Value to extract
 * @param {Object} params - Scene params for resolving var references
 */
function extractValue(val, params = {}) {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  if (val.type === 'const') return val.value;
  if (val.type === 'array') return val.values.map(v => extractValue(v, params));
  if (Array.isArray(val)) return val.map(v => extractValue(v, params));
  // Handle var reference: { "var": "ball1X" }
  if (val.var && params[val.var]) {
    return params[val.var].value ?? params[val.var];
  }
  return 0;
}

/**
 * Extract position from node transform
 * @param {Object} node - Scene node
 * @param {Object} params - Scene params for resolving var references
 */
function extractPosition(node, params = {}) {
  if (!node.transform || !node.transform.translate) {
    return [0, 0, 0];
  }

  const t = node.transform.translate;

  // Handle different formats
  if (Array.isArray(t)) {
    return t.map(v => extractValue(v, params));
  }
  if (t.type === 'array') {
    return t.values.map(v => extractValue(v, params));
  }
  // Handle single var reference to vec3: { "var": "ball1Pos" }
  if (t.var && params[t.var]) {
    const val = params[t.var].value ?? params[t.var];
    if (Array.isArray(val)) {
      return [...val];
    }
  }

  return [0, 0, 0];
}

/**
 * Extract radius from sphere node
 * @param {Object} node - Scene node
 * @param {Object} params - Scene params for resolving var references
 */
function extractRadius(node, params = {}) {
  if (node.type !== 'sphere') return 0.5; // Default

  const r = node.params?.r;
  if (!r) return 0.5;

  return extractValue(r, params) || 0.5;
}

/**
 * Create a physics body from a scene node
 * @param {Object} node - Scene node with physics property
 * @param {Object} params - Scene params for resolving var references
 * @returns {Object} Physics body configuration
 */
export function createPhysicsBodyFromNode(node, params = {}) {
  const physics = node.physics || {};
  const isStatic = physics.type === 'static';

  return {
    id: node.id || `body_${Math.random().toString(36).substr(2, 9)}`,
    position: extractPosition(node, params),
    velocity: [0, 0, 0],
    mass: isStatic ? 0 : (physics.mass ?? 1.0),
    restitution: physics.restitution ?? 0.7,
    isStatic,
    radius: extractRadius(node, params),
    nodeType: node.type
  };
}

/**
 * Physics Scene - manages physics simulation for SDF scenes
 */
export class PhysicsScene {
  /**
   * @param {Object} sceneJson - Scene JSON with physics configuration
   */
  constructor(sceneJson) {
    this.sceneJson = sceneJson;
    this.physics = sceneJson.physics || {};
    this.enabled = this.physics.enabled ?? false;
    this.gravity = this.physics.gravity || [0, -9.8, 0];
    this.groundY = this.physics.groundY ?? -2;

    // Extract and create physics bodies
    this.bodies = [];
    if (this.enabled && sceneJson.root) {
      const physicsNodes = extractPhysicsNodes(sceneJson.root);
      const params = sceneJson.params || {};
      this.bodies = physicsNodes.map(node => createPhysicsBodyFromNode(node, params));
    }

    // Physics constants
    this.damping = 0.99;
    this.iterations = 4;
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

      // Apply gravity
      body.velocity[0] += g[0] * dt;
      body.velocity[1] += g[1] * dt;
      body.velocity[2] += g[2] * dt;

      // Update position
      body.position[0] += body.velocity[0] * dt;
      body.position[1] += body.velocity[1] * dt;
      body.position[2] += body.velocity[2] * dt;

      // Apply damping
      body.velocity[0] *= this.damping;
      body.velocity[1] *= this.damping;
      body.velocity[2] *= this.damping;
    }

    // Constraint solving iterations
    for (let iter = 0; iter < this.iterations; iter++) {
      // Ground collision
      for (const body of this.bodies) {
        if (body.isStatic) continue;

        const groundContact = this.groundY + body.radius;
        if (body.position[1] < groundContact) {
          body.position[1] = groundContact;

          // Reflect velocity with restitution
          if (body.velocity[1] < 0) {
            body.velocity[1] = -body.velocity[1] * body.restitution;

            // Stop micro-bounces
            if (Math.abs(body.velocity[1]) < 0.1) {
              body.velocity[1] = 0;
            }
          }
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
   * Resolve collision between two bodies
   */
  resolveCollision(a, b) {
    // Skip if both static
    if (a.isStatic && b.isStatic) return;

    const dx = b.position[0] - a.position[0];
    const dy = b.position[1] - a.position[1];
    const dz = b.position[2] - a.position[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const minDist = a.radius + b.radius;

    if (dist < minDist && dist > 0.0001) {
      // Collision normal
      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;
      const overlap = minDist - dist;

      // Separate bodies (inverse mass weighting)
      const totalMass = (a.isStatic ? 0 : a.mass) + (b.isStatic ? 0 : b.mass);
      if (totalMass > 0) {
        const aRatio = a.isStatic ? 0 : (b.isStatic ? 1 : b.mass / totalMass);
        const bRatio = b.isStatic ? 0 : (a.isStatic ? 1 : a.mass / totalMass);

        a.position[0] -= nx * overlap * aRatio;
        a.position[1] -= ny * overlap * aRatio;
        a.position[2] -= nz * overlap * aRatio;
        b.position[0] += nx * overlap * bRatio;
        b.position[1] += ny * overlap * bRatio;
        b.position[2] += nz * overlap * bRatio;
      }

      // Velocity response
      const dvx = a.velocity[0] - b.velocity[0];
      const dvy = a.velocity[1] - b.velocity[1];
      const dvz = a.velocity[2] - b.velocity[2];
      const dvn = dvx * nx + dvy * ny + dvz * nz;

      // Only resolve if approaching
      if (dvn > 0) {
        const restitution = Math.min(a.restitution, b.restitution);
        const impulse = dvn * (1 + restitution);

        if (!a.isStatic) {
          const aImpulse = impulse * (b.isStatic ? 1 : b.mass / totalMass);
          a.velocity[0] -= aImpulse * nx;
          a.velocity[1] -= aImpulse * ny;
          a.velocity[2] -= aImpulse * nz;
        }

        if (!b.isStatic) {
          const bImpulse = impulse * (a.isStatic ? 1 : a.mass / totalMass);
          b.velocity[0] += bImpulse * nx;
          b.velocity[1] += bImpulse * ny;
          b.velocity[2] += bImpulse * nz;
        }
      }
    }
  }

  /**
   * Get transform updates for renderer
   * @returns {Object} Map of body ID to transform data
   */
  getTransformUpdates() {
    const updates = {};

    for (const body of this.bodies) {
      updates[body.id] = {
        translate: [...body.position],
        velocity: [...body.velocity]
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
      body.velocity[0] += impulse[0] / body.mass;
      body.velocity[1] += impulse[1] / body.mass;
      body.velocity[2] += impulse[2] / body.mass;
    }
  }

  /**
   * Add a new dynamic body at runtime
   * @param {Object} config - Body configuration
   * @returns {Object} Created body
   */
  addBody(config) {
    const body = {
      id: config.id || `body_${this.bodies.length}`,
      position: config.position || [0, 0, 0],
      velocity: config.velocity || [0, 0, 0],
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
