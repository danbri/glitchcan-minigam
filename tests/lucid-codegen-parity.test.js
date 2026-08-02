/**
 * Codegen parity tests — lock in the GLSL/WGSL interop work so it can't
 * silently regress. Pure Node (no browser/GPU): asserts on the generated
 * shader strings from core/json-codegen.js and core/wgsl-codegen.js.
 *
 * Run with: npx vitest run tests/lucid-codegen-parity.test.js
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

globalThis.window = globalThis;
globalThis.document = { createElement: () => ({}) };

const { loadJsonScene } = await import('../lucid/core/json-loader.js');
const { generateGlslFromJson } = await import('../lucid/core/json-codegen.js');
const { generateWgslFromJson, generateWgslSceneSDF } = await import('../lucid/core/wgsl-codegen.js');
const { evaluateExpr, evaluateRig } = await import('../lucid/core/rig-evaluator.js');
const { exprToSexpr, readOne, formToExpr, formToNode } = await import('../lucid/core/sexpr.js');
const { spliceEngine } = await import('../lucid/clipclop/splice-lib.js');
const { flattenToEdits, evalEdits, evalTree, generateEditListWgsl } = await import('../lucid/core/sdf-editlist.js');

const glsl = (json, opts) => generateGlslFromJson(loadJsonScene(json), opts || {});
const wgsl = (json, opts) => generateWgslFromJson(loadJsonScene(json), opts || {});
const sphereWith = (r) => ({ name: 't', params: { time: 0 }, root: { type: 'sphere', params: { r } } });

// Capture console.warn to detect "Unknown expression op" from the GLSL default case.
function withWarnCapture(fn) {
  const warns = [];
  const orig = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  try { fn(); } finally { console.warn = orig; }
  return warns;
}

describe('expression-op parity (GLSL <-> WGSL)', () => {
  const scalarOps = {
    pow: [{ var: 'time' }, 2], sqrt: [{ var: 'time' }], exp: [{ var: 'time' }], log: [{ var: 'time' }],
    asin: [{ var: 'time' }], acos: [{ var: 'time' }], atan: [{ var: 'time' }], round: [{ var: 'time' }],
    lerp: [{ var: 'time' }, 1, 0.5],
  };
  for (const [op, args] of Object.entries(scalarOps)) {
    it(`GLSL supports '${op}' (was previously 0.0 + warning)`, () => {
      const warns = withWarnCapture(() => {
        const g = glsl(sphereWith({ expr: op, args }));
        expect(g.length).toBeGreaterThan(0);
      });
      expect(warns.some(w => w.includes('Unknown expression op'))).toBe(false);
    });
    it(`WGSL supports '${op}'`, () => {
      expect(wgsl(sphereWith({ expr: op, args })).length).toBeGreaterThan(0);
    });
  }

  it('WGSL mod is floored (a - b*floor(a/b)), not truncated %', () => {
    const w = wgsl(sphereWith({ expr: 'mod', args: [{ var: 'time' }, 2] }));
    const line = w.split('\n').find(l => l.includes('sdSphere') && l.includes('floor'));
    expect(line).toBeTruthy();
    expect(line.includes('%')).toBe(false);
  });
});

describe('select', () => {
  const scene = {
    name: 's', params: { time: 0 },
    root: { type: 'select', cond: { var: 'time' },
      a: { type: 'sphere', params: { r: 0.5 } },
      b: { type: 'box', params: { size: [0.4, 0.4, 0.4] } } },
  };
  it('GLSL emits a real branchless select over both children', () => {
    const g = glsl(scene);
    expect(g).toMatch(/select_\d+/);
    expect(g.includes('sdSphere') && g.includes('sdBox')).toBe(true);
  });
  it('WGSL emits both children (was a sphere-only stub)', () => {
    const w = wgsl(scene);
    expect(w).toMatch(/select_\d+/);
    expect(w.includes('sdSphere') && w.includes('sdBox')).toBe(true);
  });
});

describe('ellipsoid distance fidelity', () => {
  const ell = (radii, extra) => ({ name: 'e', root: { type: 'ellipsoid', params: { radii }, ...(extra || {}) } });
  it("default 'fast' emits the bare sdEllipsoid (byte-identical path)", () => {
    const g = glsl(ell([1, 0.2, 0.1]));
    expect(g.includes('sdEllipsoid(')).toBe(true);
    expect(g.includes('sdEllipsoidF')).toBe(false);
  });
  it("'exact' emits a Newton loop helper on both backends", () => {
    const g = glsl(ell([1, 0.2, 0.1]), { ellipsoidFidelity: 'exact' });
    const w = wgsl(ell([1, 0.2, 0.1]), { ellipsoidFidelity: 'exact' });
    expect(g).toContain('sdEllipsoidF6');
    expect(g).toMatch(/for \(int i = 0; i < 6; i\+\+\)/);
    expect(w).toContain('sdEllipsoidF6');
  });
  it("'auto' scales steps with eccentricity", () => {
    expect(glsl(ell([1, 0.2, 0.1]), { ellipsoidFidelity: 'auto' })).toContain('sdEllipsoidF6'); // ecc 10
    expect(glsl(ell([1, 0.5, 0.3]), { ellipsoidFidelity: 'auto' })).toContain('sdEllipsoidF3'); // ecc 3.3
    const near = glsl(ell([1, 0.95, 0.9]), { ellipsoidFidelity: 'auto' }); // ~sphere
    expect(near.includes('sdEllipsoidF')).toBe(false);
  });
  it('per-node fidelity overrides the default', () => {
    expect(glsl(ell([1, 0.2, 0.1], { fidelity: 'exact' }))).toContain('sdEllipsoidF6');
  });
});

describe('Shadertoy builtins (frame / timeDelta)', () => {
  for (const v of ['frame', 'timeDelta']) {
    it(`GLSL resolves {var:"${v}"} to u_${v} with no duplicate declaration`, () => {
      const g = glsl(sphereWith({ expr: 'add', args: [1.0, { expr: 'mul', args: [0.01, { var: v }] }] }));
      expect(g.includes(`u_${v}`)).toBe(true);
      // declared in the raymarcher prelude, not re-declared by codegen
      expect((g.match(new RegExp(`uniform float u_${v};`, 'g')) || []).length).toBe(0);
    });
    it(`WGSL resolves {var:"${v}"} to u.${v}`, () => {
      const w = wgsl(sphereWith({ expr: 'add', args: [1.0, { expr: 'mul', args: [0.01, { var: v }] }] }));
      expect(w.includes(`u.${v}`)).toBe(true);
    });
  }
});

describe('WGSL displace honours options (parity with GLSL)', () => {
  const disp = {
    name: 'd', root: {
      type: 'displace', noiseType: 'turbulence', octaves: 6, animate: true,
      scale: 2, amount: 0.3, transform: { translate: [1, 0, 0] },
      child: { type: 'sphere', params: { r: 1 } },
    },
  };
  it('emits turbulence with the requested octave count', () => {
    expect(wgsl(disp)).toMatch(/turbulence\(np, 6\)/);
  });
  it('emits an animated time offset', () => {
    expect(wgsl(disp).includes('u.time * 0.5')).toBe(true);
  });
  it('applies the node transform', () => {
    expect(wgsl(disp)).toMatch(/let pt = \(p - vec3f\(1/);
  });
});

describe('WGSL domain modifiers apply node.transform', () => {
  for (const [type, extra] of [['mirror', { axis: 'x' }], ['radial', { count: 5, axis: 'y' }], ['repeat', { period: [2, 0, 2] }]]) {
    it(`${type} folds the transformed point`, () => {
      const w = wgsl({ name: type, root: { type, ...extra, transform: { translate: [0.5, 0, 0] }, child: { type: 'sphere', params: { r: 0.3 } } } });
      expect(w).toMatch(/let pt = \(p - vec3f\(0.5/);
      expect(/pt\.[xyz]/.test(w)).toBe(true);
    });
  }
});

describe('CPU rig-evaluator op parity with the shader', () => {
  const fract = (x) => x - Math.floor(x);
  it('supports the scalar ops the shaders have (no Unknown-op warning)', () => {
    const warns = withWarnCapture(() => {
      for (const [op, args] of [['exp', [1]], ['log', [2]], ['asin', [0.5]], ['acos', [0.5]],
        ['atan', [1, 1]], ['round', [2.6]], ['lerp', [0, 10, 0.3]]]) {
        evaluateExpr({ expr: op, args }, {}, 0);
      }
    });
    expect(warns.some(w => w.includes('Unknown rig expression op'))).toBe(false);
    expect(evaluateExpr({ expr: 'atan', args: [1, 1] }, {}, 0)).toBeCloseTo(Math.PI / 4, 9);
    expect(evaluateExpr({ expr: 'lerp', args: [0, 10, 0.3] }, {}, 0)).toBe(3);
    expect(evaluateExpr({ expr: 'round', args: [2.6] }, {}, 0)).toBe(3);
  });
  it('hash matches the GLSL formula exactly', () => {
    const h = evaluateExpr({ expr: 'hash', args: [5] }, {}, 0);
    expect(h).toBeCloseTo(fract(Math.sin(5) * 43758.5453123), 12);
  });
  it('noise is deterministic and in [0,1]', () => {
    const a = evaluateExpr({ expr: 'noise', args: [1.5, 2.5, 0.5] }, {}, 0);
    const b = evaluateExpr({ expr: 'noise', args: [1.5, 2.5, 0.5] }, {}, 0);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
  });
  it('fbm/turbulence evaluate without warnings', () => {
    const warns = withWarnCapture(() => {
      evaluateExpr({ expr: 'fbm', args: [1, 2, 3, 4] }, {}, 0);
      evaluateExpr({ expr: 'turbulence', args: [1, 2, 3, 4] }, {}, 0);
    });
    expect(warns.length).toBe(0);
  });
});

describe('rig chains + conserved', () => {
  it('chain applies taper and clamps to maxBend with a violation', () => {
    const rig = { chains: { spine: { joints: ['h', 't', 'f'], bend: 30, constraints: { taper: 0.5, maxBend: 15 } } } };
    const r = evaluateRig({}, rig, 0);
    expect(r.values.spine_joint0).toBe(15); // 30, clamped
    expect(r.values.spine_joint1).toBe(15); // 30*0.5
    expect(r.values.spine_joint2).toBe(7.5); // 30*0.25
    expect(r.violations.some(v => v.severity === 'clamped')).toBe(true);
  });
  it('conserved auto-adjusts one param to hold the product', () => {
    const rig = { conserved: { volume: { params: ['sx', 'sy', 'sz'], adjust: 'sz', target: 1 } } };
    const r = evaluateRig({ sx: { value: 2 }, sy: { value: 2 }, sz: { value: 9 } }, rig, 0);
    expect(r.values.sz).toBeCloseTo(0.25, 9);
    expect(r.values.sx * r.values.sy * r.values.sz).toBeCloseTo(1, 9);
  });
  it('conserved warns when the product deviates beyond tolerance', () => {
    const rig = { conserved: { volume: { params: ['sx', 'sy'], target: 1, tolerance: 0.05, warn: true } } };
    const r = evaluateRig({ sx: { value: 1.5 }, sy: { value: 1 } }, rig, 0);
    expect(r.violations.some(v => v.severity === 'warning')).toBe(true);
  });
});

describe('Stinkyfish group(0) uniform layout consistency', () => {
  // The WGSL Uniforms struct and the hand-packed Float32Array must stay in sync
  // (std140-ish: vec3f/vec4f align to 16 bytes, vec2f to 8, f32 to 4; total 160).
  // This catches the "edit three places in sync" hazard without a GPU.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(path.join(here, '..', 'lucid', 'stinkyfish', 'raymarcher.js'), 'utf8');

  const structBody = (src.match(/struct Uniforms \{([\s\S]*?)\}/) || [])[1] || '';
  const fields = structBody.split('\n')
    .map(l => l.replace(/\/\/.*$/, '').trim())
    .filter(Boolean)
    .map(l => (l.match(/^\w+\s*:\s*(f32|vec2f|vec3f|vec4f)/) || [])[1])
    .filter(Boolean);

  const SIZE = { f32: 4, vec2f: 8, vec3f: 12, vec4f: 16 };
  const ALIGN = { f32: 4, vec2f: 8, vec3f: 16, vec4f: 16 };

  it('every struct field is std140-aligned and the struct is 160 bytes', () => {
    expect(fields.length).toBeGreaterThan(0);
    let offset = 0;
    for (const t of fields) {
      expect(offset % ALIGN[t]).toBe(0); // fails if a pad slot is missing/wrong
      offset += SIZE[t];
    }
    expect(offset).toBe(160);
  });

  it('the packed Float32Array has 40 elements (160 bytes)', () => {
    const arr = (src.match(/const uniformData = new Float32Array\(\[([\s\S]*?)\]\);/) || [])[1] || '';
    const count = arr.replace(/\/\/[^\n]*/g, '').split(',').map(s => s.trim()).filter(Boolean).length;
    expect(count).toBe(40);
  });
});

describe('whole library still codegens on both backends', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const scenesDir = path.join(here, '..', 'lucid', 'scenes');
  function walk(dir) {
    let out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out = out.concat(walk(p));
      else if (e.name.endsWith('.json') && e.name !== 'toc.json') out.push(p);
    }
    return out;
  }
  const files = walk(scenesDir);
  it(`generates non-empty GLSL and WGSL for all ${files.length} scenes`, () => {
    const failures = [];
    for (const f of files) {
      try {
        const scene = loadJsonScene(JSON.parse(readFileSync(f, 'utf8')));
        const g = generateGlslFromJson(scene, {});
        const w = generateWgslFromJson(scene, {});
        if (!g.length || !w.length) failures.push(path.basename(f) + ' (empty)');
      } catch (e) {
        failures.push(path.basename(f) + ': ' + e.message.slice(0, 60));
      }
    }
    expect(failures).toEqual([]);
  });

  // The clipclop engine (lucid/clipclop/) bakes a scene, so it needs the codegen
  // to emit its exact contract from a Lucid JSON scene. Lock that bridge in.
  describe('clipclop bridge (generateWgslSceneSDF)', () => {
    const bridge = (json, opts) => generateWgslSceneSDF(loadJsonScene(json), opts || {});
    const REQUIRED = [
      'struct Scene', 'struct CacheSample',
      'fn sceneSDF(p: vec3f, scene: Scene) -> f32',
      'fn cacheSceneSample(p: vec3f, s: Scene) -> CacheSample',
      'fn cacheSceneSDF(p: vec3f, s: Scene) -> f32',
      'fn cacheSceneAlbedo(p: vec3f, s: Scene) -> vec3f'
    ];
    const balanced = (s) => {
      let d = 0;
      for (const c of s) { if (c === '{') d++; else if (c === '}') { d--; if (d < 0) return false; } }
      return d === 0;
    };

    it('emits the engine contract for a simple scene', () => {
      const { wgsl } = bridge({ name: 't', root: { type: 'sphere', params: { r: 0.5, color: [1, 0, 0] } } });
      for (const sig of REQUIRED) expect(wgsl).toContain(sig);
      expect(balanced(wgsl)).toBe(true);
    });

    it('is uniform-free — no dangling scene.u_ or leaked u.* builtins', () => {
      // time-driven displace is the classic leak path
      const { wgsl } = bridge({
        name: 't',
        root: { type: 'displace', animate: true, amount: 0.1,
          child: { type: 'sphere', params: { r: 0.5 } } }
      });
      expect(wgsl).not.toContain('scene.u_');
      expect(wgsl).not.toContain('u.time');
      expect(wgsl).toContain('scene.params.y');  // time wired to the engine's slot
    });

    it('respects emit flags for splicing into an engine that already has structs/primitives', () => {
      const { wgsl } = bridge({ name: 't', root: { type: 'sphere', params: { r: 0.5 } } },
        { emitStructs: false, emitPrimitives: false, emitHelpers: false });
      expect(wgsl).not.toContain('struct Scene');
      expect(wgsl).not.toContain('fn sdSphere');
      expect(wgsl).toContain('fn sceneSDF(p: vec3f, scene: Scene)');  // contract still present
    });

    it('generates valid-structured output for all scenes', () => {
      const failures = [];
      for (const f of files) {
        try {
          const { wgsl } = generateWgslSceneSDF(loadJsonScene(JSON.parse(readFileSync(f, 'utf8'))));
          const problems = [];
          for (const sig of REQUIRED) if (!wgsl.includes(sig)) problems.push('missing ' + sig);
          if (!balanced(wgsl)) problems.push('unbalanced');
          if (wgsl.includes('scene.u_')) problems.push('dangling uniform');
          if (/\bu\.(time|frame|mouse|resolution|cameraPos)\b/.test(wgsl)) problems.push('leaked builtin');
          if (problems.length) failures.push(path.basename(f) + ': ' + problems.join(', '));
        } catch (e) {
          failures.push(path.basename(f) + ': ' + e.message.slice(0, 60));
        }
      }
      expect(failures).toEqual([]);
    });
  });
});

// The clipclop splice injects the bridge WGSL into a fetched copy of the engine
// and rewrites the bake seam. It can't render headless (no WebGPU), but the two
// real hazards — duplicate fn defs and calls to undefined lx_* functions — are
// checkable by assembling the WGSL module the way the engine does. This also
// guards the seam anchors: if the engine's WGSL changes, spliceEngine throws.
describe('clipclop splice (splice-lib.js)', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const engineHtml = readFileSync(path.join(here, '..', 'lucid', 'clipclop', 'index.html'), 'utf8');
  const wgslBlocks = (html) => {
    const re = /\/\* wgsl \*\/`([\s\S]*?)`/g; const out = []; let m;
    while ((m = re.exec(html)) !== null) out.push(m[1]);
    return out;
  };
  const fnDecls = (src) => {
    const re = /\bfn\s+([A-Za-z_]\w*)\s*\(/g; const out = []; let m;
    while ((m = re.exec(src)) !== null) out.push(m[1]);
    return out;
  };
  const lxCalls = (src) => {
    const re = /\b(lx_[A-Za-z0-9_]*)\s*\(/g; const out = new Set(); let m;
    while ((m = re.exec(src)) !== null) out.add(m[1]);
    return [...out];
  };

  const cases = [
    '(scale 3 (smoothUnion :k 0.5 (sphere :r 1.2) (translate [0 1.4 0] (sphere :r 0.9)) (translate [1.8 0 0] (box :size [0.7 0.7 0.7]))))',
    '(union (material [1 0 0] (sphere :r 1)) (translate [1.5 0 0] (torus :major 0.8 :minor 0.3)))'
  ];

  for (const s of cases) {
    it(`assembles a collision-free WGSL module for ${s.slice(0, 30)}…`, () => {
      const root = formToNode(readOne(s));
      const { html, bridge } = spliceEngine(engineHtml, { name: 't', root });
      const [sceneW, analyticW, cacheW] = wgslBlocks(html);
      const mod = sceneW + '\n' + analyticW + '\n' + cacheW;

      const decls = fnDecls(mod);
      const dupes = [...new Set(decls.filter((n, i) => decls.indexOf(n) !== i))];
      expect(dupes).toEqual([]);                       // no redefinitions

      const declSet = new Set(decls);
      const undefinedCalls = lxCalls(mod).filter(c => !declSet.has(c));
      expect(undefinedCalls).toEqual([]);              // every lx_ call is defined

      expect(html).toContain(`let v=${bridge.entryCall};return CacheSample(v.x,v.yzw);`); // bake seam
      expect(html).toContain('name="lucid-splice"');
    });
  }

  it('splices the edit-list mode with a data-driven loop, no collisions', () => {
    const root = formToNode(readOne(cases[0]));
    const { html, bridge } = spliceEngine(engineHtml, { name: 't', root }, { mode: 'editlist' });
    expect(bridge.mode).toBe('editlist');
    expect(bridge.count).toBeGreaterThan(0);
    const [sceneW, analyticW, cacheW] = wgslBlocks(html);
    const mod = sceneW + '\n' + analyticW + '\n' + cacheW;
    const decls = fnDecls(mod);
    expect([...new Set(decls.filter((n, i) => decls.indexOf(n) !== i))]).toEqual([]);
    expect(mod).toContain('fn lx_editField(p: vec3f) -> vec4f');
    expect(html).toContain('let v=lx_editField(p);return CacheSample(v.x,v.yzw);');
  });

  it('throws a clear error if the engine seam anchors are gone', () => {
    expect(() => spliceEngine('<html>no wgsl</html>', { name: 't', root: { type: 'sphere', params: {} } }))
      .toThrow(/anchor not found|header not found/);
  });
});

// The edit list is the Dreams-style runtime form: flatten the tree into a flat
// buffer, fold it with a loop. It must reproduce the tree field exactly on the
// additive subset. Verified against a reference tree evaluator, GPU-free.
describe('sdf edit list (core/sdf-editlist.js)', () => {
  const editScenes = {
    'smoothUnion of primitives': '(scale 3 (smoothUnion :k 0.5 (sphere :r 1.2) (translate [0 1.4 0] (sphere :r 0.9)) (translate [1.8 0 0] (box :size [0.7 0.7 0.7]))))',
    'union': '(union (sphere :r 1) (translate [1.5 0 0] (box :size [0.6 0.6 0.6])))',
    'rotated + scaled': '(scale 2 (rotate [0 40 0] (union (box :size [0.6 0.3 0.3]) (translate [1 0 0] (sphere :r 0.4)))))',
    'subtract': '(subtract (sphere :r 1) (translate [0.6 0.6 0] (sphere :r 0.6)))'
  };
  const pts = [];
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) for (let k = -4; k <= 4; k++)
    pts.push([i * 0.8 + 0.13, j * 0.8 - 0.07, k * 0.8 + 0.21]);

  for (const [name, src] of Object.entries(editScenes)) {
    it(`flat fold equals the tree field: ${name}`, () => {
      const scene = loadJsonScene({ name, root: formToNode(readOne(src)) });
      const { edits, unsupported } = flattenToEdits(scene);
      expect(unsupported).toEqual([]);
      expect(edits.length).toBeGreaterThan(0);
      let maxErr = 0;
      for (const p of pts) {
        const a = Math.max(-100, Math.min(100, evalEdits(edits, p).d));
        const b = Math.max(-100, Math.min(100, evalTree(scene.root, p).d));
        maxErr = Math.max(maxErr, Math.abs(a - b));
      }
      expect(maxErr).toBeLessThan(1e-4);
    });
  }

  it('generates a balanced, data-driven WGSL loop', () => {
    const scene = loadJsonScene({ name: 't', root: formToNode(readOne(editScenes.union)) });
    const { wgsl, count } = generateEditListWgsl(scene);
    expect(count).toBe(2);
    expect(wgsl).toContain('fn lx_editField(p: vec3f) -> vec4f');
    expect(wgsl).toContain('for (var i = 0u;');
    expect((wgsl.match(/\{/g) || []).length).toBe((wgsl.match(/\}/g) || []).length);
  });
});

// The IR is already an S-expression in a JSON costume. core/sexpr.js is its
// surface syntax — a reader/printer over the SAME IR, so codegen is untouched.
// These lock in that the surface is faithful: it must not change what codegen
// emits, for any expression in the corpus.
describe('s-expression surface (core/sexpr.js)', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const scenesDir = path.join(here, '..', 'lucid', 'scenes');
  const walk = (dir) => {
    let out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out = out.concat(walk(p));
      else if (e.name.endsWith('.json') && e.name !== 'toc.json') out.push(p);
    }
    return out;
  };
  const files = walk(scenesDir);

  const roundExpr = (ir) => formToExpr(readOne(exprToSexpr(ir)));

  it('round-trips basic expression shapes to identical IR', () => {
    const cases = [
      { expr: 'mul', args: [{ var: 'rotationSpeed' }, { var: 'time' }] },
      { expr: 'add', args: [1, { expr: 'mul', args: [0.01, { var: 'time' }] }] },
      { expr: 'neg', args: [{ var: 'x' }] },
      { expr: 'sub', args: [{ var: 'a' }, { var: 'b' }] },
      { expr: 'clamp', args: [{ var: 'x' }, 0, 1] }
    ];
    for (const c of cases) expect(roundExpr(c)).toEqual(c);
  });

  it('reads the readable form (* rotationSpeed time)', () => {
    expect(formToExpr(readOne('(* rotationSpeed time)')))
      .toEqual({ expr: 'mul', args: [{ var: 'rotationSpeed' }, { var: 'time' }] });
    expect(formToExpr(readOne('(- x)'))).toEqual({ expr: 'neg', args: [{ var: 'x' }] });
    expect(formToExpr(readOne('(- a b)'))).toEqual({ expr: 'sub', args: [{ var: 'a' }, { var: 'b' }] });
  });

  it('parses a scene node subtree that codegens to valid WGSL', () => {
    const root = formToNode(readOne(
      '(union (material [1 0 0] (sphere :r 0.5)) (translate [1 0 0] (box :size [0.6 0.6 0.6])))'));
    const w = generateWgslFromJson(loadJsonScene({ name: 'd', root }), {});
    expect(w).toContain('fn sceneSDF(p: vec3f)');
    expect(w).toContain('sdBox');
  });

  it('every expression in the corpus is codegen-faithful after round-trip', () => {
    const walkExprs = (x, acc) => {
      if (Array.isArray(x)) { x.forEach(v => walkExprs(v, acc)); return; }
      if (x && typeof x === 'object') {
        if ((x.expr || x.op) && x.args) acc.push(x);
        Object.values(x).forEach(v => walkExprs(v, acc));
      }
    };
    const shadersFor = (e) => {
      const s = loadJsonScene({ name: 't', root: { type: 'sphere', params: { r: e } } });
      return generateWgslFromJson(s, {}) + generateGlslFromJson(s, {});
    };
    const exprs = [];
    for (const f of files) {
      try { walkExprs(JSON.parse(readFileSync(f, 'utf8')), exprs); } catch { /* skip */ }
    }
    expect(exprs.length).toBeGreaterThan(100);  // guard: we actually collected some
    const failures = [];
    for (const e of exprs) {
      const round = roundExpr(e);
      let a;
      try { a = shadersFor(e); } catch {
        // legacy bare-string args can't codegen in the synthetic wrapper;
        // fall back to structural identity of the round-tripped IR
        if (JSON.stringify(e) !== JSON.stringify(round)) failures.push(exprToSexpr(e));
        continue;
      }
      if (a !== shadersFor(round)) failures.push(exprToSexpr(e));
    }
    expect(failures).toEqual([]);
  });
});
