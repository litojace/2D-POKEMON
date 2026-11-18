/*
 * Element Bistro: the cars on the road and parked in the back street.
 *
 * Sized to the creatures (a creature is about 75 px tall): a car is 2.5
 * units long, 1.3 wide and 66 px to its roof, about a creature's height, as
 * chibi cars in toy-town games are; a van is 2.9 long and 92 px tall. They
 * drive in lanes 2.1 wide, queue behind each other and the bus, and stop at
 * the zebra while someone crosses.
 */
import { iso, isoBox, shade, softShadow, type Light } from "./bistro-art";
import {
  BUS_LEN,
  TILE,
  laneOf,
  onWall,
  roadEnds,
  type Bus,
  type Glow,
} from "./bistro-town";
import type { Drawable } from "./bistro-depth";
import { wheel } from "./bistro-town";
import { lightKey, picture } from "./bistro-pics";

type Ctx = CanvasRenderingContext2D;

/** 0 hatchback, 1 van, 2 taxi, 3 mini. */
export type CarKind = 0 | 1 | 2 | 3;
export interface Car {
  /** Grid y of its middle along the road; moves at `v` units a second. */
  y: number;
  v: number;
  col: string;
  kind: number;
}
export const CAR_SIZE: Record<number, { len: number; wid: number; h: number }> =
  {
    0: { len: 2.5, wid: 1.3, h: 66 },
    1: { len: 2.9, wid: 1.4, h: 92 },
    2: { len: 2.5, wid: 1.3, h: 66 },
    3: { len: 2.2, wid: 1.24, h: 62 },
  };
export const carLen = (c: { kind: number }) =>
  (CAR_SIZE[c.kind] ?? CAR_SIZE[0]).len;
const COLOURS = [
  "#e2453a",
  "#3d8fd1",
  "#f4f1ea",
  "#4fb36b",
  "#8a5ad1",
  "#2d3340",
  "#ff9a5b",
  "#9fd4e8",
];

/** Where a vehicle stands: its middle, the axis it lies along and which way it faces (+1/-1). */
export interface Pose {
  x: number;
  y: number;
  along: "x" | "y";
  dir: number;
}
export function carBox(p: Pose, kind: number) {
  const s = CAR_SIZE[kind] ?? CAR_SIZE[0];
  const a = s.len / 2,
    b = s.wid / 2;
  return p.along === "y"
    ? { x0: p.x - b, x1: p.x + b, y0: p.y - a, y1: p.y + a }
    : { x0: p.x - a, x1: p.x + a, y0: p.y - b, y1: p.y + b };
}
/**
 * A car at a pose. The long side toward the viewer shows its doors and
 * wheels; the end toward the viewer its lights (the front if it faces +x or
 * +y, else the back).
 */
export function drawCar(
  ctx: Ctx,
  p: Pose,
  kind: number,
  col: string,
  l: Light,
  braking = false,
) {
  const n = l.night;
  const S = CAR_SIZE[kind] ?? CAR_SIZE[0];
  const bx = carBox(p, kind);
  const dim = (c: string) => shade(c, -0.45 * n);
  const body = dim(kind === 2 ? "#f2c14e" : col);
  const c = iso(p.x, p.y);
  softShadow(ctx, c.x - 4, c.y + 5, S.len * 44, S.len * 18, 0.34);
  const lift = 8;
  const along = p.along;
  const L = S.len * TILE,
    Wd = S.wid * TILE;
  // The side and end faces toward the viewer.
  const side = (fn: () => void) =>
    along === "y"
      ? onWall(ctx, "y", bx.x1, bx.y1, fn)
      : onWall(ctx, "x", bx.y1, bx.x0, fn);
  const end = (fn: () => void) =>
    along === "y"
      ? onWall(ctx, "x", bx.y1, bx.x0, fn)
      : onWall(ctx, "y", bx.x1, bx.y1, fn);
  // Along the side, local x runs from the end at the higher coordinate
  // (along "y": y1 is on the left) for along y, and from x0 for along x.
  const frontAtRight = along === "y" ? p.dir < 0 : p.dir > 0;
  const showsFront = p.dir > 0;
  const glass = n > 0.4 ? "#2a3248" : dim("#9fcbe2");
  const glassDark = n > 0.4 ? "#1e2438" : dim("#6f9ab8");
  if (kind === 1) {
    // A van: one tall box, a windscreen at the front, the bistro's supplier's name.
    isoBox(ctx, bx.x0, bx.y0, bx.x1, bx.y1, lift, S.h - lift, {
      top: dim(shade(col, 0.25)),
      left: dim(shade(col, -0.14)),
      right: body,
    });
    side(() => {
      ctx.translate(0, -lift);
      const fx = frontAtRight ? L - 44 : 6;
      ctx.fillStyle = glass;
      ctx.fillRect(fx, -S.h + 18, 38, 30);
      ctx.fillStyle = "rgba(255,255,255,.25)";
      ctx.fillRect(fx + 4, -S.h + 20, 6, 26);
      ctx.strokeStyle = dim(shade(col, -0.35));
      ctx.lineWidth = 1.2;
      ctx.strokeRect(fx - 2, -S.h + 16, 42, S.h - 26);
      ctx.fillStyle = dim("#ffffff");
      ctx.fillRect(frontAtRight ? 16 : L - 106, -S.h + 26, 90, 26);
      ctx.fillStyle = dim("#2f5d3c");
      ctx.font = "800 10px 'Barlow Condensed', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("FRESH FARM", frontAtRight ? 61 : L - 61, -S.h + 43);
      wheelsOnSide(ctx, L, n);
    });
    end(() => {
      ctx.translate(0, -lift);
      if (showsFront) {
        ctx.fillStyle = glass;
        ctx.fillRect(6, -S.h + 16, Wd - 12, 30);
        lights(ctx, Wd, true, n, braking);
      } else {
        ctx.strokeStyle = dim(shade(col, -0.35));
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(Wd / 2, -S.h + 14);
        ctx.lineTo(Wd / 2, -10);
        ctx.stroke();
        lights(ctx, Wd, false, n, braking);
      }
    });
    return;
  }
  // A car: the lower body, then the cabin (glass all round) and its roof.
  const lower = kind === 3 ? 26 : 24;
  isoBox(ctx, bx.x0, bx.y0, bx.x1, bx.y1, lift, lower, {
    top: dim(shade(kind === 2 ? "#f2c14e" : col, 0.22)),
    left: dim(shade(kind === 2 ? "#f2c14e" : col, -0.14)),
    right: body,
  });
  // The cabin sits back of the middle, a little narrower.
  const inset = 0.1;
  const c0 = kind === 3 ? 0.18 : 0.24,
    c1 = kind === 3 ? 0.84 : 0.76;
  const shift = frontAtRight === (along === "y") ? 0.04 : -0.04;
  const cab =
    along === "y"
      ? {
          x0: bx.x0 + inset,
          x1: bx.x1 - inset,
          y0: bx.y0 + (bx.y1 - bx.y0) * (c0 + shift),
          y1: bx.y0 + (bx.y1 - bx.y0) * (c1 + shift),
        }
      : {
          x0: bx.x0 + (bx.x1 - bx.x0) * (c0 - shift),
          x1: bx.x0 + (bx.x1 - bx.x0) * (c1 - shift),
          y0: bx.y0 + inset,
          y1: bx.y1 - inset,
        };
  const cabH = S.h - lift - lower;
  isoBox(ctx, cab.x0, cab.y0, cab.x1, cab.y1, lift + lower, cabH, {
    top: dim(shade(kind === 2 ? "#f2c14e" : col, 0.12)),
    left: along === "y" ? glassDark : glass,
    right: along === "y" ? glass : glassDark,
  });
  // Pillars and the door line on the side; a shine on the glass.
  const cabL =
    along === "y" ? (cab.y1 - cab.y0) * TILE : (cab.x1 - cab.x0) * TILE;
  const cabSide = (fn: () => void) =>
    along === "y"
      ? onWall(ctx, "y", cab.x1, cab.y1, fn)
      : onWall(ctx, "x", cab.y1, cab.x0, fn);
  cabSide(() => {
    ctx.translate(0, -lift - lower);
    ctx.fillStyle = body;
    ctx.fillRect(0, -cabH, 5, cabH);
    ctx.fillRect(cabL - 5, -cabH, 5, cabH);
    ctx.fillRect(cabL / 2 - 2, -cabH, 4, cabH);
    ctx.fillRect(0, -cabH, cabL, 4);
    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.fillRect(9, -cabH + 6, 5, cabH - 9);
    ctx.fillRect(cabL / 2 + 6, -cabH + 6, 4, cabH - 9);
  });
  side(() => {
    ctx.translate(0, -lift);
    // Door seams, handles, a side stripe, the mirror.
    ctx.strokeStyle = dim(shade(col, -0.32));
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L * 0.5, -lower);
    ctx.lineTo(L * 0.5, -4);
    ctx.moveTo(L * 0.3, -lower);
    ctx.lineTo(L * 0.3, -4);
    ctx.stroke();
    ctx.fillStyle = dim(shade(col, -0.35));
    ctx.fillRect(L * 0.36, -lower + 6, 7, 2);
    ctx.fillRect(L * 0.56, -lower + 6, 7, 2);
    ctx.fillStyle = "rgba(255,255,255,.25)";
    ctx.fillRect(4, -lower + 2, L - 8, 2);
    wheelsOnSide(ctx, L, n);
  });
  end(() => {
    ctx.translate(0, -lift);
    lights(ctx, Wd, showsFront, n, braking);
    if (showsFront) {
      ctx.fillStyle = dim("#2a2d34");
      ctx.fillRect(Wd / 2 - 12, -lower + 8, 24, 6);
    }
  });
  if (kind === 2) {
    // The taxi's roof sign.
    const m = iso((cab.x0 + cab.x1) / 2, (cab.y0 + cab.y1) / 2);
    const top = m.y - S.h;
    ctx.fillStyle = n > 0.3 ? "#fff3b0" : "#ffffff";
    ctx.fillRect(m.x - 11, top - 9, 22, 9);
    ctx.fillStyle = "#2d3340";
    ctx.font = "800 6px 'Barlow Condensed', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TAXI", m.x, top - 2.5);
  }
}
function wheelsOnSide(ctx: Ctx, L: number, n: number) {
  for (const wx of [L * 0.2, L * 0.8]) {
    ctx.fillStyle = "#14181f";
    ctx.beginPath();
    ctx.arc(wx, 0, 14, Math.PI, 0);
    ctx.fill();
    ctx.save();
    ctx.translate(0, 8);
    wheel(ctx, wx, 11, n);
    ctx.restore();
  }
}
/** Head or tail lights, the bumper and the plate on an end face (local px, width w). */
function lights(
  ctx: Ctx,
  w: number,
  front: boolean,
  n: number,
  braking: boolean,
) {
  ctx.fillStyle = "#2a2d34";
  ctx.fillRect(2, -9, w - 4, 7);
  ctx.fillStyle = "#f4f1e6";
  ctx.fillRect(w / 2 - 8, -15, 16, 6);
  if (front) {
    ctx.fillStyle = n > 0.3 ? "#fffbe0" : "#e8eef6";
    ctx.beginPath();
    ctx.ellipse(8, -20, 5, 3.5, 0, 0, 7);
    ctx.ellipse(w - 8, -20, 5, 3.5, 0, 0, 7);
    ctx.fill();
  } else {
    ctx.fillStyle = braking || n > 0.3 ? "#ff3a2a" : "#b8322a";
    ctx.fillRect(3, -24, 9, 7);
    ctx.fillRect(w - 12, -24, 9, 7);
  }
}

/* ───────────── traffic ───────────── */

/** A moving car's pose: in its lane, facing the way it drives. */
export const carPose = (c: Car): Pose => ({
  x: laneOf(c.v),
  y: c.y,
  along: "y",
  dir: Math.sign(c.v) || 1,
});
export function carDrawable(
  ctx: Ctx,
  c: Car,
  l: Light,
  braking: boolean,
): Drawable {
  const p = carPose(c);
  const S = CAR_SIZE[c.kind] ?? CAR_SIZE[0];
  return {
    ...carBox(p, c.kind),
    h: S.h,
    draw: () => drawCarPic(ctx, p, c.kind, c.col, l, braking),
  };
}
/** A car from its cached picture (drawn once per look, light and zoom). */
export function drawCarPic(
  ctx: Ctx,
  p: Pose,
  kind: number,
  col: string,
  l: Light,
  braking = false,
) {
  const S = CAR_SIZE[kind] ?? CAR_SIZE[0];
  const r = (S.len + S.wid) / 2;
  const o = iso(p.x, p.y);
  picture(
    ctx,
    `car:${kind}:${col}:${p.along}:${p.dir}:${braking ? 1 : 0}`,
    lightKey(l),
    { x0: -130, x1: 130, y0: -r * 24 - S.h - 16, y1: 64 },
    (g) => drawCar(g, { ...p, x: 0, y: 0 }, kind, col, l, braking),
    o.x,
    o.y,
  );
}
/**
 * Cars along the road. Each keeps its distance from the one ahead in its
 * lane, from the bus (which stops at its stop in the near lane) and from
 * the zebra while someone is on it: they queue instead of driving through.
 * `max` cars at most.
 */
export function updateCars(
  cars: Car[],
  dt: number,
  spawnRoll: number,
  o: {
    bus?: Bus | null;
    max?: number;
    /** Someone is on the zebra at this grid y: stop before it. */
    zebra?: number | null;
  } = {},
): Car[] {
  type Entry = {
    y: number;
    was: number;
    len: number;
    fixed?: boolean;
    set: (y: number) => void;
  };
  const bus = o.bus && o.bus.state !== "away" ? o.bus : null;
  for (const dir of [1, -1]) {
    const lane: Entry[] = [];
    for (const c of cars)
      if (Math.sign(c.v) === dir) {
        const was = c.y;
        c.y += c.v * dt;
        lane.push({ y: c.y, was, len: carLen(c), set: (y) => (c.y = y) });
      }
    if (bus && dir < 0)
      lane.push({
        y: bus.y,
        was: bus.y,
        len: BUS_LEN,
        set: (y) => (bus.y = y),
      });
    // Someone on the zebra: a car that hasn't reached it waits (one already on it drives on).
    if (o.zebra != null)
      lane.push({
        y: o.zebra,
        was: o.zebra,
        len: 1.5,
        fixed: true,
        set: () => {},
      });
    // The front of the lane first.
    lane.sort((a, b) => (dir > 0 ? b.y - a.y : a.y - b.y));
    for (let i = 1; i < lane.length; i++) {
      const ahead = lane[i - 1],
        me = lane[i];
      if (me.fixed) continue;
      const gap = (ahead.len + me.len) / 2 + 0.5;
      if (dir > 0 ? me.y > ahead.y - gap : me.y < ahead.y + gap) {
        const to = dir > 0 ? ahead.y - gap : ahead.y + gap;
        // Never pushed back past where it was: it just stops.
        me.y =
          dir > 0
            ? Math.max(to, Math.min(me.was, me.y))
            : Math.min(to, Math.max(me.was, me.y));
        me.set(me.y);
      }
    }
  }
  const ends = roadEnds();
  const out = cars.filter((c) => c.y > ends.y0 - 2 && c.y < ends.y1 + 2);
  if (spawnRoll < dt * 0.22 && out.length < (o.max ?? 4)) {
    const down = Math.random() < 0.5;
    const y = down ? ends.y0 : ends.y1;
    // Not on top of someone already coming in.
    const busy =
      out.some(
        (c) => Math.sign(c.v) === (down ? 1 : -1) && Math.abs(c.y - y) < 4,
      ) ||
      (!down && !!bus && Math.abs(bus.y - y) < 5);
    if (!busy) {
      const r = Math.random();
      out.push({
        y,
        v: (down ? 1 : -1) * (2.6 + Math.random() * 1.6),
        col: COLOURS[Math.floor(Math.random() * COLOURS.length)],
        kind: r < 0.2 ? 1 : r < 0.32 ? 2 : r < 0.5 ? 3 : 0,
      });
    }
  }
  return out;
}
/** Headlights at night (and the bus's). */
export function carGlows(cars: Car[], bus?: Bus | null): Glow[] {
  const out: Glow[] = cars.map((car) => {
    const p = iso(
      laneOf(car.v),
      car.y + Math.sign(car.v) * (carLen(car) / 2 + 0.9),
    );
    return [p.x, p.y - 8, 70, "255,240,200", 0.35] as Glow;
  });
  if (bus && bus.state !== "away") {
    const f = iso(laneOf(-1), bus.y - BUS_LEN / 2 - 1.2);
    out.push([f.x, f.y - 8, 80, "255,240,200", 0.35]);
  }
  return out;
}
