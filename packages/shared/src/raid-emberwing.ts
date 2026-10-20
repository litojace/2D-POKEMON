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
  perilDamage: [1, 1, 1.12, 1.24],
  cadence: { normal: 4.5, restless: 3.9, finalPhase: 0.8 },
  home: { x: 1100, y: 480 },
  braziers: [
    { x: 800, y: 260 },
    { x: 600, y: 560 },
    { x: 1000, y: 560 },
  ],
  brazierRadius: 65,
  lightSeconds: 1.5,
  expose: 6,
  dive: { delay: 1.3, seconds: 0.4, width: 38, damage: 26, trailSeconds: 4 },
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
export function brazierLifetime(
  partySize: number,
  phase: number,
  peril: number,
) {
  return partySize === 1 ? (peril >= 3 ? 8 : 12) : phase >= 3 ? 4 : 6;
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
