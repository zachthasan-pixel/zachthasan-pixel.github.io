#!/usr/bin/env bash
# Rebuild earthfall/game.js from src/. Requires Node 18+.
#   cd earthfall && ./build.sh
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || npm install --no-audit --no-fund three@0.186 esbuild@latest topojson-client@3 world-atlas@2
npx esbuild src/main.js --bundle --minify --format=iife --target=es2019 --outfile=game.js --loader:.json=json
cp src/index.html src/style.css src/favicon.svg .
echo "built game.js"
