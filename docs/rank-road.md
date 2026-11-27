# The rank road

Owner, 26–27 Nov 2026: ranks a new player can read and wants to climb. The
ten ranks named after chess titles (Newbie … Legendary Grandmaster) became a
road of **seven tiers of three steps**, with a reward at each tier, a shield
after each promotion, and the player's rank always on the Lobby.

The rating underneath did not change: everyone starts at 1000, the first 5
matches against players are placement, Elo moves it (K 40 while placing, 24
after), bot matches leave it alone, and each month it moves a quarter of the
way back to 1000 (`docs/accounts-setup.md`, "Ratings and ranks").

## The road

Each tier has three steps: III, then II, then I. A rank is "Spark II".

| Tier    | III  | II   | I    | Coins, once |
| ------- | ---- | ---- | ---- | ----------- |
| Sprout  | 0    | 900  | 950  | none        |
| Spark   | 1000 | 1035 | 1070 | 100         |
| Flare   | 1105 | 1140 | 1175 | 150         |
| Tempest | 1210 | 1250 | 1290 | 250         |
| Prism   | 1330 | 1370 | 1410 | 400         |
| Nova    | 1450 | 1500 | 1550 | 600         |
| Legend  | 1600 | 1675 | 1750 | 1000        |

- A player who finishes placement near 1000 lands in Spark: a few wins from
  a step. From Spark up, steps are 35 to 75 rating apart (a win against an
  equal is +12).
- The names are short on purpose: the longest, "Tempest III", fits the
  Lobby's chip and a result tile on a 667 px phone. "Legendary Grandmaster"
  did not.
- Legend is reached by rating alone. The old top rank also needed the #1
  spot, so only one player could ever hold it.

The table lives twice and a test holds the two together
(`tests/integration/rank-road.test.ts`): `RANK_TIERS` in
`packages/shared/src/accounts.ts` for what the game shows, and
`arena_rank_ladder` in the database for what it grants.

## What a tier gives

- **Its title, for good.** Reaching a tier adds its title (Sprout … Legend,
  in the tier's colour) to the player's titles, and every tier under it.
  Titles are never taken away when the rating drops.
- **Its coins, once.** A ledger row per player and tier (`rank-tier`), so
  dropping out and climbing back pays nothing more. The whole road is 2,500
  coins, about a week of missions, spread over months of play.
- **A shield.** Reaching a higher tier gives one. The first loss that would
  drop the player out of that tier holds them on its first step instead and
  uses the shield up. A loss that stays inside the tier keeps it. A step up
  inside a tier gives none, and neither does the match that ends placement.
  So the very next loss does not undo a promotion.

## Titles earned before the road

All ten old titles stay: in the titles table, with every player who earned
one or was given one, worn if they wear one. They are no longer handed out,
so they now mark who played before the road. `LEGACY_RANKS` keeps their
colours for the places that draw a rank by name.

Players who were already ranked got their tier's title and coins when the
migration ran, not at their next match.

## Where players see it

- **The Lobby:** a chip beside the fighter's element, in the tier's colour
  ("Tempest III"); a shield in hand shows in the gem's place. While placing
  it counts the matches ("Placing 2/5"). A player who has never met another
  player sees nothing until Ranks opens at level 6, then "Unranked". In a
  friend's party the leader's fighter stands in the middle, so the chip
  waits (it would read as theirs). It only says: the rail's Ranks button
  opens the road.
- **Ranks** opens on **Road**, with Everyone and Friends beside it: the
  seven tiers, the highest on top, each with its three steps (yours lit),
  the rating it starts at, its reward, and a tick once it is yours. Your
  card on the left says how far the next rank is and whether you hold a
  shield.
- **After a rated match:** the Rank tile says "Rank up", "New tier",
  "Ranked" (placement over) or "Shield" (it held this loss), and a toast
  says the same once.

## In the database

Migration `20261127090000_rank_road.sql`:

- `arena_rank_ladder` gets `tier`, `step` and `coins`; the 21 ranks replace
  the ten old rows. `arena_ratings.shield` is the tier a shield protects;
  `arena_rating_changes.shielded` marks the match it held.
- `arena_grant_rank_titles` gives every tier reached its title and coins;
  `arena_apply_ratings` (as migration 065) gives and uses the shield where
  it writes each new rating; `arena_rating_of` says `shield`, and a match
  report says `shielded`.
- Boss raid ids, rating history and match history are untouched.

## Changing it

- **A threshold or a reward:** a new migration that updates
  `arena_rank_ladder`, and the same numbers in `RANK_TIERS`. Coins already
  paid stay paid.
- **A tier's name:** the ladder rows, the title's name and `RANK_TIERS`,
  in one migration; the title keeps its id, so owners keep it.

Code: `packages/shared/src/accounts.ts` (`RANK_TIERS`, `rankAt`),
`apps/client/src/rank-chip.ts`, `apps/client/src/screens/ranks-view.ts`,
`apps/client/src/result-rewards.ts`. Tests:
`tests/integration/rank-road.test.ts`, `tests/integration/ratings.test.ts`,
`tests/unit/rank-chip.test.ts`, `tests/unit/ranks.test.ts`,
`tests/visual/rank-road.spec.ts`.
