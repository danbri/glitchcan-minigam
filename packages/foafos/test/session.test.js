import assert from 'node:assert/strict';
import {
  createSession, sealSession, openSession,
  saveSealed, loadSealed, clearSealed, SESSION_KEY,
} from '../src/session.mjs';

// storage shim (same shape localStorage presents)
function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

export async function run() {
  // seal → open round-trip preserves the session
  {
    const s = createSession({ name: 'Robin Redbreast' });
    s.data.bookmark = 'hampstead#street';
    const sealed = await sealSession(s, 'kulupu waso tawa');
    const back = await openSession(sealed, 'kulupu waso tawa');
    assert.deepEqual(back, s);
  }

  // the sealed blob leaks nothing readable
  {
    const s = createSession({ name: 'SECRETNAME' });
    const sealed = await sealSession(s, 'pw');
    const flat = JSON.stringify(sealed);
    assert.ok(!flat.includes('SECRETNAME'));
    assert.equal(sealed.kdf, 'PBKDF2-SHA256');
    assert.ok(sealed.iterations >= 200000);
  }

  // wrong passphrase throws, and never returns partial plaintext
  {
    const sealed = await sealSession(createSession({ name: 'x' }), 'right');
    await assert.rejects(() => openSession(sealed, 'wrong'), /wrong passphrase/);
  }

  // no passphrase → no persistence path
  await assert.rejects(() => sealSession(createSession(), ''), /passphrase is required/);

  // storage round-trip via the shim contract
  {
    const storage = memStorage();
    const sealed = await sealSession(createSession({ name: 'wren' }), 'pw');
    saveSealed(sealed, storage);
    assert.ok(storage.getItem(SESSION_KEY));
    const loaded = loadSealed(storage);
    const back = await openSession(loaded, 'pw');
    assert.equal(back.profile.name, 'wren');
    clearSealed(storage);
    assert.equal(loadSealed(storage), null);
  }
}
