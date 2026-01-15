/**
 * Lucid SDF S-expression DSL
 *
 * Converts Lucid JSON scenes to/from s-expression format with full round-trip support.
 * The format preserves all scene information including params, defs, camera, and metadata.
 *
 * Example output:
 * ```
 * (scene "Wolf"
 *   :version "1.0"
 *   :subtitle "Parametric quadruped"
 *
 *   (params
 *     (bodyLength :type scalar :value 2.0 :min 1 :max 4)
 *     (furColor :type color3 :value [0.6 0.4 0.2]))
 *
 *   (camera :distance 8 :phi 0.4 :theta 0.2)
 *
 *   (defs
 *     (leg (cylinder :r 0.1 :h 0.8)))
 *
 *   (root
 *     (union
 *       (ellipsoid :radii [$bodyLength 0.5 0.4])
 *       (ref "leg"))))
 * ```
 */

// ============================================================
// JSON to S-expression (Serialization)
// ============================================================

/**
 * Convert full scene JSON to s-expression string
 * @param {Object} json - Scene JSON
 * @returns {string} - S-expression representation
 */
export function sceneToSexpr(json) {
  const lines = [];
  const title = json.title || 'Untitled';

  lines.push(`(scene "${escapeString(title)}"`);

  // Metadata
  if (json.version) lines.push(`  :version "${json.version}"`);
  if (json.subtitle) lines.push(`  :subtitle "${escapeString(json.subtitle)}"`);

  // Params
  if (json.params && Object.keys(json.params).length > 0) {
    lines.push('');
    lines.push('  (params');
    for (const [name, param] of Object.entries(json.params)) {
      lines.push(`    ${paramToSexpr(name, param)}`);
    }
    lines.push('  )');
  }

  // Camera
  if (json.camera) {
    lines.push('');
    lines.push(`  ${cameraToSexpr(json.camera)}`);
  }

  // Defs
  if (json.defs && Object.keys(json.defs).length > 0) {
    lines.push('');
    lines.push('  (defs');
    for (const [id, def] of Object.entries(json.defs)) {
      lines.push(`    (${id}`);
      lines.push(`      ${nodeToSexpr(def, 3)})`);
    }
    lines.push('  )');
  }

  // Root
  if (json.root) {
    lines.push('');
    lines.push('  (root');
    lines.push(`    ${nodeToSexpr(json.root, 2)})`);
  }

  lines.push(')');
  return lines.join('\n');
}

/**
 * Convert a single SDF node to s-expression
 */
export function nodeToSexpr(node, indent = 0) {
  if (!node || typeof node !== 'object') return String(node);

  const pad = '  '.repeat(indent);
  const type = node.type || 'unknown';
  const parts = [type];

  // Handle primitives
  const primitives = ['sphere', 'box', 'cylinder', 'torus', 'capsule', 'ellipsoid', 'plane', 'cone', 'line'];
  if (primitives.includes(type)) {
    // Add params
    if (node.params) {
      for (const [k, v] of Object.entries(node.params)) {
        parts.push(`:${k} ${valueToSexpr(v)}`);
      }
    }
    // Add transform
    if (node.transform) {
      parts.push(transformToSexpr(node.transform));
    }
    return `(${parts.join(' ')})`;
  }

  // Handle CSG operations
  const csgOps = ['union', 'subtract', 'intersect', 'smoothUnion', 'smoothSubtract', 'smoothIntersect'];
  if (csgOps.includes(type)) {
    const csgParts = [type];
    if (node.k !== undefined) csgParts.push(`:k ${valueToSexpr(node.k)}`);
    if (node.children && node.children.length > 0) {
      const childPad = '  '.repeat(indent + 1);
      const childStrs = node.children.map(c => `\n${childPad}${nodeToSexpr(c, indent + 1)}`);
      return `(${csgParts.join(' ')}${childStrs.join('')})`;
    }
    return `(${csgParts.join(' ')})`;
  }

  // Handle modifiers
  if (type === 'mirror') {
    const modParts = [type, `:axis "${node.axis || 'x'}"`];
    if (node.child) {
      const childPad = '  '.repeat(indent + 1);
      return `(${modParts.join(' ')}\n${childPad}${nodeToSexpr(node.child, indent + 1)})`;
    }
    return `(${modParts.join(' ')})`;
  }

  if (type === 'radial') {
    const radParts = [type, `:count ${valueToSexpr(node.count)}`];
    if (node.axis) radParts.push(`:axis "${node.axis}"`);
    if (node.child) {
      const childPad = '  '.repeat(indent + 1);
      return `(${radParts.join(' ')}\n${childPad}${nodeToSexpr(node.child, indent + 1)})`;
    }
    return `(${radParts.join(' ')})`;
  }

  if (type === 'repeat') {
    const repParts = [type, `:period ${valueToSexpr(node.period)}`];
    if (node.child) {
      const childPad = '  '.repeat(indent + 1);
      return `(${repParts.join(' ')}\n${childPad}${nodeToSexpr(node.child, indent + 1)})`;
    }
    return `(${repParts.join(' ')})`;
  }

  if (type === 'transform') {
    const transParts = [type];
    if (node.transform) transParts.push(transformToSexpr(node.transform));
    if (node.child) {
      const childPad = '  '.repeat(indent + 1);
      return `(${transParts.join(' ')}\n${childPad}${nodeToSexpr(node.child, indent + 1)})`;
    }
    return `(${transParts.join(' ')})`;
  }

  if (type === 'shell') {
    const shellParts = [type, `:thickness ${valueToSexpr(node.thickness || 0.05)}`];
    if (node.child) {
      const childPad = '  '.repeat(indent + 1);
      return `(${shellParts.join(' ')}\n${childPad}${nodeToSexpr(node.child, indent + 1)})`;
    }
    return `(${shellParts.join(' ')})`;
  }

  if (type === 'round') {
    const roundParts = [type, `:radius ${valueToSexpr(node.radius || 0.05)}`];
    if (node.child) {
      const childPad = '  '.repeat(indent + 1);
      return `(${roundParts.join(' ')}\n${childPad}${nodeToSexpr(node.child, indent + 1)})`;
    }
    return `(${roundParts.join(' ')})`;
  }

  if (type === 'displace') {
    const dispParts = [type];
    if (node.strength !== undefined) dispParts.push(`:strength ${valueToSexpr(node.strength)}`);
    if (node.frequency !== undefined) dispParts.push(`:freq ${valueToSexpr(node.frequency)}`);
    if (node.octaves !== undefined) dispParts.push(`:octaves ${node.octaves}`);
    if (node.child) {
      const childPad = '  '.repeat(indent + 1);
      return `(${dispParts.join(' ')}\n${childPad}${nodeToSexpr(node.child, indent + 1)})`;
    }
    return `(${dispParts.join(' ')})`;
  }

  if (type === 'ref') {
    parts.push(`"${node.id}"`);
    if (node.params) {
      for (const [k, v] of Object.entries(node.params)) {
        parts.push(`:${k} ${valueToSexpr(v)}`);
      }
    }
    if (node.transform) parts.push(transformToSexpr(node.transform));
    return `(${parts.join(' ')})`;
  }

  // Fallback for unknown types
  return `(${type} ${JSON.stringify(node)})`;
}

/**
 * Convert a value (number, array, var ref, expression) to s-expression
 */
export function valueToSexpr(v) {
  if (v === null || v === undefined) return 'nil';
  if (typeof v === 'number') {
    // Format with minimal decimal places
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(6).replace(/\.?0+$/, '');
  }
  if (typeof v === 'string') return `"${escapeString(v)}"`;
  if (typeof v === 'boolean') return v ? 'true' : 'false';

  if (Array.isArray(v)) {
    return `[${v.map(valueToSexpr).join(' ')}]`;
  }

  if (typeof v === 'object') {
    // IR format from loader
    if (v.type === 'const') return valueToSexpr(v.value);
    if (v.type === 'var') return `$${v.name}`;
    if (v.type === 'array' && v.values) {
      return `[${v.values.map(valueToSexpr).join(' ')}]`;
    }
    if (v.type === 'expr') {
      const args = (v.args || []).map(valueToSexpr).join(' ');
      return `(${v.op} ${args})`;
    }

    // Raw JSON format
    if ('var' in v) return `$${v.var}`;
    if ('expr' in v) {
      const args = (v.args || []).map(valueToSexpr).join(' ');
      return `(${v.expr} ${args})`;
    }
  }

  return JSON.stringify(v);
}

function transformToSexpr(t) {
  if (!t) return '';
  const parts = [];
  if (t.translate) parts.push(`:translate ${valueToSexpr(t.translate)}`);
  if (t.rotate) parts.push(`:rotate ${valueToSexpr(t.rotate)}`);
  if (t.rotateAxis) {
    parts.push(`:rotate-axis [${valueToSexpr(t.rotateAxis.axis)} ${valueToSexpr(t.rotateAxis.angle)}]`);
  }
  if (t.rotateQ) parts.push(`:rotate-q ${valueToSexpr(t.rotateQ)}`);
  if (t.scale) parts.push(`:scale ${valueToSexpr(t.scale)}`);
  return parts.join(' ');
}

function paramToSexpr(name, param) {
  const parts = [name];
  if (param.type) parts.push(`:type ${param.type}`);
  if (param.value !== undefined) parts.push(`:value ${valueToSexpr(param.value)}`);
  if (param.min !== undefined) parts.push(`:min ${param.min}`);
  if (param.max !== undefined) parts.push(`:max ${param.max}`);
  if (param.step !== undefined) parts.push(`:step ${param.step}`);
  if (param.description) parts.push(`:desc "${escapeString(param.description)}"`);
  return `(${parts.join(' ')})`;
}

function cameraToSexpr(cam) {
  const parts = ['camera'];
  if (cam.distance !== undefined) parts.push(`:distance ${cam.distance}`);
  if (cam.phi !== undefined) parts.push(`:phi ${cam.phi}`);
  if (cam.theta !== undefined) parts.push(`:theta ${cam.theta}`);
  if (cam.target) parts.push(`:target ${valueToSexpr(cam.target)}`);
  if (cam.fov !== undefined) parts.push(`:fov ${cam.fov}`);
  return `(${parts.join(' ')})`;
}

function escapeString(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// ============================================================
// S-expression to JSON (Parsing)
// ============================================================

/**
 * Parse s-expression string back to scene JSON
 * @param {string} sexpr - S-expression string
 * @returns {Object} - Scene JSON
 */
export function sexprToScene(sexpr) {
  const tokens = tokenize(sexpr);
  const ast = parseExpr(tokens);

  if (ast[0] !== 'scene') {
    throw new Error('Expected (scene ...) at top level');
  }

  const json = {};
  let i = 1;

  // Parse title
  if (typeof ast[i] === 'string') {
    json.title = ast[i];
    i++;
  }

  // Parse remaining elements
  while (i < ast.length) {
    const item = ast[i];

    if (typeof item === 'string' && item.startsWith(':')) {
      // Keyword argument
      const key = item.slice(1);
      i++;
      if (key === 'version') json.version = ast[i];
      else if (key === 'subtitle') json.subtitle = ast[i];
      i++;
    } else if (Array.isArray(item)) {
      // Nested form
      const formType = item[0];
      if (formType === 'params') {
        json.params = parseParams(item);
      } else if (formType === 'camera') {
        json.camera = parseCamera(item);
      } else if (formType === 'defs') {
        json.defs = parseDefs(item);
      } else if (formType === 'root') {
        json.root = parseNode(item[1]);
      }
      i++;
    } else {
      i++;
    }
  }

  return json;
}

/**
 * Parse a single node s-expression back to JSON
 */
export function sexprToNode(sexpr) {
  const tokens = tokenize(sexpr);
  const ast = parseExpr(tokens);
  return parseNode(ast);
}

function parseNode(ast) {
  if (!Array.isArray(ast)) return ast;

  const type = ast[0];
  const node = { type };
  let i = 1;

  // Parse keyword arguments and children
  while (i < ast.length) {
    const item = ast[i];

    if (typeof item === 'string' && item.startsWith(':')) {
      const key = item.slice(1);
      i++;
      const val = ast[i];

      // Handle specific keys
      if (key === 'k') node.k = parseValue(val);
      else if (key === 'axis') node.axis = val;
      else if (key === 'count') node.count = parseValue(val);
      else if (key === 'period') node.period = parseValue(val);
      else if (key === 'thickness') node.thickness = parseValue(val);
      else if (key === 'radius') node.radius = parseValue(val);
      else if (key === 'strength') node.strength = parseValue(val);
      else if (key === 'freq') node.frequency = parseValue(val);
      else if (key === 'octaves') node.octaves = parseValue(val);
      else if (key === 'translate' || key === 'rotate' || key === 'scale' || key === 'rotate-q') {
        if (!node.transform) node.transform = {};
        const transformKey = key === 'rotate-q' ? 'rotateQ' : key;
        node.transform[transformKey] = parseValue(val);
      } else if (key === 'rotate-axis') {
        if (!node.transform) node.transform = {};
        const arr = parseValue(val);
        node.transform.rotateAxis = { axis: arr.slice(0, 3), angle: arr[3] };
      } else {
        // Assume it's a param
        if (!node.params) node.params = {};
        node.params[key] = parseValue(val);
      }
      i++;
    } else if (Array.isArray(item)) {
      // Child node
      const childNode = parseNode(item);

      // Determine if it goes in children or child
      const modifiers = ['mirror', 'radial', 'repeat', 'transform', 'shell', 'round', 'displace'];
      if (modifiers.includes(type)) {
        node.child = childNode;
      } else {
        if (!node.children) node.children = [];
        node.children.push(childNode);
      }
      i++;
    } else if (typeof item === 'string' && type === 'ref') {
      // ref id
      node.id = item;
      i++;
    } else {
      i++;
    }
  }

  return node;
}

function parseValue(v) {
  if (v === 'nil') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    if (v.startsWith('$')) {
      return { var: v.slice(1) };
    }
    return v;
  }
  if (Array.isArray(v)) {
    // Check if it's an expression like (add 1 2)
    if (v.length > 0 && typeof v[0] === 'string' && !v[0].startsWith(':')) {
      const op = v[0];
      // Check if it's a known expression operator
      const exprOps = ['add', 'sub', 'mul', 'div', 'sin', 'cos', 'abs', 'min', 'max', 'clamp', 'mix', 'smoothstep'];
      if (exprOps.includes(op)) {
        return { expr: op, args: v.slice(1).map(parseValue) };
      }
    }
    // Regular array
    return v.map(parseValue);
  }
  return v;
}

function parseParams(ast) {
  const params = {};
  for (let i = 1; i < ast.length; i++) {
    const item = ast[i];
    if (Array.isArray(item)) {
      const name = item[0];
      const param = {};
      for (let j = 1; j < item.length; j++) {
        if (typeof item[j] === 'string' && item[j].startsWith(':')) {
          const key = item[j].slice(1);
          j++;
          if (key === 'type') param.type = item[j];
          else if (key === 'value') param.value = parseValue(item[j]);
          else if (key === 'min') param.min = item[j];
          else if (key === 'max') param.max = item[j];
          else if (key === 'step') param.step = item[j];
          else if (key === 'desc') param.description = item[j];
        }
      }
      params[name] = param;
    }
  }
  return params;
}

function parseCamera(ast) {
  const cam = {};
  for (let i = 1; i < ast.length; i++) {
    if (typeof ast[i] === 'string' && ast[i].startsWith(':')) {
      const key = ast[i].slice(1);
      i++;
      if (key === 'distance') cam.distance = ast[i];
      else if (key === 'phi') cam.phi = ast[i];
      else if (key === 'theta') cam.theta = ast[i];
      else if (key === 'target') cam.target = parseValue(ast[i]);
      else if (key === 'fov') cam.fov = ast[i];
    }
  }
  return cam;
}

function parseDefs(ast) {
  const defs = {};
  for (let i = 1; i < ast.length; i++) {
    const item = ast[i];
    if (Array.isArray(item) && item.length >= 2) {
      const id = item[0];
      const node = parseNode(item[1]);
      defs[id] = node;
    }
  }
  return defs;
}

// ============================================================
// Tokenizer
// ============================================================

function tokenize(input) {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const c = input[i];

    // Skip whitespace
    if (/\s/.test(c)) {
      i++;
      continue;
    }

    // Skip comments
    if (c === ';') {
      while (i < input.length && input[i] !== '\n') i++;
      continue;
    }

    // Parentheses and brackets
    if (c === '(' || c === ')' || c === '[' || c === ']') {
      tokens.push(c);
      i++;
      continue;
    }

    // String
    if (c === '"') {
      let str = '';
      i++; // skip opening quote
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < input.length) {
          i++;
          if (input[i] === 'n') str += '\n';
          else if (input[i] === 't') str += '\t';
          else str += input[i];
        } else {
          str += input[i];
        }
        i++;
      }
      i++; // skip closing quote
      tokens.push({ type: 'string', value: str });
      continue;
    }

    // Variable reference ($name)
    if (c === '$') {
      let name = '';
      i++; // skip $
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        name += input[i];
        i++;
      }
      tokens.push({ type: 'var', name });
      continue;
    }

    // Keyword (:name)
    if (c === ':') {
      let name = ':';
      i++; // skip :
      while (i < input.length && /[a-zA-Z0-9_-]/.test(input[i])) {
        name += input[i];
        i++;
      }
      tokens.push(name);
      continue;
    }

    // Number or symbol
    let atom = '';
    while (i < input.length && /[^\s()\[\]";]/.test(input[i])) {
      atom += input[i];
      i++;
    }

    if (atom) {
      // Try to parse as number
      const num = parseFloat(atom);
      if (!isNaN(num) && isFinite(num)) {
        tokens.push(num);
      } else {
        tokens.push(atom);
      }
    }
  }

  return tokens;
}

function parseExpr(tokens) {
  let pos = 0;

  function parse() {
    if (pos >= tokens.length) return null;

    const tok = tokens[pos];

    if (tok === '(') {
      pos++; // skip (
      const list = [];
      while (pos < tokens.length && tokens[pos] !== ')') {
        list.push(parse());
      }
      pos++; // skip )
      return list;
    }

    if (tok === '[') {
      pos++; // skip [
      const arr = [];
      while (pos < tokens.length && tokens[pos] !== ']') {
        arr.push(parse());
      }
      pos++; // skip ]
      return arr;
    }

    if (typeof tok === 'object' && tok.type === 'string') {
      pos++;
      return tok.value;
    }

    if (typeof tok === 'object' && tok.type === 'var') {
      pos++;
      return '$' + tok.name;
    }

    pos++;
    return tok;
  }

  return parse();
}

// ============================================================
// CLI usage
// ============================================================

const isMain = typeof process !== 'undefined' &&
  import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  import('fs').then(fs => {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      console.log('Usage: node sexpr-dsl.js <scene.json> [--parse <input.sexpr>]');
      process.exit(1);
    }

    if (args[0] === '--parse') {
      // Parse s-expression to JSON
      const content = fs.default.readFileSync(args[1], 'utf8');
      const json = sexprToScene(content);
      console.log(JSON.stringify(json, null, 2));
    } else {
      // Convert JSON to s-expression
      const content = fs.default.readFileSync(args[0], 'utf8');
      const json = JSON.parse(content);
      console.log(sceneToSexpr(json));
    }
  });
}
