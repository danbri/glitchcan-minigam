/**
 * Stinkyfish WebGPU Raymarcher
 * Minimal raymarcher that renders generated WGSL scene SDFs
 */

export class StinkyfishRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.device = null;
    this.context = null;
    this.pipeline = null;
    this.uniformBuffer = null;
    this.bindGroup = null;

    // Camera state
    this.cameraDistance = 8;
    this.cameraTheta = 0.3;  // horizontal angle
    this.cameraPhi = 0.4;    // vertical angle
    this.cameraTarget = [0, 0.5, 0];

    // Mouse state
    this.isDragging = false;
    this.lastMouse = { x: 0, y: 0 };

    this.setupMouseHandlers();
  }

  setupMouseHandlers() {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.cameraTheta += dx * 0.01;
      this.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraPhi + dy * 0.01));
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cameraDistance *= 1 + e.deltaY * 0.001;
      this.cameraDistance = Math.max(2, Math.min(50, this.cameraDistance));
    });

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    });

    this.canvas.addEventListener('touchmove', (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this.lastMouse.x;
      const dy = e.touches[0].clientY - this.lastMouse.y;
      this.cameraTheta += dx * 0.01;
      this.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraPhi + dy * 0.01));
      this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    });

    this.canvas.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  getCameraPos() {
    const x = this.cameraDistance * Math.sin(this.cameraPhi) * Math.sin(this.cameraTheta);
    const y = this.cameraDistance * Math.cos(this.cameraPhi);
    const z = this.cameraDistance * Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta);
    return [
      x + this.cameraTarget[0],
      y + this.cameraTarget[1],
      z + this.cameraTarget[2]
    ];
  }

  setCamera(distance, target = [0, 0.5, 0], theta = 0.3, phi = 0.4) {
    this.cameraDistance = distance;
    this.cameraTarget = target;
    this.cameraTheta = theta;
    this.cameraPhi = phi;
  }

  async init() {
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No GPU adapter found');
    }

    this.device = await adapter.requestDevice();
    this.context = this.canvas.getContext('webgpu');

    const format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: format,
      alphaMode: 'premultiplied',
    });

    this.format = format;
    return this;
  }

  /**
   * Compile a scene with generated WGSL
   * @param {string} sceneWgsl - Generated scene WGSL from wgsl-codegen
   */
  async compileScene(sceneWgsl) {
    const shaderCode = this.buildFullShader(sceneWgsl);

    const shaderModule = this.device.createShaderModule({
      code: shaderCode,
    });

    // Check for compilation errors
    const compilationInfo = await shaderModule.getCompilationInfo();
    for (const message of compilationInfo.messages) {
      console.log(`${message.type}: ${message.message}`);
      if (message.type === 'error') {
        throw new Error(`Shader compilation error: ${message.message}`);
      }
    }

    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });

    // Create uniform buffer for camera/time
    this.uniformBuffer = this.device.createBuffer({
      size: 64, // 4 floats for resolution + time + padding
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{
        binding: 0,
        resource: { buffer: this.uniformBuffer },
      }],
    });
  }

  buildFullShader(sceneWgsl) {
    return `
// Uniforms
struct Uniforms {
  resolution: vec2f,
  time: f32,
  _pad: f32,
  cameraPos: vec3f,
  _pad2: f32,
  cameraTarget: vec3f,
  _pad3: f32,
}
@group(0) @binding(0) var<uniform> u: Uniforms;

// Fullscreen triangle vertices
var<private> positions: array<vec2f, 3> = array<vec2f, 3>(
  vec2f(-1.0, -1.0),
  vec2f(3.0, -1.0),
  vec2f(-1.0, 3.0)
);

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  let pos = positions[vertexIndex];
  output.position = vec4f(pos, 0.0, 1.0);
  output.uv = pos * 0.5 + 0.5;
  return output;
}

// ========== SCENE CODE (from wgsl-codegen) ==========
${sceneWgsl}
// ========== END SCENE CODE ==========

// Raymarching
fn rayDirection(uv: vec2f, camPos: vec3f, camTarget: vec3f) -> vec3f {
  let forward = normalize(camTarget - camPos);
  let right = normalize(cross(vec3f(0.0, 1.0, 0.0), forward));
  let up = cross(forward, right);
  return normalize(uv.x * right + uv.y * up + 1.5 * forward);
}

fn raymarch(ro: vec3f, rd: vec3f) -> vec4f {
  var t = 0.0;
  var color = vec3f(0.5, 0.5, 0.5);

  for (var i = 0; i < 100; i++) {
    let p = ro + rd * t;
    let hit = sceneSDF(p);

    if (hit.x < 0.001) {
      color = hit.yzw;

      // Simple normal calculation
      let e = 0.001;
      let n = normalize(vec3f(
        sceneSDF(p + vec3f(e, 0.0, 0.0)).x - sceneSDF(p - vec3f(e, 0.0, 0.0)).x,
        sceneSDF(p + vec3f(0.0, e, 0.0)).x - sceneSDF(p - vec3f(0.0, e, 0.0)).x,
        sceneSDF(p + vec3f(0.0, 0.0, e)).x - sceneSDF(p - vec3f(0.0, 0.0, e)).x
      ));

      // Simple lighting
      let lightDir = normalize(vec3f(1.0, 2.0, 1.0));
      let diff = max(dot(n, lightDir), 0.0);
      let ambient = 0.2;
      color = color * (ambient + diff * 0.8);

      return vec4f(color, t);
    }

    t += hit.x;
    if (t > 50.0) { break; }
  }

  return vec4f(0.1, 0.1, 0.15, -1.0);
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let aspect = u.resolution.x / u.resolution.y;
  var uv = input.uv * 2.0 - 1.0;
  uv.x *= aspect;
  uv.y = -uv.y;

  let rd = rayDirection(uv, u.cameraPos, u.cameraTarget);
  let result = raymarch(u.cameraPos, rd);

  return vec4f(result.xyz, 1.0);
}
`;
  }

  render(time = 0) {
    const width = this.canvas.width;
    const height = this.canvas.height;

    const camPos = this.getCameraPos();

    // Update uniforms
    const uniformData = new Float32Array([
      width, height, time, 0,
      camPos[0], camPos[1], camPos[2], 0,  // cameraPos
      this.cameraTarget[0], this.cameraTarget[1], this.cameraTarget[2], 0, // cameraTarget
    ]);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.draw(3); // Fullscreen triangle
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  startRenderLoop() {
    const loop = (time) => {
      this.render(time * 0.001);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
