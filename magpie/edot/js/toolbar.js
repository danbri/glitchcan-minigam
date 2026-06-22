// toolbar.js — the accessible formatting toolbar.
//
// Implements the WAI-ARIA toolbar pattern: role="toolbar", a single tab stop
// (roving tabindex), arrow-key navigation between controls, Home/End jumps.
// Toggle buttons expose aria-pressed reflecting live command state.

import { COMMANDS, BLOCK_FORMATS, setBlockFormat, currentBlockFormat, createLink } from './commands.js';

const LAYOUT = [
  { type: 'block-select' },
  { type: 'group', items: ['bold', 'italic', 'underline', 'strike'] },
  { type: 'group', items: ['bulletList', 'numberList', 'outdent', 'indent'] },
  { type: 'group', items: ['blockquote', 'code', 'link'] },
  { type: 'group', items: ['undo', 'redo', 'removeFormat'] },
];

const ICONS = {
  bold: { glyph: 'B', cls: 'icon' },
  italic: { glyph: 'I', cls: 'icon italic' },
  underline: { glyph: 'U', cls: 'icon underline' },
  strike: { glyph: 'S', cls: 'icon strike' },
  bulletList: { glyph: '•—' },
  numberList: { glyph: '1.' },
  outdent: { glyph: '⇤' },
  indent: { glyph: '⇥' },
  blockquote: { glyph: '❝' },
  code: { glyph: '</>' },
  link: { glyph: '🔗', label: 'Insert link' },
  undo: { glyph: '↶' },
  redo: { glyph: '↷' },
  removeFormat: { glyph: '⌫×' },
};

export class Toolbar {
  constructor(root, editor, announce) {
    this.root = root;
    this.editor = editor;
    this.announce = announce;
    this.controls = [];        // focusable elements, in DOM order
    this.stateButtons = [];    // [{el, cmd}]
    this._build();
    this._wireRovingFocus();
  }

  _build() {
    this.root.setAttribute('role', 'toolbar');
    this.root.setAttribute('aria-label', 'Text formatting');
    this.root.setAttribute('aria-controls', 'editor');

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
    // first control is the only initial tab stop
    this.controls.forEach((el, i) => el.setAttribute('tabindex', i === 0 ? '0' : '-1'));
  }

  _blockSelect() {
    const wrap = document.createElement('div');
    wrap.className = 'group';
    const label = document.createElement('label');
    label.className = 'visually-hidden';
    label.setAttribute('for', 'block-format');
    label.textContent = 'Paragraph style';
    const sel = document.createElement('select');
    sel.id = 'block-format';
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

    btn.className = 'tbtn' + (icon.cls ? ` ${icon.cls}` : '');
    btn.textContent = icon.glyph;
    btn.setAttribute('aria-label', label + (cmd && cmd.key ? ` (${shortcutText(cmd)})` : ''));
    btn.title = btn.getAttribute('aria-label');
    btn.dataset.cmd = id;

    if (cmd && cmd.state) {
      btn.setAttribute('aria-pressed', 'false');
      this.stateButtons.push({ el: btn, cmd });
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (id === 'link') { createLink(this.announce); }
      else if (cmd) { cmd.exec(); }
      this.editor.focus();
      this.editor.onChange();
      this.refresh();
    });
    // Keep selection while pressing toolbar (don't steal focus on mousedown).
    btn.addEventListener('mousedown', (e) => e.preventDefault());

    this.controls.push(btn);
    return btn;
  }

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
    if (this.blockSelect) this.blockSelect.value = currentBlockFormat();
  }
}

function shortcutText(cmd) {
  const mod = navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl';
  return `${mod}${cmd.shift ? '+Shift' : ''}+${cmd.key.toUpperCase()}`;
}
