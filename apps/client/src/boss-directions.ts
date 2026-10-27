import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import type { BossView } from "./boss-facing";
import base from "./art/raid-whole-frames.json";
import directions from "./art/raid-directions-frames.json";

export interface CompleteBossPose {
  rect: number[];
  anchor: number[];
  core: number[];
  moon: number[];
  scale: number;
}
export type BossArtMode = "body" | "ground" | "stranded" | "blue";
interface Selection {
  atlas: "base" | "directions";
  poses: number[];
  flip: boolean;
}
interface DirectionalBoss {
  size: number[];
  poses: CompleteBossPose[];
  modes: Partial<Record<BossArtMode, Record<BossView, Selection>>>;
}
export const BOSS_DIRECTIONS = directions as Record<
  RaidBossId,
  DirectionalBoss
>;
export interface BossFrame {
  atlas: "base" | "directions";
  index: number;
  flip: boolean;
  view: BossView;
  pose: CompleteBossPose;
  signature: string;
}
/** Select a complete authored pose; side mirroring applies to the whole body. */
export function bossDirectionalFrame(
  id: RaidBossId,
  mode: BossArtMode,
  view: BossView,
  action: number,
): BossFrame {
  const data = BOSS_DIRECTIONS[id];
  const choice = (data.modes[mode] ?? data.modes.body)![view];
  const index = choice.poses[Math.min(action, choice.poses.length - 1)];
  const pose =
    choice.atlas === "base" ? base[id].poses[index] : data.poses[index];
  return {
    atlas: choice.atlas,
    index,
    flip: choice.flip,
    view,
    pose,
    signature: `${choice.atlas}:${index}:${choice.flip}:${view}`,
  };
}
