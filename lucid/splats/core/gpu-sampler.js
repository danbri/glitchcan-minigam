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
    // 1: Normal (xyz) + curvature (w)
    // 2: Color (rgb) + distance (a)

    const targets = ['position', 'normal', 'color'];
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
      uniform vec3 u_cameraOrigin;
      uniform int u_viewDirection;  // 0-5 for ±X, ±Y, ±Z
      uniform float u_time;

      // Output targets (MRT)
      layout(location = 0) out vec4 out_position;  // xyz = position, w = hit flag
      layout(location = 1) out vec4 out_normal;    // xyz = normal, w = curvature estimate
      layout(location = 2) out vec4 out_color;     // rgb = color, a = distance

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

      // Estimate mean curvature via Laplacian of SDF
      float estimateCurvature(vec3 p, vec3 n) {
        const float h = 0.01;
        float d0 = g_df_scene(p).x;

        // Laplacian approximation
        float laplacian = 0.0;
        laplacian += g_df_scene(p + vec3(h, 0, 0)).x;
        laplacian += g_df_scene(p - vec3(h, 0, 0)).x;
        laplacian += g_df_scene(p + vec3(0, h, 0)).x;
        laplacian += g_df_scene(p - vec3(0, h, 0)).x;
        laplacian += g_df_scene(p + vec3(0, 0, h)).x;
        laplacian += g_df_scene(p - vec3(0, 0, h)).x;
        laplacian = (laplacian - 6.0 * d0) / (h * h);

        // Mean curvature is half the Laplacian for SDF
        return laplacian * 0.5;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution;

        // Map UV to position within bounds based on view direction
        vec3 boundsSize = u_boundsMax - u_boundsMin;
        vec3 boundsCenter = (u_boundsMin + u_boundsMax) * 0.5;

        vec3 rayOrigin, rayDir;

        // Generate rays from 6 orthogonal directions
        if (u_viewDirection == 0) {        // +X looking at -X
          rayOrigin = vec3(u_boundsMax.x + 1.0,
                          mix(u_boundsMin.y, u_boundsMax.y, uv.y),
                          mix(u_boundsMin.z, u_boundsMax.z, uv.x));
          rayDir = vec3(-1.0, 0.0, 0.0);
        } else if (u_viewDirection == 1) { // -X looking at +X
          rayOrigin = vec3(u_boundsMin.x - 1.0,
                          mix(u_boundsMin.y, u_boundsMax.y, uv.y),
                          mix(u_boundsMin.z, u_boundsMax.z, uv.x));
          rayDir = vec3(1.0, 0.0, 0.0);
        } else if (u_viewDirection == 2) { // +Y looking at -Y
          rayOrigin = vec3(mix(u_boundsMin.x, u_boundsMax.x, uv.x),
                          u_boundsMax.y + 1.0,
                          mix(u_boundsMin.z, u_boundsMax.z, uv.y));
          rayDir = vec3(0.0, -1.0, 0.0);
        } else if (u_viewDirection == 3) { // -Y looking at +Y
          rayOrigin = vec3(mix(u_boundsMin.x, u_boundsMax.x, uv.x),
                          u_boundsMin.y - 1.0,
                          mix(u_boundsMin.z, u_boundsMax.z, uv.y));
          rayDir = vec3(0.0, 1.0, 0.0);
        } else if (u_viewDirection == 4) { // +Z looking at -Z
          rayOrigin = vec3(mix(u_boundsMin.x, u_boundsMax.x, uv.x),
                          mix(u_boundsMin.y, u_boundsMax.y, uv.y),
                          u_boundsMax.z + 1.0);
          rayDir = vec3(0.0, 0.0, -1.0);
        } else {                           // -Z looking at +Z
          rayOrigin = vec3(mix(u_boundsMin.x, u_boundsMax.x, uv.x),
                          mix(u_boundsMin.y, u_boundsMax.y, uv.y),
                          u_boundsMin.z - 1.0);
          rayDir = vec3(0.0, 0.0, 1.0);
        }

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
        float hitCurvature = 0.0;

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
            hitCurvature = estimateCurvature(p, hitNormal);
            break;
          }

          t += max(d * 0.9, 0.001);

          if (t > MAX_DIST) break;
        }

        // Output to render targets
        if (hit) {
          out_position = vec4(hitPos, 1.0);
          out_normal = vec4(hitNormal, hitCurvature);
          out_color = vec4(hitColor, hitDist);
        } else {
          out_position = vec4(0.0, 0.0, 0.0, 0.0);
          out_normal = vec4(0.0, 0.0, 0.0, 0.0);
          out_color = vec4(0.0, 0.0, 0.0, -1.0);
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
      cameraOrigin: gl.getUniformLocation(this.program, 'u_cameraOrigin'),
      viewDirection: gl.getUniformLocation(this.program, 'u_viewDirection'),
      time: gl.getUniformLocation(this.program, 'u_time')
    };

    // Clean up shaders
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    console.log('GPU sampler shader compiled successfully');
  }

  /**
   * Sample the scene from one direction
   * @param {number} direction - View direction 0-5
   * @param {Object} bounds - { min: [x,y,z], max: [x,y,z] }
   * @returns {Object} - { positions, normals, colors, curvatures, count }
   */
  sampleDirection(direction, bounds) {
    const gl = this.gl;
    const res = this.resolution;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, res, res);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // Set uniforms
    gl.uniform2f(this.uniforms.resolution, res, res);
    gl.uniform3f(this.uniforms.boundsMin, bounds.min[0], bounds.min[1], bounds.min[2]);
    gl.uniform3f(this.uniforms.boundsMax, bounds.max[0], bounds.max[1], bounds.max[2]);
    gl.uniform1i(this.uniforms.viewDirection, direction);
    gl.uniform1f(this.uniforms.time, 0.0);

    // Clear and render
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Read back textures
    const pixelCount = res * res;

    let positionData, normalData, colorData;

    if (this.useFloatTextures) {
      positionData = new Float32Array(pixelCount * 4);
      normalData = new Float32Array(pixelCount * 4);
      colorData = new Float32Array(pixelCount * 4);

      gl.readBuffer(gl.COLOR_ATTACHMENT0);
      gl.readPixels(0, 0, res, res, gl.RGBA, gl.FLOAT, positionData);

      gl.readBuffer(gl.COLOR_ATTACHMENT1);
      gl.readPixels(0, 0, res, res, gl.RGBA, gl.FLOAT, normalData);

      gl.readBuffer(gl.COLOR_ATTACHMENT2);
      gl.readPixels(0, 0, res, res, gl.RGBA, gl.FLOAT, colorData);
    } else {
      // RGBA8 fallback - need to encode/decode
      const positionBytes = new Uint8Array(pixelCount * 4);
      const normalBytes = new Uint8Array(pixelCount * 4);
      const colorBytes = new Uint8Array(pixelCount * 4);

      gl.readBuffer(gl.COLOR_ATTACHMENT0);
      gl.readPixels(0, 0, res, res, gl.RGBA, gl.UNSIGNED_BYTE, positionBytes);

      gl.readBuffer(gl.COLOR_ATTACHMENT1);
      gl.readPixels(0, 0, res, res, gl.RGBA, gl.UNSIGNED_BYTE, normalBytes);

      gl.readBuffer(gl.COLOR_ATTACHMENT2);
      gl.readPixels(0, 0, res, res, gl.RGBA, gl.UNSIGNED_BYTE, colorBytes);

      // Convert to float (simple 0-1 range)
      positionData = new Float32Array(pixelCount * 4);
      normalData = new Float32Array(pixelCount * 4);
      colorData = new Float32Array(pixelCount * 4);

      for (let i = 0; i < pixelCount * 4; i++) {
        positionData[i] = positionBytes[i] / 255.0;
        normalData[i] = normalBytes[i] / 255.0;
        colorData[i] = colorBytes[i] / 255.0;
      }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Extract valid samples (where hit flag w > 0.5)
    const positions = [];
    const normals = [];
    const colors = [];
    const curvatures = [];

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
        curvatures.push(normalData[i * 4 + 3]);
      }
    }

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      colors: new Float32Array(colors),
      curvatures: new Float32Array(curvatures),
      count: positions.length / 3
    };
  }

  /**
   * Sample scene from all 6 orthogonal directions
   * @param {string} sceneGlsl - GLSL code from json-codegen
   * @param {Object} bounds - { min: [x,y,z], max: [x,y,z] }
   * @param {Object} options - Additional options
   * @returns {Object} - Combined point cloud
   */
  sample(sceneGlsl, bounds, options = {}) {
    const startTime = performance.now();

    // Compile shader with scene code
    this.compileShader(sceneGlsl);
    this.setupFramebuffer();

    // Sample from all 6 directions
    const allPositions = [];
    const allNormals = [];
    const allColors = [];
    const allCurvatures = [];

    const directions = options.directions || [0, 1, 2, 3, 4, 5];

    for (const dir of directions) {
      const result = this.sampleDirection(dir, bounds);

      if (result.count > 0) {
        allPositions.push(...result.positions);
        allNormals.push(...result.normals);
        allColors.push(...result.colors);
        allCurvatures.push(...result.curvatures);
      }

      console.log(`Direction ${dir}: ${result.count} samples`);
    }

    const totalCount = allPositions.length / 3;

    // Remove duplicate points (from overlapping rays)
    const dedupResult = this.deduplicatePoints(
      new Float32Array(allPositions),
      new Float32Array(allNormals),
      new Float32Array(allColors),
      new Float32Array(allCurvatures),
      options.deduplicationRadius || 0.01
    );

    const elapsed = performance.now() - startTime;
    console.log(`GPU sampling complete: ${dedupResult.count} points (from ${totalCount} raw) in ${elapsed.toFixed(0)}ms`);

    return dedupResult;
  }

  /**
   * Remove duplicate points within a radius
   */
  deduplicatePoints(positions, normals, colors, curvatures, radius) {
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

    for (let i = 0; i < count; i++) {
      if (keep[i]) {
        outPositions.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        outNormals.push(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
        outColors.push(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
        outCurvatures.push(curvatures[i]);
      }
    }

    return {
      positions: new Float32Array(outPositions),
      normals: new Float32Array(outNormals),
      colors: new Float32Array(outColors),
      curvatures: new Float32Array(outCurvatures),
      count: outPositions.length / 3
    };
  }

  /**
   * Convert GPU sample results to format expected by trainer
   * Includes anisotropic scale estimation from curvature
   */
  toPointCloud(sampleResult, options = {}) {
    const { positions, normals, colors, curvatures, count } = sampleResult;
    const baseScale = options.baseScale || 0.05;

    // Generate scales and rotations from normals and curvatures
    const scales = new Float32Array(count * 3);
    const rotations = new Float32Array(count * 4);

    for (let i = 0; i < count; i++) {
      // Get normal
      const nx = normals[i * 3];
      const ny = normals[i * 3 + 1];
      const nz = normals[i * 3 + 2];

      // Curvature affects scale - high curvature = smaller, flatter splats
      const k = Math.abs(curvatures[i]);
      const curvatureScale = 1.0 / (1.0 + k * 10.0);

      // Scale: flat along normal, expanded in tangent plane
      const normalScale = baseScale * 0.5 * curvatureScale;
      const tangentScale = baseScale * curvatureScale;

      scales[i * 3] = tangentScale;
      scales[i * 3 + 1] = tangentScale;
      scales[i * 3 + 2] = normalScale;

      // Compute quaternion to rotate Z-axis to normal direction
      // Using the half-angle formula: q = [sin(θ/2)*axis, cos(θ/2)]
      const up = [0, 0, 1];
      const dot = nx * up[0] + ny * up[1] + nz * up[2];

      if (dot > 0.9999) {
        // Normal ≈ +Z, identity quaternion
        rotations[i * 4] = 0;
        rotations[i * 4 + 1] = 0;
        rotations[i * 4 + 2] = 0;
        rotations[i * 4 + 3] = 1;
      } else if (dot < -0.9999) {
        // Normal ≈ -Z, 180° rotation around X
        rotations[i * 4] = 1;
        rotations[i * 4 + 1] = 0;
        rotations[i * 4 + 2] = 0;
        rotations[i * 4 + 3] = 0;
      } else {
        // General case: axis = normalize(up × normal), angle = acos(dot)
        const ax = up[1] * nz - up[2] * ny;
        const ay = up[2] * nx - up[0] * nz;
        const az = up[0] * ny - up[1] * nx;
        const axisLen = Math.sqrt(ax * ax + ay * ay + az * az);

        const halfAngle = Math.acos(dot) * 0.5;
        const sinHalf = Math.sin(halfAngle);
        const cosHalf = Math.cos(halfAngle);

        rotations[i * 4] = (ax / axisLen) * sinHalf;
        rotations[i * 4 + 1] = (ay / axisLen) * sinHalf;
        rotations[i * 4 + 2] = (az / axisLen) * sinHalf;
        rotations[i * 4 + 3] = cosHalf;
      }
    }

    return {
      positions,
      normals,
      colors,
      scales,
      rotations,
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
