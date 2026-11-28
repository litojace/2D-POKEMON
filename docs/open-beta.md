# Open beta

The owner (28 Nov 2026) marks the game as in open beta on the web while it
is being finished. The App Store build carries no beta mark: Apple's App
Review Guideline 2.2 keeps beta, demo and trial versions off the store
(they belong on TestFlight), and an in-app "Beta" label gets an app
rejected.

## Where it shows

- **The game on the web** (play.elementarenausa.com): a small red BETA
  sticker beside the ELEMENT ARENA wordmark on index.html's boot screen, the
  loading curtain (`server-connection.ts`), the title screen
  (`title-screen.ts`) and the sign-in screen (`home-screen.ts`). It is not
  in the battle HUD or the Lobby's top bar. Settings → About gets one "Open
  beta" line with the support link (the gear-menu remodel, gated on the
  same flag).
- **The website** (`apps/site`): an "Open beta" sticker beside "Free to
  play" and one line under the hero's buttons (docs/website.md, "Open
  beta").
- **README.md**: the line under "Play now".

What the line promises is true of the code: progress lives on the server
(Supabase), and nothing plans a wipe. The only reset is the monthly ranked
soft reset (`arena_season_reset()`, `supabase/migrations/006_ratings.sql`).
A guest who logs out or clears the browser loses that guest account, as
always; the copy says progress "carries over through every update", not
that a guest's device can't lose it.

## The flag

One flag, `OPEN_BETA` in `apps/client/src/open-beta.ts`, from the build:

- **Web build** (`npm run build`, Render): Vite's mode is `production`, the
  flag is on.
- **Store build**: the iPhone app is built with `npm run ios:build`, which
  runs `vite build --mode ios`. The flag is off in the modes listed in
  `STORE_MODES` (`ios`, `android`). A future store build must use one of
  them (or be added to the list).
- **Inside the Capacitor shell** the flag is off at runtime too, whatever
  the bundle says, so a web bundle copied into the app by mistake still
  shows no BETA.
- **index.html's boot screen** draws before any script: Vite writes the
  build's mode on `<html data-build="%MODE%">`, and the boot screen's
  inline style hides its tag in each store mode.

Code that shows a beta mark uses `betaTag()` or `OPEN_BETA`, never its own
markup. The sticker is `apps/client/src/open-beta.css` (its place on the curtain
and boot screen there too); its place on the title and sign-in screens is
Poster's, `themes/poster/open-beta.css`. `tests/unit/open-beta.test.ts` checks the rule, that `build:ios`
uses a store mode, the boot screen's hiding rule, and that no other code
writes the tag; `tests/visual/open-beta.spec.ts` checks the tag sits clear
of the wordmark's letters, whole on screen, at 667 × 375, 844 × 390,
852 × 393 (Dynamic Island), 844 × 280 and 1440 × 900.

## Removing it

When the game leaves beta, delete `open-beta.ts`, `open-beta.css`, their
tests, the boot screen's tag and its rules, and the copy on the website and
in the README.
