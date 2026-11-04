# Thanksgiving story map (November 2026)

Page: https://danbri.github.io/glitchcan-minigam/thanksgiving/thanksgiving.html

Deep link to one part: add the part id as the hash, for example
https://danbri.github.io/glitchcan-minigam/thanksgiving/thanksgiving.html#feast

## What it is

A children's history of the 1621 harvest feast at Plymouth, in 25 parts, from the Wampanoag homelands before 1600
to the Wampanoag Nation today. Each part has a date, a place, two to three short paragraphs, and a "How do we know?"
box that names the source. Some parts also have a "True or not?" box (Plymouth Rock, the name "Thanksgiving") or a
"A hard part" box (the 1614 kidnapping, the corn taken on Cape Cod, the war of 1675).

## Files

| file | what it does |
|---|---|
| `thanksgiving/thanksgiving.html` | the page: story data (`STORY`), places (`MARKERS`), routes (`ROUTES`), map views (`V`), the timeline |
| `thanksgiving/coast-data.js` | generated coastlines (SVG path strings), do not edit |
| `thanksgiving/tools/build-coast.mjs` | makes `coast-data.js` from Natural Earth land polygons |

No dependencies, no CDN. The page is one ES module plus the data module.

## How the map works

- Projection: equirectangular, longitude scaled by cos(45°), 100 map units per degree of latitude. `PROJ` in
  `coast-data.js`; the page and the build tool must agree.
- Two coastline layers: `COARSE` (Natural Earth 1:50m, lon -78 to 6, lat 35 to 58, simplified to 2.5 units) and
  `FINE` (Natural Earth 1:10m, lon -78 to -66, lat 37 to 46, simplified to 0.3 units, about 330 m). Each view has a
  `fine` value 0 or 1; the page crossfades the layers between views.
- The timeline is indexed by story part, not by year: part i is at slider value i. Between two parts the view
  interpolates (centre linearly, size in log space) and zooms out when the two views are far apart. A second bar
  shows the real years to scale, so a child can see how much of the story is in 1620 and 1621.
- The vessel follows named waypoints on three routes (`voyage`, `squanto`, `home`). The routes are drawings, not
  ship's logs; the page says so.
- Markers and labels keep a constant screen size (scaled by map units per pixel each frame). Markers for small
  places hide when the view is more than 9 degrees across; labels of markers that are not part of the current part
  hide when the view is more than 30 degrees across.
- Input: drag the slider, drag the map left or right, arrow keys, Play (9 seconds a part), marker taps.
- Test hook: `window.__thanksgiving` (`story`, `goTo(i)`, `pos`).

Rebuild the coastlines:

    curl -sSO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson
    curl -sSO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson
    node thanksgiving/tools/build-coast.mjs ne_50m_land.geojson ne_10m_land.geojson

The Douglas-Peucker step splits each closed ring in two first. Without that, every ring collapsed to nothing,
because a closed ring's first and last points are the same point.

## Historical choices

- Dates for 1620 and 1621 are in the old (Julian) calendar, as Bradford and Winslow wrote them, with the modern
  (Gregorian) date beside them: 10 days later.
- The exact day of the feast is not known (late September to early November 1621). The page says so.
- Numbers come from the sources: 102 passengers; 41 signers of the Compact; about 60 men with Massasoit in March 1621;
  about 90 men in the autumn; three days; five deer; about half the colonists dead by spring.
- Quotes used: "fell amongst dangerous shoals and roaring breakers" (Bradford); "saluted us in English, and bade us
  welcome" (Mourt's Relation); "a special instrument sent of God" (Bradford); "they knew they were pilgrims"
  (Bradford). "Welcome, Englishmen!" is given as the later retelling, not as a quote.
- The page does not draw people. Wampanoag places use a wetu (house) icon; there are no feathers or costumes.
- Things the page tells as uncertain: which disease caused the 1616 to 1619 epidemic; whether Massasoit was invited
  to the feast; whether turkey was eaten; the Speedwell's leaks (Bradford suspected the crew).

## Sources

- William Bradford, *Of Plymouth Plantation* (written 1630 to 1651).
- *Mourt's Relation* (1622), including Edward Winslow's letter of December 11, 1621.
- Washington's proclamation (October 3, 1789); Lincoln's proclamation (October 3, 1863); Public Law 77-379 (1941).
- Plimoth Patuxet Museums, https://www.plimoth.org/
- National Museum of the American Indian, Native Knowledge 360°, https://americanindian.si.edu/nk360/
- Mashpee Wampanoag Tribe, https://mashpeewampanoagtribe-nsn.gov/ ; Wampanoag Tribe of Gay Head (Aquinnah),
  https://wampanoagtribe-nsn.gov/ ; Wôpanâak Language Reclamation Project, https://www.wlrp.org/
- Natural Earth (public domain) for coastlines.

## Open items

- No sound or narration.
- The fine coastline at Plymouth harbor is coarse at the closest zoom (Natural Earth 1:10m). A better source would be
  OpenStreetMap coastline or NOAA shoreline data, clipped to Cape Cod Bay.
- No automated test in `tests/`. It was checked with Playwright screenshots at 1280×860 and 390×844 (no console
  errors).
