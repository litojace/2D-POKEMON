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

Create a private room, share its six-character code, select a fighter, and confirm Ready. Both players acknowledge the introduction before the countdown. Win two rounds to win the match. Solo practice has a respawning target, character switching, reset, unlimited cooldowns and optional target attacks.

**Solo vs AI bot:** pick a difficulty (Easy, Normal, Hard) under *Or play solo* and press *Battle an AI bot*. You get a private best-of-three against a bot playing a random fighter. The bot runs on the server (`apps/server/src/bot.ts`) and sends the same inputs a player would, so cooldowns and rules apply to it unchanged. Difficulty sets its reaction delay, aim spread, target leading, dodging, skill use and whether it saves its ultimate for an opening. It walks around pillars, dodges big shots, jumps ground attacks, and can be fooled by decoys. Rematch is instant; *Back to menu* leaves the room.

| Control     | Action                     |
| ----------- | -------------------------- |
| WASD        | Move                       |
| Mouse       | Aim                        |
| Left mouse  | Basic attack               |
| 1 / 2 / 3   | Skills 1–3                 |
| R           | Skill 4                    |
| Right mouse | Dash                       |
| Space       | Jump                       |
| Esc / Menu  | Preferences and leave room |

Mobile uses the left joystick and right skill/action buttons, with a separate bottom toolbar. Android/iOS PWA installation, safe-area layout and landscape play are retained. See [mobile/PWA setup](docs/mobile-pwa.md). Matches and sign-in require an internet connection.

## Balance notes

October 2026 pass, tuned with thousands of simulated matches (simple human-like players and Hard bots, every fighter pairing) until every fighter averaged 44–59% wins (before: 10–96%):

- Basic attacks knock back lightly by default (20), so ranged darts no longer shove brawlers away; melee basics barely push (Cindrake 10, Auralynx 12, Terradon 25) so they can chain hits.
- Brawlers hit harder and reach further: Cinder Snap 17 dmg / 170 range, Prism Jab 15 / 130, Boulder Swipe 18 / 150; Ember Gust 6 per tick; Terradon speed 222.
- Mystowl toned down: 104 HP, Mind Dart 9, Focus Ray 18, Thoughtstrike 38.
- Duskveil 120 HP and Lantern Wisp 9; Glint 6; Tide Needle range 640.

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
