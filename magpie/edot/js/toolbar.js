// toolbar.js — the accessible formatting toolbar.
//
// Implements the WAI-ARIA toolbar pattern: role="toolbar", a single tab stop
// (roving tabindex), arrow-key navigation between controls, Home/End jumps.
// Toggle buttons expose aria-pressed reflecting live command state.

import { COMMANDS, BLOCK_FORMATS, setBlockFormat, currentBlockFormat, createLink, createSemantic, setAlign, currentAlign } from './commands.js';
import { holdLabel, consumedPeek } from './longpress.js';

const LAYOUT = [
  { type: 'block-select' },
  { type: 'group', items: ['bold', 'italic', 'underline', 'strike'] },
  { type: 'group', items: ['alignLeft', 'alignCenter', 'alignRight', 'alignJustify'] },
  { type: 'group', items: ['bulletList', 'numberList', 'outdent', 'indent'] },
  { type: 'group', items: ['blockquote', 'code', 'link', 'image', 'semantic'] },
  { type: 'group', items: ['undo', 'redo', 'removeFormat'] },
];

// Alignment buttons are not execCommand entries — they map to setAlign(value)
// and light up to show the current block's alignment.
const ALIGN = { alignLeft: 'left', alignCenter: 'center', alignRight: 'right', alignJustify: 'justify' };

// Four bars of the given widths (of 12), ragged per `align`.
function alignSvg(widths, align) {
  const rows = widths.map((w, i) => {
    const x = align === 'center' ? (12 - w) / 2 : align === 'end' ? 12 - w : 0;
    return `<rect x="${x + 1}" y="${i * 3 + 2}" width="${w}" height="1.6" rx="0.8"/>`;
  }).join('');
  return `<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false" fill="currentColor">${rows}</svg>`;
}

const ICONS = {
  bold: { glyph: 'B', cls: 'icon' },
  italic: { glyph: 'I', cls: 'icon italic' },
  underline: { glyph: 'U', cls: 'icon underline' },
  strike: { glyph: 'S', cls: 'icon strike' },
  // Alignment gets drawn, not glyphed: ≡ and ☰ are read as "menu" by
  // everyone (users kept tapping align-centre expecting a menu), and no
  // Unicode character conveys ragged-edge alignment. Short/long bars do.
  alignLeft: { svg: alignSvg([10, 6, 10, 6], 'start'), label: 'Align left' },
  alignCenter: { svg: alignSvg([10, 6, 10, 6], 'center'), label: 'Align centre' },
  alignRight: { svg: alignSvg([10, 6, 10, 6], 'end'), label: 'Align right' },
  alignJustify: { svg: alignSvg([10, 10, 10, 10], 'start'), label: 'Justify' },
  bulletList: { glyph: '•—' },
  numberList: { glyph: '1.' },
  outdent: { glyph: '⇤' },
  indent: { glyph: '⇥' },
  blockquote: { glyph: '❝' },
  code: { glyph: '</>' },
  link: { glyph: '🔗', label: 'Insert link' },
  image: { glyph: '🖼', label: 'Insert image' },
  semantic: { glyph: '🏷️', label: 'Tag with RDFa property' },
  undo: { glyph: '↶' },
  redo: { glyph: '↷' },
  removeFormat: { glyph: '⌫×' },
};

let toolbarSeq = 0;

export class Toolbar {
  constructor(root, editor, announce) {
    this.root = root;
    this.editor = editor;
    this.announce = announce;
    this._uid = ++toolbarSeq; // unique per instance, for collision-free control ids
    this.controls = [];        // focusable elements, in DOM order
    this.stateButtons = [];    // [{el, cmd}]
    // The editor element needs a stable id so aria-controls points at THIS
    // editor (not a global "editor") when several instances coexist.
    if (this.editor.el && !this.editor.el.id) this.editor.el.id = `edot-editor-${this._uid}`;
    this._build();
    this._wireRovingFocus();
  }

  _build() {
    this.root.setAttribute('role', 'toolbar');
    this.root.setAttribute('aria-label', 'Text formatting');
    this.root.setAttribute('aria-controls', this.editor.el && this.editor.el.id ? this.editor.el.id : 'editor');

    for (const section of LAYOUT) {
      if (section.type === 'block-select') {
        this.root.appendChild(this._blockSelect());
        continue;
      }
      const group = document.createElement('div');
      group.className = 'group';
      group.setAttribute('role', 'group');
      for (const id of section.items) group.appendChild(this._button(id));
      this.root.appendChild(group);
    }
    this.root.appendChild(this._labelsToggle());
    // first control is the only initial tab stop
    this.controls.forEach((el, i) => el.setAttribute('tabindex', i === 0 ? '0' : '-1'));
  }

  _blockSelect() {
    const wrap = document.createElement('div');
    wrap.className = 'group';
    const label = document.createElement('label');
    label.className = 'visually-hidden';
    const selId = `block-format-${this._uid}`;
    label.setAttribute('for', selId);
    label.textContent = 'Paragraph style';
    const sel = document.createElement('select');
    sel.id = selId;
    sel.className = 'tbtn';
    for (const f of BLOCK_FORMATS) {
      const opt = document.createElement('option');
      opt.value = f.value; opt.textContent = f.label;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      setBlockFormat(sel.value);
      this.editor.focus();
      this.announce(`${sel.options[sel.selectedIndex].text} applied`);
      this.editor.onChange();
    });
    this.blockSelect = sel;
    this.controls.push(sel);
    wrap.append(label, sel);
    return wrap;
  }

  _button(id) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const icon = ICONS[id] || { glyph: id };
    const cmd = COMMANDS[id];
    const label = (cmd && cmd.label) || icon.label || id;
    const tip = label + (cmd && cmd.key ? ` · ${shortcutText(cmd)}` : '');

    btn.className = 'tbtn' + (icon.cls ? ` ${icon.cls}` : '');
    const g = document.createElement('span'); g.className = 'tglyph';
    // icon.svg is a module constant (never user content)
    if (icon.svg) g.innerHTML = icon.svg; else g.textContent = icon.glyph;
    const l = document.createElement('span'); l.className = 'tlabel'; l.textContent = label;
    btn.append(g, l);
    btn.setAttribute('aria-label', tip);
    btn.title = tip;
    btn.dataset.cmd = id;

    if (cmd && cmd.state) {
      btn.setAttribute('aria-pressed', 'false');
      this.stateButtons.push({ el: btn, cmd });
    }
    if (id in ALIGN) {
      btn.setAttribute('aria-pressed', 'false');
      this.alignButtons = this.alignButtons || [];
      this.alignButtons.push({ el: btn, value: ALIGN[id] });
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (consumedPeek(btn)) return; // a long-press peeked the label; don't act
      if (id === 'link') { createLink(this.announce); }
      else if (id === 'image') { (this.editor.el || this.editor).dispatchEvent(new CustomEvent('edot-pick-image', { bubbles: true })); return; }
      else if (id === 'semantic') { createSemantic(this.announce); }
      else if (id in ALIGN) { setAlign(ALIGN[id]); }
      else if (cmd) { cmd.exec(); }
      this.editor.focus();
      this.editor.onChange();
      this.refresh();
    });
    // Keep selection while pressing toolbar (don't steal focus on mousedown).
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    holdLabel(btn, tip);

    this.controls.push(btn);
    return btn;
  }

  _labelsOn() { try { return localStorage.getItem('edot.toolbarLabels') === '1'; } catch { return false; } }

  // A toggle that "grows" the toolbar into a larger, text-labelled layout —
  // for anyone who finds the icons hard to read. Persisted.
  _labelsToggle() {
    const wrap = document.createElement('div'); wrap.className = 'group';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'tbtn labels-toggle';
    const g = document.createElement('span'); g.className = 'tglyph'; g.textContent = 'Aa';
    const l = document.createElement('span'); l.className = 'tlabel'; l.textContent = 'Labels';
    btn.append(g, l);
    btn.setAttribute('aria-label', 'Show button labels');
    btn.title = 'Show button labels';
    const apply = (on) => {
      this.root.classList.toggle('labels', on);
      btn.setAttribute('aria-pressed', String(on));
      try { localStorage.setItem('edot.toolbarLabels', on ? '1' : '0'); } catch { /* */ }
    };
    apply(this._labelsOn());
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (consumedPeek(btn)) return;
      apply(!this.root.classList.contains('labels'));
      this.editor.focus();
    });
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    holdLabel(btn, 'Show button labels — bigger, with text');
    this.controls.push(btn);
    wrap.appendChild(btn);
    return wrap;
  }

  destroy() {}

  _wireRovingFocus() {
    this.root.addEventListener('keydown', (e) => {
      const idx = this.controls.indexOf(document.activeElement);
      if (idx < 0) return;
      let next = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % this.controls.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + this.controls.length) % this.controls.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = this.controls.length - 1;
      if (next < 0) return;
      // A <select> uses Up/Down to change value — don't hijack those.
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && document.activeElement.tagName === 'SELECT') return;
      e.preventDefault();
      this.controls[idx].setAttribute('tabindex', '-1');
      this.controls[next].setAttribute('tabindex', '0');
      this.controls[next].focus();
    });
  }

  // Sync pressed-state and block selector to the current selection.
  refresh() {
    for (const { el, cmd } of this.stateButtons) {
      el.setAttribute('aria-pressed', cmd.state() ? 'true' : 'false');
    }
    if (this.alignButtons) {
      const a = currentAlign();
      for (const { el, value } of this.alignButtons) {
        el.setAttribute('aria-pressed', value === a ? 'true' : 'false');
      }
    }
    if (this.blockSelect) this.blockSelect.value = currentBlockFormat();
  }
}

function shortcutText(cmd) {
  const mod = navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl';
  return `${mod}${cmd.shift ? '+Shift' : ''}+${cmd.key.toUpperCase()}`;
}
