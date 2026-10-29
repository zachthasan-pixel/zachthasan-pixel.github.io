# Brinkball: itch.io submission guide

Written from the itch.io form as it was on 2026-10-24 and 2026-10-26 (the Magnetic Chaos and Loot Goblin uploads) and itch.io's HTML5 docs, re-read on 2026-10-29. Labels on screen may differ slightly.

## Files in this folder

| File | What it is for |
|---|---|
| `brinkball-browser.zip` | The game played on the page (`index.html` is at the zip root) |
| `brinkball-download.zip` | The same game plus README.txt and LICENSE.txt, for offline play |
| `cover-630x500.png` | Cover image (itch's recommended size) |
| `screenshots/01-…png` to `05-…png` | Screenshots, in upload order |

Account: **ZachsterA3**. Start at https://itch.io/game/new

## Screen 1: "Create a new project"

| # | Field on screen | What to do |
|---|---|---|
| 1 | Title | `Brinkball` |
| 2 | Project URL | Keep the suggestion (`zachstera3.itch.io/brinkball`) |
| 3 | Short description or tagline | Paste **Box A** |
| 4 | Classification | Games |
| 5 | Kind of project | HTML |
| 6 | Release status | Released |
| 7 | Pricing | **$0 or donate** (recommended), suggested donation $2. To sell the offline download instead, see row 9. |
| 8 | Uploads, first file | Upload `brinkball-browser.zip`. Tick **This file will be played in the browser**. Leave every platform box unticked. |
| 9 | Uploads, second file | Upload `brinkball-download.zip`. Leave "played in the browser" **unticked**. Tick **Windows**, **macOS** and **Linux** (not Android). Click the pencil/edit icon: Display name = paste **Box B**. If you chose Paid, set this row's price here. |
| 10 | Install instructions (box under the uploads) | Paste **Box C** |
| 11 | Embed options: how should your project be run in your page? | **Embed in page** |
| 12 | Viewport dimensions | `960` × `540` |
| 13 | Frame options: Mobile friendly | Tick. Orientation: **Default** (it plays in both) |
| 14 | Frame options: Automatically start on page load | Leave unticked |
| 15 | Frame options: Fullscreen button | Tick |
| 16 | Frame options: Enable scrollbars | Leave unticked |
| 17 | SharedArrayBuffer support | Leave unticked |
| 18 | Details: Description | Paste **Box D** |
| 19 | Genre | Action |
| 20 | Tags | Type each and press Enter: `physics`, `local-multiplayer`, `2-player`, `party`, `arcade`, `cute`, `casual`, `sumo`, `brawler`, `singleplayer` |
| 21 | AI generation disclosure | **Yes**. Tick **Code** and **Graphics** (store covers made on Higgsfield). Leave Sound unticked (the sound is synthesised by code, so it counts under Code). |
| 22 | App store links | Leave empty |
| 23 | Custom noun | Leave empty |
| 24 | Community | Comments |
| 25 | Visibility & access | **Draft** for now |
| 26 | Right column: Cover image | Upload `cover-630x500.png` |
| 27 | Gameplay video or trailer | Leave empty (the MP4s are in the CrazyGames folder; itch wants a YouTube or Vimeo link) |
| 28 | Screenshots | Upload `screenshots/01` to `05` in number order |
| 29 | Bottom | **Save & view page** |

## Screen 2: "Edit game", Metadata tab

| # | Field | What to do |
|---|---|---|
| 1 | Release date | Today |
| 2 | Made with | `HTML5` |
| 3 | Average session | A few minutes |
| 4 | Languages | English |
| 5 | Inputs | Keyboard, Mouse, Touchscreen, Gamepad (any) |
| 6 | Accessibility | Leave as is |
| 7 | Multiplayer | Local multiplayer (if shown); Number of players: 1 to 2 |
| 8 | Links | Leave empty |
| | | **Save** |

## Screen 3: "Edit theme" (on the game page)

Background `#1a1238`, Text `#ffffff`, Links `#ffe25a`, Buttons `#ffe25a` with button text `#1a0f2e`. **Save**.

## Screen 4: test, then publish

1. Click **Run game**, play a full match, and check you hear sound after the first click.
2. Check the full-screen button, then reload the page and check your rank and coins are still there.
3. **Edit game**, then Visibility & access: **Public**, then **Save**.
4. Send Claude the public link so the website card can say "Play on itch.io".

## If something looks wrong

| Symptom | Cause | Fix |
|---|---|---|
| Grey or blank game area | "Played in the browser" not ticked on the browser zip | Edit game, tick it, Save |
| Download page shows no files | No platform ticks on the download row | Tick Windows, macOS and Linux |
| Page not visible to others | Still Draft | Visibility & access: Public |
| 403 errors in the frame | Wrong zip uploaded (a folder inside the zip) | Upload `brinkball-browser.zip` exactly as given |

## Paste boxes

**Box A: tagline**
```
Shove your rivals off a crumbling sky arena. Last ball standing wins!
```

**Box B: download display name**
```
Brinkball (offline, open index.html)
```

**Box C: install instructions**
```
Unzip the file and open index.html in Chrome, Edge, Firefox or Safari. No install and no internet needed. Your rank, coins and skins are saved in that browser.
```

**Box D: description**
```
Dash, charge and bonk your rivals off a floating arena that crumbles away beneath you. The more hits a ball takes, the hotter it glows and the further it flies. Last one standing wins!

SOLO ROYALE
You against 7 CPU rivals. Climb the ranks from Bronze to Legend. The CPU gets sharper as you climb, so it always stays a challenge.

2 PLAYERS, ONE DEVICE
Share a keyboard, a tablet or two gamepads. First to 3 round wins. Add 0, 2 or 4 CPU rivals for chaos.

DAILY CHALLENGE
A new arena and twist every day (Giants, Hyper Dash, Glass Cannons, Power Rain and more). Keep your streak alive.

FEATURES
- Hold to charge a dash for a huge knockback
- 4 abilities to unlock: Shockwave, Anchor, Blink and Magnet
- 6 arenas: Meadow, Pinball, Glacier, Sweeper, Islands and Volcano
- Power-ups: Mega, Turbo, Spikes and Shield
- 14 skins and 10 hats to collect
- Daily missions and a daily gift
- Plays on computer, phone and tablet. Your progress is saved.

CONTROLS
Move: WASD, the arrow keys or the mouse
Dash: Space or left click (hold to charge)
Ability: E, Shift or right click
Pause: P or Esc. Mute: M
Touch: drag on the left to move, then tap DASH and the ability button
Gamepad: left stick, A to dash, X or B for the ability
2 players: P1 uses WASD + Space + E; P2 uses the arrow keys + Enter + Right Shift
```
