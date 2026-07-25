// FoafAudio — volume and mute as an OS service.
//
// Until now every sound source in the shell had its own idea of loudness
// and none of them could be turned down: no mute control, no volume, no
// way to shut a looping mp3 up except closing the tab. On a phone that is
// the difference between "I'll try this on the bus" and "not now".
//
// The hard part is honest: a guest runs in a sandboxed iframe with its
// own AudioContext, and the shell CANNOT reach into it. There is no
// `iframe.volume`. So a master volume is only real for sources that
// cooperate:
//
//   · same-document sources (FinkAudio, FinkFoley) — the shell owns
//     their gain directly, so they always obey
//   · guests that answer the `audio` conformance probe — told the level,
//     they apply it
//   · guests that do not answer — CANNOT be turned down, and the shell
//     says so rather than showing a slider that quietly lies
//
// That last case is why the control reports coverage. A mute button that
// silences three of four sources and pretends otherwise is worse than one
// that admits it.

export const AUDIO_KEY = 'foafos.audio';

export class FoafAudio {
  constructor({ bus = null, storage = null } = {}) {
    this.bus = bus;
    this.storage = storage;
    this.volume = 1;        // 0..1, the master level
    this.muted = false;
    this.sinks = new Map(); // id → { apply(level), label, kind }
    this._load();
  }

  /**
   * The level everything should actually play at. Mute is kept separate
   * from volume so unmuting returns you to where you were, which is what
   * every hardware volume control in the world does.
   */
  get level() { return this.muted ? 0 : this.volume; }

  /**
   * Register something that can be turned down.
   * `apply(level)` must be idempotent — it is called on every change and
   * again whenever a sink is added.
   */
  register(id, apply, { label = id, kind = 'local' } = {}) {
    this.sinks.set(id, { apply, label, kind });
    try { apply(this.level); } catch (e) { /* a bad sink must not break the rest */ }
    this._announce();
    return () => this.unregister(id);
  }

  unregister(id) {
    if (this.sinks.delete(id)) this._announce();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v) || 0));
    // Nudging the slider up from silence is an unmute — anything else
    // makes the control feel broken.
    if (this.volume > 0 && this.muted) this.muted = false;
    this._apply();
  }

  setMuted(m) { this.muted = !!m; this._apply(); }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  /**
   * What fraction of the noise we can actually govern. `uncovered` names
   * the sources that will keep playing through a mute — the honest part
   * of the UI.
   */
  coverage() {
    const all = [...this.sinks.values()];
    const uncovered = all.filter(s => s.kind === 'uncontrollable').map(s => s.label);
    return { total: all.length, governed: all.length - uncovered.length, uncovered };
  }

  _apply() {
    for (const [id, sink] of this.sinks) {
      try { sink.apply(this.level); }
      catch (e) { this.bus?.publish('audio.sink.failed', { summary: `${id} would not take the level`, id }); }
    }
    this._save();
    this._announce();
  }

  _announce() {
    const c = this.coverage();
    this.bus?.publish('audio.volume', {
      summary: this.muted ? 'Muted'
        : `Volume ${Math.round(this.volume * 100)}%`
          + (c.uncovered.length ? ` — ${c.uncovered.length} source(s) cannot be turned down` : ''),
      volume: this.volume, muted: this.muted, level: this.level, coverage: c,
    }, { retain: true });
  }

  _save() {
    try {
      this.storage?.setItem(AUDIO_KEY, JSON.stringify({ volume: this.volume, muted: this.muted }));
    } catch (e) { /* sealed/absent storage is fine — the level is just not remembered */ }
  }

  _load() {
    try {
      const raw = this.storage?.getItem(AUDIO_KEY);
      if (!raw) return;
      const v = JSON.parse(raw);
      if (typeof v.volume === 'number') this.volume = Math.max(0, Math.min(1, v.volume));
      this.muted = !!v.muted;
    } catch (e) { /* corrupt entry: start at full volume rather than silent */ }
  }
}
