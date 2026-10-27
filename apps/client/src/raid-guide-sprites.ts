import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import {
  bossDirectionalFrame,
  BOSS_DIRECTIONS,
  type BossArtMode,
} from "./boss-directions";
import { BOSS_PAINTED_ART, BOSS_DIRECTION_ART } from "./boss-painted-rig";
import base from "./art/raid-whole-frames.json";

/** Reuse a complete battle pose in the diagram; native atlas has ample resolution
 * for a small diagram. Clip one complete creature, never individual body parts. */
export function raidGuideSprite(
  boss: RaidBossId,
  exposed = false,
  shadow = true,
) {
  const draw = (mode: BossArtMode, x: number, width: number) => {
    const f = bossDirectionalFrame(boss, mode, "front", 0),
      [sx, sy, w, h] = f.pose.rect,
      [aw, ah] =
        f.atlas === "base" ? base[boss].size : BOSS_DIRECTIONS[boss].size,
      url =
        f.atlas === "base" ? BOSS_PAINTED_ART[boss] : BOSS_DIRECTION_ART[boss];
    const scale = Math.min(width / w, 80 / h),
      frameX = x + (width - w * scale) / 2,
      frameY = 25 - h * scale,
      cx = frameX + f.pose.core[0] * scale,
      cy = frameY + f.pose.core[1] * scale;
    // Match the viewport to the crop's aspect ratio. Letterboxing an atlas would
    // expose neighboring poses in the otherwise empty space above the creature.
    return `<svg x="${frameX}" y="${frameY}" width="${w * scale}" height="${h * scale}" viewBox="${sx} ${sy} ${w} ${h}" preserveAspectRatio="xMidYMax meet" overflow="hidden"><image data-guide-sprite="${boss}" href="${url}" width="${aw}" height="${ah}"/></svg>${exposed ? `<circle cx="${cx}" cy="${cy}" r="12" fill="#82ffe7" fill-opacity=".15" stroke="#82ffe7" stroke-width="2"/>` : ""}`;
  };
  const mode =
    boss === "emberwing"
      ? "ground"
      : boss === "tidewyrm" && exposed
        ? "stranded"
        : "body";
  return `<g data-guide-boss="${boss}">${shadow ? '<ellipse cy="25" rx="38" ry="8" fill="#061122" opacity=".65"/>' : ""}${boss === "storm-twins" ? draw("body", -50, 48) + draw("blue", 2, 48) : draw(mode, -45, 90)}</g>`;
}
