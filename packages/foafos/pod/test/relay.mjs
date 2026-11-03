// The XMPP relay for the pod tests: Prosody, or Factoidal's Lean server.
//
//   const relay = await startRelay({ accounts: [['pod', 'podpass']], origin: 'http://127.0.0.1:18765' })
//   relay.xmpp   // service URL for @xmpp/client (the pod)
//   relay.ws     // RFC 7395 WebSocket URL for the browser
//   relay.stop()
//
// RELAY=prosody (the default when prosody is on PATH) or RELAY=factoidal with
// FACTOIDAL_BIN=<factoidal-core>/npm/factoidal/bin/factoidal.mjs, from a build that
// has `xmpp-serve --ws-port`. With Factoidal both listeners run TLS with a throwaway
// certificate: @xmpp/client (the pod) has SCRAM-SHA-1 and PLAIN and uses PLAIN only
// over TLS, and Factoidal offers SCRAM-SHA-256 and PLAIN. Callers then launch the
// browser with --ignore-certificate-errors (`relay.insecureTls`).
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const listening = (port) => new Promise((resolve) => {
  const s = connect(port, '127.0.0.1');
  s.on('connect', () => { s.destroy(); resolve(true); });
  s.on('error', () => resolve(false));
});

export function relayName() {
  if (process.env.RELAY) return process.env.RELAY;
  try { execFileSync('which', ['prosody'], { stdio: 'ignore' }); return 'prosody'; } catch { return 'factoidal'; }
}

export async function startRelay({ accounts, origin, c2sPort = 15222, wsPort = 15280 }) {
  const name = relayName();
  const data = mkdtempSync(join(tmpdir(), `${name}-lws-`));
  let child;
  let xmpp = `xmpp://127.0.0.1:${c2sPort}`;
  let ws = `ws://127.0.0.1:${wsPort}/xmpp-websocket`;
  let insecureTls = false;
  if (name === 'prosody') {
    // The config pins 15222 and 15280.
    const cfg = join(here, 'prosody.cfg.lua');
    const env = { ...process.env, PROSODY_DATA: data };
    for (const [u, p] of accounts) execFileSync('prosodyctl', ['--config', cfg, 'register', u, 'localhost', p], { env, stdio: 'ignore' });
    child = spawn('prosody', ['--config', cfg, '-F'], { env, stdio: ['ignore', 'ignore', 'pipe'] });
  } else if (name === 'factoidal') {
    const bin = process.env.FACTOIDAL_BIN;
    if (!bin || !existsSync(bin)) throw new Error('RELAY=factoidal needs FACTOIDAL_BIN=<factoidal-core>/npm/factoidal/bin/factoidal.mjs');
    writeFileSync(join(data, 'accounts'), accounts.map(([u, p]) => `${u}:${p}\n`).join(''));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '1',
      '-subj', '/CN=localhost', '-keyout', join(data, 'key.pem'), '-out', join(data, 'cert.pem')], { stdio: 'ignore' });
    // The certificate is throwaway and self-signed; this process does not verify it.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    xmpp = `xmpps://127.0.0.1:${c2sPort}`;
    ws = `wss://127.0.0.1:${wsPort}/xmpp-websocket`;
    insecureTls = true;
    child = spawn(process.execPath, [bin, 'xmpp-serve', data, '--domain', 'localhost', '--port', String(c2sPort),
      '--cert', join(data, 'cert.pem'), '--key', join(data, 'key.pem'),
      '--ws-port', String(wsPort), '--ws-path', '/xmpp-websocket', '--ws-origin', origin],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  } else {
    throw new Error(`unknown RELAY=${name}`);
  }
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d; });
  for (let i = 0; i < 80; i++) {
    if (await listening(wsPort) && await listening(c2sPort)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  return { name, xmpp, ws, insecureTls, stderr: () => stderr, stop: () => { try { child.kill(); } catch { /* gone */ } } };
}
