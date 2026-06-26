// automations-app.js — <edot-automations>: a small Apps-Script / Shortcuts-style
// automation tool. Each automation is a trigger + a JS script that drives the
// suite through kernel capabilities. Scripts run in a sandboxed Web Worker (see
// automation-runtime.js): no DOM, no direct app access — only the `edot` API.
//
// Triggers shipped here are the ones that actually work in a browser tab:
//   • manual      — the Run button
//   • data-share  — when the Data app shares a result (kernel bus 'data:share')
//   • interval    — every 30s WHILE THE APP IS OPEN
// Background triggers (time/geofence/email while the tab is closed) need platform
// features web apps don't have on iOS — see README/automations notes.

import { getKernel } from '../../js/edot-kernel.js';
import { getRegistry } from '../../js/command-registry.js';
import { AutomationRuntime } from './automation-runtime.js';
import { loadAll, saveAll, seeds, newId } from './automations-store.js';

// Active-instance tracking + command-registry contributions (Phase 2).
let activeAutomations = null;
let automationsCommandsWired = false;
function registerAutomationsCommands() {
  if (automationsCommandsWired) return;
  const inAuto = (ctx) => ctx && ctx.app === 'automations' && !!activeAutomations;
  try {
    getRegistry().registerAll([
      { id: 'automations.new', title: 'New automation', icon: '＋', group: '0auto', keywords: 'new automation script', appliesTo: 'Automation', when: inAuto, run: () => activeAutomations._newItem() },
      { id: 'automations.runSelected', title: 'Run selected automation', icon: '▶', group: '0auto', keywords: 'run execute automation', appliesTo: 'Automation', when: (ctx) => inAuto(ctx) && !!activeAutomations.selected, run: () => activeAutomations._run(activeAutomations.selected) },
    ]);
    automationsCommandsWired = true;
  } catch (_) { /* registry optional */ }
}

const TRIGGERS = [
  { id: 'manual', label: 'Manual — Run button' },
  { id: 'data-share', label: 'When data is shared' },
  { id: 'interval', label: 'Every 30s (while open)' },
];
const triggerLabel = (id) => (TRIGGERS.find((t) => t.id === id) || {}).label || id;
const fmt = (v) => (typeof v === 'string' ? v : (() => { try { return JSON.stringify(v); } catch (_) { return String(v); } })());

export class EdotAutomations extends HTMLElement {
  connectedCallback() {
    if (this._built) return;
    this._built = true;
    this.items = loadAll();
    if (!this.items.length) { this.items = seeds(); saveAll(this.items); }
    this.selectedId = this.items[0] ? this.items[0].id : null;
    this._kernel = getKernel();
    this._runtime = new AutomationRuntime((op, p) => this._api(op, p));
    this._render();
    this._wireTriggers();
    if (!activeAutomations) activeAutomations = this;
    this.addEventListener('focusin', () => { activeAutomations = this; });
    registerAutomationsCommands();
  }
  disconnectedCallback() { this._unwireTriggers(); }

  // The bridge the sandbox calls through — the ONLY thing scripts can reach.
  _api(op, p) {
    const k = this._kernel;
    if (op === 'invoke') return k.capabilities.invoke(p.name, p.payload);
    if (op === 'publish') { k.bus.publish(p.topic, p.payload); return true; }
    return null;
  }

  get selected() { return this.items.find((a) => a.id === this.selectedId) || null; }
  _save() { saveAll(this.items); }

  _wireTriggers() {
    this._unsub = this._kernel.bus.subscribe('data:share', (payload) => this._fire('data-share', payload));
    this._interval = setInterval(() => this._fire('interval', { at: Date.now() }), 30000);
  }
  _unwireTriggers() { if (this._unsub) this._unsub(); clearInterval(this._interval); }
  _fire(trigger, event) {
    for (const a of this.items) if (a.enabled && a.trigger === trigger) this._run(a, event);
  }

  async _run(a, event = null) {
    this._log(`▶ ${a.name}  ·  ${triggerLabel(a.trigger)}`);
    try {
      const result = await this._runtime.run(a.code, { event, onLog: (args) => this._log(args.map(fmt).join(' ')) });
      this._log(result !== undefined && result !== null ? `✓ ${fmt(result)}` : '✓ done');
    } catch (e) { this._log(`✗ ${e.message}`); }
  }

  _log(line) {
    if (!this._logEl) return;
    const t = new Date().toLocaleTimeString();
    this._logEl.textContent += `[${t}] ${line}\n`;
    this._logEl.scrollTop = this._logEl.scrollHeight;
  }

  // ---- rendering ----
  _render() {
    this.innerHTML = '';
    const root = document.createElement('div'); root.className = 'au-app';

    const list = document.createElement('aside'); list.className = 'au-list';
    const lh = document.createElement('div'); lh.className = 'au-list-head';
    lh.innerHTML = '<h2>Automations</h2>';
    const add = document.createElement('button'); add.type = 'button'; add.className = 'au-btn'; add.textContent = '＋ New';
    add.addEventListener('click', () => this._newItem());
    lh.appendChild(add);
    const ul = document.createElement('div'); ul.className = 'au-items'; this._itemsEl = ul;
    list.append(lh, ul);

    const main = document.createElement('section'); main.className = 'au-main'; this._mainEl = main;

    root.append(list, main);
    this.append(root);
    this._renderList();
    this._renderEditor();
  }

  _renderList() {
    const ul = this._itemsEl; ul.innerHTML = '';
    for (const a of this.items) {
      const row = document.createElement('div'); row.className = 'au-item' + (a.id === this.selectedId ? ' active' : '');
      const on = document.createElement('input'); on.type = 'checkbox'; on.checked = !!a.enabled; on.title = 'Enabled';
      on.addEventListener('click', (e) => e.stopPropagation());
      on.addEventListener('change', () => { a.enabled = on.checked; this._save(); });
      const txt = document.createElement('button'); txt.type = 'button'; txt.className = 'au-item-main';
      txt.innerHTML = `<span class="au-name"></span><span class="au-trig"></span>`;
      txt.querySelector('.au-name').textContent = a.name;
      txt.querySelector('.au-trig').textContent = triggerLabel(a.trigger);
      txt.addEventListener('click', () => { this.selectedId = a.id; this._renderList(); this._renderEditor(); });
      row.append(on, txt);
      ul.appendChild(row);
    }
  }

  _renderEditor() {
    const a = this.selected;
    const m = this._mainEl; m.innerHTML = '';
    if (!a) { const e = document.createElement('p'); e.className = 'au-empty'; e.textContent = 'No automation selected.'; m.appendChild(e); return; }

    const name = document.createElement('input'); name.className = 'au-input au-name-input'; name.value = a.name; name.setAttribute('aria-label', 'Automation name');
    name.addEventListener('input', () => { a.name = name.value; this._save(); this._renderList(); });

    const trig = document.createElement('select'); trig.className = 'au-input';
    for (const t of TRIGGERS) { const o = document.createElement('option'); o.value = t.id; o.textContent = t.label; trig.appendChild(o); }
    trig.value = a.trigger;
    trig.addEventListener('change', () => { a.trigger = trig.value; this._save(); this._renderList(); });

    const head = document.createElement('div'); head.className = 'au-edit-head';
    const trigWrap = document.createElement('label'); trigWrap.className = 'au-trig-wrap'; trigWrap.append(document.createTextNode('Trigger'), trig);
    head.append(name, trigWrap);

    const code = document.createElement('textarea'); code.className = 'au-code'; code.spellcheck = false; code.value = a.code;
    code.setAttribute('aria-label', 'Automation script');
    code.addEventListener('input', () => { a.code = code.value; this._save(); });

    const bar = document.createElement('div'); bar.className = 'au-bar';
    const run = document.createElement('button'); run.type = 'button'; run.className = 'au-btn au-run'; run.textContent = '▶ Run';
    run.addEventListener('click', () => this._run(a));
    const del = document.createElement('button'); del.type = 'button'; del.className = 'au-btn'; del.textContent = '🗑 Delete';
    del.addEventListener('click', () => this._deleteItem(a));
    const hint = document.createElement('span'); hint.className = 'au-hint';
    hint.textContent = 'API: edot.invoke(capability, payload) · edot.publish(topic, payload) · edot.log(…) · edot.sleep(ms) · event';
    bar.append(run, del, hint);

    const log = document.createElement('pre'); log.className = 'au-log'; log.setAttribute('aria-label', 'Run log'); this._logEl = log;

    m.append(head, code, bar, log);
  }

  _newItem() {
    const a = { id: newId(), name: 'New automation', trigger: 'manual', enabled: true, code: "edot.log('hello');\nreturn 'ok';" };
    this.items.push(a); this.selectedId = a.id; this._save();
    this._renderList(); this._renderEditor();
  }
  _deleteItem(a) {
    this.items = this.items.filter((x) => x.id !== a.id);
    if (this.selectedId === a.id) this.selectedId = this.items[0] ? this.items[0].id : null;
    this._save(); this._renderList(); this._renderEditor();
  }
}

customElements.define('edot-automations', EdotAutomations);
