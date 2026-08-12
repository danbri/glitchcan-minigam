#!/usr/bin/env node
/* sprite-bake.mjs — manufacture roamer sprite sheets from dbdb2's own
   rotoscope rigs. The game IS the sprite factory: ?bake=1 poses one
   rig in isolation against chroma magenta, an ortho camera frames a
   2.4-unit cell, and this tool walks 8 viewer bearings x 4 gait
   phases per character, chroma-keys the frames, and packs an atlas
   (rows = bearings, cols = phases) + sprites.json manifest.

   Output: magpie/dbdb/sprites/<kind>.png (512x1024, 128px cells)
   Usage:  node magpie/dbdb/tools/sprite-bake.mjs
*/
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(ROOT, 'magpie/dbdb/sprites');
const PORT = +(process.env.PORT || 8961);
const CELL = 128, BEARINGS = 8, PHASES = 4;

/* the cast — explicit outfits so bakes are reproducible.
   hero: the ACTUAL makeHuman rig (Ducky on the shoulder), baked
   finer — 8 gait phases at 192px cells — for the playable sprite.
   Pass kind names as argv to bake a subset: node sprite-bake.mjs hero */
const KINDS = {
  walker1: { shirt: 0x2c6e8a, trouser: 0x3a3a55, hair: 0x2a1c10, skin: 0xd9a06b },
  walker2: { shirt: 0x8a3a2c, trouser: 0x2e3a2e, hair: 0x101010, skin: 0xb97a4e, bun: 1 },
  walker3: { shirt: 0x557a3a, trouser: 0x44341f, hair: 0x5a3a1a, skin: 0xe0b58a, mous: 1 },
  zombie:  { shirt: 0x4a4438, trouser: 0x33382e, hair: 0x222a1c, skin: 0x86a05a, zombie: true },
  /* the hero gait family: two WALK variants (alternated per stride at
     runtime, so steps never repeat exactly) and a RUN, each 32 frames
     from a 4x-supersampled 1024px source at 224px cells, folded 16x2
     banks -> 3584x3584 atlases (three of them: quality over VRAM,
     the field HUD will arbitrate). */
  hero:    { hero: 'A',   phases: 32, cell: 224, grid: 16, src: 512 },
  hero2:   { hero: 'B',   phases: 32, cell: 224, grid: 16, src: 512 },
  herorun: { hero: 'run', phases: 32, cell: 224, grid: 16, src: 512 },
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});
await new Promise(r => srv.listen(PORT, r));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true,
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await browser.newPage({ viewport: { width: 512, height: 512 } });
pg.on('pageerror', e => console.log('PAGEERR', e.message));
await pg.goto(`http://localhost:${PORT}/magpie/dbdb/dbdb2.html?mini&crt=0&bake=1`);
await pg.waitForFunction(() => window.__jsd, null, { timeout: 90000 });
await pg.addStyleTag({ content: 'body>div:not(#stage),body>button,body>pre{display:none!important}' });
await pg.waitForTimeout(1500);

/* compositor page: chroma-key + atlas assembly */
const comp = await browser.newPage({ viewport: { width: 512, height: 512 } });

const only = process.argv.slice(2);
for (const [kind, opts] of Object.entries(KINDS)) {
  if (only.length && !only.includes(kind)) continue;
  const PH = opts.phases || PHASES, CE = opts.cell || CELL;
  const GRID = opts.grid || PH, SRC = opts.src || 512;
  await pg.setViewportSize({ width: SRC, height: SRC });
  const spawnOpts = { shirt: opts.shirt, trouser: opts.trouser, hair: opts.hair,
    skin: opts.skin, mous: opts.mous, bun: opts.bun, hero: opts.hero };
  await pg.evaluate(o => __jsd.bakeSpawn(o), spawnOpts);
  const cells = [];
  for (let b = 0; b < BEARINGS; b++) {
    for (let ph = 0; ph < PH; ph++) {
      await pg.evaluate(([bear, g, k]) => __jsd.bakeFrame(bear, g, k),
        [b * 45, ph * 2 * Math.PI / PH,
         opts.hero ? ({A:'hero',B:'heroB',run:'herorun'})[opts.hero]
                   : (opts.zombie ? 'zombie' : 'walk')]);
      await pg.waitForTimeout(140);
      const buf = await pg.screenshot();
      cells.push(buf.toString('base64'));
      process.stdout.write('.');
    }
  }
  /* assemble: key out magenta, downscale into the atlas grid */
  const durl = await comp.evaluate(async ([cellsB64, CELL2, BE, PH, GRID2, SRC2]) => {
    const banks = PH / GRID2;
    const cv = document.createElement('canvas');
    cv.width = CELL2 * GRID2; cv.height = CELL2 * BE * banks;
    const g = cv.getContext('2d');
    for (let i = 0; i < cellsB64.length; i++) {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej;
        img.src = 'data:image/png;base64,' + cellsB64[i]; });
      const c2 = document.createElement('canvas'); c2.width = c2.height = SRC2;
      const g2 = c2.getContext('2d');
      g2.drawImage(img, 0, 0);
      const d = g2.getImageData(0, 0, SRC2, SRC2);
      for (let px = 0; px < SRC2 * SRC2; px++) {
        const r = d.data[px * 4], gg = d.data[px * 4 + 1], bl = d.data[px * 4 + 2];
        if (r > 160 && bl > 160 && gg < 120) d.data[px * 4 + 3] = 0;   // the magenta void
      }
      g2.putImageData(d, 0, 0);
      const b = Math.floor(i / PH), ph2 = i % PH;
      const col = ph2 % GRID2, row = b * banks + Math.floor(ph2 / GRID2);
      g.drawImage(c2, col * CELL2, row * CELL2, CELL2, CELL2);
    }
    return cv.toDataURL('image/png');
  }, [cells, CE, BEARINGS, PH, GRID, SRC]);
  fs.writeFileSync(path.join(OUT, kind + '.png'),
    Buffer.from(durl.split(',')[1], 'base64'));
  console.log('\n✓', kind, '→ sprites/' + kind + '.png');
}
fs.writeFileSync(path.join(OUT, 'sprites.json'), JSON.stringify({
  cell: CELL, bearings: BEARINGS, phases: PHASES,
  kinds: Object.keys(KINDS),
  /* per-kind overrides; absent kind -> the top-level defaults */
  meta: Object.fromEntries(Object.entries(KINDS).map(([k, o]) =>
    [k, { phases: o.phases || PHASES, cell: o.cell || CELL,
          grid: o.grid || o.phases || PHASES }])),
  note: 'baked from dbdb2 rotoscope rigs (tools/sprite-bake.mjs); rows=viewer bearing (0=front, +45 steps), cols=gait phase',
}, null, 2));
await browser.close(); srv.close();
console.log('done →', OUT);
