// FoafStore backends over a Linked Web Storage (LWS) storage.
//
// lwsStore({ fetch, base })       async: one JSON resource per app namespace,
//                                 <base>apps/<ns>.json, with ETag / If-Match.
// cachedBackend(store, ...)       the synchronous { read(ns), write(ns, obj) }
//                                 that FoafStore expects: reads come from a local
//                                 copy, writes are sent behind, and a 412 is
//                                 merged key by key (three-way) and retried.
//
// `fetch` may be the browser's fetch (HTTPS to a pod, needs CORS) or
// XmppWs.httpFetch() (XEP-0332 through an XMPP relay). The store cannot tell
// which, and the LWS requests are the same. Design: magpie/miniapps/lws/README.md.

const CONTAINER_TYPE = '<https://www.w3.org/ns/lws#Container>; rel="type"';

export class LwsConflict extends Error {}

export function lwsStore({ fetch, base, container = 'apps/' }) {
  const dir = base + container;
  const urlOf = (ns) => dir + encodeURIComponent(ns) + '.json';
  let ensured = null;

  async function ensureContainer() {
    ensured ||= (async () => {
      const head = await fetch(dir, { method: 'HEAD' });
      if (head.status === 404) {
        const r = await fetch(dir, { method: 'PUT', headers: { Link: CONTAINER_TYPE, 'Content-Type': 'text/turtle' } });
        if (!r.ok) throw new Error(`cannot create ${dir}: ${r.status}`);
      } else if (!head.ok) throw new Error(`cannot reach ${dir}: ${head.status}`);
    })();
    try { await ensured; } catch (e) { ensured = null; throw e; }
  }

  return {
    dir,
    /** { data, etag } — data {} and etag null when the namespace has no resource yet. */
    async read(ns) {
      const r = await fetch(urlOf(ns), { headers: { Accept: 'application/json' } });
      if (r.status === 404) return { data: {}, etag: null };
      if (!r.ok) throw new Error(`GET ${urlOf(ns)}: ${r.status}`);
      return { data: await r.json(), etag: r.headers.get('ETag') };
    },
    /** Write if the stored copy is still `etag` (null: must not exist). Resolves the new ETag. */
    async write(ns, data, etag) {
      await ensureContainer();
      const cond = etag ? { 'If-Match': etag } : { 'If-None-Match': '*' };
      const r = await fetch(urlOf(ns), { method: 'PUT', body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json', ...cond } });
      if (r.status === 412) throw new LwsConflict(`${urlOf(ns)} changed elsewhere`);
      if (!r.ok) throw new Error(`PUT ${urlOf(ns)}: ${r.status}`);
      return r.headers.get('ETag');
    },
    /** The namespaces present: the container listing, read as LWS JSON. */
    async list() {
      const r = await fetch(dir, { headers: { Accept: 'application/lws+json' } });
      if (r.status === 404) return [];
      const doc = await r.json();
      return (doc.items || []).map((it) => decodeURIComponent(String(it.id).slice(dir.length).replace(/\.json$/, '')));
    },
  };
}

/** Three-way merge of flat string maps: keys changed locally win, others follow the remote. */
export function mergeKeys(baseMap, local, remote) {
  const out = { ...remote };
  for (const k of new Set([...Object.keys(baseMap), ...Object.keys(local)])) {
    if (local[k] === baseMap[k]) continue;          // not changed here
    if (k in local) out[k] = local[k]; else delete out[k];
  }
  return out;
}

/**
 * The synchronous backend FoafStore takes. Call `await backend.load(ns)` for each
 * namespace before use; `await backend.flushed()` waits for writes in flight.
 * `onEvent(type, detail)` reports 'synced', 'conflict-merged' and 'error'.
 */
export function cachedBackend(store, { onEvent = () => {} } = {}) {
  const local = new Map();    // ns -> current object
  const synced = new Map();   // ns -> { data, etag } as last agreed with the storage
  const chains = new Map();   // ns -> promise of the write in flight

  async function push(ns) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const base = synced.get(ns) || { data: {}, etag: null };
      const mine = local.get(ns);
      try {
        const etag = await store.write(ns, mine, base.etag);
        synced.set(ns, { data: { ...mine }, etag });
        onEvent('synced', { ns, etag });
        return;
      } catch (e) {
        if (!(e instanceof LwsConflict)) { onEvent('error', { ns, message: e.message }); return; }
        const remote = await store.read(ns);
        const merged = mergeKeys(base.data, mine, remote.data);
        synced.set(ns, remote);
        local.set(ns, merged);
        onEvent('conflict-merged', { ns, remoteEtag: remote.etag });
      }
    }
    onEvent('error', { ns, message: 'gave up after 3 conflicts' });
  }

  return {
    async load(ns) {
      const r = await store.read(ns);
      synced.set(ns, r);
      local.set(ns, { ...r.data });
    },
    read(ns) { return { ...(local.get(ns) || {}) }; },
    write(ns, obj) {
      local.set(ns, { ...obj });
      const prev = chains.get(ns) || Promise.resolve();
      chains.set(ns, prev.then(() => push(ns)));
    },
    flushed() { return Promise.all(chains.values()); },
    snapshot(ns) { return { local: local.get(ns), synced: synced.get(ns) }; },
  };
}
