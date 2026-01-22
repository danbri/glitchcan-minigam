/**
 * Entity Store - Faceted entity system
 *
 * Entities are identity + facets, not files or app records.
 * Same entity viewed through different lenses (timeline, map, people).
 */

// ============================================================
// FACET PROTOCOLS
// ============================================================

const FACET_PROTOCOLS = {
  temporal: {
    name: 'temporal',
    validate: (data) => data.occurred != null,
    index: (data) => ({
      date: new Date(data.occurred).toISOString().slice(0, 10),
      year: new Date(data.occurred).getFullYear(),
      month: new Date(data.occurred).toISOString().slice(0, 7)
    }),
    display: (data) => new Date(data.occurred).toLocaleString()
  },

  spatial: {
    name: 'spatial',
    validate: (data) => data.location != null || data.coords != null,
    index: (data) => ({
      geohash: data.coords ? computeGeohash(data.coords, 6) : null,
      location: data.location?.toLowerCase()
    }),
    display: (data) => data.location || `${data.coords?.[0]?.toFixed(4)}, ${data.coords?.[1]?.toFixed(4)}`
  },

  social: {
    name: 'social',
    validate: (data) => Array.isArray(data.participants),
    index: (data) => ({
      participants: data.participants || [],
      visibility: data.visibility || 'private'
    }),
    display: (data) => data.participants?.join(', ')
  },

  media: {
    name: 'media',
    validate: (data) => data.representations != null,
    index: (data) => ({
      types: Object.keys(data.representations || {}),
      primary: data.primary
    }),
    display: (data) => data.primary || Object.keys(data.representations || {})[0]
  },

  semantic: {
    name: 'semantic',
    validate: () => true,
    index: (data) => ({
      topics: data.topics || [],
      mood: data.mood,
      depicts: data.depicts || []
    }),
    display: (data) => data.topics?.join(', ')
  },

  identity: {
    name: 'identity',
    validate: (data) => data.name != null,
    index: (data) => ({
      name: data.name?.toLowerCase(),
      aliases: data.aliases?.map(a => a.toLowerCase()) || []
    }),
    display: (data) => data.name
  }
};

// Simple geohash for spatial indexing
function computeGeohash([lat, lng], precision = 6) {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let hash = '';
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let isLng = true;

  while (hash.length < precision) {
    let bits = 0;
    for (let i = 0; i < 5; i++) {
      if (isLng) {
        const mid = (minLng + maxLng) / 2;
        if (lng >= mid) {
          bits = bits * 2 + 1;
          minLng = mid;
        } else {
          bits = bits * 2;
          maxLng = mid;
        }
      } else {
        const mid = (minLat + maxLat) / 2;
        if (lat >= mid) {
          bits = bits * 2 + 1;
          minLat = mid;
        } else {
          bits = bits * 2;
          maxLat = mid;
        }
      }
      isLng = !isLng;
    }
    hash += base32[bits];
  }
  return hash;
}

// ============================================================
// ENTITY STORE
// ============================================================

class EntityStore extends EventTarget {
  constructor() {
    super();

    // Primary storage
    this.entities = new Map();

    // Facet indexes for fast queries
    this.indexes = new Map();
    for (const facet of Object.keys(FACET_PROTOCOLS)) {
      this.indexes.set(facet, new FacetIndex(facet));
    }

    // Event log (for timeline integration)
    this.eventLog = [];
  }

  // --------------------------------------------------------
  // CRUD Operations
  // --------------------------------------------------------

  create(initialFacets = {}) {
    const id = `entity:${crypto.randomUUID().slice(0, 12)}`;

    const entity = {
      id,
      facets: {},
      links: [],
      created: Date.now(),
      modified: Date.now()
    };

    // Set initial facets
    for (const [facetName, data] of Object.entries(initialFacets)) {
      this._setFacet(entity, facetName, data, false);
    }

    this.entities.set(id, entity);
    this._log('entity:create', { id, facets: Object.keys(initialFacets) });

    this.dispatchEvent(new CustomEvent('entity-created', {
      detail: { entity }
    }));

    return entity;
  }

  get(id) {
    return this.entities.get(id);
  }

  update(id, facetName, data) {
    const entity = this.entities.get(id);
    if (!entity) throw new Error(`Entity not found: ${id}`);

    this._setFacet(entity, facetName, data, true);
    entity.modified = Date.now();

    this._log('entity:update', { id, facet: facetName });

    this.dispatchEvent(new CustomEvent('entity-updated', {
      detail: { entity, facet: facetName }
    }));

    return entity;
  }

  delete(id) {
    const entity = this.entities.get(id);
    if (!entity) return false;

    // Remove from all indexes
    for (const facetName of Object.keys(entity.facets)) {
      this.indexes.get(facetName)?.remove(id);
    }

    this.entities.delete(id);
    this._log('entity:delete', { id });

    this.dispatchEvent(new CustomEvent('entity-deleted', {
      detail: { id }
    }));

    return true;
  }

  _setFacet(entity, facetName, data, isUpdate) {
    const protocol = FACET_PROTOCOLS[facetName];
    if (!protocol) {
      console.warn(`Unknown facet protocol: ${facetName}`);
      // Allow unknown facets (extensibility)
    }

    // Validate if protocol exists
    if (protocol?.validate && !protocol.validate(data)) {
      throw new Error(`Invalid ${facetName} facet data`);
    }

    // Remove old index entry if updating
    if (isUpdate && entity.facets[facetName]) {
      this.indexes.get(facetName)?.remove(entity.id);
    }

    // Set facet data
    entity.facets[facetName] = data;

    // Index
    if (protocol?.index) {
      const indexData = protocol.index(data);
      this.indexes.get(facetName)?.add(entity.id, indexData);
    }
  }

  // --------------------------------------------------------
  // Links
  // --------------------------------------------------------

  link(fromId, relation, toId) {
    const from = this.entities.get(fromId);
    const to = this.entities.get(toId);

    if (!from || !to) {
      throw new Error('Both entities must exist to link');
    }

    from.links.push({ relation, target: toId });
    from.modified = Date.now();

    this._log('entity:link', { from: fromId, relation, to: toId });

    this.dispatchEvent(new CustomEvent('entity-linked', {
      detail: { from: fromId, relation, to: toId }
    }));
  }

  getLinked(id, relation = null) {
    const entity = this.entities.get(id);
    if (!entity) return [];

    let links = entity.links;
    if (relation) {
      links = links.filter(l => l.relation === relation);
    }

    return links.map(l => ({
      relation: l.relation,
      entity: this.entities.get(l.target)
    })).filter(l => l.entity);
  }

  // Reverse lookup: find entities that link TO this one
  getLinkedFrom(id, relation = null) {
    const results = [];

    for (const entity of this.entities.values()) {
      for (const link of entity.links) {
        if (link.target === id) {
          if (!relation || link.relation === relation) {
            results.push({ relation: link.relation, entity });
          }
        }
      }
    }

    return results;
  }

  // --------------------------------------------------------
  // Queries
  // --------------------------------------------------------

  // Query by facet with predicate
  query(facetName, predicate) {
    const results = [];

    for (const entity of this.entities.values()) {
      const facetData = entity.facets[facetName];
      if (facetData && predicate(facetData, entity)) {
        results.push(entity);
      }
    }

    return results;
  }

  // Query by indexed field
  queryIndex(facetName, field, value) {
    const index = this.indexes.get(facetName);
    if (!index) return [];

    const ids = index.lookup(field, value);
    return ids.map(id => this.entities.get(id)).filter(Boolean);
  }

  // Full-text search across all string facets
  search(query) {
    const q = query.toLowerCase();
    const results = [];

    for (const entity of this.entities.values()) {
      for (const facetData of Object.values(entity.facets)) {
        const str = JSON.stringify(facetData).toLowerCase();
        if (str.includes(q)) {
          results.push(entity);
          break;
        }
      }
    }

    return results;
  }

  // --------------------------------------------------------
  // Event Log
  // --------------------------------------------------------

  _log(type, data) {
    const event = {
      id: `evt:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      timestamp: Date.now(),
      data
    };

    this.eventLog.push(event);

    // Keep log bounded
    if (this.eventLog.length > 10000) {
      this.eventLog = this.eventLog.slice(-5000);
    }

    return event;
  }

  getHistory(entityId) {
    return this.eventLog.filter(e =>
      e.data?.id === entityId ||
      e.data?.from === entityId ||
      e.data?.to === entityId
    );
  }

  // --------------------------------------------------------
  // Serialization
  // --------------------------------------------------------

  export() {
    return {
      entities: Array.from(this.entities.values()),
      version: 1
    };
  }

  import(data) {
    if (data.version !== 1) {
      throw new Error('Unknown export version');
    }

    for (const entity of data.entities) {
      this.entities.set(entity.id, entity);

      // Rebuild indexes
      for (const [facetName, facetData] of Object.entries(entity.facets)) {
        const protocol = FACET_PROTOCOLS[facetName];
        if (protocol?.index) {
          const indexData = protocol.index(facetData);
          this.indexes.get(facetName)?.add(entity.id, indexData);
        }
      }
    }
  }
}

// ============================================================
// FACET INDEX
// ============================================================

class FacetIndex {
  constructor(facetName) {
    this.facetName = facetName;
    this.byField = new Map(); // field → value → Set<entityId>
    this.byEntity = new Map(); // entityId → indexed data
  }

  add(entityId, indexData) {
    this.byEntity.set(entityId, indexData);

    for (const [field, value] of Object.entries(indexData)) {
      if (value == null) continue;

      if (!this.byField.has(field)) {
        this.byField.set(field, new Map());
      }

      const fieldIndex = this.byField.get(field);

      // Handle arrays (e.g., participants, topics)
      const values = Array.isArray(value) ? value : [value];

      for (const v of values) {
        if (!fieldIndex.has(v)) {
          fieldIndex.set(v, new Set());
        }
        fieldIndex.get(v).add(entityId);
      }
    }
  }

  remove(entityId) {
    const indexData = this.byEntity.get(entityId);
    if (!indexData) return;

    for (const [field, value] of Object.entries(indexData)) {
      if (value == null) continue;

      const fieldIndex = this.byField.get(field);
      if (!fieldIndex) continue;

      const values = Array.isArray(value) ? value : [value];

      for (const v of values) {
        fieldIndex.get(v)?.delete(entityId);
      }
    }

    this.byEntity.delete(entityId);
  }

  lookup(field, value) {
    const fieldIndex = this.byField.get(field);
    if (!fieldIndex) return [];
    return Array.from(fieldIndex.get(value) || []);
  }

  // Range query for dates
  range(field, min, max) {
    const fieldIndex = this.byField.get(field);
    if (!fieldIndex) return [];

    const results = new Set();

    for (const [value, entityIds] of fieldIndex) {
      if (value >= min && value <= max) {
        for (const id of entityIds) {
          results.add(id);
        }
      }
    }

    return Array.from(results);
  }
}

// ============================================================
// LENSES
// ============================================================

class TimelineLens {
  constructor(store) {
    this.store = store;
  }

  // Get entities in date range
  range(startDate, endDate) {
    const start = startDate instanceof Date ? startDate.toISOString().slice(0, 10) : startDate;
    const end = endDate instanceof Date ? endDate.toISOString().slice(0, 10) : endDate;

    return this.store.indexes.get('temporal').range('date', start, end)
      .map(id => this.store.get(id))
      .filter(Boolean)
      .sort((a, b) =>
        new Date(a.facets.temporal.occurred) - new Date(b.facets.temporal.occurred)
      );
  }

  // Group by day/week/month
  groupBy(entities, granularity = 'day') {
    const groups = new Map();

    for (const entity of entities) {
      const date = new Date(entity.facets.temporal?.occurred);
      let key;

      switch (granularity) {
        case 'day':
          key = date.toISOString().slice(0, 10);
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().slice(0, 10);
          break;
        case 'month':
          key = date.toISOString().slice(0, 7);
          break;
        case 'year':
          key = date.getFullYear().toString();
          break;
      }

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entity);
    }

    return groups;
  }

  // Get recent entities
  recent(count = 20) {
    return Array.from(this.store.entities.values())
      .filter(e => e.facets.temporal)
      .sort((a, b) =>
        new Date(b.facets.temporal.occurred) - new Date(a.facets.temporal.occurred)
      )
      .slice(0, count);
  }
}

class PeopleLens {
  constructor(store) {
    this.store = store;
  }

  // Get all "person" entities
  all() {
    return this.store.query('identity', () => true);
  }

  // Find person by name
  findByName(name) {
    const q = name.toLowerCase();
    return this.store.query('identity', (data) =>
      data.name?.toLowerCase().includes(q) ||
      data.aliases?.some(a => a.toLowerCase().includes(q))
    );
  }

  // Get all entities involving a person
  involving(personId) {
    return this.store.queryIndex('social', 'participants', personId);
  }

  // Get interaction history between two people
  interactions(person1Id, person2Id) {
    return this.store.query('social', (data) =>
      data.participants?.includes(person1Id) &&
      data.participants?.includes(person2Id)
    ).sort((a, b) =>
      new Date(b.facets.temporal?.occurred || 0) -
      new Date(a.facets.temporal?.occurred || 0)
    );
  }
}

class MapLens {
  constructor(store) {
    this.store = store;
  }

  // Get entities by location name
  atLocation(location) {
    const q = location.toLowerCase();
    return this.store.query('spatial', (data) =>
      data.location?.toLowerCase().includes(q)
    );
  }

  // Get entities by geohash prefix (area query)
  inArea(geohashPrefix) {
    const results = [];
    const index = this.store.indexes.get('spatial');

    for (const [entityId, indexData] of index.byEntity) {
      if (indexData.geohash?.startsWith(geohashPrefix)) {
        results.push(this.store.get(entityId));
      }
    }

    return results.filter(Boolean);
  }

  // Cluster entities by proximity
  cluster(entities, precision = 4) {
    const clusters = new Map();

    for (const entity of entities) {
      const coords = entity.facets.spatial?.coords;
      if (!coords) continue;

      const hash = computeGeohash(coords, precision);

      if (!clusters.has(hash)) {
        clusters.set(hash, { center: coords, entities: [] });
      }
      clusters.get(hash).entities.push(entity);
    }

    return Array.from(clusters.values());
  }
}

// ============================================================
// EXPORTS
// ============================================================

export {
  EntityStore,
  FacetIndex,
  TimelineLens,
  PeopleLens,
  MapLens,
  FACET_PROTOCOLS,
  computeGeohash
};
