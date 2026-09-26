const fs = require('fs');
const W = new Function(fs.readFileSync(__dirname + '/world.js', 'utf8') + '; return { GEO, REG, resetWorldCaches, updateWindow, cellData, C };')();
if (process.env.GEOJ) { const g = JSON.parse(fs.readFileSync(process.env.GEOJ)); W.GEO.E = g.slice(0, 3); W.GEO.U = g.slice(4, 7); W.GEO.N = g.slice(8, 11); W.GEO.feats = []; for (let i = 0; i < g[12]; i++) W.GEO.feats.push([g[16 + i * 4], g[17 + i * 4], g[18 + i * 4], g[19 + i * 4], g[112 + i * 4]]); }
if (process.env.REGJS) { Object.assign(W.REG, JSON.parse(process.env.REGJS)); W.resetWorldCaches(); }
const [x, z, out] = [parseFloat(process.argv[2]), parseFloat(process.argv[3]), process.argv[4]];
W.updateWindow(Math.floor(x / W.C), Math.floor(z / W.C));
fs.writeFileSync(out, Buffer.from(W.cellData.buffer));
