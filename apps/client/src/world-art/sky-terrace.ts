/**
 * Lumiwick's Sky Terrace: dark basalt slabs with embers glowing in the
 * joints, a parapet of black stone with hot cracks, and a volcanic field
 * beyond, black rock split by glowing lava channels under drifting smoke.
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
  css,
  blob,
  stonePath,
  inGrown,
  noiseLayer,
  flagstones,
  fbm,
  wall,
  courtEdgeShadow,
  glows,
  grade,
  vignette,
  withCourtClip,
  ramp,
} from "./kit";

const EDGE = hex("#170b08");

function lavaField(c: Ctx) {
  const { x, y, width, height } = WORLD;
  noiseLayer(c, x, y, width, height, 7, 1, 101, (_n, wx, wy) => {
    const rock = fbm(wx / 260, wy / 260, 102, 4);
    const crack = Math.abs(fbm(wx / 420, wy / 420, 103, 4) - 0.5);
    const lava = Math.max(0, 1 - crack * 22);
    const base = ramp([hex("#1b1210"), hex("#2e201b"), hex("#45322a")], rock);
    const hot = ramp([hex("#8a1d0c"), hex("#ff5a1a"), hex("#ffd36a")], lava);
    const t = Math.min(1, lava * 1.4);
    return [
      base[0] + (hot[0] - base[0]) * t,
      base[1] + (hot[1] - base[1]) * t,
      base[2] + (hot[2] - base[2]) * t,
      255,
    ];
  });
  // Glow round the channels.
  noiseLayer(c, x, y, width, height, 12, 1, 104, (_n, wx, wy) => {
    const crack = Math.abs(fbm(wx / 420, wy / 420, 103, 4) - 0.5);
    const g = Math.max(0, 1 - crack * 7);
    return [255, 90, 30, g * g * 90];
  });
  const rand = rng(105);
  for (let i = 0; i < 180; i++) {
    const bx = x + rand() * width,
      by = y + rand() * height;
    if (inGrown(bx, by, 160)) continue;
    const r = 10 + rand() * rand() * 60;
    blob(c, bx + r * 0.4, by + r * 0.5, r * 1.4, [0, 0, 0], 0.5);
    stonePath(c, bx - r, by - r * 0.8, r * 2, r * 1.6, rand, r * 0.5, 0.25);
    const g = c.createLinearGradient(bx - r, by - r, bx + r, by + r);
    g.addColorStop(0, "#5a4438");
    g.addColorStop(1, "#140c0a");
    c.fillStyle = g;
    c.fill();
  }
  // Drifting smoke.
  noiseLayer(c, x, y, width, height, 12, 500, 106, (n) => [
    60,
    45,
    45,
    Math.max(0, n - 0.55) * 260,
  ]);
}

function court(c: Ctx) {
  withCourtClip(c, () => {
    flagstones(c, 0, 0, W, H, {
      bed: [hex("#5e1a0c"), hex("#c2421a")],
      light: [hex("#5a4a44"), hex("#463832")],
      dark: [hex("#3b2e2a"), hex("#261c19")],
      cols: 11,
      rows: 6,
      gap: 7,
      round: 8,
      merge: 0.2,
      cracks: 0.4,
      seed: 111,
      bevel: 0.8,
      jitter: 0.14,
    });
    // Embers glowing through the joints, brightest at the middle.
    noiseLayer(c, 0, 0, W, H, 6, 140, 112, (n, wx, wy) => {
      const mid = 1 - Math.hypot((wx - W / 2) / W, (wy - H / 2) / H) * 1.4;
      return [255, 120, 40, Math.max(0, n - 0.55) * 160 * Math.max(0.2, mid)];
    });
    courtEdgeShadow(c, 1.1, [5, 2, 1]);
  });
}

const fires = (() => {
  const s: { x: number; y: number }[] = [];
  for (const fx of [0, 0.25, 0.5, 0.75, 1])
    s.push({ x: W * fx, y: -30 }, { x: W * fx, y: H + 30 });
  for (const fy of [0.33, 0.67])
    s.push({ x: -30, y: H * fy }, { x: W + 30, y: H * fy });
  return s;
})();

function paint(c: Ctx, part: Part) {
  if (part === "court") {
    court(c);
    return;
  }
  lavaField(c);
  wall(c, 0, 60, {
    base: hex("#3a2c27"),
    light: hex("#6b564b"),
    dark: hex("#1a1210"),
    line: hex("#ff6a2a"),
    block: 60,
    courses: 2,
    seed: 113,
  });
  court(c);
  for (const f of fires) {
    blob(c, f.x + 4, f.y + 6, 20, [0, 0, 0], 0.5);
    c.fillStyle = "#1e1512";
    c.beginPath();
    c.arc(f.x, f.y, 15, 0, Math.PI * 2);
    c.fill();
    const g = c.createRadialGradient(f.x - 2, f.y - 2, 1, f.x, f.y, 11);
    g.addColorStop(0, "#fff3c0");
    g.addColorStop(0.4, "#ffae3c");
    g.addColorStop(1, "#c2300e");
    c.fillStyle = g;
    c.beginPath();
    c.arc(f.x, f.y, 11, 0, Math.PI * 2);
    c.fill();
  }
  glows(c, fires, [255, 120, 40], 150, 0.28);
  grade(c, hex("#ffb070"), hex("#200a05"), 0.32);
  vignette(c, EDGE);
}

export const skyTerrace: WorldPainter = { paint, edge: css(EDGE) };
