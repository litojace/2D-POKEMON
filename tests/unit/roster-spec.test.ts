import { expect, it } from "vitest";
import {
  CHARACTERS,
  FIGHTER_IDS,
  SKILL_SLOTS,
  basicInterval,
  inputSchema,
  blankInput,
  type CharacterId,
} from "@arena/shared";
import { mobileLayout } from "../../apps/client/src/mobile-input";
// The original roster: names, elements, roles, basic attacks, intervals and skill cooldowns.
const ROSTER: Record<
  CharacterId,
  {
    name: string;
    element: string;
    role: string;
    basic: [string, number];
    skills: [string, number][];
  }
> = {
  voltkit: {
    name: "Voltkit",
    element: "Electric",
    role: "Ranged speedster",
    basic: ["Spark Dart", 280],
    skills: [
      ["Static Lance", 8],
      ["Ball Lightning", 10],
      ["Storm Grid", 14],
      ["Overcharge", 18],
    ],
  },
  cindrake: {
    name: "Cindrake",
    element: "Fire",
    role: "Burst damage fighter",
    basic: ["Cinder Snap", 450],
    skills: [
      ["Ember Gust", 8],
      ["Magma Bomb", 12],
      ["Blaze Whirl", 15],
      ["Sunfire Pillar", 18],
    ],
  },
  tidefin: {
    name: "Tidefin",
    element: "Water",
    role: "Agile assassin",
    basic: ["Tide Needle", 260],
    skills: [
      ["Ripple Stars", 8],
      ["Whirlpool", 12],
      ["Mirror Mist", 15],
      ["Riptide Wave", 18],
    ],
  },
  auralynx: {
    name: "Auralynx",
    element: "Aura",
    role: "Counter specialist",
    basic: ["Prism Jab", 320],
    skills: [
      ["Prism Shot", 8],
      ["Shatter Palm", 12],
      ["Mirror Guard", 15],
      ["Nova Burst", 18],
    ],
  },
  lumoth: {
    name: "Lumoth",
    element: "Light",
    role: "Versatile fighter",
    basic: ["Glint", 300],
    skills: [
      ["Starfall Spray", 8],
      ["Dust Strike", 12],
      ["Kindle", 15],
      ["Radiant Flare", 18],
    ],
  },
  mystowl: {
    name: "Mystowl",
    element: "Psychic",
    role: "High-power duelist",
    basic: ["Mind Dart", 400],
    skills: [
      ["Focus Ray", 8],
      ["Repulse", 12],
      ["Ward", 15],
      ["Thoughtstrike", 18],
    ],
  },
  terradon: {
    name: "Terradon",
    element: "Earth",
    role: "Defensive tank",
    basic: ["Boulder Swipe", 600],
    skills: [
      ["Shell Slam", 8],
      ["Hibernate", 12],
      ["Dust Cloud", 15],
      ["Tremor", 18],
    ],
  },
  duskveil: {
    name: "Duskveil",
    element: "Shadow",
    role: "Trickster / area control",
    basic: ["Lantern Wisp", 350],
    skills: [
      ["Shade Crawl", 8],
      ["Ghostfire", 12],
      ["Curse Mark", 15],
      ["Void Orb", 18],
    ],
  },
};
it("matches the eight-fighter roster, basic attacks and four skills exactly", () => {
  expect([...FIGHTER_IDS].sort()).toEqual(Object.keys(ROSTER).sort());
  for (const [id, spec] of Object.entries(ROSTER)) {
    const c = CHARACTERS[id as CharacterId];
    expect([c.name, c.element, c.role]).toEqual([
      spec.name,
      spec.element,
      spec.role,
    ]);
    expect(c.basic.name).toBe(spec.basic[0]);
    expect(Math.round(basicInterval(c) * 1000)).toBe(spec.basic[1]);
    expect(c.basic.cooldown).toBe(0);
    expect(c.skills.map((a) => [a.name, a.cooldown])).toEqual(spec.skills);
    expect(c.skills).toHaveLength(SKILL_SLOTS);
    // Dash and jump are universal; no special skill is a dash.
    for (const a of c.skills) expect(a.kind).not.toBe("movement");
  }
});
it("accepts four skill slots and exposes seven distinct touch targets", () => {
  expect(inputSchema.safeParse({ ...blankInput(), skill: 3 }).success).toBe(
    true,
  );
  expect(inputSchema.safeParse({ ...blankInput(), skill: 4 }).success).toBe(
    false,
  );
  for (const [w, h] of [
    [700, 320],
    [1000, 700],
  ])
    expect(
      mobileLayout(w, h)
        .targets.map((t) => t.action)
        .sort(),
    ).toEqual(["0", "1", "2", "3", "attack", "dash", "jump"]);
});
