# Hub redesign: implementation plan and decisions

The design handoff (README, NUMBERS, prototype) is in this folder via pull
request #5. This file records what the owner decided before implementation
started, and the order of work. Update it when a decision changes.

## Facts found when mapping the prototype to the code (2 Nov 2026)

- There is no Lobby screen yet. After login the player is in the walkable town
  (Phaser, 3200×2000). Play and Fighters are drawers; Shop, Missions, Journey
  and Friends open in `#dialog`.
- Live already allows 5 free mission changes a day (migration 026), the same
  as the prototype. The handoff README's "live has 3" is out of date.
- The game already has one server day: `arena_today()` is the Pacific date
  (`America/Los_Angeles`). Missions, Today's Picks, daily coin caps, season
  months and Monday weeks all follow it.
- The client never calls Supabase for data. It calls the game server
  (`/api/*`), which calls the RPC with the player's own token (`auth.uid()`),
  or with the service role for match and raid results.
- The prototype's farm rules run in the browser (`localStorage`,
  `Math.random`, the device clock). Its offline catch-up only counts water and
  fertilizer. Perks have no cooldown. Market prices, seed stock and orders are
  random per device. The real farm needs one set of rules on the server.
- "Raid of the day" (shown on the prototype Lobby) was retired in migration 028.

## Decisions

| #   | Question                        | Decision                                                                                                                                                                                                                                                                  |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Time zone for clock events      | One server time. Daily, weekly and monthly resets stay on the Pacific day (`arena_today()`). Short cycles (weather and seed restock every 4 h, Orb Shower every 15 min) use UTC boundaries. The UI shows countdowns. Plaza day/night follows the device clock (cosmetic). |
| 2   | Free mission changes            | Keep 5 (already live).                                                                                                                                                                                                                                                    |
| 3   | Farm release                    | Later than Journey, Lobby and Plaza. Each phase is its own pull request; the Farm tab stays hidden until the minimum farm is done.                                                                                                                                        |
| 4   | Gold Leaves                     | A separate wallet. 100 leaves → 5 coins, at most 40 coins a Pacific day, enforced on the server.                                                                                                                                                                          |
| 5   | Giant crops (3×3)               | Later, after the farm systems. Built in migration 050 (see "Giant crops" below).                                                                                                                                                                                          |
| 6   | Lobby                           | Build the one-screen Lobby from the prototype as the screen after login. The walkable world becomes the Plaza tab.                                                                                                                                                        |
| 7   | Party and fitting room          | Party before a room: its own pull request right after the Lobby. The merged Shop + Wardrobe fitting room: not now.                                                                                                                                                        |
| 8   | Plaza                           | **A new Plaza map from the prototype** (2700×1700: stage and LED wall, ball pitch, dash track, photo spot, Volt boba, bounce pads), not additions to the current town. (The first answer was "add to the current town"; the owner changed it.)                            |
| 9   | Crows, bugs and thieves offline | Only while the player is on their farm, as the prototype actually behaves.                                                                                                                                                                                                |
| 10  | Level 55–100 cosmetics          | Phase 1 ships the levels, coins and titles. The cosmetics come in a later art pull request and are granted to anyone already past those levels.                                                                                                                           |
| 11  | Claim buttons                   | Keep automatic payouts (missions, weekly goals, levels, tiers). Only the look changes.                                                                                                                                                                                    |

Defaults accepted with these answers:

- The 30-tier season starts with the month after migration 035 runs (planned
  1 Dec 2026, Pacific). The month in progress keeps 20 × 400.
- The Daily Spark applies to every XP source, and the doubled XP also counts
  for the season (as in the prototype).
- Migrations: the owner asked (2 Nov 2026) for them to be applied to the
  production Supabase project as part of the work. Each migration is applied
  after its pull request merges, then checked with read-only queries.
- All randomness with economic effect (mutations, market, seed stock, orders,
  dog catches) runs on the server. What must match for everyone (market
  prices, the seed list) is seeded by day or time slot. Seed stock: the same
  list for everyone, quantities per player.
- Active farmer perks (Zap, Downpour, Warmth) once per Pacific day; full perk
  rules are proposed in the farm systems phase.
- The Lobby's "Raid of the day" card becomes a Raid Hall card.
- Numbers missing from NUMBERS.md (tool prices, orders, Plaza quest rewards,
  +2 leaves per orb, pasture, barn upgrades, crop book rewards) come from the
  prototype source and live in shared constants in `packages/shared`.
- "Elemental Farmer" is used twice in the prototype (farm Lv 100 and the
  25-crop book reward); one gets a new name in the farm systems phase.

## Level 55–100 cosmetics (decision 10), done (3 Nov 2026)

Migration 051 (after the giant crops' 050). Prism frame (Lv 55), Nova entrance (65), Starlit colors (70),
Solar aura (80), Eclipse finale (85), Prismatic laurel (95) and, with the
Element Master title, the Element Master frame (100). NUMBERS.md calls the
last one "prismatic frame"; it is named after the title so it can't be
mistaken for the Lv 55 Prism frame. All seven are Mythical (the Lv 10–45
pieces are Rare to Legendary) and have their own art instead of the shared
journey ring and falling stars. `arena_add_xp` grants them on the way up and
also hands back any level cosmetic a player is missing whenever it saves XP;
the migration backfilled everyone already past those levels (on 3 Nov 2026
nobody was: the highest level in production was 29).

The same pull request fixed two things that kept every Journey reward from
being worn: the Journey dialog's Equip button called a route that only takes
the first two boss rewards, and the server's appearance route didn't know
Journey items. The Wardrobe now lists owned Journey rewards too.

## The new Plaza: decisions made while building it (2 Nov 2026)

These numbers are not in NUMBERS.md or the economy model; they are mine and
open to change.

- **Orb Shower pay:** +2 Gold Leaves an orb (the prototype), at most 10 paying
  orbs a shower and 50 a Pacific day (100 leaves), so an always-on player
  can't farm leaves from it. Orbs are spawned and caught by server positions.
- **Runway cheers:** the prototype's fans were bots. Here the server counts a
  cheer every 0.6 s you stand on the runway, plus each ❤️ 🔥 👏 emote from
  another player within 750 px. "15 cheers" takes about 9 s alone.
- **Ball pitch:** four server bots per Plaza copy (two a side) play Orb Ball
  with the prototype's brain while anyone is in that copy; a goal counts for
  your quest when you touched the ball last.
- **TOP DASH:** each player's best lap of the (Pacific, Monday) week. Laps are
  timed from server positions; leaving the lane cancels a lap.
- **Quests** are paid automatically (decision 11), not with Claim buttons.
- **Old town:** removed (3 Nov 2026) now that the Plaza is live: its client
  code, art, styles, server world and `town-*` socket events, shared layout
  and tests are gone. What the Plaza reused stays under Plaza names
  (`PlazaAppearance` on the server, `plazaOutfitKey` on the client). The
  presence value `"town"` stays on the wire (clients show it as "In the
  Plaza"). Tapping a player in the Plaza shows their card with Add friend and
  Invite to party, in place of the town's Nearby players panel.
- **Not yet:** the photo album (the polaroid can be saved as a picture).
  Treats came with the farm systems (049).

## Farm systems progress (phase 5)

Done (each with its own migration and tests): weather and mutations (039),
the order board (040), crop book rewards (041), the wishing well (042),
crop mastery (043), tools and bugs (044), guard dogs and crows (045),
farmer perks (046), friends' farms (047), decorations and Charm (048),
the pasture and treats in the Plaza (049). Giant crops followed in 050
(below, after phase 6).

Phase 5 is complete.

- **The pasture and treats (049), decided:** the Cow Pasture opens at farm
  Lv 9 for 900 Gold Leaves (+30 XP); the cow gives 2 Storm Milk every
  5 h 20 m (the first 1 h 20 m after opening), +8 XP each time. Storm Milk
  takes barn space and sells for 60 leaves times its own price of the day
  (0.85–1.35, the same for everyone); it is a barn good, not a crop (no
  seeds, crop book, orders, mastery or harvest perks). Friends see your cow.
  Treats are regular crops (no mutation, not milk): a throw takes the one
  you have most of (the cheapest on a tie), at most one every 1.5 s, and
  everyone in that Plaza copy sees the burst. As in the prototype a treat
  pays nothing; the pitch bots don't react (the prototype's townsfolk did).

- **Decorations (048), decided:** the prototype's 11 decorations and 8
  spots; placing replaces what stood there and putting one away doesn't
  refund it (both as in the prototype). Charm gives +1% farm XP per 2, up
  to 25%, on every farm XP source. The crop book's 15-crop reward is the
  Golden Voltkit Statue, free and placeable before its level 75 (farms
  already past 15 crops get it too).

- **Friends' farms (047), decided:** anyone on your Friends list. Helping
  (water +2 XP, a bug +3 XP) pays at most 60 XP a Pacific day; sneaking is
  at most 10 a day, each ripe planting loses at most one crop (its harvest
  gives one less) and each friend can try it once; a guard dog catches a
  sneak at its rate (Goldie 25%, Inky 80%, Fluffy 40%) for a 20 leaf fine
  paid to the owner; 3 pranks a day, blocked by Auralynx's Shield. The
  prototype's daily seed gift is not in yet. The owner's farm lists who
  visited.

- **Perks (046), decided:** your farmer is the Lobby fighter you had when
  you last opened the farm; the farm screen sends it as a `farmer` action.
  A new farmer first re-baselines every crop at the old speed, so Lumoth's
  +20% only speeds up time Lumoth was farming and switching fighter never
  pays retroactively. Terradon (+1 crop) and Duskveil (+1 crop a bug) apply
  at the moment of the harvest or catch. Mystowl's third forecast is only
  sent to Mystowl's farm. Zap, Downpour and Warmth are used with a tap,
  each once a Pacific day (switching fighters can use all three).
- **Bugs (044), decided:** "on your farm" means the browser asked about the
  farm less than 150 s ago (the farm screen asks every minute while it is
  shown). Each request rolls bugs for that time on the server: about 0.18 an
  hour for each growing plot (the prototype's rate), half with a Scarecrow,
  at most 2 a plot. A bug slows its crop 20%; catching one pays 1 farm XP.
  Catching a bug on a ripe crop keeps the moment it ripened, so the weather
  (and mutation) can't be re-rolled that way.
- **Dogs and crows (045), decided:** dogs are hired by the day (1 or 3 days,
  the prototype's prices); hiring the dog on guard adds days, another dog
  takes over and the old one's time is lost; at most 30 days ahead. Goldie
  digs 1 gift a day and Fluffy 2 (the prototype's text; its code dug 4 a
  day), counted from the hire even while you are away. Inky: 30% fewer
  bugs. Fluffy: Gold ×1.5 for crops that ripened while she was on guard,
  checked against the hire history so a crop's roll never changes later.
  Crows use the bug presence rule: about one every 84 minutes on the farm
  (the prototype's 14–28 farm units), on a ripe crop, only with no Scarecrow
  and no dog (every dog keeps them away). A crow eats its crop 8 s after
  landing unless shooed; the server allows 2 s more for the network. The
  dog walks the farm since phase 6 (below).

## Art and feel progress (phase 6)

Already there from the earlier phases: the status orbs with timer rings,
the side menu that opens to show names, depth-sorted fences, and all six
weathers' effects. Added in phase 6:

- **The guard dog walks the farm:** it sits a while, then trots to another
  spot, around the pond, the well, its doghouse, the pasture, the scarecrow
  and decorations (A* on a 40 px grid, then straightened), into the field
  only through the gate. With a dog on guard no crow lands (the server's
  rule), so now and then a crow flies at a ripe crop and the dog barks and
  chases it off; that crow is drawn only. A "WOOF!" bubble follows the dog,
  which also barks when it digs up a gift. A friend's dog waits by their
  doghouse. The routes are in `apps/client/src/farm/farm-path.ts` with unit
  tests. Hens pick spots clear of the well and the pond.
- **Phones:** shadows, fence posts, soil and the grass on unowned land are
  painted once and stamped (per frame on the farm: about 490 gradients to
  32). The farm now follows Settings → Graphics like the Plaza: Low is
  30 fps, a 1× canvas, no hens, ducks or butterflies and half the rain;
  Auto watches the frame rate and switches a slow device to Low; and the
  farm stops drawing behind a dialog or drawer.
- **The farm menu, redesigned:** the side rail under the status orbs (which
  looked stuck there, most of all on phones) became one Menu button in the
  bottom-right corner, a tool-sized button on the tool bar's line (the way
  mobile farm games like Hay Day, Township and Pocket Camp keep their main
  menu where the right thumb rests), with the zoom buttons beside it on
  desktop. It opens a 4 × 2 grid of tiles above it: Shop, Orders, Market,
  Barn, Almanac, Decor, Friends and the daily Wish. The Menu button shows a
  dot when a tile has one; M opens it and Escape folds it. Sheets sit 8px
  from the orbs and the corner.

## Giant crops (migration 050, decided 3 Nov 2026)

Decision 5 said "after the farm systems"; they are done, so giant crops
come now. The idea is Stardew Valley's: a 3×3 square of one crop, all ripe,
can merge into one giant crop with a bigger harvest. These rules are mine
and open to change; the numbers live in `GIANT` in
`packages/shared/src/farm.ts` and the database checks them.

- **Which crops:** Earth Carrot (Lv 1), Dusk Cap (Lv 10), Lava Pumpkin
  (Lv 17) and Storm Melon (Lv 35): big round produce that reads well as
  one giant (Stardew's are cauliflower, melon and pumpkin), from a starter
  crop to a rare one. Legendaries are left out: 1 seed a restock at most,
  so 9 of them at once is weeks of luck.
- **When it is rolled:** once, for the moment the square's last crop
  ripens. The 9 plots must be yours, hold the same crop and all be ripe.
  The roll is a number from the farm's secret salt (039), the player, the
  square's top-left plot and the 9 plantings' times, the way 039 rolls
  mutations: reading the farm again (refreshing, reopening) gives the same
  answer, and only a new planting is a new roll, which costs the seed and
  the whole growing time. It runs on the server, never in the browser.
- **The chance:** 10% for each full square. Where squares overlap (a field
  wider than 3×3), each has its own roll; the one that formed first wins
  (on a tie, the lower plot number), so a giant never moves or flips. A
  simulation of the rule, with the harvest below: an exact 3×3 gives a giant
  1 harvest in 10 (+10% crops); the starting 5×3 field all of one crop 27%
  of harvests (+16%); a full 10×5 field of one crop 1.5 giants a harvest on
  average (+26%). Weather does not change the chance.
- **The harvest:** each of the 9 crops gives twice its normal harvest:
  36 crops (54 with Terradon's Rich Soil). XP is twice the 9 crops' XP
  (18 × the crop's XP, plus Charm), which is more than a Sickle swing
  over the 9 crops with its combo bonus. It goes into the barn whole: it
  needs room for all of its crops, or it waits ("Your barn is full").
- **Mutations:** a giant has no roll of its own. Each of its 9 crops keeps
  the mutation it rolled when it ripened (039, with Fluffy's Gold ×1.5),
  and its share of the giant carries it; so a giant can carry up to nine
  mutations. The art shows the effects of every mutation it holds, and
  tints the giant only when all nine share one.
- **Never worse than one by one:** the server's plain `harvest` and `dig`
  (in `arena_farm_act_core`) still work on a giant's plots, since the giant
  is worked out from the plots rather than replacing them: an old app that
  harvests one of them gets that plot's normal harvest and the giant breaks
  (the other 8 become ordinary ripe crops). Because a giant always gives at
  least twice what its plots give one by one, breaking one never pays. The
  farm screen sends `harvest-giant` for a giant and won't dig one up.
- **The Sickle:** a swing whose 3×3 touches a giant harvests the whole
  giant first (one `harvest-giant` for each giant it touches, sent before
  the Sickle's own `harvest`), then the other ripe plots in reach. A hand
  drag that crosses a giant harvests it once. A giant is not part of the
  drag's combo bonus (its XP is already doubled).
- **Seeing it in time:** a giant is only known once the server is asked
  after the square ripens. So when a square of a giant crop ripens on the
  screen, the farm asks the server at once and holds back harvesting those
  9 plots until it answers ("Something is growing…"), so a quick tap can't
  break a giant the player hasn't seen yet.
- **Crows:** never land on a giant (a crow that picks one flies off), so it
  can't be eaten. A crow already sitting on one of its crops when it forms
  still has to be shooed, as before.
- **Bugs:** they only come to growing crops, so a giant gets none. A bug
  that was on a crop before it ripened stays and can be caught as usual;
  harvesting the giant clears it.
- **Friends:** friends see your giant crops. To a friend the 9 crops are
  still 9 plantings: they can sneak one crop from each (047's limits: once
  a plot for each friend, 10 sneaks a day, the guard dog's catch), and each
  crop taken makes the giant one smaller. Pranks only go on growing crops.
- **Weather:** sets when each crop ripens and its mutation, as always; it
  doesn't change the chance. A giant shows in every weather.
- **Crop book and mastery:** a giant counts as 9 harvests of its crop (as
  harvesting them one by one would), for the book, its rewards and mastery.
  The book also counts giants grown and marks those crops GIANT. Giant
  crops are ordinary crops in the barn: they sell, fill orders and make
  treats like any other.
- **Not in:** no giant chance boosters and no giant-only rewards or titles.

## Phases

Each phase: branch from `main`, pull request into `main`. Before every push:
`npm run typecheck`, `npm run test`, `npm run build`; phases with UI also run
`npm run test:visual`.

1. **Journey and Missions numbers** (migration 035). Levels 1–100, 100 coins a
   level from Lv 50, titles at 60/75/90/100, the Daily Spark, season rules by
   month (30 × 1,200 from the next month), a one-time backfill for saved XP
   past Lv 50, and the Adventure dialog and result card for all of it.
2. **Lobby and HUD.** The Lobby as the screen after login; fixed-size HUD
   boxes with tabular numbers; the Lobby / Plaza / Farm switcher (Farm
   hidden); Full screen in Settings; Missions and Journey as Lobby drawers; an
   alignment pass on Shop and Wardrobe. Then party before a room (server).
   Order change (2 Nov 2026): the Gold Leaves wallet (migration 036) ships with
   the minimum farm (phase 4), since the farm is where most leaves are earned and
   spent. The new Plaza (phase 3) follows the farm.

3. **Gold Leaves and the new Plaza.** The leaves wallet; the prototype's Plaza
   map (shared layout, server movement with dash and bounce pads, client art
   from `art.js`); then the leaf features: Orb Shower scheduled and checked on
   the server, "Plaza today" quests, Volt boba, TOP DASH, the ball pitch.
4. **Farm, minimum version.** Farm, plot, seed and barn tables; RPCs for plant,
   water, harvest, buy seeds and land, sell, level up and the leaves → coins
   trade; server time in every response; the farm scene with crop art from
   `crops.js` and the touch model.
5. **Farm systems** (several pull requests): weather and mutations, market and
   orders; dogs, crows, bugs, tools; friends' farms; decorations, pasture, crop
   book and mastery, perks, the wishing well, treats in the Plaza.
6. **Art and feel.** Dog pathing, depth-sorted fences, status orbs, the
   expandable menu, weather effects, phone performance.
