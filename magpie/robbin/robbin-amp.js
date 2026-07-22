// ROBBAMP 🐣 — a Winamp-classic tribute jukebox, buried in SETTINGS.
//
// Plays the whole tape library through an <audio> element (streams —
// no decoded-PCM cost) into the game's own WebAudio graph, entering at
// the Soundtrack's bus so the master mute rules it like everything
// else. The visualizer is an archaeology dig: the earth-edge wonders
// from TUBULAR SMELLS — the big bones, the mammoth skull with the
// dent-nosed saucer, the longship, the curious ring, the lost river,
// the ammonite, the fossil ptero-cyclist — REUSED straight off
// TubeFlock.prototype (they're pure ctx functions), pulsing to the
// bass under a spectrum of colour-cycling bone bars, with a skeleton
// bird bobbing along and a live one flitting across on treble peaks.
import { drawBird, drawBirdSkeleton } from './robbin-sprites.js';
import { TubeFlock } from './robbin-tube.js';

const fmt = s => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;
const pretty = stem => stem.replace(/-/g, ' ').toUpperCase();

const CSS = `
#ramp { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: min(94vw, 420px); z-index: 26; border: 2px solid #12140f;
  border-radius: 6px; background: #2a2f26; color: #f2ecdd;
  box-shadow: 0 12px 40px rgba(0,0,0,0.55); font-family: Georgia, serif;
  user-select: none; touch-action: manipulation; }
#ramp .rtitle { display: flex; align-items: center; gap: 8px; padding: 5px 8px;
  background: repeating-linear-gradient(90deg, #3c4434 0 3px, #262b20 3px 6px);
  border-bottom: 2px solid #12140f; font: 700 12px system-ui, sans-serif;
  letter-spacing: 0.12em; color: #d8c8a4; }
#ramp .rtitle span { flex: 1; }
#ramp .rtitle button { border: 1px solid #d8c8a4; border-radius: 3px;
  background: #1a1d16; color: #d8c8a4; font: 700 11px system-ui, sans-serif;
  width: 22px; height: 18px; line-height: 1; cursor: pointer; }
#ramp canvas { position: static; inset: auto; display: block; width: 100%; height: 150px; background: #1a1510; }
#ramp .rlcd { display: flex; gap: 10px; align-items: center; padding: 5px 9px;
  background: #0f1a10; color: #9df29d; border-top: 2px solid #12140f;
  border-bottom: 2px solid #12140f; font: 12px "Courier New", monospace; }
#ramp .rtime { min-width: 82px; }
#ramp .rname { flex: 1; overflow: hidden; white-space: nowrap; }
#ramp .rname i { display: inline-block; font-style: normal; }
#ramp .rrow { display: flex; align-items: center; gap: 7px; padding: 7px 9px; }
#ramp .rrow button { border: 1px solid #d8c8a4; border-radius: 4px;
  background: #1a1d16; color: #f2ecdd; font-size: 13px; width: 34px; height: 26px;
  cursor: pointer; }
#ramp input[type=range] { flex: 1; accent-color: #7dc383; min-width: 40px; }
#ramp .rvol { max-width: 76px; }
#ramp .rlist { max-height: 30vh; overflow-y: auto; background: #20241d;
  font: 11px "Courier New", monospace; }
#ramp .rlist div { padding: 4px 10px; cursor: pointer; color: #cfd6c2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#ramp .rlist div:nth-child(odd) { background: #242920; }
#ramp .rlist div.on { color: #9df29d; background: #17301b; }
`;

export class RobbAmp {
  constructor(game) {
    this.g = game;
    this.i = 0;
    this.open_ = false;
    this.raf = 0;
    this.seeking = false;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // the record crate: everything the tape library owns
    const st = game.soundtrack;
    this.list = Object.entries(st.urls).map(([name, url]) => {
      const stem = url.split('/').pop().replace(/\.mp3$/, '');
      let label = pretty(stem);
      if (name === 'engines') label += ' · THE MAP';
      if (name === 'passacaglia') label += ' · THE FLIGHT HOME';
      if (name.startsWith('st:')) label = `${name.slice(3)} · ${pretty(stem).split(' ').slice(name.slice(3).split(' ').length).join(' ')}`;
      return { name, url, label };
    });
  }
  build() {
    if (this.root) return;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const el = this.root = document.createElement('div');
    el.id = 'ramp';
    el.innerHTML = `
      <div class="rtitle"><span>ROBBAMP 🐣 · BURIED FREQUENCIES</span><button data-x aria-label="Close player">✕</button></div>
      <canvas aria-label="Buried-wonder visualizer"></canvas>
      <div class="rlcd"><span class="rtime">0:00 / 0:00</span><span class="rname"><i></i></span></div>
      <div class="rrow">
        <button data-prev aria-label="Previous">⏮</button>
        <button data-play aria-label="Play or pause">▶</button>
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
      row.addEventListener('pointerdown', e => { e.stopPropagation(); this.playAt(k); });
      listEl.appendChild(row);
    });
    el.querySelector('[data-x]').addEventListener('pointerdown', e => { e.stopPropagation(); this.close(); });
    el.querySelector('[data-play]').addEventListener('pointerdown', e => { e.stopPropagation(); this.togglePlay(); });
    el.querySelector('[data-prev]').addEventListener('pointerdown', e => { e.stopPropagation(); this.playAt((this.i + this.list.length - 1) % this.list.length); });
    el.querySelector('[data-next]').addEventListener('pointerdown', e => { e.stopPropagation(); this.playAt((this.i + 1) % this.list.length); });
    const seek = el.querySelector('[data-seek]');
    seek.addEventListener('input', () => { this.seeking = true; });
    seek.addEventListener('change', () => {
      if (this.audio.duration) this.audio.currentTime = (seek.value / 1000) * this.audio.duration;
      this.seeking = false;
    });
    el.querySelector('[data-vol]').addEventListener('input', e => {
      if (this.gain) this.gain.gain.value = e.target.value / 100;
    });
    el.addEventListener('pointerdown', e => e.stopPropagation());   // taps stay in the player
    this.canvas = el.querySelector('canvas');
    // dig site scenery is seeded once per opening
    this.wonderIdx = Math.floor(Math.random() * 7);
    this.wonderT = 0;
    this.flyer = null;
  }
  ensureAudio() {
    if (this.audio) return;
    const g = this.g;
    g.foley.ensure();
    g.soundtrack.ensureGraph();
    this.audio = new Audio();
    this.audio.loop = false;
    this.audio.addEventListener('ended', () => this.playAt((this.i + 1) % this.list.length));
    const ctx = g.foley.ctx;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0.8;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.bins = new Uint8Array(this.analyser.frequencyBinCount);
    // in at the Soundtrack's bus: the master mute rules the amp too
    ctx.createMediaElementSource(this.audio).connect(this.gain);
    this.gain.connect(this.analyser).connect(g.soundtrack.bus);
  }
  isOpen() { return this.open_; }
  toggle() { this.open_ ? this.close() : this.open(); }
  open() {
    this.build();
    this.ensureAudio();
    this.open_ = true;
    this.root.style.display = 'block';
    // the amp takes the stage from the menu band
    this.g.music.stop(0.5);
    this.g.soundtrack?.stop(0.8);
    this.g.midiScore?.stop(0.8);
    this.g.foley.ctx?.resume?.();
    if (!this.audio.src) this.playAt(0);
    else this.audio.play().catch(() => {});
    this.tick();
    this.g.say?.('Robbamp. A little buried jukebox — every song in the game. Escape closes it.');
  }
  close() {
    if (!this.open_) return false;
    this.open_ = false;
    this.audio?.pause();
    cancelAnimationFrame(this.raf);
    if (this.root) this.root.style.display = 'none';
    if (this.g.state === 'title') {   // hand the stage back to the band
      this.g.music.start();
      this.g.music.setIntensity(0.4);
    }
    return true;
  }
  playAt(k) {
    this.ensureAudio();
    this.i = k;
    const tr = this.list[k];
    this.audio.src = tr.url;
    this.audio.play().catch(() => {});
    this.wonderIdx = (this.wonderIdx + 1) % 7;   // each song digs up a new wonder
    this.marq = 0;
    [...this.root.querySelectorAll('.rlist div')].forEach((d, j) => d.classList.toggle('on', j === k));
    this.root.querySelector('.rname i').textContent = ` ${tr.label} · `.repeat(3);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: tr.label, artist: 'ROBBIN · TUBULAR SMELLS', album: 'ROBBAMP',
      });
    }
  }
  togglePlay() {
    this.ensureAudio();
    if (!this.audio.src) return this.playAt(0);
    this.audio.paused ? this.audio.play().catch(() => {}) : this.audio.pause();
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
  drawViz() {
    const cv = this.canvas;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const W2 = cv.clientWidth, H2 = 150;
    if (cv.width !== W2 * dpr) { cv.width = W2 * dpr; cv.height = H2 * dpr; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = performance.now() / 1000;
    this.analyser.getByteFrequencyData(this.bins);
    const band = (a, b) => {
      let s = 0;
      for (let i = a; i < b; i++) s += this.bins[i];
      return s / ((b - a) * 255);
    };
    const bass = band(1, 8), mids = band(8, 40), treble = band(60, 110);

    // London clay, strata, stones — the dig site
    ctx.fillStyle = '#4d3d2c';
    ctx.fillRect(0, 0, W2, H2);
    ctx.strokeStyle = 'rgba(30,24,18,0.5)';
    ctx.lineWidth = 2;
    for (let y = 26; y < H2; y += 38) {
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
    // the lost river slides across the back, hurried along by the mids
    ctx.save();
    ctx.translate(W2 * 0.82, -20);
    ctx.rotate(0.5);
    TubeFlock.prototype.buriedRiver.call(null, ctx, -40, this.reduced ? 0 : t * (0.5 + mids * 3));
    ctx.restore();

    // the wonder of the moment, half-buried mid-frame, breathing bass
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
    ctx.translate(W2 * 0.32, H2 * 0.5);
    const pulse = this.reduced ? 1 : 1 + bass * 0.14;
    ctx.scale(pulse, pulse);
    ctx.globalAlpha = 0.55 + bass * 0.35;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    const hot = !this.reduced && bass > 0.5;
    ctx.strokeStyle = ctx.fillStyle = hot
      ? `hsla(${(t * 160) % 360}, 95%, 72%, 0.95)` : '#d8c8a4';
    wonders[this.wonderIdx % wonders.length](ctx);
    ctx.restore();

    // the spectrum: a fence of little bones along the floor of the dig
    const N = 26, bw = W2 / N;
    for (let i = 0; i < N; i++) {
      const v = this.bins[2 + Math.floor((i / N) * 100)] / 255;
      const h = 6 + v * (H2 * 0.42);
      const x = i * bw + bw / 2, y0 = H2 - 6;
      ctx.strokeStyle = this.reduced
        ? 'rgba(216,200,164,0.8)'
        : `hsla(${(t * 160 + i * 12) % 360}, 85%, ${58 + v * 20}%, 0.9)`;
      ctx.lineWidth = Math.max(2, bw * 0.28);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 - h); ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.beginPath();                      // the knuckle on top: a bone, not a bar
      ctx.arc(x - 2.6, y0 - h - 2.4, 2.6, 0, Math.PI * 2);
      ctx.arc(x + 2.6, y0 - h - 2.4, 2.6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // a skeleton bird keeps time on the right; a live one flits across
    // whenever the treble kicks up
    drawBirdSkeleton(ctx, W2 * 0.78, H2 * 0.42 + (this.reduced ? 0 : Math.sin(t * 6) * bass * 10), t, 1.1);
    if (!this.reduced) {
      if (!this.flyer && treble > 0.38) {
        this.flyer = { x: -30, y: 24 + Math.random() * 40, sp: ['robin', 'bluetit', 'blackbird', 'wren'][Math.floor(Math.random() * 4)] };
      }
      if (this.flyer) {
        this.flyer.x += 3.2;
        drawBird(ctx, this.flyer.sp, { x: this.flyer.x, y: this.flyer.y + Math.sin(t * 9) * 3, size: 26, facing: 1, phase: t * 14, pose: 'airup' });
        if (this.flyer.x > W2 + 30) this.flyer = null;
      }
    }
  }
}
