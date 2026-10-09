#!/usr/bin/env bash
# Rebuild lootgoblin/game.js from src/ (plain concatenation inside one IIFE; no dependencies).
#   cd lootgoblin && ./build.sh
set -e
cd "$(dirname "$0")"
{
  echo "/* Infinite Loot Goblin: One-Button Dungeon — (c) 2026 Dr. Zahir Hasan. Built from src/ by build.sh */"
  echo "(function () {"
  echo "'use strict';"
  cat src/01-core.js src/02-sprites.js src/03-loot.js src/04-game.js src/05-render.js src/06-ui.js
  echo "})();"
} > game.js
node --check game.js
echo "built game.js ($(wc -c < game.js) bytes)"
# itch.io packages
rm -f lootgoblin-browser.zip lootgoblin-download.zip
zip -q -X lootgoblin-browser.zip index.html game.js style.css favicon.svg
tmp=$(mktemp -d)
mkdir "$tmp/infinite-loot-goblin"
cp index.html game.js style.css favicon.svg LICENSE-fonts.txt "$tmp/infinite-loot-goblin/"
cp README-download.txt "$tmp/infinite-loot-goblin/README.txt"
cp LICENSE-download.txt "$tmp/infinite-loot-goblin/LICENSE.txt"
(cd "$tmp" && zip -q -X -r lootgoblin-download.zip infinite-loot-goblin)
mv "$tmp/lootgoblin-download.zip" .
rm -r "$tmp"
echo "packaged lootgoblin-browser.zip and lootgoblin-download.zip"
