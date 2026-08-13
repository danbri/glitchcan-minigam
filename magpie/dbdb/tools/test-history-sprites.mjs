/* test-history-sprites.mjs — RUN THE PAST, IN THE GUEST ORIGIN.
 *
 * Field reports said "white cards", then "invisible sprites". Two
 * explanations were shipped for them and BOTH were wrong (texture
 * memory; CORS taint), because each was reasoned from a screenshot
 * instead of reproduced. This harness serves the exact splatpack.html
 * from the commits the phone was running — `git show <sha>:path` — into
 * a sandbox="allow-scripts" frame, and measures the near-white
 * fraction plus the sprite chain in each.
 *
 * Result on this machine (Chromium/SwiftShader): all three builds
 * render correctly. That is the finding — the fault is device-side,
 * so the answer has to come from the field HUD's `spr` line, not from
 * another theory here.
 *
 * Usage: node magpie/dbdb/tools/test-history-sprites.mjs
 */
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.ply':'application/octet-stream'};
const SHAS={ white:'0880459', invisible:'2cbf7d3', now:'HEAD' };
const srv=http.createServer((req,res)=>{ const u=decodeURIComponent(req.url.split('?')[0]);
  const m=u.match(/^\/h\/([a-z]+)\/(.*)$/);
  if(u.startsWith('/host/')){ const tag=u.split('/')[2];
    res.writeHead(200,{'Content-Type':'text/html'});
    res.end(`<!doctype html><meta charset=utf-8><style>html,body{margin:0;height:100%}iframe{width:100%;height:100%;border:0}</style>
      <iframe sandbox="allow-scripts" src="/h/${tag}/splatpack.html?lay=maze&play=1&pack=lite"></iframe>`); return; }
  if(m){ const [,tag,rel]=m;
    if(rel==='splatpack.html'){
      let src;
      try{ src=execFileSync('git',['show',`${SHAS[tag]}:magpie/dbdb/splatpack.html`],{cwd:ROOT,maxBuffer:1e8}); }
      catch(e){ res.writeHead(500); res.end('no such rev'); return; }
      res.writeHead(200,{'Content-Type':'text/html'}); res.end(src); return; }
    const p=path.join(ROOT,'magpie/dbdb',rel);
    fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream','Access-Control-Allow-Origin':'*'});res.end(d);});
    return; }
  const p=path.join(ROOT,u);
  fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream','Access-Control-Allow-Origin':'*'});res.end(d);});});
await new Promise(r=>srv.listen(9022,r));
const b=await chromium.launch({headless:true,executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const SP=(process.env.SHOTS_DIR||'/tmp')+'/';
for(const tag of ['white','invisible','now']){
  const pg=await b.newPage({viewport:{width:390,height:740}});
  const errs=[]; pg.on('console',m=>{ if(m.type()==='error') errs.push(m.text().slice(0,90)); });
  await pg.goto('http://localhost:9022/host/'+tag);
  let f=null;
  for(let i=0;i<45;i++){ await pg.waitForTimeout(2000);
    f=pg.frames().find(x=>/splatpack/.test(x.url()));
    if(f){ try{ if(await f.evaluate(()=>window.__pack&&window.__pack.ready)) break; }catch(e){} } }
  await pg.waitForTimeout(9000);
  const shot=await pg.screenshot();
  await fs.promises.writeFile(SP+'hist-'+tag+'.png', shot);
  const px=await pg.evaluate(async b64=>{ const img=new Image(); img.src='data:image/png;base64,'+b64;
    await new Promise(r=>{img.onload=r;});
    const c=document.createElement('canvas'); c.width=img.width; c.height=img.height;
    const g=c.getContext('2d'); g.drawImage(img,0,0);
    const d=g.getImageData(0,Math.round(img.height*0.25),img.width,Math.round(img.height*0.5)).data;
    let wh=0,n=0; for(let i=0;i<d.length;i+=4){ n++;
      if(d[i]>235&&d[i+1]>235&&d[i+2]>235) wh++; }
    return +(100*wh/n).toFixed(2); }, shot.toString('base64'));
  let state=null;
  try{ state=await f.evaluate(()=>({ spr:(__pack.sprites||null), vis:__pack.play.visual })); }catch(e){}
  console.log(tag.toUpperCase().padEnd(10), 'near-white in middle band:', String(px)+'%',
    ' sprites:', JSON.stringify(state));
  if(errs.length) console.log('           errors:', errs.slice(0,2));
  await pg.close();
}
await b.close(); srv.close();
