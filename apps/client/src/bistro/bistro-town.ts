/*
 * Element Bistro: the neighbourhood's map and the life on it.
 *
 * One scale for everything, so nothing looks too big or too small: a grid
 * unit is about a metre on the ground and 55 world px of height. A creature
 * stands about 75 px tall (1.4 m in chibi proportions), a car is 2.5 units
 * long and about as tall as a creature, the bus 5.2 units long and 1.6
 * creatures tall. The bistro's wall (168 px) is one storey.
 *
 * The map, around the room (R: it grows when the room is expanded):
 *   - the main road on the door's side: two lanes of 2.1 units, a zebra
 *     crossing at the door, the bus stop on the near sidewalk;
 *   - the shops across it, taller blocks behind them (bistro-city.ts);
 *   - a back street behind the room with parked cars, terraced houses past it;
 *   - a square and a park on the right;
 *   - a promenade in front, then the canal (live water) and its far bank.
 * The camera only shows this dressed part of the world (bistro-scene.ts).
 *
 * What moves: creatures of the game walking (some with a dog), cycling,
 * resting on benches, waiting for the bus and crossing at the zebra (cars
 * stop for them); the bus; pigeons in the square; ducks on the canal; the
 * season's weather. Only pictures: nothing here touches the game's rules.
 */
import type { Facing } from "../animation/controller";
import {
  R,
  iso,
  isoBox,
  shade,
  softShadow,
  type Light,
  type Season,
} from "./bistro-art";
import { DOOR } from "./bistro-model";
import { poly } from "./bistro-geom";
import { spot, type Drawable } from "./bistro-depth";
import { lightKey, picture } from "./bistro-pics";

type Ctx = CanvasRenderingContext2D;
type Pt = { x: number; y: number };

/* ───────────── the map (grid units) ───────────── */

/** The main road on the door's side: x from ROAD0 (far curb) to ROAD1 (near curb), along y. */
export const ROAD0 = -7.6,
  ROAD1 = -3.4;
/** A lane's middle, from its curb. */
export const LANE = 1.05;
/** The building's left face: the near sidewalk runs from ROAD1 to here. */
export const WALK = -0.5;
/** The shopfronts across the road (the far sidewalk runs from here to ROAD0) and their backs. */
export const FRONTS = -9.6,
  BACKS = -13.2;
/** The sidewalk around the room's other sides (units). */
export const APRON = 1.9;
/** The back street behind the room (along x), and the house fronts past its far sidewalk. */
export const BACK = { y0: -5.4, y1: -2.4 } as const;
export const HOUSES = -7.2;
/** How far the canal's water lies below the street (world px). */
export const WATER = 18;
export const FAR = 4000;
/** World px along a wall per grid unit. */
export const TILE = Math.hypot(48, 24);
export const BUS_LEN = 5.2;

/** The canal across the front: along x, water from grid y y0 to y1. */
export const canal = () => ({ y0: R.rows + 6.2, y1: R.rows + 8.6 });
/** The road bridge over it spans x from here to the near parapet. */
export const BRIDGE = { x0: FRONTS - 0.3, x1: -1.0 } as const;
/** The footbridge's middle (grid x). */
export const footX = () => Math.round(R.cols * 0.5) + 0.5;
/** The square's fountain (grid) and its paved circle's radius (units). */
export const plaza = () => ({ x: R.cols + 4.8, y: 3.4, r: 2.1 });
/** Where the bus stops (grid y of its middle, near lane). */
export const stopY = () => R.rows + 2.8;
/** The bus shelter on the near sidewalk, open to the road. */
export const shelter = () => {
  const y = stopY();
  return { x0: -2.35, x1: -1.0, y0: y - 1.1, y1: y + 1.1 };
};
/** The zebra crossing over the main road, in front of the door. */
export const zebraY = () => DOOR.y;
export const ZEBRA_HALF = 0.75;
/** The lane a vehicle drives in: going +y the far lane, -y the near one. */
export const laneOf = (v: number) => (v > 0 ? ROAD0 + LANE : ROAD1 - LANE);
/** Where vehicles come in and leave along the road (off screen). */
export const roadEnds = () => ({ y0: -36, y1: R.rows + 36 });
/** In front of the room's base: drawn after the room. */
export const inFront = (x: number, y: number) =>
  y > R.rows - 0.5 || x > R.cols - 0.5;

/* walking lines */
const NEAR = -2.75,
  FAR_WALK = -8.7;
const frontLine = () => R.rows + 0.55;
const rightLine = () => R.cols + 0.55;
const BACK_LINE = -1.45,
  HOUSE_LINE = -6.3;
const promLine = () => R.rows + 4.6;
const riverLine = () => canal().y1 + 1.2;
const EAST = () => R.cols + 26;
const TOP = -16;

export const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};
export const lerpRgb = (a: number[], b: number[], f: number) =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(",")})`;
/** A ground quad over grid span [x0, x1] × [y0, y1]. */
export function quad(ctx: Ctx, x0: number, y0: number, x1: number, y1: number) {
  poly(ctx, [iso(x0, y0), iso(x1, y0), iso(x1, y1), iso(x0, y1)]);
}
export const up = (p: Pt, z: number) => ({ x: p.x, y: p.y - z });
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Darken a colour for the night. */
export const dimmer = (n: number) => (c: string) => shade(c, -0.5 * n);

/**
 * The season of a day ("2026-11-17", the server's Pacific day): March to May
 * spring, June to August summer, September to November autumn, else winter.
 */
export function seasonOf(day: string): Season {
  const m = Number(day.slice(5, 7));
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

/** The world rectangle the canvas shows (scale and translate only). */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export function viewRect(ctx: Ctx): Rect {
  const m = ctx.getTransform();
  const w = ctx.canvas.width,
    h = ctx.canvas.height;
  return {
    x0: -m.e / m.a,
    y0: -m.f / m.d,
    x1: (w - m.e) / m.a,
    y1: (h - m.f) / m.d,
  };
}
export const meets = (
  r: Rect,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) => x1 >= r.x0 && x0 <= r.x1 && y1 >= r.y0 && y0 <= r.y1;

/**
 * Draw in a wall's plane. Local x runs along the wall in world px, as seen
 * from the street (left to right), local y is screen-down (so height z is
 * at y = -z). `along: "y"`: the face at grid x = `at`, facing +x, from grid
 * y = `from` toward -y. `along: "x"`: the face at grid y = `at`, facing +y,
 * from grid x = `from` toward +x.
 */
export function onWall(
  ctx: Ctx,
  along: "x" | "y",
  at: number,
  from: number,
  fn: () => void,
) {
  const o = along === "y" ? iso(at, from) : iso(from, at);
  const k = 1 / Math.sqrt(5);
  ctx.save();
  ctx.transform(2 * k, along === "y" ? -k : k, 0, 1, o.x, o.y);
  fn();
  ctx.restore();
}
/** A light: [x, y, radius, rgb, strength] (strength scales with the night). */
export type Glow = [number, number, number, string, number];

/** Lift of the footbridge's arch at a spot (0 off the bridge). */
export function footLift(gx: number, gy: number): number {
  const c = canal();
  const a = c.y0 - 0.6,
    b = c.y1 + 0.6;
  if (Math.abs(gx - footX()) > 0.7 || gy <= a || gy >= b) return 0;
  return 16 * Math.sin((Math.PI * (gy - a)) / (b - a));
}

/** Benches people rest on: grid spot, along which axis, and which way a sitter faces. */
export function benches(): {
  x: number;
  y: number;
  along: "x" | "y";
  face: Facing;
}[] {
  const P = plaza();
  return [
    { x: P.x - 1.6, y: P.y - 0.2, along: "y", face: "right" },
    { x: P.x - 0.2, y: P.y - 1.6, along: "x", face: "left" },
    { x: 3.2, y: R.rows + 5.45, along: "x", face: "left" },
    { x: R.cols - 2.2, y: R.rows + 5.45, along: "x", face: "left" },
  ];
}

/* ───────────── what moves: people, the bus, birds ───────────── */

/** Paints a creature of the game standing at world (x, y), raised by `lift`. */
export type PaintCreature = (
  char: string,
  face: Facing,
  x: number,
  y: number,
  lift: number,
  alpha: number,
) => void;

export type FolkKind = "walk" | "dog" | "bike" | "sit" | "wait";
export interface Folk {
  char: string;
  kind: FolkKind;
  pts: Pt[];
  i: number;
  x: number;
  y: number;
  /** Units a second. */
  speed: number;
  walk: number;
  face: Facing;
  /** Fades in when it appears and out when it goes (sitters, waiters). */
  fade: number;
  /** Seconds left to stay (sitters), or until the bus comes (waiters). */
  stay: number;
  leaving: boolean;
  dog: string;
  seat: number;
  /** Waiting at the curb for the crossing. */
  held?: boolean;
}
export interface Bus {
  /** Grid y of its middle along the near lane (it drives toward -y). */
  y: number;
  speed: number;
  state: "drive" | "stop" | "away";
  /** Seconds left at the stop, or until the next bus. */
  t: number;
  /** Tests: keep it at the stop. */
  hold?: boolean;
}
export interface Pigeon {
  x: number;
  y: number;
  /** Where it's walking or flying to, from where. */
  tx: number;
  ty: number;
  fx: number;
  fy: number;
  state: "peck" | "walk" | "fly";
  t: number;
  dur: number;
  sx: number;
}
export interface Duck {
  x: number;
  y: number;
  dir: number;
  ph: number;
}
export interface Street {
  low: boolean;
  pool: string[];
  folk: Folk[];
  bus: Bus;
  pigeons: Pigeon[];
  ducks: Duck[];
  /** Someone is on the zebra: cars stop for them. */
  crossing: boolean;
  /** Seconds until the next walker may set off. */
  next: number;
  rnd: () => number;
}
/** How many of each on High and on Low graphics. */
export const CROWD = {
  high: { walkers: 9, bikes: 2, sitters: 3, pigeons: 7, ducks: 3 },
  low: { walkers: 4, bikes: 1, sitters: 1, pigeons: 3, ducks: 1 },
} as const;

/** The paths people walk (grid points), with how often each is chosen. */
export function routes(): { w: number; pts: [number, number][] }[] {
  const P = plaza();
  const fy = frontLine(),
    rx = rightLine(),
    Z = zebraY(),
    end = R.rows + 40;
  return [
    // Around the block: down the street, along the front, up the side, away along the back.
    {
      w: 3,
      pts: [
        [NEAR, TOP],
        [NEAR, fy],
        [rx, fy],
        [rx, BACK_LINE],
        [EAST(), BACK_LINE],
      ],
    },
    // Down the near sidewalk, past the bus stop, over the bridge.
    {
      w: 2,
      pts: [
        [NEAR, TOP],
        [NEAR, end],
      ],
    },
    // Past the shops across the road.
    {
      w: 2.5,
      pts: [
        [FAR_WALK, TOP],
        [FAR_WALK, end],
      ],
    },
    // Across at the zebra, then around the front and up the side.
    {
      w: 1.6,
      pts: [
        [FAR_WALK, TOP],
        [FAR_WALK, Z],
        [NEAR, Z],
        [NEAR, fy],
        [rx, fy],
        [rx, BACK_LINE],
        [EAST(), BACK_LINE],
      ],
    },
    // Along the houses behind, then down the near sidewalk.
    {
      w: 1.5,
      pts: [
        [EAST(), HOUSE_LINE],
        [NEAR, HOUSE_LINE],
        [NEAR, end],
      ],
    },
    // Down the side, along the promenade, over the footbridge and along the far bank.
    {
      w: 1.5,
      pts: [
        [rx, BACK_LINE],
        [rx, promLine()],
        [footX(), promLine()],
        [footX(), riverLine()],
        [EAST(), riverLine()],
      ],
    },
    // Through the square, in front of the fountain, to the front.
    {
      w: 1.4,
      pts: [
        [EAST(), P.y + 2.7],
        [rx, P.y + 2.7],
        [rx, fy],
        [NEAR, fy],
        [NEAR, end],
      ],
    },
    // Along the far bank of the canal.
    {
      w: 1,
      pts: [
        [NEAR, TOP],
        [NEAR, riverLine()],
        [EAST(), riverLine()],
      ],
    },
  ];
}
/** Bikes ride the quiet back street and the path along the far bank. */
export const bikeRoutes = (): [number, number][][] => [
  [
    [NEAR + 0.6, BACK.y1 - 1.25],
    [EAST(), BACK.y1 - 1.25],
  ],
  [
    [EAST(), BACK.y1 - 0.6],
    [NEAR + 0.6, BACK.y1 - 0.6],
  ],
  [
    [NEAR, riverLine() + 0.5],
    [EAST(), riverLine() + 0.5],
  ],
];
const DOGS = ["#c98a4a", "#f4efe6", "#3a302c", "#e0b070"];
/** Which way a creature shows walking by (dx, dy): as the bistro's guests. */
export function faceFor(dx: number, dy: number): Facing {
  if (dx < -0.01 || dy < -0.01) return "up";
  return dx > 0 ? "right" : dy > 0 ? "left" : "down";
}
function mkFolk(s: Street, kind: FolkKind, pts: Pt[], at = 0): Folk {
  const f: Folk = {
    char: s.pool[Math.floor(s.rnd() * s.pool.length)] ?? "voltkit",
    kind,
    pts,
    i: 1,
    x: pts[0].x,
    y: pts[0].y,
    speed:
      kind === "bike"
        ? 2.2 + s.rnd() * 0.6
        : kind === "dog"
          ? 0.95 + s.rnd() * 0.15
          : 0.9 + s.rnd() * 0.35,
    walk: s.rnd() * 10,
    face: "down",
    fade: kind === "sit" || kind === "wait" ? 0 : 1,
    stay: 0,
    leaving: false,
    dog: DOGS[Math.floor(s.rnd() * DOGS.length)],
    seat: -1,
  };
  // Start part way along (the street is already busy when the bistro opens),
  // but never in the middle of the road.
  if (at > 0) {
    advance(f, pathLength(pts) * at);
    if (inRoad(f.x)) advance(f, 6);
  }
  return f;
}
const inRoad = (x: number) => x > ROAD0 + 0.05 && x < ROAD1 - 0.05;
const pathLength = (pts: Pt[]) => {
  let d = 0;
  for (let i = 1; i < pts.length; i++)
    d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
};
/** Walk `left` units along the path; false once at its end. */
function advance(f: Folk, left: number): boolean {
  while (left > 0 && f.i < f.pts.length) {
    const p = f.pts[f.i];
    const dx = p.x - f.x,
      dy = p.y - f.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-4) {
      f.i++;
      continue;
    }
    f.face = faceFor(dx, dy);
    if (d <= left) {
      f.x = p.x;
      f.y = p.y;
      f.i++;
      left -= d;
    } else {
      f.x += (dx / d) * left;
      f.y += (dy / d) * left;
      left = 0;
    }
  }
  return f.i < f.pts.length;
}
/** The next stretch crosses the road (from one curb to the other). */
const crossesNext = (f: Folk) => {
  const p = f.pts[f.i];
  return (
    !!p &&
    !inRoad(f.x) &&
    ((f.x <= ROAD0 && p.x >= ROAD1) || (f.x >= ROAD1 && p.x <= ROAD0))
  );
};
function pickRoute(s: Street): Pt[] {
  const rs = routes();
  let r = s.rnd() * rs.reduce((a, b) => a + b.w, 0);
  let pick = rs[0];
  for (const it of rs) {
    r -= it.w;
    if (r <= 0) {
      pick = it;
      break;
    }
  }
  const pts = pick.pts.map(([x, y]) => ({ x, y }));
  return s.rnd() < 0.5 ? pts.reverse() : pts;
}
function spawnWalker(s: Street, at = 0) {
  s.folk.push(mkFolk(s, s.rnd() < 0.25 ? "dog" : "walk", pickRoute(s), at));
}
function spawnBike(s: Street, at = 0) {
  const rs = bikeRoutes();
  const r = rs[Math.floor(s.rnd() * rs.length)].map(([x, y]) => ({ x, y }));
  s.folk.push(mkFolk(s, "bike", s.rnd() < 0.5 ? r : r.reverse(), at));
}
function spawnSitter(s: Street) {
  const taken = new Set(
    s.folk.filter((f) => f.kind === "sit").map((f) => f.seat),
  );
  const free = benches()
    .map((_, i) => i)
    .filter((i) => !taken.has(i));
  if (!free.length) return;
  const seat = free[Math.floor(s.rnd() * free.length)];
  const b = benches()[seat];
  const f = mkFolk(s, "sit", [{ x: b.x, y: b.y }]);
  f.seat = seat;
  f.face = b.face;
  f.stay = 25 + s.rnd() * 35;
  s.folk.push(f);
}
/** Where someone waits for the bus: under the shelter's roof. */
export const waitSpot = () => ({ x: -1.75, y: stopY() + 0.35 });
function spawnWaiter(s: Street) {
  const f = mkFolk(s, "wait", [waitSpot()]);
  f.face = "left";
  f.stay = 1e9;
  s.folk.push(f);
}
const pigeonOk = (u: number, v: number) => {
  const P = plaza();
  const d = Math.hypot(u, v);
  // In front of the basin, on the paving.
  return u + v > 1.1 && d > 1.45 && d < P.r - 0.1;
};
const pigeonSpot = (s: Street): Pt => {
  const P = plaza();
  for (let k = 0; k < 200; k++) {
    const u = -1.4 + s.rnd() * 3.4,
      v = -1.4 + s.rnd() * 3.4;
    if (pigeonOk(u, v)) return { x: P.x + u, y: P.y + v };
  }
  return { x: P.x + 1.2, y: P.y + 1.2 };
};
function mkPigeon(s: Street): Pigeon {
  const p = pigeonSpot(s);
  return {
    x: p.x,
    y: p.y,
    tx: p.x,
    ty: p.y,
    fx: p.x,
    fy: p.y,
    state: "peck",
    t: s.rnd() * 2,
    dur: 1,
    sx: s.rnd() < 0.5 ? -1 : 1,
  };
}
/** The span of the canal ducks keep to (clear of both bridges). */
export const duckSpan = () => ({ x0: footX() + 1.6, x1: R.cols + 18 });
/** The street as the bistro opens: people already about, a bus at the stop. */
export function makeStreet(
  pool: string[],
  low: boolean,
  rnd: () => number = Math.random,
): Street {
  const n = low ? CROWD.low : CROWD.high;
  const s: Street = {
    low,
    pool: pool.length ? pool : ["voltkit"],
    folk: [],
    bus: { y: stopY(), speed: 0, state: "stop", t: 6 },
    pigeons: [],
    ducks: [],
    crossing: false,
    next: 2,
    rnd,
  };
  for (let i = 0; i < n.walkers; i++) spawnWalker(s, 0.1 + rnd() * 0.8);
  for (let i = 0; i < n.bikes; i++) spawnBike(s, rnd());
  for (let i = 0; i < n.sitters; i++) spawnSitter(s);
  for (const f of s.folk) if (f.kind === "sit") f.fade = 1;
  for (let i = 0; i < n.pigeons; i++) s.pigeons.push(mkPigeon(s));
  const c = canal(),
    d = duckSpan();
  for (let i = 0; i < n.ducks; i++)
    s.ducks.push({
      x: d.x0 + rnd() * (d.x1 - d.x0),
      y: c.y0 + 0.7 + rnd() * (c.y1 - c.y0 - 1.2),
      dir: rnd() < 0.5 ? -1 : 1,
      ph: rnd() * 6,
    });
  return s;
}

/**
 * Move everyone along by dt seconds. `clear(y0, y1)`: no vehicle on the
 * road between those grid y (someone may step onto the zebra).
 */
export function updateStreet(
  s: Street,
  dt: number,
  clear: (y0: number, y1: number) => boolean = () => true,
) {
  const n = s.low ? CROWD.low : CROWD.high;
  // The bus: in, stops (someone gets on, someone gets off), and away.
  const b = s.bus;
  const sy = stopY(),
    ends = roadEnds();
  if (b.hold) {
    b.y = sy;
    b.state = "stop";
    b.speed = 0;
  } else if (b.state === "away") {
    b.t -= dt;
    if (b.t <= 0) Object.assign(b, { state: "drive", y: ends.y1, speed: 3 });
  } else if (b.state === "stop") {
    b.t -= dt;
    if (b.t <= 0) b.state = "drive";
  } else {
    const before = b.y > sy + 0.01;
    if (before) {
      // Slow down for the stop.
      const want = Math.min(3, Math.sqrt(2 * 1.2 * (b.y - sy)) + 0.08);
      b.speed = Math.min(want, b.speed + 1.2 * dt);
    } else b.speed = Math.min(3, b.speed + 1 * dt);
    b.y -= b.speed * dt;
    if (before && b.y <= sy + 0.01) {
      b.y = sy;
      b.speed = 0;
      b.state = "stop";
      b.t = 6;
      // Whoever waited gets on; someone gets off and walks away.
      for (const f of s.folk) if (f.kind === "wait") f.leaving = true;
      if (s.rnd() < 0.7) {
        const door = { x: ROAD1 + 0.25, y: sy - 1.5 };
        const f = mkFolk(s, "walk", [
          door,
          { x: NEAR, y: door.y },
          ...(s.rnd() < 0.5
            ? [{ x: NEAR, y: R.rows + 40 }]
            : [
                { x: NEAR, y: frontLine() },
                { x: rightLine(), y: frontLine() },
                { x: rightLine(), y: BACK_LINE },
                { x: EAST(), y: BACK_LINE },
              ]),
        ]);
        f.fade = 0;
        s.folk.push(f);
      }
    }
    if (b.y < ends.y0) {
      b.state = "away";
      b.t = 26 + s.rnd() * 20;
    }
  }
  // People.
  const Z = zebraY();
  for (const f of s.folk) {
    if (f.kind === "sit" || f.kind === "wait") {
      f.stay -= dt;
      if (f.stay <= 0) f.leaving = true;
      f.fade = Math.max(0, Math.min(1, f.fade + (f.leaving ? -dt : dt) * 1.5));
      continue;
    }
    f.fade = Math.min(1, f.fade + dt * 2);
    // At the curb: wait until the road is clear (or others already cross).
    if (crossesNext(f) && Math.abs(f.y - Z) < 0.01) {
      if (!s.crossing && !clear(Z - 3.6, Z + 3.6)) {
        f.held = true;
        f.face = f.x < ROAD0 ? "right" : "up";
        continue;
      }
      f.held = false;
      s.crossing = true;
    }
    f.walk += dt;
    if (!advance(f, f.speed * dt)) f.leaving = true;
  }
  s.crossing = s.folk.some(
    (f) => inRoad(f.x) && Math.abs(f.y - Z) < ZEBRA_HALF + 0.1,
  );
  s.folk = s.folk.filter(
    (f) =>
      !(
        f.leaving &&
        (f.kind === "sit" || f.kind === "wait" ? f.fade <= 0 : true)
      ),
  );
  const count = (k: FolkKind[]) =>
    s.folk.filter((f) => k.includes(f.kind)).length;
  s.next -= dt;
  if (s.next <= 0 && count(["walk", "dog"]) < n.walkers) {
    spawnWalker(s);
    s.next = 1.5 + s.rnd() * 3;
  }
  if (count(["bike"]) < n.bikes && s.rnd() < dt * 0.08) spawnBike(s);
  if (count(["sit"]) < n.sitters && s.rnd() < dt * 0.05) spawnSitter(s);
  if (!count(["wait"]) && b.state !== "stop" && s.rnd() < dt * 0.1)
    spawnWaiter(s);
  // Pigeons peck, strut and flutter off when someone comes close.
  for (const p of s.pigeons) {
    p.t -= dt;
    if (p.state === "fly" || p.state === "walk") {
      const u = clamp01(1 - p.t / p.dur);
      p.x = p.fx + (p.tx - p.fx) * u;
      p.y = p.fy + (p.ty - p.fy) * u;
    }
    const near = s.folk.some(
      (f) => f.kind !== "sit" && Math.hypot(f.x - p.x, f.y - p.y) < 0.8,
    );
    if (near && p.state !== "fly") {
      fly(s, p);
      continue;
    }
    if (p.t > 0) continue;
    const r = s.rnd();
    if (r < 0.55) {
      p.state = "peck";
      p.t = 0.8 + s.rnd() * 1.6;
    } else if (r < 0.95) {
      const P = plaza();
      const tx = p.x + (s.rnd() - 0.5) * 0.8,
        ty = p.y + (s.rnd() - 0.5) * 0.8;
      if (pigeonOk(tx - P.x, ty - P.y)) {
        Object.assign(p, { state: "walk", fx: p.x, fy: p.y, tx, ty });
        p.dur = p.t = Math.hypot(tx - p.x, ty - p.y) / 0.3;
        p.sx = iso(tx, ty).x > iso(p.x, p.y).x ? 1 : -1;
      } else p.t = 0.5;
    } else fly(s, p);
  }
  const span = duckSpan();
  for (const d of s.ducks) {
    d.ph += dt;
    d.x += d.dir * 0.18 * dt;
    if (d.x > span.x1 || d.x < span.x0) {
      d.dir *= -1;
      d.x = Math.max(span.x0, Math.min(span.x1, d.x));
    }
  }
}
function fly(s: Street, p: Pigeon) {
  const to = pigeonSpot(s);
  Object.assign(p, { state: "fly", fx: p.x, fy: p.y, tx: to.x, ty: to.y });
  p.dur = p.t = 1.1 + s.rnd() * 0.5;
  p.sx = iso(to.x, to.y).x > iso(p.x, p.y).x ? 1 : -1;
}

/* ───────────── drawing what moves ───────────── */

function drawDog(
  ctx: Ctx,
  x: number,
  y: number,
  sx: number,
  t: number,
  col: string,
  n: number,
) {
  const c = shade(col, -0.45 * n),
    dark = shade(col, -0.35 - 0.3 * n);
  softShadow(ctx, x, y + 1, 13, 5, 0.25);
  const step = Math.sin(t * 14);
  ctx.fillStyle = dark;
  for (const [lx, ph] of [
    [-6, 1],
    [5, -1],
    [-3, -1],
    [7, 1],
  ])
    ctx.fillRect(x + lx * sx - 1.2, y - 8, 2.6, 8 + step * ph * 1.4);
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(x, y - 11, 10, 5.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head, ear, nose, a wagging tail, a collar.
  ctx.beginPath();
  ctx.arc(x + 10 * sx, y - 17, 5.4, 0, Math.PI * 2);
  ctx.ellipse(x + 14 * sx, y - 15.5, 3.4, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(x + 8 * sx, y - 18, 2.2, 4.2, 0.35 * sx, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1c1d22";
  ctx.beginPath();
  ctx.arc(x + 17 * sx, y - 16, 1.4, 0, Math.PI * 2);
  ctx.arc(x + 11.5 * sx, y - 18.5, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d94a3a";
  ctx.fillRect(x + 6.5 * sx - 1.5, y - 15, 3, 4);
  ctx.strokeStyle = c;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 9 * sx, y - 12);
  ctx.lineTo(x - 14 * sx, y - 18 + Math.sin(t * 18) * 2.5);
  ctx.stroke();
  ctx.lineCap = "butt";
}
/** A bicycle at (x, y) heading along screen direction (ux, uy). */
function drawBike(
  ctx: Ctx,
  x: number,
  y: number,
  ux: number,
  uy: number,
  t: number,
  n: number,
) {
  // Wheels 0.9 units apart along the way it rides.
  const ax = ux * 22,
    ay = uy * 22;
  const metal = shade("#d94a3a", -0.45 * n);
  softShadow(ctx, x, y + 2, 26, 8, 0.25);
  const spin = t * 12;
  for (const k of [-1, 1]) {
    const wx = x + ax * k,
      wy = y + ay * k - 9;
    ctx.strokeStyle = "#1c1d22";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(wx, wy, 6.5, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(200,205,215,.8)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(wx + Math.cos(spin) * 6, wy + Math.sin(spin) * 8);
    ctx.lineTo(wx - Math.cos(spin) * 6, wy - Math.sin(spin) * 8);
    ctx.moveTo(wx - Math.sin(spin) * 6, wy + Math.cos(spin) * 8);
    ctx.lineTo(wx + Math.sin(spin) * 6, wy - Math.cos(spin) * 8);
    ctx.stroke();
  }
  ctx.strokeStyle = metal;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - ax, y - ay - 9);
  ctx.lineTo(x, y - 20);
  ctx.lineTo(x + ax, y + ay - 9);
  ctx.moveTo(x, y - 20);
  ctx.lineTo(x + ax * 0.75, y + ay * 0.75 - 30);
  ctx.moveTo(x - ax * 0.25, y - ay * 0.25 - 24);
  ctx.lineTo(x - ax * 0.05, y - ay * 0.05 - 15);
  ctx.stroke();
  ctx.lineCap = "butt";
  // A basket on the handlebars.
  ctx.fillStyle = shade("#c99a5a", -0.45 * n);
  ctx.fillRect(x + ax * 0.85 - 4, y + ay * 0.85 - 30, 8, 6);
}
function drawPigeon(ctx: Ctx, p: Pigeon, l: Light) {
  const n = l.night;
  const c = iso(p.x, p.y);
  const flying = p.state === "fly";
  const hop = flying ? Math.sin(clamp01(1 - p.t / p.dur) * Math.PI) * 34 : 0;
  ctx.fillStyle = "rgba(40,30,30,.18)";
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 1, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  const x = c.x,
    y = c.y - hop;
  const peck =
    p.state === "peck" ? Math.max(0, Math.sin(l.t * 9 + p.fx * 5)) : 0;
  ctx.fillStyle = shade("#8d93a3", -0.45 * n);
  ctx.beginPath();
  ctx.ellipse(x, y - 5, 5.5, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (flying) {
    const flap = Math.sin(l.t * 30) * 5;
    ctx.fillStyle = shade("#6c7282", -0.45 * n);
    ctx.beginPath();
    ctx.moveTo(x - 2, y - 6);
    ctx.lineTo(x - 9, y - 9 - flap);
    ctx.lineTo(x + 1, y - 5);
    ctx.moveTo(x + 2, y - 6);
    ctx.lineTo(x + 9, y - 9 - flap);
    ctx.lineTo(x - 1, y - 5);
    ctx.fill();
  }
  // Head (down while pecking), its green neck, the beak.
  const hx = x + p.sx * 4.5,
    hy = y - 9 + peck * 4;
  ctx.fillStyle = shade("#5f8a7a", -0.45 * n);
  ctx.beginPath();
  ctx.arc(hx - p.sx * 0.8, hy + 2, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade("#7a8090", -0.45 * n);
  ctx.beginPath();
  ctx.arc(hx, hy, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e0a040";
  ctx.fillRect(hx + p.sx * 2 - (p.sx < 0 ? 2 : 0), hy - 0.5, 2, 1.2);
}
function drawDuck(ctx: Ctx, d: Duck, l: Light) {
  const n = l.night;
  const c = iso(d.x, d.y);
  const x = c.x,
    y = c.y + WATER + Math.sin(d.ph * 2) * 0.8;
  // Screen direction of swimming along +x: right and down.
  const sx = d.dir > 0 ? 1 : -1;
  // The wake: a V spreading behind.
  ctx.strokeStyle = `rgba(255,255,255,${0.45 - n * 0.25})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const k of [-1, 1]) {
    ctx.moveTo(x - sx * 7, y + 0.5 * -sx * 3.5);
    ctx.lineTo(x - sx * 22, y - sx * 7 + k * 5);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(20,40,60,.18)";
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade("#9a7a5a", -0.45 * n);
  ctx.beginPath();
  ctx.ellipse(x, y - 3, 8.5, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade("#6e5238", -0.45 * n);
  ctx.beginPath();
  ctx.ellipse(x - sx * 1.5, y - 4.5, 5, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade("#2f7a4a", -0.45 * n);
  ctx.beginPath();
  ctx.arc(x + sx * 6, y - 9, 3.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + sx * 5 - 2, y - 6.6, 4, 1.2);
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(x + sx * 9 - (sx < 0 ? 3.5 : 0), y - 9, 3.5, 1.8);
}

/** One person (and their dog or bike) as a drawable. */
function folkDrawable(
  ctx: Ctx,
  f: Folk,
  l: Light,
  paint: PaintCreature,
): Drawable | null {
  const fade = f.fade;
  if (fade <= 0.01) return null;
  const n = l.night;
  const lift = footLift(f.x, f.y);
  const draw = () => {
    const c = iso(f.x, f.y);
    const moving = f.kind !== "sit" && f.kind !== "wait" && !f.held;
    const bob =
      moving && f.kind !== "bike" ? Math.abs(Math.sin(f.walk * 9)) * 4 : 0;
    ctx.save();
    ctx.globalAlpha = fade;
    if (f.kind === "bike") {
      const p = f.pts[Math.min(f.i, f.pts.length - 1)];
      const a = iso(f.x, f.y),
        b = iso(p.x, p.y);
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      drawBike(
        ctx,
        c.x,
        c.y - lift,
        (b.x - a.x) / d,
        (b.y - a.y) / d,
        f.walk,
        n,
      );
      paint(f.char, f.face, c.x, c.y, lift + 16, fade);
    } else {
      if (f.kind !== "sit") softShadow(ctx, c.x, c.y + 2 - lift, 18, 7, 0.26);
      const sit = f.kind === "sit" ? 14 : 0;
      if (f.kind === "dog") {
        // The dog trots a little ahead on its lead.
        const p = f.pts[Math.min(f.i, f.pts.length - 1)];
        const dx = p.x - f.x,
          dy = p.y - f.y;
        const d = Math.hypot(dx, dy) || 1;
        const gx = f.x + (dx / d) * 0.6,
          gy = f.y + (dy / d) * 0.6;
        const q = iso(gx, gy);
        const sx = q.x >= c.x ? 1 : -1;
        const behind = q.y < c.y;
        const dogAt = () =>
          drawDog(ctx, q.x, q.y - footLift(gx, gy), sx, f.walk, f.dog, n);
        if (behind) dogAt();
        paint(f.char, f.face, c.x, c.y, lift + bob, fade);
        ctx.strokeStyle = `rgba(60,40,30,${0.8 * fade})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(c.x + sx * 8, c.y - lift - 28);
        ctx.quadraticCurveTo(
          (c.x + q.x) / 2,
          (c.y + q.y) / 2 - lift - 6,
          q.x + sx * 6.5,
          q.y - footLift(gx, gy) - 14,
        );
        ctx.stroke();
        if (!behind) dogAt();
      } else paint(f.char, f.face, c.x, c.y, lift + bob + sit, fade);
    }
    ctx.restore();
  };
  const r = f.kind === "bike" ? 0.45 : f.kind === "dog" ? 0.4 : 0.22;
  return spot(f.x, f.y, r, 96, draw, { z: lift, sw: 34 });
}
/** Everything moving on the street (but the cars), as drawables. */
export function townDrawables(
  ctx: Ctx,
  s: Street,
  l: Light,
  paint: PaintCreature,
): Drawable[] {
  const out: Drawable[] = [];
  for (const f of s.folk) {
    const it = folkDrawable(ctx, f, l, paint);
    if (it) out.push(it);
  }
  if (s.bus.state !== "away") out.push(busDrawable(ctx, s.bus, l));
  if (l.night < 0.6)
    for (const p of s.pigeons)
      out.push(spot(p.x, p.y, 0.12, 50, () => drawPigeon(ctx, p, l)));
  if (l.season !== "winter")
    for (const d of s.ducks)
      out.push(
        spot(d.x, d.y, 0.25, 10, () => drawDuck(ctx, d, l), { z: -WATER }),
      );
  return out;
}

/* ───────────── the bus ───────────── */

export function busBox(b: Bus) {
  const lane = laneOf(-1),
    w = 0.82;
  return {
    x0: lane - w,
    x1: lane + w,
    y0: b.y - BUS_LEN / 2,
    y1: b.y + BUS_LEN / 2,
  };
}
function busDrawable(ctx: Ctx, b: Bus, l: Light): Drawable {
  const bx = busBox(b);
  const o = iso(0, b.y),
    c = iso(laneOf(-1), 0);
  return {
    ...bx,
    h: 122,
    // From a cached picture: the bus only moves (its doors open at the stop).
    draw: () =>
      picture(
        ctx,
        `bus:${b.state === "stop" ? 1 : 0}`,
        lightKey(l),
        { x0: c.x - 210, x1: c.x + 210, y0: c.y - 250, y1: c.y + 110 },
        (g) => drawBus(g, { ...b, y: 0 }, l),
        o.x,
        o.y,
      ),
  };
}
/** Draw wheels in a vehicle's side face (local px), as tyres with hubs. */
export function wheel(ctx: Ctx, x: number, r: number, n: number) {
  ctx.fillStyle = "#1c1d22";
  ctx.beginPath();
  ctx.arc(x, -r, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade("#c9ced8", -0.45 * n);
  ctx.beginPath();
  ctx.arc(x, -r, r * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a3e48";
  ctx.beginPath();
  ctx.arc(x, -r, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
}
/** The bus: long and tall in the near lane, windows lit at night, doors open at the stop. */
export function drawBus(ctx: Ctx, b: Bus, l: Light) {
  if (b.state === "away") return;
  const n = l.night;
  const { x0, x1, y0, y1 } = busBox(b);
  const H = 116,
    lift = 8;
  const c = iso((x0 + x1) / 2, b.y);
  softShadow(ctx, c.x - 6, c.y + 6, 190, 70, 0.32);
  const body = shade("#2a9d8f", -0.45 * n),
    roof = shade("#eef3f2", -0.45 * n),
    cream = shade("#f4e9cf", -0.45 * n);
  isoBox(ctx, x0, y0, x1, y1, lift, H, {
    top: roof,
    left: shade(body, -0.12),
    right: body,
  });
  // Roof equipment.
  isoBox(ctx, x0 + 0.3, b.y - 0.9, x1 - 0.3, b.y + 0.5, lift + H, 9, {
    top: shade("#dfe6e6", -0.45 * n),
    left: shade("#b9c3c4", -0.45 * n),
    right: shade("#c9d2d3", -0.45 * n),
  });
  const lit = n > 0.35;
  const glass = (k = 0) =>
    lit
      ? `rgba(255,${226 - k * 10},160,1)`
      : shade(k ? "#8fbfd8" : "#a9d4ea", -0.4 * n);
  const L = BUS_LEN * TILE;
  // The curb side: a cream belt, a row of windows, two doors, the wheels.
  onWall(ctx, "y", x1, y1, () => {
    ctx.translate(0, -lift);
    ctx.fillStyle = cream;
    ctx.fillRect(0, -50, L, 7);
    ctx.fillStyle = shade("#1f6f66", -0.45 * n);
    ctx.fillRect(0, -16, L, 10);
    // Windows: a dark band with panes.
    ctx.fillStyle = shade("#24333a", -0.3 * n);
    ctx.fillRect(10, -104, L - 70, 44);
    for (let x = 14; x < L - 64; x += 34) {
      ctx.fillStyle = glass(1);
      ctx.fillRect(x, -100, 29, 36);
      ctx.fillStyle = "rgba(255,255,255,.28)";
      ctx.fillRect(x + 3, -98, 6, 32);
    }
    // Doors: open (dark) at the stop.
    const door = (dx: number) => {
      ctx.fillStyle = shade("#1d5e57", -0.45 * n);
      ctx.fillRect(dx - 2, -108, 32, 104);
      ctx.fillStyle = b.state === "stop" ? "#1a2028" : glass();
      ctx.fillRect(dx, -104, 13, 98);
      ctx.fillRect(dx + 15, -104, 13, 98);
      if (b.state === "stop" && lit) {
        ctx.fillStyle = "rgba(255,220,150,.5)";
        ctx.fillRect(dx, -104, 28, 98);
      }
    };
    door(L - 58);
    door(L * 0.42);
    // The windscreen wraps round the front corner.
    ctx.fillStyle = glass();
    ctx.fillRect(L - 24, -106, 20, 50);
    // The route board over the front.
    ctx.fillStyle = "#14181f";
    ctx.fillRect(L - 92, -116, 70, 10);
    ctx.fillStyle = lit ? "#ffb347" : "#ffd65b";
    ctx.font = "800 8px 'Barlow Condensed', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("12  HARBOUR", L - 57, -108.5);
    // An advert along the side: the bistro, of course.
    ctx.fillStyle = shade("#fff6e6", -0.4 * n);
    ctx.fillRect(28, -46, 120, 26);
    ctx.fillStyle = shade("#c2322e", -0.4 * n);
    ctx.fillRect(28, -46, 8, 26);
    ctx.fillStyle = shade("#3b1f2a", -0.4 * n);
    ctx.font = "800 11px 'Barlow Condensed', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("ELEMENT BISTRO", 42, -29);
    // Wheels, in arches.
    for (const wx of [L * 0.17, L * 0.78]) {
      ctx.fillStyle = "#14181f";
      ctx.beginPath();
      ctx.arc(wx, 0, 20, Math.PI, 0);
      ctx.fill();
      ctx.save();
      ctx.translate(0, lift);
      wheel(ctx, wx, 15, n);
      ctx.restore();
    }
  });
  // The back: a window, the route number, the tail lights.
  onWall(ctx, "x", y1, x0, () => {
    const w = (x1 - x0) * TILE;
    ctx.translate(0, -lift);
    ctx.fillStyle = shade("#24333a", -0.3 * n);
    ctx.fillRect(6, -104, w - 12, 40);
    ctx.fillStyle = glass(1);
    ctx.fillRect(10, -100, w - 20, 32);
    ctx.fillStyle = cream;
    ctx.fillRect(0, -50, w, 7);
    ctx.fillStyle = "#14181f";
    ctx.fillRect(w / 2 - 14, -62, 28, 10);
    ctx.fillStyle = "#ffd65b";
    ctx.font = "800 9px 'Barlow Condensed', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("12", w / 2, -54);
    ctx.fillStyle = n > 0.3 ? "#ff4a3a" : "#c2322e";
    ctx.fillRect(5, -34, 9, 12);
    ctx.fillRect(w - 14, -34, 9, 12);
    ctx.fillStyle = "#2a2d34";
    ctx.fillRect(4, -14, w - 8, 9);
  });
}
export function busGlows(b: Bus): Glow[] {
  if (b.state === "away") return [];
  const front = iso(laneOf(-1), b.y - BUS_LEN / 2 - 1.2);
  const mid = iso(laneOf(-1) + 0.8, b.y);
  return [
    [front.x, front.y - 8, 80, "255,240,200", 0.35],
    [mid.x, mid.y - 50, 110, "255,220,150", 0.25],
  ];
}

/* ───────────── the bus shelter ───────────── */

/** The shelter as a drawable: a glass back toward the bistro, a roof, a bench, the stop's sign. */
export function shelterDrawable(ctx: Ctx, l: Light): Drawable {
  const s = shelter();
  return { ...s, h: 100, draw: () => drawShelter(ctx, l) };
}
export function drawShelter(ctx: Ctx, l: Light) {
  const n = l.night,
    snow = l.season === "winter";
  const { x0, x1, y0, y1 } = shelter();
  const H = 96;
  const metal = shade("#3a4458", -0.35 * n);
  const c = iso((x0 + x1) / 2, (y0 + y1) / 2);
  softShadow(ctx, c.x, c.y + 3, 70, 26, 0.16);
  // The bench along the back.
  isoBox(ctx, x1 - 0.5, y0 + 0.2, x1 - 0.12, y1 - 0.2, 22, 5, {
    top: shade("#b0703f", -0.5 * n),
    left: shade("#8a5530", -0.5 * n),
    right: shade("#7a4a28", -0.5 * n),
  });
  // Posts at the four corners.
  ctx.fillStyle = metal;
  for (const [px, py] of [
    [x0 + 0.06, y0 + 0.06],
    [x0 + 0.06, y1 - 0.06],
    [x1 - 0.06, y0 + 0.06],
    [x1 - 0.06, y1 - 0.06],
  ]) {
    const p = iso(px, py);
    ctx.fillRect(p.x - 2, p.y - H, 4, H);
  }
  const glassCol = n > 0.4 ? "rgba(120,140,180,.32)" : "rgba(200,232,246,.42)";
  // The side panel at the +y end (toward the camera).
  onWall(ctx, "x", y1 - 0.04, x0 + 0.06, () => {
    const w = (x1 - x0 - 0.12) * TILE;
    ctx.fillStyle = glassCol;
    ctx.fillRect(0, -H + 10, w, H - 22);
    ctx.strokeStyle = metal;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, -H + 10, w, H - 22);
    // A route map.
    ctx.fillStyle = n > 0.35 ? "#fff6dc" : "#f4f6fa";
    ctx.fillRect(w / 2 - 12, -H + 22, 24, 34);
    ctx.strokeStyle = "#2a9d8f";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 8, -H + 50);
    ctx.lineTo(w / 2 - 2, -H + 36);
    ctx.lineTo(w / 2 + 7, -H + 30);
    ctx.stroke();
  });
  // The back panel (seen from behind): glass with the bistro's poster, lit at night.
  onWall(ctx, "y", x1 - 0.04, y1 - 0.06, () => {
    const w = (y1 - y0 - 0.12) * TILE;
    ctx.fillStyle = glassCol;
    ctx.fillRect(0, -H + 10, w, H - 22);
    ctx.strokeStyle = metal;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, -H + 10, w, H - 22);
    const px = w / 2 - 20;
    ctx.fillStyle = n > 0.35 ? "#fff1cf" : "#f6e3c0";
    ctx.fillRect(px, -H + 16, 40, 56);
    ctx.fillStyle = "#c2322e";
    ctx.fillRect(px, -H + 16, 40, 10);
    ctx.fillStyle = "#3b1f2a";
    ctx.font = "800 8px 'Barlow Condensed', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ELEMENT", px + 20, -H + 40);
    ctx.fillText("BISTRO", px + 20, -H + 49);
    ctx.fillStyle = "#f2c14e";
    ctx.beginPath();
    ctx.arc(px + 20, -H + 60, 7, 0, Math.PI);
    ctx.fill();
  });
  // The roof, a little wider than the shelter, sloping toward the road.
  isoBox(ctx, x0 - 0.25, y0 - 0.12, x1 + 0.1, y1 + 0.12, H, 6, {
    top: snow ? shade("#f4f7fb", -0.5 * n) : shade("#6a7488", -0.4 * n),
    left: metal,
    right: shade("#4a5468", -0.35 * n),
  });
  // The stop's sign on its own pole by the curb.
  const p = iso(ROAD1 + 0.3, y0 - 0.4);
  ctx.fillStyle = metal;
  ctx.fillRect(p.x - 2, p.y - 118, 4, 118);
  ctx.fillStyle = shade("#2a9d8f", -0.35 * n);
  ctx.beginPath();
  ctx.arc(p.x, p.y - 122, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 9px 'Barlow Condensed', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("BUS", p.x, p.y - 119);
  ctx.fillStyle = shade("#f4f6fa", -0.4 * n);
  ctx.fillRect(p.x - 9, p.y - 104, 18, 22);
  ctx.fillStyle = "#2a9d8f";
  ctx.fillRect(p.x - 7, p.y - 101, 14, 4);
}
export function shelterGlow(): Glow {
  const s = shelter();
  const p = iso(s.x1 - 0.1, (s.y0 + s.y1) / 2);
  return [p.x, p.y - 50, 60, "255,236,190", 0.32];
}

/* ───────────── the season's weather (live) ───────────── */

/** Snow falling, autumn leaves drifting, butterflies over the summer flowerbeds. */
export function drawWeather(
  ctx: Ctx,
  l: Light,
  low: boolean,
  leafTrees: [number, number][] = [],
) {
  const s = l.season ?? "summer";
  const t = l.t;
  if (s === "winter") {
    const r = viewRect(ctx);
    const W = r.x1 - r.x0,
      H = r.y1 - r.y0;
    const count = low ? 30 : 90;
    ctx.fillStyle = `rgba(255,255,255,${0.85 - l.night * 0.25})`;
    for (let i = 0; i < count; i++) {
      const sp = 22 + hash(i + 31) * 26;
      const x =
        r.x0 +
        ((((hash(i) * W + Math.sin(t * 0.7 + i) * 14 + t * 6) % W) + W) % W);
      const y = r.y0 + ((hash(i + 900) * H + t * sp) % H);
      const z = 1.2 + hash(i + 17) * 1.8;
      ctx.fillRect(x, y, z, z);
    }
  } else if (s === "autumn") {
    const per = low ? 2 : 5;
    for (const [i, [gx, gy]] of leafTrees.entries()) {
      const c = iso(gx, gy);
      for (let k = 0; k < per; k++) {
        const f = (t * 0.08 + hash(k + i * 7)) % 1;
        const x =
            c.x +
            (hash(k + 3 + i) - 0.5) * 70 +
            Math.sin(t * 1.6 + k) * 10 +
            f * 20,
          y = c.y - 110 + f * 114;
        ctx.fillStyle = `rgba(${k % 2 ? "226,130,50" : "200,80,44"},${(0.95 - l.night * 0.5) * Math.min(1, (1 - f) * 3)})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 3.4, 1.8, t * 2.4 + k, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (s === "summer" && l.night < 0.4) {
    const P = plaza();
    const n = low ? 1 : 3;
    for (let i = 0; i < n; i++) {
      const b = iso(P.x - 1.6 + i * 1.9, P.y + 3.6);
      const x = b.x + Math.sin(t * 0.9 + i * 2) * 26,
        y = b.y - 16 + Math.sin(t * 1.7 + i) * 8;
      const flap = Math.abs(Math.sin(t * 16 + i)) * 4 + 1;
      ctx.fillStyle = ["#ffd65b", "#ffffff", "#ff9ab8"][i % 3];
      ctx.beginPath();
      ctx.ellipse(x - 2, y, flap, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 2, y, flap, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
