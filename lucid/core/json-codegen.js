/**
 * JSON to GLSL Codegen - Generate GLSL from JSON node IR
 * Refactored: walkNode returns expressions, not return statements
 */

/**
 * Generate GLSL code from processed JSON scene
 */
export function generateGlslFromJson(scene) {
  const ctx = {
    uniforms: new Set(),
    functions: [],
    helpers: [],
    helperCounter: 0
  };

  // Generate main scene expression
  const sceneExpr = walkNode(scene.root, ctx);

  // Build final shader
  let glsl = '';

  // Note: u_time, u_resolution, u_cameraPos etc. are already declared
  // by raymarcher.js - we only declare additional custom uniforms here
  const builtinUniforms = new Set(['u_time', 'u_resolution', 'u_cameraPos', 'u_cameraTarget', 'u_showGroundPlane', 'u_volumeRender']);
  const customUniforms = [...ctx.uniforms].filter(u => !builtinUniforms.has(u));

  if (customUniforms.length > 0) {
    glsl += '// Custom uniforms\n';
    for (const uniform of customUniforms) {
      glsl += `uniform float ${uniform};\n`;
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

/**
 * Walk node and generate GLSL expression (not a statement)
 * Returns a string that evaluates to vec4(distance, r, g, b)
 */
function walkNode(node, ctx) {
  switch (node.type) {
    case 'sphere':
      return generateSphere(node, ctx);

    case 'box':
      return generateBox(node, ctx);

    case 'torus':
      return generateTorus(node, ctx);

    case 'cylinder':
      return generateCylinder(node, ctx);

    case 'union':
      return generateUnion(node, ctx);

    case 'subtract':
      return generateSubtract(node, ctx);

    case 'intersect':
      return generateIntersect(node, ctx);

    case 'smoothUnion':
      return generateSmoothUnion(node, ctx);

    case 'transform':
      return generateTransform(node, ctx);

    case 'group':
      return generateGroup(node, ctx);

    case 'material':
      return generateMaterial(node, ctx);

    case 'ref':
      return generateRef(node, ctx);

    default:
      console.warn(`Unhandled node type: ${node.type}`);
      return 'vec4(1000.0, 1.0, 0.0, 1.0)';
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
 */
function generateUnion(node, ctx) {
  let children = node.children || [];

  if (children.length === 0) {
    return 'vec4(1000.0, 1.0, 0.0, 1.0)';
  }

  // Propagate node's transform to all children
  if (node.transform) {
    children = children.map(child => ({
      ...child,
      transform: combineTransforms(child.transform, node.transform)
    }));
  }

  if (children.length === 1) {
    return walkNode(children[0], ctx);
  }

  // Generate helper function for this union
  const funcName = `union_${ctx.helperCounter++}`;

  // Generate child expressions as direct assignments
  const childAssignments = children.map((child, i) => {
    const childExpr = walkNode(child, ctx);
    return `  vec4 c${i} = ${childExpr};`;
  }).join('\n');

  // Select color from closest child using sequential comparisons (O(n) code size)
  // Avoids exponential growth from nested ternaries
  let colorSelect;
  if (children.length === 2) {
    colorSelect = '\n  return c0.x < c1.x ? c0 : c1;';
  } else {
    // Sequential comparisons - each line is O(1), total O(n)
    colorSelect = '\n  vec4 nearest = c0;';
    for (let i = 1; i < children.length; i++) {
      colorSelect += `\n  nearest = nearest.x < c${i}.x ? nearest : c${i};`;
    }
    colorSelect += '\n  return nearest;';
  }

  const helperFunc = `vec4 ${funcName}(vec3 p) {
${childAssignments}${colorSelect}
}`;

  ctx.helpers.push(helperFunc);

  return `${funcName}(p)`;
}

/**
 * Generate subtract - creates helper function, returns call expression
 */
function generateSubtract(node, ctx) {
  let children = node.children || [];

  if (children.length === 0) {
    return 'vec4(1000.0, 1.0, 0.0, 1.0)';
  }

  // Propagate node's transform to all children
  if (node.transform) {
    children = children.map(child => ({
      ...child,
      transform: combineTransforms(child.transform, node.transform)
    }));
  }

  if (children.length === 1) {
    return walkNode(children[0], ctx);
  }

  // Generate helper function
  const funcName = `subtract_${ctx.helperCounter++}`;

  const baseExpr = walkNode(children[0], ctx);
  let body = `  vec4 base = ${baseExpr};\n`;

  for (let i = 1; i < children.length; i++) {
    const subExpr = walkNode(children[i], ctx);
    body += `  vec4 sub${i} = ${subExpr};\n`;
    body += `  base.x = max(base.x, -sub${i}.x);\n`;
  }

  const helperFunc = `vec4 ${funcName}(vec3 p) {
${body}  return base;
}`;

  ctx.helpers.push(helperFunc);

  return `${funcName}(p)`;
}

/**
 * Generate intersect - creates helper function, returns call expression
 */
function generateIntersect(node, ctx) {
  let children = node.children || [];

  if (children.length === 0) {
    return 'vec4(1000.0, 1.0, 0.0, 1.0)';
  }

  // Propagate node's transform to all children
  if (node.transform) {
    children = children.map(child => ({
      ...child,
      transform: combineTransforms(child.transform, node.transform)
    }));
  }

  if (children.length === 1) {
    return walkNode(children[0], ctx);
  }

  // Generate helper function
  const funcName = `intersect_${ctx.helperCounter++}`;

  const childAssignments = children.map((child, i) => {
    const childExpr = walkNode(child, ctx);
    return `  vec4 c${i} = ${childExpr};`;
  }).join('\n');

  // Select color from child with largest distance using sequential comparisons (O(n) code size)
  // Avoids exponential growth from nested ternaries
  let colorSelect;
  if (children.length === 2) {
    colorSelect = '\n  return c0.x > c1.x ? c0 : c1;';
  } else {
    // Sequential comparisons - each line is O(1), total O(n)
    colorSelect = '\n  vec4 farthest = c0;';
    for (let i = 1; i < children.length; i++) {
      colorSelect += `\n  farthest = farthest.x > c${i}.x ? farthest : c${i};`;
    }
    colorSelect += '\n  return farthest;';
  }

  const helperFunc = `vec4 ${funcName}(vec3 p) {
${childAssignments}${colorSelect}
}`;

  ctx.helpers.push(helperFunc);

  return `${funcName}(p)`;
}

/**
 * Generate smooth union - creates helper function, returns call expression
 */
function generateSmoothUnion(node, ctx) {
  let children = node.children || [];
  const k = valueToGlsl(node.k || { type: 'const', value: 0.1 }, ctx);

  if (children.length === 0) {
    return 'vec4(1000.0, 1.0, 0.0, 1.0)';
  }

  // Propagate node's transform to all children
  if (node.transform) {
    children = children.map(child => ({
      ...child,
      transform: combineTransforms(child.transform, node.transform)
    }));
  }

  if (children.length === 1) {
    return walkNode(children[0], ctx);
  }

  // Generate helper function
  const funcName = `smoothUnion_${ctx.helperCounter++}`;

  const child0Expr = walkNode(children[0], ctx);
  const child1Expr = walkNode(children[1], ctx);

  // Blend colors based on smooth union blend factor
  const helperFunc = `vec4 ${funcName}(vec3 p) {
  vec4 a = ${child0Expr};
  vec4 b = ${child1Expr};
  float h = clamp(0.5 + 0.5 * (b.x - a.x) / ${k}, 0.0, 1.0);
  float d = mix(b.x, a.x, h) - ${k} * h * (1.0 - h);
  vec3 col = mix(b.yzw, a.yzw, h);
  return vec4(d, col);
}`;

  ctx.helpers.push(helperFunc);

  return `${funcName}(p)`;
}

/**
 * Generate transform wrapper - propagates transform to child
 */
function generateTransform(node, ctx) {
  // Combine transforms and apply to child
  const childWithTransform = {
    ...node.child,
    transform: combineTransforms(node.child.transform, node.transform)
  };
  return walkNode(childWithTransform, ctx);
}

/**
 * Generate ref - expand definition with any parent transform
 */
function generateRef(node, ctx) {
  // Get the processed definition
  const def = node.def;
  if (!def) {
    console.warn(`Ref node missing definition: ${node.refId}`);
    return 'vec4(1000.0, 1.0, 0.0, 1.0)';
  }

  // If this ref has a transform from parent, apply it to the def
  if (node.transform) {
    const defWithTransform = {
      ...def,
      transform: combineTransforms(def.transform, node.transform)
    };
    return walkNode(defWithTransform, ctx);
  }

  return walkNode(def, ctx);
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
 * Generate material wrapper - creates helper to override color
 */
function generateMaterial(node, ctx) {
  const childExpr = walkNode(node.child, ctx);

  if (node.params && node.params.color) {
    const color = valueToGlsl(node.params.color, ctx);

    // Generate helper to override color
    const funcName = `material_${ctx.helperCounter++}`;
    const helperFunc = `vec4 ${funcName}(vec3 p) {
  vec4 c = ${childExpr};
  return vec4(c.x, ${color});
}`;
    ctx.helpers.push(helperFunc);
    return `${funcName}(p)`;
  }

  return childExpr;
}

/**
 * Convert a value to GLSL expression
 */
function valueToGlsl(value, ctx) {
  if (!value) return '0.0';

  switch (value.type) {
    case 'const':
      // Ensure floats have decimal point for GLSL
      const num = value.value;
      if (Number.isInteger(num)) {
        return num + '.0';
      }
      return String(num);

    case 'var':
      ctx.uniforms.add(`u_${value.name}`);
      return `u_${value.name}`;

    case 'array':
      const components = value.values.map(v => valueToGlsl(v, ctx));
      return `vec${components.length}(${components.join(', ')})`;

    case 'expr':
      return exprToGlsl(value, ctx);

    default:
      return '0.0';
  }
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
    case 'sin': return `sin(${args[0]})`;
    case 'cos': return `cos(${args[0]})`;
    case 'tan': return `tan(${args[0]})`;
    case 'min': return `min(${args.join(', ')})`;
    case 'max': return `max(${args.join(', ')})`;
    case 'neg': return `(-${args[0]})`;
    case 'clamp': return `clamp(${args[0]}, ${args[1]}, ${args[2]})`;
    case 'smoothstep': return `smoothstep(${args[0]}, ${args[1]}, ${args[2]})`;
    default:
      console.warn(`Unknown expression op: ${expr.op}`);
      return '0.0';
  }
}

/**
 * Apply transform to position variable
 */
function applyTransform(pVar, transform, ctx) {
  if (!transform) return pVar;

  let result = pVar;

  // Apply translate
  if (transform.translate) {
    const t = valueToGlsl(transform.translate, ctx);
    result = `(${result} - ${t})`;
  }

  // Apply scale (TODO: implement)
  // Apply rotate (TODO: implement)

  return result;
}

/**
 * Combine two transforms - translations are added, others merged
 */
function combineTransforms(child, parent) {
  if (!parent) return child;
  if (!child) return parent;

  const combined = { ...parent };

  // Combine translations additively
  if (parent.translate && child.translate) {
    combined.translate = addValues(parent.translate, child.translate);
  } else if (child.translate) {
    combined.translate = child.translate;
  }

  // TODO: Proper rotation/scale composition
  if (child.rotate) combined.rotate = child.rotate;
  if (child.scale) combined.scale = child.scale;

  return combined;
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

`;
}
