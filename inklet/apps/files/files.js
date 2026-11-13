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
    'read-only': 'This is inside an archive, which is read only.',
    'too-deep': 'Archives inside archives open three deep at most.',
    'bad-archive': 'This archive could not be read: it may be damaged, or a kind this view does not open.',
    'not-supported': 'This archive uses something this view does not read (encryption, or an unusual compression).',
    quota: 'This location is out of space: its owner set a limit, and this would go over it. Free some space, or raise the limit in System, under Pods.',
    offline: 'That location is not connected.',
    'needs-ok': 'This folder needs your OK. Use Allow access.',
    locked: 'This location is locked. Unlock your session first.',
    error: 'That location cannot be reached.',
    cancelled: 'No folder was chosen.',
    'no-folder': 'That folder could not be added.',
    'too-large': 'This file is too large to open here.',
  };
  const say = (text, bad = false) => { statusEl.textContent = text; statusEl.classList.toggle('bad', bad); };
  // A pod takes so many calls a minute from an app. Rather than fail a step in the middle of a copy,
  // a move or a delete of many files, a call it answers "throttled" waits and asks again, for up to
  // about a minute and a half, as a desktop's copy of many files takes its time.
  const paced = (call, { wait = 2000, tries = 45, onWait = () => say('Waiting for the pod: it takes a limited number of calls a minute.') } = {}) => async (...args) => {
    let r = await call(...args);
    for (let t = 0; r && !r.ok && r.reason === 'throttled' && t < tries; t++) {
      onWait();
      await new Promise((ok) => setTimeout(ok, wait));
      r = await call(...args);
    }
    return r;
  };
  if (window.foafos?.pod) for (const verb of ['get', 'put', 'delete', 'list']) {
    if (typeof foafos.pod[verb] === 'function') foafos.pod[verb] = paced(foafos.pod[verb].bind(foafos.pod));
  }
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
    [/\.(zip|tar|tgz|tar\.gz)$/i, '🗜', 'Archive'], [/\.(png|jpe?g|gif|webp|avif)$/i, '🖼', 'Image'], [/\.(mp3|wav|ogg|oga|opus|m4a|aac|flac)$/i, '♪', 'Audio'], [/\.(mp4|m4v|webm|ogv|mov)$/i, '🎞', 'Video'],
    [/\.pdf$/i, '📕', 'PDF'],
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
  // Hidden names (starting with a dot) are left out, as on every desktop, unless Show hidden files
  // is on (Finder's Cmd + Shift + ., Explorer's Hidden items). A folder's own .folder marker never
  // shows: it is how an empty folder is kept, not a file of the person's.
  let showHidden = false;
  const listed = (n) => n !== '.folder' && (showHidden || !hiddenName(n));

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
  // Icon size in the icon view, as Finder's and Explorer's: Ctrl or Cmd + plus and minus, or Ctrl +
  // the wheel; kept with the view. Five steps, from small to large.
  const ZOOMS = [0.75, 1, 1.35, 1.75, 2.25];
  let zoom = 1;
  const applyZoom = () => document.querySelector('#items .grid')?.style.setProperty('--zoom', String(zoom));
  const stepZoom = (d) => {
    const i = Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + d));
    if (ZOOMS[i] === zoom) return;
    zoom = ZOOMS[i]; applyZoom(); keepView();
    say(`Icons ${['smallest', 'small', 'medium', 'large', 'largest'][i]}.`);
  };
  let sort = { key: 'name', dir: 1 };
  // In a narrow window the list has no column heads to sort by: a Sort picker, as phone file
  // managers have, says how it is sorted and changes it.
  const showSort = () => { const v = `${sort.key}:${sort.dir}`; const sel = document.getElementById('sort-pick'); if (sel && [...sel.options].some((o) => o.value === v)) sel.value = v; };
  document.getElementById('sort-pick')?.addEventListener('change', (e) => {
    const [key, dir] = e.target.value.split(':');
    sort = { key, dir: Number(dir) }; recentOrder = false; keepView(); drawItems();
  });
  const keepView = () => { try { localStorage.setItem(VIEW_KEY, JSON.stringify({ icons, sort, zoom, showHidden })); } catch { /* not kept */ } };
  const toggleHidden = async () => {
    showHidden = !showHidden; keepView();
    await go(folder, { remember: false });
    say(showHidden ? 'Hidden files are shown (names starting with a dot).' : 'Hidden files are hidden again.');
  };
  // The folder you were in, for each location, so Files opens there again, as a desktop's file
  // manager does. A folder that has gone since opens the top instead, without a complaint.
  const FOLDER_KEY = 'files.folder';
  const keptFolders = () => { try { return JSON.parse(localStorage.getItem(FOLDER_KEY)) || {}; } catch { return {}; } };
  const keepFolder = () => { if (!current) return; try { localStorage.setItem(FOLDER_KEY, JSON.stringify({ ...keptFolders(), [current]: folder })); } catch { /* not kept */ } };
  async function openKept() {
    const want = keptFolders()[current] || '';
    // Some stores list a folder that is not there as empty, so the folder must be in its parent.
    if (want) {
      const up = await list(parentOf(want));
      const there = up.ok && up.items.some((it) => (parentOf(want) + it.path.replace(/^\/+/, '')) === want);
      if (there) { await go(want, { remember: false }); return; }
    }
    await go('', { remember: false });
  }
  const trail = [];
  const ahead = [];   // where Forward goes, after Back
  // Several items chosen at once, as in a desktop's file manager: Ctrl or Cmd + click adds or
  // removes one, Shift + click takes a run from the last one clicked, Ctrl or Cmd + A takes all
  // shown. Delete then deletes the chosen files after one question. A plain click, Escape or
  // another folder clears it.
  const chosen = new Set();
  let anchor = null;
  const markChosen = () => {
    for (const r of document.querySelectorAll('#items tbody tr, #items .grid [role=option]')) {
      const on = chosen.has(r.dataset.path);
      r.classList.toggle('chosen', on);
      r.setAttribute('aria-selected', String(on || (!chosen.size && picked?.path === r.dataset.path)));
    }
    // The keys are named only where there is a keyboard; a phone has the bar below.
    if (chosen.size) say(touchOnly ? `${chosen.size} chosen.` : `${chosen.size} chosen. Delete to delete them, Escape to clear.`);
    drawChooseBar();
  };
  // A bar for what is chosen and what is held, so all of it works without a keyboard (a phone):
  // Copy, Cut, Delete and Clear for the chosen; Paste here for what was copied or cut.
  const heldAll = () => [...(held?.paths || []), ...(held?.folders || [])];
  function drawChooseBar() {
    let bar = $('choosebar');
    if (!bar) {
      bar = h('div', { id: 'choosebar', class: 'choosebar', role: 'toolbar', 'aria-label': 'Chosen items' });
      statusEl.before(bar);
    }
    const holding = held && !held.gone && !trashView;
    bar.hidden = !chosen.size && !holding && !lastTrashed.length && !trashView;
    const btn = (label, run, extra = {}) => h('button', { type: 'button', class: 'tool', on: { click: run }, ...extra }, label);
    bar.replaceChildren(...[
      chosen.size ? h('span', { class: 'choose-n' }, `${chosen.size} chosen`) : null,
      chosen.size ? btn('Copy', () => holdChosen(false)) : null,
      chosen.size ? btn('Download', () => download([...chosen])) : null,
      chosen.size && !inArchive() ? btn('Compress', () => compress([...chosen])) : null,
      chosen.size && !inArchive() ? btn('Cut', () => holdChosen(true)) : null,
      chosen.size && !inArchive() ? btn('Delete', askDeleteChosen, { class: 'tool danger' }) : null,
      chosen.size ? btn('Clear', () => { clearChosen(); say(folderSummary()); }) : null,
      lastTrashed.length && !trashView ? btn('Undo', () => undoTrash(), { class: 'tool tool-main' }) : null,
      trashView ? btn('Empty Trash', () => emptyTrash(), { class: 'tool danger' }) : null,
      holding && !inArchive() ? btn(`Paste ${heldAll().length === 1 ? nameOf(heldAll()[0]) : `${heldAll().length} items`} here`, () => pasteHeld(), { class: 'tool tool-main' }) : null,
    ].filter(Boolean));
  }
  // A click in the list or the icon view: with Ctrl or Cmd it adds or removes, with Shift it takes a run.
  function clickItem(e, it) {
    if (e.pointerType === 'touch' && chosen.size) { chosen.has(it.path) ? chosen.delete(it.path) : chosen.add(it.path); markChosen(); if (!chosen.size) say(folderSummary()); return; }
    if (e.metaKey || e.ctrlKey) { if (!chosen.size && picked?.path && picked.path !== it.path) chosen.add(picked.path); chosen.has(it.path) ? chosen.delete(it.path) : chosen.add(it.path); anchor = it.path; markChosen(); return; }
    if (e.shiftKey && anchor) {
      const paths = shown().map((x) => x.path), a = paths.indexOf(anchor), b = paths.indexOf(it.path);
      if (a >= 0 && b >= 0) { chosen.clear(); for (const p of paths.slice(Math.min(a, b), Math.max(a, b) + 1)) chosen.add(p); markChosen(); return; }
    }
    clearChosen(); anchor = it.path;
    return it.container || ARCHIVE.test(it.path) ? pick(it) : activate(it);
  }
  const clearChosen = () => { if (!chosen.size) return; chosen.clear(); markChosen(); };
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
  // What a desktop's status bar says of a folder: how many items, what its files take, and, where
  // the owner set a limit, how much room is left.
  function folderSummary() {
    const n = items.length;
    if (!n) return 'This folder is empty.';
    const bytes = items.reduce((t, i) => t + (i.container ? 0 : i.size || 0), 0);
    const space = here()?.space;
    const left = space?.limit && space.used != null ? `, ${sizeText(Math.max(0, space.limit - space.used))} free of ${sizeText(space.limit)}` : '';
    return `${n} item${n === 1 ? '' : 's'}${bytes ? `, ${sizeText(bytes)}` : ''}${left}`;
  }
  async function go(path, { remember = true, via = null } = {}) {
    const mine = ++listing;
    const r = await list(path);
    if (mine !== listing) return;
    if (r.reason === 'needs-ok') takeLocations(await foafos.pod.locations());
    if (!r.ok) { say(explain(r), true); return; }
    searchResults = false; kindFilter = null;
    if (path !== folder) dropThumbs();
    // Back and Forward, as in a browser: a new place clears Forward.
    if (path !== folder && via === 'back') ahead.push(folder);
    else if (path !== folder && (remember || via === 'forward')) { trail.push(folder); if (via !== 'forward') ahead.length = 0; }
    folder = path;
    keepFolder();
    chosen.clear(); anchor = null;
    queueMicrotask(drawChooseBar);
    // Inside an archive nothing can be made, saved or dropped.
    for (const id of ['new-file', 'new-folder', 'upload', 'upload-dir']) $(id).disabled = inArchive();
    recentOrder = false; trashView = false;
    items = r.items.map((it) => ({ ...it, path: folder + it.path.replace(/^\/+/, '') }))
      .filter((it) => listed(nameOf(it.path)));
    children.set(folder, items.filter((i) => i.container).map((i) => i.path));
    for (let p = folder; ; p = parentOf(p)) { expanded.add(p); if (!p) break; }
    pick(null);
    draw();
    say(folderSummary());
    // The room left changes with every write, anywhere: ask again, after the list is drawn.
    // Only the figure changes: nothing is redrawn, so the keyboard stays where it is.
    foafos.pod.locations().then((loc) => {
      const now = loc?.ok && loc.locations?.find((l) => l.id === current), was = here();
      if (mine !== listing || !now || !was) return;
      was.space = now.space;
      if (now.space && !statusEl.classList.contains('bad')) say(folderSummary());
    }, () => {});
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
    // And inside files: the shell's text search over the pod, with a line from each.
    const inside = await foafos.pod.search(q, { limit: 100 });
    if (mine !== listing) return;
    let inFiles = 0;
    for (const hit of inside.ok ? inside.hits : []) {
      if (hit.path.split('/').some((seg) => seg.startsWith('.'))) continue;   // hidden, such as the Trash
      const had = found.find((f) => f.path === hit.path);
      if (had) had.snippet = hit.snippet;
      else { found.push({ path: hit.path, container: false, snippet: hit.snippet }); inFiles++; }
    }
    items = found;
    searchResults = true; kindFilter = null;
    recentOrder = false;
    pick(null);
    draw();
    const cut = queue.length ? `, after ${seen} folders` : '';
    say(`${found.length} found in all folders${cut}${inFiles ? `, ${inFiles} by what is in them` : ''}`);
  }

  let searchResults = false;
  // In search results, a row of kinds narrows them, as Finder's and Explorer's search filters do.
  const KIND_GROUPS = [['Folders', ['Folder']], ['Pictures', ['Image']], ['Documents', ['Text', 'PDF', 'Table']],
    ['Sound and video', ['Audio', 'Video']], ['Code and data', ['Code', 'JSON', 'Linked data']], ['Archives', ['Archive']]];
  let kindFilter = null;
  let recentOrder = false;       // the list is Recent: newest first, not sorted     // the list holds search results: the filter does not narrow them again
  const NAME_ORDER = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  function shown() {
    const q = searchResults ? '' : $('filter').value.trim().toLowerCase();
    const group = kindFilter && KIND_GROUPS.find(([g]) => g === kindFilter)?.[1];
    const rows = items.filter((i) => (!q || nameOf(i.path).toLowerCase().includes(q)) && (!group || group.includes(kindOf(i).name)));
    if (recentOrder) return rows;             // Recent keeps the order they were opened in
    // Names in the order people expect, as Finder and Explorer sort: "Photo 2" before "Photo 10".
    const byName = (a, b) => NAME_ORDER.compare(nameOf(a.path), nameOf(b.path));
    const cmp = sort.key === 'kind' ? (a, b) => NAME_ORDER.compare(kindOf(a).name, kindOf(b).name)
      : sort.key === 'size' ? (a, b) => (a.size ?? -1) - (b.size ?? -1)
      : sort.key === 'modified' ? (a, b) => String(a.modified || '').localeCompare(String(b.modified || ''))
      : byName;
    return rows.sort((a, b) => (b.container - a.container) || (cmp(a, b) * sort.dir) || byName(a, b));
  }

  function draw() {
    $('back').disabled = !trail.length;
    $('forward').disabled = !ahead.length;
    $('up').disabled = !folder;
    const parts = folder.split('/').filter(Boolean);
    // The window's title says which folder is open, so two Files windows can be told apart.
    foafos.setTitle?.(trashView ? 'Trash' : searchResults ? 'Search' : parts.length ? parts.at(-1).replace(/!$/, '') : (here()?.label || ''));
    $('crumbs').replaceChildren(h('li', {}, h('button', { type: 'button', on: { click: () => (folder ? go('') : askGoTo()) } }, here()?.label || 'My files')),
      ...parts.map((p, i) => h('li', {}, h('button', { type: 'button', ...(i === parts.length - 1 ? { title: 'Go to another folder by typing its path (/)' } : {}),
        on: { click: () => (i === parts.length - 1 && !inArchive() ? askGoTo() : go(parts.slice(0, i + 1).join('/') + '/')) } }, p.endsWith('!') ? `🗜 ${p.slice(0, -1)}` : p))));
    // A file or folder dragged onto a folder in the path moves there, as onto Finder's path bar.
    [...$('crumbs').querySelectorAll('button')].forEach((b, i, all) => { if (i < all.length - 1) asDropTarget(b, i ? `${parts.slice(0, i).join('/')}/` : ''); });
    drawTree();
    drawItems();
    offerBack();
  }

  // ── moving a file by dragging it onto a folder ──────────────────────────
  // A file (not a folder: that would be a copy of a tree) dragged onto a folder row, a folder in the
  // grid or the folder tree moves there: copied with If-None-Match (never over a file that is there),
  // then the original deleted with its ETag (only if unchanged). If either step fails, nothing is lost.
  const MOVE_TYPE = 'application/x-foafos-path';
  const touchOnly = window.matchMedia?.('(pointer: coarse)').matches && !window.matchMedia?.('(any-pointer: fine)').matches;
  // A long press on an item chooses it, as a phone's file manager does; taps then add or remove.
  function asChoosable(el, it) {
    let timer = 0, at = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      at = { x: e.clientX, y: e.clientY };
      timer = setTimeout(() => { el._held = true; chosen.add(it.path); anchor = it.path; markChosen(); }, 500);
    });
    el.addEventListener('pointermove', (e) => { if (at && Math.hypot(e.clientX - at.x, e.clientY - at.y) > 10) clearTimeout(timer); });
    for (const t of ['pointerup', 'pointercancel']) el.addEventListener(t, () => clearTimeout(timer));
    el.addEventListener('contextmenu', (e) => {
      if (el._held || at) { e.preventDefault(); at = null; return; }   // a long press chose it; no menu
      e.preventDefault();
      itemMenu(it, e.clientX, e.clientY);
    });
    el.addEventListener('click', (e) => { if (el._held) { el._held = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  }
  // An item's menu, as every desktop file manager has: a right-click, the Menu key or Shift+F10 on
  // an item. It is picked first (or, if it is among several chosen, the menu acts on them all), and
  // the menu offers what its panel and keys do, with the keys named.
  // Text onto the system clipboard, from a click: a frame has no clipboard permission of its own,
  // but the classic copy of selected text works inside a user's click. As Finder's "Copy as pathname".
  function copyText(text, said) {
    const ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;left:-9999px;top:0;opacity:0' });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* refused */ }
    ta.remove();
    say(ok ? said : `This browser would not copy here. The path is ${text}`, !ok);
  }
  async function itemMenu(it, x, y) {
    document.querySelector('.ctx-menu')?.remove();
    const many = chosen.size > 1 && chosen.has(it.path) ? [...chosen] : null;
    if (!many) { clearChosen(); await pick(it); }
    const ro = inArchive() || !!it.trashId;
    const mac = /Mac/.test(navigator.platform);
    const rows = many ? [
      [`Copy ${many.length} items`, mac ? '⌘C' : 'Ctrl+C', () => holdPaths(many, false)],
      ro ? null : [`Cut ${many.length} items`, mac ? '⌘X' : 'Ctrl+X', () => holdPaths(many, true)],
      [`Download ${many.length} items`, '', () => download(many)],
      ro ? null : ['Compress', '', () => compress(many)],
      ro ? null : [`Move ${many.length} items to the Trash`, mac ? '⌘⌫' : 'Delete', () => askDeleteChosen(), 'danger'],
    ] : [
      ['Open', 'Enter', () => activate(it)],
      ro ? null : ['Rename', 'F2', () => askRename()],
      ro ? null : ['Duplicate', '', () => (it.container ? duplicateFolder(it.path) : duplicate())],
      ['Copy', mac ? '⌘C' : 'Ctrl+C', () => holdPaths([it.path], false)],
      ro ? null : ['Cut', mac ? '⌘X' : 'Ctrl+X', () => holdPaths([it.path], true)],
      [it.container ? 'Download as .zip' : 'Download', '', () => download([it.path])],
      ro ? null : ['Compress', '', () => compress([it.path])],
      searchResults ? ['Show in folder', '', () => showInFolder(it.path)] : null,
      ['Copy path', '', () => copyText(it.path, `Copied the path ${it.path}. Paste it into Go to folder (/) to come back here.`)],
      ro ? null : [it.container ? 'Delete' : 'Move to the Trash', mac ? '⌘⌫' : 'Delete', () => askDelete(), 'danger'],
    ];
    showMenu(rows, x, y, many ? `${many.length} items` : nameOf(it.path), () => document.querySelector(`#items [data-path="${CSS.escape(it.path)}"]`)?.focus());
  }
  // A small menu at x, y: rows of [label, keys, run, class]; arrows move, Escape or a click away closes.
  function showMenu(rows, x, y, label, onEscape) {
    document.querySelector('.ctx-menu')?.remove();
    const menu = h('div', { class: 'ctx-menu', role: 'menu', 'aria-label': label },
      ...rows.filter(Boolean).map(([text, keys, run, cls]) => h('button', { type: 'button', role: 'menuitem', class: cls || '',
        on: { click: async () => { close(); await run(); } } }, h('span', {}, text), h('kbd', {}, keys))));
    const close = () => { menu.remove(); document.removeEventListener('pointerdown', away, true); };
    const away = (e) => { if (!menu.contains(e.target)) close(); };
    menu.addEventListener('keydown', (e) => {
      const bs = [...menu.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); onEscape?.(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus(); }
    });
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(x, innerWidth - r.width - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(y, innerHeight - r.height - 4))}px`;
    menu.querySelector('button')?.focus();
    setTimeout(() => document.addEventListener('pointerdown', away, true), 0);
  }
  // The folder's own menu, from a right-click on the empty space of the list or the icons, as in
  // Finder and Explorer: make, add, paste, and how it is shown.
  function folderMenu(x, y) {
    const ro = inArchive() || trashView;
    const mac = /Mac/.test(navigator.platform);
    const holding = held && !held.gone;
    showMenu([
      ro ? null : ['New file', '', () => askNewFile()],
      ro ? null : ['New folder', '', () => askNewFolder()],
      ro ? null : ['Upload…', '', () => $('upload').click()],
      ro || !holding ? null : [`Paste ${heldAll().length === 1 ? nameOf(heldAll()[0]) : `${heldAll().length} items`}`, mac ? '⌘V' : 'Ctrl+V', () => pasteHeld()],
      ['Choose all', mac ? '⌘A' : 'Ctrl+A', () => { chosen.clear(); for (const i of shown()) chosen.add(i.path); markChosen(); }],
      [icons ? 'Show as a list' : 'Show as icons', '', () => $('view').click()],
      ['Look for changes', '', async () => { if (!(await refreshIfChanged())) say(folderSummary()); }],
      [showHidden ? 'Hide hidden files' : 'Show hidden files', mac ? '⌘⇧.' : 'Ctrl+Shift+.', () => toggleHidden()],
      folder ? ['Download this folder as .zip', '', () => download([folder])] : null,
    ], x, y, `Folder ${nameOf(folder) || here()?.label || ''}`, null);
  }
  const emptySpace = (t) => !t.closest('tr[data-path], [role=option], button, input, a, .ask, #choosebar');
  // Ctrl + the wheel (a trackpad's pinch, too) over the icons sizes them.
  // Two fingers pinched over the icons size them, as a phone's photo and file apps do: a step each
  // time the fingers have spread or closed by a quarter. One finger still scrolls.
  {
    let base = 0;
    const gap = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    $('items-pane').addEventListener('touchstart', (e) => { base = icons && e.touches.length === 2 ? gap(e.touches) : 0; }, { passive: true });
    $('items-pane').addEventListener('touchmove', (e) => {
      if (!base || e.touches.length !== 2) return;
      e.preventDefault();                       // the pinch is ours, not a page zoom
      const r = gap(e.touches) / base;
      if (r > 1.25 || r < 0.8) { stepZoom(r > 1 ? 1 : -1); base = gap(e.touches); }
    }, { passive: false });
    for (const t of ['touchend', 'touchcancel']) $('items-pane').addEventListener(t, (e) => { if (e.touches.length < 2) base = 0; }, { passive: true });
  }
  let wheelSum = 0;
  $('items-pane').addEventListener('wheel', (e) => {
    if (!icons || !e.ctrlKey) return;
    e.preventDefault();
    wheelSum += e.deltaY;                      // a pinch sends many small steps: one size per 60
    if (Math.abs(wheelSum) < 60) return;
    stepZoom(wheelSum < 0 ? 1 : -1);
    wheelSum = 0;
  }, { passive: false });
  $('items-pane').addEventListener('contextmenu', (e) => {
    if (!emptySpace(e.target)) return;
    e.preventDefault();
    if (!touchOnly) folderMenu(e.clientX, e.clientY);   // a phone's long press is heard below
  });
  // On a phone, a finger held still on the empty space opens the same menu (iOS sends no contextmenu).
  {
    let held = null;
    $('items-pane').addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || !emptySpace(e.target)) return;
      const at = { x: e.clientX, y: e.clientY };
      held = { at, timer: setTimeout(() => { held = null; folderMenu(at.x, at.y); }, 550) };
    });
    const drop = (e) => { if (held && (e.type !== 'pointermove' || Math.hypot(e.clientX - held.at.x, e.clientY - held.at.y) > 10)) { clearTimeout(held.timer); held = null; } };
    for (const t of ['pointermove', 'pointerup', 'pointercancel']) $('items-pane').addEventListener(t, drop);
  }
  function asDraggable(el, it) {
    asChoosable(el, it);
    if (inArchive() || touchOnly) return;
    el.draggable = true;
    // Dragging one of several chosen items takes them all, folders too, as a desktop's file manager does.
    el.addEventListener('dragstart', (e) => {
      const many = chosen.size > 1 && chosen.has(it.path) ? [...chosen] : [it.path];
      e.dataTransfer.setData(MOVE_TYPE, many.join('\n'));
      e.dataTransfer.effectAllowed = 'move';
    });
  }
  function asDropTarget(el, dir) {
    if (inArchive() || dir.includes('!/')) return;
    el.addEventListener('dragover', (e) => {
      if (![...(e.dataTransfer?.types || [])].includes(MOVE_TYPE)) return;
      e.preventDefault(); e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('drop-target');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
    el.addEventListener('drop', (e) => {
      const from = e.dataTransfer?.getData(MOVE_TYPE);
      if (!from) return;
      e.preventDefault(); e.stopPropagation();
      el.classList.remove('drop-target');
      moveMany(from.split('\n').filter(Boolean), dir);
    });
  }
  // Several files dragged at once: one listing and one report at the end.
  async function moveMany(paths, dir) {
    if (paths.length === 1 && !paths[0].endsWith('/')) { await moveFile(paths[0], dir); return; }
    const moved = [], not = [];
    for (const p of paths) {
      const r = p.endsWith('/') ? await moveFolder(p, dir) : { ok: await moveFile(p, dir, { quiet: true }) };
      (r.ok ? moved : not).push(r.ok ? nameOf(p) : `${nameOf(p)}${r.why ? ` (${r.why})` : ''}`);
    }
    chosen.clear();
    await go(folder, { remember: false });
    const there = dir === folder ? 'here' : `to ${dir || here()?.label || 'the top folder'}`;
    const kind = paths.some((p) => p.endsWith('/')) ? 'items' : 'files';
    say([moved.length ? `Moved ${moved.length === 1 ? moved[0] : `${moved.length} ${kind}`} ${there}.` : '', not.length ? `Not moved: ${not.join(', ')}.` : ''].filter(Boolean).join(' '), !moved.length);
  }
  // Move a folder and all that is in it, as a desktop does: copied first (never over anything that is
  // there, and not onto a folder of the same name, which would mix the two), then the original taken
  // away, deepest first. If part of the original cannot be removed, it says so, and nothing is lost.
  async function moveFolder(src, dir) {
    if (dir.startsWith(src)) return { ok: false, why: 'not into itself' };
    if (parentOf(src) === dir) return { ok: false, why: 'it is here already' };
    const to = dir + nameOf(src) + '/';
    const there = await list(dir);
    if (there.ok && there.items.some((i) => dir + i.path.replace(/^\/+/, '') === to)) return { ok: false, why: `a folder called ${nameOf(src)} is there already` };
    return moveTree(src, to);
  }
  // Copy a folder's tree to `to`, then take the original away. If part of it cannot be removed,
  // it says so, and nothing is lost.
  async function moveTree(src, to) {
    const copied = await copyTree(src, to);
    if (!copied.ok) return { ok: false, why: copied.why };
    const left = await removeTree(src);
    return left ? { ok: false, why: `copied, but ${left} file${left === 1 ? '' : 's'} could not be taken from the original` } : { ok: true };
  }
  // Remove a folder and everything in it: every file, then each folder, deepest first. Returns how
  // many files could not be removed.
  async function removeTree(src) {
    const dirs = [], queue = [src];
    let left = 0;
    while (queue.length) {
      const d = queue.shift(); dirs.push(d);
      const r = await list(d);
      for (const it of r.ok ? r.items : []) {
        const p = d + it.path.replace(/^\/+/, '');
        if (it.container) { queue.push(p); continue; }
        forgetThumb(p);
        if (!(await foafos.pod.delete(p)).ok) left++;
      }
    }
    for (const d of dirs.reverse()) await foafos.pod.delete(d);
    return left;
  }
  // Returns whether the file moved. `quiet`: for a batch, which lists the folder and reports once.
  async function moveFile(from, dir, { quiet = false } = {}) {
    if (parentOf(from) === dir || dir.startsWith(from)) return false;
    const to = dir + nameOf(from);
    const got = await foafos.pod.get(from, { as: 'bytes' });
    if (!got.ok) { if (!quiet) say(explain(got), true); return false; }
    const put = await foafos.pod.put(to, got.body, { contentType: got.contentType || 'application/octet-stream', ifNoneMatch: true });
    if (!put.ok) { if (!quiet) say(put.reason === 'conflict' ? `${nameOf(to)} is there already; nothing was moved.` : explain(put), true); return false; }
    const del = await foafos.pod.delete(from, got.etag ? { etag: got.etag } : {});
    forgetThumb(from);
    if (quiet) return del.ok;
    await go(folder, { remember: false });
    say(del.ok ? `Moved ${nameOf(from)} to ${dir || here()?.label || 'the top folder'}.` : `Copied ${nameOf(from)} to ${dir}, but the original is still here: ${explain(del)}`, !del.ok);
    return del.ok;
  }

  function treeNode(path, label) {
    const open = expanded.has(path);
    const b = h('button', { type: 'button', title: label, on: { click: () => { $('panes').dataset.places = 'closed'; go(path); } } }, `${open ? '📂' : '📁'} ${label}`);
    if (path === folder) b.setAttribute('aria-current', 'true');
    asDropTarget(b, path);
    // A folder in the side panel has a menu of its own, as in Finder's sidebar: what works on a
    // folder from anywhere.
    b.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const kept = favs().includes(path);
      showMenu([
        ['Open', '', () => go(path)],
        inArchive() ? null : ['New folder in it', '', async () => { await go(path); askNewFolder(); }],
        path ? ['Download as .zip', '', () => download([path])] : null,
        path ? [kept ? 'Remove from the side panel' : 'Keep in the side panel', '', () => { const on = toggleFav(path); say(on ? `${nameOf(path)} is kept in the side panel.` : `${nameOf(path)} is no longer in the side panel.`); }] : null,
      ], e.clientX, e.clientY, `Folder ${label}`, () => b.focus());
    });
    const li = h('li', {}, b);
    const kids = open ? children.get(path) || [] : [];
    if (kids.length) li.append(h('ul', {}, kids.map((k) => treeNode(k, nameOf(k)))));
    return li;
  }
  const shortcut = (label, path) => h('li', {}, h('button', { type: 'button', on: { click: () => { $('panes').dataset.places = 'closed'; go(path); } } }, label));
  const here = () => locations.find((l) => l.id === current);
  const drawTree = () => { $('tree').replaceChildren(treeNode('', here()?.label || 'My files'), shortcut('🗒️ Notes', 'apps/podnotes/notes/')); drawFavs(); };

  // Folders you use often, kept at the top of the side panel, as Finder's sidebar and Explorer's
  // Quick access keep them: for each location, on this device. A folder's panel adds or removes it.
  const FAV_KEY = 'files.favourites';
  const favAll = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || {}; } catch { return {}; } };
  const favs = () => favAll()[current] || [];
  function toggleFav(path) {
    const all = favAll(), now = all[current] || [];
    all[current] = now.includes(path) ? now.filter((p) => p !== path) : [...now, path].slice(-20);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(all)); } catch { /* for this visit */ }
    drawFavs();
    return all[current].includes(path);
  }
  function drawFavs() {
    const list = favs();
    $('favs-title').hidden = !list.length;
    $('favs').replaceChildren(...list.map((path) => h('li', { class: 'fav' },
      h('button', { type: 'button', title: path, 'aria-current': String(path === folder), on: { click: () => { $('panes').dataset.places = 'closed'; go(path); } } }, `⭐ ${nameOf(path)}`),
      h('button', { type: 'button', class: 'fav-x', 'aria-label': `Remove ${nameOf(path)} from the side panel`, on: { click: () => toggleFav(path) } }, '✕'))));
  }

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
    folder = ''; items = []; trail.length = 0; ahead.length = 0; children.clear(); expanded.clear(); expanded.add(''); pick(null);
    drawItems(); drawTree();
    if (!r.ok) { say(explain(r), true); return; }
    say('');
    $('panes').dataset.places = 'closed';
    await openKept();
    takeLocations(await foafos.pod.locations());
  }

  async function addFolder() {
    const r = await foafos.pod.addFolder();
    if (!r.ok && !r.locations) { say(explain(r), true); return; }
    await showLocation(r);
  }

  // An archive opens as a folder (read-only): `box.zip` → `box.zip!/`.
  const ARCHIVE = /\.(zip|tar|tgz|tar\.gz)$/i;
  const inArchive = () => folder.includes('!/');
  // Up to the enclosing folder, with the keyboard on the folder just left.
  async function upAndFocus() {
    const from = folder;
    await go(parentOf(folder));
    const back = [...$('items').querySelectorAll('tbody tr, .grid [role=option]')].find((r) => r.dataset.path === from);
    (back || $('items').querySelector('tbody tr, .grid [role=option]'))?.focus();
  }
  function activate(it) { if (it.container) return go(it.path); if (ARCHIVE.test(it.path)) return go(`${it.path}!/`); noteRecent(it.path); return pick(it); }

  // Recent: the files opened last, newest first, for each location, as a phone's or a desktop's
  // file manager keeps them. A file that has gone since is left out when the list is shown.
  const RECENT_KEY = 'files.recent';
  const recentAll = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || {}; } catch { return {}; } };
  function noteRecent(path) {
    if (!current || path.includes('!/')) return;
    const all = recentAll();
    all[current] = [path, ...(all[current] || []).filter((p) => p !== path)].slice(0, 15);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(all)); } catch { /* not kept */ }
  }
  async function showRecent() {
    const mine = ++listing;
    const want = recentAll()[current] || [];
    // One listing per folder they are in, to leave out what has gone and to show size and date.
    const byDir = new Map();
    for (const p of want) { const d = parentOf(p); if (!byDir.has(d)) byDir.set(d, null); }
    for (const d of byDir.keys()) { const r = await list(d); byDir.set(d, r.ok ? new Map(r.items.map((i) => [d + i.path.replace(/^\/+/, ''), i])) : new Map()); }
    if (mine !== listing) return;
    items = want.map((p) => { const i = byDir.get(parentOf(p))?.get(p); return i && !i.container ? { ...i, path: p } : null; }).filter(Boolean);
    searchResults = true;
    recentOrder = true;
    $('filter').value = '';
    pick(null);
    draw();
    $('panes').dataset.places = 'closed';
    say(items.length ? `Recent: the ${items.length === 1 ? 'file' : `${items.length} files`} opened last. Open a folder to go back.` : 'Nothing opened yet: files you open show here.');
  }

  // ── where the space goes ──────────────────────────────────────────────
  // A treemap of this folder: each file a box whose area is its size, inside a box for its folder.
  // Sizes come from the listings (one per folder, no request per file), walked at most 400
  // folders deep in all; a folder past that is drawn by what was measured, and the line says so.
  let spaceOn = false, spaceRun = 0;
  const SPACE_MAX_DIRS = 400;
  async function measure(path, budget, mine) {
    if (budget.left-- <= 0) { budget.cut = true; return { name: nameOf(path) || here()?.label || 'My files', path, dir: true, size: 0, files: 0, kids: [] }; }
    const r = await list(path);
    if (mine !== spaceRun) return null;
    const kids = [];
    let files = 0;
    for (const it of r.ok ? r.items : []) {
      const p = path + it.path.replace(/^\/+/, '');
      if (hiddenName(nameOf(p))) continue;
      if (it.container) {
        const sub = await measure(p, budget, mine);
        if (!sub) return null;
        if (sub.size > 0 || sub.kids.length) { kids.push(sub); files += sub.files; }
      } else {
        kids.push({ name: nameOf(p), path: p, size: it.size || 0, kind: kindOf({ path: p }).name });
        files++;
      }
    }
    if (r.truncated) budget.cut = true;
    return { name: nameOf(path) || here()?.label || 'My files', path, dir: true, size: kids.reduce((n, k) => n + k.size, 0), files, kids };
  }
  // Squarified treemap (Bruls, Huizing, van Wijk 2000): rows whose boxes stay near square.
  function squarify(kids, x, y, w, h) {
    const items = kids.filter((k) => k.size > 0).sort((a, b) => b.size - a.size);
    const total = items.reduce((n, k) => n + k.size, 0);
    const out = [];
    if (!total || w <= 0 || h <= 0) return out;
    const scale = (w * h) / total;
    let rest = items.map((k) => ({ k, a: k.size * scale }));
    while (rest.length) {
      const side = Math.min(w, h);
      const worst = (row) => { const s = row.reduce((n, r) => n + r.a, 0); const mx = Math.max(...row.map((r) => r.a)), mn = Math.min(...row.map((r) => r.a)); return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn)); };
      let row = [rest[0]], i = 1;
      while (i < rest.length && worst([...row, rest[i]]) <= worst(row)) { row.push(rest[i]); i++; }
      rest = rest.slice(i);
      const s = row.reduce((n, r) => n + r.a, 0);
      if (w >= h) {               // a column on the left
        const cw = s / h; let cy = y;
        for (const r of row) { const ch = r.a / cw; out.push({ k: r.k, x, y: cy, w: cw, h: ch }); cy += ch; }
        x += cw; w -= cw;
      } else {                    // a row along the top
        const rh = s / w; let cx = x;
        for (const r of row) { const rw = r.a / rh; out.push({ k: r.k, x: cx, y, w: rw, h: rh }); cx += rw; }
        y += rh; h -= rh;
      }
    }
    return out;
  }
  const KIND_HUE = { Image: 32, Text: 212, 'Linked data': 160, Code: 268, JSON: 190, Table: 190, Audio: 340, Video: 340 };
  function drawBoxes(host, node, x, y, w, ht, depth) {
    for (const b of squarify(node.kids, x, y, w, ht)) {
      const big = b.w > 54 && b.h > 22;
      const el = h('div', { class: `tm ${b.k.dir ? 'tm-dir' : 'tm-file'}`, role: 'listitem', tabIndex: 0,
        title: `${b.k.path || b.k.name} — ${sizeText(b.k.size)}${b.k.dir ? `, ${b.k.files} files` : ''}`,
        'aria-label': `${b.k.name}, ${b.k.dir ? 'folder, ' : ''}${sizeText(b.k.size)}` });
      Object.assign(el.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${Math.max(0, b.w - 2)}px`, height: `${Math.max(0, b.h - 2)}px` });
      if (!b.k.dir) el.style.setProperty('--hue', String(KIND_HUE[b.k.kind] ?? 0)), el.style.setProperty('--sat', KIND_HUE[b.k.kind] === undefined ? '0%' : '48%');
      // An image big enough to recognise shows itself, through the same thumbnails as the list.
      if (!b.k.dir && b.w > 60 && b.h > 44 && IMAGE_NAME.test(b.k.path)) {
        const pic = h('span', { class: 'tm-pic', 'aria-hidden': 'true' });
        pic.dataset.thumb = b.k.path;
        if (thumbs.has(b.k.path)) showThumb(pic, b.k.path); else thumbSeen.observe(pic);
        el.append(pic);
        el.classList.add('tm-has-pic');
      }
      if (big) el.append(h('span', { class: 'tm-label' }, b.k.name), h('span', { class: 'tm-size' }, sizeText(b.k.size)));
      const open = () => (b.k.dir ? go(b.k.path) : pick({ path: b.k.path, container: false }));
      el.addEventListener('click', (e) => { e.stopPropagation(); open(); });
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.stopPropagation(); open(); } });
      host.append(el);
      // A folder shows what is in it, inside its own box, below its name, three levels down.
      if (b.k.dir && depth < 3 && b.w > 40 && b.h > 40) drawBoxes(host, b.k, b.x + 3, b.y + (big ? 34 : 4), b.w - 8, b.h - (big ? 38 : 8), depth + 1);
    }
  }
  async function drawSpace() {
    const mine = ++spaceRun;
    const box = $('items');
    box.replaceChildren(h('p', { class: 'tm-note' }, 'Measuring this folder…'));
    const budget = { left: SPACE_MAX_DIRS, cut: false };
    const tree = await measure(folder, budget, mine);
    if (!tree || mine !== spaceRun || !spaceOn) return;
    const note = h('p', { class: 'tm-note' }, `${tree.name}: ${sizeText(tree.size)} in ${tree.files} file${tree.files === 1 ? '' : 's'}`
      + (budget.cut ? ` (measured the first ${SPACE_MAX_DIRS} folders only)` : ''));
    const map = h('div', { class: 'tm-map', role: 'list', 'aria-label': `Where the space goes in ${tree.name}` });
    box.replaceChildren(note, map);
    if (!tree.size) { map.replaceWith(h('div', { class: 'empty' }, h('p', {}, 'Nothing here takes any space yet.'))); return; }
    map.style.height = `${Math.max(240, $('items-pane').clientHeight - note.offsetHeight - 14)}px`;
    const r = map.getBoundingClientRect();
    drawBoxes(map, tree, 0, 0, r.width, r.height, 1);
  }

  // While the filter has words, the list ends with a way to look further: every folder, and inside files.
  const searchFurther = () => (!searchResults && $('filter').value.trim()
    ? h('div', { class: 'search-further' }, h('button', { class: 'tool', type: 'button', on: { click: searchAll } }, `Search all folders and inside files for “${$('filter').value.trim()}”`))
    : null);
  function drawItems() {
    if (spaceOn) { drawSpace(); return; }
    drawList();
    if (searchResults && !trashView && items.length) {
      const counts = KIND_GROUPS.map(([g, kinds]) => [g, items.filter((i) => kinds.includes(kindOf(i).name)).length]).filter(([, n]) => n);
      if (counts.length > 1 || kindFilter) {
        const chip = (label, value, n) => h('button', { type: 'button', class: 'kind-chip', 'aria-pressed': String(kindFilter === value),
          on: { click: () => { kindFilter = value; drawItems(); } } }, n == null ? label : `${label} ${n}`);
        $('items').prepend(h('div', { class: 'kind-chips', role: 'group', 'aria-label': 'Show only' },
          chip('All', null, items.length), ...counts.map(([g, n]) => chip(g, g, n))));
      }
    }
    const more = searchFurther();
    if (more && !$('items').querySelector('.empty')) $('items').append(more);
  }
  function drawList() {
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
            h('button', { class: 'tool', type: 'button', on: { click: newFolder } }, 'New folder'),
            h('button', { class: 'tool', type: 'button', on: { click: () => $('upload').click() } }, 'Upload…'),
            h('button', { class: 'tool upload-dir', type: 'button', on: { click: () => $('upload-dir').click() } }, 'Upload a folder…')])));
      return;
    }
    if (icons) {
      box.replaceChildren(h('div', { class: 'grid', role: 'listbox', 'aria-multiselectable': 'true', 'aria-label': `Items in ${nameOf(folder) || here()?.label || 'the top folder'}` }, rows.map((it) => {
        const k = kindOf(it);
        const btn = h('button', { type: 'button', role: 'option', 'aria-selected': String(picked?.path === it.path),
          on: { click: (e) => clickItem(e, it), dblclick: () => activate(it), keydown: (e) => { if (e.key === 'Enter') activate(it); } } },
        icoFor(it, k), nameOf(it.path));
        btn.dataset.path = it.path;
        btn.classList.toggle('chosen', chosen.has(it.path));
        if (chosen.size) btn.setAttribute('aria-selected', String(chosen.has(it.path)));
        asDraggable(btn, it);
        if (it.container) asDropTarget(btn, it.path);
        return btn;
      })));
      applyZoom();
      return;
    }
    const head = (key, label) => h('th', { scope: 'col', ...(sort.key === key && !recentOrder ? { 'aria-sort': sort.dir > 0 ? 'ascending' : 'descending' } : {}) }, h('button', { type: 'button', on: { click: () => { sort = { key, dir: sort.key === key ? -sort.dir : 1 }; recentOrder = false; keepView(); showSort(); drawItems(); } } },
      `${label}${sort.key === key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}`));
    // A grid, so a screen reader hears which rows are chosen (aria-selected counts only in a grid).
    box.replaceChildren(h('table', { class: 'list', role: 'grid', 'aria-multiselectable': 'true', 'aria-label': `Items in ${nameOf(folder) || here()?.label || 'the top folder'}` },
      h('thead', {}, h('tr', {}, head('name', 'Name'), head('kind', 'Kind'), head('size', 'Size'), head('modified', 'Modified'))),
      h('tbody', {}, rows.map((it) => {
        const k = kindOf(it);
        const tr = h('tr', { tabIndex: 0, on: {
          click: (e) => clickItem(e, it),
          dblclick: () => activate(it),
          keydown: (e) => {
            if (e.key === 'Enter') activate(it);
            if (e.metaKey || e.ctrlKey) return;            // Cmd + arrows are Finder's open and up
            if (e.key === 'ArrowDown' && !e.shiftKey) tr.nextElementSibling?.focus();
            if (e.key === 'ArrowUp' && !e.shiftKey) tr.previousElementSibling?.focus();
          } } },
        h('td', {}, icoFor(it, k), h('span', { class: 'nm' }, nameOf(it.path)),
          searchResults ? h('span', { class: 'hit' }, it.trashId ? `From ${parentOf(it.from) || (here()?.label || 'the top folder')}` : `${parentOf(it.path) || (here()?.label || 'Top folder')}${it.snippet ? ` — ${it.snippet}` : ''}`) : null), h('td', {}, k.name),
        h('td', { class: 'c-size' }, it.container || it.size == null ? '' : sizeText(it.size)),
        h('td', { class: 'c-mod', title: it.modified || '' }, whenText(it.modified)));
        tr.dataset.path = it.path;
        asDraggable(tr, it);
        if (it.container) asDropTarget(tr, it.path);
        tr.setAttribute('aria-selected', String(chosen.has(it.path) || (!chosen.size && picked?.path === it.path)));
        tr.classList.toggle('chosen', chosen.has(it.path));
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
  // A modification time, short: the time today, the day and month this year, else the date.
  const whenText = (iso) => {
    const d = iso ? new Date(iso) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], d.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  };
  // The size of a folder and all in it, on request: a walk of the tree, which costs one call per
  // folder, so it is not done on every pick. Stops at 5000 files.
  async function folderSize(path, mine, head) {
    const p = head.querySelector('p');
    p.textContent = 'Folder: working out its size…';
    let bytes = 0, files = 0, folders = 0;
    const queue = [path];
    while (queue.length && files < 5000) {
      const dir = queue.shift();
      const r = await list(dir);
      if (mine !== picking) return;
      for (const i of r.ok ? r.items : []) {
        const name = i.path.replace(/\/$/, '').split('/').pop();
        if (hiddenName(name)) continue;
        if (i.container) { folders++; queue.push(dir + i.path.replace(/^\/+/, '')); continue; }
        files++; bytes += i.size || 0;
      }
    }
    p.textContent = `Folder: ${sizeText(bytes)} in ${files} file${files === 1 ? '' : 's'}${folders ? ` and ${folders} folder${folders === 1 ? '' : 's'}` : ''}${queue.length ? ' (at least; there is more)' : ''}`;
    say(`${nameOf(path)} holds ${p.textContent.replace(/^Folder: /, '')}.`);
  }
  const sizeText = (n) => (n < 1024 ? `${n} bytes` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
  async function pick(it) {
    const mine = ++picking;
    $('panes').dataset.show = it ? 'detail' : 'items';
    offerBack();
    if (!it) { picked = null; drawDetail(h('p', { class: 'detail-none' }, 'Pick a file to see it here.')); return; }
    const k = kindOf(it);
    const head = h('div', { class: 'detail-head' }, h('h2', {}, `${k.icon} ${nameOf(it.path)}`), h('p', {}, k.name));
    // In the Trash: where it came from, Put back, and Delete for good.
    if (it.trashId) {
      picked = { path: it.path, trashId: it.trashId, container: false };
      drawDetail(head, h('p', { class: 'trash-from' }, `From ${it.from || 'an unknown folder'}`), h('div', { class: 'detail-actions' },
        h('button', { class: 'tool tool-main', type: 'button', on: { click: async () => { const ix = await readTrash(); const r = await fromTrash(it.trashId, ix); if (r.ok) await writeTrash(ix); if (!r.ok) { say(`Not put back: ${r.why}.`, true); return; } await showTrash(); say(`Put ${nameOf(r.path)} back in ${parentOf(r.path) || here()?.label || 'the top folder'}.`); } } }, 'Put back'),
        h('button', { class: 'tool danger', type: 'button', on: { click: askPurge } }, 'Delete for good'),
        it.from ? h('button', { class: 'tool', type: 'button', on: { click: () => go(parentOf(it.from)) } }, 'Show where it was') : null));
      return;
    }
    const backBtn = h('button', { class: 'tool panes-back', type: 'button', on: { click: () => { $('panes').dataset.show = 'items'; offerBack(); } } }, 'Back to list');
    if (!it.container && ARCHIVE.test(it.path)) {
      // An archive: its details, and Open to look inside (read only); it can be renamed or deleted like any file.
      const raw = await foafos.pod.get(it.path, { as: 'bytes' });
      if (mine !== picking) return;
      picked = raw.ok ? { path: it.path, body: raw.body, etag: raw.etag, contentType: raw.contentType || 'application/zip', dirty: false } : { path: it.path };
      markPicked();
      if (raw.ok) head.querySelector('p').textContent = `Archive, ${sizeText(raw.body.byteLength)}`;
      drawDetail(head, h('p', { class: 'detail-none' }, 'Open it to see what it holds. Nothing inside can be changed here.'),
        actions(h('button', { class: 'tool tool-main', type: 'button', on: { click: () => go(`${it.path}!/`) } }, 'Open'),
          inArchive() ? null : h('button', { class: 'tool', type: 'button', on: { click: () => extract(it.path) } }, 'Extract'), backBtn));
      return;
    }
    if (it.container) {
      picked = { path: it.path, container: true };
      const kept = favs().includes(it.path);
      const favBtn = h('button', { class: 'tool', type: 'button', on: { click: () => { const on = toggleFav(it.path); favBtn.textContent = on ? 'Remove from the side panel' : 'Keep in the side panel'; say(on ? `${nameOf(it.path)} is kept in the side panel.` : `${nameOf(it.path)} is no longer in the side panel.`); } } },
        kept ? 'Remove from the side panel' : 'Keep in the side panel');
      drawDetail(head, h('div', { class: 'detail-actions' },
        h('button', { class: 'tool tool-main', type: 'button', on: { click: () => go(it.path) } }, 'Open'), backBtn, favBtn,
        h('button', { class: 'tool', type: 'button', on: { click: askRename } }, 'Rename'),
        h('button', { class: 'tool', type: 'button', on: { click: () => duplicateFolder(it.path) } }, 'Duplicate'),
        h('button', { class: 'tool', type: 'button', on: { click: () => download([it.path]) } }, 'Download as .zip'),
        inArchive() ? null : h('button', { class: 'tool', type: 'button', on: { click: () => compress([it.path]) } }, 'Compress'),
        h('button', { class: 'tool', type: 'button', on: { click: () => folderSize(it.path, mine, head) } }, 'Work out its size'),
        h('button', { class: 'tool danger', type: 'button', on: { click: askDelete } }, 'Delete')));
      markPicked();
      // What is in it, as a desktop's Get Info or Properties says: one look, at this level only.
      const r = await list(it.path);
      if (mine !== picking || !r.ok) return;
      const seen = r.items.filter((i) => !hiddenName(i.path.replace(/\/$/, '').split('/').pop()));
      const nf = seen.filter((i) => i.container).length, nd = seen.length - nf;
      head.querySelector('p').textContent = seen.length
        ? `Folder: ${[nd ? `${nd} file${nd === 1 ? '' : 's'}` : '', nf ? `${nf} folder${nf === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ')}`
        : 'Folder: empty';
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
      // Pictures show; sound and video play here, from the file's own bytes, as Quick Look and a
      // phone's Files do. Nothing is fetched from anywhere else.
      previewUrl = /^(image|audio|video)\//.test(type) ? URL.createObjectURL(new Blob([raw.body], { type })) : null;
      const view = type === 'application/pdf' ? pdfView(raw.body, nameOf(it.path))
        : !previewUrl ? h('p', { class: 'detail-none' }, 'This kind of file has no preview here.')
        : /^audio\//.test(type) ? h('div', { class: 'detail-body detail-media' }, h('audio', { controls: true, src: previewUrl, preload: 'metadata', 'aria-label': `Play ${nameOf(it.path)}` }))
        : /^video\//.test(type) ? h('div', { class: 'detail-body detail-media' }, h('video', { controls: true, src: previewUrl, preload: 'metadata', playsInline: true, 'aria-label': `Play ${nameOf(it.path)}` }))
        : h('div', { class: 'detail-body detail-image' }, h('img', { src: previewUrl, alt: nameOf(it.path) }));
      const offers = await openWithBox(it.path, type);
      const about = await aboutBox(it.path);
      if (mine !== picking) return;
      drawDetail(head, view, about, offers, actions(backBtn));
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
    if (inArchive()) { text.readOnly = true; save.hidden = true; }
    head.querySelector('p').textContent = `${k.name}, ${r.body.length.toLocaleString()} characters`;
    const offers = await openWithBox(it.path, picked.contentType);
    if (mine !== picking) return;
    drawDetail(head, h('div', { class: 'detail-body' }, text), offers, actions(backBtn, save));
  }

  // What the file says about itself (camera, date, size, artist, title, pages; a photo's place),
  // from the shell's pod.meta, and the same as linked data. Nothing for a file that says nothing.
  async function aboutBox(path) {
    const m = await foafos.pod.meta(path);
    if (!m.ok || !m.kind || (!Object.keys(m.fields || {}).length && !m.location)) return null;
    const f = m.fields;
    const when = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString([], { dateStyle: 'medium', ...(String(v).includes('T') ? { timeStyle: 'short' } : {}) }); };
    const rows = [
      ['Title', f.title], ['By', f.author || f.artist], ['Album', f.album], ['Year', f.year],
      ['Taken', f.taken && when(f.taken)], ['Created', !f.taken && f.created && when(f.created)],
      ['Camera', [f.make, f.model].filter(Boolean).join(' ')], ['Pixels', f.width && f.height ? `${f.width} × ${f.height}` : null],
      ['Pages', f.pages], ['About', f.description],
      ['Place', m.location ? `${m.location.lat}, ${m.location.lon}` : null],
    ].filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false);
    const dl = h('dl', { class: 'about-list' }, rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, String(v))]));
    return h('details', { class: 'about', open: true }, h('summary', {}, 'About this file'), dl,
      m.location ? h('p', { class: 'about-note' }, 'The place is not given to apps you share this file with.') : null,
      h('details', { class: 'about-rdf' }, h('summary', {}, 'As linked data'), h('pre', {}, m.turtle)));
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
  // From Recent or a search, "Show in folder" goes to the folder the file is in, with it chosen there,
  // as a desktop's "Show in Finder" / "Open file location" does.
  async function showInFolder(path) {
    await go(parentOf(path));
    const row = [...document.querySelectorAll('#items [data-path]')].find((r) => r.dataset.path === path);
    const it = items.find((i) => i.path === path);
    if (it) await pick(it);
    row?.focus();
    row?.scrollIntoView?.({ block: 'nearest' });
  }
  const actions = (...first) => h('div', { class: 'detail-actions' }, ...first,
    searchResults && picked?.path && !picked.trashId ? h('button', { class: 'tool', type: 'button', on: { click: () => showInFolder(picked.path) } }, 'Show in folder') : null,
    picked?.path && !picked.trashId ? h('button', { class: 'tool', type: 'button', on: { click: () => download([picked.path]) } }, 'Download') : null,
    ...(inArchive() ? [h('span', { class: 'detail-none' }, 'In an archive: read only.')] : [
      h('button', { class: 'tool', type: 'button', on: { click: askRename } }, 'Rename'),
      h('button', { class: 'tool', type: 'button', on: { click: duplicate } }, 'Duplicate'),
      h('button', { class: 'tool danger', type: 'button', on: { click: askDelete } }, 'Delete')]));

  // A PDF shows in the preview, a page at a time, drawn by pdf.js (third_party/pdfjs, Apache-2.0):
  // Chrome's own PDF viewer does not run in a sandboxed frame. It is loaded only when a PDF is
  // picked.
  let pdfjs = null;
  async function loadPdfjs() {
    if (pdfjs) return pdfjs;
    const base = new URL('../../../third_party/pdfjs/', location.href);
    const lib = await import(new URL('pdf.min.mjs', base).href);
    // pdf.js starts its worker from this URL where it may, and where it may not (a frame with no
    // origin of its own) runs the same code on the page instead.
    lib.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', base).href;
    pdfjs = lib;
    return lib;
  }
  function pdfView(bytes, name) {
    const canvas = h('canvas', { class: 'pdf-page', 'aria-label': `${name}, page 1` });
    const where = h('span', { class: 'pdf-where' }, 'Opening…');
    const prev = h('button', { class: 'tool', type: 'button', disabled: true }, 'Previous page');
    const next = h('button', { class: 'tool', type: 'button', disabled: true }, 'Next page');
    const box = h('div', { class: 'detail-body detail-pdf' }, canvas, h('div', { class: 'pdf-nav' }, prev, where, next));
    (async () => {
      try {
        const lib = await loadPdfjs();
        const doc = await lib.getDocument({ data: new Uint8Array(bytes) }).promise;
        let at = 1;
        const show = async () => {
          const page = await doc.getPage(at);
          const width = Math.max(200, box.clientWidth - 16);
          const vp0 = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (width / vp0.width) * (window.devicePixelRatio || 1) });
          canvas.width = vp.width; canvas.height = vp.height;
          canvas.style.width = `${width}px`;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, canvas }).promise;
          where.textContent = `Page ${at} of ${doc.numPages}`;
          canvas.setAttribute('aria-label', `${name}, page ${at} of ${doc.numPages}`);
          prev.disabled = at <= 1; next.disabled = at >= doc.numPages;
          box.dataset.page = String(at); box.dataset.pages = String(doc.numPages);
        };
        prev.addEventListener('click', () => { if (at > 1) { at--; show(); } });
        next.addEventListener('click', () => { if (at < doc.numPages) { at++; show(); } });
        await show();
      } catch (err) {
        where.textContent = 'This PDF could not be shown here.';
        box.dataset.error = String(err?.message || err);
      }
    })();
    return box;
  }

  // Save files to this computer, as a web file manager's Download does: the shell saves each one.
  async function download(paths) {
    // A folder comes down as one .zip of all that is in it; files one by one.
    const done = [], not = [];
    if (paths.some((p) => p.endsWith('/'))) say('Making a .zip of the folder…');
    for (const p of paths) { const r = await foafos.pod.download(p); (r.ok ? done : not).push(r.ok ? r.name || nameOf(p) : `${nameOf(p)} (${explain(r)})`); }
    say([done.length ? `Downloaded ${done.length === 1 ? done[0] : `${done.length} items`} to this computer.` : '', not.length ? `Not downloaded: ${not.join(', ')}.` : ''].filter(Boolean).join(' '), !done.length);
  }

  // A copy beside the original: "plan copy.txt", then "plan copy 2.txt", never over a file that is there.
  // A folder is duplicated whole, as Finder's Duplicate does: "trip copy", all that is in it.
  async function duplicateFolder(path) {
    const taken = new Set(items.map((i) => i.path.replace(/\/$/, '')));
    let n = 1, to;
    do { to = `${parentOf(path)}${nameOf(path)} copy${n > 1 ? ` ${n}` : ''}`; n++; } while (taken.has(to) && n < 1000);
    say(`Making ${nameOf(to)}…`);
    const r = await copyTree(path, `${to}/`);
    await go(folder, { remember: false });
    if (!r.ok) { say(`Not all copied: ${r.why}.`, true); return; }
    say(`Made ${nameOf(to)}.`);
    pick({ path: `${to}/`, container: true });
  }
  async function duplicate() {
    if (picked?.container && picked.path) { await duplicateFolder(picked.path); return; }
    if (!picked?.path || picked.body === undefined) return;
    const dir = parentOf(picked.path), file = nameOf(picked.path);
    const dot = file.lastIndexOf('.');
    const stem = dot > 0 ? file.slice(0, dot) : file, ext = dot > 0 ? file.slice(dot) : '';
    const taken = new Set(items.map((i) => i.path));
    let n = 1, to;
    do { to = `${dir}${stem} copy${n > 1 ? ` ${n}` : ''}${ext}`; n++; } while (taken.has(to) && n < 1000);
    const r = await foafos.pod.put(to, picked.body, { contentType: picked.contentType || 'application/octet-stream', ifNoneMatch: true });
    if (!r.ok) { say(explain(r), true); return; }
    await go(folder, { remember: false });
    say(`Made ${nameOf(to)}.`);
    pick({ path: to, container: false });
  }

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
  function ask(label, action, { value = '', danger = false, input = true, raw = false } = {}, done) {
    document.querySelector('.ask')?.remove();
    const field = input ? h('input', { type: 'text', value, 'aria-label': label }) : null;
    const close = () => bar.remove();
    const submit = async (e) => { e.preventDefault(); const v = field ? (raw ? field.value.trim() : cleanName(field.value)) : ''; if (input && !v) return; close(); await done(v); };
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

  // Rename never replaces something already called that, as on a desktop. A folder is renamed by
  // moving all that is in it, as a folder move does.
  const askRename = () => ask('New name', 'Rename', { value: nameOf(picked.path) }, async (name) => {
    const it = picked;
    const there = items.some((i) => i.path.replace(/\/$/, '') === parentOf(it.path) + name && i.path !== it.path);
    if (there) { say(`Something called ${name} is here already; nothing was renamed.`, true); return; }
    if (it.container) {
      const to = `${parentOf(it.path)}${name}/`;
      if (to === it.path) return;
      say(`Renaming ${nameOf(it.path)}…`);
      const r = await moveTree(it.path, to);
      await go(folder, { remember: false });
      if (!r.ok) { say(`Not renamed: ${r.why}.`, true); return; }
      say(`Renamed to ${name}.`);
      pick({ path: to, container: true });
      return;
    }
    const to = parentOf(it.path) + name;
    if (to === it.path) return;
    forgetThumb(to); forgetThumb(it.path);
    const got = await foafos.pod.get(it.path, { as: 'bytes' });
    if (!got.ok) { say(explain(got), true); return; }
    const put = await foafos.pod.put(to, got.body, { contentType: got.contentType || 'application/octet-stream', ifNoneMatch: true });
    if (!put.ok) { say(put.reason === 'conflict' ? `${name} is there already; nothing was renamed.` : explain(put), true); return; }
    const del = await foafos.pod.delete(it.path, got.etag ? { etag: got.etag } : {});
    if (!del.ok) say(`Copied to ${name}, but the old file is still there: ${explain(del)}`, true);
    await go(folder, { remember: false });
    pick({ path: to, container: false });
  });

  // ── the Trash ───────────────────────────────────────────────────────────
  // Deleting a file moves it to a hidden .trash/ folder in the same location, as a desktop's
  // Trash or a phone's Recently deleted does: each in its own folder there. One index,
  // .trash/index.json, says what each is and where it came from, so showing the Trash takes one
  // read, not one per file (a pod throttles a burst of reads). A file is copied first and the
  // original removed only if unchanged, so nothing is lost on the way. The bar offers Undo at once;
  // "🗑 Trash" in the side panel lists what is there, to put back or delete for good. Empty
  // folders are still deleted for good.
  const TRASH = '.trash/';
  const TRASH_INDEX = `${TRASH}index.json`;
  let lastTrashed = [];          // what the last delete moved, for Undo
  // The index is read once per location and then kept here: only Files writes it, and every read
  // counts against the pod's calls per minute.
  let trashCache = null;
  async function readTrash() {
    if (trashCache && trashCache.loc === current) return trashCache.ix;
    const r = await foafos.pod.get(TRASH_INDEX);
    let ix = {};
    try { ix = r.ok ? JSON.parse(r.body) || {} : {}; } catch { /* a new index */ }
    if (r.ok || r.status === 404 || r.reason === 'not-found') trashCache = { loc: current, ix };
    return ix;
  }
  const writeTrash = (ix) => { trashCache = { loc: current, ix }; return foafos.pod.put(TRASH_INDEX, JSON.stringify(ix), { contentType: 'application/json' }); };
  async function toTrash(path, ix) {
    if (path.endsWith('/')) {
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const name = nameOf(path);
      const r = await moveTree(path, `${TRASH}${id}/${name}/`);
      if (!r.ok) return { ok: false, why: r.why };
      ix[id] = { from: path, name, folder: true, size: null, at: new Date().toISOString(), type: null };
      return { ok: true, id };
    }
    const got = await foafos.pod.get(path, { as: 'bytes' });
    if (!got.ok) return { ok: false, why: explain(got) };
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const name = nameOf(path);
    const put = await foafos.pod.put(`${TRASH}${id}/${name}`, got.body, { contentType: got.contentType || 'application/octet-stream', ifNoneMatch: true });
    if (!put.ok) return { ok: false, why: explain(put) };
    const del = await foafos.pod.delete(path, got.etag ? { etag: got.etag } : {});
    forgetThumb(path);
    if (!del.ok) { await foafos.pod.delete(`${TRASH}${id}/${name}`); return { ok: false, why: explain(del) }; }
    ix[id] = { from: path, name, size: got.body?.byteLength ?? got.body?.length ?? null, at: new Date().toISOString(), type: got.contentType || null };
    return { ok: true, id };
  }
  // Put one trashed item back where it came from, never over a file that is there now.
  async function fromTrash(id, ix) {
    const e = ix[id];
    if (!e) return { ok: false, why: 'it is no longer in the Trash' };
    if (e.folder) {
      const there = await list(parentOf(e.from));
      if (there.ok && there.items.some((i) => parentOf(e.from) + i.path.replace(/^\/+/, '') === e.from)) return { ok: false, why: `a folder called ${e.name} is there now` };
      const r = await moveTree(`${TRASH}${id}/${e.name}/`, e.from);
      if (!r.ok) return { ok: false, why: r.why };
      await foafos.pod.delete(`${TRASH}${id}/`);
      delete ix[id];
      return { ok: true, path: e.from };
    }
    const inTrash = `${TRASH}${id}/${e.name}`;
    const got = await foafos.pod.get(inTrash, { as: 'bytes' });
    if (!got.ok) return { ok: false, why: explain(got) };
    const put = await foafos.pod.put(e.from, got.body, { contentType: got.contentType || 'application/octet-stream', ifNoneMatch: true });
    if (!put.ok) return { ok: false, why: put.reason === 'conflict' ? `a file called ${e.name} is there now` : explain(put) };
    await foafos.pod.delete(inTrash);
    delete ix[id];
    return { ok: true, path: e.from };
  }
  async function purge(id, ix) {
    const e = ix[id];
    if (e?.folder) await removeTree(`${TRASH}${id}/`);
    else if (e) { await foafos.pod.delete(`${TRASH}${id}/${e.name}`); await foafos.pod.delete(`${TRASH}${id}/`); }
    delete ix[id];
  }
  async function trashMany(paths) {
    const ix = await readTrash();
    const moved = [], not = [];
    for (const p of paths) { const r = await toTrash(p, ix); if (r.ok) moved.push(r.id); else not.push(`${nameOf(p)} (${r.why})`); }
    if (moved.length) await writeTrash(ix);
    lastTrashed = moved;
    chosen.clear();
    await go(folder, { remember: false });
    say([moved.length ? `Moved ${moved.length === 1 ? nameOf(paths[0]) : `${moved.length} ${paths.some((x) => x.endsWith('/')) ? 'items' : 'files'}`} to the Trash.` : '', not.length ? `Not moved: ${not.join(', ')}.` : ''].filter(Boolean).join(' '), !moved.length);
    drawChooseBar();
  }
  async function undoTrash() {
    const ids = lastTrashed; lastTrashed = [];
    const ix = await readTrash();
    let back = 0;
    for (const id of ids) if ((await fromTrash(id, ix)).ok) back++;
    await writeTrash(ix);
    await go(folder, { remember: false });
    say(`Put back ${back === 1 ? '1 file' : `${back} files`}.`);
    drawChooseBar();
  }
  let trashView = false;
  async function showTrash() {
    const mine = ++listing;
    const ix = await readTrash();
    if (mine !== listing) return;
    const rows = Object.entries(ix).sort(([, a], [, b]) => String(b.at).localeCompare(String(a.at)))
      .map(([id, e]) => ({ path: `${TRASH}${id}/${e.name}${e.folder ? '/' : ''}`, container: !!e.folder, size: e.size, modified: e.at, contentType: e.type, trashId: id, from: e.from }));
    items = rows; searchResults = true; recentOrder = true; trashView = true;
    $('filter').value = '';
    pick(null); draw();
    $('panes').dataset.places = 'closed';
    say(rows.length ? `Trash: ${rows.length} item${rows.length === 1 ? '' : 's'}, newest first. Pick one to put it back or delete it for good.` : 'The Trash is empty.');
    drawChooseBar();
  }
  async function emptyTrash() {
    ask('Delete everything in the Trash for good? This cannot be undone.', 'Empty Trash', { input: false, danger: true }, async () => {
      const ix = await readTrash();
      for (const id of Object.keys(ix)) await purge(id, ix);
      await writeTrash(ix);
      await showTrash();
    });
  }

  const askDeleteChosen = () => {
    const all = [...chosen];
    const files = all.filter((p) => !p.endsWith('/'));
    const what = all.length === files.length ? `${files.length} file${files.length === 1 ? '' : 's'}` : `${all.length} items`;
    ask(`Move ${what} to the Trash? You can put ${all.length === 1 ? 'it' : 'them'} back from the Trash.`, 'Move to Trash', { input: false, danger: true }, () => trashMany(all));
  };
  // One question for the chosen files, or the usual one for the item picked.
  const askDelete = () => (chosen.size > 1 ? askDeleteChosen() : askDeleteOne());
  const askDeleteOne = () => (picked.container ? askDeleteFolder() : picked.trashId ? askPurge() : ask(`Move ${nameOf(picked.path)} to the Trash? You can put it back from the Trash.`, 'Move to Trash', { input: false, danger: true }, () => trashMany([picked.path])));
  const askPurge = () => ask(`Delete ${nameOf(picked.path)} for good? This cannot be undone.`, 'Delete for good', { input: false, danger: true }, async () => { const ix = await readTrash(); await purge(picked.trashId, ix); await writeTrash(ix); await showTrash(); });
  // An empty folder is deleted for good (there is nothing in it to lose); one with things in it goes
  // to the Trash, whole, as on a desktop.
  const askDeleteFolder = async () => {
    const r = await list(picked.path);
    const full = (r.items || []).some((i) => !hiddenName(i.path.replace(/\/$/, '')));
    return full ? ask(`Move ${nameOf(picked.path)} and all that is in it to the Trash? You can put it back from the Trash.`, 'Move to Trash', { input: false, danger: true }, () => trashMany([picked.path])) : askDeleteEmptyFolder();
  };
  const askDeleteEmptyFolder = () => ask(`Delete ${nameOf(picked.path)}? This cannot be undone.`, 'Delete', { input: false, danger: true }, async () => {
    const name = nameOf(picked.path);
    let path = picked.path;
    if (picked.container) {
      const r = await list(path);
      const rest = (r.items || []).filter((i) => !hiddenName(i.path.replace(/\/$/, '')));
      if (rest.length) { await trashMany([path]); return; }
      await foafos.pod.delete(`${path}.folder`);
    }
    forgetThumb(path);
    const r = await foafos.pod.delete(path, picked.etag ? { etag: picked.etag } : {});
    if (!r.ok) { say(explain(r), true); return; }
    await go(folder, { remember: false });
    say(`Deleted ${name}.`);
  });

  // A failed move leaves both lists as they were.
  const goBack = () => { if (trail.length) { const to = trail.pop(); go(to, { remember: false, via: 'back' }).then(() => { if (folder !== to) trail.push(to); }); } };
  const goForward = () => { if (ahead.length) { const to = ahead.pop(); go(to, { remember: false, via: 'forward' }).then(() => { if (folder !== to) ahead.push(to); }); } };
  $('back').addEventListener('click', goBack);
  // A phone's Back, inside Files: out of a file's panel to the list, then back through the folders
  // (as Android's file managers do). Only where one pane shows at a time; a wide window has its
  // own Back button and keys, and the browser's Back stays the browser's.
  const onePane = () => window.matchMedia?.('(max-width: 680px)').matches;
  function offerBack() {
    const step = !onePane() ? null
      : $('panes').dataset.show === 'detail' ? () => { $('panes').dataset.show = 'items'; offerBack(); }
      : trail.length ? () => goBack() : null;
    foafos.setBack?.(step);
  }
  $('forward').addEventListener('click', goForward);
  // The keys and buttons people already use for this: Alt+Left and Alt+Right (Cmd+[ and Cmd+] on a
  // Mac), and a mouse's own back and forward buttons.
  document.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const back = (e.altKey && e.key === 'ArrowLeft') || (e.metaKey && e.key === '[');
    const fwd = (e.altKey && e.key === 'ArrowRight') || (e.metaKey && e.key === ']');
    if (back || fwd) { e.preventDefault(); (back ? goBack : goForward)(); }
    // Up a folder from anywhere in Files: Alt + Up (Explorer), Cmd or Ctrl + Up (Finder).
    if ((e.altKey || e.metaKey || e.ctrlKey) && e.key === 'ArrowUp' && folder) { e.preventDefault(); upAndFocus(); }
    // Go to a folder by its path: / as in GNOME Files, Cmd or Ctrl + Shift + G as in Finder.
    if ((e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'g')) { e.preventDefault(); askGoTo(); }
    // Show or hide hidden files: Cmd or Ctrl + Shift + . (Finder's key).
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === '.' || e.key === '>' || e.code === 'Period')) { e.preventDefault(); toggleHidden(); }
    // Bigger and smaller icons in the icon view (not the page's own zoom, which the shell keeps).
    if (icons && (e.metaKey || e.ctrlKey) && ['=', '+', '-', '_'].includes(e.key)) { e.preventDefault(); stepZoom(e.key === '-' || e.key === '_' ? -1 : 1); }
  });
  // Go to folder: type a path in this location, as in an address bar. Typed with or without the
  // slashes at either end; a folder that is not there says so and stays put.
  function askGoTo() {
    ask('Go to folder', 'Go', { value: folder, raw: true }, async (typed) => {
      const parts = typed.split('/').map((p) => p.trim()).filter((p) => p && p !== '.');
      if (parts.includes('..') || parts.some((p) => p.startsWith('.'))) { say('That is not a folder you can go to.', true); return; }
      const to = parts.length ? `${parts.join('/')}/` : '';
      if (to) {
        const r = await foafos.pod.list(to);
        if (!r.ok && r.status === 404) {
          // A file's path (from Copy path) goes to its folder, with it chosen.
          const file = parts.join('/');
          const there = await foafos.pod.list(parentOf(file));
          if (there.ok && there.items.some((i) => parentOf(file) + i.path.replace(/^\/+/, '') === file)) { await showInFolder(file); return; }
          say(`There is no folder ${to} here.`, true); return;
        }
        if (!r.ok) { say(explain(r), true); return; }
      }
      await go(to);
    });
  }
  document.addEventListener('mouseup', (e) => { if (e.button === 3) { e.preventDefault(); goBack(); } else if (e.button === 4) { e.preventDefault(); goForward(); } });
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
    // The Menu key or Shift+F10 opens the item's menu, as a right-click does.
    if (at >= 0 && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) {
      const it = items.find((i) => i.path === e.target.dataset.path);
      if (it) { e.preventDefault(); const r = e.target.getBoundingClientRect(); itemMenu(it, r.left + 24, r.bottom); }
      return;
    }
    // Shift + arrows extend the choice from where it started, as in a desktop's file manager:
    // Up and Down in the list, and all four in the icon view.
    if (e.shiftKey && at >= 0 && /^Arrow/.test(e.key)) {
      const grid = e.target.matches('[role=option]');
      // In the icon view Up and Down go a whole row of icons.
      const top0 = rows[0].getBoundingClientRect().top;
      const cols = grid ? Math.max(1, rows.filter((r) => Math.abs(r.getBoundingClientRect().top - top0) < 2).length) : 1;
      const step = { ArrowDown: cols, ArrowUp: -cols, ArrowRight: grid ? 1 : 0, ArrowLeft: grid ? -1 : 0 }[e.key];
      const to = rows[at + step];
      if (!step || !to) return;
      e.preventDefault(); e.stopPropagation();
      const paths = rows.map((r) => r.dataset.path);
      if (!anchor || !paths.includes(anchor)) anchor = paths[at];
      const a = paths.indexOf(anchor), b = at + step;
      chosen.clear();
      for (const p of paths.slice(Math.min(a, b), Math.max(a, b) + 1)) chosen.add(p);
      markChosen();
      to.focus();
      return;
    }
    // Ctrl or Cmd + A chooses everything shown; Escape clears; Delete with several chosen asks once.
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      chosen.clear(); for (const it of shown()) chosen.add(it.path); markChosen();
      return;
    }
    if (e.key === 'Escape' && chosen.size) { e.preventDefault(); e.stopPropagation(); clearChosen(); say(folderSummary()); return; }
    if (chosen.size > 1 && (e.key === 'Delete' || (e.metaKey && e.key === 'Backspace'))) { e.preventDefault(); askDeleteChosen(); return; }
    // Delete (Cmd+Backspace on a Mac) asks to delete the item the keyboard is on; F2 renames it.
    if (at >= 0 && (e.key === 'Delete' || (e.metaKey && e.key === 'Backspace') || e.key === 'F2')) {
      e.preventDefault();
      const it = items.find((i) => i.path === e.target.dataset.path);
      if (!it) return;
      await pick(it);
      if (picked?.path !== it.path) { say('This kind of file cannot be renamed or deleted here.', true); return; }
      if (e.key === 'F2') askRename(); else askDelete();
      return;
    }
    // Cmd (or Ctrl) + Down opens what the keyboard is on, as in Finder.
    if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowDown') {
      const it = items.find((i) => i.path === e.target.dataset?.path);
      if (it) {
        e.preventDefault();
        await activate(it);
        if (it.container) $('items').querySelector('tbody tr, .grid [role=option]')?.focus();   // into it, as Finder does
      }
      return;
    }
    if (e.key === 'Backspace' && folder) {
      e.preventDefault();
      await upAndFocus();
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
    if (e.key.length !== 1 || e.key === ' ' || e.key === '/') return;   // / is Go to folder
    const now = Date.now();
    typed = (now - typedAt > 800 ? '' : typed) + e.key.toLowerCase();
    typedAt = now;
    const rows = [...$('items').querySelectorAll('tbody tr, .grid [role=option]')];
    const name = (r) => (r.dataset.path ? nameOf(r.dataset.path) : r.textContent).toLowerCase();
    const hit = rows.find((r) => name(r).startsWith(typed));
    if (hit) { e.preventDefault(); hit.focus(); }
  });
  $('filter').addEventListener('input', drawItems);
  // The folder kept up to date, as Finder and Explorer keep theirs: when Files comes back into use
  // (its window focused, the tab shown again) it lists the folder again, and redraws only if
  // something changed there, such as a file another app saved. On a touch screen, pulling the list
  // down from the top does the same. Not in Recent, search or the Trash, which are views.
  const sig = (list) => list.map((i) => `${i.path}|${i.size ?? ''}|${i.modified ?? ''}`).sort().join('\n');
  let refreshing = null;         // the look under way, if one is
  // A look already under way is waited for, then a fresh one made: a pull (or a focus) that comes
  // while another look is running still sees what was saved since that one began.
  async function refreshIfChanged() {
    if (refreshing) { await refreshing.catch(() => {}); return refreshIfChanged(); }
    if (searchResults || !current || document.querySelector('.ask')) return false;
    let done;
    refreshing = new Promise((ok) => { done = ok; });
    try {
      const r = await list(folder);
      if (!r.ok) return false;
      const fresh = r.items.map((it) => ({ ...it, path: folder + it.path.replace(/^\/+/, '') })).filter((it) => listed(nameOf(it.path)));
      if (sig(fresh) === sig(items)) return false;
      const keep = document.activeElement?.dataset?.path, was = picked?.path;
      await go(folder, { remember: false });
      if (was && items.some((i) => i.path === was)) await pick(items.find((i) => i.path === was));
      [...document.querySelectorAll('#items [data-path]')].find((r2) => r2.dataset.path === keep)?.focus();
      return true;
    } finally { const d = done; refreshing = null; d(); }
  }
  addEventListener('focus', () => { refreshIfChanged(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshIfChanged(); });
  {
    // Touch events, not pointer events: once the browser takes a pull as a scroll it cancels the
    // pointer, but touchend still comes.
    let pullFrom = null, pullLast = null;
    const pane = $('items-pane');
    pane.addEventListener('touchstart', (e) => { pullFrom = pane.scrollTop <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null; pullLast = pullFrom; }, { passive: true });
    pane.addEventListener('touchmove', (e) => { if (pullFrom !== null) pullLast = e.touches[0].clientY; }, { passive: true });
    pane.addEventListener('touchend', () => {
      if (pullFrom !== null && pullLast - pullFrom > 80 && pane.scrollTop <= 0) { say('Looking for changes…'); refreshIfChanged().then((did) => { if (!did) say(folderSummary()); }); }
      pullFrom = pullLast = null;
    });
    pane.addEventListener('touchcancel', () => { pullFrom = pullLast = null; });
  }
  // From the filter: Down moves into the list, Enter opens the top match (as in All apps).
  $('filter').addEventListener('keydown', (e) => {
    // Escape clears the filter, and after a search across folders goes back to the folder you were in.
    if (e.key === 'Escape' && ($('filter').value || searchResults)) {
      e.preventDefault();
      e.stopPropagation();
      $('filter').value = '';
      if (searchResults) go(folder, { remember: false }); else drawItems();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'Enter') return;
    const first = $('items').querySelector('tbody tr, .grid [role=option]');
    if (!first) return;
    e.preventDefault();
    first.focus();
    if (e.key === 'Enter') { const it = shown()[0]; if (it) activate(it); }
  });
  // Drop files from the computer onto the list to add them to this folder: text up to 1 MiB,
  // anything else up to 8 MiB. A larger file is named and left out rather than silently lost.
  // Drag a box over the empty space of the list or the icons to choose what it touches, as in
  // Finder, Explorer and GNOME Files; with Ctrl or Cmd held, what it touches is added. A mouse or a
  // pen only: a finger scrolls, and a phone chooses with a long press.
  {
    const box = $('items-pane');
    let band = null, drewAt = -1e9;
    // A box begun beside a name is not a drag of that row.
    box.addEventListener('dragstart', (e) => { if (band) e.preventDefault(); }, true);
    // The click that ends a drawn box is not a click on what is under it.
    box.addEventListener('click', (c) => { if (performance.now() - drewAt < 300) { c.stopPropagation(); c.preventDefault(); } }, true);
    box.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      // In the list, the blank space beside a name counts as empty too, as in Finder and Explorer.
      const row = e.target.closest('tr[data-path]');
      const beside = row && e.target.closest('td') === row.firstElementChild && e.clientX > (row.querySelector('.nm')?.getBoundingClientRect().right ?? Infinity) + 8;
      if (!beside && e.target.closest('tr[data-path], [role=option], button, input, a, .ask, #choosebar, .search-further')) return;
      const r = box.getBoundingClientRect();
      band = { x: e.clientX - r.left + box.scrollLeft, y: e.clientY - r.top + box.scrollTop, id: e.pointerId, keep: e.metaKey || e.ctrlKey ? new Set(chosen) : new Set(), el: null };
    });
    box.addEventListener('pointermove', (e) => {
      if (!band || e.pointerId !== band.id) return;
      const r = box.getBoundingClientRect();
      const x = e.clientX - r.left + box.scrollLeft, y = e.clientY - r.top + box.scrollTop;
      if (!band.el) {
        if (Math.abs(x - band.x) + Math.abs(y - band.y) < 6) return;
        // Where each item is, in the pane's own coordinates, measured once per box.
        band.items = [...$('items').querySelectorAll('tbody tr[data-path], .grid [role=option][data-path]')].map((el) => {
          const q = el.getBoundingClientRect();
          return { path: el.dataset.path, l: q.left - r.left + box.scrollLeft, t: q.top - r.top + box.scrollTop, r: q.right - r.left + box.scrollLeft, b: q.bottom - r.top + box.scrollTop };
        });
        band.el = h('div', { class: 'band', 'aria-hidden': 'true' });
        box.appendChild(band.el);
        box.setPointerCapture?.(e.pointerId);
      }
      band.to = { x, y };
      if (band.frame) return;
      // At most once a frame, however fast the pointer moves.
      band.frame = requestAnimationFrame(drawBand);
    });
    function drawBand() {
        if (!band?.el) return;
        band.frame = 0;
        const { x, y } = band.to;
        const L = Math.min(x, band.x), T = Math.min(y, band.y), R = Math.max(x, band.x), B = Math.max(y, band.y);
        Object.assign(band.el.style, { left: `${L}px`, top: `${T}px`, width: `${R - L}px`, height: `${B - T}px` });
        const on = new Set(band.keep);
        for (const q of band.items) if (q.r > L && q.l < R && q.b > T && q.t < B) on.add(q.path);
        if (on.size === chosen.size && [...on].every((p) => chosen.has(p))) return;
        chosen.clear(); for (const p of on) chosen.add(p);
        markChosen();
    }
    const end = (e) => {
      if (!band || e.pointerId !== band.id) return;
      const drew = !!band.el;
      if (band.frame) { cancelAnimationFrame(band.frame); drawBand(); }   // the last move counts
      band.el?.remove();
      band = null;
      if (drew) { drewAt = performance.now(); if (!chosen.size) say(folderSummary()); }
    };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
  }
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
    if (inArchive()) { e.preventDefault(); pane.classList.remove('dropping'); say('This is inside an archive, which is read only. Drop files into a folder.', true); return; }
    e.preventDefault();
    pane.classList.remove('dropping');
    await addFiles(files);
  });
  // A name in this folder that is not taken: "image.png", then "image 2.png".
  // Compress, as Finder's: a .zip of a folder or of what is chosen, made beside them, never over a
  // file that is there (name.zip, then name 2.zip). Stored, not squeezed, as Download's zip is; up to
  // 500 files or 50 MB. The zip writer is loaded only when first used.
  let zipWriter = null;
  async function compress(paths) {
    zipWriter ||= await import(new URL('../../../packages/foafos/src/zip-write.mjs', location.href).href);
    say('Making a .zip…');
    const entries = [];
    let bytes = 0;
    for (const p of paths) {
      const top = nameOf(p);
      if (!p.endsWith('/')) {
        const g = await foafos.pod.get(p, { as: 'bytes' });
        if (!g.ok) { say(`Not compressed: ${top} (${explain(g)}).`, true); return; }
        const data = new Uint8Array(g.body); bytes += data.length;
        entries.push({ name: top, data });
        continue;
      }
      const queue = [p];
      while (queue.length) {
        const dir = queue.shift();
        const r = await list(dir);
        if (!r.ok) { say(`Not compressed: ${explain(r)}.`, true); return; }
        const kids = r.items.filter((i) => !hiddenName(i.path.replace(/\/$/, '').split('/').pop()));
        if (!kids.length) entries.push({ name: `${top}/${dir.slice(p.length)}` });
        for (const it of kids) {
          const q = dir + it.path.replace(/^\/+/, '');
          if (it.container) { queue.push(q); continue; }
          if (entries.length >= 500 || bytes > 50 * 1024 * 1024) { say('Not compressed: more than 500 files or 50 MB.', true); return; }
          const g = await foafos.pod.get(q, { as: 'bytes' });
          if (!g.ok) { say(`Not compressed: ${nameOf(q)} (${explain(g)}).`, true); return; }
          const data = new Uint8Array(g.body); bytes += data.length;
          entries.push({ name: `${top}/${q.slice(p.length)}`, data });
        }
      }
    }
    const name = freeName(paths.length === 1 ? `${nameOf(paths[0])}.zip` : 'Archive.zip');
    const put = await foafos.pod.put(folder + name, zipWriter.makeStoredZip(entries).buffer, { contentType: 'application/zip', ifNoneMatch: true });
    if (!put.ok) { say(`Not compressed: ${explain(put)}.`, true); return; }
    clearChosen();
    await go(folder, { remember: false });
    say(`Made ${name}.`);
    pick({ path: folder + name, container: false });
  }
  const freeName = (name) => {
    const taken = new Set(items.map((i) => i.path.replace(/\/$/, '')));   // a folder's name counts as taken too
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
    let n = 1, to;
    do { to = `${stem}${n > 1 ? ` ${n}` : ''}${ext}`; n++; } while (taken.has(folder + to) && n < 1000);
    return to;
  };
  // Files dropped or pasted into this folder. A drop keeps each file's name, as a copy onto a
  // folder does; a paste never replaces a file, so a second screenshot is "Pasted image 2.png".
  // How long to wait before asking again when the pod says it has had enough writes for now.
  const THROTTLE_WAIT = 2000, THROTTLE_TRIES = 45;
  async function addFiles(files, { paste = false } = {}) {
    const added = [], tooBig = [], failed = [];
    let n = 0;
    for (const f of files) {
      n++;
      const texty = /^text\/|json|xml|javascript|turtle|n-triples|markdown/.test(f.type) || /\.(txt|md|csv|json|ttl|nt|jsonld|html?|css|js|mjs|xml|svg|ya?ml|log)$/i.test(f.name);
      // Text up to 1 MiB goes as text; anything else up to 8 MiB as bytes.
      if (f.size > (texty ? 1024 * 1024 : 8 * 1024 * 1024)) { tooBig.push(f.name); continue; }
      const given = cleanName(f.name) || 'Pasted';
      // A file from an uploaded folder keeps its place in it: trip/sub/b.txt.
      const rel = f.webkitRelativePath ? f.webkitRelativePath.split('/').map(cleanName).filter(Boolean).join('/') : '';
      const name = rel || (paste ? freeName(/^image\.\w+$/.test(given) ? `Pasted ${given}` : given) : given);
      forgetThumb(folder + name);
      const body = texty ? await f.text() : await f.arrayBuffer();
      const put = () => foafos.pod.put(folder + name, body, { contentType: f.type || (texty ? 'text/plain' : 'application/octet-stream'), ...(paste ? { ifNoneMatch: true } : {}) });
      let r = await put();
      // A pod takes so many writes a minute. A large drop waits its turn, as a desktop's copy of
      // many files takes its time, rather than leaving the rest behind.
      for (let tries = 0; !r.ok && r.reason === 'throttled' && tries < THROTTLE_TRIES; tries++) {
        say(`Adding ${n} of ${files.length}: the pod takes a limited number of files a minute, so this one waits its turn.`);
        await new Promise((ok) => setTimeout(ok, THROTTLE_WAIT));
        r = await put();
      }
      if (r.ok) added.push(name); else failed.push(`${name} (${explain(r)})`);
      if (files.length > 10 && n % 10 === 0) say(`Adding ${n} of ${files.length}…`);
    }
    await go(folder, { remember: false });
    say([added.length ? (added.length > 5 ? `Added ${added.length} files.` : `Added ${added.join(', ')}.`) : '',
      tooBig.length ? `Not added (too large: text up to 1 MiB, other files up to 8 MiB): ${tooBig.join(', ')}.` : '',
      failed.length ? `Not added: ${failed.join(', ')}.` : ''].filter(Boolean).join(' '), !added.length && !!(tooBig.length || failed.length));
    if (added.length === 1) pick({ path: folder + added[0], container: false });
  }
  // Paste (Ctrl+V, Cmd+V) into the folder: copied files or a screenshot become files here, and
  // copied text becomes "Pasted text.txt". Not while typing in a field, where paste is the field's.
  // Copy or cut a file here, and paste it into another folder, as in a desktop's file manager
  // (Ctrl or Cmd + C, X, V). What is held is this app's own; the system clipboard gets the file's
  // name, so pasting it elsewhere gives something sensible. A copy never replaces a file; a cut
  // moves the file as a drag does, and only once.
  let held = null;
  function holdPaths(paths, cut) {
    const its = paths.map((p) => items.find((i) => i.path === p)).filter(Boolean);
    const files = its.filter((i) => !i.container).map((i) => i.path);
    // A copy takes folders and all that is in them; a cut moves files only, for now.
    const folders = its.filter((i) => i.container).map((i) => i.path);
    if (!files.length && !folders.length) return null;
    if (cut && inArchive()) { say('This is inside an archive, which is read only. Copy instead.', true); return null; }
    const names = [...files, ...folders].map(nameOf);
    held = { paths: files, folders, cut, name: names.join('\n') };
    const n = files.length + folders.length;
    const what = n === 1 ? names[0] : `${n} items`;
    const left = '';
    say(`${cut ? 'Cut' : 'Copied'} ${what}${left}. Paste in a folder to ${cut ? 'move' : 'put a copy'} there.`);
    drawChooseBar();
    return held;
  }
  function holdChosen(cut) { holdPaths([...chosen], cut); }
  const onCopy = (e) => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || window.getSelection()?.toString()) return;
    // The chosen items, if several are chosen; otherwise the one the keyboard is on, or the one picked.
    const one = document.activeElement?.closest?.('#items [data-path]')?.dataset.path || picked?.path;
    const paths = chosen.size > 1 ? [...chosen] : one ? [one] : [];
    if (!paths.some((p) => items.find((i) => i.path === p))) return;
    e.preventDefault();
    if (holdPaths(paths, e.type === 'cut')) e.clipboardData?.setData('text/plain', held.name);
  };
  document.addEventListener('copy', onCopy);
  document.addEventListener('cut', onCopy);
  async function pasteHeld() {
    const h0 = held;
    queueMicrotask(drawChooseBar);
    const what = heldAll().length === 1 ? nameOf(heldAll()[0]) : 'Those files';
    if (h0.gone) { say(`${what} ${h0.paths?.length === 1 ? 'was' : 'were'} moved already.`); return; }
    if (h0.cut) {
      held = { ...h0, gone: true };
      if (h0.paths.length === 1 && !(h0.folders || []).length) { await moveFile(h0.paths[0], folder); return; }
      await moveMany([...(h0.folders || []), ...h0.paths], folder);
      return;
    }
    const made = [], not = [];
    for (const src of h0.folders || []) {
      const r = await copyTree(src, folder + freeName(nameOf(src)) + '/');
      if (r.ok) { made.push(nameOf(r.to)); items.push({ path: r.to, container: true }); } else not.push(`${nameOf(src)} (${r.why})`);
    }
    for (const p of h0.paths) {
      const got = await foafos.pod.get(p, { as: 'bytes' });
      const to = folder + freeName(nameOf(p));
      const put = got.ok && await foafos.pod.put(to, got.body, { contentType: got.contentType || 'application/octet-stream', ifNoneMatch: true });
      if (put?.ok) { made.push(nameOf(to)); items.push({ path: to, container: false }); } else not.push(nameOf(p));
    }
    await go(folder, { remember: false });
    say([made.length ? `Pasted ${made.length === 1 ? made[0] : `${made.length} files`}.` : '', not.length ? `Not pasted: ${not.join(', ')}.` : ''].filter(Boolean).join(' '), !made.length);
    if (made.length === 1 && !(h0.folders || []).length) pick({ path: folder + made[0], container: false });
  }
  // Copy a folder and everything in it, its own marker and empty folders too, never over
  // anything that is there. Stops at 500 files or 50 MB, and says how far it got.
  // Extract, as opening a .zip in Finder does: everything in it, copied into a new folder beside it
  // named after it (trip.zip → trip/, or trip 2/ if that is taken), up to 500 files or 50 MB.
  async function extract(path) {
    const name = freeName(nameOf(path).replace(/\.(zip|tar|tgz|tar\.gz)$/i, '') || 'Extracted');
    say(`Extracting into ${name}…`);
    const r = await copyTree(`${path}!/`, `${folder}${name}/`);
    await go(folder, { remember: false });
    if (!r.ok) { say(`Not all extracted: ${r.why}.`, true); return; }
    say(`Extracted ${r.files} file${r.files === 1 ? '' : 's'} into ${name}.`);
    pick({ path: `${folder}${name}/`, container: true });
  }
  async function copyTree(src, to) {
    if (to.startsWith(src)) return { ok: false, why: 'not into itself' };
    const queue = [src];
    let files = 0, bytes = 0;
    while (queue.length) {
      const dir = queue.shift();
      const r = await list(dir);
      if (!r.ok) return { ok: false, why: explain(r) };
      const dest = to + dir.slice(src.length);
      if (!r.items.some((i) => i.path.replace(/^\/+/, '') === '.folder')) await foafos.pod.put(`${dest}.folder`, '', { contentType: 'text/plain', ifNoneMatch: true });
      for (const it of r.items) {
        const path = dir + it.path.replace(/^\/+/, '');
        // Never a name that climbs out (an archive's "../x"): everything lands inside `to`.
        if (path.slice(src.length).split('/').some((seg) => seg === '..' || seg === '.')) return { ok: false, why: `${it.path} is not a name that can be copied` };
        if (it.container) { queue.push(path); continue; }
        if (files >= 500 || bytes > 50 * 1024 * 1024) return { ok: false, to, why: `stopped after ${files} files: a copy takes at most 500 files or 50 MB` };
        const got = await foafos.pod.get(path, { as: 'bytes' });
        if (!got.ok) return { ok: false, why: `${nameOf(path)}: ${explain(got)}` };
        const put = await foafos.pod.put(to + path.slice(src.length), got.body, { contentType: got.contentType || 'application/octet-stream', ifNoneMatch: true });
        if (!put.ok) return { ok: false, why: `${nameOf(path)}: ${explain(put)}` };
        files++; bytes += got.body?.byteLength ?? got.body?.length ?? 0;
      }
    }
    return { ok: true, to, files };
  }
  document.addEventListener('paste', async (e) => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (held && !e.clipboardData?.files?.length && e.clipboardData?.getData('text/plain') === held.name) {
      e.preventDefault();
      if (inArchive()) { say('This is inside an archive, which is read only. Paste into a folder.', true); return; }
      await pasteHeld();
      return;
    }
    const files = [...(e.clipboardData?.files || [])];
    const text = files.length ? '' : e.clipboardData?.getData('text/plain') || '';
    if (!files.length && !text) return;
    e.preventDefault();
    if (inArchive()) { say('This is inside an archive, which is read only. Paste into a folder.', true); return; }
    await addFiles(files.length ? files : [new File([text], 'Pasted text.txt', { type: 'text/plain' })], { paste: true });
  });

  $('new-file').addEventListener('click', askNewFile);
  // Upload, as every web and phone file manager has: the system's own picker, for a phone that cannot
  // drop or paste. Files, or a whole folder (where the browser offers one), added to this folder.
  $('upload').addEventListener('click', () => { if (inArchive()) { say('This is inside an archive, which is read only. Upload into a folder.', true); return; } $('upload-input').click(); });
  $('upload-dir').addEventListener('click', () => { if (inArchive()) { say('This is inside an archive, which is read only. Upload into a folder.', true); return; } $('upload-dir-input').click(); });
  for (const id of ['upload-input', 'upload-dir-input']) $(id).addEventListener('change', async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (files.length) await addFiles(files);
  });
  $('recent').addEventListener('click', showRecent);
  $('trash').addEventListener('click', showTrash);
  $('add-folder').addEventListener('click', addFolder);
  $('new-folder').addEventListener('click', askNewFolder);
  $('places').addEventListener('click', () => { const p = $('panes'); p.dataset.places = p.dataset.places === 'open' ? 'closed' : 'open'; });
  $('space').addEventListener('click', (e) => {
    spaceOn = !spaceOn;
    e.currentTarget.setAttribute('aria-pressed', String(spaceOn));
    $('view').disabled = spaceOn;
    drawItems();
  });
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
    if (['name', 'kind', 'size', 'modified'].includes(kept.sort?.key) && [1, -1].includes(kept.sort?.dir)) sort = kept.sort;
    if (ZOOMS.includes(kept.zoom)) zoom = kept.zoom;
    showHidden = kept.showHidden === true;
    showSort();
    icons = kept.icons === true;
    $('view').setAttribute('aria-pressed', String(icons));
    $('view').textContent = icons ? '☰' : '▦';
    $('view').setAttribute('aria-label', icons ? 'Show as a list' : 'Show as icons');
    drawItems();
  });

  pick(null);
  window.__files = { go, pick, useLocation, squarify, showRecent, showTrash, addFiles, paced, refreshIfChanged, state: () => ({ folder, items, picked, current, locations, status: statusEl.textContent }) };

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
  // "show": go to a file's folder with it chosen, as asked by the shell (All apps search finds files).
  // Held until Files has opened its location, so its own start does not move away again.
  let started = null;
  // "search": search all folders for what was typed in All apps, as Files' own search does.
  foafos.onAction?.(async (action, args) => {
    await started;
    if (action === 'show' && args?.path) await showInFolder(String(args.path).replace(/^\/+/, ''));
    if (action === 'search' && args?.query) { $('filter').value = String(args.query).slice(0, 200); await searchAll(); }
  });
  foafos.onInit(async () => {
    started = (async () => {
      takeLocations(await foafos.pod.locations());
      await openKept();
      takeLocations(await foafos.pod.locations());   // a location opens on first use, so its status may have changed
    })();
    await started;
  });
})();
