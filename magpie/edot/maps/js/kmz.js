// kmz.js — extract the KML document from a KMZ (a ZIP archive), zero deps.
//
// A KMZ is a plain ZIP whose main document is doc.kml (per the OGC KML spec,
// "the main .kml file should be named doc.kml"; we fall back to the first .kml).
// We read the ZIP's local-file headers and inflate entries with the platform
// DecompressionStream('deflate-raw') — a real decompressor built into the
// browser, NOT manual bit-twiddling. Stored (uncompressed) entries are returned
// as-is. This is binary container parsing, not text hackparsing.
//
// Returns the inner KML as a string (to feed kmlToGeoJson). Throws if no KML is
// found or the archive can't be read.

const SIG_LOCAL = 0x04034b50; // "PK\x03\x04" local file header

// Given an ArrayBuffer of a KMZ, return the doc.kml (or first .kml) text.
export async function kmzToKml(arrayBuffer) {
  const entries = readZipEntries(new DataView(arrayBuffer), new Uint8Array(arrayBuffer));
  if (!entries.length) throw new Error('KMZ contains no readable entries');
  // Prefer doc.kml, else the first *.kml, else give up.
  const pick = entries.find((e) => /(^|\/)doc\.kml$/i.test(e.name))
    || entries.find((e) => /\.kml$/i.test(e.name));
  if (!pick) throw new Error('KMZ contains no .kml document');
  const bytes = await inflateEntry(pick);
  return new TextDecoder('utf-8').decode(bytes);
}

// Walk the ZIP's local file headers in order. We don't need the central
// directory for KMZ (entries are small and we read every header sequentially).
// Each entry: { name, method, compSize, data:Uint8Array }.
function readZipEntries(dv, u8) {
  const entries = [];
  let off = 0;
  const len = u8.length;
  while (off + 4 <= len) {
    const sig = dv.getUint32(off, true);
    if (sig !== SIG_LOCAL) break; // reached central directory or end
    const method = dv.getUint16(off + 8, true);
    const compSize = dv.getUint32(off + 18, true);
    const nameLen = dv.getUint16(off + 26, true);
    const extraLen = dv.getUint16(off + 28, true);
    const nameStart = off + 30;
    const name = new TextDecoder('utf-8').decode(u8.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    // Note: this reader requires a known compressed size in the local header
    // (general-purpose bit 3 / streaming descriptors aren't handled). Real
    // KMZ writers (Google Earth, GDAL, ogr2ogr) all set the size in-header.
    const data = u8.subarray(dataStart, dataStart + compSize);
    entries.push({ name, method, compSize, data });
    off = dataStart + compSize;
  }
  return entries;
}

// Inflate one entry. method 0 = stored, method 8 = DEFLATE (raw).
async function inflateEntry(entry) {
  if (entry.method === 0) return entry.data;
  if (entry.method !== 8) throw new Error(`Unsupported KMZ compression method ${entry.method}`);
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream not available to inflate KMZ');
  }
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([entry.data]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}
