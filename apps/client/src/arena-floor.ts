import { ARENAS, RULES, type ArenaDef, type ArenaId } from "@arena/shared";
/** The subset of Phaser.GameObjects.Graphics the floor painter uses. */
export interface FloorPainter {
  fillStyle(color: number, alpha?: number): FloorPainter;
  lineStyle(width: number, color: number, alpha?: number): FloorPainter;
  fillRect(x: number, y: number, w: number, h: number): FloorPainter;
  fillRoundedRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r?: number,
  ): FloorPainter;
  strokeRoundedRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r?: number,
  ): FloorPainter;
  fillCircle(x: number, y: number, r: number): FloorPainter;
  strokeCircle(x: number, y: number, r: number): FloorPainter;
  fillEllipse(x: number, y: number, w: number, h: number, smoothness?: number): FloorPainter;
  fillTriangle(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): FloorPainter;
  lineBetween(x0: number, y0: number, x1: number, y1: number): FloorPainter;
  fillPoints(points: { x: number; y: number }[], close?: boolean): FloorPainter;
  strokePoints(
    points: { x: number; y: number }[],
    close?: boolean,
  ): FloorPainter;
}
/** Wrap a painter so everything is drawn `k` times larger (for a high-res bake). */
export function scaledPainter(g: FloorPainter, k: number): FloorPainter {
  if (k === 1) return g;
  const s = (n: number) => n * k;
  const wrapped: FloorPainter = {
    fillStyle: (c, a) => (g.fillStyle(c, a), wrapped),
    lineStyle: (w, c, a) => (g.lineStyle(s(w), c, a), wrapped),
    fillRect: (x, y, w, h) => (g.fillRect(s(x), s(y), s(w), s(h)), wrapped),
    fillRoundedRect: (x, y, w, h, r) => (
      g.fillRoundedRect(s(x), s(y), s(w), s(h), r === undefined ? r : s(r)),
      wrapped
    ),
    strokeRoundedRect: (x, y, w, h, r) => (
      g.strokeRoundedRect(s(x), s(y), s(w), s(h), r === undefined ? r : s(r)),
      wrapped
    ),
    fillCircle: (x, y, r) => (g.fillCircle(s(x), s(y), s(r)), wrapped),
    strokeCircle: (x, y, r) => (g.strokeCircle(s(x), s(y), s(r)), wrapped),
    fillEllipse: (x, y, w, h, smoothness) => (
      g.fillEllipse(s(x), s(y), s(w), s(h), smoothness),
      wrapped
    ),
    fillTriangle: (a, b, c, d, e, f) => (
      g.fillTriangle(s(a), s(b), s(c), s(d), s(e), s(f)),
      wrapped
    ),
    lineBetween: (a, b, c, d) => (
      g.lineBetween(s(a), s(b), s(c), s(d)),
      wrapped
    ),
    fillPoints: (points, close) => (
      g.fillPoints(
        points.map((p) => ({ x: s(p.x), y: s(p.y) })),
        close,
      ),
      wrapped
    ),
    strokePoints: (points, close) => (
      g.strokePoints(
        points.map((p) => ({ x: s(p.x), y: s(p.y) })),
        close,
      ),
      wrapped
    ),
  };
  return wrapped;
}
const COLS = 19,
  ROWS = 10;
const BORDER = 36;
/**
 * Paints the cosmetic stone-tile court with grass edges. Deterministic, drawn once
 * and baked into a texture; collision geometry stays in the shared OBSTACLES list.
 */
/** Each arena's colours: surround, blades, grout, tile tones, moss, pillar. */
export const FLOOR_PALETTES: Record<
  ArenaId,
  {
    surround: number;
    blades: number[];
    grout: number;
    tones: number[];
    speck: number;
    moss: number;
    pillar: [number, number, number];
    lines: number;
  }
> = {
  classic: {
    surround: 0x2f6a35,
    blades: [0x3f8a43, 0x27582c, 0x4d9a4c],
    grout: 0x30372f,
    tones: [0x7b8279, 0x858c81, 0x737a72, 0x80877c],
    speck: 0x6c756e,
    moss: 0x4f8a46,
    pillar: [0x5d665f, 0x737d75, 0xa7b0a6],
    lines: 0xf3f6ef,
  },
  "tide-pools": {
    surround: 0xc9b27a,
    blades: [0x3e8f86, 0x2c6f6a, 0x58a99c],
    grout: 0x34474a,
    tones: [0x6f8a8f, 0x7a979b, 0x67818a, 0x86a3a3],
    speck: 0x5c7378,
    moss: 0x3e8f86,
    pillar: [0x5a6f73, 0x6f878a, 0xa9c3c0],
    lines: 0xeaf7f5,
  },
  "ember-forge": {
    surround: 0x2a1d1a,
    blades: [0xff7a3d, 0x7a3320, 0xffb347],
    grout: 0x1d1716,
    tones: [0x5a4a44, 0x635149, 0x51423d, 0x6b5a50],
    speck: 0x3c302c,
    moss: 0x8a3b22,
    pillar: [0x4a3c37, 0x5e4c45, 0x8c7466],
    lines: 0xffd9b8,
  },
  lagoon: {
    surround: 0xc9b27a,
    blades: [0x3e8f86, 0x2c6f6a, 0x58a99c],
    grout: 0x1b5b6e,
    tones: [0x2b8aa0, 0x2f93a8, 0x2884a0, 0x3399ad],
    speck: 0x7fe9ff,
    moss: 0x3e8f86,
    pillar: [0xb89b62, 0xd2b679, 0xf1dcae],
    lines: 0xd9f5f0,
  },
  "lantern-yard": {
    surround: 0x1d2440,
    blades: [0x2f4a4a, 0x22383a, 0x3d5c56],
    grout: 0x161a30,
    tones: [0x3a3f63, 0x404669, 0x363b5c, 0x454b70],
    speck: 0x2a2f4d,
    moss: 0x355a4e,
    pillar: [0x3a3550, 0x4d4668, 0xb7a6d6],
    lines: 0xd8d2f5,
  },
  "shifting-ruins": {
    surround: 0x55663a,
    blades: [0x7d9248, 0x45562c, 0x93a85a],
    grout: 0x4a4031,
    tones: [0x9c8a6a, 0xa69474, 0x92805f, 0xab9a78],
    speck: 0x7d6e52,
    moss: 0x6f8a3e,
    pillar: [0x7f6f55, 0x968566, 0xc9b892],
    lines: 0xfbf3df,
  },
};
export function paintArenaFloor(g: FloorPainter, arena: ArenaDef = ARENAS.classic) {
  if (arena.id === "lagoon") return paintLagoon(g);
  if (arena.id === "lantern-yard") return paintLanternYard(g);
  const pal = FLOOR_PALETTES[arena.id];
  const { width: W, height: H } = RULES;
  let seed = 42;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Grass surround.
  g.fillStyle(pal.surround).fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    const x = random() * W,
      y = random() * H;
    if (x > BORDER && x < W - BORDER && y > BORDER && y < H - BORDER) continue;
    g.fillStyle(pal.blades[i % 3], 0.8);
    const h = 5 + random() * 7;
    g.fillTriangle(x - 2, y, x + 2, y, x + (random() - 0.5) * 4, y - h);
  }
  // Stone tiles with grout, bevels and per-tile tone variation.
  g.fillStyle(pal.grout).fillRect(
    BORDER,
    BORDER,
    W - BORDER * 2,
    H - BORDER * 2,
  );
  // Whole tiles only: the court divides evenly into COLS x ROWS.
  const tileW = (W - BORDER * 2) / COLS,
    tileH = (H - BORDER * 2) / ROWS;
  const tones = pal.tones;
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++) {
      const x = BORDER + col * tileW,
        y = BORDER + row * tileH,
        w = tileW - 3,
        h = tileH - 3;
      g.fillStyle(tones[Math.floor(random() * tones.length)]).fillRoundedRect(
        x + 1.5,
        y + 1.5,
        w,
        h,
        6,
      );
      g.fillStyle(0xffffff, 0.09).fillRoundedRect(x + 3, y + 3, w - 4, 7, 4);
      g.fillStyle(0x1e2622, 0.16).fillRoundedRect(
        x + 3,
        y + h - 5,
        w - 4,
        6,
        3,
      );
      for (let k = 0; k < 4; k++)
        g.fillStyle(pal.speck, 0.35).fillCircle(
          x + 8 + random() * (w - 16),
          y + 8 + random() * (h - 16),
          1 + random() * 2,
        );
      if (random() < 0.12) {
        const cx = x + 15 + random() * (w - 30),
          cy = y + 15 + random() * (h - 30);
        g.lineStyle(1.5, 0x5a625c, 0.6)
          .lineBetween(cx, cy, cx + 10, cy + 6)
          .lineBetween(cx + 10, cy + 6, cx + 14, cy + 15);
      }
    }
  // Moss creeping in from the edges.
  for (let i = 0; i < 70; i++) {
    const side = i % 4,
      t = random();
    const x =
      side === 0
        ? BORDER + random() * 30
        : side === 1
          ? W - BORDER - random() * 30
          : t * W;
    const y =
      side === 2
        ? BORDER + random() * 26
        : side === 3
          ? H - BORDER - random() * 26
          : t * H;
    g.fillStyle(pal.moss, 0.35).fillEllipse(
      x,
      y,
      14 + random() * 22,
      8 + random() * 10,
    );
  }
  // Court markings.
  g.lineStyle(4, pal.lines, 0.5).strokeRoundedRect(46, 46, W - 92, H - 92, 14);
  g.lineStyle(4, pal.lines, 0.45).lineBetween(W / 2, 50, W / 2, H - 50);
  g.fillStyle(0xffffff, 0.06).fillCircle(W / 2, H / 2, 235);
  g.lineStyle(3, pal.lines, 0.45).strokeCircle(W / 2, H / 2, 165);
  g.lineStyle(2, pal.lines, 0.25).strokeCircle(W / 2, H / 2, 230);
  for (const x of [260, 1340]) {
    g.fillStyle(x === 260 ? 0xffd65b : 0x63dce8, 0.12).fillCircle(x, 450, 70);
    g.lineStyle(3, x === 260 ? 0xffd65b : 0x63dce8, 0.6).strokeCircle(
      x,
      450,
      70,
    );
  }
  // Hazard bases: the tide pool's water and the forge's vent grates.
  for (const h of arena.hazards) {
    if (h.kind === "pool") {
      g.fillStyle(0x0f4b63, 0.9).fillCircle(h.x, h.y, h.radius + 6);
      g.fillStyle(0x1d7c99, 0.95).fillCircle(h.x, h.y, h.radius - 4);
      g.fillStyle(0x4fd6e6, 0.3).fillCircle(h.x - 18, h.y - 16, h.radius * 0.55);
      for (const k of [0.35, 0.6, 0.85])
        g.lineStyle(2, 0xd9f5f0, 0.22).strokeCircle(h.x, h.y, h.radius * k);
      g.lineStyle(5, 0xe8dcae, 0.9).strokeCircle(h.x, h.y, h.radius + 6);
    } else {
      const r = h.radius * 0.6;
      g.lineStyle(2, 0xff7a3d, 0.28).strokeCircle(h.x, h.y, h.radius);
      g.fillStyle(0x140d0b).fillCircle(h.x, h.y, r);
      g.fillStyle(0x5a1d0e, 0.9).fillCircle(h.x, h.y, r * 0.7);
      g.lineStyle(4, 0x2a1d1a, 1);
      for (let k = -2; k <= 2; k++)
        g.lineBetween(h.x + k * r * 0.32, h.y - r * 0.85, h.x + k * r * 0.32, h.y + r * 0.85);
      g.lineStyle(4, 0x8c5a3c, 0.95).strokeCircle(h.x, h.y, r);
    }
  }
  // Shifting Ruins: the sunken footprint the centre block rises from.
  if (arena.shifting) {
    const r = arena.shifting.rect;
    g.fillStyle(0x3b3326, 0.6).fillRoundedRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 14);
    g.lineStyle(2, 0x2c2519, 0.8).strokeRoundedRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 14);
  }
  // Stone pillars (cosmetic look of the shared obstacles).
  for (const o of arena.obstacles) {
    g.fillStyle(0x10170f, 0.35).fillEllipse(
      o.x + o.w / 2 + 10,
      o.y + o.h + 6,
      o.w + 40,
      34,
    );
    g.fillStyle(pal.pillar[0]).fillRoundedRect(o.x, o.y, o.w, o.h, 12);
    g.fillStyle(pal.pillar[1]).fillRoundedRect(
      o.x + 5,
      o.y + 5,
      o.w - 10,
      o.h - 22,
      9,
    );
    g.fillStyle(pal.pillar[2]).fillRoundedRect(o.x + 6, o.y + 4, o.w - 12, 22, 8);
    g.fillStyle(pal.moss, 0.85).fillEllipse(
      o.x + o.w * 0.3,
      o.y + 9,
      o.w * 0.45,
      12,
    );
    g.lineStyle(2, 0x4a524c, 0.8)
      .lineBetween(o.x + 18, o.y + 40, o.x + 30, o.y + 62)
      .lineBetween(o.x + 30, o.y + 62, o.x + 24, o.y + 80);
    for (let k = 0; k < 6; k++) {
      const gx = o.x + 4 + random() * (o.w - 8);
      g.fillStyle(pal.blades[0]).fillTriangle(
        gx - 3,
        o.y + o.h + 2,
        gx + 3,
        o.y + o.h + 2,
        gx,
        o.y + o.h - 8,
      );
    }
  }
  // Soft vignette keeps fighters readable in the centre.
  for (let i = 0; i < 6; i++)
    g.lineStyle(14, 0x0b1209, 0.05 + i * 0.015).strokeRoundedRect(
      i * 7,
      i * 7,
      W - i * 14,
      H - i * 14,
      20,
    );
}

/**
 * Tidewyrm's Lagoon Court: a sandy rim around shallow, sunlit water. The
 * islands rise and sink during a raid, so they are drawn live (raid-ui.ts),
 * not baked into the floor.
 */
function paintLagoon(g: FloorPainter) {
  const { width: W, height: H } = RULES;
  let seed = 7;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Sand rim with pebbles and a few shells.
  g.fillStyle(0xd9c48a).fillRect(0, 0, W, H);
  for (let i = 0; i < 500; i++) {
    const x = random() * W,
      y = random() * H;
    g.fillStyle(i % 3 ? 0xc4ad73 : 0xead8a5, 0.8).fillCircle(x, y, 1 + random() * 2.5);
  }
  // The water: deep at the edges, bright in the middle.
  g.fillStyle(0x0f5f78).fillRoundedRect(BORDER, BORDER, W - BORDER * 2, H - BORDER * 2, 40);
  g.fillStyle(0x16788f).fillRoundedRect(BORDER + 18, BORDER + 18, W - BORDER * 2 - 36, H - BORDER * 2 - 36, 34);
  g.fillStyle(0x1f8fa6, 0.9).fillEllipse(W / 2, H / 2, W - 260, H - 200, 128);
  g.fillStyle(0x2aa3b8, 0.6).fillEllipse(W / 2, H / 2, W - 520, H - 380, 128);
  // Sunlit caustics and sandy patches on the bottom.
  for (let i = 0; i < 46; i++) {
    const x = BORDER + 40 + random() * (W - BORDER * 2 - 80),
      y = BORDER + 40 + random() * (H - BORDER * 2 - 80);
    g.fillStyle(0xd9c48a, 0.12).fillEllipse(x, y, 40 + random() * 70, 18 + random() * 30);
  }
  for (let i = 0; i < 140; i++) {
    const x = BORDER + 20 + random() * (W - BORDER * 2 - 40),
      y = BORDER + 20 + random() * (H - BORDER * 2 - 40),
      w = 12 + random() * 26;
    g.lineStyle(2, 0xbff6ff, 0.12 + random() * 0.1).lineBetween(x, y, x + w, y + (random() - 0.5) * 8);
  }
  // A ring where the whirlpool forms.
  g.lineStyle(3, 0xd9f5f0, 0.18).strokeCircle(W / 2, H / 2, 150);
  g.lineStyle(2, 0xd9f5f0, 0.1).strokeCircle(W / 2, H / 2, 230);
  // Foam where water meets sand.
  g.lineStyle(6, 0xf2fbfa, 0.55).strokeRoundedRect(BORDER, BORDER, W - BORDER * 2, H - BORDER * 2, 40);
  g.lineStyle(3, 0xffffff, 0.35).strokeRoundedRect(BORDER + 9, BORDER + 9, W - BORDER * 2 - 18, H - BORDER * 2 - 18, 34);
  for (let i = 0; i < 6; i++)
    g.lineStyle(14, 0x062a35, 0.04 + i * 0.012).strokeRoundedRect(i * 7, i * 7, W - i * 14, H - i * 14, 20);
}

/**
 * Gloomshade's Lantern Yard: a moonlit flagstone courtyard ringed by hedges.
 * The flagstones line up with Grasping Hands' 8 × 5 tiles so the checkerboard
 * reads at a glance. Lanterns go out and come back, so they are drawn live
 * (raid-gloomshade-art.ts), not baked into the floor.
 */
function paintLanternYard(g: FloorPainter) {
  const { width: W, height: H } = RULES;
  let seed = 13;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Night hedges all round, with a few pale flowers.
  g.fillStyle(0x1b2b33).fillRect(0, 0, W, H);
  for (let i = 0; i < 700; i++) {
    const x = random() * W,
      y = random() * H;
    if (x > BORDER && x < W - BORDER && y > BORDER && y < H - BORDER) continue;
    g.fillStyle(i % 3 ? 0x24403f : 0x2f5250, 0.85).fillCircle(x, y, 4 + random() * 7);
    if (i % 23 === 0) g.fillStyle(0xd8d2f5, 0.7).fillCircle(x, y, 2);
  }
  // Flagstones: one per Grasping Hands tile, split into a few slabs each.
  const cols = 8,
    rows = 5,
    tw = W / cols,
    th = H / rows;
  const tones = [0x3a3f63, 0x404669, 0x363b5c, 0x454b70];
  g.fillStyle(0x161a30).fillRect(BORDER, BORDER, W - BORDER * 2, H - BORDER * 2);
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const x0 = Math.max(BORDER, c * tw),
        y0 = Math.max(BORDER, r * th),
        x1 = Math.min(W - BORDER, (c + 1) * tw),
        y1 = Math.min(H - BORDER, (r + 1) * th);
      // Every other tile a shade lighter, faintly: the board Hands uses.
      g.fillStyle(tones[(c * 3 + r) % 4], (c + r) % 2 ? 0.92 : 1).fillRoundedRect(x0 + 4, y0 + 4, x1 - x0 - 8, y1 - y0 - 8, 8);
      // Slab joints inside the tile.
      const split = 0.35 + random() * 0.3;
      g.lineStyle(2, 0x1f2440, 0.7).lineBetween(x0 + 8, y0 + (y1 - y0) * split, x1 - 8, y0 + (y1 - y0) * split);
      g.lineBetween(x0 + (x1 - x0) * (0.3 + random() * 0.4), y0 + 8, x0 + (x1 - x0) * (0.3 + random() * 0.4), y0 + (y1 - y0) * split);
      // Moss in the cracks and a little starlight on the stone.
      for (let k = 0; k < 4; k++)
        g.fillStyle(0x355a4e, 0.45).fillCircle(x0 + 8 + random() * (x1 - x0 - 16), y0 + 8 + random() * (y1 - y0 - 16), 1.5 + random() * 2.5);
      g.fillStyle(0xd8d2f5, 0.06).fillEllipse(x0 + (x1 - x0) * 0.35, y0 + (y1 - y0) * 0.3, (x1 - x0) * 0.5, (y1 - y0) * 0.25);
    }
  // A worn moon-circle in the middle, where Gloomshade likes to rest.
  g.lineStyle(4, 0xb7a6d6, 0.16).strokeCircle(W / 2, 430, 120);
  g.lineStyle(2, 0xb7a6d6, 0.1).strokeCircle(W / 2, 430, 150);
  g.fillStyle(0xd8d2f5, 0.08).fillCircle(W / 2 - 18, 412, 46);
  g.fillStyle(0x161a30, 0.12).fillCircle(W / 2, 404, 40);
  // Low stone kerb, then the night closing in at the edges.
  g.lineStyle(6, 0x4d4668, 0.9).strokeRoundedRect(BORDER, BORDER, W - BORDER * 2, H - BORDER * 2, 18);
  g.lineStyle(2, 0xb7a6d6, 0.35).strokeRoundedRect(BORDER + 5, BORDER + 5, W - BORDER * 2 - 10, H - BORDER * 2 - 10, 14);
  for (let i = 0; i < 6; i++)
    g.lineStyle(14, 0x070914, 0.05 + i * 0.012).strokeRoundedRect(i * 7, i * 7, W - i * 14, H - i * 14, 20);
}
