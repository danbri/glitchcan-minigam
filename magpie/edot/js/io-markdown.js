// io-markdown.js — bidirectional Markdown <-> document HTML.
// Deliberately small (CommonMark subset: headings, emphasis, lists,
// blockquotes, code, links, hr). Block-level parsing line-by-line, then a
// single inline pass per block.

import { sanitizeHtml } from './document-model.js';

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(text) {
  let s = escapeHtml(text);
  // code spans first so their contents aren't re-processed
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  // Images before links (image syntax embeds the link form).
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img src="${src}" alt="${alt}">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_, t, href, title) => `<a href="${href}"${title ? ` title="${title}"` : ''}>${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
  s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  return s;
}

export function markdownToHtml(md) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  const flushList = (ordered, items) => {
    const tag = ordered ? 'ol' : 'ul';
    out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${tag}>`);
  };

  while (i < lines.length) {
    let line = lines[i];

    if (/^\s*$/.test(line)) { i++; continue; }

    // Fenced code block
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // closing fence
      out.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2].trim())}</h${h[1].length}>`); i++; continue; }

    // Horizontal rule
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    // Blockquote
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push(`<blockquote>${markdownToHtml(buf.join('\n'))}</blockquote>`);
      continue;
    }

    // Lists (consecutive list lines)
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ''));
        i++;
      }
      flushList(ordered, items);
      continue;
    }

    // Paragraph: gather until blank line
    const buf = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) &&
           !/^(#{1,6}\s|```|\s*>|\s*([-*+]|\d+\.)\s)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }

  return sanitizeHtml(out.join('\n'));
}

export function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const inlineMd = (node) => {
    let s = '';
    node.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) { s += n.textContent; return; }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const inner = inlineMd(n);
      switch (n.tagName) {
        case 'STRONG': case 'B': s += `**${inner}**`; break;
        case 'EM': case 'I': s += `*${inner}*`; break;
        case 'S': case 'STRIKE': s += `~~${inner}~~`; break;
        case 'CODE': s += `\`${inner}\``; break;
        case 'A': s += `[${inner}](${n.getAttribute('href') || ''})`; break;
        case 'IMG': s += `![${n.getAttribute('alt') || ''}](${n.getAttribute('src') || ''})`; break;
        case 'BR': s += '  \n'; break;
        default: s += inner;
      }
    });
    return s;
  };

  const blocks = [];
  doc.body.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent.trim();
      if (t) blocks.push(t);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName;
    if (/^H[1-6]$/.test(tag)) {
      blocks.push(`${'#'.repeat(+tag[1])} ${inlineMd(node)}`);
    } else if (tag === 'P') {
      blocks.push(inlineMd(node));
    } else if (tag === 'BLOCKQUOTE') {
      blocks.push(htmlToMarkdown(node.innerHTML).split('\n').map((l) => `> ${l}`).join('\n'));
    } else if (tag === 'PRE') {
      blocks.push('```\n' + (node.textContent || '') + '\n```');
    } else if (tag === 'UL' || tag === 'OL') {
      const ordered = tag === 'OL';
      const items = Array.from(node.children).map((li, idx) =>
        `${ordered ? `${idx + 1}.` : '-'} ${inlineMd(li)}`);
      blocks.push(items.join('\n'));
    } else if (tag === 'HR') {
      blocks.push('---');
    } else if (tag === 'TABLE') {
      blocks.push(tableToMarkdown(node, inlineMd));
    } else {
      const t = inlineMd(node).trim();
      if (t) blocks.push(t);
    }
  });

  return blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// GFM table. First row becomes the header; cell pipes/newlines are escaped.
function tableToMarkdown(table, inlineMd) {
  const rows = Array.from(table.rows);
  if (!rows.length) return '';
  const cell = (c) => inlineMd(c).replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
  const toLine = (tr) => `| ${Array.from(tr.cells).map(cell).join(' | ')} |`;
  const cols = rows[0].cells.length || 1;
  const sep = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`;
  return [toLine(rows[0]), sep, ...rows.slice(1).map(toLine)].join('\n');
}
