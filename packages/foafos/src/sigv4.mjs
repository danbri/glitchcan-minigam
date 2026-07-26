// AWS Signature Version 4, HMAC-SHA256 chain over SubtleCrypto.
//
// Here because the shell signs requests on an app's behalf — the app names
// the outcome ("put this object") and never holds the key. The signer must
// therefore live on the shell side of the boundary, which for this package
// means inside the package: nothing here may import from an application
// directory (the NPM boundary rule), and an S3 op that cannot sign is not
// an op.
//
// Verified against AWS's own published test vector in
// `test/sigv4.test.js` — for signing code, "it looks right" is not a
// standard. Works unchanged in Node (18+) and the browser, because
// `crypto.subtle` is the same API in both.

const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('foafos: crypto.subtle is unavailable, so nothing can be signed');
  return s;
};

export async function sha256hex(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(String(bytes));
  return hex(new Uint8Array(await subtle().digest('SHA-256', b)));
}

async function hmac(keyBytes, msg) {
  const raw = keyBytes instanceof Uint8Array ? keyBytes : new TextEncoder().encode(keyBytes);
  const key = await subtle().importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const data = typeof msg === 'string' ? new TextEncoder().encode(msg) : msg;
  return new Uint8Array(await subtle().sign('HMAC', key, data));
}

/** RFC 3986 as AWS expects it: UTF-8, unreserved unencoded, '/' optional. */
export function awsUriEncode(str, encodeSlash = true) {
  let out = '';
  for (const b of new TextEncoder().encode(String(str))) {
    const c = String.fromCharCode(b);
    if (/[A-Za-z0-9\-_.~]/.test(c)) out += c;
    else if (c === '/' && !encodeSlash) out += '/';
    else out += '%' + b.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}

/** SHA-256 of the empty string — the payload hash for a bodyless request. */
export const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/** YYYYMMDDTHHMMSSZ, the only date format SigV4 accepts. */
export const amzDate = (d = new Date()) =>
  d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * Compute the Authorization header for one request.
 *
 * `secretAccessKey` is the only argument that is a credential; it is used
 * and discarded here, never returned and never logged. The signature it
 * produces is not reversible to it, which is the whole reason an op can
 * be brokered at all.
 */
export async function sigv4({
  method, url, headers = {}, payloadHash,
  accessKeyId, secretAccessKey, region, service = 's3', amzdate,
}) {
  const u = new URL(url);
  const datestamp = amzdate.slice(0, 8);
  const lower = { host: u.host };
  for (const k of Object.keys(headers)) lower[k.toLowerCase()] = String(headers[k]).trim();
  const names = Object.keys(lower).sort();
  const canonicalHeaders = names.map((k) => `${k}:${lower[k]}\n`).join('');
  const signedHeaders = names.join(';');
  const params = [...u.searchParams.entries()]
    .map(([k, v]) => [awsUriEncode(k), awsUriEncode(v)])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const canonicalQuery = params.map(([k, v]) => `${k}=${v}`).join('&');
  const canonicalUri = awsUriEncode(decodeURIComponent(u.pathname), false);
  const canonicalRequest = [
    method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash,
  ].join('\n');
  const scope = `${datestamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256', amzdate, scope, await sha256hex(canonicalRequest),
  ].join('\n');
  let k = await hmac('AWS4' + secretAccessKey, datestamp);
  k = await hmac(k, region);
  k = await hmac(k, service);
  k = await hmac(k, 'aws4_request');
  const signature = hex(await hmac(k, stringToSign));
  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
                   `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    signedHeaders, signature,
  };
}
