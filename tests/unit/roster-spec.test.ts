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
// The eighteen-champion roster: names, elements, roles, basic attacks, intervals and skill cooldowns.
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
    basic: ["Spark Dart", 270],
    skills: [
      ["Static Lance", 8],
      ["Ball Lightning", 10],
      ["Static Glide", 12],
      ["Overcharge", 20],
    ],
  },
  cindrake: {
    name: "Cindrake",
    element: "Fire",
    role: "Burst damage fighter",
    basic: ["Cinder Snap", 455],
    skills: [
      ["Crest Flare", 8],
      ["Magma Bomb", 12],
      ["Heat Cracks", 15],
      ["Sunfire Pillar", 20],
    ],
  },
  tidefin: {
    name: "Tidefin",
    element: "Water",
    role: "Agile assassin",
    basic: ["Tide Needle", 240],
    skills: [
      ["Gill Spray", 8],
      ["Eddy", 12],
      ["Tide Double", 15],
      ["Riptide Wave", 20],
    ],
  },
  auralynx: {
    name: "Auralynx",
    element: "Aura",
    role: "Counter specialist",
    basic: ["Prism Jab", 335],
    skills: [
      ["Prism Shot", 8],
      ["Shatter Paw", 12],
      ["Facet Guard", 15],
      ["Shard Nova", 20],
    ],
  },
  lumoth: {
    name: "Lumoth",
    element: "Light",
    role: "Versatile fighter",
    basic: ["Glint", 310],
    skills: [
      ["Wing Dust", 8],
      ["Eyespot Flash", 12],
      ["Kindle", 15],
      ["Radiant Flare", 20],
    ],
  },
  mystowl: {
    name: "Mystowl",
    element: "Psychic",
    role: "High-power duelist",
    basic: ["Mind Dart", 390],
    skills: [
      ["Third-Eye Ray", 8],
      ["Booming Hoot", 12],
      ["Wing Cloak", 15],
      ["Silent Swoop", 20],
    ],
  },
  terradon: {
    name: "Terradon",
    element: "Earth",
    role: "Defensive tank",
    basic: ["Boulder Swipe", 630],
    skills: [
      ["Shell Bash", 8],
      ["Shell Up", 16],
      ["Mud Mire", 15],
      ["Tremor", 20],
    ],
  },
  duskveil: {
    name: "Duskveil",
    element: "Shadow",
    role: "Trickster / area control",
    basic: ["Lantern Wisp", 345],
    skills: [
      ["Shade Crawl", 8],
      ["Ghostfire", 12],
      ["Haunted Lantern", 18],
      ["Void Orb", 20],
    ],
  },
  coilemur: {
    name: "Coilemur",
    element: "Electric",
    role: "Grappler",
    basic: ["Coil Swipe", 360],
    skills: [
      ["Magnet Lash", 12],
      ["Static Clamp", 12],
      ["Spark Tether", 15],
      ["Electromagnet", 20],
    ],
  },
  pyranda: {
    name: "Pyranda",
    element: "Fire",
    role: "Artillery",
    basic: ["Ember Lob", 440],
    skills: [
      ["Chestnut Mortar", 8],
      ["Hot Coals", 12],
      ["Tail Wrap", 15],
      ["Chestnut Storm", 20],
    ],
  },
  glacelle: {
    name: "Glacelle",
    element: "Water",
    role: "Frost controller",
    basic: ["Rime Shard", 325],
    skills: [
      ["Hailstone", 8],
      ["Frost Bloom", 12],
      ["Frost Breath", 15],
      ["Whiteout", 20],
    ],
  },
  halcyra: {
    name: "Halcyra",
    element: "Aura",
    role: "Marksman",
    basic: ["Aura Quill", 370],
    skills: [
      ["Pinning Quill", 8],
      ["Focus Shot", 12],
      ["Mirage Perch", 15],
      ["Skyline Lance", 20],
    ],
  },
  sunbara: {
    name: "Sunbara",
    element: "Light",
    role: "Support",
    basic: ["Sunseed", 335],
    skills: [
      ["Yuzu Toss", 8],
      ["Warm Spring", 12],
      ["Daybreak", 15],
      ["Sanctuary", 20],
    ],
  },
  astrabun: {
    name: "Astrabun",
    element: "Psychic",
    role: "Blink duelist",
    basic: ["Mallet Bop", 410],
    skills: [
      ["Moon Hop", 8],
      ["Mochi Pound", 12],
      ["Moon Gravity", 15],
      ["Full Moon", 20],
    ],
  },
  wombolder: {
    name: "Wombolder",
    element: "Earth",
    role: "Charger",
    basic: ["Rump Bump", 535],
    skills: [
      ["Burrow Rush", 9],
      ["Pebble Spray", 12],
      ["Rump Block", 15],
      ["Landslide", 20],
    ],
  },
  shadopus: {
    name: "Shadopus",
    element: "Shadow",
    role: "Stealth assassin",
    basic: ["Tentacle Lash", 305],
    skills: [
      ["Ink Jet", 8],
      ["Ink Strike", 12],
      ["Ink Cloud", 15],
      ["Kraken Grasp", 20],
    ],
  },
  pangrove: {
    name: "Pangrove",
    element: "Nature",
    role: "Armoured roller",
    basic: ["Scale Swipe", 450],
    skills: [
      ["Tongue Grapple", 8],
      ["Scale Shrapnel", 9],
      ["Curl & Roll", 11],
      ["Pinball", 20],
    ],
  },
  mossloth: {
    name: "Mossloth",
    element: "Nature",
    role: "Time gardener",
    basic: ["Seed Spit", 345],
    skills: [
      ["Seedling", 5],
      ["Sloth Time", 14],
      ["Lazy Swap", 12],
      ["Overgrowth", 20],
    ],
  },
};
it("matches the eighteen-fighter roster, basic attacks and four skills exactly", () => {
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
