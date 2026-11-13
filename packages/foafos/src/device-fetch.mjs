// deviceFetch: a directory on this device, answering as a pod does.
//
// A FileSystemDirectoryHandle is either a real folder the person chose, or the
// browser's private storage (OPFS). Both answer here in the HTTP that FoafPods
// already speaks, so the pod verbs, their grants and their conflict checks work
// the same as on any other pod. Design: docs/foafos-where-files-live-20261105.md.

const TYPES = [
  [/\.(txt|text|log)$/i, 'text/plain'], [/\.md$/i, 'text/markdown'], [/\.html?$/i, 'text/html'], [/\.css$/i, 'text/css'],
  [/\.m?js$/i, 'text/javascript'], [/\.json$/i, 'application/json'], [/\.jsonld$/i, 'application/ld+json'],
  [/\.ttl$/i, 'text/turtle'], [/\.nt$/i, 'application/n-triples'], [/\.nq$/i, 'application/n-quads'], [/\.trig$/i, 'application/trig'],
  [/\.xml$/i, 'application/xml'], [/\.svg$/i, 'image/svg+xml'], [/\.csv$/i, 'text/csv'],
  [/\.png$/i, 'image/png'], [/\.jpe?g$/i, 'image/jpeg'], [/\.gif$/i, 'image/gif'], [/\.webp$/i, 'image/webp'],
  [/\.mp3$/i, 'audio/mpeg'], [/\.wav$/i, 'audio/wav'], [/\.mp4$/i, 'video/mp4'], [/\.pdf$/i, 'application/pdf'],
  // More sound, video and pictures that browsers play or show, so Files can preview them.
  [/\.webm$/i, 'video/webm'], [/\.ogv$/i, 'video/ogg'], [/\.mov$/i, 'video/quicktime'], [/\.m4v$/i, 'video/mp4'],
  [/\.(ogg|oga|opus)$/i, 'audio/ogg'], [/\.m4a$/i, 'audio/mp4'], [/\.aac$/i, 'audio/aac'], [/\.flac$/i, 'audio/flac'],
  [/\.avif$/i, 'image/avif'],
];
const MAX_READ = 8 * 1024 * 1024;   // more than a pod verb may carry: refuse before reading it into memory
export const typeOf = (name) => TYPES.find(([re]) => re.test(name))?.[1] || 'application/octet-stream';
const etagOf = (file) => `"${file.size}-${file.lastModified}"`;
const status = (code, headers = {}) => new Response(null, { status: code, headers });
const missing = (e) => e?.name === 'NotFoundError' || e?.name === 'TypeMismatchError';

/** The path's names below `base`, or null if it leaves `base` or names anything odd. */
function namesOf(url, base) {
  if (!url.startsWith(base)) return null;
  const rest = url.slice(base.length).split(/[?#]/)[0];
  if (rest === '') return [];
  let names;
  try { names = rest.replace(/\/$/, '').split('/').map(decodeURIComponent); } catch { return null; }
  return names.every((n) => n !== '' && n !== '.' && n !== '..' && !/[/\\\0]/.test(n)) ? names : null;
}

async function dirAt(root, names, create = false) {
  let d = root;
  for (const n of names) d = await d.getDirectoryHandle(n, { create });
  return d;
}

async function fileAt(root, names) {
  const dir = await dirAt(root, names.slice(0, -1));
  return dir.getFileHandle(names[names.length - 1]);
}

/**
 * @param root  a FileSystemDirectoryHandle
 * @param base  the pod's base IRI, ending in "/". It is never fetched.
 * @returns     a fetch: (url, init) => Promise<Response>
 */
export function deviceFetch(root, base) {
  async function container(url, names, head) {
    const dir = await dirAt(root, names);
    if (head) return status(200, { 'Content-Type': 'application/lws+json' });
    const items = [];
    for await (const [name, h] of dir.entries()) {
      const id = url.replace(/\/?$/, '/') + encodeURIComponent(name) + (h.kind === 'directory' ? '/' : '');
      if (h.kind === 'directory') { items.push({ id, type: 'Container' }); continue; }
      // As an LWS listing does: each file's size, type and modification time (getFile reads metadata, not bytes).
      const file = await h.getFile();
      items.push({ id, type: 'DataResource', format: typeOf(name), size: file.size, modified: new Date(file.lastModified).toISOString().replace(/\.\d{3}Z$/, 'Z') });
    }
    return new Response(JSON.stringify({ id: url, type: 'Container', items }), { status: 200, headers: { 'Content-Type': 'application/lws+json' } });
  }

  async function read(names, head) {
    const file = await (await fileAt(root, names)).getFile();
    const headers = { 'Content-Type': typeOf(names[names.length - 1]), ETag: etagOf(file), 'Content-Length': String(file.size) };
    if (!head && file.size > MAX_READ) return status(413, headers);
    return new Response(head ? null : await file.arrayBuffer(), { status: 200, headers });
  }

  async function currentEtag(names) {
    try { return etagOf(await (await fileAt(root, names)).getFile()); } catch (e) { if (missing(e)) return null; throw e; }
  }

  async function write(url, names, init) {
    const h = init.headers || {};
    if (url.endsWith('/')) { await dirAt(root, names, true); return status(201); }
    if (!names.length) return status(405);
    const now = await currentEtag(names);
    if (h['If-None-Match'] === '*' && now) return status(412);
    if (h['If-Match'] && h['If-Match'] !== now) return status(412);
    const dir = await dirAt(root, names.slice(0, -1));
    const handle = await dir.getFileHandle(names[names.length - 1], { create: true });
    const out = await handle.createWritable();
    await out.write(init.body ?? '');
    await out.close();
    return status(now ? 204 : 201, { ETag: etagOf(await handle.getFile()) });
  }

  async function remove(url, names, init) {
    if (!names.length) return status(405);
    const ifMatch = (init.headers || {})['If-Match'];
    if (ifMatch && !url.endsWith('/') && ifMatch !== await currentEtag(names)) return status(412);
    const dir = await dirAt(root, names.slice(0, -1));
    try { await dir.removeEntry(names[names.length - 1]); } catch (e) {
      if (e?.name === 'InvalidModificationError') return status(409);   // a folder with things in it
      throw e;
    }
    return status(204);
  }

  return async function fetchDevice(url, init = {}) {
    const names = namesOf(String(url), base);
    if (names === null) return status(400);
    const method = init.method || 'GET';
    try {
      if (method === 'PUT') return await write(String(url), names, init);
      if (method === 'DELETE') return await remove(String(url), names, init);
      if (method !== 'GET' && method !== 'HEAD') return status(405);
      const head = method === 'HEAD';
      if (String(url).endsWith('/') || !names.length) return await container(String(url), names, head);
      return await read(names, head);
    } catch (e) {
      if (missing(e)) return status(404);
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') return status(403);
      throw e;
    }
  };
}
