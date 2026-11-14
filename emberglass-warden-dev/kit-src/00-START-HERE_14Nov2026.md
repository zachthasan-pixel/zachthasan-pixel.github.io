# Emberglass Warden — start here (14 Nov 2026)

Emberglass Warden is your first-person saber arena game, built from your Gemini Canvas "Warden Blade" idea.

## Try it first
Open `4-Game-Files-and-Reports/Play-in-browser/` and double-click `index.html`.

## Order of work

| Step | Portal | Folder | Status |
|---|---|---|---|
| 1 | itch.io (instant, gives the public link) | `1-itch.io` | Ready to upload |
| 2 | Poki (a form; needs the itch link) | `2-Poki` | Ready after step 1 |
| 3 | CrazyGames (strict review — do last) | `3-CrazyGames` | Ready; first try the game on your Mac and phone |

Each folder has its own guide that lists every field on every screen with text to paste.

## Decisions already applied
- Developer name: Zahir Hasan. Team: just me, Japan. No registered company.
- itch.io price: free in the browser, free download, donations welcome (suggested 2.00).
- No ads and no reward buttons in any build (CrazyGames Basic Launch rule). The Poki build has only the standard break after FIGHT AGAIN.

## What could not be tested here
- Sound by ear (it is synthesised; only checked that it starts without errors).
- Real mouse feel, a real phone, Safari, a Chromebook. The tests ran in headless Chromium with scripted players.
- The portals' real SDKs (tested against stand-ins that record the event order).

## Honest quality note
Two independent reviewer agents played the first build and said it would be rejected: the wave-5 boss was a wall, runs lasted about 75 seconds and blocking was never taught. Those points were fixed and re-measured (see TEST-REPORT). The game has one arena (five colour themes), five beasts and two bosses; CrazyGames may still ask for more content. If it does, send me the exact wording.

## Extra resources used (cost)
- Higgsfield: about 197 credits earlier (concept art and five 3D models) plus about 8 credits on 14 Nov for the three cover illustrations.
- Two reviewer agents and one research agent.

## Where the files live
Branch `emberglass-warden-wip` of the site repository, folder `emberglass-warden-dev/submission-kit/`. The single download is `EmberglassWarden_14Nov2026_all-kits.zip`.
