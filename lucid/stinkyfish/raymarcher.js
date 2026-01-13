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
      normalEpsilon: 0.004,
      minStep: 0.006,
      relaxation: 0.5
    },
    medium: {
      maxSteps: 150,
      hitThreshold: 0.003,
      maxDistance: 50.0,
      normalEpsilon: 0.002,
      minStep: 0.004,
      relaxation: 0.7
    },
    high: {
      maxSteps: 200,
      hitThreshold: 0.002,
      maxDistance: 50.0,
      normalEpsilon: 0.001,
      minStep: 0.003,
      relaxation: 0.6
    }
  };

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} [options]
   * @param {boolean} [options.disableControls=false] - Disable built-in mouse/touch controls (use when parent provides controls)
   */
  constructor(canvas, options = {}) {
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
      bgColor: [0.1, 0.1, 0.15]
    };

    // Lighting settings (Mayfly parity - Phong model)
    this.lighting = {
      lightDir: [1.0, 1.0, -1.0],
      ambient: 0.8,
      diffuse: 0.8,
      specular: 0.3,
      shininess: 32
    };

    // Display settings (Mayfly parity)
    this.showGroundPlane = false;
    this.showAxes = false;
    this.groundOpacity = 0.6;        // Base ground opacity (0-1)
    this.groundOpacityTarget = 0.6;  // Target for animation

    // Scene parameters (from loaded scene JSON)
    this.sceneParams = {};
    this.sceneParamValues = {};

    // Animation/time state (Shadertoy-style inputs)
    this.startTime = performance.now();
    this.overrideTime = null;  // When set, use this instead of elapsed time
    this.frameCount = 0;       // iFrame equivalent
    this.lastFrameTime = 0;    // For calculating delta time
    this.timeDelta = 0;        // Time between frames (seconds)

    // Mouse state (iMouse equivalent: xy = current pos, zw = click pos)
    this.mouse = { x: 0, y: 0, clickX: 0, clickY: 0, isDown: false };

    // Mouse state for camera control
    this.isDragging = false;
    this.lastMouse = { x: 0, y: 0 };

    // Only setup built-in controls if not disabled
    // (disabled when parent like index.html provides its own controls)
    this._controlsDisabled = options.disableControls || false;
    if (!this._controlsDisabled) {
      this.setupMouseHandlers();
    }
  }

  setRenderSettings(settings) {
    Object.assign(this.renderSettings, settings);
  }

  /**
   * Set lighting parameters (Mayfly API parity)
   * @param {Object} settings - Lighting settings
   * @param {number[]} [settings.lightDir] - Light direction [x, y, z]
   * @param {number} [settings.ambient] - Ambient intensity (0-1)
   * @param {number} [settings.diffuse] - Diffuse intensity (0-1)
   * @param {number} [settings.specular] - Specular intensity (0-1)
   * @param {number} [settings.shininess] - Specular shininess (1-128)
   */
  setLighting(settings) {
    if (settings.lightDir) this.lighting.lightDir = settings.lightDir;
    if (settings.ambient !== undefined) this.lighting.ambient = settings.ambient;
    if (settings.diffuse !== undefined) this.lighting.diffuse = settings.diffuse;
    if (settings.specular !== undefined) this.lighting.specular = settings.specular;
    if (settings.shininess !== undefined) this.lighting.shininess = settings.shininess;
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

    // Helper to get mouse position in canvas pixels (Shadertoy-style)
    const getCanvasPos = (clientX, clientY) => {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      return {
        x: (clientX - rect.left) * dpr,
        y: (rect.height - (clientY - rect.top)) * dpr  // Y inverted for GL convention
      };
    };

    this.canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isDragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';

      // Update iMouse click position (z, w)
      const pos = getCanvasPos(e.clientX, e.clientY);
      this.mouse.clickX = pos.x;
      this.mouse.clickY = pos.y;
      this.mouse.isDown = true;
    });

    window.addEventListener('mouseup', (e) => {
      this.isDragging = false;
      this.mouse.isDown = false;
      this.canvas.style.cursor = 'grab';
    });

    window.addEventListener('mousemove', (e) => {
      // Always update mouse position for iMouse uniform
      const pos = getCanvasPos(e.clientX, e.clientY);
      this.mouse.x = pos.x;
      this.mouse.y = pos.y;

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

    // Touch support (also updates iMouse)
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };

        // Update iMouse click position
        const pos = getCanvasPos(e.touches[0].clientX, e.touches[0].clientY);
        this.mouse.clickX = pos.x;
        this.mouse.clickY = pos.y;
        this.mouse.x = pos.x;
        this.mouse.y = pos.y;
        this.mouse.isDown = true;
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.isDragging || e.touches.length !== 1) return;

      // Update iMouse position
      const pos = getCanvasPos(e.touches[0].clientX, e.touches[0].clientY);
      this.mouse.x = pos.x;
      this.mouse.y = pos.y;

      const dx = e.touches[0].clientX - this.lastMouse.x;
      const dy = e.touches[0].clientY - this.lastMouse.y;
      this.cameraTheta += dx * 0.01;
      this.cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraPhi + dy * 0.01));
      this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.isDragging = false;
      this.mouse.isDown = false;
    });

    // Set initial cursor
    this.canvas.style.cursor = 'grab';
  }

  /**
   * Update mouse state externally (for when parent provides controls)
   * @param {number} x - Current X position (pixels)
   * @param {number} y - Current Y position (pixels)
   * @param {boolean} isDown - Whether mouse/touch is pressed
   * @param {number} clickX - X position where click started (optional)
   * @param {number} clickY - Y position where click started (optional)
   */
  updateMouse(x, y, isDown = false, clickX = null, clickY = null) {
    this.mouse.x = x;
    this.mouse.y = y;
    this.mouse.isDown = isDown;
    if (clickX !== null) this.mouse.clickX = clickX;
    if (clickY !== null) this.mouse.clickY = clickY;
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
    console.log(`WebGPU swapchain format: ${format}`);

    // Track if format is sRGB (auto gamma correction) vs linear (needs manual gamma)
    this.isSrgbFormat = format.includes('srgb');

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
    console.log(`Swapchain format: ${this.format} (sRGB: ${this.isSrgbFormat})`);
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
    // Layout (16-byte aligned blocks):
    //   resolution(2) + time(1) + pad(1)                    = 16 bytes
    //   cameraPos(3) + pad(1)                               = 16 bytes
    //   cameraTarget(3) + pad(1)                            = 16 bytes
    //   maxSteps(1) + hitThreshold(1) + maxDistance(1) + normalEpsilon(1) = 16 bytes
    //   minStep(1) + relaxation(1) + pad(2)                 = 16 bytes
    //   lightDir(3) + ambient(1)                            = 16 bytes
    //   diffuse(1) + specular(1) + shininess(1) + showGroundPlane(1) = 16 bytes
    //   showAxes(1) + groundOpacity(1) + pad(2)             = 16 bytes
    //   bgColor(3) + pad(1)                                 = 16 bytes
    // Total: 144 bytes
    this.uniformBuffer = this.device.createBuffer({
      size: 160,
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
// Uniforms (Shadertoy-style inputs)
struct Uniforms {
  resolution: vec2f,  // iResolution.xy
  time: f32,          // iTime (seconds since start)
  timeDelta: f32,     // iTimeDelta (seconds since last frame)
  cameraPos: vec3f,
  _pad2: f32,
  cameraTarget: vec3f,
  _pad3: f32,
  // Render settings
  maxSteps: f32,
  hitThreshold: f32,
  maxDistance: f32,
  normalEpsilon: f32,
  minStep: f32,
  relaxation: f32,
  _pad6: f32,
  _pad7: f32,
  // Lighting (Phong, Mayfly parity)
  lightDir: vec3f,
  ambient: f32,
  diffuse: f32,
  specular: f32,
  shininess: f32,
  showGroundPlane: f32,
  showAxes: f32,
  groundOpacity: f32,
  _pad4b: f32,
  _pad4c: f32,
  bgColor: vec3f,
  frame: f32,           // iFrame (frame count since start)
  mouse: vec4f,         // iMouse: xy = current pos, zw = click pos (pixel coords)
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

// Ground plane checkerboard pattern
fn getGroundColor(p: vec3f) -> vec3f {
  let scale = 0.5;
  let q = floor(p.xz / scale);
  let checker = (i32(q.x) + i32(q.y)) % 2;
  let color1 = vec3f(0.15, 0.15, 0.2);
  let color2 = vec3f(0.25, 0.25, 0.3);
  return select(color1, color2, checker == 1);
}

// Axis arrows SDF - Blender-style RGB arrows
// Returns vec4(distance, r, g, b)
fn sdAxisArrows(p: vec3f) -> vec4f {
  let arrowLen = 2.5;
  let shaftR = 0.035;
  let headR = 0.10;
  let headH = 0.22;

  // X axis - Red arrow (positive X direction)
  let px = p - vec3f(arrowLen * 0.5, 0.0, 0.0);
  let dXshaft = length(vec2f(length(px.yz), max(abs(px.x) - arrowLen * 0.5 + headH, 0.0))) - shaftR;
  let pxHead = p - vec3f(arrowLen, 0.0, 0.0);
  var dXhead = length(vec2f(length(pxHead.yz) - headR * (1.0 - clamp(pxHead.x / headH, 0.0, 1.0)), max(-pxHead.x, pxHead.x - headH)));
  dXhead = max(dXhead, -pxHead.x);
  let dX = min(dXshaft, dXhead);

  // Y axis - Green arrow (positive Y direction)
  let py = p - vec3f(0.0, arrowLen * 0.5, 0.0);
  let dYshaft = length(vec2f(length(py.xz), max(abs(py.y) - arrowLen * 0.5 + headH, 0.0))) - shaftR;
  let pyHead = p - vec3f(0.0, arrowLen, 0.0);
  var dYhead = length(vec2f(length(pyHead.xz) - headR * (1.0 - clamp(pyHead.y / headH, 0.0, 1.0)), max(-pyHead.y, pyHead.y - headH)));
  dYhead = max(dYhead, -pyHead.y);
  let dY = min(dYshaft, dYhead);

  // Z axis - Blue arrow (positive Z direction)
  let pz = p - vec3f(0.0, 0.0, arrowLen * 0.5);
  let dZshaft = length(vec2f(length(pz.xy), max(abs(pz.z) - arrowLen * 0.5 + headH, 0.0))) - shaftR;
  let pzHead = p - vec3f(0.0, 0.0, arrowLen);
  var dZhead = length(vec2f(length(pzHead.xy) - headR * (1.0 - clamp(pzHead.z / headH, 0.0, 1.0)), max(-pzHead.z, pzHead.z - headH)));
  dZhead = max(dZhead, -pzHead.z);
  let dZ = min(dZshaft, dZhead);

  // Find closest axis and return with color
  if (dX < dY && dX < dZ) {
    return vec4f(dX, 0.9, 0.2, 0.2);  // Red for X
  } else if (dY < dZ) {
    return vec4f(dY, 0.2, 0.9, 0.2);  // Green for Y
  } else {
    return vec4f(dZ, 0.3, 0.4, 0.9);  // Blue for Z
  }
}

// Raymarching
fn rayDirection(uv: vec2f, camPos: vec3f, camTarget: vec3f) -> vec3f {
  let forward = normalize(camTarget - camPos);
  let right = normalize(cross(vec3f(0.0, 1.0, 0.0), forward));
  let up = cross(forward, right);
  // FOV matched to Mayfly (~90 degrees)
  return normalize(uv.x * right + uv.y * up + forward);
}

fn raymarch(ro: vec3f, rd: vec3f, uv: vec2f) -> vec4f {
  var t = 0.0;
  var color = vec3f(0.5, 0.5, 0.5);
  let steps = i32(u.maxSteps);

  // Ground plane: compute ray-plane intersection ONCE
  var groundT = -1.0;
  var groundHitPos = vec3f(0.0);
  if (u.showGroundPlane > 0.5 && abs(rd.y) > 0.001) {
    let groundY = 0.0;  // Ground at Y=0
    groundT = (groundY - ro.y) / rd.y;
    if (groundT > 0.0) {
      groundHitPos = ro + rd * groundT;
    }
  }

  // Track scene hit
  var sceneHitT = -1.0;
  var sceneHitColor = vec3f(0.0);
  var sceneHitNormal = vec3f(0.0);
  var hitIsAxis = false;  // Track if we hit an axis (skip lighting)

  for (var i = 0; i < 200; i++) {
    if (i >= steps) { break; }
    let p = ro + rd * t;
    var hit = sceneSDF(p);
    var isAxisHit = false;

    // Check axes if enabled
    if (u.showAxes > 0.5) {
      let axes = sdAxisArrows(p);
      if (axes.x < hit.x) {
        hit = vec4f(axes.x, axes.yzw);
        isAxisHit = true;
      }
    }

    if (hit.x < u.hitThreshold && sceneHitT < 0.0) {
      sceneHitT = t;
      sceneHitColor = hit.yzw;
      hitIsAxis = isAxisHit;

      // Only calculate normal for non-axis hits (axis uses flat color)
      if (!isAxisHit) {
        let e = u.normalEpsilon;
        sceneHitNormal = normalize(vec3f(
          sceneSDF(p + vec3f(e, 0.0, 0.0)).x - sceneSDF(p - vec3f(e, 0.0, 0.0)).x,
          sceneSDF(p + vec3f(0.0, e, 0.0)).x - sceneSDF(p - vec3f(0.0, e, 0.0)).x,
          sceneSDF(p + vec3f(0.0, 0.0, e)).x - sceneSDF(p - vec3f(0.0, 0.0, e)).x
        ));
      }
      break;
    }

    // Conservative stepping with minimum step size (Mayfly parity)
    t += max(abs(hit.x) * u.relaxation, u.minStep);
    if (t > u.maxDistance) { break; }
  }

  // Surface mode: compare scene hit vs ground plane, render closer one (matching Mayfly)
  let useGround = groundT > 0.0 && (sceneHitT < 0.0 || groundT < sceneHitT);

  if (useGround) {
    // Render ground plane with checkerboard and translucency
    let normal = vec3f(0.0, 1.0, 0.0);
    let light = normalize(u.lightDir);
    let diff = max(dot(normal, light), 0.0);
    let groundCol = getGroundColor(groundHitPos) * (u.ambient + diff * u.diffuse);

    // Background gradient matches Mayfly
    let bg = mix(vec3f(0.02, 0.02, 0.08), vec3f(0.05, 0.0, 0.1), uv.y * 0.5 + 0.5);

    // Blend with background based on ground opacity
    color = mix(bg, groundCol, u.groundOpacity);

    // Add slight fade at distance for more natural look
    let distFade = 1.0 - smoothstep(10.0, 30.0, groundT);
    color = mix(bg, color, distFade);

    return vec4f(color, groundT);
  }

  if (sceneHitT > 0.0) {
    if (hitIsAxis) {
      // Axis arrows use flat colors (no lighting) for clean RGB display
      color = sceneHitColor;
    } else {
      // Scene objects use Phong lighting (matching Mayfly)
      let light = normalize(u.lightDir);
      let diff = max(dot(sceneHitNormal, light), 0.0);
      let spec = pow(max(dot(reflect(-light, sceneHitNormal), -rd), 0.0), u.shininess);
      color = sceneHitColor * (u.ambient + diff * u.diffuse) + vec3f(spec * u.specular);
    }
    return vec4f(color, sceneHitT);
  }

  // No hit - return gradient background matching Mayfly
  let bg = mix(vec3f(0.02, 0.02, 0.08), vec3f(0.05, 0.0, 0.1), uv.y * 0.5 + 0.5);
  return vec4f(bg, -1.0);
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  // UV calculation matching Mayfly exactly:
  // Mayfly: (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y
  // This centers at (0,0) and normalizes by height only
  let fragCoord = input.uv * u.resolution;
  var uv = (fragCoord - 0.5 * u.resolution) / u.resolution.y;
  // Note: No Y flip needed - input.uv.y=0 at bottom matches WebGL gl_FragCoord

  let rd = rayDirection(uv, u.cameraPos, u.cameraTarget);
  let result = raymarch(u.cameraPos, rd, uv);

  // No gamma correction for surface mode - matches Mayfly behavior
  // Mayfly only applies gamma in volume mode, not surface mode
  // WebGL/WebGPU both display linear colors the same way for surface rendering
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

  render(physicsParams = null) {
    // Guard: need pipeline and valid canvas size
    if (!this.pipeline || !this.device || !this.context) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Skip render if canvas has no size
    if (width === 0 || height === 0) return;

    // Calculate time (Shadertoy-style: seconds since start)
    const now = performance.now();
    const time = this.overrideTime !== null
      ? this.overrideTime
      : (now - this.startTime) / 1000.0;

    // Calculate delta time
    this.timeDelta = this.lastFrameTime > 0 ? (now - this.lastFrameTime) / 1000.0 : 0;
    this.lastFrameTime = now;

    // Increment frame counter
    this.frameCount++;

    const camPos = this.getCameraPos();
    const rs = this.renderSettings;
    const lt = this.lighting;

    // Animate ground opacity toward target (smooth interpolation)
    const opacityLerpSpeed = 0.1;
    this.groundOpacity += (this.groundOpacityTarget - this.groundOpacity) * opacityLerpSpeed;

    // Update main uniforms (must match shader struct layout)
    const m = this.mouse;
    const uniformData = new Float32Array([
      width, height, time, this.timeDelta,  // resolution + time + timeDelta
      camPos[0], camPos[1], camPos[2], 0,  // cameraPos
      this.cameraTarget[0], this.cameraTarget[1], this.cameraTarget[2], 0, // cameraTarget
      // Render settings
      rs.maxSteps, rs.hitThreshold, rs.maxDistance, rs.normalEpsilon,
      rs.minStep, rs.relaxation, 0, 0,  // minStep + relaxation + 2 pads
      // Lighting (Blinn-Phong)
      lt.lightDir[0], lt.lightDir[1], lt.lightDir[2], lt.ambient,
      lt.diffuse, lt.specular, lt.shininess, this.showGroundPlane ? 1.0 : 0.0,
      // Display settings
      this.showAxes ? 1.0 : 0.0, this.groundOpacity, 0, 0,  // showAxes + groundOpacity + 2 pads
      rs.bgColor[0], rs.bgColor[1], rs.bgColor[2], this.frameCount, // bgColor + frame
      m.x, m.y, m.clickX, m.clickY,  // mouse (iMouse style: xy=current, zw=click)
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

    const loop = () => {
      if (!this.isVisible) {
        this.animationId = null;
        return;
      }
      this.render();  // Time is now computed internally
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }
}
