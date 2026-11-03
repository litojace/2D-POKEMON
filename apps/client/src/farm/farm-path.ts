/**
 * Where the farm's animals may walk, and the guard dog's routes (ported from
 * the prototype's farm.js). Outside the fenced field the dog walks around
 * the pond, the well, its doghouse, the pasture, the scarecrow and placed
 * decorations: A* on a 40 px grid of free spots, then the path is
 * straightened wherever the way is clear. It enters and leaves the field
 * only through the gate in the middle of the front fence.
 */
export type Point = [number, number];
export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
export interface PathWorld {
  /** The fence around the field (posts and rails). */
  field: Rect;
  pasture: Rect;
  pond: { x: number; y: number; rx: number; ry: number };
  well: { x: number; y: number };
  doghouse: { x: number; y: number };
  /** The scarecrow's spot, when there is one. */
  scarecrow: Point | null;
  /** Spots with a decoration. */
  decor: Point[];
  /** The gate's x (the middle of the front fence). */
  gateX: number;
  width: number;
  height: number;
}

const STEP = 40;

/** The gate: a spot just outside it, and one just inside. */
export const gateOf = (w: PathWorld) => ({
  out: [w.gateX, w.field.y1 + 30] as Point,
  inn: [w.gateX, w.field.y1 - 16] as Point,
});

/** Inside the fenced field (with `m` px to spare). */
export const inField = (w: PathWorld, x: number, y: number, m = 0) =>
  x > w.field.x0 - 10 - m &&
  x < w.field.x1 + 10 + m &&
  y > w.field.y0 - 30 - m &&
  y < w.field.y1 + 14 + m;

/**
 * Whether an animal can't stand at (x, y). `inside`: walking in the field
 * (after coming through the gate), where only the field itself is open.
 * `m`: extra margin, so a straight leg never shaves a corner between samples.
 */
export function blocked(
  w: PathWorld,
  x: number,
  y: number,
  inside = false,
  m = 0,
) {
  if (!inside && inField(w, x, y, m)) return true;
  const p = w.pasture;
  if (
    x > p.x0 - 30 - m &&
    x < p.x1 + 30 + m &&
    y > p.y0 - 30 - m &&
    y < p.y1 + 18 + m
  )
    return true;
  const o = w.pond;
  if (
    ((x - o.x) / (o.rx + 30 + m)) ** 2 + ((y - o.y) / (o.ry + 22 + m)) ** 2 <
    1
  )
    return true;
  if (
    Math.abs(x - w.well.x) < 52 + m &&
    y > w.well.y - 30 - m &&
    y < w.well.y + 16 + m
  )
    return true;
  const h = w.doghouse;
  if (Math.abs(x - h.x) < 58 + m && y > h.y - 34 - m && y < h.y + 16 + m)
    return true;
  const s = w.scarecrow;
  if (s && Math.abs(x - s[0]) < 26 + m && Math.abs(y - s[1]) < 16 + m)
    return true;
  return w.decor.some(
    ([dx, dy]) =>
      Math.abs(x - dx) < 42 + m && y > dy - 22 - m && y < dy + 12 + m,
  );
}

/** Every point of the straight line a → b is free. */
export function clearLine(
  w: PathWorld,
  a: Point,
  b: Point,
  inside = false,
  m = 4,
) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (m ? 3 : 2));
  for (let k = 1; k <= n; k++)
    if (
      blocked(
        w,
        a[0] + ((b[0] - a[0]) * k) / n,
        a[1] + ((b[1] - a[1]) * k) / n,
        inside,
        m,
      )
    )
      return false;
  return true;
}

/** A walkable route from a to b outside the field: the points to walk to, in order. */
export function walkPath(w: PathWorld, a: Point, b: Point, m = 4): Point[] {
  const line = (p: Point, q: Point, mm = m) => clearLine(w, p, q, false, mm);
  if (line(a, b)) return [b];
  const cols = Math.ceil(w.width / STEP) + 1,
    rows = Math.ceil(w.height / STEP) + 1,
    id = (c: number, r: number) => r * cols + c,
    pt = (n: number): Point => [(n % cols) * STEP, Math.floor(n / cols) * STEP];
  const free = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      free[id(c, r)] = blocked(w, c * STEP, r * STEP, false, m) ? 0 : 1;
  const near = (p: Point, mm: number) => {
    const out: number[] = [],
      c0 = Math.round(p[0] / STEP),
      r0 = Math.round(p[1] / STEP);
    for (let r = r0 - 2; r <= r0 + 2; r++)
      for (let c = c0 - 2; c <= c0 + 2; c++)
        if (
          c >= 0 &&
          r >= 0 &&
          c < cols &&
          r < rows &&
          free[id(c, r)] &&
          line(p, pt(id(c, r)), mm)
        )
          out.push(id(c, r));
    return out;
  };
  // A point inside the safety margin connects without it.
  const ends = (p: Point) => {
    const t = near(p, m);
    return t.length ? t : near(p, 0);
  };
  const starts = ends(a),
    goals = new Set(ends(b));
  const gS = new Map<number, number>(),
    prev = new Map<number, number>(),
    open: [number, number][] = [],
    h = (n: number) => {
      const q = pt(n);
      return Math.hypot(q[0] - b[0], q[1] - b[1]);
    };
  for (const n of starts) {
    const q = pt(n),
      d = Math.hypot(q[0] - a[0], q[1] - a[1]);
    gS.set(n, d);
    open.push([d + h(n), n]);
  }
  let end = -1;
  while (open.length && goals.size) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, n] = open.splice(bi, 1)[0];
    if (goals.has(n)) {
      end = n;
      break;
    }
    const c = n % cols,
      r = Math.floor(n / cols);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const cc = c + dc,
          rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
        const mm = id(cc, rr);
        // No cutting a corner between two blocked cells.
        if (
          !free[mm] ||
          (dr && dc && (!free[id(c + dc, r)] || !free[id(c, r + dr)])) ||
          !line(pt(n), pt(mm))
        )
          continue;
        const gN = (gS.get(n) ?? 0) + (dr && dc ? Math.SQRT2 : 1) * STEP;
        if (gN < (gS.get(mm) ?? Infinity)) {
          gS.set(mm, gN);
          prev.set(mm, n);
          open.push([gN + h(mm), mm]);
        }
      }
  }
  // A tight squeeze: try again hugging the obstacles.
  if (end < 0) return m ? walkPath(w, a, b, 0) : [b];
  const pts: Point[] = [];
  for (let n: number | undefined = end; n != null; n = prev.get(n))
    pts.unshift(pt(n));
  pts.push(b);
  // Straighten: jump to the farthest point that can be walked to in a straight line.
  const out: Point[] = [];
  let cur = a,
    i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !line(cur, pts[j])) j--;
    out.push(pts[j]);
    cur = pts[j];
    i = j + 1;
  }
  return out;
}

/**
 * The dog's route from `from` to (tx, ty). `inside`: the target is in the
 * field, which the dog only enters (and leaves) through the gate.
 */
export function dogRoute(
  w: PathWorld,
  from: Point,
  to: Point,
  inside: boolean,
): Point[] {
  const g = gateOf(w),
    here = inField(w, from[0], from[1]),
    path: Point[] = [];
  let start = from;
  // Stepping out of the doghouse first.
  if (!here && blocked(w, from[0], from[1], false)) {
    start = [w.doghouse.x - 80, w.doghouse.y + 34];
    path.push(start);
  }
  if (here && !inside)
    path.push([from[0], g.inn[1]], g.inn, g.out, ...walkPath(w, g.out, to));
  else if (!here && inside)
    path.push(...walkPath(w, start, g.out), g.inn, [to[0], g.inn[1]], to);
  else if (!here) path.push(...walkPath(w, start, to));
  else path.push(to);
  return path;
}

/** Where the dog likes to sit when nothing is happening (the prototype's spots). */
export const DOG_SPOTS: Point[] = [
  [1520, 860],
  [1400, 830],
  [1100, 840],
  [700, 845],
  [460, 830],
  [250, 780],
  [975, 860],
  [1440, 760],
  [900, 960],
  [620, 940],
];
