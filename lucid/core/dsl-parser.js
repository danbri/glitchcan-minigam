export function normalizeDslText(text) {
  const rawLines = text.split(/\r?\n/);
  const normalized = [];
  let buffer = "";
  let depth = 0;

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];

    // strip JS-style comments
    line = line.replace(/\/\/.*$/, "");

    // full-line DSL comment
    if (line.trim().startsWith("#")) {
      if (!buffer && depth === 0) continue;
      else continue;
    }

    // trailing # comment
    line = line.replace(/#.*$/, "");
    line = line.trim();
    if (!line && depth === 0 && !buffer) continue;

    if (!buffer) buffer = line;
    else buffer += " " + line;

    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === "(") depth++;
      else if (c === ")") depth = Math.max(0, depth - 1);
    }

    if (depth === 0 && buffer) {
      normalized.push(buffer.trim());
      buffer = "";
    }
  }
  if (buffer) normalized.push(buffer.trim());
  return normalized;
}

// ============================================================
// Macro System
// ============================================================

/**
 * Parse macro definitions from DSL text
 * Syntax: def macroName(param1, param2, ...):
 *   body line 1
 *   body line 2
 *   return expression
 */
export function extractMacros(text) {
  const lines = text.split(/\r?\n/);
  const macros = {};
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Match: def name(params):
    const defMatch = line.match(/^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*:$/);

    if (defMatch) {
      const macroName = defMatch[1];
      const paramsStr = defMatch[2].trim();
      const params = paramsStr ? paramsStr.split(',').map(p => p.trim()) : [];

      // Collect indented body lines
      const body = [];
      i++;

      while (i < lines.length) {
        const bodyLine = lines[i];
        // Check if line is indented (starts with spaces/tabs)
        if (bodyLine.match(/^\s+/) && bodyLine.trim()) {
          body.push(bodyLine.trim());
          i++;
        } else if (!bodyLine.trim()) {
          // Empty line - skip but continue
          i++;
        } else {
          // Non-indented line - end of macro
          break;
        }
      }

      macros[macroName] = { params, body };
    } else {
      i++;
    }
  }

  return macros;
}

/**
 * Expand macro calls in DSL text
 */
export function expandMacros(text, macros) {
  const lines = text.split(/\r?\n/);
  const expanded = [];
  let inMacroDef = false;

  for (let line of lines) {
    const trimmed = line.trim();

    // Track when we're inside a macro definition
    if (trimmed.startsWith('def ')) {
      inMacroDef = true;
      continue;  // Skip the def line itself
    }

    // Skip indented lines ONLY if they're macro bodies (after a def)
    if (inMacroDef && line.match(/^\s+/) && !line.match(/^\s*$/)) {
      continue;  // This is a macro body line
    }

    // End of macro definition (non-indented line or empty line)
    if (inMacroDef && !line.match(/^\s+/)) {
      inMacroDef = false;
    }

    // Check for macro calls: id = macroName(args) or macroName(args)
    const assignMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    let id = null;
    let expr = trimmed;

    if (assignMatch) {
      id = assignMatch[1];
      expr = assignMatch[2].trim();
    }

    // Check if expr is a macro call
    const callMatch = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)$/);

    if (callMatch) {
      const funcName = callMatch[1];
      const argsStr = callMatch[2];

      if (macros[funcName]) {
        // This is a macro call - expand it
        const macro = macros[funcName];
        const args = parseCallArgs(argsStr);

        // Build parameter substitution map
        const substMap = {};
        macro.params.forEach((param, idx) => {
          if (idx < args.length) {
            substMap[param] = args[idx];
          }
        });

        // Expand macro body with substitutions
        const expandedBody = macro.body.map(bodyLine => {
          let result = bodyLine;

          // Find the return statement
          const returnMatch = result.match(/^return\s+(.+)$/);
          if (returnMatch) {
            // This is the return value - assign it to the id
            let returnExpr = returnMatch[1];

            // Substitute parameters
            for (let [param, value] of Object.entries(substMap)) {
              const paramRegex = new RegExp('\\b' + param + '\\b', 'g');
              returnExpr = returnExpr.replace(paramRegex, value);
            }

            // Also prefix any local variable references with the unique ID
            if (id) {
              // Find all variable names created in the macro body
              const localVars = macro.body
                .map(line => line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/))
                .filter(m => m && !m[0].startsWith('return'))
                .map(m => m[1]);

              // Replace references to local vars with prefixed versions
              for (let localVar of localVars) {
                const localVarRegex = new RegExp('\\b' + localVar + '\\b', 'g');
                returnExpr = returnExpr.replace(localVarRegex, `${id}_${localVar}`);
              }
            }

            if (id) {
              return `${id} = ${returnExpr}`;
            } else {
              return returnExpr;
            }
          } else {
            // Regular body line - prefix variable with unique ID
            // Parse: varName = expression
            const varMatch = result.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
            if (varMatch && id) {
              const varName = varMatch[1];
              const varExpr = varMatch[2];

              // Substitute parameters
              let substituted = varExpr;
              for (let [param, value] of Object.entries(substMap)) {
                const paramRegex = new RegExp('\\b' + param + '\\b', 'g');
                substituted = substituted.replace(paramRegex, value);
              }

              // Prefix variable name to make it unique
              return `${id}_${varName} = ${substituted}`;
            } else {
              // Fallback: just substitute parameters
              for (let [param, value] of Object.entries(substMap)) {
                const paramRegex = new RegExp('\\b' + param + '\\b', 'g');
                result = result.replace(paramRegex, value);
              }
              return result;
            }
          }
        });

        // Add expanded lines
        expandedBody.forEach(l => expanded.push(l));
        continue;
      }
    }

    // Not a macro call or definition - keep as is
    if (!trimmed.startsWith('def ') && trimmed) {
      expanded.push(trimmed);
    }
  }

  return expanded.join('\n');
}

/**
 * Parse function call arguments, handling nested parentheses and brackets
 */
function parseCallArgs(argsStr) {
  if (!argsStr.trim()) return [];

  const args = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < argsStr.length; i++) {
    const c = argsStr[i];

    if (c === '(' || c === '[') {
      depth++;
      current += c;
    } else if (c === ')' || c === ']') {
      depth--;
      current += c;
    } else if (c === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

// ---------- Legacy IR parser (current source of truth) ----------

export function splitArgs(argsStr) {
  const result = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < argsStr.length; i++) {
    const c = argsStr[i];
    if (c === "[" || c === "(") {
      depth++;
      current += c;
    } else if (c === "]" || c === ")") {
      depth = Math.max(0, depth - 1);
      current += c;
    } else if (c === "," && depth === 0) {
      if (current.trim()) result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

export function parseDslToSceneGraph(text) {
  // First pass: Extract and expand macros
  const macros = extractMacros(text);
  const expandedText = expandMacros(text, macros);

  // Now parse the expanded text
  const lines = normalizeDslText(expandedText);
  const nodes = [];
  const ids = new Set();
  const errors = [];

  function addError(lineNo, msg) {
    errors.push("Line " + lineNo + ": " + msg);
  }

  function parseArray(raw) {
    const trimmed = raw.trim();
    const inner = trimmed.replace(/^\[/, "").replace(/\]$/, "");
    if (!inner.trim()) return [];
    return inner.split(",").map(s => s.trim()).filter(Boolean);
  }

  function parseValue(raw) {
    const v = raw.trim();
    if (v.startsWith("[") && v.endsWith("]")) {
      return parseArray(v);
    }
    return v;
  }

  function parseParams(argsStr, node) {
    if (!argsStr) return;
    node.paramOrder = node.paramOrder || [];
    const parts = splitArgs(argsStr);
    parts.forEach(part => {
      const eqIdx = part.indexOf("=");
      if (eqIdx === -1) return;
      const key = part.slice(0, eqIdx).trim();
      const valRaw = part.slice(eqIdx + 1).trim();
      node.params[key] = parseValue(valRaw);
      node.paramOrder.push(key);
    });
    (node.paramOrder || []).forEach((key, idx) => {
      const alias = "arg_" + (idx + 1);
      if (!(alias in node.params)) {
        node.params[alias] = node.params[key];
      }
    });
  }

  function parseInputsAndParams(argsStr, node) {
    if (!argsStr) return;
    node.paramOrder = node.paramOrder || [];
    const parts = splitArgs(argsStr);
    parts.forEach(part => {
      const eqIdx = part.indexOf("=");
      if (eqIdx !== -1) {
        const key = part.slice(0, eqIdx).trim();
        const valRaw = part.slice(eqIdx + 1).trim();
        const val = parseValue(valRaw);

        // Check if this is an input reference (simple identifier) or a parameter value
        // Input references are node IDs like "s1", "blend", etc.
        // Parameters are numbers, arrays, or expressions like "1.0", "[0,0,0]", "sin(time)"
        const isInputRef = typeof val === "string" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(val);

        if (isInputRef) {
          // This is a reference to another node (input)
          node.inputs[key] = val;
          node.inputOrder.push(val);
        } else {
          // This is a parameter value
          node.params[key] = val;
          node.paramOrder.push(key);
        }
      } else {
        const id = parseValue(part);
        if (!id) return;
        node.inputOrder.push(id);
        node.inputs["in" + node.inputOrder.length] = id;
      }
    });
    (node.paramOrder || []).forEach((key, idx) => {
      const alias = "arg_" + (idx + 1);
      if (!(alias in node.params)) {
        node.params[alias] = node.params[key];
      }
    });
  }

  lines.forEach((line, index) => {
    if (!line) return;
    const lineNo = index + 1;

    let id;
    let expr;

    const assignMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (assignMatch) {
      id = assignMatch[1];
      expr = assignMatch[2].trim();

      // Special case: alias like `out = s0`
      const bareIdMatch = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)$/);
      if (bareIdMatch) {
        const target = bareIdMatch[1];
        if (ids.has(id)) {
          addError(lineNo, "Duplicate id '" + id + "'");
          return;
        }
        ids.add(id);
        const node = {
          id,
          type: "alias",
          outputType: "DistanceField",
          inputs: { in1: target },
          inputOrder: [target],
          params: {},
          paramOrder: []
        };
        nodes.push(node);
        return;
      }
    } else {
      id = "n" + index;
      expr = line.trim();
    }

    if (ids.has(id)) {
      addError(lineNo, "Duplicate id '" + id + "'");
      return;
    }
    ids.add(id);

    const callMatch = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/);
    if (!callMatch) {
      addError(lineNo, "Expected function call like: sphere(r=1.0)");
      return;
    }

    const func = callMatch[1];
    const args = callMatch[2].trim();

    const node = {
      id,
      type: func,
      outputType: "DistanceField",
      inputs: {},
      inputOrder: [],
      params: {},
      paramOrder: []
    };

    if (func === "sphere") {
      parseParams(args, node);
      if (!node.params.radius && node.params.r) {
        node.params.radius = node.params.r;
      }
      if (!node.params.radius) node.params.radius = "1.0";
    } else if (func === "box") {
      parseParams(args, node);
      if (!node.params.size && node.params.s) {
        node.params.size = node.params.s;
      }
      if (!node.params.size) node.params.size = "1.0";
    } else if (func === "capsule") {
      parseParams(args, node);
      if (!node.params.r && node.params.radius) {
        node.params.r = node.params.radius;
      }
      if (!node.params.r) node.params.r = "0.5";
      if (!node.params.a) node.params.a = ["0.0", "0.0", "0.0"];
      if (!node.params.b) node.params.b = ["0.0", "1.0", "0.0"];
    } else if (func === "ellipsoid") {
      parseParams(args, node);
      if (!node.params.r && node.params.radius) {
        node.params.r = node.params.radius;
      }
      if (!node.params.r) node.params.r = ["1.0", "1.0", "1.0"];
    } else if (func === "plane") {
      parseParams(args, node);
      if (!node.params.n) node.params.n = ["0.0", "1.0", "0.0"];
      if (!node.params.d) node.params.d = "0.0";
    } else if (func === "torus") {
      parseParams(args, node);
      if (!node.params.majorR && !node.params.r1) node.params.majorR = "1.0";
      if (!node.params.minorR && !node.params.r2) node.params.minorR = "0.3";
    } else if (func === "cylinder") {
      parseParams(args, node);
      if (!node.params.r && !node.params.radius) node.params.r = "0.5";
      if (!node.params.h && !node.params.height) node.params.h = "1.0";
    } else if (func === "cone") {
      parseParams(args, node);
      if (!node.params.r && !node.params.radius) node.params.r = "1.0";
      if (!node.params.h && !node.params.height) node.params.h = "1.0";
    } else if (func === "union" || func === "subtract" || func === "smoothUnion" || func === "smoothSubtract") {
      parseInputsAndParams(args, node);
      if (node.inputOrder.length < 1) {
        addError(lineNo, func + " requires at least one input");
      }
      if (func === "smoothUnion" && !node.params.k) {
        node.params.k = "0.2";
      }
      if (func === "smoothSubtract" && !node.params.k) {
        node.params.k = "0.2";
      }
    } else {
      parseParams(args, node);
      addError(lineNo, "Unknown function '" + func + "' (kept as placeholder node)");
    }

    nodes.push(node);
  });

  return { nodes, errors };
}

// ---------- Shadow Mode Parser (AST-only, no effect on IR/GLSL) ----------

export function shadowParseDsl(text) {
  const lines = normalizeDslText(text);
  const ast = [];
  const errors = [];

  lines.forEach((line, index) => {
    if (!line) return;
    const lineNo = index + 1;
    let node = { line: lineNo, raw: line, kind: "unknown" };

    // def name(...)
    const defMatch = line.match(/^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)\s*:?/);
    if (defMatch) {
      node.kind = "def";
      node.name = defMatch[1];
      node.params = (defMatch[2] || "").split(",")
        .map(s => s.trim())
        .filter(Boolean);
      ast.push(node);
      return;
    }

    // assignment
    const assignMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (assignMatch) {
      const id = assignMatch[1];
      const expr = assignMatch[2].trim();
      node.kind = "assign";
      node.name = id;
      node.expr = expr;

      const callMatch = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/);
      if (callMatch) {
        node.exprKind = "call";
        node.callee = callMatch[1];
        node.argsRaw = callMatch[2];
      } else {
        node.exprKind = "expr";
      }
      ast.push(node);
      return;
    }

    // bare function call?
    const callOnlyMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/);
    if (callOnlyMatch) {
      node.kind = "call";
      node.callee = callOnlyMatch[1];
      node.argsRaw = callOnlyMatch[2];
      ast.push(node);
      return;
    }

    // bare identifier or unknown expression
    const identMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (identMatch) {
      node.kind = "ident";
      node.name = identMatch[1];
      ast.push(node);
      return;
    }

    node.kind = "unknown";
    errors.push("Line " + lineNo + ": shadow parser couldn't classify '" + line + "'");
    ast.push(node);
  });

  return { ast, errors };
}
