/**
 * The raid bosses' shared "brain": pure helpers the raid core uses to pick,
 * aim and combine attacks (docs/boss-raid.md "How bosses think"). Every boss
 * gets them through RaidArena; a boss tunes them through the hooks there
 * (`reactions`, `exclusive`, `onMechanic`, `hazards`, `thrash`).
 */
import { RULES, type Fighter } from "../../../packages/shared/src/index.js";
import {
  handsTileDark,
  type RaidAttack,
  type RaidWarning,
} from "../../../packages/shared/src/raid.js";

/** The slowest champion's speed: every fairness check assumes it (px/s). */
export const RAID_SLOWEST_SPEED = 222;
/** The reaction time every fairness check allows (seconds). */
export const RAID_REACTION = 0.45;
/** A shape stops moving at least this long before it lands (seconds). */
export const RAID_FREEZE = 0.6;
/** Two overlapping impacts land at least this far apart (seconds). */
export const RAID_IMPACT_GAP = 0.5;

/** Attacks a raider answers by jumping: never shortened, spaced by the jump cooldown. */
export const RAID_JUMP_ATTACKS = new Set<RaidAttack>([
  "slam",
  "pulse",
  "lullaby",
  "flame-ring",
  "thunderclap",
]);
/** Warnings whose length is a duration, not a telegraph (never shortened). */
export const RAID_DURATION_ATTACKS = new Set<RaidAttack>(["whale-song"]);
/**
 * Attacks that need the whole floor (or move the boss, or start a puzzle):
 * they never overlap another attack. A boss can widen this with `exclusive()`.
 */
export const RAID_EXCLUSIVE_ATTACKS = new Set<RaidAttack>([
  "charge",
  "share",
  "dive",
  "wave",
  "hightide",
  "undertow",
  "prison",
  "hands",
  "split",
  "dream-sequence",
  "whale-song",
  "nightmare",
  "light-relay",
  "refraction",
  "halo-crush",
  "brazier-lighting",
  "scorched-earth",
  "polarity",
  "link-beam",
  "twin-rush",
]);
/** Attacks that never hurt by themselves (they set something up). */
export const RAID_HARMLESS_ATTACKS = new Set<RaidAttack>([
  "split",
  "curse",
  "dream-sequence",
  "glare",
  "light-relay",
  "refraction",
  "brazier-lighting",
]);
/**
 * Single-target attacks that, under party pressure, go at a second raider
 * 0.35 s later (chapter and party size from the tier table). Chain
 * lightning is left out: it already jumps between raiders, and two chains
 * downed a party a dozen times a run in the harness. A boss adds its own
 * through `pressured()`.
 */
export const RAID_PRESSURE_ATTACKS = new Set<RaidAttack>([
  "volley",
  "eruption",
  "prism-lance",
  "dive-bomb",
  "curse",
  "tail-splash",
  "static-field",
]);
/** Line attacks: a raider who just spent their dash is a tempting target. */
export const RAID_LINE_ATTACKS = new Set<RaidAttack>([
  "charge",
  "lunge",
  "dive-bomb",
  "twin-rush",
  "tail-splash",
  "prism-lance",
]);
/** Floor blasts aimed at the middle of a stack of raiders. */
export const RAID_CLUSTER_ATTACKS = new Set<RaidAttack>([
  "debris",
  "eruption",
  "falling-stars",
  "ember-rain",
  "static-field",
  "halo-crush",
]);

export type RaidShape = "circle" | "line" | "cone" | "ring" | "field";
/** The family a warning's shape belongs to (overlaps mix families). */
export function raidShapeOf(kind: RaidAttack): RaidShape {
  if (RAID_JUMP_ATTACKS.has(kind)) return "ring";
  if (
    [
      "charge",
      "lunge",
      "tail-splash",
      "twin-rush",
      "dive-bomb",
      "link-beam",
      "prism-lance",
    ].includes(kind)
  )
    return "line";
  if (["volley", "bubbles", "fan-display", "wing-gust"].includes(kind))
    return "cone";
  if (
    [
      "hands",
      "hightide",
      "whale-song",
      "undertow",
      "nightmare",
      "wave",
      "chain-lightning",
      "glare",
      "polarity",
      "scorched-earth",
    ].includes(kind)
  )
    return "field";
  return "circle";
}
function segmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const lx = bx - ax,
    ly = by - ay,
    len2 = lx * lx + ly * ly || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * lx + (py - ay) * ly) / len2));
  return Math.hypot(px - (ax + lx * t), py - (ay + ly * t));
}
/**
 * Would a raider standing at (x, y) be inside this warning's drawn shape?
 * `pad` is the raider's radius (plus any margin). Ring and field attacks are
 * answered by jumping or by the mechanic, so only their area is reported.
 */
export function raidShapeHits(
  w: RaidWarning,
  x: number,
  y: number,
  pad: number = RULES.radius,
) {
  const shape = raidShapeOf(w.kind);
  if (w.kind === "hands") {
    const parity =
      w.shiftAt !== undefined ? 1 - (w.parity ?? 0) : (w.parity ?? 0);
    return handsTileDark(x, y, parity);
  }
  if (shape === "field") return true;
  if (shape === "line") {
    // A charge hits within 100 px of Grumblecrag's centre along its path.
    const half =
      w.kind === "charge" ? 100 - RULES.radius : (w.width ?? 0) / 2 || w.radius;
    return segmentDistance(x, y, w.x, w.y, w.tx, w.ty) < half + pad;
  }
  if (shape === "cone") {
    const dx = x - w.x,
      dy = y - w.y,
      dist = Math.hypot(dx, dy);
    if (dist > w.radius + pad) return false;
    const aim = Math.atan2(w.ty - w.y, w.tx - w.x);
    const off = Math.atan2(
      Math.sin(Math.atan2(dy, dx) - aim),
      Math.cos(Math.atan2(dy, dx) - aim),
    );
    return (
      Math.abs(off) <= (w.spread ?? 0.45) + Math.atan2(pad, Math.max(dist, 1))
    );
  }
  return Math.hypot(x - w.x, y - w.y) < w.radius + pad;
}

/** What the boss sees when it decides (worked out once per decision). */
export interface RaidSituation {
  time: number;
  phase: number;
  boss: Fighter;
  alive: Fighter[];
  /** Raiders within 260 px of the boss, and how long each has been there (s). */
  melee: { p: Fighter; seconds: number }[];
  /** The most raiders within 150 px of one raider, and where they stand. */
  cluster: { size: number; x: number; y: number; ids: string[] };
  /** The raider farthest from every teammate (undefined alone). */
  isolated?: Fighter;
  /** The raider with the lowest share of their health. */
  weakest?: Fighter;
  /** Raiders kneeling by a fallen ally. */
  reviving: Fighter[];
  /** Raiders standing on (or in) the boss's mechanic: an island, a pad, light. */
  onMechanic: Fighter[];
  /** Raiders in the air (jumped) or with their dash spent. */
  airborne: Fighter[];
  dashSpent: Fighter[];
  /** Mean distance from the boss. */
  spread: number;
}
/** A boss reaction: play this attack now (score ≥ 1 wins over the deck). */
export interface RaidReaction {
  kind: RaidAttack;
  score: number;
  /** Who it goes at (the usual target scoring when left out). */
  target?: Fighter;
}

/**
 * A chapter's attack deck: the pattern's cards, shuffled from the seed, with
 * no card twice in a row and the signature at least once every four cards.
 * `authored` keeps the pattern's own order (chapter 1's teaching cycle).
 */
export function buildRaidDeck(
  pattern: readonly RaidAttack[],
  opts: {
    jitter: (i: number) => number;
    previous?: RaidAttack;
    signature?: RaidAttack;
    sinceSignature?: number;
    authored?: boolean;
  },
): RaidAttack[] {
  if (opts.authored) return [...pattern];
  const left = pattern
    .map((kind, i) => ({ kind, key: opts.jitter(i) }))
    .sort((a, b) => a.key - b.key)
    .map((c) => c.kind);
  const out: RaidAttack[] = [];
  let previous = opts.previous,
    since = opts.sinceSignature ?? 0;
  const signature =
    opts.signature && pattern.includes(opts.signature)
      ? opts.signature
      : undefined;
  while (left.length) {
    let i = -1;
    if (signature && since >= 3) i = left.indexOf(signature);
    if (i < 0) i = left.findIndex((k) => k !== previous);
    if (i < 0) i = 0;
    const [kind] = left.splice(i, 1);
    out.push(kind);
    since = kind === signature ? 0 : since + 1;
    previous = kind;
  }
  return out;
}
