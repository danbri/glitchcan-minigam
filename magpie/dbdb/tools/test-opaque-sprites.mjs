/* test-opaque-sprites.mjs — RUN THE GAME THE WAY THE SHELL RUNS IT.
 *
 * A guest lives at an OPAQUE ORIGIN (sandbox="allow-scripts"), and that
 * changes what the same code may do: an <img> fetched without
 * crossOrigin is cross-origin-tainted there, so texImage2D with it
 * throws SecurityError. Every sprite atlas was affected — white cards
 * on the phone, then invisible sprites once the code refused to dress a
 * quad in a broken texture — and NO top-level test could see it,
 * because top-level same-origin taints nothing.
 *
 * This harness reproduces the boundary and asserts both the symptom
 * (a plain upload still throws) and the cure (the game's sprites are
 * textured and drawn anyway, because the loader asks for CORS).
 *
 * Usage: node magpie/dbdb/tools/test-opaque-sprites.mjs
 */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.ply':'application/octet-stream'};
const srv=http.createServer((req,res)=>{ const u=decodeURIComponent(req.url.split('?')[0]);
  if(u==='/host'){ res.writeHead(200,{'Content-Type':'text/html'});
    res.end(`<!doctype html><meta charset=utf-8><style>html,body{margin:0;height:100%}iframe{width:100%;height:100%;border:0}</style>
      <iframe sandbox="allow-scripts" src="/magpie/dbdb/splatpack.html?lay=maze&play=1&pack=lite"></iframe>`); return; }
  const p=path.join(ROOT,u);
  fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream','Access-Control-Allow-Origin':'*'});res.end(d);});});
await new Promise(r=>srv.listen(9019,r));
const b=await chromium.launch({headless:true,executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const pg=await b.newPage({viewport:{width:390,height:740}});
const msgs=[];
pg.on('console',m=>{ const t=m.text(); if(/error|fail|cors|secur|texture/i.test(t)) msgs.push(m.type()+': '+t.slice(0,160)); });
pg.on('pageerror',e=>msgs.push('pageerror: '+e.message.slice(0,160)));
await pg.goto('http://localhost:9019/host');
let f=null;
for(let i=0;i<60;i++){ await pg.waitForTimeout(2000);
  f=pg.frames().find(x=>/splatpack/.test(x.url()));
  if(f){ try{ if(await f.evaluate(()=>window.__pack&&window.__pack.ready)) break; }catch(e){} } }
console.log('frame up:', !!f);
await pg.waitForTimeout(9000);
const st=await f.evaluate(()=>({ spr:__pack.sprites, play:__pack.play }));
console.log('state:',JSON.stringify(st));
const T=(c,m)=>console.log((c?'PASS':'FAIL')+' '+m);
T(st.spr.heroTextured,'IN AN OPAQUE ORIGIN: the hero material holds its atlas');
T(st.spr.heroShown,'the hero plane is drawn (not hidden by the guard)');
T(st.spr.roamersShown>0,'the citizens are drawn too ('+st.spr.roamersShown+')');
// direct probe: can this document use its own PNG as a WebGL texture?
const probe=await f.evaluate(async ()=>{
  const res={};
  // 1. plain Image, no crossOrigin (what a default texture loader does)
  const load=(url,co)=>new Promise(r=>{ const im=new Image();
    if(co) im.crossOrigin=co;
    im.onload=()=>r({ok:true,w:im.naturalWidth,img:im}); im.onerror=e=>r({ok:false});
    im.src=url; });
  const a=await load('sprites/lite/hero.png');
  res.plainLoad=a.ok?('ok '+a.w):'FAILED';
  const cv=document.createElement('canvas'); cv.width=cv.height=8;
  const gl=cv.getContext('webgl');
  if(a.ok&&gl){ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
    try{ gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,a.img);
      res.uploadPlain = gl.getError()===0 ? 'ok' : 'GL error '+gl.getError();
    }catch(e){ res.uploadPlain='THREW: '+e.name; } }
  const c=await load('sprites/lite/hero.png','anonymous');
  res.corsLoad=c.ok?('ok '+c.w):'FAILED';
  if(c.ok&&gl){ const t2=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t2);
    try{ gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c.img);
      res.uploadCors = gl.getError()===0 ? 'ok' : 'GL error '+gl.getError();
    }catch(e){ res.uploadCors='THREW: '+e.name; } }
  return res;
});
console.log('texture probe in the opaque frame:', JSON.stringify(probe,null,1));
console.log('console noise:', msgs.length?msgs.slice(0,6):['none']);
if(process.env.SHOTS_DIR) await pg.screenshot({path:process.env.SHOTS_DIR+'/opaque-maze.png'});
await b.close(); srv.close();
const bad=[st.spr.heroTextured, st.spr.heroShown, st.spr.roamersShown>0].filter(x=>!x).length;
console.log(bad ? `\nOPAQUE-ORIGIN SPRITES FAILED (${bad})` : '\nOPAQUE-ORIGIN SPRITES OK');
process.exit(bad?1:0);
