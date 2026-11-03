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
| 5   | Giant crops (3×3)               | Later, after the farm systems.                                                                                                                                                                                                                                            |
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
- **Old town:** the Plaza tab now opens the new Plaza; the old town is no longer
  opened from the hub. Its code, art and tests are removed in a follow-up pull
  request once the Plaza is live (the server keeps answering old clients'
  town events until then). Tapping a player in the Plaza shows their card with Add friend and
  Invite to party, in place of the town's Nearby players panel.
- **Not yet:** treats thrown in the Plaza (farm systems, phase 5), and the
  photo album (the polaroid can be saved as a picture).

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
