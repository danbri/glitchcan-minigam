#!/usr/bin/env node
// Summarise a Foafos home pod directory: read-only and offline.
//
//   node pod-summary.mjs DIR [--json]
//
// Prints the tree, sizes, content types, dates, the grant count and orphan bodies (body
// files that no entry uses). It works while a running pod holds lws.lock and it changes
// no file. It prints no key, token or signing key, in any mode.
//
// It does not use the Factoidal API: @factoidal/core/lws 0.33.0 cannot open a store
// read-only (openLwsStorage takes the lock and compacts the journal). So it reads the
// index and the journal as files. See pod-read.mjs.
//
// Exit: 0 a summary; 2 a usage fault or a directory it cannot read.

import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { PodReadError, bodyName, childrenOf, nameOf, otherFiles, readLock, readPod, scanBodies } from './pod-read.mjs';

const isoOf = (seconds) => (seconds ? new Date(seconds * 1000).toISOString().replace('.000Z', 'Z') : null);

function orphanReason(file, state) {
  if (file.number === null) return 'temporary';
  if (state.pending.has(file.number)) return 'pending-remove';
  if (file.number >= state.nextBody) return 'not-yet-recorded';
  return 'unused';
}

/** The report. Built field by field from pod-read.mjs results: nothing else reaches it. */
export function summarize(dir) {
  const root = resolve(dir);
  const state = readPod(root);
  const bodies = scanBodies(root);
  const base = {
    dir: root, format: state.format, sealed: state.sealed, lock: readLock(root),
    bodyFiles: { count: bodies.length, bytes: bodies.reduce((sum, b) => sum + b.size, 0) },
    otherFiles: otherFiles(root),
  };
  if (state.sealed) {
    return { ...base, note: 'the index is sealed under a storage key, and this tool holds no key: no tree, no grant count, no orphans' };
  }
  const entries = [...state.entries.values()];
  const used = new Set(entries.map((e) => e.body).filter((b) => b !== null));
  const onDisk = new Map(bodies.filter((b) => b.number !== null).map((b) => [b.number, b]));
  const contentTypes = {};
  const list = [];
  const bodyProblems = [];
  for (const e of entries) {
    const collection = e.kind === 'container' || e.kind === 'storageRoot';
    if (!collection) contentTypes[e.contentType] = (contentTypes[e.contentType] ?? 0) + 1;
    list.push({ path: e.path, kind: e.kind, contentType: collection ? null : e.contentType,
      size: collection ? null : e.size, modified: isoOf(e.mtime), body: e.body === null ? null : bodyName(e.body) });
    if (e.body === null) continue;
    const file = onDisk.get(e.body);
    if (!file) bodyProblems.push({ path: e.path, body: bodyName(e.body), problem: 'missing' });
    else if (file.size !== e.size) bodyProblems.push({ path: e.path, body: bodyName(e.body), problem: 'size differs from the index' });
  }
  list.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const orphans = bodies.filter((b) => b.number === null || !used.has(b.number))
    .map((b) => ({ file: b.name, size: b.size, modified: isoOf(b.mtime), reason: orphanReason(b, state) }));
  const containers = list.filter((e) => e.size === null).length;
  return {
    ...base, seq: state.seq, indexSeq: state.indexSeq, journal: state.journal,
    totals: { resources: list.length, containers, files: list.length - containers,
      bytes: list.reduce((sum, e) => sum + (e.size ?? 0), 0) },
    contentTypes, grants: state.grants, accessRequests: state.accessRequests, subscriptions: state.subscriptions,
    entries: list, orphans, bodyProblems,
  };
}

/** Control characters from a pod must not reach the terminal. */
const shown = (value) => String(value).replace(/[\u0000-\u001f\u007f-\u009f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`);

function sizeOf(bytes) {
  if (bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(1)} ${units[unit]}`;
}

const dateOf = (iso) => (iso ? iso.slice(0, 16).replace('T', ' ') : '-');

function lockLine(lock) {
  if (!lock.present) return 'none';
  const state = lock.alive === true ? 'running' : lock.alive === false ? 'not running (stale lock)' : 'unknown';
  return `pid ${lock.pid ?? '?'}, ${state}${lock.command ? `, ${lock.command}` : ''}${lock.started ? `, since ${lock.started}` : ''}`;
}

/** The report as lines of text. */
export function render(report) {
  const out = [`pod      ${shown(report.dir)}`, `format   ${report.format}`, `lock     ${lockLine(report.lock)}`];
  const files = `${report.bodyFiles.count} (${sizeOf(report.bodyFiles.bytes)})`;
  if (report.sealed) {
    out.push(`bodies   ${files}`, `note     ${report.note}`);
  } else {
    const { journal: j, totals: t } = report;
    out.push(`state    record ${report.seq} (index at ${report.indexSeq}, ${j.records} journal records${j.unreadBytes ? `, ${j.unreadBytes} unread journal bytes` : ''})`,
      `content  ${t.files} files, ${t.containers} containers, ${sizeOf(t.bytes)}`,
      `bodies   ${files}`,
      `grants   ${report.grants}`,
      `requests ${report.accessRequests} access requests, ${report.subscriptions} subscriptions`,
      '', 'content types');
    for (const [type, n] of Object.entries(report.contentTypes).sort()) out.push(`  ${String(n).padStart(5)}  ${shown(type)}`);
    out.push('', 'tree');
    const byPath = new Map(report.entries.map((e) => [e.path, e]));
    const tree = childrenOf(byPath.keys());
    const walk = (path, depth) => {
      const e = byPath.get(path);
      const label = path === '/' ? '/' : `${nameOf(path)}${path.endsWith('/') ? '/' : ''}`;
      out.push(`${sizeOf(e?.size ?? null).padStart(10)}  ${dateOf(e?.modified).padEnd(16)}  ${'  '.repeat(depth)}${shown(label)}${e?.contentType ? `  (${shown(e.contentType)})` : ''}`);
      for (const child of tree.get(path) ?? []) walk(child, depth + 1);
    };
    walk('/', 0);
    out.push('', `orphan bodies: ${report.orphans.length}`);
    for (const o of report.orphans) out.push(`${sizeOf(o.size).padStart(10)}  ${dateOf(o.modified).padEnd(16)}  ${shown(o.file)}  ${o.reason}`);
    if (report.bodyProblems.length) {
      out.push('', `body problems: ${report.bodyProblems.length}`);
      for (const p of report.bodyProblems) out.push(`  ${shown(p.path)}: ${p.problem} (${shown(p.body)})`);
    }
  }
  if (report.otherFiles.length) out.push('', `other files: ${report.otherFiles.map(shown).join(', ')}`);
  return out.join('\n');
}

function main() {
  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({ allowPositionals: true, options: { json: { type: 'boolean', default: false } } }));
  } catch { positionals = []; }
  if (positionals.length !== 1) {
    console.error('usage: pod-summary DIR [--json]');
    process.exit(2);
  }
  try {
    const report = summarize(positionals[0]);
    console.log(values.json ? JSON.stringify(report, null, 2) : render(report));
  } catch (e) {
    // Only PodReadError text is known to be free of file content.
    console.error(`pod-summary: ${e instanceof PodReadError ? e.message : `unexpected fault (${e.name})`}`);
    process.exit(2);
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
