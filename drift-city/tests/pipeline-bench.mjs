// Times the scene pipeline build alone (Node Dawn, lavapipe): node drift-city/tests/pipeline-bench.mjs [city.html] [entry]
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
const code = wg['wgsl-common'] + wg['wgsl-scene'];
const t0 = performance.now();
const mod = dev.createShaderModule({ code });
const info = await mod.getCompilationInfo();
for (const m of info.messages) if (m.type === 'error') console.log('WGSL', m.lineNum, m.message);
const t1 = performance.now();
const entry = process.argv[3] || 'scene';
await dev.createRenderPipelineAsync({ layout: 'auto', vertex: { module: mod, entryPoint: 'vs' }, fragment: { module: mod, entryPoint: entry, targets: [{ format: 'rgba16float' }] }, primitive: { topology: 'triangle-list' } }).catch((e) => console.log('PIPE', e.message.slice(0, 300)));
console.log(entry, 'module', ((t1 - t0) / 1000).toFixed(1), 's; pipeline', ((performance.now() - t1) / 1000).toFixed(1), 's');
process.exit(0);
