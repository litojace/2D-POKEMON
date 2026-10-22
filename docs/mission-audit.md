# Mission completion audit

Audited all 30 daily missions and all four seasonal weekly goals through the trusted server activity path and the complete database migration chain. Every daily mission has an executable completion test that checks incremental progress, completion, coin and XP rewards, duplicate reports and later results. Negative cases cover the relevant difficulty, fighter, mode, Peril, party-size and raid-result requirements.

## Bugs corrected

- Migration 024 removes the 20-second gate from completed bot matches. It covers generic wins, fighter-specific wins, Hard-bot wins, bot-win and match-completion missions. PvP retains its existing gate.
- Migration 025 retains sub-minute combat time on each active play-time mission. Three completed 20-second games now count as one minute instead of zero. The public progress remains whole minutes. Both time missions can progress independently, and changing one slot cannot erase another slot's remainder.
- Migration 025 forwards Boss Rush activity to daily skill-use, ultimate-use and play-time missions. Expeditions still do not award ordinary per-boss clears, feats or solo/party-clear missions.
- The server keeps departed raid seats in the activity receipt. The database excludes their rewards while retaining the party size, so the remaining player's co-op clear is not reclassified as solo.

## Daily mission coverage

| Missions                                                     | Qualifying result tested                                              |
| ------------------------------------------------------------ | --------------------------------------------------------------------- |
| Play 2 matches                                               | Finished bot match, win or loss                                       |
| Clear any raid; Clear 2 raids; Clear 3 raids                 | Regular raid victories on any Peril                                   |
| Use 30 skills                                                | Skills 1–4, including ultimates, in matches, raids or Boss Rush       |
| Use your ultimate 3 times; Use your ultimate 8 times         | Ultimate casts across finished games; EX is separate                  |
| Win a match                                                  | Finished bot or player match victory                                  |
| Finish a raid, win or lose                                   | A regular raid clear or a defeat after 20 seconds                     |
| Play for 10 minutes; Play for 30 minutes                     | Accumulated combat time across finished games, retaining seconds      |
| Win 2 matches against players; Win 5 matches against players | Bot-free PvP victories lasting at least 20 seconds                    |
| Clear today's Raid of the Day                                | A victorious daily raid                                               |
| Help revive 3 allies in raids                                | Completed ally revives credited to each helper; self-revives excluded |
| Win as Terradon or Tidefin                                   | A win with either named fighter                                       |
| Win as Cindrake or Lumoth                                    | A win with either named fighter                                       |
| Win as Voltkit or Auralynx                                   | A win with either named fighter                                       |
| Win as Mystowl or Duskveil                                   | A win with either named fighter                                       |
| Beat a Hard bot; Beat 3 Hard bots                            | Hard-difficulty bot victories; Easy/Normal excluded                   |
| Win 3 matches against bots                                   | Bot victories at any difficulty, including short matches              |
| Clear a raid on your own                                     | A regular solo raid victory                                           |
| Clear a raid with a friend                                   | A regular co-op victory; a Friends-list relationship is not required  |
| Clear any raid on Peril 3                                    | A regular Peril 3 victory                                             |
| Clear a raid with no downs                                   | A regular raid victory with zero party downs                          |
| Win a 2v2 without being knocked out                          | A team-match victory with zero personal knockouts across its rounds   |
| Complete a boss feat                                         | A regular raid victory with its server-verified boss feat             |
| Clear a raid on your own on Peril 2 or higher                | A regular solo Peril 2/3 victory                                      |
| Win a free-for-all                                           | A bot-free PvP free-for-all victory lasting at least 20 seconds       |

## Weekly goals and safeguards

All four weekly goals reach their targets and award their 250 seasonal XP once: five completed games, 50 skill casts, two regular raid clears or Boss Rush legs, and three weekly arcade games. Their existing participation and 20-second requirements remain. Boss Rush reports aggregate skill/ultimate/time counters once at the end of the expedition, including a partial run.

Regression tests also cover idle and abandoned seats, per-slot time resets, the Pacific daily reset, the per-result 30-minute cap, reapplying the migration, three free mission changes, reward permissions, the all-three bonus and the seventh-day streak bonus. Socket tests verify Easy/Normal/Hard bot receipts, actual skill and ultimate casts, PvP team/free-for-all wins and knockout history, co-op departures, economy refresh notifications, and exclusion of solo practice and raid attack drills. Existing boss simulation tests cover all seven boss feats.

## Activation and limits

Deploy the server/client changes and apply migrations 024 then 025 after the earlier migrations. Migration 025 returns three **true** verification columns. Existing progress and rewards are preserved; discarded seconds and old Boss Rush receipts cannot be recovered from the old activity ledger.

Activity rewards require login, `SUPABASE_SERVICE_ROLE_KEY` on the server and a successful database write. A result marked unavailable has not been confirmed saved. This audit runs the real SQL locally with PostgreSQL-compatible PGlite and the real Socket.IO server with a test account provider; it does not verify the live Supabase deployment or production credentials.
