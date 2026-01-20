/**
 * Gaussian Splat Data Structure
 *
 * Represents a 3D Gaussian primitive for splatting.
 * Each Gaussian has: position, covariance (scale + rotation), color (SH), opacity
 */

export class Gaussian {
  constructor(data = {}) {
    // Position (world space)
    this.position = data.position || [0, 0, 0];

    // Scale (log scale for optimization stability)
    this.scale = data.scale || [0.01, 0.01, 0.01];

    // Rotation (quaternion: w, x, y, z)
    this.rotation = data.rotation || [1, 0, 0, 0];

    // Color (RGB, can extend to spherical harmonics)
    this.color = data.color || [0.5, 0.5, 0.5];

    // Opacity (0-1)
    this.opacity = data.opacity ?? 1.0;
  }

  /**
   * Compute 3x3 covariance matrix from scale and rotation
   */
  getCovariance() {
    const [sx, sy, sz] = this.scale;
    const [w, x, y, z] = this.rotation;

    // Rotation matrix from quaternion
    const R = [
      [1 - 2*(y*y + z*z), 2*(x*y - w*z), 2*(x*z + w*y)],
      [2*(x*y + w*z), 1 - 2*(x*x + z*z), 2*(y*z - w*x)],
      [2*(x*z - w*y), 2*(y*z + w*x), 1 - 2*(x*x + y*y)]
    ];

    // Scale matrix
    const S = [[sx*sx, 0, 0], [0, sy*sy, 0], [0, 0, sz*sz]];

    // Covariance = R * S * R^T
    const RS = this.matMul(R, S);
    const RT = this.transpose(R);
    return this.matMul(RS, RT);
  }

  /**
   * Get 2D covariance for screen-space splatting
   */
  getScreenCovariance(viewMatrix, projMatrix, screenWidth, screenHeight) {
    const cov3D = this.getCovariance();

    // Transform to view space
    const viewRot = this.extractRotation(viewMatrix);
    const cov3DView = this.matMul(this.matMul(viewRot, cov3D), this.transpose(viewRot));

    // Project to 2D (using Jacobian of perspective projection)
    const posView = this.transformPoint(this.position, viewMatrix);
    const focalX = projMatrix[0] * screenWidth / 2;
    const focalY = projMatrix[5] * screenHeight / 2;

    const z = posView[2];
    const z2 = z * z;

    const J = [
      [focalX / z, 0, -focalX * posView[0] / z2],
      [0, focalY / z, -focalY * posView[1] / z2]
    ];

    // 2D covariance = J * cov3D * J^T
    const JCov = this.matMul2x3(J, cov3DView);
    const JT = [[J[0][0], J[1][0]], [J[0][1], J[1][1]], [J[0][2], J[1][2]]];
    const cov2D = this.matMul2x3x2(JCov, JT);

    return cov2D;
  }

  // Matrix utilities
  matMul(A, B) {
    const result = [[0,0,0], [0,0,0], [0,0,0]];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 3; k++) {
          result[i][j] += A[i][k] * B[k][j];
        }
      }
    }
    return result;
  }

  matMul2x3(A, B) {
    // A is 2x3, B is 3x3, result is 2x3
    const result = [[0,0,0], [0,0,0]];
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 3; k++) {
          result[i][j] += A[i][k] * B[k][j];
        }
      }
    }
    return result;
  }

  matMul2x3x2(A, B) {
    // A is 2x3, B is 3x2, result is 2x2
    const result = [[0,0], [0,0]];
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 3; k++) {
          result[i][j] += A[i][k] * B[k][j];
        }
      }
    }
    return result;
  }

  transpose(M) {
    return [
      [M[0][0], M[1][0], M[2][0]],
      [M[0][1], M[1][1], M[2][1]],
      [M[0][2], M[1][2], M[2][2]]
    ];
  }

  extractRotation(mat4) {
    // Extract 3x3 rotation from 4x4 matrix (column-major)
    return [
      [mat4[0], mat4[4], mat4[8]],
      [mat4[1], mat4[5], mat4[9]],
      [mat4[2], mat4[6], mat4[10]]
    ];
  }

  transformPoint(p, mat4) {
    const x = mat4[0]*p[0] + mat4[4]*p[1] + mat4[8]*p[2] + mat4[12];
    const y = mat4[1]*p[0] + mat4[5]*p[1] + mat4[9]*p[2] + mat4[13];
    const z = mat4[2]*p[0] + mat4[6]*p[1] + mat4[10]*p[2] + mat4[14];
    return [x, y, z];
  }

  /**
   * Serialize to flat array for GPU upload
   */
  toArray() {
    return [
      ...this.position,           // 3 floats
      ...this.scale,              // 3 floats
      ...this.rotation,           // 4 floats
      ...this.color,              // 3 floats
      this.opacity                // 1 float
    ];                            // Total: 14 floats
  }

  /**
   * Create from flat array
   */
  static fromArray(arr, offset = 0) {
    return new Gaussian({
      position: [arr[offset], arr[offset + 1], arr[offset + 2]],
      scale: [arr[offset + 3], arr[offset + 4], arr[offset + 5]],
      rotation: [arr[offset + 6], arr[offset + 7], arr[offset + 8], arr[offset + 9]],
      color: [arr[offset + 10], arr[offset + 11], arr[offset + 12]],
      opacity: arr[offset + 13]
    });
  }
}

/**
 * Collection of Gaussians forming a splat "template"
 */
export class GaussianCloud {
  /**
   * @param {number} [count] - Optional count to pre-allocate Gaussians
   */
  constructor(count) {
    this.gaussians = [];
    this.bounds = null;

    // Pre-allocate if count provided
    if (count && count > 0) {
      for (let i = 0; i < count; i++) {
        this.gaussians.push(new Gaussian());
      }
    }
  }

  add(gaussian) {
    this.gaussians.push(gaussian);
    this.bounds = null;  // Invalidate bounds cache
  }

  /**
   * Set Gaussian at specific index (for pre-allocated clouds)
   * @param {number} index - Index to set
   * @param {Object} data - Gaussian data {position, scale, rotation, color, opacity}
   */
  setGaussian(index, data) {
    if (index < 0 || index >= this.gaussians.length) {
      throw new Error(`Index ${index} out of bounds (0-${this.gaussians.length - 1})`);
    }

    const g = this.gaussians[index];
    if (data.position) g.position = data.position;
    if (data.scale) g.scale = data.scale;
    if (data.rotation) g.rotation = data.rotation;
    if (data.color) g.color = data.color;
    if (data.opacity !== undefined) g.opacity = data.opacity;

    this.bounds = null;  // Invalidate bounds cache
  }

  get count() {
    return this.gaussians.length;
  }

  /**
   * Compute axis-aligned bounding box
   */
  getBounds() {
    if (this.bounds) return this.bounds;

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];

    for (const g of this.gaussians) {
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], g.position[i] - g.scale[i] * 3);
        max[i] = Math.max(max[i], g.position[i] + g.scale[i] * 3);
      }
    }

    this.bounds = { min, max };
    return this.bounds;
  }

  /**
   * Serialize all gaussians to Float32Array for GPU
   */
  toFloat32Array() {
    const floatsPerGaussian = 14;
    const data = new Float32Array(this.gaussians.length * floatsPerGaussian);

    for (let i = 0; i < this.gaussians.length; i++) {
      const arr = this.gaussians[i].toArray();
      data.set(arr, i * floatsPerGaussian);
    }

    return data;
  }

  /**
   * Create from Float32Array
   */
  static fromFloat32Array(data) {
    const cloud = new GaussianCloud();
    const floatsPerGaussian = 14;
    const count = data.length / floatsPerGaussian;

    for (let i = 0; i < count; i++) {
      cloud.add(Gaussian.fromArray(data, i * floatsPerGaussian));
    }

    return cloud;
  }

  /**
   * Initialize from point cloud (one Gaussian per point)
   */
  static fromPointCloud(pointCloud, options = {}) {
    const cloud = new GaussianCloud();
    const initialScale = options.initialScale || 0.02;
    const { positions, normals, colors, count } = pointCloud;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;

      // Create Gaussian at point position
      const gaussian = new Gaussian({
        position: [positions[idx], positions[idx + 1], positions[idx + 2]],
        scale: [initialScale, initialScale, initialScale],
        rotation: [1, 0, 0, 0],  // Identity quaternion
        color: colors ? [colors[idx], colors[idx + 1], colors[idx + 2]] : [0.8, 0.8, 0.8],
        opacity: 1.0
      });

      // Orient scale along normal if available
      if (normals) {
        // TODO: Compute rotation to align with normal
        // For now, use isotropic Gaussians
      }

      cloud.add(gaussian);
    }

    return cloud;
  }

  /**
   * Export to PLY format (compatible with standard splat viewers)
   */
  toPLY() {
    const header = `ply
format binary_little_endian 1.0
element vertex ${this.count}
property float x
property float y
property float z
property float nx
property float ny
property float nz
property float f_dc_0
property float f_dc_1
property float f_dc_2
property float opacity
property float scale_0
property float scale_1
property float scale_2
property float rot_0
property float rot_1
property float rot_2
property float rot_3
end_header
`;

    // Binary data: 17 floats per Gaussian
    const buffer = new ArrayBuffer(this.count * 17 * 4);
    const view = new DataView(buffer);

    for (let i = 0; i < this.count; i++) {
      const g = this.gaussians[i];
      const offset = i * 17 * 4;

      // Position
      view.setFloat32(offset + 0, g.position[0], true);
      view.setFloat32(offset + 4, g.position[1], true);
      view.setFloat32(offset + 8, g.position[2], true);

      // Normal (placeholder - compute from neighbors if needed)
      view.setFloat32(offset + 12, 0, true);
      view.setFloat32(offset + 16, 1, true);
      view.setFloat32(offset + 20, 0, true);

      // Color (DC component of spherical harmonics)
      view.setFloat32(offset + 24, g.color[0], true);
      view.setFloat32(offset + 28, g.color[1], true);
      view.setFloat32(offset + 32, g.color[2], true);

      // Opacity
      view.setFloat32(offset + 36, g.opacity, true);

      // Scale (log scale)
      view.setFloat32(offset + 40, Math.log(g.scale[0]), true);
      view.setFloat32(offset + 44, Math.log(g.scale[1]), true);
      view.setFloat32(offset + 48, Math.log(g.scale[2]), true);

      // Rotation quaternion
      view.setFloat32(offset + 52, g.rotation[0], true);
      view.setFloat32(offset + 56, g.rotation[1], true);
      view.setFloat32(offset + 60, g.rotation[2], true);
      view.setFloat32(offset + 64, g.rotation[3], true);
    }

    // Combine header and binary data
    const headerBytes = new TextEncoder().encode(header);
    const result = new Uint8Array(headerBytes.length + buffer.byteLength);
    result.set(headerBytes, 0);
    result.set(new Uint8Array(buffer), headerBytes.length);

    return result;
  }
}

export default { Gaussian, GaussianCloud };
