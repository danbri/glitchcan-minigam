// alarms.js — turn VALARM triggers / event reminders into due notifications.
//
// Two surfaces, both graceful:
//   1. In-app: a `due` event is dispatched for any reminder whose fire-time has
//      arrived; the app shows it inline. This always works, headless included.
//   2. OS-level: the Notification API is used *only* when permission is granted.
//      When unsupported or denied it's a silent no-op — nothing throws.
//
// Triggers are ISO-8601 durations relative to the occurrence start (e.g.
// "-PT15M" = 15 minutes before) or, less commonly, absolute date-times.

// Parse an iCalendar duration like "-PT1H30M" / "P2D" into milliseconds.
// Returns a signed number; negative means "before" the reference time.
export function parseDuration(dur) {
  const m = /^([+-]?)P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(dur).trim());
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  const [, , w, d, h, mi, s] = m;
  const ms = (((+w || 0) * 7 + (+d || 0)) * 86400 + (+h || 0) * 3600 + (+mi || 0) * 60 + (+s || 0)) * 1000;
  return sign * ms;
}

// Compute the absolute fire-time (Date) of an alarm for a given occurrence.
// `occurrenceStart` is the concrete start of the (possibly recurring) instance.
export function alarmFireTime(alarm, occurrenceStart, occurrenceEnd) {
  const trig = alarm.trigger;
  if (!trig) return null;
  // Absolute trigger: VALUE=DATE-TIME or a bare YYYYMMDDTHHMMSSZ string.
  if ((alarm.triggerParams && alarm.triggerParams.VALUE === 'DATE-TIME') || /^\d{8}T\d{6}Z?$/.test(trig)) {
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(trig);
    if (m) {
      const [, y, mo, d, h, mi, s, z] = m;
      return z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)) : new Date(+y, +mo - 1, +d, +h, +mi, +s);
    }
    return new Date(trig);
  }
  // Relative trigger — RELATED=END anchors to the end, otherwise the start.
  const base = (alarm.triggerParams && alarm.triggerParams.RELATED === 'END' && occurrenceEnd)
    ? occurrenceEnd : occurrenceStart;
  return new Date(base.getTime() + parseDuration(trig));
}

export class AlarmScheduler extends EventTarget {
  constructor() {
    super();
    this._timer = null;
    this._fired = new Set(); // dedupe key: `${uid}|${fireTime}`
  }

  // Notification permission helpers (all guarded for headless / unsupported).
  get notificationsSupported() { return typeof Notification !== 'undefined'; }
  get notificationsGranted() { return this.notificationsSupported && Notification.permission === 'granted'; }
  async requestPermission() {
    if (!this.notificationsSupported) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    try { return await Notification.requestPermission(); } catch { return 'denied'; }
  }

  // Begin polling. `provider()` must return an array of due-candidate reminders:
  //   { event, occurrence: Date, fireTime: Date, text }
  start(provider, intervalMs = 30000) {
    this.stop();
    this._provider = provider;
    this._tick();
    this._timer = setInterval(() => this._tick(), intervalMs);
  }
  stop() { if (this._timer) clearInterval(this._timer); this._timer = null; }

  // Evaluate now; surface any reminder whose fireTime <= now and not yet fired.
  // Returns the list of newly-due reminders (used by the headless test).
  checkDue(now = new Date()) {
    const candidates = this._provider ? this._provider() : [];
    const newlyDue = [];
    for (const r of candidates) {
      if (!r.fireTime) continue;
      const key = `${r.event.uid || r.event.id}|${r.fireTime.getTime()}`;
      if (this._fired.has(key)) continue;
      if (r.fireTime.getTime() <= now.getTime()) {
        this._fired.add(key);
        newlyDue.push(r);
        this._surface(r);
      }
    }
    return newlyDue;
  }
  _tick() { this.checkDue(new Date()); }

  _surface(reminder) {
    // In-app first (always), then OS notification when permitted.
    this.dispatchEvent(new CustomEvent('due', { detail: reminder }));
    if (this.notificationsGranted) {
      try {
        // eslint-disable-next-line no-new
        new Notification(reminder.event.summary || 'Reminder', {
          body: reminder.text || '', tag: reminder.event.uid || reminder.event.id,
        });
      } catch { /* OS refused — in-app surfacing already happened */ }
    }
  }

  // Reset dedupe memory (e.g. after data reload).
  reset() { this._fired.clear(); }
}
