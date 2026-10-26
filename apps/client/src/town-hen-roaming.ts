import { TOWN, TOWN_OBSTACLES } from "../../../packages/shared/src/town";
import { WORLD_ART } from "../../../packages/shared/src/world-art";

export type HenPoint = { x: number; y: number };
export interface HenRoam {
  points: HenPoint[];
  trip: number;
  destination: HenPoint;
}
const CELL = 48,
  MARGIN = 64;
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

/** Use the real movement footprints, including the pond, fountain, trees,
 * market stalls and the painted arena footing. Hens stay on dry open ground. */
export function henCanStand(x: number, y: number) {
  const r = TOWN.radius;
  if (x < r || y < r + 40 || x > TOWN.width - r || y > TOWN.height - r)
    return false;
  for (const o of TOWN_OBSTACLES) {
    if (o.shape === "round") {
      const dx = (x - o.x) / (o.rx + r),
        dy = (y - o.y) / (o.ry + r * WORLD_ART.groundY);
      if (dx * dx + dy * dy < 1) return false;
    } else if (
      Math.abs(x - o.x) < o.w / 2 + r &&
      Math.abs(y - o.y) < o.h / 2 + r * WORLD_ART.groundY
    )
      return false;
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
function nearest(p: HenPoint, requireVisible = true) {
  const free = groundGrid(),
    candidates: { n: number; distance: number }[] = [];
  for (let n = 0; n < free.length; n++)
    if (free[n]) {
      const candidate = point(n);
      candidates.push({
        n,
        distance: Math.hypot(candidate.x - p.x, candidate.y - p.y),
      });
    }
  candidates.sort((a, b) => a.distance - b.distance);
  return (
    candidates.find(({ n }) => !requireVisible || henCanWalk(p, point(n)))?.n ??
    -1
  );
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
  // actual obstacles instead of a staircase through every 48px cell.
  const points: HenPoint[] = [];
  let anchor = from;
  for (let i = 0; i < raw.length;) {
    let furthest = i;
    for (let j = i + 1; j < raw.length; j++)
      if (henCanWalk(anchor, raw[j])) furthest = j;
    anchor = raw[furthest];
    points.push(anchor);
    i = furthest + 1;
  }
  return { points, trip: trip + 1, destination: point(end) };
}
