/**
 * GPU-based SDF Sampler using WebGL2
 *
 * Leverages the same GLSL code generation as the main Lucid raymarcher
 * but outputs surface samples (position, normal, color) to textures
 * instead of rendering lit images.
 *
 * Uses Multiple Render Targets (MRT) via WebGL2 for efficient output.
 */

export class GPUSampler {
  // All 26 sampling directions: 6 face centers, 8 corners, 12 edge midpoints
  static DIRECTIONS = [
    // 6 face centers (orthogonal - indices 0-5)
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
    // 8 cube corners (diagonal - indices 6-13)
    [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
    [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
    // 12 edge midpoints (indices 14-25)
    [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0],
    [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1],
    [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1]
  ].map(d => {
    // Normalize each direction
    const len = Math.sqrt(d[0]*d[0] + d[1]*d[1] + d[2]*d[2]);
    return [d[0]/len, d[1]/len, d[2]/len];
  });

  constructor(options = {}) {
    this.resolution = options.resolution || 256;  // Texture resolution (resolution² rays)
    this.maxDistance = options.maxDistance || 20.0;
    this.hitThreshold = options.hitThreshold || 0.001;
    this.maxSteps = options.maxSteps || 128;

    // Create offscreen canvas for WebGL2 context
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.resolution;
    this.canvas.height = this.resolution;

    this.gl = this.canvas.getContext('webgl2', {
      antialias: false,
      preserveDrawingBuffer: true
    });

    if (!this.gl) {
      throw new Error('WebGL2 required for GPU sampling');
    }

    // Check for float texture support
    const ext = this.gl.getExtension('EXT_color_buffer_float');
    if (!ext) {
      console.warn('EXT_color_buffer_float not available, falling back to RGBA8');
      this.useFloatTextures = false;
    } else {
      this.useFloatTextures = true;
    }

    this.program = null;
    this.fbo = null;
    this.textures = {};

    this.setupGeometry();
  }

  /**
   * Setup fullscreen quad geometry
   */
  setupGeometry() {
    const gl = this.gl;

    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  /**
   * Setup framebuffer with multiple render targets
   */
  setupFramebuffer() {
    const gl = this.gl;
    const res = this.resolution;

    // Clean up existing
    if (this.fbo) {
      gl.deleteFramebuffer(this.fbo);
      Object.values(this.textures).forEach(tex => gl.deleteTexture(tex));
    }

    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);

    // Create textures for MRT output
    // 0: Position (xyz) + hit flag (w)
    // 1: Normal (xyz) + mean curvature (w) for fallback
    // 2: Color (rgb) + distance (a)
    // 3: Principal curvatures: k1, k2, principal direction angle, tangent1.x

    const targets = ['position', 'normal', 'color', 'curvature'];
    const attachments = [];

    for (let i = 0; i < targets.length; i++) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);

      if (this.useFloatTextures) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, res, res, 0, gl.RGBA, gl.FLOAT, null);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, res, res, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, tex, 0);
      this.textures[targets[i]] = tex;
      attachments.push(gl.COLOR_ATTACHMENT0 + i);
    }

    // Enable MRT
    gl.drawBuffers(attachments);

    // Check framebuffer status
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('Framebuffer incomplete:', status);
      throw new Error('Failed to create framebuffer for GPU sampling');
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Compile sampling shader with scene GLSL
   * @param {string} sceneGlsl - GLSL code from json-codegen with g_df_scene function
   */
  compileShader(sceneGlsl) {
    const gl = this.gl;

    // Clean up existing program
    if (this.program) {
      gl.deleteProgram(this.program);
    }

    const vertexSource = `#version 300 es
      in vec4 a_position;
      void main() {
        gl_Position = a_position;
      }
    `;

    const fragmentSource = `#version 300 es
      precision highp float;

      uniform vec2 u_resolution;
      uniform vec3 u_boundsMin;
      uniform vec3 u_boundsMax;
      uniform vec3 u_rayDir;        // Normalized ray direction for this pass
      uniform vec3 u_rayTangentU;   // Tangent U for screen mapping
      uniform vec3 u_rayTangentV;   // Tangent V for screen mapping
      uniform float u_time;

      // Output targets (MRT)
      layout(location = 0) out vec4 out_position;   // xyz = position, w = hit flag
      layout(location = 1) out vec4 out_normal;     // xyz = normal, w = mean curvature (fallback)
      layout(location = 2) out vec4 out_color;      // rgb = color, a = distance
      layout(location = 3) out vec4 out_curvature;  // k1, k2, principal dir angle, tangent1.x

      // Scene SDF from codegen
      ${sceneGlsl}

      // Compute normal via central differences
      vec3 calcNormal(vec3 p) {
        const float h = 0.001;
        vec2 e = vec2(h, 0.0);
        return normalize(vec3(
          g_df_scene(p + e.xyy).x - g_df_scene(p - e.xyy).x,
          g_df_scene(p + e.yxy).x - g_df_scene(p - e.yxy).x,
          g_df_scene(p + e.yyx).x - g_df_scene(p - e.yyx).x
        ));
      }

      // Build orthonormal tangent frame from normal
      void buildTangentFrame(vec3 n, out vec3 t1, out vec3 t2) {
        // Choose axis not parallel to normal
        vec3 up = abs(n.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
        t1 = normalize(cross(up, n));
        t2 = cross(n, t1);
      }

      // Compute principal curvatures via Hessian analysis
      // Returns vec4(k1, k2, principalAngle, t1.x)
      // k1 = max curvature, k2 = min curvature
      vec4 computePrincipalCurvatures(vec3 p, vec3 n) {
        const float h = 0.01;
        float d0 = g_df_scene(p).x;

        // Compute full 3x3 Hessian (second partial derivatives of SDF)
        // Diagonal terms: d²f/dx², d²f/dy², d²f/dz²
        float dxx = (g_df_scene(p + vec3(h,0,0)).x - 2.0*d0 + g_df_scene(p - vec3(h,0,0)).x) / (h*h);
        float dyy = (g_df_scene(p + vec3(0,h,0)).x - 2.0*d0 + g_df_scene(p - vec3(0,h,0)).x) / (h*h);
        float dzz = (g_df_scene(p + vec3(0,0,h)).x - 2.0*d0 + g_df_scene(p - vec3(0,0,h)).x) / (h*h);

        // Off-diagonal terms: d²f/dxdy, d²f/dxdz, d²f/dydz
        float dxy = (g_df_scene(p + vec3(h,h,0)).x - g_df_scene(p + vec3(h,-h,0)).x
                   - g_df_scene(p + vec3(-h,h,0)).x + g_df_scene(p + vec3(-h,-h,0)).x) / (4.0*h*h);
        float dxz = (g_df_scene(p + vec3(h,0,h)).x - g_df_scene(p + vec3(h,0,-h)).x
                   - g_df_scene(p + vec3(-h,0,h)).x + g_df_scene(p + vec3(-h,0,-h)).x) / (4.0*h*h);
        float dyz = (g_df_scene(p + vec3(0,h,h)).x - g_df_scene(p + vec3(0,h,-h)).x
                   - g_df_scene(p + vec3(0,-h,h)).x + g_df_scene(p + vec3(0,-h,-h)).x) / (4.0*h*h);

        // Hessian matrix H
        mat3 H = mat3(
          dxx, dxy, dxz,
          dxy, dyy, dyz,
          dxz, dyz, dzz
        );

        // Build tangent frame
        vec3 t1, t2;
        buildTangentFrame(n, t1, t2);

        // Project Hessian onto tangent plane to get shape operator (2x2)
        // S_ij = t_i · H · t_j
        float s11 = dot(t1, H * t1);
        float s12 = dot(t1, H * t2);
        float s22 = dot(t2, H * t2);

        // Find eigenvalues of 2x2 symmetric matrix (principal curvatures)
        // For [a, b; b, c]: λ = (a+c)/2 ± sqrt((a-c)²/4 + b²)
        float trace = s11 + s22;
        float det = s11 * s22 - s12 * s12;
        float disc = max(0.0, trace * trace * 0.25 - det);
        float sqrtDisc = sqrt(disc);

        float k1 = trace * 0.5 + sqrtDisc;  // Max curvature
        float k2 = trace * 0.5 - sqrtDisc;  // Min curvature

        // Compute principal direction angle in tangent plane
        // Eigenvector for k1 is proportional to (s12, k1 - s11) or (k1 - s22, s12)
        float angle = 0.0;
        if (abs(s12) > 1e-6) {
          angle = 0.5 * atan(2.0 * s12, s11 - s22);
        } else if (s11 < s22) {
          angle = 1.5707963;  // π/2 if s12 ≈ 0 and s11 < s22
        }

        return vec4(k1, k2, angle, t1.x);
      }

      // Estimate mean curvature via Laplacian (simpler fallback)
      float estimateMeanCurvature(vec3 p) {
        const float h = 0.01;
        float d0 = g_df_scene(p).x;
        float laplacian = 0.0;
        laplacian += g_df_scene(p + vec3(h, 0, 0)).x;
        laplacian += g_df_scene(p - vec3(h, 0, 0)).x;
        laplacian += g_df_scene(p + vec3(0, h, 0)).x;
        laplacian += g_df_scene(p - vec3(0, h, 0)).x;
        laplacian += g_df_scene(p + vec3(0, 0, h)).x;
        laplacian += g_df_scene(p - vec3(0, 0, h)).x;
        laplacian = (laplacian - 6.0 * d0) / (h * h);
        return laplacian * 0.5;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;

        // Map UV to position within bounds
        vec3 boundsSize = u_boundsMax - u_boundsMin;
        vec3 boundsCenter = (u_boundsMin + u_boundsMax) * 0.5;
        float boundsRadius = length(boundsSize) * 0.5 + 2.0;

        // Generate ray from direction + screen UV mapped via tangents
        vec3 screenOffset = u_rayTangentU * (uv.x - 0.5) * boundsSize.x +
                            u_rayTangentV * (uv.y - 0.5) * boundsSize.y;
        vec3 rayOrigin = boundsCenter - u_rayDir * boundsRadius + screenOffset;
        vec3 rayDir = u_rayDir;

        // Raymarch
        float t = 0.0;
        const int MAX_STEPS = ${this.maxSteps};
        const float MAX_DIST = ${this.maxDistance.toFixed(1)};
        const float HIT_THRESHOLD = ${this.hitThreshold.toFixed(6)};

        bool hit = false;
        vec3 hitPos = vec3(0.0);
        vec3 hitNormal = vec3(0.0);
        vec3 hitColor = vec3(0.0);
        float hitDist = MAX_DIST;
        float meanCurvature = 0.0;
        vec4 principalCurvatures = vec4(0.0);

        for (int i = 0; i < MAX_STEPS; i++) {
          vec3 p = rayOrigin + rayDir * t;
          vec4 scene = g_df_scene(p);
          float d = scene.x;

          if (d < HIT_THRESHOLD) {
            hit = true;
            hitPos = p;
            hitNormal = calcNormal(p);
            hitColor = scene.yzw;
            hitDist = t;
            meanCurvature = estimateMeanCurvature(p);
            principalCurvatures = computePrincipalCurvatures(p, hitNormal);
            break;
          }

          t += max(d * 0.9, 0.001);

          if (t > MAX_DIST) break;
        }

        // Output to render targets
        if (hit) {
          out_position = vec4(hitPos, 1.0);
          out_normal = vec4(hitNormal, meanCurvature);
          out_color = vec4(hitColor, hitDist);
          out_curvature = principalCurvatures;
        } else {
          out_position = vec4(0.0, 0.0, 0.0, 0.0);
          out_normal = vec4(0.0, 0.0, 0.0, 0.0);
          out_color = vec4(0.0, 0.0, 0.0, -1.0);
          out_curvature = vec4(0.0, 0.0, 0.0, 0.0);
        }
      }
    `;

    // Compile vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error('Vertex shader error:', gl.getShaderInfoLog(vertexShader));
      throw new Error('Vertex shader compilation failed');
    }

    // Compile fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('Fragment shader error:', gl.getShaderInfoLog(fragmentShader));
      console.log('Fragment source:', fragmentSource);
      throw new Error('Fragment shader compilation failed');
    }

    // Link program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(this.program));
      throw new Error('Shader program linking failed');
    }

    // Get uniform locations
    this.uniforms = {
      resolution: gl.getUniformLocation(this.program, 'u_resolution'),
      boundsMin: gl.getUniformLocation(this.program, 'u_boundsMin'),
      boundsMax: gl.getUniformLocation(this.program, 'u_boundsMax'),
      rayDir: gl.getUniformLocation(this.program, 'u_rayDir'),
      rayTangentU: gl.getUniformLocation(this.program, 'u_rayTangentU'),
      rayTangentV: gl.getUniformLocation(this.program, 'u_rayTangentV'),
      time: gl.getUniformLocation(this.program, 'u_time')
    };

    // Clean up shaders
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    console.log('GPU sampler shader compiled successfully');
  }

  /**
   * Compute orthonormal tangent basis for a direction
   */
  computeTangentBasis(dir) {
    // Pick an arbitrary vector not parallel to dir
    const up = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];

    // tangentU = cross(up, dir)
    const u = [
      up[1] * dir[2] - up[2] * dir[1],
      up[2] * dir[0] - up[0] * dir[2],
      up[0] * dir[1] - up[1] * dir[0]
    ];
    const uLen = Math.sqrt(u[0]*u[0] + u[1]*u[1] + u[2]*u[2]);
    u[0] /= uLen; u[1] /= uLen; u[2] /= uLen;

    // tangentV = cross(dir, tangentU)
    const v = [
      dir[1] * u[2] - dir[2] * u[1],
      dir[2] * u[0] - dir[0] * u[2],
      dir[0] * u[1] - dir[1] * u[0]
    ];

    return { u, v };
  }

  /**
   * Sample the scene from one direction
   * @param {number} dirIndex - Direction index into DIRECTIONS array
   * @param {Object} bounds - { min: [x,y,z], max: [x,y,z] }
   * @returns {Object} - { positions, normals, colors, curvatures, k1, k2, principalAngles, count }
   */
  sampleDirection(dirIndex, bounds) {
    const gl = this.gl;
    const res = this.resolution;

    // Get direction and compute tangent basis
    const dir = GPUSampler.DIRECTIONS[dirIndex];
    const { u, v } = this.computeTangentBasis(dir);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, res, res);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // Set uniforms
    gl.uniform2f(this.uniforms.resolution, res, res);
    gl.uniform3f(this.uniforms.boundsMin, bounds.min[0], bounds.min[1], bounds.min[2]);
    gl.uniform3f(this.uniforms.boundsMax, bounds.max[0], bounds.max[1], bounds.max[2]);
    gl.uniform3f(this.uniforms.rayDir, dir[0], dir[1], dir[2]);
    gl.uniform3f(this.uniforms.rayTangentU, u[0], u[1], u[2]);
    gl.uniform3f(this.uniforms.rayTangentV, v[0], v[1], v[2]);
    gl.uniform1f(this.uniforms.time, 0.0);

    // Clear and render
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Read back textures
    const pixelCount = res * res;

    let positionData, normalData, colorData, curvatureData;

    if (this.useFloatTextures) {
      positionData = new Float32Array(pixelCount * 4);
      normalData = new Float32Array(pixelCount * 4);
      colorData = new Float32Array(pixelCount * 4);
      curvatureData = new Float32Array(pixelCount * 4);

      gl.readBuffer(gl.COLOR_ATTACHMENT0);
      gl.readPixels(0, 0, res, res, gl.RGBA, gl.FLOAT, positionData);

      gl.readBuffer(gl.COLOR_ATTACHMENT1);
      gl.readPixels(0, 0, res, res, gl.RGBA, gl.FLOAT, normalData);

      gl.readBuffer(gl.COLOR_ATTACHMENT2);
      gl.readPixels(0, 0, res, res, gl.RGBA, gl.FLOAT, colorData);

      gl.readBuffer(gl.COLOR_ATTACHMENT3);
      gl.readPixels(0, 0, res, res, gl.RGBA, gl.FLOAT, curvatureData);
    } else {
      // RGBA8 fallback - need to encode/decode
      const positionBytes = new Uint8Array(pixelCount * 4);
      const normalBytes = new Uint8Array(pixelCount * 4);
      const colorBytes = new Uint8Array(pixelCount * 4);
      const curvatureBytes = new Uint8Array(pixelCount * 4);

      gl.readBuffer(gl.COLOR_ATTACHMENT0);
      gl.readPixels(0, 0, res, res, gl.RGBA, gl.UNSIGNED_BYTE, positionBytes);

      gl.readBuffer(gl.COLOR_ATTACHMENT1);
      gl.readPixels(0, 0, res, res, gl.RGBA, gl.UNSIGNED_BYTE, normalBytes);

      gl.readBuffer(gl.COLOR_ATTACHMENT2);
      gl.readPixels(0, 0, res, res, gl.RGBA, gl.UNSIGNED_BYTE, colorBytes);

      gl.readBuffer(gl.COLOR_ATTACHMENT3);
      gl.readPixels(0, 0, res, res, gl.RGBA, gl.UNSIGNED_BYTE, curvatureBytes);

      // Convert to float (simple 0-1 range)
      positionData = new Float32Array(pixelCount * 4);
      normalData = new Float32Array(pixelCount * 4);
      colorData = new Float32Array(pixelCount * 4);
      curvatureData = new Float32Array(pixelCount * 4);

      for (let i = 0; i < pixelCount * 4; i++) {
        positionData[i] = positionBytes[i] / 255.0;
        normalData[i] = normalBytes[i] / 255.0;
        colorData[i] = colorBytes[i] / 255.0;
        curvatureData[i] = curvatureBytes[i] / 255.0;
      }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Extract valid samples (where hit flag w > 0.5)
    const positions = [];
    const normals = [];
    const colors = [];
    const curvatures = [];  // Mean curvature (fallback)
    const k1Values = [];    // Principal curvature 1 (max)
    const k2Values = [];    // Principal curvature 2 (min)
    const principalAngles = [];

    for (let i = 0; i < pixelCount; i++) {
      const hitFlag = positionData[i * 4 + 3];
      if (hitFlag > 0.5) {
        positions.push(
          positionData[i * 4],
          positionData[i * 4 + 1],
          positionData[i * 4 + 2]
        );
        normals.push(
          normalData[i * 4],
          normalData[i * 4 + 1],
          normalData[i * 4 + 2]
        );
        colors.push(
          colorData[i * 4],
          colorData[i * 4 + 1],
          colorData[i * 4 + 2]
        );
        curvatures.push(normalData[i * 4 + 3]);  // Mean curvature

        // Principal curvatures from 4th texture
        k1Values.push(curvatureData[i * 4]);      // k1
        k2Values.push(curvatureData[i * 4 + 1]);  // k2
        principalAngles.push(curvatureData[i * 4 + 2]);  // angle in tangent plane
      }
    }

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      colors: new Float32Array(colors),
      curvatures: new Float32Array(curvatures),
      k1: new Float32Array(k1Values),
      k2: new Float32Array(k2Values),
      principalAngles: new Float32Array(principalAngles),
      count: positions.length / 3
    };
  }

  /**
   * Sample scene from multiple directions
   * @param {string} sceneGlsl - GLSL code from json-codegen
   * @param {Object} bounds - { min: [x,y,z], max: [x,y,z] }
   * @param {Object} options - Additional options
   *   - numDirections: 6, 14, or 26 (faces, +corners, +edges)
   *   - deduplicationRadius: merge nearby points
   * @returns {Object} - Combined point cloud with principal curvatures
   */
  sample(sceneGlsl, bounds, options = {}) {
    const startTime = performance.now();

    // Compile shader with scene code
    this.compileShader(sceneGlsl);
    this.setupFramebuffer();

    // Sample from requested number of directions
    const allPositions = [];
    const allNormals = [];
    const allColors = [];
    const allCurvatures = [];  // Mean curvature (fallback)
    const allK1 = [];          // Principal curvature k1 (max)
    const allK2 = [];          // Principal curvature k2 (min)
    const allPrincipalAngles = [];

    // Build directions array based on numDirections
    const numDirs = options.numDirections || 6;
    const directions = [];
    for (let i = 0; i < Math.min(numDirs, GPUSampler.DIRECTIONS.length); i++) {
      directions.push(i);
    }

    console.log(`GPU sampling from ${directions.length} directions...`);

    for (const dir of directions) {
      const result = this.sampleDirection(dir, bounds);

      if (result.count > 0) {
        allPositions.push(...result.positions);
        allNormals.push(...result.normals);
        allColors.push(...result.colors);
        allCurvatures.push(...result.curvatures);
        allK1.push(...result.k1);
        allK2.push(...result.k2);
        allPrincipalAngles.push(...result.principalAngles);
      }

      if (directions.length <= 10) {
        console.log(`  Direction ${dir}: ${result.count} samples`);
      }
    }

    const totalCount = allPositions.length / 3;

    // Remove duplicate points (from overlapping rays)
    const dedupResult = this.deduplicatePoints(
      new Float32Array(allPositions),
      new Float32Array(allNormals),
      new Float32Array(allColors),
      new Float32Array(allCurvatures),
      new Float32Array(allK1),
      new Float32Array(allK2),
      new Float32Array(allPrincipalAngles),
      options.deduplicationRadius || 0.01
    );

    const elapsed = performance.now() - startTime;
    console.log(`GPU sampling complete: ${dedupResult.count} points (from ${totalCount} raw) in ${elapsed.toFixed(0)}ms`);

    return dedupResult;
  }

  /**
   * Remove duplicate points within a radius
   */
  deduplicatePoints(positions, normals, colors, curvatures, k1, k2, principalAngles, radius) {
    const count = positions.length / 3;
    const radiusSq = radius * radius;

    const keep = new Array(count).fill(true);

    // Simple O(n²) deduplication - could use spatial hashing for large point clouds
    for (let i = 0; i < count; i++) {
      if (!keep[i]) continue;

      const px = positions[i * 3];
      const py = positions[i * 3 + 1];
      const pz = positions[i * 3 + 2];

      for (let j = i + 1; j < count; j++) {
        if (!keep[j]) continue;

        const dx = positions[j * 3] - px;
        const dy = positions[j * 3 + 1] - py;
        const dz = positions[j * 3 + 2] - pz;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < radiusSq) {
          keep[j] = false;
        }
      }
    }

    // Compact arrays
    const outPositions = [];
    const outNormals = [];
    const outColors = [];
    const outCurvatures = [];
    const outK1 = [];
    const outK2 = [];
    const outPrincipalAngles = [];

    for (let i = 0; i < count; i++) {
      if (keep[i]) {
        outPositions.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        outNormals.push(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
        outColors.push(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
        outCurvatures.push(curvatures[i]);
        outK1.push(k1[i]);
        outK2.push(k2[i]);
        outPrincipalAngles.push(principalAngles[i]);
      }
    }

    return {
      positions: new Float32Array(outPositions),
      normals: new Float32Array(outNormals),
      colors: new Float32Array(outColors),
      curvatures: new Float32Array(outCurvatures),
      k1: new Float32Array(outK1),
      k2: new Float32Array(outK2),
      principalAngles: new Float32Array(outPrincipalAngles),
      count: outPositions.length / 3
    };
  }

  /**
   * Convert GPU sample results to format expected by trainer
   * Uses principal curvatures (k1, k2) for truly anisotropic scaling
   */
  toPointCloud(sampleResult, options = {}) {
    const { positions, normals, colors, curvatures, k1, k2, principalAngles, count } = sampleResult;
    const baseScale = options.baseScale || 0.05;
    const curvatureFactor = options.curvatureFactor || 5.0;

    // Generate scales and rotations from normals and principal curvatures
    const scales = new Float32Array(count * 3);
    const rotations = new Float32Array(count * 4);

    for (let i = 0; i < count; i++) {
      // Get normal
      const nx = normals[i * 3];
      const ny = normals[i * 3 + 1];
      const nz = normals[i * 3 + 2];

      // Get principal curvatures
      const kappa1 = k1 ? k1[i] : curvatures[i];  // Max curvature (fallback to mean)
      const kappa2 = k2 ? k2[i] : curvatures[i];  // Min curvature (fallback to mean)
      const angle = principalAngles ? principalAngles[i] : 0;

      // Anisotropic scale: inverse of curvature
      // High curvature → small scale (tight splats)
      // Low curvature → large scale (wide splats)
      const clampedK1 = Math.min(Math.abs(kappa1), 50.0);
      const clampedK2 = Math.min(Math.abs(kappa2), 50.0);

      // Scale in principal directions
      const scale1 = baseScale / (1.0 + clampedK1 * curvatureFactor);  // Along max curvature direction
      const scale2 = baseScale / (1.0 + clampedK2 * curvatureFactor);  // Along min curvature direction
      const scaleN = baseScale * 0.1;  // Very thin along normal (disk-like)

      // Store scales: x = principal dir 1, y = principal dir 2, z = normal
      scales[i * 3] = scale1;
      scales[i * 3 + 1] = scale2;
      scales[i * 3 + 2] = scaleN;

      // Step 1: Compute quaternion to align Z-axis with surface normal
      let qNormal = [0, 0, 0, 1];  // [x, y, z, w]
      const dot = nz;  // dot([0,0,1], normal) = nz

      if (dot > 0.9999) {
        // Normal ≈ +Z, identity quaternion
        qNormal = [0, 0, 0, 1];
      } else if (dot < -0.9999) {
        // Normal ≈ -Z, 180° rotation around X
        qNormal = [1, 0, 0, 0];
      } else {
        // General case: axis = normalize([0,0,1] × normal) = normalize([-ny, nx, 0])
        const ax = -ny;
        const ay = nx;
        const axisLen = Math.sqrt(ax * ax + ay * ay);
        const halfAngle = Math.acos(dot) * 0.5;
        const sinHalf = Math.sin(halfAngle);
        const cosHalf = Math.cos(halfAngle);
        qNormal = [
          (ax / axisLen) * sinHalf,
          (ay / axisLen) * sinHalf,
          0,
          cosHalf
        ];
      }

      // Step 2: Compute rotation in tangent plane by principal direction angle
      // This rotates around the normal (Z-axis in local space) by the principal angle
      if (angle !== 0 && k1 && k2) {
        const halfPrincipal = angle * 0.5;
        const qPrincipal = [
          0,
          0,
          Math.sin(halfPrincipal),
          Math.cos(halfPrincipal)
        ];

        // Combine rotations: qTotal = qNormal * qPrincipal
        // Quaternion multiplication: q1 * q2
        const q1 = qNormal;
        const q2 = qPrincipal;
        rotations[i * 4] = q1[3]*q2[0] + q1[0]*q2[3] + q1[1]*q2[2] - q1[2]*q2[1];  // x
        rotations[i * 4 + 1] = q1[3]*q2[1] - q1[0]*q2[2] + q1[1]*q2[3] + q1[2]*q2[0];  // y
        rotations[i * 4 + 2] = q1[3]*q2[2] + q1[0]*q2[1] - q1[1]*q2[0] + q1[2]*q2[3];  // z
        rotations[i * 4 + 3] = q1[3]*q2[3] - q1[0]*q2[0] - q1[1]*q2[1] - q1[2]*q2[2];  // w
      } else {
        // No principal angle, just use normal alignment
        rotations[i * 4] = qNormal[0];
        rotations[i * 4 + 1] = qNormal[1];
        rotations[i * 4 + 2] = qNormal[2];
        rotations[i * 4 + 3] = qNormal[3];
      }
    }

    return {
      positions,
      normals,
      colors,
      scales,
      rotations,
      k1,
      k2,
      principalAngles,
      count,
      anisotropic: true
    };
  }

  /**
   * Clean up WebGL resources
   */
  dispose() {
    const gl = this.gl;

    if (this.program) {
      gl.deleteProgram(this.program);
    }
    if (this.fbo) {
      gl.deleteFramebuffer(this.fbo);
    }
    Object.values(this.textures).forEach(tex => gl.deleteTexture(tex));
    if (this.positionBuffer) {
      gl.deleteBuffer(this.positionBuffer);
    }
    if (this.vao) {
      gl.deleteVertexArray(this.vao);
    }
  }
}

export default GPUSampler;
