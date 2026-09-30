// Pinch to move, checked through the real page code on Node Dawn (dawn-run.mjs, PINCH=a,b,n): the WebGL fallback
// has no walking or free flight, so a headless Chromium page cannot test this. Needs the dawn-run setup (the
// drift-city skill, "Seeing a shader change"); each case takes a few minutes the first time (shader compile).
//   node drift-city/tests/pinch.mjs
// Checks: in a scene, fingers apart moves forward and together moves back, without turning the view; a quick
// pinch goes on after the fingers lift; a slow one stops when they lift; flying by hand, fingers apart goes down.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
let failed = 0;
const pass = (m) => console.log('✔', m);
const fail = (m) => { failed++; console.error('✖', m); };
function run(env, frames) {
  const out = execFileSync('node', [join(here, 'dawn-run.mjs')], {
    env: { ...process.env, W: '320', H: '320', DPR: '1', FRAMES: String(frames), ...env }, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 1500000,
  });
  if (!/errors none/.test(out)) fail(`render errors: ${(out.match(/errors .*/) || [''])[0]}`);
  const rows = {};
  for (const m of out.matchAll(/PINCHLOG (\d+) (\w+) along (-?[\d.]+) yaw (-?[\d.]+) s (-?[\d.]+) rate (-?[\d.]+) alt (\S+)/g)) {
    rows[+m[1]] = { mode: m[2], along: +m[3], yaw: +m[4], s: +m[5], rate: +m[6], alt: m[7] === '-' ? null : +m[7] };
  }
  return rows;
}

// quick spread: 10 frames at 60 Hz, lifted at frame 19
let r = run({ PINCH: '120,260,10', HOP: 'place:street_1' }, 34);
const moved = r[19].along - r[8].along, after = r[33].along - r[19].along;
moved > 0.5 && after > 0.3 && Math.abs(r[33].yaw - r[8].yaw) < 0.01
  ? pass(`walking: a quick spread moves forward (${moved.toFixed(2)} m while the fingers move), goes on after they lift (${after.toFixed(2)} m in 0.23 s), and does not turn the view`)
  : fail(`quick spread: ${JSON.stringify({ moved, after, yaw: [r[8].yaw, r[33].yaw] })}`);

// slow pinch in: 40 frames, lifted at frame 49
r = run({ PINCH: '260,120,40', HOP: 'place:street_1' }, 58);
const back = r[49].along - r[8].along, rest = Math.abs(r[57].along - r[50].along);
back < -0.5 && rest < 0.001
  ? pass(`walking: a slow pinch in moves back (${back.toFixed(2)} m) and stops when the fingers lift`)
  : fail(`slow pinch: ${JSON.stringify({ back, rest })}`);

// flying by hand at 300 km: a spread goes down
r = run({ PINCH: '120,300,10', FREEALT: '300' }, 22);
r[8].alt && r[21].alt < r[8].alt * 0.8
  ? pass(`flying: fingers apart goes down (${(r[8].alt / 1000).toFixed(0)} km to ${(r[21].alt / 1000).toFixed(0)} km)`)
  : fail(`flying: ${JSON.stringify([r[8], r[21]])}`);

console.log(failed ? '\nPINCH: FAIL' : '\nPINCH: PASS');
process.exit(failed ? 1 : 0);
