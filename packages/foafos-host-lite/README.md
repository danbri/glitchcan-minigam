# @foafos/host-lite

Hosts one app under the [foafos-lite guest contract](../../docs/foafos-lite-contract.md), in a frame
on your page. It has no servers, no sign-in and no network code, and it replaces no global.

```js
import { hostApp, memoryStore } from '@foafos/host-lite';

const frame = document.querySelector('iframe#chess');   // sandbox="allow-scripts"
const host = hostApp(frame, {
  offer: 2,                 // the most this page grants (an app gets the smaller of this and what it asks)
  folder: 'chess', store,   // level 2: the app's folder in a store you give it (memoryStore(), IndexedDB, ...)
  onActions: (items) => drawMenu(items),
});
host.pause(); host.resume(); host.audio(0.5); host.action('new');
```

## What it promises

- It grants at most the level asked for, and at most `offer`. With no `store`, it grants at most level 1.
- **Lifecycle:** `running` and `paused` alternate, `ending` comes at most once and last, and nothing
  follows it except replies the host still owes.
- **Requests:** each `store` request gets exactly one reply. A request that crosses `ending` is
  answered `offline`.
- **Storage:** the app's folder only. A path that breaks the segment rule is `denied`, whatever the
  guest sent.
- **Events:** sent only for topics the app subscribed to and the page granted (`topics`).
- **Actions:** only for ids in the app's current menu.

## Tests

The tests run this host and the real `@foafos/guest` against each other, through two fake windows
that deliver messages the way a browser does.
