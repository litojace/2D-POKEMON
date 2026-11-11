import {
  CHARACTERS,
  type Fighter,
  type GameEvent,
} from "../../../../packages/shared/src/index";

/**
 * Why a snapshot moved your predicted fighter (a correction). The phone
 * predicts your own inputs exactly, so a correction means the server did
 * something to you the phone could not know about yet:
 *
 * - hit: a hit on you that pushes or pulls (or one from an ability the
 *   client does not know, such as a raid boss's);
 * - status: a status that changes how you move landed or ended (stun,
 *   freeze, root, slow, taunt, a current...);
 * - move: your own dash or movement skill ran (the server placed it);
 * - other: none of these. Common "other" corrections mean the prediction
 *   is wrong somewhere: reproduce with scripts/perf/correction-sim.ts.
 */
export type CorrectionCause = "hit" | "status" | "move" | "other";

/** Statuses that change where your inputs take you. */
export const MOVEMENT_STATUSES = new Set<string>([
  "stun",
  "freeze",
  "sleep",
  "shell",
  "root",
  "slow",
  "warp",
  "taunt",
  "leash",
  "cage",
  "current",
  "float",
  "haste",
]);

const KNOCKBACK = new Map<string, number>(
  Object.values(CHARACTERS).flatMap((c) =>
    [c.basic, ...c.skills].map((a) => [a.id, a.knockback ?? 0] as const),
  ),
);

export interface CorrectionReason {
  cause: CorrectionCause;
  /** What did it: the abilities that hit, or the statuses. */
  detail: string;
}

/**
 * `me` is your fighter in the new snapshot, `was` in the one before, and
 * `fresh` the events that snapshot brought.
 */
export function correctionCause(
  me: Fighter,
  was: Fighter | undefined,
  fresh: readonly GameEvent[],
  time: number,
): CorrectionReason {
  const hits = fresh.filter((e) => e.kind === "hit" && e.target === me.id);
  // Damage with no ability (a burn ticking) never moves you; an ability the
  // client has no kit for (a raid boss's attack) might.
  const pushed = hits.filter((e) => {
    if (e.abilityId === undefined) return false;
    const k = KNOCKBACK.get(e.abilityId);
    return k === undefined || k !== 0;
  });
  if (pushed.length)
    return {
      cause: "hit",
      detail: pushed.map((e) => e.abilityId).join(","),
    };
  const landed = me.statuses.filter(
    (s) =>
      MOVEMENT_STATUSES.has(s.kind) &&
      !was?.statuses.some((w) => w.kind === s.kind && w.until >= s.until),
  );
  const ended = (was?.statuses ?? []).filter(
    (w) =>
      MOVEMENT_STATUSES.has(w.kind) &&
      !me.statuses.some((s) => s.kind === w.kind),
  );
  if (landed.length || ended.length)
    return {
      cause: "status",
      detail: [
        ...landed.map((s) => s.kind),
        ...ended.map((s) => `${s.kind} ended`),
      ].join(","),
    };
  const moving =
    me.dashUntil > time - 0.07 ||
    !!me.roll ||
    !!me.charge ||
    fresh.some(
      (e) => e.owner === me.id && (e.kind === "dash" || e.kind === "cast"),
    );
  if (moving) return { cause: "move", detail: "" };
  return { cause: "other", detail: hits.map((e) => e.abilityId).join(",") };
}
