# @foafos/backticks — the frozen capture contract

This module is a **security-relevant primitive**. It is the single
definition of how a `.fink.js` polyglot hands typed text blocks to a host.
It is small on purpose: small enough to audit in one sitting, and frozen so
that an audit stays valid.

## What "frozen" means

The behaviours below are the v1 contract. Changing any of them is a
**major** version bump, because callers (the browser sandbox, finkcore, the
Node tools) rely on byte-for-byte output.

1. **Raw capture.** `strings.raw.join('')`. Never cooked. Ink tag values
   escape `//` as `\/\/`; only raw capture keeps the backslashes the ink
   compiler unescapes. Cooked capture silently breaks every absolute URL.
2. **Defensive stringify.** A sigil invoked with a non-template argument
   stringifies it; `null`/`undefined` become `''`, never the literal
   `"undefined"`. (This unified a latent divergence — the old browser copy
   used `String(strings)` and would have injected `"undefined"`.)
3. **Sigils.** `oooOO` → `text/x-ink` is the one built-in. `OO(mediaType)`
   is the curried escape hatch. A host may register more.
4. **Two extraction views, both named.** `inkOf` = unique ink blocks,
   document order, joined by a **real** newline. `firstInkOf` = the first
   ink block's raw text (the live browser player's single-block contract).
5. **The browser installer** (`INSTALL_CAPTURE_SOURCE`) is byte-equivalent
   to the kernel. It emits its one newline via `String.fromCharCode(10)` so
   it can never fall into the `'\n'` vs `'\\n'` join bug that once hung
   story loading (CLAUDE.md). `test/browser-source.test.js` proves the
   equivalence and pins the newline.

## What this module is NOT

**Not an isolation boundary.** It does not sandbox untrusted `.fink.js`. It
runs *inside* an isolate the caller provides:

| environment | isolate the caller supplies |
|---|---|
| browser player | opaque-origin `<iframe sandbox="allow-scripts">` |
| Node tools/tests | `node:vm` (a soft boundary — see below) |

`node:vm` is not a hard security boundary; a determined source can reach
out of it. That is why `extractBlocks` is a thin adapter and the trust
boundary for genuinely untrusted input stays with the caller's isolate —
for the live player, the iframe. See
`docs/fink-story-sandbox-threatmodel-20260728.md`.

**Two entry points, so the kernel is browser-safe.** `.` (`src/index.js`)
is the PURE kernel — no Node builtins — importable in a browser (the boxed
story runner `inklet/apps/storyrunner/` imports it directly). `./node`
(`src/node.js`) adds `extractBlocks` (the `node:vm` isolate) and re-exports
the kernel, so a Node caller gets everything from one place. A bare
`import 'node:vm'` in the kernel would have thrown at load in the browser —
keeping it out of `index.js` is what makes "one definition, both
environments" real.

## Provenance

Extracted July 2026 from two hand-copied implementations that had already
diverged (null-handling; all-blocks vs unique-join). Consolidating them was
the point: a security primitive that lives in two forms cannot be frozen or
audited. finkcore re-exports this kernel; the browser sandbox rewire to
`INSTALL_CAPTURE_SOURCE` is a gated follow-up (do not casually modify the
live sandbox — CLAUDE.md).
