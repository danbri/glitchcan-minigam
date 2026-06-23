// views.js — pure DOM renderers for the four calendar views.
//
// Each renderer takes a context { occurrences, range, date, onSelectDate,
// onOpenEvent, onCreate } and returns a DOM node. `occurrences` is the already-
// expanded, layer-filtered list: { event, calendar, start, end, allDay }.
// Keeping these pure (no store/IDB access) makes them trivial to unit-test and
// re-render. Month view is an ARIA grid and keyboard-navigable.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

function ymd(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function isToday(d) { return ymd(d) === ymd(new Date()); }
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function timeLabel(d) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Place a colored chip for an occurrence; clicking opens the event editor.
function chip(occ, ctx, { showTime = true } = {}) {
  const el = document.createElement('button');
  el.className = 'cal-chip';
  el.type = 'button';
  el.style.setProperty('--chip', occ.calendar ? occ.calendar.color : '#888');
  el.dataset.uid = occ.event.uid || occ.event.id;
  const t = showTime && !occ.allDay ? `${timeLabel(occ.start)} ` : '';
  el.textContent = `${t}${occ.event.summary || '(no title)'}`;
  el.setAttribute('aria-label',
    `${occ.event.summary || 'Untitled event'}${occ.allDay ? ', all day' : ', ' + timeLabel(occ.start)}` +
    `${occ.calendar ? ', ' + occ.calendar.name : ''}`);
  el.addEventListener('click', (e) => { e.stopPropagation(); ctx.onOpenEvent(occ); });
  return el;
}

// ---- MONTH ---------------------------------------------------------------
export function renderMonth(ctx) {
  const { date } = ctx;
  const wrap = document.createElement('div');
  wrap.className = 'cal-month';
  wrap.setAttribute('role', 'grid');
  wrap.setAttribute('aria-label', `${MONTHS[date.getMonth()]} ${date.getFullYear()}`);

  // Weekday header row.
  const head = document.createElement('div'); head.className = 'cal-month-head'; head.setAttribute('role', 'row');
  for (const w of WEEKDAYS) {
    const h = document.createElement('div'); h.className = 'cal-wd'; h.setAttribute('role', 'columnheader'); h.textContent = w;
    head.appendChild(h);
  }
  wrap.appendChild(head);

  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = startOfDay(new Date(first));
  gridStart.setDate(gridStart.getDate() - gridStart.getDay()); // back to Sunday

  // Bucket occurrences by day for O(1) lookup.
  const byDay = new Map();
  for (const occ of ctx.occurrences) {
    const k = ymd(occ.start);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(occ);
  }

  const grid = document.createElement('div'); grid.className = 'cal-month-grid';
  for (let week = 0; week < 6; week++) {
    const row = document.createElement('div'); row.className = 'cal-week-row'; row.setAttribute('role', 'row');
    for (let d = 0; d < 7; d++) {
      const cell = document.createElement('div');
      const day = new Date(gridStart); day.setDate(gridStart.getDate() + week * 7 + d);
      cell.className = 'cal-day';
      cell.setAttribute('role', 'gridcell');
      cell.tabIndex = isToday(day) ? 0 : -1;
      cell.dataset.date = day.toISOString();
      if (day.getMonth() !== date.getMonth()) cell.classList.add('other-month');
      if (isToday(day)) cell.classList.add('today');
      cell.setAttribute('aria-label', day.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }));

      const num = document.createElement('div'); num.className = 'cal-daynum'; num.textContent = day.getDate();
      cell.appendChild(num);

      const list = document.createElement('div'); list.className = 'cal-day-events';
      const occs = (byDay.get(ymd(day)) || []).sort((a, b) => a.start - b.start);
      for (const occ of occs.slice(0, 4)) list.appendChild(chip(occ, ctx, { showTime: true }));
      if (occs.length > 4) {
        const more = document.createElement('div'); more.className = 'cal-more';
        more.textContent = `+${occs.length - 4} more`;
        list.appendChild(more);
      }
      cell.appendChild(list);

      cell.addEventListener('click', () => ctx.onSelectDate(day));
      cell.addEventListener('dblclick', () => ctx.onCreate(day));
      cell.addEventListener('keydown', (e) => onGridKey(e, grid, day, ctx));
      row.appendChild(cell);
    }
    grid.appendChild(row);
  }
  wrap.appendChild(grid);
  return wrap;
}

// Arrow-key roving focus across the month grid (ARIA grid keyboard model).
function onGridKey(e, grid, day, ctx) {
  const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (e.key in moves) {
    e.preventDefault();
    const next = new Date(day); next.setDate(day.getDate() + moves[e.key]);
    const target = grid.querySelector(`.cal-day[data-date="${next.toISOString()}"]`);
    if (target) { target.tabIndex = 0; e.currentTarget.tabIndex = -1; target.focus(); }
    else ctx.onSelectDate(next); // off-grid: navigate the whole view
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault(); ctx.onCreate(day);
  }
}

// ---- WEEK / DAY (shared time-grid renderer) ------------------------------
function renderTimeGrid(ctx, days) {
  const wrap = document.createElement('div'); wrap.className = 'cal-timegrid';
  wrap.style.setProperty('--cols', String(days.length)); // 1 (day) or 7 (week)

  // All-day band at the top.
  const allDayBand = document.createElement('div'); allDayBand.className = 'cal-allday-band';
  const adGutter = document.createElement('div'); adGutter.className = 'cal-time-gutter cal-allday-label'; adGutter.textContent = 'all-day';
  allDayBand.appendChild(adGutter);

  const colHead = document.createElement('div'); colHead.className = 'cal-col-head';
  colHead.appendChild(document.createElement('div')).className = 'cal-time-gutter';

  const byDayTimed = days.map(() => []);
  const byDayAll = days.map(() => []);
  for (const occ of ctx.occurrences) {
    const idx = days.findIndex((d) => ymd(d) === ymd(occ.start));
    if (idx === -1) continue;
    (occ.allDay ? byDayAll : byDayTimed)[idx].push(occ);
  }

  days.forEach((d, i) => {
    const h = document.createElement('div'); h.className = 'cal-col-head-cell';
    if (isToday(d)) h.classList.add('today');
    h.innerHTML = `<span class="wd">${WEEKDAYS[d.getDay()]}</span> <span class="dn">${d.getDate()}</span>`;
    h.addEventListener('click', () => ctx.onCreate(d));
    colHead.appendChild(h);

    const adCell = document.createElement('div'); adCell.className = 'cal-allday-cell';
    for (const occ of byDayAll[i].sort((a, b) => a.start - b.start)) adCell.appendChild(chip(occ, ctx, { showTime: false }));
    allDayBand.appendChild(adCell);
  });

  // Hour rows + absolutely-positioned event blocks per column.
  const body = document.createElement('div'); body.className = 'cal-timegrid-body';
  const gutter = document.createElement('div'); gutter.className = 'cal-hours';
  for (let h = 0; h < 24; h++) {
    const hr = document.createElement('div'); hr.className = 'cal-hour';
    hr.textContent = h === 0 ? '' : `${(h % 12) || 12}${h < 12 ? 'am' : 'pm'}`;
    gutter.appendChild(hr);
  }
  body.appendChild(gutter);

  days.forEach((d, i) => {
    const col = document.createElement('div'); col.className = 'cal-day-col';
    for (let h = 0; h < 24; h++) { const slot = document.createElement('div'); slot.className = 'cal-slot'; col.appendChild(slot); }
    col.addEventListener('dblclick', (e) => {
      const rect = col.getBoundingClientRect();
      const hr = Math.floor(((e.clientY - rect.top) / rect.height) * 24);
      const start = new Date(d); start.setHours(Math.max(0, Math.min(23, hr)), 0, 0, 0);
      ctx.onCreate(start);
    });
    for (const occ of byDayTimed[i].sort((a, b) => a.start - b.start)) {
      const block = chip(occ, ctx, { showTime: true });
      block.classList.add('cal-block');
      const startMin = occ.start.getHours() * 60 + occ.start.getMinutes();
      const endMin = occ.end ? Math.max(startMin + 30, occ.end.getHours() * 60 + occ.end.getMinutes()) : startMin + 60;
      block.style.top = `${(startMin / 1440) * 100}%`;
      block.style.height = `${((endMin - startMin) / 1440) * 100}%`;
      col.appendChild(block);
    }
    body.appendChild(col);
  });

  wrap.appendChild(colHead);
  wrap.appendChild(allDayBand);
  wrap.appendChild(body);
  return wrap;
}

export function renderWeek(ctx) {
  const start = startOfDay(ctx.date); start.setDate(start.getDate() - start.getDay());
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  return renderTimeGrid(ctx, days);
}

export function renderDay(ctx) {
  return renderTimeGrid(ctx, [startOfDay(ctx.date)]);
}

// ---- AGENDA (list) -------------------------------------------------------
export function renderAgenda(ctx) {
  const wrap = document.createElement('div'); wrap.className = 'cal-agenda';
  wrap.setAttribute('role', 'list');
  const sorted = [...ctx.occurrences].sort((a, b) => a.start - b.start);
  if (!sorted.length) {
    const empty = document.createElement('div'); empty.className = 'cal-empty';
    empty.textContent = 'No events in this range.';
    wrap.appendChild(empty);
    return wrap;
  }
  let lastDay = '';
  for (const occ of sorted) {
    const k = ymd(occ.start);
    if (k !== lastDay) {
      const hd = document.createElement('div'); hd.className = 'cal-agenda-date';
      hd.textContent = occ.start.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
      if (isToday(occ.start)) hd.classList.add('today');
      wrap.appendChild(hd);
      lastDay = k;
    }
    const row = document.createElement('button'); row.type = 'button'; row.className = 'cal-agenda-row'; row.setAttribute('role', 'listitem');
    row.style.setProperty('--chip', occ.calendar ? occ.calendar.color : '#888');
    const time = document.createElement('span'); time.className = 'cal-agenda-time';
    time.textContent = occ.allDay ? 'all day' : timeLabel(occ.start);
    const title = document.createElement('span'); title.className = 'cal-agenda-title'; title.textContent = occ.event.summary || '(no title)';
    const loc = document.createElement('span'); loc.className = 'cal-agenda-loc'; loc.textContent = occ.event.location || '';
    row.append(time, title, loc);
    row.addEventListener('click', () => ctx.onOpenEvent(occ));
    wrap.appendChild(row);
  }
  return wrap;
}

export { WEEKDAYS, MONTHS, ymd, startOfDay };
