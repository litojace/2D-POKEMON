/*
 * The land round the Elemental Farm: what stands where, and the rules that
 * keep it right. Pure data and geometry (no drawing; farm-surround.ts draws
 * it), so the tests check the rules against the very list the farm draws.
 *
 * Every bit of ground the camera can show is dressed (the camera never
 * shows past WORLD, and zooms out only a little past the farm's fit,
 * zoomMin): to the north the country road to the Plaza with a tractor on
 * it, a dry-stone wall and a neighbour's wheat; to the west the edge of a
 * wood, beehives in a wildflower patch, a woodpile; to the south a brook
 * the path from the field's gate crosses on a footbridge; to the east a
 * mown hay meadow with round bales and a hay cart, and a sunflower field.
 *
 * One scale for everything (farm-layout.ts): a person 80 px, things people
 * use at 55 px a metre, buildings and trees at half that.
 *
 * What is drawn where is worked out, not guessed:
 *  - a prop that never stands in front of anything drawn live (an animal,
 *    a visitor, the tractor, a decoration, a tree that sways) is baked into
 *    the ground picture once; any other prop is drawn live, in depth order
 *    (coversLive);
 *  - nothing stands on a path, the road, the brook or another prop's
 *    footprint, and nothing tall stands in front of a place you tap
 *    (hidesPlace);
 *  - the tractor's road and the ducks' stretch of the brook are clear.
 */
import {
  BIG_PX_PER_M,
  BOARDP,
  BAKERY,
  BARN,
  COOP,
  DOGH,
  FCX,
  FR,
  MILL,
  PAST,
  POND,
  PX_PER_M,
  STALL,
  WELL,
  WH,
  WORLD,
  WW,
  onPath,
  roadY,
  type Rect,
} from "./farm-layout";
import { depthKey, screenBox, type Box, type Drawable } from "./farm-depth";

export type PropKind =
  | "tree"
  | "bush"
  | "rock"
  | "bale"
  | "hive"
  | "woodpile"
  | "stump"
  | "wall"
  | "sunrow"
  | "reeds"
  | "mailbox"
  | "cart"
  | "flowers";

export interface Prop {
  id: string;
  kind: PropKind;
  /** The foot (world px): the middle of the footprint's front edge. */
  x: number;
  y: number;
  /** Footprint: half width, depth (behind the foot). */
  w: number;
  d: number;
  /** Picture height (world px) and half width when wider than the footprint. */
  h: number;
  sw: number;
  /** Size factor (trees, bushes, rocks), seed, variant, mirrored. */
  s: number;
  seed: number;
  v: string;
  flip: boolean;
  /** Length along x (a wall's run, a row of sunflowers). */
  len?: number;
}

/* ───────────── sizes ───────────── */

/**
 * Real sizes (metres) of the things that stand round the farm, and their
 * class: "prop" things people use, drawn at PX_PER_M, "big" trees and
 * buildings at BIG_PX_PER_M. The tests measure the drawn pictures against
 * these.
 */
export const SIZES: Record<
  string,
  { m: number; cls: "prop" | "big"; wide: number }
> = {
  // A grown tree is 6–7 m (a 1.0 tree's picture is 183 px).
  tree: { m: 6.7, cls: "big", wide: 6 },
  bale: { m: 1.2, cls: "prop", wide: 1.5 },
  hive: { m: 0.8, cls: "prop", wide: 0.55 },
  woodpile: { m: 1.0, cls: "prop", wide: 2.2 },
  stump: { m: 0.45, cls: "prop", wide: 0.6 },
  wall: { m: 0.8, cls: "prop", wide: 0 },
  sunrow: { m: 1.8, cls: "prop", wide: 0 },
  reeds: { m: 1.0, cls: "prop", wide: 0.8 },
  mailbox: { m: 1.2, cls: "prop", wide: 0.5 },
  cart: { m: 1.6, cls: "prop", wide: 2.8 },
  tractor: { m: 2.3, cls: "prop", wide: 3.2 },
  person: { m: 1.45, cls: "prop", wide: 0.6 },
};
/** A kind's height on screen (px) at size factor s. */
export const heightPx = (kind: string, s = 1) => {
  const z = SIZES[kind];
  return z.m * (z.cls === "big" ? BIG_PX_PER_M : PX_PER_M) * s;
};
export const widthPx = (kind: string, s = 1) => {
  const z = SIZES[kind];
  return z.wide * (z.cls === "big" ? BIG_PX_PER_M : PX_PER_M) * s;
};

/* ───────────── the brook ───────────── */

/** The brook along the bottom of the world: its middle line and half width. */
export const BROOK = {
  half: 30,
  x0: WORLD.x0 - 40,
  x1: WORLD.x1 + 40,
};
export const brookY = (x: number) =>
  1192 + Math.sin(x / 260) * 12 + Math.sin(x / 97 + 1) * 4;
/** The footbridge where the path from the gate crosses the brook. */
export const BRIDGE: Rect = {
  x0: FCX - 40,
  x1: FCX + 40,
  y0: brookY(FCX) - BROOK.half - 16,
  y1: brookY(FCX) + BROOK.half + 14,
};
/** Whether (x, y) is in the brook's water (with `m` px of bank). */
export const inBrook = (x: number, y: number, m = 0) =>
  Math.abs(y - brookY(x)) < BROOK.half + m;

/* ───────────── the fields round the farm (flat, baked) ───────────── */

export interface Field extends Rect {
  kind: "wheat" | "mown" | "meadow" | "woodland" | "flowers" | "sunsoil";
}
export const FIELDS: Field[] = [
  // Beyond the wall to the north: the neighbour's wheat.
  { kind: "wheat", x0: WORLD.x0, x1: WORLD.x1, y0: WORLD.y0, y1: -134 },
  // The wood's floor to the west, and the wildflowers round the hives.
  { kind: "woodland", x0: WORLD.x0, x1: -150, y0: -30, y1: 1150 },
  { kind: "flowers", x0: -250, x1: -50, y0: 560, y1: 740 },
  // The hay meadow and the sunflowers to the east.
  { kind: "mown", x0: 1930, x1: WORLD.x1, y0: 10, y1: 560 },
  { kind: "sunsoil", x0: 1935, x1: WORLD.x1, y0: 700, y1: 1020 },
  // Wildflowers on the far bank of the brook.
  { kind: "meadow", x0: WORLD.x0, x1: WORLD.x1, y0: 1228, y1: WORLD.y1 },
];

/* ───────────── what stands round the farm ───────────── */

const seeded = (s: number) => {
  let x = Math.max(1, Math.floor(s) % 2147483646);
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
};
/** The farm itself, where its animals walk and decorations stand. */
export const FARM_AREA: Rect = { x0: -40, x1: WW + 40, y0: -10, y1: WH + 20 };

function make(
  kind: PropKind,
  id: string,
  x: number,
  y: number,
  s = 1,
  seed = 1,
  v = "",
  flip = false,
  len?: number,
): Prop {
  let w = 10,
    d = 8,
    h = 20,
    sw = 0;
  switch (kind) {
    case "tree": {
      const pine = v === "pine";
      h = 183 * s;
      sw = (pine ? 52 : 84) * s;
      w = 13 * s;
      d = 10;
      break;
    }
    case "bush":
      // s is the bush's width in px (GFX.bush).
      h = 0.65 * s;
      sw = s / 2 + 6;
      w = s / 2 - 4;
      d = 12;
      break;
    case "rock":
      h = 0.6 * s;
      sw = s / 2 + 3;
      w = s / 2;
      d = 0.4 * s;
      break;
    case "flowers":
      h = 18;
      sw = 22;
      w = 18;
      d = 10;
      break;
    case "wall":
      h = heightPx("wall");
      w = (len ?? 120) / 2;
      d = 14;
      break;
    case "sunrow":
      h = heightPx("sunrow") + 14;
      w = (len ?? 160) / 2;
      d = 18;
      break;
    default: {
      h = heightPx(kind, s);
      w = widthPx(kind, s) / 2;
      d = kind === "woodpile" ? 30 : kind === "cart" ? 34 : Math.min(26, w);
      sw = w + 6;
    }
  }
  return {
    id,
    kind,
    x,
    y,
    w,
    d,
    h,
    sw: Math.max(sw, w),
    s,
    seed,
    v,
    flip,
    len,
  };
}
/** A prop's footprint. */
export const foot = (p: Prop): Rect => ({
  x0: p.x - p.w,
  x1: p.x + p.w,
  y0: p.y - p.d,
  y1: p.y,
});
/** A prop as the depth sort sees it. */
export const propDrawable = (
  p: Prop,
  draw: () => void = () => {},
): Drawable => ({
  ...foot(p),
  h: p.h,
  sw: p.sw,
  draw,
});
const overlap = (a: Rect, b: Rect, m = 0) =>
  a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;
/** Whether a footprint touches the brook (bank included) or the footbridge. */
export function inWater(r: Rect, m = 6) {
  if (overlap(r, BRIDGE, m)) return true;
  for (let i = 0; i <= 8; i++) {
    const x = r.x0 + ((r.x1 - r.x0) * i) / 8;
    const y = brookY(x);
    if (r.y1 > y - BROOK.half - m && r.y0 < y + BROOK.half + m) return true;
  }
  const o = POND;
  const cx = Math.min(Math.max(o.x, r.x0), r.x1),
    cy = Math.min(Math.max(o.y, r.y0), r.y1);
  return ((cx - o.x) / (o.rx + 30)) ** 2 + ((cy - o.y) / (o.ry + 24)) ** 2 < 1;
}
/** Whether a footprint touches a path or the road (with `m` px of verge). */
export function onAnyPath(r: Rect, m = 6) {
  const n = 5;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= 2; j++)
      if (
        onPath(
          r.x0 + ((r.x1 - r.x0) * i) / n,
          r.y0 + ((r.y1 - r.y0) * j) / 2,
          m,
        )
      )
        return true;
  return false;
}

/* ───────────── the places you tap (nothing tall hides them) ───────────── */

/** Each place's picture on screen (world px). */
export const PLACES: { name: string; box: Box; y1: number }[] = [
  {
    name: "bakery",
    box: {
      x0: BAKERY.x - 122,
      x1: BAKERY.x + 122,
      y0: BAKERY.y - 152,
      y1: BAKERY.y,
    },
    y1: BAKERY.y,
  },
  {
    name: "mill",
    box: { x0: MILL.x - 52, x1: MILL.x + 52, y0: MILL.y - 230, y1: MILL.y },
    y1: MILL.y,
  },
  {
    name: "board",
    box: {
      x0: BOARDP.x - 75,
      x1: BOARDP.x + 75,
      y0: BOARDP.y - 140,
      y1: BOARDP.y,
    },
    y1: BOARDP.y,
  },
  {
    name: "market",
    box: { x0: STALL.x - 97, x1: STALL.x + 97, y0: STALL.y - 152, y1: STALL.y },
    y1: STALL.y,
  },
  {
    name: "barn",
    box: { x0: BARN.x - 123, x1: BARN.x + 123, y0: BARN.y - 199, y1: BARN.y },
    y1: BARN.y,
  },
  {
    name: "well",
    box: { x0: WELL.x - 51, x1: WELL.x + 51, y0: WELL.y - 130, y1: WELL.y },
    y1: WELL.y,
  },
  {
    name: "doghouse",
    box: { x0: DOGH.x - 60, x1: DOGH.x + 60, y0: DOGH.y - 90, y1: DOGH.y },
    y1: DOGH.y,
  },
  {
    name: "coop",
    box: { x0: COOP.x0, x1: COOP.x1, y0: COOP.y1 - 230, y1: COOP.y1 },
    y1: COOP.y1,
  },
  {
    name: "field",
    box: { x0: FR.x0, x1: FR.x1, y0: FR.y0 - 30, y1: FR.y1 },
    y1: FR.y1,
  },
  {
    name: "pasture",
    box: { x0: PAST.x0, x1: PAST.x1, y0: PAST.y0 - 30, y1: PAST.y1 },
    y1: PAST.y1,
  },
];
/** Whether a prop stands in front of a place and its picture covers part of it. */
export function hidesPlace(p: Prop) {
  const b = screenBox(propDrawable(p));
  return PLACES.some(
    (q) =>
      p.y > q.y1 &&
      b.x0 < q.box.x1 &&
      q.box.x0 < b.x1 &&
      b.y0 < q.box.y1 &&
      q.box.y0 < b.y1,
  );
}

/* ───────────── the list ───────────── */

function build(): Prop[] {
  const out: Prop[] = [];
  const fits = (p: Prop, gap: number) => {
    const f = foot(p);
    if (overlap(f, FARM_AREA)) return false;
    if (
      overlap(f, {
        x0: PAST.x0 - 40,
        x1: PAST.x1 + 44,
        y0: PAST.y0 - 40,
        y1: PAST.y1 + 30,
      })
    )
      return false;
    if (f.x1 < WORLD.x0 + 8 || f.x0 > WORLD.x1 - 8) return false;
    if (onAnyPath(f) || inWater(f)) return false;
    if (hidesPlace(p)) return false;
    return out.every((o) => !overlap(f, foot(o), gap));
  };
  const add = (p: Prop, gap = 4) => {
    if (fits(p, gap)) out.push(p);
    return out;
  };
  /* North: the dry-stone wall beyond the road, the neighbour's trees. */
  for (let x = WORLD.x0, i = 0; x < WORLD.x1; x += 140, i++)
    out.push(make("wall", `wall${i}`, x + 70, -120, 1, 10 + i, "", false, 140));
  {
    const r = seeded(17);
    for (let x = WORLD.x0 + 40, i = 0; x < WORLD.x1; x += 150 + r() * 90, i++)
      add(
        make(
          "tree",
          `nt${i}`,
          x,
          -142 + r() * 6,
          0.7 + r() * 0.25,
          500 + i,
          ["round", "pine", "autumn", "round", "mint"][i % 5],
        ),
        30,
      );
  }
  // On the near side of the road: the mailbox at the drive, low bushes.
  out.push(make("mailbox", "mailbox", 236, -10, 1, 1));
  {
    const r = seeded(29);
    let i = 0;
    for (const x of [
      -300, -190, 60, 420, 620, 1010, 1180, 1520, 1700, 1990, 2080,
    ])
      add(
        make(
          "bush",
          `nb${i}`,
          x + (r() - 0.5) * 30,
          -14,
          44 + r() * 14,
          700 + i++,
          ["green", "flower", "rose", "mint"][i % 4],
        ),
        6,
      );
  }
  /* West: the wood's edge, hives in a wildflower patch, a woodpile. */
  out.push(
    make("hive", "hive0", -200, 650, 1, 1),
    make("hive", "hive1", -140, 664, 1, 2),
    make("hive", "hive2", -80, 650, 1, 3),
    make("woodpile", "woodpile", -150, 340, 1, 1),
    make("stump", "stump", -64, 356, 1, 1),
  );
  {
    const r = seeded(41);
    const kinds = [
      "pine",
      "round",
      "pine",
      "mint",
      "round",
      "pine",
      "autumn",
      "apple",
    ];
    for (let k = 0, i = 0; k < 2400 && i < 30; k++) {
      const x = WORLD.x0 + 10 + r() * 290,
        y = -10 + r() * 1160,
        deep = x < -200;
      if (!deep && r() < 0.55) continue;
      const before = out.length;
      add(
        make(
          "tree",
          `wt${i}`,
          x,
          y,
          0.72 + r() * 0.35,
          900 + k,
          kinds[i % kinds.length],
          r() < 0.5,
        ),
        deep ? 70 : 90,
      );
      if (out.length > before) i++;
    }
  }
  /* South: reeds on both banks, bushes and rocks, trees on the far bank. */
  {
    const r = seeded(53);
    let i = 0;
    for (let x = WORLD.x0 + 30; x < WORLD.x1; x += 70 + r() * 80) {
      add(
        make(
          "reeds",
          `rn${i}`,
          x,
          brookY(x) - BROOK.half - 8,
          // Low on the near bank: never over the farm's edge.
          0.62 + r() * 0.18,
          1100 + i,
          "",
          r() < 0.5,
        ),
        8,
      );
      i++;
      add(
        make(
          "reeds",
          `rf${i}`,
          x + 30,
          brookY(x + 30) + BROOK.half + 30,
          0.9 + r() * 0.3,
          1100 + i,
          "",
          r() < 0.5,
        ),
        8,
      );
      i++;
    }
    for (let k = 0, n = 0; k < 600 && n < 9; k++) {
      const x = WORLD.x0 + 60 + r() * (WORLD.x1 - WORLD.x0 - 120);
      if (Math.abs(x - FCX) < 170) continue;
      const before = out.length;
      add(
        make(
          "tree",
          `st${n}`,
          x,
          1262 + r() * 14,
          0.72 + r() * 0.16,
          1300 + k,
          ["round", "cherry", "mint", "round", "autumn"][n % 5],
          r() < 0.5,
        ),
        120,
      );
      if (out.length > before) n++;
    }
    for (let k = 0, n = 0; k < 600 && n < 12; k++) {
      const far = r() < 0.5,
        x = WORLD.x0 + 30 + r() * (WORLD.x1 - WORLD.x0 - 60),
        // On the far bank: on the near one they would stand over the farm's
        // edge (and be drawn live).
        y = far ? 1250 + r() * 24 : 1252 + r() * 20;
      const before = out.length;
      if (r() < 0.65)
        add(
          make(
            "bush",
            `sb${n}`,
            x,
            y,
            46 + r() * 20,
            1500 + k,
            ["green", "flower", "rose", "mint"][n % 4],
          ),
          10,
        );
      else add(make("rock", `sr${n}`, x, y, 26 + r() * 22, 1600 + k), 10);
      if (out.length > before) n++;
    }
  }
  /* East: the hay meadow (round bales, a cart), the sunflowers, a few trees. */
  out.push(
    make("bale", "bale0", 1990, 160, 1, 1),
    make("bale", "bale1", 2075, 250, 1, 2, "", true),
    make("bale", "bale2", 1975, 395, 1, 3),
    make("bale", "bale3", 2060, 470, 1, 4, "", true),
    make("cart", "cart", 2035, 90, 1, 1, "", true),
  );
  for (let i = 0; i < 4; i++)
    out.push(
      make("sunrow", `sun${i}`, 2030, 760 + i * 78, 1, 20 + i, "", false, 170),
    );
  {
    const r = seeded(67);
    let n = 0;
    for (const [x, y] of [
      [1950, 610],
      [2070, 640],
      [1960, 1080],
      [2075, 1110],
      [2085, 20],
      [1950, -10],
    ] as const) {
      add(
        make(
          "tree",
          `et${n}`,
          x + (r() - 0.5) * 16,
          y,
          0.75 + r() * 0.2,
          1700 + n,
          ["round", "apple", "pine", "round", "cherry", "mint"][n % 6],
          r() < 0.5,
        ),
        30,
      );
      n++;
    }
    for (let k = 0; k < 300 && n < 16; k++) {
      const x = 1910 + r() * 200,
        y = -20 + r() * 1150;
      const before = out.length;
      add(
        make(
          r() < 0.6 ? "bush" : "rock",
          `eb${n}`,
          x,
          y,
          r() < 0.6 ? 44 + r() * 14 : 28 + r() * 18,
          1800 + k,
        ),
        12,
      );
      if (out.length > before) n++;
    }
  }
  // West: bushes and rocks along the wood's edge, flowers in the patch.
  {
    const r = seeded(79);
    for (let k = 0, n = 0; k < 600 && n < 14; k++) {
      const x = -200 + r() * 160,
        y = -20 + r() * 1160;
      const before = out.length;
      add(
        make(
          r() < 0.7 ? "bush" : "rock",
          `wb${n}`,
          x,
          y,
          r() < 0.7 ? 46 + r() * 18 : 26 + r() * 20,
          2000 + k,
          ["green", "mint", "flower", "rose"][n % 4],
        ),
        12,
      );
      if (out.length > before) n++;
    }
  }
  return out;
}

/** Everything that stands round the farm (built once, the same every visit). */
export const PROPS: Prop[] = build();

/* ───────────── what moves, and what is drawn live ───────────── */

/**
 * Kinds that are always drawn live: trees sway in the wind and shake when
 * tapped. Bushes, reeds and the rest are baked unless they stand in front
 * of something live: a phone's frame copies few pictures (each live
 * picture is a texture the GPU keeps; past a few dozen, phones stall).
 */
export const LIVE_KINDS: ReadonlySet<PropKind> = new Set(["tree"]);

/** The tractor's road: when it drives, where it is (world px), which way. */
export const TRACTOR = {
  period: 64,
  drive: 40,
  len: 300,
  h: 150,
};
export function tractorAt(t: number): {
  on: boolean;
  x: number;
  y: number;
  face: 1 | -1;
} {
  const k = Math.floor(t / TRACTOR.period),
    u = t - k * TRACTOR.period;
  const face: 1 | -1 = k % 2 ? -1 : 1;
  const x0 = WORLD.x0 - TRACTOR.len,
    x1 = WORLD.x1 + TRACTOR.len;
  const f = Math.min(1, u / TRACTOR.drive);
  const x = face > 0 ? x0 + (x1 - x0) * f : x1 - (x1 - x0) * f;
  // It keeps to its side of the road (the near half going east).
  return { on: u < TRACTOR.drive, x, y: roadY(x) + (face > 0 ? 14 : -4), face };
}
/** The tractor (and its trailer) as the depth sort sees it at x. */
export const tractorBox = (x: number, y: number) => ({
  x0: x - TRACTOR.len / 2,
  x1: x + TRACTOR.len / 2,
  y0: y - 26,
  y1: y,
  h: TRACTOR.h,
});
/** The ducks' stretch of the brook (they turn before the footbridge). */
export const BROOK_DUCKS = { x0: FCX + 120, x1: WORLD.x1 - 60 };
export function brookDuck(t: number, k: number) {
  const span = BROOK_DUCKS.x1 - BROOK_DUCKS.x0,
    u = (t * 14 + k * 46) % (span * 2),
    x = u < span ? BROOK_DUCKS.x0 + u : BROOK_DUCKS.x1 - (u - span);
  return { x, y: brookY(x) + 6 - k * 4, face: u < span ? 1 : -1 };
}

/**
 * Everything that can stand somewhere and is drawn live, as boxes: the
 * dog, the hens, the cows, visitors and placed decorations anywhere on the
 * farm (the tallest, a food truck, 180 px), the tractor along the road, the
 * ducks along the brook, and the live props round the farm.
 */
export function liveSamples(props: Prop[] = PROPS): Drawable[] {
  const out: Drawable[] = [];
  const nop = () => {};
  for (let x = 0; x <= WW; x += 40)
    for (let y = 0; y <= WH; y += 40)
      out.push({
        x0: x - 70,
        x1: x + 70,
        y0: y - 12,
        y1: y,
        h: 190,
        draw: nop,
      });
  for (let x = WORLD.x0 - TRACTOR.len; x <= WORLD.x1 + TRACTOR.len; x += 40)
    for (const dy of [14, -4]) {
      const b = tractorBox(x, roadY(x) + dy);
      out.push({ ...b, draw: nop });
    }
  for (let x = BROOK_DUCKS.x0; x <= BROOK_DUCKS.x1; x += 30) {
    const y = brookY(x) + 6;
    out.push({ x0: x - 24, x1: x + 24, y0: y - 6, y1: y, h: 34, draw: nop });
  }
  for (const p of props) if (LIVE_KINDS.has(p.kind)) out.push(propDrawable(p));
  return out;
}
const meets = (a: Box, b: Box) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
/** Whether a prop's picture is drawn over something live (so it must be live too). */
export function coversLive(p: Prop, samples = liveSamples()): boolean {
  const d = propDrawable(p),
    box = screenBox(d),
    k = depthKey(d);
  for (const s of samples) {
    if (depthKey(s) >= k) continue;
    if (meets(box, screenBox(s))) return true;
  }
  return false;
}
/** The props split: baked with the ground, or drawn live in depth order. */
export function splitProps(list: Prop[] = PROPS) {
  const samples = liveSamples(list);
  const baked: Prop[] = [],
    live: Prop[] = [];
  for (const p of list)
    (LIVE_KINDS.has(p.kind) || coversLive(p, samples) ? live : baked).push(p);
  return { baked, live };
}

/* ───────────── the camera ───────────── */

/** The zoom that frames the whole farm (the ⤢ button). */
export const fitZoom = (vw: number, vh: number) =>
  Math.min(vw / (WW + 120), vh / (WH + 80));
/**
 * How far out the camera may zoom: a little past the farm's fit (0.92 of
 * it), so the land round the farm shows but never the world's edge, and
 * never so far that the view is wider than the world.
 */
export const zoomMin = (vw: number, vh: number) =>
  Math.max(
    vw / (WORLD.x1 - WORLD.x0),
    vh / (WORLD.y1 - WORLD.y0),
    0.92 * fitZoom(vw, vh),
  );
