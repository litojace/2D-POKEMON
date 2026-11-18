/*
 * The Plaza's surroundings, drawn (plaza-surround.ts says what and where).
 *
 * The ground past each edge is baked once into four strips around the
 * Plaza's own ground picture (north, south, west, east; no overlap), at
 * the same resolution as the Plaza's own (so no seam where they meet;
 * 0.6 on phones short of memory), painted the same way. The strips carry
 * every prop that can never be drawn over a walker. The river is a hole in
 * the north strip; its water is drawn under it every frame (ripples drifting
 * with the current, glints, ducks, a moored boat bobbing, the far bank's
 * lamps trembling on it at night), so the footbridges baked over it cover
 * it as they should. Cows and the windmill's sails move, so they are drawn
 * every frame too, under everyone (they never reach a walker's picture).
 */
import { GFX as GFX0 } from "../farm/farm-gfx";
import { PLAZA } from "../../../../packages/shared/src/plaza";
import {
  BAKED,
  COWS,
  LIVE,
  RIVER_LAMPS,
  FARM,
  PLAZA_MARGIN,
  PLAZA_SCALE,
  RIVER,
  SURROUND,
  millHub,
  propBox,
  type SurroundProp,
} from "./plaza-surround";
import { spot, type Drawable } from "./plaza-depth";

// The farm art is ported, untyped drawing code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GFX: any = GFX0;
type Ctx = CanvasRenderingContext2D;
const W = PLAZA.width,
  H = PLAZA.height,
  M = PLAZA_MARGIN;

const TREE_KINDS = ["round", "mint", "lime", "autumn", "apple", "cherry"];
const treeSprite = (p: SurroundProp) =>
  p.kind === "pine"
    ? GFX.tree("pine", 40 + (p.v % 4), Math.round(p.s * 8) / 8)
    : GFX.tree(
        TREE_KINDS[p.v % TREE_KINDS.length],
        50 + (p.v % 5),
        Math.round(p.s * 8) / 8,
      );

/** Draw one prop at rest (baked, or live without its motion). */
export function drawProp(g: Ctx, p: SurroundProp, time = 0) {
  switch (p.kind) {
    case "tree":
    case "pine":
      GFX.drawTree(g, treeSprite(p), p.x, p.y, time, p.v);
      return;
    case "bush":
      GFX.shadow(g, p.x + 5, p.y + 2, 32 * p.s, 8 * p.s);
      GFX.blit(
        g,
        GFX.bush(
          p.v % 3 ? "green" : "flower",
          60 + (p.v % 6),
          Math.round(70 * p.s),
        ),
        p.x,
        p.y + 4,
      );
      return;
    case "rock":
      GFX.shadow(g, p.x + 4, p.y + 2, 24 * p.s, 6 * p.s);
      GFX.blit(g, GFX.rock(70 + (p.v % 4), Math.round(46 * p.s)), p.x, p.y + 4);
      return;
    case "hay":
      GFX.shadow(g, p.x + 4, p.y + 2, 40, 9);
      GFX.blit(g, GFX.hay(), p.x, p.y + 2, p.s);
      return;
    case "barn":
      GFX.shadow(g, p.x + 20, p.y + 4, 140, 22);
      GFX.blit(g, GFX.barn(), p.x, p.y, p.s);
      return;
    case "mill":
      GFX.shadow(g, p.x + 20, p.y + 4, 60, 14);
      GFX.blit(g, GFX.windmillBody(), p.x, p.y, p.s);
      return;
    case "scarecrow":
      GFX.shadow(g, p.x + 4, p.y + 2, 22, 6);
      GFX.blit(g, GFX.scarecrow(), p.x, p.y, p.s);
      return;
    case "well":
      GFX.shadow(g, p.x + 6, p.y + 2, 50, 12);
      GFX.blit(g, GFX.well(), p.x, p.y, p.s);
      return;
    case "lamp":
      GFX.shadow(g, p.x + 6, p.y + 2, 18, 6);
      GFX.blit(g, GFX.lamp(), p.x, p.y + 4, PLAZA_SCALE.lamp * p.s);
      return;
    case "crates":
      GFX.shadow(g, p.x + 6, p.y + 2, 44, 10);
      GFX.blit(g, GFX.crates(), p.x, p.y, p.s);
      return;
  }
}

/* ---------- ground ---------- */
function rnd(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
/**
 * Painted grass over a rect, exactly as the Plaza's own ground is painted
 * (plaza-scene.ts paintBg: the same colours, the same number of dabs,
 * tufts and soft patches per area), so where the Plaza's ground meets the
 * surroundings there is no seam.
 */
function grass(
  g: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  base: string,
  r: () => number,
) {
  g.fillStyle = base;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  // The Plaza's ground: 70 patches, 26000 dabs, 2200 tufts on 2700 x 1700.
  const k = ((x1 - x0) * (y1 - y0)) / (W * H);
  for (let i = 0; i < 70 * k; i++) {
    const x = x0 + r() * (x1 - x0),
      y = y0 + r() * (y1 - y0),
      rr = 120 + r() * 320,
      c = r() < 0.5 ? "150,220,110" : "70,150,70",
      gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, `rgba(${c},.28)`);
    gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr;
    g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  const greens = ["#6cb851", "#82cc63", "#5fae4a", "#8fd46e", "#71bd55"];
  for (let i = 0; i < 26000 * k; i++) {
    g.fillStyle = greens[i % 5];
    g.beginPath();
    g.ellipse(
      x0 + r() * (x1 - x0),
      y0 + r() * (y1 - y0),
      2.4 + r() * 2.6,
      1.3 + r(),
      r() * 3,
      0,
      7,
    );
    g.fill();
  }
  g.lineWidth = 1.6;
  for (const col of ["#4f9a3c", "#a6e07e"]) {
    g.strokeStyle = col;
    g.beginPath();
    for (let i = 0; i < 1100 * k; i++) {
      const x = x0 + r() * (x1 - x0),
        y = y0 + r() * (y1 - y0);
      g.moveTo(x - 3, y);
      g.lineTo(x - 4, y - 7);
      g.moveTo(x, y);
      g.lineTo(x, y - 9);
      g.moveTo(x + 3, y);
      g.lineTo(x + 5, y - 7);
    }
    g.stroke();
  }
}
/** The far bank's stone wall, the near coping, and the footbridges. */
function paintRiverBanks(g: Ctx) {
  const x0 = -M,
    x1 = W + M;
  // Far wall: its top, then its face down to the water, stone courses.
  g.fillStyle = "#d9d2c2";
  g.fillRect(x0, RIVER.y0 - 20, x1 - x0, 12);
  g.fillStyle = "#9c9282";
  g.fillRect(x0, RIVER.y0 - 8, x1 - x0, 20);
  g.strokeStyle = "rgba(0,0,0,.18)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x0, RIVER.y0 + 2);
  g.lineTo(x1, RIVER.y0 + 2);
  for (let x = x0; x < x1; x += 26) {
    g.moveTo(x, RIVER.y0 - 8);
    g.lineTo(x, RIVER.y0 + 2);
    g.moveTo(x + 13, RIVER.y0 + 2);
    g.lineTo(x + 13, RIVER.y0 + 12);
  }
  g.stroke();
  g.fillStyle = "rgba(30,60,50,.35)";
  g.fillRect(x0, RIVER.y0 + 8, x1 - x0, 4);
  // Near coping, the Plaza's side.
  g.fillStyle = "#cfc6b2";
  g.fillRect(x0, RIVER.y1, x1 - x0, -RIVER.y1);
  g.fillStyle = "rgba(255,255,255,.35)";
  g.fillRect(x0, RIVER.y1, x1 - x0, 2);
}
function paintBridge(g: Ctx, bx: number) {
  const y0 = RIVER.y0 - 22,
    y1 = 4,
    hw = 34;
  // Shadow on the water, then the deck's planks.
  g.fillStyle = "rgba(10,30,40,.3)";
  g.fillRect(bx - hw + 6, y0 + 10, hw * 2, y1 - y0);
  g.fillStyle = "#a9773f";
  g.fillRect(bx - hw, y0, hw * 2, y1 - y0);
  g.strokeStyle = "#7a5230";
  g.lineWidth = 1.5;
  g.beginPath();
  for (let y = y0 + 8; y < y1; y += 9) {
    g.moveTo(bx - hw, y);
    g.lineTo(bx + hw, y);
  }
  g.stroke();
  // The deck's edge facing the water on each side, and the railings.
  for (const side of [-1, 1]) {
    const x = bx + side * hw;
    g.fillStyle = "#6a4426";
    g.fillRect(side < 0 ? x : x - 5, y0, 5, y1 - y0);
    g.fillStyle = "#8a5a30";
    for (let y = y0 + 4; y <= y1; y += 24) g.fillRect(x - 2.5, y - 26, 5, 28);
    g.fillRect(x - 2.5, y0 - 24, 5, y1 - y0 + 4);
  }
}
/** The verge north of the Plaza (inside its own ground picture): flowers and a railing. */
export function paintVerge(g: Ctx) {
  const r = rnd(77);
  const shade = g.createLinearGradient(0, 0, 0, 112);
  shade.addColorStop(0, "rgba(60,90,40,.2)");
  shade.addColorStop(1, "rgba(60,90,40,0)");
  g.fillStyle = shade;
  g.fillRect(0, 0, W, 112);
  for (let x = 14; x < W; x += 34 + r() * 20) {
    if (RIVER.bridges.some((b) => Math.abs(x - b) < 50)) continue;
    const c = ["#ffffff", "#fff3a6", "#ffc4dc", "#cfe2ff", "#ff9bb5"][
      Math.floor(r() * 5)
    ];
    const y = 70 + r() * 22;
    g.fillStyle = "#4f9a3c";
    g.beginPath();
    g.ellipse(x, y + 3, 9, 4, 0, 0, 7);
    g.fill();
    for (let k = 0; k < 5; k++) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(
        x + Math.cos(k * 1.256) * 3,
        y + Math.sin(k * 1.256) * 3,
        2.4,
        0,
        7,
      );
      g.fill();
    }
  }
  // A white railing along the bank; open where the footbridges land.
  const yr = 100;
  g.fillStyle = "rgba(0,0,0,.14)";
  g.fillRect(0, yr + 1, W, 4);
  for (let x = 8; x < W; x += 28) {
    if (RIVER.bridges.some((b) => Math.abs(x - b) < 30)) continue;
    g.fillStyle = "#e9e4da";
    g.fillRect(x - 3, yr - 30, 6, 32);
    g.fillStyle = "#ffffff";
    g.fillRect(x - 3, yr - 30, 6, 4);
  }
  g.fillStyle = "#f4f0e8";
  let x = 0;
  for (const b of [...RIVER.bridges, W + 40]) {
    const a = x,
      e = Math.min(W, b - 30);
    g.fillRect(a, yr - 26, e - a, 4);
    g.fillRect(a, yr - 14, e - a, 3);
    x = b + 30;
  }
  // Gate posts where each footbridge lands.
  for (const b of RIVER.bridges)
    for (const side of [-1, 1]) {
      g.fillStyle = "#c48a4a";
      g.fillRect(b + side * 34 - 5, yr - 40, 10, 42);
      g.fillStyle = "#ffd65b";
      g.beginPath();
      g.arc(b + side * 34, yr - 43, 5, 0, 7);
      g.fill();
    }
}
/** The farmland south of the gate. */
function paintFarm(g: Ctx, r: () => number) {
  const y0 = H,
    y1 = H + M;
  grass(g, -M, y0, W + M, y1, "#77c25b", r);
  // A hedge line right past the Plaza's garden strip.
  g.fillStyle = "#3f8f3a";
  for (let x = -M; x < W + M; x += 22) {
    if (x > FARM.road.x0 - 10 && x < FARM.road.x1 + 10) continue;
    g.beginPath();
    g.arc(x, y0 + 8, 13, 0, 7);
    g.fill();
  }
  g.fillStyle = "#5fb34c";
  for (let x = -M + 6; x < W + M; x += 22) {
    if (x > FARM.road.x0 - 10 && x < FARM.road.x1 + 10) continue;
    g.beginPath();
    g.arc(x, y0 + 4, 7, 0, 7);
    g.fill();
  }
  // Fields in rows: soil, and what grows in each.
  const fields: [number, number, string, string][] = [
    [-M + 20, 420, "#e8c25a", "#c79a32"],
    [880, FARM.road.x0 - 30, "#7cc95a", "#4f9a3c"],
    [FARM.road.x1 + 30, 1580, "#ffb04a", "#5fae4a"],
    [1760, 2140, "#d8e86a", "#8fbf3a"],
  ];
  for (const [a, b, crop, leaf] of fields) {
    for (let y = y0 + 40, i = 0; y < y1 - 10; y += 22, i++) {
      g.fillStyle = i % 2 ? "#8a5a34" : "#9a6a3e";
      g.fillRect(a, y, b - a, 12);
      for (let x = a + 8; x < b - 6; x += 16) {
        g.fillStyle = leaf;
        g.beginPath();
        g.ellipse(x, y + 2, 6, 4, 0, 0, 7);
        g.fill();
        g.fillStyle = crop;
        g.beginPath();
        g.arc(x + (r() - 0.5) * 3, y - 1, 3, 0, 7);
        g.fill();
      }
    }
  }
  // The farm road from the gate, wheel ruts and verges.
  g.fillStyle = "#c9a774";
  g.fillRect(FARM.road.x0, y0, FARM.road.x1 - FARM.road.x0, y1 - y0);
  g.fillStyle = "rgba(120,80,40,.25)";
  g.fillRect(FARM.road.x0 + 22, y0, 10, y1 - y0);
  g.fillRect(FARM.road.x1 - 32, y0, 10, y1 - y0);
  for (let i = 0; i < 140; i++) {
    g.fillStyle = r() < 0.5 ? "rgba(255,255,255,.18)" : "rgba(90,60,30,.18)";
    g.fillRect(
      FARM.road.x0 + r() * (FARM.road.x1 - FARM.road.x0),
      y0 + r() * (y1 - y0),
      3,
      2,
    );
  }
  // The paddock's fence.
  const P = FARM.paddock;
  g.strokeStyle = "#8a5a30";
  g.lineWidth = 3;
  g.beginPath();
  for (const y of [P.y0, P.y1])
    for (const dz of [14, 24]) {
      g.moveTo(P.x0, y - dz);
      g.lineTo(P.x1, y - dz);
    }
  for (const x of [P.x0, P.x1])
    for (const dz of [14, 24]) {
      g.moveTo(x, P.y0 - dz);
      g.lineTo(x, P.y1 - dz);
    }
  g.stroke();
  g.fillStyle = "#6a4426";
  for (let x = P.x0; x <= P.x1; x += 46)
    for (const y of [P.y0, P.y1]) g.fillRect(x - 3, y - 30, 6, 32);
  for (let y = P.y0; y <= P.y1; y += 46)
    for (const x of [P.x0, P.x1]) g.fillRect(x - 3, y - 30, 6, 32);
}
/** The woods west or east: a darker floor, deeper in. */
function paintWoods(g: Ctx, side: -1 | 1, r: () => number) {
  const x0 = side < 0 ? -M : W,
    x1 = side < 0 ? 0 : W + M;
  // The Plaza's own grass at the edge, darker deeper into the woods.
  grass(g, x0, 0, x1, H, "#77c25b", r);
  const gr = g.createLinearGradient(
    side < 0 ? 0 : W,
    0,
    side < 0 ? -M : W + M,
    0,
  );
  // Darker deeper in, from nothing at the Plaza's edge (no seam there).
  gr.addColorStop(0, "rgba(30,70,30,0)");
  gr.addColorStop(0.3, "rgba(30,70,30,0)");
  gr.addColorStop(1, "rgba(30,70,30,.3)");
  g.fillStyle = gr;
  g.fillRect(x0, 0, x1 - x0, H);
  // The verge's shade along the river carries on into the woods.
  const verge = g.createLinearGradient(0, 0, 0, 112);
  verge.addColorStop(0, "rgba(60,90,40,.2)");
  verge.addColorStop(1, "rgba(60,90,40,0)");
  g.fillStyle = verge;
  g.fillRect(x0, 0, x1 - x0, 112);
  // Fallen leaves and ferns.
  for (let i = 0; i < 260; i++) {
    // (Only in the woods, not at the Plaza's edge.)
    const deep = 60 + r() * (M - 60),
      x = side < 0 ? -deep : W + deep,
      y = r() * H;
    g.fillStyle = ["#c98a3a", "#e0a84a", "#5f9a3c", "#3f7f34"][i % 4];
    g.beginPath();
    g.ellipse(x, y, 4, 2, r() * 3, 0, 7);
    g.fill();
  }
}

interface Strip {
  cv: HTMLCanvasElement;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** The four baked strips around the Plaza. */
export class Surroundings {
  strips: Strip[] = [];
  constructor(
    /** Resolution of the strips against the Plaza's own ground (1 px a world px). */
    readonly k: number,
  ) {}
  /** Paint the strips (once, on entering). */
  paint() {
    const r = rnd(9001);
    const rects: [number, number, number, number, (g: Ctx) => void][] = [
      [-M, -M, W + M, 0, (g) => this.north(g, r)],
      [-M, H, W + M, H + M, (g) => paintFarm(g, r)],
      [-M, 0, 0, H, (g) => paintWoods(g, -1, r)],
      [W, 0, W + M, H, (g) => paintWoods(g, 1, r)],
    ];
    const props = [...BAKED].sort((a, b) => a.y - b.y);
    this.strips = rects.map(([x0, y0, x1, y1, ground]) => {
      const cv = document.createElement("canvas");
      cv.width = Math.ceil((x1 - x0) * this.k);
      cv.height = Math.ceil((y1 - y0) * this.k);
      const g = cv.getContext("2d")!;
      g.setTransform(this.k, 0, 0, this.k, -x0 * this.k, -y0 * this.k);
      ground(g);
      for (const p of props) {
        const b = propBox(p);
        if (b.x1 < x0 || b.x0 > x1 || b.foot + 20 < y0 || b.top > y1) continue;
        drawProp(g, p);
      }
      return { cv, x0, y0, x1, y1 };
    });
  }
  private north(g: Ctx, r: () => number) {
    grass(g, -M, -M, W + M, RIVER.y0 - 20, "#77c25b", r);
    paintRiverBanks(g);
    // The water's hole: drawn every frame under this picture.
    g.save();
    g.globalCompositeOperation = "destination-out";
    g.fillRect(-M, RIVER.y0 + 12, W + 2 * M, RIVER.y1 - RIVER.y0 - 12);
    g.restore();
    for (const b of RIVER.bridges) paintBridge(g, b);
  }
  /** Copy the strips the view reaches. */
  draw(g: Ctx, vx0: number, vy0: number, vx1: number, vy1: number) {
    for (const s of this.strips) {
      const a = Math.max(vx0, s.x0),
        b = Math.max(vy0, s.y0),
        c = Math.min(vx1, s.x1),
        d = Math.min(vy1, s.y1);
      if (c <= a || d <= b) continue;
      g.drawImage(
        s.cv,
        (a - s.x0) * this.k,
        (b - s.y0) * this.k,
        (c - a) * this.k,
        (d - b) * this.k,
        a,
        b,
        c - a,
        d - b,
      );
    }
  }
  /** Pixels held (tests, the perf read-out). */
  get pixels() {
    return this.strips.reduce((n, s) => n + s.cv.width * s.cv.height, 0);
  }
  release() {
    for (const s of this.strips) s.cv.width = s.cv.height = 0;
    this.strips = [];
  }
}

/* ---------- every frame ---------- */
const DUCKS = [
  { kind: "drake", y: -60, speed: 14, off: 0 },
  { kind: "hen", y: -48, speed: 14, off: 26 },
  { kind: "hen", y: -100, speed: 9, off: 1400 },
];
const BOAT = { x: 300, y: -40 };
/** The river's water, under the north strip (call before drawing the strips). */
export function drawRiver(
  g: Ctx,
  t: number,
  n: number,
  low: boolean,
  vx0: number,
  vy0: number,
  vx1: number,
) {
  const top = RIVER.y0 + 12,
    bot = RIVER.y1;
  if (vy0 > bot) return;
  const xa = Math.max(-M, vx0 - 4),
    xb = Math.min(W + M, vx1 + 4);
  const gr = g.createLinearGradient(0, top, 0, bot);
  gr.addColorStop(0, "#2f7f9e");
  gr.addColorStop(0.5, "#4aa7c4");
  gr.addColorStop(1, "#6cc3d6");
  g.fillStyle = gr;
  g.fillRect(xa, top, xb - xa, bot - top);
  // The far wall's shadow on the water.
  g.fillStyle = `rgba(10,30,40,${0.26 - n * 0.1})`;
  g.fillRect(xa, top, xb - xa, 18);
  // Ripples drifting with the current (east), in rows across the river.
  const rows = low ? 3 : 5,
    step = low ? 90 : 64;
  g.lineCap = "round";
  g.lineWidth = 1.6;
  g.strokeStyle = n > 0.5 ? "rgba(150,180,230,.25)" : "rgba(255,255,255,.42)";
  g.beginPath();
  for (let r = 0; r < rows; r++) {
    const y = top + 24 + ((bot - top - 34) * (r + 0.5)) / rows;
    const off = (t * (16 + r * 3) + r * 37) % step;
    for (let x = Math.floor(xa / step) * step + off - step; x < xb; x += step) {
      const k = Math.floor(x / step) + r * 31;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + k);
      if (pulse < 0.25) continue;
      const len = 16 + ((k * 7919) % 17);
      g.moveTo(x, y);
      g.quadraticCurveTo(x + len / 2, y - 2.5, x + len, y);
    }
  }
  g.stroke();
  g.lineCap = "butt";
  // Glints of the sun twinkling.
  if (!low && n < 0.6) {
    for (let i = Math.floor(xa / 40); i < xb / 40; i++) {
      const tw = Math.sin(t * 3 + i * 1.7);
      if (tw < 0.6) continue;
      const x = i * 40 + ((i * 37) % 23),
        y = top + 26 + ((i * 53) % (bot - top - 34));
      g.fillStyle = `rgba(255,255,240,${(tw - 0.6) * 2})`;
      g.beginPath();
      g.moveTo(x, y - 2.5);
      g.lineTo(x + 4, y);
      g.lineTo(x, y + 2.5);
      g.lineTo(x - 4, y);
      g.fill();
    }
  }
  // A rowing boat moored by the near bank, bobbing.
  if (BOAT.x > xa - 80 && BOAT.x < xb + 80) {
    const bob = Math.sin(t * 1.3) * 1.6;
    g.save();
    g.translate(BOAT.x, BOAT.y + bob);
    g.rotate(Math.sin(t * 1.1 + 1) * 0.03);
    g.fillStyle = "rgba(10,30,40,.25)";
    g.beginPath();
    g.ellipse(0, 4, 50, 8, 0, 0, 7);
    g.fill();
    g.fillStyle = "#f4f1ea";
    g.beginPath();
    g.moveTo(-48, -10);
    g.quadraticCurveTo(-42, 4, -30, 4);
    g.lineTo(32, 4);
    g.quadraticCurveTo(46, 2, 50, -12);
    g.closePath();
    g.fill();
    g.fillStyle = "#d94a3a";
    g.fillRect(-40, -6, 80, 3);
    g.fillStyle = "#9a6a3a";
    g.beginPath();
    g.ellipse(0, -11, 44, 5, 0, 0, 7);
    g.fill();
    g.fillStyle = "#b07a44";
    g.fillRect(-5, -15, 10, 8);
    g.restore();
    g.strokeStyle = "#c9a46a";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(BOAT.x - 44, BOAT.y + bob - 8);
    g.quadraticCurveTo(BOAT.x - 60, BOAT.y + 10, BOAT.x - 70, RIVER.y1 + 2);
    g.stroke();
  }
  // Ducks paddling downstream (the whole river's length, round again).
  if (!low) {
    const span = W + 2 * M + 200;
    for (const d of DUCKS) {
      const x = -M - 100 + ((t * d.speed + d.off) % span);
      if (x < xa - 40 || x > xb + 40) continue;
      GFX.duck(g, d.kind, "swim", t + d.off, x, d.y, 1.15, 1, true);
    }
  }
}
/** At night, in the "lighter" pass: the far bank's lamps on the water. */
export function drawRiverLights(
  g: Ctx,
  t: number,
  n: number,
  vx0: number,
  vx1: number,
) {
  if (n < 0.2) return;
  for (const l of RIVER_LAMPS) {
    if (l.x < vx0 - 60 || l.x > vx1 + 60) continue;
    for (let k = 0; k < 6; k++) {
      const w = 12 - k * 1.4 + Math.sin(t * 4 + k * 1.3 + l.x) * 3;
      g.fillStyle = `rgba(255,214,140,${(0.42 - k * 0.06) * n})`;
      g.fillRect(
        l.x - w / 2 + Math.sin(t * 3 + k) * 2,
        RIVER.y0 + 22 + k * 12,
        w,
        3,
      );
    }
  }
}
/** Cows and the windmill's sails: moving, never over a walker. */
export function drawFarmLife(
  g: Ctx,
  t: number,
  reduced: boolean,
  vx0: number,
  vy1: number,
  vx1: number,
) {
  if (vy1 < H) return;
  for (const c of COWS)
    if (c.x > vx0 - 60 && c.x < vx1 + 60)
      GFX.cow(g, "graze", t + c.ph, c.x, c.y, 0.9, c.face);
  for (const p of SURROUND)
    if (p.kind === "mill" && p.x > vx0 - 120 && p.x < vx1 + 120) {
      const h = millHub(p);
      GFX.windmillSails(g, h.x, h.y, reduced ? 0.4 : t * 0.6, 0.9 * p.s);
    }
}
/** The props drawn live, as depth-sorted drawables. */
export { RIVER_LAMPS };
export function liveDrawables(
  g: Ctx,
  time: number,
  vx0: number,
  vx1: number,
): Drawable[] {
  const out: Drawable[] = [];
  for (const p of LIVE) {
    const b = propBox(p);
    if (b.x1 < vx0 - 20 || b.x0 > vx1 + 20) continue;
    out.push(
      spot(p.x, p.y, 20, p.y - b.top, () => drawProp(g, p, time), {
        sw: (b.x1 - b.x0) / 2,
        name: `surround:${p.kind}`,
      }),
    );
  }
  return out;
}
