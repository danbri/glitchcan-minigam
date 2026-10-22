const log = (s) => { const li = document.createElement('li'); li.textContent = s; document.getElementById('log').append(li); };
for (const s of ['loaded', 'ready', 'shown', 'hidden', 'unloaded']) miniapp.page.addEventListener('page' + s, () => log(`page ${s}`));
miniapp.page.onpageloaded = () => {
  document.getElementById('q').textContent = `pageInputQuery: ${JSON.stringify(miniapp.page.pageInputObject.pageInputQuery)}`;
};
document.getElementById('err').addEventListener('click', () => miniapp.postToLogic({ kind: 'throw' }));
