# PvP audit and plan (19 Nov 2026)

Element Arena is now PvP-first. The Farm and Bistro are being removed on
`claude/remove-farm`, so this audit ignores them. It is an audit and a
ranked plan, not a rewrite. Every claim cites code or a measurement made
for this audit; what could not be checked is listed in §6.

Production data (owner's read-only query, last 30 days): 163 matches, of
which 128 were against bots (78%) and 35 against people. 144 were duels,
19 free-for-all and **0** 2v2. **Only 4 accounts** played anyone real. About
8 accounts were active in the last 7 days and 11 in the last 30, out of 26
in total (12 of them guests).

## 1. Summary: the biggest problems

1. **There is no way to find a stranger to fight (liquidity).** Every PvP
   mode is a _private room_ reached by a six-character code or a friend's
   invite (`lobby-screen.ts:72-87`, hints "Private room · best of five";
   `server.ts:1879-1952` `create`/`join`). The server has no queue, no
   public room list and no bot backfill. The only stand-in bot is in raids,
   for a raider who dropped (`raid.ts:2097-2104`). A lone player who picks
   _1v1 Duel_ gets a room that says "Waiting for your opponent"
   (`screens/room-view.ts:266`) and waits **indefinitely**: nothing times
   out, offers a bot, or tells anyone else the room exists. With 4 people
   playing PvP in 30 days, the honest answer to "how long would a lone
   player wait?" is _forever, unless they bring a friend_. That is why 78% of
   play is against bots. The data fits liquidity as the main cause. It does
   not rule out combat feel (§6).
2. **The App Store wave arrives with nobody to call back.** Push
   notifications are Web Push for friend messages only (`push.ts:16,37`).
   The Capacitor app has no push plugin (`apps/client/package.json` lists
   app, core, haptics, ios and status-bar only), and
   `chat/push-setup.ts:42` returns `"unsupported"` in the native app. So
   an iPhone player can never be told "a friend or a rival is waiting".
   Presence is visible only for friends (`friends-view.ts:99-114`). Nobody
   can see that 3 strangers are online right now.
3. **Bot matches, where 78% of play happens, pay little and never change.**
   - A bot win pays **0 coins** and 25 XP, win or lose. A PvP match pays
     15/6 coins (10 a day) and 50 XP + 25 for a win
     (`supabase/migrations/025_mission_completion.sql:90-95,181-182`).
   - Bots never move rating: any player without an account aborts the Elo
     update (`006_ratings.sql:123`).
   - The difficulty never adapts. New players start on Easy
     (`lobby-screen.ts:140`), and after that the menu remembers their choice
     (default Normal, `main.ts:2306-2313`).
   - Bots are always clearly labelled ("Pip (Bot)", title
     "AI · Easy", `server.ts:2153-2163`). That is good, and the plan keeps it.
4. **2v2 and Free-for-all are dead modes.** They need 4 or 3–4 humans in
   one private room, with no bots allowed. 30 days gave 0 team matches and
   19 FFA. They take up two of the menu's nine entries and set up every new
   player to wait alone.
5. **We can't measure the PvP funnel from logs.**
   - `arena-perf` (`server.ts:3166-3200`) carries frame and network numbers
     plus mode, bots and champions, but **not** the winner, the match length
     or how long the player waited.
   - `arena_matches` rows exist only when every human's client submits the
     report (`match-summary.ts:35-56`), and match duration is never stored.
   - Win rates per champion with real players, queue waits and
     "did they play a second match" are not measurable today.
6. **The first match is short, but the guide points away from PvP.**
   - Measured at 956×440, dpr 3, touch (`tests/visual/pvp-first-match.spec.ts`):
     1. _Play as a guest_: 1 tap. It sits under a full email sign-up form.
     2. The age question: 2 answers + Continue.
     3. **PLAY: 1 tap**, which asks the server for an **Easy** bot (asserted).
     4. _I'm ready_ on the briefing.
   - That is **about 6 taps and no typing** to a live match. The coach then
     teaches stick, attack, skill and dash in touch words. Every touch button
     is 56–98 px (skills 64–68, Basic 98) and on screen.
   - The problem is what comes after: _Getting started_ lists five steps
     (bot match, Cragmuff, wear a reward, **visit the Farm, open the
     Bistro**, `docs/player-funnel.md`). Two of them point at features being
     deleted, and none points at a second PvP match or a real opponent.
7. **Combat feel looks well engineered, but nobody has measured it on a
   phone.** Netcode is 30 Hz ticks and 15 Hz snapshots (`packages/shared/src/index.ts:16-17`).
   - **Own movement and casts are predicted:** about 17–50 ms to the first
     visual. Casts use `cast-prediction.ts`, movement uses `predict-fighter.ts`.
   - **Hits confirm in ~100–180 ms** at 80 ms RTT. Opponents are drawn
     80–200 ms behind (`networking/interpolation.ts:26-45`).
   - **Corrections over 4 px** (`docs/network-performance.md` §11-§12):
     0% on good Wi-Fi, 6.8% on 4G, 17.7% on a congested link.
   - **None of this was checked on a real device.** Every perf spec runs at
     844×390 with SwiftShader at 3–5 fps
     (`network-performance.md:723-728`). The `arena-perf` lines from the
     owner's iPhone are the only phone data, and this audit could not read
     them (§6).
8. **Picks follow screen position more than balance.** The top five picks
   are four of the five champions within two taps of the default:
   - The default is Voltkit (`home-screen.ts:21`).
   - The Lobby's ‹ › arrows step through `CHARACTERS` and wrap
     (`main.ts:3157-3165`). From Voltkit, ‹ gives **Mossloth** and › gives
     Cindrake, then Tidefin.
   - The bot round robin (§4) puts all 18 champions at 45.8–55.0%. So under-picked champions are under-_seen_, not weak.
   - All 18 champions are free (`characterSchema` is a plain enum,
     `index.ts:2556-2592`).

## 2. Ranked plan

Effort: S ≈ 1–2 days, M ≈ 3–5 days, L ≈ 1–2 weeks, for one session plus review.

### 1. Quick Match with an honest bot fallback (M) — **build this first**

- **Problem.** The lone player has no PvP path at all (problem 1).
- **Change.** Add a _Quick Match_ (1v1):
  - The server keeps an in-memory queue. Two queued players are paired at
    once.
  - After **N seconds** (start at 20, set by an environment variable), the
    player is offered a bot instead. The bot is clearly labelled, and its
    level is chosen from the player's recent bot results.
  - While searching, the screen shows "N players online · searching 0:12".
  - Quick Match becomes PLAY's default once the first coached bot match is
    done.
  - Private rooms stay for friends.
- **Expected impact.**
  - Every PvP-curious player gets a match in ≤ 20 s.
  - Two strangers online at the same time finally meet. Today they can't,
    even when both are in the Lobby.
  - The owner's own sessions become discoverable to new players.
- **Risks.**
  - With ~8 weekly actives, most searches will still end on a bot. The
    copy must set that expectation ("No one free right now, here's a
    sparring bot"), never pretend a bot is a person.
  - Queue state is per server process. Render runs one instance today
    (`render.yaml`), so that is fine.
  - The two of you could leave the queue at the same moment. That is
    handled by removing on pair, cancel and disconnect.
- **Measure.**
  - A new `arena-queue` log line: wait time, outcome (`human` / `bot` /
    `cancel`), online count.
  - Success means the human-match share and the second-match rate both
    rise, and the cancel rate stays low.
  - Unit and integration tests are listed in §3.

### 2. Match outcome logging and a PvP funnel query (S) — ship with item 1

- **Problem.** We can't see winners, match length, queue wait or repeat
  play (problem 5).
- **Change.**
  - Log one `arena-match` line when a match finishes: mode, human/bot count,
    bot level, each side's champion, winner side, rounds, `playTime`,
    whether it came from Quick Match, and the queue wait. Use no names; the
    match tag is enough. Log it from the server, so it doesn't depend on
    client reports.
  - Add a "PvP funnel" query to `docs/player-funnel.md`: first match → second
    match → first human match → back the next day.
- **Impact.** It doesn't change fun itself, but it is the only way to know
  whether items 1, 3 and 4 worked. It also gives real-player win rates per
  champion.
- **Risk.** Log volume is negligible at this scale.
- **Measure.** A unit test that a finished bot match and a finished PvP
  match each print one well-formed line.

### 3. Native push for "someone is waiting" (M)

- **Problem.** The iPhone app can't be reached (problem 2).
- **Change.**
  - Add `@capacitor/push-notifications` and APNs sending in `push.ts`,
    beside Web Push.
  - Notify on room invites and party invites, which have no push at all
    today.
  - Offer an opt-in "Tell me when someone queues for Quick Match" alert,
    rate-limited (for example at most 1 an hour, never at night in the
    player's time zone).
- **Impact.** This is the main lever for liquidity at low player counts: it
  turns 8 weekly actives into people who can show up at the same moment.
- **Risks.**
  - It needs Apple Developer setup: an APNs key, entitlements, and an App
    Store review note.
  - Spammy alerts get the app muted, so use strict caps.
  - Keys must go in Render secrets, not the repo.
- **Measure.**
  - Push sent / opened / led to a match within 5 minutes (log it).
  - An integration test with a fake APNs sender, like the existing
    `webPushSender` injection.

### 4. Make bot play a ladder that rewards and adapts (S–M)

- **Problem.** 78% of play sits in bot matches that pay 0 coins and stay
  at one fixed level (problem 3).
- **Change.**
  - **Adaptive level.** After two wins in a row, offer one level up; after
    two losses, one down. Add a "Hard+" step later; Hard's profile is not
    the bots' ceiling (`bot.ts:167-180`).
  - **Small capped coins for Quick Match fallback bot wins only.** For
    example, 5 coins for a win, sharing the existing 10-a-day PvP cap. This
    pays the player who _tried_ to find a person without making bot farming
    better than PvP. It needs a **new** migration: never edit 025, and
    follow CLAUDE.md's migration rules.
  - Keep bot matches out of rating.
- **Impact.** It gives the sessions we actually have a sense of
  progression, and it pushes players toward Quick Match rather than the
  bot menu.
- **Risks.**
  - Economy inflation: keep the cap shared.
  - Docs conflict: `docs/raid-roster-design.md` §10 says bots pay only
    through missions. Changing that is a design decision for the owner.
- **Measure.**
  - The bot level each player reaches over time.
  - The share of bot matches that are Easy after a player's 5th match. It
    should fall.
  - `fast-bot-missions.test.ts` covers missions; add a migration test that
    fallback coins respect the cap.

### 5. Retire or bot-fill the empty modes (S)

- **Problem.** 2v2 had 0 matches and FFA 19. The modes invite players to
  wait alone (problem 4).
- **Change.**
  - Show _2v2 Teams_ and _Free-for-all_ in the mode menu only to a party big
    enough to fill them (`partyLobbyMode` already knows party size).
  - Later, let a host fill empty seats with bots: the balance tools already
    run 2v2 and FFA bot line-ups (`scripts/balance/teams-worker.ts`,
    `ffa-worker.ts`).
- **Impact.** A simpler first menu: Quick Match, Vs AI, Private room.
- **Risk.** Losing modes the owner cares about. Hiding is reversible;
  deleting isn't.
- **Measure.** Mode-menu taps (log them) and mode counts in `arena-match`.

### 6. A PvP-first Getting started and a first-session arc (S)

- **Problem.** The guide sends new players to the Farm and Bistro, which
  are being removed, and never to a real opponent (problem 6).
- **Change.** Five steps, all PvP:
  1. Beat the coached Easy bot.
  2. Try a second champion.
  3. Win a Quick Match. A fallback bot counts.
  4. Add a friend or invite one.
  5. Reach your first rank.

  Also make guest play the primary button on the 956×440 sign-in screen;
  the email form can be one tap away.

- **Impact.** It raises the second-match rate. The 16 Nov funnel shows
  guests are where players drop: 9 of 11 never finished a match, and none
  came back.
- **Risk.** It overlaps with the farm-removal branch. Do it after that
  branch merges, to avoid conflicts in `getting-started.ts`.
- **Measure.** Steps completed per new account, via the funnel query
  (item 2). Update `tests/visual/getting-started.spec.ts`.

### 7. Show the whole roster, not the two neighbours of Voltkit (S)

- **Problem.** Picks track list position (problem 8).
- **Change.** Pick a random or rotating "Featured today" champion for new
  players' default, so it is not always Voltkit. Order the ‹ › arrows by a
  shuffled-per-account list, and show the bot's champion on the result
  screen with "Try <champion>".
- **Impact.** Better use of 18 kits and more novelty per session.
- **Risk.** Low.
- **Measure.** Pick entropy across `arena-match` lines (item 2).

### 8. Phone-truth for combat feel (S, then ongoing)

- **Problem.** No real-device numbers, and no PvP layout spec at the
  owner's 956×440 (problem 7).
- **Change.**
  - Read a week of `arena-perf` lines from production (fps, frameP95,
    `confirmP50`, corrections by cause, graphics level) and write a short
    summary table into `docs/network-performance.md`.
  - Add 956×440 to `tests/visual/mobile-combat-layout.spec.ts`. The new
    `pvp-first-match.spec.ts` already checks button sizes there.
  - Do one physical iPhone-to-iPhone Quick Match playtest, which
    `docs/pvp-party-flow.md` says has never been done.
- **Impact.** It confirms or rules out combat feel as a second cause of low
  PvP.
- **Risk.** None.
- **Measure.** The numbers themselves. Act if fps p50 < 55 or
  corrections > 10% on Wi-Fi.

**Not ranked:** ranked seasons. Ratings already exist (Elo, monthly 25%
decay toward 1000, 10 ranks, top-20 leaderboard; `006_ratings.sql`,
`packages/shared/src/accounts.ts:518-530`). With 4 PvP accounts, a season
ladder would be empty. Revisit when Quick Match shows daily human matches.

## 3. First item to build: Quick Match with bot fallback

### Server

**`apps/server/src/matchmaking.ts`** (new). This is a pure class with an
injected clock, so it can be unit-tested without sockets.

```ts
class QuickQueue {
  join(entry: { socketId; accountId; name; character; rating; since });
  leave(socketId): boolean;
  /** Pairs to start and entries whose wait passed fallbackMs. */
  poll(now): { pairs: [Entry, Entry][]; fallback: Entry[] };
}
```

- Pair FIFO. With 3 or more waiting, prefer the closest rating.
- Never pair one account with itself, or two accounts where either has
  blocked the other (`chat.blocks`).
- Parties are excluded: they keep private rooms.

**`apps/server/src/server.ts`**

- Add socket `queue-join {name, character}`:
  - Use the same guards as `bot-match`: `requirePlayer`, `allowed(15)`, no
    current session, no other room for this account.
  - Reply `{ ok, waitMs: fallbackMs, online }`.
- Add `queue-leave`.
- Remove the player from the queue on `disconnect`.
- Call `poll` from the existing tick loop, or a 1 s interval.
- For a pair, create `new Arena(code, "duel")` with `rotateArenas = true`,
  attach both players, and emit `queue-found` to each. Picks stay hidden
  as in any PvP lobby (`picksHidden`). Then the normal ready flow runs.
- For a fallback, emit `queue-fallback`. The client shows "No one free
  right now — fight a sparring bot?" with a 5 s auto-accept. On accept,
  call the same code as `bot-match`.
  - First extract it into `startBotMatch(socket, {name, character,
difficulty})` so both paths share it.
  - Tag the arena `fromQueue = true` for logging and item 4.
- Read `QUICK_MATCH_FALLBACK_MS` from the environment (default 20000).
  Record it in `render.yaml` with no secret.
- Log `arena-queue` (`{ waitMs, outcome, online, rating }`) and, per item 2,
  `arena-match` at the end of each match.

**`packages/shared/src/index.ts`:** add `queueJoinSchema` (reuse
`identitySchema.extend({ character: characterSchema })`) and the reply
types.

### Client

**`apps/client/src/lobby-screen.ts`**

- Add `{ id: "quick", label: "Quick Match", hint: "A real player if one is free · else a bot", icon: "battle" }`
  at the top of `LOBBY_MODES`.
- `savedLobbyMode()`: return `"bot-easy"` while Getting started's bot step
  is open, and `"quick"` after it.
- `partyLobbyMode`: a party never gets `quick`.

**`apps/client/src/main.ts` `lobbyPlay`:** for the `quick` branch, emit
`queue-join` and show a searching sheet.

**New searching sheet** (with its CSS):

- Big timer, "N players online", Cancel, then the fallback offer.
- Mobile landscape first: fit 844×390 and 956×440 inside safe areas. Reuse
  the dialog primitives (`dialog.ts`).
- No per-frame layout reads (CLAUDE.md, battle UI rule). The timer updates
  `textContent` once a second.

### Tests

- **`tests/unit/matchmaking.test.ts`:** pairs two; three waiting pairs the
  closest rating; fallback after `fallbackMs` exactly; leave and disconnect
  remove; blocked and same-account never pair.
- **`tests/integration/quick-match.test.ts`.** Follow the pattern in
  `tests/integration/accounts.test.ts`:
  `createArenaServer({ accounts: fakeAccounts().provider, autoTick: false })`
  with socket.io clients.
  - Two clients `queue-join` → both get `queue-found` with the same room
    code.
  - One client → `queue-fallback` after the clock advances, accepts → the
    room has one bot labelled "(Bot)".
  - Cancel → no room.
  - A client already in a room is refused.
- **`tests/visual/quick-match.spec.ts`:** at 844×390 and 956×440 (dpr 3,
  touch), the searching sheet fits, Cancel works, and the fallback offer
  starts a bot match. Add the fake-server replies to
  `tests/visual/harness/rooms.ts`, then stop the harness Vite server after
  changing the fakes, as CLAUDE.md says.
- **Re-run:** `getting-started.spec.ts`, `lobby.spec.ts`, `rooms.spec.ts`
  and `pvp-first-match.spec.ts`, plus `panel-scroll` in the background,
  because a new sheet can affect panel scrolling.

### Done when

- A lone player is in a bot match within fallback + 5 s.
- Two browsers queued together land in one room.
- `arena-queue` and `arena-match` lines appear in the logs.

## 4. Evidence gathered for this audit

### Champion win rates (bot round robin)

Run on `main` (`npx tsx scripts/balance/tune.ts 1 40`: 40 games per pairing,
Hard and Normal bots, factors left alone):

| Champion  | Average |  Hard | Normal | Picks (30 days) |
| --------- | ------: | ----: | -----: | --------------: |
| Cindrake  |   55.0% | 57.5% |  52.6% |              17 |
| Pangrove  |   53.5% | 55.9% |  51.2% |              ≈3 |
| Astrabun  |   53.3% | 53.4% |  53.1% |              ≈3 |
| Tidefin   |   52.2% | 52.9% |  51.5% |              24 |
| Auralynx  |   51.0% | 51.6% |  50.3% |              ≈3 |
| Mossloth  |   50.8% | 51.0% |  50.6% |              30 |
| Terradon  |   50.3% | 50.6% |  50.0% |              ≈3 |
| Sunbara   |   50.0% | 48.1% |  51.8% |              ≈3 |
| Glacelle  |   49.8% | 51.3% |  48.4% |              ≈3 |
| Shadopus  |   49.8% | 50.7% |  48.8% |              ≈3 |
| Mystowl   |   49.6% | 47.9% |  51.3% |              13 |
| Halcyra   |   49.2% | 47.5% |  50.9% |              ≈3 |
| Duskveil  |   49.1% | 47.8% |  50.4% |              ≈3 |
| Lumoth    |   48.5% | 47.1% |  50.0% |              ≈3 |
| Coilemur  |   47.6% | 45.1% |  50.1% |              ≈3 |
| Wombolder |   47.6% | 47.4% |  47.8% |              ≈3 |
| Pyranda   |   46.9% | 47.5% |  46.3% |              23 |
| Voltkit   |   45.8% | 46.6% |  44.9% |              18 |

The spread is 45.8–55.0% (12,240 matches; `docs/balance-overhaul.md`
puts seed noise near ±2.5 points). Picks don't track bot strength: the most
winning kit in bot hands (Cindrake) is picked less than Mossloth and
Tidefin, and the two weakest (Pyranda, Voltkit) are the third and fourth
most picked. The ≈3 means the twelve less-picked champions share about 38
picks; the per-champion split wasn't in the data. Voltkit, everyone's
default fighter, is the weakest in bot hands, which is worth a look once
real-player win rates exist (item 2): a new player starts on the kit least
likely to win, and is coached against a random bot champion.

These numbers measure how well the **bot** plays each kit, not how strong
the kit is for a person. `docs/balance-overhaul.md:91-94` lists what bots
don't do: they never wait out Facet Guard, don't read stealth, and always
face their target. Real-player win rates need item 2.

### Pick distribution versus balance

- In production, mossloth 30, tidefin 24, pyranda 23, voltkit 18,
  cindrake 17 and mystowl 13 add up to 125 picks. The other 12 champions
  share the rest, about 3 each if each match counts one human pick.
- Since the bots rate every champion within a few points of 50%, weakness
  doesn't explain the gap. Three things fit:
  - **Position bias.** 4 of the top 5 are within two taps of the default
    Voltkit.
  - **Very few players.** About 11 accounts in 30 days, so one player's
    main can be 20 picks.
  - **Novelty, possibly.** Not verified; see §6.

### First match (956×440, dpr 3, touch)

`tests/visual/pvp-first-match.spec.ts`, added on this branch, passes. It
logs:

- The sign-in screen's controls: an email form, then guest.
- The age question: 2 fields.
- The Lobby: "VS AI · EASY, Learning · best of five" and "Getting started ·
  0 of 5: Play your first match".
- PLAY sends `bot-match {difficulty: "easy"}`.
- The coach's first line: "STICK: Drag the left side of the screen to
  move".
- Touch buttons (px): Dash 56, Jump 56, skills 64/64/64/68, Basic 98,
  target 49. All are inside 956×440.

### Netcode, from the code

- Inputs are sent at 30 Hz (`main.ts:6468-6561`).
- The server queues at most 2 inputs (67 ms).
- A skill cast is broadcast at once rather than waiting for the next
  15 Hz snapshot (`server.ts:3278-3304`).
- Shots and wind-ups are drawn on the player's own timeline
  (`networking/timeline-lead.ts`, capped at 0.3 s).

## 5. Social today

- **Invites.** Friends can be invited to a party (Lobby) or a room. Invites
  expire after 90 s, and the party keeps an away member's seat for 60 s
  (`docs/pvp-party-flow.md`). Both need the friend to be online right now:
  "Your friend is offline." (`server.ts:1614`, `1688`).
- **Spectating** works by room code, up to 6 watchers, and never for bot
  rooms (`server.ts:1542-1567`).
- **In-battle chat** is quick chat and emotes only. Rivals see emotes and
  can mute them (`chat/battle-chat.ts`).
- **The Plaza** is the only place to meet strangers. You can tap a player to
  add them or invite them (`plaza/plaza-screen.ts:38`), but nothing there
  says "this player wants a fight".
- So the social pieces are solid for **existing friends** and missing for
  **strangers**. Items 1 and 3 fill that gap.

## 6. What this audit could not verify

- **Real phone performance.** I had no access to production `arena-perf`
  logs, and the harness renders on the CPU (3–5 fps), so its frame times say
  nothing about an iPhone. Input-to-visual delays above are estimated from
  the code, not measured.
- **Safe areas and the Dynamic Island** at 956×440. The harness has no
  notch insets.
- **The steps between install and the Lobby on iOS.** That covers
  `rotate-gate`, fullscreen help and a real guest sign-in, which the
  harness fakes. The tap count also assumes the age question takes 3 taps.
- **How long real players wait** in a private room before leaving. No log
  records room creation or abandonment.
- **Whether combat feel contributes to low PvP.** No survey and no
  per-match quit data.
- **When each champion shipped.** The clone is shallow, so a novelty effect
  on Mossloth's and Pyranda's picks can't be dated.
- **Whether the pick counts are per human or per fighter.** The 163-match
  totals don't say.
