# Emberglass Warden — test report (14 Nov 2026)

All tests ran in the cloud session in headless Chromium (software WebGL) with scripted players. Nothing here was tested by a human hand, by ear, on a real phone, in Safari or on a Chromebook.

## 1. Automated reviewer suite (`node tools/test-all.mjs`) — 40 of 40 passed

```
PASS itch: no unexpected external requests
PASS itch: survives 5 min scripted play  {"steps":36000,"state":"playing","wave":12,"kills":96,"hp":119,"score":51865}
PASS itch: pause
PASS itch: paused game does not advance
PASS itch: resume
PASS itch: mute toggle
PASS itch: game over screen
PASS itch: restart works
PASS itch: save survives reload  best 12 shards 732
PASS itch: zero console errors
PASS crazygames: no unexpected external requests  https://sdk.crazygames.com/crazygames-sdk-v3.js
PASS crazygames: survives 5 min scripted play  {"steps":36000,"state":"playing","wave":13,"kills":117,"hp":100,"score":59983}
PASS crazygames: pause
PASS crazygames: paused game does not advance
PASS crazygames: resume
PASS crazygames: mute toggle
PASS crazygames: game over screen
PASS crazygames: restart works
PASS crazygames: save survives reload  best 13 shards 690
PASS crazygames: SDK event order  init,listener,loadingStart,loadingStop,gameplayStart,gameplayStop,gameplayStart,gameplayStop,gameplayStart,gameplayStop,happytime,gameplayStart,gameplayStop
PASS crazygames: mute setting listener registered
PASS crazygames: zero console errors
PASS poki: no unexpected external requests  https://game-cdn.poki.com/scripts/v2/poki-sdk.js
PASS poki: survives 5 min scripted play  {"steps":36000,"state":"playing","wave":12,"kills":96,"hp":82,"score":49726}
PASS poki: pause
PASS poki: paused game does not advance
PASS poki: resume
PASS poki: mute toggle
PASS poki: game over screen
PASS poki: restart works
PASS poki: save survives reload  best 12 shards 905
PASS poki: SDK event order  init,gameLoadingFinished,gameplayStart,gameplayStop,gameplayStart,gameplayStop,gameplayStart,gameplayStop,commercialBreak,breakDone,gameplayStart,gameplayStop
PASS poki: commercialBreak before restart
PASS poki: zero console errors
PASS runs with localStorage blocked  {"steps":1500,"state":"playing","wave":1,"kills":4,"hp":100,"score":765} 
PASS same movement at 60/144/165 Hz  {"60":21.16,"144":21.16,"165":21.16}
PASS itch: size  6.09 MB, 13 files, flat
PASS itch-offline: size  7.62 MB, 4 files, flat
PASS crazygames: size  6.09 MB, 13 files, flat
PASS poki: size  6.09 MB, 13 files, flat
0 failures of 40
```

Notes: "survives 5 min scripted play" uses a player that is topped up when low, to prove stability, not balance. The portal SDKs were replaced by stand-ins that record the order of events.

## 2. Release builds as a player loads them (`node tools/release-smoke.mjs`) — 4 of 4 passed

itch, CrazyGames and Poki builds over a local web server and the itch offline build opened straight from the file; each reached the menu, started a run on PLAY, had no console errors, and contains no test hooks.

## 3. Screen sizes

Menu, play, upgrade, pause, game-over and Armory screens were captured and looked at for 907x510, 1216x684, 1077x606, 821x462, 1366x768, 1920x1080, 1536x864, 1280x720, 640x360, 836x470, 1031x580, and with touch controls at 800x450, 1080x607, 844x390 and 390x844 (portrait). Nothing was cut off. After review, the smallest labels were raised to at least 10 px and two touch buttons that overlapped were moved apart.

## 4. Refresh rates

Holding forward for two seconds with one dash covers 21.16 m at 60, 144 and 165 Hz (identical).

## 5. Size and requests

Release builds: 13 flat files, about 5.4 MB (offline copy 4 files, 6.9 MB). No requests leave the game folder except the portal's own SDK script in the CrazyGames and Poki builds.

## 6. Independent reviewers (two agents that did not see the code)

Both said the first build would be rejected. Main findings and what was done:

| Finding | Fix |
|---|---|
| Wave-5 boss was a wall (1768 HP; every bot died there) | Boss HP 760 at wave 5 with gentler scaling, lower damage, slower and clearly ringed sweep |
| Average run lasted about 75 s | Lower early damage, one attacker at a time before wave 5, longer invulnerability after a hit, healing on kills and between waves, slower early spawns, more beasts in waves 1–4 |
| Blocking never taught; blocking drained too much | "Hold Right-Click to BLOCK" prompt with slow motion on the first pounce; block costs far less energy; wider parry window |
| Dash gave no protection | Dash now protects for a third of a second |
| Brute armour did not matter | Light hits do 30% to armour; heavy strikes hit much harder |
| Vital Core over-healed (150/125) | Fixed |
| Chain Spark and parry shockwave too weak | Roughly doubled; shockwave staggers |
| Content thin, one boss, flat Armory | Second boss (Venom Tyrant, wave 10/20…), two new beasts (Frost Shade wave 6+, Blight Mortar wave 9+), five arena colour themes, four new Armory upgrades that change play, "next unlock" goal on the game-over screen |
| Small labels, touch buttons overlapping, boss bar over health panel in portrait | Fixed |
| A wave could end early while its last beast was still arriving (found in my own testing) | Fixed |

Scripted players before and after (5 runs each, no cheats, median):

| Player | Before: wave / run length | After: wave / run length |
|---|---|---|
| Button-masher (never blocks) | 4 / 43 s | 5 / 86 s |
| Average (blocks half the time) | 5 / 73 s | 10 / 233 s |
| Skilled (parries) | 6 / 78 s | 12 / 292 s |

These scripted players stand still in melee; a person who moves should last longer. A first-time player who never blocks still falls at the first boss after about a minute and a half, which remains the weakest point against CrazyGames' "80% still playing after one minute" target (restarting counts as playing).

## 7. Not done / open

- The reviewers did not re-play the rebalanced build.
- One arena layout only; content beyond wave 13 is scaling, elites and the alternating bosses.
- Real-device, real-browser and by-ear checks are still needed (see 00-START-HERE).
