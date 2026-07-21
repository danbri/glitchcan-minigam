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
