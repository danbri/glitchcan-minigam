#!/usr/bin/env node
// Drives tools/game-mcp/server.mjs over stdio the way an MCP client does, and checks the answers.
//   node tools/game-mcp/test.mjs              (about 2 minutes: the city loads with its WebGL fallback)
//   RENDER=1 node tools/game-mcp/test.mjs     (also render_webgpu: needs `npm i --no-save webgpu`, 1-2 minutes more)
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srv = spawn(process.execPath, [path.join(here, 'server.mjs')], { stdio: ['pipe', 'pipe', 'inherit'] });
let buf = '', nextId = 1;
const waiting = new Map();
srv.stdout.setEncoding('utf8');
srv.stdout.on('data', (d) => {
  buf += d;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    waiting.get(msg.id)?.(msg); waiting.delete(msg.id);
  }
});
const rpc = (method, params) => new Promise((resolve) => {
  const id = nextId++;
  waiting.set(id, resolve);
  srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
});
const call = async (name, args = {}) => {
  const r = await rpc('tools/call', { name, arguments: args });
  if (r.error) throw new Error(`${name}: ${r.error.message}`);
  const res = r.result;
  const text = res.content.find((c) => c.type === 'text')?.text;
  return { isError: !!res.isError, content: res.content, value: text && !res.isError ? (() => { try { return JSON.parse(text); } catch { return text; } })() : text };
};
let failures = 0;
const pass = (m) => console.log('✔ ' + m);
const fail = (m) => { failures++; console.log('✖ ' + m); };
const check = (ok, good, bad) => (ok ? pass(good) : fail(bad));

try {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  check(init.result?.protocolVersion === '2025-06-18' && init.result?.capabilities?.tools,
    `initialize: ${init.result?.serverInfo?.name} speaks ${init.result?.protocolVersion}`, `initialize: ${JSON.stringify(init)}`);
  const list = await rpc('tools/list', {});
  const names = list.result.tools.map((t) => t.name);
  check(names.length >= 18 && list.result.tools.every((t) => t.inputSchema?.type === 'object'),
    `tools/list: ${names.length} tools (${names.join(', ')})`, `tools/list: ${JSON.stringify(names)}`);

  const noPage = await call('story_state');
  check(noPage.isError && /open_story/.test(noPage.value), 'a tool that needs a page says so (isError, names open_story)', `no page: ${JSON.stringify(noPage)}`);

  const open = await call('open_story', { story: 'drift-city/story/peraspera.fink.js' });
  check(!open.isError && open.value.file === 'story/peraspera.fink.js' && open.value.choices.length > 0,
    `open_story: ${open.value.file} at ${open.value.knot}, ${open.value.choices.length} choices`, `open_story: ${JSON.stringify(open)}`);

  const world = await call('world_state');
  check(!world.isError && world.value.where?.crs === 'IAU_2015:60600' && Array.isArray(world.value.readout) && world.value.renderer,
    `world_state (${world.value.renderer}): ${world.value.where?.lat?.toFixed?.(3)}°N ${world.value.where?.lon?.toFixed?.(3)}°E, looking at ${world.value.where?.view?.az}°; readout ${JSON.stringify(world.value.readout)}`,
    `world_state: ${JSON.stringify(world)}`);

  const places = await call('world_places');
  check(!places.isError && places.value.some((p) => p.id === 'conway_corner'), `world_places: ${places.value.length} places, Conway Corner among them`, `world_places: ${JSON.stringify(places).slice(0, 300)}`);
  const at = await call('world_goto', { place: 'conway_corner' });
  // headless runs the WebGL fallback, which only flies: the tool must say so rather than claim it arrived
  check(!at.isError && (at.value.renderer === 'webgpu' ? Math.abs(at.value.where.alt - 70) < 5 : /no visits/.test(at.value.note || '')),
    `world_goto conway_corner (${at.value.renderer}): ${at.value.note || `${at.value.where.alt} m up`}`, `world_goto: ${JSON.stringify(at)}`);
  const nowhere = await call('world_goto', { place: 'no_such_place' });
  check(nowhere.isError && /world_places/.test(nowhere.value), 'world_goto to an unknown place is an error that names world_places', `unknown place: ${JSON.stringify(nowhere)}`);

  const pick = await call('world_pick', { x: 0.5, y: 0.6 });
  check(!pick.isError && pick.value && /^(building|place|person|vehicle|ship):/.test(pick.value.id) && pick.value.actions?.length,
    `world_pick: ${pick.value?.kind} "${pick.value?.name}" (${pick.value?.id})`, `world_pick: ${JSON.stringify(pick)}`);

  const acts = await call('actions_list');
  const night = acts.value?.actions?.find((a) => /Time and weather › Night$/.test(a.path));
  check(!!night, `actions_list: ${acts.value?.actions?.length} actions, e.g. "${night?.path}"`, `actions_list: ${JSON.stringify(acts).slice(0, 300)}`);
  const ran = night ? await call('action_run', { id: night.id }) : null;
  const after = await call('actions_list');
  check(ran?.value?.ran && after.value.actions.find((a) => a.id === night.id)?.checked === true,
    'action_run: Night is set in the city, and the menu now shows it checked', `action_run: ${JSON.stringify({ ran, now: after.value.actions.find((a) => a.id === night?.id) })}`);

  const wm = await call('wm', { mode: 'full', pad: 'hidden' });
  check(wm.value?.mode === 'full' && wm.value?.pad === 'hidden', `wm: mode ${wm.value?.mode}, pad ${wm.value?.pad}`, `wm: ${JSON.stringify(wm)}`);

  const moved = await call('choose', { text: 'Cold Tap' });
  check(!moved.isError && moved.value.knot !== open.value.knot, `choose "Cold Tap": now at ${moved.value.knot}`, `choose: ${JSON.stringify(moved)}`);

  const tail = await call('bus_tail', { prefix: 'app.drift.', n: 5 });
  check(Array.isArray(tail.value) && tail.value.length > 0, `bus_tail app.drift.: ${tail.value.map((e) => e.topic).join(', ')}`, `bus_tail: ${JSON.stringify(tail)}`);

  const ev = await call('eval', { frame: 'city', expression: '__drift.NAV.mode' });
  check(typeof ev.value === 'string', `eval in the city: NAV.mode = ${ev.value}`, `eval: ${JSON.stringify(ev)}`);

  const shot = await call('screenshot');
  const img = shot.content.find((c) => c.type === 'image');
  check(img && Buffer.from(img.data, 'base64').subarray(1, 4).toString() === 'PNG', `screenshot: a PNG of ${Math.round(img.data.length * 0.75 / 1024)} kB`, 'screenshot: no PNG');

  const errs = await call('errors');
  check(Array.isArray(errs.value), `errors: ${errs.value.length} since the page opened`, `errors: ${JSON.stringify(errs)}`);

  if (process.env.RENDER) {
    const r = await call('render_webgpu', { place: 'conway_corner', width: 400, height: 250, frames: 40 });
    const ri = r.content.find((c) => c.type === 'image');
    check(ri && !r.isError, `render_webgpu: ${r.content.find((c) => c.type === 'text')?.text}`, `render_webgpu: ${JSON.stringify(r).slice(0, 400)}`);
  }
  const closed = await call('close');
  check(closed.value?.closed, 'close: the browser is closed', `close: ${JSON.stringify(closed)}`);
} catch (e) {
  fail('fatal: ' + (e?.stack || e));
} finally {
  srv.stdin.end();
  setTimeout(() => srv.kill(), 2000);
}
console.log(failures ? `\nGAME-MCP: ${failures} FAILURE(S)` : '\nGAME-MCP: PASS');
process.exitCode = failures ? 1 : 0;
