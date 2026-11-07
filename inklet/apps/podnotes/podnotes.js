// Notes (id podnotes): plain notes kept in the user's pod, through foaf.pod.* only.
// Every path is relative to this app's own container (apps/podnotes/ in the
// pod the person chose for apps); the app never sees where that is.
// Each note is `notes/<name>.txt`. A save sends the ETag read with the note,
// so a note changed elsewhere since is refused (412) rather than overwritten.
(() => {
  const $ = (id) => document.getElementById(id);
  const statusEl = $('status');
  let current = null;   // { name, etag }
  let shared = null;    // a file the shell gave this window: { token, name, write }, or null

  const REASONS = {
    'no-pod': 'There is no shared pod. Open System, then Pods. Connect one, and press "Make this the shared pod".',
    offline: 'The pod is not connected. Connect it in System, under Pods.',
    locked: 'Your notes are on this device, sealed. UNLOCK the session (passphrase) to open them.',
    denied: 'This app holds no pod capability here.',
    conflict: 'The note changed elsewhere since you opened it. Reload it, then save again.',
    'no-shell': 'Open this app inside foafos: it keeps notes in your pod through the shell.',
    timeout: 'The shell did not answer.',
  };
  const say = (text, bad = false) => { statusEl.textContent = text; statusEl.classList.toggle('bad', bad); };
  const explain = (r) => REASONS[r.reason] || `Refused: ${r.reason}${r.status ? ` (${r.status})` : ''}`;
  const cleanName = (s) => String(s).trim().replace(/[^\p{L}\p{N} ._-]+/gu, '-').replace(/^\.+/, '').slice(0, 80);

  function showShared() {
    $('name').readOnly = !!shared;
    $('del').disabled = !!shared;
    $('text').readOnly = !!shared && !shared.write;
    $('save').disabled = !!shared && !shared.write;
  }

  async function openShared() {
    const r = await foaf.pod.get('', { share: shared.token });
    if (!r.ok) {
      // Nothing was loaded, so nothing may be saved over the file.
      $('save').disabled = true;
      $('text').readOnly = true;
      say(explain(r), true);
      return;
    }
    current = { name: shared.name, etag: r.etag, contentType: r.contentType };
    $('name').value = shared.name;
    $('text').value = r.body;
    showShared();
    say(`${shared.name}, from Files. ${shared.write ? 'Save writes to that file.' : 'Read only.'}`);
  }

  async function refresh() {
    const r = await foaf.pod.list('notes/');
    const ul = $('notes');
    ul.textContent = '';
    if (!r.ok) {
      // A container that does not exist yet is an empty list, not a fault.
      if (r.reason === 'http' && r.status === 404) { say('No notes yet. Write one and press Save.'); return; }
      say(explain(r), true);
      return;
    }
    const names = r.items.filter((it) => !it.container && it.path.endsWith('.txt')).map((it) => it.path.slice(0, -4)).sort();
    for (const name of names) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = name;
      if (current?.name === name) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', () => open(name));
      li.appendChild(b);
      ul.appendChild(li);
    }
    say(names.length ? `${names.length} note${names.length === 1 ? '' : 's'} in your pod.` : 'No notes yet. Write one and press Save.');
  }

  async function open(name) {
    const r = await foaf.pod.get(`notes/${name}.txt`);
    if (!r.ok) { say(explain(r), true); return; }
    shared = null;        // a note from the list is not the file from Files
    showShared();
    current = { name, etag: r.etag };
    $('name').value = name;
    $('text').value = r.body;
    say(`Opened ${name}.`);
    refresh();
  }

  async function save() {
    if (shared) {
      // Keep the file's own type: a Markdown file stays Markdown.
      const contentType = current?.contentType || 'text/plain; charset=utf-8';
      const r = await foaf.pod.put('', $('text').value, { share: shared.token, contentType, ...(current?.etag ? { etag: current.etag } : {}) });
      if (!r.ok) { say(explain(r), true); return; }
      current = { name: shared.name, etag: r.etag, contentType };
      say(`Saved ${shared.name}.`);
      return;
    }
    const name = cleanName($('name').value);
    if (!name) { say('Give the note a name first.', true); $('name').focus(); return; }
    const sameNote = current?.name === name;
    const r = await foaf.pod.put(`notes/${name}.txt`, $('text').value, {
      contentType: 'text/plain; charset=utf-8',
      ...(sameNote && current.etag ? { etag: current.etag } : { ifNoneMatch: true }),
    });
    if (!r.ok) {
      say(r.reason === 'conflict' && !sameNote ? `A note called ${name} exists already. Open it, or choose another name.` : explain(r), true);
      return;
    }
    current = { name, etag: r.etag };
    $('name').value = name;
    say(`Saved ${name}.`);
    refresh();
  }

  async function remove() {
    if (!current) { say('Open a note first.'); return; }
    const r = await foaf.pod.delete(`notes/${current.name}.txt`, current.etag ? { etag: current.etag } : {});
    if (!r.ok) { say(explain(r), true); return; }
    say(`Deleted ${current.name}.`);
    current = null;
    $('name').value = '';
    $('text').value = '';
    refresh();
  }

  $('save').addEventListener('click', save);
  $('new').addEventListener('click', () => { shared = null; showShared(); current = null; $('name').value = ''; $('text').value = ''; $('name').focus(); refresh(); });
  $('del').addEventListener('click', remove);
  $('reload').addEventListener('click', () => (shared ? openShared() : current ? open(current.name) : refresh()));

  // For tests and agents: the same calls the buttons make.
  window.__podnotes = { refresh, open, save, remove, state: () => ({ current, shared, status: statusEl.textContent }) };

  foaf.onInit(async () => {
    await refresh();
    const r = await foaf.pod.shared();
    if (r.ok && r.share) { shared = r.share; await openShared(); }
  });
  if (window.parent === window) say(REASONS['no-shell'], true);
})();
