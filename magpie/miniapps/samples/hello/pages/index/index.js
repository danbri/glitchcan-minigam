const log = (s) => { const li = document.createElement('li'); li.textContent = s; document.getElementById('log').append(li); };
for (const s of ['loaded', 'ready', 'shown', 'hidden', 'unloaded']) {
  miniapp.page.addEventListener('page' + s, () => log(`page ${s}`));
}
miniapp.page.onpageloaded = () => {
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = miniapp.t(el.dataset.i18n);
  miniapp.postToLogic({ kind: 'hello' });
};
miniapp.onlogicmessage = (msg) => {
  if (msg.kind === 'state') document.getElementById('status').textContent = `${miniapp.t('visits')}: ${msg.visits} · app ${msg.state}`;
};
document.getElementById('loc').addEventListener('click', async () => {
  try { const p = await miniapp.invoke('location.get'); log(`location ${p.latitude}, ${p.longitude}`); }
  catch (e) { log(`location refused: ${e.message}`); }
});
document.getElementById('err').addEventListener('click', () => miniapp.postToLogic({ kind: 'throw' }));
