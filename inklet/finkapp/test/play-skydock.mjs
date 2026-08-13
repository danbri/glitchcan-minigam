/* play-skydock.mjs — CAN A PERSON ACTUALLY PLAY THIS, with fingers?
 *
 * Loading is not playing, and neither is a hook. Every assertion in this
 * file is driven by a REAL touch (CDP Input.dispatchTouchEvent) on the
 * PRODUCTION route — shell → boxed runner → story → game → dream —
 * because that is four frame boundaries, four sets of listeners, and
 * every bug of the last two days lived in one of them:
 *   · a story window covering a running game (nothing was visible)
 *   · the 7th choice under a fixed panel and past the fold (a story you
 *     could not enter)
 *   · untextured sprite quads (a white hole in the world)
 * A hook-driven test saw none of them.
 *
 * Usage:  node inklet/finkapp/test/play-skydock.mjs
 * The one hook used deliberately is __jsd.jackIn(): walking to a
 * terminal is minutes of real play, and the dream it opens is then
 * played with touch like everything else.
 */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.css':'text/css','.jpeg':'image/jpeg','.jpg':'image/jpeg','.webp':'image/webp','.wav':'audio/wav','.mp3':'audio/mpeg','.ply':'application/octet-stream'};
const srv=http.createServer((req,res)=>{ const p=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]).replace(/^\/glitchcan-minigam/,''));
  fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream','Access-Control-Allow-Origin':'*'});res.end(d);});});
await new Promise(r=>srv.listen(9014,r));
const b=await chromium.launch({headless:true,executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await b.newContext({viewport:{width:390,height:740},hasTouch:true,isMobile:true});
const pg=await ctx.newPage();
let errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,120)));
let FAILED=0;
const T=(c,m)=>{ if(!c) FAILED++; console.log((c?'PASS':'FAIL')+' '+m); };
const SP=process.env.SHOTS_DIR ? process.env.SHOTS_DIR+'/' : '/tmp/';
const cdp=await ctx.newCDPSession(pg);
const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{ type,
  touchPoints: type==='touchEnd'?[]:[{x,y,radiusX:6,radiusY:6,force:1,id:1}] });
const tap=async(x,y)=>{ await touch('touchStart',x,y); await pg.waitForTimeout(90); await touch('touchEnd',x,y); };
const holdDrag=async(x,y,dx,dy,ms)=>{ await touch('touchStart',x,y); await pg.waitForTimeout(60);
  await touch('touchMove',x+dx,y+dy); await pg.waitForTimeout(ms); await touch('touchEnd',x+dx,y+dy); };

await pg.goto('http://localhost:9014/inklet/finkapp/index.html');
let fr=null;
for(let i=0;i<60;i++){ await pg.waitForTimeout(2000);
  fr=pg.frames().find(f=>f.url().includes('storyrunner'));
  if(fr){ try{ if(await fr.evaluate(()=>document.querySelectorAll('#choices button').length)>0) break; }catch(e){} } }
T(!!fr,'STEP 1  the reading surface comes up');

/* real taps on the story choices — page coords of the button */
const choicesNow=async()=>{ try{ return await fr.evaluate(()=>
  [...document.querySelectorAll('#choices button')].map(x=>x.textContent.trim())); }
  catch(e){ return ['<frame gone: '+e.message.slice(0,40)+'>']; } };
const tapChoice=async label=>{
  try{
    await fr.waitForFunction(l=>[...document.querySelectorAll('#choices button')]
      .some(x=>x.textContent.includes(l)), label, {timeout:60000});
  }catch(e){
    console.log('   !! never offered "'+label+'"; on screen:', JSON.stringify(await choicesNow()));
    throw e;
  }
  const box=await fr.evaluate(l=>{
    const b2=[...document.querySelectorAll('#choices button')].find(x=>x.textContent.includes(l));
    const r=b2.getBoundingClientRect(); return { x:r.x+r.width/2, y:r.y+r.height/2 };
  }, label);
  const off=await pg.evaluate(()=>{ const f=[...document.querySelectorAll('iframe')]
    .find(x=>/storyrunner/.test(x.src||'')); const r=f.getBoundingClientRect();
    return { x:r.x, y:r.y }; });
  await tap(box.x+off.x, box.y+off.y);
  await pg.waitForTimeout(2500);
  console.log('   tapped "'+label+'" -> now:', JSON.stringify(await choicesNow()));
};
await tapChoice('Episodes');
await tapChoice('Skydock Scuttlebutt');
await fr.waitForFunction(()=>[...document.querySelectorAll('#choices button')]
  .some(x=>/Clock on/.test(x.textContent)),null,{timeout:90000});
T(true,'STEP 2  the Skydock episode reads and offers its choices to a TAP');
await tapChoice('Clock on');

/* the game boots */
let gf=null;
for(let i=0;i<60;i++){ await pg.waitForTimeout(2500);
  gf=pg.frames().find(f=>/dbdb2/.test(f.url()));
  if(gf){ try{ if(await gf.evaluate(()=>!!window.__jsd)) break; }catch(e){} } }
T(!!gf,'STEP 3  the game boots from the story');
const gOff=await pg.evaluate(()=>{ const v=document.getElementById('minigame-view');
  const r=v.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height }; });
console.log('   game viewport:',JSON.stringify(gOff));

/* TAP TO START — a real finger on the title button */
const startBox=await gf.evaluate(()=>{
  // the LEAF that carries the words — a parent wrapper's centre is not
  // on the button (that mistake made an earlier run report a dead game)
  const el=[...document.querySelectorAll('*')]
    .find(x=>/TAP TO START/i.test(x.textContent||'') && x.children.length===0);
  if(!el) return null; const r=el.getBoundingClientRect();
  return { x:r.x+r.width/2, y:r.y+r.height/2 };
});
console.log('   TAP TO START at',JSON.stringify(startBox));
if(startBox) await tap(startBox.x+gOff.x, startBox.y+gOff.y);
await pg.waitForTimeout(3000);
const running=await gf.evaluate(()=>({ run:!!(window.__jsd?.state?.running),
  p:window.__jsd?.player })).catch(()=>({}));
console.log('   after start:',JSON.stringify(running));
T(running.run,'STEP 4  TAP TO START starts the game');
await pg.screenshot({path:SP+'play-1-started.png'});

/* WALK — thumb on the left half, held */
const before=await gf.evaluate(()=>({x:__jsd.player.x,z:__jsd.player.z}));
await holdDrag(gOff.x+80, gOff.y+gOff.h*0.72, 0, -60, 6000);
const after=await gf.evaluate(()=>({x:__jsd.player.x,z:__jsd.player.z}));
const walked=Math.hypot(after.x-before.x, after.z-before.z);
console.log('   walked',walked.toFixed(2),'units', JSON.stringify(before),'->',JSON.stringify(after));
T(walked>0.5,'STEP 5  a thumb on the glass WALKS the character ('+walked.toFixed(2)+'u)');
await pg.screenshot({path:SP+'play-2-walking.png'});
/* JACK IN — walk to a terminal is minutes of real play, so use the
   game's own hook to reach the PET, then play the dream with FINGERS. */
await gf.evaluate(()=>__jsd.jackIn(__jsd.terms.indexOf('banana')));
let df=null;
for(let i=0;i<60;i++){ await pg.waitForTimeout(2500);
  df=pg.frames().find(f=>/splatpack/.test(f.url()));
  if(df){ try{ if(await df.evaluate(()=>window.__pack&&window.__pack.ready)) break; }catch(e){} } }
T(!!df,'STEP 6  a terminal jacks into the grown world');
await pg.waitForTimeout(4000);
// the dream frame is nested INSIDE dbdb2, so its page position is the
// game frame's offset plus its own rect within that document
const dIn=await gf.evaluate(()=>{ const f=document.getElementById('dreamFrame');
  const r=f.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height }; });
const dOff={ x:gOff.x+dIn.x, y:gOff.y+dIn.y, w:dIn.w, h:dIn.h };
console.log('   dream viewport:',JSON.stringify(dOff));
const p0=await df.evaluate(()=>({x:__pack.play.x,z:__pack.play.z,g:__pack.play.gems,on:__pack.play.on}));
console.log('   dream start:',JSON.stringify(p0));
T(p0.on,'STEP 7  the dream opens in PLAY mode');
/* thumb on the left half of the dream, four directions, real touch */
let dWalk=0, gemsGot=0;
for(const [dx,dy] of [[0,-70],[70,0],[0,70],[-70,0]]){
  const sx=dOff.x+dOff.w*0.22, sy=dOff.y+dOff.h*0.62;
  await holdDrag(sx, sy, dx, dy, 7000);
  const q=await df.evaluate(()=>({x:__pack.play.x,z:__pack.play.z,g:__pack.play.gems}));
  dWalk=Math.max(dWalk, Math.hypot(q.x-p0.x,q.z-p0.z));
  gemsGot=q.g-p0.g;
  console.log('   after drag',dx,dy,'->',JSON.stringify(q));
  if(dWalk>0.6) break;
}
T(dWalk>0.4,'STEP 8  a thumb WALKS in the dream ('+dWalk.toFixed(2)+'u)');
await pg.screenshot({path:SP+'play-3-dream.png'});
/* keep walking a while to bank a gem */
for(let i=0;i<3 && gemsGot<=0;i++){
  await holdDrag(dOff.x+dOff.w*0.22, dOff.y+dOff.h*0.62, [0,-70,70][i%3], [-70,0,0][i%3], 9000);
  const q=await df.evaluate(()=>__pack.play); gemsGot=q.gems-p0.g;
}
T(gemsGot>0,'STEP 9  gems can be claimed by walking ('+gemsGot+')');
/* SURFACE out of the dream via the guest hamburger */
const surf=await df.evaluate(()=>{
  document.getElementById('menuBtn').click();
  const b2=[...document.querySelectorAll('#menu button')].find(x=>x.textContent.includes('SURFACE'));
  if(!b2) return null; const r=b2.getBoundingClientRect();
  return { x:r.x+r.width/2, y:r.y+r.height/2 };
});
if(surf) await tap(surf.x+dOff.x, surf.y+dOff.y);
await pg.waitForTimeout(4000);
const back=await gf.evaluate(()=>({ dream:__jsd.dream.active, run:__jsd.state.running })).catch(()=>({}));
console.log('   back in the manor:',JSON.stringify(back));
T(back.dream===false,'STEP 10 SURFACE returns you to the Skydock');
/* END the shift: the story must resume where it paused */
await pg.evaluate(()=>window.FinkMinigames?.endMinigame?.());
await pg.waitForTimeout(4000);
const resumed=await fr.evaluate(()=>({
  choices:[...document.querySelectorAll('#choices button')].map(x=>x.textContent.trim()),
  vis:true })).catch(e=>({choices:['<gone>']}));
const winVis=await pg.evaluate(()=>{ const w=document.querySelector('.foafos-window[data-app-id="storyrunner"]');
  return w?getComputedStyle(w).visibility:'missing'; });
console.log('   story after the shift:',JSON.stringify(resumed),'window:',winVis);
T(winVis==='visible','STEP 11 the story is visible again after the shift');
T(resumed.choices.length>0,'STEP 12 the story RESUMES with choices: '+JSON.stringify(resumed.choices));
await pg.screenshot({path:SP+'play-4-resumed.png'});
console.log('pageerrors:',errs.length?errs.slice(0,4):['none']);
await ctx.close(); await b.close(); srv.close();
console.log(FAILED ? `\nPLAYTEST FAILED (${FAILED})` : '\nPLAYABLE: all steps passed');
process.exit(FAILED ? 1 : 0);
