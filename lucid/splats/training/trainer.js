/**
 * Simple 3D Gaussian Splat Trainer
 *
 * Fits Gaussians to a point cloud. This is a simplified version that doesn't
 * do full differentiable rendering - instead it uses local point cloud statistics
 * to initialize and refine Gaussians.
 *
 * For production quality, you'd want proper differentiable rasterization with
 * gradient descent on rendering loss.
 */

import { Gaussian, GaussianCloud } from '../core/gaussian.js';

export class GaussianTrainer {
  constructor(options = {}) {
    this.iterations = options.iterations || 1000;
    this.learningRate = options.learningRate || 0.01;
    this.densifyInterval = options.densifyInterval || 100;
    this.pruneThreshold = options.pruneThreshold || 0.01;
    this.splitThreshold = options.splitThreshold || 0.05;
    this.maxGaussians = options.maxGaussians || 10000;
    this.neighborRadius = options.neighborRadius || 0.1;

    this.onProgress = options.onProgress || (() => {});
  }

  /**
   * Train Gaussians from point cloud
   * @param {Object} pointCloud - { positions, normals, colors, count }
   * @returns {GaussianCloud}
   */
  async train(pointCloud) {
    console.log(`Starting training with ${pointCloud.count} points`);

    // Step 1: Initialize Gaussians from points
    let cloud = this.initializeFromPoints(pointCloud);
    console.log(`Initialized ${cloud.count} Gaussians`);

    // Step 2: Compute local statistics for each Gaussian
    this.computeLocalStats(cloud, pointCloud);

    // Step 3: Iterative refinement
    for (let iter = 0; iter < this.iterations; iter++) {
      // Refine scales based on local density
      this.refineScales(cloud, pointCloud);

      // Refine opacities
      this.refineOpacities(cloud);

      // Densification (split large Gaussians, clone in sparse areas)
      if (iter > 0 && iter % this.densifyInterval === 0) {
        cloud = this.densify(cloud, pointCloud);
      }

      // Pruning (remove nearly transparent Gaussians)
      if (iter > 0 && iter % this.densifyInterval === 0) {
        cloud = this.prune(cloud);
      }

      // Progress callback
      if (iter % 100 === 0) {
        this.onProgress({
          iteration: iter,
          total: this.iterations,
          gaussianCount: cloud.count
        });

        // Yield to event loop
        await new Promise(r => setTimeout(r, 0));
      }
    }

    console.log(`Training complete: ${cloud.count} Gaussians`);
    return cloud;
  }

  /**
   * Initialize one Gaussian per point
   */
  initializeFromPoints(pointCloud) {
    const { positions, colors, count } = pointCloud;
    const cloud = new GaussianCloud();

    // Estimate initial scale from average point spacing
    const avgSpacing = this.estimatePointSpacing(pointCloud);
    const initialScale = avgSpacing * 0.5;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;

      cloud.add(new Gaussian({
        position: [positions[idx], positions[idx + 1], positions[idx + 2]],
        scale: [initialScale, initialScale, initialScale],
        rotation: [1, 0, 0, 0],
        color: colors ? [colors[idx], colors[idx + 1], colors[idx + 2]] : [0.8, 0.8, 0.8],
        opacity: 0.9
      }));
    }

    return cloud;
  }

  /**
   * Estimate average spacing between points
   */
  estimatePointSpacing(pointCloud) {
    const { positions, count } = pointCloud;

    if (count < 2) return 0.1;

    // Sample random pairs to estimate spacing
    const numSamples = Math.min(1000, count * (count - 1) / 2);
    let totalDist = 0;
    let sampleCount = 0;

    for (let s = 0; s < numSamples; s++) {
      const i = Math.floor(Math.random() * count);
      const j = Math.floor(Math.random() * count);
      if (i === j) continue;

      const idx1 = i * 3;
      const idx2 = j * 3;

      const dx = positions[idx1] - positions[idx2];
      const dy = positions[idx1 + 1] - positions[idx2 + 1];
      const dz = positions[idx1 + 2] - positions[idx2 + 2];

      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      totalDist += dist;
      sampleCount++;
    }

    // Average distance / sqrt(N) approximates nearest neighbor distance
    return sampleCount > 0 ? (totalDist / sampleCount) / Math.sqrt(count) : 0.1;
  }

  /**
   * Compute local statistics for each Gaussian
   */
  computeLocalStats(cloud, pointCloud) {
    const { positions, count } = pointCloud;

    for (const g of cloud.gaussians) {
      // Find nearby points
      const neighbors = [];

      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        const dx = positions[idx] - g.position[0];
        const dy = positions[idx + 1] - g.position[1];
        const dz = positions[idx + 2] - g.position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < this.neighborRadius) {
          neighbors.push({ idx: i, dist });
        }
      }

      // Store neighbor count for density estimation
      g._neighborCount = neighbors.length;

      // Compute local covariance if enough neighbors
      if (neighbors.length >= 3) {
        const cov = this.computeLocalCovariance(g.position, neighbors, positions);
        g._localCovariance = cov;
      }
    }
  }

  /**
   * Compute covariance of nearby points
   */
  computeLocalCovariance(center, neighbors, positions) {
    // Compute mean
    let mx = 0, my = 0, mz = 0;
    for (const n of neighbors) {
      const idx = n.idx * 3;
      mx += positions[idx];
      my += positions[idx + 1];
      mz += positions[idx + 2];
    }
    mx /= neighbors.length;
    my /= neighbors.length;
    mz /= neighbors.length;

    // Compute covariance matrix
    let cxx = 0, cxy = 0, cxz = 0;
    let cyy = 0, cyz = 0, czz = 0;

    for (const n of neighbors) {
      const idx = n.idx * 3;
      const dx = positions[idx] - mx;
      const dy = positions[idx + 1] - my;
      const dz = positions[idx + 2] - mz;

      cxx += dx * dx;
      cxy += dx * dy;
      cxz += dx * dz;
      cyy += dy * dy;
      cyz += dy * dz;
      czz += dz * dz;
    }

    const n = neighbors.length;
    return [
      [cxx / n, cxy / n, cxz / n],
      [cxy / n, cyy / n, cyz / n],
      [cxz / n, cyz / n, czz / n]
    ];
  }

  /**
   * Refine Gaussian scales based on local density
   */
  refineScales(cloud, pointCloud) {
    for (const g of cloud.gaussians) {
      if (g._localCovariance) {
        // Use eigenvalues of local covariance as scales
        const eigenvalues = this.computeEigenvalues(g._localCovariance);

        // Clamp to reasonable range
        g.scale = eigenvalues.map(ev =>
          Math.max(0.001, Math.min(0.5, Math.sqrt(Math.abs(ev)) * 2))
        );
      } else if (g._neighborCount !== undefined) {
        // Fall back to density-based scale
        const density = g._neighborCount / (4/3 * Math.PI * Math.pow(this.neighborRadius, 3));
        const scale = Math.pow(1 / (density + 1), 1/3) * 0.1;
        g.scale = [scale, scale, scale];
      }
    }
  }

  /**
   * Compute eigenvalues of 3x3 matrix (simplified - returns sorted diagonal)
   * For proper implementation, use Jacobi iteration or similar
   */
  computeEigenvalues(M) {
    // Simplified: return diagonal elements as approximation
    // TODO: Implement proper eigenvalue decomposition
    return [
      Math.abs(M[0][0]),
      Math.abs(M[1][1]),
      Math.abs(M[2][2])
    ].sort((a, b) => b - a);
  }

  /**
   * Refine opacities based on coverage
   */
  refineOpacities(cloud) {
    // Simple heuristic: higher density = lower individual opacity
    for (const g of cloud.gaussians) {
      if (g._neighborCount !== undefined) {
        // More neighbors = more overlapping = lower opacity needed
        const targetOpacity = Math.min(1, 2 / (g._neighborCount + 1));
        g.opacity = g.opacity * 0.9 + targetOpacity * 0.1;
      }
    }
  }

  /**
   * Densification: add Gaussians in under-represented areas
   */
  densify(cloud, pointCloud) {
    if (cloud.count >= this.maxGaussians) {
      return cloud;
    }

    const newGaussians = [];

    for (const g of cloud.gaussians) {
      // Split large Gaussians
      const maxScale = Math.max(...g.scale);
      if (maxScale > this.splitThreshold && cloud.count + newGaussians.length < this.maxGaussians) {
        // Split into two smaller Gaussians
        const offset = maxScale * 0.5;
        const axis = g.scale.indexOf(maxScale);

        const pos1 = [...g.position];
        const pos2 = [...g.position];
        pos1[axis] -= offset;
        pos2[axis] += offset;

        const newScale = g.scale.map(s => s * 0.7);

        newGaussians.push(new Gaussian({
          position: pos1,
          scale: newScale,
          rotation: [...g.rotation],
          color: [...g.color],
          opacity: g.opacity
        }));

        newGaussians.push(new Gaussian({
          position: pos2,
          scale: newScale,
          rotation: [...g.rotation],
          color: [...g.color],
          opacity: g.opacity
        }));

        // Mark original for removal
        g._remove = true;
      }
    }

    // Create new cloud with non-removed Gaussians + new ones
    const result = new GaussianCloud();
    for (const g of cloud.gaussians) {
      if (!g._remove) {
        result.add(g);
      }
    }
    for (const g of newGaussians) {
      result.add(g);
    }

    return result;
  }

  /**
   * Pruning: remove nearly transparent Gaussians
   */
  prune(cloud) {
    const result = new GaussianCloud();

    for (const g of cloud.gaussians) {
      if (g.opacity > this.pruneThreshold) {
        result.add(g);
      }
    }

    return result;
  }
}

/**
 * Quick training for MVP - minimal optimization
 */
export class QuickTrainer {
  constructor(options = {}) {
    this.targetCount = options.targetCount || 2000;
  }

  /**
   * Quick fit: just initialize from points with local scale estimation
   */
  async train(pointCloud) {
    const { positions, colors, count } = pointCloud;

    // Subsample if too many points
    let indices = Array.from({ length: count }, (_, i) => i);
    if (count > this.targetCount) {
      indices = this.subsample(indices, this.targetCount);
    }

    const cloud = new GaussianCloud();

    // Estimate spacing
    const bounds = this.computeBounds(positions, count);
    const volume = (bounds.max[0] - bounds.min[0]) *
                   (bounds.max[1] - bounds.min[1]) *
                   (bounds.max[2] - bounds.min[2]);
    const avgSpacing = Math.pow(volume / count, 1/3);
    const scale = avgSpacing * 0.4;

    for (const i of indices) {
      const idx = i * 3;

      cloud.add(new Gaussian({
        position: [positions[idx], positions[idx + 1], positions[idx + 2]],
        scale: [scale, scale, scale],
        rotation: [1, 0, 0, 0],
        color: colors ? [colors[idx], colors[idx + 1], colors[idx + 2]] : [0.8, 0.8, 0.8],
        opacity: 0.8
      }));
    }

    return cloud;
  }

  subsample(indices, targetCount) {
    // Random subsample
    const shuffled = [...indices].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, targetCount);
  }

  computeBounds(positions, count) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      for (let j = 0; j < 3; j++) {
        min[j] = Math.min(min[j], positions[idx + j]);
        max[j] = Math.max(max[j], positions[idx + j]);
      }
    }

    return { min, max };
  }
}

export default { GaussianTrainer, QuickTrainer };
