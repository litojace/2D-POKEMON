# New player funnel

How many accounts get as far as a first match, and how many come back. Run
the query in Supabase's SQL Editor (read-only; it returns counts, no
names or emails) and compare with the earlier runs below.

```sql
with p as (
  select id, guest, created_at, last_online_at
  from arena_profiles where not coalesce(suspended, false)
),
played as (
  select player_id from arena_match_players
  union select player_id from arena_raid_players
)
select
  (p.id in (select player_id from played)) as played_a_match_or_raid,
  p.guest,
  count(*) as accounts,
  count(*) filter (
    where p.last_online_at is null
       or p.last_online_at < p.created_at + interval '30 minutes'
  ) as gone_within_30_min,
  count(*) filter (
    where p.last_online_at >= p.created_at + interval '20 hours'
  ) as seen_again_a_day_later
from p
group by 1, 2
order by 1, 2;
```

`last_online_at` keeps only the latest visit, so "seen again a day later"
means the player came back at least once, not that they came back the next
day. Only finished matches and raids are saved: a room left before the end
doesn't count as played. The owner's and testers' accounts are included.

## 16 Nov 2026 (24 accounts, first one 12 Oct)

| Played a match or raid | Guest | Accounts | Gone within 30 min | Seen again a day later |
| ---------------------- | ----- | -------: | -----------------: | ---------------------: |
| no                     | no    |        6 |                  2 |                      3 |
| no                     | yes   |        9 |                  9 |                      0 |
| yes                    | no    |        7 |                  1 |                      5 |
| yes                    | yes   |        2 |                  2 |                      0 |

- 15 of 24 accounts never finished a match or a raid.
- Guests are where new players drop: 9 of 11 never finished one, every
  guest left within half an hour, and none came back.
- Saved matches: 117 duels against a bot, 15 duels between players, no
  2v2 or free-for-all. Raids: 116 runs, half of them Cragmuff.

What changed after this run:

- PLAY starts a new player against an Easy bot instead of opening a
  private 1v1 room that waits for a second player.
- **Getting started** (`apps/client/src/getting-started.ts`): an account
  at level 5 or below sees five steps on the Lobby, in the Journey card's
  place: play a match against a bot, defeat Cragmuff, wear the first
  reward, visit the Farm, open the Bistro. Each has a Go button; the guide
  can be hidden, and the Menu's _Getting started_ brings it back. Steps the
  server knows (a Cragmuff clear, something worn) come from the account;
  the others are remembered per account in the browser.
- The reward reveal offers **Wear it now** for an appearance reward.
- **The first match's coach** (`apps/client/src/battle-coach.ts`): while
  Getting started still has its bot match to do, that match shows one line
  at a time above the skill buttons (on a phone, under the scoreboard):
  move, basic attack, a skill, dash, then "Win 3 rounds". Each line goes
  when the player does it, with their own keys or the touch buttons.

Compare the guest rows on the next run.
