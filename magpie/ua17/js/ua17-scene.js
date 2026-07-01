// Renderer, camera, lights and the drag-to-look chase camera.
//
// All pointer/touch/wheel handling here is deliberately defensive: this runs
// full-bleed on a phone in a toddler's hands, so a drag must ONLY orbit the
// camera — it must never let the browser pinch-zoom, pull-to-refresh,
// double-tap-zoom or scroll/reload the page.

import * as THREE from '../vendor/three.module.min.js';

export function createScene(canvas) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 20000);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // NOTE: tone mapping is applied MANUALLY in the tilt-shift composite pass
  // below (Approach: render the lit scene to a *linear* target untouched, blur
  // it, then tone-map + sRGB-encode once at the very end). Leaving the
  // renderer's own tone mapping on would apply ACES a second time when the
  // fullscreen quad is drawn to screen, which is what darkened the whole image.
  renderer.toneMapping = THREE.NoToneMapping;
  const TONE_EXPOSURE = 1.05;

  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x5a6b58, 0.75);
  scene.add(hemi);
  // Warm key light aligned with the sun sprite direction, strong enough to
  // model form (buildings, terrain relief) with clear light/shadow sides.
  const sun = new THREE.DirectionalLight(0xfff1cf, 2.6);
  sun.position.set(-3200, 5200, -5200);
  scene.add(sun);
  const fill = new THREE.AmbientLight(0x0e1b2a, 0.35); // cool, low — keeps contrast
  scene.add(fill);

  // --- Tilt-shift post-processing (the "toytown" miniature look) ---
  // The scene is rendered to a target, then a fullscreen pass blurs it by
  // vertical distance from a sharp focus band — the classic tilt-shift effect
  // that makes a toy-scale world read as a deliberate, premium miniature
  // rather than "small because it's cheap".
  // Linear HDR target: the scene is rendered here with NO tone mapping and NO
  // colour-space encoding, so the composite pass can blur in linear light and
  // apply ACES + sRGB exactly once.
  const rt = new THREE.WebGLRenderTarget(2, 2, { samples: 4 });
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tiltMat = new THREE.ShaderMaterial({
    // Raw ShaderMaterial output is written straight to the default framebuffer
    // (three does not auto tone-map or auto-encode ShaderMaterial), so we do
    // both by hand here — exactly once.
    toneMapped: false,
    uniforms: {
      tDiffuse: { value: rt.texture },
      resolution: { value: new THREE.Vector2(2, 2) },
      focusCenter: { value: 0.56 },
      focusWidth: { value: 0.13 },
      maxBlur: { value: 3.4 },
      exposure: { value: TONE_EXPOSURE },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 resolution;
      uniform float focusCenter, focusWidth, maxBlur, exposure;
      varying vec2 vUv;
      // three.js ACESFilmicToneMapping, matched so removing the renderer's own
      // tone mapping doesn't change the look — only the darkening bug goes away.
      vec3 RRTAndODTFit(vec3 v){ vec3 a = v*(v+0.0245786)-0.000090537; vec3 b = v*(0.983729*v+0.4329510)+0.238081; return a/b; }
      vec3 ACESFilmic(vec3 color){
        const mat3 ACESInput = mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777);
        const mat3 ACESOutput = mat3(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602);
        color = ACESInput * color;
        color = RRTAndODTFit(color);
        color = ACESOutput * color;
        return clamp(color, 0.0, 1.0);
      }
      vec3 lin2srgb(vec3 c){ return mix(1.055*pow(max(c,0.0),vec3(0.41666))-0.055, c*12.92, step(c,vec3(0.0031308))); }
      void main() {
        float d = abs(vUv.y - focusCenter);
        float b = clamp((d - focusWidth) / (0.5 - focusWidth), 0.0, 1.0);
        b = pow(b, 1.4) * maxBlur;               // sharp band -> progressively blurred edges
        vec2 px = b / resolution;
        vec3 col = vec3(0.0);
        for (int i = 0; i < 16; i++) {
          float a = float(i) * 0.3926991;        // 22.5° steps, ~2 rings
          float r = 0.45 + 0.55 * step(8.0, float(i));
          col += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r * px).rgb;
        }
        col /= 16.0;                              // blur in linear light
        col = ACESFilmic(col * exposure);         // tone-map once
        gl_FragColor = vec4(lin2srgb(col), 1.0);  // encode to sRGB once
      }`,
    depthTest: false,
    depthWrite: false,
  });
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), tiltMat));

  function renderFrame(scn, cam) {
    renderer.setRenderTarget(rt);
    renderer.render(scn, cam);
    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCam);
  }

  function resize() {
    const parent = canvas.parentElement;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    renderer.setSize(w, h, false);
    const pr = renderer.getPixelRatio();
    rt.setSize(Math.max(2, Math.floor(w * pr)), Math.max(2, Math.floor(h * pr)));
    tiltMat.uniforms.resolution.value.set(w * pr, h * pr);
    const aspect = w / Math.max(1, h);
    camera.aspect = aspect;
    // A fixed vertical FOV gives a very narrow, "zoomed in" horizontal view on
    // tall phone screens. Widen the vertical FOV as the screen gets narrower
    // so the horizontal field of view (and how much sky/scene is visible)
    // stays generous on portrait phones, without over-widening on desktop.
    camera.fov = aspect < 1 ? THREE.MathUtils.lerp(85, 60, THREE.MathUtils.clamp(aspect, 0, 1)) : 55;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // --- Drag-to-orbit chase camera (pointer events, page-gesture-safe) ---
  //
  // Design goals after playtest feedback ("lurching is bad, make it chill"):
  //  • The orbit frame is LEVEL (built from world-up + the plane's *horizontal*
  //    heading), never from the plane's banked/pitched body axes — so the
  //    horizon stays put and banking the plane doesn't roll the whole view.
  //  • The heading the camera follows is heavily smoothed, so small path
  //    wiggles don't swing the camera.
  //  • Drag maps intuitively: drag right → look right. Gentle speed, strong
  //    damping, and NO idle auto-drift (auto-motion reads as un-chill).
  const orbit = { yaw: 0, pitch: 0.22, distance: 110 };
  const velocity = { yaw: 0, pitch: 0 };
  let dragging = false;
  const last = { x: 0, y: 0 };

  // Auto-framing: the app can request the camera gently aim toward a point of
  // interest (a city) via setAutoFrame(yaw). It only takes effect when the
  // user hasn't touched the view recently, so dragging always wins.
  let autoYaw = null;
  let lastInteract = -1e9;
  function nowMs() { return (typeof performance !== 'undefined' ? performance.now() : 0); }
  function setAutoFrame(yaw) { autoYaw = yaw; }

  canvas.style.touchAction = 'none';

  const DRAG_SPEED = 0.0038;

  function onPointerDown(e) {
    dragging = true;
    lastInteract = nowMs();
    last.x = e.clientX;
    last.y = e.clientY;
    velocity.yaw = 0;
    velocity.pitch = 0;
    canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (!dragging) return;
    lastInteract = nowMs();
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last.x = e.clientX;
    last.y = e.clientY;
    // drag right → view swings right; drag down → look down toward the plane.
    orbit.yaw += dx * DRAG_SPEED;
    orbit.pitch = THREE.MathUtils.clamp(orbit.pitch - dy * DRAG_SPEED, -0.05, 0.75);
    velocity.yaw = dx * DRAG_SPEED;
    velocity.pitch = -dy * DRAG_SPEED;
    e.preventDefault();
  }
  function onPointerUp(e) {
    dragging = false;
    canvas.releasePointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  canvas.addEventListener('pointermove', onPointerMove, { passive: false });
  canvas.addEventListener('pointerup', onPointerUp, { passive: false });
  canvas.addEventListener('pointercancel', onPointerUp, { passive: false });
  canvas.addEventListener('pointerleave', onPointerUp, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('gesturestart', (e) => e.preventDefault());
  canvas.addEventListener('gesturechange', (e) => e.preventDefault());
  canvas.addEventListener('dblclick', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

  const tmpFwd = new THREE.Vector3();
  const tmpRight = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const basis = new THREE.Matrix4();
  const localOffset = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const lookTarget = new THREE.Vector3(0, 0, 1);
  const smoothedHeading = new THREE.Vector3(0, 0, 1); // horizontal, heavily damped

  function updateCamera(aircraftPos, tangent, dt) {
    // Coast the released-drag momentum, with strong damping so it settles
    // quickly and calmly (no long spins). No idle auto-drift.
    if (!dragging && (velocity.yaw !== 0 || velocity.pitch !== 0)) {
      orbit.yaw += velocity.yaw;
      orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + velocity.pitch, -0.05, 0.75);
      const damp = Math.pow(0.86, dt * 60);
      velocity.yaw *= damp;
      velocity.pitch *= damp;
      if (Math.abs(velocity.yaw) < 0.00004) velocity.yaw = 0;
      if (Math.abs(velocity.pitch) < 0.00004) velocity.pitch = 0;
    }

    // Auto-frame toward a city when the user has been hands-off for a moment,
    // so the skyline swings into view during climb-out/approach on its own.
    if (!dragging && velocity.yaw === 0 && autoYaw !== null && (nowMs() - lastInteract) > 2500) {
      orbit.yaw += (autoYaw - orbit.yaw) * (1 - Math.pow(0.06, dt));
    }

    // Follow only the HORIZONTAL heading, smoothed hard — climb/descent pitch
    // and path wiggles never tilt or swing the frame.
    tmpFwd.set(tangent.x, 0, tangent.z);
    if (tmpFwd.lengthSq() < 1e-6) tmpFwd.set(0, 0, 1);
    tmpFwd.normalize();
    smoothedHeading.lerp(tmpFwd, 1 - Math.pow(0.05, dt)); // ~slow catch-up
    smoothedHeading.y = 0;
    if (smoothedHeading.lengthSq() < 1e-6) smoothedHeading.set(0, 0, 1);
    smoothedHeading.normalize();

    // Level orbit basis: right = up × forward, up = world up (no roll ever).
    tmpRight.crossVectors(worldUp, smoothedHeading).normalize();
    if (tmpRight.lengthSq() < 1e-6) tmpRight.set(1, 0, 0);
    basis.makeBasis(tmpRight, worldUp, smoothedHeading);

    const dist = orbit.distance;
    localOffset.set(
      dist * Math.sin(orbit.yaw) * Math.cos(orbit.pitch),
      dist * Math.sin(orbit.pitch) + 12,
      -dist * Math.cos(orbit.yaw) * Math.cos(orbit.pitch),
    );
    localOffset.applyMatrix4(basis);

    camPos.copy(aircraftPos).add(localOffset);
    // Gentle position follow — smooth, never snappy.
    camera.position.lerp(camPos, 1 - Math.pow(0.03, dt));

    // Look a little ahead of and above the plane, also smoothed.
    tmpFwd.copy(aircraftPos).addScaledVector(smoothedHeading, 8);
    tmpFwd.y += 4;
    lookTarget.lerp(tmpFwd, 1 - Math.pow(0.02, dt));
    camera.lookAt(lookTarget);
  }

  // Kept for API compatibility with the app bootstrap; idle auto-drift was
  // removed (it read as un-chill), so this is now a no-op.
  function resumeIdleDriftAfter() {}

  // Debug/testing: nudge the look-around orbit directly.
  function setOrbit(o) {
    if (o.yaw != null) orbit.yaw = o.yaw;
    if (o.pitch != null) orbit.pitch = THREE.MathUtils.clamp(o.pitch, -0.05, 0.75);
    if (o.distance != null) orbit.distance = o.distance;
  }

  return { scene, camera, renderer, renderFrame, updateCamera, resize, resumeIdleDriftAfter, setOrbit, setAutoFrame };
}
