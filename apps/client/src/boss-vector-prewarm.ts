/**
 * Every raid boss draws its pieces once per phase into an atlas (its
 * boss-vector-*-rig.ts). Drawing it while the battle is still loading keeps
 * that work off the battle's first frame.
 */
import type Phaser from "phaser";
import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import type { RaidVariant } from "../../../packages/shared/src/raid-ascendant";
import type { Phase } from "./boss-vector-grumble";
import {
  prewarmAtlas as grumblecrag,
  prepaintAtlas as prepaintCragmuff,
} from "./boss-cragmuff-rig";
import {
  prewarmAtlas as tidewyrm,
  prepaintAtlas as prepaintTidelotl,
} from "./boss-tidelotl-rig";
import {
  prewarmAtlas as inkpurr,
  prepaintAtlas as prepaintInkpurr,
} from "./boss-inkpurr-rig";
import { prewarmAtlas as snoozaku } from "./boss-snoozaku-rig";
import {
  prewarmAtlas as prismell,
  prepaintAtlas as prepaintPrismell,
} from "./boss-prismell-rig";
import { prewarmAtriumAtlas } from "./raid-prismatail-atrium-rig";
import { prewarmLumiwick, prepaintLumiwick } from "./boss-lumiwick-rig";
import { forgetPrepainted } from "./boss-prepaint";
import type { Snapshot } from "@arena/shared";
import { prewarmAtlas as twins } from "./boss-vector-twins-rig";

const PREWARM: Record<
  RaidBossId,
  (scene: Phaser.Scene, phase: Phase, variant?: RaidVariant) => void
> = {
  // Cragmuff, or its Ascendant form (its own atlas).
  grumblecrag: (scene, phase, variant) =>
    grumblecrag(scene, phase, variant === "ascendant" ? "ascendant" : "raid"),
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
/**
 * The look to paint ahead for a raid room: its own variant, or for a Spire
 * climb its zone's Ascendant (floor 10 is fought in the same room, so its
 * atlas is ready long before; the wave floors draw no boss).
 */
export const bossLookOf = (raid: {
  variant?: RaidVariant;
  spire?: unknown;
}): RaidVariant | undefined => (raid.spire ? "ascendant" : raid.variant);
/** Draw this boss's atlas (its evolved form's) for the phase the raid is in. */
export function prewarmBossAtlas(
  scene: Phaser.Scene,
  boss: RaidBossId,
  phase: number,
  variant?: RaidVariant,
) {
  PREWARM[boss]?.(
    scene,
    Math.max(1, Math.min(3, Math.round(phase))) as Phase,
    variant,
  );
}

/**
 * The bosses whose atlas takes long enough to paint ahead, in the raid room
 * (boss-prepaint.ts). Snoozaku's and the Storm Twins' paint in a few
 * milliseconds, and Prismell's atrium pieces too: they stay as they were.
 */
const PREPAINT: Partial<Record<RaidBossId, (variant?: RaidVariant) => void>> = {
  grumblecrag: (variant) =>
    prepaintCragmuff(variant === "ascendant" ? "ascendant" : "raid"),
  tidewyrm: () => prepaintTidelotl(1),
  gloomshade: prepaintInkpurr,
  prismatail: prepaintPrismell,
  emberwing: prepaintLumiwick,
};
/** Wait this long after the room appears, so its entrance isn't held up. */
export const PREPAINT_DELAY_MS = 700;
let planned: { boss: string; cancel: () => void } | undefined;

/**
 * Keep the raid room's boss painted ahead while the player waits there; drop
 * it on leaving raids. Called whenever the menu (the room) is drawn.
 */
export function syncBossPrepaint(state: Snapshot | undefined) {
  const boss = state?.phase === "lobby" ? state.raid?.boss : undefined;
  const variant = boss && state?.raid ? bossLookOf(state.raid) : undefined;
  const plan = variant ? `${boss}:${variant}` : boss;
  if (!boss) {
    planned?.cancel();
    planned = undefined;
    // A raid that is starting keeps what it painted: its battle takes it.
    // (Back in the room for a rematch, the boss is painted ahead again.)
    if (state?.raid) return;
    forgetPrepainted();
    return;
  }
  if (planned?.boss === plan) return;
  planned?.cancel();
  forgetPrepainted(boss);
  const paint = PREPAINT[boss];
  if (!paint) {
    planned = { boss: plan!, cancel: () => {} };
    return;
  }
  let idle = 0,
    timer = 0;
  const run = () => {
    idle = 0;
    // Painting takes up to a second on a slow phone: wait for a quiet moment.
    paint(variant);
  };
  timer = window.setTimeout(() => {
    timer = 0;
    const w = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback)
      idle = w.requestIdleCallback(run, { timeout: 1000 });
    else run();
  }, PREPAINT_DELAY_MS);
  planned = {
    boss: plan!,
    cancel: () => {
      if (timer) clearTimeout(timer);
      const w = window as Window & {
        cancelIdleCallback?: (id: number) => void;
      };
      if (idle) w.cancelIdleCallback?.(idle);
    },
  };
}
