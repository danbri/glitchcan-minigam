// INK compile glue: allows injection of a compiler implementation
// so tests can run without network-installed inkjs.

export function compileInk(inkSource, opts = {}) {
  const { compilerImpl } = opts;
  if (typeof inkSource !== 'string' || !inkSource.trim()) {
    return { ok: false, error: new Error('Empty INK source') };
  }

  try {
    const impl = compilerImpl || detectGlobalInkjs();
    if (!impl) {
      return { ok: false, error: new Error('No compiler available: provide opts.compilerImpl or include inkjs') };
    }

    const story = impl(inkSource);
    if (!story) {
      return { ok: false, error: new Error('Compiler returned no story') };
    }
    return { ok: true, story };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

function detectGlobalInkjs() {
  // Browser global inkjs.Compiler API
  if (typeof globalThis !== 'undefined' && globalThis.inkjs && typeof globalThis.inkjs.Compiler === 'function') {
    return (source) => new globalThis.inkjs.Compiler(source).Compile();
  }
  return null;
}

