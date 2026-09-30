// ---------- the city's pipeline without the rooms ----------
// propsFx lights people with the room's lamps when they stand in a venue; that happens only in the rooms' pipelines
// (rooms.wgsl). These stand-ins let the city's module compile without the rooms' code.
fn roomK() -> i32 { return 0; }
fn rmLit(q: vec3f, n: vec3f, k: i32, occ: f32, shadowed: bool) -> vec3f { return vec3f(0.0); }
fn rmLight(k: i32, i: i32) -> array<vec3f, 2> { return array<vec3f, 2>(vec3f(0.0), vec3f(0.0)); }
