// The foafos-lite conformance checks an app can run on itself, wherever it is: standalone
// (level 0), under @foafos/host-lite, or inside full foafos. The same app, the same checks;
// what a check expects depends only on the level the host granted.
//
//   const results = await runConformance(guest)   // [{ name, ok, detail }]

export async function runConformance(guest) {
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail: String(detail) });
  const lv = guest.level;
  check('a level from 0 to 3 is granted', Number.isInteger(lv) && lv >= 0 && lv <= 3, `level ${lv}`);

  // Storage: the same behaviour whether it is local (level 0 and 1) or the host's (level 2 and up).
  const body = `conformance ${Date.now()}`;
  const put = await guest.store.put('conf/note.txt', body, { contentType: 'text/plain' });
  check('put succeeds', put.ok, JSON.stringify(put));
  const got = await guest.store.get('conf/note.txt');
  check('get returns what was put', got.ok && got.body === body, JSON.stringify(got).slice(0, 120));
  const listed = await guest.store.list('conf');
  check('list shows it', listed.ok && listed.items?.some((i) => i.path === 'note.txt' && !i.container), JSON.stringify(listed.items));
  const top = await guest.store.list('');
  check('list of the top shows the folder', top.ok && top.items?.some((i) => i.path === 'conf/' && i.container), JSON.stringify(top.items));
  check('a path that climbs out is refused', (await guest.store.get('../escape.txt')).reason === 'denied');
  check('a missing file is not-found', (await guest.store.get('conf/missing.txt')).reason === 'not-found');

  if (lv >= 2) {
    // The host versions what it keeps: a write with an old etag is refused, one with the current etag is not.
    const first = await guest.store.put('conf/v.txt', 'one');
    const second = await guest.store.put('conf/v.txt', 'two', { etag: first.etag });
    check('a write with the current etag succeeds', second.ok, JSON.stringify(second));
    const stale = await guest.store.put('conf/v.txt', 'three', { etag: first.etag });
    check('a write with an old etag is a conflict', stale.reason === 'conflict', JSON.stringify(stale));
    await guest.store.delete('conf/v.txt');
  }
  const del = await guest.store.delete('conf/note.txt');
  check('delete succeeds', del.ok, JSON.stringify(del));
  check('after delete, get is not-found', (await guest.store.get('conf/note.txt')).reason === 'not-found');
  return results;
}
