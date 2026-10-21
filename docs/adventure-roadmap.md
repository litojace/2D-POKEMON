# Player journey, weekly arcade and Boss Rush

User-approved scope: all four features in one update. Progression is cosmetic; account levels never alter fighter stats or rating. Existing mastery, raid unlocks, purchases and admin testing stay independent.

- [x] Account levels 1–50: 100 + 25 × (level − 1) XP per next level. Verified completed PvP 50 (+25 win), AI 25, raid clears 100/150/200, partial raid XP by phase. Daily missions add 50. Thirty coins per level; ten milestones every five levels.
- [x] Weekly arcade: Monday rotation in Pacific time. Crown Chase (moving hill), Meteor Mayhem (telegraphed hazards), Ultimate Overload (4× meter charge). Supports private 1v1/2v2 and an AI opponent; separate from rating.
- [x] Boss Rush: weekly three-boss route, shorter final-chapter encounters, solo or 1–4 players. Health and rites carry; each raider chooses full healing or a smaller heal with ultimate charge at camp. Fifteen-second choices and pinned actions. Save one expedition receipt, including partial completion, without granting ordinary per-boss clears.
- [x] Free monthly seasonal journey: twenty 400-XP tiers, four themed cosmetic milestones, automatic rewards, four weekly goals. Previous rewards stay owned. No purchase gate.
- [x] Regression, persistence/permissions/replay tests, desktop and mobile browser review; push to main.

Database migration 022 is applied manually after 021; no production database connector is available. The client handles a missing migration without inventing saved progress.


Deployment: run `022_player_journey.sql` in Supabase after migration 021, then deploy this commit. The final SQL query returns `journey_enabled = true`. Reapplying 022 preserves XP, wallets, earned items, admin privileges and previous seasons. Existing player levels start at 1; past matches are not backfilled. The normal raid ledger and rating ledger remain separate from expeditions and arcade.

Balance values are initial settings pending human play feedback. Seasonal XP follows Pacific calendar months; weekly goals and mode rotation reset on Monday. Every monthly tier grants 50 coins, with cosmetics at tiers 5, 10, 15 and 20. Returning cosmetic themes grant 100 extra coins when a milestone item is already owned. Previewing a locked reward never grants it or changes an admin's earned level.
