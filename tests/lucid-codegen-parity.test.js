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
const { generateWgslFromJson } = await import('../lucid/core/wgsl-codegen.js');
const { evaluateExpr, evaluateRig } = await import('../lucid/core/rig-evaluator.js');

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
});
