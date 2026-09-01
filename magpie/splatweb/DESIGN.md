# splatweb — Telemetry-Driven Splat Telepresence

**Status:** design sketch + tech demos, September 2026. Nothing here is wired
into the FINK platform yet.

Live demo hub (after commit + Pages deploy):
`https://danbri.github.io/glitchcan-minigam/magpie/splatweb/index.html`

Source draft this doc supersedes: [`raw.txt`](raw.txt) (danbri's proposal +
a Gemini-generated spec).

---

## 1. The idea

Instead of streaming 2D video frames of your messy room and your face to N
viewers, you stream **presence, not pixels**:

- **Your room** is a Gaussian-splat "room avatar" you chose (or scanned once,
  then cleaned/simplified/stylised offline). It is a static asset, fetched
  once from a CDN and cached. It never rides the realtime stream.
- **You** are a splat/mesh avatar. What travels in realtime is a tiny binary
  telemetry stream: head pose, position, and a handful of facial blendshape
  weights — plus Opus audio.
- **Media objects** (a video on your wall, a shared doc) are references to
  their origin CDNs. Viewers fetch them directly; they are not re-encoded
  into your stream.
- The receiver's renderer reconstructs the scene locally and uses
  interpolation + short-horizon prediction (dead reckoning) to hide network
  jitter.

### Why this wins: the arithmetic

| Stream | Rate |
|---|---|
| Telemetry packet, 32 bytes × 30 Hz | 0.96 KB/s ≈ **7.7 kbit/s** |
| + transport overhead (SCTP/DTLS, ~2×) | ≈ 15–20 kbit/s |
| Opus voice | 24–32 kbit/s |
| **Total live presence** | **≈ 40–50 kbit/s** |
| 720p30 video call, typical | 1,500–2,500 kbit/s |

That is a **30–60× reduction** per viewer, and — critically — the expensive
parts (room splat, avatar asset, wall media) are *cacheable static assets*
served by CDN, so fan-out to 10,000 viewers costs 10,000 × ~50 kbit/s of
dumb relay traffic, not 10,000 video transcodes. The relay never decodes
anything: telemetry packets are opaque 32-byte blobs it repeats.

---

## 2. What we keep from the Gemini draft, and what we correct

The Gemini spec (`raw.txt`) got the shape right. Corrections and decisions:

**Kept:**
- Zero-framework, native Web Components (Custom Elements + Shadow DOM) —
  matches this repo's house style (foafos/edot are built exactly this way).
- Fixed-width binary telemetry packets over an unordered, unreliable
  `RTCDataChannel`; audio as a normal WebRTC Opus track.
- Tiered rendering: splats → low-poly mesh → 2D canvas puppet.
- XMPP MIX as the *control plane* (rooms, membership, spatial presence,
  WebRTC signalling) — not the media plane.

**Corrected:**
1. **The packet layout in the draft does not add up.** It claims "Top 20
   Facial Blendshapes (20 × uint8)" in bytes 22..31 — that is 10 bytes, not
   20. A 32-byte packet holds **10** uint8 blendshapes. Ten well-chosen
   channels (jaw, blinks, brows, smile corners, pucker, gaze x/y, cheek) are
   enough for expressive presence; a 44-byte "HD" packet with 20 channels is
   an easy v2. The corrected v0 layout is in §4.
2. **A P2P mesh cannot serve 10,000 recipients.** Mesh is fine to ~8 peers.
   The broadcast case needs a fan-out relay (an SFU that forwards
   DataChannel/datagram payloads, or a WebTransport fan-out server). The good
   news: because each viewer costs ~50 kbit/s, one modest relay serves an
   audience that would need a video CDN otherwise. Design for both: mesh for
   small rooms, relay for broadcast.
3. **Hand-written C++/Rust WASM SIMD landmark extraction is premature.**
   MediaPipe Tasks (FaceLandmarker) already ships as WASM+SIMD, runs in a
   worker, and outputs exactly the ARKit-style blendshapes we quantize. Use
   it behind an interface; replace later if it earns replacement. The demos
   here go one step simpler and *simulate* capture (pointer/auto-driven
   pose), because capture is not the risky part of the design.
4. **WebGPU compute splatting is deferred, not required.** The dbdb work
   showed WebGL splatting is fast enough for scenes of this size, and WebGL2
   reaches every target device. So Tier 1 in *this* sketch is WebGL2
   instanced splatting with CPU sort — also testable in the headless CI rig
   (which is WebGL-only: SwiftShader, WebGPU silently absent — see
   CLAUDE.md). A WGSL compute sorter is a later optimisation behind the same
   renderer interface. WebGPU *can* be verified during development by
   automating a real Chrome browser — the headless-CI limitation is not a
   dev-loop limitation. So the WGSL tier is deferred on priority, not on
   testability.
5. **The five-component suite is trimmed to three** for the sketch:
   `<splat-stage>` (render), telemetry codec (a module, not an element), and
   a network layer. `<xmpp-mix-provider>` and `<mix-spatial-map>` are real
   but belong to the foafos integration phase (§7), where MIX presence maps
   onto machinery the edot suite already has (Bus, capabilities).

---

## 3. Architecture: three planes

```
ASSET PLANE (bulk, cached, CDN)          CONTROL PLANE (XMPP MIX / foafos bus)
  room.splat  avatar.splat  wall-media     rooms, membership, asset manifests,
       │            │           │          spatial presence, WebRTC signalling
       └────────────┴───────────┘                        │
                    ▼                                    ▼
             ┌───────────────────────────────────────────────┐
             │                  VIEWER                       │
             │  splat renderer ◄── pose buffer ◄── decoder   │
             └───────────────────────────────▲───────────────┘
                                             │ 32-byte packets @ 20–30 Hz
REALTIME PLANE (tiny, lossy, low-latency)    │ + Opus audio track
  sender ──► encoder ──► DataChannel ──► mesh (≤8 peers) or fan-out relay
```

- **Asset plane:** room and avatar splats are content-addressed bundles. A
  "room avatar" is picked from a catalogue (the `magpie/dbdb` asset store is
  the obvious seed — it already has licence-checked, LOD-packed splat
  elements) or produced from a user scan by an offline
  clean/simplify/stylise pipeline (that pipeline is the `splat-style` /
  `splat-discovery` territory: floater cull, palette grading, LOD pyramid).
- **Control plane:** who is in the room, where they stand, which assets to
  fetch, signalling. XMPP MIX (XEP-0369) presence carries spatial pos +
  peer-id, as in the draft's stanza example. None of this is
  latency-critical.
- **Realtime plane:** only two flows — audio, and the pose packets below.
  Unreliable + unordered on purpose: a late pose packet is worthless, so
  never retransmit; the sequence number lets the receiver drop stale ones.

---

## 4. Telemetry packet v0 (corrected, 32 bytes)

Implemented in [`lib/telemetry-codec.js`](lib/telemetry-codec.js); exercised
live by the telemetry demo.

```
offset  size  field
 0       4    timestamp     uint32, sender clock, ms (wraps ~49 days)
 4       4    sequence      uint32
 8       8    head quat     4 × int16, q/32767, normalized
16       6    head position 3 × int16, millimetres, ±32.7 m range
22      10    blendshapes   10 × uint8
```

The 10 blendshape channels (v0):

| # | channel | encoding |
|---|---|---|
| 0 | jawOpen | 0..1 → 0..255 |
| 1 | eyeBlinkLeft | 0..1 |
| 2 | eyeBlinkRight | 0..1 |
| 3 | browInnerUp | 0..1 |
| 4 | mouthSmileLeft | 0..1 |
| 5 | mouthSmileRight | 0..1 |
| 6 | mouthPucker | 0..1 |
| 7 | eyeLookX | −1..1 → 0..255 |
| 8 | eyeLookY | −1..1 → 0..255 |
| 9 | cheekPuff | 0..1 |

Quantization error is negligible for presence: worst-case quat error
~0.003°, position 0.5 mm, blendshape 0.4%. The codec demo shows round-trip
error live.

**Receiver model** (implemented in [`lib/pose-buffer.js`](lib/pose-buffer.js)):
a jitter buffer holds recent packets; a playhead trails the newest packet by
a configurable buffer (default 100 ms) and slews smoothly rather than
jumping; between packets the pose is interpolated (quat slerp, linear
blend); past the newest packet it is **extrapolated** from the last two
poses (dead reckoning), capped at 200 ms so a stall freezes gracefully
instead of spinning off.

---

## 5. Rendering tiers

| Tier | Tech | Target | Status in this sketch |
|---|---|---|---|
| 1 | WebGL2 instanced Gaussian splatting, CPU depth sort | desktop + modern mobile | **built** — [`lib/splat-renderer.js`](lib/splat-renderer.js) |
| 1+ | WebGPU/WGSL compute tile sort | high-end, later | deferred (see §2.4) |
| 2 | low-poly mesh avatar (GLTF/VRM morphs) | mid mobile | not built; same pose packet drives it |
| 3 | Canvas-2D vector puppet | low-power, background tabs | **built** — [`lib/face2d.js`](lib/face2d.js), used by the telemetry demo |

The point proven by building 1 and 3 against the *same packet stream*: the
telemetry format is renderer-agnostic. Tier 2 is bookkeeping, not research.

The Tier-1 renderer is a real (if minimal) 3DGS rasterizer: per-splat
rotation+scale → 3D covariance, projected via the perspective Jacobian to a
2D covariance, eigen-decomposed into an oriented screen ellipse, drawn as an
instanced quad with `exp(−½d²)` falloff, back-to-front premultiplied
blending. ~250 lines, zero dependencies.

---

## 6. What is in this folder, and what each piece proves

| file | what it is |
|---|---|
| `index.html` | demo hub |
| `DESIGN.md` | this document |
| `raw.txt` | the original draft (kept verbatim) |
| `lib/telemetry-codec.js` | the 32-byte packet: encode / decode / round-trip error |
| `lib/pose-math.js` | quaternion + pose helpers (mul, slerp, euler) |
| `lib/pose-driver.js` | simulated capture: pointer-driven + autonomous "performer" mode (wander, blink, talk bursts) |
| `lib/network-sim.js` | lossy channel: latency, jitter, packet loss, reordering |
| `lib/pose-buffer.js` | receiver jitter buffer: slewed playhead, slerp interpolation, capped dead-reckoning extrapolation |
| `lib/splat-renderer.js` | dependency-free WebGL2 Gaussian splat renderer |
| `lib/scene-builder.js` | procedural splat content: a stylised room (~3k splats) and a blendshape-driven head avatar (~200 splats) |
| `lib/face2d.js` | Tier-3 Canvas-2D puppet renderer |
| `demo-telemetry.html` | **Demo 1** — codec inspector: live 32-byte hex view, decoded fields, quantization error, bandwidth-vs-video meter; sender and decoded-receiver faces side by side (Tier 3) |
| `demo-splat-room.html` | **Demo 2** — the room avatar: procedural splat room, orbit/zoom, stylisation slider (palette quantization), splat count + FPS |
| `demo-stage.html` | **Demo 3** — the whole thesis: sender pose → encoder → simulated lossy network (sliders for latency/jitter/loss/rate) → jitter buffer → splat room + splat avatar. Live stats: kbit/s, loss, effective latency, extrapolation events |

Live URLs once deployed:

- `https://danbri.github.io/glitchcan-minigam/magpie/splatweb/index.html`
- `https://danbri.github.io/glitchcan-minigam/magpie/splatweb/demo-telemetry.html`
- `https://danbri.github.io/glitchcan-minigam/magpie/splatweb/demo-splat-room.html`
- `https://danbri.github.io/glitchcan-minigam/magpie/splatweb/demo-stage.html`

**Honesty box — what the demos do NOT prove:**
- No real camera capture. The pose driver simulates a face tracker. (The
  packet format is the risky interface; capture is a known-solved problem
  via MediaPipe.)
- No real network. `network-sim.js` models latency/jitter/loss inside one
  page. Real WebRTC DataChannel plumbing is Phase 2.
- No XMPP. Control plane is out of scope for the sketch.
- The "room avatar" is procedural, not a scanned+stylised splat. Real room
  bundles come from the dbdb pipeline.
- Performance numbers on the hub page are measured on whatever machine
  opens it, not a claim.

---

## 7. Fit with this repo (foafos / edot / dbdb)

- **foafos as the host:** `<splat-stage>` becomes a guest app in the foafos
  shell; the control plane rides the existing Bus/capabilities machinery
  rather than a from-scratch XMPP stack. The Gemini draft's
  `<xmpp-mix-provider>` maps onto an edot Connections-style backend: same
  events (`mix:user-joined`, `mix:spatial-update`), different transport
  underneath.
- **dbdb as the room catalogue:** "choose a room avatar" is literally the
  dbdb asset store — licence-checked splat elements, LOD pyramids, appearance
  tags. The stylise/cleanup step the proposal calls for is the offline half
  of the `splat-style` skill's map.
- **FINK as the stage manager:** a story or office scene declaring its room
  bundle + entry points is a natural `.fink.js` / manifest job. A telepresence
  room is, squinting, a multiplayer minigame.

## 8. Phasing

1. **Sketch (this folder):** packet format, receiver model, splat renderer,
   end-to-end simulated pipeline. *Done.*
2. **Real transport:** two-tab WebRTC DataChannel (manual copy-paste
   signalling first, then a signalling relay). Measure real latency.
3. **Real capture:** MediaPipe FaceLandmarker in a worker → the same
   encoder. Compare wire format v0 sufficiency; spec v1 (44-byte, 20
   channels) if needed. *(Speech-energy jaw via Web Audio already landed —
   the MIC button in demo 3.)* Candidate stacks and openly licensed avatar
   models, with verified licences: [`catalogue.html`](catalogue.html).
4. **Real rooms:** load a dbdb `.compressed.ply` / pack element as the room
   bundle; avatar from a splat cutout.
5. **Broadcast:** fan-out relay experiment; 1 sender → many read-only tabs.
6. **foafos integration:** stage as guest app; MIX-style presence over the
   shell bus.

## 9. Open questions

- **Avatar rest-state:** what does a participant look like when telemetry
  stops (tab hidden, network gone)? Proposal: fade to a "statue" pose after
  the 200 ms extrapolation cap, with an explicit staleness indicator —
  never keep animating a dead feed as if live.
- **Ethics/consent:** an avatar that impersonates presence needs an
  unambiguous live/replay/synthetic indicator. Prediction smooths ~100 ms;
  it must not be allowed to grow into "AI keeps talking for you".
- **Audio spatialisation:** Web Audio PannerNode fed by the same position
  telemetry — cheap win, not sketched here.
- **Blendshape channel choice:** is 10 enough? Demo 3's talk mode looks
  alive with 4. Real capture data should decide v1.
