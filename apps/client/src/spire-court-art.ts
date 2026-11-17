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
  /**
   * Shade and lit edges painted over the stone ("r,g,b"). Unset: the warm
   * browns and creams zone 1 was painted with (`tone`).
   */
  ink?: string;
  shine?: string;
  /** The height's dusk over stone ("r,g,b"; unset: zone 1's violet). */
  dusk?: string;
  /** The low sun's haze ("r,g,b"), and the warm light the floor's grade adds. */
  sun?: string;
  warmth?: number;
  /** The floor's tint at the zone's top ([r, g, b]; unset: zone 1's violet dusk). */
  duskTint?: [number, number, number];
  /**
   * A water zone: channels and tide pools in the paving, and the sea far
   * below the tower (mist, gulls and spray low down; at the top a moonlit
   * sea with bioluminescent specks) instead of a cloud sea.
   */
  sea?: {
    /** Water: shallow, deep, and the foam and lit edges. */
    shallow: string;
    deep: string;
    foam: string;
    /** Bioluminescence (high floors). */
    bio: string;
  };
  /** The pale glow in the paving's middle (unset: 0.16; a dark zone's is faint). */
  centreGlow?: number;
  /** The floor's vignette (unset: 0.42; a dark zone keeps its edges lighter). */
  vignette?: number;
  /**
   * A night zone (Shadow): violet ink veins in the inlay, lantern-lit warm
   * pools on the paving, lanterns and candles on the cover, and beyond the
   * tower a night sky with ink clouds and a few distant lantern lights.
   * Higher floors gather more ink (on the cover and in the sky).
   */
  night?: {
    /** The ink in the veins and on the stone. */
    veins: string;
    /** Lantern glass and flame (light, mid). */
    lantern: [string, string];
    /** The warm light a lantern throws on the paving ("r,g,b"). */
    pool: string;
    /** Ink clouds and streaks in the sky. */
    inkCloud: string;
  };
  /**
   * A dream zone (Psychic): pale marble veins and a gold star inlay in the
   * paving (constellations along the spokes, crescent moons in the
   * corners), a crescent and star on the cover and stars at the crystals'
   * tips, and beyond the tower a twilight sky with a big soft moon, dream
   * clouds drifting past and a few stars floating in the air. Higher floors
   * sink into a deeper indigo night.
   */
  dream?: {
    /** The star inlay's gold (and the stars on the cover). */
    star: string;
    /** Marble veins ("r,g,b"). */
    vein: string;
    /** Dream clouds: their lit tops (rose) and their shade (lavender). */
    cloud: [string, string];
    /** The moon. */
    moon: string;
  };
  /**
   * A light zone (Light): a gold sun inlaid round the rune ring (rays along
   * the spokes, a sunburst in each corner), prism crystals that split the
   * light into small rainbow facets (on the crystals and spilled at their
   * feet, a few flecks on the paving), a gold sun on the cover's fronts, and
   * beyond the tower a bright morning sky with a big sun and its rays over
   * prismatic clouds (iridescent fringes, a small rainbow). Higher floors
   * turn to a warm gold sunset.
   */
  radiant?: {
    /** The sun inlay's gold, and its light edge. */
    gold: string;
    goldLight: string;
    /** The spectrum a prism splits the light into (red to blue). */
    prism: string[];
    /** The sun's disc. */
    sun: string;
  };
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
  // Zone 2, Water: pale sea-glass marble and aquamarine crystal, water
  // channels and tide pools in the paving, a sea mist far below with gulls
  // in it; near the top a deep night sea glowing with bioluminescence.
  2: {
    zone: 2,
    slab: ["#dcefe8", "#8fbcb5"],
    grout: "#2a5360",
    rim: ["#f2f8f5", "#9ab7b7"],
    carve: "#143c4a",
    top: ["#f1f8f5", "#c0d8d4"],
    front: ["#8cadb0", "#517780"],
    crystal: ["#e6fffb", "#33d0c0", "#0a6b78"],
    glow: 0x4ff0dc,
    rune: "#7ef4e4",
    skyLow: ["#74b2d3", "#e3f2ee"],
    skyHigh: ["#030a1c", "#10384f"],
    cloud: ["#eef9f8", "#3a6480"],
    light: "214,244,255",
    ink: "10,34,46",
    shine: "238,252,250",
    dusk: "8,28,72",
    sun: "236,248,255",
    warmth: 0.06,
    duskTint: [176, 198, 236],
    sea: {
      shallow: "#46aebb",
      deep: "#0b3f5e",
      foam: "#eafcff",
      bio: "#6ff7e6",
    },
  },
  // Zone 3, Shadow: a haunted tower at night. Dark slate and obsidian
  // stone, lantern-lit warm pools on the paving, violet ink seeping through
  // the inlay, candle-pale crystals over ink-dark faces and lanterns on the
  // cover; beyond the edge a night sky with ink clouds and a few distant
  // lantern lights. (The Echoes' lavender, ECHO_SKILL_COLOR, stays unused:
  // the ink is a deeper, redder violet and only in thin veins.)
  3: {
    zone: 3,
    slab: ["#33364a", "#1e2030"],
    grout: "#14121c",
    rim: ["#77738a", "#403e52"],
    carve: "#0b0912",
    top: ["#8a879e", "#5e5c74"],
    front: ["#4e4c64", "#2c2a3c"],
    crystal: ["#fff6dc", "#ffcf7a", "#3a2350"],
    glow: 0xffc864,
    rune: "#ffd98a",
    skyLow: ["#211c40", "#4d3c66"],
    skyHigh: ["#040309", "#160c28"],
    cloud: ["#3e345c", "#1c1430"],
    light: "112,106,168",
    ink: "8,6,18",
    shine: "232,226,255",
    dusk: "14,8,40",
    warmth: 0.1,
    duskTint: [196, 184, 226],
    centreGlow: 0.04,
    vignette: 0.3,
    night: {
      veins: "#8a3fc0",
      lantern: ["#fff3c8", "#ffb04a"],
      pool: "255,184,104",
      inkCloud: "#2a1d44",
    },
  },
  // Zone 4, Psychic: a dreamlike tower above the clouds. Pale periwinkle
  // marble with white veins and a gold star inlay, rose-pink
  // psychic crystals with stars at their tips, a crescent and star on the
  // cover; beyond the edge a twilight sky (periwinkle over a rose horizon)
  // with a big soft moon, dream clouds and a few floating stars, sinking
  // into a deep indigo night near the top. (The marble leans blue, not
  // lavender, so the Echoes' violet ring, ECHO_SKILL_COLOR, keeps its own
  // hue on it; the crystals are rose, never violet.)
  4: {
    zone: 4,
    slab: ["#d6daf6", "#aab0e2"],
    grout: "#5e66a8",
    rim: ["#eff1ff", "#a4aade"],
    carve: "#1c1642",
    top: ["#f4f5ff", "#cdd1f2"],
    front: ["#868fcf", "#525a9c"],
    crystal: ["#fff3fb", "#ff9fd4", "#7c2a78"],
    glow: 0xffa6da,
    rune: "#ffd86a",
    skyLow: ["#5d64ba", "#f7c8de"],
    skyHigh: ["#070726", "#2c2266"],
    cloud: ["#f6ecff", "#5a4c9c"],
    light: "236,228,255",
    ink: "22,16,62",
    shine: "252,248,255",
    dusk: "26,18,88",
    sun: "255,222,238",
    warmth: 0.08,
    duskTint: [192, 192, 240],
    vignette: 0.28,
    dream: {
      star: "#ffdf86",
      vein: "255,252,255",
      cloud: ["#ffd9ef", "#c0b0f6"],
      moon: "#fff7e2",
    },
  },
  // Zone 5, Light: a radiant sanctum of crystal and gold. Warm ivory and
  // champagne stone with a gold sun inlaid round the ring, clear prism
  // crystals splitting the light into small rainbow facets, a gold sun on
  // the cover's fronts; beyond the edge a bright morning sky with a big sun,
  // its rays and prismatic clouds, turning to a warm gold sunset near the
  // top. (The stone is a mid champagne, never white, so white and yellow
  // fighters keep a floor to stand out from; the crystals are clear and
  // cool, so the cover reads against the warm stone; the facets are small
  // and pale, never a ring or a warning.)
  5: {
    zone: 5,
    slab: ["#e0c9a2", "#b39465"],
    grout: "#76552e",
    rim: ["#fbf1da", "#c9ac7c"],
    carve: "#2a1608",
    top: ["#fdf6e6", "#e4cfa6"],
    front: ["#c29466", "#85603a"],
    crystal: ["#ffffff", "#e2f4ff", "#7f9ad2"],
    glow: 0xfff0b4,
    rune: "#f2b632",
    skyLow: ["#78bdf0", "#fff0cc"],
    skyHigh: ["#b4587c", "#ffb54a"],
    cloud: ["#fffaf0", "#ffc08a"],
    light: "255,238,200",
    ink: "62,36,12",
    shine: "255,252,240",
    dusk: "120,52,36",
    sun: "255,246,214",
    warmth: 0.14,
    duskTint: [246, 210, 176],
    vignette: 0.3,
    radiant: {
      gold: "#f2b632",
      goldLight: "#fff1b0",
      prism: ["#ff8fa8", "#ffbe5c", "#fff07a", "#8ef0a8", "#78d6ff"],
      sun: "#fff6d8",
    },
  },
};
/** A zone's look (1 Earth, 2 Water, 3 Shadow, 4 Psychic, 5 Light); unknown zones take zone 1's. */
export const spireZoneTheme = (zone: number): SpireZoneTheme =>
  SPIRE_ZONE_THEMES[zone] ?? SPIRE_ZONE_THEMES[1];
export const spireTheme = spireZoneTheme;
/**
 * A shade or highlight literal in the zone's tones: zone 1 keeps the warm
 * literal exactly; a zone with `ink`/`shine` swaps its colour (dark ones to
 * ink, light ones to shine) and keeps its alpha.
 */
function tone(t: SpireZoneTheme, literal: string) {
  if (!t.ink || !t.shine) return literal;
  const [r, g, b, a] = literal.match(/[\d.]+/g)!.map(Number);
  return `rgba(${0.3 * r + 0.59 * g + 0.11 * b < 128 ? t.ink : t.shine},${a})`;
}
/**
 * The light on the platform's floor by height (a tint on its picture, so
 * it costs nothing): full afternoon light low down, a cool dusk near the
 * top. The floor's pieces get the same dusk painted into their stone only
 * (duskStone), so crystals and the carved number keep their own light.
 */
export function spireFloorTint(floor: number, zone = 1) {
  const h = spireHeight(floor);
  const [r, g, b] = spireZoneTheme(zone).duskTint ?? [206, 194, 230];
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * h);
  return (lerp(255, r) << 16) | (lerp(255, g) << 8) | lerp(255, b);
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
      c.strokeStyle = tone(t, "rgba(255,246,226,0.22)");
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(...pts[0]);
      c.lineTo(...pts[1]);
      c.lineTo(...pts[2]);
      c.stroke();
      c.strokeStyle = tone(t, "rgba(30,18,6,0.3)");
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
        c.fillStyle = tone(t, "rgba(30,18,6,0.2)");
        ell(c, px, py, 1.5 + R() * 2, 1 + R());
        c.fill();
      }
      if (R() < 0.06) {
        const [p0x, p0y] = at(a0 + (a1 - a0) * 0.3, r0 + 4),
          [p1x, p1y] = at(a0 + (a1 - a0) * 0.6, r0 + depth * 0.5),
          [p2x, p2y] = at(a0 + (a1 - a0) * 0.45, r1 - 4);
        // (In a night zone the seam is violet ink.)
        const seam = t.night?.veins ?? t.crystal[1];
        c.save();
        c.shadowColor = seam;
        c.shadowBlur = 6;
        c.strokeStyle = rgba(seam, 0.75);
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
  c.strokeStyle = tone(t, "rgba(255,246,222,0.55)");
  c.lineWidth = 2;
  gEll(c, x, y, r + 22);
  c.stroke();
  c.strokeStyle = tone(t, "rgba(40,24,10,0.5)");
  gEll(c, x, y, r - 10);
  c.stroke();
  // Runes in the groove, inlaid with the zone's metal.
  c.save();
  c.lineCap = "round";
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const rx = x + Math.cos(a) * (r + 6),
      ry = y + Math.sin(a) * (r + 6) * K;
    c.strokeStyle = tone(t, "rgba(20,10,0,0.6)");
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
  c.strokeStyle = tone(t, "rgba(255,246,222,0.4)");
  c.lineWidth = 1.5;
  gEll(c, x, y, r * 0.58 + 3);
  c.stroke();
  // A faint glow from the inlay.
  lights(c, [[x, y, r * 1.25, 0.22, t.light]]);
}
/**
 * A water zone's waterways (decoration: walkable, nothing collides): four
 * shallow channels cut along the ring's spokes, and a tide pool in each
 * corner of the platform beyond the octagon. Low and calm, so they never
 * read as a warning.
 */
function waterways(c: Ctx, t: SpireZoneTheme) {
  const sea = t.sea;
  if (!sea) return;
  const { x, y, r } = SPIRE_RING;
  const at = (a: number, rr: number): [number, number] => [
    x + Math.cos(a) * rr,
    y + Math.sin(a) * rr * K,
  ];
  c.save();
  c.lineCap = "round";
  for (let k = 0; k < 8; k += 2) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const [x0, y0] = at(a, r + 40),
      [x1, y1] = at(a, 470);
    const line = (width: number, style: string | CanvasGradient, dy = 0) => {
      c.strokeStyle = style;
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(x0, y0 + dy);
      c.lineTo(x1, y1 + dy);
      c.stroke();
    };
    // The cut: a dark inner wall, a pale marble lip, then the water.
    line(26, tone(t, "rgba(30,18,6,0.22)"), 2);
    line(23, mix(t.rim[1], t.slab[0], 0.55));
    line(17, mix(t.carve, sea.deep, 0.5));
    const water = c.createLinearGradient(x0, y0, x1, y1);
    water.addColorStop(0, sea.shallow);
    water.addColorStop(1, mix(sea.shallow, sea.deep, 0.45));
    line(14, water, 1);
    // Light on the water: a broken glint down its middle.
    c.setLineDash([5, 9, 12, 30]);
    c.lineDashOffset = k * 7;
    line(1.4, rgba(sea.foam, 0.32), -1);
    c.setLineDash([]);
  }
  c.restore();
  // Tide pools in the corners, each in a rim of pale stones.
  reseed(7457);
  for (const [px, py] of [
    [118, 112],
    [W - 118, 112],
    [118, H - 104],
    [W - 118, H - 104],
  ]) {
    const rx = 34;
    c.fillStyle = tone(t, "rgba(30,18,6,0.35)");
    gEll(c, px + 2, py + 3, rx + 7);
    c.fill();
    const w = c.createRadialGradient(px - 8, py - 6, 4, px, py, rx + 2);
    w.addColorStop(0, sea.deep);
    w.addColorStop(0.7, mix(sea.deep, sea.shallow, 0.6));
    w.addColorStop(1, sea.shallow);
    c.fillStyle = w;
    gEll(c, px, py, rx + 2);
    c.fill();
    // Sand and a shell on the bottom, a ripple and a sky reflection.
    for (let k = 0; k < 6; k++) {
      c.fillStyle = rgba(sea.foam, 0.18);
      ell(
        c,
        px + (R() - 0.5) * rx * 1.2,
        py + (R() - 0.5) * rx * 0.6,
        2 + R() * 3,
        1.5 + R() * 1.5,
      );
      c.fill();
    }
    c.strokeStyle = rgba(sea.foam, 0.4);
    c.lineWidth = 1.2;
    gEll(c, px - 4, py - 2, rx * 0.55);
    c.stroke();
    c.fillStyle = rgba(sea.foam, 0.22);
    ell(c, px - rx * 0.35, py - rx * 0.3 * K, rx * 0.4, rx * 0.12);
    c.fill();
    // The rim: pale stones, lit on top.
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + R() * 0.2;
      const sx = px + Math.cos(a) * (rx + 5),
        sy = py + Math.sin(a) * (rx + 5) * K;
      c.fillStyle = mix(t.rim[0], t.rim[1], 0.2 + R() * 0.5);
      ell(c, sx, sy, 6 + R() * 3, 4 + R() * 2);
      c.fill();
      c.fillStyle = tone(t, "rgba(255,248,230,0.5)");
      ell(c, sx - 1, sy - 2, 3, 1.4);
      c.fill();
    }
  }
}
/**
 * A night zone's ink (decoration: walkable): violet veins seeping out of the
 * rune ring's groove into the paving and the plate, and ink threads laid in
 * four of the spokes. Thin and dim, so they read as stone, never as a
 * warning or an Echo's ring.
 */
function inkVeins(c: Ctx, t: SpireZoneTheme) {
  const night = t.night;
  if (!night) return;
  const { x, y, r } = SPIRE_RING;
  const at = (a: number, rr: number): [number, number] => [
    x + Math.cos(a) * rr,
    y + Math.sin(a) * rr * K,
  ];
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  // Ink in the spokes the water zone cuts channels along.
  for (let k = 1; k < 8; k += 2) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const [x0, y0] = at(a, r + 30),
      [x1, y1] = at(a, 560);
    c.strokeStyle = rgba(night.veins, 0.45);
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }
  // Veins from the groove: a wandering line with a branch or two, fading.
  reseed(7471);
  c.shadowColor = night.veins;
  c.shadowBlur = 5;
  const vein = (a: number, r0: number, len: number, width: number) => {
    let [px, py] = at(a, r0),
      dir = a;
    const out = r0 > r;
    c.beginPath();
    c.moveTo(px, py);
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      dir += (R() - 0.5) * 0.9;
      const d = len / steps;
      const s = out ? 1 : -1;
      px += Math.cos(dir) * d * s;
      py += Math.sin(dir) * d * K * s;
      c.lineTo(px, py);
      if (i === 2 && R() < 0.7) {
        // A short branch.
        c.moveTo(px, py);
        c.lineTo(
          px + Math.cos(dir + 0.8) * d * 1.4 * s,
          py + Math.sin(dir + 0.8) * d * 1.4 * K * s,
        );
        c.moveTo(px, py);
      }
    }
    c.lineWidth = width;
    c.stroke();
  };
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + R() * 0.3;
    c.strokeStyle = rgba(night.veins, 0.6);
    vein(a, r + 22, 70 + R() * 90, 1.8 + R() * 1.2);
  }
  // A few finer ones creeping inward over the plate.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.4 + R() * 0.4;
    c.strokeStyle = rgba(night.veins, 0.4);
    vein(a, r - 12, 26 + R() * 22, 1.2);
  }
  c.restore();
}
/** Where a night zone's lanterns stand on the coping (world). */
export const SPIRE_LANTERNS: [number, number][] = [
  [420, 14],
  [W - 420, 14],
  [14, H / 2],
  [W - 14, H / 2],
  [420, H - 12],
  [W - 420, H - 12],
];
/** A small lantern standing at (x, y): iron frame, warm glass, a flame. */
function lantern(c: Ctx, t: SpireZoneTheme, x: number, y: number, s = 1) {
  const night = t.night!;
  const w = 12 * s,
    h = 18 * s;
  c.save();
  // The glow round it (painted, not a live light).
  const g = c.createRadialGradient(x, y - h * 0.55, 1, x, y - h * 0.55, 26 * s);
  g.addColorStop(0, rgba(night.lantern[1], 0.55));
  g.addColorStop(1, rgba(night.lantern[1], 0));
  c.fillStyle = g;
  c.fillRect(x - 26 * s, y - h * 0.55 - 26 * s, 52 * s, 52 * s);
  // Glass, then the flame, then the iron.
  const glass = c.createLinearGradient(0, y - h, 0, y);
  glass.addColorStop(0, night.lantern[0]);
  glass.addColorStop(1, night.lantern[1]);
  c.fillStyle = glass;
  c.fillRect(x - w / 2, y - h, w, h);
  c.fillStyle = "#fffdf2";
  c.beginPath();
  c.ellipse(x, y - h * 0.45, 2.2 * s, 4.2 * s, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#16121e";
  c.lineWidth = 2 * s;
  c.strokeRect(x - w / 2, y - h, w, h);
  c.beginPath();
  c.moveTo(x, y - h);
  c.lineTo(x, y);
  c.stroke();
  c.fillStyle = "#16121e";
  c.beginPath();
  c.moveTo(x - w / 2 - 2 * s, y - h);
  c.lineTo(x, y - h - 7 * s);
  c.lineTo(x + w / 2 + 2 * s, y - h);
  c.closePath();
  c.fill();
  c.fillRect(x - w / 2 - 2 * s, y - 2 * s, w + 4 * s, 3 * s);
  c.restore();
}
/**
 * A night zone's lantern light on the paving: a warm pool under each of the
 * coping's lanterns and in each corner (where the crystals grow), so the
 * dark slate has lit places to read fighters against. Soft-edged: never a
 * ring, never a warning.
 */
function lanternPools(c: Ctx, t: SpireZoneTheme) {
  const night = t.night;
  if (!night) return;
  lights(c, [
    ...SPIRE_LANTERNS.map(
      ([x, y]): [number, number, number, number, string] => [
        x + (x < 40 ? 40 : x > W - 40 ? -40 : 0),
        y + (y < 40 ? 50 : y > H - 40 ? -50 : 0),
        240,
        0.6,
        night.pool,
      ],
    ),
    [96, 90, 230, 0.55, night.pool],
    [W - 96, 90, 230, 0.55, night.pool],
    [96, H - 86, 230, 0.55, night.pool],
    [W - 96, H - 86, 230, 0.55, night.pool],
  ]);
}
/**
 * A star's outline (`n` points; the inner corners at `inner` of the
 * radius) round (x, y), squashed by `flat` (K lays it on the ground).
 */
function starPath(
  c: Ctx,
  x: number,
  y: number,
  r: number,
  n = 4,
  inner = 0.38,
  flat = 1,
) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n,
      rr = i % 2 ? r * inner : r;
    const px = x + Math.cos(a) * rr,
      py = y + Math.sin(a) * rr * flat;
    if (i) c.lineTo(px, py);
    else c.moveTo(px, py);
  }
  c.closePath();
}
/** A crescent moon's outline round (x, y), its horns to the upper right. */
function crescentPath(c: Ctx, x: number, y: number, r: number, flat = 1) {
  // The outer disc's arc round the left, then the bite's arc back.
  const d = r * 0.5,
    r2 = r * 0.82;
  const ix = (r * r - r2 * r2 + d * d) / (2 * d),
    iy = Math.sqrt(Math.max(0, r * r - ix * ix));
  const ao = Math.atan2(iy, ix),
    ai = Math.atan2(iy, ix - d);
  c.save();
  c.translate(x, y);
  c.scale(1, flat);
  c.rotate(-0.5);
  c.beginPath();
  c.arc(0, 0, r, ao, -ao, false);
  c.arc(d, 0, r2, -ai, ai, true);
  c.closePath();
  c.restore();
}
/** A gold star inlaid in the paving: a dark seat, the gold, a pale glint. */
function inlaidStar(
  c: Ctx,
  t: SpireZoneTheme,
  x: number,
  y: number,
  r: number,
  n = 4,
) {
  const d = t.dream!;
  c.fillStyle = tone(t, "rgba(30,18,6,0.5)");
  starPath(c, x + 0.8, y + 1, r * 1.3, n, 0.44, K);
  c.fill();
  c.fillStyle = d.star;
  starPath(c, x, y, r, n, 0.4, K);
  c.fill();
  c.fillStyle = "rgba(255,255,248,0.8)";
  ell(c, x - r * 0.12, y - r * 0.12 * K, r * 0.22, r * 0.16);
  c.fill();
}
/**
 * A dream zone's paving (decoration: walkable, nothing collides): soft
 * white veins through the marble, a constellation inlaid in gold along
 * four of the spokes, stars scattered through the paving and a crescent
 * moon in each corner beyond the octagon. Small and calm, never a ring or
 * a warning.
 */
function dreamInlay(c: Ctx, t: SpireZoneTheme) {
  const d = t.dream;
  if (!d) return;
  const { x, y, r } = SPIRE_RING;
  const at = (a: number, rr: number): [number, number] => [
    x + Math.cos(a) * rr,
    y + Math.sin(a) * rr * K,
  ];
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  // Marble veins: long, faint, wandering.
  reseed(7481);
  for (let k = 0; k < 24; k++) {
    let px = 80 + R() * (W - 160),
      py = 60 + R() * (H - 120),
      dir = R() * Math.PI * 2;
    c.beginPath();
    c.moveTo(px, py);
    for (let i = 0; i < 7; i++) {
      dir += (R() - 0.5) * 0.8;
      const len = 22 + R() * 30;
      px += Math.cos(dir) * len;
      py += Math.sin(dir) * len * K;
      c.lineTo(px, py);
    }
    c.strokeStyle = `rgba(${d.vein},${(0.2 + R() * 0.16).toFixed(3)})`;
    c.lineWidth = 1 + R() * 1.4;
    c.stroke();
  }
  // Constellations along the spokes the water zone cuts channels beside.
  for (let k = 1; k < 8; k += 2) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const pts = Array.from({ length: 5 }, (_, i) =>
      at(a + (R() - 0.5) * 0.14, r + 52 + i * 92 + R() * 26),
    );
    const line = (style: string, width: number, dy: number) => {
      c.strokeStyle = style;
      c.lineWidth = width;
      c.beginPath();
      pts.forEach(([px, py], i) =>
        i ? c.lineTo(px, py + dy) : c.moveTo(px, py + dy),
      );
      c.stroke();
    };
    line(tone(t, "rgba(30,18,6,0.3)"), 3, 1.2);
    line(rgba(d.star, 0.75), 1.6, 0);
    pts.forEach(([px, py], i) =>
      inlaidStar(c, t, px, py, i === 2 ? 10 : 5.5 + R() * 2, i === 2 ? 5 : 4),
    );
  }
  // Stars scattered through the paving (clear of the ring's plate).
  for (let k = 0; k < 30; k++) {
    const px = 100 + R() * (W - 200),
      py = 80 + R() * (H - 160),
      s = 3 + R() * 3.5;
    if (Math.hypot(px - x, (py - y) / K) < r + 40) continue;
    inlaidStar(c, t, px, py, s);
  }
  // A crescent moon in each corner beyond the octagon, a star beside it.
  for (const [px, py] of [
    [122, 112],
    [W - 122, 112],
    [122, H - 104],
    [W - 122, H - 104],
  ]) {
    c.fillStyle = tone(t, "rgba(30,18,6,0.45)");
    crescentPath(c, px + 1.5, py + 2, 26, K);
    c.fill();
    const g = c.createLinearGradient(px - 26, py - 20, px + 26, py + 20);
    g.addColorStop(0, mix(d.star, "#ffffff", 0.45));
    g.addColorStop(1, d.star);
    c.fillStyle = g;
    crescentPath(c, px, py, 24, K);
    c.fill();
    inlaidStar(c, t, px + 30, py - 14, 7);
  }
  c.restore();
}
/**
 * A spectrum fleck: light split by a prism, `n` short parallel bands (red
 * to blue) at (x, y) along `a`. Small and pale: decoration, never a cue.
 */
function rainbowFleck(
  c: Ctx,
  t: SpireZoneTheme,
  x: number,
  y: number,
  len: number,
  a: number,
  alpha: number,
  band = 1.6,
) {
  const prism = t.radiant!.prism;
  const dx = Math.cos(a) * len,
    dy = Math.sin(a) * len * K;
  const nx = -Math.sin(a) * band,
    ny = Math.cos(a) * band * K;
  c.lineWidth = band * 1.1;
  prism.forEach((col, i) => {
    const o = i - (prism.length - 1) / 2;
    c.strokeStyle = rgba(col, alpha);
    c.beginPath();
    c.moveTo(x + nx * o, y + ny * o);
    c.lineTo(x + nx * o + dx, y + ny * o + dy);
    c.stroke();
  });
}
/** A gold sun inlaid in the paving: a dark seat, the gold disc, its rays and a glint. */
function inlaidSun(
  c: Ctx,
  t: SpireZoneTheme,
  x: number,
  y: number,
  r: number,
  rays = 12,
) {
  const d = t.radiant!;
  const ray = (rr: number, w: number, col: string, dx = 0, dy = 0) => {
    c.fillStyle = col;
    c.beginPath();
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2,
        len = i % 2 ? rr * 0.78 : rr;
      c.moveTo(
        x + dx + Math.cos(a - w) * r * 0.7,
        y + dy + Math.sin(a - w) * r * 0.7 * K,
      );
      c.lineTo(x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len * K);
      c.lineTo(
        x + dx + Math.cos(a + w) * r * 0.7,
        y + dy + Math.sin(a + w) * r * 0.7 * K,
      );
    }
    c.fill();
  };
  ray(r * 1.9, 0.2, tone(t, "rgba(30,18,6,0.4)"), 1, 1.4);
  ray(r * 1.8, 0.16, d.gold);
  c.fillStyle = tone(t, "rgba(30,18,6,0.45)");
  gEll(c, x + 1, y + 1.4, r * 0.82);
  c.fill();
  const g = c.createRadialGradient(
    x - r * 0.25,
    y - r * 0.2,
    1,
    x,
    y,
    r * 0.75,
  );
  g.addColorStop(0, d.goldLight);
  g.addColorStop(1, d.gold);
  c.fillStyle = g;
  gEll(c, x, y, r * 0.75);
  c.fill();
  c.fillStyle = "rgba(255,255,246,0.75)";
  ell(c, x - r * 0.22, y - r * 0.16 * K, r * 0.22, r * 0.12);
  c.fill();
}
/**
 * A light zone's paving (decoration: walkable, nothing collides): a gold
 * sun inlaid round the rune ring (long rays along the spokes, short ones
 * between, a small prism at each long ray's tip splitting the light), a
 * sunburst in each corner beyond the octagon and a few rainbow flecks
 * where the crystals' light falls. Flat and calm: never a ring or a cue.
 */
function sunInlay(c: Ctx, t: SpireZoneTheme) {
  const d = t.radiant;
  if (!d) return;
  const { x, y, r } = SPIRE_RING;
  const at = (a: number, rr: number): [number, number] => [
    x + Math.cos(a) * rr,
    y + Math.sin(a) * rr * K,
  ];
  c.save();
  c.lineJoin = "round";
  reseed(7491);
  // The rays: a dark seat, the gold, a light ridge down the middle.
  for (let k = 0; k < 16; k++) {
    const long = k % 2 === 0;
    const a = (k / 16) * Math.PI * 2 + Math.PI / 8,
      r0 = r + 30,
      r1 = long ? r + 230 : r + 110,
      w = long ? 0.055 : 0.05;
    const tri = (dx: number, dy: number, grow: number) => {
      const [ax, ay] = at(a - w * grow, r0),
        [bx, by] = at(a + w * grow, r0),
        [tx, ty] = at(a, r1 + 4 * (grow - 1));
      c.beginPath();
      c.moveTo(ax + dx, ay + dy);
      c.lineTo(tx + dx, ty + dy);
      c.lineTo(bx + dx, by + dy);
      c.closePath();
    };
    tri(1, 1.4, 1.25);
    c.fillStyle = tone(t, "rgba(30,18,6,0.18)");
    c.fill();
    tri(0, 0, 1);
    const [gx0, gy0] = at(a, r0),
      [gx1, gy1] = at(a, r1);
    const g = c.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, rgba(d.gold, 0.62));
    g.addColorStop(1, rgba(d.gold, 0.28));
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = rgba(d.goldLight, 0.55);
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(gx0, gy0);
    c.lineTo(...at(a, r1 - 10));
    c.stroke();
    if (long) {
      // A small prism at the tip, and the light it splits.
      const [px, py] = at(a, r1 + 12);
      c.fillStyle = tone(t, "rgba(30,18,6,0.4)");
      c.beginPath();
      c.moveTo(px + 1, py - 8);
      c.lineTo(px + 8, py + 4);
      c.lineTo(px - 6, py + 4);
      c.closePath();
      c.fill();
      c.fillStyle = t.crystal[1];
      c.beginPath();
      c.moveTo(px, py - 9);
      c.lineTo(px + 7, py + 3);
      c.lineTo(px - 7, py + 3);
      c.closePath();
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.9)";
      c.beginPath();
      c.moveTo(px, py - 9);
      c.lineTo(px + 2, py + 3);
      c.lineTo(px - 7, py + 3);
      c.closePath();
      c.fill();
      rainbowFleck(c, t, px + 4, py, 18, a + 0.5, 0.5);
    }
  }
  // A thin gold ring joining the rays' roots.
  c.strokeStyle = rgba(d.gold, 0.7);
  c.lineWidth = 2;
  gEll(c, x, y, r + 30);
  c.stroke();
  // Rainbow flecks on the paving, where the light falls through the
  // crystals (clear of the ring and its rays' roots).
  for (let k = 0; k < 22; k++) {
    const px = 110 + R() * (W - 220),
      py = 90 + R() * (H - 180);
    if (Math.hypot(px - x, (py - y) / K) < r + 70) continue;
    rainbowFleck(c, t, px, py, 10 + R() * 10, -0.4 + R() * 0.8, 0.32);
  }
  // A sunburst in each corner beyond the octagon.
  for (const [px, py] of [
    [122, 112],
    [W - 122, 112],
    [122, H - 104],
    [W - 122, H - 104],
  ])
    inlaidSun(c, t, px, py, 18, 12);
  c.restore();
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
  c.strokeStyle = tone(t, "rgba(40,24,10,0.45)");
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
  c.fillStyle = tone(t, "rgba(255,248,230,0.45)");
  c.fillRect(0, 0, W, 2);
  c.fillRect(0, H - B, W, 2);
  c.fillStyle = tone(t, "rgba(30,18,6,0.4)");
  c.fillRect(B, B, W - 2 * B, 3);
  c.fillRect(B, B, 3, H - 2 * B);
  c.fillRect(W - B - 3, B, 3, H - 2 * B);
  c.fillStyle = tone(t, "rgba(30,18,6,0.5)");
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
  inner.addColorStop(0, tone(t, `rgba(255,244,220,${t.centreGlow ?? 0.16})`));
  inner.addColorStop(1, tone(t, "rgba(255,244,220,0)"));
  c.fillStyle = inner;
  c.fillRect(0, 0, W, H);
  c.restore();
  // Outside it, the slabs are older and darker.
  c.save();
  c.beginPath();
  c.rect(0, 0, W, H);
  octagon(c, OCT.inset, OCT.chamfer);
  c.clip("evenodd");
  c.fillStyle = tone(t, "rgba(60,36,14,0.16)");
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
  c.strokeStyle = tone(t, "rgba(255,248,230,0.4)");
  c.lineWidth = 1.5;
  octagon(c, OCT.inset - 5, OCT.chamfer);
  c.stroke();
  c.strokeStyle = tone(t, "rgba(40,24,10,0.45)");
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
  waterways(c, t);
  inkVeins(c, t);
  lanternPools(c, t);
  dreamInlay(c, t);
  sunInlay(c, t);
  // Dust and grit, a few fallen crystal shards near the edges.
  paintKit.pebbles(
    c,
    260,
    tone(t, "rgba(255,240,210,0.35)"),
    tone(t, "rgba(60,36,14,0.3)"),
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
  // A night zone's lanterns on the coping.
  if (t.night) for (const [x, y] of SPIRE_LANTERNS) lantern(c, t, x, y + 8);
  // Sun from the upper left, warm, and a gentle vignette.
  lights(c, [
    [380, 200, 620, 0.2, t.light],
    [1250, 680, 420, 0.08, t.light],
  ]);
  grade(c, t.warmth ?? 0.3, t.vignette ?? 0.42);
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
  // (A water zone's sea, with a mist over it, sinks a little less.)
  // (A night zone's ink clouds sink a little less too.)
  const cloudTop = t.sea
    ? 300 + h * 760
    : t.night
      ? 320 + h * 820
      : t.dream
        ? 280 + h * 900
        : t.radiant
          ? 290 + h * 860
          : 260 + h * 1000;
  const g = c.createLinearGradient(0, S.y, 0, cloudTop + 120);
  g.addColorStop(0, top);
  g.addColorStop(0.65, mix(top, horizon, 0.55));
  g.addColorStop(1, horizon);
  c.fillStyle = g;
  c.fillRect(S.x, S.y, S.w, S.h);
  // Stars: none in daylight, a field of them at the top (a night zone has
  // some from its first floor).
  reseed(9100 + floor);
  // (A dream zone's twilight has some too, and more higher up; a light
  // zone's sun is up on every floor: none.)
  const stars = t.night
    ? Math.round(70 + 150 * h)
    : t.dream
      ? Math.round(50 + 170 * h)
      : t.radiant
        ? 0
        : Math.round(220 * h * h);
  for (let k = 0; k < stars; k++) {
    const x = S.x + R() * S.w,
      y = S.y + R() * (cloudTop - S.y);
    const a =
      (0.35 + R() * 0.65) *
      (t.night
        ? 0.6 + 0.4 * h
        : t.dream
          ? 0.45 + 0.55 * h
          : Math.min(1, h * 1.4));
    c.fillStyle = `rgba(255,248,232,${a})`;
    c.beginPath();
    c.arc(x, y, 1.6 + R() * 2.2, 0, Math.PI * 2);
    c.fill();
  }
  // A pale moon once it is dark enough (a night zone's: a crescent, always).
  // (A dream zone's: a big soft full moon, always.)
  if (t.night) paintCrescent(c, t, h);
  else if (t.dream) paintDreamMoon(c, t, h);
  else if (t.radiant) paintRadiantSun(c, t, h);
  else if (h > 0.45) {
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
    glow.addColorStop(0, `rgba(${t.sun ?? "255,236,190"},${0.55 * a})`);
    glow.addColorStop(1, `rgba(${t.sun ?? "255,236,190"},0)`);
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
  if (t.sea) paintSeaBelow(c, t, h, cloudTop, puff, floor);
  else if (t.night) paintNightBelow(c, t, h, cloudTop, puff, floor);
  else if (t.dream) paintDreamBelow(c, t, h, cloudTop, puff, floor);
  else if (t.radiant) paintRadiantBelow(c, t, h, cloudTop, puff, floor);
  // The far cloud sea behind the tower.
  else
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
  c.strokeStyle = tone(t, "rgba(30,18,6,0.4)");
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
  c.fillStyle = tone(t, "rgba(20,10,4,0.55)");
  c.fillRect(-6, faceTop, W + 12, 10);
  for (let x = 30; x < W; x += 80) {
    c.fillStyle = mix(t.front[0], "#000000", 0.25);
    c.fillRect(x, faceTop + 10, 26, 22);
    c.fillStyle = tone(t, "rgba(255,240,210,0.2)");
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
  // A night zone's tower: lit windows in its face.
  if (t.night) {
    reseed(9350);
    for (const [wx, wy] of [
      [180, 70],
      [520, 120],
      [1060, 80],
      [1420, 130],
      [880, 170],
    ]) {
      const glow = c.createRadialGradient(
        wx,
        faceTop + wy,
        1,
        wx,
        faceTop + wy,
        30,
      );
      glow.addColorStop(0, rgba(t.night.lantern[1], 0.5));
      glow.addColorStop(1, rgba(t.night.lantern[1], 0));
      c.fillStyle = glow;
      c.fillRect(wx - 30, faceTop + wy - 30, 60, 60);
      c.fillStyle = t.night.lantern[1];
      c.beginPath();
      c.moveTo(wx - 7, faceTop + wy + 10);
      c.lineTo(wx - 7, faceTop + wy - 4);
      c.arc(wx, faceTop + wy - 4, 7, Math.PI, 0);
      c.lineTo(wx + 7, faceTop + wy + 10);
      c.closePath();
      c.fill();
    }
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
/**
 * A water zone's view down: the sea far below the tower from `top` (the
 * horizon), glinting, with a mist bank over it and gulls wheeling in the
 * mist low down; higher up a moon path on a night sea and bioluminescent
 * specks along the swell. Painted once per floor with the sky.
 */
function paintSeaBelow(
  c: Ctx,
  t: SpireZoneTheme,
  h: number,
  top: number,
  puff: (x: number, y: number, r: number, a: number) => void,
  floor: number,
) {
  const sea = t.sea!,
    S = SPIRE_SKY,
    bottom = S.y + S.h;
  if (top >= bottom) return;
  const night = Math.min(1, h * 1.3);
  const horizonCol = mix(mix(t.skyLow[1], t.skyHigh[1], h), sea.shallow, 0.35);
  const g = c.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, horizonCol);
  g.addColorStop(0.25, mix(sea.shallow, sea.deep, 0.35 + 0.5 * night));
  g.addColorStop(1, mix(sea.deep, "#000814", 0.6 * night));
  c.fillStyle = g;
  c.fillRect(S.x, top, S.w, bottom - top);
  // Glints on the swell: short strokes, longer and further apart near us.
  reseed(9500 + floor);
  c.lineCap = "round";
  for (let k = 0; k < 220; k++) {
    const d = R(),
      y = top + 6 + d * d * (bottom - top),
      len = 8 + d * 40;
    const x = S.x + R() * S.w;
    c.strokeStyle = rgba(sea.foam, (0.18 + 0.3 * R()) * (1 - 0.6 * night));
    c.lineWidth = 1 + d * 2;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + len, y + (R() - 0.5) * 2);
    c.stroke();
  }
  // The moon's path on a night sea.
  if (h > 0.45) {
    const a = (h - 0.45) / 0.55;
    for (let k = 0; k < 40; k++) {
      const d = k / 40,
        y = top + 4 + d * d * (bottom - top);
      const w = 14 + d * 120;
      c.fillStyle = `rgba(240,246,255,${(0.5 - 0.35 * d) * a})`;
      c.fillRect(
        1900 - w / 2 + (R() - 0.5) * w * 0.6,
        y,
        w * (0.3 + R() * 0.4),
        2 + d * 3,
      );
    }
  }
  // Bioluminescence along the swell (it shows once the sea is dark).
  if (h > 0.3) {
    const a = Math.min(1, (h - 0.3) / 0.5);
    for (let k = 0; k < 140; k++) {
      const d = R(),
        x = S.x + R() * S.w,
        y = top + 10 + d * (bottom - top);
      const r = 2 + d * 5;
      const b = c.createRadialGradient(x, y, 0, x, y, r * 2.4);
      b.addColorStop(0, rgba(sea.bio, 0.7 * a));
      b.addColorStop(1, rgba(sea.bio, 0));
      c.fillStyle = b;
      c.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
    }
  }
  // The mist bank on the water (thin by night).
  for (let row = 0; row < 3; row++)
    for (let k = 0; k < 14; k++)
      puff(
        S.x + (k + R() * 0.8) * (S.w / 13),
        top - 30 + row * 70 + R() * 40,
        150 + R() * 110,
        (0.4 + row * 0.08) * (1 - 0.45 * night),
      );
  // Gulls wheeling in the mist, while it is still light.
  if (h < 0.7) {
    const a = 1 - h / 0.7;
    c.strokeStyle = `rgba(40,62,78,${0.75 * a})`;
    c.lineJoin = "round";
    for (let k = 0; k < 9; k++) {
      const x = S.x + 120 + R() * (S.w - 240),
        y = top - 220 + R() * 260,
        span = 12 + R() * 12;
      // (Never over the court itself.)
      if (x > -40 && x < W + 40 && y > -40 && y < H + 40) continue;
      c.lineWidth = 2.6;
      c.beginPath();
      c.moveTo(x - span, y - span * 0.35);
      c.quadraticCurveTo(x - span * 0.45, y - span * 0.5, x, y);
      c.quadraticCurveTo(
        x + span * 0.45,
        y - span * 0.5,
        x + span,
        y - span * 0.35,
      );
      c.stroke();
    }
  }
}
/** A night zone's moon: a pale crescent at the upper right, hazed by ink. */
function paintCrescent(c: Ctx, t: SpireZoneTheme, h: number) {
  const mx = 1900,
    my = -200,
    a = 0.75 + 0.25 * h;
  const glow = c.createRadialGradient(mx, my, 10, mx, my, 260);
  glow.addColorStop(0, `rgba(226,218,255,${0.3 * a})`);
  glow.addColorStop(1, "rgba(226,218,255,0)");
  c.fillStyle = glow;
  c.fillRect(mx - 260, my - 260, 520, 520);
  c.save();
  c.fillStyle = `rgba(246,242,255,${0.92 * a})`;
  c.beginPath();
  c.arc(mx, my, 50, 0, Math.PI * 2);
  c.fill();
  // The dark part: the night's own colour over the disc.
  c.fillStyle = mix(t.skyLow[0], t.skyHigh[0], h);
  c.beginPath();
  c.arc(mx + 22, my - 10, 46, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
/**
 * A night zone's view down: ink clouds far below the tower from `top`,
 * with ink streaks drifting across the sky (more the higher), distant
 * spires on the horizon with a lantern lit here and there, and a few sky
 * lanterns floating up out of the clouds. Painted once per floor with the
 * sky (nothing moves).
 */
function paintNightBelow(
  c: Ctx,
  t: SpireZoneTheme,
  h: number,
  top: number,
  puff: (x: number, y: number, r: number, a: number) => void,
  floor: number,
) {
  const night = t.night!,
    S = SPIRE_SKY,
    bottom = S.y + S.h;
  reseed(9600 + floor);
  // Distant spires on the horizon (dark against the sky), a lit window or
  // two in each: only beyond the court's sides, where the sky shows.
  const spireCol = mix(mix(t.skyLow[0], t.skyHigh[0], h), "#000000", 0.35);
  for (let k = 0; k < 9; k++) {
    const x = S.x + 60 + R() * (S.w - 120);
    if (x > -60 && x < W + 60) continue;
    const w = 26 + R() * 34,
      tall = 120 + R() * 200,
      base = top + 60;
    c.fillStyle = spireCol;
    c.beginPath();
    c.moveTo(x - w / 2, base);
    c.lineTo(x - w / 2, base - tall);
    c.lineTo(x, base - tall - w * 1.4);
    c.lineTo(x + w / 2, base - tall);
    c.lineTo(x + w / 2, base);
    c.closePath();
    c.fill();
    for (let j = 0; j < 2; j++)
      if (R() < 0.7) {
        const wy = base - tall * (0.3 + R() * 0.6);
        const g = c.createRadialGradient(x, wy, 0, x, wy, 16);
        g.addColorStop(0, rgba(night.lantern[1], 0.85));
        g.addColorStop(1, rgba(night.lantern[1], 0));
        c.fillStyle = g;
        c.fillRect(x - 16, wy - 16, 32, 32);
      }
  }
  // The ink cloud sea, darker the higher the floor.
  const cloudCol = mix(t.cloud[0], t.cloud[1], h);
  for (let row = 0; row < 5; row++)
    for (let k = 0; k < 16; k++)
      puff(
        S.x + (k + R() * 0.8) * (S.w / 15),
        top + row * 90 + R() * 40,
        170 + R() * 110,
        0.6 + row * 0.08,
      );
  // Moonlit tops on the nearest row (so the ink reads as cloud).
  c.strokeStyle = `rgba(200,190,240,${0.16 * (1 - 0.4 * h)})`;
  c.lineWidth = 3;
  c.lineCap = "round";
  for (let k = 0; k < 14; k++) {
    const x = S.x + R() * S.w,
      y = top + 10 + R() * 40;
    c.beginPath();
    c.arc(x, y + 60, 90 + R() * 40, Math.PI * 1.15, Math.PI * 1.6);
    c.stroke();
  }
  // Ink streaks drifting across the sky: long dark wisps, more the higher.
  const streaks = Math.round(6 + 14 * h);
  for (let k = 0; k < streaks; k++) {
    const x = S.x + R() * S.w,
      y = S.y + 80 + R() * (top - S.y - 40),
      len = 260 + R() * 420,
      thick = 18 + R() * 26;
    const g = c.createLinearGradient(x, 0, x + len, 0);
    g.addColorStop(0, rgba(night.inkCloud, 0));
    g.addColorStop(0.4, rgba(night.inkCloud, 0.5 + 0.3 * h));
    g.addColorStop(1, rgba(night.inkCloud, 0));
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(x + len / 2, y, len / 2, thick / 2, -0.06, 0, Math.PI * 2);
    c.fill();
  }
  // A few sky lanterns rising out of the clouds (beyond the court).
  for (let k = 0; k < 7; k++) {
    const x = S.x + 80 + R() * (S.w - 160),
      y = top - 40 - R() * 380;
    if (x > -40 && x < W + 40 && y > -40 && y < H + 40) continue;
    const r = 3 + R() * 3;
    const g = c.createRadialGradient(x, y, 0, x, y, r * 5);
    g.addColorStop(0, rgba(night.lantern[0], 0.9));
    g.addColorStop(0.3, rgba(night.lantern[1], 0.45));
    g.addColorStop(1, rgba(night.lantern[1], 0));
    c.fillStyle = g;
    c.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
  }
  // Below the clouds, deep night.
  const g = c.createLinearGradient(0, top + 300, 0, bottom);
  g.addColorStop(0, rgba(cloudCol, 0));
  g.addColorStop(1, rgba(mix(cloudCol, "#000000", 0.5), 0.9));
  c.fillStyle = g;
  c.fillRect(S.x, top + 300, S.w, Math.max(0, bottom - top - 300));
}
/** A dream zone's moon: big, soft and full at the upper right, with a halo. */
function paintDreamMoon(c: Ctx, t: SpireZoneTheme, h: number) {
  const d = t.dream!,
    mx = 1880,
    my = -190,
    a = 0.85 + 0.15 * h;
  const glow = c.createRadialGradient(mx, my, 20, mx, my, 360);
  glow.addColorStop(0, rgba(d.moon, 0.42 * a));
  glow.addColorStop(0.45, rgba(d.cloud[1], 0.16 * a));
  glow.addColorStop(1, rgba(d.cloud[1], 0));
  c.fillStyle = glow;
  c.fillRect(mx - 360, my - 360, 720, 720);
  // Two faint halo rings.
  c.lineWidth = 3;
  for (const [rr, al] of [
    [118, 0.22],
    [176, 0.12],
  ] as const) {
    c.strokeStyle = rgba(d.moon, al * a);
    c.beginPath();
    c.arc(mx, my, rr, 0, Math.PI * 2);
    c.stroke();
  }
  const disc = c.createRadialGradient(mx - 20, my - 22, 6, mx, my, 72);
  disc.addColorStop(0, "#ffffff");
  disc.addColorStop(0.7, d.moon);
  disc.addColorStop(1, mix(d.moon, d.cloud[0], 0.5));
  c.globalAlpha = a;
  c.fillStyle = disc;
  c.beginPath();
  c.arc(mx, my, 72, 0, Math.PI * 2);
  c.fill();
  // Soft grey-violet seas on its face.
  c.fillStyle = rgba(d.cloud[1], 0.35);
  for (const [sx, sy, sr] of [
    [-22, -8, 18],
    [16, 18, 13],
    [24, -26, 9],
  ]) {
    c.beginPath();
    c.arc(mx + sx, my + sy, sr, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
}
/**
 * A dream zone's view down: a pastel cloud sea far below the tower from
 * `top`, its tops lit rose; dream clouds drifting through the sky beside
 * the court (rose tops over lavender) and a few big stars floating in the
 * air with a soft glow. Painted once per floor with the sky (nothing
 * moves).
 */
function paintDreamBelow(
  c: Ctx,
  t: SpireZoneTheme,
  h: number,
  top: number,
  puff: (x: number, y: number, r: number, a: number) => void,
  floor: number,
) {
  const d = t.dream!,
    S = SPIRE_SKY,
    bottom = S.y + S.h;
  reseed(9700 + floor);
  const soft = (x: number, y: number, r: number, a: number, col: string) => {
    const p = c.createRadialGradient(x, y - r * 0.2, r * 0.1, x, y, r);
    p.addColorStop(0, rgba(col, a));
    p.addColorStop(0.6, rgba(col, a * 0.7));
    p.addColorStop(1, rgba(col, 0));
    c.fillStyle = p;
    c.beginPath();
    c.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
    c.fill();
  };
  // Dream clouds drifting by (only where the sky shows beside the court).
  for (let k = 0; k < 9; k++) {
    const x = S.x + 80 + R() * (S.w - 160),
      y = S.y + 120 + R() * Math.max(80, top - S.y - 260),
      size = 70 + R() * 70;
    if (x > -size && x < W + size && y > -size * 0.6 && y < H + 40) continue;
    const a = 0.55 * (1 - 0.35 * h);
    for (let i = 0; i < 4; i++) {
      const ox = (i - 1.5) * size * 0.55,
        oy = -Math.sin((i / 3) * Math.PI) * size * 0.25;
      soft(x + ox, y + oy + size * 0.12, size * 0.8, a, d.cloud[1]);
      soft(x + ox, y + oy - size * 0.08, size * 0.6, a * 0.85, d.cloud[0]);
    }
  }
  // The cloud sea: lavender, its nearest tops lit rose.
  for (let row = 0; row < 5; row++)
    for (let k = 0; k < 16; k++)
      puff(
        S.x + (k + R() * 0.8) * (S.w / 15),
        top + row * 90 + R() * 40,
        170 + R() * 110,
        0.55 + row * 0.08,
      );
  for (let k = 0; k < 18; k++)
    soft(
      S.x + R() * S.w,
      top - 10 + R() * 50,
      110 + R() * 80,
      0.32 * (1 - 0.5 * h),
      d.cloud[0],
    );
  // Big stars floating in the air beside the court, each in a soft glow.
  for (let k = 0; k < 10; k++) {
    const x = S.x + 80 + R() * (S.w - 160),
      y = S.y + 80 + R() * (top - S.y),
      r = 7 + R() * 7;
    if (x > -40 && x < W + 40 && y > -40 && y < H + 40) continue;
    const g = c.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, rgba(d.star, 0.55));
    g.addColorStop(1, rgba(d.star, 0));
    c.fillStyle = g;
    c.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    c.fillStyle = mix(d.star, "#ffffff", 0.35);
    starPath(c, x, y, r, 5, 0.45);
    c.fill();
  }
  // Below the clouds, the night deepening into indigo.
  const cloudCol = mix(t.cloud[0], t.cloud[1], h);
  const g = c.createLinearGradient(0, top + 300, 0, bottom);
  g.addColorStop(0, rgba(cloudCol, 0));
  g.addColorStop(1, rgba(mix(cloudCol, "#120a3a", 0.5), 0.85));
  c.fillStyle = g;
  c.fillRect(S.x, top + 300, S.w, Math.max(0, bottom - top - 300));
}
/**
 * A light zone's sun: big and bright at the upper left, its rays fanning
 * out across the sky, in a wide halo; higher floors it sinks lower,
 * larger and warmer (a gold sunset).
 */
function paintRadiantSun(c: Ctx, t: SpireZoneTheme, h: number) {
  const d = t.radiant!,
    sx = -230,
    sy = -170 + h * 340,
    disc = mix(d.sun, "#ffb04a", h * 0.8),
    rr = 78 + 22 * h;
  // The rays: long soft wedges, fading out (the sky is only seen beyond
  // the court, so they show round its edges).
  reseed(9750);
  c.save();
  for (let k = 0; k < 16; k++) {
    const a = -0.5 + (k / 15) * 2.2 + (R() - 0.5) * 0.06,
      w = 0.025 + R() * 0.03,
      len = 1500 + R() * 900;
    const g = c.createRadialGradient(sx, sy, rr, sx, sy, len);
    g.addColorStop(0, rgba(disc, 0.2 * (1 - 0.3 * h)));
    g.addColorStop(1, rgba(disc, 0));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(sx, sy);
    c.lineTo(sx + Math.cos(a - w) * len, sy + Math.sin(a - w) * len);
    c.lineTo(sx + Math.cos(a + w) * len, sy + Math.sin(a + w) * len);
    c.closePath();
    c.fill();
  }
  c.restore();
  const glow = c.createRadialGradient(sx, sy, rr * 0.6, sx, sy, 560);
  glow.addColorStop(0, rgba(disc, 0.6));
  glow.addColorStop(0.4, rgba(disc, 0.22));
  glow.addColorStop(1, rgba(disc, 0));
  c.fillStyle = glow;
  c.fillRect(sx - 560, sy - 560, 1120, 1120);
  // A faint prismatic halo ring round it (the light split, high up).
  c.lineWidth = 5;
  d.prism.forEach((col, i) => {
    c.strokeStyle = rgba(col, 0.16 * (1 - 0.4 * h));
    c.beginPath();
    c.arc(sx, sy, 210 + i * 5, 0, Math.PI * 2);
    c.stroke();
  });
  const g = c.createRadialGradient(sx - rr * 0.2, sy - rr * 0.2, 4, sx, sy, rr);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.65, mix(disc, "#ffffff", 0.5));
  g.addColorStop(1, disc);
  c.fillStyle = g;
  c.beginPath();
  c.arc(sx, sy, rr, 0, Math.PI * 2);
  c.fill();
}
/**
 * A light zone's view down: a cloud sea far below the tower from `top`,
 * cream low down and peach at sunset, its clouds fringed with soft rainbow
 * light; prismatic clouds drifting through the sky beside the court and a
 * small rainbow arc at the right. Painted once per floor with the sky.
 */
function paintRadiantBelow(
  c: Ctx,
  t: SpireZoneTheme,
  h: number,
  top: number,
  puff: (x: number, y: number, r: number, a: number) => void,
  floor: number,
) {
  const d = t.radiant!,
    S = SPIRE_SKY,
    bottom = S.y + S.h;
  reseed(9760 + floor);
  const soft = (x: number, y: number, r: number, a: number, col: string) => {
    const p = c.createRadialGradient(x, y - r * 0.2, r * 0.1, x, y, r);
    p.addColorStop(0, rgba(col, a));
    p.addColorStop(0.6, rgba(col, a * 0.7));
    p.addColorStop(1, rgba(col, 0));
    c.fillStyle = p;
    c.beginPath();
    c.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
    c.fill();
  };
  const cloudCol = mix(t.cloud[0], t.cloud[1], h);
  // A small rainbow arc at the right, beyond the court.
  c.lineWidth = 16;
  d.prism.forEach((col, i) => {
    c.strokeStyle = rgba(col, 0.22 * (1 - 0.45 * h));
    c.beginPath();
    c.arc(1960, top + 140, 520 - i * 15, Math.PI * 1.08, Math.PI * 1.62);
    c.stroke();
  });
  // Prismatic clouds drifting by (only where the sky shows beside the
  // court): a rose fringe under, a sky-blue one over, the cream between.
  for (let k = 0; k < 9; k++) {
    const x = S.x + 80 + R() * (S.w - 160),
      y = S.y + 120 + R() * Math.max(80, top - S.y - 260),
      size = 70 + R() * 70;
    if (x > -size && x < W + size && y > -size * 0.6 && y < H + 40) continue;
    const a = 0.6 * (1 - 0.3 * h);
    for (let i = 0; i < 4; i++) {
      const ox = (i - 1.5) * size * 0.55,
        oy = -Math.sin((i / 3) * Math.PI) * size * 0.25;
      soft(x + ox, y + oy + size * 0.16, size * 0.78, a * 0.5, d.prism[0]);
      soft(x + ox, y + oy - size * 0.14, size * 0.7, a * 0.4, d.prism[4]);
      soft(x + ox, y + oy, size * 0.66, a, cloudCol);
    }
  }
  // The cloud sea, its nearest tops fringed in rainbow light.
  for (let row = 0; row < 5; row++)
    for (let k = 0; k < 16; k++)
      puff(
        S.x + (k + R() * 0.8) * (S.w / 15),
        top + row * 90 + R() * 40,
        170 + R() * 110,
        0.55 + row * 0.08,
      );
  for (let k = 0; k < 18; k++)
    soft(
      S.x + R() * S.w,
      top - 14 + R() * 50,
      100 + R() * 80,
      0.22 * (1 - 0.4 * h),
      d.prism[k % d.prism.length],
    );
  // Below the clouds, warm light deepening into amber.
  const g = c.createLinearGradient(0, top + 300, 0, bottom);
  g.addColorStop(0, rgba(cloudCol, 0));
  g.addColorStop(1, rgba(mix(cloudCol, "#8a4a22", 0.45), 0.85));
  c.fillStyle = g;
  c.fillRect(S.x, top + 300, S.w, Math.max(0, bottom - top - 300));
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
  c.fillStyle = tone(t, "rgba(255,255,240,0.7)");
  c.beginPath();
  c.moveTo(x - w * 0.3 + lean * 0.3, y - h * 0.6);
  c.lineTo(tip.x - 1, tip.y + 6);
  c.lineTo(x - w * 0.18 + lean * 0.25, y - h * 0.3);
  c.closePath();
  c.fill();
  // A light zone's prism: small rainbow facets across the shaded face.
  if (t.radiant) {
    const prism = t.radiant.prism;
    c.save();
    c.beginPath();
    c.moveTo(x + lean * 0.1, y + 2);
    c.lineTo(tip.x, tip.y);
    c.lineTo(x + w / 2 + lean * 0.3, y - h * 0.72);
    c.lineTo(x + w / 2, y);
    c.closePath();
    c.clip();
    const band = Math.max(1.4, h * 0.07);
    prism.forEach((col, i) => {
      const f = 0.3 + i * 0.09;
      c.fillStyle = rgba(col, 0.85);
      c.beginPath();
      c.moveTo(x - w, y - h * f + w * 0.5);
      c.lineTo(x + w, y - h * f - w * 0.3);
      c.lineTo(x + w, y - h * f - w * 0.3 + band);
      c.lineTo(x - w, y - h * f + w * 0.5 + band);
      c.closePath();
      c.fill();
    });
    c.restore();
  }
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
  const tips: [number, number, number][] = [];
  for (const { off, back } of spots) {
    const big = 1 - Math.abs(off) * 0.55;
    const cx = x + off * size * 0.55,
      cy = y + (back ? -4 : 3) + Math.abs(off) * 2,
      tall = size * (0.5 + 0.75 * big) * (0.85 + R() * 0.3),
      lean = off * size * 0.5;
    crystal(c, t, cx, cy, size * (0.34 + 0.12 * big), tall, lean);
    tips.push([cx + lean, cy - tall, tall]);
  }
  // A dream zone's crystals: a star twinkling at the tallest one's tip, a
  // small one on the next (painted once, a soft gold).
  if (t.dream) {
    tips.sort((a, b) => b[2] - a[2]);
    tips
      .slice(0, 2)
      .forEach(([sx, sy], i) => sparkle(c, t, sx, sy, i ? 4 : 6.5));
  }
  // A light zone's crystals: the light they split spills on the stone
  // beside them (a small rainbow fan, baked).
  if (t.radiant)
    for (let i = 0; i < 3; i++)
      rainbowFleck(
        c,
        t,
        x + size * (0.25 + i * 0.12),
        y + 3 + i * 2,
        size * (0.45 - i * 0.08),
        0.25 + i * 0.3,
        0.55,
        1.3,
      );
}
/** A dream zone's star on a crystal's tip: a soft gold glow and a bright four-point star. */
function sparkle(c: Ctx, t: SpireZoneTheme, x: number, y: number, r: number) {
  const d = t.dream!;
  const g = c.createRadialGradient(x, y, 0, x, y, r * 2.2);
  g.addColorStop(0, rgba(d.star, 0.6));
  g.addColorStop(1, rgba(d.star, 0));
  c.fillStyle = g;
  c.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  c.fillStyle = mix(d.star, "#ffffff", 0.5);
  starPath(c, x, y, r, 4, 0.3);
  c.fill();
}
/**
 * A dream zone's mark on a block's front: a gold crescent moon with a star
 * beside it, inlaid (a dark seat under the gold), where Earth carves a rune.
 */
function dreamMark(c: Ctx, t: SpireZoneTheme, x: number, y: number) {
  const d = t.dream!;
  c.fillStyle = rgba(t.carve, 0.7);
  crescentPath(c, x - 2.2, y + 1.2, 10);
  c.fill();
  starPath(c, x + 9.8, y - 4, 5.6, 4, 0.42);
  c.fill();
  c.fillStyle = d.star;
  crescentPath(c, x - 3, y, 9);
  c.fill();
  starPath(c, x + 9, y - 5, 4.6, 4, 0.38);
  c.fill();
}
/**
 * A light zone's mark on a block's front: a gold sun (a disc and eight
 * rays), inlaid over a dark seat, where Earth carves a rune.
 */
function sunMark(c: Ctx, t: SpireZoneTheme, x: number, y: number) {
  const d = t.radiant!;
  const sun = (dx: number, dy: number, r: number, col: string) => {
    c.fillStyle = col;
    c.beginPath();
    c.arc(x + dx, y + dy, r * 0.55, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      c.moveTo(
        x + dx + Math.cos(a - 0.28) * r * 0.6,
        y + dy + Math.sin(a - 0.28) * r * 0.6,
      );
      c.lineTo(
        x + dx + Math.cos(a) * r * 1.15,
        y + dy + Math.sin(a) * r * 1.15,
      );
      c.lineTo(
        x + dx + Math.cos(a + 0.28) * r * 0.6,
        y + dy + Math.sin(a + 0.28) * r * 0.6,
      );
    }
    c.fill();
  };
  sun(0.8, 1.2, 10.5, rgba(t.carve, 0.7));
  sun(0, 0, 9.5, d.gold);
  c.fillStyle = d.goldLight;
  c.beginPath();
  c.arc(x - 1.5, y - 1.5, 2.6, 0, Math.PI * 2);
  c.fill();
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
      c.fillStyle = tone(t, "rgba(255,244,220,0.25)");
      c.fillRect(sx + 1, y + r * ch + 1, sw - 2, 2);
      c.fillStyle = tone(t, "rgba(30,18,6,0.4)");
      c.fillRect(sx, y + r * ch + ch - 2, sw, 2);
      c.fillRect(sx + sw - 1.5, y + r * ch, 1.5, ch);
      cx = sx + sw;
    }
  }
  const ao = c.createLinearGradient(0, y, 0, y + h);
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(1, tone(t, "rgba(30,18,6,0.38)"));
  c.fillStyle = ao;
  c.fillRect(x, y, w, h);
}
/**
 * The height's dusk on stone already painted (and only on it: "source-atop"
 * keeps the piece's transparent pixels clear). Crystals are painted after
 * it, so they keep their own warm light on every floor. The atlas spot's
 * clip keeps the fill inside the piece.
 */
function duskStone(c: Ctx, t: SpireZoneTheme, h: number) {
  if (h <= 0) return;
  c.save();
  c.globalCompositeOperation = "source-atop";
  c.fillStyle = `rgba(${t.dusk ?? "34,24,72"},${0.36 * h})`;
  c.fillRect(-4000, -4000, 8000, 8000);
  c.restore();
}
/**
 * A water zone's high floors: bioluminescent specks on a block's front
 * face (painted after its dusk: they light themselves), more the higher.
 */
function bioSpecks(
  c: Ctx,
  t: SpireZoneTheme,
  x: number,
  y: number,
  w: number,
  hgt: number,
  h: number,
) {
  if (!t.sea || h < 0.3) return;
  const n = Math.round(4 + 10 * h),
    a = Math.min(1, (h - 0.3) / 0.5);
  for (let k = 0; k < n; k++) {
    const sx = x + 4 + R() * (w - 8),
      sy = y + hgt * (0.35 + R() * 0.6),
      r = 1.2 + R() * 1.6;
    const g = c.createRadialGradient(sx, sy, 0, sx, sy, r * 3);
    g.addColorStop(0, rgba(t.sea.bio, 0.9 * a));
    g.addColorStop(0.35, rgba(t.sea.bio, 0.5 * a));
    g.addColorStop(1, rgba(t.sea.bio, 0));
    c.fillStyle = g;
    c.fillRect(sx - r * 3, sy - r * 3, r * 6, r * 6);
  }
}
/**
 * A night zone's ink on a block (painted after its dusk): drips running
 * down the front face from the top edge, and a stain on the top face; more
 * and darker the higher the floor.
 */
function inkDrips(
  c: Ctx,
  t: SpireZoneTheme,
  x: number,
  top: number,
  front: number,
  w: number,
  h: number,
) {
  const night = t.night;
  if (!night) return;
  const n = Math.round(2 + 6 * h),
    a = 0.45 + 0.35 * h,
    ink = mix(night.veins, "#05030a", 0.55);
  c.save();
  c.fillStyle = rgba(ink, a);
  for (let k = 0; k < n; k++) {
    const dx = x + 6 + R() * (w - 12),
      len = 8 + R() * (14 + 22 * h),
      dw = 2 + R() * 3;
    c.beginPath();
    c.moveTo(dx - dw, front);
    c.lineTo(dx - dw * 0.6, front + len);
    c.arc(dx, front + len, dw * 0.6, Math.PI, 0, true);
    c.lineTo(dx + dw, front);
    c.closePath();
    c.fill();
  }
  // A pooled stain on the top slab.
  if (h > 0.2) {
    c.fillStyle = rgba(ink, 0.35 + 0.3 * h);
    ell(
      c,
      x + w * (0.25 + R() * 0.5),
      top + (front - top) * (0.25 + R() * 0.2),
      w * (0.1 + 0.08 * h),
      (front - top) * 0.08,
    );
    c.fill();
  }
  c.restore();
}
/**
 * A night zone's mark on a block (painted after its dusk: it lights
 * itself): a lantern hung on a pylon's or wall's front, candles at an
 * outcrop's foot.
 */
function nightMotif(
  c: Ctx,
  t: SpireZoneTheme,
  style: BlockStyle,
  x: number,
  top: number,
  front: number,
  w: number,
) {
  if (!t.night) return;
  if (style !== "outcrop") {
    // An iron bracket, then the lantern hanging from it.
    const lx = x + w / 2,
      ly = front + BLOCK_H * 0.86;
    c.strokeStyle = "#16121e";
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(lx, front + 3);
    c.lineTo(lx, ly - 22);
    c.stroke();
    lantern(c, t, lx, ly, 1.1);
    return;
  }
  // Candles on the outcrop's top, either side of its crystals.
  const depth = front - top;
  for (const [fx, tall] of [
    [0.18, 14],
    [0.27, 9],
    [0.8, 12],
  ] as const) {
    const cx = x + w * fx,
      cy = top + depth * 0.78;
    const g = c.createRadialGradient(
      cx,
      cy - tall - 4,
      1,
      cx,
      cy - tall - 4,
      16,
    );
    g.addColorStop(0, rgba(t.night.lantern[1], 0.6));
    g.addColorStop(1, rgba(t.night.lantern[1], 0));
    c.fillStyle = g;
    c.fillRect(cx - 16, cy - tall - 20, 32, 32);
    c.fillStyle = "#efe6d4";
    c.fillRect(cx - 3, cy - tall, 6, tall);
    c.fillStyle = tone(t, "rgba(30,18,6,0.35)");
    c.fillRect(cx + 1, cy - tall, 2, tall);
    c.fillStyle = t.night.lantern[1];
    c.beginPath();
    c.ellipse(cx, cy - tall - 4, 2.2, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#fffdf2";
    c.beginPath();
    c.ellipse(cx, cy - tall - 3, 1, 2, 0, 0, Math.PI * 2);
    c.fill();
  }
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
    c.fillStyle = tone(t, "rgba(255,248,230,0.45)");
    c.fillRect(x + 10, top + 1, w - 20, 2.5);
    if (t.dream) dreamMark(c, t, x + w / 2, front + BLOCK_H * 0.45);
    if (t.radiant) sunMark(c, t, x + w / 2, front + BLOCK_H * 0.45);
    duskStone(c, t, h);
    bioSpecks(c, t, x, front, w, BLOCK_H, h);
    inkDrips(c, t, x, top, front, w, h);
    nightMotif(c, t, style, x, top, front, w);
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
  c.fillStyle = tone(t, "rgba(255,250,236,0.55)");
  c.fillRect(x, top, w, 3);
  c.fillRect(x, top, 3, depth);
  c.fillStyle = tone(t, "rgba(40,24,10,0.35)");
  c.fillRect(x + w - 3, top, 3, depth);
  c.fillStyle = mix(t.top[0], "#ffffff", 0.2);
  c.fillRect(x, front - 2, w, 3);
  c.fillStyle = tone(t, "rgba(30,18,6,0.4)");
  c.fillRect(x, front + 1, w, 2);
  // A rune on the front, inlaid with the zone's crystal (a night zone
  // hangs a lantern there instead, a dream zone inlays a crescent).
  if (t.dream) dreamMark(c, t, x + w / 2, front + BLOCK_H / 2);
  else if (t.radiant) sunMark(c, t, x + w / 2, front + BLOCK_H / 2);
  else if (!t.night) {
    c.save();
    c.lineCap = "round";
    c.strokeStyle = rgba(t.carve, 0.7);
    c.lineWidth = 3;
    rune(c, x + w / 2 + 0.8, front + BLOCK_H / 2 + 0.8, 9, seed);
    c.strokeStyle = t.crystal[1];
    c.lineWidth = 1.8;
    rune(c, x + w / 2, front + BLOCK_H / 2, 9, seed);
    c.restore();
  }
  duskStone(c, t, h);
  bioSpecks(c, t, x, front, w, BLOCK_H, h);
  inkDrips(c, t, x, top, front, w, h);
  nightMotif(c, t, style, x, top, front, w);
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
function paintShadow(c: Ctx, t: SpireZoneTheme, foot: Rect, k: number) {
  const o = stoneBase(foot);
  const dx = SUNV.x * BLOCK_H,
    dy = SUNV.y * BLOCK_H;
  // Solid shape drawn far off to the left, its blurred shadow cast back in
  // place (canvas shadows are in device pixels: the atlas scale is k).
  const off = 4000;
  c.save();
  c.shadowColor = tone(t, "rgba(30,18,6,0.4)");
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
  g.addColorStop(0, tone(t, "rgba(30,18,6,0.45)"));
  g.addColorStop(1, tone(t, "rgba(30,18,6,0)"));
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
    c.fillStyle = tone(t, "rgba(255,250,236,0.5)");
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
    c.fillStyle = tone(t, "rgba(30,18,6,0.35)");
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
    c.fillStyle = tone(t, "rgba(30,18,6,0.3)");
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
  c.strokeStyle = tone(t, "rgba(255,250,236,0.55)");
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
  duskStone(c, t, h);
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
/**
 * Where to draw `text` so its ink (not its em box) is centred on (0, 0).
 * A "middle" baseline centres the em box, and Georgia's old-style digits
 * sit low or high in it ("7" drops below the line, "6" climbs): the number
 * sat off the ring's centre, by a different amount on every floor and font.
 * The glyphs' measured bounds put it in the middle whatever the font
 * (without them: a lining digit's cap height, centred).
 */
export function spireNumberOffset(
  m: Pick<TextMetrics, "width"> & Partial<TextMetrics>,
  size: number,
) {
  const left = m.actualBoundingBoxLeft,
    right = m.actualBoundingBoxRight,
    ascent = m.actualBoundingBoxAscent,
    descent = m.actualBoundingBoxDescent;
  const ok = (v: number | undefined): v is number => Number.isFinite(v);
  return {
    x: ok(left) && ok(right) ? (left - right) / 2 : 0,
    y: ok(ascent) && ok(descent) ? (ascent - descent) / 2 : size * 0.35,
  };
}
function paintNumber(c: Ctx, t: SpireZoneTheme, floor: number, k: number) {
  const { x, y } = SPIRE_RING;
  const text = String(floor);
  const size = text.length > 1 ? 104 : 118;
  c.save();
  // The ring's centre (the ground plane squashes it by K).
  c.translate(x, y);
  c.scale(1, K);
  c.font = `700 ${size}px Georgia, "Times New Roman", serif`;
  c.textAlign = "center";
  c.textBaseline = "alphabetic";
  c.lineJoin = "round";
  // Centre the number's ink, then the carving's layers round it.
  const o = spireNumberOffset(c.measureText(text), size);
  c.translate(o.x, o.y);
  // A faint glow round it (under the groove, so the groove stays dark).
  c.save();
  c.shadowColor = rgba(t.crystal[1], 0.75);
  c.shadowBlur = 14 * k;
  c.strokeStyle = rgba(t.crystal[1], 0.5);
  c.lineWidth = 9;
  c.strokeText(text, 0, 0);
  c.restore();
  // The light lip on the groove's lower-right edge.
  c.fillStyle = tone(t, "rgba(255,248,230,0.9)");
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
        paint: (c) => paintShadow(c, t, foot, k),
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
      paint: (c) => paintShadow(c, t, SPIRE_STAIRS, k),
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

// ──────────────────────── The summit (floor 20) ────────────────────────

/**
 * Floor 20 keeps Tidelotl's lagoon court; painted over it once, a summit
 * grade of its own: a deep night sea (cool and dim, abyssal blue pressing
 * in from the edges) under a moon at the upper right, its light rippling
 * across the water. Warnings are drawn live on top, so they keep their
 * colours.
 */
export function paintLagoonSummitGrade(c: Ctx) {
  c.save();
  c.globalCompositeOperation = "multiply";
  c.fillStyle = "#6a86b4";
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = "source-over";
  const v = c.createRadialGradient(
    W / 2,
    H / 2,
    H * 0.32,
    W / 2,
    H / 2,
    H * 1.02,
  );
  v.addColorStop(0, "rgba(2,12,34,0)");
  v.addColorStop(1, "rgba(2,12,34,0.58)");
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
  // Moonlight from the upper right, and its path rippling across the court.
  c.globalCompositeOperation = "screen";
  const m = c.createRadialGradient(W, 0, 40, W, 0, 950);
  m.addColorStop(0, "rgba(160,205,255,0.26)");
  m.addColorStop(1, "rgba(160,205,255,0)");
  c.fillStyle = m;
  c.fillRect(0, 0, W, H);
  reseed(20801);
  c.strokeStyle = "rgba(190,225,255,0.10)";
  c.lineCap = "round";
  for (let k = 0; k < 46; k++) {
    // Along the diagonal from the moon toward the lower left.
    const d = R(),
      x = W - d * W * 0.9 + (R() - 0.5) * 260,
      y = d * H * 0.9 + (R() - 0.5) * 120;
    c.lineWidth = 2 + R() * 2;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 26 + R() * 40, y + (R() - 0.5) * 3);
    c.stroke();
  }
  c.restore();
}

// ──────────────────────── The summit (floor 30) ────────────────────────

/**
 * Floor 30 keeps Inkpurr's Lantern Yard; painted over it once, a summit
 * grade of its own: a deeper, violet midnight (a soft multiply), ink
 * creeping in from the edges and a cold moon at the upper left. The middle
 * of the yard, where the lanterns' light falls, stays nearly as bright as
 * the raid's own picture, so its dark ink warnings (hands, the pulse band,
 * blobs) still read; the lanterns, their light and the night closing in are
 * drawn live on top, as in the raid. No warm light is baked in (a snuffed
 * lantern must look dark).
 */
export function paintLanternSummitGrade(c: Ctx) {
  c.save();
  c.globalCompositeOperation = "multiply";
  c.fillStyle = "#d8d0f4";
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = "source-over";
  const v = c.createRadialGradient(
    W / 2,
    H / 2,
    H * 0.5,
    W / 2,
    H / 2,
    H * 1.05,
  );
  v.addColorStop(0, "rgba(10,4,26,0)");
  v.addColorStop(1, "rgba(10,4,26,0.62)");
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
  // Ink creeping in along the edges: soft dark tongues, never past the
  // edge band (the lanterns stand well inside it).
  reseed(30801);
  for (let k = 0; k < 34; k++) {
    const side = k % 4,
      along = R(),
      reach = 40 + R() * 70,
      wide = 40 + R() * 70;
    const x =
        side === 0 ? along * W : side === 1 ? W : side === 2 ? along * W : 0,
      y = side === 0 ? 0 : side === 1 ? along * H : side === 2 ? H : along * H;
    const g = c.createRadialGradient(x, y, 0, x, y, Math.max(reach, wide));
    g.addColorStop(0, "rgba(14,6,34,0.5)");
    g.addColorStop(1, "rgba(14,6,34,0)");
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(
      x,
      y,
      side % 2 ? reach : wide,
      side % 2 ? wide : reach,
      0,
      0,
      Math.PI * 2,
    );
    c.fill();
  }
  // Thin violet ink veins in the edge band.
  c.strokeStyle = "rgba(138,63,192,0.32)";
  c.lineWidth = 2;
  c.lineCap = "round";
  for (let k = 0; k < 16; k++) {
    const side = k % 4,
      along = 0.08 + R() * 0.84;
    let x = side === 1 ? W : side === 3 ? 0 : along * W,
      y = side === 0 ? 0 : side === 2 ? H : along * H;
    const ix = side === 1 ? -1 : side === 3 ? 1 : 0,
      iy = side === 0 ? 1 : side === 2 ? -1 : 0;
    c.beginPath();
    c.moveTo(x, y);
    for (let i = 0; i < 5; i++) {
      x += ix * (10 + R() * 12) + (R() - 0.5) * 16;
      y += iy * (8 + R() * 10) + (R() - 0.5) * 16;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  // A cold moon at the upper left.
  c.globalCompositeOperation = "screen";
  const m = c.createRadialGradient(0, 0, 40, 0, 0, 900);
  m.addColorStop(0, "rgba(186,172,255,0.2)");
  m.addColorStop(1, "rgba(186,172,255,0)");
  c.fillStyle = m;
  c.fillRect(0, 0, W, H);
  c.restore();
}

// ──────────────────────── The summit (floor 40) ────────────────────────

/**
 * Floor 40 keeps Snoozaku's Cloud Deck; painted over it once, a summit
 * grade of its own: a deep twilight (a soft periwinkle multiply), indigo
 * night pressing in from the edges, dream clouds banked along the deck's
 * rim with a few gold stars in them, and the big moon's light from the
 * upper right. The middle, where the rune pads, the constellation ring
 * and every warning are, keeps nearly the raid's own light; the pads, their
 * glyphs and the Dream Tide's rings are drawn live on top, so they keep
 * their colours (and its pale rings gain against the deeper floor).
 */
export function paintDreamSummitGrade(c: Ctx) {
  c.save();
  c.globalCompositeOperation = "multiply";
  c.fillStyle = "#d0ccf4";
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = "source-over";
  const v = c.createRadialGradient(
    W / 2,
    H / 2,
    H * 0.46,
    W / 2,
    H / 2,
    H * 1.05,
  );
  v.addColorStop(0, "rgba(14,10,52,0)");
  v.addColorStop(1, "rgba(14,10,52,0.6)");
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
  // Dream clouds banked along the rim (never past the edge band: the pads
  // and their rings stand well inside it): lavender, their tops rose.
  reseed(40801);
  const soft = (x: number, y: number, r: number, col: string, a: number) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(0.6, `rgba(${col},${a * 0.6})`);
    g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
    c.fill();
  };
  for (let k = 0; k < 30; k++) {
    const side = k % 4,
      along = R(),
      r = 50 + R() * 40;
    const x =
        side === 0
          ? along * W
          : side === 1
            ? W + 6
            : side === 2
              ? along * W
              : -6,
      y =
        side === 0
          ? -6
          : side === 1
            ? along * H
            : side === 2
              ? H + 6
              : along * H;
    soft(x, y, r, "150,136,214", 0.5);
    soft(x, y - r * 0.2, r * 0.7, "255,214,238", 0.32);
  }
  // A few gold stars in the clouds.
  for (let k = 0; k < 12; k++) {
    const side = k % 4,
      along = 0.06 + R() * 0.88,
      inset = 10 + R() * 26,
      s = 3 + R() * 3;
    const x = side === 1 ? W - inset : side === 3 ? inset : along * W,
      y = side === 0 ? inset : side === 2 ? H - inset : along * H;
    c.fillStyle = "rgba(255,226,140,0.85)";
    starPath(c, x, y, s, 4, 0.36);
    c.fill();
  }
  // The moon's light from the upper right.
  c.globalCompositeOperation = "screen";
  const m = c.createRadialGradient(W, 0, 40, W, 0, 900);
  m.addColorStop(0, "rgba(255,240,226,0.18)");
  m.addColorStop(1, "rgba(255,240,226,0)");
  c.fillStyle = m;
  c.fillRect(0, 0, W, H);
  c.restore();
}

// ──────────────────────── The summit (floor 50) ────────────────────────

/**
 * Floor 50 keeps Prismell's Sun Atrium; painted over it once, a summit
 * grade of its own: the sanctum at golden hour. A soft pale-gold multiply
 * (the pale marble turns champagne, so the relay's gold and cyan beams,
 * the skylight's cream ring and the chimes stand brighter than the floor
 * under them; red and green stay level, so the scramble's pink keeps its
 * distance), a warm umber dusk pressing in from the edges, prism light
 * glinting in rainbow flecks along the rim, and the low sun's warmth from
 * the upper left. The middle, where the mirrors, the relay and every
 * warning are, keeps most of the raid's own light; the mirrors, beams and
 * shield are drawn live on top, so they keep their colours.
 */
export function paintRadiantSummitGrade(c: Ctx) {
  c.save();
  c.globalCompositeOperation = "multiply";
  c.fillStyle = "#e9e9cc";
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = "source-over";
  const v = c.createRadialGradient(
    W / 2,
    H / 2,
    H * 0.46,
    W / 2,
    H / 2,
    H * 1.05,
  );
  v.addColorStop(0, "rgba(54,32,26,0)");
  v.addColorStop(1, "rgba(54,32,26,0.55)");
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
  // Prism light along the rim (never past the edge band: the mirrors and
  // the skylight's ring stand well inside it): small rainbow flecks.
  reseed(50801);
  const prism = ["#ff8fa8", "#ffbe5c", "#fff07a", "#8ef0a8", "#78d6ff"];
  c.lineCap = "round";
  for (let k = 0; k < 28; k++) {
    const side = k % 4,
      along = 0.05 + R() * 0.9,
      inset = 12 + R() * 22,
      len = 14 + R() * 16,
      a = (R() - 0.5) * 0.8 + (side % 2 ? Math.PI / 2 : 0);
    const x = side === 1 ? W - inset : side === 3 ? inset : along * W,
      y = side === 0 ? inset : side === 2 ? H - inset : along * H;
    const nx = -Math.sin(a) * 2,
      ny = Math.cos(a) * 2;
    c.lineWidth = 2.2;
    prism.forEach((col, i) => {
      const o = i - 2;
      c.strokeStyle = rgba(col, 0.42);
      c.beginPath();
      c.moveTo(x + nx * o, y + ny * o);
      c.lineTo(x + nx * o + Math.cos(a) * len, y + ny * o + Math.sin(a) * len);
      c.stroke();
    });
  }
  // The low sun's warmth from the upper left.
  c.globalCompositeOperation = "screen";
  const m = c.createRadialGradient(0, 0, 40, 0, 0, 950);
  m.addColorStop(0, "rgba(255,236,186,0.16)");
  m.addColorStop(1, "rgba(255,236,186,0)");
  c.fillStyle = m;
  c.fillRect(0, 0, W, H);
  c.restore();
}
