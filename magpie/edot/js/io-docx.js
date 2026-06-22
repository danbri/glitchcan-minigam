// io-docx.js — native (no-WASM) DOCX read/write via the ZIP layer.
//
// This is the always-available baseline: it covers the structural core of
// Office Open XML — paragraphs, Heading 1–3, bold/italic/underline/strike
// runs, ordered/unordered lists, blockquotes, code, and hyperlinks.
//
// For *full-fidelity* conversion (tables, images, complex styles, .doc,
// .odt, RTF, PDF export) the LibreOffice WASM bridge takes over — see
// libreoffice-bridge.js. This module is what runs when that backend is not
// configured, and is the format the editor's own files round-trip through.

import { zipSync, unzip, utf8 } from './zip.js';
import { sanitizeHtml } from './document-model.js';

const XMLNS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function xmlEscape(s) {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

// ---------- EXPORT: document HTML -> .docx Blob ----------

function runXml(text, marks) {
  const rPr = [];
  if (marks.b) rPr.push('<w:b/>');
  if (marks.i) rPr.push('<w:i/>');
  if (marks.u) rPr.push('<w:u w:val="single"/>');
  if (marks.s) rPr.push('<w:strike/>');
  if (marks.code) rPr.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');
  const rPrXml = rPr.length ? `<w:rPr>${rPr.join('')}</w:rPr>` : '';
  // xml:space="preserve" keeps leading/trailing spaces between runs.
  return `<w:r>${rPrXml}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

// Walk inline content of a block, emitting runs (and hyperlinks).
function inlineRuns(node, marks, rels) {
  let xml = '';
  node.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      if (n.textContent) xml += runXml(n.textContent, marks);
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const m = { ...marks };
    switch (n.tagName) {
      case 'STRONG': case 'B': m.b = true; break;
      case 'EM': case 'I': m.i = true; break;
      case 'U': m.u = true; break;
      case 'S': case 'STRIKE': m.s = true; break;
      case 'CODE': m.code = true; break;
      case 'BR': xml += '<w:r><w:br/></w:r>'; return;
      case 'A': {
        const href = n.getAttribute('href') || '';
        const rid = rels.add(href);
        m.u = true;
        xml += `<w:hyperlink r:id="${rid}">${inlineRuns(n, m, rels)}</w:hyperlink>`;
        return;
      }
    }
    xml += inlineRuns(n, m, rels);
  });
  return xml;
}

// Map CSS text-align -> OOXML w:jc value.
function jcOf(el) {
  const a = (el && el.style && el.style.textAlign || '').toLowerCase();
  if (a === 'center') return 'center';
  if (a === 'right') return 'right';
  if (a === 'justify') return 'both';
  return '';
}

function paraXml(inner, { style, list, indent, align } = {}) {
  const pPr = [];
  if (style) pPr.push(`<w:pStyle w:val="${style}"/>`);
  if (list) pPr.push(`<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${list === 'ol' ? 2 : 1}"/></w:numPr>`);
  if (indent) pPr.push(`<w:ind w:left="720"/>`);
  if (align) pPr.push(`<w:jc w:val="${align}"/>`);
  const pPrXml = pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : '';
  return `<w:p>${pPrXml}${inner}</w:p>`;
}

function blockToXml(el, rels, ctx = {}) {
  const tag = el.tagName;
  const align = jcOf(el);
  if (/^H([1-6])$/.test(tag)) {
    const lvl = Math.min(3, +tag[1]);
    return paraXml(inlineRuns(el, {}, rels), { style: `Heading${lvl}`, align });
  }
  if (tag === 'P') return paraXml(inlineRuns(el, {}, rels), { ...ctx, align });
  if (tag === 'BLOCKQUOTE') {
    return Array.from(el.children).length
      ? Array.from(el.children).map((c) => blockToXml(c, rels, { indent: true })).join('')
      : paraXml(inlineRuns(el, {}, rels), { indent: true, align });
  }
  if (tag === 'PRE') {
    return paraXml(runXml(el.textContent || '', { code: true }), { style: 'Code', align });
  }
  if (tag === 'UL' || tag === 'OL') {
    const kind = tag === 'OL' ? 'ol' : 'ul';
    return Array.from(el.children)
      .map((li) => paraXml(inlineRuns(li, {}, rels), { list: kind, align: jcOf(li) }))
      .join('');
  }
  if (tag === 'HR') return paraXml('', {});
  // Fallback: treat as paragraph.
  return paraXml(inlineRuns(el, {}, rels), { align });
}

function makeRels() {
  const map = new Map();
  let n = 1;
  return {
    add(href) {
      if (map.has(href)) return map.get(href);
      const id = `rId${100 + n++}`;
      map.set(href, id);
      return id;
    },
    xml() {
      let rels = '';
      for (const [href, id] of map) {
        rels += `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(href)}" TargetMode="External"/>`;
      }
      return rels;
    },
  };
}

export async function htmlToDocx(bodyHtml, title = 'Document') {
  const doc = new DOMParser().parseFromString(sanitizeHtml(bodyHtml), 'text/html');
  const rels = makeRels();
  const body = Array.from(doc.body.children).map((el) => blockToXml(el, rels)).join('') ||
    paraXml('');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${XMLNS}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;

  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/document.xml': documentXml,
    'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${rels.xml()}</Relationships>`,
    'word/styles.xml': STYLES_XML,
    'word/numbering.xml': NUMBERING_XML,
  };
  return zipSync(files);
}

// ---------- IMPORT: .docx ArrayBuffer -> document HTML ----------

export async function docxToHtml(arrayBuffer) {
  const entries = await unzip(arrayBuffer);
  const docXml = entries['word/document.xml'];
  if (!docXml) throw new Error('Not a Word document (missing word/document.xml)');

  // Resolve hyperlink relationship ids -> targets.
  const relMap = {};
  if (entries['word/_rels/document.xml.rels']) {
    const relDoc = new DOMParser().parseFromString(utf8.decode(entries['word/_rels/document.xml.rels']), 'application/xml');
    relDoc.querySelectorAll('Relationship').forEach((r) => {
      relMap[r.getAttribute('Id')] = r.getAttribute('Target');
    });
  }

  const xml = new DOMParser().parseFromString(utf8.decode(docXml), 'application/xml');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const paras = xml.getElementsByTagNameNS(W, 'p');
  const out = [];
  let listBuffer = null; // { tag, items: [] }

  const flushList = () => {
    if (listBuffer) { out.push(`<${listBuffer.tag}>${listBuffer.items.join('')}</${listBuffer.tag}>`); listBuffer = null; }
  };

  const runHtml = (run) => {
    const rPr = run.getElementsByTagNameNS(W, 'rPr')[0];
    let text = '';
    Array.from(run.getElementsByTagNameNS(W, 't')).forEach((t) => { text += t.textContent; });
    if (run.getElementsByTagNameNS(W, 'br').length) text += ' BR ';
    let html = xmlEscapeText(text).replace(/ BR /g, '<br>');
    if (!rPr) return html;
    if (rPr.getElementsByTagNameNS(W, 'b').length) html = `<strong>${html}</strong>`;
    if (rPr.getElementsByTagNameNS(W, 'i').length) html = `<em>${html}</em>`;
    if (rPr.getElementsByTagNameNS(W, 'u').length) html = `<u>${html}</u>`;
    if (rPr.getElementsByTagNameNS(W, 'strike').length) html = `<s>${html}</s>`;
    return html;
  };

  const inlineHtml = (p) => {
    let html = '';
    Array.from(p.childNodes).forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.localName === 'r') html += runHtml(node);
      else if (node.localName === 'hyperlink') {
        const rid = node.getAttributeNS(R, 'id');
        const href = relMap[rid] || '#';
        let inner = '';
        Array.from(node.getElementsByTagNameNS(W, 'r')).forEach((r) => { inner += runHtml(r); });
        html += `<a href="${xmlEscapeText(href)}">${inner}</a>`;
      }
    });
    return html;
  };

  // OOXML w:jc value -> CSS text-align (left is the default; omit it).
  const alignAttr = (pPr) => {
    const jc = pPr && pPr.getElementsByTagNameNS(W, 'jc')[0];
    const v = jc ? jc.getAttributeNS(W, 'val') : '';
    const css = { center: 'center', right: 'right', both: 'justify', end: 'right' }[v];
    return css ? ` style="text-align: ${css}"` : '';
  };

  for (const p of paras) {
    const pPr = p.getElementsByTagNameNS(W, 'pPr')[0];
    const styleEl = pPr && pPr.getElementsByTagNameNS(W, 'pStyle')[0];
    const style = styleEl ? styleEl.getAttributeNS(W, 'val') : '';
    const numPr = pPr && pPr.getElementsByTagNameNS(W, 'numPr')[0];
    const al = alignAttr(pPr);
    const inner = inlineHtml(p);

    if (numPr) {
      const numIdEl = numPr.getElementsByTagNameNS(W, 'numId')[0];
      const numId = numIdEl ? numIdEl.getAttributeNS(W, 'val') : '1';
      const tag = numId === '2' ? 'ol' : 'ul';
      if (!listBuffer || listBuffer.tag !== tag) { flushList(); listBuffer = { tag, items: [] }; }
      listBuffer.items.push(`<li${al}>${inner || '<br>'}</li>`);
      continue;
    }
    flushList();

    const hMatch = /^Heading(\d)$/i.exec(style || '');
    const h = hMatch && Math.min(3, +hMatch[1]);
    if (hMatch) out.push(`<h${h}${al}>${inner || '<br>'}</h${h}>`);
    else if (/^Code$/i.test(style)) out.push(`<pre><code>${p.textContent ? xmlEscapeText(p.textContent) : ''}</code></pre>`);
    else out.push(`<p${al}>${inner || '<br>'}</p>`);
  }
  flushList();

  return sanitizeHtml(out.join('') || '<p><br></p>');
}

function xmlEscapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------- Static parts ----------

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="48"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/></w:rPr></w:style>
</w:styles>`;

const NUMBERING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="&#8226;"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="2"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
</w:numbering>`;
