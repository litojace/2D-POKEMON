# Loading screens: the startup curtain

Opening the game used to show four different screens in about two seconds
(an HTML "Entering the arena…" page, the plaza front door with "Checking your
account…", a starfield "Opening the arena…" panel, then the Lobby), and the
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
2. `startStartupCurtain` (`startup-curtain.ts`) holds the curtain
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

5b. **Every Lobby panel is ready when the curtain lifts** (owner, 28 Nov:
   a tap on any tile must never show a wait). At sign-in, beside the
   profile's own load, `AccountUI.warmLobby` asks for each panel's data the
   way the panel does (the player card's records, name status and first
   page of matches; Friends; Ranks, both boards; the Raids panel's friends)
   and loads the code of the screens that load on demand (Raids, the Shop,
   the Journey). Once the scene is complete the curtain waits for that too,
   at most 1.5 s more (`LOBBY_WAIT_MS`), with "Getting the Lobby ready…" on
   the bar while it does; a slow or failed answer never holds it longer,
   and `CURTAIN_CAP_MS` still caps everything. Data only: it is small JSON,
   no pictures are decoded ahead. Never during a battle (a room rejoined at
   startup): the warm-up waits for the battle to end and the curtain
   doesn't wait for it.
   Each panel then opens on the copy it has, whatever its age, and asks
   again behind it once the copy is older than `COPY_MAX_AGE_MS` (30 s;
   Friends 10 s). An answer the same as the last one is the same object
   (`server-copies.ts`), so the panel draws nothing again; a changed one is
   redrawn in place. A POST, the server saying records changed, and another
   account forget the copies as before; another account also forgets what
   was drawn from them. `tests/visual/lobby-ready.spec.ts` opens each panel
   the moment the curtain lifts, with every API answer 600 ms late, and
   fails on any loading state or a panel built again after its first frame.

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
7. **No tips** (27 Nov 2026). The curtain showed a gameplay tip while it
   loaded (`loading-tips.ts`, 20–27 Nov); the owner took them out of the
   game: over a painting the tip and the status line covered the art. The
   curtain still never waits for a tap: the game opens as soon as its first
   screen is complete (the owner, 20 Nov: enter by itself, no "Tap to
   enter"; it still waits for the fighter, skins and pictures, so nothing
   pops in). `index.html`'s first inline script still reads
   `localStorage["ea-loading-tips"]` and sets a class nothing uses: it is
   left as it is because inline scripts are allowed by hash (CLAUDE.md);
   take the line out the next time that script has to change anyway.

8. **Paintings** (`loading-art.ts`, 20 Nov):
   hand-painted pictures, made in ChatGPT, of champions in Legendary and
   Mythical Shop skins fighting in the PvP modes
   ([loading-art-prompts.md](loading-art-prompts.md)). With one, the curtain
   takes its painting layout: the painting fills the screen and stays
   clear; the star and the title stand top right in their ink block; along
   the bottom a loading bar across the whole width, the runner on it, and
   one status line UNDER it at its left end (the owner, 27 Nov; before that
   the owner's style K of 20 Nov had the line over the bar and a tip above
   it). Each startup step replaces the last status with a short cross-fade,
   each shown at least 0.8 s so every step can be read (the curtain lifts
   once the status on screen has had its time), then the bar holds full for
   a beat and the curtain fades in 0.45 s. A shade along the bottom keeps
   the line readable on any painting. Every painting has the same chance,
   never twice in a row. The next start's painting is chosen and downloaded
   once the game is up (`ea-next-art`), so it is on the device before that
   curtain needs it; a first start shows the plain cover. The painting
   fades in once decoded; a missing one leaves ink behind the same layout.
   index.html's boot screen reads the same key and takes the same layout,
   so nothing moves at the hand-over either.
   Paintings are named `startup-art-<scene>.webp` in `src/art/loading-art/`:
   a scene shows only once its picture is there. The service worker does
   not install them with the game (thirteen are 3 MB): it keeps the one each
   start downloads for the next (`sw.ts`, `arena-startup-art-v1`).

The status line shows the bar's percentage beside it once the server has
answered (while it wakes up the bar is only an estimate, so no number).
Not downloaded megabytes: the curtain waits on answers (account, profile,
connection, drawing the Lobby), not on a download; the web app's offline
files come in the background and never hold it.

`tests/visual/startup-curtain.spec.ts` records every uncovered frame from
the start and checks the hub is only ever seen complete, from the saved copy
too, that the curtain never waits for a tap, the runner, the painting
layout and the next painting chosen ahead; `tests/unit/loading-art.test.ts` checks the
scenes' skins and that choices are even.

## The other loading moments

The same rule after startup: the player never watches a screen being put
together, and no cover ever traps them.

- **Logging in, another account, a dropped connection.** When the front
  door would show "connecting" or "loading" (a log-in from the front door,
  signing in as another account, the hub's connection lost, say when the
  app comes back from the background), `renderGate` holds the same curtain
  again (`startStartupCurtain(..., again)`): painting, runner and status line,
  fading in over what was showing, lifted the same way once the Lobby is
  complete, and capped the same way. A front-door screen that needs the
  player (signed out, another device) lifts it at once.
- **Raid and Spire briefings.** _I'm ready_ reads "Loading the arena · N%"
  and waits, as the PvP Reveal does, until the battle engine, every
  fighter's art and the boss's illustrated floor are in (`briefing-ready.ts`,
  `arenaLoading` in main.ts, `scene.floorPending`); capped by
  `ARENA_WAIT_MAX_MS`.
- **Solo test mode.** It has no briefing, so a full-screen cover with the
  same progress line stays over the court until the arena has loaded
  (`#arena-overlay.is-practice-loading`).
- **Back to Raids after a raid.** The Raids screen's code loads while the
  server answers the leave (`AccountUI.loadRaids`), and the screen opens in
  place (`openHubPanel({ instant })`), in the same frame as the Lobby:
  never the bare Lobby first, nor the screen sliding in again.
- **Your fighter after any battle.** The Lobby is built again, and its
  live rig takes a moment: the still artwork stays hidden meanwhile (at
  most `ARRIVE_MS`, then it shows, as on Low graphics), and the fighter fades
  in once, already moving, instead of being swapped from still to live in
  front of the player.

`tests/visual/battle-cover.spec.ts` checks the briefing, Solo test mode, the
return to Raids and the fighter frame by frame; `startup-curtain.spec.ts`
checks the log-in and the dropped connection.

## How the startup screens look (27 Nov 2026)

One screen in two layers, both in the game's Poster look whatever look the
page wears: `index.html`'s boot screen (its inline `<style>`, drawn before
any code) and the curtain (`server-connection.css`). Ink, gold, Anton
capitals, a square bar with a hard shadow; no artwork of their own. A first
start (no painting yet) is the gold cover in halftone; later starts show
the painting chosen the start before. Both draw the name in the two font
files at `public/assets/fonts/anton-latin-…` and `archivo-latin-…`, the
same files the look itself uses (`themes/poster/fonts.css`), fetched once.
Changing the boot screen's `<style>` or markup needs no new CSP hash (only
the inline scripts are hashed); keep the two layers' boxes in the same
places (`startup-curtain.spec`, "hands over without moving").

**The runner** (`startup-runner.ts`, the owner's idea): the fighter this
device showed last (`arena-featured-fighter`; Voltkit on a first start), in
the skin it wears once the profile or this device's copy of it names one,
in the game's own side view facing right (`creatureSvg(id, "right")`, the
battle rig's profile art, so nothing is downloaded). It stands on the bar
at the end of the fill and glides with it; while the bar moves it runs
(the rig's own swing of arms and legs, lean and bounce, slower), and it
stands and breathes while the bar waits. It is drawn by the game's code,
so the boot screen has none: it steps onto the bar when the curtain
arrives. Reduced motion and Low graphics (`data-ui-effects="light"`): it
stands still and only glides. A stopped start (failed, offline) shows no
runner. `loading-preview.html?p=0.6&f=pyranda&art=rest-hoi-an` holds the
curtain still to look at.

## Adding to the first screen

Anything new the Lobby shows on entry and that comes from the server should
be part of the profile load (`AccountUI.loadSession`, before `checked`), not
loaded after the hub appears, or it will pop in after the curtain. If it
should show from the saved copy too, add it to `ProfileCopy` (and bump
`PROFILE_COPY_VERSION` when the stored shape changes). New
pictures on the first screen are decoded by `sceneSettled` automatically if
they are `<img>` elements (not `loading="lazy"`). Keep the whole wait short:
the curtain is a cover for loading, not a reason to load more.
