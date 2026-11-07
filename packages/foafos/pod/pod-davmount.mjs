#!/usr/bin/env node
// Show a Foafos home pod as a WebDAV server, so that Finder can mount it.
//
//   node pod-davmount.mjs DIR [--port N]
//
// Stage 1: a local pod directory, read-only, on 127.0.0.1 only. It prints the mount line
// (http://127.0.0.1:PORT/) on standard output: in Finder, Go > Connect to Server.
//
// It takes no lock and writes nothing, so it runs beside a running pod, and it reads the
// index again when the index or the journal changes. It reads the files directly, so the
// pod's access control does not apply: any process on this machine that reaches the port
// reads the whole pod. Stop it with Ctrl-C.
//
// This file holds the source (the backend). The WebDAV side is pod-dav.mjs, which has the
// backend interface. README "pod-davmount" lists the later stages (remote LWS over HTTPS,
// LWS over XMPP): each is a new backend here, with no change to pod-dav.mjs.
//
// Exit: 2 a usage fault, a directory it cannot read, or a port it cannot bind.

import { constants, realpathSync, statSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { canonical, listenDav } from './pod-dav.mjs';
import { INDEX_FILE, JOURNAL_FILE, PodReadError, bodyName, childrenOf, readPod } from './pod-read.mjs';

const COLLECTION_KINDS = new Set(['container', 'storageRoot']);

/** The state of a pod as backend records. Auxiliary resources (metadata, linksets) are not shown. */
function viewOf(state) {
  const infos = new Map();
  for (const e of state.entries.values()) {
    const collection = COLLECTION_KINDS.has(e.kind);
    if (!collection && e.kind !== 'dataResource') continue;
    const path = canonical(e.path);
    if (path === null) continue;
    infos.set(path, {
      path, collection, size: collection ? 0 : e.size,
      contentType: /^[\x20-\x7e]+$/.test(e.contentType) ? e.contentType : 'application/octet-stream',
      mtime: e.mtime ? e.mtime * 1000 : null, etag: collection ? null : `"${e.body ?? 'empty'}-${e.size}-${e.fnv}"`, body: e.body,
    });
  }
  const tree = childrenOf(infos.keys());
  for (const path of tree.keys()) {
    if (!infos.has(path)) infos.set(path, { path, collection: true, size: 0, contentType: '', mtime: null, etag: null, body: null });
  }
  return { infos, tree };
}

/** The backend of a local pod directory. Paths never reach the file system: a path finds
 *  an index entry, and an entry's body number names the file. */
export function localPodBackend(dir) {
  const root = resolve(dir);
  let view = null;
  let seen = '';
  const signature = () => [INDEX_FILE, JOURNAL_FILE].map((name) => {
    try {
      const s = statSync(join(root, name));
      return `${s.ino}:${s.size}:${s.mtimeMs}`;
    } catch { return '-'; }
  }).join('|');
  const current = () => {
    const now = signature();
    if (view === null || now !== seen) {
      const state = readPod(root);
      if (state.sealed) throw new PodReadError(`${root} is sealed under a storage key: stage 1 reads clear storages only`);
      view = viewOf(state);
      seen = now;
    }
    return view;
  };
  const find = (path) => {
    const { infos } = current();
    return infos.get(path) ?? (path.endsWith('/') ? null : infos.get(`${path}/`) ?? null);
  };
  return {
    async stat(path) { return find(path); },
    async list(path) {
      const { infos, tree } = current();
      return (tree.get(path) ?? []).map((child) => infos.get(child));
    },
    async read(path, { start, end, etag } = {}) {
      const info = find(path);
      if (info === null || (etag && info.etag !== etag)) throw new Error('the resource changed');
      if (info.body === null) return [];
      const handle = await open(join(root, bodyName(info.body)), constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        if ((await handle.stat()).size !== info.size) throw new Error('the body file differs from the index');
      } catch (e) {
        await handle.close();
        throw e;
      }
      return handle.createReadStream({ start, end });
    },
  };
}

async function main() {
  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({ allowPositionals: true, options: { port: { type: 'string', default: '0' } } }));
  } catch { positionals = []; }
  const port = Number(values?.port);
  if (positionals.length !== 1 || !Number.isInteger(port) || port < 0 || port > 65535) {
    console.error('usage: pod-davmount DIR [--port N]');
    process.exit(2);
  }
  const backend = localPodBackend(positionals[0]);
  let running;
  try {
    await backend.stat('/');
    running = await listenDav(backend, { port });
  } catch (e) {
    console.error(`pod-davmount: ${e instanceof PodReadError ? e.message : e.code === 'EADDRINUSE' ? `port ${port} is in use` : `unexpected fault (${e.name})`}`);
    process.exit(2);
  }
  console.log(running.url);
  console.error('read-only; any process on this machine can read this pod through the port; Ctrl-C stops it');
  const stop = () => running.close().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
