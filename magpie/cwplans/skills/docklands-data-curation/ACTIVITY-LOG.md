# Activity log: Docklands data curation

Newest last. One entry per working session: what changed, commit, measured effect, open items.
Fault ids (F1…) refer to the fault register in [SKILL.md](SKILL.md); check ids (ID-1, SP-6…) to
`../../quality/CATALOGUE.md`.

## 2026-10-02: corridor and Docklands 3D models

- Imported the supplied Canada Water to Surrey Quays 3D study (eb5eaae) and fixed the faults that stopped it
  working: the reserved word `do` used as a name, and a shadowed `cross` (4d44f1f).
- Built the corridor model from open data (12f0090): OSM API `map.json` for the box plus
  `relation/{id}/full.json` for water relations with missing members (the Thames between Rotherhithe and
  Wapping was absent without them); EA LiDAR DTM/DSM 1 m; Wikidata. WGS84 to BNG through OSTN15 (a Helmert
  transform was 1.8 m out).
- Built the Docklands model, London Bridge to Cody Dock (42cbadb onward). Overpass and Geofabrik were
  unreachable; the OSM source is the openstreetmap.fr Greater London extract (OSM data as of 2026-10-01
  01:43 UTC).
- Pipeline faults found and fixed (F10): `simplify()` collapsed closed rings (now split at the farthest
  point); fetch scripts ran their side effects when imported (main guards); the DLR was drawn on station
  roofs because the DSM sees the roof over a viaduct (bridge points more than 20 m above the ground are now
  interpolated: 42 points).
- Feeds catalogue (200 sources), cited facts (360), published levels, live panel, EA flood walls (19036e5,
  897fde6). Wrong links found in our own text and fixed (F11): an FSA search URL and a flood-check link
  that returned 404, a guessed Wikidata id (rule since: never guess ids).

## 2026-10-03: postcodes, events, registry, joins

- Postcodes (2b12097, 748411f, 5cb5bf4): every E14 candidate (4,000) checked against ONSPD August 2026
  (1,905 live, 1,076 terminated, 1,019 never allocated). The ONSPD hosted table times out on LIKE and range
  queries; ids-only then object-id batches of 200 works.
- Events catalogue (124 sources, 24e4bf4). A what's-on page was marked verified although it served an
  Incapsula challenge; corrected (F11).
- Registry (7760e6b, 9475f24): 1,129 buildings with `cwb-` ids; occupants from OSM, FSA, Wikidata (QLever:
  two-step queries, a variable predicate over a radius times out); joins to UPRN, TOID, INSPIRE, Companies
  House, price paid, LBSM. Privacy limits then in force: organisations only, minimum of 5 homes, no company
  addresses, company counts only in residential buildings (486 companies at one flat).
- Chain-store branches (9b22664): 271 branches of 211 brands; CWG directory read from Internet Archive
  copies because canarywharf.com serves a bot challenge.
- Wet areas and museum records (73f0664); riverbed from UKHO bathymetry (2479e3c).

## 2026-10-03: policy and the data register

- Owner policy (9896f41): restrictions on personal, organisation and address data suspended for this
  project during scoping, planning and prototyping; no proprietary or virally licensed data.
- Data register (32c1f09): every committed data file with sources, licences and OSM use. Found: four pages
  showed OSM data without the "© OpenStreetMap contributors" notice (fixed); the postcode page lacked the
  ONS, OS and Royal Mail notices (fixed); the brands README named Geofabrik as the OSM source (F11, fixed).
- Owner: ODbL allowed for now and to be reviewed; keep track of its use. Website crawls (direct, Internet
  Archive, Common Crawl) allowed for scoping (b209725).

## 2026-10-03: atlas

- Atlas page joining every collection (02da9a3).
- F1 found and fixed: One Canada Square's Wikidata record was on both the tower and the Cabot Place mall.
  Rule: an item named by an OSM `wikidata` tag is not attached to a second outline by coordinate. Effect:
  7 buildings changed; buildings with Wikidata 93 → 89; companies matched to a building 5,345 → 6,355.
- F5 fixed for the atlas: LiDAR heights from the 3D model joined to registry outlines (1,079 of 1,129).
- Seen but not patched (owner direction, below): "Boots in The Ivy"; "Unit Unit 14" addresses.

## 2026-10-03: data-quality audit

- Owner direction: catalogue and analyse data-quality and error classes systematically instead of patching
  individual mistakes; this is the basis for the compositing layers.
- `tools/audit-quality.mjs`, `quality/README.md` (analysis and five compositing layers), atlas section
  `#quality`, map layer, quality notes in records (60180d7). 27 checks, 1,564 issues.
- Two first-draft checks were wrong and were corrected before commit: a repeated-word check flagged real
  names ("Tian Tian Market"); a postcode check flagged valid OSM ";" lists. A coverage claim in the draft
  analysis ("no source sees more than 60% of branches") was wrong: OSM sees 79%.
- Pipeline faults found by the audit, catalogued, not fixed: F2 (";" lists: 79 features, 247 postcode links
  lost) and F3 ("Unit Unit": 52 addresses).

## 2026-10-03: mall placement class and this skill

- The "Boots in The Ivy" case traced: OSM Boots (Canada Place, Mall Level -1) placed by proximity (2 m) in
  The Ivy; FSA "Boots the Chemist (4)" (Jubilee Place) inside Northern Trust. Classified as F4 and measured
  with a new check, SP-6: 86 of 181 mall or below-ground occupants are in an outline that is not their mall,
  34 more below ground in a building with no basement record. Audit: 28 checks, 1,684 issues
  (8 high, 818 medium, 858 low); 159 buildings and 44 postcodes with issues.
- `quality/README.md`: new finding "the estate is three-dimensional; the joins are not", and an "occupant
  container" row in the precedence table.
- Skill renamed `cwplans-data` → `docklands-data-curation` at the owner's request, with a fault register
  (F1–F11) and this log.

## Open, in the order proposed

1. Fix F2 and F3 in the parsers, with fixture tests; expect PL-1 and PL-2 to fall to 0.
2. F4: mall containers (CWG mall, OSM indoor areas) with levels; place mall occupants by mall.
3. F7: precision class and relation type on every position; no building placement from postcode centres.
4. Link records (method, distance, confidence) in the registry.
5. F9: per-mall level offset table.
6. F8: Wikidata P580/P582 and dissolution dates; company status dates.
7. Re-crawl the CWG directory and expire entries not seen.
8. Owner decision, open since 2026-10-03: now that the privacy limits are suspended, whether to lift the
   residential company-name rule and the minimum of 5 homes in the registry build.
