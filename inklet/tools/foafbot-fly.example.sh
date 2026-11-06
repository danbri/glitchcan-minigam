#!/bin/sh
# An example: foafbot on a Fly server, from your own machine. Not part of any
# deployment, and nothing starts it. Logins stay in your accounts file, never here.
#
#   FOAFOS_FLY_HOST=your-app.fly.dev sh inklet/tools/foafbot-fly.example.sh
#
# It uses your `claude` login. Any account on the server can ask it things, with
# every tool off, so stop it when you are done.
: "${FOAFOS_FLY_HOST:?set FOAFOS_FLY_HOST}"
exec python3 "$(dirname "$0")/chat-ai.py" --tls --host "$FOAFOS_FLY_HOST" --port 5223 \
  --domain "$FOAFOS_FLY_HOST" --room "bus@rooms.$FOAFOS_FLY_HOST" \
  --dir "${FOAFOS_FLY_DIR:-$HOME/.config/foafos-xmpp-fly}" "$@"
