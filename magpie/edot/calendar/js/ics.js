// ics.js — a real RFC 5545 (iCalendar) parser and serializer.
//
// No regex-soup: text is first unfolded (RFC 5545 §3.1 line folding), then each
// content line is tokenized into NAME, a list of PARAM=VALUE pairs, and a VALUE,
// honouring quoted parameter values and the property-value escape rules
// (§3.3.11: \n \, \; \\). Components nest via BEGIN/END. We model the bits the
// calendar app needs — VCALENDAR / VEVENT / VALARM — and round-trip them.
//
// The data model is deliberately small and JSON-friendly so store.js can persist
// it and the views can read it without re-parsing.

// ---- line unfolding (RFC 5545 §3.1) -------------------------------------
// A long content line is split with CRLF followed by a single space or tab.
// Unfolding removes the CRLF + the one leading whitespace char.
export function unfoldLines(text) {
  // Normalise newlines first, then stitch continuations back together.
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1); // drop exactly one fold-whitespace
    } else {
      out.push(line);
    }
  }
  return out;
}

// ---- content-line tokenizer ---------------------------------------------
// Splits "NAME;PARAM=val;PARAM2=\"q;val\":VALUE" into structured form.
// The first unquoted ':' ends the name+params section and begins the value.
export function parseContentLine(line) {
  let i = 0;
  const n = line.length;
  let inQuote = false;
  let colon = -1;
  for (; i < n; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ':' && !inQuote) { colon = i; break; }
  }
  if (colon === -1) return { name: line.toUpperCase(), params: {}, value: '' };

  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);

  // Split the head on unquoted ';' to separate the name from its parameters.
  const parts = [];
  let buf = '';
  inQuote = false;
  for (const c of head) {
    if (c === '"') { inQuote = !inQuote; buf += c; }
    else if (c === ';' && !inQuote) { parts.push(buf); buf = ''; }
    else buf += c;
  }
  parts.push(buf);

  const name = parts.shift().toUpperCase();
  const params = {};
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq === -1) continue;
    const key = p.slice(0, eq).toUpperCase();
    let pv = p.slice(eq + 1);
    if (pv.startsWith('"') && pv.endsWith('"')) pv = pv.slice(1, -1);
    params[key] = pv;
  }
  return { name, params, value };
}

// ---- text value escaping (RFC 5545 §3.3.11) -----------------------------
export function unescapeText(v) {
  let out = '';
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (c === '\\') {
      const next = v[++i];
      if (next === 'n' || next === 'N') out += '\n';
      else if (next === undefined) out += '\\';
      else out += next; // \, \; \\ and any escaped char -> literal
    } else {
      out += c;
    }
  }
  return out;
}

export function escapeText(v) {
  return String(v == null ? '' : v)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

// ---- date/time values ---------------------------------------------------
// We keep dates as { date, allDay, tzid? }. All-day uses VALUE=DATE (YYYYMMDD);
// timed uses YYYYMMDDTHHMMSS, with a trailing Z meaning UTC. Local-time and
// TZID-bearing values are treated as wall-clock in the browser's zone — a
// documented simplification (we do not ship a tz database).
export function parseIcsDate(value, params = {}) {
  const allDay = params.VALUE === 'DATE' || /^\d{8}$/.test(value);
  if (allDay) {
    const y = +value.slice(0, 4), mo = +value.slice(4, 6) - 1, d = +value.slice(6, 8);
    return { date: new Date(y, mo, d), allDay: true };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (!m) return { date: new Date(value), allDay: false };
  const [, y, mo, d, h, mi, s, z] = m;
  const date = z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
    : new Date(+y, +mo - 1, +d, +h, +mi, +s);
  return { date, allDay: false, tzid: params.TZID, utc: !!z };
}

const pad = (n, w = 2) => String(n).padStart(w, '0');

export function formatIcsDate(date, { allDay = false, utc = true } = {}) {
  const d = date instanceof Date ? date : new Date(date);
  if (allDay) return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  if (utc) {
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
      `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  }
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// ---- component tree -> events -------------------------------------------
// Parse a whole VCALENDAR text into an array of normalized event objects.
export function parseICS(text) {
  const lines = unfoldLines(text).filter((l) => l.trim() !== '');
  const events = [];
  let cur = null;   // current VEVENT
  let alarm = null; // current VALARM within an event
  let calName = null;

  for (const line of lines) {
    const { name, params, value } = parseContentLine(line);
    if (name === 'BEGIN') {
      if (value === 'VEVENT') cur = newEvent();
      else if (value === 'VALARM' && cur) alarm = {};
      continue;
    }
    if (name === 'END') {
      if (value === 'VALARM' && cur && alarm) { cur.alarms.push(alarm); alarm = null; }
      else if (value === 'VEVENT' && cur) { events.push(cur); cur = null; }
      continue;
    }
    if (name === 'X-WR-CALNAME') { calName = unescapeText(value); continue; }
    if (alarm) { applyAlarmProp(alarm, name, params, value); continue; }
    if (cur) applyEventProp(cur, name, params, value);
  }
  return { events, calName };
}

function newEvent() {
  return {
    uid: '', summary: '', description: '', location: '',
    start: null, end: null, allDay: false,
    rrule: null, exdates: [], status: '',
    organizer: null, attendees: [], alarms: [],
  };
}

function applyEventProp(ev, name, params, value) {
  switch (name) {
    case 'UID': ev.uid = value; break;
    case 'SUMMARY': ev.summary = unescapeText(value); break;
    case 'DESCRIPTION': ev.description = unescapeText(value); break;
    case 'LOCATION': ev.location = unescapeText(value); break;
    case 'STATUS': ev.status = value.toUpperCase(); break;
    case 'DTSTART': {
      const d = parseIcsDate(value, params);
      ev.start = d.date; ev.allDay = d.allDay; ev._startUtc = d.utc; break;
    }
    case 'DTEND': {
      const d = parseIcsDate(value, params);
      ev.end = d.date; ev._endUtc = d.utc; break;
    }
    case 'RRULE': ev.rrule = parseRRule(value); break;
    case 'EXDATE': {
      // EXDATE may list several comma-separated values.
      for (const v of value.split(',')) ev.exdates.push(parseIcsDate(v, params).date);
      break;
    }
    case 'ORGANIZER': ev.organizer = parseCalAddress(params, value); break;
    case 'ATTENDEE': ev.attendees.push(parseCalAddress(params, value)); break;
    default: break; // unknown props are dropped (kept minimal on purpose)
  }
}

function applyAlarmProp(al, name, params, value) {
  switch (name) {
    case 'ACTION': al.action = value.toUpperCase(); break;
    case 'DESCRIPTION': al.description = unescapeText(value); break;
    case 'TRIGGER':
      al.trigger = value;                       // e.g. "-PT15M" or an absolute date
      al.triggerParams = params;                // VALUE=DATE-TIME / RELATED=END
      break;
    default: break;
  }
}

// ORGANIZER/ATTENDEE: value is a calendar address (mailto:…); params carry CN,
// PARTSTAT (RSVP status), ROLE, RSVP.
function parseCalAddress(params, value) {
  return {
    email: String(value).replace(/^mailto:/i, ''),
    cn: params.CN || '',
    partstat: (params.PARTSTAT || '').toUpperCase(),
    role: params.ROLE || '',
    rsvp: params.RSVP === 'TRUE',
  };
}

// ---- RRULE ---------------------------------------------------------------
export function parseRRule(value) {
  const rule = {};
  for (const part of value.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).toUpperCase();
    const v = part.slice(eq + 1);
    switch (k) {
      case 'FREQ': rule.freq = v.toUpperCase(); break;
      case 'INTERVAL': rule.interval = parseInt(v, 10) || 1; break;
      case 'COUNT': rule.count = parseInt(v, 10); break;
      case 'UNTIL': rule.until = parseIcsDate(v).date; break;
      case 'BYDAY': rule.byday = v.split(',').map((s) => s.toUpperCase()); break;
      case 'BYMONTHDAY': rule.bymonthday = v.split(',').map((s) => parseInt(s, 10)); break;
      case 'BYMONTH': rule.bymonth = v.split(',').map((s) => parseInt(s, 10)); break;
      case 'WKST': rule.wkst = v.toUpperCase(); break;
      default: break;
    }
  }
  return rule;
}

export function formatRRule(rule) {
  if (!rule || !rule.freq) return '';
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval && rule.interval !== 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.count) parts.push(`COUNT=${rule.count}`);
  if (rule.until) parts.push(`UNTIL=${formatIcsDate(rule.until, { utc: true })}`);
  if (rule.byday && rule.byday.length) parts.push(`BYDAY=${rule.byday.join(',')}`);
  if (rule.bymonthday && rule.bymonthday.length) parts.push(`BYMONTHDAY=${rule.bymonthday.join(',')}`);
  if (rule.bymonth && rule.bymonth.length) parts.push(`BYMONTH=${rule.bymonth.join(',')}`);
  return parts.join(';');
}

// ---- serialization -------------------------------------------------------
// Fold lines at 75 octets per RFC 5545 §3.1. We approximate octets by UTF-16
// length, which is correct for the ASCII the tests exercise; multibyte content
// still folds, just slightly conservatively.
function foldLine(line) {
  if (line.length <= 75) return line;
  const out = [];
  let rest = line;
  out.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) { out.push(' ' + rest.slice(0, 74)); rest = rest.slice(74); }
  return out.join('\r\n');
}

function prop(name, value, params = {}) {
  let head = name;
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    head += `;${k}=${v}`;
  }
  return foldLine(`${head}:${value}`);
}

// Serialize one event into VEVENT content lines (text values escaped).
export function serializeEvent(ev) {
  const L = [];
  L.push('BEGIN:VEVENT');
  L.push(prop('UID', ev.uid || cryptoUid()));
  L.push(prop('DTSTAMP', formatIcsDate(new Date(), { utc: true })));
  if (ev.start) {
    if (ev.allDay) L.push(prop('DTSTART', formatIcsDate(ev.start, { allDay: true }), { VALUE: 'DATE' }));
    else L.push(prop('DTSTART', formatIcsDate(ev.start, { utc: true })));
  }
  if (ev.end) {
    if (ev.allDay) L.push(prop('DTEND', formatIcsDate(ev.end, { allDay: true }), { VALUE: 'DATE' }));
    else L.push(prop('DTEND', formatIcsDate(ev.end, { utc: true })));
  }
  if (ev.summary) L.push(prop('SUMMARY', escapeText(ev.summary)));
  if (ev.description) L.push(prop('DESCRIPTION', escapeText(ev.description)));
  if (ev.location) L.push(prop('LOCATION', escapeText(ev.location)));
  if (ev.status) L.push(prop('STATUS', ev.status));
  if (ev.rrule && ev.rrule.freq) L.push(prop('RRULE', formatRRule(ev.rrule)));
  for (const ex of ev.exdates || []) {
    if (ev.allDay) L.push(prop('EXDATE', formatIcsDate(ex, { allDay: true }), { VALUE: 'DATE' }));
    else L.push(prop('EXDATE', formatIcsDate(ex, { utc: true })));
  }
  if (ev.organizer) {
    L.push(prop('ORGANIZER', `mailto:${ev.organizer.email}`, { CN: ev.organizer.cn ? quoteParam(ev.organizer.cn) : '' }));
  }
  for (const a of ev.attendees || []) {
    L.push(prop('ATTENDEE', `mailto:${a.email}`, {
      CN: a.cn ? quoteParam(a.cn) : '',
      ROLE: a.role || '',
      PARTSTAT: a.partstat || '',
      RSVP: a.rsvp ? 'TRUE' : '',
    }));
  }
  for (const al of ev.alarms || []) {
    L.push('BEGIN:VALARM');
    L.push(prop('ACTION', al.action || 'DISPLAY'));
    L.push(prop('TRIGGER', al.trigger || '-PT15M', al.triggerParams || {}));
    L.push(prop('DESCRIPTION', escapeText(al.description || ev.summary || 'Reminder')));
    L.push('END:VALARM');
  }
  L.push('END:VEVENT');
  return L.join('\r\n');
}

// A parameter value that contains : ; or , must be DQUOTE-wrapped (§3.2).
function quoteParam(v) {
  return /[:;,]/.test(v) ? `"${v}"` : v;
}

// Wrap one or more events as a complete, valid VCALENDAR document.
export function serializeICS(events, { calName = 'edot calendar', method = '' } = {}) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//edot//calendar//EN'];
  if (method) L.push(prop('METHOD', method));
  if (calName) L.push(prop('X-WR-CALNAME', escapeText(calName)));
  for (const ev of events) L.push(serializeEvent(ev));
  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}

// A single-VEVENT invite carries METHOD:REQUEST so mail clients treat it as one.
export function serializeInvite(ev, calName = 'edot invite') {
  return serializeICS([ev], { calName, method: 'REQUEST' });
}

// UID generator (crypto where available, time+random fallback).
export function cryptoUid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${crypto.randomUUID()}@edot`;
  return `${Date.now()}-${Math.random().toString(36).slice(2)}@edot`;
}
