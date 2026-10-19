import type { RaidAttack } from "./raid.js";

export const DREAM_RUNES = ["circle", "star", "moon", "wave"] as const;
export type DreamRune = (typeof DREAM_RUNES)[number];
export const DREAM_RUNE_NAMES: Record<DreamRune, string> = {
  circle: "Circle",
  star: "Star",
  moon: "Moon",
  wave: "Wave",
};
/** Recipient-only dream information. Never part of RaidState or a room broadcast. */
export interface RaidDreamView {
  id: number;
  runes: DreamRune[];
  full: boolean;
  backwards: boolean;
}
export const SOMNARA = {
  health: { base: 1050, perExtraPlayer: 1000, gilded: 1.12 },
  perilDamage: [1, 1, 1.1, 1.2],
  cadence: { normal: 4.8, restless: 4.3, finalPhase: 0.8 },
  home: { x: 800, y: 450 },
  pads: [
    { rune: "circle", x: 500, y: 270 },
    { rune: "star", x: 1100, y: 270 },
    { rune: "moon", x: 1100, y: 630 },
    { rune: "wave", x: 500, y: 630 },
  ] as const,
  padRadius: 56,
  sequence: {
    seconds: 10,
    soloSeconds: 14,
    expose: 6,
    stepGap: 0.3,
    nightmare: 18,
  },
  lullaby: {
    delay: 1.1,
    count: 3,
    gap: 0.8,
    speed: 240,
    width: 22,
    radius: 820,
    damage: 6,
  },
  tail: { delay: 1.25, length: 340, width: 115, damage: 26 },
  bubbles: { delay: 0.9, speed: 115, radius: 24, seconds: 8, count: 3 },
  stars: { delay: 1.5, radius: 64, damage: 22 },
  song: { seconds: 4, damage: 30, radius: [0, 175, 150, 125], travel: 100 },
  drowsy: { stacks: 3, seconds: 12, sleep: 2 },
} as const;

export function somnaraSequenceLength(
  phase: number,
  peril: number,
  partySize: number,
  trait: string,
) {
  const base = phase === 1 ? 3 : 2 + peril;
  return Math.max(
    2,
    base +
      (trait === "deep-slumber" ? 1 : trait === "restless-dream" ? -1 : 0) -
      (partySize === 1 ? 1 : 0),
  );
}
export function somnaraPattern(phase: number): RaidAttack[] {
  if (phase === 1)
    return ["dream-sequence", "lullaby", "tail-splash", "dream-bubbles"];
  if (phase === 2)
    return [
      "dream-sequence",
      "falling-stars",
      "lullaby",
      "whale-song",
      "tail-splash",
      "dream-bubbles",
    ];
  return [
    "dream-sequence",
    "lullaby",
    "falling-stars",
    "whale-song",
    "dream-bubbles",
    "tail-splash",
  ];
}
/** The moving Quiet Zone's centre; client and server use exactly the same path. */
export function quietZoneAt(
  zone: { x: number; y: number; startedAt: number },
  time: number,
) {
  const t = Math.max(0, Math.min(SOMNARA.song.seconds, time - zone.startedAt));
  return {
    x:
      zone.x +
      Math.sin((t * Math.PI) / SOMNARA.song.seconds) * SOMNARA.song.travel,
    y: zone.y + Math.sin((t * Math.PI * 2) / SOMNARA.song.seconds) * 35,
  };
}
