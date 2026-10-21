import type { MutatorId } from "./index.js";
export const ARCADE_EVENTS = {
  "crown-chase": {
    name: "Crown Chase",
    text: "Chase the moving hill. Hold it uncontested for 18 seconds, or knock out the other side.",
    tip: "The gold circle moves every 15 seconds. Get there first and protect your space.",
    color: "#ffd991",
    mutators: ["crown", "quick", "orbs"] as MutatorId[],
  },
  "meteor-mayhem": {
    name: "Meteor Mayhem",
    text: "Fight beneath falling stars. Marked circles warn you before every impact.",
    tip: "Move out of the red circles. Meteors hit everyone, so use them to pressure your rival.",
    color: "#ffa880",
    mutators: ["quick", "orbs"] as MutatorId[],
  },
  "ultimate-overload": {
    name: "Ultimate Overload",
    text: "Ultimates charge four times faster. Energy orbs and quick rounds keep the pressure on.",
    tip: "Expect more ultimates from both sides. Save your dash for the big attacks.",
    color: "#c4a0ff",
    mutators: ["quick", "orbs"] as MutatorId[],
  },
} as const;
export type ArcadeId = keyof typeof ARCADE_EVENTS;
export const ARCADE_IDS = Object.keys(ARCADE_EVENTS) as ArcadeId[];
/** Monday-to-Sunday rotation, based on the same Pacific day as daily raids. */
export function arcadeWeek(day: string) {
  const n = new Date(`${day}T12:00:00Z`),
    dow = (n.getUTCDay() + 6) % 7;
  n.setUTCDate(n.getUTCDate() - dow);
  const week = n.toISOString().slice(0, 10),
    index = Math.floor(
      (Date.parse(`${week}T12:00:00Z`) - Date.parse("2026-01-05T12:00:00Z")) /
        604800000,
    );
  const id =
    ARCADE_IDS[
      ((index % ARCADE_IDS.length) + ARCADE_IDS.length) % ARCADE_IDS.length
    ];
  const end = new Date(n);
  end.setUTCDate(end.getUTCDate() + 7);
  return { id, week, end: end.toISOString().slice(0, 10) };
}
export interface ArcadeState {
  id: ArcadeId;
  week: string;
  hill?: {
    x: number;
    y: number;
    radius: number;
    target: number;
    movesIn: number;
  };
  meteors?: { id: number; x: number; y: number; radius: number; at: number }[];
}
