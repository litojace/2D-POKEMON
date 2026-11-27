# The game's looks (Poster and Showcase)

The owner saw the whole game in two looks (26 Nov 2026), liked both and asked
for both: a player picks one in a dialog after creating an account, and can
change it in Settings at any time. The approved screenshots, the demo CSS
that made them and the agreement between the two sessions building them are
on the branch `claude/ecstatic-shannon-3ieyzd`,
`docs/ui-remodel/themes-demo/README.md` (10 MB of pictures, kept off main).

Code: `apps/client/src/ui-theme.ts` (the choice), `ui-theme-picker.ts` (the
dialog and Settings' row), `themes/<id>/` (each look). Tests:
`tests/unit/ui-theme.test.ts`, `tests/visual/ui-theme.spec.ts`.

## How a look is chosen and shown

- The page carries `<html data-ui="poster">` or `data-ui="showcase"`. No
  attribute is the look the game has always had. It stays underneath every
  theme and is not offered to players (ask the owner before removing it).
- The choice is kept on the device (`localStorage`, `ea-ui`), like the
  graphics setting: no migration, and a second device asks again.
- `applyUiTheme()` runs first thing in `main.ts`. It loads the chosen
  theme's stylesheet (its own chunk), puts it in `<style id="ui-theme-css">`
  and then sets the attribute. `setUiTheme(id)` does the same live, swapping
  the stylesheet, so **the other look's rules are never in the page**: all
  CSS counts in battle (`CLAUDE.md`, "Keeping battles smooth").
- It is not an inline script in `index.html`: those are allowed by hash in
  the Content-Security-Policy and in Render's headers. The price is that
  the stylesheet arrives a moment after the first paint; the startup curtain
  covers the game for longer than that.
- `--el` on `:root` is the Lobby fighter's element colour (the Lobby keeps
  it in step; gold before a Lobby has shown a fighter). `--ui-coin` and
  `--ui-coin-deep` are the coins' own gold, so a theme can re-point the
  accent without Tidefin's coins turning blue.

## Ready, and what players see before that

Each theme in `UI_THEMES` has a `ready` flag, off until the owner has seen
the full set of screenshots from the real build and says so
(`tests/unit/ui-theme.test.ts` lists the ready looks: change it in the same
pull request).

- A theme that is not ready is never chosen for a player: the picker and
  Settings don't offer it, and a saved choice of it is ignored.
- The picker and Settings → Display → Look appear only while **two** themes
  are ready. Until then nothing in the game changes.

For work in hand:

| Address         | What it does, for one page load                                 |
| --------------- | --------------------------------------------------------------- |
| `?ui=poster`    | Shows that look, ready or not; nobody is asked                  |
| `?ui=classic`   | Shows the look underneath                                       |
| `?ui-preview=1` | Offers every theme: the picker and Settings behave as at launch |

## The picker: where it sits in a new player's first minutes

A new player's first minutes (`docs/onboarding.md`, `docs/player-funnel.md`):
guest pass warning, Lobby tour, PLAY against an Easy bot (one round).
Guests are where new players drop, so nothing may stand between them and
that first match for long.

The picker comes **after the guest warning and before the Lobby tour**:

- It costs one tap: two pictures of the Lobby, a name and a line each; a tap
  chooses and closes. No confirm button, no close button, and Escape does
  nothing: it asks one thing, and Settings changes the answer.
- Before the tour, so the tour's spotlights and the first match are already
  in the look they chose, and the screen doesn't change under them later.
  After the first match would cost nothing before it, but the game would
  change its face right after the player's first win, and "right after
  creating an account" is what the owner asked for.
- It waits its turn like the tour and the "Unlocked" dialog do: on the
  Lobby, with no dialog, panel, reward or warning in front. The tour and
  "Unlocked" wait for it.
- **An account that was here before the looks** is asked the same way, once,
  the next time its Lobby is free. Asked is remembered per account on the
  device (`ea-ui-asked:<account>`); a second account on the same device is
  asked too, with the device's current look marked.

The visual harness marks its account as asked
(`tests/visual/harness/look-asked.ts`, the first thing its page loads), so
the picker doesn't open over every spec's Lobby, whichever way a spec gets
there; a test about the picker sets `window.__lookAsk` before the page loads.

**Poster is the game's look** (27 Nov 2026). The owner first said to turn
both looks on, then, the same evening, to drop Showcase and switch to Poster
for good. So:

- `DEFAULT_UI_THEME` is `"poster"`: every player gets it, with nothing saved
  and nobody asked. It ships in the game's own script and is on the page
  before the first frame.
- Showcase's `ready` is off and its folder is being removed. With one ready
  look the picker and Settings' Look row stay away; their code sleeps until
  it is removed with Showcase.
- The look underneath is still in the page under Poster. Deleting it is a
  job of its own, after the visual suite has moved (below).
- **The revert** is one line: `DEFAULT_UI_THEME = null` puts every player
  back on the look underneath.

**The visual suite still measures the look underneath.** Its 200 files were
written against that look's sizes and places, so the harness saves
`ea-ui=classic` for its page (`harness/look-asked.ts`) and they run as
before. What checks Poster today: `poster.spec.ts` (the Lobby, five screens,
Settings, a new player's locks, at four sizes), `ui-theme.spec.ts` (the
default, from the first frame), and any spec run with `VISUAL_UI=poster`
(`helpers.ts`), which is how the budgets and `panel-scroll` were run before
the switch. Moving the suite to Poster, spec by spec, is the next job; a
spec that has moved drops the pin by setting `window.__lookDefault`.

## A theme's folder

`apps/client/src/themes/<id>/`:

- `index.ts` exports `css`, the whole stylesheet as text
  (`import css from "./theme.css?inline"`). More files: `@import` them from
  `theme.css`.
- Every selector sits under `:root[data-ui="<id>"]`; no `backdrop-filter` but `none`
  and no animation that runs for ever (`tests/unit/ui-theme.test.ts` checks
  all three).
- `preview.webp`: the Lobby in this look, for the picker (560 px wide, cut
  from a screenshot of the real build with the look on; Poster's is, since
  27 Nov).
- Fonts are self-hosted woff2 (latin and Vietnamese subsets) with their OFL
  licence files, inside the folder (`font-src 'self'` is already allowed).
- Markup a theme needs that the look underneath doesn't goes into the shared
  markup, hidden by default, and the theme shows it.

Checks for each theme: the screens at 667×375, 844×390, 852×393 with the
island inset and desktop, looked at box by box; `battle-style-budget` and
`panel-open-budget` with the theme on; one sweep spec per theme.

## Poster (`themes/poster/`)

Ink black and the Lobby fighter's element colour, nothing rounded, hard
offset shadows; Anton capitals and Archivo text. Files: `fonts.css` (and
`fonts/`, with the two OFL licences), `tokens.css` (the shared tokens
re-pointed: most of the look), `kit.css` (panels, tabs, buttons, tiles,
rows, toast), `lobby.css` (the Lobby and the hub's top bar), `screens.css`
(what single screens, the battle HUD, the result and raid sheets and the
raid room need). Sweep: `tests/visual/poster.spec.ts`.

- The Lobby's ink slab and its white stripe are pseudo-elements; the only
  markup the look adds is `.lobby-bigname` in the Lobby's backdrop (the
  fighter's name, hidden in the look underneath).
- The Lobby's cards keep the look underneath's widths on phones: the notice
  above the stage is sized to clear them.
- Three `!important`s, each with its reason beside it: PLAY's colour and
  font (the Lobby sets them so) and the rank's name on your own row of the
  ladder (its colour is inline).
- Inside a Fighters card `--el` is that card's element colour
  (`roster-view.ts` sets it), not the Lobby fighter's.
