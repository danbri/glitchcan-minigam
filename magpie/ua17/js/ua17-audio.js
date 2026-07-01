// Tiny procedural sound design: an ambient engine hum + friendly chimes.
// No audio files — everything is synthesised with WebAudio oscillators, so
// there is nothing for the service worker to fetch or for a zip to miss.
// The AudioContext is created lazily and resumed on the "tap to fly" gesture
// (required by browser autoplay policies anyway).

export function createAudio() {
  let ctx = null;
  let hum = null;
  let humGain = null;

  function unlock() {
    if (ctx) { ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    humGain = ctx.createGain();
    humGain.gain.value = 0.05;
    humGain.connect(ctx.destination);

    hum = [110, 138].map((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 260;
      osc.connect(filt).connect(g).connect(humGain);
      osc.start();
      return osc;
    });
  }

  function chime(freq = 660) {
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.0);
  }

  function setEngineIntensity(t) {
    // Slightly brighter/louder during climb, calmer at cruise, brighter again on descent.
    if (!humGain) return;
    const climb = Math.max(0, 1 - t * 8);
    const descent = Math.max(0, (t - 0.9) * 10);
    const intensity = Math.min(1, Math.max(climb, descent) * 0.6 + 0.4);
    humGain.gain.value = 0.03 + intensity * 0.04;
  }

  return { unlock, chime, setEngineIntensity };
}
