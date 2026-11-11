// Files: the person's locations as folders and files, through foafos.pod.* only.
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
  // The view and the sort order are kept for next time, in the shell's store for this app (the
  // `storage` power). The SDK's localStorage stand-in is filled when the shell says hello, so the
  // kept view is applied in onInit, which also runs if that has already happened.
  const VIEW_KEY = 'files.view';
  let icons = false;
  let sort = { key: 'name', dir: 1 };
  const keepView = () => { try { localStorage.setItem(VIEW_KEY, JSON.stringify({ icons, sort })); } catch { /* not kept */ } };
  const trail = [];
  const children = new Map();    // folder -> subfolders, for the tree
  const expanded = new Set(['']);

  async function list(path) {
    const r = await foafos.pod.list(path);
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
    if (r.reason === 'needs-ok') takeLocations(await foafos.pod.locations());
    if (!r.ok) { say(explain(r), true); return; }
    if (path !== folder) dropThumbs();
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

  async function useLocation(id) { await showLocation(await foafos.pod.use(id)); }

  async function showLocation(r) {
    takeLocations(r);
    folder = ''; items = []; trail.length = 0; children.clear(); expanded.clear(); expanded.add(''); pick(null);
    drawItems(); drawTree();
    if (!r.ok) { say(explain(r), true); return; }
    say('');
    $('panes').dataset.places = 'closed';
    await go('', { remember: false });
    takeLocations(await foafos.pod.locations());
  }

  async function addFolder() {
    const r = await foafos.pod.addFolder();
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
        const btn = h('button', { type: 'button', role: 'option', 'aria-selected': String(picked?.path === it.path),
          on: { click: () => (it.container ? pick(it) : activate(it)), dblclick: () => activate(it), keydown: (e) => { if (e.key === 'Enter') activate(it); } } },
        icoFor(it, k), nameOf(it.path));
        btn.dataset.path = it.path;
        return btn;
      })));
      return;
    }
    const head = (key, label) => h('th', { scope: 'col' }, h('button', { type: 'button', on: { click: () => { sort = { key, dir: sort.key === key ? -sort.dir : 1 }; keepView(); drawItems(); } } },
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
        h('td', {}, icoFor(it, k), nameOf(it.path)), h('td', {}, k.name));
        tr.dataset.path = it.path;
        tr.setAttribute('aria-selected', String(picked?.path === it.path));
        return tr;
      }))));
  }

  // ── the third pane ─────────────────────────────────────────────────────
  // A part that is not there (no app offers to open the file) is left out, not written as "null".
  const drawDetail = (...kids) => $('detail').replaceChildren(...kids.filter((k) => k != null));

  // ── thumbnails ───────────────────────────────────────────────────────
  // An image in the list shows a small picture of itself. Only what scrolls into view is
  // fetched, at most three at a time; each is shrunk to 160px and the full bytes dropped, so a
  // folder of photos costs little. Kept per path and ETag; released on leaving the folder.
  const IMAGE_NAME = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;
  const thumbs = new Map();      // path → { url, etag }
  const thumbWait = [];          // [el, path]
  let thumbBusy = 0;
  const thumbSeen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      thumbSeen.unobserve(e.target);
      thumbWait.push([e.target, e.target.dataset.thumb]);
    }
    pumpThumbs();
  }, { rootMargin: '200px' });
  async function shrink(bytes, type) {
    const blob = new Blob([bytes], { type });
    if (/svg/.test(type) || typeof createImageBitmap !== 'function') return URL.createObjectURL(blob);
    const bmp = await createImageBitmap(blob);
    const s = Math.min(1, 160 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * s)), h2 = Math.max(1, Math.round(bmp.height * s));
    const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h2) : Object.assign(document.createElement('canvas'), { width: w, height: h2 });
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h2);
    bmp.close?.();
    const out = canvas.convertToBlob ? await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 })
      : await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.8));
    return URL.createObjectURL(out);
  }
  async function pumpThumbs() {
    while (thumbBusy < 3 && thumbWait.length) {
      const [el, path] = thumbWait.shift();
      if (!el.isConnected || thumbs.has(path)) { if (thumbs.has(path)) showThumb(el, path); continue; }
      thumbBusy++;
      (async () => {
        try {
          const r = await foafos.pod.get(path, { as: 'bytes' });
          if (r.ok) thumbs.set(path, { url: await shrink(r.body, r.contentType || 'image/png'), etag: r.etag });
        } catch { /* no thumbnail: the icon stays */ }
        thumbBusy--;
        for (const x of document.querySelectorAll(`[data-thumb="${CSS.escape(path)}"]`)) showThumb(x, path);
        pumpThumbs();
      })();
    }
  }
  function showThumb(el, path) {
    const t = thumbs.get(path);
    if (!t || el.querySelector('img')) return;
    el.replaceChildren(h('img', { src: t.url, alt: '', decoding: 'async' }));
    el.classList.add('thumb');
  }
  const icoFor = (it, k) => {
    const el = h('span', { class: 'ico', 'aria-hidden': 'true' }, k.icon);
    if (!it.container && IMAGE_NAME.test(it.path)) {
      el.dataset.thumb = it.path;
      if (thumbs.has(it.path)) showThumb(el, it.path); else thumbSeen.observe(el);
    }
    return el;
  };
  const forgetThumb = (path) => { const t = thumbs.get(path); if (t) { URL.revokeObjectURL(t.url); thumbs.delete(path); } };
  const dropThumbs = () => { for (const t of thumbs.values()) URL.revokeObjectURL(t.url); thumbs.clear(); thumbWait.length = 0; };

  let picking = 0;               // only the newest pick may draw
  let previewUrl = null;         // the image on show, released when another is picked
  const sizeText = (n) => (n < 1024 ? `${n} bytes` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
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
    const r = await foafos.pod.get(it.path);
    if (mine !== picking) return;
    if (r.reason === 'not-text') {
      // Not text: read it as bytes, so it can be shown if it is an image, and renamed or deleted.
      const raw = await foafos.pod.get(it.path, { as: 'bytes' });
      if (mine !== picking) return;
      if (!raw.ok) {
        picked = null;
        markPicked();
        const offers = await openWithBox(it.path, r.contentType);
        if (mine !== picking) return;
        drawDetail(head, h('p', { class: 'detail-none' }, raw.reason === 'too-large' ? 'This file is too large to show here.' : 'This kind of file has no preview here.'), offers, h('div', { class: 'detail-actions' }, backBtn));
        return;
      }
      const type = raw.contentType || r.contentType || '';
      picked = { path: it.path, body: raw.body, etag: raw.etag, contentType: type, dirty: false };
      markPicked();
      head.querySelector('p').textContent = `${k.name}, ${sizeText(raw.body.byteLength)}`;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = /^image\//.test(type) ? URL.createObjectURL(new Blob([raw.body], { type })) : null;
      const view = previewUrl
        ? h('div', { class: 'detail-body detail-image' }, h('img', { src: previewUrl, alt: nameOf(it.path) }))
        : h('p', { class: 'detail-none' }, 'This kind of file has no preview here.');
      const offers = await openWithBox(it.path, type);
      if (mine !== picking) return;
      drawDetail(head, view, offers, actions(backBtn));
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
    const r = await foafos.pod.handlers(path, contentType);
    if (!r.ok || !r.handlers?.length) return null;
    return h('div', { class: 'open-with' }, r.handlers.map((a) => h('div', { class: 'open-with-app' },
      h('button', { class: 'tool', type: 'button', on: { click: async () => {
        const o = await foafos.pod.openWith(a.appId, path, contentType);
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
    const r = await foafos.pod.put(picked.path, value, { contentType: picked.contentType || 'text/plain', etag: picked.etag });
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
    const bar = h('form', { class: 'ask', on: { submit, keydown: (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } } } }, input ? null : h('span', {}, label), field,
      h('button', { class: `tool ${danger ? 'danger' : 'tool-main'}`, type: 'submit' }, action),
      h('button', { class: 'tool', type: 'button', on: { click: close } }, 'Cancel'));
    statusEl.before(bar);
    // A question that destroys something starts on Cancel, as Places does, so Enter alone cannot delete.
    (field || (danger ? bar.querySelector('button[type=button]') : bar.querySelector('button'))).focus();
    field?.select();
  }

  const askNewFile = () => ask('Name of the new file', 'Create', { value: 'untitled.txt' }, async (name) => {
    const path = folder + name;
    if (items.some((i) => i.path === path)) { say(`${name} exists already.`, true); return; }
    const r = await foafos.pod.put(path, '', { contentType: 'text/plain' });
    if (!r.ok) { say(explain(r), true); return; }
    await go(folder, { remember: false });
    pick({ path, container: false });
  });

  // A pod folder exists once something is in it, so a new one gets a hidden marker.
  const askNewFolder = () => ask('Name of the new folder', 'Create', { value: 'New folder' }, async (name) => {
    const r = await foafos.pod.put(`${folder}${name}/.folder`, '', { contentType: 'text/plain' });
    if (!r.ok) { say(explain(r), true); return; }
    await go(folder, { remember: false });
    say(`Created ${name}.`);
  });

  const askRename = () => ask('New name', 'Rename', { value: nameOf(picked.path) }, async (name) => {
    const to = parentOf(picked.path) + name;
    if (to === picked.path) return;
    forgetThumb(to); forgetThumb(picked.path);
    const put = await foafos.pod.put(to, picked.body, { contentType: picked.contentType || 'text/plain' });
    if (!put.ok) { say(explain(put), true); return; }
    const del = await foafos.pod.delete(picked.path, picked.etag ? { etag: picked.etag } : {});
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
      await foafos.pod.delete(`${path}.folder`);
    }
    forgetThumb(path);
    const r = await foafos.pod.delete(path, picked.etag ? { etag: picked.etag } : {});
    if (!r.ok) { say(explain(r), true); return; }
    await go(folder, { remember: false });
    say(`Deleted ${name}.`);
  });

  $('back').addEventListener('click', () => { if (trail.length) go(trail.pop(), { remember: false }); });
  $('up').addEventListener('click', () => go(parentOf(folder)));
  // Keys in the list, as in a desktop file browser: Backspace or Alt+Up goes up a
  // folder, Home and End go to the first and last item. Arrow keys move in the grid too.
  $('items').addEventListener('keydown', async (e) => {
    if (e.target.closest('input, textarea, select')) return;
    const rows = [...$('items').querySelectorAll('tbody tr, .grid [role=option]')];
    const at = rows.indexOf(e.target);
    // Space shows the item in the side panel without opening it, as a Mac's Quick Look does.
    if (at >= 0 && e.key === ' ' && !e.target.matches('button')) {
      e.preventDefault();
      const it = items.find((i) => i.path === e.target.dataset.path);
      if (it) { await pick(it); e.target.focus(); }
      return;
    }
    // Delete (Cmd+Backspace on a Mac) asks to delete the item the keyboard is on; F2 renames it.
    if (at >= 0 && (e.key === 'Delete' || (e.metaKey && e.key === 'Backspace') || e.key === 'F2')) {
      e.preventDefault();
      const it = items.find((i) => i.path === e.target.dataset.path);
      if (!it) return;
      await pick(it);
      if (picked?.path !== it.path) { say('This kind of file cannot be renamed or deleted here.', true); return; }
      if (e.key === 'F2') { if (!it.container) askRename(); } else askDelete();
      return;
    }
    if ((e.key === 'Backspace' || (e.altKey && e.key === 'ArrowUp')) && folder) {
      e.preventDefault();
      const from = folder;
      await go(parentOf(folder));
      const back = [...$('items').querySelectorAll('tbody tr')].find((r) => r.dataset.path === from);
      (back || $('items').querySelector('tbody tr, .grid [role=option]'))?.focus();
      return;
    }
    if (at < 0) return;
    // In the grid, Up and Down go to the nearest item in the row above or below.
    const vertical = (dir) => {
      const r0 = e.target.getBoundingClientRect();
      const cands = rows.map((r, i) => [i, r.getBoundingClientRect()])
        .filter(([, r]) => (dir > 0 ? r.top > r0.top + 2 : r.top < r0.top - 2));
      if (!cands.length) return undefined;
      const rowTop = dir > 0 ? Math.min(...cands.map(([, r]) => r.top)) : Math.max(...cands.map(([, r]) => r.top));
      return cands.filter(([, r]) => Math.abs(r.top - rowTop) < 2)
        .sort(([, a], [, b]) => Math.abs(a.left - r0.left) - Math.abs(b.left - r0.left))[0][0];
    };
    const inGrid = e.target.matches('[role=option]');
    const to = { Home: 0, End: rows.length - 1 }[e.key]
      ?? (inGrid ? { ArrowRight: at + 1, ArrowLeft: at - 1 }[e.key] : undefined)
      ?? (inGrid && (e.key === 'ArrowDown' || e.key === 'ArrowUp') ? vertical(e.key === 'ArrowDown' ? 1 : -1) : undefined);
    if (to !== undefined && rows[to]) { e.preventDefault(); rows[to].focus(); }
  });
  // Type-ahead, as in a desktop file browser: letters typed quickly in the list
  // jump to the first item whose name starts with them.
  let typed = '', typedAt = 0;
  $('items').addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key.length !== 1 || e.key === ' ') return;
    const now = Date.now();
    typed = (now - typedAt > 800 ? '' : typed) + e.key.toLowerCase();
    typedAt = now;
    const rows = [...$('items').querySelectorAll('tbody tr, .grid [role=option]')];
    const name = (r) => (r.dataset.path ? nameOf(r.dataset.path) : r.textContent).toLowerCase();
    const hit = rows.find((r) => name(r).startsWith(typed));
    if (hit) { e.preventDefault(); hit.focus(); }
  });
  $('filter').addEventListener('input', drawItems);
  // From the filter: Down moves into the list, Enter opens the top match (as in All apps).
  $('filter').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'Enter') return;
    const first = $('items').querySelector('tbody tr, .grid [role=option]');
    if (!first) return;
    e.preventDefault();
    first.focus();
    if (e.key === 'Enter') { const it = shown()[0]; if (it) activate(it); }
  });
  // Drop files from the computer onto the list to add them to this folder: text up to 1 MiB,
  // anything else up to 8 MiB. A larger file is named and left out rather than silently lost.
  const pane = $('items-pane');
  pane.addEventListener('dragover', (e) => {
    if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    pane.classList.add('dropping');
  });
  pane.addEventListener('dragleave', (e) => { if (!pane.contains(e.relatedTarget)) pane.classList.remove('dropping'); });
  pane.addEventListener('drop', async (e) => {
    const files = [...(e.dataTransfer?.files || [])];
    if (!files.length) return;
    e.preventDefault();
    pane.classList.remove('dropping');
    const added = [], left = [];
    for (const f of files) {
      const texty = /^text\/|json|xml|javascript|turtle|n-triples|markdown/.test(f.type) || /\.(txt|md|csv|json|ttl|nt|jsonld|html?|css|js|mjs|xml|svg|ya?ml|log)$/i.test(f.name);
      // Text up to 1 MiB goes as text; anything else up to 8 MiB as bytes.
      if (f.size > (texty ? 1024 * 1024 : 8 * 1024 * 1024)) { left.push(f.name); continue; }
      const name = cleanName(f.name);
      forgetThumb(folder + name);
      const r = await foafos.pod.put(folder + name, texty ? await f.text() : await f.arrayBuffer(),
        { contentType: f.type || (texty ? 'text/plain' : 'application/octet-stream') });
      (r.ok ? added : left).push(name);
    }
    await go(folder, { remember: false });
    say([added.length ? `Added ${added.join(', ')}.` : '', left.length ? `Not added (too large: text up to 1 MiB, other files up to 8 MiB): ${left.join(', ')}.` : ''].filter(Boolean).join(' '), !!left.length && !added.length);
  });

  $('new-file').addEventListener('click', askNewFile);
  $('add-folder').addEventListener('click', addFolder);
  $('new-folder').addEventListener('click', askNewFolder);
  $('places').addEventListener('click', () => { const p = $('panes'); p.dataset.places = p.dataset.places === 'open' ? 'closed' : 'open'; });
  $('view').addEventListener('click', (e) => {
    icons = !icons;
    keepView();
    e.currentTarget.setAttribute('aria-pressed', String(icons));
    e.currentTarget.textContent = icons ? '☰' : '▦';
    e.currentTarget.setAttribute('aria-label', icons ? 'Show as a list' : 'Show as icons');
    drawItems();
  });
  foafos.onInit?.(() => {
    let kept = {};
    try { kept = JSON.parse(localStorage.getItem(VIEW_KEY)) || {}; } catch { /* the defaults */ }
    if (['name', 'kind'].includes(kept.sort?.key) && [1, -1].includes(kept.sort?.dir)) sort = kept.sort;
    icons = kept.icons === true;
    $('view').setAttribute('aria-pressed', String(icons));
    $('view').textContent = icons ? '☰' : '▦';
    $('view').setAttribute('aria-label', icons ? 'Show as a list' : 'Show as icons');
    drawItems();
  });

  pick(null);
  window.__files = { go, pick, useLocation, state: () => ({ folder, items, picked, current, locations, status: statusEl.textContent }) };

  // Tools for the shell and agents (foafos.tools in app-sdk.js). All three only read, from the
  // location Files has open, and none changes what the window shows.
  const fail = (r) => { throw new Error(explain(r)); };
  const folderPath = (p) => { const s = String(p ?? '').replace(/^\/+/, ''); return s && !s.endsWith('/') ? s + '/' : s; };
  const MAX_TEXT = 100000;
  foafos.tools.register({
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
  foafos.tools.register({
    name: 'search',
    description: 'Find files and folders whose name contains some text, in every folder of the location Files has open. Looks in up to 300 folders and returns up to 100 matches. "skipped" lists folders that could not be read, with the reason; "complete" is true only when every folder was read and no match was left out. Hidden names (starting with ".") are left out.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Text to find in names, in any case' } }, required: ['query'] },
    readOnly: true,
    handler: async ({ query }) => {
      const q = String(query).trim().toLowerCase();
      if (!q) throw new Error('Give some text to search for.');
      const found = [], queue = [''], skipped = [];
      let seen = 0, dropped = false;
      while (queue.length && seen < 300 && found.length < 100) {
        const base = queue.shift();
        seen++;
        const r = await list(base);
        if (!r.ok) { skipped.push({ path: base, reason: explain(r) }); continue; }
        for (const it of r.items) {
          const p = base + it.path.replace(/^\/+/, '');
          if (hiddenName(nameOf(p))) continue;
          if (it.container) queue.push(p);
          if (nameOf(p).toLowerCase().includes(q)) {
            if (found.length < 100) found.push({ path: p, folder: !!it.container });
            else dropped = true;
          }
        }
      }
      return { query: q, found, skipped, searched: seen, notSearched: queue.length, complete: !queue.length && !skipped.length && !dropped };
    },
  });
  foafos.tools.register({
    name: 'read_file',
    description: `The text of one file in the location Files has open, with its content type. Text files only; at most ${MAX_TEXT.toLocaleString('en')} characters are returned. Hidden files and anything in a hidden folder (a name starting with ".") are refused.`,
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'A file path from list_folder or search' } }, required: ['path'] },
    readOnly: true,
    handler: async ({ path }) => {
      const clean = String(path ?? '').replace(/^\/+/, '');
      if (!clean) throw new Error('Give the path of a file.');
      const hidden = clean.split('/').find((part) => hiddenName(part));
      if (hidden) throw new Error(`${path} is hidden (${hidden} starts with "."). read_file does not read hidden files or folders.`);
      const r = await foafos.pod.get(clean);
      if (!r.ok) {
        if (r.reason === 'not-text') throw new Error(`${path} is not a text file (${r.contentType || 'unknown type'}).`);
        if (r.status === 404) throw new Error(`No file at ${path}.`);
        fail(r);
      }
      const truncated = r.body.length > MAX_TEXT;
      return { path, contentType: r.contentType || null, length: r.body.length, truncated, text: truncated ? r.body.slice(0, MAX_TEXT) : r.body };
    },
  });
  foafos.onInit(async () => {
    takeLocations(await foafos.pod.locations());
    await go('', { remember: false });
    takeLocations(await foafos.pod.locations());   // a location opens on first use, so its status may have changed
  });
})();
