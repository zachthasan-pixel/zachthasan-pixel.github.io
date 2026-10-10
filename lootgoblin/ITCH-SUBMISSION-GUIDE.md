# Infinite Loot Goblin: One-Button Dungeon — itch.io Submission Guide

Everything needed to publish the game on itch.io under **ZachsterA3**, in the order the
"Create a new project" form asks for it. The text blocks are ready to copy into the form.

Files in this folder:

| File | What it is | Where it goes on itch.io |
|---|---|---|
| `lootgoblin-browser.zip` | The browser-playable build (`index.html`, `game.js`, `style.css`, `favicon.svg`) | Uploads → **"This file will be played in the browser"** |
| `lootgoblin-download.zip` | The same game for offline play, plus `README.txt`, `LICENSE.txt` and `LICENSE-fonts.txt` | Uploads → a second file, kind **Windows / macOS / Linux** |
| `cover-630x500.jpg` | Cover image, rendered by the game engine itself | Project page → Cover image |
| `screenshots/*.png` | Four 1280×720 gameplay shots and one phone shot | Project page → Screenshots |
| `index.html`, `game.js`, `style.css`, `favicon.svg` | The live copy served at `https://drzahirhasan.com/lootgoblin/` | Nothing to upload. This is the web mirror. |
| `lootgoblin-crazygames.zip`, `lootgoblin-poki.zip` | Ad-supported builds for the other portals | **Not for itch.io**; see `PORTAL-SUBMISSION-GUIDE.md` |
| `src/`, `build.sh` | Source code. `./build.sh` rebuilds `game.js` and all four zips | Keep in the repo only |

There is no build tool to install: `build.sh` only needs `bash`, `zip` and (for its syntax check) `node`.

---

## 1. Create the project

Go to <https://itch.io/game/new> (log in as ZachsterA3 first).

| Form field | Enter |
|---|---|
| **Title** | `Infinite Loot Goblin: One-Button Dungeon` |
| **Project URL** | `https://zachstera3.itch.io/infinite-loot-goblin` |
| **Short description or tagline** | see §2 |
| **Classification** | Games |
| **Kind of project** | **HTML**: "You have a ZIP file that will be played in the browser" |
| **Release status** | Released |
| **Pricing** | **$0 or donate**, suggested donation **$1.00** (see §7) |

## 2. Short description (tagline, ≤ 160 characters)

```
Your goblin fights on his own. You manage the loot. A chest every 3 seconds, game-breaking legendaries, and if your bag overflows, you explode.
```

## 3. Description (long; paste into the rich-text editor)

```
An RPG stripped down to its most degenerate gambling instincts.

Your goblin sprints down an endless dungeon corridor and fights everything by himself. You never control him. You control ONE thing: the loot.

Every 3 seconds a chest drops. It spins through the rarities like a slot machine, pops open, and the item flies straight into your bag. Equip it, sell it, drink it, throw it. Do it fast, because if loot arrives and your bag is full, you explode.

LOOT THAT BREAKS THE GAME
• Twitchy Shiv: +500% attack speed, but you lose 1% HP every time you blink.
• Eye of the Death Stare: every blink zaps every enemy on screen. You blink twice as often.
• Glass Greatsword: x3 damage. Your max HP is halved.
• Hoarder's Crown: +15% damage for every item in your bag. (How full do you dare?)
• Bottomless Sack: +4 bag slots... until you take it off and your bag bursts.
…and more legendaries, cursed gear, potions and bombs.

THE HOOK
The game hands you absurd power in the first thirty seconds. Then it gets complicated: cursed items that shrink your bag, bombs ticking inside your inventory, a boss who throws junk into your bag, chests that start falling twice as fast. One wrong drag and it's over.

FEATURES
• Real-time inventory management while the action runs
• 6 gear slots, 14 legendary synergies, 8 curses, 5 potions, bombs and junk
• Every chest is a mini slot-machine roll: Common, Uncommon, Rare, Epic, Legendary, Cursed
• A boss every 250 m (the Gremlin Taxman, the Mimic King, the Blink Watcher), each with a boss JACKPOT
• 5 dungeon themes, from the Mossy Crypt to the Void Casino
• The Goblin Bank: spend gold on permanent upgrades between runs
• Big numbers. Very big numbers.
• Plays on desktop (mouse + keyboard) and on phones and tablets (touch). No install.

A run lasts 1–5 minutes. "Just one more" lasts longer.

CONTROLS
Drag gear onto its GEAR slot (or onto the goblin) to equip · drag anything onto SELL for gold · drag potions and bombs onto the dungeon · double-click/double-tap to equip or use · right-click to sell · hover + E/S to equip/sell · Esc pauses · M mutes. On phones: tap an item, then tap where it goes.

Made by Dr. Zahir Hasan. Original pixel art, chiptune and sound, all generated in code. No ads, no tracking, no accounts.
```

## 4. Tags, genre, inputs

Tags (itch allows up to 10):

```
roguelite, loot, arcade, pixel-art, idle, incremental, rpg, dungeon, singleplayer, touch-friendly
```

Spares if any are rejected: `inventory`, `funny`, `html5`, `browser`.

**Genre**: *Action*. **Made with**: HTML5 (type `HTML5`). **Average session**: *A few minutes*.
**Languages**: English. **Inputs**: Keyboard, Mouse, Touchscreen. **Accessibility**: leave unticked.

## 5. Uploads and embed settings

1. **Upload `lootgoblin-browser.zip`.** Tick **"This file will be played in the browser"**.
2. In **Embed options**:
   - **Viewport dimensions**: `960` × `600` (the layout adapts to any size; this is what most itch players see)
   - **Fullscreen button**: ✅ on
   - **Mobile friendly**: ✅ on. **Orientation**: *Any* (portrait and landscape layouts both exist)
   - **Automatically start on page load**: ❌ off. Leave *Click to play*; audio needs a click anyway.
   - **Enable scrollbars**: ❌ off
   - **SharedArrayBuffer support**: ❌ off
3. **Upload `lootgoblin-download.zip`** as a second file. Kind: **Windows, macOS and Linux** (tick all three; it runs offline in any browser). Display name: `Infinite Loot Goblin — offline edition`.

## 6. Cover, screenshots, theme

- **Cover image**: `cover-630x500.jpg`.
- **Screenshots** (in this order): `01-loot-frenzy.png`, `02-boss-taxman.png`, `03-legendary-tooltip.png`, `04-bag-full.png`, `05-mobile.png`.
- **Theme**: Background `#0b0714`, Text `#e8e0ff`, Link `#ff9a1f`, Button `#f2c14e`.
- **Alternative key art**: two painted-style covers were generated in your **Higgsfield** library on 9 Oct 2026
  (job IDs `9b93d092-2038-4af0-bbab-c6bbe53eb08f` and `1efb677b-1a81-4333-a19e-54f2491b8b96`). This build
  environment could not download them, so they are not in this folder. To use one, download it from Higgsfield and
  crop it to 630 × 500. It suits the itch banner or a social post better than the cover, because the in-game title
  lettering differs slightly.

## 7. Pricing plan

| Phase | Setting | Notes |
|---|---|---|
| Launch | **$0 or donate**, suggested **$1.00** | Short-session arcade games spread through free play. Gather ratings and comments. |
| Wider reach | **CrazyGames / Poki** submission (see `PORTAL-SUBMISSION-GUIDE.md`) | Their audience matches the game; revenue comes from ad share. |
| Later | **Paid "Deluxe" offline edition, $2.99** | Add more legendaries, a 4th boss and an endless "Casino" mode, and keep the browser version free. |

## 8. CrazyGames and Poki

Done as separate builds, so the itch.io version stays ad-free. See `PORTAL-SUBMISSION-GUIDE.md`, and upload
`lootgoblin-crazygames.zip` to CrazyGames and `lootgoblin-poki.zip` to Poki. **Never upload those two zips to itch.io.**

## 9. Pre-publish checklist

- [x] `index.html` sits at the **root** of the browser zip.
- [x] All paths are relative (`game.js`, `style.css`, `favicon.svg`).
- [x] Nothing loads from the network: fonts are embedded in `style.css`, and art and audio are generated in code.
- [x] 4 files, ≈ 160 KB. Well under every itch limit.
- [x] Tested in Chromium at 960×600, 1280×720 and 390×844 (touch) with no console errors. Mouse drag, right-click
      sell, double-click, touch tap-to-move and bomb throwing all verified.
- [x] Balance checked with a scripted bot: runs last 1½–5 minutes, and a player who does nothing explodes at about 20 s.
- [ ] After uploading, open the page in an **incognito window** and play one run on desktop and one on your phone.
- [ ] Set **Visibility & access → Public** once that check passes.
- [ ] When the itch page is live, swap the `apps.html` card link from `lootgoblin/` to the itch URL (optional).

## 10. Launch post (optional)

```
New free browser game: Infinite Loot Goblin. Your goblin fights on his own; you only manage the loot. A chest every 3 seconds, legendaries that break the game, and if your bag overflows... you explode. Play: https://zachstera3.itch.io/infinite-loot-goblin
```
