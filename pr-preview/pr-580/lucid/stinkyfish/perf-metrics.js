/**
 * Stinkyfish Performance Metrics System
 *
 * Provides real-time performance monitoring, statistics collection,
 * and debug visualization for the WebGPU raymarcher.
 */

export class PerfMetrics {
  constructor(options = {}) {
    // Rolling window for frame times (keep last 60 frames)
    this.frameTimes = [];
    this.maxSamples = options.maxSamples || 60;

    // Per-frame statistics
    this.stats = {
      // Timing
      frameTimeMs: 0,
      fps: 0,
      avgFrameTimeMs: 0,
      minFrameTimeMs: Infinity,
      maxFrameTimeMs: 0,

      // GPU metrics (when available)
      gpuTimeMs: 0,

      // Shader stats
      shaderCompileTimeMs: 0,
      uniformUploadCount: 0,

      // Scene complexity
      nodeCount: 0,
      helperFunctionCount: 0,
      shaderSizeBytes: 0,
      uniformCount: 0,

      // Raymarch stats (estimated from quality settings)
      maxSteps: 150,
      hitThreshold: 0.003,

      // Frame counter
      frameCount: 0,

      // Timestamp for throttled logging
      lastLogTime: 0
    };

    // Timestamps for GPU timing queries
    this.gpuTimingSupported = false;
    this.timestampQuerySet = null;
    this.timestampBuffer = null;
    this.resolveBuffer = null;

    // Debug mode flags
    this.debugMode = options.debugMode || 'none'; // 'none', 'steps', 'distance', 'normals', 'performance'
    this.showOverlay = options.showOverlay || false;

    // Shader cache statistics
    this.shaderCacheHits = 0;
    this.shaderCacheMisses = 0;

    // Event callbacks
    this.onStats = options.onStats || null;
  }

  /**
   * Initialize GPU timing query support (WebGPU feature)
   * @param {GPUDevice} device - WebGPU device
   */
  async initGpuTiming(device) {
    // Check if timestamp queries are supported
    if (!device.features.has('timestamp-query')) {
      console.log('[PerfMetrics] GPU timestamp queries not supported');
      this.gpuTimingSupported = false;
      return false;
    }

    try {
      // Create query set for 2 timestamps (start/end)
      this.timestampQuerySet = device.createQuerySet({
        type: 'timestamp',
        count: 2
      });

      // Buffer to hold resolved timestamps (2 * u64 = 16 bytes)
      this.timestampBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
      });

      // Staging buffer for CPU readback
      this.resolveBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });

      this.gpuTimingSupported = true;
      console.log('[PerfMetrics] GPU timestamp queries enabled');
      return true;
    } catch (e) {
      console.warn('[PerfMetrics] Failed to initialize GPU timing:', e);
      this.gpuTimingSupported = false;
      return false;
    }
  }

  /**
   * Record start of frame timing
   */
  beginFrame() {
    this._frameStart = performance.now();
  }

  /**
   * Record end of frame timing and update statistics
   */
  endFrame() {
    const now = performance.now();
    const frameTime = now - this._frameStart;

    // Add to rolling window
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }

    // Update stats
    this.stats.frameTimeMs = frameTime;
    this.stats.frameCount++;

    // Calculate average/min/max from window
    if (this.frameTimes.length > 0) {
      const sum = this.frameTimes.reduce((a, b) => a + b, 0);
      this.stats.avgFrameTimeMs = sum / this.frameTimes.length;
      this.stats.fps = 1000 / this.stats.avgFrameTimeMs;
      this.stats.minFrameTimeMs = Math.min(...this.frameTimes);
      this.stats.maxFrameTimeMs = Math.max(...this.frameTimes);
    }

    // Call stats callback if provided
    if (this.onStats) {
      this.onStats(this.stats);
    }

    // Throttled logging (once per second)
    if (now - this.stats.lastLogTime > 1000) {
      this.logStats();
      this.stats.lastLogTime = now;
    }
  }

  /**
   * Record shader compilation time
   * @param {number} timeMs - Compilation time in milliseconds
   */
  recordShaderCompile(timeMs, shaderSize = 0, uniformCount = 0, helperCount = 0) {
    this.stats.shaderCompileTimeMs = timeMs;
    this.stats.shaderSizeBytes = shaderSize;
    this.stats.uniformCount = uniformCount;
    this.stats.helperFunctionCount = helperCount;
  }

  /**
   * Record shader cache hit/miss
   * @param {boolean} hit - Whether it was a cache hit
   */
  recordCacheAccess(hit) {
    if (hit) {
      this.shaderCacheHits++;
    } else {
      this.shaderCacheMisses++;
    }
  }

  /**
   * Update scene complexity metrics
   */
  updateSceneMetrics(nodeCount, maxSteps, hitThreshold) {
    this.stats.nodeCount = nodeCount;
    this.stats.maxSteps = maxSteps;
    this.stats.hitThreshold = hitThreshold;
  }

  /**
   * Log current statistics to console
   */
  logStats() {
    const s = this.stats;
    console.log(`[Stinkyfish] FPS: ${s.fps.toFixed(1)} | Frame: ${s.avgFrameTimeMs.toFixed(2)}ms (${s.minFrameTimeMs.toFixed(2)}-${s.maxFrameTimeMs.toFixed(2)}) | ` +
                `Steps: ${s.maxSteps} | Shader: ${(s.shaderSizeBytes/1024).toFixed(1)}KB | ` +
                `Cache: ${this.shaderCacheHits}/${this.shaderCacheHits + this.shaderCacheMisses}`);
  }

  /**
   * Get formatted stats string for debug overlay
   */
  getOverlayText() {
    const s = this.stats;
    return [
      `FPS: ${s.fps.toFixed(1)}`,
      `Frame: ${s.avgFrameTimeMs.toFixed(2)}ms`,
      `Steps: ${s.maxSteps}`,
      `Shader: ${(s.shaderSizeBytes/1024).toFixed(1)}KB`,
      `Uniforms: ${s.uniformCount}`,
      `Helpers: ${s.helperFunctionCount}`,
      `Cache: ${this.shaderCacheHits}H/${this.shaderCacheMisses}M`
    ].join('\n');
  }

  /**
   * Reset all statistics
   */
  reset() {
    this.frameTimes = [];
    this.stats.frameCount = 0;
    this.stats.minFrameTimeMs = Infinity;
    this.stats.maxFrameTimeMs = 0;
    this.shaderCacheHits = 0;
    this.shaderCacheMisses = 0;
  }

  /**
   * Get current statistics snapshot
   */
  getStats() {
    return {
      ...this.stats,
      cacheHitRate: this.shaderCacheHits / Math.max(1, this.shaderCacheHits + this.shaderCacheMisses)
    };
  }
}

/**
 * Shader Cache for compiled pipelines
 * Caches WebGPU render pipelines by scene hash to avoid recompilation
 */
export class ShaderCache {
  constructor(maxEntries = 32) {
    this.cache = new Map();
    this.maxEntries = maxEntries;
    this.accessOrder = []; // LRU tracking
  }

  /**
   * Generate a hash for scene WGSL code
   * @param {string} wgsl - WGSL shader source
   * @returns {string} - Hash string
   */
  hashShader(wgsl) {
    // Simple hash based on length and samples
    let hash = wgsl.length;
    const step = Math.max(1, Math.floor(wgsl.length / 100));
    for (let i = 0; i < wgsl.length; i += step) {
      hash = ((hash << 5) - hash + wgsl.charCodeAt(i)) | 0;
    }
    return `sh_${hash.toString(36)}`;
  }

  /**
   * Get cached pipeline or null
   * @param {string} hash - Shader hash
   * @returns {Object|null} - Cached entry or null
   */
  get(hash) {
    const entry = this.cache.get(hash);
    if (entry) {
      // Update LRU order
      const idx = this.accessOrder.indexOf(hash);
      if (idx !== -1) {
        this.accessOrder.splice(idx, 1);
      }
      this.accessOrder.push(hash);
      return entry;
    }
    return null;
  }

  /**
   * Store pipeline in cache
   * @param {string} hash - Shader hash
   * @param {Object} entry - Pipeline and metadata to cache
   */
  set(hash, entry) {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxEntries && !this.cache.has(hash)) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(hash, entry);
    this.accessOrder.push(hash);
  }

  /**
   * Check if hash exists in cache
   */
  has(hash) {
    return this.cache.has(hash);
  }

  /**
   * Clear the cache
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxEntries
    };
  }
}

/**
 * Debug visualization modes for raymarching
 */
export const DebugModes = {
  NONE: 0,
  STEP_COUNT: 1,      // Heatmap of raymarching steps
  DISTANCE: 2,        // Distance field values
  NORMALS: 3,         // Surface normals as RGB
  DEPTH: 4,           // Depth buffer visualization
  OVERDRAW: 5,        // Overdraw visualization
  BOUNDING_BOX: 6     // BVH bounding boxes
};

/**
 * Generate WGSL debug visualization code
 * @param {number} mode - Debug mode from DebugModes
 * @returns {string} - WGSL code snippet for debug output
 */
export function generateDebugVisualization(mode) {
  switch (mode) {
    case DebugModes.STEP_COUNT:
      return `
// Debug: Step count heatmap
fn debugStepHeatmap(steps: i32, maxSteps: i32) -> vec3f {
  let t = f32(steps) / f32(maxSteps);
  // Blue (few) -> Green (medium) -> Red (many)
  if (t < 0.5) {
    return mix(vec3f(0.0, 0.0, 1.0), vec3f(0.0, 1.0, 0.0), t * 2.0);
  } else {
    return mix(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), (t - 0.5) * 2.0);
  }
}`;

    case DebugModes.NORMALS:
      return `
// Debug: Normal visualization
fn debugNormals(n: vec3f) -> vec3f {
  return n * 0.5 + 0.5;
}`;

    case DebugModes.DEPTH:
      return `
// Debug: Depth visualization
fn debugDepth(t: f32, maxDist: f32) -> vec3f {
  let d = 1.0 - clamp(t / maxDist, 0.0, 1.0);
  return vec3f(d, d, d);
}`;

    case DebugModes.DISTANCE:
      return `
// Debug: Distance field visualization
fn debugDistance(d: f32) -> vec3f {
  if (d < 0.0) {
    return vec3f(1.0, 0.3, 0.3); // Inside = red
  } else if (d < 0.1) {
    return vec3f(0.3, 1.0, 0.3); // Near surface = green
  } else {
    return vec3f(0.3, 0.3, min(1.0, d)); // Far = blue gradient
  }
}`;

    default:
      return '';
  }
}
