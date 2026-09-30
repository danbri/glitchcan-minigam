// Finds street-corner views of the Life towers (Conway Corner): node drift-city/tools/life-view-search.mjs
// About 5 minutes. Uses the shader's own Life rules; why and how: the drift-city skill, "Conway Corner".
import fs from 'node:fs';
const src = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
const W = new Function(src('world.js') + '; return { cellAt, hsh, wrapS, heightAt, C };')();
const { cellAt, hsh, wrapS, heightAt, C } = W;
const seed = (cx, cz) => (wrapS(cx) * 7919 + wrapS(cz) * 104729) | 0;
const T = [];
for (let cz = -40; cz <= 20; cz++) for (let cx = -45; cx <= 15; cx++) {
  const o = cellAt(cx, cz); if (o.wild) continue;
  const mega = ((o.fl >> 15) & 7) === 6, sd = seed(cx, cz);
  const x = (cx + 0.5) * C + o.offx, z = (cz + 0.5) * C + o.offz;
  if (o.typ === 1 && o.v < 0.4 && !mega && hsh(sd, 5, 781) < (o.h >= 43.2 ? 0.5 : 0.15)) T.push({ k: 'box', x, z, h: o.h, cx, cz });
  if (o.typ === 8 && hsh(sd, 5, 781) < (o.h >= 50.4 ? 0.9 : 0.3)) T.push({ k: 'org', x, z, h: o.h, cx, cz });
}
console.log('box life', T.filter(t => t.k === 'box').length, 'organic life', T.filter(t => t.k === 'org').length);
const clear = (ax, ay, az, t) => { const dx = t.x - ax, dz = t.z - az, d = Math.hypot(dx, dz); const ty = t.h * 0.75;
  for (let s = 8; s < d - 16; s += 4) { const f = s / d; const y = ay + (ty - ay) * f; if (heightAt(ax + dx * f, az + dz * f, y) > y) return false; } return true; };
let best = [];
for (let cz = -40; cz <= 20; cz++) for (let cx = -45; cx <= 15; cx++) for (const y of [45, 70, 95]) {
  const ax = cx * C, az = cz * C; if (heightAt(ax, az, y) > y - 5) continue;
  for (let a = 0; a < 60; a++) { const yaw = a * Math.PI / 30; let sc = 0, nb = 0, no = 0;
    for (const t of T) { const dx = t.x - ax, dz = t.z - az, d = Math.hypot(dx, dz); if (d < 40 || d > 300) continue;
      let da = Math.atan2(dz, dx) - yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > 0.32) continue;
      if (!clear(ax, y, az, t)) continue; const w = Math.min(t.h, 40) / d; if (t.k === 'box') { sc += w * 12; nb++; } else { sc += w * 9; no++; } }
    if (nb >= 2) best.push({ sc, nb, no, x: ax, y, z: az, yaw }); } }
best.sort((a, b) => b.sc - a.sc);
console.log(best.slice(0, 6).map(b => JSON.stringify({ ...b, sc: +b.sc.toFixed(2), yaw: +b.yaw.toFixed(3) })).join('\n'));
