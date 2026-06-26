# Calendar

The `<edot-calendar>` app: a four-view (month/week/day/agenda) calendar with event CRUD, RRULE recurrence, display alarms, full iCalendar import/export/subscribe, a catalogue browse-picker (fed by the feeds layer), and two integration actions — share a calendar to a Groups channel, and open its events as a Data table. Events persist in IndexedDB (`edot-calendar`). Modelled, for adding external calendars, on the geo "save a place" flow.

## Features

- **Four views** `[stable]` — month (ARIA grid, 6×7), week/day (time grid with all-day band), agenda (grouped list). View tabs + Today + prev/next nav.
- **Event CRUD** `[stable]` — create/edit/delete via dialog: title, location (`<edot-place-input>` with Wikidata), calendar, all-day, start/end, description, repeat, reminder, organizer, attendees.
- **Recurrence (RRULE)** `[stable]` — DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL/COUNT/UNTIL/BYDAY/BYMONTHDAY/BYMONTH; EXDATE; "delete this occurrence". Expansion capped (1000 occ / 100k iters).
- **Display alarms** `[stable]` — `AlarmScheduler` polls every 30s, fires in-app due banner; optional OS Notification if permission already granted.
- **ICS import (file)** `[stable]` — `.ics` upload → events into a new or matching calendar; invites (METHOD:REQUEST) routed to a non-subscribed calendar, keeping ORGANIZER/ATTENDEE.
- **ICS subscribe (URL)** `[partial]` — fetch + parse a feed into a layer; **CORS-limited** at runtime (the dialog says so).
- **Browse catalogue calendars** `[stable]` — "Browse calendars…" lists the hoarded `.ics` catalogue (`feeds/js/feeds.js → allSources()`); "Add" subscribes it. Geo-flow analogue.
- **ICS export** `[stable]` — a calendar → valid `VCALENDAR`; single event → invite.
- **Calendar layers** `[stable]` — multiple named/coloured calendars with a visibility checkbox; hidden layers hide their events.
- **Share to group** `[stable]` — `groups.share` posts the calendar + ≤50 events into the active Groups channel.
- **Open as table** `[stable]` — `data.addTable` surfaces events (Summary/Start/End/Location) as a Data table.
- **Mobile drawer** `[stable]` — sidebar collapses to a ☰ drawer with scrim.
- **Timezones** `[partial]` — TZID/non-Z times treated as local wall-clock (no tz database shipped — documented simplification).

## Side-effecting actions (command-registry inventory)

| Action | Trigger | Effect | Proposed command id |
|--------|---------|--------|---------------------|
| New event | "+ Event" / day dblclick / `openEventDialog` | Create/edit event → `store.putEvent` | `calendar.newEvent` |
| Save event | Event dialog Save | Persist event, reset alarms, re-render | `calendar.saveEvent` |
| Delete event / series | Event dialog Delete | `store.deleteEvent` | `calendar.deleteEvent` |
| Delete one occurrence | Event dialog (recurring) | Append to `exdates`, `putEvent` | `calendar.deleteOccurrence` |
| Switch view | Month/Week/Day/Agenda tabs / `setView` | Re-render main | `calendar.setView` |
| Navigate | ‹ › / Today | Move `date`, re-render | `calendar.navigate` |
| New calendar | "+ New calendar" / `openCalendarDialog` | `store.putCalendar` | `calendar.newCalendar` |
| Toggle layer visibility | Layer checkbox | `putCalendar` (visible) | `calendar.toggleLayer` |
| Subscribe (URL) | Subscribe dialog | fetch + parse + `replaceCalendarEvents` | `calendar.subscribe` |
| Import .ics file | "Import .ics file…" | `importIcsText` → `putEvents` | `calendar.importIcs` |
| Browse + add | "Browse calendars…" → Add | `subscribe(catalogue.url)` | `calendar.browseAdd` |
| Refresh feed | Calendar dialog (subscribed) | re-fetch + `replaceCalendarEvents` | `calendar.refreshFeed` |
| Export .ics | Calendar dialog | download VCALENDAR | `calendar.exportIcs` |
| Export invite | Event dialog | download METHOD:REQUEST | `calendar.exportInvite` |
| Delete calendar | Calendar dialog (≥2 layers) | `store.deleteCalendar` (cascades events) | `calendar.deleteCalendar` |
| Share to group | Calendar dialog → "Share to group" | invoke `groups.share` | `calendar.shareToGroup` |
| Open as table | Calendar dialog → "Open as table" | invoke `data.addTable` | `calendar.openAsTable` |

**Capabilities consumed:** `groups.share` (share calendar), `data.addTable` (events → table). Both wrapped in try/catch, errors surfaced via `_flash()`.
**Capabilities provided:** none.

## User journeys

1. **Add an event** — "+ Event" → fill title/time/location (place autocomplete) → Save → it renders in month/week/agenda; recurring if a repeat is set.
2. **Subscribe to a catalogue calendar** — "Browse calendars…" → see UK Bank Holidays (and others, by place) → "Add" → a new coloured layer appears with its events. (Cross-origin feeds may be CORS-blocked at runtime; Import .ics is the reliable fallback.)
3. **Share a calendar to a group** — open a calendar's ⋯ → "Share to group" → its events post into the active Groups channel as a card (needs a Groups channel open).
4. **Open events as a data table** — ⋯ → "Open as table" → Summary/Start/End/Location appear as a Data table for querying.
5. **Get reminded** — create an event starting soon with a "10 minutes before" reminder → the due banner surfaces in-app when the fire time passes.

## Test coverage

Two suites, 35 assertions (`test-calendar.mjs` 28 + `test-calendar-share.mjs` 7), all green. Labels recorded in `docs/edot/test-coverage.md` (area `calendar`).

| Feature | Covered by (suite :: assertion) | Status |
|---------|----------------------------------|--------|
| Boot + default layer | `test-calendar.mjs` :: "calendar app booted with a default layer" | ✅ |
| ICS parse (escaping, VALARM, round-trip) | `test-calendar.mjs` :: "ICS unescapes text values…", "ICS parses a VALARM with TRIGGER", "ICS serialize re-escapes special chars", "ICS parse->serialize->parse round-trips event + alarm" | ✅ |
| RRULE expansion + EXDATE | `test-calendar.mjs` :: "RRULE weekly COUNT=5 expands to 5…", "…land on the same weekday", "…one week apart", "RRULE EXDATE excludes one occurrence (4 -> 3)" | ✅ |
| Persistence (IndexedDB reload) | `test-calendar.mjs` :: "event persists to IndexedDB and reloads", "persisted event renders as an occurrence" | ✅ |
| Four views render | `test-calendar.mjs` :: "Month view renders an ARIA grid", "Week view renders 7 day columns", "Day view renders 1 day column", "Agenda view renders a list" | ✅ |
| Layer visibility | `test-calendar.mjs` :: "hidden layer hides its events" | ✅ |
| ICS invite import (organizer/attendee) | `test-calendar.mjs` :: "importing an .ics invite adds the event", "invite import keeps ORGANIZER + ATTENDEE" | ✅ |
| Alarms | `test-calendar.mjs` :: "due reminder detected in-app…", "alarm code degrades gracefully without Notification permission" | ✅ |
| Export VCALENDAR | `test-calendar.mjs` :: "calendar exports to a valid VCALENDAR" | ✅ |
| Search | `test-calendar.mjs` :: "search filters events by text" | ✅ |
| Mobile drawer | `test-calendar.mjs` :: "mobile: ☰ toggle is shown", "…opens the calendars drawer", "…tapping the scrim closes…", "…reopens and recloses" | ✅ |
| Subscribe from catalogue → layer + events | `test-calendar-share.mjs` :: "subscribing adds a calendar layer", "the layer is populated with the .ics events" | ✅ |
| Browse picker lists catalogue | `test-calendar-share.mjs` :: "browse picker lists catalogue calendars" | ✅ |
| Share to group | `test-calendar-share.mjs` :: "Share to group invokes groups.share with the calendar", "shared payload carries the events" | ✅ |
| Open as table | `test-calendar-share.mjs` :: "Open as table invokes data.addTable with event rows" | ✅ |

### Gaps (untested)
- **Desktop Title field focus / Day-view button** — UX review flagged these; not asserted by tests (needs a focused interaction test).
- **Live CORS subscribe** — only same-origin fixtures tested.
- **Recurrence edge cases** — BYSETPOS, ordinal BYDAY (`2MO`), BYHOUR/MINUTE, BYWEEKNO/YEARDAY are intentionally unsupported (no test asserts the simplification).
- **Multiple alarms per event** — dialog sets one; multi-alarm import preserved but not exercised.
- **OS Notification surfacing** — `requestPermission` never called by the app; only the in-app banner is tested.
- **"+N more" month overflow** — shown but not clickable; untested.
- **Recurrence `describeRRule`, week WKST anchoring** — partial coverage.

## Known issues
- Timezone handling is wall-clock-local (no IANA tz database) — events from other zones can show at the wrong absolute time.
- Subscribed calendars are read-only in the event dialog (calendar select disabled).
- ICS line folding approximates octets via UTF-16 length (correct for ASCII; conservative for multibyte).
- Browse-catalogue depends on `feeds/js/feeds.js` importing successfully; otherwise "Catalogue unavailable".
