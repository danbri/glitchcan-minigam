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

  async init() { this.db = await idbOpen(); return this; }

  // ---- calendars (layers) ----
  async getCalendars() {
    return reqAll(tx(this.db, CAL_STORE));
  }
  async putCalendar(cal) {
    const t = this.db.transaction(CAL_STORE, 'readwrite');
    t.objectStore(CAL_STORE).put(cal);
    await reqDone(t);
    this._changed();
    return cal;
  }
  async deleteCalendar(id) {
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
    const rows = await reqAll(tx(this.db, EV_STORE));
    return rows.map(fromStored);
  }
  async getEventsFor(calendarId) {
    const store = tx(this.db, EV_STORE);
    const idx = store.index('calendarId');
    return new Promise((res, rej) => {
      const rq = idx.getAll(IDBKeyRange.only(calendarId));
      rq.onsuccess = () => res((rq.result || []).map(fromStored));
      rq.onerror = () => rej(rq.error);
    });
  }
  async putEvent(ev) {
    const t = this.db.transaction(EV_STORE, 'readwrite');
    t.objectStore(EV_STORE).put(toStored(ev));
    await reqDone(t);
    this._changed();
    return ev;
  }
  async putEvents(events) {
    const t = this.db.transaction(EV_STORE, 'readwrite');
    const s = t.objectStore(EV_STORE);
    for (const ev of events) s.put(toStored(ev));
    await reqDone(t);
    this._changed();
  }
  async deleteEvent(id) {
    const t = this.db.transaction(EV_STORE, 'readwrite');
    t.objectStore(EV_STORE).delete(id);
    await reqDone(t);
    this._changed();
  }
  // Replace all events belonging to one calendar (used when refreshing a feed).
  async replaceCalendarEvents(calendarId, events) {
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
    const t = this.db.transaction([CAL_STORE, EV_STORE], 'readwrite');
    t.objectStore(CAL_STORE).clear();
    t.objectStore(EV_STORE).clear();
    await reqDone(t);
    this._changed();
  }

  _changed() { this.dispatchEvent(new Event('change')); }
}

export { fromStored, toStored };
