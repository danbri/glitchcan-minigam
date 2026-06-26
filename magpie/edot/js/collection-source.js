// collection-source.js — the data-access layer for "windows offering sets of
// items" (file browsers, galleries, video libraries, people pickers, huge
// inboxes).
//
// ⚠️  ANTI-PATTERN, RECORDED SO IT NEVER COMES BACK  ⚠️
// Mozilla's original RDF datasource architecture modelled UI lists/trees as RDF
// graphs read through an assertion/graph API, with the template builder walking
// the graph per row. Elegant, but it scaled catastrophically: a 100k-message
// inbox became a giant in-memory graph and scrolling meant graph traversal per
// visible row. It was ripped out for nsITreeView (lazy, index-based views).
//
// THE RULE: the ontology/RDF (ontology.js) is a SCHEMA/VOCABULARY layer only —
// types, commands, relations. It is NEVER the runtime path for enumerating or
// scrolling items. Collections are accessed through this lazy, WINDOWED source:
// the view fetches only the visible range, and action availability is resolved
// ONCE per item *type* (registry.forType — O(commands)), never per item and
// never by walking a graph. Scrolling a million rows costs O(visible rows).
//
// A CollectionSource is:
//   { itemType: string,                       // ontology type (for actions-by-type)
//     count(): number|Promise<number>,        // total (may be estimated)
//     getRange(offset, limit): Item[]|Promise<Item[]>,   // <-- the windowed read
//     getItem?(id): Item|Promise<Item> }
// Item = { id, type?, label, locality?, data }

// Wrap an in-memory array. getRange returns only the requested window (a slice),
// so the view never re-renders the whole array.
export class ArrayCollectionSource {
  constructor(itemType, items = []) { this.itemType = itemType; this._items = items; }
  count() { return this._items.length; }
  getRange(offset = 0, limit = 50) { return this._items.slice(offset, offset + limit); }
  getItem(id) { return this._items.find((it) => it.id === id) || null; }
}

// A virtual source over a logically-huge collection (e.g. a 1,000,000-message
// inbox). `factory(index)` builds ONE item on demand; getRange calls it only for
// the window — nothing materialises the full set. This is the nsITreeView lesson
// in code: O(window), not O(total).
export class VirtualCollectionSource {
  constructor(itemType, total, factory) { this.itemType = itemType; this._total = total; this._factory = factory; }
  count() { return this._total; }
  getRange(offset = 0, limit = 50) {
    const end = Math.min(offset + limit, this._total);
    const out = [];
    for (let i = Math.max(0, offset); i < end; i++) out.push(this._factory(i));
    return out;
  }
  getItem(id) { return this._factory(typeof id === 'number' ? id : Number(id)); }
}

// A source backed by an async pager (server-side / indexed search). The crucial
// property: the backend returns only the window — we never pull everything to
// filter/sort/scroll client-side.
export class PagedCollectionSource {
  constructor(itemType, { count, fetchPage }) {
    this.itemType = itemType;
    this._count = count;       // () => Promise<number>
    this._fetch = fetchPage;   // (offset, limit) => Promise<Item[]>
  }
  async count() { return this._count(); }
  async getRange(offset = 0, limit = 50) { return this._fetch(offset, limit); }
}

// Resolve the actions for a collection's items ONCE, by type — shared across
// every row, never computed per item. Returns the registry commands that apply
// to source.itemType (empty array ⇒ the items are purely passive data).
export function actionsForCollection(source, registry, ctx = {}) {
  if (!source || !source.itemType || !registry) return [];
  return registry.forType(source.itemType, ctx).filter((c) => !!c.appliesTo);
}

// Convenience: are this collection's items active (have type-specific actions)?
export function isCollectionActive(source, registry, ctx = {}) {
  return !!source && !!registry && registry.actionable(source.itemType, ctx);
}
