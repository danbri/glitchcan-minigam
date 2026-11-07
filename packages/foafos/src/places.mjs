// FoafPlaces: named places (waypoints, points of interest) kept in the person's pod.
//
// Each place is one small JSON-LD document, a schema.org Place, in the `places/` container
// of the pod chosen for apps:
//
//   places/greenland-dock.jsonld
//   {
//     "@context": { "@vocab": "https://schema.org/", "foafos": "<VOCAB>" },
//     "@type": "Place",
//     "identifier": "greenland-dock",
//     "name": "Greenland Dock",
//     "description": "Where the boats wait",
//     "geo": { "@type": "GeoCoordinates", "latitude": 51.4965, "longitude": -0.0331, "elevation": 2 },
//     "foafos:view": { "foafos:altitude": 600, "foafos:heading": 270, "foafos:pitch": 35 },
//     "dateCreated": "2026-11-07T17:00:00.000Z"
//   }
//
// latitude and longitude are WGS84 degrees; elevation is metres. The optional view is how
// to look at the place, as Moglob's fly_to takes it: altitude is the eye's height above the
// place in metres, heading is degrees clockwise from true north, and pitch is the look-down
// angle in degrees.
//
// The store reaches the pod only through `pod(verb, params)`, the shell's pods.invoke aimed at
// `places/`, so it gets the same audit, throttle and refusals as an app. The tools are
// offered by the shell (FoafTools.offer), not by Moglob: Moglob's frame cannot reach the pod.

export const PLACES_VOCAB = 'https://danbri.github.io/glitchcan-minigam/inklet/finkapp/apps/vocab#';
const CONTEXT = { '@vocab': 'https://schema.org/', foafos: PLACES_VOCAB };
const MAX_PLACES = 200;
const MAX_NAME = 120;
const MAX_TEXT = 2000;

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const round = (v, d) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);

/** A file name for a place: lower case letters, digits and "-", from its name. */
export function slugFor(name) {
  const s = String(name).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return s || 'place';
}

/** A place, checked. Throws with a reason a person can act on. */
export function checkPlace(p) {
  const name = String(p.name ?? '').trim();
  if (!name) throw new Error('A place needs a name.');
  if (name.length > MAX_NAME) throw new Error(`A place name may have up to ${MAX_NAME} characters.`);
  const lat = num(p.lat), lon = num(p.lon);
  if (lat === null || lon === null) throw new Error('A place needs lat and lon.');
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('lat: degrees from -90 to 90.');
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new Error('lon: degrees from -180 to 180.');
  const elevation = num(p.elevation);
  if (elevation !== null && !Number.isFinite(elevation)) throw new Error('elevation: metres, a number.');
  const v = p.view || {};
  const altitude = num(v.altitude), heading = num(v.heading), pitch = num(v.pitch);
  if (altitude !== null && !(Number.isFinite(altitude) && altitude >= 0 && altitude <= 4e7)) throw new Error('altitude: metres above the place, from 0.');
  if (heading !== null && !Number.isFinite(heading)) throw new Error('heading: degrees from true north.');
  if (pitch !== null && !(Number.isFinite(pitch) && pitch >= 0 && pitch <= 90)) throw new Error('pitch: the look-down angle, 0 to 90 degrees.');
  const view = {};
  if (altitude !== null) view.altitude = round(altitude, 1);
  if (heading !== null) view.heading = round(((heading % 360) + 360) % 360, 1);
  if (pitch !== null) view.pitch = round(pitch, 1);
  return {
    id: p.id ? String(p.id) : slugFor(name),
    name,
    description: String(p.description ?? '').slice(0, MAX_TEXT),
    lat: round(lat, 7), lon: round(lon, 7), elevation: round(elevation, 1),
    view: Object.keys(view).length ? view : null,
    created: p.created ? String(p.created) : null,
  };
}

/** The JSON-LD document for a checked place. */
export function placeDoc(p) {
  const geo = { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lon };
  if (p.elevation !== null) geo.elevation = p.elevation;
  const doc = { '@context': CONTEXT, '@type': 'Place', identifier: p.id, name: p.name };
  if (p.description) doc.description = p.description;
  doc.geo = geo;
  if (p.view) {
    doc['foafos:view'] = Object.fromEntries(Object.entries(p.view).map(([k, v]) => [`foafos:${k}`, v]));
  }
  doc.dateCreated = p.created;
  return doc;
}

/** A place from a document in the pod, or null if it is not one. */
export function parsePlace(text, id) {
  let d;
  try { d = JSON.parse(text); } catch { return null; }
  if (!d || typeof d !== 'object') return null;
  const geo = d.geo || {};
  const v = d['foafos:view'] || d.view || {};
  const pick = (k) => v[`foafos:${k}`] ?? v[k];
  try {
    return checkPlace({
      id, name: d.name, description: d.description, lat: geo.latitude, lon: geo.longitude, elevation: geo.elevation,
      view: { altitude: pick('altitude'), heading: pick('heading'), pitch: pick('pitch') }, created: d.dateCreated,
    });
  } catch { return null; }
}

/**
 * A place from Moglob's get_view: where the view looks (its target), and the view itself.
 * Model and globe answer differently, so each part is taken from what is there.
 */
export function placeFromView(view, { name, description } = {}) {
  const t = view?.target || {};
  const e = view?.eye || {};
  const lookDown = Number.isFinite(view?.pitch_deg) ? Math.min(90, Math.max(0, -view.pitch_deg)) : null;
  let altitude = null;
  if (Number.isFinite(e.height_m) && Number.isFinite(t.height_m)) altitude = e.height_m - t.height_m;
  else if (Number.isFinite(view?.range_m) && lookDown !== null) altitude = view.range_m * Math.sin(lookDown * Math.PI / 180);
  else if (Number.isFinite(e.above_ground_m)) altitude = e.above_ground_m;
  return checkPlace({
    name, description, lat: t.lat, lon: t.lon,
    elevation: Number.isFinite(t.ground_m) ? t.ground_m : Number.isFinite(t.height_m) ? t.height_m : null,
    view: { altitude: altitude !== null ? Math.max(0, altitude) : null, heading: view?.heading_deg ?? null, pitch: lookDown },
  });
}

const REASONS = {
  denied: 'No pod is chosen for apps. Choose one in System, under Pods.',
  'no-pod': 'No pod is chosen for apps. Choose one in System, under Pods.',
  offline: 'The pod is not connected. Connect it in System, under Pods.',
  locked: 'The pod is locked. Unlock your session first.',
  'needs-ok': 'The pod needs your OK. Open System, then Pods.',
  throttled: 'Too many pod calls in a minute. Try again soon.',
  conflict: 'That place changed in the pod meanwhile. Try again.',
};
const explain = (r) => REASONS[r.reason] || `The pod refused: ${r.reason}${r.status ? ` (${r.status})` : ''}.`;

export class FoafPlaces {
  /**
   * @param pod  async (verb, params) => result, as FoafPods.invoke for an owner whose
   *             grant is the `places/` container; paths here are relative to it.
   * @param now  () => Date, for tests
   */
  constructor({ pod, bus = null, now = () => new Date() }) {
    this.pod = pod;
    this.bus = bus;
    this.now = now;
    this._listeners = new Set();
  }

  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _changed(summary, data) {
    this.bus?.publish('places.changed', { summary, ...data });
    for (const fn of this._listeners) { try { fn(); } catch { /* a listener's problem */ } }
  }

  /** Every place, in name order. An empty or missing container is no places. */
  async list() {
    const r = await this.pod('pod.list', { path: '' });
    if (!r.ok) {
      if (r.reason === 'http' && r.status === 404) return [];
      throw new Error(explain(r));
    }
    const files = r.items.filter((it) => !it.container && it.path.endsWith('.jsonld')).slice(0, MAX_PLACES);
    const got = await Promise.all(files.map(async (it) => {
      const g = await this.pod('pod.get', { path: it.path });
      return g.ok ? parsePlace(g.body, it.path.slice(0, -'.jsonld'.length)) : null;
    }));
    return got.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** A place by its id, or by its name in any case. */
  async find(idOrName) {
    const key = String(idOrName ?? '').trim();
    if (!key) return null;
    const all = await this.list();
    return all.find((p) => p.id === key) || all.find((p) => p.name.toLowerCase() === key.toLowerCase()) || null;
  }

  /** Save a new place. A name already used gets a file of its own (name-2, name-3 …). */
  async save(place) {
    const p = checkPlace({ ...place, id: null, created: this.now().toISOString() });
    const base = p.id;
    for (let n = 1; n <= 50; n++) {
      p.id = n === 1 ? base : `${base}-${n}`;
      const r = await this.pod('pod.put', { path: `${p.id}.jsonld`, body: JSON.stringify(placeDoc(p), null, 2), contentType: 'application/ld+json', ifNoneMatch: true });
      if (r.ok) { this._changed(`Saved the place ${p.name}`, { id: p.id }); return p; }
      if (r.reason !== 'conflict') throw new Error(explain(r));
    }
    throw new Error(`There are too many places called ${p.name}.`);
  }

  /** Delete a place by id or name. */
  async delete(idOrName) {
    const p = await this.find(idOrName);
    if (!p) throw new Error(`No place called ${idOrName}.`);
    const r = await this.pod('pod.delete', { path: `${p.id}.jsonld` });
    if (!r.ok) throw new Error(explain(r));
    this._changed(`Deleted the place ${p.name}`, { id: p.id });
    return p;
  }
}

/**
 * The tools for FoafTools.offer: places.list, places.save, places.delete, places.fly_to.
 *
 * @param places  a FoafPlaces
 * @param tools   the FoafTools, to reach Moglob's get_view, fly_to and go_to
 * @param moglob  Moglob's app id
 * @param openApp (id) => void: opens Moglob when a fly_to finds it closed; null to refuse
 * @param waitMs  how long to wait for Moglob to offer its tools once opened
 */
export function placesTools({ places, tools, moglob = 'docklands', openApp = null, waitMs = 30000 }) {
  const moglobTools = () => tools.find(moglob)?.tools || [];
  const ready = async () => {
    if (moglobTools().some((t) => t.name === 'fly_to' || t.name === 'go_to')) return true;
    if (!openApp) return false;
    openApp(moglob);
    return new Promise((resolve) => {
      let stop = null;
      const timer = setTimeout(() => { stop?.(); resolve(false); }, waitMs);
      stop = tools.subscribe(() => {
        if (moglobTools().some((t) => t.name === 'fly_to' || t.name === 'go_to')) { clearTimeout(timer); stop(); resolve(true); }
      });
    });
  };
  const callMoglob = async (name, args, caller) => {
    const r = await tools.call(moglob, name, args, { caller });
    if (!r.ok) throw new Error(r.reason === 'tool-error' ? `Moglob: ${r.error}` : `Moglob ${name}: ${r.reason}`);
    return r.value;
  };
  const PLACE = { type: 'string', description: 'A place id or name, from places.list' };
  return [
    {
      name: 'list',
      description: 'Your saved places (waypoints) from your pod: id, name, description, lat, lon, elevation in metres, and the view to fly to (altitude in metres above the place, heading, pitch). In name order.',
      inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Only places whose name or description contains this text' } } },
      readOnly: true,
      handler: async ({ query } = {}) => {
        const q = String(query || '').trim().toLowerCase();
        const all = await places.list();
        return { places: q ? all.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(q)) : all };
      },
    },
    {
      name: 'save',
      description: 'Save a named place to your pod. Give lat and lon, or leave them out to save where Moglob is looking now (Moglob must be open).',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'What to call the place' },
          description: { type: 'string', description: 'A note about it' },
          lat: { type: 'number', description: 'Latitude, WGS84 degrees' },
          lon: { type: 'number', description: 'Longitude, WGS84 degrees' },
          elevation: { type: 'number', description: 'Ground height at the place, metres' },
          altitude: { type: 'number', description: 'Eye height above the place for the view, metres' },
          heading: { type: 'number', description: 'View direction, degrees clockwise from true north' },
          pitch: { type: 'number', description: 'Look-down angle of the view, degrees (0 to 90)' },
        },
        required: ['name'],
      },
      handler: async (a = {}, { caller } = {}) => {
        let place;
        if (a.lat == null && a.lon == null) {
          if (!moglobTools().some((t) => t.name === 'get_view')) throw new Error('Give lat and lon, or open Moglob to save where it is looking.');
          place = placeFromView(await callMoglob('get_view', {}, caller), a);
        } else {
          place = { name: a.name, description: a.description, lat: a.lat, lon: a.lon, elevation: a.elevation,
            view: { altitude: a.altitude, heading: a.heading, pitch: a.pitch } };
        }
        return { saved: await places.save(place) };
      },
    },
    {
      name: 'delete',
      description: 'Delete one of your saved places from your pod.',
      inputSchema: { type: 'object', properties: { place: PLACE }, required: ['place'] },
      handler: async ({ place }) => ({ deleted: await places.delete(place) }),
    },
    {
      name: 'fly_to',
      description: 'Fly Moglob\'s 3D view to one of your saved places, opening Moglob if it is closed. Uses the place\'s saved view when it has one.',
      inputSchema: {
        type: 'object',
        properties: { place: PLACE, duration_s: { type: 'number', description: 'Length of the journey, seconds (2 to 600)' } },
        required: ['place'],
      },
      handler: async ({ place, duration_s: duration } = {}, { caller } = {}) => {
        const p = await places.find(place);
        if (!p) throw new Error(`No place called ${place}.`);
        if (!await ready()) throw new Error('Moglob is not open, and did not open.');
        const at = { lon: p.lon, lat: p.lat };
        if (p.view?.altitude != null) at.alt_m = p.view.altitude;
        if (p.view?.heading != null) at.heading_deg = p.view.heading;
        if (p.view?.pitch != null) at.pitch_deg = p.view.pitch;
        // Moglob's go_to wants a look-down angle of at least 2 degrees.
        const hasFly = moglobTools().some((t) => t.name === 'fly_to');
        const value = hasFly
          ? await callMoglob('fly_to', { ...at, ...(duration != null ? { duration_s: Number(duration) } : {}) }, caller)
          : await callMoglob('go_to', { ...at, ...(at.pitch_deg != null ? { pitch_deg: Math.max(2, at.pitch_deg) } : {}), animate: true }, caller);
        return { place: p, used: hasFly ? 'fly_to' : 'go_to', moglob: value };
      },
    },
  ];
}
