# Coordinator handoff (28 Nov 2026)

The owner is moving the project to another Claude account, because this
one's weekly usage is nearly spent. This page is what a new coordinator
session needs to pick the work up. CLAUDE.md stays the rulebook. This page
records the state on 28 Nov and the calls already made for the owner.

## What does not carry over to a new account

- **Sessions.** A new account cannot message this account's sessions. Each
  open item below says its PR and branch, so a new session can continue it
  from the repository alone.
- **Scheduled tasks.** Recreate these on the new account if they are still
  wanted:
  - the coordinator's check-in, twice a day at 3:23 AM and 3:23 PM PT: main
    red, deploys, backend logs, sessions;
  - a reminder on Thu 3 Dec 8:31 PM PT to resume the paused test-migration
    work;
  - **Instagram posting ("Element Arena Instagram")**, which uses the Meta
    token stored in this account's environment. The launch posts are due
    **Mon 30 Nov 5:40 PM PT**. See `docs/instagram-handoff.md` (PR #716) for
    the token and the task.
- **Environment secrets** (the Meta token, any API keys). Only the owner
  can add these on the new account.

## Decisions made on the owner's behalf (27–28 Nov)

The owner asked the coordinator to approve UI choices while they slept.
These are settled; don't reopen them without the owner.

- **Look:** improved G, with fighter fields softened 20% toward cream (#673).
- **Colour standard:**
  - colour only for element, rarity, severity and state;
  - body text in ink or cream;
  - red = danger/leave;
  - gold = press and coins;
  - progress on cream is ink;
  - violet = "new";
  - the loading bar is the one cream-fill exception (#700).

  Slices A–D are merged (#689, #680, #694, #698), plus indicators (#683).
  Mode colours were skipped. Left for later: low HP in battle, the Plaza
  fish rarity palette, and result reward tiles.
- **Button rule** (now in CLAUDE.md, #686): a button fits its words, and
  buttons side by side or in one panel share one size and one edge.
- **Lobby rail** keeps G's ink slab and the gold block on the open screen.
  Bare icons are used in the world and on the top bar (#710).
- **Spire card:** combined treatment; news means a new zone only (#711).
- **Rank tiers** are coloured like rarity: diamond and block in the tier
  colour, words in cream (#685).
- **Plaza:** Dash and Jump stay round.
- **Shop stage on phones:** wider stage, controls on a rail, and on short
  phones the portraits and filters scroll with the cards (#697, #704).
- **Shadows and auras** (owner's own answer, 28 Nov): every view uses the
  battle's ground ellipse, set from one shared constant (#696, in
  progress).
- **Champion move rules** (owner):
  - no part leaves the body;
  - head stays on the neck;
  - props never pierce the body;
  - no spinning or turning;
  - no face flattening;
  - legs move.

  All 18 champions are done (#652, #669, #676, #692).

## Open at handoff

- **#715 Main is red:** a test measured a Settings tab during the dialog's
  0.97 scale-in. The fix is #717 (test only). Close #715 by hand after a
  green full run. A follow-up is planned: one shared "dialog settled"
  helper, used by every spec that measures a just-opened dialog.
- **#696 shadows/auras:** being reworked to the battle ellipse everywhere.
  Merge once it's green and main is green.
- **#713 Chat in Poster:** merge once main is green.
- **#714 Website:** the 92 skin clips re-recorded with the new moves, plus
  a Plaza and fishing section. Merge once main is green.
- **#716 Instagram:** retakes of posts 10, 12 and 13. Must be in before
  Thu 3 Dec 5:40 PM PT.
- **Poster audit:** inventory at
  https://claude.ai/artifact/7sNzGKizkFH8Rw2PmmTf7X. Remaining:
  - the Plaza player card and lists;
  - admin;
  - How to play pictures;
  - match leftovers;
  - the battle HUD's navy token `--aero-tint-solid` (FULL lane).

  The phone session also listed W05, I06, F04, C05, C03 and the Controls
  dialog.
- **iOS touch latency:** #702 fixed the metric (WebKit stamps touches with
  any finger's time). After a day of new `arena-perf` lines, check
  `eventToHandlerP95` and `pressStale` on iOS. If it is still high, the
  latency is real.
- **Before App Store submission:** remove or reword the Support "Open beta"
  section (`docs/open-beta.md`).

## Lessons from 28 Nov

- A PR that fixes a "Main is red" issue must not say "close", "fix" or
  "resolve #N" anywhere in its body. #684's body said "close #678 when that
  is green", and GitHub closed the issue at merge.
- Before every merge, check how the red issue was closed (by a green full
  run or not), not just that it is closed.
- A session that runs without ending its turn doesn't read queued
  messages. Use `send_message` with priority "now" for anything urgent.
- Three red mains came from tests racing CI's slow renderer: a toast's
  timer, then a dialog's scale-in, twice. Prefer `Animation.finish()` or
  waiting for animations to finish over fixed sleeps.
