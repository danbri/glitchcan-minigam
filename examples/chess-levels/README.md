# One app, level by level

This is a tutorial for [the foafos-lite guest contract](../../docs/foafos-lite-contract.md). It
takes one small app, 5×5 chess against a simple opponent, and wires it up a level at a time. Each
step is one commit with a small diff, a test, and a plain statement of what the app newly sends out.

| Level | The app gets | The app newly sends out |
|---|---|---|
| [0](#level-0-the-game-alone) | nothing: it runs alone | nothing |

Files:
- `game.mjs`: the rules and the opponent. No page, no I/O. Every level uses it unchanged.
- `index.html`: the app.
- `test/game.test.mjs`: the rules (`node --test examples/chess-levels/test/`).
- `test/e2e.mjs`: the app in a real browser (`CHROMIUM_PATH=... node examples/chess-levels/test/e2e.mjs`).

## Level 0: the game alone

`index.html` and `game.mjs` are static files. Open `index.html` from any web server, or put it on
a USB stick: it works offline, with no host, and talks to nothing.

It already has the things later levels hand over to a host: a timer (the opponent's short pause
before it moves), a sound (a click on each move), a size (the board fits the window), keyboard
control (arrows and Enter), and two actions (New game, Undo).

**What leaves the app:** nothing.
