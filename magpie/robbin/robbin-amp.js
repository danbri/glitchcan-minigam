// ROBBAMP 🐣 — a Winamp-classic tribute jukebox, buried in SETTINGS.
//
// Plays the whole tape library through an <audio> element (streams —
// no decoded-PCM cost) into the game's own WebAudio graph, entering at
// the Soundtrack's bus so the master mute rules it like everything
// else.
//
// TWENTY-SEVEN visualizer looks (this.MODES below is canonical) — tap
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
import { STATION_LEVELS } from './tube-levels.js';
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
      'GAUSSIAN SPLATS', 'AVIARY 3D', 'C-90', 'DEPARTURE BOARD', 'NIGHT MAIL',
      'NIGHT BUS', 'TOY THEATRE', 'BIRDS ON WIRES', 'ZOETROPE', 'SHIPPING FORECAST',
      'CRANE BALLET', 'LIFT GRAPH', 'DEPTH GAUGE', 'THAMES MURMUR', 'ESCALATOR HALL',
      'PAPER AVIARY', 'SMELL MAP', 'ROLL THE CREDITS'];
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
    this.shuffleT = performance.now() / 1000;   // your pick holds its 15s
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
    // while the song plays, wander to a fresh look every 15 seconds —
    // a manual tap re-arms the clock, saved choice untouched. ROLL THE
    // CREDITS is a moment, not a stop: the wander never leaves it or
    // lands on it, and reduced motion keeps the still dig
    const nowS = performance.now() / 1000;
    if (!a.paused && !this.reduced && this.mode !== this.MODES.length - 1) {
      if (this.shuffleT === undefined) this.shuffleT = nowS;
      if (nowS - this.shuffleT >= 15) {
        this.shuffleT = nowS;
        let m = this.mode;
        while (m === this.mode) m = Math.floor(Math.random() * (this.MODES.length - 1));
        this.mode = m;
        this.modeFlash = 2.4;
        this.g.say?.(`Visuals: ${this.MODES[this.mode]}.`);
      }
    } else this.shuffleT = nowS;
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
    else if (mode === 11) this.vC90(ctx, W2, H2, au);
    else if (mode === 12) this.vBoard(ctx, W2, H2, au);
    else if (mode === 13) this.vNightMail(ctx, W2, H2, au);
    else if (mode === 14) this.vNightBus(ctx, W2, H2, au);
    else if (mode === 15) this.vTheatre(ctx, W2, H2, au);
    else if (mode === 16) this.vWires(ctx, W2, H2, au);
    else if (mode === 17) this.vZoetrope(ctx, W2, H2, au);
    else if (mode === 18) this.vForecast(ctx, W2, H2, au);
    else if (mode === 19) this.vCranes(ctx, W2, H2, au);
    else if (mode === 20) this.vLifts(ctx, W2, H2, au);
    else if (mode === 21) this.vDepth(ctx, W2, H2, au);
    else if (mode === 22) this.vThames(ctx, W2, H2, au);
    else if (mode === 23) this.vEscalators(ctx, W2, H2, au);
    else if (mode === 24) this.vScissors(ctx, W2, H2, au);
    else if (mode === 25) this.vSmell(ctx, W2, H2, au);
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
    C-90 — the cassette itself, honoured at last: reels at true tape
    speed (the supply pancake visibly thins), the tape span across the
    heads IS the oscilloscope, VU needles with real ballistics, and a
    judder on the kick like a cheap deck with a worn belt.
  */
  vC90(ctx, W2, H2, au) {
    const { bass, treble, kick, t } = au;
    const st = this.c90 ??= { rotL: 0, rotR: 0, vuL: 0, vuR: 0, judder: 0 };
    if (kick) st.judder = 1;
    st.judder *= 0.82;
    ctx.fillStyle = '#14120e';
    ctx.fillRect(0, 0, W2, H2);
    ctx.globalAlpha = 0.045;                       // brushed deck face
    ctx.strokeStyle = '#f2ecdd';
    ctx.lineWidth = 1;
    for (let y = 3; y < H2; y += 7) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W2, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const a = this.audio, dur = a?.duration || 0;
    const p = dur ? Math.min(1, a.currentTime / dur) : 0;
    const playing = a && !a.paused;
    ctx.save();
    ctx.translate((Math.random() - 0.5) * 3 * st.judder, (Math.random() - 0.5) * 2 * st.judder);
    const cw = Math.min(W2 * 0.86, 430), ch = Math.min(H2 * 0.66, cw * 0.62);
    const cx = W2 / 2, cy = H2 * 0.46;
    const x0 = cx - cw / 2, y0 = cy - ch / 2;
    ctx.fillStyle = '#221e1a';                     // the shell
    ctx.strokeStyle = '#0c0a08';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x0, y0, cw, ch, 12); ctx.fill(); ctx.stroke();
    for (const sx of [x0 + cw * 0.06, x0 + cw * 0.94]) {   // shell screws
      ctx.fillStyle = '#0e0c0a';
      ctx.beginPath(); ctx.arc(sx, y0 + ch * 0.9, 2.5, 0, 7); ctx.fill();
    }
    const lastGasp = dur && dur - a.currentTime < 10;      // side nearly over
    ctx.fillStyle = lastGasp && Math.sin(t * 6) > 0 ? '#e8d3c4' : '#e9e2cf';
    ctx.beginPath(); ctx.roundRect(x0 + cw * 0.06, y0 + ch * 0.07, cw * 0.88, ch * 0.30, 6); ctx.fill();
    ctx.fillStyle = '#8a2f1d';
    ctx.fillRect(x0 + cw * 0.06, y0 + ch * 0.07, cw * 0.88, ch * 0.055);
    ctx.fillStyle = '#26221e';
    ctx.textAlign = 'left';
    ctx.font = `bold ${Math.max(9, ch * 0.07)}px Georgia, serif`;
    ctx.fillText('SIDE A · 90 min', x0 + cw * 0.09, y0 + ch * 0.185);
    ctx.font = `italic ${Math.max(11, ch * 0.10)}px Georgia, serif`;
    const label = this.jb.current?.label || '';
    let fpx = Math.max(11, ch * 0.10);
    while (fpx > 9 && ctx.measureText(label).width > cw * 0.8) { fpx--; ctx.font = `italic ${fpx}px Georgia, serif`; }
    ctx.fillText(label, x0 + cw * 0.09, y0 + ch * 0.31);
    // the reels behind their window
    const ry = y0 + ch * 0.60;
    const hubR = ch * 0.085, tapeMax = ch * 0.20;
    const rL = hubR + (tapeMax - hubR) * (1 - p), rR = hubR + (tapeMax - hubR) * p;
    ctx.fillStyle = '#0e0c0a';
    ctx.beginPath(); ctx.roundRect(cx - cw * 0.34, ry - tapeMax - 6, cw * 0.68, tapeMax * 2 + 12, 10); ctx.fill();
    if (playing) { st.rotL += 2.6 / rL; st.rotR += 2.6 / rR; }
    for (const [rx, rr, rot] of [[cx - cw * 0.2, rL, st.rotL], [cx + cw * 0.2, rR, st.rotR]]) {
      ctx.fillStyle = '#33261a';                   // the tape pancake
      ctx.beginPath(); ctx.arc(rx, ry, rr, 0, 7); ctx.fill();
      ctx.fillStyle = '#c8c2b2';                   // hub with teeth
      ctx.beginPath(); ctx.arc(rx, ry, hubR * 0.72, 0, 7); ctx.fill();
      ctx.strokeStyle = '#4a453c';
      ctx.lineWidth = 3;
      for (let k = 0; k < 6; k++) {
        const an = rot + k * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(rx + Math.cos(an) * hubR * 0.2, ry + Math.sin(an) * hubR * 0.2);
        ctx.lineTo(rx + Math.cos(an) * hubR * 0.62, ry + Math.sin(an) * hubR * 0.62);
        ctx.stroke();
      }
    }
    // tape run: down past the rollers, across the heads — the LIVE wire
    const hy = y0 + ch + 14;
    ctx.strokeStyle = '#4a3423';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - cw * 0.2 - rL, ry);
    ctx.lineTo(cx - cw * 0.30, hy);
    ctx.moveTo(cx + cw * 0.2 + rR, ry);
    ctx.lineTo(cx + cw * 0.30, hy);
    ctx.stroke();
    ctx.strokeStyle = lastGasp ? '#c98a6a' : '#b98a2e';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    const span0 = cx - cw * 0.30, span1 = cx + cw * 0.30;
    for (let i = 0; i <= 90; i++) {
      const f = i / 90;
      const w = this.wave[Math.floor(f * (this.wave.length - 1))] / 128 - 1;
      const yy = hy + w * ch * 0.06 * (0.35 + treble * 2.2) + st.judder * (Math.random() - 0.5) * 4;
      const xx = span0 + (span1 - span0) * f;
      i === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    for (const rx of [span0, span1]) {             // guide rollers
      ctx.fillStyle = '#c8c2b2';
      ctx.beginPath(); ctx.arc(rx, hy, 4, 0, 7); ctx.fill();
    }
    ctx.restore();
    // twin VU dials with needle ballistics, peak lamps going red
    const dialR = Math.min(W2 * 0.11, H2 * 0.16);
    for (const [side, key, tgt] of [[0, 'vuL', Math.min(1, bass * 1.7)], [1, 'vuR', Math.min(1, treble * 2.4)]]) {
      const dx = side ? W2 - dialR - 14 : dialR + 14, dy = H2 - 12;
      const v = st[key] += (tgt - st[key]) * (tgt > st[key] ? 0.4 : 0.09);
      ctx.fillStyle = '#e9e2cf';
      ctx.beginPath(); ctx.arc(dx, dy, dialR, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#8a8272';
      ctx.lineWidth = 1;
      for (let k = 0; k <= 8; k++) {
        const an = Math.PI + (k / 8) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(dx + Math.cos(an) * dialR * 0.8, dy + Math.sin(an) * dialR * 0.8);
        ctx.lineTo(dx + Math.cos(an) * dialR * 0.92, dy + Math.sin(an) * dialR * 0.92);
        ctx.stroke();
      }
      const nan = Math.PI + (0.06 + v * 0.88) * Math.PI;
      ctx.strokeStyle = '#26221e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx + Math.cos(nan) * dialR * 0.85, dy + Math.sin(nan) * dialR * 0.85);
      ctx.stroke();
      ctx.fillStyle = v > 0.82 ? '#d94327' : '#3a3428';
      ctx.beginPath(); ctx.arc(dx + dialR * 0.7, dy - dialR * 0.18, 3.4, 0, 7); ctx.fill();
    }
  }
  /*
    DEPARTURE BOARD — a full split-flap board. Each row's flaps flutter
    with one slice of the spectrum, destinations are real stations off
    the network, the top row carries the playing track, and every kick
    fires a full cascade like the 19:03 just got its platform.
  */
  boardRetarget(st, epoch, label) {
    const pad = (txt, n) => String(txt).slice(0, n).padEnd(n);
    for (let r = 0; r < st.rows; r++) {
      let line;
      if (r === 0) line = pad(`NOW PLAYING  ${label}`, st.cols);
      else {
        const name = st.stations[(epoch * 7 + r * 13) % st.stations.length];
        const hh = String((17 + ((epoch + r) % 6))).padStart(2, '0');
        const mm = String((epoch * 11 + r * 17) % 60).padStart(2, '0');
        line = pad(`${hh}:${mm}  ${pad(name, st.cols - 9)} ${1 + ((epoch + r * 3) % 9)}`, st.cols);
      }
      st.targets[r] = line;
      st.spin[r] = [...line].map((_, c) => 3 + c * 0.55 + r * 1.6);
    }
  }
  vBoard(ctx, W2, H2, au) {
    const { kick, t } = au;
    const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·:&\'- ';
    const rowH = Math.max(24, Math.min(36, H2 / 7.5));
    const cols = Math.max(16, Math.min(26, Math.floor(W2 / 15)));
    const rows = Math.max(4, Math.floor((H2 - 14) / rowH));
    let st = this.boardSt;
    if (!st || st.rows !== rows || st.cols !== cols) {
      st = this.boardSt = { rows, cols, epoch: 0, targets: [], spin: [], lastCascade: 0,
        stations: Object.keys(NETWORK.pos ?? { LONDON: 1 }) };
      this.boardRetarget(st, 0, this.jb.current?.label || '');
      st.spin = st.spin.map(row => row.map(() => 0));
    }
    if ((kick && t - st.lastCascade > 1.4) || (st.label !== this.jb.current?.label)) {
      st.label = this.jb.current?.label || '';
      st.epoch++;
      this.boardRetarget(st, st.epoch, st.label);
      st.lastCascade = t;
    }
    ctx.fillStyle = '#0b0a09';
    ctx.fillRect(0, 0, W2, H2);
    const cellW = (W2 - 12) / cols;
    const fpx = Math.min(rowH * 0.62, cellW * 1.5);
    ctx.font = `bold ${fpx}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    // per-row flutter: a row's slice of the spectrum respins its cells
    for (let r = 0; r < rows; r++) {
      const b0 = 4 + r * 40, b1 = b0 + 36;
      let e = 0;
      for (let i = b0; i < b1; i++) e += this.bins[i];
      e /= (b1 - b0) * 255;
      const y = 8 + r * rowH;
      for (let c = 0; c < cols; c++) {
        if (st.spin[r][c] <= 0 && Math.random() < e * 0.10) st.spin[r][c] = 1 + Math.random() * 4;
        const spinning = st.spin[r][c] > 0;
        if (spinning) st.spin[r][c] -= 1;
        const chTarget = st.targets[r][c] || ' ';
        const chNow = spinning ? CH[Math.floor(Math.random() * CH.length)] : chTarget;
        const x = 6 + c * cellW;
        ctx.fillStyle = '#161310';
        ctx.beginPath(); ctx.roundRect(x + 0.5, y, cellW - 1.5, rowH - 4, 3); ctx.fill();
        ctx.fillStyle = r === 0 ? '#9fe3b0' : spinning ? '#8a7440' : '#f0b64e';
        ctx.fillText(chNow, x + cellW / 2, y + rowH * 0.68);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';      // the flap hinge
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x + 1, y + (rowH - 4) / 2); ctx.lineTo(x + cellW - 1, y + (rowH - 4) / 2); ctx.stroke();
      }
    }
  }
  /*
    NIGHT MAIL — the travelling post office. Pigeonholes ARE the
    spectrum (each column fills with its band), letters fly to the
    loudest hole, lineside poles whip past the window at tempo, and
    the carriage sways on the bass. This is the night mail crossing
    the border, bringing the cheque and the postal order.
  */
  vNightMail(ctx, W2, H2, au) {
    const { bass, mids, kick, t } = au;
    const st = this.mail ??= { letters: [], fill: new Array(11).fill(0), poleX: 0 };
    ctx.fillStyle = '#191009';
    ctx.fillRect(0, 0, W2, H2);
    ctx.save();
    ctx.translate(Math.sin(t * 1.7) * (1 + bass * 3), Math.cos(t * 2.3) * bass * 2);
    // the window: night country flying past
    const winX = 10, winY = H2 * 0.09, winW = W2 * 0.28, winH = H2 * 0.56;
    ctx.beginPath(); ctx.roundRect(winX, winY, winW, winH, 10);
    ctx.fillStyle = '#0b1120'; ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#e9e2cf';
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(winX + winW * 0.7, winY + winH * 0.22, 9, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    st.poleX -= 3 + mids * 15;                    // poles at tempo
    const gap = 84;
    if (st.poleX < -gap) st.poleX += gap;
    ctx.strokeStyle = '#05070d';
    ctx.lineWidth = 3;
    for (let x = st.poleX; x < winW + gap; x += gap) {
      ctx.beginPath();
      ctx.moveTo(winX + x, winY + winH);
      ctx.lineTo(winX + x, winY + winH * 0.3);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();                            // the sagging wire
      ctx.moveTo(winX + x, winY + winH * 0.34);
      ctx.quadraticCurveTo(winX + x + gap / 2, winY + winH * 0.42, winX + x + gap, winY + winH * 0.34);
      ctx.stroke();
      ctx.lineWidth = 3;
    }
    ctx.restore();
    ctx.strokeStyle = '#3a2c1c';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(winX, winY, winW, winH, 10); ctx.stroke();
    // the pigeonhole wall: one column per band, filled by loudness
    const gx = winX + winW + 16, gw = W2 - gx - 12, gy = H2 * 0.08, gh = H2 * 0.60;
    const nCols = st.fill.length, cw = gw / nCols, slots = 6, sh = gh / slots;
    let loud = 0, loudC = 0;
    for (let c = 0; c < nCols; c++) {
      const b0 = 4 + c * 38;
      let v = 0;
      for (let i = b0; i < b0 + 34; i++) v += this.bins[i];
      v /= 34 * 255;
      if (v > loud) { loud = v; loudC = c; }
      st.fill[c] += (v - st.fill[c]) * 0.22;
      const filled = Math.round(st.fill[c] * slots);
      for (let r2 = 0; r2 < slots; r2++) {
        const x = gx + c * cw, y = gy + gh - (r2 + 1) * sh;
        ctx.strokeStyle = '#3a2c1c';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x + 1, y + 1, cw - 2, sh - 2);
        if (r2 < filled) {
          ctx.fillStyle = r2 === filled - 1 ? '#f5ecd4' : '#d8c8a4';
          ctx.fillRect(x + 3, y + sh * 0.3, cw - 6, sh * 0.55);
          ctx.fillStyle = '#d94327';
          ctx.fillRect(x + cw - 8, y + sh * 0.36, 3, 3);
        }
      }
    }
    // letters fly from the sorting desk to the loudest hole
    const burst = (kick ? 5 : 0) + ((bass + mids) > 0.5 && Math.random() < 0.5 ? 1 : 0);
    for (let k = 0; k < burst; k++) {
      const c = Math.random() < 0.6 ? loudC : Math.floor(Math.random() * nCols);
      st.letters.push({ x: W2 * 0.45 + Math.random() * W2 * 0.2, y: H2 * 0.88,
        tx: gx + c * cw + cw / 2, ty: gy + gh - (st.fill[c] * gh) - 6, k: 0 });
    }
    for (let i = st.letters.length - 1; i >= 0; i--) {
      const L = st.letters[i];
      L.k += 0.045;
      if (L.k >= 1) { st.letters.splice(i, 1); continue; }
      const mx = (L.x + L.tx) / 2, my = Math.min(L.y, L.ty) - H2 * 0.18;
      const q = L.k, iq = 1 - q;
      const x = iq * iq * L.x + 2 * iq * q * mx + q * q * L.tx;
      const y = iq * iq * L.y + 2 * iq * q * my + q * q * L.ty;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(L.k * 9) * 0.4);
      ctx.fillStyle = '#f5ecd4';
      ctx.fillRect(-6, -4, 12, 8);
      ctx.fillStyle = '#d94327';
      ctx.fillRect(3, -3, 2.4, 2.4);
      ctx.restore();
    }
    // the sorting desk, and the robin supervising the frame
    ctx.fillStyle = '#241a10';
    ctx.fillRect(W2 * 0.36, H2 * 0.86, W2 * 0.5, H2 * 0.05);
    drawBird(ctx, 'robin', { x: gx - 8, y: gy + gh + 16, size: 15, facing: 1, phase: t * 4, pose: 'stand' });
    ctx.restore();
  }
  /*
    NIGHT BUS — rain on the top-deck front window. The city beyond is
    bokeh that is secretly the spectrum, treble seeds the drops, and
    the wiper sweeps on the kick, clearing the glass for a beat.
  */
  vNightBus(ctx, W2, H2, au) {
    const { mids, treble, kick, t } = au;
    let st = this.bus;
    if (!st || st.w !== W2 || st.h !== H2) {
      st = this.bus = { w: W2, h: H2, drops: [], lights: [], wipe: -1 };
      for (let i = 0; i < 26; i++) st.lights.push({
        x: Math.random() * (W2 + 60) - 30, y: H2 * (0.2 + Math.random() * 0.6),
        r: 5 + Math.random() * 16, band: 3 + Math.floor(Math.random() * 9) * 40,
        hue: [345, 30, 55, 140, 190, 260, 320][i % 7], near: Math.random() < 0.5 });
    }
    const grad = ctx.createLinearGradient(0, 0, 0, H2);
    grad.addColorStop(0, '#05070e');
    grad.addColorStop(1, '#0c1018');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W2, H2);
    // bokeh city: brightness is that light's slice of the spectrum
    ctx.globalCompositeOperation = 'lighter';
    for (const L of st.lights) {
      L.x -= (0.25 + mids * 1.6) * (L.near ? 1.5 : 0.6);
      if (L.x < -40) { L.x = W2 + 40; L.y = H2 * (0.2 + Math.random() * 0.6); }
      let v = 0;
      for (let i = L.band; i < L.band + 30; i++) v += this.bins[i];
      v /= 30 * 255;
      const rr = L.r * (0.7 + v * 1.7);
      const g2 = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, rr);
      g2.addColorStop(0, `hsla(${L.hue}, 65%, 72%, ${0.14 + v * 0.3})`);
      g2.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(L.x, L.y, rr, 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // rain: treble seeds it, gravity does the rest
    const seed = 1 + Math.floor(treble * 7);
    for (let k = 0; k < seed; k++) {
      if (st.drops.length < 160) st.drops.push({
        x: Math.random() * W2, y: -4 + Math.random() * H2 * 0.3,
        vy: 0.4 + Math.random() * 1.2, r: 1 + Math.random() * 2.2 });
    }
    ctx.strokeStyle = 'rgba(190, 214, 240, 0.4)';
    ctx.lineCap = 'round';
    for (let i = st.drops.length - 1; i >= 0; i--) {
      const d = st.drops[i];
      d.vy = Math.min(3.2, d.vy + 0.035 * d.r);
      d.y += d.vy;
      d.x += Math.sin(d.y * 0.05 + d.r) * 0.4;
      if (d.y > H2 + 6) { st.drops.splice(i, 1); continue; }
      ctx.lineWidth = d.r;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y - d.vy * 4);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }
    // the wiper answers the kick
    if (kick && st.wipe < 0) st.wipe = 0;
    if (st.wipe >= 0) {
      st.wipe += 0.05;
      const px = W2 * 0.6, py = H2 + 24, arm = H2 * 1.02;
      const an = -Math.PI * 0.88 + st.wipe * Math.PI * 0.76;
      st.drops = st.drops.filter(d => {
        const da = Math.atan2(d.y - py, d.x - px);
        return Math.abs(da - an) > 0.16;
      });
      ctx.strokeStyle = '#04050a';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(an) * arm, py + Math.sin(an) * arm);
      ctx.stroke();
      ctx.strokeStyle = '#1a2130';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      if (st.wipe >= 1) st.wipe = -1;
    }
    // the deck rail, and breath on the corners of the glass
    ctx.fillStyle = '#04050a';
    ctx.beginPath(); ctx.roundRect(-8, H2 - 22, W2 + 16, 30, 8); ctx.fill();
    const fog = ctx.createRadialGradient(W2 / 2, H2 * 0.55, H2 * 0.4, W2 / 2, H2 * 0.55, H2);
    fog.addColorStop(0, 'rgba(8, 10, 16, 0)');
    fog.addColorStop(1, 'rgba(8, 10, 16, 0.5)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, W2, H2);
  }
  /*
    TOY THEATRE — a penny plain, tuppence coloured. Cut-paper flats
    slide in their grooves with the bands, the limelight snaps to a
    new mark on the kick, footlights are the spectrum, and the robin
    works the stage as the actor.
  */
  vTheatre(ctx, W2, H2, au) {
    const { bass, mids, treble, kick, t } = au;
    const st = this.thea ??= { spotX: 0.5, spotT: 0.5, hop: 0 };
    if (kick) { st.spotT = 0.15 + Math.random() * 0.7; st.hop = 1; }
    st.spotX += (st.spotT - st.spotX) * 0.1;
    st.hop *= 0.86;
    ctx.fillStyle = '#0d0a08';
    ctx.fillRect(0, 0, W2, H2);
    const sx = W2 * 0.1, sw = W2 * 0.8, syTop = H2 * 0.14, sh = H2 * 0.62, syBot = syTop + sh;
    ctx.save();
    ctx.beginPath(); ctx.rect(sx, syTop, sw, sh); ctx.clip();
    const sky = ctx.createLinearGradient(0, syTop, 0, syBot);   // backcloth
    sky.addColorStop(0, `hsl(228, 42%, ${7 + bass * 11}%)`);
    sky.addColorStop(1, `hsl(228, 30%, ${13 + bass * 8}%)`);
    ctx.fillStyle = sky;
    ctx.fillRect(sx, syTop, sw, sh);
    ctx.fillStyle = '#e9e2cf';
    for (let i = 0; i < 16; i++) {                              // stars on treble
      const stx = sx + ((i * 73.7) % sw), sty = syTop + ((i * 41.3) % (sh * 0.5));
      ctx.globalAlpha = 0.25 + Math.abs(Math.sin(t * 2 + i * 2)) * treble * 1.6;
      ctx.fillRect(stx, sty, 2, 2);
    }
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(sx + sw * 0.78, syTop + sh * 0.2, 11 + bass * 4, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    // two rows of rooftop flats sliding in their grooves
    for (const [row, dir, col, yF] of [[0, 1, '#141019', 0.42], [1, -1, '#0f0c12', 0.62]]) {
      const off = Math.sin(t * (0.5 + row * 0.23)) * 6 + (mids - 0.28) * 34 * dir;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(sx - 40, syBot);
      const baseY = syTop + sh * yF;
      for (let x = -40; x < sw + 40; x += 34) {
        const hh2 = 12 + ((Math.sin((x + row * 99) * 7.3) + 1) * 14);
        ctx.lineTo(sx + x + off, baseY - hh2);
        ctx.lineTo(sx + x + off + 20, baseY - hh2);
        ctx.lineTo(sx + x + off + 20, baseY - hh2 - 8 - (x % 3) * 3);
        ctx.lineTo(sx + x + off + 26, baseY - hh2 - 8 - (x % 3) * 3);
        ctx.lineTo(sx + x + off + 26, baseY - hh2);
        ctx.lineTo(sx + x + off + 34, baseY - hh2);
      }
      ctx.lineTo(sx + sw + 40, syBot);
      ctx.closePath();
      ctx.fill();
    }
    // the ground row jitters with the treble
    ctx.fillStyle = '#12160e';
    ctx.fillRect(sx, syBot - 16 + (Math.random() - 0.5) * treble * 3, sw, 20);
    // limelight, snapping to its mark
    const spx = sx + sw * st.spotX;
    const lime = ctx.createRadialGradient(spx, syBot - 10, 4, spx, syBot - 10, sh * 0.42);
    lime.addColorStop(0, `rgba(245, 236, 210, ${0.24 + bass * 0.22})`);
    lime.addColorStop(1, 'rgba(245, 236, 210, 0)');
    ctx.fillStyle = lime;
    ctx.beginPath(); ctx.ellipse(spx, syBot - 12, sh * 0.4, sh * 0.52, 0, 0, 7); ctx.fill();
    // the actor takes the light
    drawBird(ctx, 'robin', { x: spx, y: syBot - 8 - st.hop * 16, size: 24,
      facing: st.spotT >= st.spotX ? 1 : -1, phase: t * 6, pose: st.hop > 0.4 ? 'airup' : 'stand' });
    ctx.restore();
    // footlights: the spectrum as a row of little flames
    const nF = 12, fw = sw / nF;
    for (let i = 0; i < nF; i++) {
      let v = 0;
      const b0 = 4 + i * 36;
      for (let k = b0; k < b0 + 32; k++) v += this.bins[k];
      v /= 32 * 255;
      const fx = sx + fw * (i + 0.5), fy = syBot + 10;
      const fh = 4 + v * 15 + Math.random() * 2;
      ctx.fillStyle = '#3a2c1c';
      ctx.fillRect(fx - 3, fy, 6, 5);
      const fl = ctx.createRadialGradient(fx, fy - fh / 2, 0, fx, fy - fh / 2, fh);
      fl.addColorStop(0, 'rgba(255, 205, 110, 0.9)');
      fl.addColorStop(1, 'rgba(255, 140, 60, 0)');
      ctx.fillStyle = fl;
      ctx.beginPath(); ctx.ellipse(fx, fy - fh / 2, 3.2, fh / 2 + 2, 0, 0, 7); ctx.fill();
    }
    // the proscenium frames it all
    ctx.fillStyle = '#2c2013';
    ctx.fillRect(sx - 20, syTop - 14, 20, sh + 44);
    ctx.fillRect(sx + sw, syTop - 14, 20, sh + 44);
    ctx.fillRect(sx - 20, syTop - 14, sw + 40, 16);
    ctx.fillRect(sx - 20, syBot + 16, sw + 40, 14);
    ctx.strokeStyle = '#b98a2e';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx - 12, syTop - 6, sw + 24, sh + 30);
    for (const side of [0, 1]) {                                // curtain swags
      const cx2 = side ? sx + sw : sx;
      ctx.fillStyle = '#6e2015';
      ctx.beginPath();
      ctx.moveTo(cx2, syTop);
      ctx.quadraticCurveTo(cx2 + (side ? -sw * 0.2 : sw * 0.2), syTop + sh * 0.12 + Math.sin(t * 1.3) * bass * 6,
        cx2, syTop + sh * 0.34);
      ctx.closePath();
      ctx.fill();
    }
  }
    bandAt(i0, n) {
    let v = 0;
    for (let i = i0; i < i0 + n; i++) v += this.bins[i];
    return v / (n * 255);
  }
  /*
    BIRDS ON WIRES — five telegraph wires ARE a musical stave. Strong
    frequencies land birds on them at their pitch, the roll scrolls
    away like a player piano, and the kick twangs the whole stave.
  */
  vWires(ctx, W2, H2, au) {
    const { mids, kick, t } = au;
    const st = this.wr ??= { notes: [], cool: new Array(10).fill(0), twang: 0 };
    if (kick) st.twang = 1;
    st.twang *= 0.9;
    const sky = ctx.createLinearGradient(0, 0, 0, H2);
    sky.addColorStop(0, '#0b0e18');
    sky.addColorStop(1, '#181423');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W2, H2);
    ctx.fillStyle = '#e9e2cf';
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(W2 * 0.85, H2 * 0.16, 9, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    const y0 = H2 * 0.24, gap = H2 * 0.13;
    const wireY = (line, x) =>
      y0 + line * gap + Math.sin(x * 0.045 - t * 9) * st.twang * 7;
    // notes land where the loud bands sit: low band = low wire
    const scroll = 34 + mids * 60;
    for (let b = 0; b < 10; b++) {
      st.cool[b] = Math.max(0, st.cool[b] - 1 / 60);
      const v = this.bandAt(3 + b * 34, 30);
      if (v > 0.34 && !st.cool[b] && st.notes.length < 42) {
        st.cool[b] = 0.28;
        st.notes.push({ x: W2 + 14, line: 4 - (b * 4.4 / 9), sp: ['robin', 'bluetit', 'wren', 'blackbird'][b % 4], ph: Math.random() * 7 });
      }
    }
    // the stave
    ctx.strokeStyle = 'rgba(233,226,207,0.5)';
    ctx.lineWidth = 1.6;
    for (let line = 0; line < 5; line++) {
      ctx.beginPath();
      for (let x = 0; x <= W2; x += 12) {
        const y = wireY(line, x);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (const [px] of [[W2 * 0.12], [W2 * 0.88]]) {   // poles
      ctx.strokeStyle = 'rgba(20,16,12,0.9)';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(px, y0 - 24); ctx.lineTo(px, H2); ctx.stroke();
    }
    for (let i = st.notes.length - 1; i >= 0; i--) {
      const n = st.notes[i];
      n.x -= scroll / 60;
      if (n.x < -20) { st.notes.splice(i, 1); continue; }
      drawBird(ctx, n.sp, { x: n.x, y: wireY(n.line, n.x) - 6, size: 15,
        facing: -1, phase: t * 4 + n.ph, pose: 'stand' });
    }
  }
  /*
    ZOETROPE — the pre-cinema drum. The strobe locks to the music: on
    the beat the bird runs clean, off it ghosts and stutters. Bass
    tilts the drum, treble spins the crank.
  */
  vZoetrope(ctx, W2, H2, au) {
    const { bass, mids, treble, kick, t } = au;
    const st = this.zoe ??= { rot: 0, tilt: 0 };
    if (kick) st.tilt = (Math.random() < 0.5 ? -1 : 1) * 0.06;
    st.tilt *= 0.92;
    st.rot += (0.8 + mids * 3.2) / 60;
    ctx.fillStyle = '#100d0a';
    ctx.fillRect(0, 0, W2, H2);
    const cx = W2 / 2, cy = H2 * 0.52, R = Math.min(W2, H2) * 0.36;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(st.tilt * bass * 6);
    // the drum: rim, slots, inner scene
    ctx.fillStyle = '#241a10';
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
    ctx.strokeStyle = '#b98a2e';
    ctx.lineWidth = 4;
    ctx.stroke();
    const SLOTS = 12;
    for (let k = 0; k < SLOTS; k++) {
      const an = st.rot + (k / SLOTS) * Math.PI * 2;
      ctx.save();
      ctx.rotate(an);
      ctx.fillStyle = '#070503';
      ctx.fillRect(R * 0.82, -3.5, R * 0.16, 7);
      ctx.restore();
    }
    // strobe: the bird appears once per slot-pass; ghosts trail it
    const frame = Math.floor(st.rot * SLOTS);
    const poses = ['stand', 'airup', 'airdown', 'airup'];
    for (let gho = 3; gho >= 0; gho--) {
      const an = ((frame - gho) / SLOTS) * Math.PI * 2 - Math.PI / 2;
      const r2 = R * 0.55;
      ctx.save();
      ctx.translate(Math.cos(an) * r2, Math.sin(an) * r2);
      ctx.globalAlpha = gho ? 0.12 * (4 - gho) : 0.95;
      drawBird(ctx, 'robin', { x: 0, y: 0, size: R * 0.3,
        facing: 1, phase: frame, pose: poses[(frame - gho + 8) % poses.length] });
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // hub + crank spun by the treble
    ctx.fillStyle = '#b98a2e';
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
    ctx.strokeStyle = '#b98a2e';
    ctx.lineWidth = 3.4;
    const ca = t * (2 + treble * 26);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(ca) * 22, Math.sin(ca) * 22); ctx.stroke();
    ctx.restore();
    // the stand
    ctx.strokeStyle = '#241a10';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(cx, cy + R); ctx.lineTo(cx, H2 - 8); ctx.stroke();
  }
  /*
    SHIPPING FORECAST — the network as a night weather chart: isobars
    ring the loudest stations, a cold front sweeps through on the
    kick, wind barbs shiver with the treble. Cockfosters, Morden,
    Upminster: moderate or good, occasionally poor.
  */
  vForecast(ctx, W2, H2, au) {
    const { treble, kick, t } = au;
    const P = this.buildPipes(W2, H2);
    const st = this.fcst ??= { front: -1 };
    if (kick && st.front < 0) st.front = -0.1;
    if (st.front >= 0 && (st.front += 1.6 / 60) > 1.2) st.front = -1;
    ctx.fillStyle = '#0a1020';
    ctx.fillRect(0, 0, W2, H2);
    // the network as faint chart geography
    ctx.globalAlpha = 0.22;
    for (const ch of P.chains) {
      ctx.strokeStyle = '#e9e2cf';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ch.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // pressure systems: one ring-set per loud sample point
    const marks = [];
    for (let i = 0; i < 9; i++) {
      const ch = P.chains[(i * 5) % P.chains.length];
      const pt = ch.pts[(i * 13) % ch.pts.length];
      marks.push({ pt, v: this.bandAt(4 + i * 40, 34) });
    }
    for (const m of marks) {
      if (m.v < 0.1) continue;
      ctx.strokeStyle = `rgba(233,226,207,${0.25 + m.v * 0.5})`;
      ctx.lineWidth = 1.4;
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.arc(m.pt[0], m.pt[1], r * (10 + m.v * 26), 0, 7);
        ctx.stroke();
      }
      ctx.fillStyle = '#e9e2cf';
      ctx.font = 'bold 11px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.v > 0.4 ? 'L' : 'H', m.pt[0], m.pt[1] + 4);
    }
    // wind barbs shiver on a loose grid
    ctx.strokeStyle = 'rgba(233,226,207,0.4)';
    ctx.lineWidth = 1.2;
    for (let gx = 20; gx < W2; gx += 54) {
      for (let gy = 24; gy < H2; gy += 60) {
        const an = Math.sin(gx * 0.05 + t) + treble * Math.sin(t * 13 + gy);
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(an);
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
        ctx.moveTo(6, 0); ctx.lineTo(2, -4); ctx.stroke();
        ctx.restore();
      }
    }
    // the cold front marches through
    if (st.front >= 0) {
      const fx = st.front * (W2 + 80) - 40;
      ctx.strokeStyle = '#7fb4d9';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let y = 0; y <= H2; y += 10) {
        const x = fx + Math.sin(y * 0.03 + t * 2) * 14;
        y === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = '#7fb4d9';
      for (let y = 14; y < H2; y += 44) {
        const x = fx + Math.sin(y * 0.03 + t * 2) * 14;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + 9, y + 6); ctx.lineTo(x, y + 12);
        ctx.closePath(); ctx.fill();
      }
    }
    // sea areas around the edges
    ctx.fillStyle = 'rgba(233,226,207,0.55)';
    ctx.font = 'bold 10px Georgia, serif';
    ctx.textAlign = 'center';
    const areas = [['COCKFOSTERS', W2 * 0.75, 16], ['UXBRIDGE', W2 * 0.12, H2 * 0.4],
      ['MORDEN', W2 * 0.35, H2 - 10], ['UPMINSTER', W2 * 0.88, H2 * 0.55], ['EPPING', W2 * 0.3, 16]];
    for (const [nm, x, y] of areas) ctx.fillText(nm, x, y);
  }
  /*
    CRANE BALLET — the Docklands night the DLR earned: tower cranes
    swing their jibs to their own bands, hooks ride like VU meters,
    warning lamps blink the beat, and on the big kicks a plane climbs
    out of City Airport. Reflections wobble in the dock.
  */
  vCranes(ctx, W2, H2, au) {
    const { bass, kick, t } = au;
    const st = this.crn ??= { angs: new Array(6).fill(0), lamp: 0, plane: -1 };
    if (kick) { st.lamp = 1; if (bass > 0.5 && st.plane < 0) st.plane = 0; }
    st.lamp *= 0.92;
    const waterY = H2 * 0.78;
    const sky = ctx.createLinearGradient(0, 0, 0, waterY);
    sky.addColorStop(0, '#070a14');
    sky.addColorStop(1, '#141225');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W2, waterY);
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, waterY, W2, H2 - waterY);
    // low skyline
    ctx.fillStyle = '#0c0f1a';
    for (let x = 0; x < W2; x += 26) {
      const hh = 12 + ((Math.sin(x * 3.7) + 1) * 16);
      ctx.fillRect(x, waterY - hh, 22, hh);
    }
    const N = 6;
    for (let i = 0; i < N; i++) {
      const bx = W2 * (0.08 + i * 0.16), bh = H2 * (0.34 + (i % 3) * 0.09);
      const v = this.bandAt(4 + i * 60, 50);
      const target = -0.45 + v * 1.1;
      st.angs[i] += (target - st.angs[i]) * 0.06;
      const topY = waterY - bh;
      ctx.strokeStyle = '#2a2f45';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(bx, waterY); ctx.lineTo(bx, topY); ctx.stroke();
      // lattice hints
      ctx.lineWidth = 1;
      for (let y = waterY - 8; y > topY; y -= 14) {
        ctx.beginPath(); ctx.moveTo(bx - 3, y); ctx.lineTo(bx + 3, y - 7); ctx.stroke();
      }
      ctx.save();
      ctx.translate(bx, topY);
      ctx.rotate(st.angs[i] * 0.35);
      const jib = W2 * 0.11;
      ctx.strokeStyle = '#333a55';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-jib * 0.35, 0); ctx.lineTo(jib, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(jib * 0.55, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-jib * 0.3, 0); ctx.stroke();
      // hook load rides the band
      const drop = (1 - v) * bh * 0.5 + 8;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(jib * 0.85, 0); ctx.lineTo(jib * 0.85, drop); ctx.stroke();
      ctx.fillStyle = '#3d4463';
      ctx.fillRect(jib * 0.85 - 4, drop, 8, 8);
      // lamps
      ctx.fillStyle = `rgba(217,67,39,${0.25 + st.lamp * 0.75})`;
      ctx.beginPath(); ctx.arc(0, -12, 2.6, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(jib, 0, 2.2, 0, 7); ctx.fill();
      ctx.restore();
      // reflection
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = '#4a5478';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, waterY);
      ctx.lineTo(bx + Math.sin(t * 3 + i) * 4, waterY + bh * 0.3);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (st.plane >= 0) {
      st.plane += 0.008;
      if (st.plane > 1) st.plane = -1;
      else {
        const px = W2 * (0.9 - st.plane * 0.9), py = waterY - 14 - st.plane * H2 * 0.55;
        ctx.fillStyle = '#e9e2cf';
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-0.22);
        ctx.beginPath();
        ctx.moveTo(9, 0); ctx.lineTo(-7, -2); ctx.lineTo(-3, 0); ctx.lineTo(-7, 2);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = `rgba(217,67,39,${Math.sin(t * 12) > 0 ? 0.9 : 0.2})`;
        ctx.beginPath(); ctx.arc(px - 8, py, 1.6, 0, 7); ctx.fill();
      }
    }
  }
  /*
    LIFT GRAPH — the machinery the game actually simulates, made
    monumental: shafts side by side, cars riding their bands,
    counterweights answering, and every set of doors opening at once
    on the kick with the light spilling out.
  */
  vLifts(ctx, W2, H2, au) {
    const { kick, t } = au;
    const st = this.lft ??= { ys: new Array(7).fill(0.5), doors: 0 };
    if (kick) st.doors = 1;
    st.doors *= 0.9;
    ctx.fillStyle = '#12100c';
    ctx.fillRect(0, 0, W2, H2);
    const N = 7, sw = W2 / N;
    for (let f = 1; f < 5; f++) {   // floor lines behind everything
      ctx.strokeStyle = 'rgba(233,226,207,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, H2 * f / 5); ctx.lineTo(W2, H2 * f / 5); ctx.stroke();
    }
    for (let i = 0; i < N; i++) {
      const x0 = i * sw + sw * 0.16, x1 = (i + 1) * sw - sw * 0.16;
      const cxx = (x0 + x1) / 2;
      const v = this.bandAt(4 + i * 52, 46);
      const prev = st.ys[i];
      st.ys[i] += ((1 - v) - st.ys[i]) * 0.08;
      const rising = st.ys[i] < prev;
      const carH = Math.min(H2 * 0.16, sw * 0.9);
      const carY = H2 * 0.08 + st.ys[i] * (H2 * 0.78 - carH);
      // guides
      ctx.strokeStyle = 'rgba(185,138,46,0.35)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x0, H2 * 0.05); ctx.lineTo(x0, H2 * 0.94); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, H2 * 0.05); ctx.lineTo(x1, H2 * 0.94); ctx.stroke();
      // cable twangs when the car moves fast
      const sway = Math.abs(st.ys[i] - prev) * 400;
      ctx.strokeStyle = '#8a8272';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let y = H2 * 0.05; y <= carY; y += 8) {
        const xx = cxx + Math.sin(y * 0.14 + t * 22) * sway;
        y <= H2 * 0.05 ? ctx.moveTo(xx, y) : ctx.lineTo(xx, y);
      }
      ctx.stroke();
      // counterweight mirrors
      const cwY = H2 * 0.86 - st.ys[i] * (H2 * 0.7);
      ctx.fillStyle = '#241f16';
      ctx.fillRect(x1 - 5, cwY, 5, carH * 0.5);
      // the car, doors parting on the kick
      ctx.fillStyle = '#2c2418';
      ctx.strokeStyle = '#b98a2e';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.roundRect(x0 + 2, carY, x1 - x0 - 4, carH, 3); ctx.fill(); ctx.stroke();
      const open = st.doors * (x1 - x0 - 8) * 0.5;
      if (open > 1) {
        const spill = ctx.createLinearGradient(cxx, carY, cxx, carY + carH);
        spill.addColorStop(0, 'rgba(255,205,110,0.85)');
        spill.addColorStop(1, 'rgba(255,140,60,0.25)');
        ctx.fillStyle = spill;
        ctx.fillRect(cxx - open / 2, carY + 2, open, carH - 4);
      }
      // direction arrow above the shaft
      ctx.fillStyle = rising ? '#9fe3b0' : '#d97f6a';
      ctx.beginPath();
      if (rising) { ctx.moveTo(cxx, H2 * 0.025); ctx.lineTo(cxx - 5, H2 * 0.05); ctx.lineTo(cxx + 5, H2 * 0.05); }
      else { ctx.moveTo(cxx, H2 * 0.05); ctx.lineTo(cxx - 5, H2 * 0.025); ctx.lineTo(cxx + 5, H2 * 0.025); }
      ctx.closePath(); ctx.fill();
    }
  }
  /*
    DEPTH GAUGE — the FOI depths, played. A cross-section of London
    clay with real stations hanging at their true depths; the bass is
    a rising water table, the treble sparks the deep-level pockets,
    and each kick drops a lift car down a shaft.
  */
  vDepth(ctx, W2, H2, au) {
    const { bass, treble, kick, t } = au;
    let st = this.dpt;
    if (!st) {
      const rows = Object.entries(STATION_LEVELS)
        .map(([n, d]) => [n, Math.max(...Object.values(d.lines).map(l => l.depth ?? 0))])
        .filter(([, d]) => d > 0)
        .sort((a, b) => a[1] - b[1]);
      const picks = [];
      for (let i = 0; i < 12; i++) picks.push(rows[Math.floor(i * (rows.length - 1) / 11)]);
      st = this.dpt = { picks, maxD: picks[11][1], drop: -1, dropX: 0 };
    }
    if (kick && st.drop < 0) { st.drop = 0; st.dropX = Math.floor(Math.random() * 12); }
    const soil = ctx.createLinearGradient(0, 0, 0, H2);
    soil.addColorStop(0, '#2b2214');
    soil.addColorStop(0.5, '#241a10');
    soil.addColorStop(1, '#17100a');
    ctx.fillStyle = soil;
    ctx.fillRect(0, 0, W2, H2);
    for (let y = 30; y < H2; y += 34) {          // strata seams
      ctx.strokeStyle = 'rgba(16,12,8,0.5)';
      ctx.beginPath();
      for (let x = 0; x <= W2; x += 18)
        ctx.lineTo(x, y + Math.sin(x * 0.04 + y) * 3);
      ctx.stroke();
    }
    ctx.fillStyle = '#3a4a2c';                   // the street
    ctx.fillRect(0, 0, W2, 10);
    // the water table breathes with the bass
    const wY = H2 * (0.95 - bass * 0.72);
    ctx.fillStyle = 'rgba(90,116,140,0.22)';
    ctx.fillRect(0, wY, W2, H2 - wY);
    ctx.strokeStyle = 'rgba(127,180,217,0.6)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = 0; x <= W2; x += 10)
      ctx.lineTo(x, wY + Math.sin(x * 0.06 + t * 3) * 3);
    ctx.stroke();
    const colW = W2 / 12;
    ctx.textAlign = 'center';
    for (let i = 0; i < 12; i++) {
      const [name, d] = st.picks[i];
      const x = colW * (i + 0.5);
      const y = 24 + (d / st.maxD) * (H2 - 70);
      const v = this.bandAt(4 + i * 40, 34);
      // shaft
      ctx.strokeStyle = 'rgba(233,226,207,0.16)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, y - 8); ctx.stroke();
      // platform pocket, lit by its band (deep ones spark on treble)
      const deepSpark = d > st.maxD * 0.6 ? treble * 0.8 : 0;
      const lit = Math.min(1, 0.2 + v * 1.6 + deepSpark);
      ctx.fillStyle = `rgba(255,205,110,${lit * 0.85})`;
      ctx.beginPath(); ctx.roundRect(x - colW * 0.34, y - 8, colW * 0.68, 16, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(233,226,207,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(x - colW * 0.34, y - 8, colW * 0.68, 16, 4); ctx.stroke();
      if (i === 0 || i === 11) {
        ctx.fillStyle = 'rgba(233,226,207,0.75)';
        ctx.font = 'bold 9px Georgia, serif';
        ctx.fillText(`${name.split(' ')[0]} ${Math.round(d)}m`, x, y + 22);
      }
    }
    if (st.drop >= 0) {
      st.drop += 0.03;
      const [, d] = st.picks[st.dropX];
      const yTop = 12, yBot = 24 + (d / st.maxD) * (H2 - 70) - 10;
      if (st.drop > 1) st.drop = -1;
      else {
        const y = yTop + (yBot - yTop) * st.drop * st.drop;
        ctx.fillStyle = '#e9e2cf';
        ctx.fillRect(colW * (st.dropX + 0.5) - 5, y, 10, 12);
      }
    }
  }
  /*
    THAMES MURMUR — one organism, not a flock: a starling cloud over
    the river at dusk, stretched by the mids, sheared in two by the
    kick, always re-merging. The Thames itself rides underneath.
  */
  vThames(ctx, W2, H2, au) {
    const { bass, mids, kick, t } = au;
    const st = this.thm ??= { split: 0 };
    if (kick) st.split = 1;
    st.split *= 0.94;
    const dusk = ctx.createLinearGradient(0, 0, 0, H2);
    dusk.addColorStop(0, '#1a1430');
    dusk.addColorStop(0.7, '#3a2438');
    dusk.addColorStop(1, '#1c1520');
    ctx.fillStyle = dusk;
    ctx.fillRect(0, 0, W2, H2);
    // the river, silver, from the real polyline
    const th = NETWORK.thames ?? [];
    if (th.length) {
      const xs = th.map(p => p[0]), ys = th.map(p => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      const y0 = Math.min(...ys), y1 = Math.max(...ys);
      ctx.strokeStyle = 'rgba(200,214,230,0.5)';
      ctx.lineWidth = 7;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      th.forEach((p, i) => {
        const x = ((p[0] - x0) / (x1 - x0)) * W2;
        const y = H2 * 0.78 + ((p[1] - y0) / (y1 - y0 || 1)) * H2 * 0.16;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    // St Paul's on the skyline
    const skY = H2 * 0.74;
    ctx.fillStyle = '#12101c';
    ctx.fillRect(0, skY, W2, H2 * 0.06);
    ctx.beginPath();
    ctx.arc(W2 * 0.3, skY, 16, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(W2 * 0.3 - 2, skY - 22, 4, 8);
    // the murmuration: overlapping soft ellipses = one dark organism
    const cx = W2 * (0.5 + Math.sin(t * 0.4) * 0.18);
    const cy = H2 * (0.34 + Math.cos(t * 0.53) * 0.1);
    const stretch = 1 + mids * 1.6;
    ctx.fillStyle = 'rgba(20,16,22,0.85)';
    for (let arm = 0; arm < 2; arm++) {
      const off = st.split * (arm ? 1 : -1) * W2 * 0.13;
      for (let i = 0; i < 12; i++) {
        const an = t * 1.1 + i * 0.55 + arm * 3;
        const ex = cx + off + Math.cos(an) * W2 * 0.07 * stretch * (1 + i * 0.12);
        const ey = cy + Math.sin(an * 1.3) * H2 * 0.05 * (1 + i * 0.08);
        ctx.beginPath();
        ctx.ellipse(ex, ey, (14 + i * 3) * stretch, 10 + i * 2, Math.sin(an) * 0.6, 0, 7);
        ctx.fill();
      }
    }
    // stray birds on the edge of the mass
    for (let i = 0; i < 7; i++) {
      const an = t * 2 + i * 1.9;
      const ex = cx + Math.cos(an) * W2 * 0.16 * stretch;
      const ey = cy + Math.sin(an * 1.4) * H2 * 0.1 - bass * 12;
      ctx.strokeStyle = 'rgba(20,16,22,0.9)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(ex - 4, ey); ctx.quadraticCurveTo(ex, ey - 3, ex, ey);
      ctx.quadraticCurveTo(ex, ey - 3, ex + 4, ey);
      ctx.stroke();
    }
  }
  /*
    ESCALATOR HALL — the great diagonal hall from below, Piranesi by
    way of TfL: treads scroll at tempo, commuter silhouettes ride,
    and the uplighters along the balustrades ARE the spectrum,
    flaring like flashbulbs on the kick.
  */
  vEscalators(ctx, W2, H2, au) {
    const { mids, kick, t } = au;
    const st = this.esc ??= { off: 0, flare: 0, riders: [] };
    if (kick) st.flare = 1;
    st.flare *= 0.88;
    st.off += (0.6 + mids * 2.6);
    ctx.fillStyle = '#0f0c0a';
    ctx.fillRect(0, 0, W2, H2);
    // vault hint
    const vault = ctx.createRadialGradient(W2 * 0.7, H2 * 0.1, 10, W2 * 0.7, H2 * 0.1, H2);
    vault.addColorStop(0, 'rgba(185,138,46,0.13)');
    vault.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = vault;
    ctx.fillRect(0, 0, W2, H2);
    const K = 5;
    for (let k = 0; k < K; k++) {
      const f = k / (K - 1);
      const x0 = W2 * (0.02 + f * 0.16), y0 = H2 * (0.98 - f * 0.1);
      const x1 = W2 * (0.6 + f * 0.1), y1 = H2 * (0.16 - f * 0.06);
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      // balustrade
      ctx.strokeStyle = '#241f16';
      ctx.lineWidth = 10 - f * 4;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      // treads scrolling (alternate direction per stair)
      const dir = k % 2 ? 1 : -1;
      ctx.strokeStyle = 'rgba(233,226,207,0.35)';
      ctx.lineWidth = 1.4;
      const step = 17 - f * 5;
      for (let d = ((dir > 0 ? st.off : -st.off) % step + step) % step; d < len; d += step) {
        const px = x0 + ux * d, py = y0 + uy * d;
        ctx.beginPath();
        ctx.moveTo(px - uy * (6 - f * 2), py + ux * (6 - f * 2));
        ctx.lineTo(px + uy * (6 - f * 2), py - ux * (6 - f * 2));
        ctx.stroke();
      }
      // riders (sparse, silhouette)
      if (Math.random() < 0.005 && st.riders.length < 10) st.riders.push({ k, d: dir > 0 ? 0 : len, dir });
      // uplighters: the spectrum climbs the stairs
      const lamps = 9;
      for (let li = 0; li < lamps; li++) {
        const d = (li + 0.5) * len / lamps;
        const v = Math.min(1, this.bandAt(4 + ((k * lamps + li) % 10) * 40, 30) * 1.8 + st.flare * 0.7);
        const px = x0 + ux * d - uy * (8 - f * 3), py = y0 + uy * d + ux * (8 - f * 3);
        const g2 = ctx.createRadialGradient(px, py, 0, px, py, 9 + v * 14);
        g2.addColorStop(0, `rgba(255,205,110,${0.25 + v * 0.65})`);
        g2.addColorStop(1, 'rgba(255,140,60,0)');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(px, py, 9 + v * 14, 0, 7); ctx.fill();
      }
    }
    for (let i = st.riders.length - 1; i >= 0; i--) {
      const r = st.riders[i];
      const f = r.k / (K - 1);
      const x0 = W2 * (0.02 + f * 0.16), y0 = H2 * (0.98 - f * 0.1);
      const x1 = W2 * (0.6 + f * 0.1), y1 = H2 * (0.16 - f * 0.06);
      const len = Math.hypot(x1 - x0, y1 - y0);
      r.d += r.dir * (0.6 + mids * 2.6) * 0.55;
      if (r.d < 0 || r.d > len) { st.riders.splice(i, 1); continue; }
      const px = x0 + (x1 - x0) * r.d / len, py = y0 + (y1 - y0) * r.d / len;
      ctx.globalAlpha = 0.85;
      drawCommuter(ctx, { x: px, y: py - 10, size: 30 - f * 10, facing: r.dir, phase: 0, pose: 'stand', variant: r.k });
      ctx.globalAlpha = 1;
    }
  }
  /*
    PAPER AVIARY — Libby's process, live: scissors trace a bird
    outline along the sheet, the mids drive the cut, the kick snips a
    burst, and every finished bird takes colour and flies off in a
    puff of offcut confetti.
  */
  vScissors(ctx, W2, H2, au) {
    const { mids, treble, kick, t } = au;
    const st = this.cutz ??= { cut: 0, fly: -1, sp: 'robin', confetti: [] };
    ctx.fillStyle = '#171310';
    ctx.fillRect(0, 0, W2, H2);
    // the sheet
    const sx = W2 * 0.16, sy = H2 * 0.14, sw = W2 * 0.68, sh = H2 * 0.66;
    ctx.save();
    ctx.translate(2, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 4); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#e9e2cf';
    ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 4); ctx.fill();
    // the bird outline as a parametric path on the sheet
    const cx = sx + sw / 2, cy = sy + sh / 2, R = Math.min(sw, sh) * 0.33;
    const pt = k => {
      const a = k * Math.PI * 2;
      const body = 1 + 0.35 * Math.sin(a * 2 + 1.2) + 0.2 * Math.sin(a * 3 + 0.4);
      return [cx + Math.cos(a) * R * body, cy + Math.sin(a) * R * 0.72 * body];
    };
    if (st.fly < 0) {
      st.cut = Math.min(1, st.cut + (0.0012 + mids * 0.006) + (kick ? 0.05 : 0));
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#8a8272';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let k = 0; k <= st.cut; k += 0.01) {
        const [x, y] = pt(k);
        k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // the scissors at the cutting point
      const [px, py] = pt(st.cut);
      const [qx, qy] = pt(Math.min(1, st.cut + 0.02));
      const an = Math.atan2(qy - py, qx - px);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(an);
      const snip = Math.sin(t * (8 + treble * 30)) * 0.35;
      ctx.strokeStyle = '#4a453c';
      ctx.lineWidth = 2.4;
      for (const sgn of [1, -1]) {
        ctx.save();
        ctx.rotate(snip * sgn);
        ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(15, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(-8, sgn * 3.4, 3.6, 0, 7); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      if (st.cut >= 1) {
        st.fly = 0;
        for (let i = 0; i < 26; i++) st.confetti.push({
          x: cx + (Math.random() - 0.5) * R * 2, y: cy + (Math.random() - 0.5) * R,
          vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2.5, r: 2 + Math.random() * 4, a: 1 });
      }
    } else {
      // the finished bird takes wing
      st.fly += 0.012 + mids * 0.01;
      const fx = cx + st.fly * W2 * 0.5, fy = cy - st.fly * H2 * 0.5;
      drawBird(ctx, st.sp, { x: fx, y: fy, size: R * 1.1, facing: 1, phase: t * 12, pose: 'airup' });
      if (st.fly >= 1.1) {
        st.fly = -1;
        st.cut = 0;
        st.sp = ['robin', 'bluetit', 'wren', 'blackbird'][Math.floor(Math.random() * 4)];
      }
    }
    for (let i = st.confetti.length - 1; i >= 0; i--) {
      const c = st.confetti[i];
      c.x += c.vx + Math.sin(t * 6 + c.r) * treble * 2;
      c.y += c.vy;
      c.vy += 0.05;
      c.a -= 0.008;
      if (c.a <= 0) { st.confetti.splice(i, 1); continue; }
      ctx.globalAlpha = c.a;
      ctx.fillStyle = '#e9e2cf';
      ctx.fillRect(c.x, c.y, c.r, c.r * 0.7);
      ctx.globalAlpha = 1;
    }
  }
  /*
    SMELL MAP — TUBULAR SMELLS' birthright, finally visualised: each
    line exhales perfume in its own colour, plume density riding that
    line's band, and the kick puffs a scent-ring out of a station
    mouth. The whole Underground, breathing.
  */
  vSmell(ctx, W2, H2, au) {
    const { kick, t } = au;
    const P = this.buildPipes(W2, H2);
    const st = this.sml ??= { plumes: [], rings: [] };
    ctx.fillStyle = 'rgba(10,9,14,0.24)';        // fade = drift trails
    ctx.fillRect(0, 0, W2, H2);
    ctx.globalAlpha = 0.3;
    for (const ch of P.chains) {                 // the network, faint
      ctx.strokeStyle = ch.colour;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ch.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // each line breathes by its band
    for (let li = 0; li < P.chains.length; li++) {
      const ch = P.chains[li];
      const v = this.bandAt(4 + (li % 11) * 38, 32);
      if (Math.random() < v * 0.4 && st.plumes.length < 130) {
        const [x, y] = ch.pts[Math.floor(Math.random() * ch.pts.length)];
        st.plumes.push({ x, y, vy: -0.3 - Math.random() * 0.5, col: ch.colour, r: 2 + v * 5, a: 0.4, seed: Math.random() * 7 });
      }
    }
    if (kick && P.chains.length) {
      const ch = P.chains[Math.floor(Math.random() * P.chains.length)];
      const [x, y] = ch.pts[Math.floor(Math.random() * ch.pts.length)];
      st.rings.push({ x, y, r: 2, col: ch.colour, a: 0.8 });
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = st.plumes.length - 1; i >= 0; i--) {
      const pl = st.plumes[i];
      pl.x += Math.sin(t * 1.7 + pl.seed + pl.y * 0.02) * 0.7;
      pl.y += pl.vy;
      pl.r += 0.09;
      pl.a -= 0.006;
      if (pl.a <= 0) { st.plumes.splice(i, 1); continue; }
      const g2 = ctx.createRadialGradient(pl.x, pl.y, 0, pl.x, pl.y, pl.r * 2.4);
      g2.addColorStop(0, pl.col + '');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = pl.a * 0.14;
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r * 2.4, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = st.rings.length - 1; i >= 0; i--) {
      const rg = st.rings[i];
      rg.r += 1.8;
      rg.a -= 0.02;
      if (rg.a <= 0) { st.rings.splice(i, 1); continue; }
      ctx.globalAlpha = rg.a;
      ctx.strokeStyle = rg.col;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
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
    // long lines WRAP on their · seams instead of shrinking away —
    // a narrow portrait window gets more lines, never smaller type
    const namePx = Math.max(15, Math.min(21, W2 * 0.05));
    const rolePx = Math.max(12, Math.min(15, W2 * 0.037));
    const maxW = W2 - 24;
    const linesOf = name => {
      ctx.font = `bold ${namePx}px Georgia, serif`;
      if (ctx.measureText(name).width <= maxW) return [name];
      const lines = [];
      let cur = '';
      for (const part of String(name).split(' · ')) {
        const trial = cur ? cur + ' · ' + part : part;
        if (cur && ctx.measureText(trial).width > maxW) { lines.push(cur); cur = part; }
        else cur = trial;
      }
      if (cur) lines.push(cur);
      return lines;
    };
    const lay = ROLL.map(it => {
      if (it.wonder !== undefined) return { it, h: it.wonder === 1 || it.wonder === 5 ? 190 : 160 };
      const lines = linesOf(it.name);
      return { it, lines, h: (it.role ? rolePx + 10 : 0) + lines.length * (namePx + 8) + 28 };
    });
    const total = lay.reduce((a, l) => a + l.h, 0);
    this.creditScroll = (this.creditScroll || 0) + (0.4 + mids * 1.3);
    let y = H2 + 20 - (this.creditScroll % (total + H2 + 40));
    if (kick) this.credHot = 1;
    this.credHot = Math.max(0, (this.credHot || 0) - 0.03);
    for (const L of lay) {
      const it = L.it, hh = L.h;
      const yTop = y, cy = y + hh / 2;
      y += hh;
      if (cy < -hh || cy > H2 + hh) continue;
      const shim = Math.sin(t * 9 + cy * 0.05) * treble * 3;   // treble shimmer
      ctx.textAlign = 'center';
      if (it.role !== undefined) {
        let ty = yTop + 10;
        if (it.role) {
          ctx.fillStyle = '#b9a67f';
          ctx.font = `bold ${rolePx}px Georgia, serif`;
          ctx.fillText(it.role, W2 / 2 + shim, ty + rolePx);
          ty += rolePx + 10;
        }
        ctx.fillStyle = this.credHot > 0.6 ? `hsl(${(t * 160) % 360}, 85%, 78%)` : '#ecdfc2';
        for (const line of L.lines) {
          let fpx = namePx;                    // a lone over-long line still bends
          ctx.font = `bold ${fpx}px Georgia, serif`;
          while (fpx > 12 && ctx.measureText(line).width > maxW) {
            fpx -= 1;
            ctx.font = `bold ${fpx}px Georgia, serif`;
          }
          ctx.fillText(line, W2 / 2 - shim, ty + fpx);
          ty += namePx + 8;
        }
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
