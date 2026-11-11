// Tools that apps offer through foafos.tools (app-sdk.js): Notes, Files and Calendar, called
// through the shell's FoafTools as the person and as an account with a grant to look.
// Headless, against `foafos-stack start shell`, on the built-in pod. No window appears.
//   CHROMIUM_PATH=... node e2e-app-tools.mjs
//   FOAFOS_URL=http://localhost:8091/glitchcan-minigam/inklet/finkapp/ to test another checkout
// The server must send Access-Control-Allow-Origin: Calendar runs in a sandboxed frame (origin
// "null") and loads ES modules, which need CORS; without it Calendar never offers its tools
// ("no-app"). Plain `python3 -m http.server` sends none; foafos-stack and GitHub Pages do.
import { chromium } from 'playwright';

const { CHROMIUM_PATH } = process.env;
const BASE = process.env.FOAFOS_URL || 'http://localhost:8080/glitchcan-minigam/inklet/finkapp/';
let failed = 0;
const check = (ok, what, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${ok || detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`); if (!ok) failed++; };

const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => { if (!/serviceWorker/.test(e.message)) errors.push(e.message); });
  await page.goto(`${BASE}?root=all&player=none`);
  const probe = await page.evaluate(async () => { const r = await fetch(new URL('../../magpie/edot/calendar/js/calendar-tools.js', location.href)); return { ok: r.ok, cors: r.headers.get('access-control-allow-origin') }; });
  if (probe.ok && !probe.cors) console.log(`NOTE ${BASE} sends no Access-Control-Allow-Origin, so sandboxed Calendar cannot load its modules and its checks will fail with "no-app". Serve with CORS.`);
  await page.waitForFunction(() => window.FoafOS?.launchApp, null, { timeout: 30000 });
  for (const id of ['podnotes', 'files', 'calendar']) await page.evaluate((i) => FoafOS.launchApp(i), id);
  await page.waitForFunction(() => ['podnotes', 'files', 'calendar'].every((id) => FoafOS.tools.find(id)?.tools.length), null, { timeout: 30000 }).catch(() => {});
  const offered = Object.fromEntries(await page.evaluate(() => FoafOS.tools.list().map((p) => [p.id, p.tools.map((t) => t.name + (t.readOnly ? '' : '*'))])));
  check(String(offered.podnotes) === 'list_notes,read_note,add_note*', 'Notes offers list_notes, read_note and add_note (writes)', offered.podnotes);
  check(String(offered.files) === 'list_folder,search,read_file', 'Files offers list_folder, search and read_file, all read-only', offered.files);
  check(String(offered.calendar) === 'list_calendars,list_events,add_event*', 'Calendar offers list_calendars, list_events and add_event (writes)', offered.calendar);

  const r = await page.evaluate(async () => {
    const { PERSON, accountCaller } = await import('../../packages/foafos/src/tool-grants.mjs');
    const me = (a, t, x) => FoafOS.tools.call(a, t, x, { caller: PERSON });
    const as = (caller, a, t, x = {}) => FoafOS.tools.call(a, t, x, { caller });
    const name = `e2e-${Date.now()}`;
    const out = { name };
    out.add = await me('podnotes', 'add_note', { name, text: 'hello from a tool' });
    out.again = await me('podnotes', 'add_note', { name, text: 'twice' });
    out.list = await me('podnotes', 'list_notes', {});
    out.read = await me('podnotes', 'read_note', { name });
    out.search = await me('files', 'search', { query: name });
    out.file = await me('files', 'read_file', { path: `apps/podnotes/notes/${name}.txt` });
    out.folder = await me('files', 'list_folder', { path: 'apps/podnotes/notes' });
    out.dotfile = await me('files', 'read_file', { path: 'apps/podnotes/.secret.txt' });
    out.dotfolder = await me('files', 'read_file', { path: '.config/x.txt' });
    out.event = await me('calendar', 'add_event', { title: name, start: '2026-11-08T10:00:00Z', id: name });
    out.retry = await me('calendar', 'add_event', { title: name, start: '2026-11-08T10:00:00Z', id: name });
    out.events = await me('calendar', 'list_events', { from: '2026-11-08', to: '2026-11-09', query: name });
    // An account with a grant to look may read and may not write.
    const test2 = accountCaller('test2@localhost');
    out.none = await as(test2, 'podnotes', 'list_notes');
    FoafOS.grants.grant('test2@localhost', 'podnotes');
    out.look = await as(test2, 'podnotes', 'list_notes');
    out.write = await as(test2, 'podnotes', 'add_note', { name: `${name}-x`, text: 'no' });
    FoafOS.grants.revoke('test2@localhost');
    return out;
  });
  check(r.add.ok && r.add.value.saved === r.name, 'add_note writes a note', r.add);
  check(!r.again.ok && /exists already/.test(r.again.error), 'add_note will not overwrite a note', r.again);
  check(r.list.ok && r.list.value.notes.includes(r.name), 'list_notes lists it', r.list);
  check(r.read.ok && r.read.value.text === 'hello from a tool', 'read_note reads it', r.read);
  check(r.search.ok && r.search.value.found.some((f) => f.path === `apps/podnotes/notes/${r.name}.txt`), 'Files search finds it', r.search);
  check(r.file.ok && r.file.value.text === 'hello from a tool' && /^text\/plain/.test(r.file.value.contentType), 'Files read_file reads it', r.file);
  check(r.search.ok && Array.isArray(r.search.value.skipped) && r.search.value.complete === true, 'Files search reports what it skipped, and is complete', r.search.value);
  check(!r.dotfile.ok && /hidden/.test(r.dotfile.error) && !r.dotfolder.ok && /hidden/.test(r.dotfolder.error), 'Files read_file refuses hidden files and folders', [r.dotfile, r.dotfolder]);
  check(r.folder.ok && r.folder.value.items.some((i) => i.path.endsWith(`${r.name}.txt`) && !i.folder), 'Files list_folder lists it', r.folder);
  check(r.event.ok && r.event.value.added.calendar, 'add_event adds an event', r.event);
  check(r.retry.ok && r.retry.value.existed === true && r.retry.value.added.id === r.event.value?.added.id, 'add_event with the same id again returns the event, adds nothing', r.retry);
  check(r.events.ok && r.events.value.events.length === 1 && r.events.value.events[0].start === '2026-11-08T10:00:00.000Z', 'list_events finds it', r.events);
  check(r.none.reason === 'not-granted', 'an account with no grant is refused', r.none);
  check(r.look.ok, 'an account with a grant to look may list', r.look);
  check(r.write.reason === 'not-granted', 'an account with a grant to look may not write', r.write);
  check(!errors.length, 'no page errors', errors);
} finally {
  await browser.close();
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
