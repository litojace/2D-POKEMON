/**
 * Shared tools for the raid worlds painted in code (world-art/*.ts): seeded
 * randomness and noise, colour helpers, irregular stones, flagstone floors,
 * walls round the court, and light. Every painter works in world
 * coordinates (the court is 0..W × 0..H) on a context already scaled to
 * whatever density the screen needs.
 */

export type Ctx = CanvasRenderingContext2D;
export const W = 1600,
  H = 900;
/**
 * The world rectangle each raid painting covers, centred on the court. Wider
 * than any landscape view needs (a 2.2:1 phone below the raid HUD sees about
 * 850 px past each side at the whole-court zoom); beyond it the camera's
 * background colour (the painting's `edge`) carries on.
 */
export const WORLD = { x: -1000, y: -900, width: 3600, height: 2700 } as const;

/** What a painter draws: the whole world, or only the court rectangle. */
export type Part = "all" | "court";
export interface WorldPainter {
  paint(c: Ctx, part: Part): void;
  /** The colour the painting fades to at its edges (the camera's background). */
  edge: string;
}

// ───────────────────────────── random & noise ─────────────────────────────

export function rng(seed: number) {
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
export function valueNoise(x: number, y: number, seed: number) {
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
export function fbm(x: number, y: number, seed: number, octaves = 4) {
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

// ───────────────────────────── colour ─────────────────────────────

export type RGB = [number, number, number];
export const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const mix = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
export const css = (c: RGB, a = 1) =>
  `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
/** A colour along a ramp of stops at even spacing, t in 0..1. */
export function ramp(stops: RGB[], t: number): RGB {
  const x = clamp01(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}

/**
 * A noise texture over a world rectangle: `color(n, wx, wy)` maps fbm noise
 * (0..1) to RGBA. Drawn at `cell` world px per texel and smoothed up, so big
 * areas stay cheap.
 */
export function noiseLayer(
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
      const [r, gg, b, a] = color(fbm(wx / scale, wy / scale, seed), wx, wy);
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
  cv.width = cv.height = 0;
}

/** Fill the whole world rectangle with a noise ramp. */
export function worldNoise(
  c: Ctx,
  stops: RGB[],
  scale: number,
  seed: number,
  cell = 8,
  contrast = 1.25,
) {
  const { x, y, width, height } = WORLD;
  noiseLayer(c, x, y, width, height, cell, scale, seed, (n, wx, wy) => {
    const fine = valueNoise(wx / 37, wy / 37, seed + 3) - 0.5;
    const col = ramp(stops, (n - 0.5) * contrast + 0.5 + fine * 0.18);
    return [col[0], col[1], col[2], 255];
  });
}

// ───────────────────────────── shapes ─────────────────────────────

/** The court's outline grown by `d` on every side, corners rounding as it grows. */
export function ring(c: Ctx, d: number, round = 0.55) {
  c.roundRect(-d, -d, W + 2 * d, H + 2 * d, Math.max(0, d * round));
}
/** Is a world point inside the court grown by `d`? */
export function inGrown(x: number, y: number, d: number) {
  return x > -d && x < W + d && y > -d && y < H + d;
}

/** An irregular stone: a jittered rounded octagon inside a box. */
export function stonePath(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  rand: () => number,
  round = 10,
  jitter = 0.12,
) {
  const j = () => (rand() - 0.5) * Math.min(w, h) * jitter;
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
    const l0 = Math.hypot(p0[0] - p1[0], p0[1] - p1[1]) || 1,
      l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
    const a = Math.min(round, l0 / 2),
      b = Math.min(round, l2 / 2);
    const ax = p1[0] + ((p0[0] - p1[0]) * a) / l0,
      ay = p1[1] + ((p0[1] - p1[1]) * a) / l0;
    const bx = p1[0] + ((p2[0] - p1[0]) * b) / l2,
      by = p1[1] + ((p2[1] - p1[1]) * b) / l2;
    if (i === 0) c.moveTo(ax, ay);
    else c.lineTo(ax, ay);
    c.quadraticCurveTo(p1[0], p1[1], bx, by);
  }
  c.closePath();
}

/** A soft round blob of colour (light, dirt, moss). */
export function blob(
  c: Ctx,
  x: number,
  y: number,
  r: number,
  color: RGB,
  alpha: number,
) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, css(color, alpha));
  g.addColorStop(1, css(color, 0));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

/** A cast shadow under a shape: the path, offset away from the light, blurred. */
export function dropShadow(
  c: Ctx,
  draw: () => void,
  dx: number,
  dy: number,
  blur: number,
  alpha: number,
) {
  c.save();
  c.shadowColor = `rgba(0,0,0,${alpha})`;
  c.shadowBlur = blur;
  c.shadowOffsetX = dx;
  c.shadowOffsetY = dy;
  draw();
  c.restore();
}

// ───────────────────────────── floors ─────────────────────────────

export interface FlagstoneStyle {
  /** Joint / bed colour between stones. */
  bed: [RGB, RGB];
  /** Stone tones: light and dark ends (each stone picks a tone between). */
  light: [RGB, RGB];
  dark: [RGB, RGB];
  cols: number;
  rows: number;
  gap: number;
  round: number;
  /** Chance a cell merges with its right / lower neighbour. */
  merge: number;
  cracks: number;
  seed: number;
  /** Bevel strength 0..1. */
  bevel?: number;
  /** Jitter of the stone outline. */
  jitter?: number;
}

/**
 * Flagstones over a rectangle on a jittered grid, with joints, bevels,
 * mottling and the odd crack. Cells keep to the grid, so a gameplay board
 * (the Lantern Yard's 8 × 5) can line up with them.
 */
export function flagstones(
  c: Ctx,
  x0: number,
  y0: number,
  w: number,
  h: number,
  s: FlagstoneStyle,
) {
  const rand = rng(s.seed);
  noiseLayer(c, x0, y0, w, h, 4, 160, s.seed + 1, (n) => {
    const col = mix(s.bed[0], s.bed[1], n);
    return [col[0], col[1], col[2], 255];
  });
  const cw = w / s.cols,
    ch = h / s.rows;
  const used = new Set<string>();
  const bevel = s.bevel ?? 1;
  c.save();
  c.beginPath();
  c.rect(x0, y0, w, h);
  c.clip();
  for (let j = 0; j < s.rows; j++)
    for (let i = 0; i < s.cols; i++) {
      if (used.has(`${i},${j}`)) continue;
      let wc = 1,
        hc = 1;
      const r = rand();
      if (r < s.merge && i < s.cols - 1 && !used.has(`${i + 1},${j}`)) wc = 2;
      else if (r < s.merge * 1.5 && j < s.rows - 1) hc = 2;
      for (let a = 0; a < wc; a++)
        for (let b = 0; b < hc; b++) used.add(`${i + a},${j + b}`);
      const x = x0 + i * cw + s.gap / 2,
        y = y0 + j * ch + s.gap / 2,
        sw = wc * cw - s.gap,
        sh = hc * ch - s.gap;
      const tone = rand();
      stonePath(c, x, y, sw, sh, rand, s.round, s.jitter ?? 0.1);
      const g = c.createLinearGradient(x, y, x + sw, y + sh);
      g.addColorStop(0, css(mix(s.light[0], s.light[1], tone)));
      g.addColorStop(1, css(mix(s.dark[0], s.dark[1], tone)));
      c.fillStyle = g;
      c.fill();
      if (bevel > 0) {
        c.save();
        c.clip();
        c.lineWidth = 4;
        c.translate(-2, -2);
        c.strokeStyle = `rgba(255,250,235,${0.4 * bevel})`;
        c.stroke();
        c.translate(4, 4);
        c.strokeStyle = `rgba(20,12,6,${0.35 * bevel})`;
        c.stroke();
        c.restore();
      }
      for (let k = 0; k < 4; k++) {
        const dark = rand() < 0.5;
        blob(
          c,
          x + rand() * sw,
          y + rand() * sh,
          10 + rand() * 28,
          dark ? [40, 28, 18] : [255, 248, 230],
          0.12,
        );
      }
      if (rand() < s.cracks) {
        c.strokeStyle = "rgba(30,20,12,0.4)";
        c.lineWidth = 1.4;
        c.beginPath();
        let cx = x + sw * (0.2 + rand() * 0.6),
          cy = y + 4;
        c.moveTo(cx, cy);
        for (let t = 0; t < 4; t++) {
          cx += (rand() - 0.5) * sw * 0.3;
          cy += sh / 4.2;
          c.lineTo(cx, cy);
        }
        c.stroke();
      }
    }
  c.restore();
}

/** Fine specks over a rectangle (dust, sand, glitter). */
export function specks(
  c: Ctx,
  x0: number,
  y0: number,
  w: number,
  h: number,
  n: number,
  seed: number,
  colors: string[],
  size = 1.6,
) {
  const rand = rng(seed);
  for (let i = 0; i < n; i++) {
    c.fillStyle = colors[(rand() * colors.length) | 0];
    c.fillRect(x0 + rand() * w, y0 + rand() * h, size, size);
  }
}

// ───────────────────────────── walls & stands ─────────────────────────────

export interface WallStyle {
  base: RGB;
  light: RGB;
  dark: RGB;
  /** Outline (mortar / shadow) colour. */
  line: RGB;
  /** Block length along the wall (world px). */
  block: number;
  courses: number;
  seed: number;
}

/** A point at fraction `f` round the court's outline grown by `d`. */
export function pointOnRing(f: number, d: number) {
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

/**
 * A wall seen from above between ring offsets `a` (inner) and `b` (outer):
 * cut blocks in courses, a lit top edge, a dark outline, and a shadow it
 * casts outwards.
 */
export function wall(c: Ctx, a: number, b: number, s: WallStyle, round = 0.55) {
  const rand = rng(s.seed);
  // Shadow cast beyond the wall (down and right).
  c.save();
  c.beginPath();
  c.rect(WORLD.x, WORLD.y, WORLD.width, WORLD.height);
  ring(c, b, round);
  c.clip("evenodd");
  c.shadowColor = "rgba(0,0,0,0.45)";
  c.shadowBlur = 18;
  c.shadowOffsetX = 8;
  c.shadowOffsetY = 12;
  c.beginPath();
  ring(c, b, round);
  c.fillStyle = css(s.base);
  c.fill();
  c.restore();
  c.save();
  c.beginPath();
  ring(c, b, round);
  ring(c, a, round);
  c.clip("evenodd");
  c.fillStyle = css(s.base);
  c.fillRect(-b - 2, -b - 2, W + 2 * b + 4, H + 2 * b + 4);
  for (let k = 0; k < s.courses; k++) {
    const d0 = a + ((b - a) * k) / s.courses,
      d1 = a + ((b - a) * (k + 1)) / s.courses;
    const stagger = (k % 2) * 0.5;
    // Straight runs on each side; the rounded corners keep the base stone.
    const sides: [number, number, number, number, boolean][] = [
      [0, -d1, W, d1 - d0, true],
      [0, H + d0, W, d1 - d0, true],
      [-d1, 0, d1 - d0, H, false],
      [W + d0, 0, d1 - d0, H, false],
    ];
    for (const [sx, sy, sw, sh, horiz] of sides) {
      const len = horiz ? sw : sh;
      const n = Math.max(1, Math.round(len / s.block));
      const step = len / n;
      for (let i = -1; i < n; i++) {
        const o0 = Math.max(0, (i + stagger) * step),
          o1 = Math.min(len, (i + 1 + stagger) * step);
        if (o1 - o0 < 4) continue;
        const bx = horiz ? sx + o0 : sx,
          by = horiz ? sy : sy + o0,
          bw = horiz ? o1 - o0 : sw,
          bh = horiz ? sh : o1 - o0;
        const tone = rand();
        c.beginPath();
        c.roundRect(bx + 1.5, by + 1.5, bw - 3, bh - 3, 3);
        const g = c.createLinearGradient(bx, by, bx + bw, by + bh);
        g.addColorStop(0, css(mix(s.light, s.base, tone * 0.6)));
        g.addColorStop(1, css(mix(s.base, s.dark, 0.3 + tone * 0.5)));
        c.fillStyle = g;
        c.fill();
      }
    }
  }
  c.restore();
  c.lineWidth = 3;
  c.strokeStyle = css(s.line, 0.85);
  c.beginPath();
  ring(c, a, round);
  c.stroke();
  c.beginPath();
  ring(c, b, round);
  c.stroke();
  c.lineWidth = 2;
  c.strokeStyle = css(s.light, 0.55);
  c.beginPath();
  ring(c, b - 4, round);
  c.stroke();
}

/**
 * Tiered stands between ring offsets: each tier a lighter step with a dark
 * riser on its outer edge and seat joints on the straight runs.
 */
export function tiers(
  c: Ctx,
  edges: number[],
  top: RGB,
  riser: RGB,
  seed: number,
  seat = 72,
) {
  const rand = rng(seed);
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i],
      b = edges[i + 1];
    c.beginPath();
    ring(c, b);
    ring(c, a);
    c.fillStyle = css(mix(top, riser, (i / edges.length) * 0.35));
    c.fill("evenodd");
    noiseLayer(
      c,
      -b,
      -b,
      W + 2 * b,
      H + 2 * b,
      8,
      90,
      seed + i,
      (n, wx, wy) => {
        const inside = inGrown(wx, wy, b) && !inGrown(wx, wy, a);
        return [
          riser[0],
          riser[1],
          riser[2],
          inside ? Math.max(0, n - 0.45) * 160 : 0,
        ];
      },
    );
    c.beginPath();
    ring(c, b);
    ring(c, b - 10);
    c.fillStyle = css(riser, 0.55);
    c.fill("evenodd");
    c.beginPath();
    ring(c, a + 2);
    c.strokeStyle = "rgba(255,245,225,0.35)";
    c.lineWidth = 2;
    c.stroke();
    c.strokeStyle = css(riser, 0.4);
    c.lineWidth = 1.5;
    c.beginPath();
    const off = (i % 2) * (seat / 2);
    for (let x = off; x <= W; x += seat) {
      c.moveTo(x, -a - 2);
      c.lineTo(x, -b + 10);
      c.moveTo(x, H + a + 2);
      c.lineTo(x, H + b - 10);
    }
    for (let y = off; y <= H; y += seat) {
      c.moveTo(-a - 2, y);
      c.lineTo(-b + 10, y);
      c.moveTo(W + a + 2, y);
      c.lineTo(W + b - 10, y);
    }
    c.stroke();
  }
  for (let i = 0; i < 70; i++) {
    const p = pointOnRing(
      rand(),
      edges[0] + rand() * (edges[edges.length - 1] - edges[0]),
    );
    blob(c, p.x, p.y, 8 + rand() * 24, riser, 0.22);
  }
}

// ───────────────────────────── light ─────────────────────────────

/** The wall's shadow on the court: strongest at the top and left (light from the top left). */
export function courtEdgeShadow(
  c: Ctx,
  strength = 1,
  tint: RGB = [30, 18, 10],
) {
  c.save();
  c.beginPath();
  c.rect(0, 0, W, H);
  c.clip();
  const top = c.createLinearGradient(0, 0, 0, 80);
  top.addColorStop(0, css(tint, 0.5 * strength));
  top.addColorStop(1, css(tint, 0));
  c.fillStyle = top;
  c.fillRect(0, 0, W, 80);
  const left = c.createLinearGradient(0, 0, 60, 0);
  left.addColorStop(0, css(tint, 0.42 * strength));
  left.addColorStop(1, css(tint, 0));
  c.fillStyle = left;
  c.fillRect(0, 0, 60, H);
  c.strokeStyle = css(tint, 0.35 * strength);
  c.lineWidth = 12;
  c.strokeRect(0, 0, W, H);
  c.restore();
}

/** Additive glows (torches, lanterns, crystals, coils). */
export function glows(
  c: Ctx,
  spots: { x: number; y: number }[],
  color: RGB,
  r: number,
  alpha: number,
) {
  c.save();
  c.globalCompositeOperation = "lighter";
  for (const s of spots) blob(c, s.x, s.y, r, color, alpha);
  c.restore();
}

/** A colour grade over the whole world (soft-light from the top left). */
export function grade(c: Ctx, from: RGB, to: RGB, alpha = 0.3) {
  c.save();
  c.globalCompositeOperation = "soft-light";
  const g = c.createLinearGradient(-400, -300, W + 400, H + 300);
  g.addColorStop(0, css(from, alpha));
  g.addColorStop(1, css(to, alpha));
  c.fillStyle = g;
  c.fillRect(WORLD.x, WORLD.y, WORLD.width, WORLD.height);
  c.restore();
}

/** Darken far from the court, to the painting's edge colour at the world's border. */
export function vignette(
  c: Ctx,
  edge: RGB,
  inner = 950,
  outer = 2100,
  alpha = 0.7,
) {
  const v = c.createRadialGradient(W / 2, H / 2, inner, W / 2, H / 2, outer);
  v.addColorStop(0, css(edge, 0));
  v.addColorStop(1, css(edge, alpha));
  c.fillStyle = v;
  c.fillRect(WORLD.x, WORLD.y, WORLD.width, WORLD.height);
  // The last stretch fades fully to the edge colour, so the camera's
  // background carries on seamlessly past the painting.
  const { x, y, width, height } = WORLD;
  const band = 160;
  const sides: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ][] = [
    [x, y, width, band, 0, y, 0, y + band],
    [x, y + height - band, width, band, 0, y + height, 0, y + height - band],
    [x, y, band, height, x, 0, x + band, 0],
    [x + width - band, y, band, height, x + width, 0, x + width - band, 0],
  ];
  for (const [rx, ry, rw, rh, gx0, gy0, gx1, gy1] of sides) {
    const g = c.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, css(edge, 1));
    g.addColorStop(1, css(edge, 0));
    c.fillStyle = g;
    c.fillRect(rx, ry, rw, rh);
  }
}

/** A soft drop of the court's own wall into the court, then the court art. Clip to the court. */
export function withCourtClip(c: Ctx, draw: () => void) {
  c.save();
  c.beginPath();
  c.rect(0, 0, W, H);
  c.clip();
  draw();
  c.restore();
}
