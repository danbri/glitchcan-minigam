// ---------- the city map ----------
// Menu > City map: the districts, water, forest and highland seen from above (north up), the landmarks, and where
// you are and which way you face. Under it, the same in words (for a screen reader): your district, and each
// landmark's distance and compass direction. Tapping a landmark goes there.
const MAPCAM = { x: 0, z: 0, fx: 0, fz: -1, space: false };
// the view: centred between the city and the wild landmarks to its north, 6.8 km across
const MAP = { el: null, cv: null, base: null, cx: 650, cz: -1000, R: 3400, N: 220, timer: 0, centres: null };
const MAP_ZONE_COL = ["#c9a46a", "#e0569a", "#b98a5e", "#d0523c", "#7d7468", "#9aa3ad", "#6f5f86", "#5fa8a0"];
// landmarks: [name, x, z, place id to go to]
function mapMarks() {
  return [
    ["The Hive", HIVE_C[0], HIVE_C[1], "hive"],
    ["Assembly Hall", 3.5 * BIG, -3.5 * BIG, "hall_steps"],
    ["The ringed spire", (SPIRE_BLOCK[0] + 0.5) * BIG, (SPIRE_BLOCK[1] + 0.5) * BIG, "giant_0"],
    ["Lumen pyramid", (PYRAMID_CELL[0] + 0.5) * C, (PYRAMID_CELL[1] + 0.5) * C, "pyramid"],
    ["Pagoda of the Flame", (PAGODA_CELL[0] + 0.5) * C, (PAGODA_CELL[1] + 0.5) * C, "pagoda_3"],
    ["Spaceport", CITY_ARM[0] * 0.9, CITY_ARM[1] * 0.9, "spaceport_apron"],
    ["The stones", STONES_AT[0], STONES_AT[1], "stones"],
    ["The treehouse", TREEHOUSE_AT[0], TREEHOUSE_AT[1], "treehouse"],
  ];
}
// the ground, once: one sample per pixel, north (-z) up
function mapBase() {
  if (MAP.base) return MAP.base;
  const N = MAP.N, R = MAP.R, cv = document.createElement("canvas");
  cv.width = N; cv.height = N;
  const g = cv.getContext("2d"), img = g.createImageData(N, N), sum = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = MAP.cx - R + (i + 0.5) * 2 * R / N, z = MAP.cz - R + (j + 0.5) * 2 * R / N;
    const t = terrainAt(x, z);
    let col;
    if (t[1] > t[0] + 0.3) col = t[1] > 0.5 ? [34, 58, 84] : [52, 80, 104];
    else if (cityDist(x, z) < cityR(x, z)) {
      const zn = zoneAt(Math.floor(x / C), Math.floor(z / C));
      col = MAP_ZONE_COL[zn].match(/\w\w/g).map((h) => parseInt(h, 16));
      (sum[zn] = sum[zn] || [0, 0, 0])[0] += x; sum[zn][1] += z; sum[zn][2]++;
    } else {
      const h = Math.min(1, Math.max(0, t[0] / 400)), f = forestF(x, z) * 0.45;
      col = [(96 + 80 * h) * (1 - f) + 50 * f, (74 + 70 * h) * (1 - f) + 64 * f, (52 + 60 * h) * (1 - f) + 40 * f];
    }
    const k = (j * N + i) * 4;
    img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  MAP.centres = sum.map((s, zn) => (s ? [ZONE_NAMES[zn], s[0] / s[2], s[1] / s[2]] : null)).filter(Boolean);
  MAP.base = cv;
  return cv;
}
function mapCompass(dx, dz) {
  const b = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
  return ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][Math.round(b / 45) % 8];
}
function mapDist(d) { return d < 950 ? Math.round(d / 50) * 50 + " m" : (d / 1000).toFixed(1) + " km"; }
function mapDraw() {
  if (!MAP.el || MAP.el.hidden) return;
  const cv = MAP.cv, g = cv.getContext("2d"), W = cv.width, R = MAP.R;
  const px = (x) => (x - MAP.cx + R) / (2 * R) * W, pz = (z) => (z - MAP.cz + R) / (2 * R) * W;
  // labels: try above, below, right, left of the point, and skip one that would overlap a label already placed
  const placed = [];
  const label = (s, x, y, col) => {
    const w = g.measureText(s).width + 4, h = W / 30;
    for (const [ox, oy] of [[0, -h * 0.9], [0, h * 1.5], [w / 2 + h * 0.5, h * 0.35], [-w / 2 - h * 0.5, h * 0.35]]) {
      const r = [x + ox - w / 2, y + oy - h, w, h];
      if (r[0] < 0 || r[0] + w > W || r[1] < 0 || r[1] + h > W) continue;
      if (placed.some((q) => r[0] < q[0] + q[2] && q[0] < r[0] + w && r[1] < q[1] + q[3] && q[1] < r[1] + h)) continue;
      placed.push(r);
      g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(r[0], r[1] + h * 0.1, w, h);
      g.fillStyle = col; g.fillText(s, x + ox, y + oy - h * 0.18);
      return;
    }
  };
  g.imageSmoothingEnabled = false;
  g.drawImage(mapBase(), 0, 0, W, W);
  g.font = Math.round(W / 34) + "px system-ui, sans-serif";
  g.textAlign = "center";
  for (const [, x, z] of mapMarks()) {
    g.fillStyle = "#fff"; g.strokeStyle = "#000"; g.lineWidth = 2;
    g.beginPath(); g.arc(px(x), pz(z), W / 90, 0, 6.283); g.fill(); g.stroke();
  }
  // landmarks first (they matter more), then district names where there is room
  for (const [name, x, z] of mapMarks()) label(name, px(x), pz(z), "#ffe7b8");
  const marked = new Set(mapMarks().map((m) => m[0]));
  for (const [name, x, z] of MAP.centres) if (!marked.has(name)) label(name, px(x), pz(z) + W / 30, "rgba(255,255,255,0.8)");
  // you: an arrow the way you face
  if (!MAPCAM.space) {
    const x = px(MAPCAM.x), z = pz(MAPCAM.z), a = Math.atan2(MAPCAM.fz, MAPCAM.fx), s = W / 40;
    g.save(); g.translate(x, z); g.rotate(a);
    g.fillStyle = "#3cf"; g.strokeStyle = "#000"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(s, 0); g.lineTo(-s * 0.7, s * 0.6); g.lineTo(-s * 0.35, 0); g.lineTo(-s * 0.7, -s * 0.6); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  // the same in words
  const here = MAPCAM.space ? "You are in space." : "You are in " + placeName() + ".";
  const lines = mapMarks().map(([name, x, z]) => {
    const dx = x - MAPCAM.x, dz = z - MAPCAM.z;
    return [Math.hypot(dx, dz), name + ": " + mapDist(Math.hypot(dx, dz)) + " " + mapCompass(dx, dz)];
  }).sort((a, b) => a[0] - b[0]);
  const list = MAP.el.querySelector(".mapWords");
  const txt = here + "|" + lines.map((l) => l[1]).join("|");
  if (list.dataset.t !== txt) {
    list.dataset.t = txt;
    list.innerHTML = "";
    const p = document.createElement("p"); p.textContent = here; list.appendChild(p);
    const ul = document.createElement("ul");
    for (const [, s] of lines) { const li = document.createElement("li"); li.textContent = s; ul.appendChild(li); }
    list.appendChild(ul);
  }
}
function mapOpen() {
  if (!MAP.el) {
    const el = document.createElement("div");
    el.className = "mapPanel"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "City map");
    el.innerHTML = '<div class="mapHead"><span>City map</span><button type="button" class="mapClose" aria-label="Close the map">×</button></div><canvas aria-hidden="true"></canvas><div class="mapWords"></div>';
    document.body.appendChild(el);
    MAP.el = el; MAP.cv = el.querySelector("canvas");
    el.querySelector(".mapClose").addEventListener("click", mapClose);
    MAP.cv.addEventListener("click", (e) => {
      const r = MAP.cv.getBoundingClientRect(), R = MAP.R;
      const x = MAP.cx + (e.clientX - r.left) / r.width * 2 * R - R, z = MAP.cz + (e.clientY - r.top) / r.height * 2 * R - R;
      let best = null, bd = R * 0.05;
      for (const m of mapMarks()) { const d = Math.hypot(m[1] - x, m[2] - z); if (d < bd) { bd = d; best = m; } }
      if (best && placeById(best[3])) { mapClose(); hopPlace(best[3]); }
    });
  }
  const side = Math.min(innerWidth * 0.92, innerHeight * 0.62, 640);
  MAP.cv.width = MAP.cv.height = Math.round(side * Math.min(devicePixelRatio || 1, 2));
  MAP.cv.style.width = MAP.cv.style.height = Math.round(side) + "px";
  MAP.el.hidden = false;
  mapDraw();
  clearInterval(MAP.timer);
  MAP.timer = setInterval(mapDraw, 300);
  MAP.el.querySelector(".mapClose").focus();
}
function mapClose() { if (MAP.el) MAP.el.hidden = true; clearInterval(MAP.timer); }
