/* test-ride-home.mjs — THE WAY OUT OF THE SCENE.
 *
 * Until now the only exit from Skydock Scuttlebutt was the host's own
 * chrome: the story could not be returned to from inside the world.
 * The car rank is that exit — the same rank the shoppers have used all
 * shift — and it has to work in BOTH of the game's lives:
 *
 *   standalone  → the car takes you up and puts you back on the title
 *                 card you came in from
 *   as a guest  → the car takes you up and posts `complete`, which is
 *                 what returns the reader to the FINK story
 *
 * Both are asserted here, including that the kerb is solid ground (a
 * rank the player falls through is not a rank) and that the world is
 * left fit to play again afterwards.
 *
 * Usage: node magpie/dbdb/tools/test-ride-home.mjs
 */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.ply':'application/octet-stream'};
const srv=http.createServer((req,res)=>{ const u=decodeURIComponent(req.url.split('?')[0]);
  /* a HOST that speaks just enough of the minigame SDK to see `complete` */
  if(u==='/host'){ res.writeHead(200,{'Content-Type':'text/html'});
    res.end(`<!doctype html><meta charset=utf-8><title>host</title>
      <style>html,body{margin:0;height:100%}iframe{width:100%;height:100%;border:0}</style>
      <iframe id=f sandbox="allow-scripts" src="/magpie/dbdb/dbdb2.html"></iframe>
      <script>
        window.__done=null;
        addEventListener('message', e=>{
          const d=e.data||{};
          if(d.type==='ready') document.getElementById('f').contentWindow
            .postMessage({ type:'init', config:{ story:{ recent:['a line of scuttlebutt'] } } }, '*');
          if(d.type==='complete') window.__done=d.result;
        });
      <\/script>`); return; }
  const p=path.join(ROOT,u);
  fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream',
      'Access-Control-Allow-Origin':'*'});res.end(d);});});
await new Promise(r=>srv.listen(9031,r));

let bad=0;
const T=(c,m)=>{ if(!c) bad++; console.log((c?'PASS':'FAIL')+' '+m); };
const b=await chromium.launch({headless:true,executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});

/* ─────────── 1. STANDALONE: the car returns you to the title ─────────── */
{
  const pg=await b.newPage({viewport:{width:390,height:740}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,120)));
  await pg.goto('http://localhost:9031/magpie/dbdb/dbdb2.html');
  await pg.waitForFunction(()=>window.__jsd&&!document.getElementById('startBtn').disabled,
    null,{timeout:90000});
  await pg.click('#startBtn');
  await pg.waitForTimeout(2500);

  /* the kerb must be SOLID: drop the hero on it and let it settle */
  await pg.evaluate(()=>window.__jsd.toRank());
  await pg.waitForTimeout(1800);
  const at=await pg.evaluate(()=>({ ...window.__jsd.rank, py:window.__jsd.player.y }));
  console.log('   at the rank:', JSON.stringify(at));
  T(Math.abs(at.py-at.y)<0.9, 'the kerb is solid ground (y '+at.py.toFixed(2)+' vs rank '+at.y+')');

  /* THE REAL CONTROL IS A JUMP, so press the key a player presses —
     a hook that bypasses physics() would prove nothing about the kerb */
  await pg.waitForTimeout(2600);              // outlast any toast holding the line
  const kerb=await pg.evaluate(()=>document.getElementById('toast').textContent);
  console.log('   kerb prompt:', JSON.stringify(kerb));
  T(/CLOCK OFF/.test(kerb),'STANDALONE the kerb offers to clock you off');
  await pg.keyboard.press('Space');
  await pg.waitForTimeout(1200);
  T((await pg.evaluate(()=>window.__jsd.rank.state))!=='off','a JUMP at the kerb hails the car');
  await pg.waitForTimeout(7000);
  const after=await pg.evaluate(()=>({
    title:!document.getElementById('title').classList.contains('hidden'),
    state:window.__jsd.rank.state,
    fade:document.getElementById('skyfade').classList.contains('on') }));
  console.log('   after the ride:', JSON.stringify(after));
  T(after.title,'STANDALONE the ride puts you back on the title card');
  T(after.state==='off','the ride resets, so a second shift can ride again');
  T(!after.fade,'the sky fade lifts');
  T(errs.length===0,'no page errors '+JSON.stringify(errs.slice(0,2)));
  await pg.close();
}

/* ─────────── 2. AS A GUEST: the car posts `complete` ─────────── */
{
  const pg=await b.newPage({viewport:{width:390,height:740}});
  await pg.goto('http://localhost:9031/host');
  let f=null;
  for(let i=0;i<45;i++){ await pg.waitForTimeout(2000);
    f=pg.frames().find(x=>/dbdb2/.test(x.url()));
    if(f){ try{ if(await f.evaluate(()=>window.__jsd&&!document.getElementById('startBtn').disabled)) break; }catch(e){} } }
  T(!!f,'the game boots as a guest');
  /* the init handshake is asynchronous on BOTH sides, so wait for it
     rather than sampling once and calling the race a failure */
  let host=null;
  for(let i=0;i<20;i++){ host=await f.evaluate(()=>window.__jsd.fink);
    if(host.host) break; await pg.waitForTimeout(500); }
  console.log('   fink guest:', JSON.stringify(host));
  T(host.host===true,'it knows it has a host');
  T(host.planes>0,'the story thread reaches the in-world terminals');

  await f.click('#startBtn');
  await f.waitForTimeout(2500);
  /* the kerb prompt must say the RIGHT thing to a reader in a story */
  await f.evaluate(()=>window.__jsd.toRank());
  await f.waitForTimeout(1500);
  const toast=await f.evaluate(()=>document.getElementById('toast').textContent);
  console.log('   kerb prompt:', JSON.stringify(toast));
  T(/RIDE BACK UP/.test(toast),'the kerb prompt points back at the story');

  await f.evaluate(()=>window.__jsd.rideOut());
  await pg.waitForTimeout(8000);
  const done=await pg.evaluate(()=>window.__done);
  console.log('   complete:', JSON.stringify(done));
  T(!!done,'GUEST the ride posts `complete` to the host');
  T(done && done.success===true,'it completes as a success');
  T(done && done.variables && 'skydock_diamonds' in done.variables,
    'it hands the story its variables');
  await pg.close();
}

await b.close(); srv.close();
console.log(bad?('\n'+bad+' FAILED'):'\nRIDE HOME OK');
process.exit(bad?1:0);
