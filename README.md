# Match reports

Newest report: 2026-11-19 08:17 UTC. From the game server's log (`scripts/perf/export-perf-reports.mjs` on `main`). One row per player's device per match; times are UTC. No accounts or names are kept.

## Needs attention

- **2026-11-19 08:17**, halcyra against shadopus (bot, hard) (match `4rzbbv`):
  - 19.7 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 28 halcyra shadopus`.
  - 21 hit(s) landed while you were drawn over 24 px away (largest 394 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-19 08:15**, mossloth against shadopus (bot, hard) (match `pk3w7q`):
  - 16 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 29 mossloth shadopus`.
  - 20 hit(s) landed while you were drawn over 24 px away (largest 211 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-19 08:14**, mossloth against shadopus (bot, hard) (match `5hmibd`):
  - 16.8 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 28 mossloth shadopus`.
  - 14 hit(s) landed while you were drawn over 24 px away (largest 273 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-19 08:13**, pyranda against coilemur (bot, normal) (match `rvtlyz`):
  - 1 hit(s) landed while you were drawn over 24 px away (largest 42 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 107.4 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-19 05:31**, pangrove against pangrove (bot, normal) (match `j6eqdt`):
  - 18 hit(s) landed while you were drawn over 24 px away (largest 122 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 68.7 times a minute (up to 2 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-19 05:26**, tidefin against pyranda (bot, hard) (match `dumia1`):
  - 49 hit(s) landed while you were drawn over 24 px away (largest 132 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
  - Wi-Fi held the phone's inputs 31.7 times a minute (up to 3 ticks): the player's network. Each hold now waits rather than jumps; long ones still look like lag.
- **2026-11-19 04:13**, tidefin against duskveil (bot, normal) (match `s1l0v1`):
  - 3.4 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 29 tidefin duskveil`.
  - 24 hit(s) landed while you were drawn over 24 px away (largest 94 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-19 02:55**, tidefin against cindrake (bot, normal) (match `5zjvij`):
  - slow connection: ping 47 ms, slowest 5% 370 ms. The player's network: compare other players at the same time before changing the game.
  - 3.3 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 24 tidefin cindrake`.
  - 9 hit(s) landed while you were drawn over 24 px away (largest 42 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-19 00:57**, tidefin against sunbara (bot, easy) (match `vrajjw`):
  - 12 hit(s) landed while you were drawn over 24 px away (largest 137 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 14:07**, wombolder against voltkit (bot, easy) (match `464s0w`):
  - 5.7 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 31 wombolder voltkit`.
  - 12 hit(s) landed while you were drawn over 24 px away (largest 106 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:55**, coilemur against pyranda (match `i5vb16`):
  - 13.1 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 22 coilemur pyranda`.
  - 31 hit(s) landed while you were drawn over 24 px away (largest 56 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:55**, pyranda against coilemur (match `i5vb16`):
  - 17.1 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 23 pyranda coilemur`.
  - 8 hit(s) landed while you were drawn over 24 px away (largest 45 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:54**, pyranda against coilemur (match `poelrm`):
  - 20.9 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 23 pyranda coilemur`.
  - 15 hit(s) landed while you were drawn over 24 px away (largest 95 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:54**, coilemur against pyranda (match `poelrm`):
  - 13.6 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 24 coilemur pyranda`.
  - 37 hit(s) landed while you were drawn over 24 px away (largest 99 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:50**, sunbara against coilemur, mystowl (match `gbzdq7`):
  - 12.2 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 29 sunbara coilemur`.
  - 30 hit(s) landed while you were drawn over 24 px away (largest 73 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:50**, mystowl against coilemur, sunbara (match `gbzdq7`):
  - 13.7 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 24 mystowl coilemur`.
  - 21 hit(s) landed while you were drawn over 24 px away (largest 326 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:50**, coilemur against sunbara, mystowl (match `gbzdq7`):
  - 14.5 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 23 coilemur sunbara`.
  - 56 hit(s) landed while you were drawn over 24 px away (largest 117 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:46**, mystowl against coilemur, sunbara (match `ffmh8v`):
  - 18.1 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 24 mystowl coilemur`.
  - 33 hit(s) landed while you were drawn over 24 px away (largest 97 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:46**, sunbara against coilemur, mystowl (match `ffmh8v`):
  - 12.5 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 27 sunbara coilemur`.
  - 40 hit(s) landed while you were drawn over 24 px away (largest 123 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:46**, coilemur against sunbara, mystowl (match `ffmh8v`):
  - 18.9 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 22 coilemur sunbara`.
  - 60 hit(s) landed while you were drawn over 24 px away (largest 105 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:42**, halcyra against mystowl, coilemur (match `bdsxpw`):
  - 11.6 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 23 halcyra mystowl`.
  - 32 hit(s) landed while you were drawn over 24 px away (largest 285 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:42**, mystowl against halcyra, coilemur (match `bdsxpw`):
  - 17.3 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 27 mystowl halcyra`.
  - 18 hit(s) landed while you were drawn over 24 px away (largest 40 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:42**, coilemur against halcyra, mystowl (match `bdsxpw`):
  - 14.5 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 24 coilemur halcyra`.
  - 43 hit(s) landed while you were drawn over 24 px away (largest 77 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:39**, coilemur against halcyra, mystowl (match `dwqsxr`):
  - 20.4 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 24 coilemur halcyra`.
  - 28 hit(s) landed while you were drawn over 24 px away (largest 103 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:39**, mystowl against halcyra, coilemur (match `dwqsxr`):
  - 11.4 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 27 mystowl halcyra`.
  - 18 hit(s) landed while you were drawn over 24 px away (largest 60 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:39**, halcyra against mystowl, coilemur (match `dwqsxr`):
  - 21.6 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 23 halcyra mystowl`.
  - 16 hit(s) landed while you were drawn over 24 px away (largest 270 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:36**, pyranda against mossloth, astrabun (match `b2274j`):
  - 17 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 25 pyranda mossloth`.
  - 10 hit(s) landed while you were drawn over 24 px away (largest 65 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:36**, mossloth against astrabun, pyranda (match `b2274j`):
  - 17.8 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 23 mossloth astrabun`.
  - 51 hit(s) landed while you were drawn over 24 px away (largest 119 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:36**, astrabun against mossloth, pyranda (match `b2274j`):
  - 9.3 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 26 astrabun mossloth`.
  - 47 hit(s) landed while you were drawn over 24 px away (largest 197 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:32**, wombolder against mossloth, lumoth (match `r90zmf`):
  - 18.9 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 30 wombolder mossloth`.
  - 36 hit(s) landed while you were drawn over 24 px away (largest 124 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:32**, mossloth against wombolder, lumoth (match `r90zmf`):
  - 20.3 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 23 mossloth wombolder`.
  - 25 hit(s) landed while you were drawn over 24 px away (largest 36 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:32**, lumoth against mossloth, wombolder (match `r90zmf`):
  - 11.1 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 24 lumoth mossloth`.
  - 14 hit(s) landed while you were drawn over 24 px away (largest 43 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:29**, mossloth against wombolder, shadopus (match `ubs3bx`):
  - 19.7 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 23 mossloth wombolder`.
  - 31 hit(s) landed while you were drawn over 24 px away (largest 386 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:29**, shadopus against mossloth, wombolder (match `ubs3bx`):
  - drawing slow: 58.8 fps, 5.9% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 22.2 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 24 shadopus mossloth`.
  - 38 hit(s) landed while you were drawn over 24 px away (largest 52 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:29**, wombolder against mossloth, shadopus (match `ubs3bx`):
  - 21.2 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 27 wombolder mossloth`.
  - 51 hit(s) landed while you were drawn over 24 px away (largest 202 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:24**, pyranda against mossloth, voltkit (match `7ghcts`):
  - 15.4 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 24 pyranda mossloth`.
  - 16 hit(s) landed while you were drawn over 24 px away (largest 45 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:24**, voltkit against mossloth, pyranda (match `7ghcts`):
  - 8.7 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 27 voltkit mossloth`.
  - 38 hit(s) landed while you were drawn over 24 px away (largest 80 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:24**, mossloth against voltkit, pyranda (match `7ghcts`):
  - 17.9 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 23 mossloth voltkit`.
  - 47 hit(s) landed while you were drawn over 24 px away (largest 83 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:20**, mossloth against halcyra, pyranda (match `aehq1l`):
  - 18.9 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 24 mossloth halcyra`.
  - 39 hit(s) landed while you were drawn over 24 px away (largest 86 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:20**, pyranda against mossloth, halcyra (match `aehq1l`):
  - 5.4 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 23 pyranda mossloth`.
  - 9 hit(s) landed while you were drawn over 24 px away (largest 81 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:20**, halcyra against mossloth, pyranda (match `aehq1l`):
  - 10 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 24 halcyra mossloth`.
  - 36 hit(s) landed while you were drawn over 24 px away (largest 39 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:16**, pyranda against mossloth, pyranda (match `83v9fa`):
  - 14.1 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 24 pyranda mossloth`.
  - 12 hit(s) landed while you were drawn over 24 px away (largest 35 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:16**, mossloth against pyranda, pyranda (match `83v9fa`):
  - 18 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 25 mossloth pyranda`.
  - 45 hit(s) landed while you were drawn over 24 px away (largest 84 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:16**, pyranda against mossloth, pyranda (match `83v9fa`):
  - 6.3 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 25 pyranda mossloth`.
  - 22 hit(s) landed while you were drawn over 24 px away (largest 35 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:13**, mossloth against pyranda, pyranda (match `93bjir`):
  - 19.5 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 25 mossloth pyranda`.
  - 36 hit(s) landed while you were drawn over 24 px away (largest 208 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:13**, pyranda against mossloth, pyranda (match `93bjir`):
  - drawing slow: 52.6 fps, 5.3% stutter at low graphics. Reproduce with tests/visual/effect-budget.spec.ts; ?perf=1 shows it live.
  - 20.3 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 24 pyranda mossloth`.
  - 11 hit(s) landed while you were drawn over 24 px away (largest 42 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:13**, pyranda against mossloth, pyranda (match `93bjir`):
  - 13.1 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 28 pyranda mossloth`.
  - 23 hit(s) landed while you were drawn over 24 px away (largest 59 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:10**, mossloth against wombolder, tidefin (match `k5x2go`):
  - 18.7 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 24 mossloth wombolder`.
  - 36 hit(s) landed while you were drawn over 24 px away (largest 126 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:10**, wombolder against mossloth, tidefin (match `k5x2go`):
  - 10.1 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 28 wombolder mossloth`.
  - 47 hit(s) landed while you were drawn over 24 px away (largest 155 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.
- **2026-11-18 02:10**, tidefin against mossloth, wombolder (match `k5x2go`):
  - 10.1 unexplained jumps a minute: the phone's prediction disagrees with the server for no reason. Reproduce with `npx tsx scripts/perf/correction-sim.ts 120 23 tidefin mossloth`.
  - 24 hit(s) landed while you were drawn over 24 px away (largest 46 px): "I dodged but still got hit". See docs/network-performance.md, sections 9 and 11.

## Latest matches

| Time (UTC) | Match | Mode | You | Against | Ping (slowest 5%) | Lead | Late updates | Jumps | Hits off-screen | Skill confirm | FPS | Stutter | Graphics | Device | Build |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-19 08:17 | `4rzbbv` | duel vs bot | halcyra | shadopus (bot, hard) | 55 ms 🟢 (59) | 189 ms | 0.0% | 62.1/min (max 666 px), ⚠️ 19.7 unexplained | ⚠️ 21 (max 394 px) | 83 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 13e4685 |
| 2026-11-19 08:15 | `pk3w7q` | duel vs bot | mossloth | shadopus (bot, hard) | 57 ms 🟢 (62) | 189 ms | 0.0% | 62.4/min (max 276 px), ⚠️ 16 unexplained | ⚠️ 20 (max 211 px) | 78 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 13e4685 |
| 2026-11-19 08:14 | `5hmibd` | duel vs bot | mossloth | shadopus (bot, hard) | 56 ms 🟢 (74) | 185 ms | 0.0% | 54.7/min (max 324 px), ⚠️ 16.8 unexplained | ⚠️ 14 (max 273 px) | 85 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 13e4685 |
| 2026-11-19 08:13 | `rvtlyz` | duel vs bot | pyranda | coilemur (bot, normal) | 55 ms 🟢 (62) | 160 ms | 0.0% | 11.6/min (max 70 px), ⚠️ 2.9 unexplained | ⚠️ 1 (max 42 px) | 88 ms | 58.8 | 0.1% | high (auto) | ios, 4 cores, 59 Hz | 13e4685 |
| 2026-11-19 05:31 | `j6eqdt` | duel vs bot | pangrove | pangrove (bot, normal) | 56 ms 🟢 (61) | 182 ms | 0.0% | 62.6/min (max 257 px), ⚠️ 2.5 unexplained | ⚠️ 18 (max 122 px) | 95 ms | 58.8 | 0.1% | high (auto) | ios, 4 cores, 59 Hz | 547fae8 |
| 2026-11-19 05:26 | `dumia1` | duel vs bot | tidefin | pyranda (bot, hard) | 62 ms 🟢 (67) | 190 ms | 0.0% | 30.3/min (max 150 px) | ⚠️ 49 (max 132 px) | 91 ms | 58.8 | 0.0% | high (auto) | ios, 4 cores, 59 Hz | 547fae8 |
| 2026-11-19 04:13 | `s1l0v1` | duel vs bot | tidefin | duskveil (bot, normal) | 57 ms 🟢 (60) | 192 ms | 0.0% | 43.8/min (max 100 px), ⚠️ 3.4 unexplained | ⚠️ 24 (max 94 px) | 147 ms | 58.8 | 0.1% | high (auto) | ios, 4 cores, 59 Hz | f3b7c0e |
| 2026-11-19 02:55 | `5zjvij` | duel vs bot | tidefin | cindrake (bot, normal) | 47 ms 🟢 (370) | 167 ms | 0.0% | 19.7/min (max 65 px), ⚠️ 3.3 unexplained | ⚠️ 9 (max 42 px) | 144 ms | 58.8 | 0.1% | high (auto) | ios, 4 cores, 59 Hz | cab4536 |
| 2026-11-19 00:57 | `vrajjw` | duel vs bot | tidefin | sunbara (bot, easy) | 45 ms 🟢 (46) | 193 ms | 0.2% | 33.6/min (max 70 px), ⚠️ 2.8 unexplained | ⚠️ 12 (max 137 px) | 75 ms | 58.8 | 0.1% | high (auto) | ios app, 4 cores, 59 Hz | 9a70a33 |
| 2026-11-18 14:07 | `464s0w` | duel vs bot | wombolder | voltkit (bot, easy) | 61 ms 🟢 (67) | 201 ms | 0.0% | 40.1/min (max 186 px), ⚠️ 5.7 unexplained | ⚠️ 12 (max 106 px) | 106 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | 931f84f |
| 2026-11-18 02:55 | `i5vb16` | duel | coilemur | pyranda | 44 ms 🟢 (45) | 178 ms | 0.4% | 56.4/min (max 90 px), ⚠️ 13.1 unexplained | ⚠️ 31 (max 56 px) | 120 ms | 59.9 | 0.6% | high (auto) | android, 8 cores, 8 GB, 120 Hz | a65a754 |
| 2026-11-18 02:55 | `i5vb16` | duel | pyranda | coilemur | 45 ms 🟢 (47) | 168 ms | 0.0% | 40.7/min (max 248 px), ⚠️ 17.1 unexplained | ⚠️ 8 (max 45 px) | 61 ms | 58.8 | 0.1% | low (auto) | ios app, 4 cores, 59 Hz | a65a754 |
| 2026-11-18 02:54 | `poelrm` | duel | pyranda | coilemur | 46 ms 🟢 (80) | 172 ms | 1.5% | 49.1/min (max 70 px), ⚠️ 20.9 unexplained | ⚠️ 15 (max 95 px) | 67 ms | 58.8 | 0.1% | low (auto) | ios app, 4 cores, 59 Hz | a65a754 |
| 2026-11-18 02:54 | `poelrm` | duel | coilemur | pyranda | 47 ms 🟢 (61) | 177 ms | 1.1% | 47.1/min (max 130 px), ⚠️ 13.6 unexplained | ⚠️ 37 (max 99 px) | 75 ms | 59.9 | 0.8% | high (auto) | android, 8 cores, 8 GB, 120 Hz | a65a754 |
| 2026-11-18 02:50 | `gbzdq7` | ffa | sunbara | coilemur, mystowl | 57 ms 🟢 (113) | 168 ms | 1.3% | 40.5/min (max 260 px), ⚠️ 12.2 unexplained | ⚠️ 30 (max 73 px) | 78 ms | 58.8 | 0.2% | high (auto) | ios app, 4 cores, 59 Hz | a65a754 |
| 2026-11-18 02:50 | `gbzdq7` | ffa | mystowl | coilemur, sunbara | 48 ms 🟢 (72) | 168 ms | 0.5% | 33.4/min (max 315 px), ⚠️ 13.7 unexplained | ⚠️ 21 (max 326 px) | 71 ms | 58.8 | 0.7% | low (auto) | ios app, 4 cores, 56 Hz | a65a754 |
| 2026-11-18 02:50 | `gbzdq7` | ffa | coilemur | sunbara, mystowl | 45 ms 🟢 (52) | 171 ms | 0.9% | 43/min (max 260 px), ⚠️ 14.5 unexplained | ⚠️ 56 (max 117 px) | 86 ms | 59.9 | 0.7% | high (auto) | android, 8 cores, 8 GB, 120 Hz | a65a754 |
| 2026-11-18 02:46 | `ffmh8v` | ffa | mystowl | coilemur, sunbara | 47 ms 🟢 (68) | 170 ms | 1.1% | 46.4/min (max 600 px), ⚠️ 18.1 unexplained | ⚠️ 33 (max 97 px) | 66 ms | 58.8 | 0.4% | low (auto) | ios app, 4 cores, 48 Hz | a65a754 |
| 2026-11-18 02:46 | `ffmh8v` | ffa | sunbara | coilemur, mystowl | 53 ms 🟢 (79) | 167 ms | 1.1% | 40.4/min (max 116 px), ⚠️ 12.5 unexplained | ⚠️ 40 (max 123 px) | 80 ms | 58.8 | 0.1% | high (auto) | ios app, 4 cores, 59 Hz | a65a754 |
| 2026-11-18 02:46 | `ffmh8v` | ffa | coilemur | sunbara, mystowl | 44 ms 🟢 (49) | 185 ms | 1.5% | 59.2/min (max 116 px), ⚠️ 18.9 unexplained | ⚠️ 60 (max 105 px) | 92 ms | 59.9 | 0.9% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | a65a754 |
| 2026-11-18 02:42 | `bdsxpw` | ffa | halcyra | mystowl, coilemur | 45 ms 🟢 (49) | 165 ms | 0.9% | 35.7/min (max 452 px), ⚠️ 11.6 unexplained | ⚠️ 32 (max 285 px) | 72 ms | 59.9 | 0.5% | medium (auto) | android, 8 cores, 8 GB, 60 Hz | a65a754 |
| 2026-11-18 02:42 | `bdsxpw` | ffa | mystowl | halcyra, coilemur | 54 ms 🟢 (87) | 176 ms | 1.6% | 43.4/min (max 335 px), ⚠️ 17.3 unexplained | ⚠️ 18 (max 40 px) | 75 ms | 58.8 | 0.1% | high (auto) | ios app, 4 cores, 59 Hz | a65a754 |
| 2026-11-18 02:42 | `bdsxpw` | ffa | coilemur | halcyra, mystowl | 48 ms 🟢 (85) | 172 ms | 1.2% | 55.4/min (max 160 px), ⚠️ 14.5 unexplained | ⚠️ 43 (max 77 px) | 63 ms | 58.8 | 0.8% | low (auto) | ios app, 4 cores, 59 Hz | a65a754 |
| 2026-11-18 02:39 | `dwqsxr` | ffa | coilemur | halcyra, mystowl | 47 ms 🟢 (78) | 172 ms | 0.9% | 52.1/min (max 160 px), ⚠️ 20.4 unexplained | ⚠️ 28 (max 103 px) | 73 ms | 58.8 | 1.5% | low (auto) | ios app, 4 cores, 45 Hz | a65a754 |
| 2026-11-18 02:39 | `dwqsxr` | ffa | mystowl | halcyra, coilemur | 54 ms 🟢 (87) | 171 ms | 0.8% | 29.4/min (max 160 px), ⚠️ 11.4 unexplained | ⚠️ 18 (max 60 px) | 78 ms | 58.8 | 0.1% | high (auto) | ios app, 4 cores, 59 Hz | a65a754 |
| 2026-11-18 02:39 | `dwqsxr` | ffa | halcyra | mystowl, coilemur | 46 ms 🟢 (75) | 178 ms | 1.5% | 40.8/min (max 451 px), ⚠️ 21.6 unexplained | ⚠️ 16 (max 270 px) | 62 ms | 59.9 | 0.9% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | a65a754 |
| 2026-11-18 02:36 | `b2274j` | ffa | pyranda | mossloth, astrabun | 50 ms 🟢 (63) | 172 ms | 1.4% | 41.1/min (max 451 px), ⚠️ 17 unexplained | ⚠️ 10 (max 65 px) | 75 ms | 55.6 | 2.1% | low (auto) | ios app, 4 cores, 48 Hz | a65a754 |
| 2026-11-18 02:36 | `b2274j` | ffa | mossloth | astrabun, pyranda | 46 ms 🟢 (73) | 181 ms | 1.1% | 43.2/min (max 447 px), ⚠️ 17.8 unexplained | ⚠️ 51 (max 119 px) | 81 ms | 59.9 | 0.9% | medium (auto) | android, 8 cores, 8 GB, 60 Hz | a65a754 |
| 2026-11-18 02:36 | `b2274j` | ffa | astrabun | mossloth, pyranda | 52 ms 🟢 (79) | 163 ms | 1.0% | 44.1/min (max 295 px), ⚠️ 9.3 unexplained | ⚠️ 47 (max 197 px) | 104 ms | 58.8 | 0.2% | high (auto) | ios app, 4 cores, 59 Hz | a65a754 |
| 2026-11-18 02:32 | `r90zmf` | ffa | wombolder | mossloth, lumoth | 60 ms 🟢 (89) | 176 ms | 2.1% | 60/min (max 180 px), ⚠️ 18.9 unexplained | ⚠️ 36 (max 124 px) | 76 ms | 58.8 | 0.1% | high (auto) | ios app, 4 cores, 59 Hz | a65a754 |
| 2026-11-18 02:32 | `r90zmf` | ffa | mossloth | wombolder, lumoth | 45 ms 🟢 (47) | 181 ms | 0.6% | 51.8/min (max 460 px), ⚠️ 20.3 unexplained | ⚠️ 25 (max 36 px) | 80 ms | 59.9 | 1.1% | medium (auto) | android, 8 cores, 8 GB, 119 Hz | a65a754 |
| 2026-11-18 02:32 | `r90zmf` | ffa | lumoth | mossloth, wombolder | 48 ms 🟢 (53) | 164 ms | 0.0% | 34.9/min (max 479 px), ⚠️ 11.1 unexplained | ⚠️ 14 (max 43 px) | 62 ms | 58.8 | 0.3% | low (auto) | ios app, 4 cores, 59 Hz | a65a754 |
| 2026-11-18 02:29 | `ubs3bx` | ffa | mossloth | wombolder, shadopus | 45 ms 🟢 (53) | 174 ms | 0.3% | 42.2/min (max 427 px), ⚠️ 19.7 unexplained | ⚠️ 31 (max 386 px) | 74 ms | 59.9 | 0.8% | medium (auto) | android, 8 cores, 8 GB, 60 Hz | a65a754 |
| 2026-11-18 02:29 | `ubs3bx` | ffa | shadopus | mossloth, wombolder | 48 ms 🟢 (72) | 173 ms | 1.1% | 57.1/min (max 445 px), ⚠️ 22.2 unexplained | ⚠️ 38 (max 52 px) | 71 ms | 58.8 | 5.9% | low (auto) | ios app, 4 cores, 40 Hz | a65a754 |
| 2026-11-18 02:29 | `ubs3bx` | ffa | wombolder | mossloth, shadopus | 54 ms 🟢 (101) | 178 ms | 2.0% | 65.2/min (max 426 px), ⚠️ 21.2 unexplained | ⚠️ 51 (max 202 px) | 79 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | a65a754 |
| 2026-11-18 02:24 | `7ghcts` | ffa | pyranda | mossloth, voltkit | 48 ms 🟢 (55) | 171 ms | 1.2% | 42.1/min (max 602 px), ⚠️ 15.4 unexplained | ⚠️ 16 (max 45 px) | 65 ms | 58.8 | 0.4% | low (auto) | ios app, 4 cores, 43 Hz | a65a754 |
| 2026-11-18 02:24 | `7ghcts` | ffa | voltkit | mossloth, pyranda | 53 ms 🟢 (65) | 166 ms | 0.8% | 37.1/min (max 437 px), ⚠️ 8.7 unexplained | ⚠️ 38 (max 80 px) | 86 ms | 58.8 | 0.1% | high (auto) | ios app, 4 cores, 59 Hz | a65a754 |
| 2026-11-18 02:24 | `7ghcts` | ffa | mossloth | voltkit, pyranda | 45 ms 🟢 (57) | 182 ms | 0.4% | 48.7/min (max 591 px), ⚠️ 17.9 unexplained | ⚠️ 47 (max 83 px) | 77 ms | 59.9 | 0.8% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | a65a754 |
| 2026-11-18 02:20 | `aehq1l` | ffa | mossloth | halcyra, pyranda | 48 ms 🟢 (67) | 182 ms | 1.3% | 45.6/min (max 472 px), ⚠️ 18.9 unexplained | ⚠️ 39 (max 86 px) | 77 ms | 59.9 | 1.1% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | ebd7a37 |
| 2026-11-18 02:20 | `aehq1l` | ffa | pyranda | mossloth, halcyra | 45 ms 🟢 (49) | 146 ms | 0.7% | 27/min (max 492 px), ⚠️ 5.4 unexplained | ⚠️ 9 (max 81 px) | 72 ms | 58.8 | 0.6% | low (auto) | ios app, 4 cores, 59 Hz | ebd7a37 |
| 2026-11-18 02:20 | `aehq1l` | ffa | halcyra | mossloth, pyranda | 48 ms 🟢 (77) | 172 ms | 0.4% | 40.6/min (max 422 px), ⚠️ 10 unexplained | ⚠️ 36 (max 39 px) | 74 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | ebd7a37 |
| 2026-11-18 02:16 | `83v9fa` | ffa | pyranda | mossloth, pyranda | 47 ms 🟢 (55) | 161 ms | 1.2% | 37.4/min (max 477 px), ⚠️ 14.1 unexplained | ⚠️ 12 (max 35 px) | 72 ms | 58.8 | 1.6% | low (auto) | ios app, 4 cores, 48 Hz | ebd7a37 |
| 2026-11-18 02:16 | `83v9fa` | ffa | mossloth | pyranda, pyranda | 49 ms 🟢 (64) | 184 ms | 1.3% | 39.4/min (max 473 px), ⚠️ 18 unexplained | ⚠️ 45 (max 84 px) | 76 ms | 59.9 | 0.9% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | ebd7a37 |
| 2026-11-18 02:16 | `83v9fa` | ffa | pyranda | mossloth, pyranda | 49 ms 🟢 (59) | 157 ms | 0.6% | 28.7/min (max 451 px), ⚠️ 6.3 unexplained | ⚠️ 22 (max 35 px) | 83 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | ebd7a37 |
| 2026-11-18 02:13 | `93bjir` | ffa | mossloth | pyranda, pyranda | 50 ms 🟢 (71) | 186 ms | 1.1% | 36/min (max 397 px), ⚠️ 19.5 unexplained | ⚠️ 36 (max 208 px) | 88 ms | 59.9 | 1.0% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | ebd7a37 |
| 2026-11-18 02:13 | `93bjir` | ffa | pyranda | mossloth, pyranda | 47 ms 🟢 (81) | 172 ms | 0.6% | 45.7/min (max 417 px), ⚠️ 20.3 unexplained | ⚠️ 11 (max 42 px) | 67 ms | 52.6 | 5.3% | low (auto) | ios app, 4 cores, 40 Hz | ebd7a37 |
| 2026-11-18 02:13 | `93bjir` | ffa | pyranda | mossloth, pyranda | 55 ms 🟢 (81) | 167 ms | 1.9% | 37.7/min (max 260 px), ⚠️ 13.1 unexplained | ⚠️ 23 (max 59 px) | 120 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | ebd7a37 |
| 2026-11-18 02:10 | `k5x2go` | ffa | mossloth | wombolder, tidefin | 47 ms 🟢 (74) | 184 ms | 0.9% | 48.6/min (max 496 px), ⚠️ 18.7 unexplained | ⚠️ 36 (max 126 px) | 78 ms | 59.9 | 0.9% | medium (auto) | android, 8 cores, 8 GB, 120 Hz | ebd7a37 |
| 2026-11-18 02:10 | `k5x2go` | ffa | wombolder | mossloth, tidefin | 56 ms 🟢 (111) | 169 ms | 1.3% | 62.9/min (max 173 px), ⚠️ 10.1 unexplained | ⚠️ 47 (max 155 px) | 75 ms | 58.8 | 0.0% | high (auto) | ios app, 4 cores, 59 Hz | ebd7a37 |
| 2026-11-18 02:10 | `k5x2go` | ffa | tidefin | mossloth, wombolder | 46 ms 🟢 (61) | 170 ms | 0.9% | 37.8/min (max 497 px), ⚠️ 10.1 unexplained | ⚠️ 24 (max 46 px) | 70 ms | 58.8 | 0.0% | low (auto) | ios app, 4 cores, 59 Hz | ebd7a37 |

## By day

| Day (UTC) | Reports | Needs attention | Ping, median | Ping, worst 10% | Lead, median | Jumps/min, median | Skill confirm, median | FPS, median | Stutter, median | Dropped connections |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-19 | 9 | 9 | 56 ms | 62 ms | 189 ms | 43.8 | 88 ms | 58.8 | 0.1% | 1 transport close |
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
