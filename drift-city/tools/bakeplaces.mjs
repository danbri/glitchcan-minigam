// computes the 50 story places at build time (they are deterministic) so the page needn't
import fs from 'node:fs';
import { compileStory, knotTags, STORY_FILES } from './story.mjs';
const src = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
const W = new Function(src('gen/design.js') + src('world.js') + src('tales.js').split('// ---------- the story panel')[0] + '; return { buildPlaces };')();
const P = W.buildPlaces().map((p) => ({ ...p, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(4), pitch: +p.pitch.toFixed(4) }));
// every place a story refers to must exist (read from the compiled story's knot tags)
const need = [];
for (const file of STORY_FILES) for (const tags of Object.values(knotTags(compileStory(file).story))) for (const t of tags) {
  const i = t.indexOf(':');
  if (i > 0 && t.slice(0, i).trim() === 'place') need.push(t.slice(i + 1).trim());
}
const missing = [...new Set(need)].filter((id) => !P.find((p) => p.id === id));
if (missing.length) { console.error('places used by the story but missing:', missing.join(', ')); process.exit(1); }
fs.writeFileSync(new URL('../src/places.json', import.meta.url), JSON.stringify(P));
console.log('baked', P.length, 'places;', new Set(need).size, 'used by the stories');
