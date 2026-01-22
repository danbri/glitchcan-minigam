# Timeline OS - Skunkworks Vision

## Inspirations

### Gelernter's Lifestreams (1990s)
- Documents organized chronologically, not spatially
- "The stream is your diary, your electronic life"
- Failed commercially but conceptually prescient
- **Key insight**: Time is more natural than hierarchy

### Modern Successors
- **Knowledge graphs**: Semantic relationships, linked data
- **Activity streams**: Social web, ActivityPub
- **Event sourcing**: Immutable logs, CQRS patterns

### Our Synthesis
Combine temporal streams (Lifestreams) with semantic links (knowledge graphs):

```
Timeline axis: ═══════════════════════════════════════════▶
                │           │              │
                ▼           ▼              ▼
              [doc]──────[edit]────────[response]
                │           │              │
                └─────links─┴──────────────┘
                      (semantic graph)
```

---

## Protocol Layer: AI-First, Federated

### Why These Protocols?

| Protocol | Purpose | Timeline OS Role |
|----------|---------|------------------|
| **WebRTC** | P2P real-time | Live collaboration, AI voice, screen share |
| **XMPP** | Federated messaging | Presence, notifications, agent-to-agent |
| **Samba/WebDAV** | Network files | Shared workspaces, mounted drives |
| **MCP** | AI tool bus | Tool invocation, context sharing |

### AI-First Architecture

Not "app with AI features" but "AI with app features":

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Mediation Layer                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Claude  │  │ Local   │  │ Custom  │  │ MCP     │        │
│  │ API     │  │ LLM     │  │ Agents  │  │ Servers │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       └────────────┴────────────┴────────────┘              │
│                         │                                    │
│              ┌──────────┴──────────┐                        │
│              │   MCP Tool Bus      │                        │
│              │   (capability-based)│                        │
│              └──────────┬──────────┘                        │
├─────────────────────────┼───────────────────────────────────┤
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Timeline Shell (orchestrator)           │   │
│  │  • Event stream (Lifestreams model)                 │   │
│  │  • Semantic links (knowledge graph overlay)         │   │
│  │  • Version control (every state is recoverable)     │   │
│  └─────────────────────────────────────────────────────┘   │
│                         │                                    │
│    ┌────────────────────┼────────────────────┐             │
│    ▼                    ▼                    ▼              │
│  [App]               [App]               [App]              │
│  iframe              iframe              iframe             │
│  sandbox             sandbox             sandbox            │
├─────────────────────────────────────────────────────────────┤
│                    Protocol Layer                           │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐           │
│  │ WebRTC │  │ XMPP   │  │ WebDAV │  │ HTTP   │           │
│  │ P2P    │  │ federate│ │ files  │  │ APIs   │           │
│  └────────┘  └────────┘  └────────┘  └────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Everything is an Event

```javascript
{
  id: "evt_abc123",
  timestamp: "2026-01-22T15:30:00Z",
  type: "edit",
  actor: { type: "ai", id: "claude-3" },
  target: { type: "document", id: "doc_xyz" },
  data: { diff: "..." },
  links: [
    { rel: "parent", href: "evt_abc122" },
    { rel: "related", href: "evt_abc100" }  // semantic link
  ]
}
```

### 2. Capabilities, Not Permissions

Apps request capabilities, shell grants or denies:

```javascript
// App requests
{ capability: "file:read", scope: "/workspace/*" }
{ capability: "ai:chat", model: "claude-3" }
{ capability: "network:webrtc", peers: ["alice@example.com"] }

// Shell grants with constraints
{ granted: true, expires: "2026-01-22T16:00:00Z", audit: true }
```

### 3. Federation via XMPP

```
alice@timeline.local  ←──XMPP──→  bob@timeline.remote
         │                              │
    [local shell]                 [remote shell]
         │                              │
    [shared doc] ←───WebRTC────→ [shared doc]
```

### 4. AI as First-Class Participant

AI isn't a "feature" - it's an actor in the timeline:

```
10:00  [user] Created document
10:05  [user] Wrote first draft
10:10  [claude] Suggested improvements  ← AI action visible
10:12  [user] Accepted 2/3 suggestions
10:15  [claude] Ran tests automatically  ← AI proactive
10:16  [system] Tests passed
```

---

## WebRTC Integration

### Use Cases
1. **Live cursor sharing** - See collaborator cursors in real-time
2. **Voice/video overlay** - AI or human voice in floating panel
3. **Screen sharing** - Share app state P2P
4. **Data channels** - Sync document changes without server

### Implementation Sketch

```javascript
class RTCBridge {
  constructor(shell) {
    this.shell = shell;
    this.peers = new Map();
  }

  async connect(peerId) {
    const pc = new RTCPeerConnection(config);

    // Data channel for document sync
    const dc = pc.createDataChannel('sync');
    dc.onmessage = (e) => this._handleSync(peerId, e.data);

    // Track for voice/video
    pc.ontrack = (e) => this._handleMedia(peerId, e.streams[0]);

    this.peers.set(peerId, { pc, dc });

    // Signal via XMPP or WebSocket
    await this._signal(peerId, pc);
  }

  broadcast(event) {
    for (const [id, peer] of this.peers) {
      peer.dc.send(JSON.stringify(event));
    }
  }
}
```

---

## XMPP Federation

### Why XMPP?
- Mature federation model
- Presence (online/offline/busy)
- Extensible (XEPs for custom features)
- Works with existing infrastructure

### Timeline OS Extensions

```xml
<!-- Custom XEP for timeline events -->
<message to="bob@example.com">
  <timeline-event xmlns="urn:timeline:event">
    <type>document:edit</type>
    <timestamp>2026-01-22T15:30:00Z</timestamp>
    <actor>alice@local</actor>
    <data><![CDATA[{"diff": "..."}]]></data>
  </timeline-event>
</message>
```

---

## Knowledge Graph Overlay

Events link to each other semantically, not just temporally:

```
                    ┌───────────────┐
                    │ Project: X    │
                    │ (entity node) │
                    └───────┬───────┘
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
         [doc:spec]    [doc:impl]    [doc:test]
              │             │             │
              ▼             ▼             ▼
         [edit:v1]     [edit:v1]     [edit:v1]
              │             │             │
              ▼             ▼             ▼
         [ai:review]   [ai:help]    [ai:generate]
```

Query: "Show me everything Claude did on Project X" → traverse graph

---

## WASM Compute Layer

Heavy lifting happens in WASM sandboxes:

```javascript
class WasmWorker {
  constructor(module) {
    this.worker = new Worker('wasm-worker.js');
    this.worker.postMessage({ type: 'load', module });
  }

  async run(fn, args) {
    return new Promise((resolve) => {
      const id = crypto.randomUUID();
      this.worker.postMessage({ type: 'call', id, fn, args });
      this.worker.onmessage = (e) => {
        if (e.data.id === id) resolve(e.data.result);
      };
    });
  }
}

// Usage
const imageProcessor = new WasmWorker('image-tools.wasm');
const result = await imageProcessor.run('resize', [imageData, 800, 600]);
```

---

## Relation to FINK

This platform could host FINK-style interactive fiction:

| FINK Concept | Timeline OS Equivalent |
|--------------|------------------------|
| Story state | Event in timeline |
| Choices | Branching events |
| INK variables | Knowledge graph nodes |
| Media (images, audio) | Capability-loaded assets |
| Minigames | Sandboxed app iframes |

Migration path:
1. Port FINK sandbox to Timeline OS app container
2. Story events become timeline events
3. Reader progress syncs via WebRTC
4. AI can suggest/generate story branches

---

## Open Questions

1. **Conflict resolution** - When P2P edits conflict, who wins?
2. **Offline first** - How to queue events when disconnected?
3. **Identity** - XMPP JIDs? DIDs? Something else?
4. **Persistence** - IndexedDB? Remote sync? Both?
5. **AI costs** - Who pays for API calls in federated scenario?

---

## Next Steps (Skunkworks)

- [x] Basic shell with timeline strip
- [x] App containers with iframe isolation
- [ ] WebRTC data channel prototype
- [ ] XMPP presence indicator
- [ ] Knowledge graph overlay on events
- [ ] WASM worker pool
- [ ] MCP tool bus implementation
- [ ] FINK story loader as Timeline app
