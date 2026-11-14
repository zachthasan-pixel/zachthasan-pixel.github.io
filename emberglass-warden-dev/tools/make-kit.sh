#!/bin/bash
# Assembles the three portal submission folders. Run from the project folder after: EW_OUT=release node tools/build.mjs
set -e
D=14Nov2026; T=EmberglassWarden; P="$T"_"$D"
K="submission-kit/2026-11-14 Emberglass Warden"
mkdir -p "$K"; rm -rf "$K.tmp"; mkdir -p "$K.tmp"; W="$(pwd)/$K.tmp"; ROOT="$(pwd)"
mkdir -p "$W/1-itch.io/screenshots" "$W/2-Poki/screenshots-for-form" "$W/3-CrazyGames/UPLOAD-THESE-13-FILES_$D" "$W/3-CrazyGames/covers" "$W/3-CrazyGames/videos" "$W/4-Game-Files-and-Reports/Play-in-browser" "$W/4-Game-Files-and-Reports/Higgsfield-original-art" "$W/4-Game-Files-and-Reports/3D-models"
# itch
(cd release/itch && zip -q -r "$W/1-itch.io/${P}_itch-browser.zip" .)
rm -rf /tmp/ewdl && mkdir -p "/tmp/ewdl/Emberglass Warden" && cp release/itch-offline/* "/tmp/ewdl/Emberglass Warden/" && printf 'Emberglass Warden - offline edition\n\nOpen this folder and double-click index.html. The game runs in your web browser.\nNo installation and no internet connection are needed. Progress is saved in the browser.\n\nControls: WASD move, mouse look, left click slash (hold for heavy strike), right click block/parry,\nSpace dash, E Rift Burst, P pause, M mute.\n\n(c) 2026 Zahir Hasan\n' > "/tmp/ewdl/Emberglass Warden/README.txt"
(cd /tmp/ewdl && zip -q -r "$W/1-itch.io/${P}_itch-download.zip" "Emberglass Warden")
cp store-art/itch-cover-630x500.png "$W/1-itch.io/${P}_cover-630x500.png"
names=(first-wave spore-stingers rift-burst shard-brute rift-tyrant tyrant-duel)
for i in 1 2 3 4 5 6; do cp "store-art/screenshot-$i-1280x720.png" "$W/1-itch.io/screenshots/0$i-${names[$((i-1))]}.png"; done
# poki
j=1; for i in 2 3 5; do convert "store-art/screenshot-$i-1280x720.png" -quality 92 "$W/2-Poki/screenshots-for-form/0$j-${names[$((i-1))]}.jpg"; j=$((j+1)); done
cp store-art/poki-thumbnail-1024x1024.png "$W/2-Poki/${P}_poki-thumbnail-1024x1024.png"
(cd release/poki && zip -q -r "$W/2-Poki/${P}_poki-build.zip" .)
# crazygames
cp release/crazygames/* "$W/3-CrazyGames/UPLOAD-THESE-13-FILES_$D/"
for c in cover-landscape-1920x1080 cover-portrait-800x1200 cover-square-800x800; do cp "store-art/$c.png" "$W/3-CrazyGames/covers/${P}_$c.png"; done
for v in preview-landscape-1920x1080 preview-portrait-1080x1620; do cp "store-art/$v.mp4" "$W/3-CrazyGames/videos/${P}_$v.mp4"; done
# reports and sources
cp release/itch-offline/* "$W/4-Game-Files-and-Reports/Play-in-browser/"
cp DESIGN-BRIEF_$D.md TEST-REPORT_$D.md "$W/4-Game-Files-and-Reports/"
zip -q -r "$W/4-Game-Files-and-Reports/${P}_source-code.zip" src tools package.json package-lock.json DESIGN-BRIEF_$D.md -x 'tools/shot-*.png'
for f in assets/store/*.png; do cp "$f" "$W/4-Game-Files-and-Reports/Higgsfield-original-art/${P}_$(basename $f)"; done
for f in brute hilt stinger tyrant wraith; do convert "assets/concepts/$f.png" -quality 90 "$W/4-Game-Files-and-Reports/Higgsfield-original-art/${P}_concept-$f.jpg"; cp "assets/models/$f.glb" "$W/4-Game-Files-and-Reports/3D-models/${P}_$f.glb"; done
cp kit-src/ITCH-SUBMISSION-GUIDE_$D.md "$W/1-itch.io/"; cp kit-src/POKI-SUBMISSION-GUIDE_$D.md "$W/2-Poki/"; cp kit-src/CRAZYGAMES-SUBMISSION-GUIDE_$D.md "$W/3-CrazyGames/"; cp kit-src/00-START-HERE_$D.md "$W/"
rm -rf "$K"; mv "$K.tmp" "$K"
(cd submission-kit && rm -f "${P}_all-kits.zip" && zip -q -r "${P}_all-kits.zip" "2026-11-14 Emberglass Warden")
du -sh "$K" "submission-kit/${P}_all-kits.zip"
