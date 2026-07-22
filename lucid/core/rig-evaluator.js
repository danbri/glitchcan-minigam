/**
 * Rig Layer Evaluator
 *
 * Evaluates rig relationships to produce final param values.
 * The rig layer sits between raw params and the SDF tree, providing:
 * - Derived params (computed from expressions)
 * - Bounds constraints (morphological validity)
 * - Phase-coupled animations (coordinated motion)
 * - Chain constraints (skeletal coherence) [future]
 *
 * This layer is species-agnostic - it provides primitives that any
 * creature can use with different topology.
 */

// --- Value noise, ported 1:1 from the GLSL shader (json-codegen.js) so a rig
// expression using noise/fbm/turbulence/hash matches the in-shader functions
// exactly (previously these ops returned 0 on the CPU — a silent divergence).
const _fract = (x) => x - Math.floor(x);
const _mix = (a, b, t) => a * (1 - t) + b * t;
function _hash(n) { return _fract(Math.sin(n) * 43758.5453123); }
function _noise3(px, py, pz) {
  const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
  let fx = _fract(px), fy = _fract(py), fz = _fract(pz);
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const n = ix + iy * 57 + iz * 113;
  return _mix(
    _mix(_mix(_hash(n), _hash(n + 1), fx), _mix(_hash(n + 57), _hash(n + 58), fx), fy),
    _mix(_mix(_hash(n + 113), _hash(n + 114), fx), _mix(_hash(n + 170), _hash(n + 171), fx), fy),
    fz);
}
function _octaveNoise(px, py, pz, octaves, turb) {
  let value = 0, amplitude = 0.5, frequency = 1;
  const oc = Math.min(6, Math.max(0, Math.floor(octaves ?? 4)));
  for (let i = 0; i < 6; i++) {
    if (i >= oc) break;
    const s = _noise3(px * frequency, py * frequency, pz * frequency);
    value += amplitude * (turb ? Math.abs(s * 2 - 1) : s);
    frequency *= 2; amplitude *= 0.5;
  }
  return value;
}

/**
 * Evaluate a single expression in the context of current values
 * Supports the same expression format as json-codegen.js
 *
 * @param {Object|number} expr - Expression object or constant
 * @param {Object} values - Current param values { name: number }
 * @param {number} time - Current time for animation
 * @returns {number}
 */
export function evaluateExpr(expr, values, time = 0) {
  if (expr === null || expr === undefined) return 0;

  // Raw number
  if (typeof expr === 'number') return expr;

  // String reference to variable
  if (typeof expr === 'string') {
    if (expr === 'time') return time;
    return values[expr] ?? 0;
  }

  // Constant value
  if (expr.type === 'const') return expr.value;

  // Variable reference
  if (expr.type === 'var') {
    if (expr.name === 'time') return time;
    return values[expr.name] ?? 0;
  }

  // Expression with operator
  if (expr.type === 'expr' || expr.expr) {
    const op = expr.op || expr.expr;
    const args = (expr.args || []).map(a => evaluateExpr(a, values, time));

    switch (op) {
      case 'add': return args.reduce((a, b) => a + b, 0);
      case 'sub': return args[0] - (args[1] ?? 0);
      case 'mul': return args.reduce((a, b) => a * b, 1);
      case 'div': return args[1] !== 0 ? args[0] / args[1] : 0;
      case 'mod': return args[1] !== 0 ? args[0] % args[1] : 0;
      case 'abs': return Math.abs(args[0]);
      case 'neg': return -args[0];
      case 'floor': return Math.floor(args[0]);
      case 'ceil': return Math.ceil(args[0]);
      case 'fract': return args[0] - Math.floor(args[0]);
      case 'sin': return Math.sin(args[0]);
      case 'cos': return Math.cos(args[0]);
      case 'tan': return Math.tan(args[0]);
      case 'min': return Math.min(...args);
      case 'max': return Math.max(...args);
      case 'pow': return Math.pow(args[0], args[1] ?? 1);
      case 'sqrt': return Math.sqrt(Math.max(0, args[0]));
      // Scalar math ops — parity with the GLSL/WGSL codegen vocabulary.
      case 'exp': return Math.exp(args[0]);
      case 'log': return Math.log(args[0]);
      case 'asin': return Math.asin(args[0]);
      case 'acos': return Math.acos(args[0]);
      case 'atan': return args.length > 1 ? Math.atan2(args[0], args[1]) : Math.atan(args[0]);
      case 'round': return Math.floor(args[0] + 0.5);
      // Noise ops — ported 1:1 from the shader so CPU rig values match in-shader.
      case 'hash': return _hash(args[0]);
      case 'noise': return _noise3(args[0], args[1] ?? 0, args[2] ?? 0);
      case 'fbm': return _octaveNoise(args[0], args[1] ?? 0, args[2] ?? 0, args[3], false);
      case 'turbulence': return _octaveNoise(args[0], args[1] ?? 0, args[2] ?? 0, args[3], true);
      case 'clamp': return Math.max(args[1] ?? 0, Math.min(args[2] ?? 1, args[0]));
      case 'step': return args[1] >= args[0] ? 1 : 0;
      case 'smoothstep': {
        const edge0 = args[0], edge1 = args[1], x = args[2];
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
      }
      case 'mix':
      case 'lerp': return args[0] * (1 - args[2]) + args[1] * args[2];
      default:
        console.warn(`Unknown rig expression op: ${op}`);
        return 0;
    }
  }

  // Array - evaluate first element or return 0
  if (Array.isArray(expr)) {
    return evaluateExpr(expr[0], values, time);
  }

  return 0;
}

/**
 * Topologically sort derived params based on dependencies
 * Ensures params are evaluated in correct order
 *
 * @param {Object} derived - Map of derived param definitions
 * @param {Object} baseValues - Base param values (non-derived)
 * @returns {string[]} - Sorted param names
 */
export function topologicalSort(derived, baseValues) {
  const names = Object.keys(derived);
  const visited = new Set();
  const visiting = new Set();
  const sorted = [];

  function getDeps(expr) {
    const deps = [];
    if (!expr) return deps;

    if (expr.type === 'var' || typeof expr === 'string') {
      const name = expr.name || expr;
      if (derived[name] && !baseValues.hasOwnProperty(name)) {
        deps.push(name);
      }
    }

    if (expr.args) {
      for (const arg of expr.args) {
        deps.push(...getDeps(arg));
      }
    }

    return deps;
  }

  function visit(name) {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      console.warn(`Circular dependency detected in rig.derived: ${name}`);
      return;
    }

    visiting.add(name);
    const deps = getDeps(derived[name]);
    for (const dep of deps) {
      visit(dep);
    }
    visiting.delete(name);
    visited.add(name);
    sorted.push(name);
  }

  for (const name of names) {
    visit(name);
  }

  return sorted;
}

/**
 * Evaluate rig layer to produce final param values
 *
 * @param {Object} params - Base params from scene { name: { value, type, min, max } }
 * @param {Object} rig - Rig definition { derived, bounds, phase, chains, conserved }
 * @param {number} time - Current time for animation
 * @returns {{ values: Object, derived: Object, violations: Array, phaseValues: Object }}
 */
export function evaluateRig(params, rig, time = 0) {
  const values = {};
  const derived = {};
  const violations = [];
  const phaseValues = {};

  if (!rig) {
    // No rig - just extract base values
    for (const [name, param] of Object.entries(params || {})) {
      values[name] = param.value;
    }
    return { values, derived, violations, phaseValues };
  }

  // 1. Copy base param values
  for (const [name, param] of Object.entries(params || {})) {
    values[name] = param.value;
  }

  // 2. Evaluate derived params (topologically sorted)
  if (rig.derived) {
    const sorted = topologicalSort(rig.derived, values);
    for (const name of sorted) {
      const val = evaluateExpr(rig.derived[name], values, time);
      values[name] = val;
      derived[name] = val;
    }
  }

  // 3. Check bounds constraints
  if (rig.bounds) {
    for (const [name, bound] of Object.entries(rig.bounds)) {
      const val = values[name];
      if (val === undefined) continue;

      const min = bound.min ?? -Infinity;
      const max = bound.max ?? Infinity;

      if (val < min) {
        violations.push({
          type: 'bounds',
          severity: bound.severity || 'warning',
          param: name,
          value: val,
          min,
          max,
          reason: bound.reason || `${name} is below minimum`
        });
      } else if (val > max) {
        violations.push({
          type: 'bounds',
          severity: bound.severity || 'warning',
          param: name,
          value: val,
          min,
          max,
          reason: bound.reason || `${name} exceeds maximum`
        });
      }
    }
  }

  // 4. Evaluate phase-coupled animations
  if (rig.phase) {
    for (const [cycleName, cycle] of Object.entries(rig.phase)) {
      // Evaluate the driver expression
      const driver = evaluateExpr(cycle.driver, values, time);

      // Evaluate each follower
      for (const [follower, config] of Object.entries(cycle.followers || {})) {
        const phase = evaluateExpr(config.phase ?? 0, values, time);
        const amplitude = evaluateExpr(config.amplitude ?? 1, values, time);
        const offset = evaluateExpr(config.offset ?? 0, values, time);
        const waveform = config.waveform || 'sin';

        // Phase angle in radians
        const angle = driver + phase * Math.PI * 2;

        // Apply waveform
        let val;
        switch (waveform) {
          case 'step':
            // Foot step pattern: rises quickly, holds, falls quickly
            // Normalized phase 0-1 within cycle
            const t = ((angle / (Math.PI * 2)) % 1 + 1) % 1;
            // Step up for first half, down for second half
            // Smooth step using cubic ease
            if (t < 0.3) {
              // Rising phase
              const s = t / 0.3;
              val = s * s * (3 - 2 * s) * amplitude + offset;
            } else if (t < 0.5) {
              // Hold high
              val = amplitude + offset;
            } else if (t < 0.8) {
              // Falling phase
              const s = (t - 0.5) / 0.3;
              val = (1 - s * s * (3 - 2 * s)) * amplitude + offset;
            } else {
              // Hold low (foot on ground)
              val = offset;
            }
            break;
          case 'cos':
            val = Math.cos(angle) * amplitude + offset;
            break;
          case 'triangle':
            // Triangle wave
            const p = ((angle / (Math.PI * 2)) % 1 + 1) % 1;
            val = (p < 0.5 ? 4 * p - 1 : 3 - 4 * p) * amplitude + offset;
            break;
          case 'linear':
            // Linear - continuous forward motion, no cycling
            // Returns driver value scaled by amplitude (for locomotion)
            val = driver * amplitude + offset;
            break;
          case 'sin':
          default:
            val = Math.sin(angle) * amplitude + offset;
            break;
        }

        // Store with composite name
        const paramName = `${cycleName}_${follower}`;
        values[paramName] = val;
        phaseValues[paramName] = val;
      }
    }
  }

  // 5. Chain constraints (skeletal coherence).
  // A chain produces per-joint angle params `${chain}_joint${i}`. Semantics:
  //  - `bend` (optional expression): total bend seeded into every joint; if
  //    absent, each joint keeps whatever value derived/phase already set (or 0).
  //  - `constraints.taper` (default 1): distal joints scale by taper^i, so bend
  //    tapers along the chain (a stiffer base, floppier tip).
  //  - `constraints.maxBend` (degrees): each joint angle is clamped to
  //    [-maxBend, maxBend]; a clamp records a bounds-style violation.
  if (rig.chains) {
    for (const [chainName, chain] of Object.entries(rig.chains)) {
      const joints = chain.joints || [];
      const c = chain.constraints || {};
      const taper = c.taper !== undefined ? c.taper : 1;
      const maxBend = c.maxBend;
      const seed = chain.bend !== undefined ? evaluateExpr(chain.bend, values, time) : null;
      for (let i = 0; i < joints.length; i++) {
        const jointParam = `${chainName}_joint${i}`;
        let a = seed !== null ? seed : (values[jointParam] ?? 0);
        a *= Math.pow(taper, i);
        if (maxBend !== undefined && Math.abs(a) > maxBend) {
          violations.push({
            param: jointParam, value: a, severity: 'clamped',
            reason: `chain '${chainName}' joint ${i} exceeds maxBend ${maxBend}`,
          });
          a = Math.max(-maxBend, Math.min(maxBend, a));
        }
        values[jointParam] = a;
        derived[jointParam] = a;
      }
    }
  }

  // 6. Conserved quantities. A conserved quantity is the PRODUCT of a set of
  // params (a proxy for volume/mass under axis scaling). Config:
  //  - `params` (array of names) whose product should equal `target` (default 1).
  //  - `adjust` (optional name, must be in `params`): solved so the product hits
  //    the target exactly (auto-preserve volume when other axes change).
  //  - `tolerance` (default 0): relative deviation before a `warn` violation.
  if (rig.conserved) {
    for (const [quantity, config] of Object.entries(rig.conserved)) {
      const names = config.params || [];
      if (names.length < 2) continue; // nothing to conserve
      const target = config.target !== undefined ? config.target : 1;
      const tol = config.tolerance !== undefined ? config.tolerance : 0;
      if (config.adjust && names.includes(config.adjust)) {
        let othersProduct = 1;
        for (const n of names) if (n !== config.adjust) othersProduct *= (values[n] ?? 1);
        if (othersProduct !== 0) {
          const solved = target / othersProduct;
          values[config.adjust] = solved;
          derived[config.adjust] = solved;
        }
      } else {
        let product = 1;
        for (const n of names) product *= (values[n] ?? 1);
        const dev = target !== 0 ? Math.abs(product - target) / Math.abs(target) : Math.abs(product);
        if (config.warn && dev > tol) {
          violations.push({
            param: quantity, value: product, severity: 'warning',
            reason: `conserved '${quantity}' = ${product.toFixed(4)} deviates ${(dev * 100).toFixed(1)}% from target ${target}`,
          });
        }
      }
    }
  }

  return { values, derived, violations, phaseValues };
}

/**
 * Get all param names that need uniforms (base + derived + phase)
 * Used by json-codegen to declare uniforms
 *
 * @param {Object} params - Base params
 * @param {Object} rig - Rig definition
 * @returns {Object} - Map of { name: { type: 'scalar'|'vec3' } }
 */
export function getAllParamNames(params, rig) {
  const all = {};

  // Base params (skip non-object entries like _comment_* strings)
  for (const [name, param] of Object.entries(params || {})) {
    if (typeof param !== 'object' || param === null) continue;
    all[name] = { type: param.type || 'scalar' };
  }

  if (!rig) return all;

  // Derived params (all scalar for now)
  for (const name of Object.keys(rig.derived || {})) {
    all[name] = { type: 'scalar' };
  }

  // Phase-generated params
  for (const [cycleName, cycle] of Object.entries(rig.phase || {})) {
    for (const follower of Object.keys(cycle.followers || {})) {
      all[`${cycleName}_${follower}`] = { type: 'scalar' };
    }
  }

  // Chain joint params
  for (const [chainName, chain] of Object.entries(rig.chains || {})) {
    const joints = chain.joints || [];
    for (let i = 0; i < joints.length; i++) {
      all[`${chainName}_joint${i}`] = { type: 'scalar' };
    }
  }

  return all;
}

/**
 * Validate rig definition for common errors
 *
 * @param {Object} params - Base params
 * @param {Object} rig - Rig definition
 * @returns {string[]} - Array of error messages
 */
export function validateRig(params, rig) {
  const errors = [];

  if (!rig) return errors;

  const paramNames = new Set(Object.keys(params || {}));

  // Check derived params reference valid base params
  if (rig.derived) {
    for (const [name, expr] of Object.entries(rig.derived)) {
      const refs = extractVarRefs(expr);
      for (const ref of refs) {
        if (!paramNames.has(ref) && !rig.derived[ref] && ref !== 'time') {
          errors.push(`Derived param '${name}' references unknown param '${ref}'`);
        }
      }
    }
  }

  // Check bounds reference valid params
  if (rig.bounds) {
    for (const name of Object.keys(rig.bounds)) {
      if (!paramNames.has(name) && !(rig.derived && rig.derived[name])) {
        errors.push(`Bounds constraint references unknown param '${name}'`);
      }
    }
  }

  return errors;
}

/**
 * Extract variable references from an expression
 */
function extractVarRefs(expr) {
  const refs = [];

  if (!expr) return refs;

  if (typeof expr === 'string' && expr !== 'time') {
    refs.push(expr);
  }

  if (expr.type === 'var' && expr.name !== 'time') {
    refs.push(expr.name);
  }

  if (expr.args) {
    for (const arg of expr.args) {
      refs.push(...extractVarRefs(arg));
    }
  }

  return refs;
}
