/**
 * Instanced Gaussian Splat Renderer
 *
 * WebGL2 renderer that supports:
 * - Multiple splat templates
 * - Per-instance transforms (position, rotation, scale, color)
 * - Animated transforms via expression evaluation
 * - Depth-sorted rendering
 */

export class InstancedSplatRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true
    });

    if (!this.gl) {
      throw new Error('WebGL2 not supported');
    }

    this.options = {
      sortMode: options.sortMode || 'perInstance',  // 'perInstance', 'global', 'none'
      maxInstances: options.maxInstances || 1000,
      maxSplatsPerTemplate: options.maxSplatsPerTemplate || 5000,
      ...options
    };

    this.templates = new Map();  // templateId -> { cloud, vao, buffers }
    this.instances = [];         // { templateId, transform, color, visible, ... }
    this.time = 0;

    this.camera = {
      position: [0, 0, 5],
      target: [0, 0, 0],
      up: [0, 1, 0],
      fov: 45,
      near: 0.1,
      far: 100
    };

    this.init();
  }

  init() {
    const gl = this.gl;

    // Compile shaders
    this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);

    // Get attribute/uniform locations
    this.locations = {
      // Per-splat attributes
      a_position: gl.getAttribLocation(this.program, 'a_position'),
      a_scale: gl.getAttribLocation(this.program, 'a_scale'),
      a_rotation: gl.getAttribLocation(this.program, 'a_rotation'),
      a_color: gl.getAttribLocation(this.program, 'a_color'),
      a_opacity: gl.getAttribLocation(this.program, 'a_opacity'),

      // Per-instance attributes (instanced)
      a_instanceTransform: gl.getAttribLocation(this.program, 'a_instanceTransform'),
      a_instanceColor: gl.getAttribLocation(this.program, 'a_instanceColor'),

      // Uniforms
      u_viewMatrix: gl.getUniformLocation(this.program, 'u_viewMatrix'),
      u_projMatrix: gl.getUniformLocation(this.program, 'u_projMatrix'),
      u_viewport: gl.getUniformLocation(this.program, 'u_viewport'),
      u_time: gl.getUniformLocation(this.program, 'u_time')
    };

    // Create quad geometry for splatting
    this.quadBuffer = this.createQuadBuffer();

    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Disable depth write for transparency
    gl.depthMask(false);
    gl.enable(gl.DEPTH_TEST);
  }

  createProgram(vsSource, fsSource) {
    const gl = this.gl;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      throw new Error('Vertex shader error: ' + gl.getShaderInfoLog(vs));
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      throw new Error('Fragment shader error: ' + gl.getShaderInfoLog(fs));
    }

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
    }

    return program;
  }

  createQuadBuffer() {
    const gl = this.gl;

    // Unit quad vertices (will be scaled by Gaussian size in shader)
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
       1,  1,
      -1,  1
    ]);

    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    return { vao, vbo, ebo };
  }

  /**
   * Add a splat template
   * @param {string} id - Template ID
   * @param {GaussianCloud} cloud - Gaussian cloud
   */
  addTemplate(id, cloud) {
    const gl = this.gl;

    // Create buffers for this template
    const data = cloud.toFloat32Array();

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Splat data buffer
    const splatBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, splatBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    // Set up per-splat attributes
    const stride = 14 * 4;  // 14 floats per Gaussian

    // Position (3 floats)
    gl.enableVertexAttribArray(this.locations.a_position);
    gl.vertexAttribPointer(this.locations.a_position, 3, gl.FLOAT, false, stride, 0);

    // Scale (3 floats)
    gl.enableVertexAttribArray(this.locations.a_scale);
    gl.vertexAttribPointer(this.locations.a_scale, 3, gl.FLOAT, false, stride, 12);

    // Rotation (4 floats)
    gl.enableVertexAttribArray(this.locations.a_rotation);
    gl.vertexAttribPointer(this.locations.a_rotation, 4, gl.FLOAT, false, stride, 24);

    // Color (3 floats)
    gl.enableVertexAttribArray(this.locations.a_color);
    gl.vertexAttribPointer(this.locations.a_color, 3, gl.FLOAT, false, stride, 40);

    // Opacity (1 float)
    gl.enableVertexAttribArray(this.locations.a_opacity);
    gl.vertexAttribPointer(this.locations.a_opacity, 1, gl.FLOAT, false, stride, 52);

    // Instance transform buffer (will be updated per-frame)
    const instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.options.maxInstances * 20 * 4, gl.DYNAMIC_DRAW);

    // Instance transform (mat4 = 4 vec4s)
    for (let i = 0; i < 4; i++) {
      const loc = this.locations.a_instanceTransform + i;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 20 * 4, i * 16);
      gl.vertexAttribDivisor(loc, 1);
    }

    // Instance color (vec4)
    gl.enableVertexAttribArray(this.locations.a_instanceColor);
    gl.vertexAttribPointer(this.locations.a_instanceColor, 4, gl.FLOAT, false, 20 * 4, 64);
    gl.vertexAttribDivisor(this.locations.a_instanceColor, 1);

    gl.bindVertexArray(null);

    this.templates.set(id, {
      cloud,
      vao,
      splatBuffer,
      instanceBuffer,
      splatCount: cloud.count
    });
  }

  /**
   * Add an instance of a template
   */
  addInstance(templateId, instanceData = {}) {
    const instance = {
      id: instanceData.id || `${templateId}_${this.instances.length}`,
      templateId,
      transform: instanceData.transform || {
        translate: [0, 0, 0],
        rotate: [0, 0, 0],
        scale: [1, 1, 1]
      },
      color: instanceData.color || [1, 1, 1, 1],
      visible: instanceData.visible !== false,
      animation: instanceData.animation || null
    };

    this.instances.push(instance);
    return instance.id;
  }

  /**
   * Update instance transform
   */
  setInstanceTransform(instanceId, transform) {
    const instance = this.instances.find(i => i.id === instanceId);
    if (instance) {
      Object.assign(instance.transform, transform);
    }
  }

  /**
   * Set instance visibility
   */
  setInstanceVisible(instanceId, visible) {
    const instance = this.instances.find(i => i.id === instanceId);
    if (instance) {
      instance.visible = visible;
    }
  }

  /**
   * Set instance color tint
   */
  setInstanceColor(instanceId, color) {
    const instance = this.instances.find(i => i.id === instanceId);
    if (instance) {
      instance.color = color;
    }
  }

  /**
   * Set animation time
   */
  setTime(time) {
    this.time = time;
  }

  /**
   * Update camera
   */
  setCamera(camera) {
    Object.assign(this.camera, camera);
  }

  /**
   * Main render function
   */
  render() {
    const gl = this.gl;

    // Update canvas size
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    // Clear
    gl.clearColor(0.12, 0.13, 0.18, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use program
    gl.useProgram(this.program);

    // Set view/projection matrices
    const viewMatrix = this.computeViewMatrix();
    const projMatrix = this.computeProjMatrix(width / height);

    gl.uniformMatrix4fv(this.locations.u_viewMatrix, false, viewMatrix);
    gl.uniformMatrix4fv(this.locations.u_projMatrix, false, projMatrix);
    gl.uniform2f(this.locations.u_viewport, width, height);
    gl.uniform1f(this.locations.u_time, this.time);

    // Render each template with its instances
    for (const [templateId, template] of this.templates) {
      this.renderTemplate(templateId, template, viewMatrix);
    }
  }

  renderTemplate(templateId, template, viewMatrix) {
    const gl = this.gl;

    // Get visible instances for this template
    const instances = this.instances.filter(
      i => i.templateId === templateId && i.visible
    );

    if (instances.length === 0) return;

    // Sort instances by depth (back to front)
    if (this.options.sortMode === 'perInstance') {
      instances.sort((a, b) => {
        const posA = this.getInstancePosition(a);
        const posB = this.getInstancePosition(b);
        const zA = this.transformDepth(posA, viewMatrix);
        const zB = this.transformDepth(posB, viewMatrix);
        return zA - zB;  // Back to front
      });
    }

    // Build instance data buffer
    const instanceData = new Float32Array(instances.length * 20);

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      const offset = i * 20;

      // Evaluate animated transform if present
      const transform = this.evaluateTransform(inst);

      // Build 4x4 transform matrix
      const matrix = this.buildTransformMatrix(transform);

      // Copy matrix (16 floats)
      instanceData.set(matrix, offset);

      // Copy color (4 floats)
      const color = this.evaluateColor(inst);
      instanceData.set(color, offset + 16);
    }

    // Upload instance data
    gl.bindBuffer(gl.ARRAY_BUFFER, template.instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instanceData);

    // Bind VAO and draw
    gl.bindVertexArray(template.vao);

    // Draw instanced points (one point per Gaussian, expanded to quad in shader)
    gl.drawArraysInstanced(gl.POINTS, 0, template.splatCount, instances.length);

    gl.bindVertexArray(null);
  }

  getInstancePosition(instance) {
    const t = instance.transform.translate || [0, 0, 0];
    return t;
  }

  transformDepth(pos, viewMatrix) {
    // Transform point by view matrix and return Z
    return viewMatrix[2] * pos[0] +
           viewMatrix[6] * pos[1] +
           viewMatrix[10] * pos[2] +
           viewMatrix[14];
  }

  evaluateTransform(instance) {
    if (!instance.animation) {
      return instance.transform;
    }

    // Evaluate animated transform
    const anim = instance.animation;
    const result = { ...instance.transform };

    if (anim.translate) {
      result.translate = this.evaluateVec3(anim.translate);
    }
    if (anim.rotate) {
      result.rotate = this.evaluateVec3(anim.rotate);
    }
    if (anim.scale) {
      const s = this.evaluateExpr(anim.scale);
      result.scale = typeof s === 'number' ? [s, s, s] : s;
    }

    return result;
  }

  evaluateColor(instance) {
    if (instance.animation?.color) {
      return this.evaluateVec4(instance.animation.color);
    }
    return instance.color;
  }

  evaluateVec3(arr) {
    return arr.map(v => this.evaluateExpr(v));
  }

  evaluateVec4(arr) {
    return arr.map(v => this.evaluateExpr(v));
  }

  evaluateExpr(expr) {
    if (typeof expr === 'number') return expr;
    if (typeof expr === 'string') {
      if (expr === 'time') return this.time;
      return 0;
    }
    if (!expr || !expr.expr) return 0;

    const args = (expr.args || []).map(a => this.evaluateExpr(a));

    switch (expr.expr) {
      case 'add': return args.reduce((a, b) => a + b, 0);
      case 'sub': return args[0] - args[1];
      case 'mul': return args.reduce((a, b) => a * b, 1);
      case 'div': return args[0] / args[1];
      case 'sin': return Math.sin(args[0]);
      case 'cos': return Math.cos(args[0]);
      case 'mix': return args[0] * (1 - args[2]) + args[1] * args[2];
      case 'smoothstep': {
        const edge0 = args[0], edge1 = args[1], x = args[2];
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
      }
      default: return 0;
    }
  }

  buildTransformMatrix(transform) {
    const t = transform.translate || [0, 0, 0];
    const r = transform.rotate || [0, 0, 0];
    const s = transform.scale || [1, 1, 1];

    // Convert Euler angles to radians
    const rx = r[0] * Math.PI / 180;
    const ry = r[1] * Math.PI / 180;
    const rz = r[2] * Math.PI / 180;

    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const cz = Math.cos(rz), sz = Math.sin(rz);

    // Build rotation matrix (ZYX order)
    const m = new Float32Array(16);

    m[0] = cy * cz * s[0];
    m[1] = (sx * sy * cz + cx * sz) * s[0];
    m[2] = (-cx * sy * cz + sx * sz) * s[0];
    m[3] = 0;

    m[4] = -cy * sz * s[1];
    m[5] = (-sx * sy * sz + cx * cz) * s[1];
    m[6] = (cx * sy * sz + sx * cz) * s[1];
    m[7] = 0;

    m[8] = sy * s[2];
    m[9] = -sx * cy * s[2];
    m[10] = cx * cy * s[2];
    m[11] = 0;

    m[12] = t[0];
    m[13] = t[1];
    m[14] = t[2];
    m[15] = 1;

    return m;
  }

  computeViewMatrix() {
    const { position, target, up } = this.camera;

    // Compute look-at matrix
    const zAxis = normalize([
      position[0] - target[0],
      position[1] - target[1],
      position[2] - target[2]
    ]);
    const xAxis = normalize(cross(up, zAxis));
    const yAxis = cross(zAxis, xAxis);

    return new Float32Array([
      xAxis[0], yAxis[0], zAxis[0], 0,
      xAxis[1], yAxis[1], zAxis[1], 0,
      xAxis[2], yAxis[2], zAxis[2], 0,
      -dot(xAxis, position), -dot(yAxis, position), -dot(zAxis, position), 1
    ]);
  }

  computeProjMatrix(aspect) {
    const fov = this.camera.fov * Math.PI / 180;
    const near = this.camera.near;
    const far = this.camera.far;

    const f = 1 / Math.tan(fov / 2);

    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / (near - far), -1,
      0, 0, 2 * far * near / (near - far), 0
    ]);
  }

  /**
   * Dispose of all resources
   */
  dispose() {
    const gl = this.gl;

    for (const [, template] of this.templates) {
      gl.deleteBuffer(template.splatBuffer);
      gl.deleteBuffer(template.instanceBuffer);
      gl.deleteVertexArray(template.vao);
    }

    gl.deleteProgram(this.program);
    gl.deleteBuffer(this.quadBuffer.vbo);
    gl.deleteBuffer(this.quadBuffer.ebo);
    gl.deleteVertexArray(this.quadBuffer.vao);
  }
}

// Vector math utilities
function normalize(v) {
  const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
  return len > 0 ? [v[0]/len, v[1]/len, v[2]/len] : [0, 0, 0];
}

function cross(a, b) {
  return [
    a[1]*b[2] - a[2]*b[1],
    a[2]*b[0] - a[0]*b[2],
    a[0]*b[1] - a[1]*b[0]
  ];
}

function dot(a, b) {
  return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

// Shaders
const VERTEX_SHADER = `#version 300 es
precision highp float;

// Per-Gaussian attributes
in vec3 a_position;
in vec3 a_scale;
in vec4 a_rotation;
in vec3 a_color;
in float a_opacity;

// Per-instance attributes
in mat4 a_instanceTransform;
in vec4 a_instanceColor;

// Uniforms
uniform mat4 u_viewMatrix;
uniform mat4 u_projMatrix;
uniform vec2 u_viewport;
uniform float u_time;

// Outputs to fragment shader
out vec3 v_color;
out float v_opacity;
out vec2 v_offset;

void main() {
    // Apply instance transform to Gaussian position
    vec4 worldPos = a_instanceTransform * vec4(a_position, 1.0);

    // Transform to view space
    vec4 viewPos = u_viewMatrix * worldPos;

    // Project to clip space
    vec4 clipPos = u_projMatrix * viewPos;

    // Compute splat size in screen space
    float splatSize = max(a_scale.x, max(a_scale.y, a_scale.z));
    float screenSize = splatSize * u_viewport.y / (-viewPos.z);
    screenSize = clamp(screenSize, 1.0, 100.0);

    // Set point size
    gl_PointSize = screenSize * 4.0;
    gl_Position = clipPos;

    // Pass color and opacity (modulated by instance color)
    v_color = a_color * a_instanceColor.rgb;
    v_opacity = a_opacity * a_instanceColor.a;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_color;
in float v_opacity;

out vec4 fragColor;

void main() {
    // Gaussian falloff from center
    vec2 coord = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(coord, coord);

    // Gaussian: exp(-r^2 / (2 * sigma^2)), with sigma = 0.5
    float alpha = exp(-r2 * 2.0) * v_opacity;

    // Discard nearly transparent pixels
    if (alpha < 0.01) discard;

    // Simple lighting boost - ambient + slight color enhancement
    vec3 ambient = vec3(0.15);
    vec3 color = v_color * 1.2 + ambient;
    color = clamp(color, 0.0, 1.0);

    fragColor = vec4(color, alpha);
}
`;

export default InstancedSplatRenderer;
