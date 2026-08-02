# factoidal npm build: OWL-RL range rule types the SUBJECT

Found 2026-08-02 while wiring the npm build into
`layerviz/rdf.html`'s closure button.

**Build:** `@danbri/foafos` 0.1.0-alpha.0, `version.json` gitSha
`e3f9e2f8186c4ae98ce02219ca0c6c880cc372d4`, builtAt
2026-07-21T04:35:59Z (Pages mirror `docs/npm/foafos`, factoidal repo
commit `668c70a`). Node 22.

## Repro (Node, `npm/factoidal/index.mjs`)

```js
const ttl = `
@prefix : <http://ex/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
:alice a :Person .
:doc1 :maker :alice .
:Person a rdfs:Class .
:maker rdfs:range :Person .`;
const ds = await parse(ttl, { format: 'turtle' });
const rows = await query(ds, 'SELECT ?s ?t WHERE { ?s a ?t }',
                         { entail: 'OWL-RL' });
```

**Actual:** bindings include `:doc1 a :Person` (4 duplicate rows).
The `rdfs:range` rule (prp-rng) types the triple's SUBJECT; it must
type the OBJECT.

**Expected:** no `:doc1 a :Person`; range only confirms
`:alice a :Person`.

**RDFS regime is correct** on the same input — OWL-RL only. OWL-RL
`owl:inverseOf` is also correct on the same data.

## Real-world effect

On timbl's FOAF card + FOAF axioms (`layerviz/rdf.html` data), OWL-RL
types `DesignIssues/Overview.html a foaf:Person`,
`card#i a foaf:OnlineAccount`, and similar for every domain/range
axiom touching the entity.

## Related findings, same build, same session

- `FILTER EXISTS` / `FILTER NOT EXISTS` return empty results even in
  the plain single-pattern form; `MINUS` evaluates correctly.
- Statements with unresolvable relative IRIs are dropped silently —
  always pass `baseIRI`. Parse errors generally silent-drop rather
  than throw.
- npm README quickstart shows sync `parse`/`query`; the API is async.
