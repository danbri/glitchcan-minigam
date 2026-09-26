const fs = require('fs');
const W = new Function(fs.readFileSync(__dirname + '/world.js', 'utf8') + '; return { GEO, REG, resetWorldCaches, farInfo, wrapS };')();
if (process.env.GEOJ) { const g = JSON.parse(fs.readFileSync(process.env.GEOJ)); W.GEO.E = g.slice(0, 3); W.GEO.U = g.slice(4, 7); W.GEO.N = g.slice(8, 11); W.GEO.feats = []; for (let i = 0; i < g[12]; i++) W.GEO.feats.push([g[16 + i * 4], g[17 + i * 4], g[18 + i * 4], g[19 + i * 4], g[112 + i * 4]]); }
if (process.env.REGJS) { Object.assign(W.REG, JSON.parse(process.env.REGJS)); W.resetWorldCaches(); }
const N = 768, buf = new Float32Array(N * N * 4);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const f = W.farInfo(W.wrapS(i), W.wrapS(j));
  if (f) buf.set(f, (j * N + i) * 4);
}
fs.writeFileSync(process.argv[2], Buffer.from(buf.buffer));
