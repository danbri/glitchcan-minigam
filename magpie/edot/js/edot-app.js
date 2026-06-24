// edot-app.js — application bootstrap. Wires the editor, toolbar, file menu,
// the local document library, status bar, autosave, and drag-and-drop.
// Behaviour lives in the focused modules it imports; this is the glue.

import { Editor } from './editor.js';
import { Toolbar } from './toolbar.js';
import { Announcer } from './a11y.js';
import { Library } from './library.js';
import { FindReplace } from './find-replace.js';
import { Attention } from './attention.js';
import { resolveSourceUrl, filenameFromUrl } from './open-url.js';
import { EXAMPLES } from './examples.js';
import './tree.js';
import { CommandRegistry } from './command-registry.js';
import { COMMANDS, BLOCK_FORMATS, setBlockFormat, createLink, createSemantic } from './commands.js';
import { GitHubRemote, commitViaPullRequest } from './git-remote.js';
import { diffLines, diffStats, collapse } from './diff.js';
import * as IO from './io.js';
import * as LO from './libreoffice-bridge.js';

// Bump on each meaningful deploy. Shown in the footer so a stale cached build
// is obvious (the stamp reflects the JS your browser actually loaded).
const BUILD = '2026-06-23.l';

const GH_TOKEN_KEY = 'edot.gh.token';
const GH_LOGIN_KEY = 'edot.gh.login';     // cached @login for the connected token
const GH_RECENTS_KEY = 'edot.gh.recents'; // remembered save locations (zappable)

const LAST_DOC_KEY = 'edot.currentDoc';

// The editing components (Editor, Toolbar, FindReplace, Library) are all
// instance-based and hold no module-global state, so several can coexist.
// App itself binds to fixed element ids and document-level listeners; those
// listeners are tracked here so an instance can be torn down cleanly and a new
// one spun up without leaking — see destroy(). (Full multi-pane notes:
// docs/git-sync-methodology.md.)
class App {
  constructor(root = document) {
    this.root = root;
    this._cleanup = [];        // teardown callbacks for global listeners/DOM

    this.announcer = new Announcer();
    this.announce = (m, o) => this.announcer.toast(m, o);
    this.attention = new Attention({ message: 'Back to edot' });

    this.editorEl = document.getElementById('editor');
    this.editor = new Editor(this.editorEl);
    this.toolbar = new Toolbar(document.getElementById('toolbar'), this.editor, this.announce);
    this.findReplace = new FindReplace(this.editor, this.announce);

    this.titleInput = document.getElementById('doc-title');
    this.saveState = document.getElementById('save-state');
    this.statWords = document.getElementById('stat-words');
    this.statChars = document.getElementById('stat-chars');
    this.fileInput = document.getElementById('file-input');
    const stamp = document.getElementById('build-stamp');
    if (stamp) stamp.textContent = `build ${BUILD}`;

    this.doc = null;           // current library record { id, title, html, ... }
    this.lastExportExt = 'docx';
    this._saveTimer = null;

    this._wireEditor();
    this._wireMenu();
    this._wireTitle();
    this._wireDialog();
    this._wireUrlDialog();
    this._wireOpenDialog();
    this._wireGithubDialog();
    this._wireSourceDialog();
    this._wireCommands();
    this._wirePalette();
    this._wireGlobalKeys();
    this._wireDragDrop();
    this._reflectBackend();
    this._wireDataHandoff();
    this._boot();
  }

  // Receive tables / query results sent from the data workspace. A live editor
  // tab gets them over a BroadcastChannel; a cold start picks them up from
  // localStorage on boot (see _consumeHandoff).
  _wireDataHandoff() {
    try {
      this._bc = new BroadcastChannel('edot');
      this._on(this._bc, 'message', (e) => {
        if (e && e.data && e.data.type === 'insert' && e.data.html) {
          this._insertHandoff(e.data);
          try { localStorage.removeItem('edot.handoff'); } catch { /* */ }
        }
      });
    } catch { /* no BroadcastChannel */ }
  }

  _consumeHandoff() {
    let h = null;
    try { h = JSON.parse(localStorage.getItem('edot.handoff') || 'null'); localStorage.removeItem('edot.handoff'); } catch { /* */ }
    if (h && h.html && (!h.at || Date.now() - h.at < 30 * 60000)) this._insertHandoff(h);
  }

  _insertHandoff({ title, html }) {
    this.editor.insertHtml((title ? `<h3>${esc(title)}</h3>` : '') + html);
    this.announce('Inserted from the data workspace');
  }

  // Register a global listener and remember how to remove it (for destroy()).
  _on(target, type, handler, opts) {
    target.addEventListener(type, handler, opts);
    this._cleanup.push(() => target.removeEventListener(type, handler, opts));
  }

  // Tear down every global listener and injected node so the instance leaves
  // no trace — re-instantiation is then leak-free.
  destroy() {
    this._cleanup.forEach((off) => { try { off(); } catch { /* ignore */ } });
    this._cleanup = [];
    clearTimeout(this._saveTimer);
    try { this._bc?.close(); } catch { /* */ }
    this.attention?.disarm();
    this.toolbar?.destroy?.();
    this.findReplace?.destroy?.();
    this.announcer?.destroy?.();
    this.editor?.destroy?.();
  }

  async _boot() {
    this.library = await Library.create();
    const docsNote = document.getElementById('docs-storage');
    if (docsNote) docsNote.textContent = `Stored locally in this browser (${this.library.kind}). Documents never leave your device.`;

    // Restore the last-open document, else the most recent, else a welcome doc.
    let doc = null;
    const lastId = this._lastId();
    if (lastId) doc = await this.library.getDoc(lastId);
    if (!doc) {
      const all = await this.library.listDocs();
      doc = all[0] || null;
    }
    if (!doc) doc = await this.library.createDoc('Welcome to edot', WELCOME);

    this._loadDoc(doc, { announce: false });
    this._consumeHandoff();
    this.announce('Document ready');
  }

  _lastId() { try { return localStorage.getItem(LAST_DOC_KEY); } catch { return null; } }
  _rememberId(id) { try { localStorage.setItem(LAST_DOC_KEY, id); } catch { /* ignore */ } }

  _loadDoc(doc, { announce = true } = {}) {
    this.doc = doc;
    this.titleInput.value = doc.title;
    this.editor.setContent(doc.html);
    this._rememberId(doc.id);
    this._refreshStats();
    this._markClean();
    this.editor.focus();
    if (announce) this.announce(`Opened “${doc.title}”`);
  }

  _wireEditor() {
    // Tap the grey margin around the page to start typing there. Taps that
    // land ON the page are left entirely to the browser — iOS Safari raises
    // the keyboard from native contenteditable focus, and intervening with a
    // programmatic focus()/selection here actually suppresses it.
    const main = document.querySelector('.app-main');
    this._on(main, 'click', (e) => {
      if (e.target.closest('#editor')) return;   // page tap → native focus
      this.editor.focusEnd();
    });
    // The status bar sits flush under the page on mobile; a tap there caught a
    // dead zone (outside .app-main). Treat it like a margin tap → start typing.
    const status = document.querySelector('.statusbar');
    if (status) this._on(status, 'click', () => this.editor.focusEnd());

    this.editor.onSelectionCallback(() => this.toolbar.refresh());
    this.editor.onChangeCallback(() => {
      this._refreshStats();
      this._markDirty();
      this._scheduleSave();
      this.toolbar.refresh();
    });
  }

  _scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      if (!this.doc || !this.library) return;
      this.doc.html = this.editor.getContent();
      this.doc.title = this.titleInput.value.trim() || 'Untitled document';
      this.doc = await this.library.saveDoc(this.doc);
      this._markClean();
    }, 500);
  }

  _wireTitle() {
    this.titleInput.addEventListener('input', () => { this._markDirty(); this._scheduleSave(); });
    this.titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.editor.focus(); }
    });
  }

  // ---- File menu ----
  _wireMenu() {
    const button = document.getElementById('menu-button');
    const panel = document.getElementById('menu-panel');

    const exportList = document.getElementById('export-list');
    for (const fmt of IO.exportFormats()) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'menu-item';
      item.setAttribute('role', 'menuitem');
      item.innerHTML = `<span>Save as ${esc(fmt.label)}</span>` +
        (fmt.wasm ? '<span class="hint">WASM</span>' : `<span class="hint">.${fmt.ext}</span>`);
      item.addEventListener('click', () => { this._closeMenu(); this.exportAs(fmt.ext); });
      exportList.appendChild(item);
    }

    const mi = (id, fn) => document.getElementById(id).addEventListener('click', () => { this._closeMenu(); fn(); });
    mi('mi-new', () => this.newDocument());
    mi('mi-open', () => this.openOpenDialog());
    mi('mi-docs', () => this.openLibrary());
    mi('mi-close', () => this.closeDocument());
    mi('mi-find', () => this.findReplace.open(true));
    mi('mi-source', () => this.openSourceDialog());
    mi('mi-github', () => this.openGithubDialog());
    // Open a sibling suite app. Use a real anchor click (target=_blank) — NOT
    // window.open(...,'noopener'), which returns null and made the old fallback
    // also navigate THIS tab via location.href; a Back could then reload a stale
    // edot and drop the Calendar/Maps menu items. An anchor leaves this tab put.
    const openApp = (path) => this._launchApp(path);
    mi('mi-data', () => openApp('data/data.html'));
    mi('mi-slides', () => openApp('slides/slides.html'));
    mi('mi-mail', () => openApp('mail/mail.html'));
    mi('mi-calendar', () => openApp('calendar/calendar.html'));
    mi('mi-maps', () => openApp('maps/maps.html'));
    mi('mi-login', () => openApp('auth/login.html'));
    mi('mi-backup', () => openApp('backup/backup.html'));

    this.fileInput.accept = IO.importAccept();
    this.fileInput.addEventListener('change', () => {
      if (this.fileInput.files[0]) this.openFile(this.fileInput.files[0]);
      this.fileInput.value = '';
    });

    const toggle = (open) => {
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      if (open) { const f = panel.querySelector('.menu-item'); f && f.focus(); }
    };
    this._closeMenu = () => toggle(false);
    button.addEventListener('click', () => toggle(panel.hidden));
    this._on(document, 'click', (e) => {
      if (!panel.hidden && !panel.contains(e.target) && e.target !== button) toggle(false);
    });
    this._on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden) { toggle(false); button.focus(); }
    });
    panel.addEventListener('keydown', (e) => {
      const items = Array.from(panel.querySelectorAll('.menu-item'));
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    });
  }

  // ---- Documents library dialog ----
  _wireDialog() {
    this.dialog = document.getElementById('docs-dialog');
    document.getElementById('docs-new').addEventListener('click', () => {
      this.dialog.close();
      this.newDocument();
    });
  }

  // ---- Open-from-URL dialog ----
  _wireUrlDialog() {
    this.urlDialog = document.getElementById('url-dialog');
    this.urlInput = document.getElementById('url-input');
    this.urlError = document.getElementById('url-error');
    const submit = () => this._submitUrl();
    document.getElementById('url-open').addEventListener('click', submit);
    this.urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
  }

  openUrlDialog() {
    this.urlError.hidden = true;
    showModal(this.urlDialog);
    this.urlInput.focus();
    this.urlInput.select();
  }

  async _submitUrl() {
    const value = this.urlInput.value;
    try {
      resolveSourceUrl(value); // validate before closing the dialog
    } catch (err) {
      this.urlError.textContent = err.message;
      this.urlError.hidden = false;
      return;
    }
    this.urlDialog.close();
    await this.openFromUrl(value);
  }

  // ---- Open dialog: Examples / Research hierarchy + file/URL openers ----
  _wireOpenDialog() {
    this.openDialog = document.getElementById('open-dialog');
    this.openTree = document.getElementById('open-tree');
    document.getElementById('open-from-file').addEventListener('click', () => { this.openDialog.close(); this.fileInput.click(); });
    document.getElementById('open-from-url').addEventListener('click', () => { this.openDialog.close(); this.openUrlDialog(); });
  }

  async openOpenDialog() {
    const close = () => this.openDialog.close();
    const exNodes = EXAMPLES.map((ex) => ({
      label: ex.title, note: ex.note,
      onActivate: () => { close(); this.openExample(ex); },
    }));
    const research = await this._loadResearch();
    const reNodes = research.length
      ? research.map((r) => ({
        label: r.title, note: r.note,
        onActivate: () => { close(); this.openExample({ title: r.title, src: `docs/research/${r.file}`, local: true }); },
      }))
      : [{ label: '(no research documents yet)', note: 'Add markdown to docs/research/ and list it in index.json' }];
    this.openTree.setData([
      { label: 'Examples', icon: '📚', expanded: true, children: exNodes },
      { label: 'Research', icon: '🔬', expanded: false, children: reNodes },
    ]);
    showModal(this.openDialog);
  }

  // Load the research manifest (docs/research/index.json) once, best-effort.
  async _loadResearch() {
    if (this._research) return this._research;
    try {
      const resp = await fetch('docs/research/index.json');
      const json = await resp.json();
      this._research = Array.isArray(json.docs) ? json.docs : [];
    } catch { this._research = []; }
    return this._research;
  }

  // ---- Save to GitHub (branch + pull request) ----
  _wireGithubDialog() {
    this.ghDialog = document.getElementById('github-dialog');
    this.gh = {}; // { owner, repo, path, branch, sha, newText } after a preview
    const g = (id) => document.getElementById(id);
    this.ghEl = {
      repo: g('gh-repo'), branch: g('gh-branch'), path: g('gh-path'), token: g('gh-token'),
      message: g('gh-message'), remember: g('gh-remember'), preview: g('gh-preview'),
      commit: g('gh-commit'), merge: g('gh-merge'), diff: g('gh-diff'), diffstat: g('gh-diffstat'),
      error: g('gh-error'), result: g('gh-result'), recents: g('gh-recents'), branchNote: g('gh-branch-note'),
      conn: g('gh-conn'), connect: g('gh-connect'),
    };
    this.ghEl.preview.addEventListener('click', () => this._githubPreview());
    this.ghEl.commit.addEventListener('click', () => this._githubCommit());
    this.ghEl.merge.addEventListener('click', () => this._githubMerge());
    this.ghEl.connect.addEventListener('click', () => this._ghConnect());
    // Detect the repo's real default branch (main/master/…) once it's named.
    this.ghEl.repo.addEventListener('blur', () => this._ghDetectBranch());
    // While the dialog is open and you flip to GitHub to make a token, nudge
    // the edot tab so it's easy to find your way back; stop when it closes.
    this.ghDialog.addEventListener('close', () => this.attention.disarm());
    // Returning from the GitHub token page (token freshly copied) refocuses
    // this tab — grab it from the clipboard if the field is still empty.
    this._on(window, 'focus', () => { if (this.ghDialog.open) this._harvestToken(); });
  }

  // Best-effort: if the clipboard holds a GitHub token and the field is empty,
  // fill it. Requires the clipboard-read permission (HTTPS); silently no-ops
  // where blocked (the user can always paste manually).
  async _harvestToken() {
    const el = this.ghEl;
    if (!el || el.token.value.trim()) return;
    if (!navigator.clipboard || !navigator.clipboard.readText) return;
    try {
      const text = (await navigator.clipboard.readText() || '').trim();
      const m = text.match(/^(github_pat_[A-Za-z0-9_]{20,}|gh[posru]_[A-Za-z0-9]{20,})$/);
      if (m && !el.token.value.trim()) {
        el.token.value = m[0];
        el.remember.checked = true;
        this.announce('Token pulled from clipboard');
      }
    } catch { /* clipboard blocked — manual paste still works */ }
  }

  openGithubDialog() {
    const el = this.ghEl;
    el.error.hidden = true; el.result.hidden = true; el.diff.hidden = true; el.diff.innerHTML = '';
    el.diffstat.textContent = ''; el.merge.hidden = true;
    if (el.branchNote) el.branchNote.hidden = true;
    this.gh = {}; this._branchDetectedFor = null;

    // Prefill from the document's git source, if it came from one; otherwise a
    // folder-encapsulated default (a document is its own folder — see OPENDOC).
    const s = this.doc && this.doc.source;
    if (s && s.owner && s.repo) {
      el.repo.value = `${s.owner}/${s.repo}`;
      el.branch.value = s.ref && !/^[0-9a-f]{7,40}$/i.test(s.ref) ? s.ref : '';
      el.path.value = s.path || this._defaultGhPath();
    } else {
      el.path.value = this._defaultGhPath();
    }
    el.message.value = `Update ${el.path.value || 'document'} via edot`;
    el.token.value = this._ghStoredToken();
    el.remember.checked = this._ghPersisted();      // checked = saved on this device
    this._ghRenderConnection(this._ghStoredLogin()); // optimistic: show cached identity
    this._renderGhRecents();
    showModal(this.ghDialog);
    (el.token.value ? el.repo : el.token).focus();
    if (!el.token.value) this._harvestToken();       // pick up a freshly-copied token
    if (el.repo.value) this._ghDetectBranch();
    if (!el.token.value) this.attention.arm('Paste your GitHub token'); // nudge on return
  }

  // ---- GitHub connection (saved token + identity) ----
  _ghStoredToken() { try { return localStorage.getItem(GH_TOKEN_KEY) || sessionStorage.getItem(GH_TOKEN_KEY) || ''; } catch { return ''; } }
  _ghStoredLogin() { try { return localStorage.getItem(GH_LOGIN_KEY) || sessionStorage.getItem(GH_LOGIN_KEY) || ''; } catch { return ''; } }
  _ghPersisted() { try { return !!localStorage.getItem(GH_TOKEN_KEY); } catch { return false; } }
  _ghStore(key, value, persist) {
    try {
      sessionStorage.removeItem(key); localStorage.removeItem(key);
      if (value) (persist ? localStorage : sessionStorage).setItem(key, value);
    } catch { /* storage blocked */ }
  }
  _ghForget() { try { [localStorage, sessionStorage].forEach((s) => { s.removeItem(GH_TOKEN_KEY); s.removeItem(GH_LOGIN_KEY); }); } catch { /* */ } }

  // Validate the pasted token, fetch @login, and switch the UI to "connected".
  async _ghConnect() {
    const el = this.ghEl;
    const token = el.token.value.trim();
    el.error.hidden = true;
    if (!token) return this._ghErr('Paste a token to connect');
    try {
      el.connect.disabled = true; el.conn.hidden = false; el.conn.textContent = 'Connecting…';
      const user = await new GitHubRemote(token).me();
      this._ghPersistConnection(token, user.login, el.remember.checked);
      this.announce(`Connected to GitHub as @${user.login}`);
    } catch (err) {
      this._ghRenderConnection('');
      this._ghErr(this._ghMessage(err));
    } finally { el.connect.disabled = false; }
  }

  _ghPersistConnection(token, login, persist) {
    this._ghStore(GH_TOKEN_KEY, token, persist);
    this._ghStore(GH_LOGIN_KEY, login || '', persist);
    this._ghRenderConnection(login || '');
  }

  _ghDisconnect() {
    this._ghForget();
    this.ghEl.token.value = '';
    this._ghRenderConnection('');
    this.announce('Disconnected from GitHub');
  }

  // Reflect connection state in the dialog and the File-menu hint ("attached").
  _ghRenderConnection(login) {
    const el = this.ghEl;
    this._ghLogin = login || '';
    if (login) {
      el.conn.hidden = false; el.conn.textContent = '';
      const span = document.createElement('span');
      span.innerHTML = `✓ Signed in as <strong>@${esc(login)}</strong> · `;
      const dc = document.createElement('button'); dc.type = 'button'; dc.className = 'gh-link'; dc.textContent = 'Disconnect';
      dc.addEventListener('click', () => this._ghDisconnect());
      el.conn.append(span, dc);
      el.connect.hidden = true;
    } else {
      el.conn.hidden = true; el.conn.textContent = '';
      el.connect.hidden = false;
    }
    const hint = document.querySelector('#mi-github .hint');
    if (hint) hint.textContent = login ? `@${login}` : 'PR';
  }

  // After a token is known to work (preview/commit), record it and, if we don't
  // yet know who it is, fetch @login quietly so the UI shows "Signed in as…".
  async _ghNoteWorkingToken(token, persist) {
    this._ghStore(GH_TOKEN_KEY, token, persist);
    if (this._ghLogin) { this._ghStore(GH_LOGIN_KEY, this._ghLogin, persist); return; }
    try { const user = await new GitHubRemote(token).me(); this._ghPersistConnection(token, user.login, persist); }
    catch { /* identity is optional; the commit already worked */ }
  }

  // A document is encapsulated in its own folder: "<slug>/<slug>.md".
  _defaultGhPath() {
    const slug = ghSlug(this.titleInput && this.titleInput.value);
    return `${slug}/${slug}.md`;
  }

  // Detect the repo's actual default branch over the API and fill it in (only
  // when the field is empty or still holds a previously-detected value, so a
  // branch the user typed is never clobbered).
  async _ghDetectBranch() {
    const el = this.ghEl;
    const m = /^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(el.repo.value.trim());
    if (!m) return;
    const key = `${m[1]}/${m[2]}`;
    if (this._branchDetectedFor === key) return;
    try {
      const def = await new GitHubRemote(el.token.value.trim()).defaultBranch(m[1], m[2]);
      if (!def) return;
      this._branchDetectedFor = key;
      el.branch.placeholder = def;
      const cur = el.branch.value.trim();
      if (!cur || cur === this._lastDetectedBranch) el.branch.value = def;
      this._lastDetectedBranch = def;
      if (el.branchNote) { el.branchNote.textContent = `Default branch on ${key}: ${def}`; el.branchNote.hidden = false; }
    } catch { /* private without a token, or offline — the field is still editable */ }
  }

  // ---- remembered save locations (cached, easily zapped) ----
  _ghRecents() { try { return JSON.parse(localStorage.getItem(GH_RECENTS_KEY)) || []; } catch { return []; } }
  _ghWriteRecents(list) { try { localStorage.setItem(GH_RECENTS_KEY, JSON.stringify(list)); } catch { /* quota */ } this._renderGhRecents(); }
  _ghSaveRecent(loc) {
    const list = this._ghRecents().filter((r) => !(r.repo === loc.repo && r.path === loc.path && r.branch === loc.branch));
    list.unshift(loc);
    this._ghWriteRecents(list.slice(0, 8));
  }
  _renderGhRecents() {
    const wrap = this.ghEl.recents; if (!wrap) return;
    const list = this._ghRecents();
    wrap.innerHTML = '';
    if (!list.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    const head = document.createElement('div'); head.className = 'gh-recents-head';
    const title = document.createElement('span'); title.textContent = 'Recent save locations';
    const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'gh-link'; clear.textContent = 'Clear history';
    clear.addEventListener('click', () => this._ghWriteRecents([]));
    head.append(title, clear); wrap.appendChild(head);
    list.forEach((r, i) => {
      const row = document.createElement('div'); row.className = 'gh-recent';
      const use = document.createElement('button'); use.type = 'button'; use.className = 'gh-recent-use';
      use.textContent = `${r.repo} · ${r.path}${r.branch ? ` (${r.branch})` : ''}`;
      use.addEventListener('click', () => this._ghUseRecent(r));
      const del = document.createElement('button'); del.type = 'button'; del.className = 'gh-recent-del'; del.setAttribute('aria-label', `Forget ${r.repo} ${r.path}`); del.textContent = '✕';
      del.addEventListener('click', () => { const l = this._ghRecents(); l.splice(i, 1); this._ghWriteRecents(l); });
      row.append(use, del); wrap.appendChild(row);
    });
  }
  _ghUseRecent(r) {
    const el = this.ghEl;
    el.repo.value = r.repo; el.branch.value = r.branch || ''; el.path.value = r.path;
    el.message.value = `Update ${r.path} via edot`;
    this._branchDetectedFor = null;
    this._ghDetectBranch();
    el.token.focus();
  }

  _ghParse() {
    const el = this.ghEl;
    const m = /^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(el.repo.value.trim());
    if (!m) throw new Error('Repository must be "owner/repo"');
    let path = el.path.value.trim().replace(/^\/+/, '');
    if (!path) throw new Error('Enter the file path to write');
    // Files are always encapsulated in a folder: a bare "notes.md" becomes
    // "notes/notes.md" (a document is its own folder — OPENDOC package idea).
    if (!path.includes('/')) { const stem = path.replace(/\.[^.]+$/, '') || 'document'; path = `${stem}/${path}`; }
    el.path.value = path; // reflect the foldered path back to the user
    const ext = (path.match(/\.([a-z0-9]+)$/i) || [])[1] || '';
    if (!IO.isTextFormat(ext)) throw new Error(`Save-back supports text files only (.md, .txt, .html, .css) — not .${ext || '?'}`);
    const token = el.token.value.trim();
    if (!token) throw new Error('Paste a personal access token');
    const branch = el.branch.value.trim() || el.branch.placeholder || 'main';
    return { owner: m[1], repo: m[2], path, ext, branch, token };
  }

  async _githubPreview() {
    const el = this.ghEl;
    el.error.hidden = true; el.result.hidden = true;
    let p;
    try { p = this._ghParse(); } catch (err) { return this._ghErr(err.message); }
    try {
      el.diffstat.textContent = 'Fetching…';
      const newText = await IO.exportText(this.editor.getContent(), this.titleInput.value, p.ext);
      const remote = new GitHubRemote(p.token);
      const file = await remote.getFile(p.owner, p.repo, p.path, p.branch);
      const diff = diffLines(file.text, newText);
      const stats = diffStats(diff);
      this.gh = { ...p, sha: file.sha, newText, exists: file.exists };
      this._renderDiff(collapse(diff));
      el.diffstat.textContent = file.exists
        ? `+${stats.add} −${stats.del} vs ${p.branch}`
        : `new file · ${newText.split('\n').length} lines`;
      this._ghNoteWorkingToken(p.token, el.remember.checked);
    } catch (err) {
      this._ghErr(this._ghMessage(err));
    }
  }

  async _githubCommit() {
    const el = this.ghEl;
    el.error.hidden = true; el.result.hidden = true;
    let p;
    try { p = this._ghParse(); } catch (err) { return this._ghErr(err.message); }
    try {
      el.commit.disabled = true;
      el.diffstat.textContent = 'Committing…';
      const newText = this.gh.newText && this.gh.path === p.path
        ? this.gh.newText
        : await IO.exportText(this.editor.getContent(), this.titleInput.value, p.ext);
      const remote = new GitHubRemote(p.token);
      const { pr } = await commitViaPullRequest(remote, {
        owner: p.owner, repo: p.repo, path: p.path, baseBranch: p.branch,
        message: el.message.value.trim() || `Update ${p.path} via edot`,
        contentText: newText,
        title: el.message.value.trim() || `Update ${p.path}`,
        body: 'Edited with edot (https://danbri.github.io/glitchcan-minigam/magpie/edot/edot.html).',
      });
      this._ghNoteWorkingToken(p.token, el.remember.checked);
      this._ghSaveRecent({ repo: `${p.owner}/${p.repo}`, branch: p.branch, path: p.path });
      // Keep enough state to offer a one-click merge next.
      this.gh = { ...this.gh, ...p, pr, baseBranch: p.branch };
      el.diffstat.textContent = '';
      el.result.innerHTML = `Pull request opened: <a href="${esc(pr.html_url)}" target="_blank" rel="noopener noreferrer">#${pr.number}</a>`;
      el.result.hidden = false;
      el.merge.hidden = false; // offer to merge it straight away
      this.announce(`Pull request #${pr.number} opened`);
    } catch (err) {
      this._ghErr(this._ghMessage(err));
    } finally {
      el.commit.disabled = false;
    }
  }

  // Merge the PR we just opened — but only when GitHub reports it conflict-free.
  async _githubMerge() {
    const el = this.ghEl;
    if (!this.gh || !this.gh.pr) return;
    const { owner, repo, pr } = this.gh;
    const token = el.token.value.trim();
    el.error.hidden = true;
    try {
      el.merge.disabled = true;
      el.diffstat.textContent = 'Checking for conflicts…';
      const remote = new GitHubRemote(token);
      // `mergeable` is null until GitHub computes it — poll briefly.
      let pull = await remote.getPull(owner, repo, pr.number);
      for (let i = 0; i < 5 && pull.mergeable == null; i++) { await sleep(800); pull = await remote.getPull(owner, repo, pr.number); }
      if (pull.mergeable === false) {
        el.diffstat.textContent = '';
        return this._ghErr('Can’t merge automatically — the pull request has conflicts. Resolve them on GitHub.');
      }
      el.diffstat.textContent = 'Merging…';
      await remote.mergePull(owner, repo, pr.number, { method: 'squash', title: el.message.value.trim() || undefined });
      el.diffstat.textContent = '';
      el.result.innerHTML = `Merged ✓ <a href="${esc(pr.html_url)}" target="_blank" rel="noopener noreferrer">#${pr.number}</a> into ${esc(this.gh.baseBranch || '')}.`;
      el.result.hidden = false; el.merge.hidden = true;
      this.announce(`Pull request #${pr.number} merged`);
    } catch (err) {
      this._ghErr(this._ghMessage(err));
    } finally {
      el.merge.disabled = false;
    }
  }

  // ---- View source: see the underlying file the editor would write ----
  _wireSourceDialog() {
    this.srcDialog = document.getElementById('source-dialog');
    if (!this.srcDialog) return;
    this.srcEl = {
      format: document.getElementById('src-format'),
      text: document.getElementById('src-text'),
      note: document.getElementById('src-note'),
      copy: document.getElementById('src-copy'),
    };
    this.srcEl.format.addEventListener('change', () => this._renderSource());
    this.srcEl.copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(this.srcEl.text.value); this.announce('Source copied'); }
      catch { this.srcEl.text.select(); }
    });
  }

  openSourceDialog() {
    if (!this.srcDialog) return;
    showModal(this.srcDialog);
    this._renderSource();
  }

  async _renderSource() {
    const el = this.srcEl;
    const ext = el.format.value;
    el.note.textContent = 'Rendering…';
    try {
      const text = await IO.exportText(this.editor.getContent(), this.titleInput.value, ext);
      el.text.value = text;
      const hasRdfa = /\b(property|typeof|vocab|resource)=/.test(this.editor.getContent());
      const kept = ext === 'html'
        ? (hasRdfa ? 'HTML keeps your RDFa semantics, links and structure.' : 'HTML keeps links and structure.')
        : ext === 'md'
          ? (hasRdfa ? 'Markdown keeps links and structure but drops RDFa — save as .html to keep semantics.' : 'Markdown keeps links and structure.')
          : 'Plain text strips all markup, links and structure.';
      el.note.textContent = `${text.split('\n').length} lines · ${text.length} chars — ${kept}`;
    } catch (err) {
      el.text.value = ''; el.note.textContent = err.message;
    }
  }

  _renderDiff(rows) {
    const frag = document.createDocumentFragment();
    for (const r of rows) {
      const div = document.createElement('div');
      if (r.type === 'gap') { div.className = 'gap'; div.textContent = `⋯ ${r.count} unchanged line${r.count === 1 ? '' : 's'}`; }
      else {
        div.className = 'row ' + r.type;
        const sign = document.createElement('span');
        sign.className = 'sign';
        sign.textContent = r.type === 'add' ? '+' : r.type === 'del' ? '−' : ' ';
        const txt = document.createElement('span');
        txt.textContent = r.text;
        div.append(sign, txt);
      }
      frag.appendChild(div);
    }
    this.ghEl.diff.innerHTML = '';
    this.ghEl.diff.appendChild(frag);
    this.ghEl.diff.hidden = false;
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

  async openExample(ex) {
    if (ex.local) {
      // Same-origin fetch through the normal import pipeline.
      try {
        this.announce(`Loading “${ex.title}”…`);
        const resp = await fetch(ex.src);
        if (!resp.ok) throw new Error(`Could not load example (${resp.status})`);
        const blob = await resp.blob();
        const name = ex.src.split('/').pop();
        await this.openFile(new File([blob], name, { type: blob.type }), { example: ex.title });
      } catch (err) {
        console.error(err);
        this.announce(err.message || 'Could not load that example', { error: true });
      }
    } else {
      await this.openFromUrl(ex.src);
    }
  }

  async openLibrary() {
    const list = document.getElementById('docs-list');
    list.innerHTML = '';
    const docs = await this.library.listDocs();
    for (const d of docs) {
      list.appendChild(this._docRow(d));
    }
    if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
    else this.dialog.setAttribute('open', '');
  }

  _docRow(d) {
    const li = document.createElement('li');
    li.className = 'doc-row' + (this.doc && d.id === this.doc.id ? ' current' : '');

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'doc-open';
    const when = new Date(d.updatedAt).toLocaleString();
    open.innerHTML = `<span class="doc-name">${esc(d.title)}</span><span class="doc-meta">${esc(when)}</span>`;
    open.addEventListener('click', async () => {
      const fresh = await this.library.getDoc(d.id);
      this.dialog.close();
      this._loadDoc(fresh);
    });

    const rename = iconBtn('✏️', 'Rename', async () => {
      const name = window.prompt('Rename document:', d.title);
      if (name && name.trim()) {
        d.title = name.trim();
        await this.library.saveDoc(d);
        if (this.doc && this.doc.id === d.id) { this.doc.title = d.title; this.titleInput.value = d.title; }
        this.openLibrary();
      }
    });
    const dup = iconBtn('⧉', 'Duplicate', async () => {
      const copy = await this.library.createDoc(`${d.title} (copy)`, d.html);
      this.announce(`Duplicated “${d.title}”`);
      this.openLibrary();
      void copy;
    });
    const del = iconBtn('🗑️', 'Delete', async () => {
      if (!window.confirm(`Delete “${d.title}”? This cannot be undone.`)) return;
      await this.library.deleteDoc(d.id);
      if (this.doc && this.doc.id === d.id) {
        const all = await this.library.listDocs();
        this._loadDoc(all[0] || await this.library.createDoc('Untitled document', '<p><br></p>'), { announce: false });
      }
      this.announce('Document deleted');
      this.openLibrary();
    });
    del.classList.add('icon-btn');

    li.append(open, rename, dup, del);
    return li;
  }

  // Open a sibling suite app in a new tab without navigating this one.
  _launchApp(path) {
    const a = document.createElement('a');
    a.href = path; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    this.attention.arm('Back to edot', { once: true });
  }

  // ---- command registry (the action vocabulary; see command-registry.js) ----
  _wireCommands() {
    const app = this;
    const reg = new CommandRegistry();
    reg.registerAll([
      { id: 'doc.new', title: 'New document', icon: '📄', group: '1file', order: 1, shortcut: 'Mod+N', run: () => app.newDocument() },
      { id: 'doc.open', title: 'Open…', icon: '📂', group: '1file', order: 2, keywords: 'examples research file url', run: () => app.openOpenDialog() },
      { id: 'doc.mydocs', title: 'My documents', icon: '🗂', group: '1file', order: 3, shortcut: 'Mod+Shift+O', run: () => app.openLibrary() },
      { id: 'doc.viewsource', title: 'View source', icon: '⟨⟩', group: '1file', order: 4, keywords: 'html markdown', run: () => app.openSourceDialog() },
      { id: 'doc.github', title: 'Save to GitHub…', icon: '⎇', group: '1file', order: 5, keywords: 'commit pull request push', run: () => app.openGithubDialog() },
      { id: 'doc.close', title: 'Close document', icon: '✕', group: '1file', order: 6, shortcut: 'Mod+W', run: () => app.closeDocument() },
      { id: 'doc.find', title: 'Find…', icon: '🔍', group: '1file', order: 7, shortcut: 'Mod+F', run: () => app.findReplace.open(false) },
      { id: 'doc.replace', title: 'Find & replace…', icon: '🔁', group: '1file', order: 8, shortcut: 'Mod+H', run: () => app.findReplace.open(true) },
      { id: 'export.pdf', title: 'Export as PDF', icon: '⬇', group: '2export', order: 1, run: () => app.exportAs('pdf') },
      { id: 'export.docx', title: 'Export as Word (.docx)', icon: '⬇', group: '2export', order: 2, run: () => app.exportAs('docx') },
      { id: 'export.md', title: 'Export as Markdown', icon: '⬇', group: '2export', order: 3, run: () => app.exportAs('md') },
      { id: 'export.html', title: 'Export as HTML', icon: '⬇', group: '2export', order: 4, run: () => app.exportAs('html') },
      { id: 'insert.link', title: 'Insert link…', icon: '🔗', group: '4insert', run: () => createLink(app.announce) },
      { id: 'insert.semantic', title: 'Tag semantic property (RDFa)…', icon: '🏷️', group: '4insert', run: () => createSemantic(app.announce) },
      { id: 'app.data', title: 'Open Data workspace', icon: '▦', group: '5apps', run: () => app._launchApp('data/data.html') },
      { id: 'app.slides', title: 'Open Slides', icon: '▤', group: '5apps', run: () => app._launchApp('slides/slides.html') },
      { id: 'app.mail', title: 'Open Mail', icon: '✉', group: '5apps', run: () => app._launchApp('mail/mail.html') },
      { id: 'app.calendar', title: 'Open Calendar', icon: '📅', group: '5apps', run: () => app._launchApp('calendar/calendar.html') },
      { id: 'app.maps', title: 'Open Maps', icon: '🗺', group: '5apps', run: () => app._launchApp('maps/maps.html') },
      { id: 'app.login', title: 'Sign in (OIDC)', icon: '👤', group: '5apps', run: () => app._launchApp('auth/login.html') },
      { id: 'app.backup', title: 'Encrypted backup', icon: '🔒', group: '5apps', run: () => app._launchApp('backup/backup.html') },
    ]);
    // Formatting + block styles, sourced from the editing command module.
    for (const [id, c] of Object.entries(COMMANDS)) {
      reg.register({ id: `format.${id}`, title: c.label, group: '3format', order: 10, keywords: 'format', run: () => c.exec(), shortcut: c.key ? `Mod+${c.shift ? 'Shift+' : ''}${c.key.toUpperCase()}` : '' });
    }
    for (const b of BLOCK_FORMATS) {
      reg.register({ id: `block.${b.value}`, title: b.label, group: '3format', order: 20, keywords: 'heading paragraph style', run: () => setBlockFormat(b.value) });
    }
    this.commands = reg;
  }

  // ---- command palette (Mod+K) — additive surface over the registry ----
  _wirePalette() {
    this.palette = document.getElementById('palette-dialog');
    this.paletteInput = document.getElementById('palette-input');
    this.paletteList = document.getElementById('palette-list');
    if (!this.palette) return;
    this.paletteInput.addEventListener('input', () => { this._paletteActive = 0; this._renderPalette(); });
    this.paletteInput.addEventListener('keydown', (e) => this._paletteKey(e));
    this.paletteList.addEventListener('click', (e) => { const li = e.target.closest('.palette-item'); if (li) this._runPalette(li.dataset.id); });
  }

  openPalette() {
    if (!this.palette) return;
    this.paletteInput.value = ''; this._paletteActive = 0;
    this._renderPalette();
    showModal(this.palette);
    this.paletteInput.focus();
  }

  _renderPalette() {
    const items = this.commands.search(this.paletteInput.value, { app: this, surface: 'editor' });
    this._paletteItems = items;
    if (this._paletteActive >= items.length) this._paletteActive = Math.max(0, items.length - 1);
    this.paletteList.innerHTML = '';
    if (!items.length) {
      const li = document.createElement('li'); li.className = 'palette-empty'; li.textContent = 'No matching commands';
      this.paletteList.appendChild(li); return;
    }
    items.forEach((c, i) => {
      const li = document.createElement('li');
      li.className = 'palette-item' + (i === this._paletteActive ? ' active' : '');
      li.dataset.id = c.id; li.setAttribute('role', 'option');
      li.innerHTML = `<span class="palette-icon">${esc(c.icon || '•')}</span><span class="palette-title">${esc(c.title)}</span>` +
        (c.shortcut ? `<span class="palette-shortcut">${esc(c.shortcut)}</span>` : '');
      this.paletteList.appendChild(li);
    });
  }

  _paletteKey(e) {
    const n = (this._paletteItems || []).length;
    if (e.key === 'ArrowDown') { e.preventDefault(); this._paletteActive = n ? (this._paletteActive + 1) % n : 0; this._renderPalette(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this._paletteActive = n ? (this._paletteActive - 1 + n) % n : 0; this._renderPalette(); }
    else if (e.key === 'Enter') { e.preventDefault(); const c = (this._paletteItems || [])[this._paletteActive]; if (c) this._runPalette(c.id); }
    else if (e.key === 'Escape') { e.preventDefault(); this.palette.close(); }
  }

  _runPalette(id) {
    this.palette.close();
    try { this.commands.run(id, { app: this, surface: 'editor' }); }
    catch (err) { this.announce(err.message || 'Command failed', { error: true }); }
  }

  _wireGlobalKeys() {
    this._on(document, 'keydown', (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'k' || (k === 'p' && e.shiftKey)) { e.preventDefault(); this.openPalette(); }
      else if (k === 's') { e.preventDefault(); this.exportAs(this.lastExportExt); }
      else if (k === 'o' && e.shiftKey) { e.preventDefault(); this.openLibrary(); }
      else if (k === 'o') { e.preventDefault(); this.fileInput.click(); }
      else if (k === 'w') { e.preventDefault(); this.closeDocument(); }
      else if (k === 'f') { e.preventDefault(); this.findReplace.open(false); }
      else if (k === 'h') { e.preventDefault(); this.findReplace.open(true); }
    });
  }

  _wireDragDrop() {
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    ['dragenter', 'dragover', 'drop'].forEach((ev) => this._on(document, ev, stop, false));
    this._on(document, 'drop', (e) => {
      const file = e.dataTransfer && e.dataTransfer.files[0];
      if (file) this.openFile(file);
    });
  }

  _reflectBackend() {
    const badge = document.getElementById('backend-state');
    if (!badge) return;
    badge.textContent = LO.isConfigured()
      ? 'LibreOffice WASM: configured'
      : 'LibreOffice WASM: not configured (native I/O active)';
  }

  // ---- Actions ----
  async newDocument() {
    const doc = await this.library.createDoc('Untitled document', '<p><br></p>');
    this._loadDoc(doc);
    this.announce('New document');
  }

  async openFile(file, source = null) {
    try {
      this.announce(`Opening ${file.name}…`);
      const html = await IO.importFile(file);
      const title = file.name.replace(/\.[^.]+$/, '') || 'Untitled document';
      const doc = await this.library.createDoc(title, html);
      // Remember where it came from (enables a future git save-back path).
      if (source) { doc.source = source; await this.library.saveDoc(doc); }
      this.lastExportExt = IO.extOf(file.name) || this.lastExportExt;
      this._loadDoc(doc);
      this.announce(`Imported ${file.name}`);
    } catch (err) {
      console.error(err);
      this.announce(err.message || 'Could not open that file', { error: true });
    }
  }

  // Fetch a document from a URL (smart-rewriting git hosting links) and import.
  async openFromUrl(input) {
    let resolved;
    try { resolved = resolveSourceUrl(input); }
    catch (err) { this.announce(err.message, { error: true }); return; }
    try {
      this.announce(`Fetching ${resolved.provider === 'web' ? 'URL' : resolved.provider}…`);
      const resp = await fetch(resolved.url, { redirect: 'follow' });
      if (!resp.ok) throw new Error(`Fetch failed (${resp.status} ${resp.statusText})`);
      const blob = await resp.blob();
      const name = filenameFromUrl(resolved.url, resp.headers.get('content-type') || '');
      await this.openFile(new File([blob], name, { type: blob.type }), {
        kind: 'url', ...resolved,
      });
    } catch (err) {
      console.error(err);
      // fetch() throws a TypeError when the server blocks the cross-origin read.
      const corsy = err instanceof TypeError || resolved.corsRisk;
      this.announce(corsy
        ? 'Could not fetch — the server may block cross-origin requests (CORS). raw.githubusercontent.com works; many other hosts do not.'
        : (err.message || 'Could not open that URL'), { error: true });
    }
  }

  // Close the current document. It stays safe in the library; we open a fresh
  // blank so there's always an editing surface.
  async closeDocument() {
    if (this.doc) {
      this.doc.html = this.editor.getContent();
      this.doc.title = this.titleInput.value.trim() || 'Untitled document';
      await this.library.saveDoc(this.doc);
    }
    const doc = await this.library.createDoc('Untitled document', '<p><br></p>');
    this._loadDoc(doc, { announce: false });
    this.announce('Closed — find it again in File ▸ My documents');
  }

  async exportAs(ext) {
    try {
      const html = this.editor.getContent();
      const title = this.titleInput.value.trim() || 'Untitled document';
      const blob = await IO.exportDocument(html, title, ext);
      IO.downloadBlob(blob, `${sanitizeFilename(title)}.${ext}`);
      this.lastExportExt = ext;
      this.announce(`Saved as .${ext}`);
    } catch (err) {
      console.error(err);
      this.announce(err.message || `Could not export .${ext}`, { error: true });
    }
  }

  // ---- Status ----
  _refreshStats() {
    const s = this.editor.stats();
    this.statWords.textContent = `${s.words} ${s.words === 1 ? 'word' : 'words'}`;
    this.statChars.textContent = `${s.chars} ${s.chars === 1 ? 'char' : 'chars'}`;
  }

  _markDirty() {
    this.saveState.textContent = 'Editing…';
    this.saveState.dataset.dirty = 'true';
  }

  _markClean() {
    this.saveState.textContent = this.library
      ? `Saved · ${this.library.kind}`
      : 'Autosave unavailable';
    this.saveState.dataset.dirty = 'false';
  }
}

function iconBtn(glyph, label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icon-btn';
  b.textContent = glyph;
  b.setAttribute('aria-label', label);
  b.title = label;
  b.addEventListener('click', onClick);
  return b;
}

function esc(s) { return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
function sanitizeFilename(name) { return (name || 'document').replace(/[\/\\:*?"<>|]+/g, '_').slice(0, 80); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
// URL/path-safe slug for the "document is its own folder" default path.
function ghSlug(s) {
  const v = String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return v || 'document';
}
function showModal(dialog) {
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

const WELCOME = `
<h1>Welcome to edot</h1>
<p>A small, modular, <strong>accessible</strong> word processor and office-document tool that runs entirely in your browser — no server, no upload, your text never leaves the page.</p>
<h2>Write &amp; format</h2>
<ul>
<li>Use the toolbar or shortcuts: <strong>Ctrl/⌘+B</strong>, <em>+I</em>, <u>+U</u>.</li>
<li>Tag any selection with a 🏷️ <strong>semantic property</strong> (RDFa) — meaning that survives HTML export.</li>
</ul>
<h2>Open &amp; save real files</h2>
<ul>
<li>Open <strong>.docx</strong>, Markdown, HTML or text (<strong>Ctrl/⌘+O</strong>) — or drag one onto the page.</li>
<li>Open straight from a <strong>URL</strong> — including <strong>GitHub/GitLab links</strong>, which are rewritten to the raw file automatically (<strong>File ▸ Open from URL</strong>).</li>
<li>Browse ready-made docs in <strong>File ▸ Examples</strong> (try the full Adam Morton logic textbook).</li>
<li>Save as <strong>DOCX, PDF, HTML+RDFa, Markdown, CSS or plain text</strong> from the <strong>File</strong> menu (<strong>Ctrl/⌘+S</strong>).</li>
</ul>
<h2>Your documents, stored locally</h2>
<p>Every document is kept in this browser’s local store and autosaves as you type. Open <strong>File ▸ My documents</strong> (<strong>Ctrl/⌘+Shift+O</strong>) to switch between them.</p>
<blockquote>Richer formats (.odt, .doc, .rtf) light up when a LibreOffice&nbsp;WASM backend is configured — see the project README.</blockquote>
`;

window.addEventListener('DOMContentLoaded', () => {
  // Re-instantiation is leak-free: tear down any prior instance first.
  if (window.__edot && typeof window.__edot.destroy === 'function') window.__edot.destroy();
  window.__edot = new App();
});

export { App };
