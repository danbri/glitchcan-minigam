# Security & Privacy Model

## The Tension

**Unification wants:**
- Alice in Contacts = Alice in Photos = Alice in Calendar
- Search finds everything
- Links reveal context

**Privacy wants:**
- Apps can't see each other's data
- A breach doesn't expose everything
- User controls what connects to what

**How do we get both?**

---

## Principle 1: Local-First, Encrypted at Rest

Nothing leaves the device unencrypted. Ever.

```
Device
├── Entity Store (encrypted SQLite/IndexedDB)
│   ├── Entities encrypted per-facet
│   ├── Links encrypted separately
│   └── Indexes are encrypted bloom filters (searchable encryption)
└── Keys
    ├── Master key (derived from passphrase)
    ├── Per-facet keys (derived from master)
    └── Per-app keys (granted capabilities)
```

**Sync is opt-in:**
- Default: data stays on device
- If sync enabled: E2E encrypted to user's other devices
- No server can read plaintext

---

## Principle 2: Facet-Level Permissions

Apps don't get "access to entity" - they get "access to facet of entity."

```javascript
// App requests access
app.requestCapability({
  facet: 'spatial',
  scope: 'read',
  reason: 'Show photos on map'
});

// User grants (or denies)
// If granted, app can ONLY see spatial facet
// Cannot see: social facet, semantic facet, links
```

**Example: Photo Gallery App**

| Facet | Access | Why |
|-------|--------|-----|
| media | read/write | Display and edit photos |
| temporal | read | Sort by date |
| spatial | read | Show on map |
| social | **DENIED** | Doesn't need to know who's in photos |
| semantic | **DENIED** | Doesn't need mood/topic data |

The app literally cannot see faces/names even though the entity has them.

---

## Principle 3: Projected Views, Not Full Entities

Apps never get raw entities. They get **projections**.

```javascript
// What the entity actually contains
entity = {
  id: 'entity:abc',
  facets: {
    media: { representations: { 'image/jpeg': blob } },
    temporal: { occurred: '2024-06-15T20:30:00Z' },
    spatial: { location: 'Paris', coords: [48.85, 2.33] },
    social: { participants: ['entity:alice', 'entity:bob'] },  // SENSITIVE
    semantic: { mood: 'romantic', topics: ['anniversary'] }   // SENSITIVE
  },
  links: [
    { relation: 'taken-by', target: 'entity:self' },
    { relation: 'part-of', target: 'entity:paris-trip' }
  ]
}

// What Photo Gallery app sees (projection based on granted facets)
projection = {
  id: 'entity:abc',
  facets: {
    media: { representations: { 'image/jpeg': blob } },
    temporal: { occurred: '2024-06-15T20:30:00Z' },
    spatial: { location: 'Paris', coords: [48.85, 2.33] }
  }
  // NO social facet
  // NO semantic facet
  // NO links
}
```

---

## Principle 4: Consent-Based Linking

Links between entities require explicit consent.

```
User takes photo of Alice
    │
    ▼
AI detects face: "This might be Alice Chen"
    │
    ▼
USER PROMPT: "Link this photo to Alice Chen?"
    │
    ├── [Yes] → Link created, visible in both directions
    ├── [No]  → No link, AI suggestion discarded
    └── [Never for this person] → Blocklist this face
```

**No silent linking.** The system might *suggest* connections, but user approves.

**Audit trail:**
```javascript
{
  type: 'link:created',
  timestamp: '2024-06-16T10:00:00Z',
  from: 'entity:photo-abc',
  to: 'entity:alice',
  relation: 'depicts',
  consent: {
    method: 'explicit-prompt',
    approvedAt: '2024-06-16T10:00:05Z'
  }
}
```

---

## Principle 5: Contextual Isolation

Not one "Alice" - multiple contextual identities that user can choose to merge or keep separate.

```
┌─────────────────┐     ┌─────────────────┐
│ Work Context    │     │ Personal Context│
│                 │     │                 │
│ entity:alice-w  │     │ entity:alice-p  │
│ • work email    │     │ • personal email│
│ • office photos │     │ • vacation photos│
│ • meeting notes │     │ • birthday party │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │    [User Decision]    │
         │         │             │
         ▼         ▼             ▼
    ┌─────────────────────────────────┐
    │ Merge into unified Alice?       │
    │ • Yes (full merge)              │
    │ • Yes (read-only cross-link)    │
    │ • No (keep separate forever)    │
    └─────────────────────────────────┘
```

**Default: Contexts are isolated.** Work apps can't see personal data and vice versa.

---

## Principle 6: Capability Tokens with Scope

When an app gets access, it's via a scoped, time-limited, auditable token.

```javascript
// Capability token structure
{
  token: 'cap_xyz789',
  grantedTo: 'app:photo-gallery',
  scope: {
    facets: ['media', 'temporal', 'spatial'],
    operations: ['read'],
    entityFilter: {
      'media.types': { $contains: 'image/*' }  // Only image entities
    }
  },
  constraints: {
    expiresAt: '2024-12-31T23:59:59Z',
    maxQueries: 1000,
    noExport: true,       // Can't bulk export
    noAI: true,           // Can't send to AI services
    auditLevel: 'full'    // Log every access
  },
  revocable: true
}
```

**User can revoke anytime.** App loses access immediately.

---

## Principle 7: Differential Privacy for AI

AI features (face recognition, auto-tagging) run locally with differential privacy.

```
Photo → [Local AI Model] → "Probably Alice (87%)"
                              │
                              ▼
                          Suggestion shown to user
                          (AI never sees raw entity)
                              │
                              ▼
                          User confirms/rejects
                              │
                              ▼
                          Model improves locally
                          (no data sent to cloud)
```

**If cloud AI is used:**
- User explicitly opts in
- Data is anonymized/aggregated
- Results cached locally, not stored remotely

---

## Principle 8: OS Items vs App Items

The original question: how do system items (apps, files) relate to content items (people, places)?

**Solution: OS items are also entities, but in a separate namespace with different rules.**

```
OS Context (system namespace)
├── entity:app:photo-gallery
│   └── facets: { identity, permissions, usage-stats }
├── entity:file:/Documents/report.pdf
│   └── facets: { media, temporal, provenance }
└── entity:folder:/Documents
    └── facets: { identity, contains: [...] }

User Context (content namespace)
├── entity:person:alice
├── entity:place:paris
├── entity:event:dinner-2024
└── entity:memory:paris-trip
```

**Cross-namespace linking requires elevation:**

```javascript
// App wants to link a file to a person
app.requestCapability({
  type: 'cross-namespace-link',
  from: 'entity:file:/Documents/photo.jpg',  // OS namespace
  to: 'entity:person:alice',                  // Content namespace
  relation: 'depicts',
  reason: 'File contains photo of Alice'
});

// Requires explicit user approval (elevated permission)
```

---

## Principle 9: Breach Containment

If one context/app is compromised, damage is limited.

```
Compromised: App X (had access to media + temporal facets)

What attacker gets:
├── Photos (blobs)
├── Dates (when taken)
└── Locations (where taken)

What attacker CANNOT get:
├── Who is in photos (social facet not granted)
├── What photos mean (semantic facet not granted)
├── Links to other entities (links not granted)
├── Anything from other apps (isolated)
└── Anything from other contexts (isolated)
```

**Blast radius is limited by design.**

---

## Principle 10: User Audit Dashboard

User can always see:
- What apps have access to what
- What queries have been made
- What links exist
- What AI suggestions were made

```
┌─────────────────────────────────────────────────────────┐
│ Privacy Dashboard                                       │
├─────────────────────────────────────────────────────────┤
│ Apps with Access                                        │
│ ┌───────────────┬────────────┬──────────┬───────────┐  │
│ │ App           │ Facets     │ Queries  │ Actions   │  │
│ ├───────────────┼────────────┼──────────┼───────────┤  │
│ │ Photo Gallery │ media,temp │ 1,247    │ [Revoke]  │  │
│ │ Map App       │ spatial    │ 89       │ [Revoke]  │  │
│ │ AI Assistant  │ ALL        │ 5,021    │ [Review]  │  │
│ └───────────────┴────────────┴──────────┴───────────┘  │
│                                                         │
│ Recent Activity                                         │
│ • 2 min ago: Photo Gallery read 12 photos              │
│ • 5 min ago: AI Assistant suggested link (rejected)    │
│ • 1 hour ago: Map App queried Paris locations          │
│                                                         │
│ [Export My Data] [Delete All Data] [Panic Button]      │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation: Secure Entity Store

```javascript
class SecureEntityStore extends EntityStore {
  constructor(masterKey) {
    super();
    this.masterKey = masterKey;
    this.facetKeys = new Map();
    this.auditLog = [];
  }

  // Derive per-facet encryption keys
  _getFacetKey(facetName) {
    if (!this.facetKeys.has(facetName)) {
      // HKDF derivation from master key
      const key = deriveFacetKey(this.masterKey, facetName);
      this.facetKeys.set(facetName, key);
    }
    return this.facetKeys.get(facetName);
  }

  // Override create to encrypt facets
  create(facets) {
    const encryptedFacets = {};
    for (const [name, data] of Object.entries(facets)) {
      const key = this._getFacetKey(name);
      encryptedFacets[name] = encrypt(data, key);
    }
    return super.create(encryptedFacets);
  }

  // Get entity with capability check
  getWithCapability(entityId, capability) {
    const entity = super.get(entityId);
    if (!entity) return null;

    // Check capability grants facet access
    const allowedFacets = capability.scope.facets;

    // Create projection with only allowed facets
    const projection = {
      id: entity.id,
      facets: {}
    };

    for (const facetName of allowedFacets) {
      if (entity.facets[facetName]) {
        const key = this._getFacetKey(facetName);
        projection.facets[facetName] = decrypt(entity.facets[facetName], key);
      }
    }

    // Audit the access
    this._audit('entity:read', {
      entityId,
      app: capability.grantedTo,
      facetsAccessed: Object.keys(projection.facets)
    });

    return projection;
  }

  _audit(action, details) {
    this.auditLog.push({
      timestamp: Date.now(),
      action,
      details
    });
  }
}
```

---

## Summary

| Concern | Solution |
|---------|----------|
| Data at rest | Encrypted per-facet |
| App access | Capability tokens with facet scope |
| Cross-app visibility | Projections, not raw entities |
| Linking | Explicit user consent required |
| Context mixing | Isolated namespaces, merge requires elevation |
| AI training | Local models, differential privacy |
| Breach impact | Limited by facet/app/context isolation |
| User control | Dashboard with revoke, audit, export, delete |

**The key insight:** Unification happens at the *identity* level (one Alice), but *access* is fragmented by facet, app, and context. You get the benefits of linking without the risks of total exposure.
