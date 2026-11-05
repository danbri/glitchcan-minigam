#!/usr/bin/env python3
"""A plain text XMPP client for Foafos: no setup, no terminal library, standard library only.

  foafos-stack chat [local|proto|shared] [--as ACCOUNT] [--room NAME]

Type a line to say it in the room. A line starting with "/" goes to the shell as a
direct message, so /where, /go PLACE and /call work, if this account holds a grant.

  /dm JID TEXT   a direct message to anyone
  /who           who is in the room
  /quit          leave

For scripts and agents:

  foafos-stack chat proto --say "hello" --wait 5
  foafos-stack chat proto --say "/go Tower Bridge" --wait 8

It prints what happens, one line each, and exits after --wait seconds.

Servers: local is this laptop; proto is foafos-proto on Fly, through `foafos-stack
start proto`; shared is the public test server foafos-xmpp.fly.dev.
"""
import argparse, base64, os, re, select, socket, ssl, sys, time
import xml.etree.ElementTree as ET

HOME = os.path.expanduser('~')
SERVERS = {
    'local': dict(host='127.0.0.1', port=5222, tls=False, verify=False, domain='localhost', accounts=f'{HOME}/foafos-xmpp/accounts'),
    # The tunnel ends on this computer, and the far end's certificate is its own.
    'proto': dict(host='127.0.0.1', port=15223, tls=True, verify=False, domain='foafos-proto.fly.dev', accounts=f'{HOME}/.config/foafos-proto/accounts'),
    'shared': dict(host='foafos-xmpp.fly.dev', port=5223, tls=True, verify=True, domain='foafos-xmpp.fly.dev', accounts=f'{HOME}/.config/foafos-xmpp-fly/accounts'),
}

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument('server', nargs='?', default='local', choices=SERVERS)
ap.add_argument('--as', dest='account', default='me')
ap.add_argument('--room', default='bus')
ap.add_argument('--nick')
ap.add_argument('--shell', default='foafos', help='the account that answers / commands')
ap.add_argument('--say', action='append', default=[], help='say this, then stop after --wait seconds')
ap.add_argument('--wait', type=float, default=None, help='stop after this many seconds')
o = ap.parse_args()
srv = SERVERS[o.server]
domain = srv['domain']
room = f"{o.room}@rooms.{domain}"
nick = o.nick or o.account
esc = lambda s: s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
attr = lambda s: esc(s).replace('"', '&quot;').replace("'", '&apos;')


def out(line):
    print(f"{time.strftime('%H:%M:%S')} {line}", flush=True)


try:
    accounts = dict(l.rstrip('\n').split(':', 1) for l in open(srv['accounts']) if ':' in l)
except OSError:
    sys.exit(f"No accounts file at {srv['accounts']}.")
if o.account not in accounts:
    sys.exit(f"No account {o.account}. There are: {', '.join(accounts)}")

try:
    s = socket.create_connection((srv['host'], srv['port']), 10)
except OSError as e:
    sys.exit(f"Cannot reach {srv['host']}:{srv['port']}: {e}." + (' Run: foafos-stack start proto' if o.server == 'proto' else ''))
if srv['tls']:
    ctx = ssl.create_default_context()
    if not srv['verify']:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    s = ctx.wrap_socket(s, server_hostname=domain)
elif srv['host'] != '127.0.0.1':
    sys.exit('Refusing to send a password in clear to another computer.')


def send(x):
    s.sendall(x.encode())


def until(marker):
    b = ''
    s.settimeout(10)
    while marker not in b:
        d = s.recv(65536).decode(errors='replace')
        if not d:
            sys.exit(f'The server closed the connection: {b[-160:]}')
        b += d
    return b


OPEN = f"<?xml version='1.0'?><stream:stream to='{domain}' version='1.0' xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams'>"
send(OPEN)
until('</stream:features>')
token = base64.b64encode(f'\0{o.account}\0{accounts[o.account]}'.encode()).decode()
send(f"<auth xmlns='urn:ietf:params:xml:ns:xmpp-sasl' mechanism='PLAIN'>{token}</auth>")
if '<success' not in until('>'):
    sys.exit('The server refused that account.')
send(OPEN)
until('</stream:features>')
send(f"<iq type='set' id='b'><bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'><resource>cli-{os.getpid()}</resource></bind></iq>")
until('</iq>')
send('<presence/>')
send(f"<presence to='{room}/{attr(nick)}'><x xmlns='http://jabber.org/protocol/muc'/></presence>")
out(f"connected to {domain} as {o.account}, in {room} as {nick}")

people = set()
parser = ET.XMLPullParser(events=('start', 'end'))
parser.feed("<stream xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams'>")
root = None
depth = 0
local = lambda e: e.tag.rsplit('}', 1)[-1]


def on_stanza(el):
    kind, frm = local(el), el.get('from', '')
    if kind == 'presence' and frm.startswith(room + '/'):
        who = frm.split('/', 1)[1]
        if el.get('type') == 'error':
            cond = next((local(c) for e in el if local(e) == 'error' for c in e), 'error')
            out(f"* could not join as {who}: {cond}. Try --nick")
        elif el.get('type') == 'unavailable':
            people.discard(who)
            out(f"* {who} left")
        elif who not in people:
            people.add(who)
            out(f"* {who} is here")
    elif kind == 'message':
        body = next((c.text for c in el if local(c) == 'body'), None)
        if body is None:
            return
        if el.get('type') == 'groupchat':
            out(f"{frm.split('/', 1)[1] if '/' in frm else 'room'}: {body}")
        else:
            out(f"[dm {frm.split('/')[0]}] {body}")


def do(line):
    line = line.strip()
    if not line:
        return True
    if line == '/quit':
        return False
    if line == '/who':
        out('in the room: ' + (', '.join(sorted(people)) or 'nobody'))
    elif line.startswith('/dm '):
        parts = line.split(' ', 2)
        if len(parts) == 3:
            send(f"<message to='{attr(parts[1])}' type='chat'><body>{esc(parts[2])}</body></message>")
    elif line.startswith('/'):
        send(f"<message to='{attr(o.shell)}@{domain}' type='chat'><body>{esc(line)}</body></message>")
    else:
        send(f"<message to='{room}' type='groupchat'><body>{esc(line)}</body></message>")
    return True


def stream_input():
    data = s.recv(65536)
    if not data:
        return False
    if b'<!DOCTYPE' in data or b'<!ENTITY' in data:
        sys.exit('The server sent a DTD, which XMPP forbids.')
    try:
        parser.feed(data)
    except ET.ParseError:
        return False
    global root, depth
    for event, el in parser.read_events():
        if event == 'start':
            root = root if root is not None else el
            depth += 1
        else:
            depth -= 1
            if depth == 1:
                on_stanza(el)
                root.remove(el)
    return True


s.settimeout(None)
s.setblocking(False)
scripted = bool(o.say) or o.wait is not None
ends = time.time() + (o.wait if o.wait is not None else 5) if scripted else None
said = False
joined_at = time.time()
sources = [s] if scripted else [s, sys.stdin]
try:
    while ends is None or time.time() < ends:
        if scripted and not said and time.time() - joined_at > 1:   # give the room a moment to admit us
            said = True
            s.setblocking(True)
            for line in o.say:
                do(line)
            s.setblocking(False)
        ready = [s] if srv['tls'] and s.pending() else select.select(sources, [], [], 0.25)[0]
        if s in ready:
            try:
                if not stream_input():
                    out('* the server closed the connection')
                    break
            except (ssl.SSLWantReadError, BlockingIOError):
                pass
        if sys.stdin in ready:
            line = sys.stdin.readline()
            s.setblocking(True)
            keep = bool(line) and do(line)
            s.setblocking(False)
            if not keep:
                break
except KeyboardInterrupt:
    pass
try:
    s.setblocking(True)
    send('</stream:stream>')
except OSError:
    pass
