/**
 * Runtime splice: drive the clipclop engine with a Lucid scene, without editing
 * the engine file. We fetch the engine's HTML as text, inject the codegen
 * bridge's WGSL, and rewrite ONE seam so the bake pipeline samples the Lucid
 * field instead of the hardcoded demo. The result is booted in an iframe.
 *
 * Why this seam. The engine bakes a sparse SDF atlas by sampling
 *   fn cacheSceneSample(p, s) -> CacheSample { distance, albedo }
 * For every demo, that is the one field the generate pass reads. Replace its
 * body and the baked world becomes the Lucid scene — geometry and albedo.
 *
 * Why namespacing. The engine already defines sdSphere/sdBox/sdTorus/sdCapsule/
 * sdCylinder with DIFFERENT signatures than Lucid's (sdCapsule takes two
 * endpoints, sdTorus takes two floats). WGSL forbids redefinition, so the
 * bridge's self-contained primitive set would collide. We prefix every function
 * the bridge declares (lx_*) so it lives beside the engine's, zero collisions.
 *
 * Scope note: this drives the BAKE path (the engine's sparse-cache pipeline,
 * its SOTA path). It does not touch the legacy analytic sceneSDF or the render
 * helpers. Needs a real WebGPU device to see; the assembly is Node-checkable.
 */

import { loadJsonScene } from '../core/json-loader.js';
import { generateWgslSceneSDF } from '../core/wgsl-codegen.js';
import { generateEditListWgsl, generateStorageFoldWgsl } from '../core/sdf-editlist.js';
import { buildBinnedFieldData } from '../core/sdf-editbins.js';
import { generateVmWgsl, interpretEdits } from '../core/sdf-vm.js';

// ---- storage-buffer edit list (uncapped scale) --------------------------
// The baked edit list is a WGSL const array capped at 2047 elements (~88 edits).
// To scale past that, the edit list lives in STORAGE BUFFERS the engine binds on
// a dedicated group 1, shared across the three pipelines that sample the field
// (classify / generate / render). Same exact chunked fold — only the data
// source changes. All edits are Node-checkable; the render needs a real device.

const LX_GROUP = 1;

// Engine anchors (verified unique / ordered in lucid/clipclop/index.html).
const A_SCENEBUFFER = "sceneBuffer=await scoped('scene buffer',()=>device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}))";
const A_LAYOUTS = ['bindGroupLayouts:[classifyBGL]', 'bindGroupLayouts:[generateBGL]', 'bindGroupLayouts:[renderBGL]'];
const A_SETBIND = [
  ['b.setBindGroup(0,level.classifyBind)', 'b'],
  ['c.setBindGroup(0,level.generateBind)', 'c'],
  ['pass.setBindGroup(0,renderBind)', 'pass']
];

/**
 * Splice a scene into the engine with the edit list in STORAGE buffers (no size
 * cap), booting it top-level. Returns the count info; the caller document.writes
 * nothing — this replaces the page like bootSplicedTopLevel does.
 * @returns {{ html:string, count:number, chunks:number }}
 */
export function buildStorageEngine(engineHtml, sceneJson, opts = {}) {
  const prefix = opts.prefix || 'lx_';
  const scene = loadJsonScene(sceneJson);

  // Two field forms, same seam and same group-1 wiring:
  //  flat   (default)     — the two-level chunked fold over ALL edits.
  //  binned (opts.binned) — per-brick trim: a CSR bin grid so each sample folds
  //                         only the handful of edits near its cell; exact in
  //                         the surface band, conservative lower bound beyond.
  // buffers: [key, TypedArray, 'f32'|'u32'] in binding order.
  let wgsl, buffers, info;
  if (opts.binned) {
    const b = buildBinnedFieldData(scene, { prefix, group: LX_GROUP, binding: 0, cell: opts.cell, band: opts.band, chunk: opts.chunk });
    wgsl = b.wgsl;
    buffers = [['e', b.editData, 'f32'], ['s', b.binStart, 'u32'], ['i', b.binEdits, 'u32'], ['g', b.gridData, 'f32']];
    info = { count: b.count, cells: b.cells, avgPerCell: b.avgPerCell, maxPerCell: b.maxPerCell };
  } else {
    const r = generateEditListWgsl(scene, { prefix, storage: true, group: LX_GROUP, binding: 0, chunk: opts.chunk || 16 });
    wgsl = r.wgsl;
    buffers = [['e', r.editData, 'f32'], ['c', r.chunkData, 'f32']];
    info = { count: r.count, chunks: r.chunks };
  }

  if (!engineHtml.includes(CACHESAMPLE_STRUCT)) throw new Error('splice: CacheSample anchor not found');
  if (!engineHtml.includes(CACHE_FN_HEADER)) throw new Error('splice: cacheSceneSample header not found');
  if (!engineHtml.includes(A_SCENEBUFFER)) throw new Error('splice: sceneBuffer anchor not found');
  for (const a of A_LAYOUTS) if (!engineHtml.includes(a)) throw new Error('splice: layout anchor not found: ' + a);
  for (const [a] of A_SETBIND) if (!engineHtml.includes(a)) throw new Error('splice: setBindGroup anchor not found: ' + a);

  let html = engineHtml;

  // 1) Inject the storage-fold WGSL after CacheSample (into the shared fragment,
  //    so classify/generate/render all see the group-1 bindings + editField).
  html = html.replace(CACHESAMPLE_STRUCT, CACHESAMPLE_STRUCT + '\n/* ===== Lucid storage edit list (spliced) ===== */\n' + wgsl + '\n');

  // 2) Point the bake seam at the edit-list field.
  html = replaceFnBody(html, CACHE_FN_HEADER, `let v=${prefix}editField(p);return CacheSample(v.x,v.yzw);`);

  // 3) Prepend the buffer data as a plain global, before the engine module.
  const dataJs = buffers.map(([k, arr]) => `${k}:[${Array.from(arr).join(',')}]`).join(',');
  const dataScript = `<script>window.__LX={${dataJs}};<\/script>`;
  html = html.replace('</title>', '</title>\n<meta name="lucid-splice" content="' + (opts.binned ? 'binned' : 'storage') + '">\n' + dataScript);

  // 4) Create the storage buffers + a group-1 layout/bind, right after the
  //    scene buffer (runs before pipeline layouts are built). window globals so
  //    the later pipeline/frame code can reference them regardless of scope.
  const mk = buffers.map(([k, _a, ty], j) => {
    const T = ty === 'u32' ? 'Uint32Array' : 'Float32Array';
    return `const a${j}=${T}.from(window.__LX.${k});` +
      `const b${j}=device.createBuffer({size:Math.max(16,a${j}.byteLength),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});` +
      `device.queue.writeBuffer(b${j},0,a${j});`;
  }).join('');
  const entriesL = buffers.map((_b, j) => `{binding:${j},visibility:GPUShaderStage.COMPUTE|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}}`).join(',');
  const entriesB = buffers.map((_b, j) => `{binding:${j},resource:{buffer:b${j}}}`).join(',');
  const bufInit = A_SCENEBUFFER + ';(function(){' + mk +
    `window.__lxBGL=device.createBindGroupLayout({entries:[${entriesL}]});` +
    `window.__lxBind=device.createBindGroup({layout:window.__lxBGL,entries:[${entriesB}]});` +
    '})()';
  html = html.replace(A_SCENEBUFFER, bufInit);

  // 5) Add group 1 to each of the three pipeline layouts.
  for (const a of A_LAYOUTS) html = html.replace(a, a.replace(']', ',window.__lxBGL]'));

  // 6) Bind group 1 on each of the three passes (right after group 0).
  for (const [call, enc] of A_SETBIND) html = html.replace(call, call + ';' + enc + '.setBindGroup(1,window.__lxBind)');

  // 7) Single-eval surface refinement — the per-frame render cost with a heavy field.
  html = patchCheapRefine(html);

  return { html, ...info };
}

// ---- interpreted templates (the VM path) ----------------------------------
// The scene is a compiled TEMPLATE PROGRAM (sdf-vm.js) plus a live parameter
// vector. A separate compute module — created in injected JS, so it never
// touches the engine's shader modules or their bind groups — interprets one
// edit per thread and writes the same edit storage buffer the group-1 fold
// reads. Changing a parameter is then:
//   window.__lxSetParams({fed: 0.6})
// = one small buffer write + one dispatch + a forceFull re-bake mark.
// No shader recompile, no CPU re-flatten, no geometry rebuild.

const A_SETAUTO = 'function setAuto(v){';

// The render pass refines every hit pixel with TWO analytic field evaluations
// per frame (refineGuided d0+d1) — cheap for the engine's 3-shape demo fields,
// but a spliced edit fold makes this the frame cost (measured 19Hz on device
// with an 80-edit fold). Cut it to ONE guided correction; the bounded clamp
// keeps it stable and the cached surface is the fallback either way.
const A_REFINE = 'fn refineGuided(ro:vec3<f32>,rd:vec3<f32>,guess:f32,cell:f32,cachedN:vec3<f32>)->vec2<f32>{';
function patchCheapRefine(html) {
  if (!html.includes(A_REFINE)) return html; // engine changed — leave refinement alone
  return replaceFnBody(html, A_REFINE,
    '/* lucid splice: single-eval refinement (heavy analytic field) */' +
    'let slope=dot(cachedN,rd);' +
    'let safeSlope=select(slope,select(-0.22,0.22,slope>=0.0),abs(slope)<0.22);' +
    'let d0=cacheSceneSDF(ro+rd*guess,scene);' +
    'let t=max(0.0,guess-clamp(d0/safeSlope,-cell*0.36,cell*0.36));' +
    'return vec2<f32>(t,abs(d0));');
}

/**
 * @param {string} engineHtml - fetched clipclop index.html
 * @param {object} prog - compiled template (compileTemplate output)
 * @param {object} paramValues - initial named parameter values
 * @returns {{ html:string, count:number, instructions:number }}
 */
export function buildInterpretedEngine(engineHtml, prog, paramValues, opts = {}) {
  const prefix = opts.prefix || 'lx_';
  const foldWgsl = generateStorageFoldWgsl(prog.count, { prefix, group: LX_GROUP, binding: 0 });
  const vmWgsl = generateVmWgsl(prog, { prefix: 'lxvm_', group: 0 });
  const params = prog.paramNames.map((n) => {
    if (!(n in paramValues)) throw new Error('missing param: ' + n);
    return paramValues[n];
  });

  if (!engineHtml.includes(CACHESAMPLE_STRUCT)) throw new Error('splice: CacheSample anchor not found');
  if (!engineHtml.includes(CACHE_FN_HEADER)) throw new Error('splice: cacheSceneSample header not found');
  if (!engineHtml.includes(A_SCENEBUFFER)) throw new Error('splice: sceneBuffer anchor not found');
  if (!engineHtml.includes(A_SETAUTO)) throw new Error('splice: setAuto anchor not found');
  for (const a of A_LAYOUTS) if (!engineHtml.includes(a)) throw new Error('splice: layout anchor not found: ' + a);
  for (const [a] of A_SETBIND) if (!engineHtml.includes(a)) throw new Error('splice: setBindGroup anchor not found: ' + a);

  let html = engineHtml;

  // 1) The FOLD goes into the shared fragment (classify/generate/render read it).
  html = html.replace(CACHESAMPLE_STRUCT, CACHESAMPLE_STRUCT + '\n/* ===== Lucid storage edit list (spliced, VM-written) ===== */\n' + foldWgsl + '\n');
  html = replaceFnBody(html, CACHE_FN_HEADER, `let v=${prefix}editField(p);return CacheSample(v.x,v.yzw);`);

  // 2) Program + params as globals. The VM WGSL rides along as a JS string.
  const dataScript = '<script>window.__LX={' +
    `code:[${Array.from(prog.code).join(',')}],` +
    `table:[${Array.from(prog.table).join(',')}],` +
    `consts:[${Array.from(prog.consts).join(',')}],` +
    `params:[${params.join(',')}],` +
    `names:${JSON.stringify(Object.fromEntries(prog.paramNames.map((n, i) => [n, i])))},` +
    `count:${prog.count},vm:${JSON.stringify(vmWgsl)}};<\/script>`;
  html = html.replace('</title>', '</title>\n<meta name="lucid-splice" content="interpreted">\n' + dataScript);

  // 3) Dirty hook: expose a forceFull setter from inside the engine's scope,
  //    planted just before setAuto (same module scope as forceFull).
  html = html.replace(A_SETAUTO, 'window.__lxDirty=function(){forceFull=true};' + A_SETAUTO);

  // 4) Buffers + the VM pipeline (its OWN module and layout — the engine's
  //    pipelines never see it) + the live-param API. Boot dispatch included:
  //    the animal on screen is GPU-interpreted from frame one, not uploaded.
  const bufInit = A_SCENEBUFFER + ';(function(){' +
    'const LX=window.__LX;const SB=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST;' +
    'const editBuf=device.createBuffer({size:Math.max(16,LX.count*92),usage:SB});' +
    'const chunkBuf=device.createBuffer({size:16,usage:SB});device.queue.writeBuffer(chunkBuf,0,new Float32Array([0,0,0,1e9]));' +
    'window.__lxBGL=device.createBindGroupLayout({entries:[' +
    '{binding:0,visibility:GPUShaderStage.COMPUTE|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},' +
    '{binding:1,visibility:GPUShaderStage.COMPUTE|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}}]});' +
    'window.__lxBind=device.createBindGroup({layout:window.__lxBGL,entries:[{binding:0,resource:{buffer:editBuf}},{binding:1,resource:{buffer:chunkBuf}}]});' +
    'const mkU32=(a)=>{const b=device.createBuffer({size:Math.max(16,a.length*4),usage:SB});device.queue.writeBuffer(b,0,Uint32Array.from(a));return b;};' +
    'const codeBuf=mkU32(LX.code),tableBuf=mkU32(LX.table);' +
    'const constBuf=device.createBuffer({size:Math.max(16,LX.consts.length*4),usage:SB});device.queue.writeBuffer(constBuf,0,new Float32Array(LX.consts));' +
    'const paramBuf=device.createBuffer({size:Math.max(16,LX.params.length*4),usage:SB});' +
    'const vmModule=device.createShaderModule({label:"lucid-template-vm",code:LX.vm});' +
    'const ro={buffer:{type:"read-only-storage"}},rw={buffer:{type:"storage"}};' +
    'const vmBGL=device.createBindGroupLayout({entries:[0,1,2,3].map(i=>({binding:i,visibility:GPUShaderStage.COMPUTE,...ro})).concat([{binding:4,visibility:GPUShaderStage.COMPUTE,...rw}])});' +
    'const vmPipe=device.createComputePipeline({label:"lucid-template-vm",layout:device.createPipelineLayout({bindGroupLayouts:[vmBGL]}),compute:{module:vmModule,entryPoint:"lxvm_main"}});' +
    'const vmBind=device.createBindGroup({layout:vmBGL,entries:[{binding:0,resource:{buffer:codeBuf}},{binding:1,resource:{buffer:tableBuf}},{binding:2,resource:{buffer:constBuf}},{binding:3,resource:{buffer:paramBuf}},{binding:4,resource:{buffer:editBuf}}]});' +
    'window.__lxParams=Float32Array.from(LX.params);' +
    'window.__lxRun=function(){device.queue.writeBuffer(paramBuf,0,window.__lxParams);' +
    'const enc=device.createCommandEncoder();const p=enc.beginComputePass();p.setPipeline(vmPipe);p.setBindGroup(0,vmBind);' +
    'p.dispatchWorkgroups(Math.ceil(LX.count/16));p.end();device.queue.submit([enc.finish()]);' +
    'if(window.__lxDirty)window.__lxDirty();};' +
    'window.__lxSetParams=function(o){for(const k in o){const i=LX.names[k];if(i!=null)window.__lxParams[i]=o[k];}window.__lxRun();};' +
    'window.__lxRun();' +
    '})()';
  html = html.replace(A_SCENEBUFFER, bufInit);

  // 5) Group 1 on the three field pipelines, bound on the three passes.
  for (const a of A_LAYOUTS) html = html.replace(a, a.replace(']', ',window.__lxBGL]'));
  for (const [call, enc] of A_SETBIND) html = html.replace(call, call + ';' + enc + '.setBindGroup(1,window.__lxBind)');

  // Single-eval surface refinement — the per-frame render cost with a heavy field.
  html = patchCheapRefine(html);

  return { html, count: prog.count, instructions: prog.code.length / 4 };
}

/** Interpreted splice, booted top-level (replaces the page). */
export function bootInterpretedTopLevel(engineHtml, prog, paramValues, opts = {}) {
  // sanity: the CPU twin must produce finite edits before we commit the page
  const twin = interpretEdits(prog, paramValues);
  for (const v of twin) if (!Number.isFinite(v)) throw new Error('template produced a non-finite edit value');
  const { html, ...info } = buildInterpretedEngine(engineHtml, prog, paramValues, opts);
  const overlay = opts.overlay || buildOverlay(opts);
  let out = patchCheapRefine(html).replace('let auto=true,', 'let auto=false,');
  if (overlay) out = out.replace('</body>', overlay + '\n</body>');
  document.open();
  document.write(out);
  document.close();
  return info;
}

/** Splice with storage buffers and boot top-level (replaces the page). */
export function bootStorageTopLevel(engineHtml, sceneJson, opts = {}) {
  const { html, ...info } = buildStorageEngine(engineHtml, sceneJson, opts);
  const overlay = opts.overlay || buildOverlay(opts);
  let out = patchCheapRefine(html).replace('let auto=true,', 'let auto=false,');
  if (overlay) out = out.replace('</body>', overlay + '\n</body>');
  document.open();
  document.write(out);
  document.close();
  return info;
}

/** Prefix every function the bridge declares, at declaration and call sites. */
export function namespaceWgsl(wgsl, prefix = 'lx_') {
  const names = new Set();
  const re = /\bfn\s+([A-Za-z_]\w*)\s*\(/g;
  let m;
  while ((m = re.exec(wgsl)) !== null) names.add(m[1]);
  let out = wgsl;
  for (const n of names) {
    out = out.replace(new RegExp('\\b' + n + '\\b', 'g'), prefix + n);
  }
  return out;
}

/**
 * Build the WGSL block for a Lucid scene, in one of two modes:
 *
 *  'codegen'  — the compiled tree (generateWgslSceneSDF). Code: nested calls.
 *               Namespaced lx_* to dodge the engine's primitive signatures.
 *  'editlist' — the flattened edit list (generateEditListWgsl). Data: a const
 *               buffer folded by a loop. Already self-contained + prefixed;
 *               no namespacing needed (it declares no bare sd* primitives).
 *
 * Both end at a function that returns vec4f(distance, albedo). The caller wires
 * the bake seam to it.
 * @returns {{ block, fieldFn, mode, unresolvedVars?, count?, unsupported? }}
 */
export function buildBridgeBlock(sceneJson, opts = {}) {
  const prefix = opts.prefix || 'lx_';
  const mode = opts.mode || 'codegen';
  const scene = loadJsonScene(sceneJson);

  if (mode === 'editlist') {
    const { wgsl, count, unsupported } = generateEditListWgsl(scene, { prefix });
    // edit-list field takes only the point.
    return { block: wgsl, entryCall: `${prefix}editField(p)`, mode, count, unsupported };
  }
  const { wgsl, unresolvedVars } = generateWgslSceneSDF(scene, { emitStructs: false });
  // codegen's field (lucidSceneField) takes (p, scene).
  return { block: namespaceWgsl(wgsl, prefix), entryCall: `${prefix}lucidSceneField(p, s)`, mode, unresolvedVars };
}

/** Find the body of `header` (up to its matching brace) and replace it. */
export function replaceFnBody(src, header, newInner) {
  const start = src.indexOf(header);
  if (start < 0) throw new Error(`splice: header not found: ${header}`);
  const braceOpen = start + header.length - 1; // header ends with '{'
  let depth = 0, i = braceOpen;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  if (i >= src.length) throw new Error('splice: unbalanced braces after header');
  return src.slice(0, braceOpen + 1) + newInner + src.slice(i);
}

// The exact engine seams (minified WGSL in lucid/clipclop/index.html).
const CACHESAMPLE_STRUCT = 'struct CacheSample{distance:f32,albedo:vec3<f32>};';
const CACHE_FN_HEADER = 'fn cacheSceneSample(p:vec3<f32>,s:Scene)->CacheSample{';

/**
 * Produce the spliced engine HTML.
 * @param {string} engineHtml - the fetched lucid/clipclop/index.html text
 * @param {object} sceneJson  - a Lucid scene (loader input shape)
 * @param {object} [opts]     - { prefix, mode: 'codegen'|'editlist' }
 * @returns {{ html: string, bridge: {block,entryCall,mode,...} }}
 */
export function spliceEngine(engineHtml, sceneJson, opts = {}) {
  const prefix = opts.prefix || 'lx_';
  const bridge = buildBridgeBlock(sceneJson, { prefix, mode: opts.mode || 'codegen' });

  if (!engineHtml.includes(CACHESAMPLE_STRUCT)) {
    throw new Error('splice: CacheSample struct anchor not found — engine changed?');
  }
  if (!engineHtml.includes(CACHE_FN_HEADER)) {
    throw new Error('splice: cacheSceneSample header not found — engine changed?');
  }

  // 1) Inject the bridge block right after CacheSample is declared (so Scene +
  //    CacheSample + all engine primitives precede it, inside the cache module).
  let html = engineHtml.replace(
    CACHESAMPLE_STRUCT,
    CACHESAMPLE_STRUCT + '\n/* ===== Lucid bridge (spliced) ===== */\n' + bridge.block + '\n'
  );

  // 2) Rewrite the bake seam to sample the Lucid field (vec4f: dist + albedo).
  html = replaceFnBody(html, CACHE_FN_HEADER,
    `let v=${bridge.entryCall};return CacheSample(v.x,v.yzw);`);

  // 3) Marker so a headless check can confirm the transform reached the browser.
  html = html.replace('</title>', '</title>\n<meta name="lucid-splice" content="active">');

  return { html, bridge };
}

/**
 * A compact, mobile-first overlay: one short line, bottom-left, that fades to
 * near-invisible after a few seconds and toggles back on tap. Built from
 * { title, links:[{label,href,on}] } so it stays small on a 320px screen.
 */
function buildOverlay(opts) {
  if (!opts.title && !(opts.links && opts.links.length)) return '';
  const links = (opts.links || []).map((l) =>
    `<a href="${l.href}" style="color:${l.on ? '#39c0ff' : '#9fb4cc'};text-decoration:none;margin:0 5px;pointer-events:auto">${l.label}</a>`).join('');
  const text = (opts.title || '') + (links ? ' · ' + links : '');
  return `<div id="lxov" style="position:fixed;left:8px;bottom:8px;z-index:99;padding:4px 9px;border-radius:9px;` +
    `font:11px ui-monospace,monospace;color:#9fb4cc;background:rgba(5,8,13,.5);max-width:calc(100vw - 16px);` +
    `transition:opacity .6s;opacity:.9">${text}</div>` +
    `<script>(function(){var o=document.getElementById('lxov');if(!o)return;` +
    `var h=setTimeout(function(){o.style.opacity=0.12;},4000);` +
    `o.addEventListener('click',function(e){if(e.target.tagName!=='A'){clearTimeout(h);o.style.opacity=(+o.style.opacity<0.5?0.9:0.12);}});})();<\/script>`;
}

/**
 * Splice a scene into the engine and boot it TOP-LEVEL (document.write),
 * replacing the current page. The engine is self-contained (no imports), so a
 * top-level write inits ONE WebGPU device in the page context — unlike a blob
 * iframe, which spins a fresh device per boot and intermittently fails ("boots
 * black sometimes").
 *
 * Also forces auto-orbit OFF: the engine idle-spins the camera, which keeps the
 * clipmap bricks perpetually dirty and re-bakes the whole scene every frame
 * (visible jank on heavier scenes). Off, the scene bakes once and holds; the
 * user still orbits by dragging.
 *
 * opts: { mode, title, links:[{label,href,on}] } — title/links make a compact
 * mobile overlay (see buildOverlay).
 * @returns {object} the bridge info (for the caller to stash before the write)
 */
export function bootSplicedTopLevel(engineHtml, sceneJson, opts = {}) {
  const { html, bridge } = spliceEngine(engineHtml, sceneJson, { mode: opts.mode || 'editlist' });
  let out = patchCheapRefine(html).replace('let auto=true,', 'let auto=false,'); // bake once, hold — no idle-orbit re-bake
  const overlay = opts.overlay || buildOverlay(opts);
  if (overlay) out = out.replace('</body>', overlay + '\n</body>');
  document.open();
  document.write(out);
  document.close();
  return bridge;
}
