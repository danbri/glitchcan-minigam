/**
 * JSON to GLSL Codegen - Generate GLSL from JSON node IR
 * Refactored: walkNode returns expressions, not return statements
 */

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
    showCutters: options.showCutters || false
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

    case 'capsule':
      return generateCapsule(node, ctx);

    case 'ellipsoid':
      return generateEllipsoid(node, ctx);

    case 'cone':
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
 * A cone with height h and base radius r, tip at origin pointing up
 */
function generateCone(node, ctx) {
  const params = node.params || {};
  const h = valueToGlsl(params.h || { type: 'const', value: 1.0 }, ctx);
  const r = valueToGlsl(params.r || { type: 'const', value: 0.5 }, ctx);
  const p = applyTransform('p', node.transform, ctx);
  const color = valueToGlsl(params.color || { type: 'array', values: [0.8, 0.8, 0.8].map(v => ({ type: 'const', value: v })) }, ctx);

  return `vec4(sdCone(${p}, ${h}, ${r}), ${color})`;
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
    if (ctx.showCutters) {
      // Debug mode: show cutters as union (min) instead of subtract (max of negated)
      body += `  if (sub${i}.x < base.x) base = sub${i};\n`;
    } else {
      // Normal subtract: base.x = max(base.x, -sub.x)
      body += `  base.x = max(base.x, -sub${i}.x);\n`;
    }
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
 * Generate material wrapper - creates helper to override color and material properties
 * Supports: color, emit (emissive), metallic, roughness
 *
 * Output format: vec4(distance, r, g, b)
 * Material properties are encoded in the color channels using the following convention:
 * - RGB carries base color modulated by (1 + emit) for emission
 * - Future: Could pack metallic/roughness into alpha or additional output channels
 */
function generateMaterial(node, ctx) {
  const childExpr = walkNode(node.child, ctx);
  const params = node.params || {};

  // If no material params specified, pass through
  if (!params.color && params.emit === undefined && params.metallic === undefined && params.roughness === undefined) {
    return childExpr;
  }

  // Generate helper to apply material
  const funcName = `material_${ctx.helperCounter++}`;

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
  const helperFunc = `vec4 ${funcName}(vec3 p) {
  vec4 c = ${childExpr};
  vec3 baseColor = ${color};
  float emissive = ${emit};
  // Apply emission as additive boost to color
  vec3 finalColor = baseColor * (1.0 + emissive * 2.0);
  return vec4(c.x, finalColor);
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(p)`;
}

/**
 * Generate mirror - reflection symmetry
 * axis can be "x", "y", "z", "xy", "xz", "yz", "xyz"
 */
function generateMirror(node, ctx) {
  const axis = node.axis || 'x';

  // Wrap the child in its own helper function
  const childFuncName = `mirror_child_${ctx.helperCounter++}`;
  const childExpr = walkNode(node.child, ctx);
  ctx.helpers.push(`vec4 ${childFuncName}(vec3 p) {
  return ${childExpr};
}`);

  // Now generate the mirror wrapper
  const funcName = `mirror_${ctx.helperCounter++}`;

  // Build the mirror transform
  let mirrorCode = '';
  if (axis.includes('x')) mirrorCode += '  q.x = abs(q.x);\n';
  if (axis.includes('y')) mirrorCode += '  q.y = abs(q.y);\n';
  if (axis.includes('z')) mirrorCode += '  q.z = abs(q.z);\n';

  // Apply any transform from the mirror node itself
  const p = applyTransform('p', node.transform, ctx);

  const helperFunc = `vec4 ${funcName}(vec3 p) {
  vec3 q = ${p};
${mirrorCode}  return ${childFuncName}(q);
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(p)`;
}

/**
 * Generate radial - rotational symmetry around an axis
 * count: number of repetitions
 * axis: "x", "y", or "z" (default "y")
 */
function generateRadial(node, ctx) {
  const count = node.count || 6;
  const axis = node.axis || 'y';

  // Wrap the child in its own helper function
  const childFuncName = `radial_child_${ctx.helperCounter++}`;
  const childExpr = walkNode(node.child, ctx);
  ctx.helpers.push(`vec4 ${childFuncName}(vec3 p) {
  return ${childExpr};
}`);

  // Now generate the radial wrapper
  const funcName = `radial_${ctx.helperCounter++}`;

  // Apply any transform from the radial node itself
  const p = applyTransform('p', node.transform, ctx);

  // TAU = 2*PI
  const segment = (2 * Math.PI / count).toFixed(6);

  // Build radial fold code based on axis
  let radialCode;
  if (axis === 'y') {
    radialCode = `  float angle = atan(q.z, q.x);
  float segment = ${segment};
  angle = mod(angle + segment * 0.5, segment) - segment * 0.5;
  float r = length(q.xz);
  q = vec3(r * cos(angle), q.y, r * sin(angle));`;
  } else if (axis === 'x') {
    radialCode = `  float angle = atan(q.z, q.y);
  float segment = ${segment};
  angle = mod(angle + segment * 0.5, segment) - segment * 0.5;
  float r = length(q.yz);
  q = vec3(q.x, r * cos(angle), r * sin(angle));`;
  } else { // z
    radialCode = `  float angle = atan(q.y, q.x);
  float segment = ${segment};
  angle = mod(angle + segment * 0.5, segment) - segment * 0.5;
  float r = length(q.xy);
  q = vec3(r * cos(angle), r * sin(angle), q.z);`;
  }

  const helperFunc = `vec4 ${funcName}(vec3 p) {
  vec3 q = ${p};
${radialCode}
  return ${childFuncName}(q);
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(p)`;
}

/**
 * Generate repeat - infinite tiling
 * period: [x, y, z] - spacing between repetitions (0 = no repeat on that axis)
 */
function generateRepeat(node, ctx) {
  const period = node.period || [2, 0, 2];

  // Wrap the child in its own helper function
  const childFuncName = `repeat_child_${ctx.helperCounter++}`;
  const childExpr = walkNode(node.child, ctx);
  ctx.helpers.push(`vec4 ${childFuncName}(vec3 p) {
  return ${childExpr};
}`);

  // Now generate the repeat wrapper
  const funcName = `repeat_${ctx.helperCounter++}`;

  // Apply any transform from the repeat node itself
  const p = applyTransform('p', node.transform, ctx);

  // Build repeat code - only repeat on non-zero axes
  let repeatCode = '';
  if (period[0] > 0) {
    repeatCode += `  q.x = mod(q.x + ${(period[0]/2).toFixed(4)}, ${period[0].toFixed(4)}) - ${(period[0]/2).toFixed(4)};\n`;
  }
  if (period[1] > 0) {
    repeatCode += `  q.y = mod(q.y + ${(period[1]/2).toFixed(4)}, ${period[1].toFixed(4)}) - ${(period[1]/2).toFixed(4)};\n`;
  }
  if (period[2] > 0) {
    repeatCode += `  q.z = mod(q.z + ${(period[2]/2).toFixed(4)}, ${period[2].toFixed(4)}) - ${(period[2]/2).toFixed(4)};\n`;
  }

  const helperFunc = `vec4 ${funcName}(vec3 p) {
  vec3 q = ${p};
${repeatCode}  return ${childFuncName}(q);
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(p)`;
}

/**
 * Generate round modifier - adds radius to soften edges
 * round(sdf) = sdf - r
 */
function generateRound(node, ctx) {
  const childExpr = walkNode(node.child, ctx);
  const r = node.r !== undefined ? valueToGlsl(node.r, ctx) : '0.05';

  const funcName = `round_${ctx.helperCounter++}`;
  const p = applyTransform('p', node.transform, ctx);

  const helperFunc = `vec4 ${funcName}(vec3 p) {
  vec4 c = ${childExpr.replace(/\bp\b/g, `(${p})`)};
  return vec4(c.x - ${r}, c.yzw);
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(p)`;
}

/**
 * Generate shell modifier - hollows out shape with wall thickness
 * shell(sdf) = abs(sdf) - thickness
 */
function generateShell(node, ctx) {
  const childExpr = walkNode(node.child, ctx);
  const thickness = node.thickness !== undefined ? valueToGlsl(node.thickness, ctx) : '0.05';

  const funcName = `shell_${ctx.helperCounter++}`;
  const p = applyTransform('p', node.transform, ctx);

  const helperFunc = `vec4 ${funcName}(vec3 p) {
  vec4 c = ${childExpr.replace(/\bp\b/g, `(${p})`)};
  return vec4(abs(c.x) - ${thickness}, c.yzw);
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(p)`;
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
  const octaves = node.octaves || 4;
  const noiseType = node.noiseType || 'fbm'; // 'noise', 'fbm', or 'turbulence'

  const funcName = `displace_${ctx.helperCounter++}`;
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

  const helperFunc = `vec4 ${funcName}(vec3 p) {
  vec3 np = (${p}) * ${scale}${timeOffset};
  float disp = (${noiseCall} - 0.5) * 2.0 * ${amount};
  vec4 c = ${childExpr.replace(/\bp\b/g, `(${p})`)};
  return vec4(c.x + disp, c.yzw);
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(p)`;
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

  // If the expression uses u_time, ensure uniform is declared
  if (glslCode.includes('u_time')) {
    ctx.uniforms.add('u_time');
  }

  const helperFunc = `vec4 ${funcName}(vec3 p) {
  vec3 q = ${p};
  return ${glslCode.replace(/\bp\b/g, 'q')};
}`;

  ctx.helpers.push(helperFunc);
  return `${funcName}(p)`;
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
      // Expression-based rotation - wrap in radians conversion
      const rx = wrapDegreesToRadians(valueToGlsl(rot.values[0], ctx));
      const ry = wrapDegreesToRadians(valueToGlsl(rot.values[1], ctx));
      const rz = wrapDegreesToRadians(valueToGlsl(rot.values[2], ctx));
      // Apply rotations in XYZ order (X first, then Y, then Z)
      // For SDF point transform: apply in reverse order to the point
      result = `rotZ(${result}, ${rz})`;
      result = `rotY(${result}, ${ry})`;
      result = `rotX(${result}, ${rx})`;
    } else if (Array.isArray(rot)) {
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

  // Apply scale (TODO: implement)

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

  // Scale: child takes precedence (TODO: proper scale composition)
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
