// Calendar's foafos tools (js/calendar-tools.js) against a stand-in calendar. No browser.
//   node --test magpie/edot/calendar/test-calendar-tools.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { offerCalendarTools } from './js/calendar-tools.js';

function setup() {
  const cals = [
    { id: 'c1', name: 'My Calendar', visible: true, subscribed: false },
    { id: 'c2', name: 'Holidays', visible: true, subscribed: true },
  ];
  let events = [
    { id: 'e1', calendarId: 'c1', summary: 'Dentist', location: 'High St', start: new Date('2026-11-10T09:00:00Z'), end: new Date('2026-11-10T10:00:00Z') },
    { id: 'e2', calendarId: 'c1', summary: 'Standup', start: new Date('2026-11-09T09:30:00Z'), end: new Date('2026-11-09T09:45:00Z'), rrule: { freq: 'DAILY', count: 3 } },
    { id: 'e3', calendarId: 'c2', summary: 'Bank holiday', allDay: true, start: new Date('2026-12-25T00:00:00Z'), end: new Date('2026-12-26T00:00:00Z') },
  ];
  let drawn = 0;
  const cal = {
    store: {
      getCalendars: async () => cals,
      getEvents: async () => events.map((e) => ({ ...e })),
      putEvent: async (ev) => { events = [...events.filter((e) => e.id !== ev.id), ev]; return ev; },
    },
    events: [],
    _renderMain: () => { drawn++; },
  };
  const tools = new Map();
  const foaf = { tools: { register: (t) => tools.set(t.name, t) } };
  offerCalendarTools(cal, foaf);
  const run = (name, args = {}) => tools.get(name).handler(args);
  return { tools, run, cal, drawn: () => drawn };
}

test('three tools; only add_event writes', () => {
  const { tools } = setup();
  assert.deepEqual([...tools.keys()], ['list_calendars', 'list_events', 'add_event']);
  assert.deepEqual([...tools.values()].map((t) => t.readOnly === true), [true, true, false]);
  assert.deepEqual(tools.get('add_event').inputSchema.required, ['title', 'start']);
});

test('list_calendars says which are subscribed', async () => {
  const { run } = setup();
  assert.deepEqual((await run('list_calendars')).calendars.map((c) => [c.name, c.subscribed]), [['My Calendar', false], ['Holidays', true]]);
});

test('list_events expands repeats, sorts by start and filters by text', async () => {
  const { run } = setup();
  const r = await run('list_events', { from: '2026-11-09', to: '2026-11-12' });
  assert.deepEqual(r.events.map((e) => [e.title, e.start]), [
    ['Standup', '2026-11-09T09:30:00.000Z'], ['Dentist', '2026-11-10T09:00:00.000Z'],
    ['Standup', '2026-11-10T09:30:00.000Z'], ['Standup', '2026-11-11T09:30:00.000Z'],
  ]);
  assert.equal(r.events.find((e) => e.title === 'Dentist').calendar, 'My Calendar');
  assert.equal(r.events[0].end, '2026-11-09T09:45:00.000Z');
  const q = await run('list_events', { from: '2026-11-01', to: '2026-12-31', query: 'high st' });
  assert.deepEqual(q.events.map((e) => e.title), ['Dentist']);
  await assert.rejects(run('list_events', { from: 'soon' }), /from: not a date/);
  await assert.rejects(run('list_events', { from: '2026-11-10', to: '2026-11-01' }), /to is before from/);
});

test('list_events includes an event already under way at the start of the range', async () => {
  const { run } = setup();
  await run('add_event', { title: 'Conference', start: '2026-11-08T09:00:00Z', end: '2026-11-11T17:00:00Z' });
  const r = await run('list_events', { from: '2026-11-10T00:00:00Z', to: '2026-11-10T08:00:00Z' });
  assert.deepEqual(r.events.map((e) => e.title), ['Conference']);
  // An event that ends as the range starts does not overlap it.
  const after = await run('list_events', { from: '2026-11-11T17:00:00Z', to: '2026-11-11T18:00:00Z' });
  assert.deepEqual(after.events.map((e) => e.title), []);
});

test('add_event writes to your own calendar and redraws; never to a subscribed one', async () => {
  const { run, cal, drawn } = setup();
  const r = await run('add_event', { title: 'Lunch', start: '2026-11-12T12:00:00Z' });
  assert.equal(r.added.calendar, 'My Calendar');
  assert.equal(r.added.end, '2026-11-12T13:00:00.000Z');
  assert.ok(cal.events.some((e) => e.summary === 'Lunch'));
  assert.equal(drawn(), 1);
  await assert.rejects(run('add_event', { title: 'x', start: '2026-11-12', calendar: 'Holidays' }), /No calendar of your own called Holidays/);
  await assert.rejects(run('add_event', { title: 'x', start: '2026-11-12T10:00Z', end: '2026-11-12T09:00Z' }), /end is before start/);
  const day = await run('add_event', { title: 'Away', start: '2026-11-20', all_day: true, calendar: 'my calendar' });
  assert.equal(day.added.allDay, true);
  // A date alone is local midnight, as the Calendar form makes it, in any time zone.
  assert.equal(day.added.start, new Date(2026, 10, 20).toISOString());
  assert.equal(day.added.end, new Date(2026, 10, 21).toISOString());
  await assert.rejects(run('add_event', { title: 'x'.repeat(501), start: '2026-11-12' }), /title: up to 500/);
});

test('add_event with an id adds once; a retry returns the event already added', async () => {
  const { run, cal } = setup();
  const first = await run('add_event', { title: 'Lunch', start: '2026-11-12T12:00:00Z', id: 'agent-lunch-1' });
  assert.equal(first.existed, false);
  assert.equal(first.added.id, 'agent-lunch-1');
  const again = await run('add_event', { title: 'Lunch', start: '2026-11-12T12:00:00Z', id: 'agent-lunch-1' });
  assert.equal(again.existed, true);
  assert.deepEqual(again.added, first.added);
  assert.equal(cal.events.filter((e) => e.summary === 'Lunch').length, 1);
  // Without an id, each call adds.
  const a = await run('add_event', { title: 'Tea', start: '2026-11-12T16:00:00Z' });
  const b = await run('add_event', { title: 'Tea', start: '2026-11-12T16:00:00Z' });
  assert.notEqual(a.added.id, b.added.id);
  await assert.rejects(run('add_event', { title: 'x', start: '2026-11-12', id: 'has space' }), /id: up to 128/);
  // An id held by an event in a subscribed calendar is not yours: a new event is added.
  const held = await run('add_event', { title: 'Mine', start: '2026-11-12T09:00:00Z', id: 'e3' });
  assert.equal(held.existed, false);
  assert.equal(held.added.calendar, 'My Calendar');
  // A number is an id too.
  assert.equal((await run('add_event', { title: 'Zero', start: '2026-11-12T09:00:00Z', id: 0 })).added.id, '0');
  assert.match(setup().tools.get('add_event').inputSchema.properties.id.description, /same id again/);
});
