import { strict as assert } from 'node:assert';
import { compileInk } from '../src/lib/inkEngine.js';

// Tiny stub that mimics an inkjs.Compiler().Compile() result
function stubCompiler(inkSource) {
  if (!/->\s*start/.test(inkSource)) throw new Error('No entry point');
  return {
    canContinue: true,
    _continued: false,
    currentChoices: [],
    Continue() {
      if (this._continued) return '';
      this._continued = true;
      return 'stub line';
    },
    get currentTags() { return []; }
  };
}

export async function run() {
  const ink = `-> start\n\n=== start ===\nHello\n`;

  // Success path with injected compiler
  {
    const res = compileInk(ink, { compilerImpl: stubCompiler });
    assert.equal(res.ok, true);
    assert.ok(res.story && typeof res.story.Continue === 'function');
    const line = res.story.Continue();
    assert.equal(line, 'stub line');
  }

  // Failure path without compiler
  {
    const res = compileInk(ink);
    assert.equal(res.ok, false);
    assert.ok(/No compiler/.test(String(res.error && res.error.message)));
  }
}

