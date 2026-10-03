// Parsers for OSM tag values that are not single plain values. Used by every tool that reads OSM tags, so the
// rules live in one place and have fixture tests (tools/test/osm-values.test.mjs; run: node --test magpie/cwplans/tools/test/*.test.mjs).
// Why: faults F2 and F3 in the docklands-data-curation skill.

// A tag can hold several values separated by ";" ("E14 9DT;E14 9FQ", "0;1"). ";;" is an escaped ";" in OSM;
// it does not occur in the tags we read, so it is not handled.
export const osmList = v => v == null ? [] : String(v).split(';').map(s => s.trim()).filter(Boolean);

// addr:unit is free text: mappers write "14", "14a", "Unit 14", "Kiosk 3", "Units 5-6", "Lower Mall". Add the word
// "Unit" only to a bare designator (a number, a number with letters, or a short code such as "R12" or "LG06").
const DESIGNATOR = /^(?:[A-Z]{0,3}\d+[A-Z]?|\d+[A-Z]?\s*[-–]\s*\d+[A-Z]?)$/i;
export function unitLabel(u) {
  const s = String(u ?? '').replace(/\s+/g, ' ').trim(); if (!s) return null;
  return DESIGNATOR.test(s) ? `Unit ${s}` : s;
}
