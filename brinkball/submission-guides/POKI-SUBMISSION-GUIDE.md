# Brinkball: Poki submission guide

Written from Poki's developer docs (guide/share, requirements-quality, how-testing-works, game-thumbnail, sdk-html5, content-player-safety), re-read on 2026-10-29. Labels on screen may differ slightly. Poki chooses its games carefully: new developers start with the public form, and Poki invites you to Poki for Developers (P4D) by email if they are interested.

## Files in this folder

| File | What it is for |
|---|---|
| `screenshots-for-form/01-…png`, `02-…png`, `03-…png` | The 3 images for "Show us what it looks like" (each under 5 MiB) |
| `poki-thumbnail-1024x1024.png` | Square thumbnail with no text, for P4D later (needed for the player fit test) |
| `brinkball-poki-build.zip` | The Poki SDK build. Upload it only after Poki gives you P4D access. |

## Before you start

Read https://developers.poki.com/guide/content-player-safety (the form asks you to confirm you have). Brinkball has no violence, no chat, no purchases and only one currency.

You need a public link to the game. Use https://drzahirhasan.com/brinkball/ after the pull request is merged, or the itch.io page.

## Screen: "Submit your game" (https://developers.poki.com/guide/share)

### About you
| # | Field | What to do |
|---|---|---|
| 1 | Full name | `Zahir Hasan` |
| 2 | Email address | your email |
| 3 | Company/studio name | `Dr. Zahir Hasan` (or your studio name, if you prefer one) |
| 4 | What name do you develop games under | Same as row 3 |
| 5 | Do you have a registered company | Yes or No (your answer) |
| 6 | Where is your team based | Japan |
| 7 | How big is your team | Just me |
| 8 | What platforms has your team released games on before | Web / browser (also iOS, since you have App Store apps) |

### About the game
| # | Field | What to do |
|---|---|---|
| 9 | Game title | `Brinkball` |
| 10 | Describe your game in a few sentences | Paste **Box A** |
| 11 | What game engine did you use | **AI/Claude/ChatGPT** |
| 12 | Share a playable build or gameplay video | Playable browser build |
| 13 | Build or video link | `https://drzahirhasan.com/brinkball/` (or the itch.io page link) |
| 14 | Show us what it looks like | Upload the 3 files in `screenshots-for-form/` |
| 15 | Why do you think your game is a good fit for Poki | Paste **Box B** |

### Where is the game already available
| # | Field | What to do |
|---|---|---|
| 16 | Has this game already been released on other platforms | Yes: itch.io and drzahirhasan.com (say "No" if you submit before publishing on itch) |

### One last thing
| # | Field | What to do |
|---|---|---|
| 17 | I've read the Poki Content & Brand Guidelines | Tick (after reading them) |
| 18 | **Submit your game** | Click |

## If Poki says yes

1. You get P4D access by email. Under **Versions**, upload `brinkball-poki-build.zip`.
2. Content moderation runs automatically.
3. Test in the **Poki Inspector** (https://inspector.poki.dev/). Check that the SDK events come in order (gameplayStart on your first key press or tap, gameplayStop on death or pause, commercialBreak only when pressing Play Again or Play), that the page never scrolls, and that sound mutes during ads.
4. **Playtests:** request them; you get 10 recordings. Watch all 10 to unlock the next stage. Send Claude any notes.
5. **Player fit test:** needs `poki-thumbnail-1024x1024.png` uploaded on the Thumbnails tab. A healthy result is a 3+ minute average and 25%+ of plays over 3 minutes. It takes about 5 hours, up to 2 per day.
6. **Web fit test:** about 7 days on real category pages. It measures click-through and conversion to play.
7. **Final review** (1 to 2 weeks), then an agreement. **Read it for web exclusivity before accepting**, because Brinkball is also on itch.io and going to CrazyGames.
8. Settings tab later: title `Brinkball`; up to 4 categories (suggest **2 Player**, **Ball**, **Physics** and **Casual**, or the closest names in their list); description from Box A.
9. Support: developersupport@poki.com

## What the Poki build already does (for their QA)

- Poki SDK v2. `gameplayStart` fires on the first input, not on load. No event ever fires twice in a row.
- `commercialBreak` runs only when going back into gameplay (Play Again or Play), never on menu buttons. Audio is muted and input is ignored during breaks.
- One optional rewarded ad: "🎬 DOUBLE COINS" on the results screen. It sits under the larger PLAY AGAIN button, is purple (not green), and pays out only when the ad finishes.
- No purchases, one currency, no external links, no external requests, and no fonts loaded from the web.
- Works in incognito (storage errors are caught). Covers the 16:9 frame fully. Touch controls on phones and tablets, and works in portrait and landscape.

## Paste boxes

**Box A: describe your game**
```
Brinkball is a physics knockout brawler. You dash and bonk your rivals off a floating arena that crumbles away under everyone; the more hits a ball takes, the hotter it glows and the further it flies, so every round builds to a tense finish. Play Royale against 7 CPU rivals and climb from Bronze to Legend, settle it 1v1 with a friend on the same keyboard or tablet, or take on the Daily Challenge, which has a new arena and twist each day. Hold-to-charge dashes, 4 unlockable abilities, 6 arenas with their own rules (ice, pinball bumpers, a spinning sweeper, collapsing islands, volcano vents), power-ups, and 24 cosmetics.
```

**Box B: why it fits Poki**
```
- Instant: the very first visit drops you straight into a short warm-up match with in-game hints. After that, PLAY is one click from the menu.
- Works everywhere: keyboard, mouse, touch (floating joystick plus DASH and ability buttons), and gamepads. Plays in landscape and portrait, and tablets get touch controls.
- Strong 2 Player mode on one device (one keyboard, one tablet, or two pads). Rounds are first to 3.
- Short rounds (about 30 to 60 seconds) with a one-click rematch, plus long-term hooks: a rank ladder where the CPU adapts to your rank, coins for cosmetic skins and hats, abilities and arenas that unlock by rank, 3 daily missions, a daily gift, and a seeded Daily Challenge with a streak.
- Lightweight: about 150 KB in 4 files, no external requests, and it loads instantly.
- Built for updates: new arenas, abilities, cosmetics and daily twists slot straight in. I plan regular content updates.
```
