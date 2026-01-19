# Hampstead Story Graph Analysis

## Core Structure

The Hampstead episode centers on a densely interconnected "main loop" of locations that give players significant freedom of movement:

- **street** / **street_shameful** (the primary hubs)
- **jobcentre**, **oxfam**, **pub**
- **car**, **housewarming**, **diamond_pub_attempt**
- **gallery_pass**

Most nodes in this cluster can reach most others, creating an open-world feel within the episode. The player can wander, revisit locations, and encounter content in varying orders.

## Linear Sequences

Branching off from the main loop are more directed narrative paths:

- **Opening**: splash → intro → bedsit → wardrobe (and out to street)
- **Gallery/mansion arc**: gallery_pass → mansion_tip → mansion
- **Diamond gallery ending**: diamond_gallery_exhibit → diamond_opening → one_week_later → artist_confrontation
- **Artist resolution**: artist_challenge → artist_reveal → world_between_worlds
- **World ending**: world_between_worlds ↔ world_rest → world_end

## Apparent Islands (Easter Eggs / Cross-Episode Links)

Several knots have no incoming edges within this episode's graph:

| Knot | Likely Purpose |
|------|----------------|
| **postoffice** | Entry point from another episode or game menu |
| **giro_fraud_video** | Triggered by condition/tunnel, or external link |
| **estate** | External entry (arriving with assets from elsewhere?) |
| **artist_confrontation** / **artist_challenge** | Mid-sequence entries for players joining from other episodes |
| **pool_bagend**, **pool_mines**, **pool_manor**, **pool_maple**, **pool_riverbend** | Portals from other Fink episodes feeding into world_between_worlds |

These "islands" are intentional design—they're seams where the Fink web connects. A player might arrive at Hampstead carrying a diamond from another episode, entering via **diamond_pub_attempt** or **estate** with new risks and opportunities that wouldn't exist for a player who started at **splash**.

## FINK Infrastructure Notes

FINK wraps INK in JSONP-style JavaScript, allowing stories to be pulled dynamically from any cooperating site. This enables:

- **Decentralised narrative**: Episodes hosted across different domains can link to each other
- **Multiversical continuity**: Player state (inventory, flags, reputation) can travel between episodes
- **Distributed authorship**: Different creators can build episodes that interconnect

## Crawling the FINK Web

For admin/tooling purposes, crawling the FINK web means:

1. **Detecting islands**: Knots with no internal predecessors are likely external entry points
2. **Mapping cross-episode seams**: Which knots expect incoming state? Which export players elsewhere?
3. **Validating connectivity**: Ensuring players can't get permanently stuck (unless intended)
4. **Discovering emergent story opportunities**: When two episodes link unexpectedly, what new narratives become possible?

## Related Documentation

- [FINK Crawl Report](./fink-crawl-report.md) - Auto-generated knot connectivity data
- [3D/Lucid Design Docs](./3d-design-notes.md) - Visual rendering architecture (if exists)
