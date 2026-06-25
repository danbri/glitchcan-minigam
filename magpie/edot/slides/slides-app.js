// slides-app.js — <edot-slides>: authoring, editing, and presenting decks.
//
// Light-DOM custom element (customElements.define), shared CSS (slides.css),
// vanilla ES modules, no globals beyond the window.__slides test hook. Follows
// the edot conventions (mobile-first, accessible, graceful fallbacks).
//
// The component is a thin controller over the canonical deck core
// (slides-model.js): every edit mutates `this.deck`, re-renders the affected
// panel, and debounce-persists to IndexedDB (slides-store.js). Exports/imports
// route through the codecs in slides-formats.js.

import {
  newDeck, newSlide, cloneSlide, themeOf, THEMES, LAYOUTS,
  layoutElements, slideTitle, runsText, bulletLines, elementByRole, normalizeDeck,
} from './slides-model.js';
import { saveDeck, loadDeck, listDecks, deleteDeck } from './slides-store.js';
import * as fmt from './slides-formats.js';
import { fingerprint, typeInfo } from '../js/data-object.js';
import { getKernel } from '../js/edot-kernel.js';

// Multi-instance: one kernel capability `slides.addData`, registered once and
// routed to the most-recently-focused deck — so several <edot-slides> on a page
// (e.g. a Slides view and the Workspace view) don't clobber each other's provider.
const slidesInstances = new Set();
let activeSlides = null;
let slidesCapabilityWired = false;
function wireSlidesCapability() {
  if (slidesCapabilityWired) return;
  try {
    getKernel().capabilities.provide('slides.addData', ({ columns, rows, title } = {}) => {
      const t = (activeSlides && slidesInstances.has(activeSlides)) ? activeSlides : [...slidesInstances].pop();
      if (!t || typeof t.addDataSlide !== 'function') return false;
      t.addDataSlide(columns, rows, title);
      return true;
    });
    slidesCapabilityWired = true;
  } catch (_) { /* kernel optional */ }
}

const LAYOUT_LABELS = {
  title: 'Title', 'title-content': 'Title + Content', 'two-column': 'Two-Column',
  section: 'Section header', blank: 'Blank',
};

export class EdotSlides extends HTMLElement {
  constructor() {
    super();
    this.deck = null;
    this.current = 0;       // selected slide index (edit mode)
    this.presenting = false;
    this.presentIndex = 0;
    this._saveTimer = null;
    this._timerStart = 0;
  }

  async connectedCallback() {
    if (this._built) return;
    this._built = true;
    // Multi-instance registry + focus tracking + the shared capability.
    slidesInstances.add(this);
    if (!activeSlides) activeSlides = this;
    this._onFocusIn = () => { activeSlides = this; };
    this.addEventListener('focusin', this._onFocusIn);
    wireSlidesCapability();
    // Resume the most recent deck if one exists; else start fresh.
    const list = await listDecks().catch(() => []);
    this.deck = list.length ? await loadDeck(list[0].id) : null;
    if (!this.deck) { this.deck = newDeck(); await saveDeck(this.deck); }
    this.deck = normalizeDeck(this.deck);
    this._render();
  }

  disconnectedCallback() {
    if (this._onFocusIn) this.removeEventListener('focusin', this._onFocusIn);
    slidesInstances.delete(this);
    if (activeSlides === this) activeSlides = [...slidesInstances].pop() || null;
  }

  // ---- persistence (debounced, mirrors data-engine._touch) ----
  _touch() {
    this.deck.mtime = Date.now();
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => saveDeck(this.deck).catch(() => {}), 400);
  }
  async _saveNow() { clearTimeout(this._saveTimer); await saveDeck(this.deck); }

  get slide() { return this.deck.slides[this.current]; }

  // ===================================================================
  // Rendering
  // ===================================================================
  _render() {
    this.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'sl-app';
    root.append(this._toolbar(), this._rail(), this._editorPanel(), this._inspector());
    // Scrim behind the slide rail when it's a mobile overlay — tap to close it
    // (otherwise the rail covers the ☰ and can't be dismissed).
    const scrim = document.createElement('div'); scrim.className = 'sl-rail-scrim';
    scrim.addEventListener('click', () => root.classList.remove('rail-open'));
    root.append(scrim);
    this.append(root);
    this._root = root;
    this._renderRail();
    this._renderEditor();
  }

  _btn(label, onClick, opts = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sl-btn' + (opts.primary ? ' primary' : '');
    b.textContent = label;
    if (opts.title) b.title = opts.title;
    if (opts.aria) b.setAttribute('aria-label', opts.aria);
    b.addEventListener('click', onClick);
    return b;
  }

  _toolbar() {
    const tb = document.createElement('div');
    tb.className = 'sl-toolbar';

    const title = document.createElement('input');
    title.className = 'sl-title';
    title.value = this.deck.title;
    title.setAttribute('aria-label', 'Deck title');
    title.addEventListener('input', () => { this.deck.title = title.value; this._touch(); });
    this._titleInput = title;

    const addLayout = document.createElement('select');
    addLayout.className = 'sl-select';
    addLayout.setAttribute('aria-label', 'New slide layout');
    for (const l of LAYOUTS) { const o = document.createElement('option'); o.value = l; o.textContent = LAYOUT_LABELS[l]; addLayout.append(o); }
    addLayout.value = 'title-content';
    this._layoutSelect = addLayout;

    const theme = document.createElement('select');
    theme.className = 'sl-select';
    theme.setAttribute('aria-label', 'Theme');
    for (const [id, t] of Object.entries(THEMES)) { const o = document.createElement('option'); o.value = id; o.textContent = t.name; theme.append(o); }
    theme.value = this.deck.theme;
    theme.addEventListener('change', () => { this.deck.theme = theme.value; this._touch(); this._renderRail(); this._renderEditor(); });

    const menu = this._menu();

    tb.append(
      this._btn('☰', () => this._root.classList.toggle('rail-open'), { aria: 'Toggle slide list' }),
      title,
      this._btn('+ Slide', () => this.addSlide(this._layoutSelect.value), { title: 'Add slide' }),
      addLayout,
      theme,
      spacer(),
      this._btn('▶ Present', () => this.startPresent(), { primary: true, title: 'Present (F5)' }),
      menu,
    );
    return tb;
  }

  _menu() {
    const wrap = document.createElement('div');
    wrap.className = 'sl-menu-wrap';
    const btn = this._btn('File ▾', () => panel.classList.toggle('open'), { aria: 'File menu' });
    const panel = document.createElement('div');
    panel.className = 'sl-menu';
    const item = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sl-menu-item'; b.textContent = label; b.addEventListener('click', () => { panel.classList.remove('open'); fn(); }); return b; };

    panel.append(
      item('New deck', () => this.newDeckPrompt()),
      item('Open deck…', () => this.openLibrary()),
      item('Samples…', () => this.openSamples()),
      hr(),
      item('Import file… (.edeck/.json/.pptx/.odp)', () => this._fileInput.click()),
      hr(),
      item('Export deck (.edeck)', () => this.exportJson()),
      item('Export PPTX', () => this.exportPptx()),
      item('Export ODP', () => this.exportOdp()),
      item('Export PDF', () => this.exportPdf()),
      item('Export HTML', () => this.exportHtml()),
      item('Export PNG (current slide)', () => this.exportPng()),
    );
    // shared hidden file input for imports.
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = '.edeck,.json,.pptx,.odp,application/json';
    file.style.display = 'none';
    file.addEventListener('change', () => { if (file.files[0]) this.importFile(file.files[0]); file.value = ''; });
    this._fileInput = file;

    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) panel.classList.remove('open'); });
    wrap.append(btn, panel, file);
    return wrap;
  }

  _rail() {
    const rail = document.createElement('aside');
    rail.className = 'sl-rail';
    rail.setAttribute('aria-label', 'Slides');
    this._railEl = rail;
    return rail;
  }

  _renderRail() {
    const rail = this._railEl;
    rail.innerHTML = '';
    this.deck.slides.forEach((slide, i) => {
      const item = document.createElement('div');
      item.className = 'sl-thumb' + (i === this.current ? ' active' : '');
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', `Slide ${i + 1}: ${slideTitle(slide) || 'untitled'}`);
      const select = () => { this.current = i; this._renderRail(); this._renderEditor(); this._root.classList.remove('rail-open'); };
      item.addEventListener('click', select);
      item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { select(); e.preventDefault(); } });

      const num = document.createElement('span'); num.className = 'sl-thumb-num'; num.textContent = i + 1;
      const mini = document.createElement('div'); mini.className = 'sl-thumb-mini';
      mini.innerHTML = fmt.slideToSvg(this.deck, i, { width: 240 });

      const ctrls = document.createElement('div'); ctrls.className = 'sl-thumb-ctrls';
      ctrls.append(
        this._miniBtn('▲', 'Move up', () => this.moveSlide(i, -1), i === 0),
        this._miniBtn('▼', 'Move down', () => this.moveSlide(i, +1), i === this.deck.slides.length - 1),
        this._miniBtn('⧉', 'Duplicate', () => this.duplicateSlide(i)),
        this._miniBtn('✕', 'Delete', () => this.deleteSlide(i), this.deck.slides.length <= 1),
      );

      item.append(num, mini, ctrls);
      rail.append(item);
    });
  }

  _miniBtn(label, aria, fn, disabled = false) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sl-mini'; b.textContent = label;
    b.setAttribute('aria-label', aria); b.title = aria;
    b.disabled = disabled;
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    return b;
  }

  _editorPanel() {
    const main = document.createElement('main');
    main.className = 'sl-editor';
    main.setAttribute('aria-label', 'Slide editor');
    this._editorEl = main;
    return main;
  }

  // Render the WYSIWYG-ish editor for the current slide: a 16:9 canvas with
  // contenteditable text placeholders, plus a layout switcher.
  _renderEditor() {
    const main = this._editorEl;
    main.innerHTML = '';
    if (!this.slide) return;
    const slide = this.slide;
    const th = themeOf(this.deck);

    // Per-slide controls.
    const bar = document.createElement('div');
    bar.className = 'sl-slidebar';
    const layoutSel = document.createElement('select');
    layoutSel.className = 'sl-select';
    layoutSel.setAttribute('aria-label', 'Slide layout');
    for (const l of LAYOUTS) { const o = document.createElement('option'); o.value = l; o.textContent = LAYOUT_LABELS[l]; layoutSel.append(o); }
    layoutSel.value = slide.layout;
    layoutSel.addEventListener('change', () => this.changeLayout(layoutSel.value));

    bar.append(
      tag('span', 'sl-slidebar-label', `Slide ${this.current + 1}`),
      layoutSel,
      this._fmtBtn('B', 'bold', 'Bold'),
      this._fmtBtn('I', 'italic', 'Italic'),
      this._btn('• Bullet', () => this._addBullet(), { title: 'Add bullet line to body' }),
      this._btn('⇥ Indent', () => this._indent(+1), { title: 'Indent bullet' }),
      this._btn('⇤ Outdent', () => this._indent(-1), { title: 'Outdent bullet' }),
      spacer(),
      this._btn('🖼 Image', () => this._imgInput.click(), { title: 'Insert image' }),
      this._shapeMenu(),
      this._bgControl(),
    );

    // Canvas.
    const stage = document.createElement('div');
    stage.className = 'sl-stage';
    const canvas = document.createElement('div');
    canvas.className = 'sl-canvas';
    canvas.style.background = slide.background || th.bg;
    canvas.style.setProperty('--accent', th.accent);
    canvas.style.setProperty('--fg', th.fg);
    canvas.style.setProperty('--font', th.font);

    slide.elements.forEach((el, idx) => canvas.append(this._renderElement(el, idx)));
    // Click bare canvas to deselect.
    canvas.addEventListener('pointerdown', (e) => { if (e.target === canvas) this._deselect(); });
    stage.append(canvas);

    // Notes.
    const notesWrap = document.createElement('div');
    notesWrap.className = 'sl-notes';
    const nlabel = document.createElement('label');
    nlabel.textContent = 'Speaker notes';
    nlabel.setAttribute('for', 'sl-notes-area');
    const notes = document.createElement('textarea');
    notes.id = 'sl-notes-area';
    notes.className = 'sl-notes-area';
    notes.value = slide.notes;
    notes.placeholder = 'Notes for this slide (only shown to you in present mode)…';
    notes.addEventListener('input', () => { slide.notes = notes.value; this._touch(); });
    notesWrap.append(nlabel, notes);

    // hidden image input.
    const imgInput = document.createElement('input');
    imgInput.type = 'file'; imgInput.accept = 'image/*'; imgInput.style.display = 'none';
    imgInput.addEventListener('change', () => { if (imgInput.files[0]) this.insertImage(imgInput.files[0]); imgInput.value = ''; });
    this._imgInput = imgInput;

    main.append(bar, stage, notesWrap, imgInput);
    this._renderInspector();
  }

  _renderElement(el, idx) {
    const box = document.createElement('div');
    box.className = 'sl-el sl-el-' + el.type + (idx === this._activeEl ? ' selected' : '');
    box.style.left = pct(el.x); box.style.top = pct(el.y);
    box.style.width = pct(el.w); box.style.height = pct(el.h);
    box.dataset.idx = idx;

    if (el.type === 'text') {
      const isTitle = el.role === 'title' || el.role === 'section';
      const ed = document.createElement('div');
      ed.className = 'sl-text' + (isTitle ? ' is-title' : '');
      ed.contentEditable = 'true';
      ed.setAttribute('role', 'textbox');
      ed.setAttribute('aria-label', isTitle ? 'Title text' : 'Body text');
      ed.dataset.idx = idx;
      // Render runs as <div> lines (one per run) so caret + bullet levels map.
      ed.innerHTML = this._runsToHtml(el);
      ed.addEventListener('input', () => this._syncTextFromDom(idx, ed));
      ed.addEventListener('focus', () => this._selectEl(idx));
      box.append(ed);
    } else if (el.type === 'image') {
      const img = document.createElement('img');
      img.className = 'sl-img'; img.src = el.dataUrl; img.alt = el.alt || '';
      img.draggable = false;
      box.append(img);
    } else if (el.type === 'shape') {
      const s = document.createElement('div');
      s.className = 'sl-shape sl-shape-' + el.shape;
      s.style.background = el.shape === 'line' ? 'transparent' : el.fill;
      s.style.borderColor = el.stroke;
      box.append(s);
    }

    // Select on press; for non-text elements the body is also a move grip
    // (text bodies are for editing, so they move via the explicit handle).
    box.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.sl-handle, .sl-move, .sl-el-del')) return;
      this._selectEl(idx);
      if (el.type !== 'text') this._startMove(idx, e, box);
    });

    if (idx === this._activeEl) this._addElControls(box, el, idx);
    return box;
  }

  // Selection chrome: a move grip, four corner resize handles, and delete.
  _addElControls(box, el, idx) {
    const move = document.createElement('button');
    move.type = 'button'; move.className = 'sl-move'; move.textContent = '✥'; move.title = 'Move'; move.setAttribute('aria-label', 'Move element');
    move.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this._startMove(idx, e, box); });
    box.append(move);
    for (const corner of ['nw', 'ne', 'sw', 'se']) {
      const h = document.createElement('div'); h.className = 'sl-handle sl-handle-' + corner; h.setAttribute('aria-hidden', 'true');
      h.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this._startResize(idx, corner, e, box); });
      box.append(h);
    }
    box.append(this._delHandle(idx));
  }

  _delHandle(idx) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sl-el-del'; b.textContent = '✕';
    b.setAttribute('aria-label', 'Delete element');
    b.addEventListener('click', (e) => { e.stopPropagation(); this.deleteElement(idx); });
    return b;
  }

  // ---- sub-object selection / move / resize / re-layer ----
  // Select without a full re-render (so text editing keeps its caret); just swap
  // the selection chrome and refresh the inspector.
  _selectEl(idx) {
    if (this._activeEl === idx) { this._renderInspector(); return; }
    this._clearSelectionChrome();
    this._activeEl = idx;
    const box = this._editorEl && this._editorEl.querySelector(`.sl-el[data-idx="${idx}"]`);
    const el = this.slide && this.slide.elements[idx];
    if (box && el) { box.classList.add('selected'); this._addElControls(box, el, idx); }
    this._renderInspector();
  }
  _deselect() {
    if (this._activeEl == null) return;
    this._clearSelectionChrome();
    this._activeEl = null;
    this._renderInspector();
  }
  _clearSelectionChrome() {
    const prev = this._editorEl && this._editorEl.querySelector('.sl-el.selected');
    if (prev) { prev.classList.remove('selected'); prev.querySelectorAll('.sl-handle, .sl-move, .sl-el-del').forEach((n) => n.remove()); }
  }

  _startMove(idx, e, box) {
    const el = this.slide.elements[idx];
    const rect = box.parentElement.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, ox = el.x, oy = el.y;
    try { box.setPointerCapture(e.pointerId); } catch (_) { /* */ }
    const move = (ev) => {
      el.x = clamp(ox + (ev.clientX - sx) / rect.width, 0, 1 - el.w);
      el.y = clamp(oy + (ev.clientY - sy) / rect.height, 0, 1 - el.h);
      box.style.left = pct(el.x); box.style.top = pct(el.y);
    };
    const up = () => {
      box.removeEventListener('pointermove', move); box.removeEventListener('pointerup', up); box.removeEventListener('pointercancel', up);
      this._touch(); this._renderRailThumb(this.current); this._renderInspector();
    };
    box.addEventListener('pointermove', move); box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  }

  _startResize(idx, corner, e, box) {
    const el = this.slide.elements[idx];
    const rect = box.parentElement.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, o = { x: el.x, y: el.y, w: el.w, h: el.h };
    const west = corner.includes('w'), north = corner.includes('n'); const MIN = 0.04;
    try { box.setPointerCapture(e.pointerId); } catch (_) { /* */ }
    const move = (ev) => {
      const dx = (ev.clientX - sx) / rect.width, dy = (ev.clientY - sy) / rect.height;
      if (west) { const nx = clamp(o.x + dx, 0, o.x + o.w - MIN); el.x = nx; el.w = o.x + o.w - nx; }
      else { el.w = clamp(o.w + dx, MIN, 1 - o.x); }
      if (north) { const ny = clamp(o.y + dy, 0, o.y + o.h - MIN); el.y = ny; el.h = o.y + o.h - ny; }
      else { el.h = clamp(o.h + dy, MIN, 1 - o.y); }
      box.style.left = pct(el.x); box.style.top = pct(el.y); box.style.width = pct(el.w); box.style.height = pct(el.h);
    };
    const up = () => {
      box.removeEventListener('pointermove', move); box.removeEventListener('pointerup', up); box.removeEventListener('pointercancel', up);
      this._touch(); this._renderRailThumb(this.current); this._renderInspector();
    };
    box.addEventListener('pointermove', move); box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  }

  // z-order is array order (later = on top).
  _reorder(dir) {
    const i = this._activeEl, arr = this.slide && this.slide.elements;
    if (i == null || !arr || !arr[i]) return;
    let j;
    if (dir === 'front') j = arr.length - 1;
    else if (dir === 'back') j = 0;
    else j = clamp(i + dir, 0, arr.length - 1);
    if (j === i) return;
    const [el] = arr.splice(i, 1); arr.splice(j, 0, el);
    this._activeEl = j;
    this._touch(); this._renderEditor(); this._renderRailThumb(this.current);
  }

  _renderInspector() {
    const ins = this._inspectorEl; if (!ins) return;
    const i = this._activeEl, el = (i != null && this.slide) ? this.slide.elements[i] : null;
    ins.innerHTML = '';
    if (!el) { ins.hidden = true; return; }
    ins.hidden = false;
    ins.append(tag('h3', 'sl-ins-h', `${el.type[0].toUpperCase()}${el.type.slice(1)}${el.role ? ' · ' + el.role : ''}`));
    ins.append(tag('div', 'sl-ins-label', 'Arrange'));
    const arrange = tag('div', 'sl-ins-row');
    arrange.append(
      this._btn('⤒ Front', () => this._reorder('front'), { title: 'Bring to front' }),
      this._btn('↑', () => this._reorder(+1), { title: 'Bring forward' }),
      this._btn('↓', () => this._reorder(-1), { title: 'Send backward' }),
      this._btn('⤓ Back', () => this._reorder('back'), { title: 'Send to back' }),
    );
    ins.append(arrange);
    if (el.type === 'shape') {
      const colors = tag('div', 'sl-ins-row');
      const fill = document.createElement('input'); fill.type = 'color'; fill.value = el.fill || '#888888'; fill.title = 'Fill';
      fill.addEventListener('input', () => { el.fill = fill.value; this._touch(); this._renderEditor(); this._renderRailThumb(this.current); });
      const stroke = document.createElement('input'); stroke.type = 'color'; stroke.value = el.stroke || '#333333'; stroke.title = 'Stroke';
      stroke.addEventListener('input', () => { el.stroke = stroke.value; this._touch(); this._renderEditor(); this._renderRailThumb(this.current); });
      colors.append(tag('span', 'sl-ins-mini', 'Fill'), fill, tag('span', 'sl-ins-mini', 'Stroke'), stroke);
      ins.append(tag('div', 'sl-ins-label', 'Colour'), colors);
    }
    ins.append(tag('div', 'sl-ins-pos', `x ${Math.round(el.x * 100)}% · y ${Math.round(el.y * 100)}% · ${Math.round(el.w * 100)}×${Math.round(el.h * 100)}`));
    ins.append(this._btn('🗑 Delete element', () => this.deleteElement(i), { title: 'Delete' }));
  }

  _runsToHtml(el) {
    const lines = bulletLines(el);
    if (!lines.length) return '<div><br></div>';
    return lines.map((ln) => {
      let t = escapeHtml(ln.text) || '<br>';
      if (ln.bold) t = `<b>${t}</b>`;
      if (ln.italic) t = `<i>${t}</i>`;
      const ind = ln.level ? ` style="margin-left:${ln.level * 1.4}em" data-level="${ln.level}"` : ' data-level="0"';
      return `<div${ind}>${t}</div>`;
    }).join('');
  }

  // Read DOM lines back into runs, preserving bold/italic/level per line.
  _syncTextFromDom(idx, ed) {
    const el = this.slide.elements[idx];
    const lineNodes = Array.from(ed.children).filter((n) => n.tagName === 'DIV');
    const nodes = lineNodes.length ? lineNodes : [ed];
    el.runs = nodes.map((node) => {
      const level = parseInt(node.dataset && node.dataset.level || '0', 10) || 0;
      const bold = !!node.querySelector('b, strong') || /^(B|STRONG)$/.test(node.tagName);
      const italic = !!node.querySelector('i, em') || /^(I|EM)$/.test(node.tagName);
      return { text: node.textContent, bold, italic, level };
    });
    if (!el.runs.length) el.runs = [{ text: '' }];
    this._touch();
    this._renderRailThumb(this.current);
  }

  // Cheap thumbnail refresh for one slide (avoids re-rendering the whole rail
  // on every keystroke).
  _renderRailThumb(i) {
    const item = this._railEl.children[i];
    if (!item) return;
    const mini = item.querySelector('.sl-thumb-mini');
    if (mini) mini.innerHTML = fmt.slideToSvg(this.deck, i, { width: 240 });
  }

  _fmtBtn(label, cmd, aria) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sl-btn sl-fmt'; b.textContent = label; b.title = aria;
    b.setAttribute('aria-label', aria);
    // Use execCommand on the live selection — applies to the focused editable.
    b.addEventListener('mousedown', (e) => e.preventDefault()); // keep selection
    b.addEventListener('click', () => {
      document.execCommand(cmd, false, null);
      const ed = document.activeElement;
      if (ed && ed.classList && ed.classList.contains('sl-text')) this._syncTextFromDom(+ed.dataset.idx, ed);
    });
    return b;
  }

  _shapeMenu() {
    const wrap = document.createElement('div');
    wrap.className = 'sl-menu-wrap';
    const btn = this._btn('◇ Shape ▾', () => panel.classList.toggle('open'), { aria: 'Insert shape' });
    const panel = document.createElement('div'); panel.className = 'sl-menu';
    for (const [shape, label] of [['rect', '▭ Rectangle'], ['ellipse', '◯ Ellipse'], ['line', '╲ Line']]) {
      const it = document.createElement('button'); it.type = 'button'; it.className = 'sl-menu-item'; it.textContent = label;
      it.addEventListener('click', () => { panel.classList.remove('open'); this.insertShape(shape); });
      panel.append(it);
    }
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) panel.classList.remove('open'); });
    wrap.append(btn, panel);
    return wrap;
  }

  _bgControl() {
    const label = document.createElement('label');
    label.className = 'sl-bg';
    label.title = 'Slide background';
    const input = document.createElement('input');
    input.type = 'color';
    input.value = this.slide.background || themeOf(this.deck).bg;
    input.setAttribute('aria-label', 'Slide background color');
    input.addEventListener('input', () => { this.slide.background = input.value; this._touch(); this._renderEditor(); this._renderRailThumb(this.current); });
    label.append(document.createTextNode('🎨'), input);
    return label;
  }

  _inspector() {
    const el = document.createElement('div');
    el.className = 'sl-inspector';
    el.hidden = true;
    this._inspectorEl = el;
    return el;
  }

  // ===================================================================
  // Editing operations (all mutate this.deck then re-render + persist)
  // ===================================================================
  addSlide(layout = 'title-content') {
    const s = newSlide(layout, { title: 'New slide' });
    this.deck.slides.splice(this.current + 1, 0, s);
    this.current += 1;
    this._touch(); this._renderRail(); this._renderEditor();
  }

  // Public capability: build a content slide from tabular data (columns + rows of
  // cells). Used by the workspace host to push a live query result into a deck
  // with no file round-trip. Returns the new slide's id.
  addDataSlide(columns = [], rows = [], title = 'Data') {
    const cols = (columns || []).map((c) => String(c));
    const line = (r) => cols.map((_, i) => (Array.isArray(r) ? r[i] : r?.[cols[i]]) ?? '').join(' · ');
    const body = (rows || []).slice(0, 12).map(line).join('\n');
    const s = newSlide('title-content', { title: String(title || 'Data'), body });
    this.deck.slides.splice(this.current + 1, 0, s);
    this.current += 1;
    this._touch(); this._renderRail(); this._renderEditor();
    return s.id;
  }

  duplicateSlide(i = this.current) {
    const copy = cloneSlide(this.deck.slides[i]);
    this.deck.slides.splice(i + 1, 0, copy);
    this.current = i + 1;
    this._touch(); this._renderRail(); this._renderEditor();
  }

  deleteSlide(i = this.current) {
    if (this.deck.slides.length <= 1) return;
    this.deck.slides.splice(i, 1);
    this.current = Math.min(this.current, this.deck.slides.length - 1);
    this._touch(); this._renderRail(); this._renderEditor();
  }

  moveSlide(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= this.deck.slides.length) return;
    const [s] = this.deck.slides.splice(i, 1);
    this.deck.slides.splice(j, 0, s);
    if (this.current === i) this.current = j;
    else if (this.current === j) this.current = i;
    this._touch(); this._renderRail(); this._renderEditor();
  }

  // Changing layout remaps existing title/body text into the new placeholders so
  // content isn't lost when the user reshapes a slide.
  changeLayout(layout) {
    const slide = this.slide;
    const oldTitle = elementByRole(slide, 'title') || elementByRole(slide, 'section');
    const oldBody = elementByRole(slide, 'body');
    const titleText = oldTitle ? runsText(oldTitle.runs) : '';
    const fresh = layoutElements(layout, { title: titleText });
    // Carry the body runs over to the new body placeholder if both exist.
    if (oldBody) {
      const newBody = fresh.find((e) => e.role === 'body');
      if (newBody) newBody.runs = oldBody.runs;
    }
    // Keep any non-placeholder elements (images/shapes/extra text).
    const extras = slide.elements.filter((e) => e.type !== 'text' || !['title', 'subtitle', 'section', 'body', 'body2'].includes(e.role));
    slide.layout = layout;
    slide.elements = [...fresh, ...extras];
    this._touch(); this._renderEditor(); this._renderRailThumb(this.current);
  }

  _activeBody() {
    // Prefer the focused editable; else the body placeholder.
    if (this._activeEl != null && this.slide.elements[this._activeEl] && this.slide.elements[this._activeEl].type === 'text') {
      return this.slide.elements[this._activeEl];
    }
    return elementByRole(this.slide, 'body');
  }

  _addBullet() {
    const el = this._activeBody();
    if (!el) return;
    el.runs.push({ text: 'New point', level: 0 });
    this._touch(); this._renderEditor(); this._renderRailThumb(this.current);
  }

  _indent(dir) {
    const el = this._activeBody();
    if (!el || !el.runs.length) return;
    // Indent the last run (simple model — fine for the title/body editor).
    const r = el.runs[el.runs.length - 1];
    r.level = Math.max(0, Math.min(4, (r.level || 0) + dir));
    this._touch(); this._renderEditor(); this._renderRailThumb(this.current);
  }

  async insertImage(file) {
    const dataUrl = await fileToDataUrl(file);
    this.slide.elements.push({ type: 'image', x: 0.25, y: 0.25, w: 0.5, h: 0.45, dataUrl, alt: file.name || '' });
    this._touch(); this._renderEditor(); this._renderRailThumb(this.current);
  }

  insertShape(shape) {
    const th = themeOf(this.deck);
    this.slide.elements.push({ type: 'shape', x: 0.3, y: 0.3, w: 0.3, h: 0.25, shape, fill: th.accent, stroke: th.fg });
    this._touch(); this._renderEditor(); this._renderRailThumb(this.current);
  }

  deleteElement(idx) {
    this.slide.elements.splice(idx, 1);
    this._touch(); this._renderEditor(); this._renderRailThumb(this.current);
  }

  async newDeckPrompt() {
    await this._saveNow();
    this.deck = newDeck();
    await saveDeck(this.deck);
    this.current = 0;
    this._render();
  }

  // ===================================================================
  // Present mode
  // ===================================================================
  startPresent() {
    this.presenting = true;
    this.presentIndex = this.current;
    this._timerStart = Date.now();
    const overlay = document.createElement('div');
    overlay.className = 'sl-present';
    overlay.setAttribute('role', 'region');
    overlay.setAttribute('aria-label', 'Presentation');
    overlay.tabIndex = -1;
    const stage = document.createElement('div'); stage.className = 'sl-present-stage';
    const counter = document.createElement('div'); counter.className = 'sl-present-counter'; counter.setAttribute('aria-live', 'polite');
    overlay.append(stage, counter);
    this._presentOverlay = overlay;
    this._presentStage = stage;
    this._presentCounter = counter;
    document.body.append(overlay);
    this._renderPresent();

    this._keyHandler = (e) => {
      if (!this.presenting) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') { this.presentNext(); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { this.presentPrev(); e.preventDefault(); }
      else if (e.key === 'Escape') { this.exitPresent(); }
      else if (e.key === 'Home') { this.presentIndex = 0; this._renderPresent(); }
      else if (e.key === 'End') { this.presentIndex = this.deck.slides.length - 1; this._renderPresent(); }
    };
    document.addEventListener('keydown', this._keyHandler);

    overlay.addEventListener('click', (e) => {
      if (e.target.closest('.sl-present-counter')) return;
      if (e.clientX < window.innerWidth * 0.3) this.presentPrev(); else this.presentNext();
    });
    let sx = null;
    overlay.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    overlay.addEventListener('touchend', (e) => {
      if (sx == null) return;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) { dx < 0 ? this.presentNext() : this.presentPrev(); }
      sx = null;
    });

    if (this.requestFullscreen || (overlay.requestFullscreen)) {
      overlay.requestFullscreen && overlay.requestFullscreen().catch(() => {});
    }
    overlay.focus();
  }

  _renderPresent() {
    const i = this.presentIndex;
    this._presentStage.innerHTML = fmt.slideToSvg(this.deck, i, { width: 1600 });
    this._presentCounter.textContent = `${i + 1} / ${this.deck.slides.length}`;
  }

  presentNext() { if (this.presentIndex < this.deck.slides.length - 1) { this.presentIndex++; this._renderPresent(); } }
  presentPrev() { if (this.presentIndex > 0) { this.presentIndex--; this._renderPresent(); } }

  exitPresent() {
    this.presenting = false;
    document.removeEventListener('keydown', this._keyHandler);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (this._presentOverlay) this._presentOverlay.remove();
    this._presentOverlay = null;
    // Sync edit selection to where presenting ended.
    this.current = this.presentIndex;
    this._renderRail(); this._renderEditor();
  }

  // ===================================================================
  // Library (open existing decks)
  // ===================================================================
  async openLibrary() {
    const decks = await listDecks();
    const dlg = document.createElement('div');
    dlg.className = 'sl-dialog-bg';
    const box = document.createElement('div'); box.className = 'sl-dialog'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Open deck');
    const h = document.createElement('h2'); h.textContent = 'Your decks'; h.className = 'sl-dialog-h';
    const list = document.createElement('div'); list.className = 'sl-dialog-list';
    if (!decks.length) { const e = document.createElement('p'); e.textContent = 'No saved decks yet.'; list.append(e); }
    for (const d of decks) {
      const row = document.createElement('div'); row.className = 'sl-deck-row';
      const open = document.createElement('button'); open.type = 'button'; open.className = 'sl-deck-open';
      open.textContent = `${d.title} — ${d.slides} slide${d.slides === 1 ? '' : 's'}`;
      open.addEventListener('click', async () => { await this._saveNow(); this.deck = normalizeDeck(await loadDeck(d.id)); this.current = 0; close(); this._render(); });
      const del = document.createElement('button'); del.type = 'button'; del.className = 'sl-deck-del'; del.textContent = '🗑'; del.setAttribute('aria-label', `Delete ${d.title}`);
      del.addEventListener('click', async () => { if (d.id !== this.deck.id) { await deleteDeck(d.id); row.remove(); } });
      row.append(open, del); list.append(row);
    }
    const foot = document.createElement('div'); foot.className = 'sl-dialog-foot';
    const closeBtn = this._btn('Close', () => close());
    foot.append(closeBtn);
    const close = () => dlg.remove();
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    box.append(h, list, foot); dlg.append(box); document.body.append(dlg);
  }

  // Sample decks shipped under third_party/slide-examples/. The manifest +
  // decks are fetched same-origin; the base is relative to slides.html, which
  // lives at magpie/edot/slides/ — three levels below the repo root, hence
  // ../../../ (one deeper than edot.html's ../../third_party/ in examples.js).
  // Chosen decks load through the native-JSON import path (fmt.jsonToDeck) just
  // like a user-supplied .json, so this is one more exercise of that codec.
  async openSamples() {
    const base = '../../../third_party/slide-examples/';
    const dlg = document.createElement('div');
    dlg.className = 'sl-dialog-bg';
    const box = document.createElement('div'); box.className = 'sl-dialog'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Sample decks');
    const h = document.createElement('h2'); h.textContent = 'Sample decks'; h.className = 'sl-dialog-h';
    const list = document.createElement('div'); list.className = 'sl-dialog-list';
    const close = () => dlg.remove();

    box.append(h, list);
    try {
      const manifest = await fetch(base + 'index.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
      const samples = (manifest && manifest.samples) || [];
      if (!samples.length) { const e = document.createElement('p'); e.textContent = 'No samples available.'; list.append(e); }
      for (const s of samples) {
        const row = document.createElement('div'); row.className = 'sl-deck-row';
        const open = document.createElement('button'); open.type = 'button'; open.className = 'sl-deck-open';
        open.textContent = s.title;
        if (s.note) open.title = s.note;
        open.addEventListener('click', async () => {
          try {
            const text = await fetch(base + s.file).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); });
            await this._saveNow();
            // Same path a user-imported .json takes — normalizes + validates.
            this.deck = fmt.jsonToDeck(text);
            if (!this.deck.id) this.deck.id = newDeck().id;
            await saveDeck(this.deck);
            this.current = 0; close(); this._render();
          } catch (err) { this._alert('Could not load sample: ' + err.message); }
        });
        row.append(open); list.append(row);
      }
    } catch (err) {
      const e = document.createElement('p'); e.textContent = 'Could not load samples manifest: ' + err.message; list.append(e);
    }

    const foot = document.createElement('div'); foot.className = 'sl-dialog-foot';
    foot.append(this._btn('Close', () => close()));
    box.append(foot);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    dlg.append(box); document.body.append(dlg);
  }

  // ===================================================================
  // Import / export
  // ===================================================================
  async importFile(file) {
    const name = (file.name || '').toLowerCase();
    try {
      if (name.endsWith('.json') || name.endsWith('.edeck')) {
        this.deck = fmt.jsonToDeck(await file.text());
      } else if (name.endsWith('.pptx')) {
        this.deck = await fmt.pptxToDeck(await file.arrayBuffer());
      } else if (name.endsWith('.odp')) {
        this.deck = await fmt.odpToDeck(await file.arrayBuffer());
      } else {
        // Sniff: try JSON, then ZIP-based.
        const buf = await file.arrayBuffer();
        try { this.deck = fmt.jsonToDeck(new TextDecoder().decode(buf)); }
        catch { this.deck = await fmt.pptxToDeck(buf); }
      }
      if (!this.deck.id) this.deck.id = newDeck().id;
      await saveDeck(this.deck);
      this.current = 0;
      this._render();
    } catch (err) {
      this._alert('Import failed: ' + err.message);
    }
  }

  // The native deck is a portable, self-contained .edeck (JSON) — the canonical
  // representation. Emit a SHA-256 content fingerprint like the other durable
  // forms (storage-independent identity; see js/data-object.js).
  async exportJson() {
    const json = fmt.deckToJson(this.deck);
    this._download(new Blob([json], { type: typeInfo('deck').media }), this._fname('edeck'));
    try { const fp = await fingerprint(json); this._alert(`Exported .edeck · sha256 ${fp.slice(0, 12)}…`); } catch { /* crypto unavailable */ }
  }
  async exportPptx() { this._download(await fmt.deckToPptx(this.deck), this._fname('pptx')); }
  async exportOdp() { this._download(await fmt.deckToOdp(this.deck), this._fname('odp')); }
  exportPdf() { this._download(fmt.deckToPdf(this.deck, this.deck.title), this._fname('pdf')); }
  exportHtml() { this._download(new Blob([fmt.deckToHtml(this.deck)], { type: 'text/html' }), this._fname('html')); }
  async exportPng() {
    const blob = await fmt.slideToPng(this.deck, this.current, { width: 1920 });
    this._download(blob, this._fname(`slide${this.current + 1}.png`, true));
  }

  _fname(ext, raw = false) {
    const base = (this.deck.title || 'deck').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'deck';
    return raw ? `${base}-${ext}` : `${base}.${ext}`;
  }

  _download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  _alert(msg) {
    const t = document.createElement('div'); t.className = 'sl-toast'; t.textContent = msg; t.setAttribute('role', 'status');
    document.body.append(t); setTimeout(() => t.remove(), 4000);
  }
}

// ---- small DOM/util helpers ----
function spacer() { const s = document.createElement('span'); s.className = 'sl-spacer'; return s; }
function hr() { const h = document.createElement('hr'); h.className = 'sl-menu-hr'; return h; }
function tag(name, cls, text) { const e = document.createElement(name); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function pct(v) { return (v * 100).toFixed(3) + '%'; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
function fileToDataUrl(file) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(file); });
}

customElements.define('edot-slides', EdotSlides);

// window.__slides — the headless-test hook: the component class, the codecs,
// the store, and the model factory (so tests can build/inspect decks directly).
window.__slides = {
  EdotSlides,
  formats: fmt,
  store: { saveDeck, loadDeck, listDecks, deleteDeck },
  model: { newDeck, newSlide, cloneSlide, normalizeDeck, themeOf, THEMES, LAYOUTS },
  get el() { return document.querySelector('edot-slides'); },
};
