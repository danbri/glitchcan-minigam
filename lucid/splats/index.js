/**
 * Instanced Gaussian Splats - Main Entry Point
 *
 * High-level API for converting Lucid SDF scenes to instanced splat bundles
 * and rendering them.
 */

import { SDFSampler } from './core/sdf-sampler.js';
import { FixedSDFSampler } from './core/fixed-sdf-sampler.js';
import { Gaussian, GaussianCloud } from './core/gaussian.js';
import { TemplateExtractor } from './core/template-extractor.js';
import { SplatBundle } from './core/bundle.js';
import { QuickTrainer } from './training/trainer.js';
import { InstancedSplatRenderer } from './render/renderer.js';
import { GPUSampler } from './core/gpu-sampler.js';

export { SDFSampler, FixedSDFSampler, GPUSampler, Gaussian, GaussianCloud, TemplateExtractor, SplatBundle, QuickTrainer, InstancedSplatRenderer };

/**
 * Main conversion pipeline: Lucid scene -> Instanced splat bundle
 */
export class LucidToSplats {
  constructor(options = {}) {
    this.options = {
      samplerResolution: options.samplerResolution || 64,
      trainerIterations: options.trainerIterations || 100,
      targetSplatsPerTemplate: options.targetSplatsPerTemplate || 2000,
      splatScaleMultiplier: options.splatScaleMultiplier || 1.5,
      ...options
    };

    this.onProgress = options.onProgress || (() => {});
  }

  /**
   * Convert a Lucid scene JSON to an instanced splat bundle
   * @param {Object} sceneJson - Lucid scene JSON
   * @param {Function} sdfEvaluator - Function to evaluate SDF for a template node
   * @returns {Promise<SplatBundle>}
   */
  async convert(sceneJson, sdfEvaluator) {
    this.onProgress({ stage: 'extracting', progress: 0 });

    // Step 1: Extract templates and instances
    const extractor = new TemplateExtractor(sceneJson);
    const { templates, instances } = extractor.extract();

    console.log(`Extracted ${templates.size} templates and ${instances.length} instances`);

    // Step 2: Create bundle
    const bundle = new SplatBundle();
    bundle.setSceneInfo({
      title: sceneJson.title || 'Untitled',
      bounds: this.computeSceneBounds(instances, extractor)
    });

    // Step 3: Convert each template to splats
    const templateIds = Array.from(templates.keys());
    for (let i = 0; i < templateIds.length; i++) {
      const templateId = templateIds[i];
      const templateDef = templates.get(templateId);

      this.onProgress({
        stage: 'converting',
        template: templateId,
        progress: (i / templateIds.length) * 100
      });

      console.log(`Converting template: ${templateId}`);

      try {
        // Get bounds for this template
        const bounds = extractor.getTemplateBounds(templateId);

        // Estimate appropriate base scale from bounds
        const boundsSize = Math.max(
          bounds.max[0] - bounds.min[0],
          bounds.max[1] - bounds.min[1],
          bounds.max[2] - bounds.min[2]
        );
        const baseScale = boundsSize / (this.options.samplerResolution * 0.5);

        // Sample SDF to point cloud with curvature for anisotropic splats
        const sampler = new SDFSampler({
          resolution: this.options.samplerResolution,
          bounds: bounds,
          curvatureDelta: baseScale * 0.5  // Scale curvature sampling appropriately
        });

        // Create SDF function for this template
        const sdfFunc = (x, y, z) => sdfEvaluator(templateDef, x, y, z);
        const pointCloud = sampler.sampleRayMarch(sdfFunc, {
          numRays: this.options.samplerResolution * this.options.samplerResolution * 10,
          computeCurvature: true,  // Enable anisotropic splats
          baseScale: baseScale
        });

        if (pointCloud.count === 0) {
          console.warn(`No points sampled for template ${templateId}`);
          continue;
        }

        console.log(`Sampled ${pointCloud.count} points for ${templateId}`);

        // Train Gaussians
        const trainer = new QuickTrainer({
          targetCount: this.options.targetSplatsPerTemplate,
          scaleMultiplier: this.options.splatScaleMultiplier
        });

        const cloud = await trainer.train(pointCloud);
        console.log(`Trained ${cloud.count} Gaussians for ${templateId}`);

        // Add to bundle
        bundle.addTemplate(templateId, cloud);

      } catch (err) {
        console.error(`Error converting template ${templateId}:`, err);
      }
    }

    // Step 4: Add instances
    for (const instance of instances) {
      if (bundle.getTemplate(instance.templateId)) {
        bundle.addInstance(instance);
      }
    }

    this.onProgress({ stage: 'complete', progress: 100 });

    return bundle;
  }

  computeSceneBounds(instances, extractor) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];

    for (const inst of instances) {
      const templateBounds = extractor.getTemplateBounds(inst.templateId);
      if (!templateBounds) continue;

      const t = inst.transform.translate;
      for (let i = 0; i < 3; i++) {
        const offset = typeof t[i] === 'number' ? t[i] : 0;
        min[i] = Math.min(min[i], templateBounds.min[i] + offset);
        max[i] = Math.max(max[i], templateBounds.max[i] + offset);
      }
    }

    if (!isFinite(min[0])) {
      return { min: [-5, -5, -5], max: [5, 5, 5] };
    }

    return { min, max };
  }
}

/**
 * Create a simple SDF evaluator for basic primitives
 * @param {Object} defs - Scene definitions for resolving refs
 */
export function createSimpleSdfEvaluator(defs = {}) {
  function evalNode(node, x, y, z) {
    if (!node) return { distance: 1000, color: [0.8, 0.8, 0.8] };

    const pos = [x, y, z];

    // Apply inverse transform
    if (node.transform) {
      const t = node.transform.translate || [0, 0, 0];
      const r = node.transform.rotate || [0, 0, 0];
      const s = node.transform.scale;
      const scale = s ? (Array.isArray(s) ? s : [s, s, s]) : [1, 1, 1];

      // Translate first
      pos[0] = pos[0] - (typeof t[0] === 'number' ? t[0] : 0);
      pos[1] = pos[1] - (typeof t[1] === 'number' ? t[1] : 0);
      pos[2] = pos[2] - (typeof t[2] === 'number' ? t[2] : 0);

      // Apply inverse rotation (rotate in reverse order: Z, Y, X with negated angles)
      const rx = -(typeof r[0] === 'number' ? r[0] : 0) * Math.PI / 180;
      const ry = -(typeof r[1] === 'number' ? r[1] : 0) * Math.PI / 180;
      const rz = -(typeof r[2] === 'number' ? r[2] : 0) * Math.PI / 180;

      // Rotate around Z (reverse)
      if (rz !== 0) {
        const cz = Math.cos(rz), sz = Math.sin(rz);
        const x = pos[0], y = pos[1];
        pos[0] = x * cz - y * sz;
        pos[1] = x * sz + y * cz;
      }
      // Rotate around Y (reverse)
      if (ry !== 0) {
        const cy = Math.cos(ry), sy = Math.sin(ry);
        const x = pos[0], z = pos[2];
        pos[0] = x * cy + z * sy;
        pos[2] = -x * sy + z * cy;
      }
      // Rotate around X (reverse)
      if (rx !== 0) {
        const cx = Math.cos(rx), sx = Math.sin(rx);
        const y = pos[1], z = pos[2];
        pos[1] = y * cx - z * sx;
        pos[2] = y * sx + z * cx;
      }

      // Scale
      pos[0] /= scale[0];
      pos[1] /= scale[1];
      pos[2] /= scale[2];
    }

    const color = node.params?.color || [0.8, 0.8, 0.8];

    switch (node.type) {
      case 'sphere': {
        const r = node.params?.r || 1;
        const d = Math.sqrt(pos[0]*pos[0] + pos[1]*pos[1] + pos[2]*pos[2]) - r;
        return { distance: d, color };
      }

      case 'box': {
        const size = node.params?.size || [1, 1, 1];
        const q = [
          Math.abs(pos[0]) - size[0],
          Math.abs(pos[1]) - size[1],
          Math.abs(pos[2]) - size[2]
        ];
        const d = Math.min(Math.max(q[0], q[1], q[2]), 0) +
                  Math.sqrt(
                    Math.pow(Math.max(q[0], 0), 2) +
                    Math.pow(Math.max(q[1], 0), 2) +
                    Math.pow(Math.max(q[2], 0), 2)
                  );
        return { distance: d, color };
      }

      case 'cylinder': {
        const r = node.params?.r || 0.5;
        const h = node.params?.h || 1;
        const dx = Math.sqrt(pos[0]*pos[0] + pos[2]*pos[2]) - r;
        const dy = Math.abs(pos[1]) - h/2;
        const d = Math.min(Math.max(dx, dy), 0) +
                  Math.sqrt(Math.pow(Math.max(dx, 0), 2) + Math.pow(Math.max(dy, 0), 2));
        return { distance: d, color };
      }

      case 'capsule': {
        const r = typeof node.params?.r === 'number' ? node.params.r : 0.2;
        const h = typeof node.params?.h === 'number' ? node.params.h : 1;
        const pa = [pos[0], pos[1] - (-h/2), pos[2]];
        const ba = [0, h, 0];
        const t = Math.max(0, Math.min(1, (pa[0]*ba[0] + pa[1]*ba[1] + pa[2]*ba[2]) / (h*h)));
        const d = Math.sqrt(
          Math.pow(pa[0] - ba[0]*t, 2) +
          Math.pow(pa[1] - ba[1]*t, 2) +
          Math.pow(pa[2] - ba[2]*t, 2)
        ) - r;
        return { distance: d, color };
      }

      case 'torus': {
        const major = typeof node.params?.major === 'number' ? node.params.major : 1;
        const minor = typeof node.params?.minor === 'number' ? node.params.minor : 0.3;
        const q = [Math.sqrt(pos[0]*pos[0] + pos[2]*pos[2]) - major, pos[1]];
        const d = Math.sqrt(q[0]*q[0] + q[1]*q[1]) - minor;
        return { distance: d, color };
      }

      case 'union': {
        let minD = Infinity;
        let minColor = color;
        for (const child of (node.children || [])) {
          const result = evalNode(child, x, y, z);
          if (result.distance < minD) {
            minD = result.distance;
            minColor = result.color;
          }
        }
        return { distance: minD, color: minColor };
      }

      case 'subtract': {
        const children = node.children || [];
        if (children.length === 0) return { distance: 1000, color };

        let result = evalNode(children[0], x, y, z);
        for (let i = 1; i < children.length; i++) {
          const cut = evalNode(children[i], x, y, z);
          // Subtraction: max(a, -b)
          if (-cut.distance > result.distance) {
            result = { distance: -cut.distance, color: result.color };
          }
        }
        return result;
      }

      case 'ref': {
        // Resolve ref by looking up in defs
        const refDef = defs[node.id];
        if (refDef) {
          return evalNode(refDef, pos[0], pos[1], pos[2]);
        }
        console.warn(`Unresolved ref: ${node.id}`);
        return { distance: 1000, color };
      }

      case 'mirror': {
        const axis = { x: 0, y: 1, z: 2 }[node.axis] || 0;
        const mirrorPos = [...pos];
        mirrorPos[axis] = Math.abs(mirrorPos[axis]);
        // Evaluate child at mirrored position
        if (node.child) {
          return evalNode(node.child, mirrorPos[0], mirrorPos[1], mirrorPos[2]);
        }
        return { distance: 1000, color };
      }

      case 'transform':
      case 'group':
      case 'material':
        if (node.child) {
          const result = evalNode(node.child, pos[0], pos[1], pos[2]);
          if (node.type === 'material' && node.params?.color) {
            result.color = node.params.color;
          }
          return result;
        }
        return { distance: 1000, color };

      default:
        console.warn(`Unknown node type: ${node.type}`);
        return { distance: 1000, color };
    }
  }

  return evalNode;
}

/**
 * Quick helper to convert and render a Lucid scene
 */
export async function quickConvertAndRender(sceneJson, canvas, options = {}) {
  const converter = new LucidToSplats(options);
  const sdfEvaluator = createSimpleSdfEvaluator();

  const bundle = await converter.convert(sceneJson, sdfEvaluator);

  const renderer = new InstancedSplatRenderer(canvas, options);

  // Add templates
  for (const [id, cloud] of bundle.templateClouds) {
    renderer.addTemplate(id, cloud);
  }

  // Add instances
  for (const instance of bundle.getInstances()) {
    renderer.addInstance(instance.template, instance);
  }

  return { bundle, renderer };
}

/**
 * GPU-accelerated conversion: Uses WebGL2 raymarching on GPU
 * Requires the main Lucid codegen for GLSL generation
 *
 * @param {string} sceneGlsl - GLSL code from generateGlslFromJson()
 * @param {Object} bounds - Scene bounds { min: [x,y,z], max: [x,y,z] }
 * @param {HTMLCanvasElement} canvas - Canvas for rendering
 * @param {Object} options - Conversion options
 */
export async function gpuConvertAndRender(sceneGlsl, bounds, canvas, options = {}) {
  const resolution = options.gpuResolution || 256;
  const targetSplats = options.targetSplatsPerTemplate || 4000;
  const scaleMultiplier = options.splatScaleMultiplier || 1.5;

  console.log(`GPU sampling at ${resolution}x${resolution} from 6 directions...`);

  // Create GPU sampler
  const gpuSampler = new GPUSampler({
    resolution: resolution,
    maxDistance: options.maxDistance || 20.0,
    hitThreshold: options.hitThreshold || 0.001,
    maxSteps: options.maxSteps || 128
  });

  // Sample the scene on GPU
  const sampleResult = gpuSampler.sample(sceneGlsl, bounds, {
    deduplicationRadius: options.deduplicationRadius || 0.02
  });

  console.log(`GPU sampled ${sampleResult.count} surface points`);

  // Estimate base scale from bounds
  const boundsSize = Math.max(
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2]
  );
  const baseScale = boundsSize / (resolution * 0.3);

  // Convert to point cloud format with anisotropic data
  const pointCloud = gpuSampler.toPointCloud(sampleResult, {
    baseScale: baseScale * scaleMultiplier
  });

  // Train Gaussians
  const trainer = new QuickTrainer({
    targetCount: targetSplats,
    scaleMultiplier: scaleMultiplier
  });

  const cloud = await trainer.train(pointCloud);
  console.log(`Trained ${cloud.count} Gaussians from GPU samples`);

  // Clean up GPU resources
  gpuSampler.dispose();

  // Create renderer
  const renderer = new InstancedSplatRenderer(canvas, options);
  renderer.addTemplate('gpu_scene', cloud);
  renderer.addInstance('gpu_scene', {
    templateId: 'gpu_scene',
    transform: { translate: [0, 0, 0], rotate: [0, 0, 0], scale: [1, 1, 1] }
  });

  return { cloud, renderer };
}

export default {
  LucidToSplats,
  createSimpleSdfEvaluator,
  quickConvertAndRender,
  gpuConvertAndRender,
  SDFSampler,
  FixedSDFSampler,
  GPUSampler,
  Gaussian,
  GaussianCloud,
  TemplateExtractor,
  SplatBundle,
  QuickTrainer,
  InstancedSplatRenderer
};
