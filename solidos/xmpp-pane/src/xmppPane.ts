/**
 * SolidOS pane: chat over XMPP with a person whose WebID profile lists a
 * Jabber ID (foaf:jabberID, or an xmpp: URI via vcard:hasInstantMessage).
 *
 * The browser talks RFC 7395 WebSocket via Strophe.js; see proxy/server.mjs
 * for a bridge to servers that only offer TCP on 5222.
 */
import { authn } from 'solid-logic'
import { icons } from 'solid-ui'
import type { NamedNode } from 'rdflib'
import type { DataBrowserContext, PaneDefinition } from 'pane-registry'
import { chatView } from './chatView'
import { displayName, jabberIds } from './jabberIds'

export const xmppPane: PaneDefinition = {
  icon: icons.iconBase + 'noun_1689339.svg', // same speech-bubble icon as chat-pane

  name: 'xmpp',

  audience: [],

  label: function (subject: NamedNode, context: DataBrowserContext) {
    return jabberIds(context.session.store, subject).length ? 'XMPP chat' : null
  },

  render: function (subject: NamedNode, context: DataBrowserContext) {
    const store = context.session.store
    const name = displayName(store, subject) ?? undefined
    const me = authn.currentUser()
    const myJid = me ? jabberIds(store, me)[0] : undefined
    return chatView(context.dom, {
      contacts: jabberIds(store, subject).map(jid => ({ jid, name })),
      myJid
    })
  }
}
