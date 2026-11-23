# Plaza rewards (21 Nov 2026)

The owner set the Plaza's daily quests to an even **100 shop coins a day**,
with "Catch 10 fish" at 30. This note says how the other 70 were split and
how the Plaza compares with the Lobby's daily missions. Migration
`20261121180000_plaza_quests_hundred.sql`; the amounts live in
`PLAZA_QUESTS` (`packages/shared/src/plaza.ts`), checked against the
database by `tests/integration/plaza-rewards.test.ts`.

## Each quest, by the effort it takes

| Quest                     | What it takes                                                                                   |  Before |     Now |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ------: | ------: |
| Catch 10 fish             | 10 catches, each a bite (2–6 s) and a fight; about 5 min with misses                            |      25 |  **30** |
| Catch 10 falling orbs     | 10 orbs in one Orb Shower (one minute every 15), against everyone else: up to 15 min of waiting |      15 |  **20** |
| Run a lap in under 30 s   | A full lap over three hurdles without leaving the lane; a few tries                             |      20 |  **20** |
| Score a goal on the pitch | A goal past the pitch's bots: a minute or two                                                   |      20 |  **15** |
| 15 cheers on the runway   | Stand on the runway (a cheer about every 0.6 s): under 10 s                                     |      15 |  **10** |
| Use the Photo Spot        | One tap                                                                                         |      10 |   **5** |
| **A day**                 |                                                                                                 | **105** | **100** |

The time-gated and skill quests (fish, orbs, lap) went up or stayed; the ones
done in seconds (cheers, photo) went down.

## Next to the Lobby

The Lobby's six daily missions pay 40 (easy), 70 (medium) and 120 (hard),
two of each, plus 50 for all six: **510 a day** for roughly an hour of
matches and raids (`MISSION_COINS`, `COINS.allMissionsBonus` in
`packages/shared/src/shop.ts`). A PvP win pays 15.

All six Plaza quests take about 15–25 minutes, most of it waiting for an Orb
Shower and fishing: about **4–6 coins a minute**, against about **7–8** for
the Lobby's missions. The Plaza pays a little less per minute on purpose, so
it stays the place to relax between battles rather than the better way to
earn. "Catch 10 fish" (30 for about 5 minutes) is level with an easy Lobby
mission (40 for 2 matches, 6–10 minutes).

Other Plaza coins, outside the 100:

- **First catch of each fish:** 5 / 10 / 25 / 50 by rarity, once per fish
  (22 fish since 22 Nov: 8 common, 7 uncommon, 5 rare, 2 legendary, so
  40 + 70 + 125 + 100 = **335** in all, once ever; before, 11 fish paid
  175, not the 220 this note used to say).

The wishing fountain (15 a fill, at most 2 fills a day) was taken out on
23 Nov 2026, so a Plaza day pays at most 100, and the Fish book 335 once, spread over
weeks: a given rare fish bites about once in 70 casts and each legendary
about once in 370, by day or by night only, and rarer fish are harder to
land (`PLAZA_FIGHT` in `packages/shared/src/plaza-fight.ts`).

## Gift boxes (23 Nov 2026)

The free daily treats became gift boxes (`PLAZA_GIFT`, migration
`20261123120000_plaza_gifts.sql`). They pay **no coins** themselves:

- **Where they come from:** 3 free a Pacific day, 1 more for each Plaza
  quest done that day (up to 6), and 1 for each Rare or Legendary fish
  caught that day (at most 3). So 3–12 a day.
- **What they do:** a tossed box bursts open and spills 4 orbs (8 for a
  golden box, 1 in 10). Anyone **but the thrower** can catch them, and each
  catch counts as an orb toward "Catch 10 falling orbs", under the orb
  caps (10 per shower or box, 50 a day). So boxes let players help each
  other finish the orbs quest between Orb Showers. They add no coins
  beyond the quest's 20 a day.
- **Abuse:** a second account tossing its boxes to a main can at most fill
  the main's orbs quest (20 coins a day), the same as one Orb Shower.

## Still to check

Whether the Shop's prices fit what players earn (an Epic skin is 3,500: about
a week of the Lobby's missions) needs the live numbers: the coins paid and
spent per player per day, by source. That measurement is a separate task.
