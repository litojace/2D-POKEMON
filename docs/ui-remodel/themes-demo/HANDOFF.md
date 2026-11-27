# Handoff: the game's new look (Poster), 26 Nov 2026, 23:20 PT

Written by the coordinator session (session_01DkYiJpRvFQVoVBY92SXMsy) because
the owner is moving the work to another Claude account. A session on another
account cannot open these conversations or the two screenshot artifacts
(private to the owner's account), only GitHub. Everything below that I did
not check myself is marked "reported".

## What the owner decided, in order (their words, times in PT)

| When (26 Nov) | Where                                 | Decision                                                                                                                            |
| ------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| about 07:10   | coordinator session                   | Build both looks, Poster and Showcase; a dialog after sign-up lets the player choose; two sessions that talk to each other.         |
| 18:40         | coordinator and Poster sessions       | "Bật đi": turn it on.                                                                                                               |
| 19:02         | Showcase session                      | Dropped the turning light rays for the Lobby ("Thôi bỏ").                                                                           |
| 19:03         | Showcase session                      | "Thôi bỏ showcase đi, đổi vĩnh viễn qua poster luôn. Giờ chỉ cần cải thiện poster cho nó được đẹp và tiện lợi cho người chơi thôi." |
| 23:13         | Poster session                        | "quyết định cuối cùng của t là xóa showcase ra khỏi code, chỉ giữ lại poster".                                                      |
| 23:15         | session "PR #553 performance testing" | The work goes to another Claude account; every session summarises.                                                                  |

So: **Poster is the game's look for every player. No picker, no second look.
Showcase is deleted from the code. The work left is making Poster
better-looking and more convenient.**

Never answered by the owner, so the defaults stand: the Plaza's own round
touch controls stay round; whether today's look is deleted for good (see
"Order of what is left", step 5: ask first).

## Sessions

| Session                                             | Id                               | Branch                           | Owns                                                                                         |
| --------------------------------------------------- | -------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| Coordinator (this one)                              | session_01DkYiJpRvFQVoVBY92SXMsy | `claude/ecstatic-shannon-3ieyzd` | The mock-ups, this reference folder, the plan. No code in `apps/`.                           |
| Poster: the game's look                             | session_01DkYiJqSgRDJEqiP7SsgtiT | `claude/ui-look-poster`          | The foundation (`ui-theme.ts`), Poster's design, PR #553, moving the visual suite to Poster. |
| Poster: remaining screens and phones (was Showcase) | session_01DkYiJsJsB2NWhhjs7eS4p6 | `claude/ui-look-showcase`        | PR #555, removing Showcase, Poster on screens outside the first 34, phone convenience.       |
| PR #553 performance testing                         | session_01DkYiJqMdKASW4oeUxU2tL9 | (not mine; ask it)               | Started by the owner, not by me.                                                             |

## On main (checked with git at 8d07e12)

- #546 the foundation: `apps/client/src/ui-theme.ts` (registry, `ready` flags,
  `?ui=poster`, `?ui=classic`, `?ui-preview=1`, stored as `ea-ui`), a folder
  per look in `apps/client/src/themes/`, the `--el` and `--ui-coin` tokens,
  the picker and Settings' Look row (both dark), `docs/ui-themes.md`.
- #548, #549 Poster: fonts (Anton, Archivo, with Vietnamese), tokens, kit,
  Lobby, every hub screen, battle HUD, sheets, `tests/visual/poster.spec.ts`;
  and a fix to today's look: the Profile card no longer clips Vietnamese
  marks off capitals.
- #547 Showcase (to be removed), #552 and #554 the picker's preview pictures.
- **Both looks are still `ready: false`: players see today's look.**

## Open

- **#553** (Poster session): Poster for every player, Showcase off, no picker.
  FULL lane. **Held on purpose** until the whole visual suite has run once on
  Poster (`VITE_VISUAL_LOOK=poster`, local, 192 files in 4 shards) and its
  failures are sorted into (a) real Poster bugs, fixed or named before the
  switch, and (b) specs tied to today's layout, which become the migration
  plan. Reported at 23:14 PT: shard 1 of 4 done, 288 pass, 33 fail.
  Real and open from it: tab rows run under Close on phones; a tap on a
  friend's name doesn't open its options; Shop tiles of two sizes in Skins
  and Mythic. The session was stopped for over three hours by the account's
  usage limit (weekly limit in warning).
- **#555** (other session): Poster's defeat sheets (title, score and primary
  button were ink on ink: launch-blocking), the reward Reveal, rite cards,
  Spire briefings.

## Order of what is left

1. #555: the defeat-sheet fix.
2. Finish the full-suite run on Poster, fix list (a), then merge #553 on a
   green full run with main not red. Watch main and the deploy. The revert is
   one line (the default look back to none).
3. Remove Showcase in its own PR: `themes/showcase/`, its spec and registry
   entry, the Lobby's Raid card, the picker, Settings' Look row, the "asked"
   flags, the daily gift's wait for the picker. Delete only art nothing else
   imports: the raid-splash paintings predate Showcase and the Raid hall
   uses them.
4. Move the visual suite to Poster in slices, the new player's path first
   (welcome, first match, result sheet, Lobby, Shop). Until then CI guards a
   look no player sees; Poster has only its own sweep and the two battle
   budgets. A CI input for the look is a `.github` change (FULL).
5. Only then fold Poster into the base and delete today's CSS (it would
   about halve the CSS in the page during battle). **Ask the owner first.**
6. Improve Poster, alongside 3 to 5:
   - Screens outside the first 34: signed-out welcome, sign-up, log-in, age
     gate, guest warning, tour, daily gift, feature unlocks, chat, the Plaza's
     chrome, Spire, admin panel. Nothing may fall back to glass.
   - Phones: tab rows cut by Close with no hint they scroll (Shop, Profile,
     boss pages); the toast that covers the chat button and the Lobby/Plaza
     switch; cut labels ("Storm Re…", a long name in the header chip); Quick
     Match's subtitle wrapping at 667 px; targets of at least 44 px; the
     island's safe areas.
   - Looks: a whole screen in the fighter's colour is loud for long sessions;
     check the brightest fighters for glare and contrast.
   - Offline: Poster's fonts are not cached by the service worker (system
     fonts show instead); cache them on first use.
   - Vietnamese names: battles and raid rooms in the harness name players
     "tester", so marks on capitals were only checked on the header, Profile
     and Lobby.

## Where things are

- This folder, on `claude/ecstatic-shannon-3ieyzd` only (never merged; 10 MB
  of screenshots): `README.md` (the original two-look brief and contract,
  now out of date on "two looks"), `shots/poster/` (the 34 mock-up screens
  the owner approved), `dirs/` (the mock-up CSS and the screenshot tools).
- Real-build screenshots: two artifacts private to the owner's account
  (Poster, Showcase). Re-shoot from the build with `?ui=poster` instead.
- Rules: `CLAUDE.md` (lanes, merging, battle performance, looking at every UI
  change), `docs/ui-themes.md` (how a look is built and tested).

## Not done, not checked

- I did not measure Poster's performance myself; both budgets passing is
  reported by the two sessions.
- I looked at 5 of the 136 real-build Poster screenshots, not all.
- No session has tried Poster on a real phone.
