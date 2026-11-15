/**
 * Every raid boss draws its pieces once per phase into an atlas (its
 * boss-vector-*-rig.ts). Drawing it while the battle is still loading keeps
 * that work off the battle's first frame.
 */
import type Phaser from "phaser";
import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import type { Phase } from "./boss-vector-grumble";
import { prewarmAtlas as grumblecrag } from "./boss-cragmuff-rig";
import { prewarmAtlas as tidewyrm } from "./boss-tidelotl-rig";
import { prewarmAtlas as inkpurr } from "./boss-inkpurr-rig";
import { prewarmAtlas as snoozaku } from "./boss-snoozaku-rig";
import { prewarmAtlas as prismell } from "./boss-prismell-rig";
import { prewarmAtriumAtlas } from "./raid-prismatail-atrium-rig";
import { prewarmLumiwick } from "./boss-lumiwick-rig";
import { prewarmAtlas as twins } from "./boss-vector-twins-rig";

const PREWARM: Record<RaidBossId, (scene: Phaser.Scene, phase: Phase) => void> =
  {
    grumblecrag,
    tidewyrm,
    // Inkpurr (Gloomshade's look): one atlas for every phase.
    gloomshade: (scene) => inkpurr(scene),
    // Snoozaku (Somnara's look): one atlas for every phase.
    somnara: (scene) => snoozaku(scene),
    // Prismell (Prismatail's look) paints one atlas for every phase; its
    // arena pieces (mirrors, skylights, beams) have an atlas too.
    prismatail: (scene) => {
      prismell(scene);
      prewarmAtriumAtlas(scene);
    },
    // Lumiwick (Emberwing's id) paints one atlas for every phase.
    emberwing: (scene) => prewarmLumiwick(scene),
    "storm-twins": twins,
  };
/** Draw this boss's atlas for the phase the raid is in. */
export function prewarmBossAtlas(
  scene: Phaser.Scene,
  boss: RaidBossId,
  phase: number,
) {
  PREWARM[boss]?.(scene, Math.max(1, Math.min(3, Math.round(phase))) as Phase);
}
