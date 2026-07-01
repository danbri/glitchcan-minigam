# UA17: London to New York! 🐥✈️

A lush, toddler-friendly 3D flight scene for **United 17, LHR → EWR**, built
with three.js. Auto-plays a full climb → cruise → descent along a stylised
flight path, complete with runways, a terminal + control tower, and landing
gear that deploys/retracts near the ground at both ends. Drag anywhere to
look around, drag the scrubber to jump to any point in the flight, or tap
another aircraft to see its real altitude/heading/callsign. Designed to work
entirely offline after one load.

## What's real in here

- **Route**: a great-circle interpolation between Heathrow and Newark drives
  where the (stylised) weather waypoints sit.
- **Weather**: real current cloud cover (low/mid/high %) fetched from
  [Open-Meteo](https://open-meteo.com) at 14 points along the route —
  `tools/fetch-weather.mjs` → `data/weather.json`. Denser real cloud cover
  along a stretch of the route means visibly denser clouds there.
- **Skylines**: real OSM building footprints + heights for the City of London
  and Midtown/Lower Manhattan, via Overpass — `tools/fetch-buildings.mjs` →
  `data/buildings-london.json` / `data/buildings-nyc.json`. Only geometry,
  height and public landmark names are kept (see data-ethics note below).
- **Other flights**: a real one-off ADS-B snapshot of North Atlantic traffic
  from [OpenSky Network](https://opensky-network.org) —
  `tools/fetch-flights-snapshot.mjs` → `data/flights-snapshot.json`. Tap one
  in the sky to see its real altitude/heading/callsign. The 24-bit icao24
  address (identifies one specific physical aircraft/owner) is dropped;
  callsign is kept since it's the publicly-broadcast flight number shown on
  any consumer flight tracker, not personal data.
- **Aircraft**: procedural (not a scan of a real airframe) — see
  `data/flight-info.json`.
- **Runways**: decorative (no real airport layout data), auto-aligned to the
  route's own heading at each end — see `js/ua17-airport.js`.

All three fetch scripts are one-shot snapshots you re-run by hand
(`node tools/fetch-weather.mjs`, etc.) — the app itself never calls these
APIs at runtime, so it has zero network dependency once loaded.

## Offline / "works from a zip"

1. Serve this folder once over HTTP(S) (or `file://` also works — `fetch()`
   of the local `data/*.json` and `vendor/three.module.min.js` succeeds from
   `file://` in evergreen browsers) so the service worker installs and
   precaches everything in `sw.js`'s `CORE` list.
2. From then on the page works fully offline — airplane mode, no wifi, etc.
3. To hand someone a standalone offline copy: `cd magpie/ua17 && zip -r
   ua17-offline.zip .` and share the zip. Unzipping and opening
   `index.html` directly works without a server; if you do serve it, the
   service worker keeps it working offline for repeat visits too.

If you touch any file in `CORE` inside `sw.js`, bump `CACHE` to a new version
string so returning visitors pick up the change instead of the stale cache.

## Regenerating the data snapshots

```
node tools/fetch-weather.mjs           # current cloud cover along the route
node tools/fetch-flights-snapshot.mjs  # a fresh snapshot of nearby air traffic
node tools/fetch-buildings.mjs         # London + NYC skyline footprints (rarely changes)
```

## Data ethics

Per the project's data-ethics rules: building data is geometry + height only
(no addresses/owners), and the flight snapshot drops icao24 (the identifier
tied to one specific physical aircraft/owner) while keeping the public
callsign — the same flight-number label any consumer flight tracker shows.
