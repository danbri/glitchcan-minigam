// test-s3-source.mjs — the REAL S3 storage mount (S3ResourceSource) with AWS
// Signature Version 4. Pure Node: (1) verify the SigV4 signer against AWS's
// PUBLISHED test vector (gold-standard crypto correctness), then (2) round-trip
// write/read/list/stat/remove against a fake bucket (request shaping). The live
// network path is not CI-checked (standing headless rule).
import { sigv4, S3ResourceSource, S3_EMPTY_HASH } from './js/resource-source.js';

let fail = 0;
const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };
const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder().decode(b);

// ---- (1) AWS SigV4 published vector: "GET Object" (docs: Signature V4 examples)
//   AKIAIOSFODNN7EXAMPLE / wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY, us-east-1,
//   GET https://examplebucket.s3.amazonaws.com/test.txt, Range bytes=0-9,
//   x-amz-date 20130524T000000Z, empty-payload hash.
//   Expected Signature: f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41
const vec = await sigv4({
  method: 'GET',
  url: 'https://examplebucket.s3.amazonaws.com/test.txt',
  headers: { Range: 'bytes=0-9', 'x-amz-content-sha256': S3_EMPTY_HASH, 'x-amz-date': '20130524T000000Z' },
  payloadHash: S3_EMPTY_HASH,
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1', service: 's3', amzdate: '20130524T000000Z',
});
ok('SigV4 matches the AWS published test vector', vec.signature === 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
ok('SignedHeaders are lowercase + sorted (host;range;…)', vec.signedHeaders === 'host;range;x-amz-content-sha256;x-amz-date');
ok('Authorization is a well-formed AWS4-HMAC-SHA256 credential', /^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/20130524\/us-east-1\/s3\/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/.test(vec.Authorization));

// ---- (2) round-trip against a fake bucket ----------------------------------
const objects = new Map();      // key -> Uint8Array
const calls = [];
function fakeFetch(url, opts = {}) {
  const u = new URL(url);
  const method = opts.method || 'GET';
  const auth = (opts.headers || {}).Authorization || '';
  calls.push({ method, path: u.pathname, search: u.search, auth, cs: (opts.headers || {})['x-amz-content-sha256'] });
  const H = (obj) => ({ get: (k) => obj[k] || obj[k.toLowerCase()] || null });
  const keyOf = (p) => decodeURIComponent(p.replace(/^\/mybucket\/?/, ''));
  if (u.searchParams.get('list-type') === '2') {
    const prefix = u.searchParams.get('prefix') || '';
    const kids = new Set(), contents = [];
    for (const [k, b] of objects) {
      if (!k.startsWith(prefix)) continue; const rest = k.slice(prefix.length);
      if (rest.includes('/')) kids.add(prefix + rest.split('/')[0] + '/');
      else contents.push(`<Contents><Key>${k}</Key><Size>${b.length}</Size></Contents>`);
    }
    const cp = [...kids].map((p) => `<CommonPrefixes><Prefix>${p}</Prefix></CommonPrefixes>`).join('');
    return Promise.resolve({ ok: true, status: 200, headers: H({}), async text() { return `<?xml version="1.0"?><ListBucketResult>${cp}${contents.join('')}</ListBucketResult>`; } });
  }
  const key = keyOf(u.pathname);
  if (method === 'PUT') { objects.set(key, opts.body instanceof Uint8Array ? opts.body : new Uint8Array(opts.body)); return Promise.resolve({ ok: true, status: 200, headers: H({}) }); }
  if (method === 'GET') { if (!objects.has(key)) return Promise.resolve({ ok: false, status: 404, headers: H({}), async text() { return ''; } }); return Promise.resolve({ ok: true, status: 200, headers: H({}), async arrayBuffer() { return objects.get(key).buffer; } }); }
  if (method === 'HEAD') { if (!objects.has(key)) return Promise.resolve({ ok: false, status: 404, headers: H({}) }); return Promise.resolve({ ok: true, status: 200, headers: H({ 'Content-Length': String(objects.get(key).length) }) }); }
  if (method === 'DELETE') { objects.delete(key); return Promise.resolve({ ok: true, status: 204, headers: H({}) }); }
  return Promise.resolve({ ok: false, status: 400, headers: H({}) });
}

const s3 = new S3ResourceSource({ endpoint: 'https://s3.example.com', bucket: 'mybucket', region: 'us-east-1', accessKeyId: 'AKID', secretAccessKey: 'SECRET', fetchImpl: fakeFetch });

ok('it is a remote s3 storage mount', s3.provider === 's3' && s3.capability === 'storage' && s3.locality === 'remote');
await s3.write('/notes/todo.md', enc('# buy milk'));
ok('write then read round-trips over S3', dec(await s3.read('/notes/todo.md')) === '# buy milk');
ok('every request is SigV4-signed', calls.every((c) => /^AWS4-HMAC-SHA256 Credential=AKID\//.test(c.auth)));
ok('a PUT sends the sha256 of the body as x-amz-content-sha256', calls.some((c) => c.method === 'PUT' && /^[0-9a-f]{64}$/.test(c.cs) && c.cs !== S3_EMPTY_HASH));
ok('a GET sends the empty-payload hash', calls.some((c) => c.method === 'GET' && !c.search && c.cs === S3_EMPTY_HASH));

await s3.write('/notes/done.md', enc('shipped'));
await s3.write('/photos/a.txt', enc('x'));
const root = (await s3.list('/')).map((e) => `${e.kind}:${e.name}`);
ok('list of root shows key-prefix folders before files', root.join(',') === 'folder:notes,folder:photos');
const inNotes = (await s3.list('/notes')).map((e) => e.name);
ok('list of a prefix shows its objects', inNotes.join(',') === 'done.md,todo.md');
ok('stat a key reports a file + size', (await s3.stat('/notes/todo.md')).kind === 'file' && (await s3.stat('/notes/todo.md')).size === 10);
ok('stat a missing key is null', (await s3.stat('/nope.md')) === null);
await s3.remove('/notes/done.md');
ok('remove deletes the object', (await s3.stat('/notes/done.md')) === null);
ok('verify() lists the bucket and resolves', await s3.verify() === true);
ok('missing keys are rejected at construction', (() => { try { new S3ResourceSource({ bucket: 'b' }); return false; } catch { return true; } })());

console.log(fail ? `\n${fail} S3-SOURCE FAILURE(S)` : '\nS3-SOURCE OK');
process.exit(fail ? 1 : 0);
