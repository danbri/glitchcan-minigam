# gcfink

Glitch Canary FINK core utilities — the platform layer of the finkiverse,
free of any story content.

A `.fink.js` file is a **polyglot document**: executable JavaScript whose
only job is to hand typed text blocks to whoever is listening, via tagged
template literals ("sigils"). `oooOO` is the sigil whose media type happens
to be Ink.

```js
import { extractBlocks, inkOf, compileInk, lintTagUrls } from 'gcfink';

const { blocks } = extractBlocks(finkJsSource);
// [{ sigil: 'oooOO', mediaType: 'text/x-ink', raw: '...', index: 0 }, ...]

const ink = inkOf(blocks);            // legacy view: unique ink blocks, joined
const { ok, story } = compileInk(ink, { compilerImpl });
const warnings = lintTagUrls(ink);    // catches unescaped // in tag values
```

Content files can carry more than Ink, without registry changes:

```js
oooOO`-> start`;
OO('text/turtle')`@prefix foaf: <http://xmlns.com/foaf/0.1/> . ...`;
OO('application/vnd.fink.playlist+json')`{"tracks": []}`;
```

## Invariants (do not break)

- **Raw capture.** Sigils capture `strings.raw`. Ink tag values escape `//`
  as `\/\/` (the ink compiler treats `//` as a comment even inside tags);
  only raw capture preserves the backslashes. See `test/inkCompile.real.test.js`,
  which locks the compiler behavior empirically.
- **Back-compat.** `extractFinkFromJsSource` keeps the original single-string
  contract: unique `text/x-ink` blocks, document order, newline-joined.
- **No story content.** This package ships mechanisms only. The one default
  binding is `oooOO → text/x-ink`; hosts register everything else.

## Platform contract notes

- The finkapp player injects a private `=== _inventory ===` knot into every
  story it compiles; stories may divert to it. Standalone validators must
  stub it (see `test/corpus.real.test.js`).

## Tests

```
npm test   # zero-dependency runner; includes a whole-corpus extract+compile
           # pass over inklet/**/*.fink.js using the vendored ink compiler
```

Lifted from the `app2-wip` branch's `gcfink` prototype (2025) and extended
with the typed sigil registry, 2026.
