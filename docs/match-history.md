# Match history

Your PvP and bot matches on your player card (a **Matches** tab), and your
friends' matches on their card. Built from what the game already saves; no
new table.

## What other games do (researched 20 Nov 2026)

| Game                       | Where                        | What a match shows                                                                                                                                                        |
| -------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| League of Legends          | Profile → Match History      | Recent games with champion, KDA, items; a game opens with all ten players.                                                                                                |
| Pokémon UNITE              | Trainer Info → Battle Record | Total battles and win rate, then each match (result, score, knockouts, mode, date), filtered by mode; a match reopens its results screen. Friends' records can be viewed. |
| Clash Royale / Brawl Stars | Battle log                   | The last ~25 battles; Brawl Stars adds replays.                                                                                                                           |

What we took: the profile tab (LoL, UNITE), recent form and a filter by
mode (UNITE), a match opening to everyone's numbers (LoL), friends seeing
each other's history (UNITE). What we did not: a 25-match cap (our data is
kept, so history pages back to the first match) and replays (we don't record
match events).

## What a player sees

- **Recent form**: the last ten results as W/L/D chips, the record and win
  rate over them, and the fighter played most.
- **A row per match**, newest first: Victory/Defeat/Draw with a coloured
  edge and the rounds' score (`Victory 2–1`), the mode, your fighter, who
  it was against (`vs Kai`, `vs Kai +1`, `vs Hard bot`) with an MVP tag
  when you were MVP, your fighter's name, how long ago and on which arena,
  each round won or lost (a dot per round; hidden on phones held sideways),
  damage and knock-outs (`736 dmg`, `2 KOs`), and the rating the match
  moved (`+16`, `−12`; nothing against bots, which move none).
- **Tap a row** for the board: column titles once (KOs, Damage, Combos),
  everyone's fighter portrait (not their own picture: those are creatures
  too, and beside "Cindrake" a player's wolf read as the fighter played),
  name and numbers, the card owner's side first and named
  for them (`Your side`, `Kai's side`), MVP marked. The MVP is the most
  damage on the **winning** side (the whole board on a draw), then most
  knock-outs; nobody when no one landed a hit. A loser marked MVP beside
  "Defeat" read as a contradiction (owner, 22 Nov 2026). A friend's name
  opens their card.
- **Your own bot match**, opened, offers **Play the Hard bot again** (the
  same level; the server picks the arena, as for any bot match). Not on a
  friend's card, nor for matches against players.
- **All / Players / Bots** filter the list; **More matches** loads the next
  ten.

On your card it's the **Matches** tab on a phone (after Overview) and a
section after your name on a desktop. A friend's card opens from Friends
(a friend's ⋯ → **Player card**) or from a name on any match board: their
card, their four numbers (matches, wins, win rate, raid clears) and their
history. **Friends** goes back to the list.

## Who can see it

You, and your friends. The database decides (`arena_match_history` refuses
anyone else, `42501` → 403), not the client. A friendship ends when either
player removes or blocks the other, and the access ends with it. A
suspended player's history can't be opened by friends.

## Where the data comes from

`supabase/migrations/20261120140000_match_history.sql` adds one read-only
function over existing tables:

- `arena_match_players` (migration 004): whose matches they are, the team
  and fighter, won or not.
- `arena_matches`: the summary every player reported (rounds, everyone's
  damage, knock-outs and combos).
- `arena_rating_changes` (006): the rating before and after.
- `arena_profiles`: everyone's current name and avatar. A deleted account
  (migration 109) is gone from there and shows as "Deleted player".

Pages are keyed on `(played_at, id)`, newest first, ten at a time (at most
30). The cursor is the database's own timestamp text, microseconds and all:
a JavaScript `Date` would round them and skip or repeat a match. The first
page also carries the player's totals and rating for the card's head.

The server (`GET /api/matches/history?player=&kind=&at=&id=`,
`apps/server/src/match-history.ts`) turns rows into the player's side of
each match: result and rounds from their team, their numbers, MVP.

## Limits to know

- **A PvP match only exists once every human in it reported it** (the
  anti-cheat rule of migration 004). If an opponent closes the game before
  reporting, that match never reaches anyone's history. Bot matches need
  only your report.
- **No match length**: summaries don't save it. Adding it would mean a
  summary version 2, and only later matches would have it.
- **No replays.**

## Tests

- `tests/integration/match-history.test.ts`: the SQL function on every
  migration: order, paging without gaps or repeats (two matches at the
  same instant included), filters, friends only, access ending with the
  friendship.
- `tests/unit/match-history.test.ts`: a match from each side, draws, bots,
  deleted accounts, MVP, the cursor kept exact.
- `tests/integration/social-routes.test.ts`: the route's login, parameters
  and refusals.
- `tests/visual/match-history.spec.ts`: your Matches tab and a friend's
  card at 844×390, 852×393 (Dynamic Island), 667×375 (iPhone SE) and
  1440×900; six tabs and Share card fit the phone head; the board's
  columns line up.
