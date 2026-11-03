#!/usr/bin/env node
/**
 * Minimal XMPP WebSocket -> TCP proxy for the xmpp-pane demo.
 *
 * Browsers can only speak WebSocket (RFC 7395) or BOSH. Many XMPP servers only
 * expose c2s TCP on 5222. This proxy accepts Strophe's WebSocket connection,
 * opens a TCP stream to the target server, negotiates STARTTLS itself and
 * relays everything else (SASL, bind, stanzas) unchanged.
 *
 * It is NOT an open relay: only domains listed in XMPP_DOMAINS are reachable.
 *
 * Env:
 *   PORT                  listen port (default 5281)
 *   XMPP_DOMAINS          comma list: "example.org" or "example.org=host:port"
 *                         (default "localhost=127.0.0.1:5222")
 *   XMPP_TLS_INSECURE=1   accept self-signed server certificates
 *   XMPP_ALLOW_PLAINTEXT=1  allow servers that do not offer STARTTLS
 *   ALLOWED_ORIGINS       comma list of browser origins (default: any)
 *   STATIC_DIR            directory to serve over HTTP (default ../demo)
 *   XMPP_PROXY_DEBUG=1    log frames (SASL payloads are redacted)
 */
import http from 'node:http'
import net from 'node:net'
import tls from 'node:tls'
import dns from 'node:dns/promises'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { Parser, escapeXMLText } from '@xmpp/xml'
import {
  CLOSE_FRAME, NS_TLS, STREAM_END,
  isClose, isOpen, openFrame, parseFrame, streamHeader, toFrame
} from './framing.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 5281)
const WS_PATH = '/xmpp-websocket'
const TLS_INSECURE = process.env.XMPP_TLS_INSECURE === '1'
const ALLOW_PLAINTEXT = process.env.XMPP_ALLOW_PLAINTEXT === '1'
const DEBUG = process.env.XMPP_PROXY_DEBUG === '1'
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || path.join(here, '..', 'demo'))
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)

export function parseDomains (spec) {
  const map = new Map()
  for (const entry of spec.split(',').map(s => s.trim()).filter(Boolean)) {
    const [domain, target] = entry.split('=')
    if (!target) { map.set(domain.toLowerCase(), null); continue }
    const i = target.lastIndexOf(':')
    map.set(domain.toLowerCase(), i > 0
      ? { host: target.slice(0, i), port: Number(target.slice(i + 1)) }
      : { host: target, port: 5222 })
  }
  return map
}

const DOMAINS = parseDomains(process.env.XMPP_DOMAINS || 'localhost=127.0.0.1:5222')

async function resolveTarget (domain) {
  const fixed = DOMAINS.get(domain)
  if (fixed) return fixed
  try {
    const records = await dns.resolveSrv(`_xmpp-client._tcp.${domain}`)
    records.sort((a, b) => a.priority - b.priority || b.weight - a.weight)
    if (records.length && records[0].name !== '.') return { host: records[0].name, port: records[0].port }
  } catch { /* no SRV: fall through */ }
  return { host: domain, port: 5222 }
}

const log = (...args) => console.log(new Date().toISOString(), ...args)
const redact = (s) => s.replace(/(<(auth|response|challenge|success)\b[^>]*>)[^<]*/g, '$1[redacted]')

let nextId = 1

function bridge (ws) {
  const id = nextId++
  let socket = null // net.Socket or tls.TLSSocket
  let parser = null
  let domain = null
  let secure = false
  let state = 'init' // init -> connecting -> starttls -> open -> closed
  let header = null // last server stream header, sent as <open/> when ready
  let connected = false
  const pending = [] // client frames received before the TCP stream is up

  const toClient = (frame) => {
    if (DEBUG) log(`#${id} S->C`, redact(frame))
    if (ws.readyState === ws.OPEN) ws.send(frame)
  }
  const toServer = (data) => {
    if (DEBUG) log(`#${id} C->S`, redact(data))
    socket?.write(data)
  }
  const fail = (reason) => {
    log(`#${id} error: ${reason}`)
    if (state !== 'closed') {
      toClient(`<stream:error xmlns:stream="http://etherx.jabber.org/streams"><remote-connection-failed xmlns="urn:ietf:params:xml:ns:xmpp-streams"/><text xmlns="urn:ietf:params:xml:ns:xmpp-streams">${escapeXMLText(reason)}</text></stream:error>`)
      toClient(CLOSE_FRAME)
    }
    shutdown()
  }
  const shutdown = () => {
    if (state === 'closed') return
    state = 'closed'
    socket?.end(); socket?.destroy()
    if (ws.readyState === ws.OPEN) ws.close()
  }

  function newParser () {
    parser = new Parser()
    parser.on('start', (el) => {
      header = el
      // Before TLS we hold the header back: the client only sees the secured stream.
      if (secure || state === 'open') toClient(openFrame(el))
    })
    parser.on('element', onServerElement)
    parser.on('end', () => { toClient(CLOSE_FRAME); shutdown() })
    parser.on('error', (err) => fail(`bad XML from server: ${err.message}`))
  }

  function onServerElement (el) {
    if (state === 'starttls') {
      if (el.is('proceed', NS_TLS)) return upgradeTls()
      return fail('server refused STARTTLS')
    }
    if (el.name === 'stream:features' && !secure && state !== 'open') {
      if (el.getChild('starttls', NS_TLS)) {
        state = 'starttls'
        toServer(`<starttls xmlns="${NS_TLS}"/>`)
        return
      }
      if (!ALLOW_PLAINTEXT) return fail(`${domain} does not offer STARTTLS`)
      state = 'open'
      toClient(openFrame(header))
    }
    toClient(toFrame(el))
  }

  function upgradeTls () {
    const raw = socket
    raw.removeAllListeners('data')
    socket = tls.connect({ socket: raw, servername: domain, rejectUnauthorized: !TLS_INSECURE }, () => {
      secure = true
      state = 'open'
      log(`#${id} TLS up to ${domain} (${socket.getProtocol()})`)
      newParser()
      toServer(streamHeader({ to: domain }))
    })
    socket.on('data', (d) => parser.write(d.toString('utf8')))
    socket.on('error', (err) => fail(`TLS: ${err.message}`))
    socket.on('close', () => { if (state !== 'closed') { toClient(CLOSE_FRAME); shutdown() } })
  }

  async function connect (open) {
    domain = String(open.attrs.to || '').toLowerCase()
    if (!DOMAINS.has(domain)) return fail(`domain not allowed by proxy: ${domain}`)
    state = 'connecting'
    const { host, port } = await resolveTarget(domain)
    log(`#${id} connecting to ${domain} via ${host}:${port}`)
    socket = net.connect({ host, port })
    socket.setKeepAlive(true, 60_000)
    socket.on('connect', () => {
      connected = true
      newParser()
      toServer(streamHeader({ to: domain, lang: open.attrs['xml:lang'] }))
      while (pending.length) toServer(pending.shift())
    })
    socket.on('data', (d) => parser.write(d.toString('utf8')))
    socket.on('error', (err) => fail(`TCP: ${err.message}`))
    socket.on('close', () => { if (state !== 'closed' && !secure && state !== 'starttls') { toClient(CLOSE_FRAME); shutdown() } })
  }

  ws.on('message', (data) => {
    const text = data.toString()
    let el
    try { el = parseFrame(text) } catch (err) { return fail(`bad XML from client: ${err.message}`) }

    if (isOpen(el)) {
      if (state === 'init') return connect(el)
      // Stream restart (after SASL): fresh parser, fresh header.
      newParser()
      toServer(streamHeader({ to: domain, lang: el.attrs['xml:lang'] }))
      return
    }
    if (isClose(el)) {
      toServer(STREAM_END)
      toClient(CLOSE_FRAME)
      return setTimeout(shutdown, 250)
    }
    if (!connected) pending.push(text)
    else toServer(text)
  })
  ws.on('close', () => { if (state !== 'closed') { socket?.write(STREAM_END); shutdown() } })
  ws.on('error', (err) => fail(`WebSocket: ${err.message}`))
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.ttl': 'text/turtle', '.svg': 'image/svg+xml', '.json': 'application/json' }

// The demo profiles are fetched cross-origin by rdflib, which sends
// credentials, so echo the origin rather than using '*' (as Solid servers do).
function cors (req) {
  return {
    'access-control-allow-origin': req.headers.origin || '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': req.headers['access-control-request-headers'] || '*',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    vary: 'Origin'
  }
}

function serveStatic (req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors(req)).end(); return }
  const url = new URL(req.url, 'http://x')
  const file = path.join(STATIC_DIR, path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''))
  const target = file.endsWith(path.sep) || url.pathname === '/' ? path.join(file, 'index.html') : file
  if (!target.startsWith(STATIC_DIR)) { res.writeHead(403).end(); return }
  fs.readFile(target, (err, body) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain', ...cors(req) }).end('not found'); return }
    res.writeHead(200, {
      'content-type': MIME[path.extname(target)] || 'application/octet-stream',
      ...cors(req)
    }).end(req.method === 'HEAD' ? undefined : body)
  })
}

export function start (port = PORT) {
  const server = http.createServer(serveStatic)
  const wss = new WebSocketServer({
    server,
    path: WS_PATH,
    handleProtocols: (protocols) => protocols.has('xmpp') ? 'xmpp' : false,
    verifyClient: ({ origin }) => !ALLOWED_ORIGINS.length || ALLOWED_ORIGINS.includes(origin)
  })
  wss.on('connection', bridge)
  return new Promise((resolve) => server.listen(port, () => {
    log(`xmpp proxy on ws://localhost:${port}${WS_PATH} -> ${[...DOMAINS.keys()].join(', ')}; static ${STATIC_DIR}`)
    resolve(server)
  }))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) start()
