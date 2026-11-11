import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '@factoidal/core';
import {
  FoafProfile, readProfile, bound, supports, agentIri, lineDiff, applyDiff, unifiedDiff, parseUnified, replayChanges,
} from '../src/profile.mjs';

const ME = 'https://pod.example/profile/card.ttl#me';
const CARD = `@prefix as: <https://www.w3.org/ns/activitystreams#> .
@prefix sec: <https://w3id.org/security#> .
@prefix did: <https://www.w3.org/ns/did#> .
@prefix lws: <https://www.w3.org/ns/lws#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
<#me> a foaf:Person ;
  foaf:name "Me" ;
  as:alsoKnownAs <xmpp:me@foafos-xmpp.fly.dev> , <https://social.example/@me> ;
  sec:authenticationMethod <did:key:zDnaeA1#zDnaeA1> ;
  did:service [ a lws:OpenIdProvider ; did:serviceEndpoint <https://issuer.example> ] ;
  foaf:jabberID "me@localhost" .
<xmpp:me@foafos-xmpp.fly.dev> owl:sameAs <did:key:zDnaeB2> .
`;

const kinds = (cs) => cs.map((c) => [c.kind, c.did || c.jid || c.iss || c.iri]).sort();

test('the profile is read with its shape, then its claims with OWL-RL entailment', async () => {
  const r = await readProfile(engine, CARD, ME);
  assert.equal(r.conforms, true, r.report);
  assert.deepEqual(kinds(r.claims), [
    ['didKey', 'did:key:zDnaeA1'], ['didKey', 'did:key:zDnaeB2'],      // B2 only by sameAs from the JID
    ['oidc', 'https://issuer.example'], ['profile', ME],
    ['xmpp', 'me@foafos-xmpp.fly.dev'], ['xmpp', 'me@localhost'],
  ]);
  assert.deepEqual(r.others, ['https://social.example/@me']);
});

test('a profile that breaks the shape is not read for claims', async () => {
  const bad = CARD.replace('<did:key:zDnaeA1#zDnaeA1>', '<https://evil.example/key>');
  const r = await readProfile(engine, bad, ME);
  assert.equal(r.conforms, false);
  assert.deepEqual(r.claims, []);
});

test('bound = claimed and evidenced; evidence alone and proofs for another profile add no one', async () => {
  const { claims } = await readProfile(engine, CARD, ME);
  const evidence = [
    { kind: 'keyProof', did: 'did:key:zDnaeA1' },
    { kind: 'xmppReply', jid: 'me@foafos-xmpp.fly.dev', profile: ME },
    { kind: 'xmppReply', jid: 'me@localhost', profile: 'https://pod.example/other#me' },   // made for another profile
    { kind: 'keyProof', did: 'did:key:zEve' },                                           // not claimed
    { kind: 'oidcToken', iss: 'https://issuer.example', sub: ME, profile: ME },
  ];
  const b = bound(ME, claims, evidence);
  assert.deepEqual([...new Set(b.map(agentIri))].sort(), [ME, 'did:key:zDnaeA1', 'xmpp:me@foafos-xmpp.fly.dev'].sort());
  assert.equal(b.filter((i) => i.kind === 'oidc').length, 1);
  assert.ok(!b.some((i) => i.did === 'did:key:zEve'));
  assert.ok(!b.some((i) => i.jid === 'me@localhost'));
  // The OIDC claim binds only the profile's own IRI as agent.
  assert.equal(agentIri(claims.find((c) => c.kind === 'oidc')), ME);
});

// The same cases as the #guard lines of L4Factoidal/Identity/Binding.lean.
test('agrees with the Lean module\'s checks', () => {
  const p = 'https://pod/me#i';
  const claims = [{ kind: 'profile', iri: p }, { kind: 'didKey', did: 'did:key:zA' }, { kind: 'xmpp', jid: 'me@x' }, { kind: 'xmpp', jid: 'eve@x' }];
  const evs = [{ kind: 'keyProof', did: 'did:key:zA' }, { kind: 'xmppReply', jid: 'me@x', profile: p }, { kind: 'xmppReply', jid: 'eve@x', profile: 'https://pod/eve#i' }];
  assert.deepEqual(bound(p, claims, evs), claims.slice(0, 3));
  assert.equal(supports(p, { kind: 'oidcToken', iss: 'i', sub: 'https://x', profile: p }, { kind: 'oidc', iss: 'i', sub: 'https://x' }), false);
  assert.equal(applyDiff(lineDiff('a\nb\nc', 'a\nx\nc'), 'a\nb\nc'), 'a\nx\nc');
  assert.deepEqual(lineDiff('a\nb\nc', 'a\nx\nc'), { pre: 1, del: 1, ins: ['x'] });   // diffPS
});

test('line diffs replay, through their unified text, for many edits', () => {
  const rnd = (seed) => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const r = rnd(7);
  let text = '';
  const versions = [''], diffs = [];
  for (let n = 0; n < 200; n++) {
    const ls = text === '' ? [] : text.split('\n');
    const at = Math.floor(r() * (ls.length + 1)), cut = Math.floor(r() * 3);
    const add = Array.from({ length: Math.floor(r() * 3) }, () => ['a', 'b', '', 'x y'][Math.floor(r() * 4)]);
    ls.splice(at, cut, ...add);
    const next = ls.join('\n');
    const u = unifiedDiff(text, next);
    if (!u) continue;
    assert.equal(applyDiff(lineDiff(text, next), text), next);
    assert.deepEqual(parseUnified(u), lineDiff(text, next));
    diffs.push(u); versions.push(next); text = next;
  }
  assert.deepEqual(replayChanges(diffs), versions);
});

function fakePod() {
  const files = new Map();
  const pod = async (verb, { path, body, ifNoneMatch } = {}) => {
    if (verb === 'pod.get') return files.has(path) ? { ok: true, body: files.get(path) } : { ok: false, status: 404, reason: 'http' };
    if (verb === 'pod.put') { if (ifNoneMatch && files.has(path)) return { ok: false, status: 412 }; files.set(path, body); return { ok: true }; }
    if (verb === 'pod.list') return { ok: true, items: [...files.keys()].filter((k) => k.startsWith(path)).map((k) => ({ path: k })) };
    return { ok: false };
  };
  return { pod, files };
}

test('FoafProfile saves only a conforming profile, and keeps a diff for each change', async () => {
  const { pod, files } = fakePod();
  let t = 0;
  const prof = new FoafProfile({ pod, engine, me: ME, now: () => new Date(Date.UTC(2026, 10, 11, 12, 0, t++)) });
  assert.equal((await prof.save(CARD, { note: 'first' })).saved, true);
  const second = CARD.replace('foaf:name "Me"', 'foaf:name "Me Again"');
  assert.equal((await prof.save(second)).saved, true);
  assert.equal((await prof.save(second)).reason, 'unchanged');
  assert.equal((await prof.save(CARD.replace('<did:key:zDnaeA1#zDnaeA1>', '<https://evil.example/k>'))).reason, 'shape');
  const ch = await prof.changes();
  assert.equal(ch.length, 2);
  assert.equal(ch[0].note, 'first');
  assert.match(ch[1].diff, /^-  foaf:name "Me" ;$/m);
  assert.match(ch[1].diff, /^\+  foaf:name "Me Again" ;$/m);
  assert.deepEqual(replayChanges(ch.map((c) => c.diff)), ['', CARD, second]);
  assert.equal(files.get('card.ttl'), second);
  const b = await prof.bindings([{ kind: 'keyProof', did: 'did:key:zDnaeB2' }]);
  assert.deepEqual(b.bound.map((i) => i.agent), [ME, 'did:key:zDnaeB2']);
});
