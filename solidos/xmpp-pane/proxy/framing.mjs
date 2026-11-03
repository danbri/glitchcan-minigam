/**
 * Translation between RFC 7395 (XMPP over WebSocket) framing and the
 * RFC 6120 TCP stream framing.
 *
 * WebSocket side: every message is one complete XML element. The stream is
 * opened with <open/> and closed with <close/> in the framing namespace.
 * TCP side: one long-lived <stream:stream> document, stanzas are its children.
 */
import { parse } from 'ltx'

export const NS_FRAMING = 'urn:ietf:params:xml:ns:xmpp-framing'
export const NS_STREAM = 'http://etherx.jabber.org/streams'
export const NS_CLIENT = 'jabber:client'
export const NS_TLS = 'urn:ietf:params:xml:ns:xmpp-tls'

// Strophe compares the close frame as a literal string, so keep this exact.
export const CLOSE_FRAME = `<close xmlns="${NS_FRAMING}" />`

const escapeAttr = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

/** Parse one WebSocket frame from the client into an ltx Element. */
export function parseFrame (data) {
  return parse(String(data))
}

/** Is this client frame an <open/> (stream start / restart)? */
export const isOpen = (el) => el.name === 'open' && el.attrs.xmlns === NS_FRAMING
export const isClose = (el) => el.name === 'close' && el.attrs.xmlns === NS_FRAMING

/** Build the TCP stream header sent to the server for a client <open/>. */
export function streamHeader ({ to, from, lang }) {
  let attrs = `to="${escapeAttr(to)}" version="1.0" xmlns="${NS_CLIENT}" xmlns:stream="${NS_STREAM}"`
  if (from) attrs += ` from="${escapeAttr(from)}"`
  if (lang) attrs += ` xml:lang="${escapeAttr(lang)}"`
  return `<?xml version='1.0'?><stream:stream ${attrs}>`
}

export const STREAM_END = '</stream:stream>'

/** Turn the server's <stream:stream> header element into an <open/> frame. */
export function openFrame (header) {
  const out = [`xmlns="${NS_FRAMING}"`, 'version="1.0"']
  for (const key of ['from', 'id', 'xml:lang']) {
    if (header.attrs[key]) out.push(`${key}="${escapeAttr(header.attrs[key])}"`)
  }
  return `<open ${out.join(' ')} />`
}

/**
 * Make a top-level child of the server stream self-contained, as RFC 7395
 * requires: namespace prefixes and the default namespace inherited from the
 * stream header must be declared on the element itself.
 */
export function toFrame (el) {
  if (el.name.startsWith('stream:')) {
    el.attrs['xmlns:stream'] = NS_STREAM
  } else if (!el.attrs.xmlns) {
    el.attrs.xmlns = NS_CLIENT
  }
  return el.toString()
}
