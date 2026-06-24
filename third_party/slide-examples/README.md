# Slide example decks (edot slides)

A small, well-licensed library of example slide decks for the **edot slides**
app (`magpie/edot/slides/`). They are loadable as samples in the app
(**File ▸ Samples**) and double as **import-fidelity / round-trip test
fixtures** (`magpie/edot/slides/test-samples.mjs`).

Everything here that is *authored-for-edot* is dedicated to the public domain
under **CC0 1.0** (see [`LICENSE`](./LICENSE)). No personal data, no fetched
photos, no fonts — the abstract art is generated SVG (gradients + geometry).

## Provenance & licensing

| File | Origin | License | Source URL | What it tests |
|---|---|---|---|---|
| `corporate.json` | authored-for-edot | CC0 1.0 | — | Plain decks: title, agenda, bulleted content, two-column, section/"thank you". Neutral `ink` theme. The boring baseline. |
| `arty.json` | authored-for-edot | CC0 1.0 | — | Image-forward Keynote style: big type, full-bleed **generated** abstract SVG art as inline `data:` URLs, blank layouts, per-slide backgrounds, `midnight` theme. Exercises image elements + SVG data-URL handling. |
| `equations.json` | authored-for-edot | CC0 1.0 | — | Math as **Unicode** (∑ ∫ √ ∂ ∇, Greek, super/subscripts, unicode fractions). Documents the OMML gap (see note below). `paper` theme. |
| `multilingual-rtl.json` | authored-for-edot | CC0 1.0 | — | **Bidi**: English + Arabic + Hebrew + CJK mixed in the same deck *and same slides*, incl. a two-column English⇄Arabic and English⇄Hebrew glossary and mixed-direction lines. UTF-8 + XML-escaping of RTL runs. |
| `torture.json` | authored-for-edot | CC0 1.0 | — | Edge cases: very long bullets, 5 indent levels, special chars/emoji, XML-hostile text (`< > & " ' </a:t> <script>`), an **empty** slide, an **image-only** slide, bold/italic combos, 16 slides for nav stress. |
| `corporate.pptx` | authored-for-edot (exported by edot) | CC0 1.0 | — | Real `.pptx` produced by the app's own exporter from `corporate.json`. Tests export→import round-trip and gives a clean foreign-tool-openable file. |
| `multilingual-rtl.pptx` | authored-for-edot (exported by edot) | CC0 1.0 | — | Real `.pptx` from `multilingual-rtl.json`. Verifies RTL/CJK strings survive PPTX XML (UTF-8) and round-trip. |
| `equations.pptx` | authored-for-edot (exported by edot) | CC0 1.0 | — | Bonus real `.pptx` from `equations.json`. Unicode math through the PPTX path. |
| `torture.pptx` | authored-for-edot (exported by edot) | CC0 1.0 | — | Bonus real `.pptx` from `torture.json`. Stresses many slides, images, escaping. |

### Reproducing the fixtures
- JSON decks: `node build-decks.mjs` (regenerates all five `.json`, including the SVG art).
- PPTX files: `node build-pptx.mjs` (runs the app's PPTX exporter in headless Chromium).

Both scripts are CC0 and live in this folder.

## Note on the equations deck (OMML)
Real PowerPoint equations are stored as **OMML** (Office Math Markup Language)
math runs. The edot PPTX exporter (`slides-formats.js`) does **not** emit OMML —
it has no math-run support. `equations.json` therefore represents every formula
as plain **Unicode** text, which round-trips losslessly *as text* but will not
become a native equation object in PowerPoint. This is stated in the deck's
first-slide notes too.

## Foreign-deck fidelity testing — pending a license-clear source
The decks above all originate from edot itself, so they test our own JSON
round-trip and our PPTX export→import. They do **not** test importing decks made
by *foreign* tools (PowerPoint, Keynote, LibreOffice Impress, Google Slides).

That kind of fixture was deliberately **omitted** here: per this repo's
data-ethics / licensing culture ("when in doubt, ask — don't ship"), we only
include a file whose license is open and verifiable. No suitably-licensed
real-world `.pptx`/`.odp` was verified at authoring time. Candidates to add
later, **only after confirming the license on the actual file**:

- python-pptx test fixtures (project is MIT-licensed) —
  `https://github.com/scanny/python-pptx` (verify the specific test file's terms).
- Wikimedia Commons presentations explicitly tagged CC0 / CC-BY (record the
  file's Commons page URL + author + license).
- Any deck shipped under an explicit CC license by its author.

When such a deck is added: drop the file here, add a row to the table above with
its **exact source URL, license, and author**, and (if its license requires it,
e.g. CC-BY) keep the attribution with the file. Do not add it to `index.json`
unless its license permits redistribution.
