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
| First bot match         | **Coach**: move, attack, skill, dash, goal, one line at a time                                                                           | `battle-coach.ts`    |
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

## Next steps worth considering

- A short first-visit tip for screens that have none (Wardrobe, Ranks,
  Friends), as data in the same style.
- A reward for finishing Getting started (UNITE and Wild Rift do this).
- Read the tour query in `docs/player-funnel.md` after a week of new
  accounts: which step people skip at, and whether skipping changes who
  plays a first match.
