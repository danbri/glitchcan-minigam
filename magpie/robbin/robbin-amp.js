// ROBBAMP 🐣 — a Winamp-classic tribute jukebox, buried in SETTINGS.
//
// Plays the whole tape library through an <audio> element (streams —
// no decoded-PCM cost) into the game's own WebAudio graph, entering at
// the Soundtrack's bus so the master mute rules it like everything
// else.
//
// FIVE visualizer looks, all in the game's own lino language — tap the
// visuals to change, ⛶ for fullscreen (a fixed overlay, so it works on
// iPhones where the Fullscreen API doesn't):
//   THE DIG      the buried wonders breathing bass under a fence of
//                bone bars with falling peak-hold knuckles
//   MURMURATION  a flock of ink birds swirling boids-fashion; the
//                music steers them, the kick scatters them
//   STRATA CORE  a scrolling log-frequency spectrogram laid down as
//                geological sediment — magnitude on ONE clay→bone
//                lightness ramp (never a rainbow), ochre only for the
//                hottest peaks, and each kick buries a small fossil
//                that scrolls away into history
//   ROUNDABOUT   a radial spectrum in the eleven line colours around
//                a slowly turning skeleton bird, peak dots orbiting
//   THE WIRE     the classic oscilloscope as a wobbling ink wire with
//                eggs riding it (they hop on the kick) and a wren
//                pecking along at the end
//
// Deep link: #robbamp opens the player; #robbamp=<track-slug> opens on
// that song (the hash follows along as tracks change, so the URL in
// the bar is always shareable).
import { drawBird, drawBirdSkeleton } from './robbin-sprites.js';
import { TubeFlock } from './robbin-tube.js';
import { NETWORK } from './tube-network.js';
import { RobbinJukebox } from './robbin-jukebox.js';

const fmt = s => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;
const pretty = stem => stem.replace(/-/g, ' ').toUpperCase();
const LINE_COLOURS = Object.values(NETWORK?.lines ?? {}).map(l => l?.color).filter(Boolean);
if (!LINE_COLOURS.length) LINE_COLOURS.push('#d94327', '#2e5e45', '#b98a2e', '#4f4a76', '#5a748c', '#8a5a44');

// magnitude ramp for the spectrogram: one hue family, light-by-loudness
// (dataviz rule: sequential = lightness, never a rainbow)
const STRATA_RAMP = ['#241c12', '#4d3d2c', '#6d5a3c', '#96805a', '#c0ac82', '#d8c8a4'];
const rampColour = v => {
  const f = Math.max(0, Math.min(0.999, v)) * (STRATA_RAMP.length - 1);
  return STRATA_RAMP[Math.round(f)];
};

const CSS = `
#ramp { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: min(94vw, 460px); z-index: 26; border: 2px solid #12140f;
  border-radius: 6px; background: #2a2f26; color: #f2ecdd;
  box-shadow: 0 12px 40px rgba(0,0,0,0.55); font-family: Georgia, serif;
  user-select: none; touch-action: manipulation; }
#ramp .rtitle { display: flex; align-items: center; gap: 8px; padding: 7px 10px;
  background: repeating-linear-gradient(90deg, #3c4434 0 3px, #262b20 3px 6px);
  border-bottom: 2px solid #12140f; font: 700 15px system-ui, sans-serif;
  letter-spacing: 0.1em; color: #d8c8a4; }
#ramp .rtitle span { flex: 1; }
#ramp .rtitle button { border: 1px solid #d8c8a4; border-radius: 3px;
  background: #1a1d16; color: #d8c8a4; font: 700 14px system-ui, sans-serif;
  width: 30px; height: 24px; line-height: 1; cursor: pointer; }
#ramp canvas { position: static; inset: auto; display: block; width: 100%;
  height: 170px; background: #1a1510; cursor: pointer; }
canvas.ramp-full { position: fixed; inset: 0; width: 100vw; height: 100vh;
  z-index: 40; background: #1a1510; cursor: pointer; }
.ramp-fx { display: none; position: fixed; z-index: 41;
  top: calc(10px + env(safe-area-inset-top)); right: calc(10px + env(safe-area-inset-right));
  border: 1px solid #d8c8a4; border-radius: 4px; background: rgba(26,29,22,0.8);
  color: #d8c8a4; font: 700 16px system-ui, sans-serif; width: 40px; height: 34px;
  cursor: pointer; }
#ramp .rlcd { display: flex; gap: 12px; align-items: center; padding: 7px 11px;
  background: #0f1a10; color: #9df29d; border-top: 2px solid #12140f;
  border-bottom: 2px solid #12140f; font: 17px "Courier New", monospace; }
#ramp .rtime { min-width: 112px; }
#ramp .rname { flex: 1; overflow: hidden; white-space: nowrap; }
#ramp .rname i { display: inline-block; font-style: normal; }
#ramp .rrow { display: flex; align-items: center; gap: 8px; padding: 9px 11px; }
#ramp .rrow button { border: 1px solid #d8c8a4; border-radius: 5px;
  background: #1a1d16; color: #f2ecdd; font-size: 17px; width: 46px; height: 36px;
  cursor: pointer; }
#ramp input[type=range] { flex: 1; accent-color: #7dc383; min-width: 40px;
  height: 26px; }
#ramp .rvol { max-width: 84px; }
#ramp .rlist { max-height: 30vh; overflow-y: auto; background: #20241d;
  font: 14px "Courier New", monospace; }
#ramp .rlist div { padding: 6px 12px; cursor: pointer; color: #cfd6c2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#ramp .rlist div:nth-child(odd) { background: #242920; }
#ramp .rlist div.on { color: #9df29d; background: #17301b; }
`;

export class RobbAmp {
  constructor(game) {
    this.g = game;
    this.open_ = false;
    this.raf = 0;
    this.seeking = false;
    this.full = false;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.MODES = ['THE DIG', 'MURMURATION', 'STRATA CORE', 'ROUNDABOUT', 'THE WIRE'];
    this.mode = Math.min(4, +(localStorage.getItem('robbin.ampviz') || 0));
    this.modeFlash = 3;
    this.hold = [];
    this.lastBass = 0;
    this.fossilCool = 0;
    // the record crate lives at the top of the screen — this window is
    // only a view over the <robbin-jukebox> element
    this.jb = RobbinJukebox.ensure(game);
    this.list = this.jb.list;
  }
  get i() { return this.jb.i; }
  build() {
    if (this.root) return;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const el = this.root = document.createElement('div');
    el.id = 'ramp';
    el.innerHTML = `
      <div class="rtitle"><span>ROBBAMP 🐣 · BURIED FREQUENCIES</span><button data-full aria-label="Fullscreen visuals">⛶</button><button data-x aria-label="Close player">✕</button></div>
      <canvas aria-label="Visualizer — tap to change the look"></canvas>
      <button class="ramp-fx" aria-label="Exit fullscreen">✕</button>
      <div class="rlcd"><span class="rtime">0:00 / 0:00</span><span class="rname"><i></i></span></div>
      <div class="rrow">
        <button data-prev aria-label="Previous">⏮</button>
        <button data-play aria-label="Play or pause">▶</button>
        <button data-stop aria-label="Stop — hand the music back to the game">⏹</button>
        <button data-next aria-label="Next">⏭</button>
        <input data-seek type="range" min="0" max="1000" value="0" aria-label="Seek">
        <input data-vol class="rvol" type="range" min="0" max="100" value="80" aria-label="Volume">
      </div>
      <div class="rlist" role="listbox" aria-label="Playlist"></div>`;
    document.body.appendChild(el);
    const listEl = el.querySelector('.rlist');
    this.list.forEach((tr, k) => {
      const row = document.createElement('div');
      row.textContent = `${String(k + 1).padStart(2, '0')}. ${tr.label}`;
      row.setAttribute('role', 'option');
      row.addEventListener('pointerdown', e => { e.stopPropagation(); this.jb.play(k); });
      listEl.appendChild(row);
    });
    el.querySelector('[data-x]').addEventListener('pointerdown', e => { e.stopPropagation(); this.close(); });
    el.querySelector('[data-full]').addEventListener('pointerdown', e => { e.stopPropagation(); this.toggleFull(); });
    this.fx = el.querySelector('.ramp-fx');
    this.fx.addEventListener('pointerdown', e => { e.stopPropagation(); this.toggleFull(); });
    el.querySelector('[data-play]').addEventListener('pointerdown', e => { e.stopPropagation(); this.jb.togglePlay(); });
    el.querySelector('[data-stop]').addEventListener('pointerdown', e => { e.stopPropagation(); this.jb.stop(); });
    el.querySelector('[data-prev]').addEventListener('pointerdown', e => { e.stopPropagation(); this.jb.prev(); });
    el.querySelector('[data-next]').addEventListener('pointerdown', e => { e.stopPropagation(); this.jb.next(); });
    const seek = el.querySelector('[data-seek]');
    seek.addEventListener('input', () => { this.seeking = true; });
    seek.addEventListener('change', () => {
      this.jb.seekTo(seek.value / 1000);
      this.seeking = false;
    });
    el.querySelector('[data-vol]').addEventListener('input', e => {
      this.jb.setVolume(e.target.value / 100);
    });
    // the jukebox is the truth; the window just reflects it
    addEventListener('jukebox-track', e => this.onTrack(e.detail));
    el.addEventListener('pointerdown', e => e.stopPropagation());   // taps stay in the player
    this.canvas = el.querySelector('canvas');
    this.canvas.addEventListener('pointerdown', e => {
      e.stopPropagation();
      this.cycleMode();
    });
    this.wonderIdx = Math.floor(Math.random() * 7);
    this.flyer = null;
  }
  cycleMode() {
    this.mode = (this.mode + 1) % this.MODES.length;
    localStorage.setItem('robbin.ampviz', String(this.mode));
    this.modeFlash = 2.4;
    this.g.haptics?.tick();
    this.g.say?.(`Visuals: ${this.MODES[this.mode]}.`);
  }
  toggleFull() {
    // #ramp is CSS-transformed, which re-anchors position:fixed children
    // to the window box instead of the viewport — so for fullscreen the
    // canvas (and the exit chip) step OUT to <body>, and step back in
    // front of the LCD on the way home
    this.full = !this.full;
    if (this.full) {
      document.body.append(this.canvas, this.fx);
      this.canvas.classList.add('ramp-full');
      this.fx.style.display = 'block';
    } else {
      this.canvas.classList.remove('ramp-full');
      const lcd = this.root.querySelector('.rlcd');
      this.root.insertBefore(this.canvas, lcd);
      this.root.insertBefore(this.fx, lcd);
      this.fx.style.display = 'none';
    }
    this.modeFlash = 2;
  }
  ensureAudio() {
    this.jb.ensureAudio();
    this.audio = this.jb.audio;
    this.analyser = this.jb.analyser;
    if (!this.bins) {
      this.bins = new Uint8Array(this.analyser.frequencyBinCount);
      this.wave = new Uint8Array(this.analyser.fftSize);
    }
  }
  /** the jukebox changed track (any view may have asked) — reflect it */
  onTrack({ index, track }) {
    this.wonderIdx = ((this.wonderIdx ?? 0) + 1) % 7;   // a new song digs up a new wonder
    this.marq = 0;
    if (!this.root) return;
    [...this.root.querySelectorAll('.rlist div')].forEach((d, j) => d.classList.toggle('on', j === index));
    this.root.querySelector('.rname i').textContent = ` ${track.label} · `.repeat(3);
    if (this.open_) this.setHash();
  }
  isOpen() { return this.open_; }
  toggle() { this.open_ ? this.close() : this.open(); }
  // #robbamp=<what> takes a track NUMBER (1-based, as printed in the
  // playlist), an exact slug, or any name substring — "#robbamp=3",
  // "#robbamp=gregorian" and "#robbamp=st-pauls-gregorians" all land
  // on the same song. The hash we WRITE stays the full slug.
  findTrack(q) { return this.jb.findTrack(q); }
  open(query) {
    this.build();
    this.ensureAudio();
    this.open_ = true;
    this.root.style.display = 'block';
    const want = this.jb.findTrack(query);
    if (want >= 0 && !(this.jb.engaged && this.jb.i === want)) this.jb.play(want);
    else if (!this.jb.engaged) this.jb.togglePlay();          // resume or start
    else this.onTrack({ index: this.jb.i, track: this.jb.current });
    this.setHash();
    this.tick();
    this.g.say?.('Robbamp. Every song in the game. Tap the visuals to change the look, the square button for fullscreen. Closing keeps the song playing — stop hands the music back to the game.');
  }
  close() {
    if (!this.open_) return false;
    if (this.full) { this.toggleFull(); return true; }   // first ESC folds the big screen
    this.open_ = false;
    cancelAnimationFrame(this.raf);
    if (this.root) this.root.style.display = 'none';
    if (location.hash.startsWith('#robbamp')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    // the WINDOW closes; the SONG plays on (that's the point — walk
    // back into the game with your track). Only if nothing is sounding
    // does the menu band take the stage back here.
    if (this.g.state === 'title' && !this.jb.engaged) {
      this.g.music.start();
      this.g.music.setIntensity(0.4);
    }
    return true;
  }
  setHash() {
    history.replaceState(null, '', `#robbamp=${encodeURIComponent(this.jb.current.slug)}`);
  }
  tick() {
    if (!this.open_) return;
    this.raf = requestAnimationFrame(() => this.tick());
    const a = this.audio;
    this.root.querySelector('.rtime').textContent = `${fmt(a.currentTime)} / ${fmt(a.duration)}`;
    this.root.querySelector('[data-play]').textContent = a.paused ? '▶' : '⏸';
    if (!this.seeking && a.duration) {
      this.root.querySelector('[data-seek]').value = Math.round((a.currentTime / a.duration) * 1000);
    }
    if (!this.reduced) {   // the LCD marquee ambles along
      this.marq = (this.marq || 0) + 0.6;
      const name = this.root.querySelector('.rname i');
      const w = name.offsetWidth / 3 || 1;
      name.style.transform = `translateX(${-(this.marq % w)}px)`;
    }
    this.drawViz();
  }
  // ------------------------------------------------------------ visuals
  drawViz() {
    const cv = this.canvas;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const W2 = cv.clientWidth || 420, H2 = cv.clientHeight || 170;
    if (cv.width !== Math.round(W2 * dpr) || cv.height !== Math.round(H2 * dpr)) {
      cv.width = Math.round(W2 * dpr); cv.height = Math.round(H2 * dpr);
      this.strata = null;                       // resolution changed: fresh core
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = performance.now() / 1000;
    this.analyser.getByteFrequencyData(this.bins);
    this.analyser.getByteTimeDomainData(this.wave);
    const band = (a, b) => {
      let s = 0;
      for (let i = a; i < b; i++) s += this.bins[i];
      return s / ((b - a) * 255);
    };
    const au = {
      bass: band(2, 24), mids: band(24, 140), treble: band(220, 420),
      kick: false, t,
    };
    au.kick = au.bass > 0.42 && au.bass > this.lastBass + 0.09;
    this.lastBass = this.lastBass * 0.8 + au.bass * 0.2;
    const mode = this.reduced ? 0 : this.mode;   // reduced motion keeps the still dig
    if (mode === 0) this.vDig(ctx, W2, H2, au);
    else if (mode === 1) this.vMurmuration(ctx, W2, H2, au);
    else if (mode === 2) this.vStrata(ctx, W2, H2, au);
    else if (mode === 3) this.vRoundabout(ctx, W2, H2, au);
    else this.vWire(ctx, W2, H2, au);
    if (this.modeFlash > 0) {
      this.modeFlash -= 1 / 60;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.modeFlash);
      ctx.font = `bold ${Math.max(18, Math.min(30, H2 * 0.12))}px Georgia, serif`;
      ctx.fillStyle = '#f2ecdd';
      ctx.strokeStyle = 'rgba(18,20,15,0.85)';
      ctx.lineWidth = 4;
      ctx.textAlign = 'left';
      ctx.strokeText(this.MODES[mode], 12, H2 - 14);
      ctx.fillText(this.MODES[mode], 12, H2 - 14);
      ctx.restore();
    }
  }
  // THE DIG — clay, wonders, bone spectrum with peak-hold knuckles
  vDig(ctx, W2, H2, au) {
    const { bass, mids, treble, t } = au;
    ctx.fillStyle = '#4d3d2c';
    ctx.fillRect(0, 0, W2, H2);
    ctx.strokeStyle = 'rgba(30,24,18,0.5)';
    ctx.lineWidth = 2;
    for (let y = H2 * 0.16; y < H2; y += H2 * 0.24) {
      ctx.beginPath();
      for (let x = 0; x <= W2; x += 20) {
        const yy = y + Math.sin(x * 0.06 + y) * (4 + mids * 6);
        x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(30,24,18,0.4)';
    for (let i = 0; i < 14; i++) {
      const sx = ((i * 173 + 37) % W2), sy = ((i * 97 + 23) % H2);
      ctx.beginPath(); ctx.ellipse(sx, sy, 4, 2.6, i, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save();
    ctx.translate(W2 * 0.82, -20);
    ctx.rotate(0.5);
    TubeFlock.prototype.buriedRiver.call(null, ctx, -40, this.reduced ? 0 : t * (0.5 + mids * 3));
    ctx.restore();
    this.drawWonder(ctx, W2 * 0.32, H2 * 0.5, au);
    // spectrum: bones with peak-hold knuckles that fall slowly
    const N = 26, bw = W2 / N;
    for (let i = 0; i < N; i++) {
      const v = this.bins[4 + Math.floor((i / N) * 300)] / 255;
      const h = 6 + v * (H2 * 0.42);
      this.hold[i] = Math.max((this.hold[i] || 0) - H2 * 0.004, h);
      const x = i * bw + bw / 2, y0 = H2 - 6;
      ctx.strokeStyle = this.reduced
        ? 'rgba(216,200,164,0.8)'
        : `hsla(${(t * 160 + i * 12) % 360}, 85%, ${58 + v * 20}%, 0.9)`;
      ctx.lineWidth = Math.max(2, bw * 0.28);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 - h); ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.beginPath();                      // the knuckle rides the peak-hold
      ctx.arc(x - 2.6, y0 - this.hold[i] - 2.4, 2.6, 0, Math.PI * 2);
      ctx.arc(x + 2.6, y0 - this.hold[i] - 2.4, 2.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawBirdSkeleton(ctx, W2 * 0.78, H2 * 0.42 + (this.reduced ? 0 : Math.sin(t * 6) * bass * 10), t, 1.1);
    if (!this.reduced) {
      if (!this.flyer && treble > 0.3) {
        this.flyer = { x: -30, y: 24 + Math.random() * (H2 * 0.3), sp: ['robin', 'bluetit', 'blackbird', 'wren'][Math.floor(Math.random() * 4)] };
      }
      if (this.flyer) {
        this.flyer.x += 3.2;
        drawBird(ctx, this.flyer.sp, { x: this.flyer.x, y: this.flyer.y + Math.sin(t * 9) * 3, size: 26, facing: 1, phase: t * 14, pose: 'airup' });
        if (this.flyer.x > W2 + 30) this.flyer = null;
      }
    }
  }
  drawWonder(ctx, x, y, au) {
    const P = TubeFlock.prototype;
    const wonders = [
      c => P.buriedBones.call(null, c, 0, 0, n => (this.wonderIdx * 7919 + 13) % n),
      c => P.buriedMammothUfo.call(null, c, -14, -6),
      c => P.buriedLongship.call(null, c, 0, 4),
      c => P.buriedRing.call(null, c, 0, 0),
      c => P.buriedAmmonite.call(null, c, 0, 0),
      c => P.buriedPteroBike.call(null, c, 0, -6),
      c => P.buriedBones.call(null, c, 0, 0, n => (this.wonderIdx * 104729 + 7) % n),
    ];
    ctx.save();
    ctx.translate(x, y);
    const pulse = this.reduced ? 1 : 1 + au.bass * 0.14;
    ctx.scale(pulse, pulse);
    ctx.globalAlpha = 0.55 + au.bass * 0.35;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    const hot = !this.reduced && au.bass > 0.5;
    ctx.strokeStyle = ctx.fillStyle = hot
      ? `hsla(${(au.t * 160) % 360}, 95%, 72%, 0.95)` : '#d8c8a4';
    wonders[this.wonderIdx % wonders.length](ctx);
    ctx.restore();
  }
  // MURMURATION — ink birds swirl; music steers, the kick scatters
  vMurmuration(ctx, W2, H2, au) {
    const { bass, mids, treble, kick, t } = au;
    if (!this.boids) {
      this.boids = Array.from({ length: 110 }, (_, i) => ({
        x: Math.random() * W2, y: Math.random() * H2,
        vx: Math.cos(i) * 30, vy: Math.sin(i) * 30,
      }));
    }
    ctx.fillStyle = '#f2ecdd';
    ctx.fillRect(0, 0, W2, H2);
    // a pale evening sun and the faintest thread of river
    ctx.fillStyle = 'rgba(185,138,46,0.16)';
    ctx.beginPath(); ctx.arc(W2 * 0.8, H2 * 0.3, H2 * 0.22 * (1 + bass * 0.2), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(146,183,205,0.35)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let x = 0; x <= W2; x += 24) {
      const y = H2 * 0.9 + Math.sin(x * 0.02 + 2) * 6;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    const B = this.boids, n = B.length;
    let cx = 0, cy = 0, avx = 0, avy = 0;
    for (const b of B) { cx += b.x; cy += b.y; avx += b.vx; avy += b.vy; }
    cx /= n; cy /= n; avx /= n; avy /= n;
    const speed = 42 + treble * 150 + mids * 60;
    const coh = 0.012 + mids * 0.05;
    for (let i = 0; i < n; i++) {
      const b = B[i];
      b.vx += (cx - b.x) * coh * 0.06 + (avx - b.vx) * 0.05;
      b.vy += (cy - b.y) * coh * 0.06 + (avy - b.vy) * 0.05;
      for (const j of [(i + 1) % n, (i + 13) % n]) {   // sampled separation
        const o = B[j], dx = b.x - o.x, dy = b.y - o.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < 400) { b.vx += dx * 0.02; b.vy += dy * 0.02; }
      }
      b.vx += Math.sin(t * 1.3 + i) * 0.6;             // wander
      b.vy += Math.cos(t * 1.1 + i * 1.7) * 0.6;
      if (kick) {                                       // the kick scatters
        const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy) || 1;
        b.vx += (dx / d) * 60; b.vy += (dy / d) * 60;
      }
      const v = Math.hypot(b.vx, b.vy) || 1;
      const cap = speed * (0.7 + ((i * 37) % 10) / 18);
      if (v > cap) { b.vx = (b.vx / v) * cap; b.vy = (b.vy / v) * cap; }
      b.x += b.vx / 60; b.y += b.vy / 60;
      if (b.x < -20) b.x = W2 + 18; if (b.x > W2 + 20) b.x = -18;
      if (b.y < -20) b.y = H2 + 18; if (b.y > H2 + 20) b.y = -18;
      // an ink chevron: body stroke + wing tick, flapping by phase
      const hx = b.vx / v, hy = b.vy / v;
      const flap = Math.sin(t * 12 + i) * 3;
      ctx.strokeStyle = 'rgba(38,34,30,0.85)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(b.x - hx * 5, b.y - hy * 5);
      ctx.lineTo(b.x + hx * 4, b.y + hy * 4);
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - hy * (4 + flap), b.y + hx * (4 + flap));
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + hy * (4 - flap), b.y - hx * (4 - flap));
      ctx.stroke();
    }
    for (let k = 0; k < 3; k++) {   // three full birds lead the wave
      const b = B[k * 31];
      drawBird(ctx, ['robin', 'bluetit', 'wren'][k], {
        x: b.x, y: b.y, size: 26, facing: b.vx >= 0 ? 1 : -1,
        phase: t * 12 + k, pose: 'airup',
      });
    }
  }
  // STRATA CORE — the song laid down as sediment (log-freq spectrogram)
  vStrata(ctx, W2, H2, au) {
    if (!this.strata) {
      this.strata = document.createElement('canvas');
      this.strata.width = Math.round(W2); this.strata.height = Math.round(H2);
      const sc = this.strata.getContext('2d');
      sc.fillStyle = STRATA_RAMP[0];
      sc.fillRect(0, 0, W2, H2);
    }
    const sc = this.strata.getContext('2d');
    const SP = 2;                       // scroll speed px/frame
    sc.drawImage(this.strata, -SP, 0);
    // the newest column: log-frequency, ONE lightness ramp for loudness
    const maxBin = 420, minBin = 2;
    for (let y = 0; y < H2; y += 2) {
      const frac = 1 - y / H2;          // low notes at the bottom, like strata
      const bin = Math.floor(minBin * Math.pow(maxBin / minBin, frac));
      const v = this.bins[Math.min(bin, this.bins.length - 1)] / 255;
      sc.fillStyle = v > 0.93 ? '#b98a2e' : rampColour(v);   // ochre = only the hottest
      sc.fillRect(W2 - SP, y, SP, 2);
    }
    // a kick buries a fossil at the face; it scrolls away into history
    this.fossilCool -= 1 / 60;
    if (au.kick && this.fossilCool <= 0) {
      this.fossilCool = 1.6;
      const P = TubeFlock.prototype;
      const small = [
        c => P.buriedRing.call(null, c, 0, 0),
        c => P.buriedAmmonite.call(null, c, 0, 0),
        c => P.buriedBones.call(null, c, 0, 0, n => (this.wonderIdx * 31 + 5) % n),
      ];
      sc.save();
      sc.translate(W2 - 30, H2 * (0.25 + ((this.wonderIdx * 53) % 50) / 100));
      sc.scale(0.4, 0.4);
      sc.globalAlpha = 0.85;
      sc.strokeStyle = sc.fillStyle = '#d8c8a4';
      sc.lineWidth = 4;
      sc.lineCap = 'round';
      small[this.wonderIdx % 3](sc);
      sc.restore();
      this.wonderIdx = (this.wonderIdx + 1) % 7;
    }
    ctx.drawImage(this.strata, 0, 0, W2, H2);
    // the reading face: a bone tick marking NOW
    ctx.strokeStyle = '#d8c8a4';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W2 - 2, 0); ctx.lineTo(W2 - 2, H2); ctx.stroke();
  }
  // ROUNDABOUT — radial spectrum in the line colours, skeleton at centre
  vRoundabout(ctx, W2, H2, au) {
    const { bass, t } = au;
    ctx.fillStyle = '#1d1a15';
    ctx.fillRect(0, 0, W2, H2);
    const cx = W2 / 2, cy = H2 / 2;
    const R0 = Math.min(W2, H2) * 0.17;
    const RMAX = Math.min(W2, H2) * 0.46 - R0;
    ctx.strokeStyle = 'rgba(216,200,164,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R0 - 6, 0, Math.PI * 2); ctx.stroke();
    const N = 44;
    if (!this.rhold || this.rhold.length !== N) this.rhold = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      const bin = Math.floor(2 * Math.pow(420 / 2, i / N));
      const v = this.bins[Math.min(bin, this.bins.length - 1)] / 255;
      const len = 4 + v * RMAX;
      this.rhold[i] = Math.max(this.rhold[i] - RMAX * 0.006, len);
      const a = (i / N) * Math.PI * 2 - Math.PI / 2 + (this.reduced ? 0 : t * 0.1);
      const colour = LINE_COLOURS[Math.floor((i / N) * LINE_COLOURS.length) % LINE_COLOURS.length];
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(3, (Math.PI * 2 * R0) / N * 0.55);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R0, cy + Math.sin(a) * R0);
      ctx.lineTo(cx + Math.cos(a) * (R0 + len), cy + Math.sin(a) * (R0 + len));
      ctx.stroke();
      ctx.fillStyle = '#f2ecdd';                     // the peak dot orbits out
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * (R0 + this.rhold[i] + 5), cy + Math.sin(a) * (R0 + this.rhold[i] + 5), 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(cx, cy);
    if (!this.reduced) ctx.rotate(Math.sin(t * 0.6) * 0.18);
    const pulse = this.reduced ? 1 : 1 + bass * 0.16;
    ctx.scale(pulse, pulse);
    drawBirdSkeleton(ctx, 0, 10, t, 1.25);
    ctx.restore();
  }
  // THE WIRE — the oscilloscope as an ink wire with eggs riding it
  vWire(ctx, W2, H2, au) {
    const { bass, kick, t } = au;
    ctx.fillStyle = '#f2ecdd';
    ctx.fillRect(0, 0, W2, H2);
    ctx.strokeStyle = 'rgba(38,34,30,0.08)';       // recessive rules
    ctx.lineWidth = 1;
    for (let y = H2 * 0.25; y < H2; y += H2 * 0.25) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W2, y); ctx.stroke();
    }
    const yM = H2 * 0.55, amp = H2 * 0.3;
    const wy = x => {
      const s = this.wave[Math.floor((x / W2) * (this.wave.length - 1))];
      return yM + ((s - 128) / 128) * amp;
    };
    // the wire itself: an ochre under-stroke then the ink line — lino
    for (const [colour, width, off] of [['rgba(185,138,46,0.5)', 4, 1.6], ['#26221e', 2.4, 0]]) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let x = 0; x <= W2; x += 4) {
        const y = wy(x) + off;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // seven eggs ride the wire and hop on the kick
    if (!this.eggs) this.eggs = Array.from({ length: 7 }, () => ({ dy: 0, vy: 0 }));
    this.eggs.forEach((egg, k) => {
      if (kick && !this.reduced) egg.vy = -3.4 - Math.random() * 2;
      egg.vy += 0.5; egg.dy += egg.vy;
      if (egg.dy > 0) { egg.dy = 0; egg.vy = 0; }
      const x = W2 * (0.16 + k * 0.115);
      const y = wy(x) + egg.dy - 6;
      const slope = (wy(x + 6) - wy(x - 6)) / 12;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan(slope) * 0.7);
      ctx.fillStyle = '#f7f2e6';
      ctx.strokeStyle = '#26221e';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(0, 0, 5.2, 6.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    });
    // the wren works the line, pecking when the bass bites
    const bx = W2 * 0.06;
    drawBird(ctx, 'wren', {
      x: bx, y: wy(bx) - 2, size: 34, facing: 1, phase: t * 5,
      pose: bass > 0.42 && !this.reduced ? 'peck' : 'stand',
    });
  }
}
