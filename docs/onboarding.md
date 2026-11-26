# Onboarding: the Lobby tour and How to play

How a new player learns the game, and what we took from bigger games.
Code: `apps/client/src/hub-tour.ts` (tour), `apps/client/src/how-to-play.ts`
(reference screen), `getting-started.ts` (first steps), `battle-coach.ts`
(first match). Tests: `tests/unit/hub-tour.test.ts`,
`tests/unit/how-to-play.test.ts`, `tests/visual/hub-tour.spec.ts`.

## What big games do (research, Nov 2026)

Sources were checked where the page could be read; others come from search
summaries and are marked. No reliable public numbers on tutorial skip rates
were found for any of these games, so none are quoted here.

1. **Teach by doing.** Brawl Stars puts new players in a short controls
   tutorial and a bot match before the lobby (secondary). Celia Hodent's GDC
   2016 onboarding talk (Fortnite UX) argues for active tutorials
   (gdcvault.com/play/1022951).
2. **Several short lessons at the right moment beat one long one.** Apple's
   guide cites Clash Royale's five short tutorials, and says to explain
   side systems (daily challenges, leaderboards, purchases) in context,
   after onboarding (developer.apple.com/app-store/onboarding-for-games,
   read in full).
3. **Few coach marks, about what is on screen.** NN/g warns that a run of
   coach marks strains memory and makes an app look harder
   (nngroup.com/articles/mobile-instructional-overlay; snippet only).
4. **Let players skip, and replay later.** Wild Rift asks if you have played
   League and lets you skip; Hearthstone's practice matches can be skipped
   (both secondary). Pokémon UNITE keeps its tutorials under Practice;
   Genshin keeps tutorial cards in its Archive (secondary). Apple: offer a
   reference section players can open at any time.
5. **A tutorial is worth more in a more complex game.** A CHI 2012 study of
   45,000 players found tutorials raised play time by up to 29% only in the
   most complex game (grail.cs.washington.edu/projects/game-abtesting/chi2012).
   Our battles are complex enough; the hub menus are not, so the hub tour is
   short and the battle is taught by playing it.
6. **Help screens:** topics in tabs, one idea per card, a picture and one to
   three sentences, and a way to go and try it (UNITE ties guides to its
   training mode).

## What we do

| Moment                  | What                                                                                                                                     | Where                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| First Lobby (level ≤ 5) | **Lobby tour**: 6 spotlights (PLAY, rail, cards, fighter, Lobby/Plaza, Menu). Skip on every step, no confirmation. Esc skips, → is Next. | `hub-tour.ts`        |
| Lobby                   | **Getting started**: 3 steps (bot match, Cragmuff, wear the reward)                                                                      | `getting-started.ts` |
| First bot match         | **Coach**: move, attack, skill, dash, goal, one line at a time. The match is one round (below)                                           | `battle-coach.ts`    |
| Levels 2 to 6           | **Unlocked** dialog: the side system that level opened (Boss Raids, Missions, the Plaza, the Shop, Ranks)                                | `feature-unlocks.ts` |
| First visit             | Feature tips already in place: Plaza help (desktop), Spire guide, mission "how to complete"                                              | each screen          |
| Any time                | **How to play**: Basics, Battle, Controls, Modes, Progress, Plaza & friends; Go buttons open the feature; "Replay the Lobby tour"        | `how-to-play.ts`     |

Rules kept:

- **Data, not branches.** Tour steps and help cards are arrays. A step
  whose target isn't on screen is passed over; a new mode is a new card.
  Numbers (rounds, EX cost, orb heal, fighter count, rites) come from the
  shared rules, so the text can't drift; the unit test checks it.
- **Phones first.** The bubble is placed beside its target inside the
  safe area (`placeBubble`, unit-tested); controls show the device in use
  (touch buttons on a phone, the player's own keys, controller names).
- **How the tour ended is kept with the account** (migration
  `20261121090000_lobby_tour.sql`: `arena_preferences.tour`,
  `tour_reached`, `tour_at`; `GET`/`POST /api/account/tour`), and in this
  browser too (`arena-tour:<account>`). The browser answers first; only
  when it has never seen the tour end does the client ask the account, once,
  and it starts the tour after the answer (no answer: it shows it). So
  another device doesn't show it again.
- **Every ending is counted:** the server logs one `arena-tour` line
  (`result`, `reached`, `steps`, `replay`; no account), and the database
  row is the per-account record the funnel query reads
  (`docs/player-funnel.md`). A replay that ends differently replaces the
  row.

## A short first match, and features that open by level (26 Nov 2026)

Apple's guide (above, 2): let people play at once, teach in steps, bring in
side systems afterwards. Two changes follow it.

**The first matches are short.** A new account's first match against a bot
is one round; the second is first to two; from the third on a match is the
usual first to three (`INTRO_ROUNDS` in `packages/shared/src/index.ts`).

- Only a solo match against a bot (PLAY's default for a new player, the bot
  levels, Quick Match's fallback bot). A match between players always has
  its full length, so nobody's rating rides on one round; the weekly arcade
  keeps its own rules.
- The server decides: when a bot match starts it reads the account's
  finished matches (`arena_my_progress`, 1.5 s at most; no answer means a
  full match) and remembers for the connection once an account is past its
  first two. A rematch in the same room counts on: one round, two, full.
- The room's snapshot carries `introRounds`; the briefing ("One round: win
  it to take the match"), the HUD's "BO1", the coach's goal line and the
  Lobby's mode hint ("Learning · one round") read it. An older app version
  shows "BO5" and the match still ends when the server says so.
- "Flawless" (win without dropping a round) can now be earned in that first
  round. It could already be earned 3–0 against an Easy bot.

**The first win reaches level 2.** A bot match pays 25 XP (50 with the Daily
Spark) and level 2 needs 100. The day's missions often add the rest, but not
every day's six do. So a won short match tops an account that is still
under level 2 up to it: the First Win XP (migration
`20261126120000_first_win_xp.sql`), what is missing and no more, at most
199 XP with the Spark, so it never skips level 3 by itself. The result
card lists it ("75 First Win bonus").

**Side systems open by level** (`apps/client/src/feature-unlocks.ts`):

| Level | Opens          | Where its padlock shows                           |
| ----- | -------------- | ------------------------------------------------- |
| 2     | Boss Raids     | Rail, the mode menu's Boss Raid, the guide's step |
| 3     | Daily Missions | Rail, the Missions card                           |
| 4     | The Plaza      | The Lobby / Plaza switch                          |
| 5     | The Shop       | Rail                                              |
| 6     | Ranks          | Rail, the Menu's Leaderboard                      |

- A locked button stays where it is with a pill, "Lv 3"; a tap says "Daily
  Missions open at Lv 3". A level that opens something shows the
  **Unlocked** dialog once on the Lobby (level, the feature in one line,
  what opens next, Open / Later). Several levels at once share one dialog.
- Never locked: PLAY and every mode but the raid, Fighters, Friends, the
  party, room codes and invites, Settings, the Wardrobe (a reward's "Wear
  it now"). Anything a friend invites you to opens whatever your level.
- It is pacing, not permission: the server allows everything at any level.
  The client alone hides nothing and refuses nothing a link or an invite
  opens.
- The first time a browser sees an account it only remembers its level
  (`arena-unlocks:<account>`): no dialogs for features an account already
  had, or on a second device.
- Who this touched when it shipped (production, 26 Nov): 32 accounts; of
  the 9 seen in the week before, 6 were level 7 or above (no padlocks), 2
  level 1 and 1 level 3.
- To move a feature, change its level in `FEATURE_UNLOCKS`; the padlocks,
  the messages, the dialog and the tests' table follow.

Tests: `tests/unit/intro-rounds.test.ts`, `tests/unit/feature-unlocks.test.ts`,
`tests/integration/intro-match.test.ts`, `tests/integration/first-win-xp.test.ts`,
`tests/visual/feature-unlocks.spec.ts`.

## The result sheet celebrates what a match gave (26 Nov 2026)

A player should feel what they just earned before the button asks for
another match. A PvP or bot match's result sheet used to say "Victory",
the score and "+125 XP" in one line of text. Now
(`apps/client/src/result-rewards.ts`):

1. On a win your fighter's portrait hops beside the score and confetti
   falls over the sheet's head.
2. Tiles appear one after another, each with a bar that runs from where
   you were to where you are:
   - **XP**: the level bar; when it fills, LEVEL UP, and a line under the
     tiles says the level, its coins, a milestone's title or cosmetic and
     the feature it opened ("Unlocked: Boss Raids").
   - **Rank** (rated matches): the rating change in green or red and your
     place between this rank and the next; RANK UP on a promotion.
   - **Season**: the tier bar; TIER UP.
   - **Mastery**: your matches with this fighter toward its next tier.
   - **Coins**: what the match, its missions and a level paid.
3. **Rematch** (Play again against a bot) is the widest button; **Add
   friend** sits beside it after a 1v1 with someone who isn't a friend yet.

Rules kept:

- Every number comes from what the server already sends: the journey's
  recent XP rows (`xpAward`), the match report's rating, your records, and
  the coin balance before and after. Nothing is counted on the client that
  the server didn't save.
- The sheet is drawn again whenever its markup changes (the XP arriving,
  the opponent ready), which would start every animation over:
  `syncRewardMotion` puts each tile's animations back where they were.
- Transform and opacity only, no layout read, the same markup for the same
  facts. Reduced motion and Low graphics show the end state at once, with
  no confetti. `tests/visual/battle-style-budget.spec.ts` and
  `match-flow-budget.spec.ts` cover it like any battle UI.
- Tile rows always fill the width (three a row; five tiles are three and
  two; four are two and two), so no row ends in an empty box.
- Raids and the Spire keep their own result cards (`resultXp`).

Tests: `tests/unit/result-rewards.test.ts`,
`tests/visual/result-rewards.spec.ts`.

## The daily gift (26 Nov 2026)

No guest came back after their first day (`docs/player-funnel.md`, 16 Nov).
The mission streak's 300 coins need all six missions seven days running,
which only the keenest players reach; nothing rewarded simply showing up.
Apple's guide: show players what coming back regularly gives, with rewards
that grow with the days in a row.

| Day | Gift                                                              |
| --- | ----------------------------------------------------------------- |
| 1   | 50 coins                                                          |
| 2   | 100 XP                                                            |
| 3   | 75 coins                                                          |
| 4   | 150 XP                                                            |
| 5   | 100 coins                                                         |
| 6   | 200 XP                                                            |
| 7   | The Firefly aura in a player's first week; 200 coins from then on |

- **One a Pacific day** (the missions' day). The next day in a row is the
  next gift; after day 7 comes day 1 of the next week.
- **A missed day is forgiven once in a row:** two days after the last gift
  the row still goes on. Three or more days away, it starts again at day 1.
- **The cosmetic is the first week's only** (or its coins, for a player who
  owns it), so the Shop's prices keep their meaning: a week of gifts is 225
  coins, 425 from the second week, against about 300 to 400 a day from
  missions.
- **Where it shows:** the dialog opens on the Lobby while today's gift
  waits, with seven days, today's lit, and Claim. Once taken it says what
  it gave and what tomorrow's is. Later puts it away for this visit; the
  Menu's _Daily gift_ opens it at any time. A match's result sheet says
  "Tomorrow's gift: 150 XP" in a line.
- **A brand-new player plays first:** the dialog waits until they have
  finished a match or reached level 2, and for the Lobby tour and the
  Unlocked dialog.
- **The database gives the gifts** (migration `20261126150000_daily_gift.sql`):
  `arena_daily_gift_claim()` locks the player's row, checks the day, and
  pays coins and XP as ledger rows keyed by the day, so a second claim
  (a double tap, two devices) pays nothing. The client's table
  (`packages/shared/src/daily-gifts.ts`) is only what it shows;
  `tests/integration/daily-gift.test.ts` holds the two together.
- XP from a gift is ordinary XP (the Daily Spark doubles it, the season
  counts it).

Code: `packages/shared/src/daily-gifts.ts`, `apps/client/src/daily-gift.ts`,
`GET /api/gift` and `POST /api/gift/claim` in `apps/server/src/accounts.ts`.
Tests: `tests/unit/daily-gift.test.ts`, `tests/integration/daily-gift.test.ts`,
`tests/integration/daily-gift-routes.test.ts`, `tests/visual/daily-gift.spec.ts`.

## Next steps worth considering

- A short first-visit tip for screens that have none (Wardrobe, Ranks,
  Friends), as data in the same style.
- A reward for finishing Getting started (UNITE and Wild Rift do this).
- Read the tour query in `docs/player-funnel.md` after a week of new
  accounts: which step people skip at, and whether skipping changes who
  plays a first match.
