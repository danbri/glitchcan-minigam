/**
 * JSON to GLSL Codegen - Generate GLSL from JSON node IR
 */

/**
 * Generate GLSL code from processed JSON scene
 */
export function generateGlslFromJson(scene) {
  const ctx = {
    uniforms: new Set(),
    functions: [],
    nodeCounter: 0
  };

  // Generate main scene function
  const mainCode = generateNodeGlsl(scene.root, ctx);

  // Build final shader
  let glsl = '';

  // Add uniforms
  if (ctx.uniforms.size > 0) {
    glsl += '// Uniforms\n';
    for (const uniform of ctx.uniforms) {
      glsl += `uniform float ${uniform};\n`;
    }
    glsl += '\n';
  }

  // Add SDF primitive functions
  glsl += generatePrimitiveFunctions();

  // Add helper functions
  glsl += generateHelperFunctions();

  // Add generated functions
  if (ctx.functions.length > 0) {
    glsl += '// Generated functions\n';
    glsl += ctx.functions.join('\n\n');
    glsl += '\n\n';
  }

  // Add main scene function
  glsl += '// Main scene SDF\n';
  glsl += 'vec4 g_df_scene(vec3 p) {\n';
  glsl += `  ${mainCode}\n`;
  glsl += '}\n';

  return glsl;
}

/**
 * Generate GLSL for a node
 */
function generateNodeGlsl(node, ctx, parentTransform = null) {
  const nodeId = `n${ctx.nodeCounter++}`;

  switch (node.type) {
    case 'sphere':
      return generatePrimitive('sdSphere', node, ctx, parentTransform);

    case 'box':
      return generatePrimitive('sdBox', node, ctx, parentTransform);

    case 'torus':
      return generatePrimitive('sdTorus', node, ctx, parentTransform);

    case 'cylinder':
      return generatePrimitive('sdCylinder', node, ctx, parentTransform);

    case 'union':
      return generateCSG('min', node, ctx, parentTransform);

    case 'subtract':
      return generateSubtract(node, ctx, parentTransform);

    case 'intersect':
      return generateCSG('max', node, ctx, parentTransform);

    case 'smoothUnion':
      return generateSmoothCSG('smin', node, ctx, parentTransform);

    case 'transform':
      return generateTransform(node, ctx, parentTransform);

    case 'group':
      return generateGroup(node, ctx, parentTransform);

    case 'material':
      return generateMaterial(node, ctx, parentTransform);

    case 'ref':
      // Expand and generate
      const expanded = node.def || node;
      return generateNodeGlsl(expanded, ctx, parentTransform);

    default:
      console.warn(`Unhandled node type in codegen: ${node.type}`);
      return 'return vec4(1000.0, 1.0, 0.0, 1.0); // error';
  }
}

/**
 * Generate GLSL for a primitive
 */
function generatePrimitive(funcName, node, ctx, parentTransform) {
  const params = node.params || {};

  // Build parameter list
  let args = [];

  if (funcName === 'sdSphere') {
    const r = valueToGlsl(params.r || { type: 'const', value: 1.0 }, ctx);
    args = [r];
  } else if (funcName === 'sdBox') {
    const size = valueToGlsl(params.size || { type: 'array', values: [1, 1, 1].map(v => ({ type: 'const', value: v })) }, ctx);
    args = [size];
  } else if (funcName === 'sdTorus') {
    const major = valueToGlsl(params.major || { type: 'const', value: 1.0 }, ctx);
    const minor = valueToGlsl(params.minor || { type: 'const', value: 0.3 }, ctx);
    args = [`vec2(${major}, ${minor})`];
  } else if (funcName === 'sdCylinder') {
    const h = valueToGlsl(params.h || { type: 'const', value: 1.0 }, ctx);
    const r = valueToGlsl(params.r || { type: 'const', value: 0.5 }, ctx);
    args = [h, r];
  }

  // Apply transform
  const pExpr = applyTransform('p', node.transform || parentTransform, ctx);

  // Get color
  const color = params.color
    ? valueToGlsl(params.color, ctx)
    : 'vec3(0.8, 0.8, 0.8)';

  return `return vec4(${funcName}(${pExpr}, ${args.join(', ')}), ${color});`;
}

/**
 * Generate GLSL for CSG operation
 */
function generateCSG(op, node, ctx, parentTransform) {
  const children = node.children || [];

  if (children.length === 0) {
    return 'return vec4(1000.0, 1.0, 0.0, 1.0);';
  }

  if (children.length === 1) {
    return generateNodeGlsl(children[0], ctx, parentTransform);
  }

  const childResults = children.map((child, i) => {
    const childCode = generateNodeGlsl(child, ctx, parentTransform);
    return `  vec4 c${i} = (function() { ${childCode} })();\n`;
  }).join('');

  const distOp = children.map((_, i) => `c${i}.x`).join(`, `);

  return `{\n${childResults}  float d = ${op}(${distOp});\n  vec3 col = c0.yzw;\n  return vec4(d, col);\n}`;
}

/**
 * Generate subtract (special case)
 */
function generateSubtract(node, ctx, parentTransform) {
  const children = node.children || [];

  if (children.length === 0) {
    return 'return vec4(1000.0, 1.0, 0.0, 1.0);';
  }

  const baseCode = generateNodeGlsl(children[0], ctx, parentTransform);

  if (children.length === 1) {
    return baseCode;
  }

  let code = `{\n  vec4 base = (function() { ${baseCode} })();\n`;

  for (let i = 1; i < children.length; i++) {
    const subCode = generateNodeGlsl(children[i], ctx, parentTransform);
    code += `  vec4 sub${i} = (function() { ${subCode} })();\n`;
    code += `  base.x = max(base.x, -sub${i}.x);\n`;
  }

  code += '  return base;\n}';
  return code;
}

/**
 * Generate smooth CSG
 */
function generateSmoothCSG(funcName, node, ctx, parentTransform) {
  const k = valueToGlsl(node.k || { type: 'const', value: 0.1 }, ctx);
  const children = node.children || [];

  if (children.length < 2) {
    return children.length === 1
      ? generateNodeGlsl(children[0], ctx, parentTransform)
      : 'return vec4(1000.0, 1.0, 0.0, 1.0);';
  }

  // Generate for first two children, then fold
  let code = '{\n';
  code += `  vec4 a = (function() { ${generateNodeGlsl(children[0], ctx, parentTransform)} })();\n`;
  code += `  vec4 b = (function() { ${generateNodeGlsl(children[1], ctx, parentTransform)} })();\n`;
  code += `  float d = ${funcName}(a.x, b.x, ${k});\n`;
  code += '  return vec4(d, a.yzw);\n}';

  return code;
}

/**
 * Generate transform wrapper
 */
function generateTransform(node, ctx, parentTransform) {
  const combinedTransform = combineTransforms(parentTransform, node.transform);
  return generateNodeGlsl(node.child, ctx, combinedTransform);
}

/**
 * Generate group
 */
function generateGroup(node, ctx, parentTransform) {
  const combinedTransform = combineTransforms(parentTransform, node.transform);

  // Union all children
  const unionNode = {
    type: 'union',
    children: node.children
  };

  return generateNodeGlsl(unionNode, ctx, combinedTransform);
}

/**
 * Generate material wrapper
 */
function generateMaterial(node, ctx, parentTransform) {
  const childCode = generateNodeGlsl(node.child, ctx, parentTransform);

  // Override color if specified
  if (node.params && node.params.color) {
    const color = valueToGlsl(node.params.color, ctx);
    return `{\n  vec4 result = (function() { ${childCode} })();\n  result.yzw = ${color};\n  return result;\n}`;
  }

  return childCode;
}

/**
 * Convert a value to GLSL expression
 */
function valueToGlsl(value, ctx) {
  if (!value) return '0.0';

  switch (value.type) {
    case 'const':
      return String(value.value);

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

  // Apply rotate (Euler angles)
  if (transform.rotate) {
    const r = valueToGlsl(transform.rotate, ctx);
    // TODO: Generate rotation matrix code
    result = `rotateEuler(${result}, ${r})`;
  }

  // Apply scale
  if (transform.scale) {
    const s = valueToGlsl(transform.scale, ctx);
    result = `(${result} / ${s})`;
  }

  return result;
}

/**
 * Combine two transforms
 */
function combineTransforms(parent, child) {
  if (!parent) return child;
  if (!child) return parent;

  // TODO: Proper matrix composition
  return { ...parent, ...child };
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

// Rotation helpers (placeholder)
vec3 rotateEuler(vec3 p, vec3 euler) {
  // TODO: Implement proper Euler rotation
  return p;
}

`;
}
