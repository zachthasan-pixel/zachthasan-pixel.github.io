# Earthfall Command: Last Orbit — itch.io Submission Guide

Everything needed to publish the game on itch.io under **ZachsterA3**, in the order the
itch.io "Create a new project" form asks for it. Copy the text blocks straight into the form.

Files in this folder:

| File | What it is | Where it goes on itch.io |
|---|---|---|
| `earthfall-browser.zip` | The browser-playable build (`index.html` + `game.js` + `style.css` + `favicon.svg`) | Uploads → **"This file will be played in the browser"** |
| `earthfall-download.zip` | The paid/downloadable build: same game plus `README.txt` and `LICENSE.txt` for offline play | Uploads → a second file, kind **Windows / macOS / Linux** (tick all three), **not** played in browser |
| `cover-630x500.jpg` | Cover image | Project page → Cover image |
| `screenshots/*.png` | Three gameplay screenshots | Project page → Screenshots |
| `index.html`, `game.js`, `style.css`, `favicon.svg` | The live copy served from this GitHub Pages site at `https://zahirhasan.com/earthfall/` | nothing to upload; this is the web mirror |

---

## 1. Create the project

Go to <https://itch.io/game/new> (log in as ZachsterA3 first).

| Form field | Enter |
|---|---|
| **Title** | `Earthfall Command: Last Orbit` |
| **Project URL** | `https://zachstera3.itch.io/earthfall-command` |
| **Short description or tagline** | see §2 |
| **Classification** | Games |
| **Kind of project** | **HTML** — "You have a ZIP file that will be played in the browser" |
| **Release status** | Released |
| **Pricing** | **$0 or donate** for launch (suggested donation **$2.00**). See §7 for the paid tiers. |

## 2. Short description (tagline, ≤ 160 characters)

```
Command Earth's last orbital defense network. Build weapons, launch interceptors, and stop an alien invasion before humanity loses the sky.
```

## 3. Description (long, paste into the rich-text editor)

```
Earth is under attack. Alien fleets have entered the solar system, landing forces are targeting the planet, and the world's fragile space-defense network is all that stands between humanity and occupation.

The invaders do not want to destroy Earth. They want to keep it.

In Earthfall Command: Last Orbit you lead the Space Defense Force through the first seventy-two hours of the invasion: ten escalating missions over a fully 3D, slowly turning Earth. Deploy orbital laser satellites, missile volleys, interceptor squadrons, EMP pulses and planetary shields as you defend six regions, each with its own population and strategic role.

THE PLANET IS YOUR HEALTH BAR
Lose North America and missiles cost more. Lose Europe and your satellites lose targeting range. Lose East Asia and command energy regenerates slower. Lose all six and the harvest is complete. Every choice has consequences: save one city and lose another. Spend energy now, or hold it for the carrier still approaching.

THREE ALIEN FACTIONS, THREE DIFFERENT PROBLEMS
• The Veyr Swarm — fast orange raiders that overwhelm by numbers.
• The Nhal Collective — shielded machine ships that bombard from orbit and hack your satellites.
• The Orun Harvesters — armored landing pods and vast carriers that take people, not just ground.

KEY FEATURES
• Fast tactical space-defense gameplay in a real 3D orbital view: drag to orbit, pinch to zoom.
• Ten-mission campaign: First Contact, Blackout Over Tokyo, The Atlantic Graveyard, Lunar Silence, The Harvest Begins, The Broken Alliance, Ghost Signal, The World Shield, Last Orbit.
• Two carrier boss fights with cycling shields.
• Ten upgrades to build your defense doctrine between missions.
• Three endings. You decide what humanity becomes.
• High score and campaign progress saved in your browser.
• Plays on desktop (mouse + keyboard) and on phones and tablets (touch), with no install.

A complete campaign takes about 25–35 minutes. A single mission is 2–4 minutes, so it is easy to pick up and put down.

CONTROLS
Drag to rotate the view · scroll or pinch to zoom · tap a ship to focus fire · keys 1–5 (or the buttons) select Laser Focus, Missiles, Interceptors, EMP and Planetary Shield · Space turns the camera toward the nearest threat · Esc pauses.

Made by Dr. Zahir Hasan. Built with Three.js. No ads, no tracking, no accounts.
```

## 4. Tags (itch.io allows up to 10 — use these)

```
strategy, tower-defense, space, sci-fi, aliens, 3d, singleplayer, arcade, touch-friendly, three-js
```

Optional extra tags if any of the above are rejected: `earth`, `defense`, `html5`, `browser`.

**Genre** dropdown: *Strategy*.  **Made with**: Three.js (type it in).  **Average session**: *About a half-hour*.
**Languages**: English.  **Inputs**: Keyboard, Mouse, Touchscreen.  **Accessibility**: Color-blind friendly is **not** claimed; leave unticked.

## 5. Uploads and embed settings

1. **Upload `earthfall-browser.zip`.** Tick **"This file will be played in the browser"**.
2. In **Embed options** that appear below:
   - **Viewport dimensions**: `1280` × `720`
   - **Fullscreen button**: ✅ on
   - **Mobile friendly**: ✅ on (the game is touch-aware and adapts to portrait phones)
   - **Automatically start on page load**: ❌ off (leave *Click to play*; audio needs a click to unlock anyway)
   - **Enable scrollbars**: ❌ off
   - **Orientation** (mobile): *Any*
   - **SharedArrayBuffer support**: ❌ off (not needed)
3. **Upload `earthfall-download.zip`** as a second file. Under *Kind of file* pick **Windows, macOS and Linux** (all three; it is a browser-based game that runs offline). In the file's **Display name** type `Earthfall Command — Downloadable offline edition`.
4. If you keep the launch price at **$0 or donate**, both files are free; the download is the "thank-you" version. If you move to **paid**, see §7 — the browser file can stay as a free demo while the download becomes the purchased item.

## 6. Cover image, screenshots, theme

- **Cover image**: `cover-630x500.jpg` (itch's recommended 630 × 500). Minimum is 315 × 250.
- **Screenshots**: upload the three PNGs in `screenshots/`. itch shows them on the right of the page; 3–5 is ideal.
- **Theme → Background color**: `#02040a`. **Text color**: `#d8ecff`. **Link color**: `#5fe6ff`. **Button color**: `#1a6b8f`.
- **Theme → Banner image**: not required. If you want one later, export a 960 × 400 crop of a screenshot.

## 7. Pricing plan

| Phase | Setting on itch.io | Notes |
|---|---|---|
| Launch (now) | **$0 or donate**, suggested price **$2.00** | Browser build free, downloadable build free. Builds reviews and followers. |
| After ~200 plays / first reviews | **Paid**, minimum **$2.99**, suggested **$4.99** | Keep `earthfall-browser.zip` as a **demo** (tick *"This file is a demo"*) and make `earthfall-download.zip` the paid file. |
| Enhanced edition (later) | **$4.99–$7.99** | When the full campaign gets extra regions, factions and story missions, raise the price and run a launch-week sale (itch.io → Distribute → Sales). |

Revenue share: itch defaults to 10% to itch.io; you can change it on **Settings → Revenue sharing**. Payout mode: pick **Direct to you** (PayPal or Stripe) under **Settings → Payment**. Set your **Tax info** before the first sale.

## 8. Instructions for the downloadable version (also inside the zip as README.txt)

```
EARTHFALL COMMAND: LAST ORBIT — offline edition

1. Unzip the folder anywhere (Desktop is fine).
2. Open "index.html" in a modern browser: Chrome, Edge, Firefox or Safari.
   - Double-click it, or drag it onto an open browser window.
   - It works from your hard drive; no internet connection or install is needed.
3. Click "New Campaign". Audio starts after your first click (browsers require this).
4. Progress and your best score are saved by the browser you used. Play in the
   same browser to continue a campaign.

CONTROLS
  Mouse: drag to rotate, scroll to zoom, click a ship to focus fire.
  Touch: one finger drags, pinch zooms, tap to target.
  1–5 or the buttons: Laser Focus, Missiles, Interceptors, EMP Pulse, Planetary Shield.
  Space: face the nearest threat.  Esc or P: pause.

TROUBLESHOOTING
  Black screen: your browser has WebGL disabled. In Chrome visit chrome://settings
  and turn on "Use graphics acceleration when available"; in Firefox check
  about:config → webgl.disabled = false.
  Low frame rate on a laptop: close other tabs, or plug the laptop in so the
  GPU leaves power-saving mode. The game adapts its resolution to the display.
  No sound: click anywhere in the game once, and check the 🔊 button at the top right.

Requirements: any 64-bit Windows 10/11, macOS 11+, or Linux machine with a
WebGL 2 capable browser. Roughly 1 MB on disk.

Support: zachthasan@gmail.com  ·  More games: https://zahirhasan.com/apps.html
```

## 9. Pre-publish checklist (itch.io's own rules, verified against the HTML5 docs)

- [x] The browser zip contains `index.html` at its **root** (not inside a sub-folder).
- [x] All paths are **relative** (`game.js`, `style.css`, `favicon.svg`); nothing starts with `/`.
- [x] Fewer than 1,000 files, every file under 200 MB, total under 500 MB (ours: 5 files, ≈ 0.7 MB).
- [x] No external HTTP resources; the game loads nothing from the network at all.
- [x] Filenames are plain lower-case ASCII, so case-sensitivity cannot bite.
- [x] Canvas resizes to the viewport, so **Fullscreen** and phone **Click to launch** both work.
- [x] Mobile Friendly can be ticked honestly: tested at 390 × 844 portrait with touch.
- [ ] After uploading, open the page in an **incognito window** and play one wave on desktop and on your phone.
- [ ] Tick **"Mobile friendly"** again if itch reset it when you changed the upload.
- [ ] Set **Visibility & access → Public** only after the incognito check passes.
- [ ] Add the game to the itch.io page on `zahirhasan.com/apps.html` (card + cover already prepared under `images/games/`).

## 10. Devlog / social post (optional, for launch day)

```
New game: Earthfall Command: Last Orbit — a 3D planet-defense strategy game you can play in the browser or download. Ten missions, three alien factions, six regions that each matter, three endings. Free / pay what you want on itch.io: https://zachstera3.itch.io/earthfall-command
```
