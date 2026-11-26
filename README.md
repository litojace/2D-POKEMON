# Match reports

Newest report: 2026-11-26 03:32 UTC. From the game server's log (`scripts/perf/export-perf-reports.mjs` on `main`). One row per player's device per match; times are UTC. No accounts or names are kept.

## Needs attention

- **2026-11-26 03:32**, voltkit against pangrove (bot, normal) (match `pe9w1q`):
  - slow connection: ping 149 ms, slowest 5% 171 ms. The player's network: compare other players at the same time before changing the game.
  - drawing slow: 49 fps, 21.4% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 5 hit(s) landed while you were drawn over 24 px away (largest 67 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 225.6 times a minute (up to 15 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-26 03:28**, mossloth against astrabun (bot, hard) (match `pmyfyd`):
  - 1 hit(s) landed while you were drawn over 24 px away (largest 29 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 245.9 times a minute (up to 5 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-26 03:27**, halcyra against cindrake (bot, hard) (match `0grjzn`):
  - 7 hit(s) landed while you were drawn over 24 px away (largest 102 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 218.8 times a minute (up to 4 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-26 03:26**, glacelle against sunbara (bot, hard) (match `x2vbmx`):
  - 1 hit(s) landed while you were drawn over 24 px away (largest 29 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 175.3 times a minute (up to 6 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-26 03:18**, voltkit against auralynx (bot, normal) (match `o7bnf0`):
  - slow connection: ping 134 ms, slowest 5% 160 ms. The player's network: compare other players at the same time before changing the game.
  - drawing slow: 31.1 fps, 43.5% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 1 hit(s) landed while you were drawn over 24 px away (largest 65 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - the phone sent 29.47 inputs a second, not 30: its input clock (the scene's accumulator in main.ts) drifted or lost time.
  - Wi-Fi held the phone's inputs 179.4 times a minute (up to 10 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-25 08:38**, pyranda against voltkit (bot, hard) (match `7r9e5m`):
  - Wi-Fi held the phone's inputs 156.8 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-25 05:19**, pyranda against grumblecrag (raid boss) (match `91cva2`):
  - Wi-Fi held the phone's inputs 43.7 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-25 05:09**, pyranda against glacelle (bot, hard) (match `jzdik4`):
  - Wi-Fi held the phone's inputs 132.2 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-25 05:07**, pyranda against glacelle (bot, hard) (match `pbmqbg`):
  - Wi-Fi held the phone's inputs 54.3 times a minute (up to 6 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-25 05:03**, terradon against glacelle (bot, hard) (match `3m9k0k`):
  - 2 hit(s) landed while you were drawn over 24 px away (largest 29 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 16.6 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-25 04:23**, tidefin against lumoth (bot, hard) (match `y9q32b`):
  - Wi-Fi held the phone's inputs 199.1 times a minute (up to 1 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-25 03:17**, cindrake against pyranda (bot, normal) (match `taab4o`):
  - 6 hit(s) landed while you were drawn over 24 px away (largest 69 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 84.4 times a minute (up to 6 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 21:40**, cindrake against emberwing (raid boss) (match `863q2t`):
  - slow connection: ping 112 ms, slowest 5% 615 ms. The player's network: compare other players at the same time before changing the game.
  - drawing slow: 24.9 fps, 84.1% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 1 hit(s) landed while you were drawn over 24 px away (largest 36 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 462.9 times a minute (up to 11 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 21:40**, voltkit against emberwing (raid boss) (match `863q2t`):
  - Wi-Fi held the phone's inputs 140.6 times a minute (up to 5 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 21:38**, cindrake against emberwing (raid boss) (match `bvni9n`):
  - slow connection: ping 153 ms, slowest 5% 1004 ms. The player's network: compare other players at the same time before changing the game.
  - drawing slow: 25.1 fps, 82.6% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - Wi-Fi held the phone's inputs 88.6 times a minute (up to 6 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 21:38**, voltkit against emberwing (raid boss) (match `bvni9n`):
  - slow connection: ping 79 ms, slowest 5% 165 ms. The player's network: compare other players at the same time before changing the game.
  - 5.3 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 40 voltkit cindrake`.
  - 5 of the player's inputs were folded into another's step (steps lost, each a jump): more inputs than ticks. See Arena.drainInputs and docs/network-performance.md, section 16.
  - Wi-Fi held the phone's inputs 145.7 times a minute (up to 14 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 21:36**, sunbara against prismatail (raid boss) (match `jk0o5n`):
  - 1 hit(s) landed while you were drawn over 24 px away (largest 36 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 145.1 times a minute (up to 4 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 21:36**, cindrake against prismatail (raid boss) (match `jk0o5n`):
  - slow connection: ping 109 ms, slowest 5% 161 ms. The player's network: compare other players at the same time before changing the game.
  - drawing slow: 23.4 fps, 86.1% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 1 hit(s) landed while you were drawn over 24 px away (largest 24 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 265.4 times a minute (up to 5 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 21:33**, sunbara against prismatail (raid boss) (match `3lc2ze`):
  - Wi-Fi held the phone's inputs 124.4 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 21:29**, tidefin against grumblecrag (raid boss) (match `1hzmsk`):
  - Wi-Fi held the phone's inputs 227.7 times a minute (up to 4 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 21:29**, mossloth against grumblecrag (raid boss) (match `1hzmsk`):
  - drawing slow: 23.3 fps, 86.2% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 7 hit(s) landed while you were drawn over 24 px away (largest 36 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 302.6 times a minute (up to 8 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 21:20**, cindrake against pangrove (bot, normal) (match `7gmeb3`):
  - slow connection: ping 89 ms, slowest 5% 351 ms. The player's network: compare other players at the same time before changing the game.
  - drawing slow: 32.2 fps, 49.7% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 5 hit(s) landed while you were drawn over 24 px away (largest 72 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 370.1 times a minute (up to 5 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 21:12**, pyranda against pyranda (match `apljab`):
  - slow connection: ping 131 ms, slowest 5% 169 ms. The player's network: compare other players at the same time before changing the game.
  - drawing slow: 27.3 fps, 73.6% stutter at high graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 4 hit(s) landed while you were drawn over 24 px away (largest 92 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 324.5 times a minute (up to 14 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 21:12**, pyranda against pyranda (match `apljab`):
  - 1 hit(s) landed while you were drawn over 24 px away (largest 63 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 13.3 times a minute (up to 14 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 21:08**, pyranda against pyranda (match `8zck05`):
  - drawing slow: 28.7 fps, 66.1% stutter at high graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 2 hit(s) landed while you were drawn over 24 px away (largest 66 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 392.3 times a minute (up to 14 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 21:06**, pyranda against pyranda (match `a6oext`):
  - slow connection: ping 133 ms, slowest 5% 154 ms. The player's network: compare other players at the same time before changing the game.
  - drawing slow: 28.9 fps, 64.4% stutter at high graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 6 hit(s) landed while you were drawn over 24 px away (largest 88 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 398.7 times a minute (up to 15 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 21:06**, pyranda against pyranda (match `a6oext`):
  - 3 hit(s) landed while you were drawn over 24 px away (largest 80 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 32 times a minute (up to 15 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 21:03**, cindrake against voltkit (match `qztuxv`):
  - slow connection: ping 108 ms, slowest 5% 157 ms. The player's network: compare other players at the same time before changing the game.
  - drawing slow: 50.5 fps, 27.5% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 3 hit(s) landed while you were drawn over 24 px away (largest 72 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 310 times a minute (up to 14 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 21:03**, voltkit against cindrake (match `qztuxv`):
  - 2 hit(s) landed while you were drawn over 24 px away (largest 68 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 23.5 times a minute (up to 14 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 11:18**, sunbara against voltkit (bot, hard) (match `3f6ifu`):
  - Wi-Fi held the phone's inputs 18.4 times a minute (up to 1 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 06:34**, sunbara against mystowl (bot, hard) (match `9vsydt`):
  - Wi-Fi held the phone's inputs 44.2 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 05:36**, pangrove against grumblecrag (raid boss) (match `c1hrhd`):
  - 1 hit(s) landed while you were drawn over 24 px away (largest 28 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 88.8 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 05:34**, pangrove against sunbara (bot, hard) (match `i5lp8a`):
  - 7 hit(s) landed while you were drawn over 24 px away (largest 70 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 186.1 times a minute (up to 9 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 05:32**, pangrove against gloomshade (raid boss) (match `zlmf57`):
  - 2 hit(s) landed while you were drawn over 24 px away (largest 47 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 107.4 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 03:08**, pangrove against gloomshade (raid boss) (match `hxnkjy`):
  - Wi-Fi held the phone's inputs 70.6 times a minute (up to 7 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-24 03:06**, pangrove against mossloth (bot, hard) (match `qdtadt`):
  - 5 hit(s) landed while you were drawn over 24 px away (largest 171 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 47.8 times a minute (up to 10 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-23 07:13**, pangrove against cindrake (match `53vlzh`):
  - 1 hit(s) landed while you were drawn over 24 px away (largest 65 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 14.8 times a minute (up to 4 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-23 07:13**, cindrake against pangrove (match `53vlzh`):
  - 14 hit(s) landed while you were drawn over 24 px away (largest 75 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 21.2 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-23 06:26**, astrabun against terradon (bot, hard) (match `wn6nas`):
  - Wi-Fi held the phone's inputs 71.7 times a minute (up to 1 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-23 06:09**, wombolder against duskveil (match `367ss4`):
  - 5 hit(s) landed while you were drawn over 24 px away (largest 126 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 47.2 times a minute (up to 5 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-23 06:09**, duskveil against wombolder (match `367ss4`):
  - 5.1 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 30 duskveil wombolder`.
  - 1 hit(s) landed while you were drawn over 24 px away (largest 30 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 54.9 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-23 06:05**, pyranda against lumoth (match `hdb58t`):
  - 3 hit(s) landed while you were drawn over 24 px away (largest 73 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 81.8 times a minute (up to 8 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-23 06:05**, lumoth against pyranda (match `hdb58t`):
  - 4 hit(s) landed while you were drawn over 24 px away (largest 75 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 56.3 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-23 06:03**, terradon against astrabun (match `b1ffmw`):
  - Wi-Fi held the phone's inputs 49.9 times a minute (up to 1 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-23 06:03**, astrabun against terradon (match `b1ffmw`):
  - 2 hit(s) landed while you were drawn over 24 px away (largest 29 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 20.9 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 10:51**, mystowl against grumblecrag (raid boss) (match `i4csh0`):
  - Wi-Fi held the phone's inputs 17 times a minute (up to 13 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 10:46**, mystowl against gloomshade (raid boss) (match `y6wy6e`):
  - 9 hit(s) landed while you were drawn over 24 px away (largest 117 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 73.4 times a minute (up to 1 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 08:53**, coilemur against gloomshade (raid boss) (match `iamtw1`):
  - 6 hit(s) landed while you were drawn over 24 px away (largest 43 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.

## Latest matches

| Time (UTC) | Match | Mode | You | Against | Ping (slowest 5%) | Lead | Late updates | Jumps | Hits off-screen | Skill confirm | FPS | Stutter | Graphics | Device | Build |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-26 03:32 | `pe9w1q` | duel vs bot | voltkit | pangrove (bot, normal) | 149 ms 🟡 (171) | 220 ms | 4.0% | 41.1/min (max 106 px) | ⚠️ 5 (max 67 px) | 138 ms | 49 | 21.4% | low (auto) | android, 4 cores, 16 GB, 60 Hz | 50a5d68 |
| 2026-11-26 03:28 | `pmyfyd` | duel vs bot | mossloth | astrabun (bot, hard) | 61 ms 🟢 (95) | 170 ms | 1.4% | 48.7/min (max 471 px) | ⚠️ 1 (max 29 px) | 86 ms | 59.9 | 1.4% | low (auto) | android, 10 cores, 8 GB, 60 Hz | 4897bc2 |
| 2026-11-26 03:27 | `0grjzn` | duel vs bot | halcyra | cindrake (bot, hard) | 61 ms 🟢 (73) | 171 ms | 1.7% | 44.8/min (max 391 px) | ⚠️ 7 (max 102 px) | 84 ms | 59.9 | 1.0% | low (auto) | android, 10 cores, 8 GB, 60 Hz | 4897bc2 |
| 2026-11-26 03:26 | `x2vbmx` | duel vs bot | glacelle | sunbara (bot, hard) | 67 ms 🟢 (100) | 176 ms | 0.2% | 28.4/min (max 117 px) | ⚠️ 1 (max 29 px) | 82 ms | 59.9 | 2.2% | low (auto) | android, 10 cores, 8 GB, 60 Hz | 4897bc2 |
| 2026-11-26 03:18 | `o7bnf0` | duel vs bot | voltkit | auralynx (bot, normal) | 134 ms 🟡 (160) | 232 ms | 1.4% | 44.4/min (max 170 px) | ⚠️ 1 (max 65 px) | 152 ms | 31.1 | 43.5% | low (auto) | linux, 4 cores, 16 GB, 30 Hz | 4897bc2 |
| 2026-11-25 08:38 | `7r9e5m` | duel vs bot | pyranda | voltkit (bot, hard) | 61 ms 🟢 (68) | 154 ms | 0.0% | 19.9/min (max 30 px), ⚠️ 0.4 unexplained | 0 | 70 ms | 58.8 | 0.0% | high (high) | ios, 4 cores, 59 Hz | 0cdcb94 |
| 2026-11-25 05:19 | `91cva2` | raid | pyranda | grumblecrag (raid boss) | 66 ms 🟢 (84) | 179 ms | 0.0% | 0/min | 0 | 118 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | 7f9157c |
| 2026-11-25 05:09 | `jzdik4` | duel vs bot | pyranda | glacelle (bot, hard) | 68 ms 🟢 (76) | 177 ms | 0.0% | 28.9/min (max 57 px), ⚠️ 0.6 unexplained | 0 | 104 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | 7f9157c |
| 2026-11-25 05:07 | `pbmqbg` | duel vs bot | pyranda | glacelle (bot, hard) | 68 ms 🟢 (97) | 184 ms | 0.1% | 26.6/min (max 85 px), ⚠️ 0.4 unexplained | 0 | 101 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | 7f9157c |
| 2026-11-25 05:03 | `3m9k0k` | duel vs bot | terradon | glacelle (bot, hard) | 68 ms 🟢 (99) | 181 ms | 0.0% | 60.8/min (max 48 px), ⚠️ 0.8 unexplained | ⚠️ 2 (max 29 px) | 108 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | 7f9157c |
| 2026-11-25 04:23 | `y9q32b` | duel vs bot | tidefin | lumoth (bot, hard) | 62 ms 🟢 (86) | 155 ms | 0.0% | 62.3/min (max 70 px) | 0 | 82 ms | 58.8 | 0.2% | high (auto) | ios app, 4 cores, 59 Hz | 7f9157c |
| 2026-11-25 03:17 | `taab4o` | duel vs bot | cindrake | pyranda (bot, normal) | 100 ms 🟡 (132) | 216 ms | 0.3% | 29.7/min (max 150 px) | ⚠️ 6 (max 69 px) | 121 ms | 59.5 | 0.5% | low (auto) | android, 9 cores, 8 GB, 60 Hz | 2b47ed5 |
| 2026-11-24 21:40 | `863q2t` | raid | cindrake | emberwing (raid boss) | 112 ms 🟡 (615) | 206 ms | 0.6% | 2.3/min (max 220 px), ⚠️ 0.8 unexplained | ⚠️ 1 (max 36 px) | 132 ms | 24.9 | 84.1% | low (auto) | android, 9 cores, 8 GB | e4c7bde |
| 2026-11-24 21:40 | `863q2t` | raid | voltkit | emberwing (raid boss) | 77 ms 🟢 (94) | 184 ms | 0.3% | 0/min | 0 | 98 ms | 58.8 | 0.0% | high (high) | ios, 4 cores, 59 Hz | e4c7bde |
| 2026-11-24 21:38 | `bvni9n` | raid | cindrake | emberwing (raid boss) | 153 ms 🔴 (1004) | 246 ms | 0.1% | 4.6/min (max 220 px), ⚠️ 1.5 unexplained | 0 | 140 ms | 25.1 | 82.6% | low (auto) | android, 9 cores, 8 GB | e4c7bde |
| 2026-11-24 21:38 | `bvni9n` | raid | voltkit | emberwing (raid boss) | 79 ms 🟢 (165) | 188 ms | 0.1% | 6.6/min (max 18 px), ⚠️ 5.3 unexplained | 0 | 131 ms | 58.8 | 0.2% | high (high) | ios, 4 cores, 59 Hz | e4c7bde |
| 2026-11-24 21:36 | `jk0o5n` | raid | sunbara | prismatail (raid boss) | 78 ms 🟢 (102) | 134 ms | 0.4% | 0/min | ⚠️ 1 (max 36 px) | 150 ms | 58.8 | 0.0% | high (high) | ios, 4 cores, 59 Hz | e4c7bde |
| 2026-11-24 21:36 | `jk0o5n` | raid | cindrake | prismatail (raid boss) | 109 ms 🟡 (161) | 235 ms | 0.6% | 1.4/min (max 16 px) | ⚠️ 1 (max 24 px) | 165 ms | 23.4 | 86.1% | low (auto) | android, 9 cores, 8 GB | e4c7bde |
| 2026-11-24 21:33 | `3lc2ze` | raid | sunbara | prismatail (raid boss) | 69 ms 🟢 (83) | 177 ms | 0.2% | 0/min | 0 | 99 ms | 58.8 | 0.0% | high (high) | ios, 4 cores, 59 Hz | e4c7bde |
| 2026-11-24 21:29 | `1hzmsk` | raid | tidefin | grumblecrag (raid boss) | 74 ms 🟢 (88) | 179 ms | 0.1% | 3.7/min (max 109 px) | 0 | 101 ms | 58.8 | 0.0% | high (high) | ios, 4 cores, 59 Hz | e4c7bde |
| 2026-11-24 21:29 | `1hzmsk` | raid | mossloth | grumblecrag (raid boss) | 115 ms 🟡 (146) | 222 ms | 1.5% | 0/min | ⚠️ 7 (max 36 px) | 135 ms | 23.3 | 86.2% | low (auto) | android, 9 cores, 8 GB, 30 Hz | e4c7bde |
| 2026-11-24 21:20 | `7gmeb3` | duel vs bot | cindrake | pangrove (bot, normal) | 89 ms 🟡 (351) | 189 ms | 0.2% | 51/min (max 140 px) | ⚠️ 5 (max 72 px) | 112 ms | 32.2 | 49.7% | low (auto) | android, 9 cores, 8 GB, 30 Hz | e4c7bde |
| 2026-11-24 21:12 | `apljab` | duel | pyranda | pyranda | 131 ms 🟡 (169) | 248 ms | 0.6% | 16.2/min (max 112 px) | ⚠️ 4 (max 92 px) | 150 ms | 27.3 | 73.6% | high (high) | android, 9 cores, 8 GB, 30 Hz | e4c7bde |
| 2026-11-24 21:12 | `apljab` | duel | pyranda | pyranda | 49 ms 🟢 (74) | 146 ms | 0.0% | 10.8/min (max 150 px), ⚠️ 0.4 unexplained | ⚠️ 1 (max 63 px) | 64 ms | 58.8 | 0.0% | high (high) | ios, 4 cores, 59 Hz | e4c7bde |
| 2026-11-24 21:08 | `8zck05` | duel | pyranda | pyranda | 129 ms 🟡 (149) | 244 ms | 0.4% | 19.9/min (max 77 px), ⚠️ 0.7 unexplained | ⚠️ 2 (max 66 px) | 144 ms | 28.7 | 66.1% | high (high) | android, 9 cores, 8 GB, 30 Hz | e4c7bde |
| 2026-11-24 21:08 | `8zck05` | duel | pyranda | pyranda | 50 ms 🟢 (51) | 145 ms | 0.0% | 17.3/min (max 150 px), ⚠️ 0.7 unexplained | 0 | 63 ms | 58.8 | 0.0% | high (high) | ios, 4 cores, 59 Hz | e4c7bde |
| 2026-11-24 21:06 | `a6oext` | duel | pyranda | pyranda | 133 ms 🟡 (154) | 242 ms | 0.4% | 14.4/min (max 150 px) | ⚠️ 6 (max 88 px) | 149 ms | 28.9 | 64.4% | high (high) | android, 9 cores, 8 GB | e4c7bde |
| 2026-11-24 21:06 | `a6oext` | duel | pyranda | pyranda | 51 ms 🟢 (54) | 145 ms | 0.0% | 11.4/min (max 150 px), ⚠️ 0.5 unexplained | ⚠️ 3 (max 80 px) | 63 ms | 58.8 | 0.0% | high (high) | ios, 4 cores, 59 Hz | e4c7bde |
| 2026-11-24 21:03 | `qztuxv` | duel | cindrake | voltkit | 108 ms 🟡 (157) | 218 ms | 0.2% | 21.8/min (max 161 px), ⚠️ 0.3 unexplained | ⚠️ 3 (max 72 px) | 104 ms | 50.5 | 27.5% | low (auto) | android, 9 cores, 8 GB, 60 Hz | e4c7bde |
| 2026-11-24 21:03 | `qztuxv` | duel | voltkit | cindrake | 50 ms 🟢 (54) | 145 ms | 0.0% | 4.3/min (max 80 px) | ⚠️ 2 (max 68 px) | 64 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | e4c7bde |
| 2026-11-24 11:18 | `3f6ifu` | duel vs bot | sunbara | voltkit (bot, hard) | 50 ms 🟢 (55) | 142 ms | 0.0% | 48.7/min (max 67 px) | 0 | 63 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 4781acc |
| 2026-11-24 06:34 | `9vsydt` | duel vs bot | sunbara | mystowl (bot, hard) | 55 ms 🟢 (60) | 165 ms | 0.0% | 30.9/min (max 160 px), ⚠️ 1.8 unexplained | 0 | 72 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | d7b44b0 |
| 2026-11-24 05:36 | `c1hrhd` | raid | pangrove | grumblecrag (raid boss) | 55 ms 🟢 (131) | 153 ms | 0.0% | 13.6/min (max 119 px) | ⚠️ 1 (max 28 px) | 69 ms | 58.8 | 0.1% | high (auto) | ios, 4 cores, 59 Hz | b75cbdf |
| 2026-11-24 05:34 | `i5lp8a` | duel vs bot | pangrove | sunbara (bot, hard) | 58 ms 🟢 (62) | 156 ms | 0.0% | 73.2/min (max 167 px) | ⚠️ 7 (max 70 px) | 88 ms | 58.8 | 0.4% | high (auto) | ios, 4 cores, 59 Hz | b75cbdf |
| 2026-11-24 05:32 | `zlmf57` | raid | pangrove | gloomshade (raid boss) | 59 ms 🟢 (65) | 163 ms | 0.0% | 8.2/min (max 111 px) | ⚠️ 2 (max 47 px) | 90 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | b75cbdf |
| 2026-11-24 03:08 | `hxnkjy` | raid | pangrove | gloomshade (raid boss) | 49 ms 🟢 (96) | 179 ms | 0.5% | 16.8/min (max 101 px) | 0 | 63 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 12c52c0 |
| 2026-11-24 03:06 | `qdtadt` | duel vs bot | pangrove | mossloth (bot, hard) | 45 ms 🟢 (48) | 147 ms | 0.1% | 60.2/min (max 568 px) | ⚠️ 5 (max 171 px) | 56 ms | 58.8 | 1.0% | high (auto) | ios, 4 cores, 59 Hz | 12c52c0 |
| 2026-11-23 07:13 | `53vlzh` | duel | pangrove | cindrake | 59 ms 🟢 (67) | 193 ms | 0.3% | 5.8/min (max 159 px) | ⚠️ 1 (max 65 px) | 87 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 9e0cd7a |
| 2026-11-23 07:13 | `53vlzh` | duel | cindrake | pangrove | 53 ms 🟢 (64) | 187 ms | 0.4% | 9.6/min (max 140 px) | ⚠️ 14 (max 75 px) | 74 ms | 54.9 | 0.0% | high (auto) | windows app, 28 cores, 32 GB, 164 Hz | 9e0cd7a |
| 2026-11-23 06:26 | `wn6nas` | duel vs bot | astrabun | terradon (bot, hard) | 56 ms 🟢 (68) | 176 ms | 0.2% | 43.6/min (max 239 px) | 0 | 88 ms | 58.8 | 0.6% | high (auto) | ios app, 4 cores, 59 Hz | 8288038 |
| 2026-11-23 06:09 | `367ss4` | duel | wombolder | duskveil | 68 ms 🟢 (85) | 224 ms | 3.7% | 35.1/min (max 303 px) | ⚠️ 5 (max 126 px) | 104 ms | 58.8 | 0.1% | high (high) | ios app, 4 cores, 59 Hz | 689e975 |
| 2026-11-23 06:09 | `367ss4` | duel | duskveil | wombolder | 59 ms 🟢 (67) | 187 ms | 0.0% | 24.9/min (max 156 px), ⚠️ 5.1 unexplained | ⚠️ 1 (max 30 px) | 81 ms | 52.6 | 0.4% | high (high) | ios app, 4 cores, 48 Hz | 689e975 |
| 2026-11-23 06:05 | `hdb58t` | duel | pyranda | lumoth | 68 ms 🟢 (94) | 203 ms | 2.9% | 30.1/min (max 130 px), ⚠️ 1.3 unexplained | ⚠️ 3 (max 73 px) | 101 ms | 58.8 | 0.0% | high (high) | ios app, 4 cores, 59 Hz | 689e975 |
| 2026-11-23 06:05 | `hdb58t` | duel | lumoth | pyranda | 57 ms 🟢 (65) | 186 ms | 0.1% | 15.7/min (max 150 px) | ⚠️ 4 (max 75 px) | 85 ms | 50 | 0.4% | high (high) | ios app, 4 cores, 48 Hz | 689e975 |
| 2026-11-23 06:03 | `b1ffmw` | duel | terradon | astrabun | 59 ms 🟢 (62) | 188 ms | 0.0% | 49.9/min (max 150 px) | 0 | 83 ms | 55.6 | 0.4% | high (high) | ios app, 4 cores, 53 Hz | 689e975 |
| 2026-11-23 06:03 | `b1ffmw` | duel | astrabun | terradon | 61 ms 🟢 (68) | 190 ms | 0.1% | 25.6/min (max 300 px) | ⚠️ 2 (max 29 px) | 93 ms | 58.8 | 0.1% | high (high) | ios app, 4 cores, 59 Hz | 689e975 |
| 2026-11-22 10:51 | `i4csh0` | raid | mystowl | grumblecrag (raid boss) | 51 ms 🟢 (105) | 190 ms | 0.4% | 1.6/min (max 17 px), ⚠️ 1.6 unexplained | 0 | 88 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 3111759 |
| 2026-11-22 10:48 | `6m0xkn` | raid | mystowl | tidewyrm (raid boss) | 49 ms 🟢 (50) | 182 ms | 0.0% | 6.5/min (max 75 px) | 0 | 74 ms | 58.8 | 0.1% | high (auto) | ios, 4 cores, 59 Hz | 3111759 |
| 2026-11-22 10:46 | `y6wy6e` | raid | mystowl | gloomshade (raid boss) | 52 ms 🟢 (59) | 168 ms | 0.0% | 0/min | ⚠️ 9 (max 117 px) | 77 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 3111759 |
| 2026-11-22 08:53 | `iamtw1` | raid | coilemur | gloomshade (raid boss) | 56 ms 🟢 (60) | 188 ms | 0.0% | 0/min | ⚠️ 6 (max 43 px) | 88 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | cfc7b88 |

## By day

| Day (UTC) | Reports | Needs attention | Ping, median | Ping, worst 10% | Lead, median | Jumps/min, median | Skill confirm, median | FPS, median | Stutter, median | Dropped connections |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-26 | 5 | 5 | 67 ms | 149 ms | 176 ms | 44.4 | 86 ms | 59.9 | 2.2% | 9 transport close |
| 2026-11-25 | 7 | 7 | 68 ms | 100 ms | 179 ms | 28.9 | 104 ms | 58.8 | 0.0% | 3 client namespace disconnect, 1 server namespace disconnect |
| 2026-11-24 | 25 | 24 | 74 ms | 131 ms | 179 ms | 11.4 | 99 ms | 58.8 | 0.1% | 4 client namespace disconnect, 2 transport close, 1 server namespace disconnect, 1 server shutting down |
| 2026-11-23 | 9 | 9 | 59 ms | 68 ms | 188 ms | 25.6 | 87 ms | 58.8 | 0.1% | 4 client namespace disconnect, 3 transport close, 2 server shutting down |
| 2026-11-22 | 33 | 32 | 49 ms | 54 ms | 172 ms | 7.9 | 83 ms | 55.6 | 3.9% | 17 transport close, 1 server shutting down |
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
