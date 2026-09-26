// computes the 50 story places at build time (they are deterministic) so the page needn't
const fs = require('fs');
const W = new Function(fs.readFileSync(__dirname + '/../src/world.js', 'utf8') + fs.readFileSync(__dirname + '/../src/tales.js', 'utf8').split('// ---------- the story panel')[0] + '; return { buildPlaces };')();
const P = W.buildPlaces().map((p) => ({ ...p, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(4), pitch: +p.pitch.toFixed(4) }));
// every place the story refers to must exist
const need = [...fs.readFileSync(__dirname + '/../src/tales.ink', 'utf8').matchAll(/^# place: (\S+)/gm)].map((m) => m[1]);
const missing = need.filter((id) => !P.find((p) => p.id === id));
if (missing.length) { console.error('places used by the story but missing:', missing.join(', ')); process.exit(1); }
fs.writeFileSync(__dirname + '/../src/places.json', JSON.stringify(P));
console.log('baked', P.length, 'places');
