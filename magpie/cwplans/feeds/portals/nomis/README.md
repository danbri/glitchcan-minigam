# Nomis: Census 2021 bulk downloads, walked for the zone

Source: https://www.nomisweb.co.uk/sources/census_2021_bulk (ONS Census 2021 topic summaries, OGL v3.0). Tool:
`tools/walk-portals.mjs nomis walk | triage | harvest` (adapter `tools/portals/nomis.mjs`). Walked 2026-10-04.

**Robots.txt** (read 2026-10-04): Nomis disallows `/query/`, `/api/v01/dataset/`, `/api/v01/codelist/` and
`/api/v01/concept/` for every agent. The Nomis API is therefore not used. The bulk zips under `/output/census/2021/`
are allowed: one zip per table holds CSVs for output areas up to countries (a second `-extra` zip holds other
geographies). Before robots.txt was read, two requests went to the API catalogue (`def.sdmx.json`, a probe and a download); the answer was
deleted and not used.

- `catalogue.json`: the 74 topic-summary tables of the bulk page (code, title, topic, zip links).
- `triage.json`: harvested 20, listed-for-harvest 54 (open, zone rows available, not in the first set).

## Harvested: output-area rows for the zone (1,509 OAs, 1.5 MB)

Tables: TS001 usual residents, TS003 household composition, TS004 country of birth, TS007A age (5-year bands),
TS011 deprivation dimensions, TS017 household size, TS021 ethnic group, TS029 English proficiency, TS030 religion,
TS037 general health, TS038 disability, TS044 accommodation type, TS045 car or van availability, TS050 bedrooms,
TS054 tenure, TS058 distance to work, TS061 method of travel to work, TS062 NS-SeC, TS066 economic activity,
TS067 highest qualification. Each file: `meta` (source, zip, CSV entry, licence, attribution, method, `columns`) and
`rows` (`[oa21, value, value, ...]`). A zone OA is an OA 2021 code carried by an ONSPD postcode in the box
(`../../london-datastore/zone-codes.json`). Join to LSOA, MSOA, ward and borough through `../onsgeo/oa21-lookup/`;
the OA polygons are `../onsgeo/oa21-boundaries/`.

The London Datastore walk already holds GLA census workbooks by ward and LSOA (`../../london-datastore/census2021-*`).
These OA rows are finer and come straight from the ONS release.
