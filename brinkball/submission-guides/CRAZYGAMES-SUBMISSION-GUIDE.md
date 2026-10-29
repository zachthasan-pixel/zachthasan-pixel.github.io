# Brinkball: CrazyGames submission guide

Written from the CrazyGames developer form as it was on 2026-10-24 (the Loot Goblin submission) and CrazyGames' requirements docs, re-read on 2026-10-29. Labels on screen may differ slightly.

## Quality gate: confirm every line before you submit

CrazyGames turned down Infinite Loot Goblin for "overall quality" and warns that repeated non-compliant submissions can restrict an account. Brinkball was built and tested against these:

| Requirement | Brinkball |
|---|---|
| Lands in gameplay within one click | First visit: straight into a warm-up match. Afterwards: PLAY on the menu. ✔ |
| English text | ✔ |
| Readable at 800x450 and 907x510 | Checked at all 10 CrazyGames test sizes ✔ |
| Physics identical at 144/165 Hz | Fixed 1/120 s physics step ✔ |
| No custom fullscreen button | ✔ (CrazyGames provides fullscreen) |
| No rewarded or revive buttons during Basic Launch | The CrazyGames build has none ✔ |
| No external links, cross-promotion or ads | ✔ |
| PEGI 12 | Cute balls bumping each other, no violence or blood ✔ |
| Works in Chrome, Edge, Safari, on phones and on a 4 GB Chromebook | Canvas 2D, about 150 KB, light CPU ✔ |
| Initial download under 20 MB (mobile homepage) | About 150 KB ✔ |
| Progress saved | LocalStorage (rank, coins, cosmetics, missions, streak) ✔ |
| Covers: title only, kept out of the top-left label zone | ✔ |
| Videos 15 to 20 s, silent, open on the cover frame | ✔ |
| CPU rivals clearly labelled, nothing pretends to be online | Mode says "Solo vs 7 CPU rivals"; the kill feed shows a CPU badge ✔ |

## Files in this folder

| File | What it is for |
|---|---|
| `UPLOAD-THESE-4-FILES/` | `index.html`, `game.js`, `style.css`, `favicon.svg`. Drag the four loose files in together, **not a zip**. |
| `covers/cover-landscape-1920x1080.png` | Landscape cover |
| `covers/cover-portrait-800x1200.png` | Portrait cover |
| `covers/cover-square-800x800.png` | Square cover |
| `videos/preview-landscape-1920x1080.mp4` | Landscape preview (silent, opens on the cover) |
| `videos/preview-portrait-1080x1620.mp4` | Portrait preview (silent, opens on the cover) |

Start at https://developer.crazygames.com, then **My Games**, then **Submit a game**.

## Step 1: Upload

| # | Field | What to do |
|---|---|---|
| 1 | Game name | `Brinkball` |
| 2 | Game engine | HTML5 |
| 3 | Upload files | Open `UPLOAD-THESE-4-FILES/`, select all 4 files, drag them in together. Wait until every row shows the green cloud icon. |
| 4 | Does your game save progress? | Yes, using LocalStorage |
| 5 | Game options: The game supports mobile devices | Tick |
| 6 | Mobile orientation | Both |
| 7 | The game supports online multiplayer | Leave unticked (2 players is local, on one device) |
| 8 | The game supports CrazyGames muting audio through the SDK | Tick (wired in) |
| 9 | | **Save**, then **Go to QA** |

## Step 2: QA

1. On the preview page, play a full match: the warm-up, then a Royale. Press Play Again once and pause once.
2. Open the **Log** tab and check you see: sdkInit, loadingStart, loadingStop, gameplayStart, gameplayStop, and requestAd midgame after Play Again (it shows nothing during Basic Launch, which is normal).
3. Click **Continue**. Answer the QA checklist (each answer needs a real click):

| # | Question | Answer |
|---|---|---|
| 1 | Initial download size under 50MB | (automatic) |
| 2 | First gameplay start | (automatic) |
| 3 | First gameplay start implemented correctly | Yes |
| 4 | Complies to Gameplay requirements | Yes |
| 5 | Runs on all CrazyGames domains | Yes |
| 6 | Browser checks | Yes |
| 7 | Device checks: Mobile | Click **Show QR**, play on your phone, then **Yes** |
| 8 | No external ads | Yes |
| 9 | Does not offer external login options | Yes |
| 10 | In-game mention of Terms & Conditions and/or Privacy Policy | N/A (no personal data is collected) |
| 11 | I confirm that these results are correct | Tick, then **Continue** |

## Step 3: Details

| # | Field | What to do |
|---|---|---|
| 1 | Category | **Casual** (or **Action** if Casual isn't offered) |
| 2 | Tags (up to 5, from their list) | Pick the closest matches to: `2 Player`, `Physics`, `Ball`, `Arcade`, `Cute` |
| 3 | Description | Paste **Box A** |
| 4 | Controls | Paste **Box B** |
| 5 | Which tools did you use | Tick **Claude** (and any image-AI option for the covers, if listed) |
| 6 | Google Play Store / iOS App Store / Steam links and download counts | Leave empty |
| 7 | Marketing creatives URL | Leave empty |
| 8 | Cover images: Landscape | Upload `covers/cover-landscape-1920x1080.png`. In the "Crop to ratio" window, click **Submit** without moving anything. |
| 9 | Cover images: Portrait | `covers/cover-portrait-800x1200.png`, then Submit |
| 10 | Cover images: Square | `covers/cover-square-800x800.png`, then Submit |
| 11 | Preview videos: Landscape | `videos/preview-landscape-1920x1080.mp4` (wait for the thumbnail) |
| 12 | Preview videos: Portrait | `videos/preview-portrait-1080x1620.mp4` |
| 13 | Mobile orientation | (shown; set in Step 1) |
| 14 | The game works well in fullscreen | Tick |
| 15 | | **Save and continue to last step** (don't reload the page before this) |

## Step 4: Submit

Read the summary, then click **Submit**. CrazyGames replies by email, usually within a few days. New games start in **Basic Launch** with ads off. If they ask for changes, send Claude the exact wording; don't resubmit the same build.

## If something looks wrong

| Symptom | Cause | Fix |
|---|---|---|
| "Archive files are not supported" | A zip was dropped | Drag the 4 loose files from `UPLOAD-THESE-4-FILES/` |
| "Incorrect image dimensions" | The image was resized on the way (for example, opened and re-saved by a preview app) | Use the file straight from the kit zip |
| Upload rows stuck spinning | Slow upload | Wait; once nothing spins, Delete all files, reload, and drag again |
| No gameplayStart in the Log | You didn't press a key or tap yet | It fires on your first input, by design |

## Paste boxes

**Box A: description**
```
Brinkball is a physics knockout brawler. Dash and bonk your rivals off a floating arena that crumbles away beneath you. The more hits a ball takes, the hotter it glows and the further it flies. Last one standing wins!

Play Royale against 7 CPU rivals and climb from Bronze to Legend: the CPU gets sharper as you rank up. Challenge a friend in 2 Player mode on the same keyboard or tablet, or take on the Daily Challenge with a new arena and twist every day.

Features:
- Hold to charge a dash for a massive knockback
- 4 abilities to unlock: Shockwave, Anchor, Blink and Magnet
- 6 arenas with their own rules: Meadow, Pinball, Glacier, Sweeper, Islands and Volcano
- Power-ups: Mega, Turbo, Spikes and Shield
- 14 skins and 10 hats, daily missions and a daily gift
```

**Box B: controls**
```
Move: WASD, the arrow keys or the mouse
Dash: Space or left click (hold to charge)
Ability: E, Shift or right click
Pause: P
Mobile: drag on the left side to move, tap DASH (hold to charge) and the ability button
2 players: P1 uses WASD + Space + E, P2 uses the arrow keys + Enter + Right Shift
Gamepad: left stick, A to dash, X or B for the ability
```
