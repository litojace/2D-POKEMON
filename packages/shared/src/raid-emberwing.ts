import type { RaidAttack } from "./raid.js";
export interface RaidBrazier {
  x: number;
  y: number;
  progress: number;
  litUntil: number;
}
export interface EmberPatch {
  id: number;
  x: number;
  y: number;
  radius: number;
  until: number;
  growAt: number;
}
export interface EmberTrail {
  x: number;
  y: number;
  tx: number;
  ty: number;
  until: number;
  width: number;
}
export const EMBERWING = {
  health: { base: 1250, perExtraPlayer: 830, gilded: 1.12 },
  perilDamage: [1, 1, 1.25, 1.5],
  cadence: { normal: 4.5, restless: 3.9, finalPhase: 0.8 },
  home: { x: 1100, y: 480 },
  braziers: [
    { x: 800, y: 260 },
    { x: 600, y: 560 },
    { x: 1000, y: 560 },
  ],
  brazierRadius: 65,
  lightSeconds: 2,
  expose: 5,
  /**
   * From the second chapter a dive turns and comes back: a second lane is
   * drawn as the first dive ends, `returnDelay` seconds before it lands.
   */
  dive: {
    delay: 1.15,
    returnDelay: 0.95,
    seconds: 0.4,
    width: 38,
    damage: 26,
    trailSeconds: 4,
  },
  /**
   * With two braziers lit, embers fall on the last one's lighter: on their
   * half of the ring (the far side stays safe, `inset` px from the centre)
   * and on the ground around that side.
   */
  lighterRain: { inset: 55, ring: 150, spread: 1.1 },
  /** Last chapter: this many groundings break its wings for `seconds`. */
  permanentGround: { after: 3, seconds: 20 },
  rain: { delay: 1.2, radius: 48, damage: 14 },
  gust: { delay: 1.1, radius: 470, spread: 0.6, damage: 8, push: 220 },
  ring: { delay: 1, speed: 260, width: 22, damage: 22, maxRadius: 1000 },
  fire: {
    damage: 6,
    initialRadius: 60,
    maxRadius: 180,
    seconds: 30,
    growth: 28,
  },
  heat: { seconds: 3, radius: 140, damage: 30 },
} as const;
/** The slowest champion's speed (px/s): brazier routes are timed by it. */
export const BRAZIER_PACE = 222;
const pairs = EMBERWING.braziers.flatMap((a, i) =>
  EMBERWING.braziers.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y)),
);
/** The shortest walk between two braziers. */
export const BRAZIER_HOP = Math.min(...pairs);
/**
 * How long a lit brazier burns. Solo lights all three in turn (the shortest
 * route plus three lights and a 1.5 s margin fit inside it). A pair lights
 * two together, then one walks to the third: never less than that walk,
 * one light and a margin. Three or more light them together.
 */
export function brazierLifetime(
  partySize: number,
  phase: number,
  peril: number,
) {
  if (partySize === 1) return peril >= 3 ? 11 : 12;
  const team = phase >= 3 ? 3.5 : 5;
  return partySize === 2
    ? Math.max(team, EMBERWING.lightSeconds + BRAZIER_HOP / BRAZIER_PACE + 0.9)
    : team;
}
export function emberwingPattern(phase: number, trait = ""): RaidAttack[] {
  const pattern: RaidAttack[] =
    phase === 1
      ? ["dive-bomb", "wing-gust", "flame-ring", "ember-rain"]
      : [
          "dive-bomb",
          "heat-mark",
          "scorched-earth",
          "wing-gust",
          "ember-rain",
          "flame-ring",
        ];
  if (trait === "molting") pattern.splice(2, 0, "dive-bomb");
  return trait === "smouldering"
    ? pattern.filter((a) => a !== "ember-rain")
    : pattern;
}
