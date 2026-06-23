// recurrence.js — expand an RRULE into concrete occurrences within a window.
//
// Correct-over-fancy. Supported:
//   FREQ = DAILY | WEEKLY | MONTHLY | YEARLY
//   INTERVAL, COUNT, UNTIL
//   BYDAY  (WEEKLY: which weekdays; e.g. MO,WE,FR)
//   BYMONTHDAY (MONTHLY day-of-month list), BYMONTH (YEARLY month list)
//   EXDATE exclusions
//
// NOT supported (documented limits): BYSETPOS, ordinal BYDAY (e.g. 2MO),
// BYHOUR/BYMINUTE, BYWEEKNO, BYYEARDAY, and full IANA-timezone handling. Anything
// unsupported is simply ignored, so we never silently invent wrong dates — we
// just produce a simpler series.

const DAY_INDEX = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const MS_DAY = 86400000;

// Strip the time portion for all-day / date comparisons.
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function addYears(d, n) { const x = new Date(d); x.setFullYear(x.getFullYear() + n); return x; }

// Copy the wall-clock time of `start` onto a date carrying y/m/d of `proto`.
function withTimeOf(start, proto) {
  return new Date(
    proto.getFullYear(), proto.getMonth(), proto.getDate(),
    start.getHours(), start.getMinutes(), start.getSeconds(), 0,
  );
}

// Expand a single event (which may carry .rrule + .exdates) into occurrence
// start-dates that fall within [windowStart, windowEnd]. Returns Date[].
// A hard safety cap prevents runaway loops for pathological rules.
export function expandRecurrence(event, windowStart, windowEnd, cap = 1000) {
  const start = event.start instanceof Date ? event.start : new Date(event.start);
  const rule = event.rrule;
  if (!rule || !rule.freq) {
    // Non-recurring: include if it intersects the window.
    return (start >= windowStart && start <= windowEnd) ? [start] : [];
  }

  const interval = rule.interval && rule.interval > 0 ? rule.interval : 1;
  const exSet = new Set((event.exdates || []).map((d) => dayKey(new Date(d))));
  const until = rule.until ? new Date(rule.until) : null;
  const out = [];
  let produced = 0; // counts toward COUNT (every generated occurrence, even pre-window)
  let guard = 0;

  const emit = (date) => {
    produced++;
    if (exSet.has(dayKey(date))) return;               // excluded, but still counts
    if (date >= windowStart && date <= windowEnd) out.push(date);
  };

  let cursor = new Date(start);

  if (rule.freq === 'WEEKLY') {
    // Anchor to the rule's week start (default Monday). Within each active week,
    // emit the BYDAY weekdays in order; weeks step by `interval`.
    const wkst = DAY_INDEX[rule.wkst] ?? 1;
    const days = (rule.byday && rule.byday.length)
      ? rule.byday.map((d) => DAY_INDEX[d.replace(/^[+-]?\d+/, '')]).filter((n) => n != null).sort((a, b) => a - b)
      : [start.getDay()];
    // Move cursor back to the week-start of the first week.
    let weekStart = addDays(start, -((start.getDay() - wkst + 7) % 7));
    while (true) {
      for (const wd of days) {
        const offset = (wd - wkst + 7) % 7;
        const occ = withTimeOf(start, addDays(weekStart, offset));
        if (occ < start) continue;                      // don't emit before DTSTART
        if (until && occ > until) { return finalize(); }
        if (rule.count && produced >= rule.count) return finalize();
        emit(occ);
        if (out.length >= cap) return finalize();
      }
      weekStart = addDays(weekStart, 7 * interval);
      if (guard++ > 100000) break;
      if (until && weekStart > addDays(until, 7)) break;
      if (rule.count && produced >= rule.count) break;
      if (weekStart > windowEnd && out.length) break;
      if (weekStart > addYears(windowEnd, 2)) break;    // window-bounded stop
    }
    return finalize();
  }

  // DAILY / MONTHLY / YEARLY: step the cursor by the frequency.
  const step = rule.freq === 'DAILY' ? (d) => addDays(d, interval)
    : rule.freq === 'MONTHLY' ? (d) => addMonths(d, interval)
      : (d) => addYears(d, interval);

  while (true) {
    if (rule.count && produced >= rule.count) break;
    if (until && cursor > until) break;
    if (cursor > addYears(windowEnd, 2)) break;
    if (guard++ > 100000) break;

    let occs = [cursor];
    // MONTHLY with BYMONTHDAY: emit each listed day-of-month in the cursor month.
    if (rule.freq === 'MONTHLY' && rule.bymonthday && rule.bymonthday.length) {
      occs = rule.bymonthday.map((md) => {
        const dim = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
        const day = md > 0 ? md : dim + md + 1;        // negative = from month end
        if (day < 1 || day > dim) return null;
        return withTimeOf(start, new Date(cursor.getFullYear(), cursor.getMonth(), day));
      }).filter(Boolean);
    }
    // YEARLY with BYMONTH: restrict to listed months (keeping start's day).
    if (rule.freq === 'YEARLY' && rule.bymonth && rule.bymonth.length) {
      occs = rule.bymonth.map((mo) =>
        withTimeOf(start, new Date(cursor.getFullYear(), mo - 1, start.getDate())));
    }

    for (const occ of occs) {
      if (occ < start) continue;
      if (until && occ > until) { break; }
      if (rule.count && produced >= rule.count) break;
      emit(occ);
      if (out.length >= cap) break;
    }
    cursor = step(cursor);
    if (out.length >= cap) break;
  }
  return finalize();

  function finalize() {
    // De-dupe + sort (BYMONTHDAY/BYDAY can re-emit) and keep within window.
    const seen = new Set();
    return out
      .filter((d) => { const k = d.getTime(); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => a - b);
  }
}

function dayKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

// Human-readable summary of an RRULE for the UI ("Weekly on Mon, Wed").
export function describeRRule(rule) {
  if (!rule || !rule.freq) return 'Does not repeat';
  const every = rule.interval && rule.interval > 1 ? `every ${rule.interval} ` : '';
  const base = {
    DAILY: `${every}day${rule.interval > 1 ? 's' : ''}`,
    WEEKLY: `${every}week${rule.interval > 1 ? 's' : ''}`,
    MONTHLY: `${every}month${rule.interval > 1 ? 's' : ''}`,
    YEARLY: `${every}year${rule.interval > 1 ? 's' : ''}`,
  }[rule.freq] || rule.freq.toLowerCase();
  const NAMES = { SU: 'Sun', MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat' };
  let s = `Every ${base}`;
  if (rule.byday && rule.byday.length) s += ` on ${rule.byday.map((d) => NAMES[d] || d).join(', ')}`;
  if (rule.count) s += `, ${rule.count} times`;
  else if (rule.until) s += `, until ${rule.until.toLocaleDateString()}`;
  return s;
}

export { sameDay, MS_DAY, addDays };
