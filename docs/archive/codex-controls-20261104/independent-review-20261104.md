*** Add File: /tmp/factoidal-foafos-control-independent-review.md
# Independent typed-control review — 4 November 2026

Reviewed `/private/tmp/factoidal-foafos-chat-control` read-only. The author made
the production fixes; this review changed no production files. No browser,
ports, installation, build or release action was used.

## Findings and verified fixes

1. **SDK reply provenance bypass.** A non-parent `verb.result` carrying the RID
   of a pending `control.call` originally resolved its shared waiter with forged
   success. The fix requires both the real parent and the expected
   `control.result` type for control RIDs. The independent probe now remains
   unsettled for the forged reply; the actual SDK regression accepts the later
   authentic response.
2. **In-flight scope revocation.** Replacing the caller's AppTree controls scope
   originally left its cooperative handler signal active. Actor cancellation
   controllers now observe AppTree scope/close events. The probe observes an
   aborted signal, no cooperative side effect and a `revoked` result.
3. **Worker timeout and queue growth.** The console dropped the broker signal and
   kept worker pending entries after timeout. An actual Node worker running the
   unchanged browser worker with deliberate infinite-loop parse failure injection
   originally accumulated 201 unanswered posts and zero terminations. The fix
   passes cancellation through, permits one pending worker request, terminates
   and resets on abort, removes pending state and ignores stale worker generations.
   The same probe now produces three posts and three terminations; each of two
   100-request read batches admits one timed-out call and refuses 99 as busy.
4. **Null request envelope.** `invoke(actor, null)` originally dereferenced the
   cloned null outside validation. The final object/null guard returns the normal
   `bad-request` envelope, with a regression assertion.

After the final runtime change, the independent focused suite passes **9/9**,
zero skips. It includes actual production worker source on a Node worker thread
and the existing released Factoidal engine, not emulated RDF/SPARQL results.
The infinite-loop module is explicitly a failure-injection fixture, not an
implementation or conformance oracle. Author separately reports 92/92 canonical
package tests; that wider count was not independently rerun here.

## Boundaries checked

- AppTree records/scopes are immutable views. The shell derives the actor from
  the verified iframe source; supplied actor fields cannot select authority.
  Current capabilities and the host-recorded target/verb scope are checked.
- Requests, results and replay/history caches have explicit bounds. The worker
  bridge now has a one-request pending bound and actual termination on timeout.
- Generic noncooperative handlers can complete side effects despite cancellation;
  the broker retains mutation exclusion until their actual work ends. No rollback
  of already completed effects is claimed. Cooperative handlers must honor their
  signal; the private compositor worker can be forcibly terminated/reset.
- Inbound MUC text only updates chat/events. It is not parsed as local commands.
  Mirrored control summaries exclude arguments and result payloads.
- The current WebMCP draft uses `document.modelContext.registerTool` and execution
  options `{signal}`. The adapter follows that shape, reports feature absence
  and registers only read-only verbs. Its injected-shape test is not a real
  browser WebMCP discovery or interaction test. No such browser test ran here.

Primary API references:
https://webmachinelearning.github.io/webmcp/
https://developer.chrome.com/docs/ai/webmcp/imperative-api

## Reproduction commands

```sh
FACTOIDAL_CONTROL_TEST_CORE=/Users/danbri/working/sandbox/october/tpac/depmap/node_modules/@factoidal/core/index.mjs \\\\
  /opt/homebrew/opt/node@22/bin/node --test \\\\
  packages/foafos/test/controls.test.js packages/foafos/test/control-worker.test.js
/opt/homebrew/opt/node@22/bin/node /tmp/factoidal-control-review-repros.mjs
/opt/homebrew/opt/node@22/bin/node /tmp/factoidal-control-worker-review.mjs
```

Working directory: `/private/tmp/factoidal-foafos-chat-control`.
The worker probe always terminates its injected stuck workers in cleanup.
*** End Patch\"));
", "internal_chat_message_metadata_passthrough": {"turn_id": "01a1a749-1729-7570-a1f2-60793d0cbe2a", "create_time": 1793808358.1619072}}}