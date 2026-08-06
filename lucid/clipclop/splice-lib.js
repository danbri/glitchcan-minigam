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
import { generateEditListWgsl } from '../core/sdf-editlist.js';

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
  const { wgsl, editData, chunkData, count, chunks } =
    generateEditListWgsl(scene, { prefix, storage: true, group: LX_GROUP, binding: 0, chunk: opts.chunk || 16 });

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

  // 3) Prepend the edit + chunk data as a plain global, before the engine module.
  const dataScript = `<script>window.__LX={e:[${Array.from(editData).join(',')}],c:[${Array.from(chunkData).join(',')}]};<\/script>`;
  html = html.replace('</title>', '</title>\n<meta name="lucid-splice" content="storage">\n' + dataScript);

  // 4) Create the two storage buffers + a group-1 layout/bind, right after the
  //    scene buffer (runs before pipeline layouts are built). window globals so
  //    the later pipeline/frame code can reference them regardless of scope.
  const bufInit = A_SCENEBUFFER + ';(function(){' +
    'const E=new Float32Array(window.__LX.e),C=new Float32Array(window.__LX.c);' +
    'const eb=device.createBuffer({size:Math.max(16,E.byteLength),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(eb,0,E);' +
    'const cb=device.createBuffer({size:Math.max(16,C.byteLength),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(cb,0,C);' +
    'window.__lxBGL=device.createBindGroupLayout({entries:[' +
    '{binding:0,visibility:GPUShaderStage.COMPUTE|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},' +
    '{binding:1,visibility:GPUShaderStage.COMPUTE|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}}]});' +
    'window.__lxBind=device.createBindGroup({layout:window.__lxBGL,entries:[{binding:0,resource:{buffer:eb}},{binding:1,resource:{buffer:cb}}]});' +
    '})()';
  html = html.replace(A_SCENEBUFFER, bufInit);

  // 5) Add group 1 to each of the three pipeline layouts.
  for (const a of A_LAYOUTS) html = html.replace(a, a.replace(']', ',window.__lxBGL]'));

  // 6) Bind group 1 on each of the three passes (right after group 0).
  for (const [call, enc] of A_SETBIND) html = html.replace(call, call + ';' + enc + '.setBindGroup(1,window.__lxBind)');

  return { html, count, chunks };
}

/** Splice with storage buffers and boot top-level (replaces the page). */
export function bootStorageTopLevel(engineHtml, sceneJson, opts = {}) {
  const { html, count, chunks } = buildStorageEngine(engineHtml, sceneJson, opts);
  const overlay = opts.overlay || buildOverlay(opts);
  let out = html.replace('let auto=true,', 'let auto=false,');
  if (overlay) out = out.replace('</body>', overlay + '\n</body>');
  document.open();
  document.write(out);
  document.close();
  return { count, chunks };
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
  let out = html.replace('let auto=true,', 'let auto=false,'); // bake once, hold — no idle-orbit re-bake
  const overlay = opts.overlay || buildOverlay(opts);
  if (overlay) out = out.replace('</body>', overlay + '\n</body>');
  document.open();
  document.write(out);
  document.close();
  return bridge;
}
