// commands.js — the editing command registry.
//
// Formatting is isolated here behind a small command interface so the rest
// of the app never touches the contenteditable mutation primitives directly.
// We use document.execCommand for the live formatting: it is deprecated but
// remains the only cross-browser API that mutates a contenteditable subtree
// *with native undo integration*. Confining it to this one module means a
// future Selection/Range-based replacement is a single-file swap.

export const COMMANDS = {
  bold: { exec: () => doExec('bold'), state: () => queryState('bold'), key: 'b', label: 'Bold' },
  italic: { exec: () => doExec('italic'), state: () => queryState('italic'), key: 'i', label: 'Italic' },
  underline: { exec: () => doExec('underline'), state: () => queryState('underline'), key: 'u', label: 'Underline' },
  strike: { exec: () => doExec('strikeThrough'), state: () => queryState('strikeThrough'), label: 'Strikethrough' },

  bulletList: { exec: () => doExec('insertUnorderedList'), state: () => queryState('insertUnorderedList'), label: 'Bulleted list' },
  numberList: { exec: () => doExec('insertOrderedList'), state: () => queryState('insertOrderedList'), label: 'Numbered list' },

  blockquote: { exec: () => formatBlock('blockquote'), state: () => isBlock('blockquote'), label: 'Block quote' },
  code: { exec: () => formatBlock('pre'), state: () => isBlock('pre'), label: 'Code block' },

  outdent: { exec: () => doExec('outdent'), label: 'Decrease indent' },
  indent: { exec: () => doExec('indent'), label: 'Increase indent' },

  undo: { exec: () => doExec('undo'), key: 'z', label: 'Undo' },
  redo: { exec: () => doExec('redo'), key: 'y', shift: true, label: 'Redo' },

  removeFormat: { exec: () => { doExec('removeFormat'); formatBlock('p'); }, label: 'Clear formatting' },
};

// Heading / paragraph block selector.
export const BLOCK_FORMATS = [
  { value: 'p', label: 'Body text' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
];

export function setBlockFormat(tag) {
  formatBlock(tag);
}

export function currentBlockFormat() {
  for (const f of BLOCK_FORMATS) {
    if (f.value !== 'p' && isBlock(f.value)) return f.value;
  }
  return 'p';
}

// ---- Paragraph alignment ----
// Applied directly to the block elements that intersect the selection, so the
// output is a sanitizer-clean `style="text-align:…"` (not a CSS span that
// would be stripped). Threads through HTML, DOCX (w:jc) and PDF export.
const ALIGN_BLOCK = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre';

function selectedBlocks() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return [];
  // Target the editor that actually holds the selection — NOT the first
  // contenteditable on the page — so alignment works with multiple
  // <edot-editor> instances (the first-match would silently no-op the others).
  const anchor = sel.getRangeAt(0).startContainer;
  const anchorEl = anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement;
  const root = anchorEl && anchorEl.closest('[contenteditable="true"]');
  if (!root) return [];
  const range = sel.getRangeAt(0);
  const blocks = new Set();
  const add = (n) => {
    const el = (n.nodeType === Node.ELEMENT_NODE ? n : n.parentElement);
    const b = el && el.closest(ALIGN_BLOCK);
    if (b && root.contains(b)) blocks.add(b);
  };
  add(range.startContainer);
  add(range.endContainer);
  // Any blocks fully within the range too.
  root.querySelectorAll(ALIGN_BLOCK).forEach((b) => {
    if (range.intersectsNode(b)) blocks.add(b);
  });
  return [...blocks];
}

export function setAlign(value) {
  const blocks = selectedBlocks();
  for (const b of blocks) {
    if (value === 'left') b.style.removeProperty('text-align'); // left = default
    else b.style.textAlign = value;
    if (!b.getAttribute('style')) b.removeAttribute('style');
  }
}

export function currentAlign() {
  const b = selectedBlocks()[0];
  if (!b) return 'left';
  const a = (b.style.textAlign || '').toLowerCase();
  return ['center', 'right', 'justify'].includes(a) ? a : 'left';
}

// Wrap the current selection in a semantic <span property="..."> (RDFa).
// Distinguishes edot from plain word processors: the document carries
// machine-readable meaning that survives HTML export.
export function createSemantic(announce) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
    announce && announce('Select text first, then tag it', { error: true });
    return;
  }
  const prop = window.prompt('Semantic property (e.g. schema:name, foaf:nick, dc:date):', 'schema:name');
  if (!prop) return;
  const typeName = window.prompt('Optional type for this value (typeof, e.g. schema:Person) — leave blank for none:', '');
  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  span.setAttribute('property', prop.trim());
  if (typeName && typeName.trim()) span.setAttribute('typeof', typeName.trim());
  try {
    range.surroundContents(span);
  } catch (_) {
    // Selection crossed element boundaries: fall back to extract+wrap.
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
  }
  sel.removeAllRanges();
  announce && announce(`Tagged as ${prop.trim()}`);
}

export function createLink(announce) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) {
    announce && announce('Select text first, then add a link', { error: true });
    return;
  }
  const url = window.prompt('Link URL:', 'https://');
  if (url == null || url === '') return;
  doExec('createLink', url);
  // Harden the freshly created anchor(s).
  const anchor = sel.anchorNode && (sel.anchorNode.parentElement?.closest('a'));
  if (anchor && /^https?:/i.test(url)) {
    anchor.setAttribute('rel', 'noopener noreferrer');
    anchor.setAttribute('target', '_blank');
  }
}

// ---- low-level helpers ----
function doExec(cmd, value = null) {
  try { document.execCommand(cmd, false, value); } catch (_) { /* unsupported */ }
}

function queryState(cmd) {
  try { return document.queryCommandState(cmd); } catch (_) { return false; }
}

function formatBlock(tag) {
  // Toggle: if already that block, revert to paragraph.
  if (isBlock(tag)) { doExec('formatBlock', 'p'); return; }
  doExec('formatBlock', tag);
}

function isBlock(tag) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  let node = sel.getRangeAt(0).startContainer;
  node = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  const block = node && node.closest(tag);
  // Ensure the matched block is inside the editor, not the chrome.
  return !!(block && block.closest('[contenteditable="true"]'));
}
