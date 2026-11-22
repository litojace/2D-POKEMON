# Match reports

Newest report: 2026-11-22 10:51 UTC. From the game server's log (`scripts/perf/export-perf-reports.mjs` on `main`). One row per player's device per match; times are UTC. No accounts or names are kept.

## Needs attention

- **2026-11-22 10:51**, mystowl against grumblecrag (raid boss) (match `i4csh0`):
  - Wi-Fi held the phone's inputs 17 times a minute (up to 13 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 10:46**, mystowl against gloomshade (raid boss) (match `y6wy6e`):
  - 9 hit(s) landed while you were drawn over 24 px away (largest 117 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 73.4 times a minute (up to 1 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 08:53**, coilemur against gloomshade (raid boss) (match `iamtw1`):
  - 6 hit(s) landed while you were drawn over 24 px away (largest 43 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-22 08:33**, voltkit against mossloth (bot, hard) (match `x8fmj9`):
  - Wi-Fi held the phone's inputs 46.9 times a minute (up to 4 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 08:32**, voltkit against mossloth (bot, hard) (match `543qga`):
  - 3 hit(s) landed while you were drawn over 24 px away (largest 498 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 63 times a minute (up to 11 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 08:29**, voltkit against mossloth (bot, hard) (match `l5idbb`):
  - Wi-Fi held the phone's inputs 17.6 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 07:32**, astrabun against cindrake (bot, hard) (match `oodm2k`):
  - 5 hit(s) landed while you were drawn over 24 px away (largest 95 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 87.5 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 07:31**, astrabun against cindrake (bot, hard) (match `44v5l2`):
  - drawing slow: 55.6 fps, 5.4% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 2 hit(s) landed while you were drawn over 24 px away (largest 74 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 43.8 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 07:29**, astrabun against gloomshade (raid boss) (match `7pek0r`):
  - drawing slow: 32.3 fps, 37.7% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - Wi-Fi held the phone's inputs 50.8 times a minute (up to 8 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 07:27**, astrabun against gloomshade (raid boss) (match `s41gys`):
  - drawing slow: 35.7 fps, 25.0% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - Wi-Fi held the phone's inputs 75.6 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 07:25**, astrabun against gloomshade (raid boss) (match `cjr94j`):
  - drawing slow: 30.3 fps, 43.9% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - the phone sent 20.41 inputs a second, not 30: its input clock (the scene's accumulator in main.ts) drifted or lost time.
  - Wi-Fi held the phone's inputs 52.3 times a minute (up to 13 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
  - 1 script error(s) during the match: check the browser console.
- **2026-11-22 07:24**, astrabun against gloomshade (raid boss) (match `oll6k8`):
  - drawing slow: 30.3 fps, 51.7% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - Wi-Fi held the phone's inputs 68.9 times a minute (up to 5 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 07:22**, astrabun against gloomshade (raid boss) (match `2h031o`):
  - drawing slow: 35.7 fps, 31.7% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - Wi-Fi held the phone's inputs 50.1 times a minute (up to 13 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 07:20**, astrabun against gloomshade (raid boss) (match `vtzp3q`):
  - drawing slow: 38.5 fps, 11.5% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - Wi-Fi held the phone's inputs 43.2 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 07:17**, astrabun against gloomshade (raid boss) (match `asqjfj`):
  - drawing slow: 35.7 fps, 35.8% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - Wi-Fi held the phone's inputs 57 times a minute (up to 4 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 07:15**, astrabun against gloomshade (raid boss) (match `b02t6f`):
  - drawing slow: 45.5 fps, 7.5% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 1 hit(s) landed while you were drawn over 24 px away (largest 24 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 41 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 07:12**, astrabun against mossloth (bot, hard) (match `0vc3lc`):
  - 3 hit(s) landed while you were drawn over 24 px away (largest 75 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 53.2 times a minute (up to 5 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 07:11**, astrabun against gloomshade (raid boss) (match `bje0cf`):
  - slow connection: ping 51 ms, slowest 5% 163 ms. The player's network: compare other players at the same time before changing the game.
  - drawing slow: 41.7 fps, 9.3% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - Wi-Fi held the phone's inputs 37.4 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 07:08**, astrabun against gloomshade (raid boss) (match `n3ybx2`):
  - 5 hit(s) landed while you were drawn over 24 px away (largest 110 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 38.4 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 07:05**, astrabun against gloomshade (raid boss) (match `8oseym`):
  - 17 hit(s) landed while you were drawn over 24 px away (largest 84 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 64.7 times a minute (up to 4 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 06:57**, astrabun against auralynx (bot, hard) (match `81iljm`):
  - Wi-Fi held the phone's inputs 75.1 times a minute (up to 5 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 06:57**, astrabun against glacelle (bot, hard) (match `tde5qy`):
  - 7 of the player's inputs were folded into another's step (steps lost, each a jump): more inputs than ticks. See Arena.drainInputs and docs/network-performance.md, section 16.
  - Wi-Fi held the phone's inputs 10 times a minute (up to 4 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 06:53**, astrabun against glacelle (bot, hard) (match `5txwwl`):
  - 8 of the player's inputs were folded into another's step (steps lost, each a jump): more inputs than ticks. See Arena.drainInputs and docs/network-performance.md, section 16.
  - Wi-Fi held the phone's inputs 48.2 times a minute (up to 5 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 06:50**, astrabun against wombolder (bot, easy) (match `cvire2`):
  - 30.7 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 25 astrabun wombolder`.
  - 1 hit(s) landed while you were drawn over 24 px away (largest 52 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 92.2 times a minute (up to 1 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 06:49**, astrabun against cindrake (bot, easy) (match `qnhf7t`):
  - 1 hit(s) landed while you were drawn over 24 px away (largest 51 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 69.3 times a minute (up to 5 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 06:45**, astrabun against coilemur (bot, hard) (match `odfee7`):
  - drawing slow: 55.6 fps, 5.6% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - Wi-Fi held the phone's inputs 63.3 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 06:39**, astrabun against gloomshade (raid boss) (match `0cb740`):
  - drawing slow: 41.7 fps, 16.7% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 9 hit(s) landed while you were drawn over 24 px away (largest 30 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 59.4 times a minute (up to 13 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 06:34**, astrabun against tidewyrm (raid boss) (match `a6iaav`):
  - 1 hit(s) landed while you were drawn over 24 px away (largest 32 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 40.8 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 06:33**, astrabun against grumblecrag (raid boss) (match `g0eg20`):
  - drawing slow: 55.6 fps, 5.4% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 4.5 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 25 astrabun cindrake`.
  - Wi-Fi held the phone's inputs 41.6 times a minute (up to 4 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 06:30**, astrabun against grumblecrag (raid boss) (match `27ic7z`):
  - drawing slow: 45.5 fps, 17.6% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 5 hit(s) landed while you were drawn over 24 px away (largest 32 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 49.5 times a minute (up to 4 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 06:28**, astrabun against shadopus (bot, hard) (match `yzztji`):
  - drawing slow: 58.8 fps, 14.1% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 12.6 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 24 astrabun shadopus`.
  - 3 hit(s) landed while you were drawn over 24 px away (largest 367 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 60.4 times a minute (up to 5 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-22 06:27**, astrabun against shadopus (bot, hard) (match `3i4ksf`):
  - 2 hit(s) landed while you were drawn over 24 px away (largest 49 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 38.4 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
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

## Latest matches

| Time (UTC) | Match | Mode | You | Against | Ping (slowest 5%) | Lead | Late updates | Jumps | Hits off-screen | Skill confirm | FPS | Stutter | Graphics | Device | Build |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-22 10:51 | `i4csh0` | raid | mystowl | grumblecrag (raid boss) | 51 ms 🟢 (105) | 190 ms | 0.4% | 1.6/min (max 17 px), ⚠️ 1.6 unexplained | 0 | 88 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 3111759 |
| 2026-11-22 10:48 | `6m0xkn` | raid | mystowl | tidewyrm (raid boss) | 49 ms 🟢 (50) | 182 ms | 0.0% | 6.5/min (max 75 px) | 0 | 74 ms | 58.8 | 0.1% | high (auto) | ios, 4 cores, 59 Hz | 3111759 |
| 2026-11-22 10:46 | `y6wy6e` | raid | mystowl | gloomshade (raid boss) | 52 ms 🟢 (59) | 168 ms | 0.0% | 0/min | ⚠️ 9 (max 117 px) | 77 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 3111759 |
| 2026-11-22 08:53 | `iamtw1` | raid | coilemur | gloomshade (raid boss) | 56 ms 🟢 (60) | 188 ms | 0.0% | 0/min | ⚠️ 6 (max 43 px) | 88 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | cfc7b88 |
| 2026-11-22 08:33 | `x8fmj9` | duel vs bot | voltkit | mossloth (bot, hard) | 54 ms 🟢 (68) | 185 ms | 0.1% | 57.4/min (max 496 px) | 0 | 90 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | cfc7b88 |
| 2026-11-22 08:32 | `543qga` | duel vs bot | voltkit | mossloth (bot, hard) | 55 ms 🟢 (68) | 186 ms | 0.1% | 36.9/min (max 591 px) | ⚠️ 3 (max 498 px) | 88 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | cfc7b88 |
| 2026-11-22 08:29 | `l5idbb` | duel vs bot | voltkit | mossloth (bot, hard) | 54 ms 🟢 (64) | 191 ms | 0.0% | 41.5/min (max 505 px) | 0 | 89 ms | 58.8 | 0.1% | high (auto) | ios, 4 cores, 59 Hz | cfc7b88 |
| 2026-11-22 07:32 | `oodm2k` | duel vs bot | astrabun | cindrake (bot, hard) | 46 ms 🟢 (48) | 157 ms | 0.0% | 78.3/min (max 78 px) | ⚠️ 5 (max 95 px) | 65 ms | 52.6 | 4.0% | low (low) | ios app, 4 cores, 48 Hz | 97a4e86 |
| 2026-11-22 07:31 | `44v5l2` | duel vs bot | astrabun | cindrake (bot, hard) | 46 ms 🟢 (47) | 156 ms | 0.0% | 99.5/min (max 80 px) | ⚠️ 2 (max 74 px) | 66 ms | 55.6 | 5.4% | low (low) | ios app, 4 cores, 34 Hz | 97a4e86 |
| 2026-11-22 07:29 | `7pek0r` | raid | astrabun | gloomshade (raid boss) | 53 ms 🟢 (125) | 169 ms | 0.2% | 11.2/min (max 143 px) | 0 | 85 ms | 32.3 | 37.7% | low (low) | ios app, 4 cores, 38 Hz | 97a4e86 |
| 2026-11-22 07:27 | `s41gys` | raid | astrabun | gloomshade (raid boss) | 49 ms 🟢 (55) | 174 ms | 0.0% | 6.7/min (max 152 px) | 0 | 86 ms | 35.7 | 25.0% | low (low) | ios app, 4 cores | 97a4e86 |
| 2026-11-22 07:25 | `cjr94j` | raid | astrabun | gloomshade (raid boss) | 46 ms 🟢 (51) | 166 ms | 0.1% | 6.7/min (max 123 px), ⚠️ 1 unexplained | 0 | 80 ms | 30.3 | 43.9% | low (low) | ios app, 4 cores | 97a4e86 |
| 2026-11-22 07:24 | `oll6k8` | raid | astrabun | gloomshade (raid boss) | 47 ms 🟢 (61) | 172 ms | 0.4% | 5.5/min (max 293 px) | 0 | 93 ms | 30.3 | 51.7% | low (low) | ios app, 4 cores | 97a4e86 |
| 2026-11-22 07:22 | `2h031o` | raid | astrabun | gloomshade (raid boss) | 47 ms 🟢 (54) | 180 ms | 0.2% | 5.1/min (max 245 px), ⚠️ 1.5 unexplained | 0 | 93 ms | 35.7 | 31.7% | low (low) | ios app, 4 cores, 40 Hz | 97a4e86 |
| 2026-11-22 07:20 | `vtzp3q` | raid | astrabun | gloomshade (raid boss) | 46 ms 🟢 (55) | 178 ms | 0.1% | 6/min (max 299 px) | 0 | 85 ms | 38.5 | 11.5% | low (low) | ios app, 4 cores, 37 Hz | 97a4e86 |
| 2026-11-22 07:17 | `asqjfj` | raid | astrabun | gloomshade (raid boss) | 48 ms 🟢 (63) | 178 ms | 0.0% | 2.9/min (max 168 px) | 0 | 84 ms | 35.7 | 35.8% | low (low) | ios app, 4 cores, 34 Hz | 97a4e86 |
| 2026-11-22 07:15 | `b02t6f` | raid | astrabun | gloomshade (raid boss) | 46 ms 🟢 (50) | 179 ms | 0.1% | 7.9/min (max 122 px) | ⚠️ 1 (max 24 px) | 83 ms | 45.5 | 7.5% | low (low) | ios app, 4 cores | 97a4e86 |
| 2026-11-22 07:12 | `0vc3lc` | duel vs bot | astrabun | mossloth (bot, hard) | 46 ms 🟢 (54) | 164 ms | 0.0% | 79.9/min (max 414 px), ⚠️ 1.5 unexplained | ⚠️ 3 (max 75 px) | 73 ms | 50 | 3.9% | low (low) | ios app, 4 cores, 32 Hz | 97a4e86 |
| 2026-11-22 07:11 | `bje0cf` | raid | astrabun | gloomshade (raid boss) | 51 ms 🟢 (163) | 174 ms | 0.1% | 4/min (max 169 px) | 0 | 72 ms | 41.7 | 9.3% | low (low) | ios app, 4 cores, 37 Hz | 97a4e86 |
| 2026-11-22 07:08 | `n3ybx2` | raid | astrabun | gloomshade (raid boss) | 45 ms 🟢 (52) | 150 ms | 0.5% | 2.6/min (max 4 px) | ⚠️ 5 (max 110 px) | 62 ms | 58.8 | 1.7% | low (low) | ios app, 4 cores, 42 Hz | 97a4e86 |
| 2026-11-22 07:05 | `8oseym` | raid | astrabun | gloomshade (raid boss) | 54 ms 🟢 (83) | 155 ms | 0.0% | 4.6/min (max 295 px) | ⚠️ 17 (max 84 px) | 66 ms | 55.6 | 3.4% | low (low) | ios app, 4 cores, 37 Hz | 97a4e86 |
| 2026-11-22 06:57 | `81iljm` | duel vs bot | astrabun | auralynx (bot, hard) | 48 ms 🟢 (63) | 172 ms | 0.0% | 72.4/min (max 180 px) | 0 | 77 ms | 54.6 | 0.7% | low (low) | windows, 16 cores, 32 GB | 97a4e86 |
| 2026-11-22 06:57 | `tde5qy` | duel vs bot | astrabun | glacelle (bot, hard) | 49 ms 🟢 (58) | 185 ms | 0.2% | 32.1/min (max 25 px), ⚠️ 0.8 unexplained | 0 | 84 ms | 61.7 | 1.5% | low (low) | windows, 16 cores, 32 GB, 60 Hz | 97a4e86 |
| 2026-11-22 06:53 | `5txwwl` | duel vs bot | astrabun | glacelle (bot, hard) | 47 ms 🟢 (54) | 177 ms | 0.2% | 48.2/min (max 26 px) | 0 | 79 ms | 59.2 | 1.5% | low (low) | windows, 16 cores, 32 GB, 60 Hz | 97a4e86 |
| 2026-11-22 06:50 | `cvire2` | duel vs bot | astrabun | wombolder (bot, easy) | 49 ms 🟢 (55) | 168 ms | 0.2% | 79.3/min (max 194 px), ⚠️ 30.7 unexplained | ⚠️ 1 (max 52 px) | 72 ms | 59.2 | 1.2% | low (low) | windows, 16 cores, 32 GB, 61 Hz | 97a4e86 |
| 2026-11-22 06:49 | `qnhf7t` | duel vs bot | astrabun | cindrake (bot, easy) | 51 ms 🟢 (56) | 173 ms | 0.0% | 22.7/min (max 300 px) | ⚠️ 1 (max 51 px) | 89 ms | 53.5 | 1.0% | low (low) | windows, 16 cores, 32 GB, 60 Hz | 97a4e86 |
| 2026-11-22 06:45 | `odfee7` | duel vs bot | astrabun | coilemur (bot, hard) | 51 ms 🟢 (69) | 162 ms | 0.3% | 60.4/min (max 213 px), ⚠️ 2.9 unexplained | 0 | 87 ms | 55.6 | 5.6% | low (low) | ios app, 4 cores, 43 Hz | 97a4e86 |
| 2026-11-22 06:39 | `0cb740` | raid | astrabun | gloomshade (raid boss) | 52 ms 🟢 (65) | 181 ms | 0.2% | 5.2/min (max 302 px) | ⚠️ 9 (max 30 px) | 92 ms | 41.7 | 16.7% | low (low) | ios app, 4 cores, 33 Hz | 4b77058 |
| 2026-11-22 06:34 | `a6iaav` | raid | astrabun | tidewyrm (raid boss) | 50 ms 🟢 (53) | 163 ms | 0.2% | 1.8/min (max 87 px) | ⚠️ 1 (max 32 px) | 76 ms | 58.8 | 1.3% | low (low) | ios app, 4 cores, 59 Hz | 4b77058 |
| 2026-11-22 06:33 | `g0eg20` | raid | astrabun | grumblecrag (raid boss) | 49 ms 🟢 (73) | 169 ms | 0.0% | 10.4/min (max 179 px), ⚠️ 4.5 unexplained | 0 | 73 ms | 55.6 | 5.4% | low (low) | ios app, 4 cores, 59 Hz | 4b77058 |
| 2026-11-22 06:30 | `27ic7z` | raid | astrabun | grumblecrag (raid boss) | 49 ms 🟢 (53) | 171 ms | 0.0% | 6.7/min (max 150 px), ⚠️ 1.5 unexplained | ⚠️ 5 (max 32 px) | 81 ms | 45.5 | 17.6% | low (low) | ios app, 4 cores | 4b77058 |
| 2026-11-22 06:28 | `yzztji` | duel vs bot | astrabun | shadopus (bot, hard) | 47 ms 🟢 (74) | 171 ms | 0.5% | 110.7/min (max 367 px), ⚠️ 12.6 unexplained | ⚠️ 3 (max 367 px) | 120 ms | 58.8 | 14.1% | low (low) | ios app, 4 cores | 4b77058 |
| 2026-11-22 06:27 | `3i4ksf` | duel vs bot | astrabun | shadopus (bot, hard) | 46 ms 🟢 (51) | 172 ms | 0.4% | 69.5/min (max 296 px) | ⚠️ 2 (max 49 px) | 70 ms | 58.8 | 1.5% | low (low) | ios app, 4 cores, 53 Hz | 4b77058 |
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

## By day

| Day (UTC) | Reports | Needs attention | Ping, median | Ping, worst 10% | Lead, median | Jumps/min, median | Skill confirm, median | FPS, median | Stutter, median | Dropped connections |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
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
