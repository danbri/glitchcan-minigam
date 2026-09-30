// ---------- WebGL2 fallback ----------
// Used when WebGPU is missing or fails. It draws the same world from the same data as the WebGPU path's
// far field: terrain, one box per block, streets and sky, traced through a max-height pyramid in one
// fragment shader. Flight, tours and time of day are shared with the WebGPU path.
const FB_GLSL = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D terrT;
uniform sampler2D ffB;
uniform sampler2D ffM;
uniform vec3 camPos, camF, camR, camU;
uniform vec2 res;
uniform float fov, time, win, stars, den, aur, shadowsOn, hasCity;
uniform vec4 uSat, uMoonA, uMoonB;
uniform vec3 sunDir, sunCol, skyTop, skyHor, fogCol;
out vec4 outCol;

const float CS = 26.0;
const float TCS = 52.0;
const int NW = 768;
const int NT = 384;
const float LW = 19968.0;
const float TFAR = 14000.0;
const float GMAX = 900.0;


float hsh(int x, int y, int k) {
  uint h = uint(x) * 374761393u + uint(y) * 668265263u + uint(k) * 1442695041u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return float(h & 0xffffffu) / 16777216.0;
}
float vnoise(vec2 p, int k) {
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  return mix(mix(hsh(i.x, i.y, k), hsh(i.x + 1, i.y, k), w.x), mix(hsh(i.x, i.y + 1, k), hsh(i.x + 1, i.y + 1, k), w.x), w.y);
}
float sstepJ(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
int wrapI(int v, int n) { return v - n * int(floor(float(v) / float(n))); }
vec2 wrapP(vec2 x) { return x - LW * floor(x / LW + 0.5); }
float pvn(vec2 p, float s, int k) {
  int n = int(floor(LW / s + 0.5));
  vec2 q = p / s;
  ivec2 i = ivec2(floor(q));
  vec2 f = q - vec2(i);
  vec2 w = f * f * (3.0 - 2.0 * f);
  int x0 = wrapI(i.x, n); int z0 = wrapI(i.y, n); int x1 = wrapI(x0 + 1, n); int z1 = wrapI(z0 + 1, n);
  return mix(mix(hsh(x0, z0, k), hsh(x1, z0, k), w.x), mix(hsh(x0, z1, k), hsh(x1, z1, k), w.x), w.y);
}
float cityDist(vec2 p) { return length(wrapP(p)); }
// the city's shape: a core and the harbour arm (as citySdf in world.js)
float citySdf(vec2 p) {
  vec2 q = wrapP(p), a = vec2(3300.0, -3300.0);
  float core = 1700.0 + 380.0 * (pvn(p, 1248.0, 201) - 0.5) + 200.0 * (pvn(p, 624.0, 202) - 0.5);
  float t = clamp(dot(q, a) / dot(a, a), 0.0, 1.0);
  return min(length(q) - core, length(q - a * t) - 380.0);
}
float cityR(vec2 p) { return cityDist(p) - citySdf(p); }

vec4 terrV(ivec2 v) { return texelFetch(terrT, ivec2(wrapI(v.x, NT), wrapI(v.y, NT)), 0); }
vec4 terrAt(vec2 xz) {
  vec2 g = xz / TCS;
  ivec2 i = ivec2(floor(g));
  vec2 f = g - vec2(i);
  return mix(mix(terrV(i), terrV(i + ivec2(1, 0)), f.x), mix(terrV(i + ivec2(0, 1)), terrV(i + ivec2(1, 1)), f.x), f.y);
}
float surfH(vec4 t) { return max(t.x, t.y); }
vec4 ffLoad(ivec2 c, int lvl) { int n = NW >> lvl; return texelFetch(ffM, ivec2(wrapI(c.x, n), wrapI(c.y, n)), lvl); }
vec4 blockInfo(ivec2 c) { return texelFetch(ffB, ivec2(wrapI(c.x, NW), wrapI(c.y, NW)), 0); }
float safeDir(float v) { return abs(v) < 1e-6 ? (v < 0.0 ? -1e-6 : 1e-6) : v; }

float patchRoot(float y0, float dy, float u0, float w0, float du, float dw, vec4 h, float ds) {
  float B = h.y - h.x, Cc = h.z - h.x, D = h.x - h.y - h.z + h.w;
  float k0 = h.x + B * u0 + Cc * w0 + D * u0 * w0;
  float k1 = B * du + Cc * dw + D * (u0 * dw + w0 * du);
  float a = -D * du * dw, b = dy - k1, c = y0 - k0;
  if (c <= 0.0) return 0.0;
  float root = 1e9;
  if (abs(a) < 1e-9) {
    if (b < 0.0) root = -c / b;
  } else {
    float disc = b * b - 4.0 * a * c;
    if (disc >= 0.0) {
      float q = -0.5 * (b + (b >= 0.0 ? sqrt(disc) : -sqrt(disc)));
      float r1 = q / a;
      float r2 = abs(q) > 1e-12 ? c / q : 1e9;
      float lo = min(r1, r2), hi = max(r1, r2);
      if (lo > 0.0) root = lo; else if (hi > 0.0) root = hi;
    }
  }
  return root <= ds ? root : 1e9;
}

int gKind;
float farCell(vec3 ro, vec3 rd, float t0, float t1, ivec2 c, bool withB) {
  vec2 b0 = vec2(c) * CS;
  vec4 v00 = terrAt(b0), v10 = terrAt(b0 + vec2(CS, 0.0)), v01 = terrAt(b0 + vec2(0.0, CS)), v11 = terrAt(b0 + vec2(CS));
  vec3 p0 = ro + rd * t0;
  float u0 = p0.x / CS - float(c.x), w0 = p0.z / CS - float(c.y);
  float du = rd.x / CS, dw = rd.z / CS, ds = t1 - t0;
  float s = min(patchRoot(p0.y, rd.y, u0, w0, du, dw, vec4(v00.x, v10.x, v01.x, v11.x), ds),
                patchRoot(p0.y, rd.y, u0, w0, du, dw, vec4(v00.y, v10.y, v01.y, v11.y), ds));
  int kind = 1;
  if (withB) {
    vec4 b = blockInfo(c);
    if (b.x > 0.5) {
      vec2 cen = (vec2(c) + 0.5) * CS;
      vec3 inv = 1.0 / vec3(safeDir(rd.x), safeDir(rd.y), safeDir(rd.z));
      vec3 ta = (vec3(cen.x - b.y, -2.0, cen.y - b.z) - ro) * inv;
      vec3 tb = (vec3(cen.x + b.y, b.x, cen.y + b.z) - ro) * inv;
      vec3 tn = min(ta, tb), tf = max(ta, tb);
      float e0 = max(max(tn.x, tn.y), tn.z), e1 = min(min(tf.x, tf.y), tf.z);
      if (e0 <= e1 && e1 > t0 && e0 - t0 < s && e0 <= t1) { s = max(e0 - t0, 0.0); kind = 6; }
    }
  }
  if (s > ds) return -1.0;
  gKind = kind;
  return t0 + s;
}

// returns (t, kind) with kind 0 = nothing, 1 = ground or water, 6 = block
vec2 traceFar(vec3 ro, vec3 rd, float tA, float tB, bool withB, out ivec2 hc) {
  hc = ivec2(0);
  float dx = safeDir(rd.x), dz = safeDir(rd.z);
  vec2 inv = vec2(1.0 / dx, 1.0 / dz);
  float t = tA;
  int lvl = 7;
  for (int i = 0; i < 160; i++) {
    if (t >= tB) break;
    vec3 p = ro + rd * t;
    if (rd.y >= 0.0 && p.y > GMAX) break;
    float sz = CS * float(1 << lvl);
    ivec2 tc = ivec2(floor(p.xz / sz));
    vec2 lo = vec2(tc) * sz;
    float tx = ((dx > 0.0 ? lo.x + sz : lo.x) - ro.x) * inv.x;
    float tz = ((dz > 0.0 ? lo.y + sz : lo.y) - ro.z) * inv.y;
    float tExit = min(max(min(tx, tz), t), tB);
    vec4 m = ffLoad(tc, lvl);
    float mh = withB ? m.z : m.x;
    if (min(p.y, ro.y + rd.y * tExit) > mh + 0.02) { t = tExit + 0.01; lvl = min(lvl + 1, 7); continue; }
    if (m.x - m.y < 0.005 && (!withB || m.z <= m.x + 0.005)) {
      if (rd.y < 0.0) {
        float tp = (m.x - ro.y) / rd.y;
        if (tp <= tExit) { float th = max(tp, t); hc = ivec2(floor((ro.xz + rd.xz * th) / CS)); return vec2(th, 1.0); }
      }
      t = tExit + 0.01; lvl = min(lvl + 1, 7); continue;
    }
    if (lvl > 0) { lvl -= 1; continue; }
    float th = farCell(ro, rd, t, tExit, tc, withB);
    if (th >= 0.0) { hc = tc; return vec2(th, float(gKind)); }
    t = tExit + 0.01;
  }
  return vec2(tB, 0.0);
}

struct BW { float sea, mnt, mid, des, bad, swp, fo; };
BW biomeW(float dry, float elev) {
  BW w;
  w.sea = sstepJ(0.40, 0.34, elev);
  w.mnt = sstepJ(0.60, 0.70, elev);
  w.mid = max(0.0, 1.0 - w.sea - w.mnt);
  w.des = sstepJ(0.56, 0.63, dry);
  w.bad = sstepJ(0.46, 0.52, dry) * (1.0 - w.des);
  w.swp = sstepJ(0.40, 0.34, dry) * sstepJ(0.52, 0.45, elev);
  w.fo = max(0.0, 1.0 - w.des - w.bad - w.swp);
  return w;
}
vec3 hue3(float h) { return clamp(abs(fract(vec3(h) + vec3(0.0, 0.667, 0.333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
vec3 zoneLamp(int z) {
  vec3 c[8] = vec3[8](vec3(0.85, 0.9, 1.0), vec3(1.0, 0.55, 0.6), vec3(1.0, 0.68, 0.38), vec3(1.0, 0.36, 0.18),
                      vec3(1.0, 0.5, 0.14), vec3(0.8, 0.9, 1.0), vec3(1.0, 0.72, 0.42), vec3(0.72, 0.52, 1.0));
  return c[z & 7];
}

vec3 skyCol(vec3 rd) {
  float sh = max(rd.y, 0.0);
  vec3 col = mix(skyHor, skyTop, pow(sh, 0.5));
  col += skyHor * 0.3 * exp(-abs(rd.y - 0.07) * 28.0) + fogCol * 0.15 * exp(-abs(rd.y - 0.2) * 12.0);
  float sd = max(dot(rd, sunDir), 0.0);
  col += sunCol * (0.07 * pow(sd, 5.0) + 0.25 * pow(sd, 64.0));
  col += sunCol * smoothstep(0.99955, 0.99975, sd) * 10.0;
  if (rd.y > 0.0) {
    vec2 cp = rd.xz / (rd.y + 0.12) * 0.8 + vec2(time * 0.004, time * 0.002);
    float n = vnoise(cp * 1.3, 41) * 0.6 + vnoise(cp * 3.1, 42) * 0.3 + vnoise(cp * 7.3, 43) * 0.1;
    float cov = smoothstep(0.55, 0.82, n) * smoothstep(0.02, 0.3, rd.y);
    col = mix(col, skyHor * 0.75 + sunCol * 0.1 * (0.4 + pow(sd, 4.0)), cov * 0.55);
    if (stars > 0.01) {
      vec2 sp = rd.xz / (rd.y + 0.25) * 240.0;
      vec2 id = floor(sp);
      float hs = hsh(int(id.x), int(id.y), 90);
      if (hs > 0.994) col += vec3(0.9, 0.93, 1.0) * stars * (1.0 - cov) * smoothstep(0.3, 0.0, length(sp - id - 0.5)) * (hs - 0.994) * 300.0 * smoothstep(0.0, 0.3, rd.y);
    }
    if (aur > 0.01 && stars > 0.2) {
      float az = atan(rd.x, -rd.z);
      vec3 a = vec3(0.0);
      for (int i = 0; i < 2; i++) {
        float fi = float(i);
        float curtain = vnoise(vec2(az * 3.0 + fi * 1.7 + time * 0.02, fi), 91 + i);
        float wave = rd.y - (0.1 + 0.08 * fi + 0.06 * vnoise(vec2(az * 5.0 - time * 0.05, fi * 3.0), 94 + i));
        float band = sstepJ(-0.015, 0.0, wave) * exp(-max(wave, 0.0) * 8.0);
        a += mix(vec3(0.1, 1.0, 0.45), vec3(0.75, 0.2, 1.0), clamp(max(wave, 0.0) * 5.0 + fi * 0.2, 0.0, 1.0)) * band * curtain * curtain;
      }
      col += a * aur * stars * sstepJ(-0.2, 0.6, -rd.z) * 0.6;
    }
  }
  // ringed planet and moon
  float alpha = mix(0.72, 0.97, stars);
  vec3 pd = uSat.xyz;
  float cz = dot(rd, pd);
  if (uSat.w > 0.0 && cz > 0.9) col += vec3(1.0, 0.78, 0.45) * 0.06 * exp(-(1.0 - cz) * 60.0);
  if (uSat.w > 0.0 && cz > 0.9) {
    vec3 e1 = normalize(cross(pd, vec3(0.0, 1.0, 0.0)));
    vec3 e2 = cross(e1, pd);
    vec2 q = vec2(dot(rd, e1), dot(rd, e2)) / cz;
    float R = uSat.w, ta = 0.42;
    vec2 rq = vec2(q.x * cos(ta) + q.y * sin(ta), -q.x * sin(ta) + q.y * cos(ta));
    float rr = abs(rq.x) / R;
    float ring = (sstepJ(1.35, 1.42, rr) - sstepJ(2.2, 2.3, rr)) * (0.65 + 0.35 * sin(rr * 37.0)) * step(abs(rq.y), R * 0.012);
    vec3 ringCol = vec3(0.95, 0.84, 0.68) * (0.35 + 0.65 * sstepJ(-0.2, 0.3, sunDir.y + 0.3));
    float r2 = dot(q, q) / (R * R);
    if (r2 < 1.0) {
      vec3 n = vec3(q / R, -sqrt(1.0 - r2));
      vec3 sl = vec3(dot(sunDir, e1), dot(sunDir, e2), dot(sunDir, pd));
      float lit = clamp(dot(n, -sl) * 0.9 + 0.35, 0.08, 1.0);
      float lat = rq.y / R;
      vec3 pc = mix(vec3(0.96, 0.84, 0.64), vec3(0.82, 0.48, 0.3), 0.5 + 0.5 * sin(lat * 13.0)) * lit * (0.65 + 0.35 * sqrt(1.0 - r2));
      col = mix(col, pc, alpha);
      if (rq.y < 0.0) col = mix(col, ringCol, ring * alpha * 0.85);
    } else col = mix(col, ringCol, ring * alpha * 0.8);
  }
  for (int mi = 0; mi < 2; mi++) {
    vec3 md = mi == 0 ? uMoonA.xyz : uMoonB.xyz;
    vec3 mc = mi == 0 ? vec3(0.3, 1.0, 0.88) : vec3(1.0, 0.42, 0.62);
    float mr = mi == 0 ? uMoonA.w : uMoonB.w;
    float dm = dot(rd, md);
    if (dm > 0.85) {
      float ang = acos(min(dm, 1.0));
      col += mc * (0.06 * exp(-ang * 10.0) + 0.3 * exp(-ang * 55.0)) * (0.55 + 0.45 * stars);
      if (ang < mr) {
        vec3 e1 = normalize(cross(md, vec3(0.0, 1.0, 0.0)));
        vec3 e2 = cross(e1, md);
        vec2 q = vec2(dot(rd, e1), dot(rd, e2)) / mr;
        float pat = vnoise(q * 3.0, 99 + mi) * 0.6 + vnoise(q * 9.0, 101) * 0.4;
        col = mix(col, mc * (1.2 + 1.3 * pat), 0.96);
      }
    }
  }
  return col;
}

vec3 fogApply(vec3 col, vec3 ro, vec3 rd, float t) {
  float b = 0.012, k = rd.y * b;
  float tt = max(t - 35.0, 0.0) / (1.0 + max(t - 2000.0, 0.0) / 9000.0);
  float fy = abs(k) > 1e-5 ? (1.0 - exp(-tt * k)) / k : tt;
  float amt = 1.0 - exp(-den * exp(-max(ro.y, 0.0) * b) * fy);
  float sunAmt = pow(max(dot(rd, sunDir), 0.0), 8.0);
  vec3 fc = mix(fogCol, fogCol * 0.6 + sunCol * 0.22, sunAmt);
  return mix(col, fc, clamp(amt, 0.0, 1.0));
}

struct Surf { vec3 alb; vec3 emi; float spec; float refl; };

Surf terrainSurf(vec3 p, vec3 n, vec4 tv) {
  Surf s;
  s.emi = vec3(0.0); s.spec = 0.1; s.refl = 0.0;
  BW w = biomeW(tv.z, tv.w);
  float H = tv.x;
  float nz = vnoise(p.xz / 37.0, 61) * 0.6 + vnoise(p.xz / 9.0, 62) * 0.4;
  if (tv.y > H + 0.01) {
    float depth = tv.y - H;
    float swampy = w.swp * w.mid;
    vec3 deep = vec3(0.006, 0.005, 0.004);
    vec3 shallow = vec3(0.09, 0.055, 0.025);
    if (swampy > 0.3) { deep = vec3(0.03, 0.022, 0.012); shallow = vec3(0.1, 0.07, 0.03); }
    s.alb = mix(shallow, deep, sstepJ(0.0, 14.0, depth));
    s.refl = 1.0;
    s.spec = 1.2;
    return s;
  }
  float slope = 1.0 - n.y;
  vec3 grass = mix(vec3(0.11, 0.065, 0.05), vec3(0.19, 0.11, 0.07), nz);
  vec3 forest = mix(vec3(0.05, 0.03, 0.06), vec3(0.08, 0.05, 0.08), vnoise(p.xz / 6.0, 66));
  vec3 sand = mix(vec3(0.2, 0.12, 0.065), vec3(0.36, 0.22, 0.11), nz);
  float band = fract(H / 11.0 + vnoise(p.xz / 300.0, 64) * 0.6);
  vec3 strata = mix(mix(vec3(0.62, 0.6, 0.58), vec3(0.42, 0.3, 0.2), step(0.33, band)), vec3(0.72, 0.42, 0.18), step(0.7, band));
  vec3 swampC = mix(vec3(0.07, 0.05, 0.035), vec3(0.13, 0.09, 0.05), nz);
  vec3 rock = mix(vec3(0.5, 0.54, 0.58), vec3(0.66, 0.68, 0.7), nz);
  // glowwoods: bioluminescent specks through the forest
  s.emi = hue3(0.45 + 0.35 * vnoise(p.xz / 30.0, 67)) * step(0.86, vnoise(p.xz * 1.1, 68)) * w.mid * w.fo * (0.05 + 1.2 * win * win);
  vec3 col = w.mid * (w.fo * mix(grass, forest, 0.7) + w.des * sand + w.bad * strata + w.swp * swampC) + w.mnt * mix(forest, rock, sstepJ(120.0, 380.0, H)) + w.sea * sand;
  col = mix(col, sand * 1.05, (1.0 - sstepJ(0.5, 3.5, H)) * sstepJ(-50.0, -1.0, tv.y));
  col = mix(col, rock, sstepJ(0.35, 0.6, slope) * (1.0 - w.bad * 0.6));
  float snowLine = 220.0 + 80.0 * (vnoise(p.xz / 120.0, 65) - 0.5);
  float snow = sstepJ(snowLine, snowLine + 50.0, H) * sstepJ(0.55, 0.3, slope);
  s.alb = mix(col, vec3(0.9, 0.86, 0.78), snow);
  s.spec = 0.08 + 0.3 * snow;
  return s;
}

Surf cityGround(vec3 p, float t) {
  Surf s;
  s.spec = 0.4; s.refl = 0.0;
  ivec2 ci = ivec2(floor(p.xz / CS));
  vec2 lq = p.xz - (vec2(ci) + 0.5) * CS;
  float e = 13.0 - max(abs(lq.x), abs(lq.y));
  float detail = 1.0 - smoothstep(110.0, 360.0, t);
  float road = 1.0 - smoothstep(3.25, 3.45, e);
  vec4 b = blockInfo(ci);
  int st = int(b.w + 0.5);
  int typ = st & 15, zone = st >> 4;
  vec3 col = mix(vec3(0.23, 0.22, 0.21), vec3(0.032, 0.034, 0.04), road);
  if ((typ == 4 || typ == 5) && e > 3.4) col = vec3(0.05, 0.09, 0.03) * (0.8 + 0.4 * vnoise(p.xz * 0.3, 12));
  float along = abs(lq.x) > abs(lq.y) ? p.z : p.x;
  float line = (1.0 - smoothstep(0.05, 0.09, e)) * step(0.5, fract(along / 5.0)) * detail;
  col = mix(col, vec3(0.55, 0.5, 0.38), line * 0.65);
  s.alb = col;
  s.refl = road * 0.35;
  float lampA = 9.0 * floor(along / 9.0 + 0.5);
  vec2 ld = vec2(along - lampA, e - 2.9);
  s.emi = zoneLamp(zone) * exp(-dot(ld, ld) * 0.35) * win * 0.16 * road;
  // moving head and tail lights along the lanes at night
  if (road > 0.5 && win > 0.2) {
    float lat = abs(lq.x) > abs(lq.y) ? lq.x : lq.y;
    float dist = e;
    float lane = dist < 1.6 ? 1.0 : 0.0;
    int lid = abs(lq.x) > abs(lq.y) ? ci.x * 2 + (lat > 0.0 ? 1 : 0) : ci.y * 2 + 7777 + (lat > 0.0 ? 1 : 0);
    float dir = (lat > 0.0) == (abs(lq.x) > abs(lq.y)) ? 1.0 : -1.0;
    float ph = fract((along + dir * time * 11.0) / 23.0 + hsh(lid, int(floor((along + dir * time * 11.0) / 23.0)), 7));
    float pair = 1.0 - smoothstep(0.08, 0.14, abs(abs(dist - 1.7) - 0.55));
    float car = (1.0 - smoothstep(0.01, 0.016, ph)) * pair;
    s.emi += (lat > 0.0 ? vec3(1.0, 0.12, 0.06) : vec3(1.0, 0.92, 0.75)) * car * win * 3.0 * detail;
  }
  return s;
}

Surf facade(vec3 p, vec3 n, ivec2 c, vec4 b, float t) {
  Surf s;
  s.emi = vec3(0.0); s.spec = 0.4; s.refl = 0.0;
  int st = int(b.w + 0.5);
  int typ = st & 15, zone = st >> 4;
  int cseed = c.x * 7919 + c.y * 104729;
  float detail = 1.0 - smoothstep(200.0, 900.0, t);
  vec3 base = vec3(0.1, 0.11, 0.13);
  vec3 wc = vec3(1.0, 0.72, 0.45);
  float wide = 1.5;
  if (typ == 2) { base = zone == 3 ? vec3(0.55, 0.08, 0.05) : vec3(0.5, 0.44, 0.36); wide = 3.0; }
  else if (typ == 3) { base = vec3(0.32, 0.22, 0.48); wc = vec3(0.8, 0.5, 1.0); }
  else if (typ == 4 || typ == 5) { base = vec3(0.07, 0.16, 0.06); wc = vec3(0.0); }
  else if (typ == 6) { base = vec3(0.06, 0.08, 0.1); wc = vec3(0.4, 0.9, 1.0); }
  else if (typ == 8) { base = vec3(0.2, 0.26, 0.2); }
  else if (typ == 9) { base = vec3(0.16, 0.14, 0.12); wc = vec3(1.0, 0.45, 0.12); }
  else if (typ == 10) { base = vec3(0.7, 0.7, 0.68); wc = vec3(0.8, 0.9, 1.0); }
  else if (typ == 11) { base = vec3(0.55, 0.12, 0.08); wc = vec3(1.0, 0.3, 0.2); }
  else if (typ == 13) { base = vec3(0.2, 0.16, 0.08); wc = vec3(1.0, 0.8, 0.4); }
  if (zone == 6 && typ == 1) { wide = 1.1; base = 0.3 + 0.3 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + hsh(cseed, 3, 72))); }
  if (zone == 1) wc = mix(wc, vec3(1.0, 0.35, 0.8), 0.35);
  s.alb = base;
  if (abs(n.y) > 0.5) {
    s.alb = base * 0.6;
    // a red beacon on tall roofs
    vec2 cen = (vec2(c) + 0.5) * CS;
    if (b.x > 70.0) s.emi = vec3(1.0, 0.1, 0.05) * exp(-dot(p.xz - cen, p.xz - cen) * 0.8) * step(0.5, fract(time * 0.7 + hsh(cseed, 1, 3))) * 6.0;
    return s;
  }
  float facU = abs(n.x) > abs(n.z) ? p.z : p.x;
  float fx = facU / wide, fy = p.y / 3.6;
  float gx = fract(fx), gy = fract(fy);
  float frame = max(1.0 - smoothstep(0.04, 0.1, min(gx, 1.0 - gx)), smoothstep(0.78, 0.82, gy)) * detail;
  if (typ == 4 || typ == 5) frame = 1.0;
  s.alb = mix(base * 0.35 + vec3(0.02, 0.03, 0.04), base, frame);
  s.refl = (1.0 - frame) * 0.4;
  s.spec = 0.8;
  int wid = int(floor(fx)) + cseed, fl = int(floor(fy));
  float hr = hsh(wid, fl * 131 + int(floor(time / 40.0 + hsh(wid, fl, 67) * 7.0)) * 7, 62);
  float litP = 0.05 + 0.25 * win;
  float lit = mix(step(hr, litP) * (1.0 - frame) * (0.3 + 0.7 * fract(hr * 7.3)), litP * 0.55, 1.0 - detail);
  s.emi = wc * lit * win * 1.1;
  // neon bands in the neon strip and Chinatown
  if ((zone == 1 || zone == 3) && typ <= 3 && p.y > 4.5 && p.y < 7.5) {
    float nb = step(abs(p.y - 6.0), 0.35) * step(0.4, hsh(cseed, int(floor(facU / 9.0)), 5));
    s.emi += hue3(hsh(cseed, int(floor(facU / 9.0)), 6) * 0.3 + (zone == 3 ? 0.95 : 0.8)) * nb * (0.6 + 2.2 * win);
  }
  if (typ == 9 && p.y > b.x - 1.5) s.emi += vec3(1.0, 0.08, 0.05) * step(0.5, fract(time * 0.7)) * 4.0;
  return s;
}

void main() {
  vec2 sv = vec2((2.0 * gl_FragCoord.x - res.x) / res.y, (2.0 * gl_FragCoord.y - res.y) / res.y);
  vec3 rd = normalize(camF + (sv.x * camR + sv.y * camU) * fov);
  vec3 ro = camPos;
  ivec2 hc;
  vec2 h = traceFar(ro, rd, 0.0, 1200.0, false, hc);
  if (h.y < 0.5) h = traceFar(ro, rd, 0.0, TFAR, true, hc);
  else {
    ivec2 hc2;
    vec2 hb = traceFar(ro, rd, 0.0, h.x, true, hc2);
    if (hb.y > 5.5) { h = hb; hc = hc2; }
  }
  vec3 col;
  if (h.y > 0.5) {
    vec3 p = ro + rd * h.x;
    vec3 n;
    Surf s;
    if (h.y > 5.5) {
      vec4 b = blockInfo(hc);
      vec2 cen = (vec2(hc) + 0.5) * CS;
      vec3 q = vec3(p.x - cen.x, p.y - b.x * 0.5, p.z - cen.y) / vec3(b.y, b.x * 0.5 + 1.0, b.z);
      vec3 aq = abs(q);
      n = (aq.y > aq.x && aq.y > aq.z) ? vec3(0.0, sign(q.y), 0.0) : (aq.x > aq.z ? vec3(sign(q.x), 0.0, 0.0) : vec3(0.0, 0.0, sign(q.z)));
      s = facade(p, n, hc, b, h.x);
    } else {
      vec4 m0 = ffLoad(ivec2(floor(p.xz / CS)), 0);
      n = vec3(0.0, 1.0, 0.0);
      if (m0.x - m0.y > 0.005) {
        float e = 13.0;
        n = normalize(vec3(surfH(terrAt(p.xz - vec2(e, 0.0))) - surfH(terrAt(p.xz + vec2(e, 0.0))), 2.0 * e, surfH(terrAt(p.xz - vec2(0.0, e))) - surfH(terrAt(p.xz + vec2(0.0, e)))));
      }
      vec4 tv = terrAt(p.xz);
      if (hasCity < 0.5 || tv.x > 0.25 || tv.y > tv.x || cityDist(p.xz) > cityR(p.xz) - 5.0) s = terrainSurf(p, n, tv);
      else s = cityGround(p, h.x);
    }
    float sha = 1.0;
    if (shadowsOn > 0.5 && sunDir.y > 0.02 && dot(n, sunDir) > 0.0 && h.x < 3000.0) {
      ivec2 d0;
      vec2 sh = traceFar(p + n * 0.3, sunDir, 0.2, 2500.0, true, d0);
      sha = sh.y > 0.5 ? 0.0 : 1.0;
    }
    float dif = max(dot(n, sunDir), 0.0) * sha;
    vec3 amb = mix(skyHor, skyTop, 0.5 + 0.5 * n.y) * 0.9 + (vec3(0.16, 0.5, 0.45) * max(dot(n, uMoonA.xyz), 0.0) + vec3(0.5, 0.18, 0.3) * max(dot(n, uMoonB.xyz), 0.0)) * (0.08 + 0.3 * stars);
    col = s.alb * (sunCol * dif + amb) + s.emi;
    vec3 hv = normalize(sunDir - rd);
    col += sunCol * pow(max(dot(n, hv), 0.0), 60.0) * s.spec * 0.3 * sha;
    if (s.refl > 0.0) {
      float fr = 0.04 + 0.96 * pow(1.0 - clamp(dot(-rd, n), 0.0, 1.0), 5.0);
      vec3 r = reflect(rd, n);
      r.y = abs(r.y);
      col = mix(col, skyCol(r), clamp(fr * s.refl, 0.0, 1.0));
    }
    col = fogApply(col, ro, rd, h.x);
  } else {
    col = fogApply(skyCol(rd), ro, rd, TFAR);
  }
  // 1970s paperback cover grading, as in the WebGPU path
  col = clamp((col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14), 0.0, 1.0);
  col = pow(col, vec3(1.0 / 2.2));
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.28);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, 1.2);
  col = mix(col, col * vec3(0.82, 0.95, 1.08) + vec3(0.015, 0.03, 0.045), 1.0 - smoothstep(0.0, 0.45, lum));
  col = mix(col, col * vec3(1.08, 0.98, 0.86), smoothstep(0.45, 1.0, lum));
  col = col * 0.93 + vec3(0.035, 0.03, 0.045);
  vec2 uv = gl_FragCoord.xy / res;
  col *= 0.74 + 0.26 * pow(16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y), 0.2);
  col *= 0.975 + 0.05 * vnoise(gl_FragCoord.xy * 0.9, 120);
  outCol = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
const FB_VS = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }
`;

// Builds the terrain grid (every other block corner), the per-block data and the max-height pyramid on the CPU.
function makeFallbackWorld() {
  const NT = 384, NWF = 768, TCS = 52;
  const terr = new Float32Array(NT * NT * 4);
  const ffb = new Float32Array(NWF * NWF * 4);
  const levels = [];
  for (let k = 0; k < 9; k++) levels.push(new Float32Array((NWF >> k) * (NWF >> k) * 4));
  const camT = ((Math.floor(st.z / TCS) % NT) + NT) % NT, camB = ((Math.floor(st.z / C) % NWF) + NWF) % NWF;
  const tOrder = Array.from({ length: NT }, (_, r) => r).sort((a, b) => Math.abs(wrapN(a - camT, NT)) - Math.abs(wrapN(b - camT, NT)));
  const bOrder = Array.from({ length: NWF }, (_, r) => r).sort((a, b) => Math.abs(wrapN(a - camB, NWF)) - Math.abs(wrapN(b - camB, NWF)));
  const W = { NT, NWF, terr, ffb, levels, tNext: 0, bNext: 0, since: 0, dirtyT: [], dirtyB: [] };
  W.step = (budgetMs) => {
    const t0 = performance.now();
    while (performance.now() - t0 < budgetMs && (W.tNext < NT || W.bNext < NWF)) {
      if (W.tNext < NT) {
        const r = tOrder[W.tNext++];
        for (let i = 0; i < NT; i++) terr.set(terrainAt(i * TCS, r * TCS), (r * NT + i) * 4);
        W.dirtyT.push(r);
        W.since += 2;
      } else {
        const r = bOrder[W.bNext++];
        for (let i = 0; i < NWF; i++) {
          const f = farInfo(wrapS(i), wrapS(r)), o = (r * NWF + i) * 4;
          if (f) {
            const typ = f[3] & 15;
            // parks and woods are coloured into the ground instead of drawn as boxes
            if (typ === 4 || typ === 5) { ffb[o] = 0; ffb[o + 1] = 0; ffb[o + 2] = 0; ffb[o + 3] = f[3]; }
            else ffb.set(f, o);
          } else { ffb[o] = 0; ffb[o + 1] = 0; ffb[o + 2] = 0; ffb[o + 3] = 0; }
        }
        W.dirtyB.push(r);
        W.since += 1;
      }
    }
    const done = W.tNext >= NT && W.bNext >= NWF;
    if (W.since >= 96 || (done && W.since > 0)) { W.since = 0; W.buildPyramid(); return true; }
    return false;
  };
  // surface height at block corner (i, j): bilinear in the terrain grid, as the shader samples it
  const V = new Float32Array(NWF * NWF);
  W.buildPyramid = () => {
    const tv = (i, j, c) => terr[((((j % NT) + NT) % NT) * NT + (((i % NT) + NT) % NT)) * 4 + c];
    for (let j = 0; j < NWF; j++) for (let i = 0; i < NWF; i++) {
      const ti = i >> 1, tj = j >> 1, fx = (i & 1) * 0.5, fz = (j & 1) * 0.5;
      const bil = (c) => (tv(ti, tj, c) * (1 - fx) + tv(ti + 1, tj, c) * fx) * (1 - fz) + (tv(ti, tj + 1, c) * (1 - fx) + tv(ti + 1, tj + 1, c) * fx) * fz;
      V[j * NWF + i] = Math.max(bil(0), bil(1));
    }
    const L0 = levels[0];
    for (let j = 0; j < NWF; j++) for (let i = 0; i < NWF; i++) {
      const i1 = (i + 1) % NWF, j1 = (j + 1) % NWF;
      const a = V[j * NWF + i], b = V[j * NWF + i1], c = V[j1 * NWF + i], d = V[j1 * NWF + i1];
      const mx = Math.max(a, b, c, d), o = (j * NWF + i) * 4;
      L0[o] = mx; L0[o + 1] = Math.min(a, b, c, d); L0[o + 2] = Math.max(mx, ffb[o]); L0[o + 3] = 0;
    }
    for (let k = 1; k < 9; k++) {
      const n = NWF >> k, src = levels[k - 1], dst = levels[k], m = n * 2;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const o = (j * n + i) * 4, a = ((2 * j) * m + 2 * i) * 4, b = a + 4, c = a + m * 4, d = c + 4;
        dst[o] = Math.max(src[a], src[b], src[c], src[d]);
        dst[o + 1] = Math.min(src[a + 1], src[b + 1], src[c + 1], src[d + 1]);
        dst[o + 2] = Math.max(src[a + 2], src[b + 2], src[c + 2], src[d + 2]);
      }
    }
  };
  W.buildPyramid();
  return W;
}

let FB_ACTIVE = false;
// Without WebGPU there is no space view: surface destinations are reached directly
function fallbackJump(dest) {
  if (dest.space) { showHint("Views from orbit and of the Saturn system need WebGPU; this browser is using the simpler WebGL version.", 6000); NAV.mode = "surface"; return; }
  arriveRegion(dest);
  st.x = 0; st.z = 0; st.y = 250; st.vx = Math.cos(st.yaw) * 20; st.vz = Math.sin(st.yaw) * 20; st.vy = 0; st.mode = "high"; st.tour = null;
  NAV.mode = "surface"; NAV.arrivedAt = clock;
  showHint(dest.note, 9000);
}
function initGL(reason) {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" });
  if (!gl) return false;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const vs = sh(gl.VERTEX_SHADER, FB_VS), fs = sh(gl.FRAGMENT_SHADER, FB_GLSL);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    fail("Neither WebGPU nor the WebGL fallback could start on this device.", (gl.getShaderInfoLog(fs) || "") + (gl.getProgramInfoLog(prog) || ""));
    return true;
  }
  gl.useProgram(prog);
  const U = {};
  for (const n of ["hasCity", "uSat", "uMoonA", "uMoonB", "terrT", "ffB", "ffM", "camPos", "camF", "camR", "camU", "res", "fov", "time", "win", "stars", "den", "aur", "shadowsOn", "sunDir", "sunCol", "skyTop", "skyHor", "fogCol"]) U[n] = gl.getUniformLocation(prog, n);
  let W = makeFallbackWorld();
  FB_ACTIVE = true;
  const mkTex = (unit, w, h, levels) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, levels, gl.RGBA32F, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, levels > 1 ? gl.NEAREST_MIPMAP_NEAREST : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const tT = mkTex(0, W.NT, W.NT, 1), tB = mkTex(1, W.NWF, W.NWF, 1), tM = mkTex(2, W.NWF, W.NWF, 9);
  gl.uniform1i(U.terrT, 0); gl.uniform1i(U.ffB, 1); gl.uniform1i(U.ffM, 2);
  const upPyramid = () => {
    gl.activeTexture(gl.TEXTURE2);
    for (let k = 0; k < 9; k++) { const n = W.NWF >> k; gl.texSubImage2D(gl.TEXTURE_2D, k, 0, 0, n, n, gl.RGBA, gl.FLOAT, W.levels[k]); }
  };
  const upRows = () => {
    if (W.dirtyT.length) {
      gl.activeTexture(gl.TEXTURE0);
      for (const r of W.dirtyT) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, r, W.NT, 1, gl.RGBA, gl.FLOAT, W.terr, r * W.NT * 4);
      W.dirtyT.length = 0;
    }
    if (W.dirtyB.length) {
      gl.activeTexture(gl.TEXTURE1);
      for (const r of W.dirtyB) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, r, W.NWF, 1, gl.RGBA, gl.FLOAT, W.ffb, r * W.NWF * 4);
      W.dirtyB.length = 0;
    }
  };
  upPyramid();
  worldResetHook = () => {
    W = makeFallbackWorld();
    gl.activeTexture(gl.TEXTURE0); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W.NT, W.NT, gl.RGBA, gl.FLOAT, W.terr);
    gl.activeTexture(gl.TEXTURE1); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W.NWF, W.NWF, gl.RGBA, gl.FLOAT, W.ffb);
    upPyramid();
  };
  statusEl.title = "WebGL fallback: " + reason;
  showHint("No WebGPU here: showing a simpler city.", 7000);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let scale = 0.5, last = performance.now(), ema = 16.7, lastChange = 0, dtS = 1 / 60, hud = 0, shadows = 1, slowT = 0;
  const resize = () => {
    const w = Math.max(64, Math.round(innerWidth * dpr * scale)), h = Math.max(64, Math.round(innerHeight * dpr * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  };
  resize();
  addEventListener("resize", resize);
  function frame(now) {
    if (hostPaused()) { last = now; requestAnimationFrame(frame); return; } // paused by the foafos shell (host.js)
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;
    ema = ema * 0.93 + dt * 1000 * 0.07;
    dtS = dtS * 0.75 + dt * 0.25;
    // resolution follows frame time; shadows go first when the device struggles
    if (now - lastChange > 2000) {
      if (ema > 40 && scale > 0.25) { if (shadows && ema > 50) shadows = 0; else scale = Math.max(0.25, scale * 0.85); lastChange = now; resize(); }
      else if (ema < 22 && scale < 0.8) { slowT += dt; if (slowT > 3) { scale = Math.min(0.8, scale * 1.1); lastChange = now; slowT = 0; resize(); } }
    }
    clock += dtS; if (!CITYP.on) wclock += dtS;
    if (!INTRO.started && frameNoGL > 4 && worldOn()) worldStart();   // the world beside a story in foafos (tales.js)
    update(dtS);
    recentre();
    taleSync(dtS);
    worldShift = null;
    if (W.step(frameNoGL < 2 ? 1 : 4)) upPyramid();
    upRows();
    const tod = currentTod(), cam = cameraVectors();
    CAMNOW.p = [st.x, st.y, st.z]; CAMNOW.f = cam.f; CAMNOW.r = cam.r; CAMNOW.up = cam.up;
    updateWeather(dt);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform3f(U.camPos, st.x, st.y, st.z);
    gl.uniform3fv(U.camF, cam.f); gl.uniform3fv(U.camR, cam.r); gl.uniform3fv(U.camU, cam.up);
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform1f(U.fov, 0.72); gl.uniform1f(U.time, wclock); gl.uniform1f(U.win, tod.win); gl.uniform1f(U.stars, tod.stars); gl.uniform1f(U.den, tod.den);
    const night = Math.min(1, Math.max(0, (tod.win - 0.25) / 0.8)), ak = Math.floor(clock / 330);
    gl.uniform1f(U.aur, night * (hsh(ak, 1, 170) < 0.4 ? 1 : 0));
    gl.uniform1f(U.shadowsOn, shadows);
    const sg = skyGeometry();
    gl.uniform1f(U.hasCity, REG.city);
    gl.uniform4f(U.uSat, sg.sat[0], sg.sat[1], sg.sat[2], sg.sat[1] > -0.1 ? sg.satR : 0);
    gl.uniform4f(U.uMoonA, sg.moonA.dir[0], sg.moonA.dir[1], sg.moonA.dir[2], sg.moonA.r);
    gl.uniform4f(U.uMoonB, sg.moonB.dir[0], sg.moonB.dir[1], sg.moonB.dir[2], sg.moonB.r);
    gl.uniform3fv(U.sunDir, tod.sun); gl.uniform3fv(U.sunCol, tod.sunCol); gl.uniform3fv(U.skyTop, tod.skyTop); gl.uniform3fv(U.skyHor, tod.skyHor); gl.uniform3fv(U.fogCol, tod.fog);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frameNoGL++;
    hud += dt;
    if (hud > 0.25) {
      hud = 0;
      const autoOn = clock - lastInput > 4.5;
      const parts = [CITYP.on ? "City paused" : autoOn ? "Autopilot" : "Steering by hand", placeName(), st.y.toFixed(0) + " m"];
      if (hostOn()) hostStatus(parts);                 // in foafos the readout is the shell's (host.js)
      else statusEl.innerHTML = "<b>" + parts[0] + "</b><span>" + parts[1] + "</span><span>" + parts[2] + "</span>";
      if (statsOn) statsEl.textContent = "WebGL fallback (" + reason + "). Frame " + ema.toFixed(1) + " ms, render " + canvas.width + " × " + canvas.height + " (" + Math.round(scale * 100) + "%), shadows " + (shadows ? "on" : "off") + ", world data " + Math.round(100 * (W.tNext + W.bNext) / (W.NT + W.NWF)) + "%";
    }
    if (typeof benchTick === "function") benchTick(dt, ema, null, scale, canvas.width, canvas.height);
    pickMarkFrame(); pickNearFrame(); mapLabelsFrame();
    requestAnimationFrame(frame);
  }
  let frameNoGL = 0;
  requestAnimationFrame(frame);
  return true;
}
function startFallback(msg, detail) {
  let ok = false;
  try { ok = initGL(msg); } catch (e) { ok = false; detail = (detail ? detail + "\n" : "") + String(e && e.stack || e); }
  if (!ok) fail(msg, detail);
}
