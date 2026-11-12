# @foafos/guest

This is the one module an app needs to take part in foafos, or in any host of the
[foafos-lite guest contract](../../docs/foafos-lite-contract.md).

- It has no dependencies and no network code. It replaces no global and does nothing at import time.
- With no host, the app works as it does on its own (level 0).

```js
import { connect } from '@foafos/guest';

const guest = await connect({ level: 1, name: 'Chess', actions: [{ id: 'new', label: 'New game' }] });
guest.on('lifecycle', ({ state }) => { if (state === 'paused') { stopClock(); guest.paused(); } });
guest.on('audio', ({ level, muted }) => setVolume(muted ? 0 : level));
guest.on('action', ({ id }) => { if (id === 'new') newGame(); });
guest.ready();

await guest.store.put('games/last.pgn', pgn);   // the host's folder at level 2, IndexedDB otherwise
```

## What it sends, by level

| Level | What it sends |
|---|---|
| 0 | nothing |
| 1 | `hello`, `ready`, `actions`, `paused` |
| 2 | level 1, plus `store` |
| 3 | level 2, plus `tools`, `tool-result`, `subscribe`, `publish` |

## Trusting only some hosts

`hosts: ['https://example.org']` restricts which hosts the module will talk to. It then sends
nothing, not even `hello`, to a parent page with any other origin, and it ignores messages from one.

## Tests

The tests check each of the contract's promises for the guest side against a fake framing window.
They also fail if the source names a network API or a global it might replace, or grows past
12 KiB.

The Lean model of the contract is in `factoidal-core formal/lean4/L4Factoidal/Foafos/GuestContract.lean`.
