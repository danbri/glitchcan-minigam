#!/usr/bin/env bash
# All of Foafos's Fly prototype, in one machine. Our own code throughout: Factoidal
# XMPP, Factoidal LWS, and pod.mjs. If any part stops, the machine restarts.
set -euo pipefail
D=/data
DOMAIN=${XMPP_DOMAIN:?}
: "${POD_TOKEN:?the https pod has no other lock, so it must not start without its token}"
mkdir -p "$D/xmpp" "$D/pod-https" "$D/pod-xmpp"
# A lock from before a reboot names a process id that may now belong to something
# else, and the storage then refuses to open. Nothing of ours is running yet.
rm -f "$D"/pod-https/lws.lock "$D"/pod-xmpp/lws.lock "$D"/xmpp/state/lws.lock
printf '%s' "${XMPP_ACCOUNTS_B64:?}" | base64 -d > "$D/xmpp/accounts"
chmod 600 "$D/xmpp/accounts"
[ -f "$D/xmpp.key" ] || { openssl rand -hex 32 > "$D/xmpp.key"; chmod 600 "$D/xmpp.key"; }
# A certificate for traffic inside this machine and through the tunnel only.
openssl x509 -in "$D/tls.crt" -noout -ext subjectAltName 2>/dev/null | grep -q 127.0.0.1 || \
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout "$D/tls.key" -out "$D/tls.crt" -days 3650 \
    -subj "/CN=$DOMAIN" -addext "subjectAltName=DNS:$DOMAIN,IP:127.0.0.1" 2>/dev/null

factoidal xmpp-serve "$D/xmpp" --domain "$DOMAIN" --muc "rooms.$DOMAIN" --host '::' --port 5223 \
  --cert "$D/tls.crt" --key "$D/tls.key" --ws-port 5280 \
  --ws-origin http://localhost:8080 --ws-origin https://danbri.github.io --state-key "$D/xmpp.key" &
XMPP=$!

# Reached only through Caddy, which holds the token.
factoidal lws-serve "$D/pod-https" --insecure-no-auth --host 127.0.0.1 --port 3000 --storage files \
  --base "https://$PUBLIC_HOST/" --cors-origin http://localhost:8080 --cors-origin https://danbri.github.io &
LWS=$!

sleep 3
POD_PASSWORD=$(printf '%s' "$XMPP_ACCOUNTS_B64" | base64 -d | sed -n 's/^pod://p')
export POD_PASSWORD
NODE_EXTRA_CA_CERTS="$D/tls.crt" node /opt/foafos/pod.mjs --base "https://pod.$DOMAIN/" --dir "$D/pod-xmpp" \
  --xmpp xmpps://127.0.0.1:5223 --domain "$DOMAIN" --jid pod --allow "foafos@$DOMAIN" --insecure-no-auth &
POD=$!

caddy run --config /opt/foafos/Caddyfile --adapter caddyfile &
CADDY=$!

wait -n "$XMPP" "$LWS" "$POD" "$CADDY"
echo "a process stopped, so the machine restarts" >&2
exit 1
