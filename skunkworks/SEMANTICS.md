# Semantic Layer - Learning from the Web of Data

## The Ghosts We're Building On

| Technology | What It Got Right | Why It Didn't Win |
|------------|------------------|-------------------|
| **Freebase/Parallax** | Faceted exploration, pivot between entity types | Acquired by Google, folded into Knowledge Graph (closed) |
| **SPARQL** | Powerful graph queries, federation | Too hard for normal humans, tooling nightmare |
| **Linked Data** | URIs as identifiers, follow-your-nose | Chicken/egg: no data → no apps → no data |
| **Solid** | User-owned pods, capability-based access | Complexity, chicken/egg again |
| **FOAF** | Social graph vocabulary | Too simple, no killer app |
| **RDF/OWL** | Formal semantics, inference | Over-engineered for most use cases |

**The pattern:** Technically elegant, practically stillborn. We need to learn the lessons without repeating the mistakes.

---

## What We Take Forward

### 1. From Freebase Parallax: Faceted Pivoting

Parallax let you fluidly explore: "Films → by Spielberg → from the 80s → with John Williams scores"

Each step narrows AND pivots to a new facet.

```
┌─────────────────────────────────────────────────────────────┐
│ Starting: Photos                                            │
│                                                             │
│ [Filter by Person ▼]  [Filter by Place ▼]  [Filter by Date]│
│                                                             │
│ → Showing: Photos with Alice                                │
│                                                             │
│ [Pivot to: Events with Alice ▼]                            │
│                                                             │
│ → Showing: Events where Alice appears in photos             │
│                                                             │
│ [Pivot to: Places of those events ▼]                       │
│                                                             │
│ → Showing: Map of everywhere I've been with Alice           │
└─────────────────────────────────────────────────────────────┘
```

**Implementation in Timeline OS:**

```javascript
class ParallaxExplorer {
  constructor(store) {
    this.store = store;
    this.currentSet = new Set();  // Current entity IDs
    this.pivotHistory = [];
  }

  // Start with all entities of a type (via facet)
  start(facet, filter = {}) {
    this.currentSet = new Set(
      this.store.query(facet, () => true).map(e => e.id)
    );
    this.pivotHistory = [{ facet, filter, count: this.currentSet.size }];
    return this;
  }

  // Filter current set by facet predicate
  filter(facet, predicate) {
    const filtered = new Set();
    for (const id of this.currentSet) {
      const entity = this.store.get(id);
      if (entity.facets[facet] && predicate(entity.facets[facet])) {
        filtered.add(id);
      }
    }
    this.currentSet = filtered;
    this.pivotHistory.push({ action: 'filter', facet, count: filtered.size });
    return this;
  }

  // Pivot to linked entities via relation
  pivot(relation) {
    const pivoted = new Set();
    for (const id of this.currentSet) {
      const entity = this.store.get(id);
      for (const link of entity.links || []) {
        if (!relation || link.relation === relation) {
          pivoted.add(link.target);
        }
      }
    }
    this.currentSet = pivoted;
    this.pivotHistory.push({ action: 'pivot', relation, count: pivoted.size });
    return this;
  }

  // Reverse pivot: find entities that link TO current set
  pivotFrom(relation) {
    const pivoted = new Set();
    for (const id of this.currentSet) {
      const linkers = this.store.getLinkedFrom(id, relation);
      for (const { entity } of linkers) {
        pivoted.add(entity.id);
      }
    }
    this.currentSet = pivoted;
    this.pivotHistory.push({ action: 'pivotFrom', relation, count: pivoted.size });
    return this;
  }

  // Get current results
  results() {
    return Array.from(this.currentSet).map(id => this.store.get(id));
  }

  // Undo last operation
  back() {
    // Would need to checkpoint state - simplified here
    this.pivotHistory.pop();
    return this;
  }
}

// Usage: "Show me places I've photographed Alice"
const explorer = new ParallaxExplorer(store)
  .start('media', { type: 'image/*' })        // All photos
  .filter('social', s => s.participants?.includes('entity:alice'))  // With Alice
  .pivot('taken-at')                           // Pivot to locations
  .results();
```

---

### 2. From SPARQL: Graph Queries (Made Usable)

SPARQL is powerful but hostile:

```sparql
SELECT ?name ?birthPlace WHERE {
  ?person a foaf:Person .
  ?person foaf:name ?name .
  ?person dbpedia:birthPlace ?birthPlace .
  ?birthPlace dbpedia:country dbpedia:France .
}
```

**Our approach:** Natural language → structured query (AI-mediated)

```
User: "Show me everyone I met in Paris"

AI parses to:
{
  type: 'query',
  find: 'entities',
  where: [
    { facet: 'identity', exists: true },           // Is a person
    { facet: 'social', field: 'relationship-to-self', op: 'exists' },
    { link: { relation: 'met-at', target: { facet: 'spatial', location: 'Paris' } } }
  ]
}

Executed as:
store.query('identity', () => true)
  .filter(e => e.links.some(l =>
    l.relation === 'met-at' &&
    store.get(l.target)?.facets.spatial?.location?.includes('Paris')
  ))
```

**For power users:** A visual query builder, not raw SPARQL

```
┌─────────────────────────────────────────────────────────┐
│ Query Builder                                           │
│                                                         │
│ Find: [People ▼]                                       │
│                                                         │
│ Where:                                                  │
│   ┌─────────────────────────────────────────────┐      │
│   │ [+] met at → [Place] → location contains    │      │
│   │                        [Paris          ]    │      │
│   └─────────────────────────────────────────────┘      │
│   [+ Add condition]                                    │
│                                                         │
│ [Run Query]                          Results: 12       │
└─────────────────────────────────────────────────────────┘
```

---

### 3. From Embeddings: Semantic Similarity

Explicit links are expensive (require user action or AI + consent).
Embeddings give you implicit similarity.

```javascript
class EmbeddingIndex {
  constructor(model) {
    this.model = model;  // Local embedding model (e.g., all-MiniLM-L6-v2 via WASM)
    this.vectors = new Map();  // entityId → Float32Array
  }

  // Embed entity based on its facets
  async index(entity) {
    // Create text representation of entity
    const text = this._entityToText(entity);
    const vector = await this.model.embed(text);
    this.vectors.set(entity.id, vector);
  }

  _entityToText(entity) {
    const parts = [];

    if (entity.facets.identity) {
      parts.push(entity.facets.identity.name);
      parts.push(entity.facets.identity.aliases?.join(' '));
    }
    if (entity.facets.semantic) {
      parts.push(entity.facets.semantic.topics?.join(' '));
      parts.push(entity.facets.semantic.mood);
    }
    if (entity.facets.spatial) {
      parts.push(entity.facets.spatial.location);
    }
    // ... other facets

    return parts.filter(Boolean).join(' ');
  }

  // Find similar entities
  async similar(entityOrQuery, k = 10) {
    let queryVector;

    if (typeof entityOrQuery === 'string') {
      // Text query
      queryVector = await this.model.embed(entityOrQuery);
    } else {
      // Entity
      queryVector = this.vectors.get(entityOrQuery.id);
    }

    if (!queryVector) return [];

    // Cosine similarity search
    const scores = [];
    for (const [id, vector] of this.vectors) {
      const score = cosineSimilarity(queryVector, vector);
      scores.push({ id, score });
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

**Use cases:**
- "Find similar" without explicit links
- Semantic search: "romantic evenings" finds relevant entities
- Clustering: group entities by similarity
- Recommendations: "You might also like..."

**Privacy note:** Embeddings can be computed locally. No data leaves device.

---

### 4. From Bloom Filters: Private Federation

When federating (Solid-style pods), you don't want to reveal your data to query it.

**Bloom filter approach:**

```javascript
class PrivateIndex {
  constructor(size = 10000, hashCount = 7) {
    this.bits = new Uint8Array(size);
    this.size = size;
    this.hashCount = hashCount;
  }

  // Add item to filter
  add(item) {
    for (const hash of this._hashes(item)) {
      this.bits[hash % this.size] = 1;
    }
  }

  // Check if item MIGHT be in set
  mightContain(item) {
    for (const hash of this._hashes(item)) {
      if (this.bits[hash % this.size] === 0) return false;
    }
    return true;  // Might be false positive
  }

  _hashes(item) {
    // Generate multiple hashes
    const hashes = [];
    for (let i = 0; i < this.hashCount; i++) {
      hashes.push(this._hash(item + i.toString()));
    }
    return hashes;
  }

  _hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // Export for sharing (privacy-preserving)
  export() {
    return this.bits;
  }
}
```

**Federated query flow:**

```
Alice's Pod                          Bob's Pod
     │                                    │
     │  "Do you have anything about       │
     │   topic X?"                        │
     │                                    │
     │──────── Bloom filter query ───────▶│
     │                                    │
     │         (Bob checks locally,       │
     │          doesn't reveal data)      │
     │                                    │
     │◀─────── "Maybe (3 possible)" ──────│
     │                                    │
     │  "Can I see those 3?"              │
     │  (with capability token)           │
     │                                    │
     │──────── Request + capability ─────▶│
     │                                    │
     │         (Bob checks capability,    │
     │          returns if authorized)    │
     │                                    │
     │◀─────── Encrypted results ─────────│
```

---

### 5. From Linked Data: URIs and Dereferencing

Core Linked Data principles we keep:

1. **Use URIs as names** ✓
   ```
   entity:alice-chen-1987      (local)
   https://pod.example/alice   (federated)
   ```

2. **Use HTTP URIs so they can be dereferenced** ✓
   ```javascript
   // Local entity
   store.get('entity:abc')

   // Remote entity (Solid-style)
   await fetch('https://pod.example/entities/abc', {
     headers: { 'Authorization': `Bearer ${capabilityToken}` }
   })
   ```

3. **Provide useful information at that URI** ✓
   ```javascript
   // GET https://pod.example/entities/abc
   // Returns JSON-LD or our entity format
   {
     "@context": "https://timeline.os/entity",
     "id": "https://pod.example/entities/abc",
     "facets": {
       "identity": { "name": "Alice" },
       // ... only facets the requester has access to
     }
   }
   ```

4. **Include links to other URIs** ✓
   ```javascript
   {
     "links": [
       { "relation": "knows", "target": "https://other.pod/entities/bob" }
     ]
   }
   ```

---

### 6. From Solid: Pods and WebID

Solid's architecture maps well to our model:

| Solid Concept | Timeline OS Equivalent |
|---------------|------------------------|
| Pod | Entity Store (per-user) |
| WebID | User's root identity entity |
| ACL | Capability tokens |
| Type indexes | Facet indexes |
| LDP containers | Entity namespaces |

**Integration sketch:**

```javascript
class SolidBridge {
  constructor(store, webId) {
    this.store = store;
    this.webId = webId;
    this.session = null;
  }

  async login() {
    // Use Solid OIDC
    this.session = await solidLogin(this.webId);
  }

  // Sync local entity to Solid pod
  async push(entityId) {
    const entity = this.store.get(entityId);
    const ttl = this._entityToTurtle(entity);

    await this.session.fetch(`${this.webId}/entities/${entityId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/turtle' },
      body: ttl
    });
  }

  // Fetch remote entity to local store
  async pull(remoteUri) {
    const response = await this.session.fetch(remoteUri);
    const ttl = await response.text();
    const entity = this._turtleToEntity(ttl);

    // Store locally with remote URI as ID
    this.store.entities.set(remoteUri, entity);
    return entity;
  }

  _entityToTurtle(entity) {
    // Convert to RDF/Turtle for Solid compatibility
    // Simplified - would use rdflib.js in practice
    let ttl = `@prefix : <${this.webId}/vocab#> .\n`;
    ttl += `<> a :Entity ;\n`;

    for (const [facet, data] of Object.entries(entity.facets)) {
      ttl += `  :${facet} "${JSON.stringify(data)}" ;\n`;
    }

    return ttl;
  }
}
```

---

### 7. From FOAF: Social Vocabulary

FOAF defined: Person, knows, name, mbox, interest, etc.

We modernize into our social facet:

```javascript
const SocialFacetVocab = {
  // Relationship types (inspired by FOAF + XFN)
  relationships: [
    'knows',           // Generic connection
    'friend',          // Close relationship
    'acquaintance',    // Casual connection
    'colleague',       // Work relationship
    'family',          // Family member
    'partner',         // Romantic partner
    'follows',         // One-way social follow
    'collaborator',    // Creative/work collaboration
  ],

  // Interaction types
  interactions: [
    'met',             // In-person meeting
    'messaged',        // Sent message
    'called',          // Voice/video call
    'tagged',          // Tagged in content
    'mentioned',       // Mentioned in content
    'shared',          // Shared content with
    'collaborated',    // Worked together on
  ],

  // Trust levels
  trust: [
    'verified',        // Identity verified
    'trusted',         // Trusted contact
    'known',           // Known person
    'unverified',      // Not yet verified
  ]
};

// Example entity with rich social facet
const aliceEntity = {
  id: 'entity:alice',
  facets: {
    identity: {
      name: 'Alice Chen',
      aliases: ['alice', 'A.Chen'],
      pronouns: 'she/her'
    },
    social: {
      relationshipToSelf: 'friend',
      trustLevel: 'verified',
      met: 'entity:conference-2022',
      interactions: [
        { type: 'met', date: '2022-05-15', context: 'entity:conference-2022' },
        { type: 'messaged', count: 47, lastDate: '2024-06-01' },
        { type: 'collaborated', context: 'entity:project-x' }
      ],
      mutualConnections: ['entity:bob', 'entity:carol']
    },
    contact: {
      email: [{ value: 'alice@example.com', label: 'personal' }],
      phone: [{ value: '+1-555-...', label: 'mobile' }],
      social: [
        { platform: 'github', handle: 'alicechen' },
        { platform: 'mastodon', handle: '@alice@social.example' }
      ]
    }
  }
};
```

---

## Putting It Together: The Semantic Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  Parallax   │ │   Search    │ │  Timeline   │           │
│  │  Explorer   │ │   (NL+AI)   │ │   Strip     │           │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘           │
├─────────┼───────────────┼───────────────┼───────────────────┤
│         ▼               ▼               ▼                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Query Layer                             │   │
│  │  • Parallax pivots (facet filtering + link traversal)│   │
│  │  • NL → structured query (AI-mediated)               │   │
│  │  • Visual query builder (power users)                │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Index Layer                             │   │
│  │  • Facet indexes (fast lookup by field)              │   │
│  │  • Embedding index (semantic similarity)             │   │
│  │  • Bloom filters (private federation queries)        │   │
│  │  • Full-text search (local)                          │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Entity Store                            │   │
│  │  • Faceted entities (identity + facets + links)      │   │
│  │  • Encrypted at rest                                 │   │
│  │  • Event-sourced mutations                           │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Federation Layer                        │   │
│  │  • Solid bridge (WebID, pods, ACL)                   │   │
│  │  • Linked Data URIs (dereferenceable)                │   │
│  │  • WebRTC sync (real-time P2P)                       │   │
│  │  • Bloom filter queries (privacy-preserving)         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Why This Might Work When Others Didn't

| Past Failure | Our Mitigation |
|--------------|----------------|
| SPARQL too hard | AI-mediated natural language queries |
| No data to query | Start local-first, federate later |
| Chicken/egg apps | Build on existing web tech (iframes, Web Components) |
| Over-engineered ontologies | Minimal facet protocols, extensible |
| Privacy concerns | Facet-level encryption, capability tokens |
| No killer app | FINK stories as first use case, then expand |
| Requires behavior change | Works offline, syncs when ready |

---

## Open Research Questions

1. **Embedding model size** - Can we run useful embeddings in WASM on mobile?
2. **Bloom filter tuning** - False positive rate vs. privacy vs. utility?
3. **Solid compatibility** - How much do we conform vs. extend?
4. **Query optimization** - How to make Parallax-style pivots fast at scale?
5. **Conflict resolution** - When federated edits conflict, what wins?
6. **Schema evolution** - How do facet protocols change over time?

---

## Next Implementation Steps

1. [ ] Parallax explorer component (visual pivot UI)
2. [ ] Local embedding index (ONNX.js or similar)
3. [ ] Bloom filter federation protocol
4. [ ] Solid pod bridge (read/write)
5. [ ] Natural language query parser (local LLM or Claude)
6. [ ] FOAF-compatible social facet export
