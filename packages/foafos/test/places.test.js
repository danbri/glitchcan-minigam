import test from 'node:test';
import assert from 'node:assert/strict';
import { FoafPlaces, placesTools, checkPlace, placeDoc, parsePlace, placeFromView, slugFor } from '../src/places.mjs';
import { FoafTools } from '../src/tools.mjs';
import { PERSON, BROWSER_AGENT, accountCaller } from '../src/tool-grants.mjs';

// The pod as pods.invoke answers it, for one container: paths are relative to places/.
function fakePod({ refuse = null, getsBeforeThrottle = Infinity } = {}) {
  const files = new Map();
  const calls = [];
  let gets = 0;
  const pod = async (verb, params) => {
    calls.push({ verb, ...params });
    if (refuse) return { ok: false, reason: refuse };
    if (verb === 'pod.get' && ++gets > getsBeforeThrottle) return { ok: false, reason: 'throttled' };
    if (verb === 'pod.list') return files.size ? { ok: true, status: 200, items: [...files.keys()].map((path) => ({ path, container: false })) } : { ok: false, reason: 'http', status: 404 };
    if (verb === 'pod.get') return files.has(params.path) ? { ok: true, status: 200, body: files.get(params.path), contentType: 'application/ld+json' } : { ok: false, reason: 'http', status: 404 };
    if (verb === 'pod.put') {
      if (params.ifNoneMatch && files.has(params.path)) return { ok: false, reason: 'conflict', status: 412 };
      files.set(params.path, params.body);
      return { ok: true, status: 201 };
    }
    if (verb === 'pod.delete') return files.delete(params.path) ? { ok: true, status: 204 } : { ok: false, reason: 'http', status: 404 };
    return { ok: false, reason: 'unknown-verb' };
  };
  return { pod, files, calls };
}
const NOW = () => new Date('2026-11-07T17:00:00Z');

// Moglob's frame, answering get_view, fly_to and go_to (or a smaller set).
function moglob(tools, names = ['get_view', 'fly_to', 'go_to']) {
  const seen = [];
  const VIEW = { eye: { lon: -0.0331, lat: 51.4905, height_m: 610 }, target: { lon: -0.0331, lat: 51.4965, height_m: 10, ground_m: 2 }, heading_deg: 0, pitch_deg: -45, range_m: 850 };
  const p = tools.attach({ id: 'docklands', label: 'Moglob', source: {}, post: (m) => {
    seen.push(m);
    queueMicrotask(() => tools.receive(p, { type: 'webmcp.result', id: m.id, ok: true, value: m.name === 'get_view' ? VIEW : { flying: true } }));
  } });
  tools.receive(p, { type: 'webmcp.tools', tools: names.map((name) => ({ name, readOnly: name === 'get_view' })) });
  return seen;
}

test('a place is checked, and its document is a schema.org Place', () => {
  const p = checkPlace({ name: 'Greenland Dock', lat: 51.4965, lon: -0.0331, elevation: 2, view: { altitude: 600, heading: -90, pitch: 35 }, created: '2026-11-07T17:00:00.000Z' });
  assert.equal(p.id, 'greenland-dock');
  assert.deepEqual(p.view, { altitude: 600, heading: 270, pitch: 35 });
  const doc = placeDoc(p);
  assert.equal(doc['@type'], 'Place');
  assert.equal(doc['@context']['@vocab'], 'https://schema.org/');
  assert.deepEqual(doc.geo, { '@type': 'GeoCoordinates', latitude: 51.4965, longitude: -0.0331, elevation: 2 });
  assert.deepEqual(doc['foafos:view'], { 'foafos:altitude': 600, 'foafos:heading': 270, 'foafos:pitch': 35 });
  assert.equal(doc.dateCreated, '2026-11-07T17:00:00.000Z');
  assert.deepEqual(parsePlace(JSON.stringify(doc), 'greenland-dock'), { ...p, description: '' });
  assert.equal(parsePlace('not json', 'x'), null);
  assert.equal(parsePlace('{"name":"no geo"}', 'x'), null);
  for (const bad of [{ lat: 1, lon: 1 }, { name: 'x', lat: 91, lon: 0 }, { name: 'x', lat: 0, lon: 181 }, { name: 'x' },
    { name: 'x', lat: 0, lon: 0, view: { pitch: 120 } }, { name: 'x', lat: 0, lon: 0, view: { altitude: -5 } }]) {
    assert.throws(() => checkPlace(bad));
  }
  assert.equal(slugFor('Café Ünter/../Dock!'), 'cafe-unter-dock');
  // Letters in any script stay, so the id still says which place it is.
  assert.equal(slugFor('東京駅'), '東京駅');
  assert.equal(slugFor('Москва Сити'), 'москва-сити');
  assert.equal(slugFor('がっこう'), 'がっこう');   // kana voicing marks survive
  assert.equal(slugFor('नई दिल्ली'), 'नई-दिल्ली');   // so do Devanagari vowel signs
  assert.equal(slugFor('Ὀδυσσεύς'), 'οδυσσευς');
  assert.equal(Array.from(slugFor('東'.repeat(80))).length, 40);   // 120 bytes of UTF-8
  assert.equal(slugFor('a'.repeat(80)).length, 60);
  // Variation selectors and stray marks never make an invisible id.
  assert.match(slugFor('❤️'), /^place-[0-9a-f]{8}$/);
  assert.equal(slugFor('🏠️ Home'), 'home');
  // No letters or digits at all: a short hash, the same for the same name.
  assert.match(slugFor('***'), /^place-[0-9a-f]{8}$/);
  assert.equal(slugFor('🏠🌊'), slugFor('🏠🌊'));
  assert.notEqual(slugFor('🏠🌊'), slugFor('***'));
});

test('a place from Moglob\'s view: where it looks, how high the eye is, and the look-down angle', () => {
  const model = placeFromView({ eye: { height_m: 610 }, target: { lon: -0.03, lat: 51.5, height_m: 10, ground_m: 2 }, heading_deg: 12.3, pitch_deg: -45 }, { name: 'Here' });
  assert.deepEqual([model.lat, model.lon, model.elevation], [51.5, -0.03, 2]);
  assert.deepEqual(model.view, { altitude: 608, heading: 12.3, pitch: 45 });   // above the ground, as Moglob's alt_m
  const globe = placeFromView({ eye: { height_m: 9000, above_ground_m: 8800 }, target: { lon: 139.7, lat: 35.7 }, range_m: 10000, heading_deg: 0, pitch_deg: -30 }, { name: 'Tokyo' });
  assert.equal(globe.elevation, null);
  assert.equal(globe.view.altitude, 5000);
  assert.equal(globe.view.pitch, 30);
});

test('the store saves, lists in name order, finds by id or name, and deletes', async () => {
  const { pod, files } = fakePod();
  const places = new FoafPlaces({ pod, now: NOW });
  assert.deepEqual(await places.list(), []);
  await places.save({ name: 'Zed', lat: 1, lon: 2 });
  const a = await places.save({ name: 'Alpha', lat: 3, lon: 4, description: 'first' });
  assert.equal(a.created, '2026-11-07T17:00:00.000Z');
  assert.deepEqual([...files.keys()].sort(), ['alpha.jsonld', 'zed.jsonld']);
  assert.equal(JSON.parse(files.get('alpha.jsonld'))['@type'], 'Place');
  assert.deepEqual((await places.list()).map((p) => p.name), ['Alpha', 'Zed']);
  assert.equal((await places.find('ALPHA')).id, 'alpha');
  assert.equal((await places.find('zed')).name, 'Zed');
  // The same name again is a new place, not an overwrite.
  const again = await places.save({ name: 'Alpha', lat: 5, lon: 6 });
  assert.equal(again.id, 'alpha-2');
  assert.equal(JSON.parse(files.get('alpha.jsonld')).geo.latitude, 3);
  await places.delete('alpha-2');
  assert.deepEqual([...files.keys()].sort(), ['alpha.jsonld', 'zed.jsonld']);
  await assert.rejects(places.delete('nowhere'), /No place called nowhere/);
});

test('a refusal from the pod is a reason a person can act on', async () => {
  const places = new FoafPlaces({ pod: fakePod({ refuse: 'denied' }).pod });
  await assert.rejects(places.list(), /No pod is chosen for apps/);
  await assert.rejects(places.save({ name: 'x', lat: 0, lon: 0 }), /No pod is chosen for apps/);
});

test('the shell offers places.list, save, delete and fly_to; only list is read-only', async () => {
  const tools = new FoafTools();
  const places = new FoafPlaces({ pod: fakePod().pod, now: NOW });
  tools.offer({ id: 'places', label: 'Places', tools: placesTools({ places, tools }) });
  const [p] = tools.list();
  assert.equal(p.name, 'places');
  assert.deepEqual(p.tools.map((t) => [t.name, t.readOnly]), [['list', true], ['save', false], ['delete', false], ['fly_to', false]]);
});

test('save from coordinates or from Moglob\'s view; list; delete', async () => {
  const tools = new FoafTools();
  const places = new FoafPlaces({ pod: fakePod().pod, now: NOW });
  tools.offer({ id: 'places', label: 'Places', tools: placesTools({ places, tools }) });
  const me = (t, a) => tools.call('places', t, a, { caller: PERSON });
  const noMoglob = await me('save', { name: 'Here' });
  assert.equal(noMoglob.ok, false);
  assert.match(noMoglob.error, /open Moglob/);
  const seen = moglob(tools);
  const fromView = await me('save', { name: 'Docks view', description: 'from above' });
  assert.equal(fromView.ok, true, JSON.stringify(fromView));
  assert.deepEqual(fromView.value.saved.view, { altitude: 608, heading: 0, pitch: 45 });
  assert.equal(seen[0].name, 'get_view');
  const given = await me('save', { name: 'Tokyo', lat: 35.68, lon: 139.76, altitude: 2000 });
  assert.equal(given.value.saved.lat, 35.68);
  const listed = await me('list', {});
  assert.deepEqual(listed.value.places.map((x) => x.name), ['Docks view', 'Tokyo']);
  assert.deepEqual((await me('list', { query: 'above' })).value.places.map((x) => x.name), ['Docks view']);
  assert.equal((await me('delete', { place: 'tokyo' })).value.deleted.name, 'Tokyo');
  assert.match((await me('delete', { place: 'tokyo' })).error, /No place called tokyo/);
});

test('fly_to calls Moglob\'s fly_to with the saved view, or go_to when Moglob has no fly_to', async () => {
  const tools = new FoafTools();
  const places = new FoafPlaces({ pod: fakePod().pod, now: NOW });
  tools.offer({ id: 'places', label: 'Places', tools: placesTools({ places, tools }) });
  await places.save({ name: 'Dock', lat: 51.5, lon: -0.03, view: { altitude: 600, heading: 90, pitch: 1 } });
  const seen = moglob(tools);
  const r = await tools.call('places', 'fly_to', { place: 'dock', duration_s: 8 }, { caller: PERSON });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.value.used, 'fly_to');
  assert.deepEqual(seen.at(-1).args, { lon: -0.03, lat: 51.5, alt_m: 600, heading_deg: 90, pitch_deg: 1, duration_s: 8 });
  // An older Moglob: go_to, with a look-down angle it accepts.
  const older = new FoafTools();
  older.offer({ id: 'places', label: 'Places', tools: placesTools({ places, tools: older }) });
  const seen2 = moglob(older, ['get_view', 'go_to']);
  const r2 = await older.call('places', 'fly_to', { place: 'Dock' }, { caller: PERSON });
  assert.equal(r2.value.used, 'go_to');
  assert.deepEqual(seen2.at(-1).args, { lon: -0.03, lat: 51.5, alt_m: 600, heading_deg: 90, pitch_deg: 2, animate: true });
});

test('fly_to opens Moglob when it is closed, and says so when it never offers its tools', async () => {
  const tools = new FoafTools();
  const places = new FoafPlaces({ pod: fakePod().pod, now: NOW });
  await places.save({ name: 'Dock', lat: 51.5, lon: -0.03 });
  const opened = [];
  tools.offer({ id: 'places', label: 'Places', tools: placesTools({ places, tools, waitMs: 50, openApp: (id) => { opened.push(id); setTimeout(() => moglob(tools), 5); } }) });
  const r = await tools.call('places', 'fly_to', { place: 'Dock' }, { caller: PERSON });
  assert.deepEqual(opened, ['docklands']);
  assert.equal(r.ok, true, JSON.stringify(r));
  const lonely = new FoafTools();
  lonely.offer({ id: 'places', label: 'Places', tools: placesTools({ places, tools: lonely, waitMs: 20, openApp: () => {} }) });
  assert.match((await lonely.call('places', 'fly_to', { place: 'Dock' }, { caller: PERSON })).error, /Moglob is not open/);
});

test('grants: an agent may list but not save; an account flies only with Moglob\'s grant too', async () => {
  const tools = new FoafTools();
  tools.grants.grant('browser-agent', '*');
  const places = new FoafPlaces({ pod: fakePod().pod, now: NOW });
  tools.offer({ id: 'places', label: 'Places', tools: placesTools({ places, tools }) });
  moglob(tools);
  await places.save({ name: 'Dock', lat: 51.5, lon: -0.03 });
  assert.equal((await tools.call('places', 'list', {}, { caller: BROWSER_AGENT })).ok, true);
  assert.equal((await tools.call('places', 'save', { name: 'x', lat: 0, lon: 0 }, { caller: BROWSER_AGENT })).reason, 'not-granted');
  const test2 = accountCaller('test2@localhost');
  tools.grants.grant('test2@localhost', 'places', { tools: ['fly_to'] });
  const r = await tools.call('places', 'fly_to', { place: 'Dock' }, { caller: test2 });
  assert.equal(r.ok, false);
  assert.match(r.error, /Moglob fly_to: not-granted/);
  tools.grants.grant('test2@localhost', 'docklands', { tools: ['fly_to'] });
  assert.equal((await tools.call('places', 'fly_to', { place: 'Dock' }, { caller: test2 })).ok, true);
});

test('a place that cannot be read is an error, never left out; a file that is not a place is', async () => {
  const fp = fakePod({ getsBeforeThrottle: 2 });
  const places = new FoafPlaces({ pod: fp.pod, now: NOW });
  for (const n of ['a', 'b', 'c']) fp.files.set(`${n}.jsonld`, JSON.stringify(placeDoc(checkPlace({ name: n, lat: 0, lon: 0 }))));
  await assert.rejects(places.list(), /Too many pod calls/);
  const ok = fakePod();
  ok.files.set('junk.jsonld', '{"name":"no geo"}');
  ok.files.set('a.jsonld', JSON.stringify(placeDoc(checkPlace({ name: 'a', lat: 0, lon: 0 }))));
  assert.deepEqual((await new FoafPlaces({ pod: ok.pod }).list()).map((p) => p.id), ['a']);
});

test('the pod is read once; the store\'s own writes keep the list; fresh reads it again', async () => {
  const fp = fakePod();
  const places = new FoafPlaces({ pod: fp.pod, now: NOW });
  await places.save({ name: 'One', lat: 0, lon: 0 });
  await places.list();
  const reads = () => fp.calls.filter((c) => c.verb !== 'pod.put' && c.verb !== 'pod.delete').length;
  const before = reads();
  await places.save({ name: 'Two', lat: 1, lon: 1 });
  await places.find('two');
  await places.delete('one');
  assert.deepEqual((await places.list()).map((p) => p.id), ['two']);
  assert.equal(reads(), before);
  fp.files.set('elsewhere.jsonld', JSON.stringify(placeDoc(checkPlace({ name: 'Elsewhere', lat: 2, lon: 2 }))));
  assert.deepEqual((await places.list({ fresh: true })).map((p) => p.id), ['elsewhere', 'two']);
});

test('a name two places share must be said by id', async () => {
  const places = new FoafPlaces({ pod: fakePod().pod, now: NOW });
  await places.save({ name: 'Dock', lat: 0, lon: 0 });
  await places.save({ name: 'Dock', lat: 1, lon: 1 });
  // An id is exact; a name in another case may be either.
  await assert.rejects(places.delete('DOCK'), /2 places are called DOCK\. Say which by id: dock, dock-2/);
  assert.equal((await places.delete('dock-2')).lat, 1);
  assert.equal((await places.delete('Dock')).lat, 0);
});

test('fly_to fails at once when Moglob cannot be opened; a frame cannot take the shell tools\' id', async () => {
  const tools = new FoafTools();
  const places = new FoafPlaces({ pod: fakePod().pod, now: NOW });
  await places.save({ name: 'Dock', lat: 0, lon: 0 });
  tools.offer({ id: 'places', label: 'Places', tools: placesTools({ places, tools, waitMs: 60000, openApp: () => false }) });
  const t0 = Date.now();
  assert.match((await tools.call('places', 'fly_to', { place: 'Dock' }, { caller: PERSON })).error, /Moglob is not open/);
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(tools.attach({ id: 'places', label: 'Impostor', source: {}, post() {} }), null);
  assert.equal(tools.find('places').label, 'Places');
});
