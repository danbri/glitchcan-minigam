// Times one pipeline build (Node Dawn, lavapipe): node drift-city/tests/pipeline-bench.mjs [city.html] [scene | roomScene:<kind>]
// Clear ~/.cache/mesa_shader_cache first for a cold number; why: the drift-city skill, "The city's pause"
import { create, globals } from 'webgpu';
import fs from 'fs';
Object.assign(globalThis, globals);
const html = fs.readFileSync(process.argv[2] || new URL('../dist/city.html', import.meta.url), 'utf8');
const wg = {};
for (const m of html.matchAll(/<script type="text\/(?:wgsl|ink)" id="([^"]+)">\n([\s\S]*?)<\/script>/g)) wg[m[1]] = m[2];
const gpu = create([]);
const ad = await gpu.requestAdapter();
const dev = await ad.requestDevice({ requiredLimits: { maxStorageBuffersPerShaderStage: ad.limits.maxStorageBuffersPerShaderStage, maxUniformBuffersPerShaderStage: ad.limits.maxUniformBuffersPerShaderStage, maxSampledTexturesPerShaderStage: ad.limits.maxSampledTexturesPerShaderStage, maxBindingsPerBindGroup: ad.limits.maxBindingsPerBindGroup } });
dev.onuncapturederror = (e) => console.log('ERR', e.error.message.slice(0, 300));
// the city's pipeline is common + scene + rooms-off; a room's is common + scene + rooms + every place + the dispatch
// main.js writes (roomDispatch), built with ROOM_K = its kind. Entry "roomScene:1" times the Cold Tap's.
const entry = process.argv[3] || 'scene';
const [ep, kind] = entry.split(':');
let code = wg['wgsl-common'] + wg['wgsl-scene'];
let constants;
if (ep === 'roomScene') {
  const rooms = [...html.matchAll(/kind: (\d+), wgsl: "(\w+)", map: "(\w+)"/g)].map((m) => ({ kind: +m[1], wgsl: m[2], map: m[3] }));
  code += wg['wgsl-rooms'] + [...new Set(rooms.map((r) => r.wgsl))].map((w) => wg['wgsl-room-' + w]).join('\n')
    + 'fn rmPlaceMap(q: vec3f) -> vec2f {\n  switch ROOM_K {\n' + rooms.map((r) => `    case ${r.kind}: { return ${r.map}(q); }\n`).join('') + '    default: { return vec2f(1e5, 0.0); }\n  }\n}\n';
  constants = { ROOM_K: +(kind || 1) };
} else code += wg['wgsl-rooms-off'] || '';
const t0 = performance.now();
const mod = dev.createShaderModule({ code });
const info = await mod.getCompilationInfo();
for (const m of info.messages) if (m.type === 'error') console.log('WGSL', m.lineNum, m.message);
const t1 = performance.now();
await dev.createRenderPipelineAsync({ layout: 'auto', vertex: { module: mod, entryPoint: 'vs' }, fragment: { module: mod, entryPoint: ep, constants, targets: [{ format: 'rgba16float' }] }, primitive: { topology: 'triangle-list' } }).catch((e) => console.log('PIPE', e.message.slice(0, 300)));
console.log(entry, 'module', ((t1 - t0) / 1000).toFixed(1), 's; pipeline', ((performance.now() - t1) / 1000).toFixed(1), 's');
process.exit(0);
