# Boss Raid

Choose **Boss Raid · Co-op · 1–4 players** and press **Open the Raid Hub**. The Hub shows this week's seven bosses (one featured each day), today's Raid of the Day, and a card for every boss. Open a boss to see its chapters, attacks, rewards and records, then **Create raid room** (share its code) or **Play solo now**. Only Grumblecrag is built so far; the other six are listed as coming soon (see [the roster design](raid-roster-design.md)).

In a raid room Every human readies up, confirms the illustrated boss introduction, and chooses a starting rite. Solo needs no AI partner and gets one automatic self-revive on Peril 1–2 (none on Peril 3). Existing champion selection, custom controls, touch joystick, camera and Socket.IO reconnection remain in use.

## The encounter

Grumblecrag is a separate boss entity with a larger hit radius and custom artwork. Everyone is on one team; friendly fire is disabled. Its health scales with the starting party size and is locked for the run, so leaving cannot lower its health.

The encounter has three HP-gated chapters. Attacks cannot bypass a chapter with burst damage or reflection. Between chapters, pick another raid rite; previous rites remain. Chapter changes rebuild the pillars. An eight-minute active-combat limit bounds a run; drafting and reconnect pauses do not count toward the clear timer. The pacing target is roughly four to six minutes for a successful run; actual clear lengths and difficulty still need human multiplayer balance testing. All of Grumblecrag's numbers (health, damage, sizes, timings, attack order) live in one data block, `GRUMBLECRAG` in `packages/shared/src/raid.ts`, so tuning or adding a second boss is mostly data.

- **Charge:** a long ground warning follows the marked player for one second, then locks for a 0.7-second dodge window. A crosshair and party status identify the target. Bait it into a pillar to break armor and expose the core.
- **Ground slam:** a circular warning tells everyone to jump. Jumping avoids its damage. Chapters two and three add a second slam 2.3 seconds after the first, allowing the two-second jump cooldown to recover. Stagger and chapter transitions cancel follow-ups.
- **Falling debris:** leave the marked circles before they detonate.
- **Rock volley:** a red cone of stones towards one raider. Leave the cone or put an unbroken pillar between you and the boss.
- **Chasing eruption:** orange vents erupt under one raider two or three times in a row, each where they now stand. Keep running, and away from your team.
- **Shared meteor:** a gold circle follows a marked raider. Its damage is split between everyone standing in it when it lands, so gather on them; pips above the circle show how many are sharing. Alone (or the last raider standing), it turns red and locks in place shortly before landing, so it can be dodged instead.
- **Stagger:** armor breaks and player attacks fill a shared meter. At full stagger, the boss stops attacking for six seconds and takes amplified damage. Save ultimates for this opening.

Chapter one teaches charges, slams, volleys and debris. Chapter two adds the double slam, chasing eruptions and the shared meteor. Chapter three keeps the core exposed but attacks about 15% faster and chains attacks together: the double slam into debris and, from Peril 2, a volley straight into eruptions. The boss sheds a shoulder plate in chapter two and both plates in chapter three; final-phase fragments orbit its enlarged core. Breaking a pillar throws off glowing armor fragments.

Contextual combat prompts shorten after the first two uses of each attack. Downed teammates have a green rescue marker and progress ring. Each chapter's objective is shown during the upgrade break. Every rite choice allows 15 seconds, and all choices confirmed ends the break early. Landscape screens show three choices side by side; the team build details can be expanded below them.

Normal crowd control adds stagger rather than stun-locking the boss. The boss cannot be pushed around by ordinary knockback. Downed teammates can crawl; standing nearby revives them. Being hit interrupts the rescuer, but progress is retained. A solo run gets one self-revive on Peril 1–2; another down ends it. Solo Peril 3 has no self-revive: one down ends the run. A wiped co-op team loses.

## Replay variety

Each run rolls a visible trait with a benefit and a drawback:

- Restless attacks faster but exposes a more vulnerable core.
- Fractured adds falling debris but armor breaks last longer.
- Ancient has slower charges and wider shockwaves.

Peril 1 teaches the encounter. Clearing it unlocks Peril 2: extra debris, longer eruption chains, volley-into-eruption combinations and 10% more boss damage. Peril 3 adds eruptions to chapter one, gradually closes a safe circle in the final chapter and deals 20% more damage. The boss health bar is the same at every Peril. A rare non-weekly run rolls Gilded: golden appearance, 12% more health and a bonus title. Guaranteed cosmetics never require a rare encounter.

Six raid-only rites offer dash wards, shared ultimate energy, extra exposed-core damage, faster revives, low-health damage and ultimate-triggered healing. All champions can contribute; no dedicated healer is required. Offers vary by party seat, remain deterministic for weekly runs, and exclude owned rites. The upgrade panel shows everyone’s current build. These upgrades disappear after the run and do not change PvP loadouts.

## Champion tricks

Some champions' skills answer Grumblecrag's attacks; the briefing lists the party's:

- **Auralynx · Mirror Guard** blocks the rock volley completely and adds stagger.
- **Mystowl · Ward** up inside a shared meteor cuts the damage for everyone sharing it by 35%.
- **Terradon** stops a charge head-on with its shell, taking half damage and staggering the boss.
- **Lumoth · Kindle** cast beside a fallen ally fills half of their revive at once (and earns revive credit).

## Teamwork tools

- **Team signals:** *Stack on me*, *Revive me* and *Bait here*, from the buttons on the left of the arena or the **Z**, **X** and **C** keys (when those keys aren't bound to anything). A marker appears over your head for a few seconds and teammates see it in the callout line. One signal per second.
- **What downed you:** the downed banner names the attack that downed you and how to avoid it. A lost run's result screen gives the tip for the attack that downed the team most.
- **Stand-ins:** if a raider disconnects mid-run while at least one other player is still connected, an AI plays their champion (dodging telegraphs, stacking for meteors, reviving allies) until they reconnect, instead of pausing everyone. A solo raid still pauses. If they don't return in time, their seat is dropped as before.
- **Practice:** in the raid lobby, the host can open *Practice the boss's attacks*. The boss repeats one chosen attack; nobody is hurt and the boss can't be damaged, and a bar counts hits and dodges. The host can switch attacks or leave practice for the lobby. Practice is never saved.

## Rewards and records

Rewards are defined as rules (`RAID_REWARDS` in `packages/shared/src/raid.ts`, seeded identically into `arena_raid_rewards` by migration 009; a test keeps them in step). The database decides what you've earned from your saved runs. Grumblecrag's ladder:

| Goal | Reward |
|---|---|
| First clear | **Cragbreaker** title |
| 5 clears | **Cragbound** colors (skin) |
| 10 clears | **Cragstone** skin |
| Clear Peril 2 | **Mountainborn** entrance |
| Clear Peril 3 | **Mountain Conqueror** title + **Conqueror** frame |
| Peril 3, no downs | **Mountain aura** |
| Feat: every charge in a run hits a pillar (3 or more charges) | **Rockslide Flex** victory |
| Peril 2 solo in under 3:30 | **Avalanche** title |
| Peril 3 solo (no self-revive) | **Lone Mountain** title |
| Rare Gilded clear | **Gilded Cragbreaker** title |
| 25 pillars baited (wins and losses) | **Pillar Breaker** title |
| 20 revives helped (wins and losses) | **Mountain Guardian** title |
| 100 clears across every boss | **Boss Hunter** title |

Solo Peril 3 clears from before migration 009 (when a self-revive was still possible) count for Lone Mountain only if nobody went down.

Skin, aura, entrance, frame and **victory** are separate slots, equipped independently on a boss's Rewards tab in the Raid Hub, for all fighters. A Victory replaces your champion's own celebration when you win a round or a raid (Rockslide Flex: a pile of rocks rises under you and you flex on top while pebbles bounce away). Every reward is cosmetic: no stat bonuses, so experienced players never make the raid easier. The Bestiary lists every reward with its exact progress.

Results show actual boss damage, revive assists, and pillar baits per player, alongside team totals, plus a role for whoever led each: Heavy Hitter, Medic and Bait Master. Everyone who contributed to a completed rescue receives revive credit; solo self-revives appear only in the team total. Damage excludes overkill and phase-gated damage. Pillars credit the marked player whose charge broke them. Contribution counters reset on retry and are not a competitive leaderboard.

After the server confirms reward storage, the result screen fetches the player's saved progress and shows the next milestone. Failed storage never displays invented progress. Run again keeps the party, champions and challenge, skips the already-seen introduction, and opens fresh starting rites after everyone confirms. Changing champion or difficulty returns the party to the lobby.

The Raid Hub boss page shows boss information, clears, highest Peril, best active-combat time, reward goals and cosmetic equipment. It is available from the home screen, raid lobby, result screen and player profile. Only the server's verified equipped cosmetic is sent to opponents. Cosmetic choices affect appearance, not combat stats.

**Raid of the Day** is optional and replaces Raid of the Week. Each day has a featured boss: Sun Prismatail, Mon Gloomshade, Tue Emberwing, Wed Somnara, Thu Storm Twins, Fri Tidewyrm, Sat Grumblecrag. Until a boss is built, a built boss stands in on its day. The day changes at **midnight Pacific time** (daylight saving included); the server decides the day, so everyone agrees. All rooms that day share the same seed, trait and Peril 2 challenge, and solo, duo, trio and four-player clears have separate daily boards. The host ticks *Raid of the Day* in the lobby (or presses *Raid today's boss* in the Hub). If midnight passes while a party waits in the lobby, the run simply becomes a normal run. Raid wins never enter the PvP match ledger or Elo rating system.

## Required deployment setup

1. Run `supabase/migrations/007_raids.sql` in Supabase after migrations 001–006, then `supabase/migrations/008_raid_progress.sql`, then `supabase/migrations/009_raid_hub.sql` (it must be the last file run; if you ever re-run an older raid migration, run 009 again afterwards).
2. Set **SUPABASE_SERVICE_ROLE_KEY** in the **server's** hosting environment alongside its existing SUPABASE_URL. Never use a VITE_ prefix or put this key in browser configuration. It enables the server-only `arena_record_raid` function.
3. Redeploy the server and client together, since snapshots now support the raid mode.

Core Peril 1 raids work without reward storage, but clears cannot be persisted or higher Perils unlocked until the migration and server credential are configured. The result screen explicitly reports storage failures. A server restart before saving an unavailable reward is not a durable queue; do the setup before inviting players to earn rewards.

Migration 008 also saves real attempts that were lost (20 seconds or more of combat; practice never), with the chapter reached, per-player stats and which attacks downed people. Losses never count as clears or reach the weekly board. To see it, run this in Supabase's SQL Editor:

```sql
-- How far runs get, by Peril and party size.
select peril, party_size, result, phase_reached, count(*), round(avg(seconds)) as avg_seconds
from arena_raid_runs group by 1, 2, 3, 4 order by 1, 2, 3, 4;
-- Which attacks down people most.
select key as attack, sum(value::int) as downs
from arena_raid_runs, jsonb_each_text(down_causes) group by 1 order by 2 desc;
```

(Signed-in admins can also call `arena_raid_balance()`, which returns the same summary.)

Tables have RLS and no direct player write access. Only the service role can submit clears. The database records each run once, grants titles, checks cosmetic ownership, and exposes authenticated progress reads. No new HTTP endpoint accepts client-submitted raid wins.

## Developer validation

`/raid-preview.html` is a local Vite playtest using the actual simulation, boss renderer, UI, floor and champion rig. It has phase/down test buttons and makes no account changes. Like other preview pages, it is not included in the production build or PWA precache.

Run `npm test`, `npm run typecheck`, `npm run build`, and `node scripts/verify-pwa.mjs`. Tests cover solo/four-player sessions, HP phase gates, friendly fire, pillar collision and exposure, stagger, revives and interruption, packet-spam crawling, raid rites, weekly seeds, Peril unlock enforcement, disconnect behavior, verified reward writes, ownership, idempotency and Elo isolation.

The first release deliberately has one boss with procedural artwork. Additional boss artwork, enemy families, optional AI partners and further Peril tiers are future expansions. This is not a claim of tested competitive balance or of finished animated cinematic artwork.
