/*
 * The Plaza's surroundings, and how far the camera looks.
 *
 * The Plaza used to end at its own edge: the camera stopped there, so near
 * an edge you stood at the side of the screen, and the last strip of the
 * map was bare grass. As town builders do it (Hay Day, Township), the world
 * goes on past where you can walk: a river with a far bank to the north,
 * woods west and east, and to the south a park: a wildflower meadow with a
 * bandstand, picnic blankets, a hot-air balloon and kites. (It was farmland,
 * a barn, a windmill and cows, from when the Plaza had a Farm; the Farm has
 * gone, so its fields did too, owner's call, 21 Nov 2026.)
 * The camera may look a little way past the edge (PLAZA_OUT), never past
 * what is painted (PLAZA_MARGIN), and the zoom only ever shows what is built.
 *
 * Everything out there is either baked into the ground picture (drawn
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

/**
 * The usual zoom on a phone-sized screen (under 1000 px wide). It was 0.66,
 * to see more of the Plaza; the owner chose 0.8 (20 Nov 2026) so the skins
 * and their effects read on a phone: a fighter is 67 px tall instead of 55
 * on an 844 × 390 screen, and still sharp (its sprite is baked at 2.4 px a
 * world px; a phone's canvas draws at most 0.8 × 2 = 1.6).
 */
export const PLAZA_PHONE_ZOOM = 0.8;
/** The zoom for a screen: phones a little closer; never past what is built. */
export function plazaZoom(nw: number, nh: number) {
  return Math.max(
    nw < 1000 ? PLAZA_PHONE_ZOOM : 1,
    nw / (W + PLAZA_OUT.w + PLAZA_OUT.e),
    nh / (H + PLAZA_OUT.n + PLAZA_OUT.s),
  );
}
/**
 * How far a player may zoom (pinch, wheel, + and −) on this screen. In: up
 * to 1.8 times the usual, at most 1.5 (the ground is painted at one pixel a
 * world px). Out: never past what is built, and never wider than the server
 * shows other players (PLAZA.view), so a zoomed-out view never has empty
 * ground where people should be.
 */
export function plazaZoomRange(nw: number, nh: number) {
  const base = plazaZoom(nw, nh);
  const built = Math.max(
    nw / (W + PLAZA_OUT.w + PLAZA_OUT.e),
    nh / (H + PLAZA_OUT.n + PLAZA_OUT.s),
  );
  const seen = Math.max(nw / PLAZA.view.w, nh / PLAZA.view.h);
  return {
    base,
    min: Math.min(base, Math.max(built, seen)),
    max: Math.max(base, Math.min(base * 1.8, 1.5)),
  };
}
/**
 * Whether a player may zoom on this screen. Phones may not (the owner, 20 Nov
 * 2026): the usual zoom is chosen for them, and a second finger on the
 * playground never changes the view by accident. A phone is a touch screen
 * whose short side is under 500 CSS px (phones in landscape are 320–430 px
 * tall; the smallest iPad is 744), so iPads and touch laptops keep the zoom.
 */
export function plazaZoomable(coarse: boolean, nw: number, nh: number) {
  return !coarse || Math.min(nw, nh) >= 500;
}
/** The zoom for a screen and a player's chosen factor (1 = the usual). */
export function plazaZoomAt(nw: number, nh: number, factor: number) {
  const r = plazaZoomRange(nw, nh);
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return Math.max(r.min, Math.min(r.max, r.base * f));
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
  /** The farthest south at x: through the south gate a little further. */
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
  | "gazebo"
  | "balloon"
  | "picnic"
  | "bench"
  | "lamp";
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
export const LANDMARKS: readonly SurroundKind[] = ["gazebo", "balloon"];
/** The balloon floats this high over its spot (world px, before `s`). */
export const BALLOON_UP = 150;

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
    case "gazebo":
      return box(112 * s, 218 * s);
    case "balloon":
      // What is baked: its shadow on the meadow. (The balloon floats over
      // it, drawn every frame: balloonBox.)
      return box(40 * s, 12 * s);
    case "picnic":
      return box(48 * s, 40 * s);
    case "bench":
      return box(46 * s, 62 * s);
    case "lamp":
      return box(20 * s * PLAZA_SCALE.lamp, 106 * s * PLAZA_SCALE.lamp);
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
/** The park south of the gate: the lane down from it, and the circle it
 * ends in round a flower bed. */
export const PARK = {
  lane: { x0: PLAZA_GATE.x - 46, x1: PLAZA_GATE.x + 46 },
  circle: { x: PLAZA_GATE.x, y: H + 205, rx: 120, ry: 62 },
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
  // South: the park. The bandstand west of the lane, the balloon east;
  // picnics on the meadow, benches facing the flower circle.
  out.push(
    { kind: "gazebo", x: 720, y: 1935, s: 1, v: 0 },
    { kind: "balloon", x: 1980, y: 1965, s: 1, v: 0 },
    { kind: "picnic", x: 470, y: 1790, s: 1, v: 0 },
    { kind: "picnic", x: 1040, y: 1850, s: 1, v: 1 },
    { kind: "picnic", x: 1640, y: 1820, s: 1, v: 2 },
    { kind: "picnic", x: 2420, y: 1830, s: 1, v: 3 },
    { kind: "bench", x: PLAZA_GATE.x - 175, y: H + 200, s: 1, v: 0 },
    { kind: "bench", x: PLAZA_GATE.x + 175, y: H + 200, s: 1, v: 1 },
  );
  for (const [x, y, k] of [
    [180, 1900, 0],
    [330, 1950, 1],
    // Clear of the flower circle and its benches.
    [1010, 1975, 2],
    [1700, 1990, 3],
    [2780, 1990, 4],
  ] as const)
    out.push({ kind: "tree", x, y, s: 0.95, v: 300 + k });
  return out;
}
export const SURROUND: readonly SurroundProp[] = build();
/** Kites over the meadow, each tied to a picnic (drawn every frame: they
 * dance on the wind). `at`: where its string is held. */
export const KITES: readonly {
  x: number;
  y: number;
  at: { x: number; y: number };
  c: readonly [string, string];
  ph: number;
}[] = [
  {
    x: 560,
    y: 1700,
    at: { x: 490, y: 1784 },
    c: ["#ff6f9a", "#ffd65b"],
    ph: 0,
  },
  {
    x: 2520,
    y: 1712,
    at: { x: 2440, y: 1824 },
    c: ["#4fb3ff", "#ffffff"],
    ph: 2.3,
  },
];
/** Where the floating balloon's picture reaches (with its bob). */
export function balloonBox(p: SurroundProp): PropBox {
  const top = p.y - (BALLOON_UP + 166) * p.s;
  return { x0: p.x - 70 * p.s, x1: p.x + 70 * p.s, top, foot: p.y };
}
/** The balloon's basket and envelope over its spot, bobbing. */
export function balloonAt(p: SurroundProp, t = 0) {
  return {
    x: p.x + Math.sin(t * 0.4) * 6,
    y: p.y - BALLOON_UP * p.s + Math.sin(t * 0.7) * 5,
  };
}
/** Props baked into the meadow (never over a walker), and those drawn live. */
export const BAKED = SURROUND.filter((p) => !coversMovers(propBox(p)));
export const LIVE = SURROUND.filter((p) => coversMovers(propBox(p)));
/** The far bank's lamps (lit at night, mirrored in the river). */
export const RIVER_LAMPS = SURROUND.filter((p) => p.kind === "lamp");
/**
 * What moves out there but is drawn under every walker (cows, the windmill's
 * sails) is drawn after the baked meadow: nothing baked may stand in front
 * of it (a tree in front of a cow would be drawn under the cow).
 */
export function movingBoxes(): (PropBox & { name: string })[] {
  return [
    // A kite and its tail, as it sways (its string runs down to a picnic,
    // over the blanket, as it should).
    ...KITES.map((k) => ({
      name: `kite ${k.x},${k.y}`,
      x0: k.x - 40,
      x1: k.x + 40,
      top: k.y - 40,
      foot: k.y + 60,
    })),
    ...SURROUND.filter((p) => p.kind === "balloon").map((p) => ({
      name: "balloon",
      ...balloonBox(p),
    })),
  ];
}
/** A baked prop that stands in front of `b` and covers part of it. */
export function bakedInFront(b: PropBox) {
  return BAKED.find((p) => {
    const q = propBox(p);
    return (
      q.foot > b.foot &&
      Math.min(q.x1, b.x1) - Math.max(q.x0, b.x0) > 2 &&
      Math.min(q.foot, b.foot) - Math.max(q.top, b.top) > 2
    );
  });
}
