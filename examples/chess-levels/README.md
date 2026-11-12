# One app, level by level

This is a tutorial for [the foafos-lite guest contract](../../docs/foafos-lite-contract.md). It
takes one small app, 5×5 chess against a simple opponent, and wires it up a level at a time. Each
step is one commit with a small diff, a test, and a plain statement of what the app newly sends out.

| Level | The app gets | The app newly sends out |
|---|---|---|
| [0](#level-0-the-game-alone) | nothing: it runs alone | nothing |
| [1](#level-1-a-good-neighbour) | pause and resume, the host's volume, its size, a place in the host's menu | its name, its menu (ids and labels), "ready", "paused" |
| [2](#level-2-its-own-folder) | its games kept in a folder the host gives it, wherever that folder is | the moves of the current game, to that folder |

Files:
- `game.mjs`: the rules and the opponent. No page, no I/O. Every level uses it unchanged.
- `index.html`: the app.
- `host.html`: a small host page, made with `@foafos/host-lite`. It runs the app in a sandboxed frame
  and lists every message the app sends.
- `test/game.test.mjs`: the rules (`node --test examples/chess-levels/test/`).
- `test/e2e.mjs`: the app in a real browser (`CHROMIUM_PATH=... node examples/chess-levels/test/e2e.mjs`).

## Level 0: the game alone

`index.html` and `game.mjs` are static files. Open `index.html` from any web server, or put it on
a USB stick: it works offline, with no host, and talks to nothing.

It already has the things later levels hand over to a host: a timer (the opponent's short pause
before it moves), a sound (a click on each move), a size (the board fits the window), keyboard
control (arrows and Enter), and two actions (New game, Undo).

**What leaves the app:** nothing.

## Level 1: a good neighbour

The diff adds one import and about twenty lines at the end of `index.html`:

```js
import { connect } from '../../packages/foafos-guest/guest.mjs';
...
const guest = await connect({ level: 1, name: 'Chess 5×5',
  actions: [{ id: 'new', label: 'New game' }, { id: 'undo', label: 'Undo' }] });
guest.on('lifecycle', ({ state }) => { /* stop or restart the opponent's timer and the sound */ });
guest.on('audio', ({ level, muted }) => { volume = muted ? 0 : level; });
guest.on('viewport', ({ mode }) => { document.body.dataset.mode = mode; });   // 'pip': board only
guest.on('action', ({ id }) => (id === 'new' ? newOne() : takeBack()));
guest.ready();
```

It connects after the first draw, so the board never waits for a host. Opened on its own, or framed
by a page that is not a host, `connect()` finds no host and the app is the level 0 app.

What the host can now do:
- **Pause it.** The opponent's timer stops, and so does the sound. The app answers `paused` once
  they have, and black moves only after the app is resumed. A host can hold many apps paused at no
  cost.
- **Set its volume:** one level for every app, scaled by each app's own output.
- **Make it small** (`pip`): the app shows the board alone.
- **Show its menu.** New game and Undo appear in the host's own menu, and choosing one there calls
  the app.

**What leaves the app:** exactly what `host.html` lists. `hello` carries the level asked for, the
name `Chess 5×5`, and the menu's ids and labels. After that come `ready` and, for each pause,
`paused`. No moves and no board leave it: the host learns that a game is being played, not how it
is going.

**Serving note:** `host.html` frames the app with `sandbox="allow-scripts"`, so the app has an opaque
origin, and its module files are fetched with CORS. The server must send
`Access-Control-Allow-Origin` for them, as the test server does.

## Level 2: its own folder

The app asks for level 2, and saves the moves of the current game whenever they change:

```js
guest.store.put('games/current.json', JSON.stringify({ moves: game.moves }), { contentType: 'application/json' });
```

When it starts, it carries on with the saved game:

```js
const last = await guest.store.get('games/current.json');
```

That is the whole diff. The same two calls work in three places:
- **Under a level-2 host,** they go to the folder the host gives the app. `host.html` keeps it in memory, and shows it under "Its folder". Full foafos keeps it in the person's pod, and another host could use a folder on disk. The app never learns which, or where: it names paths inside its folder (`games/current.json`) and nothing else.
- **With no host,** they go to the browser's own storage (IndexedDB), so a reload carries on there too.
- **In a sandboxed frame with no host,** there is no storage at all. The calls answer `offline`, and the app simply starts a new game each time.

**What leaves the app:** at level 2, the moves of the current game (a list such as `["b1c3","b4c3"]`), to its own folder, and requests to read them back. Nothing else is added. The host's tests check that every `store` message names `games/current.json` and carries only `moves`.
