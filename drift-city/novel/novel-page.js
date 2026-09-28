// <novel-page>: a graphic-novel page of panels, with an ink window below it.
//
//   <novel-page width="1080" height="1520" duration="1400" easing="cubic-bezier(0.7,0,0.25,1)" zoom="1.6" margin="8">
//     <section points="26,26 1054,26 1054,448 26,490" aria-label="...">  <img|video ...>  </section>
//     ...
//     <div slot="ink"></div>          text and choices go here
//   </novel-page>
//
// Each panel is any child with a points attribute: a polygon in page pixels. The panel is placed at the polygon's
// bounding box and clipped to it, so the gutters are whatever the polygons leave between them (angled if you like).
// Panels are read in child order.
//
// Touch: in the overview, a tap on a panel zooms to it. Zoomed in, a drag pans a panel wider than the screen, a tap
// goes back to the overview, and a clear sideways swipe past the panel's edge goes to the next or previous panel. Keys: arrows, Enter, Escape.
// API: zoomTo(i), overview(), next(), prev(), .current (-1 in the overview), .panels, play(story).
// Event: "panelchange", detail {index, previous}.
// play(story) runs an inkjs Story into the ink slot; a "# panel: N" tag (1-based, 0 = overview) moves the page.
// Why it is built this way: drift-city skill, "Novel pages".

const CSS = `
:host { display: flex; flex-direction: column; position: relative; background: var(--novel-gutter, #0a0908);
  color: var(--novel-ink-text, #efe4c8); overflow: hidden; }
.view { position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden; touch-action: none; cursor: zoom-in; }
.view.zoomed { cursor: zoom-out; }
.page { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
.page.easing { transition: transform var(--t, 1400ms) var(--e, cubic-bezier(0.7, 0, 0.25, 1)); }
.ink { flex: 0 0 auto; max-height: 45%; overflow: auto; touch-action: pan-y; }
.ink:empty { display: none; }
::slotted(:focus-visible) { outline: 3px solid var(--novel-focus, #e0b36a); outline-offset: -3px; }
`;

class NovelPage extends HTMLElement {
  static get observedAttributes() { return ["width", "height", "duration", "easing", "margin", "zoom"]; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${CSS}</style><div class="view" part="view"><div class="page" part="page"><slot></slot></div></div>`
      + `<div class="ink" part="ink"><slot name="ink"></slot></div>`;
    this._view = root.querySelector(".view");
    this._page = root.querySelector(".page");
    this._s = 1; this._x = 0; this._y = 0; this._cur = -1; this._down = null;
    this._panels = [];
    root.querySelector("slot:not([name])").addEventListener("slotchange", () => this._layout());
    this._view.addEventListener("pointerdown", (e) => this._onDown(e));
    this._view.addEventListener("pointermove", (e) => this._onMove(e));
    this._view.addEventListener("pointerup", (e) => this._onUp(e));
    this._view.addEventListener("pointercancel", () => this._cancel());
    this.addEventListener("keydown", (e) => this._onKey(e));
    this._ro = new ResizeObserver(() => { this._ease(false); this._go(this._cur, "keep"); });
    this._vis = () => this._videos().forEach((v) => (document.hidden ? v.pause() : this._playVideo(v)));
  }

  connectedCallback() {
    this._ro.observe(this._view);
    document.addEventListener("visibilitychange", this._vis);
    this._layout();
  }

  disconnectedCallback() {
    this._ro.disconnect();
    document.removeEventListener("visibilitychange", this._vis);
  }

  attributeChangedCallback() { this._layout(); }

  get pageWidth() { return +this.getAttribute("width") || 1080; }
  get pageHeight() { return +this.getAttribute("height") || 1520; }
  get panels() { return this._panels.map((p) => p.el); }
  get current() { return this._cur; }

  zoomTo(i) { if (i >= 0 && i < this._panels.length) this._change(i, "start"); }
  overview() { this._change(-1); }
  next() { if (this._cur >= 0) this._change(Math.min(this._cur + 1, this._panels.length - 1), "start"); }
  prev() { if (this._cur >= 0) this._change(Math.max(this._cur - 1, 0), "end"); }

  // Runs an inkjs Story into the ink slot: text as paragraphs, choices as buttons. Uses the Story API only.
  play(story) {
    let box = this.querySelector('[slot="ink"]');
    if (!box) { box = document.createElement("div"); box.slot = "ink"; this.appendChild(box); }
    const step = () => {
      box.textContent = "";
      while (story.canContinue) {
        const line = story.Continue();
        for (const tag of story.currentTags || []) {
          const m = /^\s*panel\s*:\s*(\d+)\s*$/i.exec(tag);
          if (m) { const n = +m[1]; if (n === 0) this.overview(); else this.zoomTo(n - 1); }
        }
        if (line.trim()) { const p = document.createElement("p"); p.textContent = line.trim(); box.appendChild(p); }
      }
      story.currentChoices.forEach((c, i) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "choice"; b.textContent = c.text;
        b.addEventListener("click", () => { story.ChooseChoiceIndex(i); step(); });
        box.appendChild(b);
      });
      box.scrollTop = 0;
    };
    step();
  }

  // ---- layout ----

  _layout() {
    if (!this.isConnected) return;
    const W = this.pageWidth, H = this.pageHeight;
    this._page.style.width = W + "px"; this._page.style.height = H + "px";
    const t = this.getAttribute("duration"), e = this.getAttribute("easing");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this._page.style.setProperty("--t", reduce ? "1ms" : (t ? (/[a-z]/.test(t) ? t : t + "ms") : "1400ms"));
    if (e) this._page.style.setProperty("--e", e);
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
      this._panels.push({ el, poly, box });
    }
    if (this._cur >= this._panels.length) this._cur = -1;
    this._ease(false); this._go(this._cur, this._cur >= 0 ? "keep" : undefined);
  }

  // Scale and pan limits for the overview (i = -1) or for panel i. A zoomed panel is shown at least `zoom` times
  // the overview scale (default 1.6), so a wide panel on a phone overflows and is panned by dragging.
  _bounds(i) {
    const vw = this._view.clientWidth, vh = this._view.clientHeight, W = this.pageWidth, H = this.pageHeight;
    const ov = Math.min(vw / W, vh / H);
    const box = i >= 0 ? this._panels[i].box : null;
    if (!box) { const x = (vw - W * ov) / 2, y = (vh - H * ov) / 2; return { s: ov, minX: x, maxX: x, minY: y, maxY: y }; }
    const m = +(this.getAttribute("margin") ?? 8), zoom = +(this.getAttribute("zoom") ?? 1.6);
    const contain = Math.min((vw - 2 * m) / box.w, (vh - 2 * m) / box.h);
    const cover = Math.max((vw - 2 * m) / box.w, (vh - 2 * m) / box.h);
    const s = Math.max(contain, Math.min(ov * zoom, cover));
    const lim = (v, lo, len) => {
      const hi = m - lo * s, low = v - m - (lo + len) * s;
      return low > hi ? [(v - len * s) / 2 - lo * s, (v - len * s) / 2 - lo * s] : [low, hi];
    };
    const [minX, maxX] = lim(vw, box.x, box.w), [minY, maxY] = lim(vh, box.y, box.h);
    return { s, minX, maxX, minY, maxY };
  }

  // at: "start" (left, top), "end" (right, top), "keep" (current pan), {px, py} (centre on a page point), or centre
  _go(i, at) {
    const b = (this._b = this._bounds(i));
    const cl = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    let x = (b.minX + b.maxX) / 2, y = (b.minY + b.maxY) / 2;
    if (at === "start") { x = b.maxX; y = b.maxY; }
    else if (at === "end") { x = b.minX; y = b.maxY; }
    else if (at === "keep") { x = this._x; y = this._y; }
    else if (at && at.px != null) { x = this._view.clientWidth / 2 - at.px * b.s; y = this._view.clientHeight / 2 - at.py * b.s; }
    this._s = b.s; this._x = cl(x, b.minX, b.maxX); this._y = cl(y, b.minY, b.maxY);
    this._apply(this._x, this._y);
    this._view.classList.toggle("zoomed", i >= 0);
  }

  _apply(x, y) { this._page.style.transform = `translate(${x}px, ${y}px) scale(${this._s})`; }

  _ease(on) { this._page.classList.toggle("easing", on); }

  _change(i, at) {
    const prev = this._cur;
    this._ease(true);
    if (i === prev) { this._apply(this._x, this._y); return; }
    this._cur = i;
    this._go(i, at);
    this._panels.forEach((p, k) => p.el.toggleAttribute("data-current", k === i));
    if (i >= 0 && document.activeElement !== this._panels[i].el) this._panels[i].el.focus({ preventScroll: true });
    this.dispatchEvent(new CustomEvent("panelchange", { detail: { index: i, previous: prev }, bubbles: true }));
  }

  _hit(cx, cy) {
    const r = this._view.getBoundingClientRect();
    const px = (cx - r.left - this._x) / this._s, py = (cy - r.top - this._y) / this._s;
    return this._panels.findIndex(({ poly }) => {
      let inside = false;
      for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
        const [xa, ya] = poly[a], [xb, yb] = poly[b];
        if ((ya > py) !== (yb > py) && px < ((xb - xa) * (py - ya)) / (yb - ya) + xa) inside = !inside;
      }
      return inside;
    });
  }

  // ---- input ----

  _onDown(e) {
    if (this._down) return;
    this._down = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: this._x, y0: this._y, t: performance.now(), moved: false, over: 0 };
    try { this._view.setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer tracks */ }
  }

  // Zoomed in, a drag pans the panel. Past the panel's edge the page follows at half speed (the overscroll);
  // enough sideways overscroll at release is a swipe to the neighbouring panel.
  _onMove(e) {
    const d = this._down;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 10) { d.moved = true; this._ease(false); }
    if (!d.moved || this._cur < 0) return;
    const b = this._b, wx = d.x0 + dx, wy = d.y0 + dy;
    this._x = Math.min(b.maxX, Math.max(b.minX, wx)); this._y = Math.min(b.maxY, Math.max(b.minY, wy));
    d.over = wx - this._x;
    this._apply(this._x + d.over * 0.5, this._y + (wy - this._y) * 0.2);
  }

  _onUp(e) {
    const d = this._down;
    if (!d || e.pointerId !== d.id) return;
    this._down = null;
    if (!d.moved) {
      if (this._cur >= 0) this.overview();
      else {
        const i = this._hit(e.clientX, e.clientY);
        if (i >= 0) { const r = this._view.getBoundingClientRect(); this._change(i, { px: (e.clientX - r.left - this._x) / this._s, py: (e.clientY - r.top - this._y) / this._s }); }
      }
      this._playVideos();
      return;
    }
    if (this._cur < 0) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y, dt = Math.max(1, performance.now() - d.t), o = Math.abs(d.over);
    // a clear swipe: mostly sideways, and past the edge by a good way, or quickly
    const clear = Math.abs(dx) > 1.4 * Math.abs(dy) && (o > 60 || (o > 24 && Math.abs(dx) / dt > 0.5));
    if (clear && d.over < 0 && this._cur < this._panels.length - 1) this._change(this._cur + 1, "start");
    else if (clear && d.over > 0 && this._cur > 0) this._change(this._cur - 1, "end");
    else { this._ease(true); this._apply(this._x, this._y); }
  }

  _cancel() {
    if (!this._down) return;
    this._down = null;
    this._ease(true); this._apply(this._x, this._y);
  }

  _onKey(e) {
    const i = this._panels.findIndex((p) => p.el === document.activeElement || p.el.contains(document.activeElement));
    if (e.key === "Escape" && this._cur >= 0) { this.overview(); e.preventDefault(); }
    else if ((e.key === "Enter" || e.key === " ") && i >= 0 && e.target === this._panels[i].el) {
      this._cur === i ? this.overview() : this.zoomTo(i); e.preventDefault();
    } else if (e.key === "ArrowRight" && this._cur >= 0) { this.next(); e.preventDefault(); }
    else if (e.key === "ArrowLeft" && this._cur >= 0) { this.prev(); e.preventDefault(); }
  }

  // ---- video ----

  _videos() { return [...this.querySelectorAll("video")]; }
  _playVideo(v) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
  // iOS can refuse autoplay until a gesture, so every tap tries again
  _playVideos() { if (!document.hidden) this._videos().forEach((v) => v.paused && this._playVideo(v)); }
}

customElements.define("novel-page", NovelPage);
export { NovelPage };
