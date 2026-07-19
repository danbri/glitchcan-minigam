// robbin-sprites.js — hand-vectorized linocut birds for ROBBIN.
// Each bird was traced by eye from four lino-print cards (robin, blackbird,
// blue tit, wren), then split into cutout parts — tail, body, wing, head,
// hinged lower beak — that rotate independently around pivots, South Park
// paper-doll style. Flat ink shapes in a 100×100 box, feet baseline at y=92,
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
// Parts render in array order; children render inside the parent's transform
// (so beaks ride along with the head). Generous overlaps hide the joints.
export const BIRDS = {
  robin: {
    name: 'Robbin',
    parts: [
      { id: 'tail', pivot: [33, 49], layers: [
        { d: 'M5,42 L35,43 L33,57 L8,55 Z', fill: '#26221e' },
      ]},
      { id: 'body', layers: [
        { d: 'M26,48 C27,33 40,23 55,23 C69,23 79,32 80,43 C80,54 71,66 57,73 C43,79 29,72 26,60 Z', fill: '#26221e' },
        { d: 'M57,32 C67,30 76,36 77,44 C76,54 68,63 57,70 C46,75 36,71 34,63 C44,58 52,50 55,43 C56,38 56,34 57,32 Z', fill: '#d94327' },
      ]},
      { id: 'wing', pivot: [38, 45], layers: [
        { d: 'M33,44 C43,38 55,40 59,48 C57,57 47,63 38,61 C30,57 28,50 33,44 Z', fill: '#3a322b' },
      ]},
      { id: 'head', pivot: [58, 38], layers: [
        { d: 'M45,34 C45,22 55,13 66,14 C76,15 82,23 82,31 C82,40 74,46 64,46 C53,46 45,43 45,34 Z', fill: '#26221e' },
        { d: 'M61,23 C71,20 79,28 79,35 C78,41 71,46 63,45 C55,43 52,37 53,30 C55,26 58,24 61,23 Z', fill: '#d94327' },
        { circle: [68, 27, 3], fill: '#1b1713' },
      ], children: [
        { id: 'beakTop', layers: [{ d: 'M79,25 L95,30 L79,35 Z', fill: '#1b1713' }] },
        { id: 'beakLower', pivot: [80, 33], layers: [{ d: 'M79,32 L93,34 L79,39 Z', fill: '#1b1713' }] },
      ]},
    ],
    hips: [[44, 72], [56, 70]],
    leg: { color: '#1b1713', width: 3.4, len: 20 },
  },

  blackbird: {
    name: 'Blackbird',
    parts: [
      { id: 'tail', pivot: [30, 44], layers: [
        { d: 'M3,28 L33,38 L29,51 L7,42 Z', fill: '#191919' },
      ]},
      { id: 'body', layers: [
        { d: 'M22,50 C22,35 36,23 54,22 C70,22 82,31 83,43 C84,54 76,65 63,71 C48,77 31,72 24,62 Z', fill: '#191919' },
      ]},
      { id: 'wing', pivot: [38, 44], layers: [
        { d: 'M32,42 C44,36 58,39 62,48 C60,58 48,65 38,62 C29,58 27,48 32,42 Z', fill: '#2e2e2e' },
      ]},
      { id: 'head', pivot: [60, 34], layers: [
        { d: 'M47,32 C48,20 58,12 68,13 C78,15 84,23 84,31 C83,40 75,46 65,46 C55,46 47,41 47,32 Z', fill: '#191919' },
        { ring: [71, 27, 3.6], stroke: '#a4b455', width: 1.8 },
        { circle: [71, 27, 1.7], fill: '#0c0c0c' },
      ], children: [
        { id: 'beakTop', layers: [{ d: 'M81,24 L97,30 L81,35 Z', fill: '#eebc1e' }] },
        { id: 'beakLower', pivot: [82, 33], layers: [{ d: 'M81,32 L95,34 L81,39 Z', fill: '#d8a41a' }] },
      ]},
    ],
    hips: [[42, 74], [56, 72]],
    leg: { color: '#141414', width: 3.2, len: 18 },
  },

  bluetit: {
    name: 'Blue tit',
    parts: [
      { id: 'tail', pivot: [31, 52], layers: [
        { d: 'M4,60 L33,47 L36,59 L12,71 Z', fill: '#3d6cb2' },
      ]},
      { id: 'body', layers: [
        { d: 'M28,34 C24,42 23,54 30,64 L40,68 C33,54 35,41 43,33 Z', fill: '#3d6cb2' },
        { d: 'M30,44 C38,32 58,30 70,40 C79,49 78,64 66,73 C53,81 38,77 31,66 C26,58 26,50 30,44 Z', fill: '#e2c22a' },
      ]},
      { id: 'wing', pivot: [37, 46], layers: [
        { d: 'M32,44 C42,38 55,41 58,49 C56,58 46,64 37,61 C29,57 27,50 32,44 Z', fill: '#3d6cb2' },
      ]},
      { id: 'head', pivot: [60, 32], layers: [
        { d: 'M46,30 C47,17 59,9 70,11 C80,13 85,22 84,30 C83,39 74,45 63,45 C53,44 46,39 46,30 Z', fill: '#f7f3e8' },
        { d: 'M45,25 C49,12 63,5 74,10 C81,13 85,19 85,25 C75,15 58,13 46,22 Z', fill: '#3d6cb2' },
        { d: 'M47,25 C58,22 70,22 82,25 L82,29 C70,26 58,26 47,30 Z', fill: '#1b1713' },
        { d: 'M46,36 C54,44 70,45 82,38 L82,42 C70,48 54,47 45,40 Z', fill: '#1b1713' },
        { d: 'M66,42 L76,39 L72,48 Z', fill: '#1b1713' },
      ], children: [
        { id: 'beakTop', layers: [{ d: 'M83,23 L96,27 L83,31 Z', fill: '#1b1713' }] },
        { id: 'beakLower', pivot: [84, 30], layers: [{ d: 'M83,28 L94,30 L83,34 Z', fill: '#1b1713' }] },
      ]},
    ],
    hips: [[44, 74], [57, 72]],
    leg: { color: '#1b1713', width: 3.2, len: 18 },
  },

  wren: {
    name: 'Wren',
    parts: [
      { id: 'tail', pivot: [24, 44], layers: [
        { d: 'M8,26 L27,40 L18,50 L5,38 Z', fill: '#96725c' },
      ]},
      { id: 'body', layers: [
        { d: 'M20,54 C18,40 31,29 47,28 C62,28 74,37 75,48 C76,59 67,69 53,73 C39,77 24,69 20,54 Z', fill: '#a07a63' },
      ]},
      { id: 'wing', pivot: [36, 48], layers: [
        { d: 'M30,46 C40,40 52,42 56,50 C54,59 44,64 35,61 C27,57 25,51 30,46 Z', fill: '#8d6952' },
        { line: [36, 50, 46, 52], stroke: '#5c4334', width: 2 },
        { line: [38, 56, 48, 58], stroke: '#5c4334', width: 2 },
      ]},
      { id: 'head', pivot: [58, 38], layers: [
        { d: 'M48,36 C48,26 56,19 65,20 C73,21 78,28 78,34 C78,42 71,47 62,47 C54,46 48,43 48,36 Z', fill: '#a07a63' },
        { circle: [66, 31, 2.4], fill: '#241a12' },
      ], children: [
        { id: 'beakTop', layers: [{ d: 'M77,29 L91,33 L77,37 Z', fill: '#3d2b20' }] },
        { id: 'beakLower', pivot: [77, 35], layers: [{ d: 'M77,34 L89,36 L77,40 Z', fill: '#3d2b20' }] },
      ]},
    ],
    hips: [[40, 72], [53, 70]],
    leg: { color: '#3a2a1e', width: 2.6, len: 21 },
  },
};

// ------------------------------------------------------------ cutout rig
// Per-part rotation by pose+phase. This is the whole "skeleton": tails sway,
// wings flap (hard in the air), heads bob and dip to peck, lower beaks chirp.
function partRot(id, pose, phase) {
  const s = Math.sin;
  switch (id) {
    case 'tail':
      if (pose === 'air')   return -0.35;
      if (pose === 'walk' || pose === 'peck') return s(phase * 2) * 0.12;
      if (pose === 'climb') return 0.16;
      return s(phase * 0.6) * 0.06;
    case 'wing':
      if (pose === 'air')   return -0.25 + s(phase * 3) * 0.55;
      if (pose === 'walk' || pose === 'peck') return s(phase * 2) * 0.16;
      if (pose === 'climb') return -0.15 + s(phase * 2) * 0.3;
      return 0;
    case 'head':
      if (pose === 'peck')  return 0.6;
      if (pose === 'walk')  return s(phase * 2 + 0.9) * 0.1;
      if (pose === 'climb') return -0.18;
      if (pose === 'air')   return -0.12;
      return s(phase * 0.6 + 1) * 0.04;
    case 'beakLower':
      if (pose === 'peck')  return 0.5;
      // occasional chirp: mostly shut, briefly gaping
      return Math.max(0, s(phase * 0.9)) ** 6 * 0.45 + 0.03;
  }
  return 0;
}

function renderLayers(ctx, layers) {
  for (const l of layers) {
    if (!l.p && l.d) l.p = new Path2D(l.d);
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
}

function drawPart(ctx, part, pose, phase) {
  ctx.save();
  if (part.pivot) {
    const a = partRot(part.id, pose, phase);
    if (a) {
      ctx.translate(part.pivot[0], part.pivot[1]);
      ctx.rotate(a);
      ctx.translate(-part.pivot[0], -part.pivot[1]);
    }
  }
  renderLayers(ctx, part.layers);
  if (part.children) for (const ch of part.children) drawPart(ctx, ch, pose, phase);
  ctx.restore();
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
  ctx.moveTo(fx, fy); ctx.lineTo(fx + 6, fy + 2);
  ctx.moveTo(fx, fy); ctx.lineTo(fx - 4, fy + 3);
  ctx.stroke();
}

/**
 * Draw a bird on a canvas context.
 * x,y = feet baseline centre in canvas px. size = height of the 100-box in px.
 * pose: 'stand' | 'walk' | 'air' | 'climb' | 'peck' | 'dead'
 * ('peck' keeps the legs walking — the head dips in passing, Pac-Man style.)
 */
export function drawBird(ctx, name, { x, y, size = 44, facing = 1, phase = 0, pose = 'stand', alpha = 1 }) {
  const spec = BIRDS[name];
  if (!spec) return;
  const s = size / 100;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(facing < 0 ? -s : s, s);
  const dead = pose === 'dead';
  if (dead) { ctx.rotate(Math.PI); ctx.translate(-100, -60); pose = 'stand'; }
  ctx.translate(-50, -92);

  // legs (under the body)
  const [h0, h1] = spec.hips;
  if (pose === 'walk' || pose === 'peck') {
    drawLeg(ctx, h0[0], h0[1], Math.sin(phase) * 0.55, spec.leg);
    drawLeg(ctx, h1[0], h1[1], -Math.sin(phase) * 0.55, spec.leg);
  } else if (pose === 'air') {
    drawLeg(ctx, h0[0], h0[1], -0.9, spec.leg, 0.5);
    drawLeg(ctx, h1[0], h1[1], -0.6, spec.leg, 0.5);
  } else if (pose === 'climb') {
    drawLeg(ctx, h0[0], h0[1], Math.sin(phase) * 0.35, spec.leg, 0.2);
    drawLeg(ctx, h1[0], h1[1], -Math.sin(phase) * 0.35, spec.leg, 0.2);
  } else {
    drawLeg(ctx, h0[0], h0[1], 0.08, spec.leg);
    drawLeg(ctx, h1[0], h1[1], -0.08, spec.leg);
  }

  // whole-rig bob while on the move
  if (pose === 'walk' || pose === 'peck') ctx.translate(0, Math.sin(phase * 2) * 1.6);

  for (const part of spec.parts) drawPart(ctx, part, pose, phase);
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

// ------------------------------------------------------------ static SVG
function svgLayers(layers) {
  const parts = [];
  for (const l of layers) {
    if (l.d) parts.push(`<path d="${l.d}" fill="${l.fill}"/>`);
    else if (l.circle) parts.push(`<circle cx="${l.circle[0]}" cy="${l.circle[1]}" r="${l.circle[2]}" fill="${l.fill}"/>`);
    else if (l.ring) parts.push(`<circle cx="${l.ring[0]}" cy="${l.ring[1]}" r="${l.ring[2]}" fill="none" stroke="${l.stroke}" stroke-width="${l.width}"/>`);
    else if (l.line) parts.push(`<line x1="${l.line[0]}" y1="${l.line[1]}" x2="${l.line[2]}" y2="${l.line[3]}" stroke="${l.stroke}" stroke-width="${l.width}" stroke-linecap="round"/>`);
  }
  return parts.join('');
}
function svgPart(part, pose, phase) {
  const a = part.pivot ? partRot(part.id, pose, phase) : 0;
  const tf = a ? ` transform="rotate(${(a * 180 / Math.PI).toFixed(1)} ${part.pivot[0]} ${part.pivot[1]})"` : '';
  const kids = part.children ? part.children.map(ch => svgPart(ch, pose, phase)).join('') : '';
  return `<g${tf}>${svgLayers(part.layers)}${kids}</g>`;
}

/** Static inline-SVG markup for a bird (title screen, docs). */
export function birdSVG(name, size = 90, facing = 1, pose = 'stand', phase = 1.9) {
  const spec = BIRDS[name];
  const parts = [];
  const leg = spec.leg;
  for (const [i, [hx, hy]] of spec.hips.entries()) {
    const sw = i ? -0.12 : 0.12;
    const fx = hx + Math.sin(sw) * leg.len, fy = hy + Math.cos(sw) * leg.len;
    parts.push(`<path d="M${hx},${hy} L${fx},${fy} M${fx},${fy} l6,2 M${fx},${fy} l-4,3" stroke="${leg.color}" stroke-width="${leg.width}" stroke-linecap="round" fill="none"/>`);
  }
  for (const part of spec.parts) parts.push(svgPart(part, pose, phase));
  const flip = facing < 0 ? ' transform="translate(100,0) scale(-1,1)"' : '';
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-label="${spec.name}"><g${flip}>${parts.join('')}</g></svg>`;
}
