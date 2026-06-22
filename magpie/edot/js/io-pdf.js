// io-pdf.js — real, offline PDF export. No backend, no library.
//
// Generates a valid PDF 1.4 document from the editor's HTML: A4 pages, the
// 14 standard PDF fonts (Times / Helvetica / Courier families, so no font
// embedding is required), proper word-wrapped text flow with inline bold /
// italic / links, headings, lists, block quotes, code, rules, and automatic
// page breaks.
//
// Text is measured with an offscreen <canvas> using the CSS equivalents of
// the base-14 fonts — accurate enough for line breaking without shipping AFM
// width tables. Latin-1 / WinAnsi text is supported; characters outside it
// fall back to '?' (noted in the README limits).

const PT = 1;
const PAGE_W = 595.28;   // A4 in points
const PAGE_H = 841.89;
const MARGIN = 64;
const CONTENT_W = PAGE_W - MARGIN * 2;

// PDF base-14 font name  ->  { resource name, CSS family for measuring }
const FONTS = {
  'Times-Roman':       { css: '"Times New Roman", Times, serif',  weight: '',     style: '' },
  'Times-Bold':        { css: '"Times New Roman", Times, serif',  weight: 'bold', style: '' },
  'Times-Italic':      { css: '"Times New Roman", Times, serif',  weight: '',     style: 'italic' },
  'Times-BoldItalic':  { css: '"Times New Roman", Times, serif',  weight: 'bold', style: 'italic' },
  'Helvetica':         { css: 'Arial, Helvetica, sans-serif',     weight: '',     style: '' },
  'Helvetica-Bold':    { css: 'Arial, Helvetica, sans-serif',     weight: 'bold', style: '' },
  'Courier':           { css: 'monospace',                        weight: '',     style: '' },
  'Courier-Bold':      { css: 'monospace',                        weight: 'bold', style: '' },
};

function pickFont({ mono, bold, italic } = {}) {
  if (mono) return bold ? 'Courier-Bold' : 'Courier';
  if (bold && italic) return 'Times-BoldItalic';
  if (bold) return 'Times-Bold';
  if (italic) return 'Times-Italic';
  return 'Times-Roman';
}

// ---- text measurement ----
let _ctx = null;
function measure(text, fontName, size) {
  if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
  const f = FONTS[fontName];
  _ctx.font = `${f.style} ${f.weight} ${size}px ${f.css}`.trim();
  return _ctx.measureText(text).width;
}

// ---- gather styled runs from a block element ----
function runsOf(node, base = {}) {
  const out = [];
  node.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      if (n.textContent) out.push({ text: n.textContent, ...base });
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const s = { ...base };
    switch (n.tagName) {
      case 'STRONG': case 'B': s.bold = true; break;
      case 'EM': case 'I': s.italic = true; break;
      case 'CODE': s.mono = true; break;
      case 'U': s.underline = true; break;
      case 'A': s.link = true; s.underline = true; break;
      case 'BR': out.push({ text: '\n', ...base }); return;
    }
    out.push(...runsOf(n, s));
  });
  return out;
}

// Tokenise runs into words + whitespace, preserving style + hard breaks.
function tokenize(runs, size) {
  const toks = [];
  for (const r of runs) {
    const font = pickFont(r);
    const parts = r.text.split(/(\s+)/);
    for (const p of parts) {
      if (p === '') continue;
      if (p === '\n') { toks.push({ br: true }); continue; }
      toks.push({
        text: p,
        ws: /^\s+$/.test(p),
        font, size,
        color: r.link ? [0.1, 0.33, 0.83] : [0, 0, 0],
        underline: !!r.underline,
        w: measure(p, font, size),
      });
    }
  }
  return toks;
}

// Greedy line breaking. Returns [{ segs:[{text,font,size,color,underline,x}], }]
function wrap(toks, maxWidth) {
  const lines = [];
  let line = [];
  let x = 0;
  const push = () => {
    // trim trailing whitespace token
    while (line.length && line[line.length - 1].ws) { x -= line[line.length - 1].w; line.pop(); }
    lines.push(line);
    line = []; x = 0;
  };
  for (const t of toks) {
    if (t.br) { push(); continue; }
    if (t.ws && x === 0) continue; // drop leading space
    if (!t.ws && x + t.w > maxWidth && x > 0) push();
    line.push({ ...t, x });
    x += t.w;
  }
  if (line.length) push();
  return lines;
}

// ---- block plan ----
function blockStyle(el) {
  const tag = el.tagName;
  if (/^H1$/.test(tag)) return { font: 'Helvetica-Bold', size: 22, before: 14, after: 8, leading: 27 };
  if (/^H2$/.test(tag)) return { font: 'Helvetica-Bold', size: 17, before: 12, after: 6, leading: 22 };
  if (/^H3$/.test(tag)) return { font: 'Helvetica-Bold', size: 14, before: 10, after: 5, leading: 18 };
  if (tag === 'PRE') return { size: 10.5, mono: true, before: 6, after: 6, leading: 14, indent: 16, box: true };
  if (tag === 'BLOCKQUOTE') return { size: 12, italic: true, before: 6, after: 6, leading: 17, indent: 24, bar: true };
  if (tag === 'LI') return { size: 12, before: 1, after: 1, leading: 16, indent: 22, marker: true };
  return { size: 12, before: 0, after: 8, leading: 16 }; // P / default
}

// ---- content stream builder ----
class Stream {
  constructor() { this.ops = []; this.fontsUsed = new Set(); }
  text(seg, x, y) {
    this.fontsUsed.add(seg.font);
    const [r, g, b] = seg.color || [0, 0, 0];
    this.ops.push(`${r} ${g} ${b} rg`);
    this.ops.push(`BT /${seg.font} ${seg.size} Tf ${fmt(x)} ${fmt(y)} Td (${escPdf(seg.text)}) Tj ET`);
    if (seg.underline) this.rect(x, y - 1.5, seg.w, 0.6, seg.color);
  }
  rect(x, y, w, h, color = [0, 0, 0]) {
    const [r, g, b] = color;
    this.ops.push(`${r} ${g} ${b} rg ${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)} re f`);
  }
  line(x1, y1, x2, y2, color = [0.6, 0.6, 0.6], width = 0.8) {
    const [r, g, b] = color;
    this.ops.push(`${r} ${g} ${b} RG ${width} w ${fmt(x1)} ${fmt(y1)} m ${fmt(x2)} ${fmt(y2)} l S`);
  }
  toString() { return this.ops.join('\n'); }
}

function fmt(n) { return (Math.round(n * 100) / 100).toString(); }

function escPdf(s) {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else if (code < 32) out += ' ';
    else if (code < 256) out += ch;       // Latin-1 ~ WinAnsi
    else out += '?';                       // outside WinAnsi
  }
  return out;
}

// ---- main ----
export function htmlToPdf(bodyHtml, title = 'Document') {
  const doc = new DOMParser().parseFromString(bodyHtml, 'text/html');

  // Flatten top-level blocks; lists expand to their <li> children + marker.
  const blocks = [];
  Array.from(doc.body.children).forEach((el) => {
    if (el.tagName === 'UL' || el.tagName === 'OL') {
      const ordered = el.tagName === 'OL';
      Array.from(el.children).forEach((li, i) => blocks.push({ el: li, marker: ordered ? `${i + 1}.` : '•' }));
    } else if (el.tagName === 'BLOCKQUOTE') {
      const inner = el.children.length ? Array.from(el.children) : [el];
      inner.forEach((c) => blocks.push({ el: c, quote: true }));
    } else {
      blocks.push({ el });
    }
  });

  const pages = [];     // each = Stream
  let stream = new Stream();
  let y = PAGE_H - MARGIN;

  const newPage = () => { pages.push(stream); stream = new Stream(); y = PAGE_H - MARGIN; };
  const ensure = (need) => { if (y - need < MARGIN) newPage(); };

  for (const b of blocks) {
    const st = blockStyle(b.el);
    const indent = (st.indent || 0) + (b.quote ? 24 : 0);
    y -= st.before;

    if (b.el.tagName === 'HR') {
      ensure(12); stream.line(MARGIN, y - 4, PAGE_W - MARGIN, y - 4); y -= 12; continue;
    }

    const baseStyle = { bold: false, italic: st.italic, mono: st.mono };
    const runs = runsOf(b.el, baseStyle);
    if (st.mono) {
      // Preserve code line breaks: split on newlines, no soft-wrap reflow.
      const text = b.el.textContent || '';
      const lines = text.replace(/\n$/, '').split('\n');
      const segs = lines.map((t) => [{ text: t, font: pickFont({ mono: true }), size: st.size, color: [0.1, 0.1, 0.1], underline: false, w: 0, x: 0 }]);
      drawLines(segs, st, indent, b);
    } else {
      const toks = tokenize(runs, st.size);
      const lines = wrap(toks, CONTENT_W - indent);
      drawLines(lines.length ? lines : [[]], st, indent, b);
    }
    y -= st.after;
  }

  function drawLines(lines, st, indent, b) {
    const align = (b.el && b.el.style && b.el.style.textAlign || '').toLowerCase();
    const avail = CONTENT_W - indent;
    lines.forEach((segs, li) => {
      ensure(st.leading);
      const baseline = y - st.size * 0.8;
      const x0 = MARGIN + indent;
      if (li === 0 && b.marker) {
        stream.text({ text: b.marker, font: 'Times-Roman', size: st.size, color: [0, 0, 0], underline: false, w: 0 }, MARGIN + indent - 16, baseline);
      }
      if (st.bar) stream.rect(MARGIN + 6, baseline - 2, 2.5, st.size, [0.55, 0.27, 0.07]);

      // Compute the rendered line width to support alignment.
      const last = segs[segs.length - 1];
      const lineW = last ? (last.x || 0) + (last.w || measure(last.text, last.font, last.size)) : 0;
      let shift = 0;
      if (align === 'center') shift = Math.max(0, (avail - lineW) / 2);
      else if (align === 'right') shift = Math.max(0, avail - lineW);

      const isLast = li === lines.length - 1;
      if (align === 'justify' && !isLast && segs.length > 1) {
        // Stretch inter-word gaps to fill the line.
        const gaps = segs.filter((s) => s.ws).length;
        const extra = gaps > 0 ? Math.max(0, avail - lineW) / gaps : 0;
        let add = 0;
        for (const s of segs) {
          stream.text(s, x0 + (s.x || 0) + add, baseline);
          if (s.ws) add += extra;
        }
      } else {
        for (const s of segs) stream.text(s, x0 + shift + (s.x || 0), baseline);
      }
      y -= st.leading;
    });
  }

  newPage(); // flush last
  return assemble(pages, title);
}

// ---- PDF object assembly ----
function assemble(pages, title) {
  const fontNames = Object.keys(FONTS);
  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; }; // returns obj number

  // Reserve: 1 = Catalog, 2 = Pages. Fonts next, then per-page (Page + Contents).
  const catalogNo = 1, pagesNo = 2;
  objects.push(null, null); // placeholders

  const fontObjNo = {};
  for (const fn of fontNames) {
    fontObjNo[fn] = add(`<< /Type /Font /Subtype /Type1 /BaseFont /${fn} /Encoding /WinAnsiEncoding >>`);
  }

  const fontRes = fontNames.map((fn, i) => `/${fn} ${fontObjNo[fn]} 0 R`).join(' ');
  const kids = [];
  for (const page of pages) {
    const content = page.toString();
    const contentNo = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageNo = add(
      `<< /Type /Page /Parent ${pagesNo} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << ${fontRes} >> >> /Contents ${contentNo} 0 R >>`);
    kids.push(`${pageNo} 0 R`);
  }

  objects[catalogNo - 1] = `<< /Type /Catalog /Pages ${pagesNo} 0 R >>`;
  objects[pagesNo - 1] = `<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(' ')}] >>`;

  const infoNo = add(`<< /Title (${escPdf(title)}) /Producer (edot) /Creator (edot) >>`);

  // Serialise with xref.
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets[i] = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 0; i < objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNo} 0 R /Info ${infoNo} 0 R >>\n`;
  pdf += `startxref\n${xrefPos}\n%%EOF`;

  // Latin-1 bytes -> Uint8Array.
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: 'application/pdf' });
}
