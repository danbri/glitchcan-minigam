/**
 * eclipse-app.js — the guide itself.
 *
 * One clock drives everything. Either it is the real clock, or it is
 * the scrubber, and every screen reads the same instant from
 * viewTime(). Two screens can never disagree about what the sky is
 * doing, because there is only one answer to ask for.
 */

import {
  EclipseCalc, DEFAULT_PLACE, PRESET_PLACES, ECLIPSE_DATE,
  clockTime, compassWords, compassShort, fistsHigh, splitDuration
} from './eclipse-calc.js';
import { SkyView } from './eclipse-sky.js';
import { Compass, drawCompass } from './eclipse-compass.js';
import { WhyDiagram, PinholeDemo, DappleDemo } from './eclipse-explain.js';
import { Speaker, Chime, buzz, ScreenAwake } from './eclipse-senses.js';

const $ = (id) => document.getElementById(id);
const STORE_PLACE = 'eclipse.place.v1';
const STORE_SPOTS = 'eclipse.spots.v1';

const SPOT_ITEMS = [
  'The light went strange and silvery',
  'Shadows looked extra sharp',
  'The air felt cooler',
  'The birds went quiet',
  'I found little crescents under a tree',
  'I made crescents with a colander',
  'I made my own pinhole picture',
  'I saw the bite through checked eclipse glasses'
];

/* Words for each part of the show. Short, because they are read on a
 * phone held at arm's length, outdoors, by an excited child. */
const PHASE_WORDS = {
  before: 'Not started yet. Get your glasses ready.',
  growing: 'It has started! The Moon is taking a bite.',
  maximum: 'This is the biggest bite. Look now!',
  shrinking: 'The Moon is sliding off again.',
  total: 'The Sun is hidden!',
  sunset: 'The Sun has gone down. The show is over here.',
  after: 'All finished. Well done for watching.',
  none: 'No eclipse here on this day.'
};

class App {
  constructor() {
    this.place = this.#loadPlace();
    this.calc = new EclipseCalc(this.place);
    this.scrubbing = false;
    this.scrubTime = null;
    this.playing = false;
    this.playStart = 0;
    this.lastMilestone = this.#loadMilestone();

    this.speaker = new Speaker();
    this.chime = new Chime();
    this.awake = new ScreenAwake();
    this.compass = new Compass();

    this.sky = new SkyView($('sky'));
    this.why = new WhyDiagram($('why'));
    this.pinhole = new PinholeDemo($('pinhole'));
    this.dapple = new DappleDemo($('dapple'));

    this.screen = 'now';
    this.textTick = 0;

    this.#wireGate();
    this.#wireTabs();
    this.#wireControls();
    this.#wirePlaces();
    this.#wireSpots();
    this.#wireCompass();

    this.renderStatic();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);

    window.addEventListener('resize', () => this.renderStatic());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.renderStatic();
    });
  }

  /* ------------ time ------------ */

  viewTime() {
    if (this.scrubTime) return this.scrubTime;
    return new Date();
  }

  isLive() { return !this.scrubTime; }

  /* ------------ storage ------------ */

  #loadPlace() {
    try {
      const raw = localStorage.getItem(STORE_PLACE);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.latitude === 'number' && typeof p.longitude === 'number') return p;
      }
    } catch (err) { /* fall through to the default */ }
    return DEFAULT_PLACE;
  }

  #savePlace() {
    try { localStorage.setItem(STORE_PLACE, JSON.stringify(this.place)); } catch (err) { /* fine */ }
  }

  #loadMilestone() {
    try { return localStorage.getItem('eclipse.milestone.v1') || ''; } catch (err) { return ''; }
  }

  #saveMilestone(key) {
    this.lastMilestone = key;
    try { localStorage.setItem('eclipse.milestone.v1', key); } catch (err) { /* fine */ }
  }

  /* ------------ the safety gate ------------ */

  #wireGate() {
    const gate = $('gate');
    const seen = (() => {
      try { return sessionStorage.getItem('eclipse.gate.v1') === 'ok'; } catch (err) { return false; }
    })();
    if (seen) gate.hidden = true;

    if (this.speaker.supported) $('gate-read').hidden = false;
    $('gate-read').addEventListener('click', () => {
      this.speaker.toggle(
        'Never look at the Sun. The Sun can hurt your eyes for ever. ' +
        'Do not look with your eyes. Do not look through sunglasses. ' +
        'Do not look through a camera, binoculars or a telescope. ' +
        'Only look through real eclipse glasses, and ask a grown up to check them first.'
      );
    });

    $('gate-ok').addEventListener('click', () => {
      gate.hidden = true;
      this.speaker.stop();
      // The first tap is the only chance to unlock sound and the screen lock.
      this.chime.unlock();
      this.awake.request();
      try { sessionStorage.setItem('eclipse.gate.v1', 'ok'); } catch (err) { /* fine */ }
      $('tab-now').focus();
    });
  }

  /* ------------ tabs ------------ */

  #wireTabs() {
    for (const tab of document.querySelectorAll('.tab')) {
      tab.addEventListener('click', () => this.showScreen(tab.dataset.screen));
    }
  }

  showScreen(name) {
    this.screen = name;
    for (const tab of document.querySelectorAll('.tab')) {
      const on = tab.dataset.screen === name;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    for (const sec of document.querySelectorAll('.screen')) {
      sec.hidden = sec.id !== `screen-${name}`;
    }
    this.speaker.stop();
    // A canvas that was hidden has no size, so redraw once it is shown.
    requestAnimationFrame(() => this.renderStatic());
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* ------------ controls ------------ */

  #wireControls() {
    const scrub = $('scrub');
    const c = this.calc.circumstances();

    const scrubToTime = (value) => {
      if (!c.first || !c.last) return null;
      const pad = 6 * 60 * 1000;   // a little air before and after
      const from = c.first.getTime() - pad;
      const to = c.last.getTime() + pad;
      return new Date(from + (to - from) * (value / 1000));
    };

    scrub.addEventListener('input', () => {
      this.playing = false;
      $('play-btn').textContent = '▶︎ Play it fast';
      this.scrubTime = scrubToTime(Number(scrub.value));
      this.renderStatic();
    });

    $('now-btn').addEventListener('click', () => {
      this.playing = false;
      $('play-btn').textContent = '▶︎ Play it fast';
      this.scrubTime = null;
      this.renderStatic();
    });

    $('play-btn').addEventListener('click', () => {
      this.chime.unlock();
      this.playing = !this.playing;
      $('play-btn').textContent = this.playing ? '❚❚ Stop' : '▶︎ Play it fast';
      if (this.playing) this.playStart = performance.now();
    });

    $('safe-read').addEventListener('click', () => {
      this.speaker.toggle(
        'The one big rule. Never look straight at the Sun. ' +
        'Your eyes have no pain sensor at the back. The Sun can burn the back of your eye, ' +
        'and you will feel nothing until later. ' +
        'The safest way to watch is to make a pinhole. You look down at the ground, not up at the sky.'
      );
    });

    $('why-read').addEventListener('click', () => {
      this.speaker.toggle(
        'The Moon goes around the Earth. It takes about one month. ' +
        'Sometimes the Moon goes right in front of the Sun. ' +
        'The Moon then makes a shadow, and the shadow falls on the Earth. ' +
        'If you stand in the shadow, you see the Sun go dark.'
      );
    });

    if (!this.speaker.supported) {
      $('safe-read').hidden = true;
      $('why-read').hidden = true;
    }
  }

  /* ------------ places ------------ */

  #wirePlaces() {
    const sheet = $('place-sheet');
    $('place-btn').addEventListener('click', () => {
      sheet.hidden = false;
      this.#renderPlaceList();
    });
    $('place-close').addEventListener('click', () => { sheet.hidden = true; });
    sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.hidden = true; });

    $('locate-btn').addEventListener('click', () => {
      const note = $('locate-note');
      if (!navigator.geolocation) {
        note.textContent = 'This browser cannot find you. Please pick a place from the list.';
        return;
      }
      note.textContent = 'Asking your phone…';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.setPlace({
            name: 'Where I am',
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            elevation: pos.coords.altitude || 0
          });
          note.textContent = 'Found you. All the times are now for your spot.';
          sheet.hidden = true;
        },
        () => {
          note.textContent = 'Could not find you. Please pick a place from the list.';
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
      );
    });
  }

  #renderPlaceList() {
    const ul = $('places');
    ul.innerHTML = '';
    for (const p of PRESET_PLACES) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.textContent = p.name;
      if (p.name === this.place.name) b.className = 'current';
      b.addEventListener('click', () => {
        this.setPlace(p);
        $('place-sheet').hidden = true;
      });
      li.append(b);
      ul.append(li);
    }
  }

  setPlace(place) {
    this.place = place;
    this.calc.setPlace(place);
    this.#savePlace();
    $('place-name').textContent = place.name;
    this.renderStatic();
  }

  /* ------------ the spotting list ------------ */

  #wireSpots() {
    const ul = $('spotlist');
    let got = [];
    try { got = JSON.parse(localStorage.getItem(STORE_SPOTS) || '[]'); } catch (err) { got = []; }

    const save = () => {
      try { localStorage.setItem(STORE_SPOTS, JSON.stringify(got)); } catch (err) { /* fine */ }
      $('score').textContent = `${got.length} of ${SPOT_ITEMS.length}`;
    };

    SPOT_ITEMS.forEach((text, i) => {
      const li = document.createElement('li');
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = got.includes(i);
      label.classList.toggle('got', box.checked);
      const span = document.createElement('span');
      span.textContent = text;
      box.addEventListener('change', () => {
        if (box.checked) {
          if (!got.includes(i)) got.push(i);
          buzz([30]);
          this.chime.play('soft');
        } else {
          got = got.filter((n) => n !== i);
        }
        label.classList.toggle('got', box.checked);
        save();
      });
      label.append(box, span);
      li.append(label);
      ul.append(li);
    });

    $('reset-spots').addEventListener('click', () => {
      got = [];
      for (const box of ul.querySelectorAll('input')) {
        box.checked = false;
        box.closest('label').classList.remove('got');
      }
      save();
    });

    save();
  }

  /* ------------ compass ------------ */

  #wireCompass() {
    const btn = $('compass-btn');
    if (!this.compass.supported) {
      btn.hidden = true;
      return;
    }
    btn.addEventListener('click', async () => {
      const ok = await this.compass.start();
      if (ok) {
        btn.hidden = true;
        $('compass-note').textContent =
          'Turn slowly until the blue arrow at the top points at the yellow Sun. ' +
          'A phone compass can be wrong near cars and buildings, so trust the word above it.';
      } else {
        $('compass-note').textContent =
          'The compass is not allowed here. Use the direction word above instead.';
      }
    });
    this.compass.onChange(() => {
      if (this.screen === 'look') this.#renderCompass();
    });
  }

  /* ------------ the loop ------------ */

  loop(now) {
    requestAnimationFrame(this.loop);
    if (document.visibilityState !== 'visible') return;

    if (this.playing) {
      const c = this.calc.circumstances();
      if (c.first && c.last) {
        const runMs = 22000;              // the whole eclipse in 22 seconds
        const t = ((now - this.playStart) % runMs) / runMs;
        const pad = 6 * 60 * 1000;
        const from = c.first.getTime() - pad;
        const to = c.last.getTime() + pad;
        this.scrubTime = new Date(from + (to - from) * t);
        $('scrub').value = String(Math.round(t * 1000));
      }
    }

    // Canvases every frame; text about six times a second, which is
    // often enough for a seconds counter and gentle on a phone battery.
    this.#renderCanvases();
    if (now - this.textTick > 160) {
      this.textTick = now;
      this.#renderText();
      if (this.isLive()) this.#checkMilestones();
    }
  }

  /** Everything that does not need to run every frame. */
  renderStatic() {
    $('place-name').textContent = this.place.name;
    this.#renderTimes();
    this.#renderCanvases();
    this.#renderText();
    this.#renderLook();
  }

  #renderCanvases() {
    const frame = this.calc.frameAt(this.viewTime());
    this.frame = frame;

    if (this.screen === 'now') {
      this.sky.draw(frame);
    } else if (this.screen === 'look') {
      this.#renderCompass();
    } else if (this.screen === 'safe') {
      this.pinhole.draw(frame);
      this.dapple.draw(frame);
    } else if (this.screen === 'why') {
      this.why.tick(performance.now());
    }
  }

  #renderCompass() {
    const frame = this.frame || this.calc.frameAt(this.viewTime());
    drawCompass($('compass'), {
      sunAzimuth: frame.sunAzimuth,
      sunAltitude: frame.sunAltitude,
      heading: this.compass.running ? this.compass.heading : null
    });
  }

  #renderText() {
    const c = this.calc.circumstances();
    const now = this.viewTime();
    const frame = this.frame || this.calc.frameAt(now);
    const phase = this.calc.phaseAt(now);

    // Status line at the top.
    const live = this.isLive();
    $('status').textContent = live
      ? PHASE_WORDS[phase]
      : `Showing ${clockTime(now)} — tap "Back to now" for the real sky`;

    // Coverage badge.
    const pct = Math.round(frame.obscuration * 100);
    $('sky-badge').textContent = frame.sunIsUp
      ? `${pct}% covered`
      : 'The Sun is down';

    // The countdown.
    const next = this.calc.nextEvent(new Date());
    if (!c.first) {
      $('count-label').textContent = 'No eclipse here';
      $('count-clock').textContent = '—';
      $('count-sub').textContent = '';
    } else if (next && live) {
      const d = splitDuration(next.at - Date.now());
      $('count-label').textContent = LABELS[next.key] || 'Next';
      $('count-clock').textContent =
        `${String(d.hours).padStart(2, '0')}:${String(d.minutes).padStart(2, '0')}:${String(d.seconds).padStart(2, '0')}`;
      $('count-sub').textContent = `at ${clockTime(next.at)}`;
    } else if (live) {
      $('count-label').textContent = 'The eclipse has finished';
      $('count-clock').textContent = '✓';
      $('count-sub').textContent = 'Use the slider to watch it again';
    } else {
      $('count-label').textContent = 'Covered right now';
      $('count-clock').textContent = `${pct}%`;
      $('count-sub').textContent = frame.sunIsUp
        ? `The Sun is ${Math.round(frame.sunAltitude)}° above the flat horizon`
        : 'The Sun is below the horizon';
    }

    $('scrub-time').textContent = live ? 'now' : clockTime(now);
    this.#renderLook();
  }

  #renderLook() {
    const frame = this.frame || this.calc.frameAt(this.viewTime());
    const word = compassWords(frame.sunAzimuth);
    $('look-answer').textContent = `Look ${word}`;
    $('look-height').textContent = frame.sunIsUp
      ? `The Sun is ${Math.round(frame.sunAltitude)} degrees up, towards ${compassShort(frame.sunAzimuth)}.`
      : 'The Sun is below the horizon now.';

    const fists = fistsHigh(frame.sunAltitude);
    const whole = Math.max(0, Math.round(fists * 2) / 2);
    $('fists').textContent = '✊'.repeat(Math.min(9, Math.max(0, Math.round(whole))));
    $('fists-text').textContent = frame.sunIsUp
      ? `That is about ${whole} fist${whole === 1 ? '' : 's'} above a flat horizon, like the sea.`
      : 'The Sun has gone below the horizon.';

    $('rooftop-note').textContent = frame.sunIsLow
      ? 'The Sun is close to the rooftops. Houses, walls and trees will hide it. Find a park, a hill, a bridge or a beach that looks out that way.'
      : 'The Sun is high enough to clear most rooftops. A garden or a street may be enough.';
  }

  #renderTimes() {
    const c = this.calc.circumstances();
    const ol = $('times');
    ol.innerHTML = '';
    const rows = [
      ['The Moon takes its first bite', c.first, 'first'],
      ['The biggest bite', c.peak, 'peak'],
      ['The Moon lets go', c.last, 'last'],
      ['The Sun sets', c.sunset, 'sunset']
    ].filter((r) => r[1]);

    const next = this.calc.nextEvent(new Date());
    for (const [name, at, key] of rows) {
      const li = document.createElement('li');
      if (at < new Date()) li.className = 'done';
      if (next && next.key === key) li.className = 'next';
      const n = document.createElement('span');
      n.className = 't-name';
      n.textContent = name;
      const w = document.createElement('span');
      w.className = 't-when';
      w.textContent = clockTime(at);
      li.append(n, w);
      ol.append(li);
    }

    const pct = Math.round(c.peakObscuration * 100);
    const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone || 'your device';
    let text = `At the biggest bite the Moon covers ${pct} per cent of the Sun from ${c.place.name}. ` +
      `Times are from your device clock (${zone}).`;
    if (c.sunsetDuringEclipse) {
      text += ' The Sun goes down before the Moon finishes, so the end happens out of sight.';
    }
    if (c.isTotalHere) {
      text += ' You are inside the dark middle of the shadow. The Sun goes completely black here.';
    }
    $('fineprint').textContent = text;

    $('why-here').textContent = c.isTotalHere
      ? 'You are in the middle of the shadow today. The Sun will go completely black for a short time. ' +
        'That is the only moment anybody may take their glasses off, and only while it is black.'
      : 'You are near the edge of the shadow, not in the middle. The middle of the shadow crosses ' +
        'Greenland, Iceland and the north of Spain today. There the Sun goes black for a minute or two.';
  }

  /** A chime and a buzz when a real moment arrives. Only when live. */
  #checkMilestones() {
    const c = this.calc.circumstances();
    const now = Date.now();
    const within = (at, ms) => at && Math.abs(now - at.getTime()) < ms;
    let key = '';
    if (within(c.first, 20000)) key = 'first';
    else if (within(c.peak, 20000)) key = 'peak';
    else if (within(c.last, 20000)) key = 'last';
    if (!key || key === this.lastMilestone) return;
    this.#saveMilestone(key);
    this.chime.play(key === 'peak' ? 'big' : 'soft');
    buzz(key === 'peak' ? [80, 60, 80, 60, 160] : [60, 80, 60]);
    if (this.speaker.supported && key === 'peak') {
      this.speaker.speak('This is the biggest bite. Glasses on before you look up.');
    }
  }
}

const LABELS = {
  first: 'The first bite comes in',
  peak: 'The biggest bite comes in',
  last: 'It is all over in',
  sunset: 'The Sun goes down in'
};

/* ---------------- boot ---------------- */

function boot() {
  try {
    window.eclipseApp = new App();
  } catch (err) {
    const status = $('status');
    if (status) {
      status.textContent = 'Something went wrong loading the sky. Please reload the page.';
    }
    console.error('[eclipse] failed to start', err);
    return;
  }
  if ('serviceWorker' in navigator) {
    // Registered after load, so it never slows down the first view.
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline is a bonus, not a need */ });
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export { App, ECLIPSE_DATE };
