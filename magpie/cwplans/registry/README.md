# Canary Wharf building registry

Page: https://danbri.github.io/glitchcan-minigam/magpie/cwplans/registry/ (a building: `…/registry/#cwb-0413`)

Internal ids for the buildings of Canary Wharf, cross-referenced to OSM, Wikidata, postcodes and open registers, with their occupants and owners. Occupants and owners are organisations only. The registry never records private individuals: no residents, no company officers, no individual owners.

## Files

| file | what it is |
|---|---|
| `buildings.json` | `{summary, buildings: [...], unplaced_by_postcode: {...}}` |
| `ids.json` | the id register: OSM element → `cwb-NNNN`, and the next number to issue |
| `index.html` | list, search, map and per-building detail |
| `../tools/registry-osm.mjs` | OSM features with full tags in the box, from the Greater London extract |
| `../tools/registry-wikidata.mjs` | Wikidata through QLever (`https://qlever.dev/api/wikidata`) with `geof:distance` |
| `../tools/registry-fhrs.mjs` | FSA Tower Hamlets file (FHRS530), saved as a dated E14 snapshot; with two snapshots it writes `fhrs-changes.json` (new ids = registrations, usually openings; missing ids = closures) |
| `../tools/build-registry.mjs` | joins everything into `buildings.json` |

Rebuild:

    node --max-old-space-size=6000 magpie/cwplans/tools/registry-osm.mjs
    node magpie/cwplans/tools/registry-wikidata.mjs
    node magpie/cwplans/tools/registry-fhrs.mjs
    node magpie/cwplans/tools/build-registry.mjs

## Ids

- A building is an OSM building outline (`building=*`, way or multipolygon) whose centroid is in the Canary Wharf box (WGS84 −0.0300, 51.4980 to −0.0050, 51.5100; the box of the 3D model and the postcode list). OSM `building:part` shapes are listed under the outline that contains them.
- Ids have the form `cwb-0001`. The first run issued them in reading order: north to south in 100 m bands, then west to east. `ids.json` keeps them by OSM element, and a rebuild reuses them. The second and third rebuilds issued none (`minted_this_run: 0`). A new building gets the next free number, and a retired id is never used again.
- Limit: an id follows its OSM element. If a mapper deletes and redraws a building, it gets a new id. Matching by geometry overlap would keep the old id; that is not implemented yet.

## How things are joined

- **Building name**: the Wikidata label where the building has a Wikidata item, else the OSM name. OSM often names a tower after its main occupant ("HSBC UK" for 8 Canada Square, "Barclays" for One Churchill Place). The OSM name is kept as `osm_name`.
- **Wikidata item**: the OSM `wikidata` tag. Otherwise the one building-type Wikidata item (building, skyscraper, tower, station, hotel, shopping centre and similar) whose coordinate is inside the outline (93 buildings).
- **Occupants**, each with a role and a source:
  - OSM shops, offices, amenities, leisure, healthcare and transport features that have a name: placed in the outline that contains them, or in the nearest outline within 12 m (entrances on the wall). Level from OSM `level`, brand from `brand` and `brand:wikidata`. Public artworks and information boards are listed as features, not occupants.
  - FSA food premises (Tower Hamlets open-data file) with a position: placed the same way, with rating and rating date. Premises with no position, often new registrations, are listed by postcode under "Occupants listed by postcode only" (88). Home-based businesses, whose address the FSA withholds, are not kept.
  - Wikidata: organisations whose headquarters (P159) is the building ("headquarters"); the building's occupants (P466); and other non-building items whose coordinate is inside it.
- **Owners**: Wikidata "owned by" (P127), organisations only (10 buildings). Values that are people are dropped in the query.
- **Postcodes**: OSM `addr:postcode` on the building and its occupants, FSA postcodes of the premises placed in it, and Wikidata postal code. Each is checked against the postcode list (`../postcodes/`) for status and tier.
- **Look-up links per postcode**: Companies House advanced search by registered-office postcode (company-level results) and the HM Land Registry price-paid search. These are links to the official services. Their results are not copied here.

## Counts (2026-10-03)

1,129 buildings: 316 named, 93 with Wikidata, 249 with occupants (1,126 occupant records), 10 with an owner. Of the OSM occupants, 650 were placed in a building and 121 were not inside or near any outline. 444 FSA premises were placed by position.

## Not yet joined

Background work on 2026-10-03 is collecting:
- Companies House basic company data (registered offices by postcode, company-level only)
- HM Land Registry price paid and INSPIRE title polygons
- OS Open UPRN, with the UPRN–TOID and UPRN–USRN lookups
- the UK chain brands (name-suggestion-index) with their Canary Wharf branches
- Port of London Authority and museum records

These will be joined to the building ids when they are checked. Canary Wharf Group's own pages (canarywharf.com) could not be read: the site returns a bot-challenge page to scripts.
