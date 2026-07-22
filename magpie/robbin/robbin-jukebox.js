// <robbin-jukebox> — the top level of the screen owns the playlist.
//
// One custom element, appended to <body> at boot, is the single owner
// of custom audio: the track list (built from the tape library), the
// <audio> element, the WebAudio wiring (gain → analyser → the
// Soundtrack's bus, so the master mute rules it), the Media Session
// metadata, and the playing/paused truth. Everything else is a VIEW:
//
//   ROBBAMP (robbin-amp.js)   the Winamp window — transport buttons
//                             call in here, the LCD/playlist/visualizer
//                             read state and the analyser out
//   the tube map              song-stations light up and tap through
//                             to play(...) when CUSTOM AUDIO is on
//   the game's music brain    yields the stage while `engaged` (a
//                             user-chosen track is sounding) and takes
//                             it back on the 'jukebox-state' event
//
// Views subscribe via DOM events on the element (they bubble to
// window): 'jukebox-track' {index, track} and 'jukebox-state'
// {engaged}. Closing a view never stops the music — only ⏹/⏸ here
// changes what's sounding. That's the point: pick a song at a station,
// walk back into the game, and it plays on.
export class RobbinJukebox extends HTMLElement {
  static ensure(game) {
    let el = document.querySelector('robbin-jukebox');
    if (!el) {
      el = document.createElement('robbin-jukebox');
      el.game = game;
      document.body.appendChild(el);
    }
    return el;
  }
  connectedCallback() {
    this.style.display = 'none';        // headless: state, not chrome
    if (this.list) return;
    const st = this.game.soundtrack;
    const pretty = stem => stem.replace(/-/g, ' ').toUpperCase();
    this.list = Object.entries(st.urls).map(([name, url]) => {
      const stem = url.split('/').pop().replace(/\.mp3$/, '');
      let label = pretty(stem);
      if (name === 'engines') label += ' · THE MAP';
      if (name === 'passacaglia') label += ' · THE FLIGHT HOME';
      if (name.startsWith('st:')) label = `${name.slice(3)} · ${pretty(stem).split(' ').slice(name.slice(3).split(' ').length).join(' ')}`;
      return { name, url, label, slug: stem, station: name.startsWith('st:') ? name.slice(3) : null };
    });
    this.i = 0;
  }
  /** the audio graph is built lazily, inside a user gesture */
  ensureAudio() {
    if (this.audio) return;
    const g = this.game;
    g.foley.ensure();
    g.soundtrack.ensureGraph();
    this.audio = new Audio();
    this.audio.addEventListener('ended', () => this.next());
    for (const ev of ['play', 'pause']) {
      this.audio.addEventListener(ev, () => this.emit('jukebox-state', { engaged: this.engaged }));
    }
    const ctx = g.foley.ctx;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0.8;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    ctx.createMediaElementSource(this.audio).connect(this.gain);
    this.gain.connect(this.analyser).connect(g.soundtrack.bus);
  }
  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
  }
  /** a user-chosen track is actually sounding — the game's music yields */
  get engaged() { return !!this.audio && !!this.audio.src && !this.audio.paused; }
  get current() { return this.list[this.i]; }
  /** number (1-based) | exact slug | name substring — or -1 */
  findTrack(q) {
    if (!q && q !== 0) return -1;
    const n = Number(q);
    if (Number.isInteger(n) && n >= 1 && n <= this.list.length) return n - 1;
    let k = this.list.findIndex(tr => tr.slug === q);
    if (k >= 0) return k;
    const squash = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const needle = squash(String(q));
    if (!needle) return -1;
    return this.list.findIndex(tr => squash(`${tr.slug} ${tr.label}`).includes(needle));
  }
  indexForStation(station) {
    return this.list.findIndex(tr => tr.station === station);
  }
  play(what = this.i) {
    this.ensureAudio();
    const k = typeof what === 'number' ? what : this.findTrack(what);
    if (k < 0 || k >= this.list.length) return false;
    this.i = k;
    const tr = this.list[k];
    this.game.foley.ctx?.resume?.();
    this.audio.src = tr.url;
    this.audio.play().catch(() => {});
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: tr.label, artist: 'ROBBIN · TUBULAR SMELLS', album: 'ROBBAMP',
      });
    }
    this.emit('jukebox-track', { index: k, track: tr });
    this.emit('jukebox-state', { engaged: true });
    return true;
  }
  togglePlay() {
    this.ensureAudio();
    this.game.foley.ctx?.resume?.();
    if (!this.audio.src) return this.play(0);
    this.audio.paused ? this.audio.play().catch(() => {}) : this.audio.pause();
  }
  /** full stop: the jukebox lets go of the stage entirely */
  stop() {
    if (!this.audio) return;
    this.audio.pause();
    try { this.audio.currentTime = 0; } catch { /* not seekable yet */ }
    this.emit('jukebox-state', { engaged: false });
  }
  next() { this.play((this.i + 1) % this.list.length); }
  prev() { this.play((this.i + this.list.length - 1) % this.list.length); }
  seekTo(frac) {
    if (this.audio?.duration) this.audio.currentTime = frac * this.audio.duration;
  }
  setVolume(v) { if (this.gain) this.gain.gain.value = v; }
}
customElements.define('robbin-jukebox', RobbinJukebox);
