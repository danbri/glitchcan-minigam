#!/usr/bin/env node
// A home LWS pod: one Factoidal LWS storage, reachable two ways.
//
//   HTTP          a plain listener (for the LAN, or behind a tunnel)
//   XMPP          XEP-0332 "HTTP over XMPP": the pod logs in to an XMPP server
//                 as a client (an OUTBOUND connection, so no port forwarding) and
//                 answers <req xmlns="urn:xmpp:http"/> IQs.
//
// Both carriages call the same storage.step(): the LWS request, its headers
// (Authorization, If-Match, ...) and its answer are byte-identical whichever
// way they travel. Only the framing differs. Design and limits:
// magpie/miniapps/lws/README.md.
//
//   node pod.mjs --base https://pod.example/ --dir ./data \
//     --xmpp xmpp://127.0.0.1:15222 --domain localhost --jid pod --password ... \
//     --allow user@localhost [--http 8787] [--insecure-no-auth]

import { createServer } from 'node:http';
import { parseArgs } from 'node:util';
import { openLwsStorage } from '@factoidal/core/lws';
import { client, xml } from '@xmpp/client';

export const NS_HTTP = 'urn:xmpp:http';
export const NS_SHIM = 'http://jabber.org/protocol/shim';
// Prosody's default c2s stanza limit is 256 KiB; base64 adds a third. Larger
// bodies need XEP-0332 chunking, which this binding does not do yet.
export const MAX_BODY = 160 * 1024;

const TEXTUAL = /^(text\/|application\/([a-z0-9.+-]*\+)?(json|xml|ld\+json|lws\+json|problem\+json|linkset\+json|n-triples|n-quads|trig|turtle))/i;
const decoder = new TextDecoder('utf-8', { fatal: true });

/** XEP-0332 <req> element -> the storage's request record. */
export function requestOf(req) {
  const method = String(req.attrs.method || 'GET').toUpperCase();
  const target = String(req.attrs.resource || '/');
  const headers = [];
  for (const h of req.getChild('headers', NS_SHIM)?.getChildren('header') || []) {
    headers.push([h.attrs.name, h.text()]);
  }
  let body = new Uint8Array(0);
  const data = req.getChild('data');
  if (data) {
    const text = data.getChild('text');
    const b64 = data.getChild('base64');
    if (text) body = new TextEncoder().encode(text.text());
    else if (b64) body = new Uint8Array(Buffer.from(b64.text(), 'base64'));
    else throw Object.assign(new Error('only <text> and <base64> bodies are supported'), { status: 501 });
  }
  return { method, target, headers, body };
}

/** The storage's answer -> XEP-0332 <resp> element. */
export function respOf(answer) {
  const headers = xml('headers', { xmlns: NS_SHIM },
    ...answer.headers.map(([name, value]) => xml('header', { name }, String(value))));
  const children = [headers];
  if (answer.body.length > 0) {
    const type = answer.headers.find(([k]) => k.toLowerCase() === 'content-type')?.[1] || '';
    let asText = null;
    if (TEXTUAL.test(type)) { try { asText = decoder.decode(answer.body); } catch { asText = null; } }
    children.push(xml('data', {}, asText !== null
      ? xml('text', {}, asText)
      : xml('base64', {}, Buffer.from(answer.body).toString('base64'))));
  }
  return xml('resp', { xmlns: NS_HTTP, version: '1.1', statusCode: String(answer.status) }, ...children);
}

const problem = (status, detail) => ({
  status,
  headers: [['Content-Type', 'application/problem+json']],
  body: new TextEncoder().encode(JSON.stringify({ type: 'about:blank', status, detail })),
});

/** Bind a storage to an XMPP account. `allow` is a set of bare JIDs; empty means nobody. */
export async function startXmpp(storage, { service, domain, username, password, resource = 'lws', allow, log = () => {} }) {
  const xmpp = client({ service, domain, username, password, resource });
  xmpp.on('error', (e) => log(`xmpp error: ${e.message}`));
  xmpp.iqCallee.set(NS_HTTP, 'req', async (ctx) => {
    const from = ctx.from?.bare().toString();
    if (!allow.has(from)) return respOf(problem(403, `${from} is not on this pod's allow list`));
    let request;
    try { request = requestOf(ctx.element); } catch (e) { return respOf(problem(e.status || 400, e.message)); }
    if (request.body.length > MAX_BODY) return respOf(problem(413, `body over ${MAX_BODY} bytes; chunking is not implemented`));
    const answer = await storage.step(request);
    if (answer.body.length > MAX_BODY) return respOf(problem(507, `response over ${MAX_BODY} bytes; chunking is not implemented`));
    log(`xmpp ${from} ${request.method} ${request.target} -> ${answer.status}`);
    return respOf(answer);
  });
  await xmpp.start();
  await xmpp.send(xml('presence', {}, xml('status', {}, 'LWS pod')));
  return xmpp;
}

/** A plain HTTP listener over the same storage. */
export function startHttp(storage, { port, host = '127.0.0.1', log = () => {} }) {
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const headers = [];
    for (let i = 0; i + 1 < req.rawHeaders.length; i += 2) headers.push([req.rawHeaders[i], req.rawHeaders[i + 1]]);
    const answer = await storage.step({ method: req.method, target: req.url, headers, body: new Uint8Array(Buffer.concat(chunks)) });
    for (const [k, v] of answer.headers) res.appendHeader(k, String(v));
    res.statusCode = answer.status;
    res.end(answer.body);
    log(`http ${req.method} ${req.url} -> ${answer.status}`);
  });
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: {
    base: { type: 'string' }, dir: { type: 'string' }, http: { type: 'string' },
    xmpp: { type: 'string' }, domain: { type: 'string' }, jid: { type: 'string' }, password: { type: 'string' },
    allow: { type: 'string', default: '' }, 'insecure-no-auth': { type: 'boolean', default: false },
    quiet: { type: 'boolean', default: false },
  } });
  const log = values.quiet ? () => {} : (s) => console.log(s);
  const storage = await openLwsStorage({ baseIri: values.base, dir: values.dir, realClock: true,
    insecureNoAuth: values['insecure-no-auth'] });
  if (values.http) {
    await startHttp(storage, { port: Number(values.http), log });
    log(`http on 127.0.0.1:${values.http}`);
  }
  if (values.xmpp) {
    await startXmpp(storage, { service: values.xmpp, domain: values.domain, username: values.jid,
      password: values.password ?? process.env.POD_PASSWORD, allow: new Set(values.allow.split(',').filter(Boolean)), log });
    log(`xmpp as ${values.jid}@${values.domain}/lws`);
  }
  log('ready');
}
