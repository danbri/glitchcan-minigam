/**
 * Find XMPP addresses for a person in their Solid profile.
 *
 * Supported:
 *   <#me> foaf:jabberID "bob@example.org" .
 *   <#me> vcard:hasInstantMessage <xmpp:bob@example.org> .
 *   <#me> foaf:account <xmpp:bob@example.org> .   (also foaf:holdsAccount)
 */
import { Namespace, type NamedNode, type Store } from 'rdflib'

const FOAF = Namespace('http://xmlns.com/foaf/0.1/')
const VCARD = Namespace('http://www.w3.org/2006/vcard/ns#')

const JID = /^[^\s@/]+@[^\s@/]+$/

export function normalizeJid (value: string): string | null {
  const jid = value.trim().replace(/^xmpp:/i, '').split('?')[0]
  return JID.test(jid) ? decodeURIComponent(jid).toLowerCase() : null
}

export function jabberIds (store: Store, subject: NamedNode): string[] {
  const found = new Set<string>()
  const add = (value?: string) => {
    const jid = value ? normalizeJid(value) : null
    if (jid) found.add(jid)
  }
  for (const o of store.each(subject, FOAF('jabberID'), null, null)) add(o.value)
  for (const p of [VCARD('hasInstantMessage'), FOAF('account'), FOAF('holdsAccount')]) {
    for (const o of store.each(subject, p, null, null)) {
      if (/^xmpp:/i.test(o.value)) add(o.value)
    }
  }
  return [...found]
}

export function displayName (store: Store, subject: NamedNode): string | null {
  const name = store.any(subject, FOAF('name')) ?? store.any(subject, VCARD('fn'))
  return name ? name.value : null
}
