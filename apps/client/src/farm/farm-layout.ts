/*
 * Where everything stands on the Elemental Farm (world px, y grows toward
 * the viewer). Shared by the scene (farm-scene.ts), the scenery around the
 * farm (farm-scenery.ts) and the tests, so the rules about what may stand
 * where are checked against the same numbers the farm is drawn with.
 */
import { COOP } from "../../../../packages/shared/src/farm";
import { BAKERY } from "../../../../packages/shared/src/farm-bakery";

export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
export type Pt = [number, number];

/** The field: 10 × 5 plots. */
export const COLS = 10,
  ROWS = 5,
  PW = 96,
  PH = 62,
  GAP = 10,
  OX = 360,
  OY = 380;
/** The farm itself (where animals walk and decorations stand). */
export const WW = 1760,
  WH = 1080;
export const FW = COLS * PW + (COLS - 1) * GAP,
  FH = ROWS * PH + (ROWS - 1) * GAP,
  FCX = OX + FW / 2;
/** The fence round the field (posts and rails). */
export const FR: Rect = {
  x0: OX - 36,
  x1: OX + FW + 36,
  y0: OY - 32,
  y1: OY + FH + 30,
};
// The back row (home, mill, orders board, market, barn) stands 50 px
// behind the field's fence, so a lane runs in front of it. The pasture grew
// for 5 cows (20261117180000): from the field's back rail down to 664 and
// out past the farm's edge to 1860.
export const PAST: Rect = { x0: 1480, x1: 1860, y0: OY - 32, y1: 664 },
  /** Where the farmhouse stood: the Bakery's place, where the drive starts. */
  HOUSE = { x: 190, y: 292 },
  MILL = { x: 470, y: 278 },
  BOARDP = { x: 700, y: 282 },
  STALL = { x: 930, y: 278 },
  BARN = { x: 1250, y: 296 },
  WELL = { x: 150, y: 700 },
  DOGH = { x: 1600, y: 810 },
  POND = { x: 250, y: 990, rx: 150, ry: 56 };
export { BAKERY, COOP };

/**
 * The farm's own trees: [x, y, kind, size]. The round tree below the lane
 * and the cherry right of it were felled for the Chicken Coop, and the two
 * above the pasture for its taller meadow (20261117180000): they keep their
 * place in the list (a tree's look comes from its index) and isFelled says
 * so. The shared rules keep decorations off the standing ones (DECOR_BLOCKS).
 */
export const FARM_TREES: [number, number, string, number][] = [
  [338, 230, "apple", 0.62],
  [812, 190, "cherry", 0.6],
  [44, 400, "pine", 0.85],
  [1480, 340, "round", 0.7],
  [1700, 330, "pine", 0.8],
  [70, 210, "round", 0.7],
  [640, 1050, "autumn", 0.7],
  [1120, 1060, "round", 0.75],
  [1450, 1040, "cherry", 0.65],
  [1720, 1000, "pine", 0.8],
  [40, 1060, "mint", 0.7],
];
const FELLED = ["1120,1060", "1450,1040", "1480,340", "1700,330"];
export const isFelled = (x: number, y: number) => FELLED.includes(`${x},${y}`);
/** The trunks of the farm's standing trees: animals walk round them. */
export const trunks = (): Rect[] =>
  FARM_TREES.filter(([x, y]) => !isFelled(x, y)).map(([x, y]) => ({
    x0: x - 16,
    x1: x + 16,
    y0: y - 10,
    y1: y + 4,
  }));

/**
 * The world the camera may show: the farm and the land round it, every bit
 * of it dressed (farm-scenery.ts). The camera never shows past it.
 */
export const WORLD: Rect = {
  x0: -360,
  y0: -180,
  x1: WW + 360,
  y1: WH + 200,
};

/**
 * Sizes, one scale for everything standing (docs in farm-scenery.ts): a
 * person on the farm (a visiting friend) is 80 px tall. Things people use
 * (a mailbox, a bench, a bale, a beehive, a tractor) are drawn at 55 px a
 * metre. Buildings, trees and poles are drawn at half that, as farm games
 * do, so a barn stays on one screen; animals a little larger than life.
 */
export const PX_PER_M = 55,
  BIG_PX_PER_M = PX_PER_M / 2,
  PERSON_PX = 80;

/**
 * The dirt paths and the road ([points, width]): painted into the ground,
 * and nothing standing may sit on them.
 */
export const PATHS: [Pt[], number][] = [
  // The country road along the top (to the Plaza), and the drive down to it.
  [
    [
      [WORLD.x0 - 20, -70],
      [WORLD.x1 + 20, -60],
    ],
    70,
  ],
  [
    [
      [HOUSE.x, HOUSE.y + 10],
      [HOUSE.x, -66],
    ],
    46,
  ],
  // The back row: home to the barn.
  [
    [
      [HOUSE.x + 60, HOUSE.y + 10],
      [BARN.x - 40, BARN.y + 12],
    ],
    46,
  ],
  // Up from the footbridge over the brook to the field's gate.
  [
    [
      [FCX, WORLD.y1 + 30],
      [FCX, OY + FH + 24],
    ],
    64,
  ],
  // The lane in front of the field: west and up to home.
  [
    [
      [FCX, OY + FH + 70],
      [420, OY + FH + 70],
      [260, 620],
      [HOUSE.x, HOUSE.y + 10],
    ],
    54,
  ],
  // East to the doghouse.
  [
    [
      [FCX, OY + FH + 70],
      [1460, OY + FH + 70],
      [DOGH.x - 50, DOGH.y],
    ],
    54,
  ],
  // Down from the lane's bend to the pond.
  [
    [
      [420, OY + FH + 70],
      [372, 868],
      [POND.x + 76, POND.y - 64],
    ],
    42,
  ],
];
/** The road's middle line at x (it runs very slightly downhill to the east). */
export const roadY = (x: number) =>
  -70 + (10 * (x - (WORLD.x0 - 20))) / (WORLD.x1 - WORLD.x0 + 40);

/** Distance from (x, y) to the segment a–b. */
export function segDist(x: number, y: number, a: Pt, b: Pt) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l2 = dx * dx + dy * dy,
    t = l2
      ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2))
      : 0;
  return Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t));
}
/** Whether (x, y) is on a path or the road (with `m` px to spare). */
export function onPath(x: number, y: number, m = 0) {
  for (const [pts, w] of PATHS)
    for (let i = 0; i < pts.length - 1; i++)
      if (segDist(x, y, pts[i], pts[i + 1]) < w / 2 + m) return true;
  return false;
}
/** Whether a ground rectangle touches a path or the road. */
export function rectOnPath(r: Rect, m = 0) {
  const n = 6;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++)
      if (
        onPath(
          r.x0 + ((r.x1 - r.x0) * i) / n,
          r.y0 + ((r.y1 - r.y0) * j) / n,
          m,
        )
      )
        return true;
  return false;
}
