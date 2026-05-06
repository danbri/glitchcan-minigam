#!/usr/bin/env bash
# Build biomorph.wasm from src/biomorph.c using clang's freestanding wasm32
# target. No emscripten / no libc required.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR/src/biomorph.c"
OUT="$SCRIPT_DIR/dist/biomorph.wasm"

mkdir -p "$SCRIPT_DIR/dist"

clang \
    --target=wasm32 \
    -O2 \
    -nostdlib \
    -fvisibility=hidden \
    -Wl,--no-entry \
    -Wl,--export-dynamic \
    -Wl,--allow-undefined \
    -Wl,--strip-all \
    -o "$OUT" \
    "$SRC"

echo "Built $OUT ($(wc -c < "$OUT") bytes)"
