// feeds.js — the lazy facade over the feed/calendar catalogue, mirroring the
// places layer: a small in-repo catalogue (code → catalogue → query → surface),
// loaded on demand so nothing is fetched unless a user asks for feeds. Querying
// is by place (Wikidata QID or name); surfacing turns a feed/.ics into a Data
// table via parseFeed / parseIcs.
import { parseFeed, feedToTable } from './feed.js';
import { parseIcs, icsToTable } from './ics.js';

let CATALOGUE = null;
const CATALOGUE_URL = new URL('../data/feed-catalogue.json', import.meta.url).href;

export async function loadCatalogue() {
  if (CATALOGUE) return CATALOGUE;
  const res = await fetch(CATALOGUE_URL);
  if (!res.ok) throw new Error(`feeds: catalogue ${res.status}`);
  CATALOGUE = await res.json();
  return CATALOGUE;
}

const norm = (s) => String(s || '').trim().toLowerCase();

// Feeds (RSS/Atom) for a place — match by QID or (loosely) by name.
export async function feedsForPlace(idOrName) {
  const cat = await loadCatalogue();
  const q = norm(idOrName);
  return (cat.feeds || []).filter((f) => norm(f.place.wikidataId) === q || norm(f.place.name) === q || norm(f.place.name).includes(q));
}

// Calendars (.ics) for a place.
export async function calendarsForPlace(idOrName) {
  const cat = await loadCatalogue();
  const q = norm(idOrName);
  return (cat.calendars || []).filter((c) => norm(c.place.wikidataId) === q || norm(c.place.name) === q || norm(c.place.name).includes(q));
}

// Everything in the catalogue (for a browser/picker UI).
export async function allSources() {
  const cat = await loadCatalogue();
  return { feeds: cat.feeds || [], calendars: cat.calendars || [] };
}

// ---- fetch + parse → table (for surfacing into the Data feature) ----
// Cross-origin feeds may be CORS-blocked in the browser; callers should handle
// the rejection (a proxy is the eventual fix). Same-origin fixtures work in tests.

export async function fetchFeedTable(url, title) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const parsed = parseFeed(await res.text());
  const t = feedToTable(parsed.items);
  return { title: title || parsed.title || 'Feed', columns: t.columns, rows: t.rows, kind: parsed.kind, count: parsed.items.length };
}

export async function fetchIcsTable(url, title) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ics ${res.status}`);
  const parsed = parseIcs(await res.text());
  const t = icsToTable(parsed.events);
  return { title: title || parsed.calendarName || 'Calendar', columns: t.columns, rows: t.rows, events: parsed.events, count: parsed.events.length };
}

export { parseFeed, parseIcs, feedToTable, icsToTable };
