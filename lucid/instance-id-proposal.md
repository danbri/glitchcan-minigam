# Instance ID Proposal for Lucid SDF-CSG

## Problem Statement

When using domain repetition (`repeat` node), all instances are identical. Real-world scenes need per-instance variation: different sizes, colors, rotations, or positions. Currently there's no way to distinguish instance 0 from instance 47.

## Proposed Solution: Expose Instance ID

Add an optional `exposeId` field to the `repeat` node that makes the instance ID available as a variable to child expressions.

### JSON Schema Addition

```json
{
  "type": "repeat",
  "period": [2.0, 2.0, 2.0],
  "exposeId": "instanceId",
  "child": {
    "type": "sphere",
    "params": {
      "r": { "expr": "add", "args": [0.3, { "expr": "mul", "args": [
        { "expr": "hash", "args": [{ "var": "instanceId" }] },
        0.2
      ]}]}
    }
  }
}
```

### GLSL Codegen Changes

1. **Calculate instance ID in repeat**: Before domain folding, compute `vec3 id = floor(p / period)`
2. **Pack to float**: Convert 3D id to scalar via `dot(id, vec3(1.0, 157.0, 113.0))` for hashing
3. **Inject as variable**: Child nodes can reference via `var` expression

```glsl
// Generated code for repeat with exposeId
vec3 repeatId = floor(p / vec3(2.0, 2.0, 2.0));
float instanceId = dot(repeatId, vec3(1.0, 157.0, 113.0));
vec3 q = mod(p + period * 0.5, period) - period * 0.5;
// Child SDF can now use instanceId variable
```

### New Expression: `hash`

Add deterministic hash function for randomization:

```javascript
case 'hash': return `fract(sin(${args[0]} * 12.9898) * 43758.5453)`;
```

### Usage Examples

**Varied sphere sizes:**
```json
{ "expr": "add", "args": [0.3, { "expr": "mul", "args": [
  { "expr": "hash", "args": [{ "var": "id" }] }, 0.2
]}]}
```

**Random Y offset (floating/bobbing):**
```json
{ "expr": "mul", "args": [
  { "expr": "sub", "args": [{ "expr": "hash", "args": [{ "var": "id" }] }, 0.5] },
  0.5
]}
```

**Random rotation per instance:**
```json
"rotate": [0, { "expr": "mul", "args": [{ "expr": "hash", "args": [{ "var": "id" }] }, 360] }, 0]
```

## Implementation Steps

1. Add `exposeId` field to repeat node schema
2. In `generateRepeat()`, emit ID calculation before domain fold
3. Pass variable name to child codegen context
4. Add `hash` expression operator
5. Update snowman scene to use varied snowflakes

## Scope & Limitations

- **Single repeat level**: Nested repeats would need distinct variable names
- **3D ID flattening**: Hash quality depends on prime multipliers chosen
- **No limited repetition yet**: Still infinite; `clamp` node is separate feature

## Example: Varied Snowflakes

```json
{
  "type": "repeat",
  "period": [1.2, 2.0, 1.2],
  "exposeId": "flakeId",
  "child": {
    "type": "sphere",
    "params": {
      "r": { "expr": "add", "args": [0.02, { "expr": "mul", "args": [
        { "expr": "hash", "args": [{ "var": "flakeId" }] }, 0.02
      ]}]}
    },
    "transform": {
      "translate": [
        { "expr": "mul", "args": [{ "expr": "sub", "args": [
          { "expr": "hash", "args": [{ "expr": "add", "args": [{ "var": "flakeId" }, 100] }] }, 0.5
        ]}, 0.3] },
        { "expr": "sub", "args": [2.0, { "expr": "mod", "args": [
          { "expr": "add", "args": [
            { "expr": "mul", "args": [{ "var": "time" }, 0.5] },
            { "expr": "hash", "args": [{ "var": "flakeId" }] }
          ]}, 2.5
        ]}]},
        0
      ]
    }
  }
}
```

This gives each snowflake a unique size, horizontal offset, and fall timing.

---

*Estimated effort: 2-3 hours implementation + testing*
