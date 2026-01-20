////////////////////////////////////////////////////////////////
//
//                           HG_SDF
//
//     WGSL PORT OF GLSL LIBRARY FOR BUILDING SIGNED DISTANCE BOUNDS
//
//     Original version 2016-01-04 by MERCURY http://mercury.sexy
//     WGSL port 2026-01 for WebGPU
//
//     Check http://mercury.sexy/hg_sdf for updates
//
//     Original released as MIT OR CC-BY-NC-4.0 (dual license, 2021-07-28)
//
////////////////////////////////////////////////////////////////

// Constants
const PI: f32 = 3.14159265;
const TAU: f32 = 6.28318530;
const PHI: f32 = 1.61803398;  // (sqrt(5)*0.5 + 0.5)

// Clamp to [0,1]
fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

// Sign function that doesn't return 0
fn sgn(x: f32) -> f32 {
    return select(-1.0, 1.0, x >= 0.0);
}

fn sgn2(v: vec2f) -> vec2f {
    return vec2f(sgn(v.x), sgn(v.y));
}

fn square_f(x: f32) -> f32 {
    return x * x;
}

fn square2(v: vec2f) -> vec2f {
    return v * v;
}

fn square3(v: vec3f) -> vec3f {
    return v * v;
}

fn lengthSqr(x: vec3f) -> f32 {
    return dot(x, x);
}

// Maximum/minimum elements of a vector
fn vmax2(v: vec2f) -> f32 {
    return max(v.x, v.y);
}

fn vmax3(v: vec3f) -> f32 {
    return max(max(v.x, v.y), v.z);
}

fn vmax4(v: vec4f) -> f32 {
    return max(max(v.x, v.y), max(v.z, v.w));
}

fn vmin2(v: vec2f) -> f32 {
    return min(v.x, v.y);
}

fn vmin3(v: vec3f) -> f32 {
    return min(min(v.x, v.y), v.z);
}

fn vmin4(v: vec4f) -> f32 {
    return min(min(v.x, v.y), min(v.z, v.w));
}

////////////////////////////////////////////////////////////////
//
//             PRIMITIVE DISTANCE FUNCTIONS
//
////////////////////////////////////////////////////////////////

fn fSphere(p: vec3f, r: f32) -> f32 {
    return length(p) - r;
}

// Plane with normal n (n is normalized) at some distance from the origin
fn fPlane(p: vec3f, n: vec3f, distanceFromOrigin: f32) -> f32 {
    return dot(p, n) + distanceFromOrigin;
}

// Cheap Box: distance to corners is overestimated
fn fBoxCheap(p: vec3f, b: vec3f) -> f32 {
    return vmax3(abs(p) - b);
}

// Box: correct distance to corners
fn fBox(p: vec3f, b: vec3f) -> f32 {
    let d = abs(p) - b;
    return length(max(d, vec3f(0.0))) + vmax3(min(d, vec3f(0.0)));
}

// 2D box
fn fBox2Cheap(p: vec2f, b: vec2f) -> f32 {
    return vmax2(abs(p) - b);
}

fn fBox2(p: vec2f, b: vec2f) -> f32 {
    let d = abs(p) - b;
    return length(max(d, vec2f(0.0))) + vmax2(min(d, vec2f(0.0)));
}

// Endless "corner"
fn fCorner(p: vec2f) -> f32 {
    return length(max(p, vec2f(0.0))) + vmax2(min(p, vec2f(0.0)));
}

// Cylinder standing upright on the xz plane
fn fCylinder(p: vec3f, r: f32, height: f32) -> f32 {
    var d = length(p.xz) - r;
    d = max(d, abs(p.y) - height);
    return d;
}

// Capsule: A Cylinder with round caps on both sides
fn fCapsule(p: vec3f, r: f32, c: f32) -> f32 {
    return mix(length(p.xz) - r, length(vec3f(p.x, abs(p.y) - c, p.z)) - r, step(c, abs(p.y)));
}

// Distance to line segment between <a> and <b>
fn fLineSegment(p: vec3f, a: vec3f, b: vec3f) -> f32 {
    let ab = b - a;
    let t = saturate(dot(p - a, ab) / dot(ab, ab));
    return length((ab * t + a) - p);
}

// Capsule version 2: between two end points <a> and <b> with radius r
fn fCapsule2(p: vec3f, a: vec3f, b: vec3f, r: f32) -> f32 {
    return fLineSegment(p, a, b) - r;
}

// Torus in the XZ-plane
fn fTorus(p: vec3f, smallRadius: f32, largeRadius: f32) -> f32 {
    return length(vec2f(length(p.xz) - largeRadius, p.y)) - smallRadius;
}

// A circle line
fn fCircle(p: vec3f, r: f32) -> f32 {
    let l = length(p.xz) - r;
    return length(vec2f(p.y, l));
}

// A circular disc with no thickness
fn fDisc(p: vec3f, r: f32) -> f32 {
    let l = length(p.xz) - r;
    return select(length(vec2f(p.y, l)), abs(p.y), l < 0.0);
}

// Hexagonal prism, circumcircle variant
fn fHexagonCircumcircle(p: vec3f, h: vec2f) -> f32 {
    let q = abs(p);
    return max(q.y - h.y, max(q.x * sqrt(3.0) * 0.5 + q.z * 0.5, q.z) - h.x);
}

// Hexagonal prism, incircle variant
fn fHexagonIncircle(p: vec3f, h: vec2f) -> f32 {
    return fHexagonCircumcircle(p, vec2f(h.x * sqrt(3.0) * 0.5, h.y));
}

// Cone with correct distances to tip and base circle
fn fCone(p: vec3f, radius: f32, height: f32) -> f32 {
    let q = vec2f(length(p.xz), p.y);
    let tip = q - vec2f(0.0, height);
    let mantleDir = normalize(vec2f(height, radius));
    let mantle = dot(tip, mantleDir);
    var d = max(mantle, -q.y);
    let projected = dot(tip, vec2f(mantleDir.y, -mantleDir.x));

    // distance to tip
    if (q.y > height && projected < 0.0) {
        d = max(d, length(tip));
    }

    // distance to base ring
    if (q.x > radius && projected > length(vec2f(height, radius))) {
        d = max(d, length(q - vec2f(radius, 0.0)));
    }
    return d;
}

////////////////////////////////////////////////////////////////
//
//             GDF VECTORS (Generalized Distance Functions)
//
////////////////////////////////////////////////////////////////

// These would be in a constant array, but WGSL has limitations
// Use functions instead

fn getGDFVector(i: i32) -> vec3f {
    switch (i) {
        case 0: { return normalize(vec3f(1.0, 0.0, 0.0)); }
        case 1: { return normalize(vec3f(0.0, 1.0, 0.0)); }
        case 2: { return normalize(vec3f(0.0, 0.0, 1.0)); }
        case 3: { return normalize(vec3f(1.0, 1.0, 1.0)); }
        case 4: { return normalize(vec3f(-1.0, 1.0, 1.0)); }
        case 5: { return normalize(vec3f(1.0, -1.0, 1.0)); }
        case 6: { return normalize(vec3f(1.0, 1.0, -1.0)); }
        case 7: { return normalize(vec3f(0.0, 1.0, PHI + 1.0)); }
        case 8: { return normalize(vec3f(0.0, -1.0, PHI + 1.0)); }
        case 9: { return normalize(vec3f(PHI + 1.0, 0.0, 1.0)); }
        case 10: { return normalize(vec3f(-PHI - 1.0, 0.0, 1.0)); }
        case 11: { return normalize(vec3f(1.0, PHI + 1.0, 0.0)); }
        case 12: { return normalize(vec3f(-1.0, PHI + 1.0, 0.0)); }
        case 13: { return normalize(vec3f(0.0, PHI, 1.0)); }
        case 14: { return normalize(vec3f(0.0, -PHI, 1.0)); }
        case 15: { return normalize(vec3f(1.0, 0.0, PHI)); }
        case 16: { return normalize(vec3f(-1.0, 0.0, PHI)); }
        case 17: { return normalize(vec3f(PHI, 1.0, 0.0)); }
        case 18: { return normalize(vec3f(-PHI, 1.0, 0.0)); }
        default: { return vec3f(0.0); }
    }
}

// GDF with exponent (bulging objects)
fn fGDF(p: vec3f, r: f32, e: f32, begin: i32, end: i32) -> f32 {
    var d = 0.0;
    for (var i = begin; i <= end; i++) {
        d += pow(abs(dot(p, getGDFVector(i))), e);
    }
    return pow(d, 1.0 / e) - r;
}

// GDF without exponent (sharp edges)
fn fGDFSharp(p: vec3f, r: f32, begin: i32, end: i32) -> f32 {
    var d = 0.0;
    for (var i = begin; i <= end; i++) {
        d = max(d, abs(dot(p, getGDFVector(i))));
    }
    return d - r;
}

// Polyhedra primitives
fn fOctahedron(p: vec3f, r: f32, e: f32) -> f32 {
    return fGDF(p, r, e, 3, 6);
}

fn fDodecahedron(p: vec3f, r: f32, e: f32) -> f32 {
    return fGDF(p, r, e, 13, 18);
}

fn fIcosahedron(p: vec3f, r: f32, e: f32) -> f32 {
    return fGDF(p, r, e, 3, 12);
}

fn fTruncatedOctahedron(p: vec3f, r: f32, e: f32) -> f32 {
    return fGDF(p, r, e, 0, 6);
}

fn fTruncatedIcosahedron(p: vec3f, r: f32, e: f32) -> f32 {
    return fGDF(p, r, e, 3, 18);
}

fn fOctahedronSharp(p: vec3f, r: f32) -> f32 {
    return fGDFSharp(p, r, 3, 6);
}

fn fDodecahedronSharp(p: vec3f, r: f32) -> f32 {
    return fGDFSharp(p, r, 13, 18);
}

fn fIcosahedronSharp(p: vec3f, r: f32) -> f32 {
    return fGDFSharp(p, r, 3, 12);
}

fn fTruncatedOctahedronSharp(p: vec3f, r: f32) -> f32 {
    return fGDFSharp(p, r, 0, 6);
}

fn fTruncatedIcosahedronSharp(p: vec3f, r: f32) -> f32 {
    return fGDFSharp(p, r, 3, 18);
}

////////////////////////////////////////////////////////////////
//
//                DOMAIN MANIPULATION OPERATORS
//
////////////////////////////////////////////////////////////////

// Rotate around a coordinate axis
fn pR(p: vec2f, a: f32) -> vec2f {
    return cos(a) * p + sin(a) * vec2f(p.y, -p.x);
}

// Shortcut for 45-degrees rotation
fn pR45(p: vec2f) -> vec2f {
    return (p + vec2f(p.y, -p.x)) * sqrt(0.5);
}

// Repeat space along one axis
fn pMod1(p: f32, size: f32) -> vec2f {
    let halfsize = size * 0.5;
    let c = floor((p + halfsize) / size);
    let newP = ((p + halfsize) % size) - halfsize;
    return vec2f(newP, c);
}

// Same, but mirror every second cell
fn pModMirror1(p: f32, size: f32) -> vec2f {
    let halfsize = size * 0.5;
    let c = floor((p + halfsize) / size);
    var newP = ((p + halfsize) % size) - halfsize;
    newP *= (c % 2.0) * 2.0 - 1.0;
    return vec2f(newP, c);
}

// Repeat the domain only in positive direction
fn pModSingle1(p: f32, size: f32) -> vec2f {
    let halfsize = size * 0.5;
    let c = floor((p + halfsize) / size);
    var newP = p;
    if (p >= 0.0) {
        newP = ((p + halfsize) % size) - halfsize;
    }
    return vec2f(newP, c);
}

// Repeat around the origin by a fixed angle
fn pModPolar(p: vec2f, repetitions: f32) -> vec3f {
    let angle = TAU / repetitions;
    var a = atan2(p.y, p.x) + angle / 2.0;
    let r = length(p);
    var c = floor(a / angle);
    a = (a % angle) - angle / 2.0;
    let newP = vec2f(cos(a), sin(a)) * r;
    if (abs(c) >= (repetitions / 2.0)) {
        c = abs(c);
    }
    return vec3f(newP, c);
}

// Repeat in two dimensions
fn pMod2(p: vec2f, size: vec2f) -> vec4f {
    let c = floor((p + size * 0.5) / size);
    let newP = ((p + size * 0.5) % size) - size * 0.5;
    return vec4f(newP, c);
}

// Repeat in three dimensions
fn pMod3(p: vec3f, size: vec3f) -> vec3f {
    let c = floor((p + size * 0.5) / size);
    return ((p + size * 0.5) % size) - size * 0.5;
}

// Mirror at an axis-aligned plane
fn pMirror(p: f32, dist: f32) -> vec2f {
    let s = sgn(p);
    return vec2f(abs(p) - dist, s);
}

// Reflect space at a plane
fn pReflect(p: vec3f, planeNormal: vec3f, offset: f32) -> vec4f {
    let t = dot(p, planeNormal) + offset;
    var newP = p;
    if (t < 0.0) {
        newP = p - (2.0 * t) * planeNormal;
    }
    return vec4f(newP, sgn(t));
}

////////////////////////////////////////////////////////////////
//
//             OBJECT COMBINATION OPERATORS
//
////////////////////////////////////////////////////////////////

// Chamfer flavour (45-degree chamfered edge)
fn fOpUnionChamfer(a: f32, b: f32, r: f32) -> f32 {
    return min(min(a, b), (a - r + b) * sqrt(0.5));
}

fn fOpIntersectionChamfer(a: f32, b: f32, r: f32) -> f32 {
    return max(max(a, b), (a + r + b) * sqrt(0.5));
}

fn fOpDifferenceChamfer(a: f32, b: f32, r: f32) -> f32 {
    return fOpIntersectionChamfer(a, -b, r);
}

// Round variant (quarter-circle join)
fn fOpUnionRound(a: f32, b: f32, r: f32) -> f32 {
    let u = max(vec2f(r - a, r - b), vec2f(0.0));
    return max(r, min(a, b)) - length(u);
}

fn fOpIntersectionRound(a: f32, b: f32, r: f32) -> f32 {
    let u = max(vec2f(r + a, r + b), vec2f(0.0));
    return min(-r, max(a, b)) + length(u);
}

fn fOpDifferenceRound(a: f32, b: f32, r: f32) -> f32 {
    return fOpIntersectionRound(a, -b, r);
}

// Stairs flavour (n-1 steps)
fn fOpUnionStairs(a: f32, b: f32, r: f32, n: f32) -> f32 {
    let s = r / n;
    let u = b - r;
    return min(min(a, b), 0.5 * (u + a + abs(((u - a + s) % (2.0 * s)) - s)));
}

fn fOpIntersectionStairs(a: f32, b: f32, r: f32, n: f32) -> f32 {
    return -fOpUnionStairs(-a, -b, r, n);
}

fn fOpDifferenceStairs(a: f32, b: f32, r: f32, n: f32) -> f32 {
    return -fOpUnionStairs(-a, b, r, n);
}

// Soft union by MediaMolecule
fn fOpUnionSoft(a: f32, b: f32, r: f32) -> f32 {
    let e = max(r - abs(a - b), 0.0);
    return min(a, b) - e * e * 0.25 / r;
}

// Cylindrical pipe along intersection
fn fOpPipe(a: f32, b: f32, r: f32) -> f32 {
    return length(vec2f(a, b)) - r;
}

// V-shaped engraving
fn fOpEngrave(a: f32, b: f32, r: f32) -> f32 {
    return max(a, (a + r - abs(b)) * sqrt(0.5));
}

// Groove cut out
fn fOpGroove(a: f32, b: f32, ra: f32, rb: f32) -> f32 {
    return max(a, min(a + ra, rb - abs(b)));
}

// Tongue attached
fn fOpTongue(a: f32, b: f32, ra: f32, rb: f32) -> f32 {
    return min(a, max(a - ra, abs(b) - rb));
}
