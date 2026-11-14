# Emberglass Warden — Poki submission guide (14 Nov 2026)

Source: written from Poki's developer docs (developers.poki.com/guide/share and related pages, researched 13 Nov 2026). Labels on screen may differ slightly. Poki is curated: the first step is only a form. Do this AFTER the itch.io page is public, because the form needs a playable link.

## Files in this folder

| File | What it is for |
|---|---|
| screenshots-for-form/01, 02, 03 .jpg | The three screenshots the form asks for |
| EmberglassWarden_14Nov2026_poki-thumbnail-1024x1024.png | Square thumbnail without text (Poki asks for it later) |
| EmberglassWarden_14Nov2026_poki-build.zip | The Poki-SDK build. Only upload after Poki emails you access |

## Screen 1 — "Submit your game" (https://developers.poki.com/guide/share)

| # | Field on screen | What to do |
|---|---|---|
| 1 | Full name | `Zahir Hasan` |
| 2 | Email address | Your email |
| 3 | Company/studio name | `Zahir Hasan` |
| 4 | What name do you develop games under | `Zahir Hasan` |
| 5 | Do you have a registered company | No |
| 6 | Where is your team based | Japan |
| 7 | How big is your team | Just me |
| 8 | What platforms has your team released games on before | Web / browser |
| 9 | Game title | `Emberglass Warden` |
| 10 | Describe your game in a few sentences | Paste box A |
| 11 | What game engine did you use | ThreeJS |
| 12 | Share a playable build or gameplay video | Playable browser build |
| 13 | Build or video link | Your public itch.io page link for Emberglass Warden |
| 14 | Show us what it looks like | Upload the 3 files in `screenshots-for-form/` |
| 15 | Why do you think your game is a good fit for Poki | Paste box B |
| 16 | Has this game already been released on other platforms | Yes — itch.io |
| 17 | "I've read the Poki Content & Brand Guidelines" | Read developers.poki.com/guide/content-player-safety, then tick |
| 18 | Bottom | Click **Submit your game** |

## If Poki says yes (by email)

1. They give you access to Poki for Developers. Create the game there and upload `EmberglassWarden_14Nov2026_poki-build.zip` under Versions.
2. Settings tab: Title `Emberglass Warden`; suggested categories Action, Sword, 3D, Survival; Description: paste box A.
3. Thumbnails tab: `EmberglassWarden_14Nov2026_poki-thumbnail-1024x1024.png`.
4. Poki then runs content moderation, playtests (watch all 10 recordings), a player fit test (healthy: 3+ minutes average play), a web fit test (about 7 days) and a final review (1–2 weeks). An animated thumbnail is needed before global release — ask me to make it then.
5. Read any agreement for **exclusivity** before accepting, because the game is also on itch.io and may go to CrazyGames. Support: developersupport@poki.com

## What this Poki build already does (checked by automated test on 14 Nov 2026)

Poki SDK v2; gameplayStart on the first click; no double start/stop events; commercialBreak only after pressing FIGHT AGAIN, with sound muted during the break; no rewarded buttons, no purchases, one currency; runs with storage blocked (incognito); no outside requests except the Poki SDK; fills a 16:9 frame; P or Esc pauses; touch controls on phones and tablets.

## If something looks wrong

| What you see | Cause | Fix |
|---|---|---|
| Form rejects the link | Page still Draft on itch | Make the itch page Public first |
| Screenshot refused | Wrong file type or over 5 MiB | Use the three JPG files in this folder unchanged |

## Paste boxes

A — Describe your game
```
Emberglass Warden is a first-person saber arena game. Beasts pour out of a rift in waves and you cut them down with three-hit combos, charged heavy strikes and last-instant parries. Glowing spores can be slashed out of the air and sent back at the beast that fired them. After every wave you pick one of three upgrades, so each run plays differently, and a boss Tyrant arrives every fifth wave. Shards earned in runs buy permanent upgrades, and a Daily Trial changes the rules every day.
```

B — Why is it a good fit for Poki
```
It starts with one click and the first enemies arrive within two seconds, with the controls taught in play. It works on desktop with mouse and keyboard and on phones and tablets with touch controls and light aim assist. Runs last a few minutes and end with a clear reason to go again: a new best wave, shards for a permanent upgrade, a blade colour to unlock or the Daily Trial. The whole game is about 6 MB, loads quickly and makes no outside requests. I plan to keep adding beasts, bosses and arenas.
```
