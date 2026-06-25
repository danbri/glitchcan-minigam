// automation-runtime.js — runs an automation script in a sandboxed Web Worker.
//
// The script never touches the DOM or the app objects directly: it runs in a
// Worker with a curated `edot` API and talks to the host only through it —
//   edot.log(...args)               print to the run log
//   edot.invoke(capability, payload) call a kernel capability (returns a value)
//   edot.publish(topic, payload)     publish on the kernel bus
//   edot.sleep(ms)                   await a delay (capped)
// DOM isolation is structural (a Worker has no document). Network is still
// reachable in this v1; a QuickJS-in-WASM backend can remove that too later.
//
// The host wires `api(op, payload)` to the kernel; every edot.* call round-trips
// to the host and back, so the script only ever does what the host allows.

const WORKER_SRC = `
'use strict';
let started = false, seq = 0;
const pending = new Map();
const clone = (v) => { try { return typeof v === 'object' && v !== null ? JSON.parse(JSON.stringify(v)) : v; } catch (_) { return String(v); } };
self.onmessage = async (e) => {
  const m = e.data || {};
  if (m.type === 'reply') {
    const p = pending.get(m.id); if (!p) return; pending.delete(m.id);
    m.error ? p.reject(new Error(m.error)) : p.resolve(m.value); return;
  }
  if (m.type !== 'run' || started) return;
  started = true;
  const call = (op, payload) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); self.postMessage({ type: 'call', id, op, payload }); });
  const edot = {
    log: (...args) => self.postMessage({ type: 'log', args: args.map(clone) }),
    invoke: (name, payload) => call('invoke', { name, payload }),
    publish: (topic, payload) => call('publish', { topic, payload }),
    sleep: (ms) => new Promise((r) => setTimeout(r, Math.max(0, Math.min(Number(ms) || 0, 10000)))),
  };
  try {
    const fn = new Function('edot', 'event', 'return (async () => {\\n' + m.code + '\\n})();');
    const result = await fn(edot, m.event);
    self.postMessage({ type: 'done', result: clone(result) });
  } catch (err) {
    self.postMessage({ type: 'error', error: String((err && err.stack) || err) });
  }
};
`;

export class AutomationRuntime {
  // api: async (op, payload) => value   — host bridge to the kernel.
  constructor(api) { this._api = typeof api === 'function' ? api : async () => null; }

  run(code, { onLog, timeoutMs = 8000, event = null } = {}) {
    return new Promise((resolve, reject) => {
      let worker, url;
      try {
        url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
        worker = new Worker(url);
      } catch (e) { reject(e); return; }
      const cleanup = () => { try { worker.terminate(); } catch (_) {} try { URL.revokeObjectURL(url); } catch (_) {} };
      const timer = setTimeout(() => { cleanup(); reject(new Error(`Automation timed out after ${timeoutMs}ms`)); }, timeoutMs);

      worker.onmessage = async (e) => {
        const m = e.data || {};
        if (m.type === 'log') { onLog && onLog(m.args); return; }
        if (m.type === 'call') {
          try { const value = await this._api(m.op, m.payload); worker.postMessage({ type: 'reply', id: m.id, value }); }
          catch (err) { worker.postMessage({ type: 'reply', id: m.id, error: String((err && err.message) || err) }); }
          return;
        }
        if (m.type === 'done') { clearTimeout(timer); cleanup(); resolve(m.result); return; }
        if (m.type === 'error') { clearTimeout(timer); cleanup(); reject(new Error(m.error)); }
      };
      worker.onerror = (e) => { clearTimeout(timer); cleanup(); reject(new Error(e.message || 'worker error')); };
      worker.postMessage({ type: 'run', code, event });
    });
  }
}
