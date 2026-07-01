// Glittering cloud-burst effect (Sonic-ring style): when the plane flies
// through a cloud cluster it pops in a shower of expanding rings and
// twinkling stars. A small pooled set of sprites is recycled, so bursts are
// allocation-free after startup and cheap on a phone.

import * as THREE from '../vendor/three.module.min.js';

function ringTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.translate(64, 64);
  // a soft glowing ring (annulus) via a stroked circle with blur-ish gradient
  const grad = ctx.createRadialGradient(0, 0, 40, 0, 0, 60);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.95)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 60, 0, Math.PI * 2);
  ctx.arc(0, 0, 34, 0, Math.PI * 2, true);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

function starTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.translate(64, 64);
  // four-point sparkle: two crossed soft diamonds + a bright core
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 24);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  const spike = (len, w) => { ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(w, 0); ctx.lineTo(0, len); ctx.lineTo(-w, 0); ctx.closePath(); ctx.fill(); };
  spike(58, 10);
  ctx.rotate(Math.PI / 2);
  spike(58, 10);
  return new THREE.CanvasTexture(c);
}

const SPARKLE_COLORS = [0xffffff, 0xfff3a0, 0x9fe4ff, 0xffc0e6, 0xc6ffcf];

export function createParticles(scene) {
  const group = new THREE.Group();
  group.renderOrder = 5;
  scene.add(group);

  const ringTex = ringTexture();
  const starTex = starTexture();
  const pool = [];
  const POOL_RINGS = 30;
  const POOL_STARS = 90;

  function makeSprite(tex, kind) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const s = new THREE.Sprite(mat);
    s.visible = false;
    s.userData = { kind, life: 0, maxLife: 1, vel: new THREE.Vector3(), spin: 0 };
    group.add(s);
    pool.push(s);
    return s;
  }
  for (let i = 0; i < POOL_RINGS; i++) makeSprite(ringTex, 'ring');
  for (let i = 0; i < POOL_STARS; i++) makeSprite(starTex, 'star');

  function grab(kind) {
    for (const s of pool) if (!s.visible && s.userData.kind === kind) return s;
    return null; // pool exhausted — skip (bursts are brief, this is rare)
  }

  function burst(center, scaleHint = 1) {
    // Expanding rings.
    const rings = 3;
    for (let i = 0; i < rings; i++) {
      const s = grab('ring');
      if (!s) break;
      s.visible = true;
      s.position.copy(center);
      const col = new THREE.Color(SPARKLE_COLORS[(i + 1) % SPARKLE_COLORS.length]);
      s.material.color.copy(col);
      s.material.opacity = 0.9;
      const base = (14 + i * 8) * scaleHint;
      s.scale.setScalar(base * 0.4);
      s.userData.life = 0;
      s.userData.maxLife = 0.7 + i * 0.12;
      s.userData.grow = base * 3.4;
      s.userData.startScale = base * 0.4;
      s.userData.vel.set(0, 0, 0);
      s.userData.spin = 0;
    }
    // Twinkling stars flung outward.
    const stars = 16;
    for (let i = 0; i < stars; i++) {
      const s = grab('star');
      if (!s) break;
      s.visible = true;
      s.position.copy(center);
      s.material.color.set(SPARKLE_COLORS[Math.floor((i * 2654435761) % SPARKLE_COLORS.length)]);
      s.material.opacity = 1;
      const sc = (6 + (i % 4) * 2) * scaleHint;
      s.scale.setScalar(sc);
      const theta = (i / stars) * Math.PI * 2 + (i % 3);
      const phi = ((i * 97) % 100) / 100 * Math.PI - Math.PI / 2;
      const speed = (55 + (i % 5) * 18) * scaleHint;
      s.userData.vel.set(
        Math.cos(theta) * Math.cos(phi) * speed,
        (0.4 + Math.abs(Math.sin(phi))) * speed,
        Math.sin(theta) * Math.cos(phi) * speed,
      );
      s.userData.life = 0;
      s.userData.maxLife = 0.85 + (i % 4) * 0.12;
      s.userData.startScale = sc;
      s.userData.grow = 0;
      s.userData.spin = 0;
    }
  }

  function update(dt) {
    for (const s of pool) {
      if (!s.visible) continue;
      const u = s.userData;
      u.life += dt;
      const p = u.life / u.maxLife;
      if (p >= 1) { s.visible = false; s.material.opacity = 0; continue; }
      if (u.kind === 'ring') {
        s.scale.setScalar(u.startScale + u.grow * p);
        s.material.opacity = 0.9 * (1 - p) * (1 - p);
      } else {
        s.position.addScaledVector(u.vel, dt);
        u.vel.y -= 60 * dt; // gentle gravity so stars arc and rain down
        u.vel.multiplyScalar(Math.pow(0.5, dt)); // air drag
        s.material.opacity = Math.min(1, 2.2 * (1 - p));
        const twinkle = 0.8 + 0.4 * Math.sin(u.life * 30 + s.id);
        s.scale.setScalar(u.startScale * (0.7 + 0.5 * (1 - p)) * twinkle);
      }
    }
  }

  return { burst, update, group };
}
