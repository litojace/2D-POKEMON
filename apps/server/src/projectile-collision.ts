import {
  RULES,
  type Rect,
  type Vec,
} from "../../../packages/shared/src/index.js";

/** First contact of a moving circle with solid cover or the arena boundary. */
export function projectileContact(
  from: Vec,
  to: Vec,
  radius: number,
  walls: readonly Rect[],
) {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  let first = Infinity;
  const accept = (t: number) => {
    if (t >= 0 && t <= 1) first = Math.min(first, t);
  };
  if (
    from.x < radius ||
    from.y < radius ||
    from.x > RULES.width - radius ||
    from.y > RULES.height - radius
  )
    first = 0;
  if (dx < 0) accept((radius - from.x) / dx);
  if (dx > 0) accept((RULES.width - radius - from.x) / dx);
  if (dy < 0) accept((radius - from.y) / dy);
  if (dy > 0) accept((RULES.height - radius - from.y) / dy);
  const length2 = dx * dx + dy * dy;
  for (const o of walls) {
    const nearestX = Math.max(o.x, Math.min(from.x, o.x + o.w)),
      nearestY = Math.max(o.y, Math.min(from.y, o.y + o.h));
    if (Math.hypot(from.x - nearestX, from.y - nearestY) < radius) first = 0;
    if (dx !== 0) {
      const t = ((dx > 0 ? o.x - radius : o.x + o.w + radius) - from.x) / dx;
      const y = from.y + dy * t;
      if (y >= o.y && y <= o.y + o.h) accept(t);
    }
    if (dy !== 0) {
      const t = ((dy > 0 ? o.y - radius : o.y + o.h + radius) - from.y) / dy;
      const x = from.x + dx * t;
      if (x >= o.x && x <= o.x + o.w) accept(t);
    }
    // Rounded corners match blocked()'s circle/rectangle collision exactly;
    // growing the whole rectangle would incorrectly block clear corner shots.
    if (length2)
      for (const x of [o.x, o.x + o.w])
        for (const y of [o.y, o.y + o.h]) {
          const ox = from.x - x,
            oy = from.y - y;
          const b = 2 * (ox * dx + oy * dy),
            c = ox * ox + oy * oy - radius * radius;
          const disc = b * b - 4 * length2 * c;
          if (disc >= 0) accept((-b - Math.sqrt(disc)) / (2 * length2));
        }
  }
  return Number.isFinite(first)
    ? { x: from.x + dx * first, y: from.y + dy * first, fraction: first }
    : null;
}
