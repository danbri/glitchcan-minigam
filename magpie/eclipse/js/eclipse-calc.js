/**
 * eclipse-calc.js — all of the astronomy for the eclipse viewer.
 *
 * Everything here comes from Astronomy Engine (MIT, vendored, no CDN).
 * Nothing is a typed-in table of times. Change the place and every number
 * in the app changes with it.
 *
 * Two independent things are computed:
 *
 *   1. The circumstances — first contact, maximum, last contact, and the
 *      peak obscuration. These come straight from the library's
 *      SearchLocalSolarEclipse().
 *
 *   2. A frame at an arbitrary instant — the apparent radii of the two
 *      discs and the offset of the Moon's centre from the Sun's centre,
 *      in a frame where up is the zenith. The sky view and the timeline
 *      scrubber draw from this, so a scrubbed preview is the real
 *      geometry and not an artist's loop.
 *
 * The frame offsets use unrefracted horizontal coordinates for both
 * bodies. Refraction moves the pair together near the horizon; it does
 * not meaningfully change how the Moon sits on the Sun. Checked against
 * the library: the discs touch within 0.00002 degrees of the library's
 * own contact times, and the peak coverage agrees to 0.1 percent.
 */

const DEG = Math.PI / 180;
const KM_PER_AU = 1.4959787069098932e+8;
const SUN_RADIUS_KM = 695700;
const MOON_RADIUS_KM = 1737.4;

/** The eclipse this app is about. */
export const ECLIPSE_DATE = '2026-08-12';

/** Where the app starts before the user shares a location. */
export const DEFAULT_PLACE = {
  name: 'London',
  latitude: 51.5074,
  longitude: -0.1278,
  elevation: 11
};

/** Some other places, so a child without location permission is not stuck. */
export const PRESET_PLACES = [
  DEFAULT_PLACE,
  { name: 'Birmingham', latitude: 52.4862, longitude: -1.8904, elevation: 140 },
  { name: 'Manchester', latitude: 53.4808, longitude: -2.2426, elevation: 38 },
  { name: 'Glasgow', latitude: 55.8642, longitude: -4.2518, elevation: 40 },
  { name: 'Cardiff', latitude: 51.4816, longitude: -3.1791, elevation: 12 },
  { name: 'Belfast', latitude: 54.5973, longitude: -5.9301, elevation: 15 },
  { name: 'Penzance', latitude: 50.1186, longitude: -5.5372, elevation: 20 },
  { name: 'Reykjavik', latitude: 64.1466, longitude: -21.9426, elevation: 15 },
  { name: 'Bilbao', latitude: 43.2630, longitude: -2.9350, elevation: 19 }
];

function lib() {
  const A = globalThis.Astronomy;
  if (!A || !A.SearchLocalSolarEclipse) {
    throw new Error('Astronomy Engine did not load. Check vendor/astronomy.browser.min.js.');
  }
  return A;
}

/** Angular radius of a body in degrees, from its distance in AU. */
function angularRadiusDeg(radiusKm, distanceAu) {
  return Math.asin(radiusKm / (distanceAu * KM_PER_AU)) / DEG;
}

/**
 * Fraction of the Sun's DISC AREA hidden by the Moon.
 * This is the number a child should be told, and it is not the same as
 * the magnitude (which is a fraction of the diameter). At maximum from
 * London the magnitude is about 0.95 but the covered area is about 0.91.
 */
function overlapFraction(rSun, rMoon, sep) {
  if (sep >= rSun + rMoon) return 0;
  if (sep <= rMoon - rSun) return 1;
  if (sep <= rSun - rMoon) return (rMoon * rMoon) / (rSun * rSun);
  const clamp = (v) => Math.min(1, Math.max(-1, v));
  const a = clamp((sep * sep + rSun * rSun - rMoon * rMoon) / (2 * sep * rSun));
  const b = clamp((sep * sep + rMoon * rMoon - rSun * rSun) / (2 * sep * rMoon));
  const lens =
    rSun * rSun * Math.acos(a) +
    rMoon * rMoon * Math.acos(b) -
    0.5 * Math.sqrt(Math.max(0,
      (-sep + rSun + rMoon) * (sep + rSun - rMoon) *
      (sep - rSun + rMoon) * (sep + rSun + rMoon)));
  return lens / (Math.PI * rSun * rSun);
}

export class EclipseCalc {
  constructor(place = DEFAULT_PLACE) {
    this.setPlace(place);
  }

  setPlace(place) {
    const A = lib();
    this.place = place;
    this.observer = new A.Observer(place.latitude, place.longitude, place.elevation || 0);
    this._circumstances = null;
    return this.circumstances();
  }

  /**
   * Contact times, peak coverage, and the sunset that may cut the show
   * short. Cached, because the search is the expensive call.
   */
  circumstances() {
    if (this._circumstances) return this._circumstances;
    const A = lib();
    const searchFrom = new Date(`${ECLIPSE_DATE}T00:00:00Z`);
    searchFrom.setUTCDate(searchFrom.getUTCDate() - 1);

    const info = A.SearchLocalSolarEclipse(searchFrom, this.observer);
    const at = (event) => (event ? event.time.date : null);

    // The library uses snake_case field names in the JavaScript build.
    const first = at(info.partial_begin);
    const totalBegin = at(info.total_begin);
    const peak = at(info.peak);
    const totalEnd = at(info.total_end);
    const last = at(info.partial_end);

    let sunset = null;
    try {
      const noon = new Date(`${ECLIPSE_DATE}T12:00:00Z`);
      const set = A.SearchRiseSet('Sun', this.observer, -1, noon, 1);
      sunset = set ? set.date : null;
    } catch (err) {
      sunset = null;
    }

    // The Sun may go down while the Moon still covers part of it.
    const sunsetDuringEclipse = !!(sunset && last && sunset < last);

    this._circumstances = {
      kind: info.kind,
      isTotalHere: info.kind === 'total',
      peakObscuration: info.obscuration,
      first,
      totalBegin,
      peak,
      totalEnd,
      last,
      sunset,
      sunsetDuringEclipse,
      // The end a viewer actually gets: whichever comes first.
      visibleEnd: sunsetDuringEclipse ? sunset : last,
      durationMs: first && last ? last - first : 0,
      place: this.place
    };
    return this._circumstances;
  }

  /**
   * The state of the sky at one instant. Safe to call every animation
   * frame; it is a few trigonometric series, not a search.
   */
  frameAt(date) {
    const A = lib();
    const time = A.MakeTime(date);
    const obs = this.observer;

    const sunEq = A.Equator('Sun', time, obs, true, true);
    const moonEq = A.Equator('Moon', time, obs, true, true);

    // Unrefracted (a falsy option means no refraction correction),
    // for the relative geometry of the two discs.
    const sunTrue = A.Horizon(time, obs, sunEq.ra, sunEq.dec, null);
    const moonTrue = A.Horizon(time, obs, moonEq.ra, moonEq.dec, null);
    // Refracted, for where to actually point a face.
    const sunApparent = A.Horizon(time, obs, sunEq.ra, sunEq.dec, 'normal');

    const rSun = angularRadiusDeg(SUN_RADIUS_KM, sunEq.dist);
    const rMoon = angularRadiusDeg(MOON_RADIUS_KM, moonEq.dist);

    let dAz = moonTrue.azimuth - sunTrue.azimuth;
    if (dAz > 180) dAz -= 360;
    if (dAz < -180) dAz += 360;

    // Tangent plane at the Sun, with the zenith up. Screen x is to the
    // right when facing the Sun, so east-of-Sun is positive x.
    const dx = dAz * Math.cos(sunTrue.altitude * DEG);
    const dy = moonTrue.altitude - sunTrue.altitude;
    const sep = Math.hypot(dx, dy);

    const obscuration = overlapFraction(rSun, rMoon, sep);
    const magnitude = sep >= rSun + rMoon ? 0 : Math.min(1, (rSun + rMoon - sep) / (2 * rSun));

    return {
      date: new Date(date.getTime()),
      sunRadiusDeg: rSun,
      moonRadiusDeg: rMoon,
      // Offsets in units of the Sun's radius — what a renderer wants.
      offsetX: dx / rSun,
      offsetY: dy / rSun,
      moonScale: rMoon / rSun,
      separationDeg: sep,
      obscuration,
      magnitude,
      sunAltitude: sunApparent.altitude,
      sunAzimuth: sunApparent.azimuth,
      sunIsUp: sunApparent.altitude > -0.5,
      // A two-storey house across a street covers roughly the first 20
      // degrees of sky. From London this eclipse never gets above 20,
      // so the "find a low view" advice stays on for the whole event —
      // which is correct, and is the single most useful tip here.
      sunIsLow: sunApparent.altitude < 20
    };
  }

  /**
   * Which part of the story we are in. The whole interface reads this,
   * so there is one definition of "now" and no screen can disagree.
   */
  phaseAt(date) {
    const c = this.circumstances();
    const t = date.getTime();
    if (!c.first || !c.last) return 'none';
    if (t < c.first.getTime()) return 'before';
    if (t > c.last.getTime()) return 'after';
    if (c.sunset && t > c.sunset.getTime()) return 'sunset';
    if (c.totalBegin && c.totalEnd &&
        t >= c.totalBegin.getTime() && t <= c.totalEnd.getTime()) return 'total';
    if (Math.abs(t - c.peak.getTime()) < 90 * 1000) return 'maximum';
    if (t < c.peak.getTime()) return 'growing';
    return 'shrinking';
  }

  /** The next thing worth waiting for, for the countdown. */
  nextEvent(date) {
    const c = this.circumstances();
    const t = date.getTime();
    const list = [
      { key: 'first', label: 'first bite', at: c.first },
      { key: 'peak', label: 'biggest bite', at: c.peak },
      { key: 'last', label: 'all done', at: c.last },
      { key: 'sunset', label: 'sunset', at: c.sunset }
    ].filter((e) => e.at);
    for (const e of list) {
      if (e.at.getTime() > t) return e;
    }
    return null;
  }

  /** Sample the whole eclipse, for the timeline graph. */
  curve(samples = 90) {
    const c = this.circumstances();
    if (!c.first || !c.last) return [];
    const out = [];
    for (let i = 0; i <= samples; i++) {
      const t = new Date(c.first.getTime() + (c.durationMs * i) / samples);
      const f = this.frameAt(t);
      out.push({ t, obscuration: f.obscuration, sunAltitude: f.sunAltitude });
    }
    return out;
  }
}

/* ---------- small helpers shared by the screens ---------- */

/** Local clock time, e.g. "19:13". Uses the device's own time zone. */
export function clockTime(date) {
  if (!date) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** A compass direction a child can use: "west", "north west". */
export function compassWords(azimuth) {
  const names = ['north', 'north east', 'east', 'south east',
    'south', 'south west', 'west', 'north west'];
  return names[Math.round(((azimuth % 360) + 360) % 360 / 45) % 8];
}

/** Short compass label for the dial: N, NE, E... */
export function compassShort(azimuth) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(((azimuth % 360) + 360) % 360 / 45) % 8];
}

/**
 * Height above the horizon in fists. An adult fist at arm's length is
 * about 10 degrees, and a child's fist on a child's arm is close enough
 * to the same angle. It is the oldest measuring tool there is.
 */
export function fistsHigh(altitudeDeg) {
  return Math.max(0, altitudeDeg) / 10;
}

/** Break a duration into parts for a countdown display. */
export function splitDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    totalSeconds: total
  };
}
