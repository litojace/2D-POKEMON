/**
 * Cragmuff's Coliseum: a sunlit sand court of worn flagstones inside a cut
 * stone wall, tiered stands with braziers, blue banners and amber crystals,
 * and dusty rocky ground beyond.
 */
import {
  type Ctx,
  type Part,
  type RGB,
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
  noiseLayer,
  flagstones,
  specks,
  wall,
  tiers,
  ring,
  courtEdgeShadow,
  glows,
  grade,
  vignette,
  withCourtClip,
} from "./kit";

const EDGE = hex("#3a2a1c");
const STONE = hex("#b7a184"),
  STONE_LIGHT = hex("#ddcdb0"),
  STONE_DARK = hex("#7d6a54"),
  MORTAR = hex("#4a3826"),
  ROCK = hex("#8f7a64"),
  ROCK_DARK = hex("#55463a"),
  SAND = hex("#d8b07a"),
  AMBER = hex("#ffb63d"),
  BANNER = hex("#2f4380"),
  BANNER_LIGHT = hex("#4d68b0"),
  GOLD = hex("#e9c065");

const WALL_IN = 0,
  WALL_OUT = 64,
  TIER_EDGES = [64, 120, 176, 232, 288, 344],
  OUTER = [344, 404];

function ground(c: Ctx) {
  worldNoise(
    c,
    [hex("#b88d5a"), hex("#c9a06c"), hex("#a8814f"), hex("#8b6f52")],
    520,
    11,
  );
  noiseLayer(
    c,
    WORLD.x,
    WORLD.y,
    WORLD.width,
    WORLD.height,
    10,
    300,
    23,
    (n) => [
      ROCK_DARK[0],
      ROCK_DARK[1],
      ROCK_DARK[2],
      Math.min(170, Math.max(0, (n - 0.62) / 0.38) * 300),
    ],
  );
  const rand = rng(77);
  for (let i = 0; i < 300; i++) {
    const bx = WORLD.x + rand() * WORLD.width,
      by = WORLD.y + rand() * WORLD.height;
    if (inGrown(bx, by, OUTER[1] + 60)) continue;
    const r = 8 + rand() * rand() * 64;
    c.fillStyle = "rgba(40,26,14,0.32)";
    c.beginPath();
    c.ellipse(
      bx + r * 0.4,
      by + r * 0.45,
      r * 1.05,
      r * 0.8,
      0.3,
      0,
      Math.PI * 2,
    );
    c.fill();
    stonePath(c, bx - r, by - r * 0.8, r * 2, r * 1.6, rand, r * 0.9);
    const g = c.createRadialGradient(
      bx - r * 0.35,
      by - r * 0.35,
      r * 0.1,
      bx,
      by,
      r * 1.2,
    );
    g.addColorStop(0, css(hex("#e4caa2")));
    g.addColorStop(0.55, css(mix(ROCK, hex("#a0784e"), 0.4)));
    g.addColorStop(1, css(ROCK_DARK));
    c.fillStyle = g;
    c.fill();
  }
  for (let i = 0; i < 2400; i++) {
    const px = WORLD.x + rand() * WORLD.width,
      py = WORLD.y + rand() * WORLD.height;
    if (inGrown(px, py, OUTER[1] + 30)) continue;
    if (rand() < 0.3) {
      c.strokeStyle = css(mix(hex("#7f7d3d"), hex("#c2b064"), rand()), 0.8);
      c.lineWidth = 1.6;
      c.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (rand() - 0.5) * 1.7,
          len = 6 + rand() * 10;
        c.moveTo(px, py);
        c.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
      }
      c.stroke();
    } else {
      const r = 1.5 + rand() * 3.5;
      c.fillStyle = css(mix(ROCK, STONE_LIGHT, rand()), 0.9);
      c.beginPath();
      c.ellipse(px, py, r, r * 0.75, rand() * 3, 0, Math.PI * 2);
      c.fill();
    }
  }
}

function stands(c: Ctx) {
  // Stone base under the stands.
  c.save();
  c.beginPath();
  ring(c, OUTER[1]);
  c.clip();
  noiseLayer(
    c,
    -OUTER[1],
    -OUTER[1],
    W + 2 * OUTER[1],
    H + 2 * OUTER[1],
    6,
    160,
    41,
    (n) => {
      const col = mix(STONE_DARK, STONE, 0.4 + n * 0.6);
      return [col[0], col[1], col[2], 255];
    },
  );
  tiers(c, TIER_EDGES, mix(STONE_LIGHT, STONE, 0.3), hex("#5c4834"), 31);
  c.restore();
  wall(c, OUTER[0], OUTER[1], {
    base: STONE,
    light: STONE_LIGHT,
    dark: STONE_DARK,
    line: MORTAR,
    block: 64,
    courses: 2,
    seed: 63,
  });
}

function banner(c: Ctx, x: number, y: number, nx: number, ny: number) {
  // Hung outwards from the wall top, over the first tier.
  const len = 100,
    half = 30;
  const ox = -nx,
    oy = -ny,
    tx = -oy,
    ty = ox;
  const p = (s: number, t: number): [number, number] => [
    x + ox * s + tx * t,
    y + oy * s + ty * t,
  ];
  const shape = (dx: number, dy: number) => {
    const q = (s: number, t: number) => {
      const [a, b] = p(s, t);
      return [a + dx, b + dy] as const;
    };
    c.beginPath();
    c.moveTo(...q(0, -half));
    c.lineTo(...q(len, -half));
    c.lineTo(...q(len - 18, 0));
    c.lineTo(...q(len, half));
    c.lineTo(...q(0, half));
    c.closePath();
  };
  shape(8, 11);
  c.fillStyle = "rgba(30,18,8,0.35)";
  c.fill();
  shape(0, 0);
  const [g0x, g0y] = p(0, -half),
    [g1x, g1y] = p(0, half);
  const g = c.createLinearGradient(g0x, g0y, g1x, g1y);
  g.addColorStop(0, css(BANNER_LIGHT));
  g.addColorStop(0.45, css(BANNER));
  g.addColorStop(1, css(mix(BANNER, [0, 0, 0], 0.4)));
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = css(GOLD, 0.95);
  c.lineWidth = 3;
  c.stroke();
  // A gold diamond with a ram's-horn arc above it.
  const d = [
    p(len * 0.24, 0),
    p(len * 0.42, -12),
    p(len * 0.6, 0),
    p(len * 0.42, 12),
  ];
  c.beginPath();
  c.moveTo(...d[0]);
  for (const q of d.slice(1)) c.lineTo(...q);
  c.closePath();
  c.fillStyle = css(GOLD);
  c.fill();
  const [r0x, r0y] = p(-5, -half - 7),
    [r1x, r1y] = p(-5, half + 7);
  c.strokeStyle = "#4b3725";
  c.lineWidth = 6;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(r0x, r0y);
  c.lineTo(r1x, r1y);
  c.stroke();
  c.lineCap = "butt";
}

function crystals(c: Ctx, cx: number, cy: number, rand: () => number) {
  for (let i = 0; i < 10; i++) {
    const a = rand() * Math.PI * 2,
      d = 34 + rand() * 46,
      r = 8 + rand() * 14;
    const x = cx + Math.cos(a) * d,
      y = cy + Math.sin(a) * d;
    c.fillStyle = "rgba(40,26,14,0.3)";
    c.beginPath();
    c.ellipse(x + 5, y + 6, r, r * 0.8, 0, 0, Math.PI * 2);
    c.fill();
    stonePath(c, x - r, y - r * 0.8, r * 2, r * 1.6, rand, r * 0.6);
    c.fillStyle = css(mix(STONE, STONE_DARK, rand()));
    c.fill();
  }
  glows(c, [{ x: cx, y: cy }], [255, 180, 70], 140, 0.35);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.6;
    const len = 30 + rand() * 32,
      wid = 9 + rand() * 6;
    const bx = cx + Math.cos(a) * 6,
      by = cy + Math.sin(a) * 6;
    const tx = bx + Math.cos(a) * len,
      ty = by + Math.sin(a) * len;
    const px = -Math.sin(a) * wid,
      py = Math.cos(a) * wid;
    const mx = bx + Math.cos(a) * len * 0.45,
      my = by + Math.sin(a) * len * 0.45;
    c.beginPath();
    c.moveTo(bx, by);
    c.lineTo(mx + px, my + py);
    c.lineTo(tx, ty);
    c.lineTo(mx - px, my - py);
    c.closePath();
    const g = c.createLinearGradient(mx + px, my + py, mx - px, my - py);
    g.addColorStop(0, "#fff3c2");
    g.addColorStop(0.45, css(AMBER));
    g.addColorStop(1, "#a9520c");
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = "rgba(110,52,8,0.75)";
    c.lineWidth = 1.2;
    c.stroke();
    c.strokeStyle = "rgba(255,250,225,0.8)";
    c.beginPath();
    c.moveTo(bx, by);
    c.lineTo(tx, ty);
    c.stroke();
  }
}

const braziers = (() => {
  const s: { x: number; y: number }[] = [];
  const m = WALL_OUT / 2;
  for (const fx of [0.1, 0.5, 0.9])
    s.push({ x: W * fx, y: -m }, { x: W * fx, y: H + m });
  for (const fy of [0.22, 0.78])
    s.push({ x: -m, y: H * fy }, { x: W + m, y: H * fy });
  s.push(
    { x: -m, y: -m },
    { x: W + m, y: -m },
    { x: -m, y: H + m },
    { x: W + m, y: H + m },
  );
  return s;
})();

function brazier(c: Ctx, x: number, y: number) {
  c.fillStyle = "rgba(25,15,8,0.4)";
  c.beginPath();
  c.arc(x + 5, y + 7, 17, 0, Math.PI * 2);
  c.fill();
  const rim = c.createRadialGradient(x - 4, y - 4, 2, x, y, 17);
  rim.addColorStop(0, "#7d6146");
  rim.addColorStop(1, "#2e2116");
  c.fillStyle = rim;
  c.beginPath();
  c.arc(x, y, 16, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#a07c55";
  c.lineWidth = 2;
  c.stroke();
  const fire = c.createRadialGradient(x - 2, y - 3, 1, x, y, 12);
  fire.addColorStop(0, "#fff6c8");
  fire.addColorStop(0.35, "#ffc35a");
  fire.addColorStop(0.75, "#e2611f");
  fire.addColorStop(1, "#7a2410");
  c.fillStyle = fire;
  c.beginPath();
  c.arc(x, y, 11, 0, Math.PI * 2);
  c.fill();
}

function court(c: Ctx) {
  withCourtClip(c, () => {
    flagstones(c, 0, 0, W, H, {
      bed: [hex("#8f6a40"), hex("#b48a58")],
      light: [hex("#ead8b5"), hex("#cfae80")],
      dark: [hex("#c6a982"), hex("#9f7d56")],
      cols: 12,
      rows: 7,
      gap: 8,
      round: 12,
      merge: 0.22,
      cracks: 0.32,
      seed: 5,
    });
    // Sand drifted against the walls and in patches.
    noiseLayer(c, 0, 0, W, H, 6, 140, 9, (n, wx, wy) => {
      const edge = Math.min(wx, wy, W - wx, H - wy);
      const drift =
        Math.max(0, 1 - edge / 90) * 0.5 + Math.max(0, n - 0.66) * 1.2;
      return [SAND[0], SAND[1], SAND[2], Math.min(210, drift * 255)];
    });
    specks(c, 0, 0, W, H, 6000, 15, [
      "rgba(255,240,205,0.35)",
      "rgba(100,70,40,0.25)",
    ]);
    courtEdgeShadow(c, 1.1);
  });
}

function paint(c: Ctx, part: Part) {
  if (part === "court") {
    court(c);
    return;
  }
  ground(c);
  stands(c);
  wall(c, WALL_IN, WALL_OUT, {
    base: hex("#a48d70"),
    light: hex("#d4c2a2"),
    dark: hex("#6d5a45"),
    line: hex("#2f2216"),
    block: 58,
    courses: 2,
    seed: 7,
  });
  court(c);
  const rand = rng(91);
  for (const fx of [0.3, 0.7]) {
    banner(c, W * fx, -WALL_OUT / 2, 0, 1);
    banner(c, W * fx, H + WALL_OUT / 2, 0, -1);
  }
  banner(c, -WALL_OUT / 2, H / 2, 1, 0);
  banner(c, W + WALL_OUT / 2, H / 2, -1, 0);
  for (const [x, y] of [
    [-170, -170],
    [W + 170, -170],
    [-170, H + 170],
    [W + 170, H + 170],
  ])
    crystals(c, x, y, rand);
  for (const b of braziers) brazier(c, b.x, b.y);
  glows(c, braziers, [255, 160, 60], 120, 0.2);
  grade(c, hex("#ffe2aa"), hex("#5a3c28"), 0.3);
  vignette(c, EDGE);
}

export const coliseum: WorldPainter = { paint, edge: css(EDGE) };
export type { RGB };
