# Removed features

Features the game no longer has, kept for the record. Nothing here is in the game today: never describe or recommend these as features (see [AGENTS.md](../AGENTS.md)). Moved here from the README (27 Nov 2026). Back to the [README](../README.md).

**The Farm, the Bistro and Gold Leaves (removed):** until November 2026 the hub also had an Elemental Farm tab (crops, weather, orders, animals, decorations, friends' farms; [migration 037](../supabase/migrations/037_farm.sql) and many after it), an Element Bistro tab (a restaurant on an isometric floor; [migration 068](../supabase/migrations/068_bistro.sql) and many after it) and a second currency, Gold Leaves ([migration 036](../supabase/migrations/036_gold_leaves.sql)). They were removed so the game can focus on PvP: [20261119190000_remove_farm_bistro_leaves](../supabase/migrations/20261119190000_remove_farm_bistro_leaves.sql) turns every Gold Leaf balance into shop coins once, at the old rate (100 leaves → 5 coins, rounded down), deletes Bistro coins with the Bistro, and drops their tables and functions. Earned farm titles stay with their owners, and the countryside south of the Plaza stays as scenery. The Farm's design is kept as history in [docs/hub-redesign](hub-redesign/PLAN.md).

**Other removed features (removed):** each of these was taken out of the game; see [AGENTS.md](../AGENTS.md) and the linked docs.

- **The Showcase look and the look picker (removed, 27 Nov 2026):** Poster is the only look ([ui-themes.md](ui-themes.md)).
- **Loading tips on the startup screens (removed, 27 Nov 2026).**
- **Raid of the Week, Raid of the Day and Boss Rush (removed):** retired earlier (migration 028, [regular-raids.md](regular-raids.md)); their leftovers were cleaned up in #500 and #587. Rewards players earned stay theirs.
- **The old address `parena.litojace.com` (removed as the game's home):** it only redirects to https://play.elementarenausa.com ([domain-move.md](domain-move.md)).
