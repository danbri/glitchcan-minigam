// <novel-page>: a graphic-novel page of panels, with an ink window below it.
//
//   <novel-page width="1080" height="1520" zoom="1.6" margin="8" duration="1400"
//               easing="cubic-bezier(0.7,0,0.25,1)" knot="page">
//     <section points="26,26 1054,26 1054,448 26,490" knot="door" aria-label="...">  <img|video ...>  </section>
//     ...
//     <div slot="ink"></div>          text and choices go here
//   </novel-page>
//
// Each panel is any child with a points attribute: a polygon in page pixels. The panel is placed at the polygon's
// bounding box and clipped to it, so the gutters are whatever the polygons leave between them. Reading order is
// child order.
//
// Touch. Overview: a tap on a panel zooms to it, centred. Zoomed in: the other panels are frosted and faded; a tap
// goes back to the overview; a drag moves the page with the finger, and on release the page keeps its momentum and
// either springs back or crosses into the panel it was thrown towards, which then un-frosts and centres.
// Keys: Enter on a focused panel, arrows (reading order), Escape.
//
// API: zoomTo(i), overview(), next(), prev(), .current (-1 = overview), .panels, play(story).
// Event "panelchange", detail {index, previous, source: "tap" | "swipe" | "key" | "api" | "story"}.
//
// Ink: play(story) runs an inkjs Story (Story API only) into the ink slot. The view and the story stay in step both
// ways: a "# panel: X" tag (a panel's knot name, or 1-based number, 0 or "page" = overview) moves the view, and a move
// the reader makes (tap, swipe, key) diverts the story to that panel's knot attribute (the page's knot for the
// overview). Why it is built this way: drift-city skill, "Novel pages".

const CSS = `
:host { display: flex; flex-direction: column; position: relative; background: var(--novel-gutter, #0a0908);
  color: var(--novel-ink-text, #efe4c8); overflow: hidden; }
.view { position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden; touch-action: none; cursor: zoom-in; }
.view.zoomed { cursor: zoom-out; }
.page { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
.ink { flex: 0 0 auto; max-height: 45%; overflow: auto; touch-action: pan-y; }
::slotted(:focus-visible) { outline: 3px solid var(--novel-focus, #e0b36a); outline-offset: -3px; }
`;

// cubic-bezier(x1, y1, x2, y2) as a function of t, solved for x by Newton steps then bisection
const bezier = (x1, y1, x2, y2) => {
  const f = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  const df = (a, b, t) => 3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let k = 0; k < 6; k++) { const d = df(x1, x2, t); if (Math.abs(d) < 1e-6) break; t -= (f(x1, x2, t) - x) / d; }
    if (!(t >= 0 && t <= 1) || Math.abs(f(x1, x2, t) - x) > 1e-4) {
      let lo = 0, hi = 1; t = x;
      for (let k = 0; k < 30; k++) { t = (lo + hi) / 2; if (f(x1, x2, t) < x) lo = t; else hi = t; }
    }
    return f(y1, y2, t);
  };
};
const parseEase = (s) => {
  const m = /cubic-bezier\(([^)]*)\)/.exec(s || "");
  const v = m ? m[1].split(",").map(Number) : [0.7, 0, 0.25, 1];
  return v.length === 4 && v.every(Number.isFinite) ? bezier(...v) : bezier(0.7, 0, 0.25, 1);
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

class NovelPage extends HTMLElement {
  static get observedAttributes() { return ["width", "height", "duration", "easing", "margin", "zoom"]; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${CSS}</style><div class="view" part="view"><div class="page" part="page"><slot></slot></div></div>`
      + `<div class="ink" part="ink"><slot name="ink"></slot></div>`;
    this._view = root.querySelector(".view");
    this._page = root.querySelector(".page");
    // camera: (cx, cy) is the page point at the centre of the view, s the scale
    this._cam = { cx: 540, cy: 760, s: 1 };
    this._vel = { cx: 0, cy: 0, ls: 0 };
    this._anim = null; this._raf = 0; this._cur = -1; this._down = null; this._panels = []; this._story = null;
    root.querySelector("slot:not([name])").addEventListener("slotchange", () => this._layout());
    this._view.addEventListener("pointerdown", (e) => this._onDown(e));
    this._view.addEventListener("pointermove", (e) => this._onMove(e));
    this._view.addEventListener("pointerup", (e) => this._onUp(e));
    this._view.addEventListener("pointercancel", () => this._onCancel());
    this.addEventListener("keydown", (e) => this._onKey(e));
    // a resize (rotation, the ink window growing) re-aims a running move rather than cutting it short
    this._ro = new ResizeObserver(() => {
      if (this._anim) { this._anim.to = this._target(this._cur, this._anim.to); if (this._anim.kind === "tween") this._anim.from = { ...this._cam }, this._anim.t0 = null; }
      else if (!this._down) this._settle(this._cur, "keep");
      else this._apply();
    });
    this._vis = () => this._videos().forEach((v) => (document.hidden ? v.pause() : this._playVideo(v)));
    this._tick = (t) => this._frame(t);
  }

  connectedCallback() {
    this._ro.observe(this._view);
    document.addEventListener("visibilitychange", this._vis);
    this._layout();
  }

  disconnectedCallback() {
    this._ro.disconnect();
    document.removeEventListener("visibilitychange", this._vis);
    cancelAnimationFrame(this._raf); this._raf = 0;
  }

  attributeChangedCallback() { this._layout(); }

  get pageWidth() { return +this.getAttribute("width") || 1080; }
  get pageHeight() { return +this.getAttribute("height") || 1520; }
  get panels() { return this._panels.map((p) => p.el); }
  get current() { return this._cur; }

  zoomTo(i, source = "api") { if (i >= 0 && i < this._panels.length) this._goto(i, source); }
  overview(source = "api") { this._goto(-1, source); }
  next(source = "api") { if (this._cur >= 0 && this._cur < this._panels.length - 1) this._goto(this._cur + 1, source); }
  prev(source = "api") { if (this._cur > 0) this._goto(this._cur - 1, source); }

  // ---- ink ----

  play(story) {
    this._story = story;
    this._step();
  }

  _inkBox() {
    let box = this.querySelector('[slot="ink"]');
    if (!box) { box = document.createElement("div"); box.slot = "ink"; this.appendChild(box); }
    return box;
  }

  _knotOf(i) { return i >= 0 ? this._panels[i].el.getAttribute("knot") : this.getAttribute("knot"); }

  _panelByName(v) {
    v = String(v).trim();
    if (v === "0" || v === "page") return -1;
    if (/^\d+$/.test(v)) return +v - 1;
    return this._panels.findIndex((p) => p.el.getAttribute("knot") === v || p.el.id === v);
  }

  // Continue the story, show its text and choices, and follow its # panel: tags.
  _step() {
    const story = this._story;
    if (!story) return;
    const box = this._inkBox();
    box.textContent = "";
    let want = null;
    while (story.canContinue) {
      const line = story.Continue();
      for (const tag of story.currentTags || []) {
        const i = tag.indexOf(":");
        if (i > 0 && tag.slice(0, i).trim().toLowerCase() === "panel") want = this._panelByName(tag.slice(i + 1));
      }
      if (line.trim()) { const p = document.createElement("p"); p.textContent = line.trim(); box.appendChild(p); }
    }
    story.currentChoices.forEach((c, k) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "choice"; b.textContent = c.text;
      b.addEventListener("click", () => { story.ChooseChoiceIndex(k); this._step(); });
      box.appendChild(b);
    });
    box.scrollTop = 0;
    if (want !== null && want >= -1 && want < this._panels.length && want !== this._cur) this._goto(want, "story");
  }

  // The reader moved the view: take the story to that panel's knot, if it has one.
  _follow(i) {
    const knot = this._knotOf(i);
    if (!this._story || !knot) return;
    try { this._story.ChoosePathString(knot); } catch { return; } // no such knot: the story stays where it is
    this._step();
  }

  // ---- layout ----

  _layout() {
    if (!this.isConnected) return;
    const W = this.pageWidth, H = this.pageHeight;
    this._page.style.width = W + "px"; this._page.style.height = H + "px";
    this._ease = parseEase(this.getAttribute("easing"));
    const d = this.getAttribute("duration");
    this._dur = matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : (d ? parseFloat(d) * (/[^m]s\s*$/.test(d) ? 1000 : 1) : 1400);
    this._panels = [];
    for (const el of this.children) {
      const pts = el.getAttribute("points");
      if (!pts || el.slot) continue;
      const poly = pts.trim().split(/\s+/).map((p) => p.split(",").map(Number));
      const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
      const box = { x: Math.min(...xs), y: Math.min(...ys) };
      box.w = Math.max(...xs) - box.x; box.h = Math.max(...ys) - box.y;
      Object.assign(el.style, {
        position: "absolute", left: box.x + "px", top: box.y + "px", width: box.w + "px", height: box.h + "px",
        overflow: "hidden", boxSizing: "border-box",
        clipPath: "polygon(" + poly.map(([x, y]) => `${x - box.x}px ${y - box.y}px`).join(", ") + ")",
      });
      if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
      this._panels.push({ el, poly, box, frost: -1 });
    }
    if (this._cur >= this._panels.length) this._cur = -1;
    this._stop(); this._settle(this._cur, this._cur >= 0 ? "keep" : null);
  }

  _vw() { return this._view.clientWidth || 1; }
  _vh() { return this._view.clientHeight || 1; }
  _sOverview() { return Math.min(this._vw() / this.pageWidth, this._vh() / this.pageHeight); }

  // Where the camera may rest for panel i (-1 = overview): its scale and the range of view-centre points.
  _rest(i) {
    const vw = this._vw(), vh = this._vh(), ov = this._sOverview();
    if (i < 0) { const cx = this.pageWidth / 2, cy = this.pageHeight / 2; return { s: ov, x0: cx, x1: cx, y0: cy, y1: cy }; }
    const box = this._panels[i].box;
    const m = +(this.getAttribute("margin") ?? 8), zoom = +(this.getAttribute("zoom") ?? 1.6);
    const contain = Math.min((vw - 2 * m) / box.w, (vh - 2 * m) / box.h);
    const cover = Math.max((vw - 2 * m) / box.w, (vh - 2 * m) / box.h);
    const s = Math.max(contain, Math.min(ov * zoom, cover));
    const range = (lo, len, v) => {
      const a = lo - m / s + v / (2 * s), b = lo + len + m / s - v / (2 * s);
      return a > b ? [lo + len / 2, lo + len / 2] : [a, b];
    };
    const [x0, x1] = range(box.x, box.w, vw), [y0, y1] = range(box.y, box.h, vh);
    return { s, x0, x1, y0, y1 };
  }

  // The resting camera for panel i: centred, or the nearest rest to `near` (a camera) when the panel overflows.
  _target(i, near) {
    const r = this._rest(i);
    if (near) return { cx: clamp(near.cx, r.x0, r.x1), cy: clamp(near.cy, r.y0, r.y1), s: r.s };
    return { cx: (r.x0 + r.x1) / 2, cy: r.y0, s: r.s }; // centred across; the top of a tall panel first
  }

  _settle(i, how) {
    const t = this._target(i, how === "keep" ? this._cam : null);
    Object.assign(this._cam, t);
    this._view.classList.toggle("zoomed", i >= 0);
    this._apply();
  }

  _apply() {
    const { cx, cy, s } = this._cam, vw = this._vw(), vh = this._vh();
    this._page.style.transform = `translate(${vw / 2 - cx * s}px, ${vh / 2 - cy * s}px) scale(${s})`;
    this._frostAll();
  }

  // Frost and fade every panel by how far it is from the centre of the view, scaled by how far we are zoomed in.
  _frostAll() {
    const { cx, cy, s } = this._cam;
    const zoomed = smooth(0.1, 0.6, s / this._sOverview() - 1);
    const half = Math.min(this._vw(), this._vh()) / 2 / s;
    for (const p of this._panels) {
      const b = p.box;
      const dx = Math.max(b.x - cx, 0, cx - (b.x + b.w)), dy = Math.max(b.y - cy, 0, cy - (b.y + b.h));
      let f = zoomed * smooth(0.02, 0.75, Math.hypot(dx, dy) / half);
      f = Math.round(f * 40) / 40;
      if (f === p.frost) continue;
      p.frost = f;
      p.el.style.filter = f ? `blur(${((f * 6) / s).toFixed(1)}px) saturate(${(1 - 0.55 * f).toFixed(2)}) brightness(${(1 + 0.12 * f).toFixed(2)})` : "";
      p.el.style.opacity = f ? (1 - 0.6 * f).toFixed(2) : "";
    }
  }

  // ---- motion ----

  _stop() { this._anim = null; this._vel = { cx: 0, cy: 0, ls: 0 }; }

  _run(anim) {
    this._anim = anim; anim.t0 = null;
    if (!this._raf) this._raf = requestAnimationFrame(this._tick);
  }

  _frame(now) {
    this._raf = 0;
    const a = this._anim;
    if (!a) return;
    if (a.t0 === null) { a.t0 = now; a.last = now; }
    const c = this._cam;
    if (a.kind === "tween") {
      const u = clamp((now - a.t0) / a.dur, 0, 1), e = this._ease(u);
      c.cx = a.from.cx + (a.to.cx - a.from.cx) * e;
      c.cy = a.from.cy + (a.to.cy - a.from.cy) * e;
      // scale moves in log space; a flight dips out (zooms back) mid-way so the reader sees where they are going
      c.s = Math.exp(Math.log(a.from.s) + (Math.log(a.to.s) - Math.log(a.from.s)) * e - a.dip * Math.sin(Math.PI * e));
      this._apply();
      if (u >= 1) { this._anim = null; return; }
    } else {
      // a damped spring on each axis; slightly under-damped, so a throw can overshoot a little and come back
      const dt = Math.min(0.034, (now - a.last) / 1000);
      a.last = now;
      const w = a.omega, z = a.zeta, v = this._vel;
      const step = (x, xv, to) => { const acc = -w * w * (x - to) - 2 * z * w * xv; xv += acc * dt; return [x + xv * dt, xv]; };
      [c.cx, v.cx] = step(c.cx, v.cx, a.to.cx);
      [c.cy, v.cy] = step(c.cy, v.cy, a.to.cy);
      let ls; [ls, v.ls] = step(Math.log(c.s), v.ls, Math.log(a.to.s)); c.s = Math.exp(ls);
      this._apply();
      const px = c.s, still = Math.abs(c.cx - a.to.cx) * px < 0.3 && Math.abs(c.cy - a.to.cy) * px < 0.3
        && Math.abs(Math.log(c.s / a.to.s)) < 0.001 && Math.hypot(v.cx, v.cy) * px < 5;
      if (still) { Object.assign(c, a.to); this._apply(); this._stop(); return; }
    }
    this._raf = requestAnimationFrame(this._tick);
  }

  _tweenTo(to, dur, dip = 0) { this._stop(); this._run({ kind: "tween", from: { ...this._cam }, to, dur, dip }); }

  _springTo(to) { this._run({ kind: "spring", to, omega: 9, zeta: 0.78 }); }

  // Move to panel i. From the overview or to it: a straight zoom. Panel to panel: a flight that dips out in
  // proportion to the distance, so a jump across the page reads as travel, not a cut.
  _goto(i, source) {
    const prev = this._cur;
    const to = this._target(i);
    let dip = 0;
    if (prev >= 0 && i >= 0) {
      const d = Math.hypot(to.cx - this._cam.cx, to.cy - this._cam.cy) * Math.min(to.s, this._cam.s);
      dip = 0.45 * Math.log(1 + d / Math.min(this._vw(), this._vh()));
    }
    this._tweenTo(to, this._dur, dip);
    this._changed(i, prev, source);
  }

  _changed(i, prev, source) {
    this._view.classList.toggle("zoomed", i >= 0);
    if (i === prev) return;
    this._cur = i;
    this._panels.forEach((p, k) => p.el.toggleAttribute("data-current", k === i));
    if (i >= 0 && source !== "tap" && source !== "swipe" && document.activeElement !== this._panels[i].el) {
      this._panels[i].el.focus({ preventScroll: true });
    }
    this.dispatchEvent(new CustomEvent("panelchange", { detail: { index: i, previous: prev, source }, bubbles: true }));
    if (source !== "story") this._follow(i);
  }

  // ---- hit tests ----

  _toPage(clientX, clientY) {
    const r = this._view.getBoundingClientRect(), { cx, cy, s } = this._cam;
    return [(clientX - r.left - r.width / 2) / s + cx, (clientY - r.top - r.height / 2) / s + cy];
  }

  _inside(poly, px, py) {
    let inside = false;
    for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
      const [xa, ya] = poly[a], [xb, yb] = poly[b];
      if ((ya > py) !== (yb > py) && px < ((xb - xa) * (py - ya)) / (yb - ya) + xa) inside = !inside;
    }
    return inside;
  }

  // The panel under a page point; in a gutter, the nearest panel within `slack` page pixels (else -1).
  _panelAt(px, py, slack) {
    const i = this._panels.findIndex((p) => this._inside(p.poly, px, py));
    if (i >= 0 || !slack) return i;
    let best = -1, bd = slack;
    this._panels.forEach((p, k) => {
      for (let a = 0, b = p.poly.length - 1; a < p.poly.length; b = a++) {
        const [xa, ya] = p.poly[a], [xb, yb] = p.poly[b], ex = xb - xa, ey = yb - ya;
        const t = clamp(((px - xa) * ex + (py - ya) * ey) / (ex * ex + ey * ey || 1), 0, 1);
        const d = Math.hypot(px - xa - t * ex, py - ya - t * ey);
        if (d < bd) { bd = d; best = k; }
      }
    });
    return best;
  }

  // ---- input ----

  _onDown(e) {
    if (this._down) return;
    this._stop(); // a finger catches a moving page
    this._down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false,
      cam: { ...this._cam }, samples: [[performance.now(), e.clientX, e.clientY]] };
    try { this._view.setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer tracks */ }
  }

  _onMove(e) {
    const d = this._down;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 10) d.moved = true;
    if (!d.moved || this._cur < 0) return;
    const now = performance.now();
    d.samples.push([now, e.clientX, e.clientY]);
    while (d.samples.length > 2 && now - d.samples[0][0] > 100) d.samples.shift();
    // the page follows the finger one to one; there is no wall, the neighbours are right there
    this._cam.cx = d.cam.cx - dx / d.cam.s;
    this._cam.cy = d.cam.cy - dy / d.cam.s;
    this._apply();
  }

  _onUp(e) {
    const d = this._down;
    if (!d || e.pointerId !== d.id) return;
    this._down = null;
    if (!d.moved) {
      if (this._cur >= 0) this.overview("tap");
      else {
        const [px, py] = this._toPage(e.clientX, e.clientY);
        const i = this._panelAt(px, py, 40);
        if (i >= 0) this.zoomTo(i, "tap");
      }
      this._playVideos();
      return;
    }
    if (this._cur < 0) return;
    // release velocity, in page units per second, from the last tenth of a second of the drag
    const [t0, x0, y0] = d.samples[0], dt = Math.max(16, performance.now() - t0) / 1000, s = this._cam.s;
    const v = { cx: -(e.clientX - x0) / dt / s, cy: -(e.clientY - y0) / dt / s };
    // where the throw would carry the view centre; walk that path and take the first other panel it enters, if it
    // goes in far enough (12% of that panel's extent along the path). A weak throw that only reaches the gutter or
    // the neighbour's edge springs back.
    const proj = { cx: this._cam.cx + v.cx * 0.22, cy: this._cam.cy + v.cy * 0.22 };
    const ox = this._cam.cx, oy = this._cam.cy, ex = proj.cx - ox, ey = proj.cy - oy, len = Math.hypot(ex, ey);
    let k = this._cur, land = proj;
    for (let n = 1, entered = -1, t0 = 0; n <= 48 && len > 0; n++) {
      const t = n / 48, px = ox + ex * t, py = oy + ey * t, j = this._panelAt(px, py, 0);
      if (entered < 0) { if (j >= 0 && j !== this._cur) { entered = j; t0 = t; } continue; }
      const bx = this._panels[entered].box, extent = Math.abs(ex) / len * bx.w + Math.abs(ey) / len * bx.h;
      if ((t - t0) * len >= 0.12 * extent) { k = entered; land = { cx: px, cy: py }; break; }
      if (j !== entered) entered = -1;
    }
    if (k < 0) k = this._cur;
    this._vel = { cx: v.cx, cy: v.cy, ls: 0 };
    this._springTo(this._target(k, land));
    this._changed(k, this._cur, "swipe");
  }

  _onCancel() {
    if (!this._down) return;
    this._down = null;
    if (this._cur >= 0) this._springTo(this._target(this._cur, this._cam));
  }

  _onKey(e) {
    const i = this._panels.findIndex((p) => p.el === document.activeElement || p.el.contains(document.activeElement));
    if (e.key === "Escape" && this._cur >= 0) { this.overview("key"); e.preventDefault(); }
    else if ((e.key === "Enter" || e.key === " ") && i >= 0 && e.target === this._panels[i].el) {
      this._cur === i ? this.overview("key") : this.zoomTo(i, "key"); e.preventDefault();
    } else if (e.key === "ArrowRight" && this._cur >= 0) { this.next("key"); e.preventDefault(); }
    else if (e.key === "ArrowLeft" && this._cur >= 0) { this.prev("key"); e.preventDefault(); }
  }

  // ---- video ----

  _videos() { return [...this.querySelectorAll("video")]; }
  _playVideo(v) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
  // iOS can refuse autoplay until a gesture, so every tap tries again
  _playVideos() { if (!document.hidden) this._videos().forEach((v) => v.paused && this._playVideo(v)); }
}

customElements.define("novel-page", NovelPage);
export { NovelPage };
