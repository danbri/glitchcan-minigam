/**
 * Stinkyfish WebGPU Raymarcher
 * Minimal raymarcher that renders generated WGSL scene SDFs
 */

export class StinkyfishRenderer {
  // Quality presets matching Mayfly exactly
  static QUALITY_PRESETS = {
    low: {
      maxSteps: 100,
      hitThreshold: 0.005,
      maxDistance: 50.0,
      normalEpsilon: 0.004
    },
    medium: {
      maxSteps: 150,
      hitThreshold: 0.003,
      maxDistance: 50.0,
      normalEpsilon: 0.002
    },
    high: {
      maxSteps: 200,
      hitThreshold: 0.002,
      maxDistance: 50.0,
      normalEpsilon: 0.001
    }
  };

  constructor(canvas) {
    this.canvas = canvas;
    this.device = null;
    this.context = null;
    this.pipeline = null;
    this.uniformBuffer = null;
    this.bindGroup = null;
    this.sceneUniformBuffer = null;
    this.sceneBindGroup = null;
    this.sceneUniformLayout = null; // Track layout for scene params

    // Camera state (Mayfly parity)
    this.cameraDistance = 4.0;
    this.cameraTheta = 0.0;
    this.cameraPhi = Math.PI / 4;  // 45 degrees
    this.cameraTarget = [0, 0, 0];

    // Render settings (Mayfly 'medium' quality)
    this.quality = 'medium';
    this.renderSettings = {
      ...StinkyfishRenderer.QUALITY_PRESETS.medium,
      keyIntensity: 0.7,
      fillIntensity: 0.3,
      rimIntensity: 0.15,
      ambient: 0.15,
      bgColor: [0.1, 0.1, 0.15]
    };

    // Scene parameters (from loaded scene JSON)
    this.sceneParams = {};
    this.sceneParamValues = {};

    // Mouse state
    this.isDragging = false;
    this.lastMouse = { x: 0, y: 0 };

    this.setupMouseHandlers();
  }

  setRenderSettings(settings) {
    Object.assign(this.renderSettings, settings);
  }

  /**
   * Set quality preset (Mayfly API parity)
   * @param {string} quality - 'low', 'medium', or 'high'
   */
  setQuality(quality) {
    if (StinkyfishRenderer.QUALITY_PRESETS[quality]) {
      this.quality = quality;
      Object.assign(this.renderSettings, StinkyfishRenderer.QUALITY_PRESETS[quality]);
    }
  }

  /**
   * Initialize scene parameters from loaded scene JSON
   * @param {Object} params - Scene params object from JSON
   */
  setSceneParams(params) {
    this.sceneParams = params || {};
    this.sceneParamValues = {};

    // Initialize values from defaults
    for (const [name, param] of Object.entries(this.sceneParams)) {
      if (param.type === 'color3' || param.type === 'position3' || param.type === 'radii3' || param.type === 'direction3') {
        this.sceneParamValues[name] = param.value || [0, 0, 0];
      } else {
        this.sceneParamValues[name] = param.value !== undefined ? param.value : 0;
      }
    }
  }

  /**
   * Update a single scene parameter value
   * @param {string} name - Parameter name
   * @param {number|Array} value - New value (scalar or vec3)
   */
  setSceneParam(name, value) {
    if (this.sceneParams[name]) {
      this.sceneParamValues[name] = value;
    }
  }

  /**
   * Alias for setSceneParam - provides API compatibility with Mayfly
   */
  setParam(name, value) {
    this.setSceneParam(name, value);
  }

  setupMouseHandlers() {
    // Prevent context menu on canvas
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isDragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', (e) => {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.cameraTheta += dx * 0.01;
      this.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraPhi + dy * 0.01));
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.cameraDistance *= 1 + e.deltaY * 0.001;
      this.cameraDistance = Math.max(1, Math.min(100, this.cameraDistance));
    }, { passive: false });

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this.lastMouse.x;
      const dy = e.touches[0].clientY - this.lastMouse.y;
      this.cameraTheta += dx * 0.01;
      this.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraPhi + dy * 0.01));
      this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.isDragging = false;
    });

    // Set initial cursor
    this.canvas.style.cursor = 'grab';
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

  /**
   * Handle canvas resize - reconfigure WebGPU context if needed
   * @param {number} width - New canvas width
   * @param {number} height - New canvas height
   */
  resize(width, height) {
    if (!this.context || !this.device) return;

    // WebGPU handles canvas resize automatically via getCurrentTexture()
    // but we should ensure the canvas dimensions are set
    if (this.canvas.width !== width) {
      this.canvas.width = width;
    }
    if (this.canvas.height !== height) {
      this.canvas.height = height;
    }

    // Reconfigure context if it was lost or needs refresh
    if (this.format) {
      try {
        this.context.configure({
          device: this.device,
          format: this.format,
          alphaMode: 'premultiplied',
        });
      } catch (e) {
        // Context may already be configured, ignore
      }
    }
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
   * @param {Object} sceneUniformLayout - Layout info for scene params (name -> type)
   */
  async compileScene(sceneWgsl, sceneUniformLayout = null) {
    const shaderCode = this.buildFullShader(sceneWgsl);
    console.log(`Full shader size: ${shaderCode.length} chars, ${shaderCode.split('\n').length} lines`);

    const shaderModule = this.device.createShaderModule({
      code: shaderCode,
    });

    // Check for compilation errors
    const compilationInfo = await shaderModule.getCompilationInfo();
    console.log(`Shader compilation messages: ${compilationInfo.messages.length}`);
    for (const message of compilationInfo.messages) {
      console.log(`${message.type}: ${message.message} (line ${message.lineNum}, col ${message.linePos})`);
      if (message.type === 'error') {
        // Log context around the error
        const lines = shaderCode.split('\n');
        const errLine = message.lineNum - 1;
        if (errLine >= 0 && errLine < lines.length) {
          console.log('Error context:');
          for (let i = Math.max(0, errLine - 2); i <= Math.min(lines.length - 1, errLine + 2); i++) {
            console.log(`${i === errLine ? '>>>' : '   '} ${i + 1}: ${lines[i]}`);
          }
        }
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

    // Create uniform buffer for camera/time/render settings
    // Layout: resolution(2) + time(1) + pad(1) + cameraPos(3) + pad(1) + cameraTarget(3) + pad(1)
    //         + maxSteps(1) + hitThreshold(1) + maxDistance(1) + normalEpsilon(1)
    //         + keyIntensity(1) + fillIntensity(1) + rimIntensity(1) + ambient(1)
    //         + bgColor(3) + pad(1)
    this.uniformBuffer = this.device.createBuffer({
      size: 128, // Extended for render settings
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{
        binding: 0,
        resource: { buffer: this.uniformBuffer },
      }],
    });

    // Create scene uniforms buffer if layout provided (group 1)
    this.sceneUniformLayout = sceneUniformLayout;
    if (sceneUniformLayout && Object.keys(sceneUniformLayout).length > 0) {
      // Calculate buffer size: each entry is either f32 (4 bytes) or vec3f (12 bytes), with padding
      let bufferSize = 0;
      for (const [name, type] of Object.entries(sceneUniformLayout)) {
        if (type === 'vec3f') {
          bufferSize += 16; // vec3f needs 16-byte alignment (12 data + 4 pad)
        } else {
          bufferSize += 4; // f32
        }
      }
      // Round up to 16-byte alignment
      bufferSize = Math.ceil(bufferSize / 16) * 16;

      this.sceneUniformBuffer = this.device.createBuffer({
        size: Math.max(16, bufferSize),
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      this.sceneBindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(1),
        entries: [{
          binding: 0,
          resource: { buffer: this.sceneUniformBuffer },
        }],
      });

      console.log(`Created scene uniform buffer: ${bufferSize} bytes for ${Object.keys(sceneUniformLayout).length} params`);
    } else {
      this.sceneUniformBuffer = null;
      this.sceneBindGroup = null;
    }
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
  // Render settings
  maxSteps: f32,
  hitThreshold: f32,
  maxDistance: f32,
  normalEpsilon: f32,
  keyIntensity: f32,
  fillIntensity: f32,
  rimIntensity: f32,
  ambient: f32,
  bgColor: vec3f,
  _pad4: f32,
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
  let steps = i32(u.maxSteps);

  for (var i = 0; i < 200; i++) {
    if (i >= steps) { break; }
    let p = ro + rd * t;
    let hit = sceneSDF(p);

    if (hit.x < u.hitThreshold) {
      color = hit.yzw;

      // Normal calculation
      let e = u.normalEpsilon;
      let n = normalize(vec3f(
        sceneSDF(p + vec3f(e, 0.0, 0.0)).x - sceneSDF(p - vec3f(e, 0.0, 0.0)).x,
        sceneSDF(p + vec3f(0.0, e, 0.0)).x - sceneSDF(p - vec3f(0.0, e, 0.0)).x,
        sceneSDF(p + vec3f(0.0, 0.0, e)).x - sceneSDF(p - vec3f(0.0, 0.0, e)).x
      ));

      // Simple 3-point lighting
      let keyDir = normalize(vec3f(1.0, 2.0, 1.5));
      let fillDir = normalize(vec3f(-1.0, 0.5, 0.0));

      let keyLight = max(dot(n, keyDir), 0.0) * u.keyIntensity;
      let fillLight = max(dot(n, fillDir), 0.0) * u.fillIntensity;
      let rimLight = pow(max(1.0 - dot(n, -rd), 0.0), 3.0) * u.rimIntensity;

      color = color * (u.ambient + keyLight + fillLight) + vec3f(rimLight);

      return vec4f(color, t);
    }

    t += hit.x;
    if (t > u.maxDistance) { break; }
  }

  return vec4f(u.bgColor, -1.0);
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let aspect = u.resolution.x / u.resolution.y;
  var uv = input.uv * 2.0 - 1.0;
  uv.x *= aspect;
  uv.y = -uv.y;  // WebGPU framebuffer Y is top-down, unlike WebGL

  let rd = rayDirection(uv, u.cameraPos, u.cameraTarget);
  let result = raymarch(u.cameraPos, rd);

  return vec4f(result.xyz, 1.0);
}
`;
  }

  /**
   * Update scene uniform values (physics params, custom params, etc.)
   * @param {Object} sceneParamValues - Map of param name -> value (number or [x,y,z])
   */
  updateSceneUniforms(sceneParamValues) {
    if (!this.sceneUniformBuffer || !this.sceneUniformLayout) return;

    // Build buffer data matching the layout order
    const data = [];
    for (const [name, type] of Object.entries(this.sceneUniformLayout)) {
      // Layout has u_ prefix, sceneParamValues might not
      const baseName = name.startsWith('u_') ? name.slice(2) : name;
      const value = sceneParamValues[name] ?? sceneParamValues[baseName];
      if (type === 'vec3f') {
        if (Array.isArray(value) && value.length >= 3) {
          data.push(value[0], value[1], value[2], 0); // vec3 + padding
        } else {
          data.push(0, 0, 0, 0); // default
        }
      } else {
        data.push(typeof value === 'number' ? value : 0);
      }
    }

    const uniformData = new Float32Array(data);
    this.device.queue.writeBuffer(this.sceneUniformBuffer, 0, uniformData);
  }

  render(time = 0, physicsParams = null) {
    // Guard: need pipeline and valid canvas size
    if (!this.pipeline || !this.device || !this.context) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Skip render if canvas has no size
    if (width === 0 || height === 0) return;

    const camPos = this.getCameraPos();
    const rs = this.renderSettings;

    // Update main uniforms (must match shader struct layout)
    const uniformData = new Float32Array([
      width, height, time, 0,
      camPos[0], camPos[1], camPos[2], 0,  // cameraPos
      this.cameraTarget[0], this.cameraTarget[1], this.cameraTarget[2], 0, // cameraTarget
      // Render settings
      rs.maxSteps, rs.hitThreshold, rs.maxDistance, rs.normalEpsilon,
      rs.keyIntensity, rs.fillIntensity, rs.rimIntensity, rs.ambient,
      rs.bgColor[0], rs.bgColor[1], rs.bgColor[2], 0, // bgColor + pad
    ]);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    // Merge scene params and physics params
    if (this.sceneUniformBuffer && this.sceneUniformLayout) {
      const allParams = { ...this.sceneParamValues };

      // Physics params override (phys_ball, etc.)
      if (physicsParams) {
        Object.assign(allParams, physicsParams);
      }

      if (Object.keys(allParams).length > 0) {
        this.updateSceneUniforms(allParams);
      }
    }

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
    if (this.sceneBindGroup) {
      renderPass.setBindGroup(1, this.sceneBindGroup);
    }
    renderPass.draw(3); // Fullscreen triangle
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  startRenderLoop() {
    this.isVisible = true;
    this.animationId = null;

    // Pause when tab is hidden
    document.addEventListener('visibilitychange', () => {
      this.isVisible = document.visibilityState === 'visible';
      if (this.isVisible && !this.animationId) {
        this.animationId = requestAnimationFrame(loop);
      }
    });

    // Pause when scrolled off-screen
    const observer = new IntersectionObserver((entries) => {
      this.isVisible = entries[0].isIntersecting;
      if (this.isVisible && !this.animationId) {
        this.animationId = requestAnimationFrame(loop);
      }
    }, { threshold: 0.1 });
    observer.observe(this.canvas);

    const loop = (time) => {
      if (!this.isVisible) {
        this.animationId = null;
        return;
      }
      this.render(time * 0.001);
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }
}
