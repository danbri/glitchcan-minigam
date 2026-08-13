/* test-quality-ladder.mjs — WHAT THE SCENE COSTS, AT EVERY RUNG.
 *
 * This machine renders through SwiftShader: a CPU pretending to be a
 * GPU. Its frame times are worthless and have misled this project
 * before. So this tool measures nothing about SPEED. It measures the
 * two things that are facts about the scene rather than the renderer:
 *
 *     how many Gaussians are asked for, and how many pixels
 *
 * Those two numbers multiplied are what a splat renderer actually
 * spends, and they are the same on any machine. A field report of
 * "5-12 fps on a MacBook Air" cannot be reproduced here, but the
 * WORKLOAD behind it can be, and it can be shown to come down.
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
      +`?lay=${lay}&play=1&pack=${pack}&q=${q}`);
    await pg.waitForFunction(()=>window.__pack&&window.__pack.ready,null,{timeout:120000});
    await pg.waitForTimeout(4000);
    const r=await pg.evaluate(()=>({ s:window.__pack.splats, p:window.__pack.perf,
      cv:[document.querySelector('canvas').width, document.querySelector('canvas').height] }));
    rows.push({ q, splats:r.s.total, stamps:r.s.stamps, dpr:r.p.dprCap,
                px:r.cv[0]*r.cv[1], errs });
    await pg.close();
  }
  return rows;
}

for(const [lay,pack] of [['jungle','full'],['maze','full'],['jungle','lite']]){
  console.log(`\n--- ${lay} · ${pack} pack · 1440x900 at dpr 2 (a Retina laptop) ---`);
  const rows=await rungs(lay,pack);
  for(const r of rows)
    console.log(`  q${r.q}  ${(r.splats/1e6).toFixed(2)}M splats · ${String(r.stamps).padStart(3)} stamps`
      +` · dpr ${r.dpr} · ${(r.px/1e6).toFixed(2)}M pixels`
      +(r.errs.length?('  ERR '+r.errs[0]):''));
  const a=rows[0], z=rows[4];
  const cutS=1-z.splats/a.splats, cutP=1-z.px/a.px;
  console.log(`  worst rung cuts ${(cutS*100)|0}% of the splats and ${(cutP*100)|0}% of the pixels`);
  T(rows.every(r=>!r.errs.length), `${lay}/${pack}: every rung renders without error`);
  T(cutS>0.5, `${lay}/${pack}: the ladder removes most of the Gaussians`);
  T(cutP>0.5, `${lay}/${pack}: the ladder removes most of the pixels`);
  /* the early rungs must be the INVISIBLE ones — resolution before
     content, or the picture degrades before it needs to */
  T(rows[1].splats===rows[0].splats && rows[1].px<rows[0].px,
    `${lay}/${pack}: rung 1 spends pixels, not scenery`);
}

await b.close(); srv.close();
console.log(bad?('\n'+bad+' FAILED'):'\nQUALITY LADDER OK');
process.exit(bad?1:0);
