/**
 * The Spire's court, painted (the pure part: no scene objects). Wave and
 * elite floors are fought on a stone platform at the top of the tower, with
 * open sky beyond its edge, the floor number carved in a rune ring in the
 * middle, the floor's cover (its layout: packages/shared/src/spire-court.ts)
 * and the stairs up at the left edge, which light when the floor is cleared.
 *
 * One base takes a zone's look (SpireZoneTheme: stone, crystals, runes and
 * sky); zone 1 is Earth (warm sandstone, amber crystals). Height is a
 * parameter of the floor: the higher the floor in its zone, the darker and
 * higher the sky (the clouds sink below the tower and more stars come out).
 *
 * Everything is painted once into canvases (spire-court-rig.ts adds them as
 * textures): the floor (once per zone, like any court), the sky (once per
 * floor, small), and an atlas per floor of its blocks, their shadows, the
 * stairs (lit and unlit) and the carved number. Pieces follow the duel
 * courts' camera and sun (arena-courts.ts), and every block's stone fills
 * its solid footprint exactly (stoneBase, BLOCK_H).
 */
import { RULES, type Rect } from "@arena/shared";
import {
  SPIRE_RING,
  SPIRE_STAIRS,
  spireCourtLayout,
  type SpireCourtLayoutId,
} from "../../../packages/shared/src/spire-court";
import type { SpireFloorKind } from "../../../packages/shared/src/spire";
import { BLOCK_H, paintKit, stoneBase } from "./arena-courts";

type Ctx = CanvasRenderingContext2D;
const W = RULES.width,
  H = RULES.height;
const { K, SUNV, ell, gEll, mix, grain, flagstones, lights, grade, reseed } =
  paintKit;
const R = () => paintKit.rand();

// ───────────────────────────── Themes ─────────────────────────────

/** A zone's look on the shared Spire court. Later zones add one each. */
export interface SpireZoneTheme {
  zone: number;
  /** Floor slabs, their joints, the platform's coping and carved lines. */
  slab: [string, string];
  grout: string;
  rim: [string, string];
  carve: string;
  /** Block stone: top face and front courses. */
  top: [string, string];
  front: [string, string];
  /** The zone's crystals (light, mid, dark) and their glow (fx colour). */
  crystal: [string, string, string];
  glow: number;
  /** The rune inlay (the ring, the stairs' runes when lit). */
  rune: string;
  /** Sky: [top, horizon] on the zone's first floor and at its top. */
  skyLow: [string, string];
  skyHigh: [string, string];
  /** Clouds low and high, and the light on the platform (warm or cool). */
  cloud: [string, string];
  light: string;
}
export const SPIRE_ZONE_THEMES: Record<number, SpireZoneTheme> = {
  // Zone 1, Earth: warm sandstone and amber crystal, a golden afternoon
  // that turns to a violet night near the top.
  1: {
    zone: 1,
    slab: ["#d9a566", "#a6743f"],
    grout: "#4a301c",
    rim: ["#e8cfa4", "#a98458"],
    carve: "#4a3420",
    top: ["#efdcb8", "#cfb28a"],
    front: ["#a88760", "#7a5d3e"],
    crystal: ["#fff1b8", "#ffb52e", "#b86a10"],
    glow: 0xffc24a,
    rune: "#ffcf5c",
    skyLow: ["#5d9bd6", "#f6dcaa"],
    skyHigh: ["#090820", "#4c3470"],
    cloud: ["#fff6e6", "#7d6aa0"],
    light: "255,214,150",
  },
};
export const spireTheme = (zone: number) =>
  SPIRE_ZONE_THEMES[zone] ?? SPIRE_ZONE_THEMES[1];
/**
 * The light on the platform's floor by height (a tint on its picture, so
 * it costs nothing): full afternoon light low down, a cool dusk near the
 * top. The floor's pieces get the same dusk painted into their stone only
 * (duskStone), so crystals and the carved number keep their own light.
 */
export function spireFloorTint(floor: number) {
  const h = spireHeight(floor);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * h);
  return (lerp(255, 206) << 16) | (lerp(255, 194) << 8) | lerp(255, 230);
}
/** 0 on a zone's first floor, 1 at its top (the boss floor). */
export const spireHeight = (floor: number) =>
  Math.min(1, Math.max(0, ((Math.max(1, floor) - 1) % 10) / 9));

// ───────────────────────────── Floor ─────────────────────────────

/** How wide the platform's coping band is along each edge (walkable). */
export const SPIRE_RIM = 26;
/** The chamfered inner border that gives the platform its octagon. */
const OCT = { inset: 64, chamfer: 170 };
function octagon(c: Ctx, inset: number, chamfer: number) {
  const a = inset,
    b = chamfer;
  c.beginPath();
  c.moveTo(a + b, a);
  c.lineTo(W - a - b, a);
  c.lineTo(W - a, a + b * K);
  c.lineTo(W - a, H - a - b * K);
  c.lineTo(W - a - b, H - a);
  c.lineTo(a + b, H - a);
  c.lineTo(a, H - a - b * K);
  c.lineTo(a, a + b * K);
  c.closePath();
}
/**
 * Paving in rings round the rune ring (ground ellipses), each ring cut into
 * stones of about the same length, staggered from ring to ring.
 */
function ringPaving(c: Ctx, t: SpireZoneTheme) {
  const { x, y, r } = SPIRE_RING;
  c.fillStyle = t.grout;
  c.fillRect(0, 0, W, H);
  reseed(7401);
  const at = (a: number, rr: number): [number, number] => [
    x + Math.cos(a) * rr,
    y + Math.sin(a) * rr * K,
  ];
  for (let r0 = r + 20, ring = 0; r0 < 980; ring++) {
    const depth = 58 + ring * 4,
      r1 = r0 + depth;
    const n = Math.max(12, Math.round((Math.PI * 2 * (r0 + depth / 2)) / 120));
    const shift = R();
    for (let i = 0; i < n; i++) {
      const a0 = ((i + shift) / n) * Math.PI * 2,
        a1 = ((i + 1 + shift) / n) * Math.PI * 2;
      const g0 = 2.2 / r0,
        g1 = 2.2 / r1;
      const pts = [
        at(a0 + g0, r0 + 2),
        at((a0 + a1) / 2, r0 + 2),
        at(a1 - g0, r0 + 2),
        at(a1 - g1, r1 - 2),
        at((a0 + a1) / 2, r1 - 2),
        at(a0 + g1, r1 - 2),
      ];
      const base = mix(t.slab[0], t.slab[1], R() * 0.85);
      const [cx, cy] = at((a0 + a1) / 2, r0 + depth / 2);
      const g = c.createLinearGradient(cx - 50, cy - 30, cx + 50, cy + 30);
      g.addColorStop(0, mix(base, "#fff6e4", 0.12));
      g.addColorStop(1, mix(base, "#000000", 0.12));
      c.fillStyle = g;
      c.beginPath();
      pts.forEach(([px, py], k) => (k ? c.lineTo(px, py) : c.moveTo(px, py)));
      c.closePath();
      c.fill();
      // The edge nearer the middle catches the light; the outer one shades.
      c.strokeStyle = "rgba(255,246,226,0.22)";
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(...pts[0]);
      c.lineTo(...pts[1]);
      c.lineTo(...pts[2]);
      c.stroke();
      c.strokeStyle = "rgba(30,18,6,0.3)";
      c.beginPath();
      c.moveTo(...pts[3]);
      c.lineTo(...pts[4]);
      c.lineTo(...pts[5]);
      c.stroke();
      // Wear: a few pits, now and then a crack (an amber seam, on Earth).
      for (let k = 0; k < 2; k++) {
        const [px, py] = at(
          a0 + (a1 - a0) * R(),
          r0 + depth * (0.2 + R() * 0.6),
        );
        c.fillStyle = "rgba(30,18,6,0.2)";
        ell(c, px, py, 1.5 + R() * 2, 1 + R());
        c.fill();
      }
      if (R() < 0.06) {
        const [p0x, p0y] = at(a0 + (a1 - a0) * 0.3, r0 + 4),
          [p1x, p1y] = at(a0 + (a1 - a0) * 0.6, r0 + depth * 0.5),
          [p2x, p2y] = at(a0 + (a1 - a0) * 0.45, r1 - 4);
        c.save();
        c.shadowColor = t.crystal[1];
        c.shadowBlur = 6;
        c.strokeStyle = rgba(t.crystal[1], 0.75);
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(p0x, p0y);
        c.lineTo(p1x, p1y);
        c.lineTo(p2x, p2y);
        c.stroke();
        c.restore();
      }
    }
    r0 = r1;
  }
  grain(c, 0, 0, W, H, 0.3, 7402, [
    [140, 1],
    [30, 0.5],
    [3, 0.35],
  ]);
}
/** A small cluster of crystal points lying in the floor (decoration only). */
function shards(c: Ctx, t: SpireZoneTheme, x: number, y: number, s: number) {
  for (let k = 0; k < 4; k++) {
    const a = -Math.PI / 2 + (k - 1.5) * 0.45 + (R() - 0.5) * 0.2,
      len = s * (0.6 + R() * 0.6),
      w = s * 0.22;
    const tx = x + Math.cos(a) * len,
      ty = y + Math.sin(a) * len * 0.8;
    const nx = Math.cos(a + Math.PI / 2) * w,
      ny = Math.sin(a + Math.PI / 2) * w;
    c.fillStyle = t.crystal[2];
    c.beginPath();
    c.moveTo(x - nx, y - ny);
    c.lineTo(tx, ty);
    c.lineTo(x + nx, y + ny);
    c.closePath();
    c.fill();
    c.fillStyle = t.crystal[1];
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(tx, ty);
    c.lineTo(x + nx, y + ny);
    c.closePath();
    c.fill();
    c.strokeStyle = t.crystal[0];
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(tx, ty);
    c.stroke();
  }
}
/** A rune glyph (a few carved strokes) centred on (x, y). */
function rune(c: Ctx, x: number, y: number, s: number, kind: number) {
  c.beginPath();
  const v = kind % 6;
  c.moveTo(x, y - s);
  c.lineTo(x, y + s);
  if (v === 0) {
    c.moveTo(x, y - s * 0.4);
    c.lineTo(x + s * 0.6, y - s);
  } else if (v === 1) {
    c.moveTo(x - s * 0.6, y - s * 0.2);
    c.lineTo(x + s * 0.6, y + s * 0.4);
  } else if (v === 2) {
    c.moveTo(x, y);
    c.lineTo(x + s * 0.6, y - s * 0.5);
    c.moveTo(x, y);
    c.lineTo(x - s * 0.6, y - s * 0.5);
  } else if (v === 3) {
    c.moveTo(x - s * 0.5, y - s);
    c.lineTo(x + s * 0.5, y + s);
  } else if (v === 4) {
    c.moveTo(x, y - s * 0.3);
    c.lineTo(x + s * 0.5, y);
    c.lineTo(x, y + s * 0.3);
  } else {
    c.moveTo(x - s * 0.5, y + s * 0.6);
    c.lineTo(x + s * 0.5, y + s * 0.6);
  }
  c.stroke();
}
/** The rune ring in the middle: a carved groove of runes with a gold inlay. */
function runeRing(c: Ctx, t: SpireZoneTheme) {
  const { x, y, r } = SPIRE_RING;
  // The plate inside the ring: one smooth, slightly paler stone.
  const plate = c.createRadialGradient(x - 40, y - 30, 10, x, y, r);
  plate.addColorStop(0, mix(t.slab[0], "#ffffff", 0.18));
  plate.addColorStop(1, mix(t.slab[1], "#000000", 0.06));
  c.fillStyle = plate;
  gEll(c, x, y, r - 14);
  c.fill();
  grain(c, x - r, y - r * K, r * 2, r * 2 * K, 0.25, 913, [
    [40, 1],
    [6, 0.5],
  ]);
  // Spokes from the ring to the octagon's corners, as inlaid lines.
  c.save();
  c.strokeStyle = mix(t.carve, t.slab[1], 0.35);
  c.globalAlpha = 0.45;
  c.lineWidth = 3;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    c.beginPath();
    c.moveTo(x + Math.cos(a) * (r + 18), y + Math.sin(a) * (r + 18) * K);
    c.lineTo(x + Math.cos(a) * 760, y + Math.sin(a) * 760 * K);
    c.stroke();
  }
  c.restore();
  // The groove: dark inner shade, lit outer lip.
  for (const [rr, width, col] of [
    [r + 6, 30, t.carve],
    [r + 6, 22, mix(t.carve, t.slab[1], 0.3)],
  ] as const) {
    c.strokeStyle = col;
    c.lineWidth = width;
    gEll(c, x, y, rr);
    c.stroke();
  }
  c.strokeStyle = "rgba(255,246,222,0.55)";
  c.lineWidth = 2;
  gEll(c, x, y, r + 22);
  c.stroke();
  c.strokeStyle = "rgba(40,24,10,0.5)";
  gEll(c, x, y, r - 10);
  c.stroke();
  // Runes in the groove, inlaid with the zone's metal.
  c.save();
  c.lineCap = "round";
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const rx = x + Math.cos(a) * (r + 6),
      ry = y + Math.sin(a) * (r + 6) * K;
    c.strokeStyle = "rgba(20,10,0,0.6)";
    c.lineWidth = 3.2;
    rune(c, rx + 0.8, ry + 0.8, 7 * (0.75 + 0.25 * Math.abs(Math.cos(a))), k);
    c.strokeStyle = t.rune;
    c.lineWidth = 2;
    rune(c, rx, ry, 7 * (0.75 + 0.25 * Math.abs(Math.cos(a))), k);
  }
  c.restore();
  // An inner ring around the number.
  c.strokeStyle = mix(t.carve, t.slab[1], 0.25);
  c.lineWidth = 4;
  gEll(c, x, y, r * 0.58);
  c.stroke();
  c.strokeStyle = "rgba(255,246,222,0.4)";
  c.lineWidth = 1.5;
  gEll(c, x, y, r * 0.58 + 3);
  c.stroke();
  // A faint glow from the inlay.
  lights(c, [[x, y, r * 1.25, 0.22, t.light]]);
}
/** The platform's coping: big dressed stones round the edge, a lip you can stand on. */
function coping(c: Ctx, t: SpireZoneTheme) {
  const B = SPIRE_RIM;
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, t.rim[0]);
  g.addColorStop(1, t.rim[1]);
  c.fillStyle = g;
  c.fillRect(0, 0, W, B);
  c.fillRect(0, H - B, W, B);
  c.fillRect(0, 0, B, H);
  c.fillRect(W - B, 0, B, H);
  reseed(4417);
  c.strokeStyle = "rgba(40,24,10,0.45)";
  c.lineWidth = 2;
  for (let x = 0; x < W;) {
    const step = 70 + R() * 50;
    x += step;
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, B);
    c.moveTo(x + (R() - 0.5) * 30, H - B);
    c.lineTo(x + (R() - 0.5) * 30, H);
    c.stroke();
  }
  for (let y = 0; y < H;) {
    y += 60 + R() * 50;
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(B, y);
    c.moveTo(W - B, y + 20);
    c.lineTo(W, y + 20);
    c.stroke();
  }
  // Lit top edge of each stone, shaded inner edge where it meets the floor.
  c.fillStyle = "rgba(255,248,230,0.45)";
  c.fillRect(0, 0, W, 2);
  c.fillRect(0, H - B, W, 2);
  c.fillStyle = "rgba(30,18,6,0.4)";
  c.fillRect(B, B, W - 2 * B, 3);
  c.fillRect(B, B, 3, H - 2 * B);
  c.fillRect(W - B - 3, B, 3, H - 2 * B);
  c.fillStyle = "rgba(30,18,6,0.5)";
  c.fillRect(0, H - 3, W, 3);
  grain(c, 0, 0, W, B, 0.3, 4418, [
    [30, 1],
    [4, 0.5],
  ]);
}
/**
 * The zone's floor, 1600 × 900 world px (the context is already scaled to
 * the bake density): slabs, the octagon border, the rune ring, the coping
 * and crystal shards in the corners. The number and everything that
 * changes per floor are separate pieces.
 */
export function paintSpireFloor(c: Ctx, t: SpireZoneTheme) {
  flagstones(c, t.slab, t.grout, 7300 + t.zone);
  // Inside the octagon the paving runs in rings round the middle.
  c.save();
  octagon(c, OCT.inset, OCT.chamfer);
  c.clip();
  ringPaving(c, t);
  const inner = c.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 820);
  inner.addColorStop(0, "rgba(255,244,220,0.16)");
  inner.addColorStop(1, "rgba(255,244,220,0)");
  c.fillStyle = inner;
  c.fillRect(0, 0, W, H);
  c.restore();
  // Outside it, the slabs are older and darker.
  c.save();
  c.beginPath();
  c.rect(0, 0, W, H);
  octagon(c, OCT.inset, OCT.chamfer);
  c.clip("evenodd");
  c.fillStyle = "rgba(60,36,14,0.16)";
  c.fillRect(0, 0, W, H);
  c.restore();
  // The octagon: a band of kerb stones with a carved line.
  c.lineJoin = "round";
  c.strokeStyle = mix(t.rim[1], t.carve, 0.35);
  c.lineWidth = 16;
  octagon(c, OCT.inset, OCT.chamfer);
  c.stroke();
  c.strokeStyle = mix(t.rim[0], t.rim[1], 0.4);
  c.lineWidth = 10;
  octagon(c, OCT.inset, OCT.chamfer);
  c.stroke();
  c.strokeStyle = "rgba(255,248,230,0.4)";
  c.lineWidth = 1.5;
  octagon(c, OCT.inset - 5, OCT.chamfer);
  c.stroke();
  c.strokeStyle = "rgba(40,24,10,0.45)";
  octagon(c, OCT.inset + 5, OCT.chamfer);
  c.stroke();
  // Crystal studs at the octagon's corners.
  const a = OCT.inset,
    b = OCT.chamfer;
  reseed(7313);
  for (const [x, y] of [
    [a + b, a],
    [W - a - b, a],
    [W - a, a + b * K],
    [W - a, H - a - b * K],
    [W - a - b, H - a],
    [a + b, H - a],
    [a, H - a - b * K],
    [a, a + b * K],
  ]) {
    c.fillStyle = t.carve;
    gEll(c, x, y, 11);
    c.fill();
    const g = c.createRadialGradient(x - 2, y - 2, 1, x, y, 8);
    g.addColorStop(0, t.crystal[0]);
    g.addColorStop(0.5, t.crystal[1]);
    g.addColorStop(1, t.crystal[2]);
    c.fillStyle = g;
    gEll(c, x, y, 8);
    c.fill();
  }
  runeRing(c, t);
  // Dust and grit, a few fallen crystal shards near the edges.
  paintKit.pebbles(
    c,
    260,
    "rgba(255,240,210,0.35)",
    "rgba(60,36,14,0.3)",
    7321,
  );
  reseed(7333);
  for (let k = 0; k < 14; k++) {
    const edge = k % 4;
    const x =
      edge === 0
        ? 60 + R() * (W - 120)
        : edge === 1
          ? 60 + R() * (W - 120)
          : edge === 2
            ? 40 + R() * 40
            : W - 80 + R() * 40;
    const y =
      edge === 0
        ? 40 + R() * 30
        : edge === 1
          ? H - 70 + R() * 30
          : 80 + R() * (H - 160);
    shards(c, t, x, y, 9 + R() * 6);
  }
  coping(c, t);
  // Corner crystals growing out of the coping.
  reseed(7349);
  for (const [x, y] of [
    [20, 34],
    [W - 20, 34],
    [24, H - 14],
    [W - 24, H - 14],
  ])
    for (let k = 0; k < 3; k++)
      shards(c, t, x + (R() - 0.5) * 22, y + (R() - 0.5) * 8, 16 + R() * 8);
  // Sun from the upper left, warm, and a gentle vignette.
  lights(c, [
    [380, 200, 620, 0.2, t.light],
    [1250, 680, 420, 0.08, t.light],
  ]);
  grade(c, 0.3, 0.42);
}

// ───────────────────────────── Sky ─────────────────────────────

/** The world rectangle the sky covers (the court sits in the middle). */
export const SPIRE_SKY = { x: -520, y: -340, w: 2640, h: 1580 };
/** Sky pixels per world px: soft, so small (it never follows the device scale). */
export const SPIRE_SKY_K = 0.42;
/** The tower's face under the court's front edge, as it drops into the clouds. */
const TOWER_FACE = 240;
/**
 * The sky around the court, in SPIRE_SKY's world coordinates (the context
 * is scaled by SPIRE_SKY_K and translated so world (SPIRE_SKY.x, .y) is its
 * corner): the gradient for this height, stars, the cloud sea at the
 * height's level and the tower's face dropping into it below the court.
 */
export function paintSpireSky(c: Ctx, t: SpireZoneTheme, floor: number) {
  const h = spireHeight(floor);
  const S = SPIRE_SKY;
  const top = mix(t.skyLow[0], t.skyHigh[0], h),
    horizon = mix(t.skyLow[1], t.skyHigh[1], h);
  // The cloud sea's top: level with the court low down, far below it near the top.
  const cloudTop = 260 + h * 1000;
  const g = c.createLinearGradient(0, S.y, 0, cloudTop + 120);
  g.addColorStop(0, top);
  g.addColorStop(0.65, mix(top, horizon, 0.55));
  g.addColorStop(1, horizon);
  c.fillStyle = g;
  c.fillRect(S.x, S.y, S.w, S.h);
  // Stars: none in daylight, a field of them at the top.
  reseed(9100 + floor);
  const stars = Math.round(220 * h * h);
  for (let k = 0; k < stars; k++) {
    const x = S.x + R() * S.w,
      y = S.y + R() * (cloudTop - S.y);
    const a = (0.35 + R() * 0.65) * Math.min(1, h * 1.4);
    c.fillStyle = `rgba(255,248,232,${a})`;
    c.beginPath();
    c.arc(x, y, 1.6 + R() * 2.2, 0, Math.PI * 2);
    c.fill();
  }
  // A pale moon once it is dark enough.
  if (h > 0.45) {
    const a = (h - 0.45) / 0.55;
    const mx = 1900,
      my = -200;
    const glow = c.createRadialGradient(mx, my, 10, mx, my, 240);
    glow.addColorStop(0, `rgba(240,232,255,${0.35 * a})`);
    glow.addColorStop(1, "rgba(240,232,255,0)");
    c.fillStyle = glow;
    c.fillRect(mx - 240, my - 240, 480, 480);
    c.fillStyle = `rgba(250,246,255,${0.9 * a})`;
    c.beginPath();
    c.arc(mx, my, 46, 0, Math.PI * 2);
    c.fill();
  } else {
    // A low warm sun haze instead.
    const a = 1 - h / 0.45;
    const sx = -300,
      sy = 120;
    const glow = c.createRadialGradient(sx, sy, 10, sx, sy, 700);
    glow.addColorStop(0, `rgba(255,236,190,${0.55 * a})`);
    glow.addColorStop(1, "rgba(255,236,190,0)");
    c.fillStyle = glow;
    c.fillRect(sx - 700, sy - 700, 1400, 1400);
  }
  const cloudCol = mix(t.cloud[0], t.cloud[1], h);
  const puff = (x: number, y: number, r: number, a: number) => {
    const p = c.createRadialGradient(x, y - r * 0.2, r * 0.1, x, y, r);
    p.addColorStop(0, `${rgba(cloudCol, a)}`);
    p.addColorStop(0.6, `${rgba(cloudCol, a * 0.7)}`);
    p.addColorStop(1, `${rgba(cloudCol, 0)}`);
    c.fillStyle = p;
    c.beginPath();
    c.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
    c.fill();
  };
  // High wisps (only while the clouds are still close).
  reseed(9200 + floor);
  if (h < 0.6)
    for (let k = 0; k < 10; k++)
      puff(
        S.x + R() * S.w,
        cloudTop - 260 - R() * 300,
        120 + R() * 140,
        0.22 * (1 - h),
      );
  // The far cloud sea behind the tower.
  for (let row = 0; row < 5; row++)
    for (let k = 0; k < 16; k++)
      puff(
        S.x + (k + R() * 0.8) * (S.w / 15),
        cloudTop + row * 90 + R() * 40,
        170 + R() * 110,
        0.55 + row * 0.08,
      );
  // The tower's face under the court: dressed stone courses, darker going
  // down, sinking into the clouds.
  const faceTop = H - 2,
    face = TOWER_FACE;
  const fg = c.createLinearGradient(0, faceTop, 0, faceTop + face);
  fg.addColorStop(0, mix(t.front[0], "#000000", 0.05));
  fg.addColorStop(1, mix(t.front[1], "#000000", 0.55));
  c.fillStyle = fg;
  c.beginPath();
  c.moveTo(-6, faceTop);
  c.lineTo(W + 6, faceTop);
  c.lineTo(W - 70, faceTop + face);
  c.lineTo(70, faceTop + face);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(30,18,6,0.4)";
  c.lineWidth = 3;
  reseed(9300);
  for (let y = faceTop + 34; y < faceTop + face; y += 34) {
    const inset = ((y - faceTop) / face) * 70;
    c.beginPath();
    c.moveTo(inset, y);
    c.lineTo(W - inset, y);
    c.stroke();
    for (let x = inset + R() * 80; x < W - inset; x += 90 + R() * 60) {
      c.beginPath();
      c.moveTo(x, y - 34);
      c.lineTo(x, y);
      c.stroke();
    }
  }
  // Under the coping: a deep shadow line, then a row of corbels.
  c.fillStyle = "rgba(20,10,4,0.55)";
  c.fillRect(-6, faceTop, W + 12, 10);
  for (let x = 30; x < W; x += 80) {
    c.fillStyle = mix(t.front[0], "#000000", 0.25);
    c.fillRect(x, faceTop + 10, 26, 22);
    c.fillStyle = "rgba(255,240,210,0.2)";
    c.fillRect(x, faceTop + 10, 26, 3);
  }
  // Glowing crystal seams on the tower (the zone's mark).
  c.strokeStyle = rgba(t.crystal[1], 0.55);
  c.lineWidth = 4;
  for (const sx of [240, 760, 1310]) {
    c.beginPath();
    c.moveTo(sx, faceTop + 40);
    c.lineTo(sx + 14, faceTop + 100);
    c.lineTo(sx - 6, faceTop + 160);
    c.stroke();
  }
  // Near clouds drift across the foot of the tower.
  reseed(9400 + floor);
  for (let k = 0; k < 18; k++)
    puff(
      S.x + R() * S.w,
      Math.max(cloudTop + 140, faceTop + face * 0.55) + R() * 260,
      150 + R() * 120,
      0.7,
    );
}
function rgba(col: string, a: number) {
  const m = col.startsWith("rgb")
    ? col.match(/\d+/g)!.slice(0, 3).map(Number)
    : [1, 3, 5].map((i) => parseInt(col.slice(i, i + 2), 16));
  return `rgba(${m.join(",")},${a})`;
}

// ───────────────────────────── Pieces ─────────────────────────────

/** A picture placed in the world at (x, y), w × h world px. */
export interface SpirePiece {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  paint: (c: Ctx) => void;
}
const PAD = 14;
/** How far a block's crystals rise above its top face (world px). */
export const SPIRE_CRYSTAL_RISE = 34;
type BlockStyle = "pylon" | "wall" | "outcrop";
const STYLE: Record<SpireCourtLayoutId, BlockStyle> = {
  gates: "pylon",
  walls: "wall",
  crystals: "outcrop",
  pylons: "pylon",
  captain: "outcrop",
};
/** A crystal point standing on the ground at (x, y), `h` tall, leaning `lean`. */
function crystal(
  c: Ctx,
  t: SpireZoneTheme,
  x: number,
  y: number,
  w: number,
  h: number,
  lean: number,
) {
  const tip = { x: x + lean, y: y - h };
  // Two faces: the lit left one, the shaded right one.
  c.fillStyle = t.crystal[1];
  c.beginPath();
  c.moveTo(x - w / 2, y);
  c.lineTo(x - w / 2 + lean * 0.3, y - h * 0.72);
  c.lineTo(tip.x, tip.y);
  c.lineTo(x + lean * 0.1, y + 2);
  c.closePath();
  c.fill();
  c.fillStyle = t.crystal[2];
  c.beginPath();
  c.moveTo(x + lean * 0.1, y + 2);
  c.lineTo(tip.x, tip.y);
  c.lineTo(x + w / 2 + lean * 0.3, y - h * 0.72);
  c.lineTo(x + w / 2, y);
  c.closePath();
  c.fill();
  // Dark outline (reads at a glance), then the bright ridge.
  c.strokeStyle = rgba(t.carve, 0.85);
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(x - w / 2, y);
  c.lineTo(x - w / 2 + lean * 0.3, y - h * 0.72);
  c.lineTo(tip.x, tip.y);
  c.lineTo(x + w / 2 + lean * 0.3, y - h * 0.72);
  c.lineTo(x + w / 2, y);
  c.stroke();
  c.strokeStyle = t.crystal[0];
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(x - w / 2 + lean * 0.3, y - h * 0.72);
  c.lineTo(tip.x, tip.y);
  c.lineTo(x + lean * 0.1, y + 2);
  c.stroke();
  c.fillStyle = "rgba(255,255,240,0.7)";
  c.beginPath();
  c.moveTo(x - w * 0.3 + lean * 0.3, y - h * 0.6);
  c.lineTo(tip.x - 1, tip.y + 6);
  c.lineTo(x - w * 0.18 + lean * 0.25, y - h * 0.3);
  c.closePath();
  c.fill();
}
/** A cluster of crystals with a soft glow at its foot. */
function cluster(
  c: Ctx,
  t: SpireZoneTheme,
  x: number,
  y: number,
  size: number,
  n: number,
  /** Height (0–1): the darker the sky, the more the crystals glow. */
  h = 0,
) {
  const glow = c.createRadialGradient(
    x,
    y - size * 0.3,
    2,
    x,
    y - size * 0.3,
    size * 1.1,
  );
  glow.addColorStop(0, rgba(t.crystal[1], 0.45 + 0.25 * h));
  glow.addColorStop(1, rgba(t.crystal[1], 0));
  c.fillStyle = glow;
  c.beginPath();
  c.arc(x, y - size * 0.3, size * 1.1, 0, Math.PI * 2);
  c.fill();
  // Back ones first: the tall middle crystal, then shorter ones leaning out.
  const spots = Array.from({ length: n }, (_, i) => {
    const off = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    return { off, back: i % 2 === 0 && Math.abs(off) < 0.9 };
  }).sort((a, b) => Number(b.back) - Number(a.back));
  for (const { off, back } of spots) {
    const big = 1 - Math.abs(off) * 0.55;
    crystal(
      c,
      t,
      x + off * size * 0.55,
      y + (back ? -4 : 3) + Math.abs(off) * 2,
      size * (0.34 + 0.12 * big),
      size * (0.5 + 0.75 * big) * (0.85 + R() * 0.3),
      off * size * 0.5,
    );
  }
}
/** Courses of dressed stone across a front face. */
function courses(
  c: Ctx,
  t: SpireZoneTheme,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const rows = 3,
    ch = h / rows;
  for (let r = 0; r < rows; r++) {
    let cx = x + (r % 2 ? -10 : 0);
    while (cx < x + w - 1) {
      const sx = Math.max(x, cx),
        sw = Math.min(x + w, cx + 24 + R() * 26) - sx;
      c.fillStyle = mix(t.front[0], t.front[1], 0.2 + R() * 0.5);
      c.fillRect(sx, y + r * ch, sw, ch);
      c.fillStyle = "rgba(255,244,220,0.25)";
      c.fillRect(sx + 1, y + r * ch + 1, sw - 2, 2);
      c.fillStyle = "rgba(30,18,6,0.4)";
      c.fillRect(sx, y + r * ch + ch - 2, sw, 2);
      c.fillRect(sx + sw - 1.5, y + r * ch, 1.5, ch);
      cx = sx + sw;
    }
  }
  const ao = c.createLinearGradient(0, y, 0, y + h);
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(1, "rgba(30,18,6,0.38)");
  c.fillStyle = ao;
  c.fillRect(x, y, w, h);
}
/**
 * The height's dusk on stone already painted (and only on it: "source-atop"
 * keeps the piece's transparent pixels clear). Crystals are painted after
 * it, so they keep their own warm light on every floor. The atlas spot's
 * clip keeps the fill inside the piece.
 */
function duskStone(c: Ctx, h: number) {
  if (h <= 0) return;
  c.save();
  c.globalCompositeOperation = "source-atop";
  c.fillStyle = `rgba(34,24,72,${0.36 * h})`;
  c.fillRect(-4000, -4000, 8000, 8000);
  c.restore();
}
/**
 * One block on its footprint, drawn in world coordinates: the top face over
 * the footprint's back part and the front face over its front BLOCK_H, so
 * the stone you see is exactly what stops fighters; crystals rise from the
 * top face (up to SPIRE_CRYSTAL_RISE above it).
 */
function paintBlock(
  c: Ctx,
  t: SpireZoneTheme,
  foot: Rect,
  style: BlockStyle,
  seed: number,
  h = 0,
) {
  reseed(seed);
  const o = stoneBase(foot);
  const top = foot.y,
    front = o.y + o.h - BLOCK_H,
    w = o.w,
    x = o.x;
  const depth = front - top;
  if (style === "outcrop") {
    // Rough rock, rounded at the corners, with a big crystal cluster.
    c.fillStyle = mix(t.front[1], "#000000", 0.1);
    c.beginPath();
    c.roundRect(x, front - 4, w, BLOCK_H + 4, [4, 4, 16, 16]);
    c.fill();
    courses(c, t, x + 3, front, w - 6, BLOCK_H - 6);
    c.fillStyle = mix(t.front[1], "#000000", 0.2);
    c.beginPath();
    c.roundRect(x, front + BLOCK_H - 12, w, 12, [0, 0, 14, 14]);
    c.fill();
    const tg = c.createLinearGradient(x, top, x + w, front);
    tg.addColorStop(0, t.top[0]);
    tg.addColorStop(1, t.top[1]);
    c.fillStyle = tg;
    c.beginPath();
    c.roundRect(x, top, w, depth + 2, 16);
    c.fill();
    grain(c, x, top, w, depth, 0.3, seed, [
      [18, 1],
      [4, 0.5],
    ]);
    c.fillStyle = "rgba(255,248,230,0.45)";
    c.fillRect(x + 10, top + 1, w - 20, 2.5);
    duskStone(c, h);
    cluster(c, t, x + w / 2, top + depth * 0.62, Math.min(w, 70) * 0.7, 3, h);
    return;
  }
  // Pylons and walls: dressed blocks with a carved band and crystals on top.
  courses(c, t, x, front, w, BLOCK_H);
  const tg = c.createLinearGradient(x, top, x + w, front);
  tg.addColorStop(0, t.top[0]);
  tg.addColorStop(1, t.top[1]);
  c.fillStyle = tg;
  c.fillRect(x, top, w, depth);
  grain(c, x, top, w, depth, 0.3, seed, [
    [22, 1],
    [5, 0.5],
  ]);
  // A carved border on the top slab.
  c.strokeStyle = rgba(t.carve, 0.45);
  c.lineWidth = 1.5;
  c.strokeRect(x + 7, top + 6, w - 14, depth - 12);
  c.fillStyle = "rgba(255,250,236,0.55)";
  c.fillRect(x, top, w, 3);
  c.fillRect(x, top, 3, depth);
  c.fillStyle = "rgba(40,24,10,0.35)";
  c.fillRect(x + w - 3, top, 3, depth);
  c.fillStyle = mix(t.top[0], "#ffffff", 0.2);
  c.fillRect(x, front - 2, w, 3);
  c.fillStyle = "rgba(30,18,6,0.4)";
  c.fillRect(x, front + 1, w, 2);
  // A rune on the front, inlaid with the zone's crystal.
  c.save();
  c.lineCap = "round";
  c.strokeStyle = rgba(t.carve, 0.7);
  c.lineWidth = 3;
  rune(c, x + w / 2 + 0.8, front + BLOCK_H / 2 + 0.8, 9, seed);
  c.strokeStyle = t.crystal[1];
  c.lineWidth = 1.8;
  rune(c, x + w / 2, front + BLOCK_H / 2, 9, seed);
  c.restore();
  duskStone(c, h);
  if (style === "wall") {
    // Crystal clusters along the wall's length.
    const n = Math.max(2, Math.floor(depth / 70));
    for (let k = 0; k < n; k++)
      cluster(
        c,
        t,
        x + w / 2,
        top + (depth * (k + 0.75)) / n,
        Math.min(w, 60) * 0.6,
        2,
        h,
      );
  } else
    cluster(c, t, x + w / 2, top + depth * 0.66, Math.min(w, 80) * 0.62, 3, h);
}
/** A block's frame (world): its footprint plus room for crystals and chips. */
function blockFrame(foot: Rect) {
  return {
    x: foot.x - PAD,
    y: foot.y - SPIRE_CRYSTAL_RISE - PAD,
    w: foot.w + PAD * 2,
    h: foot.h + SPIRE_CRYSTAL_RISE + PAD * 2,
  };
}
/** Its shadow on the floor, swept along the sun by its height. */
function shadowFrame(foot: Rect) {
  const dx = SUNV.x * (BLOCK_H + SPIRE_CRYSTAL_RISE);
  return {
    x: foot.x - 20,
    y: foot.y - 20,
    w: foot.w + dx + 40,
    h: foot.h + 40,
  };
}
function paintShadow(c: Ctx, foot: Rect, k: number) {
  const o = stoneBase(foot);
  const dx = SUNV.x * BLOCK_H,
    dy = SUNV.y * BLOCK_H;
  // Solid shape drawn far off to the left, its blurred shadow cast back in
  // place (canvas shadows are in device pixels: the atlas scale is k).
  const off = 4000;
  c.save();
  c.shadowColor = "rgba(30,18,6,0.4)";
  c.shadowBlur = 10 * k;
  c.shadowOffsetX = off * k;
  c.fillStyle = "#000";
  c.beginPath();
  c.moveTo(o.x - off, o.y);
  c.lineTo(o.x + o.w - off, o.y);
  c.lineTo(o.x + o.w + dx - off, o.y + dy);
  c.lineTo(o.x + o.w + dx - off, o.y + o.h + dy);
  c.lineTo(o.x + dx - off, o.y + o.h + dy);
  c.lineTo(o.x - off, o.y + o.h);
  c.closePath();
  c.fill();
  c.restore();
  // Contact shade right at its foot.
  const g = c.createLinearGradient(0, foot.y + foot.h, 0, foot.y + foot.h + 12);
  g.addColorStop(0, "rgba(30,18,6,0.45)");
  g.addColorStop(1, "rgba(30,18,6,0)");
  c.fillStyle = g;
  c.fillRect(foot.x - 4, foot.y + foot.h, foot.w + 8, 12);
}
/** The stairs' picture: a flight rising away from the camera to an arch. */
export const SPIRE_STAIRS_RISE = 15;
const STEPS = 6;
function stairsFrame() {
  const s = SPIRE_STAIRS;
  return {
    x: s.x,
    y: s.y - STEPS * SPIRE_STAIRS_RISE - 132,
    w: s.w + 18,
    h: s.h + STEPS * SPIRE_STAIRS_RISE + 132 + 12,
  };
}
/** Where the arch's opening is (world), for the glow when it is lit. */
export function spireStairsGlow() {
  const s = SPIRE_STAIRS;
  const top = s.y - STEPS * SPIRE_STAIRS_RISE;
  return { x: s.x + s.w / 2, y: top - 52 };
}
function paintStairs(c: Ctx, t: SpireZoneTheme, lit: boolean, h = 0) {
  reseed(5501);
  const s = SPIRE_STAIRS;
  const inner = { x: s.x + 12, w: s.w - 24 };
  const tread = s.h / STEPS;
  // From the back (highest) step to the front, so nearer steps cover farther.
  for (let i = STEPS - 1; i >= 0; i--) {
    const z = (i + 1) * SPIRE_STAIRS_RISE;
    // Step i's tread spans ground y from its front edge back one tread.
    const front = s.y + s.h - i * tread;
    const ty = front - tread - z,
      fy = front - z;
    const tg = c.createLinearGradient(inner.x, ty, inner.x + inner.w, fy);
    tg.addColorStop(0, mix(t.top[0], "#ffffff", 0.05));
    tg.addColorStop(1, t.top[1]);
    c.fillStyle = tg;
    c.fillRect(inner.x, ty, inner.w, tread);
    c.fillStyle = "rgba(255,250,236,0.5)";
    c.fillRect(inner.x, fy - 2, inner.w, 2);
    // The riser below its nosing (faces the camera).
    const rg = c.createLinearGradient(0, fy, 0, fy + SPIRE_STAIRS_RISE);
    rg.addColorStop(0, t.front[0]);
    rg.addColorStop(1, t.front[1]);
    c.fillStyle = rg;
    c.fillRect(inner.x, fy, inner.w, SPIRE_STAIRS_RISE);
    // A rune strip in each riser: lit, it glows.
    c.fillStyle = lit ? t.rune : rgba(t.carve, 0.65);
    c.fillRect(
      inner.x + inner.w * 0.3,
      fy + SPIRE_STAIRS_RISE * 0.4,
      inner.w * 0.4,
      3,
    );
    if (lit) {
      c.fillStyle = rgba(t.crystal[0], 0.8);
      c.fillRect(
        inner.x + inner.w * 0.38,
        fy + SPIRE_STAIRS_RISE * 0.4,
        inner.w * 0.24,
        1.5,
      );
    }
  }
  // The side walls of the flight: sloping, with stone coping.
  for (const [x, w] of [
    [s.x, 12],
    [s.x + s.w - 12, 12],
  ] as const) {
    const topY = s.y - STEPS * SPIRE_STAIRS_RISE - 10;
    const g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, t.front[0]);
    g.addColorStop(1, t.front[1]);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x, topY);
    c.lineTo(x + w, topY);
    c.lineTo(x + w, s.y + s.h);
    c.lineTo(x, s.y + s.h);
    c.closePath();
    c.fill();
    c.fillStyle = t.rim[0];
    c.beginPath();
    c.moveTo(x - 1, topY - 6);
    c.lineTo(x + w + 1, topY - 6);
    c.lineTo(x + w + 1, s.y + s.h - SPIRE_STAIRS_RISE - 6);
    c.lineTo(x - 1, s.y + s.h - SPIRE_STAIRS_RISE - 6);
    c.closePath();
    c.fill();
    c.fillStyle = "rgba(30,18,6,0.35)";
    c.fillRect(x + w - 2, topY, 2, s.y + s.h - topY);
  }
  // Newel posts at the foot, each with a crystal lamp.
  for (const x of [s.x + 6, s.x + s.w - 6]) {
    const y = s.y + s.h;
    c.fillStyle = t.front[1];
    c.fillRect(x - 8, y - 34, 16, 34);
    c.fillStyle = t.rim[0];
    c.fillRect(x - 10, y - 38, 20, 6);
  }
  // The arch at the top landing: two posts, a round head, the opening.
  const landing = s.y - STEPS * SPIRE_STAIRS_RISE;
  const ax = s.x + s.w / 2,
    half = s.w / 2 - 6,
    postW = 16,
    rise = 112;
  const openL = ax - half + postW,
    openR = ax + half - postW,
    openTop = landing - rise + 18;
  // The opening: dark when shut, a bright gate when lit.
  const og = c.createLinearGradient(0, openTop, 0, landing);
  if (lit) {
    og.addColorStop(0, "#fffbe8");
    og.addColorStop(0.5, t.crystal[0]);
    og.addColorStop(1, t.crystal[1]);
  } else {
    og.addColorStop(0, "#1b1230");
    og.addColorStop(1, "#2b1d40");
  }
  c.fillStyle = og;
  c.beginPath();
  c.moveTo(openL, landing);
  c.lineTo(openL, openTop + (openR - openL) / 2);
  c.arc(ax, openTop + (openR - openL) / 2, (openR - openL) / 2, Math.PI, 0);
  c.lineTo(openR, landing);
  c.closePath();
  c.fill();
  if (lit) {
    // Light spilling down the steps.
    const spill = c.createLinearGradient(0, landing, 0, s.y + s.h);
    spill.addColorStop(0, rgba(t.crystal[0], 0.5));
    spill.addColorStop(1, rgba(t.crystal[0], 0));
    c.fillStyle = spill;
    c.fillRect(inner.x, landing, inner.w, s.y + s.h - landing);
  } else {
    // A faint starfield beyond: the next floor waits.
    reseed(5510);
    for (let k = 0; k < 7; k++) {
      c.fillStyle = "rgba(220,200,255,0.5)";
      c.fillRect(
        openL + 4 + R() * (openR - openL - 8),
        openTop + 10 + R() * (landing - openTop - 16),
        1.6,
        1.6,
      );
    }
  }
  // Posts and the head.
  for (const px of [ax - half, ax + half - postW]) {
    const g = c.createLinearGradient(px, 0, px + postW, 0);
    g.addColorStop(0, t.top[0]);
    g.addColorStop(1, t.front[1]);
    c.fillStyle = g;
    c.fillRect(px, landing - rise + 30, postW, rise - 30 + 4);
    c.fillStyle = "rgba(30,18,6,0.3)";
    for (let y = landing - rise + 50; y < landing; y += 20)
      c.fillRect(px, y, postW, 1.5);
  }
  c.strokeStyle = t.top[1];
  c.lineWidth = postW;
  c.beginPath();
  c.arc(
    ax,
    openTop + (openR - openL) / 2,
    (openR - openL) / 2 + postW / 2,
    Math.PI,
    0,
  );
  c.stroke();
  c.strokeStyle = "rgba(255,250,236,0.55)";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(
    ax,
    openTop + (openR - openL) / 2,
    (openR - openL) / 2 + postW - 1,
    Math.PI * 1.05,
    Math.PI * 1.6,
  );
  c.stroke();
  // The height's dusk on the stone; then what lights itself.
  duskStone(c, h);
  if (lit) {
    c.fillStyle = og;
    c.beginPath();
    c.moveTo(openL, landing);
    c.lineTo(openL, openTop + (openR - openL) / 2);
    c.arc(ax, openTop + (openR - openL) / 2, (openR - openL) / 2, Math.PI, 0);
    c.lineTo(openR, landing);
    c.closePath();
    c.fill();
  }
  // The newels' crystal lamps.
  for (const x of [s.x + 6, s.x + s.w - 6]) {
    const y = s.y + s.h;
    if (lit) {
      const g = c.createRadialGradient(x, y - 46, 1, x, y - 46, 16);
      g.addColorStop(0, rgba(t.crystal[0], 0.9));
      g.addColorStop(1, rgba(t.crystal[1], 0));
      c.fillStyle = g;
      c.fillRect(x - 16, y - 62, 32, 32);
    }
    crystal(c, t, x, y - 38, 9, lit ? 20 : 15, 0);
  }
  // The keystone crystal.
  crystal(c, t, ax, openTop - postW + 6, 14, lit ? 30 : 24, 0);
}
/** The floor number, carved in the ring's middle (on the ground plane). */
function numberFrame() {
  const { x, y } = SPIRE_RING;
  return { x: x - 90, y: y - 60, w: 180, h: 120 };
}
function paintNumber(c: Ctx, t: SpireZoneTheme, floor: number, k: number) {
  const { x, y } = SPIRE_RING;
  const text = String(floor);
  c.save();
  c.translate(x, y + 4);
  c.scale(1, K);
  c.font = `700 ${text.length > 1 ? 104 : 118}px Georgia, "Times New Roman", serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineJoin = "round";
  // A faint glow round it (under the groove, so the groove stays dark).
  c.save();
  c.shadowColor = rgba(t.crystal[1], 0.75);
  c.shadowBlur = 14 * k;
  c.strokeStyle = rgba(t.crystal[1], 0.5);
  c.lineWidth = 9;
  c.strokeText(text, 0, 0);
  c.restore();
  // The light lip on the groove's lower-right edge.
  c.fillStyle = "rgba(255,248,230,0.9)";
  c.fillText(text, 3.5, 4);
  // The groove itself: deep and dark, a little wider than the number, so
  // it reads on every floor (whatever the light).
  c.strokeStyle = t.carve;
  c.lineWidth = 9;
  c.strokeText(text, -1, -1);
  c.fillStyle = t.carve;
  c.fillText(text, -2, -2);
  // The inlay at the bottom of the groove.
  const g = c.createLinearGradient(0, -50, 0, 50);
  g.addColorStop(0, t.crystal[0]);
  g.addColorStop(1, t.crystal[1]);
  c.fillStyle = g;
  c.fillText(text, 0, 0);
  c.restore();
}
/** A small four-point star (the sky's twinkling ones). */
function paintStar(c: Ctx) {
  const g = c.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,246,220,0.7)");
  g.addColorStop(1, "rgba(255,246,220,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 16, 16);
  c.fillStyle = "rgba(255,255,255,0.9)";
  c.fillRect(7.4, 1, 1.2, 14);
  c.fillRect(1, 7.4, 14, 1.2);
}

/** The pieces a floor's atlas holds (world frames; names are stable). */
export function spireFloorPieces(
  zone: number,
  floor: number,
  kind: SpireFloorKind,
  k: number,
): SpirePiece[] {
  const t = spireTheme(zone);
  const layout = spireCourtLayout(floor, kind);
  // The height's dusk is painted into the stone (crystals keep their light).
  const height = spireHeight(floor);
  const out: SpirePiece[] = [];
  const at = (f: { x: number; y: number; w: number; h: number }) => f;
  if (layout) {
    const style = STYLE[layout.id];
    layout.blocks.forEach((foot, i) => {
      const sf = at(shadowFrame(foot));
      out.push({
        name: `shadow${i}`,
        ...sf,
        paint: (c) => paintShadow(c, foot, k),
      });
      const bf = at(blockFrame(foot));
      out.push({
        name: `block${i}`,
        ...bf,
        paint: (c) =>
          paintBlock(c, t, foot, style, 7000 + i * 31 + floor, height),
      });
    });
    out.push({
      name: "stairs",
      ...stairsFrame(),
      paint: (c) => paintStairs(c, t, false, height),
    });
    out.push({
      name: "stairs-lit",
      ...stairsFrame(),
      paint: (c) => paintStairs(c, t, true, height),
    });
    out.push({
      name: "stairs-shadow",
      ...shadowFrame(SPIRE_STAIRS),
      paint: (c) => paintShadow(c, SPIRE_STAIRS, k),
    });
    out.push({
      name: "number",
      ...numberFrame(),
      paint: (c) => paintNumber(c, t, floor, k),
    });
  }
  out.push({
    name: "star",
    x: 0,
    y: 0,
    w: 16,
    h: 16,
    paint: (c) => paintStar(c),
  });
  return out;
}
/** Shelf-pack pieces into an atlas `k` pixels per world px. */
export function packSpirePieces(pieces: SpirePiece[], k: number) {
  const maxW = 2048;
  let x = 0,
    y = 0,
    row = 0,
    width = 0;
  const spots = pieces
    .map((piece) => ({
      piece,
      pw: Math.ceil(piece.w * k) + 2,
      ph: Math.ceil(piece.h * k) + 2,
    }))
    .sort((a, b) => b.ph - a.ph)
    .map((s) => {
      if (x + s.pw > maxW) {
        x = 0;
        y += row;
        row = 0;
      }
      const spot = { ...s, x, y };
      x += s.pw;
      row = Math.max(row, s.ph);
      width = Math.max(width, x);
      return spot;
    });
  return { spots, width: Math.max(1, width), height: Math.max(1, y + row) };
}
/** Paint every packed piece into the atlas canvas. */
export function paintSpireAtlas(
  ctx: Ctx,
  spots: ReturnType<typeof packSpirePieces>["spots"],
  k: number,
) {
  for (const s of spots) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(s.x, s.y, s.pw, s.ph);
    ctx.clip();
    ctx.setTransform(
      k,
      0,
      0,
      k,
      s.x + 1 - s.piece.x * k,
      s.y + 1 - s.piece.y * k,
    );
    s.piece.paint(ctx);
    ctx.restore();
  }
}
/** Spots for twinkling stars in the sky beyond the court (world), by floor. */
export function spireStarSpots(floor: number) {
  const n = Math.round(12 * spireHeight(floor));
  const spots: { x: number; y: number; phase: number; size: number }[] = [];
  reseed(9900 + floor);
  for (let i = 0; i < n; i++) {
    const side = i % 3;
    const x =
      side === 0
        ? -40 - R() * 300
        : side === 1
          ? W + 40 + R() * 300
          : 100 + R() * (W - 200);
    const y = side === 2 ? -40 - R() * 240 : -200 + R() * 560;
    spots.push({ x, y, phase: R() * Math.PI * 2, size: 0.8 + R() * 0.9 });
  }
  return spots;
}

// ───────────────────────── The summit (floor 10) ─────────────────────────

/**
 * The boss floor keeps its raid's court; painted over it once, a darker
 * "Spire" grade: cooler and dimmer, a violet night pressing in from the
 * edges, so the summit feels high above the floors below.
 */
export function paintSpireSummitGrade(c: Ctx) {
  c.save();
  c.globalCompositeOperation = "multiply";
  c.fillStyle = "#8f86b8";
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = "source-over";
  const v = c.createRadialGradient(
    W / 2,
    H / 2,
    H * 0.35,
    W / 2,
    H / 2,
    H * 1.0,
  );
  v.addColorStop(0, "rgba(20,10,40,0)");
  v.addColorStop(1, "rgba(20,10,40,0.5)");
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
  // A cold rim light from the moon at the upper right.
  c.globalCompositeOperation = "screen";
  const m = c.createRadialGradient(W, 0, 40, W, 0, 900);
  m.addColorStop(0, "rgba(170,160,255,0.22)");
  m.addColorStop(1, "rgba(170,160,255,0)");
  c.fillStyle = m;
  c.fillRect(0, 0, W, H);
  c.restore();
}
