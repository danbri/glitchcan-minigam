// build-standalone.mjs — build a self-contained pascalite-standalone.html
// from pascalite.js + the third_party Pascal source files. Useful for
// previewing the demo via services like htmlpreview.github.io that serve as
// text/html but don't proxy relative imports / fetches.
//
// Run: node biomorphs/build-standalone.mjs
//
// The output is a build artefact derived from existing project files;
// canonical sources remain at biomorphs/pascalite.js and
// biomorphs/third_party/monochrome_pascal/.

import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('.', import.meta.url);

const interpSrc = readFileSync(new URL('pascalite.js', root), 'utf8');
const globalsSrc = readFileSync(
    new URL('third_party/monochrome_pascal/Globals', root), 'utf8');
const biomorphsSrc = readFileSync(
    new URL('third_party/monochrome_pascal/Biomorphs', root), 'utf8');

// Strip ES module syntax so the interpreter can run inside a regular
// <script> tag, then expose its public API on window.Pascalite. We do this
// mechanically (regex on `export ` prefixes only) — the interpreter source
// is unchanged in spirit.
const inlinedInterp = interpSrc
    .replace(/^export const /gm, 'const ')
    .replace(/^export function /gm, 'function ')
    + '\n;window.Pascalite = { parse, makeInterpreter, defaultHost };\n';

// Pascal source goes into <script type="text/x-pascal-src"> blocks. Any
// embedded "</script>" sequences in the Pascal source must be neutralised
// (none present in current files, but defend against future edits).
function escapePascalForScriptTag(src) {
    return src.replace(/<\/(script)/gi, '<\\/$1');
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Biomorphs (Pascal-lite, self-contained)</title>
<style>
  :root { --bg:#111; --fg:#eee; --paper:#1a1a22; --border:#333;
          --accent:#f43f5e; --muted:#888; }
  html,body { margin:0; padding:0; background:var(--bg); color:var(--fg);
              font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;
              min-height:100vh;
              overscroll-behavior:none;
              -webkit-touch-callout:none; -webkit-user-select:none; user-select:none; }
  .breeder, .breeder * { touch-action:manipulation; }
  header { padding:1rem 1.25rem; border-bottom:1px solid #222; }
  header h1 { margin:0 0 0.25rem 0; font-size:1.05rem; }
  header p  { margin:0; color:var(--muted); font-size:0.82rem; }
  header a  { color:var(--accent); }
  header code { background:#181820; padding:1px 4px; border-radius:3px; }
  main { padding:1rem; max-width:980px; margin:0 auto; display:grid; gap:1rem; }
  .breeder { display:grid; grid-template-columns:repeat(3,1fr);
             grid-template-rows:repeat(3,1fr); gap:0.5rem; aspect-ratio:1/1; }
  .cell { background:var(--paper); border:1px solid var(--border);
          border-radius:6px; padding:4px; cursor:pointer; position:relative;
          overflow:hidden; display:flex; align-items:center; justify-content:center; }
  .cell:hover { background:#2a2a35; border-color:#555; }
  .cell.parent { border-color:var(--accent); cursor:default; }
  .cell.parent::after { content:"parent"; position:absolute; bottom:4px; right:6px;
                        font-size:0.65rem; color:var(--accent); letter-spacing:0.05em;
                        text-transform:uppercase; }
  .cell .label { position:absolute; top:4px; left:6px; font-size:0.65rem;
                 color:var(--muted); text-transform:uppercase;
                 letter-spacing:0.04em; pointer-events:none; }
  .cell canvas { width:100%; height:100%; display:block; }
  .controls { display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center; }
  button { background:#222; color:var(--fg); border:1px solid #333;
           padding:0.5rem 0.85rem; border-radius:4px; font:inherit; cursor:pointer; }
  button:hover { background:#2c2c2c; border-color:#555; }
  .status { color:var(--muted); font-size:0.8rem; min-height:1.2em;
            font-family:ui-monospace,"SF Mono",Menlo,monospace; }
  .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr));
           gap:0.5rem; font-family:ui-monospace,"SF Mono",Menlo,monospace; font-size:0.75rem; }
  .stats .stat { background:#181820; border:1px solid #2a2a30;
                 border-radius:4px; padding:0.5rem 0.75rem; }
  .stats .stat .k { color:var(--muted); font-size:0.65rem; text-transform:uppercase; }
  details.gp { background:#181820; border:1px solid #2a2a30; border-radius:6px;
               padding:0.5rem 0.75rem; }
  details.gp summary { cursor:pointer; color:var(--muted); font-size:0.8rem; }
  pre.gp { margin:0.5rem 0 0 0; font-family:ui-monospace,"SF Mono",Menlo,monospace;
           font-size:0.7rem; white-space:pre-wrap; word-break:break-all;
           -webkit-user-select:text; user-select:text; color:var(--fg); }
  footer { padding:1rem 1.25rem; color:var(--muted); font-size:0.75rem;
           border-top:1px solid #222; margin-top:2rem; }
  footer a { color:var(--muted); }
</style>
</head>
<body>

<header>
  <h1>Biomorphs (Pascal-lite, self-contained build)</h1>
  <p>
    Single-file build of <a href="pascalite.html">pascalite.html</a>: the
    Pascal-lite interpreter and the third_party Pascal source for
    <code>Globals</code> + <code>Biomorphs</code> are inlined below so this
    page works through proxies that don't follow relative imports/fetches
    (e.g. <code>htmlpreview.github.io</code>). Canonical sources at
    <code>biomorphs/pascalite.js</code> and
    <code>biomorphs/third_party/monochrome_pascal/</code>; this file is a
    build artefact regenerated by <code>build-standalone.mjs</code>.
  </p>
</header>

<main>
  <div class="breeder" id="breeder" aria-label="Biomorph breeder grid"></div>

  <div class="controls">
    <button id="btn-rebreed">Rebreed</button>
    <button id="btn-chess">Chess</button>
    <button id="btn-tree">BasicTree</button>
    <button id="btn-insect">Insect</button>
    <button id="btn-monster">Hopeful Monster</button>
  </div>

  <div class="stats" id="stats"></div>

  <details class="gp">
    <summary>Parent genome</summary>
    <pre class="gp" id="genome"></pre>
  </details>

  <div class="status" id="status">Bootstrapping…</div>
</main>

<footer>
  Self-contained build · canonical sources at
  <a href="https://github.com/danbri/glitchcan-minigam/tree/master/biomorphs">github.com/danbri/glitchcan-minigam/biomorphs</a>.
</footer>

<!-- Pascal source bundled inline so this page is fully self-contained. -->
<script id="pascal-globals" type="text/x-pascal-src">${escapePascalForScriptTag(globalsSrc)}</script>
<script id="pascal-biomorphs" type="text/x-pascal-src">${escapePascalForScriptTag(biomorphsSrc)}</script>

<script>
${inlinedInterp}
</script>

<script>
(function() {
  const { parse, makeInterpreter, defaultHost } = window.Pascalite;

  const breederEl = document.getElementById('breeder');
  const statsEl   = document.getElementById('stats');
  const genomeEl  = document.getElementById('genome');
  const statusEl  = document.getElementById('status');

  let interp = null;
  let parentName = 'topan';

  function bootInterpreter() {
    const t0 = performance.now();
    const globalsSrc   = document.getElementById('pascal-globals').textContent;
    const biomorphsSrc = document.getElementById('pascal-biomorphs').textContent;
    const i = makeInterpreter(defaultHost(null));
    i.load(parse(globalsSrc, 'Globals'));
    i.load(parse(biomorphsSrc, 'Biomorphs'));
    i.global.get('mypensize').ref.value = 1;
    i.invoke('basictree', [{ kind:'ident', name:'topan'   }], i.global);
    i.invoke('insect',    [{ kind:'ident', name:'leftan'  }], i.global);
    i.invoke('chess',     [{ kind:'ident', name:'rightan' }], i.global);
    statusEl.textContent =
      'Pascal interpreter loaded ' + Math.round(performance.now() - t0) + 'ms · ' +
      (globalsSrc.length + biomorphsSrc.length).toLocaleString() + ' bytes of Pascal · ' +
      Object.keys(i.procs).length + ' procedures registered';
    return i;
  }

  // Centre cell is the parent; the other 8 are random siblings produced by
  // Dawkins' own Reproduce procedure (from the loaded Pascal source).
  function buildCells() {
    breederEl.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const isParent = (i === 4);
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (isParent) { cell.classList.add('parent'); cell.setAttribute('aria-label','Parent'); }
      else { cell.setAttribute('role','button'); cell.setAttribute('tabindex','0'); }
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 320;
      cell.appendChild(canvas);
      breederEl.appendChild(cell);
    }
  }

  function reproduceInto(parentName, childName) {
    interp.invoke('reproduce',
      [{kind:'ident', name:parentName}, {kind:'ident', name:childName}],
      interp.global);
  }

  function enableAllMutations() {
    const mut = interp.global.get('mut').ref.value;
    for (let k = 1; k <= 9; k++) mut.items[k - mut.lo] = true;
    for (const name of ['topan', 'leftan', 'rightan']) {
      interp.global.get(name).ref.value.mutprobgene = 50;
    }
  }

  function copyPerson(srcName, dstName) {
    const src = interp.global.get(srcName).ref.value;
    const dst = interp.global.get(dstName).ref.value;
    for (const k of Object.keys(src)) {
      const v = src[k];
      if (v && v.__isArray) dst[k] = { __isArray:true, lo:v.lo, hi:v.hi, items:v.items.slice() };
      else if (v && typeof v === 'object') dst[k] = JSON.parse(JSON.stringify(v));
      else dst[k] = v;
    }
  }

  function hopefulMonster(name) {
    const p = interp.global.get(name).ref.value;
    const g = p.gene.items;
    for (let i = 0; i < 8; i++) g[i] = Math.floor(Math.random() * 26) - 13;
    g[8] = 3 + Math.floor(Math.random() * 6);
    const dg = p.dgene.items;
    for (let i = 0; i < 10; i++) dg[i] = Math.floor(Math.random() * 3);
    p.segnogene = 1 + Math.floor(Math.random() * 5);
    p.segdistgene = 60 + Math.floor(Math.random() * 120);
  }

  function newHost(ctx) {
    const margin = { left:0, right:0, top:0, bottom:0 };
    const host = defaultHost(ctx, { margin });
    host.margin = margin;
    return host;
  }

  function runDevelop(personName, host, cx, cy) {
    interp.procs['picline']  = { kind:'native', fn:(...a) => host.picline(...a) };
    interp.procs['randint']  = { kind:'native', fn:(n) => host.randint(n) };
    interp.procs['randswell']= { kind:'native', fn:(s) => host.randswell(s) };
    const margin = interp.global.get('margin').ref.value;
    margin.left = cx; margin.right = cx; margin.top = cy; margin.bottom = cy;
    host.margin.left = cx; host.margin.right = cx;
    host.margin.top  = cy; host.margin.bottom = cy;
    interp.global.define('__here', {
      type:{kind:'named',name:'point'},
      ref:{ value:{ v:cy, h:cx } },
    });
    interp.invoke('develop',
      [{kind:'ident', name:personName}, {kind:'ident', name:'__here'}],
      interp.global);
  }

  function renderToCanvas(srcName, canvas) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const measure = newHost(null);
    runDevelop(srcName, measure, canvas.width/2, canvas.height/2);
    const m = measure.margin;
    const w = Math.max(1, m.right - m.left);
    const h = Math.max(1, m.bottom - m.top);
    const pad = 12;
    const scale = Math.min(
      (canvas.width  - pad*2) / w,
      (canvas.height - pad*2) / h,
      3,
    );
    const fcx = (m.left + m.right)/2;
    const fcy = (m.top  + m.bottom)/2;
    ctx.save();
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.scale(scale, scale);
    ctx.translate(-fcx, -fcy);
    const draw = newHost(ctx);
    runDevelop(srcName, draw, fcx, fcy);
    ctx.restore();
    return draw.getSegs().length;
  }

  function readPerson(name) {
    const p = interp.global.get(name).ref.value;
    const genes = (p.gene && p.gene.items) ? p.gene.items.slice() : [];
    const dgene = (p.dgene && p.dgene.items) ? p.dgene.items.slice() : [];
    return { gene:genes, dgene, segNoGene:p.segnogene, segDistGene:p.segdistgene,
             completeness:p.completenessgene, spokes:p.spokesgene,
             trickle:p.tricklegene, mutSize:p.mutsizegene, mutProb:p.mutprobgene };
  }

  function paintParentMeta() {
    const p = readPerson(parentName);
    genomeEl.textContent = JSON.stringify(p, null, 2);
    statsEl.innerHTML = [
      ['parent', parentName],
      ['classic', p.gene.slice(0, 8).join(', ')],
      ['depth (g9)', String(p.gene[8])],
      ['segs', p.segNoGene + ' x ' + p.segDistGene],
    ].map(([k, v]) =>
      '<div class="stat"><div class="k">' + k + '</div><div>' + v + '</div></div>'
    ).join('');
  }

  function ensureScratchPersons() {
    for (let i = 0; i < 9; i++) {
      if (i === 4) continue;
      const name = '__c' + i;
      if (!interp.global.has(name)) {
        interp.global.define(name, {
          type:{kind:'named',name:'person'},
          ref:{ value: JSON.parse(JSON.stringify(interp.global.get('topan').ref.value)) },
        });
      }
    }
  }

  function rebreed() {
    const cells = breederEl.querySelectorAll('.cell');
    let total = 0;
    cells.forEach((cell, i) => {
      const isParent = (i === 4);
      const childName = isParent ? parentName : ('__c' + i);
      if (!isParent) reproduceInto(parentName, childName);
      total += renderToCanvas(childName, cell.querySelector('canvas'));
      cell._personName = childName;
    });
    paintParentMeta();
    statusEl.textContent = 'Pascal Reproduce() spawned 8 siblings · Develop() drew ' +
      total + ' lines';
  }

  breederEl.addEventListener('click', (ev) => {
    const cell = ev.target.closest('.cell');
    if (!cell || cell.classList.contains('parent')) return;
    ev.stopPropagation();
    copyPerson(cell._personName, parentName);
    rebreed();
  });
  breederEl.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const cell = ev.target.closest('.cell');
    if (!cell || cell.classList.contains('parent')) return;
    ev.preventDefault(); ev.stopPropagation();
    copyPerson(cell._personName, parentName);
    rebreed();
  });
  document.getElementById('btn-rebreed').addEventListener('click', rebreed);
  for (const [id, proc] of [['btn-chess','chess'], ['btn-tree','basictree'], ['btn-insect','insect']]) {
    document.getElementById(id).addEventListener('click', () => {
      interp.invoke(proc, [{kind:'ident', name:parentName}], interp.global);
      rebreed();
    });
  }
  document.getElementById('btn-monster').addEventListener('click', () => {
    hopefulMonster(parentName); rebreed();
  });

  // Boot
  buildCells();
  try {
    interp = bootInterpreter();
    ensureScratchPersons();
    enableAllMutations();
    rebreed();
  } catch (e) {
    statusEl.textContent = 'Pascal-lite bootstrap failed: ' + e.message;
    throw e;
  }
})();
</script>

</body>
</html>
`;

const out = new URL('pascalite-standalone.html', root);
writeFileSync(out, html);
console.log('Wrote', out.pathname, '(' + html.length.toLocaleString() + ' bytes)');
