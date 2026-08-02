# RETRACTED: "OWL-RL range rule types the SUBJECT" — my display artifact

**Correction 2026-08-02, same day.** The factoidal side is right and
the original claim below is WRONG. The OWL-RL range rule is sound.
Rerunning the minimal repro printing FULL IRIs (no shortening):

```
doc1 a "http://www.w3.org/2002/07/owl#Thing"
doc1 a "__rl_svf_http://ex/maker__on__http://ex/Person"
doc1 a "__rl_minqc1_http://ex/maker__on__http://ex/Person"
doc1 a "__rl_maxqc1_http://ex/maker__on__http://ex/Person"
doc1 a "__rl_exactqc1_http://ex/maker__on__http://ex/Person"
EXACT doc1 a http://ex/Person present: false
```

No binding contains `doc1 a <http://ex/Person>`. My harness shortened
term IRIs with `.split(/[/#]/).pop()`, which collapses the engine's
internal comprehension-witness classes
(`__rl_svf_http://ex/maker__on__http://ex/Person` etc.) to exactly
`Person`. The "4 duplicate rows" were four distinct witness classes
(someValuesFrom, min-/max-/exact-cardinality-1) — the fingerprint of
the comprehension layer, as the rebuttal said. Every "unsound" card
observation ("Overview.html a Person", "card#i a OnlineAccount") is
the same collapse.

Lesson recorded: never diff or display shortened terms; compare full
IRIs, shorten only at the last render step. `layerviz/rdf.html`'s
closure now filters `__rl_*` witness classes so they cannot surface
as implied facts.

One residual question for factoidal (observation, not a bug claim):
is it intended that `__rl_*` witness classes appear in user-facing
SELECT bindings under `entail: 'OWL-RL'` (and pass `FILTER(isIRI(?t))`
despite not being IRI-shaped)? A consumer must know to filter them.

## Still-standing findings (verified without shortening)

- `FILTER EXISTS` / `FILTER NOT EXISTS` return empty results even in
  the plain single-pattern form; `MINUS` evaluates correctly.
  (Empty result sets — no display step involved.)
- Statements with unresolvable relative IRIs are dropped silently —
  always pass `baseIRI` (dataset size 19 vs 86 on timbl's card).
  Parse errors generally silent-drop rather than throw.
- npm README quickstart shows sync `parse`/`query`; the API is async.

---

## Original (wrong) report, kept for the record

Build: `@danbri/foafos` 0.1.0-alpha.0, gitSha `e3f9e2f8…`, builtAt
2026-07-21. Claim was: given `:doc1 :maker :alice .` and
`:maker rdfs:range :Person .`, OWL-RL infers `:doc1 a :Person` (4
rows), i.e. prp-rng typing the subject. Actual cause: shortened
display of witness classes, as above.
