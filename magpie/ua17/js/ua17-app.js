import * as THREE from '../vendor/three.module.min.js';
import { createScene } from './ua17-scene.js';
import { buildAircraft } from './ua17-aircraft.js';
import { buildSky, buildSun, buildOcean, updateSky } from './ua17-sky.js';
import { buildClouds } from './ua17-clouds.js';
import { buildLondonSkyline, buildNycSkyline } from './ua17-buildings.js';
import { buildOtherFlights } from './ua17-flights.js';
import { createAudio } from './ua17-audio.js';
import { flightCurve, loadWeather, loadFlightInfo, cloudAt, stageCaption } from './ua17-route.js';

const FLIGHT_DURATION = 95; // seconds for one full LHR -> EWR playthrough

async function fetchJson(rel) {
  const res = await fetch(new URL(rel, import.meta.url));
  return res.json();
}

async function main() {
  const canvas = document.getElementById('ua17-canvas');
  const { scene, camera, renderer, updateCamera, resumeIdleDriftAfter } = createScene(canvas);
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
  scene.add(buildOcean());
  scene.add(buildClouds(weather));
  scene.add(buildLondonSkyline(londonData));
  scene.add(buildNycSkyline(nycData));
  scene.add(buildOtherFlights(flightsSnapshot));

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
  const playPauseBtn = document.getElementById('ua17-playpause');
  const replayBtn = document.getElementById('ua17-replay');
  const routeLabel = document.getElementById('ua17-route-label');
  const hint = document.getElementById('ua17-hint');

  routeLabel.textContent = `${flightInfo.flightNumber} · ${flightInfo.departure.iata} → ${flightInfo.arrival.iata}`;

  const state = { t: 0, playing: false, started: false };
  // Headless-playtest hook, matching the trees/tanks-for-the-trees.html
  // convention of exposing a window.__<name> debug surface.
  window.__ua17 = { state, jumpTo: (t) => { state.t = THREE.MathUtils.clamp(t, 0, 1); } };

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
    setPlaying(true);
    audio.chime(880);
  });

  // Prevent any stray drag on the UI chrome itself from scrolling the page.
  document.body.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

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

    if (state.started && state.playing) {
      state.t = Math.min(1, state.t + dt / FLIGHT_DURATION);
      if (state.t >= 1 && state.playing) {
        setPlaying(false);
        replayBtn.classList.remove('ua17-hidden');
        audio.chime(990);
      }
    }

    const t = state.t;
    updateAircraftPoseWithDt(t, dt);

    const cloud = cloudAt(weather, t);
    updateSky(sky, scene.fog, cloud.total);
    audio.setEngineIntensity(t);

    const newCaption = stageCaption(t);
    if (newCaption !== lastCaption) {
      caption.textContent = newCaption;
      lastCaption = newCaption;
    }
    progressFill.style.width = `${t * 100}%`;
    progressPlane.style.left = `${t * 100}%`;

    renderer.render(scene, camera);
  }

  function updateAircraftPoseWithDt(t, dt) {
    const pos = flightCurve.getPointAt(t);
    aircraft.position.copy(pos);

    forward.copy(flightCurve.getTangentAt(t)).normalize();
    right.crossVectors(worldUp, forward).normalize();
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    up.crossVectors(forward, right).normalize();
    basisMat.makeBasis(right, up, forward);
    targetQuat.setFromRotationMatrix(basisMat);

    const t2 = THREE.MathUtils.clamp(t + 0.003, 0, 1);
    const forward2 = flightCurve.getTangentAt(t2).normalize();
    const turn = right.dot(forward2.clone().sub(forward));
    const targetBank = THREE.MathUtils.clamp(-turn * 55, -0.5, 0.5);
    bankQuat.setFromAxisAngle(localZ, targetBank);
    targetQuat.multiply(bankQuat);

    aircraft.quaternion.slerp(targetQuat, 0.06);
    updateCamera(pos, forward, dt);
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
