# Emberglass Warden — CrazyGames submission guide (14 Nov 2026)

Source: written from CrazyGames' developer docs (researched 13 Nov 2026) and the field order checked on the live form on 24 Oct 2026 for an earlier game. Labels on screen may differ slightly. Start at https://developer.crazygames.com → My Games → Submit a game.

Do this portal LAST. CrazyGames warns that repeated non-compliant submissions can restrict an account, and it rejected Infinite Loot Goblin for overall quality on 25 Oct 2026.

## Files in this folder

| File | What it is for |
|---|---|
| UPLOAD-THESE-13-FILES_14Nov2026/ | The loose game files (CrazyGames SDK build). Drag all 13 together. Never a zip |
| covers/EmberglassWarden_14Nov2026_cover-landscape-1920x1080.png | Landscape cover |
| covers/EmberglassWarden_14Nov2026_cover-portrait-800x1200.png | Portrait cover |
| covers/EmberglassWarden_14Nov2026_cover-square-800x800.png | Square cover |
| videos/EmberglassWarden_14Nov2026_preview-landscape-1920x1080.mp4 | Landscape preview video |
| videos/EmberglassWarden_14Nov2026_preview-portrait-1080x1620.mp4 | Portrait preview video |

## Quality gate (status on 14 Nov 2026)

| Requirement | Status |
|---|---|
| Gameplay within one click | Yes — PLAY starts wave 1 |
| English text | Yes |
| Readable at 800x450 and 907x510 | Yes — screenshots checked at all CrazyGames sizes |
| Same speed at 60, 144 and 165 Hz | Yes — measured identical |
| No custom fullscreen button | Yes |
| No rewarded or revive buttons | Yes — none in the game |
| No external links, cross-promotion or ads | Yes |
| PEGI 12 | Yes — fantasy creatures, no blood |
| Initial download under 20 MB | Yes — about 6 MB, 13 files |
| Progress saved | Yes — LocalStorage |
| SDK v3: loading, gameplay start/stop, happytime, mute setting | Yes — event order checked by automated test with a stand-in SDK |
| Covers with title only | Yes |
| Videos 15–20 s, silent, open on cover frame, under 50 MB | Yes |
| Chrome, Edge, Safari, 4 GB Chromebook, a real phone | NOT tested here — please try the itch page on your Mac (Safari and Chrome) and your phone first |

## Step 1 — Upload

| # | Field on screen | What to do |
|---|---|---|
| 1 | Game name | `Emberglass Warden` |
| 2 | Game engine | HTML5 |
| 3 | Upload files | Open `UPLOAD-THESE-13-FILES_14Nov2026`, select all 13 files, drag them in together. Wait for a green cloud on every row |
| 4 | Does your game save progress | Yes, using LocalStorage |
| 5 | Game options → supports mobile devices | Tick |
| 6 | Mobile orientation | Landscape |
| 7 | Game options → online multiplayer | Untick |
| 8 | Game options → supports CrazyGames muting audio through SDK | Tick |
| 9 | Bottom | Save, then **Go to QA** |

## Step 2 — QA

1. On the preview page click PLAY, clear two waves, press P to pause, resume, let yourself be defeated, press FIGHT AGAIN.
2. Open the Log tab: you should see sdkInit, loading start and stop, gameplayStart and gameplayStop. Click Continue.

| # | Checklist line | Answer |
|---|---|---|
| 1 | Initial download size under 50MB | Automatic |
| 2 | First gameplay start | Automatic |
| 3 | First gameplay start implemented correctly | Yes |
| 4 | Complies to Gameplay requirements | Yes |
| 5 | Runs on all CrazyGames domains | Yes |
| 6 | Browser checks | Yes |
| 7 | Device checks, Mobile | Click Show QR, play on your phone, then Yes |
| 8 | No external ads | Yes |
| 9 | Does not offer external login options | Yes |
| 10 | In-game mention of Terms & Conditions and/or Privacy Policy | N/A |
| 11 | "I confirm that these results are correct" | Tick, then Continue |

## Step 3 — Details

| # | Field on screen | What to do |
|---|---|---|
| 1 | Category | Action |
| 2 | Tags (up to 5) | Sword, First Person, 3D, Survival, Monster. If one is missing use Fighting or Arena |
| 3 | Description | Paste box A |
| 4 | Controls | Paste box B |
| 5 | Which tools did you use | Tick Claude. Tick Higgsfield if listed; otherwise type `Higgsfield (concept art, 3D models, cover art)` in Other |
| 6 | Google Play Store link and downloads | Leave empty |
| 7 | iOS App Store link and downloads | Leave empty |
| 8 | Steam link | Leave empty |
| 9 | Marketing creatives URL | Leave empty |
| 10 | Cover images → Landscape | Upload the 1920x1080 cover; in "Crop to ratio" click Submit |
| 11 | Cover images → Portrait | Upload the 800x1200 cover; Submit |
| 12 | Cover images → Square | Upload the 800x800 cover; Submit |
| 13 | Preview videos → Landscape | Upload the 1920x1080 mp4; wait for the thumbnail |
| 14 | Preview videos → Portrait | Upload the 1080x1620 mp4; wait for the thumbnail |
| 15 | Mobile orientation | Shown as Landscape; leave |
| 16 | The game works well in fullscreen | Tick |
| 17 | Bottom | **Save and continue to last step** (do not reload the page before this) |

## Step 4 — Submit

Read the summary and click **Submit**. The answer comes by email in a few days. If it is rejected, send me the exact wording and do not resubmit the same build.

## If something looks wrong

| What you see | Cause | Fix |
|---|---|---|
| "Archive files are not supported" | A zip was dropped | Drag the 13 loose files instead |
| "Incorrect image dimensions" | Image was resized on the way | Use the file straight from this folder |
| Rows keep spinning | Upload stalled | Wait; then Delete all files, reload, drag again |
| Log shows no gameplayStart | PLAY was not clicked | Click PLAY in the preview |

## Paste boxes

A — Description
```
You are the last Warden of the Emberglass Rift. Ignite your saber and hold the arena against the beasts pouring out of the rift.

Slash in three-hit combos, charge a heavy strike to crack armour, and raise your guard at the last instant to parry and stun. Cut glowing spores out of the air and send them back at the beast that fired them. Dash through a Tyrant's charge, then release your Rift Burst to clear the ring.

After every wave choose one of three upgrades and build a different Warden each run. Spend the shards you earn in the Armory on permanent upgrades, climb the ranks, unlock new blade colours, and come back for a new Daily Trial every day. How deep into the rift can you go?
```

B — Controls
```
Move: WASD or arrow keys
Look: mouse
Slash: left mouse button
Heavy strike: hold left mouse button, then release
Block / parry: right mouse button
Dash: Space or Shift
Rift Burst: E
Pause: P
Mute: M
On phones and tablets: left stick to move, drag to look, and the SLASH, BLOCK, DASH and BURST buttons.
```
