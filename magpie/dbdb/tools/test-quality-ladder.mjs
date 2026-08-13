/* test-quality-ladder.mjs — WHAT THE SCENE COSTS, AT EVERY RUNG.
 *
 * This machine renders through SwiftShader: a CPU pretending to be a
 * GPU. Its frame times are worthless and have misled this project
 * before. So this tool measures nothing about frame RATE. It reads
 * three numbers that are facts about the work rather than opinions
 * about the renderer — two of them the engine's own:
 *
 *     app.stats.frame.gsplats   splats the engine DREW this frame
 *     scene 'gsplat:sorted'     what the sort worker actually cost
 *     canvas width x height     pixels
 *
 * The sort runs on a CPU worker on every machine, so its time is
 * comparable in kind (not in magnitude) with the owner's laptop.
 *
 * Run at a Retina laptop's geometry, because that is the reported
 * device and dpr is where the early rungs do their work.
 *
 * Usage: node magpie/dbdb/tools/test-quality-ladder.mjs
 */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.ply':'application/octet-stream'};
const srv=http.createServer((q,r)=>{ const u=decodeURIComponent(q.url.split('?')[0]);
  fs.readFile(path.join(ROOT,u),(e,d)=>{ if(e){r.writeHead(404);r.end();return;}
    r.writeHead(200,{'Content-Type':MIME[path.extname(u)]||'application/octet-stream',
      'Access-Control-Allow-Origin':'*'});r.end(d);});});
await new Promise(r=>srv.listen(9049,r));

let bad=0;
const T=(c,m)=>{ if(!c) bad++; console.log((c?'PASS':'FAIL')+' '+m); };
const b=await chromium.launch({headless:true,executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});

async function rungs(lay, pack){
  const rows=[];
  for(const q of [0,1,2,3,4]){
    const pg=await b.newPage({viewport:{width:1440,height:900}, deviceScaleFactor:2});
    const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,120)));
    await pg.goto(`http://localhost:9049/magpie/dbdb/splatpack.html`
      +`?lay=${lay}&play=1&q=${q}`+(pack==='lod'?'':`&pack=${pack}`));
    await pg.waitForFunction(()=>window.__pack&&window.__pack.ready,null,{timeout:120000});
    await pg.waitForTimeout(4000);
    /* A STILL CAMERA, or the rungs are not comparable: LOD is chosen by
       distance and the idle orbit moves it. Then settle — the LOD
       system has a ~100-tick cooldown and this renderer is slow. */
    await pg.evaluate(()=>window.__pack.freezeCam());
    /* The LOD system converges over ~100 ticks. That is a couple of
       seconds on a real GPU and over a minute through SwiftShader, so
       this wait is about THIS renderer, not about the game. */
    await pg.waitForTimeout(70000);
    const r=await pg.evaluate(()=>({ s:window.__pack.splats, p:window.__pack.perf,
      g:window.__pack.gsplat,
      cv:[document.querySelector('canvas').width, document.querySelector('canvas').height] }));
    rows.push({ q, splats:r.s.total, stamps:r.s.stamps, dpr:r.p.dprCap, lod:r.s.lod,
                drawn:(r.g&&r.g.drawn)||0, sortMs:(r.g&&r.g.sortMs)||0,
                px:r.cv[0]*r.cv[1], errs });
    await pg.close();
  }
  return rows;
}

for(const [lay,pack] of [['jungle','lod'],['maze','lod']]){
  console.log(`\n--- ${lay} · ${pack} pack · 1440x900 at dpr 2 (a Retina laptop) ---`);
  const rows=await rungs(lay,pack);
  for(const r of rows)
    console.log(`  q${r.q}  drew ${(r.drawn/1e6).toFixed(2)}M of ${(r.splats/1e6).toFixed(2)}M`
      +` · sort ${r.sortMs.toFixed(0)}ms · dpr ${r.dpr} · ${(r.px/1e6).toFixed(2)}M pixels`
      +(r.errs.length?('  ERR '+r.errs[0]):''));
  const a=rows[0], z=rows[4];
  const cutD=1-z.drawn/a.drawn, cutP=1-z.px/a.px;
  console.log(`  worst rung draws ${(cutD*100)|0}% fewer splats and ${(cutP*100)|0}% fewer pixels`);
  T(rows.every(r=>!r.errs.length), `${lay}/${pack}: every rung renders without error`);
  T(rows.every(r=>r.drawn>0), `${lay}/${pack}: the engine reports what it drew`);
  /* THE POINT OF THE LOD PACK: at full quality, with no budget at all,
     the engine must already be drawing far less than the scene holds.
     If this fails the assets have lost their octree and every knob
     below is inert again. */
  T(a.drawn < a.splats*0.75,
    `${lay}/${pack}: LOD is live at full quality (${(a.drawn/1e6).toFixed(2)}M of ${(a.splats/1e6).toFixed(2)}M)`);
  T(cutD>0.5, `${lay}/${pack}: the ladder halves the drawn splats or better`);
  T(cutP>0.5, `${lay}/${pack}: the ladder removes most of the pixels`);
  /* every rung must actually move: a ladder whose lower steps land on
     each other is a ladder with nowhere to go */
  T(rows.every((r,i)=>i===0||r.drawn<rows[i-1].drawn*0.95),
    `${lay}/${pack}: every rung draws meaningfully less than the last`);
}

await b.close(); srv.close();
console.log(bad?('\n'+bad+' FAILED'):'\nQUALITY LADDER OK');
process.exit(bad?1:0);
