// Adaptive music for Escape / Great Maze Pond, from the Diddums game-music engine loaded by its public URL
// (https://danbri.github.io/diddums/game.html is the reference demo; API on its skill page,
// https://danbri.github.io/diddums/skill/SKILL.md, "Adaptive music for games").
// Each floor plays a piece from the Diddums songbook. The game reports what things mean (how close the
// nearest nurse is, being caught, items found, a menu open) and the plan below turns that into an
// arrangement at the next bar line; events (pickups, a nurse noticing you, capture, escape) are hit()
// calls on the chord that is sounding. If the engine cannot load, the game keeps its own beeps.
// `?diddums=<url>` points at another copy of the engine (a local server, for tests).
const DIDDUMS=new URL(new URLSearchParams(location.search).get('diddums')||'https://danbri.github.io/diddums/',location.href).href;
const T=window.__escapeTest,btn=document.getElementById('soundBtn');

// One piece per floor; `hero` is your instrument, `nurse` theirs.
const FLOORS={
 '3':{song:'Synthwave · Neon Coastline'},
 '2':{song:'Drum and Bass · Night Bus 174'},
 '1':{song:'Bossa Nova · Late Café'},
 'G':{song:'Northern Soul · All-Nighter'},
 'B1':{song:'Krautrock · Motorway Blue'}};
const LEAD=new Set(['fiddle','whistle','melodica','voice','call','crew','lead','sax','flute','glock']);
const roleOf=id=>/bass|sub/.test(id)?'bass':LEAD.has(id)?'lead':'accomp';
const ITEMS=['badge','key','pin','fuse'];

let lib=null,music=null,M=null,ctx=null,on=false,loading=null,floor=null,wanted=null,poll=null,prev={};

function floorMusic(f){
 const {compositionFromSong,parseKey,modes,GENRES,CHARTS}=lib,title=FLOORS[f].song,song=GENRES.find(s=>s.title===title);
 const [n,d]=song.meter.split('/').map(Number),barSec=n*4/d*60/song.bpm,loopBars=Math.round((song.seconds-2)/barSec);
 const tracks=[...song.tracks,
  {id:'hero',sound:'modalVibeBarMediumRing',role:'lead',label:'You',level:.5,send:.3},
  {id:'nurse',sound:'reedAccordionBrassyStill',role:'lead',label:'Nurses',level:.42,send:.25},
  {id:'drone',sound:'voidDrone',label:'Dread drone',level:.4},{id:'heart',sound:'heartbeat',label:'Heartbeat',level:1},
  {id:'chime',sound:'celesta',label:'Pickup chime',level:.55,role:'timeline',seq:'.'},
  {id:'alarm',sound:'sonarBlup',label:'Alarm',level:.5,role:'timeline',seq:'.'},
  {id:'boom',sound:'timpani',label:'Impact',level:.9,role:'timeline',seq:'.'}];
 const composition={...compositionFromSong({...song,seconds:600,tracks}),loopBars};
 const chart=CHARTS[title],harmony=Array.from({length:Math.ceil(loopBars/2)},(_,i)=>chart[(2*i)%chart.length]);
 const k=parseKey(song.key)||{mode:'major'},parts=song.tracks.map(t=>t.id);
 return {song,composition,harmony,chordAt:b=>chart[b%loopBars],mode:k.mode,
  lead:parts.filter(id=>roleOf(id)==='lead'),bass:parts.filter(id=>roleOf(id)==='bass'),accomp:parts.filter(id=>roleOf(id)==='accomp')};
}

// Game state → arrangement. The piece builds as nurses close in; items found add the tune;
// being caught cuts to bass, drone and heartbeat; escaping plays everything.
function makePlan(M){
 return function plan({threat=0,found=0,caught=false,won=false,returned=false}){
  const q=x=>Math.round(x*10)/10,t=returned?0:q(threat),bpm=M.song.bpm,L=new Set();
  if(won){for(const id of [...M.lead,...M.bass,...M.accomp])L.add(id);return {name:'Free',layers:[...L],rhythm:M.song.rhythm==='none'?'motown':M.song.rhythm,energy:1,harmony:M.harmony,tempo:bpm,transition:{type:'pickup',beats:2}};}
  if(caught){for(const id of M.bass)L.add(id);L.add('drone');L.add('heart');return {name:'Escorted',layers:[...L],rhythm:'halftime',energy:.7,harmony:M.harmony,tempo:Math.round(bpm*.9),transition:{type:'cut',beats:1}};}
  if(M.accomp[0])L.add(M.accomp[0]);
  if(found>=2||t>=.3)for(const id of M.lead)L.add(id);
  if(found>=1||t>=.2)for(const id of M.accomp)L.add(id);
  if(found>=3||t>=.4)for(const id of M.bass)L.add(id);
  if(t>=.5)L.add('heart');
  if(t>=.8)L.add('drone');
  return {name:t>=.8?'Chased':t>=.5?'Spotted':t>=.2?'Footsteps':'Quiet ward',layers:[...L],rhythm:t>=.4||found>=4?M.song.rhythm:'none',
   energy:q(Math.min(1,.35+.15*found/4+.5*t)),harmony:M.harmony,tempo:t>=.8?Math.round(bpm*1.06):bpm,
   transition:t>=.5?{type:'fill',beats:1}:{type:'crossfade',beats:2}};
 };
}

// What the game means right now, from its own state.
function state(){
 const g=T.game,found=ITEMS.filter(i=>g.inventory[i]).length;let near=99;
 for(const n of g.nurses){const p=T.bfs(g.floor,{x:n.x,y:n.y},{x:g.x,y:g.y});if(p)near=Math.min(near,p.length);}
 return {threat:Math.max(0,Math.min(1,(12-near)/10)),found,caught:!!g.caught,won:g.won,returned:g.invincibleUntil>performance.now(),near,
  alerts:g.nurses.filter(n=>n.alert).length,quiet:g.paused||document.getElementById('modal').classList.contains('show')};
}
// Your motif is the items you carry: each adds a rising scale degree.
const heroMotif=found=>{const out=Array(16).fill(null);[0,2,4,7].slice(0,Math.max(1,found)).forEach((d,i)=>{out[i*4]=d;});return out;};

async function startFloor(f){
 if(loading){wanted=f;return;}floor=f;M=floorMusic(f);const old=music;
 loading=(async()=>{
  if(old){old.stop({keepContext:true});if(music===old)music=null;}
  const s=state();
  const m=await lib.startAdaptive({composition:M.composition,plan:makePlan(M),ctx,chordAt:M.chordAt,state:s,
   characters:{hero:{track:'hero',motif:heroMotif(s.found),scale:M.mode,present:true},
    nurse:{track:'nurse',motif:[0,null,0,null,-1,null,null,null,0,null,0,null,1,null,null,null],scale:M.mode}},
   onBar:(bar,p)=>{btn.title=`${M.song.title} · bar ${bar+1} · ${p.name}`;}});
  ctx=m.ctx;music=m;sent={};prev={};
  if(!on)music.pause();
 })();
 try{await loading;}finally{loading=null;}
 if(wanted&&wanted!==floor){const n=wanted;wanted=null;startFloor(n);}else wanted=null;
}

function tick(){
 if(!music||!on)return;const g=T.game;
 if(g.floor!==floor&&!loading){hit('chime',{tones:[0,2,4],octave:1,spread:1,velocity:.6});startFloor(g.floor);return;}
 const s=state();
 music.set(s);
 // Nurses noticing you: a bright ping on the beat; the nurse motif grows stronger as they close in.
 if(s.alerts>(prev.alerts||0)&&!s.caught)hit('alarm',{tones:[0],octave:1,grid:4,velocity:.7});
 const close=s.threat>=.5&&!s.caught;
 if(close)music.setCharacter('nurse',{power:s.threat,stability:s.threat>=.8?.5:1});
 if(close!==!!prev.close)close?music.enter('nurse'):music.leave('nurse');s.close=close;
 ctl('heart','level',.4+.6*s.threat);
 ctl('scene','muffle',s.quiet?.7:0);
 if(s.found!==prev.found)music.enter('hero',{motif:heroMotif(s.found)});
 prev=s;
}
// Mix controls only when they change.
let sent={};function ctl(id,key,v){const k=id+key;if(Math.abs((sent[k]??-9)-v)<.02)return;sent[k]=v;music.control(id,key,v);}
const hit=(track,o)=>{try{music?.hit(track,o);}catch(e){}};

// Events from the game (window.escapeMusic.cue). Returns true when the music handled it.
const CUES={
 pickup:({found=1})=>{const k=Math.min(6,found+1);hit('chime',{tones:[0,k,k+2],octave:1,spread:1,velocity:.8});},
 nope:()=>hit('alarm',{tones:[1,0],octave:-1,spread:1,velocity:.4}),
 locked:()=>hit('boom',{tones:[0],octave:-1,velocity:.6}),
 wrong:()=>hit('alarm',{tones:[3,2,1],spread:1,velocity:.5}),
 caught:()=>{hit('boom',{tones:[0],octave:-1,velocity:1});hit('alarm',{tones:[1,0],octave:-1,spread:1,velocity:.6});},
 win:()=>{hit('chime',{tones:[0,1,2,4,5,6],octave:1,velocity:.9});hit('boom',{tones:[0],octave:-1});},
 bump:()=>{}};
window.escapeMusic={get live(){return on&&!!music;},cue(name,d={}){if(!(on&&music))return false;CUES[name]?.(d);return true;},get music(){return music;}};

async function enable(){
 btn.textContent='LOADING…';
 if(!lib){
  const [a,s,b]=await Promise.all(['adaptive.js','song.js','songbook.js'].map(p=>import(new URL(p,DIDDUMS).href)));
  lib={startAdaptive:a.startAdaptive,compositionFromSong:s.compositionFromSong,parseKey:s.parseKey,modes:s.modes,GENRES:b.GENRES,CHARTS:b.CHARTS};
 }
 on=true;
 if(!music||floor!==T.game.floor)await startFloor(T.game.floor);else music.resume();
 poll??=setInterval(tick,250);
 btn.textContent='MUSIC ON';T.setMute(true);
}
function disable(){on=false;music?.pause();btn.textContent='SOUND OFF';T.setMute(true);}

// SOUND cycles: off → Diddums music → off. If the engine cannot load, fall back to the game's beeps.
btn.onclick=async()=>{
 if(on){disable();return;}
 if(btn.textContent==='SOUND ON'){T.setMute(true);btn.textContent='SOUND OFF';return;}
 try{await enable();}
 catch(e){console.error('Diddums music unavailable:',e);on=false;T.setMute(false);btn.textContent='SOUND ON';btn.title='Music engine unavailable: '+e.message;}
};
