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
  the grid shows owned _and_ unowned items, unowned ones dimmed with a Shop
  tag. Try several things, then Equip once or Revert.
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
  bottom right and no drawer on phones (not in the mockups yet; drawn in
  step 5 first).
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
in the description. Before every push: `npm run typecheck`, `npm run test`,
`npm run build`, and the visual tests for the screens it changes (Playwright
on `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`).

| #   | Pull request                   | Ships                                                                                                                                                                                                                                                                                                                                                                                                          | Deletes                                                                                                                                                 |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Design foundation              | `ui/tokens.css`, `ui/components.css`, the component functions, the panel/sheet shell that keeps the HUD and rail visible, and a server clock offset: `/api/economy` (and the other hub reads) add the server's `now`, and one `serverNow()` feeds every hub timer. The measuring helper for the visual tests (below). Fixes the "Open Menu → Friends" toast. No screen changes look yet, apart from the shell. | The old dialog sizing and Close rules once every screen uses the shell (the rest go with their screens).                                                |
| 2   | Fitting room (Shop + Wardrobe) | `screens/fitting-room.ts` + `.css`: stage, Shop                                                                                                                                                                                                                                                                                                                                                                | Wardrobe, all four Shop tabs, six Wardrobe slots, unowned items in the Wardrobe, the purchase confirmation, Low graphics path. Existing endpoints only. | Shop, Shop preview, rarity and Missions-card rules in `style.css`; `mobile-store.css`; `wardrobe.css`; `shop-preview-layout.ts` if unused. |
| 3   | Roster                         | `screens/roster.ts` + `.css`: grid, filters, sort, fighter detail, shared with the room's fighter picker.                                                                                                                                                                                                                                                                                                      | Roster and champion-selection rules in `style.css`; `champion-selection.css`; `mobile-panels.css` parts for the picker.                                 |
| 4   | Missions and Journey           | `screens/missions.ts`, `screens/journey.ts` (+ `.css`): the sheet, the season road, weekly goals, levels; server-time timers.                                                                                                                                                                                                                                                                                  | Mission, streak and Adventure rules in `style.css`.                                                                                                     |
| 5   | Raids                          | `screens/raid-hall.ts`, boss page, room, briefing and results styles.                                                                                                                                                                                                                                                                                                                                          | Raid Hub, raid lobby, briefing and result rules in `style.css` (match HUD rules stay).                                                                  |
| 6   | Ranks, Leaderboard and Friends | `screens/ranks.ts`, `screens/friends.ts` (+ `.css`); the pinned row; Friends as a sheet; Recent if approved.                                                                                                                                                                                                                                                                                                   | Ratings, leaderboard and friends rules in `style.css`; `friends.css`.                                                                                   |
| 7   | Player card and profile        | `screens/profile.ts` + `.css`; titles equip on tap (the existing equip call).                                                                                                                                                                                                                                                                                                                                  | Profile, title picker and progress rules in `style.css`; `player-card.css` if unused.                                                                   |

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

## Open questions for the owner

1. **Screens inside the Lobby.** The plan keeps the HUD and rail visible
   under every screen (rule 1) instead of today's full dialogs. OK?
2. **Purchase confirmation.** A confirmation dialog instead of the double
   tap. OK, or keep the double tap for cheap items (under 500 coins)?
3. **Wardrobe shows unowned items** (dimmed, with a Shop tag), as the
   proposal said. OK?
4. **Two read-only server endpoints for step 6:** _Recent players_ in
   Friends (who you played in the last 7 days, from `arena_match_players`)
   and a _Friends_ leaderboard (your friends' ratings; the board today sends
   only the top 20). Build them, or leave both tabs out?
5. **Server time for timers** (step 1): the game server adds `now` to the
   economy, journey and raid responses. No database change. OK?
6. **Rarity colours.** Mythical becomes pink with a foil (`#ff8fd8`)
   everywhere; today it is pink in the Shop and red in cosmetic chips. OK?
7. **Share card** on the player card (a picture of your card): add it in
   step 7, or not now?

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
