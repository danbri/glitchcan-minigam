/*
  Skyport WebGPU PWA
  - zero external dependencies
  - procedural WGSL shaders: sky, water, clouds, tilt-shift post
  - cacheable/offline via service worker
*/

const canvas = document.getElementById('scene');
const fpsEl = document.getElementById('fps');
const promptEl = document.getElementById('prompt');
const planeCard = document.getElementById('planeCard');

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

function showNoSupport(message) {
  const div = document.createElement('div');
  div.className = 'nosupport';
  div.innerHTML = `<div><h1>WebGPU unavailable</h1><p>${message}</p><p>This build is intentionally WebGPU-only. Serve it from localhost or HTTPS and use a recent browser with WebGPU enabled.</p></div>`;
  document.body.appendChild(div);
}

// ---------- Tiny vector/matrix helpers ----------
function v3(x=0,y=0,z=0){ return [x,y,z]; }
function sub(a,b){ return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function add(a,b){ return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
function muls(a,s){ return [a[0]*s, a[1]*s, a[2]*s]; }
function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function cross(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function len(a){ return Math.hypot(a[0],a[1],a[2]); }
function norm(a){ const l=len(a)||1; return [a[0]/l,a[1]/l,a[2]/l]; }
function mix3(a,b,t){ return [lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)]; }
function shadeColor(c, f){ return [clamp(c[0]*f,0,1), clamp(c[1]*f,0,1), clamp(c[2]*f,0,1), c[3] ?? 1]; }

function perspective(out, fovy, aspect, near, far) {
  const f = 1.0 / Math.tan(fovy / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = far / (near - far);
  out[11] = -1;
  out[14] = (far * near) / (near - far);
  return out;
}

function lookAt(out, eye, center, up) {
  const z = norm(sub(eye, center));
  const x = norm(cross(up, z));
  const y = cross(z, x);
  out[0]=x[0]; out[1]=y[0]; out[2]=z[0]; out[3]=0;
  out[4]=x[1]; out[5]=y[1]; out[6]=z[1]; out[7]=0;
  out[8]=x[2]; out[9]=y[2]; out[10]=z[2]; out[11]=0;
  out[12]=-dot(x, eye); out[13]=-dot(y, eye); out[14]=-dot(z, eye); out[15]=1;
  return out;
}

function mulMat4(out, a, b) {
  const r = new Float32Array(16);
  for (let c=0; c<4; c++) {
    for (let r0=0; r0<4; r0++) {
      r[c*4+r0] = a[0*4+r0]*b[c*4+0] + a[1*4+r0]*b[c*4+1] + a[2*4+r0]*b[c*4+2] + a[3*4+r0]*b[c*4+3];
    }
  }
  out.set(r); return out;
}

function projectPoint(m, p, w, h) {
  const x=p[0], y=p[1], z=p[2];
  const cx = m[0]*x + m[4]*y + m[8]*z + m[12];
  const cy = m[1]*x + m[5]*y + m[9]*z + m[13];
  const cz = m[2]*x + m[6]*y + m[10]*z + m[14];
  const cw = m[3]*x + m[7]*y + m[11]*z + m[15];
  if (cw <= 0.0001) return null;
  const ndcX = cx / cw, ndcY = cy / cw, ndcZ = cz / cw;
  return { x: (ndcX * 0.5 + 0.5) * w, y: (-ndcY * 0.5 + 0.5) * h, z: ndcZ, visible: ndcX > -1.2 && ndcX < 1.2 && ndcY > -1.2 && ndcY < 1.2 && ndcZ > 0 && ndcZ < 1 };
}

// ---------- Mesh generation ----------
class MeshBuilder {
  constructor(){ this.v=[]; this.i=[]; }
  vertex(p, n, c, mat){
    this.v.push(p[0],p[1],p[2], n[0],n[1],n[2], c[0],c[1],c[2],c[3] ?? 1, mat);
    return this.v.length/11 - 1;
  }
  tri(a,b,c){ this.i.push(a,b,c); }
  quad(p0,p1,p2,p3,n,c,mat){
    const a=this.vertex(p0,n,c,mat), b=this.vertex(p1,n,c,mat), cc=this.vertex(p2,n,c,mat), d=this.vertex(p3,n,c,mat);
    this.i.push(a,b,cc, a,cc,d);
  }
  face(p0,p1,p2,p3,c,mat){
    const n = norm(cross(sub(p1,p0), sub(p2,p0)));
    this.quad(p0,p1,p2,p3,n,c,mat);
  }
  box(cx,cy,cz, sx,sy,sz, color, mat=0){
    const x0=cx-sx/2,x1=cx+sx/2,y0=cy,y1=cy+sy,z0=cz-sz/2,z1=cz+sz/2;
    this.quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,1,0],shadeColor(color,1.14),mat); // top
    this.quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0],shadeColor(color,.72),mat); // bottom
    this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],shadeColor(color,.92),mat);
    this.quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1],shadeColor(color,.80),mat);
    this.quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0],shadeColor(color,1.02),mat);
    this.quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0],shadeColor(color,.75),mat);
  }
  ellipse(cx,cy,cz, rx,rz, color, mat=7, segments=28){
    const center = this.vertex([cx,cy,cz],[0,1,0],color,mat);
    let first=-1, prev=-1;
    for (let k=0;k<=segments;k++) {
      const a = k/segments*TAU;
      const idx = this.vertex([cx+Math.cos(a)*rx, cy, cz+Math.sin(a)*rz],[0,1,0],color,mat);
      if (k===0) first=idx; else this.tri(center, prev, idx);
      prev=idx;
    }
  }
  rotatedRect(cx,cz,y,w,l,ang,color,mat=0){
    const ca=Math.cos(ang), sa=Math.sin(ang);
    const p = (x,z)=>[cx + ca*x - sa*z, y, cz + sa*x + ca*z];
    this.quad(p(-w/2,-l/2), p(w/2,-l/2), p(w/2,l/2), p(-w/2,l/2), [0,1,0], color, mat);
  }
  pyramid(cx,cz, base, h, color, mat=3){
    const y=0.05, b=base/2, peak=[cx, y+h, cz];
    const p0=[cx-b,y,cz-b], p1=[cx+b,y,cz-b], p2=[cx+b,y,cz+b], p3=[cx-b,y,cz+b];
    this.face(p0,p1,peak,peak,shadeColor(color,1.05),mat);
    this.face(p1,p2,peak,peak,shadeColor(color,.88),mat);
    this.face(p2,p3,peak,peak,shadeColor(color,.68),mat);
    this.face(p3,p0,peak,peak,shadeColor(color,.95),mat);
  }
  barrel(cx,cy,cz,sx,sy,sz,color,mat=6,segments=10){
    // Low-poly hangar: rectangular base plus half-cylinder roof.
    this.box(cx,cy,cz,sx,sy*.55,sz,shadeColor(color,.9),mat);
    const x0=cx-sx/2,x1=cx+sx/2,z0=cz-sz/2,z1=cz+sz/2;
    const yc=cy+sy*.55, r=sy*.45;
    for (let s=0;s<segments;s++) {
      const a0=Math.PI - s/segments*Math.PI;
      const a1=Math.PI - (s+1)/segments*Math.PI;
      const y0=yc + Math.sin(a0)*r, y1=yc + Math.sin(a1)*r;
      const zz0=cz + Math.cos(a0)*sz/2, zz1=cz + Math.cos(a1)*sz/2;
      this.quad([x0,y0,zz0],[x1,y0,zz0],[x1,y1,zz1],[x0,y1,zz1],norm([0,Math.sin((a0+a1)/2),Math.cos((a0+a1)/2)]),shadeColor(color,1.04),mat);
    }
  }
}

function buildScene() {
  const m = new MeshBuilder();
  const ground = [0.43,0.51,0.32,1];
  const grass2 = [0.36,0.48,0.31,1];
  const sand = [0.76,0.72,0.50,1];
  const concrete = [0.55,0.56,0.51,1];
  const asphalt = [0.055,0.075,0.075,1];
  const paint = [0.90,0.91,0.87,1];
  const teal = [0.02,0.64,0.60,1];
  const gold = [0.72,0.56,0.26,1];
  const tan = [0.68,0.58,0.43,1];
  const glass = [0.45,0.76,0.83,1];

  // World layers.
  m.rotatedRect(0,-24,0,180,220,0,ground,0);
  m.rotatedRect(0,-116,0.012,220,80,0,[0.09,0.43,0.58,1],4); // water
  m.rotatedRect(0,-76,0.018,190,15,0,sand,0);
  m.rotatedRect(15,-41,0.025,92,32,0,shadeColor(concrete,1.04),6); // airport apron

  // Runway axis.
  const rAng = -0.34, rw = 18, rl = 190, rcx=-36, rcz=-22;
  m.rotatedRect(rcx,rcz,0.055,rw,rl,rAng,asphalt,1);
  m.rotatedRect(rcx,rcz,0.062,1.15,rl*0.93,rAng,paint,2); // center base, mostly hidden by dashes -> intentional paint glint
  m.rotatedRect(rcx-8*Math.cos(rAng),rcz-8*Math.sin(rAng),0.064,.72,rl*.96,rAng,paint,2);
  m.rotatedRect(rcx+8*Math.cos(rAng),rcz+8*Math.sin(rAng),0.064,.72,rl*.96,rAng,paint,2);
  for (let z=-rl/2+12; z<rl/2-10; z+=18) {
    m.rotatedRect(rcx + Math.sin(rAng)*z, rcz + Math.cos(rAng)*z, 0.071, 1.7, 8.2, rAng, paint, 2);
  }
  // Runway lights: small warm emissive pads, deliberately seated on surface.
  for (let z=-rl/2+8; z<rl/2; z+=9) {
    for (const side of [-1,1]) {
      const lx = side*(rw/2 + 2.2);
      const wx = rcx + Math.cos(rAng)*lx + Math.sin(rAng)*z;
      const wz = rcz + Math.sin(rAng)*lx + Math.cos(rAng)*z;
      m.rotatedRect(wx,wz,0.085,.62,.62,rAng,[1.0,.75,.28,.92],5);
    }
  }

  // Buildings and shadows.
  const buildings = [
    [-18,-46,7,27,7, teal],[-10,-48,8,18,7,[0.35,0.55,0.58,1]],[-2,-51,9,39,8,gold],
    [8,-47,8,20,7,[0.44,0.40,0.33,1]],[19,-50,9,24,8,tan],[-29,-50,6,14,6,[0.06,0.52,0.49,1]],
    [32,-43,8,14,8,[0.37,0.68,0.73,1]],[41,-46,7,11,7,[0.04,0.57,0.55,1]],
  ];
  for (const [x,z,sx,sy,sz,c] of buildings) {
    m.ellipse(x,0.029,z,sx*.88,sz*.78,[0.03,0.04,0.035,.26],7);
    m.box(x,0,z,sx,sy,sz,c,3);
    // Author the silhouette: tiny caps/setbacks so boxes stop feeling like raw primitives.
    if (sy > 18) m.box(x+sx*.12,sy*.52,z-sz*.06,sx*.72,sy*.30,sz*.72,shadeColor(c,1.05),3);
    if (sy > 24) m.box(x-sx*.07,sy*.78,z+sz*.08,sx*.52,sy*.18,sz*.52,shadeColor(c,1.10),3);
  }

  // Spire and airport forms.
  m.ellipse(52,0.028,-48,11,9,[0.02,0.03,0.035,.25],7);
  m.box(52,0,-48,18,4,12,shadeColor(glass,.70),3);
  m.pyramid(52,-50,16,54,glass,3);
  m.box(66,0,-38,5,7,5,[0.55,0.53,0.43,1],6);
  m.box(66,7,-38,8,3,8,[0.75,0.84,0.83,1],3);
  m.box(66,10,-38,1.1,9,1.1,[0.62,0.65,0.63,1],6);
  m.barrel(10,0,-27,16,6,10,[0.30,0.62,0.70,1],6);
  m.barrel(26,0,-26,18,6,10,[0.34,0.66,0.73,1],6);
  m.box(4,0,-32,10,4,8,[0.53,0.39,0.28,1],6);
  m.box(38,0,-31,12,5,9,[0.42,0.64,0.69,1],6);

  // Ground detail: shrubs/rocks break the empty-plane look, cheap but useful.
  for (let k=0;k<70;k++) {
    const x = (Math.random()*2-1)*72;
    const z = -8 + (Math.random()*2-1)*58;
    if (Math.abs(x+36) < 16 && z > -105 && z < 58) continue;
    const s = .35 + Math.random()*.9;
    const col = Math.random()<.65 ? shadeColor(grass2, .8+Math.random()*.35) : [0.58,0.53,0.39,1];
    m.box(x,0.02,z,s,s*(.9+Math.random()*1.2),s,col,0);
  }

  return { vertices: new Float32Array(m.v), indices: new Uint32Array(m.i) };
}

// ---------- WGSL shaders ----------
const shaderCommon = /* wgsl */`
struct Globals {
  viewProj : mat4x4<f32>,
  cameraPosTime : vec4<f32>,
  sunDirExposure : vec4<f32>,
  fogColorDensity : vec4<f32>,
  resolutionFocus : vec4<f32>,
  cameraRight : vec4<f32>,
  cameraUp : vec4<f32>,
  highlightMisc : vec4<f32>,
};
@group(0) @binding(0) var<uniform> g : Globals;

fn hash12(p: vec2<f32>) -> f32 {
  let h = dot(p, vec2<f32>(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}
fn noise2(p: vec2<f32>) -> f32 {
  let i = floor(p); let f = fract(p);
  let u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2<f32>(1.0,0.0)), u.x),
             mix(hash12(i+vec2<f32>(0.0,1.0)), hash12(i+vec2<f32>(1.0,1.0)), u.x), u.y);
}
fn fbm(p0: vec2<f32>) -> f32 {
  var p = p0; var a = 0.5; var v = 0.0;
  for (var i=0; i<4; i=i+1) { v += a * noise2(p); p *= 2.03; a *= .52; }
  return v;
}
fn aces(x: vec3<f32>) -> vec3<f32> {
  let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), vec3<f32>(0.0), vec3<f32>(1.0));
}
`;

const skyWGSL = shaderCommon + /* wgsl */`
struct VOut { @builtin(position) pos : vec4<f32>, @location(0) uv : vec2<f32> };
@vertex fn vs(@builtin(vertex_index) vi:u32) -> VOut {
  var p = array<vec2<f32>,3>(vec2<f32>(-1.0,-1.0), vec2<f32>(3.0,-1.0), vec2<f32>(-1.0,3.0));
  var out: VOut;
  out.pos = vec4<f32>(p[vi],0.0,1.0);
  out.uv = p[vi]*0.5+0.5;
  return out;
}
@fragment fn fs(in:VOut) -> @location(0) vec4<f32> {
  let uv = in.uv;
  let top = vec3<f32>(0.23,0.52,0.82);
  let horizon = vec3<f32>(0.75,0.88,0.96);
  var col = mix(horizon, top, smoothstep(0.05, 1.0, uv.y));
  let sun = vec2<f32>(0.24,0.78);
  let d = distance(uv, sun);
  let glow = exp(-d*7.0) * 0.55 + exp(-d*32.0) * .75;
  col += vec3<f32>(1.0,0.64,0.30) * glow;
  // subtle shader sky grain, dither-safe on mobile OLEDs
  col += (hash12(uv*g.resolutionFocus.xy + g.cameraPosTime.w) - .5) / 255.0;
  return vec4<f32>(col,1.0);
}
`;

const mainWGSL = shaderCommon + /* wgsl */`
struct Vin {
  @location(0) position : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) color : vec4<f32>,
  @location(3) material : f32,
};
struct VOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) world : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) color : vec4<f32>,
  @location(3) material : f32,
};
@vertex fn vs(v: Vin) -> VOut {
  var out: VOut;
  out.world = v.position;
  out.normal = normalize(v.normal);
  out.color = v.color;
  out.material = v.material;
  out.pos = g.viewProj * vec4<f32>(v.position, 1.0);
  return out;
}
fn fog(col: vec3<f32>, world: vec3<f32>) -> vec3<f32> {
  let dist = distance(g.cameraPosTime.xyz, world);
  let base = 1.0 - exp(-dist * g.fogColorDensity.w);
  let horizonBoost = smoothstep(-6.0, 16.0, world.y) * 0.18;
  let f = clamp(base + horizonBoost, 0.0, 0.72);
  return mix(col, g.fogColorDensity.xyz, f);
}
fn waterColor(world: vec3<f32>, n: vec3<f32>) -> vec3<f32> {
  let t = g.cameraPosTime.w;
  let p = world.xz * 0.055;
  let wave = sin((p.x*2.4 + t*.55))*.5 + sin((p.y*3.1 - t*.72))*.5;
  let grain = fbm(p*3.0 + vec2<f32>(t*.025, -t*.018));
  let shallow = vec3<f32>(0.08,0.55,0.68);
  let deep = vec3<f32>(0.02,0.28,0.46);
  var col = mix(deep, shallow, clamp(.48+.22*wave+.25*grain,0.0,1.0));
  let v = normalize(g.cameraPosTime.xyz - world);
  let fres = pow(1.0 - clamp(dot(v,n),0.0,1.0), 3.0);
  let sun = max(dot(reflect(-g.sunDirExposure.xyz, n), v), 0.0);
  col += vec3<f32>(0.70,0.92,1.0) * fres * .24;
  col += vec3<f32>(1.0,0.78,0.42) * pow(sun, 80.0) * .95;
  return col;
}
@fragment fn fs(in: VOut) -> @location(0) vec4<f32> {
  let mat = u32(round(in.material));
  var n = normalize(in.normal);
  var albedo = in.color.rgb;
  let alpha = in.color.a;
  var rough = 0.82;
  var emissive = vec3<f32>(0.0);

  if (mat == 1u) { // asphalt: not pure black; fine procedural roughness
    let r = fbm(in.world.xz*.55) * .07 + noise2(in.world.xz*3.8)*.025;
    albedo = vec3<f32>(0.045,0.060,0.060) + vec3<f32>(r);
    rough = .68;
  } else if (mat == 2u) { // paint
    let dirt = fbm(in.world.xz*.9) * .055;
    albedo = vec3<f32>(0.88,0.89,0.85) - dirt;
    rough = .62;
  } else if (mat == 3u) { // glass/building: low-cost vertical gradient and facets
    let h = clamp(in.world.y / 42.0, 0.0, 1.0);
    albedo = mix(albedo*.78, albedo*1.25 + vec3<f32>(0.05,0.08,0.09), h);
    let bands = step(.82, fract(in.world.y*.62)) * .10 * step(.18, fract(in.world.x*.31 + in.world.z*.19));
    albedo += vec3<f32>(1.0,.78,.42) * bands;
    rough = .42;
  } else if (mat == 4u) {
    albedo = waterColor(in.world, n); rough = .28;
  } else if (mat == 5u) {
    emissive = vec3<f32>(1.0,.58,.12)*2.0;
    albedo = vec3<f32>(1.0,.72,.28); rough=.18;
  } else if (mat == 6u) {
    albedo *= 0.92 + fbm(in.world.xz*.35)*.12;
    rough = .74;
  } else if (mat == 7u) { // contact shadow decal geometry
    return vec4<f32>(in.color.rgb, alpha);
  }

  let sun = normalize(g.sunDirExposure.xyz);
  let ndl = max(dot(n, sun), 0.0);
  let sky = 0.36 + 0.36 * max(n.y,0.0);
  let bounce = 0.08 * max(dot(n, vec3<f32>(0.0,1.0,0.0)),0.0);
  let warmSun = vec3<f32>(1.0,0.76,0.45);
  let coolSky = vec3<f32>(0.55,0.72,0.90);
  var col = albedo * (coolSky*sky + warmSun*ndl*1.18 + bounce);

  // tiny wet runway glints without photorealism
  if (mat == 1u || mat == 2u) {
    let v = normalize(g.cameraPosTime.xyz - in.world);
    let spec = pow(max(dot(reflect(-sun,n), v),0.0), mix(18.0, 70.0, 1.0-rough));
    col += warmSun * spec * 0.33;
  }
  col += emissive;
  col = fog(col, in.world);
  return vec4<f32>(col, alpha);
}
`;

const cloudWGSL = shaderCommon + /* wgsl */`
struct Vin { @location(0) local : vec2<f32> };
struct Inst { @location(1) posSize : vec4<f32>, @location(2) tint : vec4<f32> };
struct VOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32>, @location(1) world: vec3<f32>, @location(2) tint: vec4<f32> };
@vertex fn vs(v:Vin, i:Inst) -> VOut {
  let world = i.posSize.xyz + (g.cameraRight.xyz * v.local.x + g.cameraUp.xyz * v.local.y) * i.posSize.w;
  var out:VOut;
  out.pos = g.viewProj * vec4<f32>(world,1.0);
  out.uv = v.local * .5 + .5;
  out.world = world;
  out.tint = i.tint;
  return out;
}
fn blob(p: vec2<f32>, c: vec2<f32>, r: f32) -> f32 { return smoothstep(r, r-.09, distance(p,c)); }
@fragment fn fs(in:VOut) -> @location(0) vec4<f32> {
  let p = (in.uv - .5) * vec2<f32>(2.15,1.28);
  let t = g.cameraPosTime.w;
  var d = 0.0;
  d += blob(p, vec2<f32>(-.62,-.02), .50);
  d += blob(p, vec2<f32>(-.26,.12), .62);
  d += blob(p, vec2<f32>(.20,.06), .54);
  d += blob(p, vec2<f32>(.58,-.04), .42);
  d += blob(p, vec2<f32>(-.05,.38), .35);
  d += blob(p, vec2<f32>(.35,.30), .28);
  let n = fbm(p*3.4 + vec2<f32>(t*.018, -t*.012));
  let density = clamp((d*.58 + n*.34 - .25)*1.55, 0.0, 1.0);
  let edge = smoothstep(.15,.65,density) - smoothstep(.66,1.0,density);
  let light = clamp(.70 + .62*(-p.x + p.y)*.5, .28, 1.24);
  var col = mix(vec3<f32>(0.58,0.68,0.82), vec3<f32>(1.0,.88,.66), light) * in.tint.rgb;
  col += vec3<f32>(1.0,.76,.38) * edge * .32;
  let dist = distance(g.cameraPosTime.xyz, in.world);
  let f = clamp(1.0-exp(-dist*g.fogColorDensity.w*.75),0.0,.52);
  col = mix(col, g.fogColorDensity.xyz, f);
  return vec4<f32>(col, density * in.tint.a);
}
`;

const planeWGSL = shaderCommon + /* wgsl */`
struct Vin { @location(0) local: vec2<f32>, @location(1) color: vec4<f32> };
struct Inst { @location(2) posScale: vec4<f32>, @location(3) params: vec4<f32> };
struct VOut { @builtin(position) pos: vec4<f32>, @location(0) color: vec4<f32>, @location(1) id: f32 };
@vertex fn vs(v:Vin, i:Inst) -> VOut {
  let time = g.cameraPosTime.w;
  let drift = vec3<f32>(sin(time*i.params.z + i.params.y)*3.5, sin(time*.7+i.params.y)*.65, cos(time*.35+i.params.y)*2.8);
  let p = i.posScale.xyz + drift;
  let a = i.params.w + sin(time*.25+i.params.y)*.06;
  let ca = cos(a); let sa = sin(a);
  let rlocal = vec2<f32>(v.local.x*ca - v.local.y*sa, v.local.x*sa + v.local.y*ca);
  let scale = i.posScale.w;
  let world = p + (g.cameraRight.xyz*rlocal.x + g.cameraUp.xyz*rlocal.y) * scale;
  var out:VOut;
  out.pos = g.viewProj * vec4<f32>(world,1.0);
  let hi = select(0.0, 1.0, abs(i.params.y - g.highlightMisc.x) < .05);
  out.color = v.color + vec4<f32>(vec3<f32>(hi*.55), 0.0);
  out.id = i.params.y;
  return out;
}
@fragment fn fs(in:VOut) -> @location(0) vec4<f32> {
  var col = in.color.rgb;
  let pulse = .5+.5*sin(g.cameraPosTime.w*7.0);
  if (abs(in.id - g.highlightMisc.x) < .05) { col += vec3<f32>(1.0,.78,.32) * pulse * .35; }
  return vec4<f32>(col, in.color.a);
}
`;

const postWGSL = shaderCommon + /* wgsl */`
@group(0) @binding(1) var samp : sampler;
@group(0) @binding(2) var colorTex : texture_2d<f32>;
@group(0) @binding(3) var depthTex : texture_depth_2d;
struct VOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn vs(@builtin(vertex_index) vi:u32) -> VOut {
  var p = array<vec2<f32>,3>(vec2<f32>(-1.0,-1.0), vec2<f32>(3.0,-1.0), vec2<f32>(-1.0,3.0));
  var out:VOut; out.pos = vec4<f32>(p[vi],0.0,1.0); out.uv = p[vi]*.5+.5; return out;
}
fn sampleCol(uv:vec2<f32>) -> vec3<f32> { return textureSampleLevel(colorTex, samp, clamp(uv,vec2<f32>(0.0),vec2<f32>(1.0)), 0.0).rgb; }
@fragment fn fs(in:VOut) -> @location(0) vec4<f32> {
  let uv = in.uv;
  let px = 1.0 / g.resolutionFocus.xy;
  let di = vec2<i32>(i32(in.pos.x), i32(in.pos.y));
  let depth = textureLoad(depthTex, di, 0);

  // Tilt-shift toy-town DOF: screen band + depth, intentionally stylized.
  let focusY = g.resolutionFocus.z;
  let band = smoothstep(.075, .36, abs(uv.y - focusY));
  let farBlur = smoothstep(.82, .99, depth) * .62;
  let blur = clamp((band + farBlur) * g.resolutionFocus.w, 0.0, 1.0);
  let r = blur * 8.5;
  var col = sampleCol(uv) * .32;
  col += sampleCol(uv + px*vec2<f32>( r, 0.0))*.08;
  col += sampleCol(uv + px*vec2<f32>(-r, 0.0))*.08;
  col += sampleCol(uv + px*vec2<f32>(0.0, r))*.08;
  col += sampleCol(uv + px*vec2<f32>(0.0,-r))*.08;
  col += sampleCol(uv + px*vec2<f32>( r*.72, r*.72))*.07;
  col += sampleCol(uv + px*vec2<f32>(-r*.72, r*.72))*.07;
  col += sampleCol(uv + px*vec2<f32>( r*.72,-r*.72))*.07;
  col += sampleCol(uv + px*vec2<f32>(-r*.72,-r*.72))*.07;
  col += sampleCol(uv + px*vec2<f32>( r*.38, r*.92))*.05;
  col += sampleCol(uv + px*vec2<f32>(-r*.92, r*.38))*.05;

  // Cheap bloom from already-bright runway lights, windows, sun/cloud edges.
  let lum = dot(col, vec3<f32>(.2126,.7152,.0722));
  let bloom = smoothstep(.66, 1.12, lum);
  col += col * bloom * .16;

  // Warm coastal evening grade.
  col = pow(max(col, vec3<f32>(0.0)), vec3<f32>(.93));
  col *= vec3<f32>(1.03, .98, .91);
  col = aces(col * g.sunDirExposure.w);

  // Subtle vignette and blue-noise-ish dithering.
  let q = uv * (vec2<f32>(1.0,1.0)-uv.yx);
  let vig = clamp(pow(q.x*q.y*18.0, .19), .72, 1.0);
  col *= vig;
  col += (hash12(in.pos.xy + g.cameraPosTime.w*17.0)-.5)/255.0;
  return vec4<f32>(col,1.0);
}
`;

// ---------- GPU app ----------
async function main() {
  if (!('gpu' in navigator)) {
    showNoSupport('navigator.gpu is not present in this browser.');
    return;
  }

  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) { showNoSupport('No WebGPU adapter was returned.'); return; }
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format: presentationFormat, alphaMode: 'opaque' });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  const scene = buildScene();
  const vertexBuffer = device.createBuffer({ size: scene.vertices.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(vertexBuffer, 0, scene.vertices);
  const indexBuffer = device.createBuffer({ size: scene.indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(indexBuffer, 0, scene.indices);

  const globals = new Float32Array(44);
  const globalsBuffer = device.createBuffer({ size: globals.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const globalBGL = device.createBindGroupLayout({ entries: [{ binding:0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer:{ type:'uniform' } }] });
  const globalBG = device.createBindGroup({ layout: globalBGL, entries: [{ binding:0, resource:{ buffer: globalsBuffer } }] });

  const vertexLayout = {
    arrayStride: 44,
    attributes: [
      { shaderLocation:0, offset:0, format:'float32x3' },
      { shaderLocation:1, offset:12, format:'float32x3' },
      { shaderLocation:2, offset:24, format:'float32x4' },
      { shaderLocation:3, offset:40, format:'float32' },
    ]
  };

  const blend = { color: { srcFactor:'src-alpha', dstFactor:'one-minus-src-alpha', operation:'add' }, alpha: { srcFactor:'one', dstFactor:'one-minus-src-alpha', operation:'add' } };
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [globalBGL] });
  const skyPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module: device.createShaderModule({ code: skyWGSL }), entryPoint: 'vs' },
    fragment: { module: device.createShaderModule({ code: skyWGSL }), entryPoint: 'fs', targets: [{ format: 'rgba8unorm' }] },
    primitive: { topology:'triangle-list' }
  });
  const mainPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module: device.createShaderModule({ code: mainWGSL }), entryPoint: 'vs', buffers: [vertexLayout] },
    fragment: { module: device.createShaderModule({ code: mainWGSL }), entryPoint: 'fs', targets: [{ format: 'rgba8unorm', blend }] },
    primitive: { topology:'triangle-list', cullMode:'none' },
    depthStencil: { format:'depth32float', depthWriteEnabled:true, depthCompare:'less' }
  });

  // Cloud billboard geometry.
  const quadVerts = new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]);
  const quadBuffer = device.createBuffer({ size: quadVerts.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(quadBuffer, 0, quadVerts);
  const cloudInstances = new Float32Array([
    -66, 30, -58, 18,   1.00, .98, .94, .88,
    -50, 24, -75, 14,   .96, .98, 1.00, .78,
     18, 20, -86, 12,   .98, .96, .90, .70,
     63, 18, -78, 14,   .98, .95, .88, .64,
  ]);
  const cloudInstanceBuffer = device.createBuffer({ size: cloudInstances.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(cloudInstanceBuffer, 0, cloudInstances);
  const cloudPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module: device.createShaderModule({ code: cloudWGSL }), entryPoint:'vs', buffers:[
      { arrayStride:8, attributes:[{shaderLocation:0, offset:0, format:'float32x2'}] },
      { arrayStride:32, stepMode:'instance', attributes:[{shaderLocation:1, offset:0, format:'float32x4'}, {shaderLocation:2, offset:16, format:'float32x4'}] }
    ]},
    fragment: { module: device.createShaderModule({ code: cloudWGSL }), entryPoint:'fs', targets:[{format:'rgba8unorm', blend}] },
    primitive: { topology:'triangle-list' },
    depthStencil: { format:'depth32float', depthWriteEnabled:false, depthCompare:'less-equal' }
  });

  // Plane 2D local silhouette: fuselage, wings, tail, contrail. Color alpha is per-vertex material.
  const planeVerts = new Float32Array([
    // local xy, rgba
    0.00, 1.00,  .98,.96,.90,1.00,   -0.15,-0.74, .98,.96,.90,1.00,    0.15,-0.74, .98,.96,.90,1.00,
    -0.92,-0.10, .98,.96,.90,.92,     0.00, 0.10, .98,.96,.90,.95,      0.92,-0.10, .98,.96,.90,.92,
    -0.48,-0.58, .98,.96,.90,.86,    -0.10,-0.42,.98,.96,.90,.88,     -0.06,-0.76,.98,.96,.90,.86,
     0.48,-0.58, .98,.96,.90,.86,     0.10,-0.42,.98,.96,.90,.88,      0.06,-0.76,.98,.96,.90,.86,
    -0.045,-0.78,.85,.95,1.0,.22,     0.045,-0.78,.85,.95,1.0,.22,     0.018,-2.90,.85,.95,1.0,0.00,
    -0.045,-0.78,.85,.95,1.0,.22,     0.018,-2.90,.85,.95,1.0,0.00,   -0.018,-2.90,.85,.95,1.0,0.00,
  ]);
  const planeBuffer = device.createBuffer({ size: planeVerts.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(planeBuffer, 0, planeVerts);
  const planeInstances = new Float32Array([
    -24, 39, -86, 2.5,   0, 0,  .72, -0.18,
      7, 36, -92, 2.1,   0, 1,  .52,  0.22,
     37, 44, -76, 2.6,   0, 2,  .64,  0.08,
     78, 25, -68, 1.9,   0, 3,  .48, -0.35,
  ]);
  const planeInstanceBuffer = device.createBuffer({ size: planeInstances.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(planeInstanceBuffer, 0, planeInstances);
  const planePipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module: device.createShaderModule({ code: planeWGSL }), entryPoint:'vs', buffers:[
      { arrayStride:24, attributes:[{shaderLocation:0, offset:0, format:'float32x2'}, {shaderLocation:1, offset:8, format:'float32x4'}] },
      { arrayStride:32, stepMode:'instance', attributes:[{shaderLocation:2, offset:0, format:'float32x4'}, {shaderLocation:3, offset:16, format:'float32x4'}] }
    ]},
    fragment: { module: device.createShaderModule({ code: planeWGSL }), entryPoint:'fs', targets:[{format:'rgba8unorm', blend}] },
    primitive: { topology:'triangle-list' },
    depthStencil: { format:'depth32float', depthWriteEnabled:false, depthCompare:'less-equal' }
  });

  const postBGL = device.createBindGroupLayout({ entries: [
    { binding:0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer:{type:'uniform'} },
    { binding:1, visibility: GPUShaderStage.FRAGMENT, sampler:{type:'filtering'} },
    { binding:2, visibility: GPUShaderStage.FRAGMENT, texture:{sampleType:'float'} },
    { binding:3, visibility: GPUShaderStage.FRAGMENT, texture:{sampleType:'depth'} },
  ]});
  const postPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts:[postBGL] }),
    vertex: { module: device.createShaderModule({ code: postWGSL }), entryPoint:'vs' },
    fragment: { module: device.createShaderModule({ code: postWGSL }), entryPoint:'fs', targets:[{format:presentationFormat}] },
    primitive: { topology:'triangle-list' }
  });
  const sampler = device.createSampler({ magFilter:'linear', minFilter:'linear', mipmapFilter:'linear', addressModeU:'clamp-to-edge', addressModeV:'clamp-to-edge' });

  let colorTex, depthTex, postBG, width=0, height=0, dpr=1, quality=1;
  function resize() {
    const cssW = Math.max(1, canvas.clientWidth);
    const cssH = Math.max(1, canvas.clientHeight);
    const mobile = Math.min(cssW, cssH) < 760;
    dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.8 : 2.0) * quality;
    const w = Math.max(1, Math.floor(cssW * dpr));
    const h = Math.max(1, Math.floor(cssH * dpr));
    if (w === width && h === height) return;
    width = w; height = h;
    canvas.width = width; canvas.height = height;
    colorTex?.destroy(); depthTex?.destroy();
    colorTex = device.createTexture({ size:[width,height], format:'rgba8unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    depthTex = device.createTexture({ size:[width,height], format:'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    postBG = device.createBindGroup({ layout: postBGL, entries: [
      { binding:0, resource:{ buffer: globalsBuffer } },
      { binding:1, resource:sampler },
      { binding:2, resource:colorTex.createView() },
      { binding:3, resource:depthTex.createView() },
    ]});
  }
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));

  const camera = { yaw:-0.23, pitch:0.28, radius:92, target:[4,8,-42], eye:[0,0,0], right:[1,0,0], up:[0,1,0] };
  const proj = new Float32Array(16), view = new Float32Array(16), viewProj = new Float32Array(16);

  let dragging = false, lastX=0, lastY=0, moved=false, highlighted=-1, lastTapTime=0;
  canvas.addEventListener('pointerdown', e => { dragging=true; moved=false; lastX=e.clientX; lastY=e.clientY; canvas.setPointerCapture(e.pointerId); promptEl.classList.add('hidden'); });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx=e.clientX-lastX, dy=e.clientY-lastY;
    if (Math.abs(dx)+Math.abs(dy)>3) moved=true;
    lastX=e.clientX; lastY=e.clientY;
    camera.yaw -= dx * 0.0042;
    camera.pitch = clamp(camera.pitch + dy * 0.0030, -0.06, 0.62);
  });
  canvas.addEventListener('pointerup', e => {
    dragging=false;
    if (!moved) pickPlane(e.clientX, e.clientY);
  });

  function animatedPlaneWorld(id, t) {
    const base = id * 8;
    const p = [planeInstances[base], planeInstances[base+1], planeInstances[base+2]];
    const phase = planeInstances[base+5], speed = planeInstances[base+6];
    return [p[0] + Math.sin(t*speed+phase)*3.5, p[1] + Math.sin(t*.7+phase)*.65, p[2] + Math.cos(t*.35+phase)*2.8];
  }
  function pickPlane(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    let best=-1, bestD=1e9;
    const t = performance.now()*0.001;
    for (let id=0; id<4; id++) {
      const p = animatedPlaneWorld(id, t);
      const s = projectPoint(viewProj, p, rect.width, rect.height);
      if (!s || !s.visible) continue;
      const d = Math.hypot(s.x-x, s.y-y);
      if (d < bestD) { bestD=d; best=id; }
    }
    if (bestD < 54) {
      highlighted = best;
      lastTapTime = performance.now();
      const rect = canvas.getBoundingClientRect();
      const s = projectPoint(viewProj, animatedPlaneWorld(best, performance.now()*0.001), rect.width, rect.height);
      if (s) {
        planeCard.style.left = `${s.x + rect.left}px`;
        planeCard.style.top = `${s.y + rect.top}px`;
        planeCard.querySelector('.id').textContent = `CG‑${17+best*13}`;
        planeCard.querySelector('.meta').textContent = ['coastal approach','holding pattern','northbound climb','final vector'][best];
        planeCard.classList.add('visible');
      }
    }
  }

  let last = performance.now(), fpsSmooth=60, frameCount=0, fpsTimer=0;
  function frame(now) {
    resize();
    const dt = Math.min(0.05, (now-last)*0.001); last = now;
    const t = now*0.001;
    fpsSmooth = lerp(fpsSmooth, 1/Math.max(dt,0.0001), .04);
    frameCount++; fpsTimer += dt;
    if (fpsTimer > .6) {
      const cssScale = quality < .99 ? ` · res ${Math.round(quality*100)}%` : '';
      fpsEl.textContent = `${Math.round(fpsSmooth)} fps${cssScale}`;
      fpsTimer = 0;
      // Dynamic resolution: slow drift only; avoids visible pulsing.
      if (frameCount > 120 && fpsSmooth < 45 && quality > .68) { quality = Math.max(.68, quality - .06); resize(); }
      if (frameCount > 240 && fpsSmooth > 58 && quality < 1.0) { quality = Math.min(1.0, quality + .03); resize(); }
    }

    const target = camera.target;
    const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
    camera.eye = [target[0] + Math.sin(camera.yaw)*cp*camera.radius, target[1] + sp*camera.radius, target[2] + Math.cos(camera.yaw)*cp*camera.radius];
    lookAt(view, camera.eye, target, [0,1,0]);
    perspective(proj, 54*Math.PI/180, width/height, .1, 320);
    mulMat4(viewProj, proj, view);
    camera.right = [view[0], view[4], view[8]];
    camera.up = [view[1], view[5], view[9]];

    globals.set(viewProj, 0);
    globals.set([camera.eye[0],camera.eye[1],camera.eye[2],t], 16);
    globals.set(norm([-0.52,0.78,0.44]).concat([1.05]), 20); // sun dir + exposure
    globals.set([0.70,0.84,0.90,0.012], 24); // fog color + density
    globals.set([width,height,0.54,0.82], 28); // resolution + focus line + DOF strength
    globals.set([camera.right[0],camera.right[1],camera.right[2],0], 32);
    globals.set([camera.up[0],camera.up[1],camera.up[2],0], 36);
    globals.set([highlighted,0,0,0], 40);
    device.queue.writeBuffer(globalsBuffer, 0, globals);

    if (highlighted >= 0) {
      const rect = canvas.getBoundingClientRect();
      const s = projectPoint(viewProj, animatedPlaneWorld(highlighted, t), rect.width, rect.height);
      if (s && s.visible && now - lastTapTime < 5000) {
        planeCard.style.left = `${s.x + rect.left}px`;
        planeCard.style.top = `${s.y + rect.top}px`;
      } else planeCard.classList.remove('visible');
    }

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: colorTex.createView(), clearValue: {r:.53,g:.76,b:.94,a:1}, loadOp:'clear', storeOp:'store' }],
      depthStencilAttachment: { view: depthTex.createView(), depthClearValue:1, depthLoadOp:'clear', depthStoreOp:'store' }
    });
    pass.setBindGroup(0, globalBG);
    pass.setPipeline(skyPipeline);
    pass.draw(3);
    pass.setPipeline(mainPipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer, 'uint32');
    pass.drawIndexed(scene.indices.length);
    pass.setPipeline(cloudPipeline);
    pass.setVertexBuffer(0, quadBuffer);
    pass.setVertexBuffer(1, cloudInstanceBuffer);
    pass.draw(6, 4);
    pass.setPipeline(planePipeline);
    pass.setVertexBuffer(0, planeBuffer);
    pass.setVertexBuffer(1, planeInstanceBuffer);
    pass.draw(18, 4);
    pass.end();

    const post = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp:'clear', clearValue:{r:0,g:0,b:0,a:1}, storeOp:'store' }] });
    post.setPipeline(postPipeline);
    post.setBindGroup(0, postBG);
    post.draw(3);
    post.end();
    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
}

main().catch(err => {
  console.error(err);
  showNoSupport(String(err?.message || err));
});
