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

6. **This device's copy of the profile** (`profile-copy.ts`): what the first
   screen shows (account, coins, worn skins, raid look, Journey and missions
   cards, Spire card, avatar, the account's fighter) is kept in
   `localStorage` whenever it changes. The next start draws the hub from it
   at once while the fresh profile loads (`AccountUI.fromCopy`), so the
   curtain no longer waits for the profile's round trips. It still gives the
   fresh copy up to 800 ms (`COPY_GRACE_MS`): on a quick connection nothing
   changes on screen; on a slow one only what changed on another device
   updates after. The copy is only used for the same account, for 30 days,
   in the same format version; a fresh profile that fails to load drops it
   (the front door offers to try again, as before), a refused login and
   signing out forget it.
7. **Tips** (`loading-tips.ts`): short, one or two lines, text only (the
   owner, 20 Nov: no illustrations). Each start shows the next one, and the
   curtain stays until it has been read (`tipReadMs`: a beat plus about a
   fifth of a second a word, 2.5–5 s; about 3.9 s on average for the current
   tips, down from 6), even when loading is quicker. Once loaded it says
   "Ready! Tap to enter" and a tap goes in at once. A long load moves to the
   next tip. Every number in a tip is built from the server's rules
   (`RULES`) and `tests/unit/loading-tips.test.ts` checks each claim against
   the server's simulation (where and when orbs appear, what they give).
   Every player waits for the tip alike, new or returning. Only the visual
   harness sets `localStorage["ea-loading-tips"] = "off"`, unless a test
   turns them on.

8. **Paintings** (`loading-art.ts`, the owner's choice of style E, 20 Nov):
   hand-painted pictures, made in ChatGPT, of champions in Legendary and
   Mythical Shop skins fighting in the PvP modes
   ([loading-art-prompts.md](loading-art-prompts.md)). With one, the curtain
   takes its painting layout: the painting fills the screen and the title,
   the tip (mid-column, so its length never moves the bar) and the bar stand
   in a column on the right over a darker band; there the tip is a caption
   with a gold line on its left, not a box (owner's choice, 20 Nov). Every painting has the same
   chance, never twice in a row. The next start's painting is chosen and
   downloaded once the game is up (`ea-next-art`), so it is on the device
   before that curtain needs it; a first start shows the starfield. The
   painting fades in once decoded; a missing one leaves the starfield behind
   the same layout. Tips suit the painting's mode (`LoadingTip.modes`: no
   1v1 orb tip over a 2v2 painting). index.html's boot screen reads the same
   key and takes the same layout, so nothing moves at the hand-over either.
   Paintings are named `startup-art-<scene>.webp` in `src/art/loading-art/`:
   a scene shows only once its picture is there, and the service worker
   installs them with the game (`PRECACHED_ART`).

`tests/visual/startup-curtain.spec.ts` records every uncovered frame from
the start and checks the hub is only ever seen complete, from the saved copy
too, that a tip holds the curtain until read, the painting layout and the
next painting chosen ahead; `tests/unit/loading-art.test.ts` checks the
scenes' skins and that choices are even.

## Adding a tip

Add it to `LOADING_TIPS`, build any number from `RULES` (never type it), keep
it under 22 words, and add a check of its claim to
`tests/unit/loading-tips.test.ts`.

## Adding to the first screen

Anything new the Lobby shows on entry and that comes from the server should
be part of the profile load (`AccountUI.loadSession`, before `checked`), not
loaded after the hub appears, or it will pop in after the curtain. If it
should show from the saved copy too, add it to `ProfileCopy` (and bump
`PROFILE_COPY_VERSION` when the stored shape changes). New
pictures on the first screen are decoded by `sceneSettled` automatically if
they are `<img>` elements (not `loading="lazy"`). Keep the whole wait short:
the curtain is a cover for loading, not a reason to load more.
