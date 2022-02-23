#!/bin/bash
cd "${0%/*}"
case $1 in
  format)
    find ./lib/* -type f -print0 | `which deno` fmt
    find ./canvas/lib/* -type f -print0 | `which deno` fmt
    find ./graph/lib/* -type f -print0 | `which deno` fmt
    ;;
  lock)
    deno cache --lock=lock.json --lock-write lib/deno.ts
    ;;
  start)
    deno run --allow-read --allow-net lib/deno.ts
    ;;
  bundle)
    deno bundle -c tsconfig.json canvas/lib/main.ts canvas/script/main.js
    cp canvas/script/main.js bundled/canvas.js
    deno bundle -c tsconfig.json graph/lib/main.ts graph/script/main.js
    cp graph/script/main.js bundled/graph.js
    deno bundle lib/manager.ts bundled/manager.js
    deno bundle --no-check lib/worker.ts bundled/worker.js
    deno run --allow-read --allow-write lib/bundle.ts
    ;;
  fix)
    deno run --allow-read --allow-write lib/bundle.ts
    ;;
  copy)
    cp -r bundled $2
esac
