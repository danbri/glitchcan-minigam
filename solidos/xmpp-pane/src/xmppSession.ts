/**
 * Thin wrapper around a Strophe connection: connect, roster, presence and
 * one-to-one chat messages. UI code listens for the events below and never
 * touches Strophe directly.
 *
 * Events (CustomEvent detail):
 *   status   { status: string, connected: boolean, error?: string }
 *   roster   { items: RosterItem[] }
 *   presence { from: string, available: boolean, show?: string, status?: string }
 *   message  ChatMessage
 */
import { $iq, $msg, $pres, Strophe } from 'strophe.js'

export type RosterItem = { jid: string, name?: string, subscription?: string }

export type ChatMessage = {
  id: string
  from: string // bare JID of the other party
  to: string
  body: string
  outgoing: boolean
  date: Date
  error?: string
}

const STATUS_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(Strophe.Status).map(([name, n]) => [n, name.toLowerCase()])
)

export const bareJid = (jid: string): string => Strophe.getBareJidFromJid(jid) ?? jid

export class XmppSession extends EventTarget {
  readonly service: string
  private conn: InstanceType<typeof Strophe.Connection> | null = null
  jid: string | null = null
  connected = false

  constructor (service: string) {
    super()
    this.service = service
  }

  private emit (type: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }

  /** Resolves once the session is bound and initial presence is sent. */
  connect (jid: string, password: string): Promise<void> {
    this.disconnect()
    const conn = new Strophe.Connection(this.service, { protocol: 'ws' })
    this.conn = conn
    return new Promise((resolve, reject) => {
      conn.connect(jid, password, (status: number, condition?: string | null) => {
        const name = STATUS_NAMES[status] ?? String(status)
        const S = Strophe.Status
        if (status === S.CONNECTED) {
          this.connected = true
          this.jid = conn.jid
          this.addHandlers(conn)
          conn.send($pres())
          this.emit('status', { status: name, connected: true })
          this.fetchRoster().catch(() => { /* roster is optional for the demo */ })
          resolve()
        } else if (status === S.AUTHFAIL || status === S.CONNFAIL || status === S.ERROR || status === S.CONNTIMEOUT) {
          this.connected = false
          const error = condition || name
          this.emit('status', { status: name, connected: false, error })
          reject(new Error(error))
        } else {
          if (status === S.DISCONNECTED) this.connected = false
          this.emit('status', { status: name, connected: this.connected })
        }
      })
    })
  }

  disconnect () {
    if (this.conn) {
      this.conn.disconnect('bye')
      this.conn = null
    }
    this.connected = false
  }

  private addHandlers (conn: InstanceType<typeof Strophe.Connection>) {
    conn.addHandler((stanza: Element) => {
      const body = stanza.getElementsByTagName('body')[0]
      const type = stanza.getAttribute('type')
      if (!body && type !== 'error') return true
      const err = type === 'error' ? stanza.getElementsByTagName('error')[0] : null
      this.emit('message', {
        id: stanza.getAttribute('id') || conn.getUniqueId('in'),
        from: bareJid(stanza.getAttribute('from') || ''),
        to: bareJid(this.jid || ''),
        body: body?.textContent ?? '', // not Strophe.getText(), which XML-escapes
        outgoing: false,
        date: delayStamp(stanza) ?? new Date(),
        error: err ? (err.firstElementChild?.localName || 'error') : undefined
      } satisfies ChatMessage)
      return true
    }, null, 'message', null)

    conn.addHandler((stanza: Element) => {
      const from = stanza.getAttribute('from') || ''
      if (bareJid(from) === bareJid(this.jid || '')) return true
      const type = stanza.getAttribute('type')
      if (type && type !== 'unavailable') return true // subscriptions etc. are out of scope
      const text = (tag: string) => {
        const el = stanza.getElementsByTagName(tag)[0]
        return el?.textContent ?? undefined
      }
      this.emit('presence', { from, available: type !== 'unavailable', show: text('show'), status: text('status') })
      return true
    }, null, 'presence', null)
  }

  fetchRoster (): Promise<RosterItem[]> {
    const conn = this.conn
    if (!conn) return Promise.reject(new Error('not connected'))
    return new Promise((resolve, reject) => {
      conn.sendIQ($iq({ type: 'get' }).c('query', { xmlns: Strophe.NS.ROSTER }), (res: Element) => {
        const items = Array.from(res.getElementsByTagName('item')).map(item => ({
          jid: item.getAttribute('jid') || '',
          name: item.getAttribute('name') || undefined,
          subscription: item.getAttribute('subscription') || undefined
        }))
        this.emit('roster', { items })
        resolve(items)
      }, () => reject(new Error('roster request failed')), 10_000)
    })
  }

  sendMessage (to: string, body: string): ChatMessage {
    if (!this.conn || !this.connected) throw new Error('not connected')
    const id = this.conn.getUniqueId('msg')
    this.conn.send($msg({ to, type: 'chat', id }).c('body').t(body))
    return { id, from: bareJid(to), to: bareJid(to), body, outgoing: true, date: new Date() }
  }
}

/** XEP-0203 delayed delivery timestamp, e.g. for offline messages. */
function delayStamp (stanza: Element): Date | null {
  const delay = stanza.getElementsByTagName('delay')[0]
  const stamp = delay?.getAttribute('stamp')
  return stamp ? new Date(stamp) : null
}
