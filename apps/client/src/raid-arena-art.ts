import { RULES } from "@arena/shared";
import { paintKit } from "./arena-courts";
import type { RaidFloorId } from "./raid-floors";
import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import { GLOOMSHADE } from "../../../packages/shared/src/raid";
import { paintRingInlay } from "./raid-ring-pieces";
import { engravedRing } from "./raid-emberwing-terrace";
import { paintConstellationInlay } from "./raid-cloud-deck-pieces";
import { paintAtriumInlay } from "./raid-prismatail-atrium";
import { RAID_WORLDS, paintRaidWorld } from "./world-art";

/**
 * The raid courts with their own world (world-art/): painted in code when a
 * fight needs them, so nothing is downloaded and nothing waits.
 */
export type IllustratedRaidFloor = RaidFloorId | "raid-coliseum";
export const isIllustratedRaidFloor = (
  id: string,
): id is IllustratedRaidFloor => Object.hasOwn(RAID_WORLDS, id);

/** Each boss's arena (Grumblecrag fights in the Coliseum). */
export const RAID_BOSS_ARENA: Record<RaidBossId, IllustratedRaidFloor> = {
  grumblecrag: "raid-coliseum",
  tidewyrm: "lagoon",
  gloomshade: "lantern-yard",
  somnara: "cloud-deck",
  prismatail: "sun-atrium",
  emberwing: "sky-terrace",
  "storm-twins": "conductor-ring",
};

/** The court's painting, then the gameplay landmarks, in world coordinates. */
export function paintIllustratedRaidFloor(
  c: CanvasRenderingContext2D,
  id: IllustratedRaidFloor,
) {
  const { width: W, height: H } = RULES;
  c.save();
  c.globalAlpha = 1;
  c.globalCompositeOperation = "source-over";
  paintRaidWorld(c, id, "court");
  // Keep white/cyan warnings readable over bright marble and water caustics.
  c.fillStyle = id === "lagoon" ? "#062c3a28" : "#0c112317";
  c.fillRect(0, 0, W, H);
  // A little common material grain also stays crisp on dense-screen canvas bakes.
  paintKit.grain(c, 0, 0, W, H, 0.08, 731, [
    [70, 0.3],
    [4, 0.2],
  ]);
  const ring = (x: number, y: number, r: number, color: string, width = 2) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
  };
  if (id === "lagoon") {
    ring(800, 450, 150, "#c2f6ec55");
    ring(800, 450, 230, "#c2f6ec33");
  } else if (id === "lantern-yard") {
    const { cols, rows } = GLOOMSHADE.hands;
    const tw = W / cols,
      th = H / rows;
    for (let col = 0; col < cols; col++)
      for (let row = 0; row < rows; row++) {
        c.fillStyle = (col + row) % 2 === 0 ? "#c3b9f31c" : "#05061920";
        c.fillRect(col * tw, row * th, tw, th);
      }
    c.strokeStyle = "#bcb0db5c";
    c.lineWidth = 2;
    c.beginPath();
    for (let col = 1; col < cols; col++) {
      c.moveTo(col * tw, 0);
      c.lineTo(col * tw, H);
    }
    for (let row = 1; row < rows; row++) {
      c.moveTo(0, row * th);
      c.lineTo(W, row * th);
    }
    c.stroke();
    ring(800, 430, 120, "#c8b7ec55");
    ring(800, 430, 150, "#c8b7ec33");
  } else if (id === "sky-terrace") {
    // The ritual circle as a worn bronze inlay in the slabs.
    engravedRing(c, 800, 450, 260);
  } else if (id === "sun-atrium") {
    // Gold rings, glass and the mirrors' tracks (raid-prismatail-atrium.ts).
    paintAtriumInlay(c);
  } else if (id === "conductor-ring") {
    // The same rings at the same radii, inlaid: a riveted copper rail, the
    // live filament, a copper inlay and the etched inner circle.
    paintRingInlay(c);
  } else if (id === "cloud-deck") {
    // The constellation ring around the whale, as a gold inlay with star gems.
    paintConstellationInlay(c);
  }
  // A restrained rim makes the world boundary clear without hiding live warnings.
  c.strokeStyle = "#c7c1b444";
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(18, 18, W - 36, H - 36, 18);
  c.stroke();
  c.restore();
}
