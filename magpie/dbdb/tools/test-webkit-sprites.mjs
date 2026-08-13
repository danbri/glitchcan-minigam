/* test-webkit-sprites.mjs — THE ENGINE THE OWNER'S PHONE ACTUALLY USES.
 *
 * Every browser on iOS is WebKit, whatever its badge says. This harness
 * exists because Chromium — in every configuration, at the top level and
 * in an opaque guest frame, on every historical build of the page —
 * rendered the sprites correctly while the phone showed white cards and
 * then an invisible player. Only WebKit reproduced it:
 *
 *     assetLoaded:true  assetW:0  heroTextured:false  heroShown:false
 *     err:"The operation is insecure."
 *
 * which is the phone's own HUD line, character for character.
 *
 * The cause is the opaque origin. A guest in sandbox="allow-scripts"
 * treats its OWN files as cross-origin, so an <img> fetched without CORS
 * is tainted, and WebKit refuses the texImage2D. Measured in this frame:
 *
 *     plain <img>                 -> THREW SecurityError
 *     <img crossOrigin=anonymous> -> UPLOAD OK
 *     fetch -> createImageBitmap  -> UPLOAD OK
 *
 * splatpack.html therefore loads its atlases itself, by fetch.
 *
 * The cache is primed with plain non-CORS images first, because days of
 * play leave exactly those entries behind and a stale non-CORS copy is
 * the second way this fails.
 *
 * NOTE: `npx playwright install webkit` fetched build 2215 while the
 * library expects 2227, so the executable is named explicitly.
 *
 * Usage: node magpie/dbdb/tools/test-webkit-sprites.mjs
 */
import { webkit } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import os from 'os';
import { fileURLToPath } from 'url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const WK='/opt/pw-browsers/webkit-2215/pw_run.sh';
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.ply':'application/octet-stream'};
const srv=http.createServer((req,res)=>{ const u=decodeURIComponent(req.url.split('?')[0]);
  if(u==='/prime'){ res.writeHead(200,{'Content-Type':'text/html'});
    res.end(`<!doctype html><meta charset=utf-8>
      <img src="/magpie/dbdb/sprites/lite/hero.png"><img src="/magpie/dbdb/sprites/lite/walker1.png">primed`); return; }
  if(u==='/host'){ res.writeHead(200,{'Content-Type':'text/html'});
    res.end(`<!doctype html><meta charset=utf-8><style>html,body{margin:0;height:100%}iframe{width:100%;height:100%;border:0}</style>
      <iframe sandbox="allow-scripts" src="/magpie/dbdb/splatpack.html?lay=maze&play=1&pack=lite"></iframe>`); return; }
  const p=path.join(ROOT,u);
  fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream',
      'Access-Control-Allow-Origin':'*','Cache-Control':'public, max-age=600'});res.end(d);});});
await new Promise(r=>srv.listen(9025,r));

if(!fs.existsSync(WK)){
  console.log('SKIP no WebKit at '+WK+' — run: npx playwright install webkit');
  srv.close(); process.exit(0);
}
let bad=0;
const T=(c,m)=>{ if(!c) bad++; console.log((c?'PASS':'FAIL')+' '+m); };
const UD=fs.mkdtempSync(path.join(os.tmpdir(),'wk-spr-'));
const ctx=await webkit.launchPersistentContext(UD,{ headless:true,
  viewport:{width:390,height:740}, executablePath:WK });

/* 1. prime the cache the way days of play would: plain, non-CORS <img> */
const p1=await ctx.newPage(); await p1.goto('http://localhost:9025/prime');
await p1.waitForTimeout(2500); await p1.close();
console.log('cache primed (non-CORS images), engine: WebKit');

/* 2. now the game, in a sandboxed guest frame */
const pg=await ctx.newPage();
const fails=[]; pg.on('requestfailed',r=>fails.push(r.url().split('/').pop().slice(0,40)+' :: '+(r.failure()?.errorText||'')));
const errs=[]; pg.on('console',m=>{ if(m.type()==='error') errs.push(m.text().slice(0,110)); });
await pg.goto('http://localhost:9025/host');
let f=null;
for(let i=0;i<45;i++){ await pg.waitForTimeout(2000);
  f=pg.frames().find(x=>/splatpack/.test(x.url()));
  if(f){ try{ if(await f.evaluate(()=>window.__pack&&window.__pack.ready)) break; }catch(e){} } }
T(!!f,'splatpack boots under WebKit in a guest frame');
if(f){
  await pg.waitForTimeout(9000);
  const s=await f.evaluate(()=>window.__pack.sprites);
  console.log('  sprite chain:', JSON.stringify(s));
  T(s.assetW>0,'the atlas became a texture (a:'+s.assetW+')');
  T(s.heroTextured,'the material holds the map');
  T(s.heroShown,'the hero is drawn');
}
console.log('  failed requests:', fails.length?fails.slice(0,4):['none']);
console.log('  console errors:', errs.length?errs.slice(0,3):['none']);
await ctx.close(); srv.close();
fs.rmSync(UD,{recursive:true,force:true});
process.exit(bad?1:0);
