# FoafNG - Kanren-RDF

Stream-based logic programming for RDF with graph algebra composition.

## Current: kanren-rdf.html

Single-file interactive RDF workbench with:
- **Kanren streams** - Logic programming queries with unification
- **Claim-based model** - Named graphs with provenance (agent, time, confidence)
- **Graph algebra** - Union, difference, intersection of claim graphs
- **Annotated datatypes** - Extensible literal metadata (`"B"^^<xsd:string|ctx:ref|sig:hash>`)

## Roadmap

### 1. Node Compositor

Visual graph algebra editor with canvas-based UI.

**Features:**
- Draggable nodes representing claims, queries, and algebra operations
- Container nodes that collapse to hide internal structure
- Edges between ports connecting data flow
- Real-time preview of composed graph results

**Data Structures:**
```javascript
class Node {
  id: string
  type: 'claim' | 'query' | 'algebra' | 'container'
  position: { x: number, y: number }
  ports: { in: Port[], out: Port[] }
  collapsed: boolean
  children: Node[]  // for containers
}

class Edge {
  id: string
  from: { nodeId: string, portId: string }
  to: { nodeId: string, portId: string }
}
```

### 2. SPARQL 1.1 Support

Full SPARQL query language compiled to Kanren goals.

**Implementation:**
- Recursive descent parser → AST
- AST → Kanren goal compiler
- Support for SELECT, CONSTRUCT, ASK, DESCRIBE
- FILTER expressions, OPTIONAL, UNION, MINUS
- Property paths (*, +, ?)
- Aggregates (COUNT, SUM, AVG, GROUP BY)

**Parser Architecture:**
```
SPARQL text → Lexer → Tokens → Parser → AST → GoalCompiler → Kanren goals
```

**AST Node Types:**
```javascript
type SparqlAST =
  | { type: 'select', vars: Var[], where: Pattern[], modifiers: Modifier[] }
  | { type: 'bgp', triples: TriplePattern[] }
  | { type: 'filter', expr: Expression }
  | { type: 'optional', pattern: Pattern }
  | { type: 'union', left: Pattern, right: Pattern }
  | { type: 'path', subject: Term, path: PathExpr, object: Term }
```

### 3. N-Quads Abbreviation

Compact serialization for triples appearing in multiple graphs.

**Algorithm:**
1. Hash each triple: `hash(s, p, o) → tripleHash`
2. Group by graph membership: `tripleHash → Set<graphId>`
3. For triples in 3+ graphs, emit abbreviated form:
   ```
   <s> <p> <o> genid:set-{setHash} .
   genid:set-{setHash} rdf:member <graph1>, <graph2>, <graph3> .
   ```

**Benefits:**
- Reduces redundancy in multi-graph datasets
- Preserves full graph membership information
- Reversible to standard N-Quads

### 4. Bloom Filter Indexing

Probabilistic index for fast claim filtering.

**Index Keys (per claim):**
| Key | Hash Input |
|-----|------------|
| s   | subject |
| p   | predicate |
| o   | object |
| sp  | subject + predicate |
| po  | predicate + object |
| spo | subject + predicate + object |

**Query Flow:**
```
1. Parse query pattern
2. Compute key hashes for bound terms
3. Check bloom filter for each claim
4. Only scan claims where filter returns "maybe"
5. Full unification on candidate claims
```

**Parameters:**
- Filter size: 1024 bits per claim (128 bytes)
- Hash functions: 3 (murmur3 variants)
- Expected false positive rate: ~1% for typical claim sizes

## File Structure

```
magpie/foafng/
├── README.md           # This file
├── kanren-rdf.html     # Main application (current)
└── (future files as features are added)
```

## Design Principles

1. **Single HTML file** - No build step, runs directly in browser
2. **Stream-based** - Lazy evaluation, handles large datasets
3. **Provenance-aware** - Every triple traceable to source claim
4. **Composable** - Graph algebra for combining/filtering data
5. **Standards-aligned** - RDF, SPARQL, N-Quads compatibility

## Integration Points

```
┌─────────────────────────────────────────────────────────┐
│                    Node Compositor                       │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐             │
│  │ Claim   │───▶│ SPARQL  │───▶│ Algebra │───▶ Output  │
│  │ Nodes   │    │ Query   │    │   Op    │             │
│  └─────────┘    └─────────┘    └─────────┘             │
└─────────────────────────────────────────────────────────┘
        │              │              │
        ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Bloom Index │ │ Kanren Core │ │ N-Quads Abbr│
└─────────────┘ └─────────────┘ └─────────────┘
```

## Usage

Open `kanren-rdf.html` in a browser. No server required for basic functionality.

For development:
```bash
cd magpie/foafng
python -m http.server 8080
# Open http://localhost:8080/kanren-rdf.html
```
