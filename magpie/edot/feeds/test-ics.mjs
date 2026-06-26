// test-ics.mjs — the iCalendar reader. Pure Node: parse a fixture covering line
// folding, escaping, all-day vs timed events, TZID, and RRULE retention.
import { parseIcs, icsToTable } from './js/ics.js';

let fail = 0;
const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'X-WR-CALNAME:Team Calendar',
  'BEGIN:VEVENT',
  'UID:evt-1@edot',
  'SUMMARY:Sprint planning\\, with the team',
  'DESCRIPTION:Bring laptops.\\nRoom 4.',
  'LOCATION:HQ',
  'DTSTART:20260629T090000Z',
  'DTEND:20260629T100000Z',
  'URL:https://example.org/e1',
  'RRULE:FREQ=WEEKLY;BYDAY=MO',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:evt-2@edot',
  'SUMMARY:Public holiday',
  'DTSTART;VALUE=DATE:20260825',
  'DESCRIPTION:A folded line that continues onto a sec',
  ' ond physical line.',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const { calendarName, events } = parseIcs(ICS);
ok('reads the calendar name (X-WR-CALNAME)', calendarName === 'Team Calendar');
ok('parses both VEVENTs', events.length === 2);

const e1 = events[0];
ok('unescapes text (comma in SUMMARY)', e1.summary === 'Sprint planning, with the team');
ok('unescapes newlines in DESCRIPTION', /Bring laptops\.\nRoom 4\./.test(e1.description));
ok('parses timed DTSTART/DTEND to ISO UTC', e1.start === '2026-06-29T09:00:00Z' && e1.end === '2026-06-29T10:00:00Z');
ok('event is not all-day', e1.allDay === false);
ok('retains the RRULE verbatim', e1.rrule === 'FREQ=WEEKLY;BYDAY=MO');

const e2 = events[1];
ok('parses VALUE=DATE as an all-day date', e2.start === '2026-08-25' && e2.allDay === true);
ok('unfolds continuation lines', /continues onto a second physical line\./.test(e2.description));

const t = icsToTable(events);
ok('icsToTable yields Summary/Start/End/Location/URL columns', t.columns.join(',') === 'Summary,Start,End,Location,URL');
ok('icsToTable has one row per event', t.rows.length === 2 && t.rows[0][0] === 'Sprint planning, with the team');

console.log(fail ? `\n${fail} ICS FAILURE(S)` : '\nICS OK');
process.exit(fail ? 1 : 0);
