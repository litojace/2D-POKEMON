# Match reports

Newest report: 2026-11-10 21:28 UTC. From the game server's log (`scripts/perf/export-perf-reports.mjs` on `main`). One row per player's device per match; times are UTC. No accounts or names are kept.

- **Ping**: round trip to the server (the badge in battle): 🟢 under 80 ms, 🟡 under 150, 🔴 above.
- **Lead**: how far ahead of the last server update your fighter (and the shots around it) is drawn, on average.
- **FPS**: frames per second at the median frame. **Slowest 5%**: the 95th percentile frame time.
- **Stutter**: share of the time in frames that missed 30 fps. **Stalls**: frames over 250 ms.
- Ping and Lead are reported from the 10 Nov 2026 update (23:23 UTC) on; older rows show –.

## Latest matches

| Time (UTC) | Mode | Champion | Ping | Lead | FPS | Slowest 5% | Stutter | Stalls | Graphics | Device |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-10 21:28 | duel | sunbara | – | – | 58.8 | 19 ms | 0.0% | 0 | medium (auto) | 4 cores |
| 2026-11-10 21:28 | duel | cindrake | – | – | 58.8 | 17 ms | 0.0% | 0 | high (high) | 4 cores |
| 2026-11-10 21:25 | duel | cindrake | – | – | 58.8 | 19 ms | 0.2% | 0 | medium (auto) | 4 cores |
| 2026-11-10 21:25 | duel | sunbara | – | – | 58.8 | 17 ms | 0.0% | 0 | high (high) | 4 cores |
| 2026-11-10 21:23 | duel | auralynx | – | – | 58.8 | 19 ms | 0.2% | 0 | medium (auto) | 4 cores |
| 2026-11-10 21:23 | duel | pangrove | – | – | 58.8 | 17 ms | 0.0% | 0 | high (high) | 4 cores |
| 2026-11-10 21:21 | duel | glacelle | – | – | 58.8 | 19 ms | 0.1% | 0 | medium (auto) | 4 cores |
| 2026-11-10 21:21 | duel | shadopus | – | – | 58.8 | 18 ms | 0.0% | 0 | high (high) | 4 cores |
| 2026-11-10 21:19 | duel | coilemur | – | – | 58.8 | 19 ms | 0.1% | 0 | medium (auto) | 4 cores |
| 2026-11-10 21:19 | duel | voltkit | – | – | 58.8 | 17 ms | 0.0% | 0 | high (high) | 4 cores |
| 2026-11-10 21:15 | duel | halcyra | – | – | 58.8 | 17 ms | 0.1% | 0 | high (high) | 4 cores |
| 2026-11-10 21:15 | duel | halcyra | – | – | 58.8 | 19 ms | 0.1% | 0 | low (auto) | 4 cores |
| 2026-11-10 21:12 | duel | halcyra | – | – | 58.8 | 17 ms | 0.0% | 0 | high (high) | 4 cores |
| 2026-11-10 21:12 | duel | mystowl | – | – | 58.8 | 19 ms | 0.1% | 0 | low (auto) | 4 cores |
| 2026-11-10 21:11 | duel | terradon | – | – | 58.8 | 17 ms | 0.0% | 0 | high (high) | 4 cores |
| 2026-11-10 21:11 | duel | pyranda | – | – | 58.8 | 19 ms | 0.2% | 0 | low (auto) | 4 cores |
| 2026-11-10 21:09 | duel | wombolder | – | – | 58.8 | 17 ms | 0.0% | 0 | high (high) | 4 cores |
| 2026-11-10 21:09 | duel | sunbara | – | – | 58.8 | 19 ms | 0.1% | 0 | low (auto) | 4 cores |
| 2026-11-10 21:06 | duel | voltkit | – | – | 58.8 | 19 ms | 0.1% | 0 | low (auto) | 4 cores |
| 2026-11-10 21:06 | duel | pyranda | – | – | 58.8 | 17 ms | 0.0% | 0 | high (high) | 4 cores |
| 2026-11-10 21:02 | duel | wombolder | – | – | 58.8 | 17 ms | 0.0% | 0 | high (high) | 4 cores |
| 2026-11-10 21:02 | duel | tidefin | – | – | 58.8 | 19 ms | 0.1% | 0 | low (auto) | 4 cores |
| 2026-11-10 20:58 | duel | wombolder | – | – | 58.8 | 20 ms | 0.1% | 0 | low (auto) | 4 cores |
| 2026-11-10 20:58 | duel | cindrake | – | – | 58.8 | 17 ms | 0.0% | 0 | high (high) | 4 cores |
| 2026-11-10 20:54 | duel | pangrove | – | – | 58.8 | 20 ms | 0.2% | 0 | low (auto) | 4 cores |
| 2026-11-10 20:54 | duel | astrabun | – | – | 58.8 | 17 ms | 0.1% | 0 | high (high) | 4 cores |
| 2026-11-10 20:50 | duel | mossloth | – | – | 49.3 | 34.6 ms | 11.1% | 1 | high (auto) | 9 cores, 8 GB |
| 2026-11-10 20:50 | duel | pangrove | – | – | 58.8 | 17 ms | 0.0% | 0 | high (high) | 4 cores |
| 2026-11-10 17:49 | duel vs bot | pyranda | – | – | 106.4 | 20.4 ms | 1.2% | 0 | low (low) | 10 cores, 8 GB |

## By day

| Day (UTC) | Reports | Ping, median | Ping, worst 10% | Lead, median | FPS, median | Stutter, median | Dropped connections |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-10 | 29 | – | – | – | 58.8 | 0.1% | 11 transport close |
| 2026-11-09 | 0 | – | – | – | – | – | 2 transport close |
| 2026-11-08 | 0 | – | – | – | – | – | 1 transport close |
| 2026-11-06 | 0 | – | – | – | – | – | 6 transport close |

Every report is in `reports/<day>.jsonl` (one JSON object per line).
