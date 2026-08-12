/**
 * eclipse-explain.js — the two teaching pictures.
 *
 *  1. WhyDiagram   — why the Moon can hide the Sun at all.
 *  2. PinholeDemo  — what a pinhole makes on the ground, and why the
 *                    gaps between leaves make hundreds of little Suns.
 *
 * Both take the live obscuration, so the pictures agree with the sky
 * outside the window. The pinhole crescents are the same shape as the
 * real Sun at that moment, which is the whole point of the trick.
 */

const TAU = Math.PI * 2;

function fitCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

/**
 * The Sun, the Moon and the Earth in a row, with the shadow drawn.
 * Not to scale, and the picture says so, because the true scale would
 * put the Moon thirty Earths away and off the screen.
 */
export class WhyDiagram {
  constructor(canvas) {
    this.canvas = canvas;
    this.progress = 0;      // 0 = Moon out of the way, 1 = lined up
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  draw(progress = this.progress) {
    this.progress = progress;
    const { ctx, w, h } = fitCanvas(this.canvas);
    const cy = h * 0.5;

    const sunX = w * 0.13;
    const sunR = Math.min(w, h) * 0.13;
    const earthX = w * 0.86;
    const earthR = Math.min(w, h) * 0.11;
    const moonR = earthR * 0.35;
    // The Moon swings up out of line and back into it.
    const moonX = w * 0.6;
    const moonY = cy - (1 - progress) * h * 0.34;

    // The shadow, drawn only when the Moon is close to the line.
    if (progress > 0.05) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, progress) * 0.55;
      ctx.fillStyle = '#0a0b18';
      ctx.beginPath();
      ctx.moveTo(moonX, moonY - moonR);
      ctx.lineTo(earthX + earthR, moonY - moonR * 0.28);
      ctx.lineTo(earthX + earthR, moonY + moonR * 0.28);
      ctx.lineTo(moonX, moonY + moonR);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Sun.
    const glow = ctx.createRadialGradient(sunX, cy, sunR * 0.5, sunX, cy, sunR * 2.2);
    glow.addColorStop(0, 'rgba(255,210,87,0.5)');
    glow.addColorStop(1, 'rgba(255,210,87,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, cy, sunR * 2.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd257';
    ctx.beginPath();
    ctx.arc(sunX, cy, sunR, 0, TAU);
    ctx.fill();

    // Earth.
    ctx.fillStyle = '#3f7fd0';
    ctx.beginPath();
    ctx.arc(earthX, cy, earthR, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4fae6a';
    ctx.beginPath();
    ctx.arc(earthX - earthR * 0.25, cy - earthR * 0.2, earthR * 0.42, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(earthX + earthR * 0.3, cy + earthR * 0.4, earthR * 0.3, 0, TAU);
    ctx.fill();

    // Moon.
    ctx.fillStyle = '#d8d8e4';
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.arc(moonX - moonR * 0.3, moonY - moonR * 0.2, moonR * 0.22, 0, TAU);
    ctx.fill();

    // Labels.
    ctx.font = `600 ${Math.round(Math.min(w, h) * 0.085)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('Sun', sunX, cy + sunR * 1.9);
    ctx.fillText('Moon', moonX, moonY + moonR * 3.1);
    ctx.fillText('You', earthX, cy + earthR * 1.75);
  }

  /** Rock the Moon in and out of line, so the idea moves. */
  tick(timeMs) {
    if (this.reduceMotion) {
      this.draw(1);
      return;
    }
    const t = (timeMs % 6000) / 6000;
    // Slow at the ends, quick in the middle.
    const p = 0.5 - 0.5 * Math.cos(t * TAU);
    this.draw(p);
  }
}

/**
 * The pinhole projector.
 *
 * A card with a small hole makes a picture of the Sun on the ground.
 * The picture is upside down, it is dim, and it is exactly the shape of
 * whatever the Sun is doing right now — which is why it is the safe way
 * to watch. Drag the card to change the distance: farther means bigger
 * and fainter.
 */
export class PinholeDemo {
  constructor(canvas) {
    this.canvas = canvas;
    this.distance = 0.55;    // 0..1 of the available drop
    this.frame = null;
    this._bindDrag();
  }

  _bindDrag() {
    const set = (clientY) => {
      const rect = this.canvas.getBoundingClientRect();
      const y = (clientY - rect.top) / rect.height;
      this.distance = Math.min(0.9, Math.max(0.2, y));
      if (this.frame) this.draw(this.frame);
    };
    let dragging = false;
    const down = (e) => {
      dragging = true;
      set(e.touches ? e.touches[0].clientY : e.clientY);
      e.preventDefault();
    };
    const move = (e) => {
      if (!dragging) return;
      set(e.touches ? e.touches[0].clientY : e.clientY);
      e.preventDefault();
    };
    const up = () => { dragging = false; };
    this.canvas.addEventListener('pointerdown', down);
    this.canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    // Keyboard, so the demo is not mouse-only.
    this.canvas.tabIndex = 0;
    this.canvas.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') this.distance = Math.max(0.2, this.distance - 0.05);
      else if (e.key === 'ArrowDown') this.distance = Math.min(0.9, this.distance + 0.05);
      else return;
      e.preventDefault();
      if (this.frame) this.draw(this.frame);
    });
  }

  draw(frame) {
    this.frame = frame;
    const { ctx, w, h } = fitCanvas(this.canvas);

    const cardY = h * 0.16;
    const groundY = h * (0.16 + this.distance * 0.78);
    const holeX = w * 0.5;

    // The card.
    ctx.fillStyle = '#e9e3d4';
    ctx.fillRect(w * 0.16, cardY - 12, w * 0.68, 22);
    ctx.fillStyle = '#101223';
    ctx.beginPath();
    ctx.arc(holeX, cardY - 1, 4, 0, TAU);
    ctx.fill();

    // Two rays crossing at the hole, to show why it turns over.
    const spread = Math.max(8, (groundY - cardY) * 0.16);
    ctx.strokeStyle = 'rgba(255,214,120,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(holeX - spread * 1.6, cardY - 40);
    ctx.lineTo(holeX, cardY);
    ctx.lineTo(holeX + spread, groundY);
    ctx.moveTo(holeX + spread * 1.6, cardY - 40);
    ctx.lineTo(holeX, cardY);
    ctx.lineTo(holeX - spread, groundY);
    ctx.stroke();

    // The ground, and the projected image on it.
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, groundY, w, h - groundY);

    const imageR = Math.max(9, spread);
    // Farther card, bigger and fainter image. Same light, more area.
    const brightness = Math.min(1, 0.85 * Math.pow(0.35 / this.distance, 1.1));
    this.#crescent(ctx, holeX, groundY + imageR + 6, imageR, frame, brightness, true);

    ctx.font = `500 ${Math.round(Math.min(w, h) * 0.062)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('drag me up and down', w * 0.5, h - 10);
  }

  /** One projected Sun. Upside down, because a pinhole turns things over. */
  #crescent(ctx, cx, cy, r, frame, alpha, flip) {
    ctx.save();
    ctx.globalAlpha = Math.max(0.15, Math.min(1, alpha));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.clip();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // The pinhole image is rotated by half a turn.
    const ox = (flip ? -1 : 1) * frame.offsetX * r;
    const oy = (flip ? 1 : -1) * frame.offsetY * r;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, frame.moonScale * r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Dappled light under a tree: every gap between the leaves is a
 * pinhole, so the ground fills with little crescents. This is the thing
 * to photograph, and the thing most people walk over without noticing.
 */
export class DappleDemo {
  constructor(canvas) {
    this.canvas = canvas;
    this.spots = [];
    let seed = 812;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 34; i++) {
      this.spots.push({ x: rand(), y: rand(), r: 0.5 + rand() * 0.8, a: 0.4 + rand() * 0.6 });
    }
  }

  draw(frame) {
    const { ctx, w, h } = fitCanvas(this.canvas);
    ctx.fillStyle = '#1b1f2e';
    ctx.fillRect(0, 0, w, h);
    const unit = Math.min(w, h) * 0.085;
    for (const s of this.spots) {
      const r = unit * s.r;
      const cx = s.x * (w - r * 2) + r;
      const cy = s.y * (h - r * 2) + r;
      ctx.save();
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.clip();
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx - frame.offsetX * r, cy + frame.offsetY * r, frame.moonScale * r, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
}
