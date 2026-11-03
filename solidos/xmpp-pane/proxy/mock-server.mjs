#!/usr/bin/env node
/**
 * Tiny in-memory XMPP c2s server, for testing the proxy and pane without
 * installing Prosody/ejabberd. NOT for real use.
 *
 * Supports: STARTTLS (self-signed cert), SASL PLAIN (password = "secret"
 * for any user, or MOCK_PASSWORD), resource binding, legacy session, roster
 * get (everyone else in MOCK_USERS), presence broadcast and message routing.
 *
 * Env: MOCK_PORT (5222), MOCK_DOMAIN (localhost), MOCK_USERS (alice,bob)
 */
import net from 'node:net'
import tls from 'node:tls'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { Parser, xml } from '@xmpp/xml'
import { parse } from 'ltx'

const here = path.dirname(fileURLToPath(import.meta.url))
const DOMAIN = process.env.MOCK_DOMAIN || 'localhost'
const PASSWORD = process.env.MOCK_PASSWORD || 'secret'
const USERS = (process.env.MOCK_USERS || 'alice,bob').split(',')

const NS = {
  stream: 'http://etherx.jabber.org/streams',
  tls: 'urn:ietf:params:xml:ns:xmpp-tls',
  sasl: 'urn:ietf:params:xml:ns:xmpp-sasl',
  bind: 'urn:ietf:params:xml:ns:xmpp-bind',
  session: 'urn:ietf:params:xml:ns:xmpp-session',
  roster: 'jabber:iq:roster',
  stanzas: 'urn:ietf:params:xml:ns:xmpp-stanzas'
}

function loadCert () {
  const dir = path.join(here, '.mock-certs')
  const key = path.join(dir, 'key.pem')
  const cert = path.join(dir, 'cert.pem')
  if (!fs.existsSync(cert)) {
    fs.mkdirSync(dir, { recursive: true })
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '365',
      '-keyout', key, '-out', cert, '-subj', `/CN=${DOMAIN}`], { stdio: 'ignore' })
  }
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) }
}

const sessions = new Set() // { jid, bare, socket, available }
const bareOf = (jid) => jid.split('/')[0]

function handle (raw, creds) {
  let socket = raw
  let parser
  let user = null
  const s = { jid: null, bare: null, available: false, send: (x) => socket.write(x.toString()) }

  const header = () => socket.write(`<?xml version='1.0'?><stream:stream xmlns="jabber:client" xmlns:stream="${NS.stream}" from="${DOMAIN}" id="${crypto.randomUUID()}" version="1.0">`)
  const features = () => {
    const f = xml('stream:features')
    if (!(socket instanceof tls.TLSSocket)) {
      f.c('starttls', { xmlns: NS.tls }).c('required')
    } else if (!user) {
      f.c('mechanisms', { xmlns: NS.sasl }).c('mechanism').t('PLAIN')
    } else {
      f.c('bind', { xmlns: NS.bind })
      f.c('session', { xmlns: NS.session }).c('optional')
    }
    s.send(f)
  }
  const reset = () => {
    parser = new Parser()
    parser.on('start', () => { header(); features() })
    parser.on('element', onElement)
    parser.on('end', () => { socket.end('</stream:stream>') })
    parser.on('error', () => socket.destroy())
  }
  const listen = (sock) => sock.on('data', (d) => parser.write(d.toString('utf8')))

  function onElement (el) {
    if (el.is('starttls', NS.tls)) {
      socket.write(`<proceed xmlns="${NS.tls}"/>`)
      raw.removeAllListeners('data')
      socket = new tls.TLSSocket(raw, { isServer: true, ...creds })
      listen(socket)
      socket.on('error', () => {})
      reset()
      return
    }
    if (el.is('auth', NS.sasl)) {
      const [, authcid, pw] = Buffer.from(el.text(), 'base64').toString('utf8').split('\0')
      if (pw !== PASSWORD || !USERS.includes(authcid)) {
        return s.send(xml('failure', { xmlns: NS.sasl }, xml('not-authorized')))
      }
      user = authcid
      s.send(xml('success', { xmlns: NS.sasl }))
      reset()
      return
    }
    if (!user || !s.jid) {
      if (el.name === 'iq' && el.getChild('bind', NS.bind) && user) {
        const res = el.getChild('bind').getChildText('resource') || crypto.randomUUID().slice(0, 8)
        s.bare = `${user}@${DOMAIN}`
        s.jid = `${s.bare}/${res}`
        sessions.add(s)
        return s.send(xml('iq', { type: 'result', id: el.attrs.id }, xml('bind', { xmlns: NS.bind }, xml('jid', {}, s.jid))))
      }
      return
    }
    if (el.name === 'iq') return onIq(el)
    if (el.name === 'presence') return onPresence(el)
    if (el.name === 'message') return route(el)
  }

  function onIq (el) {
    const reply = (...children) => s.send(xml('iq', { type: 'result', id: el.attrs.id, to: s.jid }, ...children))
    if (el.attrs.to && el.attrs.to !== DOMAIN && bareOf(el.attrs.to) !== s.bare) return route(el)
    if (el.getChild('session', NS.session)) return reply()
    if (el.getChild('query', NS.roster) && el.attrs.type === 'get') {
      const q = xml('query', { xmlns: NS.roster })
      for (const u of USERS) {
        if (u === user) continue
        q.c('item', { jid: `${u}@${DOMAIN}`, name: u[0].toUpperCase() + u.slice(1), subscription: 'both' })
      }
      return reply(q)
    }
    if (el.attrs.type === 'get' || el.attrs.type === 'set') {
      s.send(xml('iq', { type: 'error', id: el.attrs.id, to: s.jid },
        xml('error', { type: 'cancel' }, xml('service-unavailable', { xmlns: NS.stanzas }))))
    }
  }

  function onPresence (el) {
    if (el.attrs.to) return route(el)
    const wasAvailable = s.available
    s.available = el.attrs.type !== 'unavailable'
    for (const other of sessions) {
      if (other === s) continue
      const p = parse(el.toString()); p.attrs.from = s.jid; delete p.attrs.xmlns
      other.send(p)
      // Initial presence: tell the newcomer who is already online.
      if (s.available && !wasAvailable && other.available) {
        s.send(xml('presence', { from: other.jid, to: s.jid }))
      }
    }
  }

  function route (el) {
    const to = el.attrs.to
    if (!to) return
    const out = parse(el.toString()); out.attrs.from = s.jid; delete out.attrs.xmlns
    const targets = [...sessions].filter(o => o.jid === to || (o.bare === to && o.available))
    if (!targets.length && el.name === 'message') {
      const err = xml('message', { type: 'error', from: to, to: s.jid, id: el.attrs.id },
        xml('error', { type: 'cancel' }, xml('service-unavailable', { xmlns: NS.stanzas })))
      return s.send(err)
    }
    for (const t of targets) t.send(out)
  }

  reset()
  listen(raw)
  const cleanup = () => {
    if (!sessions.delete(s)) return
    for (const other of sessions) other.send(xml('presence', { from: s.jid, type: 'unavailable' }))
  }
  raw.on('close', cleanup)
  raw.on('error', cleanup)
}

export function startMock (port = Number(process.env.MOCK_PORT || 5222)) {
  const creds = loadCert()
  const server = net.createServer((sock) => handle(sock, creds))
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => {
    console.log(`mock XMPP server for ${DOMAIN} on 127.0.0.1:${port} (users: ${USERS.join(', ')}; password: ${PASSWORD})`)
    resolve(server)
  }))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) startMock()
