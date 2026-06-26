// calendar-app.js — <edot-calendar>: the orchestrator that ties the store,
// recurrence expansion, ICS import/export, alarms and the four views together.
//
// Light-DOM custom element sharing ../calendar/css/calendar.css. Mobile-first:
// the calendar sidebar (layers) collapses to a slide-in drawer; the toolbar
// wraps; all controls are coarse-pointer sized via CSS.
//
// CORS reality (see subscribe UI): browsers can only fetch ICS feeds that send
// CORS headers, which most public feeds do NOT. The reliable offline path is
// ICS file Import (always available). Subscribe is offered, with that caveat
// surfaced in the dialog and a comment here.

import { CalendarStore } from './store.js';
import { parseICS, serializeICS, serializeInvite, cryptoUid, formatRRule, parseRRule } from './ics.js';
import { expandRecurrence, describeRRule } from './recurrence.js';
import { AlarmScheduler, alarmFireTime } from './alarms.js';
import { renderMonth, renderWeek, renderDay, renderAgenda, MONTHS, startOfDay } from './views.js';
import { getKernel } from '../../js/edot-kernel.js';
import { getRegistry } from '../../js/command-registry.js';
import { getConnections } from '../../js/connections.js';

// Active-instance tracking + command-registry contributions (Phase 2).
let activeCalendar = null;
let calendarCommandsWired = false;
function registerCalendarCommands() {
  if (calendarCommandsWired) return;
  const inCal = (ctx) => ctx && ctx.app === 'calendar' && !!activeCalendar;
  const setView = (v) => () => activeCalendar.setView(v);
  try {
    getRegistry().registerAll([
      { id: 'calendar.newEvent', title: 'New event', icon: '＋', group: '0event', keywords: 'new event create', appliesTo: 'Event', when: inCal, run: () => activeCalendar.openEventDialog(null, activeCalendar.date) },
      { id: 'calendar.today', title: 'Go to today', icon: '•', group: '1nav', keywords: 'today now', when: inCal, run: () => { activeCalendar.date = startOfDay(new Date()); activeCalendar._renderMain(); } },
      { id: 'calendar.viewMonth', title: 'Month view', group: '2view', keywords: 'view month', when: inCal, run: setView('month') },
      { id: 'calendar.viewWeek', title: 'Week view', group: '2view', keywords: 'view week', when: inCal, run: setView('week') },
      { id: 'calendar.viewDay', title: 'Day view', group: '2view', keywords: 'view day', when: inCal, run: setView('day') },
      { id: 'calendar.viewAgenda', title: 'Agenda view', group: '2view', keywords: 'view agenda list', when: inCal, run: setView('agenda') },
      { id: 'calendar.newCalendar', title: 'New calendar', icon: '📅', group: '3manage', keywords: 'new calendar layer', appliesTo: 'Calendar', when: inCal, run: () => activeCalendar.openCalendarDialog() },
      { id: 'calendar.browse', title: 'Browse calendars…', icon: '🔎', group: '3manage', keywords: 'browse catalogue subscribe add', when: inCal, run: () => activeCalendar.openBrowseCalendars() },
      { id: 'calendar.subscribe', title: 'Subscribe (ICS URL)…', group: '3manage', keywords: 'subscribe ics url feed', when: inCal, run: () => activeCalendar.openSubscribeDialog() },
      { id: 'calendar.import', title: 'Import .ics file…', group: '3manage', keywords: 'import ics file', when: inCal, run: () => activeCalendar._importFilePicker() },
    ]);
    calendarCommandsWired = true;
  } catch (_) { /* registry optional */ }
}

const PALETTE = ['#8b4513', '#1a73e8', '#188038', '#b5126b', '#7b1fa2', '#e37400', '#0b8043', '#c5221f'];
const DAYS_ABBR = [['SU', 'S'], ['MO', 'M'], ['TU', 'T'], ['WE', 'W'], ['TH', 'T'], ['FR', 'F'], ['SA', 'S']];

let _colorSeq = 0;
function nextColor() { return PALETTE[(_colorSeq++) % PALETTE.length]; }
function uid() { return cryptoUid(); }

export class EdotCalendar extends HTMLElement {
  constructor() {
    super();
    this.store = new CalendarStore();
    this.alarms = new AlarmScheduler();
    this.view = 'month';
    this.date = startOfDay(new Date());
    this.calendars = [];
    this.events = [];
    this.search = '';
    this._dueReminders = [];
  }

  async init() {
    if (this._initPromise) return this._initPromise;     // idempotent boot
    this._initPromise = this._doInit();
    return this._initPromise;
  }
  async _doInit() {
    await this.store.init();
    this.calendars = await this.store.getCalendars();
    if (!this.calendars.length) {
      // Seed a default personal calendar so the app is usable immediately.
      const cal = { id: uid(), name: 'My Calendar', color: PALETTE[0], visible: true, subscribed: false, sourceUrl: '' };
      await this.store.putCalendar(cal);
      this.calendars = [cal];
    }
    this.events = await this.store.getEvents();
    this._render();
    this._wireAlarms();
    // Command registry: track the active instance + contribute Calendar's commands.
    if (!activeCalendar) activeCalendar = this;
    this.addEventListener('focusin', () => { activeCalendar = this; });
    registerCalendarCommands();
    // Register the local calendar as a Connections account (the OS-tier
    // calendar capability), so the suite can answer "where are my calendars?"
    // uniformly and other apps (Groups sharing, Maps event layers) can find it.
    try {
      const adapter = {
        kind: 'calendar',
        calendars: () => this.calendars.slice(),
        events: () => this.events.slice(),
        share: (calId) => this._shareCalendar && this._shareCalendar(calId),
      };
      getConnections().add({ id: 'calendar:local', provider: 'local-calendar', label: 'My Calendar', sources: { calendar: adapter } });
    } catch (_) { /* Connections optional */ }
    return this;
  }

  connectedCallback() { if (!this._initPromise) this.init(); }
  disconnectedCallback() { this.alarms.stop(); }

  // ---- data helpers --------------------------------------------------------
  get visibleCalendarIds() { return new Set(this.calendars.filter((c) => c.visible).map((c) => c.id)); }
  calendarById(id) { return this.calendars.find((c) => c.id === id) || null; }

  // The active window for the current view (used to bound recurrence expansion).
  currentRange() {
    const d = this.date;
    if (this.view === 'day') { const s = startOfDay(d); const e = new Date(s); e.setDate(e.getDate() + 1); return [s, e]; }
    if (this.view === 'week') { const s = startOfDay(d); s.setDate(s.getDate() - s.getDay()); const e = new Date(s); e.setDate(e.getDate() + 7); return [s, e]; }
    if (this.view === 'agenda') { const s = startOfDay(d); const e = new Date(s); e.setDate(e.getDate() + 30); return [s, e]; }
    // month: full weeks covering the month
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const s = startOfDay(first); s.setDate(s.getDate() - s.getDay());
    const e = new Date(s); e.setDate(e.getDate() + 42);
    return [s, e];
  }

  // Expand all visible events into concrete occurrences within a window,
  // applying the search filter. Returns occurrence objects for the views.
  occurrencesIn(rangeStart, rangeEnd) {
    const vis = this.visibleCalendarIds;
    const q = this.search.trim().toLowerCase();
    const out = [];
    for (const ev of this.events) {
      if (!vis.has(ev.calendarId)) continue;
      if (q && !(`${ev.summary} ${ev.description} ${ev.location}`.toLowerCase().includes(q))) continue;
      const starts = expandRecurrence(ev, rangeStart, rangeEnd);
      const durMs = ev.end ? (new Date(ev.end) - new Date(ev.start)) : (ev.allDay ? 0 : 3600000);
      for (const s of starts) {
        out.push({
          event: ev, calendar: this.calendarById(ev.calendarId),
          start: s, end: new Date(s.getTime() + durMs), allDay: ev.allDay,
        });
      }
    }
    return out;
  }

  // ---- alarms --------------------------------------------------------------
  _wireAlarms() {
    // Provider scans a forward window for any alarm whose fire-time has passed.
    this.alarms.start(() => this._dueCandidates(), 30000);
    this.alarms.addEventListener('due', (e) => {
      this._dueReminders.push(e.detail);
      this._renderDueBanner();
    });
  }
  // Candidate reminders across a ±1 day window of occurrences (cheap + ample).
  _dueCandidates(now = new Date()) {
    const lo = new Date(now.getTime() - 86400000);
    const hi = new Date(now.getTime() + 86400000);
    const cands = [];
    const vis = this.visibleCalendarIds;
    for (const ev of this.events) {
      if (!vis.has(ev.calendarId)) continue;
      if (!ev.alarms || !ev.alarms.length) continue;
      const durMs = ev.end ? (new Date(ev.end) - new Date(ev.start)) : 3600000;
      for (const s of expandRecurrence(ev, lo, hi)) {
        const occEnd = new Date(s.getTime() + durMs);
        for (const al of ev.alarms) {
          const fire = alarmFireTime(al, s, occEnd);
          if (fire) cands.push({ event: ev, occurrence: s, fireTime: fire, text: al.description || ev.summary });
        }
      }
    }
    return cands;
  }
  // Headless-test hook: force an evaluation now and return newly-due reminders.
  checkAlarmsNow(now = new Date()) { return this.alarms.checkDue(now); }

  // ---- rendering -----------------------------------------------------------
  _render() {
    this._built = true;
    this.innerHTML = '';
    const root = document.createElement('div'); root.className = 'cal'; this._root = root;
    // Tapping the scrim (anywhere outside the drawer) closes the mobile sidebar.
    // The scrim is .cal.side-open::after, so its clicks land on the root itself;
    // without this the drawer had no way to close (the scrim covers the ☰).
    root.addEventListener('click', (e) => {
      if (e.target === root && root.classList.contains('side-open')) root.classList.remove('side-open');
    });

    root.appendChild(this._buildToolbar());
    root.appendChild(this._buildSidebar());
    const main = document.createElement('div'); main.className = 'cal-main'; main.id = 'cal-main';
    this._main = main;
    root.appendChild(main);

    this._dueBanner = document.createElement('div'); this._dueBanner.className = 'cal-due-banner'; this._dueBanner.hidden = true;
    this._dueBanner.setAttribute('role', 'status');
    root.appendChild(this._dueBanner);

    this.appendChild(root);
    this._renderMain();
  }

  _btn(label, onClick, cls = 'cal-btn') {
    const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label;
    b.addEventListener('click', onClick); return b;
  }

  _buildToolbar() {
    const tb = document.createElement('div'); tb.className = 'cal-toolbar';
    const menuBtn = this._btn('☰', () => this._root.classList.toggle('side-open'), 'cal-btn cal-menu-btn');
    menuBtn.setAttribute('aria-label', 'Show calendars');
    tb.appendChild(menuBtn);

    tb.appendChild(this._btn('Today', () => { this.date = startOfDay(new Date()); this._renderMain(); }));
    const prev = this._btn('‹', () => this._nav(-1)); prev.setAttribute('aria-label', 'Previous');
    const next = this._btn('›', () => this._nav(1)); next.setAttribute('aria-label', 'Next');
    tb.append(prev, next);

    this._title = document.createElement('h2'); this._title.className = 'cal-period'; this._title.id = 'cal-period';
    tb.appendChild(this._title);

    // Jump-to-date.
    const jump = document.createElement('input'); jump.type = 'date'; jump.className = 'cal-jump';
    jump.setAttribute('aria-label', 'Jump to date');
    jump.addEventListener('change', () => { if (jump.value) { this.date = startOfDay(new Date(jump.value + 'T00:00')); this._renderMain(); } });
    this._jump = jump; tb.appendChild(jump);

    const spacer = document.createElement('span'); spacer.className = 'cal-spacer'; tb.appendChild(spacer);

    // Search.
    const search = document.createElement('input'); search.type = 'search'; search.className = 'cal-search';
    search.placeholder = 'Search events'; search.setAttribute('aria-label', 'Search events');
    search.addEventListener('input', () => { this.search = search.value; this._renderMain(); });
    this._searchInput = search; tb.appendChild(search);

    // View switcher.
    const views = document.createElement('div'); views.className = 'cal-views'; views.setAttribute('role', 'tablist');
    for (const v of ['month', 'week', 'day', 'agenda']) {
      const b = this._btn(v[0].toUpperCase() + v.slice(1), () => this.setView(v), 'cal-view-btn');
      b.dataset.view = v; b.setAttribute('role', 'tab');
      views.appendChild(b);
    }
    this._viewBtns = views; tb.appendChild(views);

    tb.appendChild(this._btn('+ Event', () => this.openEventDialog(null, this.date), 'cal-btn primary'));
    return tb;
  }

  _buildSidebar() {
    const side = document.createElement('aside'); side.className = 'cal-side'; this._side = side;
    const h = document.createElement('h3'); h.textContent = 'Calendars'; side.appendChild(h);
    this._calList = document.createElement('div'); this._calList.className = 'cal-list'; side.appendChild(this._calList);

    side.appendChild(this._btn('+ New calendar', () => this.openCalendarDialog(), 'cal-btn cal-side-btn'));
    side.appendChild(this._btn('Browse calendars…', () => this.openBrowseCalendars(), 'cal-btn cal-side-btn'));
    side.appendChild(this._btn('Subscribe (ICS URL)…', () => this.openSubscribeDialog(), 'cal-btn cal-side-btn'));
    side.appendChild(this._btn('Import .ics file…', () => this._importFilePicker(), 'cal-btn cal-side-btn'));

    this._renderCalList();
    return side;
  }

  _renderCalList() {
    this._calList.innerHTML = '';
    for (const cal of this.calendars) {
      const row = document.createElement('div'); row.className = 'cal-layer';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = cal.visible;
      cb.id = `vis-${cal.id}`;
      cb.setAttribute('aria-label', `Show ${cal.name}`);
      cb.addEventListener('change', async () => { cal.visible = cb.checked; await this.store.putCalendar(cal); this._renderMain(); });
      const sw = document.createElement('label'); sw.className = 'cal-swatch'; sw.htmlFor = cb.id;
      sw.style.background = cal.color;
      const name = document.createElement('label'); name.className = 'cal-layer-name'; name.htmlFor = cb.id;
      name.textContent = cal.name + (cal.subscribed ? ' 🔗' : '');
      const menu = this._btn('⋯', () => this.openCalendarDialog(cal), 'cal-layer-menu');
      menu.setAttribute('aria-label', `Edit ${cal.name}`);
      row.append(cb, sw, name, menu);
      this._calList.appendChild(row);
    }
  }

  setView(v) { this.view = v; this._renderMain(); }
  _nav(dir) {
    const d = new Date(this.date);
    if (this.view === 'day') d.setDate(d.getDate() + dir);
    else if (this.view === 'week') d.setDate(d.getDate() + 7 * dir);
    else if (this.view === 'agenda') d.setDate(d.getDate() + 30 * dir);
    else d.setMonth(d.getMonth() + dir);
    this.date = d; this._renderMain();
  }

  _renderMain() {
    const [s, e] = this.currentRange();
    const occurrences = this.occurrencesIn(s, e);
    const ctx = {
      occurrences, range: [s, e], date: this.date,
      onSelectDate: (day) => { this.date = startOfDay(day); if (this.view === 'month') this._renderMain(); },
      onOpenEvent: (occ) => this.openEventDialog(occ.event, occ.start, occ),
      onCreate: (day) => this.openEventDialog(null, day),
    };
    const node = this.view === 'month' ? renderMonth(ctx)
      : this.view === 'week' ? renderWeek(ctx)
        : this.view === 'day' ? renderDay(ctx)
          : renderAgenda(ctx);
    this._main.innerHTML = '';
    this._main.appendChild(node);
    this._updateTitle();
    this._updateViewBtns();
  }
  _updateTitle() {
    const d = this.date;
    if (this.view === 'day') this._title.textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    else if (this.view === 'week') { const s = new Date(d); s.setDate(d.getDate() - d.getDay()); const e = new Date(s); e.setDate(s.getDate() + 6); this._title.textContent = `${s.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`; }
    else this._title.textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  _updateViewBtns() {
    for (const b of this._viewBtns.querySelectorAll('.cal-view-btn')) {
      const on = b.dataset.view === this.view;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }

  _renderDueBanner() { this._renderDueBannerInner(); }
  _renderDueBannerInner() {
    if (!this._dueReminders.length) { this._dueBanner.hidden = true; return; }
    this._dueBanner.hidden = false;
    this._dueBanner.innerHTML = '';
    const r = this._dueReminders[this._dueReminders.length - 1];
    const txt = document.createElement('span');
    txt.textContent = `⏰ ${r.event.summary || 'Reminder'} — ${r.occurrence.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    const close = this._btn('Dismiss', () => { this._dueReminders = []; this._dueBanner.hidden = true; }, 'cal-btn');
    this._dueBanner.append(txt, close);
  }

  // ---- dialogs (lightweight <dialog>-free modal for headless friendliness) --
  _modal(title) {
    const back = document.createElement('div'); back.className = 'cal-modal-back';
    const box = document.createElement('div'); box.className = 'cal-modal'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title);
    const head = document.createElement('div'); head.className = 'cal-modal-head';
    const h = document.createElement('h3'); h.textContent = title; head.appendChild(h);
    const x = this._btn('✕', () => back.remove(), 'cal-btn cal-modal-x'); x.setAttribute('aria-label', 'Close');
    head.appendChild(x);
    box.appendChild(head);
    back.appendChild(box);
    back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });
    document.addEventListener('keydown', function esc(ev) { if (ev.key === 'Escape') { back.remove(); document.removeEventListener('keydown', esc); } });
    this.appendChild(back);
    return { back, box };
  }
  _field(box, label, input) {
    const row = document.createElement('label'); row.className = 'cal-field';
    const span = document.createElement('span'); span.textContent = label; row.appendChild(span);
    row.appendChild(input); box.appendChild(row); return input;
  }

  // ---- event create / edit / delete ---------------------------------------
  openEventDialog(existing, day, occ) {
    const { back, box } = this._modal(existing ? 'Edit event' : 'New event');
    const ev = existing ? { ...existing } : {
      id: uid(), uid: uid(), calendarId: (this.calendars.find((c) => !c.subscribed) || this.calendars[0]).id,
      summary: '', description: '', location: '', allDay: false,
      start: this._defaultStart(day), end: this._defaultEnd(day),
      rrule: null, exdates: [...(existing && existing.exdates || [])], status: 'CONFIRMED',
      organizer: null, attendees: [], alarms: [],
    };

    const summary = this._field(box, 'Title', el('input', { type: 'text', value: ev.summary || '', className: 'cal-input' }));

    // Location autocomplete (names + Wikidata QIDs). Lazy: the places component is
    // imported only when an event dialog is opened, and it loads its data
    // providers only once the user starts typing.
    const locInput = document.createElement('edot-place-input');
    locInput.setAttribute('sources', 'wikidata,local-seed');
    locInput.setAttribute('placeholder', 'Search for a place…');
    const location = this._field(box, 'Location', locInput);
    let pickedPlace = null;
    locInput.addEventListener('place-selected', (e) => { pickedPlace = e.detail; });
    import('../../places/js/place-input.js').then(() => {
      customElements.upgrade(locInput);
      locInput.value = ev.location || '';
    });

    const calSel = el('select', { className: 'cal-input' });
    for (const c of this.calendars) { const o = el('option', { value: c.id, textContent: c.name }); if (c.subscribed) o.disabled = true; calSel.appendChild(o); }
    calSel.value = ev.calendarId; this._field(box, 'Calendar', calSel);

    const allDay = el('input', { type: 'checkbox', checked: !!ev.allDay });
    const allRow = document.createElement('label'); allRow.className = 'cal-field cal-inline';
    allRow.append(allDay, Object.assign(document.createElement('span'), { textContent: 'All-day' })); box.appendChild(allRow);

    const start = this._field(box, 'Start', el('input', { type: 'datetime-local', className: 'cal-input', value: toLocalInput(ev.start) }));
    const end = this._field(box, 'End', el('input', { type: 'datetime-local', className: 'cal-input', value: toLocalInput(ev.end) }));
    const syncAllDay = () => {
      const t = allDay.checked ? 'date' : 'datetime-local';
      start.type = t; end.type = t;
      if (allDay.checked) { start.value = (ev.start ? toLocalInput(ev.start) : '').slice(0, 10); end.value = (ev.end ? toLocalInput(ev.end) : '').slice(0, 10); }
    };
    allDay.addEventListener('change', syncAllDay); syncAllDay();

    const desc = this._field(box, 'Description', el('textarea', { className: 'cal-input', rows: 3, value: ev.description || '' }));

    // Recurrence builder.
    const recurWrap = document.createElement('div'); recurWrap.className = 'cal-recur';
    const freqSel = el('select', { className: 'cal-input' });
    for (const [v, t] of [['', 'Does not repeat'], ['DAILY', 'Daily'], ['WEEKLY', 'Weekly'], ['MONTHLY', 'Monthly'], ['YEARLY', 'Yearly']]) freqSel.appendChild(el('option', { value: v, textContent: t }));
    freqSel.value = ev.rrule ? ev.rrule.freq : '';
    this._field(box, 'Repeat', freqSel);
    // BYDAY chips (weekly).
    const bydayRow = document.createElement('div'); bydayRow.className = 'cal-byday'; bydayRow.hidden = freqSel.value !== 'WEEKLY';
    const bydaySet = new Set(ev.rrule && ev.rrule.byday || []);
    DAYS_ABBR.forEach(([code, lab]) => {
      const chip = el('button', { type: 'button', className: 'cal-byday-chip', textContent: lab });
      chip.setAttribute('aria-pressed', bydaySet.has(code) ? 'true' : 'false');
      if (bydaySet.has(code)) chip.classList.add('on');
      chip.addEventListener('click', () => { if (bydaySet.has(code)) { bydaySet.delete(code); chip.classList.remove('on'); chip.setAttribute('aria-pressed', 'false'); } else { bydaySet.add(code); chip.classList.add('on'); chip.setAttribute('aria-pressed', 'true'); } });
      chip.dataset.code = code; bydayRow.appendChild(chip);
    });
    box.appendChild(bydayRow);
    // COUNT / UNTIL.
    const countInput = el('input', { type: 'number', min: 1, className: 'cal-input', value: ev.rrule && ev.rrule.count || '' });
    const endRepeatRow = this._field(box, 'Repeat count (optional)', countInput);
    endRepeatRow.hidden = !freqSel.value;
    freqSel.addEventListener('change', () => { bydayRow.hidden = freqSel.value !== 'WEEKLY'; endRepeatRow.hidden = !freqSel.value; });

    // Reminder.
    const remindSel = el('select', { className: 'cal-input' });
    for (const [v, t] of [['', 'None'], ['-PT0M', 'At time of event'], ['-PT10M', '10 min before'], ['-PT30M', '30 min before'], ['-PT1H', '1 hour before'], ['-P1D', '1 day before']]) remindSel.appendChild(el('option', { value: v, textContent: t }));
    remindSel.value = ev.alarms && ev.alarms[0] ? ev.alarms[0].trigger : '';
    this._field(box, 'Reminder', remindSel);

    // Attendees + organizer (for invites).
    const organizer = this._field(box, 'Organizer email', el('input', { type: 'email', className: 'cal-input', value: ev.organizer ? ev.organizer.email : '' }));
    const attendees = this._field(box, 'Attendees (comma emails)', el('input', { type: 'text', className: 'cal-input', value: (ev.attendees || []).map((a) => a.email).join(', ') }));

    // Actions.
    const actions = document.createElement('div'); actions.className = 'cal-modal-actions';
    const save = this._btn('Save', async () => {
      ev.summary = summary.value.trim();
      ev.location = (location.value || '').trim();
      // Persist the QID + coordinates when the location came from a picked place
      // (so the maps backdrop can resolve it). Free-typed text clears them.
      if (pickedPlace && pickedPlace.name === ev.location) {
        ev.locationWikidata = pickedPlace.wikidataId || null;
        ev.locationGeo = pickedPlace.lat != null ? { lat: pickedPlace.lat, lon: pickedPlace.lon } : null;
      } else if (ev.location !== ((existing && existing.location) || '')) {
        ev.locationWikidata = null;
        ev.locationGeo = null;
      }
      ev.description = desc.value;
      ev.calendarId = calSel.value;
      ev.allDay = allDay.checked;
      ev.start = fromLocalInput(start.value, allDay.checked);
      ev.end = fromLocalInput(end.value, allDay.checked) || new Date(ev.start.getTime() + 3600000);
      ev.rrule = freqSel.value ? buildRRule(freqSel.value, bydaySet, countInput.value) : null;
      ev.organizer = organizer.value.trim() ? { email: organizer.value.trim(), cn: '', partstat: '', role: 'CHAIR', rsvp: false } : null;
      ev.attendees = attendees.value.split(',').map((s) => s.trim()).filter(Boolean).map((email) => ({ email, cn: '', partstat: 'NEEDS-ACTION', role: 'REQ-PARTICIPANT', rsvp: true }));
      ev.alarms = remindSel.value ? [{ action: 'DISPLAY', trigger: remindSel.value, description: ev.summary || 'Reminder' }] : [];
      await this.store.putEvent(ev);
      this.events = await this.store.getEvents();
      this.alarms.reset();
      back.remove(); this._renderMain();
    }, 'cal-btn primary');
    actions.appendChild(save);

    if (existing) {
      // Delete: whole series, or just this occurrence (EXDATE) when recurring.
      if (existing.rrule && occ) {
        actions.appendChild(this._btn('Delete this occurrence', async () => {
          const cur = await this._reload(existing.id) || existing;
          cur.exdates = [...(cur.exdates || []), occ.start];
          await this.store.putEvent(cur); this.events = await this.store.getEvents();
          back.remove(); this._renderMain();
        }, 'cal-btn'));
      }
      actions.appendChild(this._btn('Delete' + (existing.rrule ? ' series' : ''), async () => {
        await this.store.deleteEvent(existing.id); this.events = await this.store.getEvents();
        back.remove(); this._renderMain();
      }, 'cal-btn danger'));
      actions.appendChild(this._btn('Export invite (.ics)', () => {
        download(serializeInvite(ev, this.calendarById(ev.calendarId)?.name || 'edot'), `${(ev.summary || 'event').replace(/\W+/g, '_')}.ics`);
      }, 'cal-btn'));
    }
    box.appendChild(actions);
    summary.focus();
  }

  async _reload(id) { const all = await this.store.getEvents(); return all.find((e) => e.id === id); }
  _defaultStart(day) { const d = day ? new Date(day) : new Date(); if (!(day instanceof Date) || (d.getHours() === 0 && d.getMinutes() === 0 && this.view === 'month')) d.setHours(9, 0, 0, 0); return d; }
  _defaultEnd(day) { return new Date(this._defaultStart(day).getTime() + 3600000); }

  // ---- calendar (layer) create / edit -------------------------------------
  openCalendarDialog(existing) {
    const { back, box } = this._modal(existing ? 'Edit calendar' : 'New calendar');
    const cal = existing ? { ...existing } : { id: uid(), name: '', color: nextColor(), visible: true, subscribed: false, sourceUrl: '' };
    const name = this._field(box, 'Name', el('input', { type: 'text', className: 'cal-input', value: cal.name }));
    const colorRow = document.createElement('div'); colorRow.className = 'cal-color-row';
    let chosen = cal.color;
    PALETTE.forEach((c) => {
      const sw = el('button', { type: 'button', className: 'cal-color', 'aria-label': `Color ${c}` });
      sw.style.background = c; if (c === chosen) sw.classList.add('on');
      sw.addEventListener('click', () => { chosen = c; colorRow.querySelectorAll('.cal-color').forEach((x) => x.classList.remove('on')); sw.classList.add('on'); });
      colorRow.appendChild(sw);
    });
    this._field(box, 'Color', colorRow);

    const actions = document.createElement('div'); actions.className = 'cal-modal-actions';
    actions.appendChild(this._btn('Save', async () => {
      cal.name = name.value.trim() || 'Untitled'; cal.color = chosen;
      await this.store.putCalendar(cal);
      this.calendars = await this.store.getCalendars();
      back.remove(); this._renderCalList(); this._renderMain();
    }, 'cal-btn primary'));
    if (cal.subscribed) {
      actions.appendChild(this._btn('Refresh feed', async () => { await this.refreshSubscription(cal); back.remove(); }, 'cal-btn'));
    }
    actions.appendChild(this._btn('Export .ics', () => this.exportCalendar(cal), 'cal-btn'));
    if (existing) {
      actions.appendChild(this._btn('Share to group', () => { this.shareCalendarToGroup(cal); back.remove(); }, 'cal-btn'));
      actions.appendChild(this._btn('Open as table', () => { this.calendarEventsToTable(cal); back.remove(); }, 'cal-btn'));
    }
    if (existing && this.calendars.length > 1) {
      actions.appendChild(this._btn('Delete', async () => {
        await this.store.deleteCalendar(cal.id); this.calendars = await this.store.getCalendars(); this.events = await this.store.getEvents();
        back.remove(); this._renderCalList(); this._renderMain();
      }, 'cal-btn danger'));
    }
    box.appendChild(actions);
    name.focus();
  }

  // ---- subscribe / import / export ----------------------------------------
  openSubscribeDialog() {
    const { back, box } = this._modal('Subscribe to ICS feed');
    const note = document.createElement('p'); note.className = 'cal-note';
    note.textContent = 'Heads up: most public ICS feeds are NOT CORS-enabled, so the browser may block the fetch. The reliable option is "Import .ics file" below.';
    box.appendChild(note);
    const url = this._field(box, 'Feed URL', el('input', { type: 'url', className: 'cal-input', placeholder: 'https://…/calendar.ics' }));
    const name = this._field(box, 'Name', el('input', { type: 'text', className: 'cal-input', placeholder: 'Subscribed calendar' }));
    const status = document.createElement('div'); status.className = 'cal-note'; box.appendChild(status);
    const actions = document.createElement('div'); actions.className = 'cal-modal-actions';
    actions.appendChild(this._btn('Subscribe', async () => {
      if (!url.value) { status.textContent = 'Enter a URL.'; return; }
      status.textContent = 'Fetching…';
      try {
        const cal = await this.subscribe(url.value, name.value || 'Subscribed');
        status.textContent = `Added ${cal.name}.`;
        back.remove(); this._renderCalList(); this._renderMain();
      } catch (err) {
        status.textContent = `Failed (likely CORS): ${err.message}. Try importing the .ics file instead.`;
      }
    }, 'cal-btn primary'));
    actions.appendChild(this._btn('Import file instead…', () => { back.remove(); this._importFilePicker(); }, 'cal-btn'));
    box.appendChild(actions);
  }

  async subscribe(sourceUrl, name) {
    const text = await (await fetch(sourceUrl)).text();
    const { events, calName } = parseICS(text);
    const cal = { id: uid(), name: name || calName || 'Subscribed', color: nextColor(), visible: true, subscribed: true, sourceUrl };
    await this.store.putCalendar(cal);
    await this.store.replaceCalendarEvents(cal.id, events.map((e) => this._toStoredEvent(e, cal.id)));
    this.calendars = await this.store.getCalendars();
    this.events = await this.store.getEvents();
    return cal;
  }

  // ---- catalogue browse (modelled on the Places/geo flow) + group sharing -----
  // Pick from the hoarded .ics catalogue (feeds layer), like saving a place from
  // the geo gazetteer. Adds it as a toggleable calendar layer.
  async openBrowseCalendars() {
    const { back, box } = this._modal('Add a calendar');
    const note = document.createElement('p'); note.className = 'cal-note';
    note.textContent = 'Public calendars from the catalogue. Like saving a place from the map, adding one brings its events in as a layer. (Some feeds are not CORS-enabled and may need importing instead.)';
    box.appendChild(note);
    const list = document.createElement('div'); list.className = 'cal-browse-list'; box.appendChild(list);
    const status = document.createElement('div'); status.className = 'cal-note'; box.appendChild(status);
    try {
      const { allSources } = await import('../../feeds/js/feeds.js');
      const { calendars } = await allSources();
      for (const c of calendars) {
        const row = document.createElement('div'); row.className = 'cal-browse-row';
        const meta = document.createElement('div'); meta.className = 'cal-browse-meta';
        meta.innerHTML = `<div class="cal-browse-name"></div><div class="cal-browse-sub"></div>`;
        meta.querySelector('.cal-browse-name').textContent = c.title;
        meta.querySelector('.cal-browse-sub').textContent = `${c.place ? c.place.name + ' · ' : ''}${c.source || ''}`;
        const add = this._btn('Add', async () => {
          status.textContent = `Adding ${c.title}…`;
          try { await this.subscribe(c.url, c.title); status.textContent = `Added ${c.title}.`; this._renderCalList(); this._renderMain(); }
          catch (err) { status.textContent = `Couldn't fetch (likely CORS): ${err.message}. Try Import .ics.`; }
        }, 'cal-btn');
        row.append(meta, add); list.appendChild(row);
      }
      if (!calendars.length) status.textContent = 'No calendars in the catalogue yet.';
    } catch (e) { status.textContent = `Catalogue unavailable: ${e.message}`; }
  }

  eventsForCalendar(cal) { return this.events.filter((e) => e.calendarId === cal.id); }

  // Share a calendar into the active group channel (groups.share capability).
  shareCalendarToGroup(cal) {
    const evs = this.eventsForCalendar(cal);
    const payload = { name: cal.name, sourceUrl: cal.sourceUrl || '', events: evs.slice(0, 50).map((e) => ({ title: e.summary, start: e.start, end: e.end, location: e.location || '' })) };
    try {
      const okShared = getKernel().capabilities.invoke('groups.share', { title: cal.name, kind: 'calendar', body: `📅 Shared calendar “${cal.name}” (${evs.length} events)`, payload });
      this._flash(okShared === false ? 'Open a Groups channel first to share.' : `Shared “${cal.name}” to your group.`);
    } catch (_) { this._flash('Groups app is not available.'); }
  }

  // Surface a calendar's events as a Data table (data.addTable capability).
  calendarEventsToTable(cal) {
    const evs = this.eventsForCalendar(cal);
    const columns = ['Summary', 'Start', 'End', 'Location'];
    const rows = evs.map((e) => [e.summary || '', e.start || '', e.end || '', e.location || '']);
    try {
      const name = getKernel().capabilities.invoke('data.addTable', { title: cal.name || 'Calendar', columns, rows });
      this._flash(name ? `Opened “${cal.name}” as a data table.` : 'Open the Data app first.');
    } catch (_) { this._flash('Data app is not available.'); }
  }

  _flash(msg) {
    let n = this.querySelector('.cal-flash');
    if (!n) { n = el('div', { className: 'cal-flash' }); this.appendChild(n); }
    n.textContent = msg; n.classList.add('show');
    clearTimeout(this._flashT); this._flashT = setTimeout(() => n.classList.remove('show'), 3500);
  }

  async refreshSubscription(cal) {
    if (!cal.sourceUrl) return;
    const text = await (await fetch(cal.sourceUrl)).text();
    const { events } = parseICS(text);
    await this.store.replaceCalendarEvents(cal.id, events.map((e) => this._toStoredEvent(e, cal.id)));
    this.events = await this.store.getEvents();
    this._renderMain();
  }

  _importFilePicker() {
    const inp = el('input', { type: 'file', accept: '.ics,text/calendar' }); inp.style.display = 'none';
    inp.addEventListener('change', async () => { if (inp.files[0]) await this.importIcsText(await inp.files[0].text()); inp.remove(); });
    this.appendChild(inp); inp.click();
  }

  // Import ICS text into a chosen/new calendar. If exactly one VEVENT looks like
  // an invite (has METHOD or ORGANIZER+ATTENDEE), drop it into the default cal.
  async importIcsText(text, targetCalId) {
    const { events, calName } = parseICS(text);
    if (!events.length) return [];
    let calId = targetCalId;
    if (!calId) {
      const isInvite = events.length === 1 && (events[0].organizer || /METHOD:REQUEST/i.test(text));
      if (isInvite) calId = (this.calendars.find((c) => !c.subscribed) || this.calendars[0]).id;
      else {
        const cal = { id: uid(), name: calName || 'Imported', color: nextColor(), visible: true, subscribed: false, sourceUrl: '' };
        await this.store.putCalendar(cal); this.calendars = await this.store.getCalendars(); calId = cal.id;
      }
    }
    const stored = events.map((e) => this._toStoredEvent(e, calId));
    await this.store.putEvents(stored);
    this.events = await this.store.getEvents();
    this.alarms.reset();
    this._renderCalList(); this._renderMain();
    return stored;
  }

  _toStoredEvent(parsed, calendarId) {
    return {
      id: parsed.uid || uid(), uid: parsed.uid || uid(), calendarId,
      summary: parsed.summary, description: parsed.description, location: parsed.location,
      start: parsed.start, end: parsed.end, allDay: parsed.allDay,
      rrule: parsed.rrule, exdates: parsed.exdates || [], status: parsed.status,
      organizer: parsed.organizer, attendees: parsed.attendees || [], alarms: parsed.alarms || [],
    };
  }

  exportCalendar(cal) {
    const evs = this.events.filter((e) => e.calendarId === cal.id).map((e) => this._toIcsEvent(e));
    download(serializeICS(evs, { calName: cal.name }), `${cal.name.replace(/\W+/g, '_')}.ics`);
  }
  _toIcsEvent(e) {
    return {
      uid: e.uid, summary: e.summary, description: e.description, location: e.location,
      start: e.start, end: e.end, allDay: e.allDay, status: e.status,
      rrule: e.rrule, exdates: e.exdates, organizer: e.organizer, attendees: e.attendees, alarms: e.alarms,
    };
  }
}

// ---- small DOM + value helpers ------------------------------------------
function el(tag, props = {}) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'className') node.className = v;
    else if (k === 'textContent') node.textContent = v;
    else if (k === 'value') node.value = v;
    else if (k === 'checked') node.checked = v;
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  return node;
}
function buildRRule(freq, bydaySet, count) {
  const r = { freq, interval: 1 };
  if (freq === 'WEEKLY' && bydaySet.size) r.byday = [...bydaySet];
  if (count) r.count = parseInt(count, 10);
  return r;
}
function pad(n) { return String(n).padStart(2, '0'); }
function toLocalInput(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
function fromLocalInput(v, allDay) {
  if (!v) return null;
  if (allDay && v.length === 10) { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); }
  return new Date(v);
}
function download(text, filename) {
  const blob = new Blob([text], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

customElements.define('edot-calendar', EdotCalendar);
