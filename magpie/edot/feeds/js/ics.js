// ics.js — a small, correct iCalendar (RFC 5545) reader. Pure (no DOM/network),
// so it parses both the .ics files we've hoarded and live calendar feeds, and is
// unit-testable under Node. We read VEVENTs into plain objects; the Calendar and
// Data apps render them. We deliberately do NOT expand RRULE recurrences here —
// the raw rule is kept so the Calendar can expand it when it needs to.

// Unfold folded lines (a leading space/tab continues the previous line) then
// split into logical lines. Handles CRLF and bare LF.
function unfold(text) {
  const raw = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out = [];
  for (const line of raw) {
    if (out.length && /^[ \t]/.test(line)) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out;
}

// "NAME;PARAM=x;PARAM2=y:VALUE" → { name, params:{PARAM:'x',…}, value }
function parseLine(line) {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = head.split(';');
  const name = parts[0].toUpperCase();
  const params = {};
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    if (eq > 0) params[parts[i].slice(0, eq).toUpperCase()] = parts[i].slice(eq + 1);
  }
  return { name, params, value };
}

function unescapeText(v) {
  return String(v).replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

// Parse an iCalendar datetime into { iso, allDay }. Forms handled:
//   20260626                       (DATE → all-day)
//   20260626T101500Z               (UTC)
//   20260626T101500                (floating / local — kept as-is)
// TZID params are noted but not resolved (kept in the iso string's lack of Z).
function parseDate(value, params) {
  const v = String(value).trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly || (params && params.VALUE === 'DATE')) {
    const m = dateOnly || /^(\d{4})(\d{2})(\d{2})/.exec(v);
    return { iso: `${m[1]}-${m[2]}-${m[3]}`, allDay: true };
  }
  const dt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (dt) {
    const [, Y, Mo, D, h, mi, s, z] = dt;
    return { iso: `${Y}-${Mo}-${D}T${h}:${mi}:${s}${z ? 'Z' : ''}`, allDay: false };
  }
  return { iso: v, allDay: false };
}

// Parse an .ics document into { calendarName, events:[…] }.
export function parseIcs(text) {
  const lines = unfold(text);
  const events = [];
  let calendarName = '';
  let cur = null;
  for (const line of lines) {
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === 'BEGIN' && p.value === 'VEVENT') { cur = { _raw: {} }; continue; }
    if (p.name === 'END' && p.value === 'VEVENT') { if (cur) events.push(finishEvent(cur)); cur = null; continue; }
    if (!cur) {
      if (p.name === 'X-WR-CALNAME') calendarName = unescapeText(p.value);
      continue;
    }
    switch (p.name) {
      case 'UID': cur.uid = p.value; break;
      case 'SUMMARY': cur.summary = unescapeText(p.value); break;
      case 'DESCRIPTION': cur.description = unescapeText(p.value); break;
      case 'LOCATION': cur.location = unescapeText(p.value); break;
      case 'URL': cur.url = p.value; break;
      case 'RRULE': cur.rrule = p.value; break;
      case 'DTSTART': { const d = parseDate(p.value, p.params); cur.start = d.iso; cur.allDay = d.allDay; break; }
      case 'DTEND': { const d = parseDate(p.value, p.params); cur.end = d.iso; break; }
      case 'GEO': { const g = String(p.value).split(/[;,]/); if (g.length === 2) { cur.lat = +g[0]; cur.lon = +g[1]; } break; }
      default: break;
    }
  }
  return { calendarName, events };
}

function finishEvent(e) {
  return {
    uid: e.uid || '',
    summary: e.summary || '(no title)',
    start: e.start || '',
    end: e.end || '',
    allDay: !!e.allDay,
    location: e.location || '',
    description: e.description || '',
    url: e.url || '',
    rrule: e.rrule || '',
    ...(e.lat != null ? { lat: e.lat, lon: e.lon } : {}),
  };
}

// Shape events for the Data feature: a tabular { columns, rows } view.
export function icsToTable(events) {
  const columns = ['Summary', 'Start', 'End', 'Location', 'URL'];
  const rows = events.map((e) => [e.summary, e.start, e.end, e.location, e.url]);
  return { columns, rows };
}
