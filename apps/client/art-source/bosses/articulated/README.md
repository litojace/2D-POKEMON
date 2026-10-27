# Living raid bosses

The seven 1254 × 1254 transparent PNG masters contain separately illustrated
anatomical parts in the same sculptural style as the Raid Hall statues, with the
colours and materials of living creatures. They are source art, not runtime files.

Run `python scripts/export-boss-parts.py` (Pillow) from the repository root to
rebuild the seven WebP atlases and their measured frame metadata. The exporter
crops entire authored parts at their native resolution, adds transparent gutters,
and packs them into 2048 × 1024 power-of-two textures. It does not resize the
paintings or cut bodies into animation strips.

`boss-painted-poses.ts` supplies shoulder, neck, wing, flipper and tail pivots;
complete parts overlap at those joints. Natural frame proportions are preserved,
with small breathing deformations. The source neck/tail joints of Tidewyrm and
Somnara have continuous skin instead of exposed cylindrical socket caps.

The client preloads only the encounter's atlas. Expedition transitions release
previous boss atlases; leaving ArenaScene releases the remaining textures. The
old vector painters remain a fallback when an art request fails. Telegraphs,
combat snapshots, collision geometry and server timings are unchanged.

The visual harness `tests/visual/harness/boss-review.ts` calls the actual battle
painters with server-created snapshots. Its seven-boss display is a review tool,
not a shipped game screen. `tests/visual/boss-painted.spec.ts` checks real sprite
animation, pause/reduced motion, copy and submerge cleanup, changing encounters,
network failure fallback, and the actual desktop/iPhone raid screen.
