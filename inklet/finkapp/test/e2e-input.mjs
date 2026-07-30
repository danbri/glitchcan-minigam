// Input reaches the game — from every controller.
//
// Field report: "for Minigam & Robbin, the A B buttons weren't working as
// go". Verified true and worse than reported: robbin accepts the host's
// input service (spec §5.1.1) and therefore HIDES its own touch pad, but
// had no `key` case in its message handler — so on touch it had no input
// at all inside the shell. The same gap existed for gridluck and
// battleboids, whose real game sits one frame deeper than the SDK that
// dispatches the key event.
//
// Four controllers must reach the same game:
//   1. a keyboard, with the guest focused   (the guest's own listener)
//   2. a keyboard, with the shell focused   (host → key message)
//   3. the on-screen pad                    (touch → action → key message)
//   4. a gamepad                            (poll → action → key message)
// Konami is the strictest probe there is: ten presses in order, mixing
// directions with A and B, and any wrong token resets it. If the song
// plays, the controller is genuinely wired.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const repoName = basename(repoRoot);
const PORT = 8147;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const CORS_SERVER = `
import http.server, functools
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin','*'); super().end_headers()
    def log_message(self,*a): pass
http.server.ThreadingHTTPServer(('127.0.0.1',${PORT}), functools.partial(H, directory='${join(repoRoot, '..')}')).serve_forever()
`;
const server = spawn('python3', ['-c', CORS_SERVER], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));

const fail = (m) => { console.error('✖', m); process.exitCode = 1; };
const pass = (m) => console.log('✔', m);

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  // hasTouch ⇒ pointer:coarse ⇒ the shell shows its on-screen pad
  const page = await browser.newPage({ viewport: { width: 430, height: 860 }, hasTouch: true });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));

  await page.goto(`http://127.0.0.1:${PORT}/${repoName}/inklet/finkapp/?player=legacy&story=/${repoName}/inklet/hampstead.fink.js`);
  await page.waitForFunction(() => window.FinkInkEngine?.compiledCount >= 1, null, { timeout: 25000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    FinkInkEngine.story.ChoosePathString('hampstead_tube');
    FinkInkEngine.continueStory();
  });
  await page.waitForSelector('#minigame-iframe-robbin', { timeout: 15000 });
  await page.waitForTimeout(2500);
  const guest = page.frames().find(f => f.url().includes('magpie/robbin/robbin.html'));
  if (!guest) throw new Error('robbin frame never appeared');
  await guest.waitForFunction(() => window.__robbin?.game?.state === 'tube', null, { timeout: 20000 });

  // The song's own effect is the only honest signal that it played.
  // (`creditsOpen()` is not: showCredits() opens ROBBAMP these days and
  // never touches the #credits element that creditsOpen() looks at.)
  await guest.evaluate(() => {
    const g = window.__robbin.game;
    window.__konami = 0;
    const orig = g.unlockTeleport.bind(g);
    g.unlockTeleport = (...a) => { window.__konami++; return orig(...a); };
  });
  const state = () => guest.evaluate(() => ({
    kona: window.__robbin.game._kona,
    jump: window.__robbin.game.input.jump || 0,
    sung: window.__konami,
  }));
  // Between runs: shut the reward, forget the song, drop every key. The
  // service's own held-key map has to be cleared too or a stuck 'up' from
  // one controller quietly poisons the next one's sequence.
  const reset = async () => {
    await guest.evaluate(() => {
      const g = window.__robbin.game;
      g.amp?.close(); g.hideCredits();
      g._kona = 0; g.input = {}; g.jumpTap = false;
      window.__konami = 0;
    });
    await page.evaluate(() => window.FoafOS?.input?.releaseAll());
    await page.waitForTimeout(150);
  };
  // Playwright's dispatchEvent('pointerdown') makes an event with a
  // pointerId the browser is not tracking; drive the pad the way a thumb
  // does instead, with real pointer events.
  const tap = async (el, ms = 60) => {
    const b = await el.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
  };

  // ── 0. the pad the player actually sees ────────────────────────────
  const pads = await page.evaluate(() => ({
    foaf: !!document.getElementById('foaf-pad') && !document.getElementById('foaf-pad').hidden,
    legacyDpad: !document.getElementById('game-dpad').hidden,
    legacyAct: !document.getElementById('game-action-btns').hidden,
  }));
  const ownPad = await guest.evaluate(() => document.getElementById('touch')?.style.display);
  pads.foaf && !pads.legacyDpad && !pads.legacyAct && ownPad === 'none'
    ? pass('one pad on screen: the shell provides, the guest stands down')
    : fail(`pad confusion: ${JSON.stringify(pads)} guest own pad display=${ownPad}`);

  // ── 1. A is GO ─────────────────────────────────────────────────────
  // On the tube map robbin relabels its JUMP button GO, and both are the
  // same verb: handleJump(). So "does A work as go" is answerable exactly.
  await reset();
  await guest.evaluate(() => {
    const t = window.__robbin.game.tube;
    window.__goCount = 0;
    const orig = t.handleJump.bind(t);
    t.handleJump = (...a) => { window.__goCount++; return orig(...a); };
  });
  const btnA = await page.$('#foaf-pad [data-action="a"]');
  if (!btnA) throw new Error('no A button on the shell pad');
  const aBox = await btnA.boundingBox();
  await page.mouse.move(aBox.x + aBox.width / 2, aBox.y + aBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(80);
  const held = await state();
  await page.mouse.up();
  await page.waitForTimeout(120);
  const releasedJump = (await state()).jump;
  const goes = await guest.evaluate(() => window.__goCount);
  held.jump === 1 && releasedJump === 0
    ? pass('A presses and releases (held → jump 1, released → 0)')
    : fail(`A did not hold: held=${held.jump} released=${releasedJump}`);
  goes === 1 ? pass('A is GO: one press, one handleJump on the tube map')
             : fail(`A did not reach GO: handleJump called ${goes}x`);

  // B is Back: the shell maps it to Escape, and on the map that asks to quit
  await reset();
  const btnB = await page.$('#foaf-pad [data-action="b"]');
  await tap(btnB);
  await page.waitForTimeout(120);
  const asked = await guest.evaluate(() => !!window.__robbin.game.tube.quitConfirm);
  asked ? pass('B is Back: it reaches the guest and opens its own quit ask')
        : fail('B did not reach the guest');
  await guest.evaluate(() => window.__robbin.game.tube.cancelQuit());

  // ── the song, once per controller ──────────────────────────────────
  const SONG = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];

  // 2. a keyboard, with the GUEST focused — the guest's own listener
  await reset();
  const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', b: 'b', a: ' ' };
  for (const tok of SONG) {
    await guest.evaluate((k) => {
      dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
    }, KEY[tok]);
  }
  (await state()).sung === 1
    ? pass('konami · keyboard, guest focused')
    : fail(`konami · keyboard (guest) stalled at step ${(await state()).kona}`);

  // 3. a keyboard, with the SHELL focused — host → action → key message.
  // The shell's own map: Space→a, Escape→b, arrows→directions.
  await reset();
  const HOSTKEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
                    b: 'Escape', a: 'Space' };
  for (const tok of SONG) {
    await page.keyboard.down(HOSTKEY[tok]);
    await page.waitForTimeout(30);          // shorter than the 60ms autorepeat
    await page.keyboard.up(HOSTKEY[tok]);
  }
  await page.waitForTimeout(150);
  (await state()).sung === 1
    ? pass('konami · keyboard, shell focused (host input service)')
    : fail(`konami · keyboard (shell) stalled at step ${(await state()).kona}`);

  // 4. the on-screen pad. Directions are NOT four buttons — the pad is one
  // joystick surface, so each direction is a thumb landing off-centre.
  await reset();
  const dir = await page.$('#foaf-pad .foaf-pad-dir');
  const box = await dir.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const OFF = { up: [0, -0.8], down: [0, 0.8], left: [-0.8, 0], right: [0.8, 0] };
  for (const tok of SONG) {
    if (OFF[tok]) {
      const [ox, oy] = OFF[tok];
      await page.mouse.move(cx + ox * box.width / 2, cy + oy * box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(30);
      await page.mouse.up();
    } else {
      await tap(tok === 'a' ? btnA : btnB, 30);
    }
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(150);
  (await state()).sung === 1
    ? pass('konami · on-screen pad (joystick surface + A/B)')
    : fail(`konami · on-screen pad stalled at step ${(await state()).kona}`);

  // 5. a gamepad. Standard mapping: 0=A, 1=B, 12..15 = dpad.
  await reset();
  await page.evaluate(() => {
    const pad = { index: 0, id: 'Test Pad (Standard)', connected: true, mapping: 'standard',
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      axes: [0, 0, 0, 0] };
    window.__fakePad = pad;
    navigator.getGamepads = () => [pad];
    const ev = new Event('gamepadconnected');
    ev.gamepad = pad;
    window.dispatchEvent(ev);
  });
  await page.waitForTimeout(200);
  const padHidden = await page.evaluate(() => document.getElementById('foaf-pad').hidden);
  padHidden ? pass('a real gamepad retires the on-screen pad')
            : fail('on-screen pad still up with a gamepad connected');
  const BTN = { up: 12, down: 13, left: 14, right: 15, a: 0, b: 1 };
  for (const tok of SONG) {
    await page.evaluate((i) => { window.__fakePad.buttons[i].pressed = true; }, BTN[tok]);
    await page.waitForTimeout(50);          // a couple of poll frames
    await page.evaluate((i) => { window.__fakePad.buttons[i].pressed = false; }, BTN[tok]);
    await page.waitForTimeout(50);
  }
  (await state()).sung === 1
    ? pass('konami · gamepad (standard mapping)')
    : fail(`konami · gamepad stalled at step ${(await state()).kona}`);
  await page.evaluate(() => {
    navigator.getGamepads = () => [];
    window.dispatchEvent(new Event('gamepaddisconnected'));
  });
  await reset();

  // ── 6. a guest whose game sits a frame deeper than the SDK ─────────
  // gridluck is a thin wrapper around a nested iframe. Two facts, and
  // they are separate:
  //   · its manifest asks for `controls: "none"` — it steers by swiping
  //     the canvas — so the shell offers no pad at all. No pad on screen
  //     is CORRECT here, and nothing needs retracting.
  //   · the delivery path must still work, because the moment a wrapper
  //     asks for a pad the presses have to land. The SDK's synthetic
  //     event fires in the WRAPPER, which has nothing to control, so the
  //     wrapper forwards and host-keys.js replays it in the game's frame.
  await page.evaluate(() => FinkMinigames.closeMinigame?.() ?? FinkWM.close?.());
  await page.waitForTimeout(600);
  await page.evaluate(() => FinkMinigames.startMinigame('gridluck', 'normal'));
  await page.waitForFunction(() => window.FinkWM?.active === true, null, { timeout: 12000 });
  await page.waitForTimeout(3000);
  const offered = await page.evaluate(() => ({
    padHidden: document.getElementById('foaf-pad').hidden,
    controls: window.FinkMinigames.currentControls,
  }));
  offered.padHidden && offered.controls === 'none'
    ? pass('a guest that asks for no pad is given none')
    : fail(`unexpected pad state for gridluck: ${JSON.stringify(offered)}`);

  const inner = page.frames().find(f => f.url().includes('thumbwar/gridluck.html'));
  if (!inner) {
    fail('gridluck inner frame never appeared');
  } else {
    await inner.waitForFunction(() => !!window.__gridluck?.game, null, { timeout: 15000 });
    await inner.evaluate(() => { window.__gridluck.game.ply.next = null; });
    await page.evaluate(() => window.FinkMinigames._sendKeyToIframe('ArrowLeft', 'keydown'));
    await page.waitForTimeout(250);
    const next = await inner.evaluate(() => window.__gridluck.game.ply.next);
    next === 'L'
      ? pass('a host press still reaches a game one frame deeper than the SDK')
      : fail(`nested guest did not get the press: ply.next=${JSON.stringify(next)}`);
  }

  pageErrors.length === 0 ? pass('no page errors')
    : fail(`page errors: ${pageErrors.slice(0, 3).join(' · ')}`);
  console.log(process.exitCode ? '\nINPUT E2E: FAIL' : '\nINPUT E2E: PASS');
} catch (e) {
  fail(`fatal: ${String(e).slice(0, 300)}`);
  console.log('\nINPUT E2E: FAIL');
} finally {
  await browser?.close();
  server.kill();
}
