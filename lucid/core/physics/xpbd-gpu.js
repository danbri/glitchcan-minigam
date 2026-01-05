/**
 * WebGPU XPBD Physics System
 *
 * GPU-accelerated position-based dynamics for real-time physics.
 * Designed for iOS Safari WebGPU compatibility (Safari 26+).
 *
 * LCD-044: WebGPU physics with CPU fallback
 *
 * Features:
 * - Particle-based simulation on GPU compute shaders
 * - Distance constraints (legs, chains, cloth)
 * - Position constraints (foot targets, anchors)
 * - Integrates with Lucid SDF renderer via param binding
 */

// ============================================================================
// WGSL Compute Shaders
// ============================================================================

const XPBD_COMPUTE_SHADER = /* wgsl */`
// Particle data structure (packed for GPU efficiency)
// Each particle: 16 floats = 64 bytes
struct Particle {
  pos: vec3<f32>,        // Current position
  invMass: f32,          // Inverse mass (0 = static)
  prevPos: vec3<f32>,    // Previous position (for Verlet)
  radius: f32,           // Collision radius
  velocity: vec3<f32>,   // Current velocity
  _pad: f32,             // Padding for alignment
};

// Distance constraint: maintain length between two particles
struct DistanceConstraint {
  particleA: u32,        // First particle index
  particleB: u32,        // Second particle index
  restLength: f32,       // Target distance
  compliance: f32,       // Inverse stiffness (0 = rigid)
};

// Position constraint: anchor particle to target
struct PositionConstraint {
  particle: u32,         // Particle index
  _pad0: u32,
  target: vec3<f32>,     // Target position
  compliance: f32,       // Inverse stiffness
};

// Simulation parameters
struct SimParams {
  dt: f32,               // Time step
  gravity: vec3<f32>,    // Gravity vector
  damping: f32,          // Velocity damping (0.99 typical)
  groundY: f32,          // Ground plane Y position
  numParticles: u32,     // Number of particles
  numDistConstraints: u32,
  numPosConstraints: u32,
  _pad: u32,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<storage, read> distConstraints: array<DistanceConstraint>;
@group(0) @binding(2) var<storage, read> posConstraints: array<PositionConstraint>;
@group(0) @binding(3) var<uniform> params: SimParams;

// Integrate positions using Verlet integration
@compute @workgroup_size(64)
fn integrate(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.numParticles) { return; }

  var p = particles[idx];
  if (p.invMass == 0.0) { return; } // Skip static particles

  // Verlet integration: newPos = pos + (pos - prevPos) + gravity * dt^2
  let velocity = p.pos - p.prevPos;
  let dt2 = params.dt * params.dt;

  p.prevPos = p.pos;
  p.pos = p.pos + velocity * params.damping + params.gravity * dt2;
  p.velocity = velocity / params.dt;

  particles[idx] = p;
}

// Solve distance constraints
@compute @workgroup_size(64)
fn solveDistanceConstraints(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.numDistConstraints) { return; }

  let c = distConstraints[idx];
  var pA = particles[c.particleA];
  var pB = particles[c.particleB];

  let wA = pA.invMass;
  let wB = pB.invMass;
  let wSum = wA + wB;
  if (wSum == 0.0) { return; } // Both static

  let diff = pB.pos - pA.pos;
  let dist = length(diff);
  if (dist < 0.0001) { return; } // Avoid division by zero

  let C = dist - c.restLength; // Constraint violation

  // XPBD compliance term
  let alpha = c.compliance / (params.dt * params.dt);
  let lambda = C / (wSum + alpha);

  // Direction of correction
  let n = diff / dist;

  // Apply corrections proportional to inverse mass
  // Note: Atomic operations would be needed for parallel safety
  // For now, we use sequential constraint solving
  if (wA > 0.0) {
    pA.pos = pA.pos + n * lambda * wA;
    particles[c.particleA] = pA;
  }
  if (wB > 0.0) {
    pB.pos = pB.pos - n * lambda * wB;
    particles[c.particleB] = pB;
  }
}

// Solve position constraints (anchors, foot targets)
@compute @workgroup_size(64)
fn solvePositionConstraints(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.numPosConstraints) { return; }

  let c = posConstraints[idx];
  var p = particles[c.particle];

  if (p.invMass == 0.0) { return; }

  let diff = c.target - p.pos;
  let dist = length(diff);
  if (dist < 0.0001) { return; }

  // XPBD compliance term
  let alpha = c.compliance / (params.dt * params.dt);
  let lambda = dist / (p.invMass + alpha);

  let n = diff / dist;
  p.pos = p.pos + n * lambda * p.invMass;

  particles[c.particle] = p;
}

// Ground collision constraint
@compute @workgroup_size(64)
fn solveGroundCollision(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.numParticles) { return; }

  var p = particles[idx];
  if (p.invMass == 0.0) { return; }

  let groundContact = params.groundY + p.radius;
  if (p.pos.y < groundContact) {
    p.pos.y = groundContact;

    // Bounce with energy loss
    if (p.velocity.y < 0.0) {
      let restitution = 0.3;
      p.velocity.y = -p.velocity.y * restitution;

      // Update prevPos to reflect velocity change
      p.prevPos.y = p.pos.y - p.velocity.y * params.dt;
    }
  }

  particles[idx] = p;
}

// Update velocities from position changes
@compute @workgroup_size(64)
fn updateVelocities(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.numParticles) { return; }

  var p = particles[idx];
  if (p.invMass == 0.0) { return; }

  p.velocity = (p.pos - p.prevPos) / params.dt;
  particles[idx] = p;
}
`;

// ============================================================================
// GPU Physics System Class
// ============================================================================

export class XPBDPhysicsGPU {
  constructor() {
    this.device = null;
    this.particles = [];
    this.distConstraints = [];
    this.posConstraints = [];
    this.isGPU = false;
    this.initialized = false;

    // GPU resources
    this.particleBuffer = null;
    this.distConstraintBuffer = null;
    this.posConstraintBuffer = null;
    this.paramsBuffer = null;
    this.bindGroup = null;
    this.pipelines = {};

    // Simulation parameters
    this.params = {
      dt: 1/60,
      gravity: [0, -9.8, 0],
      damping: 0.99,
      groundY: -2,
      iterations: 4
    };

    // Param bindings: particle name -> uniform name
    this.paramBindings = new Map();
  }

  /**
   * Initialize WebGPU device and resources
   * @returns {Promise<boolean>} True if GPU init succeeded
   */
  async initGPU() {
    if (!('gpu' in navigator)) {
      console.log('WebGPU not available, using CPU fallback');
      return false;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.log('No GPU adapter found, using CPU fallback');
        return false;
      }

      this.device = await adapter.requestDevice();
      this.isGPU = true;

      // Create compute pipelines
      await this.createPipelines();

      console.log('WebGPU XPBD initialized successfully');
      return true;
    } catch (err) {
      console.warn('WebGPU init failed:', err);
      return false;
    }
  }

  /**
   * Create compute shader pipelines
   */
  async createPipelines() {
    const shaderModule = this.device.createShaderModule({
      code: XPBD_COMPUTE_SHADER
    });

    // Bind group layout for all pipelines
    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }
      ]
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout]
    });

    // Create pipelines for each compute stage
    const stages = ['integrate', 'solveDistanceConstraints', 'solvePositionConstraints',
                    'solveGroundCollision', 'updateVelocities'];

    for (const stage of stages) {
      this.pipelines[stage] = this.device.createComputePipeline({
        layout: pipelineLayout,
        compute: {
          module: shaderModule,
          entryPoint: stage
        }
      });
    }
  }

  /**
   * Add a particle to the simulation
   * @param {Object} config - Particle configuration
   * @returns {number} Particle index
   */
  addParticle(config) {
    const particle = {
      pos: config.pos || [0, 0, 0],
      prevPos: config.pos ? [...config.pos] : [0, 0, 0],
      velocity: config.velocity || [0, 0, 0],
      invMass: config.mass > 0 ? 1.0 / config.mass : 0,
      radius: config.radius || 0.1,
      name: config.name || null
    };

    const idx = this.particles.length;
    this.particles.push(particle);

    // Register param binding if named
    if (particle.name) {
      this.paramBindings.set(particle.name, idx);
    }

    return idx;
  }

  /**
   * Add a distance constraint
   * @param {number} particleA - First particle index
   * @param {number} particleB - Second particle index
   * @param {number} restLength - Rest length (null = auto from current positions)
   * @param {number} compliance - Inverse stiffness (0 = rigid)
   */
  addDistanceConstraint(particleA, particleB, restLength = null, compliance = 0) {
    if (restLength === null) {
      const pA = this.particles[particleA];
      const pB = this.particles[particleB];
      restLength = Math.sqrt(
        (pB.pos[0] - pA.pos[0]) ** 2 +
        (pB.pos[1] - pA.pos[1]) ** 2 +
        (pB.pos[2] - pA.pos[2]) ** 2
      );
    }

    this.distConstraints.push({ particleA, particleB, restLength, compliance });
  }

  /**
   * Add a position constraint (anchor to target)
   * @param {number} particle - Particle index
   * @param {number[]} target - Target position
   * @param {number} compliance - Inverse stiffness
   */
  addPositionConstraint(particle, target, compliance = 0.001) {
    this.posConstraints.push({ particle, target: [...target], compliance });
  }

  /**
   * Update position constraint target (for animated targets like walk cycle)
   * @param {number} constraintIdx - Constraint index
   * @param {number[]} target - New target position
   */
  updatePositionTarget(constraintIdx, target) {
    if (constraintIdx < this.posConstraints.length) {
      this.posConstraints[constraintIdx].target = [...target];
    }
  }

  /**
   * Build GPU buffers from particle/constraint data
   */
  buildBuffers() {
    if (!this.isGPU) return;

    // Particle buffer (16 floats per particle, 64 bytes)
    const particleData = new Float32Array(this.particles.length * 16);
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const offset = i * 16;
      particleData.set(p.pos, offset);           // pos
      particleData[offset + 3] = p.invMass;      // invMass
      particleData.set(p.prevPos, offset + 4);   // prevPos
      particleData[offset + 7] = p.radius;       // radius
      particleData.set(p.velocity, offset + 8);  // velocity
      particleData[offset + 11] = 0;             // padding
    }

    this.particleBuffer = this.device.createBuffer({
      size: Math.max(64, particleData.byteLength),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(this.particleBuffer.getMappedRange()).set(particleData);
    this.particleBuffer.unmap();

    // Distance constraints buffer
    const distData = new Float32Array(this.distConstraints.length * 4);
    for (let i = 0; i < this.distConstraints.length; i++) {
      const c = this.distConstraints[i];
      const offset = i * 4;
      // Pack as u32, u32, f32, f32 - but we're using Float32Array
      // For simplicity, store indices as floats (works for < 16M particles)
      distData[offset] = c.particleA;
      distData[offset + 1] = c.particleB;
      distData[offset + 2] = c.restLength;
      distData[offset + 3] = c.compliance;
    }

    this.distConstraintBuffer = this.device.createBuffer({
      size: Math.max(16, distData.byteLength),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(this.distConstraintBuffer.getMappedRange()).set(distData);
    this.distConstraintBuffer.unmap();

    // Position constraints buffer
    const posData = new Float32Array(this.posConstraints.length * 8);
    for (let i = 0; i < this.posConstraints.length; i++) {
      const c = this.posConstraints[i];
      const offset = i * 8;
      posData[offset] = c.particle;
      posData[offset + 1] = 0; // padding
      posData.set(c.target, offset + 2);
      posData[offset + 5] = c.compliance;
      posData[offset + 6] = 0; // padding
      posData[offset + 7] = 0; // padding
    }

    this.posConstraintBuffer = this.device.createBuffer({
      size: Math.max(32, posData.byteLength),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(this.posConstraintBuffer.getMappedRange()).set(posData);
    this.posConstraintBuffer.unmap();

    // Params uniform buffer (must be 16-byte aligned)
    this.paramsBuffer = this.device.createBuffer({
      size: 48, // dt(4) + gravity(12) + damping(4) + groundY(4) + counts(12) + pad(8)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.updateParamsBuffer();

    // Create bind group
    this.bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.particleBuffer } },
        { binding: 1, resource: { buffer: this.distConstraintBuffer } },
        { binding: 2, resource: { buffer: this.posConstraintBuffer } },
        { binding: 3, resource: { buffer: this.paramsBuffer } }
      ]
    });

    // Staging buffer for reading back results
    this.stagingBuffer = this.device.createBuffer({
      size: particleData.byteLength,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });

    this.initialized = true;
  }

  /**
   * Update params uniform buffer
   */
  updateParamsBuffer() {
    if (!this.paramsBuffer) return;

    const data = new Float32Array(12);
    data[0] = this.params.dt;
    data.set(this.params.gravity, 1);
    data[4] = this.params.damping;
    data[5] = this.params.groundY;
    // Pack counts as floats (reinterpreted as u32 in shader)
    const countView = new Uint32Array(data.buffer, 24, 3);
    countView[0] = this.particles.length;
    countView[1] = this.distConstraints.length;
    countView[2] = this.posConstraints.length;

    this.device.queue.writeBuffer(this.paramsBuffer, 0, data);
  }

  /**
   * Run one physics simulation step on GPU
   */
  async stepGPU() {
    if (!this.initialized) return;

    const numParticles = this.particles.length;
    const numDistConstraints = this.distConstraints.length;
    const numPosConstraints = this.posConstraints.length;

    const workgroupSize = 64;
    const particleWorkgroups = Math.ceil(numParticles / workgroupSize);
    const distWorkgroups = Math.ceil(numDistConstraints / workgroupSize);
    const posWorkgroups = Math.ceil(numPosConstraints / workgroupSize);

    const commandEncoder = this.device.createCommandEncoder();

    // Integration pass
    {
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(this.pipelines.integrate);
      pass.setBindGroup(0, this.bindGroup);
      pass.dispatchWorkgroups(particleWorkgroups);
      pass.end();
    }

    // Constraint solving iterations
    for (let iter = 0; iter < this.params.iterations; iter++) {
      // Distance constraints
      if (numDistConstraints > 0) {
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(this.pipelines.solveDistanceConstraints);
        pass.setBindGroup(0, this.bindGroup);
        pass.dispatchWorkgroups(distWorkgroups);
        pass.end();
      }

      // Position constraints
      if (numPosConstraints > 0) {
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(this.pipelines.solvePositionConstraints);
        pass.setBindGroup(0, this.bindGroup);
        pass.dispatchWorkgroups(posWorkgroups);
        pass.end();
      }

      // Ground collision
      {
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(this.pipelines.solveGroundCollision);
        pass.setBindGroup(0, this.bindGroup);
        pass.dispatchWorkgroups(particleWorkgroups);
        pass.end();
      }
    }

    // Update velocities
    {
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(this.pipelines.updateVelocities);
      pass.setBindGroup(0, this.bindGroup);
      pass.dispatchWorkgroups(particleWorkgroups);
      pass.end();
    }

    // Copy results to staging buffer for CPU readback
    commandEncoder.copyBufferToBuffer(
      this.particleBuffer, 0,
      this.stagingBuffer, 0,
      this.particles.length * 64
    );

    this.device.queue.submit([commandEncoder.finish()]);

    // Read back particle positions
    await this.stagingBuffer.mapAsync(GPUMapMode.READ);
    const data = new Float32Array(this.stagingBuffer.getMappedRange());

    for (let i = 0; i < this.particles.length; i++) {
      const offset = i * 16;
      this.particles[i].pos = [data[offset], data[offset + 1], data[offset + 2]];
      this.particles[i].velocity = [data[offset + 8], data[offset + 9], data[offset + 10]];
    }

    this.stagingBuffer.unmap();
  }

  /**
   * Run one physics step (CPU fallback)
   */
  stepCPU() {
    const dt = this.params.dt;
    const gravity = this.params.gravity;
    const damping = this.params.damping;

    // Integrate
    for (const p of this.particles) {
      if (p.invMass === 0) continue;

      const velocity = [
        p.pos[0] - p.prevPos[0],
        p.pos[1] - p.prevPos[1],
        p.pos[2] - p.prevPos[2]
      ];

      p.prevPos = [...p.pos];
      p.pos[0] += velocity[0] * damping + gravity[0] * dt * dt;
      p.pos[1] += velocity[1] * damping + gravity[1] * dt * dt;
      p.pos[2] += velocity[2] * damping + gravity[2] * dt * dt;
    }

    // Constraint iterations
    for (let iter = 0; iter < this.params.iterations; iter++) {
      // Distance constraints
      for (const c of this.distConstraints) {
        const pA = this.particles[c.particleA];
        const pB = this.particles[c.particleB];

        const wSum = pA.invMass + pB.invMass;
        if (wSum === 0) continue;

        const diff = [
          pB.pos[0] - pA.pos[0],
          pB.pos[1] - pA.pos[1],
          pB.pos[2] - pA.pos[2]
        ];
        const dist = Math.sqrt(diff[0]**2 + diff[1]**2 + diff[2]**2);
        if (dist < 0.0001) continue;

        const C = dist - c.restLength;
        const alpha = c.compliance / (dt * dt);
        const lambda = C / (wSum + alpha);

        const n = [diff[0]/dist, diff[1]/dist, diff[2]/dist];

        if (pA.invMass > 0) {
          pA.pos[0] += n[0] * lambda * pA.invMass;
          pA.pos[1] += n[1] * lambda * pA.invMass;
          pA.pos[2] += n[2] * lambda * pA.invMass;
        }
        if (pB.invMass > 0) {
          pB.pos[0] -= n[0] * lambda * pB.invMass;
          pB.pos[1] -= n[1] * lambda * pB.invMass;
          pB.pos[2] -= n[2] * lambda * pB.invMass;
        }
      }

      // Position constraints
      for (const c of this.posConstraints) {
        const p = this.particles[c.particle];
        if (p.invMass === 0) continue;

        const diff = [
          c.target[0] - p.pos[0],
          c.target[1] - p.pos[1],
          c.target[2] - p.pos[2]
        ];
        const dist = Math.sqrt(diff[0]**2 + diff[1]**2 + diff[2]**2);
        if (dist < 0.0001) continue;

        const alpha = c.compliance / (dt * dt);
        const lambda = dist / (p.invMass + alpha);

        const n = [diff[0]/dist, diff[1]/dist, diff[2]/dist];
        p.pos[0] += n[0] * lambda * p.invMass;
        p.pos[1] += n[1] * lambda * p.invMass;
        p.pos[2] += n[2] * lambda * p.invMass;
      }

      // Ground collision
      for (const p of this.particles) {
        if (p.invMass === 0) continue;

        const groundContact = this.params.groundY + p.radius;
        if (p.pos[1] < groundContact) {
          p.pos[1] = groundContact;
        }
      }
    }

    // Update velocities
    for (const p of this.particles) {
      if (p.invMass === 0) continue;
      p.velocity = [
        (p.pos[0] - p.prevPos[0]) / dt,
        (p.pos[1] - p.prevPos[1]) / dt,
        (p.pos[2] - p.prevPos[2]) / dt
      ];
    }
  }

  /**
   * Run one physics step (auto-selects GPU or CPU)
   */
  async step() {
    if (this.isGPU && this.initialized) {
      await this.stepGPU();
    } else {
      this.stepCPU();
    }
  }

  /**
   * Get particle positions as param values for SDF uniforms
   * @returns {Object} Map of paramName -> [x, y, z]
   */
  getParamValues() {
    const values = {};

    for (const [name, idx] of this.paramBindings) {
      const p = this.particles[idx];
      values[name] = [...p.pos];
      values[`${name}_vel`] = [...p.velocity];
    }

    return values;
  }

  /**
   * Apply impulse to a named particle
   * @param {string} name - Particle name
   * @param {number[]} impulse - Impulse vector
   */
  applyImpulse(name, impulse) {
    const idx = this.paramBindings.get(name);
    if (idx === undefined) return;

    const p = this.particles[idx];
    if (p.invMass === 0) return;

    // Impulse changes velocity: Δv = impulse / mass
    p.velocity[0] += impulse[0] * p.invMass;
    p.velocity[1] += impulse[1] * p.invMass;
    p.velocity[2] += impulse[2] * p.invMass;

    // Update prevPos to reflect new velocity (for Verlet)
    const dt = this.params.dt;
    p.prevPos[0] = p.pos[0] - p.velocity[0] * dt;
    p.prevPos[1] = p.pos[1] - p.velocity[1] * dt;
    p.prevPos[2] = p.pos[2] - p.velocity[2] * dt;
  }
}

