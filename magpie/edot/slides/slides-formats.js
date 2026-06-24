// slides-formats.js — codecs that derive every export from the canonical deck
// "core" (slides-model.js) and parse foreign formats back into it.
//
// Reuses the repo's offline ZIP layer (../js/zip.js, native CompressionStream)
// for the ZIP-of-XML formats (PPTX, ODP) exactly as io-docx.js does for DOCX,
// and follows io-pdf.js's hand-rolled-PDF approach for the PDF export. No CDN,
// no WASM, no vendored deflate.
//
// FIDELITY IS BEST-EFFORT AND HONEST. See the matrix in README.md. In short:
//   • JSON .......... lossless (the core itself)
//   • PPTX export ... titles, bullet body text, images, notes. NOT exported:
//                     animations, transitions, charts, SmartArt, exact theme,
//                     freeform shape geometry beyond rect/ellipse/line.
//   • PPTX import ... title/body text runs (bold/italic), images, notes,
//                     bullet indent levels. Layout is inferred, not preserved.
//   • ODP import/export ... text + notes + simple shapes; theming approximate.
//   • PDF / HTML / PNG ... terminal renders (one page/slide), not re-importable.

import { zipSync, unzip, utf8 } from '../js/zip.js';
import {
  DECK_VERSION, normalizeDeck, newDeck, newSlide, themeOf, THEMES,
  runsText, bulletLines, slideTitle, uid,
} from './slides-model.js';

// 16:9 slide in EMUs (English Metric Units; 914400 EMU = 1 inch). 10in × 5.625in.
const EMU_W = 9144000;
const EMU_H = 5143500;

function xmlEscape(s) {
  return String(s == null ? '' : s).replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

// ============================================================================
// Native JSON — lossless
// ============================================================================

export function deckToJson(deck) {
  return JSON.stringify({ ...normalizeDeck(deck), version: DECK_VERSION }, null, 2);
}

export function jsonToDeck(text) {
  return normalizeDeck(JSON.parse(text));
}

// ============================================================================
// Image helpers (shared by PPTX/ODP/HTML)
// ============================================================================

function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Parse a data: URL into { mime, ext, bytes }. Returns null if not a data URL.
function parseDataUrl(dataUrl) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl || '');
  if (!m) return null;
  const mime = m[1] || 'image/png';
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' }[mime] || 'png';
  const bytes = m[2] ? base64ToBytes(m[3]) : utf8.encode(decodeURIComponent(m[3]));
  return { mime, ext, bytes };
}

function mimeForExt(ext) {
  return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }[(ext || '').toLowerCase()];
}

// ============================================================================
// PPTX export (Open XML PresentationML, minimal-but-valid)
// ============================================================================

// Convert a text element's runs to a:p paragraphs. Bullet body elements emit
// one paragraph per run with an indent level; title/subtitle emit a single
// paragraph. Bold/italic map to a:rPr b/i attributes.
function pptxParagraphs(el, { bullet }) {
  const lines = bulletLines(el);
  if (!lines.length) return '<a:p/>';
  return lines.map((ln) => {
    const lvl = bullet && ln.level ? ` lvl="${ln.level}"` : '';
    // buNone on non-bullet placeholders keeps titles clean.
    const pPr = bullet ? `<a:pPr${lvl}/>` : '<a:pPr><a:buNone/></a:pPr>';
    const rPr = `<a:rPr lang="en-US"${ln.bold ? ' b="1"' : ''}${ln.italic ? ' i="1"' : ''}/>`;
    const text = ln.text ? `<a:r>${rPr}<a:t>${xmlEscape(ln.text)}</a:t></a:r>` : '';
    return `<a:p>${pPr}${text}</a:p>`;
  }).join('');
}

// One sp (shape) per text element, positioned with a normalized→EMU xfrm.
function pptxTextShape(el, idAttr) {
  const x = Math.round(el.x * EMU_W), y = Math.round(el.y * EMU_H);
  const w = Math.round(el.w * EMU_W), h = Math.round(el.h * EMU_H);
  const isTitle = el.role === 'title' || el.role === 'section';
  const phType = isTitle ? ' type="title"' : '';
  const bullet = !isTitle && el.role !== 'subtitle';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${idAttr}" name="${xmlEscape(el.role || 'Text')}"/>` +
    `<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph${phType}/></p:nvPr></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/>${pptxParagraphs(el, { bullet })}</p:txBody></p:sp>`;
}

function pptxPicShape(el, idAttr, rId) {
  const x = Math.round(el.x * EMU_W), y = Math.round(el.y * EMU_H);
  const w = Math.round(el.w * EMU_W), h = Math.round(el.h * EMU_H);
  return `<p:pic><p:nvPicPr><p:cNvPr id="${idAttr}" name="Image" descr="${xmlEscape(el.alt || '')}"/>` +
    `<p:cNvPicPr/><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

function pptxShape(el, idAttr) {
  const x = Math.round(el.x * EMU_W), y = Math.round(el.y * EMU_H);
  const w = Math.round(el.w * EMU_W), h = Math.round(el.h * EMU_H);
  const prst = el.shape === 'ellipse' ? 'ellipse' : el.shape === 'line' ? 'line' : 'rect';
  const fill = el.shape === 'line' ? '<a:noFill/>' : `<a:solidFill><a:srgbClr val="${hex(el.fill)}"/></a:solidFill>`;
  const ln = `<a:ln><a:solidFill><a:srgbClr val="${hex(el.stroke)}"/></a:solidFill></a:ln>`;
  return `<p:sp><p:nvSpPr><p:cNvPr id="${idAttr}" name="Shape"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>` +
    `<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>${fill}${ln}</p:spPr></p:sp>`;
}

function hex(c) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '').trim());
  if (m) return m[1].toUpperCase();
  const m3 = /^#?([0-9a-f]{3})$/i.exec(String(c || '').trim());
  if (m3) return m3[1].split('').map((x) => x + x).join('').toUpperCase();
  return 'DDDDDD';
}

const CT_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const P_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

export async function deckToPptx(deckRaw) {
  const deck = normalizeDeck(deckRaw);
  const files = {};
  const media = []; // { name, bytes, contentType }
  const slideCount = deck.slides.length;

  // [Content_Types].xml — declare slide + notesSlide overrides and image defaults.
  const overrides = [];
  const slideRelsList = [];
  let mediaSeq = 0;

  deck.slides.forEach((slide, i) => {
    const n = i + 1;
    let nextId = 2;
    const slideRels = []; // { id, type, target }
    let bodyXml = '';

    for (const el of slide.elements) {
      if (el.type === 'text') {
        bodyXml += pptxTextShape(el, nextId++);
      } else if (el.type === 'image') {
        const parsed = parseDataUrl(el.dataUrl);
        if (!parsed) continue;
        mediaSeq += 1;
        const name = `image${mediaSeq}.${parsed.ext}`;
        media.push({ name, bytes: parsed.bytes, contentType: parsed.mime });
        const rId = `rId${slideRels.length + 2}`;
        slideRels.push({ id: rId, type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: `../media/${name}` });
        bodyXml += pptxPicShape(el, nextId++, rId);
      } else if (el.type === 'shape') {
        bodyXml += pptxShape(el, nextId++);
      }
    }

    const bg = slide.background ? `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${hex(slide.background)}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>` : '';
    files[`ppt/slides/slide${n}.xml`] = CT_HEAD +
      `<p:sld ${P_NS}><p:cSld>${bg}<p:spTree>` +
      '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
      '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
      `${bodyXml}</p:spTree></p:cSld><p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr></p:sld>`;

    // Slide → layout rel (always present) + image rels + optional notes rel.
    slideRels.unshift({ id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout', target: '../slideLayouts/slideLayout1.xml' });

    // Notes slide.
    if (slide.notes && slide.notes.trim()) {
      files[`ppt/notesSlides/notesSlide${n}.xml`] = CT_HEAD + notesXml(slide.notes);
      files[`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`] = relsXml([
        { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide', target: `../slides/slide${n}.xml` },
      ]);
      slideRels.push({ id: `rId${slideRels.length + 1}`, type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide', target: `../notesSlides/notesSlide${n}.xml` });
      overrides.push(`<Override PartName="/ppt/notesSlides/notesSlide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`);
    }

    files[`ppt/slides/_rels/slide${n}.xml.rels`] = relsXml(slideRels);
    overrides.push(`<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
    slideRelsList.push(n);
  });

  // Media files + content-type defaults for the extensions actually used.
  const imageDefaults = new Set();
  for (const m of media) {
    files[`ppt/media/${m.name}`] = m.bytes;
    imageDefaults.add(m.name.split('.').pop());
  }

  // presentation.xml — slide id list + slide size.
  const sldIdList = deck.slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join('');
  files['ppt/presentation.xml'] = CT_HEAD +
    `<p:presentation ${P_NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst>` +
    `<p:sldIdLst>${sldIdList}</p:sldIdLst>` +
    `<p:sldSz cx="${EMU_W}" cy="${EMU_H}" type="screen16x9"/><p:notesSz cx="${EMU_H}" cy="${EMU_W}"/></p:presentation>`;

  const presRels = deck.slides.map((_, i) => ({ id: `rId${i + 1}`, type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide', target: `slides/slide${i + 1}.xml` }));
  presRels.push({ id: 'rIdMaster', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster', target: 'slideMasters/slideMaster1.xml' });
  presRels.push({ id: 'rIdTheme', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme', target: 'theme/theme1.xml' });
  files['ppt/_rels/presentation.xml.rels'] = relsXml(presRels);

  // Master + layout + theme (minimal but referenced, so PowerPoint opens cleanly).
  const th = themeOf(deck);
  files['ppt/slideMasters/slideMaster1.xml'] = CT_HEAD + slideMasterXml();
  files['ppt/slideMasters/_rels/slideMaster1.xml.rels'] = relsXml([
    { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout', target: '../slideLayouts/slideLayout1.xml' },
    { id: 'rIdTheme', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme', target: '../theme/theme1.xml' },
  ]);
  files['ppt/slideLayouts/slideLayout1.xml'] = CT_HEAD + slideLayoutXml();
  files['ppt/slideLayouts/_rels/slideLayout1.xml.rels'] = relsXml([
    { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster', target: '../slideMasters/slideMaster1.xml' },
  ]);
  files['ppt/theme/theme1.xml'] = CT_HEAD + themeXml(th);

  files['[Content_Types].xml'] = CT_HEAD +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    [...imageDefaults].map((ext) => `<Default Extension="${ext}" ContentType="${mimeForExt(ext)}"/>`).join('') +
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
    overrides.join('') +
    '</Types>';

  files['_rels/.rels'] = relsXml([
    { id: 'rId1', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument', target: 'ppt/presentation.xml' },
  ]);

  return zipSync(files);
}

function relsXml(rels) {
  return CT_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    rels.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${xmlEscape(r.target)}"/>`).join('') +
    '</Relationships>';
}

function notesXml(notes) {
  const paras = String(notes).split('\n').map((line) =>
    `<a:p><a:r><a:rPr lang="en-US"/><a:t>${xmlEscape(line)}</a:t></a:r></a:p>`).join('');
  return `<p:notes ${P_NS}><p:cSld><p:spTree>` +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
    '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>' +
    `<p:txBody><a:bodyPr/><a:lstStyle/>${paras}</p:txBody></p:sp>` +
    '</p:spTree></p:cSld></p:notes>';
}

function slideMasterXml() {
  return `<p:sldMaster ${P_NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>` +
    '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>' +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>';
}

function slideLayoutXml() {
  return `<p:sldLayout ${P_NS} type="blank" preserve="1"><p:cSld name="Blank">` +
    '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>' +
    '<p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr></p:sldLayout>';
}

function themeXml(th) {
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const accent = hex(th.accent);
  return `<a:theme xmlns:a="${A}" name="edot"><a:themeElements>` +
    '<a:clrScheme name="edot"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>' +
    '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
    `<a:dk2><a:srgbClr val="${hex(th.fg)}"/></a:dk2><a:lt2><a:srgbClr val="${hex(th.bg)}"/></a:lt2>` +
    `<a:accent1><a:srgbClr val="${accent}"/></a:accent1><a:accent2><a:srgbClr val="${accent}"/></a:accent2>` +
    `<a:accent3><a:srgbClr val="${accent}"/></a:accent3><a:accent4><a:srgbClr val="${accent}"/></a:accent4>` +
    `<a:accent5><a:srgbClr val="${accent}"/></a:accent5><a:accent6><a:srgbClr val="${accent}"/></a:accent6>` +
    '<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme>' +
    '<a:fontScheme name="edot"><a:majorFont><a:latin typeface="Georgia"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
    '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
    '<a:fmtScheme name="edot"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>' +
    '<a:lnStyleLst><a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
    '<a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
    '<a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>' +
    '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle>' +
    '<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
    '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>' +
    '</a:fmtScheme></a:themeElements></a:theme>';
}

// ============================================================================
// PPTX import — best-effort text/notes/images into the core
// ============================================================================

export async function pptxToDeck(arrayBuffer) {
  const entries = await unzip(arrayBuffer);
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';

  // Slide order from presentation.xml.rels + presentation.xml sldIdLst.
  const presRels = parseRels(entries['ppt/_rels/presentation.xml.rels'], entries);
  const presXml = entries['ppt/presentation.xml'] ? parseXml(entries['ppt/presentation.xml']) : null;
  const slidePaths = [];
  if (presXml) {
    const ids = presXml.getElementsByTagNameNS('http://schemas.openxmlformats.org/presentationml/2006/main', 'sldId');
    for (const id of Array.from(ids)) {
      const rid = id.getAttributeNS(R, 'id');
      const target = presRels[rid];
      if (target) slidePaths.push(normPath('ppt/', target));
    }
  }
  // Fallback: any slideN.xml, numerically sorted.
  if (!slidePaths.length) {
    Object.keys(entries).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
      .sort((a, b) => slideNum(a) - slideNum(b)).forEach((k) => slidePaths.push(k));
  }

  const deck = newDeck('Imported deck');
  deck.slides = [];

  for (const path of slidePaths) {
    const bytes = entries[path];
    if (!bytes) continue;
    const doc = parseXml(bytes);
    const rels = parseRels(entries[relsPathFor(path)], entries);

    const slide = newSlide('title-content');
    slide.elements = [];
    slide.notes = '';

    // Walk every sp (shape) on the slide; classify title vs body by ph type.
    const sps = doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/presentationml/2006/main', 'sp');
    let titleSet = false;
    for (const sp of Array.from(sps)) {
      const ph = sp.getElementsByTagNameNS(P, 'ph')[0];
      const phType = ph ? (ph.getAttribute('type') || '') : '';
      // txBody is p:txBody in PresentationML; its paragraphs/runs are a:p / a:r.
      const txBody = sp.getElementsByTagNameNS(P, 'txBody')[0] || sp.getElementsByTagNameNS(A, 'txBody')[0];
      if (!txBody) continue;
      const { runs, isMultiline } = paragraphsToRuns(txBody, A);
      if (!runs.length) continue;
      const isTitle = /^(title|ctrTitle)$/.test(phType) && !titleSet;
      const xfrm = readXfrm(sp, A);
      if (isTitle) {
        titleSet = true;
        slide.elements.push({ type: 'text', role: 'title', ...(xfrm || { x: 0.06, y: 0.06, w: 0.88, h: 0.16 }), runs: [{ text: runsText(runs) }] });
      } else {
        slide.elements.push({ type: 'text', role: 'body', ...(xfrm || { x: 0.06, y: 0.26, w: 0.88, h: 0.66 }), runs });
      }
    }

    // Images (p:pic → blip r:embed → media bytes → data URL).
    const pics = doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/presentationml/2006/main', 'pic');
    for (const pic of Array.from(pics)) {
      const blip = pic.getElementsByTagNameNS(A, 'blip')[0];
      const embed = blip && (blip.getAttributeNS(R, 'embed') || blip.getAttributeNS(R, 'link'));
      const target = embed && rels[embed];
      if (!target) continue;
      const mediaPath = normPath(dirOf(path) + '/', target);
      const mbytes = entries[mediaPath];
      if (!mbytes) continue;
      const ext = (mediaPath.split('.').pop() || 'png').toLowerCase();
      const mime = mimeForExt(ext);
      if (!mime) continue;
      const xfrm = readXfrm(pic, A) || { x: 0.2, y: 0.2, w: 0.6, h: 0.6 };
      slide.elements.push({ type: 'image', ...xfrm, dataUrl: `data:${mime};base64,${bytesToBase64(mbytes)}`, alt: '' });
    }

    // Notes (notesSlide rel → body text).
    const notesRel = Object.entries(rels).find(([, t]) => /notesSlide\d+\.xml$/.test(t));
    if (notesRel) {
      const notesPath = normPath(dirOf(path) + '/', notesRel[1]);
      if (entries[notesPath]) {
        const ndoc = parseXml(entries[notesPath]);
        slide.notes = collectText(ndoc, A).trim();
      }
    }

    if (!slide.elements.length) slide.elements = newSlide('blank').elements;
    deck.slides.push(slide);
  }

  if (!deck.slides.length) deck.slides.push(newSlide('title', { title: 'Imported deck' }));
  deck.title = slideTitle(deck.slides[0]) || 'Imported deck';
  return normalizeDeck(deck);
}

// Each a:p → one run (with first-run bold/italic + indent level). Joins
// inner runs' text so a bulleted line survives as a single logical line.
function paragraphsToRuns(txBody, A) {
  const ps = txBody.getElementsByTagNameNS(A, 'p');
  const runs = [];
  for (const p of Array.from(ps)) {
    const rs = p.getElementsByTagNameNS(A, 'r');
    let text = '';
    let bold = false, italic = false, gotProps = false;
    for (const r of Array.from(rs)) {
      const t = r.getElementsByTagNameNS(A, 't')[0];
      if (t) text += t.textContent;
      if (!gotProps) {
        const rPr = r.getElementsByTagNameNS(A, 'rPr')[0];
        if (rPr) { bold = rPr.getAttribute('b') === '1'; italic = rPr.getAttribute('i') === '1'; gotProps = true; }
      }
    }
    const pPr = p.getElementsByTagNameNS(A, 'pPr')[0];
    const level = pPr ? parseInt(pPr.getAttribute('lvl') || '0', 10) : 0;
    if (text) runs.push({ text, bold, italic, level: level || 0 });
  }
  return { runs, isMultiline: runs.length > 1 };
}

function readXfrm(sp, A) {
  const xfrm = sp.getElementsByTagNameNS(A, 'xfrm')[0];
  if (!xfrm) return null;
  const off = xfrm.getElementsByTagNameNS(A, 'off')[0];
  const ext = xfrm.getElementsByTagNameNS(A, 'ext')[0];
  if (!off || !ext) return null;
  const x = +off.getAttribute('x'), y = +off.getAttribute('y');
  const cx = +ext.getAttribute('cx'), cy = +ext.getAttribute('cy');
  if (![x, y, cx, cy].every(Number.isFinite)) return null;
  return {
    x: Math.max(0, Math.min(1, x / EMU_W)),
    y: Math.max(0, Math.min(1, y / EMU_H)),
    w: Math.max(0.01, Math.min(1, cx / EMU_W)),
    h: Math.max(0.01, Math.min(1, cy / EMU_H)),
  };
}

function collectText(doc, A) {
  const ts = doc.getElementsByTagNameNS(A, 't');
  return Array.from(ts).map((t, i) => (i ? '\n' : '') + t.textContent).join('');
}

// ============================================================================
// ODP (OpenDocument Presentation) — import + export, best-effort
// ============================================================================

const ODF_OFFICE = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
const ODF_DRAW = 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0';
const ODF_TEXT = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
const ODF_SVG = 'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0';
const ODF_PRES = 'urn:oasis:names:tc:opendocument:xmlns:presentation:1.0';

// ODF page is 10in × 5.625in expressed in cm for a 16:9 page (25.4 × 14.288cm).
const ODF_W_CM = 25.4;
const ODF_H_CM = 14.288;

export async function deckToOdp(deckRaw) {
  const deck = normalizeDeck(deckRaw);
  const media = [];
  let mseq = 0;

  const pages = deck.slides.map((slide) => {
    let frames = '';
    for (const el of slide.elements) {
      const x = (el.x * ODF_W_CM).toFixed(3), y = (el.y * ODF_H_CM).toFixed(3);
      const w = (el.w * ODF_W_CM).toFixed(3), h = (el.h * ODF_H_CM).toFixed(3);
      if (el.type === 'text') {
        const paras = bulletLines(el).map((ln) =>
          `<text:p>${ln.bold ? '<text:span text:style-name="Tb">' : ''}${xmlEscape(ln.text)}${ln.bold ? '</text:span>' : ''}</text:p>`).join('') || '<text:p/>';
        frames += `<draw:frame svg:x="${x}cm" svg:y="${y}cm" svg:width="${w}cm" svg:height="${h}cm">` +
          `<draw:text-box>${paras}</draw:text-box></draw:frame>`;
      } else if (el.type === 'image') {
        const parsed = parseDataUrl(el.dataUrl);
        if (!parsed) continue;
        mseq += 1;
        const name = `Pictures/image${mseq}.${parsed.ext}`;
        media.push({ name, bytes: parsed.bytes, mime: parsed.mime });
        frames += `<draw:frame svg:x="${x}cm" svg:y="${y}cm" svg:width="${w}cm" svg:height="${h}cm">` +
          `<draw:image xlink:href="${name}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>` +
          (el.alt ? `<svg:title>${xmlEscape(el.alt)}</svg:title>` : '') + '</draw:frame>';
      } else if (el.type === 'shape') {
        const tag = el.shape === 'ellipse' ? 'draw:ellipse' : el.shape === 'line' ? 'draw:line' : 'draw:rect';
        if (el.shape === 'line') {
          const x2 = ((el.x + el.w) * ODF_W_CM).toFixed(3), y2 = ((el.y + el.h) * ODF_H_CM).toFixed(3);
          frames += `<draw:line svg:x1="${x}cm" svg:y1="${y}cm" svg:x2="${x2}cm" svg:y2="${y2}cm"/>`;
        } else {
          frames += `<${tag} svg:x="${x}cm" svg:y="${y}cm" svg:width="${w}cm" svg:height="${h}cm"/>`;
        }
      }
    }
    const notes = slide.notes && slide.notes.trim()
      ? `<presentation:notes><draw:frame><draw:text-box>${
        slide.notes.split('\n').map((l) => `<text:p>${xmlEscape(l)}</text:p>`).join('')
      }</draw:text-box></draw:frame></presentation:notes>` : '';
    return `<draw:page draw:name="${xmlEscape(slideTitle(slide) || 'Slide')}">${frames}${notes}</draw:page>`;
  }).join('');

  const NS =
    `xmlns:office="${ODF_OFFICE}" xmlns:draw="${ODF_DRAW}" xmlns:text="${ODF_TEXT}" ` +
    `xmlns:svg="${ODF_SVG}" xmlns:presentation="${ODF_PRES}" ` +
    'xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
    'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"';

  const content = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<office:document-content ${NS} office:version="1.2"><office:automatic-styles>` +
    '<style:style style:name="Tb" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>' +
    '</office:automatic-styles>' +
    `<office:body><office:presentation>${pages}</office:presentation></office:body></office:document-content>`;

  const manifestEntries = [
    '<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.presentation"/>',
    '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>',
    '<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>',
    '<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>',
    ...media.map((m) => `<manifest:file-entry manifest:full-path="${m.name}" manifest:media-type="${m.mime}"/>`),
  ].join('');

  const files = {
    // mimetype must be the first, STORED entry; zip.js stores when not smaller,
    // and this short string never benefits from deflate, so it stays STORED.
    mimetype: 'application/vnd.oasis.opendocument.presentation',
    'content.xml': content,
    'styles.xml': '<?xml version="1.0" encoding="UTF-8"?>\n' +
      `<office:document-styles ${NS} office:version="1.2"><office:styles/><office:master-styles>` +
      '<style:master-page style:name="Default"/></office:master-styles></office:document-styles>',
    'meta.xml': '<?xml version="1.0" encoding="UTF-8"?>\n' +
      `<office:document-meta ${NS}><office:meta><meta:generator xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0">edot-slides</meta:generator></office:meta></office:document-meta>`,
    'META-INF/manifest.xml': '<?xml version="1.0" encoding="UTF-8"?>\n' +
      `<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">${manifestEntries}</manifest:manifest>`,
  };
  for (const m of media) files[m.name] = m.bytes;
  return zipSync(files);
}

export async function odpToDeck(arrayBuffer) {
  const entries = await unzip(arrayBuffer);
  if (!entries['content.xml']) throw new Error('Not an ODP file (missing content.xml)');
  const doc = parseXml(entries['content.xml']);
  const pages = doc.getElementsByTagNameNS(ODF_DRAW, 'page');
  const deck = newDeck('Imported deck');
  deck.slides = [];

  for (const page of Array.from(pages)) {
    const slide = newSlide('title-content');
    slide.elements = [];
    slide.notes = '';

    const frames = page.getElementsByTagNameNS(ODF_DRAW, 'frame');
    let first = true;
    for (const frame of Array.from(frames)) {
      // Skip frames inside the notes block.
      if (frame.closest && frame.closest('presentation\\:notes')) continue;
      const xfrm = readOdfXfrm(frame);
      const box = frame.getElementsByTagNameNS(ODF_DRAW, 'text-box')[0];
      const img = frame.getElementsByTagNameNS(ODF_DRAW, 'image')[0];
      if (img) {
        const href = img.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || img.getAttribute('xlink:href');
        const mbytes = href && (entries[href] || entries[href.replace(/^\//, '')]);
        if (mbytes) {
          const ext = (href.split('.').pop() || 'png').toLowerCase();
          const mime = mimeForExt(ext) || 'image/png';
          slide.elements.push({ type: 'image', ...(xfrm || { x: 0.2, y: 0.2, w: 0.6, h: 0.6 }), dataUrl: `data:${mime};base64,${bytesToBase64(mbytes)}`, alt: '' });
        }
        continue;
      }
      if (box) {
        const ps = box.getElementsByTagNameNS(ODF_TEXT, 'p');
        const runs = Array.from(ps).map((p) => ({ text: p.textContent || '', level: 0 })).filter((r) => r.text);
        if (!runs.length) continue;
        if (first) {
          first = false;
          slide.elements.push({ type: 'text', role: 'title', ...(xfrm || { x: 0.06, y: 0.06, w: 0.88, h: 0.16 }), runs: [{ text: runsText(runs) }] });
        } else {
          slide.elements.push({ type: 'text', role: 'body', ...(xfrm || { x: 0.06, y: 0.26, w: 0.88, h: 0.66 }), runs });
        }
      }
    }

    // Notes.
    const notesEl = page.getElementsByTagNameNS(ODF_PRES, 'notes')[0];
    if (notesEl) {
      const ps = notesEl.getElementsByTagNameNS(ODF_TEXT, 'p');
      slide.notes = Array.from(ps).map((p) => p.textContent || '').join('\n').trim();
    }

    if (!slide.elements.length) slide.elements = newSlide('blank').elements;
    deck.slides.push(slide);
  }

  if (!deck.slides.length) deck.slides.push(newSlide('title', { title: 'Imported deck' }));
  deck.title = slideTitle(deck.slides[0]) || 'Imported deck';
  return normalizeDeck(deck);
}

function readOdfXfrm(frame) {
  const px = parseCm(frame.getAttributeNS(ODF_SVG, 'x') || frame.getAttribute('svg:x'));
  const py = parseCm(frame.getAttributeNS(ODF_SVG, 'y') || frame.getAttribute('svg:y'));
  const pw = parseCm(frame.getAttributeNS(ODF_SVG, 'width') || frame.getAttribute('svg:width'));
  const ph = parseCm(frame.getAttributeNS(ODF_SVG, 'height') || frame.getAttribute('svg:height'));
  if (px == null || py == null || pw == null || ph == null) return null;
  return {
    x: Math.max(0, Math.min(1, px / ODF_W_CM)),
    y: Math.max(0, Math.min(1, py / ODF_H_CM)),
    w: Math.max(0.01, Math.min(1, pw / ODF_W_CM)),
    h: Math.max(0.01, Math.min(1, ph / ODF_H_CM)),
  };
}
function parseCm(v) {
  if (!v) return null;
  const m = /^([\d.]+)\s*(cm|mm|in|pt)?$/.exec(String(v).trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case 'mm': return n / 10;
    case 'in': return n * 2.54;
    case 'pt': return (n / 72) * 2.54;
    default: return n; // cm
  }
}

// ============================================================================
// HTML export — a single self-contained, keyboard-navigable deck
// ============================================================================

export function deckToHtml(deckRaw) {
  const deck = normalizeDeck(deckRaw);
  const th = themeOf(deck);
  const sectionFor = (slide) => {
    const bg = slide.background || th.bg;
    let inner = '';
    for (const el of slide.elements) {
      const style = `left:${pct(el.x)};top:${pct(el.y)};width:${pct(el.w)};height:${pct(el.h)}`;
      if (el.type === 'text') {
        const isTitle = el.role === 'title' || el.role === 'section';
        const tag = isTitle ? 'h2' : 'div';
        const cls = isTitle ? 'title' : 'body';
        const lines = bulletLines(el);
        const html = isTitle
          ? xmlEscape(runsText(el.runs))
          : `<ul>${lines.map((ln) => `<li style="margin-left:${ln.level * 1.2}em">${markup(ln)}</li>`).join('')}</ul>`;
        inner += `<${tag} class="el ${cls}" style="${style}">${html}</${tag}>`;
      } else if (el.type === 'image') {
        inner += `<img class="el" style="${style}" src="${xmlEscape(el.dataUrl)}" alt="${xmlEscape(el.alt)}">`;
      } else if (el.type === 'shape') {
        inner += shapeHtml(el, style);
      }
    }
    return `<section style="background:${xmlEscape(bg)}"><div class="canvas">${inner}</div>` +
      (slide.notes ? `<aside class="notes">${xmlEscape(slide.notes)}</aside>` : '') + '</section>';
  };

  const sections = deck.slides.map(sectionFor).join('\n');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>${xmlEscape(deck.title)}</title>
<style>
  :root { --fg:${th.fg}; --accent:${th.accent}; --font:${th.font}; }
  * { box-sizing: border-box; }
  html, body { margin:0; height:100%; background:#000; color:var(--fg); font-family:var(--font); overflow:hidden; }
  #deck { position:relative; height:100dvh; height:100vh; }
  section { position:absolute; inset:0; display:none; place-items:center; }
  section.on { display:grid; }
  .canvas { position:relative; width:min(100vw, calc(100dvh * 16 / 9)); aspect-ratio:16/9; box-shadow:0 0 0 1px rgba(0,0,0,.2); overflow:hidden; }
  .el { position:absolute; }
  .title { margin:0; color:var(--accent); font-size:clamp(1.2rem, 4.5vw, 3rem); display:flex; align-items:center; }
  .body { font-size:clamp(.8rem, 2.6vw, 1.5rem); }
  .body ul { margin:0; padding-left:1.2em; }
  .body li { margin:.25em 0; }
  .notes { position:absolute; bottom:0; left:0; right:0; max-height:25%; overflow:auto; background:rgba(0,0,0,.65); color:#fff; padding:.4rem .8rem; font-size:.85rem; display:none; white-space:pre-wrap; }
  body.show-notes .notes { display:block; }
  #hud { position:fixed; bottom:.5rem; right:.8rem; color:#fff; background:rgba(0,0,0,.5); padding:.2rem .6rem; border-radius:6px; font:600 .85rem var(--font); }
  @media print { html,body{overflow:visible;background:#fff;} section{position:static;display:grid!important;page-break-after:always;height:100vh;} #hud{display:none;} }
</style></head>
<body>
<div id="deck">${sections}</div>
<div id="hud" aria-live="polite"><span id="cur">1</span> / ${deck.slides.length}</div>
<script>
  (function(){
    var secs = [].slice.call(document.querySelectorAll('#deck section'));
    var i = 0;
    function show(n){ i = Math.max(0, Math.min(secs.length-1, n)); secs.forEach(function(s,k){ s.classList.toggle('on', k===i); }); document.getElementById('cur').textContent = (i+1); location.hash = '#'+(i+1); }
    function next(){ show(i+1); } function prev(){ show(i-1); }
    document.addEventListener('keydown', function(e){
      if (e.key==='ArrowRight'||e.key==='ArrowDown'||e.key===' '||e.key==='PageDown'){ next(); e.preventDefault(); }
      else if (e.key==='ArrowLeft'||e.key==='ArrowUp'||e.key==='PageUp'){ prev(); e.preventDefault(); }
      else if (e.key==='Home'){ show(0); } else if (e.key==='End'){ show(secs.length-1); }
      else if (e.key==='n'||e.key==='N'){ document.body.classList.toggle('show-notes'); }
      else if (e.key==='f'||e.key==='F'){ if(document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen(); }
    });
    document.addEventListener('click', function(e){ if (e.clientX < window.innerWidth*0.3) prev(); else next(); });
    var sx=null; document.addEventListener('touchstart', function(e){ sx = e.touches[0].clientX; }, {passive:true});
    document.addEventListener('touchend', function(e){ if(sx==null) return; var dx = e.changedTouches[0].clientX - sx; if(Math.abs(dx)>40){ dx<0?next():prev(); } sx=null; });
    var h = parseInt((location.hash||'').slice(1),10); show(isNaN(h)?0:h-1);
  })();
</script>
</body></html>`;
}

function shapeHtml(el, style) {
  if (el.shape === 'ellipse') return `<div class="el" style="${style};background:${xmlEscape(el.fill)};border:2px solid ${xmlEscape(el.stroke)};border-radius:50%"></div>`;
  if (el.shape === 'line') return `<svg class="el" style="${style}" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="0" y1="0" x2="100" y2="100" stroke="${xmlEscape(el.stroke)}" stroke-width="2"/></svg>`;
  return `<div class="el" style="${style};background:${xmlEscape(el.fill)};border:2px solid ${xmlEscape(el.stroke)}"></div>`;
}
function markup(ln) {
  let t = xmlEscape(ln.text);
  if (ln.bold) t = `<strong>${t}</strong>`;
  if (ln.italic) t = `<em>${t}</em>`;
  return t || '&nbsp;';
}
function pct(v) { return (v * 100).toFixed(3) + '%'; }

// ============================================================================
// PDF export — one page per slide, hand-rolled PDF 1.4 (io-pdf.js approach)
// ============================================================================

const PDF_W = 720;   // 10in × 72 — matches the 16:9 slide aspect
const PDF_H = 405;   // 5.625in × 72

function pdfEsc(s) {
  let out = '';
  for (const ch of String(s)) {
    const code = ch.codePointAt(0);
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else if (code < 32) out += ' ';
    else if (code < 256) out += ch;
    else out += '?';
  }
  return out;
}

export function deckToPdf(deckRaw, title = 'Slides') {
  const deck = normalizeDeck(deckRaw);
  const th = themeOf(deck);
  const accent = rgbOf(th.accent);
  const fg = rgbOf(th.fg);

  const pages = deck.slides.map((slide) => {
    const ops = [];
    const bg = rgbOf(slide.background || th.bg);
    ops.push(`${bg.join(' ')} rg 0 0 ${PDF_W} ${PDF_H} re f`);

    for (const el of slide.elements) {
      const x = el.x * PDF_W;
      const yTop = PDF_H - el.y * PDF_H; // PDF origin is bottom-left
      const w = el.w * PDF_W, h = el.h * PDF_H;
      if (el.type === 'shape') {
        const fill = rgbOf(el.fill), stroke = rgbOf(el.stroke);
        if (el.shape === 'line') {
          ops.push(`${stroke.join(' ')} RG 1.5 w ${fmt(x)} ${fmt(yTop)} m ${fmt(x + w)} ${fmt(yTop - h)} l S`);
        } else {
          // Rectangle approximation for ellipse too (PDF curve math omitted; honest about it).
          ops.push(`${fill.join(' ')} rg ${stroke.join(' ')} RG 1 w ${fmt(x)} ${fmt(yTop - h)} ${fmt(w)} ${fmt(h)} re B`);
        }
      } else if (el.type === 'text') {
        const isTitle = el.role === 'title' || el.role === 'section';
        const size = isTitle ? Math.min(28, 26) : 16;
        const color = isTitle ? accent : fg;
        const lines = bulletLines(el);
        let ty = yTop - size; // first baseline
        for (const ln of lines) {
          if (ty < 6) break;
          const font = ln.bold ? 'Helvetica-Bold' : ln.italic ? 'Helvetica-Oblique' : 'Helvetica';
          const prefix = (!isTitle) ? '• ' : '';
          const indent = ln.level * 14;
          ops.push(`${color.join(' ')} rg BT /${font} ${size} Tf ${fmt(x + indent)} ${fmt(ty)} Td (${pdfEsc(prefix + ln.text)}) Tj ET`);
          ty -= size * 1.35;
        }
      }
      // Images are intentionally not embedded in the PDF (no JPEG/PNG XObject
      // pipeline here) — a placeholder box keeps layout honest.
      if (el.type === 'image') {
        ops.push(`0.8 0.8 0.8 rg ${fmt(x)} ${fmt(yTop - h)} ${fmt(w)} ${fmt(h)} re f`);
      }
    }
    return ops.join('\n');
  });

  return assemblePdf(pages, title);
}

function fmt(n) { return (Math.round(n * 100) / 100).toString(); }

function rgbOf(c) {
  const h = hex(c);
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]
    .map((v) => Math.round(v * 1000) / 1000);
}

function assemblePdf(pageStreams, title) {
  const fonts = ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique'];
  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  const catalogNo = 1, pagesNo = 2;
  objects.push(null, null);

  const fontObjNo = {};
  for (const fn of fonts) {
    fontObjNo[fn] = add(`<< /Type /Font /Subtype /Type1 /BaseFont /${fn} /Encoding /WinAnsiEncoding >>`);
  }
  const fontRes = fonts.map((fn) => `/${fn} ${fontObjNo[fn]} 0 R`).join(' ');

  const kids = [];
  for (const content of pageStreams) {
    const contentNo = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageNo = add(`<< /Type /Page /Parent ${pagesNo} 0 R /MediaBox [0 0 ${PDF_W} ${PDF_H}] /Resources << /Font << ${fontRes} >> >> /Contents ${contentNo} 0 R >>`);
    kids.push(`${pageNo} 0 R`);
  }

  objects[catalogNo - 1] = `<< /Type /Catalog /Pages ${pagesNo} 0 R >>`;
  objects[pagesNo - 1] = `<< /Type /Pages /Count ${pageStreams.length} /Kids [${kids.join(' ')}] >>`;
  const infoNo = add(`<< /Title (${pdfEsc(title)}) /Producer (edot-slides) /Creator (edot-slides) >>`);

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];
  objects.forEach((body, i) => { offsets[i] = pdf.length; pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 0; i < objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNo} 0 R /Info ${infoNo} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: 'application/pdf' });
}

// ============================================================================
// PNG per slide — render a slide to an SVG then rasterise to PNG via canvas.
// (Browser-only: needs Image/canvas. Returns a Blob.)
// ============================================================================

export function slideToSvg(deckRaw, index, { width = 1280 } = {}) {
  const deck = normalizeDeck(deckRaw);
  const slide = deck.slides[index];
  if (!slide) throw new Error('No such slide');
  const th = themeOf(deck);
  const W = width, H = Math.round((width * 9) / 16);
  const bg = slide.background || th.bg;
  let body = `<rect width="${W}" height="${H}" fill="${xmlEscape(bg)}"/>`;
  for (const el of slide.elements) {
    const x = el.x * W, y = el.y * H, w = el.w * W, h = el.h * H;
    if (el.type === 'text') {
      const isTitle = el.role === 'title' || el.role === 'section';
      const size = isTitle ? Math.round(H * 0.09) : Math.round(H * 0.05);
      const color = isTitle ? th.accent : th.fg;
      const lines = bulletLines(el);
      let ty = y + size;
      for (const ln of lines) {
        const weight = ln.bold ? ' font-weight="bold"' : '';
        const style = ln.italic ? ' font-style="italic"' : '';
        const prefix = isTitle ? '' : '• ';
        body += `<text x="${(x + ln.level * size * 0.7).toFixed(1)}" y="${ty.toFixed(1)}" font-size="${size}" fill="${xmlEscape(color)}" font-family="${xmlEscape(th.font)}"${weight}${style}>${xmlEscape(prefix + ln.text)}</text>`;
        ty += size * 1.4;
      }
    } else if (el.type === 'image') {
      body += `<image x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" href="${xmlEscape(el.dataUrl)}" preserveAspectRatio="xMidYMid meet"/>`;
    } else if (el.type === 'shape') {
      if (el.shape === 'ellipse') body += `<ellipse cx="${(x + w / 2).toFixed(1)}" cy="${(y + h / 2).toFixed(1)}" rx="${(w / 2).toFixed(1)}" ry="${(h / 2).toFixed(1)}" fill="${xmlEscape(el.fill)}" stroke="${xmlEscape(el.stroke)}" stroke-width="2"/>`;
      else if (el.shape === 'line') body += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + w).toFixed(1)}" y2="${(y + h).toFixed(1)}" stroke="${xmlEscape(el.stroke)}" stroke-width="2"/>`;
      else body += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${xmlEscape(el.fill)}" stroke="${xmlEscape(el.stroke)}" stroke-width="2"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
}

export async function slideToPng(deckRaw, index, opts = {}) {
  const svg = slideToSvg(deckRaw, index, opts);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('SVG render failed')); img.src = url; });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || (opts.width || 1280);
  canvas.height = img.naturalHeight || Math.round((opts.width || 1280) * 9 / 16);
  canvas.getContext('2d').drawImage(img, 0, 0);
  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));
}

// ============================================================================
// small XML/zip helpers shared by the importers
// ============================================================================

function parseXml(bytes) {
  return new DOMParser().parseFromString(utf8.decode(bytes), 'application/xml');
}

// Resolve a *.rels file (Uint8Array) into { relId: target }.
function parseRels(bytes) {
  const map = {};
  if (!bytes) return map;
  const doc = parseXml(bytes);
  Array.from(doc.getElementsByTagName('Relationship')).forEach((r) => {
    map[r.getAttribute('Id')] = r.getAttribute('Target');
  });
  return map;
}

function relsPathFor(partPath) {
  const i = partPath.lastIndexOf('/');
  return partPath.slice(0, i + 1) + '_rels/' + partPath.slice(i + 1) + '.rels';
}
function dirOf(p) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
function slideNum(p) { const m = /slide(\d+)\.xml$/.exec(p); return m ? +m[1] : 0; }

// Resolve a possibly-relative OOXML target ("../media/x.png") against a base dir.
function normPath(base, target) {
  if (target.startsWith('/')) return target.replace(/^\//, '');
  const parts = (base + target).split('/');
  const out = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part !== '.' && part !== '') out.push(part);
  }
  return out.join('/');
}
