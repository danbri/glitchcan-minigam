// Logic layer of the suite: counts sessions and answers the home page.
const g = miniapp.global;
let sessions = 0;
g.ongloballaunched = async () => {
  sessions = Number(await miniapp.invoke('storage.get', { key: 'sessions' }).catch(() => 0)) || 0;
  sessions += 1;
  await miniapp.invoke('storage.set', { key: 'sessions', value: String(sessions) }).catch(() => {});
};
miniapp.onviewmessage = (msg) => {
  if (msg?.kind === 'hello') miniapp.postToView({ kind: 'sessions', sessions });
  if (msg?.kind === 'throw') throw new Error('a test error from the logic layer');
};
