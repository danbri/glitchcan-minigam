# Feeds & Calendars

The Feeds layer is a lightweight catalogue-driven subsystem that surfaces public RSS/Atom feeds and iCalendar (.ics) calendars into the edot suite. A JSON catalogue (`feeds/data/feed-catalogue.json`) maps each source to a geographic place via its Wikidata QID and coordinates. Two pure parsers (`ics.js`, `feed.js`) handle content; a facade (`feeds.js`) wraps catalogue queries and fetch-plus-parse into a single surface. Parsed results are handed to the Data app via the `data.addTable` kernel capability, making event and news data queryable as ordinary tables. The Calendar app consumes the same catalogue through a browse picker, letting users subscribe to a curated .ics source as a calendar layer.

---

## Features

- **ICS reader — RFC 5545 core** [stable]: `parseIcs()` in `feeds/js/ics.js`. Unfolds folded lines (CRLF/LF), parses property names, parameters, and values, unescapes `\n`, `\,`, `\;`, `\\`. Handles `DTSTART`/`DTEND` as UTC datetimes or `VALUE=DATE` all-day dates; floating (no-Z) datetimes are preserved as-is. `GEO` → `{lat, lon}`. `RRULE` is retained verbatim (no expansion). `VALARM` blocks are silently skipped (no dedicated parser). Calendar name read from `X-WR-CALNAME`. `icsToTable()` shapes events into `{columns: ['Summary','Start','End','Location','URL'], rows}`.
- **RSS 2.0 + Atom 1.0 reader via DOMParser** [stable]: `parseFeed()` in `feeds/js/feed.js`. Uses the browser's `DOMParser` to parse XML (not hand-rolled). Detects format by root element tag; RSS reads `<channel>/<item>`, Atom reads `<feed>/<entry>`. Atom `<link>` resolution prefers `rel="alternate"`, falls back to the first `<link>`. Returns normalized `{title, kind, items:[{title,link,date,summary,id}]}`. Throws if `DOMParser` is unavailable (Node without JSDOM) or XML is not well-formed. `feedToTable()` shapes items into `{columns: ['Title','Date','Link'], rows}`. **DOMParser is a browser API; the parser cannot run headlessly in bare Node — tests use Playwright.**
- **Catalogue queries — `feedsForPlace` / `calendarsForPlace`** [stable]: `feeds/js/feeds.js` lazy-loads `feed-catalogue.json` on first call (cached in `CATALOGUE`). `feedsForPlace(idOrName)` and `calendarsForPlace(idOrName)` match by exact QID, exact lowercase name, or name substring. `allSources()` returns the full `{feeds, calendars}` payload for browser pickers.
- **`fetchFeedTable` / `fetchIcsTable` — fetch → parse → table surface** [stable]: Network fetches the URL, parses with the appropriate parser, returns `{title, columns, rows, kind, count}` (RSS/Atom) or `{title, columns, rows, events, count}` (ICS). Callers pass the result to `data.addTable`. **Cross-origin feeds are CORS-blocked in the browser at runtime; same-origin fixtures work in tests. No proxy is wired in.**
- **Catalogue coverage** [partial]: Seed catalogue ships 5 RSS/Atom feeds (BBC Bristol, London, Manchester, Scotland; USGS earthquakes) and 2 ICS calendars (UK Bank Holidays England & Wales, Scotland). Extending the file requires no code change. No user-facing add-to-catalogue UI exists.

---

## Integration points

| Integration | Used by | Effect |
|---|---|---|
| `feed-catalogue.json` → Calendar browse picker | `calendar/calendar.html` via `app.openBrowseCalendars()` | Lists curated `.ics` calendars; user can subscribe, adding a layer populated with parsed events |
| `feed-catalogue.json` → `feedsForPlace` / `calendarsForPlace` | Any caller (e.g. future Maps geo-context panel) | Returns filtered feed/calendar records for a place QID or name |
| `fetchFeedTable` → `data.addTable` kernel capability | `feeds/js/feeds.js` + calling app | Inserts a parsed feed or ICS as a named table in the Data object browser |
| `fetchIcsTable` → `data.addTable` kernel capability | `calendar/test-calendar-share.mjs` via `app.calendarEventsToTable()` | Sends calendar events as a Data table (columns: Summary/Start/End/Location/URL) |
| `parseIcs` re-exported from `feeds.js` | Calendar app (subscribing to an ICS URL) | ICS text parsed into event objects stored as a calendar layer |
| Per-geo association (QID + lat/lon in catalogue) | Future: Maps events layer, geo-contextual feed discovery | Each catalogue entry carries `place.wikidataId`, `lat`, `lon` enabling geo-keyed lookups |

---

## User journeys

1. **Browse and subscribe to a calendar in Calendar**: User opens the Calendar app and taps the browse / "Add calendar" control. `app.openBrowseCalendars()` calls `allSources()`, which fetches `feed-catalogue.json`. Catalogue calendars appear as rows (`cal-browse-name`). User selects a bank-holidays calendar; `app.subscribe(url, title)` fetches the `.ics`, calls `parseIcs`, stores events as a new calendar layer. The layer appears in the sidebar and events render on the calendar grid.

2. **Open a calendar as a Data table from Calendar**: With a subscribed calendar layer selected, user taps "Open as table". The Calendar app calls `app.calendarEventsToTable(cal)`, which invokes the `data.addTable` kernel capability with `{title, columns:['Summary','Start','End','Location','URL'], rows}`. The Data app receives the table; it appears in the object browser and can be queried with SQL.

3. **Surface a news feed as a Data table**: A script or automation (e.g. inside the Data app) calls `fetchFeedTable(url, title)`. The function fetches the RSS/Atom URL, parses it with `parseFeed`, calls `feedToTable`, and returns the result. The caller invokes `data.addTable` with the columns (`Title`, `Date`, `Link`) and rows. The feed appears as a table in the Data sidebar.

4. **Query feeds for a place by Wikidata QID**: A caller (e.g. a Maps integration) calls `feedsForPlace('Q23154')` (Bristol). `feeds.js` loads the catalogue and filters to `bbc-bristol`. The caller can then use the returned feed record's `url` with `fetchFeedTable` to surface the content.

5. **Query calendars for a place by name**: `calendarsForPlace('Scotland')` returns the `uk-bank-holidays-scotland` record (matched by name substring). The caller can pass the URL to `fetchIcsTable` to retrieve events, or display the record in a picker.

---

## Test coverage

| Feature | Covered by (suite::assertion label) | Status |
|---|---|---|
| `X-WR-CALNAME` extraction | `test-ics.mjs` :: `reads the calendar name (X-WR-CALNAME)` | Pass |
| VEVENT count | `test-ics.mjs` :: `parses both VEVENTs` | Pass |
| Text unescaping — comma in SUMMARY | `test-ics.mjs` :: `unescapes text (comma in SUMMARY)` | Pass |
| Text unescaping — `\n` in DESCRIPTION | `test-ics.mjs` :: `unescapes newlines in DESCRIPTION` | Pass |
| Timed DTSTART/DTEND → ISO UTC | `test-ics.mjs` :: `parses timed DTSTART/DTEND to ISO UTC` | Pass |
| `allDay` flag for timed event | `test-ics.mjs` :: `event is not all-day` | Pass |
| RRULE retained verbatim | `test-ics.mjs` :: `retains the RRULE verbatim` | Pass |
| `VALUE=DATE` → all-day date | `test-ics.mjs` :: `parses VALUE=DATE as an all-day date` | Pass |
| Line unfolding (continuation) | `test-ics.mjs` :: `unfolds continuation lines` | Pass |
| `icsToTable` column shape | `test-ics.mjs` :: `icsToTable yields Summary/Start/End/Location/URL columns` | Pass |
| `icsToTable` row count | `test-ics.mjs` :: `icsToTable has one row per event` | Pass |
| RSS channel title + items | `test-feed.mjs` :: `RSS: reads channel title + items` | Pass |
| RSS item title/link/date | `test-feed.mjs` :: `RSS: item has title/link/date` | Pass |
| Atom feed title + entries | `test-feed.mjs` :: `Atom: reads feed title + entries` | Pass |
| Atom `<link rel="alternate">` resolution | `test-feed.mjs` :: `Atom: resolves rel=alternate link, falls back to first` | Pass |
| `feedToTable` column shape + row count | `test-feed.mjs` :: `feedToTable yields Title/Date/Link rows` | Pass |
| `feedsForPlace` by QID | `test-feed.mjs` :: `catalogue: feeds for a place by QID (Bristol→bbc-bristol)` | Pass |
| `calendarsForPlace` by name | `test-feed.mjs` :: `catalogue: calendars for a place by name (Scotland)` | Pass |
| `allSources` returns both lists | `test-feed.mjs` :: `catalogue: exposes feeds + calendars` | Pass |
| `fetchFeedTable` item count | `test-feed.mjs` :: `fetchFeedTable returns parsed items` | Pass |
| `fetchIcsTable` event count | `test-feed.mjs` :: `fetchIcsTable returns parsed events` | Pass |
| `data.addTable` — feed table | `test-feed.mjs` :: `data.addTable surfaces a feed as a Data table` | Pass |
| `data.addTable` — ICS table | `test-feed.mjs` :: `data.addTable surfaces an .ics as a Data table` | Pass |
| Surfaced tables in Data object browser | `test-feed.mjs` :: `surfaced tables appear in the Data object browser` | Pass |
| Calendar subscribe adds layer | `calendar/test-calendar-share.mjs` :: `subscribing adds a calendar layer` | Pass |
| Layer populated with ICS events | `calendar/test-calendar-share.mjs` :: `the layer is populated with the .ics events` | Pass |
| Browse picker lists catalogue calendars | `calendar/test-calendar-share.mjs` :: `browse picker lists catalogue calendars` | Pass |
| `calendarEventsToTable` → `data.addTable` | `calendar/test-calendar-share.mjs` :: `Open as table invokes data.addTable with event rows` | Pass |
| No page errors (feed test) | `test-feed.mjs` :: `no page errors` | Pass |

### Gaps (untested)

- **Live CORS fetch**: all tests use a local `http.createServer` fixture server on the same origin. Real cross-origin RSS/ICS fetches are CORS-blocked and untested; the CORS caveat is documented in `feeds.js` comments but no proxy is wired.
- **RRULE expansion**: `ics.js` deliberately retains the raw `RRULE` string and delegates expansion to the Calendar app. Calendar's RRULE expansion is tested in `calendar/test-calendar.mjs` but via the calendar layer, not through the feeds surface.
- **TZID resolution**: floating datetimes with a `TZID` parameter are parsed but the timezone offset is not applied; no test covers TZID-qualified datetimes.
- **VALARM blocks**: the ICS parser silently skips `VALARM` components; parsing of alarm trigger/action fields is not tested (alarm delivery is tested in `calendar/test-calendar.mjs` via the calendar layer).
- **GEO property**: `ics.js` parses `GEO` into `{lat, lon}` on events but `icsToTable` does not include those columns; no test covers a fixture containing a `GEO` line.
- **`feedsForPlace` by name substring (non-exact)**: the substring match path in `feedsForPlace`/`calendarsForPlace` is not explicitly exercised (existing tests cover exact QID and exact name).
- **Malformed / error XML in `parseFeed`**: the `parsererror` branch throwing `feed: not well-formed XML` is not tested.
- **Unrecognized syndication format error**: the `throw new Error('feed: unrecognized syndication format…')` branch is not tested.
- **Catalogue fetch failure**: the `!res.ok` branch in `loadCatalogue` and `fetchFeedTable`/`fetchIcsTable` is not tested.
- **`feedsForPlace` by name for feeds (non-calendar)**: only the calendar path (`calendarsForPlace('Scotland')`) is tested by name; `feedsForPlace` is only tested by QID.

---

## Known issues

- **CORS at runtime**: cross-origin RSS/Atom and ICS URLs in the production catalogue (BBC, GOV.UK, USGS) are fetched directly from the browser with no proxy. Most will be rejected by CORS policy. Only same-origin or CORS-permissive sources (e.g. USGS, which sets `Access-Control-Allow-Origin: *`) will succeed without a proxy.
- **DOMParser unavailability in Node**: `feed.js` throws immediately if `DOMParser` is not defined. `test-feed.mjs` works around this by running inside Playwright (a browser context). The ICS parser has no such restriction — it is pure Node-compatible.
- **TZID not resolved**: `parseDate()` notes TZID params but does not convert floating datetimes to UTC. Events in a local timezone will have ISO strings without a `Z` suffix, potentially causing incorrect sorting or display.
- **RRULE not expanded**: recurrence rules are stored verbatim. A subscriber relying on `fetchIcsTable` for recurring events will only see the base event row, not expanded occurrences.
- **Catalogue is a seed, not dynamic**: there is no user-facing UI to add a feed URL to the catalogue. Ad-hoc feeds can be surfaced via `fetchFeedTable`/`fetchIcsTable` directly, but are not persisted to the catalogue.
