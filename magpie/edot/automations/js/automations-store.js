// automations-store.js — local persistence for automations (localStorage v1).
// An automation: { id, name, trigger, code, enabled }.

const KEY = 'edot.automations.v1';

export function loadAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; }
}
export function saveAll(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list || [])); } catch (_) { /* quota */ }
}

let _n = 0;
export function newId() { return `a${Date.now().toString(36)}${(_n++).toString(36)}`; }

// Examples so the app isn't empty — and so the kernel wiring is visible.
export function seeds() {
  return [
    {
      id: newId(), name: 'Hello, log', trigger: 'manual', enabled: true,
      code: "// Scripts get a curated `edot` API (no DOM, no direct app access).\nedot.log('Hello from an automation 👋');\nreturn 'ran at ' + new Date().toLocaleTimeString();",
    },
    {
      id: newId(), name: 'Push cities to Slides', trigger: 'manual', enabled: true,
      code: "// Drive the apps through kernel capabilities.\nawait edot.invoke('slides.addData', {\n  columns: ['City', 'Wikidata'],\n  rows: [['Bristol', 'Q23154'], ['London', 'Q84'], ['Paris', 'Q90']],\n  title: 'Cities',\n});\nedot.log('Added a slide to the deck. Open Slides to see it.');",
    },
    {
      id: newId(), name: 'When data is shared → log it', trigger: 'data-share', enabled: false,
      code: "// `event` holds the trigger payload. This runs whenever the Data app\n// shares a result (e.g. its “→ Editor” button).\nedot.log('Data shared:', event && event.title, '—', (event && event.rows || []).length, 'rows');",
    },
  ];
}
