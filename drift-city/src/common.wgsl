struct U {
  res: vec2f, time: f32, refl: f32,
  camPos: vec3f, fov: f32,
  camFwd: vec3f, frame: f32,
  camRight: vec3f, histValid: f32,
  camUp: vec3f, p3: f32,
  sunDir: vec3f, p4: f32,
  sunCol: vec3f, windows: f32,
  skyTop: vec3f, stars: f32,
  skyHor: vec3f, p5: f32,
  fogCol: vec3f, fogDen: f32,
  jitter: vec2f, outRes: vec2f,
  prevPos: vec3f, p6: f32,
  prevFwd: vec3f, p7: f32,
  prevRight: vec3f, p8: f32,
  prevUp: vec3f, p9: f32,
  reg: vec4f, reg2: vec4f,
};
@group(0) @binding(0) var<uniform> u: U;

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var pts = array<vec2f, 3>(vec2f(-1.0, -3.0), vec2f(-1.0, 1.0), vec2f(3.0, 1.0));
  return vec4f(pts[i], 0.0, 1.0);
}

fn hsh(x: i32, y: i32, k: i32) -> f32 {
  var h: u32 = bitcast<u32>(x) * 374761393u + bitcast<u32>(y) * 668265263u + bitcast<u32>(k) * 1442695041u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return f32(h & 0xffffffu) / 16777216.0;
}

fn luma(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }
