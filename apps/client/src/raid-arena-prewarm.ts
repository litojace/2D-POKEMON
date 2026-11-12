/**
 * Raid arenas whose pieces are images (raid-piece-stage.ts) draw their atlas
 * when the arena scene is created, like the boss's own (boss-vector-prewarm.ts),
 * not on the fight's first frame.
 */
import type Phaser from "phaser";
import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import { prewarmYard } from "./raid-gloomshade-art";
import { prewarmRing } from "./raid-storm-twins-art";

export function prewarmRaidArena(
  scene: Phaser.Scene,
  raid: { boss: RaidBossId; trait?: string },
) {
  if (raid.boss === "gloomshade") prewarmYard(scene, raid.trait);
  else if (raid.boss === "storm-twins") prewarmRing(scene);
}
