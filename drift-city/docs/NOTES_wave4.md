# Wave 4 progress (interrupt-safe log)
Published baseline: *.w4pub.* and city.w4pub.html (fixed planet, free flight, grid fix). Artifact LHfDxmXQ9zNEDDTydbR6xT.
Rebuild: python3 assemble.py -> /mnt/user-data/outputs/city.html; publish with Artifact tool (same url/title/favicon).

Plan
1. Mid-altitude layer in space.wgsl: same global function (geoField + 3D noise dry/elev) -> biome albedo, liquid, relief normals, when alt < ~200 km. Test with /tmp/sprender.py views (8, 30, 100 km).
2. Saturn system: moon destinations (Enceladus plumes/stripes, Iapetus two-tone, Hyperion sponge, Mimas Herschel), ring-particle field near ring plane, Saturn cloud-top descent.

Status
- [x] step 1: published. space.wgsl nearSurf/geoFieldS/biomeS (mirrors world.js), low haze 0.07/km scale 2 km, bBlur by distance. Backup *.w4s1.*. Test views: node /tmp/spviews2.js; python3 /tmp/sprender.py W H names
- [x] step 2a moons: published. craters(), moonSurf(), plumes(), Hyperion ellipsoid; DESTS space:3 moon idx; moonViewPos (Iapetus square to motion); NAV.space.kind 3 focus moon; neutral sunlight far from Titan. Backup *.w4s2a.*. Test: node /tmp/spmoons.js; sprender moon0..6
- [x] step 2b rings: published. ringParticles() DDA in 28 m slab, cells 3 m; SP.ringLoc at float 156 (metres in 100 km tile, height m, flag); kind 4 camera (r,a,h,yaw,pitch); RING_VIEW r 105000 a 3.4 h 0.02. Backup *.w4s2b.*. Test: node /tmp/springs.js
- [x] step 2c cloud tops: published. satShade near-range turbulence, Saturn haze shell 1500 km, rFoot ringlet filtering; kind 5 camera (lat, lon, alt, yaw, pitch), cloudView(); DESTS 'clouds'. Backup *.w4s2c.*. Test: node /tmp/spclouds.js
Next ideas: storm ovals and hexagon close-up; descent below 150 km; fallback space views; moon trees none.
