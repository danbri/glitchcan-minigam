// toolbar.js — the accessible formatting toolbar.
//
// Implements the WAI-ARIA toolbar pattern: role="toolbar", a single tab stop
// (roving tabindex), arrow-key navigation between controls, Home/End jumps.
// Toggle buttons expose aria-pressed reflecting live command state.

import { COMMANDS, BLOCK_FORMATS, setBlockFormat, currentBlockFormat, createLink, createSemantic, setAlign, currentAlign } from './commands.js';

const LAYOUT = [
  { type: 'block-select' },
  { type: 'group', items: ['bold', 'italic', 'underline', 'strike'] },
  { type: 'group', items: ['alignLeft', 'alignCenter', 'alignRight', 'alignJustify'] },
  { type: 'group', items: ['bulletList', 'numberList', 'outdent', 'indent'] },
  { type: 'group', items: ['blockquote', 'code', 'link', 'semantic'] },
  { type: 'group', items: ['undo', 'redo', 'removeFormat'] },
];

// Alignment buttons are not execCommand entries — they map to setAlign(value)
// and light up to show the current block's alignment.
const ALIGN = { alignLeft: 'left', alignCenter: 'center', alignRight: 'right', alignJustify: 'justify' };

const ICONS = {
  bold: { glyph: 'B', cls: 'icon' },
  italic: { glyph: 'I', cls: 'icon italic' },
  underline: { glyph: 'U', cls: 'icon underline' },
  strike: { glyph: 'S', cls: 'icon strike' },
  alignLeft: { glyph: '≡', label: 'Align left' },
  alignCenter: { glyph: '☰', label: 'Align centre' },
  alignRight: { glyph: '≣', label: 'Align right' },
  alignJustify: { glyph: '▤', label: 'Justify' },
  bulletList: { glyph: '•—' },
  numberList: { glyph: '1.' },
  outdent: { glyph: '⇤' },
  indent: { glyph: '⇥' },
  blockquote: { glyph: '❝' },
  code: { glyph: '</>' },
  link: { glyph: '🔗', label: 'Insert link' },
  semantic: { glyph: '🏷️', label: 'Tag with RDFa property' },
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
    this.root.appendChild(this._labelsToggle());
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
    const tip = label + (cmd && cmd.key ? ` · ${shortcutText(cmd)}` : '');

    btn.className = 'tbtn' + (icon.cls ? ` ${icon.cls}` : '');
    const g = document.createElement('span'); g.className = 'tglyph'; g.textContent = icon.glyph;
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
      if (btn._peek) { btn._peek = false; return; } // a long-press peeked the label; don't act
      if (id === 'link') { createLink(this.announce); }
      else if (id === 'semantic') { createSemantic(this.announce); }
      else if (id in ALIGN) { setAlign(ALIGN[id]); }
      else if (cmd) { cmd.exec(); }
      this.editor.focus();
      this.editor.onChange();
      this.refresh();
    });
    // Keep selection while pressing toolbar (don't steal focus on mousedown).
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    this._wireLongPress(btn, tip);

    this.controls.push(btn);
    return btn;
  }

  // Press-and-hold any control to reveal a big, readable label bubble (the icon
  // alone is hard to read). The hold suppresses the action so it's a safe peek.
  _wireLongPress(el, text) {
    let timer = null;
    const start = () => { el._peek = false; timer = setTimeout(() => { timer = null; el._peek = true; this._showTip(el, text); }, 420); };
    const cancel = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      this._hideTip();
      // Self-heal: if a peek didn't get consumed by a click, clear it next tick.
      if (el._peek) setTimeout(() => { el._peek = false; }, 0);
    };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
  }

  _showTip(el, text) {
    if (!this._tip) { this._tip = document.createElement('div'); this._tip.className = 'tbtip'; document.body.appendChild(this._tip); }
    this._tip.textContent = text;
    const r = el.getBoundingClientRect();
    this._tip.style.left = `${Math.round(r.left + r.width / 2)}px`;
    this._tip.style.top = `${Math.round(r.bottom + 8)}px`;
    this._tip.classList.add('show');
  }
  _hideTip() { if (this._tip) this._tip.classList.remove('show'); }

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
      if (btn._peek) { btn._peek = false; return; }
      apply(!this.root.classList.contains('labels'));
      this.editor.focus();
    });
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    this._wireLongPress(btn, 'Show button labels — bigger, with text');
    this.controls.push(btn);
    wrap.appendChild(btn);
    return wrap;
  }

  destroy() { if (this._tip) { this._tip.remove(); this._tip = null; } }

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
