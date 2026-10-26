import type { TownBuilding } from "../../../packages/shared/src/town";
import type { Sprite } from "./town-art";

type Point = readonly [number, number];
type Rect = readonly [number, number, number, number];
type Asset = "coliseum" | "raidHall" | "buildings";
interface Frame {
  asset: Asset;
  crop: Rect;
  anchor: Point;
  inkWidth: number;
  flags?: readonly Point[];
  flames?: readonly Point[];
  chimney?: Point;
  hub?: Point;
}
/** Crops keep each complete object, including footings. Anchors are front doorsteps. */
export const ARCHITECTURE = {
  coliseum: {
    asset: "coliseum",
    crop: [39, 136, 1187, 972],
    anchor: [628, 1090],
    inkWidth: 1165,
    flags: [
      [190, 344],
      [420, 180],
      [895, 207],
      [1100, 380],
    ],
    flames: [
      [453, 919],
      [802, 925],
    ],
  },
  temple: {
    asset: "raidHall",
    crop: [78, 10, 1430, 961],
    anchor: [793, 950],
    inkWidth: 1399,
    flags: [
      [147, 550],
      [1438, 550],
    ],
    flames: [
      [325, 749],
      [1264, 749],
    ],
  },
  red: {
    asset: "buildings",
    crop: [76, 12, 423, 506],
    anchor: [287, 506],
    inkWidth: 392,
    chimney: [297, 44],
  },
  teal: {
    asset: "buildings",
    crop: [525, 12, 422, 506],
    anchor: [735, 506],
    inkWidth: 391,
    chimney: [729, 44],
  },
  plum: {
    asset: "buildings",
    crop: [77, 520, 425, 495],
    anchor: [287, 1006],
    inkWidth: 394,
    chimney: [296, 547],
  },
  market: {
    asset: "buildings",
    crop: [516, 559, 453, 418],
    anchor: [737, 942],
    inkWidth: 422,
  },
  tower: {
    asset: "buildings",
    crop: [103, 1016, 368, 486],
    anchor: [287, 1481],
    inkWidth: 337,
    flags: [[396, 1090]],
    flames: [[288, 1100]],
  },
  windmill: {
    asset: "buildings",
    crop: [547, 1000, 385, 505],
    anchor: [736, 1483],
    inkWidth: 356,
    hub: [735, 1250],
  },
} as const satisfies Record<string, Frame>;

export interface ArchitecturePlacement {
  sprite: Sprite;
  flags: { x: number; y: number }[];
  flames: { x: number; y: number }[];
  chimney?: { x: number; y: number };
  hub?: { x: number; y: number };
  rotorScale: number;
}
export function architectureFrame(b: TownBuilding): Frame {
  return b.kind === "house"
    ? ARCHITECTURE[(["red", "teal", "plum"] as const)[(b.variant ?? 0) % 3]]
    : ARCHITECTURE[b.kind];
}
export function architectureLayout(frame: Frame, width: number) {
  const scale = width / frame.inkWidth;
  const point = ([x, y]: Point) => ({
    x: (x - frame.anchor[0]) * scale,
    y: (y - frame.anchor[1]) * scale,
  });
  return { scale, point };
}
function placement(
  source: CanvasImageSource,
  frame: Frame,
  width: number,
  offset: Point = [0, 0],
): ArchitecturePlacement {
  const layout = architectureLayout(frame, width),
    scale = layout.scale,
    point = (p: Point) => {
      const q = layout.point(p);
      return { x: q.x + offset[0], y: q.y + offset[1] };
    };
  const [sx, sy, sw, sh] = frame.crop;
  // Room for the separately animated flags' fixed poles above the roofline.
  const pad = 48;
  const ax = (frame.anchor[0] - sx) * scale + pad - offset[0],
    ay = (frame.anchor[1] - sy) * scale + pad - offset[1];
  const flags = (frame.flags ?? []).map(point),
    flames = (frame.flames ?? []).map(point);
  return {
    flags,
    flames,
    chimney: frame.chimney ? point(frame.chimney) : undefined,
    hub: frame.hub ? point(frame.hub) : undefined,
    rotorScale: 0.66,
    sprite: {
      w: sw * scale + pad * 2,
      h: sh * scale + pad * 2,
      ax,
      ay,
      draw(ctx) {
        ctx.drawImage(source, sx, sy, sw, sh, pad, pad, sw * scale, sh * scale);
        for (const p of flags) {
          ctx.strokeStyle = "#86704d";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(ax + p.x, ay + p.y);
          ctx.lineTo(ax + p.x, ay + p.y - 44);
          ctx.stroke();
        }
      },
    },
  };
}
export function paintedBuilding(source: CanvasImageSource, b: TownBuilding) {
  const frame = architectureFrame(b);
  const width =
    b.w +
    (b.kind === "coliseum"
      ? 72
      : b.kind === "temple"
        ? 60
        : b.kind === "house"
          ? 20
          : 32);
  // Existing lanes meet the old front doorsteps, rather than the footprint centre.
  const offset: Point =
    b.kind === "house"
      ? [b.w * 0.08, 12]
      : b.kind === "tower"
        ? [35, 45]
        : b.kind === "windmill"
          ? [0, 50]
          : [0, 0];
  return placement(source, frame, width, offset);
}
export function paintedStall(source: CanvasImageSource, color: string): Sprite {
  const p = placement(source, ARCHITECTURE.market, 220),
    draw = p.sprite.draw;
  p.sprite.draw = (ctx) => {
    draw(ctx);
    const mark = architectureLayout(ARCHITECTURE.market, 220).point([737, 880]);
    const x = p.sprite.ax + mark.x,
      y = p.sprite.ay + mark.y;
    ctx.fillStyle = "#bc8f3f";
    ctx.beginPath();
    ctx.ellipse(x, y, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, 3.7, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  return p.sprite;
}
