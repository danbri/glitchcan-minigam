// templates.js — built-in edot project templates (problem spaces). Each returns
// a project { manifest, files } that buildProjectZip() turns into a .zip. Content
// is small, self-contained, and synthetic — no real datasets (see the repo data
// ethics rule); these are scaffolds a user starts from and fills in.

// Minimal deck JSON in the shape Slides' normalizeDeck() accepts.
function textEl(role, x, y, w, h, text) {
  return { type: 'text', role, x, y, w, h, runs: [{ text }] };
}
function titleSlide(title, subtitle) {
  return { layout: 'title', background: null, notes: '',
    elements: [textEl('title', 0.1, 0.34, 0.8, 0.18, title), textEl('subtitle', 0.1, 0.54, 0.8, 0.12, subtitle || '')] };
}
function contentSlide(title, body, notes) {
  return { layout: 'title-content', background: null, notes: notes || '',
    elements: [textEl('title', 0.06, 0.06, 0.88, 0.16, title), textEl('body', 0.06, 0.26, 0.88, 0.66, body)] };
}
function deck(title, slides, theme = 'classic') {
  return JSON.stringify({ version: 1, title, theme, slides }, null, 2);
}
function csv(rows) { return rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(',')).join('\n'); }
function doc(title, paras) {
  return `<h1>${title}</h1>\n` + paras.map((p) => (p.startsWith('<') ? p : `<p>${p}</p>`)).join('\n');
}

// ---- Template: Field Survey ----
function fieldSurvey() {
  return {
    manifest: {
      name: 'Field Survey',
      description: 'Plan a site survey: a brief, a sites table, and a findings deck — ready to fill in.',
      problemSpace: 'field-survey',
      apps: ['editor', 'data', 'slides', 'maps'],
      docs: [{ id: 'brief', title: 'Survey Brief', file: 'docs/brief.html' }],
      data: [{ id: 'sites', title: 'Sites', file: 'data/sites.csv', format: 'csv' }],
      slides: [{ id: 'findings', title: 'Findings', file: 'slides/findings.json' }],
    },
    files: {
      'docs/brief.html': doc('Survey Brief', [
        'Goal: record the condition of each site and note anything that needs follow-up.',
        '<h2>Method</h2>',
        'Visit each site in the Sites table, photograph it, and fill in the Condition and Notes columns.',
        '<h2>Deliverable</h2>',
        'A short findings deck (see the Findings slides) summarising what was found.',
      ]),
      'data/sites.csv': csv([
        ['Site', 'Category', 'Condition', 'Notes'],
        ['Site A', 'Path', '', ''],
        ['Site B', 'Bench', '', ''],
        ['Site C', 'Signage', '', ''],
      ]),
      'slides/findings.json': deck('Survey Findings', [
        titleSlide('Survey Findings', 'Draft — fill in after fieldwork'),
        contentSlide('Summary', 'Sites visited:\nIn good condition:\nNeeding follow-up:', 'Fill these counts in from the Sites table.'),
        contentSlide('Recommendations', '1.\n2.\n3.', 'Top actions, most urgent first.'),
      ]),
    },
  };
}

// ---- Template: Event Plan ----
function eventPlan() {
  return {
    manifest: {
      name: 'Event Plan',
      description: 'Organise an event: a run sheet, a guest list, and a schedule deck.',
      problemSpace: 'event-plan',
      apps: ['editor', 'data', 'slides', 'calendar'],
      docs: [{ id: 'runsheet', title: 'Run Sheet', file: 'docs/runsheet.html' }],
      data: [{ id: 'guests', title: 'Guests', file: 'data/guests.csv', format: 'csv' }],
      slides: [{ id: 'schedule', title: 'Schedule', file: 'slides/schedule.json' }],
    },
    files: {
      'docs/runsheet.html': doc('Run Sheet', [
        'A single-page plan for the day. Edit the timings to match your venue.',
        '<h2>Timeline</h2>',
        '<p>09:00 — Setup<br>10:00 — Doors open<br>10:30 — Welcome<br>12:30 — Lunch<br>16:00 — Close</p>',
        '<h2>Owners</h2>',
        'Assign each line above to a named owner before the day.',
      ]),
      'data/guests.csv': csv([
        ['Name', 'Email', 'RSVP', 'Notes'],
        ['', '', 'pending', ''],
        ['', '', 'pending', ''],
      ]),
      'slides/schedule.json': deck('Event Schedule', [
        titleSlide('Welcome', 'Event schedule'),
        contentSlide('Agenda', 'Welcome\nKeynote\nWorkshops\nLunch\nWrap-up'),
        contentSlide('Thank you', 'Questions?\nContact:'),
      ], 'ink'),
    },
  };
}

// ---- Template: Blank ----
function blank() {
  return {
    manifest: {
      name: 'Blank Project',
      description: 'An empty project with one document, one data table, and one slide.',
      problemSpace: 'blank',
      apps: ['editor', 'data', 'slides'],
      docs: [{ id: 'doc', title: 'Document', file: 'docs/doc.html' }],
      data: [{ id: 'table', title: 'Table', file: 'data/table.csv', format: 'csv' }],
      slides: [{ id: 'deck', title: 'Deck', file: 'slides/deck.json' }],
    },
    files: {
      'docs/doc.html': doc('Untitled', ['Start writing…']),
      'data/table.csv': csv([['Column A', 'Column B'], ['', '']]),
      'slides/deck.json': deck('Untitled deck', [titleSlide('Title', 'Subtitle')]),
    },
  };
}

export const TEMPLATES = [
  { id: 'field-survey', icon: '📋', build: fieldSurvey },
  { id: 'event-plan', icon: '🎟', build: eventPlan },
  { id: 'blank', icon: '➕', build: blank },
];

// Convenience: get a template's project object by id.
export function buildTemplate(id) {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown template: ${id}`);
  return t.build();
}
