import type { TownBuilding } from "./town.js";

export type Point = readonly [number, number];
type Rect = readonly [number, number, number, number];
type Asset = "coliseum" | "raidHall" | "buildings";
export interface Frame {
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

export const WINDMILL_ROTOR_SCALE = 0.66;
export interface TownArtBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export function architecturePlacement(b: TownBuilding) {
  const frame = architectureFrame(b);
  const width =
    b.w +
    (b.kind === "coliseum"
      ? 72
      : b.kind === "temple"
        ? 0
        : b.kind === "house"
          ? 20
          : 32);
  const offset: Point =
    b.kind === "house"
      ? [b.w * 0.08, 12]
      : b.kind === "tower"
        ? [35, 45]
        : b.kind === "windmill"
          ? [0, 50]
          : [0, 0];
  return { frame, width, offset };
}
function frameBounds(
  frame: Frame,
  width: number,
  x: number,
  y: number,
): TownArtBounds {
  const { scale, point } = architectureLayout(frame, width);
  const [sx, sy, sw, sh] = frame.crop;
  const bounds = {
    left: x + (sx - frame.anchor[0]) * scale,
    right: x + (sx + sw - frame.anchor[0]) * scale,
    top: y + (sy - frame.anchor[1]) * scale,
    bottom: y + (sy + sh - frame.anchor[1]) * scale,
  };
  for (const flag of frame.flags ?? [])
    bounds.top = Math.min(bounds.top, y + point(flag).y - 44);
  if (frame.hub) {
    const hub = point(frame.hub),
      radius = 160 * WINDMILL_ROTOR_SCALE;
    bounds.left = Math.min(bounds.left, x + hub.x - radius);
    bounds.right = Math.max(bounds.right, x + hub.x + radius);
    bounds.top = Math.min(bounds.top, y + hub.y - radius);
    bounds.bottom = Math.max(bounds.bottom, y + hub.y + radius);
  }
  return bounds;
}
/** Visible source bounds, excluding the transparent padding used for baking. */
export function buildingVisualBounds(b: TownBuilding): TownArtBounds {
  const { frame, width, offset } = architecturePlacement(b);
  return frameBounds(frame, width, b.x + offset[0], b.y + offset[1]);
}
export function stallVisualBounds(s: { x: number; y: number }): TownArtBounds {
  return frameBounds(ARCHITECTURE.market, 220, s.x, s.y + 26);
}
export function boundsOverlap(a: TownArtBounds, b: TownArtBounds, gap = 0) {
  return (
    a.left < b.right + gap &&
    a.right > b.left - gap &&
    a.top < b.bottom + gap &&
    a.bottom > b.top - gap
  );
}
/** Includes the largest canopy scale and sway, not only the trunk collision. */
export function treeVisualBounds(x: number, y: number): TownArtBounds {
  return { left: x - 94, right: x + 94, top: y - 258, bottom: y + 12 };
}
export function shrubVisualBounds(x: number, y: number): TownArtBounds {
  return { left: x - 44, right: x + 44, top: y - 56, bottom: y + 12 };
}
/** The new illustration's bottom ring: front step at y, side foot at y-155. */
export function arenaGroundFoot(b: TownBuilding) {
  const { frame, width } = architecturePlacement(b);
  const { scale, point } = architectureLayout(frame, width),
    centre = point([628, 785]);
  return {
    x: b.x + centre.x,
    y: b.y + centre.y,
    rx: 584 * scale,
    ry: 307 * scale,
  };
}
