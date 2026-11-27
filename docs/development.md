# Development

Running the game locally and in production, the checks to run, development-only previews, and the known limits. Moved here from the README (27 Nov 2026). The repository's rules for changes, tests and merging are in [CLAUDE.md](../CLAUDE.md). Back to the [README](../README.md).

## Run

Node.js 22 or newer:

```
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies the game server on port 3001. Configure the separate game Supabase project using [account setup](accounts-setup.md). Sign-in is required to play. Solo test mode is available to regular signed-in players; player/title management remains admin-only.

For production:

```
npm run build
npm start
```

One Express service serves the frontend and Socket.IO on port 3001. Set `ARENA_DIAGNOSTICS=60` to log tick, event-loop, CPU, memory and bandwidth measurements once a minute; see [networking and battle performance](network-performance.md) for the protocol, the load/latency scripts and measured capacity. Deploy both together; rooms are in memory. A deploy lets matches in progress finish on the old server, up to about five minutes, before it stops (see [server updates](server-updates.md)). Rooms still waiting in a lobby do not survive the restart. Two players need distinct accounts.

## Fighter art

Every creature is an original articulated shaded-vector rig with authored front, back and side views, animated limb by limb. Rendered sprite sheets or atlases can replace any creature without code changes; see [fighter assets](fighter-assets.md).

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

## README pictures

The README's screenshots (`docs/readme/*.webp`) are real screens of the game in Poster, the look players have, on a notched phone in landscape (844×390 at 2x). CLAUDE.md asks for them to be retaken whenever a change alters what they show. They come from the same staged scenes as the App Store screenshots (`scripts/app-store/scenes.ts`), plus the Lobby:

```bash
npx playwright test --config scripts/readme/playwright.config.ts   # all five: lobby, duel, teams, raid, plaza
SCENES=lobby,plaza npx playwright test --config scripts/readme/playwright.config.ts
python3 scripts/readme/to-webp.py lobby plaza   # readme-shots/*.png to docs/readme/*.webp, 150 KB or less
```

In the cloud container, set `PW_CHROMIUM` as CLAUDE.md says. Look at each picture before committing it (no "…", no test overlays, only the harness's made-up names), and keep the README's alt text in step with what the picture shows.
