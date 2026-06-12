#!/usr/bin/env node
// Generate a 3D world via the World Labs World API (Marble) and cache it in-repo.
// Needs WLT_API_KEY in the environment (platform.worldlabs.ai/api-keys — paid account).
//
//   WLT_API_KEY=... node trees/tools/generate-marble-world.mjs "phosphor wireframe Bristol harbour at dusk"
//   WLT_API_KEY=... node trees/tools/generate-marble-world.mjs --image https://.../bristol.jpg "optional prompt"
//
// Output: trees/data/marble/<world_id>/ {splat .spz (3 resolutions), collider.glb, pano}
// Docs: https://docs.worldlabs.ai/api/index.md   Generation takes ~5 minutes.
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const KEY = process.env.WLT_API_KEY;
if (!KEY) { console.error('Set WLT_API_KEY (see platform.worldlabs.ai/api-keys)'); process.exit(1); }
const API = 'https://api.worldlabs.ai/marble/v1';
const HDR = { 'WLT-Api-Key': KEY, 'Content-Type': 'application/json' };

const args = process.argv.slice(2);
const imgIdx = args.indexOf('--image');
const imageUri = imgIdx >= 0 ? args[imgIdx+1] : null;
const text = (imgIdx >= 0 ? args.filter((_,i)=>i!==imgIdx&&i!==imgIdx+1) : args).join(' ')
  || 'Bristol harbourside at dusk, glowing wireframe vector aesthetic, phosphor green on dark, drizzle';

const body = {
  display_name: 'glitchcan bristol ' + new Date().toISOString().slice(0,16),
  model: 'marble-1.1',
  world_prompt: imageUri
    ? { type: 'image', image_prompt: { source: 'uri', uri: imageUri }, text_prompt: text }
    : { type: 'text', text_prompt: text },
};
console.log('generating:', JSON.stringify(body.world_prompt).slice(0, 140));
let r = await fetch(`${API}/worlds:generate`, { method: 'POST', headers: HDR, body: JSON.stringify(body) });
if (!r.ok) { console.error('generate failed', r.status, await r.text()); process.exit(1); }
let op = await r.json();
console.log('operation:', op.operation_id || op.name || JSON.stringify(op).slice(0,120));
const opId = op.operation_id || (op.name || '').split('/').pop();

while (!op.done) {                                   // ~5 min; poll politely
  await new Promise(res => setTimeout(res, 15000));
  r = await fetch(`${API}/operations/${opId}`, { headers: HDR });
  op = await r.json();
  process.stdout.write('.');
}
console.log('\ndone.');
if (op.error) { console.error('generation error:', JSON.stringify(op.error)); process.exit(1); }
const world = op.response || op.result || op;
console.log(JSON.stringify(world, null, 2).slice(0, 1500));

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'marble',
  (world.world_id || world.id || 'world').toString());
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'world.json'), JSON.stringify(world, null, 2));
// download every asset URL we can find in the response
const urls = JSON.stringify(world).match(/https?:\/\/[^"\s]+/g) || [];
for (const u of urls) {
  const name = u.split('/').pop().split('?')[0];
  if (!/\.(spz|glb|ply|splat|jpg|jpeg|png|webp)$/i.test(name)) continue;
  process.stdout.write('fetching ' + name + ' … ');
  const res = await fetch(u, { headers: { 'WLT-Api-Key': KEY } });
  if (res.ok) { writeFileSync(join(outDir, name), Buffer.from(await res.arrayBuffer())); console.log('ok'); }
  else console.log(res.status);
}
console.log('cached in', outDir);
console.log('view online: https://marble.worldlabs.ai/world/' + (world.world_id || world.id || '?'));
