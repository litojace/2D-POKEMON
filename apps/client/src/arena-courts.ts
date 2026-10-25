import { ARENAS, OBSTACLES, RULES } from "@arena/shared";

/**
 * The duel courts (Coliseum Sands, Tide Pools, Ember Forge, Shifting Ruins):
 * realistic floors and stone blocks standing on their collision footprints.
 * Painted once into canvases (no per-frame cost).
 *
 * One camera and one sun for everything:
 *  - K: the camera's squash of the ground (a ground circle of radius r is
 *    drawn r wide and r·K tall), the same as the town's plaza.
 *  - A point at height z is drawn z px above its ground spot.
 *  - SUNV: a point at height z casts its shadow z·SUNV from its foot
 *    (light from the upper left, as in town).
 * The court's walkable area reaches RULES.radius from every edge, so the back
 * wall stands just beyond it and nothing walkable is painted as solid.
 */
type Ctx = CanvasRenderingContext2D;
type Rect = { x: number; y: number; w: number; h: number };
const W = RULES.width,
  H = RULES.height;
/** How tall the stone blocks stand (px). */
export const BLOCK_H = 58;
const K = 0.78;
const SUNV = { x: 0.55, y: 0.12 };
const SHADOW = { alpha: 0.34, blur: 14 };
/** The arena wall's foot: just above the walkable area, so fighters stand in front of it. */
const WALL_FOOT = RULES.radius - 2;
/** Where duelists start (see the server's Arena.add), marked with plates. */
const SPAWNS: [number, string][] = [
  [260, "#e9b53a"],
  [1340, "#3f9fd9"],
];

let seed = 1;
const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ell = (c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) => {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
};
const gEll = (c: Ctx, x: number, y: number, r: number) => ell(c, x, y, r, r * K);
const mix = (a: string, b: string, t: number) => {
  const p = (h: string) =>
    h.startsWith("rgb")
      ? h.match(/\d+/g)!.slice(0, 3).map(Number)
      : [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a),
    B = p(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
};
function hull(pts: [number, number][]) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [],
    up: [number, number][] = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  for (const q of [...p].reverse()) {
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
function fillPoly(s: Ctx, pts: [number, number][]) {
  s.beginPath();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  s.fill();
}
/** Soft value noise: blotches at several scales, for natural variation. */
function noiseCanvas(w: number, h: number, scales: [number, number][], s0: number) {
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const o = out.getContext("2d")!;
  seed = s0;
  for (const [cell, alpha] of scales) {
    const gw = Math.ceil(w / cell) + 2,
      gh = Math.ceil(h / cell) + 2;
    const small = document.createElement("canvas");
    small.width = gw;
    small.height = gh;
    const sc = small.getContext("2d")!;
    const img = sc.createImageData(gw, gh);
    for (let i = 0; i < gw * gh; i++) {
      const v = R() * 255;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    sc.putImageData(img, 0, 0);
    o.globalAlpha = alpha;
    o.imageSmoothingEnabled = true;
    o.imageSmoothingQuality = "high";
    o.drawImage(small, 0, 0, gw * cell, gh * cell);
  }
  return out;
}
function grain(c: Ctx, x: number, y: number, w: number, h: number, strength: number, s0: number, scales: [number, number][]) {
  const n = noiseCanvas(Math.ceil(w), Math.ceil(h), scales, s0);
  c.save();
  c.globalCompositeOperation = "overlay";
  c.globalAlpha = strength;
  c.drawImage(n, x, y);
  c.restore();
}
/**
 * Every shadow is drawn solid into one layer, then blurred and laid on the
 * ground once, so overlaps never stack darker (as in town). Works at any
 * bake scale: the shadow offset and blur are in device pixels.
 */
function shadows(c: Ctx, draw: (s: Ctx) => void) {
  const cw = c.canvas.width,
    ch = c.canvas.height,
    k = cw / W;
  const layer = document.createElement("canvas");
  layer.width = cw;
  layer.height = ch;
  const s = layer.getContext("2d")!;
  s.scale(k, k);
  s.fillStyle = "#000";
  draw(s);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.shadowColor = `rgba(20,24,12,${SHADOW.alpha})`;
  c.shadowBlur = SHADOW.blur * k;
  c.shadowOffsetX = cw + 100;
  c.drawImage(layer, -(cw + 100), 0);
  c.restore();
}
/** A block's shadow: its footprint swept along the sun by its height. */
function blockShadow(s: Ctx, o: Rect) {
  const dx = SUNV.x * BLOCK_H,
    dy = SUNV.y * BLOCK_H;
  const foot: [number, number][] = [
    [o.x, o.y],
    [o.x + o.w, o.y],
    [o.x + o.w, o.y + o.h],
    [o.x, o.y + o.h],
  ];
  fillPoly(s, hull([...foot, ...foot.map(([x, y]) => [x + dx, y + dy] as [number, number])]));
}
/** The ground darkens right where something stands on it. */
function contact(c: Ctx, x: number, y: number, w: number, depth: number, a: number) {
  const g = c.createLinearGradient(0, y, 0, y + depth);
  g.addColorStop(0, `rgba(25,20,10,${a})`);
  g.addColorStop(1, "rgba(25,20,10,0)");
  c.fillStyle = g;
  c.fillRect(x - 6, y, w + 12, depth);
}
/** Warm light from a flame: brightness falls off roughly with distance squared. */
function lightPool(c: Ctx, x: number, y: number, r: number, a: number) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [t, f] of [
    [0, 1],
    [0.25, 0.42],
    [0.5, 0.16],
    [0.75, 0.05],
    [1, 0],
  ] as const)
    g.addColorStop(t, `rgba(255,190,110,${a * f})`);
  c.save();
  c.globalCompositeOperation = "screen";
  c.fillStyle = g;
  gEll(c, x, y, r);
  c.fill();
  c.restore();
}

// ─────────────────────────── Courts ───────────────────────────

/** The duel courts painted in this style (raid arenas keep their own floors). */
export const COURT_ARENAS = ["classic", "tide-pools", "ember-forge", "shifting-ruins"] as const;
export type CourtId = (typeof COURT_ARENAS)[number];
export const isCourt = (id: string): id is CourtId => (COURT_ARENAS as readonly string[]).includes(id);

/** Each court's materials. */
const STONE = {
  classic: { top: ["#f2eada", "#ddd2bb"], front: ["#b9ab8f", "#8b7e64"], vary: ["#c9bd9f", "#a5977b"], growth: ["#4f7a34", "#638f3f", "#7aa64c", "#3f6a2c"], seam: null as string | null },
  "tide-pools": { top: ["#e3e6e0", "#c4c9c3"], front: ["#a3aaa6", "#737c7a"], vary: ["#b5bcb7", "#8c9592"], growth: ["#2f7a6a", "#3f8f7c", "#5aa58c", "#256456"], seam: null },
  "ember-forge": { top: ["#7a726a", "#5a534c"], front: ["#4c4641", "#2e2a27"], vary: ["#585049", "#3a3531"], growth: [] as string[], seam: "#ff7a2a" },
  "shifting-ruins": { top: ["#e6dcc4", "#cbbf9f"], front: ["#a99a78", "#7d7058"], vary: ["#b8a984", "#968866"], growth: ["#4f7a34", "#638f3f", "#7aa64c", "#3f6a2c"], seam: null },
} satisfies Record<CourtId, unknown>;

/** Where each court's blocks stand (shifting ruins' centre block is drawn by itself, see SHIFTING_BLOCK). */
export function courtBlocks(id: CourtId): Rect[] {
  return id === "classic" || id === "ember-forge" ? OBSTACLES : OBSTACLES.slice(0, 4);
}
/** Shifting Ruins' centre block: rises out of its pit and sinks again. */
export const SHIFTING_BLOCK = OBSTACLES[4];

/** Light pools from the court's own flames, as [x, y, radius, strength, rgb] (see Light). */

function sandBase(c: Ctx, top: string, bottom: string, s0: number) {
  const sand = c.createLinearGradient(0, 0, 0, H);
  sand.addColorStop(0, top);
  sand.addColorStop(1, bottom);
  c.fillStyle = sand;
  c.fillRect(0, 0, W, H);
  grain(c, 0, 0, W, H, 0.55, s0, [
    [140, 1],
    [40, 0.6],
    [6, 0.35],
    [2, 0.3],
  ]);
}
function pebbles(c: Ctx, n: number, light: string, dark: string, s0: number) {
  seed = s0;
  for (let i = 0; i < n; i++) {
    const x = R() * W,
      y = 40 + R() * (H - 60),
      r = 1.2 + R() * 2.6;
    c.fillStyle = "rgba(40,30,18,0.35)";
    ell(c, x + SUNV.x * r * 1.6, y + SUNV.y * r * 1.6, r, r * K);
    c.fill();
    c.fillStyle = mix(light, dark, R());
    ell(c, x, y, r, r * 0.7);
    c.fill();
    c.fillStyle = "rgba(255,255,240,0.45)";
    ell(c, x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.25);
    c.fill();
  }
}
function footprints(c: Ctx, n: number, color: string, s0: number) {
  seed = s0;
  for (let i = 0; i < n; i++) {
    const x = 240 + R() * 1120,
      y = 120 + R() * 660,
      a = R() * 6.28;
    c.fillStyle = color;
    ell(c, x, y, 5, 2.6, a);
    c.fill();
    ell(c, x + Math.cos(a + 1.57) * 7, y + Math.sin(a + 1.57) * 7, 5, 2.6, a);
    c.fill();
  }
}
/**
 * Flagstones: big, roughly square slabs laid in staggered rows. Seen at the
 * camera's angle a square slab is drawn K times as tall as it is wide. Each
 * slab is lit from the upper left, with a hairline of grout between.
 * Returns the joints between slabs (for glowing seams).
 */
function flagstones(c: Ctx, tones: [string, string], grout: string, s0: number, missing = 0) {
  c.fillStyle = grout;
  c.fillRect(0, 0, W, H);
  seed = s0;
  const joints: [number, number, number, number][] = [];
  for (let y = -20; y < H + 20; ) {
    const side = 96 + R() * 34,
      rh = side * K;
    for (let x = -side * R(); x < W + 20; ) {
      const w = side * (0.75 + R() * 0.6);
      // Slabs aren't cut perfectly: corners wander a few pixels.
      const j = () => (R() - 0.5) * 4;
      const pts: [number, number][] = [
        [x + 2 + j(), y + 2 + j()],
        [x + w - 2 + j(), y + 2 + j()],
        [x + w - 2 + j(), y + rh - 2 + j()],
        [x + 2 + j(), y + rh - 2 + j()],
      ];
      if (missing && R() < missing) {
        c.fillStyle = "#6b5a40";
        fillPoly(c, pts);
        c.fillStyle = "rgba(70,110,40,0.7)";
        ell(c, x + w / 2, y + rh / 2, 12, 6);
        c.fill();
      } else {
        const base = mix(tones[0], tones[1], R());
        const g = c.createLinearGradient(x, y, x + w, y + rh);
        g.addColorStop(0, mix(base, "#fffaf0", 0.1));
        g.addColorStop(1, mix(base, "#000000", 0.1));
        c.fillStyle = g;
        fillPoly(c, pts);
        // Lit near edge, shaded far edge: slabs sit very slightly proud.
        c.strokeStyle = "rgba(255,250,236,0.2)";
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(pts[3][0], pts[3][1]);
        c.lineTo(pts[0][0], pts[0][1]);
        c.lineTo(pts[1][0], pts[1][1]);
        c.stroke();
        c.strokeStyle = "rgba(20,14,8,0.3)";
        c.beginPath();
        c.moveTo(pts[1][0], pts[1][1]);
        c.lineTo(pts[2][0], pts[2][1]);
        c.lineTo(pts[3][0], pts[3][1]);
        c.stroke();
        // Wear: a few pits and a hairline crack now and then.
        for (let k = 0; k < 3; k++) {
          c.fillStyle = "rgba(20,14,8,0.18)";
          ell(c, x + 8 + R() * (w - 16), y + 6 + R() * (rh - 12), 1.5 + R() * 2, 1 + R());
          c.fill();
        }
        if (R() < 0.18) {
          c.strokeStyle = "rgba(20,14,8,0.3)";
          c.lineWidth = 1;
          c.beginPath();
          const cx = x + w * (0.2 + R() * 0.6);
          c.moveTo(cx, y + 4);
          c.lineTo(cx + (R() - 0.5) * 20, y + rh * 0.5);
          c.lineTo(cx + (R() - 0.5) * 24, y + rh - 4);
          c.stroke();
        }
      }
      joints.push([x + w, y, x + w, y + rh]);
      x += w;
    }
    joints.push([0, y + rh, W, y + rh]);
    y += rh;
  }
  grain(c, 0, 0, W, H, 0.35, s0 + 1, [
    [140, 1],
    [30, 0.5],
    [3, 0.35],
  ]);
  return joints;
}
/** Spawn plates where the two sides start, in each court's material. */
function spawnPlates(c: Ctx, rim: string, face: string) {
  for (const [x, col] of SPAWNS) {
    c.fillStyle = rim;
    gEll(c, x, 456, 74);
    c.fill();
    c.fillStyle = face;
    gEll(c, x, 453, 70);
    c.fill();
    grain(c, x - 70, 453 - 70 * K, 140, 140 * K, 0.35, x, [
      [12, 1],
      [3, 0.5],
    ]);
    c.strokeStyle = col;
    c.globalAlpha = 0.7;
    c.lineWidth = 3;
    gEll(c, x, 453, 58);
    c.stroke();
    c.globalAlpha = 1;
  }
}
/** Low kerbs down the sides and along the front (ground level, so they never hide anyone). */
function kerbs(c: Ctx, side: string, top: string) {
  for (const [x, y, w, h] of [
    [0, 0, 16, H],
    [W - 16, 0, 16, H],
    [0, H - 16, W, 16],
  ] as const) {
    c.fillStyle = side;
    c.fillRect(x, y, w, h);
    c.fillStyle = top;
    c.fillRect(x, y, w, 4);
    grain(c, x, y, w, h, 0.4, x + y + 5, [
      [10, 1],
      [3, 0.5],
    ]);
  }
}
/** The back edge: a wall face (only its lower part is in view), coursed in stone. */
function backWall(c: Ctx, light: string, dark: string, s0: number) {
  const face = c.createLinearGradient(0, 0, 0, WALL_FOOT);
  face.addColorStop(0, light);
  face.addColorStop(1, dark);
  c.fillStyle = face;
  c.fillRect(0, 0, W, WALL_FOOT);
  seed = s0;
  for (let row = 0; row < 2; row++)
    for (let x = row * -20; x < W; ) {
      const w = 40 + R() * 30;
      c.fillStyle = mix(light, dark, R());
      c.fillRect(x + 1, row * 11 + 1, w - 2, 10);
      c.fillStyle = "rgba(255,248,230,0.22)";
      c.fillRect(x + 1, row * 11 + 1, w - 2, 2);
      x += w;
    }
  c.fillStyle = "rgba(20,14,8,0.45)";
  c.fillRect(0, WALL_FOOT - 3, W, 3);
}
function torch(c: Ctx, x: number) {
  c.fillStyle = "#2a2e36";
  c.fillRect(x - 6, 8, 12, 5);
  const f = c.createRadialGradient(x, 6, 0, x, 6, 10);
  f.addColorStop(0, "#fff2a8");
  f.addColorStop(0.5, "#ffa02a");
  f.addColorStop(1, "rgba(255,90,30,0)");
  c.fillStyle = f;
  ell(c, x, 5, 8, 9);
  c.fill();
}
function lights(c: Ctx, list: Light[]) {
  for (const [x, y, r, a, col] of list) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    for (const [t, f] of [
      [0, 1],
      [0.25, 0.42],
      [0.5, 0.16],
      [0.75, 0.05],
      [1, 0],
    ] as const)
      g.addColorStop(t, `rgba(${col},${a * f})`);
    c.save();
    c.globalCompositeOperation = "screen";
    c.fillStyle = g;
    gEll(c, x, y, r);
    c.fill();
    c.restore();
  }
}
/** Warm light from the upper left and a soft vignette. */
function grade(c: Ctx, warm: number, vignette: number) {
  const l = c.createLinearGradient(0, 0, W, H);
  l.addColorStop(0, `rgba(255,230,180,${warm})`);
  l.addColorStop(0.6, "rgba(255,230,180,0)");
  l.addColorStop(1, "rgba(30,40,70,0.12)");
  c.save();
  c.globalCompositeOperation = "soft-light";
  c.fillStyle = l;
  c.fillRect(0, 0, W, H);
  c.restore();
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, `rgba(10,8,4,${vignette})`);
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
}
/** Every shadow and contact shade for a court's blocks and back wall. */
function courtShadows(c: Ctx, blocks: Rect[], wallHeight: number, extra?: (s: Ctx) => void) {
  shadows(c, (s) => {
    for (const o of blocks) blockShadow(s, o);
    s.fillRect(0, 0, W, WALL_FOOT + SUNV.y * wallHeight + 2);
    extra?.(s);
  });
  for (const o of blocks) {
    c.save();
    c.translate(o.x + o.w / 2, o.y + o.h + 1);
    c.scale(1, 0.18);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, o.w * 0.62);
    g.addColorStop(0, "rgba(25,20,10,0.42)");
    g.addColorStop(0.7, "rgba(25,20,10,0.18)");
    g.addColorStop(1, "rgba(25,20,10,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, o.w * 0.62, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  contact(c, 0, WALL_FOOT, W, 30, 0.35);
}

// ── Coliseum Sands ──
function coliseum(c: Ctx) {
  sandBase(c, "#d4bc8c", "#cdb283", 3);
  c.lineWidth = 1.6;
  for (let k = 1; k < 13; k++) {
    c.strokeStyle = k % 2 ? "rgba(120,92,52,0.18)" : "rgba(255,244,214,0.16)";
    c.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.02) {
      const r = k * 64 + Math.sin(a * 7 + k) * 2;
      const x = 800 + Math.cos(a) * r,
        y = 450 + Math.sin(a) * r * K;
      if (a === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  for (const [x, y] of [
    [SPAWNS[0][0], 450],
    [SPAWNS[1][0], 450],
    [800, 450],
  ] as const) {
    const g = c.createRadialGradient(x, y, 0, x, y, 170);
    g.addColorStop(0, "rgba(150,118,72,0.3)");
    g.addColorStop(1, "rgba(150,118,72,0)");
    c.fillStyle = g;
    gEll(c, x, y, 170);
    c.fill();
  }
  footprints(c, 70, "rgba(110,84,48,0.26)", 55);
  pebbles(c, 260, "#bfae8a", "#8d7d62", 56);
  c.strokeStyle = "rgba(255,246,224,0.45)";
  c.lineWidth = 5;
  gEll(c, 800, 450, 150);
  c.stroke();
  c.strokeStyle = "rgba(255,246,224,0.3)";
  c.lineWidth = 2;
  gEll(c, 800, 450, 200);
  c.stroke();
  spawnPlates(c, "#8a7c60", "#cbbd9e");
  kerbs(c, "#a89a7c", "#ddd2bb");
  courtShadows(c, bareCourt ? [] : courtBlocks("classic"), 48);
  backWall(c, "#b6a585", "#8f7f62", 9);
  // Banner tails on the wall, torches, and the light they throw.
  for (const [x, col] of [
    [150, "#d9a52a"],
    [560, "#c9482e"],
    [1040, "#2f8fc9"],
    [1450, "#4f9a3e"],
  ] as const) {
    const g = c.createLinearGradient(x - 20, 0, x + 20, 0);
    g.addColorStop(0, mix(col, "#000000", 0.25));
    g.addColorStop(0.45, mix(col, "#ffffff", 0.15));
    g.addColorStop(1, mix(col, "#000000", 0.3));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - 20, 0);
    c.lineTo(x + 20, 0);
    c.lineTo(x + 20, WALL_FOOT - 4);
    c.lineTo(x, WALL_FOOT - 10);
    c.lineTo(x - 20, WALL_FOOT - 4);
    c.closePath();
    c.fill();
  }
  for (const x of [355, 800, 1245]) torch(c, x);
  lights(c, [355, 800, 1245].map((x) => [x, WALL_FOOT + 18, 170, 0.32, "255,190,110"] as Light));
  grade(c, 0.16, 0.3);
}

// ── Tide Pools: damp sand by the sea, a rock-rimmed pool in the middle ──
function tidePools(c: Ctx) {
  sandBase(c, "#c9b48a", "#bfa979", 13);
  // Sand ripples left by the tide: gentle wavy lines across the court.
  c.lineWidth = 1.5;
  seed = 14;
  for (let y = 60; y < H - 20; y += 22 + R() * 10) {
    c.strokeStyle = "rgba(110,90,58,0.2)";
    c.beginPath();
    const ph = R() * 6;
    for (let x = 0; x <= W; x += 8) {
      const yy = y + Math.sin(x / 38 + ph) * 3 + Math.sin(x / 97 + ph * 2) * 4;
      if (x === 0) c.moveTo(x, yy);
      else c.lineTo(x, yy);
    }
    c.stroke();
    c.strokeStyle = "rgba(255,246,220,0.14)";
    c.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const yy = y - 2 + Math.sin(x / 38 + ph) * 3 + Math.sin(x / 97 + ph * 2) * 4;
      if (x === 0) c.moveTo(x, yy);
      else c.lineTo(x, yy);
    }
    c.stroke();
  }
  // Damp sand: darker near the sea and around the pool.
  const wet = c.createLinearGradient(0, 0, 0, 220);
  wet.addColorStop(0, "rgba(80,66,44,0.42)");
  wet.addColorStop(1, "rgba(80,66,44,0)");
  c.fillStyle = wet;
  c.fillRect(0, 0, W, 220);
  const pool = ARENAS["tide-pools"].hazards[0];
  {
    const g = c.createRadialGradient(pool.x, pool.y, pool.radius, pool.x, pool.y, pool.radius + 120);
    g.addColorStop(0, "rgba(80,66,44,0.4)");
    g.addColorStop(1, "rgba(80,66,44,0)");
    c.fillStyle = g;
    gEll(c, pool.x, pool.y, pool.radius + 120);
    c.fill();
  }
  // Shells, seaweed and pebbles.
  seed = 15;
  for (let i = 0; i < 46; i++) {
    const x = 30 + R() * (W - 60),
      y = 60 + R() * (H - 90),
      s = 3 + R() * 3,
      a = (R() - 0.5) * 1.2;
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.fillStyle = ["#f2e2d2", "#e8c2b0", "#f6efe2", "#d9b8a4"][i % 4];
    c.beginPath();
    c.moveTo(0, s * 0.5);
    c.arc(0, s * 0.5, s, Math.PI * 1.1, Math.PI * 1.9);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(120,90,70,0.45)";
    c.lineWidth = 0.6;
    for (let k = -2; k <= 2; k++) {
      c.beginPath();
      c.moveTo(0, s * 0.5);
      c.lineTo(Math.sin(k * 0.35) * s, s * 0.5 - Math.cos(k * 0.35) * s);
      c.stroke();
    }
    c.restore();
  }
  for (let i = 0; i < 26; i++) {
    const x = 30 + R() * (W - 60),
      y = 70 + R() * (H - 100);
    c.strokeStyle = ["#2f5a3a", "#3f6a3a", "#4f5a2a"][i % 3];
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(x, y);
    c.bezierCurveTo(x + 8, y - 4, x + 12, y + 6, x + 20 + R() * 8, y + 2);
    c.stroke();
  }
  pebbles(c, 200, "#b8b0a2", "#6f6a62", 16);
  footprints(c, 40, "rgba(90,72,44,0.24)", 17);
  // The tide pool: a rim of boulders, then water deepening to the middle.
  const r = pool.radius;
  shadows(c, (s) => {
    seed = 18;
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2,
        rr = r + 14;
      const x = pool.x + Math.cos(a) * rr,
        y = pool.y + Math.sin(a) * rr * K;
      s.beginPath();
      s.ellipse(x + SUNV.x * 14, y + SUNV.y * 14, 16, 10, 0, 0, Math.PI * 2);
      s.fill();
    }
  });
  const water = c.createRadialGradient(pool.x - 20, pool.y - 14, 10, pool.x, pool.y, r + 4);
  water.addColorStop(0, "#155f78");
  water.addColorStop(0.65, "#1f86a0");
  water.addColorStop(1, "#59c2c8");
  c.fillStyle = water;
  gEll(c, pool.x, pool.y, r + 6);
  c.fill();
  // Sand and stones on the bottom, seen through the water.
  seed = 19;
  for (let k = 0; k < 40; k++) {
    const a = R() * 6.28,
      d = Math.sqrt(R()) * r * 0.9;
    c.fillStyle = `rgba(${R() > 0.5 ? "190,180,150" : "90,110,100"},0.22)`;
    ell(c, pool.x + Math.cos(a) * d, pool.y + Math.sin(a) * d * K, 3 + R() * 6, 2 + R() * 3);
    c.fill();
  }
  // Caustic light lines and a sky reflection.
  c.save();
  gEll(c, pool.x, pool.y, r + 4);
  c.clip();
  c.strokeStyle = "rgba(220,250,255,0.22)";
  c.lineWidth = 1.4;
  for (let k = 0; k < 14; k++) {
    const y = pool.y - r + k * 18;
    c.beginPath();
    for (let x = pool.x - r; x <= pool.x + r; x += 10) {
      const yy = y + Math.sin(x / 14 + k) * 4;
      if (x === pool.x - r) c.moveTo(x, yy);
      else c.lineTo(x, yy);
    }
    c.stroke();
  }
  const sky = c.createLinearGradient(pool.x - r, pool.y - r * K, pool.x + r, pool.y + r * K);
  sky.addColorStop(0, "rgba(255,255,255,0.28)");
  sky.addColorStop(0.35, "rgba(255,255,255,0)");
  c.fillStyle = sky;
  c.fillRect(pool.x - r, pool.y - r, r * 2, r * 2);
  c.restore();
  // Wet edge, then the boulders.
  c.strokeStyle = "rgba(240,252,255,0.55)";
  c.lineWidth = 2;
  gEll(c, pool.x, pool.y, r + 5);
  c.stroke();
  seed = 18;
  for (let k = 0; k < 26; k++) {
    const a = (k / 26) * Math.PI * 2,
      rr = r + 14;
    const x = pool.x + Math.cos(a) * rr,
      y = pool.y + Math.sin(a) * rr * K,
      bw = 13 + R() * 6,
      bh = 9 + R() * 4;
    const g = c.createRadialGradient(x - bw * 0.4, y - bh * 0.6, 1, x, y, bw * 1.2);
    g.addColorStop(0, "#c9ccc4");
    g.addColorStop(0.6, "#8d938c");
    g.addColorStop(1, "#5d635e");
    c.fillStyle = g;
    ell(c, x, y - bh * 0.3, bw, bh);
    c.fill();
    if (R() < 0.5) {
      c.fillStyle = "rgba(47,122,106,0.7)";
      ell(c, x - 3, y - bh * 0.7, bw * 0.5, bh * 0.3);
      c.fill();
    }
  }
  spawnPlates(c, "#7d7a70", "#c4c2b6");
  kerbs(c, "#9a968a", "#d4d2c6");
  courtShadows(c, courtBlocks("tide-pools"), 0);
  // The sea along the back edge: foam where it meets the sand.
  const sea = c.createLinearGradient(0, 0, 0, WALL_FOOT + 4);
  sea.addColorStop(0, "#1f6f8f");
  sea.addColorStop(1, "#4fb6c4");
  c.fillStyle = sea;
  c.fillRect(0, 0, W, WALL_FOOT + 2);
  c.strokeStyle = "rgba(255,255,255,0.75)";
  c.lineWidth = 3;
  c.beginPath();
  for (let x = 0; x <= W; x += 8) {
    const y = WALL_FOOT + 1 + Math.sin(x / 30) * 2 + Math.sin(x / 71) * 2;
    if (x === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.35)";
  c.lineWidth = 1.5;
  c.beginPath();
  for (let x = 0; x <= W; x += 8) {
    const y = 8 + Math.sin(x / 24 + 1) * 2;
    if (x === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.stroke();
  grade(c, 0.12, 0.26);
}

// ── Ember Forge: basalt flagstones, glowing cracks, vents in iron grates ──
function emberForge(c: Ctx) {
  const joints = flagstones(c, ["#4a4440", "#5e5650"], "#1d1714", 21);
  // Heat glows up through some of the joints between slabs.
  seed = 22;
  c.save();
  c.shadowColor = "rgba(255,110,30,0.95)";
  c.shadowBlur = 10;
  c.strokeStyle = "#ff8a3a";
  c.lineWidth = 2;
  for (const [x1, y1, x2, y2] of joints) {
    if (R() > 0.12) continue;
    // Only a stretch of the joint glows, not the whole line.
    const t0 = R() * 0.5,
      t1 = t0 + 0.2 + R() * 0.3;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len > 300) {
      const sx = R() * W,
        span = 60 + R() * 120;
      c.beginPath();
      c.moveTo(sx, y1);
      c.lineTo(sx + span, y1);
      c.stroke();
    } else {
      c.beginPath();
      c.moveTo(x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0);
      c.lineTo(x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1);
      c.stroke();
    }
  }
  c.restore();
  // Ash dusting and soot.
  pebbles(c, 160, "#6a625a", "#2a2420", 23);
  seed = 24;
  for (let i = 0; i < 300; i++) {
    c.fillStyle = `rgba(200,190,180,${0.05 + R() * 0.08})`;
    ell(c, R() * W, R() * H, 1 + R() * 2, 0.8);
    c.fill();
  }
  const vents = ARENAS["ember-forge"].hazards;
  // Scorch marks round each vent, then the vent: a stone collar, an iron grate, embers below.
  for (const h of vents) {
    const g = c.createRadialGradient(h.x, h.y, h.radius * 0.5, h.x, h.y, h.radius * 1.7);
    g.addColorStop(0, "rgba(10,6,4,0.55)");
    g.addColorStop(1, "rgba(10,6,4,0)");
    c.fillStyle = g;
    gEll(c, h.x, h.y, h.radius * 1.7);
    c.fill();
  }
  spawnPlates(c, "#2e2a27", "#5a534c");
  kerbs(c, "#3a3531", "#6a625a");
  courtShadows(c, courtBlocks("ember-forge"), 48);
  for (const h of vents) {
    const r = h.radius * 0.6;
    c.fillStyle = "#3a3531";
    gEll(c, h.x, h.y + 3, r + 14);
    c.fill();
    c.fillStyle = "#6a625a";
    gEll(c, h.x, h.y, r + 12);
    c.fill();
    const pit = c.createRadialGradient(h.x, h.y, 2, h.x, h.y, r);
    pit.addColorStop(0, "#ffd27a");
    pit.addColorStop(0.35, "#ff6a1e");
    pit.addColorStop(0.8, "#6a1a08");
    pit.addColorStop(1, "#1a0a06");
    c.fillStyle = pit;
    gEll(c, h.x, h.y, r);
    c.fill();
    c.save();
    gEll(c, h.x, h.y, r);
    c.clip();
    c.strokeStyle = "#1e1b19";
    c.lineWidth = 5;
    for (let k = -3; k <= 3; k++) {
      c.beginPath();
      c.moveTo(h.x + k * r * 0.28, h.y - r);
      c.lineTo(h.x + k * r * 0.28, h.y + r);
      c.stroke();
    }
    c.strokeStyle = "rgba(255,180,120,0.35)";
    c.lineWidth = 1;
    for (let k = -3; k <= 3; k++) {
      c.beginPath();
      c.moveTo(h.x + k * r * 0.28 - 2, h.y - r);
      c.lineTo(h.x + k * r * 0.28 - 2, h.y + r);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = "#2a2622";
    c.lineWidth = 3;
    gEll(c, h.x, h.y, r);
    c.stroke();
  }
  // The forge wall at the back, with furnace mouths glowing.
  backWall(c, "#4c4641", "#2a2622", 25);
  for (const x of [260, 800, 1340]) {
    const g = c.createLinearGradient(0, 0, 0, WALL_FOOT);
    g.addColorStop(0, "#ffd27a");
    g.addColorStop(1, "#ff5a1e");
    c.fillStyle = "#1a1210";
    c.beginPath();
    c.roundRect(x - 46, 0, 92, WALL_FOOT - 2, [0, 0, 6, 6]);
    c.fill();
    c.fillStyle = g;
    c.beginPath();
    c.roundRect(x - 38, 0, 76, WALL_FOOT - 6, [0, 0, 4, 4]);
    c.fill();
  }
  lights(c, [
    ...vents.map((h) => [h.x, h.y, 180, 0.4, "255,120,50"] as Light),
    ...[260, 800, 1340].map((x) => [x, WALL_FOOT + 30, 240, 0.4, "255,140,60"] as Light),
  ]);
  grade(c, 0.06, 0.42);
}

// ── Shifting Ruins: old mossy flagstones, a pit in the middle, a ruined wall ──
function shiftingRuins(c: Ctx) {
  flagstones(c, ["#b8a984", "#9d8f6e"], "#4f4430", 31, 0.06);
  // Grass and moss in the joints.
  seed = 32;
  for (let i = 0; i < 1400; i++) {
    const x = R() * W,
      y = R() * H;
    c.fillStyle = `rgba(${R() > 0.5 ? "80,120,50" : "100,140,60"},${0.25 + R() * 0.3})`;
    ell(c, x, y, 2 + R() * 3, 1 + R());
    c.fill();
  }
  for (let i = 0; i < 160; i++) {
    const x = R() * W,
      y = 30 + R() * (H - 40);
    c.strokeStyle = R() > 0.5 ? "#4f7a34" : "#6f9a48";
    c.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      c.moveTo(x + k * 2, y);
      c.lineTo(x + k * 2 + (R() - 0.5) * 4, y - 5 - R() * 5);
      c.stroke();
    }
  }
  footprints(c, 30, "rgba(70,56,30,0.25)", 33);
  // A carved ring round the centre, mostly worn away.
  c.strokeStyle = "rgba(60,48,30,0.35)";
  c.lineWidth = 3;
  c.setLineDash([22, 14]);
  gEll(c, 800, 450, 200);
  c.stroke();
  c.setLineDash([]);
  // The pit the centre block rises from: its far wall in shade, near lip lit.
  const p = SHIFTING_BLOCK,
    depth = 22;
  c.fillStyle = "#2a2318";
  c.fillRect(p.x - 6, p.y - 6, p.w + 12, p.h + 12);
  const wall = c.createLinearGradient(0, p.y - 6, 0, p.y - 6 + depth);
  wall.addColorStop(0, "#5a4c36");
  wall.addColorStop(1, "#2a2318");
  c.fillStyle = wall;
  c.fillRect(p.x - 6, p.y - 6, p.w + 12, depth);
  seed = 34;
  for (let k = 0; k < 9; k++) {
    c.fillStyle = mix("#8d7d62", "#5a4c36", R());
    ell(c, p.x + R() * p.w, p.y + depth + R() * (p.h - depth - 4), 4 + R() * 5, 3 + R() * 2);
    c.fill();
  }
  c.strokeStyle = "#cbbf9f";
  c.lineWidth = 3;
  c.strokeRect(p.x - 7.5, p.y - 7.5, p.w + 15, p.h + 15);
  spawnPlates(c, "#7d7058", "#c4b896");
  kerbs(c, "#9d8f6e", "#d4c8a8");
  courtShadows(c, courtBlocks("shifting-ruins"), 48);
  // The ruined wall at the back: broken coping, ivy hanging down.
  backWall(c, "#b8a984", "#8d7d62", 35);
  seed = 36;
  for (let x = 0; x < W; x += 60 + R() * 80) {
    c.fillStyle = "#4f4430";
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x + 18 + R() * 20, 0);
    c.lineTo(x + 10, 6 + R() * 6);
    c.closePath();
    c.fill();
  }
  for (let i = 0; i < 18; i++) {
    const x = R() * W;
    c.strokeStyle = "#3f6a2c";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, 0);
    c.bezierCurveTo(x + 6, 6, x - 4, 12, x + 2, WALL_FOOT + 4);
    c.stroke();
    for (let k = 0; k < 4; k++) {
      c.fillStyle = k % 2 ? "#6f9a48" : "#4f7a34";
      ell(c, x + (k % 2 ? 4 : -3), 3 + k * 5, 3.2, 2, k % 2 ? 0.6 : -0.6);
      c.fill();
    }
  }
  grade(c, 0.14, 0.3);
}

/** Set while baking the Coliseum floor with no block shadows (for rubble). */
let bareCourt = false;
/**
 * Paint a court's floor: everything but its blocks (see paintCourtBlock).
 * `bare` leaves out the blocks' shadows (Coliseum only), so a broken
 * pillar's patch of floor can be cut from it.
 */
export function paintCourtFloor(c: Ctx, id: CourtId, bare = false) {
  bareCourt = bare;
  if (id === "tide-pools") tidePools(c);
  else if (id === "ember-forge") emberForge(c);
  else if (id === "shifting-ruins") shiftingRuins(c);
  else coliseum(c);
  bareCourt = false;
}

/** Floor around a broken pillar that its rubble picture repaints (its shadow's blur). */
export const RUBBLE_PAD = 26;
/**
 * A pillar Grumblecrag has smashed: a low jagged stump and a heap of its
 * stones spilling forward, each with a short shadow along the sun. Drawn in
 * world coordinates.
 */
export function paintCourtRubble(c: Ctx, o: Rect, index: number) {
  const m = STONE.classic;
  seed = (index + 3) * 131 + 7;
  // Chunks: [x, y (ground), size, height], sorted back to front.
  const chunks: [number, number, number, number][] = [];
  for (let k = 0; k < 15; k++) {
    const a = R() * Math.PI * 2,
      d = Math.sqrt(R());
    chunks.push([
      o.x + o.w / 2 + Math.cos(a) * d * (o.w * 0.55),
      o.y + o.h * 0.62 + Math.sin(a) * d * (o.h * 0.42) + 10,
      6 + R() * 11,
      4 + R() * 9,
    ]);
  }
  chunks.sort((a, b) => a[1] - b[1]);
  // Shadows first, as one soft layer.
  c.save();
  c.filter = "blur(4px)";
  c.fillStyle = "rgba(25,20,10,0.32)";
  const stumpH = 18;
  c.fillRect(o.x + 6 + SUNV.x * stumpH, o.y + 14, o.w - 12, o.h * 0.62 + 4);
  for (const [x, y, sz, h] of chunks) {
    ell(c, x + SUNV.x * h, y + SUNV.y * h, sz * 1.05, sz * K * 0.9);
    c.fill();
  }
  c.restore();
  // The stump: the block's lowest course, snapped off unevenly.
  const sx = o.x + 6,
    sw = o.w - 12,
    sy = o.y + 10,
    sd = o.h * 0.62;
  const jag: [number, number][] = [];
  for (let k = 0; k <= 8; k++) jag.push([sx + (sw * k) / 8, sy - R() * 9]);
  // Front face: one course of dressed stone, shaded toward the ground.
  const fy = sy + sd;
  const fg = c.createLinearGradient(0, fy - 4, 0, fy + stumpH);
  fg.addColorStop(0, m.front[0]);
  fg.addColorStop(1, mix(m.front[1], "#3a3020", 0.25));
  c.fillStyle = fg;
  c.beginPath();
  c.moveTo(sx, fy + jag[0][1] - sy);
  for (const [x, y] of jag) c.lineTo(x, fy + (y - sy) * 0.5);
  c.lineTo(sx + sw, fy + stumpH);
  c.lineTo(sx, fy + stumpH);
  c.closePath();
  c.fill();
  c.fillStyle = "rgba(20,14,8,0.35)";
  for (const f of [0.33, 0.7]) c.fillRect(sx + sw * f, fy, 1.5, stumpH);
  // Its broken top: rough, darker than a dressed slab, cracked.
  c.fillStyle = mix(m.vary[1], m.front[0], 0.45);
  c.beginPath();
  c.moveTo(jag[0][0], jag[0][1]);
  for (const [x, y] of jag) c.lineTo(x, y);
  c.lineTo(sx + sw, fy + (jag[8][1] - sy) * 0.5);
  for (let k = jag.length - 1; k >= 0; k--) c.lineTo(jag[k][0], fy + (jag[k][1] - sy) * 0.5);
  c.closePath();
  c.fill();
  c.save();
  c.clip();
  grain(c, sx, sy - 10, sw, sd + 10, 0.22, index * 5 + 2, [
    [14, 1],
    [5, 0.5],
  ]);
  c.restore();
  c.strokeStyle = "rgba(50,38,24,0.5)";
  c.lineWidth = 1.2;
  for (let k = 0; k < 3; k++) {
    let x = sx + sw * (0.2 + R() * 0.6),
      y = sy + 4;
    c.beginPath();
    c.moveTo(x, y);
    while (y < fy - 6) {
      x += (R() - 0.5) * 12;
      y += 8 + R() * 8;
      c.lineTo(x, Math.min(y, fy - 4));
    }
    c.stroke();
  }
  // A lit lip along the back break.
  c.strokeStyle = "rgba(255,248,230,0.45)";
  c.lineWidth = 1.5;
  c.beginPath();
  jag.forEach(([x, y], k) => (k ? c.lineTo(x, y + 1) : c.moveTo(x, y + 1)));
  c.stroke();
  // The fallen stones.
  for (const [x, y, sz, h] of chunks) {
    const pts: [number, number][] = [];
    const n = 5 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + R() * 0.5,
        r = sz * (0.7 + R() * 0.35);
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * K - h]);
    }
    // Sides: the top outline dropped to the ground.
    c.fillStyle = mix(mix(m.front[0], m.front[1], R()), "#3a3020", 0.2);
    fillPoly(c, hull([...pts, ...pts.map(([px, py]) => [px, py + h] as [number, number])]));
    const tg = c.createLinearGradient(x - sz, y - h - sz, x + sz, y - h + sz);
    tg.addColorStop(0, m.top[0]);
    tg.addColorStop(1, m.vary[R() > 0.5 ? 0 : 1]);
    c.fillStyle = tg;
    fillPoly(c, pts);
    c.strokeStyle = "rgba(40,30,18,0.3)";
    c.lineWidth = 1;
    c.beginPath();
    pts.forEach(([px, py], k) => (k ? c.lineTo(px, py) : c.moveTo(px, py)));
    c.closePath();
    c.stroke();
  }
  // Dust settled around the heap.
  for (let k = 0; k < 40; k++) {
    c.fillStyle = `rgba(${R() > 0.5 ? "230,220,196" : "150,136,108"},${0.35 + R() * 0.3})`;
    ell(c, o.x + o.w / 2 + (R() - 0.5) * o.w * 1.5, o.y + o.h * 0.6 + (R() - 0.5) * o.h * 0.9, 1 + R() * 2, 0.8 + R() * 1.2);
    c.fill();
  }
}

/** How much room a block's picture has around its footprint (for chips and the gem's glow). */
export const BLOCK_PAD = 14;
/** A block's picture size (world px) and where its top-left sits. */
export function courtBlockFrame(o: Rect) {
  return {
    x: o.x - BLOCK_PAD,
    y: o.y - BLOCK_H - BLOCK_PAD,
    w: o.w + BLOCK_PAD * 2,
    h: o.h + BLOCK_H + BLOCK_PAD * 2,
  };
}
/**
 * One stone block, drawn so that the picture's top-left is courtBlockFrame(o).
 * Its top face is the footprint raised by BLOCK_H; its front face stands on
 * the footprint's front edge, which is what it sorts by.
 */
export function paintCourtBlock(c: Ctx, o: Rect, index: number, id: CourtId) {
  const m = STONE[id];
  c.save();
  c.translate(-(o.x - BLOCK_PAD), -(o.y - BLOCK_H - BLOCK_PAD));
  seed = (index + 1) * 97 + 13 + id.length;
  const top = o.y - BLOCK_H,
    front = o.y + o.h - BLOCK_H;
  // Front: courses of stone, each its own tone. Side-on to the sun, so it's
  // evenly lit, darkening toward the ground.
  const courses = 3,
    ch = BLOCK_H / courses;
  for (let r = 0; r < courses; r++) {
    let x = o.x;
    const y = front + r * ch;
    while (x < o.x + o.w - 1) {
      const sw = Math.min(o.x + o.w - x, 26 + R() * 30);
      c.fillStyle = mix(mix(m.front[0], m.front[1], 0.25), R() > 0.5 ? m.vary[0] : m.vary[1], 0.25);
      c.fillRect(x, y, sw, ch);
      c.fillStyle = "rgba(255,248,230,0.28)";
      c.fillRect(x + 1, y + 1, sw - 2, 2);
      c.fillStyle = "rgba(20,14,8,0.35)";
      c.fillRect(x, y + ch - 2, sw, 2);
      c.fillRect(x + sw - 1.5, y, 1.5, ch);
      x += sw;
    }
  }
  const ao = c.createLinearGradient(0, front, 0, front + BLOCK_H);
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(1, "rgba(20,14,8,0.34)");
  c.fillStyle = ao;
  c.fillRect(o.x, front, o.w, BLOCK_H);
  // Top slab: faces the sky, the brightest surface.
  const tg = c.createLinearGradient(o.x, top, o.x + o.w, top + o.h);
  tg.addColorStop(0, m.top[0]);
  tg.addColorStop(1, m.top[1]);
  c.fillStyle = tg;
  c.fillRect(o.x, top, o.w, o.h);
  grain(c, o.x, top, o.w, o.h, 0.35, index * 7 + 1, [
    [24, 1],
    [6, 0.6],
    [2, 0.4],
  ]);
  c.strokeStyle = "rgba(40,30,18,0.35)";
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(o.x, top + o.h * 0.48);
  c.lineTo(o.x + o.w, top + o.h * 0.5);
  c.stroke();
  c.fillStyle = "rgba(255,250,236,0.5)";
  c.fillRect(o.x, top, o.w, 3);
  c.fillRect(o.x, top, 3, o.h);
  c.fillStyle = "rgba(40,30,18,0.35)";
  c.fillRect(o.x + o.w - 3, top, 3, o.h);
  c.fillStyle = mix(m.top[0], "#ffffff", 0.2);
  c.fillRect(o.x, front - 2, o.w, 3);
  c.fillStyle = "rgba(20,14,8,0.35)";
  c.fillRect(o.x, front + 1, o.w, 2);
  // A chipped corner and a crack.
  c.fillStyle = m.vary[1];
  c.beginPath();
  c.moveTo(o.x + o.w, front - 1);
  c.lineTo(o.x + o.w - 9, front - 1);
  c.lineTo(o.x + o.w, front + 8);
  c.closePath();
  c.fill();
  const cx = o.x + o.w * (0.3 + R() * 0.3);
  const crack = () => {
    c.beginPath();
    c.moveTo(cx, top + 4);
    c.lineTo(cx + 6, top + o.h * 0.25);
    c.lineTo(cx + 1, top + o.h * 0.42);
    c.lineTo(cx + 9, top + o.h * 0.6);
    c.stroke();
  };
  if (m.seam) {
    // Basalt: the crack runs with magma, glowing.
    c.save();
    c.shadowColor = m.seam;
    c.shadowBlur = 8;
    c.strokeStyle = m.seam;
    c.lineWidth = 2;
    crack();
    c.beginPath();
    c.moveTo(o.x + 6, front + ch * 1.5);
    c.lineTo(o.x + o.w * 0.4, front + ch * 1.3);
    c.lineTo(o.x + o.w * 0.7, front + ch * 1.8);
    c.stroke();
    c.restore();
  } else {
    c.strokeStyle = "rgba(60,46,28,0.55)";
    c.lineWidth = 1.3;
    crack();
  }
  // Growth: moss (or algae by the sea), and a vine down the front.
  if (m.growth.length) {
    const tuft = (x: number, y: number, r: number) => {
      for (let k = 0; k < 6; k++) {
        c.fillStyle = m.growth[k % m.growth.length];
        ell(c, x + (R() - 0.5) * r * 1.6, y + (R() - 0.5) * r * 0.6, r * (0.35 + R() * 0.4), r * (0.25 + R() * 0.25));
        c.fill();
      }
    };
    tuft(o.x + 8 + R() * 14, top + 6 + R() * 10, 12);
    tuft(o.x + o.w * 0.6, top + o.h - 6, 8);
    for (let k = 0; k < 4; k++) tuft(o.x + R() * o.w, o.y + o.h - 4, 6 + R() * 4);
    c.strokeStyle = m.growth[0];
    c.lineWidth = 2;
    const vx = o.x + 10 + R() * 18;
    c.beginPath();
    c.moveTo(vx, front);
    c.bezierCurveTo(vx + 6, front + 14, vx - 4, front + 28, vx + 3, front + 40);
    c.stroke();
    for (let k = 0; k < 5; k++) {
      c.fillStyle = m.growth[2];
      ell(c, vx + (k % 2 ? 5 : -3), front + 6 + k * 8, 3.4, 2, k % 2 ? 0.6 : -0.6);
      c.fill();
    }
  }
  if (id === "tide-pools") {
    // Barnacles low on the front, and a darker band the water reaches.
    c.fillStyle = "rgba(30,40,40,0.25)";
    c.fillRect(o.x, front + BLOCK_H - 16, o.w, 16);
    for (let k = 0; k < 14; k++) {
      const x = o.x + 4 + R() * (o.w - 8),
        y = front + BLOCK_H - 4 - R() * 14;
      c.fillStyle = "#e2ddd0";
      ell(c, x, y, 2.4, 2);
      c.fill();
      c.fillStyle = "#6a6a62";
      ell(c, x, y - 0.3, 0.9, 0.7);
      c.fill();
    }
  }
  if (id === "shifting-ruins") {
    // An old carved rune on the front.
    const rx = o.x + o.w / 2,
      ry = front + BLOCK_H / 2;
    c.strokeStyle = "rgba(60,46,28,0.6)";
    c.lineWidth = 2;
    ell(c, rx, ry, 11, 11);
    c.stroke();
    c.beginPath();
    c.moveTo(rx, ry - 11);
    c.lineTo(rx, ry + 11);
    c.moveTo(rx - 8, ry - 4);
    c.lineTo(rx + 8, ry + 4);
    c.stroke();
  }
  // The coliseum's centre block carries its gold gem.
  if (id === "classic" && index === 4) {
    const gx = o.x + o.w / 2,
      gy = front + BLOCK_H / 2;
    c.fillStyle = "#2c2638";
    ell(c, gx, gy, 10, 10);
    c.fill();
    const g = c.createRadialGradient(gx - 3, gy - 3, 1, gx, gy, 8);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, "#ffcf4a");
    g.addColorStop(1, "#99781e");
    c.fillStyle = g;
    ell(c, gx, gy, 7.5, 7.5);
    c.fill();
  }
  c.restore();
}

// ─────────────────────────── Stands ───────────────────────────

/** How much of the world above the court (y < 0) the match view shows on a court. */
export const STANDS = 96;
/**
 * What lies beyond each court's back edge, painted into a W×STANDS picture
 * whose bottom row meets the court's top row (world y = 0). Nobody can walk
 * here, so it's free to be crowds, sea or walls.
 */
export function paintCourtStands(c: Ctx, id: CourtId) {
  const S = STANDS;
  if (id === "classic") {
    // Tiers of seats rising away, a crowd on them, the parapet's coping at the front.
    const back = c.createLinearGradient(0, 0, 0, S);
    back.addColorStop(0, "#4e4434");
    back.addColorStop(1, "#8f7f62");
    c.fillStyle = back;
    c.fillRect(0, 0, W, S);
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const y = 2 + r * 20;
      c.fillStyle = mix("#5e5240", "#8c7c5f", r / rows);
      c.fillRect(0, y, W, 20);
      c.fillStyle = mix("#7d6d52", "#b8a684", r / rows);
      c.fillRect(0, y + 14, W, 6);
      seed = 400 + r * 31;
      for (let x = 6 + (r % 2) * 9; x < W; x += 15 + R() * 6) {
        if (R() < 0.08) continue;
        const shirt = ["#c94f4f", "#3f7fc9", "#e0b43a", "#7b5cc9", "#4f9a5a", "#d9824a", "#e8e2d4", "#2f3a52"][Math.floor(R() * 8)];
        const skin = ["#f2d2a2", "#d9a878", "#a8703f", "#7a4f2e", "#f6e0c0"][Math.floor(R() * 5)];
        const bob = R() < 0.25 ? -3 : 0;
        c.fillStyle = mix(shirt, "#000000", 0.15);
        c.beginPath();
        c.roundRect(x - 5, y + 4 + bob, 10, 11, [4, 4, 1, 1]);
        c.fill();
        c.fillStyle = shirt;
        c.fillRect(x - 5, y + 4 + bob, 5, 10);
        c.fillStyle = skin;
        ell(c, x, y + 1 + bob, 3.6, 3.8);
        c.fill();
        c.fillStyle = "rgba(0,0,0,0.25)";
        ell(c, x + 1.4, y + 1.6 + bob, 1.8, 3);
        c.fill();
        if (bob) {
          c.strokeStyle = skin;
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(x + 4, y + 5 + bob);
          c.lineTo(x + 7, y - 4 + bob);
          c.stroke();
        }
      }
    }
    grain(c, 0, 0, W, S - 12, 0.25, 77, [
      [40, 1],
      [8, 0.5],
    ]);
    // The parapet's coping, and the banners' poles and heads above it.
    c.fillStyle = "#8f7f60";
    c.fillRect(0, S - 12, W, 12);
    c.fillStyle = "#e6dac0";
    c.fillRect(0, S - 12, W, 6);
    for (const [x, col] of [
      [150, "#d9a52a"],
      [560, "#c9482e"],
      [1040, "#2f8fc9"],
      [1450, "#4f9a3e"],
    ] as const) {
      c.fillStyle = "#3a2e22";
      c.fillRect(x - 2, S - 46, 4, 46);
      c.fillStyle = "#e9c25a";
      ell(c, x, S - 47, 4, 4);
      c.fill();
      const g = c.createLinearGradient(x - 20, 0, x + 20, 0);
      g.addColorStop(0, mix(col, "#000000", 0.25));
      g.addColorStop(0.45, mix(col, "#ffffff", 0.15));
      g.addColorStop(1, mix(col, "#000000", 0.3));
      c.fillStyle = g;
      c.fillRect(x - 20, S - 38, 40, 38);
      c.fillStyle = "rgba(255,240,200,0.8)";
      c.beginPath();
      c.moveTo(x, S - 30);
      c.lineTo(x + 7, S - 19);
      c.lineTo(x, S - 8);
      c.lineTo(x - 7, S - 19);
      c.closePath();
      c.fill();
      c.fillStyle = "#2a2014";
      c.fillRect(x - 22, S - 40, 44, 4);
    }
  } else if (id === "tide-pools") {
    // Open sea: deeper further out, whitecaps, a couple of rocks.
    const sea = c.createLinearGradient(0, 0, 0, S);
    sea.addColorStop(0, "#0f4a66");
    sea.addColorStop(1, "#1f6f8f");
    c.fillStyle = sea;
    c.fillRect(0, 0, W, S);
    seed = 61;
    for (let k = 0; k < 9; k++) {
      const y = 6 + k * 10 + R() * 4;
      c.strokeStyle = `rgba(255,255,255,${0.12 + (k / 9) * 0.2})`;
      c.lineWidth = 1.5;
      c.beginPath();
      const ph = R() * 6;
      for (let x = 0; x <= W; x += 8) {
        const yy = y + Math.sin(x / (30 + k * 3) + ph) * 2;
        if (x === 0) c.moveTo(x, yy);
        else c.lineTo(x, yy);
      }
      c.stroke();
    }
    for (const [x, y, s] of [
      [240, 40, 1],
      [1180, 26, 1.4],
      [1420, 60, 0.8],
    ] as const) {
      c.fillStyle = "#3d4a4c";
      ell(c, x, y, 26 * s, 12 * s);
      c.fill();
      c.fillStyle = "#6a7a7a";
      ell(c, x - 6 * s, y - 4 * s, 16 * s, 7 * s);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.55)";
      c.lineWidth = 2;
      ell(c, x, y + 6 * s, 32 * s, 8 * s);
      c.stroke();
    }
  } else if (id === "ember-forge") {
    // The forge wall rising into smoke: dark courses, chains, the furnaces' arches.
    const wall = c.createLinearGradient(0, 0, 0, S);
    wall.addColorStop(0, "#16110e");
    wall.addColorStop(1, "#3a3531");
    c.fillStyle = wall;
    c.fillRect(0, 0, W, S);
    seed = 71;
    for (let row = 0; row < 8; row++)
      for (let x = (row % 2) * -24; x < W; ) {
        const w = 44 + R() * 30;
        c.fillStyle = mix("#2e2a27", "#4c4641", R() * (row / 8));
        c.fillRect(x + 1, row * 12 + 1, w - 2, 11);
        x += w;
      }
    for (const x of [260, 800, 1340]) {
      const g = c.createLinearGradient(0, S - 60, 0, S);
      g.addColorStop(0, "#ff9a3a");
      g.addColorStop(1, "#ffd27a");
      c.fillStyle = "#1a1210";
      c.beginPath();
      c.roundRect(x - 46, S - 64, 92, 64, [46, 46, 0, 0]);
      c.fill();
      c.fillStyle = g;
      c.beginPath();
      c.roundRect(x - 38, S - 56, 76, 56, [38, 38, 0, 0]);
      c.fill();
      const glow = c.createRadialGradient(x, S - 20, 10, x, S - 20, 140);
      glow.addColorStop(0, "rgba(255,140,60,0.35)");
      glow.addColorStop(1, "rgba(255,140,60,0)");
      c.fillStyle = glow;
      c.fillRect(x - 140, 0, 280, S);
    }
    for (const x of [100, 530, 1070, 1500]) {
      c.strokeStyle = "#5a524c";
      c.lineWidth = 3;
      c.setLineDash([6, 4]);
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, S - 20);
      c.stroke();
      c.setLineDash([]);
    }
  } else {
    // Beyond the ruined wall: the wall's broken top, and woodland behind.
    c.fillStyle = "#4f7a34";
    c.fillRect(0, 0, W, S);
    grain(c, 0, 0, W, S, 0.5, 81, [
      [30, 1],
      [6, 0.5],
    ]);
    seed = 82;
    for (let i = 0; i < 40; i++) {
      const x = R() * W,
        y = 10 + R() * 40,
        r = 20 + R() * 26;
      const g = c.createRadialGradient(x - r * 0.3, y - r * 0.4, 2, x, y, r);
      g.addColorStop(0, ["#7aa64c", "#6f9a48", "#8bbf5a"][i % 3]);
      g.addColorStop(1, ["#2f5a24", "#3f6a2c", "#36602a"][i % 3]);
      c.fillStyle = g;
      ell(c, x, y, r, r * 0.8);
      c.fill();
    }
    // The wall's upper courses and its broken coping.
    const face = c.createLinearGradient(0, S - 34, 0, S);
    face.addColorStop(0, "#c4b896");
    face.addColorStop(1, "#b8a984");
    c.fillStyle = face;
    c.beginPath();
    c.moveTo(0, S);
    for (let x = 0; x <= W; x += 40) c.lineTo(x, S - 26 - Math.abs(Math.sin(x * 0.013) * 14) - (x % 120 === 0 ? 8 : 0));
    c.lineTo(W, S);
    c.closePath();
    c.fill();
    for (let row = 0; row < 3; row++)
      for (let x = (row % 2) * -20; x < W; x += 50) {
        c.strokeStyle = "rgba(60,46,28,0.3)";
        c.lineWidth = 1;
        c.strokeRect(x, S - 11 * (row + 1), 50, 11);
      }
    for (let i = 0; i < 18; i++) {
      const x = R() * W;
      c.fillStyle = "#3f6a2c";
      ell(c, x, S - 30 + R() * 8, 14, 6);
      c.fill();
    }
  }
  // Settle it into the same light as the court.
  const v = c.createLinearGradient(0, 0, 0, S);
  v.addColorStop(0, "rgba(10,8,4,0.35)");
  v.addColorStop(1, "rgba(10,8,4,0)");
  c.fillStyle = v;
  c.fillRect(0, 0, W, S);
}

/**
 * The same camera, sun and painting tools for other floors (the raid arenas
 * in raid-floors.ts), so every arena shares one look.
 */
export const paintKit = {
  K,
  SUNV,
  ell,
  gEll,
  mix,
  hull,
  fillPoly,
  grain,
  shadows,
  contact,
  lights,
  grade,
  flagstones,
  pebbles,
  /** Restart the shared random sequence (paintings are repeatable). */
  reseed(n: number) {
    seed = n;
  },
  rand: R,
};
export type Light = [number, number, number, number, string];
