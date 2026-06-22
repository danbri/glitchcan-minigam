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
