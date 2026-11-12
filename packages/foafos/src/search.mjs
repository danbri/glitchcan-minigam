// Text search over a pod: an inverted index of its textual resources, held by the shell.
//
// What it promises (and the tests check): a search returns only paths the index holds, every
// path it returns contains every word of the query, and every indexed path that contains every
// word is returned (up to `limit`). Keeping it fresh is the caller's job: `put` and `remove` on
// each write and delete give the same index as building it again from the pod.
// Who may see a result is not decided here: the caller filters by the asker's scope
// (FoafPods.invoke), so an app never learns of a file outside what it may read.

/** Words: letters and digits in any script, lower case, accents folded (café → cafe). */
export function words(text) {
  return String(text).normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

export const MAX_INDEXED_BYTES = 32 * 1024 * 1024;   // all text held, across the pod

export class TextIndex {
  constructor() {
    this.docs = new Map();      // path -> text
    this.terms = new Map();     // term -> Map(path -> count)
    this.bytes = 0;
  }

  /** Index (or re-index) one resource's text. Returns false if over the size budget. */
  put(path, text) {
    this.remove(path);
    const t = String(text);
    if (this.bytes + t.length > MAX_INDEXED_BYTES) return false;
    this.docs.set(path, t);
    this.bytes += t.length;
    for (const w of words(t)) {
      let m = this.terms.get(w);
      if (!m) this.terms.set(w, (m = new Map()));
      m.set(path, (m.get(path) || 0) + 1);
    }
    return true;
  }

  remove(path) {
    const t = this.docs.get(path);
    if (t === undefined) return;
    this.docs.delete(path);
    this.bytes -= t.length;
    for (const w of new Set(words(t))) {
      const m = this.terms.get(w);
      m?.delete(path);
      if (m && !m.size) this.terms.delete(w);
    }
  }

  /**
   * Every indexed path that contains every word of the query, best first (more matches, then
   * path order), each with a short snippet around the first match. A query with no words finds
   * nothing. `keep(path)` filters before ranking and limiting, so a limit never hides an allowed
   * result behind refused ones.
   */
  search(query, { limit = 50, keep = () => true } = {}) {
    const q = [...new Set(words(query))];
    if (!q.length) return [];
    const lists = q.map((w) => this.terms.get(w) || new Map()).sort((a, b) => a.size - b.size);
    const hits = [];
    for (const [path] of lists[0]) {
      if (!lists.every((m) => m.has(path)) || !keep(path)) continue;
      hits.push({ path, score: lists.reduce((n, m) => n + m.get(path), 0) });
    }
    hits.sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return hits.slice(0, limit).map((h) => ({ ...h, snippet: snippet(this.docs.get(h.path), q[0]) }));
  }
}

/** About 120 characters of the text around the first place `word` occurs, on one line. */
function snippet(text, word) {
  const folded = text.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase();
  const at = folded.search(new RegExp(`(?<![\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u'));
  const from = Math.max(0, (at < 0 ? 0 : at) - 50);
  const s = text.slice(from, from + 120).replace(/\s+/g, ' ').trim();
  return (from > 0 ? '…' : '') + s + (from + 120 < text.length ? '…' : '');
}
