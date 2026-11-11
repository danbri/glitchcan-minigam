// FoafProfile: the person's profile in their pod, which identifiers are theirs, and which of
// those an access rule may name.
//
// The profile is Turtle at profile/card.ttl of the shared pod, the Solid convention, so a
// Solid WebID client can read it. Its terms are the standard ones first:
//
//   <#me> as:alsoKnownAs <xmpp:me@foafos-xmpp.fly.dev> ;          CID 1.0 alsoKnownAs
//         sec:authenticationMethod <did:key:z…#z…> ;               CID 1.0 authentication
//         did:service [ a lws:OpenIdProvider ; did:serviceEndpoint <https://issuer> ] ;
//         solid:oidcIssuer <https://issuer> ;                      Solid WebID profiles
//         owl:sameAs <did:key:z…> ;                                OWL
//         foaf:jabberID "me@foafos-xmpp.fly.dev" .                 FOAF, read as well
//
// What decides:
//
// 1. Shape. `PROFILE_SHAPES` (SHACL, run by the Factoidal engine) says which values each of
//    those terms may hold. A profile that does not conform is not saved, and is not read for
//    claims.
// 2. Claims. `claimsQuery(me)` (SPARQL, run with OWL-RL entailment, so owl:sameAs is
//    symmetric and transitive and what holds of an alias holds of <#me>) lists the identifiers
//    the profile links to <#me>. It reads the profile graph only: a sameAs in any other
//    document cannot add an identity.
// 3. Evidence. A claim binds only with evidence checked outside the profile (`bound`): a
//    signature under the did:key; a reply, from the account the XMPP server stamped, naming
//    this profile; an OpenID ID token whose sub is this profile. The profile speaks only for
//    itself.
// 4. Agents. `agentIri` gives the WAC acl:agent of each bound identifier.
//
// `bound`, `supports`, `agentIri` and the diff below are the definitions of
// L4Factoidal.Identity.Binding in https://github.com/danbri/factoidal-core
// (formal/lean4/L4Factoidal/Identity/Binding.lean), where they have theorems: bound is
// exactly claimed and evidenced; evidence alone adds no one; a proof made for another
// profile does not bind; the closure invents no identifier; replaying the diffs gives each
// version. test/profile.test.js checks this file against the same cases as that module's
// #guard lines.
//
// Changelog. Every save writes profile/changes/<time>.diff, a unified diff of the Turtle text
// (one hunk, 3 lines of context), so `diff`, `patch` and people can read it.
// `replayChanges` rebuilds every version from the empty file.

export const PROFILE_PATH = 'card.ttl';          // relative to the pod's profile/ container
export const CHANGES_DIR = 'changes/';

const NS = {
  owl: 'http://www.w3.org/2002/07/owl#',
  as: 'https://www.w3.org/ns/activitystreams#',
  sec: 'https://w3id.org/security#',
  did: 'https://www.w3.org/ns/did#',
  lws: 'https://www.w3.org/ns/lws#',
  solid: 'http://www.w3.org/ns/solid/terms#',
  foaf: 'http://xmlns.com/foaf/0.1/',
  sh: 'http://www.w3.org/ns/shacl#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
};
const PREFIXES = Object.entries(NS).map(([p, iri]) => `PREFIX ${p}: <${iri}>`).join('\n');
const TTL_PREFIXES = Object.entries(NS).map(([p, iri]) => `@prefix ${p}: <${iri}> .`).join('\n');

const DID_KEY = /^did:key:z[1-9A-HJ-NP-Za-km-z]+$/;
const BARE_JID = /^[^@/\s"<>]+@[^@/\s"<>?#]+$/;

/** The SHACL shapes a profile must meet, for the profile node `me`. */
export function profileShapes(me) {
  const iri = (pattern) => `sh:nodeKind sh:IRI ; sh:pattern "${pattern}"`;
  return `${TTL_PREFIXES}
<urn:foafos:profile-shape> a sh:NodeShape ; sh:targetNode <${me}> ;
  sh:property [ sh:path as:alsoKnownAs ; ${iri('^(xmpp:[^/?#@]+@[^/?#@]+$|did:key:z|https://)')} ] ;
  sh:property [ sh:path owl:sameAs ; ${iri('^(xmpp:[^/?#@]+@[^/?#@]+$|did:key:z|https://)')} ] ;
  sh:property [ sh:path sec:authenticationMethod ; ${iri('^did:key:z')} ] ;
  sh:property [ sh:path sec:verificationMethod ; ${iri('^did:key:z')} ] ;
  sh:property [ sh:path solid:oidcIssuer ; ${iri('^https://')} ] ;
  sh:property [ sh:path foaf:jabberID ; sh:datatype xsd:string ; sh:pattern "^[^@/\\\\s]+@[^@/\\\\s]+$" ] .
`;
}

/** The SPARQL query (run with entail: 'OWL-RL') for what the profile links to `me`. */
export function claimsQuery(me) {
  return `${PREFIXES}
SELECT DISTINCT ?link ?x WHERE {
  { <${me}> (owl:sameAs|^owl:sameAs|as:alsoKnownAs|^as:alsoKnownAs)* ?x . BIND("same" AS ?link) }
  UNION { <${me}> (sec:verificationMethod|sec:authenticationMethod) ?x . BIND("key" AS ?link) }
  UNION { <${me}> foaf:jabberID ?x . BIND("jabber" AS ?link) }
  UNION { <${me}> solid:oidcIssuer ?x . BIND("oidc" AS ?link) }
  UNION { <${me}> did:service ?svc . ?svc a lws:OpenIdProvider ; did:serviceEndpoint ?x . BIND("oidc" AS ?link) }
}`;
}

/** One identifier, as Binding.Ident: { kind: 'profile'|'didKey'|'xmpp'|'oidc', … }. */
export function classify(me, link, value) {
  if (link === 'oidc') return /^https:\/\//.test(value) ? { kind: 'oidc', iss: value, sub: me } : null;
  if (link === 'jabber') return BARE_JID.test(value) ? { kind: 'xmpp', jid: value } : null;
  if (value === me) return { kind: 'profile', iri: me };
  const d = value.split('#')[0];
  if (DID_KEY.test(d)) return { kind: 'didKey', did: d };
  const x = /^xmpp:([^/?#]+)/.exec(value);
  if (x && BARE_JID.test(x[1])) return { kind: 'xmpp', jid: x[1] };
  return null;   // another web identity: shown, never an ACL agent
}

const keyOf = (i) => JSON.stringify(i);

/**
 * Read a profile: shape check, then the claims. `engine` is @factoidal/core (shaclValidate,
 * query). Answers { conforms, report, claims, others }: `others` are linked IRIs that are not
 * identifiers an ACL can name.
 */
export async function readProfile(engine, ttl, me) {
  const v = await engine.shaclValidate(ttl, profileShapes(me), { baseIRI: me });
  if (!v.conforms) return { conforms: false, report: v.report, claims: [], others: [] };
  const rows = await engine.query(ttl, claimsQuery(me), { entail: 'OWL-RL', format: 'turtle', baseIRI: me });
  const claims = [{ kind: 'profile', iri: me }], others = [], seen = new Set([keyOf(claims[0])]);
  for (const r of rows) {
    const link = r.get('link')?.value, x = r.get('x')?.value;
    const c = classify(me, link, x);
    if (!c) { if (x && !others.includes(x)) others.push(x); continue; }
    if (!seen.has(keyOf(c))) { seen.add(keyOf(c)); claims.push(c); }
  }
  return { conforms: true, report: null, claims, others };
}

/** Binding.supports: does evidence `e` support identifier `i` for profile `me`? */
export function supports(me, e, i) {
  if (e.kind === 'keyProof') return i.kind === 'didKey' && e.did === i.did;
  if (e.kind === 'xmppReply') return i.kind === 'xmpp' && e.jid === i.jid && e.profile === me;
  if (e.kind === 'oidcToken') return i.kind === 'oidc' && e.iss === i.iss && e.sub === i.sub && e.profile === me && e.sub === me;
  return false;
}

/** Binding.bound: the claims an ACL may name. */
export function bound(me, claims, evidence) {
  return claims.filter((i) => (i.kind === 'profile' && i.iri === me) || evidence.some((e) => supports(me, e, i)));
}

/** Binding.agentIri: the WAC acl:agent of an identifier. */
export function agentIri(i) {
  return i.kind === 'profile' ? i.iri : i.kind === 'didKey' ? i.did : i.kind === 'xmpp' ? `xmpp:${i.jid}` : i.sub;
}

// ── Line diffs (Binding.Diff: keep pre lines, drop del, insert ins) ──

const lines = (t) => (t === '' ? [] : String(t).split('\n'));

/** The diff from text a to text b: common prefix and suffix kept. */
export function lineDiff(a, b) {
  const A = lines(a), B = lines(b);
  let pre = 0;
  while (pre < A.length && pre < B.length && A[pre] === B[pre]) pre++;
  let suf = 0;
  while (suf < A.length - pre && suf < B.length - pre && A[A.length - 1 - suf] === B[B.length - 1 - suf]) suf++;
  return { pre, del: A.length - pre - suf, ins: B.slice(pre, B.length - suf) };
}

/** Binding.apply. */
export function applyDiff(d, a) {
  const A = lines(a);
  return [...A.slice(0, d.pre), ...d.ins, ...A.slice(d.pre + d.del)].join('\n');
}

/** A unified diff of one hunk with `context` lines each side. */
export function unifiedDiff(a, b, { from = 'a/card.ttl', to = 'b/card.ttl', context = 3 } = {}) {
  const A = lines(a), d = lineDiff(a, b);
  if (d.del === 0 && d.ins.length === 0) return '';
  const s = Math.max(0, d.pre - context), e = Math.min(A.length, d.pre + d.del + context);
  const before = A.slice(s, d.pre), after = A.slice(d.pre + d.del, e);
  const oldN = before.length + d.del + after.length, newN = before.length + d.ins.length + after.length;
  const range = (start, n) => `${n === 0 ? start : start + 1},${n}`;
  return [`--- ${from}`, `+++ ${to}`, `@@ -${range(s, oldN)} +${range(s, newN)} @@`,
    ...before.map((l) => ` ${l}`), ...A.slice(d.pre, d.pre + d.del).map((l) => `-${l}`),
    ...d.ins.map((l) => `+${l}`), ...after.map((l) => ` ${l}`)].join('\n') + '\n';
}

/** Read back a diff written by unifiedDiff. */
export function parseUnified(text) {
  const ls = text.replace(/\n$/, '').split('\n');
  const h = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/.exec(ls[2] || '');
  if (!h) throw new Error('Not a one-hunk unified diff');
  const oldN = Number(h[2] ?? 1), start = oldN === 0 ? Number(h[1]) : Number(h[1]) - 1;
  const body = ls.slice(3);
  let lead = 0;
  while (lead < body.length && body[lead][0] === ' ') lead++;
  let del = 0, ins = [], i = lead;
  for (; i < body.length && body[i][0] !== ' '; i++) {
    if (body[i][0] === '-') del++; else if (body[i][0] === '+') ins.push(body[i].slice(1));
    else throw new Error('Bad diff line');
  }
  return { pre: start + lead, del, ins };
}

/** Every version, oldest first, from the changelog texts in time order. */
export function replayChanges(diffs) {
  const versions = [''];
  for (const t of diffs) versions.push(applyDiff(parseUnified(t), versions.at(-1)));
  return versions;
}

/**
 * The store. `pod(verb, params)` is the shell's pods.invoke aimed at profile/, as for Places.
 * `me` is the profile IRI (the card's absolute URL + '#me').
 */
export class FoafProfile {
  constructor({ pod, engine, me, now = () => new Date() }) {
    Object.assign(this, { pod, engine, me, now });
  }

  async text() {
    const r = await this.pod('pod.get', { path: PROFILE_PATH });
    if (r.ok) return r.body;
    if (r.status === 404) return '';
    throw new Error(`Profile: ${r.reason || r.status}`);
  }

  /** Save new Turtle. Refused unless it meets the shape; writes a diff to the changelog. */
  async save(ttl, { note = '' } = {}) {
    const checked = await readProfile(this.engine, ttl, this.me);
    if (!checked.conforms) return { saved: false, reason: 'shape', report: checked.report };
    const old = await this.text();
    const diff = unifiedDiff(old, ttl);
    if (!diff) return { saved: false, reason: 'unchanged', claims: checked.claims };
    const stamp = this.now().toISOString().replace(/[:.]/g, '-');
    const head = note ? `# ${String(note).replace(/\s+/g, ' ').slice(0, 200)}\n` : '';
    const w = await this.pod('pod.put', { path: `${CHANGES_DIR}${stamp}.diff`, body: head + diff, contentType: 'text/x-diff', ifNoneMatch: '*' });
    if (!w.ok) throw new Error(`Profile changelog: ${w.reason || w.status}`);
    const p = await this.pod('pod.put', { path: PROFILE_PATH, body: ttl, contentType: 'text/turtle' });
    if (!p.ok) throw new Error(`Profile: ${p.reason || p.status}`);
    return { saved: true, change: `${CHANGES_DIR}${stamp}.diff`, claims: checked.claims };
  }

  /** The changelog, oldest first: [{ path, note, diff }]. */
  async changes() {
    const r = await this.pod('pod.list', { path: CHANGES_DIR });
    if (!r.ok) return [];
    const paths = r.items.filter((x) => !x.container && x.path.endsWith('.diff')).map((x) => x.path).sort();
    const out = [];
    for (const path of paths) {
      const g = await this.pod('pod.get', { path: path.startsWith(CHANGES_DIR) ? path : CHANGES_DIR + path });
      if (!g.ok) continue;
      const m = /^# (.*)\n/.exec(g.body);
      out.push({ path, note: m ? m[1] : '', diff: m ? g.body.slice(m[0].length) : g.body });
    }
    return out;
  }

  /** The identifiers an ACL may name now, with their agent IRIs. */
  async bindings(evidence) {
    const r = await readProfile(this.engine, await this.text(), this.me);
    const b = r.conforms ? bound(this.me, r.claims, evidence) : [];
    return { ...r, bound: b.map((i) => ({ ...i, agent: agentIri(i) })) };
  }
}
