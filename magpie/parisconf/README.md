# Paris Colloquium 1951 — Calculating Machines and Human Thought

A bilingual (French / English) digitization of a real primary source in the
history of computing and AI:

> **Colloque International "Les Machines à Calculer et la Pensée Humaine"**
> (*International Colloquium: Calculating Machines and Human Thought*)
> Institut Blaise Pascal, C.N.R.S. — **Paris, 8–13 January 1951**

This colloquium predates the word *ordinateur* (1955) and the Dartmouth summer
project (1956). It captures a pivotal European moment in cybernetics and the
"can machines think?" question, in period vocabulary (*machines à calculer*),
with figures including Louis de Broglie (presiding the first section), and
contributions across the calculating-machine and brain/computer-analogy themes.

> ⚠️ **History note:** an earlier version of this README described a "1953 Paris
> conference on machine translation." That was wrong — a different conference,
> topic, and year. The document digitized here is unambiguously the **1951**
> colloquium on calculating machines and human thought (see the title page,
> `original-fr-p-001.md`, and both concept indexes).

## Source

- [`102805935-05-01-acc.pdf`](./102805935-05-01-acc.pdf) — the scanned proceedings.
  Computer History Museum copy (barcode `102805935`), which came via the
  Institut für Praktische Mathematik, TH Darmstadt (library stamps on the
  opening/closing pages).

## What's here (transcription + translation are complete — 128 pages each)

- `original-fr-p-001.md` … `original-fr-p-128.md` — full French transcription.
- `translated-en-p-001.md` … `translated-en-p-128.md` — full English translation.
- `original-fr-p-001.jpg` … `-128.jpg` — page images.
- `concepts-fr.md` / `concepts-en.md` — bilingual concept indexes (people,
  institutions, machines, concepts) with page references.
- `translation-skill.md` — translation guidelines used for the English text.
- `photos.ttl` — RDF metadata.
- `index.html` — a self-contained bilingual **reader web-app**: FR/EN toggle,
  page navigation (1–128) with URL-hash deep-linking + keyboard arrows,
  text / image / side-by-side views, an image lightbox, and a concept
  tag-cloud that filters to the pages mentioning each concept.

## Running the reader

`index.html` fetches the per-page `.md`/`.jpg` files at runtime, so it must be
**served over HTTP** (it will not work from a `file://` URL):

```bash
cd magpie/parisconf && python3 -m http.server 8080
# then open http://localhost:8080/index.html
```

## Notes for a future editor

- The concept → page-number arrays inside `index.html` are **hand-maintained**,
  not generated from the transcriptions, so they can silently drift. Consider
  auto-deriving them from the `concepts-*.md` / page text.
- The corpus itself is complete; future value is in enrichment — linking
  `photos.ttl`, cross-referencing speakers to the concept index, or a proper
  Markdown renderer. This is a serious history-of-AI primary-source edition,
  not a demo.
