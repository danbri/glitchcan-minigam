// A fetch that acts as one did:key agent on one LWS storage.
//
// The Factoidal LWS client (@factoidal/core/lws/client, createLwsClient with `selfIssued`) does the
// sign-in: it reads the storage's 401, finds its authorization server, and exchanges a JWT that the
// agent signs for an access token (lws10-core, Authorization; lws10-authn-ssi-cid). This file only
// carries that token on ordinary requests, so FoafPods can keep its fetch-shaped calls.
//
// The token comes from the client's session document (`tokens[].root` and `tokens[].token`). That
// shape is Factoidal's, not a standard: packages/foafos/test/lws-agent.test.js pins it against a real
// lws-serve. A 401 gets a new token once. The key and the token stay in this closure: they are never
// logged, returned or put in a URL.
//
// Design and limits: docs/foafos-local-lws-auth-20261107.md.

/** A did:key, as Factoidal makes them (base58btc, multibase "z"). */
export const DID_KEY = /^did:key:z[1-9A-HJ-NP-Za-km-z]{20,128}$/;

/**
 * @param client  a Factoidal LWS client made with `selfIssued` (createLwsClient)
 * @param base    the storage root, ending in "/"
 * @param fetch   the fetch that carries the requests
 * @returns       (url, init) => Promise<Response>
 */
export function lwsAgentFetch({ client, base, fetch }) {
  let token = null;
  let getting = null;
  const refresh = () => (getting ??= (async () => {
    token = null;
    // A refusal (403: this agent is not in the ACL) still leaves the token in the session.
    try { await client.head(base); } catch { /* the status shows on the request itself */ }
    const held = (client.session().tokens || []).find((t) => t && t.root === base && typeof t.token === 'string');
    token = held ? held.token : null;
  })().finally(() => { getting = null; }));
  const send = (url, init) => fetch(url, token ? { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } } : init);
  return async (url, init = {}) => {
    if (!String(url).startsWith(base)) throw new Error('this agent fetch reaches only its own storage');
    if (!token) await refresh();
    let r = await send(url, init);
    if (r.status === 401 && token) {
      await refresh();
      r = await send(url, init);
    }
    return r;
  };
}
