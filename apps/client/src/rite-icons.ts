import {
  CHARACTERS,
  type Rite,
} from "../../../packages/shared/src/index";
import { abilityIcon } from "./ability-icons";

/**
 * Rite icons: the icon of the skill a rite changes, with a corner badge for
 * what kind of change it is (damage, cooldown, area…), so players can read a
 * choice at a glance before the text.
 */
export type RiteEffect =
  | "transform"
  | "status"
  | "damage"
  | "cooldown"
  | "area"
  | "reach"
  | "duration"
  | "count"
  | "cast"
  | "heal"
  | "knockback"
  | "combo";

export const RITE_EFFECTS: Record<
  RiteEffect,
  { label: string; color: string; glyph: string }
> = {
  transform: {
    label: "New move",
    color: "#ffb347",
    glyph: '<path fill="currentColor" d="M8 1.5 9.9 5.6 14.4 6 11 9l1 4.4L8 11.1 4 13.4 5 9 1.6 6l4.5-.4Z"/>',
  },
  status: {
    label: "New effect",
    color: "#c58cff",
    glyph: '<path d="M8 3.2a4.8 4.8 0 1 1-4.6 6.2M8 6a2 2 0 1 1-1.9 2.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  },
  damage: {
    label: "Damage",
    color: "#ff7a6b",
    glyph: '<path fill="currentColor" d="M8 2 13 8H10v6H6V8H3Z"/>',
  },
  cooldown: {
    label: "Cooldown",
    color: "#7fd3ff",
    glyph: '<circle cx="8" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 5.5v3.2l2.2 1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  },
  area: {
    label: "Area",
    color: "#ffd166",
    glyph: '<circle cx="8" cy="8" r="2.4" fill="currentColor"/><path d="M8 1.5v2.4M8 12.1v2.4M1.5 8h2.4m8.2 0h2.4M3.4 3.4l1.7 1.7m5.8 5.8 1.7 1.7m0-9.2-1.7 1.7m-5.8 5.8-1.7 1.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  },
  reach: {
    label: "Reach & speed",
    color: "#8ef0b4",
    glyph: '<path d="m2.5 4 4 4-4 4m5-8 4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  duration: {
    label: "Lasts longer",
    color: "#a8b8ff",
    glyph: '<path d="M4 2h8M4 14h8M5 2c0 4 6 4 6 6s-6 2-6 6m6-12c0 4-6 4-6 6s6 2 6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  },
  count: {
    label: "More shots",
    color: "#ffe17b",
    glyph: '<circle cx="3.6" cy="8" r="2" fill="currentColor"/><circle cx="8" cy="8" r="2" fill="currentColor"/><circle cx="12.4" cy="8" r="2" fill="currentColor"/>',
  },
  cast: {
    label: "Faster cast",
    color: "#ffe17b",
    glyph: '<path fill="currentColor" d="M9.5 1 3.5 9h4L6.5 15l6-8h-4Z"/>',
  },
  heal: {
    label: "Healing",
    color: "#7dffb0",
    glyph: '<path fill="currentColor" d="M6.3 2h3.4v4.3H14v3.4H9.7V14H6.3V9.7H2V6.3h4.3Z"/>',
  },
  knockback: {
    label: "Knockback",
    color: "#ff9f6e",
    glyph: '<path d="M2.5 3v10M6 8h7.5M10.5 4.5 14 8l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  combo: {
    label: "Combo bonus",
    color: "#f78fb3",
    glyph: '<circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="8" r="2" fill="currentColor"/><path d="M8 0.8v3M8 12.2v3M0.8 8h3m8.4 0h3" stroke="currentColor" stroke-width="1.6"/>',
  },
};

/** What a rite mainly does, from the numbers and settings it changes. */
export function riteEffect(rite: Rite): RiteEffect {
  const keys = [
    ...Object.keys(rite.set ?? {}),
    ...Object.keys(rite.mul ?? {}),
  ];
  const has = (...k: string[]) => k.some((x) => keys.includes(x));
  if (has("kind")) return "transform";
  if (has("status")) return "status";
  if (has("count")) return "count";
  if (has("heal")) return "heal";
  if (has("bonusVsStatus")) return "combo";
  if (has("damage")) return "damage";
  if (has("cooldown")) return "cooldown";
  if (has("radius", "explosion")) return "area";
  if (has("range", "speed")) return "reach";
  if (has("duration", "statusDuration")) return "duration";
  if (has("cast")) return "cast";
  if (has("knockback")) return "knockback";
  return rite.tier === "major" ? "transform" : "damage";
}

/** The ability a rite changes (a skill or the basic attack). */
export function riteAbility(rite: Rite) {
  const c = CHARACTERS[rite.fighter];
  return [c.basic, ...c.skills].find((a) => a.id === rite.skill);
}

/** Skill icon with the effect badge in its corner. */
export function riteIcon(rite: Rite, size: "large" | "chip" = "large") {
  const effect = RITE_EFFECTS[riteEffect(rite)];
  const ability = riteAbility(rite);
  return `<span class="rite-icon ${size}${rite.tier === "major" ? " major" : ""}" style="--effect:${effect.color}">${abilityIcon(ability?.name ?? "Attack")}<svg class="rite-badge" viewBox="0 0 16 16" aria-hidden="true" style="color:${effect.color}">${effect.glyph}</svg></span>`;
}
