import * as THREE from '../vendor/three.module.min.js';
import { createScene } from './ua17-scene.js';
import { buildAircraft } from './ua17-aircraft.js';
import { buildSky, buildSun, updateSky } from './ua17-sky.js';
import { buildTerrain, buildWater, CITY_GROUND_Y } from './ua17-terrain.js';
import { buildClouds } from './ua17-clouds.js';
import { buildLondonSkyline, buildNycSkyline } from './ua17-buildings.js';
import { buildRunway } from './ua17-airport.js';
import { buildOtherFlights } from './ua17-flights.js';
import { createParticles } from './ua17-particles.js';
import { createAudio } from './ua17-audio.js';
import { flightCurve, loadWeather, loadFlightInfo, cloudAt, stageCaption, LONDON_RUNWAY_Z, NYC_RUNWAY_Z, CRUISE_ALT } from './ua17-route.js';

const FLIGHT_DURATION = 100; // seconds for one full LHR -> EWR playthrough

// Speed profile along the journey fraction t: slow on the runway at both ends
// (accelerate from a stop / decelerate to a stop) and quick at cruise. Its
// value is a multiplier on the base rate; it never hits zero mid-flight so
// the plane always keeps rolling, then clamps to a full stop exactly at t=1.
function flightSpeed(t) {
  return 0.32 + 1.15 * Math.sin(Math.PI * THREE.MathUtils.clamp(t, 0, 1));
}

// Real-world figures for the seatback-IFE data panel. LHR 10:25 BST -> EWR
// 13:45 EDT is 8h20 gate-to-gate; great-circle ~3452 mi / 5556 km.
const TOTAL_MIN = 500;
const TOTAL_MI = 3452;
const TOTAL_KM = 5556;
const DEP_LOCAL_MIN = 10 * 60 + 25; // BST clock at the departure gate
const TZ_DIFF_MIN = 5 * 60;         // BST is 5h ahead of EDT
const CRUISE_FT = 38000;            // FL380 at the path's cruise altitude

function fmtHM(totalMin) {
  const m = Math.max(0, Math.round(totalMin));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}
function fmtClock(minsOfDay) {
  const m = ((Math.round(minsOfDay) % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

async function fetchJson(rel) {
  const res = await fetch(new URL(rel, import.meta.url));
  return res.json();
}

function compass(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

async function main() {
  const canvas = document.getElementById('ua17-canvas');
  const { scene, camera, renderer, updateCamera, resumeIdleDriftAfter, setOrbit } = createScene(canvas);
  scene.fog = new THREE.Fog(0xdff2ff, 3200, 9200);

  const [weather, flightInfo, londonData, nycData, flightsSnapshot] = await Promise.all([
    loadWeather(),
    loadFlightInfo(),
    fetchJson('../data/buildings-london.json'),
    fetchJson('../data/buildings-nyc.json'),
    fetchJson('../data/flights-snapshot.json'),
  ]);

  const sky = buildSky();
  scene.add(sky);
  scene.add(buildSun());
  scene.add(buildTerrain());
  const water = buildWater();
  scene.add(water);
  const clouds = buildClouds(weather);
  scene.add(clouds.mesh);
  scene.add(buildLondonSkyline(londonData));
  scene.add(buildNycSkyline(nycData));

  const otherFlights = buildOtherFlights(flightsSnapshot);
  scene.add(otherFlights.group);

  const particles = createParticles(scene);

  // Long runways centred on each ground-roll, aligned to the (straight) path
  // heading there, on the cities' flat coastal land plateau.
  const lhrRunway = buildRunway(LONDON_RUNWAY_Z, 0, 0, 900);
  lhrRunway.position.y = CITY_GROUND_Y + 0.6; // sit just proud of the land plateau
  scene.add(lhrRunway);
  const ewrRunway = buildRunway(NYC_RUNWAY_Z, 0, 0, 900);
  ewrRunway.position.y = CITY_GROUND_Y + 0.6;
  scene.add(ewrRunway);

  const aircraft = buildAircraft();
  scene.add(aircraft);

  const audio = createAudio();

  // --- UI wiring ---
  const startOverlay = document.getElementById('ua17-start');
  const startBtn = document.getElementById('ua17-start-btn');
  const hud = document.getElementById('ua17-hud');
  const caption = document.getElementById('ua17-caption');
  const progressFill = document.getElementById('ua17-progress-fill');
  const progressPlane = document.getElementById('ua17-progress-plane');
  const scrubber = document.getElementById('ua17-scrubber');
  const playPauseBtn = document.getElementById('ua17-playpause');
  const replayBtn = document.getElementById('ua17-replay');
  const routeLabel = document.getElementById('ua17-route-label');
  const hint = document.getElementById('ua17-hint');
  const flightInfoEl = document.getElementById('ua17-flightinfo');
  // Seatback data-panel elements.
  const ttdEl = document.getElementById('ua17-ttd');
  const dtdEl = document.getElementById('ua17-dtd');
  const altEl = document.getElementById('ua17-alt');
  const gsEl = document.getElementById('ua17-gs');
  const tempEl = document.getElementById('ua17-temp');
  const distEl = document.getElementById('ua17-dist');
  const clockOEl = document.getElementById('ua17-clock-o');
  const clockDEl = document.getElementById('ua17-clock-d');

  routeLabel.textContent = `${flightInfo.departure.iata} → ${flightInfo.arrival.iata}`;

  const state = { t: 0, playing: false, started: false, scrubbing: false };
  // Headless-playtest hook, matching the trees/tanks-for-the-trees.html
  // convention of exposing a window.__<name> debug surface. screenPosFor()
  // projects an other-flights instance to CSS pixel coords for tap testing.
  window.__ua17 = {
    state,
    jumpTo: (t) => { state.t = THREE.MathUtils.clamp(t, 0, 1); },
    setOrbit,
    activeParticles: () => particles.group.children.filter((c) => c.visible).length,
    poppedClusters: () => clouds.clusters.filter((c) => c.popped).length,
    screenPosFor: (instanceId) => {
      const f = otherFlights.flightsByInstance[instanceId];
      if (!f) return null;
      const v = f.pos.clone().project(camera);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + (v.x * 0.5 + 0.5) * rect.width, y: rect.top + (-v.y * 0.5 + 0.5) * rect.height, behindCamera: v.z > 1 };
    },
  };

  function setPlaying(playing) {
    state.playing = playing;
    playPauseBtn.textContent = playing ? '⏸' : '▶️';
    playPauseBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  startBtn.addEventListener('click', () => {
    audio.unlock();
    audio.chime(660);
    startOverlay.classList.add('ua17-hidden');
    hud.classList.remove('ua17-hidden');
    hint.classList.remove('ua17-hidden');
    state.started = true;
    setPlaying(true);
    resumeIdleDriftAfter(2);
  });

  playPauseBtn.addEventListener('click', () => setPlaying(!state.playing));

  replayBtn.addEventListener('click', () => {
    state.t = 0;
    replayBtn.classList.add('ua17-hidden');
    // Restore any clouds we popped last time round so there's something to
    // fly through again.
    for (const cluster of clouds.clusters) {
      if (cluster.popped) { cluster.popped = false; cluster.dissolve = 1; clouds.setClusterScale(cluster, 1); }
    }
    setPlaying(true);
    audio.chime(880);
  });

  // Adjustable progress: dragging the scrubber jumps the flight to that
  // point and pauses autoplay (like scrubbing a video) until Play is tapped.
  scrubber.addEventListener('pointerdown', () => { state.scrubbing = true; setPlaying(false); });
  scrubber.addEventListener('input', () => {
    state.t = Number(scrubber.value) / 1000;
    if (state.t < 1) replayBtn.classList.add('ua17-hidden');
  });
  ['pointerup', 'pointercancel'].forEach((ev) => scrubber.addEventListener(ev, () => { state.scrubbing = false; }));

  // Prevent any stray drag on the UI chrome itself from scrolling the page —
  // except the scrubber, which needs its own touchmove to actually drag.
  document.body.addEventListener('touchmove', (e) => {
    if (e.target.closest('#ua17-scrubber')) return;
    e.preventDefault();
  }, { passive: false });

  // Tap-to-inspect: raycast against the other-flights InstancedMesh on a
  // clean tap (not a drag) to show that flight's real altitude/heading/callsign.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downPos = null;
  let infoTimer = null;
  canvas.addEventListener('pointerdown', (e) => { downPos = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downPos) return;
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    downPos = null;
    if (moved > 8) return; // was a drag, not a tap
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(otherFlights.sprites, false);
    if (!hits.length) return;
    const f = hits[0].object.userData.info;
    if (!f) return;
    const altFt = Math.round(f.altitude_m * 3.281 / 100) * 100;
    flightInfoEl.innerHTML = `<strong>${f.callsign || 'Unknown flight'}</strong><br>${altFt.toLocaleString()} ft · heading ${compass(f.heading)}`;
    flightInfoEl.classList.remove('ua17-hidden');
    audio.chime(520);
    clearTimeout(infoTimer);
    infoTimer = setTimeout(() => flightInfoEl.classList.add('ua17-hidden'), 4000);
  });

  // --- Animation loop ---
  const clock = new THREE.Clock();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const basisMat = new THREE.Matrix4();
  const targetQuat = new THREE.Quaternion();
  const bankQuat = new THREE.Quaternion();
  const localZ = new THREE.Vector3(0, 0, 1);
  let lastCaption = '';

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta());

    if (state.started && state.playing && !state.scrubbing) {
      state.t = Math.min(1, state.t + (dt / FLIGHT_DURATION) * flightSpeed(state.t));
      if (state.t >= 1 && state.playing) {
        setPlaying(false);
        replayBtn.classList.remove('ua17-hidden');
        audio.chime(990);
      }
    }

    const t = state.t;
    updateAircraftPose(t, dt);
    updateClouds(dt);
    particles.update(dt);
    updateFlightData(t, dt);

    const cloud = cloudAt(weather, t);
    updateSky(sky, scene.fog, cloud.total);
    water.material.uniforms.time.value = clock.elapsedTime * 0.6;
    audio.setEngineIntensity(t);

    const newCaption = stageCaption(t);
    if (newCaption !== lastCaption) {
      caption.textContent = newCaption;
      lastCaption = newCaption;
    }
    progressFill.style.width = `${t * 100}%`;
    progressPlane.style.left = `${t * 100}%`;
    if (!state.scrubbing) scrubber.value = String(Math.round(t * 1000));

    renderer.render(scene, camera);
  }

  function updateAircraftPose(t, dt) {
    const pos = flightCurve.getPointAt(t);
    aircraft.position.copy(pos);

    forward.copy(flightCurve.getTangentAt(t)).normalize();
    right.crossVectors(worldUp, forward).normalize();
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    up.crossVectors(forward, right).normalize();
    basisMat.makeBasis(right, up, forward);
    targetQuat.setFromRotationMatrix(basisMat);

    // Very gentle bank into turns — the path is nearly straight, and heavy
    // banking read as "lurching". Keep it subtle and smoothed.
    const t2 = THREE.MathUtils.clamp(t + 0.004, 0, 1);
    const forward2 = flightCurve.getTangentAt(t2).normalize();
    const turn = right.dot(forward2.clone().sub(forward));
    const targetBank = THREE.MathUtils.clamp(-turn * 16, -0.14, 0.14);
    bankQuat.setFromAxisAngle(localZ, targetBank);
    targetQuat.multiply(bankQuat);

    aircraft.quaternion.slerp(targetQuat, 0.05);

    // Gear down near the ground (taxi/climb-out and final approach/touchdown),
    // gear up once safely climbed away — both ends get a "real airport" feel.
    aircraft.userData.landingGear.visible = pos.y < 70;
    aircraft.userData.beacon.visible = Math.floor(clock.elapsedTime * 2) % 2 === 0;

    updateCamera(pos, forward, dt);
  }

  // Live seatback flight-data readout, derived from the plane's state and the
  // real schedule/distance. Throttled to a few updates a second (it's data,
  // it doesn't need to tick every frame) and formatted like FlightPath 3D.
  let dataAccum = 1;
  function updateFlightData(t, dt) {
    dataAccum += dt;
    if (dataAccum < 0.2) return;
    dataAccum = 0;
    const rem = 1 - t;
    const remMi = Math.round(TOTAL_MI * rem);
    const remKm = Math.round(TOTAL_KM * rem);
    ttdEl.textContent = fmtHM(TOTAL_MIN * rem);
    dtdEl.textContent = `· ${remMi.toLocaleString()} mi`;

    const altFt = Math.max(0, Math.round((aircraft.position.y / CRUISE_ALT) * CRUISE_FT / 100) * 100);
    altEl.textContent = altFt.toLocaleString();

    let gs = Math.round(flightSpeed(t) * 380); // ~560 mph at cruise, less on the roll
    if (t <= 0.002 || t >= 0.999) gs = 0;      // stopped on the runway
    gsEl.textContent = gs;

    const c = Math.max(-60, Math.round(15 - 6.5 * (altFt / 3281))); // ISA lapse from altitude
    tempEl.textContent = `${c}°C`;

    distEl.textContent = `${remMi.toLocaleString()} mi · ${remKm.toLocaleString()} km`;
    const originMin = DEP_LOCAL_MIN + t * TOTAL_MIN;
    clockOEl.textContent = fmtClock(originMin);
    clockDEl.textContent = fmtClock(originMin - TZ_DIFF_MIN);
  }

  // Pop any cloud cluster the plane flies into: spawn a glittering burst and
  // shrink that cluster's puffs away over a fraction of a second.
  const planePos = new THREE.Vector3();
  function updateClouds(dt) {
    planePos.copy(aircraft.position);
    for (const cluster of clouds.clusters) {
      if (cluster.popped) {
        if (cluster.dissolve > 0) {
          cluster.dissolve = Math.max(0, cluster.dissolve - dt * 4);
          clouds.setClusterScale(cluster, cluster.dissolve);
        }
        continue;
      }
      if (planePos.distanceTo(cluster.center) < cluster.radius + 14) {
        cluster.popped = true;
        particles.burst(cluster.center, cluster.gate ? 1.15 : 0.9);
        audio.chime(cluster.gate ? 784 : 660);
      }
    }
  }

  tick();

  // Register right away rather than waiting for window's 'load' event: by
  // this point we're already well past initial page load (we just awaited
  // several data fetches), so that event may have already fired — a
  // listener added after the fact would silently never run, and the app
  // would never actually become offline-capable.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  const loading = document.getElementById('ua17-start');
  if (loading) loading.innerHTML = `<p style="color:#fff;padding:2rem;text-align:center">Couldn't load the flight 😕<br><small>${err.message}</small></p>`;
});
