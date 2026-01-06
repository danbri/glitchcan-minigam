/**
 * SDF Point Cloud Sampler
 *
 * Samples a signed distance field to generate a point cloud on the surface.
 * Uses sphere tracing + surface normal estimation + curvature for anisotropic splats.
 */

export class SDFSampler {
  constructor(options = {}) {
    this.resolution = options.resolution || 64;  // Grid resolution
    this.threshold = options.threshold || 0.001; // Surface threshold
    this.normalDelta = options.normalDelta || 0.001;
    this.curvatureDelta = options.curvatureDelta || 0.01;
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
   * Estimate principal curvatures and directions using SDF Hessian
   * Returns { k1, k2, dir1, dir2, normal } where k1 >= k2 are principal curvatures
   * and dir1, dir2 are principal directions in tangent plane
   */
  estimateCurvature(sdfFunc, x, y, z, normal) {
    const d = this.curvatureDelta;

    // Compute Hessian of SDF (second derivatives)
    const f = (px, py, pz) => sdfFunc(px, py, pz).distance;
    const f0 = f(x, y, z);

    // Second partial derivatives using central differences
    const fxx = (f(x+d, y, z) - 2*f0 + f(x-d, y, z)) / (d*d);
    const fyy = (f(x, y+d, z) - 2*f0 + f(x, y-d, z)) / (d*d);
    const fzz = (f(x, y, z+d) - 2*f0 + f(x, y, z-d)) / (d*d);
    const fxy = (f(x+d, y+d, z) - f(x+d, y-d, z) - f(x-d, y+d, z) + f(x-d, y-d, z)) / (4*d*d);
    const fxz = (f(x+d, y, z+d) - f(x+d, y, z-d) - f(x-d, y, z+d) + f(x-d, y, z-d)) / (4*d*d);
    const fyz = (f(x, y+d, z+d) - f(x, y+d, z-d) - f(x, y-d, z+d) + f(x, y-d, z-d)) / (4*d*d);

    // Hessian matrix
    const H = [
      [fxx, fxy, fxz],
      [fxy, fyy, fyz],
      [fxz, fyz, fzz]
    ];

    // Build tangent basis from normal
    const n = normal;
    let t1 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    // t1 = t1 - (t1·n)n
    const dot1 = t1[0]*n[0] + t1[1]*n[1] + t1[2]*n[2];
    t1 = [t1[0] - dot1*n[0], t1[1] - dot1*n[1], t1[2] - dot1*n[2]];
    const len1 = Math.sqrt(t1[0]*t1[0] + t1[1]*t1[1] + t1[2]*t1[2]);
    t1 = [t1[0]/len1, t1[1]/len1, t1[2]/len1];

    // t2 = n × t1
    const t2 = [
      n[1]*t1[2] - n[2]*t1[1],
      n[2]*t1[0] - n[0]*t1[2],
      n[0]*t1[1] - n[1]*t1[0]
    ];

    // Project Hessian to tangent plane: shape operator S = -dn/ds
    // S_ij = t_i · H · t_j (in tangent basis)
    const Ht1 = [
      H[0][0]*t1[0] + H[0][1]*t1[1] + H[0][2]*t1[2],
      H[1][0]*t1[0] + H[1][1]*t1[1] + H[1][2]*t1[2],
      H[2][0]*t1[0] + H[2][1]*t1[1] + H[2][2]*t1[2]
    ];
    const Ht2 = [
      H[0][0]*t2[0] + H[0][1]*t2[1] + H[0][2]*t2[2],
      H[1][0]*t2[0] + H[1][1]*t2[1] + H[1][2]*t2[2],
      H[2][0]*t2[0] + H[2][1]*t2[1] + H[2][2]*t2[2]
    ];

    // 2x2 shape operator in tangent basis
    const S11 = t1[0]*Ht1[0] + t1[1]*Ht1[1] + t1[2]*Ht1[2];
    const S12 = t1[0]*Ht2[0] + t1[1]*Ht2[1] + t1[2]*Ht2[2];
    const S22 = t2[0]*Ht2[0] + t2[1]*Ht2[1] + t2[2]*Ht2[2];

    // Eigenvalues of 2x2 shape operator = principal curvatures
    const trace = S11 + S22;
    const det = S11*S22 - S12*S12;
    const disc = Math.sqrt(Math.max(0, trace*trace/4 - det));

    let k1 = trace/2 + disc;  // larger curvature
    let k2 = trace/2 - disc;  // smaller curvature

    // Eigenvectors give principal directions
    let dir1, dir2;
    if (Math.abs(S12) > 1e-10) {
      // Principal direction 1 in tangent basis
      const v1 = [k1 - S22, S12];
      const vlen = Math.sqrt(v1[0]*v1[0] + v1[1]*v1[1]);
      const v1n = [v1[0]/vlen, v1[1]/vlen];
      // Convert to world coordinates
      dir1 = [
        v1n[0]*t1[0] + v1n[1]*t2[0],
        v1n[0]*t1[1] + v1n[1]*t2[1],
        v1n[0]*t1[2] + v1n[1]*t2[2]
      ];
      dir2 = [
        -v1n[1]*t1[0] + v1n[0]*t2[0],
        -v1n[1]*t1[1] + v1n[0]*t2[1],
        -v1n[1]*t1[2] + v1n[0]*t2[2]
      ];
    } else {
      // Already diagonal - use tangent basis
      dir1 = t1;
      dir2 = t2;
      if (S22 > S11) {
        [k1, k2] = [k2, k1];
        [dir1, dir2] = [dir2, dir1];
      }
    }

    return { k1, k2, dir1, dir2, normal: n };
  }

  /**
   * Build rotation quaternion from orthonormal basis (dir1, dir2, normal)
   */
  basisToQuaternion(dir1, dir2, normal) {
    // Rotation matrix columns are the basis vectors
    // R = [dir1 | dir2 | normal]
    const m00 = dir1[0], m01 = dir2[0], m02 = normal[0];
    const m10 = dir1[1], m11 = dir2[1], m12 = normal[1];
    const m20 = dir1[2], m21 = dir2[2], m22 = normal[2];

    // Convert rotation matrix to quaternion
    const trace = m00 + m11 + m22;
    let w, x, y, z;

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      w = 0.25 / s;
      x = (m21 - m12) * s;
      y = (m02 - m20) * s;
      z = (m10 - m01) * s;
    } else if (m00 > m11 && m00 > m22) {
      const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
      w = (m21 - m12) / s;
      x = 0.25 * s;
      y = (m01 + m10) / s;
      z = (m02 + m20) / s;
    } else if (m11 > m22) {
      const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
      w = (m02 - m20) / s;
      x = (m01 + m10) / s;
      y = 0.25 * s;
      z = (m12 + m21) / s;
    } else {
      const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
      w = (m10 - m01) / s;
      x = (m02 + m20) / s;
      y = (m12 + m21) / s;
      z = 0.25 * s;
    }

    // Normalize
    const len = Math.sqrt(w*w + x*x + y*y + z*z);
    return [w/len, x/len, y/len, z/len];
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
   * Returns anisotropic data: positions, normals, colors, rotations, scales (based on curvature)
   */
  sampleRayMarch(sdfFunc, options = {}) {
    const numRays = options.numRays || 10000;
    const maxDist = options.maxDist || 10;
    const maxSteps = options.maxSteps || 100;
    const computeCurvature = options.computeCurvature !== false; // default true
    const baseScale = options.baseScale || 0.05;

    const points = [];
    const normals = [];
    const colors = [];
    const rotations = [];  // quaternions [w,x,y,z]
    const scales = [];     // anisotropic scales [s1, s2, s3]

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

          if (computeCurvature) {
            // Compute curvature for anisotropic splat
            const curv = this.estimateCurvature(sdfFunc, x, y, z, normal);

            // Build rotation quaternion from principal directions
            const quat = this.basisToQuaternion(curv.dir1, curv.dir2, curv.normal);
            rotations.push(quat[0], quat[1], quat[2], quat[3]);

            // Compute scales from curvature
            // Higher curvature = smaller scale (tighter fit)
            // Scale inversely proportional to curvature radius
            const minScale = baseScale * 0.3;
            const maxScale = baseScale * 3.0;

            // Convert curvature to scale: s = clamp(1/|k|, minScale, maxScale)
            const s1 = Math.max(minScale, Math.min(maxScale,
              Math.abs(curv.k1) > 0.01 ? baseScale / Math.abs(curv.k1) : maxScale));
            const s2 = Math.max(minScale, Math.min(maxScale,
              Math.abs(curv.k2) > 0.01 ? baseScale / Math.abs(curv.k2) : maxScale));
            // Normal direction: thin (splat lies on surface)
            const s3 = minScale * 0.5;

            scales.push(s1, s2, s3);
          } else {
            // Isotropic fallback
            rotations.push(1, 0, 0, 0);
            scales.push(baseScale, baseScale, baseScale);
          }

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
      rotations: new Float32Array(rotations),
      scales: new Float32Array(scales),
      count: points.length / 3,
      anisotropic: computeCurvature
    };
  }
}

export default SDFSampler;
