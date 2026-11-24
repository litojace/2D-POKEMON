import type { RaidAttack } from "./raid.js";
export interface StormTwin {
  id: string;
  name: "Fizz" | "Crackle";
  maxHp: number;
  stagger: number;
  exposedUntil: number;
  fallenAt?: number;
  reviveAt?: number;
}
export interface StormPoint {
  x: number;
  y: number;
}
/**
 * Ascendant Storm Twins' Mirror Charge while it runs (RaidState.stormMirror):
 * each twin's charge sign and the opposite-sign hits it still needs, each
 * raider's sign (alone: it flips at `flipAt`).
 */
export interface StormMirror {
  startedAt: number;
  until: number;
  /** Alone: the raider's sign flips here (both halves shown from the start). */
  flipAt?: number;
  signs: { playerId: string; sign: 1 | -1 }[];
  twins: { id: string; sign: 1 | -1; need: number; hits: number }[];
}
/** Ascendant Storm Twins' Short Circuit as it fires (RaidState.stormShort). */
export interface StormShort {
  x: number;
  y: number;
  tx: number;
  ty: number;
  until: number;
  /** Raiders who stood on it and shared the shock (none: it arced). */
  sharers: string[];
}
export const STORM_TWINS = {
  health: { base: 1600, perExtraPlayer: 960, gilded: 1.12 },
  perilDamage: [1, 1, 1.25, 1.5],
  cadence: { normal: 4.6, restless: 4, finalPhase: 0.8 },
  home: { x: 960, y: 450 },
  posts: [
    { x: 600, y: 260 },
    { x: 1060, y: 260 },
    { x: 600, y: 640 },
    { x: 1060, y: 640 },
  ],
  radius: 56,
  reviveFraction: 0.5,
  /**
   * Link Beam: the twins steer so the beam sweeps across the biggest group,
   * at their orbit speed, and hold still for the warning's last `hold`
   * seconds (0.6 s and a tick or two) so its drawn line is where it lands.
   */
  link: {
    delay: 1.15,
    seconds: 2.4,
    width: 22,
    damage: 24,
    bickeringDamage: 14,
    hold: 0.7,
  },
  chain: { delay: 1.3, range: 200, damage: [24, 16, 10] },
  field: { delay: 1.2, radius: 100, seconds: 6, damage: 5 },
  /** Twin Rush lanes run through raiders, to the ring's edge (`box`). */
  rush: {
    delay: 1.35,
    width: 38,
    seconds: 0.6,
    damage: 26,
    box: { x0: 100, y0: 170, x1: 1500, y1: 730 },
  },
  polarity: { seconds: 4, range: 125, padRadius: 58, damage: 28 },
  clap: { delay: 1.2, radius: 180, damage: 22 },
} as const;
export function twinKillWindow(
  peril: number,
  partySize: number,
  trait: string,
) {
  return (
    ([15, 15, 12, 7][peril] ?? 7) +
    (partySize === 1 ? 3 : 0) +
    (trait === "in-sync" ? 3 : 0)
  );
}
export function stormTwinsPattern(phase: number, trait = ""): RaidAttack[] {
  const p: RaidAttack[] =
    phase === 1
      ? ["link-beam", "chain-lightning", "twin-rush", "thunderclap"]
      : [
          "polarity",
          "link-beam",
          "static-field",
          "chain-lightning",
          "twin-rush",
          "thunderclap",
        ];
  if (trait === "overloaded") p.splice(2, 0, "static-field");
  return p;
}
export const stormSegmentDistance = (
  p: StormPoint,
  a: StormPoint,
  b: StormPoint,
) => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
};
/** The beam from `a` to `b`, bent through copper post `post` of `posts`. */
export const stormBeamPoints = (
  a: StormPoint,
  b: StormPoint,
  post?: number,
  posts: readonly StormPoint[] = STORM_TWINS.posts,
): StormPoint[] =>
  [a, ...(post === undefined ? [] : [posts[post % posts.length]]), b].map(
    (p) => ({ x: p.x, y: p.y }),
  );
