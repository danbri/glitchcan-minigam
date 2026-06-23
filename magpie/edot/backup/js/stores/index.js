// stores/index.js — registry mapping a backend id to its adapter module.
//
// Every adapter exposes the same opaque-blob interface:
//   put(id, bytes, cfg) · get(id, cfg) -> Uint8Array · list(cfg) -> [{id,size,modified}] · remove(id, cfg)
// plus `id` and `label` strings. cfg is backend-specific (see backup-config.js).

import * as github from './github.js';
import * as s3 from './s3.js';
import * as webdav from './webdav.js';
import * as solid from './solid.js';

export const STORES = { github, s3, webdav, solid };

/** Resolve an adapter by id ('github' | 's3' | 'webdav' | 'solid'). */
export function getStore(backendId) {
  const a = STORES[backendId];
  if (!a) throw new Error(`Unknown backup backend: ${backendId}`);
  return a;
}

/** [{ id, label }] for populating a backend picker. */
export function listStores() {
  return Object.values(STORES).map((a) => ({ id: a.id, label: a.label }));
}
