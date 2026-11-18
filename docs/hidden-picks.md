# Hidden picks in PvP rooms

Design (owner-approved, Nov 2026, in Vietnamese):
https://claude.ai/artifact/GafXctqQkGZPULhoUrJJJv

In a PvP room (1v1, 2v2, free-for-all) you can't see what the other side
picks. You see your own fighter and, in a 2v2, your teammate's. Every pick
is revealed when the match starts, on the briefing (the VS screen). Raid and
Spire rooms keep picks open, because everyone there is on one side.

## Rules

| In the lobby                             | You | Teammate | Other side | Watcher |
| ---------------------------------------- | --- | -------- | ---------- | ------- |
| Name, title, frame                       | yes | yes      | yes        | yes     |
| Fighter being looked at (not locked)     | yes | yes      | no         | no      |
| Fighter locked in                        | yes | yes      | no         | no      |
| Whether they have locked in or are ready | yes | yes      | yes        | yes     |
| Every fighter, from the briefing on      | yes | yes      | yes        | yes     |

- **Locking in.** Coming into a room no longer locks your Lobby fighter in;
  it is only shown (`browse`). **Lock in** (`select`) or **Ready** locks it.
  The seat reads Choosing, Locked or Ready.
- **One fighter per 2v2 team.** The first teammate to lock in a fighter
  keeps it. For the other teammate the card is greyed out and marked
  **Taken**, Lock in reads "Taken", and the server refuses it ("Rae already
  picked Tidefin"). If a team change or shuffle puts two locks of the same
  fighter on one team, the later lock is undone.
- **The same fighter on both sides is allowed**, and in a 1v1 or a
  free-for-all anyone may pick anything. Refusing it would reveal what the
  other side took. LoL Blind Pick, Pokémon UNITE and Valorant work this way.
- **Bots.** A bot match goes straight to the briefing, so the bot's pick is
  first seen there. Back in a bot room's lobby, the bot is another side and
  its pick is hidden like a player's.
- **No pick timer** in private rooms.

## How it is enforced

The server is the only judge. A client is never sent another side's pick,
so hiding it in the UI is not the protection. (LoL hid names in champion
select in the UI only, and outside tools still read them.)

- `packages/shared/src/pick-rules.ts`: `picksHidden(room)` (a PvP room in
  its lobby), `pickTakenBy` and `pickClashes` (one fighter per 2v2 team),
  and `veilPlayers`. For another side, `veilPlayers` replaces `character`
  with a placeholder, drops `browse`, and sets `veiled: true`.
- `Fighter.locked`, `Fighter.browse` and `Fighter.veiled`
  (`packages/shared/src/index.ts`).
- `apps/server/src/server.ts`:
  - `broadcast` sends each side, and the watchers, its own copy while
    `picksHidden`. Each copy is built once per side.
  - `select` checks the team rule and locks the pick. `browse` stores the
    fighter being looked at; in a raid room it is the pick itself. `ready`
    locks the fighter on show. `team` and `shuffle` undo clashes.
- Other leaks closed:
  - The friends' presence (`listOnline`) sends no fighter while you're in a
    PvP lobby.
  - The friends' portrait (`arena_set_portrait_character`) is saved when the
    match starts (`savePicks`), not on each pick.
  - A room invitation links the party with the fighter the party already
    knew, not the pick.
- Not hidden: the mastery flair travels in the shared appearance block. It
  is a tier (Bronze…Crystal), not a fighter, and the seat doesn't show it
  for a hidden pick.

## Client

- `screens/room-view.ts`: a PvP seat shows the player
  (`identityPortrait`: frame and initial, until the avatar library lands)
  and their pick in a tile beside it. The tile is the fighter (dashed while
  they're looking at it, green once locked in), or "?" for another side's.
- `screens/roster-view.ts`: your teammate's name on the fighter they're
  looking at or have locked in. A fighter they locked in is greyed out and
  marked Taken.
- `main.ts`: `seatPick`, `mateData`, and `browseFighter` (sends the fighter
  you stop on, after 250 ms).
- **Art loading.** Fighters are rasterized ahead (`fighter-prepaint.ts`) only
  for the picks you may see. A hidden pick is loaded at the briefing, and
  "I'm ready" there already waits until the arena and every fighter have
  loaded (`arenaLoading`). Nothing loads mid-fight
  (`match-flow-budget.spec.ts`). On older phones the briefing takes a little
  longer, about 0.5–0.8 s per hidden fighter by the Nov 2026 `arena-load`
  numbers.

## A room has no top bar

In a room (PvP, raid or watching), the top bar (coins, level, settings) is
hidden, which gives the seats and the picker the space instead.

- The chat button sits in the banner's top-left corner.
- The **⋯** button in the other corner opens Settings, How to play, Invite
  friends, and Leave (or Stop watching).
- `screens/room.css` ("a room has no top bar") places both from the same
  numbers as the seats.

## Tests

- `tests/integration/hidden-picks.test.ts` uses the real Socket.IO server.
  It checks that nothing a 1v1 opponent receives in the lobby names your
  fighters, that watchers see no pick, the 2v2 teammate rules (Taken, and
  Ready locking the fighter on show), clash resolution after a team change,
  free-for-all, the reveal at the briefing, and that raid rooms stay open.
- The visual harness veils the lobby the same way
  (`tests/visual/harness/rooms.ts`). The specs are `rooms`,
  `pvp-party-flow`, `portrait-frames`, `chat` and `fighter-prepaint`.
- `tests/visual/room-alignment.spec.ts` measures every PvP mode at
  1440×900, 1280×720, 844×390, 852×393 (Dynamic Island) and 568×320. It
  checks that the pick tiles form one column and the state tags share one
  width; that avatars and the pick/state block are centred on their row;
  that the heads and seats are flush left; that chat and ⋯ are level in the
  banner's corners; that the mode name is centred between them; and that no
  text wraps or is cut. Breaking the state width or moving the chat button
  3 px makes it fail.

## Seats and cards at a glance

- **Seat states:** Choosing (plain), **Locked** (solid gold, a padlock),
  **Ready** (solid green, a tick). The pick tile's edge follows the state.
- **The host** wears the Lobby's crown (♛) before their name. On phones,
  "(you)" is kept for screen readers only, because your seat's gold edge
  already marks you.
- **Ranged or close** is shown on every fighter card's top-right corner,
  where mastery used to be (owner, 18 Nov; mastery stays on the detail). It
  is drawn like the element badge: a solid glyph on a tinted disc, a sky-blue
  bullseye or an ember sword. The picker's foot shows it beside the name.

## Not built yet

- The avatar library: a seat, the player card and Friends will show the
  chosen avatar instead of the initial. See the design page for the
  picture spec.
- A team-only chat tab for 2v2 lobbies. Today the room channel reaches
  both teams.
- A VS screen that flips the cards. The existing briefing already shows
  every fighter.
