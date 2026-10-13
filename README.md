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
