# Loading screens: the startup curtain

Opening the game used to show four different screens in about two seconds
(an HTML "Entering the arena…" page, the plaza front door with "Checking your
account…", the starfield "Opening the arena…" panel, then the Lobby), and the
Lobby kept changing after it appeared: "Log in / Sign up" turned into the
player's profile and coins, the default fighter (Voltkit) swapped for the one
the account last picked, the Journey card and the worn skin arrived last.

Measured in the visual harness with 250 ms per request (Nov 2026): the Lobby
was drawn at about 1.75 s, the saved fighter arrived at about 1.95 s and the
Shop record (coins, skins) at about 2.5 s. The Lobby only waited for the
account and the socket, while the raids, Spire and Shop records loaded one
after another and the saved fighter and avatar were not waited for at all.

## What other games do

- **Hold the splash until the home screen is complete.** Supercell describes
  Brawl Stars loading its UI, textures, sounds, models and animations while
  it connects to the server, before any menu is shown
  ([Titan game engine](https://supercell.com/en/news/titan-game-engine/)).
  The common pattern in big mobile games (an observation from playing them,
  not something the studios document) is one branded screen with a progress
  bar that opens on a home screen already in its final state: your look,
  your currency, your fighter.
- **Gate on readiness, not on a timer.** The screen ends when a checklist of
  things the first screen needs is done, with a safety cap so it never traps
  a player (Roblox's loading-screen guide uses a forced timeout for the
  same reason:
  [Roblox loading screens](https://create.roblox.com/docs/players/loading-screens)).
- **A fade hides the swap.** A short fade covers the moment the scene behind
  changes; it should be quick, since a slow transition repeated often
  becomes tedious
  ([screen transitions that feel good](https://bugnet.io/blog/how-to-implement-screen-transitions-that-feel-good)).
- **Progress, not just a spinner.** Waits of over a second need feedback;
  long ones a percent-done bar
  ([Nielsen Norman Group, response times](https://www.nngroup.com/videos/3-response-time-limits-interaction-design/)).
  The bar must never move backwards.
- **No half-drawn pictures.** `img.decode()` resolves once an image is safe
  to show without a blank or partial frame
  ([MDN, decode()](https://developer.mozilla.org/docs/Web/API/HTMLImageElement/decode)).

## How Element Arena does it

1. `index.html`'s boot shell shows the same title and line as the curtain
   while the code downloads (it remains the retry page when code fails).
2. `startStartupCurtain` (`startup-curtain.ts`) holds the starfield panel
   (`server-connection.ts`) from the first frame. A healthy server no
   longer removes it; the bar moves through the startup steps:
   server (30%) → account → profile (50%) → connection (72%) → scene (88%).
3. The hub is not drawn before `AccountUI.checked`, which now also waits
   (up to 4 s) for the saved fighter and avatar. The raids, Spire and Shop
   records load together, so the profile takes one round trip, not three.
4. When the first real screen is drawn underneath, `sceneSettled` waits for
   fonts, decodes the pictures on screen and waits for the Lobby fighter's
   live rig (`.is-ready`), at most 2.5 s; then the bar fills and the curtain
   fades in 300 ms (it takes taps as soon as the fade starts).
5. Signed out, the curtain lifts as soon as the front door can show its
   sign-up / log-in panel. A server that is waking up, offline or failed
   keeps its own status and retry button. Once the server has answered, the
   curtain waits at most 12 s (`CURTAIN_CAP_MS`) and then shows whatever the
   game has.

`tests/visual/startup-curtain.spec.ts` records every uncovered frame from
the start and checks the hub is only ever seen complete.

## Adding to the first screen

Anything new the Lobby shows on entry and that comes from the server should
be part of the profile load (`AccountUI.loadSession`, before `checked`), not
loaded after the hub appears, or it will pop in after the curtain. New
pictures on the first screen are decoded by `sceneSettled` automatically if
they are `<img>` elements (not `loading="lazy"`). Keep the whole wait short:
the curtain is a cover for loading, not a reason to load more.
