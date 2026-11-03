/**
 * Plain-DOM chat UI on top of XmppSession: login form, contact list with
 * presence, and one conversation at a time. Knows nothing about RDF; the
 * pane passes in the contacts it found in the Solid profile.
 */
import { bareJid, XmppSession, type ChatMessage, type RosterItem } from './xmppSession'
import './xmppPane.css'

export type ChatViewOptions = {
  /** Contacts from the profile being viewed, shown first and pre-selected. */
  contacts: { jid: string, name?: string }[]
  /** Suggested login JID, e.g. the logged-in user's own foaf:jabberID. */
  myJid?: string
  service?: string
}

const DEFAULT_SERVICE = 'ws://localhost:5281/xmpp-websocket'
const STORE_KEY = 'xmpp-pane:login'

type Contact = { jid: string, name?: string, online: boolean, unread: number }

function remembered (): { jid?: string, service?: string } {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') } catch { return {} }
}

export function chatView (dom: Document, options: ChatViewOptions): HTMLElement {
  const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] => {
    const el: HTMLElementTagNameMap[K] = Object.assign(dom.createElement(tag), props)
    el.append(...children)
    return el
  }

  const saved = remembered()
  const root = h('section', { className: 'xmpp-pane' })

  // ----- login -----
  const jidInput = h('input', { type: 'text', name: 'jid', placeholder: 'you@example.org', autocomplete: 'username', value: options.myJid || saved.jid || '' })
  const pwInput = h('input', { type: 'password', name: 'password', autocomplete: 'current-password' })
  const serviceInput = h('input', { type: 'url', name: 'service', value: options.service || saved.service || DEFAULT_SERVICE })
  const connectBtn = h('button', { type: 'submit', className: 'xmpp-primary' }, 'Connect')
  const status = h('p', { className: 'xmpp-status', role: 'status' }, 'Not connected')
  const label = (text: string, input: HTMLElement) => h('label', {}, h('span', {}, text), input)
  const loginForm = h('form', { className: 'xmpp-login' },
    label('Your Jabber ID', jidInput),
    label('Password', pwInput),
    h('details', {}, h('summary', {}, 'Connection'), label('WebSocket service (proxy)', serviceInput)),
    connectBtn)

  // ----- chat -----
  const contactList = h('ul', { className: 'xmpp-contacts', role: 'listbox', ariaLabel: 'Contacts' })
  const convTitle = h('h3', { className: 'xmpp-conv-title' })
  const log = h('ol', { className: 'xmpp-log', ariaLive: 'polite' })
  const msgInput = h('input', { type: 'text', name: 'message', placeholder: 'Message', autocomplete: 'off' })
  const sendForm = h('form', { className: 'xmpp-send' }, msgInput, h('button', { type: 'submit', className: 'xmpp-primary' }, 'Send'))
  const logoutBtn = h('button', { type: 'button' }, 'Disconnect')
  const chat = h('div', { className: 'xmpp-chat', hidden: true },
    h('aside', {}, contactList, logoutBtn),
    h('div', { className: 'xmpp-conv' }, convTitle, log, sendForm))

  root.append(status, loginForm, chat)

  let session: XmppSession | null = null
  const contacts = new Map<string, Contact>()
  const history = new Map<string, ChatMessage[]>()
  let current: string | null = null

  const addContact = (jid: string, name?: string) => {
    const c = contacts.get(jid)
    if (c) { if (name && !c.name) c.name = name; return c }
    const created = { jid, name, online: false, unread: 0 }
    contacts.set(jid, created)
    return created
  }
  for (const c of options.contacts) addContact(c.jid, c.name)

  function renderContacts () {
    contactList.replaceChildren(...[...contacts.values()].map(c => {
      const li = h('li', { role: 'option', ariaSelected: String(c.jid === current), className: c.online ? 'online' : '' },
        h('span', { className: 'xmpp-dot', title: c.online ? 'online' : 'offline' }),
        h('span', { className: 'xmpp-name' }, c.name || c.jid),
        c.unread ? h('span', { className: 'xmpp-unread' }, String(c.unread)) : '')
      li.tabIndex = 0
      li.title = c.jid
      li.addEventListener('click', () => select(c.jid))
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter') select(c.jid) })
      return li
    }))
  }

  function renderLog () {
    const msgs = current ? history.get(current) || [] : []
    log.replaceChildren(...msgs.map(m => h('li', { className: m.outgoing ? 'out' : 'in' + (m.error ? ' error' : '') },
      h('span', { className: 'xmpp-body' }, m.error ? `(not delivered: ${m.error})` : m.body),
      h('time', { dateTime: m.date.toISOString() }, m.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })))))
    log.scrollTop = log.scrollHeight
  }

  function select (jid: string) {
    current = jid
    const c = addContact(jid)
    c.unread = 0
    convTitle.textContent = c.name ? `${c.name} — ${jid}` : jid
    renderContacts()
    renderLog()
    msgInput.focus()
  }

  function record (with_: string, m: ChatMessage) {
    const list = history.get(with_) || []
    list.push(m)
    history.set(with_, list)
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const jid = jidInput.value.trim()
    if (!jid || !pwInput.value) { status.textContent = 'Enter your Jabber ID and password'; return }
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ jid, service: serviceInput.value })) } catch { /* private mode */ }

    session?.disconnect()
    session = new XmppSession(serviceInput.value)
    session.addEventListener('status', (ev) => {
      const d = (ev as CustomEvent).detail
      status.textContent = d.error ? `Failed: ${d.error}` : d.connected ? `Connected as ${session?.jid}` : `Status: ${d.status}`
      status.classList.toggle('error', !!d.error)
      if (!d.connected) { chat.hidden = true; loginForm.hidden = false }
    })
    session.addEventListener('roster', (ev) => {
      for (const item of (ev as CustomEvent<{ items: RosterItem[] }>).detail.items) addContact(item.jid, item.name)
      renderContacts()
    })
    session.addEventListener('presence', (ev) => {
      const d = (ev as CustomEvent).detail
      addContact(bareJid(d.from)).online = d.available
      renderContacts()
    })
    session.addEventListener('message', (ev) => {
      const m = (ev as CustomEvent<ChatMessage>).detail
      record(m.from, m)
      if (m.from !== current) addContact(m.from).unread++
      renderContacts()
      renderLog()
    })

    connectBtn.disabled = true
    status.textContent = 'Connecting…'
    try {
      await session.connect(jid, pwInput.value)
      pwInput.value = ''
      loginForm.hidden = true
      chat.hidden = false
      select(current || options.contacts[0]?.jid || [...contacts.keys()][0] || '')
    } catch {
      // status handler already reported it
    } finally {
      connectBtn.disabled = false
    }
  })

  sendForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const body = msgInput.value.trim()
    if (!body || !current || !session) return
    record(current, session.sendMessage(current, body))
    msgInput.value = ''
    renderLog()
  })

  logoutBtn.addEventListener('click', () => {
    session?.disconnect()
    session = null
    for (const c of contacts.values()) c.online = false
    status.textContent = 'Disconnected'
    chat.hidden = true
    loginForm.hidden = false
  })

  renderContacts()
  return root
}
