# Brinkball: submission kit (2026-10-29)

**Brinkball** is a physics knockout brawler. Dash and bonk your rivals off a crumbling floating arena. You can play solo against 7 CPU rivals, as 2 players on one device, or in a seeded Daily Challenge. Progress comes from ranks (Bronze to Legend), coins, skins, hats, unlockable abilities and arenas, daily missions, a daily gift and a daily streak.

## Where everything is

| What | Where |
|---|---|
| The full kit: builds, covers, videos, screenshots, these guides | **Brinkball-submission-kit-2026-10-29.zip** in your Higgsfield library (link in Claude's message) |
| Game on your site (after the pull request is merged) | https://drzahirhasan.com/brinkball/ |
| Source and builds | `brinkball/` in the website repository; `./build.sh` rebuilds everything |

The kit zip unpacks to:

```
Brinkball-submission-kit-2026-10-29/
  00-START-HERE.md
  1-itch.io/        ITCH-SUBMISSION-GUIDE.md, brinkball-browser.zip, brinkball-download.zip, cover-630x500.png, screenshots/
  2-Poki/           POKI-SUBMISSION-GUIDE.md, screenshots-for-form/ (3), poki-thumbnail-1024x1024.png, brinkball-poki-build.zip
  3-CrazyGames/     CRAZYGAMES-SUBMISSION-GUIDE.md, UPLOAD-THESE-4-FILES/, covers/ (3), videos/ (2)
```

## Order of work

1. **itch.io**: instant, and it gives you a public page. (`1-itch.io/ITCH-SUBMISSION-GUIDE.md`)
2. **Poki**: the submission form. It needs a public playable link: use https://drzahirhasan.com/brinkball/ once merged, or the itch.io page. (`2-Poki/POKI-SUBMISSION-GUIDE.md`)
3. **CrazyGames**: the strictest review. Go through the quality gate at the top of the guide first. (`3-CrazyGames/CRAZYGAMES-SUBMISSION-GUIDE.md`)

## Decisions only you can make

- **itch.io price:** I recommend "$0 or donate" for the browser game. You could sell the offline download, as you did with Magnetic Chaos.
- **Poki form:** the company or studio name (the default is "Dr. Zahir Hasan") and whether you have a registered company.
- **Poki exclusivity:** if Poki offers an agreement, check whether it asks for web exclusivity before accepting, because the game will also be on itch.io and CrazyGames.

## Status

| Portal | Status |
|---|---|
| itch.io | Ready to upload |
| Poki | Ready for the submission form |
| CrazyGames | Ready. The build passed the quality gate in testing on 2026-10-29 |

## How it was tested (2026-10-29)

- Automated runs of all three builds: zero console errors, zero requests outside the game folder.
- Viewport sweep: all 10 CrazyGames test sizes, the 3 Poki sizes, and phone portrait and landscape.
- Save survives a reload, and the game still runs when browser storage is blocked.
- SDK event order checked with stand-in SDKs:
  - Poki: init, loadingFinished, gameplayStart on first input, stop on death and pause, commercialBreak before restart. No doubled events.
  - CrazyGames: init, loading, gameplay start and stop, happytime on wins, midgame before restart. No reward button.
- The game runs on a fixed 1/120 s physics step, so it behaves the same at 60, 144 and 165 Hz.
- Two independent reviewer agents played it blind, one on desktop and one on mobile. Their issues were fixed:
  - first Royale matches too harsh
  - missions hidden at 907x510
  - stale banner
  - 3-2-1 countdown added
  - label sizes
  - locker one-tap purchases
  - phone layout
  - pause when the window loses focus

## AI disclosure

The code, the synthesised sound and the in-game art were all written by Claude. The store covers and the thumbnail were generated on Higgsfield (GPT Image 2.5). If a form asks, answer "Yes": Code, plus Graphics for the store art.
