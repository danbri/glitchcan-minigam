-- Test relay for the LWS-over-XMPP binding. Local only: plain ws:// on 127.0.0.1.
-- Started by test/run.mjs with PROSODY_DATA set to a temporary directory.
local data = os.getenv("PROSODY_DATA") or "/tmp/prosody-lws-test"
data_path = data
pidfile = data .. "/prosody.pid"
certificates = data .. "/certs"
run_as_root = true
log = { { levels = { min = "warn" }, to = "console" } }
modules_enabled = { "roster", "saslauth", "disco", "ping", "register", "websocket", "posix" }
modules_disabled = { "s2s" }
interfaces = { "127.0.0.1" }
c2s_ports = { 15222 }
http_ports = { 15280 }
http_interfaces = { "127.0.0.1" }
https_ports = { }
-- No TLS in this local test: allow SCRAM over plain sockets and treat ws:// as secure.
c2s_require_encryption = false
allow_unencrypted_plain_auth = false
consider_websocket_secure = true
cross_domain_websocket = true
authentication = "internal_hashed"
storage = "internal"
VirtualHost "localhost"
