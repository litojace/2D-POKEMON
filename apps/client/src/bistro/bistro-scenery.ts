/*
 * Element Bistro (demo): the world around the restaurant. A street corner
 * on a summer evening or a bright noon, following the device clock: sky,
 * hills and a far skyline on a level horizon, grass, a street with cars,
 * sidewalks with lamps, houses and trees across the road, and a sign on the
 * roof. World units, the same isometric grid as bistro-art.ts.
 */
import { DOOR } from "./bistro-model";
import {
  R,
  WALL_H,
  iso,
  isoBox,
  shade,
  softShadow,
  skyColours,
  type Light,
} from "./bistro-art";

type Ctx = CanvasRenderingContext2D;
type Pt = { x: number; y: number };
/** The level horizon (world y): the sky above, the ground below. */
export const HORIZON = -150;
/** The road on the far side of the door: x from ROAD0 to ROAD1, along y. */
const ROAD0 = -5.6,
  ROAD1 = -3.3;
const WALK = -0.5; // the building's left face
const FAR = 4000;

const lerpRgb = (a: number[], b: number[], f: number) =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(",")})`;
function poly(ctx: Ctx, pts: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}
/** A ground quad over grid span [x0, x1] × [y0, y1]. */
function quad(ctx: Ctx, x0: number, y0: number, x1: number, y1: number) {
  poly(ctx, [iso(x0, y0), iso(x1, y0), iso(x1, y1), iso(x0, y1)]);
}
const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

/* ───────────── sky ───────────── */

export function drawSky(ctx: Ctx, l: Light) {
  const [top, bot] = skyColours(l);
  const g = ctx.createLinearGradient(0, HORIZON - 520, 0, HORIZON);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = top;
  ctx.fillRect(-FAR, HORIZON - FAR, FAR * 2, FAR - 520);
  ctx.fillStyle = g;
  ctx.fillRect(-FAR, HORIZON - 521, FAR * 2, 522);
  // The sun by day (low and warm at golden hour), the moon and stars at night.
  const day = 1 - l.night;
  if (day > 0.05) {
    const sx = 760,
      sy = HORIZON - 230 + l.gold * 150;
    const r = 34;
    const halo = ctx.createRadialGradient(sx, sy, r * 0.6, sx, sy, r * 5);
    halo.addColorStop(0, `rgba(255,240,190,${0.5 * day})`);
    halo.addColorStop(1, "rgba(255,240,190,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(sx - r * 5, sy - r * 5, r * 10, r * 10);
    ctx.fillStyle =
      l.gold > 0.3 ? `rgba(255,190,110,${day})` : `rgba(255,250,225,${day})`;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (l.night > 0.05) {
    for (let i = 0; i < 160; i++) {
      const x = (hash(i) - 0.5) * 3600,
        y = HORIZON - 30 - hash(i + 500) * 700;
      const tw = 0.55 + 0.45 * Math.sin(l.t * (1 + hash(i + 9) * 2) + i);
      ctx.fillStyle = `rgba(255,250,230,${l.night * tw * (0.4 + hash(i + 3) * 0.6)})`;
      const s = 1 + hash(i + 7) * 1.4;
      ctx.fillRect(x, y, s, s);
    }
    const mx = -820,
      my = HORIZON - 250;
    const halo = ctx.createRadialGradient(mx, my, 10, mx, my, 140);
    halo.addColorStop(0, `rgba(220,230,255,${0.35 * l.night})`);
    halo.addColorStop(1, "rgba(220,230,255,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 140, my - 140, 280, 280);
    ctx.fillStyle = `rgba(250,248,235,${l.night})`;
    ctx.beginPath();
    ctx.arc(mx, my, 26, 0, Math.PI * 2);
    ctx.fill();
    // Crescent shadow.
    ctx.fillStyle = lerpRgb([120, 190, 245], [18, 24, 58], l.night);
    ctx.beginPath();
    ctx.arc(mx + 11, my - 6, 23, 0, Math.PI * 2);
    ctx.fill();
  }
}
/** Clouds drifting by day, a few dim ones at night. */
export function drawClouds(ctx: Ctx, l: Light, low: boolean) {
  const a = 0.85 - l.night * 0.6;
  for (let i = 0; i < 9; i++) {
    const speed = 6 + hash(i) * 8;
    const x = ((hash(i + 20) * 4000 + (low ? 0 : l.t * speed)) % 4000) - 2000,
      y = HORIZON - 70 - hash(i + 40) * 260;
    const w = 70 + hash(i + 60) * 90;
    const tint =
      l.gold > 0.3
        ? "255,225,200"
        : l.night > 0.5
          ? "120,130,170"
          : "255,255,255";
    ctx.fillStyle = `rgba(${tint},${a})`;
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.22, 0, 0, Math.PI * 2);
    ctx.ellipse(
      x + w * 0.3,
      y - w * 0.16,
      w * 0.42,
      w * 0.25,
      0,
      0,
      Math.PI * 2,
    );
    ctx.ellipse(
      x - w * 0.32,
      y - w * 0.08,
      w * 0.34,
      w * 0.2,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

/* ───────────── far away: hills and a skyline ───────────── */

function drawFar(ctx: Ctx, l: Light) {
  const n = l.night;
  // A far skyline, hazy blue (lit windows at night).
  const sky = lerpRgb([176, 200, 220], [40, 42, 80], n);
  ctx.fillStyle = sky;
  const blds: [number, number, number][] = [];
  for (let i = 0; i < 70; i++) {
    const x = -2100 + i * 60 + hash(i) * 30;
    const h = 18 + hash(i + 11) * 44 + (Math.abs(x) < 900 ? 16 : 0);
    const w = 30 + hash(i + 23) * 34;
    blds.push([x, w, h]);
    ctx.fillRect(x, HORIZON - h - 14, w, h + 20);
  }
  if (n > 0.3)
    for (const [x, w, h] of blds)
      for (let wy = HORIZON - h - 6; wy < HORIZON - 8; wy += 9)
        for (let wx = x + 4; wx < x + w - 4; wx += 7)
          if (hash(wx * 3 + wy) > 0.6) {
            ctx.fillStyle = `rgba(255,214,140,${(n - 0.3) * 0.9})`;
            ctx.fillRect(wx, wy, 2.5, 3);
          }
  // Two layers of rolling hills.
  const hill = (
    base: number,
    amp: number,
    freq: number,
    seed: number,
    col: string,
  ) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-FAR, HORIZON + 40);
    for (let x = -FAR; x <= FAR; x += 40)
      ctx.lineTo(
        x,
        HORIZON -
          base -
          amp *
            (0.5 + 0.5 * Math.sin(x * freq + seed)) *
            (0.6 + 0.4 * Math.sin(x * freq * 0.37 + seed * 2)),
      );
    ctx.lineTo(FAR, HORIZON + 40);
    ctx.closePath();
    ctx.fill();
  };
  hill(4, 46, 0.004, 1.3, lerpRgb([126, 170, 150], [34, 44, 70], n));
  hill(-6, 30, 0.007, 4.1, lerpRgb([102, 158, 112], [28, 40, 56], n));
}

/* ───────────── the ground: grass, the street, sidewalks ───────────── */

function drawGround(ctx: Ctx, l: Light) {
  const n = l.night;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-FAR, HORIZON, FAR * 2, FAR);
  ctx.clip();
  // Grass, hazier toward the horizon.
  const g = ctx.createLinearGradient(0, HORIZON, 0, HORIZON + 900);
  g.addColorStop(0, lerpRgb([150, 196, 132], [44, 60, 62], n));
  g.addColorStop(0.25, lerpRgb([112, 178, 92], [36, 58, 48], n));
  g.addColorStop(1, lerpRgb([86, 156, 72], [28, 48, 38], n));
  ctx.fillStyle = g;
  ctx.fillRect(-FAR, HORIZON, FAR * 2, FAR);
  // Tufts of grass and flowers (fixed).
  for (let i = 0; i < 260; i++) {
    const gx = -16 + hash(i) * 40,
      gy = -12 + hash(i + 300) * 36;
    if (gx > ROAD0 - 0.5 && gx < R.cols + 1.6 && gy > -2.4 && gy < R.rows + 1.6)
      continue;
    const p = iso(gx, gy);
    if (p.y < HORIZON + 4) continue;
    const flower = hash(i + 77) > 0.82;
    ctx.fillStyle = flower
      ? ["#ffd65b", "#ff8fb1", "#ffffff", "#b49cff"][i % 4]
      : lerpRgb([70, 140, 60], [24, 40, 30], n);
    ctx.globalAlpha = flower ? 1 - n * 0.6 : 0.7;
    if (flower) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(p.x - 3, p.y);
      ctx.lineTo(p.x - 1, p.y - 6);
      ctx.lineTo(p.x, p.y);
      ctx.lineTo(p.x + 2, p.y - 7);
      ctx.lineTo(p.x + 3, p.y);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // Sidewalks around the building and along the road.
  const paving = lerpRgb([214, 204, 186], [78, 76, 90], n);
  const seam = lerpRgb([186, 174, 154], [60, 58, 72], n);
  ctx.fillStyle = paving;
  for (const [x0, y0, x1, y1] of [
    [ROAD1, -40, WALK, 40], // along the road
    [ROAD1, R.rows - 0.5, R.cols + 1.6, R.rows + 1.6], // the front
    [R.cols - 0.5, -2.4, R.cols + 1.6, R.rows + 1.6], // the right side
    [ROAD1, -2.4, R.cols + 1.6, -0.5], // behind
  ]) {
    quad(ctx, x0, y0, x1, y1);
    ctx.fill();
  }
  ctx.strokeStyle = seam;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = -40; y <= 40; y += 0.8) {
    const a = iso(ROAD1, y),
      b = iso(WALK, y);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  for (let x = ROAD1; x <= R.cols + 1.6; x += 0.8) {
    const a = iso(x, R.rows - 0.5),
      b = iso(x, R.rows + 1.6);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  for (let y = -2.4; y <= R.rows + 1.6; y += 0.8) {
    const a = iso(R.cols - 0.5, y),
      b = iso(R.cols + 1.6, y);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  // The doormat path from the door to the curb.
  ctx.fillStyle = lerpRgb([196, 120, 90], [80, 50, 50], n);
  quad(ctx, ROAD1 + 0.2, DOOR.y - 0.42, WALK, DOOR.y + 0.42);
  ctx.fill();
  // The road: asphalt, curbs, a dashed centre line and a zebra crossing.
  ctx.fillStyle = lerpRgb([88, 92, 102], [36, 38, 48], n);
  quad(ctx, ROAD0, -40, ROAD1, 40);
  ctx.fill();
  ctx.fillStyle = lerpRgb([236, 232, 222], [96, 96, 108], n);
  quad(ctx, ROAD1 - 0.08, -40, ROAD1, 40);
  ctx.fill();
  quad(ctx, ROAD0, -40, ROAD0 + 0.08, 40);
  ctx.fill();
  ctx.fillStyle = lerpRgb([255, 226, 120], [130, 120, 80], n);
  const mid = (ROAD0 + ROAD1) / 2;
  for (let y = -40; y < 40; y += 1.2) {
    quad(ctx, mid - 0.04, y, mid + 0.04, y + 0.6);
    ctx.fill();
  }
  ctx.fillStyle = lerpRgb([245, 245, 240], [110, 110, 120], n);
  for (let k = 0; k < 6; k++) {
    const x0 = ROAD0 + 0.15 + k * 0.38;
    quad(ctx, x0, DOOR.y - 0.6, x0 + 0.2, DOOR.y + 0.6);
    ctx.fill();
  }
  ctx.restore();
}

/* ───────────── houses, trees, lamps ───────────── */

function drawHouse(
  ctx: Ctx,
  x: number,
  y: number,
  body: string,
  roof: string,
  l: Light,
) {
  const n = l.night;
  const dim = (c: string) => shade(c, -0.55 * n);
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 6, 120, 50, 0.25);
  const H = 76;
  isoBox(ctx, x - 1, y - 1, x + 1, y + 1, 0, H, {
    top: dim(body),
    left: dim(shade(body, -0.12)),
    right: dim(shade(body, 0.08)),
  });
  // Windows on both faces, warm at night.
  const win =
    n > 0.4 ? `rgba(255,205,120,${0.6 + n * 0.4})` : "rgba(170,210,235,.9)";
  for (const f of [-0.5, 0.4]) {
    // Right face (along y at x + 1).
    const a = iso(x + 1, y + f),
      b = iso(x + 1, y + f + 0.38);
    ctx.fillStyle = win;
    poly(ctx, [
      { x: a.x, y: a.y - 30 },
      { x: b.x, y: b.y - 30 },
      { x: b.x, y: b.y - 56 },
      { x: a.x, y: a.y - 56 },
    ]);
    ctx.fill();
    // Left face (along x at y + 1).
    const p = iso(x + f, y + 1),
      q = iso(x + f + 0.38, y + 1);
    poly(ctx, [
      { x: p.x, y: p.y - 30 },
      { x: q.x, y: q.y - 30 },
      { x: q.x, y: q.y - 56 },
      { x: p.x, y: p.y - 56 },
    ]);
    ctx.fill();
  }
  // A door on the face toward the road.
  const d0 = iso(x + 1, y - 0.1),
    d1 = iso(x + 1, y + 0.25);
  ctx.fillStyle = dim("#6b3d22");
  poly(ctx, [d0, d1, { x: d1.x, y: d1.y - 26 }, { x: d0.x, y: d0.y - 26 }]);
  ctx.fill();
  // A pitched roof, its ridge along x.
  const r = (gx: number, gy: number, h: number) => {
    const p = iso(gx, gy);
    return { x: p.x, y: p.y - h };
  };
  ctx.fillStyle = dim(shade(roof, -0.15));
  poly(ctx, [
    r(x - 1.1, y - 1.1, H),
    r(x + 1.1, y - 1.1, H),
    r(x + 1.1, y, H + 40),
    r(x - 1.1, y, H + 40),
  ]);
  ctx.fill();
  ctx.fillStyle = dim(roof);
  poly(ctx, [
    r(x - 1.1, y + 1.1, H),
    r(x + 1.1, y + 1.1, H),
    r(x + 1.1, y, H + 40),
    r(x - 1.1, y, H + 40),
  ]);
  ctx.fill();
  ctx.fillStyle = dim(shade(body, -0.05));
  poly(ctx, [
    r(x + 1.1, y - 1.1, H),
    r(x + 1.1, y + 1.1, H),
    r(x + 1.1, y, H + 40),
  ]);
  ctx.fill();
  // Chimney.
  isoBox(ctx, x - 0.6, y - 0.6, x - 0.3, y - 0.3, H + 18, 34, {
    top: dim("#5a3a2a"),
    left: dim("#8a5a40"),
    right: dim("#6e4630"),
  });
}
function drawTree(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  kind: number,
  l: Light,
) {
  const n = l.night;
  const c = iso(x, y);
  softShadow(ctx, c.x + 10, c.y + 4, 46 * s, 18 * s, 0.3);
  ctx.fillStyle = shade("#7a4a2a", -0.5 * n);
  ctx.fillRect(c.x - 4 * s, c.y - 40 * s, 8 * s, 40 * s);
  if (kind === 1) {
    // A pine: three stacked cones.
    for (let i = 0; i < 3; i++) {
      const w = (34 - i * 8) * s,
        top = c.y - (60 + i * 26) * s;
      ctx.fillStyle = shade(i % 2 ? "#2f7a4a" : "#3b8e55", -0.55 * n);
      ctx.beginPath();
      ctx.moveTo(c.x, top - 40 * s);
      ctx.lineTo(c.x + w, top + 18 * s);
      ctx.lineTo(c.x - w, top + 18 * s);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }
  // A round leafy tree: clustered puffs, lit from the top right.
  const puffs: [number, number, number][] = [
    [0, -86, 34],
    [-24, -68, 26],
    [24, -66, 28],
    [-10, -110, 24],
    [14, -100, 24],
  ];
  for (const [dx, dy, r] of puffs) {
    const px = c.x + dx * s,
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
    const base = kind === 2 ? "#e78fb0" : "#5fae4f";
    g.addColorStop(0, shade(shade(base, 0.35), -0.55 * n));
    g.addColorStop(1, shade(shade(base, -0.25), -0.55 * n));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, rr, 0, Math.PI * 2);
    ctx.fill();
  }
}
/** Street lamps: (grid x, grid y). */
export const LAMPS: readonly [number, number][] = [
  [ROAD1 + 0.35, 1.5],
  [ROAD1 + 0.35, 5],
  [ROAD1 + 0.35, 10.2],
  [ROAD1 + 0.35, 14.5],
];
function drawLampPost(ctx: Ctx, x: number, y: number, l: Light) {
  const c = iso(x, y);
  softShadow(ctx, c.x, c.y + 2, 12, 5, 0.3);
  ctx.fillStyle = "#2d3340";
  ctx.fillRect(c.x - 2, c.y - 96, 4, 96);
  ctx.fillRect(c.x - 5, c.y - 6, 10, 6);
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - 96);
  ctx.quadraticCurveTo(c.x + 2, c.y - 108, c.x + 12, c.y - 106);
  ctx.strokeStyle = "#2d3340";
  ctx.lineWidth = 3;
  ctx.stroke();
  const on = l.night;
  ctx.fillStyle =
    on > 0.2 ? `rgba(255,${220 + on * 20},${150 + on * 40},1)` : "#d8dde4";
  ctx.beginPath();
  ctx.ellipse(c.x + 12, c.y - 102, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2d3340";
  ctx.beginPath();
  ctx.ellipse(c.x + 12, c.y - 106, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}
/** The sandwich board outside the door. */
function drawSignBoard(ctx: Ctx, l: Light, special: string) {
  const c = iso(WALK - 0.9, DOOR.y - 1.05);
  softShadow(ctx, c.x, c.y + 2, 18, 7, 0.3);
  ctx.fillStyle = "#6b4026";
  poly(ctx, [
    { x: c.x - 14, y: c.y },
    { x: c.x - 9, y: c.y - 40 },
    { x: c.x + 9, y: c.y - 40 },
    { x: c.x + 14, y: c.y },
  ]);
  ctx.fill();
  ctx.fillStyle = "#26382f";
  poly(ctx, [
    { x: c.x - 11, y: c.y - 4 },
    { x: c.x - 7.5, y: c.y - 36 },
    { x: c.x + 7.5, y: c.y - 36 },
    { x: c.x + 11, y: c.y - 4 },
  ]);
  ctx.fill();
  ctx.fillStyle = "#ffd65b";
  ctx.font = "800 7px 'Barlow Condensed', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("OPEN", c.x, c.y - 26);
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = "700 4.5px 'DM Sans', sans-serif";
  ctx.fillText(special.toUpperCase().slice(0, 14), c.x, c.y - 17);
  ctx.fillText("TODAY", c.x, c.y - 11);
  void l;
}
/** Planters by the door and a bench on the sidewalk. */
function drawStreetProps(ctx: Ctx, l: Light) {
  const n = l.night;
  for (const gy of [DOOR.y - 0.62, DOOR.y + 0.62]) {
    const c = iso(WALK - 0.25, gy);
    ctx.fillStyle = shade("#9a5a3a", -0.5 * n);
    ctx.beginPath();
    ctx.roundRect(c.x - 9, c.y - 14, 18, 14, 3);
    ctx.fill();
    ctx.fillStyle = shade("#4f9f45", -0.5 * n);
    ctx.beginPath();
    ctx.arc(c.x - 4, c.y - 18, 7, 0, Math.PI * 2);
    ctx.arc(c.x + 4, c.y - 19, 7, 0, Math.PI * 2);
    ctx.arc(c.x, c.y - 24, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade("#ff7aa8", -0.4 * n);
    ctx.beginPath();
    ctx.arc(c.x + 3, c.y - 24, 2, 0, Math.PI * 2);
    ctx.arc(c.x - 4, c.y - 20, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bench along the road side.
  const bx = WALK - 1.3,
    by = 3.2;
  isoBox(ctx, bx - 0.18, by - 0.55, bx + 0.18, by + 0.55, 12, 4, {
    top: shade("#b0703f", -0.5 * n),
    left: shade("#8a5530", -0.5 * n),
    right: shade("#7a4a28", -0.5 * n),
  });
  isoBox(ctx, bx - 0.24, by - 0.55, bx - 0.18, by + 0.55, 16, 16, {
    top: shade("#b0703f", -0.5 * n),
    left: shade("#8a5530", -0.5 * n),
    right: shade("#9a6038", -0.5 * n),
  });
}

/** Everything that never moves: drawn once per view and time-of-day bucket. */
export function drawSceneryStatic(ctx: Ctx, l: Light, special: string) {
  drawSky(ctx, l);
  drawFar(ctx, l);
  drawGround(ctx, l);
  // Across the road: houses with gardens between them; trees around the block.
  const across: [number, number, string, string][] = [
    [-8.6, -3.5, "#f3d7a6", "#c4553d"],
    [-8.6, 1, "#cfe3f0", "#3d6f9e"],
    [-8.6, 5.6, "#f5e0e0", "#7a4a8a"],
    [-8.6, 10.2, "#e4f0cf", "#5a8a3d"],
  ];
  const trees: [number, number, number, number][] = [
    [-6.6, -1.2, 1, 0],
    [-6.7, 3.3, 0.9, 2],
    [-6.6, 7.9, 1.1, 0],
    [-6.8, 12.5, 1, 1],
    [3, -3.6, 1.1, 0],
    [7.5, -3.4, 1, 1],
    [11.5, -3.2, 1.2, 0],
    [R.cols + 2.6, 0.5, 1.1, 2],
    [R.cols + 2.8, 4.6, 1, 0],
    [-2.4, R.rows + 3.2, 1, 0],
    [R.cols + 1.5, R.rows + 4.6, 1, 2],
  ];
  type D = { d: number; f: () => void };
  const list: D[] = [];
  for (const [x, y, b, r] of across)
    list.push({ d: x + y, f: () => drawHouse(ctx, x, y, b, r, l) });
  for (const [x, y, s, k] of trees)
    list.push({ d: x + y, f: () => drawTree(ctx, x, y, s, k, l) });
  list.sort((a, b) => a.d - b.d);
  for (const it of list) it.f();
  drawStreetProps(ctx, l);
  drawSignBoard(ctx, l, special);
}

/* ───────────── what moves: cars, lamps, birds, fireflies ───────────── */

export interface Car {
  /** Grid y along the road; moves at `v` tiles a second. */
  y: number;
  v: number;
  col: string;
  kind: number;
}
export function updateCars(cars: Car[], dt: number, spawnRoll: number): Car[] {
  for (const c of cars) c.y += c.v * dt;
  const out = cars.filter((c) => c.y > -30 && c.y < 34);
  if (spawnRoll < dt * 0.22 && out.length < 4) {
    const down = Math.random() < 0.5;
    out.push({
      y: down ? -26 : 30,
      v: (down ? 1 : -1) * (2.4 + Math.random() * 1.6),
      col: ["#e2453a", "#3d8fd1", "#f2c14e", "#f4f1ea", "#4fb36b", "#8a5ad1"][
        Math.floor(Math.random() * 6)
      ],
      kind: Math.random() < 0.25 ? 1 : 0,
    });
  }
  return out;
}
/** 0 at the horizon (and beyond it), 1 once the car is well below it. */
export function carFade(car: Car): number {
  const lane = car.v > 0 ? ROAD0 + 0.6 : ROAD1 - 0.6;
  const y = iso(lane, car.y).y;
  return Math.max(0, Math.min(1, (y - HORIZON - 4) / 70));
}
function drawCar(ctx: Ctx, car: Car, l: Light) {
  // Cars going +y keep to the far lane (nearer the houses).
  const lane = car.v > 0 ? ROAD0 + 0.6 : ROAD1 - 0.6;
  const y = car.y;
  const len = car.kind ? 1.25 : 0.95,
    w = 0.32;
  const c = iso(lane, y);
  softShadow(ctx, c.x, c.y + 3, 34, 14, 0.35);
  const body = shade(car.col, -0.45 * l.night);
  // Wheels.
  ctx.fillStyle = "#1c1d22";
  for (const f of [-0.6, 0.6]) {
    const p = iso(lane + w, y + f * len * 0.55);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 4, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  isoBox(
    ctx,
    lane - w,
    y - len / 2,
    lane + w,
    y + len / 2,
    4,
    car.kind ? 26 : 14,
    {
      top: shade(body, 0.15),
      left: shade(body, -0.15),
      right: body,
    },
  );
  if (!car.kind) {
    // The cabin with windows.
    isoBox(
      ctx,
      lane - w * 0.85,
      y - len * 0.22,
      lane + w * 0.85,
      y + len * 0.25,
      18,
      11,
      {
        top: shade(body, 0.2),
        left: l.night > 0.4 ? "rgba(255,210,140,.75)" : "rgba(170,215,240,.95)",
        right: l.night > 0.4 ? "rgba(255,200,130,.6)" : "rgba(140,190,225,.95)",
      },
    );
  } else {
    // A delivery van: a windscreen at the front.
    const fy = car.v > 0 ? y + len / 2 : y - len / 2;
    const a = iso(lane - w, fy),
      b = iso(lane + w, fy);
    ctx.fillStyle = "rgba(170,215,240,.95)";
    poly(ctx, [
      { x: a.x, y: a.y - 16 },
      { x: b.x, y: b.y - 16 },
      { x: b.x, y: b.y - 26 },
      { x: a.x, y: a.y - 26 },
    ]);
    ctx.fill();
  }
}
/** The moving parts and street furniture, in depth order (lamps stand in front of the far lane). */
export function drawSceneryLive(ctx: Ctx, l: Light, cars: Car[], low: boolean) {
  drawClouds(ctx, l, low);
  type D = { d: number; f: () => void };
  const list: D[] = [];
  for (const car of cars) {
    const lane = car.v > 0 ? ROAD0 + 0.6 : ROAD1 - 0.6;
    // The road runs over the horizon: cars come over it and go over it,
    // never up into the sky (cut at the horizon, faded as they near it).
    const fade = carFade(car);
    if (fade <= 0) continue;
    list.push({
      d: lane + car.y,
      f: () => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(-FAR, HORIZON, FAR * 2, FAR);
        ctx.clip();
        ctx.globalAlpha = fade;
        drawCar(ctx, car, l);
        ctx.restore();
      },
    });
  }
  for (const [x, y] of LAMPS)
    if (!inFront(x, y))
      list.push({ d: x + y, f: () => drawLampPost(ctx, x, y, l) });
  list.sort((a, b) => a.d - b.d);
  for (const it of list) it.f();
  if (!low) {
    if (l.night > 0.4) {
      // Fireflies over the grass across the road.
      for (let i = 0; i < 18; i++) {
        const gx = -7.4 + hash(i) * 2 + Math.sin(l.t * 0.6 + i) * 0.3,
          gy = -2 + hash(i + 50) * 16 + Math.cos(l.t * 0.5 + i * 2) * 0.3;
        const p = iso(gx, gy);
        const a = (0.5 + 0.5 * Math.sin(l.t * 3 + i * 1.7)) * l.night;
        ctx.fillStyle = `rgba(220,255,140,${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 20 - hash(i + 9) * 30, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // A few birds gliding across the sky.
      ctx.strokeStyle = "rgba(40,50,70,.7)";
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) {
        const x = ((l.t * 30 + i * 130) % 2600) - 1300,
          y = HORIZON - 180 - i * 14 + Math.sin(l.t + i) * 6;
        const flap = Math.sin(l.t * 8 + i) * 3;
        ctx.beginPath();
        ctx.moveTo(x - 7, y - flap);
        ctx.quadraticCurveTo(x - 3, y - 3, x, y);
        ctx.quadraticCurveTo(x + 3, y - 3, x + 7, y - flap);
        ctx.stroke();
      }
    }
  }
}
/** Lamps in front of the building's base: drawn after the room. */
const inFront = (x: number, y: number) => y > R.rows - 0.5 || x > R.cols - 0.5;
export function drawFrontLamps(ctx: Ctx, l: Light) {
  for (const [x, y] of LAMPS) if (inFront(x, y)) drawLampPost(ctx, x, y, l);
}
/** Lights the lighting pass adds at night: [x, y, radius, rgb, strength]. */
export function sceneryGlows(): [number, number, number, string, number][] {
  const out: [number, number, number, string, number][] = [];
  for (const [x, y] of LAMPS) {
    const c = iso(x, y);
    out.push([c.x + 12, c.y - 100, 120, "255,215,150", 0.4]);
    out.push([c.x + 12, c.y - 10, 70, "255,200,140", 0.25]);
  }
  return out;
}
export function carGlows(
  cars: Car[],
): [number, number, number, string, number][] {
  return cars
    .filter((car) => carFade(car) > 0)
    .map((car) => {
      const lane = car.v > 0 ? ROAD0 + 0.6 : ROAD1 - 0.6;
      const p = iso(lane, car.y + Math.sign(car.v) * 1.1);
      return [p.x, p.y - 6, 60, "255,240,200", 0.35 * carFade(car)];
    });
}

/** The rooftop sign over the right wall: lit letters at night. */
export function drawRoofSign(ctx: Ctx, l: Light, t: number) {
  const a = iso(1.2, -0.5),
    b = iso(5.8, -0.5);
  const lift = WALL_H + 10,
    h = 40;
  // Posts.
  ctx.fillStyle = "#3a2a22";
  for (const p of [a, b])
    ctx.fillRect(p.x - 2 + (p === a ? 10 : -10), p.y - lift - 6, 4, 10);
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
  // Text in the sign's plane.
  const u = { x: b.x - a.x, y: b.y - a.y };
  const len = Math.hypot(u.x, u.y);
  ctx.save();
  ctx.setTransform(
    ctx
      .getTransform()
      .multiply(new DOMMatrix([u.x / len, u.y / len, 0, 1, q[3].x, q[3].y])),
  );
  const glow = 0.6 + 0.4 * l.night;
  const flick =
    l.night > 0.4 ? 0.92 + 0.08 * Math.sin(t * 13) * Math.sin(t * 3.1) : 1;
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
