miniapp.page.onpageloaded = () => {
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = miniapp.t(el.dataset.i18n);
  const q = miniapp.page.pageInputObject.pageInputQuery;
  document.getElementById('q').textContent = JSON.stringify(q);
  document.getElementById('deeper').onclick = () => miniapp.navigateTo('pages/detail/detail', `from=detail&n=${Number(q.n || 0) + 1}`);
};
document.getElementById('back').addEventListener('click', () => miniapp.navigateBack());
