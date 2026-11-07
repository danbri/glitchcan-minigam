// A read-only WebDAV server (RFC 4918, class 1) over a small backend. It knows nothing
// about pods: pod-davmount.mjs gives it a backend. No dependencies.
//
// It does not use `factoidal webdav-serve` (@factoidal/core 0.33.0): that server takes
// only its own mount kinds, refuses every "kind: local" mount at start (issue 1147), and
// a local mount would take lws.lock. README "pod-davmount" has the detail.
//
// THE BACKEND. A path is a percent-encoded absolute URL path in the form canonical()
// gives; a collection ends in '/'.
//
//   stat(path)  -> Info | null     null: nothing there. A collection is found with or
//                                  without its '/'. Info.path is the path with it.
//   list(path)  -> Info[]          the members of a collection, not the collection
//   read(path, {start, end, etag}) -> async iterable of bytes
//                                  start and end are inclusive and optional. It must
//                                  throw before the first byte when `etag` is no longer
//                                  the current version.
//
//   Info = {path, collection, size, contentType, mtime, etag}
//          mtime is milliseconds or null; etag is a quoted HTTP entity tag or null.
//
// Any throw from a backend is a 503 with no detail.

import { createServer } from 'node:http';
import { pipeline } from 'node:stream/promises';

const LOOPBACK = '127.0.0.1';
const ALLOW = 'OPTIONS, GET, HEAD, PROPFIND';
const MAX_PROPFIND_BYTES = 64 * 1024;
const NAME = '[A-Za-z_][\\w.-]*';

/** A request target -> the canonical path, or null for anything that is not a plain path. */
export function canonical(target) {
  if (typeof target !== 'string' || !target.startsWith('/')) return null;
  const segments = target.split(/[?#]/, 1)[0].split('/').slice(1);
  const out = [];
  for (let i = 0; i < segments.length; i += 1) {
    if (segments[i] === '') {
      if (i !== segments.length - 1) return null;   // '//' inside a path
      out.push('');
      continue;
    }
    let name;
    try { name = decodeURIComponent(segments[i]); } catch { return null; }
    if (name === '.' || name === '..' || /[\\\0]/.test(name)) return null;
    out.push(encodeURIComponent(name));
  }
  return `/${out.join('/')}`;
}

const escaped = (value) => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

/**
 * The body of a PROPFIND -> `{mode: 'allprop'|'propname'}` or `{mode: 'prop', props: [{ns, name}]}`.
 * Throws on anything else. A small scanner with namespaces, enough for this one element
 * type: it keeps the tool free of dependencies, and it has no DTD or entity support to attack.
 */
export function parsePropfind(text) {
  if (text.trim() === '') return { mode: 'allprop' };
  const tag = new RegExp(`^<(/?)(?:(${NAME}):)?(${NAME})((?:\\s+[\\w.:-]+\\s*=\\s*(?:"[^"<]*"|'[^'<]*'))*)\\s*(/?)>`);
  const attribute = /([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  const stack = [];
  const props = [];
  let mode = null;
  let rootSeen = false;
  let at = 0;
  while (at < text.length) {
    const next = text.indexOf('<', at);
    if (next < 0) { if (text.slice(at).trim() !== '') throw new Error('text outside the root'); break; }
    if (stack.length === 0 && text.slice(at, next).trim() !== '' && !(at === 0 && text.charCodeAt(0) === 0xfeff)) throw new Error('text outside the root');
    at = next;
    if (text.startsWith('<?', at)) { at = text.indexOf('?>', at) + 2; if (at < 2) throw new Error('open declaration'); continue; }
    if (text.startsWith('<!--', at)) { at = text.indexOf('-->', at) + 3; if (at < 3) throw new Error('open comment'); continue; }
    const m = tag.exec(text.slice(at));
    if (!m) throw new Error('not a tag');   // this also refuses <!DOCTYPE and <![CDATA[
    at += m[0].length;
    const [, close, prefix = '', local, attrs, empty] = m;
    if (close) {
      const open = stack.pop();
      if (!open || open.tag !== (prefix ? `${prefix}:${local}` : local)) throw new Error('tags do not match');
      continue;
    }
    const scope = { ...(stack.at(-1)?.scope ?? { '': '' }) };
    for (const [, name, double, single] of attrs.matchAll(attribute)) {
      if (name === 'xmlns') scope[''] = double ?? single;
      else if (name.startsWith('xmlns:')) scope[name.slice(6)] = double ?? single;
    }
    const ns = scope[prefix];
    if (ns === undefined) throw new Error('prefix with no namespace');
    if (stack.length === 0) {
      if (rootSeen || ns !== 'DAV:' || local !== 'propfind') throw new Error('not a propfind');
      rootSeen = true;
    } else if (stack.length === 1 && ns === 'DAV:' && ['allprop', 'propname', 'prop'].includes(local)) {
      if (mode !== null) throw new Error('more than one request');
      mode = local;
    } else if (stack.length === 2 && stack[1].local === 'prop') {
      props.push({ ns, name: local });
    }
    if (!empty) stack.push({ tag: prefix ? `${prefix}:${local}` : local, local, scope });
  }
  if (stack.length !== 0 || !rootSeen || mode === null) throw new Error('not a complete propfind');
  return mode === 'prop' ? { mode, props } : { mode };
}

/** The live properties of a resource, as DAV: local name -> inner XML. */
function liveProps(info, displayName) {
  const props = new Map([
    ['displayname', escaped(displayName)],
    ['resourcetype', info.collection ? '<D:collection/>' : ''],
  ]);
  if (info.mtime !== null) props.set('getlastmodified', new Date(info.mtime).toUTCString());
  if (info.etag) props.set('getetag', escaped(info.etag));
  if (!info.collection) {
    props.set('getcontentlength', String(info.size));
    props.set('getcontenttype', escaped(info.contentType));
  }
  return props;
}

const element = (name, inner) => (inner === '' ? `<D:${name}/>` : `<D:${name}>${inner}</D:${name}>`);
const propstat = (inner, status) => `<D:propstat><D:prop>${inner}</D:prop><D:status>HTTP/1.1 ${status}</D:status></D:propstat>`;

function displayNameOf(path) {
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
  if (trimmed === '') return '/';
  return decodeURIComponent(trimmed.slice(trimmed.lastIndexOf('/') + 1));
}

function responseXml(info, request) {
  const live = liveProps(info, displayNameOf(info.path));
  let found = '';
  let missing = '';
  if (request.mode === 'allprop') {
    for (const [name, inner] of live) found += element(name, inner);
  } else if (request.mode === 'propname') {
    for (const name of live.keys()) found += `<D:${name}/>`;
  } else {
    for (const { ns, name } of request.props) {
      if (ns === 'DAV:' && live.has(name)) found += element(name, live.get(name));
      else missing += `<${name} xmlns="${escaped(ns)}"/>`;
    }
  }
  return `<D:response><D:href>${escaped(info.path)}</D:href>${
    found ? propstat(found, '200 OK') : ''}${missing ? propstat(missing, '404 Not Found') : ''}</D:response>`;
}

const multistatus = (body) => `<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:">${body}</D:multistatus>\n`;

/** `Range: bytes=...` over `size` bytes -> {start, end}, 'unsatisfiable', or null to send it all. */
function rangeOf(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!m || (m[1] === '' && m[2] === '') || size === 0) return null;
  let start;
  let end;
  if (m[1] === '') {
    start = Math.max(size - Number(m[2]), 0);
    end = size - 1;
    if (Number(m[2]) === 0) return 'unsatisfiable';
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
    if (m[2] !== '' && Number(m[2]) < start) return null;
  }
  return start >= size ? 'unsatisfiable' : { start, end };
}

function notModified(req, info) {
  const none = req.headers['if-none-match'];
  if (none !== undefined) {
    return none.trim() === '*' || (info.etag !== null && none.split(',').some((tag) => tag.trim().replace(/^W\//, '') === info.etag));
  }
  const since = Date.parse(req.headers['if-modified-since'] ?? '');
  return info.mtime !== null && !Number.isNaN(since) && Math.floor(info.mtime / 1000) * 1000 <= since;
}

function finish(res, status, headers = {}, body = '') {
  res.writeHead(status, { 'Content-Length': Buffer.byteLength(body), ...headers });
  res.end(body);
}

const plain = (res, status, text, headers = {}) => finish(res, status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers }, `${text}\n`);

async function requestBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_PROPFIND_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function propfind(req, res, backend, path) {
  const depth = req.headers.depth ?? 'infinity';
  if (depth !== '0' && depth !== '1') {
    req.resume();
    return finish(res, 403, { 'Content-Type': 'application/xml; charset=utf-8' },
      '<?xml version="1.0" encoding="utf-8"?>\n<D:error xmlns:D="DAV:"><D:propfind-finite-depth/></D:error>\n');
  }
  const text = await requestBody(req);
  if (text === null) return plain(res, 413, 'request body too large', { Connection: 'close' });
  let request;
  try { request = parsePropfind(text); } catch { return plain(res, 400, 'not a PROPFIND body'); }
  const info = await backend.stat(path);
  if (info === null) return plain(res, 404, 'not found');
  const members = info.collection && depth === '1' ? await backend.list(info.path) : [];
  const xml = multistatus([info, ...members].map((member) => responseXml(member, request)).join(''));
  return finish(res, 207, { 'Content-Type': 'application/xml; charset=utf-8' }, xml);
}

async function get(req, res, backend, path) {
  const head = req.method === 'HEAD';
  const info = await backend.stat(path);
  if (info === null) return plain(res, 404, 'not found');
  // Pod content runs in no origin here: a stored page cannot read the rest of the pod.
  const common = { 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox' };
  if (info.mtime !== null) common['Last-Modified'] = new Date(info.mtime).toUTCString();
  if (info.etag) common.ETag = info.etag;
  if (info.collection) {
    const names = (await backend.list(info.path)).map((m) => displayNameOf(m.path) + (m.collection ? '/' : ''));
    const body = names.length ? `${names.join('\n')}\n` : '';
    res.writeHead(200, { ...common, 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
    return res.end(head ? '' : body);
  }
  common['Accept-Ranges'] = 'bytes';
  if (notModified(req, info)) return finish(res, 304, common);
  const ifRange = req.headers['if-range'];
  const range = ifRange === undefined || ifRange === info.etag ? rangeOf(req.headers.range, info.size) : null;
  if (range === 'unsatisfiable') return finish(res, 416, { ...common, 'Content-Range': `bytes */${info.size}` });
  const headers = { ...common, 'Content-Type': info.contentType };
  const options = { etag: info.etag };
  let status = 200;
  let length = info.size;
  if (range) {
    status = 206;
    length = range.end - range.start + 1;
    headers['Content-Range'] = `bytes ${range.start}-${range.end}/${info.size}`;
    Object.assign(options, range);
  }
  headers['Content-Length'] = length;
  if (head) { res.writeHead(status, headers); return res.end(); }
  const bytes = await backend.read(info.path, options);
  res.writeHead(status, headers);
  return pipeline(bytes, res);
}

/** An HTTP server that serves `backend` read-only. Listen with listenDav(). */
export function createDavServer(backend) {
  const handle = async (req, res) => {
    const { port } = req.socket.address();
    // A page on a name that resolves to this address (DNS rebinding) comes with its own Host.
    if (![`${LOOPBACK}:${port}`, `localhost:${port}`].includes(req.headers.host)) {
      req.resume();
      return plain(res, 421, 'this server answers only its loopback names');
    }
    const foreignOrigin = req.headers.origin !== undefined
      && ![`http://${LOOPBACK}:${port}`, `http://localhost:${port}`].includes(req.headers.origin);
    if (foreignOrigin || req.headers['sec-fetch-site'] === 'cross-site') {
      req.resume();
      return plain(res, 403, 'no cross-site requests');
    }
    switch (req.method) {
      case 'OPTIONS':
        req.resume();
        return finish(res, 200, { DAV: '1', Allow: ALLOW, 'MS-Author-Via': 'DAV' });
      case 'GET':
      case 'HEAD':
      case 'PROPFIND':
        break;
      default:
        // Sent before a body arrives (see checkContinue), so the socket cannot be reused.
        req.resume();
        return plain(res, 405, 'this WebDAV server is read-only', { Allow: ALLOW, Connection: 'close' });
    }
    const path = canonical(req.url);
    if (path === null) { req.resume(); return plain(res, 404, 'not found'); }
    if (req.method === 'PROPFIND') return propfind(req, res, backend, path);
    req.resume();
    return get(req, res, backend, path);
  };
  const guarded = (req, res) => handle(req, res).catch(() => {
    if (res.headersSent) res.destroy();
    else plain(res, 503, 'the source did not answer', { 'Retry-After': '1' });
  });
  const server = createServer(guarded);
  // Without this listener Node sends "100 Continue" and asks for a body that is refused.
  server.on('checkContinue', (req, res) => {
    if (req.method === 'PROPFIND') res.writeContinue();
    guarded(req, res);
  });
  return server;
}

/** Listen on 127.0.0.1 only. There is no option for another address. */
export function listenDav(backend, { port = 0 } = {}) {
  const server = createDavServer(backend);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, LOOPBACK, () => {
      server.off('error', reject);
      const bound = server.address().port;
      resolve({
        server, port: bound, url: `http://${LOOPBACK}:${bound}/`,
        close: () => new Promise((done) => { server.close(done); server.closeAllConnections(); }),
      });
    });
  });
}
