# KGX - Oxigraph + ImageSnippets SPARQL Demo

Client-side RDF store powered by Oxigraph WASM, demonstrating SPARQL queries on ImageSnippets LIO ontology data.

## Quick Start

```bash
# Serve the public directory
npx serve public
# or
python -m http.server 8000 --directory public
```

Then open http://localhost:8000

## Features

- **Oxigraph WASM**: Full SPARQL 1.1 query engine running in browser
- **ImageSnippets LIO Ontology**: Demo data using `lio:Image`, `lio:depicts`, etc.
- **Query Types**: SELECT, CONSTRUCT, and ASK queries supported
- **Example Queries**: Pre-built queries for common operations
- **Stats Display**: Triple count, load time, query time

## Files

- `public/index.html` - Main application
- `public/web.js` - Oxigraph WASM JavaScript bindings
- `public/web_bg.wasm` - Oxigraph WASM binary

## Demo Data

The demo includes 10 sample images with depicts relations to DBpedia resources:

- Eiffel Tower, Great Wall of China, Machu Picchu
- Northern Lights, Taj Mahal, Grand Canyon
- Colosseum, Mount Fuji, Santorini, Victoria Falls

## Key Oxigraph API

```javascript
import init, { Store } from './web.js';
await init();
const store = new Store();

// Load Turtle data
store.load(turtleString, { format: 'text/turtle' });

// SELECT query
for (const binding of store.query('SELECT ?s ?p ?o WHERE {?s ?p ?o}')) {
    console.log(binding.get('s').value);
}

// CONSTRUCT query
for (const quad of store.query('CONSTRUCT {...} WHERE {...}')) {
    console.log(quad.subject.value, quad.predicate.value, quad.object.value);
}

// ASK query
const bool = store.query('ASK { ?s ?p ?o }');
```

## Deployment

This is a static web app - deploy the `public/` directory to any static host (GitHub Pages, Netlify, etc.).
