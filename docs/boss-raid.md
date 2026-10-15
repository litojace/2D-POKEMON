# Boss Raid

Choose **Boss Raid · Co-op · 1–4 players**, create a room, and share its code. Every human readies up, confirms the illustrated boss introduction, and chooses a starting rite. Solo needs no AI partner and gets one automatic self-revive. Existing champion selection, custom controls, touch joystick, camera and Socket.IO reconnection remain in use.

## The encounter

Grumblecrag is a separate boss entity with a larger hit radius and custom artwork. Everyone is on one team; friendly fire is disabled. Its health scales with the starting party size and is locked for the run, so leaving cannot lower its health.

The encounter has three HP-gated chapters. Attacks cannot bypass a chapter with burst damage or reflection. Between chapters, pick another raid rite; previous rites remain. Chapter changes rebuild the pillars. An eight-minute active-combat limit bounds a run; drafting and reconnect pauses do not count toward the clear timer. Actual clear lengths and difficulty still need multiplayer balance testing.

- **Charge:** a long ground warning tracks an intended line, then locks. Bait it into a pillar to break armor and expose the core.
- **Ground slam:** a circular warning tells everyone to jump. Jumping avoids its damage.
- **Falling debris:** leave the marked circles before they detonate.
- **Stagger:** armor breaks and player attacks fill a shared meter. At full stagger, the boss stops attacking for six seconds and takes amplified damage. Save ultimates for this opening.

Normal crowd control adds stagger rather than stun-locking the boss. The boss cannot be pushed around by ordinary knockback. Downed teammates can crawl; standing nearby revives them. Being hit interrupts the rescuer, but progress is retained. A solo run gets one self-revive; another down ends it. A wiped co-op team loses.

## Replay variety

Each run rolls a visible trait with a benefit and a drawback:

- Restless attacks faster but exposes a more vulnerable core.
- Fractured adds falling debris but armor breaks last longer.
- Ancient has slower charges and wider shockwaves.

Peril 1 teaches the encounter. Clearing it unlocks Peril 2, adding debris pressure. Peril 3 gradually closes a safe circle in the final chapter. These levels change mechanics rather than increasing the boss health bar. A rare non-weekly run rolls Gilded: golden appearance, 12% more health and a bonus title. Guaranteed cosmetics never require a rare encounter.

Six raid-only rites offer dash wards, shared ultimate energy, extra exposed-core damage, faster revives, low-health damage and ultimate-triggered healing. All champions can contribute; no dedicated healer is required. These upgrades disappear after the run and do not change PvP loadouts.

## Rewards and records

Verified victories grant:

- First clear: **Cragbreaker** title.
- Five clears: **Cragbound** color variant, usable on any champion.
- Peril 3: **Mountain Conqueror** title.
- Peril 3 with no downs: **Mountain aura** cosmetic.
- Gilded clear: **Gilded Cragbreaker** title.

The Bestiary shows boss information, clears, highest Peril, best active-combat time, reward goals and cosmetic equipment. It is available from the home screen, raid lobby, result screen and player profile. Only the server's verified equipped cosmetic is sent to opponents. Cosmetic choices affect appearance, not combat stats.

Raid of the Week is optional. Its week starts Monday at 00:00 UTC; all rooms share the same seed, trait and Peril 2 challenge. Solo, duo, trio and four-player results have separate brackets. Weekly Peril 2 is open without a prior clear. Raid wins never enter the PvP match ledger or Elo rating system.

## Required deployment setup

1. Run `supabase/migrations/007_raids.sql` in Supabase after migrations 001–006.
2. Set **SUPABASE_SERVICE_ROLE_KEY** in the **server's** hosting environment alongside its existing SUPABASE_URL. Never use a VITE_ prefix or put this key in browser configuration. It enables the server-only `arena_record_raid` function.
3. Redeploy the server and client together, since snapshots now support the raid mode.

Core Peril 1 raids work without reward storage, but clears cannot be persisted or higher Perils unlocked until the migration and server credential are configured. The result screen explicitly reports storage failures. A server restart before saving an unavailable reward is not a durable queue; do the setup before inviting players to earn rewards.

Tables have RLS and no direct player write access. Only the service role can submit clears. The database records each run once, grants titles, checks cosmetic ownership, and exposes authenticated progress reads. No new HTTP endpoint accepts client-submitted raid wins.

## Developer validation

`/raid-preview.html` is a local Vite playtest using the actual simulation, boss renderer, UI, floor and champion rig. It has phase/down test buttons and makes no account changes. Like other preview pages, it is not included in the production build or PWA precache.

Run `npm test`, `npm run typecheck`, `npm run build`, and `node scripts/verify-pwa.mjs`. Tests cover solo/four-player sessions, HP phase gates, friendly fire, pillar collision and exposure, stagger, revives and interruption, packet-spam crawling, raid rites, weekly seeds, Peril unlock enforcement, disconnect behavior, verified reward writes, ownership, idempotency and Elo isolation.

The first release deliberately has one boss with procedural artwork. Additional boss artwork, enemy families, optional AI partners and further Peril tiers are future expansions. This is not a claim of tested competitive balance or of finished animated cinematic artwork.
