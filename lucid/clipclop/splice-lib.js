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
