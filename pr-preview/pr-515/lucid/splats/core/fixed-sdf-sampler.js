/**
 * Fixed SDF Sampler - Robust CPU-based surface sampling
 *
 * Improvements over naive approaches:
 * - Voxel diagonal check prevents tunneling through thin surfaces
 * - Spatial hash deduplication prevents duplicate points
 * - Bounds-aware ray marching starts outside, targets inside
 * - 90% relaxation in gradient descent prevents oscillation
 *
 * Credit: Contributed by Gemini
 */

export class FixedSDFSampler {
  constructor(options = {}) {
    this.resolution = options.resolution || 64;
    this.threshold = options.threshold || 0.001;
    this.normalDelta = options.normalDelta || 0.001;
    // Bounds are now mandatory for proper sampling
    this.bounds = options.bounds || { min: [-2, -2, -2], max: [2, 2, 2] };

    // Pre-calculate step sizes for grid
    const { min, max } = this.bounds;
    this.step = [
      (max[0] - min[0]) / this.resolution,
      (max[1] - min[1]) / this.resolution,
      (max[2] - min[2]) / this.resolution
    ];
    // Max distance from center to corner of a voxel
    this.voxelDiagonal = Math.sqrt(
      this.step[0]**2 + this.step[1]**2 + this.step[2]**2
    ) * 0.6; // Slightly > 0.5 to ensure overlap
  }

  /**
   * ROBUST GRID SAMPLER
   * - Uses voxel diagonal check to prevent tunneling
   * - Deduplicates points using a spatial hash
   */
  sample(sdfFunc) {
    const points = [];
    const normals = [];
    const colors = [];
    const processedHash = new Set(); // Spatial hash to prevent duplicates

    const { min } = this.bounds;
    const [sx, sy, sz] = this.step;

    // Helper to create a unique key for quantization
    const getKey = (x, y, z) => {
        const q = this.threshold * 2; // Quantize to 2x threshold
        return `${Math.round(x/q)},${Math.round(y/q)},${Math.round(z/q)}`;
    };

    for (let ix = 0; ix < this.resolution; ix++) {
      for (let iy = 0; iy < this.resolution; iy++) {
        for (let iz = 0; iz < this.resolution; iz++) {
          const x = min[0] + (ix + 0.5) * sx;
          const y = min[1] + (iy + 0.5) * sy;
          const z = min[2] + (iz + 0.5) * sz;

          const result = sdfFunc(x, y, z);

          // FIX: Compare against voxel diagonal, not arbitrary step
          if (Math.abs(result.distance) < this.voxelDiagonal) {

            const refined = this.refinePosition(sdfFunc, x, y, z);

            if (refined) {
              // FIX: Deduplicate
              const key = getKey(refined.x, refined.y, refined.z);
              if (processedHash.has(key)) continue;
              processedHash.add(key);

              points.push(refined.x, refined.y, refined.z);

              const normal = this.estimateNormal(sdfFunc, refined.x, refined.y, refined.z);
              normals.push(...normal);

              const c = sdfFunc(refined.x, refined.y, refined.z).color || [0.8, 0.8, 0.8];
              colors.push(...c);
            }
          }
        }
      }
    }

    return {
      positions: new Float32Array(points),
      normals: new Float32Array(normals),
      colors: new Float32Array(colors),
      count: points.length / 3
    };
  }

  /**
   * ROBUST RAY MARCHER
   * - Replaces "Sphere Origin" with "Bounds-Aware" Sampling
   * - Shoots rays through the actual volume of interest
   */
  sampleRayMarch(sdfFunc, options = {}) {
    const numRays = options.numRays || 10000;
    const maxSteps = 100;

    const points = [];
    const normals = [];
    const colors = [];

    // Bounds dimensions
    const bMin = this.bounds.min;
    const bMax = this.bounds.max;
    const bSize = [bMax[0]-bMin[0], bMax[1]-bMin[1], bMax[2]-bMin[2]];
    const maxBoundDist = Math.max(...bSize);

    for (let i = 0; i < numRays; i++) {
      // 1. Pick a random target point INSIDE the bounds
      const tx = bMin[0] + Math.random() * bSize[0];
      const ty = bMin[1] + Math.random() * bSize[1];
      const tz = bMin[2] + Math.random() * bSize[2];

      // 2. Pick a random direction
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const dx = Math.sin(phi) * Math.cos(theta);
      const dy = Math.sin(phi) * Math.sin(theta);
      const dz = Math.cos(phi);

      // 3. Back up the ray origin so it starts outside the object/bounds
      // We move back by the max dimension of the bounds to ensure we see the surface
      let x = tx - dx * maxBoundDist;
      let y = ty - dy * maxBoundDist;
      let z = tz - dz * maxBoundDist;

      // March
      let t = 0;
      let hit = false;
      let hitColor = [0.8, 0.8, 0.8];

      for (let step = 0; step < maxSteps; step++) {
        const res = sdfFunc(x, y, z);
        const dist = res.distance;

        if (dist < this.threshold) {
          hit = true;
          hitColor = res.color || hitColor;
          break;
        }

        // Optimization: If we passed our target point significantly, abort
        // (This prevents marching off into infinity)
        if (t > maxBoundDist * 1.5) break;

        const marchStep = Math.max(dist, 0.002); // Minimum step to prevent freeze
        x += dx * marchStep;
        y += dy * marchStep;
        z += dz * marchStep;
        t += marchStep;
      }

      if (hit) {
        // Optional: Refine the hit point for higher precision
        const refined = this.refinePosition(sdfFunc, x, y, z);
        if (refined) {
          points.push(refined.x, refined.y, refined.z);
          const n = this.estimateNormal(sdfFunc, refined.x, refined.y, refined.z);
          normals.push(...n);
          colors.push(...hitColor);
        }
      }
    }

    return {
      positions: new Float32Array(points),
      normals: new Float32Array(normals),
      colors: new Float32Array(colors),
      count: points.length / 3
    };
  }

  /**
   * STABILIZED GRADIENT DESCENT
   */
  refinePosition(sdfFunc, x, y, z, maxIter = 8) {
    let currentX = x, currentY = y, currentZ = z;

    for (let i = 0; i < maxIter; i++) {
      const dist = sdfFunc(currentX, currentY, currentZ).distance;

      if (Math.abs(dist) < this.threshold) {
        return { x: currentX, y: currentY, z: currentZ };
      }

      // 1. Calculate Normal (Gradient)
      const normal = this.estimateNormal(sdfFunc, currentX, currentY, currentZ);

      // 2. RELAXATION: Only move 90% of the distance
      // This prevents oscillating over the surface in non-Euclidean SDFs
      const step = dist * 0.9;

      currentX -= normal[0] * step;
      currentY -= normal[1] * step;
      currentZ -= normal[2] * step;
    }

    // Final check
    if (Math.abs(sdfFunc(currentX, currentY, currentZ).distance) < this.threshold * 5) {
      return { x: currentX, y: currentY, z: currentZ };
    }
    return null;
  }

  estimateNormal(sdfFunc, x, y, z) {
    const d = this.normalDelta;
    // Central differences (expensive but accurate)
    // For optimization, one could use forward difference: (f(x+d) - f(x))/d
    const dx = sdfFunc(x + d, y, z).distance - sdfFunc(x - d, y, z).distance;
    const dy = sdfFunc(x, y + d, z).distance - sdfFunc(x, y - d, z).distance;
    const dz = sdfFunc(x, y, z + d).distance - sdfFunc(x, y, z - d).distance;

    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-10) return [0, 1, 0];
    return [dx / len, dy / len, dz / len];
  }
}

export default FixedSDFSampler;
