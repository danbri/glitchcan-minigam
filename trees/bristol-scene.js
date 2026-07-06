/* <bristol-scene> — the Bristol phosphor world as an embeddable web component.
   Requires the host page to provide an import map:
     { "imports": { "three": ".../vendor/three.module.min.js", "three/addons/": ".../vendor/jsm/" } }
   API (on the element):
     el.api.jackIn(i) · el.api.setMode('tank'|'heli'|'boat') · el.api.setAuto(null|'road'|'air'|'river')
     el.api.setView('drive'|'map') · el.api.goto(easting, northing) · el.api.state()
   Events (CustomEvent on element, mirrored via postMessage {type:'bristol-scene',event,data}):
     'scene-ready' · 'tree-lost' · 'dragon-conkered' · 'wave' · 'location' (throttled)
   Single instance per page (v1: ids + window key handlers).  © data: OSM/ODbL, Bristol CC, EU-DEM. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const TEMPLATE_CSS = `
  :root{
    --safe-t: env(safe-area-inset-top,0px); --safe-b: env(safe-area-inset-bottom,0px);
    --safe-l: env(safe-area-inset-left,0px); --safe-r: env(safe-area-inset-right,0px);
    --ink:#9dffce; --glow:#00ff66; --amber:#ffb000; --bad:#ff44aa; --panel:rgba(1,12,6,.78);
  }
  *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body{height:100%;overflow:hidden;background:#252e29;
    font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;
    user-select:none;-webkit-user-select:none;touch-action:none;color:var(--ink)}
  canvas#gl{position:fixed;inset:0;display:block}

  /* ---------- CRT layer: scanlines + phosphor flicker + vignette ---------- */
  #crt{position:fixed;inset:0;pointer-events:none;z-index:2;
    background:
      radial-gradient(ellipse at 50% 42%, transparent 50%, rgba(8,12,10,.42) 100%),
      repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0px, rgba(0,0,0,.22) 1px, transparent 1px, transparent 3px);
    animation:flicker 4.2s infinite}
  @keyframes flicker{0%,100%{opacity:.92}48%{opacity:.97}50%{opacity:.85}52%{opacity:.97}}

  /* ---------- HUD ---------- */
  #ticker{display:none;position:fixed;top:var(--safe-t);left:0;right:0;height:24px;overflow:hidden;z-index:5;
    background:rgba(0,6,2,.85);border-bottom:1px solid rgba(0,255,102,.35);
    font:700 11px/24px ui-monospace,monospace;color:var(--glow);white-space:nowrap;
    text-shadow:0 0 6px rgba(0,255,102,.8);letter-spacing:1px}
  #ticker span{display:inline-block;padding-left:100vw;animation:tick 18s linear infinite}
  @keyframes tick{to{transform:translateX(-200%)}}

  #stats{position:fixed;top:calc(var(--safe-t) + 30px);left:calc(var(--safe-l) + 8px);z-index:5;
    background:var(--panel);border:1px solid rgba(0,255,102,.45);padding:6px 10px;
    font-size:12px;line-height:1.55;text-shadow:0 0 5px rgba(0,255,102,.6);letter-spacing:.5px}
  #stats b{color:var(--glow);font-variant-numeric:tabular-nums}
  #treebar{width:124px;height:6px;background:#03190c;border:1px solid rgba(0,255,102,.3);margin-top:3px}
  #treefill{height:100%;width:100%;background:var(--glow);box-shadow:0 0 8px rgba(0,255,102,.8);transition:width .4s}

  #fleet{display:flex;gap:6px;justify-content:center;margin:8px 0}
  .tankbtn{padding:5px 9px;font:700 11px ui-monospace,monospace;letter-spacing:1px;color:var(--ink);
    background:var(--panel);border:1px solid rgba(0,255,102,.4);cursor:pointer}
  .tankbtn.active{color:#021006;background:var(--glow);box-shadow:0 0 12px rgba(0,255,102,.9)}

  #feed{position:fixed;top:calc(var(--safe-t) + 66px);right:calc(var(--safe-r) + 8px);z-index:5;text-align:right;
    font-size:11px;font-weight:700;pointer-events:none;max-width:48vw;letter-spacing:.5px}
  #feed div{background:var(--panel);border-right:2px solid var(--glow);padding:3px 8px;margin-bottom:4px;opacity:0;
    text-shadow:0 0 5px rgba(0,255,102,.6);animation:feedin 4s ease forwards}
  @keyframes feedin{0%{opacity:0;transform:translateX(16px)}8%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0}}

  #wavebanner{position:fixed;top:30%;left:0;right:0;text-align:center;z-index:6;pointer-events:none;
    font-size:clamp(22px,6vw,40px);font-weight:700;color:var(--glow);letter-spacing:4px;
    text-shadow:0 0 18px rgba(0,255,102,.9), 0 0 60px rgba(0,255,102,.5);opacity:0;transition:opacity .4s}
  #maphint{position:fixed;bottom:calc(var(--safe-b) + 18px);left:0;right:0;text-align:center;z-index:5;
    font-size:11px;letter-spacing:1px;color:var(--ink);opacity:.8;pointer-events:none;display:none}
  #maptitle{position:fixed;top:calc(var(--safe-t) + 84px);left:50%;transform:translateX(-50%);z-index:5;
    font:700 14px ui-monospace,monospace;letter-spacing:6px;color:var(--glow);
    text-shadow:0 0 12px rgba(0,255,102,.8);pointer-events:none;display:none}
  #scalebar{position:fixed;bottom:calc(var(--safe-b) + 44px);left:calc(var(--safe-l) + 14px);z-index:5;
    pointer-events:none;display:none;font:700 10px ui-monospace,monospace;color:var(--ink);letter-spacing:1px}
  #scalebar div{height:4px;border:1px solid var(--glow);border-top:none;box-shadow:0 0 6px rgba(0,255,102,.5);margin-top:2px}

  /* ---------- controls ---------- */
  #stick{position:fixed;left:calc(var(--safe-l) + 16px);bottom:calc(var(--safe-b) + 20px);width:124px;height:124px;
    z-index:6;border-radius:50%;border:1px solid rgba(0,255,102,.5);
    background:radial-gradient(circle, rgba(0,255,102,.08), transparent 70%)}
  #knob{position:absolute;left:50%;top:50%;width:50px;height:50px;border-radius:50%;
    border:2px solid var(--glow);background:rgba(0,255,102,.15);
    box-shadow:0 0 14px rgba(0,255,102,.5), inset 0 0 8px rgba(0,255,102,.4);
    transform:translate(-50%,-50%)}
  .btn{position:fixed;z-index:6;border-radius:50%;border:2px solid rgba(0,255,102,.55);color:var(--glow);
    display:flex;align-items:center;justify-content:center;font-weight:700;cursor:pointer;
    background:rgba(1,16,8,.7);box-shadow:0 0 14px rgba(0,255,102,.25), inset 0 0 10px rgba(0,255,102,.15);
    text-shadow:0 0 8px rgba(0,255,102,.8)}
  .btn:active{transform:scale(.93);background:rgba(0,255,102,.25)}
  #fire{right:calc(var(--safe-r) + 18px);bottom:calc(var(--safe-b) + 26px);width:84px;height:84px;font-size:28px;opacity:.85}
  #honk{right:calc(var(--safe-r) + 130px);bottom:calc(var(--safe-b) + 32px);width:54px;height:54px;font-size:22px}
  #radiobtn{right:calc(var(--safe-r) + 196px);bottom:calc(var(--safe-b) + 32px);width:54px;height:54px;font-size:20px}
  #radio{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--safe-b) + 160px);z-index:7;
    width:min(78vw,380px);background:var(--panel);border:1px solid rgba(0,255,102,.5);padding:10px 14px;
    box-shadow:0 0 18px rgba(0,255,102,.25)}
  #radio .freq{text-align:center;font-size:13px;font-weight:700;color:var(--amber);
    text-shadow:0 0 8px rgba(255,176,0,.8);letter-spacing:2px;margin-bottom:6px}
  #radio input[type=range]{width:100%;accent-color:#00ff66}
  #radio .stations{display:flex;justify-content:space-between;font-size:9px;color:#5fbf8f;letter-spacing:.5px;margin-top:3px}
  #mapbtn{top:calc(var(--safe-t) + 64px);right:calc(var(--safe-r) + 8px);width:46px;height:46px;font-size:19px;position:fixed;border-radius:8px}
  #rose{position:fixed;top:calc(var(--safe-t) + 84px);right:calc(var(--safe-r) + 8px);width:62px;height:62px;z-index:5;
    pointer-events:none;opacity:.9}
  #rose svg{filter:drop-shadow(0 0 5px rgba(0,255,102,.7))}
  #pausebtn{top:calc(var(--safe-t) + 30px);right:calc(var(--safe-r) + 62px);width:46px;height:46px;font-size:15px;position:fixed;border-radius:8px}
  #menubtn{top:calc(var(--safe-t) + 10px);right:calc(var(--safe-r) + 8px);width:46px;height:46px;font-size:20px;position:fixed;border-radius:10px}
  #drawer{position:fixed;top:0;right:0;bottom:0;width:min(78vw,300px);z-index:9;transform:translateX(105%);
    transition:transform .25s ease;background:rgba(2,14,8,.94);border-left:1px solid rgba(0,255,102,.4);
    padding:calc(var(--safe-t) + 14px) 14px 14px;overflow-y:auto;backdrop-filter:blur(6px)}
  #drawer.open{transform:none}
  #drawer h3{font-size:11px;letter-spacing:2px;color:#5fbf8f;margin:14px 0 6px}
  #drawer .row{display:flex;gap:6px;flex-wrap:wrap}
  #drawer .tankbtn{flex:1;min-width:70px;text-align:center;padding:9px 6px}
  #nowplaying{position:fixed;bottom:calc(var(--safe-b) + 6px);left:50%;transform:translateX(-50%);z-index:5;
    font-size:9px;letter-spacing:1px;color:#5fbf8f;pointer-events:none;opacity:.8}
  @media (min-width:900px) and (hover:hover){ #stick,#fire{opacity:.5} }

  /* ---------- overlays ---------- */
  .overlay{position:fixed;inset:0;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:radial-gradient(ellipse at 50% 30%, rgba(1,22,10,.95), rgba(0,4,2,.98));text-align:center;padding:24px}
  .overlay h1{font-size:clamp(24px,6.4vw,46px);font-weight:700;color:var(--glow);letter-spacing:3px;
    text-shadow:0 0 22px rgba(0,255,102,.9), 0 0 70px rgba(0,255,102,.4)}
  .overlay h2{font-size:clamp(11px,3vw,15px);margin:8px 0 4px;color:var(--ink);letter-spacing:2px}
  .overlay p{font-size:clamp(11px,2.8vw,14px);color:#6fd9a4;max-width:560px;margin:9px 0;line-height:1.6}
  .bigbtn{margin-top:16px;padding:14px 40px;font:700 clamp(15px,4.4vw,21px) ui-monospace,monospace;letter-spacing:3px;
    color:var(--glow);background:transparent;border:2px solid var(--glow);cursor:pointer;
    box-shadow:0 0 20px rgba(0,255,102,.4), inset 0 0 12px rgba(0,255,102,.15);
    text-shadow:0 0 10px rgba(0,255,102,.9)}
  .bigbtn:active{background:rgba(0,255,102,.2);transform:scale(.97)}
  #loadnote{font:700 11px ui-monospace,monospace;color:#3f9f6f;margin-top:14px;min-height:18px;letter-spacing:1px}
  .hidden{display:none!important}
  #gameover h1{color:var(--bad);text-shadow:0 0 22px rgba(255,68,170,.9)}
`;
const TEMPLATE_HTML = `

<canvas id="gl"></canvas>
<div id="crt"></div>

<div id="ticker"><span id="tickertext">&gt;&gt; BREAKING: DRAGONS RETURN TO BRISTOL — COUNCIL DEPLOYS BIGTRAK FLEET &lt;&lt;</span></div>
<div id="stats">
  SCORE <b id="score">0</b> WAVE <b id="wave">1</b><br>
  TREES <b id="treesleft">—</b><br>
  <span style="font-size:10px">TIDE <b id="tide">—</b></span><br>
  <span style="font-size:10px;color:#39c98a" id="loc">—</span>
  <div id="treebar"><div id="treefill"></div></div>
</div>
<div id="fleet"></div>
<div id="feed"></div>
<div id="wavebanner"></div>
<div id="maphint">TAP TANK=SELECT · TAP GROUND=ORDER · DOUBLE-TAP=TELEPORT · PINCH=AERIAL</div>
<div id="maptitle">B R I S T O L</div>
<div id="scalebar">1 KM<div id="scalebarline"></div></div>

<div id="stick"><div id="knob"></div></div>
<div id="fire" class="btn">⊕</div>
<div id="menubtn" class="btn">☰</div>
<div id="rise" class="btn hidden" style="right:calc(var(--safe-r) + 18px);bottom:calc(var(--safe-b) + 140px);width:50px;height:50px;font-size:18px">⬆</div>
<div id="sink" class="btn hidden" style="right:calc(var(--safe-r) + 128px);bottom:calc(var(--safe-b) + 30px);width:50px;height:50px;font-size:18px">⬇</div>
<div id="nowplaying"></div>
<div id="drawer">
  <div style='font-size:9px;color:#3f9f6f;letter-spacing:2px'>BUILD 1649</div><h3>FLEET</h3><div id="fleet"></div>
  <h3>VEHICLE</h3>
  <div class="row">
    <button class="tankbtn" data-mode="tank">⛟ TANK</button>
    <button class="tankbtn" data-mode="heli">⌖ HELI</button>
    <button class="tankbtn" data-mode="boat">⛵ BOAT</button>
  </div>
  <h3>AUTOPILOT</h3>
  <div class="row">
    <button class="tankbtn" data-auto="">OFF</button>
    <button class="tankbtn" data-auto="road">ROADS</button>
    <button class="tankbtn" data-auto="air">AIR TOUR</button>
    <button class="tankbtn" data-auto="river">RIVER</button>
  </div>
  <h3>SOUND</h3>
  <div class="row">
    <button class="tankbtn" id="honk">♪ HONK</button>
    <button class="tankbtn" id="ambientbtn">♬ 99.1 ON</button>
    <button class="tankbtn" id="stationsbtn">📻 STATIONS</button>
  </div>
  <div id="radio" class="hidden" style="margin-top:8px">
  <div class="freq" id="freqlabel">— FM</div>
  <input type="range" id="dial" min="880" max="1080" value="991">
  <div class="stations"><span>91.5</span><span>96.2 ◇◇◇</span><span style="color:#ffb000">99.1 BRS</span><span>103.7</span></div>
  </div>
  <h3>PLACES <button class="tankbtn" id="tpmode" style="flex:none;padding:4px 8px;font-size:9px">MODE: DRIVE</button></h3>
  <div class="row" id="places"></div>
  <h3>EXTRAS</h3>
  <div class="row">
    <button class="tankbtn" id="tickertgl">NEWS TICKER</button>
    <button class="tankbtn" id="pausebtn2">‖ PAUSE</button>
  </div>
</div>
<div id="mapbtn" class="btn">▦</div>
<div id="rose"><svg viewBox="0 0 100 100" width="62" height="62">
  <g id="roseg">
    <circle cx="50" cy="50" r="44" fill="rgba(1,12,6,.6)" stroke="#00ff66" stroke-width="1.5" opacity="0.9"/>
    <polygon points="50,12 56,50 50,46 44,50" fill="#00ff66"/>
    <polygon points="50,88 56,50 50,54 44,50" fill="#0a5c33"/>
    <line x1="14" y1="50" x2="86" y2="50" stroke="#0a5c33" stroke-width="1.5"/>
    <text x="50" y="10" text-anchor="middle" font-size="13" font-weight="700" fill="#00ff66" font-family="monospace">N</text>
    <text x="50" y="99" text-anchor="middle" font-size="10" fill="#39c98a" font-family="monospace">S</text>
    <text x="3" y="54" font-size="10" fill="#39c98a" font-family="monospace">W</text>
    <text x="90" y="54" font-size="10" fill="#39c98a" font-family="monospace">E</text>
  </g>
</svg></div>

<div id="splash" class="overlay">
  <h1>TANKS FOR THE TREES</h1>
  <h2>// BRISTOL'S LAST STAND //</h2>
  <p>The tree-eating dragons are BACK. Command the council's emergency BigTrak fleet —
     <b>BRUNEL</b>, <b>CABOT</b> and <b>BANKSY</b> — across <b>real Bristol terrain</b>
     and defend all <b id="ntrees">35,893</b> <b>real council trees</b>.</p>
  <p>▦ MAP: tap tank → tap ground to order · tap again to JACK IN and drive<br>
     STICK drive · ⊕ fire/aim · ⛓ MODE tank/heli/boat (T) · ▶▶ AUTOPILOT road/air/river (P) · ♪ 📻<br>
     KBD: WASD · mouse aims · SPACE fire · M map · 1/2/3 tanks · H honk · R radio · mind the tide</p>
  <button class="bigbtn" id="startbtn">▶ DEFEND BRISTOL</button>
  <div id="loadnote">BOOTING…</div>
</div>

<div id="gameover" class="overlay hidden">
  <h1>// BRISTOL DEFOLIATED //</h1>
  <p id="finalstats"></p>
  <p id="finalquip"></p>
  <button class="bigbtn" onclick="location.reload()">↻ REPLANT &amp; RETRY</button>
</div>

`;

function bootGame(host, opts) {

/* ============ TANKS FOR THE TREES — phosphor vector edition ============
   Real data: data/elevation-bristol.json(.gz)  EU-DEM 25m grid
              data/trees-bristol.json(.gz)      Bristol CC inventory
   World units = metres. BNG -> world: x=E-358500, z=-(N-173500). EXAG 2.4x (see const below). */

const WORLD = 9000, E0 = 358500, N0 = 173500, EXAG = 2.4;
const $ = id => host.querySelector('#' + id);
const PHOS = 0x00ff66, AMBER = 0xffb000, ENEMY = 0xff44aa, CYAN = 0x00ddff;

async function loadJson(path){
  try{
    const r = await fetch(path + '.gz');
    if(!r.ok) throw 0;
    return JSON.parse(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text());
  }catch(e){
    const r = await fetch(path);
    if(!r.ok) throw new Error('cannot load ' + path);
    return r.json();
  }
}

let ELEV = null;
function heightAt(x, z){
  if(!ELEV) return 0;
  const {rows, cols, data} = ELEV;
  let u = (x + WORLD/2) / WORLD * (cols-1), v = ((-z) + WORLD/2) / WORLD * (rows-1);
  u = Math.max(0, Math.min(cols-1.001, u)); v = Math.max(0, Math.min(rows-1.001, v));
  const c0 = u|0, r0 = v|0, fu = u-c0, fv = v-r0;
  return ((data[r0*cols+c0]*(1-fu)+data[r0*cols+c0+1]*fu)*(1-fv)
        + (data[(r0+1)*cols+c0]*(1-fu)+data[(r0+1)*cols+c0+1]*fu)*fv) * EXAG;
}

/* ---------- scene ---------- */
const renderer = new THREE.WebGLRenderer({canvas:$('gl'), antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x49565c);
scene.fog = new THREE.Fog(0x6d7268, 900, 3400);
const camera = new THREE.PerspectiveCamera(62, innerWidth/innerHeight, 0.5, 6000);
/* overcast sky dome: zenith slate to pale warm horizon */
{
  const sg = new THREE.SphereGeometry(4200, 20, 12);
  const cols = []; const pos = sg.attributes.position;
  const zen = new THREE.Color(0x37444c), hor = new THREE.Color(0x9b9484);
  for(let i=0;i<pos.count;i++){
    const t = THREE.MathUtils.clamp(pos.getY(i)/4200, 0, 1);
    const c = hor.clone().lerp(zen, Math.pow(t, 0.55));
    cols.push(c.r, c.g, c.b);
  }
  sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  scene.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({vertexColors:true, side:THREE.BackSide, fog:false})));
}
/* fly-mode's film look, blended in: bloom for phosphor, grain for the CRT */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.5, 0.2);
composer.addPass(bloom);
composer.addPass(new FilmPass(0.15, false));
composer.addPass(new OutputPass());
/* vector worlds are unlit: MeshBasicMaterial everywhere, glow via colour */

/* hidden-line helper: black faces + glowing edges */
function vectorize(geo, color, edgeOpacity=1){
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color:0x010604})));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({color, transparent:edgeOpacity<1, opacity:edgeOpacity})));
  return g;
}

/* ---------- terrain: dark mass + phosphor grid ---------- */
let GREENS = null, WATER = null, gridMesh = null;
function pointInRings(list, x, z){
  const e = x + E0, n = -z + N0;
  for(const [, ring] of list){
    let minE=1e9,maxE=-1e9,minN=1e9,maxN=-1e9;
    for(const [pe,pn] of ring){ if(pe<minE)minE=pe; if(pe>maxE)maxE=pe; if(pn<minN)minN=pn; if(pn>maxN)maxN=pn; }
    if(e<minE||e>maxE||n<minN||n>maxN) continue;
    let inside = false;                                     // ray cast
    for(let i=0, j=ring.length-1; i<ring.length; j=i++){
      const [xi,yi]=ring[i], [xj,yj]=ring[j];
      if((yi>n)!==(yj>n) && e < (xj-xi)*(n-yi)/(yj-yi)+xi) inside = !inside;
    }
    if(inside) return true;
  }
  return false;
}
function inAnyPark(x, z){ return GREENS ? pointInRings(GREENS.greens, x, z) : false; }
function inWater(x, z){ return WATER ? pointInRings(WATER.water, x, z) : false; }
function buildTerrain(){
  const seg = ELEV.cols - 1;
  const g = new THREE.PlaneGeometry(WORLD, WORLD, seg, seg);
  g.rotateX(-Math.PI/2);
  const pos = g.attributes.position;
  for(let i=0;i<pos.count;i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  g.computeVertexNormals();
  // base mass: near-black, blue-black under water datum, deep green inside parks
  const baseCols = [], gridCols = [];
  const cBase = new THREE.Color(0x2a3424), cMeadow = new THREE.Color(0x4a4f2e), cScrub = new THREE.Color(0x46392a),
        cPark = new THREE.Color(0x2e4d2a), cRiver = new THREE.Color(0x1c2c38), cRock = new THREE.Color(0x575b50);
  const gLow = new THREE.Color(0x17854a), gHigh = new THREE.Color(0x7df2a4), gPark = new THREE.Color(0x4dff8e);
  const nrm = g.attributes.normal;
  const L = new THREE.Vector3(-0.45, 0.78, -0.42).normalize();   // sun behind the overcast
  for(let i=0;i<pos.count;i++){
    const x = pos.getX(i), z = pos.getZ(i), hm = pos.getY(i)/EXAG;
    const park = inAnyPark(x, z);
    const slope = 1 - nrm.getY(i);                               // 0 flat .. steep
    const patch = Math.sin(x*0.0021+z*0.0017)*Math.sin(x*0.0007-z*0.0011);   // big soft landuse-ish patches
    let c;
    if(hm < 8.7) c = cRiver.clone();
    else if(park) c = cPark.clone();
    else { c = cBase.clone();
      if(patch > 0.25) c.lerp(cMeadow, Math.min(1,(patch-0.25)*2));
      else if(patch < -0.3) c.lerp(cScrub, Math.min(1,(-patch-0.3)*2)); }
    if(slope > 0.22) c.lerp(cRock, Math.min(1,(slope-0.22)*3));  // gorge faces go to stone
    const shade = 0.45 + 0.65*Math.max(0, nrm.getX(i)*L.x + nrm.getY(i)*L.y + nrm.getZ(i)*L.z);
    c.multiplyScalar(shade);                                     // baked hillshade: relief reads instantly
    baseCols.push(c.r, c.g, c.b);
    const t = THREE.MathUtils.clamp((hm-5)/110, 0, 1);
    let gc = gLow.clone().lerp(gHigh, t).multiplyScalar(0.7 + shade*0.35);
    if(park) gc.lerp(gPark, 0.5);
    gridCols.push(gc.r, gc.g, gc.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(baseCols, 3));
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({vertexColors:true})));
  const g2 = g.clone();
  g2.setAttribute('color', new THREE.Float32BufferAttribute(gridCols, 3));
  gridMesh = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({wireframe:true, vertexColors:true, transparent:true, opacity:0.5}));
  gridMesh.position.y = 0.4; scene.add(gridMesh);
  waterMesh = new THREE.Group();
  const wWire = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD, 40, 40),
    new THREE.MeshBasicMaterial({wireframe:true, color:CYAN, transparent:true, opacity:0.22}));
  wWire.rotation.x = -Math.PI/2; waterMesh.add(wWire);
  waterMesh.position.y = waterLevel(); scene.add(waterMesh);  // tidal sheet: visible in the gorge only
}
/* the real water: OSM polygons — Floating Harbour, New Cut, the Avon itself */
function buildWater(){
  if(!WATER) return;
  for(const [name, ring] of WATER.water){
    const shape = new THREE.Shape(ring.map(([e,n]) => new THREE.Vector2(e-E0, n-N0)));
    let mean = 0;
    for(const [e,n] of ring) mean += heightAt(e-E0, -(n-N0));
    mean /= ring.length;
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({color:0x1273d8, transparent:true, opacity:0.72, depthWrite:false, side:THREE.DoubleSide}));
    m.rotation.x = -Math.PI/2; m.position.y = mean + 1.1; scene.add(m);
    const edge = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(ring.map(([e,n]) => new THREE.Vector3(e-E0, mean+1.4, -(n-N0)))),
      new THREE.LineBasicMaterial({color:CYAN, transparent:true, opacity:0.5}));
    scene.add(edge);
  }
}
/* Bristol has one of the world's highest tidal ranges; the game tide cycles ~3 min */
let waterMesh = null, tideT = 0;
function waterLevel(){ return (8.7 + 4.2*Math.sin(tideT * Math.PI*2/180)) * EXAG; }
function tideRising(){ return Math.cos(tideT * Math.PI*2/180) > 0; }

/* ---------- weather: low grey clouds and proper Bristol drizzle ---------- */
const clouds = [];
let rainGeo = null;
const RAIN_N = 650, rainOfs = new Float32Array(RAIN_N*3);
function buildWeather(){
  const puffMat = new THREE.MeshBasicMaterial({color:0xb9bdb4, transparent:true, opacity:0.5, depthWrite:false});
  const shadMat = new THREE.MeshBasicMaterial({color:0x6f766f, transparent:true, opacity:0.45, depthWrite:false});
  for(let i=0;i<13;i++){
    const cl = new THREE.Group();
    const puffs = 3 + (Math.random()*3|0);
    for(let p=0;p<puffs;p++){
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1,1), p===0 ? shadMat : puffMat);
      m.scale.set(120+Math.random()*150, 26+Math.random()*22, 80+Math.random()*90);
      m.position.set((Math.random()-0.5)*260, (p===0?-14:Math.random()*26), (Math.random()-0.5)*160);
      cl.add(m);
    }
    cl.position.set((Math.random()-0.5)*WORLD*1.1, 560+Math.random()*220, (Math.random()-0.5)*WORLD*1.1);
    cl.userData.v = 3 + Math.random()*4;
    scene.add(cl); clouds.push(cl);
  }
  for(let i=0;i<RAIN_N;i++){
    rainOfs[i*3]   = (Math.random()-0.5)*240;
    rainOfs[i*3+1] = Math.random()*150;
    rainOfs[i*3+2] = (Math.random()-0.5)*240;
  }
  rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(RAIN_N*3), 3));
  scene.add(new THREE.Points(rainGeo, new THREE.PointsMaterial({color:0xa9bdb0, size:1.5,
    transparent:true, opacity:0.4, sizeAttenuation:true, depthWrite:false})));
}
function updateWeather(dt){
  for(const c of clouds){
    c.position.x += c.userData.v*dt;
    if(c.position.x > WORLD/2+300) c.position.x = -WORLD/2-300;
  }
  if(!rainGeo) return;
  const arr = rainGeo.attributes.position.array;
  for(let i=0;i<RAIN_N;i++){
    rainOfs[i*3+1] -= (52 + (i%7)*4)*dt;
    rainOfs[i*3]   += 6*dt;                                   // westerly, naturally
    if(rainOfs[i*3+1] < -8){ rainOfs[i*3+1] = 140; rainOfs[i*3] = (Math.random()-0.5)*240; rainOfs[i*3+2] = (Math.random()-0.5)*240; }
    arr[i*3]   = camera.position.x + rainOfs[i*3];
    arr[i*3+1] = camera.position.y + rainOfs[i*3+1] - 60;
    arr[i*3+2] = camera.position.z + rainOfs[i*3+2];
  }
  rainGeo.attributes.position.needsUpdate = true;
}

/* ---------- trees: 36k phosphor wireframe canopies ---------- */
let TREES = null, treeState = [], aliveTrees = 0, totalTrees = 0;
let treeMeshes = [];           // [broadleaf, conifer, columnar]
const dummy = new THREE.Object3D();
function speciesForm(name){
  const n = (name||'').toLowerCase();
  if(/pine|fir|spruce|cedar|cypress|yew|larch|juniper|wellingtonia|redwood|monkey/.test(n)) return 1; // conifer
  if(/poplar|lombardy/.test(n)) return 2;                                                            // columnar
  return 0;                                                                                          // broadleaf
}
function speciesColour(name, col){
  const n = (name||'').toLowerCase();
  if(/copper|purple|purpurea/.test(n))           col.setHex(0xc7813f);   // copper beech & co
  else if(/cherry|plum|crab|apple|rowan|hawthorn|whitebeam/.test(n)) col.setHex(0x4ad06a);
  else if(/birch|willow|aspen/.test(n))          col.setHex(0x7be08a);
  else if(/pine|fir|spruce|cedar|cypress|yew|larch|juniper/.test(n)) col.setHex(0x1f7a55);
  else if(/oak|plane|beech|chestnut/.test(n))    col.setHex(0x2f9a4f);
  else col.setHex(0x3cb45e);
  return col;
}
function buildTrees(){
  const lite = new URLSearchParams(location.search).has('lite');
  const list = lite ? TREES.trees.filter((_,i)=>i%4===0) : TREES.trees;
  totalTrees = aliveTrees = list.length;
  const HEADROOM = 2000;
  persistOk = !lite;
  // bucket trees by realistic form
  const forms = list.map(t => speciesForm(TREES.species[t[2]]));
  const counts = [0,0,0];
  for(const f of forms) counts[f]++;
  const geos = [new THREE.IcosahedronGeometry(1,0),                   // broadleaf dome
                new THREE.ConeGeometry(0.85, 2.4, 6),                 // conifer spike
                new THREE.IcosahedronGeometry(1,0)];                  // columnar (stretched at place time)
  treeMeshes = geos.map((geo, f) => {
    const cap = counts[f] + (f===0 ? HEADROOM : 0);
    const m = new THREE.InstancedMesh(geo,
      new THREE.MeshBasicMaterial({wireframe:true, transparent:true, opacity:0.8}), Math.max(cap,1));
    m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m); return m;
  });
  treeCapacity = counts[0] + HEADROOM;
  const col = new THREE.Color();
  for(let i=0;i<list.length;i++){
    const [e,n,sp,cw,ch] = list[i];
    const x = e - E0, z = -(n - N0), y = heightAt(x,z);
    const f = forms[i];
    const r = Math.min(15,(cw||5)/2), h = Math.min(28, Math.max(3, ch||8));
    const mesh = treeMeshes[f], mi = mesh.count++;
    treeState.push({x, z, y, r, h, sp, f, mi, alive:true});
    placeCanopy(treeState[i], 1);
    mesh.setColorAt(mi, speciesColour(TREES.species[sp], col));
  }
  for(const m of treeMeshes) if(m.instanceColor) m.instanceColor.needsUpdate = true;
  chestnutSp = TREES.species.findIndex(n => /horse chestnut/i.test(n));
  if(chestnutSp < 0){ chestnutSp = TREES.species.length; TREES.species.push('Horse Chestnut'); }
}
function placeCanopy(t, frac){
  const mesh = treeMeshes[t.f];
  if(t.f === 1){        // conifer: ground-up spike, tall & narrow
    dummy.position.set(t.x, t.y + t.h*0.5*frac, t.z);
    dummy.scale.set(Math.max(0.01,t.r*0.7*frac), Math.max(0.01,t.h*0.42*frac), Math.max(0.01,t.r*0.7*frac));
  } else if(t.f === 2){ // columnar: poplar exclamation mark
    dummy.position.set(t.x, t.y + t.h*0.6*frac, t.z);
    dummy.scale.set(Math.max(0.01,t.r*0.35*frac), Math.max(0.01,t.h*0.55*frac), Math.max(0.01,t.r*0.35*frac));
  } else {              // broadleaf dome on implied trunk
    dummy.position.set(t.x, t.y + t.h*0.7*frac, t.z);
    dummy.scale.set(Math.max(0.01,t.r*frac), Math.max(0.01,t.h*0.45*frac), Math.max(0.01,t.r*frac));
  }
  dummy.rotation.y = (t.x*13+t.z*7)%6.28;
  dummy.updateMatrix();
  mesh.setMatrixAt(t.mi, dummy.matrix);
  mesh.instanceMatrix.needsUpdate = true;
}
function shrinkTree(i, frac){ placeCanopy(treeState[i], frac); }

/* ---------- conkers are seeds: misses grow horse chestnuts ---------- */
const growing = [];
let chestnutSp = -1, persistOk = false;
let treeCapacity = 0;
function plantSapling(x, z){
  const i = treeState.length;
  if(treeMeshes[0].count >= treeCapacity) return;
  const y = heightAt(x, z);
  if(inWater(x, z) || y < waterLevel() - 2) { burst(new THREE.Vector3(x, y+2, z), 6, CYAN, 8, 5); return; }   // splash, no tree
  if(inBuilding(x, z)) { burst(new THREE.Vector3(x, y+5, z), 5, AMBER, 8, 5); return; }   // bonk, no tree indoors
  const mesh = treeMeshes[0];
  const t = {x, z, y, r: 3.2, h: 7, sp: chestnutSp, f: 0, mi: mesh.count++, alive: true, grown: true};
  treeState.push(t);
  mesh.setColorAt(t.mi, new THREE.Color(0x39ff9c));
  mesh.instanceColor.needsUpdate = true;
  growing.push({i, t: 0});
  shrinkTree(i, 0.06);
  aliveTrees++;
  feed('>> SAPLING TAKING ROOT');
}
function updateGrowing(dt){
  for(let k = growing.length-1; k >= 0; k--){
    const g = growing[k]; g.t += dt/25;                 // ~25s to full size
    if(!treeState[g.i].alive){ growing.splice(k,1); continue; }
    shrinkTree(g.i, Math.min(1, 0.06 + g.t*0.94));
    if(g.t >= 1) growing.splice(k,1);
  }
}
/* persistent forest: deaths scar, plantings heal (full mode only, lite reindexes) */
function saveForest(){
  if(!persistOk) return;
  try{
    const dead = []; const grown = [];
    treeState.forEach((t,i)=>{ if(t.grown){ if(t.alive) grown.push([Math.round(t.x),Math.round(t.z)]); }
                               else if(!t.alive) dead.push(i); });
    localStorage.setItem('tftt-forest', JSON.stringify({dead: dead.slice(0,5000), grown: grown.slice(0,1500)}));
  }catch(e){}
}
function loadForest(){
  if(!persistOk) return;
  try{
    const f = JSON.parse(localStorage.getItem('tftt-forest') || 'null');
    if(!f) return;
    for(const i of f.dead||[]) if(treeState[i] && !treeState[i].grown){ treeState[i].alive=false; aliveTrees--; shrinkTree(i,0.01); }
    for(const [x,z] of f.grown||[]) plantSapling(x, z);
    for(const g of growing) g.t = 1;                     // restored trees arrive full-grown
    updateGrowing(0.001);
    if((f.dead||[]).length) feed('>> THE FOREST REMEMBERS: ' + f.dead.length + ' SCARS');
  }catch(e){}
}

/* ---------- contour lines from the DEM: the hills, made legible ---------- */
function buildContours(){
  const {rows, cols, data} = ELEV;
  const cell = WORLD/(cols-1);
  const minor = [], major = [];
  for(let lvl = 10; lvl <= 150; lvl += 10){
    const out = (lvl % 50 === 0) ? major : minor;
    for(let r=0; r<rows-1; r++){
      for(let c=0; c<cols-1; c++){
        const h00=data[r*cols+c], h10=data[r*cols+c+1], h01=data[(r+1)*cols+c], h11=data[(r+1)*cols+c+1];
        const lo = Math.min(h00,h10,h01,h11), hi = Math.max(h00,h10,h01,h11);
        if(lvl < lo || lvl > hi) continue;
        const x0 = -WORLD/2 + c*cell, z0 = WORLD/2 - r*cell;          // row 0 = south = +z
        const pts = [];
        const edge = (ha, hb, xa, za, xb, zb) => {
          if((ha < lvl) !== (hb < lvl)){
            const t = (lvl - ha)/(hb - ha);
            pts.push([xa + (xb-xa)*t, za + (zb-za)*t]);
          }
        };
        edge(h00,h10, x0,z0,       x0+cell,z0);
        edge(h10,h11, x0+cell,z0,  x0+cell,z0-cell);
        edge(h11,h01, x0+cell,z0-cell, x0,z0-cell);
        edge(h01,h00, x0,z0-cell,  x0,z0);
        const y = lvl*EXAG + 0.7;
        if(pts.length >= 2) out.push(pts[0][0],y,pts[0][1], pts[1][0],y,pts[1][1]);
        if(pts.length === 4) out.push(pts[2][0],y,pts[2][1], pts[3][0],y,pts[3][1]);
      }
    }
  }
  for(const [arr, op, col] of [[minor, 0.22, 0x3fce75],[major, 0.5, 0x8df2ae]]){
    if(!arr.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({color:col, transparent:true, opacity:op})));
  }
}

/* ---------- parks: outlines + labels ---------- */
function buildGreens(){
  if(!GREENS) return;
  const seen = new Set();
  for(const [name, ring] of GREENS.greens){
    const pts = ring.map(([e,n]) => {
      const x = e-E0, z = -(n-N0);
      return new THREE.Vector3(x, heightAt(x,z)+1.0, z);
    });
    const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({color:0x23d465, transparent:true, opacity:0.45}));
    scene.add(loop);
    const NM = (name||'').toUpperCase();
    if(NM && !seen.has(NM) && NM.length <= 24 && ring.length >= 4){
      seen.add(NM);
      if(seen.size <= 48){
        let cx=0, cz=0; for(const p of pts){ cx+=p.x; cz+=p.z; } cx/=pts.length; cz/=pts.length;
        const sp = textSprite(NM, 0.4, '#23d465');
        sp.position.set(cx, heightAt(cx,cz)+26, cz); scene.add(sp);
      }
    }
  }
  // stations: white markers + names
  for(const [name, e, n] of (GREENS.stations||[])){
    const x = e-E0, z = -(n-N0), y = heightAt(x,z);
    const m = new THREE.Mesh(new THREE.BoxGeometry(8,5,8),
      new THREE.MeshBasicMaterial({color:0xd8e4f0, wireframe:true}));
    m.position.set(x, y+3, z); scene.add(m);
    const sp = textSprite((name||'').toUpperCase(), 0.35, '#d8e4f0');
    sp.position.set(x, y+18, z); scene.add(sp);
  }
}

const rGrid = new Map();   // road segments for steering assist
/* ---------- road graph: nodes at way endpoints, A* routing, pacman cruising ---------- */
const navNodes = new Map();      // key -> {x,z,edges:[edgeIdx]}
const navEdges = [];             // {a,b,pts:[[x,z]...],len}
const nodeKey = (x,z) => (Math.round(x/14)) + ',' + (Math.round(z/14));
function navNode(x,z){
  const k = nodeKey(x,z);
  let n = navNodes.get(k);
  if(!n){ n = {x, z, edges:[]}; navNodes.set(k, n); }
  return n;
}
function buildNavGraph(){
  for(const [cls,,raw] of ROADS.roads){
    if(cls === 3) continue;                          // not the railway
    const pts = raw.map(([e,n]) => [e-E0, -(n-N0)]);
    if(pts.length < 2) continue;
    let len = 0;
    for(let i=0;i<pts.length-1;i++) len += Math.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1]);
    const a = navNode(...pts[0]), b = navNode(...pts[pts.length-1]);
    const idx = navEdges.length;
    navEdges.push({a: nodeKey(...pts[0]), b: nodeKey(...pts[pts.length-1]), pts, len});
    a.edges.push(idx); b.edges.push(idx);
  }
}
function nearestNavPoint(x, z){                      // closest point on any edge (grid-accelerated-ish)
  let best = null, bd = 1e12;
  for(let ei=0; ei<navEdges.length; ei++){
    const E2 = navEdges[ei];
    const [hx,hz] = E2.pts[0];
    if((hx-x)**2 + (hz-z)**2 > 1200*1200) continue;  // cheap prefilter
    for(let i=0;i<E2.pts.length-1;i++){
      const [x1,z1] = E2.pts[i], [x2,z2] = E2.pts[i+1];
      const dx=x2-x1, dz=z2-z1, L2=dx*dx+dz*dz||1;
      const t = Math.max(0, Math.min(1, ((x-x1)*dx+(z-z1)*dz)/L2));
      const px=x1+dx*t, pz=z1+dz*t, d=(px-x)**2+(pz-z)**2;
      if(d<bd){ bd=d; best={edge:ei, seg:i, t, x:px, z:pz, dist:Math.sqrt(d)}; }
    }
  }
  return best;
}
function aStar(fromKey, toKey){
  const open = new Map([[fromKey, 0]]), came = new Map(), g = new Map([[fromKey, 0]]);
  const H = k => { const n1 = navNodes.get(k), n2 = navNodes.get(toKey);
    return Math.hypot(n1.x-n2.x, n1.z-n2.z); };
  while(open.size){
    let cur = null, cf = 1e15;
    for(const [k,f] of open) if(f < cf){ cf = f; cur = k; }
    if(cur === toKey){
      const path = [cur];
      while(came.has(cur)){ cur = came.get(cur).node; path.unshift(cur); }
      const edges = []; let p = path[0];
      for(let i=1;i<path.length;i++){ edges.push(came.get(path[i])); p = path[i]; }
      return path.map((k,i) => ({ node:k, via: i ? came.get(k).edge : -1 }));
    }
    open.delete(cur);
    const n = navNodes.get(cur);
    for(const ei of n.edges){
      const E2 = navEdges[ei];
      const nb = E2.a === cur ? E2.b : E2.a;
      const ng = g.get(cur) + E2.len;
      if(ng < (g.get(nb) ?? 1e15)){
        g.set(nb, ng); came.set(nb, {node: cur, edge: ei});
        open.set(nb, ng + H(nb));
      }
    }
    if(g.size > 4000) break;                         // safety valve
  }
  return null;
}
function routeTo(T, tx, tz){                         // self-driving-car route: graph + off-road legs
  const from = nearestNavPoint(T.x, T.z), to = nearestNavPoint(tx, tz);
  if(!from || !to) return null;
  const path = aStar(navEdges[from.edge].a, navEdges[to.edge].a);
  const pts = [[T.x, T.z]];
  if(path && path.length > 1){
    for(const step of path){
      if(step.via < 0) continue;
      const E2 = navEdges[step.via];
      const fwd2 = nodeKey(...E2.pts[0]) !== step.node;   // orient toward step.node
      pts.push(...(fwd2 ? E2.pts : [...E2.pts].reverse()));
    }
  }
  pts.push([tx, tz]);
  return pts;
}
/* pacman cruise: pick the onward edge most aligned with travel (stick x biases the choice) */
function cruisePick(T, atKey, fromEdge){
  const n = navNodes.get(atKey); if(!n) return null;
  let best = null, bs = -1e9;
  for(const ei of n.edges){
    const E2 = navEdges[ei];
    const out = E2.a === atKey ? E2.pts : [...E2.pts].reverse();
    if(out.length < 2) continue;
    const brg = Math.atan2(out[1][0]-out[0][0], out[1][1]-out[0][1]);
    let diff = ((brg - T.heading + Math.PI*3) % (Math.PI*2)) - Math.PI;
    diff -= input.x * 1.1;                            // stick steers the junction choice
    let score = -Math.abs(diff);
    if(ei === fromEdge && n.edges.length > 1) score -= 2.2;   // avoid U-turns when possible
    if(score > bs){ bs = score; best = {edge: ei, rev: E2.a !== atKey}; }
  }
  return best;
}
/* ---------- traffic: little vector cars commuting on real roads ---------- */
const CARS_N = 64;
let carBody = null, carCabin = null;
const cars = [];
function buildTraffic(){
  if(!ROADS) return;
  const drivable = ROADS.roads.filter(([c,,p]) => (c===1||c===2||c===4||c===5) && p.length >= 5);
  if(!drivable.length) return;
  carBody = new THREE.InstancedMesh(new THREE.BoxGeometry(2.0,1.0,4.4),
    new THREE.MeshBasicMaterial({color:0x0c1812}), CARS_N);
  carCabin = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7,0.8,2.2),
    new THREE.MeshBasicMaterial({wireframe:true}), CARS_N);
  const tint = new THREE.Color();
  for(let i=0;i<CARS_N;i++){
    const way = drivable[(Math.random()*drivable.length)|0][2]
      .map(([e,n]) => [e-E0, -(n-N0)]);
    cars.push({way, seg:(Math.random()*(way.length-1))|0, t:Math.random(), dir:Math.random()<0.5?1:-1,
               speed: 7 + Math.random()*6});
    const k = ((i*2654435761)>>>0)%100;
    if(k>92) tint.setHex(0xc46a4a); else if(k>84) tint.setHex(0x5a88b8); else tint.setHSL(0.33,0.25,0.45+(k%20)/100);
    carCabin.setColorAt(i, tint);
  }
  carCabin.instanceColor.needsUpdate = true;
  scene.add(carBody, carCabin);
}
function updateTraffic(dt){
  if(!carBody) return;
  for(let i=0;i<CARS_N;i++){
    const c = cars[i];
    const [x1,z1] = c.way[c.seg], [x2,z2] = c.way[c.seg+1];
    const L = Math.hypot(x2-x1, z2-z1) || 1;
    c.t += c.dir * c.speed * dt / L;
    if(c.t > 1){ c.seg++; c.t = 0; if(c.seg >= c.way.length-1){ c.dir = -1; c.seg = c.way.length-2; c.t = 1; } }
    if(c.t < 0){ c.seg--; c.t = 1; if(c.seg < 0){ c.dir = 1; c.seg = 0; c.t = 0; } }
    const x = x1+(x2-x1)*c.t, z = z1+(z2-z1)*c.t;
    const head = Math.atan2((x2-x1)*c.dir, (z2-z1)*c.dir);
    dummy.position.set(x, heightAt(x,z)+0.8, z);
    dummy.rotation.set(0, head, 0); dummy.scale.setScalar(1);
    dummy.updateMatrix(); carBody.setMatrixAt(i, dummy.matrix);
    dummy.position.y += 0.85; dummy.position.x -= Math.sin(head)*0.5; dummy.position.z -= Math.cos(head)*0.5;
    dummy.updateMatrix(); carCabin.setMatrixAt(i, dummy.matrix);
  }
  carBody.instanceMatrix.needsUpdate = true;
  carCabin.instanceMatrix.needsUpdate = true;
}

/* ---------- people: small wireframe Bristolians going about it ---------- */
const PEOPLE_N = 140;
let pplMesh = null;
const people = [];
function buildPeople(){
  const spots = [];
  if(PUBS) for(const [,e,n] of PUBS.pubs) spots.push([e-E0, -(n-N0)]);
  if(SHOPS) for(let i=0;i<SHOPS.shops.length;i+=6) spots.push([SHOPS.shops[i][1]-E0, -(SHOPS.shops[i][2]-N0)]);
  if(!spots.length) return;
  pplMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.26, 0.95, 2, 5),
    new THREE.MeshBasicMaterial({wireframe:true, color:0xcfe2d4, transparent:true, opacity:0.85}), PEOPLE_N);
  for(let i=0;i<PEOPLE_N;i++){
    const [sx, sz] = spots[(Math.random()*spots.length)|0];
    let x = sx + (Math.random()-0.5)*60, z = sz + (Math.random()-0.5)*60, tries = 8;
    while(inBuilding(x, z) && tries--){ x = sx + (Math.random()-0.5)*60; z = sz + (Math.random()-0.5)*60; }
    people.push({x, z, dir:Math.random()*Math.PI*2, speed:0.7+Math.random()*0.9, retarget:Math.random()*4, flee:0});
  }
  scene.add(pplMesh);
}
function updatePeople(dt){
  if(!pplMesh) return;
  for(let i=0;i<people.length;i++){
    const p = people[i];
    p.retarget -= dt;
    if(p.retarget <= 0){ p.dir += (Math.random()-0.5)*2.2; p.retarget = 2+Math.random()*4; }
    for(const T of tanks){
      const d = Math.hypot(T.x-p.x, T.z-p.z);
      if(d < 16 && Math.abs(T.speed) > 4){ p.dir = Math.atan2(p.x-T.x, p.z-T.z); p.flee = 1.6; break; }
    }
    const sp = p.flee > 0 ? 4.2 : p.speed;
    p.flee -= dt;
    const nx = p.x + Math.sin(p.dir)*sp*dt, nz = p.z + Math.cos(p.dir)*sp*dt;
    if(!blocked(nx, nz) && !inWater(nx, nz)){ p.x = nx; p.z = nz; } else p.dir += 1.7;
    dummy.position.set(p.x, heightAt(p.x,p.z)+0.95 + (p.flee>0 ? Math.abs(Math.sin(performance.now()/60))*0.25 : 0), p.z);
    dummy.rotation.set(0, p.dir, 0); dummy.scale.setScalar(1);
    dummy.updateMatrix(); pplMesh.setMatrixAt(i, dummy.matrix);
  }
  pplMesh.instanceMatrix.needsUpdate = true;
}

/* ---------- shops: cyan constellation + nearby names ---------- */
let SHOPS = null;
const shopLabelPool = [];
function buildShops(){
  if(!SHOPS || !SHOPS.shops.length) return;
  const pos = [];
  for(const [, e, n] of SHOPS.shops){
    const x = e-E0, z = -(n-N0);
    pos.push(x, heightAt(x,z)+4, z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({color:CYAN, size:2.6, sizeAttenuation:true,
    transparent:true, opacity:0.5})));
  for(let i=0;i<6;i++){
    const sp = textSprite('', 0.22, '#7adcff'); sp.visible = false; sp.userData.pooled = true;
    scene.add(sp); shopLabelPool.push(sp);
  }
  setInterval(updateShopLabels, 2300);
}
function updateShopLabels(){
  if(!SHOPS || !state.running) return;
  const px = state.view==='drive' ? activeTank().x : state.map.cx;
  const pz = state.view==='drive' ? activeTank().z : state.map.cz;
  const near = [];
  for(const [name, e, n] of SHOPS.shops){
    const x = e-E0, z = -(n-N0), d = Math.hypot(x-px, z-pz);
    if(d < 200) near.push([d, name, x, z]);
  }
  near.sort((a,b)=>a[0]-b[0]);
  shopLabelPool.forEach((sp, i) => {
    if(i < near.length && (state.view==='drive' || state.map.h < 900)){
      const [, name, x, z] = near[i];
      const c = document.createElement('canvas'); c.width=512; c.height=96;
      const cx2 = c.getContext('2d'); cx2.font='700 30px ui-monospace,monospace'; cx2.textAlign='center';
      cx2.shadowColor='#7adcff'; cx2.shadowBlur=8; cx2.fillStyle='#7adcff';
      cx2.fillText('▸ ' + name.toUpperCase().slice(0,26), 256, 58);
      sp.material.map?.dispose(); sp.material.map = new THREE.CanvasTexture(c);
      sp.material.needsUpdate = true;
      sp.position.set(x, heightAt(x,z)+11, z);
      sp.visible = true;
    } else sp.visible = false;
  });
}
function roadAssist(T, dt){
  const k = (((T.x+WORLD/2)/64)|0)*100000 + (((T.z+WORLD/2)/64)|0);
  const segs = rGrid.get(k); if(!segs) return;
  let best = null, bd = 16*16;
  for(const [x1,z1,x2,z2] of segs){
    const dx = x2-x1, dz = z2-z1, L2 = dx*dx+dz*dz || 1;
    const t = THREE.MathUtils.clamp(((T.x-x1)*dx + (T.z-z1)*dz)/L2, 0, 1);
    const px = x1+dx*t - T.x, pz = z1+dz*t - T.z, d2 = px*px+pz*pz;
    if(d2 < bd){ bd = d2; best = Math.atan2(dx, dz); }
  }
  if(best === null) return;
  let diff = ((best - T.heading + Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2) - Math.PI;
  if(Math.abs(diff) > Math.PI/2) diff = diff > 0 ? diff - Math.PI : diff + Math.PI;   // roads are two-way
  if(Math.abs(diff) < 0.55) T.heading += diff * Math.min(1, dt*2.0) * 0.5;            // gentle rail
}

/* ---------- city fabric: real building footprints + neighbourhood names ---------- */
let FABRIC = null;
const CORE = { eMin: 356263, eMax: 361566, nMin: 170802, nMax: 174920 };   // extrusion tier
/* building collision: 40m hash grid in BNG space over all 104k footprints */
const bGrid = new Map();
const BCELL = 40;
let roofTops = null;          // world-y of each building's roof (for perching dragons)
let fabricEdgesMat = null;
function buildCollisionGrid(){
  if(!FABRIC) return;
  FABRIC.buildings.forEach((entry, idx) => {
    const ring = Array.isArray(entry[1]) ? entry[1] : entry;
    let eMin=1e9,eMax=-1e9,nMin=1e9,nMax=-1e9;
    for(const [e,n] of ring){ if(e<eMin)eMin=e; if(e>eMax)eMax=e; if(n<nMin)nMin=n; if(n>nMax)nMax=n; }
    for(let ce=(eMin/BCELL)|0; ce<=(eMax/BCELL)|0; ce++)
      for(let cn=(nMin/BCELL)|0; cn<=(nMax/BCELL)|0; cn++){
        const k = ce*100000+cn;
        let a = bGrid.get(k); if(!a){ a=[]; bGrid.set(k,a); }
        a.push(idx);
      }
  });
}
function inBuildingIdx(x, z){
  const e = x + E0, n = -z + N0;
  const a = bGrid.get(((e/BCELL)|0)*100000 + ((n/BCELL)|0));
  if(!a) return -1;
  for(const idx of a){
    const entry = FABRIC.buildings[idx];
    const ring = Array.isArray(entry[1]) ? entry[1] : entry;
    let inside = false;
    for(let i=0, j=ring.length-1; i<ring.length; j=i++){
      const [xi,yi]=ring[i], [xj,yj]=ring[j];
      if((yi>n)!==(yj>n) && e < (xj-xi)*(n-yi)/(yj-yi)+xi) inside = !inside;
    }
    if(inside) return idx;
  }
  return -1;
}
function inBuilding(x, z){ return inBuildingIdx(x, z) >= 0; }
function nearRoad(x, z, r=8){
  const k = (((x+WORLD/2)/64)|0)*100000 + (((z+WORLD/2)/64)|0);
  const segs = rGrid.get(k); if(!segs) return false;
  for(const [x1,z1,x2,z2] of segs){
    const dx=x2-x1, dz=z2-z1, L2=dx*dx+dz*dz||1;
    const t = Math.max(0, Math.min(1, ((x-x1)*dx+(z-z1)*dz)/L2));
    if(((x1+dx*t-x)**2 + (z1+dz*t-z)**2) < r*r) return true;
  }
  return false;
}
/* a building straddling a road is a data-vs-reality clash: the road wins */
function blocked(x, z){ return inBuilding(x, z) && !nearRoad(x, z); }
function buildFabric(){
  if(!FABRIC) return;
  const lite = new URLSearchParams(location.search).has('lite');
  const walls = [], roofs = [], edges = [], outer = [], roofSlate = [], roofTile = [];
  roofTops = new Float32Array(FABRIC.buildings.length);
  let bi = 0;
  const TYPE_H = [0, 7.5, 14, 12, 8.5, 15, 14];     // by derive typeCode; 0 = unknown
  for(const entry of FABRIC.buildings){
    const h0 = Array.isArray(entry[1]) ? entry[0] : 0;
    const ring = Array.isArray(entry[1]) ? entry[1] : entry;
    const btype = Array.isArray(entry[1]) ? (entry[2]|0) : 0;
    bi++;
    const [e0r, n0r] = ring[0];
    const core = e0r >= CORE.eMin && e0r <= CORE.eMax && n0r >= CORE.nMin && n0r <= CORE.nMax;
    const x0 = e0r-E0, z0 = -(n0r-N0);
    const base = heightAt(x0, z0) + 0.2;
    const guess = TYPE_H[btype] || 6;
    const h = Math.min(42, h0 > 0 ? h0 : guess + ((bi*2654435761)>>>0)%30/10);  // OSM height, else type heuristic
    const top = base + h;
    roofTops[bi-1] = top;
    if(!core){                                       // city-wide tier: rooflines at true height
      if(lite) continue;
      for(let i=0;i<ring.length;i++){
        const [e1,n1] = ring[i], [e2,n2] = ring[(i+1)%ring.length];
        outer.push(e1-E0, top, -(n1-N0), e2-E0, top, -(n2-N0));
      }
      continue;
    }
    const pts2 = ring.map(([e,n]) => new THREE.Vector2(e-E0, n-N0));
    for(let i=0;i<ring.length;i++){
      const a = pts2[i], b = pts2[(i+1)%ring.length];
      const ax=a.x, az=-a.y, bx=b.x, bz=-b.y;
      walls.push(ax,base,az, bx,base,bz, bx,top,bz,  ax,base,az, bx,top,bz, ax,top,az);
      edges.push(ax,top,az, bx,top,bz);                               // roof outline
    }
    const pitched = (btype === 1 || btype === 2) && ring.length <= 8;
    if(pitched){                                                      // hip roof: eaves fan to raised apex
      let cx2=0, cz2=0; for(const p of pts2){ cx2+=p.x/pts2.length; cz2+=p.y/pts2.length; }
      const apex = top + 2.2 + Math.min(3, h*0.18);
      const bucket = ((bi*7) % 10) < 6 ? roofSlate : roofTile;        // slate vs pantile guesstimate
      for(let i=0;i<pts2.length;i++){
        const a = pts2[i], b2 = pts2[(i+1)%pts2.length];
        bucket.push(a.x,top,-a.y, b2.x,top,-b2.y, cx2,apex,-cz2);
        edges.push(a.x,top,-a.y, cx2,apex,-cz2);                      // hip lines read as vector hatching
      }
    } else try{                                                       // flat roof fill
      const tris = THREE.ShapeUtils.triangulateShape(pts2, []);
      for(const [i1,i2,i3] of tris){
        roofs.push(pts2[i1].x,top,-pts2[i1].y, pts2[i2].x,top,-pts2[i2].y, pts2[i3].x,top,-pts2[i3].y);
      }
    }catch(e){}
  }
  if(outer.length){
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(outer, 3));
    scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({color:0x2da55e, transparent:true, opacity:0.45})));
  }
  const mk = (arr) => { const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return g; };
  scene.add(new THREE.Mesh(mk(walls), new THREE.MeshBasicMaterial({color:0x0c1812, side:THREE.DoubleSide, transparent:true, opacity:0.85})));
  scene.add(new THREE.Mesh(mk(roofs), new THREE.MeshBasicMaterial({color:0x101c16})));       // flat commercial: tar
  if(roofSlate.length) scene.add(new THREE.Mesh(mk(roofSlate), new THREE.MeshBasicMaterial({color:0x1c2a33})));  // welsh slate blue
  if(roofTile.length)  scene.add(new THREE.Mesh(mk(roofTile),  new THREE.MeshBasicMaterial({color:0x33231a})));  // pantile clay
  fabricEdgesMat = new THREE.LineBasicMaterial({color:0x46d97f, transparent:true, opacity:0.8});
  scene.add(new THREE.LineSegments(mk(edges), fabricEdgesMat));
  // built-density tint on the terrain grid: urban form survives any zoom level
  if(gridMesh){
    const cols = ELEV.cols, cell = WORLD/(cols-1);
    const density = new Float32Array(cols*cols);
    for(const entry of FABRIC.buildings){
      const ring = Array.isArray(entry[1]) ? entry[1] : entry;
      const c = ((ring[0][0]-E0 + WORLD/2)/cell)|0, r = ((-(ring[0][1]-N0) + WORLD/2)/cell)|0;
      if(c>=0 && c<cols && r>=0 && r<cols) density[r*cols+c]++;
    }
    const colAttr = gridMesh.geometry.attributes.color;
    const dense = new THREE.Color(0x8fe87f), cur = new THREE.Color();
    const pos = gridMesh.geometry.attributes.position;
    for(let i=0;i<colAttr.count;i++){
      const c = ((pos.getX(i) + WORLD/2)/cell)|0, r = ((pos.getZ(i) + WORLD/2)/cell)|0;
      const d = density[r*cols+c] || 0;
      if(d > 1){
        cur.setRGB(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i));
        cur.lerp(dense, Math.min(1, d/16) * 0.6);
        colAttr.setXYZ(i, cur.r, cur.g, cur.b);
      }
    }
    colAttr.needsUpdate = true;
  }
  // neighbourhood names: short, dim, everywhere — the labels that say Bristol
  for(const [name, e, n] of (FABRIC.places||[])){
    if(!name) continue;
    const x = e-E0, z = -(n-N0);
    const sp = textSprite(name.toUpperCase(), 0.34, '#8fe8b0');
    sp.position.set(x, heightAt(x,z)+30, z);
    scene.add(sp);
  }
}

/* ---------- the pubs: amber constellation + nearby names ---------- */
let PUBS = null;
const pubLabelPool = [];
function buildPubs(){
  if(!PUBS || !PUBS.pubs.length) return;
  const pos = [];
  for(const [, e, n] of PUBS.pubs){
    const x = e-E0, z = -(n-N0);
    pos.push(x, heightAt(x,z)+5, z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({color:AMBER, size:4.5, sizeAttenuation:true,
    transparent:true, opacity:0.85})));
  for(let i=0;i<8;i++){
    const sp = textSprite('', 0.28, '#ffb000'); sp.visible = false; sp.userData.pooled = true;
    scene.add(sp); pubLabelPool.push(sp);
  }
  setInterval(updatePubLabels, 2000);
}
function updatePubLabels(){
  if(!PUBS || !state.running) return;
  const px = state.view==='drive' ? activeTank().x : state.map.cx;
  const pz = state.view==='drive' ? activeTank().z : state.map.cz;
  const R = state.view==='drive' ? 420 : state.map.h*0.5;
  const near = [];
  for(const [name, e, n] of PUBS.pubs){
    const x = e-E0, z = -(n-N0), d = Math.hypot(x-px, z-pz);
    if(d < R) near.push([d, name, x, z]);
  }
  near.sort((a,b)=>a[0]-b[0]);
  pubLabelPool.forEach((sp, i) => {
    if(i < near.length && (state.view==='drive' || state.map.h < 1600)){
      const [, name, x, z] = near[i];
      const c = document.createElement('canvas'); c.width=512; c.height=96;
      const cx2 = c.getContext('2d'); cx2.font='700 34px ui-monospace,monospace'; cx2.textAlign='center';
      cx2.shadowColor='#ffb000'; cx2.shadowBlur=10; cx2.fillStyle='#ffb000';
      cx2.fillText('◆ ' + name.toUpperCase().slice(0,24), 256, 58);
      sp.material.map?.dispose(); sp.material.map = new THREE.CanvasTexture(c);
      sp.material.needsUpdate = true;
      sp.position.set(x, heightAt(x,z)+16, z);
      sp.visible = true;
    } else sp.visible = false;
  });
}

/* ---------- the real roads (OSM, cached in-repo) ---------- */
let ROADS = null;
const FAMOUS = ['M32','A4','A38','A370','A4018','A420','A4044','PARK STREET','WHITELADIES ROAD',
  'GLOUCESTER ROAD','QUEENS ROAD',"QUEEN'S ROAD",'TEMPLE WAY','HOTWELL ROAD','CORONATION ROAD','PORTWAY',
  'STOKES CROFT','CHELTENHAM ROAD','NORTH STREET','EAST STREET','BALDWIN STREET','VICTORIA STREET',
  'PARK ROW','COLLEGE GREEN','ANCHOR ROAD','WELLS ROAD','CHURCH ROAD','STAPLETON ROAD','FISHPONDS ROAD'];
const SHORTEN = [[' STREET',' ST'],[' ROAD',' RD'],[' AVENUE',' AVE'],[' LANE',' LN']];
const shortName = n => SHORTEN.reduce((a,[f,t]) => a.replace(f,t), n);
function buildRoads(){
  if(!ROADS) return;
  const styles = [
    {color:AMBER, opacity:1.0},   // motorway/trunk (also ribboned)
    {color:PHOS,  opacity:1.0},   // primary (also ribboned)
    {color:PHOS,  opacity:0.5},   // secondary
    {color:0xd0d8e8, opacity:0.8}, // rail (dashed)
    {color:PHOS,  opacity:0.28},   // tertiary
    {color:PHOS,  opacity:0.14},   // residential: the street grid itself
  ];
  const buckets = [[],[],[],[],[],[]];
  const ribbons = [[],[]];                       // quad strips for cls 0/1
  const RIBW = [13, 8];
  const labelBest = new Map();   // label -> {len, mid}
  for(const [cls, label, pts] of ROADS.roads){
    const b = buckets[cls];
    let length = 0;
    for(let i=0;i<pts.length-1;i++){
      const [e1,n1] = pts[i], [e2,n2] = pts[i+1];
      const x1=e1-E0, z1=-(n1-N0), x2=e2-E0, z2=-(n2-N0);
      const y1 = heightAt(x1,z1)+1.4, y2 = heightAt(x2,z2)+1.4;
      b.push(x1, y1, z1, x2, y2, z2);
      length += Math.hypot(e2-e1, n2-n1);
      if(cls <= 1){                                          // ribbon quad
        const dx=x2-x1, dz=z2-z1, L=Math.hypot(dx,dz)||1;
        const px=-dz/L*RIBW[cls]/2, pz=dx/L*RIBW[cls]/2, R=ribbons[cls];
        R.push(x1+px,y1-0.35,z1+pz, x2+px,y2-0.35,z2+pz, x2-px,y2-0.35,z2-pz,
               x1+px,y1-0.35,z1+pz, x2-px,y2-0.35,z2-pz, x1-px,y1-0.35,z1-pz);
      }
    }
    const L = (label||'').toUpperCase();
    if(L && FAMOUS.some(f => L === f || L.startsWith(f+' ') || L.includes(f))){
      const key = FAMOUS.find(f => L === f || L.startsWith(f+' ') || L.includes(f));
      const cur = labelBest.get(key);
      if(!cur || length > cur.len){
        const mid = pts[(pts.length/2)|0];
        labelBest.set(key, {len: length, e: mid[0], n: mid[1]});
      }
    }
  }
  buckets.forEach((b, cls)=>{
    if(!b.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b, 3));
    const seg = new THREE.LineSegments(g, cls === 3
      ? new THREE.LineDashedMaterial({color:styles[cls].color, transparent:true, opacity:styles[cls].opacity,
          dashSize:30, gapSize:20})
      : new THREE.LineBasicMaterial({color:styles[cls].color, transparent:true, opacity:styles[cls].opacity}));
    if(cls === 3) seg.computeLineDistances();
    scene.add(seg);
  });
  // steering-assist grid: drivable segments hashed by 64m cell
  for(const [cls,,pts] of ROADS.roads){
    if(cls === 3) continue;                       // not the railway, thanks
    for(let i=0;i<pts.length-1;i++){
      const x1=pts[i][0]-E0, z1=-(pts[i][1]-N0), x2=pts[i+1][0]-E0, z2=-(pts[i+1][1]-N0);
      const k = (((x1+WORLD/2)/64)|0)*100000 + (((z1+WORLD/2)/64)|0);
      let a = rGrid.get(k); if(!a){ a=[]; rGrid.set(k,a); }
      a.push([x1,z1,x2,z2]);
    }
  }
  ribbons.forEach((R, cls)=>{
    if(!R.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(R, 3));
    scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial(
      {color:styles[cls].color, transparent:true, opacity:0.22, depthWrite:false, side:THREE.DoubleSide})));
  });
  for(const [name, v] of labelBest){
    const x = v.e-E0, z = -(v.n-N0);
    const sp = textSprite(shortName(name), 0.42, name.match(/^[MA][0-9]/) ? '#ffb000' : '#39c98a');
    sp.position.set(x, heightAt(x,z)+34, z);
    scene.add(sp);
  }
}

/* ---------- Clifton Suspension Bridge: drivable ---------- */
let bridge = null;
function buildBridge(){
  const cx = 356794-E0, cz = -(173017-N0);                 // span centre
  const ux = Math.sin(1.31), uz = Math.cos(1.31)* -1;      // ~ENE axis in world (x east, z south)
  const HALF = 107;                                        // tower-to-centre
  const tE = {x: cx+ux*HALF, z: cz+uz*HALF}, tW = {x: cx-ux*HALF, z: cz-uz*HALF};
  const deckY = (heightAt(tE.x,tE.z) + heightAt(tW.x,tW.z)) / 2 + 2;
  const g = new THREE.Group();
  // deck
  const deck = vectorize(new THREE.BoxGeometry(9, 2.4, HALF*2+34), PHOS);
  deck.position.set(cx, deckY-1.2, cz); deck.rotation.y = Math.atan2(ux, uz); g.add(deck);
  // towers (the twin pierced towers, as wireframe)
  for(const t of [tE, tW]){
    const tw = vectorize(new THREE.BoxGeometry(10, 42, 7), PHOS);
    tw.position.set(t.x, deckY+15, t.z); tw.rotation.y = Math.atan2(ux, uz); g.add(tw);
  }
  // chains: two catenaries per side + hangers
  const chainH = 34, STEPS = 26;
  for(const side of [-1, 1]){
    const off = {x: -uz*side*4.2, z: ux*side*4.2};
    const pts = [], hang = [];
    for(let i=0;i<=STEPS;i++){
      const t = i/STEPS, a = (t-0.5)*2;                    // -1..1
      const x = cx + ux*(a*HALF) + off.x, z = cz + uz*(a*HALF) + off.z;
      const y = deckY + 36 - (1-a*a)*chainH;               // tower-top to mid-dip
      pts.push(new THREE.Vector3(x, y, z));
      if(i%2===0 && y > deckY+1){ hang.push(x, y, z, x, deckY, z); }
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({color:PHOS})));
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(hang, 3));
    g.add(new THREE.LineSegments(hg, new THREE.LineBasicMaterial({color:PHOS, transparent:true, opacity:0.5})));
  }
  scene.add(g);
  bridge = {cx, cz, ux, uz, half: HALF+17, width: 5.5, y: deckY};
}
function bridgeDeckY(x, z){
  if(!bridge) return null;
  const dx = x-bridge.cx, dz = z-bridge.cz;
  const along = dx*bridge.ux + dz*bridge.uz;
  const across = -dx*bridge.uz + dz*bridge.ux;
  return (Math.abs(along) <= bridge.half && Math.abs(across) <= bridge.width) ? bridge.y : null;
}

/* ---------- landmarks: vector beacons ---------- */
const LANDMARKS = [
  ['CLIFTON SUSPENSION BRIDGE', 356790, 173020], ['CABOT TOWER', 358290, 172730],
  ['TEMPLE MEADS', 360060, 172370], ['QUEEN SQUARE', 358950, 172850],
  ['CATHEDRAL', 358695, 172694], ['ASHTON COURT', 355560, 172140],
  ['SS GREAT BRITAIN', 358144, 172427], ['WILLS MEMORIAL', 358498, 173150],
  ['ST MARY REDCLIFFE', 360131, 172371], ['CASTLE PARK', 359572, 173073],
  ['THE DOWNS', 357642, 174308], ['PURDOWN BT TOWER', 361495, 175788],
  ['ARNOLFINI', 358886, 172394], ['M SHED', 358936, 172227], ['WATERSHED', 358851, 172538],
  ['THEKLA', 359297, 172316], ['BRISTOL OLD VIC', 359233, 172683],
  ['CHRISTMAS STEPS', 358985, 173084], ['CABOT CIRCUS', 359968, 173495],
  ['STOKES CROFT MURAL', 359395, 173818], ['THE OBSERVATORY', 356666, 173095],
  ['ASHTON GATE', 357309, 171359],
];
function textSprite(msg, scale=1, col='#00ff66'){
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const x = c.getContext('2d');
  x.font = '700 40px ui-monospace,Menlo,monospace'; x.textAlign='center';
  x.shadowColor = col; x.shadowBlur = 14; x.fillStyle = col;
  x.fillText(msg, 256, 60);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c), transparent:true, depthWrite:false, depthTest:false}));
  s.scale.set(230*scale, 43*scale, 1);
  s.layers.set(1);                      // label layer: rendered crisp, after the film pass
  labelSprites.push(s);
  return s;
}
const labelSprites = [];
/* Council Control: the comms mast at Cabot Tower; fleet orders are radioed from here */
const CONTROL = { x: 358290-E0, z: -(172730-N0) };
let controlBeacon;
const transmissions = [];
function buildControl(){
  // Council Control IS Cabot Tower: a small antenna + beacon on the real landmark, no second tower
  const y = heightAt(CONTROL.x, CONTROL.z);
  const aerial = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 9, 4),
    new THREE.MeshBasicMaterial({color:AMBER, wireframe:true, transparent:true, opacity:0.8}));
  aerial.position.set(CONTROL.x, y+43, CONTROL.z); scene.add(aerial);
  controlBeacon = new THREE.Mesh(new THREE.OctahedronGeometry(1.2),
    new THREE.MeshBasicMaterial({color:AMBER}));
  controlBeacon.position.set(CONTROL.x, y+49, CONTROL.z); scene.add(controlBeacon);
  const s2 = textSprite('· CONTROL ·', 0.32, '#ffb000'); s2.position.set(CONTROL.x, y+58, CONTROL.z); scene.add(s2);
}
function orderCode(){
  const hex = () => '0123456789ABCDEF'[(Math.random()*16)|0];
  return hex()+hex()+' '+hex()+hex();
}
function transmit(tank, label){
  const code = orderCode();
  feed('>> TX ' + tank.name + ' :: ' + code + ' ' + label);
  sfx.databurst();
  const from = new THREE.Vector3(CONTROL.x, heightAt(CONTROL.x,CONTROL.z)+48, CONTROL.z);
  const pip = new THREE.Mesh(new THREE.OctahedronGeometry(1.6),
    new THREE.MeshBasicMaterial({color:AMBER, depthTest:false, transparent:true}));
  pip.renderOrder = 10; pip.position.copy(from); scene.add(pip);
  transmissions.push({pip, from, tank, t:0});
}
function updateTransmissions(dt){
  for(let i=transmissions.length-1;i>=0;i--){
    const tx = transmissions[i]; tx.t += dt*1.3;
    if(tx.t >= 1){
      scene.remove(tx.pip);
      burst(new THREE.Vector3(tx.tank.x, heightAt(tx.tank.x,tx.tank.z)+8, tx.tank.z), 10, AMBER, 10, 8);
      feed('>> ' + tx.tank.name + ' ACK');
      sfx.ack();
      transmissions.splice(i,1); continue;
    }
    const to = new THREE.Vector3(tx.tank.x, heightAt(tx.tank.x,tx.tank.z)+10, tx.tank.z);
    tx.pip.position.lerpVectors(tx.from, to, tx.t);
    tx.pip.position.y += Math.sin(tx.t*Math.PI)*60;   // ballistic radio arc, obviously
    tx.pip.rotation.y += dt*8;
    tx.pip.scale.setScalar(1 + Math.sin(tx.t*40)*0.3);
  }
}
function landmarkModel(name, x, y, z){
  const g = new THREE.Group(); g.position.set(x, y, z);
  const add = (geo, px, py, pz, ry=0) => { const m = vectorize(geo, PHOS); m.position.set(px,py,pz); m.rotation.y = ry; g.add(m); return m; };
  switch(name){
    case 'CABOT TOWER':                                   // slim red-stone tower, 32m
      add(new THREE.BoxGeometry(7,32,7), 0,16,0);
      add(new THREE.ConeGeometry(4.4,7,4), 0,35,0, Math.PI/4);
      break;
    case 'WILLS MEMORIAL':                                // the great gothic tower, 65m
      add(new THREE.BoxGeometry(14,58,14), 0,29,0);
      for(const [cx,cz] of [[-6,-6],[6,-6],[-6,6],[6,6]]) add(new THREE.ConeGeometry(2,12,4), cx,64,cz);
      add(new THREE.BoxGeometry(10,8,10), 0,61,0);
      break;
    case 'ST MARY REDCLIFFE':                             // tower + England's-finest spire
      add(new THREE.BoxGeometry(9,28,9), 0,14,0);
      add(new THREE.ConeGeometry(5,46,8), 0,51,0);
      add(new THREE.BoxGeometry(28,12,9), 12,6,0);        // nave
      break;
    case 'CATHEDRAL':                                     // twin west towers
      add(new THREE.BoxGeometry(8,30,8), -7,15,0);
      add(new THREE.BoxGeometry(8,30,8),  7,15,0);
      add(new THREE.BoxGeometry(34,14,10), 0,7,14);       // nave
      break;
    case 'TEMPLE MEADS':{                                 // Brunel's shed + clock tower
      const shed = vectorize(new THREE.CylinderGeometry(13,13,52,10,1,true,0,Math.PI), PHOS, 0.8);
      shed.rotation.z = Math.PI/2; shed.rotation.x = Math.PI/2; shed.position.y = 6; g.add(shed);
      add(new THREE.BoxGeometry(8,26,8), 30,13,0);
      add(new THREE.ConeGeometry(5.5,9,4), 30,30,0, Math.PI/4);
      break;
    }
    case 'SS GREAT BRITAIN':{                             // iron hull + six masts
      add(new THREE.BoxGeometry(7,5,42), 0,3,0);
      for(let i=0;i<6;i++){
        const m = vectorize(new THREE.CylinderGeometry(0.25,0.35,22,4), PHOS, 0.8);
        m.position.set(0, 14, -17+i*7); g.add(m);
        const yard = vectorize(new THREE.BoxGeometry(8,0.4,0.4), PHOS, 0.6);
        yard.position.set(0, 18, -17+i*7); g.add(yard);
      }
      break;
    }
    case 'PURDOWN BT TOWER':                              // the concrete one everyone sees
      add(new THREE.CylinderGeometry(2.4,3.2,68,6), 0,34,0);
      add(new THREE.BoxGeometry(9,4,9), 0,52,0);
      add(new THREE.BoxGeometry(7,3,7), 0,60,0);
      break;
    case 'CABOT CIRCUS': break;
    default:                                              // area landmarks keep a modest beacon
      add(new THREE.CylinderGeometry(0.8,0.8,40,4), 0,20,0).children?.[0];
      break;
  }
  scene.add(g);
}
function buildLandmarks(){
  for(const [name,e,n] of LANDMARKS){
    if(name === 'CLIFTON SUSPENSION BRIDGE'){             // the bridge IS its own model
      const x=e-E0, z=-(n-N0);
      const sp = textSprite(name, 0.9); sp.position.set(x, heightAt(x,z)+96, z); scene.add(sp);
      continue;
    }
    const x=e-E0, z=-(n-N0), y=heightAt(x,z);
    const tall = ['WILLS MEMORIAL','PURDOWN BT TOWER','ST MARY REDCLIFFE'].includes(name) ? 86 : 56;
    const sp = textSprite(name, 0.8); sp.position.set(x, y+tall, z); scene.add(sp);
    landmarkModel(name, x, y, z);
  }
}

/* ---------- the fleet ---------- */
const TANK_NAMES = ['BRUNEL','CABOT','BANKSY'];
const TANK_SPAWNS = [[357300,175500,0.56],[356900,173400,1.2],[359200,172600,-0.6]]; // Downs / Clifton / Queen Sq-ish
const tanks = [];
class Tank {
  constructor(name, e, n, heading){
    this.name = name; this.x = e-E0; this.z = -(n-N0); this.heading = heading;
    this.speed = 0; this.cool = 0; this.waypoint = null;
    this.g = new THREE.Group();
    // BigTrak silhouette: low rear deck + long sloped nose wedge + ribbed flanks
    const deck = vectorize(new THREE.BoxGeometry(4.2,1.7,3.4), PHOS); deck.position.set(0,1.6,-1.6); this.g.add(deck);
    const nose = vectorize(new THREE.BoxGeometry(3.6,1.1,4.2), PHOS);
    nose.position.set(0,1.35,1.6); nose.rotation.x = 0.18; this.g.add(nose);
    for(const sx of [-1,1]){
      const tr = vectorize(new THREE.BoxGeometry(1.2,1.4,6.6), PHOS, 0.7);
      tr.position.set(sx*2.5, 0.85, -0.2); this.g.add(tr);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22,6,5), new THREE.MeshBasicMaterial({color:0xffffff}));
      lamp.position.set(sx*1.1, 1.45, 3.7); this.g.add(lamp);   // headlights
    }
    // the keypad: BigTrak's soul, as a glowing sprite on the rear deck
    const kp = document.createElement('canvas'); kp.width = 96; kp.height = 128;
    const kx = kp.getContext('2d'); kx.fillStyle = '#021006'; kx.fillRect(0,0,96,128);
    for(let r=0;r<4;r++) for(let c=0;c<3;c++){
      kx.fillStyle = (r===3&&c===1) ? '#ffb000' : '#00ff66';
      kx.shadowColor = kx.fillStyle; kx.shadowBlur = 6;
      kx.fillRect(10+c*28, 8+r*30, 20, 22);
    }
    const keypad = new THREE.Mesh(new THREE.PlaneGeometry(1.9,2.5),
      new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(kp)}));
    keypad.rotation.x = -Math.PI/2 + 0.12; keypad.position.set(0, 2.5, -1.7); this.g.add(keypad);
    this.turret = new THREE.Group(); this.turret.position.set(0, 2.6, -0.6); this.g.add(this.turret);
    this.turret.add(vectorize(new THREE.CylinderGeometry(1.2,1.4,0.9,8), PHOS));
    const barrel = vectorize(new THREE.CylinderGeometry(0.22,0.3,5.2,6), PHOS);
    barrel.rotation.x = Math.PI/2; barrel.position.set(0,0.2,2.8); this.turret.add(barrel);
    this.tag = textSprite(name, 0.12); this.tag.position.y = 5.6; this.g.add(this.tag);
    /* HELI conversion kit: mast, main rotor, tail boom + rotor */
    this.heli = new THREE.Group();
    const mast = vectorize(new THREE.CylinderGeometry(0.25,0.35,1.6,5), PHOS); mast.position.set(0,3.6,-0.6); this.heli.add(mast);
    this.rotor = new THREE.Group(); this.rotor.position.set(0,4.5,-0.6);
    for(const a of [0, Math.PI/2]){
      const blade = vectorize(new THREE.BoxGeometry(0.4,0.08,11), PHOS, 0.9);
      blade.rotation.y = a; this.rotor.add(blade);
    }
    this.heli.add(this.rotor);
    const boom = vectorize(new THREE.CylinderGeometry(0.3,0.18,4.6,5), PHOS);
    boom.rotation.x = Math.PI/2; boom.position.set(0,2.6,-4.6); this.heli.add(boom);
    this.tailRotor = new THREE.Group(); this.tailRotor.position.set(0.4,2.6,-6.7);
    const tb = vectorize(new THREE.BoxGeometry(0.06,2.2,0.3), PHOS, 0.9); this.tailRotor.add(tb);
    this.heli.add(this.tailRotor);
    this.heli.visible = false; this.g.add(this.heli);
    /* BOAT conversion kit: vee hull + little mast */
    this.boat = new THREE.Group();
    const bow = vectorize(new THREE.ConeGeometry(2.2,3.4,4), CYAN);
    bow.rotation.x = Math.PI/2; bow.rotation.z = Math.PI/4; bow.position.set(0,0.9,4.6); this.boat.add(bow);
    const keel = vectorize(new THREE.BoxGeometry(3.6,1.2,6.6), CYAN, 0.8); keel.position.set(0,0.3,0); this.boat.add(keel);
    const mast2 = vectorize(new THREE.CylinderGeometry(0.1,0.1,3.4,4), CYAN, 0.8); mast2.position.set(0,3.4,-1.4); this.boat.add(mast2);
    this.boat.visible = false; this.g.add(this.boat);
    this.mode = 'tank'; this.modeT = 1; this.vy = 0; this.alt = 0;
    this.turret.scale.setScalar(0.7);              // the gun is not the point
    this.g.scale.setScalar(1.5);
    // map blip: flat triangle, always visible, scaled with map zoom
    this.blip = new THREE.Mesh(new THREE.ConeGeometry(1, 2.6, 3),
      new THREE.MeshBasicMaterial({color:PHOS, depthTest:false, transparent:true, opacity:0.95}));
    this.blip.rotation.x = -Math.PI/2; this.blip.renderOrder = 9; this.blip.visible = false;
    scene.add(this.g, this.blip);
  }
}

/* ---------- dragons ---------- */
const QUIPS = ['NOM NOM NOM','FREE SALAD','LOCALLY SOURCED','5★ WOULD MUNCH','CRUNCHY 10/10','DO YOU MIND?!','ORGANIC, NICE'];
const PERCHQUIPS = ['NICE ROOF','GOOD VANTAGE','I CAN SEE MY NEST','OOH, SLATE'];
const POPLINES = ['RUDE!','OUCH','I WAS EATING THAT','UN-BE-LEAF-ABLE','CONKERED…','BAH!'];
const dragons = [];
function makeDragon(){
  const g = new THREE.Group();
  const hide = 0x4a141f;                                          // ember hide: reads at any distance
  const vect = (geo) => { const grp = new THREE.Group();
    grp.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color:hide})));
    grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({color:0xff3050, transparent:true, opacity:1.0})));
    return grp; };
  // body: deep keeled chest
  const body = vect(new THREE.CylinderGeometry(1.6, 2.6, 9, 7));
  body.rotation.x = Math.PI/2; g.add(body);
  // serpentine neck: three tapering segments to a horned head
  const neck = new THREE.Group(); neck.position.set(0, 0.6, 4.2); g.add(neck);
  let np = neck;
  for(let i=0;i<3;i++){
    const seg = new THREE.Group();
    const bone = vect(new THREE.CylinderGeometry(1.1-i*0.25, 1.35-i*0.25, 2.6, 6));
    bone.rotation.x = Math.PI/2; bone.position.z = 1.3; seg.add(bone);
    seg.position.z = i ? 2.5 : 0; seg.rotation.x = -0.18;
    np.add(seg); np = seg;
  }
  const head = new THREE.Group(); head.position.z = 2.6; np.add(head);
  head.add(vect(new THREE.BoxGeometry(1.5, 1.1, 3.2)));           // skull
  const jaw = vect(new THREE.BoxGeometry(1.2, 0.4, 2.6)); jaw.position.set(0,-0.7,0.5); head.add(jaw);
  for(const sx of [-1,1]){
    const horn = vect(new THREE.ConeGeometry(0.28, 1.8, 5));
    horn.position.set(sx*0.6, 0.8, -1.1); horn.rotation.x = -0.7; head.add(horn);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5),
      new THREE.MeshBasicMaterial({color:0xff2222}));
    eye.position.set(sx*0.55, 0.25, 0.9); head.add(eye);
  }
  g.userData.neck = neck; g.userData.jaw = jaw;
  // two-segment wings with membranes
  for(const sx of [-1,1]){
    const shoulder = new THREE.Group(); shoulder.position.set(sx*1.8, 1.1, 1.2); g.add(shoulder);
    const inner = vect(new THREE.BoxGeometry(5.2, 0.35, 0.6)); inner.position.x = sx*2.6; shoulder.add(inner);
    const elbow = new THREE.Group(); elbow.position.x = sx*5.2; shoulder.add(elbow);
    const outer = vect(new THREE.BoxGeometry(6.4, 0.28, 0.45)); outer.position.x = sx*3.2; elbow.add(outer);
    const mem = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.5, 5, 3),
      new THREE.MeshBasicMaterial({color:0x802038, transparent:true, opacity:0.5, side:THREE.DoubleSide}));
    mem.position.set(sx*4.6, -0.2, -2.6); shoulder.add(mem);
    g.userData[sx<0?'memL':'memR'] = mem;
    for(let r2=0;r2<3;r2++){                                       // membrane finger-ribs
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08, 5.2, 3),
        new THREE.MeshBasicMaterial({color:AMBER, transparent:true, opacity:0.85}));
      rib.rotation.z = Math.PI/2; rib.rotation.y = (r2-1)*0.35;
      rib.position.set(sx*4.6, -0.1, -1.2 - r2*1.5); shoulder.add(rib);
    }
    const claw = vect(new THREE.ConeGeometry(0.22, 1.1, 4));       // elbow claw
    claw.rotation.z = sx*-1.4; claw.position.set(sx*0.4, 0.4, 0); elbow.add(claw);
    g.userData[sx<0?'wingL':'wingR'] = shoulder;
    g.userData[sx<0?'elbowL':'elbowR'] = elbow;
  }
  // tail: three swaying segments with a barb
  const tail = new THREE.Group(); tail.position.set(0, 0.2, -4.4); g.add(tail);
  let tp = tail;
  for(let i=0;i<3;i++){
    const seg = new THREE.Group();
    const bone = vect(new THREE.CylinderGeometry(0.9-i*0.25, 1.1-i*0.25, 3.2, 6));
    bone.rotation.x = Math.PI/2; bone.position.z = -1.6; seg.add(bone);
    seg.position.z = i ? -3.1 : 0;
    tp.add(seg); tp = seg;
  }
  const barb = vect(new THREE.ConeGeometry(0.5, 1.6, 4)); barb.rotation.x = Math.PI/2; barb.position.z = -3.4; tp.add(barb);
  g.userData.tail = tail;
  // accent extremities: amber-edged
  const vectA = (geo) => { const grp = new THREE.Group();
    grp.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color:hide})));
    grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({color:AMBER, transparent:true, opacity:0.9})));
    return grp; };
  // spinal ridge: five plates down the back
  for(let i=0;i<5;i++){
    const plate = vectA(new THREE.ConeGeometry(0.4, 1.1 - i*0.12, 4));
    plate.position.set(0, 1.6, 3.0 - i*1.7); g.add(plate);
  }
  // chest banding: scale rings
  for(let i=0;i<3;i++){
    const band = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.CylinderGeometry(2.1+i*0.15, 2.3+i*0.15, 0.06, 9)),
      new THREE.LineBasicMaterial({color:ENEMY, transparent:true, opacity:0.35}));
    band.rotation.x = Math.PI/2; band.position.set(0, -0.2, 1.6 - i*1.5); g.add(band);
  }
  // hind legs, tucked for flight
  for(const sx of [-1,1]){
    const hip = new THREE.Group(); hip.position.set(sx*1.5, -1.2, -2.4); hip.rotation.x = 0.9; g.add(hip);
    const thigh = vect(new THREE.BoxGeometry(0.7, 2.2, 0.7)); thigh.position.y = -1.1; hip.add(thigh);
    const talon = vectA(new THREE.ConeGeometry(0.3, 0.9, 4)); talon.position.y = -2.4; talon.rotation.x = Math.PI; hip.add(talon);
  }
  // glowing eye halos
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); const grd = x.createRadialGradient(32,32,2,32,32,30);
    grd.addColorStop(0,'rgba(255,60,60,0.9)'); grd.addColorStop(1,'rgba(255,60,60,0)');
    x.fillStyle = grd; x.fillRect(0,0,64,64); return new THREE.CanvasTexture(c); })();
  for(const sx of [-1,1]){
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, transparent:true,
      blending:THREE.AdditiveBlending, depthWrite:false}));
    halo.scale.set(0.8,0.8,1); halo.material.opacity = 0.7; halo.position.set(sx*0.55, 0.25, 1.0); head.add(halo);
  }
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, transparent:true,
    blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.32}));
  aura.scale.set(26, 18, 1); aura.position.set(0, 0.5, 0); g.add(aura);
  // stronger anatomy silhouette: bigger skull, longer whip of a tail handled below
  head.scale.setScalar(1.35);
  g.scale.setScalar(3.0);                                         // boss presence
  const bubble = textSprite('', 0.11, '#ffb000'); bubble.position.set(0,5.5,1.5); bubble.visible=false; g.add(bubble);
  g.userData.bubble = bubble;
  const blip = new THREE.Mesh(new THREE.OctahedronGeometry(1.4),
    new THREE.MeshBasicMaterial({color:ENEMY, depthTest:false, transparent:true, opacity:0.95}));
  blip.renderOrder = 9; blip.visible = false; scene.add(blip);
  g.userData.blip = blip;
  return g;
}
function spawnDragon(speedMul){
  const g = makeDragon();
  const T = activeTank();
  const ang = Math.random()*Math.PI*2, R = 350 + Math.random()*300;
  g.position.set(T.x + Math.cos(ang)*R, 160, T.z + Math.sin(ang)*R);
  const d = {g, blip:g.userData.blip, state:'seek', target:-1, munch:0, t:Math.random()*9,
             speed:(34+Math.random()*12)*speedMul, scare:0};
  d.blip.visible = state.view==='map';
  dragons.push(d); scene.add(g);
  sfx.roar();
  actionCam(g.position, 2.0);
}
function dragonSay(d, msg, secs=2.2){
  const b = d.g.userData.bubble;
  const c = document.createElement('canvas'); c.width=512; c.height=96;
  const x = c.getContext('2d'); x.font='700 44px ui-monospace,monospace'; x.textAlign='center';
  x.shadowColor='#ffb000'; x.shadowBlur=12; x.fillStyle='#ffb000'; x.fillText(msg,256,60);
  b.material.map?.dispose(); b.material.map = new THREE.CanvasTexture(c);
  b.material.needsUpdate = true; b.visible = true; d.bubbleT = secs;
}
function nearestAliveTree(p, excludeBusy){
  let best=-1, bd=1e12;
  for(let i=0;i<treeState.length;i+=1+((Math.random()*3)|0)){
    const t = treeState[i];
    if(!t.alive || (excludeBusy && t.busy)) continue;
    const dx=t.x-p.x, dz=t.z-p.z, d2=dx*dx+dz*dz;
    if(d2<bd){bd=d2;best=i;}
  }
  return best;
}

/* ---------- conkers & particles ---------- */
const conkers = [];
const conkerGeo = new THREE.SphereGeometry(0.55,6,5);
const conkerMat = new THREE.MeshBasicMaterial({color:AMBER});
function fireConker(tank){
  if(tank.cool > 0 || !state.running) return;
  tank.cool = tank === activeTank() ? 0.42 : 0.95;
  const m = new THREE.Mesh(conkerGeo, conkerMat);
  const q = tank.turret.getWorldQuaternion(new THREE.Quaternion());
  m.position.copy(new THREE.Vector3(0,0.5,10.8).applyQuaternion(q)
      .add(tank.turret.getWorldPosition(new THREE.Vector3())));
  const dir = new THREE.Vector3(0,0.22,1).applyQuaternion(q).normalize();
  conkers.push({m, v:dir.multiplyScalar(150), life:4});
  scene.add(m);
  if(tank === activeTank()) sfx.pew(); else sfx.pew(0.05);
}
const PMAX = 360;
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(PMAX*3),3));
pGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(PMAX*3),3));
scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({size:3.5, vertexColors:true, transparent:true,
  opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false})));
const particles = Array.from({length:PMAX}, ()=>({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,r:0,g:0,b:0}));
let pCursor = 0;
function burst(p, n, col, spread=14, up=10){
  const c = new THREE.Color(col);
  for(let k=0;k<n;k++){
    const pt = particles[pCursor]; pCursor = (pCursor+1)%PMAX;
    pt.life = 0.9 + Math.random()*0.6;
    pt.x=p.x; pt.y=p.y; pt.z=p.z;
    pt.vx=(Math.random()-0.5)*spread; pt.vy=Math.random()*up+3; pt.vz=(Math.random()-0.5)*spread;
    pt.r=c.r; pt.g=c.g; pt.b=c.b;
  }
}

/* ---------- audio (chip synth) ---------- */
const sfx = (()=>{
  let ac, engOsc, engGain, engFilt;
  // exposed for the radio
  Object.defineProperty(window, '__tfttAC', { get(){ return ac; } });
  function makeCtx(){
    ac = new (window.AudioContext||window.webkitAudioContext)();
    try{ if(navigator.audioSession) navigator.audioSession.type = 'playback'; }catch(e){}
  }
  function buildEngine(){
    engOsc = ac.createOscillator(); engOsc.type='sawtooth'; engOsc.frequency.value=42;
    engFilt = ac.createBiquadFilter(); engFilt.type='lowpass'; engFilt.frequency.value=180;
    engGain = ac.createGain(); engGain.gain.value=0;
    engOsc.connect(engFilt).connect(engGain).connect(ac.destination); engOsc.start();
  }
  let watchT = null;
  function rebuildAudio(){
    // iOS zombie context: clock frozen even though state says running. Burn it down.
    try{ ac.close(); }catch(e){}
    makeCtx(); buildEngine();
    const api = sfxApi;
    if(api._music){                                  // restart the music bed on the new context
      api._music = false;
      clearTimeout(api._mNext);
      try{ api._mGain.disconnect(); }catch(e){}
      api.musicStart();
    }
  }
  function checkAlive(){
    if(!ac) return;
    clearTimeout(watchT);
    const t1 = ac.currentTime;
    watchT = setTimeout(() => {
      if(!ac) return;
      if(ac.state === 'running' && ac.currentTime === t1) rebuildAudio();   // zombie
    }, 400);
  }
  function wake(){
    try{
      if(!ac) return;
      if(ac.state !== 'running'){
        // the WebKit interrupted-state dance: suspend first, then resume
        const p = ac.resume();
        if(p && p.catch) p.catch(()=>{ try{ ac.suspend().then(()=>ac.resume()); }catch(e){} });
      }
      if('speechSynthesis' in window) speechSynthesis.resume();
      checkAlive();
    }catch(e){}
  }
  function init(){
    makeCtx(); buildEngine();
    wake();
    addEventListener('touchend', wake);
    addEventListener('pointerdown', wake);
    document.addEventListener('visibilitychange', () => {
      if(document.hidden){                       // games go quiet in your pocket
        try{ ac.suspend(); speechSynthesis?.cancel(); }catch(e){}
      } else wake();
    });
    addEventListener('focus', wake);
    addEventListener('pageshow', wake);
  }
  function blip(f0,f1,dur,type='square',vol=0.16){
    if(!ac) return;
    const o=ac.createOscillator(), g=ac.createGain();
    o.type=type; o.frequency.setValueAtTime(f0,ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20,f1), ac.currentTime+dur);
    g.gain.setValueAtTime(vol,ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+dur);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime+dur+0.02);
  }
  const sfxApi = {
    init,
    engine(speed){ if(engGain){ engGain.gain.value = Math.min(0.10, Math.abs(speed)*0.004+0.012);
                   engOsc.frequency.value = 40 + Math.abs(speed)*2.6; engFilt.frequency.value = 160+Math.abs(speed)*14; } },
    pew(v=0.12){ blip(880, 160, 0.14, 'square', v); },
    pop(){ blip(300, 60, 0.3, 'sawtooth', 0.2); blip(1400, 2400, 0.18, 'sine', 0.08); },
    honk(){ blip(220,220,0.18,'square',0.22); setTimeout(()=>blip(174,174,0.3,'square',0.22),140); },
    munch(){ blip(120, 80, 0.12, 'square', 0.05); },
    roar(){ blip(82, 26, 1.3, 'sawtooth', 0.16); blip(160, 40, 1.0, 'square', 0.07);
      setTimeout(()=>blip(60, 22, 0.9, 'sawtooth', 0.1), 320); },
    fanfare(){ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>blip(f,f,0.16,'triangle',0.14), i*110)); },
    lost(){ blip(400,90,0.8,'sawtooth',0.18); },
    select(){ blip(660,990,0.09,'square',0.1); },
    databurst(){ for(let i=0;i<7;i++) setTimeout(()=>blip(900+Math.random()*900, 700, 0.04, 'square', 0.09), i*45); },
    musicStart(){
      if(!ac || this._music) return;
      this._music = true; this._musicOn = true;
      const mg = this._mGain = ac.createGain(); mg.gain.value = 1; mg.connect(ac.destination);
      // vinyl crackle bed
      const len = ac.sampleRate*1.5, buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for(let i=0;i<len;i++) d[i] = Math.random() < 0.0012 ? (Math.random()*2-1)*0.6 : (Math.random()*2-1)*0.02;
      const cr = ac.createBufferSource(); cr.buffer = buf; cr.loop = true;
      const cg = ac.createGain(); cg.gain.value = 0.05;
      cr.connect(cg).connect(mg); cr.start();
      // Radio Bristol: three synthetic tracks in the city's house styles
      const TRACKS = [
        { name:'BLUE LINES DUB', bar:3.6,  wub:true,            // massive-attack-ish: slow, sub-heavy
          chords:[[45,52,57,60],[41,48,53,57],[43,50,55,58],[45,52,57,60]], padT:'sawtooth', lp:480 },
        { name:'MEZZANINE FOG', bar:3.0, wub:true,              // darker, detuned menace
          chords:[[44,51,56,59],[44,51,56,59],[42,49,54,58],[46,51,56,60]], padT:'square', lp:380, detune:6 },
        { name:'GLORY TIMES', bar:4.4, wub:false, theremin:true, // portishead-ish: sparse, mournful lead
          chords:[[45,48,52,57],[43,48,52,55],[41,45,48,53],[45,48,52,57]], padT:'triangle', lp:700 },
      ];
      let trackIdx = 0, trackBars = 0;
      this.onBass = null;                                       // wub visual hook
      const f = m => 440*Math.pow(2,(m-69)/12);
      let bar = 0;
      const note = (midi, t, dur, type, vol, filt) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.value = f(midi);
        let dest = g;
        if(filt){ const lp = ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value = filt; o.connect(lp).connect(g); }
        else o.connect(g);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t+0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
        g.connect(mg); o.start(t); o.stop(t+dur+0.05);
      };
      const kick = t => { const o=ac.createOscillator(), g=ac.createGain();
        o.frequency.setValueAtTime(110,t); o.frequency.exponentialRampToValueAtTime(38,t+0.18);
        g.gain.setValueAtTime(0.09,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.22);
        o.connect(g).connect(mg); o.start(t); o.stop(t+0.25); };
      const schedule = () => {
        const TR = TRACKS[trackIdx];
        if(!this._musicOn){ this._mNext = setTimeout(schedule, 500); return; }
        const t0 = ac.currentTime + 0.12, BAR = TR.bar;
        const ch = TR.chords[bar % 4];
        for(const m of ch) note(m + 12, t0, BAR*1.08, TR.padT, 0.045, TR.lp + 400);   // pad, audible on phones
        if(TR.detune) for(const m of ch) note(m + 12 + 0.07, t0, BAR*1.05, TR.padT, 0.028, TR.lp + 400);
        note(ch[0]+24, t0+BAR*0.25, 0.5, 'triangle', 0.06);                            // rhodes-ish offbeat stab
        note(ch[2]+24, t0+BAR*0.75, 0.5, 'triangle', 0.05);
        note(ch[0]-12, t0, BAR*0.42, 'sine', 0.11);                                    // THE sub (for headphones)
        note(ch[0],    t0, BAR*0.42, 'triangle', 0.05);                                // bass octave phones can hear
        note(ch[0]-12, t0+BAR*0.625, BAR*0.28, 'sine', 0.08);
        note(ch[0],    t0+BAR*0.625, BAR*0.28, 'triangle', 0.04);
        if(TR.wub && this.onBass){ this.onBass(0); setTimeout(()=>this.onBass && this.onBass(1), BAR*625); }
        kick(t0); kick(t0+BAR*0.5);
        for(let i=1;i<8;i+=2) note(86+(i%3), t0+i*BAR/8, 0.04, 'square', 0.014);
        if(TR.theremin && bar % 2 === 0){                                      // mournful lead, vibrato
          const lead = ch[2] + 24;
          const o = ac.createOscillator(), g = ac.createGain(), v = ac.createOscillator(), vg = ac.createGain();
          o.type='sine'; o.frequency.value = f(lead);
          v.frequency.value = 5.2; vg.gain.value = 4; v.connect(vg).connect(o.frequency); v.start();
          g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.05, t0+0.7);
          g.gain.exponentialRampToValueAtTime(0.0001, t0+BAR*1.6);
          o.connect(g).connect(mg); o.start(t0); o.stop(t0+BAR*1.7); setTimeout(()=>v.stop(), BAR*1800);
        }
        bar++; trackBars++;
        if(trackBars >= 24){ trackBars = 0; trackIdx = (trackIdx+1) % TRACKS.length; bar = 0; }
        const np = host.querySelector('#nowplaying');
        if(np) np.textContent = this._musicOn ? '♬ 99.1 BRS — ' + TRACKS[trackIdx].name : '';
        this._mNext = setTimeout(schedule, BAR*1000);
      };
      schedule();
    },
    setMusicGain(v){ if(this._mGain) this._mGain.gain.value = this._musicOn ? Math.min(1.6, v*1.25) : 0; },
    musicToggle(){ this._musicOn = !this._musicOn;
      if(this._mGain) this._mGain.gain.value = this._musicOn ? 1 : 0;
      const np = host.querySelector('#nowplaying'); if(np && !this._musicOn) np.textContent = '';
      return this._musicOn; },
    ack(){ blip(1200,1200,0.07,'square',0.1); setTimeout(()=>blip(1600,1600,0.1,'square',0.1), 90); },
  };
  return sfxApi;
})();

/* ---------- the radio: three stations and a lot of static ---------- */
const radio = (()=>{
  const STATIONS = { council: 91.5, numbers: 96.2, brs: 99.1, pirate: 103.7 };
  let on = false, freq = 100.0, ac = null;
  let staticSrc = null, staticGain = null, wubOsc = null, wubLfo = null, wubGain = null;
  let speakT = 0;
  function ensureNodes(ctx){
    ac = ctx;
    const len = ac.sampleRate * 1.2, buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
    staticSrc = ac.createBufferSource(); staticSrc.buffer = buf; staticSrc.loop = true;
    staticGain = ac.createGain(); staticGain.gain.value = 0;
    staticSrc.connect(staticGain).connect(ac.destination); staticSrc.start();
    wubOsc = ac.createOscillator(); wubOsc.type='sawtooth'; wubOsc.frequency.value = 55;
    wubLfo = ac.createOscillator(); wubLfo.frequency.value = 2.2;
    const lfoGain = ac.createGain(); lfoGain.gain.value = 600;
    const wubFilt = ac.createBiquadFilter(); wubFilt.type='lowpass'; wubFilt.frequency.value = 300;
    wubLfo.connect(lfoGain).connect(wubFilt.frequency);
    wubGain = ac.createGain(); wubGain.gain.value = 0;
    wubOsc.connect(wubFilt).connect(wubGain).connect(ac.destination);
    wubOsc.start(); wubLfo.start();
  }
  function voice(){
    try{
      const vs = speechSynthesis.getVoices();
      return vs.find(v=>/en[-_]GB/i.test(v.lang)) || vs.find(v=>/^en/i.test(v.lang)) || null;
    }catch(e){ return null; }
  }
  let spokeCount = 0;
  function say(text, pitch=1, rate=1, vol=0.9){
    try{
      if(!('speechSynthesis' in window)) return;
      if(speechSynthesis.pending || speechSynthesis.speaking) speechSynthesis.cancel();  // iOS queue jams
      const u = new SpeechSynthesisUtterance(text);
      const v = voice(); if(v) u.voice = v;
      u.lang = 'en-GB';
      u.pitch = pitch; u.rate = rate; u.volume = vol;
      speechSynthesis.speak(u);
      spokeCount++;
    }catch(e){}
  }
  /* iOS: TTS must be unlocked inside a user gesture */
  const unlockTTS = () => {
    try{
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0.01; speechSynthesis.speak(u);
      speechSynthesis.getVoices();
    }catch(e){}
  };
  addEventListener('touchend', unlockTTS, { once:true });
  addEventListener('click', unlockTTS, { once:true });
  function strength(f0){ return Math.max(0, 1 - Math.abs(freq - f0)/1.4); }
  function tuned(){
    let best = null, bs = 0.45;
    for(const [name, f0] of Object.entries(STATIONS)){
      const st = strength(f0); if(st > bs){ bs = st; best = name; }
    }
    return best;
  }
  return {
    toggle(ctx){
      on = !on;
      if(on && ctx && !staticSrc) ensureNodes(ctx);
      if(!on){ try{ speechSynthesis.cancel(); }catch(e){}
        if(staticGain) staticGain.gain.value = 0; if(wubGain) wubGain.gain.value = 0; }
      return on;
    },
    setFreq(f){ freq = f; try{ speechSynthesis.cancel(); }catch(e){} speakT = 1.5; },
    label(){
      const st = tuned();
      const names = {council:'COUNCIL FM', numbers:'◇ ◇ ◇', brs:'99.1 BRS', pirate:'DRAGON PIRATE'};
      return freq.toFixed(1) + ' FM ' + (st ? '· ' + names[st] : '· STATIC');
    },
    speakPop(line){ say(line.toLowerCase(), 1.8, 1.15, 0.55); },
    get spoke(){ return spokeCount; },   // dragons always heckle aloud
    update(dt, ctx){
      if(!on){ sfx.setMusicGain(1); return; }       // radio off: ambient plays freely
      if(staticGain && staticGain.context.state === 'closed'){   // context was rebuilt under us
        staticSrc = null; staticGain = null; wubOsc = null;
        if(window.__tfttAC) ensureNodes(window.__tfttAC);
      }
      if(!staticGain) return;
      const st = tuned();
      staticGain.gain.value = st ? 0.01 : 0.04;
      sfx.setMusicGain(st === 'brs' ? Math.min(1.5, strength(STATIONS.brs)*1.6) : 0);   // tune 99.1, properly loud
      wubGain.gain.value = (st === 'pirate') ? 0.07 * strength(STATIONS.pirate) : 0;
      speakT -= dt;
      if(speakT > 0) return;
      if(st === 'council'){
        say('Council F M. ' + HEADLINES[(headlineIdx + HEADLINES.length - 1) % HEADLINES.length], 0.9, 1.0);
        speakT = 13;
      } else if(st === 'numbers'){
        const T = activeTank(); let bearing = null, bd = 1e12;
        for(const d of dragons){ if(d.state==='dead') continue;
          const dd = (d.g.position.x-T.x)**2 + (d.g.position.z-T.z)**2;
          if(dd<bd){ bd=dd; bearing = (Math.atan2(d.g.position.x-T.x, d.g.position.z-T.z)*180/Math.PI+360)%360; } }
        const digits = bearing===null ? '0 0 0' : String(Math.round(bearing)).padStart(3,'0').split('').join('. ');
        say(digits + '.', 0.7, 0.8);
        speakT = 8;
      } else if(st === 'brs'){ speakT = 4;          // music speaks for itself
      } else if(st === 'pirate'){
        say(QUIPS[(Math.random()*QUIPS.length)|0].toLowerCase(), 1.9, 1.1, 0.7);
        speakT = 9;
      } else speakT = 2;
    },
  };
})();

/* ---------- game state ---------- */
const state = {
  running:false, paused:false, view:'drive', score:0, wave:0, lost:0, lostLimit:1000,
  active:0, selected:-1, waveTimer:3, dragonsToSpawn:0, speedMul:1,
  map:{cx:0, cz:0, h:2600}, auto:null,
};
const input = {x:0, y:0, fire:false, aimAngle:null, manualT:0, lookYaw:0, looking:false};
let camCut = 0, camCutPos = null;
function actionCam(p, secs){
  if(state.view !== 'drive' || state.auto) return;
  const T = activeTank();
  if(Math.hypot(p.x-T.x, p.z-T.z) > 450) return;
  camCut = secs; camCutPos = p.clone ? p.clone() : new THREE.Vector3(p.x, p.y, p.z);
}
const activeTank = () => tanks[state.active];

let locT = 0;
/* ---------- HUD ---------- */
const HEADLINES = [
  "DRAGON CLAIMS BRISTOL'S TREES ARE 'BASICALLY FREE SALAD'",
  "COUNCIL: PLEASE STOP DRIVING THOSE TANKS ACROSS THE DOWNS",
  "CLIFTON RESIDENTS CALL FLEET 'LOVELY, BUT QUITE LOUD'",
  "ALL 115 TREE SPECIES 'STILL DELICIOUS', CONFIRMS DRAGON",
  "SUSPENSION BRIDGE SUSPICIOUSLY UNEATEN, EXPERTS BAFFLED",
  "1981 'VERY PROUD' AS BIGTRAK FLEET DEPLOYED IN ANGER",
  "BANKSY THE TANK DENIES BEING THE REAL BANKSY",
  "DRAGON SPOTTED QUEUEING POLITELY AT TEMPLE MEADS",
];
let headlineIdx = 0;
setInterval(()=>{ $('tickertext').textContent = '>> ' + HEADLINES[headlineIdx++ % HEADLINES.length] + ' <<'; }, 9000);
function feed(msg){
  const d = document.createElement('div'); d.textContent = msg;
  $('feed').prepend(d); setTimeout(()=>d.remove(), 4200);
  while($('feed').children.length > 5) $('feed').lastChild.remove();
}
function banner(msg, secs=2){
  const b = $('wavebanner'); b.textContent = msg; b.style.opacity = 1;
  setTimeout(()=>b.style.opacity = 0, secs*1000);
}
function buildFleetHud(){
  $('fleet').innerHTML = '';
  tanks.forEach((t,i)=>{
    const b = document.createElement('button');
    b.className = 'tankbtn' + (i===state.active?' active':'');
    b.textContent = '▲' + t.name;
    b.onclick = () => jackIn(i);
    $('fleet').appendChild(b);
  });
}
function jackIn(i){
  state.active = i; state.selected = -1; sfx.select();
  buildFleetHud();
  feed('>> TX ' + tanks[i].name + ' :: MANUAL OVERRIDE 99');
  if(state.view === 'map') setView('drive');
}
function updateHud(){
  $('score').textContent = state.score;
  $('wave').textContent = state.wave;
  $('treesleft').textContent = aliveTrees.toLocaleString();
  $('treefill').style.width = Math.max(0, 100*(1 - state.lost/state.lostLimit)) + '%';
  $('tide').textContent = (tideRising() ? '▲ RISING ' : '▼ EBBING ') + (waterLevel()/EXAG).toFixed(1) + 'M';
  const T = activeTank();
  // rose: keep N pointing at true world north on screen
  const roseAngle = state.view === 'drive' ? T.heading * 180/Math.PI : 0;
  $('roseg').setAttribute('transform', 'rotate(' + roseAngle.toFixed(1) + ' 50 50)');
  // discreet location: nearest landmark to the active tank (or map centre)
  locT -= 1/60;
  if(locT <= 0){
    locT = 1;
    // label LOD: big names hide when you're on top of them
    for(const sp of labelSprites){
      if(!sp.parent) continue;
      const d2 = camera.position.distanceToSquared(sp.getWorldPosition ? sp.getWorldPosition(new THREE.Vector3()) : sp.position);
      const minD = sp.scale.x > 120 ? 150 : 45;
      if(d2 < minD*minD) sp.visible = false;
      else if(sp.visible === false && !sp.userData.pooled) sp.visible = true;
    }
    const px = state.view==='drive' ? T.x : state.map.cx, pz = state.view==='drive' ? T.z : state.map.cz;
    let best = null, bd = 1e12;
    for(const [name,e,n] of LANDMARKS){
      const d = Math.hypot(e-E0-px, -(n-N0)-pz);
      if(d < bd){ bd = d; best = name; }
    }
    $('loc').textContent = bd < 250 ? 'AT ' + best : 'NR ' + best + ' ' + (bd/1000).toFixed(1) + 'KM';
  }
}

/* ---------- view switching ---------- */
function setView(v){
  state.view = v;
  const drive = v === 'drive';
  $('stick').style.display = drive ? '' : 'none';
  $('fire').style.display = drive ? '' : 'none';
  $('honk').style.display = drive ? '' : 'none';

  if(!drive) $('radio').classList.add('hidden');
  $('maphint').style.display = drive ? 'none' : '';
  $('maptitle').style.display = drive ? 'none' : '';
  $('scalebar').style.display = drive ? 'none' : '';
  $('mapbtn').textContent = drive ? '▦' : '▶';
  for(const t of tanks) t.blip.visible = !drive;
  for(const d of dragons) d.blip.visible = !drive;
  if(!drive){
    const T = activeTank();
    state.map.cx = T.x; state.map.cz = T.z;
    camera.up.set(0,0,-1);          // north-up map
  } else camera.up.set(0,1,0);
  sfx.select();
}
$('mapbtn').addEventListener('click', ()=> setView(state.view==='drive' ? 'map' : 'drive'));
$('menubtn').addEventListener('click', ()=> $('drawer').classList.toggle('open'));
$('pausebtn2').addEventListener('click', ()=>{ state.paused = !state.paused; $('pausebtn2').textContent = state.paused?'▶ RESUME':'‖ PAUSE'; });
$('tickertgl').addEventListener('click', ()=>{ const t = $('ticker'); t.style.display = t.style.display==='block'?'none':'block'; });
host.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', ()=> setMode(activeTank(), b.dataset.mode)));
let tpInstant = false;
$('tpmode').addEventListener('click', e => {
  e.stopPropagation();
  tpInstant = !tpInstant;
  $('tpmode').textContent = tpInstant ? 'MODE: TELEPORT' : 'MODE: DRIVE';
});
const PLACES = [['BRIDGE',356790,173020],['CABOT TWR',358290,172730],['QUEEN SQ',358950,172850],
  ['TEMPLE MEADS',360060,172370],['SS GT BRITAIN',358144,172427],['REDCLIFFE',360131,172371],
  ['WILLS',358498,173150],['STOKES CROFT',359395,173818],['THE DOWNS',357642,174308],['ARNOLFINI',358886,172394]];
for(const [nm,e,n] of PLACES){
  const b = document.createElement('button');
  b.className = 'tankbtn'; b.textContent = nm;
  b.addEventListener('click', ()=>{
    const T = activeTank();
    if(tpInstant){ T.x = e-E0; T.z = -(n-N0); T.nav = null; T.navRoute = null;
      bloomFlare = 1; burst(new THREE.Vector3(T.x, heightAt(T.x,T.z)+4, T.z), 20, CYAN, 14, 10);
      feed('>> TELEPORT :: ' + nm); }
    else { const pts = routeTo(T, e-E0, -(n-N0));
      if(pts){ T.navRoute = { pts, i: 0 }; T.nav = null; feed('>> EN ROUTE :: ' + nm); }
      else feed('>> NO ROUTE'); }
    $('drawer').classList.remove('open');
    if(state.view === 'map') setView('drive');
  });
  $('places').appendChild(b);
}
host.querySelectorAll('[data-auto]').forEach(b => b.addEventListener('click', ()=>{ setAuto(b.dataset.auto || null); $('drawer').classList.remove('open'); }));
// tapping the world closes the drawer
addEventListener('pointerdown', e => { if(!e.target?.closest?.('#drawer,#menubtn')) $('drawer').classList.remove('open'); });

/* ---------- drive controls ---------- */
(function(){
  const stick = $('stick'), knob = $('knob');
  let id = null;
  function setKnob(dx,dy){ knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; }
  function handle(e){
    for(const t of e.changedTouches){
      if(id===null && e.type==='touchstart') id = t.identifier;
      if(t.identifier!==id) continue;
      const r = stick.getBoundingClientRect();
      let dx = t.clientX-(r.left+r.width/2), dy = t.clientY-(r.top+r.height/2);
      const m = Math.hypot(dx,dy), max = r.width/2-10;
      if(m>max){ dx*=max/m; dy*=max/m; }
      if(e.type==='touchend'||e.type==='touchcancel'){ id=null; input.x=0; input.y=0; setKnob(0,0); }
      else { input.x = dx/max; input.y = -dy/max; setKnob(dx,dy); }
    }
    e.preventDefault();
  }
  for(const ev of ['touchstart','touchmove','touchend','touchcancel']) stick.addEventListener(ev, handle, {passive:false});
})();
(function(){
  const fire = $('fire');
  let fid = null, sx = 0, sy = 0;
  let lastTap = 0;
  fire.addEventListener('touchstart', e=>{
    const t = e.changedTouches[0]; fid = t.identifier; sx = t.clientX; sy = t.clientY;
    const now = performance.now();
    if(now - lastTap < 320){ input.aimAngle = 0; input.manualT = 1.4; }   // double-tap: gun forward
    lastTap = now;
    input.fire = true; e.preventDefault();
  }, {passive:false});
  addEventListener('touchmove', e=>{
    for(const t of e.changedTouches){
      if(t.identifier !== fid) continue;
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if(Math.hypot(dx, dy) > 16){                       // drag past deadzone = aim yourself
        input.aimAngle = Math.atan2(dx, -dy);            // screen-up = tank-forward
        input.manualT = 2.0;
      }
    }
  }, {passive:true});
  addEventListener('touchend', e=>{
    for(const t of e.changedTouches) if(t.identifier === fid){ fid = null; input.fire = false; }
  });
})();
$('fire').addEventListener('mousedown', ()=>input.fire=true);
addEventListener('mousemove', e=>{
  if(state.view !== 'drive' || !state.running || e.target.closest('.btn,.tankbtn,#radio')) return;
  const dx = e.clientX - innerWidth/2, dy = e.clientY - innerHeight*0.62;
  if(Math.hypot(dx, dy) > 30){ input.aimAngle = Math.atan2(dx, -dy); input.manualT = 1.2; }
});
addEventListener('mouseup', ()=>input.fire=false);
$('honk').addEventListener('mousedown', doHonk);
const holdBtn = (id, on, off) => { const el = $(id);
  el.addEventListener('touchstart', e=>{ on(); e.preventDefault(); }, {passive:false});
  el.addEventListener('touchend', e=>{ off(); e.preventDefault(); }, {passive:false});
  el.addEventListener('mousedown', on); addEventListener('mouseup', off);
};
holdBtn('rise', ()=>{ activeTank().altBias = Math.min(280, (activeTank().altBias||0) + 40); }, ()=>{});
const AUTOSEQ = [null, 'road', 'air', 'river'];
let autoIdx = 0;
function cycleAuto(){ autoIdx = (autoIdx+1) % AUTOSEQ.length; setAuto(AUTOSEQ[autoIdx]); if(!AUTOSEQ[autoIdx]) autoIdx = 0; }
holdBtn('sink', ()=>{ activeTank().altBias = Math.max(-18, (activeTank().altBias||0) - 40); }, ()=>{});
function toggleRadio(){
  const on = radio.toggle(window.__tfttAC);
  $('radio').classList.toggle('hidden', !on);

  if(on){ radio.setFreq($('dial').value/10); $('freqlabel').textContent = radio.label(); }
}
$('dial').addEventListener('input', ()=>{ radio.setFreq($('dial').value/10); $('freqlabel').textContent = radio.label(); });
$('ambientbtn').addEventListener('click', ()=>{
  if(!window.__tfttAC){ sfx.init(); sfx.musicStart(); $('ambientbtn').textContent = '♬ 99.1 ON'; return; }
  $('ambientbtn').textContent = sfx.musicToggle() ? '♬ 99.1 ON' : '♬ 99.1 OFF';
});
$('stationsbtn').addEventListener('click', ()=>{ toggleRadio(); });

/* swipe anywhere open to glance around (tank-commander style); springs back */
(function(){
  let id = null, lastX = 0;
  addEventListener('touchstart', e=>{
    if(state.view !== 'drive' || id !== null) return;
    const t = e.changedTouches[0];
    if(e.target.closest('#stick,#fire,#honk,#radiobtn,#radio,#mapbtn,#pausebtn,#fleet,.tankbtn')) return;
    id = t.identifier; lastX = t.clientX; input.looking = true;
  }, {passive:true});
  addEventListener('touchmove', e=>{
    for(const t of e.changedTouches){
      if(t.identifier !== id) continue;
      input.lookYaw = THREE.MathUtils.clamp(input.lookYaw + (t.clientX - lastX) * 0.007, -2.9, 2.9);
      lastX = t.clientX;
    }
  }, {passive:true});
  addEventListener('touchend', e=>{
    for(const t of e.changedTouches) if(t.identifier === id){ id = null; input.looking = false; }
  });
})();
const keys = {};
addEventListener('keydown', e=>{
  keys[e.code]=true;
  if(e.code==='Space'){ input.fire=true; e.preventDefault(); }
  if(e.code==='KeyH') doHonk();
  if(e.code==='KeyR') toggleRadio();
  if(e.code==='KeyC'){ input.aimAngle = 0; input.manualT = 1.4; }   // centre the gun
  if(e.code==='KeyT') cycleMode();
  if(e.code==='KeyP') cycleAuto();
  if(e.code==='Space' && activeTank().mode==='heli'){ activeTank().altBias = Math.min(280,(activeTank().altBias||0)+30); }
  if(e.code==='KeyX'){ activeTank().altBias = Math.max(-18,(activeTank().altBias||0)-30); }
  if(e.code==='KeyM') setView(state.view==='drive' ? 'map' : 'drive');
  if(e.code==='Digit1') jackIn(0);
  if(e.code==='Digit2') jackIn(1);
  if(e.code==='Digit3') jackIn(2);
});
addEventListener('keyup', e=>{ keys[e.code]=false; if(e.code==='Space')input.fire=false; });

/* ---------- autopilot: road patrols, air tours, river runs ---------- */
function chainWays(ways, startNear){            // greedy polyline chaining, world coords
  const pool = ways.map(w => w.map(([e,n]) => [e-E0, -(n-N0)])).filter(w => w.length > 3);
  if(!pool.length) return null;
  let best = 0, bd = 1e12;
  pool.forEach((w,i) => { const d = Math.hypot(w[0][0]-startNear.x, w[0][1]-startNear.z); if(d<bd){bd=d;best=i;} });
  const route = [...pool.splice(best,1)[0]];
  for(let hops=0; hops<14 && pool.length; hops++){
    const end = route[route.length-1];
    let bi=-1, bdd=140*140, rev=false;
    pool.forEach((w,i)=>{
      const d0 = (w[0][0]-end[0])**2 + (w[0][1]-end[1])**2;
      const d1 = (w[w.length-1][0]-end[0])**2 + (w[w.length-1][1]-end[1])**2;
      if(d0 < bdd){ bdd=d0; bi=i; rev=false; }
      if(d1 < bdd){ bdd=d1; bi=i; rev=true; }
    });
    if(bi < 0) break;
    const w = pool.splice(bi,1)[0];
    route.push(...(rev ? w.reverse() : w));
  }
  return route.length > 8 ? route : null;
}
function buildAutoRoute(kind){
  const T = activeTank();
  if(kind === 'road'){
    const majors = ROADS.roads.filter(([c,,p]) => (c===1||c===2) && p.length>6).map(r=>r[2]);
    const pts = chainWays(majors, T);
    return pts && { kind, mode:'tank', speed: 20, pts, i:0, t:0 };
  }
  if(kind === 'air'){
    // the postcard run: gorge -> bridge -> Cabot -> harbour -> Redcliffe -> Meads -> Purdown -> Downs
    const P = [[355900,172300,210],[356790,173020,150],[358290,172730,120],[358144,172427,70],
               [360131,172371,95],[360060,172370,140],[361495,175788,200],[357642,174308,150]];
    const curve = new THREE.CatmullRomCurve3(
      P.map(([e,n,a]) => new THREE.Vector3(e-E0, heightAt(e-E0,-(n-N0)) + a, -(n-N0))), true, 'centripetal');
    const pts = curve.getSpacedPoints(360).map(v => [v.x, v.z, v.y]);   // [x,z,alt-y]
    return { kind, mode:'heli', speed: 42, pts, i:0, t:0, air:true };
  }
  if(kind === 'river'){
    const avon = (WATER.rivers||[]).filter(([nm]) => /avon|harbour|cut/i.test(nm||'')).map(r=>r[1]);
    const pts = chainWays(avon, T);
    return pts && { kind, mode:'boat', speed: 13, pts, i:0, t:0 };
  }
  return null;
}
function setAuto(kind){
  if(!kind){ state.auto = null; feed('>> MANUAL CONTROL'); return; }
  const route = buildAutoRoute(kind);
  if(!route){ feed('>> NO ROUTE FOUND'); return; }
  const T = activeTank();
  // teleport-cut to route start (cinema allows jump cuts)
  T.x = route.pts[0][0]; T.z = route.pts[0][1];
  if(route.mode === 'heli') T.altBias = 60;
  T.mode = route.mode; T.heli.visible = route.mode==='heli'; T.boat.visible = route.mode==='boat';
  state.auto = route;
  sfx.fanfare();
  feed('>> AUTOPILOT :: ' + kind.toUpperCase() + ' (touch stick to cancel)');
}
function updateAuto(dt){
  const A = state.auto; if(!A) return;
  if(Math.abs(input.x) > 0.25 || Math.abs(input.y) > 0.25){ setAuto(null); return; }
  const T = activeTank();
  const [x1,z1] = A.pts[A.i], [x2,z2] = A.pts[(A.i+1) % A.pts.length];
  const L = Math.hypot(x2-x1, z2-z1) || 1;
  A.t += A.speed*dt / L;
  if(A.t >= 1){ A.t = 0; A.i = (A.i+1) % A.pts.length;
    if(A.i === 0 && A.kind !== 'air'){ setAuto(null); return; } }   // ground/river routes end; tours loop
  const x = x1+(x2-x1)*A.t, z = z1+(z2-z1)*A.t;
  T.x = x; T.z = z; T.speed = A.speed;
  T.heading = Math.atan2(x2-x1, z2-z1);
  if(A.air){
    const y1 = A.pts[A.i][2], y2 = A.pts[(A.i+1)%A.pts.length][2];
    T.alt = (y1+(y2-y1)*A.t) - heightAt(x,z);
  }
}
const MODES = ['tank','heli','boat'];
function setMode(T, m){
  if(T.mode === m) return;
  // boat only on water; tank not over water
  if(m === 'boat' && !inWater(T.x, T.z)){ feed('>> NEED WATER FOR BOAT MODE'); return; }
  if(m === 'tank' && inWater(T.x, T.z)){ feed('>> CANNOT TRACK ON WATER'); return; }
  T.mode = m; T.modeT = 0; T.nav = null;
  $('drawer').classList.remove('open');            // never hide the show
  T.heli.visible = m === 'heli';
  T.boat.visible = m === 'boat';
  if(m === 'heli') T.heli.scale.setScalar(0.01);
  if(m === 'boat') T.boat.scale.setScalar(0.01);
  bloomFlare = 1;                                   // the cheap-transformer flare
  burst(new THREE.Vector3(T.x, T.g.position.y + 3, T.z), 26, AMBER, 16, 12);
  burst(new THREE.Vector3(T.x, T.g.position.y + 2, T.z), 18, PHOS, 12, 9);
  sfx.databurst(); setTimeout(()=>sfx.ack(), 350);
  feed('>> ' + T.name + ' :: ' + m.toUpperCase() + ' CONFIGURATION');
}
function cycleMode(){
  const T = activeTank();
  const i = MODES.indexOf(T.mode);
  for(let k=1;k<=2;k++){
    const m = MODES[(i+k)%3];
    if(m === 'boat' && !inWater(T.x, T.z)) continue;
    if(m === 'tank' && inWater(T.x, T.z)) continue;
    setMode(T, m); return;
  }
}
function doHonk(){
  if(!state.running) return;
  const T = activeTank();
  sfx.honk(); feed('>> HONK!');
  for(const d of dragons){
    if(d.state==='munch' && Math.hypot(d.g.position.x-T.x, d.g.position.z-T.z) < 260){
      d.state='flee'; d.scare = 3.5; d.perched = false; dragonSay(d,'AAAH A HONK');
    }
  }
}

/* ---------- map interaction: tap select / order, drag pan, pinch zoom ---------- */
(function(){
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
  let touches = new Map(), moved = false, pinchD = 0;
  function mapPoint(cx, cy){
    ndc.set(cx/innerWidth*2-1, -(cy/innerHeight)*2+1);
    ray.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, p) ? p : null;
  }
  let lastTapT = 0, lastTapP = null;
  function tap(cx, cy){
    const p = mapPoint(cx, cy); if(!p) return;
    const now = performance.now();
    if(now - lastTapT < 350 && lastTapP && Math.hypot(p.x-lastTapP.x, p.z-lastTapP.z) < state.map.h*0.08){
      const T = activeTank();                                    // double-tap: teleport
      T.x = p.x; T.z = p.z; T.nav = null; T.navRoute = null;
      bloomFlare = 1; feed('>> TELEPORT'); setView('drive');
      return;
    }
    lastTapT = now; lastTapP = p;
    const r = state.map.h * 0.05;          // tap radius scales with zoom
    let hit = -1;
    tanks.forEach((t,i)=>{ if(Math.hypot(t.x-p.x, t.z-p.z) < r) hit = i; });
    if(hit >= 0){
      if(state.selected === hit){ jackIn(hit); return; }    // tap selected again = jack in
      state.selected = hit; sfx.select(); feed('>> ' + tanks[hit].name + ' SELECTED');
    } else if(state.selected >= 0){
      const t = tanks[state.selected];
      const gx = THREE.MathUtils.clamp(p.x,-WORLD/2+80,WORLD/2-80);
      const gz = THREE.MathUtils.clamp(p.z,-WORLD/2+80,WORLD/2-80);
      const pts = routeTo(t, gx, gz);
      if(pts && pts.length > 2){ t.navRoute = { pts, i: 0 }; t.nav = null; }
      else t.waypoint = { x: gx, z: gz };
      transmit(t, 'GO');
    }
  }
  addEventListener('pointerdown', e=>{
    if(state.view!=='map' || e.target.closest('.btn,.tankbtn,#fleet')) return;
    touches.set(e.pointerId, {x:e.clientX, y:e.clientY}); moved = false;
    if(touches.size===2){
      const [a,b] = [...touches.values()]; pinchD = Math.hypot(a.x-b.x, a.y-b.y);
    }
  });
  addEventListener('pointermove', e=>{
    if(state.view!=='map' || !touches.has(e.pointerId)) return;
    const prev = touches.get(e.pointerId);
    const dx = e.clientX-prev.x, dy = e.clientY-prev.y;
    touches.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if(Math.hypot(dx,dy) > 3) moved = true;
    if(touches.size===1){
      const scale = state.map.h / innerHeight * 2.4;
      state.map.cx -= dx*scale; state.map.cz -= dy*scale;
    } else if(touches.size===2){
      const [a,b] = [...touches.values()];
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      if(pinchD > 0) state.map.h = THREE.MathUtils.clamp(state.map.h * pinchD/d, 700, 4600);
      pinchD = d;
    }
  });
  addEventListener('pointerup', e=>{
    if(!touches.has(e.pointerId)) return;
    touches.delete(e.pointerId);
    if(state.view==='map' && !moved && touches.size===0) tap(e.clientX, e.clientY);
  });
  addEventListener('wheel', e=>{
    if(state.view==='map') state.map.h = THREE.MathUtils.clamp(state.map.h * (e.deltaY>0?1.12:0.89), 700, 4600);
  }, {passive:true});
})();

/* ---------- waves ---------- */
function startWave(){
  saveForest();
  state.wave++; state.speedMul = 1 + (state.wave-1)*0.09;
  state.dragonsToSpawn = 2 + state.wave;
  banner('// WAVE ' + state.wave + ' //');
  emit('wave', { wave: state.wave });
  sfx.fanfare();
}

/* ---------- per-tank update ---------- */
function updateTank(T, dt, isPlayer){
  let fwd = 0, turn = 0;
  const cruising = T.mode === 'tank' && isPlayer && state.view==='drive' && !T.navRoute;
  if(cruising){
    // PACMAN MODE: the tank drives itself along the network; you nudge the junctions
    fwd = 1 + THREE.MathUtils.clamp(input.y + (keys.KeyW?1:0) - (keys.KeyS?1.6:0), -1, 0.4);
    if(keys.ArrowUp) fwd = 1.4;
    if(!T.nav || !navEdges.length){
      const np = navEdges.length ? nearestNavPoint(T.x, T.z) : null;
      if(np && np.dist < 10){ T.nav = { edge: np.edge, seg: np.seg, t: np.t,
        rev: false }; }
      else if(np){                                    // off the network: head for it (between-houses probing)
        const want = Math.atan2(np.x - T.x, np.z - T.z);
        let bestA = want, bestScore = -1e9;
        for(let k=-4;k<=4;k++){
          const a = want + k*0.3;
          let clear = 0;
          for(let d=7; d<=35; d+=7){
            if(blocked(T.x + Math.sin(a)*d, T.z + Math.cos(a)*d)) break;
            clear = d;
          }
          const score = clear - Math.abs(k)*2.5;
          if(score > bestScore){ bestScore = score; bestA = a; }
        }
        let diff = ((bestA - T.heading + Math.PI*3) % (Math.PI*2)) - Math.PI;
        turn = THREE.MathUtils.clamp(diff*2.2, -1, 1);
      }
    }
    if(T.nav){
      const E2 = navEdges[T.nav.edge];
      const P = T.nav.rev ? [...E2.pts].reverse() : E2.pts;
      const i = T.nav.rev ? P.length-2-T.nav.seg : T.nav.seg;       // normalise
      const pts = T.nav.rev ? P : E2.pts;
      const [x1,z1] = pts[T.nav.seg] || pts[0], [x2,z2] = pts[T.nav.seg+1] || pts[pts.length-1];
      const want = Math.atan2(x2-x1, z2-z1);
      let diff = ((want - T.heading + Math.PI*3) % (Math.PI*2)) - Math.PI;
      turn = THREE.MathUtils.clamp(diff*2.4, -1, 1);
      // pull toward the centreline like a good lane-keeper
      const dx=x2-x1, dz=z2-z1, L2=dx*dx+dz*dz||1;
      const tt = Math.max(0, Math.min(1, ((T.x-x1)*dx+(T.z-z1)*dz)/L2));
      const offX = (x1+dx*tt) - T.x, offZ = (z1+dz*tt) - T.z;
      turn += THREE.MathUtils.clamp((offX*Math.cos(T.heading) - offZ*Math.sin(T.heading)) * 0.05, -0.5, 0.5);
      if(tt >= 0.98){
        T.nav.seg++;
        if(T.nav.seg >= pts.length-1){
          const endKey = T.nav.rev ? E2.a : E2.b;
          const nxt = cruisePick(T, endKey, T.nav.edge);
          T.nav = nxt ? { edge: nxt.edge, seg: 0, t: 0, rev: nxt.rev } : null;
        }
      }
    }
  } else if(isPlayer && state.view==='drive' && !T.navRoute){
    fwd = input.y; turn = -input.x;
    if(keys.KeyW||keys.ArrowUp) fwd += 1;
    if(keys.KeyS||keys.ArrowDown) fwd -= 1;
    if(keys.KeyA||keys.ArrowLeft) turn += 1;
    if(keys.KeyD||keys.ArrowLeft) turn += 0;
    if(keys.KeyA) turn += 0;
    if(keys.KeyD||keys.ArrowRight) turn -= 1;
    fwd = THREE.MathUtils.clamp(fwd,-1,1); turn = THREE.MathUtils.clamp(turn,-1,1);
  } else if(T.navRoute){
    // A* route execution (player tap-to-go or AI orders): follow the planned polyline
    const R = T.navRoute;
    const [x1,z1] = R.pts[R.i], [x2,z2] = R.pts[Math.min(R.i+1, R.pts.length-1)];
    const want = Math.atan2(x2-x1, z2-z1);
    let diff = ((want - T.heading + Math.PI*3) % (Math.PI*2)) - Math.PI;
    turn = THREE.MathUtils.clamp(diff*2.4, -1, 1);
    fwd = Math.abs(diff) < 1.0 ? 1 : 0.3;
    if(Math.hypot(x2-T.x, z2-T.z) < 12){
      R.i++;
      if(R.i >= R.pts.length-1){ T.navRoute = null; feed('>> ' + T.name + ' ARRIVED'); }
    }
  } else if(T.waypoint){
    const dx = T.waypoint.x - T.x, dz = T.waypoint.z - T.z, dist = Math.hypot(dx,dz);
    if(dist < 25){ T.waypoint = null; if(!isPlayer) feed('>> ' + T.name + ' IN POSITION'); }
    else {
      const want = Math.atan2(dx,dz);
      let diff = ((want - T.heading + Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2) - Math.PI;
      turn = THREE.MathUtils.clamp(diff*2, -1, 1);
      fwd = Math.abs(diff) < 1.1 ? 1 : 0.25;
    }
  }
  // snappier drive model: quick spool-up, tight low-speed turns
  const deckY = bridgeDeckY(T.x, T.z);
  const flooded = deckY === null && (inWater(T.x, T.z) || heightAt(T.x, T.z) < waterLevel() - 2);
  const targetSpeed = fwd * (flooded ? 13 : 46);
  if(flooded && Math.abs(T.speed) > 3 && Math.random() < dt*4)
    burst(new THREE.Vector3(T.x, waterLevel()+0.5, T.z), 3, CYAN, 7, 5);
  T.speed += (targetSpeed - T.speed) * Math.min(1, dt*5.5);
  T.heading += turn * dt * (2.3 - Math.min(1,Math.abs(T.speed)/45)) * (T.speed<-0.5?-1:1);
  if(isPlayer && fwd > 0.3 && Math.abs(turn) < 0.25 && deckY === null) roadAssist(T, dt);
  const half = WORLD/2 - 60;
  const nx = THREE.MathUtils.clamp(T.x + Math.sin(T.heading)*T.speed*dt, -half, half);
  const nz = THREE.MathUtils.clamp(T.z + Math.cos(T.heading)*T.speed*dt, -half, half);
  const onDeck = deckY !== null;
  const airborne = T.mode === 'heli' && T.alt > 6;
  if(T.mode === 'boat'){                                          // boats stay on water
    if(inWater(nx, nz)){ T.x = nx; T.z = nz; }
    else { T.speed *= 0.4; burst(new THREE.Vector3(T.x, T.g.position.y+1, T.z), 4, CYAN, 6, 4); }
  }
  else if(airborne || onDeck || !blocked(nx, nz)){ T.x = nx; T.z = nz; T.stuckT = 0; }
  else if(!blocked(nx, T.z)){ T.x = nx; T.speed *= 0.8; }           // slide along the wall
  else if(!blocked(T.x, nz)){ T.z = nz; T.speed *= 0.8; }
  else {
    if(Math.abs(T.speed) > 14 && isPlayer){ sfx.lost(); burst(new THREE.Vector3(T.x, heightAt(T.x,T.z)+3, T.z), 8, PHOS, 10, 6); }
    T.speed = 0;
    if(!isPlayer && T.waypoint){                                     // AI unstick: nudge round the corner
      T.stuckT = (T.stuckT||0) + dt;
      if(T.stuckT > 1.6){ T.heading += 0.9; T.stuckT = 0; }
    }
  }
  let ty = deckY !== null ? deckY : heightAt(T.x, T.z);
  if(T.mode === 'heli'){
    const climb = (isPlayer ? ((keys.Space?1:0) + (input.fire?0:0)) : 0) // space climbs
                + (isPlayer && keys.KeyX ? -1 : 0);
    // mobile: holding stick fully forward+boost? use honk-free vertical: drag knob Y handled below
    T.vy += ((isPlayer ? climb : 0) * 30 - 0) * dt;
    // auto-hover floor: heli wants 26m + terrain; stick-Y full up adds altitude via climbInput set in HUD btns
    const want = ty + 26 + (T.altBias||0);
    T.alt += ((want - (ty + T.alt)) * 0.0 + (T.climb||0) * 24) * dt;
    T.alt = THREE.MathUtils.clamp(T.alt + (26 + (T.altBias||0) - T.alt) * dt * 0.8, 6, 320);
    ty += T.alt;
  } else if(T.mode === 'boat'){
    T.alt = 0;
    ty = Math.max(waterLevel(), heightAt(T.x,T.z)) + 0.4;
    if(Math.abs(T.speed) > 3 && Math.random() < dt*14)
      burst(new THREE.Vector3(T.x - Math.sin(T.heading)*5, ty+0.3, T.z - Math.cos(T.heading)*5), 3, CYAN, 6, 2);
  } else T.alt = 0;
  T.g.position.set(T.x, ty, T.z);
  const ahead = heightAt(T.x+Math.sin(T.heading)*3.2, T.z+Math.cos(T.heading)*3.2);
  const behind = heightAt(T.x-Math.sin(T.heading)*3.2, T.z-Math.cos(T.heading)*3.2);
  const right = heightAt(T.x+Math.cos(T.heading)*2.2, T.z-Math.sin(T.heading)*2.2);
  const left  = heightAt(T.x-Math.cos(T.heading)*2.2, T.z+Math.sin(T.heading)*2.2);
  const lean = T.mode === 'heli' ? new THREE.Euler(THREE.MathUtils.clamp(T.speed*0.006,-0.3,0.3), T.heading, -turn*0.25, 'YXZ')
    : T.mode === 'boat' ? new THREE.Euler(Math.sin(performance.now()/700)*0.03, T.heading, -turn*0.12 + Math.sin(performance.now()/900)*0.04, 'YXZ')
    : (deckY !== null ? new THREE.Euler(0, T.heading, 0, 'YXZ')
      : new THREE.Euler(Math.atan2(behind-ahead, 6.4), T.heading, Math.atan2(right-left, 4.4), 'YXZ'));
  T.g.quaternion.slerp(new THREE.Quaternion().setFromEuler(lean), Math.min(1, dt*7));
  if(Math.abs(T.speed) > 5 && Math.random()<dt*10)
    burst(new THREE.Vector3(T.x - Math.sin(T.heading)*4, ty+0.8, T.z - Math.cos(T.heading)*4), 2, PHOS, 5, 3);
  // turret: auto-track nearest dragon
  let aimD = null, bd = 460*460;
  for(const d of dragons){ if(d.state==='dead') continue;
    const dd = (d.g.position.x-T.x)**2 + (d.g.position.z-T.z)**2;
    if(dd<bd){bd=dd;aimD=d;}
  }
  let desired = null;
  if(isPlayer && input.manualT > 0 && input.aimAngle !== null){
    input.manualT -= dt;
    desired = input.aimAngle;                      // relative to tank forward (screen-up)
  } else if(aimD){
    desired = Math.atan2(aimD.g.position.x-T.x, aimD.g.position.z-T.z) - T.heading;
  }
  if(desired !== null){
    let diff = ((desired - T.turret.rotation.y + Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2) - Math.PI;
    T.turret.rotation.y += diff*Math.min(1, dt*(input.manualT > 0 && isPlayer ? 11 : 6));
  }
  T.cool -= dt;
  if(isPlayer ? input.fire : (aimD && bd < 340*340)) fireConker(T);
  T.tag.visible = !(isPlayer && state.view==='drive');
  T.blip.position.set(T.x, 60, T.z);
  T.blip.scale.setScalar(state.map.h/55);
  T.blip.rotation.z = -T.heading;
  T.blip.material.color.setHex(tanks.indexOf(T)===state.selected ? 0xffffff : PHOS);
  return ty;
}

/* aim reticle: where the active tank's conker will land */
const reticle = new THREE.Mesh(new THREE.TorusGeometry(7, 0.5, 6, 18),
  new THREE.MeshBasicMaterial({color:AMBER, transparent:true, opacity:0.5, depthTest:false}));
reticle.rotation.x = -Math.PI/2; reticle.renderOrder = 8; reticle.visible = false;
scene.add(reticle);
function updateReticle(){
  const T = activeTank();
  if(state.view !== 'drive'){ reticle.visible = false; return; }
  const a = T.heading + T.turret.rotation.y, RANGE = 142;
  const rx = T.x + Math.sin(a)*RANGE, rz = T.z + Math.cos(a)*RANGE;
  reticle.position.set(rx, (bridgeDeckY(rx,rz) ?? heightAt(rx,rz)) + 1.2, rz);
  reticle.visible = true;
  reticle.material.opacity = 0.35 + 0.2*Math.sin(performance.now()/200);
}

/* ---------- wub: the bass made visible ---------- */
let wubAmp = 0, bloomFlare = 0; const wubSet = [];
const wubRings = [];
for(let i=0;i<3;i++){
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.22, 6, 40),
    new THREE.MeshBasicMaterial({color:0xcc7722, transparent:true, opacity:0, depthWrite:false}));
  ring.rotation.x = -Math.PI/2; ring.renderOrder = 7; scene.add(ring); wubRings.push({m:ring, t:9});
}
function bassHit(){
  wubAmp = 1;
  const T = activeTank();
  const r = wubRings.find(r => r.t > 1) || wubRings[0];
  r.t = 0; r.m.position.set(T.x, T.g.position.y + 1.5, T.z);
  wubSet.length = 0;
  for(let i=0;i<treeState.length && wubSet.length<140;i+=2){
    const t = treeState[i];
    if(t.alive && (t.x-T.x)**2 + (t.z-T.z)**2 < 170*170) wubSet.push(i);
  }
}
function updateWub(dt){
  if(sfx.onBass === null || sfx.onBass === undefined) sfx.onBass = bassHit;
  for(const r of wubRings){
    if(r.t > 2) { r.m.material.opacity = 0; continue; }
    r.t += dt*1.4;
    const s2 = 4 + r.t*160;
    r.m.scale.set(s2, s2, 1);
    r.m.material.opacity = Math.min(r.t*4, 1) * Math.max(0, 0.22 - r.t*0.14);
  }
  if(wubAmp > 0.02){
    wubAmp *= Math.exp(-dt*2.6);
    if(fabricEdgesMat) fabricEdgesMat.opacity = 0.55 + wubAmp*0.4;
    for(const i of wubSet){
      const t = treeState[i];
      if(t.alive) { t.wub = wubAmp; placeCanopy(t, 1 + wubAmp*0.22*Math.sin(performance.now()/55 + i)); }
    }
  } else if(wubSet.length){
    for(const i of wubSet) if(treeState[i].alive) placeCanopy(treeState[i], 1);
    wubSet.length = 0;
    if(fabricEdgesMat) fabricEdgesMat.opacity = 0.55;
  }
}

/* ---------- main loop ---------- */
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
let spawnTick = 0, munchSfxTick = 0;

function tick(){
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  if(!state.running || state.paused){ renderLayers(); return; }

  updateAuto(dt);
  let activeY = 0;
  tanks.forEach((T,i)=>{ const y = updateTank(T, dt, i===state.active && !state.auto); if(i===state.active) activeY = y; });
  updateTransmissions(dt);
  updateGrowing(dt);
  updateWeather(dt);
  updateWub(dt);
  if(bloomFlare > 0.01){ bloom.strength = 0.55 + bloomFlare*1.5; bloomFlare *= Math.exp(-dt*3.2); }
  else if(bloom.strength !== 0.55) bloom.strength = 0.55;
  updateTraffic(dt);
  updatePeople(dt);
  updateReticle();
  radio.update(dt);
  tideT += dt;
  if(waterMesh){ waterMesh.position.y = waterLevel();
    waterMesh.children[0].material.opacity = 0.22 + 0.12*Math.sin(tideT*1.7); }
  if(controlBeacon) controlBeacon.rotation.y += dt*1.5;
  sfx.engine(state.view==='drive' ? activeTank().speed : 0);

  /* conkers */
  for(let i=conkers.length-1;i>=0;i--){
    const c = conkers[i];
    c.v.y -= 80*dt; c.m.position.addScaledVector(c.v, dt); c.life -= dt;
    burst(c.m.position, 1, AMBER, 1.2, 0.4);   // tracer
    let hit = false;
    for(const d of dragons){
      if(d.state!=='dead' && c.m.position.distanceTo(d.g.position) < 20){
        d.state='dead'; d.deadT = 1.4; state.score += 10;
        sfx.pop(); burst(d.g.position, 24, ENEMY, 24, 16); burst(d.g.position, 14, PHOS, 16, 12);
        actionCam(d.g.position, 1.0);
        const popline = POPLINES[(Math.random()*POPLINES.length)|0];
        dragonSay(d, popline, 1.2);
        radio.speakPop(popline);
        if(d.target>=0 && treeState[d.target]){
          feed('>> SAVED A ' + TREES.species[treeState[d.target].sp].toUpperCase() + ' +10');
          treeState[d.target].busy = false;
        } else feed('>> DRAGON CONKERED +10');
        emit('dragon-conkered', { score: state.score });
        hit = true; break;
      }
    }
    if(hit || c.life<=0 || c.m.position.y < heightAt(c.m.position.x, c.m.position.z)){
      if(!hit && c.life>0){ burst(c.m.position, 8, PHOS, 8, 6); plantSapling(c.m.position.x, c.m.position.z); }
      scene.remove(c.m); conkers.splice(i,1);
    }
  }

  /* dragons */
  spawnTick -= dt;
  if(state.dragonsToSpawn > 0 && spawnTick <= 0 && dragons.filter(d=>d.state!=='dead').length < 10){
    spawnDragon(state.speedMul); state.dragonsToSpawn--; spawnTick = 1.6;
  }
  if(state.dragonsToSpawn===0 && dragons.length===0){
    state.waveTimer -= dt;
    if(state.waveTimer<=0){ state.waveTimer = 6; startWave(); }
  }
  munchSfxTick -= dt;
  for(let i=dragons.length-1;i>=0;i--){
    const d = dragons[i]; d.t += dt;
    const U = d.g.userData;
    // pose: 0 = soaring, 1 = folded (perch/munch); dive = swept-back surge
    const wantFold = (d.state==='munch' || d.state==='perch') ? 1 : 0;
    d.fold = THREE.MathUtils.lerp(d.fold ?? 0, wantFold, dt*3);
    const diving = d.state==='seek' && d.target>=0 && d.g.position.y > (treeState[d.target]?.y ?? 0) + 40;
    const flapHz = diving ? 11 : 6 - d.fold*4;
    const flapA = Math.sin(d.t*flapHz) * (0.8 - d.fold*0.65);
    if(U.wingL){
      U.wingL.rotation.z =  0.18 + flapA*0.55 + d.fold*1.05;
      U.wingR.rotation.z = -0.18 - flapA*0.55 - d.fold*1.05;
      const fold2 = Math.sin(d.t*flapHz - 0.7)*0.5*(1-d.fold);
      if(U.elbowL){ U.elbowL.rotation.z = -0.25 - fold2*0.5 - d.fold*1.5; U.elbowR.rotation.z = 0.25 + fold2*0.5 + d.fold*1.5; }
    }
    for(const mk of ['memL','memR']){                              // living membrane
      const mem = U[mk]; if(!mem) continue;
      const mp = mem.geometry.attributes.position;
      for(let vi=0; vi<mp.count; vi++){
        const mx = mp.getX(vi);
        mp.setZ(vi, Math.sin(d.t*flapHz*1.1 + mx*0.5) * 0.28 * (Math.abs(mx)/5.5) * (1-d.fold*0.7));
      }
      mp.needsUpdate = true;
    }
    if(U.tail) U.tail.rotation.y = Math.sin(d.t*1.9)*0.35;
    if(U.neck) U.neck.rotation.y = Math.sin(d.t*1.3)*0.18;
    if(U.jaw) U.jaw.rotation.x = d.state==='munch' ? 0.35 + Math.sin(d.t*16)*0.3 : 0.05;
    d.g.scale.setScalar(2.6 * (1 + d.fold*0.015*Math.sin(d.t*2.4)));   // breathing at rest
    if(Math.random() < dt*(d.state==='munch'?5:1.5)){                  // nostril embers
      const hp = new THREE.Vector3(0, 1.4, 12).applyQuaternion(d.g.quaternion).add(d.g.position);
      burst(hp, 2, 0xff8833, 3.5, 1.6);
    }
    if(d.bubbleT !== undefined){ d.bubbleT -= dt; if(d.bubbleT<=0){ d.g.userData.bubble.visible=false; d.bubbleT=undefined; } }
    d.blip.position.set(d.g.position.x, 60, d.g.position.z);
    d.blip.scale.setScalar(state.map.h/70);
    d.blip.rotation.y += dt*2;
    if(d.state==='dead'){
      d.deadT -= dt; d.g.rotation.z += dt*9; d.g.position.y -= 70*dt;
      if(d.deadT<=0){ scene.remove(d.g); scene.remove(d.blip); dragons.splice(i,1); }
      continue;
    }
    if(d.state==='perch'){
      const dir = d.perchPos.clone().sub(d.g.position), dist = dir.length();
      if(dist > 3){
        d.g.lookAt(d.perchPos);
        d.g.position.addScaledVector(dir.normalize(), Math.min(d.speed*dt, dist));
      } else {
        d.g.position.y = d.perchPos.y + Math.sin(d.t*2.2)*0.3;     // settled, scanning
        d.perchT -= dt;
        if(d.perchT < 1 && !d.saidPerch){ d.saidPerch = true; dragonSay(d, PERCHQUIPS[(Math.random()*PERCHQUIPS.length)|0], 1.6); }
        if(d.perchT <= 0){ d.state = 'seek'; d.saidPerch = false; }
      }
      continue;
    }
    if(d.state==='flee'){
      d.scare -= dt; d.g.position.y += 40*dt; d.g.translateZ(d.speed*1.6*dt);
      if(d.scare<=0) d.state='seek';
      continue;
    }
    if(d.state==='seek'){
      if(d.target<0 || !treeState[d.target] || !treeState[d.target].alive){
        const A = activeTank();
        const bias = { x: d.g.position.x*0.3 + A.x*0.7 + (Math.random()-0.5)*160,
                       z: d.g.position.z*0.3 + A.z*0.7 + (Math.random()-0.5)*160 };
        d.target = nearestAliveTree(bias, true);
        if(d.target>=0) treeState[d.target].busy = true;
      }
      if(d.target>=0){
        const t = treeState[d.target];
        // fancy a rooftop on the way? scope out the target like a proper gargoyle
        if(!d.perched && roofTops){
          const dx = d.g.position.x - t.x, dz = d.g.position.z - t.z, dd = Math.hypot(dx, dz);
          if(dd > 55 && dd < 190){
            const px = t.x + dx/dd*42, pz = t.z + dz/dd*42;
            const bIdx = inBuildingIdx(px, pz);
            if(bIdx >= 0){
              d.perched = true; d.state = 'perch';
              d.perchPos = new THREE.Vector3(px, roofTops[bIdx] + 2.5, pz);
              d.perchT = 1.2 + Math.random()*1.6;
              continue;
            }
            d.perched = true;            // no roof on the approach: don't keep checking
          }
        }
        const goal = new THREE.Vector3(t.x, t.y + t.h + 6, t.z);
        const dir = goal.clone().sub(d.g.position), dist = dir.length();
        d.g.lookAt(goal);
        d.g.position.addScaledVector(dir.normalize(), Math.min(d.speed*dt, dist));
        d.g.position.y += Math.sin(d.t*3)*0.25;
        if(dist < 4){ d.state='munch'; d.munch=0; d.perched=false; dragonSay(d, QUIPS[(Math.random()*QUIPS.length)|0], 2.6);
          actionCam(d.g.position, 1.8); }
      }
    } else if(d.state==='munch'){
      const t = treeState[d.target];
      if(!t || !t.alive){ d.state='seek'; d.target=-1; continue; }
      d.munch += dt/7;
      d.g.position.y = t.y + t.h*(1-d.munch)*0.8 + 5 + Math.sin(d.t*14)*0.5;
      shrinkTree(d.target, Math.max(0.01, 1-d.munch));
      if(munchSfxTick<=0){ sfx.munch(); munchSfxTick=0.35; }
      if(Math.random()<dt*6) burst(new THREE.Vector3(t.x,t.y+t.h*0.6,t.z), 2, ENEMY, 8, 4);
      if(d.munch>=1){
        t.alive=false; t.busy=false; aliveTrees--; state.lost++;
        feed('>> LOST A ' + TREES.species[t.sp].toUpperCase());
        emit('tree-lost', { species: TREES.species[t.sp], remaining: aliveTrees });
        sfx.lost();
        d.target=-1; d.state='seek';
        if(state.lost >= state.lostLimit) return gameOver();
      }
    }
  }

  /* particles */
  const pp = pGeo.attributes.position.array, pc = pGeo.attributes.color.array;
  for(let i=0;i<PMAX;i++){
    const p = particles[i];
    if(p.life>0){
      p.life-=dt; p.vy-=22*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt;
      pp[i*3]=p.x; pp[i*3+1]=p.y; pp[i*3+2]=p.z;
      const f = Math.max(0,Math.min(1,p.life));
      pc[i*3]=p.r*f; pc[i*3+1]=p.g*f; pc[i*3+2]=p.b*f;
    } else pp[i*3+1] = -9999;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;

  /* camera */
  if(state.view === 'drive'){
    scene.fog.near = 1000; scene.fog.far = 3400;
    const T = activeTank();
    const portrait = innerHeight > innerWidth;
    // wireframe trees are see-through: ride low and close for speed feel
    const heliCam = T.mode === 'heli';
    const back = (portrait ? 26 : 24) + (heliCam ? 16 : 0), up = (portrait ? 30 : 18) + (heliCam ? T.alt*0.3 : 0);
    camPos.set(T.x - Math.sin(T.heading)*back, activeY + up, T.z - Math.cos(T.heading)*back);
    camPos.y = Math.max(camPos.y, (bridgeDeckY(camPos.x,camPos.z) ?? heightAt(camPos.x, camPos.z)) + 5);
    camera.position.lerp(camPos, Math.min(1, dt*4));
    camTarget.set(T.x + Math.sin(T.heading)*30, activeY + 3, T.z + Math.cos(T.heading)*30);
    camera.lookAt(camTarget);
    camera.fov += ((62 + Math.abs(T.speed)*0.35) - camera.fov)*dt*3;
  } else {
    // fog must follow the camera up, or high zoom fades the city to black
    scene.fog.near = state.map.h * 0.9; scene.fog.far = state.map.h * 2.6 + 800;
    // zoom in far enough and the map tips into an oblique aerial view
    const obl = THREE.MathUtils.clamp((2100 - state.map.h)/1400, 0, 1) * 0.62;
    camera.up.set(0, obl > 0.04 ? 1 : 0, -1).normalize();
    camPos.set(state.map.cx, state.map.h, state.map.cz + state.map.h*obl);
    camera.position.lerp(camPos, Math.min(1, dt*5));
    camera.lookAt(state.map.cx, 0, state.map.cz);
    camera.fov += (55 - camera.fov)*dt*4;
    const pxPerKm = innerHeight * 1000 / (2 * state.map.h * Math.tan(camera.fov/2 * Math.PI/180));
    $('scalebarline').style.width = Math.max(20, Math.min(240, pxPerKm)) + 'px';
  }
  camera.updateProjectionMatrix();

  updateHud();
  renderLayers();
}
function renderLayers(){
  camera.layers.disable(1);
  composer.render();                    // world: bloom + grain
  camera.layers.set(1);
  renderer.autoClear = false;
  const bg = scene.background; scene.background = null;   // else the bg repaints over the composed frame
  const fg = scene.fog; scene.fog = null;
  renderer.render(scene, camera);       // labels: raw, readable
  scene.background = bg; scene.fog = fg;
  renderer.autoClear = true;
  camera.layers.enableAll();
}

function gameOver(){
  saveForest();
  state.running = false;
  $('finalstats').innerHTML = `SCORE <b style="color:#00ff66">${state.score}</b> · WAVES: ${state.wave}` +
    ` · TREES LOST: ${state.lost.toLocaleString()} OF ${totalTrees.toLocaleString()}`;
  const best = Math.max(state.score, +(localStorage.getItem('tftt-best')||0));
  localStorage.setItem('tftt-best', best);
  $('finalquip').textContent = state.score >= best && state.score>0
    ? '*** NEW BEST. THE LORD MAYOR SENDS A COMMEMORATIVE CONKER ***'
    : 'THE DRAGONS COMPLIMENT THE CHEF. BEST: ' + best;
  $('gameover').classList.remove('hidden');
}

addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

/* ---------- boot ---------- */
(async function boot(){
  const note = $('loadnote'); const btn = $('startbtn'); btn.disabled = true; btn.style.opacity = 0.5;
  try{
    note.textContent = 'FETCHING REAL BRISTOL ELEVATION (EU-DEM 25M)…';
    ELEV = await loadJson('data/elevation-bristol.json');
    note.textContent = 'PLANTING ALL THE REAL TREES…';
    TREES = await loadJson('data/trees-bristol.json');
    note.textContent = 'PAINTING THE REAL ROADS (© OSM)…';
    try{ ROADS = await loadJson('data/roads-bristol.json'); }catch(e){ ROADS = null; }
    try{ GREENS = await loadJson('data/greens-bristol.json'); }catch(e){ GREENS = null; }
    try{ WATER = await loadJson('data/water-bristol.json'); }catch(e){ WATER = null; }
    try{ FABRIC = await loadJson('data/fabric-bristol.json'); }catch(e){ FABRIC = null; }
    try{ PUBS = await loadJson('data/pubs-bristol.json'); }catch(e){ PUBS = null; }
    try{ SHOPS = await loadJson('data/shops-bristol.json'); }catch(e){ SHOPS = null; }
    $('ntrees').textContent = TREES.trees.length.toLocaleString();
    buildTerrain(); buildWater(); buildContours(); buildGreens(); buildFabric(); buildCollisionGrid(); buildPubs(); buildShops(); buildWeather(); buildTraffic(); buildPeople(); buildTrees(); buildRoads(); buildNavGraph(); buildBridge(); buildLandmarks(); buildControl();
    TANK_NAMES.forEach((nm,i)=> tanks.push(new Tank(nm, ...TANK_SPAWNS[i])));
    buildFleetHud();
    const T = activeTank();
    T.g.position.set(T.x, heightAt(T.x,T.z), T.z);
    camera.position.set(T.x-60, heightAt(T.x,T.z)+45, T.z-60);
    camera.lookAt(T.g.position);
    loadForest();
    renderLayers();
    note.textContent = '[B1649] ANGERING ' + TREES.species.length + ' SPECIES WORTH OF DRAGONS… READY';
    btn.disabled = false; btn.style.opacity = 1;
  }catch(e){
    note.textContent = '!! COULD NOT LOAD DATA: ' + e.message;
    console.error(e);
  }
  btn.addEventListener('click', ()=>{
    sfx.init();
    setTimeout(()=>sfx.musicStart(), 1200);
    $('splash').classList.add('hidden');
    state.running = true;
    setView('drive');
    startWave();
  });
})();
tick();
window.__tftt = { scene, camera, renderer, composer, state, dragons, tanks, plantSapling, heightAt, waterLevel, inBuilding, inBuildingIdx, treeState, rGrid, roadAssist, get aliveTrees(){return aliveTrees;} };  // headless playtest hook
/* ---------- public API: scenes around town, scripted from outside ---------- */
const emit = (event, data) => {
  host.dispatchEvent(new CustomEvent(event, { detail: data }));
  try{ if(window.parent !== window) window.parent.postMessage({ type:'bristol-scene', event, data }, '*'); }catch(e){}
};
host.api = {
  start(){ $('startbtn')?.click(); },
  jackIn, setView, setMode: m => setMode(activeTank(), m), setAuto,
  goto(easting, northing){ const T = activeTank(); T.x = easting-E0; T.z = -(northing-N0); T.nav = null; T.navRoute = null; },
  driveTo(easting, northing){ const T = activeTank();
    const pts = routeTo(T, easting-E0, -(northing-N0));
    if(pts){ T.navRoute = { pts, i: 0 }; T.nav = null; } return !!pts; },
  lookAtMap(easting, northing, h=1200){ setView('map'); state.map.cx = easting-E0; state.map.cz = -(northing-N0); state.map.h = h; },
  honk: doHonk, radio: toggleRadio,
  state: () => ({ running: state.running, view: state.view, score: state.score, wave: state.wave,
    trees: aliveTrees, mode: activeTank().mode, auto: state.auto?.kind || null,
    position: { easting: Math.round(activeTank().x + E0), northing: Math.round(-activeTank().z + N0) } }),
};
addEventListener('message', e => {
  const m = e.data;
  if(!m || m.type !== 'bristol-scene-cmd' || typeof host.api[m.cmd] !== 'function') return;
  const r = host.api[m.cmd](...(m.args || []));
  if(m.cmd === 'state') e.source?.postMessage({ type:'bristol-scene', event:'state', data: r }, '*');
});
emit('scene-ready', {});

}

export class BristolScene extends HTMLElement {
  connectedCallback() {
    if (this._booted) return;
    this._booted = true;
    this.style.cssText = 'position:fixed;inset:0;display:block;';
    const style = document.createElement('style');
    style.textContent = TEMPLATE_CSS;
    this.appendChild(style);
    const mount = document.createElement('div');
    mount.innerHTML = TEMPLATE_HTML;
    this.appendChild(mount);
    bootGame(this, {
      ui: this.getAttribute('ui') || 'full',
      autostart: this.hasAttribute('autostart'),
      datebase: this.getAttribute('data-base') || '',
    });
  }
}
customElements.define('bristol-scene', BristolScene);
