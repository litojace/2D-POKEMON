import type { RaidLoadout } from "./raid.js";
import type { RaidBossId } from "./raid-roster.js";

/**
 * The new Plaza (hub redesign phase 3): a 2700 × 1700 painted playground with
 * a stage and LED wall, a ball pitch, a dash track with hurdles, a photo spot,
 * the Volt Boba truck and bounce pads. Layout, collision and movement live
 * here so the game server (authoritative) and the browser (instant local
 * movement) compute the same step. Ported from the approved prototype
 * (docs/hub-redesign/prototype/app/plaza.js); numbers are the prototype's.
 */
export const PLAZA = {
  width: 2700,
  height: 1700,
  /** Players per Plaza copy; more open "Plaza 2", "Plaza 3"… */
  capacity: 40,
  /** Walking speed (px/s), the same for every fighter. */
  speed: 240,
  /** Bodies collide as a circle of this radius. */
  radius: 18,
  /** Server simulation and update rates (per second). */
  tick: 20,
  send: 10,
  /** A player sees others within this box around them (world px). */
  view: { w: 1500, h: 1000 },
  /** Dash: speed, how long, and how often. */
  dashSpeed: 680,
  dashSeconds: 0.18,
  dashEvery: 0.9,
  /** Jump: how long and how high; a bounce pad throws you higher. */
  jump: { seconds: 0.65, height: 42 },
  pad: { seconds: 1.15, height: 160 },
  /** Tripping over a hurdle you didn't jump. */
  stunSeconds: 0.45,
  emoteSeconds: 2.6,
  /** Volt Boba (free): speed and how long. */
  boba: { speed: 1.3, seconds: 30 },
  /** Treats: at most one throw this often (seconds). */
  treatSeconds: 1.5,
  /** Free treats a Pacific day (migration 20261119190000_remove_farm_bistro_leaves). */
  treatsDaily: 10,
} as const;
/** The treats, thrown in this order through the day (the database's list). */
export const PLAZA_TREATS = [
  { id: "candy", name: "a candy", color: "#ff6fae" },
  { id: "cupcake", name: "a cupcake", color: "#ffb3d1" },
  { id: "donut", name: "a donut", color: "#ffb04a" },
  { id: "lollipop", name: "a lollipop", color: "#8fd7ff" },
  { id: "cookie", name: "a cookie", color: "#d9a066" },
] as const;
export type PlazaTreatId = (typeof PLAZA_TREATS)[number]["id"];
export const PLAZA_TREAT_BY_ID: Record<string, (typeof PLAZA_TREATS)[number]> =
  Object.fromEntries(PLAZA_TREATS.map((t) => [t.id, t]));
/** A treat thrown in the Plaza, sent to everyone in that Plaza copy. */
export interface PlazaTreat {
  /** The thrower's walker id. */
  id: number;
  /** Which treat (PLAZA_TREATS). */
  treat: string;
  x: number;
  y: number;
  /** Thrown into the fountain: a wish (PLAZA_WISH). */
  wish?: true;
}

export const PLAZA_SQUARE = { x: 1350, y: 900, rx: 372, ry: 246 } as const;
export const PLAZA_FOUNTAIN = { x: 1350, y: 892, rx: 118, ry: 74 } as const;
export const PLAZA_STAGE = { x0: 1140, x1: 1560, y0: 340, y1: 450 } as const;
export const PLAZA_WALK = { x0: 1300, x1: 1400, y0: 450, y1: 612 } as const;
export const PLAZA_LED = { x0: 1130, x1: 1570, y0: 150, y1: 300 } as const;
export const PLAZA_PITCH = {
  x0: 1980,
  x1: 2580,
  y0: 650,
  y1: 1150,
  /** The goal mouths' top and bottom. */
  gy0: 835,
  gy1: 965,
} as const;
/** The dash track: an elliptical lane between the outer and inner edges. */
export const PLAZA_TRACK = {
  cx: 540,
  cy: 930,
  ro: [400, 290],
  ri: [262, 168],
} as const;
export const PLAZA_POND = { x: 2210, y: 1450, rx: 220, ry: 118 } as const;
export const PLAZA_GATE = { x: 1350, y: 1600 } as const;
export const PLAZA_PADS: readonly (readonly [number, number])[] = [
  [1145, 765],
  [1555, 765],
  [1145, 1035],
  [1555, 1035],
];
export const PLAZA_PHOTO = { x: 1010, y: 500 } as const;
/** The Photo Spot's camera: on its tripod in front of the arch, pointing at it. */
export const PLAZA_PHOTO_CAMERA = {
  x: PLAZA_PHOTO.x - 105,
  y: PLAZA_PHOTO.y + 112,
} as const;
export const PLAZA_CAFE = { x: 1745, y: 480 } as const;
export const PLAZA_BOARD = { x: 1050, y: 1265 } as const;
export const PLAZA_LEADER = { x: 240, y: 600 } as const;
/** Hurdle angles on the track (radians, clockwise from the right). */
export const PLAZA_HURDLES = [-30, 60, 150].map((d) => (d * Math.PI) / 180);
/** Spawn: the path south of the fountain. */
export const PLAZA_SPAWN = { x: PLAZA_SQUARE.x, y: PLAZA_SQUARE.y + 190 };

export const PLAZA_EMOTES = [
  "👋",
  "❤️",
  "😂",
  "GG",
  "🔥",
  "👏",
  "💃",
  "😎",
] as const;
export type PlazaEmote = (typeof PLAZA_EMOTES)[number];

/* ---------- geometry helpers ---------- */
/** Where a point is around the track: radius (1 = outer edge) and angle. */
export function trackPolar(x: number, y: number) {
  const dx = (x - PLAZA_TRACK.cx) / PLAZA_TRACK.ro[0],
    dy = (y - PLAZA_TRACK.cy) / PLAZA_TRACK.ro[1];
  return { r: Math.hypot(dx, dy), a: Math.atan2(dy, dx) };
}
export function onTrack(x: number, y: number) {
  const { cx, cy, ro, ri } = PLAZA_TRACK;
  return (
    ((x - cx) / ro[0]) ** 2 + ((y - cy) / ro[1]) ** 2 <= 1 &&
    ((x - cx) / ri[0]) ** 2 + ((y - cy) / ri[1]) ** 2 >= 1
  );
}
/** A point in the lane at angle `a`; `k` 0 = inner edge, 1 = outer edge. */
export function trackPoint(a: number, k = 0.5) {
  const { cx, cy, ro, ri } = PLAZA_TRACK;
  return {
    x: cx + Math.cos(a) * (ri[0] + (ro[0] - ri[0]) * k),
    y: cy + Math.sin(a) * (ri[1] + (ro[1] - ri[1]) * k),
  };
}
/** Each hurdle as a segment across the lane. */
export const PLAZA_HURDLE_SEGMENTS = PLAZA_HURDLES.map(
  (a) => [trackPoint(a, 0), trackPoint(a, 1)] as const,
);
export function segmentDistance(
  x: number,
  y: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const vx = b.x - a.x,
    vy = b.y - a.y,
    l2 = vx * vx + vy * vy,
    // A segment of no length is a point (a step that didn't move).
    t = l2
      ? Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / l2))
      : 0;
  return Math.hypot(x - a.x - vx * t, y - a.y - vy * t);
}
/** How close the path from (ox, oy) to (x, y) comes to the segment a–b. */
export function pathDistance(
  ox: number,
  oy: number,
  x: number,
  y: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const cross = (
    px: number,
    py: number,
    qx: number,
    qy: number,
    rx: number,
    ry: number,
  ) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = cross(a.x, a.y, b.x, b.y, ox, oy),
    d2 = cross(a.x, a.y, b.x, b.y, x, y),
    d3 = cross(ox, oy, x, y, a.x, a.y),
    d4 = cross(ox, oy, x, y, b.x, b.y);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  const o = { x: ox, y: oy },
    p = { x, y };
  return Math.min(
    segmentDistance(ox, oy, a, b),
    segmentDistance(x, y, a, b),
    segmentDistance(a.x, a.y, o, p),
    segmentDistance(b.x, b.y, o, p),
  );
}
interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
const inBox = (x: number, y: number, r: Box) =>
  x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1;
/** On the stage or the catwalk in front of the LED wall. */
export const onRunway = (x: number, y: number) =>
  inBox(x, y, PLAZA_STAGE) || inBox(x, y, PLAZA_WALK);
export const inSquare = (x: number, y: number, k = 1) =>
  ((x - PLAZA_SQUARE.x) / (PLAZA_SQUARE.rx * k)) ** 2 +
    ((y - PLAZA_SQUARE.y) / (PLAZA_SQUARE.ry * k)) ** 2 <
  1;
export const inPitch = (x: number, y: number, m = 0) =>
  x > PLAZA_PITCH.x0 - m &&
  x < PLAZA_PITCH.x1 + m &&
  y > PLAZA_PITCH.y0 - m &&
  y < PLAZA_PITCH.y1 + m;

/* ---------- scenery (positions only; the art is drawn in the browser) ---------- */
export interface PlazaHouseStyle {
  wall: string;
  roof: string;
  shutters: string;
  sd: number;
  w: number;
  windows?: number;
  sign?: { t: string; bg: string };
}
export const PLAZA_HOUSES: readonly {
  x: number;
  y: number;
  o: PlazaHouseStyle;
}[] = [
  {
    x: 170,
    y: 330,
    o: { wall: "#ffe9c8", roof: "#e8564a", shutters: "#5fb3ff", sd: 1, w: 150 },
  },
  {
    x: 410,
    y: 300,
    o: {
      wall: "#ffd6e0",
      roof: "#3f6fd0",
      shutters: "#ffffff",
      sd: 2,
      w: 140,
      windows: 1,
      sign: { t: "STUDIO", bg: "#2a1f4c" },
    },
  },
  {
    x: 650,
    y: 330,
    o: { wall: "#d8f5e4", roof: "#2a8a7a", shutters: "#ffd65b", sd: 3, w: 160 },
  },
  {
    x: 2060,
    y: 320,
    o: {
      wall: "#fff1b8",
      roof: "#8a4ad0",
      shutters: "#ff9bd2",
      sd: 4,
      w: 150,
      windows: 1,
      sign: { t: "BAKERY", bg: "#7a3a1a" },
    },
  },
  {
    x: 2300,
    y: 300,
    o: { wall: "#e2ecff", roof: "#ef7a3a", shutters: "#4fae46", sd: 5, w: 150 },
  },
  {
    x: 2540,
    y: 330,
    o: {
      wall: "#ffe0cc",
      roof: "#2f4a8a",
      shutters: "#ffffff",
      sd: 6,
      w: 140,
      windows: 1,
    },
  },
];
export const PLAZA_TREES: readonly { x: number; y: number; kind: string }[] = (
  [
    [70, 560, "pine"],
    [60, 820, "round"],
    [110, 1220, "mint"],
    [260, 1470, "autumn"],
    [560, 1520, "round"],
    [820, 1440, "cherry"],
    [905, 210, "cherry"],
    [1800, 210, "cherry"],
    [2660, 600, "pine"],
    [2660, 1280, "mint"],
    [2520, 1520, "autumn"],
    [1880, 1530, "round"],
    [930, 1180, "apple"],
    [1810, 1240, "orange"],
    [2655, 920, "pine"],
    [60, 330, "lime"],
  ] as const
).map(([x, y, kind]) => ({ x, y, kind }));

/** Free ground for scenery: not on the square, pitch, track, stage, pond, paths or spots. */
export function plazaClear(x: number, y: number, pad = 0) {
  const SQ = PLAZA_SQUARE,
    T = PLAZA_TRACK,
    P = PLAZA_POND;
  if (inSquare(x, y, 1.22 + pad / 300)) return false;
  if (inPitch(x, y, 130 + pad)) return false;
  if (
    ((x - T.cx) / (T.ro[0] + 80 + pad)) ** 2 +
      ((y - T.cy) / (T.ro[1] + 80 + pad)) ** 2 <
    1
  )
    return false;
  if (
    x > PLAZA_LED.x0 - 140 &&
    x < PLAZA_LED.x1 + 140 &&
    y < PLAZA_WALK.y1 + 70
  )
    return false;
  if (((x - P.x) / (P.rx + 80)) ** 2 + ((y - P.y) / (P.ry + 70)) ** 2 < 1)
    return false;
  if (Math.abs(x - SQ.x) < 120 && y > SQ.y) return false;
  if (Math.abs(y - SQ.y) < 100) {
    if (x > SQ.x + 200 && x < PLAZA_PITCH.x0) return false;
    if (x < SQ.x - 200 && x > T.cx) return false;
  }
  if (
    PLAZA_LANDINGS.some(
      (l) =>
        ((x - l.x) / (l.rx + 40)) ** 2 + ((y - l.y) / (l.ry + 30)) ** 2 < 1,
    )
  )
    return false;
  // The Photo Spot's arch rises well above its spot, and its two bushes
  // stand west of it (drawn with it): keep both clear.
  if (
    x > PLAZA_PHOTO.x - 300 &&
    x < PLAZA_PHOTO.x + 150 &&
    y > PLAZA_PHOTO.y - 300 &&
    y < PLAZA_PHOTO.y + 60
  )
    return false;
  if (
    Math.hypot(x - PLAZA_PHOTO.x, (y - PLAZA_PHOTO.y) * 1.4) < 190 ||
    Math.hypot(x - PLAZA_CAFE.x, (y - PLAZA_CAFE.y) * 1.3) < 230 ||
    Math.hypot(x - PLAZA_BOARD.x, y - PLAZA_BOARD.y) < 140 ||
    Math.hypot(x - PLAZA_LEADER.x, y - PLAZA_LEADER.y) < 130
  )
    return false;
  if (
    PLAZA_HOUSES.some(
      (h) => Math.abs(x - h.x) < 130 && y > h.y - 230 && y < h.y + 60,
    )
  )
    return false;
  if (y > 1480 && Math.abs(x - PLAZA_GATE.x) < 280) return false;
  return true;
}
/** The prototype's seeded generator (Park–Miller), so scenery lands where it was approved. */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const BUSH_KINDS = ["flower", "green", "rose", "mint", "flower"] as const;
function scatter() {
  const W = PLAZA.width,
    H = PLAZA.height,
    rnd = seeded(5),
    bushes: {
      x: number;
      y: number;
      kind: string;
      seed: number;
      size: number;
    }[] = [],
    rocks: { x: number; y: number; seed: number; size: number }[] = [];
  for (let i = 0; i < 3000 && bushes.length < 20; i++) {
    const x = 40 + rnd() * (W - 80),
      y = 140 + rnd() * (H - 180);
    if (
      plazaClear(x, y) &&
      PLAZA_TREES.every((t) => Math.hypot(t.x - x, t.y - y) > 110) &&
      bushes.every((t) => Math.hypot(t.x - x, t.y - y) > 150)
    )
      bushes.push({
        x,
        y,
        kind: BUSH_KINDS[bushes.length % 5],
        seed: bushes.length + 1,
        size: 62 + rnd() * 26,
      });
  }
  for (let i = 0; i < 2000 && rocks.length < 7; i++) {
    const x = 40 + rnd() * (W - 80),
      y = 140 + rnd() * (H - 180);
    if (
      plazaClear(x, y) &&
      [...PLAZA_TREES, ...bushes].every(
        (t) => Math.hypot(t.x - x, t.y - y) > 90,
      )
    )
      rocks.push({ x, y, seed: rocks.length + 2, size: 34 + rnd() * 26 });
  }
  return { bushes, rocks };
}
/**
 * The stone paths (points and width), drawn in the browser. Shared so
 * scenery can keep off them.
 */
export const PLAZA_PATHS: readonly {
  pts: readonly (readonly [number, number])[];
  w: number;
}[] = [
  {
    pts: [
      [PLAZA_SQUARE.x, PLAZA_SQUARE.y + 200],
      [PLAZA_SQUARE.x, PLAZA_GATE.y + 30],
    ],
    w: 116,
  },
  {
    pts: [
      [PLAZA_SQUARE.x + 330, PLAZA_SQUARE.y],
      [PLAZA_PITCH.x0 + 10, PLAZA_SQUARE.y],
    ],
    w: 104,
  },
  {
    pts: [
      [PLAZA_SQUARE.x - 350, PLAZA_SQUARE.y],
      [PLAZA_TRACK.cx + PLAZA_TRACK.ro[0] - 30, PLAZA_TRACK.cy],
    ],
    w: 104,
  },
  {
    pts: [
      [PLAZA_SQUARE.x, PLAZA_SQUARE.y - 200],
      [PLAZA_SQUARE.x, PLAZA_WALK.y1 - 10],
    ],
    w: 116,
  },
  {
    pts: [
      [PLAZA_SQUARE.x + 220, PLAZA_SQUARE.y - 180],
      [PLAZA_CAFE.x - 30, PLAZA_CAFE.y + 72],
    ],
    w: 80,
  },
  {
    pts: [
      [PLAZA_SQUARE.x - 220, PLAZA_SQUARE.y - 180],
      [PLAZA_PHOTO.x, PLAZA_PHOTO.y + 32],
    ],
    w: 80,
  },
  {
    pts: [
      [PLAZA_SQUARE.x - 240, PLAZA_SQUARE.y + 200],
      [PLAZA_BOARD.x + 30, PLAZA_BOARD.y - 10],
    ],
    w: 72,
  },
  {
    pts: [
      // From the main path itself, not a stub beside it.
      [PLAZA_SQUARE.x, PLAZA_GATE.y - 200],
      [PLAZA_POND.x - 170, PLAZA_POND.y - 40],
    ],
    w: 72,
  },
  {
    pts: [
      [PLAZA_TRACK.cx - 40, PLAZA_TRACK.cy - PLAZA_TRACK.ro[1] - 10],
      [PLAZA_LEADER.x + 10, PLAZA_LEADER.y + 36],
    ],
    w: 64,
  },
  // The houses' lanes run on to the Photo Spot and the Volt Boba truck, so
  // they meet the paths from the square instead of stopping in the grass.
  {
    pts: [
      [410, 330],
      [410, 470],
      [880, 540],
      [PLAZA_PHOTO.x, PLAZA_PHOTO.y + 32],
    ],
    w: 64,
  },
  // Front walks: the teal house, the Bakery and the far east house reach
  // the lanes below them.
  {
    pts: [
      [650, 335],
      [650, 506],
    ],
    w: 56,
  },
  {
    pts: [
      [2060, 325],
      [2060, 511],
    ],
    w: 56,
  },
  {
    pts: [
      [2540, 335],
      [2540, 400],
      [2300, 460],
    ],
    w: 56,
  },
  // … and the studio lane down to the TOP DASH path along the track.
  {
    pts: [
      [410, 470],
      [410, PLAZA_LEADER.y + 30],
    ],
    w: 64,
  },
  {
    pts: [
      [2300, 330],
      [2300, 460],
      [1900, 545],
      [PLAZA_CAFE.x - 30, PLAZA_CAFE.y + 72],
    ],
    w: 64,
  },
];
/**
 * Paved landings where paths arrive (the Photo Spot under its arch, the
 * Volt Boba counter): the paths end inside them, so no path stops in a
 * round stub on the grass.
 */
export const PLAZA_LANDINGS: readonly {
  x: number;
  y: number;
  rx: number;
  ry: number;
}[] = [
  { x: PLAZA_PHOTO.x, y: PLAZA_PHOTO.y + 32, rx: 104, ry: 58 },
  { x: PLAZA_CAFE.x - 30, y: PLAZA_CAFE.y + 72, rx: 124, ry: 50 },
  // In front of the TOP DASH board.
  { x: PLAZA_LEADER.x + 10, y: PLAZA_LEADER.y + 36, rx: 96, ry: 36 },
];
/** How far a point is from the nearest path's edge (negative: on it), and
 * which way is off it. */
export function plazaPathGap(x: number, y: number) {
  let gap = Infinity,
    away = { x: 0, y: 0 };
  for (const p of PLAZA_PATHS)
    for (let i = 0; i < p.pts.length - 1; i++) {
      const a = { x: p.pts[i][0], y: p.pts[i][1] },
        b = { x: p.pts[i + 1][0], y: p.pts[i + 1][1] },
        d = segmentDistance(x, y, a, b),
        g = d - p.w / 2 - 9;
      if (g < gap) {
        gap = g;
        // Straight off the path, at a right angle to it.
        const vx = b.x - a.x,
          vy = b.y - a.y,
          L = Math.hypot(vx, vy) || 1,
          side = Math.sign((x - a.x) * -vy + (y - a.y) * vx) || 1;
        away = { x: (-vy / L) * side, y: (vx / L) * side };
      }
    }
  return { gap, away };
}
/**
 * Keep scattered scenery where the prototype put it, but off the paths,
 * clear of the fence along the bottom and of benches, lamps, trees and each
 * other: anything in the way moves to the nearest free spot around it.
 */
function settle<T extends { x: number; y: number; size: number }>(
  items: T[],
  others: readonly { x: number; y: number; size?: number }[] = [],
) {
  const out: T[] = [];
  for (const item of items) {
    const r = item.size / 2,
      free = (x: number, y: number) =>
        plazaClear(x, y) &&
        plazaPathGap(x, y).gap >= r &&
        y <= PLAZA_GATE.y - r - 20 &&
        PLAZA_TREES.every((t) => Math.hypot(t.x - x, t.y - y) > r + 60) &&
        [...others, ...out].every(
          (o) => Math.hypot(o.x - x, o.y - y) >= r + (o.size ?? 60) / 2,
        );
    let spot = { x: item.x, y: Math.min(item.y, PLAZA_GATE.y - r - 20) };
    // Nearest first: the spot itself, then rings around it.
    search: for (let ring = 0; ring <= 12; ring++)
      for (let k = 0; k < Math.max(1, ring * 8); k++) {
        const a = (k / Math.max(1, ring * 8)) * Math.PI * 2,
          x = spot.x + Math.cos(a) * ring * 20,
          y = spot.y + Math.sin(a) * ring * 20;
        if (free(x, y)) {
          spot = { x, y };
          break search;
        }
      }
    out.push({ ...item, ...spot });
  }
  return out;
}
export const PLAZA_LAMPS: readonly { x: number; y: number }[] = [
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    return {
      x: PLAZA_SQUARE.x + Math.cos(a) * (PLAZA_SQUARE.rx + 34),
      y: PLAZA_SQUARE.y + Math.sin(a) * (PLAZA_SQUARE.ry + 22),
    };
  }),
  { x: 1280, y: 1300 },
  { x: 1420, y: 1300 },
  { x: 1280, y: 1460 },
  { x: 1420, y: 1460 },
  // Along the east path, just off its stones. (The west path is too short
  // for a pair: they stood on the dash track's lane.)
  { x: 1830, y: 828 },
  { x: 1830, y: 972 },
];
/** Benches round the square, each beside a path rather than on it. */
export const PLAZA_BENCHES: readonly { x: number; y: number }[] = [
  { x: 1180, y: 1210 },
  { x: 1520, y: 1210 },
  { x: 990, y: 680 },
  { x: 1710, y: 680 },
];
const SCATTER = scatter();
/** Benches and lamps, as round footprints scattered scenery keeps clear of. */
const FIXTURES = [
  ...PLAZA_BENCHES.map((b) => ({ x: b.x, y: b.y, size: 100 })),
  ...PLAZA_LAMPS.map((l) => ({ x: l.x, y: l.y, size: 24 })),
];
export const PLAZA_BUSHES = settle(SCATTER.bushes, FIXTURES);
export const PLAZA_ROCKS = settle(SCATTER.rocks, [
  ...FIXTURES,
  ...PLAZA_BUSHES,
]);
export const PLAZA_FLOODLIGHTS: readonly { x: number; y: number }[] = [
  { x: PLAZA_PITCH.x0 - 30, y: PLAZA_PITCH.y0 - 20 },
  { x: PLAZA_PITCH.x1 + 30, y: PLAZA_PITCH.y0 - 20 },
  { x: PLAZA_PITCH.x0 - 30, y: PLAZA_PITCH.y1 + 30 },
  { x: PLAZA_PITCH.x1 + 30, y: PLAZA_PITCH.y1 + 30 },
];
/** Round obstacles; `sy` squashes them (the ground is seen at a slant). */
export interface PlazaObstacle {
  x: number;
  y: number;
  r: number;
  sy?: number;
}
export const PLAZA_OBSTACLES: readonly PlazaObstacle[] = [
  { x: PLAZA_FOUNTAIN.x, y: PLAZA_FOUNTAIN.y, r: 100, sy: 1.6 },
  ...PLAZA_TREES.map((t) => ({ x: t.x, y: t.y, r: 22 })),
  ...PLAZA_LAMPS.map((l) => ({ x: l.x, y: l.y, r: 9 })),
  ...PLAZA_BENCHES.map((b) => ({ x: b.x, y: b.y - 6, r: 40, sy: 3 })),
  ...PLAZA_BUSHES.map((b) => ({ x: b.x, y: b.y - 4, r: 26, sy: 1.6 })),
  ...PLAZA_ROCKS.map((b) => ({ x: b.x, y: b.y - 4, r: 16, sy: 1.6 })),
  ...PLAZA_FLOODLIGHTS.map((f) => ({ x: f.x, y: f.y, r: 12 })),
  ...PLAZA_HOUSES.map((h) => ({ x: h.x + 14, y: h.y - 30, r: 110, sy: 3 })),
  { x: PLAZA_CAFE.x + 10, y: PLAZA_CAFE.y - 40, r: 130, sy: 2.6 },
  { x: PLAZA_BOARD.x, y: PLAZA_BOARD.y, r: 54, sy: 3 },
  { x: PLAZA_LEADER.x, y: PLAZA_LEADER.y, r: 60, sy: 3 },
  { x: PLAZA_PHOTO_CAMERA.x, y: PLAZA_PHOTO_CAMERA.y - 4, r: 16 },
];

/** Keep a body out of every obstacle, the pond and the stage wall, and inside the map. */
export function plazaCollide(b: { x: number; y: number }) {
  const R = PLAZA.radius;
  for (const o of PLAZA_OBSTACLES) {
    const sy = o.sy || 1,
      dx = b.x - o.x,
      dy = (b.y - o.y) * sy,
      d = Math.hypot(dx, dy),
      m = o.r + R;
    if (d < m && d > 0) {
      b.x = o.x + (dx / d) * m;
      b.y = o.y + ((dy / d) * m) / sy;
    }
  }
  if (
    b.x > PLAZA_LED.x0 - 20 &&
    b.x < PLAZA_LED.x1 + 20 &&
    b.y < PLAZA_STAGE.y0 + 8
  )
    b.y = PLAZA_STAGE.y0 + 8;
  b.x = Math.max(30, Math.min(PLAZA.width - 30, b.x));
  b.y = Math.max(110, b.y);
  if (b.y > PLAZA_GATE.y && Math.abs(b.x - PLAZA_GATE.x) > 62)
    b.y = PLAZA_GATE.y;
  if (b.y > PLAZA_GATE.y + 30) b.y = PLAZA_GATE.y + 30;
  const P = PLAZA_POND;
  if (((b.x - P.x) / P.rx) ** 2 + ((b.y - P.y) / P.ry) ** 2 < 1) {
    const a = Math.atan2((b.y - P.y) / P.ry, (b.x - P.x) / P.rx);
    b.x = P.x + Math.cos(a) * P.rx;
    b.y = P.y + Math.sin(a) * P.ry;
  }
  return b;
}

/* ---------- movement ---------- */
/** One body's movement state; the same on the server and in the browser. */
export interface PlazaBody {
  x: number;
  y: number;
  /** Height above the ground (jumps and bounce pads). */
  z: number;
  /** Seconds into the current jump (0 = on the ground). */
  air: number;
  airDur: number;
  airH: number;
  /** Seconds of dash left, and until the next dash. */
  dash: number;
  dashCd: number;
  dashX: number;
  dashY: number;
  /** Seconds of stumbling left after a hurdle. */
  stun: number;
  stumbled: boolean;
  face: 1 | -1;
  lastX: number;
  lastY: number;
  /** Seconds of Volt Boba speed left. */
  boost: number;
  vx: number;
  vy: number;
  /** Speed over the last step (px/s). */
  speed: number;
}
export function plazaBody(x: number, y: number): PlazaBody {
  return {
    x,
    y,
    z: 0,
    air: 0,
    airDur: 0,
    airH: 0,
    dash: 0,
    dashCd: 0,
    dashX: 1,
    dashY: 0,
    stun: 0,
    stumbled: false,
    face: 1,
    lastX: 0,
    lastY: 0,
    boost: 0,
    vx: 0,
    vy: 0,
    speed: 0,
  };
}
/** Start a jump; false while already in the air or stumbling. */
export function plazaJump(
  b: PlazaBody,
  seconds: number = PLAZA.jump.seconds,
  height: number = PLAZA.jump.height,
) {
  if (b.air || b.stun > 0) return false;
  b.air = 1e-4;
  b.airDur = seconds;
  b.airH = height;
  return true;
}
/**
 * Dash the way you last moved (or faced); false while on cooldown or
 * stumbling. The server passes the way the browser dashed (`dir`): its own
 * last stick can be a step or two old, and a dash that leaves at another
 * angle lands the server's copy of you far from where you see yourself.
 */
export function plazaDash(
  b: PlazaBody,
  dir?: { x: number; y: number },
  /** Seconds of cooldown or stumbling still left that are let off (the
   * server's: the browser already dashed). */
  slack = 0,
) {
  if (b.dashCd > slack || b.stun > slack) return false;
  b.stun = 0;
  if (dir && Math.hypot(dir.x, dir.y) > 0.05) {
    b.lastX = dir.x;
    b.lastY = dir.y;
  }
  const m = Math.hypot(b.lastX, b.lastY);
  b.dash = PLAZA.dashSeconds;
  b.dashCd = PLAZA.dashEvery;
  b.dashX = m > 0.05 ? b.lastX / m : b.face;
  b.dashY = m > 0.05 ? b.lastY / m : 0;
  return true;
}
/** A clean stick: finite, at most length 1. */
export function plazaStick(x: unknown, y: unknown) {
  let dx = typeof x === "number" && Number.isFinite(x) ? x : 0,
    dy = typeof y === "number" && Number.isFinite(y) ? y : 0;
  const m = Math.hypot(dx, dy);
  if (m > 1) {
    dx /= m;
    dy /= m;
  }
  return { x: dx, y: dy };
}
export interface PlazaStepEvents {
  /** A bounce pad threw the body up (pad index). */
  bounced?: number;
  /** Tripped over a hurdle. */
  tripped?: boolean;
  /** Landed from a jump. */
  landed?: boolean;
}
/**
 * Advance one body by `dt` seconds with stick `dir` (already clean). Order and
 * numbers follow the prototype: stumble, dash or walk, collide, jump arc,
 * timers, bounce pads, hurdles.
 */
export function plazaStep(
  b: PlazaBody,
  dir: { x: number; y: number },
  dt: number,
): PlazaStepEvents {
  dt = Math.min(Math.max(dt, 0), 0.1);
  const events: PlazaStepEvents = {};
  if (b.dashCd > 0) b.dashCd = Math.max(0, b.dashCd - dt);
  if (b.boost > 0) b.boost = Math.max(0, b.boost - dt);
  if (b.stun > 0) {
    // Stumbling: stand still, and move only for what's left of the step
    // once it ends (the same at 20 steps a second as at 60 frames).
    if (b.stun >= dt) {
      b.stun -= dt;
      b.speed = b.vx = b.vy = 0;
      return events;
    }
    dt -= b.stun;
    b.stun = 0;
  }
  let vx: number, vy: number;
  const speed = PLAZA.speed * (b.boost > 0 ? PLAZA.boba.speed : 1);
  if (b.dash > 0) {
    // Dash for what's left of it and walk the rest of the step, so a dash
    // goes as far at the server's 20 steps a second as at 60 frames.
    const f = dt > 0 ? Math.min(1, b.dash / dt) : 1;
    b.dash = Math.max(0, b.dash - dt);
    vx = b.dashX * PLAZA.dashSpeed * f + dir.x * speed * (1 - f);
    vy = b.dashY * PLAZA.dashSpeed * f + dir.y * speed * (1 - f);
  } else {
    vx = dir.x * speed;
    vy = dir.y * speed;
  }
  if (dir.x || dir.y) {
    b.lastX = dir.x;
    b.lastY = dir.y;
  }
  if (Math.abs(vx) > 5) b.face = vx > 0 ? 1 : -1;
  const ox = b.x,
    oy = b.y,
    oAir = b.air;
  b.x += vx * dt;
  b.y += vy * dt;
  plazaCollide(b);
  b.vx = dt > 0 ? (b.x - ox) / dt : 0;
  b.vy = dt > 0 ? (b.y - oy) / dt : 0;
  b.speed = Math.hypot(b.vx, b.vy);
  if (b.air) {
    b.air += dt;
    b.z = Math.sin(Math.PI * Math.min(1, b.air / b.airDur)) * b.airH;
    if (b.air >= b.airDur) {
      b.air = 0;
      b.z = 0;
      events.landed = true;
    }
  }
  if (!b.air)
    PLAZA_PADS.forEach(([x, y], i) => {
      if (
        !b.air &&
        Math.hypot(b.x - x, (b.y - y) * 1.5) < 40 &&
        plazaJump(b, PLAZA.pad.seconds, PLAZA.pad.height)
      )
        events.bounced = i;
    });
  // The whole way this step went, not just where it ended: a dash covers
  // 34 px in one of the server's steps and would hop a hurdle the browser,
  // at 60 frames, trips on.
  let hd = Infinity,
    hit: (typeof PLAZA_HURDLE_SEGMENTS)[number] | undefined;
  for (const h of PLAZA_HURDLE_SEGMENTS) {
    const d = pathDistance(ox, oy, b.x, b.y, h[0], h[1]);
    if (d < hd) {
      hd = d;
      hit = h;
    }
  }
  const trip =
    hd < 12 && !b.stumbled ? hurdleTrip(b, hit!, ox, oy, oAir, dt) : undefined;
  if (trip !== undefined) {
    // Fall where and when you reached the hurdle, not a whole step past it:
    // the rest of the step counts as stumbling.
    b.x = ox + (b.x - ox) * trip;
    b.y = oy + (b.y - oy) * trip;
    b.stun = PLAZA.stunSeconds - (1 - trip) * dt;
    b.stumbled = true;
    b.dash = 0;
    events.tripped = true;
  }
  if (hd > 30) b.stumbled = false;
  return events;
}

/**
 * When in this step (0..1) the body trips over hurdle `h`, or undefined if it
 * clears it: the first moment it is both within 12 px of the hurdle and
 * lower than 16 px. Worked out exactly rather than at the step's end, so the
 * server's 20 steps a second and the browser's 60 frames trip (or clear)
 * alike, even on a late jump.
 */
function hurdleTrip(
  b: PlazaBody,
  [p0, p1]: (typeof PLAZA_HURDLE_SEGMENTS)[number],
  ox: number,
  oy: number,
  oAir: number,
  dt: number,
) {
  const len = Math.hypot(p1.x - p0.x, p1.y - p0.y),
    side = (px: number, py: number) =>
      ((p1.x - p0.x) * (py - p0.y) - (p1.y - p0.y) * (px - p0.x)) / len,
    s0 = side(ox, oy),
    s1 = side(b.x, b.y);
  // The part of the step within 12 px of the hurdle's line.
  let r0 = 0,
    r1 = 1;
  if (s1 !== s0) {
    const ra = (-12 - s0) / (s1 - s0),
      rb = (12 - s0) / (s1 - s0);
    r0 = Math.max(0, Math.min(ra, rb));
    r1 = Math.min(1, Math.max(ra, rb));
  } else if (Math.abs(s0) >= 12) return undefined;
  if (r0 > r1) return undefined;
  const height = (r: number) => {
    if (!oAir) return 0;
    const a = oAir + r * dt;
    return a >= b.airDur ? 0 : Math.sin((Math.PI * a) / b.airDur) * b.airH;
  };
  if (height(r0) < 16) return r0;
  // High when you got there: you trip only if you come down below 16 px
  // before you're past it.
  const down = b.airDur * (1 - Math.asin(16 / b.airH) / Math.PI),
    r = (down - oAir) / dt;
  return r <= r1 ? Math.max(r0, r) : undefined;
}

/* ---------- the dash track's lap timer ---------- */
/** Laps run clockwise from the start line at the top of the track. */
export const PLAZA_LAP_START = -Math.PI / 2;
/**
 * How far past the painted edges of the red lane still counts as on it (px,
 * from your centre): further out, your whole body (PLAZA.radius) is on the
 * grass and the lap ends at once. The server plays your inputs at the
 * moments you pressed them (apps/server/src/plaza.ts, timed inputs), so its
 * copy of you runs where your screen shows you, without the slack and grace
 * the lap timer once needed.
 */
export const PLAZA_LAP_LANE = { slack: 20 } as const;
/** On the red lane, for the lap timer (with PLAZA_LAP_LANE's slack). */
export function inLapLane(x: number, y: number) {
  const { cx, cy, ro, ri } = PLAZA_TRACK,
    k = PLAZA_LAP_LANE.slack,
    e = (a: number, b: number) => ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2;
  return e(ro[0] + k, ro[1] + k) <= 1 && e(ri[0] - k, ri[1] - k) >= 1;
}
/**
 * Times a lap from server positions. A lap starts when you cross the start
 * line clockwise on the lane, and ends when you've gone all the way round
 * (2π clockwise) without leaving it: off the lane (inLapLane), the lap is
 * cancelled at once. Crossing is checked between steps, so a fast dash
 * can't skip a line.
 */
export class LapTimer {
  /** Unwrapped angle travelled since the start line; null when not running. */
  private travelled: number | null = null;
  private last: number | null = null;
  private startedAt = 0;
  get running() {
    return this.travelled !== null;
  }
  get startTime() {
    return this.startedAt;
  }
  /** Distance round the lap so far, 0..1. */
  get progress() {
    return this.travelled === null
      ? 0
      : Math.min(1, this.travelled / (Math.PI * 2));
  }
  reset() {
    this.travelled = null;
  }
  private cancel(): { cancelled: true } {
    this.travelled = null;
    return { cancelled: true };
  }
  /** Feed a position; returns a finished lap's time (ms) or "start" / "cancel". */
  update(
    x: number,
    y: number,
    now: number,
  ): { started?: true; cancelled?: true; lapMs?: number } {
    const lane = inLapLane(x, y),
      a = trackPolar(x, y).a,
      prev = this.last;
    this.last = lane ? a : null;
    if (this.travelled === null) {
      if (!lane || prev === null) return {};
      // Start line: from just before −π/2 to at or past it, clockwise.
      const d = wrap(a - prev),
        before = wrap(prev - PLAZA_LAP_START),
        after = wrap(a - PLAZA_LAP_START);
      if (d > 0 && before < 0 && after >= 0 && after - before < Math.PI) {
        this.travelled = after;
        this.startedAt = now;
        return { started: true };
      }
      return {};
    }
    if (!lane) return this.cancel();
    if (prev === null) return {};
    this.travelled += wrap(a - prev);
    if (this.travelled >= Math.PI * 2) {
      const lapMs = now - this.startedAt;
      // Carry on: crossing the line again starts the next lap at once.
      this.travelled -= Math.PI * 2;
      this.startedAt = now;
      return { lapMs, started: true };
    }
    // Running backwards past the start line cancels the lap.
    if (this.travelled < -0.3) return this.cancel();
    return {};
  }
}
const wrap = (d: number) => {
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
};

/* ---------- Orb Shower ---------- */
export const ORB_SHOWER = {
  /** Every 15 minutes on the UTC clock (:00, :15, :30, :45) … */
  everyMs: 15 * 60_000,
  /** … for one minute. */
  lastsMs: 60_000,
  /** A new orb every 0.35 s until 3 s before the end, at most this many lying around. */
  spawnMs: 350,
  stopBeforeEndMs: 3000,
  maxOrbs: 40,
  /** Orbs fall from this height with this gravity (px, px/s²); catchable below 40 px. */
  height: 380,
  gravity: 600,
  catchHeight: 40,
  catchRadius: 34,
  /** The most orbs that count per shower and per Pacific day (toward the orbs quest). */
  perShower: 10,
  perDay: 50,
} as const;
/** The Orb Shower at time `now` (ms): on, and when it started/ends or the next one starts. */
export function orbShower(now: number) {
  const start = Math.floor(now / ORB_SHOWER.everyMs) * ORB_SHOWER.everyMs,
    on = now - start < ORB_SHOWER.lastsMs;
  return {
    on,
    /** The shower's id: its start, in minutes since 1970 (UTC). */
    key: String(start / 60_000),
    startsAt: on ? start : start + ORB_SHOWER.everyMs,
    endsAt: (on ? start : start + ORB_SHOWER.everyMs) + ORB_SHOWER.lastsMs,
  };
}
/** An orb's height `ms` after it appeared. */
export function orbHeight(ms: number) {
  const t = Math.max(0, ms) / 1000;
  return Math.max(0, ORB_SHOWER.height - 0.5 * ORB_SHOWER.gravity * t * t);
}

/* ---------- Wishing fountain: treats thrown at the fountain fill a shared
   meter per Plaza copy; a full meter sets off fireworks and pays everyone who
   wished (the database's arena_plaza_wish(), migration
   20261120130000_plaza_wishing_fountain) ---------- */
export const PLAZA_WISH = {
  /** A treat thrown inside this ellipse round the fountain's centre is a wish (px). */
  reach: { rx: 215, ry: 150 },
  /** The server allows this much more (px), for lag. */
  slack: 40,
  /**
   * Wishes to fill the meter: perPlayer for each player in the copy, between
   * min and max, fixed by the fill's first wish. With treatsDaily 10, three or
   * four players fill it with two treats each (a few minutes at the fountain);
   * two need three each, and someone alone six (once a day): it pays best
   * together.
   */
  perPlayer: 2,
  min: 6,
  max: 24,
  /** A meter nobody has added to for this long empties (ms). */
  idleMs: 10 * 60_000,
  /** The fireworks over the square (ms). */
  showMs: 5000,
  /**
   * Shop coins for each wisher in a fill (a PvP win's 15), at most perDay
   * paid fills a Pacific day: 30 a day on top of the Plaza quests' 80.
   */
  coins: 15,
  perDay: 2,
} as const;
/** Wishes a copy of `players` players needs to fill the meter. */
export function wishTarget(players: number) {
  const n = Math.ceil(Math.max(1, players | 0) * PLAZA_WISH.perPlayer);
  return Math.max(PLAZA_WISH.min, Math.min(PLAZA_WISH.max, n));
}
/** Standing close enough to the fountain to throw a treat in (slack for lag). */
export function atFountain(x: number, y: number, slack = 0) {
  const dx = (x - PLAZA_FOUNTAIN.x) / (PLAZA_WISH.reach.rx + slack),
    dy = (y - PLAZA_FOUNTAIN.y) / (PLAZA_WISH.reach.ry + slack);
  return dx * dx + dy * dy <= 1;
}
/** A copy's wish meter, sent to everyone in it when it changes. */
export interface PlazaWish {
  /** Wishes so far, and how many fill it (0 wishes: the browser uses wishTarget). */
  n: number;
  target: number;
  /** Fireworks: when they start (server ms) and their pattern's seed. */
  show?: { at: number; seed: number };
}
/** What arena_plaza_wish answers for one wisher of a fill. */
export interface PlazaWishPay {
  /** Paid now (false: this fill was paid already, or today's cap is reached). */
  paid: boolean;
  /** Coins paid now (0 when not paid). */
  coins: number;
  /** Paid fills today, after this one. */
  today: number;
}

/* ---------- Plaza today: daily quests paid in shop coins (the database's
   arena_plaza_quests(), migration 20261120120000_raise_plaza_quest_coins) ---------- */
export const PLAZA_QUESTS = [
  { id: "goal", text: "Score a goal on the pitch", max: 1, coins: 20 },
  { id: "lap", text: "Run a lap in under 30 s", max: 1, coins: 20 },
  { id: "cheers", text: "15 cheers on the runway", max: 15, coins: 15 },
  { id: "orbs", text: "Catch 10 falling orbs", max: 10, coins: 15 },
  { id: "photo", text: "Use the Photo Spot", max: 1, coins: 10 },
] as const;
export type PlazaQuestId = (typeof PLAZA_QUESTS)[number]["id"];
/** A lap under this time completes the lap quest. */
export const PLAZA_LAP_QUEST_MS = 30_000;
/** On the runway, the crowd cheers about this often (s). */
export const PLAZA_CHEER_SECONDS = 0.6;

/* ---------- interaction spots ---------- */
export const PLAZA_SPOTS = [
  {
    id: "photo",
    x: PLAZA_PHOTO.x,
    y: PLAZA_PHOTO.y + 30,
    r: 90,
    label: "Take photo",
    icon: "camera",
  },
  {
    id: "cafe",
    x: PLAZA_CAFE.x,
    y: PLAZA_CAFE.y + 40,
    r: 110,
    label: "Volt Boba",
    icon: "boba",
  },
  {
    id: "board",
    x: PLAZA_BOARD.x,
    y: PLAZA_BOARD.y + 30,
    r: 100,
    label: "Event board",
    icon: "clipboard",
  },
  {
    id: "leader",
    x: PLAZA_LEADER.x,
    y: PLAZA_LEADER.y + 30,
    r: 110,
    label: "Leaderboard",
    icon: "trophy",
  },
] as const;
export type PlazaSpotId = (typeof PLAZA_SPOTS)[number]["id"];
/** The spot within reach of (x, y), if any (the server checks reach with a little slack). */
export function plazaSpotAt(x: number, y: number, slack = 0) {
  return PLAZA_SPOTS.find((s) => Math.hypot(x - s.x, y - s.y) < s.r + slack);
}

/* ---------- the ball pitch (Orb Ball) ---------- */
export const PLAZA_BALL = {
  radius: 22,
  /** Kick speeds: a dash, or at least this much. */
  dashKick: 860,
  minKick: 150,
  /** Velocity kept per second (friction). */
  keep: 0.42,
  bounce: 0.8,
  /** After a goal the ball waits this long, then returns to the centre (s). */
  resetSeconds: 1.5,
} as const;
export interface PlazaBall {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Seconds until the ball returns to the centre after a goal. */
  lock: number;
}
export const plazaBallStart = (): PlazaBall => ({
  x: (PLAZA_PITCH.x0 + PLAZA_PITCH.x1) / 2,
  y: (PLAZA_PITCH.y0 + PLAZA_PITCH.y1) / 2,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  lock: 0,
});
/**
 * Advance the ball. `bodies` touch it (with their key); returns the side that
 * scored (0 = blue, attacking right; 1 = red, attacking left) and who touched
 * it last.
 */
export function plazaBallStep<K>(
  ball: PlazaBall,
  bodies: Iterable<{ key: K; body: PlazaBody }>,
  dt: number,
  last: { key?: K },
): { goal?: 0 | 1; scorer?: K } {
  dt = Math.min(Math.max(dt, 0), 0.1);
  const P = PLAZA_PITCH,
    r = PLAZA_BALL.radius;
  if (ball.lock > 0) {
    ball.lock -= dt;
    if (ball.lock <= 0) Object.assign(ball, plazaBallStart());
    return {};
  }
  for (const { key, body: b } of bodies) {
    if (b.z > 30) continue;
    const dx = ball.x - b.x,
      dy = ball.y - b.y,
      d = Math.hypot(dx, dy),
      m = r + PLAZA.radius;
    if (d < m && d > 0) {
      const nx = dx / d,
        ny = dy / d;
      ball.x = b.x + nx * m;
      ball.y = b.y + ny * m;
      const kick =
          b.dash > 0
            ? PLAZA_BALL.dashKick
            : Math.max(PLAZA_BALL.minKick, b.speed * 1.35),
        along = ball.vx * nx + ball.vy * ny;
      if (along < kick) {
        ball.vx += nx * (kick - along);
        ball.vy += ny * (kick - along);
        if (b.dash > 0) ball.vz = 260;
      }
      last.key = key;
    }
  }
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (ball.z > 0 || ball.vz > 0) {
    ball.vz -= 900 * dt;
    ball.z = Math.max(0, ball.z + ball.vz * dt);
    if (ball.z === 0) ball.vz = ball.vz < -120 ? -ball.vz * 0.4 : 0;
  }
  const f = Math.pow(PLAZA_BALL.keep, dt);
  ball.vx *= f;
  ball.vy *= f;
  if (ball.y < P.y0 + r) {
    ball.y = P.y0 + r;
    ball.vy = Math.abs(ball.vy) * PLAZA_BALL.bounce;
  }
  if (ball.y > P.y1 - r) {
    ball.y = P.y1 - r;
    ball.vy = -Math.abs(ball.vy) * PLAZA_BALL.bounce;
  }
  const mouth = ball.y > P.gy0 + 8 && ball.y < P.gy1 - 8;
  if (ball.x < P.x0 + r && !mouth) {
    ball.x = P.x0 + r;
    ball.vx = Math.abs(ball.vx) * PLAZA_BALL.bounce;
  }
  if (ball.x > P.x1 - r && !mouth) {
    ball.x = P.x1 - r;
    ball.vx = -Math.abs(ball.vx) * PLAZA_BALL.bounce;
  }
  if (ball.x < P.x0 - 14 || ball.x > P.x1 + 14) {
    const right = ball.x > P.x1;
    ball.lock = PLAZA_BALL.resetSeconds;
    ball.vx = ball.vy = 0;
    const scorer = last.key;
    last.key = undefined;
    return { goal: right ? 0 : 1, scorer };
  }
  return {};
}

/* ---------- what the server sends ---------- */
/** Body flags in a snapshot. */
export const PLAZA_FLAG = { dash: 1, stun: 2, boost: 4, bot: 8 } as const;
/** One body: [id, x, y, z, face, flags, emote (1-based, 0 = none), speed]. */
export type PlazaWalker = [
  number,
  number,
  number,
  number,
  1 | -1,
  number,
  number,
  number,
];
/** Who someone is (sent once when they appear); pitch bots are marked. */
export interface PlazaProfile {
  id: number;
  accountId?: string;
  name: string;
  title: string | null;
  titleColor: string | null;
  level: number | null;
  character: string;
  skin: { skin: string; stage?: number } | null;
  /** Verified wardrobe slots, including colours, aura, entrance, victory and portrait frame. */
  look?: RaidLoadout;
  /** Saved raid clears per boss (frame stars and the profile card). */
  raid?: Partial<Record<RaidBossId, number>>;
  /** A bot, not a person: a pitch bot or one of the townsfolk (NPCs). */
  bot?: boolean;
  /** Their avatar (avatars.ts), on their player card. */
  avatar?: string | null;
}
export interface PlazaState {
  plaza: number;
  population: number;
  me: number;
  /** Server time (ms), so the browser can line up the Orb Shower and laps. */
  now: number;
  walkers: PlazaWalker[];
  /** The ball, when the pitch is in view: [x, y, z]. */
  ball?: [number, number, number];
  score: [number, number];
  /** Runway cheers you've had this visit. */
  claps: number;
  /** Your lap: started at (server ms) and progress 0..1, when running. */
  lap?: [number, number];
  /**
   * The newest stick, jump or dash number (`s`) the browser sent that the server
   * has applied, and for how many ms of steps it has moved you since: your
   * position here matches where the browser had you that long after sending
   * it (apps/client/src/plaza/plaza-predict.ts).
   */
  ack?: [number, number];
}
/** Orbs as they appear and go: [id, x, y, appearedAt (server ms)]. */
export type PlazaOrb = [number, number, number, number];
export interface PlazaOrbs {
  shower: string;
  add: PlazaOrb[];
  /** Caught or cleared orbs, and who caught them (profile id, 0 = nobody). */
  gone: [number, number][];
  /** Replace the whole list (on join and at the start of a shower). */
  reset?: boolean;
}
/** Today's progress and the TOP DASH board (from the database). */
export interface PlazaProgress {
  day: string;
  quests: Record<PlazaQuestId, { n: number; done: boolean }>;
  /** Orbs that counted today. */
  orbsToday: number;
  bestLapMs: number | null;
  board: { name: string; ms: number; me?: boolean }[];
}
/** Things everyone in a Plaza copy hears about (the feed). */
export type PlazaNews =
  | { kind: "goal"; id: number; name: string; side: 0 | 1 }
  | { kind: "lap"; id: number; name: string; ms: number }
  | { kind: "runway"; id: number; name: string }
  | { kind: "wish" };
/** What the game server reports to the database (arena_plaza_record). */
export interface PlazaRecord {
  player: string;
  kind: "orb" | "goal" | "lap" | "cheers" | "photo";
  /** Orbs: "<shower>-<orb id>". */
  ref?: string;
  /** Laps: the time in ms. */
  ms?: number;
  /** Cheers so far today. */
  n?: number;
}
