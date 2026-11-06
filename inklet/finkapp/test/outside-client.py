#!/usr/bin/env python3
"""An XMPP client that is not ours: slixmpp (https://codeberg.org/poezio/slixmpp).
Logs in, joins the room, prints what it sees, and does what it is told.
  outside-client.py JID PASSWORD ROOM NICK SECONDS [say:TEXT | dm:JID:TEXT ...]"""
import asyncio, logging, ssl, sys, time
import slixmpp
jid, password, room, nick, seconds, *acts = sys.argv[1:]
seconds = float(seconds)
class C(slixmpp.ClientXMPP):
    def __init__(s):
        super().__init__(jid, password)
        s.register_plugin('xep_0030'); s.register_plugin('xep_0045'); s.register_plugin('xep_0199')
        s.enable_direct_tls = True; s.enable_starttls = False; s.enable_plaintext = False
        s.ssl_context.check_hostname = False; s.ssl_context.verify_mode = ssl.CERT_NONE
        s.add_event_handler('session_start', s.go)
        s.add_event_handler('failed_auth', lambda e: (print('AUTH FAILED', flush=True), s.disconnect()))
        s.add_event_handler('groupchat_message', lambda m: print(f"ROOM {m['mucnick']}: {m['body'][:140]}", flush=True) if m['mucnick'] != nick else None)
        s.add_event_handler('message', lambda m: print(f"DM {m['from'].bare}: {m['body'][:160]}", flush=True) if m['type'] in ('chat', 'normal') else None)
        s.add_event_handler('muc::%s::got_online' % room, lambda p: print(f"HERE {p['muc']['nick']}", flush=True))
    async def go(s, e):
        print('SESSION', s.boundjid.full, 'mechanism', getattr(s['feature_mechanisms'], 'mech', None) and s['feature_mechanisms'].mech.name, flush=True)
        s.send_presence(); await s.get_roster()
        try:
            info = await s['xep_0030'].get_info(jid=s.boundjid.domain, timeout=6)
            print('DISCO ok, features', len(info['disco_info']['features']), flush=True)
        except Exception as e: print('DISCO FAILED', type(e).__name__, flush=True)
        await s['xep_0045'].join_muc_wait(room, nick, maxstanzas=0, timeout=10)
        print('JOINED', room, flush=True)
        for a in acts:
            await asyncio.sleep(1)
            if a.startswith('say:'): s.send_message(mto=room, mbody=a[4:], mtype='groupchat'); print('SAID', a[4:], flush=True)
            elif a.startswith('dm:'):
                _, to, text = a.split(':', 2); s.send_message(mto=to, mbody=text, mtype='chat'); print('SENT DM', to, text, flush=True)
        await asyncio.sleep(seconds); s.disconnect()
c = C(); c.connect(host='foafos-xmpp.fly.dev', port=5223)
asyncio.get_event_loop().run_until_complete(asyncio.wait_for(c.disconnected, seconds + 30))
