/**
 * Splat Object Physics System
 *
 * Integrates XPBD physics with Gaussian splat objects.
 * Each splat object is a cloud of thousands of splats that
 * transforms/deforms as a unit.
 *
 * LCD-047: Physics for Gaussian Splat Objects
 *
 * Physics Modes:
 * - rigid: Single transform applied to all splats
 * - soft: Cage deformation with XPBD constraints
 * - static: Fixed in world (collision only)
 */

import {
  createParticle,
  createDistanceConstraint,
  simulationStep,
  vec3
} from './xpbd.js';

/**
 * Quaternion utilities for rigid body rotation
 */
export const quat = {
  identity: () => [0, 0, 0, 1],

  fromAxisAngle: (axis, angle) => {
    const halfAngle = angle * 0.5;
    const s = Math.sin(halfAngle);
    return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(halfAngle)];
  },

  multiply: (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ],

  rotateVector: (q, v) => {
    // q * v * q^-1 (optimized)
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const vx = v[0], vy = v[1], vz = v[2];

    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);

    return [
      vx + qw * tx + qy * tz - qz * ty,
      vy + qw * ty + qz * tx - qx * tz,
      vz + qw * tz + qx * ty - qy * tx
    ];
  },

  normalize: (q) => {
    const len = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
    return len > 0 ? [q[0] / len, q[1] / len, q[2] / len, q[3] / len] : [0, 0, 0, 1];
  },

  slerp: (a, b, t) => {
    let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

    // Handle opposite quaternions
    if (dot < 0) {
      b = [-b[0], -b[1], -b[2], -b[3]];
      dot = -dot;
    }

    if (dot > 0.9995) {
      // Linear interpolation for very close quaternions
      return quat.normalize([
        a[0] + t * (b[0] - a[0]),
        a[1] + t * (b[1] - a[1]),
        a[2] + t * (b[2] - a[2]),
        a[3] + t * (b[3] - a[3])
      ]);
    }

    const theta0 = Math.acos(dot);
    const theta = theta0 * t;
    const sinTheta = Math.sin(theta);
    const sinTheta0 = Math.sin(theta0);

    const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
    const s1 = sinTheta / sinTheta0;

    return [
      s0 * a[0] + s1 * b[0],
      s0 * a[1] + s1 * b[1],
      s0 * a[2] + s1 * b[2],
      s0 * a[3] + s1 * b[3]
    ];
  }
};

/**
 * Rigid body state for a splat object
 */
export class RigidBody {
  constructor(options = {}) {
    this.position = options.position || [0, 0, 0];
    this.rotation = options.rotation || quat.identity();
    this.scale = options.scale || [1, 1, 1];

    this.velocity = [0, 0, 0];
    this.angularVelocity = [0, 0, 0];

    this.mass = options.mass !== undefined ? options.mass : 1.0;
    this.invMass = this.mass > 0 ? 1.0 / this.mass : 0;

    // Inertia tensor (simplified: uniform density sphere approx)
    const r = options.boundingRadius || 1.0;
    this.inertia = 0.4 * this.mass * r * r;
    this.invInertia = this.inertia > 0 ? 1.0 / this.inertia : 0;

    this.restitution = options.restitution || 0.3;
    this.friction = options.friction || 0.5;
  }

  /**
   * Apply transform to a local point
   */
  transformPoint(localPoint) {
    const scaled = [
      localPoint[0] * this.scale[0],
      localPoint[1] * this.scale[1],
      localPoint[2] * this.scale[2]
    ];
    const rotated = quat.rotateVector(this.rotation, scaled);
    return vec3.add(rotated, this.position);
  }

  /**
   * Get 4x4 transformation matrix (column-major for WebGL)
   */
  getMatrix() {
    const [x, y, z, w] = this.rotation;
    const [sx, sy, sz] = this.scale;
    const [px, py, pz] = this.position;

    // Rotation matrix from quaternion
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    return new Float32Array([
      (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
      (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
      (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
      px, py, pz, 1
    ]);
  }

  /**
   * Integrate rigid body motion
   */
  integrate(dt, gravity = [0, -9.81, 0]) {
    if (this.invMass === 0) return; // Static

    // Linear motion
    const acceleration = vec3.scale(gravity, dt);
    this.velocity = vec3.add(this.velocity, acceleration);
    this.position = vec3.add(this.position, vec3.scale(this.velocity, dt));

    // Angular motion (simplified)
    if (vec3.length(this.angularVelocity) > 0.0001) {
      const angle = vec3.length(this.angularVelocity) * dt;
      const axis = vec3.normalize(this.angularVelocity);
      const deltaRot = quat.fromAxisAngle(axis, angle);
      this.rotation = quat.normalize(quat.multiply(deltaRot, this.rotation));
    }
  }

  /**
   * Apply impulse at center of mass
   */
  applyImpulse(impulse) {
    if (this.invMass === 0) return;
    this.velocity = vec3.add(this.velocity, vec3.scale(impulse, this.invMass));
  }

  /**
   * Apply torque impulse
   */
  applyTorqueImpulse(torque) {
    if (this.invInertia === 0) return;
    this.angularVelocity = vec3.add(
      this.angularVelocity,
      vec3.scale(torque, this.invInertia)
    );
  }
}

/**
 * Soft body cage for deformable splat objects
 */
export class SoftBodyCage {
  constructor(options = {}) {
    this.particles = [];
    this.constraints = [];
    this.restPositions = [];

    // Cage type: 'box' (8 corners) or 'sphere' (icosphere vertices)
    this.type = options.type || 'box';
    this.compliance = options.compliance || 0.0001;

    this._buildCage(options.bounds || { min: [-1, -1, -1], max: [1, 1, 1] });
  }

  _buildCage(bounds) {
    const { min, max } = bounds;

    if (this.type === 'box') {
      // 8 corner particles
      const corners = [
        [min[0], min[1], min[2]],
        [max[0], min[1], min[2]],
        [max[0], max[1], min[2]],
        [min[0], max[1], min[2]],
        [min[0], min[1], max[2]],
        [max[0], min[1], max[2]],
        [max[0], max[1], max[2]],
        [min[0], max[1], max[2]]
      ];

      for (const pos of corners) {
        this.particles.push(createParticle(pos, 1.0));
        this.restPositions.push([...pos]);
      }

      // Edge constraints (12 edges of cube)
      const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0], // Bottom
        [4, 5], [5, 6], [6, 7], [7, 4], // Top
        [0, 4], [1, 5], [2, 6], [3, 7]  // Verticals
      ];

      for (const [a, b] of edges) {
        const restLen = vec3.length(vec3.sub(corners[b], corners[a]));
        this.constraints.push(createDistanceConstraint(a, b, restLen, this.compliance));
      }

      // Cross braces for rigidity
      const braces = [[0, 6], [1, 7], [2, 4], [3, 5]];
      for (const [a, b] of braces) {
        const restLen = vec3.length(vec3.sub(corners[b], corners[a]));
        this.constraints.push(createDistanceConstraint(a, b, restLen, this.compliance));
      }
    }
  }

  /**
   * Step the cage simulation
   */
  step(dt, options = {}) {
    simulationStep(this.particles, this.constraints, dt, {
      iterations: options.iterations || 10,
      gravity: options.gravity || [0, -9.81, 0]
    });
  }

  /**
   * Get deformed position for a local point using trilinear interpolation
   */
  getDeformedPosition(localPoint, bounds) {
    if (this.type !== 'box') {
      throw new Error('Only box cage interpolation implemented');
    }

    const { min, max } = bounds;

    // Normalize to 0-1 range
    const u = (localPoint[0] - min[0]) / (max[0] - min[0]);
    const v = (localPoint[1] - min[1]) / (max[1] - min[1]);
    const w = (localPoint[2] - min[2]) / (max[2] - min[2]);

    // Trilinear interpolation of 8 corners
    const p = this.particles;
    const lerp = (a, b, t) => vec3.add(vec3.scale(a, 1 - t), vec3.scale(b, t));

    const p00 = lerp(p[0].pos, p[1].pos, u);
    const p01 = lerp(p[3].pos, p[2].pos, u);
    const p10 = lerp(p[4].pos, p[5].pos, u);
    const p11 = lerp(p[7].pos, p[6].pos, u);

    const p0 = lerp(p00, p01, v);
    const p1 = lerp(p10, p11, v);

    return lerp(p0, p1, w);
  }

  /**
   * Apply external force to all particles
   */
  applyForce(force) {
    for (const p of this.particles) {
      if (p.invMass > 0) {
        p.pos = vec3.add(p.pos, vec3.scale(force, p.invMass));
      }
    }
  }

  /**
   * Anchor a particle (make it static)
   */
  anchorParticle(index) {
    if (index >= 0 && index < this.particles.length) {
      this.particles[index].invMass = 0;
    }
  }
}

/**
 * A physics-enabled splat object
 */
export class SplatObject {
  constructor(options = {}) {
    this.id = options.id || `splat_${Date.now()}`;
    this.source = options.source || 'lucid-sdf'; // 'photo' | 'lucid-sdf'

    // Physics mode
    this.mode = options.mode || 'rigid'; // 'rigid' | 'soft' | 'static'

    // Splat data (local space)
    this.splatCount = options.splatCount || 0;
    this.localPositions = options.localPositions || null; // Float32Array
    this.localRotations = options.localRotations || null;
    this.localScales = options.localScales || null;
    this.colors = options.colors || null;
    this.opacities = options.opacities || null;

    // Bounding box (local space)
    this.bounds = options.bounds || { min: [-1, -1, -1], max: [1, 1, 1] };

    // Physics body
    if (this.mode === 'rigid') {
      this.body = new RigidBody({
        position: options.position || [0, 0, 0],
        rotation: options.rotation || quat.identity(),
        scale: options.scale || [1, 1, 1],
        mass: options.mass || 1.0,
        boundingRadius: this._computeBoundingRadius()
      });
    } else if (this.mode === 'soft') {
      this.cage = new SoftBodyCage({
        bounds: this.bounds,
        compliance: options.compliance || 0.0001
      });
      this.body = null;
    } else {
      // Static - no physics body needed
      this.staticTransform = {
        position: options.position || [0, 0, 0],
        rotation: options.rotation || quat.identity(),
        scale: options.scale || [1, 1, 1]
      };
      this.body = null;
    }

    // Layer for compositing order
    this.layer = options.layer || 0;

    // Visibility
    this.visible = options.visible !== false;
  }

  _computeBoundingRadius() {
    const { min, max } = this.bounds;
    const size = vec3.sub(max, min);
    return vec3.length(size) * 0.5;
  }

  /**
   * Step physics simulation
   */
  step(dt, options = {}) {
    if (this.mode === 'rigid' && this.body) {
      this.body.integrate(dt, options.gravity);
    } else if (this.mode === 'soft' && this.cage) {
      this.cage.step(dt, options);
    }
  }

  /**
   * Get world-space positions for all splats
   * Returns Float32Array suitable for GPU upload
   */
  getWorldPositions() {
    if (!this.localPositions) return null;

    const worldPositions = new Float32Array(this.splatCount * 3);

    if (this.mode === 'rigid' && this.body) {
      // Apply rigid body transform to all splats
      for (let i = 0; i < this.splatCount; i++) {
        const local = [
          this.localPositions[i * 3],
          this.localPositions[i * 3 + 1],
          this.localPositions[i * 3 + 2]
        ];
        const world = this.body.transformPoint(local);
        worldPositions[i * 3] = world[0];
        worldPositions[i * 3 + 1] = world[1];
        worldPositions[i * 3 + 2] = world[2];
      }
    } else if (this.mode === 'soft' && this.cage) {
      // Interpolate from deformed cage
      for (let i = 0; i < this.splatCount; i++) {
        const local = [
          this.localPositions[i * 3],
          this.localPositions[i * 3 + 1],
          this.localPositions[i * 3 + 2]
        ];
        const world = this.cage.getDeformedPosition(local, this.bounds);
        worldPositions[i * 3] = world[0];
        worldPositions[i * 3 + 1] = world[1];
        worldPositions[i * 3 + 2] = world[2];
      }
    } else {
      // Static - just apply static transform
      const t = this.staticTransform;
      for (let i = 0; i < this.splatCount; i++) {
        const local = [
          this.localPositions[i * 3],
          this.localPositions[i * 3 + 1],
          this.localPositions[i * 3 + 2]
        ];
        const scaled = [
          local[0] * t.scale[0],
          local[1] * t.scale[1],
          local[2] * t.scale[2]
        ];
        const rotated = quat.rotateVector(t.rotation, scaled);
        const world = vec3.add(rotated, t.position);
        worldPositions[i * 3] = world[0];
        worldPositions[i * 3 + 1] = world[1];
        worldPositions[i * 3 + 2] = world[2];
      }
    }

    return worldPositions;
  }

  /**
   * Get the transformation matrix for this object
   * For rigid/static, returns single matrix
   * For soft, returns null (must use getWorldPositions)
   */
  getTransformMatrix() {
    if (this.mode === 'rigid' && this.body) {
      return this.body.getMatrix();
    } else if (this.mode === 'static') {
      // Build matrix from static transform
      const body = new RigidBody(this.staticTransform);
      return body.getMatrix();
    }
    return null; // Soft bodies need per-splat transforms
  }

  /**
   * Apply impulse to object
   */
  applyImpulse(impulse, point = null) {
    if (this.mode === 'rigid' && this.body) {
      this.body.applyImpulse(impulse);
      // TODO: Apply torque if point is offset from center
    } else if (this.mode === 'soft' && this.cage) {
      this.cage.applyForce(impulse);
    }
  }
}

/**
 * Physics world managing multiple splat objects
 */
export class SplatPhysicsWorld {
  constructor(options = {}) {
    this.objects = new Map();
    this.gravity = options.gravity || [0, -9.81, 0];
    this.groundPlane = options.groundPlane !== false; // Default: y=0 ground
    this.groundY = options.groundY || 0;

    this.time = 0;
    this.fixedDt = 1 / 60;
    this.accumulator = 0;
  }

  /**
   * Add a splat object to the world
   */
  addObject(object) {
    this.objects.set(object.id, object);
    return object;
  }

  /**
   * Remove object from world
   */
  removeObject(id) {
    this.objects.delete(id);
  }

  /**
   * Get object by ID
   */
  getObject(id) {
    return this.objects.get(id);
  }

  /**
   * Step the physics simulation
   */
  step(dt) {
    this.accumulator += dt;

    // Fixed timestep with accumulator
    while (this.accumulator >= this.fixedDt) {
      this._stepFixed(this.fixedDt);
      this.accumulator -= this.fixedDt;
      this.time += this.fixedDt;
    }
  }

  _stepFixed(dt) {
    // Step all objects
    for (const obj of this.objects.values()) {
      obj.step(dt, { gravity: this.gravity });
    }

    // Ground collision for rigid bodies
    if (this.groundPlane) {
      for (const obj of this.objects.values()) {
        if (obj.mode === 'rigid' && obj.body) {
          this._resolveGroundCollision(obj.body);
        }
      }
    }

    // TODO: Object-object collisions
  }

  _resolveGroundCollision(body) {
    const radius = body.boundingRadius || 0.5;
    const groundPenetration = this.groundY + radius - body.position[1];

    if (groundPenetration > 0) {
      // Push out of ground
      body.position[1] = this.groundY + radius;

      // Bounce
      if (body.velocity[1] < 0) {
        body.velocity[1] = -body.velocity[1] * body.restitution;

        // Friction
        body.velocity[0] *= (1 - body.friction);
        body.velocity[2] *= (1 - body.friction);
      }
    }
  }

  /**
   * Get all objects sorted by layer for rendering
   */
  getObjectsByLayer() {
    const sorted = [...this.objects.values()];
    sorted.sort((a, b) => a.layer - b.layer);
    return sorted;
  }

  /**
   * Create a splat object from a Gaussian cloud
   */
  createFromCloud(cloud, options = {}) {
    const splatCount = cloud.count;
    const localPositions = new Float32Array(splatCount * 3);
    const localScales = new Float32Array(splatCount * 3);
    const localRotations = new Float32Array(splatCount * 4);
    const colors = new Float32Array(splatCount * 3);
    const opacities = new Float32Array(splatCount);

    // Compute bounds while copying data
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];

    for (let i = 0; i < splatCount; i++) {
      const g = cloud.gaussians[i];

      localPositions[i * 3] = g.position[0];
      localPositions[i * 3 + 1] = g.position[1];
      localPositions[i * 3 + 2] = g.position[2];

      localScales[i * 3] = g.scale[0];
      localScales[i * 3 + 1] = g.scale[1];
      localScales[i * 3 + 2] = g.scale[2];

      localRotations[i * 4] = g.rotation[0];
      localRotations[i * 4 + 1] = g.rotation[1];
      localRotations[i * 4 + 2] = g.rotation[2];
      localRotations[i * 4 + 3] = g.rotation[3];

      colors[i * 3] = g.color[0];
      colors[i * 3 + 1] = g.color[1];
      colors[i * 3 + 2] = g.color[2];

      opacities[i] = g.opacity;

      // Update bounds
      for (let j = 0; j < 3; j++) {
        min[j] = Math.min(min[j], g.position[j]);
        max[j] = Math.max(max[j], g.position[j]);
      }
    }

    return new SplatObject({
      ...options,
      splatCount,
      localPositions,
      localScales,
      localRotations,
      colors,
      opacities,
      bounds: { min, max }
    });
  }
}

export default {
  quat,
  RigidBody,
  SoftBodyCage,
  SplatObject,
  SplatPhysicsWorld
};
