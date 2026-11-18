/*
 * Element Bistro: the street corner around the restaurant, put together.
 *
 * The camera never leaves the dressed part of the town (bistro-scene.ts
 * clamps it), so there is no horizon: the ground runs to every edge, as in
 * isometric city games, and blocks of buildings frame the top. The light
 * follows the device clock (day, golden hour, night) and the season the
 * server's day.
 *
 * Drawing, back to front, each frame:
 *   1. the canal's water (bistro-water.ts), live;
 *   2. the baked street: ground, roads, markings, the canal's banks (with a
 *      hole for the water), and every prop that never stands in front of
 *      anything moving, with the lights of windows and lamps at night;
 *   3. the fountain's running water;
 *   4. what moves and the props that can stand in front of it, sorted by
 *      footprint (bistro-depth.ts): those behind the room...
 *   5. ...the room (bistro-scene.ts)...
 *   6. ...then those in front of it; the weather, cloud shadows, birds.
 */
import { DOOR } from "./bistro-model";
import { R, ROOM, WALL_H, iso, shade, type Light, type Season } from "./bistro-art";
import { poly } from "./bistro-geom";
import {
  APRON,
  BACK,
  BACKS,
  BRIDGE,
  FAR,
  FRONTS,
  HOUSES,
  LANE,
  ROAD0,
  ROAD1,
  WALK,
  ZEBRA_HALF,
  canal,
  drawWeather,
  hash,
  inFront,
  lerpRgb,
  meets,
  plaza,
  quad,
  shelterGlow,
  stopY,
  townDrawables,
  viewRect,
  zebraY,
  type Bus,
  type Glow,
  type PaintCreature,
  type Rect,
  type Street,
} from "./bistro-town";
import { buildingGlows, buildingShadow } from "./bistro-city";
import {
  drawPropCached,
  lampGlows,
  outline,
  props,
  splitProps,
  tickPics,
  trees,
  type Prop,
} from "./bistro-props";
import { carDrawable, carGlows as vehicleGlows, type Car } from "./bistro-vehicles";
import { depthSort, screenBox, type Drawable } from "./bistro-depth";
import { cutWater, drawBanks, drawWater } from "./bistro-water";

export { updateCars, type Car } from "./bistro-vehicles";
type Ctx = CanvasRenderingContext2D;

/** How far the town is dressed around the room's bounds (world px): the camera stays inside. */
export const SCENE_MARGIN = { x: 820, top: 260, bottom: 360 };

/* ───────────── the ground ───────────── */

export function seasonTint(c: number[], s: Season | undefined, k = 1): number[] {
  const to =
    s === "winter" ? [234, 240, 248] : s === "autumn" ? [200, 160, 92] : s === "spring" ? [150, 214, 130] : c;
  const f = (s === "winter" ? 0.72 : s === "autumn" ? 0.38 : 0.15) * k;
  return c.map((v, i) => Math.round(v + (to[i] - v) * f));
}
/** The grid cells a world rectangle covers. */
function gridSpan(r: Rect) {
  const g = (x: number, y: number) => ({ x: (x / 48 + y / 24) / 2, y: (y / 24 - x / 48) / 2 });
  const cs = [g(r.x0, r.y0), g(r.x1, r.y0), g(r.x0, r.y1), g(r.x1, r.y1)];
  return {
    x0: Math.floor(Math.min(...cs.map((c) => c.x))) - 1,
    x1: Math.ceil(Math.max(...cs.map((c) => c.x))) + 1,
    y0: Math.floor(Math.min(...cs.map((c) => c.y))) - 1,
    y1: Math.ceil(Math.max(...cs.map((c) => c.y))) + 1,
  };
}
const E = 70;
/** Slabs: a fill, then seams every `step` units both ways, clipped to the area. */
function paving(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  fill: string,
  seam: string,
  step = 0.75,
  alt?: string,
) {
  ctx.fillStyle = fill;
  quad(ctx, x0, y0, x1, y1);
  ctx.fill();
  ctx.save();
  quad(ctx, x0, y0, x1, y1);
  ctx.clip();
  const vr = viewRect(ctx);
  const s = gridSpan(vr);
  const ax = Math.max(x0, s.x0),
    bx = Math.min(x1, s.x1),
    ay = Math.max(y0, s.y0),
    by = Math.min(y1, s.y1);
  if (alt) {
    // Every few slabs a shade different.
    ctx.fillStyle = alt;
    for (let x = Math.floor(ax / step) * step; x < bx; x += step)
      for (let y = Math.floor(ay / step) * step; y < by; y += step)
        if (hash(Math.round(x / step) * 92821 + Math.round(y / step) * 31) > 0.82) {
          quad(ctx, x, y, x + step, y + step);
          ctx.fill();
        }
  }
  ctx.strokeStyle = seam;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.floor(ax / step) * step; x <= bx; x += step) {
    const a = iso(x, ay),
      b = iso(x, by);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  for (let y = Math.floor(ay / step) * step; y <= by; y += step) {
    const a = iso(ax, y),
      b = iso(bx, y);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  ctx.restore();
}
function drawGround(ctx: Ctx, l: Light) {
  const n = l.night;
  const season = l.season ?? "summer",
    snow = season === "winter";
  const C = R.cols,
    Rw = R.rows;
  const c = canal();
  const P = plaza();
  const vr = viewRect(ctx);
  const span = gridSpan(vr);
  // Grass (or snow) everywhere first.
  const grass = snow ? [232, 238, 246] : seasonTint([110, 176, 90], season, 0.8);
  const grassDark = snow ? [70, 78, 106] : [34, 54, 44];
  ctx.fillStyle = lerpRgb(grass, grassDark, n);
  ctx.fillRect(vr.x0 - 10, vr.y0 - 10, vr.x1 - vr.x0 + 20, vr.y1 - vr.y0 + 20);
  // Mowing stripes and soft patches, by world position (steady as the view moves).
  ctx.globalAlpha = (snow ? 0.03 : 0.06) * (1 - n * 0.7);
  ctx.fillStyle = "#ffffff";
  for (let k = Math.floor(span.x0 / 2) * 2; k < span.x1; k += 2) {
    quad(ctx, k, span.y0, k + 1, span.y1);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (let gx = span.x0; gx < span.x1; gx += 3)
    for (let gy = span.y0; gy < span.y1; gy += 3) {
      const h = hash(gx * 7.3 + gy * 131.7);
      if (h < 0.55) continue;
      const p = iso(gx + hash(gx + gy) * 3, gy + hash(gy - gx) * 3);
      const r = 50 + h * 70;
      const lighter = h > 0.78;
      const col = snow ? (lighter ? "255,255,255" : "150,170,210") : lighter ? "200,236,150" : "40,96,40";
      ctx.fillStyle = `rgba(${col},${0.1 * (1 - n * 0.6)})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  // Tufts and flowers, a few per cell (the paving covers those under it).
  const flowerShare = { spring: 0.3, summer: 0.18, autumn: 0.05, winter: 0 }[season];
  const tuft = lerpRgb(seasonTint([66, 136, 56], season, 0.8), [24, 40, 30], n);
  ctx.fillStyle = tuft;
  ctx.globalAlpha = snow ? 0 : 0.75;
  ctx.beginPath();
  const flowers: [number, number, string][] = [];
  for (let gx = span.x0; gx < span.x1; gx++)
    for (let gy = span.y0; gy < span.y1; gy++)
      for (let k = 0; k < 3; k++) {
        const hh = hash(gx * 57.1 + gy * 13.3 + k * 7.7);
        const p = iso(gx + hash(hh * 91) , gy + hash(hh * 37));
        if (hash(hh * 11 + 3) < flowerShare) {
          flowers.push([
            p.x,
            p.y,
            season === "autumn"
              ? ["#f2c14e", "#e8862e"][k % 2]
              : ["#ffd65b", "#ff8fb1", "#ffffff", "#b49cff"][(gx + gy + k) & 3],
          ]);
          continue;
        }
        ctx.moveTo(p.x - 3, p.y);
        ctx.lineTo(p.x - 1, p.y - 6);
        ctx.lineTo(p.x, p.y);
        ctx.lineTo(p.x + 2, p.y - 7);
        ctx.lineTo(p.x + 3, p.y);
      }
  ctx.fill();
  ctx.globalAlpha = 1 - n * 0.6;
  for (const [x, y, col] of flowers) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (season === "autumn") {
    for (let gx = span.x0; gx < span.x1; gx++)
      for (let gy = span.y0; gy < span.y1; gy++) {
        const hh = hash(gx * 3.1 + gy * 71.9);
        if (hh < 0.4) continue;
        const p = iso(gx + hash(hh * 5), gy + hash(hh * 9));
        ctx.globalAlpha = 0.9 - n * 0.5;
        ctx.fillStyle = ["#d9822b", "#c8442c", "#e8b23a", "#9a5a2a"][(gx + gy) & 3];
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 3, 1.6, hh * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    ctx.globalAlpha = 1;
  }
  // Paving: sidewalks, the apron round the room, the promenade, the paths.
  const slab = (c: number[]) => (snow ? c.map((v) => v + (250 - v) * 0.45) : c);
  const pave = lerpRgb(slab([216, 206, 188]), [78, 76, 90], n),
    paveAlt = lerpRgb(slab([228, 220, 204]), [86, 84, 98], n),
    seam = lerpRgb(slab([184, 172, 152]), [60, 58, 72], n);
  const warm = lerpRgb(slab([214, 184, 156]), [80, 66, 70], n),
    warmAlt = lerpRgb(slab([196, 160, 132]), [70, 58, 62], n),
    warmSeam = lerpRgb(slab([170, 136, 112]), [58, 48, 54], n);
  const gravel = lerpRgb(slab([212, 196, 160]), [76, 72, 80], n);
  paving(ctx, BACKS - 7.5, -E, FRONTS, E, lerpRgb(slab([196, 190, 180]), [70, 70, 84], n), seam, 1);
  paving(ctx, FRONTS, -E, ROAD0, E, pave, seam, 0.75, paveAlt);
  paving(ctx, ROAD1, -E, WALK, E, pave, seam, 0.75, paveAlt);
  paving(ctx, WALK, BACK.y1, C - 0.5 + APRON, Rw - 0.5 + APRON, pave, seam, 0.75, paveAlt);
  paving(ctx, C - 0.5 + APRON, BACK.y1, C + E, BACK.y1 + 1.9, pave, seam, 0.75, paveAlt);
  paving(ctx, ROAD1, HOUSES, C + E, BACK.y0, pave, seam, 0.75, paveAlt);
  // The promenade: warm brick in a herringbone-ish pattern, to the canal.
  paving(ctx, WALK, Rw - 0.5 + APRON, C - 0.5 + APRON, c.y0 - 0.22, warm, warmSeam, 0.5, warmAlt);
  paving(ctx, C - 0.5 + APRON, c.y0 - 2.2, C + E, c.y0 - 0.22, warm, warmSeam, 0.5, warmAlt);
  // Gravel along the far bank, and the square's path.
  ctx.fillStyle = gravel;
  quad(ctx, WALK, c.y1 + 0.22, C + E, c.y1 + 2.1);
  ctx.fill();
  quad(ctx, C - 0.5 + APRON, P.y + 2.3, C + E, P.y + 3.1);
  ctx.fill();
  quad(ctx, footX0(), c.y1, footX0() + 1.4, c.y1 + 0.4);
  ctx.fill();
  ctx.fillStyle = `rgba(120,100,70,${0.18 - n * 0.08})`;
  for (let i = 0; i < 400; i++) {
    const p = iso(WALK + hash(i + 1) * (C + 30), c.y1 + 0.3 + hash(i + 2) * 1.7);
    ctx.fillRect(p.x, p.y, 2, 1.4);
  }
  // The square: a paved circle with rings, around the fountain.
  const sc = iso(P.x, P.y);
  const ex = 48 * Math.SQRT2,
    ey = 24 * Math.SQRT2;
  ctx.fillStyle = lerpRgb(slab([226, 214, 194]), [80, 78, 92], n);
  ctx.beginPath();
  ctx.ellipse(sc.x, sc.y, P.r * ex, P.r * ey, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = lerpRgb(slab([196, 182, 160]), [64, 62, 76], n);
  ctx.lineWidth = 1.2;
  for (const f of [0.66, 0.84, 1]) {
    ctx.beginPath();
    ctx.ellipse(sc.x, sc.y, P.r * ex * f, P.r * ey * f, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    ctx.moveTo(sc.x + Math.cos(a) * P.r * ex * 0.66, sc.y + Math.sin(a) * P.r * ey * 0.66);
    ctx.lineTo(sc.x + Math.cos(a) * P.r * ex, sc.y + Math.sin(a) * P.r * ey);
  }
  ctx.stroke();
  // Flowerbeds: the season's flowers in dark soil, edged with stone.
  const bloom: Record<Season, string[]> = {
    spring: ["#ff8fb1", "#ffd65b", "#ffffff", "#b49cff"],
    summer: ["#e2453a", "#ff9a5b", "#ffd65b", "#ff7aa8"],
    autumn: ["#e8862e", "#c8442c", "#f2c14e", "#a0522d"],
    winter: [],
  };
  for (const [bx, by, w] of [
    [P.x - 1.6, P.y + 3.9, 46],
    [P.x + 2.2, P.y + 3.9, 46],
    [C + 18, -0.2, 60],
    [6, c.y1 + 5.6, 60],
    [16, c.y1 + 5.2, 52],
  ] as [number, number, number][]) {
    const b = iso(bx, by);
    ctx.fillStyle = lerpRgb(slab([200, 192, 178]), [70, 70, 84], n);
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, w + 4, w * 0.38 + 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = lerpRgb(snow ? [236, 240, 248] : [112, 76, 52], snow ? [76, 84, 112] : [44, 36, 40], n);
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, w, w * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < w * 0.8 && bloom[season].length; i++) {
      const a = hash(i + bx * 7) * Math.PI * 2,
        rr = Math.sqrt(hash(i + 50 + by)) * 0.85;
      const x = b.x + Math.cos(a) * w * rr,
        y = b.y + Math.sin(a) * w * 0.36 * rr;
      ctx.fillStyle = shade("#3f8a45", -0.5 * n);
      ctx.fillRect(x - 0.6, y - 6, 1.2, 6);
      ctx.fillStyle = shade(bloom[season][i % bloom[season].length], -0.5 * n);
      ctx.beginPath();
      ctx.arc(x, y - 7, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The doormat path from the door to the curb.
  ctx.fillStyle = lerpRgb([190, 110, 84], [80, 50, 50], n);
  quad(ctx, ROAD1 + 0.2, DOOR.y - 0.5, WALK, DOOR.y + 0.5);
  ctx.fill();
  drawRoads(ctx, l, slab);
}
const footX0 = () => Math.round(R.cols * 0.5) + 0.5 - 0.7;
function drawRoads(ctx: Ctx, l: Light, slab: (c: number[]) => number[]) {
  const n = l.night,
    snow = l.season === "winter";
  const C = R.cols;
  const asphalt = lerpRgb([92, 96, 106], [36, 38, 48], n),
    worn = lerpRgb([80, 84, 94], [30, 32, 42], n);
  ctx.fillStyle = asphalt;
  quad(ctx, ROAD0, -E, ROAD1, E);
  ctx.fill();
  quad(ctx, ROAD1, BACK.y0, C + E, BACK.y1);
  ctx.fill();
  // Tyre tracks in each lane, and grit.
  ctx.fillStyle = worn;
  for (const lane of [ROAD0 + LANE, ROAD1 - LANE])
    for (const d of [-0.42, 0.42]) {
      quad(ctx, lane + d - 0.12, -E, lane + d + 0.12, E);
      ctx.fill();
    }
  const vr = viewRect(ctx);
  const s = gridSpan(vr);
  for (let gy = Math.max(-E, s.y0); gy < Math.min(E, s.y1); gy += 0.5)
    for (let k = 0; k < 6; k++) {
      const hh = hash(gy * 13 + k);
      const p = iso(ROAD0 + hh * (ROAD1 - ROAD0), gy + hash(hh * 7) * 0.5);
      ctx.fillStyle = hh > 0.5 ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.1)";
      ctx.fillRect(p.x, p.y, 1.8, 1.3);
    }
  // Curbs: a light kerbstone and its face in shadow.
  const kerb = lerpRgb(slab([236, 232, 222]), [96, 96, 108], n),
    kerbFace = lerpRgb([160, 152, 140], [56, 56, 68], n);
  const curbY = (x: number, y0: number, y1: number, side: 1 | -1) => {
    ctx.fillStyle = kerb;
    quad(ctx, side > 0 ? x - 0.1 : x, y0, side > 0 ? x : x + 0.1, y1);
    ctx.fill();
    if (side > 0) {
      ctx.fillStyle = kerbFace;
      const a = iso(x - 0.1, y0),
        b = iso(x - 0.1, y1);
      poly(ctx, [a, b, { x: b.x, y: b.y + 5 }, { x: a.x, y: a.y + 5 }]);
      ctx.fill();
    }
  };
  curbY(ROAD1, -E, BACK.y0, 1);
  curbY(ROAD1, BACK.y1, E, 1);
  curbY(ROAD0, -E, E, -1);
  ctx.fillStyle = kerb;
  quad(ctx, ROAD1, BACK.y0 - 0.1, C + E, BACK.y0);
  ctx.fill();
  quad(ctx, ROAD1, BACK.y1, C + E, BACK.y1 + 0.1);
  ctx.fill();
  if (snow) {
    ctx.fillStyle = lerpRgb([236, 240, 246], [92, 96, 116], n);
    quad(ctx, ROAD0, -E, ROAD0 + 0.35, E);
    ctx.fill();
    quad(ctx, ROAD1 - 0.45, -E, ROAD1 - 0.1, E);
    ctx.fill();
  }
  // Markings: edge lines, a dashed centre line, the zebras, stop lines, the bus stop.
  const paint = lerpRgb([245, 245, 240], [118, 118, 128], n),
    yellow = lerpRgb([255, 214, 90], [130, 116, 70], n);
  const mid = (ROAD0 + ROAD1) / 2;
  const Z = zebraY(),
    sy = stopY();
  ctx.fillStyle = paint;
  for (const x of [ROAD0 + 0.22, ROAD1 - 0.3]) {
    quad(ctx, x, -E, x + 0.07, Z - ZEBRA_HALF - 0.1);
    ctx.fill();
    quad(ctx, x, Z + ZEBRA_HALF + 0.1, x + 0.07, E);
    ctx.fill();
  }
  ctx.fillStyle = yellow;
  for (let y = -E; y < E; y += 1.6) {
    if (Math.abs(y + 0.45 - Z) < ZEBRA_HALF + 0.9) continue;
    quad(ctx, mid - 0.05, y, mid + 0.05, y + 0.9);
    ctx.fill();
  }
  ctx.fillStyle = paint;
  for (let x = ROAD0 + 0.3; x < ROAD1 - 0.3; x += 0.55) {
    quad(ctx, x, Z - ZEBRA_HALF, x + 0.3, Z + ZEBRA_HALF);
    ctx.fill();
  }
  // Stop lines before the zebra, each lane on its own side.
  quad(ctx, ROAD0 + 0.1, Z - ZEBRA_HALF - 0.75, mid, Z - ZEBRA_HALF - 0.6);
  ctx.fill();
  quad(ctx, mid, Z + ZEBRA_HALF + 0.6, ROAD1 - 0.1, Z + ZEBRA_HALF + 0.75);
  ctx.fill();
  // The zebra over the back street's mouth.
  for (let y = BACK.y0 + 0.25; y < BACK.y1 - 0.25; y += 0.55) {
    quad(ctx, ROAD1 + 0.4, y, ROAD1 + 1.5, y + 0.3);
    ctx.fill();
  }
  // Give way: a dashed line where the back street meets the road.
  for (let y = BACK.y0 + 0.15; y < BACK.y1; y += 0.45) {
    quad(ctx, ROAD1 + 0.05, y, ROAD1 + 0.15, y + 0.25);
    ctx.fill();
  }
  // The bus stop's box: yellow zigzags along the curb, BUS painted in the lane.
  ctx.strokeStyle = yellow;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = sy - 2.8, k = 0; y <= sy + 2.8; y += 0.4, k++) {
    const p = iso(ROAD1 - (k % 2 ? 0.2 : 0.42), y);
    if (k) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.save();
  const t = iso(ROAD1 - LANE, sy - 1.6);
  ctx.translate(t.x, t.y);
  ctx.transform(1, -0.5, 1, 0.5, 0, 0);
  ctx.fillStyle = yellow;
  ctx.font = "900 18px 'Barlow Condensed', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("BUS", 0, 6);
  ctx.restore();
  // Parking bays along the back street's far curb.
  ctx.fillStyle = paint;
  for (let x = ROAD1 + 2.6; x < C + E; x += 3.4) {
    quad(ctx, x, BACK.y0, x + 0.07, BACK.y0 + 1.4);
    ctx.fill();
  }
  quad(ctx, ROAD1 + 2.6, BACK.y0 + 1.4, C + E, BACK.y0 + 1.47);
  ctx.fill();
  // Manholes and drains.
  const iron = lerpRgb([66, 68, 76], [26, 28, 36], n);
  for (const [x, y] of [
    [ROAD0 + 1.3, -6],
    [ROAD1 - 1.6, 2.5],
    [ROAD0 + 1.4, R.rows + 14],
    [4.5, (BACK.y0 + BACK.y1) / 2],
  ]) {
    const p = iso(x, y);
    ctx.fillStyle = iron;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 15, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 10, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let y = -E + 3; y < E; y += 7) {
    for (const x of [ROAD1 - 0.28, ROAD0 + 0.05]) {
      if (Math.abs(y - Z) < 2) continue;
      const a = iso(x, y);
      ctx.fillStyle = iron;
      poly(ctx, [a, iso(x + 0.23, y), iso(x + 0.23, y + 0.5), iso(x, y + 0.5)]);
      ctx.fill();
    }
  }
}

/* ───────────── the props, split once per room size ───────────── */

let split: { key: string; all: Prop[]; baked: Prop[]; live: Prop[] } | null = null;
let specialOf: () => string = () => "";
function propSplit() {
  const key = `${R.cols}x${R.rows}`;
  if (split?.key === key) return split;
  const all = props(() => specialOf());
  const room = roomOutline();
  const { baked, live } = splitProps(all);
  // A baked prop in front of the room that reaches over it is drawn after the room instead.
  const keep: Prop[] = [];
  for (const p of baked) {
    const mx = (p.x0 + p.x1) / 2,
      my = (p.y0 + p.y1) / 2;
    if (!p.bake && inFront(mx, my) && meetsPoly(outline(p), room)) live.push(p);
    else keep.push(p);
  }
  split = { key, all, baked: keep, live };
  return split;
}
/** The room's outline on screen (walls and slab included), for what may cover it. */
export function roomOutline() {
  const l = ROOM.left,
    b = ROOM.bottom,
    r = ROOM.right,
    t = ROOM.top;
  return [
    { x: l.x - 16, y: l.y + 40 },
    { x: b.x, y: b.y + 40 },
    { x: r.x + 16, y: r.y + 40 },
    { x: r.x + 16, y: r.y - WALL_H - 22 },
    { x: t.x, y: t.y - WALL_H - 60 },
    { x: l.x - 16, y: l.y - WALL_H - 22 },
  ];
}
function meetsPoly(a: { x: number; y: number }[], b: { x: number; y: number }[]) {
  for (const P of [a, b])
    for (let i = 0; i < P.length; i++) {
      const p = P[i],
        q = P[(i + 1) % P.length];
      const nx = q.y - p.y,
        ny = p.x - q.x;
      let a0 = Infinity,
        a1 = -Infinity,
        b0 = Infinity,
        b1 = -Infinity;
      for (const v of a) {
        const d = v.x * nx + v.y * ny;
        a0 = Math.min(a0, d);
        a1 = Math.max(a1, d);
      }
      for (const v of b) {
        const d = v.x * nx + v.y * ny;
        b0 = Math.min(b0, d);
        b1 = Math.max(b1, d);
      }
      if (a1 <= b0 || b1 <= a0) return false;
    }
  return true;
}
/** The props drawn every frame (tests). */
export const liveProps = () => propSplit().live;
export const bakedProps = () => propSplit().baked;

/* ───────────── the baked street ───────────── */

/** Everything that never moves, into the bake (its transform set, its rectangle `area`). */
export function drawSceneryStatic(ctx: Ctx, l: Light, special: string, area?: Rect) {
  specialOf = () => special;
  const vr = area ?? viewRect(ctx);
  drawGround(ctx, l);
  // Shadows of the buildings on the ground.
  const { baked } = propSplit();
  for (const p of baked)
    if (p.building) {
      const b = screenBox({ ...p, draw: () => {} });
      if (meets(vr, b.x0 - 200, b.y0, b.x1 + 60, b.y1 + 200)) buildingShadow(ctx, p.building, 0.14 * (1 - l.night * 0.5));
    }
  cutWater(ctx);
  drawBanks(ctx, l);
  const list: Drawable[] = [];
  for (const p of baked) {
    const b = screenBox({ ...p, draw: () => {} });
    if (!meets(vr, b.x0 - 40, b.y0 - 40, b.x1 + 40, b.y1 + 40)) continue;
    list.push({ ...p, draw: () => p.paint(ctx, l) });
  }
  for (const d of depthSort(list)) d.draw();
  // The neighbourhood's lights at night: baked too, they never move.
  if (l.night > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const [x, y, r, rgb, a] of staticGlows()) {
      if (!meets(vr, x - r, y - r, x + r, y + r)) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb},${a * l.night})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  }
}
/** Lights baked with the street: windows, lamps, the shelter. */
export function staticGlows(): Glow[] {
  return [...buildingGlows(), ...lampGlows(), shelterGlow()];
}

/* ───────────── each frame ───────────── */

/** Under the baked street: the canal's water. */
export function drawSceneryUnder(ctx: Ctx, l: Light, low: boolean) {
  drawWater(ctx, l, low);
}
/** Over the baked street, under everything standing: the fountain's water. */
export function drawSceneryOver(ctx: Ctx, l: Light, low: boolean) {
  void ctx;
  void l;
  void low;
  tickPics();
}
/**
 * What moves and what may stand in front of it, in drawing order, split
 * at the room: `behind` is drawn before it, `front` after.
 */
export function sceneryDrawables(
  ctx: Ctx,
  l: Light,
  cars: Car[],
  street: Street | undefined,
  paint: PaintCreature | undefined,
  braking = false,
  low = false,
): { behind: Drawable[]; front: Drawable[] } {
  const vr = viewRect(ctx);
  const all: Drawable[] = [];
  const t = l.t;
  for (const p of propSplit().live) {
    const sway = p.tree ? Math.sin(t * 1.1 + p.x0 * 0.7 + p.y0) * 0.012 : 0;
    all.push({
      ...p,
      draw: () => {
        drawPropCached(ctx, p, l, sway);
        p.after?.(ctx, l, low);
      },
    });
  }
  for (const car of cars) all.push(carDrawable(ctx, car, l, braking));
  if (street && paint) all.push(...townDrawables(ctx, street, l, paint));
  const behind: Drawable[] = [],
    front: Drawable[] = [];
  for (const d of all) {
    const b = screenBox(d);
    if (!meets(vr, b.x0 - 30, b.y0 - 30, b.x1 + 30, b.y1 + 30)) continue;
    (inFront((d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2) ? front : behind).push(d);
  }
  return { behind: depthSort(behind), front: depthSort(front) };
}
/** The weather, cloud shadows and birds, over everything outside. */
export function drawSceneryTop(ctx: Ctx, l: Light, low: boolean) {
  const leafy = trees()
    .filter(([, , , k]) => k !== 1)
    .slice(0, 12)
    .map(([x, y]) => [x, y] as [number, number]);
  drawWeather(ctx, l, low, leafy);
  if (low) return;
  const vr = viewRect(ctx);
  const day = 1 - l.night;
  if (day > 0.2 && l.season !== "winter") {
    // Shadows of clouds drifting over the town.
    ctx.fillStyle = `rgba(30,40,70,${0.06 * day})`;
    for (let i = 0; i < 4; i++) {
      const W = vr.x1 - vr.x0 + 800;
      const x = vr.x0 - 400 + ((hash(i) * W + l.t * (14 + i * 3)) % W),
        y = vr.y0 + hash(i + 9) * (vr.y1 - vr.y0);
      ctx.beginPath();
      ctx.ellipse(x, y, 220 + hash(i + 3) * 120, 90 + hash(i + 4) * 40, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 150, y + 30, 160, 70, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // A few birds crossing, high over the roofs, with their shadows.
    for (let i = 0; i < 3; i++) {
      const span = vr.x1 - vr.x0 + 400;
      const x = vr.x0 - 200 + ((l.t * (40 + i * 9) + i * 300) % span),
        y = vr.y0 + 80 + i * 40 + Math.sin(l.t * 0.7 + i) * 10 + (x - vr.x0) * 0.2;
      const flap = Math.sin(l.t * 9 + i * 2) * 4;
      ctx.strokeStyle = "rgba(40,50,70,.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 9, y - flap);
      ctx.quadraticCurveTo(x - 4, y - 4, x, y);
      ctx.quadraticCurveTo(x + 4, y - 4, x + 9, y - flap);
      ctx.stroke();
      ctx.fillStyle = "rgba(30,40,60,.12)";
      ctx.beginPath();
      ctx.ellipse(x - 40, y + 260, 7, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
/** Lights added live at night: the vehicles' (everything else is baked). */
export function carGlows(cars: Car[], bus?: Bus | null): Glow[] {
  return vehicleGlows(cars, bus);
}
/** Kept for the scene: nothing extra (lamps are baked). */
export function sceneryGlows(): Glow[] {
  return [];
}

/** The rooftop sign over the right wall: lit letters at night. */
export function drawRoofSign(ctx: Ctx, l: Light, t: number) {
  const a = iso(1.2, -0.5),
    b = iso(5.8, -0.5);
  const lift = WALL_H + 10,
    h = 40;
  ctx.fillStyle = "#3a2a22";
  for (const p of [a, b]) ctx.fillRect(p.x - 2 + (p === a ? 10 : -10), p.y - lift - 6, 4, 10);
  const q = [
    { x: a.x, y: a.y - lift },
    { x: b.x, y: b.y - lift },
    { x: b.x, y: b.y - lift - h },
    { x: a.x, y: a.y - lift - h },
  ];
  ctx.fillStyle = "#3b1f2a";
  poly(ctx, q);
  ctx.fill();
  ctx.strokeStyle = "#f2c14e";
  ctx.lineWidth = 2.5;
  poly(ctx, q);
  ctx.stroke();
  const u = { x: b.x - a.x, y: b.y - a.y };
  const len = Math.hypot(u.x, u.y);
  ctx.save();
  ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([u.x / len, u.y / len, 0, 1, q[3].x, q[3].y])));
  const glow = 0.6 + 0.4 * l.night;
  const flick = l.night > 0.4 ? 0.92 + 0.08 * Math.sin(t * 13) * Math.sin(t * 3.1) : 1;
  ctx.textAlign = "center";
  ctx.font = "900 22px 'Barlow Condensed', sans-serif";
  if (l.night > 0.2) {
    ctx.shadowColor = "rgba(255,190,90,.9)";
    ctx.shadowBlur = 14 * l.night;
  }
  ctx.fillStyle = `rgba(255,${200 + 30 * glow},${90 + 40 * glow},${flick})`;
  ctx.fillText("ELEMENT BISTRO", len / 2, 29);
  ctx.restore();
}
export function roofSignGlow(): [number, number, number, string, number] {
  const c = iso(3.5, -0.5);
  return [c.x, c.y - WALL_H - 30, 170, "255,180,90", 0.35];
}
export { FAR, BRIDGE };
