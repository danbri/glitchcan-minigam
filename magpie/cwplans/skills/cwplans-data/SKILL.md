---
name: cwplans-data
description: >-
  Work on magpie/cwplans — the Canary Wharf, Isle of Dogs and Docklands open-data project: the 3D models,
  the building registry (cwb- ids), postcodes, chain-store branches, heritage, river, feeds, the atlas page,
  the data register and the data-quality audit. Use this when rebuilding or adding a source, joining two
  sources, changing a pipeline tool in magpie/cwplans/tools/, adding a page that shows the data, or
  reasoning about why two sources disagree. READ THE DATA-QUALITY SECTION BEFORE PATCHING A WRONG VALUE:
  the owner's direction (October 2026) is to catalogue and analyse error classes, not to fix records one
  at a time, because the classes drive the compositing layers.
---

# cwplans data

Pages: https://danbri.github.io/glitchcan-minigam/magpie/cwplans/atlas/ (everything joined),
https://danbri.github.io/glitchcan-minigam/magpie/cwplans/docklands/ (3D).
Rules for this directory are in the repo `CLAUDE.md`, Data ethics, "EXCEPTION — magpie/cwplans/": personal,
organisation and address data allowed during prototyping; no proprietary or restricted-licence data; OSM
(ODbL) allowed and tracked; website crawls allowed for scoping and recorded.

## Rebuild order

    node magpie/cwplans/tools/build-registry.mjs        # registry/buildings.json (needs data/raw/registry/*)
    node magpie/cwplans/tools/build-atlas.mjs           # atlas/data/atlas.json (reads the registry and docklands/data/area.js)
    node magpie/cwplans/tools/audit-quality.mjs         # quality/issues.json, quality/CATALOGUE.md (reads the atlas)
    node magpie/cwplans/tools/check-data-register.mjs --write   # every committed data file registered?

The fetch and 3D steps are in `magpie/cwplans/docklands/README.md` and `registry/README.md`. Raw extracts
over a few MB stay local (gitignored); see `data-register.json` for what is committed and why.

## Data register

Every committed data file has an entry in `data-register.json`: sources (keys into its `sources` table with
licence and attribution), `osm.use` (raw, derived, counts, ids, notes, none), the OSM extract, and `shown_on`
pages. The check fails on an unregistered file and on a page that shows OSM data without the visible
"© OpenStreetMap contributors" link to https://www.openstreetmap.org/copyright. Add the entry in the same
commit as the file.

## Data quality: catalogue first

`tools/audit-quality.mjs` runs the same checks on every rebuild (27 in October 2026, eight classes:
identity, position, attribute conflict, validity, pipeline, currency, coverage, meaning). Each check has a
method, a population, a count, examples, and a proposed compositing rule. The analysis is
`quality/README.md`. When you find a wrong value:

1. Ask which class it belongs to. If no check covers it, add a check (method, population, rule) rather
   than editing the record.
2. Fix a tool only when the fault is in our own pipeline (class "pipeline"), and keep the check so the
   count shows the fix.
3. After any change, re-run the audit and compare counts: the targeted count should fall and no other
   should rise.

Before trusting a new check, read its examples by hand. Two first drafts were wrong in October 2026:
a "repeated word" check flagged real names ("Tian Tian Market"), and a "malformed postcode" check flagged
valid OSM lists. A third claim in the analysis (branch coverage) was wrong until it was computed.

## Measured lessons (the reasons behind the rules)

- **OSM tags can hold lists.** `addr:postcode="E14 9DT;E14 9FQ"`, `level="0;1"`. Split on ";" for every tag.
  `postcodes.mjs`, `build-registry.mjs` and `build-branches.mjs` did not (79 features, 247 postcode links
  lost; audit PL-1).
- **Never prefix a label to free text.** `build-branches.mjs` wrote "Unit " before `addr:unit`, and 118 OSM
  values already start with "Unit" (PL-2).
- **One Wikidata item, one outline.** An item whose coordinate falls in a podium outline (One Canada Square
  in the Cabot Place mall) must not be attached there when an OSM `wikidata` tag already names the tower
  outline. Fixed in `build-registry.mjs`; OSM itself tags three items on two outlines each (ID-1).
- **Levels are labels.** OSM `level` is a mapper's floor index; the Canary Wharf Group names levels per mall.
  In Cabot Place the CWG label is the OSM index minus 1 for 19 of 26 matched occupants; in Jubilee Place they agree for 11 of 13 (AT-3). Measure the offset per mall; do not assume one.
  Convert to metres only through published slab levels (`data/sourced-levels.json`, Crossrail Place).
- **A position has a precision and a meaning.** 271 of 764 FSA points are the postcode centre and 252 share
  one point with two or more others (SP-3): use them for postcode, not building, placement. 5,888 of 6,629
  heritage points are where an object is kept (SE-2).
- **A registered office is not an occupant.** E14 5HU has 2,652 registered companies (SE-1).
- **Links need dates.** Wikidata P466/P159 were fetched without P580/P582, so former tenants (the
  Financial Services Authority, abolished 2013) look current (TM-4).
- **Building names.** OSM often names a building after a tenant ("HSBC UK" for 8 Canada Square); prefer the
  Wikidata label, then the OSM name only if it is not an occupant or brand (ID-3).
- **Heights.** LiDAR (EA composite) is the measured height for buildings older than the survey; nine
  buildings show under half their floor-count height and are newer (AT-1). `build-atlas.mjs` joins the 3D
  model's LiDAR height to registry outlines by point-in-polygon of the model footprint centres.

## Pages

- The atlas (`atlas/index.html`) loads `atlas/data/atlas.json` first and the detail files on demand
  (`registry/buildings.json`, `quality/issues.json`, …). Hash routes: `#view`, `#view/b/cwb-0413`,
  `#view/pc/E14-5AB`, `#quality/q/AT-3`; `#cwb-NNNN` also works. `window.__atlas` exposes `open(kind, id)`.
- The 3D page accepts `#at=x,z,dist` in local metres (x = E − 537550, z = −(N − 180300)).
- Test headless with Playwright from a local `python3 -m http.server` (fetch needs http); this container
  cannot reach tile.openstreetmap.org, so the basemap is not visible in captures.
