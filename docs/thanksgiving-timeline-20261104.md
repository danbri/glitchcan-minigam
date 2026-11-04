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

## Footnotes and the Sources tab (2026-11-04)

Owner: "Footnote all substantive claims to a footnote which is simple but links to a detailed tab with bibliographic
info etc". Done in the page:

- Each claim in the story text ends with a small number. The number jumps to the part's Notes list (short source
  name and the place in it: book and chapter, year, date of the journal entry, or a quoted phrase). "Details" opens
  the Sources tab at the full entry.
- The Sources tab (side panel, next to the Story tab) lists 35 entries in five groups: primary sources, government
  records, Wampanoag sources, histories and museums, and notes on estimates (crew, ship size, children, feast date).
  Each entry has the full reference, what the source is and how far to trust it, links to online texts, and
  "Used in" buttons that open the parts that cite it.
- Deep links: https://danbri.github.io/glitchcan-minigam/thanksgiving/thanksgiving.html#sources opens the tab;
  `#src-<key>` opens one entry, for example
  https://danbri.github.io/glitchcan-minigam/thanksgiving/thanksgiving.html#src-mourt
- Data: `BIB` (the sources) and the `[[key, locator]]` marks in `STORY` and `FOOD`, in `thanksgiving/thanksgiving.html`.
  A missing key is logged as a console error. The list under the map shows the text without the marks.
- Locators for Bradford and Mourt's Relation were checked against the Project Gutenberg texts (#24950, the 1898
  edition; #66359, the Heath edition). Chapter numbers for Salisbury and Lepore were not checked, so those notes give
  the book only.
- Changes found while adding notes: the "Corn Hill" name is from Mourt's Relation, not Bradford; "People of the First
  Light" is now cited to the Aquinnah tribe and to Plimoth Patuxet (not WLRP, whose page does not say it); the ship's
  size is now stated as an estimate ("Nobody wrote down the size of the ship"); "more than 30 children" is now "about
  30" (counts run 30 to 34); "no forks" is cited to Kathleen Curtin (Archaeology, 2006), because the Smithsonian
  article does not say it.

## Fact check (2026-11-04)

Owner: "Fact check your work vigorously!" Three agents checked every claim in the 25 parts against the primary
texts and reliable secondary sources. The primary texts used: Bradford, https://www.gutenberg.org/ebooks/24950 ;
Mourt's Relation with Winslow's letter, https://www.gutenberg.org/ebooks/66359 . Result: one wrong quotation and
about 20 imprecise items. No date, number or name was wrong. All were corrected:

| part | was | now | why |
|---|---|---|---|
| billington | Bradford: "gave them full content" | "gave full satisfaction" | the quotation mixed two Bradford phrases |
| billington | met "the family" whose corn they took, agreed to pay | met "a man", promised to pay | Mourt's: "one of those whose corn we had formerly found; we promised him restitution" |
| squanto-home | sailed home "by way of Newfoundland" in 1619 | London to Newfoundland, back to England, home with Thomas Dermer in 1619 | Newfoundland was about 1617; route redrawn via England and Monhegan |
| squanto-home | "went to live" with Massasoit | lived among the Pokanoket; may have been held as a captive | Salisbury and others |
| squanto-home | "English explorers" wrote of empty villages in 1619 | Thomas Dermer, quoted | one writer, Dermer's 1619 letter |
| corn | graves dug when corn was found; "Nauset families" | first trip left a grave alone; second trip (about two weeks later) dug graves; "Pamet or Nauset" | Mourt's; Corn Hill is in Pamet land |
| first-encounter | "no one on either side was hurt" | no English person was hurt; Nauset injuries unknown | Mourt's records only the English side |
| plymouth | "both" sources say the fields were planted by people who were gone | Mourt's says it, quoted | Bradford does not say it about these fields |
| winter | "Bradford kept a list of who died" | Bradford's "scarce 50 remained"; the list was made years later | the list dates from about 1651 |
| samoset | came back "a few days later" with Tisquantum | came back on March 18 with five men; brought Tisquantum on March 22 | Mourt's |
| planting | showed "where to catch fish and eels" | taught them to catch the spring fish; brought eels | Bradford, Mourt's |
| feast | "played games"; deer "to the governor and the colonists" | ate together; deer to the governor, Captain Standish and others | Winslow: "bestowed on our governor, and upon the captain and others" |
| compact | women "were not asked" | only men signed; women were not included | no source records asking |
| at-sea | "the passengers" brought the screw; Howland detail | one passenger brought it from Holland; he was pulled up, then got aboard with a boat hook | Bradford |
| thanksgiving-1623 | "July 1623" | "Summer 1623"; Winslow (1624) added as a source | Bradford gives no date |
| lincoln | Hale "about 17 years"; Young "first used those words" | "more than 15 years"; Young called it that in 1841, the name spread later | Hale's 1863 letter; earlier uses exist |
| mourning | "Plymouth celebrated"; "did not let him give it" | Massachusetts celebrated, at a dinner; would not let him give the speech he wrote | the state ran the 350th event |
| today | "almost nobody spoke"; "old books"; "now there is a school" | nobody for more than 100 years; books, letters and land records; a school opened in 2016 | WLRP; no source after 2019 confirms the school is open now |
| marker war | 41.75, -71.10 (Somerset) | 41.70, -71.26 (Mount Hope) | Metacom's home |
| grown-ups | "1620" for March 1621 | "1620" for January 1 to March 24, 1621 | the year began March 25 |

Checked and correct (examples): 102 passengers; 41 signers; the 10-day calendar offset and every Old Style / New
Style pair; 20 from Patuxet and 7 from Nauset (1614), Málaga; "six or seven" sound persons; about 60 men in March
1621 and about 90 in autumn; three days; five deer; "a special instrument sent of God"; "saluted us in English, and
bade us welcome"; "fell amongst dangerous shoals and roaring breakers"; "they knew they were pilgrims"; the
Washington (1789), Lincoln (1863) and 1941 dates; Public Law 77-379; Mashpee (recognized 2007) and Aquinnah
(recognized 1987); WLRP founded 1993. All marker coordinates are within about 2 km, except the war marker (fixed).

Still uncertain, and the page says so or does not claim it: the exact day of the feast; which disease caused the
epidemic; whether Massasoit was invited; whether the Wôpanâak school is still open in 2026.

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
