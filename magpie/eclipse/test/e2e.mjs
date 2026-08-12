/**
 * e2e.mjs — headless check of the eclipse guide.
 *
 * Run:  node magpie/eclipse/test/e2e.mjs [--shots]
 *
 * It starts a static server on the repository root, opens the app in a
 * phone-sized Chromium, and checks the things that would make the guide
 * wrong or useless:
 *
 *   - no console errors
 *   - the safety gate appears first
 *   - the computed London times match Astronomy Engine to the minute
 *   - the coverage badge and the countdown are filled in, not "--"
 *   - every tab opens and draws something on its canvas
 *   - the scrubber moves the sky
 *
 * The times are not compared against hard-coded strings, because the
 * app must stay right if the place changes. They are compared against a
 * second, independent call to the library in Node.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const APP = '/magpie/eclipse/index.html';
const WANT_SHOTS = process.argv.includes('--shots');
const SHOT_DIR = path.join(HERE, 'shots');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json'
};

function serve() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let file = path.join(ROOT, decodeURIComponent(url.pathname));
      if (file.endsWith('/')) file += 'index.html';
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch (err) {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const { server, port } = await serve();
  const base = `http://127.0.0.1:${port}`;

  // The independent answer, computed in Node from the same library.
  let expected = null;
  {
    // The vendored file is a UMD bundle. Given no module and no define,
    // it assigns itself to the global object, so give it one.
    const src = await readFile(path.join(HERE, '../vendor/astronomy.browser.min.js'), 'utf8');
    const sandbox = vm.createContext({});
    vm.runInContext('var window = this, self = this;', sandbox);
    vm.runInContext(src, sandbox);
    const A = sandbox.Astronomy;
    if (!A) throw new Error('the vendored library did not expose Astronomy');
    // Dates must be made inside the context, or they are not Dates to it.
    const info = vm.runInContext(
      'Astronomy.SearchLocalSolarEclipse(new Date("2026-08-11T00:00:00Z"),' +
      ' new Astronomy.Observer(51.5074, -0.1278, 11))', sandbox);
    expected = {
      first: new Date(info.partial_begin.time.date.getTime()),
      peak: new Date(info.peak.time.date.getTime()),
      last: new Date(info.partial_end.time.date.getTime()),
      obscuration: info.obscuration
    };
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },      // iPhone-ish
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Europe/London',
    locale: 'en-GB'
  });
  const page = await context.newPage();

  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(base + APP, { waitUntil: 'networkidle' });

  // 1. The safety gate is the first thing.
  const gateVisible = await page.isVisible('#gate');
  check('safety gate shows first', gateVisible);
  const gateText = await page.textContent('#gate-title');
  check('gate carries the one rule', /never look/i.test(gateText || ''), gateText);

  await page.click('#gate-ok');
  await page.waitForTimeout(400);
  check('gate closes on tap', !(await page.isVisible('#gate')));

  // 2. The times agree with an independent run of the library.
  const shown = await page.$$eval('#times li', (rows) => rows.map((r) => ({
    name: r.querySelector('.t-name').textContent,
    when: r.querySelector('.t-when').textContent
  })));
  check('four times are listed', shown.length === 4, JSON.stringify(shown));

  const asLondon = (d) => d.toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false
  });
  const wantFirst = asLondon(expected.first);
  const wantPeak = asLondon(expected.peak);
  const wantLast = asLondon(expected.last);
  check('first contact time is right', shown[0] && shown[0].when === wantFirst,
    `page ${shown[0] && shown[0].when} vs library ${wantFirst}`);
  check('maximum time is right', shown[1] && shown[1].when === wantPeak,
    `page ${shown[1] && shown[1].when} vs library ${wantPeak}`);
  check('last contact time is right', shown[2] && shown[2].when === wantLast,
    `page ${shown[2] && shown[2].when} vs library ${wantLast}`);

  const fine = await page.textContent('#fineprint');
  const wantPct = Math.round(expected.obscuration * 100);
  check('peak coverage per cent is right', fine.includes(`${wantPct} per cent`),
    `expected ${wantPct}: ${fine}`);

  // 3. Live readouts are filled in.
  const clock = await page.textContent('#count-clock');
  check('countdown is not empty', clock.trim() !== '--:--:--' && clock.trim().length > 0, clock);
  const badge = await page.textContent('#sky-badge');
  check('coverage badge is filled', /%|down/.test(badge), badge);

  // 4. Every canvas draws something.
  const drew = async (sel) => page.evaluate((s) => {
    const c = document.querySelector(s);
    if (!c || !c.width) return false;
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 400) if (d[i] > 0) return true;
    return false;
  }, sel);

  check('sky canvas has pixels', await drew('#sky'));

  const tabs = [
    ['look', ['#compass']],
    ['safe', ['#pinhole', '#dapple']],
    ['why', ['#why']],
    ['spot', []]
  ];
  for (const [name, canvases] of tabs) {
    await page.click(`#tab-${name}`);
    await page.waitForTimeout(350);
    check(`tab ${name} opens`, await page.isVisible(`#screen-${name}`));
    for (const sel of canvases) {
      check(`tab ${name}: ${sel} draws`, await drew(sel));
    }
    if (WANT_SHOTS) {
      await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true });
    }
  }

  // 5. The look screen gives a real direction, not a placeholder.
  await page.click('#tab-look');
  await page.waitForTimeout(200);
  const answer = await page.textContent('#look-answer');
  check('direction is a compass word',
    /^Look (north|south|east|west|north east|north west|south east|south west)$/.test(answer.trim()),
    answer);

  // 6. The scrubber changes the sky.
  await page.click('#tab-now');
  await page.waitForTimeout(300);
  const before = await page.textContent('#sky-badge');
  await page.$eval('#scrub', (el) => {
    el.value = '500';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(350);
  const after = await page.textContent('#sky-badge');
  check('scrubbing changes the sky', before !== after, `${before} -> ${after}`);
  const scrubbedStatus = await page.textContent('#status');
  check('scrubbing says it is a preview', /Back to now/.test(scrubbedStatus), scrubbedStatus);

  await page.click('#now-btn');
  await page.waitForTimeout(250);
  check('back to now works', (await page.textContent('#scrub-time')).trim() === 'now');

  if (WANT_SHOTS) {
    await page.screenshot({ path: path.join(SHOT_DIR, 'now.png'), fullPage: true });
  }

  // 7. A different place changes the numbers.
  await page.click('#place-btn');
  await page.waitForTimeout(200);
  await page.click('#places button:has-text("Reykjavik")');
  await page.waitForTimeout(500);
  const icelandFine = await page.textContent('#fineprint');
  check('changing the place changes the sums',
    icelandFine.includes('Reykjavik') && !icelandFine.includes(`${wantPct} per cent`),
    icelandFine.slice(0, 90));

  // 8. No console errors anywhere in that journey.
  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('failed: ' + failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
