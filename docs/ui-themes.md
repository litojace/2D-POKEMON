# The game's look: Poster

Every player gets Poster (owner, 27 Nov 2026). The owner had seen the whole
game in two looks, Poster and Showcase, and first asked for both with a
choice; the same evening they chose Poster alone, for good: "Thôi bỏ
showcase đi, đổi vĩnh viễn qua poster luôn" (drop Showcase, switch
permanently to Poster), then "xóa showcase ra khỏi code, chỉ giữ lại
poster". Showcase, the look picker, Settings' Look row and the "asked" flags
are gone from the code (pull request #564; Poster went live with #553). The approved screenshots and the demo CSS are on the
branch `claude/ecstatic-shannon-3ieyzd`, `docs/ui-remodel/themes-demo/`.

Code: `apps/client/src/ui-theme.ts`, `themes/poster/`. Tests:
`tests/unit/ui-theme.test.ts`, `tests/visual/ui-theme.spec.ts`,
`tests/visual/poster.spec.ts`.

## How the look is shown

- The page carries `<html data-ui="poster">`. No attribute is the look the
  game had before, which stays underneath Poster until the visual suite has
  moved to Poster. **Ask the owner before removing it.**
- `applyUiTheme()` runs first thing in `main.ts`. Poster's stylesheet ships
  in the game's own script, so it goes into `<style id="ui-theme-css">` and
  the attribute is set before the first frame.
- It is not an inline script in `index.html`: those are allowed by hash in
  the Content-Security-Policy and in Render's headers.
- The Lobby fighter's element colour (`setUiElementColour`, which the
  Lobby keeps in step). The look underneath draws its accents with it, as
  `--el` on `:root`. Poster's chrome has colours of its own (`fixedChrome`,
  below), so for Poster it is `--fighter`, written by one rule in
  `<style id="ui-fighter-colour">` on the few places that still show it
  (`FIGHTER_COLOUR_HOSTS`: the Lobby, the raid room, the battle's sheets)
  and never on the root: a custom property on the root restyles every
  element on the page at each fighter switch. `--ui-coin` and
  `--ui-coin-deep` are the coins' own gold.
- **The revert** is one line: `DEFAULT_UI_THEME = null` in `ui-theme.ts`
  puts every player back on the look underneath.

| Address       | What it does, for one page load |
| ------------- | ------------------------------- |
| `?ui=poster`  | Shows Poster                    |
| `?ui=classic` | Shows the look underneath       |

`ea-ui` on the device can hold `classic` (the look underneath); players
have no way to set it. Anything else saved there (a tester's `showcase`)
gets Poster.

## The visual suite still measures the look underneath

Its 200 files were written against that look's sizes and places, so the
harness saves `ea-ui=classic` for its page (`tests/visual/harness/look-asked.ts`,
the first thing its page loads) and they run as before. What checks Poster
today: `poster.spec.ts` (the Lobby, five screens, Settings, a new player's
locks, at four sizes), `ui-theme.spec.ts` (the default, from the first
frame), and any spec run with `VISUAL_UI=poster` (`helpers.ts`).
`VITE_VISUAL_LOOK=poster`, set where the harness's server starts, runs the
whole suite on Poster. Moving the suite to Poster, spec by spec, is under
way: a spec that has moved calls `onPlayersLook()` once at its top
(`tests/visual/players-look.ts`), which drops the pin (`window.__lookDefault`)
for every page its tests open, contexts they make themselves included.
`players-look.ts` is not the shared harness, so a moved spec keeps its pull
request in the fast lane. Slice 1, a new player's flows (welcome, the guest
warning, the tour, feature unlocks, getting started, the first PvP match,
the daily gift, dialogs, the startup curtain and recovery, the Journey, the
Lobby and its safe areas, poster), moved in #569; slice 2, the hub screens
(the Shop and fitting room, the roster, raids, Ranks and Friends, the
Profile, Missions, Match history, panel-scroll, phone-fit, text-collisions),
in #581; slice 3, the match screens (the results sheets, the battle badge,
rooms, the party flow, the Reveal), in #601; slice 4a, the raids, in #607; slice 4b, the Spire, the rank road and
the rewards, in #632. `ui-theme.spec.ts` sets
its look itself and tests the pin; it moves with the PR that removes it.

**The budgets measure Poster** (27 Nov 2026): `battle-style-budget`,
`match-flow-budget` and `panel-open-budget` call `playersLook(page)`
(`tests/visual/players-look.ts`) and fail if the page shows another look, so
CI counts what players' phones pay for. `PLAYERS_LOOK` there follows
`DEFAULT_UI_THEME` (`tests/unit/ui-theme.test.ts` holds them together: the
revert changes both). `VISUAL_UI=classic` still measures the look
underneath, to compare. Measured side by side before the switch, on the
cloud container: a duel restyles 4 elements per recalculation at the
median, 16 at p90 and 59 at most in Poster (three runs), 4 / 16 / 59 to 61
underneath; a match reads the layout 0 times per frame in both; a repeat
open of a panel lays the page out 0 to 6 times in Poster, 0 to 5
underneath (the limit is 12). The numbers are on pull request #553. Not
moved: `effect-budget` (it counts the effects engine's own work in the
battle canvas, which no look touches) and the frame-rate profiles
(`battle-performance`, `pvp-performance`, `lobby-perf`).

## Poster's folder

`apps/client/src/themes/poster/`:

- `index.ts` exports `css`, the whole stylesheet as text
  (`import css from "./theme.css?inline"`). More files: `@import` them from
  `theme.css`.
- Every selector sits under `:root[data-ui="poster"]`; no `backdrop-filter`
  but `none` and no animation that runs for ever (`tests/unit/ui-theme.test.ts`
  checks all three).
  - **One exception, by the owner's leave (27 Nov 2026):** the title
    screen's sunburst turns once in 100 s (`poster-cover-turn` in
    `onboarding.css`), "to feel alive". It is allowed because it cannot
    reach a fight or a screen you read: it runs on the title screen only
    (never behind the sign-in form), on a layer of its own that the
    compositor rotates without drawing it again, and it is gone with the
    title screen, which leaves the page before the Lobby. It stops with
    Settings → Reduce motion and on Low graphics
    (`ui/light-effects.css`). The unit test names this one animation and
    fails on any other; `tests/visual/poster-title.spec.ts` checks where it
    runs and where it stops.
- Fonts are self-hosted woff2 (latin and Vietnamese subsets) with their OFL
  licence files, inside the folder (`font-src 'self'` is already allowed).
- Markup Poster needs that the look underneath doesn't goes into the shared
  markup, hidden by default, and Poster shows it.

Checks for a change: the screens at 667×375, 844×390, 852×393 with the
island inset and desktop, looked at box by box; `battle-style-budget` and
`panel-open-budget`; `poster.spec.ts`.

## Poster (`themes/poster/`)

Ink black, cream paper, the game's gold and a hot red; nothing rounded,
hard offset shadows; Anton capitals and Archivo text.

**One chrome for every fighter** (owner, 27 Nov 2026, "direction G"; the
chrome used to be the Lobby fighter's colour, and with Voltkit the whole
game was yellow):

- **Cream** (`--paper`): words on ink, the Lobby's clippings, and `--el`,
  the accent of every chosen thing (a chosen tab, the open screen on the
  rail, a pressed chip, a picked tile's frame).
- **Gold** (`--gold`): what to press (a primary button, PLAY), coins and
  progress.
- **Red** (`--hot`): the level badge, a sale, leaving. Nothing else.
- **A masthead** is ink with cream words and a cream rule under it
  (`--head-bg`, `--head-ink`, `--head-dim`; what sits on it is `--head-box`).
  The chosen tab is a cream block standing on that rule.
- **A fighter's element colour only where it means the fighter**: what
  carries its own `--el` (a stage, a Fighters card, an element chip, a
  boss's banner), and the Lobby fighter's (`--fighter`) on the Lobby's
  field, name plate and seats, the raid room's backdrop and the battle's
  sheets (a win is a sheet of it; their main button is gold all the same).
  The title and sign-in screens are the game's gold.
- **The field is softened**: where the Lobby fighter's colour fills a
  whole screen (the Lobby, the raid room, a win's sheet) it is `--field`,
  20% of the way to the cream (`color-mix(in oklab, …)`; in oklch the hue
  travels an arc and Water's cyan turned green), so it sits calmer beside
  the party's other fighters. The name plate and the seats keep `--fighter`
  whole.
- **Voltkit's field is a lemon of its own** (`POSTER_FIELD` in
  `lobby-screen.ts`): its colour is the game's gold, and PLAY and the XP
  bar sat on a field of the same gold. Its art, card and chip keep its own
  colour; the look underneath is not touched.
- **One white**: words on ink are the cream (`--ui-text`), as light
  surfaces are. Pure white stays only on red fills, where cream misses AA.
- **A panel's board** (`--board`, `--board-dots`) is a step lighter than
  its masthead, with a faint halftone. Files: `fonts.css` (and
  `fonts/`, with the two OFL licences), `tokens.css` (the shared tokens
  re-pointed: most of the look), `kit.css` (panels, tabs, buttons, tiles,
  rows, toast), `lobby.css` (the Lobby and the hub's top bar), `screens.css`
  (what single screens, the battle HUD, the result and raid sheets and the
  raid room need). Sweep: `tests/visual/poster.spec.ts`.

- **Bare icons on scenes, blocks in panels** (owner, 27–28 Nov 2026: "drop
  the black circle, keep just the icon a little bigger, with a bit of
  shadow"; then "this icon style fits, where else does it apply?"):
  - **Bare:** a control drawn straight on a scene (the playfield, the
    Plaza, the Lobby's field, a fighter's stage) has no block behind it.
    Its icon is cream with an ink outline and a hard drop, a size up from
    its block version. Its word (if it has one) is cream with an ink
    stroke, and it turns gold under a finger or while it is open. Today:
    the battle's chat and gear, the Plaza's HUD (Map, Gifts, Album, Today,
    the clock, the fishing count), the top bar's chat and gear, and the ‹ ›
    beside the Lobby fighter and on the Fighters stage.
  - **One recipe** (`tokens.css`): `--bare-ink` (cream), `--bare-hot`
    (gold), `--bare-icon-edge` (the outline, a `filter` for an icon),
    `--bare-word-edge` (the same as a `text-shadow` for words) and
    `--bare-chevron` (a drawn ‹, as a `clip-path`). A new bare control
    reads these: no copies of the shadows.
  - **The box stays:** a bare button keeps its box, so its tap area stays
    44 px (with `phone-fit.css`'s reach on a phone) and nothing beside it
    moves.
  - **Blocks stay** for what is not an icon on a scene: menus, panels and
    dialogs (ink blocks), the touch controls in a fight, currency (the coin
    pill), counters and cards, and calls to action (PLAY, Buy). An icon
    beside its word on a stage on a desktop (Entrance, Victory) is a text
    button, and stays a block.
  - **Badges** on a bare icon are Poster's one indicator (the red square
    with an ink edge, as on the Plaza); this recipe doesn't style them.
  - **The Lobby's rail stays on its ink slab** (coordinator for the owner,
    28 Nov): its icons and words already stand bare on the slab, with no
    block per button, and the slab with its cream stripe is G's main shape.
    The open screen keeps its slanted cream block, the clearest "you are
    here".
- The Lobby's ink slab and its white stripe are pseudo-elements; the only
  markup the look adds is `.lobby-bigname` in the Lobby's backdrop (the
  fighter's name, hidden in the look underneath).
- The Lobby's cards keep the look underneath's widths on phones: the notice
  above the stage is sized to clear them.
- Three `!important`s, each with its reason beside it: PLAY's colour and
  font (the Lobby sets them so) and the rank's name on your own row of the
  ladder (its colour is inline).
- **Contrast** (`tokens.css`): cream, gold and every element, boss and
  Spire colour are light, so words on them are ink, never white.
  `--on-el-dim` is the quieter ink on an element colour (a win's sheet),
  `--hot-fill` the red behind white words (`--hot` stays for shadows and
  lines), and `--el-text` (behind `--ui-accent`) is `--el` lifted to OKLCH
  lightness 0.72 for words on the panels' greys.
  `tests/visual/poster-contrast.spec.ts` measures every word on the Lobby,
  the hub's screens and Settings with the Lobby in each element colour,
  against the pixels really under it.
- Inside a Fighters card `--el` is that card's element colour
  (`roster-view.ts` sets it), not the chrome's cream.
- One screen, one file: `screens.css` has the title screen, the countdown
  and the round break; `sheets.css` the Reveal, the rite cards and the raid
  rites; `onboarding.css` the sign-in card; `plaza.css` the Plaza and the
  chat. They load in that order (`theme.css`), so a rule for a screen
  another file already styles goes beside that file's rules: a later file
  wins a tie. Pull request #567 merged a block written apart from #555 and
  #557, and those three had styled the same screens twice.
- **Numbers that line up:** Anton has no tabular figures (its 1 is about a
  third narrower than its other digits, with or without `tabular-nums`). So
  numbers in columns or that change in place (`.ui-num`, `.ui-price`, the
  header's coins, the battle clock) take Archivo's tabular figures, heavy;
  Anton stays for words and labels ("Lv 12", "Tier 0 / 20", the medals).
  `tests/visual/poster-numbers.spec.ts` checks the Ranks road's column.
- **Tabs a finger can't miss:** a tab's box is its touch target, so a
  slanted or inset block draws inside the box rather than moving it. A tab
  row's 2 px between tabs is covered by each tab's invisible reach (a
  `::before`), so a tap between two tabs takes one of them
  (`phone-fit.spec.ts`, `spire-safe-area.spec.ts`; #607, #643).
