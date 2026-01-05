/**
 * Simple WebGL raymarcher for SDF scenes
 * Supports orbit camera, ground plane, and volume rendering modes
 * LCD-045: Now supports XPBD physics integration
 */

import { evaluateRig } from '../core/rig-evaluator.js';

// PhysicsBridge loaded dynamically to avoid blocking page load if physics fails
let PhysicsBridge = null;

export class SimpleRaymarcher {
  // Quality presets for raymarch parameters
  static QUALITY_PRESETS = {
    low: {
      maxSteps: 100,
      hitThreshold: 0.005,
      minStep: 0.006,
      relaxation: 0.5
    },
    medium: {
      maxSteps: 150,
      hitThreshold: 0.003,
      minStep: 0.004,
      relaxation: 0.7
    },
    high: {
      maxSteps: 200,
      hitThreshold: 0.002,
      minStep: 0.003,
      relaxation: 0.6
    }
  };

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
      stepSize: 0.05
    };

    // Raymarch quality settings (can be set per-scene)
    this.quality = 'medium';
    this.raymarchParams = { ...SimpleRaymarcher.QUALITY_PRESETS.medium };

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
    this.showEdges = true;
    this.showAxes = false;
    this.overrideTime = null; // When set, use this instead of elapsed time
    this.volumeStepSize = 0.05;
    this.volumeDensity = 8.0;

    // Enhanced volume rendering options
    this.volumeMode = 0;        // 0=jelly, 1=xray, 2=heatmap
    this.edgeFocus = 0.5;       // 0-1: how much to focus density on edges
    this.volumeComposite = 0.0; // 0-1: blend with surface render
    this.volumeColorMode = 0;   // 0=material, 1=rainbow, 2=depth

    // Scene parameters for parametric rigging
    this.sceneParams = {};      // { name: { value, type } }

    // Rig layer for constraint-based relationships
    this.rig = null;            // { derived, bounds, phase, chains }
    this.lastViolations = [];   // Most recent constraint violations
    this.onConstraintViolation = null;  // Callback: (violations) => void

    // Physics simulation (WebGPU XPBD)
    this.physicsBridge = null;  // PhysicsBridge instance
    this.physicsEnabled = false;
    this.sceneJson = null;      // Full scene JSON for physics init
    this.lastPhysicsTime = 0;

    // Lighting settings
    this.lighting = {
      lightDir: [1.0, 1.0, -1.0],
      ambient: 0.8,
      diffuse: 0.8,
      specular: 0.3,
      shininess: 32
    };

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

  updateScene(glslCode, sceneParams = {}, rig = null, sceneJson = null) {
    this.currentGlsl = glslCode;
    this.sceneParams = sceneParams;
    this.rig = rig;
    this.sceneJson = sceneJson;

    // Initialize physics if scene has physics config
    if (sceneJson?.physics?.enabled) {
      this.initPhysics(sceneJson);
    } else {
      this.physicsEnabled = false;
      this.physicsBridge = null;
    }

    this.compileShaders();
  }

  /**
   * Initialize physics from scene JSON (async)
   * Dynamically imports physics module, creates bridge, then inits GPU
   */
  async initPhysics(sceneJson) {
    console.log('initPhysics called, bodies:', sceneJson?.physics?.bodies?.length || 0);
    try {
      // Dynamic import to avoid blocking page load if physics module fails
      if (!PhysicsBridge) {
        console.log('Dynamically importing physics-bridge.js...');
        const module = await import('../core/physics/physics-bridge.js');
        PhysicsBridge = module.PhysicsBridge;
        console.log('Physics module loaded');
      }

      // Create bridge - pre-parses initial positions synchronously
      this.physicsBridge = new PhysicsBridge(sceneJson);
      console.log('PhysicsBridge created, initial positions:', this.physicsBridge.initialPositions.size);

      // GPU init is async
      const ok = await this.physicsBridge.init(sceneJson);
      this.physicsEnabled = ok;
      this.lastPhysicsTime = performance.now();
      console.log(`Physics initialized: ${ok ? (this.physicsBridge.isGPU() ? 'WebGPU' : 'CPU') : 'disabled'}`);

      if (ok) {
        console.log('Physics particles:', this.physicsBridge.physics.particles.length);
        console.log('Distance constraints:', this.physicsBridge.physics.distConstraints.length);
      }
    } catch (err) {
      console.error('Physics init failed:', err);
      this.physicsEnabled = false;
      this.physicsBridge = null;
    }
  }

  /**
   * Apply impulse to a physics body (for interaction)
   */
  applyPhysicsImpulse(bodyName, impulse) {
    if (this.physicsBridge && this.physicsEnabled) {
      this.physicsBridge.applyImpulse(bodyName, impulse);
    }
  }

  /**
   * Update a single scene parameter value (for live tweaking)
   */
  setParam(name, value) {
    if (this.sceneParams[name]) {
      this.sceneParams[name].value = value;
    }
  }

  /**
   * Set raymarch quality level (low, medium, high) or custom params
   * @param {string|object} quality - 'low', 'medium', 'high' or {maxSteps, hitThreshold, minStep, relaxation}
   */
  setQuality(quality) {
    if (typeof quality === 'string') {
      const preset = SimpleRaymarcher.QUALITY_PRESETS[quality];
      if (preset) {
        this.quality = quality;
        this.raymarchParams = { ...preset };
      } else {
        console.warn(`Unknown quality preset: ${quality}, using 'medium'`);
        this.quality = 'medium';
        this.raymarchParams = { ...SimpleRaymarcher.QUALITY_PRESETS.medium };
      }
    } else if (typeof quality === 'object') {
      this.quality = 'custom';
      this.raymarchParams = {
        ...SimpleRaymarcher.QUALITY_PRESETS.medium,
        ...quality
      };
    }
    // Recompile shaders if we have a current scene
    if (this.currentGlsl) {
      this.compileShaders();
    }
  }

  setLighting(settings) {
    if (settings.lightDir) this.lighting.lightDir = settings.lightDir;
    if (settings.ambient !== undefined) this.lighting.ambient = settings.ambient;
    if (settings.diffuse !== undefined) this.lighting.diffuse = settings.diffuse;
    if (settings.specular !== undefined) this.lighting.specular = settings.specular;
    if (settings.shininess !== undefined) this.lighting.shininess = settings.shininess;
  }

  compileShaders() {
    const gl = this.gl;

    // Log what GLSL we're about to compile
    console.log('📝 Compiling with GLSL code length:', this.currentGlsl.length);
    if (this.currentGlsl.length === 0) {
      console.error('❌ No GLSL code provided to renderer!');
      return;
    }

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
      uniform float u_showEdges;
      uniform float u_showAxes;
      uniform float u_volumeStepSize;
      uniform float u_volumeDensity;
      uniform int u_volumeMode;        // 0=jelly, 1=xray, 2=heatmap
      uniform float u_edgeFocus;       // 0-1: edge density focus
      uniform float u_volumeComposite; // 0-1: blend with surface
      uniform int u_volumeColorMode;   // 0=material, 1=rainbow, 2=depth
      uniform vec3 u_lightDir;
      uniform float u_ambient;
      uniform float u_diffuse;
      uniform float u_specular;
      uniform float u_shininess;

      ${this.currentGlsl}

      // Ground plane SDF with checkerboard pattern
      float sdGroundPlane(vec3 p) {
        return p.y + 1.5; // Plane at y = -1.5
      }

      // Axis arrow SDFs - Blender-style RGB arrows
      // Returns vec4(distance, r, g, b)
      vec4 sdAxisArrows(vec3 p) {
        float arrowLen = 2.5;
        float shaftR = 0.035;
        float headR = 0.10;
        float headH = 0.22;

        // X axis - Red arrow (positive X direction)
        vec3 px = p - vec3(arrowLen * 0.5, 0.0, 0.0);
        float dXshaft = length(vec2(length(px.yz), max(abs(px.x) - arrowLen * 0.5 + headH, 0.0))) - shaftR;
        vec3 pxHead = p - vec3(arrowLen, 0.0, 0.0);
        float dXhead = length(vec2(length(pxHead.yz) - headR * (1.0 - clamp(pxHead.x / headH, 0.0, 1.0)), max(-pxHead.x, pxHead.x - headH)));
        dXhead = max(dXhead, -pxHead.x);
        float dX = min(dXshaft, dXhead);

        // Y axis - Green arrow (positive Y direction)
        vec3 py = p - vec3(0.0, arrowLen * 0.5, 0.0);
        float dYshaft = length(vec2(length(py.xz), max(abs(py.y) - arrowLen * 0.5 + headH, 0.0))) - shaftR;
        vec3 pyHead = p - vec3(0.0, arrowLen, 0.0);
        float dYhead = length(vec2(length(pyHead.xz) - headR * (1.0 - clamp(pyHead.y / headH, 0.0, 1.0)), max(-pyHead.y, pyHead.y - headH)));
        dYhead = max(dYhead, -pyHead.y);
        float dY = min(dYshaft, dYhead);

        // Z axis - Blue arrow (positive Z direction)
        vec3 pz = p - vec3(0.0, 0.0, arrowLen * 0.5);
        float dZshaft = length(vec2(length(pz.xy), max(abs(pz.z) - arrowLen * 0.5 + headH, 0.0))) - shaftR;
        vec3 pzHead = p - vec3(0.0, 0.0, arrowLen);
        float dZhead = length(vec2(length(pzHead.xy) - headR * (1.0 - clamp(pzHead.z / headH, 0.0, 1.0)), max(-pzHead.z, pzHead.z - headH)));
        dZhead = max(dZhead, -pzHead.z);
        float dZ = min(dZshaft, dZhead);

        // Find closest axis and return with color
        if (dX < dY && dX < dZ) {
          return vec4(dX, 0.9, 0.2, 0.2);  // Red for X
        } else if (dY < dZ) {
          return vec4(dY, 0.2, 0.9, 0.2);  // Green for Y
        } else {
          return vec4(dZ, 0.3, 0.4, 0.9);  // Blue for Z
        }
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

      // Raymarch quality parameters (baked from quality preset)
      #define MAX_STEPS ${this.raymarchParams.maxSteps}
      #define HIT_THRESHOLD ${this.raymarchParams.hitThreshold.toFixed(6)}
      #define MIN_STEP ${this.raymarchParams.minStep.toFixed(6)}
      #define RELAXATION ${this.raymarchParams.relaxation.toFixed(6)}

      vec4 raymarch(vec3 ro, vec3 rd) {
        float t = 0.0;
        vec3 colVol = vec3(0.0);
        float trans = 1.0;
        bool hitSurface = false;
        vec3 hitPos = vec3(0.0);
        vec3 surfaceColor = vec3(0.0);
        vec3 surfaceNormal = vec3(0.0);
        float surfaceT = 0.0;

        // Ground plane: compute ray-plane intersection ONCE, render AFTER scene marching
        // This completely separates ground from scene SDF to avoid interference
        float groundT = -1.0;
        vec3 groundHitPos = vec3(0.0);
        if (u_showGroundPlane > 0.5 && abs(rd.y) > 0.001) {
          float groundY = -1.5;
          groundT = (groundY - ro.y) / rd.y;
          if (groundT > 0.0) {
            groundHitPos = ro + rd * groundT;
          }
        }

        // Track scene hit separately - don't return early, let ground plane compare
        float sceneHitT = -1.0;
        vec3 sceneHitColor = vec3(0.0);
        vec3 sceneHitNormal = vec3(0.0);

        for (int i = 0; i < MAX_STEPS; i++) {
          if (t > 50.0) break;
          if (u_volumeRender > 0.5 && trans < 0.01) break;

          // Stop marching if we've gone past both scene potential and ground plane
          float maxT = groundT > 0.0 ? groundT + 0.1 : 50.0;
          if (t > maxT && sceneHitT < 0.0) break;

          vec3 p = ro + rd * t;
          vec4 scene = g_df_scene(p);
          float d = scene.x;
          vec3 sceneColor = scene.yzw;

          // Check axes if enabled
          if (u_showAxes > 0.5) {
            vec4 axes = sdAxisArrows(p);
            if (axes.x < d) {
              d = axes.x;
              sceneColor = axes.yzw;
            }
          }

          // Surface mode - traditional raymarching
          if (u_volumeRender < 0.5) {
            // Hit threshold - record hit but don't return yet
            if (abs(d) < HIT_THRESHOLD && sceneHitT < 0.0) {
              sceneHitT = t;
              sceneHitNormal = calcNormal(p);
              sceneHitColor = sceneColor;
              // Found scene hit - can stop marching
              break;
            }

            // Conservative stepping with minimum step size (from quality preset)
            t += max(abs(d) * RELAXATION, MIN_STEP);
          } else {
            // Volume mode - accumulate density near surface
            float stepSize = u_volumeStepSize;

            // Calculate density based on volume mode
            float baseDensity;
            if (u_volumeMode == 0) {
              // Jelly mode: sharp smoothstep like older code - peaks at surface
              baseDensity = smoothstep(0.1, -0.1, d) * 0.5;
            } else if (u_volumeMode == 1) {
              // X-ray mode: shows internal structure with grid
              baseDensity = smoothstep(0.15, -0.05, d) * 0.3;
              // Add grid lines for x-ray effect
              vec3 grid = abs(mod(p + 0.5, 1.0) - 0.5);
              float gridLines = min(min(grid.x, grid.y), grid.z);
              baseDensity += (1.0 - smoothstep(0.0, 0.02, gridLines)) * 0.15;
            } else {
              // Heatmap mode: distance-based density falloff
              baseDensity = exp(-abs(d) * 3.0) * 0.6;
            }

            // Edge focus: blend between surface-only and full-volume
            float edgeMask = smoothstep(0.05, -0.02, d);
            float density = mix(baseDensity, baseDensity * edgeMask, u_edgeFocus);

            // Calculate color based on color mode
            vec3 volColor;
            if (u_volumeColorMode == 0) {
              // Material color from SDF
              volColor = scene.yzw;
            } else if (u_volumeColorMode == 1) {
              // Rainbow based on distance (like jellies demo)
              volColor = 0.5 + 0.5 * cos(vec3(1.0, 2.0, 3.0) + d * 3.0 + u_time * 0.5);
            } else {
              // Depth-based coloring
              float depthFactor = clamp(t / 20.0, 0.0, 1.0);
              volColor = mix(vec3(0.2, 0.8, 1.0), vec3(1.0, 0.3, 0.1), depthFactor);
            }

            // Accumulate color with proper weighting
            float absorption = density * stepSize * u_volumeDensity;
            colVol += trans * volColor * absorption;
            trans *= exp(-absorption * 2.0);

            // Track first surface hit for edge rendering and compositing
            if (!hitSurface && d < 0.01) {
              hitSurface = true;
              surfaceT = t;
              surfaceColor = scene.yzw;
              surfaceNormal = calcNormal(p);
            }

            // Fixed step size for consistent appearance
            t += stepSize;
          }
        }

        // Return background or accumulated volume
        if (u_volumeRender > 0.5) {
          vec3 col = colVol;

          // Composite with surface render if enabled
          if (u_volumeComposite > 0.01 && hitSurface) {
            vec3 normal = surfaceNormal;
            vec3 light = normalize(u_lightDir);
            float diff = max(dot(normal, light), 0.0);
            float spec = pow(max(dot(reflect(-light, normal), -rd), 0.0), u_shininess);
            vec3 surfLit = surfaceColor * (u_ambient + diff * u_diffuse) + spec * u_specular;
            col = mix(col, surfLit, u_volumeComposite);
          }

          // Apply edge darkening in volume mode too
          if (u_showEdges > 0.5 && hitSurface) {
            float edge = pow(1.0 - abs(dot(surfaceNormal, -rd)), 2.0);
            col = mix(col, col * 0.2, edge * 0.6);
          }

          // Tone mapping
          col = col / (1.0 + col);
          col = pow(col, vec3(0.4545)); // Gamma correction

          return vec4(col, 1.0);
        }

        // Surface mode: compare scene hit vs ground plane, render closer one
        bool useGround = groundT > 0.0 && (sceneHitT < 0.0 || groundT < sceneHitT);

        if (useGround) {
          // Render ground plane with checkerboard
          vec3 normal = vec3(0.0, 1.0, 0.0);
          vec3 light = normalize(u_lightDir);
          float diff = max(dot(normal, light), 0.0);
          vec3 col = getGroundColor(groundHitPos) * (u_ambient + diff * u_diffuse);
          return vec4(col, 1.0);
        }

        if (sceneHitT > 0.0) {
          // Render scene hit
          vec3 light = normalize(u_lightDir);
          float diff = max(dot(sceneHitNormal, light), 0.0);
          float spec = pow(max(dot(reflect(-light, sceneHitNormal), -rd), 0.0), u_shininess);
          vec3 col = sceneHitColor * (u_ambient + diff * u_diffuse) + spec * u_specular;

          // Edge rendering - darken silhouette edges
          if (u_showEdges > 0.5) {
            float edge = pow(1.0 - abs(dot(sceneHitNormal, -rd)), 2.0);
            col = mix(col, vec3(0.0), edge * 0.7);
          }

          return vec4(col, 1.0);
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
    const time = this.overrideTime !== null
      ? this.overrideTime
      : (performance.now() - this.startTime) / 1000.0;
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

    const showEdgesLocation = gl.getUniformLocation(this.program, 'u_showEdges');
    gl.uniform1f(showEdgesLocation, this.showEdges ? 1.0 : 0.0);

    const showAxesLocation = gl.getUniformLocation(this.program, 'u_showAxes');
    gl.uniform1f(showAxesLocation, this.showAxes ? 1.0 : 0.0);

    const volumeStepSizeLocation = gl.getUniformLocation(this.program, 'u_volumeStepSize');
    gl.uniform1f(volumeStepSizeLocation, this.volumeStepSize);

    const volumeDensityLocation = gl.getUniformLocation(this.program, 'u_volumeDensity');
    gl.uniform1f(volumeDensityLocation, this.volumeDensity);

    // Enhanced volume rendering uniforms
    const volumeModeLocation = gl.getUniformLocation(this.program, 'u_volumeMode');
    gl.uniform1i(volumeModeLocation, this.volumeMode);

    const edgeFocusLocation = gl.getUniformLocation(this.program, 'u_edgeFocus');
    gl.uniform1f(edgeFocusLocation, this.edgeFocus);

    const volumeCompositeLocation = gl.getUniformLocation(this.program, 'u_volumeComposite');
    gl.uniform1f(volumeCompositeLocation, this.volumeComposite);

    const volumeColorModeLocation = gl.getUniformLocation(this.program, 'u_volumeColorMode');
    gl.uniform1i(volumeColorModeLocation, this.volumeColorMode);

    // Lighting uniforms
    const lightDirLocation = gl.getUniformLocation(this.program, 'u_lightDir');
    gl.uniform3f(lightDirLocation, this.lighting.lightDir[0], this.lighting.lightDir[1], this.lighting.lightDir[2]);

    const ambientLocation = gl.getUniformLocation(this.program, 'u_ambient');
    gl.uniform1f(ambientLocation, this.lighting.ambient);

    const diffuseLocation = gl.getUniformLocation(this.program, 'u_diffuse');
    gl.uniform1f(diffuseLocation, this.lighting.diffuse);

    const specularLocation = gl.getUniformLocation(this.program, 'u_specular');
    gl.uniform1f(specularLocation, this.lighting.specular);

    const shininessLocation = gl.getUniformLocation(this.program, 'u_shininess');
    gl.uniform1f(shininessLocation, this.lighting.shininess);

    // Evaluate rig layer if present (computes derived params, checks constraints, evaluates phase)
    let rigResult = null;
    if (this.rig) {
      rigResult = evaluateRig(this.sceneParams, this.rig, time);

      // Report constraint violations if callback is set
      if (rigResult.violations.length > 0 || this.lastViolations.length > 0) {
        // Only call if violations changed
        const violationsChanged = JSON.stringify(rigResult.violations) !== JSON.stringify(this.lastViolations);
        if (violationsChanged) {
          this.lastViolations = rigResult.violations;
          if (this.onConstraintViolation) {
            this.onConstraintViolation(rigResult.violations);
          }
        }
      }
    }

    // Bind scene parameters (base params)
    for (const [name, param] of Object.entries(this.sceneParams)) {
      // Skip non-object params (like _comment_* string entries)
      if (typeof param !== 'object' || param === null) continue;

      const loc = gl.getUniformLocation(this.program, `u_${name}`);
      if (loc === null) continue;  // Uniform not used in shader

      // Use rig-evaluated value if available, otherwise raw param value
      const value = rigResult ? (rigResult.values[name] ?? param.value) : param.value;

      if (param.type === 'scalar') {
        gl.uniform1f(loc, value);
      } else if (param.type === 'color3' || param.type === 'position3' || param.type === 'radii3' || param.type === 'direction3') {
        if (Array.isArray(value) && value.length >= 3) {
          gl.uniform3f(loc, value[0], value[1], value[2]);
        }
      }
    }

    // Bind derived and phase-generated params from rig
    if (rigResult) {
      // Bind derived params
      for (const [name, value] of Object.entries(rigResult.derived)) {
        const loc = gl.getUniformLocation(this.program, `u_${name}`);
        if (loc !== null) {
          gl.uniform1f(loc, value);
        }
      }

      // Bind phase-coupled animation params
      for (const [name, value] of Object.entries(rigResult.phaseValues)) {
        const loc = gl.getUniformLocation(this.program, `u_${name}`);
        if (loc !== null) {
          gl.uniform1f(loc, value);
        }
      }
    }

    // Physics param binding (initial positions available immediately, physics steps after init)
    if (this.physicsBridge) {
      // Step physics only if fully initialized
      if (this.physicsEnabled) {
        // Step physics (async but we don't wait - use last frame's results)
        const now = performance.now();
        const dt = Math.min((now - this.lastPhysicsTime) / 1000, 0.05); // Cap at 50ms
        this.lastPhysicsTime = now;

        // Synchronous physics step (CPU fallback is sync, GPU is async)
        this.physicsBridge.step(dt);
      }

      // Bind physics-derived params (positions of physics bodies)
      // getParamValues returns initial positions even before full init
      const physicsParams = this.physicsBridge.getParamValues();

      // Debug: log first frame physics state
      if (!this._physicsLoggedOnce && Object.keys(physicsParams).length > 0) {
        this._physicsLoggedOnce = true;
        console.log('Physics params:', physicsParams);
        console.log('Physics enabled:', this.physicsEnabled);
      }

      for (const [name, param] of Object.entries(physicsParams)) {
        const loc = gl.getUniformLocation(this.program, `u_${name}`);
        if (loc === null) {
          if (!this._missingUniformsLogged) {
            console.warn(`Missing uniform: u_${name}`);
          }
          continue;
        }

        if (param.type === 'position3' && Array.isArray(param.value)) {
          gl.uniform3f(loc, param.value[0], param.value[1], param.value[2]);
        }
      }
      this._missingUniformsLogged = true;
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
