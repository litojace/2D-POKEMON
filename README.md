# Match reports

Newest report: 2026-11-20 02:36 UTC. From the game server's log (`scripts/perf/export-perf-reports.mjs` on `main`). One row per player's device per match; times are UTC. No accounts or names are kept.

## Needs attention

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
- **2026-11-20 02:10**, auralynx against coilemur (match `6w407g`):
  - 27 hit(s) landed while you were drawn over 24 px away (largest 446 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - the server's ticks ran up to 15.2 ms late (95th percentile; steps took 0.8 ms): the instance is busy or CPU-throttled. Run it with ARENA_DIAGNOSTICS=60.
  - Wi-Fi held the phone's inputs 75.8 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:08**, coilemur against auralynx (match `rg0y84`):
  - 19 hit(s) landed while you were drawn over 24 px away (largest 47 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 20.6 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:08**, auralynx against coilemur (match `rg0y84`):
  - 20 hit(s) landed while you were drawn over 24 px away (largest 271 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 81 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:06**, coilemur against auralynx (match `cyf2nd`):
  - 18 hit(s) landed while you were drawn over 24 px away (largest 70 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 13.3 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:06**, auralynx against coilemur (match `cyf2nd`):
  - 17 hit(s) landed while you were drawn over 24 px away (largest 247 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 96.1 times a minute (up to 7 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:05**, coilemur against auralynx (match `djacug`):
  - 13 hit(s) landed while you were drawn over 24 px away (largest 56 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 18.6 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 02:05**, auralynx against coilemur (match `djacug`):
  - 16 hit(s) landed while you were drawn over 24 px away (largest 143 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 89.1 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 01:47**, astrabun against shadopus (match `pigm3l`):
  - 8.6 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 26 astrabun shadopus`.
  - 19 hit(s) landed while you were drawn over 24 px away (largest 401 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 68.6 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 01:47**, shadopus against astrabun (match `pigm3l`):
  - 32 hit(s) landed while you were drawn over 24 px away (largest 70 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 10.3 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 01:45**, shadopus against astrabun (match `8coy8l`):
  - 3.1 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 26 shadopus astrabun`.
  - 28 hit(s) landed while you were drawn over 24 px away (largest 122 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 24.9 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 01:45**, astrabun against shadopus (match `8coy8l`):
  - 20.7 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 27 astrabun shadopus`.
  - 19 hit(s) landed while you were drawn over 24 px away (largest 349 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 71.3 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 01:43**, shadopus against astrabun (match `9pvwpe`):
  - 4.1 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 25 shadopus astrabun`.
  - 23 hit(s) landed while you were drawn over 24 px away (largest 64 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 23.5 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 01:43**, astrabun against shadopus (match `9pvwpe`):
  - 17.9 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 25 astrabun shadopus`.
  - 19 hit(s) landed while you were drawn over 24 px away (largest 271 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 101.9 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 01:42**, shadopus against astrabun (match `yuvcd3`):
  - 25 hit(s) landed while you were drawn over 24 px away (largest 132 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 46.8 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 01:42**, astrabun against shadopus (match `yuvcd3`):
  - 14.3 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 26 astrabun shadopus`.
  - 16 hit(s) landed while you were drawn over 24 px away (largest 350 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 107.3 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 01:40**, shadopus against astrabun (match `w76b2r`):
  - 34 hit(s) landed while you were drawn over 24 px away (largest 99 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 72.5 times a minute (up to 7 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 01:40**, astrabun against shadopus (match `w76b2r`):
  - 8.2 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 25 astrabun shadopus`.
  - 14 hit(s) landed while you were drawn over 24 px away (largest 411 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 73.1 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 01:37**, shadopus against astrabun (match `gyuhd5`):
  - 25 hit(s) landed while you were drawn over 24 px away (largest 83 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 31.3 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-20 01:37**, astrabun against shadopus (match `gyuhd5`):
  - 15.2 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 26 astrabun shadopus`.
  - 12 hit(s) landed while you were drawn over 24 px away (largest 421 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 49.4 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-19 23:11**, auralynx against mossloth (bot, hard) (match `no97lg`):
  - 23 hit(s) landed while you were drawn over 24 px away (largest 277 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 23 times a minute (up to 14 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-19 23:10**, auralynx against mossloth (bot, hard) (match `1un02d`):
  - 14 hit(s) landed while you were drawn over 24 px away (largest 285 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 26.4 times a minute (up to 11 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-19 23:07**, auralynx against coilemur (bot, hard) (match `6cgtlc`):
  - 9.6 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 27 auralynx coilemur`.
  - 12 hit(s) landed while you were drawn over 24 px away (largest 73 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 38.5 times a minute (up to 6 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-19 23:06**, auralynx against pangrove (bot, hard) (match `1n639e`):
  - 8 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 28 auralynx pangrove`.
  - 12 hit(s) landed while you were drawn over 24 px away (largest 109 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 37.3 times a minute (up to 10 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-19 23:05**, tidefin against coilemur (bot, hard) (match `5enefm`):
  - 5.3% of the server's updates came late (Wi-Fi hiccups). If every player at that time shows it, it is the server: run it with ARENA_DIAGNOSTICS=60.
  - 5.4 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 46 tidefin coilemur`.
  - 28 hit(s) landed while you were drawn over 24 px away (largest 111 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 36 times a minute (up to 1 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-19 23:05**, auralynx against pangrove (bot, hard) (match `xylixz`):
  - 6.2 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 29 auralynx pangrove`.
  - 18 hit(s) landed while you were drawn over 24 px away (largest 86 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-19 23:04**, auralynx against auralynx (bot, hard) (match `yko74s`):
  - 3.6 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 29 auralynx auralynx`.
  - 16 hit(s) landed while you were drawn over 24 px away (largest 74 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 26.7 times a minute (up to 4 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-19 22:59**, pangrove against sunbara (bot, hard) (match `1forav`):
  - slow connection: ping 84 ms, slowest 5% 211 ms. The player's network: compare other players at the same time before changing the game.
  - 3.3 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 42 pangrove sunbara`.
  - 38 hit(s) landed while you were drawn over 24 px away (largest 97 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - 7 of the player's inputs were folded into another's step (steps lost, each a jump): more inputs than ticks. See Arena.drainInputs and docs/network-performance.md, section 16.
  - Wi-Fi held the phone's inputs 48.8 times a minute (up to 14 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-19 22:55**, pangrove against grumblecrag (raid boss) (match `qxwjna`):
  - 1 hit(s) landed while you were drawn over 24 px away (largest 28 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 38.2 times a minute (up to 13 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-19 22:53**, pangrove against sunbara (bot, hard) (match `1kv07t`):
  - 41 hit(s) landed while you were drawn over 24 px away (largest 151 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 74.3 times a minute (up to 14 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.

## Latest matches

| Time (UTC) | Match | Mode | You | Against | Ping (slowest 5%) | Lead | Late updates | Jumps | Hits off-screen | Skill confirm | FPS | Stutter | Graphics | Device | Build |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
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
| 2026-11-20 02:10 | `6w407g` | duel | auralynx | coilemur | 58 ms 🟢 (93) | 178 ms | 3.1% | 44.9/min (max 448 px), ⚠️ 0.9 unexplained | ⚠️ 27 (max 446 px) | 72 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:08 | `rg0y84` | duel | coilemur | auralynx | 62 ms 🟢 (70) | 198 ms | 0.6% | 23.8/min (max 179 px) | ⚠️ 19 (max 47 px) | 86 ms | 59.9 | 0.3% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:08 | `rg0y84` | duel | auralynx | coilemur | 51 ms 🟢 (65) | 174 ms | 3.4% | 27.8/min (max 342 px) | ⚠️ 20 (max 271 px) | 88 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:06 | `cyf2nd` | duel | coilemur | auralynx | 61 ms 🟢 (85) | 199 ms | 0.3% | 38.6/min (max 187 px) | ⚠️ 18 (max 70 px) | 94 ms | 59.9 | 0.5% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:06 | `cyf2nd` | duel | auralynx | coilemur | 51 ms 🟢 (62) | 169 ms | 3.3% | 34.7/min (max 227 px) | ⚠️ 17 (max 247 px) | 70 ms | 58.8 | 0.7% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 02:05 | `djacug` | duel | coilemur | auralynx | 68 ms 🟢 (77) | 198 ms | 0.9% | 55.8/min (max 183 px) | ⚠️ 13 (max 56 px) | 96 ms | 59.9 | 0.1% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | 39db09a |
| 2026-11-20 02:05 | `djacug` | duel | auralynx | coilemur | 58 ms 🟢 (71) | 163 ms | 2.5% | 51.8/min (max 81 px) | ⚠️ 16 (max 143 px) | 63 ms | 58.8 | 0.1% | high (auto) | ios, 4 cores, 59 Hz | 39db09a |
| 2026-11-20 01:47 | `pigm3l` | duel | astrabun | shadopus | 51 ms 🟢 (67) | 191 ms | 3.0% | 41.2/min (max 364 px), ⚠️ 8.6 unexplained | ⚠️ 19 (max 401 px) | 99 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 890e8c5 |
| 2026-11-20 01:47 | `pigm3l` | duel | shadopus | astrabun | 46 ms 🟢 (54) | 193 ms | 0.3% | 30.9/min (max 150 px), ⚠️ 2.6 unexplained | ⚠️ 32 (max 70 px) | 80 ms | 59.9 | 0.6% | medium (auto) | android, 8 cores, 8 GB, 119 Hz | 890e8c5 |
| 2026-11-20 01:45 | `8coy8l` | duel | shadopus | astrabun | 52 ms 🟢 (67) | 189 ms | 0.4% | 40.4/min (max 150 px), ⚠️ 3.1 unexplained | ⚠️ 28 (max 122 px) | 79 ms | 59.9 | 1.1% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | 890e8c5 |
| 2026-11-20 01:45 | `8coy8l` | duel | astrabun | shadopus | 53 ms 🟢 (66) | 192 ms | 3.4% | 63/min (max 461 px), ⚠️ 20.7 unexplained | ⚠️ 19 (max 349 px) | 81 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 890e8c5 |
| 2026-11-20 01:43 | `9pvwpe` | duel | shadopus | astrabun | 49 ms 🟢 (64) | 186 ms | 0.3% | 38.6/min (max 150 px), ⚠️ 4.1 unexplained | ⚠️ 23 (max 64 px) | 85 ms | 59.9 | 1.1% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | 890e8c5 |
| 2026-11-20 01:43 | `9pvwpe` | duel | astrabun | shadopus | 50 ms 🟢 (63) | 182 ms | 3.0% | 63.4/min (max 280 px), ⚠️ 17.9 unexplained | ⚠️ 19 (max 271 px) | 81 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 890e8c5 |
| 2026-11-20 01:42 | `yuvcd3` | duel | shadopus | astrabun | 46 ms 🟢 (54) | 175 ms | 0.3% | 25.4/min (max 150 px), ⚠️ 2.4 unexplained | ⚠️ 25 (max 132 px) | 78 ms | 59.9 | 0.6% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | 890e8c5 |
| 2026-11-20 01:42 | `yuvcd3` | duel | astrabun | shadopus | 51 ms 🟢 (62) | 183 ms | 3.4% | 39.7/min (max 369 px), ⚠️ 14.3 unexplained | ⚠️ 16 (max 350 px) | 85 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 890e8c5 |
| 2026-11-20 01:40 | `w76b2r` | duel | shadopus | astrabun | 47 ms 🟢 (63) | 174 ms | 1.2% | 19.8/min (max 150 px), ⚠️ 1 unexplained | ⚠️ 34 (max 99 px) | 55 ms | 59.9 | 1.0% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | 890e8c5 |
| 2026-11-20 01:40 | `w76b2r` | duel | astrabun | shadopus | 49 ms 🟢 (62) | 187 ms | 3.4% | 26.6/min (max 381 px), ⚠️ 8.2 unexplained | ⚠️ 14 (max 411 px) | 86 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 890e8c5 |
| 2026-11-20 01:37 | `gyuhd5` | duel | shadopus | astrabun | 46 ms 🟢 (51) | 187 ms | 1.4% | 30.3/min (max 150 px), ⚠️ 0.9 unexplained | ⚠️ 25 (max 83 px) | 89 ms | 59.9 | 0.8% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | 890e8c5 |
| 2026-11-20 01:37 | `gyuhd5` | duel | astrabun | shadopus | 51 ms 🟢 (61) | 193 ms | 3.0% | 36.1/min (max 399 px), ⚠️ 15.2 unexplained | ⚠️ 12 (max 421 px) | 92 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 890e8c5 |
| 2026-11-19 23:11 | `no97lg` | duel vs bot | auralynx | mossloth (bot, hard) | 50 ms 🟢 (53) | 177 ms | 0.0% | 61.6/min (max 543 px), ⚠️ 2.1 unexplained | ⚠️ 23 (max 277 px) | 71 ms | 58.8 | 0.1% | high (auto) | ios app, 4 cores, 59 Hz | 890e8c5 |
| 2026-11-19 23:10 | `1un02d` | duel vs bot | auralynx | mossloth (bot, hard) | 54 ms 🟢 (73) | 172 ms | 0.6% | 68.7/min (max 547 px) | ⚠️ 14 (max 285 px) | 73 ms | 58.8 | 0.1% | high (auto) | ios app, 4 cores, 59 Hz | 890e8c5 |
| 2026-11-19 23:07 | `6cgtlc` | duel vs bot | auralynx | coilemur (bot, hard) | 54 ms 🟢 (68) | 186 ms | 0.0% | 77.1/min (max 57 px), ⚠️ 9.6 unexplained | ⚠️ 12 (max 73 px) | 86 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | 890e8c5 |
| 2026-11-19 23:06 | `1n639e` | duel vs bot | auralynx | pangrove (bot, hard) | 56 ms 🟢 (63) | 190 ms | 0.6% | 106.5/min (max 140 px), ⚠️ 8 unexplained | ⚠️ 12 (max 109 px) | 72 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | 890e8c5 |
| 2026-11-19 23:05 | `5enefm` | duel vs bot | tidefin | coilemur (bot, hard) | 91 ms 🟡 (115) | 211 ms | 5.3% | 66.7/min (max 101 px), ⚠️ 5.4 unexplained | ⚠️ 28 (max 111 px) | 99 ms | 58.8 | 0.5% | high (high) | ios app, 4 cores, 59 Hz | 890e8c5 |
| 2026-11-19 23:05 | `xylixz` | duel vs bot | auralynx | pangrove (bot, hard) | 57 ms 🟢 (118) | 187 ms | 0.6% | 124/min (max 140 px), ⚠️ 6.2 unexplained | ⚠️ 18 (max 86 px) | 82 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | 890e8c5 |
| 2026-11-19 23:04 | `yko74s` | duel vs bot | auralynx | auralynx (bot, hard) | 58 ms 🟢 (65) | 175 ms | 0.0% | 71.3/min (max 184 px), ⚠️ 3.6 unexplained | ⚠️ 16 (max 74 px) | 74 ms | 58.8 | 0.1% | high (auto) | ios app, 4 cores, 59 Hz | 890e8c5 |
| 2026-11-19 22:59 | `1forav` | duel vs bot | pangrove | sunbara (bot, hard) | 84 ms 🟡 (211) | 213 ms | 2.3% | 67.1/min (max 213 px), ⚠️ 3.3 unexplained | ⚠️ 38 (max 97 px) | 106 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | 890e8c5 |
| 2026-11-19 22:55 | `qxwjna` | raid | pangrove | grumblecrag (raid boss) | 72 ms 🟢 (108) | 201 ms | 1.0% | 14.1/min (max 235 px), ⚠️ 0.8 unexplained | ⚠️ 1 (max 28 px) | 92 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | 890e8c5 |
| 2026-11-19 22:53 | `1kv07t` | duel vs bot | pangrove | sunbara (bot, hard) | 73 ms 🟢 (106) | 204 ms | 1.5% | 79.4/min (max 170 px), ⚠️ 1.7 unexplained | ⚠️ 41 (max 151 px) | 118 ms | 58.8 | 0.3% | high (auto) | ios app, 4 cores, 59 Hz | 890e8c5 |

## By day

| Day (UTC) | Reports | Needs attention | Ping, median | Ping, worst 10% | Lead, median | Jumps/min, median | Skill confirm, median | FPS, median | Stutter, median | Dropped connections |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-20 | 40 | 40 | 51 ms | 62 ms | 188 ms | 36.1 | 80 ms | 58.8 | 0.1% | 1 transport close |
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
