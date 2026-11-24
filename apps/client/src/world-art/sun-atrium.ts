/**
 * Prismell's Sun Atrium: cream marble tiles with gold seams under a low white
 * marble kerb; beyond it the atrium hall, a warm mosaic floor between rows of
 * round columns, with sunbeams slanting in and prism glints scattered about.
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
  noiseLayer,
  flagstones,
  wall,
  courtEdgeShadow,
  grade,
  vignette,
  withCourtClip,
  inGrown,
} from "./kit";

const EDGE = hex("#4a3420");

function hall(c: Ctx) {
  const { x, y, width, height } = WORLD;
  // Large warm marble slabs.
  flagstones(c, x, y, width, height, {
    bed: [hex("#b48d5e"), hex("#c9a274")],
    light: [hex("#f3e4c8"), hex("#e2c9a0")],
    dark: [hex("#d6b88c"), hex("#bf9c6e")],
    cols: 18,
    rows: 14,
    gap: 6,
    round: 3,
    merge: 0,
    cracks: 0.05,
    seed: 91,
    bevel: 0.5,
    jitter: 0.01,
  });
  // A mosaic border band round the kerb.
  const rand = rng(92);
  const tile = 16;
  for (let d = 70; d < 150; d += tile)
    for (let s = -d; s < W + d; s += tile)
      for (const [tx, ty] of [
        [s, -d - tile],
        [s, H + d],
      ]) {
        const k = ((s / tile + d / tile) | 0) % 3;
        c.fillStyle = css(
          k === 0 ? hex("#d9a441") : k === 1 ? hex("#f6ead2") : hex("#5f8fb8"),
          0.9,
        );
        c.fillRect(tx + 1, ty + 1, tile - 2, tile - 2);
      }
  for (let d = 70; d < 150; d += tile)
    for (let s = -d; s < H + d; s += tile)
      for (const [tx, ty] of [
        [-d - tile, s],
        [W + d, s],
      ]) {
        const k = ((s / tile + d / tile) | 0) % 3;
        c.fillStyle = css(
          k === 0 ? hex("#d9a441") : k === 1 ? hex("#f6ead2") : hex("#5f8fb8"),
          0.9,
        );
        c.fillRect(tx + 1, ty + 1, tile - 2, tile - 2);
      }
  void rand;
}

function column(c: Ctx, x: number, y: number, r: number) {
  c.save();
  c.shadowColor = "rgba(60,35,10,0.5)";
  c.shadowBlur = 24;
  c.shadowOffsetX = 26;
  c.shadowOffsetY = 32;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = "#efe3cb";
  c.fill();
  c.restore();
  const g = c.createRadialGradient(
    x - r * 0.35,
    y - r * 0.35,
    r * 0.1,
    x,
    y,
    r,
  );
  g.addColorStop(0, "#fffaf0");
  g.addColorStop(0.7, "#eadbbd");
  g.addColorStop(1, "#c9b088");
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  // Fluting and a gold collar.
  c.strokeStyle = "rgba(150,120,80,0.35)";
  c.lineWidth = 2;
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    c.beginPath();
    c.moveTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
    c.lineTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92);
    c.stroke();
  }
  c.strokeStyle = "#d4a845";
  c.lineWidth = 4;
  c.beginPath();
  c.arc(x, y, r * 0.5, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = "rgba(120,90,50,0.7)";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.stroke();
}

function prism(c: Ctx, x: number, y: number, rand: () => number) {
  const hues: [number, number, number][] = [
    [255, 120, 140],
    [255, 210, 100],
    [130, 230, 160],
    [120, 180, 255],
    [190, 140, 255],
  ];
  const a = rand() * Math.PI;
  c.save();
  c.globalCompositeOperation = "lighter";
  hues.forEach((h, i) => {
    const off = (i - 2) * 9;
    blob(c, x + Math.cos(a) * off, y + Math.sin(a) * off, 18, h, 0.28);
  });
  c.restore();
}

function decor(c: Ctx) {
  const rand = rng(93);
  const cols: [number, number][] = [];
  for (let x = -260; x <= W + 260; x += 260) cols.push([x, -260], [x, H + 260]);
  for (let y = 0; y <= H; y += 300) cols.push([-260, y], [W + 260, y]);
  for (let x = -600; x <= W + 600; x += 300) cols.push([x, -620], [x, H + 620]);
  for (let y = -300; y <= H + 300; y += 300) cols.push([-640, y], [W + 640, y]);
  // Sunbeams slanting from the top left.
  c.save();
  c.globalCompositeOperation = "lighter";
  for (let i = 0; i < 9; i++) {
    const bx = WORLD.x + i * 470 + rand() * 120;
    const g = c.createLinearGradient(
      bx,
      WORLD.y,
      bx + 900,
      WORLD.y + WORLD.height,
    );
    g.addColorStop(0, "rgba(255,240,200,0)");
    g.addColorStop(0.5, "rgba(255,240,200,0.10)");
    g.addColorStop(1, "rgba(255,240,200,0)");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(bx, WORLD.y);
    c.lineTo(bx + 140, WORLD.y);
    c.lineTo(bx + 140 + 1500, WORLD.y + WORLD.height);
    c.lineTo(bx + 1500, WORLD.y + WORLD.height);
    c.closePath();
    c.fill();
  }
  c.restore();
  for (const [x, y] of cols) column(c, x, y, 44);
  for (let i = 0; i < 90; i++) {
    const x = WORLD.x + rand() * WORLD.width,
      y = WORLD.y + rand() * WORLD.height;
    if (inGrown(x, y, 70)) continue;
    prism(c, x, y, rand);
  }
}

function court(c: Ctx) {
  withCourtClip(c, () => {
    flagstones(c, 0, 0, W, H, {
      bed: [hex("#c99a42"), hex("#e6bd66")],
      light: [hex("#fbf3e2"), hex("#f0e2c6")],
      dark: [hex("#eadbbd"), hex("#d8c3a0")],
      cols: 16,
      rows: 9,
      gap: 4,
      round: 2,
      merge: 0,
      cracks: 0,
      seed: 95,
      bevel: 0.45,
      jitter: 0.005,
    });
    // Veins of soft blue and gold.
    const rand = rng(96);
    for (let i = 0; i < 30; i++) {
      c.strokeStyle =
        rand() < 0.5 ? "rgba(110,160,190,0.25)" : "rgba(200,150,70,0.25)";
      c.lineWidth = 1.6;
      let vx = rand() * W,
        vy = rand() * H;
      c.beginPath();
      c.moveTo(vx, vy);
      for (let k = 0; k < 8; k++) {
        vx += 15 + rand() * 30;
        vy += 10 + rand() * 30;
        c.lineTo(vx, vy);
      }
      c.stroke();
    }
    noiseLayer(c, 0, 0, W, H, 8, 260, 97, (n) => [
      255,
      240,
      210,
      Math.max(0, n - 0.5) * 90,
    ]);
    courtEdgeShadow(c, 0.8, [80, 50, 20]);
  });
}

function paint(c: Ctx, part: Part) {
  if (part === "court") {
    court(c);
    return;
  }
  hall(c);
  wall(c, 0, 44, {
    base: hex("#efe4cf"),
    light: hex("#fffaf0"),
    dark: hex("#c8b493"),
    line: hex("#8a6a3a"),
    block: 80,
    courses: 1,
    seed: 98,
  });
  c.beginPath();
  c.roundRect(-40, -40, W + 80, H + 80, 22);
  c.strokeStyle = "#d4a845";
  c.lineWidth = 4;
  c.stroke();
  court(c);
  decor(c);
  grade(c, hex("#fff3d6"), hex("#6a4a28"), 0.3);
  vignette(c, EDGE, 1000, 2100, 0.55);
  void mix;
}

export const sunAtrium: WorldPainter = { paint, edge: css(EDGE) };
