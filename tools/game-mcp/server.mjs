#!/usr/bin/env node
// game-mcp — an MCP server (stdio) for exploring and testing the game during development.
//
// One browser stays open between calls, and the game's own test hooks become tools: open a story, read and choose,
// ask the city where the camera is, pick in the world, run the window menu's actions, read the bus, take a
// screenshot, render a city view with WebGPU in software. Registered in the repo's .mcp.json as "glitchcan".
//
//   node tools/game-mcp/server.mjs          (Claude Code starts it; it speaks JSON-RPC on stdin/stdout)
//   node tools/game-mcp/test.mjs            (drives it the way a client does, and checks the answers)
//
// Why it is built this way, and the limits: the game-mcp skill (tools/game-mcp/skills/game-mcp/SKILL.md).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PREFIX = '/glitchcan-minigam';          // the path the site has on GitHub Pages
const log = (...a) => process.stderr.write(`[game-mcp] ${a.join(' ')}\n`);

// ── the page server: the repo at /glitchcan-minigam/, with CORS (sandboxed frames have an opaque origin) ─────────
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4',
  '.wasm': 'application/wasm', '.ply': 'application/octet-stream', '.bin': 'application/octet-stream',
  '.wgsl': 'text/plain', '.txt': 'text/plain', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
let site = null;
function startSite() {
  if (site) return site;
  site = new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent((req.url || '/').split('?')[0]);
      if (!url.startsWith(PREFIX + '/')) { res.writeHead(404); res.end(); return; }
      let file = path.join(REPO, url.slice(PREFIX.length));
      if (!file.startsWith(REPO)) { res.writeHead(403); res.end(); return; }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404, { 'Access-Control-Allow-Origin': '*' }); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${srv.address().port}`));
  });
  return site;
}

// ── the browser: one Chromium, one page at a time ────────────────────────────────────────────────────────────────
const { chromium } = createRequire(path.join(REPO, 'package.json'))('@playwright/test');
function chromePath() {
  if (process.env.GAME_MCP_CHROME) return process.env.GAME_MCP_CHROME;
  const root = '/opt/pw-browsers';
  try {
    const dirs = fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1]);
    for (const d of dirs) { const p = path.join(root, d, 'chrome-linux/chrome'); if (fs.existsSync(p)) return p; }
  } catch (e) { /* not this container */ }
  return undefined;                                  // Playwright's own browser, where there is one
}
const S = { browser: null, context: null, page: null, errors: [], opened: null };
async function browser() {
  if (!S.browser) {
    S.browser = await chromium.launch({ headless: true, executablePath: chromePath(),
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
             '--autoplay-policy=no-user-gesture-required'] });
  }
  return S.browser;
}
function needPage() { if (!S.page) throw new Error('no page is open: call open_story (or open_app) first'); return S.page; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function frameOf(which, ms = 60000) {
  const page = needPage();
  if (which === 'shell') return page.mainFrame();
  const re = which === 'runner' ? /apps\/storyrunner\/index\.html/ : which === 'city' ? /drift-city\/dist\/city\.html/ : null;
  if (!re) throw new Error(`unknown frame "${which}": shell, runner or city`);
  for (let t = 0; t < ms; t += 250) {
    const f = page.frames().find((x) => re.test(x.url()));
    if (f) return f;
    await wait(250);
  }
  throw new Error(`the ${which} frame is not open`);
}

async function openPage(query, { width = 390, height = 844, touch = true } = {}) {
  const base = await startSite();
  if (S.context) await S.context.close().catch(() => {});
  S.errors = [];
  S.context = await (await browser()).newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  S.page = await S.context.newPage();
  S.page.on('pageerror', (e) => S.errors.push({ at: Date.now(), kind: 'pageerror', text: String(e).slice(0, 400) }));
  S.page.on('console', (m) => { if (m.type() === 'error') S.errors.push({ at: Date.now(), kind: 'console', text: m.text().slice(0, 400), url: m.location()?.url }); });
  await S.page.goto(`${base}${PREFIX}/inklet/finkapp/${query}`);
  await S.page.waitForFunction(() => !!window.FoafOS?.bus, null, { timeout: 30000 });
  // a ring of the last 300 bus events, without the heartbeat and the SDK tap
  await S.page.evaluate(() => {
    window.__mcpBus = [];
    FoafOS.bus.subscribe('*', (e) => {
      if (/^sys\.(cluster|sdk)\./.test(e.topic)) return;
      let data = e.data;
      try { data = JSON.parse(JSON.stringify(e.data, (k, v) => (typeof v === 'string' && v.length > 300 ? v.slice(0, 300) + '…' : v))); } catch (err) { data = String(e.data); }
      window.__mcpBus.push({ topic: e.topic, ts: e.ts, data });
      if (window.__mcpBus.length > 300) window.__mcpBus.shift();
    }, { replay: true });
  });
  S.opened = { query, width, height, touch };
}

// ── what the tools read ─────────────────────────────────────────────────────────────────────────────────────────
async function storyState(lines = 8) {
  const r = await frameOf('runner');
  return r.evaluate((n) => {
    const s = window.__storyrunner?.state || {};
    return { ready: !!window.__storyrunner?.ready?.(), file: (s.storyUrl || '').split('/').slice(-2).join('/'),
      knot: s.knot || null, depth: window.__storyrunner?.depth?.() ?? null, world: s.world || null,
      ended: !!s.ended, status: s.status || '', choices: s.choices || [],
      prose: (s.prose || []).slice(-n).map((p) => (typeof p === 'string' ? p : p.text)) };
  }, lines);
}
async function waitPlayable(ms = 60000) {
  const r = await frameOf('runner', ms);
  await r.waitForFunction(() => window.__storyrunner?.ready?.()
    && (window.__storyrunner.state.choices.length > 0 || window.__storyrunner.state.ended), null, { timeout: ms });
}
async function cityFrame(waitWorld = true) {
  const c = await frameOf('city', 90000);
  if (waitWorld) await c.waitForFunction(() => !!window.__drift?.titanWhere && (window.__drift.TALE?.worldBeats || 0) > 0
    || (window.__drift?.titanWhere && !window.__drift.host?.().world), null, { timeout: 90000 });
  return c;
}
function flattenActions(list, trail = []) {
  const out = [];
  for (const it of list || []) {
    const p = [...trail, it.label];
    if (Array.isArray(it.items)) out.push(...flattenActions(it.items, p));
    else out.push({ id: it.id, path: p.join(' › '), ...(typeof it.checked === 'boolean' ? { checked: it.checked } : {}) });
  }
  return out;
}

// ── a PNG from raw RGB, for the WebGPU render (no image library needed) ─────────────────────────────────────────
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngFromRGB(w, h, rgb) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ── the tools ───────────────────────────────────────────────────────────────────────────────────────────────────
const json = (v) => ({ content: [{ type: 'text', text: JSON.stringify(v, null, 1) }] });
const image = (buf, note) => ({ content: [{ type: 'image', data: buf.toString('base64'), mimeType: 'image/png' },
  ...(note ? [{ type: 'text', text: note }] : [])] });
const FRAME = { type: 'string', enum: ['shell', 'runner', 'city'] };

const TOOLS = [
  { name: 'open_story', description: 'Open the foafos shell on a story (a path from the repo root, e.g. inklet/toc.fink.js or drift-city/story/peraspera.fink.js) in a fresh page, and wait until it can be played. Returns the story state. Default viewport is a phone (390x844, touch).',
    inputSchema: { type: 'object', properties: { story: { type: 'string' }, width: { type: 'number' }, height: { type: 'number' }, touch: { type: 'boolean' }, query: { type: 'string', description: 'extra query, e.g. &skin=calm' } } },
    run: async (a) => { await openPage(`?story=${PREFIX}/${a.story || 'inklet/toc.fink.js'}${a.query || ''}`, a); await waitPlayable(); return json(await storyState()); } },
  { name: 'open_app', description: 'Open the foafos shell with one app (its registry id, e.g. drift, robbin, edot, sheets) or with no story (app omitted: ?player=none).',
    inputSchema: { type: 'object', properties: { app: { type: 'string' }, root: { type: 'string' }, width: { type: 'number' }, height: { type: 'number' }, touch: { type: 'boolean' } } },
    run: async (a) => { await openPage(`?${a.app ? `app=${encodeURIComponent(a.app)}` : 'player=none'}${a.root ? `&root=${encodeURIComponent(a.root)}` : ''}`, a); await wait(2500);
      return json(await needPage().evaluate(() => ({ nodes: [...FoafOS.apps.nodes.values()].map((n) => ({ id: n.id, app: n.appId, label: n.label })) }))); } },
  { name: 'story_state', description: 'The story now: file, knot, choices, the last lines of prose, status, world, depth.',
    inputSchema: { type: 'object', properties: { lines: { type: 'number' } } }, run: async (a) => json(await storyState(a.lines || 8)) },
  { name: 'choose', description: 'Choose a story choice by index or by text it contains; wait for the story to move; return the new state.',
    inputSchema: { type: 'object', properties: { index: { type: 'number' }, text: { type: 'string' } } },
    run: async (a) => {
      const r = await frameOf('runner');
      const before = await storyState(1);
      const i = typeof a.index === 'number' ? a.index : before.choices.findIndex((c) => c.toLowerCase().includes(String(a.text || '').toLowerCase()));
      if (i < 0 || i >= before.choices.length) throw new Error(`no such choice: ${a.text ?? a.index}; choices are ${JSON.stringify(before.choices)}`);
      await r.evaluate((n) => window.__storyrunner.choose(n), i);
      const key = JSON.stringify([before.file, before.knot, before.choices]);
      for (let t = 0; t < 20000; t += 250) {
        await wait(250);
        const now = await storyState(1).catch(() => null);          // a link can replace the frame's story
        if (now && now.ready && JSON.stringify([now.file, now.knot, now.choices]) !== key) break;
      }
      await waitPlayable(30000).catch(() => {});
      return json(await storyState());
    } },
  { name: 'story_goto', description: 'Divert the story to a knot (test hook).', inputSchema: { type: 'object', properties: { knot: { type: 'string' } }, required: ['knot'] },
    run: async (a) => { const r = await frameOf('runner'); await r.evaluate((k) => window.__storyrunner.goto(k), a.knot); await wait(400); return json(await storyState()); } },
  { name: 'story_var', description: 'Read a story VAR, or set it when value is given (test hook).', inputSchema: { type: 'object', properties: { name: { type: 'string' }, value: {} }, required: ['name'] },
    run: async (a) => { const r = await frameOf('runner'); if ('value' in a) await r.evaluate(([n, v]) => window.__storyrunner.setVar(n, v), [a.name, a.value]);
      return json({ name: a.name, value: await r.evaluate((n) => window.__storyrunner.varOf(n), a.name) }); } },
  { name: 'world_state', description: 'The world beside the story (Drift City): where the camera is on Titan (IAU_2015:60600, with the view vector), the mode, the scene and place, the readout the shell shows, and the current selection. Waits for the city to load (up to 90 s the first time).',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const c = await cityFrame();
      const city = await c.evaluate(() => ({ renderer: __drift.device() ? 'webgpu' : 'webgl-fallback', where: __drift.titanWhere(),
        mode: __drift.NAV.mode, scene: __drift.TALE.scene || null, place: __drift.TALE.place || null }));
      // the readout is sent on the city's display tick: give the first one a moment
      await needPage().waitForFunction(() => FoafOS.bus.retained('app.drift.status').length > 0, null, { timeout: 8000 }).catch(() => {});
      const shell = await needPage().evaluate(() => ({ readout: FoafOS.bus.retained('app.drift.status')[0]?.data?.items?.map((i) => i.value) || null,
        selection: FoafOS.bus.retained('app.drift.selection')[0]?.data?.entity || null }));
      return json({ ...city, ...shell });
    } },
  { name: 'world_places', description: 'The city\'s named places (ids and names), for world_goto.', inputSchema: { type: 'object', properties: {} },
    run: async () => { const c = await cityFrame(false); return json(await c.evaluate(() => __drift.places())); } },
  { name: 'world_goto', description: 'Put the camera at one of the city\'s places at once (hopPlace), e.g. conway_corner.', inputSchema: { type: 'object', properties: { place: { type: 'string' } }, required: ['place'] },
    run: async (a) => {
      const c = await cityFrame(false);
      const known = await c.evaluate((p) => __drift.places().some((x) => x.id === p), a.place);
      if (!known) throw new Error(`no place "${a.place}": see world_places`);
      await c.evaluate((p) => __drift.hopPlace(p), a.place);
      await wait(800);
      const r = await c.evaluate(() => ({ renderer: __drift.device() ? 'webgpu' : 'webgl-fallback', mode: __drift.NAV.mode, where: __drift.titanWhere() }));
      // The WebGL fallback (what this headless browser runs) only flies: it has no visits, so the camera does not
      // stay at a place. Said, not hidden; render_webgpu draws the place with the real shaders.
      if (r.renderer !== 'webgpu') r.note = 'The WebGL fallback has no visits: the camera does not stay at the place. Use render_webgpu with this place to see it.';
      return json(r);
    } },
  { name: 'world_pick', description: 'Pick in the city view at x, y (fractions of the view, 0..1), as a tap does. Returns the selection the shell shows (id, kind, name, Titan position, actions).',
    inputSchema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
    run: async (a) => {
      const c = await cityFrame(false);
      await needPage().evaluate(() => FoafOS.bus.publish('app.drift.selection', { entity: null }, { retain: true }));
      await c.evaluate(([x, y]) => __drift.pickGo(x * innerWidth, y * innerHeight, false), [a.x, a.y]);
      await wait(800);
      return json(await needPage().evaluate(() => FoafOS.bus.retained('app.drift.selection')[0]?.data?.entity || null));
    } },
  { name: 'actions_list', description: 'The playing app\'s own actions as the window menu offers them (flattened: id, path, checked), and the selection\'s actions.',
    inputSchema: { type: 'object', properties: {} },
    run: async () => { const d = await needPage().evaluate(() => ({ app: window.FinkWM?._appActions || [], sel: FoafOS.bus.retained('app.drift.selection')[0]?.data?.entity?.actions || [] }));
      return json({ actions: flattenActions(d.app), selection: d.sel }); } },
  { name: 'action_run', description: 'Run one of the playing app\'s actions by id (from actions_list), as the window menu does.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    run: async (a) => { const ok = await needPage().evaluate((id) => window.FinkMinigames?.runAction?.(id) || false, a.id); await wait(600); return json({ ran: !!ok }); } },
  { name: 'wm', description: 'The game window: set its mode (full, split, pip) and/or the on-screen pad (show, faint, hidden, off); returns both.',
    inputSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['full', 'split', 'pip'] }, pad: { type: 'string', enum: ['show', 'faint', 'hidden', 'off'] } } },
    run: async (a) => json(await needPage().evaluate(({ mode, pad }) => {
      if (mode && window.FinkWM?.active) FinkWM.setMode(mode);
      if (pad) FoafOS.pad?.setMode(pad);
      return { active: !!window.FinkWM?.active, mode: window.FinkWM?.mode || null, pad: FoafOS.pad?.mode?.() || null };
    }, a)) },
  { name: 'bus_tail', description: 'The last bus events (topic, time, data), optionally only topics starting with a prefix (e.g. activity., app.drift., story.).',
    inputSchema: { type: 'object', properties: { prefix: { type: 'string' }, n: { type: 'number' } } },
    run: async (a) => json(await needPage().evaluate(({ prefix, n }) => (window.__mcpBus || []).filter((e) => !prefix || e.topic.startsWith(prefix)).slice(-(n || 20)), a)) },
  { name: 'errors', description: 'Page errors and console errors since the page opened (all frames).', inputSchema: { type: 'object', properties: {} },
    run: async () => json(S.errors.slice(-50)) },
  { name: 'screenshot', description: 'A PNG of the page as the reader sees it (the city renders with its WebGL fallback in this browser).',
    inputSchema: { type: 'object', properties: {} }, run: async () => image(await needPage().screenshot()) },
  { name: 'eval', description: 'Evaluate a JavaScript expression in the shell, the story runner or the city frame and return the result as JSON. A development power tool: the hooks are window.FoafOS, FinkWM, FinkMinigames (shell), window.__storyrunner (runner), window.__drift (city).',
    inputSchema: { type: 'object', properties: { expression: { type: 'string' }, frame: FRAME }, required: ['expression'] },
    run: async (a) => { const f = await frameOf(a.frame || 'shell'); return json(await f.evaluate((src) => { const v = (0, eval)(src); return v instanceof Promise ? v.then((x) => x) : v; }, a.expression)); } },
  { name: 'render_webgpu', description: 'Render a city view with the real WebGPU shaders in software (Node Dawn on Mesa lavapipe; drift-city/tests/dawn-run.mjs) and return it as a PNG. place: a place id (e.g. conway_corner); tod: 0 day, 1 dusk, 2 night, 3 snow. About 1-2 minutes. Needs `npm i --no-save webgpu` and mesa-vulkan-drivers.',
    inputSchema: { type: 'object', properties: { place: { type: 'string' }, tod: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' }, frames: { type: 'number' } } },
    run: async (a) => {
      const out = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'game-mcp-'));
      const env = { ...process.env, OUT: out, W: String(a.width || 800), H: String(a.height || 500), DPR: '1', FRAMES: String(a.frames || 60) };
      if (a.place) env.HOP = `place:${a.place}`;
      if (typeof a.tod === 'number') env.TOD = String(a.tod);
      const res = await new Promise((resolve) => {
        const p = spawn(process.execPath, ['tests/dawn-run.mjs'], { cwd: path.join(REPO, 'drift-city'), env });
        let errText = '';
        p.stderr.on('data', (d) => { errText += d; });
        const t = setTimeout(() => p.kill('SIGKILL'), 600000);
        p.on('close', (code) => { clearTimeout(t); resolve({ code, errText }); });
      });
      const metaFile = path.join(out, 'frame.json');
      if (!fs.existsSync(metaFile)) throw new Error(`the render failed (exit ${res.code}): ${res.errText.slice(-600)}`);
      const m = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      const png = pngFromRGB(m.w, m.h, fs.readFileSync(path.join(out, 'frame.rgb')));
      fs.rmSync(out, { recursive: true, force: true });
      return image(png, `WebGPU in software (Node Dawn), ${m.w}x${m.h}${a.place ? `, at ${a.place}` : ''}`);
    } },
  { name: 'close', description: 'Close the page and the browser.', inputSchema: { type: 'object', properties: {} },
    run: async () => { await S.browser?.close().catch(() => {}); Object.assign(S, { browser: null, context: null, page: null, opened: null }); return json({ closed: true }); } },
];

// ── MCP over stdio: newline-delimited JSON-RPC 2.0 ──────────────────────────────────────────────────────────────
const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined || id === null) return;                  // a notification: nothing to answer
  try {
    if (method === 'initialize') {
      const want = params?.protocolVersion;
      return send({ jsonrpc: '2.0', id, result: { protocolVersion: VERSIONS.includes(want) ? want : VERSIONS[0],
        capabilities: { tools: {} }, serverInfo: { name: 'glitchcan-game', version: '1.0.0' },
        instructions: 'Tools to open the foafos shell on a story or app, play it, and inspect the Drift City world (coordinates in IAU_2015:60600), the window menu actions, the bus, errors and screenshots. Start with open_story.' } });
    }
    if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
    if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) } });
    if (method === 'tools/call') {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return send({ jsonrpc: '2.0', id, error: { code: -32602, message: `unknown tool: ${params?.name}` } });
      try { return send({ jsonrpc: '2.0', id, result: await tool.run(params.arguments || {}) }); }
      catch (e) { return send({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: String(e?.message || e).slice(0, 2000) }] } }); }
    }
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
  } catch (e) {
    send({ jsonrpc: '2.0', id, error: { code: -32603, message: String(e?.message || e) } });
  }
}
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch (e) { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); continue; }
    handle(msg);
  }
});
const quit = async () => { await S.browser?.close().catch(() => {}); process.exit(0); };
process.stdin.on('end', quit);
process.on('SIGTERM', quit);
log('ready');
