import { describe, expect, it, vi } from 'vitest'
import { graph, parse, sym } from 'rdflib'
import { jabberIds, normalizeJid } from '../src/jabberIds'
import { xmppPane } from '../src/xmppPane'

// Under vitest, strophe.js resolves to its Node build, which replaces the global
// document with xmldom and breaks jsdom. These tests don't connect, so stub it.
vi.mock('strophe.js', () => ({
  Strophe: { Status: {}, getBareJidFromJid: (j: string) => j.split('/')[0] },
  $iq: vi.fn(),
  $msg: vi.fn(),
  $pres: vi.fn()
}))

const base = 'https://pod.example/profile/card'
const profile = `
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
<#bob> foaf:name "Bob" ; foaf:jabberID "Bob@Example.org", "not a jid" ;
  vcard:hasInstantMessage <xmpp:bob@example.org>, <xmpp:bob@work.example?message> .
<#carol> foaf:name "Carol" ; vcard:hasInstantMessage <mailto:carol@example.org> .
`

function setup () {
  const store = graph()
  parse(profile, store, base, 'text/turtle')
  const context = { dom: document, session: { store } } as any
  return { store, context }
}

describe('normalizeJid', () => {
  it('strips xmpp: URIs and query parts, lowercases', () => {
    expect(normalizeJid('xmpp:Alice@Example.org?message')).toBe('alice@example.org')
    expect(normalizeJid('alice@example.org')).toBe('alice@example.org')
  })
  it('rejects non-JIDs', () => {
    expect(normalizeJid('alice')).toBeNull()
    expect(normalizeJid('mailto:x@y z')).toBeNull()
  })
})

describe('jabberIds', () => {
  it('collects foaf:jabberID and xmpp: instant-message URIs, de-duplicated', () => {
    const { store } = setup()
    expect(jabberIds(store, sym(base + '#bob'))).toEqual(['bob@example.org', 'bob@work.example'])
  })
  it('ignores non-xmpp IM URIs', () => {
    const { store } = setup()
    expect(jabberIds(store, sym(base + '#carol'))).toEqual([])
  })
})

describe('xmppPane', () => {
  it('only labels subjects that have a Jabber ID', () => {
    const { context } = setup()
    expect(xmppPane.label(sym(base + '#bob'), context)).toBe('XMPP chat')
    expect(xmppPane.label(sym(base + '#carol'), context)).toBeNull()
  })

  it('renders a login form and lists the profile contact', () => {
    const { context } = setup()
    const el = xmppPane.render(sym(base + '#bob'), context)
    expect(el.querySelector('input[name=jid]')).not.toBeNull()
    expect(el.querySelector('input[name=password]')).not.toBeNull()
    const names = Array.from(el.querySelectorAll('.xmpp-contacts li')).map(li => li.getAttribute('title'))
    expect(names).toEqual(['bob@example.org', 'bob@work.example'])
  })
})
