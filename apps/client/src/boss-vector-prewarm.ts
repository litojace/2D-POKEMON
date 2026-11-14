/**
 * Every raid boss draws its pieces once per phase into an atlas (its
 * boss-vector-*-rig.ts). Drawing it while the battle is still loading keeps
 * that work off the battle's first frame.
 */
import type Phaser from "phaser";
import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import type { Phase } from "./boss-vector-grumble";
import { prewarmAtlas as grumblecrag } from "./boss-vector-rig";
import { prewarmAtlas as tidewyrm } from "./boss-vector-tide-rig";
import { prewarmAtlas as inkpurr } from "./boss-inkpurr-rig";
import { prewarmAtlas as somnara } from "./boss-vector-somnara-rig";
import { prewarmAtlas as prismaRig } from "./boss-vector-prisma-rig";
import { prewarmAtriumAtlas } from "./raid-prismatail-atrium-rig";
import { prewarmAtlas as emberwing } from "./boss-vector-ember-rig";
import { prewarmAtlas as twins } from "./boss-vector-twins-rig";

const PREWARM: Record<RaidBossId, (scene: Phaser.Scene, phase: Phase) => void> =
  {
    grumblecrag,
    tidewyrm,
    // Inkpurr (Gloomshade's look): one atlas for every phase.
    gloomshade: (scene) => inkpurr(scene),
    somnara,
    // Prismatail's arena pieces (mirrors, skylights, beams) have an atlas too.
    prismatail: (scene, phase) => {
      prismaRig(scene, phase);
      prewarmAtriumAtlas(scene);
    },
    emberwing,
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
