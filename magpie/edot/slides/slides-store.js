// slides-store.js — IndexedDB persistence for slide decks.
//
// Mirrors the idb helper pattern in magpie/edot/data/data-engine.js (a tiny
// key/value object store), scoped to its own database so it can't collide with
// the editor or data layers. Stores ONLY the user's own decks locally (Data
// Ethics, CLAUDE.md): nothing leaves the device, no third-party data is mixed.
//
// One record per deck, keyed by deck.id. The value is the canonical deck JSON
// "core" (see slides-model.js) — everything else (PPTX / PDF / HTML / PNG) is
// derived from it on demand.

const IDB_DB = 'edot-slides';
const IDB_STORE = 'decks';

function idbOpen() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_DB, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(IDB_STORE)) {
        r.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

// Persist a deck (insert or replace). Returns the deck id.
export async function saveDeck(deck) {
  const db = await idbOpen();
  await new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    // structuredClone strips any live DOM/proxy refs so IDB can store it.
    tx.objectStore(IDB_STORE).put(structuredClone(deck));
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
  return deck.id;
}

// Load one deck by id (or null if absent).
export async function loadDeck(id) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const rq = tx.objectStore(IDB_STORE).get(id);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => rej(rq.error);
  });
}

// List decks as lightweight summaries (id, title, slide count, mtime) for a
// library picker — avoids deserialising every deck's images.
export async function listDecks() {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const rq = tx.objectStore(IDB_STORE).getAll();
    rq.onsuccess = () => res((rq.result || [])
      .map((d) => ({ id: d.id, title: d.title || 'Untitled deck', slides: (d.slides || []).length, mtime: d.mtime || 0 }))
      .sort((a, b) => b.mtime - a.mtime));
    rq.onerror = () => rej(rq.error);
  });
}

export async function deleteDeck(id) {
  const db = await idbOpen();
  await new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
