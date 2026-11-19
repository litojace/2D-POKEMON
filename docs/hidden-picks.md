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
  (`identityPortrait`: their avatar in their frame)
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

## Team chat

A 2v2 room has a **Team** chat channel (`team` in
`packages/shared/src/chat.ts`). It reaches your own side only, opens first,
and holds the plans the other team can't read. Room still reaches both
teams. The server routes `team` lines by `arena.teamOf` (`chatRoute` in
`server.ts`). When teams change (a switch or a shuffle), both sides' team
chats are cleared, so nobody can switch over and read the other side's
plans. In a battle it works like Room: quick chat, with calls allowed. The
tests are in `tests/integration/hidden-picks.test.ts`.

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

## Avatars

A player is shown by their **avatar** in their frame wherever they are:
the account header, the player card and its share picture, Friends, and
PvP seats. It is never the fighter they play. Their fighter shows in
battle, on the briefing, in the picker and on the Lobby's party stage
(owner, 18 Nov: the stage shows off skins).

- **The library** (`packages/shared/src/avatars.ts`): 77 avatars, the 18
  champions and the 8 raid bosses in two styles, Soft 3D and Anime 2D,
  and a third, **Expressions** (19 Nov: the owner's 25 of the second
  batch, `ea-avatar-053` to `077`, new angles and faces, the Storm Twins
  together; `docs/avatar-prompts.md`, imported with
  `scripts/import-avatars.py`; migration 20261119160000 lets the database
  take them).
  They were made for the game (Nov 2026) as 256 px WebP files in
  `apps/client/public/assets/avatars/`, about 12 KB each. All are free.
  A new player has `ea-avatar-001` until they choose.
- **Choosing:** the player card's **Avatar** tab shows one style at a
  time; a tap wears an avatar and it is saved at once (`/api/account/avatar`).
- **Storage:** `arena_profiles.avatar`, from migration
  `20261119100000_player_avatars`. Friends get it from `arena_friends`;
  a seat gets it from the fighter's appearance, which the server reads
  with `arena_my_avatar`.
- **Your own picture** (migration `20261119110000_avatar_photos`):
  - A photo of up to 10 MB is cut to its middle square on the device and
    sent as a 256 px WebP, or a JPEG on Safari, of 64 KB at most
    (`apps/client/src/avatar-photo.ts`). The 10 MB photo itself never
    leaves the device.
  - The game server checks the file's type, size and first bytes, puts
    it in the private Supabase Storage bucket `avatar-photos`
    (`photos/<id>.webp|jpg`, migration `20261119120000_avatar_photo_storage`,
    docs/avatar-photo-storage.md), and the database keeps one picture per
    player (who, where, hidden). Each upload gets a new id; the old file
    is deleted.
  - The avatar becomes `photo:<id>`, served by the game server at
    `/api/avatar-photo/<id>` for 10 minutes of caching. A hidden or removed
    picture serves the default avatar instead.
  - **Who may use one:** players with an account (owner, 18 Nov). The
    server refuses guests. The client also hides the button on a device
    whose age check said under 13, although such a player can't make an
    account anyway.
  - **Everyone sees it** (owner, 18 Nov), so players can report it:
    - Tap the picture on a room seat, or use **Report picture** in a
      friend's options. Each player's report counts once.
    - Every report reaches the admins (Admin, Reports).
    - At three reporters the picture is **hidden** until an admin looks.
    - The admin sees the picture and chooses **Keep picture** (shown
      again, its reports cleared) or **Remove picture** (gone, its file
      deleted, and the player can't add another for 7 days).
  - Tests: `tests/integration/avatar-photos.test.ts` (SQL),
    `avatar-photo-store.test.ts` (Storage), `avatar-photo-routes.test.ts`
    (HTTP) and
    `tests/visual/avatars.spec.ts`.

## Everywhere else (Nov 2026)

- **Ranks:** each row shows the player's avatar in a ring of their rank's
  colour. Migration `20261119140000_avatars_everywhere` adds `id` and
  `avatar` to `arena_leaderboard`'s rows. The Friends board and Recent
  players carry it too. A tap on another player's own picture reports it.
- **Plaza:** the player card shows the avatar, which the server reads in
  `PlazaAppearance`. A player with their own picture also gets **Report
  picture**. Players walking in the Plaza are still their fighters.
- **Party:** the Lobby's party bar shows each member's avatar, with the
  leader ringed in gold; the server reads it in `loadPartyAppearance`.
  The stage still shows fighters, to show off skins (owner, 18 Nov).
- **The Reveal:** a PvP match's briefing (bots included) is a whole-screen
  loading screen, "The Reveal" (owner, 18 Nov). Its kicker names the mode
  and the arena (1v1 Duel, 1v1 vs Bot, 2v2 Teams, Free-for-all · N
  players). Each player has a card: the fighter, its name, its element and
  role (two lines kept on every card, so the rows sit level), and the
  player's name only (no avatar or frame here: the owner's choice). Yours
  is ringed in gold with a "You" tag. 1v1 and 2v2 face off across a VS,
  your side on the left over blue, theirs on the right over red; a
  free-for-all is one row over violet. Each card starts face down (a "?"
  and the player's name), waits while the arena loads, then turns over,
  yours first (`vsReveal` in `main.ts`, `.vs-flip` in `style.css`). Below:
  the goal, the arena's tip if it has something to dodge, and the keys on a
  computer; at the foot, how far the arena has loaded (`arenaProgress`:
  the engine, then each fighter) and "I'm ready". Sizes follow the screen
  (`.match-reveal`, a size container), so a phone held sideways (667×375
  and up) shows every card and "I'm ready" without scrolling
  (`tests/visual/reveal.spec.ts`, every mode at four sizes). With reduced
  motion the fighters show at once.
  No chat button on the Reveal, neither the room's nor quick chat: it is a
  few seconds' loading screen (owner, 18 Nov; `syncChat` in `main.ts`).
