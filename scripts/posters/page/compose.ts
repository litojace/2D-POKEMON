/**
 * The poster compositor: a dramatic low-angle scene around one boss cutout,
 * in the manner of the Storm Twins splash. Back to front: a painted sky with
 * the light breaking through behind the boss, god rays, ruins leaning in
 * (textured from the boss's own arena art), cloud banks and mist, the arena
 * floor in steep perspective, energy ribbons and debris behind the boss,
 * the boss with its glow, rim light and bloom, the ribbons, sparkles and
 * debris in front, and the grade (light wash and vignette).
 *
 * Every size is in "u" (1 u = 1/1024 of the poster's height) so the same
 * scene draws a 1536x1024 splash and a 600x900 portrait.
 */

export type Particle =
  | "embers"
  | "lanterns"
  | "droplets"
  | "bubbles"
  | "ink"
  | "crystals"
  | "stars"
  | "prisms"
  | "motes";

export interface Theme {
  /** Sky, top to the light at the horizon. */
  sky: [string, string, string, string];
  /** The light breaking through (glow and rays). */
  light: string;
  /** Distance haze, and the mist at the ruins' feet. */
  haze: string;
  /** Cloud lit side, middle and shadow. */
  cloud: [string, string, string];
  /** Ribbon colours: glow, body, core. Several ribbon sets cycle through. */
  ribbons: [string, string, string][];
  /** Rim light on the boss and on edges facing the light. */
  rim: string;
  /** The boss's back glow. */
  aura: string;
  /** The rocks' glowing cracks (or "" for none). */
  crack: string;
  /** Vignette colour. */
  shade: string;
  particles: Particle[];
  /** Sparkle colour. */
  spark: string;
  /** Tint over the stone texture of ruins and rocks. */
  stone: string;
}

export type Setting = "sunset" | "sea" | "night" | "canyon";
export interface Scene {
  W: number;
  H: number;
  arena: HTMLImageElement;
  theme: Theme;
  seed: number;
  setting: Setting;
  /** The painted boss (transparent), its face (eyes' midpoint) and body in its px, and the face's half-size. */
  boss: HTMLCanvasElement;
  face: { x: number; y: number };
  body: { x: number; y: number };
  faceR: [number, number];
  /**
   * The boss's box in the poster (fractions): centre x and y, height, max
   * width; faceY puts the face at that height instead of centring; ground
   * stands its feet on the floor at that height.
   */
  place: {
    cx: number;
    cy: number;
    h: number;
    maxW: number;
    faceY?: number;
    ground?: number;
  };
  /** The key light's source in the sky, in fractions. */
  sun: { x: number; y: number };
  /** Horizon line (fraction of H). */
  horizon: number;
  /** Ribbon spin: 1 one way, -1 the other. */
  spin?: number;
}

export interface Result {
  canvas: HTMLCanvasElement;
  /** The boss's box, as fractions of the poster. */
  box: [number, number, number, number];
  /** The boss's face and body centre, as fractions of the poster. */
  face: [number, number];
  body: [number, number];
}

// ───────────────────────── helpers ─────────────────────────
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1e9) / 1e9;
  };
}
export type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
export function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}
export const ctxOf = (c: HTMLCanvasElement) => c.getContext("2d")!;
export function blurred(src: HTMLCanvasElement, px: number) {
  const c = canvas(src.width, src.height);
  const g = ctxOf(c);
  g.filter = `blur(${px}px)`;
  g.drawImage(src, 0, 0);
  return c;
}
/** "#rrggbb" or rgb list with alpha → css. */
export function rgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16),
    pb = parseInt(b.slice(1), 16);
  const ch = (s: number) =>
    Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

/** The boss trimmed to its pixels. */
export function trim(c: HTMLCanvasElement) {
  const d = ctxOf(c).getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width,
    y0 = c.height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// ───────────────────────── stone texture ─────────────────────────
/** A tileable-ish stone swatch from the arena's border (walls, rubble), tinted. */
export function stoneSwatch(arena: HTMLImageElement, tint: string) {
  const c = canvas(512, 256);
  const g = ctxOf(c);
  // the top border strip and the left one, side by side
  g.drawImage(arena, 0, 0, arena.width, arena.height * 0.12, 0, 0, 512, 128);
  g.save();
  g.translate(512, 128);
  g.rotate(Math.PI / 2);
  g.drawImage(arena, 0, 0, arena.width * 0.08, arena.height, -128, 0, 128, 512);
  g.restore();
  g.drawImage(
    arena,
    0,
    arena.height * 0.88,
    arena.width,
    arena.height * 0.12,
    0,
    128,
    512,
    128,
  );
  g.globalCompositeOperation = "color";
  g.fillStyle = rgba(tint, 0.55);
  g.fillRect(0, 0, 512, 256);
  return c;
}

// ───────────────────────── sky ─────────────────────────
export function drawSky(g: Ctx, s: Scene, u: number) {
  const { W, H, theme: t } = s;
  const sg = g.createLinearGradient(0, 0, 0, H * s.horizon);
  sg.addColorStop(0, t.sky[0]);
  sg.addColorStop(0.35, t.sky[1]);
  sg.addColorStop(0.75, t.sky[2]);
  sg.addColorStop(1, t.sky[3]);
  g.fillStyle = sg;
  g.fillRect(0, 0, W, H);
  // the light behind the boss
  const lx = s.sun.x * W,
    ly = s.sun.y * H;
  const R = Math.max(W, H);
  let rg = g.createRadialGradient(lx, ly, 0, lx, ly, R * 0.75);
  rg.addColorStop(0, rgba(t.light, 0.85));
  rg.addColorStop(0.12, rgba(t.light, 0.45));
  rg.addColorStop(0.4, rgba(t.light, 0.12));
  rg.addColorStop(1, rgba(t.light, 0));
  g.globalCompositeOperation = "screen";
  g.fillStyle = rg;
  g.fillRect(0, 0, W, H);
  rg = g.createRadialGradient(lx, ly, 0, lx, ly, 80 * u);
  rg.addColorStop(0, "rgba(255,255,255,0.6)");
  rg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rg;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "source-over";
}

/**
 * Billowing cumulus: dome-shaped clusters of puffs, small at the edges and
 * big in the middle, each lit from the sun's side, painted top to bottom so
 * the lower puffs overlap the upper ones; then softened.
 */
export function cloudBank(
  s: Scene,
  u: number,
  r: () => number,
  o: {
    y: number;
    x0: number;
    x1: number;
    size: number;
    rows: number;
    alpha: number;
    blur: number;
    haze: number;
  },
) {
  const { W, H, theme: t } = s;
  const c = canvas(W, H);
  const g = ctxOf(c);
  const lx = s.sun.x * W,
    ly = s.sun.y * H;
  const puffs: { x: number; y: number; r: number }[] = [];
  const cl: { x: number; y: number; w: number; h: number }[] = [];
  const clusters = Math.max(
    2,
    Math.round(((o.x1 - o.x0) * W) / (o.size * u * 2.6)),
  );
  for (let i = 0; i < clusters; i++) {
    const cx = (o.x0 + ((o.x1 - o.x0) * (i + 0.2 + r() * 0.6)) / clusters) * W;
    const cw = o.size * u * (1.6 + r() * 1.4);
    const ch = o.size * u * (0.9 + r() * 0.9) * o.rows * 0.7;
    const base = o.y * H + (r() - 0.5) * o.size * u * 0.6;
    cl.push({ x: cx, y: base, w: cw, h: ch });
    for (let j = 0; j < 60; j++) {
      const a = Math.PI * (0.04 + 0.92 * r());
      const d = Math.sqrt(r());
      const x = cx + Math.cos(a) * cw * d;
      const y = base - Math.sin(a) * ch * d;
      const big = 1 - d * 0.65;
      puffs.push({ x, y, r: o.size * u * (0.12 + r() * 0.3) * (0.5 + big) });
    }
  }
  // the mass in its middle tone
  // soft-edged puffs, so the mass billows instead of reading as balls
  for (const p of puffs) {
    const sg = g.createRadialGradient(
      p.x,
      p.y,
      p.r * 0.55,
      p.x,
      p.y,
      p.r * 1.15,
    );
    sg.addColorStop(0, rgba(t.cloud[1], 1));
    sg.addColorStop(0.7, rgba(t.cloud[1], 0.85));
    sg.addColorStop(1, rgba(t.cloud[1], 0));
    g.fillStyle = sg;
    g.beginPath();
    g.arc(p.x, p.y, p.r * 1.15, 0, TAU);
    g.fill();
  }
  g.globalCompositeOperation = "source-atop";
  // each puff's lit cap, toward the sun, soft
  puffs.sort((p, q) => p.y - q.y);
  for (const p of puffs) {
    const dx = lx - p.x,
      dy = ly - p.y,
      L = Math.hypot(dx, dy) || 1;
    const hx = p.x + (dx / L) * p.r * 0.35,
      hy = p.y + (dy / L) * p.r * 0.35;
    const gr = g.createRadialGradient(hx, hy, 0, hx, hy, p.r * 0.95);
    gr.addColorStop(0, rgba(t.cloud[0], 0.95));
    gr.addColorStop(0.55, rgba(t.cloud[0], 0.45));
    gr.addColorStop(1, rgba(t.cloud[0], 0));
    g.fillStyle = gr;
    g.fillRect(hx - p.r, hy - p.r, p.r * 2, p.r * 2);
    // a soft shadow under the next puff down
    const sg = g.createRadialGradient(
      p.x,
      p.y + p.r * 0.75,
      0,
      p.x,
      p.y + p.r * 0.75,
      p.r * 0.8,
    );
    sg.addColorStop(0, rgba(t.cloud[2], 0.28));
    sg.addColorStop(1, rgba(t.cloud[2], 0));
    g.fillStyle = sg;
    g.fillRect(p.x - p.r, p.y, p.r * 2, p.r * 1.6);
  }
  g.globalCompositeOperation = "source-over";
  // shadowed bellies under each mass
  g.globalCompositeOperation = "source-atop";
  for (const k of cl) {
    const bg = g.createLinearGradient(0, k.y - k.h * 0.55, 0, k.y + k.h * 0.1);
    bg.addColorStop(0, rgba(t.cloud[2], 0));
    bg.addColorStop(1, rgba(t.cloud[2], 0.6));
    g.fillStyle = bg;
    g.fillRect(k.x - k.w * 1.3, k.y - k.h * 0.6, k.w * 2.6, k.h * 0.9);
  }
  g.globalCompositeOperation = "source-over";
  // the base dissolves into the mist below
  g.globalCompositeOperation = "source-atop";
  const fade = g.createLinearGradient(
    0,
    o.y * H - o.size * u * 0.5,
    0,
    o.y * H + o.size * u * 0.6,
  );
  fade.addColorStop(0, rgba(t.haze, 0));
  fade.addColorStop(1, rgba(t.haze, 0.85));
  g.fillStyle = fade;
  g.fillRect(0, 0, W, H);
  if (o.haze > 0) {
    g.fillStyle = rgba(t.haze, o.haze);
    g.fillRect(0, 0, W, H);
  }
  return { c: o.blur ? blurred(c, o.blur * u) : c, alpha: o.alpha };
}

/** High streaky clouds swirling around the light. */
export function wisps(g: Ctx, s: Scene, u: number, r: () => number) {
  const { W, H, theme: t } = s;
  const c = canvas(W, H);
  const k = ctxOf(c);
  const lx = s.sun.x * W,
    ly = s.sun.y * H;
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU,
      d = (0.25 + r() * 0.7) * W * 0.55;
    const x = lx + Math.cos(a) * d,
      y = ly + Math.sin(a) * d * 0.55;
    if (y > s.horizon * H) continue;
    const len = (120 + r() * 260) * u,
      th = (10 + r() * 26) * u;
    k.save();
    k.translate(x, y);
    k.rotate(a + Math.PI / 2 + (r() - 0.5) * 0.3);
    const gr = k.createRadialGradient(0, 0, 0, 0, 0, len);
    const near = 1 - Math.min(1, d / (W * 0.55));
    gr.addColorStop(0, rgba(t.cloud[0], 0.35 + near * 0.4));
    gr.addColorStop(1, rgba(t.cloud[1], 0));
    k.fillStyle = gr;
    k.scale(1, th / len);
    k.beginPath();
    k.arc(0, 0, len, 0, TAU);
    k.fill();
    k.restore();
  }
  g.drawImage(blurred(c, 7 * u), 0, 0);
}

export function godRays(g: Ctx, s: Scene, u: number, r: () => number) {
  const { W, H, theme: t } = s;
  const c = canvas(W, H);
  const k = ctxOf(c);
  const lx = s.sun.x * W,
    ly = s.sun.y * H - 60 * u;
  const n = 15;
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (0.12 + (0.76 * (i + r() * 0.8)) / n);
    const w = (0.012 + r() * 0.035) * Math.PI;
    const len = Math.max(W, H) * 1.4;
    const gr = k.createRadialGradient(lx, ly, 0, lx, ly, len);
    const al = 0.12 + r() * 0.22;
    gr.addColorStop(0, rgba(t.light, al));
    gr.addColorStop(0.5, rgba(t.light, al * 0.5));
    gr.addColorStop(1, rgba(t.light, 0));
    k.fillStyle = gr;
    k.beginPath();
    k.moveTo(lx, ly);
    k.lineTo(lx + Math.cos(a - w) * len, ly + Math.sin(a - w) * len);
    k.lineTo(lx + Math.cos(a + w) * len, ly + Math.sin(a + w) * len);
    k.closePath();
    k.fill();
  }
  g.globalCompositeOperation = "screen";
  g.drawImage(blurred(c, 10 * u), 0, 0);
  g.globalCompositeOperation = "source-over";
}

// ───────────────────────── ruins ─────────────────────────
export interface Proj {
  /** ground line (screen y), centre x, vanishing height above ground, scale */
  gy: number;
  cx: number;
  vp: number;
  sc: number;
}
/** World (x on the ground line, h above it, in u at this layer's scale) → screen. */
export function P(p: Proj, x: number, h: number): [number, number] {
  const hh = h * p.sc;
  const f = Math.max(0.05, 1 - hh / p.vp);
  return [p.cx + (x - p.cx) * f, p.gy - hh];
}
export function polyPath(path: Path2D, pts: [number, number][]) {
  pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
}
// ───────────────────────── floor ─────────────────────────
export function drawFloor(g: Ctx, s: Scene, u: number) {
  const { W, H, arena, theme: t } = s;
  const y0 = Math.round(s.horizon * H);
  const rows = H - y0;
  const aw = arena.width,
    ah = arena.height;
  // far edge: a bit past the arena's middle; near edge: its bottom border
  const sFar = ah * 0.42,
    sNear = ah * 1.0;
  for (let i = 0; i < rows; i++) {
    const v = (i + 0.5) / rows;
    // perspective: equal steps on the floor bunch up toward the horizon
    const z = v / (v + 0.35 * (1 - v));
    const sy = sFar + (sNear - sFar) * z;
    const wv = W * (1.1 + 2.4 * v);
    g.drawImage(arena, 0, sy, aw, 2, W / 2 - wv / 2, y0 + i, wv, 1.6);
  }
  // fog at the far edge, and light from the boss's side
  const fog = g.createLinearGradient(0, y0 - 30 * u, 0, H);
  fog.addColorStop(0, rgba(t.haze, 1));
  fog.addColorStop(0.35, rgba(t.haze, 0.55));
  fog.addColorStop(1, rgba(t.haze, 0.05));
  g.fillStyle = fog;
  g.fillRect(0, y0 - 30 * u, W, H - y0 + 30 * u);
}

// ───────────────────────── rocks ─────────────────────────
export function rock(
  g: Ctx,
  s: Scene,
  pat: CanvasPattern,
  x: number,
  y: number,
  R: number,
  rot: number,
  r: () => number,
  crack: boolean,
) {
  const t = s.theme;
  const n = 11 + Math.floor(r() * 5);
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (TAU * i) / n + (r() - 0.5) * 0.35;
    // a flatter top, a jagged pointed underside
    const under = Math.sin(a) > 0;
    const rr = R * (under ? 0.75 + r() * 0.5 : 0.7 + r() * 0.2);
    pts.push([Math.cos(a) * rr * 1.3, Math.sin(a) * rr * (under ? 1.15 : 0.7)]);
  }
  const lx = s.sun.x * s.W - x,
    ly = s.sun.y * s.H - y;
  const la = Math.atan2(ly, lx) - rot;
  const Lx = Math.cos(la),
    Ly = Math.sin(la);
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const path = new Path2D();
  polyPath(path, pts);
  // rim light sliver on the lit side, then the body
  g.fillStyle = t.rim;
  g.fill(path);
  g.save();
  g.translate(-Lx * R * 0.06, -Ly * R * 0.06);
  g.clip(path);
  const body = g.createLinearGradient(Lx * R, Ly * R, -Lx * R, -Ly * R);
  body.addColorStop(0, mix(t.stone, t.rim, 0.35));
  body.addColorStop(0.45, t.stone);
  body.addColorStop(1, mix(t.stone, "#000000", 0.55));
  g.fillStyle = body;
  g.fillRect(-R * 2, -R * 2, R * 4, R * 4);
  // chiselled facets, lighter where they face the light
  for (let i = 0; i < 6; i++) {
    const a = r() * TAU;
    const cx = Math.cos(a) * R * 0.5 * r(),
      cy = Math.sin(a) * R * 0.4 * r();
    const f: [number, number][] = [];
    const m = 3 + Math.floor(r() * 2);
    for (let k = 0; k < m; k++) {
      const b = (TAU * k) / m + r() * 0.8;
      f.push([
        cx + Math.cos(b) * R * (0.3 + r() * 0.35),
        cy + Math.sin(b) * R * (0.25 + r() * 0.3),
      ]);
    }
    const facing = Math.cos(a - la);
    const fp = new Path2D();
    polyPath(fp, f);
    g.fillStyle =
      facing > 0
        ? rgba(t.rim, 0.1 + 0.18 * facing)
        : `rgba(0,0,0,${0.12 - 0.2 * facing})`;
    g.fill(fp);
  }
  g.globalAlpha = 0.4;
  g.globalCompositeOperation = "overlay";
  g.fillStyle = pat;
  g.fillRect(-R * 2, -R * 2, R * 4, R * 4);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  if (crack && t.crack) {
    g.strokeStyle = t.crack;
    g.lineWidth = Math.max(1, R * 0.05);
    g.shadowColor = t.crack;
    g.shadowBlur = R * 0.35;
    g.beginPath();
    let px = -R * 0.8,
      py = (r() - 0.3) * R * 0.4;
    g.moveTo(px, py);
    for (let k = 0; k < 4; k++) {
      px += R * (0.3 + r() * 0.2);
      py += (r() - 0.4) * R * 0.35;
      g.lineTo(px, py);
    }
    g.stroke();
  }
  g.restore();
  g.restore();
}

// ───────────────────────── ribbons ─────────────────────────
export interface Ribbon {
  /** z > 0 in front of the boss; a: brightness 0-1. */
  pts: { x: number; y: number; z: number; w: number; a: number }[];
  col: [string, string, string];
}
/**
 * A ribbon of energy spiralling up around (cx, cy): a tilted ellipse that
 * rises as it turns, swelling and thinning, brightest in its middle.
 * `off` shifts a strand of a bundle sideways (px) and in phase.
 */
export function spiral(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  tilt: number,
  t0: number,
  t1: number,
  rise: number,
  width: number,
  col: [string, string, string],
  wob: number,
  ph: number,
  off = 0,
  curl = 0,
): Ribbon {
  const pts = [];
  const N = 160;
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    const a = t0 + (t1 - t0) * f;
    const wr =
      1 +
      wob * Math.sin(a * 2.3 + ph) +
      wob * 0.6 * Math.sin(a * 4.7 + ph * 1.7) +
      off * 0.012 * Math.sin(a * 3.1 + ph * 2);
    const ex = Math.cos(a) * (rx + off) * wr,
      ey =
        Math.sin(a) * (ry + off * 0.3) * wr -
        rise * f +
        off * 0.4 * Math.sin(a * 2 + ph);
    const x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt);
    const y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
    const env = Math.pow(Math.sin(Math.PI * f), 0.9);
    const w = width * env * (0.45 + 0.55 * Math.sin(a * 1.3 + ph) ** 2);
    pts.push({ x, y, z: Math.sin(a), w, a: Math.pow(env, 0.6) });
  }
  if (curl) {
    // the tail curls up on itself, like a brush flick
    const n = pts.length;
    let px = pts[n - 1].x,
      py = pts[n - 1].y;
    let th = Math.atan2(py - pts[n - 4].y, px - pts[n - 4].x);
    let step = Math.hypot(px - pts[n - 4].x, py - pts[n - 4].y) / 3;
    const z = pts[n - 1].z;
    for (let j = 1; j <= 46; j++) {
      th += curl * (0.05 + j * 0.006);
      step *= 0.965;
      px += Math.cos(th) * step;
      py += Math.sin(th) * step;
      const f = j / 46;
      pts.push({
        x: px,
        y: py,
        z,
        w: width * 0.55 * (1 - f) * (0.5 + 0.5 * Math.sin(f * Math.PI + 0.6)),
        a: 0.9 * (1 - f * 0.6),
      });
    }
    // swell the end that leads into the curl
    for (let j = 0; j < 30; j++)
      pts[n - 30 + j].w = Math.max(pts[n - 30 + j].w, width * 0.55 * (j / 30));
  }
  return { pts, col };
}
export function ribbonPath(pts: Ribbon["pts"], scale: number) {
  const L: [number, number][] = [],
    R: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b.y - a.y),
      ny = b.x - a.x;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    const w = pts[i].w * scale;
    L.push([pts[i].x + nx * w, pts[i].y + ny * w]);
    R.push([pts[i].x - nx * w, pts[i].y - ny * w]);
  }
  const p = new Path2D();
  polyPath(p, [...L, ...R.reverse()]);
  return p;
}
/**
 * Draw the parts of the ribbons on one side of the boss (front: z > 0), in
 * short pieces so each fades with its brightness; front pieces fade out
 * over the face (`hole`: an ellipse x, y, rx, ry).
 */
export function drawRibbons(
  g: Ctx,
  s: Scene,
  u: number,
  ribbons: Ribbon[],
  front: boolean,
  hole?: [number, number, number, number],
  /** In front: the boss's silhouette and where it sits, to thin the ribbons over its body. */
  over?: { img: HTMLCanvasElement; x: number; y: number },
) {
  const { W, H } = s;
  const glow = canvas(W, H),
    core = canvas(W, H),
    hot = canvas(W, H);
  const gg = ctxOf(glow),
    cg = ctxOf(core),
    hg = ctxOf(hot);
  for (const rb of ribbons) {
    const step = 6;
    for (let i = 0; i + step < rb.pts.length; i += step) {
      const seg = rb.pts.slice(i, i + step + 1);
      const m = seg[step >> 1];
      if (m.z > 0 !== front) continue;
      let a = m.a * (front ? 1 : 0.7);
      if (hole) {
        const d = Math.hypot(
          (m.x - hole[0]) / hole[2],
          (m.y - hole[1]) / hole[3],
        );
        a *= Math.min(1, Math.max(0, (d - 1.05) / 0.5));
      }
      if (a < 0.02) continue;
      gg.fillStyle = rgba(rb.col[0], (front ? 0.38 : 0.55) * a);
      gg.fill(ribbonPath(seg, 3));
      cg.fillStyle = rgba(rb.col[1], 0.62 * a);
      cg.fill(ribbonPath(seg, 1));
      cg.fillStyle = rgba(rb.col[1], 0.5 * a);
      cg.fill(ribbonPath(seg, 0.55));
      // the bright leading edge
      hg.strokeStyle = rgba(rb.col[2], 0.75 * a);
      hg.lineWidth = Math.max(0.7 * u, m.w * 0.12);
      hg.beginPath();
      seg.forEach((q, j) => {
        const pa = seg[Math.max(0, j - 1)],
          pb = seg[Math.min(seg.length - 1, j + 1)];
        let nx = -(pb.y - pa.y),
          ny = pb.x - pa.x;
        const l = Math.hypot(nx, ny) || 1;
        nx /= l;
        ny /= l;
        const x = q.x + nx * q.w * 0.7,
          y = q.y + ny * q.w * 0.7;
        if (j) hg.lineTo(x, y);
        else hg.moveTo(x, y);
      });
      hg.stroke();
      // a crackling filament along the wide ribbons
      if (m.w > 9 * u) {
        hg.lineWidth = Math.max(0.7 * u, m.w * 0.06);
        hg.strokeStyle = rgba(rb.col[2], 0.8 * a);
        hg.beginPath();
        seg.forEach((q, j) => {
          const jag =
            Math.sin((i + j) * 0.42) * 0.7 + Math.sin((i + j) * 1.13) * 0.3;
          const x = q.x + jag * q.w * 1.4,
            y = q.y - jag * q.w * 1.1;
          if (j) hg.lineTo(x, y);
          else hg.moveTo(x, y);
        });
        hg.stroke();
      }
    }
  }
  const glowB = blurred(glow, 16 * u),
    coreB = blurred(core, 1.2 * u),
    hotB = blurred(hot, 0.5 * u);
  if (over)
    for (const [c, a] of [
      [glowB, 0.75],
      [coreB, 0.5],
      [hotB, 0.35],
    ] as const) {
      const k = ctxOf(c);
      k.globalCompositeOperation = "destination-out";
      k.globalAlpha = a;
      k.drawImage(over.img, over.x, over.y);
    }
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = 0.8;
  g.drawImage(glowB, 0, 0);
  g.globalCompositeOperation = "screen";
  g.globalAlpha = 1;
  g.drawImage(coreB, 0, 0);
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = 0.9;
  g.drawImage(hotB, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
}

// ───────────────────────── particles ─────────────────────────
export function sparkle(
  g: Ctx,
  x: number,
  y: number,
  R: number,
  col: string,
  a: number,
) {
  g.save();
  g.globalCompositeOperation = "lighter";
  const gr = g.createRadialGradient(x, y, 0, x, y, R * 1.2);
  gr.addColorStop(0, rgba("#ffffff", a));
  gr.addColorStop(0.25, rgba(col, a * 0.6));
  gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, R * 1.2, 0, TAU);
  g.fill();
  g.fillStyle = rgba("#ffffff", a);
  g.beginPath();
  const w = R * 0.09;
  g.moveTo(x - R * 2.2, y);
  g.quadraticCurveTo(x, y - w, x, y - R * 2.2);
  g.quadraticCurveTo(x, y - w, x + R * 2.2, y);
  g.quadraticCurveTo(x, y + w, x, y + R * 2.2);
  g.quadraticCurveTo(x, y + w, x - R * 2.2, y);
  g.fill();
  g.restore();
}
export function bokeh(
  g: Ctx,
  x: number,
  y: number,
  R: number,
  col: string,
  a: number,
) {
  g.save();
  g.globalCompositeOperation = "lighter";
  const gr = g.createRadialGradient(x, y, 0, x, y, R);
  gr.addColorStop(0, rgba(col, a * 0.5));
  gr.addColorStop(0.8, rgba(col, a * 0.35));
  gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, R, 0, TAU);
  g.fill();
  g.restore();
}
export function particle(
  g: Ctx,
  s: Scene,
  kind: Particle,
  x: number,
  y: number,
  R: number,
  r: () => number,
) {
  const t = s.theme;
  g.save();
  g.translate(x, y);
  switch (kind) {
    case "embers": {
      g.rotate(-Math.PI / 2 + (r() - 0.5) * 1.2);
      g.globalCompositeOperation = "lighter";
      const gr = g.createLinearGradient(-R * 3, 0, R, 0);
      gr.addColorStop(0, "rgba(255,90,20,0)");
      gr.addColorStop(0.7, "rgba(255,170,60,0.85)");
      gr.addColorStop(1, "rgba(255,250,210,1)");
      g.fillStyle = gr;
      g.shadowColor = "rgba(255,140,40,0.9)";
      g.shadowBlur = R * 3;
      g.beginPath();
      g.ellipse(-R, 0, R * 2.2, R * 0.42, 0, 0, TAU);
      g.fill();
      break;
    }
    case "lanterns": {
      // a far sky lantern: a warm glowing capsule
      g.globalCompositeOperation = "lighter";
      const gg = g.createRadialGradient(0, 0, 0, 0, 0, R * 3);
      gg.addColorStop(0, "rgba(255,190,90,0.6)");
      gg.addColorStop(1, "rgba(255,120,40,0)");
      g.fillStyle = gg;
      g.fillRect(-R * 3, -R * 3, R * 6, R * 6);
      g.globalCompositeOperation = "source-over";
      const lg = g.createLinearGradient(0, -R, 0, R);
      lg.addColorStop(0, "#ffd890");
      lg.addColorStop(1, "#ff8a2a");
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(-R * 0.6, -R);
      g.quadraticCurveTo(0, -R * 1.25, R * 0.6, -R);
      g.lineTo(R * 0.45, R * 0.8);
      g.lineTo(-R * 0.45, R * 0.8);
      g.closePath();
      g.fill();
      break;
    }
    case "droplets": {
      g.rotate((r() - 0.5) * 0.8);
      const dg = g.createRadialGradient(
        -R * 0.3,
        -R * 0.1,
        0,
        0,
        R * 0.3,
        R * 1.3,
      );
      dg.addColorStop(0, "rgba(255,255,255,0.95)");
      dg.addColorStop(0.35, rgba(t.ribbons[0][1], 0.75));
      dg.addColorStop(1, rgba(t.ribbons[0][0], 0.35));
      g.fillStyle = dg;
      g.beginPath();
      g.moveTo(0, -R * 1.8);
      g.bezierCurveTo(R * 0.4, -R * 0.8, R, 0, R, R * 0.35);
      g.arc(0, R * 0.35, R, 0, Math.PI);
      g.bezierCurveTo(-R, 0, -R * 0.4, -R * 0.8, 0, -R * 1.8);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.beginPath();
      g.ellipse(-R * 0.35, R * 0.05, R * 0.18, R * 0.32, 0.4, 0, TAU);
      g.fill();
      break;
    }
    case "bubbles": {
      g.strokeStyle = "rgba(220,255,255,0.75)";
      g.lineWidth = Math.max(1, R * 0.12);
      const bg = g.createRadialGradient(-R * 0.3, -R * 0.3, 0, 0, 0, R);
      bg.addColorStop(0, "rgba(255,255,255,0.35)");
      bg.addColorStop(0.7, "rgba(160,240,255,0.08)");
      bg.addColorStop(1, "rgba(160,240,255,0.3)");
      g.fillStyle = bg;
      g.beginPath();
      g.arc(0, 0, R, 0, TAU);
      g.fill();
      g.stroke();
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.beginPath();
      g.ellipse(-R * 0.4, -R * 0.4, R * 0.22, R * 0.12, -0.7, 0, TAU);
      g.fill();
      break;
    }
    case "ink": {
      g.rotate((r() - 0.5) * 0.6);
      const ig = g.createRadialGradient(
        -R * 0.3,
        -R * 0.2,
        0,
        0,
        R * 0.3,
        R * 1.3,
      );
      ig.addColorStop(0, "#6a4cc8");
      ig.addColorStop(0.5, "#2a1660");
      ig.addColorStop(1, "#0e0626");
      g.fillStyle = ig;
      g.shadowColor = rgba(t.ribbons[0][0], 0.9);
      g.shadowBlur = R * 1.5;
      g.beginPath();
      g.moveTo(0, -R * 1.9);
      g.bezierCurveTo(R * 0.4, -R * 0.8, R, 0, R, R * 0.35);
      g.arc(0, R * 0.35, R, 0, Math.PI);
      g.bezierCurveTo(-R, 0, -R * 0.4, -R * 0.8, 0, -R * 1.9);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "rgba(230,210,255,0.85)";
      g.beginPath();
      g.ellipse(-R * 0.35, R * 0.1, R * 0.16, R * 0.28, 0.4, 0, TAU);
      g.fill();
      break;
    }
    case "crystals":
    case "prisms": {
      g.rotate(r() * TAU);
      const L = R * 1.8;
      const col =
        kind === "prisms"
          ? `hsl(${Math.floor(r() * 360)},90%,72%)`
          : t.ribbons[Math.floor(r() * t.ribbons.length)][1];
      g.shadowColor = col;
      g.shadowBlur = R * 2;
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, -L);
      g.lineTo(R * 0.55, -L * 0.2);
      g.lineTo(R * 0.35, L * 0.7);
      g.lineTo(-R * 0.4, L * 0.6);
      g.lineTo(-R * 0.55, -L * 0.25);
      g.closePath();
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "rgba(255,255,255,0.75)";
      g.beginPath();
      g.moveTo(0, -L);
      g.lineTo(R * 0.55, -L * 0.2);
      g.lineTo(0, L * 0.1);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.beginPath();
      g.moveTo(0, L * 0.1);
      g.lineTo(R * 0.35, L * 0.7);
      g.lineTo(-R * 0.4, L * 0.6);
      g.closePath();
      g.fill();
      break;
    }
    case "stars": {
      g.rotate(r() * TAU);
      g.globalCompositeOperation = "lighter";
      g.fillStyle = "rgba(255,248,220,0.95)";
      g.shadowColor = t.spark;
      g.shadowBlur = R * 2.5;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2,
          rr = i % 2 ? R * 0.45 : R;
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
      break;
    }
    case "motes":
      g.restore();
      bokeh(g, x, y, R * 1.4, t.spark, 0.9);
      return;
  }
  g.restore();
}

// ───────────────────────── the boss ─────────────────────────
/** Draw the boss with a mild low-angle keystone (its foot nearer, a touch wider). */
export function keystone(src: HTMLCanvasElement, amount: number) {
  const c = canvas(src.width * (1 + amount), src.height);
  const g = ctxOf(c);
  const H = src.height;
  for (let y = 0; y < H; y += 2) {
    const f = 1 + amount * (y / H);
    const w = src.width * f;
    g.drawImage(src, 0, y, src.width, 2, (c.width - w) / 2, y, w, 2.2);
  }
  return c;
}
export function rimLight(
  boss: HTMLCanvasElement,
  dx: number,
  dy: number,
  col: string,
  px: number,
) {
  const c = canvas(boss.width, boss.height);
  const g = ctxOf(c);
  g.drawImage(boss, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = col;
  g.fillRect(0, 0, c.width, c.height);
  // keep the boss's pixels the shifted copy does not cover: the edge facing the light
  g.globalCompositeOperation = "destination-out";
  g.drawImage(boss, -dx, -dy);
  const out = blurred(c, px);
  const m = ctxOf(out);
  m.globalCompositeOperation = "destination-in";
  m.drawImage(boss, 0, 0);
  return out;
}
