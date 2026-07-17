/**
 * JSON Scene Loader - Parse JSON SDF scenes to internal IR
 * Supports the specification in sdf_draft_spec_alt_nodes.md
 */

/**
 * Parse a JSON SDF scene
 * @param {Object} json - Parsed JSON object
 * @returns {Object} Scene IR with nodes and metadata
 */
export function loadJsonScene(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid JSON scene: must be an object');
  }

  // Extract definitions and root
  const defs = json.defs || {};
  const root = json.root;

  if (!root) {
    throw new Error('JSON scene must have a "root" node');
  }

  // Build node registry
  const nodeRegistry = {
    defs: new Map(),
    root: null
  };

  // Register and process all definitions
  for (const [id, defNode] of Object.entries(defs)) {
    nodeRegistry.defs.set(id, processNode(defNode, nodeRegistry));
  }

  // Process root node
  nodeRegistry.root = processNode(root, nodeRegistry);

  return {
    version: json.version || '1.0',
    root: nodeRegistry.root,
    defs: nodeRegistry.defs,
    // Scene-level parameters for parametric rigging
    params: processSceneParams(json.params || {}),
    // Rig layer for constraint-based relationships (Phase 5)
    // Defines: derived params, bounds, phase coupling, chains
    rig: json.rig || null,
    // Physics configuration (bodies, constraints)
    physics: json.physics || null,
    // Pass through rendering hints
    quality: json.quality || 'medium',  // 'low', 'medium', 'high'
    camera: json.camera || null          // Optional camera settings
  };
}

/**
 * Process scene-level parameters
 * Supports typed parameters: scalar, color3, position3, radii3, direction3
 */
function processSceneParams(params) {
  const processed = {};
  for (const [name, param] of Object.entries(params)) {
    if (typeof param === 'number') {
      // Simple number shorthand
      processed[name] = { value: param, type: 'scalar' };
    } else if (Array.isArray(param)) {
      // Array shorthand - infer type from length
      processed[name] = {
        value: param,
        type: param.length === 3 ? 'position3' : 'array'
      };
    } else if (typeof param === 'object' && param !== null) {
      // Full parameter definition
      processed[name] = {
        value: param.value,
        type: param.type || 'scalar',
        min: param.min,
        max: param.max,
        step: param.step,
        // UI presentation metadata. `label` is the human-readable name shown in
        // param panels; `unit` (e.g. "m", "°", "x", "%", "rad") is rendered next
        // to the value. Both were previously dropped here, so a scene's `label`
        // silently never reached the panels.
        label: param.label,
        unit: param.unit
      };
    }
  }
  return processed;
}

const MAX_RECURSION_DEPTH = 100;

/**
 * Process a node recursively with depth limiting
 */
function processNode(node, registry, depth = 0) {
  if (depth > MAX_RECURSION_DEPTH) {
    console.warn(`Max recursion depth (${MAX_RECURSION_DEPTH}) exceeded, truncating tree`);
    return { type: 'sphere', params: { r: { type: 'const', value: 0.1 } } };
  }

  if (!node || !node.type) {
    throw new Error('Invalid node: missing "type" field');
  }

  const processed = {
    type: node.type,
    id: node.id || null
  };

  // Handle different node types
  switch (node.type) {
    // Primitives
    case 'sphere':
    case 'box':
    case 'torus':
    case 'cylinder':
    case 'capsule':
    case 'ellipsoid':
    case 'cone':
    case 'roundCone':
    case 'plane':
      processed.params = processParams(node.params || {});
      break;

    // CSG operations
    case 'union':
    case 'subtract':
    case 'intersect':
    case 'smoothUnion':
    case 'smoothSubtract':
    case 'smoothIntersect':
      processed.children = (node.children || []).map(child =>
        processNode(child, registry, depth + 1)
      );
      if (node.k !== undefined) {
        processed.k = processValue(node.k);
      }
      // BVH: Preserve bounding box for spatial optimization
      if (node.boundingBox) {
        processed.boundingBox = {
          center: node.boundingBox.center,
          halfSize: node.boundingBox.halfSize
        };
      }
      break;

    // Transform wrapper
    case 'transform':
      processed.transform = processTransform(node.transform || {});
      processed.child = processNode(node.child, registry, depth + 1);
      break;

    // Group
    case 'group':
      processed.children = (node.children || []).map(child =>
        processNode(child, registry, depth + 1)
      );
      if (node.transform) {
        processed.transform = processTransform(node.transform);
      }
      break;

    // Material wrapper
    case 'material':
      processed.params = processParams(node.params || {});
      processed.child = processNode(node.child, registry, depth + 1);
      break;

    // Mirror symmetry
    case 'mirror':
      processed.axis = node.axis || 'x';
      processed.child = processNode(node.child, registry, depth + 1);
      break;

    // Radial symmetry
    case 'radial':
      // Process count through processValue to handle variable expressions
      processed.count = processValue(node.count !== undefined ? node.count : 6);
      processed.axis = node.axis || 'y';
      processed.child = processNode(node.child, registry, depth + 1);
      break;

    // Infinite repeat/tiling
    case 'repeat':
      // Process period through processValue to handle variable expressions in array elements
      processed.period = processValue(node.period || [2, 0, 2]);
      if (node.exposeId) processed.exposeId = node.exposeId;  // Expose instance ID for per-instance variation
      processed.child = processNode(node.child, registry, depth + 1);
      break;

    // Conditional selection - pick one of two SDFs based on condition
    case 'select':
      processed.cond = processValue(node.cond);  // Expression evaluating to 0 or 1
      processed.a = processNode(node.a, registry, depth + 1);  // Selected when cond < 0.5
      processed.b = processNode(node.b, registry, depth + 1);  // Selected when cond >= 0.5
      break;

    // Round modifier - soften edges
    case 'round':
      processed.r = processValue(node.r !== undefined ? node.r : 0.05);
      processed.child = processNode(node.child, registry, depth + 1);
      break;

    // Shell modifier - hollow out shape
    case 'shell':
      processed.thickness = processValue(node.thickness !== undefined ? node.thickness : 0.05);
      processed.child = processNode(node.child, registry, depth + 1);
      break;

    // Displace modifier - noise-based surface displacement
    case 'displace':
      processed.amount = processValue(node.amount !== undefined ? node.amount : 0.1);
      processed.scale = processValue(node.scale !== undefined ? node.scale : 3.0);
      processed.octaves = node.octaves || 4;
      processed.noiseType = node.noiseType || 'fbm';
      processed.animate = node.animate || false;
      processed.child = processNode(node.child, registry, depth + 1);
      break;

    // Reference to definition
    case 'ref':
      if (!node.id) {
        throw new Error('ref node must have "id" field');
      }
      const def = registry.defs.get(node.id);
      if (!def) {
        throw new Error(`Reference to undefined definition: ${node.id}`);
      }
      processed.refId = node.id;
      processed.def = def; // Store reference for later expansion
      if (node.params) {
        processed.overrides = processParams(node.params);
      }
      // LCD-049: Preserve bounding radius for optimization
      if (node.boundingRadius !== undefined) {
        processed.boundingRadius = node.boundingRadius;
      }
      break;

    default:
      console.warn(`Unknown node type: ${node.type}, passing through`);
      processed.raw = node;
  }

  // Process inline transform if present (for primitives)
  if (node.transform && node.type !== 'transform' && node.type !== 'group') {
    processed.transform = processTransform(node.transform);
  }

  return processed;
}

/**
 * Process parameters object
 */
function processParams(params) {
  const processed = {};
  for (const [key, value] of Object.entries(params)) {
    processed[key] = processValue(value);
  }
  return processed;
}

/**
 * Process a value (could be constant, array, or expression)
 */
function processValue(value) {
  // Constant number
  if (typeof value === 'number') {
    return { type: 'const', value };
  }

  // Array of values
  if (Array.isArray(value)) {
    return {
      type: 'array',
      values: value.map(v => processValue(v))
    };
  }

  // Expression object
  if (typeof value === 'object' && value !== null) {
    // Variable reference
    if (value.var) {
      return { type: 'var', name: value.var };
    }

    // Expression
    if (value.expr) {
      return {
        type: 'expr',
        op: value.expr,
        args: (value.args || []).map(arg => processValue(arg))
      };
    }
  }

  throw new Error(`Invalid value: ${JSON.stringify(value)}`);
}

/**
 * Process transform object
 * Supports: translate, rotate (Euler), rotateQ (quaternion),
 * rotateAxis (axis-angle), scale, mat4
 */
function processTransform(transform) {
  const processed = {};

  if (transform.translate) {
    processed.translate = processValue(transform.translate);
  }

  // Euler rotation [rx, ry, rz] in degrees
  if (transform.rotate) {
    processed.rotate = processValue(transform.rotate);
  }

  // Quaternion rotation [x, y, z, w]
  if (transform.rotateQ) {
    processed.rotateQ = processValue(transform.rotateQ);
  }

  // Axis-angle rotation { axis: [x, y, z], angle: degrees }
  if (transform.rotateAxis) {
    processed.rotateAxis = {
      axis: processValue(transform.rotateAxis.axis),
      angle: processValue(transform.rotateAxis.angle)
    };
  }

  if (transform.scale) {
    processed.scale = processValue(transform.scale);
  }

  // Direct 4x4 matrix (16-element array, column-major)
  if (transform.mat4) {
    processed.mat4 = transform.mat4.map(v => processValue(v));
  }

  return processed;
}

/**
 * Expand a ref node by cloning the definition
 */
export function expandRef(refNode, registry, depth = 0) {
  if (refNode.type !== 'ref') {
    return refNode;
  }

  const def = registry.defs.get(refNode.refId);
  if (!def) {
    throw new Error(`Cannot expand undefined ref: ${refNode.refId}`);
  }

  // Clone the definition
  let expanded = JSON.parse(JSON.stringify(def));

  // Apply parameter overrides (if any) - support both 'overrides' and 'params'
  // This substitutes { "var": "X" } references with override values
  const overrides = refNode.overrides || refNode.params;
  if (overrides) {
    expanded = applyOverrides(expanded, overrides);
  }

  return processNode(expanded, registry, depth);
}

/**
 * Apply parameter overrides to a cloned node tree
 * Recursively substitutes { "var": "X" } references with override values
 */
function applyOverrides(node, overrides) {
  if (!node || typeof node !== 'object') return node;
  if (!overrides || Object.keys(overrides).length === 0) return node;

  return substituteVars(node, overrides);
}

/**
 * Recursively substitute { "var": "X" } references with values from overrides
 */
function substituteVars(obj, overrides) {
  if (obj === null || obj === undefined) return obj;

  // Primitive values pass through
  if (typeof obj !== 'object') return obj;

  // Check if this is a var reference that should be substituted
  if (obj.var && overrides.hasOwnProperty(obj.var)) {
    return overrides[obj.var];
  }

  // Arrays: substitute each element
  if (Array.isArray(obj)) {
    return obj.map(item => substituteVars(item, overrides));
  }

  // Objects: substitute each property value
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = substituteVars(value, overrides);
  }
  return result;
}

/**
 * Convert processed value back to raw JSON format
 */
function valueToRaw(processed) {
  if (!processed || typeof processed !== 'object') return processed;

  switch (processed.type) {
    case 'const':
      return processed.value;
    case 'array':
      return processed.values.map(v => valueToRaw(v));
    case 'var':
      return { var: processed.name };
    case 'expr':
      return {
        expr: processed.op,
        args: processed.args.map(a => valueToRaw(a))
      };
    default:
      return processed;
  }
}
