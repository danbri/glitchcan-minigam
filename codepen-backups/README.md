# CodePen Backups — danbri

Mirror target for https://codepen.io/danbri/ pens.

## Status (June 2026)

**Index: complete (from in-repo references). Content mirror: pending.**
This repository's remote execution environment cannot reach codepen.io (Cloudflare
403 on profile, pen pages, RSS, and the `share/zip` export endpoint) and the egress
policy also blocks web.archive.org, so pen source could not be fetched here.
Run `./mirror-codepens.sh` from an unrestricted machine to populate `pens/`.

## Pen index

Eleven pens are referenced from this repo (`inklet/media/shane/minigames.md` and the
FINK TOC Experiments menu, `inklet/toc.fink.js:230-263`). The live profile may have
more — the mirror script fetches whatever is listed in `slugs.txt`, so extend that
file after checking the profile.

| Slug | Title / description (from repo notes) | Related code in repo |
|------|----------------------------------------|----------------------|
| `ZYGQzpG` | ED-209 parking bot "dejanking" test | `gencity/ed209-parkbot.html` |
| `JodGOOa` | Rockall UI early tests | — (no in-repo counterpart) |
| `bNdpbBx` | Rockall mocks — Asteroids-inspired crafting game scaling to lagrangians/dyson spheres | `schemoids/`, `thumbwar/battleboids.html` (related asteroid lineage) |
| `azOvvGX` | Mamikon Mini-Chess (Queen-sacrifice move not yet accepted) | `thumbwar/minichess.html`, `inklet/finkapp/chess.minigam.js` |
| `raVaWBm` | Tankoff | `trees/` tank-interface experiments (Bristol) |
| `Byymzyd` | INK + video test A | `inklet/` VIDEO tag support, `cozyverse/maple-hollow.fink.js` |
| `NPPwpjZ` | INK + video test B | same as above |
| `YPPBjdw` | Rock Paper Boids | `thumbwar/battleboids.html` |
| `NPqGjLP` | Emoji particles | front-page animation idea (`inklet/media/shane/minigames.md:17`) |
| `PwwEVMZ` | Hobbit/Bagend SVG visuals | `inklet/media/bagend/` SVGs, `inklet/bagend.fink.js` |
| `QwdBKbE` | ROBBIN cut-paper birds in 3D | mirrored in `pens/QwdBKbE/` (owner pasted the source); ported to `magpie/robbin/robbin3d.html` (vendored three, no CDN) |
| `QwbbaaY` | Mock login (Steam/Discord/Mastodon) | infra prototype — relates to `PEER_ARCHITECTURE_DESIGN.md` service-layer Auth ideas |

## Why this matters to the repo

The FINK dev guide (`toc.fink.js`) tells players: "Most experiments are hosted on
CodePen for rapid prototyping and easy sharing." CodePen is therefore part of this
project's *primary* prototyping pipeline — several shipped features (mini-chess, boids,
video-in-INK, bagend SVGs, ED-209) graduated from these pens into the repo. Backing
them up preserves the provenance chain.

## Mirroring

```
./mirror-codepens.sh            # fetches each slug's zip export into pens/<slug>/
```

The script tries, per slug:
1. `https://codepen.io/danbri/share/zip/<slug>` (official zip export)
2. Pen page scrape fallback (extracts embedded JSON `__item` payload)

Each pen lands in `pens/<slug>/` as `index.html`, `style.css`, `script.js` plus
`pen.json` metadata. Re-run is idempotent (skips already-mirrored slugs).
