# Element Arena

A real-time, server-authoritative 1v1 elemental creature fighting game. Built with Phaser, TypeScript, Vite, Socket.IO, Express, and Supabase.

Eight original creatures — **Voltkit** (Electric), **Cindrake** (Fire), **Tidefin** (Water), **Auralynx** (Aura), **Lumoth** (Light), **Mystowl** (Psychic), **Terradon** (Earth) and **Duskveil** (Shadow). Each has one signature basic attack (no cooldown, server-enforced attack interval), four special skills on cooldowns, plus the universal dash and jump. Mobile controls put the basic attack on the large button with the four skills curving around it.

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

One Express service serves the frontend and Socket.IO on port 3001. Deploy both together; rooms are in memory. Existing room sessions do not survive a server restart. Two players need distinct accounts.

## Play

Create a private room, share its six-character code, select a fighter, and confirm Ready. Both players acknowledge the introduction before the countdown. Win three rounds to win the match (best of five). Solo practice has a respawning target, character switching, reset, unlimited cooldowns and optional target attacks.

**2v2 Teams:** choose _2v2 Teams_ before _Create private room_ and share the code with three friends. Players pick Blue or Red in the lobby (the host can _Shuffle teams_); the match starts when all four are ready. First team to win three rounds takes it. Attacks never hurt teammates; area attacks hit every enemy inside. A knocked-out player watches their partner until the round ends. If someone leaves mid-match, their partner plays on 2v1; if a whole team leaves, it forfeits. On a time-out the team with more health left (as a share of full health) wins the round.

**Free-for-all:** choose _Free-for-all_ and share the code with two or three friends. Everyone fights everyone; the last fighter standing takes the round (on a time-out, the healthiest still standing). It starts when everyone in the room is ready, with three or four players. Someone who leaves is out, and the match goes on until one fighter remains.

**Party rules:** the host of any room can switch on _Turbo_ (skills recharge twice as fast, ultimates charge 50% faster), _Glass cannon_ (+50% damage), _Orb rain_ (orbs twice as often), _Quick match_ (first to two), _Calm court_ (Stone Court only, no hazards), _Crown Hill_ (hold the centre circle alone for 12 seconds to take the round), _Orb Rush_ (carry gems to your own goal; bank 5 to take the round, big hits knock gems loose), _Fighter roulette_ (a random fighter each round), _Double time_ (60% faster running) and _Giants_ (huge-looking fighters). Everyone readies up again after a change.

**Watching and friends:** enter a room code and choose _Watch this room instead_ to watch a match live without playing (up to six watchers). Menu → _Friends_ shows your 8-character friend code, friend requests and who's online, with _Join_ for open lobbies and _Watch_ for live matches; the result card offers _Add as a friend_ for the people you just played ([migration 005](supabase/migrations/005_friends.sql)).

**EX skills:** press your ultimate before its meter is full (33% or more) to arm an EX version of your next skill: 35% more damage and 20% more reach for a third of the meter. Works the same on keyboard, controller and touch.

**2v2 team-ups:** partners within 260 px both deal 10% more damage, and each gives the other a gift from their element: faster basics (Electric), +6% damage (Fire), 2 health a second (Water), 8% less damage taken (Aura), faster skill recharge (Light), faster ultimate (Psychic), 40% less knockback (Earth), or +10% against slowed, burning or stunned foes (Shadow).

**Mastery flair:** reaching a mastery tier with a fighter (Bronze 5, Silver 15, Gold 30, Crystal 60 matches) puts a ring in that tier's colour under them in matches; the server checks it against your records.

**Every round:** in the last minute a ring closes from the whole court to the centre; outside it you lose 14 health a second. Orbs alternate between healing (green, +25% health) and energy (gold, +35% ultimate charge). In 2v2, partners close together get a team-up bonus (below).

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

Mobile uses the left joystick and right skill/action buttons, with a separate bottom toolbar. Android/iOS PWA installation, safe-area layout and landscape play are retained. See [mobile/PWA setup](docs/mobile-pwa.md). Matches and sign-in require an internet connection.

## Balance notes

The current durability pass increases every fighter’s maximum HP by 25% (rounded to whole HP) and Hibernate healing from 60 to 75 HP. Damage, cooldowns and sleep duration are unchanged. The earlier win-rate results below predate this pass and need fresh playtesting.

Hibernate now has a price: while Terradon sleeps it takes 20% more damage (`STATUS_RULES.sleepVulnerability`), and the HUD shows `SLEEP +20% DMG` so the opponent knows to punish. In 168-match simulations per style, a Terradon that sleeps carelessly mid-fight took about 12% more damage and its win rate fell from 24% to 17%. A Hard bot Terradon that only sleeps when safe was unaffected (72%).

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

The asset export regenerates the original SVG prototypes and creates metadata for new folders. Existing manifests and rendered/artist portraits are preserved. `scripts/generate-icons.py` uses Pillow to regenerate the original elemental PWA emblem.

Development-only previews:

- `/animation-preview.html`: all eight fighters, states, directions, timing, interruption, reduced motion.
- `/touch-preview.html`: joystick/buttons/menu and popup behavior without a live match.
- `/mobile-layout-preview.html`: portrait/landscape and compact mobile roster viewports.

## Limits

Balance is provisional. Physical iPhone/Android frame-rate, install/update behavior, and authenticated two-device visual PvP need real-device testing. Current directional art reuses some articulated limb shapes. Production sprite frames, expressions and tightly packed atlases remain artwork requirements. Concealment is a gameplay presentation status; current snapshots still include positions and are not an anti-cheat visibility system.

## Boss Raid

Co-op raids for 1–4 players feature Grumblecrag, three phases, breakable armor, stagger, revives, raid rites, Perils, weekly brackets and cosmetic rewards. See [Boss Raid guide and deployment setup](docs/boss-raid.md). Persistent rewards require migrations 007 and 008 and a server-only Supabase service-role key.
