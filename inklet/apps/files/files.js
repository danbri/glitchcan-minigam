// Files: the person's locations as folders and files, through foaf.pod.* only.
// Each location says where it is, what it needs, and what could lose it.
//
// Three panes (../ui/panes.css): folders, what is in this folder, and the file
// you picked, which you can read and edit. Paths are relative to this app's
// own pod container. As the file manager, it may see a location's address; never a password.
//
// The pod verbs carry text, so anything else shows its details but no preview.
(function () {
  const $ = (id) => document.getElementById(id);
  const statusEl = $('status');
  const REASONS = {
    denied: 'Files may not use your pod. Check its permissions.',
    'no-pod': 'No pod is chosen for apps yet. Choose one in System, under Pods.',
    conflict: 'This file changed elsewhere since you opened it. Open it again, then save.',
    offline: 'That location is not connected.',
    'needs-ok': 'This folder needs your OK. Use Allow access.',
    locked: 'This location is locked. Unlock your session first.',
    error: 'That location cannot be reached.',
    cancelled: 'No folder was chosen.',
    'no-folder': 'That folder could not be added.',
    'too-large': 'This file is too large to open here.',
  };
  const say = (text, bad = false) => { statusEl.textContent = text; statusEl.classList.toggle('bad', bad); };
  const explain = (r) => REASONS[r.reason] || `That did not work: ${r.reason}${r.status ? ` (${r.status})` : ''}.`;
  const h = (tag, props = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
      else if (k === 'class') e.className = v;
      else if (k in e) e[k] = v; else e.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) e.append(kid);
    return e;
  };

  const KINDS = [
    [/\.(txt|text|md)$/i, '📄', 'Text'], [/\.(ttl|n3|nt|nq|trig|rdf|jsonld)$/i, '🔗', 'Linked data'],
    [/\.json$/i, '{ }', 'JSON'], [/\.(html?|css|m?js|ts|xml|svg)$/i, '⌨', 'Code'], [/\.csv$/i, '▤', 'Table'],
    [/\.(png|jpe?g|gif|webp|avif)$/i, '🖼', 'Image'], [/\.(mp3|wav|ogg|m4a)$/i, '♪', 'Audio'], [/\.(mp4|webm|mov)$/i, '🎞', 'Video'],
  ];
  const kindOf = (it) => {
    if (it.container) return { icon: '📁', name: 'Folder' };
    const k = KINDS.find(([re]) => re.test(it.path));
    return k ? { icon: k[1], name: k[2] } : { icon: '📄', name: 'File' };
  };
  const nameOf = (p) => p.replace(/\/$/, '').split('/').pop();
  const parentOf = (p) => { const s = p.replace(/\/$/, ''); const i = s.lastIndexOf('/'); return i < 0 ? '' : s.slice(0, i + 1); };
  const cleanName = (s) => String(s).trim().replace(/[^\p{L}\p{N} ._-]+/gu, '-').replace(/^\.+/, '').slice(0, 100);
  const hiddenName = (n) => n.startsWith('.');

  let locations = [];            // what the shell says about each pod
  let current = null;            // the location in use
  let folder = '';               // current folder: '' or 'a/b/'
  let items = [];
  let picked = null;             // { path, body, etag, contentType, dirty }
  let icons = false;
  let sort = { key: 'name', dir: 1 };
  const trail = [];
  const children = new Map();    // folder -> subfolders, for the tree
  const expanded = new Set(['']);

  async function list(path) {
    const r = await foaf.pod.list(path);
    if (r.ok) return r;
    // A folder that does not exist yet is an empty folder, not a fault.
    if (r.reason === 'http' && r.status === 404) return { ok: true, items: [] };
    return r;
  }

  let listing = 0;               // only the newest listing may draw: an old one may be from another location
  async function go(path, { remember = true } = {}) {
    const mine = ++listing;
    const r = await list(path);
    if (mine !== listing) return;
    if (r.reason === 'needs-ok') takeLocations(await foaf.pod.locations());
    if (!r.ok) { say(explain(r), true); return; }
    if (remember && path !== folder) trail.push(folder);
    folder = path;
    items = r.items.map((it) => ({ ...it, path: folder + it.path.replace(/^\/+/, '') }))
      .filter((it) => !hiddenName(nameOf(it.path)));
    children.set(folder, items.filter((i) => i.container).map((i) => i.path));
    for (let p = folder; ; p = parentOf(p)) { expanded.add(p); if (!p) break; }
    pick(null);
    draw();
    const n = items.length;
    say(n ? `${n} item${n === 1 ? '' : 's'}` : 'This folder is empty.');
  }

  // Walks every folder for a name, with a limit, so a very large pod cannot hang the window.
  async function searchAll() {
    const q = $('filter').value.trim().toLowerCase();
    if (!q) return;
    const mine = ++listing, found = [], queue = [''];
    say('Searching all folders');
    let seen = 0;
    while (queue.length && seen < 300 && found.length < 200) {
      const base = queue.shift();
      seen++;
      const r = await list(base);
      if (mine !== listing) return;
      if (!r.ok) continue;
      for (const it of r.items) {
        const path = base + it.path.replace(/^\/+/, '');
        if (hiddenName(nameOf(path))) continue;
        if (it.container) queue.push(path);
        if (nameOf(path).toLowerCase().includes(q)) found.push({ ...it, path });
      }
    }
    items = found;
    pick(null);
    draw();
    const cut = queue.length ? `, after ${seen} folders` : '';
    say(`${found.length} found in all folders${cut}`);
  }

  function shown() {
    const q = $('filter').value.trim().toLowerCase();
    const rows = items.filter((i) => !q || nameOf(i.path).toLowerCase().includes(q));
    const key = (i) => sort.key === 'kind' ? kindOf(i).name : nameOf(i.path).toLowerCase();
    return rows.sort((a, b) => (b.container - a.container) || key(a).localeCompare(key(b)) * sort.dir);
  }

  function draw() {
    $('back').disabled = !trail.length;
    $('up').disabled = !folder;
    const parts = folder.split('/').filter(Boolean);
    $('crumbs').replaceChildren(h('li', {}, h('button', { type: 'button', on: { click: () => go('') } }, here()?.label || 'My files')),
      ...parts.map((p, i) => h('li', {}, h('button', { type: 'button', on: { click: () => go(parts.slice(0, i + 1).join('/') + '/') } }, p))));
    drawTree();
    drawItems();
  }

  function treeNode(path, label) {
    const open = expanded.has(path);
    const b = h('button', { type: 'button', title: label, on: { click: () => { $('panes').dataset.places = 'closed'; go(path); } } }, `${open ? '📂' : '📁'} ${label}`);
    if (path === folder) b.setAttribute('aria-current', 'true');
    const li = h('li', {}, b);
    const kids = open ? children.get(path) || [] : [];
    if (kids.length) li.append(h('ul', {}, kids.map((k) => treeNode(k, nameOf(k)))));
    return li;
  }
  const shortcut = (label, path) => h('li', {}, h('button', { type: 'button', on: { click: () => { $('panes').dataset.places = 'closed'; go(path); } } }, label));
  const here = () => locations.find((l) => l.id === current);
  const drawTree = () => $('tree').replaceChildren(treeNode('', here()?.label || 'My files'), shortcut('🗒️ Notes', 'apps/podnotes/notes/'));

  function drawLocations() {
    $('locations').replaceChildren(...locations.map((l) => h('li', {}, h('button', { type: 'button', 'aria-current': String(l.id === current), on: { click: () => useLocation(l.id) } },
      h('span', {}, l.icon), h('span', {}, l.label), l.status === 'online' ? null : h('span', { class: 'location-state' }, l.statusText)))));
    const l = here(), box = $('where');
    box.dataset.risky = String(!!l && l.dev.kept === 'run');
    if (!l) { box.replaceChildren(h('p', {}, 'No location is chosen yet.')); return; }
    const row = (k, v) => [h('dt', {}, k), h('dd', {}, v)];
    box.replaceChildren(h('div', { class: 'where-head' }, h('h2', {}, `${l.icon} ${l.label}: ${l.statusText}`),
        h('button', { id: 'change-location', class: 'tool', type: 'button', on: { click: () => { $('panes').dataset.places = 'open'; } } }, 'Change')),
      ...(l.dev.kept === 'run' ? [h('p', { class: 'where-warn' }, l.risk)] : []),
      ...(l.status === 'needs-ok' ? [h('button', { class: 'tool tool-main', type: 'button', on: { click: () => useLocation(l.id) } }, 'Allow access')] : []),
      // The files come first: the rest of what is known is one click away.
      h('details', { class: 'where-more' }, h('summary', {}, 'About this location'), h('dl', {}, row('Where', l.where), row('Needs', l.needs), row('Encrypted', l.encrypted), row('Could lose it', l.risk), l.detail ? row('Now', l.detail) : null),
        h('details', {}, h('summary', {}, 'For developers'), h('dl', {},
          row('Pod id', l.id), row('Carriage', l.dev.carriage), row('Base', l.dev.base),
          l.dev.device ? row('Device', l.dev.device) : null, l.dev.kept ? row('Kept', l.dev.kept) : null))));
  }

  function takeLocations(r) {
    if (!Array.isArray(r.locations)) return;
    locations = r.locations; current = r.current;
    $('add-folder').hidden = !r.canAddFolder;
    drawLocations();
    draw();
  }

  async function useLocation(id) { await showLocation(await foaf.pod.use(id)); }

  async function showLocation(r) {
    takeLocations(r);
    folder = ''; items = []; trail.length = 0; children.clear(); expanded.clear(); expanded.add(''); pick(null);
    drawItems(); drawTree();
    if (!r.ok) { say(explain(r), true); return; }
    say('');
    $('panes').dataset.places = 'closed';
    await go('', { remember: false });
    takeLocations(await foaf.pod.locations());
  }

  async function addFolder() {
    const r = await foaf.pod.addFolder();
    if (!r.ok && !r.locations) { say(explain(r), true); return; }
    await showLocation(r);
  }

  function activate(it) { if (it.container) go(it.path); else pick(it); }

  function drawItems() {
    const rows = shown();
    const box = $('items');
    if (!rows.length) {
      const filtering = !!$('filter').value;
      const newFolder = () => $('new-folder').click();
      const clearFilter = () => { $('filter').value = ''; go(folder, { remember: false }); };
      box.replaceChildren(h('div', { class: 'empty' }, h('p', {}, filtering ? 'Nothing here matches that filter.' : 'This folder is empty.'),
        ...(filtering ? [h('button', { class: 'tool tool-main', type: 'button', on: { click: searchAll } }, 'Search all folders'),
          h('button', { class: 'tool', type: 'button', on: { click: clearFilter } }, 'Clear filter')]
          : [h('button', { class: 'tool tool-main', type: 'button', on: { click: askNewFile } }, 'New file'),
            h('button', { class: 'tool', type: 'button', on: { click: newFolder } }, 'New folder')])));
      return;
    }
    if (icons) {
      box.replaceChildren(h('div', { class: 'grid', role: 'listbox', 'aria-label': 'Items' }, rows.map((it) => {
        const k = kindOf(it);
        return h('button', { type: 'button', role: 'option', 'aria-selected': String(picked?.path === it.path),
          on: { click: () => (it.container ? pick(it) : activate(it)), dblclick: () => activate(it), keydown: (e) => { if (e.key === 'Enter') activate(it); } } },
        h('span', { class: 'ico', 'aria-hidden': 'true' }, k.icon), nameOf(it.path));
      })));
      return;
    }
    const head = (key, label) => h('th', { scope: 'col' }, h('button', { type: 'button', on: { click: () => { sort = { key, dir: sort.key === key ? -sort.dir : 1 }; drawItems(); } } },
      `${label}${sort.key === key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}`));
    box.replaceChildren(h('table', { class: 'list' },
      h('thead', {}, h('tr', {}, head('name', 'Name'), head('kind', 'Kind'))),
      h('tbody', {}, rows.map((it) => {
        const k = kindOf(it);
        const tr = h('tr', { tabIndex: 0, on: {
          click: () => (it.container ? pick(it) : activate(it)), dblclick: () => activate(it),
          keydown: (e) => {
            if (e.key === 'Enter') activate(it);
            if (e.key === 'ArrowDown') tr.nextElementSibling?.focus();
            if (e.key === 'ArrowUp') tr.previousElementSibling?.focus();
          } } },
        h('td', {}, h('span', { class: 'ico', 'aria-hidden': 'true' }, k.icon), nameOf(it.path)), h('td', {}, k.name));
        tr.dataset.path = it.path;
        tr.setAttribute('aria-selected', String(picked?.path === it.path));
        return tr;
      }))));
  }

  // ── the third pane ─────────────────────────────────────────────────────
  const drawDetail = (...kids) => $('detail').replaceChildren(...kids);

  let picking = 0;               // only the newest pick may draw
  async function pick(it) {
    const mine = ++picking;
    $('panes').dataset.show = it ? 'detail' : 'items';
    if (!it) { picked = null; drawDetail(h('p', { class: 'detail-none' }, 'Pick a file to see it here.')); return; }
    const k = kindOf(it);
    const head = h('div', { class: 'detail-head' }, h('h2', {}, `${k.icon} ${nameOf(it.path)}`), h('p', {}, k.name));
    const backBtn = h('button', { class: 'tool panes-back', type: 'button', on: { click: () => { $('panes').dataset.show = 'items'; } } }, 'Back to list');
    if (it.container) {
      picked = { path: it.path, container: true };
      drawDetail(head, h('div', { class: 'detail-actions' },
        h('button', { class: 'tool tool-main', type: 'button', on: { click: () => go(it.path) } }, 'Open'), backBtn,
        h('button', { class: 'tool danger', type: 'button', on: { click: askDelete } }, 'Delete')));
      markPicked();
      return;
    }
    const r = await foaf.pod.get(it.path);
    if (mine !== picking) return;
    if (r.reason === 'not-text') {
      // Rename and Delete act on `picked`, and rename needs the file's text, so neither is offered here.
      picked = null;
      markPicked();
      const offers = await openWithBox(it.path, r.contentType);
      if (mine !== picking) return;
      drawDetail(head, h('p', { class: 'detail-none' }, 'This kind of file has no preview here.'), offers, h('div', { class: 'detail-actions' }, backBtn));
      return;
    }
    if (!r.ok) { say(explain(r), true); drawDetail(head); return; }
    picked = { path: it.path, body: r.body, etag: r.etag, contentType: r.contentType || '', dirty: false };
    markPicked();
    const binary = /^(image|audio|video)\//.test(picked.contentType);
    if (binary) {
      drawDetail(head, h('p', { class: 'detail-none' }, 'This kind of file has no preview here.'), await openWithBox(it.path, picked.contentType), actions(backBtn));
      return;
    }
    const text = h('textarea', { value: r.body, spellcheck: false, 'aria-label': `Contents of ${nameOf(it.path)}`,
      on: { input: () => { picked.dirty = text.value !== picked.body; save.disabled = !picked.dirty; } } });
    const save = h('button', { class: 'tool tool-main', type: 'button', disabled: true, on: { click: () => saveFile(text.value, save) } }, 'Save');
    head.querySelector('p').textContent = `${k.name}, ${r.body.length.toLocaleString()} characters`;
    const offers = await openWithBox(it.path, picked.contentType);
    if (mine !== picking) return;
    drawDetail(head, h('div', { class: 'detail-body' }, text), offers, actions(backBtn, save));
  }

  // Apps that can open this file, each with its own comment: what a person or an
  // agent should know before choosing. Exploring: docs/foafos-open-with-20261105.md.
  async function openWithBox(path, contentType) {
    const r = await foaf.pod.handlers(path, contentType);
    if (!r.ok || !r.handlers?.length) return null;
    return h('div', { class: 'open-with' }, r.handlers.map((a) => h('div', { class: 'open-with-app' },
      h('button', { class: 'tool', type: 'button', on: { click: async () => {
        const o = await foaf.pod.openWith(a.appId, path, contentType);
        if (!o.ok) say(explain(o), true);
      } } }, `Open in ${a.name}`),
      a.comment ? h('p', { class: 'open-with-comment' }, a.comment) : null)));
  }
  const actions = (...first) => h('div', { class: 'detail-actions' }, ...first,
    h('button', { class: 'tool', type: 'button', on: { click: askRename } }, 'Rename'),
    h('button', { class: 'tool danger', type: 'button', on: { click: askDelete } }, 'Delete'));

  function markPicked() {
    for (const e of document.querySelectorAll('[aria-selected]')) e.setAttribute('aria-selected', String(e.dataset.path === picked?.path));
  }

  async function saveFile(value, btn) {
    const r = await foaf.pod.put(picked.path, value, { contentType: picked.contentType || 'text/plain', etag: picked.etag });
    if (!r.ok) { say(explain(r), true); return; }
    picked.etag = r.etag; picked.body = value; picked.dirty = false; btn.disabled = true;
    say(`Saved ${nameOf(picked.path)}.`);
  }

  // Questions are asked in the pane: a sandboxed frame has no reliable dialogs.
  function ask(label, action, { value = '', danger = false, input = true } = {}, done) {
    document.querySelector('.ask')?.remove();
    const field = input ? h('input', { type: 'text', value, 'aria-label': label }) : null;
    const close = () => bar.remove();
    const submit = async (e) => { e.preventDefault(); const v = field ? cleanName(field.value) : ''; if (input && !v) return; close(); await done(v); };
    const bar = h('form', { class: 'ask', on: { submit } }, input ? null : h('span', {}, label), field,
      h('button', { class: `tool ${danger ? 'danger' : 'tool-main'}`, type: 'submit' }, action),
      h('button', { class: 'tool', type: 'button', on: { click: close } }, 'Cancel'));
    statusEl.before(bar);
    (field || bar.querySelector('button')).focus();
    field?.select();
  }

  const askNewFile = () => ask('Name of the new file', 'Create', { value: 'untitled.txt' }, async (name) => {
    const path = folder + name;
    if (items.some((i) => i.path === path)) { say(`${name} exists already.`, true); return; }
    const r = await foaf.pod.put(path, '', { contentType: 'text/plain' });
    if (!r.ok) { say(explain(r), true); return; }
    await go(folder, { remember: false });
    pick({ path, container: false });
  });

  // A pod folder exists once something is in it, so a new one gets a hidden marker.
  const askNewFolder = () => ask('Name of the new folder', 'Create', { value: 'New folder' }, async (name) => {
    const r = await foaf.pod.put(`${folder}${name}/.folder`, '', { contentType: 'text/plain' });
    if (!r.ok) { say(explain(r), true); return; }
    await go(folder, { remember: false });
    say(`Created ${name}.`);
  });

  const askRename = () => ask('New name', 'Rename', { value: nameOf(picked.path) }, async (name) => {
    const to = parentOf(picked.path) + name;
    if (to === picked.path) return;
    const put = await foaf.pod.put(to, picked.body, { contentType: picked.contentType || 'text/plain' });
    if (!put.ok) { say(explain(put), true); return; }
    const del = await foaf.pod.delete(picked.path, picked.etag ? { etag: picked.etag } : {});
    if (!del.ok) say(`Copied to ${name}, but the old file is still there: ${explain(del)}`, true);
    await go(folder, { remember: false });
    pick({ path: to, container: false });
  });

  const askDelete = () => ask(`Delete ${nameOf(picked.path)}? This cannot be undone.`, 'Delete', { input: false, danger: true }, async () => {
    const name = nameOf(picked.path);
    let path = picked.path;
    if (picked.container) {
      const r = await list(path);
      const rest = (r.items || []).filter((i) => !hiddenName(i.path.replace(/\/$/, '')));
      if (rest.length) { say('Empty this folder before deleting it.', true); return; }
      await foaf.pod.delete(`${path}.folder`);
    }
    const r = await foaf.pod.delete(path, picked.etag ? { etag: picked.etag } : {});
    if (!r.ok) { say(explain(r), true); return; }
    await go(folder, { remember: false });
    say(`Deleted ${name}.`);
  });

  $('back').addEventListener('click', () => { if (trail.length) go(trail.pop(), { remember: false }); });
  $('up').addEventListener('click', () => go(parentOf(folder)));
  $('filter').addEventListener('input', drawItems);
  $('new-file').addEventListener('click', askNewFile);
  $('add-folder').addEventListener('click', addFolder);
  $('new-folder').addEventListener('click', askNewFolder);
  $('places').addEventListener('click', () => { const p = $('panes'); p.dataset.places = p.dataset.places === 'open' ? 'closed' : 'open'; });
  $('view').addEventListener('click', (e) => {
    icons = !icons;
    e.currentTarget.setAttribute('aria-pressed', String(icons));
    e.currentTarget.textContent = icons ? '☰' : '▦';
    e.currentTarget.setAttribute('aria-label', icons ? 'Show as a list' : 'Show as icons');
    drawItems();
  });

  pick(null);
  window.__files = { go, pick, useLocation, state: () => ({ folder, items, picked, current, locations, status: statusEl.textContent }) };

  // Tools for the shell and agents (foaf.tools in app-sdk.js). All three only read, from the
  // location Files has open, and none changes what the window shows.
  const fail = (r) => { throw new Error(explain(r)); };
  const folderPath = (p) => { const s = String(p ?? '').replace(/^\/+/, ''); return s && !s.endsWith('/') ? s + '/' : s; };
  const MAX_TEXT = 100000;
  foaf.tools.register({
    name: 'list_folder',
    description: 'What is in one folder of the location Files has open: each item\'s path and whether it is a folder. Hidden names (starting with ".") are left out.',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'A folder path such as "apps/podnotes/notes/"; empty for the top' } } },
    readOnly: true,
    handler: async ({ path = '' }) => {
      const base = folderPath(path);
      const r = await list(base);
      if (!r.ok) fail(r);
      return {
        location: here()?.label || null,
        folder: base,
        items: r.items.map((it) => ({ path: base + it.path.replace(/^\/+/, ''), folder: !!it.container }))
          .filter((it) => !hiddenName(nameOf(it.path))),
      };
    },
  });
  foaf.tools.register({
    name: 'search',
    description: 'Find files and folders whose name contains some text, in every folder of the location Files has open. Looks in up to 300 folders and returns up to 100 matches.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Text to find in names, in any case' } }, required: ['query'] },
    readOnly: true,
    handler: async ({ query }) => {
      const q = String(query).trim().toLowerCase();
      if (!q) throw new Error('Give some text to search for.');
      const found = [], queue = [''];
      let seen = 0;
      while (queue.length && seen < 300 && found.length < 100) {
        const base = queue.shift();
        seen++;
        const r = await list(base);
        if (!r.ok) continue;
        for (const it of r.items) {
          const p = base + it.path.replace(/^\/+/, '');
          if (hiddenName(nameOf(p))) continue;
          if (it.container) queue.push(p);
          if (nameOf(p).toLowerCase().includes(q) && found.length < 100) found.push({ path: p, folder: !!it.container });
        }
      }
      return { query: q, found, complete: !queue.length };
    },
  });
  foaf.tools.register({
    name: 'read_file',
    description: `The text of one file in the location Files has open, with its content type. Text files only; at most ${MAX_TEXT.toLocaleString('en')} characters are returned. Hidden files and anything in a hidden folder (a name starting with ".") are refused.`,
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'A file path from list_folder or search' } }, required: ['path'] },
    readOnly: true,
    handler: async ({ path }) => {
      const clean = String(path ?? '').replace(/^\/+/, '');
      if (!clean) throw new Error('Give the path of a file.');
      const hidden = clean.split('/').find((part) => hiddenName(part));
      if (hidden) throw new Error(`${path} is hidden (${hidden} starts with "."). read_file does not read hidden files or folders.`);
      const r = await foaf.pod.get(clean);
      if (!r.ok) {
        if (r.reason === 'not-text') throw new Error(`${path} is not a text file (${r.contentType || 'unknown type'}).`);
        if (r.status === 404) throw new Error(`No file at ${path}.`);
        fail(r);
      }
      const truncated = r.body.length > MAX_TEXT;
      return { path, contentType: r.contentType || null, length: r.body.length, truncated, text: truncated ? r.body.slice(0, MAX_TEXT) : r.body };
    },
  });
  foaf.onInit(async () => {
    takeLocations(await foaf.pod.locations());
    await go('', { remember: false });
    takeLocations(await foaf.pod.locations());   // a location opens on first use, so its status may have changed
  });
})();
