/**
 * eclipse-compass.js — "which way do I turn?"
 *
 * Uses the device orientation sensors when the browser gives them, and
 * degrades to a plain printed direction when it does not. The printed
 * direction is always shown, because a compass sensor in a city with
 * steel in the walls is often wrong, and a child holding a phone that
 * points confidently at the wrong horizon is worse than a child reading
 * the word "west".
 *
 * iOS needs a permission request that must start from a tap. Android
 * and desktop Chrome give the absolute event without asking.
 */

export class Compass {
  constructor() {
    this.heading = null;      // degrees, 0 = north, clockwise
    this.pitch = null;        // degrees above the horizon the phone points
    this.supported = 'DeviceOrientationEvent' in window;
    this.needsPermission = typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function';
    this.running = false;
    this.absolute = false;
    this.listeners = new Set();
    this._onEvent = this._onEvent.bind(this);
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Must be called from a real tap on iOS. Returns true if running. */
  async start() {
    if (!this.supported) return false;
    if (this.running) return true;
    if (this.needsPermission) {
      try {
        const state = await DeviceOrientationEvent.requestPermission();
        if (state !== 'granted') return false;
      } catch (err) {
        return false;
      }
    }
    window.addEventListener('deviceorientationabsolute', this._onEvent, true);
    window.addEventListener('deviceorientation', this._onEvent, true);
    this.running = true;
    return true;
  }

  stop() {
    window.removeEventListener('deviceorientationabsolute', this._onEvent, true);
    window.removeEventListener('deviceorientation', this._onEvent, true);
    this.running = false;
  }

  _onEvent(event) {
    let heading = null;
    if (typeof event.webkitCompassHeading === 'number' && !Number.isNaN(event.webkitCompassHeading)) {
      heading = event.webkitCompassHeading;         // iOS: already true-ish north
      this.absolute = true;
    } else if (typeof event.alpha === 'number') {
      heading = 360 - event.alpha;                  // others: alpha counts the other way
      this.absolute = this.absolute || !!event.absolute;
    }
    if (heading === null) return;

    // The sensor frame does not turn when the screen turns.
    const screenAngle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    heading = (heading + screenAngle) % 360;
    if (heading < 0) heading += 360;

    // Beta is the tilt: 0 flat on a table, 90 held upright. Held
    // upright and looking forward is a pitch of 0 degrees.
    if (typeof event.beta === 'number') {
      this.pitch = Math.max(-90, Math.min(90, event.beta - 90));
    }

    // A little smoothing, or the arrow jitters and a child chases it.
    this.heading = this.heading === null
      ? heading
      : smoothAngle(this.heading, heading, 0.25);

    for (const fn of this.listeners) fn(this);
  }
}

/** Shortest signed turn from a to b, in degrees. */
export function angleDelta(a, b) {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function smoothAngle(current, target, k) {
  const next = current + angleDelta(current, target) * k;
  return (next % 360 + 360) % 360;
}

/**
 * Draw the direction dial: a ring, the compass letters, the Sun's
 * bearing, and — when the sensors work — where the phone is pointing.
 */
export function drawCompass(canvas, options) {
  const {
    sunAzimuth,
    sunAltitude,
    heading = null,
    letters = ['N', 'E', 'S', 'W']
  } = options;

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.42;

  // When the compass works, the dial turns so that up is where you are
  // facing. When it does not, up is north.
  const rotate = heading === null ? 0 : -heading;
  const toXY = (bearing, radius) => {
    const a = (bearing + rotate - 90) * Math.PI / 180;
    return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
  };

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = `600 ${Math.round(R * 0.24)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [0, 90, 180, 270].forEach((bearing, i) => {
    const [x, y] = toXY(bearing, R * 0.82);
    ctx.fillStyle = i === 0 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.45)';
    ctx.fillText(letters[i], x, y);
  });

  // The Sun's bearing: a fat friendly wedge with a sun on the end.
  const [sx, sy] = toXY(sunAzimuth, R * 0.55);
  const wedge = 13 * Math.PI / 180;
  const a0 = (sunAzimuth + rotate - 90) * Math.PI / 180;
  const grad = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
  grad.addColorStop(0, 'rgba(255,205,80,0.05)');
  grad.addColorStop(1, 'rgba(255,205,80,0.42)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, R * 0.96, a0 - wedge, a0 + wedge);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffd257';
  ctx.beginPath();
  ctx.arc(sx, sy, R * 0.14, 0, Math.PI * 2);
  ctx.fill();

  // How high, written on the dial so the two facts stay together.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `700 ${Math.round(R * 0.2)}px system-ui, sans-serif`;
  ctx.fillText(`${Math.round(sunAltitude)}°`, cx, cy + R * 0.02);
  ctx.font = `500 ${Math.round(R * 0.13)}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('high', cx, cy + R * 0.22);

  // The phone's own pointing direction, only if we have a sensor.
  if (heading !== null) {
    ctx.strokeStyle = 'rgba(120,220,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - R * 0.98);
    ctx.lineTo(cx - R * 0.09, cy - R * 0.82);
    ctx.lineTo(cx + R * 0.09, cy - R * 0.82);
    ctx.closePath();
    ctx.fillStyle = 'rgba(120,220,255,0.9)';
    ctx.fill();
  }
}
