import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import { grumbleGuideImage } from "./boss-vector-grumble";
import { tidelotlGuideImage } from "./boss-tidelotl";
import { gloomGuideImage } from "./boss-vector-gloom";
import { somnaraGuideImage } from "./boss-vector-somnara";
import { prismaGuideImage } from "./boss-vector-prisma";
import { emberGuideImage } from "./boss-vector-ember";
import { twinsGuideImage } from "./boss-vector-twins";

/** The boss for a briefing diagram: each boss draws itself once into a
 * picture (boss-vector-*.ts), clipped to one complete creature. */
export function raidGuideSprite(
  boss: RaidBossId,
  exposed = false,
  shadow = true,
  _action = 0,
) {
  const floor = shadow
    ? '<ellipse cy="25" rx="38" ry="8" fill="#061122" opacity=".65"/>'
    : "";
  const ring = (cx: number, cy: number) =>
    exposed
      ? `<circle cx="${cx}" cy="${cy}" r="12" fill="#82ffe7" fill-opacity=".15" stroke="#82ffe7" stroke-width="2"/>`
      : "";
  const art: {
      url: string;
      width: number;
      height: number;
      crop: readonly [number, number, number, number];
      core: readonly [number, number];
      cores?: readonly (readonly [number, number])[];
    } =
      boss === "tidewyrm"
        ? tidelotlGuideImage(exposed)
        : boss === "gloomshade"
          ? gloomGuideImage(exposed)
          : boss === "somnara"
            ? somnaraGuideImage(exposed)
            : boss === "prismatail"
              ? prismaGuideImage(exposed)
              : boss === "emberwing"
                ? emberGuideImage(exposed)
                : boss === "storm-twins"
                  ? twinsGuideImage(exposed)
                  : grumbleGuideImage(exposed),
    [sx, sy, w, h] = art.crop,
    scale = Math.min(90 / w, 80 / h),
    frameX = -45 + (90 - w * scale) / 2,
    frameY = 25 - h * scale;
  return `<g data-guide-boss="${boss}">${floor}<svg x="${frameX}" y="${frameY}" width="${w * scale}" height="${h * scale}" viewBox="${sx} ${sy} ${w} ${h}" preserveAspectRatio="xMidYMax meet" overflow="hidden"><image data-guide-sprite="${boss}" href="${art.url}" width="${art.width}" height="${art.height}"/></svg>${(art.cores ?? [art.core]).map((c) => ring(frameX + (c[0] - sx) * scale, frameY + (c[1] - sy) * scale)).join("")}</g>`;
}
