// The flight path: a single stylised curve from London takeoff to Newark
// touchdown, plus real fetched weather mapped onto it by journey-fraction.
//
// This is NOT a geographically accurate transatlantic track (5900km would be
// unusable at toy scale) — it's an emotionally-shaped arc: short climb, long
// cruise, short descent, matching how a flight actually *feels*. We use
// Curve.getPointAt()/getTangentAt() (arc-length parameterised) rather than
// getPoint()/getTangent() so that the long cruise segment naturally consumes
// most of the 0..1 progress range, just like the real flight's time budget.

import * as THREE from '../vendor/three.module.min.js';

export const CRUISE_ALT = 420;
export const LONDON_WORLD_Z = -260;
export const NYC_WORLD_Z = 6300;

// Runway centres (z) and the fixed heading of each strip. The path's ground
// segments run straight along +z at these z ranges, so the runways line up.
export const LONDON_RUNWAY_Z = -470;
export const NYC_RUNWAY_Z = 6430;

// The path is deliberately almost dead-straight in x (only a whisper of lateral
// drift) so cruise feels calm and never lurches side-to-side. Both ends have a
// long, level GROUND ROLL along the runway: the plane accelerates from a stop,
// rotates and climbs; then on arrival it flares, touches down and rolls out to
// a full stop (see the speed profile in ua17-app.js). y is height, z is along-track.
const CONTROL_POINTS = [
  // London: stopped at the runway threshold, then ground roll + rotate + climb
  [0, 3, -690],
  [0, 3, -600],
  [0, 3, -500],
  [0, 4, -410],
  [0, 12, -350],
  [0, 90, -270],
  [0, 250, -110],
  [0, 370, 150],
  // Cruise — barely-there lateral drift keeps it alive without weaving
  [5, 415, 720],
  [-5, 424, 1500],
  [5, 420, 2300],
  [-5, 423, 3100],
  [5, 420, 3900],
  [-5, 423, 4700],
  [3, 418, 5300],
  // Descent, flare, touchdown, long roll-out to a full stop at Newark
  [0, 330, 5760],
  [0, 180, 6050],
  [0, 55, 6250],
  [0, 5, 6360],
  [0, 3, 6470],
  [0, 3, 6580],
  [0, 3, 6690],
].map((p) => new THREE.Vector3(...p));

export const flightCurve = new THREE.CatmullRomCurve3(CONTROL_POINTS, false, 'catmullrom', 0.3);

export async function loadWeather() {
  const res = await fetch(new URL('../data/weather.json', import.meta.url));
  return res.json();
}

export async function loadFlightInfo() {
  const res = await fetch(new URL('../data/flight-info.json', import.meta.url));
  return res.json();
}

// Linear interpolation of the fetched cloud-cover samples at journey fraction t.
export function cloudAt(weather, t) {
  const wps = weather.waypoints;
  let i = 0;
  while (i < wps.length - 2 && wps[i + 1].t < t) i++;
  const a = wps[i], b = wps[i + 1];
  const span = Math.max(1e-6, b.t - a.t);
  const f = THREE.MathUtils.clamp((t - a.t) / span, 0, 1);
  const lerp = (k) => a.cloud[k] + (b.cloud[k] - a.cloud[k]) * f;
  return { low: lerp('low'), mid: lerp('mid'), high: lerp('high'), total: lerp('total') };
}

export function pointAt(t) {
  return flightCurve.getPointAt(THREE.MathUtils.clamp(t, 0, 1));
}

export function tangentAt(t) {
  return flightCurve.getTangentAt(THREE.MathUtils.clamp(t, 0.0001, 0.9999));
}

// Friendly caption for the current stage of the flight, shown in the HUD.
export function stageCaption(t) {
  if (t < 0.04) return 'Ready for take-off from London! ✈️';
  if (t < 0.1) return 'Climbing over London! Look down! 🏙️';
  if (t < 0.85) return 'Cruising high over the ocean ⛅';
  if (t < 0.94) return 'Starting our descent... 🌊';
  if (t < 0.99) return 'There’s New York! 🇺🇸';
  return 'Touchdown at Newark! 🎉';
}
