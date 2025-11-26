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
  const lines = normalizeDslText(text);
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
