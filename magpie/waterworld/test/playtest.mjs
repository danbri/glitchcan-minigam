#!/usr/bin/env node
// Waterworld standalone playtest — a PLAYTEST, not just a boot check:
// boots the page, dives, steers, pings, collects, banks, and wins, all
// through the real input path and the __waterworld hook.
//
//   node magpie/waterworld/test/playtest.mjs [--shots]

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const serveRoot = join(repoRoot, '..');
const PORT = 8177;
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.argv.includes('--shots');
const SHOTDIR = process.env.WW_SHOTDIR || '/tmp';

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', serveRoot],
  { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));

let failures = 0;
const fail = (m) => { console.error('✖', m); failures++; };
const pass = (m) => console.log('✔', m);

let browser;
try {
  browser = await chromium.launch({
    headless: true, executablePath: EXE,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));

  await page.goto(`http://127.0.0.1:${PORT}/glitchcan-minigam/magpie/waterworld/waterworld.html?lite&probe`);
  await page.waitForSelector('#splash.show', { timeout: 15000 });
  pass('splash shown');

  // dive via the keyboard, like a player would
  await page.keyboard.press(' ');
  await page.waitForFunction(() => !!window.__waterworld, null, { timeout: 15000 });
  await page.waitForTimeout(1500);
  pass('game started, __waterworld hook up');

  // captain's helm: with nobody touching anything, she sails herself
  const ap0 = await page.evaluate(() => window.__waterworld.pos());
  await page.waitForTimeout(2500);
  const ap1 = await page.evaluate(() => window.__waterworld.pos());
  const cruised = Math.hypot(ap1[0] - ap0[0], ap1[2] - ap0[2]);
  if (cruised > 3) pass(`autopilot cruises unaided (${cruised.toFixed(1)} units)`);
  else fail(`autopilot inert (${cruised.toFixed(2)} units)`);

  // a brush across the water sets a new course — through the real
  // pointer path, the way a thumb would
  await page.mouse.move(215, 430);
  await page.mouse.down();
  await page.mouse.move(340, 400, { steps: 6 });
  await page.mouse.up();
  const brushed = await page.evaluate(() => {
    const g = window.__waterworld.game;
    return g._explore && g._explore.until > g.elapsed;
  });
  if (brushed) pass('brush gesture set an explore course');
  else fail('brush gesture ignored');

  // the detailed boat: animated parts must exist
  const subParts = await page.evaluate(() => {
    const ud = window.__waterworld.game.sub.userData;
    return ['prop', 'prop2', 'planes', 'forePlanes', 'rudder', 'beacon'].filter(k => !ud[k]);
  });
  if (!subParts.length) pass('sub v2: props, planes, rudder, beacon all present');
  else fail('sub missing parts: ' + subParts.join(','));

  // POSE CONTINUITY: the craft's quaternion must never jump between
  // frames. The old Euler read-back pose flipped representations ~67
  // times per slow diving turn (measured); a brushed turn with pitch is
  // exactly the manoeuvre that exposed it.
  await page.mouse.move(215, 430);
  await page.mouse.down();
  await page.mouse.move(120, 520, { steps: 5 });   // hard turn + dive
  await page.mouse.up();
  const poseJump = await page.evaluate(async () => {
    const g = window.__waterworld.game;
    const prev = g.sub.quaternion.clone();
    let worst = 0;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 80));
      worst = Math.max(worst, prev.angleTo(g.sub.quaternion));
      prev.copy(g.sub.quaternion);
    }
    return worst;
  });
  if (poseJump < 0.6) pass(`craft pose continuous through a turn (max step ${poseJump.toFixed(3)} rad)`);
  else fail(`craft pose SNAPS: ${poseJump.toFixed(2)} rad between samples`);

  // helm smoothness: park right on top of a target and make sure the
  // heading settles instead of flip-flopping between two angles (the
  // reported drift glitch)
  const wobble = await page.evaluate(async () => {
    const g = window.__waterworld.game;
    const s = g.salvage.find(s => !s.collected && !s.hidden && s.heavy);   // can't collect it
    window.__waterworld.teleport(s.mesh.position.x, s.mesh.position.y + 2, s.mesh.position.z);
    await new Promise(r => setTimeout(r, 1200));   // let the filter settle
    const yaws = [];
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 200));
      yaws.push(g.yaw);
    }
    let reversals = 0;
    for (let i = 2; i < yaws.length; i++) {
      const a = yaws[i - 1] - yaws[i - 2], b = yaws[i] - yaws[i - 1];
      if (Math.abs(a) > 0.06 && Math.abs(b) > 0.06 && Math.sign(a) !== Math.sign(b)) reversals++;
    }
    return reversals;
  });
  if (wobble <= 1) pass(`helm settles over a target (${wobble} heading reversals)`);
  else fail(`helm oscillates: ${wobble} heading reversals in 1.6s`);

  // help is one tap away, and the pad hides behind its chip
  await page.evaluate(() => document.getElementById('help-btn')
    .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  const helpOpen = await page.evaluate(() =>
    document.getElementById('help-panel').classList.contains('show') &&
    document.querySelectorAll('#help-list li').length >= 8);
  if (helpOpen) pass('help panel opens with the full function list');
  else fail('help panel broken');
  await page.click('#help-close');
  const padHidden = await page.evaluate(() =>
    getComputedStyle(document.getElementById('pad')).display === 'none');
  if (padHidden) pass('d-pad parked by default (last resort)');
  else fail('d-pad visible by default');

  // hand steering takes priority from here — determinism for the rest
  await page.evaluate(() => {
    window.__waterworld.game.autopilot = false;
    window.__waterworld.game._explore = null;
  });

  // guest-fit rule: the page must fit its own frame exactly
  const fit = await page.evaluate(() => ({
    scroll: document.body.scrollHeight, inner: window.innerHeight,
  }));
  if (fit.scroll === fit.inner) pass(`page fits its frame (${fit.inner}px)`);
  else fail(`page overflows: scrollHeight ${fit.scroll} vs innerHeight ${fit.inner}`);

  // the canvas must actually draw something
  const drawn = await page.evaluate(() => {
    const c = document.getElementById('scene');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const px = new Uint8Array(4 * 64);
    gl.readPixels(gl.drawingBufferWidth / 2 - 4, gl.drawingBufferHeight / 2 - 2,
      8, 8, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px.some(v => v > 8);
  });
  if (drawn) pass('canvas is rendering (non-black pixels)');
  else fail('canvas appears black');

  // steer: hold left + thrust, the sub must move and turn
  const before = await page.evaluate(() => ({
    pos: window.__waterworld.pos(), yaw: window.__waterworld.game.yaw,
  }));
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.down(' ');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up(' ');
  const after = await page.evaluate(() => ({
    pos: window.__waterworld.pos(), yaw: window.__waterworld.game.yaw,
  }));
  const moved = Math.hypot(after.pos[0] - before.pos[0], after.pos[2] - before.pos[2]);
  if (moved > 2) pass(`sub moved ${moved.toFixed(1)} units under thrust`);
  else fail(`sub barely moved (${moved.toFixed(2)} units)`);
  if (Math.abs(after.yaw - before.yaw) > 0.4) pass('sub turned under ArrowLeft');
  else fail(`yaw barely changed (${(after.yaw - before.yaw).toFixed(2)})`);

  // sonar ping via Escape (the host pad's B key)
  await page.keyboard.press('Escape');
  const pinged = await page.evaluate(() => window.__waterworld.game._pingCooldown > 0);
  if (pinged) pass('Escape fired the sonar ping');
  else fail('Escape did not ping');

  // collect: teleport onto a known clay pipe and let auto-collect work
  await page.evaluate(() => {
    const g = window.__waterworld.game;
    const s = g.salvage.find(s => !s.collected && !s.hidden && !s.heavy);
    window.__waterworld.teleport(s.mesh.position.x, s.mesh.position.y + 1, s.mesh.position.z);
  });
  await page.waitForTimeout(600);
  const cargo = await page.evaluate(() => window.__waterworld.state().cargo);
  if (cargo >= 1) pass(`auto-collected salvage (cargo=${cargo})`);
  else fail('salvage not collected on touch');

  // bank: teleport to the bell, score must rise and air refill
  await page.evaluate(() => {
    const g = window.__waterworld.game;
    g.air = 30;
    const b = g.dock.bell.position;
    window.__waterworld.teleport(b.x + 3, b.y, b.z);
  });
  await page.waitForTimeout(900);
  const banked = await page.evaluate(() => window.__waterworld.state());
  if (banked.score > 0) pass(`banked cargo for ${banked.score} points`);
  else fail('banking did not score');
  if (banked.air > 0.5) pass('air refilled at the bell');
  else fail(`air did not refill (${banked.air})`);

  // hazards exist and think: an eel must approach a nearby sub
  const eelDelta = await page.evaluate(async () => {
    const g = window.__waterworld.game;
    const e = g.eels[0];
    window.__waterworld.teleport(e.pos.x + 12, e.pos.y, e.pos.z);
    const d0 = e.pos.distanceTo(g.pos);
    await new Promise(r => setTimeout(r, 1200));
    return d0 - e.pos.distanceTo(g.pos);
  });
  if (eelDelta > 1) pass(`eel gave chase (closed ${eelDelta.toFixed(1)} units)`);
  else fail(`eel did not chase (delta ${eelDelta.toFixed(2)})`);

  // the guide layer: objective banner always has a goal and a live arrow
  const obj = await page.evaluate(() => ({
    text: document.getElementById('obj-text').textContent,
    dist: document.getElementById('obj-dist').textContent,
    arrow: document.getElementById('obj-arrow').style.transform,
  }));
  if (obj.text.length > 4 && /\d+m/.test(obj.dist) && /rotate/.test(obj.arrow)) {
    pass(`objective banner live: "${obj.text}" ${obj.dist}`);
  } else fail('objective banner empty: ' + JSON.stringify(obj));

  // the ship's log keeps everything; opening it shows entries
  await page.evaluate(() => document.getElementById('log-btn')
    .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  const logCount = await page.evaluate(() =>
    document.querySelectorAll('#log-panel.show #log-list li').length);
  if (logCount >= 1) pass(`ship's log open with ${logCount} entries`);
  else fail('log panel empty or closed');
  await page.click('#log-close');

  // the living water: fish schools must exist and actually swirl
  const fish = await page.evaluate(async () => {
    const fx = window.__waterworld.game.fx;
    const p0 = fx.schools[0].pos[0];
    await new Promise(r => setTimeout(r, 800));
    return { schools: fx.schools.length, moved: Math.abs(fx.schools[0].pos[0] - p0) };
  });
  if (fish.schools >= 2 && fish.moved > 0.01) pass(`fish schools swirling (${fish.schools} schools)`);
  else fail(`boids inert: ${JSON.stringify(fish)}`);

  // the curious seal: spawn it and let it swim
  const seal = await page.evaluate(async () => {
    window.__waterworld.game._spawnSeal();
    await new Promise(r => setTimeout(r, 600));
    const s = window.__waterworld.game.seal;
    return s ? { state: s.state } : null;
  });
  if (seal) pass(`seal visiting (state: ${seal.state})`);
  else fail('seal failed to spawn');

  // IR mode: toggle on via the real key, hot things read hot, toggle off
  await page.keyboard.press('i');
  const ir = await page.evaluate(() => {
    const g = window.__waterworld.game;
    return {
      on: g.ir, fxIr: g.fx.ir,
      fatbergHot: g.fatbergs[0].mesh.material.color.getHex(),
      fogDark: g.scene.fog.color.getHex(),
    };
  });
  if (ir.on && ir.fxIr) pass('IR toggled on via I key');
  else fail('IR did not toggle: ' + JSON.stringify(ir));
  if (ir.fatbergHot === 0xffdd66) pass('fatberg reads hot in IR');
  else fail(`fatberg not hot in IR: ${ir.fatbergHot.toString(16)}`);
  if (SHOTS) await page.screenshot({ path: join(SHOTDIR, 'waterworld-ir.png') });
  await page.keyboard.press('i');
  const irOff = await page.evaluate(() => {
    const g = window.__waterworld.game;
    return { on: g.ir, restored: g.fatbergs[0].mesh.material.color.getHex() !== 0xffdd66 };
  });
  if (!irOff.on && irOff.restored) pass('IR toggled off, materials restored');
  else fail('IR restore broken: ' + JSON.stringify(irOff));

  if (SHOTS) {
    await page.screenshot({ path: join(SHOTDIR, 'waterworld-play.png') });
    pass(`screenshot → ${SHOTDIR}/waterworld-play.png`);
  }

  // win path: force the chest through banking, endcard must show
  await page.evaluate(() => window.__waterworld.win());
  await page.waitForSelector('#endcard.show', { timeout: 8000 });
  const won = await page.evaluate(() => window.__waterworld.state().won);
  if (won) pass('win path: endcard shown, state.won true');
  else fail('win path broken');

  if (pageErrors.length) fail('page errors: ' + pageErrors.join(' | '));
  else pass('zero page errors');
} catch (e) {
  fail('playtest crashed: ' + e.message);
} finally {
  await browser?.close();
  server.kill();
}
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
