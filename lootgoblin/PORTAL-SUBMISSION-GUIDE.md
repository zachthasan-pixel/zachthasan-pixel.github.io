# Infinite Loot Goblin: CrazyGames and Poki Submission Guide

There are three builds of the same game. Use the matching zip for each site. They aren't interchangeable.

| Site | Upload this | Ads | Guide |
|---|---|---|---|
| **itch.io** | `lootgoblin-browser.zip` (+ `lootgoblin-download.zip`) | none | `ITCH-SUBMISSION-GUIDE.md` |
| **CrazyGames** | `lootgoblin-crazygames.zip` | CrazyGames SDK v3 | §1 below |
| **Poki** | `lootgoblin-poki.zip` | Poki SDK v2 | §2 below |

`./build.sh` rebuilds all of them from `src/`. The game code is identical across the three; only the ad layer
(`src/00-portal.js`) and the SDK script line in `index.html` differ.

**How the ad builds behave** (identical on both portals, following each company's SDK docs):
- The first run starts straight away. **RUN AGAIN** offers the portal a short ad break ("midgame" on CrazyGames,
  `commercialBreak` on Poki). The portal decides whether to actually show one.
- When you die, an optional **REVIVE: WATCH AD** button appears, once per run. Watching to the end brings the goblin
  back at 60% HP. If no video is available, the game says so and nothing else changes.
- While an ad plays, the game freezes, all sound is muted and input is ignored.
- The game reports gameplay start/stop to the portal: run start, pause, resume, death, revive.
- Beating a previous best depth or hitting a MEGA JACKPOT triggers CrazyGames' "happy time" confetti.
- If the SDK can't load (ad blockers, offline), the game still plays normally with no revive button, as CrazyGames requires.
- There are no external links in the game, which both portals require.

Tested here with stand-in SDKs that follow the documented APIs, including the call order, revive, the ad break
between runs, freezing during ads and the blocked-SDK fallback. Each portal's own test tool (below) is the real check.

---

## 1. CrazyGames

**Create the account** at <https://developer.crazygames.com/>, choosing *Sign up*. Use your own email; any studio name
works, e.g. *Hasan Games* or *ZachsterA3*. Add your payout details in the portal settings later, before revenue arrives.

**Submit the game:**
1. Developer Portal → **Upload game** (or *Submit a game*).
2. Game type: **HTML5**. Upload **`lootgoblin-crazygames.zip`**. `index.html` is at the zip root.
3. Orientation: **both** (the game has landscape and portrait layouts). Input: mouse, keyboard, touch.
4. Open the **Preview** link the portal gives you (`crazygames.com/preview`). That's CrazyGames' real test
   environment. Play a run, die, press *Revive*, then press *Run again*.
5. Fill in the listing. You can reuse the itch.io text (`ITCH-SUBMISSION-GUIDE.md` §2–§3) and the
   `cover-630x500.jpg` and `screenshots/` images. If the form asks for other image sizes, tell me the exact
   pixel sizes and I'll render them from the game.
6. Submit for review. CrazyGames typically starts new games in a **Basic Launch** (ads off while they measure
   player response) before a **Full Launch** with ad revenue. Their docs describe this; the timing is theirs.

## 2. Poki

Poki reviews every game by hand and is selective. Not every submission is accepted, so treat this as a pitch.

**Create the account** at <https://developers.poki.com/> (*Poki for Developers*) and sign up with your email.

**Submit the game:**
1. Upload **`lootgoblin-poki.zip`** to the **Poki Inspector** (<https://inspector.poki.dev/>), which the
   developer portal links to. It checks the SDK integration and lets you play the game as Poki would show it.
2. In the Inspector, play a run, die, use *Revive*, then *Run again*, and confirm it reports no SDK errors.
3. When it looks right, **send a review request** from the developer portal. Poki's team plays the game and replies.
4. Support: `developersupport@poki.com`, or the Discord linked in their docs.

**Ask before agreeing:** whether Poki wants the game **exclusive** to Poki on the web. If it does, that would conflict
with CrazyGames and itch.io. I couldn't find their current terms, so read the agreement they send.

---

## What I can't do for you

- Create the accounts. They need your email, password and identity or payout details, so you sign up yourself.
- Click "submit" on the portals. Once you're logged in, I can walk you through each form, and I can turn any
  reviewer feedback into changes.
