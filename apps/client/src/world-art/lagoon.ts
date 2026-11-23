/**
 * Tidelotl's Lagoon: a sunken court of pale tiles under clear shallow water,
 * a mossy stone rim, and a coral reef in turquoise water beyond, deepening to
 * blue at the edges.
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
  noiseLayer,
  flagstones,
  valueNoise,
  fbm,
  wall,
  courtEdgeShadow,
  grade,
  vignette,
  withCourtClip,
  ramp,
} from "./kit";

const EDGE = hex("#0b2f4a");
const DEEP = hex("#0e4f73"),
  MID = hex("#178a9c"),
  SHALLOW = hex("#3fc2bf"),
  SAND = hex("#d9cf9c");

/** Sunlit ripples: bright threads where two noises cross. */
function caustics(
  c: Ctx,
  x0: number,
  y0: number,
  w: number,
  h: number,
  seed: number,
  alpha: number,
  cell = 3,
) {
  noiseLayer(c, x0, y0, w, h, cell, 1, seed, (_n, wx, wy) => {
    const a = fbm(wx / 70, wy / 70, seed, 3),
      b = fbm(wx / 55 + 9, wy / 55 - 4, seed + 5, 3);
    const line = Math.max(0, 1 - Math.abs(a - b) * 9);
    return [235, 255, 250, Math.min(255, line * line * 255 * alpha)];
  });
}

function sea(c: Ctx) {
  const { x, y, width, height } = WORLD;
  noiseLayer(c, x, y, width, height, 8, 1, 3, (_n, wx, wy) => {
    // Shallow near the court, deeper further out, with sandy shoals.
    const d = Math.max(0, Math.max(-wx, wx - W, -wy, wy - H));
    const shoal = fbm(wx / 380, wy / 380, 4);
    const depth = Math.min(1, d / 900) * 0.8 + (0.55 - shoal) * 0.9;
    const col = ramp([SAND, SHALLOW, MID, DEEP], 0.25 + depth);
    return [col[0], col[1], col[2], 255];
  });
  caustics(c, x, y, width, height, 21, 0.16, 6);
}

function coral(c: Ctx, cx: number, cy: number, rand: () => number) {
  const hues = [hex("#ff8fa8"), hex("#c77dff"), hex("#ffb37a"), hex("#7ee0d0")];
  const col = hues[(rand() * hues.length) | 0];
  blob(c, cx + 6, cy + 8, 52, [5, 40, 60], 0.35);
  blob(c, cx, cy, 34, col, 0.45);
  const n = 6 + ((rand() * 5) | 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand();
    const len = 18 + rand() * 26;
    c.strokeStyle = css(mix(col, [255, 255, 255], 0.15));
    c.lineWidth = 8;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(cx, cy);
    const mx = cx + Math.cos(a) * len * 0.6 + (rand() - 0.5) * 10,
      my = cy + Math.sin(a) * len * 0.6 + (rand() - 0.5) * 10;
    c.quadraticCurveTo(mx, my, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    c.stroke();
    c.fillStyle = css(mix(col, [255, 255, 255], 0.45));
    c.beginPath();
    c.arc(cx + Math.cos(a) * len, cy + Math.sin(a) * len, 4, 0, Math.PI * 2);
    c.fill();
  }
  c.lineCap = "butt";
  c.fillStyle = css(mix(col, [0, 0, 0], 0.2));
  c.beginPath();
  c.arc(cx, cy, 7, 0, Math.PI * 2);
  c.fill();
}

function rock(c: Ctx, x: number, y: number, r: number, rand: () => number) {
  blob(c, x + r * 0.3, y + r * 0.4, r * 1.4, [4, 30, 45], 0.45);
  stonePath(c, x - r, y - r * 0.8, r * 2, r * 1.6, rand, r * 0.8);
  const g = c.createRadialGradient(
    x - r * 0.3,
    y - r * 0.3,
    r * 0.1,
    x,
    y,
    r * 1.2,
  );
  g.addColorStop(0, "#9fb5a6");
  g.addColorStop(0.6, "#5f7f74");
  g.addColorStop(1, "#2c4a48");
  c.fillStyle = g;
  c.fill();
  // Moss on the top.
  blob(c, x - r * 0.2, y - r * 0.3, r * 0.7, [110, 170, 90], 0.45);
}

function reef(c: Ctx) {
  const rand = rng(44);
  for (let i = 0; i < 160; i++) {
    const x = WORLD.x + rand() * WORLD.width,
      y = WORLD.y + rand() * WORLD.height;
    if (inGrown(x, y, 150)) continue;
    rock(c, x, y, 10 + rand() * rand() * 55, rand);
  }
  for (let i = 0; i < 130; i++) {
    const x = WORLD.x + rand() * WORLD.width,
      y = WORLD.y + rand() * WORLD.height;
    if (inGrown(x, y, 130)) continue;
    coral(c, x, y, rand);
  }
  // Sea grass.
  for (let i = 0; i < 900; i++) {
    const x = WORLD.x + rand() * WORLD.width,
      y = WORLD.y + rand() * WORLD.height;
    if (inGrown(x, y, 110)) continue;
    c.strokeStyle = css(mix(hex("#2f9a6e"), hex("#8fdc8a"), rand()), 0.7);
    c.lineWidth = 2;
    c.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = rand() * Math.PI * 2,
        l = 8 + rand() * 12;
      c.moveTo(x, y);
      c.quadraticCurveTo(
        x + Math.cos(a + 0.5) * l * 0.6,
        y + Math.sin(a + 0.5) * l * 0.6,
        x + Math.cos(a) * l,
        y + Math.sin(a) * l,
      );
    }
    c.stroke();
  }
  // Ruined pillars at the four corners, standing in the water.
  for (const [x, y] of [
    [-150, -150],
    [W + 150, -150],
    [-150, H + 150],
    [W + 150, H + 150],
  ]) {
    blob(c, x + 14, y + 18, 70, [4, 30, 45], 0.5);
    c.fillStyle = "#a9b8a8";
    c.beginPath();
    c.arc(x, y, 44, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#6f857a";
    c.lineWidth = 5;
    c.stroke();
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      c.strokeStyle = "rgba(60,80,72,0.5)";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x + Math.cos(a) * 28, y + Math.sin(a) * 28);
      c.lineTo(x + Math.cos(a) * 42, y + Math.sin(a) * 42);
      c.stroke();
    }
    blob(c, x - 10, y - 12, 30, [255, 255, 240], 0.35);
    blob(c, x + 12, y + 8, 26, [100, 160, 90], 0.5);
  }
}

function court(c: Ctx) {
  withCourtClip(c, () => {
    flagstones(c, 0, 0, W, H, {
      bed: [hex("#4e8f8a"), hex("#6aa9a0")],
      light: [hex("#e2e6cf"), hex("#c4d2bc")],
      dark: [hex("#a7bfae"), hex("#7fa196")],
      cols: 14,
      rows: 8,
      gap: 7,
      round: 9,
      merge: 0.18,
      cracks: 0.18,
      seed: 12,
      bevel: 0.7,
    });
    // Algae in the joints and on the stones near the rim.
    noiseLayer(c, 0, 0, W, H, 6, 120, 31, (n, wx, wy) => {
      const edge = Math.min(wx, wy, W - wx, H - wy);
      const a = Math.max(0, n - 0.6) * 1.4 + Math.max(0, 1 - edge / 110) * 0.35;
      return [70, 140, 90, Math.min(160, a * 255)];
    });
    // The water over it all: tint, gentle depth variation, sun ripples.
    noiseLayer(c, 0, 0, W, H, 8, 260, 17, (n) => {
      const col = mix(SHALLOW, MID, 0.25 + n * 0.5);
      return [col[0], col[1], col[2], 120];
    });
    caustics(c, 0, 0, W, H, 8, 0.3);
    courtEdgeShadow(c, 0.9, [4, 40, 55]);
  });
}

function paint(c: Ctx, part: Part) {
  if (part === "court") {
    court(c);
    return;
  }
  sea(c);
  reef(c);
  wall(c, 0, 60, {
    base: hex("#8aa197"),
    light: hex("#c8d6c6"),
    dark: hex("#4c6660"),
    line: hex("#1d3332"),
    block: 62,
    courses: 2,
    seed: 19,
  });
  // Moss and barnacles along the rim.
  const rand = rng(8);
  for (let i = 0; i < 160; i++) {
    const side = rand() * 4;
    const t = rand();
    const d = 6 + rand() * 48;
    const [x, y] =
      side < 1
        ? [t * W, -d]
        : side < 2
          ? [t * W, H + d]
          : side < 3
            ? [-d, t * H]
            : [W + d, t * H];
    blob(
      c,
      x,
      y,
      8 + rand() * 18,
      rand() < 0.7 ? [90, 150, 80] : [230, 230, 210],
      0.45,
    );
  }
  court(c);
  // Foam where the water laps the outside of the rim.
  c.save();
  c.lineWidth = 6;
  c.setLineDash([18, 10, 6, 12]);
  c.strokeStyle = "rgba(240,255,250,0.5)";
  c.beginPath();
  c.roundRect(-66, -66, W + 132, H + 132, 36);
  c.stroke();
  c.restore();
  grade(c, hex("#e6fff5"), hex("#05304a"), 0.3);
  vignette(c, EDGE);
  void valueNoise;
}

export const lagoon: WorldPainter = { paint, edge: css(EDGE) };
