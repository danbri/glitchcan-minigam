// robbin-sprites.js — hand-vectorized linocut birds for ROBBIN
// Each bird was traced by eye from four lino-print cards (robin, blackbird,
// blue tit, wren). Flat ink shapes in a 100×100 box, feet baseline at y=92,
// bird faces RIGHT. Legs are drawn procedurally so they can animate.

export const PALETTE = {
  paper:  '#f2ecdd',
  paperHi:'#f7f2e6',
  ink:    '#26221e',
  platform: '#2e5e45',
  platformShadow: '#3a2f26',
  ladder: '#b98a2e',
  egg:    '#f8f2e1',
  grain:  '#c89238',
  hudText:'#26221e',
  danger: '#c0392b',
};

// Layer types: {d, fill} path · {circle:[cx,cy,r], fill}
// {ring:[cx,cy,r], stroke, width} · {line:[x1,y1,x2,y2], stroke, width}
export const BIRDS = {
  robin: {
    name: 'Robbin',
    layers: [
      // ink silhouette: flicked tail, round back, head
      { d: 'M5,44 C16,48 26,50 33,45 C34,30 46,18 61,18 C74,18 84,28 84,40 C84,45 83,49 81,53 C76,63 66,71 54,75 C40,79 27,74 24,63 C22,56 24,51 28,47 C20,52 11,50 5,44 Z',
        fill: '#26221e' },
      // red face + breast
      { d: 'M61,26 C70,23 78,28 81,36 C83,45 79,55 71,63 C63,71 51,75 43,71 C51,64 57,56 59,46 C61,37 60,30 61,26 Z',
        fill: '#d94327' },
      { circle: [70, 34, 3.1], fill: '#1b1713' },                 // eye in the red patch
      { d: 'M83,32 L97,37 L83,43 Z', fill: '#1b1713' },           // beak
    ],
    hips: [[45, 71], [57, 69]],
    leg: { color: '#1b1713', width: 3.4, len: 20 },
  },

  blackbird: {
    name: 'Blackbird',
    layers: [
      // plump all-black body with a raised pointed tail
      { d: 'M4,34 L30,45 C34,31 47,20 61,20 C75,20 85,30 86,42 C87,52 81,62 70,68 C57,76 39,78 29,70 C21,64 19,55 22,48 C14,47 8,41 4,34 Z',
        fill: '#191919' },
      { d: 'M85,40 L98,46 L84,53 Z', fill: '#eebc1e' },           // yellow bill
      { ring: [72, 35, 3.4], stroke: '#a4b455', width: 1.8 },     // pale eye-ring
    ],
    hips: [[43, 74], [57, 72]],
    leg: { color: '#141414', width: 3.2, len: 18 },
  },

  bluetit: {
    name: 'Blue tit',
    layers: [
      // blue tail + back/wing (behind body, to the left)
      { d: 'M3,62 L27,48 L34,60 L12,72 Z', fill: '#3d6cb2' },
      { d: 'M27,30 C20,40 19,53 28,62 L45,66 C36,53 38,39 47,31 Z', fill: '#3d6cb2' },
      // yellow breast
      { d: 'M34,42 C44,31 63,31 73,42 C81,52 79,67 66,75 C53,82 39,78 33,68 C28,59 28,49 34,42 Z',
        fill: '#e2c22a' },
      // white head
      { d: 'M47,17 C57,8 74,9 81,20 C85,28 83,37 74,41 C63,45 51,41 47,32 C45,26 45,21 47,17 Z',
        fill: '#f7f3e8' },
      // blue cap
      { d: 'M46,21 C53,9 74,6 82,17 L83,25 C74,15 57,13 47,23 Z', fill: '#3d6cb2' },
      // black eye-stripe, collar, bib
      { d: 'M47,26 C58,22 70,22 81,26 L81,31 C70,27 58,27 47,31 Z', fill: '#1b1713' },
      { d: 'M45,34 C54,45 69,47 81,39 C83,43 81,47 74,50 C61,55 47,51 41,40 Z', fill: '#1b1713' },
      { d: 'M69,46 L80,42 L75,55 Z', fill: '#1b1713' },
      { d: 'M84,26 L95,30 L84,35 Z', fill: '#1b1713' },           // beak
    ],
    hips: [[44, 74], [57, 72]],
    leg: { color: '#1b1713', width: 3.2, len: 18 },
  },

  wren: {
    name: 'Wren',
    layers: [
      // cocked-up tail
      { d: 'M10,27 L27,41 L18,50 L6,39 Z', fill: '#96725c' },
      // round little body
      { d: 'M20,53 C17,40 30,29 46,28 C61,27 73,36 75,47 C77,58 68,69 54,73 C40,77 25,70 20,53 Z',
        fill: '#a07a63' },
      // wing barring (lino scratches)
      { line: [37, 55, 47, 57], stroke: '#5c4334', width: 2 },
      { line: [41, 61, 51, 63], stroke: '#5c4334', width: 2 },
      { line: [44, 49, 54, 51], stroke: '#5c4334', width: 2 },
      { circle: [63, 39, 2.4], fill: '#241a12' },                 // eye
      { d: 'M75,41 L89,45 L75,49 Z', fill: '#3d2b20' },           // thin bill
    ],
    hips: [[40, 72], [53, 70]],
    leg: { color: '#3a2a1e', width: 2.6, len: 21 },
  },
};

function pathLayers(spec) {
  if (!spec._compiled) {
    spec._compiled = spec.layers.map(l => (l.d ? { ...l, p: new Path2D(l.d) } : l));
  }
  return spec._compiled;
}

function drawLeg(ctx, hx, hy, swing, leg, lift = 0) {
  // one twig leg: hip → knee → foot, with two little toe ticks
  const len = leg.len * (1 - lift * 0.35);
  const fx = hx + Math.sin(swing) * len;
  const fy = hy + Math.cos(swing) * len;
  const kx = (hx + fx) / 2 - Math.sin(swing) * 2 + 2;
  const ky = (hy + fy) / 2;
  ctx.strokeStyle = leg.color;
  ctx.lineWidth = leg.width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy);
  // toes
  ctx.moveTo(fx, fy); ctx.lineTo(fx + 6, fy + 2);
  ctx.moveTo(fx, fy); ctx.lineTo(fx - 4, fy + 3);
  ctx.stroke();
}

/**
 * Draw a bird on a canvas context.
 * x,y = feet baseline centre in canvas px. size = height of the 100-box in px.
 * pose: 'stand' | 'walk' | 'air' | 'climb' | 'peck' | 'dead'
 */
export function drawBird(ctx, name, { x, y, size = 34, facing = 1, phase = 0, pose = 'stand', alpha = 1 }) {
  const spec = BIRDS[name];
  if (!spec) return;
  const s = size / 100;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(facing < 0 ? -s : s, s);
  if (pose === 'dead') { ctx.rotate(Math.PI); ctx.translate(-100, -60); }
  ctx.translate(-50, -92);

  // legs (under the body)
  const [h0, h1] = spec.hips;
  if (pose === 'walk') {
    drawLeg(ctx, h0[0], h0[1], Math.sin(phase) * 0.55, spec.leg);
    drawLeg(ctx, h1[0], h1[1], -Math.sin(phase) * 0.55, spec.leg);
  } else if (pose === 'air') {
    drawLeg(ctx, h0[0], h0[1], -0.9, spec.leg, 0.5);
    drawLeg(ctx, h1[0], h1[1], -0.6, spec.leg, 0.5);
  } else if (pose === 'climb') {
    drawLeg(ctx, h0[0], h0[1], Math.sin(phase) * 0.35, spec.leg, 0.2);
    drawLeg(ctx, h1[0], h1[1], -Math.sin(phase) * 0.35, spec.leg, 0.2);
  } else if (pose === 'peck') {
    drawLeg(ctx, h0[0], h0[1], 0.1, spec.leg);
    drawLeg(ctx, h1[0], h1[1], -0.1, spec.leg);
  } else {
    drawLeg(ctx, h0[0], h0[1], 0.08, spec.leg);
    drawLeg(ctx, h1[0], h1[1], -0.08, spec.leg);
  }

  // body bob while walking / pecking tilt
  if (pose === 'walk') ctx.translate(0, Math.sin(phase * 2) * 1.6);
  if (pose === 'peck') { ctx.translate(14, 26); ctx.rotate(0.55); ctx.translate(-14, -26); }

  for (const l of pathLayers(spec)) {
    if (l.p) { ctx.fillStyle = l.fill; ctx.fill(l.p); }
    else if (l.circle) {
      ctx.fillStyle = l.fill;
      ctx.beginPath(); ctx.arc(l.circle[0], l.circle[1], l.circle[2], 0, Math.PI * 2); ctx.fill();
    } else if (l.ring) {
      ctx.strokeStyle = l.stroke; ctx.lineWidth = l.width;
      ctx.beginPath(); ctx.arc(l.ring[0], l.ring[1], l.ring[2], 0, Math.PI * 2); ctx.stroke();
    } else if (l.line) {
      ctx.strokeStyle = l.stroke; ctx.lineWidth = l.width; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(l.line[0], l.line[1]); ctx.lineTo(l.line[2], l.line[3]); ctx.stroke();
    }
  }
  ctx.restore();
}

/** Speckled egg. x,y = baseline centre (sits on a platform top). */
export function drawEgg(ctx, x, y, r = 9) {
  ctx.save();
  ctx.translate(x, y - r * 1.15);
  ctx.fillStyle = '#fbf6e6';
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.86, r * 1.08, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(38,34,30,0.55)';
  for (const [dx, dy] of [[-2, -3], [3, 1], [-1, 4], [2, -5]]) {
    ctx.beginPath(); ctx.arc(dx, dy, 0.9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** Little pile of grain. x,y = baseline centre. */
export function drawGrain(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = PALETTE.grain;
  const seeds = [[-6, -2, 0.5], [0, -4, -0.4], [6, -2, 0.9], [-2, -1, 1.2], [3, -1, 0.1]];
  for (const [dx, dy, rot] of seeds) {
    ctx.save(); ctx.translate(dx, dy); ctx.rotate(rot);
    ctx.beginPath(); ctx.ellipse(0, 0, 3.4, 1.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(38,34,30,0.35)';
  ctx.beginPath(); ctx.arc(-4, -3, 0.8, 0, Math.PI * 2); ctx.arc(4, -3, 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Static inline-SVG markup for a bird (title screen, docs). */
export function birdSVG(name, size = 90, facing = 1) {
  const spec = BIRDS[name];
  const parts = [];
  const leg = spec.leg;
  for (const [i, [hx, hy]] of spec.hips.entries()) {
    const sw = i ? -0.12 : 0.12;
    const fx = hx + Math.sin(sw) * leg.len, fy = hy + Math.cos(sw) * leg.len;
    parts.push(`<path d="M${hx},${hy} L${fx},${fy} M${fx},${fy} l6,2 M${fx},${fy} l-4,3" stroke="${leg.color}" stroke-width="${leg.width}" stroke-linecap="round" fill="none"/>`);
  }
  for (const l of spec.layers) {
    if (l.d) parts.push(`<path d="${l.d}" fill="${l.fill}"/>`);
    else if (l.circle) parts.push(`<circle cx="${l.circle[0]}" cy="${l.circle[1]}" r="${l.circle[2]}" fill="${l.fill}"/>`);
    else if (l.ring) parts.push(`<circle cx="${l.ring[0]}" cy="${l.ring[1]}" r="${l.ring[2]}" fill="none" stroke="${l.stroke}" stroke-width="${l.width}"/>`);
    else if (l.line) parts.push(`<line x1="${l.line[0]}" y1="${l.line[1]}" x2="${l.line[2]}" y2="${l.line[3]}" stroke="${l.stroke}" stroke-width="${l.width}" stroke-linecap="round"/>`);
  }
  const flip = facing < 0 ? ' transform="translate(100,0) scale(-1,1)"' : '';
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-label="${spec.name}"><g${flip}>${parts.join('')}</g></svg>`;
}
