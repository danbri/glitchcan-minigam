# @foafos/backticks

The FINK sigil capture kernel. A `.fink.js` file is a polyglot — executable
JavaScript whose only job is to hand typed text blocks to a host through
**tagged template literals**:

```js
oooOO`
=== start ===
Hello, docks.
-> END
`;
OO('text/turtle')`@prefix foaf: <http://xmlns.com/foaf/0.1/> .`;
```

This module is the single, frozen definition of how those backticks are
captured — raw, in document order, one built-in sigil (`oooOO` →
`text/x-ink`) plus a curried escape hatch `OO(mediaType)`.

## It is not a sandbox

It does **not** isolate untrusted `.fink.js`. It runs *inside* an isolate
the caller supplies — an opaque-origin iframe in the browser, `node:vm` in
Node. The contract is: *given* isolation, capture is deterministic,
raw-preserving, and side-effect-free beyond the blocks returned. Read
`FROZEN.md`.

## Use

```js
import { extractBlocks, inkOf, firstInkOf } from '@foafos/backticks';

const { blocks } = extractBlocks(fileSource);   // Node: runs in node:vm
inkOf(blocks);        // unique ink blocks, newline-joined
firstInkOf(blocks);   // just the first ink block (browser player contract)
```

Browser: inject `INSTALL_CAPTURE_SOURCE` into your sandboxed iframe; it
installs the sigils on the frame's `window` and returns a
`__backticksHarvest()` that yields `{ blocks, ink, firstInk }` — the same
bytes the Node kernel produces (proved in `test/browser-source.test.js`).

## Test

```
npm test
```

Two files: `kernel.test.js` pins the frozen contract; `browser-source.test.js`
proves the browser installer is byte-equivalent to the kernel and that the
ink join is a real newline, never `\n`.
