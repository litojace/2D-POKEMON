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
// The roster, basic attacks, intervals and skill cooldowns from the design brief.
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
  pikachu: {
    name: "Pikachu",
    element: "Electric",
    role: "Ranged speedster",
    basic: ["Thunder Jolt", 280],
    skills: [
      ["Thunder Shock", 8],
      ["Electro Orb", 10],
      ["Thunder Field", 14],
      ["Volt Overload", 18],
    ],
  },
  charizard: {
    name: "Charizard",
    element: "Fire",
    role: "Burst damage fighter",
    basic: ["Flame Puff", 450],
    skills: [
      ["Fire Breath", 8],
      ["Flame Burst", 12],
      ["Inferno Spin", 15],
      ["Solar Blaze", 18],
    ],
  },
  greninja: {
    name: "Greninja",
    element: "Water",
    role: "Agile assassin",
    basic: ["Water Kunai", 260],
    skills: [
      ["Water Shuriken", 8],
      ["Aqua Ring", 12],
      ["Shadow Clone", 15],
      ["Tidal Surge", 18],
    ],
  },
  lucario: {
    name: "Lucario",
    element: "Fighting",
    role: "Counter specialist",
    basic: ["Aura Jab", 320],
    skills: [
      ["Aura Sphere", 8],
      ["Force Palm", 12],
      ["Counter Stance", 15],
      ["Aura Burst", 18],
    ],
  },
  eevee: {
    name: "Eevee",
    element: "Normal",
    role: "Versatile fighter",
    basic: ["Swift Star", 300],
    skills: [
      ["Star Volley", 8],
      ["Bite", 12],
      ["Helping Hand", 15],
      ["Last Resort", 18],
    ],
  },
  mewtwo: {
    name: "Mewtwo",
    element: "Psychic",
    role: "High-power duelist",
    basic: ["Psy Bolt", 400],
    skills: [
      ["Psybeam", 8],
      ["Psychic Wave", 12],
      ["Barrier", 15],
      ["Psystrike", 18],
    ],
  },
  snorlax: {
    name: "Snorlax",
    element: "Normal",
    role: "Defensive tank",
    basic: ["Heavy Swipe", 600],
    skills: [
      ["Body Slam", 8],
      ["Rest", 12],
      ["Yawn", 15],
      ["Heavy Impact", 18],
    ],
  },
  gengar: {
    name: "Gengar",
    element: "Ghost",
    role: "Trickster / area control",
    basic: ["Shadow Orb", 350],
    skills: [
      ["Shadow Sneak", 8],
      ["Will-O-Wisp", 12],
      ["Hex", 15],
      ["Shadow Ball", 18],
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
