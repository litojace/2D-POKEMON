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
  /** Volt Boba: Gold Leaves, speed and how long. */
  boba: { leaves: 10, speed: 1.3, seconds: 30 },
  /** Treats (migration 049): at most one throw this often (seconds). */
  treatSeconds: 1.5,
} as const;
/** A treat thrown in the Plaza, sent to everyone in that Plaza copy. */
export interface PlazaTreat {
  /** The thrower's walker id. */
  id: number;
  crop: string;
  x: number;
  y: number;
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
    t = Math.max(
      0,
      Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy)),
    );
  return Math.hypot(x - a.x - vx * t, y - a.y - vy * t);
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
    [2520, 1610, "autumn"],
    [1880, 1530, "round"],
    [930, 1180, "apple"],
    [1810, 1240, "orange"],
    [2680, 920, "pine"],
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
const SCATTER = scatter();
export const PLAZA_BUSHES = SCATTER.bushes;
export const PLAZA_ROCKS = SCATTER.rocks;
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
  { x: 1830, y: 850 },
  { x: 1830, y: 950 },
  { x: 870, y: 850 },
  { x: 870, y: 950 },
];
export const PLAZA_BENCHES: readonly { x: number; y: number }[] = (
  [
    [-0.62, 1],
    [0.62, 1],
    [-0.58, -1],
    [0.58, -1],
  ] as const
).map(([k, sgn]) => ({
  x: PLAZA_SQUARE.x + k * PLAZA_SQUARE.rx * 1.24,
  y: PLAZA_SQUARE.y + sgn * PLAZA_SQUARE.ry * 0.95 + (sgn > 0 ? 60 : -40),
}));
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
  { x: PLAZA_PHOTO.x + 72, y: PLAZA_PHOTO.y - 8, r: 20 },
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
/** Dash the way you last moved (or faced); false while on cooldown or stumbling. */
export function plazaDash(b: PlazaBody) {
  if (b.dashCd > 0 || b.stun > 0) return false;
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
    b.stun = Math.max(0, b.stun - dt);
    b.speed = b.vx = b.vy = 0;
    return events;
  }
  let vx: number, vy: number;
  const speed = PLAZA.speed * (b.boost > 0 ? PLAZA.boba.speed : 1);
  if (b.dash > 0) {
    b.dash = Math.max(0, b.dash - dt);
    vx = b.dashX * PLAZA.dashSpeed;
    vy = b.dashY * PLAZA.dashSpeed;
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
    oy = b.y;
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
  const hd = Math.min(
    ...PLAZA_HURDLE_SEGMENTS.map(([p0, p1]) =>
      segmentDistance(b.x, b.y, p0, p1),
    ),
  );
  if (hd < 12 && b.z < 16 && !b.stumbled) {
    b.stun = PLAZA.stunSeconds;
    b.stumbled = true;
    b.dash = 0;
    events.tripped = true;
  }
  if (hd > 30) b.stumbled = false;
  return events;
}

/* ---------- the dash track's lap timer ---------- */
/** Laps run clockwise from the start line at the top of the track. */
export const PLAZA_LAP_START = -Math.PI / 2;
/**
 * Times a lap from server positions. A lap starts when you cross the start
 * line clockwise inside the lane, and ends when you've gone all the way round
 * (2π clockwise) without leaving the lane. Crossing is checked between steps,
 * so a fast dash can't skip a line.
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
  /** Feed a position; returns a finished lap's time (ms) or "start" / "cancel". */
  update(
    x: number,
    y: number,
    now: number,
  ): { started?: true; cancelled?: true; lapMs?: number } {
    const inLane = this.inLane(x, y),
      a = trackPolar(x, y).a,
      prev = this.last;
    this.last = inLane ? a : null;
    if (!inLane) {
      if (this.travelled !== null) {
        this.travelled = null;
        return { cancelled: true };
      }
      return {};
    }
    if (prev === null) return {};
    // Signed angle change, wrapped into (−π, π].
    let d = a - prev;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d <= -Math.PI) d += Math.PI * 2;
    if (this.travelled === null) {
      // Start line: from just before −π/2 to at or past it, clockwise.
      const before = wrap(prev - PLAZA_LAP_START),
        after = wrap(a - PLAZA_LAP_START);
      if (d > 0 && before < 0 && after >= 0 && after - before < Math.PI) {
        this.travelled = after;
        this.startedAt = now;
        return { started: true };
      }
      return {};
    }
    this.travelled += d;
    if (this.travelled >= Math.PI * 2) {
      const lapMs = now - this.startedAt;
      // Carry on: crossing the line again starts the next lap at once.
      this.travelled -= Math.PI * 2;
      this.startedAt = now;
      return { lapMs, started: true };
    }
    // Running backwards past the start line cancels the lap.
    if (this.travelled < -0.3) {
      this.travelled = null;
      return { cancelled: true };
    }
    return {};
  }
  /** The lane with a little slack, so brushing an edge doesn't cancel a lap. */
  private inLane(x: number, y: number) {
    const { cx, cy, ro, ri } = PLAZA_TRACK;
    return (
      ((x - cx) / (ro[0] + 24)) ** 2 + ((y - cy) / (ro[1] + 24)) ** 2 <= 1 &&
      ((x - cx) / (ri[0] - 24)) ** 2 + ((y - cy) / (ri[1] - 24)) ** 2 >= 1
    );
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
  /** Gold Leaves per orb, and the most orbs that pay per shower and per Pacific day. */
  leaves: 2,
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

/* ---------- Plaza today: daily quests paid in Gold Leaves ---------- */
export const PLAZA_QUESTS = [
  { id: "goal", text: "Score a goal on the pitch", max: 1, leaves: 30 },
  { id: "lap", text: "Run a lap in under 30 s", max: 1, leaves: 40 },
  { id: "cheers", text: "15 cheers on the runway", max: 15, leaves: 30 },
  { id: "orbs", text: "Catch 10 falling orbs", max: 10, leaves: 25 },
  { id: "photo", text: "Use the Photo Spot", max: 1, leaves: 15 },
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
    label: "Volt Boba · 10",
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
  {
    id: "gate",
    x: PLAZA_GATE.x,
    y: PLAZA_GATE.y - 40,
    r: 110,
    label: "Enter the Farm",
    icon: "wheat",
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
  /** A pitch bot, not a person. */
  bot?: boolean;
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
  /** Orbs that paid today and in this shower. */
  orbsToday: number;
  bestLapMs: number | null;
  board: { name: string; ms: number; me?: boolean }[];
  leaves: number;
}
/** Things everyone in a Plaza copy hears about (the feed). */
export type PlazaNews =
  | { kind: "goal"; id: number; name: string; side: 0 | 1 }
  | { kind: "lap"; id: number; name: string; ms: number }
  | { kind: "runway"; id: number; name: string };
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
