// ontology.js — the lightweight, explicit edot ontology. The suite has always
// had an *implicit* entity/relationship model (a Document, a Table, a SlideDeck
// with Slides made of Elements, a Calendar of Events, a Place, a Feed, a MIX
// Channel…) plus actions over those entities and widgets that edit particular
// kinds. This module makes that model explicit so commands can declare the
// entity type they apply to, widgets can declare the type they edit, and the
// whole thing can be emitted as RDF (Turtle) for tooling.
//
// Pure data + helpers (no DOM/network), Node-testable. Emitted RDF uses the edot
// namespace; types reuse the project's existing RDFa/N-Quads affinity.

export const NS = 'https://danbri.github.io/glitchcan-minigam/edot/ns#';

// Entity classes: each has a parent (rdfs:subClassOf), an optional list of
// formats it serializes to, and optional `contains` (composition).
export const TYPES = {
  Entity: { parent: null, label: 'Entity' },
  Document: { parent: 'Entity', label: 'Document', formats: ['docx', 'markdown', 'html', 'odt', 'rtf'] },
  Table: { parent: 'Entity', label: 'Data table', formats: ['csv', 'sqlite', 'nquads'] },
  Spreadsheet: { parent: 'Entity', label: 'Spreadsheet' },
  View: { parent: 'Table', label: 'SQL view' },
  Folder: { parent: 'Entity', label: 'Folder', contains: ['Table', 'Spreadsheet', 'View'] },
  SlideDeck: { parent: 'Entity', label: 'Slide deck', formats: ['edeck', 'pptx', 'odp', 'pdf', 'html'], contains: ['Slide'] },
  Slide: { parent: 'Entity', label: 'Slide', contains: ['SlideElement'] },
  SlideElement: { parent: 'Entity', label: 'Slide element' },
  TextElement: { parent: 'SlideElement', label: 'Text element' },
  ImageElement: { parent: 'SlideElement', label: 'Image element' },
  ShapeElement: { parent: 'SlideElement', label: 'Shape element' },
  Calendar: { parent: 'Entity', label: 'Calendar', formats: ['ics'], contains: ['Event'] },
  Event: { parent: 'Entity', label: 'Calendar event' },
  Place: { parent: 'Entity', label: 'Place', formats: ['geojson', 'kml'] },
  Feed: { parent: 'Entity', label: 'Feed', formats: ['rss', 'atom'], contains: ['FeedItem'] },
  FeedItem: { parent: 'Entity', label: 'Feed item' },
  Mailbox: { parent: 'Entity', label: 'Mailbox', contains: ['MailMessage'] },
  MailMessage: { parent: 'Entity', label: 'Mail message' },
  Project: { parent: 'Entity', label: 'Project', formats: ['edotzip'], contains: ['Document', 'Table', 'SlideDeck', 'Calendar', 'Place'] },
  Channel: { parent: 'Entity', label: 'Group channel', contains: ['ChatMessage'] },
  ChatMessage: { parent: 'Entity', label: 'Chat message' },
  Automation: { parent: 'Entity', label: 'Automation' },
};

// Serialization formats (edot:Format individuals).
export const FORMATS = {
  docx: { label: 'Word', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
  markdown: { label: 'Markdown', mime: 'text/markdown', ext: 'md' },
  html: { label: 'HTML', mime: 'text/html', ext: 'html' },
  odt: { label: 'OpenDocument Text', mime: 'application/vnd.oasis.opendocument.text', ext: 'odt' },
  rtf: { label: 'RTF', mime: 'application/rtf', ext: 'rtf' },
  csv: { label: 'CSV', mime: 'text/csv', ext: 'csv' },
  sqlite: { label: 'SQLite', mime: 'application/vnd.sqlite3', ext: 'sqlite' },
  nquads: { label: 'N-Quads', mime: 'application/n-quads', ext: 'nq' },
  edeck: { label: 'edot deck (JSON)', mime: 'application/json', ext: 'json' },
  pptx: { label: 'PowerPoint', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx' },
  odp: { label: 'OpenDocument Presentation', mime: 'application/vnd.oasis.opendocument.presentation', ext: 'odp' },
  pdf: { label: 'PDF', mime: 'application/pdf', ext: 'pdf' },
  ics: { label: 'iCalendar', mime: 'text/calendar', ext: 'ics' },
  geojson: { label: 'GeoJSON', mime: 'application/geo+json', ext: 'geojson' },
  kml: { label: 'KML', mime: 'application/vnd.google-earth.kml+xml', ext: 'kml' },
  rss: { label: 'RSS', mime: 'application/rss+xml', ext: 'xml' },
  atom: { label: 'Atom', mime: 'application/atom+xml', ext: 'xml' },
  edotzip: { label: 'edot project', mime: 'application/zip', ext: 'edot.zip' },
  png: { label: 'PNG', mime: 'image/png', ext: 'png' },
  jpeg: { label: 'JPEG', mime: 'image/jpeg', ext: 'jpg' },
  svg: { label: 'SVG', mime: 'image/svg+xml', ext: 'svg' },
};

// Action categories (edot:ActionCategory) — the menu/palette grouping.
export const CATEGORIES = ['file', 'format', 'insert', 'arrange', 'data', 'share', 'navigate', 'present', 'automation', 'view'];

// ---- helpers ----
export function ancestorsOf(type) {
  const out = [];
  let t = TYPES[type];
  while (t && t.parent) { out.push(t.parent); t = TYPES[t.parent]; }
  return out;
}
// Is `type` the same as, or a subclass of, `ancestor`?
export function isA(type, ancestor) {
  if (!ancestor) return true;
  if (type === ancestor) return true;
  return ancestorsOf(type).includes(ancestor);
}
// All formats a type can serialize to, including inherited ones.
export function formatsFor(type) {
  const set = new Set();
  let t = type;
  while (t) { for (const f of (TYPES[t] && TYPES[t].formats) || []) set.add(f); t = TYPES[t] && TYPES[t].parent; }
  return [...set];
}
export function isType(type) { return Object.prototype.hasOwnProperty.call(TYPES, type); }

// ---- RDF (Turtle) emission ----
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
export function toTurtle({ widgets = {}, commands = [] } = {}) {
  const L = [];
  L.push('@prefix edot: <' + NS + '> .');
  L.push('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
  L.push('@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .');
  L.push('');
  L.push('# Entity classes');
  for (const [id, t] of Object.entries(TYPES)) {
    L.push(`edot:${id} a rdfs:Class ;`);
    const lines = [`  rdfs:label "${esc(t.label || id)}"`];
    if (t.parent) lines.push(`  rdfs:subClassOf edot:${t.parent}`);
    for (const f of t.formats || []) lines.push(`  edot:hasFormat edot:${f}`);
    for (const c of t.contains || []) lines.push(`  edot:contains edot:${c}`);
    L.push(lines.join(' ;\n') + ' .');
  }
  L.push('');
  L.push('# Formats');
  for (const [id, f] of Object.entries(FORMATS)) {
    L.push(`edot:${id} a edot:Format ; rdfs:label "${esc(f.label)}" ; edot:mime "${esc(f.mime)}" ; edot:ext "${esc(f.ext)}" .`);
  }
  if (Object.keys(widgets).length) {
    L.push('');
    L.push('# Widgets ↔ the entity types they edit');
    for (const [tag, types] of Object.entries(widgets)) {
      for (const ty of [].concat(types)) L.push(`edot:${tag} a edot:Widget ; edot:editsType edot:${ty} .`);
    }
  }
  if (commands.length) {
    L.push('');
    L.push('# Commands (actions) ↔ the entity types they apply to');
    for (const c of commands) {
      const parts = [`edot:cmd_${c.id.replace(/[^A-Za-z0-9]/g, '_')} a edot:Command`, `  edot:commandId "${esc(c.id)}"`, `  rdfs:label "${esc(c.title || c.id)}"`];
      if (c.category) parts.push(`  edot:category edot:${c.category}`);
      if (c.appliesTo) parts.push(`  edot:appliesTo edot:${c.appliesTo}`);
      L.push(parts.join(' ;\n') + ' .');
    }
  }
  return L.join('\n') + '\n';
}

// Known widget→type bindings (the "which widget edits which kind" relation made
// explicit). Extend as widgets are added.
export const WIDGETS = {
  'edot-editor': ['Document'],
  'edot-grid': ['Table'],
  'edot-sheet': ['Spreadsheet'],
  'edot-place-input': ['Place'],
  'edot-slides': ['SlideDeck'],
  'edot-calendar': ['Calendar'],
  'edot-maps': ['Place'],
  'edot-groups': ['Channel'],
  'edot-projects': ['Project'],
};
