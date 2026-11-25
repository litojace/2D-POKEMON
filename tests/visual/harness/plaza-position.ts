import type { PlazaWorld } from "../../../apps/server/src/plaza";

/** A fixture teleport starts a new position history, unlike a timed input. */
export function positionPlazaVisitor(
  world: PlazaWorld,
  key: string,
  x: number,
  y: number,
) {
  const body = world.bodyOf(key);
  if (!body) return;
  Object.assign(body, { x, y });
  // A late input must not restore a body from before this out-of-band move.
  // New steps will record fresh history; keep queued inputs and sequence
  // counters so future inputs and ordinary rewind still work normally.
  const visitor = (world as any).visitors.get(key);
  visitor.past = [];
  visitor.played = [];
}
