# foafos-proto: a prototype on Fly, not a public service. See README.md here.
FROM caddy:2.10.2 AS proxy
FROM node:22-bookworm-slim
ARG FACTOIDAL_VERSION
RUN test -n "$FACTOIDAL_VERSION"
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini && rm -rf /var/lib/apt/lists/*
COPY --from=proxy /usr/bin/caddy /usr/bin/caddy
WORKDIR /opt/foafos
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund --save-exact "@factoidal/core@${FACTOIDAL_VERSION}" @xmpp/client@0.14.0
COPY pod.mjs ./
COPY fly/Caddyfile fly/entrypoint.sh ./
ENV PATH=/opt/foafos/node_modules/.bin:$PATH
ENTRYPOINT ["/usr/bin/tini", "-s", "--", "bash", "/opt/foafos/entrypoint.sh"]
