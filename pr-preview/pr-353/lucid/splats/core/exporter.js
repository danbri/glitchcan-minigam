/**
 * 3DGS Export Utilities
 *
 * Exports Gaussian splat data to standard formats compatible with:
 * - INRIA 3DGS viewer (original paper implementation)
 * - Luma AI
 * - Polycam
 * - SuperSplat
 * - Other standard 3DGS viewers
 */

/**
 * Export to standard PLY format (binary little-endian)
 * This is the format used by the original 3DGS paper and most viewers
 *
 * @param {Object} data - Splat data with positions, scales, rotations, colors, opacities
 * @param {Object} options - Export options
 * @returns {Uint8Array} - Binary PLY file data
 */
export function exportToPLY(data, options = {}) {
  const {
    positions,    // Float32Array, 3 per splat
    scales,       // Float32Array, 3 per splat (anisotropic)
    rotations,    // Float32Array, 4 per splat (quaternion x,y,z,w)
    colors,       // Float32Array, 3 per splat (RGB 0-1)
    opacities,    // Float32Array or number, 1 per splat (0-1)
    count
  } = data;

  const shDegree = options.shDegree || 0;  // 0 = DC only, 3 = full SH
  const includeNormals = options.includeNormals !== false;

  // Calculate SH coefficient count: (degree+1)² total, minus 3 for DC
  const shCoeffsPerChannel = shDegree > 0 ? (shDegree + 1) * (shDegree + 1) - 1 : 0;
  const totalSHCoeffs = shCoeffsPerChannel * 3;  // RGB channels

  // Build PLY header
  const properties = [
    'property float x',
    'property float y',
    'property float z'
  ];

  if (includeNormals) {
    properties.push(
      'property float nx',
      'property float ny',
      'property float nz'
    );
  }

  // DC color components (spherical harmonics degree 0)
  properties.push(
    'property float f_dc_0',
    'property float f_dc_1',
    'property float f_dc_2'
  );

  // Higher order SH coefficients (if any)
  for (let i = 0; i < totalSHCoeffs; i++) {
    properties.push(`property float f_rest_${i}`);
  }

  properties.push(
    'property float opacity',
    'property float scale_0',
    'property float scale_1',
    'property float scale_2',
    'property float rot_0',
    'property float rot_1',
    'property float rot_2',
    'property float rot_3'
  );

  const header = `ply
format binary_little_endian 1.0
element vertex ${count}
${properties.join('\n')}
end_header
`;

  // Calculate bytes per vertex
  let floatsPerVertex = 3;  // position
  if (includeNormals) floatsPerVertex += 3;
  floatsPerVertex += 3;  // DC color
  floatsPerVertex += totalSHCoeffs;  // SH rest
  floatsPerVertex += 1;  // opacity
  floatsPerVertex += 3;  // scale
  floatsPerVertex += 4;  // rotation

  const bytesPerVertex = floatsPerVertex * 4;
  const headerBytes = new TextEncoder().encode(header);
  const dataBytes = count * bytesPerVertex;
  const totalBytes = headerBytes.length + dataBytes;

  const result = new Uint8Array(totalBytes);
  result.set(headerBytes, 0);

  const dataView = new DataView(result.buffer, headerBytes.length);
  let offset = 0;

  for (let i = 0; i < count; i++) {
    // Position (x, y, z)
    dataView.setFloat32(offset, positions[i * 3], true); offset += 4;
    dataView.setFloat32(offset, positions[i * 3 + 1], true); offset += 4;
    dataView.setFloat32(offset, positions[i * 3 + 2], true); offset += 4;

    // Normals (placeholder if not provided)
    if (includeNormals) {
      dataView.setFloat32(offset, 0, true); offset += 4;
      dataView.setFloat32(offset, 1, true); offset += 4;
      dataView.setFloat32(offset, 0, true); offset += 4;
    }

    // DC color (convert RGB to SH DC coefficient)
    // SH DC coefficient = (color - 0.5) / C0 where C0 = 0.28209479177387814
    const C0 = 0.28209479177387814;
    const r = colors ? colors[i * 3] : 0.5;
    const g = colors ? colors[i * 3 + 1] : 0.5;
    const b = colors ? colors[i * 3 + 2] : 0.5;

    dataView.setFloat32(offset, (r - 0.5) / C0, true); offset += 4;
    dataView.setFloat32(offset, (g - 0.5) / C0, true); offset += 4;
    dataView.setFloat32(offset, (b - 0.5) / C0, true); offset += 4;

    // Higher order SH (zeros for now)
    for (let j = 0; j < totalSHCoeffs; j++) {
      dataView.setFloat32(offset, 0, true); offset += 4;
    }

    // Opacity (logit transform: log(o / (1 - o)))
    const opacity = typeof opacities === 'number' ? opacities :
                    (opacities ? opacities[i] : 0.95);
    const clampedOpacity = Math.max(0.001, Math.min(0.999, opacity));
    const logitOpacity = Math.log(clampedOpacity / (1 - clampedOpacity));
    dataView.setFloat32(offset, logitOpacity, true); offset += 4;

    // Scale (log transform)
    const sx = scales ? scales[i * 3] : 0.01;
    const sy = scales ? scales[i * 3 + 1] : 0.01;
    const sz = scales ? scales[i * 3 + 2] : 0.01;
    dataView.setFloat32(offset, Math.log(Math.max(sx, 1e-7)), true); offset += 4;
    dataView.setFloat32(offset, Math.log(Math.max(sy, 1e-7)), true); offset += 4;
    dataView.setFloat32(offset, Math.log(Math.max(sz, 1e-7)), true); offset += 4;

    // Rotation quaternion (stored as w, x, y, z in most viewers)
    // Our internal format is x, y, z, w so we need to reorder
    const qx = rotations ? rotations[i * 4] : 0;
    const qy = rotations ? rotations[i * 4 + 1] : 0;
    const qz = rotations ? rotations[i * 4 + 2] : 0;
    const qw = rotations ? rotations[i * 4 + 3] : 1;

    // Normalize quaternion
    const qlen = Math.sqrt(qx*qx + qy*qy + qz*qz + qw*qw);
    dataView.setFloat32(offset, qw / qlen, true); offset += 4;  // rot_0 = w
    dataView.setFloat32(offset, qx / qlen, true); offset += 4;  // rot_1 = x
    dataView.setFloat32(offset, qy / qlen, true); offset += 4;  // rot_2 = y
    dataView.setFloat32(offset, qz / qlen, true); offset += 4;  // rot_3 = z
  }

  return result;
}

/**
 * Export to compressed .splat format (used by some web viewers)
 * More compact than PLY, no SH support
 *
 * Format per splat (32 bytes):
 * - position: 3 x float32 (12 bytes)
 * - scale: 3 x float16 (6 bytes)
 * - color: 4 x uint8 RGBA (4 bytes)
 * - rotation: 4 x int8 normalized (4 bytes)
 * - padding: 6 bytes
 *
 * @param {Object} data - Splat data
 * @returns {Uint8Array} - Binary .splat file data
 */
export function exportToSplat(data, options = {}) {
  const { positions, scales, rotations, colors, opacities, count } = data;

  const bytesPerSplat = 32;
  const result = new Uint8Array(count * bytesPerSplat);
  const dataView = new DataView(result.buffer);

  for (let i = 0; i < count; i++) {
    const offset = i * bytesPerSplat;

    // Position (3 x float32)
    dataView.setFloat32(offset, positions[i * 3], true);
    dataView.setFloat32(offset + 4, positions[i * 3 + 1], true);
    dataView.setFloat32(offset + 8, positions[i * 3 + 2], true);

    // Scale (3 x float16) - use log scale
    const sx = scales ? Math.log(Math.max(scales[i * 3], 1e-7)) : -4;
    const sy = scales ? Math.log(Math.max(scales[i * 3 + 1], 1e-7)) : -4;
    const sz = scales ? Math.log(Math.max(scales[i * 3 + 2], 1e-7)) : -4;
    dataView.setUint16(offset + 12, floatToHalf(sx), true);
    dataView.setUint16(offset + 14, floatToHalf(sy), true);
    dataView.setUint16(offset + 16, floatToHalf(sz), true);

    // Color (RGBA uint8)
    const r = colors ? Math.round(colors[i * 3] * 255) : 128;
    const g = colors ? Math.round(colors[i * 3 + 1] * 255) : 128;
    const b = colors ? Math.round(colors[i * 3 + 2] * 255) : 128;
    const opacity = typeof opacities === 'number' ? opacities :
                    (opacities ? opacities[i] : 0.95);
    const a = Math.round(opacity * 255);

    result[offset + 18] = r;
    result[offset + 19] = g;
    result[offset + 20] = b;
    result[offset + 21] = a;

    // Rotation (4 x int8 normalized) - scale to -128..127
    const qx = rotations ? rotations[i * 4] : 0;
    const qy = rotations ? rotations[i * 4 + 1] : 0;
    const qz = rotations ? rotations[i * 4 + 2] : 0;
    const qw = rotations ? rotations[i * 4 + 3] : 1;

    const qlen = Math.sqrt(qx*qx + qy*qy + qz*qz + qw*qw);
    result[offset + 22] = Math.round((qw / qlen) * 127);
    result[offset + 23] = Math.round((qx / qlen) * 127);
    result[offset + 24] = Math.round((qy / qlen) * 127);
    result[offset + 25] = Math.round((qz / qlen) * 127);

    // Padding (6 bytes)
    // bytes 26-31 are zeros
  }

  return result;
}

/**
 * Convert float32 to float16 (half precision)
 */
function floatToHalf(value) {
  const floatView = new Float32Array(1);
  const int32View = new Int32Array(floatView.buffer);

  floatView[0] = value;
  const x = int32View[0];

  const sign = (x >> 31) & 0x0001;
  let exp = (x >> 23) & 0x00ff;
  let frac = x & 0x007fffff;

  if (exp === 0) {
    // Zero or denormalized
    return sign << 15;
  } else if (exp === 0xff) {
    // Inf or NaN
    return (sign << 15) | 0x7c00 | (frac ? 0x0200 : 0);
  }

  // Normalized
  exp = exp - 127 + 15;

  if (exp >= 31) {
    // Overflow to infinity
    return (sign << 15) | 0x7c00;
  } else if (exp <= 0) {
    // Underflow to zero
    return sign << 15;
  }

  return (sign << 15) | (exp << 10) | (frac >> 13);
}

/**
 * Create a downloadable blob URL for the exported data
 */
export function createDownloadURL(data, mimeType = 'application/octet-stream') {
  const blob = new Blob([data], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Trigger download of exported file
 */
export function downloadFile(data, filename, mimeType = 'application/octet-stream') {
  const url = createDownloadURL(data, mimeType);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * High-level export function that handles GaussianCloud or raw data
 */
export function exportGaussians(source, format = 'ply', options = {}) {
  let data;

  // Handle GaussianCloud objects
  if (source.gaussians) {
    const gaussians = source.gaussians;
    const count = gaussians.length;

    data = {
      positions: new Float32Array(count * 3),
      scales: new Float32Array(count * 3),
      rotations: new Float32Array(count * 4),
      colors: new Float32Array(count * 3),
      opacities: new Float32Array(count),
      count
    };

    for (let i = 0; i < count; i++) {
      const g = gaussians[i];
      data.positions[i * 3] = g.position[0];
      data.positions[i * 3 + 1] = g.position[1];
      data.positions[i * 3 + 2] = g.position[2];
      data.scales[i * 3] = g.scale[0];
      data.scales[i * 3 + 1] = g.scale[1];
      data.scales[i * 3 + 2] = g.scale[2];
      data.rotations[i * 4] = g.rotation[0];
      data.rotations[i * 4 + 1] = g.rotation[1];
      data.rotations[i * 4 + 2] = g.rotation[2];
      data.rotations[i * 4 + 3] = g.rotation[3];
      data.colors[i * 3] = g.color[0];
      data.colors[i * 3 + 1] = g.color[1];
      data.colors[i * 3 + 2] = g.color[2];
      data.opacities[i] = g.opacity;
    }
  } else {
    data = source;
  }

  switch (format.toLowerCase()) {
    case 'ply':
      return exportToPLY(data, options);
    case 'splat':
      return exportToSplat(data, options);
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

export default {
  exportToPLY,
  exportToSplat,
  exportGaussians,
  downloadFile,
  createDownloadURL
};
