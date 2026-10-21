// Logic layer: runs once per session, in its own frame, with no DOM to show.
const g = miniapp.global;
let visits = 0;

g.ongloballaunched = async (ev) => {
  const n = Number(await miniapp.invoke('storage.get', { key: 'visits' }).catch(() => 0)) || 0;
  visits = n + 1;
  await miniapp.invoke('storage.set', { key: 'visits', value: String(visits) }).catch(() => {});
};
g.addEventListener('globalshown', () => miniapp.postToView({ kind: 'state', state: 'shown', visits }));
g.addEventListener('globalhidden', () => miniapp.postToView({ kind: 'state', state: 'hidden', visits }));

miniapp.onviewmessage = (msg) => {
  if (msg.kind === 'hello') miniapp.postToView({ kind: 'state', state: g.globalState, visits });
  if (msg.kind === 'throw') throw new Error('a test error from the logic layer');
};
