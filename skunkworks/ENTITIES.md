# Entity Model - Beyond Files and App Data

## The Problem

Traditional split:
- **OS**: Files (generic containers, filesystem hierarchy)
- **Apps**: Domain objects (contacts, videos, notes - rich but siloed)

Both are wrong:
- Files are too dumb (a .jpg knows nothing about who's in it)
- App data is too siloed (my "Alice" in Contacts ≠ "Alice" in Photos ≠ "Alice" in Email)

Naive flattening is also wrong:
- Everything-is-a-file loses semantics
- Everything-is-tagged loses structure
- Universal schema (WinFS) is too complex to ship

## The Synthesis: Faceted Entities

An **entity** is not a file or a record. It's an identity that manifests through **facets**.

```
Entity: "that evening in Paris with Alice"
├── Temporal facet
│   ├── occurred: 2024-06-15T20:30:00Z
│   ├── duration: PT2H30M
│   └── recurrence: none
├── Spatial facet
│   ├── location: "Café de Flore, Paris"
│   ├── coords: [48.8541, 2.3326]
│   └── radius: 50m
├── Social facet
│   ├── participants: [entity:alice, entity:self]
│   ├── relationships: [friend, dinner-companion]
│   └── visibility: private
├── Media facet
│   ├── representations:
│   │   ├── video/mp4: blob:abc123 (3 min clip)
│   │   ├── image/jpeg: blob:def456 (photo)
│   │   └── text/plain: "Notes from dinner..."
│   └── primary: video/mp4
├── Semantic facet
│   ├── topics: [travel, friendship, food]
│   ├── mood: warm, nostalgic
│   └── depicts: [cafe, wine, sunset]
└── Provenance facet
    ├── created-by: entity:self
    ├── created-with: iPhone camera
    ├── imported: 2024-06-16T10:00:00Z
    └── modified: [list of edit events]
```

## Key Principles

### 1. Identity is Primary, Representation is Secondary

The entity exists independent of its media. The video, the photo, the note - these are **representations**, not the thing itself.

```javascript
entity.getRepresentation('video/mp4')  // → blob
entity.getRepresentation('text/summary')  // → AI-generated summary
entity.getRepresentation('application/ld+json')  // → structured data
```

### 2. Facets are Protocols, Not Schemas

Instead of one universal schema, facets are **protocols** that entities can implement:

```javascript
// An entity that implements Temporal + Spatial + Social
const event = {
  id: 'entity:paris-dinner',
  facets: ['temporal', 'spatial', 'social', 'media'],

  // Temporal protocol
  temporal: {
    occurred: '2024-06-15T20:30:00Z',
    duration: 'PT2H30M'
  },

  // Spatial protocol
  spatial: {
    location: 'Café de Flore, Paris',
    coords: [48.8541, 2.3326]
  },

  // ... etc
};
```

Apps don't own data types - they implement facet protocols.

### 3. Same Entity, Different Views

The OS provides **lenses** that project entities through their facets:

| Lens | Shows | Groups by |
|------|-------|-----------|
| Timeline | When things happened | temporal.occurred |
| Map | Where things happened | spatial.coords |
| People | Who was involved | social.participants |
| Gallery | Visual media | media.representations |
| Graph | How things connect | all relationships |

```javascript
// Timeline lens
timeline.query({ facet: 'temporal', range: ['2024-06', '2024-07'] })

// Map lens
map.query({ facet: 'spatial', bounds: parisArea })

// Both return the SAME entities, viewed differently
```

### 4. Entities Link to Entities

"Alice" is also an entity with facets:

```
Entity: "Alice"
├── Identity facet
│   ├── name: "Alice Chen"
│   ├── aliases: ["alice", "A.Chen"]
│   └── pronouns: she/her
├── Contact facet
│   ├── email: alice@example.com
│   ├── phone: +1-555-...
│   └── social: [@alice on various]
├── Social facet
│   ├── relationship-to-self: friend
│   ├── met: entity:conference-2022
│   └── interactions: [entity:paris-dinner, entity:email-thread-42, ...]
└── Media facet
    ├── avatar: blob:face123
    └── voice-sample: blob:voice456 (for AI recognition)
```

The link `entity:paris-dinner → entity:alice` is bidirectional. Query either direction.

### 5. Events as Entity Mutations

In Timeline OS, changes to entities are events in the timeline:

```javascript
{
  type: 'entity:mutate',
  timestamp: '2024-06-16T10:00:00Z',
  entity: 'entity:paris-dinner',
  facet: 'media',
  operation: 'add-representation',
  data: { type: 'video/mp4', blob: 'abc123' },
  actor: 'entity:self',
  reversible: true
}
```

The entity's "current state" is a projection of all its mutation events.

## Avoiding the Traps

### Trap 1: Universal Ontology
WinFS tried to define every possible type. We don't.

**Our approach**: Small set of facet protocols. Entities pick which they implement. New facets can be added without breaking existing ones.

### Trap 2: Lowest Common Denominator
Files reduce everything to bytes + name + timestamps.

**Our approach**: Rich facets with real semantics. A temporal facet knows about durations, recurrence, time zones. A spatial facet knows about coordinates, places, regions.

### Trap 3: App Silos
Each app defines its own "Person" or "Event" type.

**Our approach**: Apps don't define types. They implement facet protocols and provide lenses. The photo app provides a gallery lens. The calendar app provides a schedule lens. Both work on the same entities.

### Trap 4: Over-Engineering
Semantic web tried to make everything machine-readable with perfect inference.

**Our approach**: Pragmatic facets. AI fills gaps. If an entity lacks a facet, AI can infer it. "This photo probably depicts Alice based on face recognition. This probably happened in Paris based on EXIF + context."

## Implementation Sketch

### Entity Store

```javascript
class EntityStore {
  constructor() {
    this.entities = new Map();      // id → entity
    this.indexes = new Map();       // facet → index
    this.events = [];               // mutation log
  }

  // Create entity with initial facets
  create(facets) {
    const id = `entity:${crypto.randomUUID()}`;
    const entity = { id, facets: {}, created: Date.now() };

    for (const [facet, data] of Object.entries(facets)) {
      entity.facets[facet] = data;
      this._index(id, facet, data);
    }

    this.entities.set(id, entity);
    this._log('create', id, facets);
    return entity;
  }

  // Query by facet
  query(facet, predicate) {
    const index = this.indexes.get(facet);
    if (!index) return [];
    return index.query(predicate);
  }

  // Get entity by ID
  get(id) {
    return this.entities.get(id);
  }

  // Add/update facet
  setFacet(id, facet, data) {
    const entity = this.entities.get(id);
    if (!entity) throw new Error('Entity not found');

    entity.facets[facet] = data;
    this._index(id, facet, data);
    this._log('set-facet', id, { facet, data });
  }

  // Link entities
  link(fromId, relation, toId) {
    // Links are stored as a special 'links' facet
    const entity = this.entities.get(fromId);
    if (!entity.facets.links) entity.facets.links = [];
    entity.facets.links.push({ relation, target: toId });
    this._log('link', fromId, { relation, target: toId });
  }
}
```

### Facet Protocols

```javascript
// Temporal facet protocol
const TemporalFacet = {
  name: 'temporal',
  schema: {
    occurred: 'datetime',      // when it happened
    duration: 'duration?',     // how long (optional)
    recurrence: 'rrule?',      // repeating pattern (optional)
    timezone: 'timezone?'
  },
  index: (data) => ({
    // Index by date for range queries
    date: new Date(data.occurred).toISOString().slice(0, 10)
  }),
  display: (data) => {
    // Human-readable display
    return new Date(data.occurred).toLocaleDateString();
  }
};

// Spatial facet protocol
const SpatialFacet = {
  name: 'spatial',
  schema: {
    location: 'string?',       // human name
    coords: '[number, number]?', // lat/lng
    bounds: 'geojson?',        // area
    altitude: 'number?'
  },
  index: (data) => ({
    // Index for geo queries
    geohash: computeGeohash(data.coords)
  }),
  display: (data) => data.location || `${data.coords[0]}, ${data.coords[1]}`
};

// Social facet protocol
const SocialFacet = {
  name: 'social',
  schema: {
    participants: '[entityref]',  // who's involved
    visibility: 'enum:public,private,shared',
    sharedWith: '[entityref]?'
  },
  index: (data) => ({
    // Index by participant for "show me everything with Alice"
    participants: data.participants
  })
};
```

### Lenses (Views)

```javascript
class TimelineLens {
  constructor(store) {
    this.store = store;
  }

  // Get entities in time range
  query(start, end) {
    return this.store.query('temporal', (data) => {
      const t = new Date(data.occurred);
      return t >= start && t <= end;
    });
  }

  // Group by day/week/month
  groupBy(entities, granularity) {
    const groups = new Map();
    for (const entity of entities) {
      const key = this._granularityKey(entity.facets.temporal.occurred, granularity);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entity);
    }
    return groups;
  }
}

class MapLens {
  constructor(store) {
    this.store = store;
  }

  // Get entities in geographic bounds
  query(bounds) {
    return this.store.query('spatial', (data) => {
      return this._inBounds(data.coords, bounds);
    });
  }

  // Cluster nearby entities
  cluster(entities, zoom) {
    // ... clustering algorithm
  }
}

class PeopleLens {
  constructor(store) {
    this.store = store;
  }

  // Get all entities involving a person
  forPerson(personId) {
    return this.store.query('social', (data) => {
      return data.participants?.includes(personId);
    });
  }

  // Get interaction timeline with person
  interactionsWith(personId) {
    const entities = this.forPerson(personId);
    return entities.sort((a, b) =>
      new Date(b.facets.temporal?.occurred) - new Date(a.facets.temporal?.occurred)
    );
  }
}
```

## Relation to Timeline OS

In Timeline OS:
- The **timeline strip** is a temporal lens on all entities
- **Apps** are specialized lenses + editors for specific facets
- **AI** infers missing facets and suggests links
- **Events in the timeline** are entity mutations
- **Undo/time-travel** replays entity history

```
User creates photo → Entity created with media facet
AI recognizes face → Social facet added (depicts: Alice)
User tags location → Spatial facet added
User writes note → Text representation added to media facet
All visible in timeline as discrete events
```

## Open Questions

1. **Storage**: Where do blobs live? Separate from entity metadata?
2. **Sync**: How do entities sync across devices? CRDTs?
3. **Permissions**: Per-entity? Per-facet? Per-representation?
4. **AI inference**: When to auto-add facets vs. suggest?
5. **Migration**: How to import from existing apps/files?

## Comparison

| Approach | Entities | Structure | Flexibility |
|----------|----------|-----------|-------------|
| Files | ❌ Bytes only | ❌ Hierarchy | ✅ Total |
| App Data | ✅ Rich | ✅ Per-app | ❌ Siloed |
| Tags | ❌ Flat | ❌ None | ✅ Flexible |
| Universal Schema | ✅ Rich | ✅ Global | ❌ Rigid |
| **Faceted Entities** | ✅ Rich | ✅ Per-facet | ✅ Extensible |
