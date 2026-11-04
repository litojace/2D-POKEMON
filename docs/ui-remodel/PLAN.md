# UI remodel: every screen outside matches

Phase 0 of the request on 3 Nov 2026: remodel every screen reached from the
Lobby (`apps/client/src/lobby-screen.ts`, `LobbyAction`) so the game reads as
one product, in line with the hub redesign proposal. **No game code has
changed yet.** This file is the plan to approve; building starts on the
owner's go.

- Current screens, all four sizes: [`images/before/`](images/before/)
  (1440×900, 1280×720, 844×390, and 852×393 with a simulated Dynamic Island
  and home indicator).
- Mockups: [`images/mockups/`](images/mockups/), and side by side with today
  in [`images/compare/`](images/compare/).
- The mockup page itself: [`mockup/`](mockup/). It imports the real client
  modules, so every fighter, skin, price, boss and rule in it is the game's
  own; only the player's state (coins, owned items, progress, friends) is
  sample data. Run it from the repo root:

  ```bash
  npx vite --config docs/ui-remodel/mockup/vite.config.ts
  ```

  then open `http://localhost:4180/?s=shop` (screens: `shop`, `confirm`,
  `wardrobe`, `roster`, `fighter`, `missions`, `journey`, `raids`, `boss`,
  `ranks`, `friends`, `profile`; add `&island` for the phone insets).

- The scripts behind the screenshots and measurements are in
  [`tools/`](tools/) (`capture.cjs`, `audit.cjs`, `mockshot.cjs`,
  `mockcheck.cjs`); each says how to run it. Set `PW_CHROMIUM` to the
  Chromium binary.

## Facts found while mapping (3 Nov 2026)

- **The creature remodel is on `main`** ([litojace/2d-pokemon#13](https://github.com/litojace/2d-pokemon/pull/13), merge `6116a87`). The roster
  and mockups show those skills (Crest Flare, Magma Bomb, Heat Cracks,
  Sunfire Pillar, Cinder Snap for Cindrake, and so on).
- **Every fighter is free.** There is no fighter ownership in the game, so
  the roster has no "locked fighter" state. Cards show what does exist:
  element, range, role, mastery tier and how many looks you own. Adding
  fighter unlocks would be an economy change, so it is out of scope.
- **Raids have one difficulty** (always Peril 3, `apps/server/src/raid.ts`).
  A boss's "difficulty" is its 1–3 stars. Six bosses open after the first
  Grumblecrag clear (`raidUnlocked`), so the Raid Hall does have a locked
  state for new players.
- **Today's timers use the device clock.** `picksCountdown()` (Shop, Lobby,
  Missions) counts down to Pacific midnight from `Date.now()`, and
  `/api/economy` sends no server time. The farm already does it right: its
  responses carry `now` and the client keeps an offset (`farm-scene.ts`).
  The remodel makes every hub timer use the server's clock the same way
  (step 1 below). This is a server change, not an economy change.
- **Buying is two taps on the same button.** The first tap changes the label
  to "Buy for 1,200?" for 4 s; the second buys (`accounts.ts`, `[data-shop-buy]`).
  There is no summary of what you have before and after.
- **There is no "recent players" list.** `arena_records()` returns
  head-to-head records for opponents you name, and `arena_match_players`
  holds who played whom, but no endpoint lists recent opponents. A
  read-only endpoint would be needed (open question 4).
- **CSS today:** `style.css` is 25,072 lines with 238 `@media` blocks and 55
  `!important`. By selector, about 1,900 lines style the Shop, 1,670 the raid
  room/briefing/results, 1,360 the roster, 920 Journey, 680 Missions, 600
  the Raid Hub, plus whole files: `champion-selection.css` (1,331),
  `wardrobe.css` (836), `friends.css` (745), `mobile-store.css` (687),
  `mobile-panels.css` (180). The Shop card alone is restyled by 107 separate
  rule blocks, the Shop preview by 86, missions by 62.

## How the problems were found

A script opened every screen in the visual-test harness (the real client
with a fake API, plus sample friends, leaderboard rows, six missions and
raid progress) at all four sizes, took the screenshots in `images/before/`
and measured each screen: controls covered by another element, touch targets
under 40 px on phones, cut-off text, controls inside the safe-area insets,
distinct button styles, where Close sits, heading and coin-pill sizes. Every
problem below was checked against a screenshot or the code; measurements
that turned out to be harmless (a menu covering what it opens over, a
hidden tab's buttons) are left out.

### Across every screen

| Problem                                   | Measured                                                                                                                                                                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Each screen is its own design             | At 1440×900 screen titles are 44 px (Shop), 38 px (Adventure, Leaderboard, the Raid Hub's boss name) or 22 px (Missions, Wardrobe, Friends, Profile); some uppercase, most not. On phones the Shop title drops to 17 px.                                          |
| Close moves around                        | At 1440×900 Close sits 33 px from the right on Shop, Missions, Ranks, Friends and Profile; 89 px on Wardrobe; 109 px on Adventure; 151 px on the Raid Hub; 244 px on Settings; 479 px on the party invite. On phones it comes in five sizes, from 36×36 to 44×44. |
| Too many button looks                     | Distinct button styles on one screen at 1440×900: 15 on Shop › Champion skins, 17 in the raid room, 14 on the roster, 13 on the Lobby's mode menu.                                                                                                                |
| The coin pill changes size                | At 1440×900: Missions 96×38, Shop 110×40, Adventure 114×43; on phones 90×32, 96×36 and 97×35.                                                                                                                                                                     |
| Screens hide the Lobby                    | Every screen is a large centred dialog over a dark scrim. The HUD, wallet and rail disappear, so you can't see your coins in Missions or jump from Missions to the Shop without closing first.                                                                    |
| Small touch targets on phones             | Lobby rail 36×34 and ‹ › 32×32; Wardrobe: 17 targets under 40 px (category chips 30 px tall, "take off" 28×28); Shop: 10–18 per tab; Profile: radio inputs 16×16.                                                                                                 |
| A toast points at a menu that isn't there | "Pip wants to be friends. Open Menu → Friends." sits over the fighter's nameplate on phones (`accounts.ts`, line 1692). The Lobby has no Menu; Friends is on the rail.                                                                                            |

### Per screen

The target designs and what they borrow are in "Screens" below.

- **Fighters (roster).** One fighter at a time with a strip of eight
  portraits; comparing fighters means clicking through. Filter is one
  "All ⇄" button. Skills are four 40 px icons; the full text needs "Full kit".
- **Shop.** The preview column repeats the selected card. On phones only
  three of today's four picks fit; the fourth is below the fold. Prices are
  clear, but buying is the double tap above. The Shop and the Wardrobe each
  have their own preview and filters; going between them closes one dialog
  and opens another.
- **Wardrobe.** The fighter is a dropdown. Only owned items show, so you
  can't see what's left to get. On the island phone the category chips run
  past the right edge and the "Currently wearing" list is cut off at the
  bottom.
- **Missions.** Clear, but a long single column with explanatory paragraphs;
  the bonus and streak are at the bottom.
- **Journey (Adventure).** Called "Adventure" inside, "Journey" on the rail.
  The season road is a grid of 30 equal tiles you scroll through; cosmetic
  tiers look like coin tiers. Its coin pill is a different size again.
- **Raids.** The Raid Hub is a boss list plus one boss page. On phones all
  six attack descriptions are cut off ("A lane locks onto you, then the boss
  rus…"). "Create raid room" and "Play solo now" are the only actions; who
  is in your party, which fighters help, and what you earn next are on other
  tabs or other screens.
- **Raid room (lobby).** On phones Ready, Invite and Leave are behind a
  "Room & ready" drawer; opening it covers the fighter picker.
- **Raid briefing and results.** Shown over the arena. Fine on desktop; on
  phones they sit on top of the touch controls (out of scope: match HUD).
- **Ranks.** A plain table. Your row is highlighted inside the list, so at
  rank 300 you'd scroll to find it. Your rank card is small and the ladder is
  behind "How ranks work".
- **Friends.** Good content (status, Watch, Join, favourites, friend code),
  but in its own two-pane dialog with its own design. No invite from here to
  your Lobby party in one tap on desktop (the row's "…" menu holds it).
- **Player card and profile.** Opens from the HUD; the title needs a radio
  plus "Save title"; stats, mastery and links are spread over three columns.

## Mockups at a glance

Left: today at 1440×900 and on an iPhone-sized 852×393 with the Dynamic
Island. Right: the proposal at the same sizes. Every mockup at 1440×900,
1280×720 and 852×393 is in [`images/mockups/`](images/mockups/).

| Screen         | Now and proposed                                                 |
| -------------- | ---------------------------------------------------------------- |
| Shop           | ![Shop: now and proposed](images/compare/shop.webp)              |
| Wardrobe       | ![Wardrobe: now and proposed](images/compare/wardrobe.webp)      |
| Fighters       | ![Roster: now and proposed](images/compare/roster.webp)          |
| Fighter detail | ![Fighter detail: now and proposed](images/compare/fighter.webp) |
| Missions       | ![Missions: now and proposed](images/compare/missions.webp)      |
| Journey        | ![Journey: now and proposed](images/compare/journey.webp)        |
| Raid Hall      | ![Raid Hall: now and proposed](images/compare/raids.webp)        |
| Boss page      | ![Boss page: now and proposed](images/compare/boss.webp)         |
| Ranks          | ![Ranks: now and proposed](images/compare/ranks.webp)            |
| Friends        | ![Friends: now and proposed](images/compare/friends.webp)        |
| Player card    | ![Player card: now and proposed](images/compare/profile.webp)    |

The purchase confirmation: [desktop](images/mockups/confirm-desktop.webp),
[phone](images/mockups/confirm-phone.webp).

## The design

### Navigation map

```
Lobby (hub after login: fighter, party slots, PLAY bottom right)
├─ HUD: profile ─────────────► Player card (profile, titles, mastery, trophies, share)
│       coins / leaves ──────► Shop (fitting room)
│       ⚙ ───────────────────► Settings (unchanged in this remodel)
├─ Lobby / Plaza / Farm switch (unchanged)
├─ Rail
│  ├─ Fighters ──► Roster grid ──► Fighter detail (Overview · Skills · Skins) ──► Select
│  ├─ Wardrobe ──┐
│  ├─ Shop ──────┴► Fitting room: one screen, Shop | Wardrobe switch
│  │                 Shop: Today · Skins · Mythic Hall · Collections ──► Buy ──► Confirm
│  │                 Wardrobe: Skin · Colors · Aura · Entrance · Victory · Frame ──► Equip
│  ├─ Raids ─────► Raid Hall (boss cards + Attack practice)
│  │                 └─ Boss page (Party · Attacks/practice · Rewards · Guide)
│  │                      ├─ Start raid ──► Raid room ──► Briefing ──► (match) ──► Results
│  │                      └─ Practice ──► attack drill (existing)
│  ├─ Journey ───► Season road · Levels · Weekly arcade      (sheet or panel)
│  ├─ Missions ──► Daily missions, bonus, streak             (sheet: PLAY stays visible)
│  ├─ Ranks ─────► Your rank + ladder | Leaderboard (Everyone / Friends), your row pinned
│  └─ Friends ───► Friends · Requests · Recent               (sheet: PLAY stays visible)
├─ Party slots ──► Invite (Friends sheet, invite mode)
└─ Mode ▴ / PLAY (unchanged)
```

Rules for every screen:

1. **Screens open inside the Lobby, not over it.** The HUD (profile,
   wallet, settings) and the rail stay visible and usable; the rail shows
   where you are. Switching from Missions to the Shop is one tap.
2. **Two sizes of screen.** A _panel_ fills the space right of the rail
   (Fighters, fitting room, Raids, Journey, Ranks, Player card). A _sheet_ is
   460 px wide (380 on phones) and leaves the Lobby fighter and PLAY visible
   (Missions, Friends, party invite).
3. **Close is always in the panel's top-right corner**, one size (44 px,
   32 px on phones), and Escape or controller Back does the same.
4. **The main action is always bottom right**, where PLAY is. Every screen
   that acts (buy, equip, select, start raid) has an action bar there.
5. **Back goes up one level** (fighter detail → roster, boss → Raid Hall)
   with a small "‹ Roster" button top left; Close leaves to the Lobby.

### Shared design tokens

Defined once in `apps/client/src/ui/tokens.css`. Values come from what the
game already uses (`style.css` `:root`, `cosmetic-tier.ts`), so nothing
changes colour by accident. The mockup's [`ui-kit.css`](mockup/ui-kit.css)
is the draft.

| Group    | Tokens                                                                                                                                                                                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces | `--ui-bg-0 #0b1020`, `--ui-bg-1 #121a33`, `--ui-bg-2 #1a2547`, `--ui-bg-3 #243161`, glass `#0b1020e0`, lines `#ffffff1f` / `#ffffff33`                                                                                                                                  |
| Text     | `--ui-text #eef2ff`, `--ui-dim #a0afc8`, `--ui-faint #6f7d99`                                                                                                                                                                                                           |
| Meaning  | gold `--ui-accent #ffd65b` (main action, prices, "you"); green `#43d971` (owned, equipped, online); red `#ef4f61` (alerts and badges only)                                                                                                                              |
| Rarity   | common `#a7b3c6`, rare `#4fa8ff`, epic `#b56bff`, legendary `#ffbf3c`, mythical `#ff8fd8` plus a foil gradient. One set for Shop, Wardrobe, rewards and chips (today the Shop and `cosmetic-fx.css` disagree: Mythical is `#ff9be0` in one and `#ff4f7b` in the other). |
| Elements | the existing `--el-*` colours                                                                                                                                                                                                                                           |
| Presence | online `#43d971`, in a match `#ffbf3c`, in the Plaza `#b56bff`, offline `#6f7d99`                                                                                                                                                                                       |
| Space    | 4 px grid: 4, 8, 12, 16, 24, 32                                                                                                                                                                                                                                         |
| Radii    | 6, 10, 14, 18, 22, pill                                                                                                                                                                                                                                                 |
| Type     | Barlow Condensed (names, numbers, buttons), DM Sans (text), both already bundled. Scale 11 / 12 / 14 / 16 / 18 / 22 / 28 / 36 / 48 px, one step smaller on phones. Numbers always tabular.                                                                              |
| Controls | two heights only: 44 px (32 px small) on desktop, 36 px (28 px) on phones. Action width 152 px (104 px on phones), small width 92 px (76 px).                                                                                                                           |
| Shell    | HUD 52 px (40 on phones), rail 64 px (40), gutter 16 px (8), panel head 64 px (44), Close 44 px (32), safe-area insets on every edge                                                                                                                                    |
| Motion   | 120 / 200 / 320 ms, all 0 under `prefers-reduced-motion`                                                                                                                                                                                                                |

**Buttons (owner's note, 3 Nov):** buttons in a row are always the same
height and the same width, and only colour tells the main one apart (gold,
or green for Equip). Sizes stay moderate so the content keeps the room: no
button is taller than 44 px on desktop or 36 px on phones, and a pair like
Revert / Equip or Details / Select is two 152 px buttons (104 px on phones).
On phones a 36 px button still answers a 44 px finger: its hit area extends
past its edge without changing the layout. The only bigger button is the
Lobby's PLAY, which stays as it is.

### Shared components

All in `apps/client/src/ui/` as small functions returning markup (the
pattern the client already uses), each with its own CSS in
`ui/components.css`:

| Component                                                                 | Used for                                                                                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `panel()`, `sheet()`                                                      | Every screen's frame: head (kicker, title, tools, Close), body that scrolls, action bar                                                     |
| `tabs()`, `segmented()`, `chips()`                                        | Tabs in the head or under it; two to four equal choices; filter chips                                                                       |
| `button()`, `iconButton()`, `actions()`                                   | The two heights and the equal-width action group                                                                                            |
| `itemTile()`                                                              | One card for every item (Shop, Wardrobe, rewards): fixed rows for art, rarity, name, line, price/state, so a long name never moves anything |
| `price()`, `walletPill()`                                                 | Coin amounts with the coin icon, struck-through old price; the HUD pill reused everywhere                                                   |
| `rarityTag()`, `elementTag()`, `tag()`, `badge()`, `dot()`, `statusDot()` | All the small labels                                                                                                                        |
| `bar()`, `ring()`, `timer()`                                              | Progress bars, mastery rings, countdowns (server time)                                                                                      |
| `row()`, `avatar()`                                                       | List rows (friends, leaderboard, invites) and round fighter avatars with a status dot                                                       |
| `emptyState()`                                                            | "No friends yet", "Nothing owned in this slot", errors with Retry                                                                           |
| `confirm()`                                                               | A modal for anything that spends: item, price, your coins, coins after, Cancel / Buy                                                        |
| `toast()`                                                                 | Above the action bar, never over a button                                                                                                   |

### Screens

Each screen gets its own CSS module (`apps/client/src/screens/<screen>.css`)
that only lays out the shared components. The pull request that adds a module
deletes the old rules it replaces from `style.css` and the old per-screen
files; nothing is stacked on top.

#### Fitting room: Shop + Wardrobe ([compare](images/compare/shop.webp), [wardrobe](images/compare/wardrobe.webp), [confirm](images/mockups/confirm-desktop.webp))

As in the proposal (`docs/hub-redesign/prototype/lobby/template.html`,
"fitting room"): the fighter stands on the left under a spotlight, the
catalogue is on the right, and the action sits bottom right. Shop ⇄
Wardrobe only swaps the catalogue; the stage, try-on and action bar stay.

- **Shop › Today:** the 20%-off pick as a wide featured card with its own
  countdown; the other daily picks; the collection bundles with the full and
  discounted price; an "Earn coins" line (against players: win +15, loss +6;
  raid clear +60; missions +40/70/120; and how many mission coins are left
  today), all from `COINS` in `packages/shared/src/shop.ts`. Then
  **Skins** (avatar row of fighters, owned / not owned / rarity filters),
  **Mythic Hall** (trial progress, with "Play as Lumoth" that sets your
  Lobby fighter), **Collections**.
- **Wardrobe:** a row of fighter avatars instead of the dropdown; six slot
  tabs (skin, colors, aura, entrance, victory, frame) showing what is worn;
  the grid shows the items you own (owner's decision, 3 Nov), with a "More
  in the Shop" tile at the end that switches to the Shop on the same slot.
  Try several things, then Equip once or Revert.
- **Try-on:** tapping any tile puts it on the stage at once; "Hold to
  compare" shows the original; Entrance and Victory replay on the stage.
- **Buy:** the action bar names the item and the price; Buy opens a
  confirmation with the item, price, your coins and coins after, and a
  "Wear it now" box. The server still sets the price and checks the
  balance (`/api/shop/buy` → `arena_buy_item`); what the server answers is
  what the screen shows, and a refusal shows its reason.
- **Mythical:** a foil edge on the tile, and its trial or awakening progress
  instead of a price.
- Inspiration: the featured-plus-daily layout with per-section timers that
  Fortnite and Valorant stores use ([esports.net](https://www.esports.net/news/fortnite/fortnite-item-shop/), [siege.gg](https://siege.gg/news/how-does-valorants-store-work)); a single confirmation that shows the balance after; Brawl Stars moving cosmetics next to each Brawler (the proposal's research). Patterns only.

#### Roster and fighter detail ([compare](images/compare/roster.webp), [detail](images/compare/fighter.webp))

- **Grid:** all eight fighters as cards, coloured by element, with element,
  range, role, mastery ring and "n/8 looks". Filter by element (chips) and
  range; sort by mastery, name or element. Your current fighter is marked
  "Playing". Select (bottom right) sets your Lobby fighter.
- **Detail:** the fighter on the stage with health, speed and basic DPS
  bars; tabs Overview · Skills · Skins. Skills shows every skill as a row
  (key, icon, name, the full description, cooldown) with the selected
  skill's preview playing above; Skins jumps to the fitting room for that
  fighter. ‹ › steps through fighters. Raid tricks for that fighter are
  listed from `RAID_BOSS_PERKS`.
- The raid and PvP room's fighter picker reuses the grid and detail, so
  there is one picker in the game.
- Inspiration: a hero grid coloured by class with filters and a detail page
  of skills and stats (Brawl Stars, Pokémon UNITE). Patterns only.

#### Missions and Journey ([missions](images/compare/missions.webp), [journey](images/compare/journey.webp))

- **Missions** is a sheet: the Lobby fighter and PLAY stay in view. A top
  line with done / six, the all-six bonus and changes left; six rows with a
  difficulty colour, progress, coins and XP, and Paid (✓) or a change button
  (↻); the 7-day streak as dots with the +300 day. Payouts stay automatic
  (decision 11): no Claim buttons, "Paid" is a state, not an action.
- **Journey** is a panel with Season · Levels · Weekly arcade. Season: level
  ring, tier, XP to the next tier, season countdown and Daily Spark in one
  banner; the season road scrolls sideways with cosmetic tiers larger than
  coin tiers and the current tier lit; weekly goals with their reset timer;
  a short level road with the next rewards.
- Every timer (new missions, weekly reset, season end) comes from the
  server's clock.
- Inspiration: battle-pass style season roads with milestone rewards larger
  than filler rewards, daily lists with a reset timer. The prototype's
  `progress.js` layout is followed.

#### Raids ([hall](images/compare/raids.webp), [boss](images/compare/boss.webp))

- **Raid Hall:** seven boss cards (art, name, stars, element, the
  signature mechanic, clears or New, rewards earned, three fighters with a
  trick there) plus an Attack practice card. Locked bosses say why ("Clear
  Grumblecrag first"). Filters: Not cleared, stars.
- **Boss page:** the boss art on the stage; tabs Party · Attacks/practice ·
  Rewards · Guide. Party shows four seats (you, members, open seats to
  invite), online friends with an Invite button, the fighters with a trick
  here, and the next rewards with progress. Bottom right: Solo / With party,
  Practice, Start raid.
- **Raid room:** the same seats and the shared fighter picker, with Ready
  bottom right and no drawer on phones. Drawn in step 5 for the owner's
  review: [raid room](images/mockups/room-desktop.webp)
  ([phone](images/mockups/room-phone.webp)), and the PvP rooms in the same
  frame ([2v2](images/mockups/room-teams-desktop.webp),
  [phone](images/mockups/room-teams-phone.webp)); `?s=room` and
  `?s=room-teams` in the mockup page.
- **Briefing and results:** restyled with the shared panel, tags and
  buttons; their content and timing stay (they are part of the match
  screen's flow, and the match HUD is out of scope).
- Inspiration: raid lobbies with party slots and a ready step (Pokémon GO),
  a quest board of target cards (Monster Hunter). Patterns only.

#### Ranks, Leaderboard and Friends ([ranks](images/compare/ranks.webp), [friends](images/compare/friends.webp))

- **Ranks:** your rank as a tier badge with rating, best rating, progress to
  the next rank and the whole ladder with yours lit; the leaderboard with
  medals for the top three and **your row pinned at the bottom** with your
  rank, whatever your position (the server already sends your rank and
  rating with the top 20). An Everyone / Friends switch needs the server to
  send your friends' rows too (open question 4).
- **Friends** is a sheet: Friends · Requests · Recent tabs; requests on top
  with Decline / Accept; online friends first with a status dot and one
  action (Invite to your party, Join, or Watch); offline with "online 2 h
  ago"; your friend code with Copy and Share. Recent needs a server endpoint
  (open question 4).
- Inspiration: a pinned "you" row on leaderboards
  ([example](https://www.shadcn.io/blocks/radix/web3-leaderboard)); online
  friends with a one-tap invite (Pokémon UNITE, per the proposal's
  research). Patterns only.

#### Player card and profile ([compare](images/compare/profile.webp))

- The card on the left is the same card other players see (fighter in its
  equipped look, title, name, level, rank). "Share card" would save it as a
  picture, drawn on the device the way `share-card.ts` draws match results
  (optional; open question 7).
- Matches, wins, win rate and raid clears as four tiles; titles as chips
  that equip on tap (no Save button); mastery for all eight fighters; Journey
  and Ranked summaries; raid trophies per boss; links to Ranks, Journey and
  raid rewards.

### Phones, notch and performance

- Phones held sideways use the same layouts, one size smaller: the rail
  drops its labels, the stage narrows to 210 px, filter chips scroll
  sideways, the action bar keeps its two buttons.
- Every screen respects `--safe-left/right/bottom` (the Dynamic Island and
  the home indicator) and is checked at 852×393 with 59 / 59 / 21 px insets.
- Only one live fighter renderer runs (the stage), as today. Tiles use
  static pictures (`itemPicture`, already cached).
- **Low graphics** (Settings → Graphics, as the Plaza and Farm): a still
  fighter instead of the animated rig, no spotlight blur or turning aura, no
  backdrop blur. Auto switches to Low when frames are slow, measured the way
  the farm measures it.
- Keyboard and controller: tabs and grids move with arrow keys, Enter
  selects, Escape/Back goes up one level, focus is always visible. Touch:
  tap to try on, hold to compare, swipe the season road.

## Pull requests, in order

Each step is one pull request into `main`, with before-and-after screenshots
in the description. Before every push: `npm run typecheck`, `npm run test`
and `npm run build`. Still run the visual tests for the screens it changes
(Playwright on `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`), but
don't hold a push for them (owner, 3 Nov): push once the three checks pass,
let the visual tests (local and the `visual` CI job) finish afterwards, and
fix any failure in a follow-up push. Say in the report which visual tests
had passed at push time.

| #   | Pull request                   | Ships                                                                                                                                                                                                                                                                                                                                                                                   | Deletes                                                                                                                                                 |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Design foundation              | `ui/tokens.css`, `ui/components.css`, the component functions, the panel/sheet shell that keeps the HUD and rail visible, and the server's clock: every `/api` answer carries `X-Server-Time`, and one `serverNow()` feeds every hub timer. The measuring helper for the visual tests (below). Fixes the "Open Menu → Friends" toast. No screen changes look yet, apart from the shell. | The old dialog sizing and Close rules once every screen uses the shell (the rest go with their screens).                                                |
| 2   | Fitting room (Shop + Wardrobe) | `screens/fitting-room.ts` + `.css`: stage, Shop                                                                                                                                                                                                                                                                                                                                         | Wardrobe, all four Shop tabs, six Wardrobe slots, unowned items in the Wardrobe, the purchase confirmation, Low graphics path. Existing endpoints only. | Shop, Shop preview, rarity and Missions-card rules in `style.css`; `mobile-store.css`; `wardrobe.css`; `shop-preview-layout.ts` if unused. |
| 3   | Roster                         | `screens/roster.ts` + `.css`: grid, filters, sort, fighter detail, shared with the room's fighter picker.                                                                                                                                                                                                                                                                               | Roster and champion-selection rules in `style.css`; `champion-selection.css`; `mobile-panels.css` parts for the picker.                                 |
| 4   | Missions and Journey           | `screens/missions.ts`, `screens/journey.ts` (+ `.css`): the sheet, the season road, weekly goals, levels; server-time timers.                                                                                                                                                                                                                                                           | Mission, streak and Adventure rules in `style.css`.                                                                                                     |
| 5   | Raids                          | `screens/raid-hall.ts`, boss page, room, briefing and results styles.                                                                                                                                                                                                                                                                                                                   | Raid Hub, raid lobby, briefing and result rules in `style.css` (match HUD rules stay).                                                                  |
| 6   | Ranks, Leaderboard and Friends | `screens/ranks.ts`, `screens/friends.ts` (+ `.css`); the pinned row; Friends as a sheet; Recent if approved.                                                                                                                                                                                                                                                                            | Ratings, leaderboard and friends rules in `style.css`; `friends.css`.                                                                                   |
| 7   | Player card and profile        | `screens/profile.ts` + `.css`; titles equip on tap (the existing equip call).                                                                                                                                                                                                                                                                                                           | Profile, title picker and progress rules in `style.css`; `player-card.css` if unused.                                                                   |

Matches are untouched in every step. Where a selector is shared with the
match screens (buttons, rarity badges in results), the match keeps its rule
until a later pass.

### Tests

- A helper next to `tests/visual/helpers.ts` (`ui-measure.ts`) with the
  checks the mockups already pass (see "Checked in the mockups"):
  - buttons in an `actions()` group: equal width and height, same top edge;
  - small buttons in a row: equal height;
  - Close at the same offset from its panel's corner on every screen;
  - HUD, rail, stage, panel and PLAY never overlap, and stay inside the
    safe-area insets at 852×393;
  - no button label cut off; tiles keep the same size whatever the name;
  - touch: on phones every control's hit area is at least 44 px;
  - text centring checked by pixels for buttons and pills (the way
    `tests/visual/farm.spec.ts` does).
- Each screen's spec opens it at the four sizes, runs the helper, and
  attaches screenshots. Visual specs that point at the old screens
  (`shop-*.spec.ts`, `fighter-select.spec.ts`, `roster-*.spec.ts`,
  `regular-raids.spec.ts`, `raid-practice-hub.spec.ts`, `journey-levels.spec.ts`,
  `cosmetic-displays.spec.ts`, `dialogs.spec.ts`, …) move to the new
  selectors in the same pull request; what they check stays.
- Unit tests for the parts that are logic: filters and sort, server-time
  countdowns, which slots an item covers, the confirmation's numbers.
- Phone smoothness: frame times on the fitting room and roster with the CPU
  throttled 4×, High and Low, recorded in each pull request.

### Checked in the mockups

A script (`mockcheck`, to become `ui-measure.ts`) opened all 12 mockup
screens at 1440×900, 1280×720, 844×390 and 852×393 with the insets: 0
unequal button groups, 0 overlaps between HUD, rail, stage, panel and PLAY,
0 boxes in the safe-area insets, 0 cut-off button labels; Close at 11 px
from the corner and 44 px on every desktop panel, 7 px and 32 px on every
phone panel.

## Progress

### Step 1: design foundation (built 3 Nov 2026)

- `apps/client/src/ui/tokens.css`: every token. The three `:root` blocks in
  `style.css` moved here unchanged (the old names now point at the new
  `--ui-*` ones), so nothing changed colour.
- `apps/client/src/ui/components.ts` + `components.css`: buttons (two
  heights; `actions()` makes equal groups), panel and sheet, tabs, segmented,
  chips, item tile, price, tags, rarity and element tags, bars, rings,
  timers, avatars, rows, empty state, confirmation. Base rules have zero
  specificity, so a component class always wins over them.
- `apps/client/src/ui/hub-panel.ts`: `openHubPanel()` mounts a screen inside
  the Lobby (HUD and rail stay usable, the rail marks it, Escape and Close
  leave, Lobby parts under a full panel stop drawing and leave the tab
  order); `askConfirm()` asks before spending.
- **Server time:** every `/api` answer carries `X-Server-Time` (exposed to
  the static site through CORS). The client keeps the offset
  (`server-clock.ts`) and the daily countdown (Shop, Missions, Lobby,
  Daily Spark) and friends' "online 2 h ago" use it.
- **Toast:** one definition (five stacked rules left `style.css`); in the
  Lobby it sits under the HUD, and above the action bar when a screen is
  open. The friend-request toast says "Open Friends to answer." instead of
  pointing at a Menu the Lobby doesn't have.
- **Found while measuring:** the Lobby's `.lobby-layer button` rule out-ranked
  component buttons (now zero specificity); the Lobby's "pause animations
  when covered" rule froze anything inside it (now skips the screen layer);
  a 1 px border shrank 36 px buttons' hit area to 42 px (now a centred 44 px
  box); icon + label buttons were 1.5 px right of centre (icon side bearing
  and trailing letter-spacing, now cancelled).
- **Not yet:** no real screen uses the shell; each moves in its own step. A
  sheet keeps PLAY and the mode usable, but on desktop the Lobby's party row
  (about 800 px) is half under a 460 px sheet; the stage is re-centred beside
  a sheet in step 4, with the first real sheet (Missions).
- Tests: `tests/visual/ui-foundation.spec.ts` (all four sizes, using
  `tests/visual/ui-measure.ts`), `tests/unit/ui-components.test.ts`,
  `tests/unit/server-clock.test.ts`, and a CORS integration test for the
  clock header.

### Step 2: the fitting room (built 3 Nov 2026)

Before and after: [Shop](images/step2/shop.webp),
[Wardrobe](images/step2/wardrobe.webp); every size in
[`images/step2/`](images/step2/).

- `apps/client/src/screens/fitting-room-view.ts` (markup and rules, no DOM)
  and `screens/fitting-room.ts` (behaviour) + `fitting-room.css` (layout
  only). The Shop and the Wardrobe are one screen opened inside the Lobby
  with `openHubPanel` (rail, HUD coin pill and Missions → Shop all lead
  there). Shop | Wardrobe only swaps the catalogue; the stage, what you
  are trying on and the action bar stay.
- **Stage:** the live rig (`mountShopPreview`) on the left, the portrait
  frame you'd wear top left (it opens the Frame slot), Entrance and
  Victory top right, Hold to compare (pointer, Space or Enter held down)
  and a Mythical's I / II / III at the bottom. A frame is shown large on
  its portrait, with the boss frame's 0–5★ preview. **Low graphics:** a
  still fighter, no rig, no blur; Hold to compare swaps two stills.
- **Shop:** Today (the 20%-off pick as a wide card with its own countdown,
  the other picks, the three sets nearest to complete, the Earn coins
  line from `COINS`/`MISSION_COINS` with the mission coins left today),
  Skins (fighter avatars, All / Owned / Not owned, rarity chips), Mythic
  Hall (trial or awakening progress; a locked Mythical offers "Play as
  …", which sets your Lobby fighter), Collections. It opens on today's
  deal, already on the stage.
- **Buying:** Buy opens `askConfirm()` (item, price and full price, your
  coins, coins after, "Wear it now"); then `/api/shop/buy`, and the
  screen shows the server's answer, or its reason when it refuses. Short
  of coins, "Earn coins" (Missions) sits beside a disabled Buy, the same
  size. Testers with unlimited coins see "Unlimited" and never "short";
  testers with Mythic access skip trials and see every stage.
- **Wardrobe:** the fighter row, six slot tabs showing what each slot
  holds (a dot marks an unsaved change), owned items only plus "Original
  look" / "No aura"… first and **More in the Shop** last (it opens the
  Shop on that slot: Skins, Not owned; or Collections). Try several
  things, then **Equip** once (one `/api/shop/equip` or `/api/raids/equip`
  per changed slot; a Mythical saves the highest stage reached) or
  **Revert**. Try-ons of things you don't own are never saved.
- **Refreshes keep what the browser built:** `ui/patch.ts` (from the old
  `shop-content.ts`) patches the screen from new markup, so a fresh copy
  of your coins keeps the canvas, pictures, focus and scroll; a new star
  level updates the frame in place (no flicker).
- **Foundation additions:** a split panel (`.ui-panel.is-split`, stage +
  catalogue, Close still in the corner) and `--stage-w` (440 / 390 /
  210 px); a `sub` line in `confirmModal`; `hub-panel.ts` closes a screen
  whose Lobby leaves the page (Plaza, Farm, a match) and fires
  `ui-panel-change`, so a downloaded update waits until the screen
  closes (`pwa.ts`); another rail item closes the open screen
  (`main.ts`); `ui-measure.ts` checks only the confirmation's buttons
  for finger size while it covers the screen; the gamepad's right stick
  scrolls `.ui-panel-body`.
- **Deleted:** `wardrobe-ui.ts`, `wardrobe.ts`, `shop-content.ts`, the
  Shop markup in `shop-ui.ts` (475 → 74 lines: coin pills, countdown and
  item pictures stay, Missions and Journey use them), `mobile-store.css`
  (687 lines), `wardrobe.css` (836), the Shop/Wardrobe rules of
  `cosmetic-review.css` (268 → 27) and 1,483 lines of Shop, Wardrobe and
  rarity rules in `style.css`. A script removed only selectors built on
  classes no source produces any more (keeping live alternatives inside
  `:is()`), and Journey, Missions and Raids were compared pixel by pixel
  before and after (identical apart from the moving countdown).
- **Kept for later steps:** `.shop-preview`, `.shop-live-stage` and
  `.shop-preview-fallback` rules (Journey's reward preview uses them, and
  the live rig needs the last two; step 4) and `.shop-intro`,
  `.shop-note`, `.shop-status` (Missions, step 4). `shop-preview-layout.ts`
  is still used by the rig.
- **Choices made while building:** on phones the stage shows only the
  fighter and its tools (the name is in the action bar), and a
  Mythical's I / II / III stand in a column at the stage's right edge, so
  the stage never changes size. The rig's canvas is 400 px wide and not
  pixel-ratio aware (as before), so the stage host is capped at 500 px:
  the fighter is a little smaller than in the mockup on desktop but
  stays sharp. Opening the Wardrobe from the Shop keeps the fighter on
  the stage.
- **Tests:** `tests/unit/fitting-room.test.ts` (prices and the
  confirmation's numbers, trials, testers, filters, owned-only Wardrobe,
  pending changes, try-on outfit, Low graphics), the frame-level and
  hold-to-compare unit tests, and `tests/visual/fitting-room.spec.ts` at
  the four sizes with `ui-measure.ts` (plus buying and a refusal,
  Equip/Revert, keyboard, Low graphics, reduced motion, rail switching,
  a late answer). `shop-stability`, `shop-preview-switching`,
  `shop-spotlight`, `cosmetic-displays`, `cosmetic-review`,
  `portrait-frames`, `frame-level-preview` and the soak test in
  `battle-performance` moved to the new screen; what they check stays.
  `tests/visual/shop-server.ts` stands in for the Shop's server calls.
- **Frame times** (852×393, CPU throttled 4×, idle on the Shop; this
  machine renders on the CPU, so only the comparison means anything):
  before High 333 ms / Low 317 ms (the old Shop ran the rig on Low too);
  after High 250 ms / Low 83 ms.

### Step 3: the roster (built 3 Nov 2026)

Before and after: [roster](images/step3/roster.webp),
[fighter detail](images/step3/fighter.webp); every size in
[`images/step3/`](images/step3/).

- `apps/client/src/screens/roster-view.ts` (markup and rules) and
  `screens/roster.ts` (behaviour) + `roster.css`. The rail's Fighters
  opens it inside the Lobby (`openHubPanel`); the old Fighters drawer is
  gone from the hub.
- **Grid:** every fighter (sixteen since the new champions landed on 3
  Nov) as cards of one size coloured by element, as many to a row as fit,
  scrolling: element, mastery ring, role, range, owned looks ("1/1" for a
  champion without skins yet) and "Playing" on yours.
  Element chips, Any range / Ranged / Close and Sort (Mastery, Name,
  Element). Bottom right: Details and Select (Select says "Playing" on
  your fighter). Select makes the fighter your Lobby fighter and returns
  to the Lobby.
- **Fighter detail:** the split panel from step 2. The fighter on the
  stage (the live rig in the "selection" framing; a still fighter on Low
  graphics), its number, mastery ring, ‹ › and health / speed / basic DPS
  bars; tabs Overview (description, combo, mastery, basic attack, dash and
  jump), Skills (the chosen skill large, every skill and the basic attack
  as rows with key and cooldown, raid tricks from `RAID_BOSS_PERKS`) and
  Skins (the looks you own and the rest). "‹ Roster" goes back up; Try
  skins opens the Shop on that fighter's skins.
- **Keyboard and touch:** arrows move through the cards (focus picks); a
  second click, tap or Enter on the picked card opens its detail; `[` and `]` step fighters, arrows move
  through the skills and tabs; Escape leaves.
- **The rooms keep their picker until step 5** (owner, 3 Nov): the roster
  is built to be the one picker (`action: "lock"` turns Select into Lock
  in), and step 5 puts it in the PvP and raid rooms while redrawing them.
  So `fighter-selection.ts`, `champion-selection.css` and the picker parts
  of `mobile-panels.css` stay until then; this step deletes only the hub
  drawer's rules (`.home-roster-drawer`, `#home-fighter-panel`: 13 rules
  in `champion-selection.css`, 10 in `style.css`).
- **Found in review and fixed:** stepping fighters on the stage dropped
  the live rig's canvas (the stage is now swapped whole and the preview
  re-attached); a second click only opened the detail as a fast
  double-click; a filter could hide the picked fighter while Details and
  Select still acted on it (the first fighter shown is picked, and with
  none shown both are disabled); focus could fall to the page after "Show
  all" or move with a reordered card.
- **Tests:** `tests/unit/roster.test.ts` (filters, sort, mastery, looks,
  stats, raid tricks, tabs, the room's Lock in), `tests/visual/roster.spec.ts`
  at the four sizes with `ui-measure.ts` (plus Select, Try skins,
  keyboard, Low graphics, reduced motion). `fighter-select`,
  `roster-skill-icons`, `roster-smooth` and the Lobby spec's Fighters check
  moved to the new screen; what they check stays.

### Step 4: Missions and Journey (built 4 Nov 2026)

Before and after: [Missions](images/step4/missions.webp),
[Journey](images/step4/journey.webp); every size in
[`images/step4/`](images/step4/).

- `apps/client/src/screens/missions-view.ts` and `journey-view.ts` (markup
  and rules, no DOM), `missions.ts` and `journey.ts` (behaviour), and
  `missions.css` / `journey.css` (layout only). The rail, the Lobby's
  cards and the fitting room's "Earn coins" open them inside the Lobby
  (`openHubPanel`).
- **Missions is the first sheet.** A top line with done / six, the all-six
  bonus and the changes left; six rows with the difficulty colour,
  progress, coins and XP, and Paid (✓) or a change button (↻, "Swap for a
  solo mission" on a mission that needs others). Payouts stay automatic:
  Paid is a state. The 7-day streak as dots with the +300 day. A row's
  text is one button that opens how to complete the mission under it (the
  old per-mission "?" popups, same text). A change asks the server
  (`/api/missions/reroll`) and shows its answer or its reason; every
  change button waits while one is on its way.
- **The Lobby beside a sheet** (step 1's note): `hub-panel.ts` marks the
  Lobby (`data-ui-sheet`) while a sheet is open, and one block in
  `ui/components.css` moves the stage and the emotes into the room right
  of the sheet. On phones the side cards make way (the sheet says what
  they say) and the stage takes the room above PLAY, so the fighter stays
  whole, if smaller: measured 310 px wide at 1440×900 (560 without the
  sheet), 220 px at 1280×720 (494), 134 px at 844×390 (234) and 120 px
  on the island phone (220), its smallest size. The live rig keeps running behind a sheet (the spec compares
  two pictures of it a few seconds apart) and PLAY stays usable. This
  keeps `lobby.css` untouched for the Lobby work going on in parallel.
- **Journey is a panel** with Season · Levels · Weekly arcade as tabs in
  its head. Season: one banner (level ring, the season and its tier, XP to
  the next tier, "Ends in …", the Daily Spark), the season road scrolling
  sideways (wheel, swipe, or arrows once focused) with the four cosmetic
  tiers larger than the coin tiers, earned tiers ticked and the next tier
  lit and scrolled into view; the weekly goals with "Resets in …"; a short
  level road with the next four milestones. Levels: every milestone to
  level 100 (titles and cosmetics, earned or not) and how XP is earned.
  Weekly arcade: this week's event, its countdown, and Private 1v1 /
  Private 2v2 / Play vs AI as three equal buttons in the action bar.
- **Equip:** picking a reward shows it in the action bar (picture, where it
  comes from, whether you own or wear it) with Wardrobe and Equip (Locked
  until it is yours). Equip goes through `/api/raids/equip`, as the
  Wardrobe does. The old reward preview with its own live rig is gone; the
  fitting room is where things are tried on.
- **Server time:** the daily countdown (`picksCountdown`), and the new
  `ui/countdown.ts` for the weekly reset (next Monday, Pacific) and the
  season's end (the first Pacific day of the next month), all on
  `serverNow()`. The arcade week and a missing season id use the server's
  Pacific date too. The sheet and the panel redraw their countdowns every
  30 s while open (patched in place). The old screen said "0 days left"
  when the device's month and the season disagreed.
- **Deleted:** `missions-ui.ts`, the Adventure markup in `adventure-ui.ts`
  (210 → 67 lines: the level bar and result-card XP stay for the results
  and the profile), the Missions and Adventure hooks in `dialog.ts`, and
  1,600 lines of `style.css`: the Mission, streak, Adventure, season,
  Journey reward-preview and old home-mission rules, `.shop-intro`,
  `.shop-note`, `.shop-status`, `.shop-preview`, `.shop-preview-visual` and
  `.shop-preview-text` (`.shop-live-stage` and `.shop-preview-fallback`
  stay for the live rig), and the Journey preview's frame sizing in
  `journey-frames.css`. As in step 2 a script removed only selectors built
  on classes no source emits (keeping live alternatives inside `:is()`),
  and the Lobby, Shop, Wardrobe, roster, fighter detail, Raids, Ranks,
  Friends and profile were compared pixel by pixel before and after at
  1440×900 and 844×390: identical apart from the Lobby's random sparkles
  and the Shop's moving countdown.
- **Choices made while building:** the new classes avoid every old name so
  the prune could tell them apart. On phones the season road's tiers are
  64 / 84 px wide and the Daily Spark stays in the banner (the mockup hid
  it; the old spec required it on phones). `ui-measure.ts` now checks a
  phone control's 44 px reach only while the control is wholly in sight
  (a row scrolled out of its list is checked once scrolled to; the specs
  do that).
- **Tests:** `tests/unit/missions.test.ts`, `countdown.test.ts` (weekly
  reset, season end, daylight saving) and the Journey checks in
  `journey.test.ts` / `journey-cosmetics.test.ts`;
  `tests/visual/missions.spec.ts` and `journey.spec.ts` at the four sizes
  with `ui-measure.ts` (plus changing a mission and a refusal, equipping,
  keyboard, reduced motion, Low graphics). `journey-levels.spec.ts` became
  `journey.spec.ts` (its 700×390 size too); `mission-changes-ui.test.ts`
  and the Missions parts of `shop-ui.test.ts` became `missions.test.ts`;
  `level-cosmetics`, `regular-raids`, `fitting-room` and `landscape-only`
  moved to the new screens. What they check stays.
- **Verified:** typecheck, the unit tests and the build on the merged
  commit; locally the visual specs of every screen this step touches
  (missions, journey, lobby, lobby-fighter-rig, ui-foundation,
  lobby-safe-area, fitting-room, level-cosmetics, regular-raids, roster,
  dialogs: 68 tests) passed. Not verified: real phones, the live server.
- **Process (owner, 4 Nov):** from step 4 on, work goes straight to `main`
  once typecheck, tests and build pass; no pull request.

### Step 5: Raids, part 1 (built 4 Nov 2026)

Before and after: [Raid Hall](images/step5/raids.webp),
[boss page](images/step5/boss.webp), [briefing](images/step5/briefing.webp),
[results](images/step5/results.webp); every size in
[`images/step5/`](images/step5/). Part 1 is everything but the raid room,
which waits for the owner's look at its mockup (above).

- `apps/client/src/screens/raid-hall-view.ts` (markup and rules, no DOM),
  `raid-hall.ts` (behaviour) and `raid-hall.css` (layout only). The rail's
  Raids, PLAY on Boss Raid, the Play panel and the profile's Raids link
  open it inside the Lobby (`openHubPanel`), and leaving a raid room comes
  back to the boss page on the tab you left from.
- **Raid Hall:** the seven bosses as cards of one size (splash art, name,
  stars, element, the signature mechanic, clears or New, rewards earned,
  three fighters with a trick there) and an Attack practice card. Locked
  bosses say "Clear Grumblecrag first". Filters All · Not cleared · ★ ·
  ★★ · ★★★, with an empty state and "Show all" when nothing is left.
- **Boss page:** the split panel from steps 2 and 3, with the boss's art
  on the stage; "‹ Raid Hall" goes back to the card you came from. Tabs:
  **Party** (four seats: you, your Lobby party, open seats; your online
  friends with Invite, which is the Lobby's party invite and shows the
  server's answer; the three good picks; the next three rewards with their
  progress), **Attacks · practice** (every attack; the one picked is what
  Practice drills), **Rewards** (every reward with its picture, rarity and
  progress; Wardrobe to wear them) and **Guide** (the blurb, the three
  chapters, every fighter trick, the solo and team rules). Bottom right:
  Practice and Start raid; bottom left Solo / With party and what it
  means. A leader with a party raids with it (Solo is off); a member sees
  "Your party leader starts the raid."; a locked boss says why.
- **Briefing and results** use the shared panel, kicker, title, tags and
  equal buttons (`screens/raid-cards.css`). Their content and timing are
  the match's own: the three steps with their diagrams, the details, the
  stats, the scoreboard, the save state, the retry count, the XP. The
  rites, countdown and pause keep the match card (match HUD: out of
  scope). Every timer in these cards already comes from the server's
  snapshot (`remaining`, `elapsed`); the hall and boss page have none.
- **Deleted:** `raid-hub.ts`, the Raid Hub's appearance picker
  (`raidAppearance`, `raidCosmeticOptions`: the Wardrobe equips the same
  slots since step 2), the Raid Hub branch of `dialog.ts`, the broken
  `raid-lobby-preview.html` (it imported two modules that no longer
  exist), and 2,045 lines of `style.css` (434 rules, 13 selectors trimmed):
  the Raid Hub, its boss rail and showcase, the old rewards tab, and the
  briefing and result rules. As in steps 2 and 4 a script removed only
  selectors built on classes the sources emitted before this step and no
  longer emit (kept live alternatives inside `:is()`; classes built at
  run time were never touched), and the Lobby, mode menu, Play panel,
  roster, Shop, Wardrobe, Journey, Missions, Ranks, Friends, party invite,
  profile, Settings and the raid room were compared pixel by pixel before
  and after at 1440×900 and 844×390: the only differences were the live
  rigs, the Lobby's sparkles, the toast's timing and the countdown.
- **Choices made while building:** the results' "Raid Hub & rewards"
  button and the room's "Raid Hub & rewards" button are gone: Raids is a
  Lobby screen now, and "Return to menu" lands on the boss page (one tap
  from Rewards). The boss art fills the stage (cover, as in the mockup),
  so a tall stage shows part of the wide picture. On narrow phones (an
  iPhone SE sideways, 568 px) the boss page drops the stage so its
  actions fit. The scoreboard keeps the `.raid-score-avatar` portrait so
  frames and colours still show on it.
- **`ui-measure.ts`:** a phone control's 44 px reach is checked only while
  that reach is in sight inside a scrolling list (a button resting on the
  list's edge is checked once scrolled, which the specs do).
- **Tests:** `tests/unit/raid-hall.test.ts` (unlocks, filters, tricks,
  next rewards, seats, invites, what Start raid can do, the reward checks
  from the old Raid Hub tests), `tests/visual/raids.spec.ts` at the four
  sizes with `ui-measure.ts` and label centring measured on the pixels
  (plus Invite and a refusal, Practice, a party leader and member,
  keyboard, reduced motion, Low graphics, an iPhone SE).
  `regular-raids`, `raid-practice-hub`, `raid-room-return`,
  `raid-roster-scroll` (now the hall's cards), `raid-splash`,
  `raid-briefing`, `hub-after-raid`, `cosmetic-displays`,
  `frame-level-preview`, `raid-overlay`, `raid-presentation`,
  `raid-lobby` and `landscape-only` moved to the new screens; what they
  check stays. `raid-splash` no longer runs at 414×896 (a portrait
  desktop window; phones are landscape only) and accepts the stage's
  cover crop.

### Split-panel balance (4 Nov 2026)

Owner's note: on a big window the fighter detail had a narrow 440 px stage
with the fighter hanging under its top edge, beside a text column more than
1,100 px wide. The same split (fixed stage, main column takes the rest) was
in the fitting room and the raid boss page; Journey's weekly goals had the
same problem as a list (bars 1,250 px long beside a 320 px level road).

- **Split panel** (`ui/components.css`, `ui/tokens.css`): on desktop the
  main column stops at `--split-main` (`clamp(720px, 48vw, 920px)`;
  `clamp(760px, 58vw, 920px)` under 821 px of height, where the fighter is
  height-bound and extra stage width would be empty) and the stage takes
  the rest, never below `--stage-w`. Hero-left, details-right, as current
  hero pages do (Valorant, Marvel Rivals, Overwatch 2, LoL). Phones keep the
  fixed narrow stage. 1720×1360: stage 782 / main 826 (was 440 / about 1,165);
  1440×900: 608 / 720 (was 440 / about 885).
- **Roster stage** (`roster.css`): three grid rows (number and mastery, the
  fighter, the nameplate), so the fighter is centred in the room it has at
  any height; ‹ › sit level with it. The rig box grows to 620 px wide (the
  preview canvas draws at the shown size times the density, within about a
  million pixels: 620 px keeps 1.5 pixels per CSS pixel on a 2× screen). A
  wide stage (container query, 640 px) puts the stats beside the name and
  makes the spotlight longer and steeper, still from the top-right corner
  (owner's note), so it reaches the fighter; tall screens show the name huge
  and faint behind it; a coloured pool sits at the fighter's feet.
- **Fitting room**: the live host is up to 500 px on a narrow stage (as
  before) and at most 560 px, centred, on a wider one: the preview draws at
  the shown size times the screen's density within about a million pixels,
  and a wider full-height host fell below 1.5 pixels per CSS pixel on a 2×
  screen (`fitting-room-pictures.spec.ts`). On phones the
  fighter is drawn 34 px lower (the host moves down whole, so it keeps its
  size): Entrance and Victory no longer cover its ears and crest (owner's
  note).
- **Journey**: weekly goals are cards two to a row when the column has
  800 px; the level road is `clamp(320px, 30%, 420px)`.

### Step 5: the boss page on a big window (4 Nov 2026)

Owner's note (a 1720×1392 window): the boss art was cropped and the right
side had too much empty space. Before and after:
[boss page, tall window](images/step5/boss-tall.webp).

- **The whole picture:** on desktop the boss's art is shown whole (it is a
  wide 3:2 picture, the stage is tall) over a blurred, darkened copy of
  itself that fills the stage, its edges fading into that copy. Low
  graphics leaves out the blurred copy. Phones, where the stage is a
  210 px strip, still crop it to fill. The stage itself now grows with the
  screen and the main column stops at `--split-main` (the split-panel
  change above), which took care of most of the empty width.
- **The Party tab uses the height:** every fighter with a trick here (seven
  or eight, two to a row) instead of three, up to six next rewards, and a
  strip of the boss's six attacks, each opening the Attacks tab on that
  attack. A short screen scrolls; phones leave out the strip (the Attacks
  tab is one tap away).
- **Tests:** `raids.spec.ts` adds 1720×1392, where it checks the picture is
  whole (`object-fit: contain`, its own 3:2 shape, inside the stage) and
  that the Party tab fills more than 75% of its column; the strip opens the
  Attacks tab on its attack. `raid-splash.spec.ts` expects the whole
  picture on desktop.
- **Room decisions (owner, 4 Nov):** the raid room mockup is approved as
  drawn: the corner button leaves the room, a room has no rail (nor the
  Lobby / Plaza / Farm switch), and the 2v2 and free-for-all rooms move to
  the same frame in this step.

## Decisions (owner, 3 Nov 2026)

| #   | Question                                        | Decision                                                                                                                                                         |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Screens inside the Lobby (HUD, rail stay)       | Yes                                                                                                                                                              |
| 2   | Purchase confirmation instead of the double tap | Yes, for every purchase                                                                                                                                          |
| 3   | Wardrobe shows unowned items                    | **No.** The Wardrobe shows owned items only; a "More in the Shop" tile leads to the Shop.                                                                        |
| 4   | Recent players and a Friends leaderboard        | **Yes, build both in step 6:** two read-only server endpoints (recent opponents from `arena_match_players`; your friends' ratings), no economy or schema change. |
| 5   | Server time for timers                          | Yes: the game server sends its clock; no database change                                                                                                         |
| 6   | Mythical rarity colour                          | **Pink with a foil edge everywhere** (`--r-mythic: #ff8fd8` plus `--r-foil`), replacing the red in cosmetic chips (`cosmetic-fx.css`, `TIER_COLORS`).            |
| 7   | Share card on the player card                   | **Yes, in step 7:** saves your card as a picture, drawn on the device like `share-card.ts` draws match results.                                                  |

No questions are open.

## What was verified and what was not

- Verified: the screenshots and measurements above come from the current
  `main` (`6116a87`) in the visual-test harness at the four sizes (122
  screenshots, no page errors). The mockups render with no page errors and
  pass the checks listed above.
- Not verified: real phones (the island is simulated with CSS insets, as
  `lobby-safe-area.spec.ts` does); real accounts and the live server (the
  harness uses a fake API); frame rates (the machine renders on the CPU).
  Mockup art for auras, frames, entrances and victories are simple stand-ins
  drawn in the mockup; the real screens reuse the game's own pictures.
- Research: web search only (fetching pages was blocked in this session), so
  the notes on other games are from search summaries and the proposal's own
  research; they inform patterns, not details.
