/**
 * Anisotropic Gaussian Splat Renderer
 *
 * WebGL2 renderer with TRUE Gaussian splatting:
 * - 3D covariance from scale + rotation quaternion
 * - Proper projection to 2D screen-space covariance
 * - Elliptical Gaussian evaluation in fragment shader
 * - View-sorted alpha blending
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
      sortMode: options.sortMode || 'perInstance',
      maxInstances: options.maxInstances || 1000,
      maxSplatsPerTemplate: options.maxSplatsPerTemplate || 50000,
      ...options
    };

    this.templates = new Map();
    this.instances = [];
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

    // Get locations
    this.locations = {
      a_position: gl.getAttribLocation(this.program, 'a_position'),
      a_scale: gl.getAttribLocation(this.program, 'a_scale'),
      a_rotation: gl.getAttribLocation(this.program, 'a_rotation'),
      a_color: gl.getAttribLocation(this.program, 'a_color'),
      a_opacity: gl.getAttribLocation(this.program, 'a_opacity'),
      a_quadVertex: gl.getAttribLocation(this.program, 'a_quadVertex'),
      a_instanceTransform: gl.getAttribLocation(this.program, 'a_instanceTransform'),
      a_instanceColor: gl.getAttribLocation(this.program, 'a_instanceColor'),
      u_viewMatrix: gl.getUniformLocation(this.program, 'u_viewMatrix'),
      u_projMatrix: gl.getUniformLocation(this.program, 'u_projMatrix'),
      u_viewport: gl.getUniformLocation(this.program, 'u_viewport'),
      u_time: gl.getUniformLocation(this.program, 'u_time'),
      u_focal: gl.getUniformLocation(this.program, 'u_focal')
    };

    // Create quad vertices for billboards
    this.quadBuffer = this.createQuadBuffer();

    // Blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
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

    // Unit quad for billboards: will be transformed by 2D covariance
    const vertices = new Float32Array([
      -2, -2,
       2, -2,
       2,  2,
      -2,  2
    ]);

    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Quad vertex attribute (location 0 reserved)
    gl.enableVertexAttribArray(this.locations.a_quadVertex);
    gl.vertexAttribPointer(this.locations.a_quadVertex, 2, gl.FLOAT, false, 0, 0);

    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    return { vao, vbo, ebo };
  }

  addTemplate(id, cloud) {
    const gl = this.gl;
    const data = cloud.toFloat32Array();

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Quad vertices (shared)
    const quadVerts = new Float32Array([-2,-2, 2,-2, 2,2, -2,2]);
    const quadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.locations.a_quadVertex);
    gl.vertexAttribPointer(this.locations.a_quadVertex, 2, gl.FLOAT, false, 0, 0);

    // Splat data buffer
    const splatBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, splatBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    const stride = 14 * 4;  // 14 floats per Gaussian

    // Position (3 floats)
    gl.enableVertexAttribArray(this.locations.a_position);
    gl.vertexAttribPointer(this.locations.a_position, 3, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(this.locations.a_position, 1);

    // Scale (3 floats) - anisotropic!
    gl.enableVertexAttribArray(this.locations.a_scale);
    gl.vertexAttribPointer(this.locations.a_scale, 3, gl.FLOAT, false, stride, 12);
    gl.vertexAttribDivisor(this.locations.a_scale, 1);

    // Rotation quaternion (4 floats)
    gl.enableVertexAttribArray(this.locations.a_rotation);
    gl.vertexAttribPointer(this.locations.a_rotation, 4, gl.FLOAT, false, stride, 24);
    gl.vertexAttribDivisor(this.locations.a_rotation, 1);

    // Color (3 floats)
    gl.enableVertexAttribArray(this.locations.a_color);
    gl.vertexAttribPointer(this.locations.a_color, 3, gl.FLOAT, false, stride, 40);
    gl.vertexAttribDivisor(this.locations.a_color, 1);

    // Opacity (1 float)
    gl.enableVertexAttribArray(this.locations.a_opacity);
    gl.vertexAttribPointer(this.locations.a_opacity, 1, gl.FLOAT, false, stride, 52);
    gl.vertexAttribDivisor(this.locations.a_opacity, 1);

    // Instance transform buffer
    const instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.options.maxInstances * 20 * 4, gl.DYNAMIC_DRAW);

    for (let i = 0; i < 4; i++) {
      const loc = this.locations.a_instanceTransform + i;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 20 * 4, i * 16);
      gl.vertexAttribDivisor(loc, cloud.count);  // One per full splat set
    }

    gl.enableVertexAttribArray(this.locations.a_instanceColor);
    gl.vertexAttribPointer(this.locations.a_instanceColor, 4, gl.FLOAT, false, 20 * 4, 64);
    gl.vertexAttribDivisor(this.locations.a_instanceColor, cloud.count);

    // Index buffer for quads
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2, 0,2,3]), gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    this.templates.set(id, {
      cloud,
      vao,
      splatBuffer,
      instanceBuffer,
      indexBuffer,
      quadVbo,
      splatCount: cloud.count
    });
  }

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

  setInstanceTransform(instanceId, transform) {
    const instance = this.instances.find(i => i.id === instanceId);
    if (instance) Object.assign(instance.transform, transform);
  }

  setInstanceVisible(instanceId, visible) {
    const instance = this.instances.find(i => i.id === instanceId);
    if (instance) instance.visible = visible;
  }

  setInstanceColor(instanceId, color) {
    const instance = this.instances.find(i => i.id === instanceId);
    if (instance) instance.color = color;
  }

  setTime(time) { this.time = time; }
  setCamera(camera) { Object.assign(this.camera, camera); }

  render() {
    const gl = this.gl;

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    gl.clearColor(0.12, 0.13, 0.18, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);

    const viewMatrix = this.computeViewMatrix();
    const projMatrix = this.computeProjMatrix(width / height);

    // Compute focal length from projection matrix
    const focalX = projMatrix[0] * width / 2;
    const focalY = projMatrix[5] * height / 2;

    gl.uniformMatrix4fv(this.locations.u_viewMatrix, false, viewMatrix);
    gl.uniformMatrix4fv(this.locations.u_projMatrix, false, projMatrix);
    gl.uniform2f(this.locations.u_viewport, width, height);
    gl.uniform2f(this.locations.u_focal, focalX, focalY);
    gl.uniform1f(this.locations.u_time, this.time);

    for (const [templateId, template] of this.templates) {
      this.renderTemplate(templateId, template, viewMatrix);
    }
  }

  renderTemplate(templateId, template, viewMatrix) {
    const gl = this.gl;

    const instances = this.instances.filter(
      i => i.templateId === templateId && i.visible
    );

    if (instances.length === 0) return;

    // Sort instances back to front
    if (this.options.sortMode === 'perInstance') {
      instances.sort((a, b) => {
        const posA = this.getInstancePosition(a);
        const posB = this.getInstancePosition(b);
        return this.transformDepth(posA, viewMatrix) - this.transformDepth(posB, viewMatrix);
      });
    }

    // Build instance data
    const instanceData = new Float32Array(instances.length * 20);
    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      const offset = i * 20;
      const transform = this.evaluateTransform(inst);
      const matrix = this.buildTransformMatrix(transform);
      instanceData.set(matrix, offset);
      instanceData.set(this.evaluateColor(inst), offset + 16);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, template.instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instanceData);

    gl.bindVertexArray(template.vao);

    // Draw instanced quads: 6 indices per quad, splatCount * instances.length total
    gl.drawElementsInstanced(
      gl.TRIANGLES,
      6,
      gl.UNSIGNED_SHORT,
      0,
      template.splatCount * instances.length
    );

    gl.bindVertexArray(null);
  }

  getInstancePosition(instance) {
    return instance.transform.translate || [0, 0, 0];
  }

  transformDepth(pos, viewMatrix) {
    return viewMatrix[2] * pos[0] + viewMatrix[6] * pos[1] + viewMatrix[10] * pos[2] + viewMatrix[14];
  }

  evaluateTransform(instance) {
    if (!instance.animation) return instance.transform;

    const anim = instance.animation;
    const result = { ...instance.transform };

    if (anim.translate) result.translate = this.evaluateVec3(anim.translate);
    if (anim.rotate) result.rotate = this.evaluateVec3(anim.rotate);
    if (anim.scale) {
      const s = this.evaluateExpr(anim.scale);
      result.scale = typeof s === 'number' ? [s, s, s] : s;
    }

    return result;
  }

  evaluateColor(instance) {
    if (instance.animation?.color) return this.evaluateVec4(instance.animation.color);
    return instance.color;
  }

  evaluateVec3(arr) { return arr.map(v => this.evaluateExpr(v)); }
  evaluateVec4(arr) { return arr.map(v => this.evaluateExpr(v)); }

  evaluateExpr(expr) {
    if (typeof expr === 'number') return expr;
    if (typeof expr === 'string') return expr === 'time' ? this.time : 0;
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
        const [e0, e1, x] = args;
        const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
        return t * t * (3 - 2 * t);
      }
      default: return 0;
    }
  }

  buildTransformMatrix(transform) {
    const t = transform.translate || [0, 0, 0];
    const r = transform.rotate || [0, 0, 0];
    const s = transform.scale || [1, 1, 1];

    const rx = r[0] * Math.PI / 180;
    const ry = r[1] * Math.PI / 180;
    const rz = r[2] * Math.PI / 180;

    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const cz = Math.cos(rz), sz = Math.sin(rz);

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
    const zAxis = normalize([position[0] - target[0], position[1] - target[1], position[2] - target[2]]);
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

  dispose() {
    const gl = this.gl;
    for (const [, template] of this.templates) {
      gl.deleteBuffer(template.splatBuffer);
      gl.deleteBuffer(template.instanceBuffer);
      gl.deleteBuffer(template.indexBuffer);
      gl.deleteBuffer(template.quadVbo);
      gl.deleteVertexArray(template.vao);
    }
    gl.deleteProgram(this.program);
  }
}

function normalize(v) {
  const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
  return len > 0 ? [v[0]/len, v[1]/len, v[2]/len] : [0, 0, 0];
}

function cross(a, b) {
  return [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
}

function dot(a, b) {
  return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

// =============================================================================
// SHADERS - True anisotropic Gaussian splatting
// =============================================================================

const VERTEX_SHADER = `#version 300 es
precision highp float;

// Per-quad vertex
in vec2 a_quadVertex;

// Per-Gaussian attributes (instanced)
in vec3 a_position;
in vec3 a_scale;      // Anisotropic scales
in vec4 a_rotation;   // Quaternion (w, x, y, z)
in vec3 a_color;
in float a_opacity;

// Per-scene-instance attributes
in mat4 a_instanceTransform;
in vec4 a_instanceColor;

// Uniforms
uniform mat4 u_viewMatrix;
uniform mat4 u_projMatrix;
uniform vec2 u_viewport;
uniform vec2 u_focal;
uniform float u_time;

// Outputs to fragment shader
out vec3 v_color;
out float v_opacity;
out vec2 v_conic;      // Inverse 2D covariance (conic section): a, b (c = a)
out vec2 v_center;     // Screen-space center
out vec2 v_coord;      // Local quad coordinate

// Quaternion to rotation matrix
mat3 quatToMat(vec4 q) {
    float w = q.x, x = q.y, y = q.z, z = q.w;
    return mat3(
        1.0 - 2.0*(y*y + z*z), 2.0*(x*y + w*z), 2.0*(x*z - w*y),
        2.0*(x*y - w*z), 1.0 - 2.0*(x*x + z*z), 2.0*(y*z + w*x),
        2.0*(x*z + w*y), 2.0*(y*z - w*x), 1.0 - 2.0*(x*x + y*y)
    );
}

void main() {
    // Build 3D covariance matrix from scale and rotation
    mat3 R = quatToMat(a_rotation);
    mat3 S = mat3(
        a_scale.x * a_scale.x, 0.0, 0.0,
        0.0, a_scale.y * a_scale.y, 0.0,
        0.0, 0.0, a_scale.z * a_scale.z
    );
    mat3 cov3D = R * S * transpose(R);

    // Apply instance transform to position
    vec4 worldPos = a_instanceTransform * vec4(a_position, 1.0);

    // Transform to view space
    vec4 viewPos = u_viewMatrix * worldPos;
    float z = -viewPos.z;

    if (z < 0.1) {
        gl_Position = vec4(0.0, 0.0, -1000.0, 1.0);
        return;
    }

    // Extract view rotation
    mat3 viewRot = mat3(u_viewMatrix);

    // Also apply instance rotation to covariance
    mat3 instRot = mat3(a_instanceTransform);
    mat3 totalRot = viewRot * instRot;

    // Transform 3D covariance to view space
    mat3 cov3D_view = totalRot * cov3D * transpose(totalRot);

    // Jacobian of perspective projection
    float fx = u_focal.x;
    float fy = u_focal.y;
    float z2 = z * z;

    mat2 J = mat2(
        fx / z, 0.0,
        0.0, fy / z
    );

    // Project 3D covariance to 2D: cov2D = J * cov3D_view[0:2,0:2] * J^T
    // Only need upper-left 2x2 of cov3D_view for screen projection
    mat2 cov3D_2x2 = mat2(cov3D_view[0].xy, cov3D_view[1].xy);
    mat2 cov2D = J * cov3D_2x2 * transpose(J);

    // Add small regularization for numerical stability
    cov2D[0][0] += 0.3;
    cov2D[1][1] += 0.3;

    // Compute eigenvalues for ellipse axes (for quad sizing)
    float a = cov2D[0][0];
    float b = cov2D[0][1];  // = cov2D[1][0] (symmetric)
    float d = cov2D[1][1];

    float trace = a + d;
    float det = a * d - b * b;
    float disc = sqrt(max(0.0, trace * trace * 0.25 - det));
    float lambda1 = trace * 0.5 + disc;
    float lambda2 = trace * 0.5 - disc;

    // Ellipse radii (3 sigma for visibility)
    float r1 = 3.0 * sqrt(max(0.1, lambda1));
    float r2 = 3.0 * sqrt(max(0.1, lambda2));
    float maxRadius = max(r1, r2);

    // Eigenvector for major axis
    vec2 eigenvec1;
    if (abs(b) > 0.0001) {
        eigenvec1 = normalize(vec2(lambda1 - d, b));
    } else {
        eigenvec1 = vec2(1.0, 0.0);
    }
    vec2 eigenvec2 = vec2(-eigenvec1.y, eigenvec1.x);

    // Transform quad vertex by ellipse orientation and scale
    vec2 localOffset = a_quadVertex.x * eigenvec1 * r1 + a_quadVertex.y * eigenvec2 * r2;

    // Screen-space center
    vec4 clipPos = u_projMatrix * viewPos;
    vec2 screenCenter = clipPos.xy / clipPos.w;

    // Offset in NDC (convert pixel offset to NDC)
    vec2 ndcOffset = localOffset / u_viewport * 2.0;

    gl_Position = vec4(screenCenter + ndcOffset, clipPos.z / clipPos.w, 1.0);

    // Pass to fragment shader
    v_color = a_color * a_instanceColor.rgb;
    v_opacity = a_opacity * a_instanceColor.a;
    v_coord = localOffset;  // Pass pixel-space offset, NOT quad coordinates!

    // Pass inverse covariance for elliptical Gaussian
    // inv(cov2D) for 2x2 symmetric: [d, -b; -b, a] / det
    float invDet = 1.0 / max(det, 0.0001);
    v_conic = vec2(d * invDet, -b * invDet);  // Store (invCov[0][0], invCov[0][1])
    v_center = vec2(a * invDet, 0.0);          // Store invCov[1][1] in x (b already in v_conic.y)
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_color;
in float v_opacity;
in vec2 v_conic;    // Inverse covariance: (a, b)
in vec2 v_center;   // Inverse covariance: (c, unused) where c = invCov[1][1]
in vec2 v_coord;    // Pixel-space offset from splat center

out vec4 fragColor;

void main() {
    // Reconstruct inverse covariance matrix
    // invCov = [v_conic.x, v_conic.y; v_conic.y, v_center.x]
    float a = v_conic.x;
    float b = v_conic.y;
    float c = v_center.x;

    // Evaluate elliptical Gaussian: exp(-0.5 * x^T * invCov * x)
    // v_coord is in pixel space, matching the inverse covariance
    vec2 d = v_coord;

    float exponent = -0.5 * (a * d.x * d.x + 2.0 * b * d.x * d.y + c * d.y * d.y);

    // Clamp exponent to avoid numerical issues
    exponent = max(exponent, -10.0);

    float alpha = exp(exponent) * v_opacity;

    // Early discard for nearly transparent
    if (alpha < 0.004) discard;

    // Color with subtle ambient boost
    vec3 color = v_color * 1.1 + vec3(0.05);
    color = clamp(color, 0.0, 1.0);

    fragColor = vec4(color, alpha);
}
`;

export default InstancedSplatRenderer;
