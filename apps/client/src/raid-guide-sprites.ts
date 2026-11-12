import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import {
  bossDirectionalFrame,
  BOSS_DIRECTIONS,
  type BossArtMode,
} from "./boss-directions";
import {
  BOSS_PAINTED_ART,
  BOSS_DIRECTION_ART,
  isPaintedBoss,
} from "./boss-painted-rig";
import { grumbleGuideImage } from "./boss-vector-grumble";
import { tideGuideImage } from "./boss-vector-tide";
import { gloomGuideImage } from "./boss-vector-gloom";
import { somnaraGuideImage } from "./boss-vector-somnara";
import base from "./art/raid-whole-frames.json";

/** Reuse a complete battle pose in the diagram; native atlas has ample resolution
 * for a small diagram. Clip one complete creature, never individual body parts. */
export function raidGuideSprite(
  boss: RaidBossId,
  exposed = false,
  shadow = true,
  action = 0,
) {
  const floor = shadow
    ? '<ellipse cy="25" rx="38" ry="8" fill="#061122" opacity=".65"/>'
    : "";
  const ring = (cx: number, cy: number) =>
    exposed
      ? `<circle cx="${cx}" cy="${cy}" r="12" fill="#82ffe7" fill-opacity=".15" stroke="#82ffe7" stroke-width="2"/>`
      : "";
  if (!isPaintedBoss(boss)) {
    // Vector bosses draw themselves once into a picture (boss-vector-*.ts).
    const art =
        boss === "tidewyrm"
          ? tideGuideImage(exposed)
          : boss === "gloomshade"
            ? gloomGuideImage(exposed)
          : boss === "somnara"
            ? somnaraGuideImage(exposed)
            : grumbleGuideImage(exposed),
      [sx, sy, w, h] = art.crop,
      scale = Math.min(90 / w, 80 / h),
      frameX = -45 + (90 - w * scale) / 2,
      frameY = 25 - h * scale;
    return `<g data-guide-boss="${boss}">${floor}<svg x="${frameX}" y="${frameY}" width="${w * scale}" height="${h * scale}" viewBox="${sx} ${sy} ${w} ${h}" preserveAspectRatio="xMidYMax meet" overflow="hidden"><image data-guide-sprite="${boss}" href="${art.url}" width="${art.width}" height="${art.height}"/></svg>${ring(frameX + (art.core[0] - sx) * scale, frameY + (art.core[1] - sy) * scale)}</g>`;
  }
  const painted = boss;
  const draw = (mode: BossArtMode, x: number, width: number) => {
    const f = bossDirectionalFrame(painted, mode, "front", action),
      [sx, sy, w, h] = f.pose.rect,
      [aw, ah] =
        f.atlas === "base" ? base[painted].size : BOSS_DIRECTIONS[painted].size,
      url =
        f.atlas === "base"
          ? BOSS_PAINTED_ART[painted]
          : BOSS_DIRECTION_ART[painted];
    const scale = Math.min(width / w, 80 / h),
      frameX = x + (width - w * scale) / 2,
      frameY = 25 - h * scale,
      cx = frameX + f.pose.core[0] * scale,
      cy = frameY + f.pose.core[1] * scale;
    // Match the viewport to the crop's aspect ratio. Letterboxing an atlas would
    // expose neighboring poses in the otherwise empty space above the creature.
    return `<svg x="${frameX}" y="${frameY}" width="${w * scale}" height="${h * scale}" viewBox="${sx} ${sy} ${w} ${h}" preserveAspectRatio="xMidYMax meet" overflow="hidden"><image data-guide-sprite="${boss}" href="${url}" width="${aw}" height="${ah}"/></svg>${ring(cx, cy)}`;
  };
  const mode = boss === "emberwing" ? "ground" : "body";
  return `<g data-guide-boss="${boss}">${floor}${boss === "storm-twins" ? draw("body", -50, 48) + draw("blue", 2, 48) : draw(mode, -45, 90)}</g>`;
}
