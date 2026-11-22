/**
 * Cragmuff's Coliseum, painted in code from edge to edge of the world the
 * camera can show: the sand court, its wall, the stone stands round it and
 * the rocky ground beyond. No picture files: it draws at whatever density the
 * screen needs, so it stays sharp, and it reaches as far past the court as any
 * view does (raid-arena-wide.ts's rectangle), so nothing is mirrored or
 * filled with a flat colour.
 *
 * World coordinates: the court is 0..1600 × 0..900. Everything outside it is
 * decoration (no gameplay reads it); the wall's inner face sits on the court's
 * edge, so what looks solid is where fighters stop.
 */

export const WORLD = { x: -1200, y: -925, width: 4000, height: 2750 } as const;
const W = 1600,
  H = 900;

type Ctx = CanvasRenderingContext2D;

// ───────────────────────────── random & noise ─────────────────────────────

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const xf = x - xi,
    yf = y - yi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed),
    b = hash(xi + 1, yi, seed),
    c = hash(xi, yi + 1, seed),
    d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, seed: number, octaves = 4) {
  let sum = 0,
    amp = 0.5,
    f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, y * f, seed + i * 17);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum / (1 - Math.pow(0.5, octaves));
}

type RGB = [number, number, number];
const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/**
 * A noise texture painted over a world rectangle: `color(n, wx, wy)` maps
 * fbm noise to a colour. Drawn at `cell` world px per texel, then smoothed
 * up, so big areas stay cheap.
 */
function noiseLayer(
  c: Ctx,
  x0: number,
  y0: number,
  w: number,
  h: number,
  cell: number,
  scale: number,
  seed: number,
  color: (
    n: number,
    wx: number,
    wy: number,
  ) => [number, number, number, number],
) {
  const tw = Math.max(1, Math.ceil(w / cell)),
    th = Math.max(1, Math.ceil(h / cell));
  const cv = document.createElement("canvas");
  cv.width = tw;
  cv.height = th;
  const g = cv.getContext("2d")!;
  const img = g.createImageData(tw, th);
  for (let j = 0; j < th; j++)
    for (let i = 0; i < tw; i++) {
      const wx = x0 + i * cell,
        wy = y0 + j * cell;
      const n = fbm(wx / scale, wy / scale, seed);
      const [r, gg, b, a] = color(n, wx, wy);
      const k = (j * tw + i) * 4;
      img.data[k] = r;
      img.data[k + 1] = gg;
      img.data[k + 2] = b;
      img.data[k + 3] = a;
    }
  g.putImageData(img, 0, 0);
  c.save();
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  c.drawImage(cv, x0, y0, tw * cell, th * cell);
  c.restore();
}

// ───────────────────────────── shapes ─────────────────────────────

/** A rounded rectangle grown `d` past the court on every side. */
function ring(c: Ctx, d: number, r: number) {
  c.roundRect(-d, -d, W + 2 * d, H + 2 * d, Math.max(0, r + d * 0.55));
}
/** An irregular stone: a jittered rounded polygon inside a cell. */
function stonePath(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  rand: () => number,
  round = 10,
) {
  const j = () => (rand() - 0.5) * Math.min(w, h) * 0.12;
  const pts: [number, number][] = [
    [x + j(), y + j()],
    [x + w * (0.35 + rand() * 0.3), y + j() * 0.6],
    [x + w + j(), y + j()],
    [x + w + j() * 0.6, y + h * (0.35 + rand() * 0.3)],
    [x + w + j(), y + h + j()],
    [x + w * (0.35 + rand() * 0.3), y + h + j() * 0.6],
    [x + j(), y + h + j()],
    [x + j() * 0.6, y + h * (0.35 + rand() * 0.3)],
  ];
  c.beginPath();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n],
      p1 = pts[i],
      p2 = pts[(i + 1) % n];
    const a = Math.min(round, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 2);
    const b = Math.min(round, Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2);
    const ax =
      p1[0] + ((p0[0] - p1[0]) * a) / Math.hypot(p0[0] - p1[0], p0[1] - p1[1]);
    const ay =
      p1[1] + ((p0[1] - p1[1]) * a) / Math.hypot(p0[0] - p1[0], p0[1] - p1[1]);
    const bx =
      p1[0] + ((p2[0] - p1[0]) * b) / Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const by =
      p1[1] + ((p2[1] - p1[1]) * b) / Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    if (i === 0) c.moveTo(ax, ay);
    else c.lineTo(ax, ay);
    c.quadraticCurveTo(p1[0], p1[1], bx, by);
  }
  c.closePath();
}

// ───────────────────────────── palette ─────────────────────────────

const SAND = hex("#d9b27a"),
  SAND_DARK = hex("#b88c58"),
  SAND_LIGHT = hex("#ecd09e"),
  STONE = hex("#b9a58a"),
  STONE_DARK = hex("#8d7a63"),
  STONE_LIGHT = hex("#d8c7aa"),
  ROCK = hex("#8f7a64"),
  ROCK_DARK = hex("#5e4d3e"),
  DUST = hex("#c79f6c"),
  AMBER = hex("#ffb63d"),
  BANNER = hex("#32467e"),
  BANNER_LIGHT = hex("#4c66ad");

/** Sunlight comes from the top left (shadows fall right and down). */
const SUN = { x: 0.6, y: 0.8 };

// ───────────────────────────── layers ─────────────────────────────

/** Rocky, dusty ground beyond the stands. */
function ground(c: Ctx) {
  const { x, y, width, height } = WORLD;
  noiseLayer(c, x, y, width, height, 8, 520, 11, (n, wx, wy) => {
    const fine = valueNoise(wx / 40, wy / 40, 5);
    const t = Math.min(1, Math.max(0, n * 1.25 - 0.15 + (fine - 0.5) * 0.25));
    const col =
      t < 0.55
        ? mixRGB(DUST, SAND_DARK, t / 0.55)
        : mixRGB(SAND_DARK, ROCK, (t - 0.55) / 0.45);
    return [col[0], col[1], col[2], 255];
  });
  // Rocky outcrops: darker blobs where the noise is high.
  noiseLayer(c, x, y, width, height, 10, 300, 23, (n) => {
    const a = Math.max(0, (n - 0.62) / 0.38);
    return [ROCK_DARK[0], ROCK_DARK[1], ROCK_DARK[2], Math.min(200, a * 320)];
  });
  const rand = rng(77);
  // Boulders with a lit top and a cast shadow.
  for (let i = 0; i < 260; i++) {
    const bx = x + rand() * width,
      by = y + rand() * height;
    if (bx > -470 && bx < W + 470 && by > -470 && by < H + 470) continue;
    const r = 10 + rand() * rand() * 70;
    c.fillStyle = "rgba(40,28,18,0.28)";
    c.beginPath();
    c.ellipse(
      bx + r * 0.35,
      by + r * 0.4,
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
    g.addColorStop(0, css(mixRGB(hex("#e2c9a0"), ROCK, 0.25)));
    g.addColorStop(0.6, css(mixRGB(ROCK, hex("#a0784e"), 0.4)));
    g.addColorStop(1, css(ROCK_DARK));
    c.fillStyle = g;
    c.fill();
  }
  // Dry grass tufts and pebbles.
  for (let i = 0; i < 2200; i++) {
    const px = x + rand() * width,
      py = y + rand() * height;
    if (px > -440 && px < W + 440 && py > -440 && py < H + 440) continue;
    if (rand() < 0.35) {
      c.strokeStyle = css(mixRGB(hex("#8c8a45"), hex("#c2b064"), rand()), 0.8);
      c.lineWidth = 1.6;
      c.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (rand() - 0.5) * 1.6;
        const len = 6 + rand() * 9;
        c.moveTo(px, py);
        c.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
      }
      c.stroke();
    } else {
      const r = 1.5 + rand() * 3.5;
      c.fillStyle = css(mixRGB(ROCK, STONE_LIGHT, rand()), 0.9);
      c.beginPath();
      c.ellipse(px, py, r, r * 0.75, rand() * 3, 0, Math.PI * 2);
      c.fill();
    }
  }
}

/** Tier edges of the stands, from the court outwards (world px past the court). */
const WALL_IN = 0,
  WALL_OUT = 54,
  TIERS = [54, 112, 170, 228, 286, 344],
  OUTER_WALL = [344, 410],
  CORNER = 0;

function stands(c: Ctx) {
  const rand = rng(31);
  // The whole stand area: a base stone colour with soft noise.
  c.save();
  c.beginPath();
  ring(c, OUTER_WALL[1], CORNER);
  c.clip();
  noiseLayer(
    c,
    -OUTER_WALL[1],
    -OUTER_WALL[1],
    W + 2 * OUTER_WALL[1],
    H + 2 * OUTER_WALL[1],
    6,
    160,
    41,
    (n) => {
      const col = mixRGB(STONE_DARK, STONE, 0.35 + n * 0.65);
      return [col[0], col[1], col[2], 255];
    },
  );
  // Each tier: a lighter step top, a dark lip on its outer edge (the riser
  // up to the next row), and seat joints across it.
  for (let i = 0; i < TIERS.length - 1; i++) {
    const a = TIERS[i],
      b = TIERS[i + 1];
    const t = i / (TIERS.length - 1);
    c.beginPath();
    ring(c, b, CORNER);
    ring(c, a, CORNER);
    c.fillStyle = css(mixRGB(STONE_LIGHT, STONE, t * 0.6), 0.5);
    c.fill("evenodd");
    // The riser: a shadow band just inside the next tier's edge.
    c.beginPath();
    ring(c, b, CORNER);
    ring(c, b - 9, CORNER);
    c.fillStyle = "rgba(60,44,30,0.42)";
    c.fill("evenodd");
    // A lit edge on the step's inner lip.
    c.beginPath();
    ring(c, a + 3, CORNER);
    c.strokeStyle = "rgba(255,240,210,0.35)";
    c.lineWidth = 2;
    c.stroke();
    // Seat joints: cuts across the tier every ~72 px on the straight sides
    // (the rounded corners stay whole, like curved bench stones).
    c.strokeStyle = "rgba(70,52,36,0.30)";
    c.lineWidth = 1.5;
    c.beginPath();
    const off = (i % 2) * 36;
    const r0 = a + 2,
      r1 = b - 10;
    for (let x = off; x <= W; x += 72) {
      c.moveTo(x, -r0);
      c.lineTo(x, -r1);
      c.moveTo(x, H + r0);
      c.lineTo(x, H + r1);
    }
    for (let y = off; y <= H; y += 72) {
      c.moveTo(-r0, y);
      c.lineTo(-r1, y);
      c.moveTo(W + r0, y);
      c.lineTo(W + r1, y);
    }
    c.stroke();
  }
  // Wear and dirt: dark patches and a few crumbled seats.
  for (let i = 0; i < 90; i++) {
    const p = pointOnRing(
      rand(),
      TIERS[1] + rand() * (TIERS[TIERS.length - 1] - TIERS[1]),
    );
    const r = 8 + rand() * 26;
    const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, "rgba(80,60,40,0.30)");
    g.addColorStop(1, "rgba(80,60,40,0)");
    c.fillStyle = g;
    c.fillRect(p.x - r, p.y - r, r * 2, r * 2);
  }
  c.restore();
  // The outer wall: a cut-stone band with a dark outer drop.
  wallBand(c, OUTER_WALL[0], OUTER_WALL[1], 63, false);
  c.beginPath();
  ring(c, OUTER_WALL[1] + 26, CORNER);
  ring(c, OUTER_WALL[1], CORNER);
  const sh = c.createLinearGradient(0, 0, 1, 1);
  void sh;
  c.fillStyle = "rgba(40,28,18,0.25)";
  c.fill("evenodd");
}

/** A point at fraction `f` round the court's outline grown by `d`. */
function pointOnRing(f: number, d: number) {
  const w = W + 2 * d,
    h = H + 2 * d;
  let s = (((f % 1) + 1) % 1) * 2 * (w + h);
  if (s < w) return { x: -d + s, y: -d, nx: 0, ny: -1 };
  s -= w;
  if (s < h) return { x: W + d, y: -d + s, nx: 1, ny: 0 };
  s -= h;
  if (s < w) return { x: W + d - s, y: H + d, nx: 0, ny: 1 };
  s -= w;
  return { x: -d, y: H + d - s, nx: -1, ny: 0 };
}

/** A wall seen from above: cut blocks between two ring offsets. */
function wallBand(c: Ctx, a: number, b: number, seed: number, inner: boolean) {
  const rand = rng(seed);
  c.save();
  c.beginPath();
  ring(c, b, CORNER);
  ring(c, a, CORNER);
  c.clip("evenodd");
  // Base.
  c.beginPath();
  ring(c, b, CORNER);
  ring(c, a, CORNER);
  c.fillStyle = css(STONE);
  c.fill("evenodd");
  // Blocks: two courses, staggered.
  const courses = 2;
  for (let k = 0; k < courses; k++) {
    const d0 = a + ((b - a) * k) / courses,
      d1 = a + ((b - a) * (k + 1)) / courses;
    const mid = (d0 + d1) / 2;
    const perim = 2 * (W + H + 4 * mid);
    const n = Math.round(perim / 58);
    for (let i = 0; i < n; i++) {
      const f0 = (i + (k ? 0.5 : 0)) / n,
        f1 = (i + 1 + (k ? 0.5 : 0)) / n;
      const p0 = pointOnRing(f0, d0 + 2),
        p1 = pointOnRing(f1, d0 + 2),
        p2 = pointOnRing(f1, d1 - 2),
        p3 = pointOnRing(f0, d0 + 2);
      void p3;
      if (p0.nx !== p1.nx || p0.ny !== p1.ny) continue; // corner blocks: base shows
      const tone = 0.25 + rand() * 0.55;
      const x0 = Math.min(p0.x, p1.x, p2.x),
        x1 = Math.max(p0.x, p1.x, p2.x),
        y0 = Math.min(p0.y, p1.y, p2.y),
        y1 = Math.max(p0.y, p1.y, p2.y);
      c.beginPath();
      c.roundRect(
        x0 + 1.5,
        y0 + 1.5,
        Math.max(2, x1 - x0 - 3),
        Math.max(2, y1 - y0 - 3),
        4,
      );
      const g = c.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, css(mixRGB(STONE_LIGHT, STONE, 1 - tone)));
      g.addColorStop(1, css(mixRGB(STONE, STONE_DARK, tone)));
      c.fillStyle = g;
      c.fill();
    }
  }
  c.restore();
  // Top highlight on the wall's inner edge and a dark outline.
  c.beginPath();
  ring(c, a, CORNER);
  c.strokeStyle = inner ? "rgba(50,36,24,0.85)" : "rgba(60,44,30,0.6)";
  c.lineWidth = inner ? 4 : 3;
  c.stroke();
  c.beginPath();
  ring(c, b, CORNER);
  c.strokeStyle = "rgba(60,44,30,0.6)";
  c.lineWidth = 3;
  c.stroke();
  c.beginPath();
  ring(c, a + 6, CORNER);
  c.strokeStyle = "rgba(255,244,220,0.45)";
  c.lineWidth = 2;
  c.stroke();
}

/** Banners hung over the inner wall, and torches between them. */
function wallDressing(c: Ctx) {
  const rand = rng(91);
  // Banners: two on each long side, one on each short side, symmetric.
  const banners: { x: number; y: number; nx: number; ny: number }[] = [];
  for (const fx of [0.3, 0.7]) {
    banners.push({ x: W * fx, y: -WALL_OUT / 2, nx: 0, ny: 1 });
    banners.push({ x: W * fx, y: H + WALL_OUT / 2, nx: 0, ny: -1 });
  }
  banners.push({ x: -WALL_OUT / 2, y: H / 2, nx: 1, ny: 0 });
  banners.push({ x: W + WALL_OUT / 2, y: H / 2, nx: -1, ny: 0 });
  for (const b of banners) {
    // Hang outwards, over the stands (never onto the court).
    const len = 96,
      half = 30;
    const ox = -b.nx,
      oy = -b.ny;
    const tx = -oy,
      ty = ox;
    const p = (s: number, t: number) => [
      b.x + ox * s + tx * t,
      b.y + oy * s + ty * t,
    ];
    c.save();
    c.fillStyle = "rgba(30,22,14,0.3)";
    c.beginPath();
    const sh = (s: number, t: number) => {
      const q = p(s, t);
      return [q[0] + 7, q[1] + 9];
    };
    c.moveTo(...(sh(0, -half) as [number, number]));
    c.lineTo(...(sh(len, -half) as [number, number]));
    c.lineTo(...(sh(len - 16, 0) as [number, number]));
    c.lineTo(...(sh(len, half) as [number, number]));
    c.lineTo(...(sh(0, half) as [number, number]));
    c.fill();
    c.beginPath();
    c.moveTo(...(p(0, -half) as [number, number]));
    c.lineTo(...(p(len, -half) as [number, number]));
    c.lineTo(...(p(len - 16, 0) as [number, number]));
    c.lineTo(...(p(len, half) as [number, number]));
    c.lineTo(...(p(0, half) as [number, number]));
    c.closePath();
    const [gx0, gy0] = p(0, -half),
      [gx1, gy1] = p(0, half);
    const g = c.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, css(BANNER_LIGHT));
    g.addColorStop(0.5, css(BANNER));
    g.addColorStop(1, css(mixRGB(BANNER, hex("#000000"), 0.35)));
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = "rgba(230,190,90,0.9)";
    c.lineWidth = 2.5;
    c.stroke();
    // A gold diamond emblem.
    const [d0x, d0y] = p(len * 0.22, 0),
      [d1x, d1y] = p(len * 0.4, -11),
      [d2x, d2y] = p(len * 0.58, 0),
      [d3x, d3y] = p(len * 0.4, 11);
    c.beginPath();
    c.moveTo(d0x, d0y);
    c.lineTo(d1x, d1y);
    c.lineTo(d2x, d2y);
    c.lineTo(d3x, d3y);
    c.closePath();
    c.fillStyle = "rgba(240,200,100,0.95)";
    c.fill();
    // The rod across the wall top.
    const [r0x, r0y] = p(-4, -half - 6),
      [r1x, r1y] = p(-4, half + 6);
    c.strokeStyle = "#5a4330";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(r0x, r0y);
    c.lineTo(r1x, r1y);
    c.stroke();
    c.restore();
  }
  // Amber crystal clusters at the four corners of the stands.
  for (const [cx, cy] of [
    [-150, -150],
    [W + 150, -150],
    [-150, H + 150],
    [W + 150, H + 150],
  ])
    crystals(c, cx, cy, rand);
  // Braziers on the wall top, between banners: an iron bowl with coals.
  for (const t of torchSpots()) {
    c.fillStyle = "rgba(30,20,12,0.35)";
    c.beginPath();
    c.arc(t.x + 4, t.y + 5, 15, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#3b2c20";
    c.beginPath();
    c.arc(t.x, t.y, 14, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#7a5a3a";
    c.lineWidth = 2.5;
    c.stroke();
    const fire = c.createRadialGradient(t.x - 2, t.y - 2, 1, t.x, t.y, 11);
    fire.addColorStop(0, "#fff4c0");
    fire.addColorStop(0.4, "#ffb347");
    fire.addColorStop(1, "#c4421a");
    c.fillStyle = fire;
    c.beginPath();
    c.arc(t.x, t.y, 10, 0, Math.PI * 2);
    c.fill();
  }
}

function torchSpots() {
  const spots: { x: number; y: number }[] = [];
  for (const fx of [0.1, 0.5, 0.9]) {
    spots.push(
      { x: W * fx, y: -WALL_OUT / 2 },
      { x: W * fx, y: H + WALL_OUT / 2 },
    );
  }
  for (const fy of [0.2, 0.8])
    spots.push(
      { x: -WALL_OUT / 2, y: H * fy },
      { x: W + WALL_OUT / 2, y: H * fy },
    );
  spots.push(
    { x: -WALL_OUT / 2 - 4, y: -WALL_OUT / 2 - 4 },
    { x: W + WALL_OUT / 2 + 4, y: -WALL_OUT / 2 - 4 },
  );
  spots.push(
    { x: -WALL_OUT / 2 - 4, y: H + WALL_OUT / 2 + 4 },
    { x: W + WALL_OUT / 2 + 4, y: H + WALL_OUT / 2 + 4 },
  );
  return spots;
}

function crystals(c: Ctx, cx: number, cy: number, rand: () => number) {
  // Rubble under them.
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2,
      d = 30 + rand() * 50,
      r = 8 + rand() * 14;
    const x = cx + Math.cos(a) * d,
      y = cy + Math.sin(a) * d;
    c.fillStyle = "rgba(40,28,18,0.3)";
    c.beginPath();
    c.ellipse(x + 5, y + 6, r, r * 0.8, 0, 0, Math.PI * 2);
    c.fill();
    stonePath(c, x - r, y - r * 0.8, r * 2, r * 1.6, rand, r * 0.5);
    c.fillStyle = css(mixRGB(STONE, STONE_DARK, rand()));
    c.fill();
  }
  // Glow on the ground.
  const glow = c.createRadialGradient(cx, cy, 0, cx, cy, 120);
  glow.addColorStop(0, "rgba(255,190,80,0.45)");
  glow.addColorStop(1, "rgba(255,190,80,0)");
  c.fillStyle = glow;
  c.fillRect(cx - 120, cy - 120, 240, 240);
  // Shards seen from above: elongated diamonds pointing out from the centre.
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.6;
    const len = 26 + rand() * 30,
      wid = 8 + rand() * 6;
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
    g.addColorStop(0, "#fff1b8");
    g.addColorStop(0.45, css(AMBER));
    g.addColorStop(1, "#b0590e");
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = "rgba(120,60,10,0.7)";
    c.lineWidth = 1.2;
    c.stroke();
    c.strokeStyle = "rgba(255,250,220,0.8)";
    c.beginPath();
    c.moveTo(bx, by);
    c.lineTo(tx, ty);
    c.stroke();
  }
}

/** The sand court: worn flagstones with sand in the joints. */
function court(c: Ctx) {
  const rand = rng(5);
  // Sand bed.
  noiseLayer(c, 0, 0, W, H, 4, 180, 3, (n, wx, wy) => {
    const col = mixRGB(hex("#9c7447"), SAND_DARK, 0.2 + n * 0.8);
    void wx;
    void wy;
    return [col[0], col[1], col[2], 255];
  });
  // Flagstones on a jittered grid, some cells merged into long slabs.
  const cols = 12,
    rows = 7;
  const cw = W / cols,
    ch = H / rows;
  const used = new Set<string>();
  c.save();
  c.beginPath();
  c.rect(0, 0, W, H);
  c.clip();
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      if (used.has(`${i},${j}`)) continue;
      let wcells = 1,
        hcells = 1;
      const r = rand();
      if (r < 0.22 && i < cols - 1 && !used.has(`${i + 1},${j}`)) wcells = 2;
      else if (r < 0.34 && j < rows - 1) hcells = 2;
      for (let a = 0; a < wcells; a++)
        for (let b = 0; b < hcells; b++) used.add(`${i + a},${j + b}`);
      const gap = 7;
      const x = i * cw + gap / 2,
        y = j * ch + gap / 2,
        w = wcells * cw - gap,
        h = hcells * ch - gap;
      // Larger slabs sometimes split in two along their length.
      const split = w > h * 1.6 && rand() < 0.5;
      const parts = split
        ? [
            [x, y, w * 0.48 - gap / 2, h],
            [x + w * 0.48 + gap / 2, y, w * 0.52 - gap / 2, h],
          ]
        : [[x, y, w, h]];
      for (const [px, py, pw, ph] of parts) {
        const tone = rand();
        stonePath(c, px, py, pw, ph, rand, 12);
        const g = c.createLinearGradient(px, py, px + pw, py + ph);
        g.addColorStop(0, css(mixRGB(hex("#e6d3b0"), hex("#c9a77a"), tone)));
        g.addColorStop(1, css(mixRGB(hex("#c8ad86"), hex("#a3815a"), tone)));
        c.fillStyle = g;
        c.fill();
        // Bevel: light top-left edge, shadow bottom-right.
        c.save();
        c.clip();
        c.strokeStyle = "rgba(255,248,226,0.45)";
        c.lineWidth = 3;
        c.translate(-1.5, -1.5);
        c.stroke();
        c.translate(3, 3);
        c.strokeStyle = "rgba(90,66,40,0.35)";
        c.stroke();
        c.restore();
        // Mottling and a crack now and then.
        for (let k = 0; k < 5; k++) {
          const mx = px + rand() * pw,
            my = py + rand() * ph,
            mr = 10 + rand() * 30;
          const mg = c.createRadialGradient(mx, my, 0, mx, my, mr);
          const dark = rand() < 0.5;
          mg.addColorStop(
            0,
            dark ? "rgba(120,92,60,0.16)" : "rgba(255,246,220,0.16)",
          );
          mg.addColorStop(1, "rgba(0,0,0,0)");
          c.fillStyle = mg;
          c.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
        }
        if (rand() < 0.3) {
          c.strokeStyle = "rgba(90,66,40,0.45)";
          c.lineWidth = 1.4;
          c.beginPath();
          let cx = px + pw * (0.2 + rand() * 0.6),
            cy = py + 4;
          c.moveTo(cx, cy);
          for (let s = 0; s < 4; s++) {
            cx += (rand() - 0.5) * pw * 0.3;
            cy += ph / 4;
            c.lineTo(cx, cy);
          }
          c.stroke();
        }
      }
    }
  // Sand drifted over the stones near the walls and in a few patches.
  noiseLayer(c, 0, 0, W, H, 6, 140, 9, (n, wx, wy) => {
    const edge = Math.min(wx, wy, W - wx, H - wy);
    const drift =
      Math.max(0, 1 - edge / 90) * 0.55 + Math.max(0, n - 0.66) * 1.2;
    return [SAND[0], SAND[1], SAND[2], Math.min(220, drift * 255)];
  });
  // Grains.
  for (let i = 0; i < 5000; i++) {
    const gx = rand() * W,
      gy = rand() * H;
    c.fillStyle =
      rand() < 0.5 ? "rgba(255,240,200,0.35)" : "rgba(110,80,50,0.25)";
    c.fillRect(gx, gy, 1.6, 1.6);
  }
  c.restore();
}

/** Light: the wall's shadow on the court, torch glows, a warm grade. */
function lighting(c: Ctx) {
  // The inner wall casts a shadow onto the court's top and left edges.
  c.save();
  c.beginPath();
  c.rect(0, 0, W, H);
  c.clip();
  const top = c.createLinearGradient(0, 0, 0, 70);
  top.addColorStop(0, "rgba(60,38,20,0.45)");
  top.addColorStop(1, "rgba(60,38,20,0)");
  c.fillStyle = top;
  c.fillRect(0, 0, W, 70);
  const left = c.createLinearGradient(0, 0, 55, 0);
  left.addColorStop(0, "rgba(60,38,20,0.40)");
  left.addColorStop(1, "rgba(60,38,20,0)");
  c.fillStyle = left;
  c.fillRect(0, 0, 55, H);
  // A thin contact shadow along all four sides.
  c.strokeStyle = "rgba(50,32,18,0.35)";
  c.lineWidth = 10;
  c.strokeRect(0, 0, W, H);
  c.restore();
  // Torch light pools.
  c.save();
  c.globalCompositeOperation = "lighter";
  for (const t of torchSpots()) {
    const g = c.createRadialGradient(t.x, t.y, 0, t.x, t.y, 130);
    g.addColorStop(0, "rgba(255,160,60,0.22)");
    g.addColorStop(1, "rgba(255,170,70,0)");
    c.fillStyle = g;
    c.fillRect(t.x - 130, t.y - 130, 260, 260);
  }
  c.restore();
  // Warm sunlight from the top left across the whole world, fading out far away.
  c.save();
  c.globalCompositeOperation = "soft-light";
  const sun = c.createLinearGradient(-400, -300, W + 400, H + 300);
  sun.addColorStop(0, "rgba(255,226,170,0.30)");
  sun.addColorStop(1, "rgba(90,60,40,0.30)");
  c.fillStyle = sun;
  c.fillRect(WORLD.x, WORLD.y, WORLD.width, WORLD.height);
  c.restore();
  // Vignette far from the court so the eye stays on it.
  const cx = W / 2,
    cy = H / 2;
  const v = c.createRadialGradient(cx, cy, 900, cx, cy, 2300);
  v.addColorStop(0, "rgba(30,20,12,0)");
  v.addColorStop(1, "rgba(30,20,12,0.55)");
  c.fillStyle = v;
  c.fillRect(WORLD.x, WORLD.y, WORLD.width, WORLD.height);
  void SUN;
}

/**
 * Paint the whole Coliseum world into `c`, already transformed so one unit is
 * one world px (any scale: 0.5 for the surroundings, 1–2 for the court).
 * `part`: "all", or "court" (just the court rectangle and its wall shadows).
 */
export function paintColiseumWorld(c: Ctx, part: "all" | "court" = "all") {
  if (part === "all") {
    ground(c);
    stands(c);
    wallBand(c, WALL_IN, WALL_OUT, 7, true);
  }
  court(c);
  if (part === "all") wallDressing(c);
  lighting(c);
}
