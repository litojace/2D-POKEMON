/*
 * The Plaza: finding the way when you click somewhere to walk (desktop).
 *
 * Walking straight at the click got stuck on the first tree, bench or the
 * pond in between (a sidestep after a moment only helped round small
 * things). As games do it, the ground is a grid of cells, each free or not
 * by the very collision the server moves you with (plazaCollide); A*
 * finds the shortest way over it, round the hurdles when it can (crossing
 * one without jumping trips you), and the corners are then pulled tight so
 * you walk in straight lines from one turn to the next.
 *
 * Only the direction you hold is sent, as with the keys: the rules and the
 * protocol are unchanged.
 */
import {
  PLAZA,
  PLAZA_HURDLE_SEGMENTS,
  plazaCollide,
  segmentDistance,
} from "../../../../packages/shared/src/plaza";

/** Grid cell size (world px). */
export const PATH_CELL = 24;
const W = PLAZA.width,
  H = PLAZA.height;
const COLS = Math.ceil(W / PATH_CELL),
  ROWS = Math.ceil(H / PATH_CELL);
/** Extra cost of a cell by a hurdle (it trips you unless you jump). */
const HURDLE_COST = 12;

interface Grid {
  free: Uint8Array;
  cost: Float32Array;
}
let grid: Grid | undefined;

/** Can a body stand here (the server's own collision leaves it put)? */
export function standable(x: number, y: number) {
  // (Twice, a hair apart: an obstacle's exact centre pushes nowhere.)
  for (const [ox, oy] of [
    [0, 0],
    [0.37, 0.29],
  ]) {
    const q = plazaCollide({ x: x + ox, y: y + oy });
    if (Math.hypot(q.x - x - ox, q.y - y - oy) >= 0.5) return false;
  }
  return true;
}
const nearHurdle = (x: number, y: number) =>
  PLAZA_HURDLE_SEGMENTS.some(
    ([a, b]) => segmentDistance(x, y, a, b) < PLAZA.radius + 10,
  );
function build(): Grid {
  const free = new Uint8Array(COLS * ROWS),
    cost = new Float32Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const x = (c + 0.5) * PATH_CELL,
        y = (r + 0.5) * PATH_CELL,
        i = r * COLS + c;
      free[i] = standable(x, y) ? 1 : 0;
      cost[i] = nearHurdle(x, y) ? HURDLE_COST : 0;
    }
  return { free, cost };
}
const cellOf = (x: number, y: number) => ({
  c: Math.max(0, Math.min(COLS - 1, Math.floor(x / PATH_CELL))),
  r: Math.max(0, Math.min(ROWS - 1, Math.floor(y / PATH_CELL))),
});
const centre = (i: number) => ({
  x: ((i % COLS) + 0.5) * PATH_CELL,
  y: (Math.floor(i / COLS) + 0.5) * PATH_CELL,
});
/** The free cell nearest (x, y), searching outward. */
function nearestFree(g: Grid, x: number, y: number) {
  const { c, r } = cellOf(x, y);
  for (let k = 0; k < Math.max(COLS, ROWS); k++)
    for (let dr = -k; dr <= k; dr++)
      for (let dc = -k; dc <= k; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== k) continue;
        const rr = r + dr,
          cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= ROWS || cc >= COLS) continue;
        if (g.free[rr * COLS + cc]) return rr * COLS + cc;
      }
  return -1;
}
/** A straight walk from a to b stays on free ground, off the hurdles. */
function clear(
  g: Grid,
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const d = Math.hypot(b.x - a.x, b.y - a.y),
    n = Math.max(1, Math.ceil(d / (PATH_CELL / 3)));
  for (let k = 0; k <= n; k++) {
    const x = a.x + ((b.x - a.x) * k) / n,
      y = a.y + ((b.y - a.y) * k) / n;
    const { c, r } = cellOf(x, y),
      i = r * COLS + c;
    if (!g.free[i] || g.cost[i] > 0) return false;
  }
  return true;
}

/** A small binary heap of cell indices by priority. */
class Heap {
  private items: number[] = [];
  private pri: number[] = [];
  get size() {
    return this.items.length;
  }
  push(i: number, p: number) {
    const a = this.items,
      q = this.pri;
    a.push(i);
    q.push(p);
    let k = a.length - 1;
    while (k > 0) {
      const up = (k - 1) >> 1;
      if (q[up] <= q[k]) break;
      [a[up], a[k]] = [a[k], a[up]];
      [q[up], q[k]] = [q[k], q[up]];
      k = up;
    }
  }
  pop() {
    const a = this.items,
      q = this.pri;
    const top = a[0];
    const li = a.pop()!,
      lp = q.pop()!;
    if (a.length) {
      a[0] = li;
      q[0] = lp;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1,
          r = l + 1;
        let m = k;
        if (l < a.length && q[l] < q[m]) m = l;
        if (r < a.length && q[r] < q[m]) m = r;
        if (m === k) break;
        [a[m], a[k]] = [a[k], a[m]];
        [q[m], q[k]] = [q[k], q[m]];
        k = m;
      }
    }
    return top;
  }
}

/**
 * The way from `from` to `to`: the points to walk to in turn (the last is
 * where you clicked, or the nearest place you can stand). Empty if there
 * is no way.
 */
export function plazaPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number }[] {
  const g = (grid ??= build());
  const goal = standable(to.x, to.y) ? { x: to.x, y: to.y } : null;
  const gi = nearestFree(g, to.x, to.y);
  const si = nearestFree(g, from.x, from.y);
  if (gi < 0 || si < 0) return [];
  const end = goal ?? centre(gi);
  // Straight there: no search needed.
  if (clear(g, from, end)) return [end];
  const N = COLS * ROWS;
  const best = new Float32Array(N).fill(Infinity),
    prev = new Int32Array(N).fill(-1),
    done = new Uint8Array(N);
  const gc = gi % COLS,
    gr = Math.floor(gi / COLS);
  const h = (i: number) => {
    const dc = Math.abs((i % COLS) - gc),
      dr = Math.abs(Math.floor(i / COLS) - gr);
    return Math.max(dc, dr) + (Math.SQRT2 - 1) * Math.min(dc, dr);
  };
  const open = new Heap();
  best[si] = 0;
  open.push(si, h(si));
  while (open.size) {
    const i = open.pop();
    if (done[i]) continue;
    done[i] = 1;
    if (i === gi) break;
    const c = i % COLS,
      r = Math.floor(i / COLS);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const cc = c + dc,
          rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
        const j = rr * COLS + cc;
        if (!g.free[j] || done[j]) continue;
        // No cutting a corner past a blocked cell.
        if (dr && dc && (!g.free[r * COLS + cc] || !g.free[rr * COLS + c]))
          continue;
        const step = (dr && dc ? Math.SQRT2 : 1) + g.cost[j];
        const nb = best[i] + step;
        if (nb < best[j]) {
          best[j] = nb;
          prev[j] = i;
          open.push(j, nb + h(j));
        }
      }
  }
  if (!done[gi]) return [];
  const cells: { x: number; y: number }[] = [];
  for (let i = gi; i !== -1 && i !== si; i = prev[i]) cells.push(centre(i));
  cells.reverse();
  cells[cells.length - 1] = end;
  // Pull the corners tight: from each point, the farthest one in plain view.
  const out: { x: number; y: number }[] = [];
  let at = from;
  let k = 0;
  while (k < cells.length) {
    let far = k;
    for (let m = cells.length - 1; m > k; m--)
      if (clear(g, at, cells[m])) {
        far = m;
        break;
      }
    out.push(cells[far]);
    at = cells[far];
    k = far + 1;
  }
  return out;
}
/** Tests: the grid's size and how much of it is free. */
export function pathGridStats() {
  const g = (grid ??= build());
  let n = 0;
  for (const f of g.free) n += f;
  return { cols: COLS, rows: ROWS, free: n };
}
