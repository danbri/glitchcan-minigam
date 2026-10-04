# Open-data portals walked for the zone (other than the London Datastore)

The London Datastore has its own walk (`../london-datastore/`). This folder holds the walks of the other catalogues
that cover the Docklands zone (the 3D model box, BNG E 532400-539900, N 176700-182300). One adapter per portal in
`tools/portals/`, one entry point `tools/walk-portals.mjs`; method, rules, licences and traps in
`skills/cwplans-open-portals/SKILL.md`. Each portal folder has `catalogue.json` (the catalogue as walked),
`triage.json` (the final state of every dataset, with the rule and the reason), one folder per harvested dataset
(`<key>/<key>.geojson` or `.json`, zone only, with a `meta` member: source, API, fetch date, licence, attribution,
method, counts) and a README. `index.json` has the counts per portal (`walk-portals.mjs index`).

| portal | folder | walked | datasets seen | final states | harvested | size |
|---|---|---|---|---|---|---|
| data.gov.uk (CKAN) | `dgu/` | 2026-10-04 | 59,451 (25,492 in scope) | listed 1,257, deferred 1,991, not-relevant 9,035, not-open 4,809, unavailable 3,199, walked-elsewhere 5,121, sensitive 72, held 8 | through `national/` and `pdg/` | 4.2 MB catalogue and triage |
| planning.data.gov.uk | `pdg/` | 2026-10-04 | 222 | harvested 26, held 11, not-relevant 79, unavailable 106 | 26 datasets: listed buildings and outlines, Heritage at Risk, Article 4 areas, area TPOs, EA flood zones, AQMAs, LNRs, NSIPs, section 106 (Greenwich), plan records | 7.2 MB |

States (the same words in every portal): **harvested** (a zone extract is committed here), **held** (the project
already has the data, from this or another source: the file is named), **listed-for-harvest** (open, relevant, not
yet taken: the ranked backlog), **deferred** (documents only, or the area is unknown until the data is read),
**not-relevant** (another area, coarser than a borough, a code list, administrative records), **not-open** (no
licence, restricted, non-commercial or share-alike), **unavailable** (no resources, ended, deleted), **sensitive**
(titles about victims, deaths, custody, safeguarding of people: never harvested), **walked-elsewhere** (another walk
covers the source whole).

Licences: only OGL, CC BY, ODC-By and CC0/PDDL data is committed. A source with no licence is catalogued, not
harvested. Each harvested file carries its attribution in `meta.attribution`.
