/**
 * Instanced Splat Bundle
 *
 * Handles creation, loading, and saving of .isplat bundles.
 * A bundle contains:
 * - manifest.json: Metadata, template list, instance list
 * - templates/*.ply: Gaussian splat data for each template
 */

import { GaussianCloud } from './gaussian.js';

export class SplatBundle {
  constructor() {
    this.manifest = {
      version: '1.0',
      scene: {
        title: 'Untitled',
        bounds: { min: [-5, -5, -5], max: [5, 5, 5] }
      },
      templates: {},
      instances: []
    };

    this.templateClouds = new Map();  // templateId -> GaussianCloud
  }

  /**
   * Set scene metadata
   */
  setSceneInfo(info) {
    Object.assign(this.manifest.scene, info);
  }

  /**
   * Add a template
   */
  addTemplate(id, cloud, metadata = {}) {
    this.templateClouds.set(id, cloud);

    const bounds = cloud.getBounds();
    this.manifest.templates[id] = {
      file: `templates/${id}.ply`,
      splatCount: cloud.count,
      bounds: bounds,
      origin: metadata.origin || [0, 0, 0],
      ...metadata
    };
  }

  /**
   * Add an instance
   */
  addInstance(instanceData) {
    this.manifest.instances.push({
      template: instanceData.templateId,
      id: instanceData.id,
      transform: instanceData.transform,
      color: instanceData.color,
      visible: instanceData.visible !== false,
      animation: instanceData.animation || undefined
    });
  }

  /**
   * Get template cloud
   */
  getTemplate(id) {
    return this.templateClouds.get(id);
  }

  /**
   * Get all instances
   */
  getInstances() {
    return this.manifest.instances;
  }

  /**
   * Export bundle as ZIP (returns Uint8Array)
   * For MVP, returns a JSON bundle instead of ZIP
   */
  async exportBundle() {
    // For MVP without zip library, export as single JSON with embedded data
    const bundle = {
      manifest: this.manifest,
      templates: {}
    };

    for (const [id, cloud] of this.templateClouds) {
      // Export cloud as base64-encoded float array
      const data = cloud.toFloat32Array();
      const bytes = new Uint8Array(data.buffer);
      bundle.templates[id] = {
        count: cloud.count,
        data: this.arrayToBase64(bytes)
      };
    }

    return JSON.stringify(bundle, null, 2);
  }

  /**
   * Import bundle from JSON
   */
  static async fromJSON(jsonString) {
    const data = JSON.parse(jsonString);
    const bundle = new SplatBundle();

    bundle.manifest = data.manifest;

    for (const [id, templateData] of Object.entries(data.templates)) {
      const bytes = SplatBundle.base64ToArray(templateData.data);
      const floats = new Float32Array(bytes.buffer);
      const cloud = GaussianCloud.fromFloat32Array(floats);
      bundle.templateClouds.set(id, cloud);
    }

    return bundle;
  }

  /**
   * Export to downloadable file
   */
  async download(filename = 'scene.isplat.json') {
    const data = await this.exportBundle();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Export flattened PLY (all instances baked into single splat cloud)
   */
  exportFlattenedPLY() {
    const allGaussians = [];

    for (const instance of this.manifest.instances) {
      if (!instance.visible) continue;

      const cloud = this.templateClouds.get(instance.template);
      if (!cloud) continue;

      const matrix = this.buildMatrix(instance.transform);
      const colorTint = instance.color || [1, 1, 1, 1];

      for (const g of cloud.gaussians) {
        // Transform position
        const pos = this.transformPoint(g.position, matrix);

        // Apply scale from instance
        const instanceScale = instance.transform.scale || [1, 1, 1];
        const scale = g.scale.map((s, i) =>
          s * (typeof instanceScale[i] === 'number' ? instanceScale[i] : instanceScale[0] || 1)
        );

        // Tint color
        const color = g.color.map((c, i) => c * (colorTint[i] || 1));

        allGaussians.push({
          position: pos,
          scale: scale,
          rotation: g.rotation,  // TODO: combine rotations
          color: color,
          opacity: g.opacity * (colorTint[3] || 1)
        });
      }
    }

    // Create combined cloud
    const combined = new GaussianCloud();
    for (const data of allGaussians) {
      combined.add(new (combined.gaussians[0]?.constructor || Object.getPrototypeOf({}))({
        ...data
      }));
    }

    // Actually we need to import Gaussian here
    // For now, just return the raw data
    return {
      count: allGaussians.length,
      data: allGaussians
    };
  }

  buildMatrix(transform) {
    const t = transform.translate || [0, 0, 0];
    const r = transform.rotate || [0, 0, 0];
    const s = transform.scale || [1, 1, 1];

    // Simplified: just translation for MVP
    return {
      translate: t.map(v => typeof v === 'number' ? v : 0),
      rotate: r.map(v => typeof v === 'number' ? v : 0),
      scale: Array.isArray(s) ? s.map(v => typeof v === 'number' ? v : 1) : [s, s, s]
    };
  }

  transformPoint(p, matrix) {
    // Simplified transform: just translation
    const t = matrix.translate;
    return [p[0] + t[0], p[1] + t[1], p[2] + t[2]];
  }

  arrayToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  static base64ToArray(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

export default SplatBundle;
