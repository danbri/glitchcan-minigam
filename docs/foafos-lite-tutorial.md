# foafos-lite tutorial: one small game, level by level

This grows one modest app, Minichess (a queen-and-king puzzle on a 3 × 4 board, from
`thumbwar/minichess.html`), from a page that knows nothing about any host into a foafos-lite
guest. Each level is one commit to `packages/foafos-guest/examples/minichess/index.html`, a small
diff you can read on its own. At each step: what the game gets, and what newly leaves it.

The contract is `docs/foafos-lite-contract.md`; the module is `packages/foafos-guest/guest.mjs`.

## Level 0: the game alone

The game as static files. It works offline, opened as a plain page, with no host.

- **Change:** the story player's copy sent two `postMessage` calls to whatever page framed it
  (`minichess-complete`, `minichess-return`). They are taken out.
- **What leaves the game:** nothing.

## Level 1: a good neighbour

One module script added after the game's own:

```js
import { connect } from '../../guest.mjs';
const guest = await connect({ level: 1, name: 'Minichess',
  actions: [{ id: 'new', label: 'New game' }, { id: 'rules', label: 'Show the rules' }] });
guest.on('action', ({ id }) => { if (id === 'new') resetGame(); if (id === 'rules') explanationBtn.click(); });
guest.on('lifecycle', ({ state }) => {
  document.body.classList.toggle('paused', state === 'paused');
  if (state === 'paused') guest.paused();
});
guest.ready();
```

- **What the game gets:** the host's menu shows New game and Show the rules (in full foafos, the
  ⋯ in the window bar); pausing the app in the host (Task Manager) dims the board and takes no
  input until it resumes. Standalone, `connect` finds no host within its time limit and the game
  plays exactly as at level 0.
- **What leaves the game:** its name, its two menu items (ids and labels), and the
  acknowledgements `ready` and `paused`. Nothing about the game in play.

## Level 2: saved games

The game calls a hook whenever the board is drawn (`window.onBoardChanged?.()`, one line in its
own code), and the module script asks for level 2 and keeps the game in progress at
`games/current.json`:

```js
const kept = await guest.store.get('games/current.json');
if (kept.ok) { /* check the shape, then restore kingPos, queenPos, currentTurn, … */ }
window.onBoardChanged = () => { /* after 150 ms: */ guest.store.put('games/current.json', JSON.stringify(state)); };
```

- **What the game gets:** close it and open it again, and the game goes on where it was. A game
  saved during the computer's turn plays the king's reply on opening.
- **Where it is kept:** the same calls everywhere. Under a host that grants level 2, in the
  folder the host gives the app: in full foafos, the app's own folder of the person's shared pod.
  Standalone or at level 1, the browser's own storage (IndexedDB).
- **What leaves the game, added at this level:** the board position, to that folder only.

## Level 3: tools and the bus

The module asks for level 3 and declares four tools, so an AI opponent, a screen reader or a
voice user can play the game without seeing the board:

| Tool | Reads or acts | What it does |
|---|---|---|
| `board` | reads | where the queen, king and skull stand (a1 to d3), whose turn, whether it is over |
| `legal_moves` | reads | the squares the queen may move to now |
| `move { to }` | acts | moves the queen; the result is the position after the king's reply |
| `new_game` | acts | starts again |

A move to a square off the board, or one the queen cannot reach, is refused with a reason. Each
change of the board is published as `board`.

- **What the game gets:** in full foafos the tools join the shell's tool registry
  (`FoafOS.tools`), called under the same grants as any app's tools (the person, and whoever the
  person allows); the board appears on the shell's bus as `app.minichess-lite.board`, which
  another app may hear if its manifest is granted that topic.
- **What leaves the game, added at this level:** tool results (positions and legal squares) to
  the host, and the position as it changes, on the bus.

## Running it

- **Standalone:** open `packages/foafos-guest/examples/minichess/index.html` from any static
  server. It reports level 0.
- **In full foafos:** All apps → Play → Minichess (manifest `inklet/finkapp/apps/minichess-lite.jsonld`,
  `"foafosLevel": 3`).
- **The server must send `Access-Control-Allow-Origin`.** foafos runs the game in a sandboxed
  frame with an opaque origin, so the browser fetches `guest.mjs` as a cross-origin module. GitHub
  Pages sends the header; Python's `http.server` does not, and the game then waits at its first
  `await` with a CORS error in the console.
- **Test:** `inklet/finkapp/test/e2e-minichess-lite.mjs` (level 3: the four tools, play through
  them, a refused move, the board on the bus; a move saved in the pod, reopened in place, New game
  from the menu). The contract's own checks run the same way in
  `e2e-guest-conformance.mjs` and `packages/foafos-host-lite/test/conformance.test.mjs`.

## Level 4: full foafos

Level 4 is outside the contract: what full foafos does with a level-3 app's tools and events,
with no further change to the game beyond one line of words in each position (`summary`, such as
"Queen d2, king b3; the queen to move."), for chats, screen readers and logs.

- **Play from Chat.** In the Chat window, `/tools minichess-lite` lists the tools,
  `/call minichess-lite board` shows the position, and `/call minichess-lite move {"to":"d2"}`
  plays (the result is the position after the king's reply).
- **Play over XMPP.** A direct message from another account runs the same commands, checked
  against that account's grants. Until the person grants it, it is refused. After
  `/grant friend@example.org minichess-lite move` it may read the game and move, and nothing
  else: `new_game` is still refused. `/revoke` takes it back. (A room cannot carry commands: its
  members are known by nickname only.)
- **An AI opponent.** The shell publishes app tools to the page's WebMCP model context where the
  browser offers one, so an agent in the browser plays through the same four tools, as the
  person's agent and under its grants.
- **Talk about a game.** Each tool call shows in the room's app activity ("you called Minichess
  move: ok"). The board events (`app.minichess-lite.board`) are not mirrored to the room unless
  the person adds the topic to Chat's mirror list: mirroring to a room is publishing.
- **What leaves, added at this level:** to whoever the person grants, the results of the tools
  they may call; to the room, only what the person chose to mirror.

**Test:** `inklet/finkapp/test/e2e-minichess-lite.mjs` plays from the person's chat, and as
another account (the bare JID, as a direct message arrives): refused, granted `move`, moves,
still refused `new_game`.
