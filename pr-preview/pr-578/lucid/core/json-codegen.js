/**
 * JSON to GLSL Codegen - Generate GLSL from JSON node IR
 * Refactored: walkNode returns expressions, not return statements
 */

import { getAllParamNames } from './rig-evaluator.js';

/**
 * Generate GLSL code from processed JSON scene
 * @param {Object} scene - The processed scene IR
 * @param {Object} options - Optional generation options
 * @param {boolean} options.showCutters - Debug mode: show CSG cutters as union instead of subtract
 */
export function generateGlslFromJson(scene, options = {}) {
  const ctx = {
    uniforms: new Set(),
    functions: [],
    helpers: [],
    helperCounter: 0,
    showCutters: options.showCutters || false,
    localVars: {},  // For instance IDs and other scoped variables
    instanceIdParam: null,  // When set, pass this ID through to helper functions
    sceneParams: scene.params || {},  // Scene-level parameters for parametric rigging
    sceneRig: scene.rig || null,      // Rig layer for derived params, bounds, phase
    ancestorRotation: null,  // Tracks accumulated rotation for mirror fix (LCD-003)
    // LCD-018: Picking infrastructure
    nodeIdCounter: 0,         // Assigns unique IDs to pickable nodes
    nodeIdMap: new Map(),     // Maps node ID -> node info for picking
    pickingMode: options.pickingMode || false  // When true, encode IDs instead of colors
  };

  // Register ALL params as uniforms (base + derived + phase from rig layer)
  // This ensures derived params and phase-coupled values have uniforms declared
  const allParams = getAllParamNames(scene.params || {}, scene.rig);
  for (const [name, paramInfo] of Object.entries(allParams)) {
    const uniformName = `u_${name}`;
    if (paramInfo.type === 'scalar') {
      ctx.uniforms.add(uniformName);
    } else if (paramInfo.type === 'color3' || paramInfo.type === 'position3' || paramInfo.type === 'radii3' || paramInfo.type === 'direction3') {
      // Mark as vec3 uniform (handled specially in uniform declaration)
      ctx.uniforms.add(`${uniformName}:vec3`);
    }
  }

  // Register physics params as vec3 uniforms (body positions from physics.bodies)
  // These are dynamically computed but need uniform declarations
  if (scene.physics?.enabled && scene.physics.bodies) {
    for (const body of scene.physics.bodies) {
      if (body.name) {
        ctx.uniforms.add(`u_phys_${body.name}:vec3`);
      }
    }
  }

  // Generate main scene expression
  const sceneExpr = walkNode(scene.root, ctx);

  // Build final shader
  let glsl = '';

  // Note: u_time, u_resolution, u_cameraPos etc. are already declared
  // by raymarcher.js - we only declare additional custom uniforms here
  const builtinUniforms = new Set(['u_time', 'u_resolution', 'u_cameraPos', 'u_cameraTarget', 'u_showGroundPlane', 'u_volumeRender']);
  const customUniforms = [...ctx.uniforms].filter(u => {
    const baseName = u.split(':')[0];
    return !builtinUniforms.has(baseName);
  });

  if (customUniforms.length > 0) {
    glsl += '// Custom uniforms (including scene params)\n';
    for (const uniform of customUniforms) {
      // Handle typed uniforms (e.g., "u_bodyColor:vec3")
      if (uniform.includes(':')) {
        const [name, type] = uniform.split(':');
        glsl += `uniform ${type} ${name};\n`;
      } else {
        glsl += `uniform float ${uniform};\n`;
      }
    }
    glsl += '\n';
  }

  // Add SDF primitive functions
  glsl += generatePrimitiveFunctions();

  // Add helper functions
  glsl += generateHelperFunctions();

  // Add generated helper functions
  if (ctx.helpers.length > 0) {
    glsl += '// Generated helper functions\n';
    glsl += ctx.helpers.join('\n\n');
    glsl += '\n\n';
  }

  // Add main scene function - wrap expression with return
  glsl += '// Main scene SDF\n';
  glsl += 'vec4 g_df_scene(vec3 p) {\n';
  glsl += `  return ${sceneExpr};\n`;
  glsl += '}\n';

  return glsl;
}

const MAX_CODEGEN_DEPTH = 200;

/**
 * Walk node and generate GLSL expression (not a statement)
 * Returns a string that evaluates to vec4(distance, r, g, b)
 */
function walkNode(node, ctx) {
  // Track recursion depth
  ctx.depth = (ctx.depth || 0) + 1;
  if (ctx.depth > MAX_CODEGEN_DEPTH) {
    console.warn(`Max codegen depth (${MAX_CODEGEN_DEPTH}) exceeded, returning placeholder`);
    ctx.depth--;
    return 'vec4(1000.0, 1.0, 0.0, 1.0)';
  }

  try {
    // Check if this node has a scale transform - if so, wrap with scale correction
    // Per IQ's SDF guidance: primitive(p/s) * s for uniform, primitive(p/s) * min(s) for non-uniform
    if (node.transform && node.transform.scale) {
      return generateScaledNode(node, ctx);
    }

    switch (node.type) {
    case 'sphere':
      return generateSphere(node, ctx);

    case 'box':
      return generateBox(node, ctx);

    case 'torus':
      return generateTorus(node, ctx);

    case 'cylinder':
      return generateCylinder(node, ctx);

    case 'capsule':
      return generateCapsule(node, ctx);

    case 'ellipsoid':
      return generateEllipsoid(node, ctx);

    case 'cone':
    case 'roundCone':  // Alias - uses same generator, sdRoundCone when r1/r2 specified
      return generateCone(node, ctx);

    case 'plane':
      return generatePlane(node, ctx);

    case 'union':
      return generateUnion(node, ctx);

    case 'subtract':
      return generateSubtract(node, ctx);

    case 'intersect':
      return generateIntersect(node, ctx);

    case 'smoothUnion':
      return generateSmoothUnion(node, ctx);

    case 'smoothIntersect':
      return generateSmoothIntersect(node, ctx);

    case 'smoothSubtract':
      return generateSmoothSubtract(node, ctx);

    case 'transform':
      return generateTransform(node, ctx);

    case 'group':
      return generateGroup(node, ctx);

    case 'material':
      return generateMaterial(node, ctx);

    case 'ref':
      return generateRef(node, ctx);

    case 'mirror':
      return generateMirror(node, ctx);

    case 'radial':
      return generateRadial(node, ctx);

    case 'repeat':
      return generateRepeat(node, ctx);

    case 'select':
      return generateSelect(node, ctx);

    case 'round':
      return generateRound(node, ctx);

    case 'shell':
      return generateShell(node, ctx);

    case 'displace':
      return generateDisplace(node, ctx);

    case 'customExpr':
      return generateCustomExpr(node, ctx);

    default:
      console.warn(`Unhandled node type: ${node.type}`);
      return 'vec4(1000.0, 1.0, 0.0, 1.0)';
    }
  } finally {
    ctx.depth--;
  }
}

/**
 * Generate sphere - returns expression
 */
function generateSphere(node, ctx) {
  const params = node.params || {};
  const r = valueToGlsl(params.r || { type: 'const', value: 1.0 }, ctx);
  const p = applyTransform('p', node.transform, ctx);
  const color = valueToGlsl(params.color || { type: 'array', values: [0.8, 0.8, 0.8].map(v => ({ type: 'const', value: v })) }, ctx);

  return `vec4(sdSphere(${p}, ${r}), ${color})`;
}

/**
 * Generate box - returns expression
 *
 * Note: JSON size values are half-extents [halfWidth, halfHeight, halfDepth],
 * matching what sdBox expects directly. A box with size [1, 0.5, 2] spans
 * -1 to +1 on X, -0.5 to +0.5 on Y, -2 to +2 on Z.
 */
function generateBox(node, ctx) {
  const params = node.params || {};
  const size = valueToGlsl(params.size || { type: 'array', values: [1, 1, 1].map(v => ({ type: 'const', value: v })) }, ctx);
  const p = applyTransform('p', node.transform, ctx);
  const color = valueToGlsl(params.color || { type: 'array', values: [0.8, 0.8, 0.8].map(v => ({ type: 'const', value: v })) }, ctx);

  return `vec4(sdBox(${p}, ${size}), ${color})`;
}

/**
 * Generate torus - returns expression
 */
function generateTorus(node, ctx) {
  const params = node.params || {};
  const major = valueToGlsl(params.major || { type: 'const', value: 1.0 }, ctx);
  const minor = valueToGlsl(params.minor || { type: 'const', value: 0.3 }, ctx);
  const p = applyTransform('p', node.transform, ctx);
  const color = valueToGlsl(params.color || { type: 'array', values: [0.8, 0.8, 0.8].map(v => ({ type: 'const', value: v })) }, ctx);

  return `vec4(sdTorus(${p}, vec2(${major}, ${minor})), ${color})`;
}

/**
 * Generate cylinder - returns expression
 */
function generateCylinder(node, ctx) {
  const params = node.params || {};
  const h = valueToGlsl(params.h || { type: 'const', value: 1.0 }, ctx);
  const r = valueToGlsl(params.r || { type: 'const', value: 0.5 }, ctx);
  const p = applyTransform('p', node.transform, ctx);
  const color = valueToGlsl(params.color || { type: 'array', values: [0.8, 0.8, 0.8].map(v => ({ type: 'const', value: v })) }, ctx);

  return `vec4(sdCylinder(${p}, ${h}, ${r}), ${color})`;
}

/**
 * Generate capsule - returns expression
 * A capsule is a cylinder with hemispherical caps
 */
function generateCapsule(node, ctx) {
  const params = node.params || {};
  const h = valueToGlsl(params.h || { type: 'const', value: 1.0 }, ctx);
  const r = valueToGlsl(params.r || { type: 'const', value: 0.25 }, ctx);
  const p = applyTransform('p', node.transform, ctx);
  const color = valueToGlsl(params.color || { type: 'array', values: [0.8, 0.8, 0.8].map(v => ({ type: 'const', value: v })) }, ctx);

  return `vec4(sdCapsule(${p}, ${h}, ${r}), ${color})`;
}

/**
 * Generate ellipsoid - returns expression
 * An ellipsoid with different radii on each axis
 */
function generateEllipsoid(node, ctx) {
  const params = node.params || {};
  const radii = valueToGlsl(params.radii || { type: 'array', values: [1, 0.5, 0.5].map(v => ({ type: 'const', value: v })) }, ctx);
  const p = applyTransform('p', node.transform, ctx);
  const color = valueToGlsl(params.color || { type: 'array', values: [0.8, 0.8, 0.8].map(v => ({ type: 'const', value: v })) }, ctx);

  return `vec4(sdEllipsoid(${p}, ${radii}), ${color})`;
}

/**
 * Generate cone - returns expression
 * Supports both simple cones (r param) and truncated cones (r1, r2 params)
 * - h: height of the cone
 * - r: base radius (simple cone with tip at top)
 * - r1, r2: bottom and top radii (truncated cone/frustum)
 */
function generateCone(node, ctx) {
  const params = node.params || {};
  const h = valueToGlsl(params.h || { type: 'const', value: 1.0 }, ctx);
  const p = applyTransform('p', node.transform, ctx);
  const color = valueToGlsl(params.color || { type: 'array', values: [0.8, 0.8, 0.8].map(v => ({ type: 'const', value: v })) }, ctx);

  // Check if truncated cone (r1, r2) or simple cone (r)
  if (params.r1 !== undefined || params.r2 !== undefined) {
    // Truncated cone / frustum / rounded cone
    const r1 = valueToGlsl(params.r1 || { type: 'const', value: 0.5 }, ctx);  // bottom radius
    const r2 = valueToGlsl(params.r2 || { type: 'const', value: 0.0 }, ctx);  // top radius (0 = pointed tip)
    return `vec4(sdRoundCone(${p}, ${r1}, ${r2}, ${h}), ${color})`;
  } else {
    // Simple cone with tip at origin
    const r = valueToGlsl(params.r || { type: 'const', value: 0.5 }, ctx);
    return `vec4(sdCone(${p}, ${h}, ${r}), ${color})`;
  }
}

/**
 * Generate plane - returns expression
 * An infinite plane defined by normal and height
 */
function generatePlane(node, ctx) {
  const params = node.params || {};
  const normal = valueToGlsl(params.normal || { type: 'array', values: [0, 1, 0].map(v => ({ type: 'const', value: v })) }, ctx);
  const h = valueToGlsl(params.h || { type: 'const', value: 0 }, ctx);
  const p = applyTransform('p', node.transform, ctx);
  const color = valueToGlsl(params.color || { type: 'array', values: [0.5, 0.5, 0.5].map(v => ({ type: 'const', value: v })) }, ctx);

  return `vec4(sdPlane(${p}, ${normal}, ${h}), ${color})`;
}

/**
 * Chain binary min() calls for GLSL (which only accepts 2 args)
 */
function chainedMin(values) {
  if (values.length === 1) return values[0];
  if (values.length === 2) return `min(${values[0]}, ${values[1]})`;
  return `min(${values[0]}, ${chainedMin(values.slice(1))})`;
}

/**
 * Chain binary max() calls for GLSL (which only accepts 2 args)
 */
function chainedMax(values) {
  if (values.length === 1) return values[0];
  if (values.length === 2) return `max(${values[0]}, ${values[1]})`;
  return `max(${values[0]}, ${chainedMax(values.slice(1))})`;
}

/**
 * Generate union - creates helper function, returns call expression
 *
 * Transform handling: Apply parent transform to p FIRST, then each child
 * applies only its local transform. This ensures proper transform composition
 * where root rotations affect the entire assembly uniformly.
 *
 * LCD-003: Track rotation in context for mirror fix
 */
function generateUnion(node, ctx) {
  let children = node.children || [];

  if (children.length === 0) {
    return 'vec4(1000.0, 1.0, 0.0, 1.0)';
  }

  // Apply parent transform to p first, then children use only local transforms
  // This replaces the old approach of combining transforms which didn't work
  // correctly for rotation composition
  const transformedP = applyTransform('p', node.transform, ctx);
  const hasParentTransform = node.transform && transformedP !== 'p';

  // LCD-003: Track rotation for mirror fix
  const savedAncestorRotation = ctx.ancestorRotation;
  const nodeRotation = extractRotation(node.transform);
  if (nodeRotation && isStaticRotation(nodeRotation)) {
    ctx.ancestorRotation = savedAncestorRotation
      ? addRotations(savedAncestorRotation, nodeRotation)
      : nodeRotation;
  }

  let result;

  // BVH: Check for bounding box early-out optimization
  const bbox = node.boundingBox;
  let bboxCheck = null;
  if (bbox && bbox.center && bbox.halfSize) {
    // Generate AABB distance check
    const cx = Array.isArray(bbox.center) ? bbox.center[0] : 0;
    const cy = Array.isArray(bbox.center) ? bbox.center[1] : 0;
    const cz = Array.isArray(bbox.center) ? bbox.center[2] : 0;
    const hx = Array.isArray(bbox.halfSize) ? bbox.halfSize[0] : 1;
    const hy = Array.isArray(bbox.halfSize) ? bbox.halfSize[1] : 1;
    const hz = Array.isArray(bbox.halfSize) ? bbox.halfSize[2] : 1;
    bboxCheck = {
      center: `vec3(${cx.toFixed(3)}, ${cy.toFixed(3)}, ${cz.toFixed(3)})`,
      halfSize: `vec3(${hx.toFixed(3)}, ${hy.toFixed(3)}, ${hz.toFixed(3)})`
    };
  }

  if (children.length === 1) {
    // For single child, if we have parent transform, wrap it
    if (hasParentTransform) {
      const funcName = `union_${ctx.helperCounter++}`;
      const idParam = ctx.instanceIdParam;
      const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
      const callArgs = idParam ? `p, ${idParam}` : 'p';
      const childCallArgs = idParam ? `tp, ${idParam}` : 'tp';

      // Create child helper with original p parameter
      const childFuncName = `union_child_${ctx.helperCounter++}`;
      const childExpr = walkNode(children[0], ctx);
      ctx.helpers.push(`vec4 ${childFuncName}(${paramList}) {
  return ${childExpr};
}`);

      const helperFunc = `vec4 ${funcName}(${paramList}) {
  vec3 tp = ${transformedP};
  return ${childFuncName}(${childCallArgs});
}`;
      ctx.helpers.push(helperFunc);
      result = `${funcName}(${callArgs})`;
    } else {
      result = walkNode(children[0], ctx);
    }
  } else {
    // Generate helper function for this union
    const funcName = `union_${ctx.helperCounter++}`;
    const idParam = ctx.instanceIdParam;
    const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
    const callArgs = idParam ? `p, ${idParam}` : 'p';

    // If we have a parent transform, apply it first and pass transformed point to children
    let bodyPrefix = '';
    let childP = 'p';
    if (hasParentTransform) {
      bodyPrefix = `  vec3 tp = ${transformedP};\n`;
      childP = 'tp';
    }

    // Generate child expressions - each child uses childP (transformed or not)
    // We wrap each child in a helper that takes the transformed point
    const childHelpers = children.map((child, i) => {
      const childFuncName = `union_child_${ctx.helperCounter++}`;
      const childExpr = walkNode(child, ctx);
      ctx.helpers.push(`vec4 ${childFuncName}(${paramList}) {
  return ${childExpr};
}`);
      return childFuncName;
    });

    const childCallArgs = idParam ? `${childP}, ${idParam}` : childP;
    const childAssignments = childHelpers.map((funcName, i) => {
      return `  vec4 c${i} = ${funcName}(${childCallArgs});`;
    }).join('\n');

    // Select color from closest child using sequential comparisons (O(n) code size)
    let colorSelect;
    if (children.length === 2) {
      colorSelect = '\n  return c0.x < c1.x ? c0 : c1;';
    } else {
      colorSelect = '\n  vec4 nearest = c0;';
      for (let i = 1; i < children.length; i++) {
        colorSelect += `\n  nearest = nearest.x < c${i}.x ? nearest : c${i};`;
      }
      colorSelect += '\n  return nearest;';
    }

    // BVH: Add AABB early-out check if bounding box specified
    let bboxEarlyOut = '';
    if (bboxCheck) {
      // AABB signed distance: if positive, point is outside box
      bboxEarlyOut = `  vec3 bboxD = abs(${hasParentTransform ? 'tp' : 'p'} - ${bboxCheck.center}) - ${bboxCheck.halfSize};
  float bboxDist = length(max(bboxD, vec3(0.0))) + min(max(bboxD.x, max(bboxD.y, bboxD.z)), 0.0);
  if (bboxDist > 0.1) return vec4(bboxDist, 0.5, 0.5, 0.5);
`;
    }

    const helperFunc = `vec4 ${funcName}(${paramList}) {
${bodyPrefix}${bboxEarlyOut}${childAssignments}${colorSelect}
}`;

    ctx.helpers.push(helperFunc);
    result = `${funcName}(${callArgs})`;
  }

  // LCD-003: Restore ancestor rotation
  ctx.ancestorRotation = savedAncestorRotation;

  return result;
}

/**
 * Generate subtract - creates helper function, returns call expression
 *
 * Transform handling: Apply parent transform to p FIRST, then each child
 * applies only its local transform. This ensures proper transform composition
 * where root rotations affect the entire assembly uniformly.
 *
 * LCD-003: Track rotation in context for mirror fix
 * CSG formula: max(base, max(-cutter1, max(-cutter2, ...)))
 */
function generateSubtract(node, ctx) {
  let children = node.children || [];

  if (children.length === 0) {
    return 'vec4(1000.0, 1.0, 0.0, 1.0)';
  }

  // Apply parent transform to p first, then children use only local transforms
  const transformedP = applyTransform('p', node.transform, ctx);
  const hasParentTransform = node.transform && transformedP !== 'p';

  // LCD-003: Track rotation for mirror fix
  const savedAncestorRotation = ctx.ancestorRotation;
  const nodeRotation = extractRotation(node.transform);
  if (nodeRotation && isStaticRotation(nodeRotation)) {
    ctx.ancestorRotation = savedAncestorRotation
      ? addRotations(savedAncestorRotation, nodeRotation)
      : nodeRotation;
  }

  let result;

  if (children.length === 1) {
    // For single child, if we have parent transform, wrap it
    if (hasParentTransform) {
      const funcName = `subtract_${ctx.helperCounter++}`;
      const idParam = ctx.instanceIdParam;
      const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
      const callArgs = idParam ? `p, ${idParam}` : 'p';
      const childCallArgs = idParam ? `tp, ${idParam}` : 'tp';

      const childFuncName = `subtract_child_${ctx.helperCounter++}`;
      const childExpr = walkNode(children[0], ctx);
      ctx.helpers.push(`vec4 ${childFuncName}(${paramList}) {
  return ${childExpr};
}`);

      const helperFunc = `vec4 ${funcName}(${paramList}) {
  vec3 tp = ${transformedP};
  return ${childFuncName}(${childCallArgs});
}`;
      ctx.helpers.push(helperFunc);
      result = `${funcName}(${callArgs})`;
    } else {
      result = walkNode(children[0], ctx);
    }
  } else {
    // Generate helper function
    const funcName = `subtract_${ctx.helperCounter++}`;
    const idParam = ctx.instanceIdParam;
    const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
    const callArgs = idParam ? `p, ${idParam}` : 'p';

    // If we have a parent transform, apply it first
    let bodyPrefix = '';
    let childP = 'p';
    if (hasParentTransform) {
      bodyPrefix = `  vec3 tp = ${transformedP};\n`;
      childP = 'tp';
    }

    // Wrap each child in a helper function
    const childHelpers = children.map((child, i) => {
      const childFuncName = `subtract_child_${ctx.helperCounter++}`;
      const childExpr = walkNode(child, ctx);
      ctx.helpers.push(`vec4 ${childFuncName}(${paramList}) {
  return ${childExpr};
}`);
      return childFuncName;
    });

    const childCallArgs = idParam ? `${childP}, ${idParam}` : childP;

    // Build the subtract body
    let body = bodyPrefix;
    body += `  vec4 base = ${childHelpers[0]}(${childCallArgs});\n`;

    for (let i = 1; i < children.length; i++) {
      body += `  vec4 sub${i} = ${childHelpers[i]}(${childCallArgs});\n`;
      if (ctx.showCutters) {
        // Debug mode: show cutters as union (min) instead of subtract (max of negated)
        body += `  if (sub${i}.x < base.x) base = sub${i};\n`;
      } else {
        // Normal subtract: base.x = max(base.x, -sub.x)
        body += `  base.x = max(base.x, -sub${i}.x);\n`;
      }
    }

    const helperFunc = `vec4 ${funcName}(${paramList}) {
${body}  return base;
}`;

    ctx.helpers.push(helperFunc);
    result = `${funcName}(${callArgs})`;
  }

  // LCD-003: Restore ancestor rotation
  ctx.ancestorRotation = savedAncestorRotation;

  return result;
}

/**
 * Generate intersect - creates helper function, returns call expression
 *
 * Transform handling: Apply parent transform to p FIRST, then each child
 * applies only its local transform.
 */
function generateIntersect(node, ctx) {
  let children = node.children || [];

  if (children.length === 0) {
    return 'vec4(1000.0, 1.0, 0.0, 1.0)';
  }

  // Apply parent transform to p first, then children use only local transforms
  const transformedP = applyTransform('p', node.transform, ctx);
  const hasParentTransform = node.transform && transformedP !== 'p';

  if (children.length === 1) {
    if (hasParentTransform) {
      const funcName = `intersect_${ctx.helperCounter++}`;
      const idParam = ctx.instanceIdParam;
      const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
      const callArgs = idParam ? `p, ${idParam}` : 'p';
      const childCallArgs = idParam ? `tp, ${idParam}` : 'tp';

      const childFuncName = `intersect_child_${ctx.helperCounter++}`;
      const childExpr = walkNode(children[0], ctx);
      ctx.helpers.push(`vec4 ${childFuncName}(${paramList}) {
  return ${childExpr};
}`);

      const helperFunc = `vec4 ${funcName}(${paramList}) {
  vec3 tp = ${transformedP};
  return ${childFuncName}(${childCallArgs});
}`;
      ctx.helpers.push(helperFunc);
      return `${funcName}(${callArgs})`;
    }
    return walkNode(children[0], ctx);
  }

  // Generate helper function
  const funcName = `intersect_${ctx.helperCounter++}`;
  const idParam = ctx.instanceIdParam;
  const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
  const callArgs = idParam ? `p, ${idParam}` : 'p';

  // If we have a parent transform, apply it first
  let bodyPrefix = '';
  let childP = 'p';
  if (hasParentTransform) {
    bodyPrefix = `  vec3 tp = ${transformedP};\n`;
    childP = 'tp';
  }

  // Wrap each child in a helper function
  const childHelpers = children.map((child, i) => {
    const childFuncName = `intersect_child_${ctx.helperCounter++}`;
    const childExpr = walkNode(child, ctx);
    ctx.helpers.push(`vec4 ${childFuncName}(${paramList}) {
  return ${childExpr};
}`);
    return childFuncName;
  });

  const childCallArgs = idParam ? `${childP}, ${idParam}` : childP;
  const childAssignments = childHelpers.map((funcName, i) => {
    return `  vec4 c${i} = ${funcName}(${childCallArgs});`;
  }).join('\n');

  // Select color from child with largest distance using sequential comparisons
  let colorSelect;
  if (children.length === 2) {
    colorSelect = '\n  return c0.x > c1.x ? c0 : c1;';
  } else {
    colorSelect = '\n  vec4 farthest = c0;';
    for (let i = 1; i < children.length; i++) {
      colorSelect += `\n  farthest = farthest.x > c${i}.x ? farthest : c${i};`;
    }
    colorSelect += '\n  return farthest;';
  }

  const helperFunc = `vec4 ${funcName}(${paramList}) {
${bodyPrefix}${childAssignments}${colorSelect}
}`;

  ctx.helpers.push(helperFunc);

  return `${funcName}(${callArgs})`;
}

/**
 * Generate smooth union - creates helper function, returns call expression
 *
 * Transform handling: Apply parent transform to p FIRST, then each child
 * applies only its local transform.
 */
function generateSmoothUnion(node, ctx) {
  let children = node.children || [];
  const k = valueToGlsl(node.k || { type: 'const', value: 0.1 }, ctx);

  if (children.length === 0) {
    return 'vec4(1000.0, 1.0, 0.0, 1.0)';
  }

  // Apply parent transform to p first, then children use only local transforms
  const transformedP = applyTransform('p', node.transform, ctx);
  const hasParentTransform = node.transform && transformedP !== 'p';

  // Debug: log when smoothUnion has a physics-related transform
  if (node.transform?.translate?.type === 'var' && node.transform.translate.name?.startsWith('phys_')) {
    console.log(`[generateSmoothUnion] Physics transform: ${node.transform.translate.name}, transformedP=${transformedP}, hasParentTransform=${hasParentTransform}`);
  }

  if (children.length === 1) {
    if (hasParentTransform) {
      const funcName = `smoothUnion_${ctx.helperCounter++}`;
      const idParam = ctx.instanceIdParam;
      const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
      const callArgs = idParam ? `p, ${idParam}` : 'p';
      const childCallArgs = idParam ? `tp, ${idParam}` : 'tp';

      const childFuncName = `smoothUnion_child_${ctx.helperCounter++}`;
      const childExpr = walkNode(children[0], ctx);
      ctx.helpers.push(`vec4 ${childFuncName}(${paramList}) {
  return ${childExpr};
}`);

      const helperFunc = `vec4 ${funcName}(${paramList}) {
  vec3 tp = ${transformedP};
  return ${childFuncName}(${childCallArgs});
}`;
      ctx.helpers.push(helperFunc);
      return `${funcName}(${callArgs})`;
    }
    return walkNode(children[0], ctx);
  }

  // Generate helper function for N children (not just 2!)
  const funcName = `smoothUnion_${ctx.helperCounter++}`;
  const idParam = ctx.instanceIdParam;
  const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
  const callArgs = idParam ? `p, ${idParam}` : 'p';

  // If we have a parent transform, apply it first
  let bodyPrefix = '';
  let childP = 'p';
  if (hasParentTransform) {
    bodyPrefix = `  vec3 tp = ${transformedP};\n`;
    childP = 'tp';
  }

  const childCallArgs = idParam ? `${childP}, ${idParam}` : childP;

  // Generate a helper function for each child
  const childFuncNames = [];
  for (let i = 0; i < children.length; i++) {
    const childFuncName = `smoothUnion_child_${ctx.helperCounter++}`;
    const childExpr = walkNode(children[i], ctx);
    ctx.helpers.push(`vec4 ${childFuncName}(${paramList}) {
  return ${childExpr};
}`);
    childFuncNames.push(childFuncName);
  }

  // Build the smooth union body by chaining all children
  // result = smin(child0, smin(child1, smin(child2, ...)))
  let bodyLines = [];
  bodyLines.push(`  vec4 result = ${childFuncNames[0]}(${childCallArgs});`);

  for (let i = 1; i < childFuncNames.length; i++) {
    bodyLines.push(`  {`);
    bodyLines.push(`    vec4 b = ${childFuncNames[i]}(${childCallArgs});`);
    bodyLines.push(`    float h = clamp(0.5 + 0.5 * (b.x - result.x) / ${k}, 0.0, 1.0);`);
    bodyLines.push(`    float d = mix(b.x, result.x, h) - ${k} * h * (1.0 - h);`);
    bodyLines.push(`    vec3 col = mix(b.yzw, result.yzw, h);`);
    bodyLines.push(`    result = vec4(d, col);`);
    bodyLines.push(`  }`);
  }

  bodyLines.push(`  return result;`);

  const helperFunc = `vec4 ${funcName}(${paramList}) {
${bodyPrefix}${bodyLines.join('\n')}
}`;

  ctx.helpers.push(helperFunc);

  return `${funcName}(${callArgs})`;
}

/**
 * Generate smooth intersect - creates helper function, returns call expression
 *
 * Uses smooth maximum (smax) for blending at intersection boundaries.
 * Formula: h = clamp(0.5 - 0.5*(b-a)/k, 0, 1); d = mix(b,a,h) + k*h*(1-h)
 *
 * Transform handling: Apply parent transform to p FIRST, then each child
 * applies only its local transform.
 */
function generateSmoothIntersect(node, ctx) {
  let children = node.children || [];
  const k = valueToGlsl(node.k || { type: 'const', value: 0.1 }, ctx);

  if (children.length === 0) {
    return 'vec4(1000.0, 1.0, 0.0, 1.0)';
  }

  // Apply parent transform to p first, then children use only local transforms
  const transformedP = applyTransform('p', node.transform, ctx);
  const hasParentTransform = node.transform && transformedP !== 'p';

  if (children.length === 1) {
    if (hasParentTransform) {
      const funcName = `smoothIntersect_${ctx.helperCounter++}`;
      const idParam = ctx.instanceIdParam;
      const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
      const callArgs = idParam ? `p, ${idParam}` : 'p';
      const childCallArgs = idParam ? `tp, ${idParam}` : 'tp';

      const childFuncName = `smoothIntersect_child_${ctx.helperCounter++}`;
      const childExpr = walkNode(children[0], ctx);
      ctx.helpers.push(`vec4 ${childFuncName}(${paramList}) {
  return ${childExpr};
}`);

      const helperFunc = `vec4 ${funcName}(${paramList}) {
  vec3 tp = ${transformedP};
  return ${childFuncName}(${childCallArgs});
}`;
      ctx.helpers.push(helperFunc);
      return `${funcName}(${callArgs})`;
    }
    return walkNode(children[0], ctx);
  }

  // Generate helper function for N children
  const funcName = `smoothIntersect_${ctx.helperCounter++}`;
  const idParam = ctx.instanceIdParam;
  const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
  const callArgs = idParam ? `p, ${idParam}` : 'p';

  // If we have a parent transform, apply it first
  let bodyPrefix = '';
  let childP = 'p';
  if (hasParentTransform) {
    bodyPrefix = `  vec3 tp = ${transformedP};\n`;
    childP = 'tp';
  }

  const childCallArgs = idParam ? `${childP}, ${idParam}` : childP;

  // Generate a helper function for each child
  const childFuncNames = [];
  for (let i = 0; i < children.length; i++) {
    const childFuncName = `smoothIntersect_child_${ctx.helperCounter++}`;
    const childExpr = walkNode(children[i], ctx);
    ctx.helpers.push(`vec4 ${childFuncName}(${paramList}) {
  return ${childExpr};
}`);
    childFuncNames.push(childFuncName);
  }

  // Build the smooth intersect body by chaining all children
  // Uses smooth maximum: h = clamp(0.5 - 0.5*(b-a)/k, 0, 1); d = mix(b,a,h) + k*h*(1-h)
  let bodyLines = [];
  bodyLines.push(`  vec4 result = ${childFuncNames[0]}(${childCallArgs});`);

  for (let i = 1; i < childFuncNames.length; i++) {
    bodyLines.push(`  {`);
    bodyLines.push(`    vec4 b = ${childFuncNames[i]}(${childCallArgs});`);
    // Smooth max formula (note: minus sign for h, plus sign for d)
    bodyLines.push(`    float h = clamp(0.5 - 0.5 * (b.x - result.x) / ${k}, 0.0, 1.0);`);
    bodyLines.push(`    float d = mix(b.x, result.x, h) + ${k} * h * (1.0 - h);`);
    bodyLines.push(`    vec3 col = mix(b.yzw, result.yzw, h);`);
    bodyLines.push(`    result = vec4(d, col);`);
    bodyLines.push(`  }`);
  }

  bodyLines.push(`  return result;`);

  const helperFunc = `vec4 ${funcName}(${paramList}) {
${bodyPrefix}${bodyLines.join('\n')}
}`;

  ctx.helpers.push(helperFunc);

  return `${funcName}(${callArgs})`;
}

/**
 * Generate smooth subtract - creates helper function, returns call expression
 *
 * Uses IQ's opSmoothSubtraction formula:
 * h = clamp(0.5 - 0.5*(d2+d1)/k, 0.0, 1.0)
 * d = mix(d2, -d1, h) + k*h*(1.0-h)
 * This subtracts d1 from d2 with smooth blending.
 *
 * Transform handling: Apply parent transform to p FIRST, then each child
 * applies only its local transform.
 */
function generateSmoothSubtract(node, ctx) {
  let children = node.children || [];
  const k = valueToGlsl(node.k || { type: 'const', value: 0.1 }, ctx);

  if (children.length === 0) {
    return 'vec4(1000.0, 1.0, 0.0, 1.0)';
  }

  // Apply parent transform to p first, then children use only local transforms
  const transformedP = applyTransform('p', node.transform, ctx);
  const hasParentTransform = node.transform && transformedP !== 'p';

  if (children.length === 1) {
    if (hasParentTransform) {
      const funcName = `smoothSubtract_${ctx.helperCounter++}`;
      const idParam = ctx.instanceIdParam;
      const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
      const callArgs = idParam ? `p, ${idParam}` : 'p';
      const childCallArgs = idParam ? `tp, ${idParam}` : 'tp';

      const childFuncName = `smoothSubtract_child_${ctx.helperCounter++}`;
      const childExpr = walkNode(children[0], ctx);
      ctx.helpers.push(`vec4 ${childFuncName}(${paramList}) {
  return ${childExpr};
}`);

      const helperFunc = `vec4 ${funcName}(${paramList}) {
  vec3 tp = ${transformedP};
  return ${childFuncName}(${childCallArgs});
}`;
      ctx.helpers.push(helperFunc);
      return `${funcName}(${callArgs})`;
    }
    return walkNode(children[0], ctx);
  }

  // Generate helper function for N children
  // First child is base, rest are subtracted from it with smooth blending
  const funcName = `smoothSubtract_${ctx.helperCounter++}`;
  const idParam = ctx.instanceIdParam;
  const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
  const callArgs = idParam ? `p, ${idParam}` : 'p';

  // If we have a parent transform, apply it first
  let bodyPrefix = '';
  let childP = 'p';
  if (hasParentTransform) {
    bodyPrefix = `  vec3 tp = ${transformedP};\n`;
    childP = 'tp';
  }

  const childCallArgs = idParam ? `${childP}, ${idParam}` : childP;

  // Generate a helper function for each child
  const childFuncNames = [];
  for (let i = 0; i < children.length; i++) {
    const childFuncName = `smoothSubtract_child_${ctx.helperCounter++}`;
    const childExpr = walkNode(children[i], ctx);
    ctx.helpers.push(`vec4 ${childFuncName}(${paramList}) {
  return ${childExpr};
}`);
    childFuncNames.push(childFuncName);
  }

  // Build the smooth subtract body
  // result = base (first child)
  // then for each cutter: result = smoothSubtract(result, cutter)
  let bodyLines = [];
  bodyLines.push(`  vec4 result = ${childFuncNames[0]}(${childCallArgs});`);

  for (let i = 1; i < childFuncNames.length; i++) {
    bodyLines.push(`  {`);
    bodyLines.push(`    vec4 cutter = ${childFuncNames[i]}(${childCallArgs});`);
    // IQ's smooth subtraction: subtract cutter from result
    bodyLines.push(`    float h = clamp(0.5 - 0.5 * (result.x + cutter.x) / ${k}, 0.0, 1.0);`);
    bodyLines.push(`    float d = mix(result.x, -cutter.x, h) + ${k} * h * (1.0 - h);`);
    // For color, use base color when carving
    bodyLines.push(`    result = vec4(d, result.yzw);`);
    bodyLines.push(`  }`);
  }

  bodyLines.push(`  return result;`);

  const helperFunc = `vec4 ${funcName}(${paramList}) {
${bodyPrefix}${bodyLines.join('\n')}
}`;

  ctx.helpers.push(helperFunc);

  return `${funcName}(${callArgs})`;
}

/**
 * Generate transform wrapper - propagates transform to child
 * LCD-003: Track rotation in context for mirror fix
 */
function generateTransform(node, ctx) {
  // LCD-003: Track rotation for mirror fix
  const savedAncestorRotation = ctx.ancestorRotation;
  const nodeRotation = extractRotation(node.transform);
  if (nodeRotation && isStaticRotation(nodeRotation)) {
    ctx.ancestorRotation = savedAncestorRotation
      ? addRotations(savedAncestorRotation, nodeRotation)
      : nodeRotation;
  }

  // Combine transforms and apply to child
  const childWithTransform = {
    ...node.child,
    transform: combineTransforms(node.child.transform, node.transform)
  };
  const result = walkNode(childWithTransform, ctx);

  // LCD-003: Restore ancestor rotation
  ctx.ancestorRotation = savedAncestorRotation;

  return result;
}

/**
 * Generate ref - expand definition with parameter overrides and parent transform
 * LCD-049: Optional boundingRadius for early-out optimization
 */
function generateRef(node, ctx) {
  // Get the processed definition
  let def = node.def;
  if (!def) {
    console.warn(`Ref node missing definition: ${node.refId}`);
    return 'vec4(1000.0, 1.0, 0.0, 1.0)';
  }

  // Apply parameter overrides if any (LCD-002)
  if (node.overrides) {
    def = applyParamOverrides(def, node.overrides);
  }

  // If this ref has a transform from parent, apply it to the def
  let innerSdf;
  if (node.transform) {
    const combined = combineTransforms(def.transform, node.transform);
    const defWithTransform = {
      ...def,
      transform: combined
    };
    innerSdf = walkNode(defWithTransform, ctx);
  } else {
    innerSdf = walkNode(def, ctx);
  }

  // LCD-049: Bounding sphere optimization - skip expensive SDF when ray is far
  if (node.boundingRadius && node.transform?.translate) {
    const t = node.transform.translate;
    let centerExpr;
    if (t.type === 'var') {
      centerExpr = `u_${t.name}`;
    } else if (Array.isArray(t)) {
      centerExpr = `vec3(${t.join(', ')})`;
    } else {
      // No simple center, skip bounding optimization
      return innerSdf;
    }
    const radius = node.boundingRadius;
    // Ternary: if outside bounding sphere, return cheap bound distance
    return `(length(p - ${centerExpr}) - ${radius.toFixed(2)} > 0.1 ? vec4(length(p - ${centerExpr}) - ${radius.toFixed(2)}, 0.5, 0.5, 0.5) : ${innerSdf})`;
  }

  return innerSdf;
}

/**
 * Apply parameter overrides to a definition node
 * Recursively substitutes { type: 'var', name: X } with override values
 * Also merges new override params into the root node's params
 */
function applyParamOverrides(def, overrides) {
  // Deep clone to avoid mutating the original definition
  const cloned = JSON.parse(JSON.stringify(def));

  // Recursively substitute var references
  const substituted = substituteVarRefs(cloned, overrides);

  // Merge override params into root node's params (allows overriding color, r, etc.)
  if (!substituted.params) substituted.params = {};
  for (const [key, value] of Object.entries(overrides)) {
    substituted.params[key] = value;
  }

  return substituted;
}

/**
 * Recursively substitute var references with override values
 * Handles processed nodes (type: 'var', name: X) from json-loader
 */
function substituteVarRefs(obj, overrides) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  // Check if this is a processed var reference
  if (obj.type === 'var' && obj.name && overrides.hasOwnProperty(obj.name)) {
    return overrides[obj.name];
  }

  // Arrays: substitute each element
  if (Array.isArray(obj)) {
    return obj.map(item => substituteVarRefs(item, overrides));
  }

  // Objects: substitute each property value
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = substituteVarRefs(value, overrides);
  }
  return result;
}

/**
 * Generate group
 */
function generateGroup(node, ctx) {
  // Apply group transform to all children
  const transformedChildren = (node.children || []).map(child => ({
    ...child,
    transform: combineTransforms(child.transform, node.transform)
  }));

  // Union all children
  return generateUnion({ type: 'union', children: transformedChildren }, ctx);
}

/**
 * Generate material wrapper - creates helper to override color and material properties
 * Supports: color, emit (emissive), metallic, roughness
 *
 * Output format: vec4(distance, r, g, b)
 * Material properties are encoded in the color channels using the following convention:
 * - RGB carries base color modulated by (1 + emit) for emission
 * - Future: Could pack metallic/roughness into alpha or additional output channels
 */
function generateMaterial(node, ctx) {
  // Propagate transform to child (fix: transform was being dropped)
  const childWithTransform = node.transform
    ? { ...node.child, transform: combineTransforms(node.child.transform, node.transform) }
    : node.child;
  const childExpr = walkNode(childWithTransform, ctx);
  const params = node.params || {};

  // If no material params specified, pass through
  if (!params.color && params.emit === undefined && params.metallic === undefined && params.roughness === undefined) {
    return childExpr;
  }

  // Generate helper to apply material
  const funcName = `material_${ctx.helperCounter++}`;
  const idParam = ctx.instanceIdParam;
  const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
  const callArgs = idParam ? `p, ${idParam}` : 'p';

  const color = params.color
    ? valueToGlsl(params.color, ctx)
    : 'c.yzw';

  const emit = params.emit !== undefined
    ? valueToGlsl(params.emit, ctx)
    : '0.0';

  // For now, metallic and roughness are stored but not used in the basic shader
  // They would be used in a PBR renderer
  const metallic = params.metallic !== undefined
    ? valueToGlsl(params.metallic, ctx)
    : '0.0';

  const roughness = params.roughness !== undefined
    ? valueToGlsl(params.roughness, ctx)
    : '0.5';

  // Apply emission boost to color (simple additive emission)
  const helperFunc = `vec4 ${funcName}(${paramList}) {
  vec4 c = ${childExpr};
  vec3 baseColor = ${color};
  float emissive = ${emit};
  // Apply emission as additive boost to color
  vec3 finalColor = baseColor * (1.0 + emissive * 2.0);
  return vec4(c.x, finalColor);
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(${callArgs})`;
}

/**
 * Generate mirror - reflection symmetry
 * axis can be "x", "y", "z", "xy", "xz", "yz", "xyz"
 *
 * Transform handling for domain modifiers:
 * 1. Apply parent transform (e.g., root rotation) to p FIRST
 * 2. Then apply mirror (abs) to the transformed point
 * 3. Child keeps only its own local transform
 *
 * LCD-003 FIX: When ancestor rotation exists, we must:
 * 1. Undo ancestor rotation to get to local space
 * 2. Apply abs() in local space
 * 3. Re-apply ancestor rotation to return to world space
 * This ensures mirror symmetry operates in local coordinates.
 */
function generateMirror(node, ctx) {
  const axis = node.axis || 'x';
  const idParam = ctx.instanceIdParam;
  const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
  const callArgs = idParam ? `p, ${idParam}` : 'p';
  const childCallArgs = idParam ? `q, ${idParam}` : 'q';

  // Apply mirror's own transform to p (if any)
  const rp = applyTransform('p', node.transform, ctx);

  // Child keeps only its own local transform (NOT propagated from parent)
  const child = node.child;

  // Wrap the child in its own helper function
  const childFuncName = `mirror_child_${ctx.helperCounter++}`;
  const childExpr = walkNode(child, ctx);
  ctx.helpers.push(`vec4 ${childFuncName}(${paramList}) {
  return ${childExpr};
}`);

  // Now generate the mirror wrapper
  const funcName = `mirror_${ctx.helperCounter++}`;

  // LCD-003 FIX: Check for ancestor rotation
  const ancestorRot = ctx.ancestorRotation;
  const hasAncestorRotation = ancestorRot && isStaticRotation(ancestorRot) &&
    (ancestorRot[0] !== 0 || ancestorRot[1] !== 0 || ancestorRot[2] !== 0);

  let mirrorCode = `  vec3 rp = ${rp};\n`;

  if (hasAncestorRotation) {
    // LCD-003: Undo ancestor rotation, apply abs in local space, redo rotation
    const localP = generateRotationGlsl('rp', ancestorRot, ctx, true);  // inverse
    mirrorCode += `  // LCD-003: Transform to local space for correct mirroring\n`;
    mirrorCode += `  vec3 localP = ${localP};\n`;
    mirrorCode += `  vec3 mirroredLocal = localP;\n`;
    if (axis.includes('x')) mirrorCode += '  mirroredLocal.x = abs(mirroredLocal.x);\n';
    if (axis.includes('y')) mirrorCode += '  mirroredLocal.y = abs(mirroredLocal.y);\n';
    if (axis.includes('z')) mirrorCode += '  mirroredLocal.z = abs(mirroredLocal.z);\n';
    // Rotate back to world space
    const worldP = generateRotationGlsl('mirroredLocal', ancestorRot, ctx, false);  // forward
    mirrorCode += `  vec3 q = ${worldP};\n`;
  } else {
    // Original behavior when no ancestor rotation
    mirrorCode += '  vec3 q = rp;\n';
    if (axis.includes('x')) mirrorCode += '  q.x = abs(q.x);\n';
    if (axis.includes('y')) mirrorCode += '  q.y = abs(q.y);\n';
    if (axis.includes('z')) mirrorCode += '  q.z = abs(q.z);\n';
  }

  const helperFunc = `vec4 ${funcName}(${paramList}) {
${mirrorCode}  return ${childFuncName}(${childCallArgs});
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(${callArgs})`;
}

/**
 * Generate radial - rotational symmetry around an axis
 * count: number of repetitions
 * axis: "x", "y", or "z" (default "y")
 *
 * Transform handling for domain modifiers:
 * 1. Apply parent transform (e.g., root rotation) to p FIRST
 * 2. Then apply radial folding to the transformed point
 * 3. Child keeps only its own local transform
 *
 * This ensures the radial symmetry operates in the rotated space,
 * so the entire radial assembly rotates as a unit.
 */
function generateRadial(node, ctx) {
  // Handle count as either a number or variable expression
  const countValue = node.count || { type: 'const', value: 6 };
  const countGlsl = valueToGlsl(countValue, ctx);
  const axis = node.axis || 'y';
  const idParam = ctx.instanceIdParam;
  const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
  const callArgs = idParam ? `p, ${idParam}` : 'p';
  const childCallArgs = idParam ? `q, ${idParam}` : 'q';

  // Apply parent transform to p FIRST, before the radial operation
  // This ensures root rotations are applied before radial folding
  const rp = applyTransform('p', node.transform, ctx);

  // Child keeps only its own local transform (NOT propagated from parent)
  // The parent transform was already applied above
  const child = node.child;

  // Wrap the child in its own helper function
  const childFuncName = `radial_child_${ctx.helperCounter++}`;
  const childExpr = walkNode(child, ctx);
  ctx.helpers.push(`vec4 ${childFuncName}(${paramList}) {
  return ${childExpr};
}`);

  // Now generate the radial wrapper
  const funcName = `radial_${ctx.helperCounter++}`;

  // Build radial fold code based on axis - apply AFTER parent transform
  // Segment is computed at runtime to support variable counts
  let radialCode;
  if (axis === 'y') {
    radialCode = `  vec3 rp = ${rp};
  float angle = atan(rp.z, rp.x);
  float segment = 6.283185 / ${countGlsl};
  angle = mod(angle + segment * 0.5, segment) - segment * 0.5;
  float r = length(rp.xz);
  vec3 q = vec3(r * cos(angle), rp.y, r * sin(angle));`;
  } else if (axis === 'x') {
    radialCode = `  vec3 rp = ${rp};
  float angle = atan(rp.z, rp.y);
  float segment = 6.283185 / ${countGlsl};
  angle = mod(angle + segment * 0.5, segment) - segment * 0.5;
  float r = length(rp.yz);
  vec3 q = vec3(rp.x, r * cos(angle), r * sin(angle));`;
  } else { // z
    radialCode = `  vec3 rp = ${rp};
  float angle = atan(rp.y, rp.x);
  float segment = 6.283185 / ${countGlsl};
  angle = mod(angle + segment * 0.5, segment) - segment * 0.5;
  float r = length(rp.xy);
  vec3 q = vec3(r * cos(angle), r * sin(angle), rp.z);`;
  }

  const helperFunc = `vec4 ${funcName}(${paramList}) {
${radialCode}
  return ${childFuncName}(${childCallArgs});
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(${callArgs})`;
}

/**
 * Generate repeat - infinite tiling
 * period: [x, y, z] - spacing between repetitions (0 = no repeat on that axis)
 * exposeId: optional variable name to expose instance ID for per-instance variation
 *
 * Supports variable references in period array, e.g.:
 *   period: [{ "var": "density" }, 2.0, { "var": "density" }]
 */
function generateRepeat(node, ctx) {
  const rawPeriod = node.period || [2, 0, 2];
  const exposeId = node.exposeId;  // e.g., "instanceId"

  // Handle IR array format: {type: 'array', values: [...]}
  const period = (rawPeriod && rawPeriod.type === 'array' && rawPeriod.values)
    ? rawPeriod.values
    : rawPeriod;

  // Apply any transform from the repeat node itself
  const p = applyTransform('p', node.transform, ctx);

  // Helper to check if a period component is statically zero
  // Handles both raw numbers and IR const objects
  function isStaticZero(v) {
    if (typeof v === 'number') return v === 0;
    if (v && v.type === 'const') return v.value === 0;
    return false;
  }

  // Helper to check if a period component is statically non-zero (can skip dynamic check)
  // Handles both raw numbers and IR const objects
  function isStaticNonZero(v) {
    if (typeof v === 'number') return v > 0;
    if (v && v.type === 'const') return v.value > 0;
    return false;
  }

  // Helper to get raw numeric value for static optimization
  function getRawValue(v) {
    if (typeof v === 'number') return v;
    if (v && v.type === 'const') return v.value;
    return null;
  }

  // Convert each period component to GLSL using valueToGlsl
  const p0 = valueToGlsl(period[0], ctx);
  const p1 = valueToGlsl(period[1], ctx);
  const p2 = valueToGlsl(period[2], ctx);

  // Build period vector string
  const periodVec = `vec3(${p0}, ${p1}, ${p2})`;

  // Build safe period vector for cell ID calculation (avoid division by zero)
  // For dynamic values, use max(value, 1.0) to ensure safe division
  function safeComponent(v, glsl) {
    if (isStaticZero(v)) return '1.0';
    if (isStaticNonZero(v)) return glsl;
    // Dynamic value - use max to ensure non-zero
    return `max(${glsl}, 0.001)`;
  }
  const safePeriodVec = `vec3(${safeComponent(period[0], p0)}, ${safeComponent(period[1], p1)}, ${safeComponent(period[2], p2)})`;

  // Build repeat code - for static zeros skip that axis, otherwise use dynamic mod
  let repeatCode = '';
  if (!isStaticZero(period[0])) {
    if (isStaticNonZero(period[0])) {
      // Static optimization: inline the half-period
      const half = (getRawValue(period[0]) / 2).toFixed(4);
      repeatCode += `  q.x = mod(q.x + ${half}, ${p0}) - ${half};\n`;
    } else {
      // Dynamic: compute half at runtime
      repeatCode += `  { float _hp = ${p0} * 0.5; q.x = mod(q.x + _hp, ${p0}) - _hp; }\n`;
    }
  }
  if (!isStaticZero(period[1])) {
    if (isStaticNonZero(period[1])) {
      const half = (getRawValue(period[1]) / 2).toFixed(4);
      repeatCode += `  q.y = mod(q.y + ${half}, ${p1}) - ${half};\n`;
    } else {
      repeatCode += `  { float _hp = ${p1} * 0.5; q.y = mod(q.y + _hp, ${p1}) - _hp; }\n`;
    }
  }
  if (!isStaticZero(period[2])) {
    if (isStaticNonZero(period[2])) {
      const half = (getRawValue(period[2]) / 2).toFixed(4);
      repeatCode += `  q.z = mod(q.z + ${half}, ${p2}) - ${half};\n`;
    } else {
      repeatCode += `  { float _hp = ${p2} * 0.5; q.z = mod(q.z + _hp, ${p2}) - _hp; }\n`;
    }
  }

  // If exposing instance ID, pass it through to nested helper functions
  if (exposeId) {
    // Set context so child helpers accept and pass the ID parameter
    ctx.localVars[exposeId] = exposeId;
    ctx.instanceIdParam = exposeId;

    // Generate child expression (will use exposeId variable and pass to nested helpers)
    const childExpr = walkNode(node.child, ctx);

    // Clear context
    delete ctx.localVars[exposeId];
    ctx.instanceIdParam = null;

    const funcName = `repeat_${ctx.helperCounter++}`;

    // Calculate instance ID before domain folding
    // Using prime multipliers for good hash distribution across 3D grid
    const helperFunc = `vec4 ${funcName}(vec3 p) {
  vec3 q = ${p};
  // Calculate instance ID from grid cell before domain folding
  // Use safePeriodVec to avoid division by zero on non-repeating axes
  vec3 _gridCell = floor(q / ${safePeriodVec});
  float ${exposeId} = dot(_gridCell, vec3(1.0, 157.0, 113.0));
${repeatCode}  return ${childExpr.replace(/\bp\b/g, 'q')};
}`;

    ctx.helpers.push(helperFunc);
    return `${funcName}(p)`;
  }

  // Standard repeat without instance ID - use separate child function
  const childFuncName = `repeat_child_${ctx.helperCounter++}`;
  const childExpr = walkNode(node.child, ctx);
  ctx.helpers.push(`vec4 ${childFuncName}(vec3 p) {
  return ${childExpr};
}`);

  const funcName = `repeat_${ctx.helperCounter++}`;

  const helperFunc = `vec4 ${funcName}(vec3 p) {
  vec3 q = ${p};
${repeatCode}  return ${childFuncName}(q);
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(p)`;
}

/**
 * Generate select - conditional SDF selection
 * Evaluates ONLY the selected branch based on condition
 * cond < 0.5 → return a
 * cond >= 0.5 → return b
 *
 * This is the correct way to do per-instance type selection in SDF.
 * Unlike translation hacks (±1000 units), this properly handles the
 * distance field without discontinuities or raymarching artifacts.
 */
function generateSelect(node, ctx) {
  const condExpr = valueToGlsl(node.cond, ctx);

  // Generate both child expressions
  const aExpr = walkNode(node.a, ctx);
  const bExpr = walkNode(node.b, ctx);

  const funcName = `select_${ctx.helperCounter++}`;
  const idParam = ctx.instanceIdParam;
  const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
  const callArgs = idParam ? `p, ${idParam}` : 'p';

  // Use mix with step for branchless selection
  // When cond >= 0.5, step returns 1.0, so we get b
  // When cond < 0.5, step returns 0.0, so we get a
  const helperFunc = `vec4 ${funcName}(${paramList}) {
  float sel = step(0.5, ${condExpr});
  vec4 va = ${aExpr};
  vec4 vb = ${bExpr};
  return mix(va, vb, sel);
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(${callArgs})`;
}

/**
 * Generate scaled node wrapper - implements SDF-correct scaling per IQ's guidance
 *
 * From Inigo Quilez (https://iquilezles.org/articles/distfunctions/):
 *   float opScale(vec3 p, float s, sdf3d primitive) {
 *     return primitive(p/s) * s;
 *   }
 *
 * For uniform scale: multiply distance by s (exact)
 * For non-uniform scale: multiply distance by min(s.x, s.y, s.z) (conservative bound)
 *
 * As IQ notes: "Non uniform scaling is not possible (while still getting a correct SDF)"
 * The min(s) approach gives a conservative bound that prevents raymarcher overshoot.
 */
function generateScaledNode(node, ctx) {
  const scale = node.transform.scale;

  // Parse scale values
  let scaleVec;
  if (scale.type === 'array' && scale.values) {
    // Expression-based scale from IR (e.g., from processValue)
    scaleVec = scale.values.map(v => valueToGlsl(v, ctx));
    // Handle single-element array as uniform scale
    if (scaleVec.length === 1) {
      scaleVec = [scaleVec[0], scaleVec[0], scaleVec[0]];
    }
  } else if (Array.isArray(scale)) {
    // Direct array in JSON (static or expression values)
    scaleVec = scale.map(v => (typeof v === 'number' ? v.toFixed(6) : valueToGlsl(v, ctx)));
    // Handle single-element array as uniform scale
    if (scaleVec.length === 1) {
      scaleVec = [scaleVec[0], scaleVec[0], scaleVec[0]];
    }
  } else if (typeof scale === 'number') {
    // Uniform scale shorthand
    const s = scale.toFixed(6);
    scaleVec = [s, s, s];
  } else if (typeof scale === 'object' && scale !== null) {
    // Variable reference or expression object - uniform scale
    const s = valueToGlsl(scale, ctx);
    scaleVec = [s, s, s];
  } else {
    // Fallback
    scaleVec = ['1.0', '1.0', '1.0'];
  }

  const sx = scaleVec[0];
  const sy = scaleVec[1];
  const sz = scaleVec[2];
  const scaleVecGlsl = `vec3(${sx}, ${sy}, ${sz})`;

  // Check if uniform scale (all components equal)
  const isUniform = sx === sy && sy === sz;

  // Scale factor for distance correction
  // Uniform: multiply by scale (exact)
  // Non-uniform: multiply by min(scale) (conservative bound)
  let scaleFactor;
  if (isUniform) {
    scaleFactor = sx;
  } else {
    scaleFactor = `min(${sx}, min(${sy}, ${sz}))`;
  }

  // Create node with NO transform - we'll handle all transforms in the wrapper
  // This ensures correct transform order: translate -> rotate -> scale
  const bareNode = { ...node };
  delete bareNode.transform;

  // Generate helper function for scaled SDF
  const funcName = `scaled_${ctx.helperCounter++}`;
  const idParam = ctx.instanceIdParam;
  const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
  const callArgs = idParam ? `p, ${idParam}` : 'p';

  // Generate child SDF code with bare node (no transforms)
  const childExpr = walkNode(bareNode, ctx);

  // Build the correct transform order:
  // Object-space: scale -> rotate -> translate
  // Inverse (for point): translate -> rotate -> scale
  //
  // Per IQ: for SDF, we apply inverse transform to the point
  let transformedP = 'p';

  // 1. First: translate (subtract translation)
  if (node.transform.translate) {
    const t = valueToGlsl(node.transform.translate, ctx);
    transformedP = `(${transformedP} - ${t})`;
  }

  // 2. Then: rotate (apply inverse rotation)
  // Handle all rotation types from the original transform
  const origTransform = node.transform;
  if (origTransform.rotateQ) {
    const q = origTransform.rotateQ;
    let qx, qy, qz, qw;
    if (q.type === 'array' && q.values) {
      qx = valueToGlsl(q.values[0], ctx);
      qy = valueToGlsl(q.values[1], ctx);
      qz = valueToGlsl(q.values[2], ctx);
      qw = valueToGlsl(q.values[3], ctx);
    } else if (Array.isArray(q) && q.length >= 4) {
      qx = (q[0] || 0).toFixed(6);
      qy = (q[1] || 0).toFixed(6);
      qz = (q[2] || 0).toFixed(6);
      qw = (q[3] || 1).toFixed(6);
    }
    if (qx !== undefined) {
      transformedP = `rotQ(${transformedP}, vec4(${qx}, ${qy}, ${qz}, ${qw}))`;
    }
  } else if (origTransform.rotateAxis) {
    const aa = origTransform.rotateAxis;
    const axis = aa.axis || [0, 1, 0];
    const angle = aa.angle || 0;
    let axisGlsl;
    if (axis.type === 'array' && axis.values) {
      const ax = valueToGlsl(axis.values[0], ctx);
      const ay = valueToGlsl(axis.values[1], ctx);
      const az = valueToGlsl(axis.values[2], ctx);
      axisGlsl = `vec3(${ax}, ${ay}, ${az})`;
    } else if (Array.isArray(axis)) {
      axisGlsl = `vec3(${(axis[0] || 0).toFixed(6)}, ${(axis[1] || 1).toFixed(6)}, ${(axis[2] || 0).toFixed(6)})`;
    } else {
      axisGlsl = 'vec3(0.0, 1.0, 0.0)';
    }
    let angleGlsl;
    if (typeof angle === 'object') {
      angleGlsl = `(${valueToGlsl(angle, ctx)} * 0.017453)`;
    } else {
      const DEG2RAD = Math.PI / 180;
      angleGlsl = ((angle || 0) * DEG2RAD).toFixed(6);
    }
    transformedP = `rotAxisAngle(${transformedP}, ${axisGlsl}, ${angleGlsl})`;
  } else if (origTransform.rotate) {
    const rot = origTransform.rotate;
    let rx, ry, rz;
    if (rot.type === 'array' && rot.values) {
      rx = `(${valueToGlsl(rot.values[0], ctx)} * 0.017453)`;
      ry = `(${valueToGlsl(rot.values[1], ctx)} * 0.017453)`;
      rz = `(${valueToGlsl(rot.values[2], ctx)} * 0.017453)`;
    } else if (Array.isArray(rot)) {
      const DEG2RAD = Math.PI / 180;
      rx = ((rot[0] || 0) * DEG2RAD).toFixed(6);
      ry = ((rot[1] || 0) * DEG2RAD).toFixed(6);
      rz = ((rot[2] || 0) * DEG2RAD).toFixed(6);
    }
    if (rx !== undefined) {
      // Apply rotations: for inverse of XYZ order, apply Z then Y then X
      transformedP = `rotZ(${transformedP}, ${rz})`;
      transformedP = `rotY(${transformedP}, ${ry})`;
      transformedP = `rotX(${transformedP}, ${rx})`;
    }
  }

  // 3. Finally: scale (divide by scale - innermost transform)
  transformedP = `(${transformedP} / ${scaleVecGlsl})`;

  const helperFunc = `vec4 ${funcName}(${paramList}) {
  // SDF scale with correct transform order: translate -> rotate -> scale
  // Per IQ: primitive(p/s) * s, but p must first have translate/rotate applied
  vec3 tp = ${transformedP};
  vec4 c = ${childExpr.replace(/\bp\b/g, 'tp')};
  return vec4(c.x * ${scaleFactor}, c.yzw);
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(${callArgs})`;
}

/**
 * Generate round modifier - adds radius to soften edges
 * round(sdf) = sdf - r
 */
function generateRound(node, ctx) {
  const childExpr = walkNode(node.child, ctx);
  const r = node.r !== undefined ? valueToGlsl(node.r, ctx) : '0.05';

  const funcName = `round_${ctx.helperCounter++}`;
  const idParam = ctx.instanceIdParam;
  const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
  const callArgs = idParam ? `p, ${idParam}` : 'p';
  const p = applyTransform('p', node.transform, ctx);

  const helperFunc = `vec4 ${funcName}(${paramList}) {
  vec4 c = ${childExpr.replace(/\bp\b/g, `(${p})`)};
  return vec4(c.x - ${r}, c.yzw);
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(${callArgs})`;
}

/**
 * Generate shell modifier - hollows out shape with wall thickness
 * shell(sdf) = abs(sdf) - thickness
 */
function generateShell(node, ctx) {
  const childExpr = walkNode(node.child, ctx);
  const thickness = node.thickness !== undefined ? valueToGlsl(node.thickness, ctx) : '0.05';

  const funcName = `shell_${ctx.helperCounter++}`;
  const idParam = ctx.instanceIdParam;
  const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
  const callArgs = idParam ? `p, ${idParam}` : 'p';
  const p = applyTransform('p', node.transform, ctx);

  const helperFunc = `vec4 ${funcName}(${paramList}) {
  vec4 c = ${childExpr.replace(/\bp\b/g, `(${p})`)};
  return vec4(abs(c.x) - ${thickness}, c.yzw);
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(${callArgs})`;
}

/**
 * Generate displace modifier - displaces surface using noise
 * Params:
 *   - amount: displacement strength (default 0.1)
 *   - scale: noise frequency (default 3.0)
 *   - octaves: noise detail level (default 4)
 *   - animate: multiply scale by time for animated noise
 */
function generateDisplace(node, ctx) {
  const childExpr = walkNode(node.child, ctx);
  const amount = node.amount !== undefined ? valueToGlsl(node.amount, ctx) : '0.1';
  const scale = node.scale !== undefined ? valueToGlsl(node.scale, ctx) : '3.0';
  // Octaves must be int in GLSL - raw numbers should NOT have .0 suffix
  // valueToGlsl converts integers to floats (e.g., 2 -> '2.0'), which breaks fbm/turbulence
  const octaves = node.octaves !== undefined
    ? (typeof node.octaves === 'number' ? String(Math.floor(node.octaves)) : `int(${valueToGlsl(node.octaves, ctx)})`)
    : '4';
  const noiseType = node.noiseType || 'fbm'; // 'noise', 'fbm', or 'turbulence'

  const funcName = `displace_${ctx.helperCounter++}`;
  const idParam = ctx.instanceIdParam;
  const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
  const callArgs = idParam ? `p, ${idParam}` : 'p';
  const p = applyTransform('p', node.transform, ctx);

  // Choose noise function based on type
  let noiseCall;
  if (noiseType === 'noise') {
    noiseCall = `noise3(np)`;
  } else if (noiseType === 'turbulence') {
    noiseCall = `turbulence(np, ${octaves})`;
  } else {
    noiseCall = `fbm(np, ${octaves})`;
  }

  // Support animated noise
  const timeOffset = node.animate ? ' + u_time * 0.5' : '';
  ctx.uniforms.add('u_time');

  const helperFunc = `vec4 ${funcName}(${paramList}) {
  vec3 np = (${p}) * ${scale}${timeOffset};
  float disp = (${noiseCall} - 0.5) * 2.0 * ${amount};
  vec4 c = ${childExpr.replace(/\bp\b/g, `(${p})`)};
  return vec4(c.x + disp, c.yzw);
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(${callArgs})`;
}

/**
 * Generate customExpr - raw GLSL expression stored as base64
 * The glsl field should contain a base64-encoded string that decodes to valid GLSL
 * returning vec4(distance, r, g, b)
 *
 * Example JSON:
 * {
 *   "type": "customExpr",
 *   "glsl": "dmVjNChsZW5ndGgocCkgLSAwLjUsIDEuMCwgMC41LCAwLjIp"
 * }
 * (decodes to: vec4(length(p) - 0.5, 1.0, 0.5, 0.2))
 */
function generateCustomExpr(node, ctx) {
  const encoded = node.glsl || '';

  // Decode base64 to GLSL string
  let glslCode;
  try {
    glslCode = atob(encoded);
  } catch (e) {
    console.warn('Failed to decode customExpr base64:', e);
    return 'vec4(1000.0, 1.0, 0.0, 1.0)';
  }

  // Apply any transform from the node
  const p = applyTransform('p', node.transform, ctx);

  // Generate helper function with the custom code
  const funcName = `custom_${ctx.helperCounter++}`;
  const idParam = ctx.instanceIdParam;
  const paramList = idParam ? `vec3 p, float ${idParam}` : 'vec3 p';
  const callArgs = idParam ? `p, ${idParam}` : 'p';

  // If the expression uses u_time, ensure uniform is declared
  if (glslCode.includes('u_time')) {
    ctx.uniforms.add('u_time');
  }

  const helperFunc = `vec4 ${funcName}(${paramList}) {
  vec3 q = ${p};
  return ${glslCode.replace(/\bp\b/g, 'q')};
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(${callArgs})`;
}

/**
 * Convert a value to GLSL expression
 */
function valueToGlsl(value, ctx) {
  if (value === null || value === undefined) return '0.0';

  // Raw number (most common case)
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return value + '.0';
    }
    return String(value);
  }

  // Raw JS array like [0, 1, 2] or [0, { "var": "foo" }, 0]
  if (Array.isArray(value)) {
    const components = value.map(v => valueToGlsl(v, ctx));
    return `vec${components.length}(${components.join(', ')})`;
  }

  // Object with explicit type field
  switch (value.type) {
    case 'const':
      // Ensure floats have decimal point for GLSL
      const num = value.value;
      if (Number.isInteger(num)) {
        return num + '.0';
      }
      return String(num);

    case 'var':
      // Check local scoped variables first (e.g., instance IDs from repeat)
      if (ctx.localVars && ctx.localVars[value.name]) {
        return ctx.localVars[value.name];
      }
      // Check scene params (already registered as uniforms)
      if (ctx.sceneParams && ctx.sceneParams[value.name]) {
        return `u_${value.name}`;
      }
      // Fall back to dynamic uniform (e.g., time)
      // Only add if not already typed (e.g., phys_ uniforms are pre-declared as vec3)
      const varUniformName = `u_${value.name}`;
      const varHasTyped = [...ctx.uniforms].some(u => u.startsWith(varUniformName + ':'));
      if (!varHasTyped) {
        ctx.uniforms.add(varUniformName);
      }
      return varUniformName;

    case 'array':
      const components = value.values.map(v => valueToGlsl(v, ctx));
      return `vec${components.length}(${components.join(', ')})`;

    case 'expr':
      return exprToGlsl(value, ctx);

    default:
      break;
  }

  // Inline { var: "name" } without explicit type field
  if (value.var) {
    if (ctx.localVars && ctx.localVars[value.var]) {
      return ctx.localVars[value.var];
    }
    if (ctx.sceneParams && ctx.sceneParams[value.var]) {
      return `u_${value.var}`;
    }
    // Only add uniform if not already typed (e.g., phys_ uniforms are pre-declared as vec3)
    const uniformName = `u_${value.var}`;
    const hasTypedVersion = [...ctx.uniforms].some(u => u.startsWith(uniformName + ':'));
    if (!hasTypedVersion) {
      ctx.uniforms.add(uniformName);
    }
    return uniformName;
  }

  // Inline { expr: "op", args: [...] } without explicit type field
  if (value.expr) {
    return exprToGlsl({ op: value.expr, args: value.args }, ctx);
  }

  return '0.0';
}

/**
 * Convert expression to GLSL
 */
function exprToGlsl(expr, ctx) {
  const args = (expr.args || []).map(arg => valueToGlsl(arg, ctx));

  switch (expr.op) {
    case 'add': return `(${args.join(' + ')})`;
    case 'sub': return `(${args[0]} - ${args[1]})`;
    case 'mul': return `(${args.join(' * ')})`;
    case 'div': return `(${args[0]} / ${args[1]})`;
    case 'mod': return `mod(${args[0]}, ${args[1]})`;
    case 'abs': return `abs(${args[0]})`;
    case 'floor': return `floor(${args[0]})`;
    case 'ceil': return `ceil(${args[0]})`;
    case 'fract': return `fract(${args[0]})`;
    case 'sin': return `sin(${args[0]})`;
    case 'cos': return `cos(${args[0]})`;
    case 'tan': return `tan(${args[0]})`;
    case 'min': return `min(${args.join(', ')})`;
    case 'max': return `max(${args.join(', ')})`;
    case 'neg': return `(-${args[0]})`;
    case 'clamp': return `clamp(${args[0]}, ${args[1]}, ${args[2]})`;
    case 'step': return `step(${args[0]}, ${args[1]})`;
    case 'smoothstep': return `smoothstep(${args[0]}, ${args[1]}, ${args[2]})`;
    case 'mix': return `mix(${args[0]}, ${args[1]}, ${args[2]})`;
    // Noise functions - demoscene effects
    case 'noise': return `noise3(vec3(${args.join(', ')}))`;
    case 'fbm': return `fbm(vec3(${args[0]}, ${args[1]}, ${args[2]}), ${args[3] || '4'})`;
    case 'turbulence': return `turbulence(vec3(${args[0]}, ${args[1]}, ${args[2]}), ${args[3] || '4'})`;
    case 'hash': return `hash(${args[0]})`;
    default:
      console.warn(`Unknown expression op: ${expr.op}`);
      return '0.0';
  }
}

/**
 * Apply transform to position variable
 * Order: translate first, then rotate (applied in reverse for SDF)
 *
 * Transform priority: mat4 > rotateQ > rotateAxis > rotate
 * - mat4: 4x4 matrix (16-element array, column-major)
 * - rotateQ: quaternion [x, y, z, w] (glTF convention)
 * - rotateAxis: { axis: [x, y, z], angle: degrees }
 * - rotate: Euler angles [rx, ry, rz] in degrees, XYZ order
 */
function applyTransform(pVar, transform, ctx) {
  if (!transform) return pVar;

  let result = pVar;

  // Priority 0: Direct 4x4 matrix transform (overrides everything else)
  if (transform.mat4) {
    const mat = transform.mat4;
    // mat4 should be 16 values in column-major order
    // For SDF, we apply the inverse transform to the point
    // Since we want p' = M^-1 * p, we use transformMat4Inverse
    const matValues = mat.map(v => valueToGlsl(v, ctx)).join(', ');
    return `transformMat4Inverse(${pVar}, mat4(${matValues}))`;
  }

  // Apply translate first (subtract from position)
  if (transform.translate) {
    const t = valueToGlsl(transform.translate, ctx);
    result = `(${result} - ${t})`;
  }

  // Priority 1: Quaternion rotation (rotateQ)
  // Format: [x, y, z, w] - glTF convention
  if (transform.rotateQ) {
    const q = transform.rotateQ;
    if (q.type === 'array' && q.values) {
      // Expression-based quaternion
      const qx = valueToGlsl(q.values[0], ctx);
      const qy = valueToGlsl(q.values[1], ctx);
      const qz = valueToGlsl(q.values[2], ctx);
      const qw = valueToGlsl(q.values[3], ctx);
      result = `rotQ(${result}, vec4(${qx}, ${qy}, ${qz}, ${qw}))`;
    } else if (Array.isArray(q) && q.length >= 4) {
      // Static quaternion values
      const qx = (q[0] || 0).toFixed(6);
      const qy = (q[1] || 0).toFixed(6);
      const qz = (q[2] || 0).toFixed(6);
      const qw = (q[3] || 1).toFixed(6);
      result = `rotQ(${result}, vec4(${qx}, ${qy}, ${qz}, ${qw}))`;
    }
  }
  // Priority 2: Axis-angle rotation (rotateAxis)
  // Format: { axis: [x, y, z], angle: degrees }
  else if (transform.rotateAxis) {
    const aa = transform.rotateAxis;
    const axis = aa.axis || [0, 1, 0];
    const angle = aa.angle || 0;

    // Handle axis
    let axisGlsl;
    if (axis.type === 'array' && axis.values) {
      const ax = valueToGlsl(axis.values[0], ctx);
      const ay = valueToGlsl(axis.values[1], ctx);
      const az = valueToGlsl(axis.values[2], ctx);
      axisGlsl = `vec3(${ax}, ${ay}, ${az})`;
    } else if (Array.isArray(axis)) {
      axisGlsl = `vec3(${(axis[0] || 0).toFixed(6)}, ${(axis[1] || 1).toFixed(6)}, ${(axis[2] || 0).toFixed(6)})`;
    } else {
      axisGlsl = 'vec3(0.0, 1.0, 0.0)';
    }

    // Handle angle (degrees to radians)
    let angleGlsl;
    if (typeof angle === 'object') {
      angleGlsl = wrapDegreesToRadians(valueToGlsl(angle, ctx));
    } else {
      const DEG2RAD = Math.PI / 180;
      angleGlsl = ((angle || 0) * DEG2RAD).toFixed(6);
    }

    result = `rotAxisAngle(${result}, ${axisGlsl}, ${angleGlsl})`;
  }
  // Priority 3: Euler angles (rotate)
  // Format: [rx, ry, rz] in degrees, applied in XYZ order
  else if (transform.rotate) {
    const rot = transform.rotate;
    // Handle both static and expression-based rotations
    if (rot.type === 'array' && rot.values) {
      // Explicit expression-based rotation - wrap in radians conversion
      const rx = wrapDegreesToRadians(valueToGlsl(rot.values[0], ctx));
      const ry = wrapDegreesToRadians(valueToGlsl(rot.values[1], ctx));
      const rz = wrapDegreesToRadians(valueToGlsl(rot.values[2], ctx));
      // Apply rotations in XYZ order (X first, then Y, then Z)
      // For SDF point transform: apply in reverse order to the point
      result = `rotZ(${result}, ${rz})`;
      result = `rotY(${result}, ${ry})`;
      result = `rotX(${result}, ${rx})`;
    } else if (Array.isArray(rot)) {
      // Check if any element is an expression (object with var/expr)
      const hasExpressions = rot.some(v => typeof v === 'object' && v !== null);
      if (hasExpressions) {
        // Array contains expressions - use valueToGlsl for each element
        const rx = wrapDegreesToRadians(valueToGlsl(rot[0], ctx));
        const ry = wrapDegreesToRadians(valueToGlsl(rot[1], ctx));
        const rz = wrapDegreesToRadians(valueToGlsl(rot[2], ctx));
        result = `rotZ(${result}, ${rz})`;
        result = `rotY(${result}, ${ry})`;
        result = `rotX(${result}, ${rx})`;
      } else {
        // Static rotation values - convert degrees to radians at compile time
        const DEG2RAD = Math.PI / 180;
        const rx = ((rot[0] || 0) * DEG2RAD).toFixed(6);
        const ry = ((rot[1] || 0) * DEG2RAD).toFixed(6);
        const rz = ((rot[2] || 0) * DEG2RAD).toFixed(6);
        // Apply rotations in XYZ order (X first, then Y, then Z)
        result = `rotZ(${result}, ${rz})`;
        result = `rotY(${result}, ${ry})`;
        result = `rotX(${result}, ${rx})`;
      }
    }
  }

  // Note: Scale is NOT applied here in applyTransform
  // Scale requires modifying the returned DISTANCE, not just the point
  // Scale handling is done at the node level via generateScaledNode() in walkNode()

  return result;
}

/**
 * Wrap a GLSL expression with degrees-to-radians conversion
 */
function wrapDegreesToRadians(glslExpr) {
  // If it's a constant 0, skip the conversion
  if (glslExpr === '0.0' || glslExpr === '0') return '0.0';
  return `(${glslExpr} * 0.017453)`;  // π/180 ≈ 0.017453
}

/**
 * Combine two transforms - translations are added, rotations are composed
 *
 * Transform handling:
 * - mat4: child takes precedence (composition is complex)
 * - rotateQ/rotateAxis: child takes precedence (no composition)
 * - rotate (Euler): additive composition (approximation for small angles)
 */
function combineTransforms(child, parent) {
  if (!parent) return child;
  if (!child) return parent;

  const combined = { ...parent };

  // mat4 takes highest precedence - if child has mat4, use it exclusively
  if (child.mat4) {
    return { mat4: child.mat4 };
  }
  // If parent has mat4 and child doesn't have mat4, parent mat4 is overridden by child transforms
  if (parent.mat4 && !child.mat4) {
    // Discard parent mat4, use child transforms
    delete combined.mat4;
  }

  // Combine translations additively
  if (parent.translate && child.translate) {
    combined.translate = addValues(parent.translate, child.translate);
  } else if (child.translate) {
    combined.translate = child.translate;
  }

  // Quaternion rotation: child takes precedence (proper composition is complex)
  if (child.rotateQ) {
    combined.rotateQ = child.rotateQ;
    delete combined.rotateAxis;
    delete combined.rotate;
  } else if (parent.rotateQ) {
    // Keep parent's quaternion
  }
  // Axis-angle rotation: child takes precedence
  else if (child.rotateAxis) {
    combined.rotateAxis = child.rotateAxis;
    delete combined.rotate;
  } else if (parent.rotateAxis) {
    // Keep parent's axis-angle
  }
  // Euler rotations: additive composition (approximation for small angles)
  else if (parent.rotate && child.rotate) {
    combined.rotate = addRotations(parent.rotate, child.rotate);
  } else if (child.rotate) {
    combined.rotate = child.rotate;
  }

  // Scale: child takes precedence
  // Note: proper scale composition would require multiplying scales component-wise
  // AND scaling parent translations by child scale - complex, so child wins for now
  if (child.scale) combined.scale = child.scale;

  return combined;
}

/**
 * Add two rotation arrays (Euler angles)
 */
function addRotations(a, b) {
  // Handle both raw arrays and IR objects
  const aVals = Array.isArray(a) ? a : (a.values || [0, 0, 0]);
  const bVals = Array.isArray(b) ? b : (b.values || [0, 0, 0]);

  // If both are simple arrays of numbers, add directly
  if (aVals.every(v => typeof v === 'number') && bVals.every(v => typeof v === 'number')) {
    return [
      (aVals[0] || 0) + (bVals[0] || 0),
      (aVals[1] || 0) + (bVals[1] || 0),
      (aVals[2] || 0) + (bVals[2] || 0)
    ];
  }

  // If they contain expressions, create additive expressions
  return {
    type: 'array',
    values: [0, 1, 2].map(i => ({
      type: 'expr',
      op: 'add',
      args: [
        normalizeRotationComponent(aVals[i]),
        normalizeRotationComponent(bVals[i])
      ]
    }))
  };
}

/**
 * Normalize a rotation component to IR format
 */
function normalizeRotationComponent(val) {
  if (val === undefined || val === null) return { type: 'const', value: 0 };
  if (typeof val === 'number') return { type: 'const', value: val };
  return val; // Already an IR object
}

/**
 * Extract Euler rotation from a transform (LCD-003 fix)
 * Returns [x, y, z] in degrees or null if no rotation
 */
function extractRotation(transform) {
  if (!transform) return null;
  if (transform.rotate) {
    const rot = transform.rotate;
    // Handle both array and IR object formats
    if (Array.isArray(rot)) return rot;
    if (rot.values) return rot.values;
    if (rot.type === 'array') return rot.values;
  }
  // TODO: Handle rotateQ and rotateAxis if needed
  return null;
}

/**
 * Check if rotation contains only static (non-expression) values
 */
function isStaticRotation(rot) {
  if (!rot) return true;
  return rot.every(v => typeof v === 'number');
}

/**
 * Generate GLSL to rotate point by Euler angles (XYZ order, degrees)
 * @param {string} pVar - variable name for the point
 * @param {Array} rot - [x, y, z] rotation in degrees
 * @param {Object} ctx - codegen context
 * @param {boolean} inverse - if true, apply inverse rotation (ZYX order, negated angles)
 * @returns {string} - GLSL expression for rotated point
 */
function generateRotationGlsl(pVar, rot, ctx, inverse = false) {
  if (!rot || rot.every(v => v === 0)) return pVar;

  const [rx, ry, rz] = rot;
  const toRad = Math.PI / 180;

  let result = pVar;

  if (inverse) {
    // Inverse: apply in reverse order (ZYX) with negated angles
    if (rz !== 0) {
      const angle = typeof rz === 'number' ? (-rz * toRad).toFixed(6) : `(-${valueToGlsl(rz, ctx)} * 0.017453)`;
      result = `rotZ(${result}, ${angle})`;
    }
    if (ry !== 0) {
      const angle = typeof ry === 'number' ? (-ry * toRad).toFixed(6) : `(-${valueToGlsl(ry, ctx)} * 0.017453)`;
      result = `rotY(${result}, ${angle})`;
    }
    if (rx !== 0) {
      const angle = typeof rx === 'number' ? (-rx * toRad).toFixed(6) : `(-${valueToGlsl(rx, ctx)} * 0.017453)`;
      result = `rotX(${result}, ${angle})`;
    }
  } else {
    // Forward: apply in XYZ order
    if (rx !== 0) {
      const angle = typeof rx === 'number' ? (rx * toRad).toFixed(6) : `(${valueToGlsl(rx, ctx)} * 0.017453)`;
      result = `rotX(${result}, ${angle})`;
    }
    if (ry !== 0) {
      const angle = typeof ry === 'number' ? (ry * toRad).toFixed(6) : `(${valueToGlsl(ry, ctx)} * 0.017453)`;
      result = `rotY(${result}, ${angle})`;
    }
    if (rz !== 0) {
      const angle = typeof rz === 'number' ? (rz * toRad).toFixed(6) : `(${valueToGlsl(rz, ctx)} * 0.017453)`;
      result = `rotZ(${result}, ${angle})`;
    }
  }

  return result;
}

/**
 * Add two IR values (creates expression node for GLSL addition)
 */
function addValues(a, b) {
  // Both are array type with values
  if (a.type === 'array' && b.type === 'array') {
    return {
      type: 'array',
      values: a.values.map((av, i) => ({
        type: 'expr',
        op: 'add',
        args: [av, b.values[i]]
      }))
    };
  }
  // Fallback for scalar addition
  return {
    type: 'expr',
    op: 'add',
    args: [a, b]
  };
}

/**
 * Generate primitive SDF functions
 */
function generatePrimitiveFunctions() {
  return `
// Primitive SDFs
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float sdCylinder(vec3 p, float h, float r) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdCapsule(vec3 p, float h, float r) {
  p.y -= clamp(p.y, -h, h);
  return length(p) - r;
}

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}

float sdCone(vec3 p, float h, float r) {
  // Cone with tip at origin, base at y=-h, base radius r
  vec2 q = vec2(length(p.xz), -p.y);
  vec2 tip = vec2(0.0, 0.0);
  vec2 base = vec2(r, h);
  vec2 e = base - tip;
  vec2 w = q - tip;
  vec2 d1 = q - base * clamp(dot(q, base) / dot(base, base), 0.0, 1.0);
  vec2 d2 = q - vec2(clamp(q.x, 0.0, r), h);
  float s = max(dot(w, vec2(e.y, -e.x)), q.y - h);
  return sqrt(min(dot(d1, d1), dot(d2, d2))) * sign(s);
}

// Truncated cone / frustum / round cone
// r1 = bottom radius (at y=0), r2 = top radius (at y=h), h = height
// r1 end at origin, extends upward to r2 end at y=h
float sdRoundCone(vec3 p, float r1, float r2, float h) {
  vec2 q = vec2(length(p.xz), p.y);

  float b = (r1 - r2) / h;
  float a = sqrt(1.0 - b * b);
  float k = dot(q, vec2(-b, a));

  if (k < 0.0) return length(q) - r1;
  if (k > a * h) return length(q - vec2(0.0, h)) - r2;

  return dot(q, vec2(a, b)) - r1;
}

float sdPlane(vec3 p, vec3 n, float h) {
  return dot(p, normalize(n)) + h;
}

`;
}

/**
 * Generate helper functions
 */
function generateHelperFunctions() {
  return `
// Smooth min for smooth union
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

// Rotation matrices - rotate point around axis by angle (radians)
vec3 rotX(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z);
}

vec3 rotY(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);
}

vec3 rotZ(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c*p.x - s*p.y, s*p.x + c*p.y, p.z);
}

// Quaternion rotation - q is [x, y, z, w] (glTF convention)
vec3 rotQ(vec3 p, vec4 q) {
  // Normalize quaternion
  q = normalize(q);
  // Apply rotation: p' = q * p * q^-1
  vec3 t = 2.0 * cross(q.xyz, p);
  return p + q.w * t + cross(q.xyz, t);
}

// Axis-angle rotation - axis should be normalized, angle in radians
vec3 rotAxisAngle(vec3 p, vec3 axis, float angle) {
  float c = cos(angle), s = sin(angle);
  float oc = 1.0 - c;
  vec3 a = normalize(axis);
  mat3 m = mat3(
    oc * a.x * a.x + c,       oc * a.x * a.y - a.z * s, oc * a.x * a.z + a.y * s,
    oc * a.x * a.y + a.z * s, oc * a.y * a.y + c,       oc * a.y * a.z - a.x * s,
    oc * a.x * a.z - a.y * s, oc * a.y * a.z + a.x * s, oc * a.z * a.z + c
  );
  return m * p;
}

// Transform point by inverse of 4x4 matrix
// For affine transforms (rotation + translation), inverse = transpose of 3x3 part, then transform
vec3 transformMat4Inverse(vec3 p, mat4 m) {
  // Extract rotation (upper-left 3x3) and translation (last column)
  vec3 trans = vec3(m[3][0], m[3][1], m[3][2]);
  // Manual transpose of 3x3 rotation part (WebGL 1 compatible)
  mat3 rotT = mat3(
    m[0][0], m[1][0], m[2][0],
    m[0][1], m[1][1], m[2][1],
    m[0][2], m[1][2], m[2][2]
  );
  // Inverse of affine: first subtract translation, then apply transpose of rotation
  // (Only correct for orthogonal rotation matrices; for scaled/sheared, use full inverse)
  return rotT * (p - trans);
}

// ========================================
// Noise functions (demoscene style)
// ========================================

// Hash function for pseudo-random values
float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float hash3(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

// 3D value noise
float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // smoothstep

  float n = i.x + i.y * 57.0 + i.z * 113.0;
  return mix(
    mix(mix(hash(n), hash(n + 1.0), f.x),
        mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
    mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
        mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y),
    f.z);
}

// Fractal Brownian Motion - layered noise
float fbm(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * noise3(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// Turbulence - absolute value noise for sharper features
float turbulence(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * abs(noise3(p * frequency) * 2.0 - 1.0);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

`;
}
