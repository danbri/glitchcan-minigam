#!/usr/bin/env python3
# lam-generate.py — batch-convert 2D face photos into LAM Gaussian-splat
# avatars (offset.ply) via a self-hosted LAM HuggingFace Space
# (aigc3d/LAM, SIGGRAPH 2025, Apache-2.0 — https://github.com/aigc3d/LAM).
# Generalized from the one-off scripts used to generate this project's
# `third_party/lam-synth-faces*/` roster — see
# magpie/splatweb/skills/lam-face-pipeline for the full pipeline (source
# selection, curation, attribution, ethics) this tool is one step of.
#
#   pip install gradio_client
#   huggingface-cli login   # writes ~/.cache/huggingface/token
#   python3 tools/lam-generate.py --images ./my-faces --out ./my-offsets
#
# Resumable: re-running skips names already marked ok in
# <out>/batch_results.json, so a batch interrupted partway (network drop,
# Space cold-start timeout) just picks up where it left off.
#
# ONE call to /core_fn takes ~27-30s (measured generating 50 faces, Sept
# 2026) — budget ~25-30 minutes for a 50-face batch, and don't parallelize
# against the same Space instance (it processes one request at a time; the
# gradio_client queues but concurrent calls just wait in line for no
# speedup).
import argparse
import json
import os
import shutil
import time
from pathlib import Path

from gradio_client import Client, handle_file


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--images', required=True, help='directory of source .jpg photos, one avatar per file')
    ap.add_argument('--out', required=True, help='output directory for <name>.offset.ply (+ .preview.png)')
    ap.add_argument('--space', default='danbri/LAM-export', help='HF Space repo id running the LAM model')
    ap.add_argument('--token-file', default=os.path.expanduser('~/.cache/huggingface/token'),
                     help='file containing your HF token (never pass the token on the command line — it ends up in shell history)')
    ap.add_argument('--save-preview', action='store_true', help='also copy the processed preview PNG')
    args = ap.parse_args()

    token = Path(args.token_file).read_text().strip()
    client = Client(args.space, token=token)

    images = sorted(Path(args.images).glob('*.jpg'))
    if not images:
        raise SystemExit(f'no .jpg files found in {args.images}')

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    results_path = out_dir / 'batch_results.json'
    results = json.loads(results_path.read_text()) if results_path.exists() else {}

    # ONE motion driver, reused for every face: it only drives the preview
    # VIDEO, not the identity/geometry baked into offset.ply, so there is
    # no reason to re-fetch it per face. Index 6 was the driver used for
    # this project's own roster — swap it for a different /load_example_N
    # if you want a different preview motion (verify by eye — the Space's
    # example indices aren't documented anywhere else).
    vid = client.predict(6, api_name='/load_example_1')
    vid_path = vid['value']['video']

    t_all = time.time()
    todo = [p for p in images if not results.get(p.stem, {}).get('ok')]
    print(f'{len(images)} images, {len(todo)} to do ({len(images) - len(todo)} already ok in {results_path})')

    for idx, img_path in enumerate(todo, 1):
        name = img_path.stem
        print(f'=== [{idx}/{len(todo)}] {name} ===', flush=True)
        client.predict(api_name='/prepare_working_dir')
        t0 = time.time()
        try:
            result = client.predict(
                handle_file(str(img_path)),
                {'video': handle_file(vid_path), 'subtitles': None},
                api_name='/core_fn',
            )
            dt = round(time.time() - t0, 1)
            if result and len(result) >= 3 and result[2]:
                shutil.copy(result[2], out_dir / f'{name}.offset.ply')
            else:
                raise RuntimeError(f'no offset.ply in response: {result!r}')
            if args.save_preview and result[0]:
                preview = result[0]['path'] if isinstance(result[0], dict) else result[0]
                shutil.copy(preview, out_dir / f'{name}.preview.png')
            results[name] = {'ok': True, 'seconds': dt}
            print(f'  ok, {dt}s, total elapsed {round(time.time() - t_all)}s', flush=True)
        except Exception as e:
            dt = round(time.time() - t0, 1)
            results[name] = {'ok': False, 'seconds': dt, 'error': str(e)}
            print(f'  ERROR after {dt}s: {e!r}', flush=True)
        results_path.write_text(json.dumps(results, indent=2))

    ok_count = sum(1 for r in results.values() if r['ok'])
    print(f'\nDONE: {ok_count}/{len(images)} ok, total {round(time.time() - t_all)}s')


if __name__ == '__main__':
    main()
