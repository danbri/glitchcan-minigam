// Which apps can open a file. Exploring: see docs/foafos-open-with-20261105.md,
// where the shape of `handles` may still change.
//
// A manifest's `handles` is a list of
//
//   { types: ['text/plain'], extensions: ['txt'], actions: ['view', 'edit'], comment: '...' }
//
// `comment` is free text for people and agents choosing an app: what a schema
// cannot say well, such as a shortfall with one variant of a format. Show it
// whole, and treat it as advice, never as permission.

const TYPE = /^[a-z0-9.+-]+\/[a-z0-9.+*-]+$/i;
const EXT = /^[a-z0-9]+$/i;
const ACTIONS = new Set(['view', 'edit']);

/** What is wrong with a manifest's `handles`, as a list of sentences. */
export function handlesProblems(handles) {
  if (!Array.isArray(handles)) return ['handles must be a list'];
  const out = [];
  handles.forEach((h, i) => {
    const at = `handles[${i}]`;
    if (!h || typeof h !== 'object') { out.push(`${at} must be an object`); return; }
    const types = h.types ?? [], exts = h.extensions ?? [];
    if (!Array.isArray(types) || types.some((t) => !TYPE.test(String(t)))) out.push(`${at}.types must be media types`);
    if (!Array.isArray(exts) || exts.some((e) => !EXT.test(String(e)))) out.push(`${at}.extensions must be names with no dot`);
    if (!types.length && !exts.length) out.push(`${at} must name types or extensions`);
    if (!Array.isArray(h.actions) || !h.actions.length || h.actions.some((a) => !ACTIONS.has(a))) out.push(`${at}.actions must be view, edit or both`);
    if (h.comment !== undefined && typeof h.comment !== 'string') out.push(`${at}.comment must be text`);
  });
  return out;
}

const baseType = (t) => String(t ?? '').split(';')[0].trim().toLowerCase();
const extensionOf = (path) => /\.([^./]+)$/.exec(String(path))?.[1]?.toLowerCase() ?? '';

function typeMatches(pattern, type) {
  const p = pattern.toLowerCase();
  return p === type || (p.endsWith('/*') && type.startsWith(p.slice(0, -1)));
}

/** The apps that can open this file, each with what it can do and its comment. */
export function handlersFor(apps, { path, contentType } = {}) {
  const type = baseType(contentType), ext = extensionOf(path);
  const out = [];
  for (const app of apps) {
    for (const h of Array.isArray(app.handles) ? app.handles : []) {
      const byType = !!type && (h.types || []).some((t) => typeMatches(t, type));
      const byExt = !!ext && (h.extensions || []).some((e) => e.toLowerCase() === ext);
      if (!byType && !byExt) continue;
      out.push({ appId: app.id, name: app.name, icon: app.icon ?? '', actions: [...h.actions], comment: h.comment ?? '' });
      break;
    }
  }
  return out;
}
