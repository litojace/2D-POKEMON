import { TOWN, TOWN_OBSTACLES } from "../../../packages/shared/src/town";
import { WORLD_ART } from "../../../packages/shared/src/world-art";

export type HenPoint = { x: number; y: number };
export interface HenRoam {
  points: HenPoint[];
  trip: number;
  destination: HenPoint;
}
const CELL = 48,
  MARGIN = 64,
  /** Longest straight leg: 16 cells (768 px). */
  LOOK_AHEAD = 16;
const COLS = Math.floor((TOWN.width - 2 * MARGIN) / CELL) + 1;
const ROWS = Math.floor((TOWN.height - 2 * MARGIN) / CELL) + 1;
const point = (n: number): HenPoint => ({
  x: MARGIN + (n % COLS) * CELL,
  y: MARGIN + Math.floor(n / COLS) * CELL,
});
const noise = (n: number) => {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/** Each obstacle's footprint grown by a hen's radius, bucketed into a coarse
 * grid once, so a standing test checks only the few obstacles near it
 * instead of all of them (route planning makes thousands of these tests). */
type Footprint =
  | { round: true; x: number; y: number; rx: number; ry: number }
  | { round: false; x: number; y: number; hw: number; hh: number };
const BUCKET = 64;
const BUCKET_COLS = Math.ceil(TOWN.width / BUCKET) + 1;
const BUCKET_ROWS = Math.ceil(TOWN.height / BUCKET) + 1;
let buckets: Footprint[][] | undefined;
function footprintBuckets() {
  if (buckets) return buckets;
  const r = TOWN.radius,
    out: Footprint[][] = Array.from({ length: BUCKET_COLS * BUCKET_ROWS }, () => []);
  for (const o of TOWN_OBSTACLES) {
    const f: Footprint =
      o.shape === "round"
        ? { round: true, x: o.x, y: o.y, rx: o.rx + r, ry: o.ry + r * WORLD_ART.groundY }
        : { round: false, x: o.x, y: o.y, hw: o.w / 2 + r, hh: o.h / 2 + r * WORLD_ART.groundY };
    const hw = f.round ? f.rx : f.hw,
      hh = f.round ? f.ry : f.hh;
    const c0 = Math.max(0, Math.floor((f.x - hw) / BUCKET)),
      c1 = Math.min(BUCKET_COLS - 1, Math.floor((f.x + hw) / BUCKET)),
      r0 = Math.max(0, Math.floor((f.y - hh) / BUCKET)),
      r1 = Math.min(BUCKET_ROWS - 1, Math.floor((f.y + hh) / BUCKET));
    for (let row = r0; row <= r1; row++)
      for (let col = c0; col <= c1; col++) out[row * BUCKET_COLS + col].push(f);
  }
  return (buckets = out);
}

/** Use the real movement footprints, including the pond, fountain, trees,
 * market stalls and the painted arena footing. Hens stay on dry open ground. */
export function henCanStand(x: number, y: number) {
  const r = TOWN.radius;
  if (x < r || y < r + 40 || x > TOWN.width - r || y > TOWN.height - r)
    return false;
  const near = footprintBuckets()[Math.floor(y / BUCKET) * BUCKET_COLS + Math.floor(x / BUCKET)];
  for (const f of near) {
    if (f.round) {
      const dx = (x - f.x) / f.rx,
        dy = (y - f.y) / f.ry;
      if (dx * dx + dy * dy < 1) return false;
    } else if (Math.abs(x - f.x) < f.hw && Math.abs(y - f.y) < f.hh) return false;
  }
  return true;
}
export function henCanWalk(a: HenPoint, b: HenPoint) {
  const samples = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8));
  for (let i = 0; i <= samples; i++)
    if (
      !henCanStand(
        a.x + ((b.x - a.x) * i) / samples,
        a.y + ((b.y - a.y) * i) / samples,
      )
    )
      return false;
  return true;
}

/** Shared lazy graph: route planning runs only when a hen needs a new trip. */
let grid: Uint8Array | undefined;
const edges = new Map<number, number[]>();
function groundGrid() {
  if (!grid)
    grid = Uint8Array.from({ length: COLS * ROWS }, (_, n) => {
      const p = point(n);
      return henCanStand(p.x, p.y) ? 1 : 0;
    });
  return grid;
}
function neighbours(n: number) {
  const cached = edges.get(n);
  if (cached) return cached;
  const free = groundGrid(),
    x = n % COLS,
    y = Math.floor(n / COLS),
    out: number[] = [];
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    const nx = x + dx,
      ny = y + dy,
      next = ny * COLS + nx;
    if (
      nx >= 0 &&
      nx < COLS &&
      ny >= 0 &&
      ny < ROWS &&
      free[next] &&
      henCanWalk(point(n), point(next))
    )
      out.push(next);
  }
  edges.set(n, out);
  return out;
}
/** Build the whole walking graph now (while the town loads) rather than on
 * the first hen's first trip, mid-play. */
export function warmHenRoaming() {
  const free = groundGrid();
  for (let n = 0; n < free.length; n++) if (free[n]) neighbours(n);
}
function nearest(p: HenPoint, requireVisible = true) {
  // Grid points by distance, nearest first; usually the first one or two
  // are in sight, so pick minima one at a time instead of sorting them all.
  const free = groundGrid(),
    distance = new Float64Array(free.length).fill(Infinity);
  for (let n = 0; n < free.length; n++)
    if (free[n]) {
      const q = point(n);
      distance[n] = Math.hypot(q.x - p.x, q.y - p.y);
    }
  for (let tries = 0; tries < 16; tries++) {
    let best = -1;
    for (let n = 0; n < distance.length; n++)
      if (distance[n] < Infinity && (best < 0 || distance[n] < distance[best])) best = n;
    if (best < 0) return -1;
    if (!requireVisible || henCanWalk(p, point(best))) return best;
    distance[best] = Infinity;
  }
  // Rarely (hemmed in by walls): order the rest once.
  const rest: number[] = [];
  for (let n = 0; n < distance.length; n++) if (distance[n] < Infinity) rest.push(n);
  rest.sort((a, b) => distance[a] - distance[b] || a - b);
  return rest.find((n) => henCanWalk(p, point(n))) ?? -1;
}
export function henRoamStart(p: HenPoint) {
  if (henCanStand(p.x, p.y)) return { ...p };
  return point(nearest(p, false));
}
export function planHenRoam(
  from: HenPoint,
  phase: number,
  trip: number,
): HenRoam {
  const start = nearest(from),
    parents = new Int32Array(COLS * ROWS).fill(-2),
    queue: number[] = [];
  if (start < 0)
    return { points: [], trip: trip + 1, destination: { ...from } };
  parents[start] = -1;
  queue.push(start);
  for (let head = 0; head < queue.length; head++)
    for (const next of neighbours(queue[head]))
      if (parents[next] === -2) {
        parents[next] = queue[head];
        queue.push(next);
      }
  const distant = queue.filter((n) => {
    const p = point(n);
    return Math.hypot(p.x - from.x, p.y - from.y) > 650;
  });
  const candidates = distant.length ? distant : queue;
  const end =
    candidates[Math.floor(noise(phase * 17 + trip * 31) * candidates.length)];
  const raw: HenPoint[] = [];
  for (let n = end; n >= 0; n = parents[n]) raw.push(point(n));
  raw.reverse();
  // Skip visible intermediate grid nodes, leaving gentle long legs around
  // actual obstacles instead of a staircase through every 48px cell. Each
  // leg looks at most LOOK_AHEAD nodes ahead, furthest first, and takes the
  // first one in sight (testing every later node made planning quadratic).
  const points: HenPoint[] = [];
  let anchor = from;
  for (let i = 0; i < raw.length;) {
    let furthest = i;
    for (let j = Math.min(raw.length - 1, i + LOOK_AHEAD); j > i; j--)
      if (henCanWalk(anchor, raw[j])) {
        furthest = j;
        break;
      }
    anchor = raw[furthest];
    points.push(anchor);
    i = furthest + 1;
  }
  return { points, trip: trip + 1, destination: point(end) };
}
