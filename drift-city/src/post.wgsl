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
  // methane snowfall in the dense air, six layers deep: big soft flakes drifting past the lens, then clumps and
  // single flakes of every size, tumbling as they fall, down to far specks. Drawn after anti-aliasing.
  if (u.p8 > 0.0) {
    let sv = vec2f((2.0 * fc.x - u.outRes.x) / u.outRes.y, (u.outRes.y - 2.0 * fc.y) / u.outRes.y);
    let rdr = normalize(u.camFwd + (sv.x * u.camRight + sv.y * u.camUp) * u.fov);
    let ang = atan2(rdr.z, rdr.x) / 6.2831853;
    var snow = 0.0;
    // at speed the near flakes streak: sideways with the drone's sideways motion, outward from the centre with its
    // forward motion (camera travel this frame, in screen units)
    let vel = select(vec3f(0.0), u.camPos - u.prevPos, u.histValid > 0.5);
    let stv = vec2f(dot(vel, u.camRight), dot(vel, u.camUp)) / u.fov + sv * dot(vel, u.camFwd) * 0.35;
    let sl = length(stv);
    let sdir = select(vec2f(0.0, 1.0), stv / max(sl, 1e-5), sl > 1e-5);
    for (var l = 0; l < 6; l++) {
      let fl = f32(l);
      let sc = vec2f(24.0 + 34.0 * fl, 4.0 + 6.0 * fl);
      let k = 4.0 * sc.y / sc.x;
      let gust = 0.25 * sin(u.time * 0.21 + fl) * sin(u.time * 0.13 + 1.3);
      let g0 = vec2f(ang, rdr.y) * sc + vec2f(0.4 * sin(u.time * (0.3 + 0.05 * fl) + fl * 1.7 + rdr.y * 5.0) + gust * sc.x * 0.02, u.time * (0.32 + 0.17 * fl));
      let ci = vec2i(floor(g0));
      let f = fract(g0);
      if (hsh(ci.x, ci.y, 111 + l) < 0.22 + 0.05 * fl) {
        let h1 = hsh(ci.x, ci.y, 120 + l);
        let h2 = hsh(ci.x, ci.y, 130 + l);
        let h3 = hsh(ci.x, ci.y, 140 + l);
        let cp = vec2f(h1, h2) * 0.6 + 0.2;
        // and shorter than the cell it is drawn in, or it is cut off square
        let r = (0.17 - 0.02 * fl) * (0.45 + 0.9 * h3) / (1.0 + 0.35 * clamp(sl * (3.0 - 0.45 * fl) * 6.0, 0.0, 2.5));
        // a tumbling flake: an ellipse that turns as it falls, sometimes a clump of two or three
        let tb = u.time * (0.6 + 1.4 * h1) + h2 * 6.28;
        let dv = f - cp;
        // stretch along the streak (more for the nearer layers), then tumble (less, the faster we go)
        let sk = clamp(sl * (3.0 - 0.45 * fl) * 6.0, 0.0, 2.5);
        let dc0 = dv * vec2f(k, 1.0);
        let al = dot(dc0, sdir);
        // a streak is thin: widen the distance across it, so the mark narrows as it lengthens
        let dc = (dc0 - sdir * al) * (1.0 + 0.8 * sk) + sdir * al / (1.0 + sk);
        let tbs = tb / (1.0 + sk);
        let dr = vec2f(dc.x * cos(tbs) - dc.y * sin(tbs), dc.x * sin(tbs) + dc.y * cos(tbs)) * vec2f(1.0, 1.0 + 0.9 * h2 / (1.0 + sk));
        var dd = length(dr);
        if (h3 > 0.45) { dd = min(dd, length(dr - vec2f(r * 0.55, r * 0.2)) * 1.15); }
        if (h3 > 0.8) { dd = min(dd, length(dr + vec2f(r * 0.3, r * 0.5)) * 1.3); }
        // the nearest layer is out of focus: bigger, softer, fainter
        let soft = select(0.3, 0.05, l == 0);
        // a streak spreads the same light over a longer mark, so it is fainter; and a flake is drawn only inside its
        // own cell, so fade it out before the cell's edge (unfaded, a long streak was cut off square into a rectangle)
        let ew = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
        let edge = mix(1.0, smoothstep(0.0, 0.3, ew), min(sk, 1.0));
        let a = select(1.0 - 0.13 * fl, 0.35, l == 0) * edge / (1.0 + 0.25 * sk);
        snow += (1.0 - smoothstep(r * soft, r, dd)) * a;
      }
    }
    c = mix(c, vec3f(0.97, 0.92, 0.84), clamp(snow * u.p8 * 0.7, 0.0, 0.85));
  }
  let q = uv;
  c *= 0.74 + 0.26 * pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.2);
  // fixed paper grain, then per-frame dither
  let pg = pnoise(fc.xy * 0.9, 120) * 0.6 + pnoise(fc.xy * 0.23, 121) * 0.4;
  c *= 0.975 + 0.05 * pg;
  c += (hsh(i32(fc.x), i32(fc.y), i32(u.frame)) - 0.5) / 255.0;
  return vec4f(clamp(c, vec3f(0.0), vec3f(1.0)), 1.0);
}
