const t = (k, vars = {}) => miniapp.t(k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? '');
function label(a) { return a.querySelector('b')?.textContent || a.textContent.trim(); }

async function showRecent() {
  const raw = await miniapp.invoke('storage.get', { key: 'recent' }).catch(() => null);
  const recent = raw ? JSON.parse(raw) : [];
  const ul = document.getElementById('recent');
  ul.replaceChildren(...recent.slice(0, 3).map(({ href, text, icon }) => {
    const src = [...document.querySelectorAll('.cards a')].find(a => a.getAttribute('href') === href);
    if (!src) return null;
    const li = document.createElement('li');
    li.append(src.cloneNode(true));
    return li;
  }).filter(Boolean));
  document.getElementById('recent-section').hidden = ul.children.length === 0;
}

miniapp.page.onpageloaded = () => {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const v = miniapp.t(el.dataset.i18n);
    if (v !== el.dataset.i18n) el.textContent = v;
  }
  // A story page takes its title from the link, in the reader's language.
  for (const a of document.querySelectorAll('.cards a[href*="story.html"]')) {
    const [path, q = ''] = a.getAttribute('href').split('?');
    const params = new URLSearchParams(q);
    params.set('title', label(a));
    a.setAttribute('href', `${path}?${params}`);
    a.dataset.miniappQuery = params.toString();
  }
  miniapp.postToLogic({ kind: 'hello' });
  showRecent();
};
miniapp.page.onpageshown = () => showRecent();
miniapp.onlogicmessage = (msg) => {
  if (msg.kind === 'sessions') document.getElementById('sessions').textContent = t('sessions', { n: msg.sessions });
};

// Remember what was opened, newest first, before the runner opens it.
document.addEventListener('click', async (e) => {
  const a = e.target.closest('.cards a');
  if (!a) return;
  const href = a.getAttribute('href');
  const raw = await miniapp.invoke('storage.get', { key: 'recent' }).catch(() => null);
  const recent = (raw ? JSON.parse(raw) : []).filter(r => r.href !== href);
  recent.unshift({ href, text: label(a) });
  miniapp.invoke('storage.set', { key: 'recent', value: JSON.stringify(recent.slice(0, 6)) }).catch(() => {});
}, true);
