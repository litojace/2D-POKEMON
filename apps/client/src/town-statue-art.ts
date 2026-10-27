import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import type { Sprite } from "./town-art";
import frames from "./art/town-statue-frames.json";
import grumblecrag from "./art/town-statue-grumblecrag.webp";
import tidewyrm from "./art/town-statue-tidewyrm.webp";
import gloomshade from "./art/town-statue-gloomshade.webp";
import somnara from "./art/town-statue-somnara.webp";
import prismatail from "./art/town-statue-prismatail.webp";
import emberwing from "./art/town-statue-emberwing.webp";
import stormTwins from "./art/town-statue-storm-twins.webp";

export const TOWN_STATUE_ART = {
  grumblecrag,
  tidewyrm,
  gloomshade,
  somnara,
  prismatail,
  emberwing,
  "storm-twins": stormTwins,
} satisfies Record<RaidBossId, string>;

/** Measured feet, rather than the image box's centre, rest on the cap.
 * The wide wave/cloud supports must also fit the pedestal's stone top. */
export function bossStatue(id: RaidBossId, source: CanvasImageSource): Sprite {
  const frame = frames[id];
  const crop = frame.crop as [number, number, number, number];
  const scale = Math.min(92 / crop[3], 96 / crop[2], 68 / frame.contactWidth);
  const w = crop[2] * scale,
    h = crop[3] * scale;
  return {
    w,
    h,
    ax: frame.foot[0] * scale,
    ay: frame.foot[1] * scale,
    nativeImage: {
      key: `town-statue-${id}`,
      crop,
      rect: [0, 0, w, h],
    },
    draw(ctx) {
      ctx.drawImage(source, ...crop, 0, 0, w, h);
    },
  };
}
