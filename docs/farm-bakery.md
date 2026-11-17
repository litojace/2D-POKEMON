# The Bakery

The Farm's first processing chain: crops and Storm Milk from the barn bake
into goods worth more than the raw crops. Before it, the Farm was plant →
harvest → sell; the Bakery gives a reason to plan crops, keep the cow busy
and come back to a full oven.

- Rules (shared, for display): [`packages/shared/src/farm-bakery.ts`](../packages/shared/src/farm-bakery.ts)
- Rules (authoritative): [`supabase/migrations/20261117130000_farm_bakery.sql`](../supabase/migrations/20261117130000_farm_bakery.sql)
- Timing update: [`20261117150001_rebalance_bakery_times.sql`](../supabase/migrations/20261117150001_rebalance_bakery_times.sql)
- Scene, sheet and art: `apps/client/src/farm/farm-scene.ts` (`drawBakery`,
  `bakeryHTML`), `farm-gfx.ts` (`GFX.bakery`), `bakery-art.ts` (icons)
- Tests: `tests/unit/farm-bakery.test.ts`, `tests/integration/farm-bakery.test.ts`
  (SQL against the shared rules), `tests/visual/farm.spec.ts` ("the Bakery: …")

## How it plays

- **Build** at farm level 10 for 1,200 Gold Leaves (+40 farm XP). Before
  that the building stands shut with a sign (`BAKERY · Lv 10`, then
  `BAKERY · 1200`); tapping it opens its sheet.
- **One oven, a queue.** It bakes one thing at a time. A new recipe starts
  when the last one in the queue is done, or now if the oven is idle. The
  queue has 2 slots; 600, 1,200 and 2,400 leaves buy a 3rd, 4th and 5th.
- **Offline.** Every time is the database's clock (`started_at`,
  `ready_at`), so the queue keeps baking while the player is away.
- **Collect** by tapping the building (everything ready, as far as the barn
  has room) or a finished slot in the sheet. A good takes one barn space,
  like a crop, and gives its XP when collected. With the barn full it waits
  in the oven.
- **Sell** at the Market's Sell tab (fixed price, marked "Baked"; the Prices
  tab lists them), or deliver them to orders.
- **Orders.** With a bakery, a new order sometimes (45% of orders with
  fewer than three kinds) also asks for 1–2 of a good it can bake, paid
  like the crops: 1.45 × its price, plus its XP.
- **Ingredients are plain goods only** (no mutation), as the Bistro's farm
  delivery: a Gold or Rainbow crop is worth far more sold, so the oven never
  takes one by surprise.
- **Finish now** (`bake-rush`): the slot in the oven gets a Finish button
  priced at 2 Gold Leaves a minute left (rounded up, at least 10); a second
  tap within 3 seconds confirms. It's ready at once, and everything queued
  behind it moves up by the time saved. The server prices it from its own
  clock (the price only falls while the button shows). Only what's baking
  can be finished, not what waits behind it. No real money: Gold Leaves
  only, a sink for late-game leaves.

## Recipes

| Good                | Lv  | Ingredients                      | Time | XP  | Sells | Raw base | Raw, avg day |
| ------------------- | --- | -------------------------------- | ---- | --- | ----- | -------- | ------------ |
| Breeze Bread        | 10  | 3 wheat                          | 10m  | 6   | 24    | 15       | 17.3         |
| Volt Berry Tart     | 11  | 3 volt berry, 2 wheat            | 20m  | 12  | 40    | 25       | 28.8         |
| Storm Milk Bun      | 12  | 2 wheat, 1 Storm Milk            | 30m  | 16  | 105   | 70       | 77.5         |
| Carrot Cake         | 14  | 3 carrot, 2 wheat, 1 Storm Milk  | 1h   | 28  | 130   | 85       | 94.8         |
| Lava Pumpkin Pie    | 18  | 2 pumpkin, 2 wheat, 1 Storm Milk | 2h   | 45  | 150   | 96       | 107.4        |
| Twin Bolt Cornbread | 60  | 2 twin bolt corn, 1 Storm Milk   | 4h   | 80  | 210   | 134      | 151.1        |

"Raw base" is what the ingredients sell for at base price; "avg day" at the
market's average multiplier (crops ×0.7–1.6 on an ordinary day, 1.15 on
average; Storm Milk ×0.85–1.35, 1.10). Cornbread uses Twin Bolt Corn, the
game's only corn, which opens at level 60: it is the long-term recipe.

## Why these numbers

- **Worth baking, not a leaf printer.** Each good sells for 1.35–1.4× its
  ingredients on an average day and at least as much as the ingredients at
  the best ordinary price (×1.6 crops, ×1.35 milk). Only a HOT crop
  (×1.6–1.9) can beat baking it, which leaves a real choice. At base prices
  no recipe pays more than 1.6× (`tests/unit/farm-bakery.test.ts`).
- **The trade cap is untouched.** Leaves → coins stays at 100 → 5, at most
  60 coins a Pacific day ([currency-exchange.md](currency-exchange.md)); the
  Bakery changes how players earn leaves, not how many coins they can get.
  A full 5-slot queue left overnight adds under 300 leaves of profit over
  selling the raw goods, a quarter of the 1,200 leaves the daily cap turns
  into coins.
- **Finishing early never pays.** Even on the market day when baking pays
  best (raw crops ×0.7, milk ×0.85), no recipe earns more than 1.57 leaves
  per oven minute (milk bun), below the 2 a minute finishing costs, and
  finishing a whole bake costs more than the bake earns. So rushing to bake
  more always loses leaves: it buys time, never income
  (`tests/unit/farm-bakery.test.ts`, "finishing now").
- **Milk limits the early bakery.** Each cow gives 2 every 2 hours. The
  first cow supports at most 24 milk recipes a day with perfect collection;
  the extra cows at levels 40 and 55 increase supply later.
- **Later recipes take longer and pay more** (profit over raw grows from 9
  to 76 leaves), so the queue suits short sessions early and overnight
  baking later. Times sit between the fast crops (2m–12h) and the cow (2h).
- Prices follow the farm's other building purchases: the pasture is 900 at
  level 9, the sprinkler 1,500 at 18.

## Shorter bake times (November 17, 2026)

The six recipes now take 10, 20, 30, 60, 120 and 240 minutes. Ingredients,
prices, XP, unlock levels, queue slots and rush pricing are unchanged. This
keeps short-session recipes alongside longer offline recipes; five cornbreads
now take 20 hours instead of 30.

A new data migration updates only the recipe catalogue's `seconds`. Already
scheduled batches keep their original start and ready times, including queued
and finished goods. New batches use the new durations. Reapplying the migration
does not move queues or change player inventories or balances.

## Where it stands

In the farmhouse's place in the back row, left of the windmill, at
(190, 292) in the farm scene's world pixels. The house had no use; the
Bakery gives the spot one. The back row has never been decorations' ground,
so nothing about decorations changed. Before it's built the building stands
shut with a sign. Its windows light at night (as the house's did), its oven
glows and its chimney smokes while it bakes, it casts a shadow, and a bubble
over the oven shows what is ready. The farm cat that slept by the house's
door now naps curled up on top of the warm oven; a tap on the cat wakes it
(the rest of the building opens the Bakery).

## Living with the coop and the new decorations

Three farm branches change the same database functions. This migration
(`20261117130000`) sorts after the coop's (`20261117100000`, `…100001`)
and the decorations' (`20261117120000`), and wraps instead of copying:
`arena_farm_order`, `arena_farm_new_order`, `arena_farm_state` and
`arena_farm_act_more` are renamed `*_prebakery` and called from the new
function, so the coop's eggs stay in force under them. The renamed ones
can't be called by players. It doesn't touch `arena_farm_decor_fits` at
all. `farm-scene.ts`, `farm.ts`, `farm-fake.ts` and `farm.spec.ts` will need
an ordinary merge of both sides.

## Changing it

- A recipe's numbers live in both files above; the integration test fails
  if they disagree. A migration that already ran is never edited: add one.
- `arena_farm_new_order` now wraps `arena_farm_new_order_crops` (070's
  crops orders). A migration that changes the crops orders (a new champion's
  order giver, say) replaces `arena_farm_new_order_crops`, not the wrapper.
- `arena_farm_good_name` names any barn good (crop, milk or baked good) for
  error messages; `arena_farm_order` uses it.
