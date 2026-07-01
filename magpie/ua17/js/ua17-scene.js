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
  const orbit = { yaw: 0, pitch: 0.2, distance: 105, height: 0 };
  const velocity = { yaw: 0, pitch: 0 };
  let dragging = false;
  let last = { x: 0, y: 0 };
  let idleDrift = true;

  canvas.style.touchAction = 'none';

  function onPointerDown(e) {
    dragging = true;
    idleDrift = false;
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
    const s = 0.006;
    orbit.yaw -= dx * s;
    orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + dy * s, -0.05, 0.6);
    velocity.yaw = -dx * s;
    velocity.pitch = dy * s;
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
  const tmpUp = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const basis = new THREE.Matrix4();
  const localOffset = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();

  function updateCamera(aircraftPos, tangent, dt) {
    if (!dragging) {
      if (velocity.yaw !== 0 || velocity.pitch !== 0) {
        orbit.yaw += velocity.yaw;
        orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + velocity.pitch, -0.05, 0.6);
        velocity.yaw *= 0.92;
        velocity.pitch *= 0.92;
        if (Math.abs(velocity.yaw) < 0.00005) velocity.yaw = 0;
        if (Math.abs(velocity.pitch) < 0.00005) velocity.pitch = 0;
      } else if (idleDrift) {
        orbit.yaw += dt * 0.03; // gentle ambient orbit so the view stays alive if nobody touches it
      }
    }

    tmpFwd.copy(tangent).normalize();
    tmpRight.crossVectors(worldUp, tmpFwd).normalize();
    if (tmpRight.lengthSq() < 1e-6) tmpRight.set(1, 0, 0);
    tmpUp.crossVectors(tmpFwd, tmpRight).normalize();
    basis.makeBasis(tmpRight, tmpUp, tmpFwd);

    const dist = orbit.distance;
    localOffset.set(
      dist * Math.sin(orbit.yaw) * Math.cos(orbit.pitch),
      dist * Math.sin(orbit.pitch) + 8,
      -dist * Math.cos(orbit.yaw) * Math.cos(orbit.pitch),
    );
    localOffset.applyMatrix4(basis);

    camPos.copy(aircraftPos).add(localOffset);
    camera.position.lerp(camPos, 1 - Math.pow(0.001, dt));

    lookTarget.copy(aircraftPos).addScaledVector(tmpFwd, 6);
    const currentLook = lookTarget.clone();
    camera.lookAt(currentLook);
  }

  function resumeIdleDriftAfter(seconds) {
    setTimeout(() => { idleDrift = true; }, seconds * 1000);
  }

  return { scene, camera, renderer, updateCamera, resize, resumeIdleDriftAfter };
}
