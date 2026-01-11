/**
 * JSON to WGSL Codegen - Generate WGSL from JSON node IR
 * Mirrors json-codegen.js but outputs WebGPU Shading Language
 *
 * Key GLSL → WGSL differences:
 * - float → f32, vec3 → vec3f, mat4 → mat4x4f
 * - function: float f(vec3 p) → fn f(p: vec3f) -> f32
 * - uniform structs instead of loose uniforms
 * - let/var instead of type name
 */

import { getAllParamNames } from './rig-evaluator.js';

/**
 * Generate WGSL code from processed JSON scene
 * @param {Object} scene - The processed scene IR
 * @param {Object} options - Optional generation options
 */
export function generateWgslFromJson(scene, options = {}) {
  const ctx = {
    uniforms: new Set(),
    functions: [],
    helpers: [],
    helperCounter: 0,
    showCutters: options.showCutters || false,
    inlineDefaults: options.inlineDefaults || false, // Inline param defaults instead of uniforms
    localVars: {},
    instanceIdParam: null,
    sceneParams: scene.params || {},
    sceneRig: scene.rig || null,
    ancestorRotation: null,
    nodeIdCounter: 0,
    nodeIdMap: new Map(),
    pickingMode: options.pickingMode || false
  };

  // Register ALL params as uniforms (unless inlining defaults)
  if (!ctx.inlineDefaults) {
    const allParams = getAllParamNames(scene.params || {}, scene.rig);
    for (const [name, paramInfo] of Object.entries(allParams)) {
      const uniformName = `u_${name}`;
      if (paramInfo.type === 'scalar') {
        ctx.uniforms.add(uniformName);
      } else if (paramInfo.type === 'color3' || paramInfo.type === 'position3' || paramInfo.type === 'radii3' || paramInfo.type === 'direction3') {
        ctx.uniforms.add(`${uniformName}:vec3f`);
      }
    }
  }

  // Register physics params as vec3f uniforms
  if (scene.physics?.enabled && scene.physics.bodies) {
    for (const body of scene.physics.bodies) {
      if (body.name) {
        ctx.uniforms.add(`u_phys_${body.name}:vec3f`);
      }
    }
  }

  // Generate main scene expression
  const sceneExpr = walkNode(scene.root, ctx);

  // Build final shader
  let wgsl = '';

  // Uniform struct - dedupe by base name, prefer typed versions (e.g. u_color:vec3f over u_color)
  const builtinUniforms = new Set(['u_time', 'u_resolution', 'u_cameraPos', 'u_cameraTarget', 'u_showGroundPlane', 'u_volumeRender']);
  const uniformMap = new Map();  // baseName -> full entry (with type if available)
  for (const u of ctx.uniforms) {
    const baseName = u.split(':')[0];
    if (builtinUniforms.has(baseName)) continue;
    // Prefer typed version over untyped
    if (!uniformMap.has(baseName) || u.includes(':')) {
      uniformMap.set(baseName, u);
    }
  }
  const customUniforms = [...uniformMap.values()];

  if (customUniforms.length > 0) {
    wgsl += '// Custom uniforms (scene params)\n';
    wgsl += 'struct SceneUniforms {\n';
    for (const uniform of customUniforms) {
      if (uniform.includes(':')) {
        const [name, type] = uniform.split(':');
        wgsl += `  ${name}: ${type},\n`;
      } else {
        wgsl += `  ${uniform}: f32,\n`;
      }
    }
    wgsl += '}\n';
    wgsl += '@group(1) @binding(0) var<uniform> scene: SceneUniforms;\n\n';
  }

  // Add SDF primitive functions
  wgsl += generatePrimitiveFunctions();

  // Add helper functions
  wgsl += generateHelperFunctions();

  // Add generated helper functions
  if (ctx.helpers.length > 0) {
    wgsl += '// Generated helper functions\n';
    wgsl += ctx.helpers.join('\n\n');
    wgsl += '\n\n';
  }

  // Add main scene function
  wgsl += '// Main scene SDF\n';
  wgsl += 'fn sceneSDF(p: vec3f) -> vec4f {\n';
  wgsl += `  return ${sceneExpr};\n`;
  wgsl += '}\n';

  return wgsl;
}

const MAX_CODEGEN_DEPTH = 200;

/**
 * Walk node and generate WGSL expression
 * Returns a string that evaluates to vec4f(distance, r, g, b)
 */
function walkNode(node, ctx) {
  ctx.depth = (ctx.depth || 0) + 1;
  if (ctx.depth > MAX_CODEGEN_DEPTH) {
    console.warn(`Max codegen depth (${MAX_CODEGEN_DEPTH}) exceeded`);
    ctx.depth--;
    return 'vec4f(1000.0, 1.0, 0.0, 1.0)';
  }

  try {
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
    case 'roundCone':
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
      return 'vec4f(1000.0, 1.0, 0.0, 1.0)';
    }
  } finally {
    ctx.depth--;
  }
}

// ============================================
// Primitive generators
// ============================================

function generateSphere(node, ctx) {
  const params = node.params || {};
  const r = valueToWgsl(params.r || { type: 'const', value: 1.0 }, ctx);
  const p = applyTransform('p', node.transform, ctx);
  const color = valueToWgsl(params.color || { type: 'array', values: [0.8, 0.8, 0.8].map(v => ({ type: 'const', value: v })) }, ctx);
  return `vec4f(sdSphere(${p}, ${r}), ${color})`;
}

function generateBox(node, ctx) {
  const params = node.params || {};
  const size = valueToWgsl(params.size || { type: 'array', values: [1, 1, 1].map(v => ({ type: 'const', value: v })) }, ctx);
  const p = applyTransform('p', node.transform, ctx);
  const color = valueToWgsl(params.color || { type: 'array', values: [0.8, 0.8, 0.8].map(v => ({ type: 'const', value: v })) }, ctx);
  return `vec4f(sdBox(${p}, ${size}), ${color})`;
}

function generateTorus(node, ctx) {
  const params = node.params || {};
  const major = valueToWgsl(params.major || { type: 'const', value: 1.0 }, ctx);
  const minor = valueToWgsl(params.minor || { type: 'const', value: 0.3 }, ctx);
  const p = applyTransform('p', node.transform, ctx);
  const color = valueToWgsl(params.color || { type: 'array', values: [0.8, 0.8, 0.8].map(v => ({ type: 'const', value: v })) }, ctx);
  return `vec4f(sdTorus(${p}, vec2f(${major}, ${minor})), ${color})`;
}

function generateCylinder(node, ctx) {
  const params = node.params || {};
  const h = valueToWgsl(params.h || { type: 'const', value: 1.0 }, ctx);
  const r = valueToWgsl(params.r || { type: 'const', value: 0.5 }, ctx);
  const p = applyTransform('p', node.transform, ctx);
  const color = valueToWgsl(params.color || { type: 'array', values: [0.8, 0.8, 0.8].map(v => ({ type: 'const', value: v })) }, ctx);
  return `vec4f(sdCylinder(${p}, ${h}, ${r}), ${color})`;
}

function generateCapsule(node, ctx) {
  const params = node.params || {};
  const h = valueToWgsl(params.h || { type: 'const', value: 1.0 }, ctx);
  const r = valueToWgsl(params.r || { type: 'const', value: 0.25 }, ctx);
  const p = applyTransform('p', node.transform, ctx);
  const color = valueToWgsl(params.color || { type: 'array', values: [0.8, 0.8, 0.8].map(v => ({ type: 'const', value: v })) }, ctx);
  return `vec4f(sdCapsule(${p}, ${h}, ${r}), ${color})`;
}

function generateEllipsoid(node, ctx) {
  const params = node.params || {};
  const radii = valueToWgsl(params.radii || { type: 'array', values: [1, 0.5, 0.5].map(v => ({ type: 'const', value: v })) }, ctx);
  const p = applyTransform('p', node.transform, ctx);
  const color = valueToWgsl(params.color || { type: 'array', values: [0.8, 0.8, 0.8].map(v => ({ type: 'const', value: v })) }, ctx);
  return `vec4f(sdEllipsoid(${p}, ${radii}), ${color})`;
}

function generateCone(node, ctx) {
  const params = node.params || {};
  const h = valueToWgsl(params.h || { type: 'const', value: 1.0 }, ctx);
  const p = applyTransform('p', node.transform, ctx);
  const color = valueToWgsl(params.color || { type: 'array', values: [0.8, 0.8, 0.8].map(v => ({ type: 'const', value: v })) }, ctx);

  if (params.r1 !== undefined || params.r2 !== undefined) {
    const r1 = valueToWgsl(params.r1 || { type: 'const', value: 0.5 }, ctx);
    const r2 = valueToWgsl(params.r2 || { type: 'const', value: 0.0 }, ctx);
    return `vec4f(sdRoundCone(${p}, ${r1}, ${r2}, ${h}), ${color})`;
  } else {
    const r = valueToWgsl(params.r || { type: 'const', value: 0.5 }, ctx);
    return `vec4f(sdCone(${p}, ${h}, ${r}), ${color})`;
  }
}

function generatePlane(node, ctx) {
  const params = node.params || {};
  const normal = valueToWgsl(params.normal || { type: 'array', values: [0, 1, 0].map(v => ({ type: 'const', value: v })) }, ctx);
  const h = valueToWgsl(params.h || { type: 'const', value: 0 }, ctx);
  const p = applyTransform('p', node.transform, ctx);
  const color = valueToWgsl(params.color || { type: 'array', values: [0.5, 0.5, 0.5].map(v => ({ type: 'const', value: v })) }, ctx);
  return `vec4f(sdPlane(${p}, ${normal}, ${h}), ${color})`;
}

// ============================================
// CSG operations
// ============================================

function generateUnion(node, ctx) {
  const children = node.children || [];
  if (children.length === 0) {
    return 'vec4f(1000.0, 1.0, 0.0, 1.0)';
  }

  const transformedP = applyTransform('p', node.transform, ctx);
  const hasParentTransform = node.transform && transformedP !== 'p';

  const savedAncestorRotation = ctx.ancestorRotation;
  const nodeRotation = extractRotation(node.transform);
  if (nodeRotation && isStaticRotation(nodeRotation)) {
    ctx.ancestorRotation = savedAncestorRotation
      ? addRotations(savedAncestorRotation, nodeRotation)
      : nodeRotation;
  }

  let result;

  // BVH bounding box early-out
  const bbox = node.boundingBox;
  let bboxCheck = null;
  if (bbox && bbox.center && bbox.halfSize) {
    const cx = Array.isArray(bbox.center) ? bbox.center[0] : 0;
    const cy = Array.isArray(bbox.center) ? bbox.center[1] : 0;
    const cz = Array.isArray(bbox.center) ? bbox.center[2] : 0;
    const hx = Array.isArray(bbox.halfSize) ? bbox.halfSize[0] : 1;
    const hy = Array.isArray(bbox.halfSize) ? bbox.halfSize[1] : 1;
    const hz = Array.isArray(bbox.halfSize) ? bbox.halfSize[2] : 1;
    bboxCheck = {
      center: `vec3f(${cx.toFixed(3)}, ${cy.toFixed(3)}, ${cz.toFixed(3)})`,
      halfSize: `vec3f(${hx.toFixed(3)}, ${hy.toFixed(3)}, ${hz.toFixed(3)})`
    };
  }

  if (children.length === 1) {
    if (hasParentTransform) {
      const funcName = `union_${ctx.helperCounter++}`;
      const paramList = 'p: vec3f';
      const childFuncName = `union_child_${ctx.helperCounter++}`;
      const childExpr = walkNode(children[0], ctx);
      ctx.helpers.push(`fn ${childFuncName}(${paramList}) -> vec4f {
  return ${childExpr};
}`);
      const helperFunc = `fn ${funcName}(${paramList}) -> vec4f {
  let tp = ${transformedP};
  return ${childFuncName}(tp);
}`;
      ctx.helpers.push(helperFunc);
      result = `${funcName}(${ctx.currentP || 'p'})`;
    } else {
      result = walkNode(children[0], ctx);
    }
  } else {
    const funcName = `union_${ctx.helperCounter++}`;
    const paramList = 'p: vec3f';

    let bodyPrefix = '';
    let childP = 'p';
    if (hasParentTransform) {
      bodyPrefix = `  let tp = ${transformedP};\n`;
      childP = 'tp';
    }

    const childHelpers = children.map((child) => {
      const childFuncName = `union_child_${ctx.helperCounter++}`;
      const childExpr = walkNode(child, ctx);
      ctx.helpers.push(`fn ${childFuncName}(${paramList}) -> vec4f {
  return ${childExpr};
}`);
      return childFuncName;
    });

    const childAssignments = childHelpers.map((funcName, i) => {
      return `  let c${i} = ${funcName}(${childP});`;
    }).join('\n');

    let colorSelect;
    if (children.length === 2) {
      colorSelect = '\n  return select(c1, c0, c0.x < c1.x);';
    } else {
      colorSelect = '\n  var nearest = c0;';
      for (let i = 1; i < children.length; i++) {
        colorSelect += `\n  nearest = select(c${i}, nearest, nearest.x < c${i}.x);`;
      }
      colorSelect += '\n  return nearest;';
    }

    let bboxEarlyOut = '';
    if (bboxCheck) {
      bboxEarlyOut = `  let bboxD = abs(${hasParentTransform ? 'tp' : 'p'} - ${bboxCheck.center}) - ${bboxCheck.halfSize};
  let bboxDist = length(max(bboxD, vec3f(0.0))) + min(max(bboxD.x, max(bboxD.y, bboxD.z)), 0.0);
  if (bboxDist > 0.1) { return vec4f(bboxDist, 0.5, 0.5, 0.5); }
`;
    }

    const helperFunc = `fn ${funcName}(${paramList}) -> vec4f {
${bodyPrefix}${bboxEarlyOut}${childAssignments}${colorSelect}
}`;

    ctx.helpers.push(helperFunc);
    result = `${funcName}(${ctx.currentP || 'p'})`;
  }

  ctx.ancestorRotation = savedAncestorRotation;
  return result;
}

function generateSubtract(node, ctx) {
  const children = node.children || [];
  if (children.length === 0) {
    return 'vec4f(1000.0, 1.0, 0.0, 1.0)';
  }

  const transformedP = applyTransform('p', node.transform, ctx);
  const hasParentTransform = node.transform && transformedP !== 'p';

  if (children.length === 1) {
    if (hasParentTransform) {
      const funcName = `subtract_${ctx.helperCounter++}`;
      const childFuncName = `subtract_child_${ctx.helperCounter++}`;
      const childExpr = walkNode(children[0], ctx);
      ctx.helpers.push(`fn ${childFuncName}(p: vec3f) -> vec4f {
  return ${childExpr};
}`);
      ctx.helpers.push(`fn ${funcName}(p: vec3f) -> vec4f {
  let tp = ${transformedP};
  return ${childFuncName}(tp);
}`);
      return `${funcName}(${ctx.currentP || 'p'})`;
    }
    return walkNode(children[0], ctx);
  }

  const funcName = `subtract_${ctx.helperCounter++}`;
  let bodyPrefix = '';
  let childP = 'p';
  if (hasParentTransform) {
    bodyPrefix = `  let tp = ${transformedP};\n`;
    childP = 'tp';
  }

  const childHelpers = children.map((child) => {
    const childFuncName = `subtract_child_${ctx.helperCounter++}`;
    const childExpr = walkNode(child, ctx);
    ctx.helpers.push(`fn ${childFuncName}(p: vec3f) -> vec4f {
  return ${childExpr};
}`);
    return childFuncName;
  });

  let body = bodyPrefix;
  body += `  var base = ${childHelpers[0]}(${childP});\n`;

  for (let i = 1; i < children.length; i++) {
    body += `  let sub${i} = ${childHelpers[i]}(${childP});\n`;
    if (ctx.showCutters) {
      body += `  if (sub${i}.x < base.x) { base = sub${i}; }\n`;
    } else {
      body += `  base.x = max(base.x, -sub${i}.x);\n`;
    }
  }

  ctx.helpers.push(`fn ${funcName}(p: vec3f) -> vec4f {
${body}  return base;
}`);

  return `${funcName}(${ctx.currentP || 'p'})`;
}

function generateIntersect(node, ctx) {
  const children = node.children || [];
  if (children.length === 0) {
    return 'vec4f(1000.0, 1.0, 0.0, 1.0)';
  }

  const transformedP = applyTransform('p', node.transform, ctx);
  const hasParentTransform = node.transform && transformedP !== 'p';

  if (children.length === 1) {
    if (hasParentTransform) {
      const funcName = `intersect_${ctx.helperCounter++}`;
      const childFuncName = `intersect_child_${ctx.helperCounter++}`;
      const childExpr = walkNode(children[0], ctx);
      ctx.helpers.push(`fn ${childFuncName}(p: vec3f) -> vec4f {
  return ${childExpr};
}`);
      ctx.helpers.push(`fn ${funcName}(p: vec3f) -> vec4f {
  let tp = ${transformedP};
  return ${childFuncName}(tp);
}`);
      return `${funcName}(${ctx.currentP || 'p'})`;
    }
    return walkNode(children[0], ctx);
  }

  const funcName = `intersect_${ctx.helperCounter++}`;
  let bodyPrefix = '';
  let childP = 'p';
  if (hasParentTransform) {
    bodyPrefix = `  let tp = ${transformedP};\n`;
    childP = 'tp';
  }

  const childHelpers = children.map((child) => {
    const childFuncName = `intersect_child_${ctx.helperCounter++}`;
    const childExpr = walkNode(child, ctx);
    ctx.helpers.push(`fn ${childFuncName}(p: vec3f) -> vec4f {
  return ${childExpr};
}`);
    return childFuncName;
  });

  const childAssignments = childHelpers.map((funcName, i) => {
    return `  let c${i} = ${funcName}(${childP});`;
  }).join('\n');

  let colorSelect;
  if (children.length === 2) {
    colorSelect = '\n  return select(c1, c0, c0.x > c1.x);';
  } else {
    colorSelect = '\n  var farthest = c0;';
    for (let i = 1; i < children.length; i++) {
      colorSelect += `\n  farthest = select(c${i}, farthest, farthest.x > c${i}.x);`;
    }
    colorSelect += '\n  return farthest;';
  }

  ctx.helpers.push(`fn ${funcName}(p: vec3f) -> vec4f {
${bodyPrefix}${childAssignments}${colorSelect}
}`);

  return `${funcName}(${ctx.currentP || 'p'})`;
}

function generateSmoothUnion(node, ctx) {
  const children = node.children || [];
  const k = valueToWgsl(node.k || { type: 'const', value: 0.1 }, ctx);

  if (children.length === 0) {
    return 'vec4f(1000.0, 1.0, 0.0, 1.0)';
  }

  const transformedP = applyTransform('p', node.transform, ctx);
  const hasParentTransform = node.transform && transformedP !== 'p';

  if (children.length === 1) {
    if (hasParentTransform) {
      const funcName = `smoothUnion_${ctx.helperCounter++}`;
      const childFuncName = `smoothUnion_child_${ctx.helperCounter++}`;
      const childExpr = walkNode(children[0], ctx);
      ctx.helpers.push(`fn ${childFuncName}(p: vec3f) -> vec4f {
  return ${childExpr};
}`);
      ctx.helpers.push(`fn ${funcName}(p: vec3f) -> vec4f {
  let tp = ${transformedP};
  return ${childFuncName}(tp);
}`);
      return `${funcName}(${ctx.currentP || 'p'})`;
    }
    return walkNode(children[0], ctx);
  }

  const funcName = `smoothUnion_${ctx.helperCounter++}`;
  let bodyPrefix = '';
  let childP = 'p';
  if (hasParentTransform) {
    bodyPrefix = `  let tp = ${transformedP};\n`;
    childP = 'tp';
  }

  const childFuncNames = [];
  for (let i = 0; i < children.length; i++) {
    const childFuncName = `smoothUnion_child_${ctx.helperCounter++}`;
    const childExpr = walkNode(children[i], ctx);
    ctx.helpers.push(`fn ${childFuncName}(p: vec3f) -> vec4f {
  return ${childExpr};
}`);
    childFuncNames.push(childFuncName);
  }

  let bodyLines = [];
  bodyLines.push(`  var result = ${childFuncNames[0]}(${childP});`);

  for (let i = 1; i < childFuncNames.length; i++) {
    bodyLines.push(`  {`);
    bodyLines.push(`    let b = ${childFuncNames[i]}(${childP});`);
    bodyLines.push(`    let h = clamp(0.5 + 0.5 * (b.x - result.x) / ${k}, 0.0, 1.0);`);
    bodyLines.push(`    let d = mix(b.x, result.x, h) - ${k} * h * (1.0 - h);`);
    bodyLines.push(`    let col = mix(b.yzw, result.yzw, h);`);
    bodyLines.push(`    result = vec4f(d, col);`);
    bodyLines.push(`  }`);
  }

  bodyLines.push(`  return result;`);

  ctx.helpers.push(`fn ${funcName}(p: vec3f) -> vec4f {
${bodyPrefix}${bodyLines.join('\n')}
}`);

  return `${funcName}(${ctx.currentP || 'p'})`;
}

function generateSmoothIntersect(node, ctx) {
  // Similar to smoothUnion but with max logic
  const children = node.children || [];
  const k = valueToWgsl(node.k || { type: 'const', value: 0.1 }, ctx);

  if (children.length === 0) {
    return 'vec4f(1000.0, 1.0, 0.0, 1.0)';
  }

  if (children.length === 1) {
    return walkNode(children[0], ctx);
  }

  const funcName = `smoothIntersect_${ctx.helperCounter++}`;
  const childFuncNames = children.map((child) => {
    const childFuncName = `smoothIntersect_child_${ctx.helperCounter++}`;
    const childExpr = walkNode(child, ctx);
    ctx.helpers.push(`fn ${childFuncName}(p: vec3f) -> vec4f {
  return ${childExpr};
}`);
    return childFuncName;
  });

  let bodyLines = [];
  bodyLines.push(`  var result = ${childFuncNames[0]}(p);`);

  for (let i = 1; i < childFuncNames.length; i++) {
    bodyLines.push(`  {`);
    bodyLines.push(`    let b = ${childFuncNames[i]}(p);`);
    bodyLines.push(`    let h = clamp(0.5 - 0.5 * (b.x - result.x) / ${k}, 0.0, 1.0);`);
    bodyLines.push(`    let d = mix(b.x, result.x, h) + ${k} * h * (1.0 - h);`);
    bodyLines.push(`    let col = mix(b.yzw, result.yzw, h);`);
    bodyLines.push(`    result = vec4f(d, col);`);
    bodyLines.push(`  }`);
  }

  bodyLines.push(`  return result;`);

  ctx.helpers.push(`fn ${funcName}(p: vec3f) -> vec4f {
${bodyLines.join('\n')}
}`);

  return `${funcName}(${ctx.currentP || 'p'})`;
}

function generateSmoothSubtract(node, ctx) {
  const children = node.children || [];
  const k = valueToWgsl(node.k || { type: 'const', value: 0.1 }, ctx);

  if (children.length < 2) {
    return children.length === 1 ? walkNode(children[0], ctx) : 'vec4f(1000.0, 1.0, 0.0, 1.0)';
  }

  const funcName = `smoothSubtract_${ctx.helperCounter++}`;
  const childFuncNames = children.map((child) => {
    const childFuncName = `smoothSubtract_child_${ctx.helperCounter++}`;
    const childExpr = walkNode(child, ctx);
    ctx.helpers.push(`fn ${childFuncName}(p: vec3f) -> vec4f {
  return ${childExpr};
}`);
    return childFuncName;
  });

  let bodyLines = [];
  bodyLines.push(`  var result = ${childFuncNames[0]}(p);`);

  for (let i = 1; i < childFuncNames.length; i++) {
    bodyLines.push(`  {`);
    bodyLines.push(`    let b = ${childFuncNames[i]}(p);`);
    bodyLines.push(`    let h = clamp(0.5 - 0.5 * (result.x + b.x) / ${k}, 0.0, 1.0);`);
    bodyLines.push(`    let d = mix(result.x, -b.x, h) + ${k} * h * (1.0 - h);`);
    bodyLines.push(`    result = vec4f(d, result.yzw);`);
    bodyLines.push(`  }`);
  }

  bodyLines.push(`  return result;`);

  ctx.helpers.push(`fn ${funcName}(p: vec3f) -> vec4f {
${bodyLines.join('\n')}
}`);

  return `${funcName}(${ctx.currentP || 'p'})`;
}

// ============================================
// Transform operations
// ============================================

function generateTransform(node, ctx) {
  if (!node.child) {
    return 'vec4f(1000.0, 1.0, 0.0, 1.0)';
  }
  const p = applyTransform('p', node.transform, ctx);
  const savedP = ctx.currentP;
  ctx.currentP = p;
  const result = walkNode(node.child, ctx);
  ctx.currentP = savedP;
  return result;
}

function generateGroup(node, ctx) {
  // Group is just a container, process as union
  return generateUnion({ ...node, type: 'union' }, ctx);
}

function generateMaterial(node, ctx) {
  if (!node.child) {
    return 'vec4f(1000.0, 1.0, 0.0, 1.0)';
  }
  // Material wraps child with color override
  const childExpr = walkNode(node.child, ctx);
  const color = valueToWgsl(node.color || { type: 'array', values: [0.8, 0.8, 0.8].map(v => ({ type: 'const', value: v })) }, ctx);
  const funcName = `material_${ctx.helperCounter++}`;
  ctx.helpers.push(`fn ${funcName}(p: vec3f) -> vec4f {
  let c = ${childExpr};
  return vec4f(c.x, ${color});
}`);
  return `${funcName}(${ctx.currentP || 'p'})`;
}

function generateRef(node, ctx) {
  // Get the processed definition from the loader
  let def = node.def;
  if (!def) {
    console.warn(`Unresolved ref: ${node.id || node.refId}`);
    return 'vec4f(1000.0, 1.0, 0.0, 1.0)';
  }

  // Apply parameter overrides if any
  if (node.overrides) {
    def = applyParamOverrides(def, node.overrides);
  }

  // If this ref has a transform from parent, apply it
  if (node.transform) {
    const defWithTransform = {
      ...def,
      transform: combineTransforms(def.transform, node.transform)
    };
    return walkNode(defWithTransform, ctx);
  } else {
    return walkNode(def, ctx);
  }
}

// Apply parameter overrides to a def
function applyParamOverrides(def, overrides) {
  if (!overrides || Object.keys(overrides).length === 0) {
    return def;
  }

  // Deep clone the def
  const cloned = JSON.parse(JSON.stringify(def));

  // Recursively substitute vars in any value
  function substituteVars(value) {
    if (value === null || value === undefined) return value;

    // Check if this is a var reference
    if (typeof value === 'object' && !Array.isArray(value)) {
      const varName = value.var || value.name;
      if (varName && value.type !== 'expr' && overrides[varName] !== undefined) {
        return overrides[varName];
      }
      // Recurse into object properties
      const result = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = substituteVars(v);
      }
      return result;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(v => substituteVars(v));
    }

    return value;
  }

  // Apply overrides recursively to entire node tree
  function applyToNode(node) {
    if (!node) return;

    // Substitute vars in params
    if (node.params) {
      node.params = substituteVars(node.params);
    }

    // Substitute vars in transform
    if (node.transform) {
      node.transform = substituteVars(node.transform);
    }

    // Substitute vars in other properties that might have vars
    if (node.k !== undefined) node.k = substituteVars(node.k);
    if (node.color !== undefined) node.color = substituteVars(node.color);
    if (node.offset !== undefined) node.offset = substituteVars(node.offset);

    // Recurse into children
    if (node.child) applyToNode(node.child);
    if (node.children) node.children.forEach(applyToNode);
  }

  applyToNode(cloned);
  return cloned;
}

// Combine transforms
function combineTransforms(t1, t2) {
  if (!t1) return t2;
  if (!t2) return t1;

  return {
    translate: t1.translate || t2.translate,
    rotateX: t1.rotateX || t2.rotateX,
    rotateY: t1.rotateY || t2.rotateY,
    rotateZ: t1.rotateZ || t2.rotateZ,
    scale: t1.scale || t2.scale,
  };
}

function generateMirror(node, ctx) {
  if (!node.child) {
    return 'vec4f(1000.0, 1.0, 0.0, 1.0)';
  }

  const axis = node.axis || 'x';
  const offset = valueToWgsl(node.offset || { type: 'const', value: 0 }, ctx);

  const funcName = `mirror_${ctx.helperCounter++}`;
  const childFuncName = `mirror_child_${ctx.helperCounter++}`;
  const childExpr = walkNode(node.child, ctx);

  ctx.helpers.push(`fn ${childFuncName}(p: vec3f) -> vec4f {
  return ${childExpr};
}`);

  let mirrorExpr;
  switch (axis) {
  case 'x':
    mirrorExpr = `vec3f(abs(p.x) - ${offset}, p.y, p.z)`;
    break;
  case 'y':
    mirrorExpr = `vec3f(p.x, abs(p.y) - ${offset}, p.z)`;
    break;
  case 'z':
    mirrorExpr = `vec3f(p.x, p.y, abs(p.z) - ${offset})`;
    break;
  default:
    mirrorExpr = 'p';
  }

  ctx.helpers.push(`fn ${funcName}(p: vec3f) -> vec4f {
  let mp = ${mirrorExpr};
  return ${childFuncName}(mp);
}`);

  return `${funcName}(${ctx.currentP || 'p'})`;
}

function generateRadial(node, ctx) {
  if (!node.child) {
    return 'vec4f(1000.0, 1.0, 0.0, 1.0)';
  }

  const count = node.count || 6;
  const axis = node.axis || 'y'; // Default to Y-axis (XZ plane rotation)
  const funcName = `radial_${ctx.helperCounter++}`;
  const childFuncName = `radial_child_${ctx.helperCounter++}`;
  const childExpr = walkNode(node.child, ctx);

  ctx.helpers.push(`fn ${childFuncName}(p: vec3f) -> vec4f {
  return ${childExpr};
}`);

  // Generate different rotation based on axis
  let rotationCode;
  switch (axis) {
  case 'x':
    // Rotate around X-axis (YZ plane)
    rotationCode = `
  let angle = atan2(p.z, p.y);
  let sector = 6.283185 / f32(${count});
  let a = (floor(angle / sector + 0.5)) * sector;
  let c = cos(a);
  let s = sin(a);
  let rp = vec3f(p.x, c * p.y + s * p.z, -s * p.y + c * p.z);`;
    break;
  case 'z':
    // Rotate around Z-axis (XY plane)
    rotationCode = `
  let angle = atan2(p.y, p.x);
  let sector = 6.283185 / f32(${count});
  let a = (floor(angle / sector + 0.5)) * sector;
  let c = cos(a);
  let s = sin(a);
  let rp = vec3f(c * p.x + s * p.y, -s * p.x + c * p.y, p.z);`;
    break;
  case 'y':
  default:
    // Rotate around Y-axis (XZ plane) - default
    rotationCode = `
  let angle = atan2(p.z, p.x);
  let sector = 6.283185 / f32(${count});
  let a = (floor(angle / sector + 0.5)) * sector;
  let c = cos(a);
  let s = sin(a);
  let rp = vec3f(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);`;
    break;
  }

  ctx.helpers.push(`fn ${funcName}(p: vec3f) -> vec4f {${rotationCode}
  return ${childFuncName}(rp);
}`);

  return `${funcName}(${ctx.currentP || 'p'})`;
}

function generateRepeat(node, ctx) {
  if (!node.child) {
    return 'vec4f(1000.0, 1.0, 0.0, 1.0)';
  }

  // Support both 'spacing' and 'period' properties
  const spacingValue = node.spacing || node.period || { type: 'array', values: [2, 2, 2].map(v => ({ type: 'const', value: v })) };
  const spacing = valueToWgsl(spacingValue, ctx);
  const funcName = `repeat_${ctx.helperCounter++}`;
  const childFuncName = `repeat_child_${ctx.helperCounter++}`;
  const childExpr = walkNode(node.child, ctx);

  ctx.helpers.push(`fn ${childFuncName}(p: vec3f) -> vec4f {
  return ${childExpr};
}`);

  ctx.helpers.push(`fn ${funcName}(p: vec3f) -> vec4f {
  let spacing = ${spacing};
  let rp = p - spacing * round(p / spacing);
  return ${childFuncName}(rp);
}`);

  return `${funcName}(${ctx.currentP || 'p'})`;
}

function generateSelect(node, ctx) {
  // TODO: Implement select (conditional based on param)
  return walkNode(node.children?.[0] || { type: 'sphere', params: {} }, ctx);
}

function generateRound(node, ctx) {
  if (!node.child) {
    return 'vec4f(1000.0, 1.0, 0.0, 1.0)';
  }

  const r = valueToWgsl(node.r || { type: 'const', value: 0.1 }, ctx);
  const funcName = `round_${ctx.helperCounter++}`;
  const childFuncName = `round_child_${ctx.helperCounter++}`;
  const childExpr = walkNode(node.child, ctx);

  ctx.helpers.push(`fn ${childFuncName}(p: vec3f) -> vec4f {
  return ${childExpr};
}`);

  ctx.helpers.push(`fn ${funcName}(p: vec3f) -> vec4f {
  let c = ${childFuncName}(p);
  return vec4f(c.x - ${r}, c.yzw);
}`);

  return `${funcName}(${ctx.currentP || 'p'})`;
}

function generateShell(node, ctx) {
  if (!node.child) {
    return 'vec4f(1000.0, 1.0, 0.0, 1.0)';
  }

  const thickness = valueToWgsl(node.thickness || { type: 'const', value: 0.1 }, ctx);
  const funcName = `shell_${ctx.helperCounter++}`;
  const childFuncName = `shell_child_${ctx.helperCounter++}`;
  const childExpr = walkNode(node.child, ctx);

  ctx.helpers.push(`fn ${childFuncName}(p: vec3f) -> vec4f {
  return ${childExpr};
}`);

  ctx.helpers.push(`fn ${funcName}(p: vec3f) -> vec4f {
  let c = ${childFuncName}(p);
  return vec4f(abs(c.x) - ${thickness}, c.yzw);
}`);

  return `${funcName}(${ctx.currentP || 'p'})`;
}

function generateDisplace(node, ctx) {
  if (!node.child) {
    return 'vec4f(1000.0, 1.0, 0.0, 1.0)';
  }

  const funcName = `displace_${ctx.helperCounter++}`;
  const childFuncName = `displace_child_${ctx.helperCounter++}`;
  const childExpr = walkNode(node.child, ctx);

  ctx.helpers.push(`fn ${childFuncName}(p: vec3f) -> vec4f {
  return ${childExpr};
}`);

  // Default displacement: fbm noise
  const scale = valueToWgsl(node.scale || { type: 'const', value: 1.0 }, ctx);
  const amount = valueToWgsl(node.amount || { type: 'const', value: 0.1 }, ctx);

  ctx.helpers.push(`fn ${funcName}(p: vec3f) -> vec4f {
  let c = ${childFuncName}(p);
  let disp = (fbm(p * ${scale}, 4) - 0.5) * 2.0 * ${amount};
  return vec4f(c.x + disp, c.yzw);
}`);

  return `${funcName}(${ctx.currentP || 'p'})`;
}

function generateCustomExpr(node, ctx) {
  // Custom WGSL expression - use as-is
  const expr = node.expr || 'vec4f(1000.0, 1.0, 0.0, 1.0)';
  return expr;
}

function generateScaledNode(node, ctx) {
  const scale = node.transform.scale;
  const scaleVec = valueToWgsl(scale, ctx);

  // Clone node without scale
  const unscaledNode = { ...node, transform: { ...node.transform, scale: undefined } };
  const innerExpr = walkNode(unscaledNode, ctx);

  const funcName = `scaled_${ctx.helperCounter++}`;
  const childFuncName = `scaled_child_${ctx.helperCounter++}`;

  ctx.helpers.push(`fn ${childFuncName}(p: vec3f) -> vec4f {
  return ${innerExpr};
}`);

  // Non-uniform scale: multiply by min component
  ctx.helpers.push(`fn ${funcName}(p: vec3f) -> vec4f {
  let s = ${scaleVec};
  let c = ${childFuncName}(p / s);
  return vec4f(c.x * min(s.x, min(s.y, s.z)), c.yzw);
}`);

  return `${funcName}(${ctx.currentP || 'p'})`;
}

// ============================================
// Value conversion
// ============================================

function valueToWgsl(value, ctx) {
  if (value === undefined || value === null) {
    return '0.0';
  }

  if (typeof value === 'number') {
    return formatFloat(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 3) {
      return `vec3f(${value.map(v => formatFloat(v)).join(', ')})`;
    } else if (value.length === 2) {
      return `vec2f(${value.map(v => formatFloat(v)).join(', ')})`;
    } else if (value.length === 4) {
      return `vec4f(${value.map(v => formatFloat(v)).join(', ')})`;
    }
    return formatFloat(value[0] || 0);
  }

  switch (value.type) {
  case 'const':
    return formatFloat(value.value);

  case 'var':
    // Handle built-in variables that come from main uniforms
    if (value.name === 'time') {
      return 'u.time';
    }
    if (value.name === 'resolution') {
      return 'u.resolution';
    }
    if (value.name === 'cameraPos') {
      return 'u.cameraPos';
    }

    // If inlineDefaults is set, use the default value from sceneParams instead of uniform
    if (ctx.inlineDefaults && ctx.sceneParams[value.name]) {
      const param = ctx.sceneParams[value.name];
      const defaultVal = param.value !== undefined ? param.value : 0;
      if (param.type === 'color3' || param.type === 'position3' || param.type === 'radii3' || param.type === 'direction3') {
        const arr = Array.isArray(defaultVal) ? defaultVal : [0, 0, 0];
        return `vec3f(${arr.map(v => formatFloat(v)).join(', ')})`;
      }
      return formatFloat(defaultVal);
    }
    ctx.uniforms.add(`u_${value.name}`);
    return `scene.u_${value.name}`;

  case 'array':
    if (value.values) {
      const vals = value.values.map(v => valueToWgsl(v, ctx));
      if (vals.length === 3) {
        return `vec3f(${vals.join(', ')})`;
      } else if (vals.length === 2) {
        return `vec2f(${vals.join(', ')})`;
      } else if (vals.length === 4) {
        return `vec4f(${vals.join(', ')})`;
      }
    }
    return '0.0';

  case 'expr':
    return exprToWgsl(value, ctx);

  default:
    if (typeof value.value === 'number') {
      return formatFloat(value.value);
    }
    return '0.0';
  }
}

function formatFloat(v) {
  if (typeof v !== 'number') return '0.0';
  const s = v.toString();
  return s.includes('.') ? s : s + '.0';
}

// Expression evaluation - convert expression trees to WGSL
function exprToWgsl(expr, ctx) {
  if (!expr) return '0.0';

  // Handle simple values
  if (typeof expr === 'number') {
    return formatFloat(expr);
  }
  if (typeof expr === 'string') {
    return expr;
  }
  if (expr.type === 'const') {
    return formatFloat(expr.value);
  }
  if (expr.type === 'var') {
    return valueToWgsl(expr, ctx);
  }

  // Get operation and args
  const op = expr.expr || expr.op;
  const args = expr.args || [];

  if (!op) {
    if (expr.value !== undefined) {
      return formatFloat(expr.value);
    }
    return '0.0';
  }

  // Convert args
  const a = args.map(arg => exprToWgsl(arg, ctx));

  switch (op) {
    // Arithmetic
    case 'add':
      return `(${a.join(' + ')})`;
    case 'sub':
      return `(${a[0]} - ${a[1]})`;
    case 'mul':
      return `(${a.join(' * ')})`;
    case 'div':
      return `(${a[0]} / ${a[1]})`;
    case 'mod':
      return `(${a[0]} % ${a[1]})`;
    case 'neg':
      return `(-${a[0]})`;

    // Rounding/Abs
    case 'abs':
      return `abs(${a[0]})`;
    case 'floor':
      return `floor(${a[0]})`;
    case 'ceil':
      return `ceil(${a[0]})`;
    case 'fract':
      return `fract(${a[0]})`;
    case 'round':
      return `round(${a[0]})`;

    // Trigonometric
    case 'sin':
      return `sin(${a[0]})`;
    case 'cos':
      return `cos(${a[0]})`;
    case 'tan':
      return `tan(${a[0]})`;
    case 'asin':
      return `asin(${a[0]})`;
    case 'acos':
      return `acos(${a[0]})`;
    case 'atan':
      return a.length > 1 ? `atan2(${a[0]}, ${a[1]})` : `atan(${a[0]})`;

    // Powers/Exp
    case 'pow':
      return `pow(${a[0]}, ${a[1]})`;
    case 'sqrt':
      return `sqrt(${a[0]})`;
    case 'exp':
      return `exp(${a[0]})`;
    case 'log':
      return `log(${a[0]})`;

    // Comparison/Blend
    case 'min':
      return a.length > 2
        ? a.reduce((acc, v) => `min(${acc}, ${v})`)
        : `min(${a[0]}, ${a[1]})`;
    case 'max':
      return a.length > 2
        ? a.reduce((acc, v) => `max(${acc}, ${v})`)
        : `max(${a[0]}, ${a[1]})`;
    case 'clamp':
      return `clamp(${a[0]}, ${a[1]}, ${a[2]})`;
    case 'step':
      return `step(${a[0]}, ${a[1]})`;
    case 'smoothstep':
      return `smoothstep(${a[0]}, ${a[1]}, ${a[2]})`;
    case 'mix':
    case 'lerp':
      return `mix(${a[0]}, ${a[1]}, ${a[2]})`;

    // Noise functions
    case 'noise':
      ctx.needsNoise = true;
      return `noise3(vec3f(${a.join(', ')}))`;
    case 'fbm':
      ctx.needsNoise = true;
      const octaves = a[3] || '4';
      return `fbm(vec3f(${a[0]}, ${a[1]}, ${a[2]}), ${octaves})`;
    case 'turbulence':
      ctx.needsNoise = true;
      const turbOctaves = a[3] || '4';
      return `turbulence(vec3f(${a[0]}, ${a[1]}, ${a[2]}), ${turbOctaves})`;
    case 'hash':
      ctx.needsNoise = true;
      return `hash(${a[0]})`;

    // Vector construction
    case 'vec2':
      return `vec2f(${a[0]}, ${a[1]})`;
    case 'vec3':
      return `vec3f(${a[0]}, ${a[1]}, ${a[2]})`;
    case 'vec4':
      return `vec4f(${a[0]}, ${a[1]}, ${a[2]}, ${a[3]})`;

    // Vector ops
    case 'length':
      return `length(${a[0]})`;
    case 'normalize':
      return `normalize(${a[0]})`;
    case 'dot':
      return `dot(${a[0]}, ${a[1]})`;
    case 'cross':
      return `cross(${a[0]}, ${a[1]})`;

    default:
      console.warn(`Unknown expression op: ${op}`);
      return '0.0';
  }
}

// ============================================
// Transform application
// ============================================

function applyTransform(pVar, transform, ctx) {
  if (!transform) return pVar;

  let result = pVar;

  // Apply translate
  if (transform.translate) {
    const t = valueToWgsl(transform.translate, ctx);
    result = `(${result} - ${t})`;
  }

  // Apply rotation - support both object {x, y, z} and array [x, y, z] formats
  if (transform.rotate) {
    const rot = transform.rotate;

    // Handle array format [x, y, z] (degrees)
    if (Array.isArray(rot)) {
      const toRad = (deg) => `(${valueToWgsl(deg, ctx)} * 0.01745329)`;
      if (rot[0] !== 0 && rot[0] !== undefined) {
        result = `rotX(${result}, ${toRad(rot[0])})`;
      }
      if (rot[1] !== 0 && rot[1] !== undefined) {
        result = `rotY(${result}, ${toRad(rot[1])})`;
      }
      if (rot[2] !== 0 && rot[2] !== undefined) {
        result = `rotZ(${result}, ${toRad(rot[2])})`;
      }
    }
    // Handle object format {x, y, z} (radians)
    else {
      if (rot.x !== undefined) {
        const angle = valueToWgsl(rot.x, ctx);
        result = `rotX(${result}, ${angle})`;
      }
      if (rot.y !== undefined) {
        const angle = valueToWgsl(rot.y, ctx);
        result = `rotY(${result}, ${angle})`;
      }
      if (rot.z !== undefined) {
        const angle = valueToWgsl(rot.z, ctx);
        result = `rotZ(${result}, ${angle})`;
      }
      if (rot.axis && rot.angle !== undefined) {
        const axis = valueToWgsl(rot.axis, ctx);
        const angle = valueToWgsl(rot.angle, ctx);
        result = `rotAxisAngle(${result}, ${axis}, ${angle})`;
      }
    }
  }

  return result;
}

// ============================================
// Rotation helpers
// ============================================

function extractRotation(transform) {
  if (!transform || !transform.rotate) return null;
  return transform.rotate;
}

function isStaticRotation(rot) {
  if (!rot) return false;
  const checkStatic = (v) => {
    if (v === undefined) return true;
    if (typeof v === 'number') return true;
    if (v.type === 'const') return true;
    return false;
  };
  return checkStatic(rot.x) && checkStatic(rot.y) && checkStatic(rot.z);
}

function addRotations(a, b) {
  const getVal = (v) => {
    if (v === undefined) return 0;
    if (typeof v === 'number') return v;
    if (v.type === 'const') return v.value;
    return 0;
  };
  return {
    x: getVal(a.x) + getVal(b.x),
    y: getVal(a.y) + getVal(b.y),
    z: getVal(a.z) + getVal(b.z)
  };
}

// ============================================
// WGSL Primitive Functions
// ============================================

function generatePrimitiveFunctions() {
  return `
// Primitive SDFs
fn sdSphere(p: vec3f, r: f32) -> f32 {
  return length(p) - r;
}

fn sdBox(p: vec3f, b: vec3f) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn sdTorus(p: vec3f, t: vec2f) -> f32 {
  let q = vec2f(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

fn sdCylinder(p: vec3f, h: f32, r: f32) -> f32 {
  let d = abs(vec2f(length(p.xz), p.y)) - vec2f(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, vec2f(0.0)));
}

fn sdCapsule(p_in: vec3f, h: f32, r: f32) -> f32 {
  var p = p_in;
  p.y -= clamp(p.y, -h, h);
  return length(p) - r;
}

fn sdEllipsoid(p: vec3f, r: vec3f) -> f32 {
  let k0 = length(p / r);
  let k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}

fn sdCone(p: vec3f, h: f32, r: f32) -> f32 {
  let q = vec2f(length(p.xz), -p.y);
  let tip = vec2f(0.0, 0.0);
  let base = vec2f(r, h);
  let e = base - tip;
  let w = q - tip;
  let d1 = q - base * clamp(dot(q, base) / dot(base, base), 0.0, 1.0);
  let d2 = q - vec2f(clamp(q.x, 0.0, r), h);
  let s = max(dot(w, vec2f(e.y, -e.x)), q.y - h);
  return sqrt(min(dot(d1, d1), dot(d2, d2))) * sign(s);
}

fn sdRoundCone(p: vec3f, r1: f32, r2: f32, h: f32) -> f32 {
  let q = vec2f(length(p.xz), p.y);
  let b = (r1 - r2) / h;
  let a = sqrt(1.0 - b * b);
  let k = dot(q, vec2f(-b, a));
  if (k < 0.0) { return length(q) - r1; }
  if (k > a * h) { return length(q - vec2f(0.0, h)) - r2; }
  return dot(q, vec2f(a, b)) - r1;
}

fn sdPlane(p: vec3f, n: vec3f, h: f32) -> f32 {
  return dot(p, normalize(n)) + h;
}

`;
}

// ============================================
// WGSL Helper Functions
// ============================================

function generateHelperFunctions() {
  return `
// Smooth min for smooth union
fn smin(a: f32, b: f32, k: f32) -> f32 {
  let h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

// Rotation functions
fn rotX(p: vec3f, a: f32) -> vec3f {
  let c = cos(a);
  let s = sin(a);
  return vec3f(p.x, c*p.y - s*p.z, s*p.y + c*p.z);
}

fn rotY(p: vec3f, a: f32) -> vec3f {
  let c = cos(a);
  let s = sin(a);
  return vec3f(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);
}

fn rotZ(p: vec3f, a: f32) -> vec3f {
  let c = cos(a);
  let s = sin(a);
  return vec3f(c*p.x - s*p.y, s*p.x + c*p.y, p.z);
}

fn rotAxisAngle(p: vec3f, axis: vec3f, angle: f32) -> vec3f {
  let c = cos(angle);
  let s = sin(angle);
  let oc = 1.0 - c;
  let a = normalize(axis);
  let m0 = vec3f(oc * a.x * a.x + c, oc * a.x * a.y + a.z * s, oc * a.x * a.z - a.y * s);
  let m1 = vec3f(oc * a.x * a.y - a.z * s, oc * a.y * a.y + c, oc * a.y * a.z + a.x * s);
  let m2 = vec3f(oc * a.x * a.z + a.y * s, oc * a.y * a.z - a.x * s, oc * a.z * a.z + c);
  return vec3f(dot(m0, p), dot(m1, p), dot(m2, p));
}

// Hash functions
fn hash(n: f32) -> f32 {
  return fract(sin(n) * 43758.5453123);
}

fn hash3(p: vec3f) -> f32 {
  return fract(sin(dot(p, vec3f(12.9898, 78.233, 45.164))) * 43758.5453);
}

// 3D value noise
fn noise3(p: vec3f) -> f32 {
  let i = floor(p);
  var f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  let n = i.x + i.y * 57.0 + i.z * 113.0;
  return mix(
    mix(mix(hash(n), hash(n + 1.0), f.x),
        mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
    mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
        mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y),
    f.z);
}

// Fractal Brownian Motion
fn fbm(p: vec3f, octaves: i32) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var frequency = 1.0;
  for (var i = 0; i < 6; i++) {
    if (i >= octaves) { break; }
    value += amplitude * noise3(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// Turbulence
fn turbulence(p: vec3f, octaves: i32) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var frequency = 1.0;
  for (var i = 0; i < 6; i++) {
    if (i >= octaves) { break; }
    value += amplitude * abs(noise3(p * frequency) * 2.0 - 1.0);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

`;
}
