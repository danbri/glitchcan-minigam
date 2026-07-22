// ROBBAMP 🐣 — a Winamp-classic tribute jukebox, buried in SETTINGS.
//
// Plays the whole tape library through an <audio> element (streams —
// no decoded-PCM cost) into the game's own WebAudio graph, entering at
// the Soundtrack's bus so the master mute rules it like everything
// else.
//
// EIGHT visualizer looks, all in the game's own lino language — tap
// the visuals to change, ⛶ for fullscreen (a fixed overlay, so it
// works on iPhones where the Fullscreen API doesn't):
//   THE DIG      the buried wonders breathing bass under a fence of
//                bone bars with falling peak-hold knuckles
//   MURMURATION  a moonlit flock on TRUE boids (grid neighbourhoods,
//                trails); the music steers, a hawk stoops on the kick
//   STRATA CORE  a scrolling log-frequency spectrogram laid down as
//                geological sediment — magnitude on ONE clay→bone
//                lightness ramp (never a rainbow), ochre only for the
//                hottest peaks, and each kick buries a small fossil
//                that scrolls away into history
//   ROUNDABOUT   a radial spectrum in the eleven line colours around
//                a slowly turning skeleton bird, peak dots orbiting
//   THE WIRE     the classic oscilloscope, phosphor-green on black,
//                as a wobbling wire with eggs riding it (they hop on
//                the kick) and a wren pecking along at the end
//   GOLDFEATHER  the Bond title sequence: a rifled gun-barrel iris, a
//                strutting robin silhouette, orbiting quills, and the
//                red curtain falling on the big kick
//   ATTIC 1984   the Jet Set Willy nod: tape-loading border, brick
//                towers that ARE the spectrum, colour-cycling
//                treasures, a guardian on patrol, a bird hopping the
//                platforms on the kick
//   NIGHT TRAIN  the whole journey 100×: parallax London under the
//                stars, a cut-paper train on the viaduct, every
//                carriage window lit by its own slice of the spectrum
//
// Deep link: #robbamp opens the player; #robbamp=<track-slug> opens on
// that song (the hash follows along as tracks change, so the URL in
// the bar is always shareable).
import { drawBird, drawBirdSkeleton, drawCommuter } from './robbin-sprites.js';
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
    this.MODES = ['THE DIG', 'MURMURATION', 'STRATA CORE', 'ROUNDABOUT', 'THE WIRE',
      'GOLDFEATHER', 'ATTIC 1984', 'NIGHT TRAIN', 'A SERIES OF TUBES',
      'GAUSSIAN SPLATS', 'AVIARY 3D', 'ROLL THE CREDITS'];
    // fresh eyes land on the dark neon network; a saved choice is kept
    const savedMode = localStorage.getItem('robbin.ampviz');
    this.mode = savedMode == null ? 8 : Math.min(this.MODES.length - 1, +savedMode);
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
    if (this.g.state === 'paused') this.g.state = 'play';   // Konami mid-arcade
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
    else if (mode === 4) this.vWire(ctx, W2, H2, au);
    else if (mode === 5) this.vGoldfeather(ctx, W2, H2, au);
    else if (mode === 6) this.vAttic(ctx, W2, H2, au);
    else if (mode === 7) this.vNightTrain(ctx, W2, H2, au);
    else if (mode === 8) this.vPipes(ctx, W2, H2, au);
    else if (mode === 9) this.vSplats(ctx, W2, H2, au);
    else if (mode === 10) this.vAviary(ctx, W2, H2, au);
    else this.vCredits(ctx, W2, H2, au);
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
  // MURMURATION — moonlit now, and properly BOIDSY: real neighbourhoods
  // on a spatial grid (separation / alignment / cohesion), motion
  // trails, and a hawk that stoops on the kick and scatters the flock
  // the way real starlings scatter — locally, in a travelling wave
  vMurmuration(ctx, W2, H2, au) {
    const { bass, mids, treble, kick, t } = au;
    const N = 170;
    if (!this.boids || this.boids.length !== N) {
      this.boids = Array.from({ length: N }, (_, i) => ({
        x: Math.random() * W2, y: Math.random() * H2,
        vx: Math.cos(i) * 30, vy: Math.sin(i) * 30,
      }));
      this.murmSized = null;
    }
    // trails: fade the night rather than wipe it
    if (this.murmSized !== `${W2}x${H2}`) {
      this.murmSized = `${W2}x${H2}`;
      ctx.fillStyle = '#0d0f14';
      ctx.fillRect(0, 0, W2, H2);
    }
    ctx.fillStyle = 'rgba(13,15,20,0.3)';
    ctx.fillRect(0, 0, W2, H2);
    // a paper moon and dim stars
    for (let i = 0; i < 18; i++) {
      const sx2 = ((i * 173 + 29) % W2), sy = ((i * 101 + 13) % Math.round(H2 * 0.6));
      ctx.fillStyle = `rgba(220,228,244,${0.1 + 0.2 * Math.abs(Math.sin(t + i)) * (0.4 + treble)})`;
      ctx.fillRect(sx2, sy, 2, 2);
    }
    ctx.fillStyle = 'rgba(238,240,246,0.75)';
    ctx.beginPath(); ctx.arc(W2 * 0.82, H2 * 0.24, H2 * 0.11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0d0f14';
    ctx.beginPath(); ctx.arc(W2 * 0.85, H2 * 0.225, H2 * 0.095, 0, Math.PI * 2); ctx.fill();
    // the hawk stoops on the kick, aiming through the flock's heart
    const B = this.boids, n = B.length;
    let cx = 0, cy = 0;
    for (const b of B) { cx += b.x; cy += b.y; }
    cx /= n; cy /= n;
    if (kick && !this.hawk) {
      const side = Math.random() < 0.5 ? -30 : W2 + 30;
      const a = Math.atan2(cy - H2 * 0.1, cx - side);
      this.hawk = { x: side, y: H2 * 0.1, vx: Math.cos(a) * 6.4, vy: Math.sin(a) * 6.4 };
    }
    if (this.hawk) {
      const hk = this.hawk;
      hk.x += hk.vx; hk.y += hk.vy;
      drawBird(ctx, 'blackbird', { x: hk.x, y: hk.y, size: 40,
        facing: hk.vx >= 0 ? 1 : -1, phase: t * 7, pose: 'airdown' });
      if (hk.x < -60 || hk.x > W2 + 60 || hk.y > H2 + 60) this.hawk = null;
    }
    // true boids: bucket the sky, then steer by ACTUAL neighbours
    const cell = 42;
    const cols = Math.max(1, Math.ceil(W2 / cell));
    const grid = new Map();
    B.forEach((b, i) => {
      const k2 = Math.floor(b.y / cell) * cols + Math.floor(b.x / cell);
      (grid.get(k2) ?? grid.set(k2, []).get(k2)).push(i);
    });
    const speed = 46 + treble * 150 + mids * 70;
    const alignW = 0.06 + mids * 0.09;
    const cohW = 0.004 + mids * 0.012;
    for (let i = 0; i < n; i++) {
      const b = B[i];
      const gx = Math.floor(b.x / cell), gy = Math.floor(b.y / cell);
      let ax = 0, ay = 0, mx = 0, my = 0, sx3 = 0, sy3 = 0, cnt = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const bucket = grid.get((gy + oy) * cols + (gx + ox));
          if (!bucket) continue;
          for (const j of bucket) {
            if (j === i) continue;
            const o = B[j];
            const dx = o.x - b.x, dy = o.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > cell * cell * 2) continue;
            cnt++;
            ax += o.vx; ay += o.vy;          // alignment
            mx += o.x; my += o.y;            // cohesion
            if (d2 < 330 && d2 > 0.01) {     // separation
              sx3 -= dx / d2 * 34; sy3 -= dy / d2 * 34;
            }
          }
        }
      }
      if (cnt) {
        b.vx += (ax / cnt - b.vx) * alignW + (mx / cnt - b.x) * cohW + sx3;
        b.vy += (ay / cnt - b.vy) * alignW + (my / cnt - b.y) * cohW + sy3;
      }
      b.vx += (cx - b.x) * 0.0012 + Math.sin(t * 1.3 + i) * 0.5;   // home + wander
      b.vy += (cy - b.y) * 0.0012 + Math.cos(t * 1.1 + i * 1.7) * 0.5;
      if (this.hawk) {                        // fear travels locally
        const dx = b.x - this.hawk.x, dy = b.y - this.hawk.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 8100) { const d = Math.sqrt(d2) || 1; b.vx += dx / d * 9; b.vy += dy / d * 9; }
      }
      const v = Math.hypot(b.vx, b.vy) || 1;
      const cap = speed * (0.7 + ((i * 37) % 10) / 18);
      if (v > cap) { b.vx = (b.vx / v) * cap; b.vy = (b.vy / v) * cap; }
      const vmin = speed * 0.3;
      if (v < vmin) { b.vx = (b.vx / v) * vmin; b.vy = (b.vy / v) * vmin; }
      b.x += b.vx / 60; b.y += b.vy / 60;
      if (b.x < -20) b.x = W2 + 18; if (b.x > W2 + 20) b.x = -18;
      if (b.y < -20) b.y = H2 + 18; if (b.y > H2 + 20) b.y = -18;
      // a moonlit chevron with the faintest pastel shift per bird
      const hx = b.vx / v, hy = b.vy / v;
      const flap = Math.sin(t * 12 + i) * 3;
      ctx.strokeStyle = `hsla(${210 + (i % 9) * 14}, 45%, 82%, 0.8)`;
      ctx.lineWidth = 1.7;
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
      const b = B[k * 41];
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
    ctx.fillStyle = '#0a0f0a';                     // the scope goes dark
    ctx.fillRect(0, 0, W2, H2);
    ctx.strokeStyle = 'rgba(130,220,150,0.09)';    // phosphor graticule
    ctx.lineWidth = 1;
    for (let y = H2 * 0.25; y < H2; y += H2 * 0.25) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W2, y); ctx.stroke();
    }
    for (let x = W2 * 0.2; x < W2; x += W2 * 0.2) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H2); ctx.stroke();
    }
    const yM = H2 * 0.55, amp = H2 * 0.3;
    const wy = x => {
      const s = this.wave[Math.floor((x / W2) * (this.wave.length - 1))];
      return yM + ((s - 128) / 128) * amp;
    };
    // the wire itself: a wide phosphor glow under a bright green trace
    for (const [colour, width, off] of [['rgba(120,255,160,0.22)', 7, 0], ['#9df29d', 2.2, 0]]) {
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
      ctx.fillStyle = 'rgba(238,244,232,0.92)';
      ctx.strokeStyle = 'rgba(120,255,160,0.8)';
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
/*
    A shape drawn by the game's own sprite code, refilled as a flat
    silhouette — how Bond titles and Spectrum guardians both want their
    figures. One shared offscreen; draw, tint, blit.
  */
  silhouette(draw, colour, size = 200) {
    const S = this._sil ??= document.createElement('canvas');
    if (S.width !== size) { S.width = size; S.height = size; }
    const sc = S.getContext('2d');
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.clearRect(0, 0, size, size);
    draw(sc, size);
    sc.globalCompositeOperation = 'source-in';
    sc.fillStyle = colour;
    sc.fillRect(0, 0, size, size);
    sc.globalCompositeOperation = 'source-over';
    return S;
  }
  // GOLDFEATHER — the Bond title sequence our story deserves: rifled
  // gun-barrel iris gliding across black, a robin strutting inside it,
  // gold quills orbiting, and on the big kick the red curtain descends.
  // Robbin will return.
  vGoldfeather(ctx, W2, H2, au) {
    const { bass, mids, treble, kick, t } = au;
    ctx.fillStyle = '#0b0a08';
    ctx.fillRect(0, 0, W2, H2);
    // orbiting quills: gold feather strokes on lissajous paths
    for (let i = 0; i < 12; i++) {
      const a = t * (0.4 + (i % 3) * 0.13) + i * 1.7;
      const qx = W2 / 2 + Math.sin(a) * W2 * 0.42;
      const qy = H2 / 2 + Math.sin(a * 1.7 + i) * H2 * 0.4;
      const qr = a * 1.3;
      const ql = 14 + treble * 26 + (i % 4) * 4;
      ctx.save();
      ctx.translate(qx, qy);
      ctx.rotate(qr);
      ctx.strokeStyle = 'rgba(185,138,46,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-ql, 0); ctx.lineTo(ql, 0); ctx.stroke();
      ctx.lineWidth = 1.2;
      for (let b = -ql + 3; b < ql - 2; b += 4) {
        const bl = 5 * (1 - Math.abs(b) / ql);
        ctx.beginPath();
        ctx.moveTo(b, 0); ctx.lineTo(b - 3, -bl);
        ctx.moveTo(b, 0); ctx.lineTo(b - 3, bl);
        ctx.stroke();
      }
      ctx.restore();
    }
    // the barrel glides; its rifling turns with the mids
    const bx = W2 / 2 + Math.sin(t * 0.35) * W2 * 0.28;
    const by = H2 * 0.5, R = Math.min(W2, H2) * 0.34 * (1 + bass * 0.06);
    ctx.save();
    ctx.translate(bx, by);
    ctx.fillStyle = '#f2ecdd';
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(t * (0.3 + mids * 1.6));
    ctx.strokeStyle = '#0b0a08';
    for (let r = R * 0.42; r < R; r += R * 0.12) {   // rifling grooves
      ctx.lineWidth = R * 0.045;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = 0; i < 9; i++) {                     // the spiral lands
      const a = (i / 9) * Math.PI * 2;
      ctx.lineWidth = R * 0.05;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.42, Math.sin(a) * R * 0.42);
      ctx.lineTo(Math.cos(a + 0.5) * R, Math.sin(a + 0.5) * R);
      ctx.stroke();
    }
    ctx.rotate(-t * (0.3 + mids * 1.6));
    // gold iris, and the bird who walked into the wrong title sequence
    ctx.fillStyle = '#b98a2e';
    ctx.beginPath(); ctx.arc(0, 0, R * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.36, 0, Math.PI * 2); ctx.clip();
    const walk = this.silhouette(sc =>
      drawBird(sc, 'robin', { x: 100, y: 138, size: 96, facing: -1, phase: t * 9, pose: 'walk' }),
      '#0b0a08');
    const bw = R * 0.66;
    ctx.drawImage(walk, -bw / 2, -bw * 0.62, bw, bw);
    ctx.restore();
    // the blood curtain: a kick starts it, and it always falls to the floor
    if (kick) this.blood = Math.max(this.blood || 0, 0.001);
    if (this.blood) {
      this.blood = Math.min(1, this.blood + 0.03);
      ctx.fillStyle = `rgba(217,67,39,${0.82 - this.blood * 0.3})`;
      ctx.fillRect(0, 0, W2, H2 * this.blood);
      if (this.blood >= 1 && bass < 0.3) this.blood = 0;   // lights up for the verse
    }
    // spectrum: a thin gold halo of arcs around the barrel
    for (let i = 0; i < 36; i++) {
      const v = this.bins[4 + Math.floor((i / 36) * 300)] / 255;
      const a = (i / 36) * Math.PI * 2 - Math.PI / 2;
      ctx.strokeStyle = `rgba(216,200,164,${0.25 + v * 0.7})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(a) * (R + 6), by + Math.sin(a) * (R + 6));
      ctx.lineTo(bx + Math.cos(a) * (R + 6 + v * 22), by + Math.sin(a) * (R + 6 + v * 22));
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(216,200,164,0.5)';
    ctx.font = `italic ${Math.max(11, H2 * 0.055)}px Georgia, serif`;
    ctx.textAlign = 'right';
    ctx.fillText('ROBBIN WILL RETURN', W2 - 10, H2 - 10);
    ctx.textAlign = 'left';
  }
  // ATTIC 1984 — the Jet Set Willy nod: tape-loading border, brick
  // towers that ARE the spectrum, colour-cycling treasures, a guardian
  // on patrol, and our bird hopping the platforms on the kick
  vAttic(ctx, W2, H2, au) {
    const { mids, kick, t } = au;
    const ZX = ['#01FFFF', '#FF01FF', '#FFFF01', '#01FF01', '#FF6B6B', '#7B7BFF', '#FFFFFF'];
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W2, H2);
    // the loading border, forever loading
    const BW = Math.max(6, H2 * 0.045);
    const stripePhase = (t * (60 + mids * 260));
    for (const [x0, y0, w, h, vert] of [
      [0, 0, W2, BW, false], [0, H2 - BW, W2, BW, false],
      [0, 0, BW, H2, true], [W2 - BW, 0, BW, H2, true],
    ]) {
      for (let k2 = 0; k2 < (vert ? h : w); k2 += 5) {
        ctx.fillStyle = Math.floor((k2 + stripePhase) / 5) % 2 ? '#D70000' : '#01D7D7';
        if (vert) ctx.fillRect(x0, y0 + k2, w, 5);
        else ctx.fillRect(x0 + k2, y0, 5, h);
      }
    }
    // brick towers: the spectrum as Manic Miner masonry with peak-holds
    const N = 11, span = W2 - BW * 2, bw = span / N;
    if (!this.atticHold || this.atticHold.length !== N) this.atticHold = new Array(N).fill(0);
    const floors = [];
    for (let i = 0; i < N; i++) {
      const v = this.bins[4 + Math.floor((i / N) * 260)] / 255;
      const h = 8 + v * (H2 * 0.52);
      this.atticHold[i] = Math.max(this.atticHold[i] - H2 * 0.004, h);
      const x = BW + i * bw, y = H2 - BW - h;
      floors.push({ cx: x + bw / 2, y });
      ctx.fillStyle = '#B22222';
      ctx.fillRect(x + 1, y, bw - 2, h);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      for (let yy = y; yy < H2 - BW; yy += 6) {       // mortar courses
        ctx.beginPath(); ctx.moveTo(x + 1, yy); ctx.lineTo(x + bw - 1, yy); ctx.stroke();
        const off = ((yy - y) / 6) % 2 ? bw * 0.25 : bw * 0.6;
        ctx.beginPath(); ctx.moveTo(x + off, yy); ctx.lineTo(x + off, yy + 6); ctx.stroke();
      }
      // the treasure twinkles JSW-style above the peak-hold
      const ty = H2 - BW - this.atticHold[i] - 12;
      ctx.fillStyle = ZX[Math.floor(t * 12 + i) % ZX.length];
      ctx.save();
      ctx.translate(BW + i * bw + bw / 2, ty);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    // the guardian walks its eternal patrol, cycling through the palette
    const gx = W2 / 2 + Math.sin(t * 0.9) * (W2 / 2 - BW - 30);
    const guard = this.silhouette(sc =>
      drawCommuter(sc, { x: 100, y: 150, size: 92, facing: Math.cos(t * 0.9) > 0 ? 1 : -1, phase: t * 8, pose: 'walk', variant: 2 }),
      ZX[Math.floor(t * 6) % ZX.length]);
    ctx.drawImage(guard, gx - 34, H2 * 0.18, 68, 68);
    // our bird hops tower to tower on the kick — collecting as it goes
    if (this.atticBird == null) this.atticBird = { i: 0, x: floors[0].cx, y: floors[0].y, hop: 0 };
    const ab = this.atticBird;
    if (kick && ab.hop <= 0) { ab.from = ab.i; ab.i = (ab.i + 1) % N; ab.hop = 1; }
    if (ab.hop > 0) {
      ab.hop = Math.max(0, ab.hop - 0.07);
      const u = 1 - ab.hop;
      const fx = floors[ab.from ?? 0], fx2 = floors[ab.i];
      ab.x = fx.cx + (fx2.cx - fx.cx) * u;
      ab.y = Math.min(fx.y, fx2.y) - Math.sin(u * Math.PI) * 34
        + (u > 0.5 ? (fx2.y - Math.min(fx.y, fx2.y)) * (u - 0.5) * 2 : 0);
    } else {
      ab.x = floors[ab.i].cx; ab.y = floors[ab.i].y;
    }
    drawBird(ctx, 'bluetit', { x: ab.x, y: ab.y, size: 28, facing: 1, phase: t * 10, pose: ab.hop > 0 ? 'airup' : 'stand' });
  }
  // NIGHT TRAIN — the whole journey 100×: parallax London rolling by
  // under the stars while a cut-paper train runs the viaduct, every
  // carriage window lit by its own slice of the spectrum
  vNightTrain(ctx, W2, H2, au) {
    const { bass, mids, treble, kick, t } = au;
    this.trainOff = (this.trainOff || 0) + (0.4 + mids * 2.6);
    ctx.fillStyle = '#14120e';
    ctx.fillRect(0, 0, W2, H2);
    // stars twinkle with the treble; the moon is paper
    for (let i = 0; i < 26; i++) {
      const sx2 = ((i * 149 + 31) % W2), sy = ((i * 83 + 11) % Math.round(H2 * 0.5));
      const tw = 0.25 + 0.6 * Math.abs(Math.sin(t * (1 + (i % 5) * 0.6) + i)) * (0.4 + treble);
      ctx.fillStyle = `rgba(242,236,221,${Math.min(0.9, tw)})`;
      ctx.fillRect(sx2, sy, 2, 2);
    }
    ctx.fillStyle = 'rgba(242,236,221,0.85)';
    ctx.beginPath(); ctx.arc(W2 * 0.78, H2 * 0.2, H2 * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#14120e';
    ctx.beginPath(); ctx.arc(W2 * 0.81, H2 * 0.185, H2 * 0.085, 0, Math.PI * 2); ctx.fill();
    // two skylines in parallax — domes and towers of the whole journey
    const skyline = (speed, base, colour, seedMul) => {
      ctx.fillStyle = colour;
      const off = this.trainOff * speed;
      const seg = 46;
      for (let x = -seg; x < W2 + seg; x += seg) {
        const idx = Math.floor((x + off) / seg);
        const r = ((idx * 2654435761 * seedMul) >>> 8) % 100;
        const h = 18 + (r % 55);
        const bx = x - (off % seg);
        if (idx % 13 === 0) {              // a dome on the skyline
          ctx.beginPath();
          ctx.arc(bx + seg / 2, base - h * 0.7, seg * 0.42, Math.PI, 0);
          ctx.rect(bx + seg * 0.08, base - h * 0.7, seg * 0.84, h * 0.7);
          ctx.fill();
        } else if (idx % 19 === 0) {       // a clock tower keeps its own time
          ctx.fillRect(bx + seg * 0.3, base - h - 26, seg * 0.4, h + 26);
          ctx.fillStyle = '#e9d8a6';
          ctx.beginPath(); ctx.arc(bx + seg / 2, base - h - 16, 6, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = colour; ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(bx + seg / 2, base - h - 16);
          ctx.lineTo(bx + seg / 2 + Math.cos(t) * 4, base - h - 16 + Math.sin(t) * 4);
          ctx.stroke();
          ctx.fillStyle = colour;
        } else {
          ctx.fillRect(bx, base - h, seg - 3, h);
        }
      }
    };
    skyline(0.35, H2 * 0.62, '#241f19', 1);
    skyline(0.7, H2 * 0.74, '#2f2820', 7);
    // the viaduct the night train runs on
    const vy = H2 * 0.86;
    ctx.fillStyle = '#3a2f24';
    ctx.fillRect(0, vy, W2, H2 - vy);
    ctx.fillStyle = '#14120e';
    const aoff = this.trainOff % 44;
    for (let x = -44; x < W2 + 44; x += 44) {
      ctx.beginPath();
      ctx.arc(x - aoff + 22, H2 + 2, 16, Math.PI, 0);
      ctx.fill();
    }
    // the train itself: engine + three carriages, windows ARE the bands
    const ty = vy - 20 + Math.sin(t * 7) * bass * 2.5;
    const cars = 3, cw = Math.min(96, W2 / 4.6), gap = 7;
    const trainX = W2 * 0.5 - ((cars + 1) * (cw + gap)) / 2;
    for (let c = 0; c <= cars; c++) {
      const x = trainX + c * (cw + gap);
      ctx.fillStyle = c === cars ? '#4f4a76' : '#5a3d33';
      ctx.beginPath(); ctx.roundRect(x, ty - 22, cw, 24, 4); ctx.fill();
      ctx.strokeStyle = '#0e0c09'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.roundRect(x, ty - 22, cw, 24, 4); ctx.stroke();
      if (c === cars) {                     // the engine leads: stack, lamp, steam
        ctx.fillStyle = '#26221e';
        ctx.fillRect(x + cw - 16, ty - 34, 9, 12);
        ctx.fillStyle = 'rgba(233,196,106,0.9)';
        ctx.beginPath(); ctx.arc(x + cw + 2, ty - 10, 3.4, 0, Math.PI * 2); ctx.fill();
        if (kick) {
          this.steam = this.steam || [];
          this.steam.push({ x: x + cw - 11, y: ty - 36, vx: -0.6 - Math.random(), vy: -1.4, a: 0.8 });
        }
      } else {                              // carriage windows lit by the spectrum
        const wins = 5;
        for (let w3 = 0; w3 < wins; w3++) {
          const bin = 6 + (c * wins + w3) * 18;
          const v = this.bins[Math.min(bin, this.bins.length - 1)] / 255;
          ctx.fillStyle = `rgba(233,196,106,${0.12 + v * 0.85})`;
          ctx.fillRect(x + 5 + w3 * ((cw - 10) / wins), ty - 17, (cw - 10) / wins - 3, 10);
        }
      }
      for (const wx of [x + 12, x + cw - 12]) {   // wheels, spokes turning
        ctx.strokeStyle = '#d8c8a4'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(wx, ty + 4, 6, 0, Math.PI * 2); ctx.stroke();
        const wa = -this.trainOff * 0.12 + wx;
        ctx.beginPath();
        ctx.moveTo(wx - Math.cos(wa) * 6, ty + 4 - Math.sin(wa) * 6);
        ctx.lineTo(wx + Math.cos(wa) * 6, ty + 4 + Math.sin(wa) * 6);
        ctx.stroke();
      }
    }
    (this.steam || []).forEach(p2 => {
      p2.x += p2.vx; p2.y += p2.vy; p2.a -= 0.015;
      ctx.fillStyle = `rgba(242,236,221,${Math.max(0, p2.a)})`;
      ctx.beginPath(); ctx.arc(p2.x, p2.y, 4 + (0.8 - p2.a) * 6, 0, Math.PI * 2); ctx.fill();
    });
    this.steam = (this.steam || []).filter(p2 => p2.a > 0).slice(-24);
    // and above it all, the flock flies the same line home
    for (let k2 = 0; k2 < 4; k2++) {
      drawBird(ctx, ['robin', 'bluetit', 'wren', 'blackbird'][k2], {
        x: (W2 * 0.2 + k2 * 40 + this.trainOff * 0.9) % (W2 + 60) - 30,
        y: H2 * (0.3 + (k2 % 2) * 0.08) + Math.sin(t * 3 + k2) * 6,
        size: 22, facing: 1, phase: t * 12 + k2, pose: 'airup',
      });
    }
  }
// A SERIES OF TUBES — the default: dark mode, neons gone pastel.
  // The REAL network (tube-network.js geometry) drawn as glowing
  // snaking pipes, each line breathing with its own frequency band,
  // blobs of light travelling the tunnels at the music's pace, and a
  // kick ringing a random interchange. The Thames glows past below.
  buildPipes(W2, H2) {
    const key = `${W2}x${H2}`;
    if (this.pipes?.key === key) return this.pipes;
    const pos = NETWORK.pos ?? {};
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const [x, y] of Object.values(pos)) {
      minx = Math.min(minx, x); maxx = Math.max(maxx, x);
      miny = Math.min(miny, y); maxy = Math.max(maxy, y);
    }
    const sc = Math.min((W2 - 30) / (maxx - minx), (H2 - 24) / (maxy - miny));
    const ox = (W2 - (maxx - minx) * sc) / 2, oy = (H2 - (maxy - miny) * sc) / 2;
    const proj = ([x, y]) => [(x - minx) * sc + ox, (y - miny) * sc + oy];
    const pastel = hex => {
      const n = parseInt(hex.slice(1), 16);
      const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      let h = 0;
      if (mx !== mn) {
        if (mx === r) h = ((g - b) / (mx - mn)) % 6;
        else if (mx === g) h = (b - r) / (mx - mn) + 2;
        else h = (r - g) / (mx - mn) + 4;
      }
      return `hsl(${Math.round(h * 60 + 360) % 360}, 85%, 72%)`;
    };
    const chains = [];
    Object.values(NETWORK.lines ?? {}).forEach((def, li) => {
      const colour = pastel(def.color || '#d94327');
      for (const chain of def.chains ?? []) {
        const pts = chain.filter(n => pos[n]).map(n => proj(pos[n]));
        if (pts.length < 2) continue;
        const cum = [0];
        for (let i = 1; i < pts.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        }
        const total = cum[cum.length - 1];
        if (total < 8) continue;
        const blobs = Array.from({ length: Math.max(1, Math.min(4, Math.round(total / 130))) },
          (_, b) => ({ p: (b * 197.3) % total, dir: b % 2 ? 1 : -1, hue: (b * 47) % 100 }));
        chains.push({ colour, li, pts, cum, total, blobs });
      }
    });
    const thames = (NETWORK.thames ?? []).map(proj);
    this.pipes = { key, chains, thames, nLines: Object.keys(NETWORK.lines ?? {}).length };
    return this.pipes;
  }
  vPipes(ctx, W2, H2, au) {
    const { bass, mids, treble, kick, t } = au;
    const P = this.buildPipes(W2, H2);
    ctx.fillStyle = '#0d0e12';
    ctx.fillRect(0, 0, W2, H2);
    // faint neon dust so the dark breathes too
    for (let i = 0; i < 40; i++) {
      const dx = ((i * 167 + 43) % W2), dy = ((i * 211 + 17) % H2);
      const tw = 0.05 + 0.14 * Math.abs(Math.sin(t * (0.6 + (i % 7) * 0.3) + i)) * (0.5 + treble);
      ctx.fillStyle = `hsla(${(i * 37) % 360}, 70%, 78%, ${tw})`;
      ctx.fillRect(dx, dy, 2, 2);
    }
    // the river first, a slow pastel glow under everything
    if (P.thames.length > 1) {
      ctx.strokeStyle = 'rgba(148,190,220,0.16)';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      P.thames.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(170,214,240,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const at = (ch, d) => {          // point at arc-length d along a chain
      let i = 1;
      while (i < ch.cum.length - 1 && ch.cum[i] < d) i++;
      const seg = ch.cum[i] - ch.cum[i - 1] || 1;
      const u = (d - ch.cum[i - 1]) / seg;
      return [ch.pts[i - 1][0] + (ch.pts[i][0] - ch.pts[i - 1][0]) * u,
        ch.pts[i - 1][1] + (ch.pts[i][1] - ch.pts[i - 1][1]) * u];
    };
    const speed = (26 + mids * 190) / 60;
    for (const ch of P.chains) {
      // each line breathes with its own slice of the spectrum
      const v = this.bins[6 + Math.floor((ch.li / Math.max(1, P.nLines)) * 320)] / 255;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ch.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.strokeStyle = ch.colour.replace(')', `, ${0.08 + v * 0.3})`).replace('hsl', 'hsla');
      ctx.lineWidth = 6 + v * 5;     // the soft neon halo
      ctx.stroke();
      ctx.strokeStyle = ch.colour.replace(')', `, ${0.35 + v * 0.55})`).replace('hsl', 'hsla');
      ctx.lineWidth = 1.8;           // the bright core
      ctx.stroke();
      for (const b of ch.blobs) {    // light travelling the tunnels
        b.p = (b.p + b.dir * speed * (0.7 + (b.hue % 7) / 10) + ch.total) % ch.total;
        const [x, y] = at(ch, b.p);
        const r2 = 2.2 + bass * 3.4;
        ctx.fillStyle = ch.colour.replace('72%)', '85%, 0.9)').replace('hsl', 'hsla');
        ctx.beginPath(); ctx.arc(x, y, r2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = ch.colour.replace('72%)', '80%, 0.25)').replace('hsl', 'hsla');
        ctx.beginPath(); ctx.arc(x, y, r2 * 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    // a kick rings a junction — an expanding pastel circle of arrival
    if (kick) {
      const ch = P.chains[Math.floor(Math.random() * P.chains.length)];
      const [x, y] = at(ch, Math.random() * ch.total);
      (this.rings ??= []).push({ x, y, r: 3, a: 0.8, colour: ch.colour });
    }
    (this.rings ?? []).forEach(rg => {
      rg.r += 1.6; rg.a -= 0.02;
      ctx.strokeStyle = rg.colour.replace(')', `, ${Math.max(0, rg.a)})`).replace('hsl', 'hsla');
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2); ctx.stroke();
    });
    this.rings = (this.rings ?? []).filter(rg => rg.a > 0).slice(-14);
    // one pastel bird rides the whole network home
    const ch0 = P.chains[Math.floor(t / 9) % P.chains.length];
    if (ch0) {
      this.ridep = ((this.ridep ?? 0) + speed * 1.3) % ch0.total;
      const [x, y] = at(ch0, this.ridep);
      drawBird(ctx, 'robin', { x, y: y - 4, size: 20, facing: 1, phase: t * 12, pose: 'airup' });
    }
  }
// GAUSSIAN SPLATS — a point cloud of soft pastel gaussians in 3D,
  // morphing between geometric solids (sphere, torus, helix, twin
  // cones) as the song moves. Each splat is displaced by its own
  // frequency band, the whole cloud turns with the mids and breathes
  // with the bass, and morphs land on the kick.
  buildSplats() {
    if (this.splats) return this.splats;
    const N = 620;
    const shapes = [];
    const fib = [];
    for (let i = 0; i < N; i++) {          // fibonacci sphere
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.39996;
      fib.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    shapes.push(fib);
    shapes.push(Array.from({ length: N }, (_, i) => {   // torus
      const u = (i / N) * Math.PI * 2 * 13, v = (i / N) * Math.PI * 2;
      const R = 0.72, r2 = 0.34;
      return [(R + r2 * Math.cos(u)) * Math.cos(v), r2 * Math.sin(u), (R + r2 * Math.cos(u)) * Math.sin(v)];
    }));
    shapes.push(Array.from({ length: N }, (_, i) => {   // double helix
      const u = (i / N) * Math.PI * 8, side = i % 2 ? 1 : -1;
      return [Math.cos(u + (side > 0 ? 0 : Math.PI)) * 0.55, (i / N) * 2 - 1, Math.sin(u + (side > 0 ? 0 : Math.PI)) * 0.55];
    }));
    shapes.push(Array.from({ length: N }, (_, i) => {   // twin cones
      const v = (i / N) * 2 - 1, a = i * 2.39996;
      const r2 = 1 - Math.abs(v);
      return [Math.cos(a) * r2 * 0.85, v, Math.sin(a) * r2 * 0.85];
    }));
    // pre-tinted soft sprites: five pastel gaussians
    const sprites = [200, 275, 330, 25, 145].map(h => {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const g2 = c.getContext('2d');
      const grad = g2.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, `hsla(${h}, 80%, 80%, 0.9)`);
      grad.addColorStop(0.4, `hsla(${h}, 80%, 72%, 0.35)`);
      grad.addColorStop(1, `hsla(${h}, 80%, 66%, 0)`);
      g2.fillStyle = grad;
      g2.fillRect(0, 0, 32, 32);
      return c;
    });
    this.splats = { N, shapes, sprites, from: 0, to: 1, morph: 1 };
    return this.splats;
  }
  vSplats(ctx, W2, H2, au) {
    const { bass, mids, treble, kick, t } = au;
    const S = this.buildSplats();
    ctx.fillStyle = '#0c0b12';
    ctx.fillRect(0, 0, W2, H2);
    if (kick && S.morph >= 1) {            // a new solid on the kick
      S.from = S.to;
      S.to = (S.to + 1 + Math.floor(Math.random() * (S.shapes.length - 1))) % S.shapes.length;
      S.morph = 0;
    }
    S.morph = Math.min(1, S.morph + 0.016);
    const e = S.morph < 0.5 ? 2 * S.morph * S.morph : 1 - Math.pow(-2 * S.morph + 2, 2) / 2;
    const ry = t * 0.4 + mids * 1.2, rx = Math.sin(t * 0.23) * 0.5;
    const cy2 = Math.cos(ry), sy2 = Math.sin(ry), cx2 = Math.cos(rx), sx2 = Math.sin(rx);
    const scale = Math.min(W2, H2) * (0.5 + bass * 0.07);
    const A = S.shapes[S.from], Bp = S.shapes[S.to];
    ctx.globalCompositeOperation = 'lighter';   // splats add up to glow
    for (let i = 0; i < S.N; i++) {
      let x = A[i][0] + (Bp[i][0] - A[i][0]) * e;
      let y = A[i][1] + (Bp[i][1] - A[i][1]) * e;
      let z = A[i][2] + (Bp[i][2] - A[i][2]) * e;
      const band = this.bins[4 + ((i * 7) % 400)] / 255;   // its own band breathes
      const puff = 1 + band * 0.3 * (0.4 + treble);
      x *= puff; y *= puff; z *= puff;
      const x1 = x * cy2 - z * sy2, z1 = x * sy2 + z * cy2;   // spin
      const y1 = y * cx2 - z1 * sx2, z2 = y * sx2 + z1 * cx2;
      const pz = 1 / (1.75 - z2 * 0.55);
      const sx4 = W2 / 2 + x1 * scale * pz;
      const sy4 = H2 / 2 + y1 * scale * pz;
      const r2 = (4 + band * 11) * pz;
      ctx.globalAlpha = 0.5 + z2 * 0.22;
      ctx.drawImage(S.sprites[i % S.sprites.length], sx4 - r2, sy4 - r2, r2 * 2, r2 * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // AVIARY 3D — the settings-page cut-paper birds, at last on stage: a
  // real three.js scene (borrowing the flock-wipe's lazily loaded
  // library and bird factory) composited into the visualizer — nine
  // hinged paper birds wheeling in the dark, wings beating with the
  // treble, the camera drifting with the mids
  ensureAviary(W2, H2) {
    const w = this.g.wipe;
    if (!w?.THREE) { w?.preload?.(); return null; }
    if (!this.av) {
      const THREE = w.THREE;
      const r = new THREE.WebGLRenderer({ alpha: true, antialias: false });
      r.setPixelRatio(1);
      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
      scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x141020, 2.1));
      const key = new THREE.DirectionalLight(0xaad4f0, 2.2);
      key.position.set(-3, 5, 4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xffb0c8, 1.6);
      rim.position.set(4, 2, -3);
      scene.add(rim);
      const factory = w.birdMod.makeBirdFactory(THREE, r);
      const cast = Array.from({ length: 9 }, (_, i) => {
        const b = factory.createBird(i % 2 ? 'bluetit' : 'robin', 0.72);
        scene.add(b);
        return b;
      });
      this.av = { r, scene, cam, cast };
    }
    const r = this.av.r;
    if (r.domElement.width !== W2 || r.domElement.height !== H2) {
      r.setSize(W2, H2, false);
      this.av.cam.aspect = W2 / H2;
      this.av.cam.updateProjectionMatrix();
    }
    return this.av;
  }
  vAviary(ctx, W2, H2, au) {
    const { bass, mids, treble, t } = au;
    ctx.fillStyle = '#0e0c14';
    ctx.fillRect(0, 0, W2, H2);
    for (let i = 0; i < 30; i++) {         // pastel dust behind the birds
      const dx = ((i * 191 + 53) % W2), dy = ((i * 127 + 31) % H2);
      ctx.fillStyle = `hsla(${(i * 43) % 360}, 60%, 78%, ${0.05 + 0.1 * Math.abs(Math.sin(t + i)) * (0.4 + treble)})`;
      ctx.fillRect(dx, dy, 2, 2);
    }
    const av = this.ensureAviary(W2, H2);
    if (!av) {                             // three.js still on its way
      ctx.fillStyle = 'rgba(242,236,221,0.6)';
      ctx.font = `italic ${Math.max(13, H2 * 0.07)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText('the aviary is waking up…', W2 / 2, H2 / 2);
      ctx.textAlign = 'left';
      return;
    }
    av.cast.forEach((b, i) => {
      const a = t * (0.32 + (i % 3) * 0.09) + i * 0.7;
      const rad = 1.6 + (i % 4) * 0.5 + bass * 0.3;
      b.position.set(Math.cos(a) * rad, Math.sin(a * 1.6 + i) * 1.1, Math.sin(a) * rad * 0.7);
      b.rotation.y = Math.cos(a) >= 0 ? Math.PI : 0;   // paper faces its heading
      b.rotation.z = Math.sin(a * 2) * 0.15;
      const parts = b.userData.parts;
      const phase = t * (7 + treble * 16) + i * 1.3;
      parts.wing.rotation.x = -0.22 + Math.sin(phase) * 1.05;
      parts.tail.rotation.z = -0.11 + Math.sin(phase * 0.45 - 0.8) * 0.09;
      parts.head.rotation.z = -Math.sin(phase - 1.1) * 0.04;
      const sc = 0.72 * (1 + bass * 0.12);
      b.scale.setScalar(sc);
    });
    av.cam.position.set(Math.sin(t * 0.14) * (2.6 + mids * 1.4), Math.sin(t * 0.1) * 0.8, 6.2 - mids * 1.2);
    av.cam.lookAt(0, 0, 0);
    av.r.render(av.scene, av.cam);
    ctx.drawImage(av.r.domElement, 0, 0, W2, H2);
  }
/*
    ROLL THE CREDITS — the Konami reward, migrated from its old overlay
    into the jukebox where it belongs: the credit roll as a viz mode.
    The scroll keeps time with the mids, the buried-wonder gallery
    breathes with the bass and goes Jet-Set-Willy hot on the kick, and
    the Konami code anywhere in the game opens ROBBAMP straight onto
    this reel with the Piccadilly wiggle playing.
  */
  openCredits() {
    this.mode = this.MODES.length - 1;   // a moment, not a saved preference
    this.modeFlash = 3;
    this.creditScroll = 0;
    this.open('piccadilly-circus-wiggly-wiggle-remastered');
  }
  vCredits(ctx, W2, H2, au) {
    const { bass, mids, kick, treble, t } = au;
    // the clay case, after dark
    ctx.fillStyle = '#241c12';
    ctx.fillRect(0, 0, W2, H2);
    ctx.strokeStyle = 'rgba(16,12,8,0.6)';
    ctx.lineWidth = 2;
    for (let y = 18; y < H2; y += 52) {
      ctx.beginPath();
      for (let x = 0; x <= W2; x += 20) {
        const yy = y + Math.sin(x * 0.05) * (4 + mids * 5);
        x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    const ROLL = [
      { role: 'BIRD ART', name: 'Libby' },
      { role: 'GAME CONCEPT', name: 'Dan' },
      { role: 'INSPIRATIONAL', name: 'Chuckie Egg · Gathering Sky · Jet Set Willy · Wanted: Monty Mole · Hampstead' },
      { role: 'SOUNDTRACK', name: 'The Quiet Engines · Gears and Birdcalls · The Inexorable Passacaglia' },
      { role: 'SOFTWARE & ADDITIONAL A/V', name: 'Computers' },
      { role: '', name: '· found in the clay ·' },
      { wonder: 0, cap: 'great bones' },
      { wonder: 1, cap: 'mammoth & visitor' },
      { wonder: 2, cap: 'longship' },
      { wonder: 3, cap: 'the curious ring' },
      { wonder: 4, cap: 'ammonite' },
      { wonder: 5, cap: 'pterodactyl, commuting' },
    ];
    const P = TubeFlock.prototype;
    const art = [
      c => P.buriedBones.call(null, c, 0, 0, n => 7 % n || 0),
      c => P.buriedMammothUfo.call(null, c, -14, 0),
      c => P.buriedLongship.call(null, c, 0, 0),
      c => P.buriedRing.call(null, c, 0, 0),
      c => P.buriedAmmonite.call(null, c, 0, 0),
      c => P.buriedPteroBike.call(null, c, 0, -8),
    ];
    const hOf = it => it.wonder !== undefined ? (it.wonder === 1 || it.wonder === 5 ? 190 : 160) : 76;
    const total = ROLL.reduce((a, it) => a + hOf(it), 0);
    this.creditScroll = (this.creditScroll || 0) + (0.4 + mids * 1.3);
    let y = H2 + 20 - (this.creditScroll % (total + H2 + 40));
    if (kick) this.credHot = 1;
    this.credHot = Math.max(0, (this.credHot || 0) - 0.03);
    for (const it of ROLL) {
      const hh = hOf(it);
      const cy = y + hh / 2;
      y += hh;
      if (cy < -hh || cy > H2 + hh) continue;
      const shim = Math.sin(t * 9 + cy * 0.05) * treble * 3;   // treble shimmer
      ctx.textAlign = 'center';
      if (it.role !== undefined) {
        if (it.role) {
          ctx.fillStyle = '#b9a67f';
          ctx.font = 'bold 13px Georgia, serif';
          ctx.fillText(it.role, W2 / 2 + shim, cy - 13);
        }
        ctx.fillStyle = this.credHot > 0.6 ? `hsl(${(t * 160) % 360}, 85%, 78%)` : '#ecdfc2';
        let fpx = 20;                          // long names shrink to fit
        ctx.font = `bold ${fpx}px Georgia, serif`;
        while (fpx > 11 && ctx.measureText(it.name).width > W2 - 18) {
          fpx -= 1;
          ctx.font = `bold ${fpx}px Georgia, serif`;
        }
        ctx.fillText(it.name, W2 / 2 - shim, cy + 12);
      } else {
        ctx.save();
        ctx.translate(W2 / 2, cy - 14);
        const pulse = 1 + bass * 0.12;
        ctx.scale(pulse, pulse);
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = ctx.fillStyle = this.credHot > 0
          ? `hsla(${(t * 160 + it.wonder * 40) % 360}, 90%, 74%, 0.95)` : '#d8c8a4';
        art[it.wonder](ctx);
        ctx.restore();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#b9a67f';
        ctx.font = 'italic 13px Georgia, serif';
        ctx.fillText(it.cap, W2 / 2, cy + hh / 2 - 16);
        ctx.globalAlpha = 1;
      }
    }
    // a little flypast keeps the roll company
    drawBird(ctx, 'robin', {
      x: (t * 40) % (W2 + 60) - 30, y: 24 + Math.sin(t * 2.2) * 8,
      size: 22, facing: 1, phase: t * 12, pose: 'airup',
    });
  }
}
