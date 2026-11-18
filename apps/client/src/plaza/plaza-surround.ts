/*
 * The Plaza's surroundings, and how far the camera looks.
 *
 * The Plaza used to end at its own edge: the camera stopped there, so near
 * an edge you stood at the side of the screen, and the last strip of the
 * map was bare grass. As town builders do it (Hay Day, Township), the world
 * goes on past where you can walk: a river with a far bank to the north,
 * woods west and east, the farm's fields, barn and windmill to the south.
 * The camera may look a little way past the edge (PLAZA_OUT), never past
 * what is painted (PLAZA_MARGIN), and the zoom only ever shows what is built.
 *
 * Everything out there is either baked into the ground pictures (drawn
 * under everyone) or drawn live in depth order. Which one is decided here,
 * not by hand: a thing may be baked only if no one who can walk the Plaza
 * could ever stand behind it with their picture under its picture
 * (coversMovers). Nor may a tree stand in front of a landmark (hidesLandmark).
 *
 * One scale for everything: a fighter is ~75 px tall (1.4 m in chibi
 * proportions), ~55 px a metre of height; props are sized against that
 * (PLAZA_SCALE).
 */
import { PLAZA, PLAZA_GATE } from "../../../../packages/shared/src/plaza";

const W = PLAZA.width,
  H = PLAZA.height;

/** How far past each edge of the Plaza the camera may look (world px). */
export const PLAZA_OUT = { n: 240, s: 220, w: 200, e: 200 } as const;
/** How far past each edge the surroundings are painted (more than OUT). */
export const PLAZA_MARGIN = 300;

/** One scale for the whole Plaza (world px). */
export const PLAZA_SCALE = {
  /** A fighter's picture: 84 px drawn, ~75 px of body. */
  body: 75,
  /** Height of a metre. */
  metre: 55,
  /** The houses on the north side, drawn this much larger than their sprite. */
  house: 1.25,
  /** A house's wall and door (sprite px, before `house`). */
  houseWall: 112,
  houseDoor: 62,
  /** Street lamps, drawn this much larger than their sprite (110 px). */
  lamp: 1.2,
  /** A mini goal's crossbar (1.8 m). */
  goal: 100,
  /** A hurdle's bar (a children's hurdle, ~0.55 m). */
  hurdle: 30,
} as const;

/** The zoom for a screen: phones see a little more; never past what is built. */
export function plazaZoom(nw: number, nh: number) {
  return Math.max(
    nw < 1000 ? 0.66 : 1,
    nw / (W + PLAZA_OUT.w + PLAZA_OUT.e),
    nh / (H + PLAZA_OUT.n + PLAZA_OUT.s),
  );
}
/** Keep the camera's centre so the view stays inside what is built. */
export function plazaCamClamp(
  x: number,
  y: number,
  nw: number,
  nh: number,
  z: number,
) {
  const hw = nw / 2 / z,
    hh = nh / 2 / z;
  const cl = (v: number, a: number, b: number) =>
    a > b ? (a + b) / 2 : Math.max(a, Math.min(b, v));
  return {
    x: cl(x, -PLAZA_OUT.w + hw, W + PLAZA_OUT.e - hw),
    y: cl(y, -PLAZA_OUT.n + hh, H + PLAZA_OUT.s - hh),
  };
}

/* ---------- who can stand where ---------- */
/** Where a mover's feet can be (plazaCollide's bounds). */
export const PLAZA_REACH = {
  x0: 30,
  x1: W - 30,
  y0: 110,
  /** The farthest south at x: through the farm gate a little further. */
  y1: (x: number) =>
    Math.abs(x - PLAZA_GATE.x) <= 62 ? PLAZA_GATE.y + 30 : PLAZA_GATE.y,
};
/** A mover's picture around its feet: its sprite, a jump or a bounce pad. */
export const MOVER_BOX = { hw: 44, up: 84 + 170, down: 12 } as const;

export interface PropBox {
  /** Picture on screen (world px). */
  x0: number;
  x1: number;
  top: number;
  /** Where it stands on the ground (its depth). */
  foot: number;
}
/**
 * Could this thing ever be drawn over someone standing behind it? Then it
 * must be drawn live in depth order, not baked into the ground.
 */
export function coversMovers(b: PropBox) {
  const xa = Math.max(PLAZA_REACH.x0, b.x0 - MOVER_BOX.hw),
    xb = Math.min(PLAZA_REACH.x1, b.x1 + MOVER_BOX.hw);
  for (let x = xa; x <= xb; x += 4) {
    // Feet behind it: from the north edge to just north of its foot.
    const lo = PLAZA_REACH.y0,
      hi = Math.min(b.foot - 0.5, PLAZA_REACH.y1(x));
    if (hi < lo) continue;
    // A mover's picture spans [fy - up, fy + down]; it meets the prop's
    // [top, foot] for fy in (top - down, foot + up).
    if (
      Math.max(lo, b.top - MOVER_BOX.down) < Math.min(hi, b.foot + MOVER_BOX.up)
    )
      return true;
  }
  return false;
}
/** Is this thing on ground someone can walk (with a body's radius)? */
export function onWalkable(x: number, y: number, r = PLAZA.radius) {
  return (
    x > PLAZA_REACH.x0 - r &&
    x < PLAZA_REACH.x1 + r &&
    y > PLAZA_REACH.y0 - r &&
    y < PLAZA_REACH.y1(x) + r
  );
}

/* ---------- the surroundings ---------- */
export type SurroundKind =
  | "tree"
  | "pine"
  | "bush"
  | "rock"
  | "hay"
  | "barn"
  | "mill"
  | "scarecrow"
  | "well"
  | "lamp"
  | "crates";
export interface SurroundProp {
  kind: SurroundKind;
  x: number;
  y: number;
  /** Size (1 = the sprite's own). */
  s: number;
  /** Which variant (a tree's kind and seed). */
  v: number;
}
/** Big things people look at: trees must not stand in front of them. */
export const LANDMARKS: readonly SurroundKind[] = ["barn", "mill", "well"];

/** Where a prop's picture reaches. */
export function propBox(p: SurroundProp): PropBox {
  const s = p.s;
  const box = (hw: number, h: number, dx = 0) => ({
    x0: p.x - hw + dx,
    x1: p.x + hw + dx,
    top: p.y - h,
    foot: p.y,
  });
  switch (p.kind) {
    case "tree":
      return box(75 * s + 14, 192 * s);
    case "pine":
      return box(48 * s + 12, 149 * s + 10);
    case "bush":
      return box(35 * s + 10, 58 * s);
    case "rock":
      return box(28 * s, 34 * s);
    case "hay":
      return box(40 * s, 46 * s);
    case "barn":
      return box(130 * s, 212 * s, 10 * s);
    case "mill":
      // The body (150 wide, 214 high) and the sails turning round its hub.
      return box(Math.max(75, 92 * 0.9) * s, Math.max(214, 168 + 92 * 0.9) * s);
    case "scarecrow":
      return box(45 * s, 126 * s);
    case "well":
      return box(60 * s, 140 * s);
    case "lamp":
      return box(20 * s * PLAZA_SCALE.lamp, 106 * s * PLAZA_SCALE.lamp);
    case "crates":
      return box(45 * s, 74 * s);
  }
}
/** Does `a` stand in front of landmark `b` and hide part of it? */
export function hidesLandmark(a: SurroundProp, b: SurroundProp) {
  if (a.y <= b.y) return false;
  const A = propBox(a),
    B = propBox(b);
  const w = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0),
    h = Math.min(A.foot, B.foot) - Math.max(A.top, B.top);
  return w > 6 && h > 6;
}

/** A small fixed random sequence (the same layout every visit). */
function rand(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
/** The river along the north edge (ground y), and its two footbridges. */
export const RIVER = { y0: -150, y1: -8, bridges: [960, 1760] } as const;
/** The farm road south from the gate, and the cows' paddock. */
export const FARM = {
  road: { x0: PLAZA_GATE.x - 52, x1: PLAZA_GATE.x + 52 },
  paddock: { x0: 2180, x1: 2640, y0: 1760, y1: 1930 },
} as const;

function build(): SurroundProp[] {
  const r = rand(4242);
  const out: SurroundProp[] = [];
  const M = PLAZA_MARGIN;
  // North, the river's far bank: a row of trees with bushes between them and
  // lamps every few trees (their light trembles on the water at night).
  for (let x = -M + 40, i = 0; x < W + M; x += 120 + r() * 50, i++) {
    if (RIVER.bridges.some((b) => Math.abs(x - b) < 90)) continue;
    if (i % 3 === 1)
      out.push({ kind: "lamp", x, y: RIVER.y0 - 14, s: 1, v: 0 });
    else
      out.push({
        kind: i % 3 ? "tree" : "pine",
        x,
        y: RIVER.y0 - 26 - r() * 40,
        s: 0.85 + r() * 0.3,
        v: i,
      });
    if (r() < 0.6)
      out.push({
        kind: "bush",
        x: x + 60,
        y: RIVER.y0 - 18,
        s: 0.7 + r() * 0.3,
        v: i,
      });
  }
  // West and east: woods, the big trees well back from the edge.
  for (const side of [-1, 1]) {
    for (let y = -60, i = 0; y < H + M; y += 95 + r() * 40, i++) {
      const depth = 135 + r() * (M - 175);
      const x = side < 0 ? -depth : W + depth;
      out.push({
        kind: i % 2 ? "pine" : "tree",
        x,
        y,
        s: 0.85 + r() * 0.35,
        v: 100 + i * 2 + (side > 0 ? 1 : 0),
      });
      if (r() < 0.7) {
        const bx = side < 0 ? -40 - r() * 30 : W + 40 + r() * 30;
        out.push({
          kind: r() < 0.3 ? "rock" : "bush",
          x: bx,
          y: y + 40,
          s: 0.7 + r() * 0.3,
          v: 200 + i,
        });
      }
    }
  }
  // South: the farm the gate leads to.
  out.push(
    { kind: "barn", x: 720, y: 1935, s: 1, v: 0 },
    { kind: "mill", x: 1980, y: 1965, s: 1, v: 0 },
    { kind: "scarecrow", x: 1040, y: 1850, s: 1, v: 0 },
    { kind: "well", x: 1650, y: 1850, s: 0.9, v: 0 },
    { kind: "hay", x: 470, y: 1780, s: 1, v: 0 },
    { kind: "hay", x: 545, y: 1800, s: 1, v: 1 },
    { kind: "hay", x: 1520, y: 1770, s: 1, v: 2 },
    { kind: "crates", x: 900, y: 1905, s: 1, v: 0 },
  );
  for (const [x, y, k] of [
    [180, 1900, 0],
    [330, 1950, 1],
    [1220, 1960, 2],
    [2240, 1990, 3],
    [2560, 1985, 4],
  ] as const)
    out.push({ kind: "tree", x, y, s: 0.95, v: 300 + k });
  return out;
}
export const SURROUND: readonly SurroundProp[] = build();
/** Cows grazing in the paddock (drawn every frame: they chew and look up). */
export const COWS: readonly {
  x: number;
  y: number;
  face: 1 | -1;
  ph: number;
}[] = [
  { x: 2260, y: 1820, face: 1, ph: 0 },
  { x: 2420, y: 1860, face: -1, ph: 2.1 },
  { x: 2560, y: 1800, face: -1, ph: 4.3 },
];
/** The windmill's sails turn; their hub (world px). */
export function millHub(p: SurroundProp) {
  return { x: p.x, y: p.y - 168 * p.s };
}
/** Props baked into the strips (never over a walker), and those drawn live. */
export const BAKED = SURROUND.filter((p) => !coversMovers(propBox(p)));
export const LIVE = SURROUND.filter((p) => coversMovers(propBox(p)));
/** The far bank's lamps (lit at night, mirrored in the river). */
export const RIVER_LAMPS = SURROUND.filter((p) => p.kind === "lamp");
