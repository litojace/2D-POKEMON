# Match reports

Newest report: 2026-11-21 23:53 UTC. From the game server's log (`scripts/perf/export-perf-reports.mjs` on `main`). One row per player's device per match; times are UTC. No accounts or names are kept.

## Needs attention

- **2026-11-21 23:53**, astrabun against duskveil (bot, hard) (match `54d81z`):
  - drawing slow: 50 fps, 13.6% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 2 hit(s) landed while you were drawn over 24 px away (largest 301 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 59.3 times a minute (up to 13 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-21 23:51**, shadopus against wombolder (bot, hard) (match `zav9qd`):
  - slow connection: ping 45 ms, slowest 5% 186 ms. The player's network: compare other players at the same time before changing the game.
  - drawing slow: 58.8 fps, 6.6% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 7.3 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 23 shadopus wombolder`.
  - Wi-Fi held the phone's inputs 76.4 times a minute (up to 5 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-21 07:59**, duskveil against halcyra (bot, hard) (match `e9lb01`):
  - Wi-Fi held the phone's inputs 13.1 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-21 07:57**, duskveil against tidefin (bot, hard) (match `17lb14`):
  - Wi-Fi held the phone's inputs 29.2 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 20:50**, pangrove against pangrove (bot, hard) (match `xyfy1p`):
  - 10 hit(s) landed while you were drawn over 24 px away (largest 60 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 44.1 times a minute (up to 1 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 20:49**, pangrove against pangrove (bot, hard) (match `c9bily`):
  - 30 hit(s) landed while you were drawn over 24 px away (largest 101 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-20 20:47**, glacelle against mystowl (bot, hard) (match `fuhmr0`):
  - 34 hit(s) landed while you were drawn over 24 px away (largest 109 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 60.8 times a minute (up to 1 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 20:34**, glacelle against pangrove (bot, hard) (match `q74wjt`):
  - 24 hit(s) landed while you were drawn over 24 px away (largest 70 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 24 times a minute (up to 1 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 20:33**, glacelle against pangrove (bot, hard) (match `dw49lo`):
  - 37 hit(s) landed while you were drawn over 24 px away (largest 113 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 59.1 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 18:11**, duskveil against gloomshade (raid boss) (match `tnte3i`):
  - 1 hit(s) landed while you were drawn over 24 px away (largest 33 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 40.7 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 18:05**, tidefin against grumblecrag (raid boss) (match `ndq8vy`):
  - 1 hit(s) landed while you were drawn over 24 px away (largest 30 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-20 09:17**, mossloth against grumblecrag (raid boss) (match `u0jy1t`):
  - 95 hit(s) landed while you were drawn over 24 px away (largest 152 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 44.3 times a minute (up to 5 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 09:05**, mossloth against halcyra (bot, hard) (match `md3367`):
  - 20 hit(s) landed while you were drawn over 24 px away (largest 36 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 45.6 times a minute (up to 1 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 04:42**, voltkit against glacelle (bot, easy) (match `oo2zgw`):
  - slow connection: ping 100 ms, slowest 5% 158 ms. The player's network: compare other players at the same time before changing the game.
  - 9 hit(s) landed while you were drawn over 24 px away (largest 47 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 80.8 times a minute (up to 12 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:52**, shadopus against astrabun (match `cgvp4f`):
  - 27 hit(s) landed while you were drawn over 24 px away (largest 73 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 26.8 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:50**, shadopus against astrabun (match `mhwinq`):
  - 16 hit(s) landed while you were drawn over 24 px away (largest 104 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 33.7 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:49**, shadopus against astrabun (match `6px5s7`):
  - 29 hit(s) landed while you were drawn over 24 px away (largest 61 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 22.2 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:49**, astrabun against shadopus (match `6px5s7`):
  - 7.1 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 22 astrabun shadopus`.
  - 16 hit(s) landed while you were drawn over 24 px away (largest 208 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-20 02:47**, astrabun against shadopus (match `ower6s`):
  - 18.2 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 23 astrabun shadopus`.
  - 20 hit(s) landed while you were drawn over 24 px away (largest 356 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-20 02:47**, shadopus against astrabun (match `ower6s`):
  - 30 hit(s) landed while you were drawn over 24 px away (largest 103 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 19.1 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:45**, astrabun against shadopus (match `bsfkul`):
  - 13.3 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 23 astrabun shadopus`.
  - 20 hit(s) landed while you were drawn over 24 px away (largest 434 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 12.7 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:45**, shadopus against astrabun (match `bsfkul`):
  - 33 hit(s) landed while you were drawn over 24 px away (largest 83 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 32.4 times a minute (up to 4 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:42**, shadopus against astrabun (match `iqrx1w`):
  - 32 hit(s) landed while you were drawn over 24 px away (largest 81 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 27.1 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:42**, astrabun against shadopus (match `iqrx1w`):
  - 7.2 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 23 astrabun shadopus`.
  - 20 hit(s) landed while you were drawn over 24 px away (largest 423 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-20 02:40**, shadopus against astrabun (match `xp1or1`):
  - 26 hit(s) landed while you were drawn over 24 px away (largest 99 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 29.2 times a minute (up to 4 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:40**, astrabun against shadopus (match `xp1or1`):
  - 7.5 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 22 astrabun shadopus`.
  - 19 hit(s) landed while you were drawn over 24 px away (largest 201 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-20 02:38**, mystowl against coilemur (match `yzckw9`):
  - 14 hit(s) landed while you were drawn over 24 px away (largest 71 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - the server's ticks ran up to 17.3 ms late (95th percentile; steps took 0.7 ms): the instance is busy or CPU-throttled. Run it with ARENA_DIAGNOSTICS=60.
- **2026-11-20 02:38**, coilemur against mystowl (match `yzckw9`):
  - 53 hit(s) landed while you were drawn over 24 px away (largest 100 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - the server's ticks ran up to 17.3 ms late (95th percentile; steps took 0.7 ms): the instance is busy or CPU-throttled. Run it with ARENA_DIAGNOSTICS=60.
  - Wi-Fi held the phone's inputs 12.1 times a minute (up to 1 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:36**, coilemur against mystowl (match `4di17p`):
  - 43 hit(s) landed while you were drawn over 24 px away (largest 80 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-20 02:36**, mystowl against coilemur (match `4di17p`):
  - 12 hit(s) landed while you were drawn over 24 px away (largest 306 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-20 02:34**, coilemur against mystowl (match `qvqzhz`):
  - 55 hit(s) landed while you were drawn over 24 px away (largest 143 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 18.4 times a minute (up to 4 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:34**, mystowl against coilemur (match `qvqzhz`):
  - 32 hit(s) landed while you were drawn over 24 px away (largest 107 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-20 02:31**, coilemur against mystowl (match `btljrs`):
  - 55 hit(s) landed while you were drawn over 24 px away (largest 100 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-20 02:31**, mystowl against coilemur (match `btljrs`):
  - 24 hit(s) landed while you were drawn over 24 px away (largest 114 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-20 02:28**, mystowl against coilemur (match `e62jbx`):
  - 29 hit(s) landed while you were drawn over 24 px away (largest 516 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 42.1 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:28**, coilemur against mystowl (match `e62jbx`):
  - 48 hit(s) landed while you were drawn over 24 px away (largest 97 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-20 02:26**, coilemur against mystowl (match `dm8rd6`):
  - 7.4 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 25 coilemur mystowl`.
  - 30 hit(s) landed while you were drawn over 24 px away (largest 182 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - the phone sent 31.91 inputs a second, not 30: its input clock (the scene's accumulator in main.ts) drifted or lost time.
  - 31 of the player's inputs were folded into another's step (steps lost, each a jump): more inputs than ticks. See Arena.drainInputs and docs/network-performance.md, section 16.
  - Wi-Fi held the phone's inputs 13.8 times a minute (up to 14 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:26**, mystowl against coilemur (match `dm8rd6`):
  - 18 hit(s) landed while you were drawn over 24 px away (largest 97 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 66.1 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:24**, coilemur against mystowl (match `pw5628`):
  - 50 hit(s) landed while you were drawn over 24 px away (largest 111 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 16.1 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:24**, mystowl against coilemur (match `pw5628`):
  - 36 hit(s) landed while you were drawn over 24 px away (largest 393 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 83.6 times a minute (up to 4 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:21**, mystowl against coilemur (match `1de8di`):
  - 33 hit(s) landed while you were drawn over 24 px away (largest 363 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 69.8 times a minute (up to 7 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:21**, coilemur against mystowl (match `1de8di`):
  - 53 hit(s) landed while you were drawn over 24 px away (largest 125 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 24.9 times a minute (up to 1 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:16**, coilemur against auralynx (match `5xvb3k`):
  - 19 hit(s) landed while you were drawn over 24 px away (largest 48 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 10.8 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:16**, auralynx against coilemur (match `5xvb3k`):
  - 17 hit(s) landed while you were drawn over 24 px away (largest 93 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 94.9 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:14**, coilemur against auralynx (match `ztwarz`):
  - 29 hit(s) landed while you were drawn over 24 px away (largest 76 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 16.3 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:14**, auralynx against coilemur (match `ztwarz`):
  - 37 hit(s) landed while you were drawn over 24 px away (largest 366 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 96.7 times a minute (up to 9 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:11**, coilemur against auralynx (match `p6556o`):
  - 14 hit(s) landed while you were drawn over 24 px away (largest 81 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 12.3 times a minute (up to 1 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:11**, auralynx against coilemur (match `p6556o`):
  - 15 hit(s) landed while you were drawn over 24 px away (largest 192 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 82.5 times a minute (up to 4 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:10**, coilemur against auralynx (match `6w407g`):
  - 28 hit(s) landed while you were drawn over 24 px away (largest 49 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - the server's ticks ran up to 15.2 ms late (95th percentile; steps took 0.8 ms): the instance is busy or CPU-throttled. Run it with ARENA_DIAGNOSTICS=60.
  - Wi-Fi held the phone's inputs 22.4 times a minute (up to 1 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.

## Latest matches

| Time (UTC) | Match | Mode | You | Against | Ping (slowest 5%) | Lead | Late updates | Jumps | Hits off-screen | Skill confirm | FPS | Stutter | Graphics | Device | Build |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-21 23:53 | `54d81z` | duel vs bot | astrabun | duskveil (bot, hard) | 47 ms 🟢 (54) | 168 ms | 0.2% | 34.5/min (max 214 px) | ⚠️ 2 (max 301 px) | 65 ms | 50 | 13.6% | low (low) | ios app, 4 cores, 59 Hz | 17b018b |
| 2026-11-21 23:51 | `zav9qd` | duel vs bot | shadopus | wombolder (bot, hard) | 45 ms 🟢 (186) | 160 ms | 0.2% | 65.5/min (max 189 px), ⚠️ 7.3 unexplained | 0 | 74 ms | 58.8 | 6.6% | low (low) | ios app, 4 cores, 48 Hz | 17b018b |
| 2026-11-21 07:59 | `e9lb01` | duel vs bot | duskveil | halcyra (bot, hard) | 63 ms 🟢 (72) | 191 ms | 0.0% | 23.9/min (max 144 px) | 0 | 87 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 7f7941b |
| 2026-11-21 07:57 | `17lb14` | duel vs bot | duskveil | tidefin (bot, hard) | 64 ms 🟢 (75) | 191 ms | 0.0% | 35.8/min (max 110 px), ⚠️ 1.8 unexplained | 0 | 88 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 7f7941b |
| 2026-11-20 20:50 | `xyfy1p` | duel vs bot | pangrove | pangrove (bot, hard) | 68 ms 🟢 (73) | 197 ms | 0.0% | 64.9/min (max 119 px) | ⚠️ 10 (max 60 px) | 87 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 20:49 | `c9bily` | duel vs bot | pangrove | pangrove (bot, hard) | 71 ms 🟢 (76) | 223 ms | 0.0% | 78.8/min (max 154 px) | ⚠️ 30 (max 101 px) | 110 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 20:47 | `fuhmr0` | duel vs bot | glacelle | mystowl (bot, hard) | 66 ms 🟢 (73) | 191 ms | 0.1% | 30.4/min (max 180 px), ⚠️ 1.1 unexplained | ⚠️ 34 (max 109 px) | 88 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 20:34 | `q74wjt` | duel vs bot | glacelle | pangrove (bot, hard) | 64 ms 🟢 (69) | 216 ms | 0.0% | 41.1/min (max 140 px) | ⚠️ 24 (max 70 px) | 171 ms | 58.8 | 0.1% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 20:33 | `dw49lo` | duel vs bot | glacelle | pangrove (bot, hard) | 71 ms 🟢 (79) | 203 ms | 0.0% | 63.9/min (max 159 px) | ⚠️ 37 (max 113 px) | 120 ms | 58.8 | 0.1% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 18:11 | `tnte3i` | raid | duskveil | gloomshade (raid boss) | 62 ms 🟢 (66) | 189 ms | 0.1% | 0/min | ⚠️ 1 (max 33 px) | 73 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | 334f311 |
| 2026-11-20 18:07 | `h1zruh` | raid | duskveil | grumblecrag (raid boss) | 64 ms 🟢 (70) | 211 ms | 0.0% | 0.8/min (max 12 px), ⚠️ 0.8 unexplained | 0 | 107 ms | 58.8 | 0.2% | high (auto) | ios app, 4 cores, 59 Hz | 334f311 |
| 2026-11-20 18:05 | `ndq8vy` | raid | tidefin | grumblecrag (raid boss) | 66 ms 🟢 (72) | 209 ms | 0.1% | 6.5/min (max 159 px) | ⚠️ 1 (max 30 px) | 104 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | 334f311 |
| 2026-11-20 09:17 | `u0jy1t` | raid | mossloth | grumblecrag (raid boss) | 78 ms 🟢 (87) | 192 ms | 0.1% | 23.8/min (max 284 px), ⚠️ 1.6 unexplained | ⚠️ 95 (max 152 px) | 92 ms | 58.8 | 0.1% | high (auto) | ios app, 4 cores, 59 Hz | e1e9c75 |
| 2026-11-20 09:05 | `md3367` | duel vs bot | mossloth | halcyra (bot, hard) | 74 ms 🟢 (77) | 194 ms | 0.0% | 20.3/min (max 329 px) | ⚠️ 20 (max 36 px) | 82 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | e1e9c75 |
| 2026-11-20 04:42 | `oo2zgw` | duel vs bot | voltkit | glacelle (bot, easy) | 100 ms 🟡 (158) | 227 ms | 2.1% | 58.2/min (max 27 px) | ⚠️ 9 (max 47 px) | 120 ms | 58.8 | 0.1% | high (auto) | ios app, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:52 | `cgvp4f` | duel | shadopus | astrabun | 48 ms 🟢 (56) | 167 ms | 0.4% | 32.7/min (max 145 px) | ⚠️ 27 (max 73 px) | 64 ms | 59.9 | 0.6% | high (auto) | android, 8 cores, 8 GB, 119 Hz | 39db09a |
| 2026-11-20 02:50 | `mhwinq` | duel | shadopus | astrabun | 47 ms 🟢 (60) | 168 ms | 0.2% | 18.5/min (max 150 px) | ⚠️ 16 (max 104 px) | 66 ms | 59.9 | 0.5% | high (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:49 | `6px5s7` | duel | shadopus | astrabun | 47 ms 🟢 (62) | 178 ms | 0.2% | 25.4/min (max 150 px) | ⚠️ 29 (max 61 px) | 70 ms | 59.9 | 0.3% | high (auto) | android, 8 cores, 8 GB, 119 Hz | 39db09a |
| 2026-11-20 02:49 | `6px5s7` | duel | astrabun | shadopus | 44 ms 🟢 (47) | 176 ms | 0.0% | 33.2/min (max 305 px), ⚠️ 7.1 unexplained | ⚠️ 16 (max 208 px) | 71 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:47 | `ower6s` | duel | astrabun | shadopus | 45 ms 🟢 (50) | 181 ms | 0.0% | 48.2/min (max 373 px), ⚠️ 18.2 unexplained | ⚠️ 20 (max 356 px) | 72 ms | 58.8 | 0.1% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:47 | `ower6s` | duel | shadopus | astrabun | 47 ms 🟢 (69) | 191 ms | 0.3% | 35.6/min (max 40 px) | ⚠️ 30 (max 103 px) | 95 ms | 59.9 | 0.4% | high (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:45 | `bsfkul` | duel | astrabun | shadopus | 45 ms 🟢 (56) | 179 ms | 0.1% | 40.6/min (max 397 px), ⚠️ 13.3 unexplained | ⚠️ 20 (max 434 px) | 72 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:45 | `bsfkul` | duel | shadopus | astrabun | 47 ms 🟢 (55) | 181 ms | 0.7% | 22.9/min (max 155 px) | ⚠️ 33 (max 83 px) | 69 ms | 59.9 | 0.6% | high (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:42 | `iqrx1w` | duel | shadopus | astrabun | 46 ms 🟢 (55) | 177 ms | 0.6% | 23.8/min (max 150 px) | ⚠️ 32 (max 81 px) | 72 ms | 59.9 | 0.6% | high (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:42 | `iqrx1w` | duel | astrabun | shadopus | 46 ms 🟢 (67) | 177 ms | 0.3% | 24.4/min (max 383 px), ⚠️ 7.2 unexplained | ⚠️ 20 (max 423 px) | 72 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:40 | `xp1or1` | duel | shadopus | astrabun | 46 ms 🟢 (51) | 178 ms | 0.6% | 23.2/min (max 150 px) | ⚠️ 26 (max 99 px) | 74 ms | 59.9 | 0.4% | high (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:40 | `xp1or1` | duel | astrabun | shadopus | 44 ms 🟢 (50) | 167 ms | 0.1% | 28.4/min (max 224 px), ⚠️ 7.5 unexplained | ⚠️ 19 (max 201 px) | 57 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:38 | `yzckw9` | duel | mystowl | coilemur | 43 ms 🟢 (55) | 163 ms | 0.0% | 25.8/min (max 457 px), ⚠️ 1.6 unexplained | ⚠️ 14 (max 71 px) | 58 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:38 | `yzckw9` | duel | coilemur | mystowl | 47 ms 🟢 (58) | 192 ms | 0.1% | 46/min (max 160 px), ⚠️ 0.8 unexplained | ⚠️ 53 (max 100 px) | 80 ms | 59.9 | 0.3% | high (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:36 | `4di17p` | duel | coilemur | mystowl | 48 ms 🟢 (61) | 191 ms | 0.4% | 42.5/min (max 160 px) | ⚠️ 43 (max 80 px) | 77 ms | 59.9 | 0.2% | high (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:36 | `4di17p` | duel | mystowl | coilemur | 45 ms 🟢 (57) | 160 ms | 0.0% | 24.7/min (max 311 px) | ⚠️ 12 (max 306 px) | 55 ms | 58.8 | 0.1% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:34 | `qvqzhz` | duel | coilemur | mystowl | 46 ms 🟢 (63) | 188 ms | 0.3% | 39.9/min (max 160 px), ⚠️ 0.5 unexplained | ⚠️ 55 (max 143 px) | 86 ms | 59.9 | 0.3% | high (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:34 | `qvqzhz` | duel | mystowl | coilemur | 45 ms 🟢 (56) | 161 ms | 0.2% | 28.1/min (max 200 px) | ⚠️ 32 (max 107 px) | 60 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:31 | `btljrs` | duel | coilemur | mystowl | 47 ms 🟢 (53) | 191 ms | 0.3% | 37.3/min (max 160 px), ⚠️ 1.6 unexplained | ⚠️ 55 (max 100 px) | 79 ms | 59.9 | 0.2% | high (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:31 | `btljrs` | duel | mystowl | coilemur | 44 ms 🟢 (57) | 167 ms | 0.2% | 26.6/min (max 347 px), ⚠️ 0.5 unexplained | ⚠️ 24 (max 114 px) | 62 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:28 | `e62jbx` | duel | mystowl | coilemur | 47 ms 🟢 (57) | 184 ms | 1.7% | 29.4/min (max 543 px), ⚠️ 0.7 unexplained | ⚠️ 29 (max 516 px) | 94 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:28 | `e62jbx` | duel | coilemur | mystowl | 47 ms 🟢 (49) | 191 ms | 0.5% | 38/min (max 160 px), ⚠️ 1.3 unexplained | ⚠️ 48 (max 97 px) | 79 ms | 59.9 | 0.3% | high (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:26 | `dm8rd6` | duel | coilemur | mystowl | 49 ms 🟢 (57) | 197 ms | 0.1% | 53.1/min (max 214 px), ⚠️ 7.4 unexplained | ⚠️ 30 (max 182 px) | 79 ms | 59.9 | 0.1% | high (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:26 | `dm8rd6` | duel | mystowl | coilemur | 52 ms 🟢 (69) | 195 ms | 3.1% | 22/min (max 70 px), ⚠️ 1 unexplained | ⚠️ 18 (max 97 px) | 79 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:24 | `pw5628` | duel | coilemur | mystowl | 46 ms 🟢 (52) | 191 ms | 0.3% | 36.7/min (max 160 px), ⚠️ 1.5 unexplained | ⚠️ 50 (max 111 px) | 77 ms | 59.9 | 0.2% | high (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:24 | `pw5628` | duel | mystowl | coilemur | 54 ms 🟢 (70) | 186 ms | 3.4% | 27.2/min (max 413 px), ⚠️ 1 unexplained | ⚠️ 36 (max 393 px) | 79 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:21 | `1de8di` | duel | mystowl | coilemur | 52 ms 🟢 (65) | 196 ms | 3.8% | 33.8/min (max 356 px), ⚠️ 1.4 unexplained | ⚠️ 33 (max 363 px) | 112 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:21 | `1de8di` | duel | coilemur | mystowl | 45 ms 🟢 (50) | 187 ms | 0.1% | 46.4/min (max 160 px), ⚠️ 0.7 unexplained | ⚠️ 53 (max 125 px) | 110 ms | 59.9 | 0.1% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:16 | `5xvb3k` | duel | coilemur | auralynx | 63 ms 🟢 (73) | 199 ms | 0.4% | 20.1/min (max 182 px) | ⚠️ 19 (max 48 px) | 114 ms | 59.9 | 0.5% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:16 | `5xvb3k` | duel | auralynx | coilemur | 51 ms 🟢 (62) | 165 ms | 3.4% | 31.6/min (max 178 px), ⚠️ 1.5 unexplained | ⚠️ 17 (max 93 px) | 60 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:14 | `ztwarz` | duel | coilemur | auralynx | 63 ms 🟢 (80) | 195 ms | 0.3% | 24.2/min (max 194 px) | ⚠️ 29 (max 76 px) | 91 ms | 59.9 | 0.2% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:14 | `ztwarz` | duel | auralynx | coilemur | 53 ms 🟢 (70) | 167 ms | 3.8% | 35.7/min (max 366 px), ⚠️ 2.1 unexplained | ⚠️ 37 (max 366 px) | 67 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:11 | `p6556o` | duel | coilemur | auralynx | 61 ms 🟢 (65) | 200 ms | 0.1% | 36.9/min (max 181 px) | ⚠️ 14 (max 81 px) | 95 ms | 59.9 | 0.1% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:11 | `p6556o` | duel | auralynx | coilemur | 56 ms 🟢 (77) | 188 ms | 3.0% | 41.3/min (max 179 px), ⚠️ 2.8 unexplained | ⚠️ 15 (max 192 px) | 71 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:10 | `6w407g` | duel | coilemur | auralynx | 62 ms 🟢 (74) | 198 ms | 0.0% | 37.4/min (max 69 px) | ⚠️ 28 (max 49 px) | 109 ms | 59.9 | 0.3% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |

## By day

| Day (UTC) | Reports | Needs attention | Ping, median | Ping, worst 10% | Lead, median | Jumps/min, median | Skill confirm, median | FPS, median | Stutter, median | Dropped connections |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-21 | 4 | 4 | 47 ms | 64 ms | 168 ms | 34.5 | 74 ms | 58.8 | 0.0% | 1 transport close |
| 2026-11-20 | 65 | 64 | 51 ms | 68 ms | 188 ms | 33.8 | 80 ms | 58.8 | 0.1% | 3 transport close |
| 2026-11-19 | 20 | 20 | 56 ms | 73 ms | 187 ms | 62.1 | 85 ms | 58.8 | 0.1% | 3 transport close |
| 2026-11-18 | 65 | 65 | 48 ms | 56 ms | 174 ms | 44.1 | 79 ms | 58.8 | 0.4% | 3 transport close |
| 2026-11-17 | 10 | 10 | 64 ms | 91 ms | 204 ms | 74.2 | 112 ms | 58.8 | 0.1% | 4 transport close, 1 server namespace disconnect |
| 2026-11-16 | 11 | 11 | 67 ms | 68 ms | 201 ms | 41.9 | 89 ms | 59.9 | 0.7% | 1 ping timeout |
| 2026-11-14 | 4 | 4 | 58 ms | 70 ms | 196 ms | 40.4 | 95 ms | 58.8 | 0.0% | 0 |
| 2026-11-13 | 12 | 12 | 72 ms | 80 ms | 241 ms | 118.1 | 122 ms | 67.1 | 2.7% | 2 transport close |
| 2026-11-12 | 3 | 3 | 59 ms | 78 ms | 195 ms | 15.6 | 91 ms | 58.8 | 0.0% | 0 |
| 2026-11-11 | 23 | 16 | 63 ms | 68 ms | 217 ms | 91.2 | 108 ms | 64.9 | 2.0% | 7 transport close |
| 2026-11-10 | 29 | 1 | – | – | – | – | – | 58.8 | 0.1% | 11 transport close |
| 2026-11-09 | 0 | 0 | – | – | – | – | – | – | – | 2 transport close |
| 2026-11-08 | 0 | 0 | – | – | – | – | – | – | – | 1 transport close |
| 2026-11-06 | 0 | 0 | – | – | – | – | – | – | – | 6 transport close |

## What the columns mean

- **Match**: a random tag shared by every player's row of the same match, so both sides read together.
- **Ping**: the match's median round trip to the server (the badge in battle), and in brackets its slowest 5%: 🟢 under 80 ms, 🟡 under 150, 🔴 above.
- **Lead**: how far ahead of the last server update your fighter, and the shots around it, are drawn.
- **Late updates**: share of the server's 15-a-second updates that came over 120 ms apart (Wi-Fi hiccups).
- **Jumps**: times a minute your own fighter was moved over 4 px when a server update disagreed with the phone's guess, and the largest. Hits that push you and stuns always cause some (the phone cannot know a hit is coming); **unexplained** ones mean the prediction is wrong somewhere.
- **Hits off-screen**: hits on you that landed while you were drawn over 24 px from where the server hit you: hits that looked like a miss.
- **Skill confirm**: median time from pressing a skill to the server confirming it.
- **FPS**: frames per second at the median frame. **Stutter**: share of the time in frames that missed 30 fps.
- **Build**: the version of the game the device ran (its commit).
- Columns a device did not report show –: Ping and Lead since 10 Nov 2026 (23:23 UTC); Late updates, Jumps and Skill confirm since 11 Nov; Match, Against, Hits off-screen, Build and the system since the update after that.

## How to investigate

| Symptom | Start here |
| --- | --- |
| Shots hit after you stepped out, or skills look late | `docs/network-performance.md` sections 9 and 11; `tests/visual/shot-timeline.spec.ts` |
| Unexplained jumps | `npx tsx scripts/perf/correction-sim.ts <seconds> <one-way ms> <you> <bot>`: names each jump's cause with the real server and bot |
| Opponents move jerkily, or freeze on a bad link | `npx tsx scripts/perf/net-sim.ts 120` (prediction and smoothing under modelled latency, jitter and stalls) |
| Low FPS or stutter when skills go off | `tests/visual/effect-budget.spec.ts` (`EFFECT_BUDGET_MEASURE=1` prints each champion's cost); `?perf=1` in the game |
| Late updates or slow confirms for everyone | the server: run it with `ARENA_DIAGNOSTICS=60`; `npx tsx scripts/perf/server-load.ts` |
| Many dropped connections | the `arena-disconnect` reasons in `reports/<day>.jsonl` (`ping timeout`: the phone went quiet; `transport close`: the connection closed) |

Every report is in `reports/<day>.jsonl` (one JSON object per line).
