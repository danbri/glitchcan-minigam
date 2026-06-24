// mime.js — a focused RFC 5322 / MIME parser for the raw-RFC822 paths
// (Gmail `format=raw`, the IMAP WebSocket proxy). Gmail/Graph/JMAP usually
// return *structured* bodies, so this is only used when a backend hands us a
// raw byte stream. No external deps — TextDecoder + atob only.
//
// It handles the parts that actually matter for displaying mail:
//   - header folding / unfolding and case-insensitive lookup
//   - RFC 2047 encoded-words in headers (=?utf-8?B?…?= and =?…?Q?…?=)
//   - multipart/* recursion (boundary-delimited), incl. nested multiparts
//   - text/plain + text/html alternative selection (prefer html)
//   - Content-Transfer-Encoding: base64 and quoted-printable
//   - charset decoding (utf-8, iso-8859-1/latin1, us-ascii, windows-1252)
//   - attachments (Content-Disposition: attachment, or any non-text leaf)
//
// Intentionally NOT a full MIME stack: we don't do message/rfc822 forwarding
// trees, S/MIME, or exotic charsets beyond a common set. Honest scope.

// ---- charset decode (a small, dependency-free set) -------------------------
// TextDecoder covers utf-8 / iso-8859-* / windows-* in every modern browser
// and in Node. We normalise a few aliases and fall back to utf-8.
function decodeBytes(bytes, charset) {
  const cs = String(charset || 'utf-8').toLowerCase().replace(/^charset=/, '').trim()
    .replace(/^"|"$/g, '');
  const alias = { 'us-ascii': 'ascii', 'latin1': 'iso-8859-1', 'utf8': 'utf-8' }[cs] || cs;
  try { return new TextDecoder(alias).decode(bytes); }
  catch { try { return new TextDecoder('utf-8').decode(bytes); } catch { return latin1(bytes); } }
}
function latin1(bytes) { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return s; }

// ---- byte helpers ----------------------------------------------------------
// Normalise input to a Uint8Array. Accepts a Uint8Array, ArrayBuffer, or a
// binary/latin1 string (each char code is one byte — what atob produces).
export function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  const s = String(input);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

// base64 (standard, tolerant of whitespace/newlines) → bytes.
export function base64ToBytes(b64) {
  const clean = String(b64).replace(/[^A-Za-z0-9+/=]/g, '');
  const bin = (typeof atob !== 'undefined')
    ? atob(clean)
    : Buffer.from(clean, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// quoted-printable → bytes. Handles soft line breaks (=\r?\n) and =XX octets.
export function quotedPrintableToBytes(text) {
  const s = String(text);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '=') {
      const next2 = s.substr(i + 1, 2);
      if (/^\r?\n/.test(s.substr(i + 1))) {          // soft line break
        i += (s[i + 1] === '\r' && s[i + 2] === '\n') ? 2 : 1;
        continue;
      }
      if (/^[0-9A-Fa-f]{2}$/.test(next2)) { out.push(parseInt(next2, 16)); i += 2; continue; }
      out.push(c.charCodeAt(0));                      // stray '=' kept literally
    } else {
      out.push(c.charCodeAt(0));
    }
  }
  return new Uint8Array(out);
}

// ---- RFC 2047 encoded-words in headers -------------------------------------
// =?charset?B?base64?=  and  =?charset?Q?quoted?=  (Q variant: '_' = space).
export function decodeEncodedWords(value) {
  if (!value || value.indexOf('=?') === -1) return value;
  // Adjacent encoded-words separated only by whitespace are concatenated
  // without the whitespace (RFC 2047 §6.2).
  return String(value).replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=(\s*)(?==\?)?/g,
    (m, charset, enc, data) => {
      let bytes;
      if (/b/i.test(enc)) bytes = base64ToBytes(data);
      else bytes = quotedPrintableToBytes(data.replace(/_/g, ' '));
      return decodeBytes(bytes, charset);
    },
  ).replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (m, charset, enc, data) => {
    let bytes;
    if (/b/i.test(enc)) bytes = base64ToBytes(data);
    else bytes = quotedPrintableToBytes(data.replace(/_/g, ' '));
    return decodeBytes(bytes, charset);
  });
}

// ---- header parsing --------------------------------------------------------
// Split a raw message into { headerText, bodyText } at the first blank line,
// tolerant of both CRLF and LF.
function splitHeadersBody(raw) {
  const idx = (() => {
    const a = raw.indexOf('\r\n\r\n');
    const b = raw.indexOf('\n\n');
    if (a === -1) return b;
    if (b === -1) return a;
    return Math.min(a, b);
  })();
  if (idx === -1) return { headerText: raw, bodyText: '' };
  const sepLen = raw.substr(idx, 4) === '\r\n\r\n' ? 4 : 2;
  return { headerText: raw.slice(0, idx), bodyText: raw.slice(idx + sepLen) };
}

// Parse folded headers into an array of { name, value } (value decoded of
// encoded-words). Continuation lines (leading WSP) are unfolded.
export function parseHeaders(headerText) {
  const lines = String(headerText).split(/\r?\n/);
  const headers = [];
  let cur = null;
  for (const line of lines) {
    if (/^[ \t]/.test(line) && cur) { cur.value += ' ' + line.trim(); continue; }
    const m = line.match(/^([^:]+):\s?(.*)$/);
    if (m) { cur = { name: m[1].trim(), value: m[2] }; headers.push(cur); }
  }
  for (const h of headers) h.value = decodeEncodedWords(h.value).trim();
  return headers;
}

// Case-insensitive single-header lookup over a header array.
export function getHeader(headers, name) {
  const lc = name.toLowerCase();
  const h = headers.find((x) => x.name.toLowerCase() === lc);
  return h ? h.value : undefined;
}

// Parse a structured header like:
//   multipart/mixed; boundary="X"; charset=utf-8
// into { value, params: { boundary, charset, … } }.
export function parseContentType(raw) {
  if (!raw) return { value: 'text/plain', params: {} };
  const parts = splitParams(raw);
  return { value: (parts.shift() || 'text/plain').toLowerCase(), params: paramMap(parts) };
}
export function parseContentDisposition(raw) {
  if (!raw) return { value: '', params: {} };
  const parts = splitParams(raw);
  return { value: (parts.shift() || '').toLowerCase(), params: paramMap(parts) };
}
// Split on semicolons that aren't inside quotes.
function splitParams(raw) {
  const out = []; let buf = ''; let q = false;
  for (const c of String(raw)) {
    if (c === '"') q = !q;
    if (c === ';' && !q) { out.push(buf.trim()); buf = ''; } else buf += c;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
function paramMap(parts) {
  const params = {};
  for (const p of parts) {
    const i = p.indexOf('=');
    if (i === -1) continue;
    const k = p.slice(0, i).trim().toLowerCase();
    let v = p.slice(i + 1).trim().replace(/^"|"$/g, '');
    // RFC 2047 may appear in filename params; decode opportunistically.
    params[k] = decodeEncodedWords(v);
  }
  return params;
}

// ---- the recursive parser --------------------------------------------------
// parseMessage(raw) → a normalized object the UI can render directly:
//   { headers:[{name,value}], from, to, cc, subject, date, messageId,
//     inReplyTo, bodyText, bodyHtml, attachments:[{name,mime,size,contentBytes}] }
export function parseMessage(input) {
  const raw = (input instanceof Uint8Array || input instanceof ArrayBuffer)
    ? decodeBytes(toBytes(input), 'utf-8') : String(input);
  const node = parseNode(raw);
  const out = {
    headers: node.headers,
    from: getHeader(node.headers, 'from') || '',
    to: getHeader(node.headers, 'to') || '',
    cc: getHeader(node.headers, 'cc') || '',
    subject: getHeader(node.headers, 'subject') || '',
    date: getHeader(node.headers, 'date') || '',
    messageId: getHeader(node.headers, 'message-id') || '',
    inReplyTo: getHeader(node.headers, 'in-reply-to') || '',
    bodyText: '', bodyHtml: '', attachments: [],
  };
  collectParts(node, out);
  return out;
}

// Parse one MIME node (a message or a part) into { headers, ctype, parts?, body }.
function parseNode(raw) {
  const { headerText, bodyText } = splitHeadersBody(raw);
  const headers = parseHeaders(headerText);
  const ctype = parseContentType(getHeader(headers, 'content-type'));
  const node = { headers, ctype, raw: bodyText };

  if (ctype.value.startsWith('multipart/') && ctype.params.boundary) {
    node.parts = splitMultipart(bodyText, ctype.params.boundary).map(parseNode);
  }
  return node;
}

// Split a multipart body on its boundary. Returns the raw part strings
// (between --boundary and --boundary, excluding preamble/epilogue).
function splitMultipart(body, boundary) {
  const dash = '--' + boundary;
  const lines = body.split(/\r?\n/);
  const parts = []; let cur = null;
  for (const line of lines) {
    if (line === dash || line.startsWith(dash + ' ')) { if (cur !== null) parts.push(cur.join('\n')); cur = []; continue; }
    if (line === dash + '--') { if (cur !== null) parts.push(cur.join('\n')); cur = null; break; }
    if (cur !== null) cur.push(line);
  }
  return parts;
}

// Decode a leaf node's body to bytes honouring Content-Transfer-Encoding.
function decodeLeafBytes(node) {
  const cte = (getHeader(node.headers, 'content-transfer-encoding') || '7bit').toLowerCase().trim();
  if (cte === 'base64') return base64ToBytes(node.raw);
  if (cte === 'quoted-printable') return quotedPrintableToBytes(node.raw);
  // 7bit / 8bit / binary: bytes as-is (latin1 view of the string).
  return toBytes(node.raw);
}

// Walk the tree, filling bodyText/bodyHtml (alternative selection) and
// attachments. For multipart/alternative we keep the *richest* representation
// (html over text); for multipart/mixed we accumulate.
function collectParts(node, out) {
  if (node.parts) {
    const subtype = node.ctype.value.split('/')[1];
    if (subtype === 'alternative') {
      // Prefer the last text/html, else the last text/plain.
      let html = null, text = null;
      for (const p of node.parts) {
        if (p.ctype.value === 'text/html') html = p;
        else if (p.ctype.value === 'text/plain') text = p;
        else collectParts(p, out);            // nested multipart inside alt
      }
      if (html) out.bodyHtml = out.bodyHtml || decodeText(html);
      if (text) out.bodyText = out.bodyText || decodeText(text);
    } else {
      for (const p of node.parts) collectParts(p, out);
    }
    return;
  }
  // Leaf node.
  const disp = parseContentDisposition(getHeader(node.headers, 'content-disposition'));
  const ctype = node.ctype.value;
  const isText = ctype === 'text/plain' || ctype === 'text/html';
  const named = disp.params.filename || node.ctype.params.name;
  if (disp.value === 'attachment' || (named && !isText) || (!isText && ctype !== '')) {
    const bytes = decodeLeafBytes(node);
    out.attachments.push({
      name: named || `attachment-${out.attachments.length + 1}`,
      mime: ctype || 'application/octet-stream',
      size: bytes.length,
      contentId: (getHeader(node.headers, 'content-id') || '').replace(/^<|>$/g, ''),
      contentBytes: bytes,
    });
    return;
  }
  if (ctype === 'text/html') out.bodyHtml = out.bodyHtml || decodeText(node);
  else out.bodyText = out.bodyText || decodeText(node);
}

// Decode a text leaf to a string using its CTE + charset.
function decodeText(node) {
  const bytes = decodeLeafBytes(node);
  return decodeBytes(bytes, node.ctype.params.charset);
}
