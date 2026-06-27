// editor-host.js — the host-level DOCUMENT features for the suite's Editor app.
//
// The <edot-editor> custom element owns the writing surface + formatting. The
// STANDALONE page (edot-app.js) builds the rest of a word processor on top of it
// — a local document library with autosave, an Open dialog (Examples / Research
// / file / URL), View source, and Save-to-GitHub-via-PR. This module brings all
// of that to the unified shell (index.html) by attaching the same features to an
// <edot-editor> instance, reusing the very same logic modules (library.js,
// examples.js, open-url.js, git-remote.js, diff.js, io.js) so there's no second
// implementation of the hard parts. Dialogs are built dynamically (native
// <dialog>), so this has zero dependency on page markup.
//
// It deliberately shares storage keys with the standalone page (the IndexedDB
// document store and `edot.currentDoc` / `edot.gh.*`), so your documents and
// saved GitHub locations are the SAME whether you open edot.html or the suite.
//
//   const host = new EditorHost(editorEl, { section });
//   await host.boot();                 // restore last doc (or welcome)
//   host.newDocument(); host.openDialog(); host.myDocuments();
//   host.closeDocument(); host.viewSource(); host.saveToGitHub();

import { Library } from './library.js';
import { EXAMPLES } from './examples.js';
import { resolveSourceUrl, filenameFromUrl } from './open-url.js';
import { GitHubRemote, commitViaPullRequest } from './git-remote.js';
import { diffLines, diffStats, collapse } from './diff.js';
import * as IO from './io.js';
import { getKernel } from './edot-kernel.js';
import { getConnections } from './connections.js';

const LAST_DOC_KEY = 'edot.currentDoc';
const GH_TOKEN_KEY = 'edot.gh.token';
const GH_LOGIN_KEY = 'edot.gh.login';
const GH_RECENTS_KEY = 'edot.gh.recents';

const esc = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ghSlug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'document';
function showModal(d) { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); }

const WELCOME = `
<h1>Welcome to edot</h1>
<p>A small, modular, <strong>accessible</strong> word processor and office-document tool that runs entirely in your browser — no server, no upload, your text never leaves the page.</p>
<h2>Write &amp; format</h2>
<ul>
<li>Use the toolbar or shortcuts: <strong>Ctrl/⌘+B</strong>, <em>+I</em>, <u>+U</u>.</li>
<li>Tag any selection with a semantic property (RDFa) — meaning that survives HTML export.</li>
</ul>
<h2>Open &amp; save real files</h2>
<ul>
<li>Open <strong>.docx</strong>, Markdown, HTML or text — or open straight from a <strong>URL</strong> (GitHub/GitLab links are rewritten to the raw file).</li>
<li>Browse ready-made docs in <strong>File ▸ Open ▸ Examples</strong>.</li>
<li>Save as <strong>DOCX, PDF, HTML+RDFa, Markdown, CSS or plain text</strong> — or <strong>Save to GitHub</strong> as a pull request.</li>
</ul>
<h2>Your documents, stored locally</h2>
<p>Every document is kept in this browser’s local store and autosaves as you type. Open <strong>File ▸ My documents</strong> to switch between them.</p>
`;

// One stylesheet for all host UI, injected once (dialogs live at document.body,
// so scoped per-app CSS can't reach them — this is unscoped on purpose).
const STYLE = `
.eh-titlebar { flex: 0 0 auto; padding: 0.4rem 0.75rem; border-bottom: 1px solid var(--line, #ddd); background: var(--surface, #fff); }
.eh-title { width: 100%; max-width: 48rem; font-size: 1.1rem; font-weight: 600; border: 1px solid transparent; border-radius: 6px; padding: 0.25rem 0.4rem; background: transparent; color: inherit; }
.eh-title:hover { border-color: var(--line, #ddd); }
.eh-title:focus { outline: 2px solid var(--accent, #2962ff); outline-offset: 1px; }
.eh-dialog { border: 1px solid var(--line, #ccc); border-radius: 10px; padding: 0; max-width: 640px; width: calc(100vw - 2rem); max-height: calc(100vh - 2rem); color: inherit; background: var(--surface, #fff); }
.eh-dialog::backdrop { background: rgba(0,0,0,0.4); }
.eh-dlg-head { display: flex; align-items: center; gap: 0.5rem; padding: 0.7rem 1rem; border-bottom: 1px solid var(--line, #eee); }
.eh-dlg-head h2 { margin: 0; font-size: 1.05rem; flex: 1 1 auto; }
.eh-dlg-body { padding: 1rem; overflow: auto; max-height: 70vh; }
.eh-dlg-foot { display: flex; gap: 0.5rem; justify-content: flex-end; flex-wrap: wrap; padding: 0.7rem 1rem; border-top: 1px solid var(--line, #eee); }
.eh-btn { font: inherit; padding: 0.4rem 0.8rem; border: 1px solid var(--line, #ccc); border-radius: 7px; background: var(--surface, #fff); color: inherit; cursor: pointer; }
.eh-btn-primary { background: var(--accent, #2962ff); color: #fff; border-color: transparent; }
.eh-btn:disabled { opacity: 0.5; cursor: default; }
.eh-x { border: none; background: none; font-size: 1.1rem; cursor: pointer; color: inherit; }
.eh-field { display: block; margin: 0 0 0.6rem; font-size: 0.85rem; }
.eh-field input, .eh-field select, .eh-field textarea { display: block; width: 100%; margin-top: 0.2rem; font: inherit; padding: 0.4rem; border: 1px solid var(--line, #ccc); border-radius: 6px; background: var(--surface, #fff); color: inherit; box-sizing: border-box; }
.eh-grp { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; margin: 0.8rem 0 0.3rem; }
.eh-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.eh-item { display: flex; align-items: center; gap: 0.4rem; }
.eh-item-main { flex: 1 1 auto; text-align: left; border: 1px solid var(--line, #eee); border-radius: 7px; padding: 0.5rem 0.6rem; background: var(--surface, #fff); color: inherit; cursor: pointer; min-width: 0; }
.eh-item-main:hover { border-color: var(--accent, #2962ff); }
.eh-item-main .nm { display: block; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.eh-item-main .mt { display: block; font-size: 0.78rem; opacity: 0.7; }
.eh-icon-btn { border: 1px solid var(--line, #eee); border-radius: 6px; background: none; color: inherit; cursor: pointer; padding: 0.35rem 0.45rem; }
.eh-current .eh-item-main { border-color: var(--accent, #2962ff); }
.eh-note { font-size: 0.8rem; opacity: 0.8; margin: 0.3rem 0; }
.eh-error { color: #c0392b; font-size: 0.85rem; margin: 0.4rem 0; }
.eh-result { font-size: 0.9rem; margin: 0.4rem 0; }
.eh-diff { font-family: ui-monospace, monospace; font-size: 0.8rem; border: 1px solid var(--line, #eee); border-radius: 6px; max-height: 240px; overflow: auto; margin-top: 0.5rem; }
.eh-diff .row { display: flex; gap: 0.3rem; padding: 0 0.3rem; white-space: pre-wrap; }
.eh-diff .row .sign { width: 1ch; flex: 0 0 auto; opacity: 0.7; }
.eh-diff .row.add { background: rgba(46,160,67,0.15); }
.eh-diff .row.del { background: rgba(248,81,73,0.15); }
.eh-diff .gap { padding: 0.1rem 0.4rem; opacity: 0.6; font-style: italic; }
.eh-recents { margin-top: 0.6rem; }
.eh-recents-head { display: flex; justify-content: space-between; font-size: 0.78rem; opacity: 0.75; }
.eh-link { border: none; background: none; color: var(--accent, #2962ff); cursor: pointer; font: inherit; padding: 0; text-decoration: underline; }
.eh-textarea { width: 100%; min-height: 220px; font-family: ui-monospace, monospace; font-size: 0.82rem; }
`;
let styleInjected = false;
function ensureStyle() {
  if (styleInjected || typeof document === 'undefined') return;
  const s = document.createElement('style'); s.id = 'editor-host-style'; s.textContent = STYLE;
  document.head.appendChild(s); styleInjected = true;
}

// Build a native <dialog> shell with a head (title + close) and a body; returns
// { dlg, body }. Appended to document.body, opened with showModal().
function makeDialog(title) {
  const dlg = document.createElement('dialog'); dlg.className = 'eh-dialog';
  const head = document.createElement('div'); head.className = 'eh-dlg-head';
  const h = document.createElement('h2'); h.textContent = title;
  const x = document.createElement('button'); x.type = 'button'; x.className = 'eh-x'; x.setAttribute('aria-label', 'Close'); x.textContent = '✕';
  x.addEventListener('click', () => dlg.close());
  head.append(h, x);
  const body = document.createElement('div'); body.className = 'eh-dlg-body';
  dlg.append(head, body);
  document.body.appendChild(dlg);
  return { dlg, body, head };
}

export class EditorHost {
  constructor(el, { section } = {}) {
    this.el = el;                 // the <edot-editor>
    this.section = section || (el && el.parentNode);
    this.doc = null;
    this.library = null;
    this._saveTimer = null;
    this.gh = {};                 // GitHub working state across preview→commit→merge
    this._ghLogin = '';
    ensureStyle();
    this._injectTitlebar();
    this._pickInput = document.createElement('input');
    this._pickInput.type = 'file'; this._pickInput.hidden = true;
    this._pickInput.addEventListener('change', () => { const f = this._pickInput.files[0]; if (f) this.openFile(f); this._pickInput.value = ''; });
    (this.section || document.body).appendChild(this._pickInput);
    this.el.addEventListener('edot-change', () => this._scheduleSave());
    // Document shortcuts, scoped to the editor section so they don't hijack the
    // rest of the suite: New (⌘/Ctrl+N) and My documents (⌘/Ctrl+Shift+O).
    this._onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'n' && !e.shiftKey) { e.preventDefault(); this.newDocument(); }
      else if (k === 'o' && e.shiftKey) { e.preventDefault(); this.myDocuments(); }
    };
    (this.section || this.el).addEventListener('keydown', this._onKey);
  }

  announce(m, o) { try { this.el.announce && this.el.announce(m, o); } catch (_) {} }

  _injectTitlebar() {
    const bar = document.createElement('div'); bar.className = 'eh-titlebar';
    this.titleEl = document.createElement('input');
    this.titleEl.className = 'eh-title'; this.titleEl.setAttribute('aria-label', 'Document title'); this.titleEl.placeholder = 'Untitled document';
    bar.appendChild(this.titleEl);
    if (this.el && this.el.parentNode) this.el.parentNode.insertBefore(bar, this.el);
    this.titleEl.addEventListener('input', () => this._scheduleSave());
    this.titleEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.el.focus(); } });
  }

  // ---- document lifecycle + autosave (shares the standalone's library) -------
  async boot() {
    this.library = await Library.create();
    let doc = null;
    const lastId = this._lastId();
    if (lastId) { try { doc = await this.library.getDoc(lastId); } catch (_) { doc = null; } }
    if (!doc) { const all = await this.library.listDocs(); doc = all[0] || null; }
    if (!doc) doc = await this.library.createDoc('Welcome to edot', WELCOME);
    this._loadDoc(doc, { announce: false });
    return this;
  }

  _lastId() { try { return localStorage.getItem(LAST_DOC_KEY); } catch { return null; } }
  _rememberId(id) { try { localStorage.setItem(LAST_DOC_KEY, id); } catch { /* */ } }

  _loadDoc(doc, { announce = true } = {}) {
    this.doc = doc;
    this.titleEl.value = doc.title || '';
    this.el.setContent(doc.html || '<p><br></p>');
    this._rememberId(doc.id);
    this.el.markClean && this.el.markClean();
    this.el.focus();
    if (announce) this.announce(`Opened “${doc.title}”`);
  }

  _scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      if (!this.doc || !this.library) return;
      this.doc.html = this.el.getContent();
      this.doc.title = (this.titleEl.value || '').trim() || 'Untitled document';
      this.doc = await this.library.saveDoc(this.doc);
      this.el.markClean && this.el.markClean();
    }, 500);
  }

  async newDocument() {
    const doc = await this.library.createDoc('Untitled document', '<p><br></p>');
    this._loadDoc(doc); this.announce('New document');
  }

  // Close keeps the doc safe in the library and opens a fresh blank surface.
  async closeDocument() {
    if (this.doc) {
      this.doc.html = this.el.getContent();
      this.doc.title = (this.titleEl.value || '').trim() || 'Untitled document';
      await this.library.saveDoc(this.doc);
    }
    const doc = await this.library.createDoc('Untitled document', '<p><br></p>');
    this._loadDoc(doc, { announce: false });
    this.announce('Closed — find it again in File ▸ My documents');
  }

  async openFile(file, source = null) {
    try {
      this.announce(`Opening ${file.name}…`);
      const html = await IO.importFile(file);
      const title = file.name.replace(/\.[^.]+$/, '') || 'Untitled document';
      const doc = await this.library.createDoc(title, html);
      if (source) { doc.source = source; await this.library.saveDoc(doc); }
      this._loadDoc(doc);
      this.announce(`Imported ${file.name}`);
    } catch (err) { console.error(err); this.announce(err.message || 'Could not open that file', { error: true }); }
  }

  async openFromUrl(input) {
    let resolved;
    try { resolved = resolveSourceUrl(input); } catch (err) { this.announce(err.message, { error: true }); return; }
    try {
      this.announce(`Fetching ${resolved.provider === 'web' ? 'URL' : resolved.provider}…`);
      const resp = await fetch(resolved.url, { redirect: 'follow' });
      if (!resp.ok) throw new Error(`Fetch failed (${resp.status} ${resp.statusText})`);
      const blob = await resp.blob();
      const name = filenameFromUrl(resolved.url, resp.headers.get('content-type') || '');
      await this.openFile(new File([blob], name, { type: blob.type }), { kind: 'url', ...resolved });
    } catch (err) {
      console.error(err);
      const corsy = err instanceof TypeError || resolved.corsRisk;
      this.announce(corsy
        ? 'Could not fetch — the server may block cross-origin requests (CORS). raw.githubusercontent.com works; many hosts do not.'
        : (err.message || 'Could not open that URL'), { error: true });
    }
  }

  async openExample(ex) {
    if (ex.local) {
      try {
        this.announce(`Loading “${ex.title}”…`);
        const resp = await fetch(ex.src);
        if (!resp.ok) throw new Error(`Could not load example (${resp.status})`);
        const blob = await resp.blob();
        await this.openFile(new File([blob], ex.src.split('/').pop(), { type: blob.type }), { example: ex.title });
      } catch (err) { console.error(err); this.announce(err.message || 'Could not load that example', { error: true }); }
    } else { await this.openFromUrl(ex.src); }
  }

  async _loadResearch() {
    if (this._research) return this._research;
    try { const r = await fetch('docs/research/index.json'); const j = await r.json(); this._research = Array.isArray(j.docs) ? j.docs : []; }
    catch { this._research = []; }
    return this._research;
  }

  // ---- My documents -----------------------------------------------------------
  async myDocuments() {
    const { dlg, body } = makeDialog('My documents');
    body.innerHTML = '';
    const note = document.createElement('p'); note.className = 'eh-note';
    note.textContent = `Stored locally in this browser (${this.library.kind}). Documents never leave your device.`;
    const ul = document.createElement('ul'); ul.className = 'eh-list';
    body.append(note, ul);
    const render = async () => {
      ul.innerHTML = '';
      const docs = await this.library.listDocs();
      if (!docs.length) { const li = document.createElement('li'); li.className = 'eh-note'; li.textContent = 'No documents yet.'; ul.appendChild(li); return; }
      for (const d of docs) ul.appendChild(this._docRow(d, dlg, render));
    };
    await render();
    showModal(dlg);
    dlg.addEventListener('close', () => dlg.remove(), { once: true });
  }

  _docRow(d, dlg, refresh) {
    const li = document.createElement('li'); li.className = 'eh-item' + (this.doc && d.id === this.doc.id ? ' eh-current' : '');
    const open = document.createElement('button'); open.type = 'button'; open.className = 'eh-item-main';
    const when = new Date(d.updatedAt || d.createdAt || Date.now()).toLocaleString();
    open.innerHTML = `<span class="nm"></span><span class="mt"></span>`;
    open.querySelector('.nm').textContent = d.title || 'Untitled document';
    open.querySelector('.mt').textContent = when;
    open.addEventListener('click', async () => { const fresh = await this.library.getDoc(d.id); dlg.close(); this._loadDoc(fresh); });
    const rename = document.createElement('button'); rename.type = 'button'; rename.className = 'eh-icon-btn'; rename.title = 'Rename'; rename.setAttribute('aria-label', `Rename ${d.title}`); rename.textContent = '✏️';
    rename.addEventListener('click', async () => {
      const name = window.prompt('Rename document:', d.title);
      if (name && name.trim()) {
        d.title = name.trim(); await this.library.saveDoc(d);
        if (this.doc && this.doc.id === d.id) { this.doc.title = d.title; this.titleEl.value = d.title; }
        refresh();
      }
    });
    const del = document.createElement('button'); del.type = 'button'; del.className = 'eh-icon-btn'; del.title = 'Delete'; del.setAttribute('aria-label', `Delete ${d.title}`); del.textContent = '🗑';
    del.addEventListener('click', async () => {
      if (!window.confirm(`Delete “${d.title}”? This can’t be undone.`)) return;
      await this.library.deleteDoc(d.id);
      if (this.doc && this.doc.id === d.id) await this.newDocument();
      refresh();
    });
    li.append(open, rename, del);
    return li;
  }

  // ---- Open: Examples / Research / file / URL --------------------------------
  async openDialog() {
    const { dlg, body } = makeDialog('Open');
    body.innerHTML = '';
    const fileBtn = document.createElement('button'); fileBtn.type = 'button'; fileBtn.className = 'eh-btn'; fileBtn.textContent = 'Open a file… (.docx · .md · .html · .odt · .rtf)';
    fileBtn.addEventListener('click', () => { dlg.close(); this._pickInput.accept = (IO.importAccept && IO.importAccept()) || ''; this._pickInput.click(); });
    const urlBtn = document.createElement('button'); urlBtn.type = 'button'; urlBtn.className = 'eh-btn'; urlBtn.textContent = 'Open from URL…';
    urlBtn.addEventListener('click', () => { dlg.close(); this.openUrlDialog(); });
    const top = document.createElement('div'); top.style.display = 'flex'; top.style.gap = '0.5rem'; top.style.flexWrap = 'wrap'; top.append(fileBtn, urlBtn);
    body.appendChild(top);

    const exHead = document.createElement('p'); exHead.className = 'eh-grp'; exHead.textContent = '📚 Examples';
    const exList = document.createElement('ul'); exList.className = 'eh-list';
    for (const ex of EXAMPLES) exList.appendChild(this._openRow(ex.title, ex.note, () => { dlg.close(); this.openExample(ex); }));
    body.append(exHead, exList);

    const reHead = document.createElement('p'); reHead.className = 'eh-grp'; reHead.textContent = '🔬 Research';
    const reList = document.createElement('ul'); reList.className = 'eh-list';
    body.append(reHead, reList);
    const research = await this._loadResearch();
    if (research.length) {
      for (const r of research) reList.appendChild(this._openRow(r.title, r.note, () => { dlg.close(); this.openExample({ title: r.title, src: `docs/research/${r.file}`, local: true }); }));
    } else {
      const li = document.createElement('li'); li.className = 'eh-note'; li.textContent = '(no research documents yet — add markdown to docs/research/ and list it in index.json)'; reList.appendChild(li);
    }
    showModal(dlg);
    dlg.addEventListener('close', () => dlg.remove(), { once: true });
  }

  _openRow(label, note, onActivate) {
    const li = document.createElement('li'); li.className = 'eh-item';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'eh-item-main';
    b.innerHTML = `<span class="nm"></span>${note ? '<span class="mt"></span>' : ''}`;
    b.querySelector('.nm').textContent = label;
    if (note) b.querySelector('.mt').textContent = note;
    b.addEventListener('click', onActivate);
    li.appendChild(b); return li;
  }

  openUrlDialog() {
    const { dlg, body } = makeDialog('Open from URL');
    const field = document.createElement('label'); field.className = 'eh-field'; field.textContent = 'Document URL (GitHub/GitLab links are rewritten to raw)';
    const input = document.createElement('input'); input.type = 'url'; input.placeholder = 'https://… or owner/repo path'; field.appendChild(input);
    const err = document.createElement('div'); err.className = 'eh-error'; err.hidden = true;
    const foot = document.createElement('div'); foot.className = 'eh-dlg-foot';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'eh-btn'; cancel.textContent = 'Cancel'; cancel.addEventListener('click', () => dlg.close());
    const open = document.createElement('button'); open.type = 'button'; open.className = 'eh-btn eh-btn-primary'; open.textContent = 'Open';
    const submit = () => {
      const v = input.value.trim(); if (!v) return;
      try { resolveSourceUrl(v); } catch (e) { err.textContent = e.message; err.hidden = false; return; }
      dlg.close(); this.openFromUrl(v);
    };
    open.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    foot.append(cancel, open);
    body.append(field, err); dlg.appendChild(foot);
    showModal(dlg); input.focus();
    dlg.addEventListener('close', () => dlg.remove(), { once: true });
  }

  // ---- View source -----------------------------------------------------------
  viewSource() {
    const { dlg, body } = makeDialog('View source');
    const fmt = document.createElement('label'); fmt.className = 'eh-field'; fmt.textContent = 'Format';
    const sel = document.createElement('select');
    for (const [v, l] of [['md', 'Markdown (.md)'], ['html', 'HTML + RDFa (.html)'], ['txt', 'Plain text (.txt)']]) { const o = document.createElement('option'); o.value = v; o.textContent = l; sel.appendChild(o); }
    fmt.appendChild(sel);
    const ta = document.createElement('textarea'); ta.className = 'eh-textarea'; ta.readOnly = true; ta.setAttribute('aria-label', 'Source');
    const note = document.createElement('p'); note.className = 'eh-note';
    const foot = document.createElement('div'); foot.className = 'eh-dlg-foot';
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'eh-btn'; copy.textContent = 'Copy';
    copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(ta.value); this.announce('Source copied'); } catch { ta.select(); } });
    foot.appendChild(copy);
    const render = async () => {
      note.textContent = 'Rendering…';
      try {
        const text = await IO.exportText(this.el.getContent(), this.titleEl.value, sel.value);
        ta.value = text;
        const hasRdfa = /\b(property|typeof|vocab|resource)=/.test(this.el.getContent());
        const kept = sel.value === 'html' ? (hasRdfa ? 'HTML keeps your RDFa semantics, links and structure.' : 'HTML keeps links and structure.')
          : sel.value === 'md' ? (hasRdfa ? 'Markdown keeps links and structure but drops RDFa — save as .html to keep semantics.' : 'Markdown keeps links and structure.')
            : 'Plain text strips all markup, links and structure.';
        note.textContent = `${text.split('\n').length} lines · ${text.length} chars — ${kept}`;
      } catch (err) { ta.value = ''; note.textContent = err.message; }
    };
    sel.addEventListener('change', render);
    body.append(fmt, ta, note); dlg.appendChild(foot);
    showModal(dlg); render();
    dlg.addEventListener('close', () => dlg.remove(), { once: true });
  }

  // ---- Save to… (the unified Connections storage layer) ----------------------
  // One "Save to…" over every connected storage mount (the ResourceSource
  // interface): the local device (OPFS) today, plus any platform mount once its
  // auth is wired. GitHub is folded in as one destination — picking it opens the
  // pull-request flow (commit + diff), since a PR is GitHub's meaningful "save",
  // not a blob overwrite. The document is exported to the chosen format and
  // written through `storage.source({id}).write(path, bytes)`.
  saveToStorage() {
    const { dlg, body } = makeDialog('Save to…');
    let mounts = [];
    try { getConnections(); mounts = getKernel().capabilities.invoke('connections.list', { capability: 'storage' }) || []; } catch (_) { mounts = []; }
    const choices = [
      ...mounts.map((m) => ({ kind: 'storage', id: m.id, label: m.label, local: m.isLocal, auth: m.requiresAuth })),
      { kind: 'github', id: '__gh__', label: 'GitHub — as a pull request', local: false, auth: true },
    ];
    let selected = choices[0];

    const intro = document.createElement('p'); intro.className = 'eh-note'; intro.textContent = 'Choose where to save this document.';
    const destWrap = document.createElement('div'); destWrap.className = 'eh-list';
    choices.forEach((c, i) => {
      const row = document.createElement('label'); row.className = 'eh-item';
      const r = document.createElement('input'); r.type = 'radio'; r.name = 'eh-dest'; r.checked = i === 0; r.style.flex = '0 0 auto';
      r.addEventListener('change', () => { if (r.checked) { selected = c; syncPath(); } });
      const span = document.createElement('span'); span.className = 'eh-item-main';
      span.innerHTML = `<span class="nm"></span><span class="mt"></span>`;
      span.querySelector('.nm').textContent = c.label;
      span.querySelector('.mt').textContent = c.kind === 'github'
        ? 'opens a pull request with a diff'
        : `${c.local ? 'on this device' : 'platform'}${c.auth ? ' · sign-in needed' : ' · no login'}`;
      row.append(r, span); destWrap.appendChild(row);
    });

    const fmtField = document.createElement('label'); fmtField.className = 'eh-field'; fmtField.textContent = 'Format';
    const fmt = document.createElement('select');
    for (const f of IO.exportFormats()) { const o = document.createElement('option'); o.value = f.ext; o.textContent = f.label; fmt.appendChild(o); }
    fmtField.appendChild(fmt);
    const pathField = document.createElement('label'); pathField.className = 'eh-field'; pathField.textContent = 'Path';
    const path = document.createElement('input'); path.type = 'text'; pathField.appendChild(path);
    const syncPath = () => {
      pathField.style.display = selected.kind === 'github' ? 'none' : '';
      fmtField.style.display = selected.kind === 'github' ? 'none' : '';
      if (selected.kind !== 'github') path.value = `${ghSlug(this.titleEl && this.titleEl.value)}.${fmt.value}`;
    };
    fmt.addEventListener('change', syncPath);

    const error = document.createElement('div'); error.className = 'eh-error'; error.hidden = true;
    const result = document.createElement('div'); result.className = 'eh-result'; result.hidden = true;
    body.append(intro, destWrap, fmtField, pathField, error, result);

    const foot = document.createElement('div'); foot.className = 'eh-dlg-foot';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'eh-btn'; cancel.textContent = 'Cancel'; cancel.addEventListener('click', () => dlg.close());
    const save = document.createElement('button'); save.type = 'button'; save.className = 'eh-btn eh-btn-primary'; save.textContent = 'Save';
    save.addEventListener('click', async () => {
      error.hidden = true; result.hidden = true;
      if (selected.kind === 'github') { dlg.close(); this.saveToGitHub(); return; }
      const source = (() => { try { return getKernel().capabilities.invoke('storage.source', { id: selected.id }); } catch (_) { return null; } })();
      if (!source) { error.textContent = 'That storage isn’t connected yet — add it in Connections first.'; error.hidden = false; return; }
      let p = (path.value || '').trim() || `${ghSlug(this.titleEl && this.titleEl.value)}.${fmt.value}`;
      if (!p.startsWith('/')) p = '/' + p;
      try {
        save.disabled = true; result.hidden = true;
        const title = (this.titleEl && this.titleEl.value) || 'document';
        const blob = await IO.exportDocument(this.el.getContent(), title, fmt.value);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        await source.write(p, bytes);
        result.textContent = `Saved to ${selected.label} · ${p}`; result.hidden = false;
        this.announce(`Saved to ${selected.label}`);
      } catch (err) { error.textContent = err.message || 'Could not save there.'; error.hidden = false; }
      finally { save.disabled = false; }
    });
    foot.append(cancel, save); dlg.appendChild(foot);
    syncPath();
    showModal(dlg);
    dlg.addEventListener('close', () => dlg.remove(), { once: true });
  }

  // ---- Save to GitHub (branch + pull request) --------------------------------
  saveToGitHub() {
    if (!this._ghDlg) this._buildGithubDialog();
    const el = this.ghEl;
    el.error.hidden = true; el.result.hidden = true; el.merge.hidden = true; el.diff.hidden = true;
    el.diffstat.textContent = '';
    if (el.branchNote) el.branchNote.hidden = true;
    // Prefill from the most recent save location, then the current title slug.
    const recents = this._ghRecents();
    if (recents[0] && !el.repo.value) { el.repo.value = recents[0].repo; el.branch.value = recents[0].branch || ''; el.path.value = recents[0].path; }
    if (!el.path.value) el.path.value = this._defaultGhPath();
    if (!el.message.value) el.message.value = `Update ${el.path.value} via edot`;
    const token = this._ghStoredToken(); if (token && !el.token.value) el.token.value = token;
    this._ghRenderConnection(this._ghStoredLogin());
    this._renderGhRecents();
    showModal(this._ghDlg);
    if (!el.token.value) this._harvestToken();
    if (el.repo.value) this._ghDetectBranch();
  }

  _buildGithubDialog() {
    const { dlg, body } = makeDialog('Save to GitHub');
    this._ghDlg = dlg;
    const field = (label, attrs = {}) => {
      const l = document.createElement('label'); l.className = 'eh-field'; l.textContent = label;
      const i = document.createElement('input'); for (const [k, v] of Object.entries(attrs)) i.setAttribute(k, v); l.appendChild(i); body.appendChild(l); return i;
    };
    const repo = field('Repository (owner/repo)', { type: 'text', placeholder: 'danbri/glitchcan-minigam' });
    const branch = field('Branch', { type: 'text', placeholder: 'main' });
    const branchNote = document.createElement('p'); branchNote.className = 'eh-note'; branchNote.hidden = true; body.appendChild(branchNote);
    const path = field('File path (a document is its own folder)', { type: 'text', placeholder: 'my-doc/my-doc.md' });
    const token = field('Personal access token', { type: 'password', placeholder: 'github_pat_… or ghp_…', autocomplete: 'off' });
    const remember = document.createElement('label'); remember.className = 'eh-field'; remember.style.display = 'flex'; remember.style.gap = '0.4rem'; remember.style.alignItems = 'center';
    const rememberCb = document.createElement('input'); rememberCb.type = 'checkbox'; remember.append(rememberCb, document.createTextNode(' Remember token on this device (else it’s forgotten when the tab closes)'));
    body.appendChild(remember);
    const conn = document.createElement('div'); conn.className = 'eh-note'; conn.hidden = true; body.appendChild(conn);
    const connect = document.createElement('button'); connect.type = 'button'; connect.className = 'eh-btn'; connect.textContent = 'Connect'; body.appendChild(connect);
    const recents = document.createElement('div'); recents.className = 'eh-recents'; recents.hidden = true; body.appendChild(recents);
    const message = field('Commit / PR title', { type: 'text', placeholder: 'Update document' });
    const diffstat = document.createElement('span'); diffstat.className = 'eh-note';
    const diff = document.createElement('div'); diff.className = 'eh-diff'; diff.hidden = true;
    const error = document.createElement('div'); error.className = 'eh-error'; error.hidden = true;
    const result = document.createElement('div'); result.className = 'eh-result'; result.hidden = true;
    body.append(diffstat, diff, error, result);

    const foot = document.createElement('div'); foot.className = 'eh-dlg-foot';
    const preview = document.createElement('button'); preview.type = 'button'; preview.className = 'eh-btn'; preview.textContent = 'Preview diff';
    const commit = document.createElement('button'); commit.type = 'button'; commit.className = 'eh-btn eh-btn-primary'; commit.textContent = 'Open pull request';
    const merge = document.createElement('button'); merge.type = 'button'; merge.className = 'eh-btn'; merge.textContent = 'Merge now'; merge.hidden = true;
    foot.append(preview, commit, merge); dlg.appendChild(foot);

    this.ghEl = { repo, branch, branchNote, path, token, remember: rememberCb, conn, connect, recents, message, diffstat, diff, error, result, preview, commit, merge };
    preview.addEventListener('click', () => this._githubPreview());
    commit.addEventListener('click', () => this._githubCommit());
    merge.addEventListener('click', () => this._githubMerge());
    connect.addEventListener('click', () => this._ghConnect());
    repo.addEventListener('blur', () => this._ghDetectBranch());
    this._onWinFocus = () => { if (dlg.open) this._harvestToken(); };
    window.addEventListener('focus', this._onWinFocus);
  }

  // token storage (persist → localStorage, else sessionStorage)
  _ghStore(key, value, persist) { try { [localStorage, sessionStorage].forEach((s) => s.removeItem(key)); if (value) (persist ? localStorage : sessionStorage).setItem(key, value); } catch { /* */ } }
  _ghStoredToken() { try { return localStorage.getItem(GH_TOKEN_KEY) || sessionStorage.getItem(GH_TOKEN_KEY) || ''; } catch { return ''; } }
  _ghStoredLogin() { try { return localStorage.getItem(GH_LOGIN_KEY) || sessionStorage.getItem(GH_LOGIN_KEY) || ''; } catch { return ''; } }
  _ghForget() { try { [localStorage, sessionStorage].forEach((s) => { s.removeItem(GH_TOKEN_KEY); s.removeItem(GH_LOGIN_KEY); }); } catch { /* */ } }

  async _harvestToken() {
    const el = this.ghEl; if (!el || el.token.value.trim()) return;
    if (!navigator.clipboard || !navigator.clipboard.readText) return;
    try {
      const text = (await navigator.clipboard.readText() || '').trim();
      const m = text.match(/^(github_pat_[A-Za-z0-9_]{20,}|gh[posru]_[A-Za-z0-9]{20,})$/);
      if (m && !el.token.value.trim()) { el.token.value = text; this.announce('Token pasted from clipboard'); }
    } catch { /* clipboard blocked — paste manually */ }
  }

  _defaultGhPath() { const slug = ghSlug(this.titleEl && this.titleEl.value); return `${slug}/${slug}.md`; }

  async _ghConnect() {
    const el = this.ghEl; const token = el.token.value.trim(); el.error.hidden = true;
    if (!token) return this._ghErr('Paste a token to connect');
    try {
      el.connect.disabled = true; el.conn.hidden = false; el.conn.textContent = 'Connecting…';
      const user = await new GitHubRemote(token).me();
      this._ghStore(GH_TOKEN_KEY, token, el.remember.checked);
      this._ghStore(GH_LOGIN_KEY, user.login || '', el.remember.checked);
      this._ghRenderConnection(user.login || '');
      this.announce(`Connected to GitHub as @${user.login}`);
    } catch (err) { this._ghRenderConnection(''); this._ghErr(this._ghMessage(err)); }
    finally { el.connect.disabled = false; }
  }

  _ghDisconnect() { this._ghForget(); this.ghEl.token.value = ''; this._ghRenderConnection(''); this.announce('Disconnected from GitHub'); }

  _ghRenderConnection(login) {
    const el = this.ghEl; this._ghLogin = login || '';
    if (login) {
      el.conn.hidden = false; el.conn.textContent = '';
      const span = document.createElement('span'); span.innerHTML = `✓ Signed in as <strong>@${esc(login)}</strong> · `;
      const dc = document.createElement('button'); dc.type = 'button'; dc.className = 'eh-link'; dc.textContent = 'Disconnect'; dc.addEventListener('click', () => this._ghDisconnect());
      el.conn.append(span, dc); el.connect.hidden = true;
    } else { el.conn.hidden = true; el.conn.textContent = ''; el.connect.hidden = false; }
  }

  async _ghNoteWorkingToken(token, persist) {
    this._ghStore(GH_TOKEN_KEY, token, persist);
    if (this._ghLogin) { this._ghStore(GH_LOGIN_KEY, this._ghLogin, persist); return; }
    try { const user = await new GitHubRemote(token).me(); this._ghStore(GH_LOGIN_KEY, user.login || '', persist); this._ghRenderConnection(user.login || ''); }
    catch { /* identity optional */ }
  }

  async _ghDetectBranch() {
    const el = this.ghEl; const m = /^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(el.repo.value.trim()); if (!m) return;
    const key = `${m[1]}/${m[2]}`; if (this._branchDetectedFor === key) return;
    try {
      const def = await new GitHubRemote(el.token.value.trim()).defaultBranch(m[1], m[2]); if (!def) return;
      this._branchDetectedFor = key; el.branch.placeholder = def;
      const cur = el.branch.value.trim(); if (!cur || cur === this._lastDetectedBranch) el.branch.value = def;
      this._lastDetectedBranch = def;
      if (el.branchNote) { el.branchNote.textContent = `Default branch on ${key}: ${def}`; el.branchNote.hidden = false; }
    } catch { /* private/offline — field stays editable */ }
  }

  _ghRecents() { try { return JSON.parse(localStorage.getItem(GH_RECENTS_KEY)) || []; } catch { return []; } }
  _ghWriteRecents(list) { try { localStorage.setItem(GH_RECENTS_KEY, JSON.stringify(list)); } catch { /* */ } this._renderGhRecents(); }
  _ghSaveRecent(loc) {
    const list = this._ghRecents().filter((r) => !(r.repo === loc.repo && r.path === loc.path && r.branch === loc.branch));
    list.unshift(loc); this._ghWriteRecents(list.slice(0, 8));
  }
  _renderGhRecents() {
    const wrap = this.ghEl.recents; if (!wrap) return;
    const list = this._ghRecents(); wrap.innerHTML = '';
    if (!list.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    const head = document.createElement('div'); head.className = 'eh-recents-head';
    const title = document.createElement('span'); title.textContent = 'Recent save locations';
    const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'eh-link'; clear.textContent = 'Clear'; clear.addEventListener('click', () => this._ghWriteRecents([]));
    head.append(title, clear); wrap.appendChild(head);
    list.forEach((r, i) => {
      const row = document.createElement('div'); row.className = 'eh-item';
      const use = document.createElement('button'); use.type = 'button'; use.className = 'eh-item-main'; use.textContent = `${r.repo} · ${r.path}${r.branch ? ` (${r.branch})` : ''}`;
      use.addEventListener('click', () => this._ghUseRecent(r));
      const del = document.createElement('button'); del.type = 'button'; del.className = 'eh-icon-btn'; del.setAttribute('aria-label', `Forget ${r.repo} ${r.path}`); del.textContent = '✕';
      del.addEventListener('click', () => { const l = this._ghRecents(); l.splice(i, 1); this._ghWriteRecents(l); });
      row.append(use, del); wrap.appendChild(row);
    });
  }
  _ghUseRecent(r) {
    const el = this.ghEl; el.repo.value = r.repo; el.branch.value = r.branch || ''; el.path.value = r.path; el.message.value = `Update ${r.path} via edot`;
    this._branchDetectedFor = null; this._ghDetectBranch(); el.token.focus();
  }

  _ghParse() {
    const el = this.ghEl;
    const m = /^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(el.repo.value.trim());
    if (!m) throw new Error('Repository must be "owner/repo"');
    let path = el.path.value.trim().replace(/^\/+/, '');
    if (!path) throw new Error('Enter the file path to write');
    if (!path.includes('/')) { const stem = path.replace(/\.[^.]+$/, '') || 'document'; path = `${stem}/${path}`; }
    el.path.value = path;
    const ext = (path.match(/\.([a-z0-9]+)$/i) || [])[1] || '';
    if (!IO.isTextFormat(ext)) throw new Error(`Save-back supports text files only (.md, .txt, .html, .css) — not .${ext || '?'}`);
    const token = el.token.value.trim(); if (!token) throw new Error('Paste a personal access token');
    const branch = el.branch.value.trim() || el.branch.placeholder || 'main';
    return { owner: m[1], repo: m[2], path, ext, branch, token };
  }

  async _githubPreview() {
    const el = this.ghEl; el.error.hidden = true; el.result.hidden = true;
    let p; try { p = this._ghParse(); } catch (err) { return this._ghErr(err.message); }
    try {
      el.diffstat.textContent = 'Fetching…';
      const newText = await IO.exportText(this.el.getContent(), this.titleEl.value, p.ext);
      const remote = new GitHubRemote(p.token);
      const file = await remote.getFile(p.owner, p.repo, p.path, p.branch);
      const diff = diffLines(file.text, newText); const stats = diffStats(diff);
      this.gh = { ...p, sha: file.sha, newText, exists: file.exists };
      this._renderDiff(collapse(diff));
      el.diffstat.textContent = file.exists ? `+${stats.add} −${stats.del} vs ${p.branch}` : `new file · ${newText.split('\n').length} lines`;
      this._ghNoteWorkingToken(p.token, el.remember.checked);
    } catch (err) { this._ghErr(this._ghMessage(err)); }
  }

  async _githubCommit() {
    const el = this.ghEl; el.error.hidden = true; el.result.hidden = true;
    let p; try { p = this._ghParse(); } catch (err) { return this._ghErr(err.message); }
    try {
      el.commit.disabled = true; el.diffstat.textContent = 'Committing…';
      const newText = this.gh.newText && this.gh.path === p.path ? this.gh.newText : await IO.exportText(this.el.getContent(), this.titleEl.value, p.ext);
      const remote = new GitHubRemote(p.token);
      const { pr } = await commitViaPullRequest(remote, {
        owner: p.owner, repo: p.repo, path: p.path, baseBranch: p.branch,
        message: el.message.value.trim() || `Update ${p.path} via edot`, contentText: newText,
        title: el.message.value.trim() || `Update ${p.path}`,
        body: 'Edited with edot (https://danbri.github.io/glitchcan-minigam/magpie/edot/index.html).',
      });
      this._ghNoteWorkingToken(p.token, el.remember.checked);
      this._ghSaveRecent({ repo: `${p.owner}/${p.repo}`, branch: p.branch, path: p.path });
      this.gh = { ...this.gh, ...p, pr, baseBranch: p.branch };
      el.diffstat.textContent = '';
      el.result.innerHTML = `Pull request opened: <a href="${esc(pr.html_url)}" target="_blank" rel="noopener noreferrer">#${pr.number}</a>`;
      el.result.hidden = false; el.merge.hidden = false;
      this.announce(`Pull request #${pr.number} opened`);
    } catch (err) { this._ghErr(this._ghMessage(err)); }
    finally { el.commit.disabled = false; }
  }

  async _githubMerge() {
    const el = this.ghEl; if (!this.gh || !this.gh.pr) return;
    const { owner, repo, pr } = this.gh; const token = el.token.value.trim(); el.error.hidden = true;
    try {
      el.merge.disabled = true; el.diffstat.textContent = 'Checking for conflicts…';
      const remote = new GitHubRemote(token);
      let pull = await remote.getPull(owner, repo, pr.number);
      for (let i = 0; i < 5 && pull.mergeable == null; i++) { await sleep(800); pull = await remote.getPull(owner, repo, pr.number); }
      if (pull.mergeable === false) { el.diffstat.textContent = ''; return this._ghErr('Can’t merge automatically — the pull request has conflicts. Resolve them on GitHub.'); }
      el.diffstat.textContent = 'Merging…';
      await remote.mergePull(owner, repo, pr.number, { method: 'squash', title: el.message.value.trim() || undefined });
      el.diffstat.textContent = '';
      el.result.innerHTML = `Merged ✓ <a href="${esc(pr.html_url)}" target="_blank" rel="noopener noreferrer">#${pr.number}</a> into ${esc(this.gh.baseBranch || '')}.`;
      el.result.hidden = false; el.merge.hidden = true;
      this.announce(`Pull request #${pr.number} merged`);
    } catch (err) { this._ghErr(this._ghMessage(err)); }
    finally { el.merge.disabled = false; }
  }

  _renderDiff(rows) {
    const frag = document.createDocumentFragment();
    for (const r of rows) {
      const div = document.createElement('div');
      if (r.type === 'gap') { div.className = 'gap'; div.textContent = `⋯ ${r.count} unchanged line${r.count === 1 ? '' : 's'}`; }
      else {
        div.className = 'row ' + r.type;
        const sign = document.createElement('span'); sign.className = 'sign'; sign.textContent = r.type === 'add' ? '+' : r.type === 'del' ? '−' : ' ';
        const txt = document.createElement('span'); txt.textContent = r.text;
        div.append(sign, txt);
      }
      frag.appendChild(div);
    }
    this.ghEl.diff.innerHTML = ''; this.ghEl.diff.appendChild(frag); this.ghEl.diff.hidden = false;
  }

  _ghErr(msg) { this.ghEl.error.textContent = msg; this.ghEl.error.hidden = false; this.ghEl.diffstat.textContent = ''; }

  _ghMessage(err) {
    const gh = err.data && err.data.message ? ` — “${err.data.message}”` : '';
    if (err.status === 401) return `Token rejected (401)${gh}. Check the token value.`;
    if (err.status === 403) return `Forbidden (403): the token needs Repository permissions → Contents and Pull requests = “Read and write” on this repo${gh}`;
    if (err.status === 404) return `Not found (404): check owner/repo/branch, or grant the token access to this repo${gh}`;
    if (err.status === 422) return `Could not create the change (422): ${err.data?.message || 'validation failed'}.`;
    if (err instanceof TypeError) return 'Network/CORS error reaching api.github.com.';
    return err.message || 'GitHub request failed';
  }

  destroy() {
    clearTimeout(this._saveTimer);
    if (this._onWinFocus) window.removeEventListener('focus', this._onWinFocus);
    if (this._onKey) (this.section || this.el).removeEventListener('keydown', this._onKey);
  }
}
