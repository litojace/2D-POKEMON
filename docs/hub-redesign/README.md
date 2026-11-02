# Hub redesign: Lobby, Plaza and Elemental Farm (handoff)

This folder hands a finished design prototype over to the real implementation.
The prototype was built and reviewed with the owner in one long design session.
**Nothing in `apps/`, `packages/` or `supabase/` has been changed yet.**

- Playable prototype (private claude.ai page, owner only): https://claude.ai/artifact/H15cY4aKCr5yXrjW5Y9tYA
- Economy report, in Vietnamese: https://claude.ai/artifact/PNGPNFVKBqxtuGzJ9FCJre
  (the source is in `economy/kinh-te.html`)
- Every tuning number, generated from the source: [`NUMBERS.md`](NUMBERS.md)
- How to start the next session: [`NEW-CHAT-PROMPT.md`](NEW-CHAT-PROMPT.md)

## What is in this folder

| Path                                                                                  | What it is                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prototype/app/*.js, *.css, *.html`                                                   | Prototype source. The main files are `farm.js` (farm), `crops.js` (crop art), `plaza.js` (Plaza), `progress.js` (Journey and Missions), `icons.js` (shared icon set) and `art.js` (procedural buildings, trees and animals). |
| `prototype/app/assemble.py`, `build.py`                                               | Build scripts. They patch the Lobby page in `prototype/lobby/template.html` and write `app/hub.html`, which is self-contained.                                                                                               |
| `prototype/lobby/`                                                                    | The Lobby page the prototype builds on, plus `art.json`, the champion SVGs exported from the game.                                                                                                                           |
| `prototype/app/doc.html`                                                              | The design notes shown under the demo, in Vietnamese.                                                                                                                                                                        |
| `prototype/app/t*.js, f1, e1, m2-m4, al, g1, an1, an3, dk, rt1, rt2, cr1, cr2, sheet` | Playwright check scripts (see "Running it").                                                                                                                                                                                 |
| `prototype/app/numbers.js`                                                            | Writes `NUMBERS.md` from the source.                                                                                                                                                                                         |
| `economy/`                                                                            | Python models and the report for the XP, coin and leaf economy. Run them from that folder.                                                                                                                                   |
| `images/`                                                                             | Reference screenshots of the approved look.                                                                                                                                                                                  |

## Running it

```bash
cd docs/hub-redesign/prototype/app
python3 build.py              # writes hub.html, preview.html, preview-t.html (all git-ignored)
node t16.js                   # any check script, run one at a time; each prints "errs []" when clean
node numbers.js > ../../NUMBERS.md
```

- The check scripts load `preview-t.html`, which exposes the debug handles `__FM`, `__PZ` and `__ECON`.
- They use the repo's `playwright` package. If that version's browser is not installed, set `PW_CHROMIUM` to any Chromium binary (see `pw.js`).
- Run them one or two at a time. Running a dozen at once starves the CPU and gives false failures.

Useful checks:

| Script                    | What it checks                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `t18` / `t20` / `t16`     | HUD boxes never resize; no cut-off text; no Vietnamese text in the game UI                                       |
| `al`                      | Buttons line up                                                                                                  |
| `m2` / `m3` / `m4` / `dk` | Phone layouts, touch, the farm menu does not cover the tool bar                                                  |
| `g1`                      | Tap vs drag vs hold vs pinch on the farm                                                                         |
| `an1` / `an3`             | Dog paths: obstacles and the fence gate (`an3`: 300 random trips, must print `legsThroughObstacles: 0`)          |
| `rt1` / `rt2`             | Real-time clock, offline catch-up, fast mode and reset; growth stays on the wall clock with the CPU throttled 8x |
| `cr1` / `cr2` / `sheet`   | Crop art in the field, the menus and a contact sheet of every stage                                              |

## What the prototype contains

**Lobby**

- **HUD:** profile with level, wallet pills for coins and Gold Leaves, and the scene switcher (Lobby / Plaza / Farm). The boxes have fixed sizes, use tabular numbers and keep text optically centred.
- **Missions vs Journey:**
  - Missions are 6 daily tasks (2 easy, 2 medium, 2 hard), with a bonus for finishing all six and a 7-day streak.
  - Journey is the account level (1 to 100) with a level road, plus a monthly season road, weekly goals and Daily Spark (the first 500 XP each day count double).
- **Settings:** Full screen, "Fast demo time" (prototype only) and "Reset demo farm" (prototype only).

**Plaza**

- **Stage:** a catwalk with an LED wall.
- **Ball pitch:** two bot teams playing Orb Ball.
- **Dash race track:** a timed start gate, 3 hurdles and a TOP DASH board.
- **Photo spots:** take a polaroid with nearby players.
- **Volt boba:** costs 10 Gold Leaves for +30% speed for 30 s.
- **Play area:** bounce pads in the 4 corners and fewer trees.
- **Animals:** pigeons, ducks, koi and a cat.
- **Orb Shower:** the first minute of every :00, :15, :30 and :45.
- **Day and night:** follows the clock.
- **Navigation:** minimap with travel, and a joystick on phones.

**Elemental Farm** (all new: the game has no farm today)

- **Field:**
  - 50 plots in a 10×5 grid: 15 to start and 35 to buy.
  - Tapping an empty plot opens a crop picker.
  - Tools: hand, seeds, watering can (Wood, Copper, Gold), fertilizer, net, shovel, sickle and sprinkler. The cursor turns into the tool.
- **Touch:**
  - A tap uses the plot.
  - Dragging more than 10 px pans the map, even when the drag starts on a plot.
  - Holding for 300 ms paints with the current tool.
  - Two fingers pinch to zoom.
- **Crops:** 25 crops from Lv 1 to Lv 80, each with 5 growth stages and its own produce icon.
- **Weather and mutations:** 6 weathers (shown as a round status orb) and 6 mutations that raise the sell price.
- **Selling:**
  - Market prices change daily and one crop is HOT each day.
  - An order board pays more than the market.
  - The barn has upgradable storage.
  - 100 leaves trade for 5 coins, up to 40 coins a day.
- **Pests and guards:**
  - Guard dogs are hired by the real day: Goldie, Inky or Fluffy.
  - Crows come for ripe crops; a scarecrow keeps them away.
  - Bugs can be caught with the net.
- **Friends:** visit, water, catch bugs, steal 1 crop per ripe plot (the dog may catch you), or drop bugs as a prank (3 a day).
- **Progress:**
  - Decorations add charm, which is a farm XP bonus.
  - Cow pasture gives Storm Milk.
  - Crop book with Crop Mastery stars from Lv 40.
  - Farm Lv 1 to 100 with milestone rewards.
- **Farmer perk:** comes from the Lobby fighter you play as (see `NUMBERS.md`).
- **Status and menu:** round status orbs (weather, perk, dog, barn) with timer rings, and an expandable side menu that shows labels when open.
- **Animals:**
  - Hens and a cow wander.
  - The dog uses A* pathfinding around obstacles, only enters the field through the gate, and is depth-sorted with fence segments so it never walks "under" a fence.
  - When the dog barks or chases a crow, its speech bubble follows it.

## Decisions and how they differ from the live game

All numbers are in [`NUMBERS.md`](NUMBERS.md). The reasoning, and sources from other games, are in the economy report.

**Player level**

- Max level goes from 50 to 100.
- Lv 1 to 50 keep exactly the live curve (`levelThreshold` in `packages/shared/src/journey.ts`). Lv 51 to 100 are new: about one level a week at the top for a regular player.
- Level coins stay at 30 up to Lv 49. Each level from 50 to 100 gives 100 coins.

**Season**

- 30 tiers of 1,200 season XP, lasting one calendar month (live: 20 tiers of 400).
- 50 coins per tier, cosmetics at tiers 5, 12, 20 and 30, and 4 weekly goals of 250 season XP each.

**Missions**

- Pay is unchanged from live: 40, 70 or 120 coins and 50 XP each; +50 coins for all six; +300 coins for a 7-day streak.
- The prototype shows **5** free changes a day; live has **3** (migration `023`). This needs confirming.

**New in this design**

- Daily Spark.
- Gold Leaves, a new soft currency earned on the farm and in the Plaza.
- The whole farm economy.

## Rules the real implementation must follow

1. **The server owns time.** The prototype reads the device clock and saves to `localStorage`, so anyone can cheat by changing their clock.
   - Store `planted_at` / `ready_at` and similar timestamps on the server.
   - Compute growth, dog time, restocks and market days from server time when a player acts.
   - The client only animates.
2. **Every economy change is a validated server call** (Supabase RPCs, like the existing shop and mission functions). This covers buying, selling, harvesting, trading leaves for coins, stealing, pranks and orders. Daily limits (40 coins a day from leaves, 3 pranks a day, 1 gift a day) are enforced on the server.
3. **Clock-based events need a timezone decision:** missions at midnight, weather every 4 h, shop restock at 2:00, 6:00, 10:00 …, the market at midnight, weekly goals on Monday and the Orb Shower on the quarter hour (see the open questions below).
4. **Client loop lessons from the prototype:**
   - Clamp frame `dt` to at least 0. The first frame can be stamped before `enter()` runs; the resulting negative `dt` pushed the dog backwards into its kennel.
   - Never drive gameplay time from frame `dt`. Slow phones and hidden tabs drop frames. Gameplay time comes from timestamps.
5. **UI rules the owner asked for:**
   - HUD boxes keep a fixed size; numbers use tabular figures.
   - Text is centred straight inside its box.
   - Buttons line up both vertically and horizontally.
   - All game UI text is in English.
   - The icon set is duotone and each shape's outline is a darker shade of its own fill (`shade()` in `icons.js`). Crops follow the same rule.
   - Phone landscape (down to 700 px wide) must not overlap: the menu never covers the tool bar.

## Suggested order of work

Each step can ship on its own. Agree on the open questions first.

1. **Journey and Missions numbers.**
   - Change the level curve to 100, the season to 30 × 1,200 monthly, and add Daily Spark in `packages/shared/src/journey.ts`, with a Supabase migration.
   - Split the Journey and Missions UI (`apps/client/src/missions-ui.ts` and the Lobby).
   - Add vitest tests: Lv 1 to 50 thresholds unchanged, the curve rises without dips, totals match `NUMBERS.md`.
2. **HUD and alignment pass** in the Lobby, Shop and Wardrobe, including phone landscape.
3. **Plaza additions** in the existing town (`apps/client/src/town*.ts`, `apps/server/src/town.ts`, `packages/shared/src/town.ts`): bounce pads, dash track with a leaderboard, photo spots, Orb Shower on the server schedule, and Gold Leaves.
4. **Farm, minimum version:**
   - Tables: farm, plots, seeds, barn, wallet leaves.
   - RPCs: plant, water, harvest, sell, buy seeds or land, level up.
   - A client farm scene with the touch model and server-timed growth.
5. **Farm systems:** weather and mutations, orders, dogs, crows, friends' farms (visit, help, steal, prank), decorations and charm, pasture, crop book and mastery, farmer perks.
6. **Art and feel:**
   - Port `crops.js` (pure functions that return SVG strings) and the depth sorting, fence segments and A* pathing from `farm.js`.
   - Port the status orbs and the expandable menu.

## Open questions for the owner

1. Which time zone do clock events use: the player's local time, one server time (UTC), or per region?
2. Daily mission changes: keep 3 (live) or move to 5 (prototype)?
3. Ship the farm in the same release as the Journey and Plaza changes, or later?
4. Gold Leaves: confirm they are a separate wallet, and the 100 leaves → 5 coins trade capped at 40 coins a day.
5. Optional idea from Stardew Valley: giant crops when a 3×3 block of the same crop is ripe.
