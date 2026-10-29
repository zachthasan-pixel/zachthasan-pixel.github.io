#!/usr/bin/env bash
# Rebuild brinkball/game.js from src/ and package every storefront build.
# Plain concatenation inside one IIFE; no dependencies.
#   cd brinkball && ./build.sh
#
# Outputs
#   game.js                        web build (this site + itch.io), no ads
#   brinkball-browser.zip          itch.io "played in the browser" upload
#   brinkball-download.zip         itch.io offline download (adds README.txt, LICENSE.txt)
#   brinkball-crazygames.zip       CrazyGames upload (CrazyGames SDK v3, no rewarded ads)
#   brinkball-poki.zip             Poki for Developers upload (Poki SDK v2)
set -e
cd "$(dirname "$0")"
SRC=$(ls src/*.js | sort)
grep -q "^const PORTAL = 'web';$" src/00-portal.js || { echo "src/00-portal.js must declare: const PORTAL = 'web';"; exit 1; }

bundle() { # $1 = portal name, $2 = output file
  {
    echo "/* Brinkball (c) 2026 Dr. Zahir Hasan. Built from src/ by build.sh ($1) */"
    echo "(function () {"
    echo "'use strict';"
    cat $SRC | sed "s/^const PORTAL = 'web';$/const PORTAL = '$1';/"
    echo "})();"
  } > "$2"
  node --check "$2"
}
bundle web game.js
echo "built game.js ($(wc -c < game.js) bytes)"

FILES="index.html game.js style.css favicon.svg"
rm -f brinkball-browser.zip brinkball-download.zip brinkball-crazygames.zip brinkball-poki.zip
zip -q -X brinkball-browser.zip $FILES
tmp=$(mktemp -d)
mkdir "$tmp/brinkball"
cp $FILES "$tmp/brinkball/"
cp README-download.txt "$tmp/brinkball/README.txt"
cp LICENSE-download.txt "$tmp/brinkball/LICENSE.txt"
(cd "$tmp" && zip -q -X -r brinkball-download.zip brinkball)
mv "$tmp/brinkball-download.zip" .
rm -r "$tmp"

# Portal packages: same game, the portal's SDK loaded in <head> before game.js.
portal() { # $1 = portal name, $2 = SDK script URL
  local d; d=$(mktemp -d)
  bundle "$1" "$d/game.js"
  cp style.css favicon.svg "$d/"
  sed "s|<link rel=\"stylesheet\" href=\"style.css\">|<link rel=\"stylesheet\" href=\"style.css\">\n<script src=\"$2\"></script>|" index.html > "$d/index.html"
  grep -q "$2" "$d/index.html"
  (cd "$d" && zip -q -X "brinkball-$1.zip" $FILES)
  mv "$d/brinkball-$1.zip" .
  rm -r "$d"
}
portal crazygames https://sdk.crazygames.com/crazygames-sdk-v3.js
portal poki https://game-cdn.poki.com/scripts/v2/poki-sdk.js
echo "packaged brinkball-browser.zip, brinkball-download.zip, brinkball-crazygames.zip, brinkball-poki.zip"
