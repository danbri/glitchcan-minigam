// slides-model.js — the canonical deck "core" and helpers over it.
//
// The deck is plain JSON; this is the single source of truth that every other
// representation (PPTX / ODP / PDF / HTML / PNG) is derived from. Keeping it a
// pure data structure (no DOM, no classes-with-behaviour) is what makes the
// native .json export lossless and the round-trip tests meaningful.
//
// Coordinate system: element x/y/w/h are normalized 0..1 of the slide W×H.
// The slide is 16:9 by default (see EMU export math in slides-formats.js).

export const DECK_VERSION = 1;

// A small, deliberately limited theme set (colors + fonts only). Themes are
// presentation hints; they round-trip through native JSON but are only
// best-effort in PPTX/ODP (documented in the fidelity matrix).
export const THEMES = {
  classic: { name: 'Classic', bg: '#ffffff', fg: '#1c1c1c', accent: '#8b4513', font: 'Georgia, "Times New Roman", serif' },
  midnight: { name: 'Midnight', bg: '#13151c', fg: '#f0f0f2', accent: '#7aa2ff', font: '-apple-system, "Segoe UI", Roboto, sans-serif' },
  paper: { name: 'Paper', bg: '#f4f1ea', fg: '#2a2620', accent: '#b5651d', font: 'Palatino, Georgia, serif' },
  ink: { name: 'Ink', bg: '#fafafa', fg: '#111111', accent: '#1a73e8', font: '-apple-system, "Segoe UI", Roboto, sans-serif' },
};

// Layout = a named arrangement of placeholder elements. The editor edits these
// placeholders by `role`; the layout id is preserved for re-export/import.
export const LAYOUTS = ['title', 'title-content', 'two-column', 'section', 'blank'];

let _seq = 0;
// Stable-ish unique id. Date.now()+counter avoids crypto dependency and stays
// deterministic-enough within a session; ids are never used in exported bytes
// in a way that would break determinism (slide files are numbered slideN.xml).
export function uid(prefix = 'id') {
  _seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${_seq}`;
}

function textEl(role, x, y, w, h, runs = [{ text: '' }]) {
  return { type: 'text', role, x, y, w, h, runs };
}

// Build the placeholder elements for a layout. `title`/`body` strings seed the
// first run so a freshly added slide is immediately editable.
export function layoutElements(layout, { title = '', body = '' } = {}) {
  const t = (s) => [{ text: s }];
  switch (layout) {
    case 'title':
      return [
        textEl('title', 0.1, 0.34, 0.8, 0.18, t(title || 'Title')),
        textEl('subtitle', 0.1, 0.54, 0.8, 0.12, t(body || 'Subtitle')),
      ];
    case 'section':
      return [textEl('title', 0.08, 0.42, 0.84, 0.18, t(title || 'Section'))];
    case 'two-column':
      return [
        textEl('title', 0.06, 0.06, 0.88, 0.14, t(title || 'Title')),
        textEl('body', 0.06, 0.24, 0.43, 0.68, t(body || '')),
        textEl('body2', 0.51, 0.24, 0.43, 0.68, t('')),
      ];
    case 'blank':
      return [];
    case 'title-content':
    default:
      return [
        textEl('title', 0.06, 0.06, 0.88, 0.16, t(title || 'Title')),
        textEl('body', 0.06, 0.26, 0.88, 0.66, t(body || '')),
      ];
  }
}

export function newSlide(layout = 'title-content', seed = {}) {
  return {
    id: uid('s'),
    layout,
    background: null, // null = inherit theme bg; else a CSS color string
    elements: layoutElements(layout, seed),
    notes: '',
  };
}

export function newDeck(title = 'Untitled deck') {
  return {
    version: DECK_VERSION,
    id: uid('deck'),
    title,
    theme: 'classic',
    mtime: Date.now(),
    slides: [
      newSlide('title', { title, body: '' }),
      newSlide('title-content', { title: 'Slide 2' }),
    ],
  };
}

export function themeOf(deck) {
  return THEMES[deck && deck.theme] || THEMES.classic;
}

// The title element's plain text (used for thumbnails, library, PPTX title id).
export function slideTitle(slide) {
  const el = (slide.elements || []).find((e) => e.type === 'text' && (e.role === 'title' || e.role === 'subtitle'));
  return el ? runsText(el.runs) : '';
}

export function runsText(runs) {
  return (runs || []).map((r) => r.text || '').join('');
}

// Find the placeholder a layout-aware editor edits for a given role.
export function elementByRole(slide, role) {
  return (slide.elements || []).find((e) => e.type === 'text' && e.role === role) || null;
}

// Deep, structural clone for duplicate-slide / undo snapshots. Re-ids the slide
// (and keeps element role/positions) so the duplicate is independent.
export function cloneSlide(slide) {
  const copy = structuredClone(slide);
  copy.id = uid('s');
  return copy;
}

// Validate + normalize an imported/parsed object into a well-formed deck so the
// rest of the app can trust the shape. Drops unknown element types defensively.
export function normalizeDeck(obj) {
  const deck = obj && typeof obj === 'object' ? obj : {};
  const out = {
    version: DECK_VERSION,
    id: typeof deck.id === 'string' ? deck.id : uid('deck'),
    title: typeof deck.title === 'string' ? deck.title : 'Untitled deck',
    theme: THEMES[deck.theme] ? deck.theme : 'classic',
    mtime: Number(deck.mtime) || Date.now(),
    slides: [],
  };
  const slides = Array.isArray(deck.slides) ? deck.slides : [];
  for (const s of slides) {
    out.slides.push({
      id: typeof s.id === 'string' ? s.id : uid('s'),
      layout: LAYOUTS.includes(s.layout) ? s.layout : 'title-content',
      background: typeof s.background === 'string' ? s.background : null,
      elements: (Array.isArray(s.elements) ? s.elements : []).map(normalizeElement).filter(Boolean),
      notes: typeof s.notes === 'string' ? s.notes : '',
    });
  }
  if (!out.slides.length) out.slides.push(newSlide('title', { title: out.title }));
  return out;
}

function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }

function normalizeElement(e) {
  if (!e || typeof e !== 'object') return null;
  // rotation: degrees clockwise, normalized to [0,360). Orientability for any element.
  const base = { x: num(e.x, 0.1), y: num(e.y, 0.1), w: num(e.w, 0.8), h: num(e.h, 0.2), rotation: ((num(e.rotation, 0) % 360) + 360) % 360 };
  if (e.type === 'text') {
    const runs = (Array.isArray(e.runs) ? e.runs : [{ text: '' }]).map((r) => ({
      text: typeof r.text === 'string' ? r.text : '',
      bold: !!r.bold,
      italic: !!r.italic,
      level: num(r.level, 0),
    }));
    return { type: 'text', role: typeof e.role === 'string' ? e.role : undefined, ...base, runs };
  }
  if (e.type === 'image') {
    if (typeof e.dataUrl !== 'string') return null;
    return { type: 'image', ...base, dataUrl: e.dataUrl, alt: typeof e.alt === 'string' ? e.alt : '' };
  }
  if (e.type === 'shape') {
    const shape = ['rect', 'ellipse', 'line'].includes(e.shape) ? e.shape : 'rect';
    return { type: 'shape', ...base, shape, fill: typeof e.fill === 'string' ? e.fill : '#dddddd', stroke: typeof e.stroke === 'string' ? e.stroke : '#333333' };
  }
  return null;
}

// Group a body element's runs into bullet lines (one line per run here; the
// editor keeps one run per logical line with a `level`). Used by every renderer.
export function bulletLines(el) {
  return (el.runs || []).map((r) => ({
    text: r.text || '',
    level: Math.max(0, Math.min(4, r.level || 0)),
    bold: !!r.bold,
    italic: !!r.italic,
  }));
}
