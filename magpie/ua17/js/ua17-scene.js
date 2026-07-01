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

  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8fa6c9, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3d6, 1.3);
  sun.position.set(-400, 600, -200);
  scene.add(sun);
  const fill = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(fill);

  function resize() {
    const parent = canvas.parentElement;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    renderer.setSize(w, h, false);
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

  canvas.style.touchAction = 'none';

  const DRAG_SPEED = 0.0038;

  function onPointerDown(e) {
    dragging = true;
    last.x = e.clientX;
    last.y = e.clientY;
    velocity.yaw = 0;
    velocity.pitch = 0;
    canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (!dragging) return;
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

  return { scene, camera, renderer, updateCamera, resize, resumeIdleDriftAfter, setOrbit };
}
