# Magnetic Chaos: Submission Guide

Magnetic Chaos is built the same way as Infinite Loot Goblin, so the account and upload steps in
`../lootgoblin/ITCH-SUBMISSION-GUIDE.md` and `../lootgoblin/PORTAL-SUBMISSION-GUIDE.md` apply as written.
Only the file names and the listing text change.

| Site | Upload this | Ads |
|---|---|---|
| **This website** | nothing to upload: `magneticchaos/` is live once merged | none |
| **itch.io** | `magneticchaos-browser.zip` (+ `magneticchaos-download.zip` for the offline edition) | none |
| **CrazyGames** | `magneticchaos-crazygames.zip` | CrazyGames SDK v3 |
| **Poki** | `magneticchaos-poki.zip` | Poki SDK v2 |

`./build.sh` rebuilds `game.js` and every zip from `src/`. Only `src/00-portal.js` (shared with Loot Goblin) and the
SDK line in `index.html` differ between the builds.

**How the ad builds behave:** the first run starts straight away; **RUN AGAIN** offers the portal an ad break;
when the sphere fails, an optional **REVIVE: WATCH AD** button refills it to 70% once per run. While an ad plays the
game freezes and is muted. If the SDK is blocked, the game plays normally with no revive button.

## Listing text

**Title:** Magnetic Chaos: Keep the Sphere

**Short description:** Steer one gravity well through hundreds of charged particles. Keep them inside the sphere.

**Long description:**
> A minimalist, hypnotic physics toy with teeth. You move a single gravity well. Hundreds of charged particles
> swirl around it: amber ones are pulled in and orbit, blue ones are pushed away. Hold the button to invert the
> well and the roles swap. Any particle that drifts past the rim is lost, and the sphere needs both charges, so
> parking the well in the middle won't save you.
>
> Every 30 seconds a new phase begins: magnetic storms that throw everything outward, fresh particles streaming
> in at the rim, and violet particles that flip their charge without warning. Green crystals refill your invert
> meter and seed new particles. How long can you keep the sphere?

**Controls:** mouse to steer; hold mouse button, Space or Shift to invert; Esc/P pause; M mute.
Touch: drag to steer, hold the INVERT button.

**Genre / tags:** Simulation · Arcade · physics, particles, relaxing, minimalist, one-button, score-attack

**Images:** `cover-630x500.jpg` (itch cover) and `screenshots/` (1280×720 plus one phone shot).
