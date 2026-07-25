// Replay the host's key presses as real key events — for games that sit
// one frame DEEPER than the minigame SDK.
//
// Input is a host service (spec §5.1.1): the shell owns the pad, and a
// press arrives as `{ type:'key', event, key, code, repeat }` over
// postMessage. The SDK turns that into a KeyboardEvent — but on the
// document the SDK is loaded in. When a guest is a thin wrapper around a
// nested <iframe> holding the real game (gridluck, battleboids), the
// event fires in the wrapper, which has nothing to control, and the game
// never hears it. The wrapper forwards the raw message; this replays it
// here.
//
// One implementation, included by the nested games, so no game grows its
// own slightly-different version. Harmless standalone: nothing sends
// these messages and nothing is dispatched.
(function () {
  if (window.__mgHostKeys) return;
  window.__mgHostKeys = true;

  addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.type !== 'key' || typeof d.key !== 'string') return;
    // `repeat` matters: the host autorepeats a held button, and games
    // read e.repeat to tell a hold from a fresh tap.
    dispatchEvent(new KeyboardEvent(d.event === 'keyup' ? 'keyup' : 'keydown', {
      key: d.key,
      code: d.code || d.key,
      repeat: !!d.repeat,
      bubbles: true,
      cancelable: true,
    }));
  });
})();
