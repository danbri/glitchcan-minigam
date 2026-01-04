/**
 * XPBD Physics System for Lucid
 *
 * Extended Position-Based Dynamics implementation for soft-body
 * simulation: chains, cloth, ragdolls, wind effects.
 *
 * LCD-044: WebGPU/iOS WebKit target (CPU fallback first)
 *
 * References:
 * - XPBD Paper: https://matthias-research.github.io/pages/publications/XPBD.pdf
 * - Müller et al. "Position Based Dynamics" (2006)
 */

/**
 * A particle in the physics simulation
 * @typedef {Object} Particle
 * @property {number[]} pos - Current position [x, y, z]
 * @property {number[]} prevPos - Previous position (for Verlet)
 * @property {number[]} velocity - Current velocity [vx, vy, vz]
 * @property {number} invMass - Inverse mass (0 = infinite mass / anchored)
 * @property {string} [name] - Optional identifier for param binding
 */

/**
 * A constraint between particles
 * @typedef {Object} Constraint
 * @property {string} type - Constraint type: 'distance', 'position', 'angle'
 * @property {number[]} particles - Indices of particles involved
 * @property {number} restValue - Rest length/angle
 * @property {number} compliance - Inverse stiffness (0 = rigid)
 */

/**
 * Create a new particle
 * @param {number[]} pos - Initial position [x, y, z]
 * @param {number} mass - Mass (0 = anchored/infinite mass)
 * @param {string} [name] - Optional name for param binding
 * @returns {Particle}
 */
export function createParticle(pos, mass = 1.0, name = null) {
  return {
    pos: [...pos],
    prevPos: [...pos],
    velocity: [0, 0, 0],
    invMass: mass > 0 ? 1.0 / mass : 0,
    name
  };
}

/**
 * Create a distance constraint between two particles
 * @param {number} particleA - Index of first particle
 * @param {number} particleB - Index of second particle
 * @param {number} restLength - Rest length of constraint
 * @param {number} compliance - Inverse stiffness (0 = rigid, higher = softer)
 * @returns {Constraint}
 */
export function createDistanceConstraint(particleA, particleB, restLength, compliance = 0) {
  return {
    type: 'distance',
    particles: [particleA, particleB],
    restValue: restLength,
    compliance
  };
}

/**
 * Create a position constraint (anchor/mouse grab)
 * @param {number} particle - Index of particle
 * @param {number[]} targetPos - Target position [x, y, z]
 * @param {number} compliance - Inverse stiffness
 * @returns {Constraint}
 */
export function createPositionConstraint(particle, targetPos, compliance = 0) {
  return {
    type: 'position',
    particles: [particle],
    restValue: 0,
    targetPos: [...targetPos],
    compliance
  };
}

/**
 * Vector math utilities
 */
export const vec3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (v, s) => [v[0] * s, v[1] * s, v[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  length: (v) => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]),
  normalize: (v) => {
    const len = vec3.length(v);
    return len > 0 ? vec3.scale(v, 1 / len) : [0, 0, 0];
  },
  copy: (v) => [...v]
};

/**
 * Integrate particle positions using Verlet integration
 * @param {Particle[]} particles - Array of particles
 * @param {number} dt - Time step in seconds
 * @param {number[]} gravity - Gravity vector [gx, gy, gz]
 */
export function integratePositions(particles, dt, gravity = [0, -9.81, 0]) {
  for (const p of particles) {
    if (p.invMass === 0) continue; // Skip anchored particles

    // Verlet: newPos = pos + (pos - prevPos) + acceleration * dt^2
    const velocity = vec3.sub(p.pos, p.prevPos);
    const acceleration = vec3.scale(gravity, dt * dt);

    p.prevPos = vec3.copy(p.pos);
    p.pos = vec3.add(vec3.add(p.pos, velocity), acceleration);
  }
}

/**
 * Solve a single distance constraint using XPBD
 * @param {Particle[]} particles - Array of particles
 * @param {Constraint} constraint - Distance constraint to solve
 * @param {number} dt - Time step
 */
export function solveDistanceConstraint(particles, constraint, dt) {
  const [iA, iB] = constraint.particles;
  const pA = particles[iA];
  const pB = particles[iB];

  const wA = pA.invMass;
  const wB = pB.invMass;
  const wSum = wA + wB;

  if (wSum === 0) return; // Both anchored, nothing to do

  const diff = vec3.sub(pB.pos, pA.pos);
  const dist = vec3.length(diff);

  if (dist === 0) return; // Coincident, avoid division by zero

  const restLength = constraint.restValue;
  const C = dist - restLength; // Constraint violation

  // XPBD compliance term
  const alpha = constraint.compliance / (dt * dt);
  // Sign: positive lambda when stretched (C > 0) pulls particles together
  const lambda = C / (wSum + alpha);

  // Direction of correction
  const n = vec3.scale(diff, 1 / dist);

  // Apply corrections proportional to inverse mass
  if (wA > 0) {
    pA.pos = vec3.add(pA.pos, vec3.scale(n, lambda * wA));
  }
  if (wB > 0) {
    pB.pos = vec3.sub(pB.pos, vec3.scale(n, lambda * wB));
  }
}

/**
 * Solve a position constraint (anchor to target)
 * @param {Particle[]} particles - Array of particles
 * @param {Constraint} constraint - Position constraint
 * @param {number} dt - Time step
 */
export function solvePositionConstraint(particles, constraint, dt) {
  const [iP] = constraint.particles;
  const p = particles[iP];

  if (p.invMass === 0) return;

  const diff = vec3.sub(constraint.targetPos, p.pos);
  const dist = vec3.length(diff);

  if (dist === 0) return;

  const alpha = constraint.compliance / (dt * dt);
  const lambda = dist / (p.invMass + alpha);

  const n = vec3.scale(diff, 1 / dist);
  p.pos = vec3.add(p.pos, vec3.scale(n, lambda * p.invMass));
}

/**
 * Run one simulation step
 * @param {Particle[]} particles - Array of particles
 * @param {Constraint[]} constraints - Array of constraints
 * @param {number} dt - Time step
 * @param {Object} options - Simulation options
 * @param {number} options.iterations - Solver iterations (default: 5)
 * @param {number[]} options.gravity - Gravity vector
 */
export function simulationStep(particles, constraints, dt, options = {}) {
  const {
    iterations = 5,
    gravity = [0, -9.81, 0]
  } = options;

  // 1. Integrate positions (predict)
  integratePositions(particles, dt, gravity);

  // 2. Solve constraints iteratively
  for (let i = 0; i < iterations; i++) {
    for (const c of constraints) {
      switch (c.type) {
        case 'distance':
          solveDistanceConstraint(particles, c, dt);
          break;
        case 'position':
          solvePositionConstraint(particles, c, dt);
          break;
      }
    }
  }

  // 3. Update velocities from position delta
  for (const p of particles) {
    if (p.invMass === 0) continue;
    p.velocity = vec3.scale(vec3.sub(p.pos, p.prevPos), 1 / dt);
  }
}

/**
 * Create a chain of particles connected by distance constraints
 * @param {number[]} startPos - Start position [x, y, z]
 * @param {number[]} direction - Chain direction (normalized)
 * @param {number} segmentLength - Length of each segment
 * @param {number} numParticles - Number of particles
 * @param {number} mass - Mass of each particle (first is anchored)
 * @returns {{particles: Particle[], constraints: Constraint[]}}
 */
export function createChain(startPos, direction, segmentLength, numParticles, mass = 1.0) {
  const particles = [];
  const constraints = [];
  const dir = vec3.normalize(direction);

  for (let i = 0; i < numParticles; i++) {
    const offset = vec3.scale(dir, i * segmentLength);
    const pos = vec3.add(startPos, offset);
    // First particle is anchored (mass = 0)
    const particleMass = i === 0 ? 0 : mass;
    particles.push(createParticle(pos, particleMass, `chain_${i}`));

    if (i > 0) {
      constraints.push(createDistanceConstraint(i - 1, i, segmentLength, 0));
    }
  }

  return { particles, constraints };
}
