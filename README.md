# Element Arena

A real-time, server-authoritative 1v1 elemental creature fighting game. Built with Phaser, TypeScript, Vite, Socket.IO, Express, and Supabase.

Eighteen original creatures, two per element — **Voltkit** and **Coilemur** (Electric), **Cindrake** and **Pyranda** (Fire), **Tidefin** and **Glacelle** (Water), **Auralynx** and **Halcyra** (Aura), **Lumoth** and **Sunbara** (Light), **Mystowl** and **Astrabun** (Psychic), **Terradon** and **Wombolder** (Earth), **Duskveil** and **Shadopus** (Shadow), **Pangrove** and **Mossloth** (Nature). Each has one signature basic attack (no cooldown, server-enforced attack interval), four special skills on cooldowns, plus the universal dash and jump. Mobile controls put the basic attack on the large button with the four skills curving around it.

Every creature is an original articulated shaded-vector rig with authored front, back and side views, animated limb by limb. Rendered sprite sheets or atlases can replace any creature without code changes; see [fighter assets](docs/fighter-assets.md).

## Run

Node.js 22 or newer:

```
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies the game server on port 3001. Configure the separate game Supabase project using [account setup](docs/accounts-setup.md). Sign-in is required to play. Solo test mode is available to regular signed-in players; player/title management remains admin-only.

For production:

```
npm run build
npm start
```

One Express service serves the frontend and Socket.IO on port 3001. Set `ARENA_DIAGNOSTICS=60` to log tick, event-loop, CPU, memory and bandwidth measurements once a minute; see [networking and battle performance](docs/network-performance.md) for the protocol, the load/latency scripts and measured capacity. Deploy both together; rooms are in memory. A deploy lets matches in progress finish on the old server, up to about five minutes, before it stops (see [server updates](docs/server-updates.md)). Rooms still waiting in a lobby do not survive the restart. Two players need distinct accounts.

## Play

Create a private room, share its six-character code, select a fighter, and confirm Ready. Both players acknowledge the introduction before the countdown. Win three rounds to win the match (best of five). Solo practice has a respawning target, character switching, reset, unlimited cooldowns and optional target attacks.

**2v2 Teams:** choose _2v2 Teams_ before _Create private room_ and share the code with three friends. Players pick Blue or Red in the lobby (the host can _Shuffle teams_); the match starts when all four are ready. First team to win three rounds takes it. Attacks never hurt teammates; area attacks hit every enemy inside. A knocked-out player watches their partner until the round ends. If someone leaves mid-match, their partner plays on 2v1; if a whole team leaves, it forfeits. On a time-out the team with more health left (as a share of full health) wins the round.

**Free-for-all:** choose _Free-for-all_ and share the code with two or three friends. Everyone fights everyone; the last fighter standing takes the round (on a time-out, the healthiest still standing). It starts when everyone in the room is ready, with three or four players. Someone who leaves is out, and the match goes on until one fighter remains.

**Party rules:** the host of any room can switch on _Turbo_ (skills recharge twice as fast, ultimates charge 50% faster), _Glass cannon_ (+50% damage), _Orb rain_ (orbs twice as often), _Quick match_ (first to two), _Calm court_ (Coliseum Sands only, no hazards), _Crown Hill_ (hold the centre circle alone for 12 seconds to take the round), _Orb Rush_ (carry gems to your own goal; bank 5 to take the round, big hits knock gems loose), _Fighter roulette_ (a random fighter each round), _Double time_ (60% faster running) and _Giants_ (huge-looking fighters). Everyone readies up again after a change.

**Watching and friends:** enter a room code and choose _Watch this room instead_ to watch a match live without playing (up to six watchers). Menu → _Friends_ shows your 8-character friend code, friend requests and who's online, with _Join_ for open lobbies and _Watch_ for live matches; the result card offers _Add as a friend_ for the people you just played ([migration 005](supabase/migrations/005_friends.sql)).

**EX skills:** press your ultimate before its meter is full (33% or more) to arm an EX version of your next skill: 35% more damage and 20% more reach for a third of the meter. Works the same on keyboard, controller and touch.

**2v2 team-ups:** partners within 260 px both deal 10% more damage, and each gives the other a gift from their element: faster basics (Electric), +6% damage (Fire), 2 health a second (Water), 8% less damage taken (Aura), faster skill recharge (Light), faster ultimate (Psychic), 40% less knockback (Earth), or +10% against slowed, burning or stunned foes (Shadow).

**2v2 tuning:** 2v2 has its own health and basic-attack speed per champion (`TEAM_TUNING`; duels and raids keep the champions' own numbers), re-tuned after the bot fixes: every champion's 2v2 team win rate is 48–55% in bot matches (with the old factors and the fixed bots it was 31–65%); tuned with `npx tsx scripts/balance/tune-teams.ts`, details in [docs/new-champions/README.md](docs/new-champions/README.md#2v2).

**Free-for-all tuning:** free-for-all has its own health and basic-attack speed per champion too (`FFA_TUNING`, and `FFA_THREE_TUNING` for a free-for-all that started with three players), because the last fighter standing wins and melee champions, who take about twice the damage per second of ranged ones, last half as long. Re-tuned after the bot fixes: every champion wins 22–30% of four-player bot free-for-alls (fair is 25%; with the old factors and the fixed bots it was 10–53%) and 30–38% of three-player ones (fair is 33%; it was 25–41%); tuned with `npx tsx scripts/balance/tune-teams.ts --mode ffa [--players 3]`, measured with `npx tsx scripts/balance/measure-ffa.ts`, details in [docs/new-champions/README.md](docs/new-champions/README.md#free-for-all).

**Bot difficulty:** Hard and Normal bots play every champion about equally well relative to the others, so a champion's win rate against bots no longer flips with difficulty (it used to: Cindrake won 27% of Hard bot duels and 74% of Normal ones); every champion's Hard–Normal gap is now under 8 points in bot duels, and with health and attack speed re-tuned for the fixed bots every champion wins 46.5–53.1% of bot duels (with the old numbers they ran 28–66% once Normal stopped flipping them). Normal bots are held back by a per-champion share of "dazed" seconds (`dazeBy` in `apps/server/src/bot.ts`) rather than by weaknesses that only hurt ranged champions. With several opponents, bots pick the nearest, most hurt one they can see instead of the first to join. Details in [docs/new-champions/README.md](docs/new-champions/README.md#bots-hard-and-normal).

**Mastery flair:** reaching a mastery tier with a fighter (Bronze 5, Silver 15, Gold 30, Crystal 60 matches) puts a ring in that tier's colour under them in matches; the server checks it against your records.

**Every round:** in the last minute a ring closes from the whole court to the centre; outside it you lose 14 health a second. Orbs alternate between healing (green, +25% health) and energy (gold, +35% ultimate charge). In 2v2, partners close together get a team-up bonus (below).

**Your name:** your player card (your name in the top bar) has _Change name_. The first change can happen at any time; after that, once every 14 days, counted on the server's clock (the card says how long is left). A name is 1 to 20 characters with at least one letter or number, without control or invisible characters; spaces are tidied. Names aren't unique (the friend code tells players apart), and an admin's rename doesn't count against the 14 days. Needs [migration 066](supabase/migrations/066_display_name_changes.sql) after 065.

**Blocking and names:** tap someone in the Plaza (or use Friends → Recent, or a friend's options) to **Block** or **Report** them. Blocking ends the friendship, stops their requests and invites, and hides them from your Plaza; unblock under Friends → Recent. Player names go through a filter in the database (sign-up names that fail become "Trainer"). Needs [migration 110](supabase/migrations/110_blocks_and_name_filter.sql) after 109; see [account setup](docs/accounts-setup.md#blocking-players-and-the-name-filter).

**Deleting your account:** the bottom of your player card has _Delete account_; type DELETE to confirm. Your login and everything that's yours go for good; matches and raids you played stay for the others under "Deleted player". Administrators are refused (remove them in SQL). Needs [migration 109](supabase/migrations/109_delete_my_account.sql) after 108; see [account setup](docs/accounts-setup.md#deleting-an-account), which also covers turning on Sign in with Apple.

**After the match:** the result card shows a recap (damage dealt and taken, KOs, signature combos, MVP), your all-time record against each opponent, and a _Share result_ picture card. Matches count towards your records, ten achievements (each grants a title), fighter mastery badges on the roster and a monthly season leaderboard (menu → _Leaderboard_) once [migration 004](supabase/migrations/004_matches_achievements.sql) is run; see [account setup](docs/accounts-setup.md). Friends without an account can _Play as a guest_ (Supabase anonymous sign-ins must be switched on).

**Solo vs AI bot:** pick a difficulty (Easy, Normal, Hard) under _Or play solo_ and press _Battle an AI bot_. You get a private best-of-five against a bot playing a random fighter. The bot runs on the server (`apps/server/src/bot.ts`) and sends the same inputs a player would, so cooldowns and rules apply to it unchanged. Difficulty sets its reaction delay, aim spread, target leading, dodging, skill use, how often it pauses its attacks, and whether it saves its ultimate for an opening. Simulated win rates against a newcomer-like player (late aim, misses, pauses) are about Easy 23%, Normal 48% and Hard 99%. Against a sharp player with steady aim they are about 1%, 5% and 76%. It walks around pillars, dodges big shots, jumps ground attacks, and can be fooled by decoys. Rematch is instant; _Back to menu_ leaves the room.

Default controls. Every key can be changed in **Settings → Controls & key bindings** (saved per browser), and each action has a backup key:

| Keyboard and mouse       | Controller (Xbox / PlayStation)        | Action                                  |
| ------------------------ | -------------------------------------- | --------------------------------------- |
| W A S D (or arrows)      | Left stick or D-pad                    | Move                                    |
| Mouse                    | Right stick (centred: nearest foe)     | Aim                                     |
| Left mouse (hold)        | RT / R2 (hold)                         | Basic attack                            |
| Q / E / R (or 1 / 2 / 3) | X / Y / B (Square / Triangle / Circle) | Skills 1–3                              |
| F (or 4)                 | RB / R1                                | Ultimate (skill 4)                      |
| Right mouse (or Shift)   | LB or LT / L1 or L2                    | Dash                                    |
| Space                    | A / Cross                              | Jump (also "I'm ready" on the briefing) |
| Esc / Menu               | Start / Options                        | Preferences and leave room              |

Q, E, R and F sit next to W A S D, so you can cast without letting go of movement. **Aim preview** (the default) draws where a skill will land while you hold its key and casts when you let go; a quick tap still casts right away. Switch to **Instant** to cast on key press. **Aim assist** (off by default) snaps mouse basic attacks onto an opponent close to your cursor; skills always go exactly where you aim.

Mobile uses the left joystick and right skill/action buttons, with a separate bottom toolbar. Android/iOS PWA installation, safe-area layout and landscape play are retained. See [mobile/PWA setup](docs/mobile-pwa.md). An App Store version wraps the same client with Capacitor (landscape-locked, native Sign in with Apple); see [the iPhone app](docs/ios-app.md). Matches and sign-in require an internet connection.

## Balance notes

**Eight new champions (November 2026).** Coilemur (Electric lemur, grappler), Pyranda (Fire red panda, artillery), Glacelle (Water sea angel, frost controller), Halcyra (Aura kingfisher, marksman), Sunbara (Light capybara, support), Astrabun (Psychic moon rabbit, blink duelist), Wombolder (Earth wombat, charger) and Shadopus (Shadow octopus, stealth assassin) join the roster, each with a basic attack, four skills, a signature combo, six rites and three raid champion tricks. They bring new mechanics: pulls, blinks, charges that slam into walls, stealth with an ambush bonus, healing springs and marksman shots that hit harder at range. Health and attack speed were then re-tuned for all sixteen together: bot win rates now run 47–52% (before: 42–60%). Kits, design and numbers are in [docs/new-champions](docs/new-champions/README.md). Apply [migration 052](supabase/migrations/052_sixteen_champions.sql) after 051, or choosing one of them as your portrait, or playing one, is refused. Each has seven Shop skins (migrations 053 and 054).

**Nature element: Pangrove and Mossloth (November 2026).** A ninth element brings the roster to eighteen, two per element again, and both play on mechanics no other champion has. **Pangrove** (a pangolin whose scales are living leaves, armoured burrower) wears three **armour plates** that each stop most of a big hit and grow back out of combat; it zips in on a **grappling tongue**, sheds its plates as a fan of blades (more plates, more blades), **tunnels underground** where nothing can hit it (its mound of dirt gives it away) and bursts up flinging enemies, and its ultimate whips its plates into a **storm of leaf blades** that circles it and bursts outward. **Mossloth** (a three-toed sloth with a moss garden on its back, time gardener) grows **moss while it stands still** (less damage taken, regeneration), plants **seeds that grow** from sprout to bloom and go off when stepped on, slows enemies and their shots in a **time bubble**, **swaps places** with an enemy or its own seedling, and its ultimate blooms every seedling at once. Each has a basic attack, four skills, a signature combo (Latched, Timelocked), six rites, three raid champion tricks, eight Shop skins (a Cyber Mecha Epic each; Void Knight Mythicals Thorn Warden and Blight Sentinel), illustrated icons and battle effects; the roster's overview explains each passive. Bot win rates and the design: [docs/nature-champions.md](docs/nature-champions.md). Apply [migration 070](supabase/migrations/070_eighteen_champions.sql) and then [071](supabase/migrations/071_nature_void_knights_and_cyber.sql) after 069, or choosing one of them as your portrait, or playing one, is refused; they also give them their skins.

**Every kit its own, wave 1 (November 2026).** Seven skills that were copies of another champion's now play on mechanics no one else has. Tidefin's **Gill Siphon** locks a draining stream onto an enemy; Pyranda's **Ember Curtain** is a wall of embers that burns up enemy shots; Halcyra's **Halcyon Rewind** dives back to where it was two seconds ago and wins back some health, and its **Pinning Quill** leashes its target to where it was hit; Wombolder's **Bush Boomerang** hits on the way out and again on the way back, and its **Grudge Thump** taunts enemies into walking at it while it braces against knockback; Shadopus's **Ink Jet** blinds, so basic attacks miss. The waves still to come, the new mechanics and the balance: [docs/unique-kits.md](docs/unique-kits.md).

**Every kit its own, wave 2 (November 2026).** Four of the six stun strikes and two of the four blast-ring ultimates now play differently. Lumoth's **Eyespot Flash** stuns only the enemies looking at it (look away to dodge it), and its **Radiant Flare** turns three rays of light round it like a lighthouse; Coilemur's **Static Clamp** fixes a charge on its target that goes off a moment later and arcs to enemies nearby; Astrabun's **Mochi Pound** is a chain of three pounds; Shadopus's **Kraken Grasp** seizes an enemy and hurls it where you aim (harder into a wall); Auralynx's **Shard Nova** became **Crystal Cage**, a ring of crystal no one and no shot can cross. Shatter Paw, Shell Bash, Overcharge and Tremor keep their roles. Details and balance: [docs/unique-kits.md](docs/unique-kits.md).

**Every kit its own, wave 3 (November 2026).** The slow zones and the "big circle at the aim" ultimates that copied each other now play differently. Tidefin's **Undertow** is a current that sweeps enemies along your aim (jump out of it); Astrabun's **Moon Gravity** makes enemies float, sliding with almost no grip; Coilemur's **Spark Trail** speeds it up and leaves a crackling trail behind it; Cindrake's **Sunfire Pillar** follows your aim for 3 seconds; Mystowl's **Mind Maze** confuses enemies, reversing every way they walk. Mud Mire and Chestnut Storm keep their roles. Details and balance: [docs/unique-kits.md](docs/unique-kits.md).

**Skill revolution, wave A (November 2026).** Skills that did little for their champion, and ultimates that only hurt up close, are replaced, starting with the four that needed it most ([design](docs/skill-revolution.md)). Tidefin's **River Dash** shoots it through enemies on a jet of water (go through someone and it is ready again in 3 seconds), and its **Riptide Wave** is now a wall of water as wide as a quarter of the court that rolls across all of it, carrying enemies into the walls (jump it). Voltkit's **Ball Lightning** flies through enemies, zapping whoever is near, and its new ultimate **Thunderstorm** drops three bolts on the enemy nearest its aim, anywhere on the court (keep changing direction). Duskveil's **Shade Crawl** roots, and its new ultimate **Wraith Hunt** sends a wraith that hunts you through walls and takes you if you are badly hurt (run). Lumoth's **Radiant Flare** hangs like a little sun at the aim, draws enemies in, then bursts and stuns (dash out).

**Skill revolution, wave B (November 2026).** Five more kits get a skill that pulls its weight ([design](docs/skill-revolution.md)). Cindrake's **Magma Leap** leaps over ground attacks and lands in an eruption that burns. Pyranda's **Chestnut Storm** creeps along the aim in five marked blasts, over walls (step out of the line). Mossloth's **Overgrowth** grows a garden at the aim that slows, and roots whoever is still on it at the end. Mystowl's **Hush** silences everyone close for 1.2 seconds: no skills. Astrabun's **Sticky Mochi** grounds the first enemy it hits: no dash, no jump. Cindrake's fire also costs older phones much less to draw.

**Skill revolution, wave C (November 2026).** Glacelle's Hailstone becomes **Black Ice** ([design](docs/skill-revolution.md)): a patch of ice at the aim where enemies slide with almost no grip, so they can't step out of Frost Bloom's freeze in time. The other five champions in the wave (Halcyra, Sunbara, Coilemur, Shadopus, Auralynx) already use every skill, so their kits stay as they are; Normal bots were retuned so each lands near half its duels.

**Creature remodel (November 2026).** Each of the original eight kits was rebuilt around its creature's real animal (Static Glide, Shell Up, Tide Double, Eyespot Flash, Haunted Lantern; the rest renamed), and basic attacks now play at their stated speed (ticks used to round every interval up, costing up to 10%). The kits were tested against the eight new champions being designed, then health and attack speed were re-tuned for the eight that ship: bot win rates now run 48–54% (before: 45–54%). Details and the new numbers are in [docs/creature-remodel.md](docs/creature-remodel.md).

**November 2026 pass (health and basic-attack speed).** Bot round robins on the server simulation (every pairing, 40 games each, Hard and Normal bots, sides swapped every game) showed the fighters had drifted apart. Averaged over both bot settings, win rates ran from 24% (Mystowl) to 73% (Terradon). Each fighter's maximum health and basic-attack interval were tuned toward 50% over repeated rounds of matches. Damage, cooldowns, skills and rite texts are unchanged, and changes stay within about a quarter so no fighter changes role.

| Fighter  | Health    | Basic attack (ms) | Win rate before | After |
| -------- | --------- | ----------------- | --------------- | ----- |
| Voltkit  | 138 → 146 | 280 → 270         | 40%             | 45%   |
| Cindrake | 156 → 144 | 450 → 470         | 66%             | 51%   |
| Tidefin  | 131 → 154 | 260 → 240         | 26%             | 48%   |
| Auralynx | 175 → 171 | 320 → 325         | 57%             | 50%   |
| Lumoth   | 144 → 142 | 300               | 52%             | 51%   |
| Mystowl  | 130 → 148 | 400 → 375         | 24%             | 54%   |
| Terradon | 219 → 195 | 600 → 635         | 73%             | 51%   |
| Duskveil | 150 → 138 | 350 → 365         | 63%             | 50%   |

Win rates are the average of Hard and Normal bots, fighting only each other. The two settings still disagree for some fighters: Cindrake wins 32% against Hard bots, which dodge, but 71% against Normal ones; Mystowl (73% / 36%) and Duskveil (36% / 64%) split the other way. One strength number can only centre the average, so those gaps need kit changes and human playtesting. Health and attack speed also apply in raids, so raid difficulty for these fighters shifts slightly.

The earlier durability pass increased every fighter’s maximum HP by 25% (rounded to whole HP) and Hibernate healing from 60 to 75 HP (Hibernate is now Shell Up). Damage, cooldowns and sleep duration are unchanged. The earlier win-rate results below predate this pass and need fresh playtesting.

Hibernate (since replaced by Shell Up) then got a price: while Terradon slept it took 20% more damage (`STATUS_RULES.sleepVulnerability`), and the HUD shows `SLEEP +20% DMG` so the opponent knows to punish. In 168-match simulations per style, a Terradon that sleeps carelessly mid-fight took about 12% more damage and its win rate fell from 24% to 17%. A Hard bot Terradon that only sleeps when safe was unaffected (72%).

October 2026 pass, tuned with thousands of simulated matches (simple human-like players and Hard bots, every fighter pairing) until every fighter averaged 44–59% wins (before: 10–96%):

- Basic attacks knock back lightly by default (20), so ranged darts no longer shove brawlers away; melee basics barely push (Cindrake 10, Auralynx 12, Terradon 25) so they can chain hits.
- Brawlers hit harder and reach further: Cinder Snap 17 dmg / 170 range, Prism Jab 15 / 130, Boulder Swipe 18 / 150; Ember Gust 6 per tick; Terradon speed 222.
- Mystowl toned down: 104 HP, Mind Dart 9, Focus Ray 18, Thoughtstrike 38.
- Duskveil 120 HP and Lantern Wisp 9; Glint 6; Tide Needle range 640.

**Longer matches (Oct 2026):** every mode is now best of five (first to three round wins). Healing orbs appear 12 s into each round and every 18 s after (one at a time in 1v1, alternating top and bottom centre; both spots in 2v2); the closest hurt fighter who touches one regains 25% of full health, and full-health fighters walk through them. Basic attacks were trimmed (Spark Dart 6, Cinder Snap 15, Tide Needle 5, Prism Jab 13, Glint 6, Mind Dart 8, Boulder Swipe 15, Lantern Wisp 9) so skills and positioning matter more. Simulated fighters stay within 47–53% average win rates.

Fighter cards show **Long range** or **Close range** instead of the basic attack; the basic attack's details stay in the panel below the roster.

## Development and asset checks

```
npm run typecheck
npm test
npm run build
node scripts/verify-pwa.mjs
npx tsx scripts/export-fighters.ts
```

Visual checks run the real client in Chromium with no server (`tests/visual/harness` stands in for the network, account API and Plaza). They check what you'd notice by eye (one fighter on the select screen even with a skin on, each court filling its frame, Settings fitting a phone) and attach a screenshot of every screen to the report:

```
npx playwright install chromium   # once
npm run test:visual
```

CI splits them into thirty shards of about equal running time (`scripts/visual-shards.mjs`, from each test's CI time in `tests/visual/durations.json`), one runner each, and merges the shards' results into one HTML report, the `visual-report` artifact. `node scripts/visual-shards.mjs --plan 30` shows the split. To run one shard locally: `node scripts/visual-shards.mjs 1 30 shard.txt && npm run test:visual -- --test-list shard.txt`.

The asset export regenerates the original SVG prototypes and creates metadata for new folders. Existing manifests and rendered/artist portraits are preserved. `node scripts/generate-icons.mjs` renders the app icon (`scripts/app-icon.svg`, original art) to the iPhone app icon, launch screen and PWA icons.

Development-only previews:

- `/animation-preview.html`: all eighteen fighters, states, directions, timing, interruption, reduced motion.
- `/touch-preview.html`: joystick/buttons/menu and popup behavior without a live match.
- `/mobile-layout-preview.html`: portrait/landscape and compact mobile roster viewports.

## Limits

Balance is provisional. Physical iPhone/Android frame-rate, install/update behavior, and authenticated two-device visual PvP need real-device testing. Current directional art reuses some articulated limb shapes. Production sprite frames, expressions and tightly packed atlases remain artwork requirements. Concealment is a gameplay presentation status; current snapshots still include positions and are not an anti-cheat visibility system.

## Boss Raid

Co-op raids for 1–4 players open from the Raid Hub: a roster of seven bosses, three phases, breakable armor, stagger, revives, raid rites, Perils and cosmetic rewards including Victory celebrations. See [Boss Raid guide and deployment setup](docs/boss-raid.md). Persistent rewards require the migrations through 028 and a server-only Supabase service-role key.

**Adventure:** the home screen’s Adventure card opens player levels 1–100, a free monthly seasonal reward journey, the Daily Spark and weekly arcade (Crown Chase, Meteor Mayhem and Ultimate Overload). XP comes from verified results and daily missions; rewards are cosmetic and automatic. Each level pays 30 coins, or 100 coins from level 50; titles come at levels 5, 30, 50, 60, 75, 90 and 100, and cosmetics every few levels in between, up to the Mythical Lv 55–100 set (Prism frame, Nova entrance, Starlit colors, Solar aura, Eclipse finale, Prismatic laurel and the Element Master frame). The Daily Spark doubles the first 500 XP each Pacific day. Seasons have 30 tiers of 1,200 XP (cosmetics at tiers 5, 12, 20 and 30) from the month after [migration 035](supabase/migrations/035_level_100_daily_spark.sql) runs; earlier months keep 20 tiers of 400 XP. Arcade stays outside the rating ledger. Apply [migration 022](supabase/migrations/022_player_journey.sql) after 021 for saved progression, migration 035 after 034 for levels 51–100, the Daily Spark and the 30-tier season, and [migration 051](supabase/migrations/051_level_cosmetics.sql) after 050 for the Lv 55–100 cosmetics (it also gives them to everyone already past those levels). Apply [migration 028](supabase/migrations/028_retire_raid_modes.sql) after 027 to retire Boss Rush and Raid of the Day while preserving earned rewards. See [the adventure guide](docs/adventure-roadmap.md).

**Plaza:** the hub's _Plaza_ tab is a shared playground (up to 40 players per copy): walk, jump, dash, bounce pads, a stage with an LED wall, a ball pitch with four bots, a dash track with hurdles, a Photo Spot and the Volt Boba truck (free: 30% more speed for 30 s). A polaroid from the Photo Spot can be saved as a picture or kept in the Plaza's photo album (the _Album_ button), which holds the newest 30 on this device only (IndexedDB); nothing is uploaded. The game server moves everyone and runs the ball, lap times and the Orb Shower (the first minute of every quarter hour, UTC; caught orbs count toward the orbs quest). Everyone gets 10 free treats a Pacific day to throw (candy, cupcake, donut, lollipop, cookie). "Plaza today" has five quests paid automatically in shop coins once a Pacific day (goal 2, lap 2, cheers 2, orbs 1, photo 1), and TOP DASH shows the week's best laps. Needs [migration 038](supabase/migrations/038_plaza.sql) after 037.

**The Farm, the Bistro and Gold Leaves (removed):** until November 2026 the hub also had an Elemental Farm tab (crops, weather, orders, animals, decorations, friends' farms; [migration 037](supabase/migrations/037_farm.sql) and many after it), an Element Bistro tab (a restaurant on an isometric floor; [migration 068](supabase/migrations/068_bistro.sql) and many after it) and a second currency, Gold Leaves ([migration 036](supabase/migrations/036_gold_leaves.sql)). They were removed so the game can focus on PvP: [20261119190000_remove_farm_bistro_leaves](supabase/migrations/20261119190000_remove_farm_bistro_leaves.sql) turns every Gold Leaf balance into shop coins once, at the old rate (100 leaves → 5 coins, rounded down), deletes Bistro coins with the Bistro, and drops their tables and functions. Earned farm titles stay with their owners, and the countryside south of the Plaza stays as scenery. The Farm's design is kept as history in [docs/hub-redesign](docs/hub-redesign/PLAN.md).

**Shop, coins and daily missions:** raids, six daily missions, real matches against people (not bots) and the Plaza's daily quests pay coins, granted only by the game server with daily caps. The Shop (home screen, or the coin chip in the header) sells 144 champion skins in four rarities (Common, Rare, Epic, Mythical): eight for each of the eighteen champions, including a Cyber Mecha Epic ([migration 069](supabase/migrations/069_cyber_mecha_epics.sql)); owning all eighteen Void Knights, all eighteen Cyber Mechas or all eight Arcade skins earns that collection's frame ([migrations 071](supabase/migrations/071_collection_reward_frames.sql) and [072](supabase/migrations/072_arcade_reward_frame.sql)) and six all-fighter collections (Colours, Aura, Entrance, Frame, Victory). Mythicals are the Void Knight set ([migration 067](supabase/migrations/067_void_knight_mythicals.sql)), need a 30-win Mythic Trial with their champion and awaken in three stages as you win in them; everyone in the match sees your stage. Skins never change hitboxes, size or timing. Daily missions have their own screen (the home screen's _Daily missions_ card); players who only play alone get missions they can do alone ([migration 014](supabase/migrations/014_missions.sql)). Needs [migration 010](supabase/migrations/010_shop.sql), [011](supabase/migrations/011_collection_bonus.sql) and, for the newest champions' skins, [053](supabase/migrations/053_new_champion_skins.sql), [054](supabase/migrations/054_new_champion_mythicals.sql), [070](supabase/migrations/070_eighteen_champions.sql) and [071](supabase/migrations/071_nature_void_knights_and_cyber.sql); design in [docs/raid-roster-design.md](docs/raid-roster-design.md) §10.
