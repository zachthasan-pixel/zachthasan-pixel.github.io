#!/usr/bin/env bash
# Rebuild lootgoblin/game.js from src/ and package every storefront build.
# Plain concatenation inside one IIFE; no dependencies.
#   cd lootgoblin && ./build.sh
#
# Outputs
#   game.js                      web build (this site + itch.io), no ads
#   lootgoblin-browser.zip       itch.io "played in the browser" upload
#   lootgoblin-download.zip      itch.io offline download
#   lootgoblin-crazygames.zip    CrazyGames upload (CrazyGames SDK v3)
#   lootgoblin-poki.zip          Poki for Developers upload (Poki SDK v2)
set -e
cd "$(dirname "$0")"
SRC="src/00-portal.js src/01-core.js src/02-sprites.js src/03-loot.js src/04-game.js src/05-render.js src/06-ui.js"
grep -q "^const PORTAL = 'web';$" src/00-portal.js || { echo "src/00-portal.js must declare: const PORTAL = 'web';"; exit 1; }

bundle() { # $1 = portal name, $2 = output file
  {
    echo "/* Infinite Loot Goblin: One-Button Dungeon — (c) 2026 Dr. Zahir Hasan. Built from src/ by build.sh ($1) */"
    echo "(function () {"
    echo "'use strict';"
    cat $SRC | sed "s/^const PORTAL = 'web';$/const PORTAL = '$1';/"
    echo "})();"
  } > "$2"
  node --check "$2"
}
bundle web game.js
echo "built game.js ($(wc -c < game.js) bytes)"

# itch.io packages
rm -f lootgoblin-browser.zip lootgoblin-download.zip lootgoblin-crazygames.zip lootgoblin-poki.zip
zip -q -X lootgoblin-browser.zip index.html game.js style.css favicon.svg
tmp=$(mktemp -d)
mkdir "$tmp/infinite-loot-goblin"
cp index.html game.js style.css favicon.svg LICENSE-fonts.txt "$tmp/infinite-loot-goblin/"
cp README-download.txt "$tmp/infinite-loot-goblin/README.txt"
cp LICENSE-download.txt "$tmp/infinite-loot-goblin/LICENSE.txt"
(cd "$tmp" && zip -q -X -r lootgoblin-download.zip infinite-loot-goblin)
mv "$tmp/lootgoblin-download.zip" .
rm -r "$tmp"

# Portal packages: same game, the portal's SDK loaded in <head> before game.js.
portal() { # $1 = portal name, $2 = SDK script URL
  local d; d=$(mktemp -d)
  bundle "$1" "$d/game.js"
  cp style.css favicon.svg "$d/"
  sed "s|<link rel=\"stylesheet\" href=\"style.css\">|<link rel=\"stylesheet\" href=\"style.css\">\n<script src=\"$2\"></script>|" index.html > "$d/index.html"
  grep -q "$2" "$d/index.html"
  (cd "$d" && zip -q -X "lootgoblin-$1.zip" index.html game.js style.css favicon.svg)
  mv "$d/lootgoblin-$1.zip" .
  rm -r "$d"
}
portal crazygames https://sdk.crazygames.com/crazygames-sdk-v3.js
portal poki https://game-cdn.poki.com/scripts/v2/poki-sdk.js
echo "packaged lootgoblin-browser.zip, lootgoblin-download.zip, lootgoblin-crazygames.zip, lootgoblin-poki.zip"
