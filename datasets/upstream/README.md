# ImageSnippets Dataset

This folder contains RDF data dumps from [ImageSnippets.com](https://imagesnippets.com).

## Data Source

- **Website**: https://imagesnippets.com
- **SPARQL Endpoints**:
  - `https://imagesnippets.com/sparql/images` (triples only)
  - `https://imagesnippets.com/sparql/imgtag` (quads with provenance)
- **Contact**: info@metadata.rocks

## Files

| File | Description | Triples | Size |
|------|-------------|---------|------|
| `imagesnippets-10k.ttl` | Small sample (10k triples) | ~10,000 | ~1MB |
| `imagesnippets-50k.ttl` | Medium sample (50k triples) | ~50,000 | ~6MB |

## Vocabularies Used

- **LIO** (Linked Image Ontology): `https://w3id.org/lio/v1#`
- **Schema.org**: `https://schema.org/`
- **DBpedia**: `http://dbpedia.org/resource/`
- **Getty AAT**: `http://vocab.getty.edu/aat/`
- **Wikidata**: `http://www.wikidata.org/entity/`

## Key Predicates

- `lio:depicts` - What entities are depicted in the image
- `schema:name` - Image title/name
- `schema:thumbnail` - Thumbnail URL
- `schema:contentUrl` - Full-size image URL
- `rdfs:label` - Labels for depicted entities

## Usage

These dumps are provided for demo/research purposes with the Oxigraph SPARQL demo.
For production use or licensing, contact ImageSnippets directly.

## Fetched

Data fetched: December 2024

Query used:
```sparql
CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 50000
```

## License

Contact ImageSnippets (info@metadata.rocks) for licensing information.
