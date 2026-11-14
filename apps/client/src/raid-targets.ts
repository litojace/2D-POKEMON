import type { Snapshot } from "@arena/shared";
import type { Targetable } from "./target-lock";

/**
 * What a phone player can aim at in a raid besides the boss itself.
 *
 * Gloomshade splits into copies that look exactly like it: only lantern
 * shadows and its flickering moon tell them apart. Aiming used to go to the
 * nearest *player*, and the copies are not players, so a phone always aimed at
 * the real one and the puzzle vanished. Here every body (real or copy) is a
 * target of the same kind, with labels handed out at random, so aiming never
 * knows which is real; the unlit lanterns (two hits relight one) are targets
 * too, so a phone can relight them.
 *
 * Tidewyrm seals raiders in Bubble Prisons that teammates pop with three hits;
 * while one holds a teammate, the bubble is a target next to the boss.
 */
export interface RaidTarget extends Targetable {
  /** A body to fight (`shade`, `boss`), or something to hit first. */
  kind: "shade" | "lantern" | "boss" | "bubble";
  /** Where its feet are on the floor (the reticle and tap column). */
  feetY: number;
  label: string;
}
const COMPASS = ["NW", "NE", "SW", "SE"];
/** Labels for the bodies, shuffled whenever the set of bodies changes. */
let shadeLabels = new Map<string, string>();
let shadeSet = "";
const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Shuffle (Fisher–Yates) with an injectable random source (tests). */
function shuffled<T>(items: T[], random: () => number) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The targets of a fight with more to aim at than the fighters, nearest to
 * `from` first. Undefined when the fighters are all there is.
 */
export function raidTargets(
  state: Snapshot,
  from: { x: number; y: number; id?: string },
  random: () => number = Math.random,
): RaidTarget[] | undefined {
  return state.raid?.boss === "tidewyrm"
    ? tideTargets(state, from)
    : gloomTargets(state, from, random);
}
const nearestFirst = (
  targets: RaidTarget[],
  from: { x: number; y: number },
) => {
  const d = (t: RaidTarget) => Math.hypot(t.x - from.x, t.y - from.y);
  return targets.sort((a, b) => d(a) - d(b));
};
/** Tidewyrm and the bubbles holding teammates (not your own: you mash). */
function tideTargets(
  state: Snapshot,
  from: { x: number; y: number; id?: string },
): RaidTarget[] | undefined {
  const bubbles = (state.raid?.prisons ?? []).filter(
    (q) => q.playerId !== from.id,
  );
  if (!bubbles.length) return undefined;
  const boss = state.players.find((p) => p.raidBoss && p.hp > 0);
  return nearestFirst(
    [
      ...(boss
        ? [
            {
              id: boss.id,
              kind: "boss" as const,
              x: boss.x,
              y: boss.y,
              feetY: boss.y,
              label: "Tidelotl",
            },
          ]
        : []),
      ...bubbles.map((q) => ({
        id: `bubble:${q.playerId}`,
        kind: "bubble" as const,
        x: q.x,
        y: q.y,
        feetY: q.y,
        label: `Free ${state.players.find((p) => p.id === q.playerId)?.name ?? "ally"}`,
      })),
    ],
    from,
  );
}
/**
 * Gloomshade's targets, nearest to `from` first: every body (the real one and
 * its copies, alike) and every unlit lantern. Undefined in any other fight.
 */
export function gloomTargets(
  state: Snapshot,
  from: { x: number; y: number },
  random: () => number = Math.random,
): RaidTarget[] | undefined {
  const r = state.raid;
  if (r?.boss !== "gloomshade") return undefined;
  const boss = state.players.find((p) => p.raidBoss && p.hp > 0);
  const bodies: { id: string; x: number; y: number }[] = [
    ...(boss ? [{ id: `shade:${boss.id}`, x: boss.x, y: boss.y }] : []),
    ...(r.decoys ?? []).map((d) => ({ id: `shade:${d.id}`, x: d.x, y: d.y })),
  ];
  // A new split (or a copy popping) hands the letters out again, at random:
  // nothing about the labels points at the real one.
  const set = bodies
    .map((b) => b.id)
    .sort()
    .join(",");
  if (set !== shadeSet) {
    shadeSet = set;
    const letters = shuffled(LETTERS.slice(0, bodies.length), random);
    shadeLabels = new Map(bodies.map((b, i) => [b.id, `Shade ${letters[i]}`]));
  }
  const targets: RaidTarget[] = [
    ...bodies.map((b) => ({
      id: b.id,
      kind: "shade" as const,
      x: b.x,
      y: b.y,
      feetY: b.y,
      label: bodies.length > 1 ? shadeLabels.get(b.id)! : "Gloomshade",
    })),
    ...(r.lanterns ?? []).flatMap((l, i) =>
      l.lit
        ? []
        : [
            {
              id: `lantern:${i}`,
              kind: "lantern" as const,
              // its glass, where shots relight it
              x: l.x,
              y: l.y,
              feetY: l.y + 30,
              label: `Lantern ${COMPASS[i] ?? i + 1}`,
            },
          ],
    ),
  ];
  return nearestFirst(targets, from);
}
/** Forget the label shuffle (tests, a new raid). */
export function resetRaidTargets() {
  shadeLabels = new Map();
  shadeSet = "";
}
