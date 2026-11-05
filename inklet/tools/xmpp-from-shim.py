#!/usr/bin/env python3
"""Local XMPP shim for clients that crash on an iq reply with no 'from'.
Forwards LISTEN -> TARGET and fills in the missing 'from' from the matching
request's 'to'. Plain TCP only (tls disable), loopback only.
Usage: xmpp-from-shim.py [LISTEN_PORT] [TARGET_PORT]    default 5223 5222"""
import re, socket, sys, threading
LISTEN = int(sys.argv[1]) if len(sys.argv) > 1 else 5223
TARGET = int(sys.argv[2]) if len(sys.argv) > 2 else 5222
IQ = re.compile(rb"<iq\b[^>]*>")
def attr(tag, name):
    m = re.search(rb"\s" + name + rb"\s*=\s*(['\"])(.*?)\1", tag)
    return m.group(2) if m else None
def split_partial(buf):
    i = buf.rfind(b"<")
    return (buf, b"") if i < 0 or b">" in buf[i:] else (buf[:i], buf[i:])
def up(c, s, ids):
    held = b""
    while (d := c.recv(65536)):
        out, held = split_partial(held + d)
        for t in IQ.findall(out):
            if (i := attr(t, b"id")) and (to := attr(t, b"to")):
                ids[i] = to
        s.sendall(out)
    s.shutdown(socket.SHUT_WR)
def down(s, c, ids):
    held = b""
    def fix(m):
        t = m.group(0)
        to = ids.pop(attr(t, b"id"), None)
        if to and attr(t, b"from") is None and attr(t, b"type") in (b"result", b"error"):
            return b'<iq from="' + to + b'"' + t[3:]
        return t
    while (d := s.recv(65536)):
        out, held = split_partial(held + d)
        c.sendall(IQ.sub(fix, out))
    c.shutdown(socket.SHUT_WR)
def run(f, *a):
    try: f(*a)
    except OSError: pass
l = socket.create_server(("127.0.0.1", LISTEN))
print(f"shim 127.0.0.1:{LISTEN} -> 127.0.0.1:{TARGET}", flush=True)
while True:
    c, _ = l.accept()
    s = socket.create_connection(("127.0.0.1", TARGET)); ids = {}
    threading.Thread(target=run, args=(up, c, s, ids), daemon=True).start()
    threading.Thread(target=run, args=(down, s, c, ids), daemon=True).start()
