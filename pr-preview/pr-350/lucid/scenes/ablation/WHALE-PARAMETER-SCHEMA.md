# Humpback Whale Parametric Model - Parameter Schema

**Version:** 3.0
**Model File:** `whale-parametric-v3.json`
**Purpose:** Semantic parameter documentation for AI-assisted modeling and UI generation

## Design Principles

1. **Semantic Knobs**: Parameters describe biological traits, not raw geometry
2. **Monotonic Effects**: Each parameter has predictable, unidirectional impact
3. **Spatial Decoupling**: Changes to one region don't create side effects elsewhere
4. **Constraint Validation**: Critical proportions have documented bounds
5. **Animation Support**: Built-in parameters for realistic swimming motion

## Parameter Categories

### Body Parameters

Parameters controlling overall body shape and proportions.

| Parameter | Type | Range | Default | Units | Description |
|-----------|------|-------|---------|-------|-------------|
| `bodyLength` | scalar | 8-16 | 12.0 | meters (relative) | Total body length from rostrum to tail notch |
| `girthAtBlowhole` | scalar | 1.0-3.0 | 1.8 | meters (relative) | Maximum body width at widest point (shoulder area) |
| `bodyAspectRatio` | scalar | 0.75-0.95 | 0.86 | ratio | Height-to-width ratio (0.86 = slightly compressed) |
| `peduncleTaper` | scalar | 0.25-0.50 | 0.36 | ratio | How much tail narrows (fraction of max girth) |

**Critical Constraint:**
- `bodyLength / girthAtBlowhole` should be **6.5-8.0** for humpback identification
- Values >8.0 produce sleek torpedo shape (NOT humpback)
- Values <6.5 produce overly chunky, unrealistic proportions

**Affects:**
- Body: torso ellipsoid radii
- Flippers: attachment position and scale
- Ventral: throat pleat width
- All derived proportions

---

### Head Parameters

Parameters controlling head shape and tubercle bumps (key humpback identifier).

| Parameter | Type | Range | Default | Units | Description |
|-----------|------|-------|---------|-------|-------------|
| `headWidth` | scalar | 0.75-1.05 | 0.92 | ratio | Head width as fraction of max girth |
| `tubercleCount` | scalar | 8-20 | 12 | count | Number of prominent head tubercles |
| `tubercleSize` | scalar | 0.20-0.50 | 0.35 | displacement | Tubercle prominence (higher = more visible) |

**Critical Constraint:**
- `tubercleSize` should be **0.30-0.45** for species identification
- Values <0.30 lose humpback character
- Values >0.45 create unrealistic lumpy surface

**Affects:**
- Head: rostrum width
- Surface: displacement amount in head region only
- Species ID: tubercles are THE humpback identifier

**Implementation Note:**
Currently uses FBM displacement noise (uniform). **Should be replaced** with:
- Masked bump lattice driven by `tubercleCount` parameter
- Whale-specific distribution pattern (more at jaw line and rostrum tip)
- Varied sizes per tubercle (not uniform)

---

### Flipper Parameters

Parameters controlling pectoral flipper geometry (THE defining humpback feature).

| Parameter | Type | Range | Default | Units | Description |
|-----------|------|-------|---------|-------|-------------|
| `flipperSpan` | scalar | 0.20-0.40 | 0.31 | ratio | Flipper length as ratio of body length |
| `flipperWidth` | scalar | 0.20-0.35 | 0.28 | ratio | Flipper width as ratio of flipper length |
| `flipperSweepAngle` | scalar | 20-45 | 32 | degrees | How much flippers curve back from body |
| `flipperThickness` | scalar | 0.10-0.25 | 0.15 | ratio | Vertical thickness as ratio of width |

**CRITICAL Constraint:**
- `flipperSpan` MUST be **0.30-0.33** for humpback identification
- This is THE defining feature - longest pectoral fins of any cetacean
- Values >0.35 read as airplane wings
- Values <0.28 lose species character

**Affects:**
- Flipper: all 6 segment lengths, widths, thicknesses
- Flipper: tip position (driven by `flipperSpan * bodyLength`)
- Pose: sweep-back angles for all segments
- Underside: lighter-colored ventral patches

**Skeletal Pose Rigging:**
- 6 segments: base, humerus, radius/ulna, carpal, metacarpal, phalanges
- Sweep angle distributes across segments (0% at base → 88% at tip)
- Each segment tapers in length and thickness
- Width remains relatively constant (paddle shape)

---

### Dorsal Fin Parameters

Parameters controlling the small dorsal fin (variable in humpbacks).

| Parameter | Type | Range | Default | Units | Description |
|-----------|------|-------|---------|-------|-------------|
| `dorsalProminence` | scalar | 0.30-0.80 | 0.50 | height | Dorsal fin height (humpbacks have small fins) |
| `dorsalCurvature` | scalar | -15 to 15 | 0.0 | degrees | Rake angle (negative = hooked back) |

**Constraint:**
- Humpback dorsals are notably **small** compared to other whales
- High variability in shape (can be hooked, triangular, stubby)
- Position: 2/3 back from head (hardcoded at z = -4.0)

**Affects:**
- Dorsal fin: height only
- Dorsal fin: forward/back lean

---

### Tail Fluke Parameters

Parameters controlling caudal fin (tail) geometry.

| Parameter | Type | Range | Default | Units | Description |
|-----------|------|-------|---------|-------|-------------|
| `tailFlukeSpan` | scalar | 2.5-5.5 | 4.0 | meters (relative) | Total fluke width (tip to tip) |
| `tailForkDepth` | scalar | 0.30-0.80 | 0.55 | ratio | Depth of center notch (higher = deeper V) |
| `tailForkAngle` | scalar | 10-35 | 22 | degrees | Angle between fluke halves |
| `tailFlukeThickness` | scalar | 0.15-0.40 | 0.28 | thickness | Vertical thickness (should be very flat) |

**Critical Constraint:**
- `tailFlukeSpan / bodyLength` should be **0.30-0.40** for cetaceans
- Values >0.45 create airplane wing appearance
- Thickness should be <5% of span for realistic flukes

**Affects:**
- Tail: fluke paddle width
- Tail: center notch size
- Tail: fluke sweep angle
- Tail: vertical thickness (important for side profile)

**Semantic Knobs:**
- `tailForkDepth`: Controls notch size directly (not geometry)
- `tailForkAngle`: Controls V-shape directly (not transform)

---

### Ventral Parameters

Parameters controlling underside (throat pleats and coloration).

| Parameter | Type | Range | Default | Units | Description |
|-----------|------|-------|---------|-------|-------------|
| `ventralGrooveCount` | scalar | 4-10 | 7 | count | Number of visible throat pleats |
| `grooveDepth` | scalar | 0.06-0.20 | 0.12 | depth | Throat groove prominence |

**Biological Note:**
- Humpbacks have 12-36 grooves in reality
- We model 4-10 for visual clarity at rendering scale
- Grooves allow throat expansion during feeding

**Affects:**
- Ventral: throat pleat visibility
- Ventral: smoothSubtract k-value (depth control)

**Implementation Note:**
Currently hardcoded to 7 grooves. **Should be replaced** with:
- Parametric groove generation driven by `ventralGrooveCount`
- Varied spacing and depth per groove
- Procedural distribution along throat region

---

### Animation Parameters

Parameters for swimming motion and pose.

| Parameter | Type | Range | Default | Units | Description |
|-----------|------|-------|---------|-------|-------------|
| `tailBeatFrequency` | scalar | 0.1-1.0 | 0.4 | Hz | Swimming speed (tail beats per second) |
| `tailAmplitude` | scalar | 5-30 | 15 | degrees | Maximum tail deflection angle |
| `spineCurvature` | scalar | -10 to 10 | 0.0 | degrees | Body bend (+ = up, - = down) |
| `bodyRoll` | scalar | -30 to 30 | 0.0 | degrees | Banking angle (rotation around length axis) |
| `bodyYaw` | scalar | -20 to 20 | 0.0 | degrees | Turning angle (rotation around vertical) |

**Animation Coupling (Rig Layer):**

```
swimCycle = 2π × time × tailBeatFrequency

flukeAngle = tailAmplitude × sin(swimCycle + 0.0)
peduncleAngle = tailAmplitude × 0.53 × sin(swimCycle - 0.15)
torsoAngle = tailAmplitude × 0.20 × sin(swimCycle - 0.30)
```

**Phase Relationships:**
- Flukes: in phase with cycle (0.0)
- Peduncle: leads by 15% phase (wave propagation)
- Torso: leads by 30% phase (decreasing amplitude)

**Affects:**
- All body parts: swimming motion
- Whole body: static pose control via roll/yaw/curvature

---

### Color Parameters

Parameters controlling body coloration.

| Parameter | Type | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| `bodyColor` | color3 | RGB | [0.15, 0.17, 0.22] | Dorsal surface (dark gray-black) |
| `ventralColor` | color3 | RGB | [0.85, 0.88, 0.92] | Ventral surface (white to mottled) |
| `flipperUndersideColor` | color3 | RGB | [0.70, 0.73, 0.77] | Flipper underside (intermediate) |

**Biological Pattern:**
- Counter-shading: dark above, light below
- Flipper undersides often have white patches
- Fluke patterns are unique per individual (like fingerprints)

---

## Derived Values (Rig Layer)

Computed from primary parameters - not user-editable.

| Derived | Formula | Purpose |
|---------|---------|---------|
| `flipperLength` | `bodyLength × flipperSpan` | Absolute flipper length in scene units |
| `flipperWidthAbsolute` | `flipperLength × flipperWidth` | Absolute flipper width |
| `headLengthRatio` | 0.22 (constant) | Head is ~22% of body length |
| `bodyLengthToGirthRatio` | `bodyLength / girthAtBlowhole` | Should be 6.5-8.0 for humpback |
| `flukeSpanRatio` | `tailFlukeSpan / bodyLength` | Should be 0.30-0.40 |

---

## Constraint Validation (Rig Layer)

Critical bounds for species identification.

| Parameter | Min | Max | Severity | Reason |
|-----------|-----|-----|----------|--------|
| `flipperSpan` | 0.30 | 0.33 | **CRITICAL** | THE humpback identifier - longest fins |
| `bodyLengthToGirthRatio` | 6.5 | 8.0 | **HIGH** | Chunky barrel body - NOT sleek |
| `tubercleSize` | 0.30 | 0.45 | **HIGH** | Must be prominent for species ID |
| `flukeSpanRatio` | 0.30 | 0.40 | **HIGH** | Proportional flukes - NOT wings |

**Validation Workflow:**
1. Check all CRITICAL constraints first
2. If any fail → model CANNOT be identified as humpback
3. Check HIGH constraints for credibility
4. Report all violations before committing

---

## Spatial Gating (Decoupling Regions)

Parameters only affect their designated spatial zones.

| Region | Z Range | Parameters | Purpose |
|--------|---------|------------|---------|
| **Head** | 4.0 to 12.0 | `headWidth`, `tubercleSize`, `tubercleCount` | Tubercles only affect head |
| **Torso** | -6.0 to 4.0 | `girthAtBlowhole`, `bodyAspectRatio` | Main body girth |
| **Peduncle** | -10.0 to -6.0 | `peduncleTaper` | Tail stalk narrowing |
| **Flukes** | -14.0 to -10.0 | `tailFlukeSpan`, `tailForkDepth`, `tailForkAngle` | Tail geometry |
| **Flippers** | x: 1.5-7.0, z: -5.0-3.0 | `flipperSpan`, `flipperWidth`, `flipperSweepAngle` | Flipper-only changes |

**Why This Matters:**
- Changing `tubercleSize` doesn't affect body girth
- Changing `flipperSpan` doesn't affect tail shape
- Prevents compound side effects
- Enables independent optimization per region

---

## JSON Schema (For AI Systems)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Humpback Whale Parametric Model",
  "type": "object",
  "properties": {
    "bodyLength": {
      "type": "number",
      "minimum": 8,
      "maximum": 16,
      "default": 12.0,
      "description": "Total body length from rostrum to tail notch",
      "affects": ["all proportions"],
      "semanticType": "scalar"
    },
    "girthAtBlowhole": {
      "type": "number",
      "minimum": 1.0,
      "maximum": 3.0,
      "default": 1.8,
      "description": "Maximum body width at widest point",
      "affects": ["body", "flippers", "ventral"],
      "semanticType": "scalar",
      "constraints": [
        {
          "expr": "bodyLength / girthAtBlowhole",
          "min": 6.5,
          "max": 8.0,
          "reason": "Humpback body proportion"
        }
      ]
    },
    "flipperSpan": {
      "type": "number",
      "minimum": 0.30,
      "maximum": 0.33,
      "default": 0.31,
      "description": "Flipper length as ratio of body length - THE defining feature",
      "affects": ["pectoral flippers"],
      "semanticType": "ratio",
      "criticality": "CRITICAL",
      "constraints": [
        {
          "min": 0.30,
          "max": 0.33,
          "reason": "Longest pectoral fins of any cetacean"
        }
      ]
    },
    "tubercleSize": {
      "type": "number",
      "minimum": 0.30,
      "maximum": 0.45,
      "default": 0.35,
      "description": "Tubercle prominence - key identifier",
      "affects": ["head surface"],
      "semanticType": "displacement",
      "criticality": "HIGH"
    }
    // ... (other parameters follow same pattern)
  },
  "required": ["bodyLength", "girthAtBlowhole", "flipperSpan"],
  "dependencies": {
    "flipperWidth": ["flipperSpan"],
    "tailForkDepth": ["tailFlukeSpan"]
  }
}
```

---

## Usage Examples

### Example 1: Increase Body Length (Predictable Monotonic Effect)

```json
{
  "bodyLength": 14.0  // was 12.0
}
```

**Effect:**
- ✅ Body gets proportionally longer
- ✅ Flippers scale proportionally (still 31% of new length)
- ✅ Tail flukes scale proportionally
- ✅ All derived values update automatically
- ❌ No side effects on tubercle size or colors

**Constraint Check:**
- `bodyLength / girthAtBlowhole = 14.0 / 1.8 = 7.78` ✅ (within 6.5-8.0)

---

### Example 2: Make Flippers More Prominent

```json
{
  "flipperSpan": 0.33  // was 0.31 (upper bound of humpback range)
}
```

**Effect:**
- ✅ Flippers extend to 33% of body length (maximum realistic)
- ✅ All 6 flipper segments scale proportionally
- ✅ Tip position updates automatically
- ❌ No effect on body, head, or tail
- ❌ No effect on flipper sweep angle (decoupled parameter)

**Constraint Check:**
- `flipperSpan = 0.33` ✅ (exactly at upper bound - still valid humpback)

---

### Example 3: Adjust Tail Fork Shape

```json
{
  "tailForkDepth": 0.70,  // was 0.55 (deeper center notch)
  "tailForkAngle": 28     // was 22 (more V-shaped)
}
```

**Effect:**
- ✅ Center notch gets deeper
- ✅ Fluke halves angle more dramatically
- ✅ More recognizable humpback tail silhouette
- ❌ No effect on fluke span (separate parameter)
- ❌ No effect on body or flippers

---

### Example 4: Animate Swimming Motion

```json
{
  "tailBeatFrequency": 0.6,  // was 0.4 (50% faster swimming)
  "tailAmplitude": 20        // was 15 (larger tail swing)
}
```

**Effect:**
- ✅ Tail beats faster (time-coupled)
- ✅ Larger tail deflection
- ✅ Phase-coupled: peduncle and torso follow with correct delays
- ❌ No effect on static geometry
- ❌ Animation is optional (can be disabled)

---

## Future Improvements

### Priority 1: Tubercle Lattice System
Replace FBM displacement with parametric bump lattice:
```json
{
  "tubercleCount": 12,
  "tubercleDistribution": "humpback_pattern",  // jaw line + rostrum
  "tubercleSizeVariation": 0.3  // 30% size variation
}
```

### Priority 2: Ventral Groove Generation
Replace hardcoded grooves with procedural system:
```json
{
  "ventralGrooveCount": 8,
  "grooveSpacingVariation": 0.2,
  "grooveDepthVariation": 0.15
}
```

### Priority 3: Scene-Level Parameter UI
Enable live parameter tweaking:
- Sliders for scalar params (with min/max enforcement)
- Color pickers for color3 params
- Real-time constraint validation display
- Violation warnings before commit

### Priority 4: Skeletal Animation Rig
Full skeletal pose control:
- Spine curve (parametric spline)
- Flipper articulation (shoulder, elbow, wrist joints)
- Tail articulation (vertebral column simulation)

---

## Testing Protocol

### Marine Biologist Test
"Would a marine biologist be embarrassed to have this model in educational materials?"

**Checklist:**
- [ ] Flippers reach only 1/3 down body, NOT to tail
- [ ] Body is chunky (7:1-8:1 ratio), NOT torpedo-like
- [ ] Tubercles visible on head
- [ ] Small dorsal fin visible
- [ ] Tail flukes proportional (~33% body), NOT airplane wings
- [ ] Overall silhouette reads as "robust baleen whale"

### Constraint Validation Test
Run after every parameter change:

```javascript
function validateHumpback(params) {
  const failures = [];

  // CRITICAL: Flipper span
  if (params.flipperSpan < 0.30 || params.flipperSpan > 0.33) {
    failures.push({
      severity: "CRITICAL",
      param: "flipperSpan",
      value: params.flipperSpan,
      expected: "0.30-0.33",
      reason: "THE humpback identifier - longest fins of any cetacean"
    });
  }

  // HIGH: Body proportion
  const ratio = params.bodyLength / params.girthAtBlowhole;
  if (ratio < 6.5 || ratio > 8.0) {
    failures.push({
      severity: "HIGH",
      param: "bodyLengthToGirthRatio",
      value: ratio,
      expected: "6.5-8.0",
      reason: "Humpbacks are chunky, barrel-bodied"
    });
  }

  // ... (other checks)

  return failures;
}
```

---

## Version History

### v3.0 (2026-01-02)
- **Complete redesign** with semantic parameters
- **Spatial decoupling** via region gating
- **Comprehensive documentation** with ranges and constraints
- **Skeletal pose rig** for flippers (6-segment articulation)
- **Animation coupling** with phase relationships
- **JSON schema** for AI-assisted workflows

### v2.0 (Previous)
- Basic parametric layer with some semantic params
- Rig layer with derived values
- Still had extensive hardcoded geometry

### v1.0 (Original)
- Fully hardcoded geometry
- No parameters
- Magic numbers throughout

---

## License & Attribution

**Model:** Humpback Whale (Megaptera novaeangliae)
**Created By:** glitchcan-minigam project
**License:** [Project License]
**Reference Data:** Marine biology anatomical proportions

**Design Consultation:**
- Expert feedback on semantic parameter design
- Marine biologist anatomical validation
- SDF/CSG modeling constraints

