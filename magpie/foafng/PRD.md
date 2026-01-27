# Kanren-RDF v3 PRD

## Overview

Extend Kanren-RDF v2 with visual compositor, SPARQL 1.1 query support, optimized N-Quads export, and Bloom filter indexing.

## Background

We have a claim-centric RDF system where:

- Claims are named graphs (bundles of triples with provenance)
- Claims can derive from other claims (provenance chains)
- Graph algebra composes datasets: union (+), subtract (-), intersect (∩)
- Composite graph URIs encode derivation: `genid:g1+g2-errata`
- Datatype URIs carry annotations: `"val"^^<xsd:string|ctx:chunk|sig:abc>`

The same abstract triple may appear in many named graphs. We need efficient indexing and compact serialization.

## Features

### 1. Visual Node Compositor

**Goal**: Blender-style node graph for dataset composition with collapsible containers.

**Requirements**:

- Canvas with draggable nodes
- Node types:
  - **Source nodes**: Base claims/named graphs (purple)
  - **Operation nodes**: Union, subtract, intersect, filter-by-shape (blue)
  - **Output nodes**: Materialized views, export targets (green)
- Edges connect node outputs to inputs
- **Collapsible container nodes**: Group multiple nodes into a collapsed "subgraph" node
  - Click to expand/collapse
  - Shows summary when collapsed (e.g., "3 sources → union → filter")
  - Preserves internal wiring when collapsed
- Double-click node to inspect contents
- Right-click context menu for node operations
- Auto-layout option (force-directed)
- Export compositor graph as JSON for save/load

**Data model**:

```javascript
{
  nodes: [
    { id, type, position: {x, y}, data: {...}, collapsed: false },
    { id, type: 'container', children: [nodeIds], collapsed: true }
  ],
  edges: [
    { source: nodeId, target: nodeId, sourcePort, targetPort }
  ]
}
```

### 2. SPARQL 1.1 Query Support

**Goal**: Parse and execute SPARQL 1.1 SELECT queries against the claim store.

**Requirements**:

- Support core SPARQL 1.1 SELECT:

  ```sparql
  SELECT ?x ?y WHERE {
    ?x foaf:knows ?y .
    ?y foaf:name ?name .
    OPTIONAL { ?y foaf:age ?age }
  }
  ```
- Supported features:
  - Basic graph patterns (BGPs)
  - OPTIONAL
  - FILTER with basic expressions (=, !=, <, >, REGEX, BOUND)
  - UNION
  - GRAPH clause for named graph selection
  - ORDER BY, LIMIT, OFFSET
  - PREFIX declarations
- Translate SPARQL to Kanren goals internally
- Display results as table with sortable columns
- Show query execution plan (optional debug view)

**Parser approach**:

- Recursive descent parser for SPARQL grammar subset
- AST representation
- Compile AST to Kanren goal composition

### 3. Optimized N-Quads Export with genid: Abbreviation

**Goal**: Compact N-Quads when same triple appears in many named graphs.

**Problem**: If triple `<s> <p> <o>` appears in 1000 named graphs, naive N-Quads repeats it 1000 times.

**Solution**:

- Detect triples appearing in multiple graphs
- Create composite genid: URI representing the set of graphs
- Emit triple once with the composite URI
- Emit metadata mapping composite URI to constituent graphs

**Format**:

```nquads
# Triple appears in graphs g1, g2, g3, ... g1000
<s> <p> <o> <genid:set-abc123> .

# Metadata (in a special meta graph)
<genid:set-abc123> <genid:contains> <g1> <genid:meta> .
<genid:set-abc123> <genid:contains> <g2> <genid:meta> .
# ... or more compact:
<genid:set-abc123> <genid:containsList> "[g1,g2,...,g1000]" <genid:meta> .
```

**Compression heuristics**:

- Only abbreviate if triple appears in N+ graphs (configurable threshold, default 3)
- Use content-hash for genid: URI (hash of sorted graph URIs)
- Include decompression metadata in export

### 4. Bloom Filter Indexing

**Goal**: Fast probabilistic membership tests for triple patterns across large graph collections.

**Use cases**:

- "Does any graph contain triple matching `?x foaf:knows ex:bob`?"
- "Which graphs MIGHT contain triples with predicate `foaf:name`?"
- Skip graphs that definitely don't match during query execution

**Requirements**:

- Bloom filter per claim/named graph
- Configurable filter size and hash count (tune false positive rate)
- Index keys:
  - `s:{uri}` - subject URI
  - `p:{uri}` - predicate URI
  - `o:{uri}` - object URI (for URI objects)
  - `sp:{s}:{p}` - subject-predicate pair
  - `po:{p}:{o}` - predicate-object pair
  - `spo:{s}:{p}:{o}` - full triple (for exact match)
- Query-time filter:
  - Before scanning a graph, check Bloom filter
  - If filter says "definitely not present", skip graph entirely
  - If filter says "maybe present", scan graph
- Statistics: track filter hits/misses, false positive rate

**Implementation**:

```javascript
class BloomFilter {
  constructor(size = 1024, hashCount = 3) { ... }
  add(key) { ... }
  mayContain(key) { ... }  // true = maybe, false = definitely not

  // Serialize for persistence
  toJSON() { ... }
  static fromJSON(data) { ... }
}

class IndexedClaim extends Claim {
  constructor(...) {
    super(...);
    this.bloom = new BloomFilter();
    this.indexTriples();
  }

  indexTriples() {
    for (const t of this.triples) {
      this.bloom.add(`s:${t.s.value}`);
      this.bloom.add(`p:${t.p.value}`);
      if (t.o instanceof URI) this.bloom.add(`o:${t.o.value}`);
      this.bloom.add(`sp:${t.s.value}:${t.p.value}`);
      // etc.
    }
  }
}
```

**Integration with tripleo**:

```javascript
tripleo(s, p, o) {
  return function* (sub) {
    const ss = sub.walk(s), pp = sub.walk(p), oo = sub.walk(o);

    for (const claim of store.claims.values()) {
      // Bloom filter pre-check
      if (!ss instanceof Var && !claim.bloom.mayContain(`s:${ss.value}`)) continue;
      if (!pp instanceof Var && !claim.bloom.mayContain(`p:${pp.value}`)) continue;
      // ... full scan only if Bloom says "maybe"

      for (const triple of claim.triples) {
        // actual unification
      }
    }
  };
}
```

## UI Layout

```
+------------------+------------------------+------------------+
|                  |                        |                  |
|  Claims list     |  Visual Compositor     |  Query panel     |
|  (collapsible)   |  (node canvas)         |  - SPARQL editor |
|                  |                        |  - Results table |
|  New claim form  |  [canvas with nodes]   |                  |
|                  |                        |  Export panel    |
|  Bloom stats     |                        |  - Format select |
|                  |                        |  - Options       |
+------------------+------------------------+------------------+
```

## Technical Notes

### Bloom Filter Parameters

For N triples per claim:

- Filter size: `m = -N * ln(p) / (ln(2)^2)` where p = desired false positive rate
- Hash count: `k = (m/N) * ln(2)`
- Reasonable defaults: 1KB filter, 3 hashes → ~1% false positive rate for 100 triples

### SPARQL to Kanren Compilation

```
BGP { ?x p ?y . ?y q ?z }
  → conj(tripleo(?x, p, ?y), tripleo(?y, q, ?z))

OPTIONAL { pattern }
  → disj(pattern, succeed)  // with special handling for unbound vars

UNION { p1 } { p2 }
  → disj(compile(p1), compile(p2))

FILTER(expr)
  → filter goal that checks expr against substitution
```

### N-Quads Abbreviation Algorithm

```
1. Build map: triple_hash → Set<graph_uri>
2. For each triple with |graphs| >= threshold:
   a. Create genid:set-{hash(sorted_graphs)}
   b. Record mapping in metadata
3. Emit:
   a. Abbreviated triples with genid: graph
   b. Unabbreviated triples (< threshold graphs)
   c. Metadata graph with genid: → constituent mappings
```

## File Structure

```
kanren-rdf-v3.html (or split into modules if using bundler)
├── Core
│   ├── data-model.js (Var, BNode, URI, Literal, Triple, Claim)
│   ├── kanren.js (Substitution, unify, conj, disj, eq, bind)
│   ├── store.js (ClaimStore, tripleo, graph algebra)
│   └── bloom.js (BloomFilter)
├── Parser
│   ├── turtle-parser.js (triple parsing)
│   └── sparql-parser.js (SPARQL 1.1 subset)
├── Serializers
│   ├── trig.js
│   ├── nquads.js (with abbreviation)
│   ├── rdfstar.js
│   └── rdf12.js
├── UI
│   ├── compositor.js (node canvas, drag/drop, containers)
│   ├── query-panel.js (SPARQL editor, results)
│   └── claims-panel.js
└── index.html (assembly)
```

## Success Criteria

1. Visual compositor allows building dataset pipelines by connecting nodes
2. Container nodes can collapse/expand to manage complexity
3. SPARQL 1.1 SELECT queries execute correctly against claim store
4. N-Quads export with abbreviation produces smaller files for replicated triples
5. Bloom filters measurably reduce scan time for selective queries
6. All features work in single HTML file (no build step required)

## Out of Scope (for v3)

- SPARQL UPDATE/INSERT/DELETE
- CONSTRUCT queries
- Federated queries
- Full SHACL/ShEx validation (shape references only)
- Persistence/IndexedDB (future)
- WebWorker parallelization (future)

## References

- microKanren paper: http://webyrd.net/scheme-2013/papers/HeslopShepherdson2013.pdf
- SPARQL 1.1 spec: https://www.w3.org/TR/sparql11-query/
- Bloom filter math: https://hur.st/bloomfilter/
- RDF 1.2 (draft): https://www.w3.org/TR/rdf12-concepts/
