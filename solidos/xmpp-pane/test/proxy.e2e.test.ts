// @vitest-environment node
/**
 * End to end: Strophe (WebSocket) -> proxy -> mock XMPP server (TCP + STARTTLS).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Server } from 'node:net'
import { XmppSession, type ChatMessage } from '../src/xmppSession'

const MOCK_PORT = 15222
const PROXY_PORT = 15281
const SERVICE = `ws://localhost:${PROXY_PORT}/xmpp-websocket`

let servers: Server[] = []

beforeAll(async () => {
  process.env.XMPP_DOMAINS = `localhost=127.0.0.1:${MOCK_PORT}`
  process.env.XMPP_TLS_INSECURE = '1'
  const { startMock } = await import('../proxy/mock-server.mjs')
  const { start } = await import('../proxy/server.mjs')
  servers = [await startMock(MOCK_PORT), await start(PROXY_PORT)]
})

afterAll(() => {
  for (const s of servers) s.close()
})

const next = <T>(target: EventTarget, type: string, match: (d: T) => boolean = () => true) =>
  new Promise<T>((resolve) => {
    const fn = (e: Event) => {
      const d = (e as CustomEvent<T>).detail
      if (match(d)) { target.removeEventListener(type, fn); resolve(d) }
    }
    target.addEventListener(type, fn)
  })

describe('proxy + mock server', () => {
  it('rejects a bad password', async () => {
    const s = new XmppSession(SERVICE)
    await expect(s.connect('alice@localhost', 'wrong')).rejects.toThrow()
    s.disconnect()
  })

  it('refuses domains that are not allowlisted', async () => {
    const s = new XmppSession(SERVICE)
    await expect(s.connect('mallory@evil.example', 'secret')).rejects.toThrow()
    s.disconnect()
  })

  it('logs in two users who see each other and chat', async () => {
    const alice = new XmppSession(SERVICE)
    const bob = new XmppSession(SERVICE)

    const aliceRoster = next<{ items: { jid: string }[] }>(alice, 'roster')
    await alice.connect('alice@localhost/test', 'secret')
    expect(alice.jid).toBe('alice@localhost/test')
    expect((await aliceRoster).items.map(i => i.jid)).toEqual(['bob@localhost'])

    const aliceSeesBob = next<{ from: string, available: boolean }>(alice, 'presence', d => d.from.startsWith('bob@'))
    await bob.connect('bob@localhost', 'secret')
    expect((await aliceSeesBob).available).toBe(true)

    const bobGets = next<ChatMessage>(bob, 'message')
    alice.sendMessage('bob@localhost', 'hello from <alice> & co')
    const msg = await bobGets
    expect(msg).toMatchObject({ from: 'alice@localhost', body: 'hello from <alice> & co', outgoing: false })

    const aliceGets = next<ChatMessage>(alice, 'message')
    bob.sendMessage('alice@localhost', 'hi alice')
    expect((await aliceGets).body).toBe('hi alice')

    const aliceSeesBobLeave = next<{ available: boolean }>(alice, 'presence', d => !d.available)
    bob.disconnect()
    expect((await aliceSeesBobLeave).available).toBe(false)
    alice.disconnect()
  }, 15_000)
})
