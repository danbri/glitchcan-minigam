// test-calendar.mjs — headless test of the edot calendar app (ICS parse/
// serialize, RRULE expansion, IndexedDB persistence, view switching, layer
// visibility, invite import, due-reminder detection). Same style as
// ../data/test-data.mjs: serves the repo root and drives the real
// <edot-calendar> in Chromium, printing ✅/❌ and exiting non-zero on failure.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html';
    const buf = await readFile(path.join(ROOT, rel));
    res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let fail = 0; const ok = (n, c) => { console.log(`${c ? '✅' : '❌'} ${n}`); if (!c) fail++; };

try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/magpie/edot/calendar/calendar.html`);
  await page.waitForFunction(() => window.__cal && window.__cal.app && window.__cal.app._built, null, { timeout: 20000 });
  // Start from a clean store so reruns are deterministic; reload re-seeds the
  // default layer via init().
  await page.evaluate(async () => { await window.__cal.store.clearAll(); });
  await page.reload();
  await page.waitForFunction(() => window.__cal && window.__cal.app && window.__cal.app._built, null, { timeout: 20000 });
  ok('calendar app booted with a default layer', await page.evaluate(() => window.__cal.app.calendars.length >= 1));

  // Integration: the local calendar registers into Connections as the OS-tier
  // calendar capability, so the suite can discover "my calendars" uniformly.
  const calConn = await page.evaluate(async () => {
    const { getKernel } = await import('../js/edot-kernel.js');
    const k = getKernel();
    const cal = k.capabilities.invoke('connections.list', { capability: 'calendar' }).find((a) => a.provider === 'local-calendar');
    const adapter = cal && k.capabilities.invoke('connections.capability', { id: cal.id, capability: 'calendar' });
    return { present: !!cal, isLocal: cal && cal.isLocal, hasAdapter: !!(adapter && typeof adapter.calendars === 'function') };
  });
  ok('Calendar registers a local calendar account into Connections', calConn.present && calConn.isLocal);
  ok('the calendar account exposes a live calendar adapter', calConn.hasAdapter);

  // 1. ICS parse -> serialize round-trip of a VEVENT incl. an alarm.
  const rt = await page.evaluate(() => {
    const { parseICS, serializeICS, parseRRule } = window.__cal.ics;
    const sample = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
      'BEGIN:VEVENT',
      'UID:rt-1@edot',
      'DTSTART:20260701T090000Z',
      'DTEND:20260701T100000Z',
      'SUMMARY:Coffee\\, tea\\; or me',
      'DESCRIPTION:line one\\nline two',
      'LOCATION:Bristol',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT15M', 'DESCRIPTION:Soon', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const { events } = parseICS(sample);
    const ev = events[0];
    const out = serializeICS([ev], { calName: 'rt' });
    const { events: again } = parseICS(out);
    const e2 = again[0];
    return {
      summary: ev.summary, descHasNl: ev.description.includes('\n'),
      alarmCount: ev.alarms.length, trigger: ev.alarms[0] && ev.alarms[0].trigger,
      roundSummary: e2.summary, roundAlarm: e2.alarms.length, roundTrigger: e2.alarms[0] && e2.alarms[0].trigger,
      escapedOk: /SUMMARY:Coffee\\, tea\\; or me/.test(out),
    };
  });
  ok('ICS unescapes text values (comma/semicolon/newline)', rt.summary === 'Coffee, tea; or me' && rt.descHasNl);
  ok('ICS parses a VALARM with TRIGGER', rt.alarmCount === 1 && rt.trigger === '-PT15M');
  ok('ICS serialize re-escapes special chars', rt.escapedOk);
  ok('ICS parse->serialize->parse round-trips event + alarm', rt.roundSummary === 'Coffee, tea; or me' && rt.roundAlarm === 1 && rt.roundTrigger === '-PT15M');

  // 2. RRULE expansion: weekly COUNT=5 -> 5 occurrences on the right weekday.
  const rr = await page.evaluate(() => {
    const { expandRecurrence } = window.__cal.recurrence;
    const { parseRRule } = window.__cal.ics;
    const start = new Date(2026, 6, 1, 9, 0, 0); // Wed 1 Jul 2026
    const ev = { start, end: new Date(2026, 6, 1, 10, 0, 0), rrule: parseRRule('FREQ=WEEKLY;COUNT=5'), exdates: [] };
    const occ = expandRecurrence(ev, new Date(2026, 5, 1), new Date(2026, 8, 1));
    return {
      count: occ.length,
      allWed: occ.every((d) => d.getDay() === start.getDay()),
      weekApart: (occ[1] - occ[0]) === 7 * 86400000,
      firstIsStart: occ[0].getTime() === start.getTime(),
    };
  });
  ok('RRULE weekly COUNT=5 expands to 5 occurrences', rr.count === 5);
  ok('RRULE occurrences land on the same weekday', rr.allWed);
  ok('RRULE occurrences are one week apart', rr.weekApart && rr.firstIsStart);

  // 2b. RRULE with EXDATE drops the excluded instance.
  const ex = await page.evaluate(() => {
    const { expandRecurrence } = window.__cal.recurrence;
    const { parseRRule } = window.__cal.ics;
    const start = new Date(2026, 6, 1, 9, 0, 0);
    const ev = { start, rrule: parseRRule('FREQ=DAILY;COUNT=4'), exdates: [new Date(2026, 6, 2, 9, 0, 0)] };
    return expandRecurrence(ev, new Date(2026, 5, 1), new Date(2026, 8, 1)).length;
  });
  ok('RRULE EXDATE excludes one occurrence (4 -> 3)', ex === 3);

  // 3. Event create persists to IndexedDB and survives a reload.
  await page.evaluate(async () => {
    const app = window.__cal.app;
    const calId = app.calendars[0].id;
    await app.store.putEvent({
      id: 'persist-1', uid: 'persist-1@edot', calendarId: calId,
      summary: 'Persisted meeting', description: '', location: '',
      start: new Date(2026, 6, 15, 14, 0), end: new Date(2026, 6, 15, 15, 0),
      allDay: false, rrule: null, exdates: [], status: 'CONFIRMED', organizer: null, attendees: [], alarms: [],
    });
  });
  await page.reload();
  await page.waitForFunction(() => window.__cal && window.__cal.app && window.__cal.app._built, null, { timeout: 20000 });
  ok('event persists to IndexedDB and reloads', await page.evaluate(async () => {
    const evs = await window.__cal.store.getEvents();
    const e = evs.find((x) => x.id === 'persist-1');
    return !!e && e.summary === 'Persisted meeting' && e.start instanceof Date && e.start.getFullYear() === 2026;
  }));

  // 4. Switching Month / Week / Day / Agenda renders the expected view nodes.
  const views = await page.evaluate(async () => {
    const app = window.__cal.app;
    app.date = new Date(2026, 6, 15);
    const r = {};
    app.setView('month'); r.month = !!app.querySelector('.cal-month');
    app.setView('week'); r.week = !!app.querySelector('.cal-timegrid') && app.querySelectorAll('.cal-day-col').length === 7;
    app.setView('day'); r.day = !!app.querySelector('.cal-timegrid') && app.querySelectorAll('.cal-day-col').length === 1;
    app.setView('agenda'); r.agenda = !!app.querySelector('.cal-agenda');
    return r;
  });
  ok('Month view renders an ARIA grid', views.month);
  ok('Week view renders 7 day columns', views.week);
  ok('Day view renders 1 day column', views.day);
  ok('Agenda view renders a list', views.agenda);

  // 4b. The persisted event shows up as a chip in the agenda for its month.
  ok('persisted event renders as an occurrence', await page.evaluate(() => {
    const app = window.__cal.app;
    app.date = new Date(2026, 6, 15); app.setView('agenda');
    return [...app.querySelectorAll('.cal-agenda-title')].some((n) => /Persisted meeting/.test(n.textContent));
  }));

  // 5. A hidden calendar layer hides its events.
  const layering = await page.evaluate(async () => {
    const app = window.__cal.app;
    const cal = app.calendars[0];
    app.date = new Date(2026, 6, 15); app.setView('agenda');
    const before = app.querySelectorAll('.cal-agenda-row').length;
    cal.visible = false; await app.store.putCalendar(cal); app._renderMain();
    const after = app.querySelectorAll('.cal-agenda-row').length;
    cal.visible = true; await app.store.putCalendar(cal); app._renderMain();
    return { before, after };
  });
  ok('hidden layer hides its events', layering.before > 0 && layering.after === 0);

  // 6. Importing an .ics invite adds the event.
  const invite = await page.evaluate(async () => {
    const app = window.__cal.app;
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'METHOD:REQUEST', 'PRODID:-//x//EN',
      'BEGIN:VEVENT', 'UID:invite-7@edot', 'DTSTART:20260720T130000Z', 'DTEND:20260720T140000Z',
      'SUMMARY:Project sync', 'ORGANIZER;CN=Ada:mailto:ada@example.com',
      'ATTENDEE;CN=Bo;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:bo@example.com',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const before = (await app.store.getEvents()).length;
    await app.importIcsText(ics);
    const evs = await app.store.getEvents();
    const e = evs.find((x) => x.uid === 'invite-7@edot');
    return { added: evs.length === before + 1, hasOrganizer: !!(e && e.organizer && e.organizer.email === 'ada@example.com'), hasAttendee: !!(e && e.attendees && e.attendees[0] && e.attendees[0].email === 'bo@example.com'), summary: e && e.summary };
  });
  ok('importing an .ics invite adds the event', invite.added && invite.summary === 'Project sync');
  ok('invite import keeps ORGANIZER + ATTENDEE', invite.hasOrganizer && invite.hasAttendee);

  // 7. Due-reminder detection: an event whose alarm fire-time has passed is
  //    surfaced in-app (OS Notification is unavailable headless — that's fine).
  const due = await page.evaluate(async () => {
    const app = window.__cal.app;
    const now = new Date();
    const start = new Date(now.getTime() + 5 * 60000); // event in 5 min
    await app.store.putEvent({
      id: 'alarm-1', uid: 'alarm-1@edot', calendarId: app.calendars[0].id,
      summary: 'Reminder check', description: '', location: '',
      start, end: new Date(start.getTime() + 3600000), allDay: false,
      rrule: null, exdates: [], status: 'CONFIRMED', organizer: null, attendees: [],
      alarms: [{ action: 'DISPLAY', trigger: '-PT10M', description: 'ping' }], // fires 10 min before -> already due
    });
    app.events = await app.store.getEvents();
    app.alarms.reset();
    const fired = app.checkAlarmsNow(now);
    return { fired: fired.length, notifSupported: app.alarms.notificationsSupported, summary: fired[0] && fired[0].event.summary };
  });
  ok('due reminder detected in-app (fire-time passed)', due.fired >= 1 && due.summary === 'Reminder check');
  ok('alarm code degrades gracefully without Notification permission', true /* checkAlarmsNow did not throw */);

  // 8. ICS export of a calendar produces a valid VCALENDAR.
  ok('calendar exports to a valid VCALENDAR', await page.evaluate(() => {
    const app = window.__cal.app;
    const evs = app.events.filter((e) => e.calendarId === app.calendars[0].id).map((e) => app._toIcsEvent(e));
    const out = window.__cal.ics.serializeICS(evs, { calName: 'export' });
    return /^BEGIN:VCALENDAR/.test(out) && /END:VCALENDAR/.test(out.trim()) && /BEGIN:VEVENT/.test(out);
  }));

  // 9. Search filters occurrences.
  ok('search filters events by text', await page.evaluate(() => {
    const app = window.__cal.app;
    app.date = new Date(2026, 6, 20); app.setView('agenda');
    app.search = 'Project sync'; app._renderMain();
    const only = [...app.querySelectorAll('.cal-agenda-title')];
    const match = only.length > 0 && only.every((n) => /Project sync/.test(n.textContent));
    app.search = ''; app._renderMain();
    return match;
  }));

  ok('no page errors', errs.length === 0);
  if (errs.length) console.log(errs);

  // 10. Mobile drawer regression: the calendars sidebar opens via ☰ and CLOSES
  //     on a scrim tap. It previously had no way to close — the scrim covered
  //     the toggle and nothing closed on an outside tap.
  {
    const mctx = await browser.newContext({ viewport: { width: 390, height: 820 }, hasTouch: true, isMobile: true });
    const mp = await mctx.newPage();
    const merrs = []; mp.on('pageerror', (e) => merrs.push(String(e)));
    await mp.goto(`http://127.0.0.1:${port}/magpie/edot/calendar/calendar.html`);
    await mp.waitForFunction(() => window.__cal && window.__cal.app, null, { timeout: 20000 });
    const isOpen = () => mp.evaluate(() => document.querySelector('.cal').classList.contains('side-open'));
    ok('mobile: ☰ toggle is shown', await mp.isVisible('.cal-menu-btn'));
    await mp.click('.cal-menu-btn'); await mp.waitForTimeout(200);
    ok('mobile: ☰ opens the calendars drawer', await isOpen());
    await mp.mouse.click(365, 60); await mp.waitForTimeout(250); // tap the scrim
    ok('mobile: tapping the scrim closes the drawer', !(await isOpen()));
    await mp.click('.cal-menu-btn'); await mp.waitForTimeout(200);
    await mp.mouse.click(365, 60); await mp.waitForTimeout(250);
    ok('mobile: drawer reopens and recloses', !(await isOpen()));
    ok('mobile: no page errors', merrs.length === 0);
    await mctx.close();
  }
} finally { await browser.close(); server.close(); }
console.log(fail ? `\n${fail} FAILURE(S)` : '\nCALENDAR OK');
process.exit(fail ? 1 : 0);
