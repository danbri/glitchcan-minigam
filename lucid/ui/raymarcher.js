/**
 * Simple WebGL raymarcher for SDF scenes
 * Supports orbit camera, ground plane, and volume rendering modes
 */
export class SimpleRaymarcher {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    this.params = {
      maxSteps: 100,
      maxDist: 50.0,
      surfDist: 0.001,
      stepSize: 1.0
    };

    this.currentGlsl = '';
    this.program = null;
    this.startTime = performance.now();

    // Camera orbit controls
    this.camera = {
      distance: 4.0,
      theta: 0.0,      // horizontal angle
      phi: Math.PI / 4, // vertical angle (45 degrees)
      target: [0, 0, 0]
    };

    this.showGroundPlane = true;
    this.volumeRender = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  updateScene(glslCode) {
    this.currentGlsl = glslCode;
    this.compileShaders();
  }

  compileShaders() {
    const gl = this.gl;

    const vertexShaderSource = `
      attribute vec4 a_position;
      void main() {
        gl_Position = a_position;
      }
    `;

    const fragmentShaderSource = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec3 u_cameraPos;
      uniform vec3 u_cameraTarget;
      uniform float u_showGroundPlane;
      uniform float u_volumeRender;

      ${this.currentGlsl}

      // Ground plane SDF with checkerboard pattern
      float sdGroundPlane(vec3 p) {
        return p.y + 1.5; // Plane at y = -1.5
      }

      vec3 getGroundColor(vec3 p) {
        // Checkerboard pattern
        float scale = 0.5;
        vec2 q = floor(p.xz / scale);
        float checker = mod(q.x + q.y, 2.0);
        vec3 color1 = vec3(0.15, 0.15, 0.2);
        vec3 color2 = vec3(0.25, 0.25, 0.3);
        return mix(color1, color2, checker);
      }

      vec3 calcNormal(vec3 p) {
        vec2 e = vec2(0.001, 0.0);
        return normalize(vec3(
          g_df_scene(p + e.xyy).x - g_df_scene(p - e.xyy).x,
          g_df_scene(p + e.yxy).x - g_df_scene(p - e.yxy).x,
          g_df_scene(p + e.yyx).x - g_df_scene(p - e.yyx).x
        ));
      }

      vec4 raymarch(vec3 ro, vec3 rd) {
        float t = 0.0;
        vec3 colVol = vec3(0.0);
        float trans = 1.0;
        bool hitGround = false;
        vec3 hitPos = vec3(0.0);
        float stepSize = 0.05;

        for (int i = 0; i < 100; i++) {
          if (t > 50.0) break;
          if (u_volumeRender > 0.5 && trans < 0.01) break;

          vec3 p = ro + rd * t;
          vec4 scene = g_df_scene(p);
          float d = scene.x;

          // Check ground plane if enabled
          if (u_showGroundPlane > 0.5) {
            float dGround = sdGroundPlane(p);
            if (dGround < d) {
              d = dGround;
              if (abs(d) < 0.001) {
                hitGround = true;
                hitPos = p;
              }
            }
          }

          // Surface mode - traditional raymarching
          if (u_volumeRender < 0.5) {
            if (abs(d) < 0.001 && !hitGround) {
              vec3 normal = calcNormal(p);
              vec3 light = normalize(vec3(1.0, 1.0, -1.0));
              float diff = max(dot(normal, light), 0.0);
              float amb = 0.3;
              float spec = pow(max(dot(reflect(-light, normal), -rd), 0.0), 32.0);
              vec3 col = scene.yzw * (amb + diff * 0.7) + spec * 0.3;
              return vec4(col, 1.0);
            }

            if (hitGround) {
              vec3 normal = vec3(0.0, 1.0, 0.0);
              vec3 light = normalize(vec3(1.0, 1.0, -1.0));
              float diff = max(dot(normal, light), 0.0);
              float amb = 0.3;
              vec3 col = getGroundColor(hitPos) * (amb + diff * 0.7);
              return vec4(col, 1.0);
            }

            t += abs(d) * 0.9;
          } else {
            // Volume mode - accumulate density near surface
            // Use smooth density falloff instead of hard inside/outside
            float density = exp(-abs(d) * 5.0); // Density peaks at surface (d=0)

            // Accumulate color with proper weighting
            float absorption = density * stepSize * 8.0;
            colVol += trans * scene.yzw * absorption;
            trans *= 1.0 - absorption; // Reduce transmission

            // Fixed step size for consistent appearance
            t += stepSize;
          }
        }

        // Return background or accumulated volume
        if (u_volumeRender > 0.5) {
          return vec4(colVol, 1.0);
        }
        return vec4(0.0);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;

        // Camera setup with orbit controls
        vec3 ro = u_cameraPos;
        vec3 forward = normalize(u_cameraTarget - u_cameraPos);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
        vec3 up = cross(forward, right);
        vec3 rd = normalize(forward + uv.x * right + uv.y * up);

        vec4 col = raymarch(ro, rd);

        // Background gradient
        if (col.a < 0.5) {
          vec3 bg = mix(vec3(0.02, 0.02, 0.08), vec3(0.05, 0.0, 0.1), uv.y * 0.5 + 0.5);
          col = vec4(bg, 1.0);
        }

        gl_FragColor = col;
      }
    `;

    // Clean up old program
    if (this.program) {
      gl.deleteProgram(this.program);
    }

    // Compile shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(fragmentShader);
      console.error('❌ Fragment shader compilation FAILED:');
      console.error(error);
      console.log('Shader source:', fragmentShaderSource);
      return;
    }

    // Link program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(this.program);
      console.error('❌ Program linking FAILED:');
      console.error(error);
      return;
    }

    console.log('✅ Shader compiled and linked successfully');

    // Set up geometry
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  }

  getCameraPosition() {
    const { distance, theta, phi, target } = this.camera;
    return [
      target[0] + distance * Math.sin(phi) * Math.sin(theta),
      target[1] + distance * Math.cos(phi),
      target[2] + distance * Math.sin(phi) * Math.cos(theta)
    ];
  }

  render() {
    if (!this.program) return;

    const gl = this.gl;
    gl.useProgram(this.program);

    const resolutionLocation = gl.getUniformLocation(this.program, 'u_resolution');
    gl.uniform2f(resolutionLocation, this.canvas.width, this.canvas.height);

    const timeLocation = gl.getUniformLocation(this.program, 'u_time');
    const time = (performance.now() - this.startTime) / 1000.0;
    gl.uniform1f(timeLocation, time);

    // Camera uniforms
    const cameraPos = this.getCameraPosition();
    const cameraPosLocation = gl.getUniformLocation(this.program, 'u_cameraPos');
    gl.uniform3f(cameraPosLocation, cameraPos[0], cameraPos[1], cameraPos[2]);

    const cameraTargetLocation = gl.getUniformLocation(this.program, 'u_cameraTarget');
    gl.uniform3f(cameraTargetLocation, this.camera.target[0], this.camera.target[1], this.camera.target[2]);

    const groundPlaneLocation = gl.getUniformLocation(this.program, 'u_showGroundPlane');
    gl.uniform1f(groundPlaneLocation, this.showGroundPlane ? 1.0 : 0.0);

    const volumeRenderLocation = gl.getUniformLocation(this.program, 'u_volumeRender');
    gl.uniform1f(volumeRenderLocation, this.volumeRender ? 1.0 : 0.0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
