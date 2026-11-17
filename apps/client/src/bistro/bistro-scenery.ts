/*
 * Element Bistro (demo): the world around the restaurant. A street corner
 * following the device clock (dawn, noon, sunset, night) and the server's
 * season: sky, hills and a far skyline on a level horizon, grass, a street
 * with cars and a bus, sidewalks with lamps, and the neighbourhood of
 * bistro-town.ts (shops across the road, a canal, a square, passers-by).
 * World units, the same isometric grid as bistro-art.ts.
 */
import { DOOR } from "./bistro-model";
import {
  R,
  ROOM,
  WALL_H,
  iso,
  isoBox,
  shade,
  softShadow,
  skyColours,
  type Light,
  type Season,
} from "./bistro-art";
import {
  BACKS,
  BUS_LEN,
  FAR,
  FRONTS,
  HORIZON,
  ROAD0,
  ROAD1,
  WALK,
  bridgeParts,
  busGlows,
  busStopGlow,
  drawBus,
  drawBusStop,
  drawCanal,
  drawFountainWater,
  drawShop,
  drawSquareGround,
  drawWeather,
  hash,
  inFront,
  laneOf,
  lerpRgb,
  meets,
  onGround,
  plaza,
  quad,
  shopBox,
  shopGlows,
  shops,
  squareLamps,
  squareParts,
  stopY,
  townBehind,
  townFront,
  viewRect,
  type Bus,
  type Glow,
  type PaintCreature,
  type Street,
} from "./bistro-town";
import { poly } from "./bistro-geom";

export { HORIZON, onGround };
type Ctx = CanvasRenderingContext2D;

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
  // A warm haze along the horizon (gold at sunset, faint by night).
  const haze = ctx.createLinearGradient(0, HORIZON - 170, 0, HORIZON);
  const hz =
    l.gold > 0.2 ? `255,190,140` : l.night > 0.5 ? `90,90,150` : `255,244,220`;
  haze.addColorStop(0, `rgba(${hz},0)`);
  haze.addColorStop(1, `rgba(${hz},${0.55 - l.night * 0.3})`);
  ctx.fillStyle = haze;
  ctx.fillRect(-FAR, HORIZON - 170, FAR * 2, 171);
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
    // Each puff its own sub-path (joined, the lines between them made a
    // hole where they wound the other way).
    ctx.ellipse(x, y, w, w * 0.22, 0, 0, Math.PI * 2);
    ctx.moveTo(x + w * 0.72, y - w * 0.16);
    ctx.ellipse(
      x + w * 0.3,
      y - w * 0.16,
      w * 0.42,
      w * 0.25,
      0,
      0,
      Math.PI * 2,
    );
    ctx.moveTo(x + w * 0.02, y - w * 0.08);
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

/** A day colour in the season's tint: snowy, golden, fresh or as it is. */
export function seasonTint(
  c: number[],
  s: Season | undefined,
  k = 1,
): number[] {
  const to =
    s === "winter"
      ? [234, 240, 248]
      : s === "autumn"
        ? [200, 160, 92]
        : s === "spring"
          ? [150, 214, 130]
          : c;
  const f = (s === "winter" ? 0.72 : s === "autumn" ? 0.38 : 0.15) * k;
  return c.map((v, i) => Math.round(v + (to[i] - v) * f));
}
function drawFar(ctx: Ctx, l: Light) {
  const n = l.night;
  const tint = (c: number[]) => seasonTint(c, l.season);
  // Two rows of a far city: the farther one paler in the haze, the nearer
  // with roof shapes, a lit edge and rows of windows (lit at night).
  const row = (
    count: number,
    seed: number,
    x0: number,
    step: number,
    hMin: number,
    hVar: number,
    day: number[],
    dark: number[],
    near: boolean,
  ) => {
    const col = lerpRgb(day, dark, n);
    const lit = lerpRgb(
      day.map((v) => Math.min(255, v + 22)),
      dark.map((v) => v + 10),
      n,
    );
    for (let i = 0; i < count; i++) {
      const x = x0 + i * step + hash(i + seed) * step * 0.5;
      const centre = Math.abs(x) < 900 ? 1 : 0.6;
      const h = (hMin + hash(i + seed + 11) * hVar) * centre + 8;
      const w = step * 0.55 + hash(i + seed + 23) * step * 0.5;
      const top = HORIZON - h - 10;
      ctx.fillStyle = col;
      ctx.fillRect(x, top, w, h + 16);
      // A lit side on the sun's side.
      ctx.fillStyle = lit;
      ctx.fillRect(x + w * 0.72, top, w * 0.28, h + 16);
      // Roofs: a step, a spire or a water tank.
      const k = hash(i + seed + 41);
      ctx.fillStyle = col;
      if (k < 0.25) ctx.fillRect(x + w * 0.2, top - 8, w * 0.5, 8);
      else if (k < 0.37) {
        ctx.fillRect(x + w * 0.46, top - 16, 2, 16);
      } else if (k < 0.5) {
        ctx.fillRect(x + w * 0.15, top - 6, 8, 6);
      }
      if (!near) continue;
      // Windows: faint by day, warm at night.
      for (let wy = top + 5; wy < HORIZON - 6; wy += 8)
        for (let wx = x + 3; wx < x + w - 4; wx += 6) {
          const on = hash(wx * 3.1 + wy * 1.7);
          if (n > 0.3 ? on > 0.55 : on > 0.35) {
            ctx.fillStyle =
              n > 0.3
                ? `rgba(255,214,140,${(n - 0.3) * (0.6 + on * 0.4)})`
                : `rgba(255,255,255,${0.16 * (1 - n)})`;
            ctx.fillRect(wx, wy, 2.5, 3.5);
          }
        }
    }
  };
  row(60, 300, -2200, 74, 30, 60, [196, 214, 230], [52, 54, 96], false);
  row(70, 0, -2100, 60, 18, 44, [164, 188, 212], [40, 42, 80], true);
  // The haze over the city's feet.
  const fog = ctx.createLinearGradient(0, HORIZON - 40, 0, HORIZON + 4);
  const fc =
    n > 0.5 ? "60,64,110" : l.gold > 0.2 ? "250,205,170" : "220,232,240";
  fog.addColorStop(0, `rgba(${fc},0)`);
  fog.addColorStop(1, `rgba(${fc},${0.7 - n * 0.4})`);
  ctx.fillStyle = fog;
  ctx.fillRect(-FAR, HORIZON - 40, FAR * 2, 44);
  // Three layers of rolling hills, each lit along its crest, with a row of
  // little trees along the nearest.
  const ridge = (
    x: number,
    base: number,
    amp: number,
    freq: number,
    seed: number,
  ) =>
    HORIZON -
    base -
    amp *
      (0.5 + 0.5 * Math.sin(x * freq + seed)) *
      (0.6 + 0.4 * Math.sin(x * freq * 0.37 + seed * 2));
  const hill = (
    base: number,
    amp: number,
    freq: number,
    seed: number,
    top: number[],
    bottom: number[],
    darkTop: number[],
    darkBottom: number[],
  ) => {
    const g = ctx.createLinearGradient(
      0,
      HORIZON - base - amp,
      0,
      HORIZON + 20,
    );
    g.addColorStop(0, lerpRgb(tint(top), darkTop, n));
    g.addColorStop(1, lerpRgb(tint(bottom), darkBottom, n));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-FAR, HORIZON + 40);
    for (let x = -FAR; x <= FAR; x += 30)
      ctx.lineTo(x, ridge(x, base, amp, freq, seed));
    ctx.lineTo(FAR, HORIZON + 40);
    ctx.closePath();
    ctx.fill();
  };
  hill(
    14,
    54,
    0.003,
    2.2,
    [170, 200, 178],
    [140, 178, 156],
    [40, 50, 78],
    [34, 44, 68],
  );
  hill(
    4,
    46,
    0.004,
    1.3,
    [140, 186, 148],
    [110, 160, 120],
    [34, 46, 70],
    [30, 40, 60],
  );
  hill(
    -6,
    30,
    0.007,
    4.1,
    [120, 180, 110],
    [92, 150, 88],
    [30, 44, 56],
    [26, 38, 48],
  );
  for (let x = -FAR + 20; x <= FAR; x += 26) {
    if (hash(x * 0.37) < 0.45) continue;
    const y = ridge(x, -6, 30, 0.007, 4.1);
    const r = 5 + hash(x) * 5;
    ctx.fillStyle = lerpRgb(
      l.season === "winter" ? [150, 170, 160] : tint([78, 132, 72]),
      [22, 34, 40],
      n,
    );
    ctx.beginPath();
    ctx.arc(x, y + r * 0.4, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.8, y + r * 0.7, r * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ───────────── the ground: grass, the street, sidewalks ───────────── */

function drawGround(ctx: Ctx, l: Light) {
  const n = l.night;
  const season = l.season ?? "summer",
    snow = season === "winter";
  ctx.save();
  ctx.beginPath();
  ctx.rect(-FAR, HORIZON, FAR * 2, FAR);
  ctx.clip();
  // Grass (or snow), hazier toward the horizon.
  const day = snow
    ? [
        [238, 242, 248],
        [230, 236, 244],
        [220, 228, 240],
      ]
    : [
        [150, 196, 132],
        [112, 178, 92],
        [86, 156, 72],
      ].map((c) => seasonTint(c, season, 0.8));
  const dark = snow
    ? [
        [72, 80, 108],
        [66, 74, 102],
        [60, 68, 96],
      ]
    : [
        [44, 60, 62],
        [36, 58, 48],
        [28, 48, 38],
      ];
  const g = ctx.createLinearGradient(0, HORIZON, 0, HORIZON + 900);
  g.addColorStop(0, lerpRgb(day[0], dark[0], n));
  g.addColorStop(0.25, lerpRgb(day[1], dark[1], n));
  g.addColorStop(1, lerpRgb(day[2], dark[2], n));
  ctx.fillStyle = g;
  ctx.fillRect(-FAR, HORIZON, FAR * 2, FAR);
  // Mowing stripes along the grid, and soft lighter and darker patches.
  ctx.globalAlpha = (snow ? 0.03 : 0.07) * (1 - n * 0.7);
  ctx.fillStyle = "#ffffff";
  for (let k = -24; k < 40; k += 2) {
    poly(ctx, [iso(k, -30), iso(k + 1, -30), iso(k + 1, 40), iso(k, 40)]);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 70; i++) {
    const p = iso(-16 + hash(i + 900) * 42, -12 + hash(i + 1200) * 38);
    if (p.y < HORIZON + 10) continue;
    const r = 60 + hash(i + 1500) * 110;
    const lighter = hash(i + 1800) > 0.5;
    const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    const c = snow
      ? lighter
        ? "255,255,255"
        : "150,170,210"
      : lighter
        ? "200,236,150"
        : "40,96,40";
    rg.addColorStop(0, `rgba(${c},${(lighter ? 0.16 : 0.14) * (1 - n * 0.6)})`);
    rg.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Tufts of grass and flowers (fixed): more flowers in spring, fallen
  // leaves in autumn, only a glint here and there on the winter snow.
  const flowerShare = { spring: 0.3, summer: 0.18, autumn: 0.05, winter: 0 }[
    season
  ];
  for (let i = 0; i < 520; i++) {
    const gx = -16 + hash(i) * 40,
      gy = -12 + hash(i + 300) * 36;
    if (
      gx > FRONTS - 0.2 &&
      gx < R.cols + 1.6 &&
      gy > -2.4 &&
      gy < R.rows + 1.6
    )
      continue;
    const p = iso(gx, gy);
    if (p.y < HORIZON + 4) continue;
    if (snow) {
      if (i % 3) continue;
      ctx.globalAlpha = 0.8 - n * 0.4;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(p.x, p.y, 1.6, 1.6);
      continue;
    }
    const flower = hash(i + 77) > 1 - flowerShare;
    ctx.fillStyle = flower
      ? season === "autumn"
        ? ["#f2c14e", "#e8862e"][i % 2]
        : ["#ffd65b", "#ff8fb1", "#ffffff", "#b49cff"][i % 4]
      : lerpRgb(seasonTint([70, 140, 60], season, 0.8), [24, 40, 30], n);
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
  if (season === "autumn")
    for (let i = 0; i < 260; i++) {
      // Fallen leaves on the grass.
      const p = iso(-16 + hash(i + 6100) * 40, -12 + hash(i + 6400) * 36);
      if (p.y < HORIZON + 6) continue;
      ctx.globalAlpha = 0.9 - n * 0.5;
      ctx.fillStyle = ["#d9822b", "#c8442c", "#e8b23a", "#9a5a2a"][i % 4];
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 3, 1.6, hash(i) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  ctx.globalAlpha = 1;
  // Sidewalks around the building, along the road and past the shops.
  const slab = (c: number[]) => (snow ? c.map((v) => v + (250 - v) * 0.4) : c);
  const paving = lerpRgb(slab([214, 204, 186]), [78, 76, 90], n);
  const seam = lerpRgb(slab([186, 174, 154]), [60, 58, 72], n);
  ctx.fillStyle = paving;
  for (const [x0, y0, x1, y1] of [
    [FRONTS, -40, ROAD0, 40], // across the road, past the shops
    [ROAD1, -40, WALK, 40], // along the road
    [ROAD1, R.rows - 0.5, R.cols + 1.6, R.rows + 1.6], // the front
    [R.cols - 0.5, -2.4, R.cols + 1.6, R.rows + 1.6], // the right side
    [ROAD1, -2.4, R.cols + 1.6, -0.5], // behind
  ]) {
    quad(ctx, x0, y0, x1, y1);
    ctx.fill();
  }
  // Every other slab a shade lighter along the road.
  ctx.fillStyle = lerpRgb(slab([226, 218, 202]), [86, 84, 98], n);
  for (let y = -40; y < 40; y += 1.6) {
    quad(ctx, ROAD1, y, WALK, y + 0.8);
    ctx.fill();
    quad(ctx, FRONTS, y, ROAD0, y + 0.8);
    ctx.fill();
  }
  ctx.strokeStyle = seam;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = -40; y <= 40; y += 0.8) {
    for (const [x0, x1] of [
      [ROAD1, WALK],
      [FRONTS, ROAD0],
    ]) {
      const a = iso(x0, y),
        b = iso(x1, y);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
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
  // Worn tyre tracks and a speckle of grit.
  ctx.fillStyle = lerpRgb([74, 78, 88], [30, 32, 42], n);
  for (const tx of [ROAD0 + 0.45, ROAD0 + 0.85, ROAD1 - 0.85, ROAD1 - 0.45]) {
    quad(ctx, tx - 0.09, -40, tx + 0.09, 40);
    ctx.fill();
  }
  for (let i = 0; i < 900; i++) {
    const p = iso(
      ROAD0 + hash(i + 3000) * (ROAD1 - ROAD0),
      -40 + hash(i + 4000) * 80,
    );
    if (p.y < HORIZON) continue;
    ctx.fillStyle =
      hash(i + 5000) > 0.5 ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.1)";
    ctx.fillRect(p.x, p.y, 1.6, 1.2);
  }
  // Manhole covers.
  ctx.fillStyle = lerpRgb([62, 64, 72], [26, 28, 36], n);
  for (const y of [-6, 9.5, 21]) {
    const p = iso(ROAD0 + 0.65, y);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 13, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = lerpRgb([236, 232, 222], [96, 96, 108], n);
  quad(ctx, ROAD1 - 0.08, -40, ROAD1, 40);
  ctx.fill();
  // The curb's face, in its own shadow.
  ctx.fillStyle = lerpRgb([168, 160, 146], [60, 60, 72], n);
  for (let y = -40; y < 40; y += 2) {
    const a = iso(ROAD1 - 0.08, y),
      b = iso(ROAD1 - 0.08, y + 2);
    poly(ctx, [a, b, { x: b.x, y: b.y + 4 }, { x: a.x, y: a.y + 4 }]);
    ctx.fill();
  }
  ctx.fillStyle = lerpRgb([236, 232, 222], [96, 96, 108], n);
  quad(ctx, ROAD0, -40, ROAD0 + 0.08, 40);
  ctx.fill();
  if (snow) {
    // Slush along both curbs.
    ctx.fillStyle = lerpRgb([236, 240, 246], [92, 96, 116], n);
    quad(ctx, ROAD0 + 0.08, -40, ROAD0 + 0.3, 40);
    ctx.fill();
    quad(ctx, ROAD1 - 0.3, -40, ROAD1 - 0.08, 40);
    ctx.fill();
  }
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

/* ───────────── trees, lamps ───────────── */

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
function drawTree(
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
/** Petals drifting down from the cherry trees in spring (the live layer, a few at a time). */
function drawPetals(ctx: Ctx, l: Light, low: boolean) {
  if (l.season !== "spring") return;
  const n = l.night;
  for (const [x, y, s, k] of trees()) {
    if (k !== 2 || !onGround(x, y)) continue;
    const c = iso(x, y);
    for (let i = 0; i < (low ? 2 : 5); i++) {
      const f = (l.t * 0.12 + hash(i + x * 7)) % 1;
      const px =
        c.x +
        (hash(i + 3 + y) - 0.5) * 60 * s +
        Math.sin(l.t * 2 + i) * 6 +
        f * 18;
      const py = c.y - 80 * s + f * 84 * s;
      ctx.fillStyle = `rgba(255,214,228,${(0.9 - n * 0.5) * Math.min(1, (1 - f) * 3)})`;
      ctx.beginPath();
      ctx.ellipse(px, py, 2.6, 1.6, l.t * 2 + i, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
/** Street lamps on the near curb (their light is added live): (grid x, grid y). */
export const lamps = (): [number, number][] => [
  [ROAD1 + 0.35, 1.5],
  [ROAD1 + 0.35, 5],
  [ROAD1 + 0.35, R.rows - 0.6],
  [ROAD1 + 0.35, R.rows + 5.4],
];
/** Lamps on the far curb, by the shops (their light is baked with the street). */
const farLamps = (): [number, number][] => [
  [ROAD0 - 0.3, 3.4],
  [ROAD0 - 0.3, 8.6],
  [ROAD0 - 0.3, R.rows + 5.4],
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
    // Three clumps, each its own sub-path (see the clouds).
    ctx.arc(c.x - 4, c.y - 18, 7, 0, Math.PI * 2);
    ctx.moveTo(c.x + 11, c.y - 19);
    ctx.arc(c.x + 4, c.y - 19, 7, 0, Math.PI * 2);
    ctx.moveTo(c.x + 7, c.y - 24);
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

/** Everything that never moves: drawn once per view, light, and season. */
export function drawSceneryStatic(ctx: Ctx, l: Light, special: string) {
  const vr = viewRect(ctx);
  drawSky(ctx, l);
  drawFar(ctx, l);
  drawGround(ctx, l);
  drawCanal(ctx, l);
  drawSquareGround(ctx, l);
  // Shops across the road, trees, the bridges, the square, the bus stop:
  // far to near. Only what the view shows (a pan or a zoom bakes again).
  type D = { d: number; f: () => void };
  const list: D[] = [];
  for (const s of shops()) {
    const b = shopBox(s);
    if (!meets(vr, b.x0, b.y0, b.x1, b.y1)) continue;
    // Standing on this side of the horizon, never floating in the sky.
    if (!onGround(FRONTS, s.y0, 4) || !onGround(BACKS, s.y1, 4)) continue;
    list.push({
      d: (BACKS + FRONTS) / 2 + (s.y0 + s.y1) / 2,
      f: () => drawShop(ctx, s, l),
    });
  }
  // Trees that could cover the room are drawn after it, every frame
  // (drawSceneryFront); the rest are baked here.
  for (const [x, y, s, k] of trees()) {
    const c = iso(x, y);
    if (!onGround(x, y) || liveTree(x, y, s)) continue;
    if (!meets(vr, c.x - 70 * s, c.y - 150 * s, c.x + 70 * s, c.y + 20))
      continue;
    list.push({ d: x + y, f: () => drawTree(ctx, x, y, s, k, l) });
  }
  for (const p of [...bridgeParts(l), ...squareParts(l)])
    list.push({ d: p.d, f: () => p.f(ctx) });
  list.push({ d: -3.1 + stopY(), f: () => drawBusStop(ctx, l) });
  list.sort((a, b) => a.d - b.d);
  for (const it of list) it.f();
  drawStreetProps(ctx, l);
  drawSignBoard(ctx, l, special);
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
/** Lights baked with the street: shops, the far lamps, the square, the bus stop. */
export function staticGlows(): Glow[] {
  const out: Glow[] = [...shopGlows(), busStopGlow()];
  for (const [x, y] of farLamps()) {
    const c = iso(x, y);
    out.push([c.x + 12, c.y - 100, 110, "255,215,150", 0.38]);
    out.push([c.x + 12, c.y - 10, 64, "255,200,140", 0.22]);
  }
  for (const [x, y] of squareLamps()) {
    const c = iso(x, y);
    out.push([c.x, c.y - 76, 90, "255,215,150", 0.36]);
    out.push([c.x, c.y - 4, 56, "255,200,140", 0.2]);
  }
  return out;
}
/** Trees around the block, in the square and along the canal: (grid x, grid y, size, kind). */
const trees = (): [number, number, number, number][] => [
  [3, -3.6, 1.1, 0],
  [7.5, -3.4, 1, 1],
  [11.5, -3.2, 1.2, 0],
  // The square.
  [R.cols + 3.0, -1.6, 1.1, 2],
  [R.cols + 6.2, -0.4, 1.2, 0],
  [R.cols + 7.3, 3.4, 1, 1],
  [R.cols + 3.2, 8.2, 1, 0],
  [R.cols + 5.8, R.rows + 0.4, 1.1, 2],
  // Beyond the canal.
  [0.6, R.rows + 6.2, 1, 0],
  [8.4, R.rows + 5.6, 1.1, 2],
];
/** The room's outline on screen (walls included), for what may cover it. */
function roomOutline() {
  const l = ROOM.left,
    b = ROOM.bottom,
    r = ROOM.right,
    t = ROOM.top;
  return [
    { x: l.x - 16, y: l.y + 40 },
    { x: b.x, y: b.y + 40 },
    { x: r.x + 16, y: r.y + 40 },
    { x: r.x + 16, y: r.y - WALL_H - 22 },
    { x: t.x, y: t.y - WALL_H - 22 },
    { x: l.x - 16, y: l.y - WALL_H - 22 },
  ];
}
function inside(p: { x: number; y: number }, poly: { x: number; y: number }[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      hit = !hit;
  }
  return hit;
}
/**
 * A tree in front of the room that can reach over it: drawn after the room
 * every frame (swaying). Trees anywhere else are baked with the street.
 */
export function liveTree(x: number, y: number, s: number): boolean {
  if (!inFront(x, y)) return false;
  const c = iso(x, y);
  const room = roomOutline();
  for (const [dx, dy] of [
    [-55, -125],
    [0, -135],
    [55, -125],
    [-55, -60],
    [55, -60],
    [0, -60],
    [-30, -20],
    [30, -20],
  ])
    if (inside({ x: c.x + dx * s, y: c.y + dy * s }, room)) return true;
  return false;
}
/** In front of the room: trees that reach over it, lamps, passers-by; then the weather. */
export function drawSceneryFront(
  ctx: Ctx,
  l: Light,
  low: boolean,
  street?: Street,
  paint?: PaintCreature,
) {
  type D = { d: number; f: () => void };
  const list: D[] = [];
  for (const [x, y, s, k] of trees())
    if (onGround(x, y) && liveTree(x, y, s))
      list.push({
        d: x + y,
        // Trees drawn every frame sway in the wind.
        f: () =>
          drawTree(ctx, x, y, s, k, l, Math.sin(l.t * 1.1 + x * 0.7 + y) * 3),
      });
  for (const [x, y] of lamps())
    if (inFront(x, y))
      list.push({ d: x + y, f: () => drawLampPost(ctx, x, y, l) });
  if (street && paint) list.push(...townFront(ctx, street, l, paint));
  list.sort((a, b) => a.d - b.d);
  for (const it of list) it.f();
  drawWeather(ctx, l, low);
}

/* ───────────── what moves: cars, lamps, birds, fireflies ───────────── */

export interface Car {
  /** Grid y along the road; moves at `v` tiles a second. */
  y: number;
  v: number;
  col: string;
  kind: number;
}
const carLen = (c: Car) => (c.kind ? 1.25 : 0.95);
/**
 * Cars along the road. Each keeps its distance from the one ahead in its
 * lane (and from the bus, which stops at its stop in the near lane): they
 * queue instead of driving through each other. `max` cars at most.
 */
export function updateCars(
  cars: Car[],
  dt: number,
  spawnRoll: number,
  o: { bus?: Bus | null; max?: number } = {},
): Car[] {
  for (const c of cars) c.y += c.v * dt;
  const bus = o.bus && o.bus.state !== "away" ? o.bus : null;
  for (const dir of [1, -1]) {
    const lane: { y: number; len: number; set: (y: number) => void }[] = [];
    for (const c of cars)
      if (Math.sign(c.v) === dir)
        lane.push({ y: c.y, len: carLen(c), set: (y) => (c.y = y) });
    if (bus && dir < 0)
      lane.push({ y: bus.y, len: BUS_LEN, set: (y) => (bus.y = y) });
    // The front of the lane first.
    lane.sort((a, b) => (dir > 0 ? b.y - a.y : a.y - b.y));
    for (let i = 1; i < lane.length; i++) {
      const ahead = lane[i - 1],
        me = lane[i];
      const gap = (ahead.len + me.len) / 2 + 0.45;
      if (dir > 0 ? me.y > ahead.y - gap : me.y < ahead.y + gap) {
        me.y = dir > 0 ? ahead.y - gap : ahead.y + gap;
        me.set(me.y);
      }
    }
  }
  const out = cars.filter((c) => c.y > -30 && c.y < 34);
  if (spawnRoll < dt * 0.22 && out.length < (o.max ?? 4)) {
    const down = Math.random() < 0.5;
    const y = down ? -26 : 30;
    // Not on top of someone already coming in.
    const busy =
      out.some(
        (c) => Math.sign(c.v) === (down ? 1 : -1) && Math.abs(c.y - y) < 2.5,
      ) ||
      (!down && !!bus && Math.abs(bus.y - y) < 3);
    if (!busy)
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
/** Where (screen y) a car has faded out on its way up the road. */
const CAR_GONE = HORIZON + 50;
/** 0 near the horizon (and beyond it), 1 once the car is well below it. */
export function carFade(car: Car): number {
  const lane = car.v > 0 ? ROAD0 + 0.6 : ROAD1 - 0.6;
  const y = iso(lane, car.y).y;
  // Gone while still behind the bistro's wall, so a car never shows in the
  // sliver of road between the wall's top and the horizon.
  return Math.max(0, Math.min(1, (y - CAR_GONE) / 60));
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
/**
 * The moving parts and street furniture behind (or beside) the room, in
 * depth order: cars and the bus, lamps, passers-by, pigeons, ducks, the
 * fountain's water. People in front of the room come in drawSceneryFront.
 */
export function drawSceneryLive(
  ctx: Ctx,
  l: Light,
  cars: Car[],
  low: boolean,
  street?: Street,
  paint?: PaintCreature,
) {
  drawClouds(ctx, l, low);
  drawPetals(ctx, l, low);
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
  for (const [x, y] of [...lamps(), ...farLamps()])
    if (!inFront(x, y))
      list.push({ d: x + y, f: () => drawLampPost(ctx, x, y, l) });
  if (street) {
    const b = street.bus;
    if (b.state !== "away")
      list.push({ d: laneOf(-1) + b.y, f: () => drawBus(ctx, b, l) });
    if (paint) list.push(...townBehind(ctx, street, l, paint));
  }
  const P = plaza();
  list.push({ d: P.x + P.y + 0.05, f: () => drawFountainWater(ctx, l, low) });
  list.sort((a, b) => a.d - b.d);
  for (const it of list) it.f();
  if (!low) {
    if (l.night > 0.4 && l.season !== "winter") {
      // Fireflies over the square's lawn.
      for (let i = 0; i < 18; i++) {
        const gx = R.cols + 2.6 + hash(i) * 6 + Math.sin(l.t * 0.6 + i) * 0.3,
          gy = -2 + hash(i + 50) * 11 + Math.cos(l.t * 0.5 + i * 2) * 0.3;
        if (!onGround(gx, gy, 40)) continue;
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
/** Lights the lighting pass adds at night: [x, y, radius, rgb, strength]. */
export function sceneryGlows(): Glow[] {
  const out: Glow[] = [];
  for (const [x, y] of lamps()) {
    const c = iso(x, y);
    out.push([c.x + 12, c.y - 100, 120, "255,215,150", 0.4]);
    out.push([c.x + 12, c.y - 10, 70, "255,200,140", 0.25]);
  }
  return out;
}
export function carGlows(cars: Car[], bus?: Bus | null): Glow[] {
  const out: Glow[] = cars
    .filter((car) => carFade(car) > 0)
    .map((car) => {
      const lane = car.v > 0 ? ROAD0 + 0.6 : ROAD1 - 0.6;
      const p = iso(lane, car.y + Math.sign(car.v) * 1.1);
      return [p.x, p.y - 6, 60, "255,240,200", 0.35 * carFade(car)] as Glow;
    });
  if (bus) out.push(...busGlows(bus));
  return out;
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
