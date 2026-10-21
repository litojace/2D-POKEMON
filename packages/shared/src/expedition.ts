import type { RaidBossId, RaidRite } from "./raid.js";
import { arcadeWeek } from "./arcade.js";
export type CampChoice = "rest" | "surge";
export interface ExpeditionState {
  id: string;
  day: string;
  route: RaidBossId[];
  leg: number;
  completed: number;
  elapsed: number;
  downs: number;
  revives: number;
  camp: boolean;
  contributions?: Record<
    string,
    { damage: number; revives: number; downs: number }
  >;
  choices: Record<string, CampChoice>;
  saved?: "saving" | "saved" | "unavailable";
}
export interface ExpeditionCarry {
  hp: number;
  ult: number;
  rites: RaidRite[];
}
export function expeditionRoute(day: string): RaidBossId[] {
  const week = arcadeWeek(day).week;
  const n = Math.floor(Date.parse(`${week}T12:00:00Z`) / 604800000);
  const routes: RaidBossId[][] = [
    ["grumblecrag", "tidewyrm", "emberwing"],
    ["gloomshade", "somnara", "storm-twins"],
    ["tidewyrm", "gloomshade", "prismatail"],
  ];
  return [...routes[((n % routes.length) + routes.length) % routes.length]];
}
