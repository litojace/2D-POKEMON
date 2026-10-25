import { RULES } from "@arena/shared";
import { paintKit, type Light } from "./arena-courts";

/**
 * The raid arenas' floors, in the duel courts' style (arena-courts.ts): real
 * materials with grain, one sun (or moon) from the upper left, soft blurred
 * shadows and light pools. Painted once into a canvas.
 *
 * Every gameplay marking stays exactly where the old floors had it (the
 * whirlpool and skylight rings, the Lantern Yard's 8 × 5 board, the
 * Conductor Ring's tracks, the Cloud Deck's star circle), drawn as true
 * circles in world coordinates, because the live warnings line up with them.
 * Things that change during a raid (islands, lanterns, braziers, mirrors,
 * rune pads, posts) are still drawn live on top.
 */
type Ctx = CanvasRenderingContext2D;
const W = RULES.width,
  H = RULES.height;
const BORDER = 36;
const { SUNV, ell, mix, grain, shadows, lights, grade, pebbles, fillPoly, reseed, rand: R } = paintKit;

export const RAID_FLOORS = [
  "lagoon",
  "lantern-yard",
  "sky-terrace",
  "sun-atrium",
  "conductor-ring",
  "cloud-deck",
] as const;
export type RaidFloorId = (typeof RAID_FLOORS)[number];
export const isRaidFloor = (id: string): id is RaidFloorId =>
  (RAID_FLOORS as readonly string[]).includes(id);

export function paintRaidFloor(c: Ctx, id: RaidFloorId) {
  if (id === "lagoon") lagoon(c);
  else if (id === "lantern-yard") lanternYard(c);
  else if (id === "sky-terrace") skyTerrace(c);
  else if (id === "sun-atrium") sunAtrium(c);
  else if (id === "conductor-ring") conductorRing(c);
  else cloudDeck(c);
}

// ─────────────────────────── helpers ───────────────────────────

function rounded(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}
/** A square tile grid with per-tile tone, bevel and wear. */
function tiles(
  c: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  size: number,
  tones: [string, string],
  grout: string,
  s0: number,
  opts: { radius?: number; checker?: number; veins?: string; bevel?: number } = {},
) {
  c.fillStyle = grout;
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
  reseed(s0);
  const radius = opts.radius ?? 3,
    bevel = opts.bevel ?? 0.22;
  for (let y = y0; y < y1 - 1; y += size)
    for (let x = x0; x < x1 - 1; x += size) {
      const w = Math.min(size, x1 - x),
        h = Math.min(size, y1 - y);
      const col = Math.round((x - x0) / size),
        row = Math.round((y - y0) / size);
      let base = mix(tones[0], tones[1], R());
      if (opts.checker && (col + row) % 2) base = mix(base, "#ffffff", opts.checker);
      const g = c.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, mix(base, "#ffffff", 0.08));
      g.addColorStop(1, mix(base, "#000000", 0.12));
      c.fillStyle = g;
      rounded(c, x + 1.5, y + 1.5, w - 3, h - 3, radius);
      c.fill();
      // Lit top-left edge, shaded bottom-right: tiles sit very slightly proud.
      c.strokeStyle = `rgba(255,255,255,${bevel})`;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(x + 2, y + h - 3);
      c.lineTo(x + 2, y + 2);
      c.lineTo(x + w - 3, y + 2);
      c.stroke();
      c.strokeStyle = `rgba(0,0,0,${bevel * 1.2})`;
      c.beginPath();
      c.moveTo(x + w - 2, y + 3);
      c.lineTo(x + w - 2, y + h - 2);
      c.lineTo(x + 3, y + h - 2);
      c.stroke();
      if (opts.veins) {
        c.strokeStyle = opts.veins;
        c.lineWidth = 0.8 + R() * 0.8;
        c.beginPath();
        let vx = x + R() * w,
          vy = y + 4;
        c.moveTo(vx, vy);
        while (vy < y + h - 4) {
          vx += (R() - 0.5) * 22;
          vy += 8 + R() * 14;
          c.lineTo(Math.max(x + 3, Math.min(x + w - 3, vx)), Math.min(vy, y + h - 4));
        }
        c.stroke();
      }
      // A few pits of wear.
      for (let k = 0; k < 2; k++) {
        c.fillStyle = "rgba(0,0,0,0.12)";
        ell(c, x + 8 + R() * (w - 16), y + 8 + R() * (h - 16), 1 + R() * 2, 0.8 + R());
        c.fill();
      }
    }
}
/** A true circle (in world space, like the live warnings) as an inlaid band. */
function inlayRing(c: Ctx, x: number, y: number, r: number, width: number, color: string, glint = 0.35) {
  c.strokeStyle = "rgba(0,0,0,0.35)";
  c.lineWidth = width + 2;
  c.beginPath();
  c.arc(x, y + 1, r, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = `rgba(255,250,230,${glint})`;
  c.lineWidth = Math.max(1, width * 0.3);
  c.beginPath();
  c.arc(x, y - width * 0.25, r, Math.PI * 1.05, Math.PI * 1.75);
  c.stroke();
}
/**
 * Soft, lumpy cloud: overlapping puffs lit from the upper left, blurred.
 * Each cloud is drawn and blurred on a small canvas of its own, then placed;
 * a blur filter on the whole floor canvas costs a full-canvas pass per puff,
 * which froze the page for floors with dozens of clouds.
 */
function cloud(c: Ctx, x: number, y: number, size: number, lit: string, shade: string, alpha = 1) {
  const scale = Math.hypot(c.getTransform().a, c.getTransform().b) || 1,
    blur = Math.max(2, size * 0.08),
    // Room for the puffs' spread plus the blur's tail.
    halfW = size * 1.15 + blur * 3,
    halfH = size * 0.95 + blur * 3;
  const puffs = document.createElement("canvas");
  puffs.width = Math.ceil(halfW * 2 * scale);
  puffs.height = Math.ceil(halfH * 2 * scale);
  const p = puffs.getContext("2d")!;
  p.scale(scale, scale);
  p.translate(halfW - x, halfH - y);
  for (let k = 0; k < 7; k++) {
    const px = x + (R() - 0.5) * size * 1.6,
      py = y + (R() - 0.5) * size * 0.5,
      r = size * (0.35 + R() * 0.35);
    const g = p.createRadialGradient(px - r * 0.35, py - r * 0.4, r * 0.1, px, py, r);
    g.addColorStop(0, lit);
    g.addColorStop(1, shade);
    p.fillStyle = g;
    ell(p, px, py, r, r * 0.7);
    p.fill();
  }
  const soft = document.createElement("canvas");
  soft.width = puffs.width;
  soft.height = puffs.height;
  const b = soft.getContext("2d")!;
  b.filter = `blur(${blur * scale}px)`;
  b.drawImage(puffs, 0, 0);
  c.save();
  c.globalAlpha = alpha;
  c.drawImage(soft, x - halfW, y - halfH, halfW * 2, halfH * 2);
  c.restore();
}
/** Coloured light falling on the floor (stained glass, glowing rings). */
function glow(c: Ctx, x: number, y: number, rx: number, ry: number, rgb: string, a: number, rot = 0) {
  c.save();
  c.globalCompositeOperation = "screen";
  c.translate(x, y);
  c.rotate(rot);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.6, `rgba(${rgb},${a * 0.35})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g;
  c.scale(1, ry / rx);
  c.beginPath();
  c.arc(0, 0, rx, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
function vignette(c: Ctx, rgb: string, a: number, inner = 0.45) {
  const v = c.createRadialGradient(W / 2, H / 2, H * inner, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, `rgba(${rgb},0)`);
  v.addColorStop(1, `rgba(${rgb},${a})`);
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
}

// ─────────────────────────── Lagoon (Tidewyrm) ───────────────────────────

/** A sandy rim around clear, sunlit water: rippled sand below, caustics, foam. */
function lagoon(c: Ctx) {
  // Beach sand.
  const sand = c.createLinearGradient(0, 0, 0, H);
  sand.addColorStop(0, "#e0cb98");
  sand.addColorStop(1, "#d3bb86");
  c.fillStyle = sand;
  c.fillRect(0, 0, W, H);
  grain(c, 0, 0, W, H, 0.5, 101, [
    [120, 1],
    [30, 0.6],
    [4, 0.35],
    [2, 0.3],
  ]);
  pebbles(c, 160, "#cdb98c", "#9a8762", 102);
  // Wet sand where the water's edge reaches.
  c.save();
  c.strokeStyle = "rgba(120,96,58,0.32)";
  c.lineWidth = 34;
  c.filter = "blur(8px)";
  rounded(c, BORDER, BORDER, W - BORDER * 2, H - BORDER * 2, 40);
  c.stroke();
  c.restore();
  // The water, clipped to its basin: deep at the walls, bright in the middle.
  c.save();
  rounded(c, BORDER, BORDER, W - BORDER * 2, H - BORDER * 2, 40);
  c.clip();
  const water = c.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.62);
  water.addColorStop(0, "#47c3cf");
  water.addColorStop(0.45, "#2a9fb3");
  water.addColorStop(0.8, "#17778f");
  water.addColorStop(1, "#0d5a72");
  c.fillStyle = water;
  c.fillRect(0, 0, W, H);
  // Rippled sand on the bottom, seen through the water.
  reseed(103);
  c.lineWidth = 2;
  for (let row = 0; row < 40; row++) {
    const y0 = BORDER + 10 + row * 22 + R() * 6;
    c.strokeStyle = `rgba(230,214,160,${0.06 + R() * 0.05})`;
    c.beginPath();
    for (let x = BORDER; x <= W - BORDER; x += 10) {
      const y = y0 + Math.sin(x / 38 + row * 1.7) * 4 + Math.sin(x / 11 + row) * 1.2;
      if (x === BORDER) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  // Caustics: a net of bright, wobbly cells.
  c.globalCompositeOperation = "screen";
  for (let k = 0; k < 900; k++) {
    const x = BORDER + R() * (W - BORDER * 2),
      y = BORDER + R() * (H - BORDER * 2),
      r = 10 + R() * 22;
    c.strokeStyle = `rgba(200,255,250,${0.05 + R() * 0.08})`;
    c.lineWidth = 1 + R() * 1.4;
    c.beginPath();
    const a0 = R() * 6.28;
    c.arc(x, y, r, a0, a0 + 1.2 + R() * 1.6);
    c.stroke();
  }
  c.globalCompositeOperation = "source-over";
  grain(c, BORDER, BORDER, W - BORDER * 2, H - BORDER * 2, 0.25, 104, [
    [90, 1],
    [20, 0.6],
  ]);
  // Where the whirlpool forms: faint rings in the water.
  for (const [r, a] of [
    [150, 0.2],
    [230, 0.12],
  ] as const) {
    c.strokeStyle = `rgba(220,248,244,${a})`;
    c.lineWidth = r === 150 ? 3 : 2;
    c.beginPath();
    c.arc(W / 2, H / 2, r, 0, Math.PI * 2);
    c.stroke();
  }
  // The basin wall's shadow on the water (sun from the upper left).
  shadows(c, (s) => {
    s.fillRect(0, 0, W, BORDER + 10);
    s.fillRect(0, 0, BORDER + 14, H);
  });
  c.restore();
  // Foam where water meets sand.
  c.save();
  c.filter = "blur(2.5px)";
  c.strokeStyle = "rgba(250,255,255,0.75)";
  c.lineWidth = 7;
  rounded(c, BORDER, BORDER, W - BORDER * 2, H - BORDER * 2, 40);
  c.stroke();
  c.restore();
  c.strokeStyle = "rgba(255,255,255,0.4)";
  c.lineWidth = 2;
  rounded(c, BORDER + 9, BORDER + 9, W - BORDER * 2 - 18, H - BORDER * 2 - 18, 34);
  c.stroke();
  // Sun glints on the water.
  reseed(105);
  c.save();
  c.globalCompositeOperation = "screen";
  for (let k = 0; k < 160; k++) {
    const x = BORDER + 30 + R() * (W - BORDER * 2 - 60),
      y = BORDER + 30 + R() * (H - BORDER * 2 - 60);
    c.fillStyle = `rgba(255,255,240,${0.25 + R() * 0.4})`;
    ell(c, x, y, 2 + R() * 3, 0.8);
    c.fill();
  }
  c.restore();
  // Rocks at the corners of the rim.
  for (const [x, y, s] of [
    [60, 70, 1.2],
    [1540, 60, 1],
    [70, 840, 0.9],
    [1530, 846, 1.3],
    [800, 18, 0.7],
  ] as const)
    rock(c, x, y, s);
  grade(c, 0.32, 0.4);
}
function rock(c: Ctx, x: number, y: number, s: number) {
  c.save();
  c.filter = "blur(4px)";
  c.fillStyle = "rgba(30,24,14,0.35)";
  ell(c, x + 10 * s, y + 6 * s, 30 * s, 14 * s);
  c.fill();
  c.restore();
  const g = c.createLinearGradient(x - 24 * s, y - 20 * s, x + 20 * s, y + 14 * s);
  g.addColorStop(0, "#9aa29c");
  g.addColorStop(1, "#4d5651");
  c.fillStyle = g;
  ell(c, x, y, 26 * s, 17 * s);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.25)";
  ell(c, x - 8 * s, y - 7 * s, 10 * s, 5 * s);
  c.fill();
}

// ─────────────────────────── Lantern Yard (Gloomshade) ───────────────────────────

/** A moonlit flagstone yard (one board square per Grasping Hands tile), ringed by hedges. */
function lanternYard(c: Ctx) {
  // Hedges all round.
  c.fillStyle = "#152a26";
  c.fillRect(0, 0, W, H);
  reseed(201);
  for (let i = 0; i < 520; i++) {
    const x = R() * W,
      y = R() * H;
    if (x > BORDER + 6 && x < W - BORDER - 6 && y > BORDER + 6 && y < H - BORDER - 6) continue;
    const r = 8 + R() * 12;
    const g = c.createRadialGradient(x - r * 0.4, y - r * 0.4, 1, x, y, r);
    g.addColorStop(0, ["#3b6556", "#355e50", "#41705f"][i % 3]);
    g.addColorStop(1, "#15291f");
    c.fillStyle = g;
    ell(c, x, y, r, r * 0.85);
    c.fill();
    if (i % 17 === 0) {
      c.fillStyle = "rgba(220,214,245,0.8)";
      ell(c, x, y - 2, 2, 2);
      c.fill();
    }
  }
  // Flagstones: the board is 8 × 5 squares; each square is laid as 2–3 slabs.
  const cols = 8,
    rows = 5,
    tw = W / cols,
    th = H / rows;
  const x0 = BORDER,
    y0 = BORDER,
    x1 = W - BORDER,
    y1 = H - BORDER;
  c.fillStyle = "#14182b";
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
  reseed(202);
  for (let col = 0; col < cols; col++)
    for (let row = 0; row < rows; row++) {
      const ax = Math.max(x0, col * tw),
        ay = Math.max(y0, row * th),
        bx = Math.min(x1, (col + 1) * tw),
        by = Math.min(y1, (row + 1) * th);
      // The board: every other square a shade lighter, as Hands uses it.
      const light = (col + row) % 2 === 0;
      const base = light ? "#4a5179" : "#3d4366";
      const split = 0.35 + R() * 0.3;
      const slabs: [number, number, number, number][] = [
        [ax, ay, bx, ay + (by - ay) * split],
        [ax, ay + (by - ay) * split, ax + (bx - ax) * (0.4 + R() * 0.2), by],
        [ax + (bx - ax) * (0.4 + R() * 0.2), ay + (by - ay) * split, bx, by],
      ];
      for (const [sx0, sy0, sx1, sy1] of slabs) {
        const tone = mix(base, R() > 0.5 ? "#5a6088" : "#30354f", R() * 0.4);
        const g = c.createLinearGradient(sx0, sy0, sx1, sy1);
        g.addColorStop(0, mix(tone, "#dcd6ff", 0.08));
        g.addColorStop(1, mix(tone, "#000000", 0.15));
        c.fillStyle = g;
        rounded(c, sx0 + 3, sy0 + 3, sx1 - sx0 - 6, sy1 - sy0 - 6, 6);
        c.fill();
        c.strokeStyle = "rgba(210,205,255,0.14)";
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(sx0 + 4, sy1 - 5);
        c.lineTo(sx0 + 4, sy0 + 4);
        c.lineTo(sx1 - 5, sy0 + 4);
        c.stroke();
      }
      // Moss in the joints, dew catching the moon.
      for (let k = 0; k < 7; k++) {
        c.fillStyle = `rgba(70,120,96,${0.35 + R() * 0.3})`;
        ell(c, ax + 4 + R() * (bx - ax - 8), R() < 0.5 ? ay + 3 : ay + (by - ay) * split, 2 + R() * 3, 1.5 + R());
        c.fill();
      }
      for (let k = 0; k < 5; k++) {
        c.fillStyle = "rgba(230,230,255,0.35)";
        ell(c, ax + 10 + R() * (bx - ax - 20), ay + 10 + R() * (by - ay - 20), 1, 1);
        c.fill();
      }
    }
  grain(c, x0, y0, x1 - x0, y1 - y0, 0.3, 203, [
    [120, 1],
    [24, 0.5],
    [3, 0.35],
  ]);
  // The worn moon circle where Gloomshade rests.
  inlayRing(c, W / 2, 430, 120, 5, "rgba(183,166,214,0.55)", 0.2);
  inlayRing(c, W / 2, 430, 150, 2, "rgba(183,166,214,0.35)", 0.1);
  // Hedge shadows on the stone (moonlight from the upper left).
  shadows(c, (s) => {
    s.fillRect(0, 0, W, BORDER + 8);
    s.fillRect(0, 0, BORDER + 12, H);
  });
  // Stone kerb.
  c.strokeStyle = "#4d4668";
  c.lineWidth = 6;
  rounded(c, BORDER, BORDER, W - BORDER * 2, H - BORDER * 2, 18);
  c.stroke();
  c.strokeStyle = "rgba(200,190,240,0.35)";
  c.lineWidth = 2;
  rounded(c, BORDER + 5, BORDER + 5, W - BORDER * 2 - 10, H - BORDER * 2 - 10, 14);
  c.stroke();
  // Cold moonlight from the upper left, falling off into the night.
  glow(c, 520, 260, 900, 650, "170,170,240", 0.16);
  vignette(c, "6,8,20", 0.55, 0.35);
}

// ─────────────────────────── Sky Terrace (Emberwing) ───────────────────────────

/** A sandstone terrace above the clouds at sunset, with a bronze ring and a balustrade. */
function skyTerrace(c: Ctx) {
  // Far below: clouds lit by the low sun.
  const sky = c.createLinearGradient(0, 0, W, H);
  sky.addColorStop(0, "#5a6f96");
  sky.addColorStop(1, "#2a3654");
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);
  reseed(301);
  for (let i = 0; i < 26; i++) {
    const top = i % 2 === 0;
    cloud(c, (i / 26) * W * 1.1, top ? 10 + R() * 20 : H - 10 - R() * 20, 70 + R() * 50, "#ffe6d0", "rgba(150,140,190,0)", 0.75);
  }
  for (let i = 0; i < 10; i++) {
    const left = i % 2 === 0;
    cloud(c, left ? 12 : W - 12, 80 + (i / 10) * (H - 160), 60 + R() * 40, "#ffd9c4", "rgba(150,140,190,0)", 0.6);
  }
  // The terrace slab's drop shadow on the clouds.
  shadows(c, (s) => {
    rounded(s, 35 + 18, 35 + 14, W - 70, H - 70, 35);
    s.fill();
  });
  // Pavers.
  c.save();
  rounded(c, 35, 35, W - 70, H - 70, 35);
  c.clip();
  tiles(c, 35, 35, W - 35, H - 35, 100, ["#a99880", "#bba98f"], "#6e6150", 302, { radius: 4 });
  grain(c, 35, 35, W - 70, H - 70, 0.4, 303, [
    [130, 1],
    [28, 0.6],
    [3, 0.4],
  ]);
  // Wear down the middle where feet go.
  glow(c, W / 2, H / 2, 520, 300, "255,240,215", 0.08);
  // The bronze ring.
  inlayRing(c, 800, 450, 260, 6, "#b88a52", 0.45);
  c.restore();
  // Coping round the edge.
  c.strokeStyle = "#cdb48c";
  c.lineWidth = 8;
  rounded(c, 38, 38, W - 76, H - 76, 32);
  c.stroke();
  c.strokeStyle = "rgba(255,240,210,0.35)";
  c.lineWidth = 2;
  rounded(c, 55, 55, W - 110, H - 110, 24);
  c.stroke();
  // Balustrade posts along the far and near edges (ground level for the near ones).
  shadows(c, (s) => {
    for (const y of [33, 856])
      for (let i = 0; i < 12; i++) {
        const x = 100 + i * 127;
        s.fillRect(x - 15 + SUNV.x * 24, y - 18 + SUNV.y * 24, 30, 36);
      }
  });
  for (const y of [33, 856])
    for (let i = 0; i < 12; i++) {
      const x = 100 + i * 127;
      const g = c.createLinearGradient(x - 17, 0, x + 17, 0);
      g.addColorStop(0, "#d9c3a0");
      g.addColorStop(1, "#8f7a5e");
      c.fillStyle = g;
      rounded(c, x - 15, y - 18, 30, 36, 5);
      c.fill();
      c.fillStyle = "#e8d7b8";
      ell(c, x, y - 16, 19, 7);
      c.fill();
    }
  // Low sun from the upper left: warm, long light.
  lights(c, [[260, 140, 900, 0.18, "255,190,130"]] satisfies Light[]);
  grade(c, 0.4, 0.42);
}

// ─────────────────────────── Sun Atrium (Prismatail) ───────────────────────────

/** Polished marble under a skylight, brass inlays, and stained glass throwing colour. */
function sunAtrium(c: Ctx) {
  c.fillStyle = "#1e2c3d";
  c.fillRect(0, 0, W, H);
  tiles(c, 0, 0, W, H, 100, ["#cfd6dc", "#b9c4cc"], "#7d8a96", 401, {
    radius: 2,
    checker: 0.08,
    veins: "rgba(120,130,150,0.35)",
    bevel: 0.3,
  });
  grain(c, 0, 0, W, H, 0.22, 402, [
    [150, 1],
    [20, 0.5],
  ]);
  // Polish: a soft reflected sheen across the floor.
  const sheen = c.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0.2, "rgba(255,255,255,0)");
  sheen.addColorStop(0.45, "rgba(255,255,255,0.14)");
  sheen.addColorStop(0.7, "rgba(255,255,255,0)");
  c.fillStyle = sheen;
  c.fillRect(0, 0, W, H);
  // Brass border.
  c.strokeStyle = "#c8b06e";
  c.lineWidth = 6;
  rounded(c, 24, 24, W - 48, H - 48, 30);
  c.stroke();
  c.strokeStyle = "rgba(255,240,190,0.5)";
  c.lineWidth = 1.5;
  rounded(c, 38, 38, W - 76, H - 76, 24);
  c.stroke();
  // Stained-glass windows along both long walls, and the coloured light they cast.
  const colors = ["#d97c91", "#e0ba70", "#80b9a8", "#70a9c7", "#8d8dc0", "#b18dbd"];
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(",");
  for (let i = 0; i < 8; i++)
    for (const [y, dir] of [
      [24, 1],
      [818, -1],
    ] as const) {
      const x = 130 + i * 190;
      glow(c, x + 60, y + 29 + dir * 170, 150, 70, rgb(colors[i % 6]), 0.16, 0.5);
    }
  for (let i = 0; i < 8; i++)
    for (const y of [24, 818]) {
      const x = 130 + i * 190;
      c.fillStyle = "#16263a";
      rounded(c, x - 56, y, 112, 58, 14);
      c.fill();
      const tri: [number, number][] = [
        [x - 48, y + 48],
        [x, y + 7],
        [x + 48, y + 48],
      ];
      c.fillStyle = colors[i % 6];
      c.globalAlpha = 0.75;
      fillPoly(c, tri);
      c.globalAlpha = 1;
      c.strokeStyle = "#c8b881";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x - 48, y + 48);
      c.lineTo(x, y + 7);
      c.lineTo(x + 48, y + 48);
      c.moveTo(x, y + 7);
      c.lineTo(x, y + 48);
      c.stroke();
      c.strokeStyle = "rgba(200,184,129,0.8)";
      rounded(c, x - 56, y, 112, 58, 14);
      c.stroke();
    }
  // The skylight's rings (brass), and the colour studs on the outer one.
  inlayRing(c, 1000, 450, 210, 3, "#cdb478", 0.5);
  inlayRing(c, 1000, 450, 310, 3, "#cdb478", 0.5);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      x = 1000 + Math.cos(a) * 310,
      y = 450 + Math.sin(a) * 310;
    c.fillStyle = colors[i % 6];
    fillPoly(c, [
      [x, y - 13],
      [x + 8, y],
      [x, y + 13],
      [x - 8, y],
    ]);
    c.fillStyle = "rgba(255,255,255,0.5)";
    fillPoly(c, [
      [x, y - 13],
      [x + 3, y - 4],
      [x - 3, y - 4],
    ]);
  }
  // Sunlight pouring down through the skylight.
  glow(c, 1000, 450, 360, 360, "255,236,190", 0.22);
  grade(c, 0.3, 0.4);
}

// ─────────────────────────── Conductor Ring (Storm Twins) ───────────────────────────

/** A slate stage, rain-wet, with copper conductor tracks and riveted plates. */
function conductorRing(c: Ctx) {
  tiles(c, 0, 0, W, H, 100, ["#33465c", "#3c5169"], "#1a2738", 501, { radius: 6, bevel: 0.16 });
  // Rivets at the plate corners.
  for (let y = 0; y <= H; y += 100)
    for (let x = 0; x <= W; x += 100) {
      c.fillStyle = "#1b2635";
      ell(c, x, y, 4, 4);
      c.fill();
      c.fillStyle = "#8a9bb0";
      ell(c, x - 0.8, y - 0.8, 2.2, 2.2);
      c.fill();
    }
  grain(c, 0, 0, W, H, 0.3, 502, [
    [140, 1],
    [30, 0.5],
    [3, 0.35],
  ]);
  // Rain sheen: long soft reflections.
  reseed(503);
  c.save();
  c.globalCompositeOperation = "screen";
  for (let k = 0; k < 40; k++) {
    const x = R() * W,
      y = R() * H;
    glow(c, x, y, 50 + R() * 90, 6 + R() * 8, "150,190,230", 0.12, -0.3);
  }
  c.restore();
  // Copper tracks: ellipses with their own highlight.
  const track = (rx: number, ry: number, color: string, width: number, glint: number) => {
    c.strokeStyle = "rgba(0,0,0,0.4)";
    c.lineWidth = width + 3;
    c.beginPath();
    c.ellipse(800, 452, rx, ry, 0, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.ellipse(800, 450, rx, ry, 0, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = `rgba(255,236,200,${glint})`;
    c.lineWidth = Math.max(1, width * 0.35);
    c.beginPath();
    c.ellipse(800, 449, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.7);
    c.stroke();
  };
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    c.strokeStyle = "rgba(210,170,120,0.28)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(800 + Math.cos(a) * 500, 450 + Math.sin(a) * 285);
    c.lineTo(800 + Math.cos(a) * 730, 450 + Math.sin(a) * 380);
    c.stroke();
  }
  track(730, 380, "#c08a55", 6, 0.55);
  track(710, 360, "rgba(140,220,255,0.45)", 2, 0.2);
  track(500, 285, "rgba(192,138,85,0.45)", 2, 0.25);
  inlayRing(c, 800, 450, 150, 2, "rgba(140,220,255,0.3)", 0.15);
  // Storm light: cold from above, a little lightning-blue in the middle.
  glow(c, 800, 450, 700, 420, "120,170,255", 0.1);
  grade(c, 0.12, 0.5);
}

// ─────────────────────────── Cloud Deck (Somnara) ───────────────────────────

/** Soft dream-stone tiles with star inlays, the star circle, and cloud banks at the edges. */
function cloudDeck(c: Ctx) {
  c.fillStyle = "#141c38";
  c.fillRect(0, 0, W, H);
  tiles(c, 0, 0, W, H, 100, ["#3a4a72", "#45577f"], "#212b4c", 601, { radius: 18, checker: 0.04, bevel: 0.2 });
  grain(c, 0, 0, W, H, 0.25, 602, [
    [150, 1],
    [30, 0.5],
  ]);
  // Star inlays in some tiles.
  for (let row = 0; row < 9; row++)
    for (let col = 0; col < 16; col++) {
      if ((row * 7 + col * 3) % 13 !== 0) continue;
      const x = col * 100 + 48,
        y = row * 100 + 50;
      glow(c, x, y, 16, 16, "200,215,255", 0.35);
      c.strokeStyle = "rgba(220,228,255,0.7)";
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(x - 7, y);
      c.lineTo(x + 7, y);
      c.moveTo(x, y - 7);
      c.lineTo(x, y + 7);
      c.stroke();
    }
  // The star circle, with a stud at every hour.
  inlayRing(c, 800, 450, 275, 2.5, "rgba(201,163,255,0.5)", 0.25);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      x = 800 + Math.cos(a) * 275,
      y = 450 + Math.sin(a) * 275;
    glow(c, x, y, 14, 14, "230,220,255", 0.5);
    c.fillStyle = "#e6e4ff";
    ell(c, x, y, 3.5, 3.5);
    c.fill();
  }
  c.strokeStyle = "rgba(190,196,236,0.3)";
  c.lineWidth = 3;
  rounded(c, 28, 28, W - 56, H - 56, 40);
  c.stroke();
  // Cloud banks drifting over the deck's edges.
  reseed(603);
  for (let x = -40; x < W + 80; x += 90) {
    cloud(c, x, -6 + R() * 16, 60 + R() * 30, "#c9d2f0", "rgba(110,120,170,0)", 0.55);
    cloud(c, x + 40, H + 6 - R() * 16, 60 + R() * 30, "#c3cbea", "rgba(110,120,170,0)", 0.55);
  }
  for (let y = 60; y < H - 40; y += 110) {
    cloud(c, -10, y, 50 + R() * 20, "#c3cbea", "rgba(110,120,170,0)", 0.4);
    cloud(c, W + 10, y + 40, 50 + R() * 20, "#c3cbea", "rgba(110,120,170,0)", 0.4);
  }
  // Dream light: soft violet from the middle.
  glow(c, 800, 450, 760, 460, "180,150,255", 0.12);
  vignette(c, "8,10,30", 0.45, 0.4);
}
