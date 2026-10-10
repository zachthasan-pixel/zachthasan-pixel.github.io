# Magnetic Chaos: Keep the Sphere — itch.io Submission Guide

Everything needed to publish the game on itch.io under **ZachsterA3**, in the order the
"Create a new project" form asks for it. The text blocks are ready to copy into the form.

Files in this folder:

| File | What it is | Where it goes on itch.io |
|---|---|---|
| `magneticchaos-browser.zip` | The browser-playable build (`index.html`, `game.js`, `style.css`, `favicon.svg`) | Uploads → **"This file will be played in the browser"** |
| `magneticchaos-download.zip` | The same game for offline play, plus `README.txt` and `LICENSE.txt` | Uploads → a second file, kind **Windows / macOS / Linux** |
| `cover-630x500.jpg` | Cover image, rendered by the game engine itself | Project page → Cover image |
| `screenshots/*.png` | Five 1280×720 gameplay shots and one phone shot | Project page → Screenshots |
| `index.html`, `game.js`, `style.css`, `favicon.svg` | The live copy served at `https://drzahirhasan.com/magneticchaos/` | Nothing to upload. This is the web mirror. |
| `magneticchaos-crazygames.zip`, `magneticchaos-poki.zip` | Ad-supported builds for the other portals | **Not for itch.io**; see `PORTAL-SUBMISSION-GUIDE.md` |
| `src/`, `build.sh` | Source code. `./build.sh` rebuilds `game.js` and all four zips | Keep in the repo only |

There is no build tool to install: `build.sh` only needs `bash`, `zip` and (for its syntax check) `node`.

---

## 1. Create the project

Go to <https://itch.io/game/new> (log in as ZachsterA3 first).

| Form field | Enter |
|---|---|
| **Title** | `Magnetic Chaos: Keep the Sphere` |
| **Project URL** | `https://zachstera3.itch.io/magnetic-chaos` |
| **Short description or tagline** | see §2 |
| **Classification** | Games |
| **Kind of project** | **HTML**: "You have a ZIP file that will be played in the browser" |
| **Release status** | Released |
| **Pricing** | **$0 or donate**, suggested donation **$1.00** (see §7) |

## 2. Short description (tagline, ≤ 160 characters)

```
Steer a gravity well through hundreds of charged fragments. Same charge repels. Opposite charge kills. How long can you keep the Spark alive?
```

## 3. Description (long; paste into the rich-text editor)

```
A hypnotic physics survival game where everything goes wrong very quickly.

You control a single gravity well. It drags a volatile, glowing core, the Spark, after it. Around you, hundreds of charged magnetic fragments swirl through the arena. Your only job is to keep the Spark alive.

THE RULES
• Debris with the SAME charge as the Spark is pushed away. Harmless.
• Debris with the OPPOSITE charge is drawn toward it. One touch and the run is over.
• So is the arena wall.
• Brush past opposite-charge debris without touching it to GRAZE. Grazes charge your PULSE, a shockwave that blasts the swarm away from the Spark.

IT GETS WORSE
The longer you survive, the heavier the Spark gets, the faster the swarm spins and the more of it turns against you. Then the anomalies arrive:
• TIME DILATION: everything inside the blue ring slows to a crawl
• POLARITY FLIP: the Spark's charge inverts. Your shield becomes the threat.
• GRAVITY WARP: the whole swirl reverses direction
• CHARGE STORM: a wave of opposite-charge debris pours in from the edge
• SINGULARITY: a black hole opens and pulls everything in, including you

THE SOUND
The soundtrack is generated live and reacts to you: an ambient drone at first, then a heartbeat that climbs into a frantic synth pulse the longer you last. The closer the danger, the more the sound opens up. Play with headphones.

FEATURES
• Hundreds of physics-driven fragments at a smooth 60 fps (WebGL)
• Motion trails, bloom, gravitational lensing and time-dilation ripples
• Survival ranks from STATIC to FLOW STATE to BEYOND CHAOS
• Runs last from 10 seconds to several minutes. "Just one more second" lasts longer.
• Plays on desktop (mouse or keyboard) and on phones and tablets (touch). No install.

CONTROLS
Mouse: move to steer, click to PULSE · Keyboard: WASD / arrows to steer, Space to PULSE · Touch: drag anywhere to steer, tap to PULSE · P / Esc pauses · M mutes.

Made by Dr. Zahir Hasan. All graphics and audio are generated in code. No ads, no tracking, no accounts.
```

## 4. Tags, genre, inputs

Tags (itch allows up to 10):

```
physics, arcade, survival, minimalist, abstract, neon, relaxing, flow, singleplayer, touch-friendly
```

Spares if any are rejected: `high-score`, `procedural-audio`, `html5`, `browser`, `hypnotic`.

**Genre**: *Action*. **Made with**: HTML5 (type `HTML5`) and WebGL. **Average session**: *A few minutes*.
**Languages**: English. **Inputs**: Keyboard, Mouse, Touchscreen. **Accessibility**: leave unticked.

## 5. Uploads and embed settings

1. **Upload `magneticchaos-browser.zip`.** Tick **"This file will be played in the browser"**.
2. In **Embed options**:
   - **Viewport dimensions**: `960` × `640` (the arena fits any size; this is what most itch players see)
   - **Fullscreen button**: ✅ on
   - **Mobile friendly**: ✅ on. **Orientation**: *Any*
   - **Automatically start on page load**: ❌ off. Leave *Click to play*; audio needs a click anyway.
   - **Enable scrollbars**: ❌ off
   - **SharedArrayBuffer support**: ❌ off
3. **Upload `magneticchaos-download.zip`** as a second file. Kind: **Windows, macOS and Linux** (tick all three; it runs offline in any browser). Display name: `Magnetic Chaos — offline edition`.

## 6. Cover, screenshots, theme

- **Cover image**: `cover-630x500.jpg`.
- **Screenshots** (in this order): `01-swarm.png`, `02-singularity.png`, `03-time-dilation.png`,
  `04-polarity-flip.png`, `05-charge-storm.png`, `06-mobile.png`.
- **Theme**: Background `#05060f`, Text `#e9ecff`, Link `#38e6ff`, Button `#9a73ff`.
- **Trailer (recommended)**: itch, CrazyGames and Poki all reward a short clip. A 20–30 second screen recording of a
  real run (start → first anomalies → a near miss → death screen) works best. Record it on your Mac with
  Cmd+Shift+5 while playing in full screen, then upload to YouTube and paste the link into itch's *Gameplay video
  or trailer* field.

## 7. Pricing plan

| Phase | Setting | Notes |
|---|---|---|
| Launch | **$0 or donate**, suggested **$1.00** | Short-session arcade games spread through free play. Gather ratings and comments. |
| Wider reach | **CrazyGames / Poki** submission (see `PORTAL-SUBMISSION-GUIDE.md`) | Their audience matches the game; revenue comes from ad share. |
| Later | **Paid "Zen + Daily" offline edition, $2.99** | Add a daily seeded challenge, a no-death Zen mode and colour themes; keep the browser version free. |

## 8. CrazyGames and Poki

Done as separate builds, so the itch.io version stays ad-free. See `PORTAL-SUBMISSION-GUIDE.md`, and upload
`magneticchaos-crazygames.zip` to CrazyGames and `magneticchaos-poki.zip` to Poki. **Never upload those two zips to itch.io.**

## 9. Pre-publish checklist

- [x] `index.html` sits at the **root** of the browser zip.
- [x] All paths are relative (`game.js`, `style.css`, `favicon.svg`).
- [x] Nothing loads from the network: no fonts, images or audio files. Graphics and sound are generated in code.
- [x] 4 files, about 25 KB zipped. Well under every itch limit.
- [x] Tested in Chromium at 1280×720, 630×500 and 390×844 (touch) with no console errors. Mouse steering, keyboard
      steering, touch drag, tap-to-pulse, pause, mute and the game-over flow all verified.
- [x] Balance checked with scripted bots: doing nothing dies in about 6 s, aimless wandering in about 15 s, a bot with
      human reaction time (200 ms) survives about 35 s, and a perfect bot lasts several minutes.
- [ ] After uploading, open the page in an **incognito window** and play one run on desktop and one on your phone.
      Check that sound starts after the first click.
- [ ] Set **Visibility & access → Public** once that check passes.
- [ ] When the itch page is live, swap the `apps.html` card link from `magneticchaos/` to the itch URL (optional).

## 10. Launch post (optional)

```
New free browser game: Magnetic Chaos. You steer a gravity well; hundreds of charged fragments swirl around you. Same charge repels, opposite charge kills. Then time slows, your polarity flips and a black hole opens. How long can you last? Play: https://zachstera3.itch.io/magnetic-chaos
```
