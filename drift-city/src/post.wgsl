@group(0) @binding(2) var curTex: texture_2d<f32>;
@group(0) @binding(3) var histTex: texture_2d<f32>;
@group(0) @binding(4) var samp: sampler;
@group(0) @binding(5) var srcTex: texture_2d<f32>;
@group(0) @binding(6) var bloomTex: texture_2d<f32>;

fn tmw(c: vec3f) -> vec3f { return c / (1.0 + luma(c)); }
fn itmw(c: vec3f) -> vec3f { return c / max(1.0 - luma(c), 1e-3); }

fn halfLoad(q: vec2i, hsz: vec2i) -> vec4f {
  return textureLoad(curTex, clamp(q, vec2i(0), hsz - 1), 0);
}

@fragment fn taa(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let X = i32(fc.x);
  let Y = i32(fc.y);
  let hsz = vec2i(textureDimensions(curTex));
  let par = (Y + i32(u.frame)) & 1;
  let own = (X & 1) == par;
  let hx = X >> 1;
  var m1 = vec3f(0.0);
  var m2 = vec3f(0.0);
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let c = tmw(halfLoad(vec2i(hx + i, Y + j), hsz).rgb);
      m1 += c;
      m2 += c * c;
    }
  }
  let mu = m1 / 9.0;
  let sig = sqrt(max(m2 / 9.0 - mu * mu, vec3f(0.0)));
  var cur: vec4f;
  if (own) {
    cur = halfLoad(vec2i(hx, Y), hsz);
  } else {
    let l = halfLoad(vec2i((X - 1) >> 1, Y), hsz);
    let r = halfLoad(vec2i((X + 1) >> 1, Y), hsz);
    let a = halfLoad(vec2i(hx, Y - 1), hsz);
    let b = halfLoad(vec2i(hx, Y + 1), hsz);
    cur = vec4f((l.rgb + r.rgb + a.rgb + b.rgb) * 0.25, min(min(l.a, r.a), min(a.a, b.a)));
  }
  let cc = tmw(cur.rgb);
  var outc = cc;
  if (u.histValid > 0.5) {
    let fj = fc.xy + select(vec2f(0.0), u.jitter, own);
    let uv = vec2f(fj.x * 2.0 - u.res.x, u.res.y - fj.y * 2.0) / u.res.y;
    let rd = normalize(u.camFwd + (uv.x * u.camRight + uv.y * u.camUp) * u.fov);
    let t = select(cur.a, 40000.0, cur.a >= 1199.0);
    let v = u.camPos + rd * t - u.prevPos;
    let z = dot(v, u.prevFwd);
    if (z > 0.1) {
      let pu = vec2f(dot(v, u.prevRight), dot(v, u.prevUp)) / (z * u.fov);
      let ppx = vec2f((pu.x * u.res.y + u.res.x) * 0.5, (u.res.y - pu.y * u.res.y) * 0.5) - select(vec2f(0.0), u.jitter, own);
      let huv = ppx / u.res;
      if (all(huv > vec2f(0.0)) && all(huv < vec2f(1.0))) {
        var hc = tmw(textureSampleLevel(histTex, samp, huv, 0.0).rgb);
        hc = clamp(hc, mu - 1.3 * sig, mu + 1.3 * sig);
        let vel = clamp(length(ppx - fc.xy) / 24.0, 0.0, 1.0);
        let alpha = select(0.045 + 0.15 * vel, 0.085 + 0.22 * vel, own);
        outc = mix(hc, cc, alpha);
      }
    }
  }
  return vec4f(itmw(outc), cur.a);
}

@fragment fn bloomDown(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let sz = vec2f(textureDimensions(srcTex));
  let uv = fc.xy * 4.0 / sz;
  let o = 1.0 / sz;
  var c = textureSampleLevel(srcTex, samp, uv + vec2f(-1.0, -1.0) * o, 0.0).rgb;
  c += textureSampleLevel(srcTex, samp, uv + vec2f(1.0, -1.0) * o, 0.0).rgb;
  c += textureSampleLevel(srcTex, samp, uv + vec2f(-1.0, 1.0) * o, 0.0).rgb;
  c += textureSampleLevel(srcTex, samp, uv + vec2f(1.0, 1.0) * o, 0.0).rgb;
  c *= 0.25;
  c *= smoothstep(1.3, 4.0, luma(c));
  return vec4f(min(c, vec3f(10.0)), 1.0);
}

fn blur(fc: vec2f, dir: vec2f) -> vec4f {
  let sz = vec2f(textureDimensions(srcTex));
  let uv = fc / sz;
  let o = dir / sz;
  var c = textureSampleLevel(srcTex, samp, uv, 0.0).rgb * 0.227;
  c += (textureSampleLevel(srcTex, samp, uv + o * 1.385, 0.0).rgb + textureSampleLevel(srcTex, samp, uv - o * 1.385, 0.0).rgb) * 0.316;
  c += (textureSampleLevel(srcTex, samp, uv + o * 3.231, 0.0).rgb + textureSampleLevel(srcTex, samp, uv - o * 3.231, 0.0).rgb) * 0.07;
  return vec4f(c, 1.0);
}
@fragment fn blurH(@builtin(position) fc: vec4f) -> @location(0) vec4f { return blur(fc.xy, vec2f(1.6, 0.0)); }
@fragment fn blurV(@builtin(position) fc: vec4f) -> @location(0) vec4f { return blur(fc.xy, vec2f(0.0, 1.6)); }

fn pnoise(p: vec2f, k: i32) -> f32 {
  let i = vec2i(floor(p));
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  return mix(mix(hsh(i.x, i.y, k), hsh(i.x + 1, i.y, k), w.x), mix(hsh(i.x, i.y + 1, k), hsh(i.x + 1, i.y + 1, k), w.x), w.y);
}

fn aces(x: vec3f) -> vec3f {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}

// One layer of falling snow, as flakes fixed in a moving 3D grid of cells of size s: the ray steps cell to cell
// (to tMax, or the scene depth), and each cell holds at most one flake. The grid falls and drifts with the wind, so
// flakes keep their place in the world as the camera moves, with true parallax, and nothing is tied to the view.
// A flake is a disc of world radius r (no smaller than a pixel, with its light spread out) drawn along mv, the
// camera's travel this frame; very near flakes are out of focus. Returns the light the layer lets through.
fn snowLayer(ro: vec3f, rd: vec3f, dep: f32, s: f32, tMax: f32, r: f32, dens: f32, fall: f32, k: i32, mv: vec3f, pw: f32, n: i32) -> f32 {
  let T = u.time;
  let off = vec3f(u.p6 / 3.0, -fall * T, u.p7 / 3.0) + vec3f(f32(k) * 0.37 * s);
  let o = ro - off;
  let tEnd = min(tMax, dep);
  // streaks stay inside a flake's own cell, or they would be cut off square
  var m = mv;
  let ml = length(m);
  if (ml > 0.3 * s) { m *= 0.3 * s / ml; }
  var cell = floor(o / s);
  let st = sign(rd);
  let ird = 1.0 / max(abs(rd), vec3f(1e-6));
  var tn = ((cell + max(st, vec3f(0.0))) * s - o) * st * ird;
  let td = s * ird;
  var tr = 1.0;
  var t = 0.0;
  for (var i = 0; i < n; i++) {
    if (t > tEnd) { break; }
    let ci = vec3i(cell);
    if (hsh(ci.x * 7 + ci.y * 131, ci.z, 160 + k) < dens) {
      let h1 = hsh(ci.x, ci.y * 7 + ci.z, 161 + k);
      let h2 = hsh(ci.y, ci.z * 7 + ci.x, 162 + k);
      let h3 = hsh(ci.z, ci.x * 7 + ci.y, 163 + k);
      // a flake near the middle of its cell, swaying and tumbling as it falls
      var fc = (cell + vec3f(h1, h2, h3) * 0.4 + 0.3) * s;
      fc += vec3f(sin(T * (0.7 + h2) + h1 * 6.3), 0.0, cos(T * (0.6 + h3) + h2 * 6.3)) * 0.1 * s;
      // closest approach of the ray to the segment fc .. fc + m
      let w0 = o - fc;
      let bb = dot(rd, m);
      let cc = max(dot(m, m), 1e-8);
      let dd = dot(rd, w0);
      let ee = dot(m, w0);
      let den = cc - bb * bb;
      var sc = select(clamp((ee - bb * dd) / den, 0.0, 1.0), 0.0, den < 1e-6);
      if (cc < 1e-7) { sc = 0.0; }
      let tc = max(dot(fc + m * sc - o, rd), 0.0);
      let dist = length(o + rd * tc - (fc + m * sc));
      if (tc > 0.05 && tc < tEnd) {
        let rr = r * (0.6 + 0.8 * h1);
        // out of focus close to the lens; at least half a pixel far away
        let blur = rr * 1.6 / max(tc, 0.25);
        let re = max(max(rr, pw * tc * 0.6), rr + blur * 0.12);
        var a = (rr * rr) / (re * re) * (1.0 - smoothstep(re * 0.35, re, dist));
        a /= 1.0 + length(m - rd * dot(m, rd)) / (2.0 * re);
        a *= 0.9 * (1.0 - smoothstep(tMax * 0.6, tMax, tc));
        tr *= 1.0 - clamp(a, 0.0, 0.95);
      }
    }
    // step to the next cell
    if (tn.x < tn.y && tn.x < tn.z) { t = tn.x; tn.x += td.x; cell.x += st.x; }
    else if (tn.y < tn.z) { t = tn.y; tn.y += td.y; cell.y += st.y; }
    else { t = tn.z; tn.z += td.z; cell.z += st.z; }
  }
  return tr;
}

@fragment fn comp(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let uv = fc.xy / u.outRes;
  let ts = 1.0 / u.res;
  var c = textureSampleLevel(srcTex, samp, uv, 0.0).rgb;
  let n0 = textureSampleLevel(srcTex, samp, uv + vec2f(ts.x, 0.0), 0.0).rgb;
  let n1 = textureSampleLevel(srcTex, samp, uv - vec2f(ts.x, 0.0), 0.0).rgb;
  let n2 = textureSampleLevel(srcTex, samp, uv + vec2f(0.0, ts.y), 0.0).rgb;
  let n3 = textureSampleLevel(srcTex, samp, uv - vec2f(0.0, ts.y), 0.0).rgb;
  let lo = min(min(min(n0, n1), min(n2, n3)), c);
  let hi = max(max(max(n0, n1), max(n2, n3)), c);
  // focus: whatever the lens is on stays crisp (and is sharpened harder); nearer and further things soften with
  // their distance from it. u.reg2.z is the focus distance the page asks for (the story's scene), 0 for the
  // centre of the view; u.reg2.w switches the effect on.
  let dep = min(textureSampleLevel(srcTex, samp, uv, 0.0).a, 1200.0);
  var coc = 0.0;
  if (u.reg2.w > 0.01) {
    var fd = u.reg2.z;
    if (fd <= 0.0) {
      let cd = vec4f(textureSampleLevel(srcTex, samp, vec2f(0.5, 0.5), 0.0).a, textureSampleLevel(srcTex, samp, vec2f(0.46, 0.5), 0.0).a,
        textureSampleLevel(srcTex, samp, vec2f(0.54, 0.5), 0.0).a, textureSampleLevel(srcTex, samp, vec2f(0.5, 0.55), 0.0).a);
      fd = clamp(min(min(cd.x, cd.y), min(cd.z, cd.w)), 3.0, 900.0);
    }
    coc = clamp(abs(1.0 / max(dep, 0.3) - 1.0 / fd) * fd * 0.75 - 0.12, 0.0, 1.0) * u.reg2.w;
  }
  c = clamp(c + (c - (n0 + n1 + n2 + n3) * 0.25) * (0.3 + 0.5 * (1.0 - coc)), lo, hi);
  if (coc > 0.02) {
    let rad = coc * 3.2 * (u.outRes.y / 720.0) / u.outRes;
    var acc = c;
    var wsum = 1.0;
    for (var k = 0; k < 8; k++) {
      let a = f32(k) * 2.3998 + 0.5;
      let rr = sqrt((f32(k) + 0.5) / 8.0);
      let tuv = uv + vec2f(cos(a), sin(a)) * rr * rad;
      let tap = textureSampleLevel(srcTex, samp, tuv, 0.0);
      // a sharp foreground must not bleed over a soft background
      let w = select(1.0, 0.15, tap.a < dep * 0.7);
      acc += tap.rgb * w;
      wsum += w;
    }
    c = mix(c, acc / wsum, smoothstep(0.0, 0.6, coc));
  }
  // warm halation around lights
  c += textureSampleLevel(bloomTex, samp, uv, 0.0).rgb * vec3f(0.36, 0.3, 0.24);
  c = aces(c * 1.05);
  c = pow(c, vec3f(1.0 / 2.2));
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.28);
  c = mix(vec3f(luma(c)), c, 1.2);
  // 1970s paperback cover grading: faded blacks, violet-teal shadows, peach highlights
  let lum = luma(c);
  c = mix(c, c * vec3f(0.82, 0.95, 1.08) + vec3f(0.015, 0.03, 0.045), 1.0 - smoothstep(0.0, 0.45, lum));
  c = mix(c, c * vec3f(1.08, 0.98, 0.86), smoothstep(0.45, 1.0, lum));
  c = c * 0.93 + vec3f(0.035, 0.03, 0.045);
  // methane snowfall: flakes in the world (see snowLayer), drawn after anti-aliasing
  if (u.p8 > 0.0) {
    let sv = vec2f((2.0 * fc.x - u.outRes.x) / u.outRes.y, (u.outRes.y - 2.0 * fc.y) / u.outRes.y);
    let rdr = normalize(u.camFwd + (sv.x * u.camRight + sv.y * u.camUp) * u.fov);
    // camera travel this frame: each flake is drawn along it, so fast flight streaks the near snow
    var mv = select(vec3f(0.0), u.camPos - u.prevPos, u.histValid > 0.5);
    if (length(mv) > 20.0) { mv = vec3f(0.0); }
    let pw = 2.0 * u.fov / u.outRes.y;
    let dens = clamp(u.p8, 0.0, 1.0);
    // four nested grids: flakes by the lens (0.6 m cells, to 4 m), near (1.3 m, to 12 m), middle (5 m, to 50 m) and
    // far specks (16 m, to 200 m); a ray crosses about 1.7 cells per cell size it travels, which sets each loop
    var tr = snowLayer(u.camPos, rdr, dep, 0.6, 4.0, 0.025, 0.5 * dens, 0.9, 3, mv, pw, 12);
    tr *= snowLayer(u.camPos, rdr, dep, 1.3, 12.0, 0.045, 0.8 * dens, 1.0, 0, mv, pw, 16);
    tr *= snowLayer(u.camPos, rdr, dep, 5.0, 50.0, 0.12, 0.9 * dens, 1.25, 1, mv, pw, 17);
    tr *= snowLayer(u.camPos, rdr, dep, 16.0, 200.0, 0.35, 0.9 * dens, 1.5, 2, mv, pw, 21);
    let lit = mix(vec3f(0.55, 0.52, 0.5), vec3f(0.97, 0.92, 0.84), clamp(luma(u.skyHor) * 2.2, 0.35, 1.0));
    c = mix(c, lit, 1.0 - tr);
  }
  let q = uv;
  c *= 0.74 + 0.26 * pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.2);
  // fixed paper grain, then per-frame dither
  let pg = pnoise(fc.xy * 0.9, 120) * 0.6 + pnoise(fc.xy * 0.23, 121) * 0.4;
  c *= 0.975 + 0.05 * pg;
  c += (hsh(i32(fc.x), i32(fc.y), i32(u.frame)) - 0.5) / 255.0;
  return vec4f(clamp(c, vec3f(0.0), vec3f(1.0)), 1.0);
}
