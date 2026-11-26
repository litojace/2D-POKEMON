# Two looks to choose from: Poster and Showcase (reference, 26 Nov 2026)

The owner looked at five lobby directions, then at the whole game in two of
them, and asked for **both**: a player picks a look in a dialog right after
creating an account, and can change it in Settings at any time. Two sessions
build them at the same time, one look each.

This folder is the **reference**, not shipping code: the CSS here was injected
over the real client to take screenshots. It leans on `!important` and on
selectors written to win, and nothing in `apps/` reads it. Build the real
themes cleanly, to look like the screenshots.

## What is here

| Path                                                                              | What                                                                                               |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `shots/poster/*.jpg`                                                              | Poster: all 34 screens at 844×390 (the look the owner approved)                                    |
| `shots/showcase/*.jpg`                                                            | Showcase: the same 34 screens                                                                      |
| `shots/light/*.jpg`                                                               | Six ways to light the Showcase lobby's fighter (the owner is choosing)                             |
| `dirs/d2-poster.css`, `poster-kit.css`, `poster-screens.css`, `poster.js`         | Poster: lobby, shared kit, per-screen fixes, lobby markup patch (`poster.css` is the three joined) |
| `dirs/d4-showcase.css`, `showcase-kit.css`, `showcase-screens.css`, `showcase.js` | Showcase, same split                                                                               |
| `light/l1…l6-*.css`                                                               | The lighting variants, each a patch on top of `showcase.css`                                       |
| `dirs/all.cjs`                                                                    | Runner: every hub screen, battle HUD and result sheet with a theme injected                        |
| `dirs/shoot.cjs`                                                                  | One lobby screenshot with a theme (and `EXTRA=<css>` on top)                                       |

Screenshots were taken on main at `f8e7f6a`; #541 has since changed the new
player's first match and the result sheet, so check those against today's main.

### Running the tools

```bash
npm i --prefix docs/ui-remodel/themes-demo/fonts @fontsource/anton @fontsource/archivo @fontsource/rubik
npx vite --config tests/visual/vite.config.ts   # background, port 4179
export PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
node docs/ui-remodel/themes-demo/dirs/all.cjs showcase /path/to/out all 844x390
node docs/ui-remodel/themes-demo/dirs/all.cjs poster /path/to/out lobby,shop 667x375
node docs/ui-remodel/themes-demo/dirs/all.cjs poster /path/to/out all 852x393 --island
EXTRA=docs/ui-remodel/themes-demo/light/l3-cross.css TAG=l3 node docs/ui-remodel/themes-demo/dirs/shoot.cjs showcase /path/to/out 844 390
```

`all.cjs current <out>` shoots the game as it is. `--step=N` presses the
lobby's next-fighter arrow N times first (the element colour changes).

## The two looks

**Poster.** Ink black (`#0d0d0f`) and the lobby fighter's element colour,
nothing rounded. A slanted ink slab on the left carries the rail; the fighter
stands on a field of its element colour with its name in huge outlined
letters behind. Panels are ink with a hard `8px 8px 0` shadow and a masthead in
the element colour; the selected tab is a skewed ink block; the primary button
is a skewed block in the element colour with a hot-red (`#ff2e4d`) offset
shadow. Type: Anton (display, capitals) and Archivo (text).

**Showcase.** A near-black stage (`#0c0b11`), dark rounded tiles (panels 22 px,
tiles 16 px), no glass. The fighter is lit in its element colour; the element
colour also draws the floor ring, progress bars and the ring round a selected
tile. Every action button is lime (`#b8ff3c`) whatever the fighter, tabs are
pills (the selected one white), type is Rubik in title case. The lobby gains a
Raid card with the boss's own splash painting. The result sheet has a glow in
the element colour at the top.

Rules both share:

- **`--el`** is the lobby fighter's element colour, set on `:root` (the lobby
  sets `--element` on `#lobby-fighter`: `lobby-screen.ts`). All 18 element
  colours reach 4.8:1 on black; none is safe as text on white.
- **Coins stay gold.** `.ui-coin` and `.coin-chip .button-icon` read the
  accent token today, so with a per-fighter accent they turned blue for
  Tidefin. Give coins their own token.
- No `backdrop-filter`, no animation that runs for ever, glows static.
- Fonts are OFL (Fontsource): self-host the woff2 files, latin and Vietnamese
  subsets, with their licence files. `font-src 'self'` is already allowed.

## Building them: the contract between the two sessions

- **Ids:** `poster`, `showcase`. The page carries `<html data-ui="poster">`.
  No attribute is today's look, which stays underneath as the fallback while
  the themes are built and is not offered in the picker (the owner asked for
  two; ask them before removing it for good).
- **One module owns the choice:** `apps/client/src/ui-theme.ts`, with the
  registry (`UI_THEMES`: id, name, `ready`, preview, CSS loader),
  `getUiTheme()`, `setUiTheme(id)` (applies live, no reload) and
  `applyUiTheme()` called first thing in `main.ts`. Not an inline script in
  `index.html`: those are allowed by hash in the CSP and Render's headers.
- **Stored on the device** (`localStorage`, like `ea-graphics`) in the first
  version: no migration. `?ui=poster` overrides it for one page load, for
  tests and screenshots.
- **Each theme is its own folder**, `apps/client/src/themes/<id>/`, every
  selector under `:root[data-ui="<id>"]`, loaded only when chosen (a dynamic
  import, so its own chunk). The other theme's rules must not be in the page:
  all CSS counts in battle (`CLAUDE.md`, "Keeping battles smooth").
- **The picker** is a dialog shown once after an account is created, with a
  preview of each look; one tap chooses and goes on. It appears only while at
  least two themes are `ready`. Settings gets a "Look" control that switches
  live.
- **Order:** the foundation lands first (module, loader, storage, Settings
  control, picker, the `--el` and coin tokens). Themes then land in slices,
  each safe to merge unfinished because nothing selects it (`ready: false`).
  Turning `ready` on is the last step, after the owner has seen the full set of
  screenshots from the real build.
- **Checks for each theme:** the screens at 667×375, 844×390, 852×393 with the
  island inset and desktop, looked at box by box (`CLAUDE.md`, "Look at every
  UI change"); `battle-style-budget` and `panel-open-budget` with the theme on;
  one sweep spec per theme rather than the whole visual suite three times.
- **Showcase's lobby light** puts a `drop-shadow` filter on the fighter's
  canvas in some variants (the rim of light). A filter on something that
  animates is redrawn every frame: measure it, and leave it out at graphics
  Low.
