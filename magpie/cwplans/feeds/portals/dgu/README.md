# data.gov.uk, walked for the zone

Portal: https://www.data.gov.uk/ (CKAN API `api/action/package_search`; robots.txt disallows only `/v1`). Tool:
`tools/walk-portals.mjs dgu walk | triage | catalogue` (adapter `tools/portals/dgu.mjs`); rules in
`skills/cwplans-open-portals/SKILL.md`. Walked 2026-10-04: 59,451 datasets in 60 pages of 1,000 (63 requests).

## Scope (written rule)

| scope | rule | datasets |
|---|---|---|
| S1 | published by a zone borough or a body local to the zone (Tower Hamlets, Southwark, Greenwich, Lewisham, Newham, City of London, LTGDC, Canal & River Trust, TfL, Royal Museums Greenwich, PLA, local NHS bodies) | 260 |
| S2 | published by a national body in the brief (EA, Historic England, Natural England, DfT, DLUHC/MHCLG, ONS, OS, HSE, Home Office, NHS, HM Land Registry, Coal Authority, BGS, DESNZ, Defra, DfE, CQC, VOA, Sport England, ...; the list is `NATIONAL_ORGS` in the adapter) | 23,863 |
| S3 | the GLA: its records are the London Datastore, walked by `walk-london-datastore.mjs` | 1,365 |
| S4 | any other publisher whose title or tags name a zone place or borough | 4 |
| out | other publishers (Scottish, Welsh and NI bodies, other councils, MEDIN...): counted per organisation in `triage.json` meta | 33,959 |

## Final states (25,492 in scope)

Run `node magpie/cwplans/tools/walk-portals.mjs dgu triage` for the current counts; on 2026-10-04: not-relevant
9,035, walked-elsewhere 5,121, not-open 4,809, unavailable 3,199, deferred 1,991, listed-for-harvest 1,257,
sensitive 72, held 8. `triage.json` lists one by one the datasets that need a decision or hold data (listed,
deferred with area unknown, held, sensitive); the bulk states are name lists in `by_state`, keyed
"state | rule | reason". `catalogue.json` holds the compact CKAN record of the datasets listed one by one.

**Licences that blocked** (not-open, 4,809): no licence on the record about 4,490 (BGS 4,128: BGS states its own
terms on each product page, so no BGS record is taken from here; JNCC 117; Defra 63; EA 60; Natural England 40; OS 28
outside the Data Hub), restricted about 170 (BGS 141 commercial products, Natural England 15), open-unclear about
150 ("no conditions apply" without a licence name; JNCC 145).

**Walked elsewhere** (5,121): ONS Open Geography Portal items (3,497: `../onsgeo/`), the GLA records (1,355), the City
of London INSPIRE map service (141: `../boroughs/`) and OS Data Hub products (128: `../national/`).

**Not relevant** (9,035): another area by bounding box or title (Scotland, Wales, other counties and boroughs),
administrative records (payments, spending, staff, contracts, FOI), or coarser than a borough.

## The listed backlog (1,257)

Ranked by `score` (relevance x themes x recency x spatial). By publisher: EA 507, ONS 208, Forestry Commission 197,
Natural England 151, DLUHC 45, Defra 33, RPA 33, NHS Digital 30, Historic England 18, DfT 7, JNCC 6, Canal & River
Trust 5, Lewisham 4, others 13. Most are national spatial layers whose metadata cannot say whether they hold
anything in the zone; the next step is a probe of their services (WFS hits and ArcGIS counts in the box, the "area
from the data" rule of the London Datastore walk). Datasets of high value for the zone are harvested through the
national adapters (`../national/`) or through planning.data.gov.uk (`../pdg/`), which re-serves several of them.

## Traps met

- "Poplar" is a tree: Forestry Commission short rotation coppice and Energy Crops records matched the zone place
  list. Zone places are read from the title and tags only, and not next to tree or crop words.
- Short slugs ("locks", "matrix", "find", "deaths") match project prose: a name counts as held only with 15+
  characters and a hyphen, or by its id.
- "Safeguarding" is also a planning word (airport and rail safeguarding areas): the sensitive rule asks for child or
  adult safeguarding.
- Deleted records keep their resources ("Deleted - moved to other existing datasets"): unavailable by title.
