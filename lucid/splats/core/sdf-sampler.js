/**
 * SDF Point Cloud Sampler
 *
 * Samples a signed distance field to generate a point cloud on the surface.
 * Uses sphere tracing + surface normal estimation.
 */

export class SDFSampler {
  constructor(options = {}) {
    this.resolution = options.resolution || 64;  // Grid resolution
    this.threshold = options.threshold || 0.001; // Surface threshold
    this.normalDelta = options.normalDelta || 0.001;
    this.bounds = options.bounds || { min: [-2, -2, -2], max: [2, 2, 2] };
  }

  /**
   * Sample SDF function to point cloud
   * @param {Function} sdfFunc - Function (x, y, z) => { distance, color }
   * @returns {Object} Point cloud { positions: Float32Array, normals: Float32Array, colors: Float32Array }
   */
  sample(sdfFunc) {
    const points = [];
    const normals = [];
    const colors = [];

    const { min, max } = this.bounds;
    const step = [
      (max[0] - min[0]) / this.resolution,
      (max[1] - min[1]) / this.resolution,
      (max[2] - min[2]) / this.resolution
    ];

    // Grid sampling with surface detection
    for (let ix = 0; ix < this.resolution; ix++) {
      for (let iy = 0; iy < this.resolution; iy++) {
        for (let iz = 0; iz < this.resolution; iz++) {
          const x = min[0] + (ix + 0.5) * step[0];
          const y = min[1] + (iy + 0.5) * step[1];
          const z = min[2] + (iz + 0.5) * step[2];

          const result = sdfFunc(x, y, z);
          const dist = result.distance;

          // Check if near surface
          if (Math.abs(dist) < step[0] * 0.5) {
            // Refine position using gradient descent
            const refined = this.refinePosition(sdfFunc, x, y, z);
            if (refined) {
              points.push(refined.x, refined.y, refined.z);

              // Estimate normal
              const normal = this.estimateNormal(sdfFunc, refined.x, refined.y, refined.z);
              normals.push(normal[0], normal[1], normal[2]);

              // Get color
              const colorResult = sdfFunc(refined.x, refined.y, refined.z);
              colors.push(
                colorResult.color?.[0] ?? 0.8,
                colorResult.color?.[1] ?? 0.8,
                colorResult.color?.[2] ?? 0.8
              );
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
   * Refine point position to lie exactly on surface
   */
  refinePosition(sdfFunc, x, y, z, maxIter = 5) {
    for (let i = 0; i < maxIter; i++) {
      const result = sdfFunc(x, y, z);
      const dist = result.distance;

      if (Math.abs(dist) < this.threshold) {
        return { x, y, z };
      }

      // Move along gradient
      const normal = this.estimateNormal(sdfFunc, x, y, z);
      x -= normal[0] * dist;
      y -= normal[1] * dist;
      z -= normal[2] * dist;
    }

    // Check final distance
    const finalDist = sdfFunc(x, y, z).distance;
    if (Math.abs(finalDist) < this.threshold * 10) {
      return { x, y, z };
    }

    return null;
  }

  /**
   * Estimate surface normal using central differences
   */
  estimateNormal(sdfFunc, x, y, z) {
    const d = this.normalDelta;

    const dx = sdfFunc(x + d, y, z).distance - sdfFunc(x - d, y, z).distance;
    const dy = sdfFunc(x, y + d, z).distance - sdfFunc(x, y - d, z).distance;
    const dz = sdfFunc(x, y, z + d).distance - sdfFunc(x, y, z - d).distance;

    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-10) return [0, 1, 0];

    return [dx / len, dy / len, dz / len];
  }

  /**
   * Sample with adaptive density (more points in detailed areas)
   */
  sampleAdaptive(sdfFunc, options = {}) {
    const basePoints = this.sample(sdfFunc);

    if (!options.adaptive) {
      return basePoints;
    }

    // TODO: Implement curvature-based adaptive sampling
    // For now, return base points
    return basePoints;
  }

  /**
   * Sample using ray marching from multiple directions
   * Better for thin/complex geometry
   */
  sampleRayMarch(sdfFunc, options = {}) {
    const numRays = options.numRays || 10000;
    const maxDist = options.maxDist || 10;
    const maxSteps = options.maxSteps || 100;

    const points = [];
    const normals = [];
    const colors = [];

    // Generate rays from sphere around scene
    for (let i = 0; i < numRays; i++) {
      // Random direction on sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const dx = Math.sin(phi) * Math.cos(theta);
      const dy = Math.sin(phi) * Math.sin(theta);
      const dz = Math.cos(phi);

      // Start from outside bounds
      const radius = 5;
      let x = -dx * radius;
      let y = -dy * radius;
      let z = -dz * radius;

      // March ray
      let t = 0;
      for (let step = 0; step < maxSteps && t < maxDist; step++) {
        const result = sdfFunc(x, y, z);
        const dist = result.distance;

        if (dist < this.threshold) {
          // Hit surface
          points.push(x, y, z);

          const normal = this.estimateNormal(sdfFunc, x, y, z);
          normals.push(normal[0], normal[1], normal[2]);

          colors.push(
            result.color?.[0] ?? 0.8,
            result.color?.[1] ?? 0.8,
            result.color?.[2] ?? 0.8
          );
          break;
        }

        // Step forward
        const stepDist = Math.max(dist, 0.01);
        x += dx * stepDist;
        y += dy * stepDist;
        z += dz * stepDist;
        t += stepDist;
      }
    }

    return {
      positions: new Float32Array(points),
      normals: new Float32Array(normals),
      colors: new Float32Array(colors),
      count: points.length / 3
    };
  }
}

export default SDFSampler;
