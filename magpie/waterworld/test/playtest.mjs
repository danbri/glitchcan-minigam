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

  // drag steering: incremental nudges set a live course
  const dragged = await page.evaluate(() => {
    const g = window.__waterworld.game;
    const y0 = g._explore ? g._explore.yaw : g.yaw;
    g.steerDrag(0.15, 0.05);
    g.steerDrag(0.15, 0.05);
    return { moved: Math.abs(g._explore.yaw - y0) > 0.5, live: g._explore.until > g.elapsed };
  });
  if (dragged.moved && dragged.live) pass('drag steering nudges the course incrementally');
  else fail('steerDrag broken: ' + JSON.stringify(dragged));

  // hold station: the brake kills way
  const braked = await page.evaluate(async () => {
    const g = window.__waterworld.game;
    g.vel.set(10, 0, 0);
    g.setBrake(true);
    await new Promise(r => setTimeout(r, 700));
    const v = g.vel.length();
    g.setBrake(false);
    return v;
  });
  if (braked < 4) pass(`brake holds station (speed 10 → ${braked.toFixed(1)})`);
  else fail(`brake weak: speed still ${braked.toFixed(1)}`);

  // the coalition board opens from the goal banner
  await page.evaluate(() => document.getElementById('objective')
    .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  const board = await page.evaluate(() => ({
    shown: document.getElementById('board-panel').classList.contains('show'),
    rows: document.querySelectorAll('#board-list li').length,
  }));
  if (board.shown && board.rows >= 1) pass(`coalition board opens from the banner (${board.rows} rows)`);
  else fail('board broken: ' + JSON.stringify(board));
  await page.click('#board-close');

  // the detailed boat: animated parts must exist
  const subParts = await page.evaluate(() => {
    const ud = window.__waterworld.game.sub.userData;
    return ['prop', 'prop2', 'planes', 'forePlanes', 'rudder', 'beacon'].filter(k => !ud[k]);
  });
  if (!subParts.length) pass('sub v2: props, planes, rudder, beacon all present');
  else fail('sub missing parts: ' + subParts.join(','));

  // DASH: double-tap A must spike the speed
  const dashed = await page.evaluate(async () => {
    const g = window.__waterworld.game;
    const v0 = g.vel.length();
    g.setKey('a', true); g.setKey('a', false);
    g.setKey('a', true); g.setKey('a', false);
    await new Promise(r => setTimeout(r, 120));
    return { v0, v1: g.vel.length() };
  });
  if (dashed.v1 > dashed.v0 + 10) pass(`dash spikes speed (${dashed.v0.toFixed(1)} → ${dashed.v1.toFixed(1)})`);
  else fail(`dash inert: ${JSON.stringify(dashed)}`);

  // PUSH-YOUR-LUCK: damage with cargo aboard spills recoverable loot
  const spilled = await page.evaluate(() => {
    const g = window.__waterworld.game;
    g.cargo.push({ type: 'clay_pipe', value: 10 }, { type: 'green_bottle', value: 10 },
      { type: 'tea_chest', value: 20 }, { type: 'cannonball', value: 25 });
    g._damage(0, 'test knock');
    return { spilled: g.spilled.length, kept: g.cargo.length };
  });
  if (spilled.spilled >= 2 && spilled.kept >= 1) pass(`hit spills cargo (${spilled.spilled} loose, ${spilled.kept} kept)`);
  else fail('spill mechanic broken: ' + JSON.stringify(spilled));
  await page.evaluate(() => {
    const g = window.__waterworld.game;
    g.spilled.forEach(s => g.scene.remove(s.mesh));
    g.spilled = []; g.cargo = []; g.hull = 4;
  });

  // LEGIBILITY: the sonar chart opens and draws
  await page.evaluate(() => document.getElementById('map-btn')
    .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  const mapOpen = await page.evaluate(() => {
    const cv = document.getElementById('map-canvas');
    const shown = document.getElementById('map-panel').classList.contains('show');
    const px = cv.getContext('2d').getImageData(cv.width / 2, cv.height / 2, 1, 1).data;
    return { shown, drawn: px[0] + px[1] + px[2] > 0 };
  });
  if (mapOpen.shown && mapOpen.drawn) pass('sonar chart opens and draws');
  else fail('sonar chart broken: ' + JSON.stringify(mapOpen));
  await page.click('#map-close');

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
    // the strongbox: heavy (uncollectable without grapple) AND in open
    // water, away from collider-avoidance limit cycles
    const s = g.salvage.find(s => s.type === 'captains_chest');
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
  // keep-alive: the chase leaves a live eel on our tail, and the sweeps
  // ahead teleport through hazards. Death mid-harness jams every later
  // assertion (over=true blocks pings and collects), so from here the
  // harness sails an unsinkable boat: _lose becomes a no-op and the
  // tanks stay topped up. Damage/lose behavior was already asserted above.
  await page.evaluate(() => {
    const g = window.__waterworld.game;
    g._lose = () => {};
    g.air = 100; g.hull = 3;
    setInterval(() => { g.air = Math.max(g.air, 60); g.hull = Math.max(g.hull, 3); }, 2000);
  });

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

  // REACHABILITY: every quest item must be collectable — a rope inside
  // wreck collision once made the game unwinnable (review finding)
  const unreachable = await page.evaluate(async () => {
    const g = window.__waterworld.game;
    const bad = [];
    for (const q of g.quest) {
      if (q.taken) continue;
      window.__waterworld.teleport(q.mesh.position.x, q.mesh.position.y + 1, q.mesh.position.z);
      await new Promise(r => setTimeout(r, 350));
      if (!q.taken) bad.push(q.id);
    }
    return bad;
  });
  if (!unreachable.length) pass('all quest items reachable (grapple, loudspeaker, lamp, lance)');
  else fail('UNREACHABLE quest items: ' + unreachable.join(','));

  // CAMPAIGN SMOKE: the story machine advances through the whale + eel arcs
  const story = await page.evaluate(async () => {
    const g = window.__waterworld.game;
    const c = g.campaign;
    c.begin();
    const s0 = c.stage;
    for (const b of g.bones) {
      window.__waterworld.teleport(b.mesh.position.x, b.mesh.position.y + 1, b.mesh.position.z);
      await new Promise(r => setTimeout(r, 350));
    }
    const afterBones = c.whale.step;
    window.__waterworld.teleport(g.steelyard.position.x + 2, g.steelyard.position.y + 3, g.steelyard.position.z);
    await new Promise(r => setTimeout(r, 400));
    const afterBury = c.whale.step;
    for (const el of g.elders) {
      window.__waterworld.teleport(el.mesh.position.x + 3, el.mesh.position.y, el.mesh.position.z);
      await new Promise(r => setTimeout(r, 250));
      window.__waterworld.ping();
      await new Promise(r => setTimeout(r, 1200));
    }
    return { s0, afterBones, afterBury, eelStep: c.eel.step, seats: c.seats() };
  });
  // afterBury is 'speaker' normally, or 'lament' when the reachability
  // sweep above already auto-crafted the loudspeaker — both are legal
  if (story.s0 === 'rising' && story.afterBones === 'bury'
      && ['speaker', 'lament'].includes(story.afterBury)
      && story.eelStep === 'fragments') {
    pass(`campaign advances (whale: ${story.afterBury}, eels: ${story.eelStep})`);
  await page.evaluate(() => { const g = window.__waterworld.game; g.air = 100; g.hull = 3; });
  } else fail('campaign machine stuck: ' + JSON.stringify(story));

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

  // THE FINALE: coalition complete → berg armada → pen → SPARK → the end
  // Long swiftshader runs starve the sub of air and hull; feed her first
  // (over must be false or _doPing refuses and the spark never fires).
  const alive = await page.evaluate(() => {
    const g = window.__waterworld.game;
    g.air = 100; g.hull = 3;
    return { over: g.over, won: g.won };
  });
  if (!alive.over) pass('sub alive going into the finale');
  else fail('sub dead before the finale: ' + JSON.stringify(alive));
  const finale = await page.evaluate(async () => {
    const g = window.__waterworld.game;
    const c = g.campaign;
    c.coalition.whales = true;
    c.coalition.eels = true;
    c.joinRiver();                       // third seat triggers the finale
    await new Promise(r => setTimeout(r, 400));
    const bergs = c.finale.bergs.length;
    c.finale.bergs.forEach(b => { b.penned = true; });
    const p = g.pylon.position;
    window.__waterworld.teleport(p.x - 6, p.y + 8, p.z);
    await new Promise(r => setTimeout(r, 400));
    window.__waterworld.ping();
    await new Promise(r => setTimeout(r, 600));
    return { bergs, stage: c.stage, won: g.won };
  });
  if (finale.bergs === 6 && finale.stage === 'won' && finale.won) {
    pass(`FINALE: armada of ${finale.bergs} penned and sparked — story won`);
  } else fail('finale broken: ' + JSON.stringify(finale));
  await page.waitForSelector('#endcard.show', { timeout: 9000 });
  const end = await page.evaluate(() => ({
    title: document.getElementById('end-title').textContent,
    uiDown: document.body.classList.contains('game-over'),
    bannerGone: getComputedStyle(document.getElementById('objective')).display === 'none',
  }));
  if (/BERGS ARE BEATEN/.test(end.title) && end.uiDown && end.bannerGone) {
    pass('story endcard up, live UI stood down');
  } else fail('endcard state wrong: ' + JSON.stringify(end));

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
