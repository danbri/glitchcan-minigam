// MiniApp manifest processing: W3C MiniApp Manifest, Discontinued Draft of 2026-08-11.
// https://www.w3.org/TR/miniapp-manifest/
//
// processManifest(json) follows the draft's processing model (section 1.7):
// a member that fails its check is dropped with a warning; the members the
// draft makes fatal (app_id, version, platform_version) give an error, and
// so do the members its member table marks required (name, icons, pages).
// Where the draft contradicts itself, the choice made here is listed in
// magpie/miniapps/README.md ("Where the drafts disagree with themselves").

const WINDOW_DEFAULTS = Object.freeze({
  auto_design_width: false,
  background_color: '#ffffff',
  background_text_style: 'dark',
  design_width: 750,
  enable_pull_down_refresh: false,
  fullscreen: false,
  navigation_bar_background_color: '#000000',
  navigation_bar_text_style: 'white',
  navigation_bar_title_text: '',
  navigation_style: 'default',
  on_reach_bottom_distance: 50,
  orientation: 'portrait',
});

const WINDOW_ENUMS = {
  background_text_style: ['light', 'dark'],
  navigation_bar_text_style: ['white', 'black'],
  navigation_style: ['default', 'custom'],
  orientation: ['portrait', 'landscape'],
};
const WINDOW_COLOURS = ['background_color', 'navigation_bar_background_color'];
const SRGB_HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const isMap = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;

/**
 * Returns { manifest, errors, warnings }. `manifest` is null when there is
 * any error. `errors` and `warnings` are strings that name the member.
 */
export function processManifest(json) {
  const errors = [];
  const warnings = [];
  const warn = (s) => warnings.push(s);
  const fail = (s) => errors.push(s);

  if (typeof json === 'string') {
    try { json = JSON.parse(json); } catch (e) { return { manifest: null, errors: [`not JSON: ${e.message}`], warnings }; }
  }
  if (!isMap(json)) return { manifest: null, errors: ['manifest is not a JSON object'], warnings };

  const m = {};

  // app_id: required string.
  if (typeof json.app_id === 'string' && json.app_id !== '') m.app_id = json.app_id;
  else fail('app_id: required, a non-empty string');

  // name (required), short_name, description: strings.
  if (typeof json.name === 'string' && json.name !== '') m.name = json.name;
  else fail('name: required, a non-empty string');
  for (const k of ['short_name', 'description']) {
    if (json[k] === undefined) continue;
    if (typeof json[k] === 'string') m[k] = json[k]; else warn(`${k}: not a string, ignored`);
  }

  // version: required map; code a number (<= 0 becomes 1), name a string.
  if (isMap(json.version)) {
    const v = {};
    if (typeof json.version.code === 'number' && Number.isFinite(json.version.code)) {
      v.code = json.version.code <= 0 ? 1 : Math.trunc(json.version.code);
    } else fail('version.code: required, a number');
    if (typeof json.version.name === 'string') v.name = json.version.name;
    else fail('version.name: required, a string');
    m.version = v;
  } else fail('version: required, an object with code and name');

  // platform_version: required map with numeric min_code.
  if (isMap(json.platform_version)) {
    const pv = json.platform_version;
    if (typeof pv.min_code === 'number' && Number.isFinite(pv.min_code)) {
      m.platform_version = { min_code: pv.min_code };
      if (typeof pv.target_code === 'number') m.platform_version.target_code = pv.target_code;
      else if (pv.target_code !== undefined) warn('platform_version.target_code: not a number, ignored');
      if (typeof pv.release_type === 'string') m.platform_version.release_type = pv.release_type;
      else if (pv.release_type !== undefined) warn('platform_version.release_type: not a string, ignored');
    } else fail('platform_version.min_code: required, a number');
  } else fail('platform_version: required, an object with min_code');

  // icons: required non-empty list of { src, sizes?, type?, label? }.
  if (Array.isArray(json.icons)) {
    m.icons = [];
    json.icons.forEach((icon, i) => {
      if (!isMap(icon) || typeof icon.src !== 'string' || icon.src === '') { warn(`icons[${i}]: no src, skipped`); return; }
      const out = { src: icon.src };
      for (const k of ['sizes', 'type', 'label', 'purpose']) if (typeof icon[k] === 'string') out[k] = icon[k];
      m.icons.push(out);
    });
    if (m.icons.length === 0) fail('icons: required, at least one icon with a src');
  } else fail('icons: required, a list');

  // pages: required non-empty list of package-relative route strings.
  if (Array.isArray(json.pages)) {
    m.pages = [];
    json.pages.forEach((p, i) => {
      if (typeof p !== 'string' || p === '') { warn(`pages[${i}]: not a non-empty string, skipped`); return; }
      if (!isPackageRelative(p)) { warn(`pages[${i}]: "${p}" is not a package-relative path, skipped`); return; }
      m.pages.push(p);
    });
    if (m.pages.length === 0) fail('pages: required, at least one page route');
  } else fail('pages: required, a list');

  // window: optional map; every member has a default.
  m.window = { ...WINDOW_DEFAULTS };
  if (json.window !== undefined) {
    if (!isMap(json.window)) warn('window: not an object, defaults used');
    else for (const [k, val] of Object.entries(json.window)) {
      if (!(k in WINDOW_DEFAULTS)) { warn(`window.${k}: unknown member, ignored`); continue; }
      const d = WINDOW_DEFAULTS[k];
      const okType = typeof val === typeof d
        && (typeof d !== 'number' || isNonNegInt(val))
        && (!WINDOW_ENUMS[k] || WINDOW_ENUMS[k].includes(val))
        && (!WINDOW_COLOURS.includes(k) || SRGB_HEX.test(val));
      if (okType) m.window[k] = val; else warn(`window.${k}: invalid value ${JSON.stringify(val)}, default used`);
    }
  }

  // widgets: optional list of { name, path, min_code? }.
  if (json.widgets !== undefined) {
    m.widgets = [];
    if (!Array.isArray(json.widgets)) warn('widgets: not a list, ignored');
    else json.widgets.forEach((w, i) => {
      if (!isMap(w) || typeof w.name !== 'string' || typeof w.path !== 'string' || !isPackageRelative(w.path)) {
        warn(`widgets[${i}]: needs string name and package-relative path, skipped`); return;
      }
      const out = { name: w.name, path: w.path };
      // The draft's example gives min_code as a string, its member table as a number. Accept both.
      if (typeof w.min_code === 'number') out.min_code = w.min_code;
      else if (typeof w.min_code === 'string' && /^\d+$/.test(w.min_code)) out.min_code = Number(w.min_code);
      m.widgets.push(out);
    });
  }

  // req_permissions: optional list of { name, reason? }. Never fatal.
  m.req_permissions = [];
  if (json.req_permissions !== undefined) {
    if (!Array.isArray(json.req_permissions)) warn('req_permissions: not a list, ignored');
    else json.req_permissions.forEach((p, i) => {
      if (!isMap(p) || typeof p.name !== 'string' || p.name === '') { warn(`req_permissions[${i}]: no name, skipped`); return; }
      const out = { name: p.name };
      if (typeof p.reason === 'string') out.reason = p.reason;
      else if (p.reason !== undefined) warn(`req_permissions[${i}].reason: not a string, dropped`);
      m.req_permissions.push(out);
    });
  }

  // dir, lang, color_scheme, device_type.
  if (json.dir !== undefined) {
    if (['ltr', 'rtl', 'auto'].includes(json.dir)) m.dir = json.dir; else warn('dir: not ltr, rtl or auto, ignored');
  }
  if (json.lang !== undefined) {
    if (typeof json.lang === 'string' && /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/.test(json.lang)) m.lang = json.lang;
    else warn('lang: not a BCP 47 tag, ignored');
  }
  if (json.color_scheme !== undefined) {
    if (['auto', 'light', 'dark'].includes(json.color_scheme)) m.color_scheme = json.color_scheme;
    else warn('color_scheme: not auto, light or dark, ignored');
  }
  if (json.device_type !== undefined) {
    if (Array.isArray(json.device_type) && json.device_type.every(s => typeof s === 'string')) m.device_type = [...json.device_type];
    else warn('device_type: not a list of strings, ignored');
  }

  for (const k of Object.keys(json)) {
    if (!KNOWN_MEMBERS.has(k)) warn(`${k}: not a MiniApp Manifest member, ignored`);
  }

  return { manifest: errors.length ? null : m, errors, warnings };
}

const KNOWN_MEMBERS = new Set(['app_id', 'name', 'short_name', 'description', 'version', 'platform_version',
  'icons', 'pages', 'window', 'widgets', 'req_permissions', 'dir', 'lang', 'color_scheme', 'device_type']);

/** A relative path with no scheme, no leading "/", and no ".." segment. */
export function isPackageRelative(p) {
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(p) || p.startsWith('/') || p.startsWith('\\')) return false;
  return !p.split('/').some(seg => seg === '..');
}
