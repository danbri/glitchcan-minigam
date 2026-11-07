// calendar-tools.js — Calendar's tools for the foafos shell and agents, offered
// through foaf.tools (inklet/apps/app-sdk.js). Two read, one writes:
//
//   list_calendars  the calendars (layers) you have
//   list_events     events in a date range, with repeats expanded
//   add_event       a new event in one of your own calendars (not a subscribed one)
//
// `cal` is the <edot-calendar> element after init(): its store is the truth,
// and after a write its view is redrawn. Pure apart from that, so it runs in
// Node with a stand-in calendar (test-calendar-tools.mjs).
import { expandRecurrence } from './recurrence.js';
import { cryptoUid } from './ics.js';

const DAY = 86400000;
const MAX_EVENTS = 200;
const MAX_TITLE = 500;
const MAX_TEXT = 20000;

// A date alone (2026-11-07) is local midnight, as Calendar's own form makes it; a date-time
// with no offset is local time too. Replies are in UTC.
function when(value, name) {
  if (value == null || value === '') return null;
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const d = day ? new Date(+day[1], +day[2] - 1, +day[3]) : new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`${name}: not a date or date-time, such as 2026-11-07 or 2026-11-07T15:00`);
  return d;
}

export function offerCalendarTools(cal, foaf) {
  const calendars = async () => cal.store.getCalendars();
  const nameOf = (list, id) => list.find((c) => c.id === id)?.name || null;

  foaf.tools.register({
    name: 'list_calendars',
    description: 'Your calendars: each one\'s id, name, whether it is shown, and whether it is a subscribed feed (read only).',
    inputSchema: { type: 'object', properties: {} },
    readOnly: true,
    handler: async () => ({
      calendars: (await calendars()).map((c) => ({ id: c.id, name: c.name, visible: c.visible !== false, subscribed: !!c.subscribed })),
    }),
  });

  foaf.tools.register({
    name: 'list_events',
    description: `Events that overlap a range of dates, in start order, with repeating events expanded. With no dates: today and the next 30 days. Times in the reply are UTC. At most ${MAX_EVENTS}.`,
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start of the range, an ISO date or date-time; with no offset (Z or +01:00), local time' },
        to: { type: 'string', description: 'End of the range, an ISO date or date-time; with no offset, local time' },
        query: { type: 'string', description: 'Only events whose title, location or description contains this text' },
      },
    },
    readOnly: true,
    handler: async ({ from, to, query } = {}) => {
      const start = when(from, 'from') || new Date(new Date().setHours(0, 0, 0, 0));
      const end = when(to, 'to') || new Date(start.getTime() + 31 * DAY);
      if (end < start) throw new Error('to is before from.');
      const q = String(query || '').trim().toLowerCase();
      const list = await calendars();
      const out = [];
      for (const ev of await cal.store.getEvents()) {
        if (q && ![ev.summary, ev.location, ev.description].some((s) => String(s || '').toLowerCase().includes(q))) continue;
        const len = ev.end && ev.start ? Math.max(0, new Date(ev.end) - new Date(ev.start)) : 0;
        // An event already under way at `from` counts: look back by its length, keep what overlaps.
        for (const at of expandRecurrence(ev, new Date(start.getTime() - len), end)) {
          if (at.getTime() + len < start.getTime() || (len && at.getTime() + len === start.getTime())) continue;
          out.push({
            id: ev.id, title: ev.summary || '', start: at.toISOString(),
            end: len ? new Date(at.getTime() + len).toISOString() : null,
            allDay: !!ev.allDay, location: ev.location || null, calendar: nameOf(list, ev.calendarId),
            repeats: !!ev.rrule,
          });
        }
      }
      out.sort((a, b) => a.start.localeCompare(b.start));
      return { from: start.toISOString(), to: end.toISOString(), events: out.slice(0, MAX_EVENTS), more: out.length > MAX_EVENTS };
    },
  });

  foaf.tools.register({
    name: 'add_event',
    description: 'Add an event to one of your own calendars (the first one, unless you name another). With no end, it lasts an hour, or the whole day for an all-day event.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What the event is' },
        start: { type: 'string', description: 'When it starts: an ISO date-time such as 2026-11-07T15:00Z, or a date for an all-day event. With no offset, local time' },
        end: { type: 'string', description: 'When it ends, an ISO date or date-time; with no offset, local time' },
        all_day: { type: 'boolean', description: 'True for an all-day event' },
        location: { type: 'string', description: 'Where it is' },
        description: { type: 'string', description: 'More about it' },
        calendar: { type: 'string', description: 'A calendar name or id from list_calendars' },
      },
      required: ['title', 'start'],
    },
    handler: async ({ title, start, end, all_day: allDay = false, location = '', description = '', calendar } = {}) => {
      const s = when(start, 'start');
      if (!s) throw new Error('start is needed.');
      const own = (await calendars()).filter((c) => !c.subscribed);
      const target = calendar
        ? own.find((c) => c.id === calendar || String(c.name).toLowerCase() === String(calendar).toLowerCase())
        : own[0];
      if (!target) throw new Error(calendar ? `No calendar of your own called ${calendar}.` : 'There is no calendar of your own to add to.');
      if (String(title).length > MAX_TITLE) throw new Error(`title: up to ${MAX_TITLE} characters.`);
      if (String(description).length > MAX_TEXT || String(location).length > MAX_TITLE) throw new Error(`description: up to ${MAX_TEXT} characters; location: up to ${MAX_TITLE}.`);
      const e = when(end, 'end') || (allDay ? new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1) : new Date(s.getTime() + 3600000));
      if (e < s) throw new Error('end is before start.');
      const id = cryptoUid();
      const ev = {
        id, uid: id, calendarId: target.id, summary: String(title), description: String(description), location: String(location),
        allDay: !!allDay, start: s, end: e, rrule: null, exdates: [], status: 'CONFIRMED', organizer: null, attendees: [], alarms: [],
      };
      await cal.store.putEvent(ev);
      cal.events = await cal.store.getEvents();
      cal._renderMain?.();
      return { added: { id, title: ev.summary, start: s.toISOString(), end: e.toISOString(), allDay: ev.allDay, calendar: target.name } };
    },
  });
}
