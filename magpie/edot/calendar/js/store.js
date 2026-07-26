// store.js — IndexedDB persistence for the calendar (calendars + events).
//
// Mirrors the idb open/get/set approach in ../data/data-engine.js, but uses two
// object stores instead of a single serialized blob: one for calendars (the
// layers) and one for events. Everything is the user's own local data — no
// external personal datasets (see CLAUDE.md data-ethics rule).
//
// Records are plain JSON. Event `start`/`end`/`exdates` are stored as ISO
// strings and rehydrated to Date on read so the rest of the app sees Dates.

const IDB_DB = 'edot-calendar';
const IDB_VERSION = 1;
const CAL_STORE = 'calendars';
const EV_STORE = 'events';

// ── the brokered fallback ────────────────────────────────────────────
//
// Inside foafos an app runs in a sandboxed frame with an OPAQUE ORIGIN,
// where `indexedDB.open()` fails. The app used to get around that by
// holding the `same-origin` capability — i.e. by having full ambient
// authority over the shell, which is a lot to pay for a place to keep
// some events.
//
// So: same public API, two JSON arrays behind `localStorage`. Under
// foafos that `localStorage` is app-sdk's shim over the shell's store
// broker (namespaced, quota'd, audited); standalone it is the real one.
// The calendar cannot tell the difference and does not need to.
//
// Chosen only when IndexedDB genuinely will not open, so the standalone
// app keeps its indexes and its cursor deletes.
const KV_CALS = 'edot.calendar.calendars';
const KV_EVS = 'edot.calendar.events';

class KvDb {
  constructor() { this.kind = 'kv'; }
  _read(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } }
  _write(k, rows) {
    try { localStorage.setItem(k, JSON.stringify(rows)); return true; }
    catch (e) {
      // A refusal here is the broker saying no (quota, or no capability).
      // Losing it silently would look like a save that worked.
      console.warn('[calendar] store refused:', e && e.name);
      return false;
    }
  }
  all(which) { return this._read(which === 'cal' ? KV_CALS : KV_EVS); }
  put(which, rec) {
    const key = which === 'cal' ? KV_CALS : KV_EVS;
    const rows = this._read(key);
    const at = rows.findIndex(r => r.id === rec.id);
    if (at >= 0) rows[at] = rec; else rows.push(rec);
    return this._write(key, rows);
  }
  putMany(which, recs) {
    const key = which === 'cal' ? KV_CALS : KV_EVS;
    const rows = this._read(key);
    for (const rec of recs) {
      const at = rows.findIndex(r => r.id === rec.id);
      if (at >= 0) rows[at] = rec; else rows.push(rec);
    }
    return this._write(key, rows);
  }
  remove(which, id) {
    const key = which === 'cal' ? KV_CALS : KV_EVS;
    this._write(key, this._read(key).filter(r => r.id !== id));
  }
  removeWhere(which, pred) {
    const key = which === 'cal' ? KV_CALS : KV_EVS;
    this._write(key, this._read(key).filter(r => !pred(r)));
  }
  clear() { this._write(KV_CALS, []); this._write(KV_EVS, []); }
}

/** Open IndexedDB, or fall back to the brokered key/value store. */
async function openBest() {
  try {
    const db = await idbOpen();
    db.kind = 'idb';
    return db;
  } catch (e) {
    console.info('[calendar] IndexedDB unavailable (' + (e && e.name) + ') — using brokered storage');
    return new KvDb();
  }
}

function idbOpen() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_DB, IDB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(CAL_STORE)) db.createObjectStore(CAL_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(EV_STORE)) {
        const s = db.createObjectStore(EV_STORE, { keyPath: 'id' });
        s.createIndex('calendarId', 'calendarId', { unique: false });
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function tx(db, store, mode = 'readonly') {
  return db.transaction(store, mode).objectStore(store);
}
function reqAll(store) {
  return new Promise((res, rej) => { const rq = store.getAll(); rq.onsuccess = () => res(rq.result || []); rq.onerror = () => rej(rq.error); });
}
function reqDone(t) {
  return new Promise((res, rej) => { t.oncomplete = res; t.onabort = () => rej(t.error); t.onerror = () => rej(t.error); });
}

// ---- (de)hydration between storage JSON and runtime objects --------------
function toStored(ev) {
  return {
    ...ev,
    start: ev.start ? new Date(ev.start).toISOString() : null,
    end: ev.end ? new Date(ev.end).toISOString() : null,
    exdates: (ev.exdates || []).map((d) => new Date(d).toISOString()),
    rrule: ev.rrule && ev.rrule.until
      ? { ...ev.rrule, until: new Date(ev.rrule.until).toISOString() }
      : ev.rrule || null,
  };
}
function fromStored(ev) {
  return {
    ...ev,
    start: ev.start ? new Date(ev.start) : null,
    end: ev.end ? new Date(ev.end) : null,
    exdates: (ev.exdates || []).map((d) => new Date(d)),
    rrule: ev.rrule && ev.rrule.until ? { ...ev.rrule, until: new Date(ev.rrule.until) } : ev.rrule || null,
  };
}

export class CalendarStore extends EventTarget {
  constructor() { super(); this.db = null; }

  async init() { this.db = await openBest(); return this; }

  get usingBroker() { return this.db?.kind === 'kv'; }

  // ---- calendars (layers) ----
  async getCalendars() {
    if (this.usingBroker) return this.db.all('cal');
    return reqAll(tx(this.db, CAL_STORE));
  }
  async putCalendar(cal) {
    if (this.usingBroker) { this.db.put('cal', cal); this._changed(); return cal; }
    const t = this.db.transaction(CAL_STORE, 'readwrite');
    t.objectStore(CAL_STORE).put(cal);
    await reqDone(t);
    this._changed();
    return cal;
  }
  async deleteCalendar(id) {
    if (this.usingBroker) {
      this.db.remove('cal', id);
      this.db.removeWhere('ev', (r) => r.calendarId === id);
      this._changed();
      return;
    }
    // Remove the calendar and all of its events.
    const t = this.db.transaction([CAL_STORE, EV_STORE], 'readwrite');
    t.objectStore(CAL_STORE).delete(id);
    const idx = t.objectStore(EV_STORE).index('calendarId');
    await new Promise((res) => {
      const rq = idx.openCursor(IDBKeyRange.only(id));
      rq.onsuccess = () => { const c = rq.result; if (c) { c.delete(); c.continue(); } else res(); };
      rq.onerror = () => res();
    });
    await reqDone(t);
    this._changed();
  }

  // ---- events ----
  async getEvents() {
    if (this.usingBroker) return this.db.all('ev').map(fromStored);
    const rows = await reqAll(tx(this.db, EV_STORE));
    return rows.map(fromStored);
  }
  async getEventsFor(calendarId) {
    if (this.usingBroker) {
      return this.db.all('ev').filter(r => r.calendarId === calendarId).map(fromStored);
    }
    const store = tx(this.db, EV_STORE);
    const idx = store.index('calendarId');
    return new Promise((res, rej) => {
      const rq = idx.getAll(IDBKeyRange.only(calendarId));
      rq.onsuccess = () => res((rq.result || []).map(fromStored));
      rq.onerror = () => rej(rq.error);
    });
  }
  async putEvent(ev) {
    if (this.usingBroker) { this.db.put('ev', toStored(ev)); this._changed(); return ev; }
    const t = this.db.transaction(EV_STORE, 'readwrite');
    t.objectStore(EV_STORE).put(toStored(ev));
    await reqDone(t);
    this._changed();
    return ev;
  }
  async putEvents(events) {
    if (this.usingBroker) { this.db.putMany('ev', events.map(toStored)); this._changed(); return; }
    const t = this.db.transaction(EV_STORE, 'readwrite');
    const s = t.objectStore(EV_STORE);
    for (const ev of events) s.put(toStored(ev));
    await reqDone(t);
    this._changed();
  }
  async deleteEvent(id) {
    if (this.usingBroker) { this.db.remove('ev', id); this._changed(); return; }
    const t = this.db.transaction(EV_STORE, 'readwrite');
    t.objectStore(EV_STORE).delete(id);
    await reqDone(t);
    this._changed();
  }
  // Replace all events belonging to one calendar (used when refreshing a feed).
  async replaceCalendarEvents(calendarId, events) {
    if (this.usingBroker) {
      this.db.removeWhere('ev', (r) => r.calendarId === calendarId);
      this.db.putMany('ev', events.map(toStored));
      this._changed();
      return;
    }
    const t = this.db.transaction(EV_STORE, 'readwrite');
    const s = t.objectStore(EV_STORE);
    const idx = s.index('calendarId');
    await new Promise((res) => {
      const rq = idx.openCursor(IDBKeyRange.only(calendarId));
      rq.onsuccess = () => { const c = rq.result; if (c) { c.delete(); c.continue(); } else res(); };
      rq.onerror = () => res();
    });
    for (const ev of events) s.put(toStored(ev));
    await reqDone(t);
    this._changed();
  }

  async clearAll() {
    if (this.usingBroker) { this.db.clear(); this._changed(); return; }
    const t = this.db.transaction([CAL_STORE, EV_STORE], 'readwrite');
    t.objectStore(CAL_STORE).clear();
    t.objectStore(EV_STORE).clear();
    await reqDone(t);
    this._changed();
  }

  _changed() { this.dispatchEvent(new Event('change')); }
}

export { fromStored, toStored };
