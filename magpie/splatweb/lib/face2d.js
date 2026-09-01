// face2d.js — Tier-3 renderer (DESIGN.md §5): a Canvas-2D vector puppet
// driven by the same decoded telemetry packet as the splat avatar. Zero
// WebGL; suitable for low-power devices and background tabs.
import { qToEuler, clamp } from './pose-math.js';
import { BLENDSHAPES } from './telemetry-codec.js';

const BI = {};
BLENDSHAPES.forEach((n, i) => { BI[n] = i; });

export function drawFace(ctx, pose, { label = '', staleness = 0 } = {}) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.3;
  ctx.clearRect(0, 0, w, h);

  const { yaw, pitch, roll } = qToEuler(pose.quat);
  const b = pose.blend;
  const jaw = b[BI.jawOpen], blink = (b[BI.eyeBlinkLeft] + b[BI.eyeBlinkRight]) / 2;
  const brow = b[BI.browInnerUp], smile = (b[BI.mouthSmileLeft] + b[BI.mouthSmileRight]) / 2;
  const lookX = b[BI.eyeLookX], lookY = b[BI.eyeLookY];

  // head shifts with yaw/pitch (cheap parallax), tilts with roll
  const hx = cx + Math.sin(-yaw) * R * 0.45;
  const hy = cy + Math.sin(pitch) * R * 0.35;

  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-roll);
  if (staleness > 0) ctx.globalAlpha = clamp(1 - staleness * 0.6, 0.3, 1);

  // head
  ctx.fillStyle = '#d9a184';
  ctx.beginPath();
  ctx.ellipse(0, 0, R * (1 - Math.abs(yaw) * 0.18), R * 1.12, 0, 0, Math.PI * 2);
  ctx.fill();
  // hair
  ctx.fillStyle = '#33241a';
  ctx.beginPath();
  ctx.ellipse(0, -R * 0.55, R * 0.95, R * 0.6, 0, Math.PI, 0);
  ctx.fill();

  const faceShift = Math.sin(-yaw) * R * 0.28;   // features slide across the head
  const eyeY = -R * 0.15 + Math.sin(pitch) * R * 0.12;
  const eyeOpen = clamp(1 - blink, 0.05, 1);
  for (const sx of [-1, 1]) {
    const ex = faceShift + sx * R * 0.34;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, R * 0.16, R * 0.11 * eyeOpen, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#241d18';
    ctx.beginPath();
    ctx.ellipse(ex + lookX * R * 0.06, eyeY + lookY * R * 0.04, R * 0.055, R * 0.055 * eyeOpen, 0, 0, Math.PI * 2);
    ctx.fill();
    // brow
    ctx.strokeStyle = '#33241a';
    ctx.lineWidth = R * 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - R * 0.16, eyeY - R * (0.2 + brow * 0.08) + sx * 0);
    ctx.quadraticCurveTo(ex, eyeY - R * (0.28 + brow * 0.12), ex + R * 0.16, eyeY - R * (0.2 + brow * 0.08));
    ctx.stroke();
  }
  // nose
  ctx.strokeStyle = '#c08a6e';
  ctx.lineWidth = R * 0.045;
  ctx.beginPath();
  ctx.moveTo(faceShift, eyeY + R * 0.1);
  ctx.lineTo(faceShift - R * 0.05, eyeY + R * 0.32);
  ctx.stroke();
  // mouth: opening from jawOpen, corner lift from smile
  const mY = eyeY + R * 0.55;
  const mW = R * 0.3;
  ctx.fillStyle = '#7c2d2d';
  ctx.beginPath();
  ctx.moveTo(faceShift - mW, mY - smile * R * 0.08);
  ctx.quadraticCurveTo(faceShift, mY + R * 0.05 + jaw * R * 0.3, faceShift + mW, mY - smile * R * 0.08);
  ctx.quadraticCurveTo(faceShift, mY - R * 0.06, faceShift - mW, mY - smile * R * 0.08);
  ctx.fill();
  ctx.restore();

  if (label) {
    ctx.fillStyle = 'rgba(200,200,210,0.8)';
    ctx.font = `${Math.round(h * 0.05)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, h - 8);
  }
}
