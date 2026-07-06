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
  Person: { parent: 'Entity', label: 'Person' },              // a contact / participant
  // Items that live in collection windows (file browsers, galleries, libraries).
  // Each may be local or remote (edot:locality). A File-ish item is "passive"
  // (data only) unless commands declare appliesTo it — passivity is emergent.
  File: { parent: 'Entity', label: 'File', locatable: true },
  Image: { parent: 'File', label: 'Image', formats: ['png', 'jpeg', 'svg'], locatable: true },
  Video: { parent: 'File', label: 'Video', formats: ['mp4', 'webm'], locatable: true },
  Audio: { parent: 'File', label: 'Audio', formats: ['mp3', 'wav'], locatable: true },
  // A window that presents a SET of items of one type (gallery, list, picker).
  Collection: { parent: 'Entity', label: 'Collection' },
  // ---- storage & identity (where data lives, how you reach it) ----
  Provider: { parent: 'Entity', label: 'Provider' },      // a kind of backend (github, s3, local-fs…)
  Account: { parent: 'Entity', label: 'Account' },        // an (authenticated) connection to a provider
  Identity: { parent: 'Entity', label: 'Identity' },      // who you are (OAuth session, WebID, or local)
  Storage: { parent: 'Entity', label: 'Storage', contains: ['Folder', 'File'] }, // a mount: a namespace of folders/files
};

// Where an item can live (the local/remote dimension for File/Image/Video/…).
export const LOCALITY = ['local', 'remote'];

// Collection windows ↔ the item type each presents. These are the "windows
// offering sets of items" — a gallery of Images, a browser of Files, a people
// picker, a video library. (Planned surfaces; declared so the model is ready.)
export const COLLECTIONS = {
  'edot-file-browser': 'File',
  'edot-gallery': 'Image',
  'edot-video-library': 'Video',
  'edot-people': 'Person',
};

// The capabilities a provider/account can offer (same notion as the kernel's
// capabilities, one level up): storage of blobs, or a typed service.
export const CAPABILITIES = ['storage', 'mail', 'calendar', 'chat', 'people', 'vcs'];

// The provider catalogue — the explicit model of WHERE data lives and HOW you
// reach it. `kind` distinguishes OS (local, capability-granted by the OS, no
// remote identity) from platforms (their own identity/login). `auth` is how you
// authenticate; `offers` are the capabilities unlocked; `locality` is local/remote.
// This unifies the four scattered registries: backup BACKENDS, mail adapters,
// auth providers, and (read-only) places gazetteers.
export const PROVIDERS = {
  'local-fs': { label: 'This device', kind: 'os', auth: 'grant', offers: ['storage'], locality: 'local' },
  opfs: { label: 'App private storage', kind: 'os', auth: 'none', offers: ['storage'], locality: 'local' },
  'local-calendar': { label: 'Device calendar', kind: 'os', auth: 'none', offers: ['calendar'], locality: 'local' },
  github: { label: 'GitHub', kind: 'platform', auth: 'oauth', offers: ['storage', 'vcs'], locality: 'remote' },
  s3: { label: 'S3-compatible', kind: 'platform', auth: 'keys', offers: ['storage'], locality: 'remote' },
  webdav: { label: 'WebDAV', kind: 'platform', auth: 'password', offers: ['storage'], locality: 'remote' },
  solid: { label: 'Solid pod', kind: 'platform', auth: 'webid', offers: ['storage', 'people'], locality: 'remote' },
  gmail: { label: 'Gmail', kind: 'platform', auth: 'oauth', offers: ['mail'], locality: 'remote' },
  graph: { label: 'Microsoft 365', kind: 'platform', auth: 'oauth', offers: ['mail', 'calendar', 'people'], locality: 'remote' },
  caldav: { label: 'CalDAV', kind: 'platform', auth: 'password', offers: ['calendar'], locality: 'remote' },
  // XMPP/MIX is a groupware PLATFORM, not just chat: a MIX channel carries
  // several pubsub nodes — messages (chat), participants (people) and shared
  // events (calendar), each a LIVE adapter. The "future of MUCs". (We do NOT
  // claim `storage`: a pubsub node is not a read/write filesystem — shared-file
  // references could be a future capability, but over-claiming storage would be
  // dishonest.)
  xmpp: { label: 'XMPP / MIX', kind: 'platform', auth: 'password', offers: ['chat', 'people', 'calendar'], locality: 'remote' },
};

// Providers offering a given capability (e.g. all the places you could save a file).
export function providersOffering(capability) {
  return Object.entries(PROVIDERS).filter(([, p]) => p.offers.includes(capability)).map(([id]) => id);
}

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
  mp4: { label: 'MP4', mime: 'video/mp4', ext: 'mp4' },
  webm: { label: 'WebM', mime: 'video/webm', ext: 'webm' },
  mp3: { label: 'MP3', mime: 'audio/mpeg', ext: 'mp3' },
  wav: { label: 'WAV', mime: 'audio/wav', ext: 'wav' },
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
export function toTurtle({ widgets = {}, commands = [], collections = {}, providers = {} } = {}) {
  const L = [];
  L.push('@prefix edot: <' + NS + '> .');
  L.push('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
  L.push('@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .');
  L.push('');
  L.push('# Relations');
  L.push('edot:hasFormat a rdf:Property ; rdfs:comment "an entity serializes to a format" .');
  L.push('edot:contains a rdf:Property ; rdfs:comment "composition: a parent holds child entities" .');
  L.push('edot:editsType a rdf:Property ; rdfs:comment "a widget edits entities of a type" .');
  L.push('edot:appliesTo a rdf:Property ; rdfs:comment "a command operates on entities of a type" .');
  L.push('edot:presentsItemsOf a rdf:Property ; rdfs:comment "a collection window shows a set of items of a type" .');
  L.push('edot:locality a rdf:Property ; rdfs:comment "where an item lives: local or remote" .');
  L.push('edot:offers a rdf:Property ; rdfs:comment "a provider/account offers a capability (storage/mail/…)" .');
  L.push('edot:storedIn a rdf:Property ; rdfs:comment "a resource is stored in a Storage mount" .');
  L.push('edot:authenticatedBy a rdf:Property ; rdfs:comment "a Storage uses an Account for access" .');
  L.push('edot:hasIdentity a rdf:Property ; rdfs:comment "an Account carries an Identity" .');
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
  if (Object.keys(collections).length) {
    L.push('');
    L.push('# Collection windows ↔ the item type each presents');
    for (const [tag, type] of Object.entries(collections)) {
      L.push(`edot:${tag} a edot:CollectionView ; edot:presentsItemsOf edot:${type} .`);
    }
  }
  if (Object.keys(providers).length) {
    L.push('');
    L.push('# Providers ↔ how you reach them and what they offer (OS vs platform)');
    for (const [id, p] of Object.entries(providers)) {
      const offers = (p.offers || []).map((c) => `edot:${c}`).join(', ');
      L.push(`edot:${id} a edot:Provider ; rdfs:label "${esc(p.label)}" ; edot:kind "${esc(p.kind)}" ; edot:auth "${esc(p.auth)}" ; edot:locality "${esc(p.locality)}"${offers ? ` ; edot:offers ${offers}` : ''} .`);
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
