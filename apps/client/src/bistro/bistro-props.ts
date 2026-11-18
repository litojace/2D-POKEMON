/*
 * Element Bistro: everything that stands on the street but never moves:
 * trees, lamps, benches, bins, hydrants, bollards, planters, the fountain,
 * railings, the bridges' parapets, the footbridge, parked cars, a kiosk and
 * a playground; the buildings (bistro-city.ts) come in here too.
 *
 * Each has a footprint, so the scene sorts it with what moves
 * (bistro-depth.ts). What can never stand in front of anything moving is
 * baked once with the ground; the rest is drawn every frame in its place
 * (from a cached picture, so it costs a copy). Which is which is worked
 * out, not guessed: coversMovers() checks every prop against where people,
 * bikes, cars and the bus can be.
 */
import { DOOR } from "./bistro-model";
import { R, ROOM, iso, isoBox, shade, softShadow, type Light, type Season } from "./bistro-art";
import { poly } from "./bistro-geom";
import {
  BACK,
  BRIDGE,
  BUS_LEN,
  HOUSES,
  ROAD0,
  ROAD1,
  TILE,
  WALK,
  WATER,
  ZEBRA_HALF,
  benches,
  bikeRoutes,
  canal,
  footLift,
  footX,
  hash,
  laneOf,
  lerpRgb,
  onWall,
  plaza,
  roadEnds,
  routes,
  drawShelter,
  shelter,
  stopY,
  up,
  waitSpot,
  zebraY,
  type Glow,
} from "./bistro-town";
import { buildings, drawBuilding, topOf, HOUSE_X0, type Building } from "./bistro-city";
import { CAR_SIZE, carBox, drawCar, type Pose } from "./bistro-vehicles";
import { order, screenBox, type Drawable, type ScreenBox } from "./bistro-depth";
import { lightKey, picture, tickPics } from "./bistro-pics";

type Ctx = CanvasRenderingContext2D;
type Pt = { x: number; y: number };

export interface Prop {
  /** Unique: the picture cache's key. */
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  h: number;
  sw?: number;
  z?: number;
  paint: (ctx: Ctx, l: Light) => void;
  /** Force: baked with the ground (its lower parts are walked over), or always live. */
  bake?: boolean;
  live?: boolean;
  /** A tree: sways a little when drawn live. */
  tree?: boolean;
  building?: Building;
  /** Drawn live over its cached picture (the fountain's running water). */
  after?: (ctx: Ctx, l: Light, low: boolean) => void;
}

/* ───────────── trees ───────────── */

/** A linear gradient from stops. */
const lin = (
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: [number, string][],
) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
};
export function drawTree(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  kind: number,
  l: Light,
  /** Wind: how far the crown leans (px at the top; 0 for the still layer). */
  sway = 0,
) {
  const n = l.night;
  const c = iso(x, y);
  // The crown leans with the wind, more the higher it is.
  const lean = (dy: number) => (sway * -dy) / 110;
  softShadow(ctx, c.x + 10, c.y + 4, 46 * s, 18 * s, 0.3);
  // Trunk: tapered, flaring at the roots, running up into the crown (so the
  // leaves cover its top: no gap between them).
  const top = (kind === 1 ? -84 : -78) * s;
  const bark = shade("#7a4a2a", -0.5 * n),
    barkDark = shade("#4e2c14", -0.5 * n);
  ctx.fillStyle = lin(ctx, c.x - 7 * s, 0, c.x + 7 * s, 0, [
    [0, shade("#9a6338", -0.5 * n)],
    [0.45, bark],
    [1, barkDark],
  ]);
  ctx.beginPath();
  ctx.moveTo(c.x - 9 * s, c.y);
  ctx.quadraticCurveTo(c.x - 5 * s, c.y - 6 * s, c.x - 5 * s, c.y - 14 * s);
  ctx.lineTo(c.x - 3 * s + lean(top), c.y + top);
  ctx.lineTo(c.x + 3 * s + lean(top), c.y + top);
  ctx.lineTo(c.x + 5 * s, c.y - 14 * s);
  ctx.quadraticCurveTo(c.x + 5 * s, c.y - 6 * s, c.x + 10 * s, c.y);
  ctx.closePath();
  ctx.fill();
  // A few bark lines.
  ctx.strokeStyle = shade("#3e2210", -0.4 * n);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [bx, b0, b1] of [
    [-1.5, -10, -26],
    [2, -20, -38],
  ] as const) {
    ctx.moveTo(c.x + bx * s, c.y + b0 * s);
    ctx.lineTo(c.x + bx * s + lean(b1 * s) * 0.5, c.y + b1 * s);
  }
  ctx.stroke();
  if (kind === 1) {
    // A pine: four jagged tiers, darker underneath, lit from the right.
    for (let i = 0; i < 4; i++) {
      const w = (38 - i * 8) * s,
        base = c.y - (46 + i * 22) * s,
        tip = base - 44 * s,
        lx = lean(base - c.y),
        tx = lean(tip - c.y);
      const col = shade(i % 2 ? "#2f7a4a" : "#3b8e55", -0.55 * n);
      ctx.fillStyle = lin(ctx, c.x - w, 0, c.x + w, 0, [
        [0, shade(col, -0.18)],
        [0.6, col],
        [1, shade(col, 0.16)],
      ]);
      ctx.beginPath();
      ctx.moveTo(c.x + tx, tip);
      // The jagged hem: a few points along the bottom.
      const steps = 6;
      ctx.lineTo(c.x + w + lx, base);
      for (let k = steps; k >= 0; k--) {
        const f = k / steps;
        const px = c.x - w + 2 * w * f + lx;
        ctx.lineTo(px, base + (k % 2 ? 7 : 2) * s);
      }
      ctx.lineTo(c.x - w + lx, base);
      ctx.closePath();
      ctx.fill();
      // The tier's shadow on the one below.
      ctx.fillStyle = `rgba(10,40,20,${0.22 - n * 0.1})`;
      ctx.beginPath();
      ctx.ellipse(c.x + lx, base + 4 * s, w * 0.8, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      if (l.season === "winter") {
        // Snow resting on the tier.
        ctx.fillStyle = shade("#f6f8fc", -0.45 * n);
        ctx.beginPath();
        ctx.moveTo(c.x + tx, tip);
        ctx.lineTo(c.x + w * 0.62 + lx, base - 8 * s);
        ctx.quadraticCurveTo(
          c.x + lx,
          base - 2 * s,
          c.x - w * 0.62 + lx,
          base - 8 * s,
        );
        ctx.closePath();
        ctx.fill();
      }
    }
    return;
  }
  if (l.season === "winter") {
    // Bare branches with snow along them.
    const twig = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      wd: number,
    ) => {
      ctx.strokeStyle = barkDark;
      ctx.lineWidth = wd * s;
      ctx.beginPath();
      ctx.moveTo(c.x + x0 * s + lean(y0 * s), c.y + y0 * s);
      ctx.lineTo(c.x + x1 * s + lean(y1 * s), c.y + y1 * s);
      ctx.stroke();
      ctx.strokeStyle = shade("#f6f8fc", -0.45 * n);
      ctx.lineWidth = wd * 0.45 * s;
      ctx.beginPath();
      ctx.moveTo(c.x + x0 * s + lean(y0 * s), c.y + (y0 - wd * 0.5) * s);
      ctx.lineTo(c.x + x1 * s + lean(y1 * s), c.y + (y1 - wd * 0.5) * s);
      ctx.stroke();
    };
    ctx.lineCap = "round";
    twig(0, -70, -26, -104, 4);
    twig(0, -70, 24, -110, 4);
    twig(0, -76, 2, -122, 3.5);
    twig(-14, -88, -34, -92, 2.4);
    twig(12, -90, 34, -96, 2.4);
    twig(-18, -95, -14, -120, 2);
    twig(16, -100, 12, -124, 2);
    ctx.lineCap = "butt";
    return;
  }
  // A round leafy crown: a darker underside, then clumps lit from the top
  // right; the low middle clump covers the trunk's top.
  const base = crownColour(kind, l.season);
  const under: [number, number, number][] = [
    [-22, -66, 28],
    [22, -64, 30],
    [0, -60, 26],
  ];
  const puffs: [number, number, number][] = [
    [0, -88, 34],
    [-26, -74, 25],
    [26, -72, 27],
    [-12, -110, 24],
    [14, -104, 25],
    [0, -66, 20],
  ];
  for (const [dx, dy, r] of under) {
    ctx.fillStyle = shade(shade(base, -0.38), -0.55 * n);
    ctx.beginPath();
    ctx.arc(c.x + (dx + lean(dy)) * s, c.y + dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // Leafy edge: small tufts behind each clump, so only their tips stick out
  // past the outline (a ragged, leafy silhouette instead of smooth balls).
  ctx.fillStyle = shade(shade(base, -0.22), -0.55 * n);
  for (const [i, [dx, dy, r]] of puffs.entries()) {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + hash(i * 7 + k + x * 3) * 0.6;
      const tr = (5 + hash(i + k * 5 + y) * 3) * s;
      ctx.beginPath();
      ctx.arc(
        c.x + (dx + lean(dy)) * s + Math.cos(a) * (r * s - tr * 0.2),
        c.y + dy * s + Math.sin(a) * (r * s - tr * 0.2),
        tr,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  for (const [dx, dy, r] of puffs) {
    const px = c.x + (dx + lean(dy)) * s,
      py = c.y + dy * s,
      rr = r * s;
    const g = ctx.createRadialGradient(
      px + rr * 0.35,
      py - rr * 0.4,
      rr * 0.1,
      px,
      py,
      rr,
    );
    g.addColorStop(0, shade(shade(base, 0.35), -0.55 * n));
    g.addColorStop(0.7, shade(base, -0.55 * n));
    g.addColorStop(1, shade(shade(base, -0.22), -0.55 * n));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  // Highlights catching the light, and blossoms on the pink ones.
  for (let i = 0; i < 14; i++) {
    const a = hash(i + x * 13 + y * 7) * Math.PI * 2;
    const d = hash(i + 40 + x * 3) * 34 * s;
    const dy = -90 + Math.sin(a) * (d / s) * 0.8;
    const px = c.x + Math.cos(a) * d + 6 * s + lean(dy) * s,
      py = c.y + dy * s;
    ctx.fillStyle =
      l.season === "autumn"
        ? `rgba(255,214,110,${0.55 - n * 0.4})`
        : kind === 2 && l.season !== "summer"
          ? `rgba(255,236,244,${0.8 - n * 0.6})`
          : l.season === "spring" && i % 3 === 0
            ? `rgba(255,240,246,${0.75 - n * 0.55})`
            : `rgba(210,250,170,${0.45 - n * 0.35})`;
    ctx.beginPath();
    ctx.arc(px, py, (kind === 2 ? 2.4 : 3) * s, 0, Math.PI * 2);
    ctx.fill();
  }
}
/** A leafy crown's colour in each season (cherries bloom pink in spring). */
function crownColour(kind: number, season: Season | undefined): string {
  switch (season) {
    case "spring":
      return kind === 2 ? "#f2a2c0" : "#78c25a";
    case "autumn":
      return kind === 2 ? "#d4543a" : "#e2962f";
    case "winter":
      return "#7a6a5a";
    case "summer":
      return kind === 2 ? "#6ab04e" : "#5fae4f";
    default:
      return kind === 2 ? "#e78fb0" : "#5fae4f";
  }
}


/* ───────────── lamps, benches and the small things ───────────── */

/** A street lamp: a tall post, an arm toward `arm` (screen x: -1 left, 1 right), a lantern. */
function drawLamp(ctx: Ctx, x: number, y: number, l: Light, arm: number, park = false) {
  const c = iso(x, y);
  const n = l.night;
  const iron = shade("#2d3340", -0.3 * n);
  softShadow(ctx, c.x, c.y + 2, 14, 6, 0.3);
  if (park) {
    ctx.fillStyle = iron;
    ctx.fillRect(c.x - 5, c.y - 10, 10, 10);
    ctx.fillRect(c.x - 2, c.y - 104, 4, 104);
    ctx.fillRect(c.x - 7, c.y - 108, 14, 4);
    const on = n > 0.2;
    ctx.fillStyle = on ? `rgba(255,${(226 + n * 20) | 0},${(160 + n * 40) | 0},1)` : shade("#eef2f6", -0.3 * n);
    poly(ctx, [
      { x: c.x - 7, y: c.y - 108 },
      { x: c.x + 7, y: c.y - 108 },
      { x: c.x + 9, y: c.y - 126 },
      { x: c.x - 9, y: c.y - 126 },
    ]);
    ctx.fill();
    ctx.fillStyle = iron;
    poly(ctx, [
      { x: c.x - 11, y: c.y - 126 },
      { x: c.x + 11, y: c.y - 126 },
      { x: c.x, y: c.y - 136 },
    ]);
    ctx.fill();
    return;
  }
  ctx.fillStyle = iron;
  ctx.fillRect(c.x - 6, c.y - 12, 12, 12);
  ctx.fillRect(c.x - 3, c.y - 150, 6, 140);
  ctx.fillRect(c.x - 4.5, c.y - 60, 9, 4);
  ctx.strokeStyle = iron;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - 146);
  ctx.quadraticCurveTo(c.x + arm * 4, c.y - 166, c.x + arm * 26, c.y - 160);
  ctx.stroke();
  const on = n > 0.2;
  ctx.fillStyle = iron;
  ctx.beginPath();
  ctx.ellipse(c.x + arm * 28, c.y - 158, 12, 5, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = on ? `rgba(255,${(226 + n * 20) | 0},${(160 + n * 40) | 0},1)` : shade("#e3e8ee", -0.3 * n);
  ctx.beginPath();
  ctx.ellipse(c.x + arm * 28, c.y - 157, 9, 5, 0, 0, Math.PI);
  ctx.fill();
  // A hanging basket in spring and summer.
  if (l.season === "spring" || l.season === "summer") {
    ctx.fillStyle = shade("#4f8a45", -0.5 * n);
    ctx.beginPath();
    ctx.arc(c.x, c.y - 96, 8, 0, 7);
    ctx.fill();
    ctx.fillStyle = shade(l.season === "spring" ? "#ff8fb1" : "#e2453a", -0.5 * n);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(c.x - 6 + i * 3, c.y - 98 + (i % 2) * 3, 2, 0, 7);
      ctx.fill();
    }
  }
}
function drawBench(ctx: Ctx, bx: number, by: number, along: "x" | "y", l: Light) {
  const n = l.night,
    snow = l.season === "winter";
  const wood = {
    top: shade(snow ? "#eef2f7" : "#b0703f", -0.5 * n),
    left: shade("#8a5530", -0.5 * n),
    right: shade("#9a6038", -0.5 * n),
  };
  const iron = shade("#2d3340", -0.3 * n);
  const c = iso(bx, by);
  softShadow(ctx, c.x, c.y + 2, 36, 14, 0.22);
  const legs = (pts: [number, number][]) => {
    ctx.fillStyle = iron;
    for (const [dx, dy] of pts) {
      const p = iso(bx + dx, by + dy);
      ctx.fillRect(p.x - 2, p.y - 20, 4, 20);
    }
  };
  if (along === "y") {
    legs([
      [0.1, -0.6],
      [0.1, 0.6],
    ]);
    isoBox(ctx, bx - 0.12, by - 0.7, bx + 0.24, by + 0.7, 18, 4, wood);
    // The backrest, two slats.
    isoBox(ctx, bx - 0.24, by - 0.7, bx - 0.16, by + 0.7, 26, 7, wood);
    isoBox(ctx, bx - 0.24, by - 0.7, bx - 0.16, by + 0.7, 37, 7, wood);
    legs([
      [-0.2, -0.6],
      [-0.2, 0.6],
    ]);
  } else {
    legs([
      [-0.6, 0.1],
      [0.6, 0.1],
    ]);
    isoBox(ctx, bx - 0.7, by - 0.12, bx + 0.7, by + 0.24, 18, 4, wood);
    isoBox(ctx, bx - 0.7, by - 0.24, bx + 0.7, by - 0.16, 26, 7, wood);
    isoBox(ctx, bx - 0.7, by - 0.24, bx + 0.7, by - 0.16, 37, 7, wood);
  }
}
function drawBin(ctx: Ctx, x: number, y: number, l: Light) {
  const n = l.night;
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 1, 12, 5, 0.25);
  const g = ctx.createLinearGradient(c.x - 9, 0, c.x + 9, 0);
  g.addColorStop(0, shade("#2f6a4a", -0.5 * n));
  g.addColorStop(0.6, shade("#3f8a5e", -0.5 * n));
  g.addColorStop(1, shade("#2a5a40", -0.5 * n));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(c.x - 9, c.y - 36);
  ctx.lineTo(c.x - 8, c.y - 2);
  ctx.ellipse(c.x, c.y - 2, 8, 3.5, 0, Math.PI, 0, true);
  ctx.lineTo(c.x + 9, c.y - 36);
  ctx.fill();
  ctx.fillStyle = shade("#24503a", -0.5 * n);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 36, 10, 4.5, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = shade("#f4f6fa", -0.5 * n);
  ctx.fillRect(c.x - 3, c.y - 26, 6, 6);
}
function drawHydrant(ctx: Ctx, x: number, y: number, l: Light) {
  const n = l.night;
  const c = iso(x, y);
  const red = shade("#d94a3a", -0.5 * n);
  softShadow(ctx, c.x, c.y + 1, 9, 4, 0.25);
  ctx.fillStyle = red;
  ctx.fillRect(c.x - 5, c.y - 22, 10, 22);
  ctx.fillRect(c.x - 8, c.y - 16, 16, 5);
  ctx.beginPath();
  ctx.arc(c.x, c.y - 22, 5.5, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = shade("#b0352a", -0.5 * n);
  ctx.fillRect(c.x + 1, c.y - 22, 4, 22);
  ctx.fillStyle = shade("#f2c14e", -0.5 * n);
  ctx.fillRect(c.x - 1.5, c.y - 30, 3, 3);
}
function drawBollard(ctx: Ctx, x: number, y: number, l: Light) {
  const n = l.night;
  const c = iso(x, y);
  ctx.fillStyle = shade("#3a4050", -0.3 * n);
  ctx.fillRect(c.x - 3.5, c.y - 24, 7, 24);
  ctx.beginPath();
  ctx.arc(c.x, c.y - 24, 3.5, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = shade("#f4f6fa", -0.3 * n);
  ctx.fillRect(c.x - 3.5, c.y - 19, 7, 3);
}
function drawZebraSign(ctx: Ctx, x: number, y: number, l: Light) {
  const n = l.night;
  const c = iso(x, y);
  ctx.fillStyle = shade("#3a4050", -0.3 * n);
  ctx.fillRect(c.x - 2, c.y - 112, 4, 112);
  ctx.fillStyle = shade("#2f6fd1", -0.3 * n);
  ctx.fillRect(c.x - 11, c.y - 134, 22, 22);
  ctx.fillStyle = "#ffffff";
  poly(ctx, [
    { x: c.x - 8, y: c.y - 115 },
    { x: c.x + 8, y: c.y - 115 },
    { x: c.x, y: c.y - 131 },
  ]);
  ctx.fill();
  ctx.fillStyle = "#1c1d22";
  ctx.beginPath();
  ctx.arc(c.x, c.y - 124, 1.8, 0, 7);
  ctx.fill();
  ctx.fillRect(c.x - 1, c.y - 122, 2, 5);
  // A striped pole lamp (the belisha beacon): amber, blinking at night.
  ctx.fillStyle = l.night > 0.2 && Math.sin(l.t * 4) > 0 ? "#ffb347" : shade("#f2a33a", -0.3 * n);
  ctx.beginPath();
  ctx.arc(c.x, c.y - 140, 5, 0, 7);
  ctx.fill();
}
function drawPlanter(ctx: Ctx, x: number, y: number, l: Light, round = false) {
  const n = l.night,
    s = l.season ?? "summer";
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 24, 10, 0.24);
  if (round) {
    ctx.fillStyle = shade("#c9c2b4", -0.5 * n);
    ctx.beginPath();
    ctx.moveTo(c.x - 20, c.y - 22);
    ctx.lineTo(c.x - 17, c.y - 2);
    ctx.ellipse(c.x, c.y - 2, 17, 7, 0, Math.PI, 0, true);
    ctx.lineTo(c.x + 20, c.y - 22);
    ctx.fill();
    ctx.fillStyle = shade("#ddd6c8", -0.5 * n);
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 22, 20, 8, 0, 0, 7);
    ctx.fill();
  } else {
    isoBox(ctx, x - 0.32, y - 0.32, x + 0.32, y + 0.32, 0, 22, {
      top: shade("#6b4a30", -0.5 * n),
      left: shade("#8a5a3a", -0.5 * n),
      right: shade("#9a6a44", -0.5 * n),
    });
  }
  if (s === "winter") {
    ctx.fillStyle = shade("#f4f7fb", -0.4 * n);
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 24, 16, 6, 0, 0, 7);
    ctx.fill();
    return;
  }
  ctx.fillStyle = shade(s === "autumn" ? "#8a8a3a" : "#4f9f45", -0.5 * n);
  ctx.beginPath();
  for (const [dx, dy, r] of [
    [-8, -28, 9],
    [8, -28, 9],
    [0, -34, 10],
  ])
    ctx.arc(c.x + dx, c.y + dy, r, 0, Math.PI * 2);
  ctx.fill();
  const bloom: Record<Season, string[]> = {
    spring: ["#ff8fb1", "#ffd65b", "#ffffff"],
    summer: ["#e2453a", "#ff9a5b", "#ffd65b"],
    autumn: ["#e8862e", "#c8442c", "#f2c14e"],
    winter: [],
  };
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = shade(bloom[s][i % 3], -0.5 * n);
    ctx.beginPath();
    ctx.arc(c.x - 12 + hash(i + x * 3) * 24, c.y - 26 - hash(i + y) * 14, 2.6, 0, 7);
    ctx.fill();
  }
}
function drawBikeRack(ctx: Ctx, x: number, y: number, l: Light) {
  const n = l.night;
  const iron = shade("#5a6070", -0.3 * n);
  ctx.strokeStyle = iron;
  ctx.lineWidth = 3;
  for (const dx of [-0.35, 0.35]) {
    const p = iso(x + dx, y);
    ctx.beginPath();
    ctx.moveTo(p.x - 9, p.y + 4);
    ctx.lineTo(p.x - 9, p.y - 22);
    ctx.quadraticCurveTo(p.x, p.y - 32, p.x + 9, p.y - 22);
    ctx.lineTo(p.x + 9, p.y + 4);
    ctx.stroke();
  }
  // One bicycle parked in it.
  const p = iso(x - 0.35, y);
  ctx.strokeStyle = "#1c1d22";
  ctx.lineWidth = 2;
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(p.x + k * 16, p.y - 6 + k * 8, 6.5, 9, 0, 0, 7);
    ctx.stroke();
  }
  ctx.strokeStyle = shade("#3d8fd1", -0.4 * n);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(p.x - 16, p.y - 14);
  ctx.lineTo(p.x, p.y - 20);
  ctx.lineTo(p.x + 16, p.y - 6);
  ctx.moveTo(p.x, p.y - 20);
  ctx.lineTo(p.x + 12, p.y - 30);
  ctx.stroke();
}
function drawPillarBox(ctx: Ctx, x: number, y: number, l: Light) {
  const n = l.night;
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 1, 12, 5, 0.25);
  const g = ctx.createLinearGradient(c.x - 10, 0, c.x + 10, 0);
  g.addColorStop(0, shade("#b0302a", -0.5 * n));
  g.addColorStop(0.6, shade("#e2453a", -0.5 * n));
  g.addColorStop(1, shade("#a02a24", -0.5 * n));
  ctx.fillStyle = g;
  ctx.fillRect(c.x - 10, c.y - 46, 20, 46);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 46, 11, 6, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#1c1d22";
  ctx.fillRect(c.x - 6, c.y - 36, 12, 2.5);
  ctx.fillStyle = shade("#f2c14e", -0.4 * n);
  ctx.fillRect(c.x - 4, c.y - 28, 8, 5);
}
/** A round advertising column with posters. */
function drawAdColumn(ctx: Ctx, x: number, y: number, l: Light) {
  const n = l.night;
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 22, 9, 0.28);
  ctx.fillStyle = shade("#3a5a4a", -0.4 * n);
  ctx.fillRect(c.x - 17, c.y - 12, 34, 12);
  const g = ctx.createLinearGradient(c.x - 15, 0, c.x + 15, 0);
  g.addColorStop(0, shade("#d8cbb0", -0.5 * n));
  g.addColorStop(0.6, shade("#f6ecd6", -0.5 * n));
  g.addColorStop(1, shade("#c9bca0", -0.5 * n));
  ctx.fillStyle = g;
  ctx.fillRect(c.x - 15, c.y - 112, 30, 100);
  const posters = ["#2f4c86", "#d94a3a", "#f2c14e", "#4f9a62"];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = shade(posters[i], -0.5 * n);
    ctx.fillRect(c.x - 13 + i * 9, c.y - 100 + (i % 2) * 10, 8, 40);
  }
  ctx.fillStyle = shade("#3a5a4a", -0.4 * n);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 112, 18, 6, 0, 0, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(c.x - 14, c.y - 114);
  ctx.quadraticCurveTo(c.x, c.y - 134, c.x + 14, c.y - 114);
  ctx.fill();
}
/** The sandwich board outside the door, and planters either side of it. */
function drawDoorProps(ctx: Ctx, l: Light, special: string) {
  const n = l.night;
  const c = iso(WALK - 1.0, DOOR.y - 1.2);
  softShadow(ctx, c.x, c.y + 2, 20, 8, 0.3);
  ctx.fillStyle = shade("#6b4026", -0.4 * n);
  poly(ctx, [
    { x: c.x - 16, y: c.y },
    { x: c.x - 10, y: c.y - 50 },
    { x: c.x + 10, y: c.y - 50 },
    { x: c.x + 16, y: c.y },
  ]);
  ctx.fill();
  ctx.fillStyle = "#26382f";
  poly(ctx, [
    { x: c.x - 12.5, y: c.y - 5 },
    { x: c.x - 8, y: c.y - 46 },
    { x: c.x + 8, y: c.y - 46 },
    { x: c.x + 12.5, y: c.y - 5 },
  ]);
  ctx.fill();
  ctx.fillStyle = "#ffd65b";
  ctx.font = "800 8px 'Barlow Condensed', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("OPEN", c.x, c.y - 34);
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = "700 5px 'DM Sans', sans-serif";
  ctx.fillText(special.toUpperCase().slice(0, 14), c.x, c.y - 24);
  ctx.fillText("TODAY", c.x, c.y - 17);
}
/** An iron railing along x (along "x") or y, from a to b at c, z on top of the ground. */
function drawRailing(ctx: Ctx, along: "x" | "y", c: number, a: number, b: number, l: Light, z = 0) {
  const n = l.night;
  const at = (u: number) => (along === "x" ? iso(u, c) : iso(c, u));
  ctx.strokeStyle = shade("#2d3340", -0.3 * n);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const hgt of [30, 18]) {
    const p = up(at(a), z + hgt),
      q = up(at(b), z + hgt);
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
  }
  ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let u = a; u <= b + 1e-6; u += 0.35) {
    const p = up(at(u), z);
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - 30);
  }
  ctx.stroke();
}
/** A low stone parapet along y at x0..x1 (the road bridge's sides), with end piers. */
function drawParapet(ctx: Ctx, x0: number, x1: number, y0: number, y1: number, l: Light) {
  const n = l.night,
    snow = l.season === "winter";
  const stone = {
    top: lerpRgb(snow ? [242, 246, 250] : [222, 214, 198], [84, 84, 100], n),
    left: lerpRgb([150, 142, 130], [52, 52, 66], n),
    right: lerpRgb([186, 178, 164], [62, 62, 76], n),
  };
  isoBox(ctx, x0, y0, x1, y1, 0, 22, stone);
  for (const y of [y0, y1 - 0.3])
    isoBox(ctx, x0 - 0.05, y, x1 + 0.05, y + 0.3, 0, 32, stone);
}
/** A hedge: a clipped box of leaves. */
function drawHedge(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, h: number, l: Light) {
  const n = l.night,
    s = l.season ?? "summer";
  const base = s === "winter" ? "#7a8a7a" : s === "autumn" ? "#6a8a3a" : "#4f8f45";
  isoBox(ctx, x0, y0, x1, y1, 0, h, {
    top: shade(shade(base, 0.18), -0.5 * n),
    left: shade(shade(base, -0.2), -0.5 * n),
    right: shade(base, -0.5 * n),
  });
  // Leafy bumps along the top edges.
  ctx.fillStyle = shade(shade(base, 0.1), -0.5 * n);
  const len = Math.max(x1 - x0, y1 - y0);
  for (let u = 0.15; u < len; u += 0.3) {
    const p = x1 - x0 > y1 - y0 ? up(iso(x0 + u, y1), h) : up(iso(x1, y0 + u), h);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, Math.PI, 0);
    ctx.fill();
  }
  if (s === "winter") {
    ctx.fillStyle = shade("#f4f7fb", -0.45 * n);
    poly(ctx, [up(iso(x0, y0), h + 2), up(iso(x1, y0), h + 2), up(iso(x1, y1), h + 2), up(iso(x0, y1), h + 2)]);
    ctx.fill();
  }
}
/** An ice-cream cart with a parasol. */
function drawKiosk(ctx: Ctx, x: number, y: number, l: Light) {
  const n = l.night;
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 3, 50, 20, 0.25);
  isoBox(ctx, x - 0.5, y - 0.8, x + 0.5, y + 0.8, 14, 42, {
    top: shade("#f4f1ea", -0.5 * n),
    left: shade("#ef7fa6", -0.5 * n),
    right: shade("#ffb3c8", -0.5 * n),
  });
  onWall(ctx, "y", x + 0.5, y + 0.8, () => {
    const w = 1.6 * TILE;
    ctx.fillStyle = shade("#ffffff", -0.5 * n);
    ctx.fillRect(8, -48, w - 16, 14);
    ctx.fillStyle = shade("#ef7fa6", -0.4 * n);
    ctx.font = "800 10px 'Barlow Condensed', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ICE CREAM", w / 2, -37.5);
    ctx.fillStyle = "#1c1d22";
    for (const wx of [14, w - 14]) {
      ctx.beginPath();
      ctx.arc(wx, -6, 8, 0, 7);
      ctx.fill();
    }
  });
  ctx.fillStyle = shade("#e8e2d6", -0.4 * n);
  ctx.fillRect(c.x - 1.5, c.y - 120, 3, 64);
  const cols = ["#ef7fa6", "#fff4f8"];
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI,
      a1 = ((i + 1) / 8) * Math.PI;
    ctx.fillStyle = shade(cols[i % 2], -0.45 * n);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 132);
    ctx.lineTo(c.x - Math.cos(a0) * 48, c.y - 108 + Math.sin(a0) * 6);
    ctx.lineTo(c.x - Math.cos(a1) * 48, c.y - 108 + Math.sin(a1) * 6);
    ctx.fill();
  }
}
/** A slide and a swing set. */
function drawPlayground(ctx: Ctx, x: number, y: number, l: Light) {
  const n = l.night;
  const red = shade("#e2453a", -0.5 * n),
    yel = shade("#f2c14e", -0.5 * n),
    blue = shade("#3d8fd1", -0.5 * n);
  // The swings: an A-frame along x.
  const a = iso(x - 1.2, y - 0.6),
    b = iso(x + 0.6, y - 0.6);
  ctx.strokeStyle = blue;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (const p of [a, b]) {
    ctx.moveTo(p.x - 10, p.y);
    ctx.lineTo(p.x, p.y - 90);
    ctx.lineTo(p.x + 10, p.y);
  }
  ctx.moveTo(a.x, a.y - 90);
  ctx.lineTo(b.x, b.y - 90);
  ctx.stroke();
  ctx.strokeStyle = shade("#5a6070", -0.4 * n);
  ctx.lineWidth = 1.2;
  for (const f of [0.3, 0.7]) {
    const px = a.x + (b.x - a.x) * f,
      py = a.y + (b.y - a.y) * f;
    const sw = Math.sin(l.t * 1.6 + f * 4) * 6;
    ctx.beginPath();
    ctx.moveTo(px - 6, py - 90);
    ctx.lineTo(px - 6 + sw, py - 34);
    ctx.moveTo(px + 6, py - 90);
    ctx.lineTo(px + 6 + sw, py - 34);
    ctx.stroke();
    ctx.fillStyle = red;
    ctx.fillRect(px - 8 + sw, py - 36, 16, 4);
  }
  // The slide: a ladder tower and a chute toward +y.
  isoBox(ctx, x - 0.3, y + 0.3, x + 0.3, y + 0.9, 0, 50, {
    top: yel,
    left: shade("#c9a03e", -0.5 * n),
    right: yel,
  });
  ctx.fillStyle = red;
  poly(ctx, [up(iso(x - 0.3, y + 0.3), 74), up(iso(x + 0.3, y + 0.3), 74), up(iso(x + 0.3, y + 0.9), 74), up(iso(x, y + 0.6), 92)]);
  ctx.fill();
  ctx.fillStyle = shade("#3d8fd1", -0.4 * n);
  poly(ctx, [up(iso(x - 0.2, y + 0.9), 50), up(iso(x + 0.2, y + 0.9), 50), up(iso(x + 0.2, y + 2.2), 6), up(iso(x - 0.2, y + 2.2), 6)]);
  ctx.fill();
  ctx.fillStyle = shade("#2f6fb1", -0.4 * n);
  poly(ctx, [up(iso(x + 0.2, y + 0.9), 50), up(iso(x + 0.2, y + 2.2), 6), up(iso(x + 0.2, y + 2.2), 0), up(iso(x + 0.2, y + 0.9), 44)]);
  ctx.fill();
  ctx.strokeStyle = yel;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const px of [x - 0.3, x + 0.3]) {
    const p = iso(px, y + 0.3);
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - 74);
  }
  ctx.stroke();
}
/** A picnic table. */
function drawPicnic(ctx: Ctx, x: number, y: number, l: Light) {
  const n = l.night;
  const wood = {
    top: shade("#c08a52", -0.5 * n),
    left: shade("#8a5a30", -0.5 * n),
    right: shade("#9a6a3a", -0.5 * n),
  };
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 46, 18, 0.22);
  for (const dy of [-0.55, 0.55]) isoBox(ctx, x - 0.8, y + dy - 0.12, x + 0.8, y + dy + 0.12, 14, 4, wood);
  ctx.fillStyle = wood.left;
  for (const dx of [-0.6, 0.6]) {
    const p = iso(x + dx, y);
    ctx.fillRect(p.x - 2, p.y - 26, 4, 26);
  }
  isoBox(ctx, x - 0.85, y - 0.3, x + 0.85, y + 0.3, 26, 4, wood);
}

/* ───────────── the fountain ───────────── */

function drawFountain(ctx: Ctx, l: Light) {
  const n = l.night,
    frozen = l.season === "winter";
  const P = plaza();
  const c = iso(P.x, P.y);
  const rx = 74,
    ry = 37,
    H = 18;
  softShadow(ctx, c.x, c.y + 4, rx + 12, ry + 8, 0.2);
  const stone = lerpRgb([222, 214, 200], [74, 74, 90], n),
    stoneDark = lerpRgb([172, 164, 150], [52, 52, 66], n);
  // The basin's wall (its near half shows), with panels.
  ctx.fillStyle = stoneDark;
  ctx.beginPath();
  ctx.moveTo(c.x - rx, c.y - H);
  ctx.lineTo(c.x - rx, c.y);
  ctx.ellipse(c.x, c.y, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(c.x + rx, c.y - H);
  ctx.ellipse(c.x, c.y - H, rx, ry, 0, 0, Math.PI, false);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let a = 0.2; a < Math.PI; a += 0.32) {
    const px = c.x + Math.cos(a) * rx,
      py = c.y + Math.sin(a) * ry;
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - H);
  }
  ctx.stroke();
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - H, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // The water (or ice) in the basin.
  ctx.fillStyle = frozen ? lerpRgb([220, 236, 246], [80, 96, 124], n) : lerpRgb([96, 176, 214], [30, 52, 90], n);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - H, rx - 8, ry - 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Coins glinting on the bottom.
  if (!frozen)
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = `rgba(255,214,110,${0.6 - n * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(c.x - 40 + hash(i) * 80, c.y - H - 14 + hash(i + 9) * 26, 2, 1, 0, 0, 7);
      ctx.fill();
    }
  // The pedestal, the upper bowl and a finial.
  const col = (y0: number, y1: number, w: number) => {
    ctx.fillStyle = stoneDark;
    ctx.fillRect(c.x - w, c.y - y1, w * 2, y1 - y0);
    ctx.fillStyle = stone;
    ctx.fillRect(c.x - w * 0.4, c.y - y1, w * 0.6, y1 - y0);
  };
  col(H, H + 40, 7);
  ctx.fillStyle = stoneDark;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - H - 42, 30, 12, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - H - 44, 30, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = frozen ? lerpRgb([226, 240, 248], [86, 100, 128], n) : lerpRgb([110, 186, 226], [34, 58, 96], n);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - H - 44, 24, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  col(H + 44, H + 62, 3.5);
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.arc(c.x, c.y - H - 64, 6, 0, Math.PI * 2);
  ctx.fill();
  if (frozen) {
    ctx.fillStyle = lerpRgb([236, 246, 252], [100, 116, 140], n);
    for (let i = -4; i <= 4; i++) {
      const x = c.x + i * 6;
      ctx.beginPath();
      ctx.moveTo(x - 2, c.y - H - 40);
      ctx.lineTo(x, c.y - H - 28 + Math.abs(i));
      ctx.lineTo(x + 2, c.y - H - 40);
      ctx.fill();
    }
  }
}
/** The fountain's running water (live): jets, the falling sheet, ripples. */
export function drawFountainWater(ctx: Ctx, l: Light, low: boolean) {
  if (l.season === "winter") return;
  const P = plaza();
  const c = iso(P.x, P.y);
  const t = l.t;
  const a = 0.8 - l.night * 0.3;
  const H = 18;
  ctx.strokeStyle = `rgba(225,242,255,${a})`;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  // Jets from the finial into the bowl.
  for (let i = 0; i < 6; i++) {
    const dir = i < 3 ? -1 : 1,
      far = 8 + (i % 3) * 6;
    ctx.moveTo(c.x, c.y - H - 70);
    ctx.quadraticCurveTo(c.x + dir * far * 0.6, c.y - H - 92 - (i % 3) * 3, c.x + dir * far, c.y - H - 48);
  }
  // The sheet falling from the bowl's rim into the basin.
  for (let i = -5; i <= 5; i++) {
    const x = c.x + i * 5.4;
    const wob = Math.sin(t * 6 + i) * 0.9;
    ctx.moveTo(x, c.y - H - 40 + Math.abs(i) * 0.7);
    ctx.lineTo(x + i * 1.8 + wob, c.y - H - 6);
  }
  ctx.stroke();
  if (low) return;
  for (let k = 0; k < 3; k++) {
    const f = (t * 0.45 + k / 3) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.4 * (1 - f)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - H - 2, 22 + f * 36, 7 + f * 15, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/* ───────────── the footbridge ───────────── */

function drawFootbridge(ctx: Ctx, l: Light) {
  const n = l.night,
    snow = l.season === "winter";
  const c = canal();
  const fx = footX();
  const fx0 = fx - 0.7,
    fx1 = fx + 0.7,
    ya = c.y0 - 0.6,
    yb = c.y1 + 0.6;
  const N = 14;
  const g = (i: number) => ya + ((yb - ya) * i) / N;
  // The side toward the viewer: from the deck's edge down to the water (or the bank).
  ctx.fillStyle = lerpRgb([196, 186, 168], [64, 64, 78], n);
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const p = up(iso(fx1, g(i)), footLift(fx, g(i)));
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  for (let i = N; i >= 0; i--) {
    const gy = g(i);
    const over = gy > c.y0 && gy < c.y1;
    const p = iso(fx1, gy);
    ctx.lineTo(p.x, p.y + (over ? WATER : 0));
  }
  ctx.fill();
  // Its arch over the water.
  onWall(ctx, "y", fx1, c.y1, () => {
    const w = (c.y1 - c.y0) * TILE;
    ctx.fillStyle = lerpRgb([40, 64, 84], [12, 16, 30], n);
    ctx.beginPath();
    ctx.ellipse(w / 2, WATER, w * 0.42, WATER + 8, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = lerpRgb([160, 150, 134], [52, 52, 66], n);
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  // The deck: planks over the arch.
  for (let i = 0; i < N; i++) {
    const z0 = footLift(fx, g(i) + 1e-6),
      z1 = footLift(fx, g(i + 1) - 1e-6);
    ctx.fillStyle = snow
      ? lerpRgb([240, 244, 250], [86, 90, 110], n)
      : lerpRgb(i % 2 ? [182, 128, 80] : [164, 112, 68], [60, 46, 44], n);
    poly(ctx, [up(iso(fx0, g(i)), z0), up(iso(fx1, g(i)), z0), up(iso(fx1, g(i + 1)), z1), up(iso(fx0, g(i + 1)), z1)]);
    ctx.fill();
  }
  footRail(ctx, fx0, ya, yb, n, 0, N, N);
}
function footRail(ctx: Ctx, gx: number, ya: number, yb: number, n: number, i0: number, i1: number, N: number) {
  const fx = footX();
  const col = lerpRgb([126, 82, 48], [44, 34, 34], n);
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    const gy = ya + ((yb - ya) * i) / N;
    const p = up(iso(gx, gy), footLift(fx, gy) + 24);
    if (i === i0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  for (let i = i0; i <= i1; i += 2) {
    const gy = ya + ((yb - ya) * i) / N;
    const p = up(iso(gx, gy), footLift(fx, gy));
    ctx.fillRect(p.x - 1.5, p.y - 24, 3, 24);
  }
}

/* ───────────── where everything stands ───────────── */

/** Trees: (grid x, grid y, size, kind: 0 round, 1 pine, 2 blossom). */
export function trees(): [number, number, number, number][] {
  const C = R.cols,
    Rw = R.rows;
  const c = canal();
  const P = plaza();
  const out: [number, number, number, number][] = [
    // Street trees on the far sidewalk.
    [ROAD0 - 0.55, -9.5, 1, 0],
    [ROAD0 - 0.55, -2.4, 1, 2],
    [ROAD0 - 0.55, 3.2, 1, 0],
    [ROAD0 - 0.55, Rw + 3.2, 1, 2],
    [ROAD0 - 0.55, Rw + 13.5, 1, 0],
    [ROAD0 - 0.55, Rw + 20, 1, 2],
    // The pocket park behind.
    [1.2, -9.6, 1.15, 0],
    [4.2, -10.2, 1.05, 2],
    [2.6, -12.6, 1.1, 1],
    [6.4, -13.4, 1.2, 0],
    [-0.2, -14.8, 1.1, 0],
    [3.6, -16.4, 1.2, 1],
    [8.6, -16.8, 1.05, 0],
    // Gardens behind the houses.
    ...Array.from({ length: 7 }, (_, i): [number, number, number, number] => [
      HOUSE_X0 + 2 + i * 4.2 + hash(i) * 1.2,
      HOUSES - 4.9,
      0.95 + hash(i + 5) * 0.25,
      i % 3 === 1 ? 2 : 0,
    ]),
    // Around the square and in the park.
    [C + 2.4, -1.0, 1.1, 2],
    [C + 7.9, -1.1, 1.2, 0],
    [C + 8.4, 5.6, 1, 1],
    [C + 2.5, 7.3, 1.05, 0],
    [C + 5.2, Rw + 1.0, 1.1, 2],
    // The promenade, in planters.
    [0.9, Rw + 2.8, 0.95, 0],
    [footX() + 2.6, Rw + 2.8, 0.95, 2],
    [C - 1.6, Rw + 2.8, 0.95, 0],
    // The far bank.
    ...Array.from({ length: 9 }, (_, i): [number, number, number, number] => [
      -0.6 + i * 3.6 + hash(i + 30) * 1.0,
      c.y1 + 3.6 + hash(i + 40) * 1.2,
      1 + hash(i + 50) * 0.25,
      i % 4 === 2 ? 2 : i % 4 === 3 ? 1 : 0,
    ]),
    ...Array.from({ length: 8 }, (_, i): [number, number, number, number] => [
      1.2 + i * 4 + hash(i + 60) * 1.4,
      c.y1 + 7.4 + hash(i + 70) * 1.6,
      1.05 + hash(i + 80) * 0.3,
      i % 3 === 0 ? 1 : 0,
    ]),
  ];
  // The park east of the square: clumps, clear of the paths.
  const roomFree = (t: [number, number, number, number]) => !hidesRoom(t[0], t[1], t[2]);
  for (let i = 0; i < 26; i++) {
    const x = C + 11 + hash(i + 100) * 16,
      y = -1.6 + hash(i + 200) * (Rw + 5);
    if (Math.abs(y - (P.y + 2.7)) < 1.3 || Math.abs(y - -1.45) < 1.2) continue;
    if (Math.abs(x - (C + 15)) < 2.2 && Math.abs(y - 6) < 2.4) continue;
    out.push([x, y, 1 + hash(i + 300) * 0.3, i % 5 === 0 ? 1 : i % 4 === 0 ? 2 : 0]);
  }
  // Nothing tall in front of the bistro hides it.
  return out.filter(roomFree);
}
/** A tree in front of the room whose crown would cover part of it. */
export function hidesRoom(x: number, y: number, s: number): boolean {
  if (!(y > R.rows - 0.5 || x > R.cols - 0.5)) return false;
  const c = iso(x, y);
  const l = ROOM.left,
    b = ROOM.bottom,
    r = ROOM.right;
  const crown = { x0: c.x - 62 * s, x1: c.x + 62 * s, y0: c.y - 150 * s, y1: c.y - 30 * s };
  // The room's front edges (its slab's foot) from the left corner to the right.
  const below = (px: number) =>
    px <= b.x ? l.y + 40 + ((b.y - l.y) * (px - l.x)) / (b.x - l.x) : b.y + 40 + ((r.y - b.y) * (px - b.x)) / (r.x - b.x);
  if (crown.x1 < l.x - 16 || crown.x0 > r.x + 16) return false;
  const xs = [Math.max(crown.x0, l.x), Math.min(crown.x1, r.x), Math.max(Math.min(c.x, r.x), l.x)];
  return xs.some((px) => crown.y0 < below(px));
}
/** Street lamps: [x, y, arm (screen x), park style]. */
export function lampSpots(): [number, number, number, boolean][] {
  const C = R.cols,
    Rw = R.rows;
  const c = canal();
  const P = plaza();
  const out: [number, number, number, boolean][] = [];
  for (const y of [-12, -1.2, 3.6, Rw - 0.6, Rw + 12, Rw + 19])
    out.push([ROAD1 + 0.3, y, -1, false]);
  for (const y of [-12.5, -5.5, 0.6, 10.4, Rw + 4.4, Rw + 12.5, Rw + 19.5])
    out.push([ROAD0 - 0.3, y, 1, false]);
  for (let x = HOUSE_X0 + 1; x < C + 26; x += 6) out.push([x, HOUSES + 0.35, 1, false]);
  for (const x of [1.8, footX() + 1.4, C - 0.8, C + 6, C + 12])
    out.push([x, c.y0 - 0.45, 1, true]);
  for (const x of [1.6, footX() - 1.6, C + 1.5, C + 8, C + 14])
    out.push([x, c.y1 + 0.55, 1, true]);
  out.push([P.x - 2.5, P.y + 1.3, 1, true], [P.x + 1.3, P.y - 2.5, 1, true]);
  return out;
}

/** Every prop, the buildings first. */
export function props(special: () => string = () => ""): Prop[] {
  const C = R.cols,
    Rw = R.rows;
  const c = canal();
  const P = plaza();
  const out: Prop[] = [];
  const at = (
    id: string,
    x: number,
    y: number,
    r: number,
    h: number,
    paint: Prop["paint"],
    extra: Partial<Prop> = {},
  ) => out.push({ id, x0: x - r, y0: y - r, x1: x + r, y1: y + r, h, paint, ...extra });
  for (const b of buildings())
    out.push({
      id: `b${b.kind}${b.k}`,
      x0: b.x0,
      y0: b.y0,
      x1: b.x1,
      y1: b.y1,
      h: topOf(b),
      sw: b.kind === "shop" ? 50 : 0,
      paint: (ctx, l) => drawBuilding(ctx, b, l),
      building: b,
    });
  for (const [i, [x, y, s, k]] of trees().entries())
    at(`t${i}`, x, y, 0.3, 160 * s, (ctx, l) => drawTree(ctx, x, y, s, k, l), {
      sw: 62 * s,
      tree: true,
    });
  for (const [i, [x, y, arm, park]] of lampSpots().entries())
    at(`l${i}`, x, y, 0.12, park ? 140 : 168, (ctx, l) => drawLamp(ctx, x, y, l, arm, park), { sw: 30 });
  for (const [i, b] of benches().entries())
    out.push({
      id: `bench${i}`,
      ...(b.along === "y"
        ? { x0: b.x - 0.26, x1: b.x + 0.26, y0: b.y - 0.72, y1: b.y + 0.72 }
        : { x0: b.x - 0.72, x1: b.x + 0.72, y0: b.y - 0.26, y1: b.y + 0.26 }),
      h: 46,
      paint: (ctx, l) => drawBench(ctx, b.x, b.y, b.along, l),
    });
  // Small things along the sidewalks.
  const Z = zebraY();
  at("bin0", ROAD1 + 0.35, 1.4, 0.15, 40, (ctx, l) => drawBin(ctx, ROAD1 + 0.35, 1.4, l));
  at("bin1", ROAD0 - 0.35, 5.0, 0.15, 40, (ctx, l) => drawBin(ctx, ROAD0 - 0.35, 5.0, l));
  at("bin2", C + 1.35, 2.0, 0.15, 40, (ctx, l) => drawBin(ctx, C + 1.35, 2.0, l));
  at("bin3", 5, c.y0 - 0.5, 0.15, 40, (ctx, l) => drawBin(ctx, 5, c.y0 - 0.5, l));
  at("hyd0", ROAD1 + 0.35, -8.6, 0.12, 30, (ctx, l) => drawHydrant(ctx, ROAD1 + 0.35, -8.6, l));
  at("hyd1", ROAD0 - 0.35, Rw + 1.6, 0.12, 30, (ctx, l) => drawHydrant(ctx, ROAD0 - 0.35, Rw + 1.6, l));
  at("post", ROAD0 - 0.4, -7.6, 0.18, 52, (ctx, l) => drawPillarBox(ctx, ROAD0 - 0.4, -7.6, l));
  at("ads", ROAD0 - 0.55, 13.4 + Rw - 9, 0.32, 140, (ctx, l) => drawAdColumn(ctx, ROAD0 - 0.55, 13.4 + Rw - 9, l), { sw: 22 });
  for (const [k, x] of [ROAD1 + 0.3, ROAD0 - 0.3].entries()) {
    for (const dy of [-ZEBRA_HALF - 0.3, ZEBRA_HALF + 0.3])
      at(`bol${k}${dy}`, x, Z + dy, 0.08, 28, (ctx, l) => drawBollard(ctx, x, Z + dy, l));
    at(`zs${k}`, x, Z - ZEBRA_HALF - 0.75, 0.1, 146, (ctx, l) => drawZebraSign(ctx, x, Z - ZEBRA_HALF - 0.75, l), { sw: 14 });
  }
  at("rack", C + 1.2, 2.9, 0.4, 32, (ctx, l) => drawBikeRack(ctx, C + 1.2, 2.9, l), { sw: 28 });
  // The door's sandwich board and planters.
  at("board", WALK - 1.0, DOOR.y - 1.2, 0.22, 52, (ctx, l) => drawDoorProps(ctx, l, special()));
  for (const gy of [DOOR.y - 2.0, DOOR.y + 1.0])
    at(`dp${gy}`, WALK - 0.4, gy, 0.32, 44, (ctx, l) => drawPlanter(ctx, WALK - 0.4, gy, l));
  // Planters along the promenade and at the apron's corners.
  for (const x of [3.4, footX() - 2.2, C - 3.6])
    at(`pp${x}`, x, Rw + 2.8, 0.36, 46, (ctx, l) => drawPlanter(ctx, x, Rw + 2.8, l, true), { sw: 22 });
  for (const [x, y] of [
    [C + 1.2, Rw + 1.0],
    [C + 1.2, -2.0],
  ])
    at(`ap${x}${y}`, x, y, 0.32, 44, (ctx, l) => drawPlanter(ctx, x, y, l));
  // The bus shelter.
  out.push({ id: "shelter", ...shelter(), h: 140, sw: 70, paint: (ctx, l) => drawShelter(ctx, l), live: true });
  // The road bridge's parapets and the canal's railings, in short lengths.
  const by0 = c.y0 - 0.35,
    by1 = c.y1 + 0.35;
  out.push({
    id: "parNear",
    x0: BRIDGE.x1 - 0.28,
    x1: BRIDGE.x1,
    y0: by0,
    y1: by1,
    h: 34,
    paint: (ctx, l) => drawParapet(ctx, BRIDGE.x1 - 0.28, BRIDGE.x1, by0, by1, l),
  });
  out.push({
    id: "parFar",
    x0: BRIDGE.x0,
    x1: BRIDGE.x0 + 0.28,
    y0: by0,
    y1: by1,
    h: 34,
    paint: (ctx, l) => drawParapet(ctx, BRIDGE.x0, BRIDGE.x0 + 0.28, by0, by1, l),
  });
  const fx = footX();
  for (let x = BRIDGE.x1 + 0.2; x < C + 30; x += 3) {
    const a = x,
      b = Math.min(x + 3, C + 30);
    for (const [k, cy] of [
      ["n", c.y0 - 0.12],
      ["f", c.y1 + 0.12],
    ] as const) {
      // Gaps where the footbridge lands.
      const segs: [number, number][] =
        a < fx + 0.8 && b > fx - 0.8 ? [[a, fx - 0.8], [fx + 0.8, b]] : [[a, b]];
      for (const [s0, s1] of segs)
        if (s1 - s0 > 0.2)
          out.push({
            id: `rail${k}${s0.toFixed(1)}`,
            x0: s0,
            x1: s1,
            y0: cy - 0.04,
            y1: cy + 0.04,
            h: 32,
            paint: (ctx, l) => drawRailing(ctx, "x", cy, s0, s1, l),
          });
    }
  }
  // The footbridge: deck, its side and far railing are walked over (baked);
  // the near railing is in front of whoever crosses.
  out.push({
    id: "foot",
    x0: fx - 0.7,
    x1: fx + 0.7,
    y0: c.y0 - 0.6,
    y1: c.y1 + 0.6,
    h: 40,
    paint: (ctx, l) => drawFootbridge(ctx, l),
    bake: true,
  });
  const N = 14,
    ya = c.y0 - 0.6,
    yb = c.y1 + 0.6;
  for (let i = 0; i < N; i += 2) {
    const g0 = ya + ((yb - ya) * i) / N,
      g1 = ya + ((yb - ya) * (i + 2)) / N;
    out.push({
      id: `fr${i}`,
      x0: fx + 0.66,
      x1: fx + 0.74,
      y0: g0,
      y1: g1,
      h: 44,
      paint: (ctx, l) => footRail(ctx, fx + 0.7, ya, yb, l.night, i, i + 2, N),
      live: true,
    });
  }
  // The fountain (its water is drawn live on top), a kiosk, a playground, a picnic table.
  out.push({
    id: "fountain",
    x0: P.x - 1.15,
    x1: P.x + 1.15,
    y0: P.y - 1.15,
    y1: P.y + 1.15,
    h: 100,
    paint: (ctx, l) => drawFountain(ctx, l),
    after: (ctx, l, low) => drawFountainWater(ctx, l, low),
    live: true,
  });
  at("kiosk", C + 9.6, P.y + 4.4, 0.8, 140, (ctx, l) => drawKiosk(ctx, C + 9.6, P.y + 4.4, l), { sw: 50 });
  at("play", C + 15, 5.4, 1.3, 96, (ctx, l) => drawPlayground(ctx, C + 15, 5.4, l), { sw: 100 });
  at("picnic", C + 13.2, 9.3, 0.85, 34, (ctx, l) => drawPicnic(ctx, C + 13.2, 9.3, l), { sw: 44 });
  at("picnic2", 4.6, c.y1 + 2.7, 0.85, 34, (ctx, l) => drawPicnic(ctx, 4.6, c.y1 + 2.7, l), { sw: 44 });
  // Hedges around the pocket park and the gardens.
  out.push({
    id: "hedge0",
    x0: -0.4,
    x1: HOUSE_X0 - 0.2,
    y0: HOUSES - 0.4,
    y1: HOUSES - 0.1,
    h: 26,
    paint: (ctx, l) => drawHedge(ctx, -0.4, HOUSES - 0.4, HOUSE_X0 - 0.2, HOUSES - 0.1, 26, l),
  });
  // Parked cars along the back street's far curb.
  const parked: [number, number, string][] = [
    [1.6, 0, "#3d8fd1"],
    [5.0, 3, "#f4f1ea"],
    [9.6, 0, "#e2453a"],
    [13.0, 1, "#f4f1ea"],
    [17.2, 0, "#4fb36b"],
    [20.6, 3, "#ff9a5b"],
    [24.4, 2, "#f2c14e"],
  ];
  for (const [i, [x, kind, col]] of parked.entries()) {
    const pose: Pose = { x, y: BACK.y0 + 0.75, along: "x", dir: i % 2 ? -1 : 1 };
    out.push({
      id: `pc${i}`,
      ...carBox(pose, kind),
      h: CAR_SIZE[kind].h,
      paint: (ctx, l) => drawCar(ctx, pose, kind, col, l),
    });
  }
  return out;
}

/* ───────────── which props may be baked ───────────── */

/** Where moving things can be, as footprints (sampled along their ways). */
export function moverSamples(): Drawable[] {
  const out: Drawable[] = [];
  const none = () => {};
  const walker = (x: number, y: number, h = 100) =>
    out.push({ x0: x - 0.22, y0: y - 0.22, x1: x + 0.22, y1: y + 0.22, h, sw: 34, z: footLift(x, y), draw: none });
  const along = (pts: [number, number][], h?: number) => {
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1],
        [bx, by] = pts[i];
      const d = Math.hypot(bx - ax, by - ay);
      for (let u = 0; u <= d; u += 0.3) walker(ax + ((bx - ax) * u) / d, ay + ((by - ay) * u) / d, h);
    }
  };
  for (const r of routes()) along(r.pts);
  for (const r of bikeRoutes()) along(r, 116);
  for (const b of benches()) walker(b.x, b.y, 110);
  const w = waitSpot();
  walker(w.x, w.y);
  const ends = roadEnds();
  for (let y = ends.y0; y <= ends.y1; y += 0.5)
    for (const v of [1, -1]) {
      const bx = carBox({ x: laneOf(v), y, along: "y", dir: v }, 1);
      out.push({ ...bx, h: 96, draw: none });
    }
  for (let y = ends.y0; y <= ends.y1; y += 0.5)
    out.push({
      x0: laneOf(-1) - 0.82,
      x1: laneOf(-1) + 0.82,
      y0: y - BUS_LEN / 2,
      y1: y + BUS_LEN / 2,
      h: 130,
      draw: none,
    });
  return out;
}
type Poly = Pt[];
/** The outline of a box standing on the ground (a hexagon on screen). */
function silhouette(d: { x0: number; y0: number; x1: number; y1: number; h: number; z?: number }): Poly {
  const z = d.z ?? 0;
  const a = iso(d.x0, d.y1),
    b = iso(d.x1, d.y1),
    c = iso(d.x1, d.y0),
    t = iso(d.x0, d.y0);
  return [
    { x: a.x, y: a.y - z },
    { x: b.x, y: b.y - z },
    { x: c.x, y: c.y - z },
    { x: c.x, y: c.y - z - d.h },
    { x: t.x, y: t.y - z - d.h },
    { x: a.x, y: a.y - z - d.h },
  ];
}
const rectPoly = (r: ScreenBox): Poly => [
  { x: r.x0, y: r.y0 },
  { x: r.x1, y: r.y0 },
  { x: r.x1, y: r.y1 },
  { x: r.x0, y: r.y1 },
];
/** Do two convex outlines overlap (separating axes)? */
function convexMeet(a: Poly, b: Poly): boolean {
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
      if (a1 <= b0 + 0.5 || b1 <= a0 + 0.5) return false;
    }
  return true;
}
/** The prop's outline on screen: its box, or (trees, wide things) its screen rectangle. */
export function outline(p: Prop): Poly {
  return p.sw && !p.building ? rectPoly(screenBox({ ...p, draw: () => {} })) : silhouette(p);
}
/** Would this prop, drawn under everything that moves, wrongly show behind some of it? */
export function coversMovers(p: Prop, samples = moverSamples()): boolean {
  const box = screenBox({ ...p, draw: () => {} });
  const ol = outline(p);
  const pd: Drawable = { ...p, draw: () => {} };
  for (const s of samples) {
    const sb = screenBox(s);
    if (sb.x1 <= box.x0 || sb.x0 >= box.x1 || sb.y1 <= box.y0 || sb.y0 >= box.y1) continue;
    if (order(s, pd) >= 0) continue;
    if (convexMeet(ol, rectPoly(sb))) return true;
  }
  return false;
}
/** The props split: baked with the ground, or live and sorted with what moves. */
export function splitProps(list: Prop[]): { baked: Prop[]; live: Prop[] } {
  const samples = moverSamples();
  const baked: Prop[] = [],
    live: Prop[] = [];
  for (const p of list) {
    const isLive = p.live || (!p.bake && coversMovers(p, samples));
    (isLive ? live : baked).push(p);
  }
  return { baked, live };
}

/* ───────────── live props from cached pictures ───────────── */

/** Draw a live prop from its cached picture; trees lean a little (`sway`). */
export function drawPropCached(ctx: Ctx, p: Prop, l: Light, sway = 0) {
  const foot = iso((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2);
  const b = screenBox({ ...p, draw: () => {} });
  picture(
    ctx,
    p.id,
    lightKey(l),
    { x0: b.x0 - foot.x, y0: b.y0 - foot.y, x1: b.x1 - foot.x, y1: b.y1 - foot.y + 20 },
    (g) => {
      g.translate(-foot.x, -foot.y);
      // Things whose picture moves (the swings) are drawn at a still moment.
      p.paint(g, { ...l, t: 0 });
    },
    foot.x,
    foot.y,
    sway,
  );
}
export { tickPics };
/** Lamps' light at night. */
export function lampGlows(): Glow[] {
  const out: Glow[] = [];
  for (const [x, y, arm, park] of lampSpots()) {
    const c = iso(x, y);
    if (park) {
      out.push([c.x, c.y - 118, 90, "255,215,150", 0.38]);
      out.push([c.x, c.y - 6, 60, "255,200,140", 0.2]);
    } else {
      out.push([c.x + arm * 28, c.y - 152, 120, "255,215,150", 0.4]);
      out.push([c.x + arm * 28, c.y - 10, 80, "255,200,140", 0.25]);
    }
  }
  return out;
}
