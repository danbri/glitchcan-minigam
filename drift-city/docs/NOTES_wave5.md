# Wave 5: city realism (interrupt-safe log)
Baseline: *.w5pre.* (= published wave 4). Rebuild: python3 assemble.py; publish Artifact LHfDxmXQ9zNEDDTydbR6xT.
Plan: 1 sealed traffic tubes, 2 manta/jellyfish flocks (JS boids -> uniform -> scene shader), 3 organic flora, 4 rivers, 5 landmarks (domed hall, open-pit mine, tube portals).
Status:
- [x] 1+2 published: tubesFx (near-ground ray stretch, city lanes, portals at junctions), flockFx + mantaSDF (binding 21 Flock {n, g[4] bounds, a[192]}), JS boids stepFlock in main.js (96, 4 flocks grouped). Scene cost +10% on lavapipe (652 vs 590 ms). Backup *.w5s2.*. Harness: FLOCK=x,y,z,hx,hz env.
- [x] 3 flora published: jellyfish trees (sp1), glow stalks (sp3), bent palms, muted leaf palette, sparse night glow. Backup *.w5s3.*
- [x] 4 rivers published: rvAt field (6000/1500 noise, gradient-normalised width 55 m), carve 5 m, liquid only lowlands H<40 not desert. Backup *.w5s4.*
- [ ] 5 landmarks WIP (NOT published), in *.w5s5wip.*: Assembly Hall on giant cell (3,92) (hallSDF, materials 60/61, hallAt/isHall, cleared 6x6 cells), open-pit mine at abs (-8600,-1500) r 900 depth 190 in 12 m benches; fog clamp below datum (tA) in fogApply.
  Problems: hall not visible in harness views from (428,170,-500) yaw -0.64 (check giant tracer range, proxies vsGiant, cells typ 6); mine interior renders purple (not fog; check far-field/ground shading for H<0, W).
  Working copies reverted to *.w5s4.* so outputs match the published build.
- [x] 5 Assembly Hall published (cell (3,-4); wrapN range is -48..47). Mine removed: ground below datum renders as liquid somewhere in shading (unfound). Fog clamp below datum kept. Backup *.w5s5.*
- [ ] 6 Tales: 50 room-scale locations + Ink (inkjs compiled at build, runtime inlined), tags place/time/weather/fly
- [ ] 7 Story props + rewrite (in progress): props uniform binding 22 (Props {n, a[64]}: pos+kind, yaw/scale/tint/param), propsFx in scene; tags "# prop: kind @ bearing @ dist @ facing @ tint @ param"; hotspot items as kind 8. Backup *.w12pre.*
