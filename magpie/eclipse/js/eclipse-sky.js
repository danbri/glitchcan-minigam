/**
 * eclipse-sky.js — the picture of the sky.
 *
 * Draws the Sun with the Moon in front of it, from the geometry that
 * eclipse-calc.js supplies. The Moon moves along the path it really
 * takes, and the bite grows and shrinks at the speed it really does.
 *
 * The drawing is deliberately a cartoon, not a photograph. A child must
 * never learn from this app that a real Sun is safe to look at, so the
 * Sun here is a friendly flat disc that could not be mistaken for the
 * view through a camera.
 */

const TAU = Math.PI * 2;

export class SkyView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.width = 0;
    this.height = 0;
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (w === this.width && h === this.height && dpr === this.dpr) return;
    this.dpr = dpr;
    this.width = w;
    this.height = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * @param {object} frame  one frame from EclipseCalc.frameAt()
   */
  draw(frame) {
    this.resize();
    const { ctx, width: w, height: h } = this;
    ctx.clearRect(0, 0, w, h);

    const horizonY = h * 0.82;
    this.#drawSky(frame, w, h, horizonY);

    // Put the Sun where it belongs in height: high in the frame when it
    // is high in the sky, near the rooftops when it is nearly down.
    const maxAlt = 30;
    const altFrac = Math.min(1, Math.max(0, frame.sunAltitude / maxAlt));
    const sunY = horizonY - altFrac * (horizonY - h * 0.22);
    const sunX = w * 0.5;
    const sunR = Math.min(w, h) * 0.16;

    this.#drawSun(frame, sunX, sunY, sunR);
    this.#drawGround(frame, w, h, horizonY);
  }

  #drawSky(frame, w, h, horizonY) {
    const ctx = this.ctx;
    // Twilight colours, then darkened by how much Sun is left.
    const light = Math.max(0, 1 - frame.obscuration);
    // The eye barely notices until the last few percent, so the light
    // level is not linear. This is why the world looks normal at 80 per
    // cent covered and strange at 95.
    const feel = Math.pow(light, 0.35);
    const lowSun = Math.min(1, Math.max(0, 1 - frame.sunAltitude / 25));

    const g = ctx.createLinearGradient(0, 0, 0, horizonY);
    const top = mix([12, 18, 54], [4, 6, 22], 1 - feel);
    const mid = mix([60, 92, 168], [18, 24, 62], 1 - feel);
    const low = mix([250, 176, 96], [96, 66, 74], (1 - feel) * 0.85);
    g.addColorStop(0, rgb(top));
    g.addColorStop(0.55, rgb(mid));
    g.addColorStop(1, rgb(mix(low, [252, 190, 110], lowSun * 0.5)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, horizonY + 1);

    // Stars come out only when it gets genuinely dark.
    const starAlpha = Math.max(0, feel < 0.35 ? (0.35 - feel) * 2.4 : 0);
    if (starAlpha > 0.01) {
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, starAlpha)})`;
      for (const s of STARS) {
        const r = s.r * (1 + 0.3 * Math.sin(s.p));
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * horizonY, r, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  #drawSun(frame, cx, cy, r) {
    const ctx = this.ctx;
    const light = Math.max(0, 1 - frame.obscuration);

    // Glow around the Sun, weaker as the Moon covers it.
    const glowR = r * (2.6 - 1.2 * frame.obscuration);
    const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, glowR);
    glow.addColorStop(0, `rgba(255,214,120,${0.55 * light + 0.05})`);
    glow.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, TAU);
    ctx.fill();

    // The Sun itself, clipped so the Moon can take a bite out of it.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.clip();

    const face = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.1, cx, cy, r);
    face.addColorStop(0, '#fff6d8');
    face.addColorStop(0.65, '#ffd257');
    face.addColorStop(1, '#ff9d2e');
    ctx.fillStyle = face;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // The Moon. Screen y grows downward, so the sky offset is negated.
    const mx = cx + frame.offsetX * r;
    const my = cy - frame.offsetY * r;
    const mr = frame.moonScale * r;
    ctx.fillStyle = '#12132a';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.fill();
    ctx.restore();

    // A rim, so the disc reads as a disc at any coverage.
    ctx.strokeStyle = `rgba(255,236,180,${0.35 + 0.4 * light})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();

    this.sunScreen = { x: cx, y: cy, r };
  }

  #drawGround(frame, w, h, horizonY) {
    const ctx = this.ctx;
    const dark = 0.25 + 0.6 * frame.obscuration;
    const ground = mix([44, 60, 48], [10, 12, 22], dark);
    ctx.fillStyle = rgb(ground);
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Rooftops and a tree, to say plainly: this Sun is low, and things
    // on the ground will get in your way.
    ctx.fillStyle = rgb(mix(ground, [6, 8, 16], 0.55));
    const base = horizonY;
    const unit = w / 12;
    const roofs = [
      [0.4, 1.6, 0.9], [2.1, 1.4, 1.3], [3.6, 1.9, 1.0],
      [8.1, 1.5, 1.2], [9.6, 2.0, 1.0], [11.0, 1.4, 1.1]
    ];
    for (const [x, bw, bh] of roofs) {
      const px = x * unit;
      const pw = bw * unit;
      const ph = bh * unit * 0.55;
      ctx.fillRect(px, base - ph, pw, ph + 4);
      ctx.beginPath();
      ctx.moveTo(px - 4, base - ph);
      ctx.lineTo(px + pw / 2, base - ph - unit * 0.42);
      ctx.lineTo(px + pw + 4, base - ph);
      ctx.closePath();
      ctx.fill();
    }
    // One tree, because the crescents under a tree are the best trick.
    // Kept off to the side so it never sits on top of the Sun.
    const tx = w * 0.26;
    ctx.fillRect(tx - unit * 0.07, base - unit * 1.1, unit * 0.14, unit * 1.1);
    ctx.beginPath();
    ctx.arc(tx, base - unit * 1.25, unit * 0.52, 0, TAU);
    ctx.fill();
  }
}

/* ---------- a second, simpler view: the disc on its own ---------- */

/**
 * Draws only the Sun and the Moon, filling the canvas. Used on the
 * timeline card where the sky would only be decoration.
 */
export function drawDiscPair(canvas, frame) {
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

  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.36;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();
  const face = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.1, cx, cy, r);
  face.addColorStop(0, '#fff6d8');
  face.addColorStop(0.7, '#ffd257');
  face.addColorStop(1, '#ff9d2e');
  ctx.fillStyle = face;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = '#12132a';
  ctx.beginPath();
  ctx.arc(cx + frame.offsetX * r, cy - frame.offsetY * r, frame.moonScale * r, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,236,180,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
}

/* ---------- colour helpers ---------- */

function mix(a, b, t) {
  const k = Math.min(1, Math.max(0, t));
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k
  ];
}

function rgb(c) {
  return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
}

// Fixed star field. Fixed, so it does not shimmer distractingly and so
// two devices side by side show the same sky.
const STARS = [];
(function makeStars() {
  let seed = 20260812;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 60; i++) {
    STARS.push({ x: rand(), y: rand() * 0.8, r: 0.6 + rand() * 1.3, p: rand() * TAU });
  }
})();
