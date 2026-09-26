// ---------- Titan physics: loose things near the camera ----------
// A few thousand small things (grit, litter, snow clumps, ice chips) with real state: position and velocity, stepped
// every frame under Titan's gravity and air, touching the city through a distance function. See the drift-city skill,
// "Physics". Particle i is three vec4s: (position, radius), (velocity, kind), (age, seed, rest time, 0).
@group(0) @binding(1) var cellTex: texture_2d<f32>;
@group(0) @binding(23) var<storage, read_write> parts: array<vec4f>;
@group(0) @binding(24) var<uniform> ph: PhysU;
// the same buffer, read-only, for drawing (a vertex shader may not bind read-write storage)
@group(0) @binding(25) var<storage, read> partsR: array<vec4f>;
struct PhysU { drone: vec4f, wind: vec4f, anchor: vec4f, step: vec4f };
// drone: position, downdraft strength 0..1; wind: air velocity (x, y, z), gust; anchor: centre of the live area
// (x, z), its radius, snow cover; step: dt, substeps, particle count, snowfall

const NC: i32 = 96;
const CS: f32 = 26.0;
const G: f32 = 1.352;         // Titan surface gravity, m/s^2
// Drag as a = -K |v - wind| (v - wind), with K = rho Cd A / (2 m) and rho = 5.3 kg/m^3 (4.4 times Earth's air).
// Terminal speed is sqrt(G / K): grit 2.9 m/s, snow clumps 0.9, litter 0.35, ice chips 1.9.
const K_DRAG = array<f32, 4>(0.16, 1.7, 11.0, 0.38);
const RAD = array<f32, 4>(0.035, 0.07, 0.09, 0.05);
// on methane ice: friction and bounce, by kind
const MU = array<f32, 4>(0.25, 0.35, 0.5, 0.05);
const BOUNCE = array<f32, 4>(0.25, 0.05, 0.02, 0.3);

struct PCell { typ: i32, h: f32, w: vec2f, off: vec2f };
// the cell table, read as scene.wgsl reads it (cellHead / cellFull): keep in step with it
fn pcell(c: vec2i) -> PCell {
  var o: PCell;
  let s = vec2i(((c.x % NC) + NC) % NC, ((c.y % NC) + NC) % NC);
  let t0 = textureLoad(cellTex, vec2i(s.x * 3, s.y), 0);
  if (i32(round(t0.x)) != c.x || i32(round(t0.y)) != c.y) { o.typ = 7; return o; }
  o.typ = i32(round(t0.z)) & 15;
  let t1 = textureLoad(cellTex, vec2i(s.x * 3 + 1, s.y), 0);
  o.h = t1.x;
  o.w = t1.zw;
  o.off = textureLoad(cellTex, vec2i(s.x * 3 + 2, s.y), 0).xy;
  return o;
}
fn isCityCell(t: i32) -> bool { return t <= 3 || t == 8 || t == 9 || t == 10 || t == 11 || t == 13; }
// the world as the particles feel it: the city floor, and each building as the box of its footprint and height
fn world(p: vec3f) -> f32 {
  var d = p.y;
  let c = vec2i(floor(p.xz / CS));
  let ce = pcell(c);
  if (isCityCell(ce.typ) && ce.h > 0.5) {
    let cen = (vec2f(c) + 0.5) * CS + ce.off;
    let q = abs(vec3f(p.x - cen.x, p.y - ce.h * 0.5, p.z - cen.y)) - vec3f(ce.w.x, ce.h * 0.5, ce.w.y);
    d = min(d, length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0));
  }
  return d;
}
fn worldN(p: vec3f) -> vec3f {
  let e = 0.02;
  return normalize(vec3f(world(p + vec3f(e, 0.0, 0.0)) - world(p - vec3f(e, 0.0, 0.0)), world(p + vec3f(0.0, e, 0.0)) - world(p - vec3f(0.0, e, 0.0)),
    world(p + vec3f(0.0, 0.0, e)) - world(p - vec3f(0.0, 0.0, e))) + vec3f(0.0, 1e-5, 0.0));
}
fn rnd(i: u32, k: u32) -> f32 { return hsh(i32(i), i32(k), 777); }

// a new particle somewhere in the live area: on the city floor, or up in the air when snow is falling
fn spawn(i: u32, gen: f32) {
  let seed = rnd(i, u32(gen * 97.0) & 4095u);
  let a = seed * 6.2831853;
  let r = ph.anchor.z * sqrt(rnd(i, 3u + u32(gen * 13.0) % 97u));
  var p = vec3f(ph.anchor.x + cos(a) * r, 0.0, ph.anchor.y + sin(a) * r);
  // kinds: 0 grit, 1 snow clump, 2 litter, 3 ice chip. Snow clumps fall from the sky while it snows, lie about while
  // snow covers the ground, and are grit otherwise; everything else starts at rest on the floor
  let rk = rnd(i, 5u);
  var kind = select(select(select(1, 3, rk < 0.75), 2, rk < 0.55), 0, rk < 0.35);
  if (kind == 1 && ph.step.w > 0.2) { p.y = 6.0 + 20.0 * rnd(i, 7u); }
  else if (kind == 1 && ph.anchor.w < 0.2) { kind = 0; }
  let c = pcell(vec2i(floor(p.xz / CS)));
  var rad = RAD[kind];
  if (!isCityCell(c.typ) || world(p + vec3f(0.0, 0.3, 0.0)) < 0.0) { rad = 0.0; }
  parts[i * 3u] = vec4f(p + vec3f(0.0, rad, 0.0), rad);
  parts[i * 3u + 1u] = vec4f(0.0, 0.0, 0.0, f32(kind));
  parts[i * 3u + 2u] = vec4f(0.0, seed, 0.0, gen);
}

@compute @workgroup_size(64) fn physStep(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= u32(ph.step.z)) { return; }
  var P = parts[i * 3u];
  var V = parts[i * 3u + 1u];
  var A = parts[i * 3u + 2u];
  // far from the camera (or never started): start again near it
  if ((P.w <= 0.0 && A.x > 3.0) || length(P.xz - ph.anchor.xy) > ph.anchor.z * 1.35 || A.w == 0.0) {
    spawn(i, A.w + 1.0 + floor(u.time));
    return;
  }
  if (P.w <= 0.0) { A.x += ph.step.x; parts[i * 3u + 2u] = A; return; }
  let kind = i32(V.w);
  let n = max(ph.step.y, 1.0);
  let dt = ph.step.x / n;
  var p = P.xyz;
  var v = V.xyz;
  for (var s = 0; s < 4; s++) {
    if (f32(s) >= n) { break; }
    // the air: the wind (stronger with height), a little turbulence, and the drone's downdraft
    var air = ph.wind.xyz * (0.35 + 0.65 * smoothstep(0.0, 6.0, p.y));
    let tq = p * 0.4 + vec3f(u.time * 0.3);
    air += vec3f(sin(tq.y * 1.7 + tq.z), sin(tq.x * 1.3 + tq.z * 0.7) * 0.4, cos(tq.x * 1.1 + tq.y)) * 0.35 * ph.wind.w;
    let dd = p - ph.drone.xyz;
    let rh = length(dd.xz);
    if (dd.y < 0.5 && dd.y > -14.0 && rh < 7.0) {
      // straight down under the rotors, turning outward along the ground
      let fall = (1.0 - rh / 7.0) * smoothstep(-14.0, -1.0, dd.y);
      air += (vec3f(0.0, -7.0, 0.0) * fall + vec3f(dd.x, 0.0, dd.z) / max(rh, 0.3) * 5.0 * smoothstep(3.0, 0.0, p.y) * (1.0 - rh / 7.0)) * ph.drone.w;
      // where the outflow meets still air at the rim it rolls up: light things are lifted and tumble there
      air.y += 4.0 * smoothstep(3.5, 5.5, rh) * smoothstep(7.0, 5.8, rh) * smoothstep(2.5, 0.0, p.y) * ph.drone.w;
    }
    let rel = v - air;
    var acc = vec3f(0.0, -G, 0.0) - K_DRAG[kind] * length(rel) * rel;
    // litter flutters: its drag turns part of the fall sideways, and flips with its tumble
    if (kind == 2) { acc += vec3f(sin(u.time * 3.1 + A.y * 40.0), 0.0, cos(u.time * 2.3 + A.y * 30.0)) * 0.9 * min(length(rel), 1.0); }
    v += acc * dt;
    p += v * dt;
    // touching the world: out along the normal, the inward speed turned round (a little) and the sliding speed
    // reduced by friction in proportion to how hard it hit
    let d = world(p) - P.w;
    if (d < 0.0) {
      let nn = worldN(p);
      p -= nn * d;
      let vn = dot(v, nn);
      if (vn < 0.0) {
        var vt = v - nn * vn;
        let vtl = length(vt);
        let slow = MU[kind] * (-vn) + MU[kind] * G * dt;
        vt *= max(vtl - slow, 0.0) / max(vtl, 1e-5);
        v = vt - nn * vn * BOUNCE[kind];
      }
    }
  }
  // settled: count the time at rest (a resting grain is drawn, but not re-stepped at full cost forever)
  A.z = select(0.0, A.z + ph.step.x, length(v) < 0.02);
  A.x += ph.step.x;
  parts[i * 3u] = vec4f(p, P.w);
  parts[i * 3u + 1u] = vec4f(v, V.w);
  parts[i * 3u + 2u] = A;
}

// ---------- drawing them ----------
// One small camera-facing disc per particle, drawn over the finished frame, hidden behind the scene by its depth.
@group(0) @binding(5) var depthTex: texture_2d<f32>;
struct PVOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) col: vec3f, @location(2) dist: f32 };
@vertex fn physVs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> PVOut {
  var o: PVOut;
  o.pos = vec4f(2.0, 2.0, 2.0, 1.0);
  let P = partsR[ii * 3u];
  let kind = i32(partsR[ii * 3u + 1u].w);
  if (P.w <= 0.0) { return o; }
  let v = P.xyz - u.camPos;
  let z = dot(v, u.camFwd);
  if (z < 0.3) { return o; }
  var corner = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, 1.0));
  let cq = corner[vi];
  // at least a pixel and a half across
  let aspect = u.outRes.x / u.outRes.y;
  let px = 2.0 / u.outRes.y;
  let r = max(P.w / (z * u.fov), 1.5 * px);
  let sx = dot(v, u.camRight) / (z * u.fov * aspect);
  let sy = dot(v, u.camUp) / (z * u.fov);
  o.pos = vec4f(sx + cq.x * r / aspect, sy + cq.y * r, 0.5, 1.0);
  o.uv = cq;
  o.dist = length(v);
  var c = vec3f(0.36, 0.33, 0.3);
  if (kind == 1) { c = vec3f(0.9, 0.88, 0.85); }
  if (kind == 2) { c = mix(vec3f(0.85, 0.8, 0.6), vec3f(0.9, 0.5, 0.35), hsh(i32(ii), 1, 778)); }
  if (kind == 3) { c = vec3f(0.7, 0.8, 0.85); }
  o.col = c * (u.sunCol * 0.35 + u.skyTop * 0.6 + u.skyHor * 0.3);
  return o;
}
@fragment fn physFs(i: PVOut) -> @location(0) vec4f {
  let r = length(i.uv);
  if (r > 1.0) { discard; }
  let dep = textureLoad(depthTex, vec2i(i.pos.xy * vec2f(textureDimensions(depthTex)) / u.outRes), 0).a;
  if (i.dist > dep + 0.1) { discard; }
  // fog as the scene's (a plain exponential), then the same soft tone curve as the composite, roughly
  let fogK = exp(-i.dist * u.fogDen);
  var c = mix(u.fogCol, i.col, fogK);
  c = 1.0 - exp(-c * 1.4);
  return vec4f(c, (1.0 - smoothstep(0.7, 1.0, r)) * fogK);
}
