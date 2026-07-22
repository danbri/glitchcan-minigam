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
        { circle: [68, 27, 3.4], fill: '#1b1713' },
        { circle: [69.2, 25.9, 1.1], fill: '#f7f2e6' },
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
        { circle: [71, 27, 2.2], fill: '#0c0c0c' },
        { circle: [71.9, 26.1, 0.9], fill: '#f7f2e6' },
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
        { circle: [66, 31, 2.8], fill: '#241a12' },
        { circle: [66.9, 30.1, 0.9], fill: '#f7f2e6' },
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
// Flutter poses get the full animation-principles treatment: smear ghosts
// (timing), a far wing above the back (staging — flying reads at a glance),
// stretch by mode (exaggeration: spread brake vs tight buzz), lagged tail
// (follow-through) and a stabilised counter-bobbing head (overlap).
const FLUTTER = {
  flit:    { stretch: 1.25 },
  airup:   { stretch: 1.12 },   // rising: tight fast buzz
  airdown: { stretch: 1.45 },   // falling: wings spread, braking
  climb:   { stretch: 1.18 },
};

function partRot(id, pose, phase) {
  const s = Math.sin;
  switch (id) {
    case 'tail':
      if (pose === 'airup')   return -0.3;
      if (pose === 'airdown') return -0.5 + s(phase * 1.6 - 0.7) * 0.08;
      if (pose === 'flit')    return -0.1 + s(phase * 2.6 - 0.9) * 0.1;  // lags the beat
      if (pose === 'walk' || pose === 'peck') return s(phase * 2) * 0.12;
      if (pose === 'climb')   return 0.12 + s(phase * 2.2 - 0.8) * 0.06;
      return s(phase * 0.6) * 0.06;
    case 'wing':
      if (pose === 'airup')   return -0.35 + s(phase * 3) * 0.5;
      if (pose === 'airdown') return -0.8 + s(phase * 1.6) * 0.55;
      if (pose === 'flit')    return -0.3 + s(phase * 2.6) * 0.55;
      if (pose === 'climb')   return -0.3 + s(phase * 2.2) * 0.45;
      if (pose === 'walk' || pose === 'peck') return s(phase * 2) * 0.16;
      return 0;
    case 'head':
      if (pose === 'peck')    return 0.6;
      if (pose === 'flit')    return -s(phase * 2.6 - 1.2) * 0.07;  // head stays level
      if (pose === 'walk')    return s(phase * 2 + 0.9) * 0.1;
      if (pose === 'climb')   return -0.18;
      if (pose === 'airup')   return -0.15;
      if (pose === 'airdown') return 0.1;
      return s(phase * 0.6 + 1) * 0.04;
    case 'beakLower':
      if (pose === 'peck')  return 0.5;
      // occasional chirp: mostly shut, briefly gaping
      return Math.max(0, s(phase * 0.9)) ** 6 * 0.45 + 0.03;
  }
  return 0;
}

// near wing with motion-blur smear passes; far wing offset above the back
function drawWing(ctx, part, pose, phase, far) {
  const spread = FLUTTER[pose].stretch * (far ? 0.85 : 1);
  const passes = far ? [[0.22, 0.8]] : [[0.5, 0.2], [0.25, 0.42], [0, 1]];
  for (const [dp, a] of passes) {
    const rot = partRot('wing', pose, phase - dp) * (far ? 0.85 : 1) + (far ? -0.5 : 0);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(part.pivot[0] - (far ? 5 : 0), part.pivot[1] - (far ? 9 : 0));
    ctx.rotate(rot);
    ctx.scale(spread, 1);
    ctx.translate(-part.pivot[0], -part.pivot[1]);
    renderLayers(ctx, part.layers);
    ctx.restore();
  }
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
 * pose: 'stand' | 'walk' | 'flit' | 'airup' | 'airdown' | 'climb' | 'peck' | 'dead'
 * ('air' is accepted as an alias of 'airup'.)
 * ('peck' keeps the legs walking — the head dips in passing, Pac-Man style.)
 * squash: [sx, sy] cartoon squash & stretch, anchored at the feet.
 * blend: 0..1 ease into the flit hover (slow-in on the lift, no pop).
 */
export function drawBird(ctx, name, { x, y, size = 44, facing = 1, phase = 0, pose = 'stand', alpha = 1, squash = null, blend = 1 }) {
  const spec = BIRDS[name];
  if (!spec) return;
  if (pose === 'air') pose = 'airup';
  const s = size / 100;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(facing < 0 ? -s : s, s);
  if (squash) ctx.scale(squash[0], squash[1]);
  // a breath of squash on every flit beat, anchored at the feet
  if (pose === 'flit') ctx.scale(1, 1 + Math.sin(phase * 2.6 - 0.6) * 0.05 * blend);
  const dead = pose === 'dead';
  if (dead) { ctx.rotate(Math.PI); ctx.translate(-100, -60); pose = 'stand'; }
  ctx.translate(-50, -92);

  // flit and climb hover with feet off the ground — more birdy than trudging;
  // the body rises on an arc after the downstroke (overlapping action)
  if (pose === 'flit') ctx.translate(0, (-9 + Math.sin(phase * 2.6 - 1.2) * 2.6) * blend);
  if (pose === 'climb') ctx.translate(0, -4);

  const flutter = FLUTTER[pose];
  // legs (under the body)
  const [h0, h1] = spec.hips;
  if (pose === 'walk' || pose === 'peck') {
    drawLeg(ctx, h0[0], h0[1], Math.sin(phase) * 0.55, spec.leg);
    drawLeg(ctx, h1[0], h1[1], -Math.sin(phase) * 0.55, spec.leg);
  } else if (pose === 'airup' || pose === 'airdown' || pose === 'flit') {
    drawLeg(ctx, h0[0], h0[1], -0.9, spec.leg, 0.5);
    drawLeg(ctx, h1[0], h1[1], -0.6, spec.leg, 0.5);
  } else if (pose === 'climb') {
    drawLeg(ctx, h0[0], h0[1], -0.7, spec.leg, 0.5);
    drawLeg(ctx, h1[0], h1[1], -0.45, spec.leg, 0.5);
  } else {
    drawLeg(ctx, h0[0], h0[1], 0.08, spec.leg);
    drawLeg(ctx, h1[0], h1[1], -0.08, spec.leg);
  }

  // whole-rig bob while on the move
  if (pose === 'walk' || pose === 'peck') ctx.translate(0, Math.sin(phase * 2) * 1.6);

  for (const part of spec.parts) {
    if (flutter && part.id === 'wing') {
      drawWing(ctx, part, pose, phase, false);      // near wing + smear ghosts
    } else {
      if (flutter && part.id === 'body') {
        const wing = spec.parts.find(p => p.id === 'wing');
        if (wing) drawWing(ctx, wing, pose, phase, true);   // far wing over the back
      }
      drawPart(ctx, part, pose, phase);
    }
  }
  ctx.restore();
}

/** Hearty pile of grain — the treasure. x,y = baseline centre. */
export function drawGrain(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  // mound
  ctx.fillStyle = PALETTE.grain;
  ctx.beginPath();
  ctx.moveTo(-11, 0);
  ctx.quadraticCurveTo(-7, -9, 0, -10);
  ctx.quadraticCurveTo(7, -9, 11, 0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(38,34,30,0.6)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // scattered seeds
  ctx.fillStyle = '#e0b055';
  for (const [dx, dy, rot] of [[-6, -3, 0.5], [0, -6, -0.4], [5, -3, 0.9], [-1, -2, 1.2], [8, -1, 0.2], [-9, -1, -0.7]]) {
    ctx.save(); ctx.translate(dx, dy); ctx.rotate(rot);
    ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 1.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Doorstep milk bottle. x,y = baseline centre. With `cream`, the top fifth
 * is the yellower cream layer under a gold foil cap — that's what the birds
 * are after. Without, the picked-open bottle stays behind as scenery.
 */
export function drawBottle(ctx, x, y, cream = true) {
  ctx.save();
  ctx.translate(x, y);
  const w = 13, h = 27, neck = 8;
  // bottle silhouette (shoulders + neck)
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2, -h + neck + 5);
    ctx.quadraticCurveTo(-w / 2, -h + neck, -neck / 2 - 0.5, -h + neck - 2);
    ctx.lineTo(-neck / 2 - 0.5, -h);
    ctx.lineTo(neck / 2 + 0.5, -h);
    ctx.lineTo(neck / 2 + 0.5, -h + neck - 2);
    ctx.quadraticCurveTo(w / 2, -h + neck, w / 2, -h + neck + 5);
    ctx.lineTo(w / 2, 0);
    ctx.closePath();
  };
  // milk (lower when the cream's been had)
  outline(); ctx.save(); ctx.clip();
  ctx.fillStyle = '#efe9db';                       // glass
  ctx.fillRect(-w / 2, -h, w, h);
  ctx.fillStyle = '#fbf8ef';                       // milk
  const milkTop = cream ? -h + 6 : -h * 0.62;
  ctx.fillRect(-w / 2, milkTop, w, h + milkTop + h);
  if (cream) {
    ctx.fillStyle = '#f0dfa8';                     // the creamy top
    ctx.fillRect(-w / 2, -h + 4, w, 7);
  }
  ctx.restore();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1.8;
  outline(); ctx.stroke();
  if (cream) {
    // gold foil cap
    ctx.fillStyle = '#d9a92c';
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, -h + 0.5, neck / 2 + 1.6, 2.4, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------ commuters
// Ordinary human commuters: blobby coats, small blank heads — everyone is
// silhouette and cloth, nobody is a face, nobody upstages a bird. The
// variant seed deterministically mixes age, build, skin tone, hair and
// head-covering (caps, headscarves, turbans, buns, afros, silver hair),
// and what they carry — so the crowd reads like an actual London platform.
// pose: 'walk' | 'stand' | 'ride' (escalators: feet together, still).
const SKIN = ['#8d5524', '#a3714a', '#c68642', '#d9a577', '#e8c39a', '#f0d5b8'];
const COATS = ['#4a5064', '#6b5a46', '#7c7a74', '#5a6652', '#7d5a68', '#4f6b74', '#877852', '#5b5b6e'];
const HAIRS = ['#2c2c30', '#4a3a28', '#6e4a33', '#23252c', '#d8d3c8'];
const CLOTHS = ['#a3573f', '#4f6b74', '#877852', '#7d5a68', '#5f7d6a', '#b0894a'];
export function drawCommuter(ctx, { x, y, size = 48, facing = 1, phase = 0, pose = 'walk', variant = 0, aid = null }) {
  const v = Math.abs(Math.floor(variant));
  const skin = SKIN[v % SKIN.length];
  const coat = COATS[(v * 5 + 1) % COATS.length];
  const cloth = CLOTHS[(v * 9 + 2) % CLOTHS.length];
  const child = v % 7 === 3;
  const elder = !child && v % 5 === 4;
  const hair = elder ? HAIRS[4] : HAIRS[(v * 3 + 2) % 4];
  const build = 0.88 + ((v * 13) % 5) * 0.08;          // slight..broad
  const height = child ? 0.68 : 0.9 + ((v * 11) % 4) * 0.06;
  const headgear = child ? (v % 2 ? 5 : 0) : (v * 7 + (v >> 3)) % 8;
  const item = elder ? 6 : child ? 7 : (v * 3 + 1) % 6;
  const s = size / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((facing < 0 ? -s : s) * build, s * height);
  ctx.translate(-50, -92);
  if (elder) { ctx.translate(50, 92); ctx.rotate(0.08); ctx.translate(-50, -92); }
  // legs — unless a wheelchair carries them
  const slowAid = aid === 'stick' || aid === 'case';
  const swing = pose === 'walk' ? Math.sin(phase) * (slowAid ? 0.22 : 0.42) : 0.05;
  ctx.strokeStyle = '#2c2c30';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  if (aid === 'wheelchair') {
    // seated: thighs forward, shins down to the footrest
    ctx.beginPath();
    ctx.moveTo(48, 60); ctx.lineTo(66, 62); ctx.lineTo(68, 78);
    ctx.stroke();
  } else {
    for (const [hx, sgn] of [[44, 1], [57, -1]]) {
      const a = pose === 'ride' ? 0 : swing * sgn;
      ctx.beginPath();
      ctx.moveTo(hx, 64);
      ctx.lineTo(hx + Math.sin(a) * 27, 64 + Math.cos(a) * 27);
      ctx.stroke();
    }
  }
  // gentle idle sway
  if (pose === 'stand') ctx.translate(Math.sin(phase * 0.7) * 1.2, 0);
  if (pose === 'walk') ctx.translate(0, Math.sin(phase * 2) * 1.1);
  // school backpack rides behind small shoulders
  if (item === 7) {
    ctx.fillStyle = cloth;
    ctx.beginPath(); ctx.roundRect(24, 36, 15, 22, 6); ctx.fill();
  }
  // long hair drapes behind the coat collar
  if (headgear === 7) {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.moveTo(44, 12); ctx.quadraticCurveTo(38, 24, 41, 40);
    ctx.lineTo(48, 38); ctx.quadraticCurveTo(45, 26, 48, 12);
    ctx.closePath(); ctx.fill();
  }
  // coat
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.moveTo(34, 68);
  ctx.quadraticCurveTo(29, 32, 50, 25);
  ctx.quadraticCurveTo(71, 32, 66, 68);
  ctx.quadraticCurveTo(50, 75, 34, 68);
  ctx.closePath(); ctx.fill();
  // blank head — never a face
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(52, 17, 9, 0, Math.PI * 2); ctx.fill();
  switch (headgear) {
    case 2: {   // flat cap
      ctx.fillStyle = '#33363d';
      ctx.beginPath(); ctx.arc(50.5, 13, 8.4, Math.PI * 0.95, Math.PI * 2.02); ctx.fill();
      ctx.fillRect(50, 9.5, 13, 2.6);
      break;
    }
    case 3: {   // headscarf, wrapped soft around the head
      ctx.fillStyle = cloth;
      ctx.beginPath(); ctx.arc(51, 16, 11.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(56, 24); ctx.quadraticCurveTo(60, 30, 57, 34); ctx.lineTo(50, 30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(56, 18, 6.2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 4: {   // turban, neatly stacked
      ctx.fillStyle = cloth;
      ctx.beginPath(); ctx.arc(52, 12, 8.6, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
      ctx.beginPath(); ctx.arc(52, 9, 6, Math.PI * 0.85, Math.PI * 2.15); ctx.fill();
      ctx.strokeStyle = 'rgba(38,34,30,0.35)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(44.5, 12); ctx.lineTo(59.5, 10); ctx.stroke();
      break;
    }
    case 5: {   // beanie with a fold
      ctx.fillStyle = cloth;
      ctx.beginPath(); ctx.arc(52, 13, 8.6, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
      ctx.fillRect(43.5, 13, 17, 3.4);
      break;
    }
    case 6: {   // hair in a bun
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(50.5, 13.5, 8.2, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
      ctx.beginPath(); ctx.arc(42, 12, 3.8, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 7:     // long hair (drape drawn earlier) — crown smudge
    default: {  // 0/1: plain hair smudge (afro-round on some heads)
      ctx.fillStyle = hair;
      const r = headgear === 0 && v % 3 === 0 ? 10 : 8.2;   // fuller crowns too
      ctx.beginPath(); ctx.arc(50.5, 13.5 - (r - 8.2) * 0.6, r, Math.PI * 0.92, Math.PI * 2.08); ctx.fill();
    }
  }
  // what they carry
  ctx.strokeStyle = coat;
  ctx.lineWidth = 4.5;
  if (item === 0) {          // phone
    ctx.beginPath(); ctx.moveTo(63, 46); ctx.lineTo(72, 34); ctx.stroke();
    ctx.fillStyle = '#2c2c30';
    ctx.save(); ctx.translate(73, 31); ctx.rotate(0.5); ctx.fillRect(-2.5, -5, 5, 10); ctx.restore();
  } else if (item === 1) {   // briefcase
    ctx.beginPath(); ctx.moveTo(64, 48); ctx.lineTo(67, 60); ctx.stroke();
    ctx.fillStyle = '#3d3428';
    ctx.fillRect(60, 60, 15, 11);
  } else if (item === 2) {   // brolly
    ctx.beginPath(); ctx.moveTo(63, 50); ctx.lineTo(71, 26); ctx.stroke();
    ctx.strokeStyle = '#2c2c30';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(71, 26, 7, Math.PI * 0.9, Math.PI * 1.9); ctx.stroke();
  } else if (item === 3) {   // tote bag
    ctx.beginPath(); ctx.moveTo(63, 44); ctx.lineTo(66, 58); ctx.stroke();
    ctx.fillStyle = cloth;
    ctx.fillRect(58, 57, 16, 15);
    ctx.strokeStyle = '#2c2c30'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(66, 57, 5, Math.PI, 0); ctx.stroke();
  } else if (item === 4) {   // coffee
    ctx.beginPath(); ctx.moveTo(63, 46); ctx.lineTo(71, 40); ctx.stroke();
    ctx.fillStyle = '#f7f2e6';
    ctx.fillRect(69, 33, 6.5, 8);
    ctx.fillStyle = cloth; ctx.fillRect(69, 36, 6.5, 2.4);
  } else if (item === 6) {   // walking stick
    ctx.strokeStyle = '#4a3a28';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(66, 48); ctx.lineTo(72, 90); ctx.stroke();
    ctx.beginPath(); ctx.arc(63, 48, 3.5, Math.PI * 1.4, Math.PI * 0.4, true); ctx.stroke();
  }                          // 5: hands in pockets
  // mobility: the aids that make steps and escalators someone else's luxury
  if (aid === 'stick') {
    ctx.strokeStyle = '#4a3a28';
    ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(67, 50); ctx.lineTo(74, 90); ctx.stroke();
    ctx.beginPath(); ctx.arc(64, 49, 3.5, Math.PI * 1.4, Math.PI * 0.4, true); ctx.stroke();
  } else if (aid === 'case') {
    // wheeled suitcase trailing on its telescopic handle
    ctx.strokeStyle = '#2c2c30';
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(36, 52); ctx.lineTo(22, 66); ctx.stroke();
    ctx.fillStyle = cloth;
    ctx.beginPath(); ctx.roundRect(10, 62, 17, 24, 3); ctx.fill();
    ctx.strokeRect(10, 62, 17, 24);
    ctx.fillStyle = '#2c2c30';
    ctx.beginPath(); ctx.arc(13, 89, 3.2, 0, Math.PI * 2); ctx.fill();
  } else if (aid === 'pram') {
    // the buggy goes ahead, precious cargo under the hood
    ctx.strokeStyle = '#2c2c30';
    ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.moveTo(66, 48); ctx.lineTo(78, 62); ctx.stroke();
    ctx.fillStyle = cloth;
    ctx.beginPath(); ctx.roundRect(74, 60, 24, 15, 5); ctx.fill();
    ctx.beginPath(); ctx.arc(94, 64, 9, Math.PI * 1.2, Math.PI * 1.9); ctx.fill();
    ctx.fillStyle = '#2c2c30';
    ctx.beginPath(); ctx.arc(79, 86, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(94, 86, 4.5, 0, Math.PI * 2); ctx.fill();
  } else if (aid === 'wheelchair') {
    // the chair: big spoked wheel, castor, seat and push-rim
    ctx.strokeStyle = '#2c2c30';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(50, 74, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.4;
    for (let k = 0; k < 4; k++) {
      const a2 = phase * 0.8 + k * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(50 - Math.cos(a2) * 14, 74 - Math.sin(a2) * 14);
      ctx.lineTo(50 + Math.cos(a2) * 14, 74 + Math.sin(a2) * 14);
      ctx.stroke();
    }
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(70, 86, 4.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40, 58); ctx.lineTo(48, 62); ctx.moveTo(64, 62); ctx.lineTo(70, 82); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------- X-ray passengers
// Glowing bones behind the lift glass: you always know who's aboard.
let REDUCED = false;
try { REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* headless */ }
function boneStyle(ctx, cyc = 0) {
  // Jet Set Willy attribute-cycling: the bones roll through the whole
  // palette behind the scanner glass, treasure-style. Under
  // prefers-reduced-motion they hold a calm pale ivory instead.
  if (REDUCED) {
    ctx.strokeStyle = 'rgba(230,242,255,0.95)';
    ctx.fillStyle = 'rgba(230,242,255,0.95)';
    ctx.shadowColor = 'rgba(150,195,255,0.75)';
  } else {
    const hue = ((cyc * 160) % 360 + 360) % 360;
    ctx.strokeStyle = `hsla(${hue}, 95%, 72%, 0.95)`;
    ctx.fillStyle = `hsla(${hue}, 95%, 72%, 0.95)`;
    ctx.shadowColor = `hsla(${hue}, 100%, 62%, 0.8)`;
  }
  ctx.shadowBlur = 5;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
}
export function drawCommuterSkeleton(ctx, x, y, aid = null, t = 0) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 2.2 + x) * 0.8);
  boneStyle(ctx, t + x * 0.04);   // each rider a beat apart in the rainbow
  ctx.beginPath(); ctx.arc(0, -34, 4.2, 0, Math.PI * 2); ctx.stroke();     // skull
  ctx.beginPath(); ctx.moveTo(0, -29); ctx.lineTo(0, -12); ctx.stroke();   // spine
  for (let i = 0; i < 3; i++) {                                             // ribs
    ctx.beginPath(); ctx.arc(0, -25 + i * 4, 4.6 - i * 0.7, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(-6, -16); ctx.moveTo(0, -26); ctx.lineTo(6, -16); ctx.stroke();
  if (aid === 'wheelchair') {
    ctx.beginPath(); ctx.arc(1, -6, 6.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(6, -9); ctx.lineTo(7, -3); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-3.5, 0); ctx.moveTo(0, -12); ctx.lineTo(3.5, 0); ctx.stroke();
    if (aid === 'stick') { ctx.beginPath(); ctx.moveTo(6, -16); ctx.lineTo(8.5, 0); ctx.stroke(); }
    else if (aid === 'case') ctx.strokeRect(-12, -10, 6.5, 10);
    else if (aid === 'pram') {
      ctx.strokeRect(6, -10, 9, 6);
      ctx.beginPath(); ctx.arc(8, -1.5, 2, 0, Math.PI * 2); ctx.arc(13.5, -1.5, 2, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}
export function drawBirdSkeleton(ctx, x, y, t = 0, scale = 1) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 3 + x) * 1);
  ctx.scale(scale, scale);
  boneStyle(ctx, t + x * 0.04);
  ctx.beginPath(); ctx.arc(5, -10, 3, 0, Math.PI * 2); ctx.stroke();       // skull
  ctx.beginPath(); ctx.moveTo(8, -10); ctx.lineTo(11.5, -9); ctx.stroke(); // beak
  ctx.beginPath(); ctx.moveTo(2.5, -8); ctx.quadraticCurveTo(-2, -7, -6, -4); ctx.stroke();
  for (const a of [-0.5, -0.15, 0.2]) {                                     // wing fan
    ctx.beginPath();
    ctx.moveTo(-1, -6);
    ctx.lineTo(-1 + Math.cos(2.4 + a) * 8, -6 + Math.sin(2.4 + a) * 8);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(-3, 0); ctx.moveTo(0.5, -3); ctx.lineTo(0.5, 0); ctx.stroke();
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
