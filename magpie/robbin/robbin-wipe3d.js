/*
  The flock screen-wipe: up to fifty cut-paper birds in 3D sweep across
  the screen, huge and close, hiding the old screen — the swap happens
  at peak cover, then the stragglers clear to reveal the new one.

  Cheap by construction:
  - three.js (687 KB vendored) and the bird factory are DYNAMICALLY
    imported by preload(), kicked off idly after boot — pressing PLAY
    before they arrive just skips the wipe (run() returns false and the
    caller transitions instantly). No game code waits on the library.
  - One transparent WebGL canvas is made once and kept (display:none
    between runs); birds are built once and re-choreographed per run.
  - The factory shares textures/materials/geometry across all birds.
  - Honors prefers-reduced-motion by not running at all.
  - Time-based choreography: on a slow GPU the wipe drops frames but
    still takes the same wall-clock beat, and onCovered still fires.
*/
export class FlockWipe {
  constructor() {
    this.active = false;
    this.failed = false;
    this.dir = 1;
  }
  preload() {
    if (this.THREE) return Promise.resolve(true);
    if (this.failed) return Promise.resolve(false);
    if (this.loadingP) return this.loadingP;
    this.loadingP = (async () => {
      try {
        this.THREE = await import('./vendor/three.module.min.js');
        this.birdMod = await import('./robbin-birds3d.js');
        return true;
      } catch {
        this.failed = true;
        return false;
      }
    })();
    return this.loadingP;
  }
  ensureStage() {
    if (this.renderer) return true;
    const THREE = this.THREE;
    try {
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' });
    } catch {
      this.failed = true;
      return false;
    }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    const el = this.renderer.domElement;
    el.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:30;pointer-events:none;display:none;';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    this.scene = new THREE.Scene();                  // transparent: the page shows through
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.02, 100);
    this.camera.position.set(0, 0, 6);
    this.scene.add(new THREE.HemisphereLight(0xfff5dd, 0x3a342c, 2.5));
    const key = new THREE.DirectionalLight(0xffe8c4, 2.4);
    key.position.set(-4, 7, 5);
    this.scene.add(key);
    this.factory = this.birdMod.makeBirdFactory(THREE, this.renderer);
    this.cast = [];
    return true;
  }
  /*
    Sweep the flock across. onCovered fires once at peak cover (put the
    new screen up then); onDone when the last bird has left. Returns
    false when the wipe can't or shouldn't run — the caller must then
    transition directly.
  */
  run({ count, onCovered, onDone } = {}) {
    if (this.active || this.failed || !this.THREE) return false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (!this.ensureStage()) return false;
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // scale the cast to the screen, capped at fifty
    const n = count ?? Math.round(Math.min(50, 16 + (w * h) / 24000));
    const species = ['robin', 'bluetit'];
    while (this.cast.length < n) {
      this.cast.push(this.factory.createBird(species[this.cast.length % 2], 1));
    }
    const dir = this.dir;                        // alternate sweeps
    this.dir = -this.dir;
    const tanV = Math.tan((this.camera.fov * Math.PI) / 360);
    const DUR = 1.05, LEAD = 0.65;               // per-bird crossing, spawn spread
    const flock = [];
    for (let i = 0; i < n; i++) {
      const bird = this.cast[i];
      const z = 0.6 + ((i * 7) % n) / n * 3.9;   // depth: close birds arrive HUGE
      const dist = this.camera.position.z - z;
      const halfH = tanV * dist;
      const halfW = halfH * this.camera.aspect;
      const s = 0.55 + Math.random() * 0.5 + (4.5 - z) * 0.1;
      const y = (Math.random() * 2 - 1) * (halfH + 0.2);
      const x0 = -dir * (halfW + s * 1.6);
      bird.position.set(x0, y, z);
      bird.scale.setScalar(s);
      bird.rotation.y = dir > 0 ? 0 : Math.PI;   // paper flips to face its heading
      bird.visible = false;
      if (!bird.parent) this.scene.add(bird);
      flock.push({
        bird,
        x0, x1: -x0,
        y,
        start: (i / n) * LEAD + Math.random() * 0.12,
        dur: DUR * (0.85 + Math.random() * 0.35),
        flap: 9 + Math.random() * 4,
        ph: Math.random() * 10,
      });
    }
    for (let i = n; i < this.cast.length; i++) this.cast[i].visible = false;
    const total = LEAD + DUR * 1.25;
    const coverAt = LEAD * 0.55 + DUR * 0.45;    // the thick of the flock
    this.active = true;
    this.renderer.domElement.style.display = 'block';
    const t0 = performance.now() / 1000;
    let covered = false;
    const tick = () => {
      const t = performance.now() / 1000 - t0;
      for (const f of flock) {
        const u = (t - f.start) / f.dur;
        f.bird.visible = u > 0 && u < 1.02;
        if (!f.bird.visible) continue;
        f.bird.position.x = f.x0 + (f.x1 - f.x0) * u;
        f.bird.position.y = f.y + Math.sin(t * 2.3 + f.ph) * 0.14;
        const parts = f.bird.userData.parts;
        const phase = t * f.flap + f.ph;
        parts.wing.rotation.x = -0.22 + Math.sin(phase) * 1.05;
        parts.tail.rotation.z = -0.11 + Math.sin(phase * 0.45 - 0.8) * 0.09;
        parts.head.rotation.z = -Math.sin(phase - 1.1) * 0.04;
        f.bird.rotation.z = (dir > 0 ? 1 : -1) * Math.sin(t * 1.8 + f.ph) * 0.06;
      }
      if (!covered && t >= coverAt) {
        covered = true;
        try { onCovered?.(); } catch { /* the show goes on */ }
      }
      this.renderer.render(this.scene, this.camera);
      if (t < total) {
        this.raf = requestAnimationFrame(tick);
      } else {
        this.active = false;
        this.renderer.domElement.style.display = 'none';
        if (!covered) { covered = true; try { onCovered?.(); } catch { /* */ } }
        try { onDone?.(); } catch { /* */ }
      }
    };
    this.raf = requestAnimationFrame(tick);
    return true;
  }
}
