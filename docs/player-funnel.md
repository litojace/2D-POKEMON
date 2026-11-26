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

## The Lobby tour

Since 21 Nov 2026 a new account's Lobby tour records how it ended
(`docs/onboarding.md`). This counts accounts made since then by how
their tour ended and how many of its 6 steps they saw, against the
same "played" and "came back" columns as above:

```sql
with played as (
  select player_id from arena_match_players
  union select player_id from arena_raid_players
)
select
  coalesce(t.tour, 'never ended') as tour,
  t.tour_reached as steps_reached,
  count(*) as accounts,
  count(*) filter (
    where p.id in (select player_id from played)
  ) as played_a_match_or_raid,
  count(*) filter (
    where p.last_online_at >= p.created_at + interval '20 hours'
  ) as seen_again_a_day_later
from arena_profiles p
left join arena_preferences t on t.user_id = p.id
where not coalesce(p.suspended, false)
  and p.created_at >= '2026-11-21'
group by 1, 2
order by 1, 2;
```

"never ended" is an account that left before finishing or skipping it,
or never reached the Lobby. A replay that ends differently replaces the
row, so a few "done" rows may be replays. The server log's `arena-tour`
lines count every ending, replays included (`"replay": true`).

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
  reward, visit the Farm, open the Bistro (those two steps went with the
  Farm and the Bistro in Nov 2026). Each has a Go button; the guide
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

## 26 Nov 2026: a short first match and features by level

What changed (`docs/onboarding.md`): a new account's first bot match is one
round and its second first to two; the first win reaches level 2; the side
systems open one a level, levels 2 to 6.

Compare with the 16 Nov run, for accounts made from 27 Nov on: the share
that **played a match or raid**, and the share **seen again a day later**
(the first query above, with `and p.created_at >= '2026-11-27'` in `p`).

How far new accounts get, by level and matches finished (counts only):

```sql
with p as (
  select pr.id, coalesce(pr.guest, false) as guest,
         public.arena_level_for(coalesce(x.xp, 0)) as level,
         (select count(*) from arena_match_players m where m.player_id = pr.id) as matches,
         pr.last_online_at >= pr.created_at + interval '20 hours' as came_back
  from arena_profiles pr
  left join arena_player_xp x on x.player_id = pr.id
  where not coalesce(pr.suspended, false)
    and pr.created_at >= '2026-11-27'
)
select least(level, 7) as level_capped_at_7,
       least(matches, 3) as matches_capped_at_3,
       count(*) as accounts,
       count(*) filter (where guest) as guests,
       count(*) filter (where came_back) as seen_again_a_day_later
from p
group by 1, 2
order by 1, 2;
```

How many got the First Win XP, and how soon after signing up:

```sql
select count(*) as first_wins,
       percentile_cont(0.5) within group (
         order by extract(epoch from l.created_at - p.created_at) / 60
       ) as median_minutes_from_signup
from arena_xp_ledger l
join arena_profiles p on p.id = l.player_id
where l.source = 'first-win';
```

The server's `arena-match` log line has `"intro": 1` or `2` for a short
match (null otherwise), with its length in `seconds`: how long a first
match really takes, and how many are won (`winnerTeam` against the
fighters' teams).

Before this change (production, 26 Nov): 32 accounts; 18 at level 1 (12 of
them guests), and 16 of those 18 without a finished match.
