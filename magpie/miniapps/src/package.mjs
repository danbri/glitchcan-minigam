// Open a MiniApp package: W3C MiniApp Packaging, Discontinued Draft of 2026-08-11,
// section 5 ("Processing"). https://www.w3.org/TR/miniapp-packaging/
//
// openPackage runs the draft's seven steps: retrieve (media type), verify
// (signing block: detected and reported, NOT verified yet), unzip, process
// manifest, prepare runtime (app.js, app.css, platform_version, pages and
// widgets present, start page), extract locale, launch (returned, not run).

import { readZip } from './zip.mjs';
import { processManifest } from './manifest.mjs';

export const MEDIA_TYPE = 'application/miniapp-pkg+zip';
const PAGE_EXTS = ['.html', '.htm'];

export class PackageError extends Error {
  constructor(step, message) { super(`${step}: ${message}`); this.step = step; }
}

/**
 * @param {Uint8Array|ArrayBuffer} bytes  the container
 * @param {object} opts
 *   mediaType     the Content-Type it arrived with; null skips the check (a local file)
 *   strictMediaType  false turns a wrong media type into a warning (static hosts such as
 *                 GitHub Pages serve .ma as application/octet-stream)
 *   startRoute    a page route from a MiniApp URI path, or null
 *   platformCode  this user agent's platform version code (an integer)
 *   locales       the locales this user agent can show, most preferred first
 * @returns {Promise<{ manifest, files, signing, startPage, locale, messages, warnings }>}
 */
export async function openPackage(bytes, { mediaType = null, strictMediaType = true, startRoute = null,
  platformCode = 1, locales = ['en'] } = {}) {
  const warnings = [];

  // 1. Retrieve.
  if (mediaType !== null && mediaType.split(';')[0].trim().toLowerCase() !== MEDIA_TYPE) {
    const msg = `media type is "${mediaType}", not ${MEDIA_TYPE}`;
    if (strictMediaType) throw new PackageError('retrieve', msg);
    warnings.push(`retrieve: ${msg}; accepted because strictMediaType is false`);
  }

  // 3. Unzip (the signing block comes out of the same pass).
  let zip;
  try { zip = await readZip(bytes); } catch (e) { throw new PackageError('unzip', e.message); }
  const { files, signing } = zip;

  // 2. Verify.
  if (signing) warnings.push(`verify: ${signing.scheme} signing block of ${signing.length} bytes found; signature checking is not implemented, the package is treated as unsigned`);

  // 4. Process manifest.
  const raw = files.get('manifest.json');
  if (!raw) throw new PackageError('manifest', 'manifest.json is missing');
  let json;
  try { json = JSON.parse(new TextDecoder().decode(raw)); } catch (e) { throw new PackageError('manifest', `manifest.json is not JSON: ${e.message}`); }
  const { manifest, errors, warnings: mw } = processManifest(json);
  warnings.push(...mw.map(w => `manifest: ${w}`));
  if (!manifest) throw new PackageError('manifest', errors.join('; '));

  // 5. Prepare runtime.
  for (const f of ['app.js', 'app.css']) if (!files.has(f)) throw new PackageError('prepare', `${f} is missing`);
  if (manifest.platform_version.min_code > platformCode) {
    throw new PackageError('prepare', `needs platform version ${manifest.platform_version.min_code}; this runner is ${platformCode}`);
  }
  for (const route of manifest.pages) {
    if (!pageFile(files, route)) throw new PackageError('prepare', `page "${route}" has no file in the package`);
  }
  for (const w of manifest.widgets || []) {
    if (!pageFile(files, w.path)) throw new PackageError('prepare', `widget "${w.name}" has no file at "${w.path}"`);
  }
  let startPage = manifest.pages[0];
  if (startRoute) {
    const r = startRoute.replace(/\.html?$/, '');
    if (manifest.pages.includes(r)) startPage = r;
    else warnings.push(`prepare: start route "${startRoute}" is not in pages; using "${startPage}"`);
  }

  // 6. Extract locale.
  const locale = manifest.lang && locales.some(l => sameLang(l, manifest.lang)) ? manifest.lang : locales[0];
  let messages = null;
  for (const cand of [locale, locale.split('-')[0], manifest.lang].filter(Boolean)) {
    const f = files.get(`i18n/${cand}.json`);
    if (f) { try { messages = JSON.parse(new TextDecoder().decode(f)); } catch { warnings.push(`locale: i18n/${cand}.json is not JSON`); } break; }
  }

  // 7. Launch: the caller does this with what is returned.
  return { manifest, files, signing, startPage, locale, messages, warnings };
}

/** The file name that holds a page route, or null. */
export function pageFile(files, route) {
  if (files.has(route)) return route;
  for (const ext of PAGE_EXTS) if (files.has(route + ext)) return route + ext;
  return null;
}

function sameLang(a, b) { return a.toLowerCase() === b.toLowerCase() || a.split('-')[0].toLowerCase() === b.split('-')[0].toLowerCase(); }
