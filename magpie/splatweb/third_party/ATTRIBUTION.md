# third_party — vendored open models

Everything in this directory is someone else's work, vendored with its
licence. **Ship the attribution wherever these render.** The browsable
version of this list, with licence links: [`../catalogue.html`](../catalogue.html).

| path | work | author | licence | source |
|---|---|---|---|---|
| `leeperrysmith/LeePerrySmith.glb` | 3D head scan | Lee Perry-Smith (Infinite Realities / triplegangers.com) | CC BY 3.0 Unported — see `LeePerrySmith_License.txt` | https://github.com/mrdoob/three.js/tree/master/examples/models/gltf/LeePerrySmith |
| `100avatars/100Avatars_004_OldMoustache.vrm` | rigged avatar | Polygonal Mind | **CC BY 4.0** — see `CCLicense.md` (the repo's own licence file; some catalogues wrongly say CC0) | https://github.com/polygonalmind/100Avatars |
| `100avatars/100Avatars_010_Froggy.vrm` | rigged avatar | Polygonal Mind | CC BY 4.0 | https://github.com/polygonalmind/100Avatars |
| `100avatars/100Avatars_042_Scarecrow.vrm` | rigged avatar | Polygonal Mind | CC BY 4.0 | https://github.com/polygonalmind/100Avatars |
| `100avatars/100Avatars_007_Observer.vrm` | rigged avatar | Polygonal Mind | CC BY 4.0 | https://github.com/polygonalmind/100Avatars |
| `100avatars/100Avatars_013_Mint.vrm` | rigged avatar | Polygonal Mind | CC BY 4.0 | https://github.com/polygonalmind/100Avatars |
| `100avatars/100Avatars_019_Wizzir.vrm` | rigged avatar | Polygonal Mind | CC BY 4.0 | https://github.com/polygonalmind/100Avatars |
| `100avatars/100Avatars_027_Astrodisco.vrm` | rigged avatar | Polygonal Mind | CC BY 4.0 | https://github.com/polygonalmind/100Avatars |
| `100avatars/100Avatars_048_Astronaut.vrm` | rigged avatar | Polygonal Mind | CC BY 4.0 | https://github.com/polygonalmind/100Avatars |
| `100avatars/100Avatars_069_Kyle.vrm` | rigged avatar | Polygonal Mind | CC BY 4.0 | https://github.com/polygonalmind/100Avatars |
| `100avatars/100Avatars_081_Toothpaste.vrm` | rigged avatar | Polygonal Mind | CC BY 4.0 | https://github.com/polygonalmind/100Avatars |
| `100avatars/100Avatars_088_Avocado.vrm` | rigged avatar | Polygonal Mind | CC BY 4.0 | https://github.com/polygonalmind/100Avatars |

| `lam-sample/skin.glb`, `lam-sample/offset.ply`, `lam-sample/vertex_order.json` | one-shot animatable Gaussian head avatar (rigged head mesh + trained per-vertex Gaussian splats) — a demo asset bundled by the model authors, not generated from any photo we supplied | aigc3d (SIGGRAPH 2025, "LAM: Large Avatar Model") | Apache-2.0 | https://github.com/aigc3d/LAM_WebRender (`asset/arkit/p2-1.zip`) |

LAM avatars generated (via the aigc3d/LAM model, self-hosted on a
HuggingFace Space) from synthetic (NOT a real person) source photos,
themselves public domain — no human author, algorithmically generated
(the same reasoning Wikimedia Commons applies via its "PD-algorithm" tag):

| path | work | author | licence | source |
|---|---|---|---|---|
| `lam-synth-faces/boy1/{offset.ply,skin.glb}` | LAM avatar generated from a synthetic face photo | source photo: Wikimedia Commons contributor, "own work"; avatar: aigc3d LAM model | Public domain (source photo, PD-algorithm); LAM model Apache-2.0 | source photo: https://commons.wikimedia.org/wiki/File:Boy_1.jpg |
| `lam-synth-faces/man2/{offset.ply,skin.glb}` | ″ | ″ | ″ | https://commons.wikimedia.org/wiki/File:Man_2.jpg |
| `lam-synth-faces/woman1/{offset.ply,skin.glb}` | ″ | ″ | ″ | https://commons.wikimedia.org/wiki/File:Woman_1.jpg |
| `lam-synth-faces/lightbrownhairwoman/{offset.ply,skin.glb}` | ″ | ″ | ″ | https://commons.wikimedia.org/wiki/File:Light_brown_hair_woman.jpg |
| `lam-synth-faces-tpdne/tpdne-01/offset.ply` … `tpdne-50/offset.ply` (+ shared `lam-sample/skin.glb`, via `meshBase`) | 50 LAM avatars generated from synthetic StyleGAN2 face photos | source photos: an archival scrape of thispersondoesnotexist.com, re-hosted as a dataset; avatar: aigc3d LAM model | Public domain (source photos, PD-algorithm) and MIT (dataset compilation); LAM model Apache-2.0 | source dataset: https://huggingface.co/datasets/javi22/this-person-does-not-exist-10k |

`dbdb-organic-csv/*.csv` — foliage splat data (fern, fern2, fern3, hedge,
vine) used as "hair" in the organic/ghost treatments, decimated + format-
converted from the dbdb pack's `garden` scene:

| work | author | licence | source |
|---|---|---|---|
| Botanical Garden Kiel, Victoria House (garden scene) | Simon Bethke | CC BY 4.0 | via `magpie/dbdb/splats/pack/` — see `magpie/dbdb/skills/splat-discovery` for full scene licensing |

`pentulpa-voices/` — 25 ElevenLabs text-to-speech clips (5 personas × 5
Toki Pona lines) for the Pentulpa Capulet character, generated (not
vendored third-party media, but AI-generated and documented the same
way): synthetic voices via ElevenLabs voice design + `eleven_multilingual_v2`
TTS, from the script at `../lib/pentulpa-voice-lines.js`. Not wired into
any demo yet. Full method, voice IDs, settings, and an honest
pronunciation-quality assessment: `pentulpa-voices/README.md`.

Not vendored (no direct-download link to automate): Quaternius packs
(CC0, https://quaternius.com/) — add manually if wanted.

`lib/three-layer.js` (the compositor's three.js layer, `demo-compositor.html`)
imports the repo-shared `third_party/three/three.module.min.js` (three.js,
MIT licence, Three.js Authors) — not duplicated into this folder; same
vendored copy `trees/vendor/` and others already use.
