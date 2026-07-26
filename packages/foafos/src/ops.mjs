// FoafOps — broker the ACTION, not the token.
//
// FoafSecrets took away `get`: an app may hand a credential over and ask
// the shell to USE it, but never read it back. That leaves an obvious hole,
// which this fills. What does "use it" actually mean? If the answer is
// "run this function I'm passing you", the whole thing was theatre — a
// guest-supplied function receiving the value is reading the secret with
// extra steps. So the transport carries a VERB NAME and some data, and the
// shell decides what that verb does.
//
//   app:    foaf.invoke('git.commit', { path, content, message })
//   shell:  ops.invoke('edot', 'git.commit', params)
//             → secrets.use('edot', 'git.token', (t) => fetch(…))
//
// edot never wanted a GitHub token. It wanted *this file committed to that
// repo*. Handing over the outcome instead of the authority is the same move
// as brokering storage instead of returning `allow-same-origin`, and
// brokering story variables instead of letting a guest write them.
//
// ── THE RULE THAT MAKES THIS SAFE ──────────────────────────────────────
//
//   THE SCOPE SUPPLIES THE DESTINATION. THE APP SUPPLIES THE DATA.
//
// Not a style preference. An op that took its host, repo or bucket from the
// caller would be a signed-request-to-anywhere primitive with a credential
// attached — an app could point a valid GitHub token at any repo the token
// could reach, or make the shell sign an S3 request against someone else's
// endpoint. So:
//
//   · which secret an op uses is declared by the OP, not the caller
//   · where the request goes comes from the GRANT's scope, set by the
//     shell/root, and is validated when granted rather than when used
//   · the app contributes a path (checked against the scope's prefix, and
//     rejected outright if it contains `..`) and a body
//
// Everything else follows: refuse in the open, audit the verb and never the
// value, report a status code but never an error message (a failed fetch's
// message and URL routinely contain the credential).

export const OPS_CAP_SUFFIX = ':write';

/** A path an app supplied, made safe or refused. `..` is never resolved. */
export function cleanPath(p) {
  const parts = String(p ?? '').split('/').filter((s) => s && s !== '.');
  if (parts.some((s) => s === '..')) return null;
  if (!parts.length) return null;
  return parts.join('/');
}

/** Is `path` inside `prefix`? An empty prefix means the whole scope. */
export function withinPrefix(path, prefix) {
  const pre = String(prefix ?? '').split('/').filter(Boolean).join('/');
  if (!pre) return true;
  return path === pre || path.startsWith(pre + '/');
}

const b64 = (text) => {
  const bytes = new TextEncoder().encode(String(text));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

/** Refuse a scope at GRANT time, so a misconfiguration is not a runtime surprise. */
function requireHttps(url, what) {
  let u;
  try { u = new URL(String(url)); } catch { throw new Error(`foafos ops: ${what} is not a URL`); }
  if (u.protocol !== 'https:') throw new Error(`foafos ops: ${what} must be https, got ${u.protocol}`);
  return u;
}

export class FoafOps {
  /**
   * @param secrets   a FoafSecrets. Ops NEVER touch its store directly —
   *                  every credential is reached through `secrets.use`, so
   *                  the capability check, the audit line and the
   *                  never-log-the-value rule are all inherited rather
   *                  than reimplemented (and cannot drift).
   * @param fetchImpl injectable, because these suites must be runnable with
   *                  no network at all: this environment has no egress, and
   *                  a test that needs a real IdP is a test that never runs.
   */
  constructor({ secrets, bus = null, fetchImpl = null, now = () => Date.now() } = {}) {
    if (!secrets) throw new Error('foafos ops: a FoafSecrets is required — an op without one is a token in a variable');
    this.secrets = secrets;
    this.bus = bus;
    this.fetch = fetchImpl || ((...a) => globalThis.fetch(...a));
    this.now = now;
    this.ops = new Map();          // verb -> definition
    this.grants = new Map();       // appId -> Map(capability -> scope)
    this.calls = new Map();        // `${appId}|${verb}` -> [timestamps]
    this.audit = [];
  }

  _say(topic, data) {
    this.audit.push({ topic, ...data });
    if (this.audit.length > 200) this.audit.shift();
    this.bus?.publish(topic, data);
  }

  register(op) {
    if (!op?.verb || !op.capability || !op.secret || typeof op.run !== 'function') {
      throw new Error('foafos ops: an op needs verb, capability, secret and run()');
    }
    this.ops.set(op.verb, { perMinute: 20, scopeKeys: [], ...op });
    return this;
  }

  /**
   * Grant capabilities WITH their scopes.
   *
   *   ops.grant('edot', { 'git:write': { repo: 'me/notes', branch: 'main', pathPrefix: 'edot/' } })
   *
   * Scope shape is validated here by whichever op declares that capability,
   * so a typo in a root manifest fails loudly at boot instead of quietly at
   * the first commit.
   */
  grant(appId, scopes = {}) {
    const box = new Map();
    for (const [cap, scope] of Object.entries(scopes)) {
      for (const op of this.ops.values()) {
        if (op.capability === cap && typeof op.checkScope === 'function') op.checkScope(scope);
      }
      box.set(cap, Object.freeze({ ...scope }));
    }
    this.grants.set(appId, box);
    return this;
  }

  revoke(appId) { this.grants.delete(appId); return this; }
  scopeFor(appId, cap) { return this.grants.get(appId)?.get(cap) || null; }
  can(appId, verb) {
    const op = this.ops.get(verb);
    return !!(op && this.scopeFor(appId, op.capability));
  }

  /** What verbs exist, who may call them, and where each one is pointed. */
  list() {
    return [...this.ops.values()].map((op) => ({
      verb: op.verb, capability: op.capability, secret: op.secret,
      note: op.note || '',
      holders: [...this.grants.entries()]
        .filter(([, box]) => box.has(op.capability))
        .map(([appId, box]) => ({ appId, scope: box.get(op.capability) })),
    }));
  }

  _throttled(appId, verb, perMinute) {
    const key = `${appId}|${verb}`;
    const t = this.now();
    const recent = (this.calls.get(key) || []).filter((ts) => t - ts < 60_000);
    if (recent.length >= perMinute) { this.calls.set(key, recent); return true; }
    recent.push(t);
    this.calls.set(key, recent);
    return false;
  }

  /**
   * Run a named operation for an app.
   *
   * Order matters: EVERY check that can be made without the credential is
   * made first. Unwrapping a secret for a request you are about to reject
   * is a needless trip past the boundary.
   */
  async invoke(appId, verb, params = {}) {
    const op = this.ops.get(verb);
    if (!op) {
      this._say('ops.refused', { summary: `${appId} asked for unknown verb "${verb}"`, appId, verb, reason: 'unknown-verb' });
      return { ok: false, reason: 'unknown-verb' };
    }
    const scope = this.scopeFor(appId, op.capability);
    if (!scope) {
      this._say('ops.refused', {
        summary: `${appId} may not "${verb}" — no ${op.capability} grant`,
        appId, verb, reason: 'denied', capability: op.capability,
      });
      return { ok: false, reason: 'denied', capability: op.capability };
    }
    const missing = (op.scopeKeys || []).filter((k) => !scope[k]);
    if (missing.length) {
      this._say('ops.refused', {
        summary: `${appId}'s ${op.capability} grant is missing ${missing.join(', ')}`,
        appId, verb, reason: 'bad-scope', missing,
      });
      return { ok: false, reason: 'bad-scope', missing };
    }
    // Validate the app's own arguments BEFORE reaching for the credential.
    let prepared;
    try {
      prepared = op.prepare ? op.prepare(params, scope) : { params };
    } catch (e) {
      this._say('ops.refused', {
        summary: `${appId}'s "${verb}" arguments were refused: ${e.message}`,
        appId, verb, reason: 'bad-params', detail: e.message,
      });
      return { ok: false, reason: 'bad-params', detail: e.message };
    }
    if (this._throttled(appId, verb, op.perMinute)) {
      this._say('ops.refused', {
        summary: `${appId} called "${verb}" more than ${op.perMinute} times in a minute`,
        appId, verb, reason: 'throttled', perMinute: op.perMinute,
      });
      return { ok: false, reason: 'throttled', perMinute: op.perMinute };
    }

    this._say('ops.invoke', {
      summary: op.summary ? op.summary(prepared, scope, appId) : `${appId} → ${verb}`,
      appId, verb, capability: op.capability,
    });

    // Through secrets.use, so the value is bounded by that call and the
    // capability check + audit line live in one place.
    const used = await this.secrets.use(appId, op.secret, (token) =>
      op.run({ ...prepared, scope, token, fetch: this.fetch, appId }));
    if (!used.ok) {
      this._say('ops.failed', {
        summary: `${appId}'s "${verb}" did not run (${used.reason}${used.error ? `: ${used.error}` : ''})`,
        appId, verb, reason: used.reason, error: used.error,
      });
      // `missing` here means the secret is absent, which is the app's cue to
      // ask its user for one — so say which name it should put.
      return used.reason === 'missing'
        ? { ok: false, reason: 'no-secret', secret: op.secret }
        : { ok: false, reason: used.reason, error: used.error };
    }
    const result = used.result || {};
    this._say(result.ok === false ? 'ops.failed' : 'ops.done', {
      summary: result.ok === false
        ? `${appId}'s "${verb}" failed with status ${result.status ?? '?'}`
        : `${appId} completed "${verb}"`,
      appId, verb, status: result.status,
    });
    return result;
  }
}

// ── the ops themselves ──────────────────────────────────────────────────
// Each is data: a capability, a secret name, an argument check, and a run.
// None of them accepts a host from the caller.

/**
 * git.commit — create or update one file in a repo, via the GitHub Contents
 * API. The repo, the branch and the allowed path prefix are the SCOPE; the
 * app brings a path, a body and a message.
 *
 * `api.github.com` is hard-coded because it is the one host this op talks
 * to. Making it configurable would hand an app a way to aim a valid token
 * at an attacker's endpoint, which is precisely the thing the design is
 * for.
 */
export const gitCommitOp = {
  verb: 'git.commit',
  capability: 'git:write',
  secret: 'git.token',
  scopeKeys: ['repo'],
  perMinute: 12,
  note: 'one file, one repo, one branch — all three fixed by the grant',
  checkScope(scope) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(String(scope?.repo || ''))) {
      throw new Error('foafos ops: git:write scope needs repo as "owner/name"');
    }
  },
  prepare(params, scope) {
    const path = cleanPath(params.path);
    if (!path) throw new Error('a path is required and may not contain ".."');
    if (!withinPrefix(path, scope.pathPrefix)) {
      throw new Error(`path is outside this grant's prefix "${scope.pathPrefix}"`);
    }
    if (typeof params.content !== 'string') throw new Error('content must be a string');
    const message = String(params.message || '').slice(0, 400) || `Update ${path}`;
    return { path, content: params.content, message, sha: params.sha ? String(params.sha) : null };
  },
  summary({ path }, scope, appId) { return `${appId} is committing ${path} to ${scope.repo}`; },
  async run({ path, content, message, sha, scope, token, fetch }) {
    const base = `https://api.github.com/repos/${scope.repo}/contents/` +
                 path.split('/').map(encodeURIComponent).join('/');
    const branch = scope.branch || null;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };
    // An update needs the blob sha of what it replaces. Look it up rather
    // than making the app track it — the app cannot see the repo anyway.
    let existing = sha;
    if (!existing) {
      const q = branch ? `?ref=${encodeURIComponent(branch)}` : '';
      const probe = await fetch(base + q, { method: 'GET', headers });
      if (probe.status === 200) {
        const j = await probe.json().catch(() => ({}));
        existing = j.sha || null;
      } else if (probe.status !== 404) {
        return { ok: false, reason: 'http', status: probe.status, stage: 'lookup' };
      }
    }
    const body = { message, content: b64(content) };
    if (existing) body.sha = existing;
    if (branch) body.branch = branch;
    const res = await fetch(base, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (res.status !== 200 && res.status !== 201) {
      return { ok: false, reason: 'http', status: res.status, stage: 'put' };
    }
    const j = await res.json().catch(() => ({}));
    // Deliberately narrow: a path, a sha, a URL. Not the whole API response,
    // which carries repo metadata the app was never granted sight of.
    return {
      ok: true, status: res.status, path,
      sha: j.content?.sha || null,
      commit: j.commit?.sha || null,
      url: j.content?.html_url || null,
    };
  },
};

/**
 * s3.put — one object into one bucket. The endpoint, bucket, region and
 * access key id come from the scope; only the secret access key is a
 * secret (AWS's own split, and the honest one: an access key id is an
 * identifier, not a credential).
 */
export const s3PutOp = {
  verb: 's3.put',
  capability: 's3:write',
  secret: 's3.secretAccessKey',
  scopeKeys: ['bucket', 'accessKeyId'],
  perMinute: 30,
  note: 'SigV4-signed PUT; bucket and endpoint fixed by the grant',
  checkScope(scope) {
    if (scope?.endpoint) requireHttps(scope.endpoint, 's3:write endpoint');
    if (!/^[a-z0-9][a-z0-9.-]{1,62}$/.test(String(scope?.bucket || ''))) {
      throw new Error('foafos ops: s3:write scope needs a valid bucket name');
    }
  },
  prepare(params, scope) {
    const key = cleanPath(params.key ?? params.path);
    if (!key) throw new Error('a key is required and may not contain ".."');
    if (!withinPrefix(key, scope.keyPrefix)) {
      throw new Error(`key is outside this grant's prefix "${scope.keyPrefix}"`);
    }
    if (typeof params.content !== 'string') throw new Error('content must be a string');
    return { key, content: params.content, contentType: String(params.contentType || 'application/octet-stream') };
  },
  summary({ key }, scope, appId) { return `${appId} is putting ${key} into ${scope.bucket}`; },
  async run({ key, content, contentType, scope, token, fetch }) {
    const { sigv4, sha256hex, awsUriEncode, amzDate } = await import('./sigv4.mjs');
    const region = scope.region || 'us-east-1';
    const endpoint = String(scope.endpoint || `https://s3.${region}.amazonaws.com`).replace(/\/+$/, '');
    const encKey = key.split('/').map((s) => awsUriEncode(s, true)).join('/');
    const url = `${endpoint}/${scope.bucket}/${encKey}`;
    const body = new TextEncoder().encode(content);
    const amzdate = amzDate();
    const payloadHash = await sha256hex(body);
    const signed = { 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzdate };
    const { Authorization } = await sigv4({
      method: 'PUT', url, headers: signed, payloadHash,
      accessKeyId: scope.accessKeyId, secretAccessKey: token,
      region, service: 's3', amzdate,
    });
    const res = await fetch(url, {
      method: 'PUT', body,
      headers: { ...signed, Authorization, 'Content-Type': contentType },
    });
    if (res.status !== 200 && res.status !== 201 && res.status !== 204) {
      return { ok: false, reason: 'http', status: res.status };
    }
    // No signed URL in the result: it carries the signature, and a result
    // an app can read is a result an app can log.
    return { ok: true, status: res.status, key, bucket: scope.bucket };
  },
};

/**
 * solid.put — one resource into one Solid pod container (LDP PUT with a
 * bearer token). The container base is the scope; the app brings a relative
 * path. Bearer, not DPoP: a DPoP-bound token needs a proof signed per
 * request with a key the shell would also have to hold, which is a real
 * increment rather than a line of config, and claiming otherwise would be
 * the kind of unverified stub this whole exercise is a response to.
 */
export const solidPutOp = {
  verb: 'solid.put',
  capability: 'solid:write',
  secret: 'solid.token',
  scopeKeys: ['base'],
  perMinute: 30,
  note: 'LDP PUT with a bearer token; container base fixed by the grant',
  checkScope(scope) { requireHttps(scope?.base, 'solid:write base'); },
  prepare(params, scope) {
    const path = cleanPath(params.path);
    if (!path) throw new Error('a path is required and may not contain ".."');
    if (typeof params.content !== 'string') throw new Error('content must be a string');
    return { path, content: params.content, contentType: String(params.contentType || 'text/plain') };
  },
  summary({ path }, scope, appId) { return `${appId} is putting ${path} into its pod`; },
  async run({ path, content, contentType, scope, token, fetch }) {
    const base = String(scope.base).replace(/\/+$/, '') + '/';
    // Built from a validated base plus a path already proven free of `..`,
    // so this cannot leave the container the grant names.
    const url = base + path.split('/').map(encodeURIComponent).join('/');
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
        Link: '<http://www.w3.org/ns/ldp#Resource>; rel="type"',
      },
      body: content,
    });
    if (![200, 201, 204, 205].includes(res.status)) {
      return { ok: false, reason: 'http', status: res.status };
    }
    return { ok: true, status: res.status, path };
  },
};

/** The three the shell installs by default. */
export const DEFAULT_OPS = [gitCommitOp, s3PutOp, solidPutOp];

export function defaultOps(config = {}) {
  const ops = new FoafOps(config);
  for (const op of DEFAULT_OPS) ops.register(op);
  return ops;
}
