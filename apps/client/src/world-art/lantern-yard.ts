/**
 * Inkpurr's Lantern Yard: moonlit violet flagstones, one per Grasping Hands
 * tile (8 × 5), inside a low dark wall with ivy; beyond it a night garden of
 * cobbled paths, clipped hedges, tree crowns, flower beds and lantern posts
 * throwing amber pools.
 */
import {
  type Ctx,
  type Part,
  type WorldPainter,
  W,
  H,
  WORLD,
  rng,
  hex,
  mix,
  css,
  blob,
  stonePath,
  inGrown,
  worldNoise,
  flagstones,
  noiseLayer,
  wall,
  courtEdgeShadow,
  glows,
  grade,
  vignette,
  withCourtClip,
  ring,
  type RGB,
} from "./kit";

const EDGE = hex("#120f26");
const LEAF = hex("#3d3a6e"),
  LEAF_LIGHT = hex("#6d6aa8"),
  LEAF_DARK = hex("#1d1b3c"),
  AMBER: RGB = [255, 184, 92];

const lanterns = (() => {
  const s: { x: number; y: number }[] = [];
  for (const fx of [0.25, 0.75])
    s.push({ x: W * fx, y: -120 }, { x: W * fx, y: H + 120 });
  for (const fy of [0.5])
    s.push({ x: -120, y: H * fy }, { x: W + 120, y: H * fy });
  for (const [x, y] of [
    [-120, -120],
    [W + 120, -120],
    [-120, H + 120],
    [W + 120, H + 120],
    [-520, 200],
    [W + 520, 700],
    [400, -520],
    [1200, H + 520],
  ])
    s.push({ x, y });
  return s;
})();

function cobbles(c: Ctx, a: number, b: number, seed: number) {
  // A cobbled path round the wall between ring offsets a..b.
  const rand = rng(seed);
  c.save();
  c.beginPath();
  ring(c, b);
  ring(c, a);
  c.clip("evenodd");
  c.fillStyle = "#2a2748";
  c.fillRect(-b, -b, W + 2 * b, H + 2 * b);
  for (let y = -b; y < H + b; y += 22)
    for (let x = -b + ((y / 22) % 2) * 11; x < W + b; x += 22) {
      if (!inGrown(x, y, b) || inGrown(x, y, a)) continue;
      stonePath(c, x, y, 19, 18, rand, 6, 0.3);
      c.fillStyle = css(mix(hex("#5a5688"), hex("#3a3766"), rand()));
      c.fill();
    }
  c.restore();
}

function hedge(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  rand: () => number,
) {
  c.save();
  c.shadowColor = "rgba(0,0,0,0.55)";
  c.shadowBlur = 16;
  c.shadowOffsetX = 8;
  c.shadowOffsetY = 12;
  c.beginPath();
  c.roundRect(x, y, w, h, 18);
  c.fillStyle = css(LEAF);
  c.fill();
  c.restore();
  c.save();
  c.beginPath();
  c.roundRect(x, y, w, h, 18);
  c.clip();
  for (let i = 0; i < (w * h) / 160; i++) {
    const px = x + rand() * w,
      py = y + rand() * h;
    blob(c, px, py, 6 + rand() * 9, rand() < 0.5 ? LEAF_LIGHT : LEAF_DARK, 0.5);
  }
  const g = c.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "rgba(190,190,255,0.25)");
  g.addColorStop(1, "rgba(0,0,20,0.35)");
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  c.restore();
}

function tree(c: Ctx, x: number, y: number, r: number, rand: () => number) {
  blob(c, x + r * 0.35, y + r * 0.45, r * 1.5, [0, 0, 10], 0.6);
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2,
      d = rand() * r * 0.45;
    const rr = r * (0.45 + rand() * 0.3);
    const px = x + Math.cos(a) * d,
      py = y + Math.sin(a) * d;
    const g = c.createRadialGradient(
      px - rr * 0.3,
      py - rr * 0.3,
      rr * 0.1,
      px,
      py,
      rr,
    );
    g.addColorStop(0, css(LEAF_LIGHT));
    g.addColorStop(0.6, css(LEAF));
    g.addColorStop(1, css(LEAF_DARK));
    c.fillStyle = g;
    c.beginPath();
    c.arc(px, py, rr, 0, Math.PI * 2);
    c.fill();
  }
  for (let i = 0; i < 14; i++)
    blob(
      c,
      x + (rand() - 0.5) * r * 1.4,
      y + (rand() - 0.5) * r * 1.4,
      4 + rand() * 4,
      [200, 160, 255],
      0.6,
    );
}

function lanternPost(c: Ctx, x: number, y: number) {
  blob(c, x + 6, y + 8, 22, [0, 0, 0], 0.5);
  c.fillStyle = "#1c1a30";
  c.beginPath();
  c.roundRect(x - 13, y - 13, 26, 26, 5);
  c.fill();
  c.strokeStyle = "#6f6390";
  c.lineWidth = 2;
  c.stroke();
  const g = c.createRadialGradient(x, y, 1, x, y, 10);
  g.addColorStop(0, "#fff6d8");
  g.addColorStop(0.5, "#ffc066");
  g.addColorStop(1, "#b5651d");
  c.fillStyle = g;
  c.beginPath();
  c.roundRect(x - 8, y - 8, 16, 16, 3);
  c.fill();
}

function garden(c: Ctx) {
  worldNoise(
    c,
    [hex("#1f1d3f"), hex("#2b2955"), hex("#24234a"), hex("#1a1836")],
    300,
    51,
    8,
    1.4,
  );
  const rand = rng(52);
  // Flower beds: soft violet and pale blossoms.
  for (let i = 0; i < 1800; i++) {
    const x = WORLD.x + rand() * WORLD.width,
      y = WORLD.y + rand() * WORLD.height;
    if (inGrown(x, y, 200)) continue;
    const pick = rand();
    blob(
      c,
      x,
      y,
      3 + rand() * 4,
      pick < 0.5
        ? [170, 120, 240]
        : pick < 0.8
          ? [220, 200, 255]
          : [255, 180, 220],
      0.7,
    );
  }
  // Hedges framing the yard, with gaps for paths.
  for (const [x, y, w, h] of [
    [-360, -330, 640, 70],
    [520, -330, 560, 70],
    [1320, -330, 640, 70],
    [-360, H + 260, 640, 70],
    [520, H + 260, 560, 70],
    [1320, H + 260, 640, 70],
    [-330, -200, 70, 520],
    [-330, 580, 70, 520],
    [W + 260, -200, 70, 520],
    [W + 260, 580, 70, 520],
  ])
    hedge(c, x, y, w, h, rand);
  for (let i = 0; i < 70; i++) {
    const x = WORLD.x + rand() * WORLD.width,
      y = WORLD.y + rand() * WORLD.height;
    if (inGrown(x, y, 420)) continue;
    tree(c, x, y, 50 + rand() * 60, rand);
  }
  cobbles(c, 58, 200, 53);
}

function court(c: Ctx) {
  withCourtClip(c, () => {
    flagstones(c, 0, 0, W, H, {
      bed: [hex("#16152c"), hex("#22213f")],
      light: [hex("#8a86c4"), hex("#6f6aac")],
      dark: [hex("#5d5898"), hex("#433f78")],
      cols: 8,
      rows: 5,
      gap: 10,
      round: 14,
      merge: 0,
      cracks: 0.35,
      seed: 61,
    });
    // Each tile split into a few slabs, inside its own outline.
    const rand = rng(62);
    c.strokeStyle = "rgba(20,18,40,0.55)";
    c.lineWidth = 2;
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 8; i++) {
        const x = i * 200,
          y = j * 180;
        c.beginPath();
        if (rand() < 0.5) {
          const sx = x + 60 + rand() * 80;
          c.moveTo(sx, y + 8);
          c.lineTo(sx + (rand() - 0.5) * 20, y + 172);
        } else {
          const sy = y + 50 + rand() * 80;
          c.moveTo(x + 8, sy);
          c.lineTo(x + 192, sy + (rand() - 0.5) * 20);
        }
        c.stroke();
      }
    // Moss in the joints, moonlight from the top left.
    noiseLayer(c, 0, 0, W, H, 6, 110, 63, (n) => [
      80,
      120,
      110,
      Math.max(0, n - 0.62) * 400,
    ]);
    const moon = c.createLinearGradient(0, 0, W, H);
    moon.addColorStop(0, "rgba(190,200,255,0.16)");
    moon.addColorStop(1, "rgba(10,8,30,0.25)");
    c.fillStyle = moon;
    c.fillRect(0, 0, W, H);
    courtEdgeShadow(c, 1.1, [8, 6, 20]);
  });
}

function paint(c: Ctx, part: Part) {
  if (part === "court") {
    court(c);
    return;
  }
  garden(c);
  wall(c, 0, 58, {
    base: hex("#4a4672"),
    light: hex("#8c86c0"),
    dark: hex("#26234a"),
    line: hex("#0e0c20"),
    block: 56,
    courses: 2,
    seed: 64,
  });
  // Ivy over the wall.
  const rand = rng(65);
  for (let i = 0; i < 260; i++) {
    const side = rand() * 4,
      t = rand(),
      d = rand() * 58;
    const [x, y] =
      side < 1
        ? [t * W, -d]
        : side < 2
          ? [t * W, H + d]
          : side < 3
            ? [-d, t * H]
            : [W + d, t * H];
    blob(c, x, y, 5 + rand() * 9, rand() < 0.6 ? LEAF_LIGHT : LEAF, 0.7);
  }
  court(c);
  for (const l of lanterns) lanternPost(c, l.x, l.y);
  glows(c, lanterns, AMBER, 170, 0.3);
  grade(c, hex("#b8c2ff"), hex("#0a0820"), 0.35);
  vignette(c, EDGE);
}

export const lanternYard: WorldPainter = { paint, edge: css(EDGE) };
