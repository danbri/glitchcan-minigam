// ---------- long-press to go ----------
// Hold a finger (or the mouse) still on the view for half a second: the ray under it is followed into the city, the
// thing it meets is named (a skyboat, a landmark, a building, the land), and the camera flies there on a high arc
// while the city's clock runs fast, then settles into a composed view of it: lit from the side, seen low, set on a
// third of the frame, in focus. See the drift-city skill, "Long-press to go".
const PICK = { timer: 0, x: 0, y: 0, warp: 1, subject: null, ring: null };
const CAMNOW = { p: [0, 0, 0], f: [0, 0, -1], r: [1, 0, 0], up: [0, 1, 0] };

// the landmarks, with a centre, a radius for picking and framing, and a height
function pickLandmarks() {
  return [
    { name: "The Hive", x: HIVE_C[0], z: HIVE_C[1], r: 330, h: HIVE_H, blurb: "The cattle-class pod block, patched and hulking, where the dorms' sleepers live under their headsets." },
    { name: "The pod fab and its power beam", x: FAB_C[0], z: FAB_C[1], r: 110, h: FAB_H, blurb: "Where the Hive's capsules are made, fed by the white beam from the station in orbit." },
    { name: "The Assembly Hall", x: 3.5 * BIG, z: -3.5 * BIG, r: 95, h: 96, blurb: "The stone drum and glass dome where the city argues and votes." },
    { name: "The ringed spire", x: (SPIRE_BLOCK[0] + 0.5) * BIG, z: (SPIRE_BLOCK[1] + 0.5) * BIG, r: 80, h: 260, blurb: "The tallest thing in Lumen, with its ring." },
    { name: "The Lumen pyramid", x: (PYRAMID_CELL[0] + 0.5) * C, z: (PYRAMID_CELL[1] + 0.5) * C, r: 40, h: 83, blurb: "Glass and stone, stepped; Castellane's office is near the top." },
    { name: "The pagoda of the Flame", x: (PAGODA_CELL[0] + 0.5) * C, z: (PAGODA_CELL[1] + 0.5) * C, r: 26, h: 47, blurb: "One of the few places in the city where fire may burn." },
    { name: "The stones", x: STONES_AT[0], z: STONES_AT[1], r: 40, h: 12, blurb: "A ring of warm stones north of the city, where the fliers gather." },
    { name: "The treehouse", x: TREEHOUSE_AT[0], z: TREEHOUSE_AT[1], r: 40, h: 30, blurb: "Deep in the forest, lit." },
  ];
}
const SHIP_NAMES = ["cargo zeppelin", "skyboat", "balloon glider", "ad dirigible", "hover barge"];
// every airship is a Hindenburg (the first settlers' joke: with no oxygen in the air, nothing here burns); the newest
// is the 1632nd. One number per ship slot; gliders and barges are not airships and keep plain names.
const HINDENBURG_NO = [1632, 1417, 1598, 1203, 1611, 988, 1520, 1630];

// the ray under a point of the screen, from the camera as it was last drawn
function pickRay(px, py) {
  const W = innerWidth, H = innerHeight, ux = (2 * px - W) / H, uy = (H - 2 * py) / H, c = CAMNOW;
  return norm3([c.f[0] + (ux * c.r[0] + uy * c.up[0]) * 0.72, c.f[1] + (ux * c.r[1] + uy * c.up[1]) * 0.72, c.f[2] + (ux * c.r[2] + uy * c.up[2]) * 0.72]);
}
function pickAt(px, py) {
  const o = CAMNOW.p, d = pickRay(px, py);
  // a skyboat in the way?
  let best = null, bt = 1e9;
  for (let i = 0; i < 8; i++) {
    const s = EVN[147 + i * 4];
    if (!(s > 0)) continue;
    const c = [EVN[144 + i * 4], EVN[145 + i * 4], EVN[146 + i * 4]], oc = [o[0] - c[0], o[1] - c[1], o[2] - c[2]];
    const b = dot3(oc, d), h = b * b - (dot3(oc, oc) - s * s * 1.1);
    if (h > 0 && -b - Math.sqrt(h) > 0 && -b - Math.sqrt(h) < bt) {
      bt = -b - Math.sqrt(h);
      const kind = Math.round(EVN[179 + i * 4]);
      const airship = kind === 0 || kind === 1 || kind === 3;
      best = { name: airship ? "The Hindenburg " + HINDENBURG_NO[i] + ", a " + (SHIP_NAMES[kind] || "skyboat") : "A " + (SHIP_NAMES[kind] || "skyboat"), x: c[0], z: c[2], y0: c[1] - s * 0.3, r: s, h: s * 0.6, ship: i,
        blurb: airship ? "The first settlers named every airship Hindenburg, as a joke: with no oxygen in the air, nothing here can burn." : "Riding the thick air over the city." };
    }
  }
  // the Warmhouse bubble: a sphere in the air, so test it like a skyboat
  {
    const c = bubbleAt(clock), oc = [o[0] - c[0], o[1] - c[1], o[2] - c[2]];
    const b = dot3(oc, d), h = b * b - (dot3(oc, oc) - BUB_R * BUB_R);
    const tb = h > 0 ? (-b - Math.sqrt(h) > 0 ? -b - Math.sqrt(h) : -b + Math.sqrt(h)) : -1;
    if (tb > 0 && tb < bt) {
      bt = tb;
      best = { name: "The Warmhouse", x: c[0], z: c[2], y0: c[1] - BUB_R, r: BUB_R, h: BUB_R * 2, blurb: "A bubble of warm Earth air, 340 m across, that floats because it is lighter than Titan's air. Inside: houses, trees, bars and a jazz club." };
    }
  }
  // the city and the land: march the ray against their heights
  let hit = null;
  for (let t = 2; t < 4500;) {
    const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
    if (t > bt) break;
    const hg = heightAt(p[0], p[2], p[1]);
    if (p[1] < hg) { hit = p; hit.t = t; break; }
    t += Math.max(0.8, Math.min(40, (p[1] - hg) * 0.5, t * 0.02));
  }
  if (best && (!hit || bt < hit.t)) return best;
  if (!hit) return null;
  // a landmark near where it struck?
  for (const L of pickLandmarks()) {
    const dd = Math.hypot(hit[0] - L.x, hit[2] - L.z);
    if (dd < L.r) return { ...L, y0: Math.max(terrSurfAt(L.x, L.z), 0) };
  }
  const cx = Math.floor(hit[0] / C), cz = Math.floor(hit[2] / C), cell = cellAt(cx, cz);
  const street = streetName(cx * 131 + cz * 7);
  if (!cell.wild && cell.h > 6 && (cell.typ === 1 || cell.typ === 2 || cell.typ === 3 || cell.typ === 8 || cell.typ === 13)) {
    const zone = ZONE_NAMES[cell.zone];
    const what = cell.h > 90 ? "A tower" : cell.h > 40 ? "A block" : "A building";
    return { name: what + " on " + street + ", " + zone, x: (cx + 0.5) * C + cell.offx, z: (cz + 0.5) * C + cell.offz, y0: 0, r: Math.max(cell.wx, cell.wz) * 1.2, h: cell.top || cell.h, blurb: "" };
  }
  const place = cell.wild ? placeNameAt(hit[0], hit[2]) : street + ", " + ZONE_NAMES[cell.zone];
  return { name: place, x: hit[0], z: hit[2], y0: Math.max(terrSurfAt(hit[0], hit[2]), 0), r: 25, h: 8, blurb: "" };
}
function placeNameAt(x, z) {
  const t = terrainAt(x, z);
  if (t[1] > t[0]) return t[1] > 0.5 ? "Ligeia marsh" : "the shore of Kraken Mare";
  const w = biomeW(t[2], t[3]);
  return w.mnt > 0.5 ? "the Xanadu ice highlands" : forestF(x, z) > 0.5 ? "the forest" : "the open land";
}
// is the straight line from a to b clear of the city (short of the last `stop` metres)?
function pickClear(a, b, stop) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  for (let t = 6; t < L - stop; t += Math.max(4, t * 0.04)) {
    const k = t / L, x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k, z = a[2] + (b[2] - a[2]) * k;
    if (heightAt(x, z, y) > y - 2) return false;
  }
  return true;
}
// a composed view of a subject: a distance that fits it, low and lit from the side, a clear line, on a third
function pickCompose(S, sun) {
  const aspect = innerWidth / innerHeight, hf = 0.72, vf = hf * aspect;
  const size = Math.max(S.r * 2, S.h);
  const D = clampv(size / (0.62 * Math.min(1, aspect * 1.4)) * 0.7, 30, 1600);
  const aim = [S.x, S.y0 + S.h * 0.45, S.z];
  const cur = Math.atan2(CAMNOW.p[2] - S.z, CAMNOW.p[0] - S.x);
  const sunA = Math.atan2(sun[2], sun[0]);
  let best = null, bs = -1e9;
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2;
    const el = S.h > S.r * 1.5 ? 0.2 : 0.32;
    const pos = [S.x + Math.cos(a) * D * Math.cos(el), 0, S.z + Math.sin(a) * D * Math.cos(el)];
    pos[1] = Math.max(aim[1] + D * Math.sin(el), heightAt(pos[0], pos[2]) + 8, 6);
    // the view looks from pos toward the subject; the light should cross it at about 55 degrees
    const viewA = Math.atan2(S.z - pos[2], S.x - pos[0]);
    const side = Math.abs(Math.atan2(Math.sin(sunA - viewA), Math.cos(sunA - viewA)));
    let score = 1 - Math.abs(side - 0.96) / 1.6 + 0.35 * Math.cos(a - cur);
    if (!pickClear(pos, aim, S.r * 0.8)) score -= 3;
    if (score > bs) { bs = score; best = { pos, a }; }
  }
  const p = best.pos, dx = aim[0] - p[0], dz = aim[2] - p[2], dy = aim[1] - p[1];
  // the subject on a third of the frame (the side away from the light), and a little more sky above it
  const third = Math.atan(vf / 3);
  const yaw = Math.atan2(dz, dx) + third * (Math.sin(sunA - Math.atan2(dz, dx)) > 0 ? -1 : 1);
  const pitch = Math.atan2(dy, Math.hypot(dx, dz)) + 0.04;
  return { id: "pick", name: S.name, blurb: S.blurb || "", x: p[0], y: p[1], z: p[2], yaw, pitch, dist: Math.hypot(dx, dy, dz) };
}
// the ring and label where the finger is
function pickRing(px, py, text) {
  let r = PICK.ring;
  if (!document.body || !document.body.appendChild || !document.createElement("div").querySelector) return;
  if (!r) {
    r = document.createElement("div"); r.className = "pickRing"; r.setAttribute("role", "status");
    r.innerHTML = '<span class="pr"></span><span class="pl"></span>';
    document.body.appendChild(r); PICK.ring = r;
  }
  r.style.left = px + "px"; r.style.top = py + "px";
  r.querySelector(".pl").textContent = text;
  r.classList.remove("go"); void r.offsetWidth; r.classList.add("go");
}
// A long press names the thing under the finger and offers the flight; it never starts one by itself (a finger
// resting on the screen used to send the view off). `now` skips the offer (tests, the map); now = "walk" walks.
function pickGo(px, py, now) {
  if (NAV.mode === "space" || NAV.mode === "trip" || NAV.spaceMix > 0.05) return;
  // standing in a scene: a room offers only a walk across its floor; outside, a near thing offers a walk as well
  const V = NAV.mode === "visit" && NAV.visit && NAV.visit.t >= NAV.visit.T ? NAV.visit : null;
  const R = V && roomOf(V.to);
  if (R) {
    const o = CAMNOW.p, d = pickRay(px, py), fy = V.to.y - 1.7;
    if (d[1] > -0.02) { pickRing(px, py, "Press on the floor to walk there"); return; }
    const t = (fy - o[1]) / d[1];
    const S = { name: "Walk across the room", x: o[0] + d[0] * t, z: o[2] + d[2] * t, y0: fy, walkOnly: true };
    if (now) { visitWalkTo(V, S.x, S.z); return; }
    pickOffer(S, px, py); return;
  }
  const S = pickAt(px, py);
  if (S && V && Math.hypot(S.x - st.x, S.z - st.z) < 450 && S.ship === undefined && S.name !== "The Warmhouse") S.walk = true;
  if (!S) { pickRing(px, py, "Nothing there"); return; }
  if (S.y0 === undefined) S.y0 = 0;
  // the simpler (WebGL) city has no visits: name it, but stay
  if (!GPUREF.device) { pickRing(px, py, S.name); return; }
  if (now) { if (S.walk && now === "walk") visitWalkTo(V, S.x, S.z); else pickLaunch(S); return; }
  pickOffer(S, px, py);
}
function pickLaunch(S, quiet) {
  pickOfferClose();
  const tod = currentTod(), V = pickCompose(S, tod.sun);
  const from = { x: st.x, y: st.y, z: st.z, yaw: st.yaw, pitch: st.pitch };
  const far = Math.hypot(V.x - from.x, V.z - from.z);
  tourHold(); NAV.trip = null; NAV.free = null; NAV.cam = null; NAV.spaceMix = 0;
  NAV.visit = { from, to: V, t: 0, T: clampv(3 + far / 180, 4, 14), ly: 0, lp: 0, look: [S.x, S.y0 + S.h * 0.45, S.z], subject: V };
  NAV.mode = "visit";
  PICK.subject = V;
  if (!quiet) showHint(S.name + (S.blurb ? ". " + S.blurb : ""), 7000);
  if (typeof syncGoLabel === "function") syncGoLabel();
}
// the offer: a small card by the finger with the name, "Fly there" and a close button
function pickOffer(S, px, py) {
  if (!document.body || !document.body.appendChild || !document.createElement("div").querySelector) return;
  let c = PICK.card;
  if (!c) {
    c = document.createElement("div"); c.className = "pickCard"; c.setAttribute("role", "dialog"); c.setAttribute("aria-label", "Picked");
    c.innerHTML = '<span class="pn"></span><span class="pb"><button type="button" class="pwk">Walk there</button><button type="button" class="pgo">Fly there</button><button type="button" class="px" aria-label="Close">\u00d7</button></span>';
    document.body.appendChild(c); PICK.card = c;
    c.querySelector(".pgo").addEventListener("click", (e) => { e.stopPropagation(); if (PICK.offer) pickLaunch(PICK.offer); });
    c.querySelector(".pwk").addEventListener("click", (e) => {
      e.stopPropagation();
      const S = PICK.offer, V = NAV.visit;
      pickOfferClose();
      if (S && V && NAV.mode === "visit" && !visitWalkTo(V, S.x, S.z)) showHint("You are there.", 1500);
    });
    c.querySelector(".px").addEventListener("click", (e) => { e.stopPropagation(); pickOfferClose(); });
  }
  PICK.offer = S;
  c.querySelector(".pn").textContent = S.name;
  c.querySelector(".pwk").hidden = !(S.walk || S.walkOnly);
  c.querySelector(".pgo").hidden = !!S.walkOnly;
  c.hidden = false;
  const w = Math.min(300, innerWidth - 32);
  c.style.left = clampv(px - w / 2, 16, innerWidth - 16 - w) + "px";
  c.style.top = clampv(py - 120, 16, innerHeight - 140) + "px";
  c.style.width = w + "px";
  c.querySelector(".pgo").focus({ preventScroll: true });
}
function pickOfferClose() { PICK.offer = null; if (PICK.card) PICK.card.hidden = true; }
// while flying there: the city's clock runs up to eight times as fast, easing in and out
function pickWarp() {
  const V = NAV.visit;
  if (NAV.mode !== "visit" || !V || !V.look || V.t >= V.T) { PICK.warp += (1 - PICK.warp) * 0.1; return PICK.warp; }
  const e = V.t / V.T;
  PICK.warp = 1 + 7 * Math.sin(Math.PI * Math.min(1, e * 1.15));
  return PICK.warp;
}
function pickInit(canvas) {
  const cancel = () => { clearTimeout(PICK.timer); PICK.timer = 0; };
  canvas.addEventListener("pointerdown", (e) => {
    cancel();
    pickOfferClose();
    PICK.x = e.clientX; PICK.y = e.clientY;
    PICK.timer = setTimeout(() => {
      PICK.timer = 0;
      if (touches.size > 1) return;
      pointer.down = false;
      // a long press interrupts a guided tour (a brief touch or a drag only turns the view)
      if (typeof GUIDE !== "undefined" && GUIDE.on) guidePause();
      if (navigator.vibrate) navigator.vibrate(12);
      pickGo(PICK.x, PICK.y, false);
    }, 650);
  });
  canvas.addEventListener("pointermove", (e) => { if (PICK.timer && Math.hypot(e.clientX - PICK.x, e.clientY - PICK.y) > 10) cancel(); });
  canvas.addEventListener("pointerup", cancel);
  canvas.addEventListener("pointercancel", cancel);
}
