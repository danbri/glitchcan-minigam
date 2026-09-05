// layers.js — concrete source nodes for lib/layer-compositor.js. Each is a
// small wrapper exposing the one-method `render(time) -> CanvasImageSource`
// contract (see layer-compositor.js's header) around a different rendering
// technology, so any mix of them can sit in the same compositor graph.
// See lib/three-layer.js for the three.js node (kept separate since it
// pulls in the vendored three.js module).
import { createSplatRenderer } from './splat-renderer-auto.js';

// Wraps the existing splat renderer (WebGPU/WebGL2 auto-selected) on its
// OWN offscreen canvas, with `alpha: true` so it composites over whatever
// is behind it instead of painting an opaque background.
//   setup(renderer)          — runs once: load avatars, build a scene
//   update(time, renderer)   — runs every frame, before render(): pose/animate
export async function createSplatLayer({ width, height, setup, update }) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const renderer = await createSplatRenderer(canvas, { alpha: true });
  if (setup) await setup(renderer);
  return {
    canvas, renderer,
    render(time) {
      if (update) update(time, renderer);
      renderer.render();
      return canvas;
    },
  };
}

// Live camera feed. A <video> element is itself a valid drawImage() source,
// so render() just returns it directly — no per-frame canvas copy.
export async function createWebcamLayer({ facingMode = 'user' } = {}) {
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true;
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
  video.srcObject = stream;
  await video.play();
  return {
    video, stream,
    render() { return video; },
    stop() { stream.getTracks().forEach((t) => t.stop()); },
  };
}

// A local/remote media file — video or still image, autodetected by
// extension. `ready` resolves once the first frame/image is decoded, so
// callers can await it before wiring the node into a running graph.
export function createMediaLayer(url) {
  const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
  const el = document.createElement(isVideo ? 'video' : 'img');
  if (isVideo) { el.muted = true; el.loop = true; el.playsInline = true; el.autoplay = true; }
  const ready = new Promise((resolve) => {
    el.addEventListener(isVideo ? 'canplay' : 'load', () => resolve(), { once: true });
  });
  el.src = url;
  return { el, ready, render() { return el; } };
}

// ------------------------------------------------------------- SDF layer
// A minimal self-contained raymarcher — no dependency on Lucid, so this
// compositor works standalone. `sceneGLSL` is just the `map(p)` distance
// function body, so a real Lucid-generated GLSL scene (see
// lucid/skills/lucid-scene-authoring) can be dropped in verbatim later;
// this default sphere-over-plane scene exists so the layer does something
// visible out of the box.
const SDF_VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const SDF_FS_HEAD = `#version 300 es
precision highp float;
uniform float uTime; uniform vec2 uRes;
out vec4 fragColor;
float sdSphere(vec3 p, float r){ return length(p) - r; }
float sdPlane(vec3 p){ return p.y + 1.0; }
`;
export const SDF_DEFAULT_SCENE = `
float map(vec3 p){
  float sphere = sdSphere(p - vec3(sin(uTime * 0.7) * 0.6, 0.0, 0.0), 0.5);
  return min(sphere, sdPlane(p));
}`;
const SDF_FS_TAIL = `
vec3 normalAt(vec3 p){
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)));
}
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ro = vec3(0.0, 0.3, 3.0), rd = normalize(vec3(uv, -1.5));
  float t = 0.0; vec3 col = vec3(0.0); bool hit = false;
  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.001) {
      vec3 n = normalAt(p);
      float l = max(0.15, dot(n, normalize(vec3(0.5, 0.8, 0.3))));
      col = vec3(0.55, 0.72, 0.95) * l;
      hit = true;
      break;
    }
    t += d;
    if (t > 20.0) break;
  }
  // transparent miss so this composites cleanly as a background layer —
  // no ray hit means "show whatever's behind this layer", not black.
  fragColor = vec4(col, hit ? 1.0 : 0.0);
}`;

export function createSDFLayer({ width, height, sceneGLSL = SDF_DEFAULT_SCENE } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true });
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, SDF_VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, SDF_FS_HEAD + sceneGLSL + SDF_FS_TAIL));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  // one big triangle covering the viewport — no shared-edge seam like a two-triangle quad
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  const uTime = gl.getUniformLocation(prog, 'uTime'), uRes = gl.getUniformLocation(prog, 'uRes');
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return {
    canvas,
    render(time) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(uTime, time);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return canvas;
    },
  };
}
