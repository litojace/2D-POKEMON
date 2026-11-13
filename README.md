# Match reports

Newest report: 2026-11-13 23:09 UTC. From the game server's log (`scripts/perf/export-perf-reports.mjs` on `main`). One row per player's device per match; times are UTC. No accounts or names are kept.

## Needs attention

- **2026-11-13 23:09**, pangrove against shadopus (bot, hard) (match `5l9yad`):
  - 35.6 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 40 pangrove shadopus`.
  - 37 hit(s) landed while you were drawn over 24 px away (largest 387 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-13 03:58**, pyranda against gloomshade (raid boss) (match `p6sg8p`):
  - 58.3 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 36 pyranda cindrake`.
  - 34 hit(s) landed while you were drawn over 24 px away (largest 27 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-13 02:32**, glacelle against lumoth (bot, hard) (match `yjzr6b`):
  - 63.2 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 40 glacelle lumoth`.
  - 41 hit(s) landed while you were drawn over 24 px away (largest 120 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-13 02:28**, lumoth against glacelle (bot, hard) (match `clf6xe`):
  - 73.9 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 44 lumoth glacelle`.
  - 28 hit(s) landed while you were drawn over 24 px away (largest 103 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-13 02:27**, tidefin against terradon (bot, hard) (match `c2h9sf`):
  - 47.6 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 37 tidefin terradon`.
  - 28 hit(s) landed while you were drawn over 24 px away (largest 164 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-13 02:22**, mossloth against lumoth (bot, hard) (match `lkiw92`):
  - drawing slow: 67.1 fps, 11.6% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 67.7 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 32 mossloth lumoth`.
  - 29 hit(s) landed while you were drawn over 24 px away (largest 122 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-13 02:21**, mossloth against shadopus (bot, hard) (match `xztudp`):
  - 64.4 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 33 mossloth shadopus`.
  - 13 hit(s) landed while you were drawn over 24 px away (largest 402 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-13 02:19**, mossloth against pangrove (bot, hard) (match `iaak87`):
  - 45 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 38 mossloth pangrove`.
  - 25 hit(s) landed while you were drawn over 24 px away (largest 167 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-13 02:18**, mossloth against terradon (bot, hard) (match `2sc0nx`):
  - 10.1% of the server's updates came late (Wi-Fi hiccups). If every player at that time shows it, it is the server: run it with ARENA_DIAGNOSTICS=60.
  - 28.1 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 40 mossloth terradon`.
  - 3 hit(s) landed while you were drawn over 24 px away (largest 33 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-13 02:17**, mossloth against auralynx (bot, hard) (match `h06l5b`):
  - 5.9% of the server's updates came late (Wi-Fi hiccups). If every player at that time shows it, it is the server: run it with ARENA_DIAGNOSTICS=60.
  - 59 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 36 mossloth auralynx`.
  - 18 hit(s) landed while you were drawn over 24 px away (largest 133 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-13 02:15**, mossloth against tidefin (bot, hard) (match `fi88xj`):
  - 68.8 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 32 mossloth tidefin`.
  - 83 hit(s) landed while you were drawn over 24 px away (largest 236 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-13 02:12**, pangrove against glacelle (bot, hard) (match `kvo4b8`):
  - 34.9 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 30 pangrove glacelle`.
  - 38 hit(s) landed while you were drawn over 24 px away (largest 181 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-12 08:09**, pyranda against gloomshade (raid boss) (match `02sky6`):
  - 13.3 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 30 pyranda cindrake`.
  - 1 hit(s) landed while you were drawn over 24 px away (largest 26 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-12 08:07**, pyranda against gloomshade (raid boss) (match `nxdi6k`):
  - 10.5 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 29 pyranda cindrake`.
  - 1 hit(s) landed while you were drawn over 24 px away (largest 27 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-12 08:03**, tidefin against duskveil (bot, hard) (match `z1e46k`):
  - 11.2 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 39 tidefin duskveil`.
  - 83 hit(s) landed while you were drawn over 24 px away (largest 99 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-11 18:43**, lumoth against pyranda (bot, hard) (match `5g05f6`):
  - slow connection: ping 68 ms, slowest 5% 277 ms. The player's network: compare other players at the same time before changing the game.
  - drawing slow: 61 fps, 6.1% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 27.9 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 34 lumoth pyranda`.
  - 10 hit(s) landed while you were drawn over 24 px away (largest 172 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-11 18:39**, tidefin against pangrove (bot, hard) (match `6n3lkw`):
  - 32.1 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 32 tidefin pangrove`.
  - 46 hit(s) landed while you were drawn over 24 px away (largest 85 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-11 18:36**, shadopus against terradon (bot, hard) (match `lzsko7`):
  - 34.3 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 28 shadopus terradon`.
  - 20 hit(s) landed while you were drawn over 24 px away (largest 82 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-11 18:34**, shadopus against terradon (bot, hard) (match `uwjkl1`):
  - 34.4 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 27 shadopus terradon`.
  - 16 hit(s) landed while you were drawn over 24 px away (largest 45 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-11 18:33**, wombolder against shadopus (bot, hard) (match `660sb3`):
  - 32.3 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 30 wombolder shadopus`.
  - 22 hit(s) landed while you were drawn over 24 px away (largest 386 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-11 18:32**, astrabun against terradon (bot, hard) (match `avhi16`):
  - 34.7 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 28 astrabun terradon`.
  - 10 hit(s) landed while you were drawn over 24 px away (largest 44 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-11 18:31**, pangrove against astrabun (bot, hard) (match `q6x8b9`):
  - 17.5 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 36 pangrove astrabun`.
  - 20 hit(s) landed while you were drawn over 24 px away (largest 182 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-11 18:30**, pangrove against halcyra (bot, hard) (match `3m1nqg`):
  - 8.4 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 31 pangrove halcyra`.
  - 22 hit(s) landed while you were drawn over 24 px away (largest 211 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-11 18:28**, pangrove against cindrake (bot, hard) (match `pv0d9x`):
  - drawing slow: 61.3 fps, 17.7% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 26.9 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 32 pangrove cindrake`.
  - 33 hit(s) landed while you were drawn over 24 px away (largest 184 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-11 18:27**, pangrove against cindrake (bot, hard) (match `lgi8go`):
  - 18 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 29 pangrove cindrake`.
  - 50 hit(s) landed while you were drawn over 24 px away (largest 209 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-11 18:26**, pangrove against coilemur (bot, hard) (match `uskvt8`):
  - 11.6 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 30 pangrove coilemur`.
  - 30 hit(s) landed while you were drawn over 24 px away (largest 104 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-11 18:25**, pangrove against halcyra (bot, hard) (match `32a9il`):
  - 27.2 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 32 pangrove halcyra`.
  - 29 hit(s) landed while you were drawn over 24 px away (largest 156 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-11 18:23**, voltkit against pangrove (bot, hard) (match `3ayaj0`):
  - drawing slow: 66.2 fps, 5.6% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 37.2 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 32 voltkit pangrove`.
  - 30 hit(s) landed while you were drawn over 24 px away (largest 114 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-11 18:21**, mossloth against auralynx (bot, hard) (match `k244kj`):
  - 23.8 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 30 mossloth auralynx`.
  - 13 hit(s) landed while you were drawn over 24 px away (largest 68 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-11 18:19**, mossloth against coilemur (bot, hard) (match `uuiqyl`):
  - 28.8 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 29 mossloth coilemur`.
  - 7 hit(s) landed while you were drawn over 24 px away (largest 56 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-11 18:17**, mossloth against glacelle (bot, hard) (match `gzuxes`):
  - 25.8 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 26 mossloth glacelle`.
  - 44 hit(s) landed while you were drawn over 24 px away (largest 337 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.

## Latest matches

| Time (UTC) | Match | Mode | You | Against | Ping (slowest 5%) | Lead | Late updates | Jumps | Hits off-screen | Skill confirm | FPS | Stutter | Graphics | Device | Build |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-13 23:09 | `5l9yad` | duel vs bot | pangrove | shadopus (bot, hard) | 80 ms 🟡 (91) | 241 ms | 2.4% | 171.4/min (max 313 px), ⚠️ 35.6 unexplained | ⚠️ 37 (max 387 px) | 132 ms | 103.1 | 0.7% | low (low) | android, 10 cores, 8 GB | b025a37 |
| 2026-11-13 03:58 | `p6sg8p` | raid | pyranda | gloomshade (raid boss) | 71 ms 🟢 (99) | 241 ms | 0.3% | 70.6/min (max 176 px), ⚠️ 58.3 unexplained | ⚠️ 34 (max 27 px) | 140 ms | 58.8 | 0.1% | high (high) | ios app, 4 cores | ea78f6e |
| 2026-11-13 02:32 | `yjzr6b` | duel vs bot | glacelle | lumoth (bot, hard) | 80 ms 🟡 (118) | 250 ms | 3.0% | 118.1/min (max 73 px), ⚠️ 63.2 unexplained | ⚠️ 41 (max 120 px) | 136 ms | 66.7 | 2.7% | low (low) | android, 10 cores, 8 GB | ea78f6e |
| 2026-11-13 02:28 | `clf6xe` | duel vs bot | lumoth | glacelle (bot, hard) | 87 ms 🟡 (99) | 254 ms | 2.4% | 136.1/min (max 109 px), ⚠️ 73.9 unexplained | ⚠️ 28 (max 103 px) | 148 ms | 65.4 | 4.1% | low (low) | android, 10 cores, 8 GB | ea78f6e |
| 2026-11-13 02:27 | `c2h9sf` | duel vs bot | tidefin | terradon (bot, hard) | 74 ms 🟢 (90) | 252 ms | 4.0% | 82.5/min (max 232 px), ⚠️ 47.6 unexplained | ⚠️ 28 (max 164 px) | 137 ms | 63.7 | 4.1% | low (low) | android, 10 cores, 8 GB | ea78f6e |
| 2026-11-13 02:22 | `lkiw92` | duel vs bot | mossloth | lumoth (bot, hard) | 64 ms 🟢 (81) | 238 ms | 3.4% | 142.1/min (max 457 px), ⚠️ 67.7 unexplained | ⚠️ 29 (max 122 px) | 113 ms | 67.1 | 11.6% | low (low) | android, 10 cores, 8 GB | ea78f6e |
| 2026-11-13 02:21 | `xztudp` | duel vs bot | mossloth | shadopus (bot, hard) | 65 ms 🟢 (112) | 237 ms | 2.6% | 121.4/min (max 390 px), ⚠️ 64.4 unexplained | ⚠️ 13 (max 402 px) | 113 ms | 91.7 | 2.7% | low (low) | android, 10 cores, 8 GB | ea78f6e |
| 2026-11-13 02:19 | `iaak87` | duel vs bot | mossloth | pangrove (bot, hard) | 76 ms 🟢 (110) | 234 ms | 3.1% | 90/min (max 201 px), ⚠️ 45 unexplained | ⚠️ 25 (max 167 px) | 122 ms | 96.2 | 1.1% | low (low) | android, 10 cores, 8 GB | ea78f6e |
| 2026-11-13 02:18 | `2sc0nx` | duel vs bot | mossloth | terradon (bot, hard) | 79 ms 🟢 (132) | 241 ms | 10.1% | 47.2/min (max 326 px), ⚠️ 28.1 unexplained | ⚠️ 3 (max 33 px) | 122 ms | 62.9 | 4.2% | low (low) | android, 10 cores, 8 GB | ea78f6e |
| 2026-11-13 02:17 | `h06l5b` | duel vs bot | mossloth | auralynx (bot, hard) | 72 ms 🟢 (93) | 247 ms | 5.9% | 107.9/min (max 198 px), ⚠️ 59 unexplained | ⚠️ 18 (max 133 px) | 146 ms | 76.3 | 2.5% | low (low) | android, 10 cores, 8 GB | ea78f6e |
| 2026-11-13 02:15 | `fi88xj` | duel vs bot | mossloth | tidefin (bot, hard) | 64 ms 🟢 (77) | 237 ms | 1.5% | 125.2/min (max 559 px), ⚠️ 68.8 unexplained | ⚠️ 83 (max 236 px) | 122 ms | 97.1 | 1.3% | low (low) | android, 10 cores, 8 GB | ea78f6e |
| 2026-11-13 02:12 | `kvo4b8` | duel vs bot | pangrove | glacelle (bot, hard) | 60 ms 🟢 (71) | 240 ms | 1.3% | 141/min (max 238 px), ⚠️ 34.9 unexplained | ⚠️ 38 (max 181 px) | 116 ms | 107.5 | 3.2% | low (low) | android, 10 cores, 8 GB | ea78f6e |
| 2026-11-12 08:09 | `02sky6` | raid | pyranda | gloomshade (raid boss) | 59 ms 🟢 (61) | 195 ms | 0.0% | 15.6/min (max 16 px), ⚠️ 13.3 unexplained | ⚠️ 1 (max 26 px) | 91 ms | 58.8 | 0.0% | high (high) | ios app, 4 cores | eb499fe |
| 2026-11-12 08:07 | `nxdi6k` | raid | pyranda | gloomshade (raid boss) | 58 ms 🟢 (61) | 190 ms | 0.0% | 13/min (max 8 px), ⚠️ 10.5 unexplained | ⚠️ 1 (max 27 px) | 90 ms | 58.8 | 0.0% | high (high) | ios app, 4 cores | eb499fe |
| 2026-11-12 08:03 | `z1e46k` | duel vs bot | tidefin | duskveil (bot, hard) | 78 ms 🟢 (88) | 208 ms | 0.0% | 50.1/min (max 69 px), ⚠️ 11.2 unexplained | ⚠️ 83 (max 99 px) | 138 ms | 58.8 | 0.0% | high (high) | ios app, 4 cores | eb499fe |
| 2026-11-11 18:43 | `5g05f6` | duel vs bot | lumoth | pyranda (bot, hard) | 68 ms 🟢 (277) | 218 ms | 2.3% | 76.8/min (max 187 px), ⚠️ 27.9 unexplained | ⚠️ 10 (max 172 px) | 114 ms | 61 | 6.1% | low (low) | android, 10 cores, 8 GB | 7c17f1d |
| 2026-11-11 18:39 | `6n3lkw` | duel vs bot | tidefin | pangrove (bot, hard) | 64 ms 🟢 (91) | 218 ms | 1.7% | 66.3/min (max 150 px), ⚠️ 32.1 unexplained | ⚠️ 46 (max 85 px) | 108 ms | 61 | 2.0% | low (low) | android, 10 cores, 8 GB | 7c17f1d |
| 2026-11-11 18:36 | `lzsko7` | duel vs bot | shadopus | terradon (bot, hard) | 56 ms 🟢 (66) | 222 ms | 1.5% | 62.9/min (max 232 px), ⚠️ 34.3 unexplained | ⚠️ 20 (max 82 px) | 101 ms | 77.5 | 1.6% | low (low) | android, 10 cores, 8 GB | 7c17f1d |
| 2026-11-11 18:34 | `uwjkl1` | duel vs bot | shadopus | terradon (bot, hard) | 54 ms 🟢 (65) | 215 ms | 0.4% | 60.3/min (max 235 px), ⚠️ 34.4 unexplained | ⚠️ 16 (max 45 px) | 102 ms | 90.1 | 1.6% | low (low) | android, 10 cores, 8 GB | 7c17f1d |
| 2026-11-11 18:33 | `660sb3` | duel vs bot | wombolder | shadopus (bot, hard) | 60 ms 🟢 (102) | 224 ms | 4.6% | 98.9/min (max 380 px), ⚠️ 32.3 unexplained | ⚠️ 22 (max 386 px) | 123 ms | 64.9 | 1.8% | low (low) | android, 10 cores, 8 GB | 7c17f1d |
| 2026-11-11 18:32 | `avhi16` | duel vs bot | astrabun | terradon (bot, hard) | 55 ms 🟢 (73) | 220 ms | 2.0% | 68.1/min (max 283 px), ⚠️ 34.7 unexplained | ⚠️ 10 (max 44 px) | 123 ms | 82.6 | 4.1% | low (low) | android, 10 cores, 8 GB | 7c17f1d |
| 2026-11-11 18:31 | `q6x8b9` | duel vs bot | pangrove | astrabun (bot, hard) | 71 ms 🟢 (83) | 218 ms | 2.1% | 93.6/min (max 323 px), ⚠️ 17.5 unexplained | ⚠️ 20 (max 182 px) | 98 ms | 71.4 | 3.6% | low (low) | android, 10 cores, 8 GB | 7c17f1d |
| 2026-11-11 18:30 | `3m1nqg` | duel vs bot | pangrove | halcyra (bot, hard) | 61 ms 🟢 (87) | 217 ms | 1.8% | 97/min (max 203 px), ⚠️ 8.4 unexplained | ⚠️ 22 (max 211 px) | 89 ms | 69.4 | 1.6% | low (low) | android, 10 cores, 8 GB | 7c17f1d |
| 2026-11-11 18:28 | `pv0d9x` | duel vs bot | pangrove | cindrake (bot, hard) | 63 ms 🟢 (92) | 223 ms | 4.8% | 107.8/min (max 173 px), ⚠️ 26.9 unexplained | ⚠️ 33 (max 184 px) | 94 ms | 61.3 | 17.7% | low (low) | android, 10 cores, 8 GB | 7c17f1d |
| 2026-11-11 18:27 | `lgi8go` | duel vs bot | pangrove | cindrake (bot, hard) | 57 ms 🟢 (69) | 215 ms | 1.6% | 91.2/min (max 226 px), ⚠️ 18 unexplained | ⚠️ 50 (max 209 px) | 98 ms | 68 | 3.9% | low (low) | android, 10 cores, 8 GB | 7c17f1d |
| 2026-11-11 18:26 | `uskvt8` | duel vs bot | pangrove | coilemur (bot, hard) | 60 ms 🟢 (75) | 219 ms | 1.6% | 140.9/min (max 205 px), ⚠️ 11.6 unexplained | ⚠️ 30 (max 104 px) | 115 ms | 62.9 | 3.4% | low (low) | android, 10 cores, 8 GB | 7c17f1d |
| 2026-11-11 18:25 | `32a9il` | duel vs bot | pangrove | halcyra (bot, hard) | 63 ms 🟢 (147) | 218 ms | 1.8% | 120/min (max 154 px), ⚠️ 27.2 unexplained | ⚠️ 29 (max 156 px) | 117 ms | 68.5 | 3.1% | low (low) | android, 10 cores, 8 GB | 7c17f1d |
| 2026-11-11 18:23 | `3ayaj0` | duel vs bot | voltkit | pangrove (bot, hard) | 63 ms 🟢 (98) | 217 ms | 1.1% | 68/min (max 140 px), ⚠️ 37.2 unexplained | ⚠️ 30 (max 114 px) | 98 ms | 66.2 | 5.6% | low (low) | android, 10 cores, 8 GB | 7c17f1d |
| 2026-11-11 18:21 | `k244kj` | duel vs bot | mossloth | auralynx (bot, hard) | 60 ms 🟢 (107) | 220 ms | 4.4% | 48.6/min (max 429 px), ⚠️ 23.8 unexplained | ⚠️ 13 (max 68 px) | 95 ms | 70.4 | 3.7% | low (low) | android, 10 cores, 8 GB | 7c17f1d |
| 2026-11-11 18:19 | `uuiqyl` | duel vs bot | mossloth | coilemur (bot, hard) | 57 ms 🟢 (79) | 216 ms | 2.5% | 45/min (max 337 px), ⚠️ 28.8 unexplained | ⚠️ 7 (max 56 px) | 95 ms | 80 | 2.0% | low (low) | android, 10 cores, 8 GB | 7c17f1d |
| 2026-11-11 18:17 | `gzuxes` | duel vs bot | mossloth | glacelle (bot, hard) | 52 ms 🟢 (58) | 213 ms | 0.2% | 88.3/min (max 525 px), ⚠️ 25.8 unexplained | ⚠️ 44 (max 337 px) | 94 ms | 92.6 | 2.2% | low (low) | android, 10 cores, 8 GB | 7c17f1d |
| 2026-11-11 04:40 | – | duel vs bot | tidefin | ? (bot) | 65 ms 🟢 (69) | 206 ms | 0.0% | 64.7/min (max 258 px) | – | 111 ms | 58.8 | 0.1% | high (high) | 4 cores | – |
| 2026-11-11 04:38 | – | duel vs bot | tidefin | ? (bot) | 65 ms 🟢 (72) | 210 ms | 0.0% | 101.8/min (max 320 px) | – | 153 ms | 58.8 | 0.0% | high (high) | 4 cores | – |
| 2026-11-11 04:37 | – | duel vs bot | tidefin | ? (bot) | 65 ms 🟢 (69) | 205 ms | 0.0% | 56.2/min (max 132 px) | – | 111 ms | 58.8 | 0.0% | high (high) | 4 cores | – |
| 2026-11-11 04:35 | – | duel vs bot | tidefin | ? (bot) | 67 ms 🟢 (71) | 205 ms | 0.0% | 113/min (max 246 px) | – | 109 ms | 58.8 | 0.0% | high (high) | 4 cores | – |
| 2026-11-11 04:34 | – | duel vs bot | tidefin | ? (bot) | 66 ms 🟢 (69) | 209 ms | 0.2% | 97.1/min (max 380 px) | – | 112 ms | 58.8 | 0.0% | high (high) | 4 cores | – |
| 2026-11-11 04:33 | – | duel vs bot | tidefin | ? (bot) | 68 ms 🟢 (78) | 205 ms | 0.0% | 105.1/min (max 366 px) | – | 104 ms | 58.8 | 0.0% | high (high) | 4 cores | – |
| 2026-11-11 04:32 | – | duel vs bot | cindrake | ? (bot) | 67 ms 🟢 (74) | 211 ms | 0.0% | 205.1/min (max 33 px) | – | 112 ms | 58.8 | 0.1% | high (high) | 4 cores | – |
| 2026-11-10 21:28 | – | duel | sunbara | – | – | – | – | – | – | – | 58.8 | 0.0% | medium (auto) | 4 cores | – |
| 2026-11-10 21:28 | – | duel | cindrake | – | – | – | – | – | – | – | 58.8 | 0.0% | high (high) | 4 cores | – |
| 2026-11-10 21:25 | – | duel | cindrake | – | – | – | – | – | – | – | 58.8 | 0.2% | medium (auto) | 4 cores | – |
| 2026-11-10 21:25 | – | duel | sunbara | – | – | – | – | – | – | – | 58.8 | 0.0% | high (high) | 4 cores | – |
| 2026-11-10 21:23 | – | duel | auralynx | – | – | – | – | – | – | – | 58.8 | 0.2% | medium (auto) | 4 cores | – |
| 2026-11-10 21:23 | – | duel | pangrove | – | – | – | – | – | – | – | 58.8 | 0.0% | high (high) | 4 cores | – |
| 2026-11-10 21:21 | – | duel | glacelle | – | – | – | – | – | – | – | 58.8 | 0.1% | medium (auto) | 4 cores | – |
| 2026-11-10 21:21 | – | duel | shadopus | – | – | – | – | – | – | – | 58.8 | 0.0% | high (high) | 4 cores | – |
| 2026-11-10 21:19 | – | duel | coilemur | – | – | – | – | – | – | – | 58.8 | 0.1% | medium (auto) | 4 cores | – |
| 2026-11-10 21:19 | – | duel | voltkit | – | – | – | – | – | – | – | 58.8 | 0.0% | high (high) | 4 cores | – |
| 2026-11-10 21:15 | – | duel | halcyra | – | – | – | – | – | – | – | 58.8 | 0.1% | high (high) | 4 cores | – |
| 2026-11-10 21:15 | – | duel | halcyra | – | – | – | – | – | – | – | 58.8 | 0.1% | low (auto) | 4 cores | – |

## By day

| Day (UTC) | Reports | Needs attention | Ping, median | Ping, worst 10% | Lead, median | Jumps/min, median | Skill confirm, median | FPS, median | Stutter, median | Dropped connections |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
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
