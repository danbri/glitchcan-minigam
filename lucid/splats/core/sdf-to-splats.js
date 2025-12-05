/**
 * SDF to 3D Gaussian Splats Generator
 *
 * Converts SDF functions to true 3DGS format with:
 * - Covariance matrices (not just surfels)
 * - Principal curvature analysis for anisotropic scaling
 * - PLY export compatible with Luma/Polycam/INRIA viewers
 *
 * Based on Gemini's implementation.
 */

import * as THREE from 'three';

/**
 * ------------------------------------------------------------------
 * PART 1: THE GEOMETRY ENGINE
 * Samples the SDF and computes 3DGS attributes (Covariance/Harmonics)
 * ------------------------------------------------------------------
 */
export class SDFGaussianSampler {
  constructor(options = {}) {
    this.resolution = options.resolution || 64;
    this.bounds = options.bounds || { min: [-2, -2, -2], max: [2, 2, 2] };
    this.threshold = options.threshold || 0.001;

    // Config for finite difference (gradient/curvature)
    this.epsilon = 0.001;

    // Diagonal of a voxel (for robust surface detection)
    const step = (this.bounds.max[0] - this.bounds.min[0]) / this.resolution;
    this.voxelDiagonal = step * 1.732; // sqrt(3)
  }

  /**
   * Main pipeline: SDF -> Points -> Covariance -> Splat Data
   */
  generate(sdfFunc) {
    console.time("SDF Sampling");
    const surfacePoints = this._sampleGrid(sdfFunc);
    console.timeEnd("SDF Sampling");

    console.time("Covariance Computation");
    const splats = this._computeCovariance(sdfFunc, surfacePoints);
    console.timeEnd("Covariance Computation");

    return splats;
  }

  // 1. Robust Grid Sampling (Prevent Tunneling & Duplicates)
  _sampleGrid(sdfFunc) {
    const points = [];
    const processed = new Set();
    const { min, max } = this.bounds;

    const stepX = (max[0] - min[0]) / this.resolution;
    const stepY = (max[1] - min[1]) / this.resolution;
    const stepZ = (max[2] - min[2]) / this.resolution;

    // Quantization key for deduplication
    const quantize = (v) => Math.floor(v / (this.threshold * 0.5));

    for (let x = min[0]; x < max[0]; x += stepX) {
      for (let y = min[1]; y < max[1]; y += stepY) {
        for (let z = min[2]; z < max[2]; z += stepZ) {

          // Center of voxel
          const cx = x + stepX * 0.5;
          const cy = y + stepY * 0.5;
          const cz = z + stepZ * 0.5;

          const dist = sdfFunc(cx, cy, cz).distance;

          // Conservative check: if distance < diagonal, surface *might* be here
          if (Math.abs(dist) < this.voxelDiagonal) {
            const refined = this._newtonRefine(sdfFunc, cx, cy, cz);

            if (refined) {
              const key = `${quantize(refined.x)},${quantize(refined.y)},${quantize(refined.z)}`;
              if (!processed.has(key)) {
                processed.add(key);
                points.push(refined);
              }
            }
          }
        }
      }
    }
    return points;
  }

  // 2. Relaxed Newton Descent (Fixes Numerical Instability)
  _newtonRefine(sdfFunc, x, y, z, iter = 5) {
    let p = { x, y, z };
    for (let i = 0; i < iter; i++) {
      const res = sdfFunc(p.x, p.y, p.z);
      if (Math.abs(res.distance) < this.threshold) return p;

      const grad = this._estimateNormal(sdfFunc, p.x, p.y, p.z);

      // Relaxation factor 0.9 avoids overshooting on non-Euclidean SDFs
      p.x -= grad.x * res.distance * 0.9;
      p.y -= grad.y * res.distance * 0.9;
      p.z -= grad.z * res.distance * 0.9;
    }
    return null;
  }

  // 3. Central Difference Normal
  _estimateNormal(sdfFunc, x, y, z) {
    const e = this.epsilon;
    const dx = sdfFunc(x + e, y, z).distance - sdfFunc(x - e, y, z).distance;
    const dy = sdfFunc(x, y + e, z).distance - sdfFunc(x, y - e, z).distance;
    const dz = sdfFunc(x, y, z + e).distance - sdfFunc(x, y, z - e).distance;
    const v = new THREE.Vector3(dx, dy, dz).normalize();
    return v.lengthSq() === 0 ? new THREE.Vector3(0, 1, 0) : v;
  }

  // 4. The "True 3DGS" Logic: Curvature to Covariance
  _computeCovariance(sdfFunc, points) {
    const count = points.length;

    // Arrays for PLY export / InstancedMesh
    const positions = new Float32Array(count * 3);
    const rotations = new Float32Array(count * 4); // Quaternions
    const scales = new Float32Array(count * 3);    // Log scale
    const colors = new Float32Array(count * 3);    // RGB
    const normals = new Float32Array(count * 3);   // For PLY export

    points.forEach((p, i) => {
      const i3 = i * 3;
      const i4 = i * 4;

      // A. Position & Color
      positions[i3] = p.x;
      positions[i3+1] = p.y;
      positions[i3+2] = p.z;

      const sdfData = sdfFunc(p.x, p.y, p.z);
      colors[i3] = sdfData.color ? sdfData.color[0] : 0.8;
      colors[i3+1] = sdfData.color ? sdfData.color[1] : 0.8;
      colors[i3+2] = sdfData.color ? sdfData.color[2] : 0.8;

      // B. Analyze Curvature (Simplified Hessian)
      const n = this._estimateNormal(sdfFunc, p.x, p.y, p.z);

      // Store normal for PLY
      normals[i3] = n.x;
      normals[i3+1] = n.y;
      normals[i3+2] = n.z;

      // To find principal directions (curvature), we need a tangent basis
      // 1. Create arbitrary tangent
      let t1 = Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      t1.crossVectors(n, t1).normalize(); // Tangent 1
      const t2 = new THREE.Vector3().crossVectors(n, t1).normalize(); // Tangent 2

      // 2. Sample normals nearby to estimate how much surface bends
      const d = this.epsilon * 5;
      const n_t1 = this._estimateNormal(sdfFunc, p.x + t1.x*d, p.y + t1.y*d, p.z + t1.z*d);
      const n_t2 = this._estimateNormal(sdfFunc, p.x + t2.x*d, p.y + t2.y*d, p.z + t2.z*d);

      // Curvature approximation: |delta_normal| / distance
      const k1 = n.distanceTo(n_t1) / d; // Curvature along t1
      const k2 = n.distanceTo(n_t2) / d; // Curvature along t2

      // C. Calculate Scales (The Covariance Diagonal)
      // High curvature (corner) -> Small scale (tight fit)
      // Low curvature (flat) -> Large scale (splat)
      const baseScale = 0.05; // 5cm splat

      // Scale is inverse of curvature, clamped
      let s1 = Math.min(baseScale, Math.max(0.005, 0.1 / (k1 + 0.1)));
      let s2 = Math.min(baseScale, Math.max(0.005, 0.1 / (k2 + 0.1)));
      let s3 = 0.005; // Normal axis is always thin for a surface splat

      // D. Calculate Rotation (Align Local Frame to Tangents)
      // We construct a rotation matrix from basis [t1, t2, n]
      const rotMatrix = new THREE.Matrix4().makeBasis(t1, t2, n);
      const q = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);

      // Store
      rotations[i4] = q.x;
      rotations[i4+1] = q.y;
      rotations[i4+2] = q.z;
      rotations[i4+3] = q.w;

      scales[i3] = s1;
      scales[i3+1] = s2;
      scales[i3+2] = s3;
    });

    return { count, positions, rotations, scales, colors, normals };
  }
}

/**
 * ------------------------------------------------------------------
 * PART 2: THE EXPORTER
 * Converts our data to the binary .ply format for official 3DGS viewers
 * ------------------------------------------------------------------
 */
export class SplatExporter {
  /**
   * Export to binary PLY format compatible with:
   * - INRIA's original 3DGS viewer
   * - Luma AI
   * - Polycam
   * - gsplat.js
   */
  static exportToPly(data) {
    const { count, positions, normals, colors, scales, rotations } = data;

    // Standard 3DGS PLY Header
    const header = [
      'ply',
      'format binary_little_endian 1.0',
      `element vertex ${count}`,
      'property float x', 'property float y', 'property float z',
      'property float nx', 'property float ny', 'property float nz',
      'property float f_dc_0', 'property float f_dc_1', 'property float f_dc_2',
      'property float opacity',
      'property float scale_0', 'property float scale_1', 'property float scale_2',
      'property float rot_0', 'property float rot_1', 'property float rot_2', 'property float rot_3',
      'end_header',
      ''
    ].join('\n');

    const headerBlob = new TextEncoder().encode(header);
    // 17 floats per vertex: pos(3) + norm(3) + col(3) + op(1) + scale(3) + rot(4) = 68 bytes
    const rowSize = 17 * 4;
    const buffer = new ArrayBuffer(headerBlob.byteLength + count * rowSize);
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    // Write header
    u8.set(headerBlob, 0);
    let offset = headerBlob.byteLength;

    // Spherical Harmonics DC coefficient
    const C0 = 0.28209479177387814;

    for (let i = 0; i < count; i++) {
      // Position
      view.setFloat32(offset, positions[i*3], true);
      view.setFloat32(offset+4, positions[i*3+1], true);
      view.setFloat32(offset+8, positions[i*3+2], true);

      // Normal
      view.setFloat32(offset+12, normals ? normals[i*3] : 0, true);
      view.setFloat32(offset+16, normals ? normals[i*3+1] : 1, true);
      view.setFloat32(offset+20, normals ? normals[i*3+2] : 0, true);

      // Spherical Harmonics (DC) - encode RGB to SH
      // (Color - 0.5) / C0
      view.setFloat32(offset+24, (colors[i*3] - 0.5) / C0, true);
      view.setFloat32(offset+28, (colors[i*3+1] - 0.5) / C0, true);
      view.setFloat32(offset+32, (colors[i*3+2] - 0.5) / C0, true);

      // Opacity (Logit encoded) -> sigmoid(5.0) ≈ 0.99
      view.setFloat32(offset+36, 5.0, true);

      // Scale (Log encoded)
      view.setFloat32(offset+40, Math.log(scales[i*3]), true);
      view.setFloat32(offset+44, Math.log(scales[i*3+1]), true);
      view.setFloat32(offset+48, Math.log(scales[i*3+2]), true);

      // Rotation (Quaternion: w, x, y, z order for PLY)
      view.setFloat32(offset+52, rotations[i*4+3], true); // W
      view.setFloat32(offset+56, rotations[i*4], true);   // X
      view.setFloat32(offset+60, rotations[i*4+1], true); // Y
      view.setFloat32(offset+64, rotations[i*4+2], true); // Z

      offset += rowSize;
    }

    return new Blob([buffer], { type: 'application/octet-stream' });
  }

  /**
   * Trigger download of PLY file
   */
  static download(data, filename = 'splats.ply') {
    const blob = this.exportToPly(data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

/**
 * ------------------------------------------------------------------
 * PART 3: THE VIEWER SHADER (THREE.js)
 * A high-fidelity "Fake" 3DGS shader for Three.js InstancedMesh
 * ------------------------------------------------------------------
 */
export function createSplatMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vColor;
      attribute vec3 instanceColor;

      void main() {
        vUv = uv;
        vColor = instanceColor;

        // The mesh is an InstancedMesh, so 'position' is local quad
        // instanceMatrix contains the Rotation (Covariance orientation)
        // and Position handled by Three.js automatically.

        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vColor;

      void main() {
        // 1. Gaussian Falloff
        // Calculate distance from center of quad (0.5, 0.5)
        vec2 d = vUv - 0.5;
        float distSq = dot(d, d);

        // e^(-x^2) shape.
        // 9.0 factor ensures the bell curve tapers to near-zero at quad edges
        float alpha = exp(-distSq * 9.0);

        // 2. Soft clipping
        if (alpha < 0.05) discard;

        // 3. Output
        gl_FragColor = vec4(vColor, alpha);
      }
    `
  });
}

/**
 * Helper to create a THREE.js InstancedMesh from splat data
 */
export function createSplatMesh(data, scene) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = createSplatMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, data.count);

  const tempObj = new THREE.Object3D();

  for (let i = 0; i < data.count; i++) {
    tempObj.position.set(
      data.positions[i*3],
      data.positions[i*3+1],
      data.positions[i*3+2]
    );
    tempObj.quaternion.set(
      data.rotations[i*4],
      data.rotations[i*4+1],
      data.rotations[i*4+2],
      data.rotations[i*4+3]
    );
    tempObj.scale.set(
      data.scales[i*3],
      data.scales[i*3+1],
      data.scales[i*3+2]
    );
    tempObj.updateMatrix();

    mesh.setMatrixAt(i, tempObj.matrix);
    mesh.setColorAt(i, new THREE.Color(
      data.colors[i*3],
      data.colors[i*3+1],
      data.colors[i*3+2]
    ));
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  if (scene) scene.add(mesh);

  return mesh;
}

export default {
  SDFGaussianSampler,
  SplatExporter,
  createSplatMaterial,
  createSplatMesh
};
