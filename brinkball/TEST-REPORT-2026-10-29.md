# Brinkball: test report, 2026-10-29

| Check | Result |
|---|---|
| Console errors (web, Poki and CrazyGames builds; desktop and touch) | 0 |
| Requests outside the game folder | 0 (checked with network interception) |
| First-time flow | Lands straight in the warm-up, with hints for move, dash, charge and ability. The warm-up result leads to Royale. |
| Full flows | Warm-up, results, menu, locker (buy and equip), Party setup and rounds, Daily intro and match, pause, resume, quit |
| Save | Survives a reload. With localStorage throwing, the game boots and plays (no saving). |
| Viewport sweep | 907x510, 1216x684, 1077x606, 821x462, 1366x768, 1920x1080, 1536x864, 1280x720, 800x450, 1080x607, 640x360, 836x470, 1031x580, 390x844 and 844x390 touch: text readable, nothing cut off |
| Frame-rate independence | Fixed 1/120 s physics step with an accumulator. A reviewer drove requestAnimationFrame at 30, 60, 144 and 240 Hz and saw the same movement. |
| Poki SDK order | init → loadingFinished → gameplayStart (first input) → gameplayStop (death or pause) → commercialBreak → gameplayStart. No doubled events. Rewarded pays out only when the ad finishes. |
| CrazyGames SDK order | init → loadingStart/Stop → gameplayStart → happytime (win) → gameplayStop → midgame → gameplayStart. No reward button. |
| Size | About 150 KB, 4 files per build |
| Match pacing (simulated, 12 matches per rank band) | Full Royale lasts 25 to 55 s; Bronze players get 2 lives and spawn protection |
| Blind reviews (2 agents) | Desktop: "probably accepted after a polish pass". Mobile: "Poki conditional pass, CrazyGames pass". All top issues fixed (see the commit "fixes from two blind playtest reviews"). |

## Lesson for next time

This cloud session's network can't download from Higgsfield's file servers (cloudfront). Do the cropping, the video assembly and the kit zip inside Higgsfield's own sandbox (`sandbox_exec`): clone the public repo branch there, record gameplay with Playwright, then upload the kit zip with `media_upload`. Don't try to route files around the network policy.
