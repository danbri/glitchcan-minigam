// projects-app.js — <edot-projects>: the home for project bundles. Start from a
// template, open a .zip someone shared, or save the current workspace as a .zip.
// Opening publishes `project:open` on the kernel bus; the shell hydrates the
// Editor / Slides / Data panes from it. Saving asks the shell for a snapshot via
// the `project.snapshot` capability and zips it.
import { getKernel } from '../../js/edot-kernel.js';
import { getRegistry } from '../../js/command-registry.js';
import { buildProjectZip, readProjectZip } from './edot-project.js';
import { TEMPLATES, buildTemplate } from './templates.js';

// Active-instance tracking + command-registry contributions (Phase 2).
let activeProjects = null;
let projectsCommandsWired = false;
function registerProjectsCommands() {
  if (projectsCommandsWired) return;
  const inProjects = (ctx) => ctx && ctx.app === 'projects' && !!activeProjects;
  try {
    getRegistry().registerAll([
      { id: 'projects.save', title: 'Save current as .zip', icon: '⬇', group: '0project', keywords: 'save export zip project', appliesTo: 'Project', when: inProjects, run: () => activeProjects._save() },
      { id: 'projects.open', title: 'Open project (.zip)', icon: '⬆', group: '0project', keywords: 'open import zip project', appliesTo: 'Project', when: inProjects, run: () => { const i = activeProjects.querySelector('.pj-open input'); if (i) i.click(); } },
    ]);
    projectsCommandsWired = true;
  } catch (_) { /* registry optional */ }
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function download(name, bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const slug = (s) => String(s || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';

class EdotProjects extends HTMLElement {
  connectedCallback() {
    if (this._mounted) return; this._mounted = true;
    this.kernel = getKernel();
    this.current = null; // { manifest, files }
    this.render();
    if (!activeProjects) activeProjects = this;
    this.addEventListener('focusin', () => { activeProjects = this; });
    registerProjectsCommands();
  }

  render() {
    this.innerHTML = `
      <div class="pj-app">
        <header class="pj-head">
          <h1 class="pj-title">Projects</h1>
          <p class="pj-sub">A project is a single <code>.zip</code> that bundles a problem space — its documents, data tables and slides — so you can ship it, open it, and work on it as one file.</p>
          <div class="pj-actions">
            <label class="pj-btn pj-open">⬆ Open project (.zip)<input type="file" accept=".zip,application/zip" hidden></label>
            <button class="pj-btn pj-save" type="button" title="Save the current workspace as a .zip">⬇ Save current as .zip</button>
            <button class="pj-btn pj-save-device" type="button" title="Save to this device's storage (no download)">💾 Save to device</button>
            <button class="pj-btn pj-open-device" type="button" title="Open a project saved on this device">📂 Open from device</button>
          </div>
          <p class="pj-status" role="status" aria-live="polite"></p>
        </header>

        <section class="pj-section pj-device" hidden>
          <h2>On this device</h2>
          <div class="pj-device-list"></div>
        </section>

        <section class="pj-section">
          <h2>Start from a template</h2>
          <div class="pj-gallery"></div>
        </section>

        <section class="pj-section pj-open-detail" hidden>
          <h2>Opened project</h2>
          <div class="pj-detail"></div>
        </section>
      </div>`;

    const gallery = this.querySelector('.pj-gallery');
    for (const t of TEMPLATES) {
      const p = t.build();
      const card = document.createElement('div');
      card.className = 'pj-card';
      card.innerHTML = `
        <div class="pj-card-icon">${t.icon}</div>
        <div class="pj-card-name">${esc(p.manifest.name)}</div>
        <div class="pj-card-desc">${esc(p.manifest.description)}</div>
        <div class="pj-card-apps">${(p.manifest.apps || []).map((a) => `<span class="pj-chip">${esc(a)}</span>`).join('')}</div>
        <div class="pj-card-actions">
          <button class="pj-btn pj-use" type="button">Use template</button>
          <button class="pj-btn pj-ghost pj-dl" type="button" title="Download as .zip">.zip</button>
        </div>`;
      card.querySelector('.pj-use').addEventListener('click', () => this.openProject(buildTemplate(t.id), `Started "${p.manifest.name}"`));
      card.querySelector('.pj-dl').addEventListener('click', () => download(`${slug(p.manifest.name)}.edot.zip`, buildProjectZip(buildTemplate(t.id))));
      gallery.appendChild(card);
    }

    this.querySelector('.pj-open input').addEventListener('change', (e) => this._onFile(e.target.files[0]));
    this.querySelector('.pj-save').addEventListener('click', () => this._save());
    this.querySelector('.pj-save-device').addEventListener('click', () => this._saveToDevice());
    this.querySelector('.pj-open-device').addEventListener('click', () => this._openFromDevice());
  }

  status(msg) { const s = this.querySelector('.pj-status'); if (s) s.textContent = msg || ''; }

  async _onFile(file) {
    if (!file) return;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const project = await readProjectZip(buf);
      // readProjectZip gives { manifest, files(bytes), text() }. Convert to text map.
      const files = {};
      for (const name of Object.keys(project.files)) { const t = project.text(name); if (t != null) files[name] = t; }
      this._showDetail(project.manifest, files);
      this.status(`Opened "${project.manifest.name}". Review it below, then load it into your workspace.`);
    } catch (err) {
      this.status(`Could not open: ${err.message}`);
    }
  }

  _showDetail(manifest, files) {
    this.current = { manifest, files };
    const wrap = this.querySelector('.pj-open-detail');
    wrap.hidden = false;
    const declared = [
      ...(manifest.docs || []).map((d) => ['Document', d.title, d.file]),
      ...(manifest.data || []).map((d) => ['Data', d.title, d.file]),
      ...(manifest.slides || []).map((d) => ['Slides', d.title, d.file]),
      ...(manifest.places || []).map((d) => ['Places', d.title, d.file]),
      ...(manifest.calendar || []).map((d) => ['Events', d.title, d.file]),
    ];
    this.querySelector('.pj-detail').innerHTML = `
      <div class="pj-detail-head">
        <div class="pj-card-icon">📦</div>
        <div>
          <div class="pj-card-name">${esc(manifest.name)}</div>
          <div class="pj-card-desc">${esc(manifest.description || '')}</div>
        </div>
      </div>
      <ul class="pj-files">${declared.map(([k, t, f]) => `<li><span class="pj-k">${k}</span> ${esc(t || f)} <code>${esc(f)}</code></li>`).join('')}</ul>
      <button class="pj-btn pj-load" type="button">Open in workspace →</button>`;
    this.querySelector('.pj-load').addEventListener('click', () => this.openProject(this.current, `Loaded "${manifest.name}" into your workspace`));
  }

  // Publish the project so the shell hydrates Editor/Slides/Data from it.
  openProject(project, msg) {
    // Normalise template projects ({manifest, files:textMap}) and opened ones alike.
    const payload = { manifest: project.manifest, files: project.files };
    this.current = payload;
    try { this.kernel.bus.publish('project:open', payload); } catch (_) { /* standalone: no shell */ }
    this.status(msg || `Loaded "${payload.manifest.name}".`);
  }

  // The project to save: a live workspace snapshot, else the open project.
  async _projectForSave() {
    let snap = null;
    try { snap = this.kernel.capabilities.invoke('project.snapshot'); } catch (_) { snap = null; }
    if (snap && typeof snap.then === 'function') snap = await snap;
    return snap || this.current || null;
  }

  // Ask the shell for a live snapshot, zip it, download it.
  async _save() {
    const proj = await this._projectForSave();
    if (!proj) { this.status('Open a project or start from a template first.'); return; }
    download(`${slug(proj.manifest && proj.manifest.name)}.edot.zip`, buildProjectZip(proj));
    this.status(`Saved "${proj.manifest && proj.manifest.name}" as a .zip.`);
  }

  // ---- device storage via the unified ResourceSource (OPFS) ----
  async _deviceStorage() {
    const { getConnections } = await import('../../js/connections.js');
    return getConnections().storageFor('device');
  }
  // Save the current project into this device's storage — no download, no login.
  async _saveToDevice() {
    const proj = await this._projectForSave();
    if (!proj) { this.status('Open a project or start from a template first.'); return; }
    try {
      const storage = await this._deviceStorage();
      const name = `${slug(proj.manifest && proj.manifest.name)}.edot.zip`;
      await storage.write(`/projects/${name}`, buildProjectZip(proj));
      this.status(`Saved “${proj.manifest && proj.manifest.name}” to this device.`);
      await this._refreshDeviceList();
    } catch (e) { this.status(`Could not save to device: ${e.message}`); }
  }
  // List + open projects saved on this device.
  async _openFromDevice() { await this._refreshDeviceList(true); }
  async _refreshDeviceList(reveal) {
    const wrap = this.querySelector('.pj-device'); const list = this.querySelector('.pj-device-list');
    let entries = [];
    try { const storage = await this._deviceStorage(); entries = (await storage.list('/projects')).filter((e) => e.kind === 'file'); } catch (_) { entries = []; }
    if (reveal) wrap.hidden = false;
    if (wrap.hidden && !entries.length) return;
    wrap.hidden = false;
    list.innerHTML = '';
    if (!entries.length) { list.innerHTML = '<p class="pj-sub">No projects saved on this device yet.</p>'; return; }
    for (const e of entries) {
      const row = document.createElement('div'); row.className = 'pj-device-row';
      const open = document.createElement('button'); open.type = 'button'; open.className = 'pj-btn'; open.textContent = `📦 ${e.name}`;
      open.addEventListener('click', () => this._openDeviceFile(e.path, e.name));
      const del = document.createElement('button'); del.type = 'button'; del.className = 'pj-btn pj-ghost'; del.textContent = '✕'; del.title = 'Delete';
      del.addEventListener('click', async () => { try { (await this._deviceStorage()).remove(e.path); } catch (_) {} this._refreshDeviceList(); });
      row.append(open, del); list.appendChild(row);
    }
  }
  async _openDeviceFile(path, name) {
    try {
      const storage = await this._deviceStorage();
      const bytes = await storage.read(path);
      const project = await readProjectZip(bytes);
      const files = {}; for (const n of Object.keys(project.files)) { const t = project.text(n); if (t != null) files[n] = t; }
      this.openProject({ manifest: project.manifest, files }, `Loaded "${project.manifest.name}" from this device`);
    } catch (e) { this.status(`Could not open ${name}: ${e.message}`); }
  }
}

if (!customElements.get('edot-projects')) customElements.define('edot-projects', EdotProjects);
export { EdotProjects };
