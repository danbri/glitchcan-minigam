# Branch and draft-PR audit, four repositories (2026-11-04)

Owner, 2026-11-04, verbatim: "Re drafts, I think also we may have good work lost in branches or wrong
repo or confused because we switch claud and gpt sometimes".

This audit was read-only: nothing was merged, closed or deleted. A subagent did the audit, and this
file records its report. Checks: the new files of each PR or branch were tested against the default
branch, and the default branch's log was searched for the same functions, theorems and documents.
Verdicts:

- **MERGE-READY**: it can be merged now.
- **REBASE-THEN-MERGE**: it must first be rebased on the default branch.
- **SUPERSEDED**: other work already contains it.
- **ABANDON**: it is no longer needed.
- **NEEDS-OWNER**: the owner must decide.

Done the same day: PRs https://github.com/danbri/factoidal-core/pull/298,
https://github.com/danbri/factoidal/pull/694 and glitchcan-minigam #684, #700, #703 and #704 were
merged. Copilot PRs #21 and #19 were closed.

**Two surprises:**
- danbri/factoidal is still active. Its default branch is `claude/main`, and it still has
  `formal/fstar`, `formal/lean4` and `skills/fstar-env`.
- factoidal-core has 6 branches from an older history, with no common ancestor with `main`.

## 1. Draft PRs in danbri/factoidal-core

They are 1 to 7 days old and 123 to 604 commits behind `main`.

| PR | What | Conflicts | CI | Verdict |
|---|---|---|---|---|
| #232 | VC-JOSE-COSE plan (one doc) | no | green | MERGE-READY |
| #262 | XPath/XQuery version modes 1.0–4.0; 348 files, with committed `.log` files | yes | Lake build fails | REBASE-THEN-MERGE: fix the build, drop the logs (issue 1101) |
| #263 | Static typing, first version | yes | green | SUPERSEDED by #281 |
| #264 | XSD 1.0 configuration | yes | green | REBASE-THEN-MERGE (`Qt4Run` on `main` accepts only xsd-version 1.1) |
| #265 | WebDAV executable tests for authenticated LWS | yes | green | NEEDS-OWNER: it lists the 0.26.0 blockers, and 0.28 is out |
| #278 | `parse-QName` keeps static namespaces | no | green | MERGE-READY |
| #279 | Scoped-query provider grants; contains #283 | no | green | MERGE-READY (lands #283 too) |
| #281 | Optional static typing on the current engine | yes | green | REBASE-THEN-MERGE |
| #283 | SERVICE variable correlation | yes | green | SUPERSEDED by #279 |
| #286 | Union adapter proof | yes | green | SUPERSEDED by #288 |
| #288 | Normalisation into RDFS closure; contains #286 | no | green | MERGE-READY |
| #289 | RDF-to-XML admission counterexample | yes | green | NEEDS-OWNER: #290 now refuses those values; keep the note? |
| #290 | Checked conditional routing, XML-or-diagnostic reports | yes | green | REBASE-THEN-MERGE (its native and fresh wasm tests are pending) |
| #300 | One egress decision for outbound requests (issue 1126, open) | yes | Lake build fails | REBASE-THEN-MERGE, then a security review |
| #310 | Pins the whole WPT SVG subtree: 2,515 files, +422k lines | yes | green | NEEDS-OWNER: vendor 422k lines? |
| #312 | Native graphics source preparation | no | green | SUPERSEDED by `main` 48e3ccfce |

## 2. Branches with commits not in the default branch, and no open PR

### danbri/factoidal-core

45 branches are ahead of `main`. The ones skipped below are already in `main`:
- `lws-files-default`, `batch3/kr44-webmcp-llm` and `batch3/kr13-reserve`: fully contained.
- Every commit subject already in main's log:
  - the other `batch3/*` (except `kr11-d19`, `kr11-d19b`);
  - `claude/owl-checked-consistency-review`, `claude/qt4-xquery-2`;
  - `codex/graphics-ci-repairs`, `codex/svg-standards-overnight`, `xmpp-serve`;
  - `codex/web-inventory-ci` (2 of 3 commits).
- `claude/rel020-*`: released.

| Branch | Last commit | Ahead/behind | Summary | Verdict |
|---|---|---|---|---|
| `claude/lean-shaper` | 11-03 | +5/−73 | Lean font shaper (HarfBuzz fallback, CFF); merges cleanly | REBASE-THEN-MERGE: open a PR |
| `codex/spatial-filter-planning` | 11-02 | +3/−213 | GeoSPARQL filter planning; stopped (disk) | NEEDS-OWNER: resume? |
| `wip/1125-1128-xmpp-login` | 11-02 | +5/−179 | XMPP/SASL login limits (issues 1125, 1128) | REBASE-THEN-MERGE; coordinate with #300 (both add `L4Factoidal/Net/`) |
| `wip/lws-reader-paths-lean` | 11-01 | +6/−198 | `containerPath` in Lean for the LWS reader | REBASE-THEN-MERGE |
| `claude/qt4-cfg-xml-layer` | 10-29 | +1/−408 | DTD infoset and namespace axis; stopped at a usage limit | NEEDS-OWNER (issue 1101 set) |
| `claude/xproc31-2` | 10-29 | +1/−417 | XProc 3.1 after PR 249; not measured | NEEDS-OWNER: measure, then open a PR |
| `claude/wasm-components-clock-findings` | 10-29 | +1/−619 | `experiments/wasm-components` | NEEDS-OWNER |
| `claude/rel022-tailrec-allow` | 10-29 | +1/−464 | 10-line allow-list entry; PR #238 closed | ABANDON |
| `claude/docs-0.17-0.19` | 10-28 | +10/−907 | README notes for 0.17–0.19; PR #151 closed | ABANDON |
| `claude/kr1-1025-medium-dataflow-draft` | 10-27 | +5/−1267 | `openSbm11Store` over a medium | NEEDS-OWNER (`QuerySession.lean`, `MediumHost.lean` not in `main`) |
| `port/laptop-20260908-owl-dl` | 10-26 | +2/−1162 | 16k lines of laptop work (OWL DL refuter, SPARQL) under `_lostandfound` | NEEDS-OWNER: the canonical copy of this rescue |
| `fix/issue-961-fd` | 10-24 | +2/−1443 | "Experiment (not for main)" | ABANDON, after noting the result on issue 961 |
| `batch3/kr11-d19b` | 10-22 | +7/−1697 | Two IdAgg aggregation commits not in `main` | NEEDS-OWNER (minor) |
| `claude/wt-fstar-catchup` | 10-21 | +6/−1910 | F* catch-up work in progress; "does not build" | NEEDS-OWNER: is F* still kept? |
| 6 old-history branches (`claude/main`, `claude/standards-reuse-20261022`, `claude/hash-grouping-wip-20261022`, `claude/values-seeded-join-wip-20261023`, `claude/autoexec-scratchpad-assess-37oeok`, `archive/codex-906527b`) | 08-22 to 10-23 | no common ancestor | An earlier history of this repo | NEEDS-OWNER for `values-seeded-join` ("rescued from uncommitted checkout"); the rest ABANDON or archive |

### danbri/factoidal (default branch `claude/main`)

33 branches are ahead of `claude/main`, and 1 of them has an open PR. These are skipped as already
in `claude/main`:
- `mathml-*`, `claude/cl-ikl-wasm-abi`, `harness/spec-inventory`, `vc-*`;
- `worktree-agent-rif-tail`, `worktree-tableau-refute`;
- `claude/roaring-*`, `claude/shacl-skeleton`, `claude/docs-stale-score-refresh`;
- `lean4/rdfs-rhodf`, `claude/backport-rhodf-hypotheses-474`, `claude/workflow-tightening-*`;
- `claude/autoexec-*`, `claude/fstar-turtle-parser-*`.

**In the wrong repo** (Lean engine work that belongs in factoidal-core):
- `triple-provenance` (09-20): `TurtleProvenance.lean`, in neither repo. NEEDS-OWNER: port it to
  core?
- `wt/named-graph-scale` (09-08): `NamedGraphQueryTests.lean`, in neither repo. NEEDS-OWNER.
- `archive/laptop-unpushed-refs-20261026` and `archive/laptop-20260908-owl-dl`: SUPERSEDED by
  core's `port/laptop-20260908-owl-dl`.
- `claude/xmpp-serve`: SUPERSEDED (core has xmpp-serve).

**F*-era branches (July):** NEEDS-OWNER. If the F* OWL and tableau results are not wanted, ABANDON.
- `claude/tableau-classification-20260728`, `claude/owl-closure-rules-20260728`;
- `claude/build-soundness-20260729`, `claude/owl-semantics-soundness-pilot-20260729`;
- `owl-annot-axioms2`, `rescue/worktree-agent-af2283d6ee9213c15`.

**F*-era branches (May):** ABANDON.
- `claude/rdfc10-*` (committed binaries);
- `claude/owl-cls-maxqc1-parent7-fix` (no net change).

**Docs worth rescuing:**
- `claude/research-rdf-datasets-tvQYj` (an RDF dataset survey);
- `skill-rollback-discipline` (one skill paragraph).

`claude/fix-mobile-session-loop-BVMDc` (a Stop-hook escape hatch): NEEDS-OWNER.

### danbri/glitchcan-minigam (default branch `master`)

- **Skipped:** the merged leftovers, and `claude/new-repo-skills-hj8gih` (its files are on
  `master`). The `copilot/fix-*` branches: ABANDON.
- **Unmerged, with no PR:**
  - `claude/audio-encoding-js-port-*` (2025-12), the DanjaBeep FSK encoder: NEEDS-OWNER;
  - `claude/estate-json-map-8qmWC` (04-29), Forget-Me-Not Palace: NEEDS-OWNER
    (`palace/palace.html` on `master` may be a later version);
  - `claude/explore-web-os-timeline-mhA7R` (01-22), skunkworks design docs: rescue as docs;
  - `claude/issue-337-*`, vec2/3/4 Lucid parameters (issue 337, open): REBASE-THEN-MERGE or do it
    again;
  - `claude/issue-378-*` (closed issue), `claude/hash-id-url-links-*`,
    `claude/setup-qa-monitoring-*` and `claude/install-chrome-binary-*`: ABANDON.
- No Factoidal engine work is in this repo.

### danbri/londat

- `adsb-cache` and `live-cache` are cache data, rebuilt each day. Leave them.
- `wip/agents-2026-10-11`: SUPERSEDED.

## 3. danbri/factoidal PR #260

https://github.com/danbri/factoidal/pull/260 ("docs: fix setup gaps in README + fstar-env skill",
May 2026). It is F* setup documentation, together with the F* Parquet migration for issue #103 and
committed build files (`.cmi`, `.cmx`, `.o`, `bin/linux-x86_64/*`).

F* is still in `claude/main`, and issues #103 and #566 are open. The migration has not landed.

**Doc parts worth a new docs-only PR on `claude/main`** (no binaries, no `.ml`):
1. `README.md`: the "About `eval $(opam env --switch=fstar)`" section, and the z3 4.13.3 install
   and check.
2. `skills/fstar-env/SKILL.md`: the opam `z3` package (4.15.x) is the wrong version, and the native
   and JS opam installs are separate. Merge it by hand, because part of it has landed already.
3. `skills/build-and-test/SKILL.md`: replace the stale "expected '4.8.5', got '4.13.3'" row with
   "expected 4.13.3, got 4.15.x".
4. "Never close an epic tracker until its done criteria are ticked", in
   `skills/issue-hygiene/SKILL.md` and `docs/claude-rules/anti-patterns.md`. It needs a new rule
   number, because 27 to 29 are taken.

The Parquet migration (Phases A to D and its plan document) belongs to issue #103. It is about 5,100
commits behind.

## 4. Actions, 2026-11-04 (later the same day)

Owner, verbatim: "keep crankign on all this!"

- **Merged:** https://github.com/danbri/factoidal-core/pull/232 (VC-JOSE-COSE plan, one doc).
- **Closed as superseded:** https://github.com/danbri/factoidal-core/pull/312 (main 48e3ccfce has it) and
  https://github.com/danbri/factoidal-core/pull/263 (#281 replaces it).
- **Made ready, with main merged in:** #278, #279 and #288. GitHub said #279 and #288 were "CLEAN",
  but a local merge of main had conflicts in `.github/workflows/verify-lean4.yml`,
  `docs/worknotes-index.md` and `skills/semantic-assurance/SKILL.md`. Both sides were kept: the
  `lake build` line has main's `+L4Factoidal.Dataflow.FailureConditions` and the branch's targets.
  They merge after the Lean CI passes. #279 and #288 both change the same `lake build` line, so
  whichever merges second needs the same fix again. #283 and #286 close when #279 and #288 merge.
- **Draft PRs for branches with no PR:** https://github.com/danbri/factoidal-core/pull/336
  (`claude/lean-shaper`), #337 (`wip/1125-1128-xmpp-login`), #338 (`wip/lws-reader-paths-lean`),
  #339 (`port/laptop-20260908-owl-dl`, owner decision) and #340 (`claude/xproc31-2`).
- **PR 260 docs:** https://github.com/danbri/factoidal/pull/1243 on `claude/main`. The `fstar-env`
  skill on `claude/main` was newer than PR 260 (pinned F* version, no opam `z3` package). Its rules
  were kept, and the README hunk was changed to agree with it. The new anti-pattern is rule 30.
- **Release trackers:** https://github.com/danbri/factoidal/issues/893, #1210 and #1211 are closed.
  Their open items are in https://github.com/danbri/factoidal/issues/1242 (0.31.0).
