/* test-npc-routes.mjs — WALKERS MUST NOT STAND IN WALLS.
 *
 * npcStep probes a single POINT at the walker's centre, so a route that
 * merely misses geometry still buries half a body in it. That is the
 * field report — "the NPC who comes down stairs sometimes walks half
 * into a block" — and reasoning about it was useless: the routes had to
 * be watched, frame by frame, with a body-sized footprint.
 *
 * This runs seven simulated minutes of the district's whole population
 * and flags every distinct place where a 0.6-wide walker overlaps a
 * solid cell at foot or head height.
 *
 * Two overlaps are EXPECTED and exempt:
 *   · the bar furniture (counter, tables) — leaning on the bar is what
 *     the bar is for, and the pose is authored to look like it
 *   · a stair tread while descending it — a 0.6-wide body on 1.0-deep
 *     treads always trails over the step above, and it is behind them
 *
 * Anything else is a route drawn through the scenery. Fix the ROUTE.
 *
 * Usage: node magpie/dbdb/tools/test-npc-routes.mjs
 */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png'};
const srv=http.createServer((q,r)=>{ const u=decodeURIComponent(q.url.split('?')[0]);
  fs.readFile(path.join(ROOT,u),(e,d)=>{ if(e){r.writeHead(404);r.end();return;}
    r.writeHead(200,{'Content-Type':MIME[path.extname(u)]||'application/octet-stream',
      'Access-Control-Allow-Origin':'*'});r.end(d);});});
await new Promise(r=>srv.listen(9039,r));

const b=await chromium.launch({headless:true,executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const pg=await b.newPage({viewport:{width:390,height:740}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,140)));
await pg.goto('http://localhost:9039/magpie/dbdb/dbdb2.html');
await pg.waitForFunction(()=>window.__jsd&&!document.getElementById('startBtn').disabled,
  null,{timeout:90000});
await pg.click('#startBtn'); await pg.waitForTimeout(1200);

const out=await pg.evaluate(()=>{
  const R=0.3, seen=new Map(), solid=window.__jsd.__cellSolid;
  /* the pub fittings people lean on, by cell */
  const FURNITURE=new Set();
  for(let x=-31;x<=-22;x++) FURNITURE.add(x+',1,5');          // the counter
  for(const c of ['-29,1,9','-24,1,9','-32,1,10']) FURNITURE.add(c);
  /* the staircase columns: trailing over the step above is normal */
  const STAIR=new Set();
  for(let x=-9;x<=-5;x++) for(let y=1;y<=5;y++) for(let z=0;z<=2;z++)
    STAIR.add(x+','+y+','+z);
  /* SEVEN minutes, not three. A delivery is a long errand — unload,
     walk, browse, walk, hand over — and only a third of shop runs
     become one, so a three-minute soak scored zero often enough to be
     a flaky test rather than a failing game. */
  let ts=0, trades=0, spoke=0, delivering=0;
  for(let i=0;i<420*30;i++){
    ts+=1/30; window.__jsd.__stepNPCs(1/30, ts);
    if(window.__jsd.speech>0) spoke++;
    if(window.__jsd.__npcs.some(n=>n.mode==='deliver')) delivering++;
    if(i%3) continue;
    for(const n of window.__jsd.__npcs){
      if(!n.r.g.visible) continue;
      /* on the staircase at ALL, including the last step down to the
         parade: a 0.6-wide body on 1.0-deep treads always trails over
         the step above, and that step is behind them */
      const onStair=n.x>-10.5 && n.x<-3 && n.z>-0.5 && n.z<3.5;
      for(const [ox,oz] of [[R,R],[R,-R],[-R,R],[-R,-R]])
        for(const dy of [0.01,1.1]){
          const cx=Math.floor(n.x+ox), cy=Math.floor(n.y+dy), cz=Math.floor(n.z+oz);
          const cell=cx+','+cy+','+cz;
          if(!solid(cx,cy,cz)) continue;
          if(FURNITURE.has(cell)) continue;
          if(onStair && STAIR.has(cell)) continue;
          const k=cell+' ('+(dy<1?'foot':'head')+')';
          seen.set(k,(seen.get(k)||0)+1);
        }
    }
  }
  trades=window.__jsd.trades;
  return { sites:[...seen.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20),
           n:seen.size, trades, spoke, delivering };
});

let bad=0;
const T=(c,m)=>{ if(!c) bad++; console.log((c?'PASS':'FAIL')+' '+m); };
console.log('seven simulated minutes of the whole district');
console.log('   distinct overlap sites:', out.n);
for(const [k,c] of out.sites) console.log('     ', k, '×'+c);
T(out.n===0, 'no walker stands in a wall, a stair or a lamp post');
console.log('   deliveries completed:', out.trades,
  '· frames mid-handover:', out.delivering);
T(out.trades>0, 'the shop orders reach the Newt (a trade completed)');
console.log('   frames with someone talking:', out.spoke);
T(out.spoke>0, 'the district speaks (bubbles appear)');
T(errs.length===0, 'no page errors '+JSON.stringify(errs.slice(0,2)));

await b.close(); srv.close();
console.log(bad?('\n'+bad+' FAILED'):'\nNPC ROUTES OK');
process.exit(bad?1:0);
