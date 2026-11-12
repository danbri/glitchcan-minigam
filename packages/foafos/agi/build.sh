#!/bin/sh
# Build the example handlers: C to WebAssembly that imports only env.memory and exports alloc and run.
# Needs a clang that targets wasm32 (emscripten's, or LLVM's): CLANG=/path/to/clang ./build.sh
set -e
cd "$(dirname "$0")"
CLANG="${CLANG:-clang}"
for h in md2html feed; do
  "$CLANG" --target=wasm32 -O2 -nostdlib -ffreestanding -Wall -Werror -Wl,--no-entry -Wl,--import-memory \
    -Wl,--export=alloc -Wl,--export=run -o "$h.wasm" "$h.c"
  echo "$h.wasm $(wc -c < "$h.wasm") bytes"
done
